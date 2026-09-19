# nervana
Health in Climate AI Hackathon NYC

Climate-triggered PTSD risk alerts for care teams.

| Folder | What | Owner |
| --- | --- | --- |
| [frontend/](frontend/README.md) | React web app | P1 |
| [data/](data/README.md) | Data pipelines + risk scoring | P2 |
| [backend/](backend/README.md) | FastAPI API + clinician workflow | P3 |
| [contracts/](contracts/README.md) | Shared data and API shapes, example files | All |

Plan, timeline and working rules: [docs/WORK_SPLIT.md](docs/WORK_SPLIT.md) · Demo walkthrough: [docs/DEMO.md](docs/DEMO.md)

## Run it

```bash
# 1. data (already built into data/out/july4-2023; rebuild with real sources)
cd data && python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m pipelines.fetch --scenario july4-2023   # ~1 min, cached in data/raw
.venv/bin/python -m pipelines.build --scenario july4-2023

# 2. API
cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000                  # docs at /docs

# 3. web app
cd frontend && npm install
VITE_USE_MOCKS=false npm run dev                            # http://localhost:5173
```

Without step 1 or 2 the web app still runs on the example data in `contracts/fixtures` (`npm run dev`).
