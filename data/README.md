# data/ — P2: Data and risk engine

P2 turns public data and the synthetic DOHMH roster into four JSON files: who is at risk, when, and why. The backend serves those files as they are, so P2 can change the scoring anytime without breaking the backend, as long as the shapes in [contracts/README.md](../contracts/README.md#data-files-p2--p3) stay the same.

**Output:** `data/out/<scenario>/` → `scenario.json`, `patients.json`, `exposures.json`, `risk.json`

## Layout

```
data/
  pipelines/
    patients.py        synthetic DOHMH roster → patients.json
    noise_311.py       311 noise counts + each ZIP's normal level
    weather_air.py     NOAA + Open-Meteo historical weather, EPA hourly PM2.5
    exposures.py       0–1 severities + composite → exposures.json
    score_ptsd.py      PTSD score, level, reasons, confidence → risk.json
    build.py           runs everything: python -m pipelines.build --scenario july4
  notebooks/           exploration only; the pipelines are the source of truth
  raw/                 downloads + the synthetic dataset (gitignored, never pushed)
  out/<scenario>/      what the backend reads (pushed)
  requirements.txt     pandas, requests
```

## Setup

```
cd data
python -m venv .venv && source .venv/bin/activate
pip install pandas requests
mkdir -p out/demo && cp ../contracts/fixtures/data/*.json out/demo/
```

The last line gives the backend real file paths to read from minute one. Replace those files with real output as each pipeline step lands.

## Tasks

About 5.25 hours of must-haves.

| # | Task | Hrs | Priority |
| --- | --- | --- | --- |
| D0 | Set up the folder and copy the fixtures into `out/demo/` (above); push | 0.25 | Must, first |
| D1 | Synthetic DOHMH data → `patients.json`: PTSD patients (diagnosis code F43.1x), veteran field if there is one, ZIP → MODZCTA, flags, contact date. Pick a demo patient in Long Island City (11101). **Post a readout in Slack by 17:15.** | 0.75 | Must |
| D5 | Replay scenario **July 4 2023, 06:00 → 05:59** (decided; see [RESEARCH.md](RESEARCH.md)). Pull EPA hourly PM2.5, NOAA Central Park, and Open-Meteo historical hourly weather. | 1.0 | Must |
| D2 | 311 noise from `erm2-nwe9`, not the `igcr-kbaw` view, which drops fireworks. Take hourly counts per ZIP and compare each with that ZIP's normal for the same weekday and hour over the prior 12 months (one query per month). Apply the complaint-type weights in RESEARCH.md. | 1.0 | Must |
| M1 | Turn each trigger into a 0–1 severity plus a weighted `composite` → `exposures.json` | 0.5 | Must |
| M2 | PTSD score = trigger weight × severity × patient factors (recent crisis visit, ACT team or supported housing, substance use, age 65+, the ZIP's heat vulnerability). Output a level plus the top 3 reasons as plain sentences → `risk.json` for every hour | 1.25 | Must |
| M3 | Confidence and caveats: ZIP-level estimate, 311 reporting bias, outdated contact info, no pharmacy data | 0.5 | Must |
| S1 | Live mode: the same pipeline on today's forecast (Open-Meteo forecast + AirNow) → `out/live/` | 0.75 | Should |
| S2 | NWS storm alerts, with thunder counted as a noise trigger | 0.5 | Should |
| S3 | Empty slot for medications, plus diagnosis-based stand-ins marked "estimate" | 0.25 | Should |

## Sources

Tested sources, the numbers behind the choice of replay day, evidence for each trigger, scoring notes and the exact pulls are in **[RESEARCH.md](RESEARCH.md)**.

| Source | Use | Notes |
| --- | --- | --- |
| Synthetic DOHMH dataset (via Slack) | Patients | Keep it in `raw/` only. It includes a flood zone for each client. |
| [NYC 311](https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-Present/erm2-nwe9) (`erm2-nwe9`) | Noise | Aggregate in the Socrata query; run the 12-month baseline one month at a time |
| [EPA AQS hourly PM2.5](https://aqs.epa.gov/aqsweb/airdata/download_files.html) | Air | Observed; 5 NYC monitors. Modeled air quality understates smoke by 3–4×. |
| [NOAA Central Park](https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries&stations=USW00094728&startDate=2023-07-04&endDate=2023-07-04&dataTypes=TMAX,TMIN&units=standard&format=json) + [Open-Meteo historical](https://open-meteo.com/en/docs/historical-weather-api) | Heat | NOAA for the daily mean (80.7°F threshold); Open-Meteo for the hourly shape |
| [NYC Heat Vulnerability Index](https://data.cityofnewyork.us/Health/Heat-Vulnerability-Index-Rankings/4mhf-duep) | Patient factor | Fields `zcta20`, `hvi` (1–5) |
| [ZIP boundaries (MODZCTA)](https://raw.githubusercontent.com/nychealth/coronavirus-data/master/Geography-resources/MODZCTA_2010_WGS1984.geo.json) | ZIP list and centroids | 178 areas; key `MODZCTA` |

## Handoffs

| When | What | To |
| --- | --- | --- |
| Sat 17:15 | Readout in Slack: PTSD patient count, veteran field yes/no, demo patient ID, replay day | All |
| Sat 18:30 | First real `out/<scenario>/` pushed (patients + exposures; rough risk is fine) | P3 |
| Sun 10:00 | Final scoring pushed | P3 |

## Pushing

- Push after each major change (a pipeline step works, the scoring changes) and post one line in Slack.
- Changing a file's shape? Update [contracts/](../contracts/README.md) and its fixture in the same commit.
- Keep each file in `out/` under 5 MB, and run `git pull --rebase` before you push.
- **The repo is public right now.** Don't push a real `patients.json` or `risk.json` until the repo is private or the organizers confirm the synthetic data can be public.
