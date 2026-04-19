# Phase 6 Scripts

## `e2e_tests.py`
End-to-end rehearsal script with:
- UI navigation timing checks (Playwright)
- API scenario checks (customer/admin/error flows)
- SLA assertions (<3s page load, <500ms API)

### Run
```bash
python scripts/e2e_tests.py --frontend-url http://localhost --api-url http://localhost
```

If Playwright is not installed or browsers are missing:
```bash
pip install playwright
playwright install chromium
```

## `load_test.py`
Locust scenario for browse-heavy traffic and basic cart/order probes.

### Run (100 concurrent users)
```bash
locust -f scripts/load_test.py --host http://localhost -u 100 -r 10 -t 5m --headless
```

## `health_check.py`
Post-deploy health verification (created in Phase 5).

### Run
```bash
python scripts/health_check.py --base-url http://localhost
```

