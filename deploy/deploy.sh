#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/lexiflow}"
BRANCH="${BRANCH:-main}"

echo "==> [1/7] Entering $APP_DIR and pulling latest code ($BRANCH)..."
cd "$APP_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> [2/7] Ensuring PostgreSQL container is running..."
docker compose up -d db

echo "==> [3/7] Installing backend dependencies and building TypeScript..."
npm ci --prefix server
npx --prefix server prisma generate
npx --prefix server prisma migrate deploy
npm run build --prefix server

echo "==> [4/7] Pruning backend devDependencies..."
npm prune --omit=dev --prefix server

echo "==> [5/7] Installing frontend dependencies and building dist/..."
npm ci --prefix client
npm run build --prefix client

echo "==> [6/7] Reloading Express API via PM2..."
pm2 startOrReload deploy/ecosystem.config.cjs --env production
pm2 save

echo "==> [7/7] Verifying API health endpoint..."
sleep 2
curl -fsS http://127.0.0.1:4000/api/health
echo ""
echo "==> Deployment completed successfully!"
