#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-remote}"
NO_RESTART="${2:-}"

# This script lives at infra/pi-remote/scripts/; the repo root is three levels up.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PI_HOST="${PI_HOST:-10.52.20.121}"
PI_USER="${PI_USER:-asgtech}"
PI_PROJECT_DIR="${PI_PROJECT_DIR:-/home/asgtech/Desktop/Cursor}"
SSH_TARGET="${PI_USER}@${PI_HOST}"

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required. Install with: brew install rsync"
  exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "ssh is required."
  exit 1
fi

echo "Checking SSH connectivity to ${SSH_TARGET}..."
if ! ssh -o ConnectTimeout=6 "${SSH_TARGET}" "echo ok" >/dev/null 2>&1; then
  echo "Could not reach ${SSH_TARGET} via SSH."
  echo "Verify network access and SSH credentials, then retry."
  exit 1
fi

sync_paths() {
  local -a rel_paths=("$@")
  local -a abs_paths=()
  for rel in "${rel_paths[@]}"; do
    abs_paths+=("${REPO_ROOT}/${rel}")
  done
  rsync -az "${abs_paths[@]}" "${SSH_TARGET}:${PI_PROJECT_DIR}/"
}

case "${MODE}" in
  remote)
    echo "Syncing remote UI files..."
    sync_paths \
      "infra/pi-remote/index.html" \
      "infra/pi-remote/server.js" \
      "infra/pi-remote/previews/" \
      "apps/admin-hub/asg-remote/index.html" \
      "apps/admin-hub/asg-remote/server.js"
    if [[ "${NO_RESTART}" != "--no-restart" ]]; then
      echo "Restarting tv-remote service..."
      ssh "${SSH_TARGET}" "sudo systemctl restart tv-remote && sudo systemctl status tv-remote --no-pager -n 12"
    fi
    ;;
  dashboard)
    echo "Syncing dashboard files..."
    sync_paths \
      "apps/admin-hub/components/tv-dashboard-multiview.html"
    if [[ "${NO_RESTART}" != "--no-restart" ]]; then
      echo "Restarting tv-remote and kiosk services..."
      ssh "${SSH_TARGET}" "sudo systemctl restart tv-remote tv-dashboard-kiosk && sudo systemctl status tv-dashboard-kiosk --no-pager -n 12"
    fi
    ;;
  all)
    echo "Syncing full workspace (excluding .git/node_modules)..."
    rsync -az \
      --exclude ".git" \
      --exclude "node_modules" \
      --exclude ".DS_Store" \
      "${REPO_ROOT}/" "${SSH_TARGET}:${PI_PROJECT_DIR}/"
    if [[ "${NO_RESTART}" != "--no-restart" ]]; then
      echo "Restarting tv-remote and kiosk services..."
      ssh "${SSH_TARGET}" "sudo systemctl restart tv-remote tv-dashboard-kiosk && sudo systemctl status tv-remote --no-pager -n 12"
    fi
    ;;
  *)
    echo "Usage: bash infra/pi-remote/scripts/deploy-pi.sh [remote|dashboard|all] [--no-restart]"
    exit 1
    ;;
esac

echo "Deploy complete."
