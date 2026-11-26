English | [简体中文](./README.zh-CN.md)

# LexiFlow

An interactive full-stack English learning web application built for practical vocabulary acquisition, context-driven quizzes, and bilingual reading practice.

## Features

- **Daily Expressions**: Curated everyday and workplace idioms with US/UK accent switching and adjustable speech speed (`0.8x` / `1.0x`).
- **Interactive Vocabulary Flashcards**: 3D flip cards with IPA phonetics, English definitions, bilingual example sentences, CEFR level/category filtering, and mastery tracking.
- **Context Quiz**: Dynamically generated 4-choice vocabulary quizzes with instant example-based explanations and score history.
- **Bilingual Reading Lab**: Side-by-side English and Chinese reading mode, full-article text-to-speech, clickable key expression chips, and completion tracking.
- **Account & Guest Modes** *(in progress)*: Instant guest exploration plus authenticated cloud sync backed by PostgreSQL and Prisma.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Lucide Icons, Web Speech API
- **Backend**: Node.js, Express, TypeScript, Prisma ORM, PostgreSQL 16, Zod, Helmet
- **Testing & CI**: Node.js built-in test runner (`node:test` + `tsx`), GitHub Actions with PostgreSQL service

## Project Structure

```text
lexiflow/
├── client/                  # React + Vite + TypeScript frontend
├── server/                  # Express + TypeScript + Prisma REST API
│   ├── prisma/              # Prisma schema, migrations, and seed script
│   ├── src/
│   │   ├── config/          # Zod-validated environment configuration
│   │   ├── db/              # Shared Prisma client
│   │   ├── middleware/      # Auth, validation, and rate limiting
│   │   ├── routes/          # REST API route modules
│   │   └── utils/           # Password hashing (scrypt) and JWT helpers
│   └── tests/               # Unit and PostgreSQL integration tests
├── deploy/                  # Nginx, PM2, and VPS deployment scripts
├── docker-compose.yml       # Local/production PostgreSQL 16 service
└── .github/workflows/       # Automated CI checks
```

## Local Development

### Prerequisites

- Node.js 20+ (22 LTS recommended)
- Docker Desktop / Docker Engine (for PostgreSQL 16)

### Setup & Run

```bash
# 1. Start PostgreSQL 16 in Docker (bound to 127.0.0.1:5432)
npm run db:up

# 2. Configure server environment variables
cp .env.example server/.env

# 3. Install dependencies and generate Prisma client
npm run install:all
npm run db:generate --prefix server

# 4. Run database migrations, seed initial articles, and import ~4,500 core dictionary entries
npm run db:migrate
npm run db:seed
npm run db:import-dict

# 5. Start the backend API (http://localhost:4000)
npm run dev:server

# 6. In another terminal, start the frontend dev server (http://localhost:5173)
npm run dev:client
```

## Testing & Building

```bash
# Run backend unit tests (no database required)
npm run test:unit --prefix server

# Run full backend unit + PostgreSQL integration tests
npm test

# Type-check & build both backend and frontend
npm run build
```

## Production Deployment Overview

The `deploy/` directory and `docker-compose.yml` provide a hybrid production setup:
- `docker-compose.yml`: Runs PostgreSQL 16 bound to `127.0.0.1:5432` with persistent volume storage.
- `deploy/setup-vps.sh`: Bootstraps Ubuntu 24.04/22.04 LTS with swap, UFW firewall, Nginx, Node.js 22, PM2, and Docker Compose.
- `deploy/ecosystem.config.cjs`: Runs the compiled Express server (`server/dist/index.js`) under PM2.
- `deploy/nginx/lexiflow.conf`: Serves static frontend files from `client/dist/` with SPA fallback and proxies `/api/` to `127.0.0.1:4000`.
- `deploy/deploy.sh`: Pulls updates, runs `prisma migrate deploy`, rebuilds server & client bundles, and reloads PM2.
- `deploy/backup-db.sh`: Runs compressed `pg_dump` PostgreSQL backups with configurable retention.
- `.github/workflows/deploy.yml`: CI-gated SSH auto-deployment to VPS when `VPS_HOST`, `VPS_USER`, and `VPS_SSH_KEY` secrets are configured.

## Roadmap

- [x] PostgreSQL + Prisma data layer, TypeScript backend, and Cookie JWT authentication
- [x] Backend SM-2 spaced repetition engine, 90-day heatmap analytics, dictionary cache, article import, and optional AI endpoints
- [x] Frontend UI upgrade (Dashboard heatmap, SRS review queue, click-to-lookup reader, auth modal & dark mode)
- [x] Production deployment automation & database backup runbook
- [ ] Multi-deck vocabulary lists & CSV/JSON import/export
