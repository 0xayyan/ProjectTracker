# Pitch Deck Content — ProjectWatch (SIH26103)

Slide-by-slide content only — design, colors, and layout are up to you. Standard SIH
finale format runs 8-10 slides; trim/merge if your slot is shorter.

---

## Slide 1 — Title

- **ProjectWatch: AI-Enabled Project Monitoring & Early-Warning Platform**
- Problem Statement: SIH26103 | Organization: MoSPI | Theme: Smart Automation
- Team name, team ID, members (add your own)

---

## Slide 2 — The Problem

- MoSPI's PAIMANA portal already tracks ~1,981 central infrastructure projects
  (>₹150 crore each) across 17 ministries and 22 sectors.
- It is **descriptive**: it reports cost/time overruns only *after* they've already
  happened.
- Result: decision-makers find out about a problem project when it's too late to
  cheaply course-correct.
- **The ask:** move from reporting the past to predicting the future.

---

## Slide 3 — Our Solution, in One Line

- ProjectWatch adds a **predictive early-warning layer** on top of standard project
  tracking — it tells you *which* projects are heading for a cost or schedule overrun,
  *how likely*, and *why*, while there's still time to act.

---

## Slide 4 — What It Actually Does (feature map)

Map directly to the PS's expected outcomes — this slide is your strongest "we followed
the brief closely" evidence:

- Cost & schedule overrun prediction (Random Forest, trained on PAIMANA data)
- Rule-based project risk scoring (0-100, per project)
- Early-warning alerts combining rule-based signals + AI predictions
- Department/portfolio benchmarking
- Cost-escalation driver analysis (feature importance)
- AI-powered monitoring dashboard
- Natural-language "Intelligence Assistant" for plain-English portfolio queries

---

## Slide 5 — Architecture

- Simple 3-layer diagram: React frontend → FastAPI backend (auth, risk engine,
  assistant) → PostgreSQL, with the trained ML models loaded by the backend.
- Call out: **open-source stack only** (React, FastAPI, PostgreSQL, scikit-learn) —
  directly matches the PS's "Open-Source Tools/Software" guidance.
- Call out: assistant needs no external LLM API key — works fully offline/self-hosted.

---

## Slide 6 — The ML Approach & Why It's Trustworthy

- Trained on the actual March 2026 PAIMANA snapshot, not synthetic data.
- We didn't just build a model — we **benchmarked it**: Logistic Regression baseline
  vs. Random Forest, same train/test split, same metrics, shown side-by-side in the
  app's Analytics page.
- This directly answers the PS's own question: "does AI/ML actually beat conventional
  statistical methods here, or not?" — we show our work instead of asserting it.
- State your honest headline numbers here (accuracy/precision/recall or whatever your
  `model_comparison.py` output shows) — judges respect honest numbers over vague claims.

---

## Slide 7 — Live Demo (script, not slide content)

Suggested demo flow (2-3 minutes):
1. Login → Dashboard: portfolio-level KPIs and risk distribution at a glance.
2. Projects → open one flagged project → show AI cost/schedule overrun probability
   + risk score + benchmark vs. department average.
3. Alerts → show how rule-based + AI signals combine into one prioritized list.
4. Assistant → ask "which projects are high risk?" live, get a real data-driven answer.
5. Analytics → baseline vs. ML model comparison chart.

---

## Slide 8 — Impact

- Faster identification of at-risk projects → earlier intervention → reduced final
  cost/time overruns at scale (quantify if you can, even roughly, e.g. "even a 5%
  reduction in overruns across ₹150cr+ projects represents crores in savings per project").
- Standardizes risk assessment across ministries instead of ad hoc judgment calls.
- Benchmarking surfaces which departments/sectors are systematically under-performing,
  useful for policy-level attention, not just single-project firefighting.

---

## Slide 9 — Feasibility & Roadmap

- **Feasible today:** current build already runs end-to-end on open-source tooling with
  a working ML pipeline against real data.
- **Known limitation, stated honestly:** trained on a single snapshot — a production
  version needs repeated monthly PAIMANA observations for a true longitudinal
  early-warning model (this is in your own README — reuse it here, it reads as maturity,
  not weakness).
- **Next steps:** integrate live PAIMANA data feed, extend the assistant with document/
  report generation, add automated email/SMS alerting for the highest-risk projects.

---

## Slide 10 — Thank You / Q&A

- Repo link, live demo link (if deployed), contact info.
