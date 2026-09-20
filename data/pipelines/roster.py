"""Client roster → patients.json.

The DOHMH synthetic dataset is the real input. Until it arrives, this generates a
stand-in roster with the same fields so the rest of the pipeline can run. Nothing
here is a real person: names are initials and every field is drawn at random.

Clients are spread across ZIPs with weight from the Heat Vulnerability Index,
which tracks the lower-income neighborhoods DMH-contracted programs mostly serve.
"""
from __future__ import annotations

import json
import random
from datetime import date, timedelta

from .common import RAW, Scenario, load_zips

PROGRAMS = [("Outpatient clinic", 0.45), ("ACT", 0.2), ("Supported housing", 0.2), ("Community treatment", 0.15)]
PTSD = [("F43.10 PTSD", 0.65), ("F43.12 PTSD, chronic", 0.35)]
COMORBID = [("F10.20 Alcohol use disorder", 0.22), ("F11.20 Opioid use disorder", 0.12),
            ("F33.1 Major depressive disorder", 0.3), ("F41.1 Generalized anxiety disorder", 0.22),
            ("F31.9 Bipolar disorder", 0.1)]
SUD_CODES = ("F10.20", "F11.20")
LETTERS = "ABCDEFGHJKLMNPRSTVW"

# The three clients the walkthrough follows. Each carries a different story:
# a veteran under the fireworks, an older client with no air conditioning, and a
# younger client whose team is already on it.
DEMO = [
    {
        "id": "SYN-0142", "name": "R.M.", "age": 34, "zip": "11101", "program": "ACT",
        "diagnoses": ["F43.10 PTSD", "F10.20 Alcohol use disorder"], "veteran": True,
        "care_team": "LIC ACT Team 2", "contact_last_updated": "2022-06-14",
        "flags": {"recent_crisis_visit": True, "substance_use": True, "supported_housing": False},
    },
    {
        "id": "SYN-0143", "name": "D.K.", "age": 67, "zip": "10457", "program": "Supported housing",
        "diagnoses": ["F43.12 PTSD, chronic", "F33.1 Major depressive disorder"], "veteran": False,
        "care_team": "Bronx Supported Housing 2", "contact_last_updated": "2023-05-02",
        "flags": {"recent_crisis_visit": False, "substance_use": False, "supported_housing": True},
    },
    {
        "id": "SYN-0144", "name": "J.P.", "age": 29, "zip": "11104", "program": "Outpatient clinic",
        "diagnoses": ["F43.10 PTSD", "F41.1 Generalized anxiety disorder"], "veteran": True,
        "care_team": "Sunnyside Clinic 3", "contact_last_updated": "2023-06-20",
        "flags": {"recent_crisis_visit": False, "substance_use": False, "supported_housing": False},
    },
]


def pick(rng: random.Random, options: list[tuple[str, float]]) -> str:
    return rng.choices([o for o, _ in options], [w for _, w in options])[0]


def team_name(rng: random.Random, borough: str, program: str) -> str:
    if program == "ACT":
        return f"{borough} ACT Team {rng.randint(1, 4)}"
    if program == "Supported housing":
        return f"{borough} Supported Housing {rng.randint(1, 3)}"
    if program == "Community treatment":
        return f"{borough} Community Treatment"
    return f"{borough} Clinic {rng.randint(1, 5)}"


def build_roster(s: Scenario, n: int = 150, seed: int = 20260919) -> list[dict]:
    rng = random.Random(seed)
    zips = load_zips()
    hvi = {r["zcta20"]: int(r["hvi"]) for r in json.loads((RAW / "hvi.json").read_text())}
    weights = [max(1, max((hvi.get(m, 1) for m in z["members"]), default=1)) for z in zips]
    scenario_day = s.start.date()

    people = [dict(d) for d in DEMO]
    for i in range(n - len(DEMO)):
        z = rng.choices(zips, weights)[0]
        program = pick(rng, PROGRAMS)
        dx = [pick(rng, PTSD)]
        for code, p in COMORBID:
            if rng.random() < p:
                dx.append(code)
        age = min(84, max(19, int(rng.gauss(46, 14))))
        veteran = rng.choices([True, False, None], [0.12, 0.6, 0.28])[0]
        stale_days = rng.choices([rng.randint(0, 200), rng.randint(200, 420), rng.randint(420, 1100)], [0.5, 0.3, 0.2])[0]
        people.append({
            "id": f"SYN-{1000 + i}",
            "name": f"{rng.choice(LETTERS)}.{rng.choice(LETTERS)}.",
            "age": age,
            "zip": z["zip"],
            "program": program,
            "diagnoses": dx,
            "veteran": veteran,
            "care_team": team_name(rng, z["borough"], program),
            "contact_last_updated": str(scenario_day - timedelta(days=stale_days)),
            "flags": {
                "recent_crisis_visit": rng.random() < 0.1,
                "substance_use": any(c.startswith(SUD_CODES) for c in dx),
                "supported_housing": program == "Supported housing",
            },
            "_borough": z["borough"],
        })
    return [{k: v for k, v in p.items() if not k.startswith("_")} for p in people]


def roster_note(people: list[dict]) -> str:
    vets = sum(1 for p in people if p["veteran"])
    return (f"{len(people)} synthetic clients with PTSD · {vets} veterans · "
            f"{sum(1 for p in people if p['flags']['recent_crisis_visit'])} with a crisis visit in the last 30 days")


if __name__ == "__main__":
    from .common import SCENARIOS
    ppl = build_roster(SCENARIOS["july4-2023"])
    print(roster_note(ppl))
    print(json.dumps(ppl[:2], indent=1))
