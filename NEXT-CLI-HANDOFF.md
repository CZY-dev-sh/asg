# Next CLI Handoff (TV Dashboard)

This document is a handoff for continuing implementation on a more powerful machine.

## Current Status

Work in progress is in:

- `asg-admin-hub/components/tv-dashboard-multiview.html`

Already implemented before this handoff:

- Next Closing KPI bento redesign (title with agent first name, large photo, date circle, buyer/seller chip treatment).
- Leaderboard Next Closing chip updates:
  - buyer = green
  - seller = blue
  - date chip styling
  - added "Closing in X days" chip.
- Next closing selection logic uses upcoming closings (today forward), preventing past closings from appearing as next.
- Numeric alignment and size adjustments across KPI stats bentos.

Latest partial change applied right before this handoff:

- Overview System card markup was converted into a 3-panel rotator shell:
  - `Upcoming Closings` panel
  - `Quarterly Data` panel
  - `System Status` panel
- The panel container and IDs were added in the HTML, but JS/CSS behavior is not fully wired yet.

## What Still Needs To Be Implemented

### 1) Wire the System Rotator Behavior

In `tv-dashboard-multiview.html`:

- Add JS refs in `els` for:
  - `overviewSystemTitle`
  - `overviewSystemSub`
  - `systemRotator`
  - `systemUpcomingList`
  - `systemQuarterlyWrap`
  - panel node list (e.g. `[data-system-panel]`)
- Add app state for panel index and cycle order.
- Add interval loop at 60s for panel rotation.
- Ensure order is exactly:
  1. Upcoming Closings
  2. Quarterly Data
  3. System Status
- Only one panel visible at a time.
- Use smooth, low-cost animation (opacity/transform only; avoid expensive filters).
- Keep existing card size/layout unchanged.

### 2) Build Upcoming Closings Panel UI

Render all upcoming pending closings in chronological order with:

- large agent photo
- agent name
- address
- price
- buyer/seller
- date
- days until closing

Design should follow existing Next Closing bento language for chips and spacing.

Data source should come from existing normalized pending deals (`dataAdapters.deals` + `dateRaw`), filtered to today forward.

### 3) Build Quarterly Data Panel (All View)

Implement an embedded quarterly line chart panel based on admin master dashboard’s **all** view style:

- Source file reference:
  - `asg-admin-hub/components/admin-master-dashboard.html`
  - key functions: `buildQuarterlyTrendSeries()`, `renderQuarterlyTrendChart()`
- For tv dashboard, only include all-view rendering (no year-toggle controls required).
- Prefer a lightweight SVG render to reduce Raspberry Pi overhead.

Recommended data approach:

- Use existing YTD closed (`pipeline ytdClosed`) already available in tv dashboard.
- Optionally fetch all-time closed rows from:
  - `https://script.google.com/macros/s/AKfycbxwagjmBkLzuHyEmymm1MwtbwiqMAZjKcMLPb_RVD6Lo0hNfMEoXh-76MzJ3dk5NBPv9A/exec`
  - with candidate query modes similar to admin master dashboard (`view=allTimeClosedRows`, etc).
- If all-time rows fail, fallback gracefully to YTD-only quarterly view.

### 4) Keep Existing System Status Panel Working

Existing `renderServices()` should continue to render into `#serviceList` when the system-status panel is active.

## Stability / Performance Notes

- Target device is Raspberry Pi; keep animation minimal:
  - long interval rotation (60s)
  - short, simple transitions
  - avoid heavy repaint effects.
- Reuse current render loop and avoid high-frequency timers for the rotator.

## Suggested Completion Checklist

- [ ] Add CSS for `.system-rotator`, `.system-panel`, active/hidden states.
- [ ] Add JS state/constants for system panel rotation.
- [ ] Add `renderOverviewSystemRotator()` and panel-specific renderers.
- [ ] Add `initSystemPanelRotation()` and call in `boot()`.
- [ ] Keep panel header title/subtitle synchronized with active panel.
- [ ] Validate no layout shifts in Overview grid.
- [ ] Validate no console errors and no linter errors.
- [ ] Commit and push.

