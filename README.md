# BuildShop

Монорепозиторій: `client` (React + Vite + Tailwind) та `server` (FastAPI + SQLAlchemy + SQLite).

## Як запустити проєкт (Windows)

Нижче — повна послідовність запуску від нуля.

### 1) Підготовка бекенду

Відкрийте термінал у папці `server` і виконайте:

```bash
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### 2) Ініціалізація бази даних

Схема БД: `server/schema.sql`, ORM-моделі: `server/models.py`.

У тій же папці `server`:

```bash
python init_db.py --force --seed
```

Якщо потрібна чиста схема без автоматичного seed:

```bash
python init_db.py --force
python seed.py
```

### 3) Запуск бекенду (термінал №1)

У папці `server`:

```bash
.\venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

### 4) Запуск фронтенду (термінал №2)

В іншому терміналі перейдіть у папку `client`:

```bash
npm install
npm run dev
```

- Фронтенд: `http://localhost:5173` (або інший порт, який покаже Vite)

## Швидкий порядок запуску (кожного разу)

1. Термінал №1: запустити бекенд у `server`
2. Термінал №2: запустити фронтенд у `client`
3. Відкрити `http://localhost:5173`

## Тестові акаунти (після `--seed`)

- `admin@budmart.ua / admin123` (admin)
- `manager@budmart.ua / manager123` (manager)
- `ivan@example.com / user123` (customer)

## Основні сторінки

- `/catalog` — каталог товарів
- `/cart` — кошик
- `/wishlist` — список бажань
- `/profile` — профіль та історія замовлень
- `/notifications` — повідомлення

## Корисні API

- `GET /api/stats` — базова статистика
- `POST /token` — отримати JWT токен для авторизації
- `GET /api/me` — інформація про поточного користувача

## Production baseline (P0)

Додано базовий каркас для введення в експлуатацію:

- шаблони змінних середовища: `.env.example`, `server/.env.example`, `client/.env.example`
- health-check endpoints: `GET /health/live`, `GET /health/ready`
- Docker production stack: `docker-compose.prod.yml`
- CI workflow: `.github/workflows/ci.yml`
- runbooks: `docs/runbooks/deploy.md`, `docs/runbooks/rollback.md`, `docs/runbooks/backup-restore-drill.md`

### Швидкий старт prod-стеку (локально)

1. Скопіюйте env-шаблон і заповніть секрети:

```bash
copy .env.example .env
```

2. Запустіть production compose:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

3. Перевірте health:

```bash
curl http://localhost/health/live
curl http://localhost/health/ready
```

### Backup / restore scripts (Windows PowerShell)

```powershell
./scripts/backup_db.ps1
./scripts/restore_db.ps1 -InputFile ./backup_YYYYMMDD_HHMMSS.sql
```

