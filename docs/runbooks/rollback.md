# BuildShop Rollback Runbook

## Trigger
Rollback if:
- Sustained 5xx after deploy
- Login or order flow broken
- DB migration issue blocks core operations

## Steps
1. Stop current stack:

```bash
docker compose -f docker-compose.prod.yml down
```

2. Restore previous image tags / previous branch artifact.

3. Start services again:

```bash
docker compose -f docker-compose.prod.yml up -d
```

4. Verify health endpoints and critical user flows.

## Database
- If schema/data was changed, restore from last backup before failed deploy.

