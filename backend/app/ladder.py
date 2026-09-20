"""Automatic escalation when something looks unusual, with humans at every rung.

Design rules, deliberate:

1. **911 is never dialled automatically.** Sending police or an ambulance to
   someone in a mental-health crisis on the strength of noise data and a heart
   rate would do harm on every false positive. Only a person decides that: the
   client, or a clinician looking at the case.
2. The ladder buys attention, not force. Care team first, then the on-call
   clinician, then the crisis line (988), which is staffed by counsellors and
   only called when the client has consented to contact.
3. Any human response stops the ladder immediately, and the client can stop it
   themselves from their phone.
4. Everything here is mocked. No call is placed; each rung writes a record
   marked `mock: true` so the demo can show the trail.

"Unusual" for the watcher means all three at once: the score is at the top of
the range, the simulated wearable is well above that person's own baseline, and
they are in an area where conditions are genuinely extreme.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

from . import vitals, workflow
from .store import get_store

# Short windows so a demo can show the whole ladder. Minutes in a real deployment.
STAGE_SECONDS = int(os.environ.get("NERVANA_LADDER_SECONDS", "60"))

# Deliberately hard to trip. Acting without a human in the loop should be rare.
SCORE_TRIGGER = 0.95
HR_ABOVE_BASELINE = 22
ENV_EXTREME = 0.9        # something where they are must be at the top of the scale
MAX_PER_RUN = 3          # the watcher never opens more than a handful at once

STAGES = [
    {"key": "care_team", "label": "Care team notified", "to": "care team line"},
    {"key": "on_call", "label": "On-call clinician paged", "to": "on-call clinician"},
    {"key": "crisis_line", "label": "Crisis line called (988)", "to": "988 crisis line"},
]
FINAL_NOTE = "911 is never dialled automatically. A clinician or the client decides that."


def _age_seconds(iso: str) -> float:
    return (datetime.now(timezone.utc) - datetime.fromisoformat(iso)).total_seconds()


def stage_for(esc: dict) -> int:
    """How far the ladder has climbed: 0 while someone is answering, up to 2."""
    if esc["status"] == "answered" or esc.get("cancelled"):
        return 0
    return min(len(STAGES) - 1, int(_age_seconds(esc["created_at"]) // STAGE_SECONDS))


def advance(esc: dict) -> dict:
    """Records any rung the clock has reached. Called whenever escalations are read."""
    if esc["status"] == "answered" or esc.get("cancelled"):
        return esc
    reached = stage_for(esc)
    placed = {c["stage"] for c in esc.setdefault("calls", [])}
    for i in range(reached + 1):
        stage = STAGES[i]
        if stage["key"] in placed:
            continue
        esc["calls"].append({
            "stage": stage["key"],
            "label": stage["label"],
            "to": stage["to"],
            "at": workflow.now(),
            "mock": True,
            "script": _script(esc, stage["key"]),
        })
        workflow.log("auto_escalation", escalation_id=esc["escalation_id"], patient_id=esc["patient_id"],
                     stage=stage["key"], mock=True)
    return esc


def _script(esc: dict, stage: str) -> str:
    who = esc["patient_name"]
    why = esc["packet"]["summary"]
    if stage == "care_team":
        return f"Automated message to {esc['care_team']}: {who} needs attention. {why}"
    if stage == "on_call":
        return f"Automated page to the on-call clinician: {who} has had no response for {STAGE_SECONDS // 60 or 1} minute(s). {why}"
    return (f"Automated call to the 988 crisis line on behalf of {who}, who consented to contact. "
            f"{why} No emergency services have been called.")


def cancel(esc: dict, by: str) -> dict:
    esc["cancelled"] = {"by": by, "at": workflow.now()}
    esc["status"] = "cancelled"
    workflow.log("escalation_cancelled", escalation_id=esc["escalation_id"], patient_id=esc["patient_id"], by=by)
    return esc


def unusual(patient: dict, hour: datetime) -> dict | None:
    """Is this person's situation unusual enough for the watcher to act alone?"""
    s = get_store()
    row = s.risk_for(patient["id"], hour)
    if not row or row["score"] < SCORE_TRIGGER:
        return None
    v = vitals.summary(patient, hour)
    if v["above_baseline"] < HR_ABOVE_BASELINE:
        return None
    exposure = s.exposure_for(patient["zip"], hour) or {}
    env_peak = max((exposure.get(t, 0.0) for t in ("noise", "heat", "air")), default=0.0)
    if env_peak < ENV_EXTREME:
        return None
    peak = max(f["contribution"] for f in row["factors"]) if row["factors"] else 0
    return {
        "score": row["score"],
        "above_baseline": v["above_baseline"],
        "heart_rate": v["now"]["heart_rate"] if v["now"] else None,
        "top_factor": next((f["label"] for f in row["factors"] if f["trigger"] != "patient"), ""),
        "peak_contribution": peak,
        "env_peak": round(env_peak, 2),
    }
