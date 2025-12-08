# RG Shop Billing - Enterprise Security Package

This document outlines the security hardening protocols, firewall rules, and configurations required to deploy this application securely in an enterprise environment.

## 1. Network Security & Firewall

### UFW (Uncomplicated Firewall) - Linux Server
Run these commands on your Ubuntu/Debian server to lock down ports.

```bash
# Deny all incoming by default
sudo ufw default deny incoming
# Allow all outgoing
sudo ufw default allow outgoing

# Allow SSH (Ideally restrict this to your VPN/Static IP)
sudo ufw allow ssh 
# OR for specific IP: sudo ufw allow from 203.0.113.0/24 to any port 22

# Allow Web Traffic
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable Firewall
sudo ufw enable
```

### Fail2Ban (Prevent Brute Force)
Install `fail2ban` to protect SSH.
```bash
sudo apt install fail2ban
# Create local config
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo systemctl restart fail2ban
```

---

## 2. NGINX Hardening & WAF

Use NGINX as a reverse proxy in front of the Node.js app.

**File:** `/etc/nginx/conf.d/shop-billing.conf`

```nginx
server {
    listen 80;
    server_name your-shop-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-shop-domain.com;

    # SSL Certificates (Use Certbot)
    ssl_certificate /etc/letsencrypt/live/your-shop-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-shop-domain.com/privkey.pem;

    # SSL Hardening
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers "EECDH+AESGCM:EDH+AESGCM:AES256+EECDH:AES256+EDH";

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com https://cdn.tailwindcss.com; img-src 'self' data: https:;" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=one:10m rate=10r/s;

    location / {
        limit_req zone=one burst=20 nodelay;
        
        proxy_pass http://localhost:3000; # Assuming app runs on 3000
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Hide backend details
        proxy_hide_header X-Powered-By;
    }
}
```

---

## 3. Application Hardening (Node.js)

1. **Helmet:** Use `helmet` middleware in your Express `server.js` (if you export the app).
2. **Rate Limiting:** Use `express-rate-limit` for API routes.
3. **Dependencies:** Run `npm audit` regularly.

### Secrets Management
NEVER commit `.env` files.
- **Production:** Use AWS Secrets Manager, Google Secret Manager, or Docker Secrets.
- **CI/CD:** Use GitHub Secrets for injection during build.

---

## 4. Docker / Container Security

If deploying via Docker, use this hardened `Dockerfile` approach:

```dockerfile
# Use minimal base image
FROM node:20-alpine

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only package files first (caching)
COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Change ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

EXPOSE 3000
CMD ["npm", "start"]
```

**Run arguments:**
```bash
docker run -d \
  --name rg-billing \
  --restart always \
  --read-only \
  --cap-drop ALL \
  -p 3000:3000 \
  rg-billing:latest
```

---

## 5. Incident Response Plan (Brief)

1. **Detection:** Monitor logs (ELK Stack / CloudWatch) for 4xx/5xx spikes or repeated failed logins.
2. **Containment:** 
   - Block attacking IP via UFW: `sudo ufw deny from 1.2.3.4`
   - If severe, stop the container: `docker stop rg-billing`
3. **Eradication:** Patch the vulnerability (Code fix or dependency update).
4. **Recovery:** Restore database from encrypted backup if data corruption occurred.
5. **Post-Mortem:** Document how the breach happened and update WAF rules.

