# Deployment Guide for BuildShop Production

Complete guide for deploying BuildShop to production with maximum security.

## Pre-Deployment Checklist

### 1. Security Audit
```bash
# Run security checks
cd buildshop
python scripts/security_audit.py

# Check Python dependencies
pip audit

# Check NPM dependencies
cd client && npm audit

# Review OWASP Top 10 compliance
# See docs/SECURITY.md for detailed checklist
```

### 2. Environment Setup
```bash
# Create production environment file
cp .env.example .env

# Edit .env with production values
vim .env

# CRITICAL: Set these values
# - SECRET_KEY: Use `openssl rand -base64 32` to generate
# - DATABASE_URL: PostgreSQL connection string
# - ENVIRONMENT: production
# - DEBUG: false
# - CORS_ORIGINS: Your domain(s)
```

### 3. Database Preparation
```bash
# For PostgreSQL (recommended):
# 1. Create database on your PostgreSQL server
# 2. Create dedicated database user with strong password
# 3. Grant minimal required permissions

# Run migrations (if using Alembic)
cd server
alembic upgrade head

# Initialize database (if first deployment)
python init_db.py
python seed.py  # Only for demo data
```

### 4. Docker Build
```bash
# Build images locally for testing
docker-compose -f docker-compose.prod.yml build

# Test images
docker run -it buildshop-api:latest /bin/sh
docker run -it buildshop-web:latest /bin/sh

# Scan for vulnerabilities (if using Trivy)
trivy image buildshop-api:latest
trivy image buildshop-web:latest
```

---

## Deployment Scenarios

### Scenario 1: VPS with Docker (Recommended)

#### Prerequisites
- Ubuntu 22.04 LTS server (or similar)
- Docker & Docker Compose installed
- Domain name with DNS pointing to server
- SSH key-based authentication
- Firewall configured (ufw)

#### Step-by-step Deployment

```bash
# 1. Connect to server
ssh -i ~/.ssh/id_rsa root@your-server-ip

# 2. Install dependencies
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl git certbot python3-certbot-nginx
sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker

# 3. Clone repository
git clone https://github.com/yourepo/buildshop.git
cd buildshop

# 4. Setup environment
cp .env.example .env
# Edit .env with production values
nano .env

# 5. Setup SSL certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# 6. Mount certificates in docker-compose
# Update volumes in docker-compose.prod.yml

# 7. Start application
docker compose -f docker-compose.prod.yml up -d

# 8. Check status
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

### Scenario 2: Cloud Deployment (Vercel + Supabase)

#### Prerequisites
- Vercel account
- Supabase account
- GitHub repository

#### Step-by-step

```bash
# 1. Deploy frontend to Vercel
cd client
vercel --prod

# Note: Vercel automatically provides HTTPS/SSL
# Configure custom domain in Vercel dashboard

# 2. Setup Supabase database
# Create project in Supabase
# Get DATABASE_URL from Supabase dashboard

# 3. Deploy backend to Railway/Render
# Option A: Railway
# - Connect GitHub repo
# - Add environment variables
# - Deploy

# Option B: Render
# - Create Web Service from GitHub
# - Add environment variables (including DATABASE_URL)
# - Deploy
```

### Scenario 3: Kubernetes Deployment

#### Prerequisites
- Kubernetes cluster (EKS, GKE, AKS, or local)
- kubectl configured
- Helm (optional)

#### Deployment Files

Create `k8s/namespace.yaml`:
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: buildshop
```

Create `k8s/deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: buildshop-api
  namespace: buildshop
spec:
  replicas: 3
  selector:
    matchLabels:
      app: buildshop-api
  template:
    metadata:
      labels:
        app: buildshop-api
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
      containers:
      - name: api
        image: buildshop-api:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 8001
        env:
        - name: ENVIRONMENT
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: buildshop-secrets
              key: database-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8001
          initialDelaySeconds: 10
          periodSeconds: 5
```

Create `k8s/service.yaml`:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: buildshop-api
  namespace: buildshop
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 8001
  selector:
    app: buildshop-api
```

```bash
# Deploy
kubectl apply -f k8s/namespace.yaml
kubectl create secret generic buildshop-secrets \
  --from-literal=database-url='postgresql://...'
kubectl apply -f k8s/
kubectl get pods -n buildshop
```

---

## Post-Deployment Verification

### 1. Health Checks
```bash
# Check API health
curl https://yourdomain.com/health/live
# Should return: {"status": "ok", "service": "buildshop-api"}

# Check database connectivity
curl https://yourdomain.com/health/ready
# Should return: {"status": "ready", "database": "ok"}
```

### 2. Security Verification
```bash
# Check HSTS header
curl -I https://yourdomain.com | grep Strict-Transport

# Check CSP header
curl -I https://yourdomain.com | grep Content-Security

# Check SSL/TLS
openssl s_client -connect yourdomain.com:443

# SSL Labs test
# https://www.ssllabs.com/ssltest/analyze.html?d=yourdomain.com
```

### 3. Performance Testing
```bash
# Basic load test
ab -n 1000 -c 10 https://yourdomain.com/

# With authentication
ab -n 1000 -c 10 -H "Authorization: Bearer YOUR_TOKEN" https://yourdomain.com/api/products

# Using wrk
wrk -t4 -c100 -d30s https://yourdomain.com/
```

### 4. Functional Testing
```bash
# Test API endpoints
curl -X GET https://yourdomain.com/api/products
curl -X GET https://yourdomain.com/api/categories
curl -X POST https://yourdomain.com/token \
  -d "username=test@example.com&password=TestPassword123!"

# Test frontend
# Visit https://yourdomain.com in browser
# Test login flow
# Test product browsing
# Test cart/checkout flow
```

---

## Monitoring & Logging

### Set Up Monitoring
```bash
# Option 1: Using prometheus + grafana
docker run -d \
  -p 9090:9090 \
  -v /etc/prometheus:/etc/prometheus \
  prom/prometheus

# Option 2: Using Datadog
# Install Datadog agent
DD_AGENT_MAJOR_VERSION=7 DD_API_KEY=xxx bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script.sh)"

# Option 3: Using New Relic
pip install newrelic
NEW_RELIC_CONFIG_FILE=newrelic.ini newrelic-admin run-program uvicorn main:app
```

### Set Up Log Aggregation
```bash
# Option 1: ELK Stack
docker run -d -p 9200:9200 -e discovery.type=single-node docker.elastic.co/elasticsearch/elasticsearch:8.0.0

# Option 2: Splunk
# Configure JSON logging to send to Splunk HEC

# Option 3: AWS CloudWatch
# Configure container logging driver in docker-compose
```

### Configure Alerts
```bash
# Critical alerts:
# - API error rate > 5%
# - Database connection failures
# - Rate limit exceeded > 1000/min
# - Slow requests > 2sec (>10 occurrences)

# Warning alerts:
# - Memory usage > 80%
# - Disk usage > 85%
# - Certificate expires in < 7 days
# - Failed login attempts > 100/hour
```

---

## Backup & Disaster Recovery

### Database Backups
```bash
# PostgreSQL backup
pg_dump -h host -U user -d buildshop > backup.sql

# Automated daily backups (cron)
0 2 * * * pg_dump -h localhost -U user -d buildshop > /backups/buildshop_$(date +\%Y\%m\%d).sql

# Test restore
psql -h localhost -U user -d buildshop_test < backup.sql
```

### Application Backups
```bash
# Backup docker volumes
docker run -v buildshop_data:/data -v /backups:/backup \
  busybox tar czf /backup/buildshop-data-$(date +%Y%m%d).tar.gz -C /data .

# Backup application code
git push origin main  # Ensure code is in git

# Backup SSL certificates
tar czf /backups/ssl-$(date +%Y%m%d).tar.gz /etc/letsencrypt/
```

### Disaster Recovery Plan
1. **Database Failure**: Restore from latest backup
2. **Server Failure**: Redeploy using docker-compose
3. **Code Issues**: Rollback to previous git commit and redeploy
4. **Security Breach**: Rotate credentials and rebuild from scratch

---

## Maintenance & Updates

### Regular Maintenance
```bash
# Weekly
docker system prune -a  # Clean up unused images
docker logs buildshop-api | tail -1000 | grep ERROR  # Check errors

# Monthly
docker pull nginx:1.27-alpine  # Update base images
docker pull python:3.12-slim
docker pull node:22-alpine
docker compose -f docker-compose.prod.yml up -d  # Rebuild and deploy

# Quarterly
pip audit  # Check for Python vulnerabilities
npm audit  # Check for Node vulnerabilities
cd server && alembic current  # Check database migration status
```

### Security Updates
```bash
# Check for available updates
docker inspect buildshop-api | grep Image

# Update all packages
sudo apt-get update && sudo apt-get upgrade -y

# Update Python packages
pip install --upgrade pip
pip install -r requirements.txt

# Update Node packages
npm update
```

### Certificate Renewal
```bash
# Check certificate expiration
sudo certbot certificates

# Renew certificate (automated or manual)
sudo certbot renew

# Force renewal if needed
sudo certbot renew --force-renewal
```

---

## Rollback Procedures

### Rollback to Previous Docker Image
```bash
# Get image history
docker image history buildshop-api:latest

# Rollback to previous version
docker run -d \
  --name buildshop-api-old \
  -e DATABASE_URL=... \
  buildshop-api:previous-tag
```

### Rollback Database
```bash
# Connect to database backup
psql -f buildshop_backup_date.sql

# Or restore specific table
psql -c "DROP TABLE orders; CREATE TABLE orders AS SELECT * FROM orders_backup;"
```

### Rollback Application Code
```bash
# Using git
git revert <commit-hash>
git push origin main

# Rebuild and redeploy
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Troubleshooting

### Common Issues

**Issue**: Container keeps restarting
```bash
# Solution: Check logs
docker logs buildshop-api
# Common causes: Database connection, missing SECRET_KEY, port already in use
```

**Issue**: Slow requests/timeouts
```bash
# Solution: Check resource usage
docker stats

# Increase timeouts in nginx
proxy_read_timeout 60s;
proxy_connect_timeout 10s;

# Scale up replicas (Kubernetes)
kubectl scale deployment buildshop-api --replicas=5
```

**Issue**: Database connection pool exhausted
```bash
# Solution: Increase pool size
# In database.py: pool_pre_ping=True, pool_size=20

# Check active connections
SELECT count(*) FROM pg_stat_activity;
```

---

## Support & Documentation

- **Security**: See docs/SECURITY.md
- **HTTPS Setup**: See docs/HTTPS_SETUP.md
- **API Documentation**: See /docs (Swagger UI)
- **Issue Tracking**: GitHub Issues
- **Security Reports**: security@yourdomain.com

---

**Last Updated**: 2026-04-19
**Version**: 1.0
**Status**: Production Ready

