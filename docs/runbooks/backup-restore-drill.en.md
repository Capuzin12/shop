# Backup and Restore Drill - English

## Backup (SQLite Example)

For SQLite, you can simply copy the database file:

```bash
cp server/app.db backup_$(date +%Y%m%d_%H%M%S).db
```

Or using Docker Compose (if using PostgreSQL):

```bash
docker compose -f docker-compose.prod.yml exec db pg_dump -U buildshop buildshop > backup_$(date +%Y%m%d_%H%M%S).sql
```

## Restore

For SQLite:

```bash
cp backup_20260419_120000.db server/app.db
```

For PostgreSQL:

```bash
cat backup_20260419_120000.sql | docker compose -f docker-compose.prod.yml exec -T db psql -U buildshop -d buildshop
```

## Validation

Verify that restore works:

- `GET /health/ready` returns "ready"
- Login works
- Recent order list loads
- Products are visible in catalog
- Cart functions correctly

