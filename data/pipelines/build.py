"""Build every file the backend reads: out/<scenario>/{scenario,patients,exposures,risk}.json

Run: python -m pipelines.build --scenario july4-2023
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from .common import OUT, SCENARIOS, Scenario, iso, write_json
from .exposures import COMPOSITE, build_exposures
from .roster import build_roster, roster_note
from .score_ptsd import ACT_LEVEL, WATCH_LEVEL, build_risk

SOURCES = [
    {"name": "NYC 311 service requests (noise and fireworks)", "url": "https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-Present/erm2-nwe9"},
    {"name": "EPA AQS hourly PM2.5, NYC monitors", "url": "https://aqs.epa.gov/aqsweb/airdata/download_files.html"},
    {"name": "Open-Meteo historical weather", "url": "https://open-meteo.com/en/docs/historical-weather-api"},
    {"name": "NOAA daily summaries, Central Park", "url": "https://www.ncei.noaa.gov/access/search/datasets/daily-summaries/"},
    {"name": "NYC Heat Vulnerability Index", "url": "https://data.cityofnewyork.us/Health/Heat-Vulnerability-Index-Rankings/4mhf-duep"},
    {"name": "Client roster: synthetic stand-in for the DOHMH dataset", "url": "https://github.com/jithendra1798/nervana/blob/main/data/pipelines/roster.py"},
]


def scenario_json(s: Scenario, people: list[dict]) -> dict:
    return {
        "id": s.id,
        "label": s.label,
        "window_start": iso(s.hour_list[0]),
        "window_end": iso(s.hour_list[-1]),
        "default_as_of": iso(s.default_hour),
        "step": "PT1H",
        "geo_level": "MODZCTA",
        "is_fixture": False,
        "roster_note": roster_note(people),
        "weights": {**COMPOSITE, "act_at": ACT_LEVEL, "watch_at": WATCH_LEVEL},
        "sources": SOURCES,
    }


def build(s: Scenario, out_dir: Path | None = None) -> dict:
    out = out_dir or OUT / s.id
    people = build_roster(s)
    exposures = build_exposures(s)
    risk = build_risk(s, people, exposures)

    write_json(out / "scenario.json", scenario_json(s, people))
    write_json(out / "patients.json", people)
    (out / "exposures.json").write_text(json.dumps(exposures, separators=(",", ":")) + "\n")
    write_json(out / "risk.json", risk)

    counts = {h[11:16]: (sum(1 for r in rows if r["level"] == "act"), len(rows)) for h, rows in risk.items()}
    print(f"{s.id}: {len(people)} clients, {len(exposures)} exposure rows → {out}")
    print(f"  {roster_note(people)}")
    print("  flagged per hour (act / act+watch):")
    print("   " + "  ".join(f"{h} {a}/{t}" for h, (a, t) in counts.items()))
    return {"people": people, "exposures": exposures, "risk": risk}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenario", default="july4-2023", choices=SCENARIOS)
    build(SCENARIOS[ap.parse_args().scenario])
