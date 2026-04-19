# Go-Live Checklist

## 1) Pre-Deploy
- [ ] Confirm release tag and commit hash
- [ ] Create database backup
- [ ] Verify migration plan (`alembic upgrade head` / rollback strategy)
- [ ] Validate environment variables and secrets
- [ ] Confirm CI pipeline status (lint/test/build green)
- [ ] Confirm staging deploy + smoke checks passed
- [ ] Confirm incident channel + on-call owner assigned

## 2) Deploy Window
- [ ] Start deploy from approved `production` workflow
- [ ] Confirm manual approval gate completed
- [ ] Deploy API and Web images by immutable SHA tag
- [ ] Run migrations (`alembic upgrade head`)
- [ ] Verify `/health/live`, `/health/ready`, `/api/stats`
- [ ] Verify error monitoring is receiving events

## 3) Post-Deploy Validation
- [ ] Customer flow: Register -> Login -> Catalog -> Add to Cart -> Checkout
- [ ] Staff flow: Orders dashboard, inventory actions
- [ ] Error logs review (backend + client errors)
- [ ] API latency spot check (<500ms target)
- [ ] Page load spot check (<3s target)

## 4) Rollback Gate
Rollback if any of the following:
- [ ] Error rate >1% during 5-minute observation window
- [ ] Critical flow broken (login/checkout/orders)
- [ ] Health endpoints unstable
- [ ] Migration caused data consistency issues

## 5) Sign-Off
- [ ] QA sign-off
- [ ] DevOps sign-off
- [ ] Product/Business sign-off
- [ ] Incident notes recorded

