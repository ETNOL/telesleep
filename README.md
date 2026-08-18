# tele-sleep.com — static mirror

Scraped 2026-08-13 from https://tele-sleep.com (WordPress + Divi + Supreme Modules + Ninja Forms).

## Serve

```sh
python3 -m http.server 8766
```

Links are relative (`../cpap-help/`), so it needs a server that maps directories to
`index.html`. `file://` won't work.

## Layout

14 pages as `<slug>/index.html`, assets under `wp-content/` and `wp-includes/` at their
original paths — so any URL from the live site resolves the same here.

## Accessibility

The site meets WCAG 2.1 AA — see `TODO-a11y.md` for what was found and fixed, and what still
needs a human. To re-verify (site must be served first):

```sh
cd tools && npm install && npm run check
```

- `tools/contrast.py` — the palette, with a contrast assertion per color pairing
- `tools/a11y_patch.py` — applies every fix; idempotent, re-run after a re-scrape
- `tools/probe_manual.js` — what axe cannot see: 320px reflow, 1.4.12 text spacing,
  clipped containers, target size
- `wp-content/a11y.css` — the override layer, loaded last on every page
- `wp-content/a11y.js` — the same job for markup built in the browser (the bio
  popups and the contact form)

## Not captured (needs the WP backend)

- **Contact form submission** (`/contacts/`) — the form itself renders (Ninja Forms
  builds it from inline JS), but there is no backend, so submitting goes nowhere.
- Google Fonts / Analytics / Ads still load from Google, same as live.
- Blank gaps elsewhere are Divi's scroll-reveal animations — identical on the live site,
  not a scrape artifact.

## Removed from the scrape

- `hello-world/`, `category/uncategorized/` — default WordPress placeholders, deleted
  along with the "Recent Posts" sidebar widget that linked to them.
- `licenses-and-certifications/` — the certificates were outdated. The page, its two
  scanned images and the footer link on every page are gone.
- `wp-login.php`, `xmlrpc.php` and the WordPress head markup that pointed at endpoints
  the scrape never captured (RSD, pingback, REST/`wp-json`, oEmbed, RSS feeds) plus the
  WordPress and Divi `generator` version metas.
