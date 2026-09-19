# Demo walkthrough (about 3 minutes)

Replay: **July 4, 2023**, the loudest night of the five we compared. Set the time picker to **9 PM**. Two browser windows side by side — left the care team, right the client's phone (`/me/SYN-0142`) — make the loop land.

**Before you start:** `POST /v1/demo/reset` clears earlier clicks, or press **Reset** in the top bar when running on sample data.

| # | Screen | What to do | What to say |
| --- | --- | --- | --- |
| 1 | Map | Open **Map**, 9 PM | "Fireworks complaints are 8 to 30 times a usual night across the city, and EPA monitors read 128 µg/m³ of fine particles — about ten times normal. Outlined ZIPs are where clients we serve live." |
| 2 | Map | Switch the time picker to 3 PM, then back to 9 PM | "Same day, six hours earlier: nothing. This is an event, not a background score." |
| 3 | Inbox | Open **Inbox** | "100 clients with PTSD are flagged citywide, 23 to act on. They sit across 52 care teams, so one team sees a handful." |
| 4 | Inbox | Pick **LIC ACT Team 2** in the care-team filter | "This team has one person tonight: R.M." |
| 5 | Patient detail | Click R.M. | "Why, not just a score: 6 complaints in their ZIP, 3.2× usual; fine particles at 128; and a crisis visit in the last 30 days. Each with its weight and its source." |
| 6 | Patient detail | Point at the confidence badge and caveats | "The alert says how sure it is. Low, because their contact details are over a year old and the exposure is ZIP-level, not their block. And it says what we don't have: no pharmacy data." |
| 7 | Patient detail | Click **Log outreach** | "One alert for the whole event, so they aren't pinged again at 10, 11 and midnight." |
| 8 | Client phone | On the right window, tap **I need help** | "This is the client's side. Crisis lines come first — 988, press 1 for veterans — before anything else happens." |
| 9 | Client phone | Tick consent, add a note, send | "Nothing reaches the care team without the client agreeing to it." |
| 10 | Help requests | Back on the left, open **Help requests** | "The team gets a bundle, not a ping: what they pressed, why they may be struggling, the last 24 hours nearby, the tips they already saw, and what we don't know." |
| 11 | Help requests | Write a reply and send | "The clinician writes the plan. The system never does." |
| 12 | Client phone | Show the plan updating | "Their doctor's words, at the top of their plan, above the standard tips." |
| 13 | Inside the EHR | Open **Inside the EHR** | "None of this needs a new app. The same alert is a CDS Hooks card when a chart opens, and a FHIR RiskAssessment in the record. Every action and consent is logged." |

## Numbers worth quoting

- 6,686 noise and fireworks complaints between 6 PM and 2 AM on July 4 2023, against about 1,800 on an ordinary Friday night.
- PM2.5 peaked at 160 µg/m³ at 11 PM, roughly 14× the July median of 11.5.
- Nobody is flagged before 3 PM; 23 are "act" at 9 PM, 41 at 11 PM.
- 150 synthetic clients across 52 care teams; the busiest team sees 6.

## If something breaks

- API down → the web app runs on the example data with `VITE_USE_MOCKS=true` (the top bar shows "Sample data"), and the whole loop still works.
- Map tiles won't load → the ZIP shapes are local, so the choropleth still draws; only the basemap is missing.
- Fall back to the recorded video.

## What we would say about limits

- The scoring weights are assumptions, not fitted values. Nothing here is validated against outcomes.
- Our own check against NYC EMS crisis calls was inconclusive, and we say so.
- The client roster is synthetic, a stand-in until the DOHMH dataset arrives, and the pipeline reads it through one function.
