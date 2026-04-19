# Backup and Restore Drill - Українська

## Backup (SQLite example)

Для SQLite можна просто скопіювати файл бази даних:

```bash
cp server/app.db backup_$(date +%Y%m%d_%H%M%S).db
```

Або за допомогою Docker Compose (якщо використовуєте PostgreSQL):

```bash
docker compose -f docker-compose.prod.yml exec db pg_dump -U buildshop buildshop > backup_$(date +%Y%m%d_%H%M%S).sql
```

## Restore

Для SQLite:

```bash
cp backup_20260419_120000.db server/app.db
```

Для PostgreSQL:

```bash
cat backup_20260419_120000.sql | docker compose -f docker-compose.prod.yml exec -T db psql -U buildshop -d buildshop
```

## Валідація

Перевірте, що復復робить:

- `GET /health/ready` повертає "ready"
- Вхід функціонує
- Список недавніх замовлень завантажується
- Товари видимі в каталозі
- Кошик функціонує правильно

