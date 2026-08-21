#!/usr/bin/env python3
"""Replace the Ninja Forms contact form with a static one the Worker can serve.

Idempotent — safe to re-run after re-scraping, same as tools/a11y_patch.py.

Ninja Forms built the form in the browser from a Backbone app and submitted it to
`wp-admin/admin-ajax.php` with a nonce. There is no WordPress behind this mirror,
so that submit could never work. This writes the same form as plain HTML posting
to `/api/contact` (see worker.js), and deletes the Backbone app, its 30-odd inline
templates and the inline form definition — 192 KB of JavaScript, plus underscore and
backbone, for a form with five fields.

Ninja Forms' *stylesheets* stay, and the markup below keeps its class names, so
the form looks exactly as it did — including the border-contrast fix in
wp-content/a11y.css, which selects on `.nf-form-content`.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from a11y_patch import SITE, rel_prefix  # noqa: E402

PAGE = "contacts/index.html"

# The block this replaces includes the inline <style> Ninja Forms printed for the
# submit button, so those two rules are restated here — verbatim, #1e73be included,
# which measures 4.94:1 on white. The field ids are Ninja Forms' own so the
# selectors keep working.
#
# The success notice needs a rule of its own on top: Ninja Forms ships
# `.nf-response-msg{display:none}` and reveals it from JavaScript. Empty stays hidden.
FORM = """<style>
.nf-form-content .nf-field-container #nf-field-4-wrap .nf-field-element .ninja-forms-field {
    background-color: #1e73be;
}
.nf-form-content .nf-field-container #nf-field-4-wrap .nf-field-element .ninja-forms-field:hover {
    background-color: #ffffff;
    color: #1e73be;
}
#contact-form .nf-response-msg:not(:empty) {
    display: block;
    margin-bottom: 25px;
    font-weight: 700;
    color: #0E6E8C;
}
#contact-form .nf-form-errors:not(:empty) {
    margin-bottom: 25px;
    font-weight: 700;
}
#contact-form .nf-form-fields-required {
    margin-bottom: 15px;
}
</style>
<div id="nf-form-1-cont" class="nf-form-cont">
<div class="nf-form-wrap ninja-forms-form-wrap">
<div class="nf-form-layout">
<form id="contact-form" action="/api/contact" method="post" aria-label="Contact form">
<div class="nf-form-content nf-multi-cell">
<div class="nf-response-msg" role="status" aria-live="polite"></div>
<div class="nf-form-errors nf-error-msg" role="alert"></div>
<div class="nf-form-fields-required">Fields marked with an \
<span class="ninja-forms-req-symbol">*</span> are required</div>
<div class="nf-row">
<div class="nf-cell" style="width:50%">
<div id="nf-field-1-container" class="nf-field-container textbox-container label-above">
<div class="nf-field"><div id="nf-field-1-wrap" class="field-wrap textbox-wrap">
<div class="nf-field-label"><label for="nf-field-1">Name \
<span class="ninja-forms-req-symbol">*</span></label></div>
<div class="nf-field-element"><input type="text" id="nf-field-1" name="name" \
class="ninja-forms-field nf-element" autocomplete="name" required></div>
</div></div></div>
</div>
<div class="nf-cell" style="width:50%">
<div id="nf-field-2-container" class="nf-field-container email-container label-above">
<div class="nf-field"><div id="nf-field-2-wrap" class="field-wrap email-wrap">
<div class="nf-field-label"><label for="nf-field-2">Email \
<span class="ninja-forms-req-symbol">*</span></label></div>
<div class="nf-field-element"><input type="email" id="nf-field-2" name="email" \
class="ninja-forms-field nf-element" autocomplete="email" required></div>
</div></div></div>
</div>
</div>
<div class="nf-row">
<div class="nf-cell" style="width:50%">
<div id="nf-field-5-container" class="nf-field-container tel-container label-above">
<div class="nf-field"><div id="nf-field-5-wrap" class="field-wrap tel-wrap">
<div class="nf-field-label"><label for="nf-field-5">Phone</label></div>
<div class="nf-field-element"><input type="tel" id="nf-field-5" name="phone" \
class="ninja-forms-field nf-element" autocomplete="tel"></div>
</div></div></div>
</div>
<div class="nf-cell" style="width:50%">
<div id="nf-field-6-container" class="nf-field-container textbox-container label-above">
<div class="nf-field"><div id="nf-field-6-wrap" class="field-wrap textbox-wrap">
<div class="nf-field-label"><label for="nf-field-6">Insurance</label></div>
<div class="nf-field-element"><input type="text" id="nf-field-6" name="insurance" \
class="ninja-forms-field nf-element"></div>
</div></div></div>
</div>
</div>
<div class="nf-row">
<div class="nf-cell" style="width:100%">
<div id="nf-field-3-container" class="nf-field-container textarea-container label-above">
<div class="nf-field"><div id="nf-field-3-wrap" class="field-wrap textarea-wrap">
<div class="nf-field-label"><label for="nf-field-3">Message \
<span class="ninja-forms-req-symbol">*</span></label></div>
<div class="nf-field-element"><textarea id="nf-field-3" name="message" \
class="ninja-forms-field nf-element" maxlength="5000" required></textarea></div>
</div></div></div>
</div>
</div>
<div class="nf-row">
<div class="nf-cell" style="width:100%">
<div id="nf-field-4-container" class="nf-field-container submit-container label-above">
<div class="nf-field"><div id="nf-field-4-wrap" class="field-wrap submit-wrap">
<div class="nf-field-element"><input type="submit" id="nf-field-4" \
class="ninja-forms-field nf-element" value="Submit"></div>
</div></div></div>
</div>
</div>
<div class="nf-sr-only"><input type="text" id="nf-field-hp" name="_gotcha" \
aria-label="Leave this field empty" tabindex="-1" autocomplete="off"></div>
</div>
</form>
</div>
</div>
</div>"""

# The honeypot is named by aria-label rather than a <label>: .nf-sr-only clips its
# content, and tools/probe_manual.js counts clipped text as a 1.4.4 failure. An
# input with no text node inside has nothing to clip.

# Everything Ninja Forms needed to build the form in the browser. The stylesheets
# are deliberately not in this list.
DEAD_JS = [
    # The inline form definition, plus the comment above it.
    r"[ \t]*<!-- That data is being printed as a workaround[^>]*-->\n?",
    r"[ \t]*<script>var formDisplay=1;.*?</script>\n?",
    r"[ \t]*<script id=\"nf-tmpl-(?:cell|row)\" type=\"text/template\">.*?</script>\n?",
    # The Backbone app itself, and the two libraries Ninja Forms was the only
    # thing on the page to enqueue.
    r"<script id=\"underscore-js\"[^>]*></script>\n?",
    r"<script id=\"backbone-js\"[^>]*></script>\n?",
    r"<script id=\"nf-front-end-deps-js\"[^>]*></script>\n?",
    r"<script id=\"nf-front-end-js-extra\">.*?</script>\n?",
    r"<script id=\"nf-front-end-js\"[^>]*></script>\n?",
    r"<script id=\"nf-layout-front-end-js\"[^>]*></script>\n?",
]

# Every field template, from the first one to the end of the body.
TEMPLATES = r"<script id=\"tmpl-nf-layout\".*?(?=</body>)"

# The noscript notice and the div the Backbone app rendered into.
PLACEHOLDER = (
    r"<noscript class=\"ninja-forms-noscript-message\">.*?"
    r"<div id=\"nf-form-1-cont\".*?<div class=\"nf-loading-spinner\"></div>\s*</div>"
)


def add_script(h, path):
    if "contact-form.js" in h:
        return h
    tag = f'<script src="{rel_prefix(path)}wp-content/contact-form.js" defer></script>'
    return h.replace("</head>", tag + "\n</head>", 1)


def patch(path=PAGE):
    full = os.path.join(SITE, path)
    h = original = open(full, encoding="utf-8").read()

    if 'id="contact-form"' not in h:
        h = re.sub(PLACEHOLDER, lambda _: FORM, h, flags=re.S)

    for pattern in DEAD_JS:
        h = re.sub(pattern, "", h, flags=re.S)
    h = re.sub(TEMPLATES, "", h, flags=re.S)
    h = add_script(h, path)

    if h != original:
        open(full, "w", encoding="utf-8").write(h)
    return h != original


if __name__ == "__main__":
    print(f"{PAGE}: {'patched' if patch() else 'already patched'}")
