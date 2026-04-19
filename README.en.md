# BuildShop

Monorepo: `client` (React + Vite + Tailwind) and `server` (FastAPI + SQLAlchemy + SQLite).

## How to Run Project (Windows)

Below is the complete startup sequence from scratch.

### 1) Backend Setup

Open a terminal in the `server` folder and run:

```bash
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 2) Database Initialization

DB schema: `server/schema.sql`, ORM models: `server/models.py`.

In the same `server` folder:

```bash
python init_db.py --force --seed
```

If you need a clean schema without automatic seeding:

```bash
python init_db.py --force
python seed.py
```

### 3) Run Backend (Terminal #1)

In the `server` folder:

```bash
.\venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

### 4) Run Frontend (Terminal #2)

In another terminal, navigate to the `client` folder:

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173` (or another port shown by Vite)

## Quick Startup Sequence (Each Time)

1. Terminal #1: start backend in `server`
2. Terminal #2: start frontend in `client`
3. Open `http://localhost:5173`

## Test Accounts (after `--seed`)

- `admin@budmart.ua / admin123` (admin)
- `manager@budmart.ua / manager123` (manager)
- `ivan@example.com / user123` (customer)

## Main Pages

- `/catalog` — product catalog
- `/cart` — shopping cart
- `/wishlist` — wishlist
- `/profile` — profile and order history
- `/notifications` — notifications

## Useful APIs

- `GET /api/stats` — basic statistics
- `POST /token` — get JWT token for authorization
- `GET /api/me` — current user information

## Production Baseline (P0)

Basic framework for deployment has been added:

- environment templates: `.env.example`, `server/.env.example`, `client/.env.example`
- health-check endpoints: `GET /health/live`, `GET /health/ready`
- Docker production stack: `docker-compose.prod.yml`
- CI workflow: `.github/workflows/ci.yml`
- runbooks: `docs/runbooks/deploy.md`, `docs/runbooks/rollback.md`, `docs/runbooks/backup-restore-drill.md`

### Quick Start for Production Stack (Locally)

1. Copy env template and fill in secrets:

```bash
copy .env.example .env
```

2. Start production compose:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

3. Verify health:

```bash
curl http://localhost/health/live
curl http://localhost/health/ready
```

### Backup / Restore Scripts (Windows PowerShell)

```powershell
./scripts/backup_db.ps1
./scripts/restore_db.ps1 -InputFile ./backup_YYYYMMDD_HHMMSS.sql
```

