#!/usr/bin/env bash
set -euo pipefail

URL="${DASHBOARD_URL:-http://127.0.0.1:8080/dashboard}"
DISPLAY_NUM="${DISPLAY:-:0}"

export DISPLAY="${DISPLAY_NUM}"

# Pick installed Chromium binary name.
BROWSER_BIN="$(command -v chromium-browser || command -v chromium || true)"
if [[ -z "${BROWSER_BIN}" ]]; then
  echo "No Chromium browser binary found (chromium-browser/chromium)." >&2
  exit 1
fi

# Give the Node server a moment to come online at boot.
sleep 4

# Close existing Chromium instances to avoid stale tabs.
pkill -f "chromium" || true
sleep 1

exec "${BROWSER_BIN}" \
  --kiosk \
  --start-fullscreen \
  --disable-session-crashed-bubble \
  --disable-infobars \
  --noerrdialogs \
  --check-for-update-interval=31536000 \
  "${URL}"
