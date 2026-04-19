# Monitoring and Alerting Strategy

## Objectives
- Detect incidents before user impact scales
- Keep MTTR low with actionable alerts and runbooks
- Track performance and error trends over time

## 1) Uptime Monitoring
Recommended tools: Pingdom, UptimeRobot, BetterStack.

Monitored endpoints:
- `GET /health/live`
- `GET /health/ready`
- `GET /api/stats`

Suggested settings:
- Check interval: 30-60 sec
- Alert threshold: 2 consecutive failures
- Escalation: 5 min unresolved -> secondary on-call

## 2) Error Rate Alerting
Recommended tools: Sentry (frontend + backend), or custom log-based alerts.

Alert rules:
- API 5xx rate > 1% for 5 minutes
- Client JS error spike > baseline x2
- Auth failures spike (possible abuse)

## 3) DB Connection Pool Monitoring
Track:
- active connections
- pool exhaustion events
- average query latency

Alert rules:
- pool usage > 80% for 5 minutes
- timeout errors > threshold

## 4) Log Aggregation
Recommended stacks: ELK / OpenSearch / Grafana Loki.

Must-have fields in structured logs:
- `timestamp`
- `level`
- `request_id`
- `path`
- `status_code`
- `duration_ms`
- `user_id` (if available)

Dashboards:
- Error rates by endpoint
- Slowest endpoints
- Top exception classes
- Login and checkout success rate

## 5) Alert Channels
- Primary: Slack incident channel
- Secondary: email to engineering list
- Critical escalation: phone/pager for on-call

## 6) SLO/SLA Baselines
- Availability target: 99.9%
- P95 API latency: <500ms
- P95 page load: <3s
- Error budget: <=1% 5xx in 5-minute windows

## 7) Weekly Review
- Review alert noise and tune thresholds
- Validate runbook usage and gaps
- Compare performance trends week-over-week

