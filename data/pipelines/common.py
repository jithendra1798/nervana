"""Shared paths, scenario settings and small helpers for the data pipelines."""
from __future__ import annotations

import json
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw"
OUT = ROOT / "out"
EDT = timezone(timedelta(hours=-4))
SODA = "https://data.cityofnewyork.us/resource"
UA = {"User-Agent": "nervana-hackathon/0.1 (Health in Climate AI Hackathon NYC)"}


@dataclass(frozen=True)
class Scenario:
    id: str
    label: str
    start: datetime          # first hour (local, EDT)
    hours: int
    default_hour: datetime
    baseline_from: str       # 311 normal levels: 12 months before the scenario
    baseline_to: str

    @property
    def hour_list(self) -> list[datetime]:
        return [self.start + timedelta(hours=i) for i in range(self.hours)]


SCENARIOS = {
    "july4-2023": Scenario(
        id="july4-2023",
        label="July 4, 2023 · Independence Day fireworks",
        start=datetime(2023, 7, 4, 6, tzinfo=EDT),
        hours=24,
        default_hour=datetime(2023, 7, 4, 21, tzinfo=EDT),
        baseline_from="2022-07-01",
        baseline_to="2023-06-30",
    ),
}


def iso(dt: datetime) -> str:
    return dt.isoformat()


def soda(dataset: str, retries: int = 3, **params) -> list[dict]:
    """Socrata query; params are SoQL clauses without the leading $."""
    url = f"{SODA}/{dataset}.json"
    q = {f"${k}": v for k, v in params.items()}
    for attempt in range(retries):
        try:
            r = requests.get(url, params=q, headers=UA, timeout=240)
            r.raise_for_status()
            return r.json()
        except requests.RequestException:
            if attempt == retries - 1:
                raise
            time.sleep(3 * (attempt + 1))
    return []


def cached_json(path: Path, produce) -> object:
    """Return path's JSON, producing and saving it first if missing."""
    if path.exists():
        return json.loads(path.read_text())
    path.parent.mkdir(parents=True, exist_ok=True)
    data = produce()
    path.write_text(json.dumps(data))
    return data


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")


def borough_of(zip_code: str) -> str:
    z = int(zip_code[:3])
    if z in (100, 101, 102):
        return "Manhattan"
    if z == 103:
        return "Staten Island"
    if z == 104:
        return "Bronx"
    if z == 112:
        return "Brooklyn"
    return "Queens"


def load_zips() -> list[dict]:
    """The 178 MODZCTA areas: code, member ZIPs, borough and centroid."""
    geo = json.loads((ROOT.parent / "frontend" / "public" / "modzcta.geojson").read_text())
    out = []
    for f in geo["features"]:
        code = f["properties"]["MODZCTA"]
        if code == "99999":
            continue
        ring = _largest_ring(f["geometry"])
        lon = sum(p[0] for p in ring) / len(ring)
        lat = sum(p[1] for p in ring) / len(ring)
        members = [z.strip() for z in f["properties"]["label"].split(",")]
        out.append({"zip": code, "members": members, "borough": borough_of(code), "lat": lat, "lon": lon})
    return out


def _largest_ring(geom: dict) -> list:
    if geom["type"] == "Polygon":
        return geom["coordinates"][0]
    return max((poly[0] for poly in geom["coordinates"]), key=len)
