# Backup and Restore Drill

## Backup (PostgreSQL example)

```bash
docker compose -f docker-compose.prod.yml exec db pg_dump -U buildshop buildshop > backup.sql
```

## Restore

```bash
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T db psql -U buildshop -d buildshop
```

## Validation
- `GET /health/ready` returns ready
- Login works
- Recent order list loads

