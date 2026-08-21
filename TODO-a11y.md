# WCAG Audit — Status

**Standard:** WCAG 2.1 AA (plus 2.2's 2.5.8 target size)
**Pages:** all 14, desktop 1440×900 + mobile 390×844
**Last run:** 2026-08-18

| Check | Result |
|---|---|
| `npm run axe` — axe-core 4.10.2, 28 page/viewport runs | **0 violations** (was 9 rules / 378 elements) |
| `npm run contrast` — rendered-pixel contrast, 2 viewports | **0 below threshold** (was 18, then 4) |
| `npm run probe` — 320px reflow, 1.4.12 spacing, target size, duplicate ids | **0 findings** (was 8 clipped / 1 overflowing / 8 undersized / 15 duplicated ids) |

Run all three: `cd tools && npm install && npm run check` (needs the site served —
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
- [x] **Missing `<h1>`** — 2 pages (a third was `/licenses-and-certifications/`, since removed).

### Second pass — what axe never looks at
axe reports 0 violations sitewide, so everything below was found by measuring the
rendered page instead (`tools/probe_manual.js`, now part of `npm run check`).

- [x] **Text clipped when it grows** — 1.4.12 · 4 cards
  The home page's condition cards are pinned to `height:295px` with
  `overflow:hidden`, so applying the 1.4.12 text-spacing overrides lopped 69px off
  four of them. Now `height:auto` with a `min-height`, which looks identical and
  cannot clip. Scoped to `body.home`: Divi numbers its module classes per page, and
  `.et_pb_blurb_0` on the other 13 pages is a small address block that a 295px floor
  inflates by 157px.
- [x] **Image module wider than its column** — 1.4.10 · `/inspire-…/`
  `.et_pb_image_1` carries a hardcoded `width:400px`, so at 320px it ran 144px past
  its 256px column and cut the copy beside it. `a11y_patch.py` now adds
  `max-width:100%` to any image module that hardcodes a pixel width, in that page's
  own CSS. A blanket `.et_pb_image{max-width:100%}` in a11y.css is the wrong tool —
  it also overrides the per-module `max-width:125px` that sizes the ACHC badge, and
  blows the header up.
  Not an issue: the contact column used to read as 59px short of its content, but the
  overflow was the honeypot field, which is `position:absolute` on purpose and which
  `probe_manual.js` ignores along with anything else out of flow. The static form now
  keeps its honeypot in `.nf-sr-only` and names it with `aria-label` rather than a
  `<label>` — clipped text is a 1.4.4 failure to the probe, and an input with no text
  node in it has nothing to clip.
- [x] **Reflow at 320px / 400% zoom** — 1.4.10 · all 14 pages
  Now measured: no horizontal scroll, no element wider than the viewport.
- [x] **Undersized targets** — 2.5.8 · 8 elements
  "READ FULL BIO" rendered 92×20 and the footer logo link 352×22; Wistia's keyboard
  proxy for a video poster is a 1×1 transparent button. An inline link's hit box is
  its font's content area — 22px at 16px type — which is fine inside a sentence
  (2.5.8 exempts that) but not for the links that sit alone in their own block, so
  those get a pixel of vertical padding. Nothing moved on screen.
- [x] **Form field boundaries** — `1.4.11` · `/contacts/`
  Ninja Forms paints its inputs `#F7F7F7` on white (1.06:1) and outlines them in
  `#C4C4C4` (1.63:1), so the only visible edge of every control missed the 3:1
  floor. Border is now `--muted` (6.49:1). axe does not check non-text contrast.
- [x] **Bio popups named** — 4.1.2 · 5 popups
  Magnific Popup's close control is `<button>&times;</button>`, so its accessible
  name was the multiplication sign, and the dialog itself had no role. It now opens
  as `role="dialog" aria-modal="true"` named from the person's heading, with a
  "Close" button. Focus already returned to the trigger on close — verified.
- [x] **Contact form landmark named** — 1.3.1 · `/contacts/`
  Ninja Forms named its `role="form"` through an `aria-labelledby` pointing at an empty
  `<span>`, and `wp-content/a11y.js` fixed that at runtime. The form is no longer built
  in the browser at all: `tools/contact_form_patch.py` replaced it with static markup
  that carries its own `aria-label`, keeps every label associated by `for`, and pairs a
  `role="status"` notice with a `role="alert"` error slot. The a11y.js branch is now a
  no-op and is kept only in case the page is re-scraped without the form patch.
  The popups are still patched at runtime by `wp-content/a11y.js`.

### Third pass — the accessibilitychecker.org audit (`wcag-audit.pdf`)
An external scan of the live domain, home page only, reported 19 failing elements
across 2 rules. Both rules are real here too, both were invisible to all three tools
in `tools/`, and both are now fixed and covered by a check.

- [x] **Duplicate ids in the rendered DOM** — 4.1.1 · 15 ids, 19 surplus elements, every page
  Divi assembles two id-carrying copies in the browser, so nothing that reads the
  HTML file can see them: it clones `#top-menu` into `#mobile_menu` with all 14
  `menu-item-*` ids intact, and its builder wraps each `.et-l` layout — the
  before-header bar and the five bio popups — in a `<div id="et-boc">`, six of them.
  axe misses it too: its `duplicate-id` rules were dropped in 4.10, when WCAG 2.2
  retired 4.1.1 Parsing. The criterion is gone but the breakage is not — a repeated
  id still breaks `for`, `aria-labelledby` and every other id-based association.
  `wp-content/a11y.js` now renumbers them as they appear. The element that owns the
  id in the source keeps it, so anchors, CSS and `getElementById` still resolve
  where they did; each later copy takes a `-2` suffix. Re-measured: 0 duplicates on
  all 14 pages at both viewports, and 0 of 487 layout boxes moved.
- [x] **White links on a translucent panel** — 1.4.3 · 4 links, mobile only
  The home page's "Helpful Links" panel is `rgba(OCEAN, .85)`. The palette rebuild
  swapped the colour and kept the alpha, which is where it went wrong: the photo the
  panel *overlaps* — the image module beside it, not an ancestor background — reads
  through. No walk up the tree can name that colour, which is why axe returns
  "incomplete" rather than a ratio, and why `measure_contrast.js` skipped these
  elements: it stopped at the first non-transparent background. At 1440px the panel
  covers a dark part of the photo and the white type clears AA at 4.57–6.31:1. Once
  the columns stack at 390px it lands on a lighter part and the last four links
  measure 4.27–4.49:1 — exactly the four the audit named.
  `a11y_patch.py` now raises translucent brand fills to `MIN_FILL_ALPHA = 0.92`,
  against the new colour so it also reaches fills an earlier pass already swapped.
  Worst case is now 4.96:1 at 390px, 5.11:1 at 1440px; the photo still reads through.

  Two blind spots in the tooling let this sit, both closed:
  - `measure_contrast.js` treated any non-transparent background as opaque. A fill
    with alpha below 1 now keeps the walk going, so the text gets photographed
    instead of computed — 28 measured elements became 41.
  - it only ran at 1440px, while the failure only exists at 390px. It now runs both
    viewports like `axe_audit.js` and `probe_manual.js` do — 41 became 80.

### Third pass — the accessibilitychecker.org audit (`wcag-audit.pdf`)
An external scan of the live domain, home page only, reported 19 failing elements
across 2 rules. Both rules are real here too, both were invisible to all three tools
in `tools/`, and both are now fixed and covered by a check.

- [x] **Duplicate ids in the rendered DOM** — 4.1.1 · 15 ids, 19 surplus elements, every page
  Divi assembles two id-carrying copies in the browser, so nothing that reads the
  HTML file can see them: it clones `#top-menu` into `#mobile_menu` with all 14
  `menu-item-*` ids intact, and its builder wraps each `.et-l` layout — the
  before-header bar and the five bio popups — in a `<div id="et-boc">`, six of them.
  axe misses it too: its `duplicate-id` rules were dropped in 4.10, when WCAG 2.2
  retired 4.1.1 Parsing. The criterion is gone but the breakage is not — a repeated
  id still breaks `for`, `aria-labelledby` and every other id-based association.
  `wp-content/a11y.js` now renumbers them as they appear. The element that owns the
  id in the source keeps it, so anchors, CSS and `getElementById` still resolve
  where they did; each later copy takes a `-2` suffix. Re-measured: 0 duplicates on
  all 14 pages at both viewports, and 0 of 487 layout boxes moved.
- [x] **White links on a translucent panel** — 1.4.3 · 4 links, mobile only
  The home page's "Helpful Links" panel is `rgba(OCEAN, .85)`. The palette rebuild
  swapped the colour and kept the alpha, which is where it went wrong: the photo the
  panel *overlaps* — the image module beside it, not an ancestor background — reads
  through. No walk up the tree can name that colour, which is why axe returns
  "incomplete" rather than a ratio, and why `measure_contrast.js` skipped these
  elements: it stopped at the first non-transparent background. At 1440px the panel
  covers a dark part of the photo and the white type clears AA at 4.57–6.31:1. Once
  the columns stack at 390px it lands on a lighter part and the last four links
  measure 4.27–4.49:1 — exactly the four the audit named.
  `a11y_patch.py` now raises translucent brand fills to `MIN_FILL_ALPHA = 0.92`,
  against the new colour so it also reaches fills an earlier pass already swapped.
  Worst case is now 4.96:1 at 390px, 5.11:1 at 1440px; the photo still reads through.

  Two blind spots in the tooling let this sit, both closed:
  - `measure_contrast.js` treated any non-transparent background as opaque. A fill
    with alpha below 1 now keeps the walk going, so the text gets photographed
    instead of computed — 28 measured elements became 41.
  - it only ran at 1440px, while the failure only exists at 390px. It now runs both
    viewports like `axe_audit.js` and `probe_manual.js` do — 41 became 80.

### Manual
- [x] **Skip link** — 2.4.1 · first focusable element on every page.
- [x] **Image alt text** — 1.1.1 · team photos and the ACHC accreditation badge.
- [x] **Visible focus** — 2.4.7 · `:focus-visible` ring, inverted on dark surfaces.
- [x] **Reduced motion** — 2.3.3 · Divi's scroll reveals respect `prefers-reduced-motion`.

Not a real issue: the 16 "Read More" hits were a JS config string, never rendered.

---

## Still open

- [ ] **Keyboard-only walkthrough** — focus order and the mobile menu. The bio popups
  are done: focus lands in the dialog on open, Escape closes it, and focus returns to
  the "READ FULL BIO" trigger. The rest still needs a human at a keyboard.
- [ ] **Screen reader pass** (VoiceOver) over the nav and the bio popups.
- [ ] **Contact form submission, with a screen reader.** The paths themselves are covered
  now that there is a backend (`worker.js`): `tools/contact_form_check.js` drives the real
  form in Chrome and asserts the success notice, the reset, the re-enabled button and the
  server's error text. What a human still has to judge is how it *sounds* — nothing moves
  focus after submit, on the theory that the `role="status"` notice and the `role="alert"`
  error announce where they are.
- [ ] `/sleep-disorders/` has an empty content area — it renders as a bare sidebar.
  Pre-existing on the live site.

Closed since the last run: the hero intro text is not actually clipped — the gap above
it is Divi's scroll-reveal, and no container on any page cuts text at either viewport.

## Keeping it passing

`tools/a11y_patch.py` and `tools/contact_form_patch.py` are both idempotent — re-run them
after any re-scrape, then `npm run check`.

A third thing to know, alongside the two below: **a colour swap that keeps an alpha
is not a contrast fix.** A translucent fill composites with whatever is behind it,
including elements it merely overlaps, so the ratio depends on the pixels rather than
on the pairing `contrast.py` guards. `MIN_FILL_ALPHA` covers the fills on the site
today; anything new that puts text on a see-through panel has to be measured, and
`npm run contrast` is what measures it.

A third thing to know, alongside the two below: **a colour swap that keeps an alpha
is not a contrast fix.** A translucent fill composites with whatever is behind it,
including elements it merely overlaps, so the ratio depends on the pixels rather than
on the pairing `contrast.py` guards. `MIN_FILL_ALPHA` covers the fills on the site
today; anything new that puts text on a see-through panel has to be measured, and
`npm run contrast` is what measures it.

Two things to know before adding a rule to `a11y.css`:

- Divi's numbered classes (`.et_pb_section_0`, `.et_pb_blurb_0`, `.et_pb_image_1`) are
  per-page, not global. Scope anything that uses them to a `body` class, and expect the
  numbers to shift if the site is re-scraped — `measure_contrast.js` and
  `probe_manual.js` are what catch that.
- Divi sizes modules with per-module `width` / `max-width` rules of the same specificity
  a11y.css uses, and a11y.css loads last. A blanket rule on a module class silently
  overrides all of them.
