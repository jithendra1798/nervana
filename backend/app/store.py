"""Loads what the data pipeline wrote and answers questions about it.

Reads data/out/<scenario>/. If that folder is missing it falls back to the shared
example files in contracts/fixtures/data, so the API always starts.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
HOUR = timedelta(hours=1)


def _hour_key(iso: str) -> datetime:
    return datetime.fromisoformat(iso).replace(minute=0, second=0, microsecond=0)


class Store:
    def __init__(self, directory: Path, fallback: bool):
        self.dir = directory
        self.is_fallback = fallback
        self.scenario: dict = json.loads((directory / "scenario.json").read_text())
        self.patients: list[dict] = json.loads((directory / "patients.json").read_text())
        exposures: list[dict] = json.loads((directory / "exposures.json").read_text())
        risk: dict[str, list[dict]] = json.loads((directory / "risk.json").read_text())

        self.by_id = {p["id"]: p for p in self.patients}
        self.exposure = {(e["zip"], _hour_key(e["hour"])): e for e in exposures}
        self.by_zip: dict[str, list[dict]] = {}
        for e in exposures:
            self.by_zip.setdefault(e["zip"], []).append(e)
        for rows in self.by_zip.values():
            rows.sort(key=lambda e: e["hour"])
        self.risk = {_hour_key(h): rows for h, rows in risk.items()}
        self.hours = sorted({h for _, h in self.exposure} | set(self.risk))
        self.default_as_of = _hour_key(self.scenario["default_as_of"])

    # ---- time ----
    def resolve(self, as_of: str | None) -> datetime:
        """Round a requested time down to an hour inside the scenario window."""
        if not as_of:
            return self.default_as_of
        try:
            want = _hour_key(as_of)
        except ValueError:
            return self.default_as_of
        if want in self.hours:
            return want
        if not self.hours:
            return self.default_as_of
        return min(self.hours, key=lambda h: abs(h - want))

    # ---- lookups ----
    def patient(self, patient_id: str) -> dict | None:
        return self.by_id.get(patient_id)

    def exposures_at(self, hour: datetime) -> list[dict]:
        return [e for (_, h), e in self.exposure.items() if h == hour]

    def exposure_for(self, zip_code: str, hour: datetime) -> dict | None:
        return self.exposure.get((zip_code, hour))

    def risk_at(self, hour: datetime) -> list[dict]:
        return self.risk.get(hour, [])

    def risk_for(self, patient_id: str, hour: datetime) -> dict | None:
        return next((r for r in self.risk_at(hour) if r["patient_id"] == patient_id), None)

    def timeline(self, zip_code: str, hour: datetime, back: int = 24) -> list[dict]:
        rows = [e for e in self.by_zip.get(zip_code, []) if _hour_key(e["hour"]) <= hour]
        return [{k: e[k] for k in ("hour", "noise", "air", "heat", "composite")} for e in rows[-back:]]

    def episode_start(self, patient_id: str, hour: datetime) -> datetime:
        """First hour of the unbroken run of flagged hours ending at `hour`.

        One alert per episode, not one per hour: that is what keeps a fireworks
        night from generating 6 alerts for the same person.
        """
        start = hour
        while True:
            prev = start - HOUR
            if prev in self.risk and any(r["patient_id"] == patient_id for r in self.risk[prev]):
                start = prev
            else:
                return start


@lru_cache(maxsize=1)
def get_store() -> Store:
    base = Path(os.environ.get("NERVANA_DATA_DIR", REPO / "data" / "out"))
    scenario = os.environ.get("NERVANA_SCENARIO", "july4-2023")
    directory = base / scenario
    if (directory / "scenario.json").exists():
        return Store(directory, fallback=False)
    return Store(REPO / "contracts" / "fixtures" / "data", fallback=True)
