"""Everything clinicians and clients do: alert actions, help requests, plans.

Kept in memory. A real deployment would write these to the EHR; for the hackathon
they live for as long as the process does, and POST /v1/demo/reset clears them.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

State = dict[str, Any]


def _empty() -> State:
    return {"actions": {}, "escalations": [], "care_plans": {}, "audit": []}


_state: State = _empty()


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def reset() -> None:
    global _state
    _state = _empty()


def log(event: str, **fields: Any) -> None:
    _state["audit"].insert(0, {"at": now(), "event": event, **fields})
    del _state["audit"][500:]


def audit() -> list[dict]:
    return _state["audit"]


# ---- alerts ----
def action_for(alert_id: str) -> dict | None:
    return _state["actions"].get(alert_id)


def record_action(alert_id: str, patient_id: str, action: str, clinician: str, reason: str | None) -> dict:
    entry = {"action": action, "reason": reason, "clinician": clinician, "at": now()}
    _state["actions"][alert_id] = entry
    log("alert_action", alert_id=alert_id, patient_id=patient_id, action=action, clinician=clinician, reason=reason)
    return entry


# ---- help requests ----
def escalations(status: str | None = None) -> list[dict]:
    return [e for e in _state["escalations"] if not status or e["status"] == status]


def escalation(escalation_id: str) -> dict | None:
    return next((e for e in _state["escalations"] if e["escalation_id"] == escalation_id), None)


def add_escalation(esc: dict) -> dict:
    _state["escalations"].insert(0, esc)
    log("escalation_opened", escalation_id=esc["escalation_id"], patient_id=esc["patient_id"],
        trigger=esc["trigger"], consent=esc["consent"])
    return esc


def answer_escalation(esc: dict, text: str, clinician: str) -> dict:
    response = {"text": text, "clinician": clinician, "created_at": now()}
    esc["status"] = "answered"
    esc["response"] = response
    add_plan_item(esc["patient_id"], text, clinician)
    log("escalation_answered", escalation_id=esc["escalation_id"], patient_id=esc["patient_id"], clinician=clinician)
    return esc


# ---- care-team plans ----
def care_plan(patient_id: str) -> list[dict]:
    return _state["care_plans"].get(patient_id, [])


def add_plan_item(patient_id: str, text: str, clinician: str) -> dict:
    item = {"text": text, "author": clinician, "source": "care_team", "created_at": now()}
    _state["care_plans"].setdefault(patient_id, []).append(item)
    log("care_plan_item", patient_id=patient_id, clinician=clinician)
    return item
