# Robin - Smart Mail Scanner

Scan your postal mail, understand it, categorize it, and decide what to do next.

## Features
- 📷 Scan mail via camera or photo upload
- 🔍 OCR text extraction (Google Cloud Vision)
- 🧠 AI-powered categorization & summarization (OpenAI)
- ⚡ Suggested actions (Archive, Reply, Pay, Schedule, Discard)
- � User accounts with JWT authentication
- 🐘 PostgreSQL database for persistent storage
- 🐳 Docker Compose for one-command deployment
- 📱 Mobile-friendly PWA

## Quick Start (Docker)

1. **Clone & configure:**
   ```bash
   cp .env.docker .env
   # Edit .env and fill in your GOOGLE_CLOUD_API_KEY, OPENAI_API_KEY, JWT_SECRET
   ```

2. **Start everything:**
   ```bash
   docker compose up -d
   ```

3. Open [http://localhost](http://localhost) — create an account and start scanning!

## Development (without Docker)

1. **Start PostgreSQL** (e.g. via Docker):
   ```bash
   docker run -d --name robin-db -p 5432:5432 \
     -e POSTGRES_USER=robin -e POSTGRES_PASSWORD=robin_secret -e POSTGRES_DB=robin \
     postgres:16-alpine
   ```

2. **Install dependencies:**
   ```bash
   npm run install:all
   ```

3. **Configure** — copy `.env.example` to `server/.env` and fill in API keys

4. **Run database migrations:**
   ```bash
   cd server && npx prisma migrate dev --name init
   ```

5. **Run the app:**
   ```bash
   npm run dev
   ```

6. Open [http://localhost:5173](http://localhost:5173)

## Getting API Keys

### Google Cloud Vision
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Cloud Vision API**
3. Create an API key under Credentials

### OpenAI
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an API key

## Tech Stack
- **Frontend:** React + Vite + React Router
- **Backend:** Express.js + Prisma ORM
- **Database:** PostgreSQL (Docker volume for persistence)
- **Auth:** JWT + bcrypt
- **OCR:** Google Cloud Vision API
- **AI:** OpenAI GPT-4o-mini
- **Deployment:** Docker Compose (nginx + Node + Postgres)
