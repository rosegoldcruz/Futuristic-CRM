#!/usr/bin/env bash

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PM2_APP_NAME="${PM2_APP_NAME:-vulpine-command-center}"
VERIFY_URL="${VERIFY_URL:-https://crm.vulpinehomes.com/login}"
COMMIT_MESSAGE="${1:-deploy update}"

cd "$REPO_DIR"

echo "==> Repo: $REPO_DIR"
echo "==> Branch: $(git branch --show-current)"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "==> Staging changes"
  git add -A

  if git diff --cached --quiet; then
    echo "==> No staged changes to commit"
  else
    echo "==> Committing: $COMMIT_MESSAGE"
    git commit -m "$COMMIT_MESSAGE"
  fi
else
  echo "==> No local changes to commit"
fi

echo "==> Pushing to GitHub"
git push

echo "==> Installing dependencies if package files changed"
if git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -Eq '^(package-lock\.json|package\.json)$'; then
  npm install
else
  echo "==> package.json/package-lock.json unchanged; skipping npm install"
fi

echo "==> Removing old Next.js production bundle"
rm -rf .next

echo "==> Building clean Next.js production bundle"
npm run build

echo "==> Restarting PM2 app: $PM2_APP_NAME"
pm2 restart "$PM2_APP_NAME" --update-env

echo "==> Saving PM2 process list"
pm2 save

echo "==> PM2 status"
pm2 list

echo "==> Verifying live URL: $VERIFY_URL"
curl -I --max-time 20 --retry 10 --retry-delay 2 --retry-connrefused "$VERIFY_URL"

echo "==> Done. Refresh the browser with Ctrl+F5 if old Next.js assets are cached."