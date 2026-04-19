# BuildShop Rollback Procedures

## Scope
This document describes rollback actions for CI/CD deployments in staging and production.

## Rollback Triggers
- Health checks fail after deployment (`/health/live`, `/health/ready`, `/api/stats`)
- Error-rate window exceeds 1% for 5 minutes
- Critical business flow fails (login, checkout, order status updates)
- Migration failure during `alembic upgrade head`

## Immediate Actions
1. Freeze further deploys.
2. Confirm current release tag and target rollback tag.
3. Notify incident channel and assign incident owner.

## Automated Rollback (Production Workflow)
`deploy-prod.yml` runs rollback automatically when the post-deploy gate fails.

Rollback behavior:
- Pull fallback image tag (input `rollback_tag`)
- Re-apply compose override with rollback images
- Restart services

## Manual Rollback (SSH)
```bash
cd <APP_DIR>
export API_IMAGE=ghcr.io/<org>/<repo>-api:<ROLLBACK_TAG>
export WEB_IMAGE=ghcr.io/<org>/<repo>-web:<ROLLBACK_TAG>
cat > docker-compose.override.yml <<'EOF'
services:
  api:
    image: ${API_IMAGE}
  web:
    image: ${WEB_IMAGE}
EOF

docker compose -f docker-compose.prod.yml up -d
```

## Database Rollback
If migration breaks runtime:
```bash
docker compose -f docker-compose.prod.yml exec -T api python -m alembic downgrade -1
```

If downgrade is unsafe:
1. Restore latest database backup
2. Deploy previous known-good images

## Validation After Rollback
Run health checks:
```bash
python scripts/health_check.py \
  --base-url <BASE_URL> \
  --retries 5 \
  --retry-delay 2 \
  --max-latency-ms 1200
```

Validate critical flows:
- Authentication
- Catalog rendering
- Checkout
- Order updates

## Post-Incident Checklist
- Capture root cause
- Attach workflow run links
- Document timeline and affected versions
- Open follow-up issue for permanent fix

