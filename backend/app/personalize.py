"""Turn what a client told us about themselves into advice meant for them.

The intake form (see `PROFILE_OPTIONS`) is short on purpose: what sets you off,
what helps, what your home is like, who you call. Everything here is a direct
read of those answers — nothing is inferred about a person from their diagnosis.

Order of what a client sees: their care team's plan, then advice built from their
own answers, then the standard tips.
"""
from __future__ import annotations

from .recommend import top_trigger

PROFILE_OPTIONS = {
    "triggers": ["Fireworks", "Helicopters", "Sirens", "Shouting", "Crowds", "Construction", "Smoke or smells", "Heat"],
    "helps": ["Noise-cancelling headphones", "Earplugs", "Grounding breathing", "Calling someone", "Music or TV",
              "A walk", "Cold water", "A quiet room", "My dog"],
}

# Which of the client's answers speak to which trigger.
TRIGGER_MATCH = {
    "noise": {"Fireworks", "Helicopters", "Sirens", "Shouting", "Crowds", "Construction"},
    "air": {"Smoke or smells"},
    "heat": {"Heat"},
}
HELP_TEXT = {
    "Noise-cancelling headphones": "Put your noise-cancelling headphones on before it gets loud — you told us they help.",
    "Earplugs": "Have your earplugs within reach tonight — you told us they help.",
    "Grounding breathing": "Use your grounding breathing: in for 1 and out for 1, then 2 and 2, up to 5 or 6.",
    "Calling someone": "Call someone you trust and stay on the line for a while — you told us that helps.",
    "Music or TV": "Put music or the TV on to cover the noise outside.",
    "A walk": "A short walk helps you, but keep it away from the loudest streets tonight.",
    "Cold water": "Cold water on your wrists and face is on your list of things that help.",
    "A quiet room": "Move to your quiet room and keep the windows shut.",
    "My dog": "Keep your dog close tonight — you told us that helps.",
}
HELP_TRIGGERS = {
    "A walk": {"noise", "air"},          # not in the heat
    "Cold water": {"heat", "noise"},
}


def personal_tips(profile: dict | None, factors: list[dict]) -> list[dict]:
    """Advice drawn from the client's own answers, most relevant first."""
    if not profile:
        return []
    trigger = top_trigger(factors)
    out: list[dict] = []

    named = [t for t in profile.get("triggers", []) if t in TRIGGER_MATCH.get(trigger, set())]
    others = [t for t in profile.get("triggers", []) if t not in TRIGGER_MATCH.get(trigger, set())]
    if named:
        out.append({"trigger": trigger, "source": "your_profile",
                    "text": f"{named[0]} is one of the things you told us sets you off, and that's what's around you right now."})
    elif others:
        kind = {"noise": "loud", "heat": "hot", "air": "smoky"}[trigger]
        out.append({"trigger": trigger, "source": "your_profile",
                    "text": f"It's {kind} around you right now. That's not one of the triggers you named, but here's what you told us helps."})

    for help_item in profile.get("helps", [])[:4]:
        if help_item not in HELP_TEXT:
            continue
        allowed = HELP_TRIGGERS.get(help_item)
        if allowed and trigger not in allowed:
            continue
        out.append({"trigger": trigger, "source": "your_profile", "text": HELP_TEXT[help_item]})

    home = profile.get("home") or {}
    if trigger == "heat" and home.get("air_conditioning") is False:
        out.append({"trigger": "heat", "source": "your_profile",
                    "text": "You told us there's no air conditioning at home, so a cooling center is the safer place this afternoon."})
    if trigger in ("noise", "air") and home.get("quiet_room") is True:
        out.append({"trigger": trigger, "source": "your_profile", "text": "Your quiet room away from the street is the best place to be right now."})

    support = (profile.get("support_person") or "").strip()
    if support:
        out.append({"trigger": trigger, "source": "your_profile", "text": f"Let {support} know how tonight is going."})

    for place in profile.get("safe_places", [])[:2]:
        out.append({"trigger": trigger, "source": "your_profile", "text": f"If home gets to be too much, {place} is on your list of calmer places."})

    return out[:7]


def merge(personal: list[dict], standard: list[dict]) -> list[dict]:
    """Their own advice first; standard tips only for triggers it doesn't already cover."""
    if not personal:
        return standard
    covered = {t["trigger"] for t in personal}
    return personal + [t for t in standard if t["trigger"] not in covered]


def next_step_suffix(profile: dict | None) -> str:
    """Added to the care team's next step, so outreach starts from what works."""
    if not profile or not profile.get("share_with_care_team"):
        return ""
    bits = []
    if profile.get("helps"):
        bits.append(", ".join(h.lower() for h in profile["helps"][:2]))
    if profile.get("support_person"):
        bits.append(f"reaching {profile['support_person']}")
    if (profile.get("home") or {}).get("air_conditioning") is False:
        return " They have no air conditioning at home, so offer a cooling center."
    return f" They tell us {' and '.join(bits)} help — check both are possible." if bits else ""


def clinician_note(profile: dict | None, factors: list[dict]) -> str | None:
    """One line for the care team: what this person says works, in their words."""
    if not profile or not profile.get("share_with_care_team"):
        return None
    bits = []
    trigger = top_trigger(factors)
    named = [t for t in profile.get("triggers", []) if t in TRIGGER_MATCH.get(trigger, set())]
    if named:
        bits.append(f"they name {', '.join(n.lower() for n in named)} as triggers")
    if profile.get("helps"):
        bits.append(f"what helps: {', '.join(h.lower() for h in profile['helps'][:3])}")
    if (profile.get("home") or {}).get("air_conditioning") is False:
        bits.append("no air conditioning at home")
    if profile.get("support_person"):
        bits.append(f"support person: {profile['support_person']}")
    if not bits:
        return None
    return "They told us: " + "; ".join(bits) + "."
