# Design Language: Alex Stoykov Group - Luxury Real Estate - Chicago -IL

> Extracted from `https://www.alexstoykovgroup.com` on May 20, 2026
> 1147 elements analyzed

This document describes the complete design language of the website. It is structured for AI/LLM consumption — use it to faithfully recreate the visual design in any framework.

## Color Palette

### Primary Colors

| Role | Hex | RGB | HSL | Usage Count |
|------|-----|-----|-----|-------------|
| Primary | `#4a5464` | rgb(74, 84, 100) | hsl(217, 15%, 34%) | 24 |
| Secondary | `#010d15` | rgb(1, 13, 21) | hsl(204, 91%, 4%) | 4 |

### Neutral Colors

| Hex | HSL | Usage Count |
|-----|-----|-------------|
| `#121212` | hsl(0, 0%, 7%) | 1199 |
| `#dcdcd8` | hsl(60, 5%, 85%) | 399 |
| `#000000` | hsl(0, 0%, 0%) | 352 |
| `#fafafa` | hsl(0, 0%, 98%) | 310 |
| `#e7e7e7` | hsl(0, 0%, 91%) | 72 |
| `#262626` | hsl(0, 0%, 15%) | 4 |

### Background Colors

Used on large-area elements: `#fafafa`, `#ffffff`, `#dcdcd8`, `#000000`

### Text Colors

Text color palette: `#000000`, `#121212`, `#ffffff`, `#dcdcd8`, `#e7e7e7`, `#4a5464`

### Gradients

```css
background-image: linear-gradient(rgb(1, 13, 21), rgba(0, 0, 0, 0));
```

```css
background-image: linear-gradient(rgb(255, 255, 255), rgb(255, 255, 255));
```

```css
background-image: linear-gradient(rgb(0, 0, 0), rgb(0, 0, 0));
```

### Full Color Inventory

| Hex | Contexts | Count |
|-----|----------|-------|
| `#121212` | text, border, background | 1199 |
| `#dcdcd8` | background, text, border | 399 |
| `#000000` | text, border, background | 352 |
| `#fafafa` | background, text, border | 310 |
| `#e7e7e7` | text, border | 72 |
| `#4a5464` | text, border | 24 |
| `#010d15` | border | 4 |
| `#262626` | background | 4 |

## Typography

### Font Families

- **satoshi-ymnzpr** — used for body (681 elements)
- **Clarkson** — used for body (269 elements)
- **sans-serif** — used for body (107 elements)
- **Poppins** — used for all (90 elements)

### Type Scale

| Size (px) | Size (rem) | Weight | Line Height | Letter Spacing | Used On |
|-----------|------------|--------|-------------|----------------|---------|
| 120px | 7.5rem | 400 | 27px | normal | span, h2, strong |
| 118px | 7.375rem | 400 | 27px | normal | span, h2 |
| 115.9px | 7.2438rem | 400 | 27px | normal | span, h1 |
| 48px | 3rem | 700 | 48px | 1.8px | a, div |
| 42.648px | 2.6655rem | 500 | 55.4083px | normal | h2 |
| 33.432px | 2.0895rem | 500 | 44.5582px | normal | h3, strong |
| 30.36px | 1.8975rem | 700 | normal | normal | a |
| 24.216px | 1.5135rem | 500 | 31.4614px | normal | h2 |
| 21.144px | 1.3215rem | 400 | 38.0592px | normal | p, strong |
| 18.072px | 1.1295rem | 700 | 32.5296px | 1.8072px | div, a, h4 |
| 18px | 1.125rem | 400 | 18px | normal | div, nav, a, svg |
| 15px | 0.9375rem | 400 | normal | normal | html, head, meta, base |
| 13.464px | 0.8415rem | 500 | normal | 0.26928px | a |
| 12px | 0.75rem | 400 | 20.4px | normal | div, button, span |
| 10px | 0.625rem | 400 | 10px | normal | div, span |

### Heading Scale

```css
h2 { font-size: 120px; font-weight: 400; line-height: 27px; }
h2 { font-size: 118px; font-weight: 400; line-height: 27px; }
h1 { font-size: 115.9px; font-weight: 400; line-height: 27px; }
h2 { font-size: 42.648px; font-weight: 500; line-height: 55.4083px; }
h3 { font-size: 33.432px; font-weight: 500; line-height: 44.5582px; }
h2 { font-size: 24.216px; font-weight: 500; line-height: 31.4614px; }
h4 { font-size: 18.072px; font-weight: 700; line-height: 32.5296px; }
```

### Body Text

```css
body { font-size: 15px; font-weight: 400; line-height: normal; }
```

### Font Weights in Use

`400` (1027x), `700` (76x), `500` (44x)

## Spacing

| Token | Value | Rem |
|-------|-------|-----|
| spacing-1 | 1px | 0.0625rem |
| spacing-23 | 23px | 1.4375rem |
| spacing-26 | 26px | 1.625rem |
| spacing-36 | 36px | 2.25rem |
| spacing-51 | 51px | 3.1875rem |
| spacing-64 | 64px | 4rem |
| spacing-77 | 77px | 4.8125rem |
| spacing-120 | 120px | 7.5rem |
| spacing-337 | 337px | 21.0625rem |
| spacing-368 | 368px | 23rem |
| spacing-397 | 397px | 24.8125rem |

## Border Radii

| Label | Value | Count |
|-------|-------|-------|
| sm | 4px | 6 |
| md | 8px | 4 |
| lg | 16px | 3 |
| full | 26px | 2 |
| full | 30px | 43 |
| full | 50px | 10 |
| full | 100px | 8 |
| full | 300px | 25 |

## Box Shadows

**xs** — blur: 2px
```css
box-shadow: rgba(0, 0, 0, 0.15) 0px 1px 2px 0px;
```

**md** — blur: 10px
```css
box-shadow: rgba(0, 0, 0, 0.2) 0px 0px 10px 0px;
```

**md** — blur: 12px
```css
box-shadow: rgba(0, 0, 0, 0.15) 0px 4px 12px 0px;
```

## CSS Custom Properties

### Colors

```css
--tweak-summary-block-background-color: hsla(0,0%,100%,1);
--tweak-blog-basic-grid-list-meta-color: hsla(0,0%,7.06%,1);
--tweak-blog-item-title-color: hsla(0,0%,7.06%,1);
--portfolio-hover-static-title-color: hsla(0,0%,7.06%,1);
--secondary-button-font-font-weight: 500;
--tweak-product-basic-item-gallery-controls-color: hsla(0,0%,0%,1);
--list-section-carousel-card-color: hsla(0,0%,100%,1);
--siteBackgroundColor: hsla(0,0%,98.04%,1);
--tweak-product-basic-item-sale-price-color: hsla(60,5.41%,85.49%,1);
--form-field-radio-shape-border-bottom-left-radius: 5px;
--tweak-newsletter-block-button-text-color: hsla(0,0%,100%,1);
--video-grid-basic-title-color: hsla(0,0%,7.06%,1);
--tweak-blog-alternating-side-by-side-list-meta-color: hsla(0,0%,7.06%,1);
--tweak-blog-single-column-list-title-color: hsla(0,0%,7.06%,1);
--solidHeaderBackgroundColor: hsla(0,0%,98.04%,1);
--toggle-on-color: hsla(0,0%,7.06%,1);
--course-item-nav-border-color: hsla(204,90.91%,4.31%,.25);
--tweak-product-basic-item-breadcumb-nav-color: hsla(0,0%,7.06%,1);
--social-links-block-secondary-icon-color: hsla(0,0%,98.04%,1);
--primary-button-font-font-style: normal;
--tweak-blog-alternating-side-by-side-list-excerpt-color: hsla(0,0%,7.06%,1);
--secondary-button-font-font-size-value: 1.1;
--tweak-form-block-background-color: hsla(0,0%,100%,1);
--primary-button-padding-y: .8em;
--form-field-survey-shape-border-top-right-radius: 5px;
--tweak-blog-item-pagination-meta-color: hsla(0,0%,7.06%,1);
--video-grid-basic-description-color: hsla(0,0%,7.06%,1);
--backgroundOverlayColor: hsla(0,0%,98.04%,1);
--tweak-events-item-pagination-date-color: hsla(0,0%,7.06%,1);
--list-section-banner-slideshow-button-text-color: hsla(0,0%,100%,1);
--list-section-simple-card-description-color: hsla(0,0%,7.06%,1);
--tweak-newsletter-block-footnote-color: hsla(0,0%,7.06%,1);
--course-list-grid-layout-course-item-text-color: hsla(0,0%,7.06%,1);
--safeInverseLightAccent-hsl: 0,0%,0%;
--tweak-video-item-pagination-title-color: hsla(0,0%,7.06%,1);
--safeDarkAccent-hsl: 0,0%,0%;
--list-section-simple-card-button-background-color: hsla(0,0%,0%,1);
--stack-background-color: hsla(0,0%,100%,1);
--menuOverlayBackgroundColor: hsla(0,0%,98.04%,1);
--video-preview-badge-font-color: hsla(0,0%,98.04%,1);
--tweak-summary-block-header-text-color: hsla(0,0%,7.06%,1);
--list-section-simple-title-color: hsla(0,0%,7.06%,1);
--primary-button-font-font-size: 2rem;
--course-list-course-progress-bar-color: hsla(60,5.41%,85.49%,1);
--form-field-survey-shape-border-bottom-left-radius: 5px;
--tweak-form-block-field-input-color-on-background-hsl: 0,0%,7.06%;
--tweak-form-block-field-border-color: hsla(0,0%,7.06%,1);
--list-section-simple-card-title-color: hsla(0,0%,7.06%,1);
--tweak-heading-medium-color-on-background: hsla(0,0%,7.06%,1);
--menuOverlayButtonBackgroundColor: hsla(0,0%,0%,1);
--tweak-summary-block-primary-metadata-color-on-background: hsla(0,0%,7.06%,1);
--primary-button-font-line-height: 1.2em;
--image-block-card-inline-link-color: hsla(0,0%,7.06%,1);
--product-detail-subscriptions-frequency-text-color: hsla(0,0%,7.06%,1);
--list-section-banner-slideshow-card-title-color: hsla(0,0%,7.06%,1);
--tweak-marquee-block-heading-color-on-background: hsla(0,0%,7.06%,1);
--tweak-form-block-field-fill-color-a: 1;
--list-section-banner-slideshow-card-button-text-color: hsla(0,0%,100%,1);
--paragraphLinkColor: hsla(0,0%,0%,1);
--form-field-shape-border-top-right-radius: 5px;
--image-block-card-image-title-separation: 6%;
--gradientHeaderNavigationColor: hsla(0,0%,100%,1);
--tweak-heading-small-color-on-background: hsla(0,0%,7.06%,1);
--tweak-content-link-block-title-color: hsla(0,0%,7.06%,1);
--list-section-banner-slideshow-card-button-background-color: hsla(0,0%,0%,1);
--product-detail-subscriptions-button-text-color: hsla(0,0%,100%,1);
--headingMediumColor: hsla(0,0%,7.06%,1);
--list-section-banner-slideshow-card-description-color: hsla(0,0%,7.06%,1);
--list-section-title-color: hsla(0,0%,7.06%,1);
--lightAccent-hsl: 0,0%,100%;
--tweak-summary-block-read-more-color-on-background: hsla(0,0%,7.06%,1);
--tweak-menu-block-title-color: hsla(0,0%,7.06%,1);
--list-section-simple-description-color: hsla(0,0%,7.06%,1);
--secondary-button-font-font-family: "Poppins";
--form-field-radio-shape-border-top-left-radius: 5px;
--image-block-overlap-image-title-bg-color: hsla(0,0%,98.04%,1);
--form-field-survey-shape-border-bottom-right-radius: 5px;
--form-field-checkbox-shape-border-bottom-left-radius: 5px;
--scheduling-block-button-accent-color: hsla(0,0%,0%,1);
--tweak-blog-side-by-side-list-read-more-color: hsla(0,0%,0%,1);
--image-block-card-image-width: 56%;
--secondary-button-font-text-transform: none;
--tweak-video-item-description-color: hsla(0,0%,7.06%,1);
--image-block-card-image-title-bg-color: hsla(0,0%,98.04%,0);
--primaryButtonPadding: .8em;
--tweak-blog-single-column-list-excerpt-color: hsla(0,0%,7.06%,1);
--image-block-collage-image-subtitle-color: hsla(0,0%,7.06%,1);
--tweak-newsletter-block-footnote-color-on-background: hsla(0,0%,7.06%,1);
--tertiaryButtonTextColor: hsla(0,0%,100%,1);
--tweak-summary-block-secondary-metadata-color: hsla(0,0%,7.06%,1);
--darkAccent-hsl: 204,90.91%,4.31%;
--list-section-carousel-arrow-color: hsla(0,0%,100%,1);
--video-preview-badge-background-color: hsla(0,0%,7.06%,1);
--tweak-video-item-meta-color: hsla(0,0%,7.06%,1);
--tweak-product-grid-text-below-list-status-color: hsla(60,5.41%,85.49%,1);
--tweak-product-basic-item-title-color: hsla(0,0%,7.06%,1);
--image-block-stack-image-button-bg-color: hsla(0,0%,0%,1);
--tweak-form-block-field-input-color-on-background: hsla(0,0%,7.06%,1);
--tweak-newsletter-block-background-color: hsla(0,0%,100%,1);
--tweak-form-block-field-fill-color: hsla(0,0%,100%,1);
--tweak-newsletter-block-title-color-on-background: hsla(0,0%,7.06%,1);
--tweak-form-block-field-input-color: hsla(0,0%,7.06%,1);
--portfolio-grid-basic-title-color: hsla(0,0%,7.06%,1);
--course-list-grid-layout-course-item-background-color: hsla(0,0%,100%,1);
--tweak-product-grid-text-below-list-price-color: hsla(0,0%,7.06%,1);
--tweak-product-list-stroke-color: hsla(0,0%,7.06%,1);
--tweak-blog-item-meta-color: hsla(0,0%,7.06%,1);
--tweak-blog-item-author-profile-color: hsla(0,0%,7.06%,1);
--image-block-stack-image-title-color: hsla(0,0%,7.06%,1);
--tweak-menu-block-item-price-color: hsla(0,0%,7.06%,1);
--tweak-text-block-background-color: hsla(0,0%,100%,1);
--tweak-newsletter-block-stroke-color: hsla(0,0%,7.06%,1);
--shape-block-stroke-color: hsla(0,0%,7.06%,1);
--tweak-gallery-lightbox-background-color: hsla(0,0%,98.04%,1);
--headerDropShadowColor: hsla(0,0%,7.06%,1);
--headingSmallColor: hsla(0,0%,7.06%,1);
--image-block-collage-image-button-bg-color: hsla(0,0%,0%,1);
--headerBorderColor: hsla(0,0%,7.06%,1);
--tweak-form-block-field-accent-color-on-background-a: 1;
--headingExtraLargeColor: hsla(0,0%,7.06%,1);
--primary-button-rounded-border-bottom-left-radius: 6.8px;
--tweak-newsletter-block-button-background-color: hsla(0,0%,0%,1);
--tweak-blog-masonry-list-meta-color: hsla(0,0%,7.06%,1);
--safeInverseDarkAccent-hsl: 0,0%,100%;
--list-section-carousel-arrow-background-color: hsla(0,0%,0%,1);
--tweak-summary-block-excerpt-color-on-background: hsla(0,0%,7.06%,1);
--product-basic-item-discount-chip-text-color: hsla(0,0%,100%,1);
--tweak-form-block-description-color: hsla(0,0%,7.06%,1);
--tweak-newsletter-block-button-background-color-on-background: hsla(0,0%,7.06%,1);
--scheduling-block-button-text-color: hsla(0,0%,100%,1);
--form-field-shape-border-bottom-left-radius: 5px;
--tweak-portfolio-item-pagination-icon-color: hsla(0,0%,7.06%,1);
--product-basic-item-add-ons-title-color: hsla(0,0%,7.06%,1);
--tweak-line-block-line-color: hsla(0,0%,7.06%,1);
--list-section-carousel-description-color: hsla(0,0%,7.06%,1);
--tertiary-button-rounded-border-top-left-radius: 6.8px;
--course-item-nav-active-lesson-text-color: hsla(0,0%,98.04%,1);
--list-section-simple-button-text-color: hsla(0,0%,100%,1);
--siteTitleColor: hsla(0,0%,7.06%,1);
--video-grid-basic-meta-color: hsla(0,0%,7.06%,1);
--text-highlight-color-on-background: hsla(0,0%,0%,1);
--tweak-product-grid-text-below-list-sale-price-color: hsla(60,5.41%,85.49%,1);
--tweak-form-block-caption-color-on-background: hsla(0,0%,7.06%,1);
--portfolio-hover-follow-title-color: hsla(0,0%,7.06%,1);
--tertiary-button-rounded-border-bottom-left-radius: 6.8px;
--tweak-newsletter-block-description-color-on-background: hsla(0,0%,7.06%,1);
--tweak-quote-block-background-color: hsla(0,0%,100%,1);
--tweak-blog-masonry-list-title-color: hsla(0,0%,7.06%,1);
--tweak-form-block-field-accent-color-hsl: 60,5.41%,85.49%;
--list-section-carousel-card-button-text-color: hsla(0,0%,100%,1);
--tweak-blog-masonry-list-read-more-color: hsla(0,0%,0%,1);
--summary-block-limited-availability-label-color: hsla(0,0%,7.06%,1);
--stack-stroke-color: hsla(0,0%,7.06%,1);
--tweak-portfolio-item-pagination-meta-color: hsla(0,0%,7.06%,1);
--course-item-nav-background-color: hsla(0,0%,100%,1);
--tweak-product-list-background-color: hsla(0,0%,100%,1);
--tweak-summary-block-primary-metadata-color: hsla(0,0%,7.06%,1);
--tweak-form-block-stroke-color: hsla(0,0%,7.06%,1);
--tweak-blog-item-pagination-title-color: hsla(0,0%,7.06%,1);
--solidHeaderNavigationColor: hsla(0,0%,7.06%,1);
--tweak-marquee-block-paragraph-color: hsla(0,0%,7.06%,1);
--secondary-button-rounded-border-bottom-right-radius: 7.2px;
--primary-button-rounded-border-top-right-radius: 6.8px;
--tweak-form-block-field-border-color-a: 1;
--image-block-poster-image-title-bg-color-v2: hsla(0,0%,98.04%,0);
--tweak-form-block-field-accessory-color-on-background: hsla(0,0%,7.06%,1);
--tweak-accordion-block-background-color: hsla(0,0%,100%,1);
--tweak-accordion-block-stroke-color: hsla(0,0%,7.06%,1);
--course-list-course-item-text-color: hsla(0,0%,7.06%,1);
--secondaryButtonBackgroundColor: hsla(0,0%,0%,1);
--paragraphLargeColor: hsla(0,0%,7.06%,1);
--tweak-form-block-field-accent-color: hsla(60,5.41%,85.49%,1);
--tweak-form-block-survey-title-color: hsla(0,0%,7.06%,1);
--tweak-blog-basic-grid-list-excerpt-color: hsla(0,0%,7.06%,1);
--tweak-form-block-title-color-on-background: hsla(0,0%,7.06%,1);
--image-block-collage-image-button-text-color: hsla(0,0%,100%,1);
--tweak-form-block-button-background-color-on-background: hsla(0,0%,0%,1);
--tweak-summary-block-secondary-metadata-color-on-background: hsla(0,0%,7.06%,1);
--product-list-filters-drawer-background-color: hsla(0,0%,100%,1);
--tweak-form-block-field-accessory-color: hsla(0,0%,7.06%,1);
--tweak-product-quick-view-button-color: hsla(0,0%,7.06%,1);
--course-item-nav-text-color: hsla(0,0%,7.06%,1);
--image-block-poster-image-button-bg-color: hsla(0,0%,0%,1);
--primary-button-font-font-weight: 700;
--tweak-product-basic-item-price-color: hsla(0,0%,7.06%,1);
--tweak-form-block-field-border-color-on-background-a: 1;
--safeLightAccent-hsl: 60,5.41%,85.49%;
--tweak-form-block-caption-color: hsla(0,0%,7.06%,1);
--image-block-overlap-image-button-text-color: hsla(0,0%,100%,1);
--image-block-poster-image-overlay-color: hsla(204,90.91%,4.31%,1);
--tweak-events-item-pagination-icon-color: hsla(0,0%,7.06%,1);
--tweak-paragraph-small-color-on-background: hsla(0,0%,7.06%,1);
--secondary-button-font-font-style: normal;
--tweak-product-basic-item-variant-fields-color: hsla(0,0%,7.06%,1);
--list-section-carousel-card-title-color: hsla(0,0%,7.06%,1);
--image-block-stack-inline-link-color: hsla(0,0%,7.06%,1);
--list-section-carousel-card-button-background-color: hsla(0,0%,0%,1);
--primary-button-padding-x: 1.3em;
--secondary-button-padding-y: 1.2rem;
--tweak-portfolio-item-pagination-title-color: hsla(0,0%,7.06%,1);
--image-block-card-image-button-text-color: hsla(0,0%,100%,1);
--image-block-collage-inline-link-color: hsla(0,0%,7.06%,1);
--product-detail-subscriptions-title-color: hsla(0,0%,7.06%,1);
--tweak-summary-block-read-more-color: hsla(0,0%,7.06%,1);
--safeInverseAccent-hsl: 0,0%,0%;
--primaryButtonTextColor: hsla(0,0%,100%,1);
--secondary-button-rounded-border-bottom-left-radius: 7.2px;
--form-field-survey-shape-border-top-left-radius: 5px;
--menuOverlayButtonTextColor: hsla(0,0%,100%,1);
--tweak-newsletter-block-description-color: hsla(0,0%,7.06%,1);
--list-section-banner-slideshow-card-color: hsla(0,0%,100%,1);
--solidHeaderDropShadowColor: hsla(0,0%,7.06%,1);
--form-field-checkbox-shape-border-top-right-radius: 5px;
--image-block-overlap-image-title-color: hsla(0,0%,7.06%,1);
--paragraphMediumColor: hsla(0,0%,7.06%,1);
--tweak-form-block-field-input-color-a: 1;
--tweak-blog-single-column-list-meta-color: hsla(0,0%,7.06%,1);
--primaryButtonBackgroundColor: hsla(0,0%,0%,1);
--primary-button-font-letter-spacing: 0em;
--secondary-button-padding-x: 1.2rem;
--course-list-grid-layout-course-item-hover-background-color: hsla(0,0%,100%,.75);
--tweak-text-block-stroke-color: hsla(0,0%,7.06%,1);
--tertiary-button-rounded-border-bottom-right-radius: 6.8px;
--tweak-product-basic-item-description-color: hsla(0,0%,7.06%,1);
--image-block-overlay-color: hsla(0,0%,7.06%,.5);
--image-block-overlap-image-overlay-color: hsla(204,90.91%,4.31%,1);
--form-field-shape-border-bottom-right-radius: 5px;
--tweak-form-block-field-fill-color-on-background-hsl: 0,0%,98.04%;
--tweak-newsletter-block-button-text-color-on-background: hsla(0,0%,100%,1);
--gradientHeaderBorderColor: hsla(0,0%,7.06%,1);
--list-section-carousel-title-color: hsla(0,0%,7.06%,1);
--tweak-blog-single-column-list-read-more-color: hsla(0,0%,0%,1);
--accent-hsl: 60,5.41%,85.49%;
--tweak-accordion-block-icon-color: hsla(0,0%,7.06%,1);
--image-block-stack-image-button-text-color: hsla(0,0%,100%,1);
--gradientHeaderBackgroundColor: hsla(204,90.91%,4.31%,1);
--shape-block-dropshadow-color: hsla(0,0%,100%,1);
--secondary-button-font-line-height: 1.2em;
--headingLinkColor: hsla(0,0%,0%,1);
--list-section-carousel-card-description-color: hsla(0,0%,7.06%,1);
--product-basic-item-restock-notification-color: hsla(0,0%,7.06%,1);
--list-section-carousel-button-background-color: hsla(0,0%,0%,1);
--tweak-blog-basic-grid-list-title-color: hsla(0,0%,7.06%,1);
--tweak-product-grid-text-below-list-title-color: hsla(0,0%,7.06%,1);
--tweak-product-quick-view-lightbox-overlay-color: hsla(0,0%,98.04%,1);
--tweak-menu-block-nav-color: hsla(0,0%,7.06%,1);
--tweak-form-block-field-accent-color-on-background: hsla(60,5.41%,85.49%,1);
--tweak-paragraph-medium-color-on-background: hsla(0,0%,7.06%,1);
--image-block-overlap-image-subtitle-color: hsla(0,0%,7.06%,1);
--tweak-accordion-block-icon-color-on-background: hsla(0,0%,7.06%,1);
--tweak-menu-block-item-description-color: hsla(0,0%,7.06%,1);
--tweak-summary-block-title-color: hsla(0,0%,7.06%,1);
--image-block-stack-image-subtitle-color: hsla(0,0%,7.06%,1);
--navigationLinkColor: hsla(0,0%,7.06%,1);
--secondaryButtonTextColor: hsla(0,0%,100%,1);
--announcement-bar-background-color: hsla(0,0%,7.06%,1);
--tweak-form-block-field-input-color-on-background-a: 1;
--tertiaryButtonBackgroundColor: hsla(0,0%,0%,1);
--list-section-simple-card-color: hsla(0,0%,100%,1);
--tweak-marquee-block-paragraph-color-on-background: hsla(0,0%,7.06%,1);
--scheduling-block-scheduler-background-color: hsla(0,0%,98.04%,1);
--tertiary-button-rounded-border-top-right-radius: 6.8px;
--list-section-banner-slideshow-description-color: hsla(0,0%,7.06%,1);
--video-grid-category-nav-color: hsla(0,0%,7.06%,1);
--primary-button-stroke: 0px;
--product-detail-subscriptions-description-text-color: hsla(0,0%,7.06%,1);
--tweak-accordion-block-divider-color-on-background: hsla(0,0%,7.06%,1);
--list-section-simple-card-description-link-color: hsla(0,0%,0%,1);
--tweak-product-grid-text-below-list-category-nav-color: hsla(0,0%,7.06%,1);
--product-detail-subscriptions-button-background-color: hsla(60,5.41%,85.49%,1);
--image-block-poster-inline-link-color: hsla(0,0%,98.04%,1);
--shape-block-background-color: hsla(0,0%,100%,1);
--course-item-nav-active-lesson-background-color: hsla(204,90.91%,4.31%,1);
--scheduling-block-header-text-color: hsla(0,0%,7.06%,1);
--tweak-quote-block-text-color: hsla(0,0%,7.06%,1);
--tweak-form-block-field-accent-color-a: 1;
--tweak-form-block-title-color: hsla(0,0%,7.06%,1);
--image-block-poster-image-button-text-color: hsla(0,0%,100%,1);
--list-section-banner-slideshow-arrow-background-color: hsla(0,0%,0%,1);
--product-list-filter-dropdown-label-color: hsla(0,0%,7.06%,1);
--primary-button-font-font-family: "Poppins";
--tweak-quote-block-text-color-on-background: hsla(0,0%,7.06%,1);
--tweak-gallery-icon-background-color: hsla(0,0%,98.04%,1);
--course-list-grid-layout-chapter-divider-color: hsla(0,0%,7.06%,1);
--list-section-carousel-card-description-link-color: hsla(0,0%,0%,1);
--tweak-heading-extra-large-color-on-background: hsla(0,0%,7.06%,1);
--tweak-marquee-block-stroke-color: hsla(0,0%,7.06%,1);
--social-links-block-main-icon-color: hsla(0,0%,7.06%,1);
--primary-button-rounded-border-top-left-radius: 6.8px;
--gradientHeaderDropShadowColor: hsla(0,0%,7.06%,1);
--tweak-form-block-field-fill-color-on-background: hsla(0,0%,98.04%,1);
--image-block-collage-image-title-bg-color: hsla(0,0%,98.04%,0);
--product-detail-one-time-purchase-price-text-color: hsla(0,0%,7.06%,1);
--image-block-card-image-subtitle-color: hsla(0,0%,7.06%,1);
--section-divider-stroke-color: hsla(0,0%,0%,1);
--scheduling-block-background-color: hsla(0,0%,98.04%,1);
--secondary-button-rounded-border-top-left-radius: 7.2px;
--product-list-filters-drawer-text-color: hsla(0,0%,7.06%,1);
--tweak-menu-block-item-title-color: hsla(0,0%,7.06%,1);
--tweak-heading-large-color-on-background: hsla(0,0%,7.06%,1);
--tweak-marquee-block-background-color: hsla(0,0%,100%,1);
--list-section-carousel-button-text-color: hsla(0,0%,100%,1);
--tweak-blog-side-by-side-list-title-color: hsla(0,0%,7.06%,1);
--form-field-checkbox-shape-border-bottom-right-radius: 5px;
--tweak-form-block-button-text-color-on-background: hsla(0,0%,100%,1);
--paragraphSmallColor: hsla(0,0%,7.06%,1);
--tweak-product-grid-text-below-list-scarcity-color: hsla(0,0%,7.06%,1);
--image-block-stack-image-title-bg-color: hsla(0,0%,98.04%,0);
--secondary-button-stroke: 0px;
--solidHeaderBorderColor: hsla(0,0%,7.06%,1);
--tweak-form-block-option-color-on-background: hsla(0,0%,7.06%,1);
--product-basic-item-discount-chip-background-color: hsla(0,0%,0%,1);
--image-block-poster-image-subtitle-color: hsla(0,0%,98.04%,1);
--form-field-radio-border-thickness: 1px;
--portfolio-grid-overlay-overlay-color: hsla(0,0%,98.04%,1);
--image-block-card-image-button-bg-color: hsla(0,0%,0%,1);
--tweak-blog-alternating-side-by-side-list-title-color: hsla(0,0%,7.06%,1);
--section-inset-border-color: hsla(0,0%,98.04%,1);
--tweak-blog-item-comment-meta-color: hsla(0,0%,7.06%,1);
--tweak-gallery-lightbox-icon-color: hsla(0,0%,7.06%,1);
--tweak-form-block-description-color-on-background: hsla(0,0%,7.06%,1);
--form-field-shape-border-top-left-radius: 5px;
--tweak-form-block-field-border-color-on-background: hsla(0,0%,7.06%,1);
--tweak-video-item-title-color: hsla(0,0%,7.06%,1);
--tweak-form-block-field-fill-color-hsl: 0,0%,100%;
--text-highlight-color: hsla(0,0%,0%,1);
--tweak-accordion-block-divider-color: hsla(0,0%,7.06%,1);
--list-section-banner-slideshow-card-description-link-color: hsla(0,0%,0%,1);
--secondary-button-font-font-size: 1.1rem;
--tweak-quote-block-source-color-on-background: hsla(0,0%,7.06%,1);
--announcement-bar-text-color: hsla(0,0%,98.04%,1);
--image-block-collage-image-overlay-color: hsla(204,90.91%,4.31%,1);
--primary-button-font-font-size-value: 2;
--tweak-marquee-block-heading-color: hsla(0,0%,7.06%,1);
--list-section-simple-button-background-color: hsla(0,0%,0%,1);
--image-block-overlap-image-button-bg-color: hsla(0,0%,0%,1);
--primary-button-rounded-border-bottom-right-radius: 6.8px;
--tweak-form-block-button-background-color: hsla(0,0%,0%,1);
--secondary-button-font-letter-spacing: .02em;
--tweak-blog-basic-grid-list-read-more-color: hsla(0,0%,0%,1);
--image-block-card-image-card-separation: 4%;
--tweak-video-item-pagination-icon-color: hsla(0,0%,7.06%,1);
--image-block-card-image-overlay-color: hsla(204,90.91%,4.31%,1);
--donation-block-stroke-color: hsla(0,0%,7.06%,1);
--tweak-blog-masonry-list-excerpt-color: hsla(0,0%,7.06%,1);
--list-section-banner-slideshow-button-background-color: hsla(0,0%,0%,1);
--donation-block-background-color: hsla(0,0%,100%,1);
--course-list-grid-layout-course-item-border-color: hsla(204,90.91%,4.31%,1);
--tweak-events-item-pagination-title-color: hsla(0,0%,7.06%,1);
--tweak-quote-block-source-color: hsla(0,0%,7.06%,1);
--tweak-product-grid-text-below-list-pagination-color: hsla(0,0%,7.06%,1);
--form-field-survey-border-thickness: 1px;
--secondary-button-rounded-border-top-right-radius: 7.2px;
--form-field-checkbox-border-thickness: 1px;
--tweak-quote-block-stroke-color: hsla(0,0%,7.06%,1);
--tweak-product-basic-item-scarcity-color: hsla(60,5.41%,85.49%,1);
--tweak-blog-side-by-side-list-meta-color: hsla(0,0%,7.06%,1);
--tweak-blog-side-by-side-list-excerpt-color: hsla(0,0%,7.06%,1);
--product-detail-subscription-price-text-color: hsla(0,0%,7.06%,1);
--primary-button-font-text-transform: none;
--list-section-banner-slideshow-arrow-color: hsla(0,0%,100%,1);
--image-block-stack-image-overlay-color: hsla(204,90.91%,4.31%,1);
--form-field-border-thickness: 1px;
--tweak-gallery-icon-color: hsla(0,0%,7.06%,1);
--tweak-form-block-field-fill-color-on-background-a: 1;
--tweak-product-quick-view-lightbox-controls-color: hsla(0,0%,7.06%,1);
--form-field-radio-shape-border-top-right-radius: 5px;
--tweak-summary-block-title-color-on-background: hsla(0,0%,7.06%,1);
--menuOverlayNavigationLinkColor: hsla(0,0%,7.06%,1);
--image-block-card-image-button-separation: 6%;
--tweak-form-block-field-border-color-on-background-hsl: 0,0%,7.06%;
--tweak-summary-block-header-text-color-on-background: hsla(0,0%,7.06%,1);
--tweak-blog-alternating-side-by-side-list-read-more-color: hsla(0,0%,0%,1);
--course-list-course-chapter-divider-color: hsla(0,0%,98.04%,1);
--tweak-form-block-survey-title-color-on-background: hsla(0,0%,7.06%,1);
--tweak-blog-item-comment-text-color: hsla(0,0%,7.06%,1);
--tweak-paragraph-link-color-on-background: hsla(0,0%,0%,1);
--image-block-card-image-title-color: hsla(0,0%,7.06%,1);
--tweak-summary-block-stroke-color: hsla(0,0%,7.06%,1);
--tweak-form-block-field-border-color-hsl: 0,0%,7.06%;
--form-field-checkbox-shape-border-top-left-radius: 5px;
--toggle-off-color: hsla(0,0%,100%,1);
--tweak-product-list-description-text-color: hsla(0,0%,7.06%,1);
--image-block-poster-image-title-color: hsla(0,0%,98.04%,1);
--image-block-overlap-inline-link-color: hsla(0,0%,7.06%,1);
--image-block-collage-background-color: hsla(0,0%,100%,1);
--tweak-paragraph-large-color-on-background: hsla(0,0%,7.06%,1);
--tweak-newsletter-block-title-color: hsla(0,0%,7.06%,1);
--tweak-form-block-option-color: hsla(0,0%,7.06%,1);
--tweak-form-block-field-input-color-hsl: 0,0%,7.06%;
--tweak-form-block-field-accent-color-on-background-hsl: 60,5.41%,85.49%;
--scheduling-block-scheduler-text-color: hsla(0,0%,7.06%,1);
--form-field-radio-shape-border-bottom-right-radius: 5px;
--portfolio-grid-overlay-title-color: hsla(0,0%,7.06%,1);
--tweak-blog-item-pagination-icon-color: hsla(0,0%,7.06%,1);
--list-section-simple-card-button-text-color: hsla(0,0%,100%,1);
--image-block-collage-image-title-color: hsla(0,0%,7.06%,1);
--list-section-banner-slideshow-title-color: hsla(0,0%,7.06%,1);
--portfolio-index-background-title-color: hsla(0,0%,7.06%,1);
--headingLargeColor: hsla(0,0%,7.06%,1);
--tweak-form-block-button-text-color: hsla(0,0%,100%,1);
--tweak-summary-block-excerpt-color: hsla(0,0%,7.06%,1);
```

### Spacing

```css
--course-item-lesson-name-font-letter-spacing: 0em;
--portfolio-grid-overlay-title-font-font-size-value: 2.2;
--menu-block-item-description-font-letter-spacing: 0em;
--portfolio-item-pagination-font-font-size-value: 2.2;
--portfolio-item-pagination-font-font-size: 2.2rem;
--portfolio-index-background-title-font-letter-spacing: 0em;
--menu-block-item-title-font-font-size: 1.2rem;
--product-basic-item-restock-notification-full-layout-font-font-size-value: 1;
--form-label-spacing-bottom: 4px;
--site-title-font-letter-spacing: 0em;
--video-item-meta-font-font-size-value: 1.9;
--course-item-name-mobile-font-font-size-value: 1.3;
--mobile-site-title-font-letter-spacing: 0em;
--form-field-checkbox-column-gap: 10px;
--list-section-title-text-font-font-size-value: 2.8;
--video-basic-grid-list-excerpt-font-font-size-value: .9;
--blog-side-by-side-list-excerpt-font-font-size: 1rem;
--product-basic-item-restock-notification-wrap-layout-font-font-size-value: 1;
--blog-basic-grid-list-excerpt-font-font-size: .9rem;
--product-block-price-font-font-size: 1.1rem;
--commerce-mini-cart-image-size: 60px;
--product-grid-text-below-price-font-font-size-value: 1.9;
--product-basic-item-scarcity-full-layout-font-letter-spacing: 0em;
--blog-single-column-list-excerpt-font-letter-spacing: 0em;
--video-basic-grid-list-category-nav-font-letter-spacing: 0em;
--blog-side-by-side-list-title-font-font-size-value: 2.8;
--course-list-course-item-lesson-excerpt-font-font-size: .875rem;
--form-block-caption-text-font-letter-spacing: 0em;
--product-list-description-font-letter-spacing: 0em;
--form-field-spacing-bottom: 20px;
--video-item-title-font-letter-spacing: 0em;
--blog-grid-masonry-list-title-font-font-size: 2.2rem;
--product-basic-item-add-ons-title-full-layout-font-font-size-value: 1;
--blog-alternating-side-by-side-list-title-font-letter-spacing: 0em;
--product-grid-text-below-scarcity-font-letter-spacing: 0em;
--events-item-pagination-font-font-size: 2.2rem;
--product-block-description-font-font-size-value: 1;
--product-basic-item-add-ons-title-half-layout-font-font-size-value: 1;
--newsletter-block-footnote-text-font-font-size-value: .9;
--events-item-pagination-date-font-font-size-value: 1.9;
--image-block-collage-image-content-padding: 10%;
--product-basic-item-description-half-layout-font-font-size: 1rem;
--product-basic-item-variant-fields-wrap-layout-font-letter-spacing: 0em;
--blog-grid-masonry-list-excerpt-font-font-size: .9rem;
--blog-side-by-side-list-meta-font-letter-spacing: 0em;
--newsletter-block-title-text-font-font-size: 2.2rem;
--content-link-block-title-font-font-size: 1rem;
--product-grid-text-below-price-font-font-size: 1.9rem;
--product-basic-item-description-font-letter-spacing: 0em;
--form-field-radio-size: 15px;
--newsletter-block-description-text-font-font-size-value: 1;
--portfolio-grid-basic-title-font-font-size-value: 1.2;
--portfolio-hover-follow-title-font-letter-spacing: 0em;
--course-item-side-nav-chapter-meta-font-font-size-value: .8;
--course-item-side-nav-lesson-meta-font-letter-spacing: 0em;
--header-button-font-font-size: .9rem;
--announcement-bar-font-letter-spacing: 0em;
--menu-block-title-font-letter-spacing: 0em;
--product-grid-text-below-scarcity-font-font-size: 1.9rem;
--product-basic-item-price-full-layout-font-font-size-value: 1;
--blog-single-column-list-meta-font-letter-spacing: 0em;
--product-block-description-font-letter-spacing: 0em;
--portfolio-index-background-title-font-font-size-value: 4;
--course-list-course-item-lesson-excerpt-font-font-size-value: .875;
--course-item-side-nav-lesson-meta-font-font-size: .8rem;
--course-list-grid-layout-chapter-name-font-font-size-value: 2;
--newsletter-block-button-text-font-font-size-value: 1;
--newsletter-block-field-text-font-letter-spacing: 0em;
--course-list-chapter-item-chapter-name-font-font-size-value: 2;
--product-basic-item-variant-fields-wrap-layout-font-font-size: .75rem;
--course-list-grid-layout-course-item-meta-font-font-size: .75rem;
--course-item-name-mobile-font-letter-spacing: 0em;
--product-basic-item-title-font-font-size: 2.8rem;
--product-basic-item-title-full-layout-font-letter-spacing: 0em;
--product-basic-item-title-half-layout-font-letter-spacing: 0em;
--course-item-side-nav-chapter-meta-font-font-size: .8rem;
--normal-text-size-value: 1;
--header-button-font-letter-spacing: .02em;
--product-basic-item-price-half-layout-font-font-size: 1rem;
--cookie-banner-disclaimer-font-font-size-value: .8;
--site-navigation-font-font-size: 1.2rem;
--blog-item-pagination-font-font-size-value: 2.2;
--product-basic-item-add-ons-title-full-layout-font-font-size: 1rem;
--course-list-chapter-item-chapter-meta-font-font-size-value: .75;
--blog-item-pagination-font-font-size: 2.2rem;
--tertiary-button-padding-x: 1.336em;
--course-item-side-nav-lesson-name-font-font-size-value: 1;
--form-block-description-text-font-font-size-value: .9;
--quote-block-source-font-font-size-value: 1.9;
--blog-side-by-side-list-title-font-font-size: 2.8rem;
--form-field-radio-row-gap: 10px;
--form-field-radio-column-gap: 10px;
--product-basic-item-restock-notification-wrap-layout-font-letter-spacing: 0em;
--blog-item-title-font-font-size: 4rem;
--form-block-option-text-font-font-size: .9rem;
--product-block-description-font-font-size: 1rem;
--product-grid-text-below-status-font-font-size: 1.9rem;
--product-basic-item-title-font-letter-spacing: 0em;
--course-list-grid-layout-course-item-excerpt-font-font-size-value: .875;
--video-preview-badge-font-letter-spacing: 0em;
--blog-side-by-side-list-meta-font-font-size-value: 1.9;
--form-block-option-text-font-font-size-value: .9;
--course-list-course-description-font-font-size: 1.4rem;
--video-preview-badge-font-font-size-value: 1;
--course-list-grid-layout-course-item-name-font-letter-spacing: 0em;
--site-navigation-font-font-size-value: 1.2;
--form-block-select-dropdown-text-font-font-size-value: 1;
--normal-meta-size-value: 1.9;
--menu-block-nav-font-letter-spacing: 0em;
--course-list-course-item-lesson-name-font-font-size-value: 1.125;
--product-basic-item-restock-notification-half-layout-font-font-size-value: 1;
--product-basic-item-description-wrap-layout-font-font-size-value: 1;
--course-list-grid-layout-course-item-name-font-font-size: 1.125rem;
--newsletter-block-button-text-font-letter-spacing: 0em;
--portfolio-item-pagination-font-letter-spacing: 0em;
--blog-basic-grid-list-title-font-font-size: 2.2rem;
--form-block-survey-title-text-font-letter-spacing: 0em;
--course-list-chapter-item-chapter-name-font-letter-spacing: 0em;
--product-basic-item-price-font-font-size-value: 1.2;
--course-list-course-name-font-letter-spacing: 0em;
--menu-block-item-title-font-font-size-value: 1.2;
--site-title-font-font-size: 2rem;
--heading-1-size-value: 4;
--tertiary-button-font-font-size-value: .9;
--product-basic-item-description-full-layout-font-font-size-value: 1;
--form-block-survey-title-text-font-font-size: 1rem;
--blog-single-column-list-title-font-font-size: 4rem;
--product-basic-item-add-ons-title-font-font-size: 1rem;
--product-basic-item-variant-fields-full-layout-font-font-size: .75rem;
--events-item-pagination-date-font-letter-spacing: 0em;
--product-basic-item-description-wrap-layout-font-font-size: 1rem;
--form-block-caption-text-font-font-size-value: .9;
--product-basic-item-add-ons-title-half-layout-font-letter-spacing: 0em;
--blog-item-meta-font-font-size: 1.9rem;
--course-list-chapter-item-chapter-meta-font-font-size: .75rem;
--product-basic-item-title-full-layout-font-font-size-value: 4;
--events-item-pagination-font-font-size-value: 2.2;
--heading-4-size: 1.2rem;
--product-basic-item-price-full-layout-font-font-size: 1rem;
--heading-font-letter-spacing: 0em;
--newsletter-block-description-text-font-font-size: 1rem;
--blog-item-author-profile-font-letter-spacing: 0em;
--product-basic-item-variant-fields-font-letter-spacing: 0em;
--blog-grid-masonry-list-excerpt-font-font-size-value: .9;
--product-grid-text-below-title-font-font-size: 1.2rem;
--blog-grid-masonry-list-title-font-letter-spacing: 0em;
--list-section-title-text-font-font-size: 2.8rem;
--list-section-title-text-font-letter-spacing: 0em;
--product-basic-item-scarcity-wrap-layout-font-font-size-value: .85;
--product-block-title-font-font-size: 1.3rem;
--product-basic-item-variant-fields-font-font-size-value: 1.9;
--blog-item-meta-font-letter-spacing: 0em;
--course-list-course-name-font-font-size: 4rem;
--video-item-title-font-font-size: 2.8rem;
--newsletter-block-footnote-text-font-letter-spacing: 0em;
--course-list-grid-layout-chapter-meta-font-font-size-value: .875;
--product-basic-item-variant-fields-half-layout-font-font-size: .75rem;
--form-field-checkbox-row-gap: 10px;
--product-basic-item-title-wrap-layout-font-font-size: 4rem;
--video-basic-grid-list-category-nav-font-font-size: 1rem;
--product-basic-item-price-wrap-layout-font-font-size-value: 1;
--blog-side-by-side-list-excerpt-font-letter-spacing: 0em;
--course-list-course-item-lesson-name-font-letter-spacing: 0em;
--product-basic-item-add-ons-title-font-font-size-value: 1;
--body-font-letter-spacing: 0em;
--blog-grid-masonry-list-meta-font-letter-spacing: 0em;
--menu-block-title-font-font-size-value: 2.2;
--form-block-description-text-font-font-size: .9rem;
--course-item-chapter-name-font-letter-spacing: 0em;
--blog-basic-grid-list-excerpt-font-letter-spacing: 0em;
--blog-single-column-list-title-font-letter-spacing: 0em;
--product-basic-item-description-font-font-size-value: 1;
--form-block-survey-title-text-font-font-size-value: 1;
--form-block-placeholder-text-font-font-size-value: 1;
--product-basic-item-price-wrap-layout-font-font-size: 1rem;
--product-basic-item-add-ons-title-wrap-layout-font-letter-spacing: 0em;
--blog-side-by-side-list-excerpt-font-font-size-value: 1;
--cookie-banner-disclaimer-font-font-size: .8rem;
--small-text-size: .9rem;
--video-item-title-font-font-size-value: 2.8;
--small-text-size-value: .9;
--content-link-block-title-font-letter-spacing: 0em;
--course-list-grid-layout-chapter-meta-font-letter-spacing: 0em;
--product-basic-item-description-half-layout-font-letter-spacing: 0em;
--course-item-chapter-name-font-font-size: 1rem;
--large-text-size-value: 1.4;
--blog-side-by-side-list-title-font-letter-spacing: 0em;
--course-list-course-description-font-font-size-value: 1.4;
--blog-single-column-list-excerpt-font-font-size: 1rem;
--form-block-placeholder-text-font-font-size: 1rem;
--product-grid-text-below-price-font-letter-spacing: 0em;
--product-list-description-font-font-size: 1rem;
--blog-alternating-side-by-side-list-meta-font-letter-spacing: 0em;
--product-grid-text-below-status-font-letter-spacing: 0em;
--form-field-padding-horizontal: 20px;
--product-basic-item-restock-notification-half-layout-font-letter-spacing: 0em;
--portfolio-grid-overlay-title-font-letter-spacing: 0em;
--form-field-padding-vertical: 10px;
--heading-4-size-value: 1.2;
--header-button-font-font-size-value: .9;
--blog-single-column-list-title-font-font-size-value: 4;
--video-item-meta-font-font-size: 1.9rem;
--product-basic-item-title-half-layout-font-font-size-value: 4;
--newsletter-block-footnote-text-font-font-size: .9rem;
--product-grid-text-below-title-font-font-size-value: 1.2;
--blog-side-by-side-list-meta-font-font-size: 1.9rem;
--menu-block-title-font-font-size: 2.2rem;
--product-grid-text-below-scarcity-font-font-size-value: 1.9;
--menu-block-item-price-font-letter-spacing: 0em;
--product-basic-item-description-full-layout-font-letter-spacing: 0em;
--menu-block-item-description-font-font-size: 1rem;
--product-basic-item-scarcity-full-layout-font-font-size-value: .85;
--course-item-name-font-letter-spacing: 0em;
--video-basic-grid-list-excerpt-font-letter-spacing: 0em;
--newsletter-block-description-text-font-letter-spacing: 0em;
--announcement-bar-font-font-size: .9rem;
--video-item-description-font-letter-spacing: 0em;
--video-basic-grid-list-title-font-font-size-value: 1.2;
--product-block-price-font-font-size-value: 1.1;
--events-item-pagination-font-letter-spacing: 0em;
--normal-meta-size: 1.9rem;
--menu-block-nav-font-font-size-value: 1.9;
--mobile-site-title-font-font-size: 3rem;
--course-list-grid-layout-chapter-name-font-letter-spacing: 0em;
--course-item-side-nav-chapter-meta-font-letter-spacing: 0em;
--product-basic-item-scarcity-half-layout-font-font-size: .85rem;
--heading-3-size: 2.2rem;
--product-list-description-font-font-size-value: 1;
--newsletter-block-title-text-font-font-size-value: 2.2;
--course-list-grid-layout-course-item-name-font-font-size-value: 1.125;
--announcement-bar-font-font-size-value: .9;
--product-block-price-font-letter-spacing: 0em;
--video-item-description-font-font-size-value: 1;
--blog-grid-masonry-list-excerpt-font-letter-spacing: 0em;
--course-item-side-nav-chapter-name-font-font-size: 1.5rem;
--product-basic-item-title-wrap-layout-font-letter-spacing: 0em;
--video-item-pagination-font-font-size-value: 2.2;
--blog-alternating-side-by-side-list-title-font-font-size: 2.8rem;
--portfolio-index-background-title-font-font-size: 4rem;
--video-basic-grid-list-title-font-letter-spacing: 0em;
--portfolio-hover-static-title-font-font-size-value: 4;
--form-block-input-text-font-font-size: 1rem;
--course-list-course-item-lesson-meta-font-font-size: .75rem;
--product-basic-item-scarcity-wrap-layout-font-letter-spacing: 0em;
--product-basic-item-variant-fields-full-layout-font-letter-spacing: 0em;
--course-list-grid-layout-chapter-name-font-font-size: 2rem;
--product-basic-item-price-font-letter-spacing: 0em;
--large-text-size: 1.4rem;
--product-basic-item-add-ons-title-wrap-layout-font-font-size: 1rem;
--blog-item-title-font-font-size-value: 4;
--course-list-course-item-lesson-excerpt-font-letter-spacing: 0em;
--product-block-title-font-font-size-value: 1.3;
--blog-grid-masonry-list-meta-font-font-size-value: 1.9;
--product-basic-item-restock-notification-font-font-size-value: 1;
--blog-item-author-profile-font-font-size-value: .9;
--course-item-side-nav-lesson-name-font-font-size: 1rem;
--product-basic-item-title-full-layout-font-font-size: 4rem;
--form-block-description-text-font-letter-spacing: 0em;
--product-basic-item-title-wrap-layout-font-font-size-value: 4;
--product-basic-item-description-half-layout-font-font-size-value: 1;
--product-basic-item-add-ons-title-wrap-layout-font-font-size-value: 1;
--product-basic-item-add-ons-title-half-layout-font-font-size: 1rem;
--blog-alternating-side-by-side-list-meta-font-font-size: 1.9rem;
--blog-basic-grid-list-title-font-font-size-value: 2.2;
--blog-basic-grid-list-excerpt-font-font-size-value: .9;
--form-field-radio-space-between-icon-and-text: 11px;
--heading-2-size: 2.8rem;
--blog-alternating-side-by-side-list-title-font-font-size-value: 2.8;
--portfolio-hover-static-title-font-font-size: 4rem;
--product-basic-item-price-half-layout-font-font-size-value: 1;
--product-basic-item-price-wrap-layout-font-letter-spacing: 0em;
--product-basic-item-restock-notification-full-layout-font-font-size: 1rem;
--product-basic-item-restock-notification-wrap-layout-font-font-size: 1rem;
--blog-basic-grid-list-meta-font-font-size: 1.9rem;
--course-item-name-mobile-font-font-size: 1.3rem;
--course-list-grid-layout-course-item-meta-font-letter-spacing: 0em;
--blog-basic-grid-list-title-font-letter-spacing: 0em;
--blog-item-title-font-letter-spacing: 0em;
--product-basic-item-restock-notification-font-font-size: 1rem;
--form-field-checkbox-padding-horizontal: 10px;
--video-item-pagination-font-letter-spacing: 0em;
--blog-alternating-side-by-side-list-excerpt-font-letter-spacing: 0em;
--course-item-lesson-name-font-font-size: 4rem;
--form-block-input-text-font-font-size-value: 1;
--quote-block-source-font-letter-spacing: 0em;
--form-block-placeholder-text-font-letter-spacing: 0em;
--product-basic-item-description-full-layout-font-font-size: 1rem;
--course-list-course-name-font-font-size-value: 4;
--form-field-column-gap: 10px;
--course-item-chapter-name-font-font-size-value: 1;
--video-basic-grid-list-title-font-font-size: 1.2rem;
--course-item-name-font-font-size: 2rem;
--product-basic-item-scarcity-wrap-layout-font-font-size: .85rem;
--product-basic-item-variant-fields-wrap-layout-font-font-size-value: .75;
--menu-block-item-price-font-font-size-value: 1;
--menu-block-nav-font-font-size: 1.9rem;
--video-basic-grid-list-meta-font-letter-spacing: 0em;
--meta-font-letter-spacing: 0em;
--normal-text-size: 1rem;
--form-field-checkbox-space-between-icon-and-text: 11px;
--blog-alternating-side-by-side-list-excerpt-font-font-size-value: 1;
--form-field-survey-size: 15px;
--course-list-grid-layout-chapter-meta-font-font-size: .875rem;
--product-basic-item-add-ons-title-font-letter-spacing: 0em;
--video-item-description-font-font-size: 1rem;
--video-basic-grid-list-meta-font-font-size: 1.9rem;
--product-basic-item-price-full-layout-font-letter-spacing: 0em;
--portfolio-hover-follow-title-font-font-size: 4rem;
--portfolio-grid-basic-title-font-font-size: 1.2rem;
--course-item-side-nav-chapter-name-font-font-size-value: 1.5;
--base-font-size: 15px;
--product-basic-item-restock-notification-font-letter-spacing: 0em;
--product-basic-item-variant-fields-full-layout-font-font-size-value: .75;
--blog-alternating-side-by-side-list-excerpt-font-font-size: 1rem;
--tertiary-button-padding-y: .8em;
--course-list-grid-layout-course-item-meta-font-font-size-value: .75;
--quote-block-text-font-font-size-value: 1.4;
--video-item-pagination-font-font-size: 2.2rem;
--course-item-lesson-name-font-font-size-value: 4;
--course-list-course-description-font-letter-spacing: 0em;
--newsletter-block-field-text-font-font-size: 1rem;
--site-title-font-font-size-value: 2;
--course-item-name-font-font-size-value: 2;
--course-list-grid-layout-course-item-excerpt-font-font-size: .875rem;
--portfolio-grid-overlay-title-font-font-size: 2.2rem;
--newsletter-block-title-text-font-letter-spacing: 0em;
--newsletter-block-field-text-font-font-size-value: 1;
--product-basic-item-variant-fields-half-layout-font-letter-spacing: 0em;
--course-list-grid-layout-course-item-excerpt-font-letter-spacing: 0em;
--product-basic-item-variant-fields-half-layout-font-font-size-value: .75;
--course-list-course-item-lesson-meta-font-letter-spacing: 0em;
--video-basic-grid-list-excerpt-font-font-size: .9rem;
--product-basic-item-variant-fields-font-font-size: 1.9rem;
--product-basic-item-restock-notification-half-layout-font-font-size: 1rem;
--form-field-radio-padding-horizontal: 10px;
--blog-basic-grid-list-meta-font-letter-spacing: 0em;
--form-block-select-dropdown-text-font-letter-spacing: 0em;
--form-caption-spacing-bottom: 2px;
--product-basic-item-restock-notification-full-layout-font-letter-spacing: 0em;
--menu-block-item-title-font-letter-spacing: 0em;
--blog-basic-grid-list-meta-font-font-size-value: 1.9;
--course-item-side-nav-chapter-name-font-letter-spacing: 0em;
--blog-single-column-list-excerpt-font-font-size-value: 1;
--mobile-site-title-font-font-size-value: 3;
--form-description-spacing-bottom: 4px;
--product-basic-item-title-font-font-size-value: 2.8;
--quote-block-text-font-font-size: 1.4rem;
--form-block-title-text-font-letter-spacing: 0em;
--form-block-title-text-font-font-size-value: 1;
--course-list-chapter-item-chapter-meta-font-letter-spacing: 0em;
--product-grid-text-below-title-font-letter-spacing: 0em;
--form-block-input-text-font-letter-spacing: 0em;
--heading-3-size-value: 2.2;
--blog-item-author-profile-font-font-size: .9rem;
--portfolio-hover-static-title-font-letter-spacing: 0em;
--product-basic-item-price-font-font-size: 1.2rem;
--menu-block-item-price-font-font-size: 1rem;
--product-basic-item-description-wrap-layout-font-letter-spacing: 0em;
--product-basic-item-title-half-layout-font-font-size: 4rem;
--product-block-title-font-letter-spacing: 0em;
--quote-block-source-font-font-size: 1.9rem;
--form-field-checkbox-padding-vertical: 1px;
--product-basic-item-price-half-layout-font-letter-spacing: 0em;
--events-item-pagination-date-font-font-size: 1.9rem;
--quote-block-text-font-letter-spacing: 0em;
--product-basic-item-scarcity-font-font-size-value: 1.9;
--commerce-mini-cart-image-placeholder-size: 22px;
--product-basic-item-scarcity-font-letter-spacing: 0em;
--blog-item-meta-font-font-size-value: 1.9;
--video-preview-badge-font-font-size: 1rem;
--tertiary-button-font-letter-spacing: .02em;
--form-field-checkbox-size: 15px;
--product-basic-item-description-font-font-size: 1rem;
--blog-grid-masonry-list-meta-font-font-size: 1.9rem;
--form-field-radio-padding-vertical: 1px;
--form-block-caption-text-font-font-size: .9rem;
--form-block-option-text-font-letter-spacing: 0em;
--course-list-chapter-item-chapter-name-font-font-size: 2rem;
--blog-alternating-side-by-side-list-meta-font-font-size-value: 1.9;
--heading-2-size-value: 2.8;
--course-item-side-nav-lesson-name-font-letter-spacing: 0em;
--portfolio-grid-basic-title-font-letter-spacing: 0em;
--course-list-course-item-lesson-meta-font-font-size-value: .75;
--blog-single-column-list-meta-font-font-size: 1.9rem;
--content-link-block-title-font-font-size-value: 1;
--form-block-title-text-font-font-size: 1rem;
--blog-grid-masonry-list-title-font-font-size-value: 2.2;
--course-item-side-nav-lesson-meta-font-font-size-value: .8;
--product-basic-item-scarcity-font-font-size: 1.9rem;
--product-basic-item-scarcity-full-layout-font-font-size: .85rem;
--portfolio-hover-follow-title-font-font-size-value: 4;
--video-basic-grid-list-category-nav-font-font-size-value: 1;
--heading-1-size: 4rem;
--form-block-select-dropdown-text-font-font-size: 1rem;
--newsletter-block-button-text-font-font-size: 1rem;
--cookie-banner-disclaimer-font-letter-spacing: 0em;
--product-basic-item-scarcity-half-layout-font-letter-spacing: 0em;
--site-navigation-font-letter-spacing: .1em;
--tertiary-button-font-font-size: .9rem;
--blog-single-column-list-meta-font-font-size-value: 1.9;
--product-basic-item-scarcity-half-layout-font-font-size-value: .85;
--video-item-meta-font-letter-spacing: 0em;
--blog-item-pagination-font-letter-spacing: 0em;
--product-grid-text-below-status-font-font-size-value: 1.9;
--course-list-course-item-lesson-name-font-font-size: 1.125rem;
--menu-block-item-description-font-font-size-value: 1;
--form-field-dropdown-icon-size: 18px;
--video-basic-grid-list-meta-font-font-size-value: 1.9;
--product-basic-item-add-ons-title-full-layout-font-letter-spacing: 0em;
```

### Typography

```css
--tertiary-button-font-font-style: normal;
--product-basic-item-restock-notification-wrap-layout-font-font-style: normal;
--content-link-block-title-font-font-weight: 400;
--product-basic-item-title-half-layout-font-font-family: "Poppins";
--quote-block-text-font-font-family: "satoshi-ymnzpr";
--quote-block-text-font-font-weight: 400;
--product-basic-item-add-ons-title-half-layout-font-font-weight: 400;
--product-basic-item-description-font-line-height: 1.8em;
--course-list-grid-layout-chapter-meta-font-font-style: normal;
--product-basic-item-restock-notification-wrap-layout-font-text-transform: none;
--course-list-course-description-font-line-height: 1.8em;
--product-basic-item-scarcity-font-line-height: 1.2em;
--video-basic-grid-list-category-nav-font-font-family: "satoshi-ymnzpr";
--form-block-placeholder-text-font-line-height: 1.8em;
--product-list-description-font-text-transform: none;
--blog-grid-masonry-list-title-font-text-transform: none;
--product-basic-item-variant-fields-wrap-layout-font-font-family: "satoshi-ymnzpr";
--blog-item-author-profile-font-line-height: 1.8em;
--product-basic-item-add-ons-title-wrap-layout-font-font-weight: 400;
--video-basic-grid-list-title-font-font-weight: 500;
--blog-item-author-profile-font-font-family: "satoshi-ymnzpr";
--mobile-site-title-font-text-transform: none;
--course-item-side-nav-lesson-meta-font-line-height: 1.2em;
--blog-side-by-side-list-excerpt-font-font-family: "satoshi-ymnzpr";
--portfolio-item-pagination-font-font-style: normal;
--newsletter-block-button-text-font-line-height: 1.8em;
--blog-basic-grid-list-meta-font-font-style: normal;
--product-basic-item-variant-fields-font-line-height: 1.2em;
--newsletter-block-description-text-font-font-family: "satoshi-ymnzpr";
--menu-block-title-font-font-style: normal;
--heading-font-font-weight: 500;
--course-list-course-item-lesson-meta-font-font-weight: 400;
--blog-alternating-side-by-side-list-title-font-font-family: "Poppins";
--product-basic-item-title-full-layout-font-font-weight: 500;
--events-item-pagination-font-text-transform: none;
--blog-basic-grid-list-excerpt-font-font-style: normal;
--form-block-survey-title-text-font-font-style: normal;
--product-basic-item-add-ons-title-half-layout-font-font-family: "satoshi-ymnzpr";
--meta-font-text-transform: none;
--course-list-grid-layout-course-item-meta-font-font-weight: 400;
--course-list-course-item-lesson-meta-font-font-style: normal;
--menu-block-item-description-font-font-style: normal;
--blog-single-column-list-excerpt-font-font-style: normal;
--site-title-font-line-height: 1.4em;
--blog-side-by-side-list-meta-font-font-style: normal;
--product-basic-item-variant-fields-font-font-weight: 400;
--video-basic-grid-list-meta-font-text-transform: none;
--product-basic-item-scarcity-font-font-style: normal;
--course-list-course-name-font-font-family: "Poppins";
--product-basic-item-restock-notification-full-layout-font-font-weight: 400;
--course-list-grid-layout-chapter-name-font-font-style: normal;
--product-basic-item-variant-fields-font-font-style: normal;
--blog-basic-grid-list-meta-font-line-height: 1.2em;
--course-item-chapter-name-font-font-weight: 400;
--product-basic-item-description-wrap-layout-font-text-transform: none;
--portfolio-hover-follow-title-font-font-family: "Poppins";
--product-basic-item-scarcity-font-text-transform: none;
--tertiary-button-font-line-height: 1.2em;
--product-grid-text-below-price-font-line-height: 1.2em;
--video-item-description-font-font-style: normal;
--blog-single-column-list-meta-font-font-style: normal;
--portfolio-grid-overlay-title-font-text-transform: none;
--blog-basic-grid-list-meta-font-font-weight: 400;
--content-link-block-title-font-font-family: "satoshi-ymnzpr";
--product-grid-text-below-price-font-font-family: "satoshi-ymnzpr";
--product-grid-text-below-status-font-font-weight: 400;
--quote-block-source-font-font-style: normal;
--form-block-description-text-font-text-transform: none;
--course-item-side-nav-lesson-name-font-font-style: normal;
--newsletter-block-field-text-font-text-transform: none;
--product-basic-item-restock-notification-half-layout-font-line-height: 1.8em;
--menu-block-item-description-font-text-transform: none;
--video-preview-badge-font-font-style: normal;
--course-list-grid-layout-course-item-name-font-font-family: "Poppins";
--course-list-grid-layout-course-item-name-font-line-height: 1.4em;
--portfolio-hover-follow-title-font-text-transform: none;
--blog-single-column-list-excerpt-font-text-transform: none;
--form-block-select-dropdown-text-font-font-family: "satoshi-ymnzpr";
--newsletter-block-button-text-font-font-weight: 400;
--product-basic-item-add-ons-title-font-line-height: 1.8em;
--course-list-chapter-item-chapter-meta-font-font-weight: 400;
--video-item-description-font-font-family: "satoshi-ymnzpr";
--product-basic-item-scarcity-half-layout-font-font-family: "satoshi-ymnzpr";
--blog-alternating-side-by-side-list-excerpt-font-font-family: "satoshi-ymnzpr";
--product-basic-item-variant-fields-wrap-layout-font-line-height: 1.8em;
--site-title-font-font-style: normal;
--blog-side-by-side-list-meta-font-font-family: "satoshi-ymnzpr";
--course-list-grid-layout-course-item-meta-font-line-height: 1.2em;
--form-block-select-dropdown-text-font-font-style: normal;
--cookie-banner-disclaimer-font-line-height: 1.8em;
--blog-grid-masonry-list-meta-font-font-family: "satoshi-ymnzpr";
--form-block-description-text-font-font-style: normal;
--blog-alternating-side-by-side-list-meta-font-line-height: 1.2em;
--product-basic-item-add-ons-title-wrap-layout-font-font-family: "satoshi-ymnzpr";
--course-list-course-description-font-font-family: "satoshi-ymnzpr";
--product-basic-item-restock-notification-full-layout-font-text-transform: none;
--blog-alternating-side-by-side-list-excerpt-font-line-height: 1.8em;
--course-item-name-mobile-font-font-weight: 500;
--blog-item-meta-font-font-style: italic;
--video-basic-grid-list-title-font-line-height: 1.4em;
--form-block-option-text-font-line-height: 1.8em;
--product-basic-item-restock-notification-wrap-layout-font-font-family: "satoshi-ymnzpr";
--announcement-bar-font-font-family: "satoshi-ymnzpr";
--menu-block-nav-font-font-weight: 400;
--video-basic-grid-list-meta-font-line-height: 1.2em;
--product-basic-item-title-half-layout-font-font-weight: 500;
--product-basic-item-title-full-layout-font-line-height: 1.4em;
--product-basic-item-price-full-layout-font-font-family: "satoshi-ymnzpr";
--events-item-pagination-font-font-weight: 500;
--video-basic-grid-list-meta-font-font-family: "satoshi-ymnzpr";
--product-basic-item-add-ons-title-font-text-transform: none;
--course-list-course-item-lesson-excerpt-font-line-height: 1.8em;
--video-item-meta-font-font-weight: 400;
--events-item-pagination-date-font-font-family: "satoshi-ymnzpr";
--form-block-title-text-font-text-transform: none;
--course-list-grid-layout-chapter-meta-font-line-height: 1.2em;
--blog-single-column-list-title-font-text-transform: none;
--newsletter-block-description-text-font-font-style: normal;
--form-block-option-text-font-font-weight: 400;
--menu-block-item-price-font-font-style: normal;
--blog-alternating-side-by-side-list-meta-font-font-family: "satoshi-ymnzpr";
--blog-grid-masonry-list-excerpt-font-line-height: 1.8em;
--product-block-description-font-line-height: 1.8em;
--course-item-side-nav-chapter-meta-font-font-style: normal;
--product-basic-item-title-wrap-layout-font-text-transform: none;
--video-basic-grid-list-excerpt-font-font-weight: 400;
--blog-single-column-list-title-font-font-weight: 500;
--list-section-title-text-font-text-transform: none;
--product-list-description-font-font-family: "satoshi-ymnzpr";
--product-grid-text-below-scarcity-font-font-style: normal;
--blog-side-by-side-list-excerpt-font-line-height: 1.8em;
--events-item-pagination-date-font-font-weight: 400;
--video-basic-grid-list-excerpt-font-font-style: normal;
--blog-basic-grid-list-title-font-font-weight: 500;
--meta-font-font-weight: 400;
--course-list-chapter-item-chapter-meta-font-font-style: normal;
--product-basic-item-title-full-layout-font-text-transform: none;
--form-block-placeholder-text-font-text-transform: none;
--blog-basic-grid-list-excerpt-font-text-transform: none;
--portfolio-index-background-title-font-text-transform: none;
--course-list-grid-layout-chapter-meta-font-text-transform: none;
--blog-item-title-font-font-style: normal;
--product-basic-item-title-full-layout-font-font-style: normal;
--portfolio-item-pagination-font-font-family: "Poppins";
--mobile-site-title-font-font-family: "Poppins";
--product-basic-item-title-half-layout-font-font-style: normal;
--header-button-font-text-transform: none;
--product-basic-item-restock-notification-font-font-style: normal;
--course-item-side-nav-chapter-meta-font-text-transform: none;
--video-item-pagination-font-font-style: normal;
--blog-grid-masonry-list-title-font-font-style: normal;
--course-list-grid-layout-chapter-name-font-font-family: "Poppins";
--product-grid-text-below-status-font-text-transform: none;
--course-item-side-nav-chapter-name-font-font-family: "Poppins";
--portfolio-grid-overlay-title-font-font-weight: 500;
--product-basic-item-price-full-layout-font-text-transform: none;
--course-list-course-description-font-font-style: normal;
--product-basic-item-price-half-layout-font-font-weight: 400;
--blog-grid-masonry-list-meta-font-text-transform: none;
--course-list-grid-layout-chapter-meta-font-font-family: "satoshi-ymnzpr";
--product-grid-text-below-title-font-font-family: "Poppins";
--form-block-survey-title-text-font-text-transform: none;
--site-navigation-font-font-weight: 700;
--portfolio-index-background-title-font-font-style: normal;
--blog-side-by-side-list-title-font-font-family: "satoshi-ymnzpr";
--blog-grid-masonry-list-title-font-line-height: 1.4em;
--product-basic-item-add-ons-title-full-layout-font-font-family: "satoshi-ymnzpr";
--video-item-title-font-line-height: 1.4em;
--course-list-course-item-lesson-excerpt-font-font-weight: 400;
--menu-block-item-description-font-font-family: "satoshi-ymnzpr";
--product-block-description-font-font-family: "satoshi-ymnzpr";
--product-basic-item-scarcity-half-layout-font-line-height: 1.2em;
--form-block-title-text-font-font-family: "satoshi-ymnzpr";
--menu-block-item-title-font-font-weight: 500;
--course-list-course-description-font-text-transform: none;
--blog-item-pagination-font-font-style: normal;
--menu-block-item-title-font-line-height: 1.4em;
--course-list-grid-layout-course-item-excerpt-font-text-transform: none;
--product-basic-item-restock-notification-wrap-layout-font-font-weight: 400;
--video-item-pagination-font-font-weight: 500;
--content-link-block-title-font-line-height: 1.8em;
--video-item-pagination-font-font-family: "Poppins";
--blog-single-column-list-title-font-line-height: 1.4em;
--form-block-select-dropdown-text-font-font-weight: 400;
--product-basic-item-variant-fields-half-layout-font-line-height: 1.8em;
--product-list-description-font-font-weight: 400;
--course-list-course-name-font-font-weight: 500;
--menu-block-title-font-font-weight: 500;
--form-block-title-text-font-font-weight: 400;
--product-basic-item-restock-notification-font-line-height: 1.8em;
--menu-block-nav-font-text-transform: none;
--blog-alternating-side-by-side-list-meta-font-font-weight: 400;
--form-block-title-text-font-line-height: 1.8em;
--product-basic-item-price-font-font-family: "Poppins";
--product-basic-item-restock-notification-full-layout-font-font-style: normal;
--product-basic-item-restock-notification-half-layout-font-font-style: normal;
--product-basic-item-scarcity-half-layout-font-font-style: normal;
--product-basic-item-title-half-layout-font-line-height: 1.4em;
--course-item-side-nav-lesson-meta-font-font-weight: 400;
--product-basic-item-scarcity-font-font-family: "satoshi-ymnzpr";
--form-block-survey-title-text-font-font-weight: 400;
--newsletter-block-field-text-font-font-style: normal;
--course-item-side-nav-lesson-name-font-font-weight: 400;
--blog-alternating-side-by-side-list-title-font-font-weight: 500;
--cookie-banner-disclaimer-font-font-weight: 400;
--portfolio-hover-follow-title-font-font-weight: 500;
--course-item-lesson-name-font-text-transform: none;
--site-navigation-font-font-family: "Poppins";
--product-block-description-font-font-style: normal;
--course-item-side-nav-lesson-name-font-line-height: 1.8em;
--header-button-font-font-weight: 500;
--product-block-title-font-font-family: "satoshi-ymnzpr";
--menu-block-item-price-font-font-weight: 400;
--blog-side-by-side-list-title-font-line-height: 1.4em;
--blog-item-pagination-font-line-height: 1.4em;
--course-list-chapter-item-chapter-name-font-font-family: "Poppins";
--course-item-chapter-name-font-font-family: "satoshi-ymnzpr";
--video-preview-badge-font-font-weight: 400;
--product-basic-item-title-wrap-layout-font-line-height: 1.4em;
--form-block-description-text-font-font-family: "satoshi-ymnzpr";
--product-basic-item-description-wrap-layout-font-font-family: "satoshi-ymnzpr";
--body-font-font-family: "satoshi-ymnzpr";
--course-list-grid-layout-course-item-name-font-font-style: normal;
--body-font-line-height: 1.8em;
--course-list-course-name-font-line-height: 1.4em;
--video-basic-grid-list-excerpt-font-font-family: "satoshi-ymnzpr";
--product-block-price-font-font-family: "satoshi-ymnzpr";
--product-basic-item-restock-notification-full-layout-font-line-height: 1.8em;
--product-basic-item-price-wrap-layout-font-font-style: normal;
--product-basic-item-restock-notification-font-text-transform: none;
--course-list-grid-layout-chapter-name-font-line-height: 1.4em;
--portfolio-hover-follow-title-font-line-height: 1.4em;
--course-list-grid-layout-chapter-name-font-text-transform: none;
--course-item-name-font-text-transform: none;
--site-title-font-font-weight: 500;
--newsletter-block-button-text-font-font-family: "satoshi-ymnzpr";
--quote-block-text-font-text-transform: none;
--course-list-course-item-lesson-meta-font-text-transform: none;
--menu-block-item-title-font-text-transform: none;
--meta-font-line-height: 1.2em;
--site-navigation-font-font-style: normal;
--quote-block-text-font-font-style: normal;
--video-preview-badge-font-text-transform: none;
--product-basic-item-variant-fields-wrap-layout-font-font-style: normal;
--heading-font-font-style: normal;
--product-basic-item-variant-fields-full-layout-font-line-height: 1.8em;
--blog-item-meta-font-font-family: "satoshi-ymnzpr";
--course-item-name-font-line-height: 1.4em;
--product-basic-item-description-font-text-transform: none;
--course-list-grid-layout-course-item-meta-font-font-family: "satoshi-ymnzpr";
--cookie-banner-disclaimer-font-font-style: normal;
--course-item-side-nav-chapter-name-font-font-style: normal;
--video-item-pagination-font-line-height: 1.4em;
--blog-basic-grid-list-title-font-line-height: 1.4em;
--product-basic-item-description-full-layout-font-font-style: normal;
--list-section-title-text-font-font-weight: 500;
--product-basic-item-price-half-layout-font-font-style: normal;
--product-grid-text-below-status-font-font-style: normal;
--product-basic-item-scarcity-half-layout-font-font-weight: 400;
--announcement-bar-font-text-transform: none;
--course-item-side-nav-lesson-name-font-font-family: "satoshi-ymnzpr";
--product-basic-item-add-ons-title-half-layout-font-text-transform: none;
--form-block-input-text-font-font-weight: 400;
--product-list-description-font-line-height: 1.8em;
--blog-grid-masonry-list-excerpt-font-font-style: normal;
--course-item-lesson-name-font-font-family: "Poppins";
--portfolio-hover-static-title-font-font-weight: 500;
--blog-basic-grid-list-excerpt-font-font-weight: 400;
--blog-item-title-font-font-family: "satoshi-ymnzpr";
--product-basic-item-description-wrap-layout-font-font-style: normal;
--heading-font-text-transform: none;
--product-basic-item-description-full-layout-font-line-height: 1.8em;
--tertiary-button-font-font-family: "Poppins";
--form-block-placeholder-text-font-font-family: "satoshi-ymnzpr";
--form-block-caption-text-font-font-family: "satoshi-ymnzpr";
--video-item-description-font-line-height: 1.8em;
--video-basic-grid-list-meta-font-font-style: normal;
--course-item-name-font-font-family: "Poppins";
--product-block-price-font-font-style: normal;
--product-basic-item-scarcity-wrap-layout-font-text-transform: none;
--blog-grid-masonry-list-title-font-font-family: "Poppins";
--form-block-caption-text-font-font-style: normal;
--blog-item-title-font-line-height: 1.4em;
--product-basic-item-title-wrap-layout-font-font-weight: 500;
--product-basic-item-scarcity-full-layout-font-line-height: 1.2em;
--course-list-course-item-lesson-excerpt-font-text-transform: none;
--blog-grid-masonry-list-title-font-font-weight: 500;
--portfolio-hover-static-title-font-font-style: normal;
--product-basic-item-title-font-font-style: normal;
--product-basic-item-price-half-layout-font-font-family: "satoshi-ymnzpr";
--blog-grid-masonry-list-meta-font-font-style: normal;
--product-block-title-font-font-style: normal;
--content-link-block-title-font-text-transform: none;
--portfolio-grid-basic-title-font-line-height: 1.4em;
--portfolio-hover-static-title-font-font-family: "Poppins";
--video-preview-badge-font-line-height: 1.8em;
--blog-grid-masonry-list-excerpt-font-text-transform: none;
--menu-block-title-font-line-height: 1.4em;
--course-list-course-item-lesson-excerpt-font-font-family: "satoshi-ymnzpr";
--product-list-description-font-font-style: normal;
--course-item-side-nav-chapter-name-font-font-weight: 500;
--product-basic-item-add-ons-title-wrap-layout-font-font-style: normal;
--product-grid-text-below-price-font-font-style: normal;
--product-grid-text-below-status-font-line-height: 1.2em;
--blog-alternating-side-by-side-list-title-font-text-transform: none;
--blog-basic-grid-list-meta-font-text-transform: none;
--product-basic-item-variant-fields-half-layout-font-font-weight: 400;
--course-list-grid-layout-course-item-name-font-font-weight: 500;
--product-basic-item-add-ons-title-full-layout-font-font-style: normal;
--menu-block-nav-font-font-style: normal;
--site-navigation-font-text-transform: none;
--blog-item-pagination-font-font-family: "satoshi-ymnzpr";
--form-block-caption-text-font-font-weight: 400;
--course-item-side-nav-chapter-name-font-line-height: 1.4em;
--blog-alternating-side-by-side-list-title-font-line-height: 1.4em;
--site-title-font-font-family: "Poppins";
--course-list-grid-layout-course-item-excerpt-font-font-family: "satoshi-ymnzpr";
--cookie-banner-disclaimer-font-text-transform: none;
--product-basic-item-title-half-layout-font-text-transform: none;
--newsletter-block-title-text-font-font-style: normal;
--body-font-text-transform: none;
--blog-item-meta-font-line-height: 1.2em;
--newsletter-block-title-text-font-font-weight: 500;
--form-block-input-text-font-font-family: "satoshi-ymnzpr";
--announcement-bar-font-line-height: 1.8em;
--video-item-pagination-font-text-transform: none;
--portfolio-grid-basic-title-font-font-style: normal;
--course-item-lesson-name-font-font-style: normal;
--course-list-grid-layout-course-item-excerpt-font-line-height: 1.8em;
--blog-single-column-list-title-font-font-style: normal;
--video-item-title-font-text-transform: none;
--product-basic-item-variant-fields-half-layout-font-font-style: normal;
--cookie-banner-disclaimer-font-font-family: "satoshi-ymnzpr";
--newsletter-block-footnote-text-font-font-weight: 400;
--content-link-block-title-font-font-style: normal;
--product-basic-item-restock-notification-half-layout-font-text-transform: none;
--newsletter-block-footnote-text-font-font-family: "satoshi-ymnzpr";
--blog-side-by-side-list-title-font-font-style: normal;
--blog-item-author-profile-font-font-weight: 300;
--course-list-grid-layout-chapter-meta-font-font-weight: 400;
--blog-side-by-side-list-title-font-font-weight: 700;
--portfolio-grid-overlay-title-font-line-height: 1.4em;
--form-block-survey-title-text-font-font-family: "satoshi-ymnzpr";
--course-item-side-nav-chapter-meta-font-font-weight: 400;
--product-basic-item-price-font-font-style: normal;
--blog-side-by-side-list-excerpt-font-font-weight: 300;
--blog-single-column-list-title-font-font-family: "Poppins";
--meta-font-font-style: normal;
--form-block-survey-title-text-font-line-height: 1.8em;
--video-item-description-font-text-transform: none;
--product-basic-item-price-full-layout-font-font-weight: 400;
--portfolio-item-pagination-font-text-transform: none;
--heading-font-line-height: 1.4em;
--product-basic-item-restock-notification-half-layout-font-font-weight: 400;
--product-basic-item-restock-notification-font-font-weight: 400;
--newsletter-block-field-text-font-font-weight: 400;
--menu-block-nav-font-line-height: 1.2em;
--portfolio-index-background-title-font-font-weight: 500;
--course-item-name-mobile-font-line-height: 1.4em;
--product-basic-item-title-font-text-transform: none;
--product-grid-text-below-price-font-text-transform: none;
--video-basic-grid-list-category-nav-font-font-style: normal;
--product-basic-item-add-ons-title-wrap-layout-font-line-height: 1.8em;
--blog-single-column-list-meta-font-font-weight: 400;
--form-block-option-text-font-font-family: "satoshi-ymnzpr";
--blog-single-column-list-excerpt-font-font-family: "satoshi-ymnzpr";
--product-basic-item-price-wrap-layout-font-text-transform: none;
--product-block-title-font-font-weight: 400;
--product-grid-text-below-title-font-text-transform: none;
--form-block-input-text-font-text-transform: none;
--product-basic-item-add-ons-title-half-layout-font-font-style: normal;
--newsletter-block-title-text-font-line-height: 1.4em;
--product-basic-item-description-half-layout-font-text-transform: none;
--video-item-title-font-font-style: normal;
--blog-grid-masonry-list-meta-font-line-height: 1.2em;
--product-grid-text-below-status-font-font-family: "satoshi-ymnzpr";
--product-basic-item-description-full-layout-font-font-family: "satoshi-ymnzpr";
--video-item-meta-font-font-family: "satoshi-ymnzpr";
--product-basic-item-description-full-layout-font-font-weight: 400;
--portfolio-grid-basic-title-font-font-weight: 500;
--form-block-select-dropdown-text-font-text-transform: none;
--product-basic-item-price-font-font-weight: 500;
--portfolio-index-background-title-font-font-family: "Poppins";
--portfolio-grid-basic-title-font-font-family: "Poppins";
--blog-item-pagination-font-font-weight: 500;
--heading-font-font-family: "Poppins";
--events-item-pagination-font-font-style: normal;
--blog-item-author-profile-font-font-style: normal;
--product-basic-item-description-half-layout-font-font-style: normal;
--video-item-meta-font-text-transform: none;
--menu-block-item-description-font-font-weight: 400;
--form-block-description-text-font-line-height: 1.8em;
--course-list-course-item-lesson-name-font-text-transform: none;
--product-basic-item-variant-fields-wrap-layout-font-text-transform: none;
--events-item-pagination-font-font-family: "Poppins";
--product-basic-item-scarcity-font-font-weight: 400;
--course-list-grid-layout-course-item-excerpt-font-font-style: normal;
--portfolio-hover-static-title-font-line-height: 1.4em;
--product-basic-item-scarcity-wrap-layout-font-font-style: normal;
--video-basic-grid-list-category-nav-font-line-height: 1.8em;
--product-basic-item-restock-notification-half-layout-font-font-family: "satoshi-ymnzpr";
--form-block-select-dropdown-text-font-line-height: 1.8em;
--quote-block-text-font-line-height: 1.8em;
--blog-single-column-list-meta-font-font-family: "satoshi-ymnzpr";
--announcement-bar-font-font-weight: 400;
--newsletter-block-title-text-font-text-transform: none;
--newsletter-block-button-text-font-font-style: normal;
--newsletter-block-footnote-text-font-line-height: 1.8em;
--menu-block-item-price-font-line-height: 1.8em;
--product-basic-item-price-full-layout-font-font-style: normal;
--video-basic-grid-list-title-font-font-family: "Poppins";
--product-basic-item-price-wrap-layout-font-font-weight: 400;
--mobile-site-title-font-font-weight: 500;
--product-basic-item-add-ons-title-font-font-weight: 400;
--course-item-lesson-name-font-line-height: 1.4em;
--events-item-pagination-date-font-text-transform: none;
--product-basic-item-description-font-font-style: normal;
--blog-item-title-font-font-weight: 700;
--blog-alternating-side-by-side-list-meta-font-font-style: normal;
--newsletter-block-button-text-font-text-transform: none;
--blog-single-column-list-excerpt-font-font-weight: 400;
--video-basic-grid-list-excerpt-font-line-height: 1.8em;
--blog-single-column-list-meta-font-text-transform: none;
--product-basic-item-description-half-layout-font-font-family: "satoshi-ymnzpr";
--quote-block-source-font-font-family: "satoshi-ymnzpr";
--blog-item-title-font-text-transform: capitalize;
--blog-side-by-side-list-meta-font-text-transform: none;
--blog-alternating-side-by-side-list-excerpt-font-text-transform: none;
--product-grid-text-below-scarcity-font-line-height: 1.2em;
--blog-grid-masonry-list-meta-font-font-weight: 400;
--product-basic-item-scarcity-full-layout-font-font-weight: 400;
--product-basic-item-variant-fields-full-layout-font-font-family: "satoshi-ymnzpr";
--blog-grid-masonry-list-excerpt-font-font-family: "satoshi-ymnzpr";
--menu-block-item-title-font-font-family: "Poppins";
--product-basic-item-add-ons-title-full-layout-font-text-transform: none;
--blog-item-meta-font-text-transform: capitalize;
--product-basic-item-restock-notification-wrap-layout-font-line-height: 1.8em;
--video-item-meta-font-line-height: 1.2em;
--menu-block-item-price-font-font-family: "satoshi-ymnzpr";
--site-title-font-text-transform: none;
--video-basic-grid-list-title-font-font-style: normal;
--course-list-chapter-item-chapter-name-font-text-transform: none;
--product-basic-item-title-full-layout-font-font-family: "Poppins";
--video-basic-grid-list-category-nav-font-text-transform: none;
--course-list-grid-layout-course-item-meta-font-font-style: normal;
--course-item-side-nav-chapter-name-font-text-transform: none;
--portfolio-hover-static-title-font-text-transform: none;
--portfolio-grid-overlay-title-font-font-family: "Poppins";
--product-basic-item-restock-notification-font-font-family: "satoshi-ymnzpr";
--course-list-chapter-item-chapter-name-font-line-height: 1.4em;
--blog-side-by-side-list-meta-font-font-weight: 400;
--course-list-chapter-item-chapter-name-font-font-weight: 500;
--form-block-description-text-font-font-weight: 400;
--course-list-course-item-lesson-name-font-line-height: 1.8em;
--course-list-course-item-lesson-meta-font-line-height: 1.2em;
--product-basic-item-price-full-layout-font-line-height: 1.8em;
--video-item-description-font-font-weight: 400;
--video-basic-grid-list-meta-font-font-weight: 400;
--product-basic-item-scarcity-full-layout-font-text-transform: none;
--course-list-course-item-lesson-meta-font-font-family: "satoshi-ymnzpr";
--blog-single-column-list-excerpt-font-line-height: 1.8em;
--blog-item-pagination-font-text-transform: none;
--product-basic-item-description-wrap-layout-font-line-height: 1.8em;
--course-item-side-nav-chapter-meta-font-line-height: 1.2em;
--course-item-chapter-name-font-line-height: 1.8em;
--events-item-pagination-date-font-line-height: 1.2em;
--course-list-course-name-font-text-transform: none;
--blog-single-column-list-meta-font-line-height: 1.2em;
--header-button-font-font-family: "Poppins";
--product-grid-text-below-title-font-font-style: normal;
--product-basic-item-variant-fields-half-layout-font-text-transform: none;
--announcement-bar-font-font-style: normal;
--product-basic-item-title-font-font-family: "Poppins";
--product-block-title-font-text-transform: none;
--blog-alternating-side-by-side-list-excerpt-font-font-style: normal;
--video-item-title-font-font-weight: 500;
--newsletter-block-field-text-font-line-height: 1.8em;
--portfolio-item-pagination-font-font-weight: 500;
--product-grid-text-below-title-font-font-weight: 500;
--product-basic-item-description-half-layout-font-line-height: 1.8em;
--course-item-name-font-font-weight: 500;
--events-item-pagination-date-font-font-style: normal;
--product-basic-item-price-font-line-height: 1.4em;
--tertiary-button-font-text-transform: none;
--product-basic-item-variant-fields-font-font-family: "satoshi-ymnzpr";
--product-grid-text-below-title-font-line-height: 1.4em;
--events-item-pagination-font-line-height: 1.4em;
--blog-basic-grid-list-meta-font-font-family: "satoshi-ymnzpr";
--form-block-option-text-font-font-style: normal;
--list-section-title-text-font-font-style: normal;
--menu-block-item-description-font-line-height: 1.8em;
--course-list-course-item-lesson-excerpt-font-font-style: normal;
--product-basic-item-variant-fields-wrap-layout-font-font-weight: 400;
--form-block-input-text-font-line-height: 1.8em;
--newsletter-block-title-text-font-font-family: "Poppins";
--newsletter-block-description-text-font-font-weight: 400;
--product-basic-item-restock-notification-full-layout-font-font-family: "satoshi-ymnzpr";
--product-basic-item-title-wrap-layout-font-font-family: "Poppins";
--quote-block-source-font-line-height: 1.2em;
--product-grid-text-below-price-font-font-weight: 400;
--list-section-title-text-font-font-family: "Poppins";
--product-basic-item-description-font-font-family: "satoshi-ymnzpr";
--product-basic-item-description-font-font-weight: 400;
--blog-side-by-side-list-meta-font-line-height: 1.2em;
--product-basic-item-price-half-layout-font-line-height: 1.8em;
--product-block-price-font-line-height: 1.8em;
--product-basic-item-scarcity-full-layout-font-font-family: "satoshi-ymnzpr";
--product-basic-item-scarcity-wrap-layout-font-line-height: 1.2em;
--blog-basic-grid-list-title-font-font-style: normal;
--course-item-name-font-font-style: normal;
--video-basic-grid-list-excerpt-font-text-transform: none;
--blog-side-by-side-list-excerpt-font-text-transform: none;
--course-list-chapter-item-chapter-meta-font-font-family: "satoshi-ymnzpr";
--video-basic-grid-list-category-nav-font-font-weight: 400;
--product-basic-item-price-half-layout-font-text-transform: none;
--form-block-placeholder-text-font-font-style: normal;
--course-list-course-item-lesson-name-font-font-style: normal;
--list-section-title-text-font-line-height: 1.4em;
--product-block-description-font-text-transform: none;
--menu-block-item-price-font-text-transform: none;
--product-basic-item-price-font-text-transform: none;
--form-block-caption-text-font-line-height: 1.8em;
--product-basic-item-variant-fields-full-layout-font-font-style: normal;
--product-basic-item-add-ons-title-wrap-layout-font-text-transform: none;
--product-grid-text-below-scarcity-font-text-transform: none;
--menu-block-title-font-text-transform: none;
--product-basic-item-price-wrap-layout-font-line-height: 1.8em;
--product-basic-item-description-wrap-layout-font-font-weight: 400;
--portfolio-grid-basic-title-font-text-transform: none;
--course-item-side-nav-chapter-meta-font-font-family: "satoshi-ymnzpr";
--meta-font-font-family: "satoshi-ymnzpr";
--mobile-site-title-font-line-height: 1.4em;
--portfolio-item-pagination-font-line-height: 1.4em;
--product-basic-item-add-ons-title-full-layout-font-line-height: 1.8em;
--newsletter-block-description-text-font-text-transform: none;
--product-basic-item-scarcity-half-layout-font-text-transform: none;
--blog-alternating-side-by-side-list-title-font-font-style: normal;
--form-block-caption-text-font-text-transform: none;
--video-preview-badge-font-font-family: "satoshi-ymnzpr";
--course-item-side-nav-lesson-meta-font-font-family: "satoshi-ymnzpr";
--product-basic-item-scarcity-wrap-layout-font-font-family: "satoshi-ymnzpr";
--course-list-course-description-font-font-weight: 400;
--product-basic-item-description-full-layout-font-text-transform: none;
--form-block-placeholder-text-font-font-weight: 400;
--quote-block-source-font-font-weight: 400;
--product-block-title-font-line-height: 1.8em;
--course-list-grid-layout-chapter-name-font-font-weight: 500;
--video-item-title-font-font-family: "Poppins";
--blog-basic-grid-list-title-font-font-family: "Poppins";
--course-item-side-nav-lesson-name-font-text-transform: none;
--course-list-grid-layout-course-item-excerpt-font-font-weight: 400;
--course-list-chapter-item-chapter-name-font-font-style: normal;
--product-basic-item-title-wrap-layout-font-font-style: normal;
--product-block-description-font-font-weight: 400;
--blog-side-by-side-list-title-font-text-transform: none;
--newsletter-block-footnote-text-font-text-transform: none;
--product-basic-item-add-ons-title-full-layout-font-font-weight: 400;
--product-basic-item-variant-fields-font-text-transform: none;
--newsletter-block-field-text-font-font-family: "satoshi-ymnzpr";
--course-item-name-mobile-font-font-family: "Poppins";
--course-list-chapter-item-chapter-meta-font-line-height: 1.2em;
--video-item-meta-font-font-style: normal;
--menu-block-item-title-font-font-style: normal;
--form-block-title-text-font-font-style: normal;
--product-basic-item-scarcity-wrap-layout-font-font-weight: 400;
--course-list-course-name-font-font-style: normal;
--menu-block-nav-font-font-family: "satoshi-ymnzpr";
--blog-basic-grid-list-excerpt-font-font-family: "satoshi-ymnzpr";
--product-basic-item-scarcity-full-layout-font-font-style: normal;
--product-basic-item-price-wrap-layout-font-font-family: "satoshi-ymnzpr";
--course-list-grid-layout-course-item-name-font-text-transform: none;
--course-list-course-item-lesson-name-font-font-weight: 400;
--header-button-font-line-height: 1.2em;
--newsletter-block-description-text-font-line-height: 1.8em;
--course-item-side-nav-lesson-meta-font-text-transform: none;
--newsletter-block-footnote-text-font-font-style: normal;
--product-basic-item-add-ons-title-font-font-style: normal;
--course-list-chapter-item-chapter-meta-font-text-transform: none;
--video-basic-grid-list-title-font-text-transform: none;
--blog-basic-grid-list-excerpt-font-line-height: 1.8em;
--course-item-name-mobile-font-text-transform: none;
--product-block-price-font-text-transform: none;
--portfolio-hover-follow-title-font-font-style: normal;
--course-item-name-mobile-font-font-style: normal;
--menu-block-title-font-font-family: "Poppins";
--course-item-lesson-name-font-font-weight: 500;
--blog-side-by-side-list-excerpt-font-font-style: normal;
--course-item-side-nav-lesson-meta-font-font-style: normal;
--course-item-chapter-name-font-text-transform: none;
--mobile-site-title-font-font-style: normal;
--site-navigation-font-line-height: 1.8em;
--product-basic-item-variant-fields-full-layout-font-font-weight: 400;
--product-basic-item-add-ons-title-font-font-family: "satoshi-ymnzpr";
--body-font-font-weight: 400;
--product-basic-item-title-font-line-height: 1.4em;
--blog-alternating-side-by-side-list-excerpt-font-font-weight: 400;
--form-block-option-text-font-text-transform: none;
--course-list-grid-layout-course-item-meta-font-text-transform: none;
--product-basic-item-description-half-layout-font-font-weight: 400;
--quote-block-source-font-text-transform: none;
--portfolio-index-background-title-font-line-height: 1.4em;
--body-font-font-style: normal;
--product-basic-item-title-font-font-weight: 500;
--blog-item-author-profile-font-text-transform: none;
--course-list-course-item-lesson-name-font-font-family: "satoshi-ymnzpr";
--product-basic-item-variant-fields-half-layout-font-font-family: "satoshi-ymnzpr";
--form-block-input-text-font-font-style: normal;
--product-grid-text-below-scarcity-font-font-weight: 400;
--blog-item-meta-font-font-weight: 400;
--product-grid-text-below-scarcity-font-font-family: "satoshi-ymnzpr";
--course-item-chapter-name-font-font-style: normal;
--blog-basic-grid-list-title-font-text-transform: none;
--portfolio-grid-overlay-title-font-font-style: normal;
--product-basic-item-variant-fields-full-layout-font-text-transform: none;
--header-button-font-font-style: normal;
--blog-alternating-side-by-side-list-meta-font-text-transform: none;
--product-block-price-font-font-weight: 400;
--blog-grid-masonry-list-excerpt-font-font-weight: 400;
--tertiary-button-font-font-weight: 500;
--product-basic-item-add-ons-title-half-layout-font-line-height: 1.8em;
```

### Other

```css
--form-field-dropdown-icon-thickness: 1px;
--image-block-stack-image-button-separation: 4%;
--previous-section-divider-offset: 0px;
--tertiary-button-stroke: 2px;
--image-block-overlap-image-content-offset: 80%;
--image-block-stack-image-title-separation: 4%;
--tweak-global-animations-animation-delay: 1s;
--white-hsl: 0,0%,98.04%;
--image-block-overlap-image-button-separation: 11%;
--tweak-global-animations-animation-duration: .5s;
--image-block-collage-image-width: 60%;
--image-block-collage-image-content-width: 40%;
--image-block-poster-image-content-width: 70%;
--image-block-stack-image-content-separation: 7%;
--image-block-overlap-image-width: 53%;
--course-list-course-item-hover-background: hsla(0,0%,100%,.75);
--course-list-course-item-background: hsla(0,0%,100%,1);
--black-hsl: 0,0%,7.06%;
--image-block-collage-image-button-separation: 5%;
--image-block-collage-image-content-offset: 5%;
--image-block-poster-image-title-separation: 11%;
--image-block-overlap-image-title-separation: 30%;
--image-block-poster-image-button-separation: 19%;
--image-block-collage-image-title-separation: 4%;
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
| sm | 430px | max-width |
| 575px | 575px | max-width |
| sm | 576px | min-width |
| sm | 640px | max-width |
| md | 767px | max-width |
| md | 768px | min-width |
| md | 769px | min-width |
| lg | 991px | max-width |
| lg | 992px | min-width |
| lg | 1024px | max-width |
| lg | 1025px | min-width |
| 1099px | 1099px | max-width |
| 1199px | 1199px | max-width |
| xl | 1280px | max-width |
| xl | 1281px | min-width |

## Transitions & Animations

**Easing functions:** `[object Object]`, `[object Object]`, `[object Object]`, `[object Object]`, `[object Object]`

**Durations:** `0.14s`, `0.6s`, `0.4s`, `0.5s`, `0.00826446s`, `0.0165289s`, `0.0247934s`, `0.0330579s`, `0.0413223s`, `0.0495868s`, `0.0578512s`, `0.0661157s`, `0.25s`, `0.0743802s`, `0.0826446s`, `0.0909091s`, `0.0991736s`, `0.107438s`, `0.115702s`, `0.123967s`, `0.132231s`, `0.140496s`, `0.1s`, `0.2s`, `0.3s`, `1.5s`, `1s`, `0.001s`, `0.35s`

### Common Transitions

```css
transition: all;
transition: background 0.14s ease-in-out 0.14s, transform 0.14s ease-in-out;
transition: padding 0.14s ease-in-out;
transition: color 0.6s cubic-bezier(0.19, 1, 0.22, 1);
transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.5s cubic-bezier(0.19, 1, 0.22, 1), clip-path 0.5s cubic-bezier(0.19, 1, 0.22, 1);
transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1) 0.00826446s, opacity 0.5s cubic-bezier(0.19, 1, 0.22, 1) 0.00826446s, clip-path 0.5s cubic-bezier(0.19, 1, 0.22, 1) 0.00826446s;
transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1) 0.0165289s, opacity 0.5s cubic-bezier(0.19, 1, 0.22, 1) 0.0165289s, clip-path 0.5s cubic-bezier(0.19, 1, 0.22, 1) 0.0165289s;
transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1) 0.0247934s, opacity 0.5s cubic-bezier(0.19, 1, 0.22, 1) 0.0247934s, clip-path 0.5s cubic-bezier(0.19, 1, 0.22, 1) 0.0247934s;
transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1) 0.0330579s, opacity 0.5s cubic-bezier(0.19, 1, 0.22, 1) 0.0330579s, clip-path 0.5s cubic-bezier(0.19, 1, 0.22, 1) 0.0330579s;
```

### Keyframe Animations

**loading-indicator-rotate-spinner**
```css
@keyframes loading-indicator-rotate-spinner {
  100% { transform: rotate(360deg); }
}
```

**loading-indicator-dash**
```css
@keyframes loading-indicator-dash {
  0% { stroke-dasharray: 1, 200;
    stroke-dashoffset: 0; }
  50% { stroke-dasharray: 89, 200;
    stroke-dashoffset: -35; }
  100% { stroke-dasharray: 89, 200;
    stroke-dashoffset: -124; }
}
```

## Component Patterns

Detected UI component patterns and their most common styles:

### Buttons (61 instances)

```css
.button {
  background-color: rgb(0, 0, 0);
  color: rgb(255, 255, 255);
  font-size: 13.464px;
  font-weight: 400;
  padding-top: 10.7712px;
  padding-right: 17.5032px;
  border-radius: 300px;
}
```

### Cards (3 instances)

```css
.card {
  background-color: rgba(38, 38, 38, 0.9);
  border-radius: 8px;
  box-shadow: rgba(0, 0, 0, 0.15) 0px 1px 2px 0px;
  padding-top: 0px;
  padding-right: 0px;
}
```

### Inputs (4 instances)

```css
.input {
  background-color: rgba(38, 38, 38, 0.9);
  color: rgb(255, 255, 255);
  border-color: rgb(255, 255, 255);
  border-radius: 8px;
  font-size: 15px;
  padding-top: 0px;
  padding-right: 10px;
}
```

### Links (47 instances)

```css
.link {
  color: rgb(255, 255, 255);
  font-size: 13.464px;
  font-weight: 700;
}
```

### Navigation (77 instances)

```css
.navigatio {
  background-color: rgba(0, 0, 0, 0.5);
  color: rgb(18, 18, 18);
  padding-top: 0px;
  padding-bottom: 0px;
  padding-left: 0px;
  padding-right: 0px;
  position: static;
}
```

### Footer (1 instances)

```css
.foote {
  color: rgb(18, 18, 18);
  padding-top: 0px;
  padding-bottom: 0px;
  font-size: 15px;
}
```

### Modals (5 instances)

```css
.modal {
  background-color: rgb(250, 250, 250);
  border-radius: 0px;
  padding-top: 0px;
  padding-right: 0px;
}
```

### Dropdowns (32 instances)

```css
.dropdown {
  background-color: rgba(38, 38, 38, 0.9);
  border-radius: 0px;
  box-shadow: rgba(0, 0, 0, 0.15) 0px 1px 2px 0px;
  border-color: rgb(18, 18, 18);
  padding-top: 0px;
}
```

### Tooltips (2 instances)

```css
.tooltip {
  background-color: rgb(255, 255, 255);
  color: rgb(0, 0, 0);
  font-size: 12px;
  border-radius: 18px;
  padding-top: 3px;
  padding-right: 6px;
  box-shadow: rgba(0, 0, 0, 0.2) 0px 0px 10px 0px;
}
```

### ProgressBars (6 instances)

```css
.progressBar {
  color: rgb(255, 255, 255);
  border-radius: 0px;
  font-size: 15px;
}
```

## Layout System

**8 grid containers** and **168 flex containers** detected.

### Container Widths

| Max Width | Padding |
|-----------|---------|
| 100% | 0px |
| 1400px | 0px |
| 1360px | 0px |

### Grid Column Patterns

| Columns | Usage Count |
|---------|-------------|
| 26-column | 5x |
| 3-column | 3x |

### Grid Templates

```css
grid-template-columns: 14.5938px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 14.5938px;
gap: 11px;
grid-template-columns: 14.5938px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 14.5938px;
gap: 11px;
grid-template-columns: 14.5938px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 40.6562px 14.5938px;
gap: 11px;
grid-template-columns: 382.938px 382.938px 382.938px;
gap: 20px;
grid-template-columns: 382.922px 382.922px 382.922px;
gap: 20px;
```

### Flex Patterns

| Direction/Wrap | Count |
|----------------|-------|
| column/nowrap | 68x |
| row/nowrap | 94x |
| row/wrap | 4x |
| column-reverse/nowrap | 2x |

**Gap values:** `11px`, `20px`

## Accessibility (WCAG 2.1)

**Overall Score: 97%** — 71 passing, 2 failing color pairs

### Failing Color Pairs

| Foreground | Background | Ratio | Level | Used On |
|------------|------------|-------|-------|---------|
| `#4a5464` | `#262626` | 1.98:1 | FAIL | div (2x) |

### Passing Color Pairs

| Foreground | Background | Ratio | Level |
|------------|------------|-------|-------|
| `#ffffff` | `#000000` | 21:1 | AAA |
| `#121212` | `#fafafa` | 17.95:1 | AAA |
| `#121212` | `#ffffff` | 18.73:1 | AAA |
| `#dcdcd8` | `#000000` | 15.27:1 | AAA |
| `#ffffff` | `#262626` | 15.13:1 | AAA |
| `#000000` | `#ffffff` | 21:1 | AAA |
| `#121212` | `#dcdcd8` | 13.62:1 | AAA |

## Design System Score

**Overall: 72/100 (Grade: C)**

| Category | Score |
|----------|-------|
| Color Discipline | 100/100 |
| Typography Consistency | 40/100 |
| Spacing System | 40/100 |
| Shadow Consistency | 100/100 |
| Border Radius Consistency | 65/100 |
| Accessibility | 97/100 |
| CSS Tokenization | 100/100 |

**Strengths:** Tight, disciplined color palette, Clean elevation system, Strong accessibility compliance, Good CSS variable tokenization

**Issues:**
- 4 font families — consider limiting to 2 (heading + body)
- 16 distinct font sizes — consider a tighter type scale
- No consistent spacing base unit detected — values appear arbitrary
- 2 WCAG contrast failures

## Gradients

**3 unique gradients** detected.

| Type | Direction | Stops | Classification |
|------|-----------|-------|----------------|
| linear | — | 2 | brand |
| linear | — | 2 | brand |
| linear | — | 2 | brand |

```css
background: linear-gradient(rgb(1, 13, 21), rgba(0, 0, 0, 0));
background: linear-gradient(rgb(255, 255, 255), rgb(255, 255, 255));
background: linear-gradient(rgb(0, 0, 0), rgb(0, 0, 0));
```

## Z-Index Map

**16 unique z-index values** across 4 layers.

| Layer | Range | Elements |
|-------|-------|----------|
| modal | 2147483647,2147483647 | iframe |
| dropdown | 100,999 | div.f.l.o.a.t.i.n.g.-.c.a.r.t. .h.i.d.d.e.n, div.s.e.c.t.i.o.n.-.d.i.v.i.d.e.r.-.d.i.s.p.l.a.y, button.b.a.c.k.g.r.o.u.n.d.-.p.a.u.s.e.-.b.u.t.t.o.n |
| sticky | 10,12 | header.h.e.a.d.e.r. .t.h.e.m.e.-.c.o.l.-.-.p.r.i.m.a.r.y, div.f.e.-.b.l.o.c.k. .f.e.-.b.l.o.c.k.-.7.c.8.b.6.3.d.2.6.b.2.8.7.0.0.2.9.7.2.a, div.f.e.-.b.l.o.c.k. .f.e.-.b.l.o.c.k.-.y.u.i._.3._.1.7._.2._.1._.1.7.0.4.8.3.5.6.9.6.7.9.8._.1.3.1.1.6 |
| base | -1,9 | div.p.l.y.r._._.v.i.d.e.o.-.w.r.a.p.p.e.r, div.p.l.y.r._._.v.i.d.e.o.-.w.r.a.p.p.e.r, div.p.l.y.r._._.v.i.d.e.o.-.w.r.a.p.p.e.r |

**Issues:**
- [object Object]

## SVG Icons

**9 unique SVG icons** detected. Dominant style: **filled**.

| Size Class | Count |
|------------|-------|
| md | 3 |
| lg | 2 |
| xl | 4 |

**Icon colors:** `rgb(255, 255, 255)`, `rgb(0, 0, 0)`, `rgb(231, 231, 231)`

## Font Files

| Family | Source | Weights | Styles |
|--------|--------|---------|--------|
| satoshi-ymnzpr | self-hosted | 300, 400, 500, 700 | italic, normal |
| Poppins | google-fonts | 500, 700 | italic, normal |

**Google Fonts URL:** `https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,500;0,700;1,500;1,700`

## Image Style Patterns

| Pattern | Count | Key Styles |
|---------|-------|------------|
| general | 20 | objectFit: fill, borderRadius: 30px, shape: pill |
| hero | 2 | objectFit: cover, borderRadius: 30px, shape: pill |

**Aspect ratios:** 1:1 (18x), 16:9 (2x), 3.64:1 (1x), 3.85:1 (1x)

## Quick Start

To recreate this design in a new project:

1. **Install fonts:** Add `satoshi-ymnzpr` from Google Fonts or your font provider
2. **Import CSS variables:** Copy `variables.css` into your project
3. **Tailwind users:** Use the generated `tailwind.config.js` to extend your theme
4. **Design tokens:** Import `design-tokens.json` for tooling integration
