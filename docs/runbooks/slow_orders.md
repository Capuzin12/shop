# Runbook: Slow Cart/Order Processing

## Trigger
- Checkout latency > 2s sustained
- Order creation failures increase
- User reports delayed cart actions

## Immediate Actions
1. Confirm issue scope (all users vs subset).
2. Check API/database latency and error logs.
3. Identify whether slowdown started after deploy.

## Diagnostics
```bash
docker compose -f docker-compose.prod.yml logs --tail=300 api
python scripts/health_check.py --base-url <BASE_URL> --retries 5 --retry-delay 2
```

Target endpoints:
- `POST /api/orders`
- `GET /api/cart`
- `POST /api/cart/items`

## Mitigation
- Temporarily disable expensive non-critical features
- Reduce load (rate limit burst traffic)
- Rollback to previous stable release if regression

## Verification
- Checkout success rate normalizes
- P95 `POST /api/orders` back under target
- Error rate below rollback threshold

## Follow-up
- Add endpoint-specific tracing
- Tune DB indexes and query plans
- Add performance regression test for checkout

