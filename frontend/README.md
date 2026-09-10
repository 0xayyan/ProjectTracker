# ProjectWatch Frontend

ProjectWatch is a React and Vite frontend for infrastructure project monitoring, risk analysis, milestones, budget tracking and predictive early-warning analytics.

## Start the frontend

Run from this directory:

`npm install`

`npm run dev`

The frontend expects the FastAPI backend at `http://127.0.0.1:8000` by default.

## Production build

`npm run build`

## Main application areas

- Dashboard: portfolio health, budget utilization and AI early warnings
- Projects: project CRUD, search, filtering, pagination and milestones
- Analytics: portfolio metrics, model comparison and predictive drivers
- Alerts: project-centric combined monitoring and AI alerts
- Settings: account and session information

## Authentication

Login is handled by the FastAPI `/login` endpoint. The bearer token is stored in local storage for the authenticated session.
