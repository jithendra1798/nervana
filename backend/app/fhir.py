"""Standards-shaped views of the same alert, so it can land inside an EHR.

- GET /fhir/RiskAssessment?patient=…  → a FHIR R4 RiskAssessment (what an EHR stores)
- GET /cds-services + POST /cds-services/nervana-climate-ptsd → CDS Hooks
  (what puts a card in front of a clinician opening the chart)

Nothing here re-scores anything; it is the same risk in the shapes those systems read.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from . import recommend, workflow
from .store import get_store

router = APIRouter(tags=["integration"])

SERVICE_ID = "nervana-climate-ptsd"
QUALITATIVE = {"act": "high", "watch": "moderate", "none": "low"}
INDICATOR = {"act": "critical", "watch": "warning", "none": "info"}


def _payload(patient_id: str, as_of: str | None) -> dict[str, Any]:
    from .main import _risk_payload  # imported late: main builds the router in
    s = get_store()
    if not s.patient(patient_id):
        raise HTTPException(404, f"No client {patient_id}")
    return _risk_payload(patient_id, s.resolve(as_of))


@router.get("/fhir/RiskAssessment")
def risk_assessment(patient: str, as_of: str | None = None) -> dict:
    p = _payload(patient, as_of)
    return {
        "resourceType": "RiskAssessment",
        "id": f"nervana-{patient}-{p['as_of']}",
        "status": "final",
        "subject": {"reference": f"Patient/{patient}"},
        "occurrenceDateTime": p["as_of"],
        "method": {"text": "Nervana rule-based climate-trigger score for PTSD (see contracts/README.md)"},
        "prediction": [{
            "outcome": {"text": "PTSD symptoms worsened by conditions nearby (noise, heat, air quality)"},
            "qualitativeRisk": {"coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/risk-probability",
                "code": QUALITATIVE[p["level"]],
                "display": p["level"],
            }]},
            "rationale": "; ".join(f["label"] for f in p["factors"]) or "No unusual conditions",
        }],
        "basis": [{"display": f"{f['label']} (source: {f['source']})"} for f in p["factors"]],
        "note": [
            {"text": f"Confidence: {p['uncertainty']['confidence']}."},
            *[{"text": c} for c in p["uncertainty"]["caveats"]],
            {"text": f"Suggested next step: {p['next_step']['text']}"},
        ],
    }


@router.get("/cds-services")
def discovery() -> dict:
    return {"services": [{
        "hook": "patient-view",
        "title": "Nervana climate-risk alert (PTSD)",
        "description": "Flags clients with PTSD whose surroundings raise their risk right now, with the reasons and a next step.",
        "id": SERVICE_ID,
        "prefetch": {"patient": "Patient/{{context.patientId}}"},
    }]}


class HookRequest(BaseModel):
    hook: str = "patient-view"
    hookInstance: str | None = None
    context: dict[str, Any] = {}
    prefetch: dict[str, Any] | None = None


@router.post(f"/cds-services/{SERVICE_ID}")
def patient_view(req: HookRequest) -> dict:
    patient_id = str(req.context.get("patientId", ""))
    s = get_store()
    if not s.patient(patient_id):
        return {"cards": []}
    p = _payload(patient_id, req.context.get("asOf"))
    if p["level"] == "none":
        return {"cards": []}

    reasons = "\n".join(f"- {f['label']} (+{f['contribution']:.2f}, {f['source']})" for f in p["factors"])
    caveats = "\n".join(f"- {c}" for c in p["uncertainty"]["caveats"])
    detail = (f"**Why now**\n{reasons}\n\n**Next step**\n{p['next_step']['text']}\n\n"
              f"**How sure we are: {p['uncertainty']['confidence']}**\n{caveats}")
    top = recommend.top_trigger(p["factors"])
    return {"cards": [{
        "uuid": f"nervana-{patient_id}-{p['as_of']}",
        "summary": f"{p['patient']['name']}: {p['level'].upper()}, {top} risk nearby (score {p['score']:.2f})",
        "indicator": INDICATOR[p["level"]],
        "detail": detail,
        "source": {"label": "Nervana", "url": "https://github.com/jithendra1798/nervana"},
        "suggestions": [{"label": "Log outreach", "uuid": f"outreach-{patient_id}"}],
        "overrideReasons": [{"code": "in-contact", "display": "Already in contact today"},
                            {"code": "not-relevant", "display": "Not relevant for this client"}],
        "links": [{"label": "Open in Nervana", "url": f"http://localhost:5173/patients/{patient_id}", "type": "absolute"}],
    }]}


@router.get("/v1/integration/preview")
def preview(patient: str, as_of: str | None = None) -> dict:
    """Both integration shapes side by side, for the demo's 'fits the EHR' screen."""
    card = patient_view(HookRequest(context={"patientId": patient, "asOf": as_of}))
    return {"cds_hooks": card, "fhir": risk_assessment(patient, as_of), "audit": workflow.audit()[:5]}
