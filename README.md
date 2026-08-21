# tele-sleep.com — static mirror

Scraped 2026-08-13 from https://tele-sleep.com (WordPress + Divi + Supreme Modules + Ninja Forms).

## Serve

```sh
cd public && python3 -m http.server 8766
```

Links are relative (`../cpap-help/`), so it needs a server that maps directories to
`index.html`. `file://` won't work. To exercise the contact form too, run the Worker
instead — see below.

## Layout

The site is `public/`: 14 pages as `<slug>/index.html`, assets under `wp-content/` and
`wp-includes/` at their original paths — so any URL from the live site resolves the same
here. Everything outside `public/` is tooling and is never deployed.

- `worker.js` — serves `public/` and handles `POST /api/contact`
- `wrangler.jsonc` — the deploy config, including the email binding
- `tools/` — the accessibility and form checks

## Deploy

```sh
npx wrangler deploy      # needs Node 22+
```

A Worker with static assets, not a Pages project — Pages Functions cannot bind
`send_email`, which is how the contact form delivers.

## Contact form

`/contacts/` posts to `/api/contact`, which emails the submission through Cloudflare's
own `send_email` binding. No third-party mail service, no API keys.

Ninja Forms used to build this form in the browser and submit it to
`wp-admin/admin-ajax.php`. There is no WordPress behind the mirror, so that could never
work. `tools/contact_form_patch.py` replaces it with plain HTML — same markup classes, so
it looks identical — and deletes the Backbone app and its 30-odd templates. Ninja Forms'
stylesheets stay.

### One-time Cloudflare setup

1. **Compute → Email Service → Email Sending → Onboard Domain.** Onboard the subdomain
   `send.tele-sleep.com`, not the apex. Onboarding writes a DMARC record, and at the apex
   that record would judge mail from the practice's own mailboxes too — which are hosted
   elsewhere and are not aligned. On a subdomain it cannot reach them.
2. Add and verify every address in `allowed_destination_addresses` in `wrangler.jsonc`.
   Verification is a link in an email to that inbox; an unverified address makes every
   send fail. No DNS change is needed on the destination's domain.
3. Leave the allowlist in place. Sending to verified destinations in your own account is
   free on any plan; an unrestricted recipient list needs a paid Workers plan.

Email Sending is separate from Email Routing. It added `cf-bounce.tele-sleep.com` (MX and
SPF) and `cf-bounce._domainkey.tele-sleep.com` (DKIM) — all new names. The apex MX and SPF
are untouched, so inbound mail to the domain's own mailboxes is unaffected.

**One caveat, and it is the only thing here that can break existing mail.** Onboarding the
apex also created `_dmarc.tele-sleep.com`, and Cloudflare set it to `p=reject`. That policy
applies to every message claiming to be from the domain, including the practice's staff
mailboxes, which are hosted elsewhere. It has been set back to `p=none` — no action taken,
which is the behaviour the domain had before onboarding.

Do not tighten it back to `quarantine` or `reject` casually. First add a `rua=mailto:`
address, read the reports for a few weeks, and confirm every legitimate sender passes.
Staff mail is DKIM-signed by the mail host (`default._domainkey.tele-sleep.com`), but
third-party senders using a `@tele-sleep.com` from-address — appointment reminders, e-fax,
a CRM, a newsletter tool — may not be, and under `p=reject` those bounce instead of
arriving.

Delivery goes to `CONTACT_TO`, set to a test inbox. Switch it to
`drshuteye@tranquilitysleep.com` in `wrangler.jsonc` and redeploy to go live.

### Locally

```sh
npx wrangler dev --port 8787          # needs Node 22+
```

Nothing is actually emailed. Wrangler prints the headers it built and writes the body to
`.wrangler/tmp/email/**/email-text/*.txt`.

```sh
node tools/contact_form_check.js          # browser: submit, reset, validation, errors

# the Worker's own paths
curl -X POST localhost:8787/api/contact -F name=A -F email=a@b.co -F message=hi   # 200
curl -X POST localhost:8787/api/contact -F name=A                                # 400
curl -X POST localhost:8787/api/contact -F name=A -F email=nope -F message=hi     # 400
```

To send one real email from a local run, add `"remote": true` to the `send_email` binding,
run `wrangler dev` again, and submit the form. That is also the only way to confirm the
`Reply-To` header and DKIM signing, which the local simulation does not show. Take the
flag back out afterwards.

Spam control is a honeypot field only. If that stops being enough, Turnstile is the next
step — it is free and Cloudflare-native.

## Accessibility

The site meets WCAG 2.1 AA — see `TODO-a11y.md` for what was found and fixed, and what still
needs a human. To re-verify (site must be served first):

```sh
cd tools && npm install && npm run check
```

- `tools/contrast.py` — the palette, with a contrast assertion per color pairing
- `tools/a11y_patch.py` — applies every fix; idempotent, re-run after a re-scrape
- `tools/contact_form_patch.py` — the form swap above; also idempotent
- `tools/probe_manual.js` — what axe cannot see: 320px reflow, 1.4.12 text spacing,
  clipped containers, target size
- `public/wp-content/a11y.css` — the override layer, loaded last on every page
- `public/wp-content/a11y.js` — the same job for markup built in the browser (the bio
  popups)
- `public/wp-content/contact-form.js` — submits the form without a page reload

## Not captured (needs the WP backend)

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
- Ninja Forms' front-end JavaScript — see **Contact form** above.
