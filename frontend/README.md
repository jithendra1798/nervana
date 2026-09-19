# frontend/ — P1: Web app

P1 builds the screens: a care-team inbox, patient detail, a risk map, help requests, and a phone-sized patient page. Start today against the example files in [contracts/fixtures/api/](../contracts/fixtures/api/). You don't need the backend running until the 19:15 full-stack check.

## Stack and setup

React + Vite + TypeScript, react-router, react-leaflet for the map, Recharts for the chart. Use Tailwind or plain CSS, whichever is faster for you.

```
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
npm install react-router-dom leaflet react-leaflet recharts
npm run dev                                    # http://localhost:5173
```

`vite.config.ts` needs two additions:

```ts
server: {
  proxy: { "/v1": "http://localhost:8000" },   // local backend, no CORS setup needed
  fs: { allow: [".."] },                       // lets the app read ../contracts in mock mode
},
```

## Mock mode

Put every API call through `src/lib/api.ts`. The whole app then switches from fixtures to the real API with one environment variable.

```ts
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== "false";
const BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const fixtures = import.meta.glob("../../../contracts/fixtures/api/*.json", { eager: true, import: "default" });

export async function api<T>(path: string, fixture: string, init?: RequestInit): Promise<T> {
  if (USE_MOCKS) return fixtures[`../../../contracts/fixtures/api/${fixture}.json`] as T;
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}
// api<AlertList>("/v1/alerts?as_of=2025-07-04T21:00:00-04:00", "alerts")
```

Endpoints, request bodies and fixture names are listed in [contracts/README.md](../contracts/README.md#api-p3--p1). Write your TypeScript types from those.

## Tasks

About 5.5 hours of must-haves.

| # | Screen / task | Hrs | Priority |
| --- | --- | --- | --- |
| F0 | Scaffold, routes, `api.ts` with mock mode, types | 0.5 | Must, first |
| F1 | Inbox `/`: alerts for the selected time, level label (act / watch), top reason, confidence, program filter; click through to detail | 1.0 | Must |
| F2 | Patient detail `/patients/:id`: reason bars, confidence badge + caveats, next step, tips, Outreach and Dismiss (with a reason) buttons | 1.0 | Must |
| F3 | Map `/map`: load the [ZIP boundary file](https://raw.githubusercontent.com/nychealth/coronavirus-data/master/Geography-resources/MODZCTA_2010_WGS1984.geo.json) (match `MODZCTA` to `zip`), color by `band`, gray when there's no data, open on Long Island City | 1.0 | Must |
| F4 | Help requests `/help-requests`: open requests, the doctor bundle, a reply box that saves to the patient's plan | 0.75 | Must |
| F5 | Patient page `/me/:id` (phone-sized): **I need help** first shows "Call or text 988 (press 1 for the Veterans Crisis Line) · Emergency 911", then a consent checkbox that sends the request; below that, the patient's plan | 0.75 | Must |
| F6 | Mocks off: run against the local backend, loading and error states, time picker from `/v1/scenario` | 0.5 | Must |
| S1 | 24-hour conditions chart on patient detail (`timeline`) | 0.5 | Should |
| S2 | Map toggle: composite / noise / air / heat | 0.25 | Should |
| S3 | Hour slider that replays the 24-hour window on the map | 0.5 | Should |

Show levels as text as well as color (act = red, watch = amber), so they read without color. Always show the confidence badge beside the score. Clinicians should see how sure the system is before they act.

## Handoffs

| When | What | From |
| --- | --- | --- |
| Now | API fixtures | Already in `contracts/fixtures/api/` |
| Sat 17:15 | Demo patient ID and replay day | P2 (Slack) |
| Sat 17:15 | Local backend answering every endpoint with fixtures | P3 |
| Sat 19:15 | Full-stack check with the backend on real data | P3 |

## Pushing

- Push after each major change (a screen works, navigation changes) and post one line in Slack.
- Need a field the API doesn't have? Ask P3; P3 adds it to [contracts/](../contracts/README.md). Don't edit the fixtures to invent it.
- Only edit `frontend/`, and run `git pull --rebase` before you push.
