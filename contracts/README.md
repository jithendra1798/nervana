# Contracts

This folder holds the shapes the three parts of Nervana agree on. It has two contracts:

- **Data files**: what `data/` (P2) writes and `backend/` (P3) reads.
- **API**: what `backend/` (P3) serves and `frontend/` (P1) calls.

Every shape has an example file in `fixtures/`. Build against those examples until the real thing is ready. The values are made up; the keys and types are the contract.

## When you change a shape, push the contract

- Change a field, add an endpoint, or change a file's format → update this README and the matching file in `fixtures/`, **in the same commit**.
- Push after each major change, so the others always build against what's actually there.
- Post one line in Slack: what changed and which fixture. Example: *"alerts: added `care_team`, see fixtures/api/alerts.json."*
- Adding a field is always safe. Renaming or removing one breaks someone's code, so ask the person who uses it before you push.

## Shared conventions

- Times are ISO 8601 with offset, hourly: `2025-07-04T21:00:00-04:00`.
- `zip` is the NYC **MODZCTA** code (178 areas), matching the `MODZCTA` field in the [NYC Health ZIP boundary file](https://raw.githubusercontent.com/nychealth/coronavirus-data/master/Geography-resources/MODZCTA_2010_WGS1984.geo.json).
- Severities and scores run from 0 to 1.
- Patient `level`: `none` < `watch` < `act`. Only `watch` and `act` patients appear in alerts.
- Triggers: `noise`, `air`, `heat`. Factors can also be `patient`, meaning something about the person, such as a recent crisis visit.
- `confidence`: `low` | `medium` | `high`. It always comes with a list of `caveats` in plain words.

## Data files (P2 → P3)

P2 writes these to `data/out/<scenario>/`. P3 loads them. Until P2's first real output lands, P3 reads `fixtures/data/`.

| File | Shape | Example |
| --- | --- | --- |
| `scenario.json` | `{id, label, window_start, window_end, default_as_of, step, geo_level, is_fixture, sources[{name, url}]}` | [scenario.json](fixtures/data/scenario.json) |
| `patients.json` | `[{id, name, age, zip, program, diagnoses[], veteran (true/false/null), care_team, contact_last_updated, flags{recent_crisis_visit, substance_use, supported_housing}}]` | [patients.json](fixtures/data/patients.json) |
| `exposures.json` | `[{zip, hour, noise, air, heat, composite, raw{noise_complaints, noise_baseline, us_aqi, heat_index_f}}]`, one row per ZIP per hour | [exposures.json](fixtures/data/exposures.json) |
| `risk.json` | `{"<hour>": [{patient_id, as_of, level, score, factors[{trigger, label, contribution, source}], uncertainty{confidence, caveats[]}}]}`. Lists only `watch` and `act` patients; anyone missing is `none`. | [risk.json](fixtures/data/risk.json) |

`factors` holds at most 3 entries, largest `contribution` first, and `label` is a sentence a clinician can read as-is. What to *do* about the risk (next step, tips) is P3's job and isn't in these files.

## API (P3 → P1)

Base path `/v1`. Every `as_of` is optional and defaults to the scenario's `default_as_of`; P3 rounds it down to the hour.

| Method + path | Body | Response example |
| --- | --- | --- |
| `GET /v1/scenario` | — | [scenario.json](fixtures/api/scenario.json) |
| `GET /v1/map?as_of=&trigger=composite\|noise\|air\|heat` | — | [map.json](fixtures/api/map.json): `{as_of, trigger, zips[{zip, severity, band, top_trigger, noise, air, heat}]}` |
| `GET /v1/alerts?as_of=&level=&program=&care_team=&limit=` | — | [alerts.json](fixtures/api/alerts.json): `{as_of, count, shown, alerts[]}`, `act` first then by score |
| `POST /v1/alerts/{alert_id}/action` | `{action: "outreach" \| "dismiss", reason?, clinician}` | [alert_action.json](fixtures/api/alert_action.json): the updated alert |
| `GET /v1/patients/{id}/risk?as_of=` | — | [patient_risk.json](fixtures/api/patient_risk.json): patient, level, score, factors, uncertainty, `next_step`, `tips`, 24h `timeline` |
| `GET /v1/patients/{id}/plan` | — | [plan.json](fixtures/api/plan.json): care-team items first, then standard tips |
| `POST /v1/escalations` | `{patient_id, trigger: "need_help" \| "threshold", consent: true, note?}` | [escalation_created.json](fixtures/api/escalation_created.json) |
| `GET /v1/escalations?status=open` | — | [escalations.json](fixtures/api/escalations.json) |
| `POST /v1/escalations/{id}/respond` | `{text, clinician}` | [escalation_responded.json](fixtures/api/escalation_responded.json); the reply is also added to the patient's plan |
| `GET /v1/patients/{id}/profile` · `PUT …/profile` | `{triggers[], helps[], home{air_conditioning, quiet_room}, support_person, safe_places[], notes, share_with_care_team}` | What the client told us about themselves, plus the options for the form |
| `GET /v1/patients/{id}/vitals?as_of=` | none | Simulated wearable signal: `series` (heart rate, HRV, restless minutes, plus that hour's triggers), `baseline`, `correlations` per trigger, `headline`. Always `simulated: true`. |
| `GET /v1/geocode?q=` | none | Addresses and places in NYC: `{results[{label, lat, lon, zip}]}`, for the search bars |
| `GET /v1/route?from=lat,lon&to=lat,lon&as_of=&trigger=` | none | The walk: `direct`, `recommended` (a detour when one is genuinely calmer), `by_hour` for the same path, and `timing.advice` |
| `GET /v1/audit` | — | `{events[{at, event, …}]}` — every alert action, consent and reply |
| `POST /v1/demo/reset` | — | Clears demo state (actions, help requests, plans) |
| `GET /fhir/RiskAssessment?patient=&as_of=` | — | The same risk as a FHIR R4 RiskAssessment |
| `GET /cds-services` · `POST /cds-services/nervana-climate-ptsd` | CDS Hooks request | A `patient-view` card: summary, why, next step, override reasons |
| `GET /v1/integration/preview?patient=&as_of=` | — | Card + FHIR + recent audit together, for the "Inside the EHR" screen |

Field notes:

- **One alert per event.** `alert_id` is `AL-<client>-<episode start hour>`, where the episode is the unbroken run of flagged hours. A client flagged from 8 PM to 2 AM produces one alert, not seven, and an alert already handled stays handled as the night goes on. `flagged_since` carries that start time.
- Alerts come back `act` first, then by score. `count` is the total after filters, `shown` is how many are in this response (`limit`, default 100).
- Tips carry a `source`: `care_team`, `your_profile` (built from the client's own answers) or `standard_tips`, and are returned in that order. `profile_note` is the one-line version for the care team, and only exists when the client ticked "share with my care team".
- `GET /v1/patients/{id}/risk` also returns `exposure`: the raw numbers behind the severities (complaint counts, PM2.5, feels-like temperature) for the client's ZIP at that hour.

- `band` on the map: `low` | `moderate` | `high`.
- Alert `status`: `new` | `outreach` | `dismissed`.
- `next_step.source` and plan item `source`: `care_team` | `standard_tips`. A care-team item always comes before the standard tips.
- An escalation `packet` is the doctor bundle: `summary`, `level`, `factors`, `exposures_24h`, `tips_shown`, `missing_data`, and `vitals` (simulated).
- `POST /v1/escalations` without `consent: true` returns `400`. Crisis numbers (988, press 1 for the Veterans Crisis Line; 911) are shown by the frontend and never depend on the API.
