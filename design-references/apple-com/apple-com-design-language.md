# Design Language: Apple

> Extracted from `https://www.apple.com/` on April 16, 2026
> 1891 elements analyzed

This document describes the complete design language of the website. It is structured for AI/LLM consumption — use it to faithfully recreate the visual design in any framework.

## Color Palette

### Primary Colors

| Role | Hex | RGB | HSL | Usage Count |
|------|-----|-----|-----|-------------|
| Primary | `#2997ff` | rgb(41, 151, 255) | hsl(209, 100%, 58%) | 526 |
| Secondary | `#f5f5f7` | rgb(245, 245, 247) | hsl(240, 11%, 96%) | 98 |
| Accent | `#f5f5f7` | rgb(245, 245, 247) | hsl(240, 11%, 96%) | 98 |

### Neutral Colors

| Hex | HSL | Usage Count |
|-----|-----|-------------|
| `#1d1d1f` | hsl(240, 3%, 12%) | 1304 |
| `#000000` | hsl(0, 0%, 0%) | 1249 |
| `#333336` | hsl(240, 3%, 21%) | 476 |
| `#6e6e73` | hsl(240, 2%, 44%) | 64 |
| `#ffffff` | hsl(0, 0%, 100%) | 34 |
| `#d2d2d7` | hsl(240, 6%, 83%) | 1 |

### Background Colors

Used on large-area elements: `#ffffff`, `#fafafc`, `#e8e8ed`, `#0071e3`, `#f5f5f7`, `#000000`, `#604630`, `#f4f8fb`, `#485b5e`, `#9fc6f4`, `#ea33c0`, `#ec893c`, `#3397d4`, `#7424b5`

### Text Colors

Text color palette: `#000000`, `#1d1d1f`, `#6e6e73`, `#333336`, `#ffffff`, `#f5f5f7`, `#0066cc`, `#2997ff`

### Gradients

```css
background-image: radial-gradient(100% 33% at 0% 100%, rgba(0, 0, 0, 0.5) 0%, rgba(255, 255, 255, 0));
```

```css
background-image: linear-gradient(rgba(29, 29, 31, 0.4) 0%, rgba(29, 29, 31, 0) 70px, rgba(29, 29, 31, 0) calc(100% - 70px), rgba(29, 29, 31, 0.4) 100%);
```

### Full Color Inventory

| Hex | Contexts | Count |
|-----|----------|-------|
| `#1d1d1f` | text, border | 1304 |
| `#000000` | text, border, background | 1249 |
| `#2997ff` | text, border | 526 |
| `#333336` | text, border | 476 |
| `#f5f5f7` | text, border, background | 98 |
| `#0066cc` | text, border | 70 |
| `#6e6e73` | text, border | 64 |
| `#ffffff` | background, text, border | 34 |
| `#0071e3` | background | 10 |
| `#e8e8ed` | background | 1 |
| `#d2d2d7` | background | 1 |
| `#604630` | background | 1 |
| `#485b5e` | background | 1 |
| `#9fc6f4` | background | 1 |
| `#ea33c0` | background | 1 |
| `#ec893c` | background | 1 |
| `#3397d4` | background | 1 |
| `#7424b5` | background | 1 |

## Typography

### Font Families

- **SF Pro Text** — used for all (1694 elements)
- **SF Pro Display** — used for all (196 elements)
- **Arial** — used for all (1 elements)

### Type Scale

| Size (px) | Size (rem) | Weight | Line Height | Letter Spacing | Used On |
|-----------|------------|--------|-------------|----------------|---------|
| 56px | 3.5rem | 600 | 60px | -0.28px | h2 |
| 44px | 2.75rem | 400 | 44px | -0.12px | svg, path |
| 40px | 2.5rem | 600 | 44px | normal | h3, picture, source, img |
| 34px | 2.125rem | 600 | 50px | -0.374px | h1 |
| 28px | 1.75rem | 400 | 32px | 0.196px | p |
| 25.5px | 1.5938rem | 600 | 37.5px | -0.374px | h2, picture, source, img |
| 24px | 1.5rem | 600 | 28px | 0.216px | li, a, input |
| 21px | 1.3125rem | 400 | 25px | 0.231px | p, sup, span |
| 17px | 1.0625rem | 400 | normal | normal | html, head, meta, link |
| 14px | 0.875rem | 400 | 20.0003px | -0.224px | div, span, sup, a |
| 13.3333px | 0.8333rem | 400 | normal | normal | input |
| 12px | 0.75rem | 400 | 16.0005px | -0.12px | aside, ul, a, span |
| 10px | 0.625rem | 400 | 13px | -0.08px | span |

### Heading Scale

```css
h2 { font-size: 56px; font-weight: 600; line-height: 60px; }
h3 { font-size: 40px; font-weight: 600; line-height: 44px; }
h1 { font-size: 34px; font-weight: 600; line-height: 50px; }
h2 { font-size: 25.5px; font-weight: 600; line-height: 37.5px; }
h2 { font-size: 12px; font-weight: 400; line-height: 16.0005px; }
```

### Body Text

```css
body { font-size: 12px; font-weight: 400; line-height: 16.0005px; }
```

### Font Weights in Use

`400` (1305x), `600` (580x), `700` (6x)

## Spacing

**Base unit:** 2px

| Token | Value | Rem |
|-------|-------|-----|
| spacing-0 | 0px | 0rem |
| spacing-4 | 4px | 0.25rem |
| spacing-24 | 24px | 1.5rem |
| spacing-26 | 26px | 1.625rem |
| spacing-30 | 30px | 1.875rem |
| spacing-32 | 32px | 2rem |
| spacing-34 | 34px | 2.125rem |
| spacing-37 | 37px | 2.3125rem |
| spacing-40 | 40px | 2.5rem |
| spacing-44 | 44px | 2.75rem |
| spacing-48 | 48px | 3rem |
| spacing-53 | 53px | 3.3125rem |
| spacing-56 | 56px | 3.5rem |
| spacing-59 | 59px | 3.6875rem |
| spacing-80 | 80px | 5rem |
| spacing-84 | 84px | 5.25rem |
| spacing-88 | 88px | 5.5rem |
| spacing-107 | 107px | 6.6875rem |
| spacing-128 | 128px | 8rem |

## Border Radii

| Label | Value | Count |
|-------|-------|-------|
| sm | 5px | 5 |
| md | 8px | 3 |
| full | 50px | 1 |
| full | 980px | 34 |
| full | 999px | 1 |

## Box Shadows

**xl** — blur: 30px
```css
box-shadow: rgba(0, 0, 0, 0.22) 3px 5px 30px 0px;
```

## CSS Custom Properties

### Colors

```css
--sk-focus-color: #0071e3;
--sk-focus-color-alt: rgb(0, 0, 0);
--sk-body-text-color: rgb(29, 29, 31);
--sk-headline-text-color: rgb(29, 29, 31);
--sk-body-background-color: rgb(255, 255, 255);
--sk-body-link-color: rgb(0, 102, 204);
--sk-glyph-gray-secondary: rgb(110, 110, 115);
--sk-glyph-gray-secondary-alpha: rgba(0, 0, 0, 0.56);
--sk-glyph-gray-secondary-alt: rgb(66, 66, 69);
--sk-glyph-gray-secondary-alt-alpha: rgba(0, 0, 0, 0.72);
--sk-fill-secondary: rgb(250, 250, 252);
--sk-fill-gray-secondary: rgb(134, 134, 139);
--sk-fill-gray-secondary-alpha: rgba(0, 0, 0, 0.48);
--sk-fill-orange-secondary: rgb(255, 249, 244);
--sk-fill-green-secondary: rgb(245, 255, 246);
--sk-fill-red-secondary: rgb(255, 242, 244);
--sk-fill-yellow-secondary: rgb(255, 254, 242);
```

### Spacing

```css
--sk-default-stacked-margin: 0.4em;
--sk-paragraph-plus-element-margin: 0.8em;
--sk-headline-plus-first-element-margin: 0.8em;
--sk-headline-plus-headline-margin: 0.4em;
--sk-paragraph-plus-headline-margin: 1.6em;
--sk-footnote-font-size: 0.6em;
--sk-footnote-reduced-font-size: .45em;
--media-gallery-section-padding-bottom: var(--media-gallery-dotnav-gap);
--media-gallery-tile-gap: 13px;
--media-gallery-dotnav-gap: 12px;
--media-gallery-dotnav-iconcontrol-margin-top: unset;
--media-gallery-dotnav-iconcontrol-margin-right: calc(12px + env(safe-area-inset-right));
--media-gallery-genre-m-dot-padding: 0.25em;
--media-gallery-button-margin-top: 0;
--media-gallery-headline-margin-bottom: 26px;
--media-gallery-bottom-content-padding-left: 48px;
--media-gallery-bottom-content-padding-bottom: 40px;
--media-gallery-bottom-content-padding-right: 48px;
```

### Typography

```css
--r-localnav-text-zoom-factor: 1;
--sk-body-font-stack: text;
```

### Other

```css
--r-globalnav-background-opened: #fafafc;
--r-globalnav-background-opened-dark: #161617;
--sk-focus-offset: 1px;
--sk-focus-offset-container: 3px;
--r-localnav-height: calc(52px * var(--r-localnav-text-zoom-factor));
--r-localnav-stacked-height: calc(66px * var(--r-localnav-text-zoom-factor));
--r-localnav-gn-height: var(--r-globalnav-height, 44px);
--r-localnav-viewport-large-min-width: 1024px;
--r-localnav-viewport-large-query: min-width(1024px);
--r-localnav-viewport-medium-min-width: 834px;
--r-localnav-viewport-medium-max-width: 1023px;
--r-localnav-viewport-medium-query: min-width(834px);
--r-localnav-viewport-small-min-width: 320px;
--r-localnav-viewport-small-max-width: 833px;
--r-localnav-viewport-small-query: min-width(320px);
--sk-link-disabled-opacity: 0.42;
--sk-footnote-offset-top: -0.5em;
--sk-glyph: rgb(0, 0, 0);
--sk-glyph-gray: rgb(29, 29, 31);
--sk-glyph-gray-alpha: rgba(0, 0, 0, 0.88);
--sk-glyph-gray-tertiary: rgb(134, 134, 139);
--sk-glyph-gray-tertiary-alpha: rgba(0, 0, 0, 0.48);
--sk-glyph-blue: rgb(0, 102, 204);
--sk-glyph-orange: rgb(182, 68, 0);
--sk-glyph-green: rgb(0, 128, 9);
--sk-glyph-red: rgb(227, 0, 0);
--sk-fill: rgb(255, 255, 255);
--sk-fill-tertiary: rgb(245, 245, 247);
--sk-fill-gray: rgb(29, 29, 31);
--sk-fill-gray-alpha: rgba(0, 0, 0, 0.88);
--sk-fill-gray-tertiary: rgb(210, 210, 215);
--sk-fill-gray-tertiary-alpha: rgba(0, 0, 0, 0.16);
--sk-fill-gray-quaternary: rgb(232, 232, 237);
--sk-fill-gray-quaternary-alpha: rgba(0, 0, 0, 0.08);
--sk-fill-blue: rgb(0, 113, 227);
--sk-fill-orange: rgb(245, 99, 0);
--sk-fill-green: rgb(3, 161, 14);
--sk-fill-red: rgb(227, 0, 0);
--sk-fill-yellow: rgb(255, 224, 69);
--sk-productred: rgb(175, 30, 45);
--sk-enviro-green: rgb(0, 217, 89);
--sk-enviro-neutral: rgb(232, 232, 237);
--sk-footnote-reduced-offset-top: -.86em;
--globalnav-height: 44px;
--globalnav-collective-height: var(--globalnav-height);
--hero-content-height: 580px;
--promo-content-height: 580px;
--media-gallery-bottom-copy-duration: 600ms;
--media-gallery-slide-duration: 800ms;
--media-gallery-longnote-position-left: 18px;
--media-gallery-tile-width: 930px;
--media-gallery-tile-height: 523px;
--fam-gallery-tile-height: 234px;
--r-sk-safe-area-inset-start: 0px;
--r-globalmessage-segment-height: 0px;
--r-globalnav-height: 44px;
--r-sk-start: left;
--r-sk-safe-area-inset-end: 0px;
--r-globalnav-segmentbar-height: 0px;
--r-sk-logical-factor: 1;
--r-sk-end: right;
```

### Dependencies

```css
--r-localnav-height: --r-localnav-text-zoom-factor;
--r-localnav-stacked-height: --r-localnav-text-zoom-factor;
--r-localnav-gn-height: --r-globalnav-height;
--globalnav-collective-height: --globalnav-height;
--media-gallery-section-padding-bottom: --media-gallery-dotnav-gap;
```

### Semantic

```css
success: [object Object];
warning: [object Object];
error: [object Object];
info: [object Object];
```

## Breakpoints

| Name | Value | Type |
|------|-------|------|
| sm | 480px | max-width |
| sm | 640px | max-width |
| sm | 641px | min-width |
| md | 734px | max-width |
| md | 735px | min-width |
| md | 736px | min-width |
| 833px | 833px | max-width |
| 834px | 834px | min-width |
| lg | 1023px | max-width |
| lg | 1044px | max-width |
| lg | 1068px | max-width |
| lg | 1069px | min-width |
| lg | 1070px | min-width |
| 1440px | 1440px | max-width |
| 1441px | 1441px | min-width |

## Transitions & Animations

**Easing functions:** `[object Object]`, `[object Object]`, `[object Object]`, `[object Object]`

**Durations:** `0.24s`, `0.32s`, `0.08s`, `0.22s`, `0.2s`, `0.18s`, `0.16s`, `0.14s`, `0.12s`, `0.1s`, `0.06s`, `0.04s`, `0.02s`, `0.3s`, `0.25s`, `1s`, `0.4s`

### Common Transitions

```css
transition: all;
transition: background 0.24s cubic-bezier(0.4, 0, 0.6, 1);
transition: color 0.32s cubic-bezier(0.4, 0, 0.6, 1);
transition: visibility 0.24s steps(1);
transition: opacity 0.24s cubic-bezier(0.4, 0, 0.6, 1);
transition: opacity 0.32s 0.08s, transform 0.32s 0.08s;
transition: opacity 0.24s, transform 0.24s;
transition: opacity 0.22s, transform 0.22s;
transition: opacity 0.2s, transform 0.2s;
transition: opacity 0.18s, transform 0.18s;
```

### Keyframe Animations

**globalnav-chevron-slide-in-hover**
```css
@keyframes globalnav-chevron-slide-in-hover {
  0% { opacity: 0; transform: translate(-4px); }
  100% { opacity: 1; transform: translate(0px); }
}
```

**globalnav-chevron-hover-off**
```css
@keyframes globalnav-chevron-hover-off {
  0% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.8); }
}
```

**globalnav-flyout-slide-forward-next**
```css
@keyframes globalnav-flyout-slide-forward-next {
  0% { opacity: 0; transform: translate(8px); }
  100% { opacity: 1; transform: translate(0px); }
}
```

**globalnav-flyout-slide-forward-previous**
```css
@keyframes globalnav-flyout-slide-forward-previous {
  0% { opacity: 1; transform: translate(0px); }
  100% { opacity: 0; transform: translate(-8px); }
}
```

**globalnav-flyout-slide-back-previous**
```css
@keyframes globalnav-flyout-slide-back-previous {
  0% { opacity: 1; transform: translate(0px); }
  100% { opacity: 0; transform: translate(8px); }
}
```

**globalnav-flyout-slide-back-next**
```css
@keyframes globalnav-flyout-slide-back-next {
  0% { opacity: 0; transform: translate(-8px); }
  100% { opacity: 1; transform: translate(0px); }
}
```

**globalnav-scrim-height-change**
```css
@keyframes globalnav-scrim-height-change {
  0% { height: var(--r-globalnav-previous-flyout-height); }
  100% { height: var(--r-globalnav-next-flyout-height); }
}
```

**globalnav-fade-in**
```css
@keyframes globalnav-fade-in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
```

**globalnav-search-fade**
```css
@keyframes globalnav-search-fade {
  0% { opacity: 0; transform: translateY(0px); }
  100% { opacity: 1; transform: translateY(0px); }
}
```

**globalnav-search-fade-and-slide**
```css
@keyframes globalnav-search-fade-and-slide {
  0% { opacity: 0; transform: translateY(calc(var(--r-globalnav-search-shift-vertical) * -1)); }
  100% { opacity: 1; transform: translateY(0px); }
}
```

## Component Patterns

Detected UI component patterns and their most common styles:

### Buttons (45 instances)

```css
.button {
  background-color: rgb(0, 113, 227);
  color: rgb(29, 29, 31);
  font-size: 17px;
  font-weight: 400;
  padding-top: 0px;
  padding-right: 0px;
  border-radius: 0px;
}
```

### Cards (2 instances)

```css
.card {
  border-radius: 0px;
  padding-top: 0px;
  padding-right: 0px;
}
```

### Inputs (2 instances)

```css
.input {
  color: rgb(51, 51, 54);
  border-color: rgb(51, 51, 54);
  border-radius: 0px;
  font-size: 24px;
  padding-top: 1px;
  padding-right: 34px;
}
```

### Links (341 instances)

```css
.link {
  color: rgb(51, 51, 54);
  font-size: 12px;
  font-weight: 600;
}
```

### Navigation (752 instances)

```css
.navigatio {
  background-color: rgba(250, 250, 252, 0.8);
  color: rgb(29, 29, 31);
  padding-top: 0px;
  padding-bottom: 0px;
  padding-left: 0px;
  padding-right: 0px;
  position: static;
}
```

### Footer (32 instances)

```css
.foote {
  background-color: rgb(245, 245, 247);
  color: rgba(0, 0, 0, 0.56);
  padding-top: 0px;
  padding-bottom: 0px;
  font-size: 12px;
}
```

### Dropdowns (599 instances)

```css
.dropdown {
  background-color: rgba(250, 250, 252, 0.8);
  border-radius: 0px;
  border-color: rgb(29, 29, 31);
  padding-top: 0px;
}
```

### Tabs (9 instances)

```css
.tab {
  color: rgb(0, 102, 204);
  font-size: 17px;
  font-weight: 400;
  padding-top: 8px;
  padding-right: 8px;
  border-color: rgb(0, 102, 204);
  border-radius: 0px;
}
```

### ProgressBars (1 instances)

```css
.progressBar {
  color: rgb(0, 0, 0);
  border-radius: 0px;
  font-size: 17px;
}
```

## Layout System

**29 grid containers** and **205 flex containers** detected.

### Container Widths

| Max Width | Padding |
|-----------|---------|
| 1024px | 22px |
| 50% | 0px |
| 2560px | 0px |
| 980px | 22px |

### Grid Column Patterns

| Columns | Usage Count |
|---------|-------------|
| 1-column | 21x |
| 2-column | 8x |

### Grid Templates

```css
grid-template-columns: 1280px;
gap: 12px;
grid-template-columns: 622px 622px;
gap: 12px;
grid-template-columns: 930px;
grid-template-columns: 930px;
grid-template-columns: 930px;
```

### Flex Patterns

| Direction/Wrap | Count |
|----------------|-------|
| row/nowrap | 174x |
| column/nowrap | 12x |
| row-reverse/nowrap | 19x |

**Gap values:** `12px`, `normal 0px`, `normal 14px`, `normal 17px`

## Accessibility (WCAG 2.1)

**Overall Score: 88%** — 75 passing, 10 failing color pairs

### Failing Color Pairs

| Foreground | Background | Ratio | Level | Used On |
|------------|------------|-------|-------|---------|
| `#1d1d1f` | `#0071e3` | 3.58:1 | FAIL | div (1x) |
| `#1d1d1f` | `#000000` | 1.25:1 | FAIL | div (1x) |
| `#2997ff` | `#604630` | 2.88:1 | FAIL | div (1x) |
| `#2997ff` | `#f4f8fb` | 2.82:1 | FAIL | div (1x) |
| `#2997ff` | `#485b5e` | 2.37:1 | FAIL | div (1x) |
| `#2997ff` | `#9fc6f4` | 1.7:1 | FAIL | div (1x) |
| `#2997ff` | `#ea33c0` | 1.21:1 | FAIL | div (1x) |
| `#2997ff` | `#ec893c` | 1.18:1 | FAIL | div (1x) |
| `#2997ff` | `#3397d4` | 1.07:1 | FAIL | div (1x) |
| `#2997ff` | `#7424b5` | 2.62:1 | FAIL | div (1x) |

### Passing Color Pairs

| Foreground | Background | Ratio | Level |
|------------|------------|-------|-------|
| `#2997ff` | `#000000` | 6.96:1 | AA |
| `#000000` | `#f5f5f7` | 19.29:1 | AAA |
| `#1d1d1f` | `#fafafc` | 16.14:1 | AAA |
| `#1d1d1f` | `#f5f5f7` | 15.46:1 | AAA |
| `#ffffff` | `#0071e3` | 4.7:1 | AA |
| `#1d1d1f` | `#ffffff` | 16.83:1 | AAA |
| `#000000` | `#fafafc` | 20.14:1 | AAA |
| `#ffffff` | `#000000` | 21:1 | AAA |
| `#1d1d1f` | `#e8e8ed` | 13.78:1 | AAA |
| `#000000` | `#d2d2d7` | 13.94:1 | AAA |

## Design System Score

**Overall: 81/100 (Grade: B)**

| Category | Score |
|----------|-------|
| Color Discipline | 70/100 |
| Typography Consistency | 70/100 |
| Spacing System | 80/100 |
| Shadow Consistency | 100/100 |
| Border Radius Consistency | 85/100 |
| Accessibility | 88/100 |
| CSS Tokenization | 100/100 |

**Strengths:** Clean elevation system, Consistent border radii, Good CSS variable tokenization

**Issues:**
- 13 distinct font sizes — consider a tighter type scale
- 10 WCAG contrast failures

## Gradients

**2 unique gradients** detected.

| Type | Direction | Stops | Classification |
|------|-----------|-------|----------------|
| radial | — | 3 | bold |
| linear | — | 4 | bold |

```css
background: radial-gradient(100% 33% at 0% 100%, rgba(0, 0, 0, 0.5) 0%, rgba(255, 255, 255, 0));
background: linear-gradient(rgba(29, 29, 31, 0.4) 0%, rgba(29, 29, 31, 0) 70px, rgba(29, 29, 31, 0) calc(100% - 70px), rgba(29, 29, 31, 0.4) 100%);
```

## Z-Index Map

**8 unique z-index values** across 2 layers.

| Layer | Range | Elements |
|-------|-------|----------|
| modal | 9998,9999 | div.g.l.o.b.a.l.n.a.v.-.c.u.r.t.a.i.n, aside.g.l.o.b.a.l.m.e.s.s.a.g.e.-.s.e.g.m.e.n.t, nav.g.l.o.b.a.l.n.a.v. .j.s |
| base | -1,4 | span, span, div |

## SVG Icons

**22 unique SVG icons** detected. Dominant style: **filled**.

| Size Class | Count |
|------------|-------|
| xs | 2 |
| sm | 1 |
| md | 1 |
| lg | 1 |
| xl | 17 |

**Icon colors:** `rgba(0, 0, 0, 0.8)`, `rgb(110, 110, 115)`, `rgba(0, 0, 0, 0.48)`, `rgb(255, 255, 255)`

## Font Files

| Family | Source | Weights | Styles |
|--------|--------|---------|--------|
| Apple Legacy Chevron | self-hosted | 100, 200, 300, 400, 500, 600, 700, 800, 900 | normal |
| Apple Icons 100 | self-hosted | 400, normal | normal |
| Apple Icons 200 | self-hosted | 400, normal | normal |
| Apple Icons 300 | self-hosted | 400, normal | normal |
| Apple Icons 400 | self-hosted | 400, normal | normal |
| Apple Icons 500 | self-hosted | 400, normal | normal |
| Apple Icons 600 | self-hosted | 400, normal | normal |
| Apple Icons 700 | self-hosted | 400, normal | normal |
| Apple Icons 800 | self-hosted | 400, normal | normal |
| Apple Icons 900 | self-hosted | 400, normal | normal |
| SF Pro Display | self-hosted | 100, 200, 300, 400, 500, 600, 700, 800, 900 | normal, italic |
| SF Pro Display 100 | self-hosted | 400, normal | normal |
| SF Pro Display 200 | self-hosted | 400, normal | normal |
| SF Pro Display 300 | self-hosted | 400, normal | normal |
| SF Pro Display 500 | self-hosted | 400, normal | normal |
| SF Pro Display 600 | self-hosted | 400, normal | normal |
| SF Pro Display 700 | self-hosted | 400, normal | normal |
| SF Pro Display 800 | self-hosted | 400, normal | normal |
| SF Pro Display 900 | self-hosted | 400, normal | normal |
| SF Pro Text | self-hosted | 100, 200, 300, 400, 500, 600, 700, 800, 900 | normal, italic |
| SF Pro Text 100 | self-hosted | 400, normal | normal |
| SF Pro Text 200 | self-hosted | 400, normal | normal |
| SF Pro Text 300 | self-hosted | 400, normal | normal |
| SF Pro Text 500 | self-hosted | 400, normal | normal |
| SF Pro Text 600 | self-hosted | 400, normal | normal |
| SF Pro Text 700 | self-hosted | 400, normal | normal |
| SF Pro Text 800 | self-hosted | 400, normal | normal |
| SF Pro Text 900 | self-hosted | 400, normal | normal |
| SF Pro Icons | self-hosted | 100, 200, 300, 400, 500, 600, 700, 800, 900 | normal |
| SF Pro Icons 100 | self-hosted | 400, normal | normal |
| SF Pro Icons 200 | self-hosted | 400, normal | normal |
| SF Pro Icons 300 | self-hosted | 400, normal | normal |
| SF Pro Icons 500 | self-hosted | 400, normal | normal |
| SF Pro Icons 600 | self-hosted | 400, normal | normal |
| SF Pro Icons 700 | self-hosted | 400, normal | normal |
| SF Pro Icons 800 | self-hosted | 400, normal | normal |
| SF Pro Icons 900 | self-hosted | 400, normal | normal |

## Image Style Patterns

| Pattern | Count | Key Styles |
|---------|-------|------------|
| gallery | 15 | objectFit: fill, borderRadius: 0px, shape: square |
| hero | 9 | objectFit: cover, borderRadius: 0px, shape: square |
| thumbnail | 1 | objectFit: fill, borderRadius: 0px, shape: square |

**Aspect ratios:** 1:1 (21x), 4.35:1 (3x), 6.29:1 (1x)

## Quick Start

To recreate this design in a new project:

1. **Install fonts:** Add `SF Pro Text` from Google Fonts or your font provider
2. **Import CSS variables:** Copy `variables.css` into your project
3. **Tailwind users:** Use the generated `tailwind.config.js` to extend your theme
4. **Design tokens:** Import `design-tokens.json` for tooling integration
