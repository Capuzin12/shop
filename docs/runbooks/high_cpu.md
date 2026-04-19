# Runbook: High CPU Usage

## Trigger
- CPU > 85% for 5+ minutes
- API latency degradation
- Increased request timeouts

## Immediate Actions
1. Confirm affected service (`api`, `web`, `db`, `nginx`).
2. Capture top processes and container stats.
3. Check recent deploy or traffic spike.

## Diagnostics
```bash
docker stats --no-stream
docker compose -f docker-compose.prod.yml logs --tail=200 api
docker compose -f docker-compose.prod.yml logs --tail=200 web
```

## Mitigation
- Scale down traffic (rate limiting / temporary maintenance page)
- Restart unhealthy service if safe
- Rollback if issue started after deploy

## Verification
- CPU returns below 70%
- `/health/ready` stable
- P95 latency back to normal baseline

## Follow-up
- Root cause analysis
- Add optimization ticket (query/index/cache/profile)

