# BuildShop Deployment Guide

## CI/CD Workflows
- `.github/workflows/lint-test.yml`
  - Backend: compile, pylint (`--errors-only`), pytest (if tests exist)
  - Frontend: eslint, `npm test`, build
  - Merge is blocked on failures.

- `.github/workflows/build.yml`
  - Builds `server` and `client` Docker images
  - Pushes tags: `sha-<commit>` and `latest`
  - Publishes SBOM artifacts for API and Web images

- `.github/workflows/deploy-staging.yml`
  - Trigger: manual or PR to `develop`
  - Deploys tagged images to staging host
  - Runs smoke checks with `scripts/health_check.py`
  - Comments staging URL into PR

- `.github/workflows/deploy-prod.yml`
  - Trigger: manual only
  - Requires semantic tag input (`vX.Y.Z`)
  - Uses GitHub Environment approval gate (`production`)
  - Deploys images, runs `alembic upgrade head`
  - Executes 5-minute health gate
  - Auto-rollbacks if health gate fails

## Required Secrets
### Shared
- `REGISTRY_USERNAME`
- `REGISTRY_TOKEN`

### Staging
- `STAGING_HOST`
- `STAGING_SSH_USER`
- `STAGING_SSH_KEY`
- `STAGING_APP_DIR`
- `STAGING_BASE_URL`

### Production
- `PROD_HOST`
- `PROD_SSH_USER`
- `PROD_SSH_KEY`
- `PROD_APP_DIR`
- `PROD_BASE_URL`

## Release Flow
1. Open PR -> `lint-test.yml` must pass
2. Merge to `develop` -> staging deploy and smoke tests
3. Manual production dispatch with release version
4. Approval gate in `production` environment
5. Production deploy + migration + health gate
6. Auto-rollback on failed health gate

## Health Gate Command
```bash
python scripts/health_check.py \
  --base-url <BASE_URL> \
  --timeout 5 \
  --retries 5 \
  --retry-delay 2 \
  --max-latency-ms 1200 \
  --window-seconds 300 \
  --interval-seconds 10 \
  --max-error-rate 1.0
```

## Best Practices
- Always deploy immutable SHA tags in staging/prod
- Keep `latest` only as convenience alias
- Run migrations only during controlled deploy steps
- Keep rollback tag ready before production release
- Store SBOM artifacts for each build for auditability

## Operational Notes
- Rolling deploy is achieved by updating service images and restarting compose stack
- If migration fails, stop rollout and run rollback procedure from `docs/rollback.md`
- For severe incidents, restore DB backup first, then rollback application images

