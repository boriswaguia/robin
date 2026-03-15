# Robin — Deployment Guide

## Table of Contents
1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [Environment Variables](#environment-variables)
4. [Production Deployment (Docker)](#production-deployment-docker)
5. [Development Setup (Local)](#development-setup-local)
6. [Database Management](#database-management)
7. [Updating the App](#updating-the-app)
8. [Backups](#backups)
9. [Troubleshooting](#troubleshooting)

---

## Architecture

```
                    ┌──────────────────────────────────────┐
                    │           Docker Compose              │
                    │                                       │
  Browser/Phone ───►│  client (Nginx :80)                  │
                    │     │  serves React SPA               │
                    │     │  proxies /api/* and /uploads/*  │
                    │     ▼                                 │
                    │  server (Node.js :3001)               │
                    │     │  Express REST API               │
                    │     │  Prisma ORM                     │
                    │     ▼                                 │
                    │  db (PostgreSQL :5432)                │
                    │     └── pgdata volume (persistent)    │
                    │                                       │
                    │  uploads volume (persistent images)   │
                    └──────────────────────────────────────┘
```

**Ports exposed to host:**
| Container | Host Port | Purpose |
|-----------|-----------|---------|
| `client` | `80` | Public web interface |
| `server` | `3001` | API (optional, for direct access) |
| `db` | `5432` | Database (optional, for tooling) |

In production you may want to remove the `db` and `server` host port mappings and only expose port `80`.

---

## Prerequisites

### Production
- Docker Engine 24+
- Docker Compose v2
- A [Google Gemini API key](https://ai.google.dev) for OCR + AI analysis

### Development (local, no Docker)
- Node.js 20+
- PostgreSQL 16 (or run only the db via Docker — see below)
- A Gemini API key (same as above)

---

## Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.docker .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for OCR + AI analysis |
| `JWT_SECRET` | Yes | Secret for signing JWTs — use a long random string |
| `ENCRYPTION_KEY` | Yes | AES-256-GCM key (64 hex chars / 32 bytes) for data-at-rest encryption |
| `POSTGRES_PASSWORD` | Yes (Docker) | PostgreSQL password — set automatically in compose |
| `DATABASE_URL` | Auto | Set automatically by docker-compose; only needed for local dev |
| `GOOGLE_CLIENT_ID` | No | Gmail OAuth client ID (for Gmail sync) |
| `GOOGLE_CLIENT_SECRET` | No | Gmail OAuth client secret |
| `GOOGLE_REDIRECT_URI` | No | Gmail OAuth redirect URI (e.g. `https://yourdomain.com/api/gmail/callback`) |
| `VAPID_PUBLIC_KEY` | No | Web Push VAPID public key (for push notifications) |
| `VAPID_PRIVATE_KEY` | No | Web Push VAPID private key |
| `VAPID_EMAIL` | No | Contact email for VAPID (e.g. `mailto:you@example.com`) |
| `ADMIN_EMAIL` | No | Auto-promote this user to admin on server start |
| `PORT` | No | Server port, defaults to `3001` |

**Generating a secure JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Production Deployment (Docker)

### First-time setup

```bash
# 1. Clone the repo
git clone <your-repo-url> robin
cd robin

# 2. Create the env file
cp .env.docker .env

# 3. Edit .env and add your API keys
notepad .env        # Windows
# or
nano .env           # Linux/macOS

# 4. Build and start all services
docker compose up -d --build

# 5. Confirm everything is running
docker compose ps
```

Robin is now available at **http://localhost** (or your server's IP/domain).

The first startup automatically runs database migrations before the server starts.

---

### Starting and stopping

```bash
# Start
docker compose up -d

# Stop (data preserved)
docker compose down

# Stop and delete all data (DESTRUCTIVE)
docker compose down -v
```

---

### Viewing logs

```bash
# All services
docker compose logs -f

# Single service
docker compose logs -f server
docker compose logs -f client
docker compose logs -f db
```

---

### Running behind a domain with HTTPS

For a production server with a domain name, place Robin behind a reverse proxy such as [Caddy](https://caddyserver.com/) or [Traefik](https://traefik.io/). Example Caddy config:

```
yourdomain.com {
    reverse_proxy localhost:80
}
```

Caddy will automatically provision a TLS certificate via Let's Encrypt.

---

## Development Setup (Local)

### Option A — Full local (Node + local Postgres)

```bash
# 1. Start PostgreSQL (easiest via Docker, just the db service)
docker compose up -d db

# 2. Install all dependencies
npm run install:all

# 3. Copy and configure server env
cp .env.example server/.env
# Edit server/.env — add GOOGLE_CLOUD_API_KEY, OPENAI_API_KEY

# 4. Run database migrations
cd server
npx prisma migrate dev --name init
cd ..

# 5. Start dev servers (hot reload on both client and server)
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

The Vite dev server proxies `/api` and `/uploads` to the Express server automatically.

---

### Option B — Server in Docker, frontend local

```bash
docker compose up -d db server

cd client
npm install
npm run dev
```

The frontend (`localhost:5173`) will proxy to the server at `localhost:3001`.

---

### Prisma Studio (database GUI)

```bash
cd server
npx prisma studio
```

Opens a visual browser UI at http://localhost:5555 for inspecting and editing database records.

---

## Database Management

### Running migrations

Migrations run automatically on container start in production.

For development, after changing [server/prisma/schema.prisma](../server/prisma/schema.prisma):

```bash
cd server
npx prisma migrate dev --name describe_your_change
```

### Resetting the database (development only)

```bash
cd server
npx prisma migrate reset
```

This drops all data and re-applies all migrations from scratch.

### Connecting directly to Postgres

```bash
docker compose exec db psql -U robin -d robin
```

Useful psql commands:
```sql
\dt                          -- list tables
SELECT * FROM "User";        -- view all users
SELECT COUNT(*) FROM "Mail"; -- count mail items
\q                           -- quit
```

---

## Updating the App

```bash
# Pull latest code
git pull

# Rebuild images and restart (migrations run automatically)
docker compose up -d --build
```

Zero-downtime tip: if you have multiple instances, use `docker compose up -d --build --no-deps server` to update only the server without restarting the database.

---

## Backups

### Backup the database

```bash
docker compose exec db pg_dump -U robin robin > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore the database

```bash
cat backup_20260307_120000.sql | docker compose exec -T db psql -U robin -d robin
```

### Backup uploaded images

The `uploads` Docker volume contains the raw scanned images. Copy it to the host:

```bash
docker run --rm \
  -v robin_uploads:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/uploads_$(date +%Y%m%d).tar.gz -C /data .
```

---

## Troubleshooting

### Docker Desktop is not running
```
error during connect: open //./pipe/dockerDesktopLinuxEngine
```
Start Docker Desktop and wait for the whale icon to stop animating, then retry.

---

### Server fails to start — database not ready
The server waits for a Postgres health check before starting. If it fails:
```bash
docker compose logs db          # check Postgres logs
docker compose restart server   # retry server after db is healthy
```

---

### `GEMINI_API_KEY` warnings at build time
```
variable is not set. Defaulting to a blank string.
```
This is a warning, not an error. The key is only needed at **runtime**, not at build time. Make sure your `.env` file exists before running `docker compose up`.

---

### AI analysis returns no results
- Ensure the image is well-lit and in focus
- Check that your Gemini API key is valid and has quota remaining
- Check the server logs: `docker compose logs server`

---

### Prisma migration errors on startup
```bash
# View error details
docker compose logs server

# Manually run migrations
docker compose exec server npx prisma migrate deploy
```

---

### Port 80 already in use
Edit `docker-compose.yml` and change the client port mapping:
```yaml
ports:
  - "8080:80"   # change 80 to any free port
```
Then access Robin at http://localhost:8080.
