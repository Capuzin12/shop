# Runbook: DB Connection Pool Exhaustion

## Trigger
- Connection timeout errors
- `ready` health endpoint unstable
- Elevated query wait times

## Immediate Actions
1. Identify pool usage and failing endpoints.
2. Check long-running queries and lock contention.
3. Verify recent changes in traffic/deploy.

## Diagnostics
```bash
docker compose -f docker-compose.prod.yml logs --tail=300 api
docker compose -f docker-compose.prod.yml logs --tail=300 db
```

If PostgreSQL tools available:
```sql
SELECT now(), state, count(*)
FROM pg_stat_activity
GROUP BY state;
```

## Mitigation
- Restart API service to release leaked connections
- Reduce traffic temporarily
- Rollback if regression introduced in latest release

## Verification
- Timeouts disappear
- `/health/ready` stable over 5 minutes
- Error rate below 1%

## Follow-up
- Review SQLAlchemy pool config
- Add instrumentation for pool metrics
- Profile slow queries and missing indexes

