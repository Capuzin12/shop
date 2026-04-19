# BuildShop Production Deploy Runbook - English

## Prerequisites
- Filled `.env` from `.env.example`
- Docker and Docker Compose installed

## Steps

1. Build and start production stack:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

2. Check backend health:

```bash
curl http://localhost/health/live
curl http://localhost/health/ready
```

3. Check app availability:
- Open `http://localhost`
- Login with pre-created account and open `/profile`, `/notifications`

## Post-Deploy Checks
- Order creation works
- Order status update works
- Chat message sends and notification appears

