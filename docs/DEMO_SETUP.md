# Demo setup: the exact cases and settings

Every number below is what the app shows for **July 4, 2023**. Nothing here is aspirational.

## Before you walk up

```bash
# both servers, from the repo root
cd backend  && NERVANA_LADDER_SECONDS=20 .venv/bin/uvicorn app.main:app --port 8000 &
cd frontend && VITE_USE_MOCKS=false npm run dev &
curl -X POST "http://localhost:8000/v1/demo/reset?as_of=2023-07-04T21:00:00-04:00"
```

The reset also loads the three clients' profiles, so personalisation is live from the first click.

| Setting | Value |
| --- | --- |
| Time picker | **Tue, Jul 4, 9 PM** |
| Tab 1 (care team) | `http://localhost:5173/` |
| Tab 2 (client phone), window narrowed | `http://localhost:5173/me/SYN-0142` |
| Tab 3 (handout, optional) | `docs/sample-report.pdf` |
| Voice | Client view → About you → How it sounds → pick, press **Try** |
| Ladder speed | 20 seconds per rung, set by the environment variable above |

## Case 1. It is an event, not a background score

Switch the time picker and let the map do the talking.

| Hour | Loud ZIPs (60+) | Flagged | Act now |
| --- | --- | --- | --- |
| 3 PM | 6 | 2 | 0 |
| **9 PM** | **110** | **101** | **23** |
| 11 PM | 123 | 111 | 41 |

> "Six hours earlier, two people. At 9 PM, 101. This is an event."

## Case 2. The list is workable, because it is a team's list

101 flagged sit across **52 care teams**. Filter the inbox:

| Team | People tonight |
| --- | --- |
| Queens Clinic 2 | 5 |
| Brooklyn Clinic 5 | 5 |
| Brooklyn Community Treatment | 5 |
| **LIC ACT Team 2** | **1** |

> "Citywide it is 101. For this team it is one person, and here he is."

## Case 3. Three people, three different answers

All at 9 PM. This is the heart of the demo: same city, same hour, different meaning.

| Client | Level | Score | Confidence | Heart rate | Why it differs |
| --- | --- | --- | --- | --- | --- |
| **R.M., 34**, LIC ACT Team 2 | act | 0.99 | **low** | 87, usual 73 | Fireworks in his ZIP, crisis visit last month, and his contact details are three years old, so the alert admits it is unsure |
| **D.K., 67**, Bronx Supported Housing 2 | watch | 0.83 | **high** | 95, usual 73 | 29 complaints, 8.2 times usual, no air conditioning at home, and a well-measured ZIP |
| **J.P., 29**, Sunnyside Clinic 3 | watch | 0.80 | medium | 82, usual 65 | Fireworks in Sunnyside, but he did not share his profile, so the team sees no personal detail |

> "Same hour, same city. One to call now, one to watch closely, and one where the system respects that he said no."

## Case 4. Automatic escalation is hard to trip on purpose

Press **Run watcher** on the help requests page.

| Hour | Met the bar | Opened |
| --- | --- | --- |
| 9 PM | 3 | 3 |
| 11 PM | 0 | 0 |

> "At the loudest hour of the night, nobody met the bar. It needs the score, the wearable and the conditions all extreme at once."

Then let the ladder climb while you talk: care team, on-call clinician, 988. Press **Stop the ladder**, or show the client's own "I'm OK, stop this" on the phone.

## Case 5. The client's own map

Client view → **Going out** → search "Astoria Park" → **Check the walk**.

- The shading under the route is how loud each area is right now.
- 5.3 km, about 65 minutes, passing 11101 → 11106 → 11102, loudest 11102 at 100.
- The honest answer: no calmer route exists tonight, and it gets louder from here, so go now rather than later.

## Numbers to quote from the data, not the slide

- 6,686 noise and fireworks complaints between 6 PM and 2 AM, against about 1,800 on an ordinary Friday.
- PM2.5 peaked at 160 µg/m³ at 11 PM, about 14 times the July median of 11.5.
- Fireworks complaints ran up to 30 times a ZIP's usual level for that weekday and hour.
- 150 clients in the roster, 52 care teams, 178 ZIPs, 24 hours, one evening.

## If a judge asks to drive

Hand them the time picker. Every hour from 6 AM to 5 AM is loaded, and the story holds at any of them: quiet all day, 8 act at 8 PM, 23 at 9 PM, 41 at 11 PM, back to 1 by 4 AM.
