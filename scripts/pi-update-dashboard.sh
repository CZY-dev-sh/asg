#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${1:-main}"

cd "${ROOT_DIR}"

echo "[1/4] Fetching latest from origin/${BRANCH}..."
git fetch origin "${BRANCH}"

echo "[2/4] Checking out ${BRANCH}..."
git checkout "${BRANCH}"

echo "[3/4] Pulling fast-forward changes..."
git pull --ff-only origin "${BRANCH}"

echo "[4/4] Restarting dashboard services..."
sudo systemctl restart tv-remote tv-dashboard-kiosk
sudo systemctl --no-pager -n 12 status tv-remote tv-dashboard-kiosk

echo "Done. Dashboard is updated on this Pi."
