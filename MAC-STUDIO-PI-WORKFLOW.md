# Mac Studio -> Pi Fast Workflow

Use this when editing on your Mac Studio and deploying quickly to the Pi TV dashboard.

## One-time setup on Mac Studio

1. Clone repo:
   - `git clone https://github.com/CZY-dev-sh/asg.git`
2. Ensure SSH access to Pi works:
   - `ssh asgtech@10.52.20.121`
3. Optional convenience alias in your Mac `~/.zshrc`:
   - `alias pi-tv='ssh asgtech@10.52.20.121 "cd /home/asgtech/Desktop/Cursor && bash scripts/pi-update-dashboard.sh"'`

## Daily flow

1. Edit on Mac Studio (Cursor/CLI).
2. Commit + push from Mac:
   - `git add . && git commit -m "..." && git push origin main`
3. Trigger Pi update from Mac:
   - `ssh asgtech@10.52.20.121 "cd /home/asgtech/Desktop/Cursor && bash scripts/pi-update-dashboard.sh"`

That command on Pi will:

- fetch latest from GitHub
- fast-forward pull `main`
- restart `tv-remote` and `tv-dashboard-kiosk`
- print service status

## If SSH host/IP changes

Update `10.52.20.121` in your Mac command/alias to the Pi's current LAN IP.

## If restart asks for sudo password

Run once on Pi to allow service restarts without prompts:

- `sudo visudo`
- Add:
  - `asgtech ALL=(ALL) NOPASSWD: /bin/systemctl restart tv-remote tv-dashboard-kiosk, /bin/systemctl status tv-remote tv-dashboard-kiosk`

Then the update command runs fully non-interactive.
