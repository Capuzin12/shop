# BuildShop - Security Hardening Guide for Production

## Overview
This guide outlines the security enhancements made to BuildShop for production deployment. All recommendations follow OWASP Top 10 security standards and industry best practices.

---

## 1. Authentication & Authorization

### JWT Configuration
- **Access Token TTL**: 30 minutes (short-lived, reduces exposure window)
- **Refresh Token TTL**: 24 hours (for refresh token flow)
- **Algorithm**: HS256 recommended, RS256+ for distributed systems
- **Secure Storage**: JWT stored in HttpOnly, Secure, SameSite=Strict cookies

### Password Policy
- **Minimum Length**: 12 characters (enforced)
- **Complexity Requirements**:
  - At least one uppercase letter (A-Z)
  - At least one lowercase letter (a-z)
  - At least one digit (0-9)
  - At least one special character (!@#$%^&*)
  - No repeated characters (3+ in a row)
  - No common patterns (password, 12345, qwerty, etc.)

### Login Security
- **Rate Limiting**: 5 attempts per 15 minutes per IP
- **Brute-force Protection**: IP-based rate limiting on `/token` endpoint
- **Failed Login Logging**: All authentication failures logged with user context

### Session Management
- **Session Timeout**: 30 minutes of inactivity
- **Cookie Settings**:
  - `HttpOnly`: Prevents JavaScript access (XSS protection)
  - `Secure`: HTTPS only transmission
  - `SameSite=Strict`: CSRF protection in production
  - `Domain`: Not set (cookie-bound to origin domain)
  - `Path=/`: Available to entire application

---

## 2. Security Headers

### Implemented Headers
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
```

### HSTS (HTTP Strict Transport Security)
- **Max Age**: 2 years (63,072,000 seconds)
- **Subdomains**: Included
- **Preload**: Yes (adds domain to browser preload list)
- **Effect**: Forces HTTPS for all future requests

### Content Security Policy (CSP)
- **Strict Policy**: Only self-origin resources allowed
- **Whitelist Strategy**: Explicitly allow required resources
- **Frame Ancestors**: Prevents clickjacking attacks
- **Base URI**: Restricts base tag injection

---

## 3. CORS Configuration

### Origins Whitelist
- **Production**: Only specific domains allowed (configurable via `CORS_ORIGINS`)
- **Methods**: GET, POST, PUT, DELETE, OPTIONS (explicit, not wildcard)
- **Headers**: Content-Type, Authorization, X-Request-ID only
- **Exposed Headers**: X-Request-ID, X-Response-Time
- **Preflight Cache**: 1 hour (3600 seconds)
- **Credentials**: Allowed with strict SameSite policy

### Configuration
```python
CORS_ORIGINS="https://yourdomain.com,https://www.yourdomain.com"
CORS_ORIGIN_REGEX="https://.*\.vercel\.app"  # Optional: for preview deploys
```

---

## 4. Input Validation & Sanitization

### Implemented Protections
1. **Pydantic Validation**: All API inputs validated against strict schemas
2. **Type Checking**: Enforce correct data types
3. **Length Limits**: Prevent buffer overflow attacks
4. **SQL Injection**: Parameterized queries (SQLAlchemy ORM) - NO raw SQL
5. **XSS Prevention**: HTML/JavaScript sanitization
6. **Phone Numbers**: Normalized and validated format
7. **Email Addresses**: RFC-compliant validation
8. **Text Fields**: Length-limited to prevent DOS attacks

### Examples
- Contact name: 2-200 characters
- Phone: 10-15 digits with + prefix validation
- Email: Standard RFC format
- Order comment: Max 1000 characters
- Review comment: Min 5, max 1500 characters

---

## 5. Rate Limiting & DDoS Protection

### Nginx Rate Limiting Zones
1. **Auth Zone** (`auth_limit`): 5 requests/minute per IP
   - Applied to `/token` (login endpoint)
   - Burst: 5 (allows spike)
   - Returns 429 on limit exceeded

2. **API Zone** (`api_limit`): 10 requests/second per IP
   - Applied to `/api/*` endpoints
   - Burst: 20
   - Protects against API abuse

3. **General Zone** (`general_limit`): 30 requests/second per IP
   - Applied to frontend and other endpoints
   - Burst: 50

### Response
- Status: 429 (Too Many Requests)
- Header: `Retry-After` with seconds to wait
- Logged for monitoring

---

## 6. Database Security

### Connection Pooling
- SQLAlchemy connection pooling enabled
- Connection timeout: 30 seconds
- Maximum retries: 3

### Recommendations for PostgreSQL
```
# Use strong credentials
DATABASE_URL=postgresql://secure_user:very_long_random_password@host:5432/buildshop

# Enable SSL mode (if supported by provider)
DATABASE_URL=postgresql://user:pass@host:5432/buildshop?sslmode=require
```

### Parameterized Queries
- All queries use SQLAlchemy ORM (automatic SQL injection prevention)
- NO string interpolation or f-strings in SQL
- NO raw SQL except for migrations

### Sensitive Data
- Passwords: Hashed with bcrypt (cost factor 12)
- Never logged or exposed in errors
- Password reset tokens: Temporary, short-lived

---

## 7. Docker & Container Security

### Base Images
- **Python**: `python:3.12-slim` (minimal, security-patched)
- **Nginx**: `nginx:1.27-alpine` (minimal, no unnecessary packages)
- **Node**: `node:22-alpine` (for build stage only)

### Security Best Practices
1. **Non-root User**: Application runs as `appuser` (UID 101), not root
2. **Multi-stage Build**: Reduces final image size and attack surface
3. **No Privileges**: `security_opt: no-new-privileges:true`
4. **Package Updates**: All base packages upgraded in RUN instruction
5. **Health Checks**: Enabled for container orchestration systems

### Resource Limits
```yaml
api:
  mem_limit: 512m
  cpus: '1'
  
web:
  mem_limit: 256m
  cpus: '0.5'
```

### Logging
- JSON format for log aggregation
- Max size: 10MB per file
- Max files: 3
- Rotation enabled

---

## 8. Environment & Secrets Management

### Environment Variables
- Loaded from `.env` file (never committed to repo)
- Validated on startup with `validate_settings()`
- Type-checked with Pydantic

### Production Requirements
- `SECRET_KEY`: Minimum 32 characters, cryptographically random
- `DATABASE_URL`: PostgreSQL with strong credentials
- `ENVIRONMENT`: Set to `production`
- `DEBUG`: Must be `false`
- `CORS_ORIGINS`: Restricted to specific domains

### Validation Checks
```python
# At startup, validates:
✓ SECRET_KEY is not default value
✓ SECRET_KEY length >= 32 chars in production
✓ DEBUG is false in production
✓ DATABASE_URL format is valid
✓ AUTH_COOKIE_SECURE is true in production
✓ All required fields are set
```

### Secrets Rotation (Recommended)
- Implement monthly SECRET_KEY rotation
- Use password manager (1Password, LastPass) for storing credentials
- Consider AWS Secrets Manager or HashiCorp Vault for distributed systems

---

## 9. API Security

### Error Handling
- **Production Mode**: Generic error messages, no stack traces
- **Development Mode**: Detailed error information for debugging
- **Logging**: All errors logged server-side with context

### Request ID Tracing
- Unique `X-Request-ID` header for every request
- Included in all logs and error responses
- Helps with security auditing and debugging

### Deprecated Endpoints
- Mark with `@deprecated` decorator (recommended for future versions)
- Communicate deprecation timeline to clients
- Plan migration path to new API versions

### API Versioning (Future)
```python
# Recommended structure for v2:
/api/v1/products      # Current
/api/v2/products      # New version with breaking changes
/health/live          # Unversioned health checks
```

---

## 10. SSL/TLS Configuration

### HTTPS Setup Options

#### Option 1: Let's Encrypt (Recommended)
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificates
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Certificates location:
# /etc/letsencrypt/live/yourdomain.com/fullchain.pem
# /etc/letsencrypt/live/yourdomain.com/privkey.pem

# Auto-renewal:
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

#### Option 2: Self-signed (Development Only)
```bash
# Generate self-signed cert (1 year validity)
openssl req -x509 -newkey rsa:4096 -nodes \
  -out cert.pem -keyout key.pem -days 365
```

#### Option 3: Cloud Provider (AWS, Vercel, Netlify)
- Use managed SSL certificates (CloudFront, ALB)
- Automatic renewal and certificate management

### Nginx HTTPS Configuration
```nginx
# Uncomment in infra/nginx/buildshop.conf for HTTPS:
listen 443 ssl http2;
ssl_certificate /etc/nginx/ssl/fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/privkey.pem;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;

# HTTP to HTTPS redirect:
server {
  listen 80;
  return 301 https://$server_name$request_uri;
}
```

---

## 11. Dependency Security

### Regular Scanning
```bash
# Check for vulnerabilities in Python packages
pip audit

# Check for vulnerabilities in Node packages
npm audit

# Fix vulnerabilities
pip install --upgrade vulnerable_package
npm audit fix
```

### Version Pinning
- Use exact versions for critical dependencies
- Allow patch updates (e.g., `4.1.3` not `>=4.0.0`)
- Keep dependencies updated monthly

### Recommended Tools
- **Python**: pip-audit, safety, bandit
- **Node**: npm audit, snyk, dependabot
- **General**: GitHub Dependabot, GitLab Dependency Scanning

---

## 12. Logging & Monitoring

### Structured Logging
- JSON format for easy parsing and aggregation
- Fields: timestamp, level, logger, message, request_id, user_id, etc.
- Suppresses noisy library logs

### Security Events to Log
- Authentication attempts (success and failure)
- Authorization failures (permission denied)
- Admin actions (user creation, order changes)
- Rate limit exceeded
- Invalid input detection
- Suspicious patterns

### Log Aggregation (Recommended)
- **ELK Stack**: Elasticsearch, Logstash, Kibana
- **Datadog**: Cloud monitoring and logs
- **Splunk**: Enterprise log management
- **CloudWatch**: AWS native solution

### Alerts Setup
```
Critical:
  - Failed login attempts > 10 in 5 min
  - Rate limit exceeded > 100 times/min
  - Database connection failures
  - Error rate > 5%

Warning:
  - Slow requests > 2 sec (API)
  - High memory usage > 80%
  - Unusual geographic login activity
```

---

## 13. Deployment Checklist

### Pre-deployment
- [ ] Run security audit: `pip audit`, `npm audit`
- [ ] Check environment variables are configured
- [ ] Enable HTTPS with valid certificate
- [ ] Test rate limiting
- [ ] Verify CORS origins
- [ ] Enable structured logging
- [ ] Configure firewall rules

### Deployment
- [ ] Use non-root user for application
- [ ] Set resource limits (memory, CPU)
- [ ] Enable health checks
- [ ] Configure log rotation
- [ ] Set up monitoring and alerts
- [ ] Implement backup strategy
- [ ] Test disaster recovery

### Post-deployment
- [ ] Verify HSTS headers
- [ ] Test CSP policy
- [ ] Check SSL certificate validity
- [ ] Monitor error logs
- [ ] Test rate limiting in production
- [ ] Verify backup functionality

---

## 14. Incident Response Plan

### Data Breach
1. Immediate: Disable affected accounts
2. Investigation: Check logs, identify compromised data
3. Notification: Inform users per GDPR/local regulations
4. Mitigation: Reset credentials, change SECRET_KEY
5. Post-mortum: Document lessons learned

### DDoS Attack
1. Enable advanced rate limiting
2. Increase connection limits
3. Use WAF (Web Application Firewall) if available
4. Coordinate with ISP/hosting provider
5. Implement geo-blocking if necessary

### Database Compromise
1. Immediate: Isolate database from network
2. Investigation: Query audit logs
3. Recovery: Restore from clean backup
4. Mitigation: Rotate all credentials
5. Hardening: Review access controls

---

## 15. Compliance & Standards

### OWASP Top 10 (2023) Coverage
- **A01:2021** - Broken Access Control: Role-based authorization
- **A02:2021** - Cryptographic Failures: bcrypt, HTTPS, JWT
- **A03:2021** - Injection: Parameterized queries (SQLAlchemy ORM)
- **A04:2021** - Insecure Design: Security headers, rate limiting
- **A05:2021** - Security Misconfiguration: Validation, error handling
- **A06:2021** - Vulnerable Components: Dependency scanning (pip audit)
- **A07:2021** - Authentication Failures: Strong passwords, JWT, rate limiting
- **A08:2021** - Data Integrity Failures: Input validation, CSP
- **A09:2021** - Logging & Monitoring: Structured JSON logging
- **A10:2021** - SSRF: Input validation, URL scheme checking

### Recommended Standards
- **PCI DSS**: For payment processing
- **GDPR**: For EU customer data
- **CCPA**: For California consumer data
- **SOC 2**: For enterprise customers

---

## 16. Regular Security Maintenance

### Monthly Tasks
- [ ] Review and update dependencies
- [ ] Check security advisories
- [ ] Review access logs for anomalies
- [ ] Verify backup integrity
- [ ] Test disaster recovery plan

### Quarterly Tasks
- [ ] Security audit of code changes
- [ ] Penetration testing (if budget allows)
- [ ] Review firewall rules
- [ ] Assess new vulnerabilities in tech stack
- [ ] Update SSL certificate (if not auto-renewed)

### Annual Tasks
- [ ] Full security assessment
- [ ] Compliance audit (GDPR, PCI-DSS, etc.)
- [ ] Architecture security review
- [ ] Update disaster recovery plan
- [ ] Security training for team

---

## 17. Resources & References

### Security Tools
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **pip audit**: https://github.com/pypa/pip-audit
- **npm audit**: https://docs.npmjs.com/cli/v10/commands/npm-audit
- **NIST Guidelines**: https://csrc.nist.gov/
- **CWE List**: https://cwe.mitre.org/

### Learning Resources
- **OWASP Testing Guide**: https://owasp.org/www-project-web-security-testing-guide/
- **PortSwigger Web Security**: https://portswigger.net/web-security
- **HackTheBox**: https://www.hackthebox.com/
- **TryHackMe**: https://tryhackme.com/

### Monitoring Tools
- **Datadog**: https://www.datadoghq.com/
- **New Relic**: https://newrelic.com/
- **Splunk**: https://www.splunk.com/
- **ELK Stack**: https://www.elastic.co/

---

## Support & Updates

For security vulnerabilities or questions, please:
1. **Report privately**: security@yourdomain.com
2. **Do not post on public issue trackers**
3. **Allow 72 hours for response**
4. **Follow responsible disclosure guidelines**

---

**Last Updated**: 2026-04-19
**Version**: 1.0
**Status**: Production Ready

