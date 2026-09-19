"""Nervana API — climate-triggered PTSD alerts for care teams.

Shapes are defined in contracts/README.md. The data comes from data/out/<scenario>/,
written by the pipelines in data/pipelines.
"""
from __future__ import annotations

import os
from datetime import datetime
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import fhir, personalize, recommend, workflow
from .store import get_store

app = FastAPI(title="Nervana API", version="0.1.0",
              description="Person-specific climate-risk alerts for clients with PTSD, built for provider systems.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

BANDS = ((0.5, "high"), (0.25, "moderate"))


def band_of(severity: float) -> str:
    return next((name for edge, name in BANDS if severity >= edge), "low")


def alert_id(patient_id: str, episode_start: datetime) -> str:
    return f"AL-{patient_id}-{episode_start:%Y%m%d%H}"


def _alert(risk_row: dict, hour: datetime) -> dict:
    s = get_store()
    p = s.patient(risk_row["patient_id"]) or {}
    aid = alert_id(risk_row["patient_id"], s.episode_start(risk_row["patient_id"], hour))
    action = workflow.action_for(aid)
    factors = risk_row["factors"]
    top = next((f for f in factors if f["trigger"] != "patient"), factors[0] if factors else {"label": ""})
    episode = s.episode_start(risk_row["patient_id"], hour)
    return {
        "alert_id": aid,
        "flagged_since": episode.isoformat(),
        "patient_id": p.get("id", risk_row["patient_id"]),
        "patient_name": p.get("name", ""),
        "age": p.get("age"),
        "zip": p.get("zip"),
        "program": p.get("program"),
        "care_team": p.get("care_team"),
        "level": risk_row["level"],
        "score": risk_row["score"],
        "top_factor": top["label"],
        "confidence": risk_row["uncertainty"]["confidence"],
        "status": "new" if not action else ("outreach" if action["action"] == "outreach" else "dismissed"),
        "action": action,
    }


@app.get("/v1/scenario")
def scenario() -> dict:
    s = get_store()
    return {**s.scenario, "is_fixture": s.is_fallback or s.scenario.get("is_fixture", False)}


@app.get("/v1/map")
def risk_map(as_of: str | None = None, trigger: Literal["composite", "noise", "heat", "air"] = "composite") -> dict:
    s = get_store()
    hour = s.resolve(as_of)
    zips = []
    for e in s.exposures_at(hour):
        severity = e["composite"] if trigger == "composite" else e[trigger]
        zips.append({
            "zip": e["zip"], "severity": severity, "band": band_of(severity),
            "top_trigger": max(("noise", "heat", "air"), key=lambda t: e[t]),
            "noise": e["noise"], "air": e["air"], "heat": e["heat"],
        })
    zips.sort(key=lambda z: -z["severity"])
    return {"as_of": hour.isoformat(), "trigger": trigger, "zips": zips}


@app.get("/v1/alerts")
def alerts(as_of: str | None = None, level: str | None = None, program: str | None = None,
           care_team: str | None = None, limit: int = Query(100, ge=1, le=500)) -> dict:
    s = get_store()
    hour = s.resolve(as_of)
    rows = [_alert(r, hour) for r in s.risk_at(hour)]
    if level:
        rows = [a for a in rows if a["level"] == level]
    if program:
        rows = [a for a in rows if a["program"] == program]
    if care_team:
        rows = [a for a in rows if a["care_team"] == care_team]
    order = {"act": 0, "watch": 1, "none": 2}
    rows.sort(key=lambda a: (order[a["level"]], -a["score"]))
    return {"as_of": hour.isoformat(), "count": len(rows), "shown": min(len(rows), limit), "alerts": rows[:limit]}


class ActionBody(BaseModel):
    action: Literal["outreach", "dismiss"]
    reason: str | None = None
    clinician: str = "Unknown clinician"


@app.post("/v1/alerts/{alert_id_}/action")
def alert_action(alert_id_: str, body: ActionBody, as_of: str | None = None) -> dict:
    s = get_store()
    hour = s.resolve(as_of)
    match = next((r for r in s.risk_at(hour) if alert_id(r["patient_id"], s.episode_start(r["patient_id"], hour)) == alert_id_), None)
    if not match:
        raise HTTPException(404, f"No alert {alert_id_} at this hour")
    workflow.record_action(alert_id_, match["patient_id"], body.action, body.clinician, body.reason)
    return _alert(match, hour)


def _risk_payload(patient_id: str, hour: datetime) -> dict:
    s = get_store()
    p = s.patient(patient_id)
    if not p:
        raise HTTPException(404, f"No client {patient_id}")
    row = s.risk_for(patient_id, hour)
    factors = row["factors"] if row else []
    plan = workflow.care_plan(patient_id)
    profile = workflow.profile(patient_id)
    exposure = s.exposure_for(p["zip"], hour) or {}
    caveats = row["uncertainty"]["caveats"] if row else [
        f"Exposure is estimated for all of ZIP {p['zip']}, not this person's block",
        "No pharmacy data: medication effects, such as SSRIs in heat, are not assessed",
    ]
    return {
        "patient": p,
        "as_of": hour.isoformat(),
        "level": row["level"] if row else "none",
        "score": row["score"] if row else 0.0,
        "factors": factors,
        "uncertainty": {"confidence": row["uncertainty"]["confidence"] if row else "medium", "caveats": caveats},
        "next_step": recommend.next_step(row["level"] if row else "none", factors, plan),
        "tips": personalize.merge(personalize.personal_tips(profile, factors), recommend.tips_for(factors)),
        "profile_note": personalize.clinician_note(profile, factors),
        "has_profile": bool(profile),
        "timeline": s.timeline(p["zip"], hour),
        "exposure": {k: exposure.get(k) for k in ("noise", "heat", "air", "composite")} | {"raw": exposure.get("raw", {})},
    }


@app.get("/v1/patients/{patient_id}/risk")
def patient_risk(patient_id: str, as_of: str | None = None) -> dict:
    return _risk_payload(patient_id, get_store().resolve(as_of))


@app.get("/v1/patients/{patient_id}/plan")
def patient_plan(patient_id: str, as_of: str | None = None) -> dict:
    s = get_store()
    hour = s.resolve(as_of)
    if not s.patient(patient_id):
        raise HTTPException(404, f"No client {patient_id}")
    row = s.risk_for(patient_id, hour)
    factors = row["factors"] if row else []
    personal = personalize.personal_tips(workflow.profile(patient_id), factors)
    tips = recommend.tips_for(factors)
    care = sorted(workflow.care_plan(patient_id), key=lambda i: i["created_at"], reverse=True)
    as_item = lambda t: {"text": t["text"], "author": None, "source": t.get("source", "standard_tips"), "created_at": None}
    return {"patient_id": patient_id, "items": care + [as_item(t) for t in personalize.merge(personal, tips)]}


class EscalationBody(BaseModel):
    patient_id: str
    trigger: Literal["need_help", "threshold"] = "need_help"
    consent: bool = False
    note: str | None = Field(default=None, max_length=1000)


@app.post("/v1/escalations", status_code=201)
def create_escalation(body: EscalationBody, as_of: str | None = None) -> dict:
    s = get_store()
    hour = s.resolve(as_of)
    p = s.patient(body.patient_id)
    if not p:
        raise HTTPException(404, f"No client {body.patient_id}")
    if not body.consent:
        raise HTTPException(400, "Consent is required before sharing anything with the care team")

    payload = _risk_payload(body.patient_id, hour)
    factors = payload["factors"]
    top = next((f["label"] for f in factors if f["trigger"] != "patient"), None)
    summary = f"{p['name']} pressed I need help"
    if top:
        summary += f", with {top[0].lower()}{top[1:]} nearby"
    summary += f" (level: {payload['level']})."
    if body.note:
        summary += f" They wrote: “{body.note}”"

    missing = ["No pharmacy data"]
    if any("Contact details" in c for c in payload["uncertainty"]["caveats"]):
        missing.append(next(c for c in payload["uncertainty"]["caveats"] if "Contact details" in c))
    esc = {
        "escalation_id": f"ESC-{len(workflow.escalations()) + 1:04d}",
        "patient_id": p["id"], "patient_name": p["name"], "care_team": p["care_team"],
        "trigger": body.trigger, "consent": True, "status": "open", "created_at": workflow.now(),
        "packet": {
            "summary": summary,
            "level": payload["level"],
            "factors": factors,
            "exposures_24h": payload["timeline"],
            "tips_shown": [t["text"] for t in payload["tips"]],
            "missing_data": missing,
        },
        "response": None,
    }
    return workflow.add_escalation(esc)


@app.get("/v1/escalations")
def list_escalations(status: Literal["open", "answered"] | None = None) -> dict:
    return {"escalations": workflow.escalations(status)}


class RespondBody(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    clinician: str = "Unknown clinician"


@app.post("/v1/escalations/{escalation_id}/respond")
def respond(escalation_id: str, body: RespondBody) -> dict:
    esc = workflow.escalation(escalation_id)
    if not esc:
        raise HTTPException(404, f"No help request {escalation_id}")
    return workflow.answer_escalation(esc, body.text.strip(), body.clinician)


class ProfileBody(BaseModel):
    triggers: list[str] = []
    helps: list[str] = []
    home: dict[str, bool | None] = {}
    support_person: str | None = Field(default=None, max_length=120)
    safe_places: list[str] = []
    notes: str | None = Field(default=None, max_length=1000)
    share_with_care_team: bool = False


@app.get("/v1/patients/{patient_id}/profile")
def get_profile(patient_id: str) -> dict:
    """What the client told us about themselves. Empty until they fill the form in."""
    s = get_store()
    if not s.patient(patient_id):
        raise HTTPException(404, f"No client {patient_id}")
    return {"patient_id": patient_id, "profile": workflow.profile(patient_id), "options": personalize.PROFILE_OPTIONS}


@app.put("/v1/patients/{patient_id}/profile")
def put_profile(patient_id: str, body: ProfileBody) -> dict:
    s = get_store()
    if not s.patient(patient_id):
        raise HTTPException(404, f"No client {patient_id}")
    saved = workflow.save_profile(patient_id, body.model_dump())
    return {"patient_id": patient_id, "profile": saved, "options": personalize.PROFILE_OPTIONS}


@app.get("/v1/audit")
def audit() -> dict:
    """Every alert action, consent and reply, so the demo can show the trail."""
    return {"events": workflow.audit()}


@app.post("/v1/demo/reset")
def demo_reset() -> dict:
    workflow.reset()
    return {"ok": True}


app.include_router(fhir.router)


@app.get("/health")
def health() -> dict:
    s = get_store()
    return {"ok": True, "scenario": s.scenario["id"], "using_fixtures": s.is_fallback,
            "clients": len(s.patients), "hours": len(s.hours)}
