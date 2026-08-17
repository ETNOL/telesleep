# WCAG Audit — Status

**Standard:** WCAG 2.1 AA (plus 2.2's 2.5.8 target size)
**Pages:** all 17, desktop 1440×900 + mobile 390×844
**Last run:** 2026-08-13

| Check | Result |
|---|---|
| `npm run axe` — axe-core 4.10.2, 34 page/viewport runs | **0 violations** (was 9 rules / 378 elements) |
| `npm run contrast` — rendered-pixel contrast over images | **0 below threshold** (was 18) |

Run both: `cd tools && npm install && npm run check` (needs the site served —
`python3 -m http.server 8766`).

---

## Fixed

### Critical
- [x] **Zoom re-enabled** — `meta-viewport` · 1.4.4 · 17 pages
  Dropped `maximum-scale=1.0, user-scalable=0`.
- [x] **Search field labelled** — `label` · 4.1.2 · 3 pages
  Its `<label>` was `display:none`; added `aria-label`.

### Serious
- [x] **Palette rebuilt for contrast** — `color-contrast` · 1.4.3 · 169 elements, 12 failing pairs
  Every brand color failed, buttons worst at 2.47:1. New values in `tools/contrast.py`,
  which fails if any pairing drops below AA:

  | Role | Was | Now | Ratio |
  |---|---|---|---|
  | Primary (buttons, links, fills) | `#17b1e7` | `#0E6E8C` | 5.79:1 |
  | Hover / gradient partner | — | `#0A5670` | 8.15:1 |
  | Accent text | `#ff9e21` | `#8A4A00` | 6.86:1 |
  | Secondary text | `#666` | `#4F5B66` | 6.95:1 |
  | Links on navy | — | `#8FD3EA` | 8.99:1 |
  | Headings / body | `#124884` | `#0B2942` | 14.89:1 |

  The old colors also lived as `rgba(23,177,231,…)` and `#666` shorthand inside the theme's
  own CSS — a hex-only pass over the HTML missed both.

- [x] **Text over photographs** — 1.4.3 · 18 elements, 15 pages · **axe could not see these**
  axe only reads a computed `background-color`, so text on a photo returns "incomplete".
  `tools/measure_contrast.js` hides the glyphs, screenshots the pixels actually behind them
  and computes the worst-case ratio. It found the worst contrast on the site:
  - Home hero heading — **1.53:1**
  - "Contact Us" hero — **1.30:1**
  - "Physician Referrals" (13 pages) — **1.91:1**
  - "Are you having a problem with your sleep?" — **2.42:1**

  Fixed with scrims: a white veil under the navy hero type, a navy one under the white type.
  Photography and type colors are untouched.

- [x] **Logo links named** — `link-name` · 2.4.4 / 4.1.2 · 17 pages. Also fixed an `href=""`.
- [x] **YouTube embeds titled** — `frame-title` · 4.1.2 · 7 iframes, named from their headings.
- [x] **Search controls hit 44px** — `target-size` · 2.5.8.
- [x] **Mobile header no longer covers content** — 2.5.8
  Below 980px the toolbox header goes `position:absolute` to float over a hero. Default-template
  pages have no hero, so it landed on top of the content — on `/sleep-disorders/` it covered the
  search box outright. It is back in the flow on those pages.
- [x] **Links distinguishable without color** — `link-in-text-block` · 1.4.1. Underlined in body copy.

### Moderate
- [x] **`<main>` landmark** — `role="main"` on `#main-content`.
- [x] **All content inside landmarks** — `region` · 123 elements
  The Divi Toolbox bar sits outside every landmark; it is now a named region. `<footer>` got
  `role="contentinfo"`.
- [x] **Heading order** — 22 instances
  `h4` was used for visual size. Retagging would break Divi's per-module CSS, so the elements
  keep their tags and carry `aria-level` instead — same look, correct outline.
- [x] **Missing `<h1>`** — 3 pages.

### Manual
- [x] **Skip link** — 2.4.1 · first focusable element on every page.
- [x] **Image alt text** — 1.1.1 · team photos and the ACHC accreditation badge.
- [x] **Visible focus** — 2.4.7 · `:focus-visible` ring, inverted on dark surfaces.
- [x] **Reduced motion** — 2.3.3 · Divi's scroll reveals respect `prefers-reduced-motion`.

Not a real issue: the 16 "Read More" hits were a JS config string, never rendered.

---

## Still open

- [ ] **Contact form** — `/contacts/` renders nothing; Ninja Forms builds its markup from
  `admin-ajax.php`, which the static mirror has no backend for. Whatever replaces it needs its
  own pass: labels, error messages, `aria-describedby`, focus handling on submit.
- [ ] **Keyboard-only walkthrough** — focus order, the mobile menu, and whether the
  "READ FULL BIO" popups return focus to their trigger on close. Automation can't judge this.
- [ ] **Screen reader pass** (VoiceOver) over the nav and the bio popups.
- [ ] **Reflow at 320px / 400% zoom** — 1.4.10. Now testable; the viewport lock had blocked it.
- [ ] **Hero intro text is clipped** at the top of every page ("Already a Tranquility Sleep
  Specialists Telemedicine patient? Click…"). Pre-existing on the live site, not a contrast
  failure, but it reads as broken.
- [ ] `/sleep-disorders/` has an empty content area — it renders as a bare sidebar. Pre-existing.

## Keeping it passing

`tools/a11y_patch.py` is idempotent — re-run it after any re-scrape, then `npm run check`.
The scrim selectors use Divi's section numbers, which would shift if the site is rebuilt;
`measure_contrast.js` is what catches that.
