# HTTPS/SSL-TLS Setup Guide for BuildShop

This guide covers setting up HTTPS with SSL/TLS certificates for production deployment of BuildShop.

## Option 1: Let's Encrypt with Certbot (Recommended for Production)

Let's Encrypt provides free, automated SSL certificates valid for 90 days with auto-renewal.

### Prerequisites
- Domain name pointing to your server
- VPS/server with public IP
- Port 80 and 443 open
- `certbot` and `certbot-nginx` installed

### Installation (Ubuntu/Debian)

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx -y

# Generate certificate
sudo certbot certonly --standalone \
  -d yourdomain.com \
  -d www.yourdomain.com \
  --email admin@yourdomain.com \
  --agree-tos \
  --non-interactive
```

### Certificates Location
After successful generation, certificates are located at:
```
/etc/letsencrypt/live/yourdomain.com/
├── fullchain.pem       # Certificate chain (use this for nginx ssl_certificate)
├── privkey.pem         # Private key (use this for nginx ssl_certificate_key)
├── cert.pem           # Your certificate
└── chain.pem          # Certificate chain
```

### Docker Mount Configuration

Update `docker-compose.prod.yml` to mount certificates:

```yaml
nginx:
  image: nginx:1.27-alpine
  volumes:
    - ./infra/nginx/buildshop.conf:/etc/nginx/conf.d/default.conf:ro
    - /etc/letsencrypt/live/yourdomain.com:/etc/nginx/ssl:ro
    - /etc/letsencrypt/ssl-dhparams.pem:/etc/nginx/ssl/dhparam.pem:ro
  ports:
    - '80:80'
    - '443:443'
```

### Nginx Configuration

Uncomment/enable HTTPS in `infra/nginx/buildshop.conf`:

```nginx
# HTTP to HTTPS redirect
server {
  listen 80;
  listen [::]:80;
  server_name yourdomain.com www.yourdomain.com;
  
  # Allow certbot renewal (ACME challenge)
  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }
  
  # Redirect all other HTTP traffic to HTTPS
  location / {
    return 301 https://$server_name$request_uri;
  }
}

# HTTPS server
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name yourdomain.com www.yourdomain.com;

  # SSL configuration
  ssl_certificate /etc/nginx/ssl/fullchain.pem;
  ssl_certificate_key /etc/nginx/ssl/privkey.pem;
  
  # Strong SSL configuration
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;
  
  # DH parameters (generate with: openssl dhparam -out dhparam.pem 4096)
  ssl_dhparam /etc/nginx/ssl/dhparam.pem;
  
  # Session configuration
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 10m;
  ssl_session_tickets off;
  
  # HSTS header
  add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
  
  # ... rest of nginx configuration ...
}
```

### Auto-Renewal Setup

```bash
# Test auto-renewal
sudo certbot renew --dry-run

# Enable automatic renewal (runs twice daily)
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Check timer status
sudo systemctl status certbot.timer

# View renewal log
sudo journalctl -u certbot.timer
```

### Verification

```bash
# Check certificate validity
sudo certbot certificates

# Check certificate expiration
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates

# Test SSL configuration
curl -I https://yourdomain.com

# Check SSL grade (online)
# https://www.ssllabs.com/ssltest/analyze.html?d=yourdomain.com
```

---

## Option 2: Self-Signed Certificate (Development/Testing Only)

Self-signed certificates are useful for testing but will trigger browser warnings in production.

### Generate Self-Signed Certificate

```bash
# Generate 2048-bit RSA private key and self-signed certificate
openssl req -x509 -newkey rsa:2048 -nodes \
  -out cert.pem -keyout key.pem \
  -days 365 \
  -subj "/C=UA/ST=Kyiv/L=Kyiv/O=BuildShop/CN=localhost"

# Or generate 4096-bit for more security
openssl req -x509 -newkey rsa:4096 -nodes \
  -out cert.pem -keyout key.pem \
  -days 365 \
  -subj "/C=UA/ST=Kyiv/L=Kyiv/O=BuildShop/CN=yourdomain.local"
```

### Create DH Parameters (Optional but Recommended)

```bash
# Generate Diffie-Hellman parameters (takes a few minutes)
openssl dhparam -out dhparam.pem 2048

# Or for stronger security (takes longer):
openssl dhparam -out dhparam.pem 4096
```

### Docker Mount Configuration

```yaml
nginx:
  volumes:
    - ./ssl/cert.pem:/etc/nginx/ssl/cert.pem:ro
    - ./ssl/key.pem:/etc/nginx/ssl/key.pem:ro
    - ./ssl/dhparam.pem:/etc/nginx/ssl/dhparam.pem:ro
```

### Test with Self-Signed Cert

```bash
# Verify certificate
openssl x509 -in cert.pem -text -noout

# Test with curl (ignoring self-signed warning)
curl -k -I https://localhost
```

---

## Option 3: Cloud Provider Managed SSL (Recommended for Cloud Deployments)

### AWS
- **CloudFront**: Managed SSL with AWS Certificate Manager
- **Application Load Balancer (ALB)**: Built-in SSL termination
- **Elastic Beanstalk**: Automatic SSL provisioning

### Vercel
```bash
# Vercel handles SSL automatically for all deployments
# Just configure your custom domain in Vercel dashboard
```

### Netlify
```bash
# Netlify provides automatic SSL certificates via Let's Encrypt
# Enable in Site settings > Domain management
```

### DigitalOcean
```bash
# Use Let's Encrypt with certbot on DigitalOcean Droplets
# Or use managed certificates with DigitalOcean App Platform
```

---

## Nginx SSL Configuration Best Practices

### Modern TLS Configuration
```nginx
# Recommend TLS 1.2+ only (TLS 1.0/1.1 deprecated)
ssl_protocols TLSv1.2 TLSv1.3;

# Strong cipher suites
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';

# Prefer server ciphers
ssl_prefer_server_ciphers on;

# Session optimization
ssl_session_cache shared:SSL:50m;
ssl_session_timeout 1d;
ssl_session_tickets off;
```

### Security Headers
```nginx
# Enable HSTS for 2 years with subdomains
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

# Prevent content-type sniffing
add_header X-Content-Type-Options "nosniff" always;

# Prevent clickjacking
add_header X-Frame-Options "DENY" always;

# Enable browser XSS protection
add_header X-XSS-Protection "1; mode=block" always;

# Referrer policy
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### Performance Optimization
```nginx
# Enable HTTP/2 for faster loading
listen 443 ssl http2;

# OCSP stapling (if using Let's Encrypt)
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/nginx/ssl/fullchain.pem;

# Connection optimization
keepalive_timeout 65;
```

---

## Testing & Validation

### Online SSL Testing
- **SSL Labs**: https://www.ssllabs.com/ssltest/
- **HTTP Observatory**: https://observatory.mozilla.org/
- **Qualys SSL**: https://www.qualys.com/forms/freescan/
- **Testify**: https://testssl.sh/

### Command-Line Testing

```bash
# Check certificate details
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -text

# Verify certificate chain
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -nameopt RFC2253 -subject

# Check TLS versions supported
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 -tls1_2 2>/dev/null
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 -tls1_3 2>/dev/null

# Verify with curl
curl -v https://yourdomain.com

# Check HTTP to HTTPS redirect
curl -I http://yourdomain.com
```

---

## Troubleshooting

### Certificate Issues

**Issue**: Certificate verification fails
```bash
# Solution: Check certificate validity
sudo certbot certificates
sudo certbot renew --force-renewal
```

**Issue**: Port 443 already in use
```bash
# Solution: Find and stop the process
lsof -i :443
kill -9 <PID>
```

**Issue**: DNS resolution fails
```bash
# Solution: Verify DNS configuration
nslookup yourdomain.com
dig yourdomain.com

# Check DNS propagation
# https://www.whatsmydns.net/
```

### Nginx Configuration

**Issue**: Nginx won't restart after SSL config
```bash
# Solution: Test configuration
sudo nginx -t

# View error log
sudo tail -f /var/log/nginx/error.log
```

**Issue**: Mixed content warning (HTTPS + HTTP resources)
```nginx
# Solution: Update all resource URLs to HTTPS
# Check for hardcoded http:// URLs in code
grep -r "http://" ./client/src/ || true
```

---

## Renewal Warnings

### Certbot Renewal Automation Issues

```bash
# Check renewal status
sudo certbot renew --dry-run --verbose

# Manual renewal
sudo certbot renew

# If renewal fails:
# 1. Check disk space: df -h
# 2. Check firewall rules for port 80/443
# 3. Check domain DNS resolution
# 4. Check certificate rate limits (50 per domain per week)
```

---

## Security Hardening After SSL Setup

### Update docker-compose.prod.yml

```yaml
version: '3.9'

services:
  nginx:
    image: nginx:1.27-alpine
    volumes:
      - ./infra/nginx/buildshop.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt/live/yourdomain.com:/etc/nginx/ssl:ro
    ports:
      - '80:80'
      - '443:443'  # Enable HTTPS
    environment:
      - DOMAIN=yourdomain.com
```

### Verify Security Headers

```bash
# Check all security headers are present
curl -I https://yourdomain.com | grep -E "Strict-Transport|X-Content|X-Frame|X-XSS|Referrer|CSP"

# Should output:
# Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Referrer-Policy: strict-origin-when-cross-origin
# Content-Security-Policy: default-src 'self'; ...
```

---

## Certificate Monitoring

### Set Up Renewal Alerts

```bash
# Add to crontab to check certificate expiration weekly
0 0 * * 1 certbot renew --quiet && systemctl reload nginx

# Alternative: Monitor with Prometheus/Grafana
# Export metric: certbot_expiry_seconds_until_renewal
```

### Monitor with Email Alerts

```bash
# Certbot sends renewal failure emails automatically
# Ensure mail is configured on the server

# Test mail delivery
echo "Test email" | mail -s "Test" admin@yourdomain.com
```

---

## Production Deployment Checklist

- [ ] Domain points to correct IP address
- [ ] Ports 80 and 443 are open in firewall
- [ ] SSL certificate installed and valid
- [ ] HTTP redirects to HTTPS
- [ ] HSTS header is enabled
- [ ] Security headers are present
- [ ] Certificate renewal is automated
- [ ] SSL grade is A+ on SSL Labs
- [ ] No mixed content warnings
- [ ] Performance optimization enabled (HTTP/2, compression)
- [ ] Log rotation configured
- [ ] Monitoring and alerts set up

---

**Last Updated**: 2026-04-19
**Status**: Production Ready

