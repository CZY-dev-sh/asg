# ASG TV Remote Workspace

Organized project workspace for ASG TV remote, dashboard pages, data files, and supporting scripts.

## Project Structure

- `index.html` - remote control UI for phone/tablet
- `server.js` - Node server and remote control API
- `pages/` - selected dashboard/standalone HTML pages
- `docs/` - project documentation and endpoint/design references
- `data/` - shared data files
- `scripts/start-dashboard.sh` - kiosk launcher for fullscreen dashboard
- `systemd/` - ready-to-use service files for boot automation
- `asg-admin-hub/` - dashboard components and consolidated Apps Script modules

## Quick Start

1. Install Node.js 18+.
2. Run:

   ```bash
   npm start
   ```

3. Open:

   ```text
   http://<HOST_IP>:8080
   ```

4. Open the TV dashboard on the display device:

   ```text
   http://<HOST_IP>:8080/dashboard
   ```

## Remote Access Link (Control From Anywhere)

Set a token so only authorized links can send control commands:

```bash
REMOTE_TOKEN="your-strong-token" npm start
```

Use this remote control URL on phone/laptop:

```text
http://<HOST_OR_PUBLIC_DOMAIN>:8080/?token=your-strong-token
```

If you expose the Pi publicly, place it behind HTTPS reverse proxy (Cloudflare Tunnel, Nginx Proxy Manager, or Tailscale Funnel).

## Raspberry Pi Setup Notes

Install `xdotool` on Pi:

```bash
sudo apt install xdotool
```

The server expects an X11 session on `DISPLAY=:0` when sending key events.

## Auto-start On Boot (Server + Fullscreen Dashboard)

Copy provided units:

```bash
sudo cp systemd/tv-remote.service /etc/systemd/system/
sudo cp systemd/tv-dashboard-kiosk.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tv-remote.service
sudo systemctl enable tv-dashboard-kiosk.service
sudo systemctl start tv-remote.service
sudo systemctl start tv-dashboard-kiosk.service
```

When Pi boots:
- Node server starts automatically
- Chromium opens `http://127.0.0.1:8080/dashboard` in fullscreen
- Remote URL can control dashboard immediately

## Deploy From Mac Studio

Edit locally on your Mac, then deploy to Pi with one command.

Default assumptions used by deploy script:
- Pi host: `10.52.20.121`
- SSH user: `asgtech`
- Project path on Pi: `/home/asgtech/Desktop/Cursor`

Override if needed:

```bash
PI_HOST=10.52.20.121 PI_USER=asgtech PI_PROJECT_DIR=/home/asgtech/Desktop/Cursor bash scripts/deploy-pi.sh remote
```

Common deploy commands:

```bash
# Remote UI + server + previews
npm run deploy:pi:remote

# Dashboard pages
npm run deploy:pi:dashboard

# Entire workspace (excluding .git/node_modules)
npm run deploy:pi:all
```

Skip restart if you only want to sync files:

```bash
bash scripts/deploy-pi.sh remote --no-restart
```

If SSH is not set up yet:

```bash
ssh-copy-id asgtech@10.52.20.121
```

## Power On/Off Notes

- **Power off** is supported from remote (`shutdown`).
- **Power on** from remote uses Wake-on-LAN (`wake`) and requires:
  - Pi/network hardware that supports WoL
  - `wakeonlan` or `etherwake` installed on the machine sending the packet
  - `WAKE_MAC` environment variable configured in `tv-remote.service`
- If WoL is not available on your setup, use smart plug/relay or manual power button.

## Security

The server listens on `0.0.0.0:8080`. Keep it on a trusted LAN or protect it behind authenticated access.
