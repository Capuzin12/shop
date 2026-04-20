# BuildShop

🇺🇦 **[Українська версія](README.uk.md)** | 🇬🇧 **[English Version](README.en.md)**

Монорепозиторій для cloud-стеку:
- `client` — React + Vite (деплой на Vercel)
- `server` — FastAPI + SQLAlchemy (деплой на Render)
- БД — Supabase PostgreSQL

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

## Supabase: ініціалізація БД

1. Налаштуйте `DATABASE_URL` у `server/.env` або в змінних середовища.
2. Створіть таблиці:

```bash
python scripts/init_supabase.py
```

3. Додайте тестові дані через SQL Editor у Supabase:
- файл: `server/seed_supabase.sql`

## Корисні API

- `POST /token` — отримати токен/сесію
- `GET /api/me` — поточний користувач
- `GET /api/stats` — статистика
- `GET /health/live` та `GET /health/ready` — health-check

## Примітка

Цей репозиторій очищений під сценарій **Render + Vercel + Supabase** без локального Docker/VPS-інфра стеку.
