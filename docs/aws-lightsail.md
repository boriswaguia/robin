# Robin — AWS Lightsail Deployment Guide

Deploy & update Robin on an **AWS Lightsail** instance running Docker Compose.

---

## 1. Prerequisites

| Requirement | Details |
|---|---|
| **Lightsail plan** | Minimum **1 GB RAM / 1 vCPU** ($5/mo). 2 GB recommended for comfort. |
| **OS blueprint** | **Ubuntu 22.04 LTS** (or newer) |
| **Static IP** | Allocate and attach a Lightsail static IP |
| **Firewall** | Open port **80** (HTTP) and optionally **443** (HTTPS). SSH (22) is open by default. |
| **Domain (optional)** | Point an A record to the static IP |

You'll also need a **Gemini API key** — get one free at <https://ai.google.dev>.

---

## 2. Initial Server Setup

### 2.1 SSH into the instance

Use the Lightsail browser console, or:

```bash
ssh -i ~/LightsailKey.pem ubuntu@<STATIC-IP>
```

### 2.2 Install Docker & Docker Compose

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add your user to the docker group (avoids sudo for docker commands)
sudo usermod -aG docker ubuntu
newgrp docker

# Verify
docker --version
docker compose version
```

### 2.3 Clone the repository

```bash
cd ~
git clone https://github.com/<your-org>/robin.git
cd robin
```

> If the repo is private, set up a [deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys) or use a personal access token.

### 2.4 Create the environment file

```bash
cp .env.example .env
nano .env
```

Fill in the values:

```env
GEMINI_API_KEY=<your-gemini-api-key>
POSTGRES_PASSWORD=<strong-random-password>
JWT_SECRET=<long-random-secret>
```

Generate secure random values:

```bash
# JWT secret
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Postgres password
openssl rand -base64 24
```

> **Never commit `.env` to version control.** The `.gitignore` already excludes it.

### 2.5 Build & start

```bash
docker compose up -d --build
```

This will:
1. Start **PostgreSQL 16** with a persistent `pgdata` volume
2. Build the **server** image, run Prisma migrations (`prisma migrate deploy`), and start the API on port 3001 (internal only)
3. Build the **client** image (Vite → Nginx), serve the SPA on port 80, and reverse-proxy `/api/` and `/uploads/` to the server

### 2.6 Verify

```bash
# Check all 3 containers are running
docker compose ps

# Check server logs
docker compose logs server --tail 50

# Quick health check
curl http://localhost/api/health
```

Visit `http://<STATIC-IP>` in a browser — you should see the Robin login screen.

---

## 3. Updating the App

### 3.1 Standard update (no downtime-sensitive)

```bash
cd ~/robin

# Pull latest code
git pull origin main

# Rebuild and restart (only rebuilds changed images)
docker compose up -d --build
```

The server container runs `prisma migrate deploy` on every start, so **database migrations are applied automatically**.

### 3.2 Zero-rebuild quick restarts

If only environment variables changed (no code changes):

```bash
nano .env
docker compose up -d   # recreates containers with new env
```

### 3.3 Full clean rebuild

If you need to force-rebuild everything from scratch (e.g., npm dependency changes):

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

### 3.4 Rolling back

```bash
cd ~/robin
git log --oneline -5          # find the commit to roll back to
git checkout <commit-hash>
docker compose up -d --build
```

---

## 4. Database Management

### 4.1 Backups

```bash
# Dump the database to a SQL file
docker compose exec db pg_dump -U robin robin > backup_$(date +%F).sql

# Automate with cron (daily at 3 AM)
crontab -e
# Add:
0 3 * * * cd /home/ubuntu/robin && docker compose exec -T db pg_dump -U robin robin > /home/ubuntu/backups/robin_$(date +\%F).sql
```

### 4.2 Restore from backup

```bash
# Drop and recreate
docker compose exec -T db psql -U robin -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Restore
docker compose exec -T db psql -U robin robin < backup_2026-03-08.sql
```

### 4.3 Access the database directly

```bash
docker compose exec db psql -U robin robin
```

---

## 5. Adding HTTPS with Let's Encrypt (Recommended)

### Option A: Caddy reverse proxy (simplest)

Install Caddy on the host and proxy to the Docker container:

```bash
sudo apt install -y caddy
```

Edit `/etc/caddy/Caddyfile`:

```
your-domain.com {
    reverse_proxy localhost:80
}
```

Update `docker-compose.yml` to map port 80 to a different host port (e.g., `8080:80`) so Caddy can own port 80/443:

```yaml
  client:
    ports:
      - "8080:80"   # was "80:80"
```

Then:

```bash
docker compose up -d
sudo systemctl restart caddy
```

Caddy automatically obtains and renews TLS certificates.

### Option B: Certbot + Nginx on host

If you prefer Nginx on the host:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Proxy to Docker
# In /etc/nginx/sites-available/robin:
server {
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10M;
    }
}
```

Again, remap the Docker port to `8080:80` as shown above.

---

## 6. Monitoring & Logs

```bash
# Live logs for all services
docker compose logs -f

# Only server
docker compose logs -f server

# Only last 100 lines
docker compose logs --tail 100 server

# Disk usage
docker system df
```

---

## 7. Useful Commands Reference

| Task | Command |
|---|---|
| Start all services | `docker compose up -d` |
| Stop all services | `docker compose down` |
| Rebuild & restart | `docker compose up -d --build` |
| View running containers | `docker compose ps` |
| Server logs | `docker compose logs -f server` |
| DB shell | `docker compose exec db psql -U robin robin` |
| DB backup | `docker compose exec -T db pg_dump -U robin robin > backup.sql` |
| Run a migration manually | `docker compose exec server npx prisma migrate deploy` |
| Prune unused images | `docker image prune -f` |
| Full system prune | `docker system prune -af` |

---

## 8. Troubleshooting

**Containers won't start**
```bash
docker compose logs        # check for error messages
docker compose down        # stop everything
docker compose up --build  # rebuild without -d to see output live
```

**Port 80 already in use**
```bash
sudo lsof -i :80          # find what's using it
sudo systemctl stop apache2  # common culprit on Ubuntu
```

**Database connection refused**
```bash
# Ensure db container is healthy
docker compose ps
# If needed, remove the volume and recreate
docker compose down -v     # ⚠️ WARNING: deletes all data
docker compose up -d --build
```

**Out of disk space**
```bash
docker system prune -af    # remove unused images/containers
sudo apt autoremove        # remove unused apt packages
```
