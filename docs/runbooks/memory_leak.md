# Runbook: Memory Leak Detection

## Trigger
- Steady memory growth without recovery
- OOM kill events / container restarts
- Increased GC pauses and latency spikes

## Immediate Actions
1. Determine leaking service (`api` or `web`).
2. Capture memory usage trend and restart count.
3. Compare with previous stable release.

## Diagnostics
```bash
docker stats --no-stream
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=300 api
```

## Mitigation
- Restart leaking service to recover capacity
- Apply temporary memory limit if needed
- Rollback if leak started after latest deployment

## Verification
- Memory curve resets and stabilizes
- No OOM events in next 30 minutes
- Latency and error rates return to baseline

## Follow-up
- Add heap/profile diagnostics
- Audit caches and unbounded in-memory structures
- Add long-run soak test to CI/CD

