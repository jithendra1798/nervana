# Technical Q&A

Everything here is what the code actually does. Numbers are measured, not estimated.

## Architecture

**"What is it, technically?"**
A Python API (FastAPI) serving four JSON files that a data pipeline writes, and a React front end that is one client of that API. No database: the whole city for one day is about 2 MB of JSON, held in memory. Clinician actions live in memory and are mirrored to a small state file so a restart mid-demo loses nothing.

**"Why no database?"**
Nothing in the read path is mutable: conditions and scores are computed ahead of time per hour. The only mutable state is what clinicians and clients do, which is small. A real deployment writes that to the EHR, not to our store, so adding Postgres now would model the wrong thing.

**"How does data get in?"**
Three steps, all re-runnable: `pipelines.fetch` downloads and caches raw sources, `pipelines.exposures` turns them into hourly severity per ZIP, `pipelines.score_ptsd` turns that plus the roster into per-person risk. Fetch takes about 47 seconds for the whole day, the build about 40 seconds, producing 4,248 exposure rows (177 ZIPs × 24 hours) and risk for 150 clients.

## The data

**"Where does noise come from, exactly?"**
NYC 311 (`erm2-nwe9`), aggregated in the query rather than downloaded raw. We count complaints per ZIP per hour and compare them with that ZIP's own average for the same weekday and hour across the previous twelve months, one query per month, about 2.7 seconds each. Complaint types are weighted: fireworks and helicopter at 1.0, DEP construction 0.7, street and vehicle 0.5, residential 0.4, commercial 0.3. Severity is `log2(ratio) / 3`, so eight times a normal night reads as 1.0, over a trailing two-hour window.

**"Why not the noise dataset the organisers linked?"**
That view filters to complaint types beginning "Noise", which excludes `Illegal Fireworks`, the single largest category on July 4 (3,376 complaints citywide in one evening). We query the full 311 dataset and filter ourselves.

**"Air quality?"**
EPA AQS hourly PM2.5 (parameter 88101), five monitors inside the five boroughs for 2023. Each ZIP takes its nearest monitor with a reading that hour, by haversine distance, and the distance is printed in the caveats. Severity follows EPA's bands: 35.4 µg/m³ maps to 0.4, 55.4 to 0.6, 125.4 to 0.85, 225.4 to 1.0.

**"Why not a modelled air-quality API? It is easier."**
We tested one. For July 4 2023 it reported a peak of 47.5 µg/m³ where the monitors measured 160.4, and for the June 2023 wildfire smoke it reported 99.9 against 412. Modelled air quality smooths away exactly the events we care about, so the replay uses observed data and live mode would label modelled values low confidence.

**"Heat?"**
Hourly feels-like temperature from Open-Meteo's historical archive at one point per borough, with NOAA's Central Park daily summary as the check. Severity runs from 80.7°F to 100°F. It counts full weight on days whose daily mean passes 80.7°F, the threshold from Yoo 2021 for New York, and half weight otherwise, because that threshold is a population-level daily measure while a person without air conditioning is still exposed on a hot afternoon. That split is our assumption and is documented as one.

**"How accurate is the geography?"**
ZIP level, using the 178 MODZCTA areas, which is the geography the clinical dataset provides. We never imply more, including on the route screen.

## The model

**"Walk me through the score."**

```
score = Σ_trigger  weight × severity × (1 + general vulnerability + trigger vulnerability)
```

Trigger weights: noise 0.55, heat 0.30, air 0.25. General multipliers: crisis visit in the last 30 days +0.35, ACT client +0.20, substance use disorder +0.10. Trigger-specific: veteran +0.25 on noise, supported housing +0.30, age 65+ +0.20 and high heat-vulnerability ZIP +0.20 on heat, age 65+ +0.15 on air. Levels: act at 0.85 **and** at least one trigger at 0.4 severity, watch at 0.60.

**"Why multiplicative rather than additive?"**
Because the environment should set the level and a person's history should only amplify it. Additively, someone with a heavy history scores high on a quiet Tuesday, which is how you flood an inbox with people nothing has changed for. Multiplicatively, a quiet night scores near zero for everyone: on July 4, nobody is flagged before 3 PM.

**"How do you explain a flag?"**
Each term is reported as its own factor with its contribution and its source, and the contributions sum to the score. The top three are shown. That is a property of the arithmetic, not a narrative generated afterwards.

**"Why rules instead of machine learning?"**
There are no labelled outcomes linking an individual's PTSD episode to an hour of noise. Anything learned would be fitted to a proxy, and a clinician could not argue with it. The rules are also what make the explanation and the uncertainty honest. If a partner brings outcome data, the same interface takes a fitted model behind it.

**"Where does confidence come from?"**
It starts at medium, loses a step if contact details are more than a year old, loses another if the flag rests on fewer than five complaints, and gains one when the noise signal is strong and the contact details are fresh. The caveats are generated from the same facts, so the badge and the text can never disagree.

## Alert fatigue

**"What stops this becoming another alert firehose?"**
Four things, all in the code. One alert per episode, not per hour: the alert id is keyed to the first hour of an unbroken flagged run, so a client flagged from 8 PM to 2 AM produces one alert that stays handled once actioned. Act is separated from watch and sorted first. The inbox filters to a care team, which turns 101 citywide into one to five per team. And dismissals capture a structured reason, so false-alarm rate is measurable from day one.

## The automatic escalation

**"How does the watcher decide?"**
Three conditions at once: score at or above 0.95, simulated heart rate at least 22 above that person's own baseline, and at least one trigger at 0.9 severity where they are. It opens at most three per run and skips anyone a clinician has already acted on. At 9 PM on July 4 three people met the bar; at 11 PM, the loudest hour, none did.

**"And then?"**
An open request climbs on the clock: care team, then on-call clinician, then the 988 crisis line, twenty seconds per rung in the demo and minutes in a deployment. Every rung writes a record marked mock with the script that would be read, plus an audit entry. Any reply, a clinician pressing stop, or the client's own "I'm OK" ends it. **It never dials 911**, deliberately: on a false positive that sends police to someone in a mental-health crisis.

## Vitals

**"Is the wearable real?"**
No, and every screen says so. The hackathon dataset has no wearable. Each client gets a stable baseline from a hash of their id, and the signal responds to the same conditions the score uses: heart rate rises with noise and heat, variability falls, sleep gets restless on loud nights. The correlation shown is a Pearson coefficient between heart rate and each trigger across the day, and we label one day of correlation as a hint rather than evidence.

**"What would the real version be?"**
Apple HealthKit or Google Health Connect, with the client connecting their own device. The interface is the same shape: a series plus a baseline.

## Routing

**"How does the calmer route work?"**
The public OSRM service returns the geometry. We sample it every 150 metres, map each sample to a ZIP by point-in-polygon with a bounding-box prefilter, and score the walk by both the average and the worst patch it crosses, weighted 0.6 and 0.4. Detour candidates are calm ZIPs beside the worst patch, and a detour is only recommended when it improves the score by at least 0.08 and adds no more than ten minutes or 35% of the walk.

**"Does it actually find calmer routes?"**
On a citywide fireworks night, usually not, and the app says so rather than inventing one. What the data does support is timing: the same walk scores 66 of 100 at 9 PM and 15 by 4 AM, so it answers "when to go" instead. Detours matter for localised events, which is why the logic stays.

**"Walking times?"**
Computed from distance at 1.35 m/s, because the public routing server answers with driving times for foot profiles. That was a bug we found and fixed rather than shipped.

## Integration

**"How does this reach a clinician who does not use your app?"**
Two standard shapes, both live. `GET /fhir/RiskAssessment` returns an R4 resource with the qualitative risk, the factors as `basis`, and the caveats and next step as notes. `POST /cds-services/nervana-climate-ptsd` answers the CDS Hooks `patient-view` hook with a card carrying the summary, the reasons, the next step, override reasons and a link. In an EHR the card appears when the chart opens; our web app is a reference client.

**"What about an in-basket message?"**
Same payload, different channel. The notification layer is an interface with one implementation today.

## Privacy, security, safety

**"What personal data do you hold?"**
None that is real. The roster is synthetic. In deployment the clinical fields stay in the provider's system and we hold exposure and scoring. The client's own profile is opt-in, and the care team only sees it if they tick the share box. J.P. in the demo has not, and his clinician's screen shows nothing extra.

**"Consent?"**
Enforced in the API, not just the UI: posting a help request without `consent: true` returns 400. Every action, consent and reply is written to an audit log that the EHR screen displays.

**"Does anything leave the device that should not?"**
The spoken advice uses the browser's own voice, so no audio and no text leave the phone. There is no analytics, no third-party tracking, and no API keys in the client.

## Operations

**"What does it cost to run?"**
Every source is free and keyless. The work is one hourly job and a rules engine; there is no model training and no GPU. The whole city for a day is about 2 MB of JSON, so a small instance runs it.

**"How fast is it?"**
Alerts and map responses are in-memory lookups. The route endpoint takes about 1.8 seconds because it makes up to seven routing calls. The front end builds in under 200 ms and ships 249 KB gzipped.

**"What happens when something is down?"**
The web app runs entirely on bundled sample data with one environment variable, and the top bar says "Sample data" so nobody is misled. ZIP shapes are local, so the map still draws without tiles. The routing service failing returns a clear message rather than a spinner.

**"How would you swap in the DOHMH dataset?"**
One function. `build_roster` produces `patients.json` with the fields in `contracts/README.md`; replacing its body with a loader for the real file is the whole change. Everything downstream reads the contract, not the source.

**"How is this tested?"**
A script drives the entire demo in a real browser and asserts twenty things: the map draws 178 ZIPs, the inbox shows the right count, the team filter narrows, vitals and caveats render, outreach logs, crisis lines appear first, consent gates the send, the bundle carries vitals, the reply reaches the client's phone, the report renders, and the EHR card and audit trail appear. It passes with no console errors.

**"How would you validate the model itself?"**
A distributed-lag model against DOHMH syndromic ED data, matching on season and weekday, which is the method the published studies use. Our own quick check against EMS crisis calls was inconclusive, and we report that rather than bury it.
