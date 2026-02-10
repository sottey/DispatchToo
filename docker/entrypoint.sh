#!/bin/sh
set -eu

echo "[dispatch] Initializing database schema..."
node /app/docker/repair-migrations.js
npm run db:migrate

echo "[dispatch] Starting server..."
exec npm run start
