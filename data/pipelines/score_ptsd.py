"""PTSD risk score per client per hour → risk.json.

score = Σ_trigger  weight × severity × (1 + general vulnerability + trigger vulnerability)

Environment sets the level; a person's history only amplifies it. Someone with a
heavy history is therefore not flagged on a quiet night, which is what keeps the
inbox short. Every term is reported as its own factor, so the score adds up in public.

Weights and thresholds are assumptions, not fitted values — see data/RESEARCH.md.
"""
from __future__ import annotations

import json
from datetime import datetime

from .common import RAW, Scenario, iso

TRIGGER_WEIGHT = {"noise": 0.55, "heat": 0.30, "air": 0.25}

# Multipliers on top of the environment load.
GENERAL_VULNERABILITY = [
    ("recent_crisis_visit", 0.35, "Crisis visit in the last 30 days"),
    ("act", 0.20, "ACT client, so acuity is already high"),
    ("substance_use", 0.10, "Substance use disorder on record"),
]
TRIGGER_VULNERABILITY = {
    "noise": [("veteran", 0.25, "Veteran: fireworks and gunfire-like sounds are common triggers")],
    "heat": [("supported_housing", 0.30, "Supported housing: the home may lack air conditioning"),
             ("age65", 0.20, "Age 65 or older"),
             ("hvi_high", 0.20, "Lives in a high heat-vulnerability ZIP (HVI {hvi} of 5)")],
    "air": [("age65", 0.15, "Age 65 or older")],
}
ACT_LEVEL, WATCH_LEVEL = 0.85, 0.60
MIN_SEVERITY_FOR_ACT = 0.4  # something in the environment must genuinely be unusual


def zip_hvi() -> dict[str, int]:
    rows = json.loads((RAW / "hvi.json").read_text())
    return {r["zcta20"]: int(r["hvi"]) for r in rows}


def _vulnerabilities(p: dict, hvi: int) -> tuple[list[tuple[str, float, str]], dict[str, list[tuple[str, float, str]]]]:
    flags = p["flags"]
    has = {
        "recent_crisis_visit": flags["recent_crisis_visit"],
        "act": p["program"] == "ACT",
        "substance_use": flags["substance_use"],
        "veteran": p["veteran"] is True,
        "supported_housing": flags["supported_housing"],
        "age65": p["age"] >= 65,
        "hvi_high": hvi >= 4,
    }
    general = [(k, w, t) for k, w, t in GENERAL_VULNERABILITY if has[k]]
    per_trigger = {tr: [(k, w, t.format(hvi=hvi)) for k, w, t in items if has[k]] for tr, items in TRIGGER_VULNERABILITY.items()}
    return general, per_trigger


def _environment_label(trigger: str, raw: dict, zip_code: str) -> str:
    if trigger == "noise":
        kind = raw.get("noise_top_type") or "noise"
        return (f"{raw['noise_complaints']} noise complaints in ZIP {zip_code} in the last 2 hours "
                f"({raw['noise_ratio']}× a usual night), mostly {kind}")
    if trigger == "air":
        return f"Fine particles at {raw['pm25']} µg/m³ (air quality index {raw['us_aqi']})"
    return f"Feels like {raw['heat_index_f']}°F" + ("" if raw.get("heat_full_weight") else ", on a day that stays below the heat threshold")


def _caveats(p: dict, factors: list[dict], raw: dict, scenario_day: str) -> tuple[str, list[str]]:
    used = {f["trigger"] for f in factors}
    caveats = [f"Exposure is estimated for all of ZIP {p['zip']}, not this person's block"]
    if "noise" in used:
        caveats.append(f"Noise comes from {raw['noise_complaints']} 311 complaints, which lag and depend on who reports")
    if "air" in used and raw.get("monitor_km") is not None:
        caveats.append(f"Air quality is from the nearest EPA monitor, {raw['monitor_km']} km away")
    if "heat" in used:
        caveats.append("Feels-like temperature comes from a weather model, one point per borough")
    stale_days = (datetime.fromisoformat(scenario_day) - datetime.fromisoformat(p["contact_last_updated"])).days
    if stale_days > 365:
        caveats.append(f"Contact details last updated {p['contact_last_updated']}, over a year ago")
    caveats.append("No pharmacy data: medication effects, such as SSRIs in heat, are not assessed")

    score = 2
    if stale_days > 365:
        score -= 1
    main = next((f for f in factors if f["trigger"] != "patient"), None)
    if main and main["trigger"] == "noise" and raw["noise_complaints"] < 5:
        score -= 1
    elif main and main["trigger"] == "noise" and raw["noise_complaints"] >= 15 and stale_days <= 365:
        score += 1
    return ["low", "low", "medium", "high"][max(1, min(3, score))], caveats


def assess(p: dict, exposure: dict, hvi: int, scenario_day: str) -> dict | None:
    """One client at one hour. Returns None when nothing is worth showing."""
    general, per_trigger = _vulnerabilities(p, hvi)
    g_sum = sum(w for _, w, _ in general)
    raw = exposure["raw"]

    factors: list[dict] = []
    score = 0.0
    env_peak = 0.0
    for trigger, weight in TRIGGER_WEIGHT.items():
        severity = exposure[trigger]
        if severity <= 0.02:
            continue
        env_peak = max(env_peak, severity)
        base = weight * severity
        t_sum = sum(w for _, w, _ in per_trigger.get(trigger, []))
        score += base * (1 + g_sum + t_sum)
        factors.append({"trigger": trigger, "label": _environment_label(trigger, raw, p["zip"]),
                        "contribution": round(base, 3), "source": {"noise": "NYC 311", "air": "EPA monitors", "heat": "Open-Meteo + NOAA"}[trigger]})
        for _, w, text in per_trigger.get(trigger, []):
            factors.append({"trigger": "patient", "label": text, "contribution": round(base * w, 3), "source": "Client record"})

    env_total = sum(TRIGGER_WEIGHT[t] * exposure[t] for t in TRIGGER_WEIGHT)
    for _, w, text in general:
        factors.append({"trigger": "patient", "label": text, "contribution": round(env_total * w, 3), "source": "Client record"})

    score = round(min(1.0, score), 2)
    level = "act" if score >= ACT_LEVEL and env_peak >= MIN_SEVERITY_FOR_ACT else "watch" if score >= WATCH_LEVEL else "none"
    if level == "none":
        return None

    factors = [f for f in factors if f["contribution"] >= 0.01]
    factors.sort(key=lambda f: -f["contribution"])
    factors = factors[:3]
    confidence, caveats = _caveats(p, factors, raw, scenario_day)
    return {"patient_id": p["id"], "as_of": exposure["hour"], "level": level, "score": score,
            "factors": factors, "uncertainty": {"confidence": confidence, "caveats": caveats}}


def build_risk(s: Scenario, people: list[dict], exposures: list[dict]) -> dict[str, list[dict]]:
    hvi_by_zip = zip_hvi()
    by_key = {(e["zip"], e["hour"]): e for e in exposures}
    scenario_day = f"{s.start:%Y-%m-%d}"
    out: dict[str, list[dict]] = {}
    for h in s.hour_list:
        rows = []
        for p in people:
            e = by_key.get((p["zip"], iso(h)))
            if not e:
                continue
            r = assess(p, e, hvi_by_zip.get(p["zip"], 3), scenario_day)
            if r:
                rows.append(r)
        rows.sort(key=lambda r: -r["score"])
        out[iso(h)] = rows
    return out
