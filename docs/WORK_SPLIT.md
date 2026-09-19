# Nervana — Hackathon Work Split

As of Sat 19 Sep 2026, 15:15. Code freeze Sun 12:00, submission deadline 12:30.

Two people build:

- **P1 builds the frontend** in Lovable.
- **Jithendra builds the backend**: data, risk engine and API, working with Claude Code.

About 6.75 build hours are left. The backend scope below is cut to fit that.

## One repo, Lovable included

Frontend and backend share one repo, and Lovable works in it directly. Giving P1 access to `jithendra1798/nervana` isn't enough, because Lovable can't import an existing repo. It only syncs with a repo it creates itself, under a GitHub account or org that P1 controls ([Lovable GitHub docs](https://docs.lovable.dev/integrations/github)).

So we create a shared GitHub org, let Lovable create the repo there, and move this repo's contents into it. Both of us own it, and it never has to be transferred, which would break Lovable's sync.

**Setup (about 15 minutes, do it now):**

1. Jithendra creates a free GitHub org (for example `nervana-hq`) and invites P1 as an owner, so P1 can install Lovable's GitHub app on it.
2. P1 creates the Lovable project `nervana`, connects GitHub, and picks the org. Lovable creates the repo there.
3. Jithendra merges this repo into the new one, resolves `README.md` and `.gitignore`, and pushes to its `main`. Claude Code can do this step.
4. If Lovable named the repo something else, rename it to `nervana`; the sync keeps working. Archive `jithendra1798/nervana`.
5. Jithendra points local `origin` at the new repo.

A faster option that's harder to undo: P1 lets Lovable create the repo on their personal account and adds Jithendra as a collaborator with write access. It works the same way, but the repo stays on P1's account for good.

**Rules for sharing a repo with Lovable:**

- Lovable owns the repo root: `package.json`, `index.html`, `src/`, `public/` and the config files. Only P1 changes them, and only through Lovable.
- Backend work only touches `backend/` and `docs/`.
- Lovable commits to `main` all the time, so always `git pull --rebase` before `git push`.
- Keep every file under 10 MB, because Lovable can't save bigger ones. Raw downloads go in `backend/data/raw/`, which is gitignored.
- Secrets go in `.env` (gitignored) and in the hosting provider's settings, never in the repo.
- Don't disconnect GitHub in Lovable, move the project to another workspace, or transfer the repo to another account this weekend. Each one breaks the sync.

**Layout:**

```
nervana/
  package.json, index.html, src/, public/   P1, through Lovable only
  backend/                                  Jithendra
    api/                 FastAPI app, schemas.py
    engine/
      sources/           noise_311.py, open_meteo.py
      triggers/          ptsd.py  (later: asthma.py, heat.py)
      recommend/         care_plan.py, tips.py
      notify/            inbox.py
    data/
      raw/               downloads, gitignored
      scenarios/<day>/   frozen replay-day data, committed
    contracts/           openapi.json + fixtures/*.json (P1 reads these)
    requirements.txt
  docs/
    WORK_SPLIT.md        this file
```

The backend deploys from `backend/`: set Root Directory to `backend` on Render or Railway. Lovable can import the sample responses straight from `backend/contracts/fixtures/`.

## Timeline and checkpoints

The checkpoint that matters most today is a public API by 19:00, so the Lovable screens can switch to real data.

| When | Milestone | Owner |
| --- | --- | --- |
| Sat 15:30 | Shared org created, Lovable repo created, this repo merged in (setup steps 1–5) | Jithendra + P1 |
| Sat 15:45 | API spec + sample responses committed to `backend/contracts/` | Jithendra |
| Sat 16:15 | Synthetic data readout in Slack: PTSD patient count, veteran field yes/no, demo patient, replay day | Jithendra |
| Sat 18:00 | PTSD scoring runs on the replay day | Jithendra |
| Sat 19:00 | API live at a public URL; one Lovable screen on real data | Jithendra, P1 |
| Sat 19:30 | Day 1 wrap: inbox → patient detail works on the replay day | Both |
| Sun 10:30 | Full loop works: map → alert → why → act → I need help → doctor reply | Both |
| Sun 11:00 | Stop adding features; rehearse the demo twice | Both |
| Sun 11:30 | Record the backup demo video | P1 |
| Sun 12:00 | Code freeze | Both |
| Sun 12:30 | Submission deadline | — |

If we're behind at 19:30 Saturday, drop every Should task and the map's noise/air/heat toggle.

## P1: Lovable frontend

P1 builds every screen in Lovable and nothing else. The must-haves come to 6.5 hours. P1 starts on sample data, so they're never blocked by the backend.

| # | Task | Hrs | Priority |
| --- | --- | --- | --- |
| F0 | `src/lib/api.ts` with one `API_BASE_URL` constant and a `USE_MOCKS` switch that reads `backend/contracts/fixtures/*.json` | 0.25 | Must, now |
| F1 | Provider inbox: flagged patients for a chosen date/time, level labels (none / watch / act), main reason, filter by program (clinic, ACT team, supported housing) | 1.0 | Must |
| F2 | Patient detail: reason bars, 72-hour conditions chart, confidence badge and caveats, suggested next step, buttons (call / message / dismiss with a reason) | 1.25 | Must |
| F3 | Map: load ZIP shapes from the [NYC Health ZIP boundary file](https://raw.githubusercontent.com/nychealth/coronavirus-data/master/Geography-resources/MODZCTA_2010_WGS1984.geo.json) (178 areas, match on `MODZCTA`), color them by `/v1/map`, noise / air / heat toggle, open on Long Island City | 1.25 | Must |
| F4 | Help-request inbox: read the doctor bundle, write or approve a recommendation (this saves the patient's plan) | 0.75 | Must |
| F5 | Switch from sample data to the live API; loading and error states | 0.75 | Must |
| F6a | Patient page (phone-sized): **I need help** shows 988 (press 1) and 911 first, then asks to notify the care team; shows the doctor's reply | 0.75 | Must |
| F6b | Patient page extras: today's risk and tips | 0.75 | Should |
| F7 | 90-day conditions trend for the patient's ZIP | 1.0 | Cut unless ahead |
| V1 | Record the backup demo video (Sun 11:30) | 0.5 | Must |

**P1 needs from the backend:** sample responses (15:45), the demo patient and replay day (16:15), the public API URL (19:00).

## Jithendra: backend (data, risk engine, API)

The backend is one person's job now, so it runs only on the replay day and scores with plain rules. That brings the must-haves to 6.5 hours, with Claude Code writing most of the code. Live data feeds and hospital-system formats move to Should.

| # | Task | Hrs | Priority |
| --- | --- | --- | --- |
| B1 | FastAPI setup, data shapes in `backend/api/schemas.py`, API spec, sample responses in `backend/contracts/`. This is what unblocks P1. | 0.5 | Must, first |
| D1 | Read the synthetic DOHMH data: fields, number of PTSD patients (diagnosis code F43.1x), whether there's a veteran field, ZIPs mapped to MODZCTA, missing-data flags. Pick a demo patient in Long Island City. | 0.5 | Must |
| D5 | Replay day (a July 4th evening suggested; June 7 2023 wildfire smoke as backup): freeze that evening's 311 noise and Open-Meteo historical weather and air quality for every ZIP | 0.75 | Must |
| D2 | 311 noise normal levels ([igcr-kbaw](https://data.cityofnewyork.us/Social-Services/noise/igcr-kbaw/about_data)): average count per ZIP for that hour of the week over 12 months; weight helicopter, fireworks and construction higher | 0.75 | Must |
| M1–M4 | Scoring. Turn each feed into a 0–1 severity. PTSD score = trigger weight × severity × patient factors (recent ER or crisis visit, ACT team or supported housing, substance use, age, the ZIP's Heat Vulnerability Index). Output a level, the top 3 reasons, and a confidence badge with caveats. Only "act" goes to the inbox. | 1.5 | Must |
| B2 | Endpoints, all taking a date/time (`as_of`): map, flagged list, patient detail with standard tips attached, alert actions | 1.0 | Must |
| B4 | Help requests: consent flag, doctor bundle (72h conditions, reasons, tips already shown, missing data), inbox, doctor reply saved as the patient's plan (it then comes before the standard tips), activity log | 1.0 | Must |
| B5 | Deploy `backend/` to Render or Railway; allow Lovable's preview and published domains (CORS) | 0.5 | Must, by 19:00 |

**Should, only if ahead or overnight, in this order:**

1. FHIR RiskAssessment output + CDS Hooks alert card (1.25h). This is the strongest answer to "not a standalone app".
2. Live mode: Open-Meteo forecast + AirNow for today's date (0.75h).
3. Claude (`claude-sonnet-5`) summary and outreach script built only from the computed reasons, generated ahead for the demo (1.0h).
4. NWS storm alerts, with thunder counted as a noise trigger (0.5h).
5. Empty slot for medications, plus diagnosis-based stand-ins marked "estimate" (0.25h).

Hand the architecture slide and a clinician review of the tip wording to teammates who aren't building.

## Handoffs

There are three handoffs, all from the backend to P1. If one is late, P1 keeps building on sample data.

| When | What | Where |
| --- | --- | --- |
| Sat 15:45 | API spec + one sample response per endpoint | `backend/contracts/` |
| Sat 16:15 | PTSD count, veteran field yes/no, demo patient ID, replay day | Slack |
| Sat 19:00 | Public API URL | Slack + `backend/contracts/README.md` |

**The contract P1 builds against:**

```
GET  /v1/map?as_of=&trigger=            severity per ZIP (keyed by MODZCTA)
GET  /v1/alerts?as_of=&program=         flagged patients
GET  /v1/patients/{id}/risk?as_of=      level, reasons, confidence, next step, tips
POST /v1/alerts/{id}/action             {action: outreach | dismiss, reason}
POST /v1/escalations                    {patient_id, trigger: need_help | threshold}
GET  /v1/escalations?status=open        help-request inbox
POST /v1/escalations/{id}/respond       {text} → saved as the patient's plan
GET  /v1/patients/{id}/plan             doctor's recommendations for the patient page
```

Each risk response carries a `level`, up to 3 `factors` (label, contribution, source), an `uncertainty` block (confidence plus caveats) and a `next_step` that names where it came from (doctor's plan or standard tips).
