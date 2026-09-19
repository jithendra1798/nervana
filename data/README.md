# data/ — P2: Data and risk engine

P2 turns public data and the synthetic DOHMH roster into four JSON files: who is at risk, when, and why. The backend serves those files as they are, so P2 can change the scoring anytime without breaking the backend, as long as the shapes in [contracts/README.md](../contracts/README.md#data-files-p2--p3) stay the same.

**Output:** `data/out/<scenario>/` → `scenario.json`, `patients.json`, `exposures.json`, `risk.json`

## Layout

```
data/
  pipelines/
    patients.py        synthetic DOHMH roster → patients.json
    noise_311.py       311 noise counts + each ZIP's normal level
    weather_air.py     Open-Meteo historical weather + air quality
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
| D5 | Replay scenario: pick the day (July 4th evening suggested; June 7 2023 wildfire smoke as backup), use a 24-hour window, and pull hourly weather + air quality | 1.0 | Must |
| D2 | 311 noise: hourly counts per ZIP in the window, compared with that ZIP's average for the same hour and weekday over the past 12 months. Weight fireworks, helicopter and construction higher. | 1.0 | Must |
| M1 | Turn each trigger into a 0–1 severity plus a weighted `composite` → `exposures.json` | 0.5 | Must |
| M2 | PTSD score = trigger weight × severity × patient factors (recent crisis visit, ACT team or supported housing, substance use, age 65+, the ZIP's heat vulnerability). Output a level plus the top 3 reasons as plain sentences → `risk.json` for every hour | 1.25 | Must |
| M3 | Confidence and caveats: ZIP-level estimate, 311 reporting bias, outdated contact info, no pharmacy data | 0.5 | Must |
| S1 | Live mode: the same pipeline on today's forecast (Open-Meteo forecast + AirNow) → `out/live/` | 0.75 | Should |
| S2 | NWS storm alerts, with thunder counted as a noise trigger | 0.5 | Should |
| S3 | Empty slot for medications, plus diagnosis-based stand-ins marked "estimate" | 0.25 | Should |

## Sources

| Source | Use | Notes |
| --- | --- | --- |
| Synthetic DOHMH dataset (host's Master List, link in Slack) | Patients | Keep it in `raw/` only |
| [NYC 311 noise](https://data.cityofnewyork.us/Social-Services/noise/igcr-kbaw/about_data) | Noise | Has `incident_zip`, `complaint_type`, `created_date`. Aggregate in the Socrata query (group by ZIP, weekday, hour and type) instead of downloading raw rows. |
| [Open-Meteo historical weather](https://open-meteo.com/en/docs/historical-weather-api) | Heat | Hourly temperature, humidity, apparent temperature; no key needed |
| [Open-Meteo air quality](https://open-meteo.com/en/docs/air-quality-api) | Air | Hourly `us_aqi`, `pm2_5` |
| [NYC Heat Vulnerability Index](https://data.cityofnewyork.us/Health/Heat-Vulnerability-Index-Rankings/4mhf-duep) | Patient factor | Rank 1–5 per ZIP |
| [ZIP boundaries (MODZCTA)](https://raw.githubusercontent.com/nychealth/coronavirus-data/master/Geography-resources/MODZCTA_2010_WGS1984.geo.json) | ZIP list and centroids | 178 areas; key `MODZCTA` |

Weather barely changes from one ZIP to the next at Open-Meteo's resolution. One point per borough is fine; add that to the caveats.

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
