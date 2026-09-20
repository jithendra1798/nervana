# Cheat sheet: short answers

**How did you get the data?**
Public APIs, pulled and cached this weekend: NYC 311 for noise complaints, EPA monitors for fine particles, NOAA and Open-Meteo for temperature, the city's Heat Vulnerability Index, ZIP boundaries. No keys, no scraping. The client list is synthetic until the DOHMH one arrives.

**How does it predict recommendations from the data?**
It does not predict, it matches. Which trigger is high near you, times what the record says about you, times what you told us helps, gives a next step from a clinician-reviewed list. A care team's own plan always wins.

**What kind of data are you collecting?**
From the city: hourly noise, particles, feels-like temperature per ZIP. From the record: PTSD diagnosis, program, recent crisis contact, housing, ZIP, how old the contact details are. From the client, opt-in: triggers, what helps, air conditioning at home, who they call. No location tracking, ZIP only, unless they tap "use my location" for a walk.

**How are you predicting the weather?**
We are not. We read conditions that already happened, hour by hour. Live mode would use the National Weather Service forecast, marked as less certain than measurements.

**How accurate is the data?**
Measured, but coarse. Air comes from five monitors citywide, so we show the distance to the nearest. Noise is complaints, not decibels, so it lags and reflects who complains, which is why each ZIP is compared against itself. Everything is ZIP-level, never street-level. Every alert prints these limits.

**What if the recommendation is wrong?**
A clinician overrides it in one click with a reason, and those reasons are counted, so false-alarm rate is a metric from day one. Nothing acts alone: no medication changes, no clinical decisions, never a 911 call. Worst case is a wasted phone call.

**Why rules, not AI?**
No labelled data links one person's episode to one hour of noise, and a clinician has to be able to argue with the reasoning.

**Why won't this spam clinicians?**
One alert per event, not per hour. Act separated from watch. Filtered to one team, which turns 101 citywide into one person for this team.

**What is real and what is not?**
Conditions real. Client list synthetic. Wearable simulated. Calls mocked. Every screen says which.

**How does it reach clinicians?**
A card in the chart and a record in the EHR, through the standards those systems already speak.

Longer versions: [TECH_QA.md](TECH_QA.md). Deck alignment: [PITCH.md](PITCH.md). Demo settings: [DEMO_SETUP.md](DEMO_SETUP.md).
