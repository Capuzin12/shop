# BuildShop

Монорепозиторій: `client` (React + Vite + Tailwind) та `server` (FastAPI + SQLAlchemy + SQLite).

## Налаштування та запуск

### 1) Ініціалізація бази даних

Схема зберігається в `server/schema.sql`. ORM-моделі — `server/models.py`.

З каталогу `server` виконайте:

```bash
python -m venv venv
.\venv\Scripts\Activate
pip install -r requirements.txt
python init_db.py --force --seed
```

Якщо потрібна лише чиста схема без seed:

```bash
python init_db.py --force
python seed.py
```

### 2) Запуск бекенду

Відкрийте термінал у папці `server`, активуйте віртуальне оточення та запустіть сервер:

```bash
.\venv\Scripts\Activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- Бекенд буде доступний на `http://localhost:8000`
- Документація API: `http://localhost:8000/docs`

### 3) Запуск фронтенду

В іншому терміналі перейдіть у папку `client` та виконайте:

```bash
npm install
npm run dev
```

- Фронтенд працюватиме на `http://localhost:5173` (або на адресі, яку покаже Vite)

## Основні сценарії

- Після логіна можна додавати товари до кошика та списку бажань
- Профіль та історія замовлень доступні на сторінці `/profile`
- Сторінки:
  - `/catalog` — каталог товарів
  - `/cart` — кошик
  - `/wishlist` — список бажань
  - `/notifications` — повідомлення

## Корисні API

- `GET /api/stats` — базова статистика
- `POST /token` — отримати JWT токен для авторизації
- `GET /api/me` — інформація про поточного користувача
