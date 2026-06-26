# IDX folder — Squarespace global CSS

Version-controlled mirror of **Squarespace → Design → Custom CSS**. The live site uses one pasted block; the repo uses **three source files** plus a **build** that concatenates them into one paste-ready file (condensed formatting, smaller than the old seven-chunk layout).

## Rebuild the paste file

From the repository root:

```sh
./IDX/build-squarespace-global.sh
```

From `IDX/`:

```sh
./build-squarespace-global.sh
```

Output: **`squarespace-global.css`** — copy its **entire** contents into Squarespace Custom CSS.

### Source files (edit these; do not hand-edit `squarespace-global.css`)

| File | Contents |
|------|----------|
| `squarespace-global-part-a.css` | Site UI: image hover, video/map/embed rounding, cursor, IDX roster hides on subdomain, **showcase widget `#IDX-showcaseGallery-33467`** (Photos page). |
| `squarespace-global-part-b.css` | **Listing modal** `#idx-modal-*`, **IDX detail** fallbacks when `#IDX-main` appears on the marketing domain. |
| `squarespace-tail.css` | **`#IDX-main` widget styling** (search, results, map, contact, user, mortgage, alerts, responsive), **Past deals `#IDX-showcaseGallery-40431`**, admin hub grid, Alex hub `:has()` layout. |

Merge order is fixed in `build-squarespace-global.sh` (A → B → tail). After any edit, run the script again before pasting into Squarespace.

### Formatting notes

- Part A/B use **compact** rules (minimal whitespace) to stay under Squarespace size limits and speed up diffing.
- `squarespace-tail.css` keeps readable blocks; long banner comments were replaced with short `/* N. Title */` markers.

## Paste into Squarespace

1. **Design** → **Custom CSS**
2. Replace with the contents of **`squarespace-global.css`**
3. Check: [Photos / listings embed](https://www.alexstoykovgroup.com/photos), Past Deals section, any hub embed, a few non-IDX pages (global `img`/iframe rounding)

## Elm Street / IDX Broker (subdomain)

Not built by this script:

- `idx-global.css` → IDX Global CSS  
- `categories/*.css` → IDX category CSS  

Paste those in the Elm Street / IDX control panel for `search.alexstoykovgroup.com`.
