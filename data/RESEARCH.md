# Data research: what we use and why

As of Sat 19 Sep 2026, 17:00. Every source below was called with a real query today; the numbers come from those calls.

**Decision:** replay **July 4 2023** (06:00 Jul 4 → 05:59 Jul 5) using observed data only: 311 for noise, EPA monitors for air, NOAA plus Open-Meteo's historical weather for heat. It was the loudest of the five candidate nights and had the worst fireworks smoke, so the PTSD noise story and an air-quality story happen in the same hour. Heat is minor that day.

## Why July 4 2023

We compared five candidate days. Noise is 311 complaints, 18:00–02:00 citywide. Heat is from Open-Meteo at Long Island City and NOAA at Central Park. PM2.5 is the hourly maximum across NYC's EPA monitors.

| Day | Noise + fireworks complaints | Feels-like max (°F) | Daily mean (°F) | PM2.5 peak (µg/m³) |
| --- | --- | --- | --- | --- |
| **Jul 4 2023** | **6,686** | 94 | 78.0 | **160.4 at 23:00** |
| Jul 4 2025 | 6,616 | 85 | — | — |
| Jul 4 2024 | 5,582 | 91 | — | — |
| Jun 24 2025 (heat wave) | 1,301 | 108 (model; NOAA high was 99) | — | — |
| Jun 7 2023 (wildfire smoke) | 664 | 72 | — | 412.0 at 13:00 |

For comparison, an ordinary Friday night (Jun 27 2025) had 1,838 complaints. July 2023's typical hourly PM2.5 peak was 11.5 µg/m³, so the July 4 fireworks smoke ran about 14 times normal. Illegal Fireworks alone accounted for 3,376 complaints on the evening of July 4 2025.

## Sources we use

| Source | Trigger | Access | What we found | Watch out for |
| --- | --- | --- | --- | --- |
| [NYC 311 Service Requests](https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-Present/erm2-nwe9) (`erm2-nwe9`) | Noise | Socrata API, no key | Aggregate queries return in about 1s; a month grouped by ZIP × weekday × hour takes 2.7s | Use this dataset, **not** the [`igcr-kbaw` noise view](https://data.cityofnewyork.us/Social-Services/noise/igcr-kbaw/about_data), which leaves out `Illegal Fireworks`. Counts per ZIP are small (LIC peaked at 11 an hour on Jul 4 2025). A 12-month citywide query times out, so run it month by month. |
| [EPA AQS hourly PM2.5](https://aqs.epa.gov/aqsweb/airdata/download_files.html) (`hourly_88101_2023.zip`, 77 MB) | Air | Direct download | 5 NYC monitors; Jul 4 2023: 129.5 at 21:00, 105.7 at 22:00, 160.4 at 23:00 | Only 5 monitors, so assign each ZIP to its borough or the nearest monitor |
| [EPA AQS daily AQI by county](https://aqs.epa.gov/aqsweb/airdata/download_files.html) (1.6 MB) | Air, fallback | Direct download | Available for 2023 | Daily values only |
| [NOAA daily summaries](https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries&stations=USW00094728&startDate=2023-07-04&endDate=2023-07-04&dataTypes=TMAX,TMIN&units=standard&format=json), Central Park `USW00094728` | Heat | API, no key | Jul 4 2023: high 83°F, daily mean 78.0°F | Daily values; for the hourly shape, use Open-Meteo |
| [Open-Meteo historical weather](https://open-meteo.com/en/docs/historical-weather-api) | Heat, hourly | API, no key | Jul 4 2023 at LIC: high 84°F (NOAA: 83), feels-like peak 94°F | Runs hot on extreme days: 106°F on Jun 24 2025, when NOAA recorded 99°F |
| [NYC Heat Vulnerability Index](https://data.cityofnewyork.us/Health/Heat-Vulnerability-Index-Rankings/4mhf-duep) (`4mhf-duep`) | Patient factor | Socrata API | Fields `zcta20` and `hvi` (1–5) | ZCTA codes; match them to MODZCTA |
| [MODZCTA boundaries](https://raw.githubusercontent.com/nychealth/coronavirus-data/master/Geography-resources/MODZCTA_2010_WGS1984.geo.json) | ZIP list, map | GitHub raw | 178 areas, key `MODZCTA` | — |
| Synthetic DOHMH dataset | Patients | From organizers, via Slack | Not public. The organizers' master list says it includes a **flood zone for each client**. | Keep it in `data/raw/` only; the repo is public |

**Live mode only (Should):**

- [Open-Meteo forecast](https://open-meteo.com/en/docs) and [Open-Meteo air quality](https://open-meteo.com/en/docs/air-quality-api). The air-quality model badly understates smoke: it showed a PM2.5 peak of 47.5 for Jul 4 2023 (observed 160.4) and 99.9 for Jun 7 2023 (observed 412). Label any live air values low confidence.
- [NWS alerts API](https://api.weather.gov/alerts/active?point=40.7447,-73.9485) works and needs a `User-Agent` header. For past warnings, the [Iowa Environmental Mesonet warning archive](https://mesonet.agron.iastate.edu/json/vtec_events_bywfo.py?wfo=OKX&year=2023) also works.

**Checked and not used:**

- Hurricane evacuation zones (`uihr-hn7s`): the Socrata API returns 404, so it would need a manual download if we add storms.
- SONYC: no public live feed.
- ShotSpotter: not public.
- CDC PLACES: neighborhood prevalence only, with no PTSD measure.
- AirNow: needs an API key, and EPA AQS already covers the replay.
- NYPD shootings: weak link to our question and risks stigmatizing neighborhoods.

## Evidence for each trigger

| Trigger | Why it matters for PTSD | How strong | How we use it |
| --- | --- | --- | --- |
| **Sudden loud noise** (fireworks, helicopters) | An exaggerated startle response and hypervigilance are core PTSD symptoms. VA clinicians warn that fireworks can bring on flashbacks, anxiety and poor sleep in veterans exposed to explosions or gunfire. Their advice: earplugs or headphones, and knowing when events happen ([VA New Jersey](https://www.va.gov/new-jersey-health-care/news-releases/independence-day-celebrations-can-trigger-ptsd-in-veterans/), [VA Tennessee Valley](https://www.va.gov/tennessee-valley-health-care/stories/ptsd-and-fireworks-how-to-manage-anxiety-and-support-veterans/)). | Clinical consensus. No study links 311 counts to PTSD outcomes. | Highest trigger weight. Fireworks and helicopter complaints count most. |
| **Heat** | Across 3.5M ED visits, extreme-heat days carried 8% more mental-health ED visits (IRR 1.08), including 7% more for anxiety and stress-related disorders, the group PTSD falls under ([Nori-Sarma 2022, JAMA Psychiatry](https://pmc.ncbi.nlm.nih.gov/articles/PMC8867392/)). In New York State, mental-health ER visits rise once the **daily mean** passes **27.07°C (80.7°F)** ([Yoo 2021](https://doi.org/10.1016/j.scitotenv.2021.148246)). SSRIs, antipsychotics and lithium weaken the body's cooling or become risky with dehydration ([CDC](https://www.cdc.gov/heat-health/hcp/clinical-guidance/heat-and-medications-guidance-for-clinicians.html)). | Strong for mental health overall; not measured for PTSD specifically. | Turns on when the daily mean reaches 80.7°F; hourly feels-like sets the intensity. Stronger for supported housing (AC less likely) and for ZIPs ranked 4–5 on heat vulnerability. |
| **Air (PM2.5)** | Wildfire-smoke PM2.5 has been linked to more mental-health ED visits, with PTSD among the conditions reported ([Undark summary](https://undark.org/2026/03/23/wildfire-smoke-mental-health/)). Fireworks smoke arrives in the same hour as the noise. | Moderate; weaker for PTSD specifically | Medium weight, using EPA PM2.5 bands |
| **Storms and flooding** (Should) | After Hurricane Sandy, probable PTSD reached 11.3% in flooded zones against 4.4% elsewhere, and 28.8% among people who already had 9/11-related PTSD ([WTC Health Registry, 2015](https://doi.org/10.4172/1522-4821.1000173)). | Strong for people with prior trauma | NWS warnings combined with the client's flood zone from the synthetic data |

**Our own check: inconclusive, so don't claim it in the pitch.** We compared NYC EMS calls coded as emotionally disturbed person (`EDP`, `EDPC`, `EDPM` in [EMS dispatch data](https://data.cityofnewyork.us/Public-Safety/EMS-Incident-Dispatch-Data/76xm-jjuj)) with NOAA temperatures.

- Hot days (daily mean at or above 80.7°F) had 1% more such calls than matched days, comparing the same year and weekday over summers 2022–24 (54 hot days).
- The evening of July 4 2023 had 143 such calls, against an average of 163 on other Tuesdays that summer.

EMS calls are a rare, blunt measure, and holidays change who calls, so this neither confirms nor rules out an effect. The takeaway: Nervana is **preventive outreach for people already known to have PTSD**, not a predictor of citywide crises. A proper check (a distributed-lag model on EMS and DOHMH ED data) belongs in the pitch's validation plan.

## Scoring notes for P2

- **Noise.** Compare each ZIP with its own normal level: ratio = (count + 1) / (average for the same weekday and hour over the prior 12 months + 1), smoothed over 3 hours. Comparing a ZIP with itself also cancels much of 311's reporting bias, because richer areas complain more ([Environmental Research, 2021](https://www.sciencedirect.com/science/article/abs/pii/S0013935121015553); [NYU Marron](https://marroninstitute.nyu.edu/papers/estimating-reporting-bias-in-311-compliant-data)).
- **Complaint-type weights** (our assumption; label them as such):

    | Complaint type | Weight |
    | --- | --- |
    | Illegal Fireworks, Noise - Helicopter | 1.0 |
    | Noise (DEP: construction and similar) | 0.7 |
    | Street/Sidewalk, Vehicle | 0.5 |
    | Residential, Park | 0.4 |
    | Commercial | 0.3 |
    | House of Worship | 0.2 |

- **Air.** Map PM2.5 onto EPA's bands: 35.5 µg/m³ (unhealthy for sensitive groups) → 0.4, 55.5 → 0.6, 125.5 → 0.85, 225.5 → 1.0. Official AQI uses 24-hour or NowCast averages; we use the hourly reading as a sensitivity signal and say so in the caveats.
- **Heat.** Severity follows the hourly feels-like temperature, from 80.7°F (0) to 100°F (1). It counts **full weight on days whose NOAA mean reaches 80.7°F** (the Yoo threshold) and **half weight otherwise**: the threshold is a population-level daily measure, while a person in supported housing without air conditioning is still exposed on a hot afternoon. This split is our assumption, not a published rule.
- **Caveats to put in every assessment:**
    - Exposure is estimated for the whole ZIP, not the person's block.
    - 311 complaints lag and depend on who reports.
    - Air quality comes from 5 monitors citywide.
    - There's no pharmacy data.
    - Contact details may be outdated.

## What the model does with this

Built in `pipelines/exposures.py` and `pipelines/score_ptsd.py`:

```
score = Σ trigger  weight × severity × (1 + general vulnerability + trigger vulnerability)
```

- **Trigger weights:** noise 0.55, heat 0.30, air 0.25. The map's composite uses 0.5 / 0.3 / 0.2.
- **Noise severity:** log2(ratio) / 3, so 8× a usual night is 1.0, over a trailing 2-hour window.
- **General vulnerability:** crisis visit in the last 30 days +0.35, ACT client +0.20, substance use +0.10.
- **Trigger vulnerability:** veteran +0.25 on noise (VA guidance on fireworks); supported housing +0.30, age 65+ +0.20 and HVI 4–5 +0.20 on heat; age 65+ +0.15 on air.
- **Levels:** act at 0.85, watch at 0.60, and act also needs at least one trigger at severity 0.4, so a heavy history alone never raises an alert on a quiet night.

Environment sets the level and the person's history only multiplies it. That is what keeps the list empty during the day: on July 4 2023 nobody is flagged before 3 PM, 23 are "act" at 9 PM, and 41 at 11 PM, spread across 52 care teams, so a single team sees 1–6 people.

## Pulls for the replay

| # | Pull | Where it goes |
| --- | --- | --- |
| 1 | 311, Jul 4 06:00 → Jul 5 05:59 2023, grouped by `incident_zip`, `date_extract_hh(created_date)`, `complaint_type`; filter `complaint_type like 'Noise%' or complaint_type = 'Illegal Fireworks'` | `raw/311_replay.json` |
| 2 | 311 normal levels, Jul 2022 → Jun 2023, **one query per month**, grouped by ZIP, `date_extract_dow`, `date_extract_hh`, `complaint_type`; page through results with `$offset` | `raw/311_baseline_<month>.json` |
| 3 | EPA `hourly_88101_2023.zip` → keep State Code `36` and counties `005, 047, 061, 081, 085` | `raw/epa_pm25_nyc_2023.csv` |
| 4 | Open-Meteo historical hourly (temperature, humidity, apparent temperature) for one point per borough, Jul 4–5 2023, `timezone=America/New_York` | `raw/weather_replay.json` |
| 5 | NOAA Central Park daily high and low, Jul 4 2023 | `raw/noaa_cp.json` |
| 6 | Heat Vulnerability Index, all rows | `raw/hvi.json` |
| 7 | MODZCTA GeoJSON (for ZIP centroids and the ZIP list) | `raw/modzcta.geojson` |
| 8 | Synthetic DOHMH dataset from Slack | `raw/` (never pushed) |

## Open questions

- What does the synthetic dataset actually contain? Check the diagnosis coding, program types, flood zone, contact dates, and whether there's a veteran field.
- Can anything derived from the synthetic data be published? The repo is public.
