#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/lexiflow}"
BRANCH="${BRANCH:-main}"

echo "==> [1/7] Entering $APP_DIR and checking configuration..."
cd "$APP_DIR"
if [ ! -f "server/.env" ]; then
  echo "ERROR: server/.env is missing. Copy .env.example to server/.env and configure secrets first."
  exit 1
fi

echo "==> [2/7] Pulling latest code ($BRANCH)..."
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> [3/7] Ensuring PostgreSQL container is healthy..."
docker compose up -d db --wait

echo "==> [4/7] Installing backend deps, migrating DB, and compiling TypeScript..."
npm ci --prefix server
npm run db:generate --prefix server
npm run db:deploy --prefix server
npm run build --prefix server
npm prune --omit=dev --prefix server

echo "==> [5/7] Installing frontend deps and building client/dist..."
npm ci --prefix client
npm run build --prefix client

echo "==> [6/7] Reloading Express API via PM2..."
mkdir -p /var/log/pm2
pm2 startOrReload deploy/ecosystem.config.cjs --env production
pm2 save

echo "==> [7/7] Verifying API health endpoint..."
sleep 2
curl -fsS http://127.0.0.1:4000/api/health
echo ""
echo "==> Deployment completed successfully!"
