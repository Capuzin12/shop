# BuildShop

Cloud-first monorepo:
- `client` - React + Vite (deploy on Vercel)
- `server` - FastAPI + SQLAlchemy (deploy on Render)
- database - Supabase PostgreSQL

## Local Run (Windows)

### 1) Backend (`server`)

```bash
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

### 2) Frontend (`client`)

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`

## Supabase Database Setup

1. Set `DATABASE_URL` in `server/.env` or environment variables.
2. Create tables:

```bash
python scripts/init_supabase.py
```

3. Seed demo data in Supabase SQL Editor:
- file: `server/seed_supabase.sql`

## Useful APIs

- `POST /token`
- `GET /api/me`
- `GET /api/stats`
- `GET /health/live` and `GET /health/ready`

## Note

This repository is cleaned for a **Render + Vercel + Supabase** workflow without local Docker/VPS infrastructure files.

