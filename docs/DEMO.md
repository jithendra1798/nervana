# Nervana: how to demo it

Replay day: **July 4, 2023**, the loudest night in the five we compared. Set the time picker to **9 PM** before you start.

## The 30 seconds before you touch anything

> New Yorkers with PTSD are invisible in climate-risk planning. On July 4, 2023, fireworks complaints ran up to thirty times a normal night and fine-particle pollution hit fourteen times the July median, in the same hours. For someone whose startle response is a symptom, that is not a nuisance, it is a trigger.
>
> Nervana reads the conditions New York already publishes, matches them against the clients a care team already has, and tells the team who to call before the evening gets worse. It runs inside the systems they already use.

## Why it matters

| Point | The number |
| --- | --- |
| The night is real, not a scenario we invented | 6,686 noise and fireworks complaints between 6 PM and 2 AM, against about 1,800 on an ordinary Friday |
| The trigger and the smoke arrive together | PM2.5 peaked at 160 µg/m³ at 11 PM, about 14 times the July median of 11.5 |
| It is an event, not a background score | Nobody is flagged before 3 PM; 23 are "act" at 9 PM; 41 by 11 PM |
| A team can actually work the list | 100 flagged citywide sit across 52 care teams, so the busiest team sees 6 |
| The evidence is real where it exists | Mental-health ED visits run 8% higher on extreme-heat days (Nori-Sarma 2022); New York's threshold is a daily mean of 80.7°F (Yoo 2021) |

## How it works, in four steps

1. **Read the city.** Hourly, per ZIP: 311 noise and fireworks complaints compared with that ZIP's own normal for the same weekday and hour over the past year; EPA monitor PM2.5; feels-like temperature from NOAA and Open-Meteo; the Heat Vulnerability Index.
2. **Match it to people.** The clinical record supplies who has PTSD, which program they are in, recent crisis contact, and housing. The environment sets the level and the person's history only multiplies it, which is why nobody is flagged on a quiet night.
3. **Explain and act.** Every flag carries its factors with weights and sources, a confidence badge with what we do not know, and one next step. One alert per event, not per hour.
4. **Land it where they work.** The same alert is a CDS Hooks card when a chart opens and a FHIR RiskAssessment in the record. The web app is a reference client, not the product.

**The rails:** crisis lines before anything automated, consent before anything is shared, clinicians write the plans, an audit trail behind every action, and **911 is never dialled automatically**.

## The cast

| Who | Story |
| --- | --- |
| **R.M., 34**, ACT team, Long Island City | Veteran. Fireworks and sirens are his named triggers. Crisis visit in the last month. Contact details are three years old, so the alert says its confidence is low. |
| **D.K., 67**, supported housing, Bronx | No air conditioning at home. Told us heat and sirens are hard. High confidence: her ZIP is loud tonight and well measured. |
| **J.P., 29**, outpatient clinic, Sunnyside | Veteran who has not shared his profile with the team. Shows what happens when consent is withheld: advice for him, nothing extra for them. |

## The script, about three minutes

Two windows side by side: care team on the left, a client's phone on the right (`/me/SYN-0142`).
**Before you start:** press **Reset** in the top bar, or `POST /v1/demo/reset`.

| # | Screen | Do | Say |
| --- | --- | --- | --- |
| 1 | Map | Open **Map** at 9 PM | "Every ZIP in the city, right now. Darker is worse. The outlined ones are where clients we serve live." |
| 2 | Map | Switch to 3 PM, then back to 9 PM | "Six hours earlier, nothing. This is an event, not a background score." |
| 3 | Inbox | Open **Inbox** | "100 clients flagged, 23 to act on, across 52 teams." |
| 4 | Inbox | Filter to **LIC ACT Team 2** | "One person for this team tonight. That is the difference between an alert system and a usable one." |
| 5 | Detail | Click **R.M.** | "Why, not a score: 6 complaints in his ZIP, 3.2 times usual, mostly fireworks; fine particles at 128; a crisis visit last month. Each with its weight and its source." |
| 6 | Detail | Point at confidence and caveats | "It says how sure it is. Low, because his contact details are three years old. And it says what we do not have: no pharmacy data." |
| 7 | Detail | Scroll to **Vitals** | "Heart rate 87 against his own usual 73, variability down, sleep restless. It tracks noise today at 0.77. The wearable is simulated and labelled: the dataset has none, and in production he connects his own." |
| 8 | Detail | **Log outreach** | "One alert for the whole event, so he is not flagged again at 10, 11 and midnight." |
| 8b | Phone | Open **Going out**, search a destination, **Check the walk** | "His own map: the shading is how loud each area is right now, the blue line is the walk, and the card underneath says what it runs through and whether waiting helps. Same data as the care team's map, in the form anyone already knows how to read." |
| 9 | Phone | Tap **Breathe with me** | "Reading is hard mid-flashback, so it reads the grounding exercise aloud, paced. The phone's own voice: no network, nothing leaves the device." |
| 10 | Phone | Tap **I need help** | "Crisis lines first, always: 988, press 1 for veterans. Then, and only with his consent, the care team." |
| 11 | Phone | Tick consent, add a note, **Send** | "Nothing reaches the team unless he agrees." |
| 12 | Help requests | Open the request | "The team gets a bundle, not a ping: why, his vitals against his own baseline, the conditions on the same hours, what he has already been told, and what we do not know." |
| 13 | Help requests | Reply and send | "The clinician writes the plan. The system never does." |
| 14 | Phone | Show the plan update, tap **Listen** | "His doctor's words, at the top of his plan, read aloud if he wants." |
| 15 | Help requests | **Run watcher**, open the new request | "Nobody pressed anything here. It opened by itself because score, wearable and conditions were all extreme at once. Care team, then on-call, then 988, which is staffed by counsellors. **It never dials 911**: on a false positive that sends police to someone in a mental-health crisis. A reply, or his own 'I am OK', stops it." |
| 16 | Detail | Click **Report** | "One page for the chart or a case conference, with sources and method. Prints or saves as a PDF." |
| 17 | Inside the EHR | Open it | "No new app to log into. The same alert as a CDS Hooks card when the chart opens, and a FHIR record. Every action and consent logged." |

Close on: *"Tonight it is fireworks. The same engine already carries heat, air quality and storms, and the next triggers are modules, not rewrites."*

## Answers to the questions you will get

- **"Does this work?"** The scoring weights are assumptions, not fitted values, and we say so on every screen. Our own check against NYC EMS crisis calls was inconclusive, and we report that rather than hide it. The validation plan is a distributed-lag model against DOHMH syndromic ED data.
- **"Is the data real?"** The conditions are: 311, EPA monitors, NOAA, Open-Meteo and the Heat Vulnerability Index, all pulled and tested. The client roster is synthetic, a stand-in for the DOHMH dataset, read through one function so swapping it is a small change. The wearable is simulated and labelled everywhere.
- **"Why not machine learning?"** There are no labelled outcomes linking an individual's PTSD episode to an hour of noise. A transparent rule set a clinician can argue with beats a black box nobody can check, and it is what makes the explanation possible.
- **"Why ZIP level?"** That is the geography the dataset provides, and we never imply more precision, including on the route screen.
- **"What does it cost to run?"** Every data source is free and public. Other cities have 311 equivalents, and EPA and NOAA are nationwide.

## Rehearse it

`docs/rehearse_demo.py` walks the whole script in a browser and checks 20 things (needs the API and web app running, plus `playwright`). Run it once before pitching.

## If something breaks

- API down: run the web app with `VITE_USE_MOCKS=true` and the whole loop still works on the bundled sample data ("Sample data" shows in the top bar).
- Map tiles will not load: the ZIP shapes are local, so the map still draws; only the basemap is missing.
- Address search fails: tap the map instead, it does the same thing.
- Otherwise: play the recorded video.

## What we say about limits, without being asked

- The weights are assumptions; nothing is validated against outcomes yet.
- The roster is synthetic, the wearable is simulated, and the automated calls are mocked.
- Exposure is ZIP-level, so routes avoid bad areas, not bad streets.
- 311 complaints lag and reflect who complains, which is why we compare each ZIP against itself rather than against other neighborhoods.
