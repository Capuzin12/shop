# BuildShop

Cloud-first монорепозиторій:
- `client` - React + Vite (деплой на Vercel)
- `server` - FastAPI + SQLAlchemy (деплой на Render)
- база даних - Supabase PostgreSQL

## Локальний запуск (Windows)

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

## Ініціалізація Supabase

1. Задайте `DATABASE_URL` у `server/.env` або в env змінних.
2. Створіть таблиці:

```bash
python scripts/init_supabase.py
```

3. Заповніть демо-дані через Supabase SQL Editor:
- файл: `server/seed_supabase.sql`

## Корисні API

- `POST /token`
- `GET /api/me`
- `GET /api/stats`
- `GET /health/live` та `GET /health/ready`

## Примітка

Репозиторій очищений під сценарій **Render + Vercel + Supabase** без локального Docker/VPS інфра-стеку.

