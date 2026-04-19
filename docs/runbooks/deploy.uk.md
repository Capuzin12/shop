# BuildShop Production Deploy Runbook - Українська

## Передумови
- Заповнений `.env` з `.env.example`
- Встановлений Docker та Docker Compose

## Кроки

1. Збірка та запуск production stack:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

2. Перевірка здоров'я бекенду:

```bash
curl http://localhost/health/live
curl http://localhost/health/ready
```

3. Перевірка доступності додатку:
- Відкрити `http://localhost`
- Увійти з попередньо створеного акаунта та відкрити `/profile`, `/notifications`

## Після-deploy перевірки
- Створення замовлення працює
- Оновлення статусу замовлення працює
- Чат повідомлення відправляється й повідомлення з'являється

