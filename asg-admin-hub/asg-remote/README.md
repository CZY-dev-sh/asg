# ASG TV Remote (Pi)

Phone-based remote for the Raspberry Pi TV dashboard (Alex Stoykov Group **Live Team Performance** / multiview). The phone sends **1**, **2**, **3–6** (direct screen jumps), **arrow keys**, and **Enter** to the Pi via a small Node server, which uses **xdotool** to inject keys into the browser on `:0`.

**Screen hotkeys (must match `tv-dashboard-multiview.html`):** `3` Overview · `5` Current deals · `4` Team directory · `6` Privacy.

This folder lives in the **ASG Admin Hub** repo as `asg-remote/`. Copy it to the Pi (or clone the repo there) and run the server from this directory.

## Setup on the Pi

1. **Install xdotool** (simulated keypresses):

   ```bash
   sudo apt install xdotool
   ```

2. **Copy this folder** (`index.html` and `server.js`) to the Pi, e.g. `/home/pi/asg-remote/`.

3. **Run the server**:

   ```bash
   cd /home/pi/asg-remote
   node server.js
   ```

4. **On your phone**, open a browser and go to:

   ```
   http://<PI_IP_ADDRESS>:8080
   ```

   Find the Pi IP with `hostname -I`.

## Auto-start on boot (optional)

Create `/etc/systemd/system/tv-remote.service`:

```ini
[Unit]
Description=ASG TV Remote
After=network.target

[Service]
ExecStart=/usr/bin/node /home/pi/asg-remote/server.js
WorkingDirectory=/home/pi/asg-remote
Restart=always
User=pi
Environment=DISPLAY=:0

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl enable tv-remote
sudo systemctl start tv-remote
```

Adjust `ExecStart` / `WorkingDirectory` if you use a different path.

## Requirements

- Node.js (no npm dependencies)
- xdotool
- Pi running an X11 session on `DISPLAY=:0`
- Passwordless **sudo** for `shutdown` / `reboot` if you use the power actions in the remote UI (or configure sudoers carefully)

## Security note

The server listens on **0.0.0.0:8080**. Use only on a trusted LAN, or put it behind a VPN / reverse proxy with auth.
