"""Download every public source for a scenario into raw/<scenario>/ (cached).

Run: python -m pipelines.fetch --scenario july4-2023
"""
from __future__ import annotations

import argparse
import io
import zipfile
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import requests

from .common import RAW, SCENARIOS, UA, Scenario, cached_json, load_zips, soda

NOISE_WHERE = "(complaint_type like 'Noise%' or complaint_type = 'Illegal Fireworks')"
NYC_COUNTIES = {"005": "Bronx", "047": "Brooklyn", "061": "Manhattan", "081": "Queens", "085": "Staten Island"}


def fetch_noise_replay(s: Scenario, d: Path) -> list[dict]:
    end = s.hour_list[-1].replace(minute=59, second=59)
    return cached_json(d / "311_replay.json", lambda: soda(
        "erm2-nwe9",
        select="incident_zip, date_trunc_ymd(created_date) as d, date_extract_hh(created_date) as hh, complaint_type, count(*) as n",
        where=f"created_date between '{s.start:%Y-%m-%dT%H:%M:%S}' and '{end:%Y-%m-%dT%H:%M:%S}' and {NOISE_WHERE} and incident_zip is not null",
        group="incident_zip, d, hh, complaint_type",
        limit=50000,
    ))


def fetch_noise_baseline(s: Scenario, d: Path) -> list[dict]:
    """Complaints by ZIP x weekday x hour x type over the 12 months before the scenario,
    limited to the weekdays the replay window touches. One query per month."""
    dows = sorted({(h.isoweekday() % 7) for h in s.hour_list})  # SoQL: 0 = Sunday
    rows: list[dict] = []
    month = date.fromisoformat(s.baseline_from)
    last = date.fromisoformat(s.baseline_to)
    while month <= last:
        nxt = (month.replace(day=28) + timedelta(days=4)).replace(day=1)
        tag = f"{month:%Y-%m}"
        part = cached_json(d / "311_baseline" / f"{tag}.json", lambda: _paged(
            "erm2-nwe9",
            select="incident_zip, date_extract_dow(created_date) as dow, date_extract_hh(created_date) as hh, complaint_type, count(*) as n",
            where=f"created_date >= '{month}T00:00:00' and created_date < '{nxt}T00:00:00' and {NOISE_WHERE} "
                  f"and incident_zip is not null and date_extract_dow(created_date) in ({', '.join(map(str, dows))})",
            group="incident_zip, dow, hh, complaint_type",
            order="incident_zip, dow, hh, complaint_type",
        ))
        print(f"  311 baseline {tag}: {len(part)} groups")
        rows.extend(part)
        month = nxt
    return rows


def _paged(dataset: str, **params) -> list[dict]:
    out, offset = [], 0
    while True:
        page = soda(dataset, limit=50000, offset=offset, **params)
        out.extend(page)
        if len(page) < 50000:
            return out
        offset += 50000


def fetch_pm25(s: Scenario, d: Path) -> pd.DataFrame:
    """EPA AQS hourly PM2.5 (parameter 88101) for NYC monitors on the scenario days."""
    out = d / "epa_pm25.csv"
    if out.exists():
        return pd.read_csv(out, dtype={"county": str})
    year = s.start.year
    zpath = RAW / f"hourly_88101_{year}.zip"
    if not zpath.exists():
        print(f"  downloading EPA hourly PM2.5 {year} (~80 MB)…")
        r = requests.get(f"https://aqs.epa.gov/aqsweb/airdata/hourly_88101_{year}.zip", headers=UA, timeout=600)
        r.raise_for_status()
        zpath.write_bytes(r.content)
    with zipfile.ZipFile(zpath) as z:
        with z.open(z.namelist()[0]) as fh:
            df = pd.read_csv(io.TextIOWrapper(fh), dtype={"State Code": str, "County Code": str, "Site Num": str},
                             usecols=["State Code", "County Code", "Site Num", "Latitude", "Longitude", "Date Local", "Time Local", "Sample Measurement"])
    days = {h.strftime("%Y-%m-%d") for h in s.hour_list}
    df = df[(df["State Code"] == "36") & df["County Code"].isin(NYC_COUNTIES) & df["Date Local"].isin(days)]
    df = df.rename(columns={"County Code": "county", "Site Num": "site", "Latitude": "lat", "Longitude": "lon",
                            "Date Local": "date", "Time Local": "time", "Sample Measurement": "pm25"})[
        ["county", "site", "lat", "lon", "date", "time", "pm25"]]
    df.to_csv(out, index=False)
    return df


def fetch_weather(s: Scenario, d: Path) -> dict:
    """Open-Meteo historical hourly weather at one point per borough (ZIP centroids averaged)."""
    zips = pd.DataFrame(load_zips())
    pts = zips.groupby("borough")[["lat", "lon"]].mean()

    def produce():
        r = requests.get("https://archive-api.open-meteo.com/v1/archive", headers=UA, timeout=120, params={
            "latitude": ",".join(f"{v:.4f}" for v in pts["lat"]),
            "longitude": ",".join(f"{v:.4f}" for v in pts["lon"]),
            "start_date": f"{s.start:%Y-%m-%d}", "end_date": f"{s.hour_list[-1]:%Y-%m-%d}",
            "hourly": "temperature_2m,relative_humidity_2m,apparent_temperature",
            "temperature_unit": "fahrenheit", "timezone": "America/New_York",
        })
        r.raise_for_status()
        res = r.json()
        res = res if isinstance(res, list) else [res]
        return {b: {"lat": float(pts.loc[b, "lat"]), "lon": float(pts.loc[b, "lon"]), "hourly": x["hourly"]} for b, x in zip(pts.index, res)}

    return cached_json(d / "weather.json", produce)


def fetch_noaa(s: Scenario, d: Path) -> list[dict]:
    def produce():
        r = requests.get("https://www.ncei.noaa.gov/access/services/data/v1", headers=UA, timeout=120, params={
            "dataset": "daily-summaries", "stations": "USW00094728", "dataTypes": "TMAX,TMIN", "units": "standard",
            "startDate": f"{s.start:%Y-%m-%d}", "endDate": f"{s.hour_list[-1]:%Y-%m-%d}", "format": "json",
        })
        r.raise_for_status()
        return r.json()
    return cached_json(d / "noaa_central_park.json", produce)


def fetch_hvi(d: Path) -> list[dict]:
    return cached_json(d / "hvi.json", lambda: soda("4mhf-duep", limit=1000))


def fetch_all(s: Scenario) -> None:
    d = RAW / s.id
    d.mkdir(parents=True, exist_ok=True)
    print(f"Fetching sources for {s.id} into {d}")
    print(f"  311 replay: {len(fetch_noise_replay(s, d))} groups")
    print(f"  311 baseline total: {len(fetch_noise_baseline(s, d))} groups")
    print(f"  EPA PM2.5 rows: {len(fetch_pm25(s, d))}")
    print(f"  weather points: {list(fetch_weather(s, d))}")
    print(f"  NOAA: {fetch_noaa(s, d)}")
    print(f"  HVI rows: {len(fetch_hvi(RAW))}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenario", default="july4-2023", choices=SCENARIOS)
    fetch_all(SCENARIOS[ap.parse_args().scenario])
