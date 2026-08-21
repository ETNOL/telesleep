/**
 * Serves the static mirror and handles the one dynamic route the site needs:
 * POST /api/contact, which emails the contact form to the practice.
 *
 * Delivery is Cloudflare's own send_email binding (Email Service). Two things
 * have to be true in the dashboard or every send fails:
 *
 *   1. CONTACT_FROM is on a domain onboarded to Email Sending. That is the apex,
 *      tele-sleep.com. Onboarding the apex also writes _dmarc.tele-sleep.com, which
 *      applies to the practice's own mailboxes as well — see the README before
 *      tightening that policy.
 *   2. CONTACT_TO is a *verified* destination address, and is listed in the
 *      binding's allowed_destination_addresses in wrangler.jsonc. Keeping that
 *      allowlist is also what keeps sending free — an open recipient list needs a
 *      paid Workers plan.
 *
 * Both addresses are vars, not constants, so switching the test inbox for the
 * practice inbox is a config change and a redeploy — not a code change.
 */

// Field name -> label in the email body. The name attributes in the form markup
// must match the keys.
const FIELDS = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  insurance: "Insurance",
  message: "Message",
};
const REQUIRED = ["name", "email", "message"];

// Deliberately stricter than the RFC: no whitespace and no address-header
// punctuation, which is what keeps the submitted address safe to use as replyTo.
// Everything else the visitor types goes in the body, which is a field rather
// than raw MIME, so it cannot forge a header either way.
const EMAIL = /^[^\s@,;:<>"()[\]\\]+@[^\s@,;:<>"()[\]\\]+\.[a-z]{2,}$/i;

const MAX_MESSAGE = 5000;

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === "/api/contact") {
      if (request.method !== "POST") {
        return json({ error: "Method not allowed." }, 405, { allow: "POST" });
      }
      return submit(request, env);
    }
    // Anything else is the static mirror. Assets that exist are served before
    // the Worker ever runs; this covers the misses so they get the 404 page.
    return env.ASSETS.fetch(request);
  },
};

async function submit(request, env) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Could not read the form." }, 400);
  }

  const value = (key) => String(form.get(key) ?? "").trim();

  // Honeypot. Bots fill every field they find; humans never see this one. Answer
  // as if it worked so the bot has nothing to tune against.
  if (value("_gotcha")) return json({ ok: true });

  const values = {};
  for (const key of Object.keys(FIELDS)) values[key] = value(key);

  if (REQUIRED.some((key) => !values[key])) {
    return json({ error: "Please fill in your name, email address, and message." }, 400);
  }
  if (!EMAIL.test(values.email)) {
    return json({ error: "Please enter a valid email address." }, 400);
  }
  if (values.message.length > MAX_MESSAGE) {
    return json({ error: `Please keep your message under ${MAX_MESSAGE} characters.` }, 400);
  }

  try {
    await env.EMAIL.send({
      to: env.CONTACT_TO,
      from: { name: "tele-sleep.com contact form", email: env.CONTACT_FROM },
      replyTo: values.email,
      subject: "New contact form submission",
      text: Object.entries(FIELDS)
        .map(([key, label]) => `${label}: ${values[key] || "—"}`)
        .join("\n\n"),
    });
  } catch (err) {
    // .code is the useful half — E_SENDER_NOT_VERIFIED and friends. Visitors get
    // the phone number instead of a stack trace.
    console.error("contact form send failed", err.code ?? "", err.message);
    return json(
      { error: "Sorry — we could not send your message. Please call our office at (865) 859-7800." },
      502,
    );
  }

  return json({ ok: true });
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}
