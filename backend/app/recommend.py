"""What to do about a flag: the care team's own plan first, then standard tips.

Adding another source later (an AI draft a clinician approves, a program protocol)
means adding one function to PROVIDERS — nothing else changes.
"""
from __future__ import annotations

import json
from pathlib import Path

TIPS: dict[str, list[str]] = json.loads((Path(__file__).parent / "tips.json").read_text())

NEXT_STEP = {
    "noise": {
        "act": "Call before the loudest hours. Check they have earplugs or headphones, and go over the grounding exercise.",
        "watch": "Send a check-in message with the grounding exercise and tonight's likely noise.",
    },
    "heat": {
        "act": "Call today. Check the home has working air conditioning or a way to reach a cooling center, and go over hydration.",
        "watch": "Send a check-in message about staying cool and drinking water.",
    },
    "air": {
        "act": "Call today. Advise staying indoors with windows closed and check any prescribed inhaler is on hand.",
        "watch": "Send a check-in message about keeping windows closed while the air is bad.",
    },
}
ACTION = {"act": "phone_outreach", "watch": "check_in_message", "none": "monitor"}


def top_trigger(factors: list[dict]) -> str:
    return next((f["trigger"] for f in factors if f["trigger"] != "patient"), "noise")


def tips_for(factors: list[dict]) -> list[dict]:
    seen = [f["trigger"] for f in factors if f["trigger"] != "patient"]
    return [{"trigger": t, "text": text} for t in dict.fromkeys(seen) for text in TIPS.get(t, [])]


def next_step(level: str, factors: list[dict], care_plan: list[dict]) -> dict:
    """Care-team plan wins whenever the team has written one."""
    if care_plan:
        latest = care_plan[-1]
        return {"action": "follow_care_plan", "text": f"Follow the care team's plan: {latest['text']}", "source": "care_team"}
    if level == "none":
        return {"action": "monitor", "text": "No outreach needed now. Review at the next scheduled visit.", "source": "standard_tips"}
    trigger = top_trigger(factors)
    return {"action": ACTION[level], "text": NEXT_STEP[trigger][level], "source": "standard_tips"}
