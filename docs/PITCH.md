# Deck alignment: what we built vs what the deck says

## Aligned already

| Deck says | What the demo shows |
| --- | --- |
| Live mitigation recommendation | Tips driven by the client's own answers, care-team plan first |
| Heat map for a radius | ZIP choropleth for the whole city, and the client's own map view |
| Need help button | Crisis lines first, consent, then the care team |
| Noise, air, temperature as PTSD-relevant | All three scored hourly from real NYC data |
| Mitigations: hearing protection, water, inhaler | The tip library, per trigger |
| Wearable sync as the next step | Already in, simulated and labelled, with correlations |
| Provider-facing trends to bring to a doctor | The printable client report |
| Grounding: 1-5 breathing | On the client's phone, read aloud and paced |

## Three mismatches to fix before you present

**1. The deck pitches a consumer app; the challenge asks for the opposite.** The DOHMH brief says: build for integration into existing provider systems, not a standalone app, and keep clinicians responsible for outreach. We built exactly that, plus the client side. So lead with the care-team inbox and the EHR card, then show the client's phone as the other half of the loop. A veteran is still the human story: R.M. in Long Island City is one.

**2. The deck contradicts the demo on crisis.** The Q&A says "Nervana is not a crisis-detection system", but the demo now includes an automatic escalation ladder. Both can be true if you say it precisely:

> We do not detect crises and we do not score crisis probability. We detect unusual *environmental exposure* against a person's own baseline. When that is extreme and nobody has responded, the system escalates to humans: the care team, then the on-call clinician, then 988, which is staffed by counsellors. It never dials 911, because a false positive there sends police to someone in a mental-health crisis. Any human response, including the client's own, stops it.

**3. Unverified statistics.** Drop "deployed veterans have 55% higher chance of asthma" unless you can source it on the slide. Use the numbers we pulled and can defend:

- 6,686 noise and fireworks complaints on the evening of July 4 2023, against about 1,800 on an ordinary Friday.
- PM2.5 at 160 µg/m³ at 11 PM, roughly 14 times the July median.
- Mental-health ED visits run 8% higher on extreme-heat days (Nori-Sarma 2022, JAMA Psychiatry).
- New York's threshold is a daily mean of 80.7°F (Yoo 2021).
- After Hurricane Sandy, probable PTSD was 11.3% in flooded zones against 4.4% elsewhere, and 28.8% among people with prior 9/11-related PTSD.

Also: the deck still says "Lovable frontend". It is a React app in the repo now.

## The AI question, answered honestly

The rubric gives 4 points for AI **and** data. Our data half is strong: five public sources, pulled and tested. The AI half is thin on purpose, so say why rather than overclaim:

> The risk logic is deliberately rule-based, because there are no labelled outcomes linking one person's PTSD episode to one hour of noise, and because a clinician has to be able to argue with the reasoning. We used AI to build this, and the place a language model earns its keep is drafting the outreach note and translating it, with the clinician approving before it sends. That is scoped and not yet shipped.

Do not claim a model is in the product. It is not.

## What to say per rubric line

| Area | The line |
| --- | --- |
| **Impact (5)** | "Nobody is flagged at 3 PM. Twenty-three are at 9 PM. The team called the ones who needed it before the worst hours, which is the whole point: before, not after." |
| **Team (4)** | Name the disciplines out loud and say who reviewed the clinical wording. |
| **AI + Data (4)** | "Five public sources, pulled and tested today, not a mock: 311, EPA monitors, NOAA, Open-Meteo, the Heat Vulnerability Index. Rules where rules are right, language models where language is the problem." |
| **Innovation (3)** | "Noise as a PTSD trigger is not in any climate-health framework we found. On July 4 the fireworks and the smoke arrive in the same hour." |
| **Feasibility (3)** | "It is an API with a CDS Hooks card and a FHIR record. No new app to log into, every data source free, clinician decides." |
| **Scalability (3)** | "The engine is the same; triggers are modules. Every US city has 311, EPA and NOAA." |
| **Bonus: sustainability** | "No model training, no GPUs. Hourly pulls from public APIs and a rules engine that runs on one small server." |
| **Bonus: measurement** | "Dismiss reasons are captured on every alert, so false-alarm rate is a metric from day one, alongside outreach completed and, later, ED visits." |
| **Bonus: ethics** | "Crisis lines before anything automated, consent before any sharing, clinicians write the plans, a full audit trail, and a hard stop before emergency services." |

## Questions we should expect, beyond your list

- **"Where are the veteran-specific datasets?"** Not used yet. The VA facilities API and HUD-VASH are the obvious next connections for referral; the Veterans Crisis Line already appears in the product as 988, press 1.
- **"Is this the DOHMH dataset?"** No. The roster is synthetic, read through one function, so swapping it is a small change. The conditions data is real.
- **"Three-month trends?"** Not built. The pipeline can run any window; today it runs 24 hours. Say roadmap, not shipped.
