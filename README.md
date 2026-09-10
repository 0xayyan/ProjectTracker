# ProjectWatch — AI-Enabled Project Monitoring Platform

**Smart India Hackathon 2026 — Problem Statement SIH26103**
**Organization:** Ministry of Statistics and Programme Implementation (MoSPI)
**Theme:** Smart Automation

## Problem Statement

MoSPI's existing project-monitoring system (PAIMANA) tracks ~1,981 central infrastructure
projects above ₹150 crore across 17 ministries and 22 sectors, but it is **descriptive** —
it reports cost and time overruns only after they occur. PS26103 asks for a **predictive and
prescriptive** layer on top of this: a system that forecasts cost overruns, schedule overruns,
and overall project risk *before* they happen, using historical and ongoing project data.

## What this project does

| PS26103 Expected Outcome | Where it lives |
|---|---|
| Cost Overrun Prediction Model | Random Forest model, `backend/ml/` — trained on the March 2026 PAIMANA snapshot |
| Time Overrun Prediction Model | Same pipeline, schedule-overrun target — `backend/ml/predictor.py` |
| Project Risk Scoring Framework | Rule-based risk engine — `frontend/src/utils/risk.js` (mirrored in `backend/analytics_utils.py`) |
| Early Warning Alert System | Alerts page — combines risk score, AI predictions, budget & schedule warnings per project |
| Benchmarking / Comparative Analytics | `GET /projects/{id}/benchmark` — project vs. department vs. portfolio |
| Cost Escalation Driver Analysis | Analytics page — feature-importance breakdown from the trained model |
| AI-Powered Monitoring Dashboard | Dashboard page — portfolio KPIs, risk distribution, budget health |
| LLM-Enabled Project Intelligence Assistant | Assistant page — natural-language Q&A over the live risk engine and models (`backend/assistant.py`) |
| Documentation & Deployment Framework | This README, `.env.example` files, `docker-compose.yml` |

Statistical baseline (Logistic Regression) vs. machine learning (Random Forest) model
performance is directly compared on the Analytics page, addressing the PS's requirement to
assess whether AI/ML techniques provide a meaningful gain over conventional methods.

## Tech stack

- **Frontend:** React (Vite), plain CSS with a custom design token system
- **Backend:** FastAPI (Python), JWT auth, role-based access (admin / officer)
- **Database:** PostgreSQL via SQLAlchemy
- **ML:** scikit-learn (Random Forest + Logistic Regression baseline), pandas, joblib
- **Data source:** March 2026 PAIMANA project snapshot (offline training source)

## Architecture

```
┌──────────────┐      HTTPS/JSON      ┌──────────────────┐      SQLAlchemy      ┌────────────┐
│  React (Vite)│  <----------------->  │   FastAPI backend │  <---------------->  │ PostgreSQL │
│  frontend    │                      │  (auth, CRUD,     │                      │            │
└──────────────┘                      │   risk engine,    │                      └────────────┘
                                       │   assistant)      │
                                       └────────┬──────────┘
                                                │ loads at startup
                                       ┌────────▼──────────┐
                                       │  Trained models    │
                                       │  (joblib) — cost & │
                                       │  schedule overrun  │
                                       └────────────────────┘
```

## Folder structure

```
backend/
  main.py              FastAPI app, all routes
  auth.py               JWT auth + password hashing
  database.py            SQLAlchemy engine/session
  models.py              ORM models (User, Project, Milestone)
  analytics_utils.py      Risk scoring (Python port of risk.js) + benchmarking
  assistant.py            Rule-based NL assistant over the risk engine + ML models
  seed_users.py           Creates demo admin/officer accounts
  seed_data.py            Creates sample projects (optional)
  create_tables.py        Creates DB tables from models.py
  ml/
    data_preparation.py    Builds training datasets from raw PAIMANA data
    statistical_baseline.py Logistic Regression baseline
    machine_learning_models.py Random Forest model
    model_comparison.py     Compares baseline vs. ML model
    predictor.py            Loads trained models, serves live predictions

frontend/
  src/
    pages/               Dashboard, Projects, Analytics, Alerts, Assistant, Settings, Login
    components/           Sidebar, ProjectCard, ProjectDetails, CreateProjectForm, etc.
    utils/                 risk.js, forecast.js, health.js, warning.js, costRisk.js, exportCsv.js
    services/api.js        Fetch wrapper + auth token handling
```

## Running locally (without Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then fill in DATABASE_URL and JWT_SECRET_KEY
python create_tables.py
python seed_users.py
python seed_data.py               # optional: sample projects
uvicorn main:app --reload
```

Backend runs at `http://127.0.0.1:8000` (interactive docs at `/docs`).

### Frontend

```bash
cd frontend
npm install
cp .env.example .env      # defaults to http://127.0.0.1:8000, edit if needed
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Running with Docker (one command)

```bash
cp backend/.env.example backend/.env    # fill in JWT_SECRET_KEY (DATABASE_URL is set by compose)
docker compose up --build
```

Then, once, in a second terminal:

```bash
docker compose exec backend python create_tables.py
docker compose exec backend python seed_users.py
docker compose exec backend python seed_data.py   # optional
```

Frontend: `http://localhost:5173` · Backend docs: `http://localhost:8000/docs`

This compose setup is for local demo purposes (fixed demo DB password, no TLS) — not intended
for production deployment as-is.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | PostgreSQL connection string, e.g. `postgresql+psycopg://user:pass@host:5432/db` (note the `+psycopg` — the project uses psycopg v3) |
| `JWT_SECRET_KEY` | backend | Secret used to sign auth tokens. Generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `ALLOWED_ORIGINS` | backend | Optional comma-separated list of extra allowed frontend origins once deployed |
| `VITE_API_URL` | frontend | Backend base URL. Defaults to `http://127.0.0.1:8000` |

## Demo credentials

Created by `seed_users.py`:

| Username | Password | Role |
|---|---|---|
| `admin` | `Admin@123` | admin |
| `officer` | `Officer@123` | officer |

Change these before any public deployment.

## Retraining the models

```bash
cd backend
python ml/data_preparation.py
python ml/statistical_baseline.py
python ml/machine_learning_models.py
python ml/model_comparison.py
```

See `backend/ml/README.md` for details on the training pipeline and its known limitation
(a single March 2026 snapshot supports retrospective proof-of-concept prediction; a
longitudinal early-warning model would need repeated monthly observations).

## Known limitations / honest caveats

- The predictive models are trained on a single snapshot of PAIMANA data, so they demonstrate
  the approach rather than production-grade accuracy on live, continuously-updated data.
- The Intelligence Assistant is rule-based/template-driven over real computed data (not a
  hosted LLM), chosen so the project runs without any external API key or cost.
- `docker-compose.yml` uses fixed demo credentials and no TLS — fine for local demos, not for
  production.
