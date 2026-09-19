"""Everything clinicians and clients do: alert actions, help requests, plans.

Kept in memory. A real deployment would write these to the EHR; for the hackathon
they live for as long as the process does, and POST /v1/demo/reset clears them.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

State = dict[str, Any]

# Demo state is kept in a small file so a restart (or a reload during development)
# doesn't wipe the walkthrough halfway through.
STATE_FILE = Path(os.environ.get("NERVANA_STATE_FILE", Path(__file__).resolve().parents[1] / ".state.json"))


def _empty() -> State:
    return {"actions": {}, "escalations": [], "care_plans": {}, "profiles": {}, "audit": []}


def _load() -> State:
    try:
        return {**_empty(), **json.loads(STATE_FILE.read_text())}
    except (OSError, ValueError):
        return _empty()


def _save() -> None:
    try:
        STATE_FILE.write_text(json.dumps(_state))
    except OSError:
        pass  # read-only disk: the demo still works, it just won't survive a restart


_state: State = _load()


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def reset() -> None:
    global _state
    _state = _empty()
    _save()


def log(event: str, **fields: Any) -> None:
    _state["audit"].insert(0, {"at": now(), "event": event, **fields})
    del _state["audit"][500:]
    _save()


def audit() -> list[dict]:
    return _state["audit"]


# ---- alerts ----
def action_for(alert_id: str) -> dict | None:
    return _state["actions"].get(alert_id)


def record_action(alert_id: str, patient_id: str, action: str, clinician: str, reason: str | None) -> dict:
    entry = {"action": action, "reason": reason, "clinician": clinician, "at": now()}
    _state["actions"][alert_id] = entry
    _save()
    log("alert_action", alert_id=alert_id, patient_id=patient_id, action=action, clinician=clinician, reason=reason)
    return entry


# ---- help requests ----
def escalations(status: str | None = None) -> list[dict]:
    return [e for e in _state["escalations"] if not status or e["status"] == status]


def escalation(escalation_id: str) -> dict | None:
    return next((e for e in _state["escalations"] if e["escalation_id"] == escalation_id), None)


def add_escalation(esc: dict) -> dict:
    _state["escalations"].insert(0, esc)
    _save()
    log("escalation_opened", escalation_id=esc["escalation_id"], patient_id=esc["patient_id"],
        trigger=esc["trigger"], consent=esc["consent"])
    return esc


def answer_escalation(esc: dict, text: str, clinician: str) -> dict:
    response = {"text": text, "clinician": clinician, "created_at": now()}
    esc["status"] = "answered"
    esc["response"] = response
    _save()
    add_plan_item(esc["patient_id"], text, clinician)
    log("escalation_answered", escalation_id=esc["escalation_id"], patient_id=esc["patient_id"], clinician=clinician)
    return esc


# ---- what the client told us about themselves ----
def profile(patient_id: str) -> dict | None:
    return _state["profiles"].get(patient_id)


def save_profile(patient_id: str, values: dict) -> dict:
    saved = {**(_state["profiles"].get(patient_id) or {}), **values, "patient_id": patient_id, "updated_at": now()}
    _state["profiles"][patient_id] = saved
    _save()
    log("profile_saved", patient_id=patient_id, shared=saved.get("share_with_care_team", False))
    return saved


# ---- care-team plans ----
def care_plan(patient_id: str) -> list[dict]:
    return _state["care_plans"].get(patient_id, [])


def add_plan_item(patient_id: str, text: str, clinician: str) -> dict:
    item = {"text": text, "author": clinician, "source": "care_team", "created_at": now()}
    _state["care_plans"].setdefault(patient_id, []).append(item)
    _save()
    log("care_plan_item", patient_id=patient_id, clinician=clinician)
    return item
