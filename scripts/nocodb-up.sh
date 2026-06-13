#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env ]]; then
  echo "Missing .env file" >&2
  exit 1
fi

if ! grep -q '^NOCODB_DATABASE_URL=.' .env; then
  echo "Missing required env var: NOCODB_DATABASE_URL" >&2
  exit 1
fi

docker compose -f docker-compose.nocodb.yml up -d
