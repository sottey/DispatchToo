#!/bin/sh
set -eu

echo "[dispatch] Initializing database schema..."
node /app/docker/repair-migrations.js
npm run db:migrate

echo "[dispatch] Starting application and MCP server..."
exec npm run start:all
