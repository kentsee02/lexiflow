#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/lexiflow}"
BRANCH="${BRANCH:-main}"

echo "==> [1/5] Entering $APP_DIR and pulling latest code ($BRANCH)..."
cd "$APP_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> [2/5] Installing backend dependencies..."
npm ci --prefix server --omit=dev

echo "==> [3/5] Installing frontend dependencies and building dist/..."
npm ci --prefix client
npm run build --prefix client

echo "==> [4/5] Reloading Express API via PM2..."
pm2 startOrReload deploy/ecosystem.config.cjs --env production
pm2 save

echo "==> [5/5] Verifying API health endpoint..."
sleep 2
curl -fsS http://127.0.0.1:4000/api/health
echo ""
echo "==> Deployment completed successfully!"
