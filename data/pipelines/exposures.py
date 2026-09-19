"""Hourly noise / heat / air severity (0–1) for every ZIP → exposures.json.

Method and evidence: data/RESEARCH.md.
- Noise: weighted 311 complaints over the last 2 hours vs that ZIP's usual count for
  the same weekday + hours over the prior 12 months. severity = log2(ratio) / 3 (8× usual = 1).
- Heat: Open-Meteo feels-like temperature, 80.7°F → 0 up to 100°F → 1. Full weight when
  the day's NOAA mean reaches 80.7°F (Yoo 2021 threshold), half weight otherwise.
- Air: hourly PM2.5 at the nearest EPA monitor, mapped onto EPA's bands.
"""
from __future__ import annotations

import json
import math
from collections import defaultdict
from datetime import date, datetime, timedelta

import pandas as pd

from .common import RAW, Scenario, iso, load_zips

NOISE_WEIGHTS = {
    "Illegal Fireworks": 1.0,
    "Noise - Helicopter": 1.0,
    "Noise": 0.7,  # DEP: construction, jackhammers, alarms
    "Noise - Street/Sidewalk": 0.5,
    "Noise - Vehicle": 0.5,
    "Noise - Residential": 0.4,
    "Noise - Park": 0.4,
    "Noise - Commercial": 0.3,
    "Noise - House of Worship": 0.2,
}
TYPE_LABEL = {
    "Illegal Fireworks": "illegal fireworks",
    "Noise - Helicopter": "helicopters",
    "Noise": "construction and alarms",
    "Noise - Street/Sidewalk": "loud street noise",
    "Noise - Vehicle": "vehicle noise",
    "Noise - Residential": "loud neighbors",
    "Noise - Park": "noise in parks",
    "Noise - Commercial": "loud businesses",
    "Noise - House of Worship": "noise from a house of worship",
}
COMPOSITE = {"noise": 0.5, "heat": 0.3, "air": 0.2}
HEAT_THRESHOLD_F = 80.7  # daily mean, Yoo et al. 2021
PM_BANDS = [(0, 0), (9.0, 0), (35.4, 0.4), (55.4, 0.6), (125.4, 0.85), (225.4, 1.0)]
AQI_BREAKS = [(0.0, 9.0, 0, 50), (9.1, 35.4, 51, 100), (35.5, 55.4, 101, 150), (55.5, 125.4, 151, 200),
              (125.5, 225.4, 201, 300), (225.5, 325.4, 301, 500)]


def clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


def pm_severity(pm: float) -> float:
    for (x0, y0), (x1, y1) in zip(PM_BANDS, PM_BANDS[1:]):
        if pm <= x1:
            return y0 + (y1 - y0) * (pm - x0) / (x1 - x0) if x1 > x0 else y0
    return 1.0


def pm_to_aqi(pm: float) -> int:
    pm = math.floor(pm * 10) / 10
    for lo, hi, a0, a1 in AQI_BREAKS:
        if pm <= hi:
            return round(a0 + (a1 - a0) * (pm - lo) / (hi - lo))
    return 500


def km(lat1, lon1, lat2, lon2) -> float:
    p = math.pi / 180
    a = 0.5 - math.cos((lat2 - lat1) * p) / 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2
    return 12742 * math.asin(math.sqrt(a))


def _weekday_count(d0: date, d1: date) -> dict[int, int]:
    n: dict[int, int] = defaultdict(int)
    d = d0
    while d <= d1:
        n[d.isoweekday() % 7] += 1
        d += timedelta(days=1)
    return n


def noise_table(s: Scenario, zips: list[dict]) -> dict[tuple[str, datetime], dict]:
    d = RAW / s.id
    member = {m: z["zip"] for z in zips for m in z["members"]}
    replay = json.loads((d / "311_replay.json").read_text())
    days = _weekday_count(date.fromisoformat(s.baseline_from), date.fromisoformat(s.baseline_to))

    # Weighted + raw counts per (zip, local hour), and per (zip, hour, type).
    cnt_w, cnt_raw = defaultdict(float), defaultdict(int)
    by_type = defaultdict(lambda: defaultdict(int))
    for r in replay:
        z = member.get(r["incident_zip"][:5])
        if not z:
            continue
        h = datetime.fromisoformat(r["d"][:10]).replace(hour=int(r["hh"]), tzinfo=s.start.tzinfo)
        n = int(r["n"])
        cnt_w[(z, h)] += n * NOISE_WEIGHTS.get(r["complaint_type"], 0.3)
        cnt_raw[(z, h)] += n
        by_type[(z, h)][r["complaint_type"]] += n

    base_w, base_raw = defaultdict(float), defaultdict(float)
    for f in sorted((d / "311_baseline").glob("*.json")):
        for r in json.loads(f.read_text()):
            z = member.get(r["incident_zip"][:5])
            if not z:
                continue
            dow, hh, n = int(r["dow"]), int(r["hh"]), int(r["n"])
            base_w[(z, dow, hh)] += n * NOISE_WEIGHTS.get(r["complaint_type"], 0.3) / days[dow]
            base_raw[(z, dow, hh)] += n / days[dow]

    out = {}
    for z in (x["zip"] for x in zips):
        for h in s.hour_list:
            window = [h] if h == s.start else [h - timedelta(hours=1), h]
            w = sum(cnt_w[(z, x)] for x in window)
            b = sum(base_w[(z, x.isoweekday() % 7, x.hour)] for x in window)
            ratio = (w + 1) / (b + 1)
            types = defaultdict(int)
            for x in window:
                for t, n in by_type[(z, x)].items():
                    types[t] += n
            top = max(types, key=types.get) if types else None
            out[(z, h)] = {
                "noise": round(clamp(math.log2(ratio) / 3), 3),
                "noise_complaints": sum(cnt_raw[(z, x)] for x in window),
                "noise_baseline": round(sum(base_raw[(z, x.isoweekday() % 7, x.hour)] for x in window), 2),
                "noise_ratio": round(ratio, 1),
                "noise_top_type": TYPE_LABEL.get(top, top.lower() if top else None) if top else None,
            }
    return out


def heat_table(s: Scenario, zips: list[dict]) -> dict[tuple[str, datetime], dict]:
    d = RAW / s.id
    weather = json.loads((d / "weather.json").read_text())
    noaa = {r["DATE"]: (float(r["TMAX"]) + float(r["TMIN"])) / 2 for r in json.loads((d / "noaa_central_park.json").read_text())}
    feels = {}
    for borough, w in weather.items():
        for t, v in zip(w["hourly"]["time"], w["hourly"]["apparent_temperature"]):
            feels[(borough, datetime.fromisoformat(t).replace(tzinfo=s.start.tzinfo))] = v
    out = {}
    for z in zips:
        for h in s.hour_list:
            f = feels.get((z["borough"], h))
            mean = noaa.get(f"{h:%Y-%m-%d}")
            gate = 1.0 if mean is not None and mean >= HEAT_THRESHOLD_F else 0.5
            sev = clamp((f - HEAT_THRESHOLD_F) / (100 - HEAT_THRESHOLD_F)) * gate if f is not None else 0.0
            out[(z["zip"], h)] = {"heat": round(sev, 3), "heat_index_f": round(f) if f is not None else None,
                                  "daily_mean_f": mean, "heat_full_weight": gate == 1.0}
    return out


def air_table(s: Scenario, zips: list[dict]) -> dict[tuple[str, datetime], dict]:
    df = pd.read_csv(RAW / s.id / "epa_pm25.csv", dtype={"county": str, "site": str})
    df["hour"] = [datetime.fromisoformat(f"{d}T{t}").replace(tzinfo=s.start.tzinfo) for d, t in zip(df["date"], df["time"])]
    monitors = df.groupby(["county", "site"])[["lat", "lon"]].first().reset_index()
    reading = {(r.county, r.site, r.hour): r.pm25 for r in df.itertuples()}
    city = df.groupby("hour")["pm25"].median().to_dict()
    out = {}
    for z in zips:
        ranked = sorted(monitors.itertuples(), key=lambda m: km(z["lat"], z["lon"], m.lat, m.lon))
        for h in s.hour_list:
            pm, dist = None, None
            for m in ranked:  # nearest monitor with a reading this hour
                if (m.county, m.site, h) in reading:
                    pm, dist = reading[(m.county, m.site, h)], km(z["lat"], z["lon"], m.lat, m.lon)
                    break
            if pm is None:
                pm = city.get(h, 0.0)
            pm = max(0.0, float(pm))
            out[(z["zip"], h)] = {"air": round(pm_severity(pm), 3), "pm25": round(pm, 1), "us_aqi": pm_to_aqi(pm),
                                  "monitor_km": round(dist, 1) if dist is not None else None}
    return out


def build_exposures(s: Scenario) -> list[dict]:
    zips = load_zips()
    noise, heat, air = noise_table(s, zips), heat_table(s, zips), air_table(s, zips)
    rows = []
    for z in zips:
        for h in s.hour_list:
            n, t, a = noise[(z["zip"], h)], heat[(z["zip"], h)], air[(z["zip"], h)]
            comp = COMPOSITE["noise"] * n["noise"] + COMPOSITE["heat"] * t["heat"] + COMPOSITE["air"] * a["air"]
            rows.append({
                "zip": z["zip"], "hour": iso(h),
                "noise": n["noise"], "air": a["air"], "heat": t["heat"], "composite": round(comp, 3),
                "raw": {
                    "noise_complaints": n["noise_complaints"], "noise_baseline": n["noise_baseline"],
                    "noise_ratio": n["noise_ratio"], "noise_top_type": n["noise_top_type"],
                    "us_aqi": a["us_aqi"], "pm25": a["pm25"], "monitor_km": a["monitor_km"],
                    "heat_index_f": t["heat_index_f"], "daily_mean_f": t["daily_mean_f"], "heat_full_weight": t["heat_full_weight"],
                },
            })
    return rows
