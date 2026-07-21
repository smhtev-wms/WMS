# AICSS Theme & Style Report

Source: c:\xampp\htdocs\aicss-dev (static site)

Purpose: document visual tokens, components, utility patterns, and implementation notes so the same theme can be reused in the new Work Management System (WMS).

---

## 1. Overview

The theme in `aicss-dev` is a polished, modern, branded site using a dark/royal palette with gold/amber accents. It relies on a single CSS file embedded in pages (no preprocessor). Key characteristics:
- CSS custom properties (tokens) defined in :root for colors, radii, shadows, easing, and max width
- Serif heading face (Playfair Display) and sans UI face (DM Sans)
- Heavy use of gradients, glassy panels, subtle textures (grain), and radial/background gradients
- Well-defined components: header, hero, cards, CTA buttons, stats banners, forms, footer, floating donate button
- Responsive behavior via a small set of breakpoints (960px, 860px, 800px, 760px, 700px, 540px, 520px, 480px)

---

## 2. Tokens (CSS variables)

Defined in `:root` (single source of truth):
- Colors:
  - `--navy` #0f1c2e (deep background)
  - `--navy2` #1a3a5c
  - `--cobalt` #1e5fa8 (primary blue)
  - `--gold` #c9931a
  - `--amber` #e8aa2a (accent)
  - `--cream` #fdf8f0
  - `--canvas` #f5f7fb (page background)
  - `--white`, `--muted` #6b7d94, `--mist` #e8f1fb
  - `--border` rgba(30,95,168,.10) (subtle border)
  - `--ink` #0f1c2e
- Spacing/shape:
  - `--r` 12px (card radius)
  - `--r2` 20px
  - `--maxw` 1260px
- Shadows:
  - `--s1`, `--s2`, `--s3` (three elevation levels)
- Motion: `--ease` cubic-bezier(.25,.9,.25,1)

Recommendation: extract these into a single `theme.css` (or tokens file) and import into WMS. Keep variable names identical for fastest reuse.

---

## 3. Typography

- Headings: `Playfair Display` (serif) used for brand and section headings—gives an elegant, formal tone.
- Body / UI: `DM Sans` for readable interfaces.
- Sizes:
  - Hero H1 ~2.4rem (scales down at small screens)
  - Section headings `.sh` 1.75rem
  - Stat numbers use Playfair for emphasis

Recommendation: keep the same font pairing in the WMS for brand consistency. Use system font fallbacks as present.

---

## 4. Layout & Grid

- Main container `--maxw` 1260px with centered `.main-wrap`.
- Header is fixed at 68px, content has `padding-top:68px` to avoid overlap.
- Grids: `two-col`, `three-col`, responsive adjustments at 760–860px.
- Hero sections utilize full-width radial gradients and "grain" overlay for texture.

Mapping to WMS: reproduce the same shell—fixed header, left-aligned content, centered main container. Maintain consistent header height to reuse spacing rules.

---

## 5. Components (CSS classes & behavior)

1. Header (`.site-header`, `.hdr-inner`, `.main-nav`)
   - Backdrop blur on fixed header, scrolled box-shadow toggle, mobile drawer for nav.
2. Hero (`.page-hero`, `.page-hero-badge`, `.hero-pill`, `.hero-wave`)
   - Strong typographic lead, pill CTAs, decorative SVG wave.
3. Buttons (`.btn`, `.btn-navy`, `.btn-gold`, `.btn-ghost`, `.btn-outline`)
   - Pill-shaped with subtle hover lift and overlay pseudo-element.
4. Cards (`.card`, `.mission-card`, `.ww-card`) with three shadow levels and hover elevation.
5. Stats Banner (`.stats-row`, `.stat-item`) using gradient background and large numerics.
6. Forms (`.flabel`, `.finput`, `.frow`) with focus border color `--cobalt` and white input background on focus.
7. Tabs (`.tab-bar`, `.tab-btn`)
8. Toast (`.toast`) positioned bottom-center with show/hide class.
9. Floating CTA (`.fdonate`) fixed bottom-right animated with keyframes.

Each component follows consistent rules: accent color usage (`--amber`/`--gold`) for CTAs, rounded radii, and subtle shadows.

---

## 6. Visual Treatments

- Gradients: used for buttons, stat banners, mission cards, and badges. Linear and radial gradients are common.
- Texture overlays: repeating-linear-gradient to create low-opacity grain on hero and brand panels.
- 3 elevation shadow tokens to distinguish layering.
- Micro-interactions: small translateY lift on hover, rotate/scale on logo.

---

## 7. Accessibility & UX

- Focus-visible outline uses high-contrast `--amber` color.
- Buttons use large hit areas and visible focus states.
- Mobile-first considerations via breakpoints in CSS.
- Color contrast: dark navy backgrounds with amber/gold accents provide readable contrast for highlights.

Consider adding explicit aria attributes and skip links when porting to WMS.

---

## 8. Assets

- Fonts loaded from Google Fonts: `Playfair Display`, `DM Sans`.
- Font Awesome used for small icons.
- Images located in `images/` directory—logo and hero assets.

Recommendation: bundle fonts via CDN or host locally in WMS depending on offline requirements.

---

## 9. Implementation Notes for Reuse in WMS

1. Extract tokens to `src/styles/theme.css` or a global CSS module and import at app root.
2. Build component class library (or CSS modules) mirroring these class names to reuse markup.
3. For React + Tailwind approach: map tokens to Tailwind theme extensions and create utility classes for shadows, radii, and colors.
4. Recreate hero/callout components as React components that accept props for title, subheading, and CTAs.
5. Implement a consistent Header/Drawer component that reuses `.site-header` rules and mobile drawer behavior.
6. Provide a `Button` React component with props `variant="navy|gold|ghost|outline"` to track styles.
7. Keep `--maxw` and header height constant to minimize layout differences.
8. Add a small JS helper to toggle `.site-header.scrolled` using scroll listener (site currently expects this behavior).

---

## 10. Mapping suggestions (Church CMS → WMS)

- `--navy`, `--amber`, `--gold` → primary brand palette for WMS.
- `Playfair Display` headings → use for report/print views and key titles.
- `DM Sans` → UI and forms.
- `.card`, `.stats-row`, `.btn-gold` → reuse for job cards, KPI banners, and primary CTAs.
- Floating donate (`.fdonate`) → floating "Create Job" or "New Work Order" CTA.

---

## 11. Quick checklist to apply theme in new project

- [ ] Create `theme.css` with the `:root` tokens from `aicss-dev`.
- [ ] Add font imports in index.html / head or via CSS.
- [ ] Add `Header`, `Hero`, `Card`, `Button`, and `Toast` components copying class names and markup.
- [ ] Copy relevant images and favicon into WMS `public/` folder.
- [ ] Add small global JS to toggle header scrolled state and mobile drawer.

---

## 12. Files inspected
- index.html
- login.html
- about.html
- other pages in `c:\xampp\htdocs\aicss-dev` (CSS embedded similarly)

---

If you want, I can now:
- extract the exact `:root` token block into a standalone `theme.css` and add it to your React app, or
- convert tokens into a Tailwind config snippet, or
- scaffold React components (`Header`, `Button`, `Card`) implementing this theme.

Which of these should I do next?
