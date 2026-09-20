"""A walking route that avoids the ZIPs where conditions are worst right now.

There is no street-level noise data in New York, so this cannot promise a quiet
street. What it can do is keep you out of the ZIPs that are unusually loud this
hour, which on a fireworks night is most of the difference.

How: ask OSRM for the direct walk, then ask again through a handful of detour
points in calmer ZIPs. Score every candidate by the conditions along it, and
recommend the calmest one that isn't much longer.
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path

import requests
from fastapi import APIRouter, HTTPException, Query

from .store import REPO, get_store

router = APIRouter(tags=["routing"])

OSRM = "https://router.project-osrm.org/route/v1/foot"
UA = {"User-Agent": "nervana-hackathon/0.1 (Health in Climate AI hackathon; contact via github.com/jithendra1798/nervana)"}
SAMPLE_M = 150           # how often to sample a route when scoring it
MAX_DETOUR_RATIO = 1.8   # never suggest a walk far longer than the direct one
CANDIDATES = 6
WALK_MPS = 1.35          # the public router answers with driving times, so we time the walk ourselves


@lru_cache(maxsize=1)
def _zip_shapes() -> list[tuple[str, tuple[float, float, float, float], list[list[list[float]]]]]:
    """(zip, bbox, rings) for every MODZCTA, ready for point-in-polygon."""
    path = REPO / "data" / "geo" / "modzcta.geojson"
    if not path.exists():
        path = REPO / "frontend" / "public" / "modzcta.geojson"
    out = []
    for f in json.loads(path.read_text())["features"]:
        code = f["properties"]["MODZCTA"]
        geom = f["geometry"]
        polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
        rings = [p[0] for p in polys]
        xs = [c[0] for r in rings for c in r]
        ys = [c[1] for r in rings for c in r]
        out.append((code, (min(xs), min(ys), max(xs), max(ys)), rings))
    return out


def zip_at(lon: float, lat: float) -> str | None:
    for code, (x0, y0, x1, y1), rings in _zip_shapes():
        if not (x0 <= lon <= x1 and y0 <= lat <= y1):
            continue
        if any(_in_ring(lon, lat, r) for r in rings):
            return code
    return None


def _in_ring(x: float, y: float, ring: list[list[float]]) -> bool:
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def _metres(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p = math.pi / 180
    a = 0.5 - math.cos((lat2 - lat1) * p) / 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2
    return 12742000 * math.asin(math.sqrt(a))


def _osrm(points: list[tuple[float, float]]) -> dict | None:
    """points are (lon, lat). Returns the first route, or None."""
    coords = ";".join(f"{lon:.5f},{lat:.5f}" for lon, lat in points)
    try:
        r = requests.get(f"{OSRM}/{coords}", params={"overview": "full", "geometries": "geojson"}, headers=UA, timeout=12)
        r.raise_for_status()
        data = r.json()
    except (requests.RequestException, ValueError):
        return None
    return data["routes"][0] if data.get("code") == "Ok" and data.get("routes") else None


def _samples(route: dict) -> list[str]:
    """The ZIPs a route passes through, one entry per ~150 m walked."""
    coords = route["geometry"]["coordinates"]
    out: list[str] = []
    travelled = 0.0
    last = coords[0]
    for lon, lat in coords:
        travelled += _metres(last[1], last[0], lat, lon)
        last = [lon, lat]
        if travelled < SAMPLE_M and out:
            continue
        travelled = 0.0
        code = zip_at(lon, lat)
        if code:
            out.append(code)
    return out


def _exposure(samples: list[str], hour: datetime, trigger: str) -> dict:
    """What someone walks through on this path at this hour."""
    s = get_store()
    values: list[tuple[str, float]] = []
    for code in samples:
        e = s.exposure_for(code, hour)
        if e:
            values.append((code, e["composite"] if trigger == "composite" else e[trigger]))
    if not values:
        return {"mean": 0.0, "worst": 0.0, "worst_zip": None, "zips": []}
    worst = max(values, key=lambda x: x[1])
    return {
        "mean": round(sum(v for _, v in values) / len(values), 3),
        "worst": round(worst[1], 3),
        "worst_zip": worst[0],
        "zips": list(dict.fromkeys(code for code, _ in values)),
    }


def _score(route: dict, hour: datetime, trigger: str) -> dict:
    return _exposure(_samples(route), hour, trigger)


def _shape(route: dict, hour: datetime, trigger: str, kind: str) -> dict:
    return {
        "kind": kind,
        "distance_m": round(route["distance"]),
        "duration_s": round(route["distance"] / WALK_MPS),
        "geometry": [[lat, lon] for lon, lat in route["geometry"]["coordinates"]],
        "exposure": _score(route, hour, trigger),
    }


NOMINATIM = "https://nominatim.openstreetmap.org/search"
NYC_VIEWBOX = "-74.26,40.92,-73.68,40.48"
_geo_cache: dict[str, list[dict]] = {}


@router.get("/v1/geocode")
def geocode(q: str = Query(min_length=3, max_length=120), limit: int = 5) -> dict:
    """Addresses and places in New York City, for the search bars."""
    key = q.strip().lower()
    if key in _geo_cache:
        return {"query": q, "results": _geo_cache[key]}
    try:
        r = requests.get(NOMINATIM, headers=UA, timeout=12, params={
            "q": q, "format": "json", "limit": limit, "viewbox": NYC_VIEWBOX, "bounded": 1, "countrycodes": "us",
        })
        r.raise_for_status()
        rows = r.json()
    except (requests.RequestException, ValueError):
        raise HTTPException(502, "The address lookup did not answer. Try again in a moment.")
    results = [{
        "label": row["display_name"].split(", New York")[0][:90],
        "lat": float(row["lat"]),
        "lon": float(row["lon"]),
        "zip": zip_at(float(row["lon"]), float(row["lat"])),
    } for row in rows]
    _geo_cache[key] = results
    return {"query": q, "results": results}


@router.get("/v1/route")
def calmer_route(
    from_: str = Query(alias="from", description="lat,lon"),
    to: str = Query(description="lat,lon"),
    as_of: str | None = None,
    trigger: str = "noise",
) -> dict:
    """The direct walk, and the calmest detour we can find for this hour."""
    s = get_store()
    hour = s.resolve(as_of)
    try:
        lat1, lon1 = (float(x) for x in from_.split(","))
        lat2, lon2 = (float(x) for x in to.split(","))
    except ValueError:
        raise HTTPException(400, "from and to must be 'lat,lon'")

    direct_raw = _osrm([(lon1, lat1), (lon2, lat2)])
    if not direct_raw:
        raise HTTPException(502, "The routing service did not answer. Try again in a moment.")
    direct = _shape(direct_raw, hour, trigger, "direct")

    # Detour candidates: calm ZIPs that sit beside the worst patch of the direct
    # walk, so the detour goes around that patch rather than anywhere quiet.
    mid_lat, mid_lon = (lat1 + lat2) / 2, (lon1 + lon2) / 2
    span = max(_metres(lat1, lon1, lat2, lon2), 400)
    avoid = _zip_centre(direct["exposure"]["worst_zip"]) if direct["exposure"]["worst_zip"] else None
    level = lambda e: e["composite"] if trigger == "composite" else e[trigger]
    nearby = []
    for e in s.exposures_at(hour):
        centre = _zip_centre(e["zip"])
        if not centre or level(e) >= direct["exposure"]["worst"] * 0.6:
            continue
        off = _metres(mid_lat, mid_lon, centre[0], centre[1])
        beside = _metres(avoid[0], avoid[1], centre[0], centre[1]) if avoid else off
        if off <= span * 0.9 and beside <= span:
            nearby.append((level(e) + beside / 40000, e["zip"], centre))
    nearby.sort(key=lambda x: x[0])

    alternatives = []
    for _, code, (clat, clon) in nearby[:CANDIDATES]:
        raw = _osrm([(lon1, lat1), (clon, clat), (lon2, lat2)])
        if not raw or raw["distance"] > direct_raw["distance"] * MAX_DETOUR_RATIO:
            continue
        alternatives.append({**_shape(raw, hour, trigger, "calmer"), "via_zip": code})

    # What matters is both what you walk through on average and the worst patch of it.
    cost = lambda r: (0.6 * r["exposure"]["mean"] + 0.4 * r["exposure"]["worst"], r["distance_m"])
    best = min([direct, *alternatives], key=cost)
    saving = round(cost(direct)[0] - cost(best)[0], 3)
    extra_min = round((best["duration_s"] - direct["duration_s"]) / 60)
    # Only send someone the long way when the calm is worth the walk.
    allowance = max(10, round(direct["duration_s"] / 60 * 0.35))
    if best is not direct and (saving < 0.08 or extra_min > allowance):
        best, saving, extra_min = direct, 0.0, 0
    # The strongest advice our data supports is usually *when* to go, not which way.
    samples = _samples(direct_raw)
    by_hour = [{"hour": h.isoformat(), **{k: v for k, v in _exposure(samples, h, trigger).items() if k in ("mean", "worst")}}
               for h in s.hours]
    now_mean = next((b["mean"] for b in by_hour if b["hour"] == hour.isoformat()), 0.0)
    # Only advice someone can act on: the next few hours, not "come back at 4am".
    later = [b for b in by_hour if hour.isoformat() < b["hour"] <= (hour + timedelta(hours=4)).isoformat()]
    calmest = min(later, key=lambda b: b["mean"]) if later else None
    wait_hours = round((datetime.fromisoformat(calmest["hour"]) - hour).total_seconds() / 3600) if calmest else 0
    rising = bool(later and later[0]["mean"] > now_mean)

    return {
        "as_of": hour.isoformat(),
        "trigger": trigger,
        "by_hour": by_hour,
        "timing": {
            "now_mean": now_mean,
            "best_hour": calmest["hour"] if calmest else None,
            "best_mean": calmest["mean"] if calmest else None,
            "wait_hours": wait_hours,
            "worth_waiting": bool(calmest and now_mean - calmest["mean"] >= 0.15),
            "rising": rising,
            "advice": (
                f"Quieter if you wait {wait_hours} hour{'s' if wait_hours != 1 else ''}."
                if calmest and now_mean - calmest["mean"] >= 0.15
                else "It gets louder from here tonight, so better to go now than later." if rising
                else "This is about as calm as the next few hours get."
            ),
        },
        "direct": direct,
        "recommended": best,
        "is_detour": best is not direct,
        "extra_minutes": extra_min,
        "exposure_drop": saving,
        "note": (
            f"Going around {direct['exposure']['worst_zip']} cuts what you walk through by {round(saving * 100)} points, for {extra_min} more minutes."
            if best is not direct
            else "The direct walk is already the calmest we can find right now."
        ),
        "caveat": "Estimated by ZIP, not by street.",
    }


@lru_cache(maxsize=512)
def _zip_centre(code: str) -> tuple[float, float] | None:
    for z, _, rings in _zip_shapes():
        if z != code:
            continue
        ring = max(rings, key=len)
        return sum(p[1] for p in ring) / len(ring), sum(p[0] for p in ring) / len(ring)
    return None
