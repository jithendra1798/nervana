"""Simulated wearable vitals, so a clinician can see the body's side of a flag.

None of this is real. There is no wearable in the hackathon dataset, so we
generate a plausible signal that responds to the same conditions the score uses:
heart rate rises with noise and heat, heart-rate variability falls, and sleep
gets restless on loud nights. Every response says `simulated: true`, and the UI
labels it, so nobody mistakes it for measurement.

In production this comes from a watch or phone the client chooses to connect.
"""
from __future__ import annotations

import hashlib
import math
from datetime import datetime

from .store import get_store

SIMULATED_NOTE = "Simulated wearable data for the demo. Real deployments read a watch or phone the client connects."


def _seed(patient_id: str) -> float:
    """A stable number per client, so the same person always looks the same."""
    return int(hashlib.sha256(patient_id.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF


def _baseline(patient: dict) -> dict:
    s = _seed(patient["id"])
    age = patient.get("age", 45)
    return {
        "heart_rate": round(58 + s * 16 + max(0, (age - 50)) * 0.12),
        "hrv": round(52 - s * 14 - max(0, (age - 40)) * 0.25),
        "restless_minutes": round(8 + s * 10),
    }


def _hour_shape(hour: int) -> float:
    """Normal daily rhythm: lowest around 4am, highest late afternoon."""
    return math.sin((hour - 9) / 24 * 2 * math.pi) * 0.5 + 0.5


def series_for(patient: dict, hours: list[datetime]) -> list[dict]:
    store = get_store()
    base = _baseline(patient)
    s = _seed(patient["id"])
    out = []
    for h in hours:
        e = store.exposure_for(patient["zip"], h) or {"noise": 0.0, "heat": 0.0, "air": 0.0}
        jitter = math.sin((h.hour + 1) * (3 + s * 4)) * 1.6
        awake = _hour_shape(h.hour)
        hr = base["heart_rate"] + 6 * awake + 14 * e["noise"] + 10 * e["heat"] + 4 * e["air"] + jitter
        hrv = base["hrv"] - 14 * e["noise"] - 9 * e["heat"] - 3 * e["air"] + jitter * 0.6
        night = h.hour >= 22 or h.hour <= 6
        restless = base["restless_minutes"] + 34 * e["noise"] + 12 * e["heat"] if night else 0
        out.append({
            "hour": h.isoformat(),
            "heart_rate": round(hr),
            "hrv": round(max(12, hrv)),
            "restless_minutes": round(restless) if night else None,
            "noise": e["noise"],
            "heat": e["heat"],
            "air": e["air"],
        })
    return out


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 3:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = math.sqrt(sum((x - mx) ** 2 for x in xs))
    dy = math.sqrt(sum((y - my) ** 2 for y in ys))
    return round(num / (dx * dy), 2) if dx and dy else None


def summary(patient: dict, hour: datetime) -> dict:
    """The series, where it sits now, and how it tracks each trigger today."""
    store = get_store()
    rows = series_for(patient, store.hours)
    base = _baseline(patient)
    now = next((r for r in rows if r["hour"] == hour.isoformat()), rows[-1] if rows else None)
    hrs = [r["heart_rate"] for r in rows]
    correlations = {t: _pearson([r[t] for r in rows], hrs) for t in ("noise", "heat", "air")}
    strongest = max((c for c in correlations.items() if c[1] is not None), key=lambda c: abs(c[1]), default=(None, None))
    nights = [r["restless_minutes"] for r in rows if r["restless_minutes"] is not None]
    return {
        "patient_id": patient["id"],
        "simulated": True,
        "note": SIMULATED_NOTE,
        "as_of": hour.isoformat(),
        "baseline": base,
        "now": now,
        "above_baseline": round((now["heart_rate"] - base["heart_rate"]) if now else 0),
        "series": rows,
        "correlations": correlations,
        "headline": (
            f"Heart rate tracks {strongest[0]} today (r = {strongest[1]})."
            if strongest[0] and abs(strongest[1] or 0) >= 0.4 else
            "No clear link between the wearable and conditions today."
        ),
        "restless_tonight": max(nights) if nights else None,
    }
