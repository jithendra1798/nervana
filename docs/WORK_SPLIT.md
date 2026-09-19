# Nervana — Hackathon Work Split

As of Sat 19 Sep 2026, 15:00. Code freeze Sun 12:00, submission deadline 12:30.

**P1** = Lovable frontend · **P2** = Data & risk engine · **P3** = API, integrations & deploy

## One repo, Lovable included

Everything lives in one repo, `jithendra1798/nervana`, and Lovable works in it directly. Lovable can't import an existing repo. It can only create a new repo and sync it both ways, and the sync survives a rename ([Lovable GitHub docs](https://docs.lovable.dev/integrations/github)). So Lovable creates the repo, we move this repo's contents into it, and it takes the `nervana` name.

**Setup (about 20 minutes, do it now):**

1. Jithendra creates a Lovable project named `nervana` and invites P1 to it as an editor.
2. In the project's GitHub settings, connect the `jithendra1798` account. Lovable creates a new repo.
3. Merge this repo into Lovable's repo, resolve `README.md` and `.gitignore`, then push to its `main`.
4. On GitHub, rename the old `nervana` repo to `nervana-old` and archive it. Then rename Lovable's repo to `nervana`.
5. Post "repo moved" in Slack. Everyone runs `git pull`; the `origin` URL stays the same.

P2 and P3 can commit locally now but shouldn't push from step 3 until step 5 is posted.

**Rules for sharing a repo with Lovable:**

- Lovable owns the repo root: `package.json`, `index.html`, `src/`, `public/` and the config files. Only P1 changes them, and only through Lovable.
- P2 and P3 only touch `backend/` and `docs/`.
- Lovable commits to `main` all the time, so always `git pull --rebase` before `git push`.
- Keep every file under 10 MB, because Lovable can't save bigger ones. Raw downloads go in `backend/data/raw/`, which is gitignored.
- Secrets go in `.env` (gitignored) and in the hosting provider's settings, never in the repo.
- Don't disconnect GitHub in Lovable or move the project to another workspace this weekend. Either one makes Lovable create a new repo.

**Layout:**

```
nervana/
  package.json, index.html, src/, public/   P1, through Lovable only
  backend/
    api/                 P3   FastAPI app; schemas.py is shared
    engine/
      sources/           P2   noise_311.py, open_meteo.py, airnow.py, nws.py
      triggers/          P2   ptsd.py  (later: asthma.py, heat.py)
      recommend/         P3   care_plan.py, tips.py, ai_draft.py
      notify/            P3   inbox.py, fhir.py
    data/
      raw/               P2   downloads, gitignored
      scenarios/<day>/   P2   frozen replay-day data, committed
    contracts/           P3   openapi.json + fixtures/*.json (P1 reads these)
    notebooks/           P2
    requirements.txt
  docs/
    WORK_SPLIT.md        this file
```

The backend deploys from `backend/`: set Root Directory to `backend` on Render or Railway. Lovable can import the sample responses straight from `backend/contracts/fixtures/`, so nobody needs to copy them over.

## Timeline and checkpoints

The checkpoint that matters most today is a public API by 19:00, so the Lovable screens can switch to real data.

| When | Milestone | Owner |
| --- | --- | --- |
| Sat 15:00 | Agree the shared Python data shapes (Exposure, Patient, RiskAssessment) | P2 + P3 |
| Sat 15:30 | Lovable connected, repo merged and renamed (setup steps 1–5) | Jithendra + P1 |
| Sat 15:40 | API spec + sample responses committed to `backend/contracts/` | P3 |
| Sat 15:45 | Synthetic data readout in Slack: PTSD patient count, veteran field yes/no, demo patient, replay day | P2 |
| Sat 17:30 | Replay-day data + PTSD scoring v1 handed to the API | P2 |
| Sat 19:00 | API live at a public URL; one Lovable screen on real data | P3, P1 |
| Sat 19:30 | Day 1 wrap: inbox → patient detail works on the replay day | All |
| Sun 10:30 | Full loop works: map → alert → why → act → I need help → doctor reply | All |
| Sun 11:00 | Stop adding features; rehearse the demo twice | All |
| Sun 11:30 | Record the backup demo video | P1 |
| Sun 12:00 | Code freeze | All |
| Sun 12:30 | Submission deadline | — |

If we're behind at 19:30 Saturday, drop every Should task and the map's noise/air/heat toggle.

## P1: Lovable frontend

P1 builds every screen in Lovable and nothing else. The must-haves come to 6.5 hours. P1 starts on sample data, so nobody else can block them.

| # | Task | Hrs | Priority |
| --- | --- | --- | --- |
| F0 | `src/lib/api.ts` with one `API_BASE_URL` constant and a `USE_MOCKS` switch that reads `backend/contracts/fixtures/*.json` | 0.25 | Must, now |
| F1 | Provider inbox: flagged patients for a chosen date/time, level labels (none / watch / act), main reason, filter by program (clinic, ACT team, supported housing) | 1.0 | Must |
| F2 | Patient detail: reason bars, 72-hour conditions chart, confidence badge and caveats, suggested next step, buttons (call / message / dismiss with a reason) | 1.25 | Must |
| F3 | Map: ZIPs colored by risk, noise / air / heat toggle, opens on Long Island City | 1.25 | Must |
| F4 | Help-request inbox: read the doctor bundle, write or approve a recommendation (this saves the patient's plan) | 0.75 | Must |
| F5 | Switch from sample data to the live API; loading and error states | 0.75 | Must |
| F6a | Patient page (phone-sized): **I need help** shows 988 (press 1) and 911 first, then asks to notify the care team; shows the doctor's reply | 0.75 | Must |
| F6b | Patient page extras: today's risk and tips | 0.75 | Should |
| F7 | 90-day conditions trend for the patient's ZIP | 1.0 | Cut unless ahead |
| V1 | Record the backup demo video (Sun 11:30) | 0.5 | Must |

**P1 needs from the others:** sample responses (P3, 15:40), the demo patient and replay day (P2, 15:45), the public API URL (P3, 19:00).

## P2: Data and risk engine

P2 turns raw data into conditions for each ZIP and a PTSD score with reasons. The must-haves come to 6.5 hours, all in Python under `backend/engine/` and `backend/data/`.

| # | Task | Hrs | Priority |
| --- | --- | --- | --- |
| D1 | Read the synthetic DOHMH data: fields, number of PTSD patients (diagnosis code F43.1x), whether there's a veteran field, ZIP cleanup, missing-data flags. Post a readout and a demo patient in Long Island City to Slack. | 0.75 | Must, first |
| D5 | Pick the replay day (a July 4th evening suggested; June 7 2023 wildfire smoke as backup). Freeze its data from 311, NOAA's Central Park station and EPA's daily air-quality files. | 1.0 | Must |
| D2 | 311 noise ([igcr-kbaw](https://data.cityofnewyork.us/Social-Services/noise/igcr-kbaw/about_data)): 12 months counted by ZIP × hour of the week × complaint type; compare each ZIP to its normal level; weight helicopter, fireworks and construction higher | 1.25 | Must |
| D3 | Open-Meteo source (feels-like temperature, UV, US air-quality index, no key needed) at each ZIP's center point; AirNow for the official air-quality number | 1.0 | Must |
| M1 | Turn each feed into a 0–1 severity: EPA air-quality bands, heat-advisory heat index, noise compared to the ZIP's normal | 0.75 | Must |
| M2 | PTSD score = trigger weight × severity × patient factors (recent ER or crisis visit, ACT team or supported housing, substance use, age, the ZIP's heat vulnerability). Output a level plus the top 3 reasons in plain words. | 1.25 | Must |
| M3 | Confidence badge and caveats: ZIP-level location, how far ahead the forecast is, how old the data is, outdated contact info, no pharmacy data | 0.5 | Must |
| D6 | NWS storm alerts (thunder counts as a noise trigger) | 0.5 | Should |
| M5 | Empty slot for medications, plus diagnosis-based stand-ins marked "estimate" | 0.25 | Should |

**P2 delivers:** one file per source in `backend/engine/sources/` with `fetch(zips, as_of)`; `backend/engine/triggers/ptsd.py` with `assess(patient, exposures)`; replay-day files in `backend/data/scenarios/<day>/`.

## P3: API, integrations and deploy

P3 owns the API that everything talks to. The contract comes first (by 15:40), a public URL by 19:00, then the doctor loop and the hospital-system formats. The must-haves come to 5.5 hours.

| # | Task | Hrs | Priority |
| --- | --- | --- | --- |
| B1 | FastAPI setup, shared data shapes in `backend/api/schemas.py`, API spec, SQLite, sample responses in `backend/contracts/` | 0.75 | Must, first |
| D4 | ZIP boundary shapes joined with the Heat Vulnerability Index, served by the API | 0.5 | Must |
| B2 | Main endpoints, all taking a date/time (`as_of`): map, flagged list, patient detail, alert actions | 1.25 | Must |
| M4 | Alert rules: alert only when a patient moves into "act", 24-hour quiet period per patient and trigger, daily cap per clinician | 0.5 | Must |
| B3 | Recommendations in priority order: doctor's plan › standard tips › AI draft. Write the tip library and have a clinician teammate review the wording. | 0.75 | Must |
| B4 | Help requests: consent check, doctor bundle (72h conditions, reasons, tips already shown, missing data), inbox delivery, doctor reply saved as the patient's plan, activity log | 1.25 | Must |
| B5 | Deploy `backend/` to Render or Railway; allow Lovable's preview and published domains (CORS); API keys in the host's settings, not the repo | 0.5 | Must, by 19:00 |
| B6 | FHIR RiskAssessment output + CDS Hooks alert card | 1.25 | Should |
| M6 | Claude (`claude-sonnet-5`) summary and outreach script built only from the computed reasons; generate the demo versions ahead of time | 1.0 | Should |

If P3 falls behind, drop M6 first; B6 carries more weight in the pitch. The architecture slide goes to a teammate who isn't building.

## Handoffs

The three people depend on each other at just five handoffs. If a handoff is late, the receiver keeps building on sample data and doesn't wait.

| When | From → To | What | Where |
| --- | --- | --- | --- |
| Sat 15:00 | P2 ↔ P3 | Data shapes agreed: Exposure (zip, hour, trigger, value, severity, source, fetched_at), Patient, RiskAssessment | `backend/api/schemas.py` |
| Sat 15:40 | P3 → P1 | API spec + one sample response per endpoint | `backend/contracts/` |
| Sat 15:45 | P2 → all | PTSD count, veteran field yes/no, demo patient ID, replay day | Slack |
| Sat 17:30 | P2 → P3 | Replay-day conditions + `assess()` v1 | `backend/data/scenarios/`, `backend/engine/triggers/ptsd.py` |
| Sat 19:00 | P3 → P1 | Public API URL | Slack + `backend/contracts/README.md` |

**The contract P1 builds against:**

```
GET  /v1/map?as_of=&trigger=            per-ZIP severity for the map
GET  /v1/alerts?as_of=&program=         flagged patients
GET  /v1/patients/{id}/risk?as_of=      level, reasons, confidence, next step
POST /v1/alerts/{id}/action             {action: outreach | dismiss, reason}
POST /v1/escalations                    {patient_id, trigger: need_help | threshold}
GET  /v1/escalations?status=open        help-request inbox
POST /v1/escalations/{id}/respond       {text} → saved as the patient's plan
GET  /v1/patients/{id}/plan             doctor's recommendations for the patient page
```

Each risk response carries a `level`, up to 3 `factors` (label, contribution, source), an `uncertainty` block (confidence plus caveats) and a `next_step` that names where it came from (doctor's plan, standard tips or AI draft).
