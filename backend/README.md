# backend/ — P3: API, workflow and deploy

P3 builds the API. It serves P2's data files, adds what to do about each alert (next step, tips, the doctor's plan), and runs the clinician workflow (alert actions, help requests). The endpoints and response shapes are in [contracts/README.md](../contracts/README.md#api-p3--p1).

## Layout

```
backend/
  app/
    main.py          FastAPI app, CORS, routes
    models.py        Pydantic models matching contracts/README.md
    store.py         loads data/out/<scenario>/*.json; falls back to contracts/fixtures/data/
    recommend.py     next step + tips; care-team plan items come first
    workflow.py      alert actions, help requests, plans, activity log (in memory)
    tips.json        standard tips by trigger
  requirements.txt   fastapi, uvicorn[standard], pydantic
```

## Setup and run

```
cd backend
python -m venv .venv && source .venv/bin/activate
pip install fastapi "uvicorn[standard]" pydantic && pip freeze > requirements.txt
uvicorn app.main:app --reload --port 8000        # API docs at http://localhost:8000/docs
```

Environment variables (put secrets in `.env`, which is gitignored):

| Variable | Default | Meaning |
| --- | --- | --- |
| `NERVANA_DATA_DIR` | `../data/out` | Where P2's files live |
| `NERVANA_SCENARIO` | `demo` | Which `out/<scenario>/` folder to serve |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Frontend URLs allowed to call the API (CORS) |

## Tasks

About 4.75 hours of must-haves. The spare time goes to the Should list and to helping with integration.

| # | Task | Hrs | Priority |
| --- | --- | --- | --- |
| B1 | FastAPI app where every endpoint returns its fixture from `contracts/fixtures/api/`. Push it; P1 can then use a real server straight away. | 0.75 | Must, first |
| B2 | Load `data/out/<scenario>/` and compute map, alerts and patient risk for any `as_of` (rounded down to the hour) | 1.0 | Must |
| B3 | `recommend.py` + `tips.json`: a next step per level and trigger, tips per trigger, care-team plan items first. Ask a clinician teammate to check the wording. | 0.5 | Must |
| B4 | Workflow: alert actions (outreach / dismiss with a reason), help requests (consent required → doctor bundle → open), clinician reply → added to the patient's plan, activity log | 1.25 | Must |
| B5 | Deploy: backend on Render, frontend on Vercel (see below) | 0.75 | Must, by Sun 10:00 |
| V1 | Record the backup demo video (Sun 11:30) | 0.5 | Must |
| S1 | FHIR RiskAssessment output + a CDS Hooks `patient-view` alert card. This is the strongest answer to the brief's "not a standalone app". | 1.25 | Should |
| S2 | Claude (`claude-sonnet-5`) summary and outreach script built only from the computed reasons; generate the demo versions ahead of time | 1.0 | Should |

## Deploy

- **Render (backend):** new Web Service from this repo. Leave Root Directory empty so the service can still read `data/out/`.
  - Build command: `pip install -r backend/requirements.txt`
  - Start command: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
  - Set `ALLOWED_ORIGINS` to the Vercel URL.
- **Vercel (frontend):** set Root Directory to `frontend` and keep "include files outside the root directory" on, because the frontend imports `contracts/`. Set `VITE_API_BASE_URL` to the Render URL and `VITE_USE_MOCKS=false`.

State is kept in memory, so it resets when Render restarts. That's fine for the demo; re-run the demo steps after any redeploy.

## Handoffs

| When | What | To |
| --- | --- | --- |
| Sat 17:15 | Every endpoint answers with its fixture | P1 |
| Sat 19:15 | API on P2's real data, running locally for the full-stack check | P1 |
| Sun 10:00 | Public URLs for the API and the frontend | All |

## Pushing

- Push after each major change (an endpoint works, the workflow changes) and post one line in Slack.
- Changing a response shape or adding an endpoint? Update [contracts/](../contracts/README.md) and its fixture in the same commit.
- Only edit `backend/`, and run `git pull --rebase` before you push.
