#!/usr/bin/env python3
"""Apply the accessibility + palette fixes to every mirrored page.

Idempotent — safe to re-run after re-scraping. Pairs with tools/contrast.py,
which guards the palette, and TODO-a11y.md, which lists what this covers.
"""
import glob
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from contrast import AMBER, MUTED, OCEAN  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Old brand colors -> new. Every old value failed AA in both text roles, and the
# replacements clear it in both, so one mapping covers fills and text alike.
COLORS = {
    "#17b1e7": OCEAN,
    "#2ea6f7": OCEAN,
    "#2eb9e9": OCEAN,
    "#ff9e21": AMBER,
    "#666666": MUTED,
}

# The same colors again in the notations the theme CSS actually uses: rgba()
# for translucent section fills, and 3-digit shorthand for greys.
RGBA = {
    (23, 177, 231): OCEAN,   # #17b1e7
    (255, 158, 33): AMBER,   # #ff9e21
    (46, 166, 247): OCEAN,   # #2ea6f7
    (46, 185, 233): OCEAN,   # #2eb9e9
}
SHORTHAND = {"#666": MUTED}


def _rgb(hexcolor):
    h = hexcolor.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def fix_color_notations(text):
    """Catch the rgba() and #abc spellings a plain hex swap walks straight past."""
    def repl(m):
        parts = [p.strip() for p in m.group(2).split(",")]
        try:
            key = tuple(int(p) for p in parts[:3])
        except ValueError:
            return m.group(0)
        if key not in RGBA:
            return m.group(0)
        r, g, b = _rgb(RGBA[key])
        tail = "," + parts[3] if len(parts) > 3 else ""
        return f"{m.group(1)}({r},{g},{b}{tail})"

    text = re.sub(r"(rgba?)\(([^)]*)\)", repl, text, flags=re.I)
    for old, new in SHORTHAND.items():
        text = re.sub(re.escape(old) + r"\b(?![0-9a-f])", new, text, flags=re.I)
    return text

# Images the scrape left with alt="" that carry real meaning.
ALT = {
    "logo-1.png": "Tranquility Sleep Specialists, PLC",
    "logo-3.png": "Tranquility Sleep Specialists, PLC",
    "mcwhirter-final.jpg": "Dewey McWhirter, MD",
    "michelle-updated.jpg": "Michelle Dobreski, Administrator",
    "michelle-dobreski.jpg": "Michelle Dobreski, Administrator",
    "kaitlin-alex-better.jpg": "Kaitlyn Alex, FNP-C",
    "becca.png": "Becca Crum, FNP-C",
    "achc-accredited.jpg": "Accredited by the Accreditation Commission for Health Care (ACHC)",
}

# Pages with no h1 at all -> (heading text, visible?)
MISSING_H1 = {
    "videos/index.html": ("Videos", True),
    "licenses-and-certifications/index.html": ("Licenses and Certifications", True),
}


def rel_prefix(path):
    d = os.path.dirname(path)
    return "../" * len(d.split("/")) if d else ""


def fix_viewport(h):
    """WCAG 1.4.4 — the theme shipped user-scalable=0, which blocks pinch zoom."""
    return re.sub(
        r'(<meta name="viewport" content=")[^"]*(")',
        r"\1width=device-width, initial-scale=1.0\2", h)


def fix_colors(h):
    for old, new in COLORS.items():
        h = re.sub(re.escape(old), new, h, flags=re.I)
    return fix_color_notations(h)


def patch_stylesheets():
    """The theme's own CSS carries the failing colors too, so the page-level
    swap alone leaves section fills and widget text behind."""
    changed = 0
    for css in glob.glob(ROOT + "/wp-content/**/*.css", recursive=True):
        if css.endswith("a11y.css"):
            continue
        text = original = open(css, encoding="utf-8", errors="replace").read()
        text = fix_colors(text)
        if text != original:
            open(css, "w", encoding="utf-8").write(text)
            changed += 1
    return changed


def add_stylesheet(h, path):
    if "a11y.css" in h:
        return h
    link = f'<link rel="stylesheet" href="{rel_prefix(path)}wp-content/a11y.css">'
    return h.replace("</head>", link + "\n</head>", 1)


def add_skip_link(h):
    """WCAG 2.4.1 — first focusable element jumps past the nav."""
    if "skip-to-content" in h:
        return h
    return re.sub(
        r"(<body[^>]*>)",
        r'\1<a class="skip-to-content" href="#main-content">Skip to main content</a>',
        h, count=1)


def add_landmarks(h):
    """Divi ships bare divs; role= is enough and touches no CSS."""
    h = re.sub(r'(<div id="main-content")(?![^>]*role=)', r'\1 role="main" tabindex="-1"', h)
    h = re.sub(r'(<footer id="main-footer")(?![^>]*role=)', r'\1 role="contentinfo"', h)
    # The Divi Toolbox bar sits outside every landmark, stranding ~4 blocks per
    # page. <header id="main-header"> is the real banner, so this gets a named
    # region rather than a second one.
    h = re.sub(r'(<div id="dtb-before-header")(?![^>]*role=)',
               r'\1 role="region" aria-label="Site header"', h)
    return h


def fix_image_alt(h):
    """WCAG 1.1.1 — restore alt text on informative images."""
    def repl(m):
        tag = m.group(0)
        src = re.search(r'src="([^"]*)"', tag)
        if not src:
            return tag
        name = src.group(1).rsplit("/", 1)[-1]
        text = ALT.get(name)
        return tag.replace('alt=""', f'alt="{text}"') if text else tag
    return re.sub(r"<img[^>]*alt=\"\"[^>]*>", repl, h)


def fix_link_names(h):
    """WCAG 2.4.4 / 4.1.2 — logo links wrap an image and expose no text."""
    # Empty href on the footer logo points at nothing; send it home.
    h = re.sub(r'(<a )href=""(>\s*<span class="et_pb_image_wrap)', r'\1href="./"\2', h)

    def repl(m):
        tag, inner = m.group(1), m.group(2)
        if "aria-label" in tag or re.search(r'alt="[^"]+"', inner):
            return m.group(0)
        return tag[:-1] + ' aria-label="Tranquility Sleep Specialists, PLC — home">' + inner
    return re.sub(r'(<a [^>]*>)(\s*<span class="et_pb_image_wrap.*?</a>)', repl, h, flags=re.S)


def fix_iframe_titles(h):
    """WCAG 4.1.2 — name each embed from the heading that introduces it."""
    def repl(m):
        tag, after = m.group(0), h[m.end():m.end() + 2000]
        if "title=" in tag:
            return tag
        head = re.search(r"<h[1-6][^>]*>(.*?)</h[1-6]>", after, re.S)
        name = re.sub(r"<[^>]+>", "", head.group(1)).strip() if head else "Video"
        name = re.sub(r"\s+", " ", name).replace('"', "&quot;")
        return tag[:-1] + f' title="{name}">'
    return re.sub(r"<iframe[^>]*>", repl, h)


def fix_form_labels(h):
    """WCAG 4.1.2 — the search field's <label> is display:none, so it names nothing."""
    h = re.sub(r'(<input[^>]*name="s"(?![^>]*aria-label))', r'\1 aria-label="Search this site"', h)
    h = re.sub(r'(<input[^>]*id="searchsubmit"(?![^>]*aria-label))', r'\1 aria-label="Submit search"', h)
    return h


def add_missing_h1(h, path):
    """Three pages render their title as styled text, leaving no h1."""
    entry = MISSING_H1.get(path)
    if not entry or "a11y-page-title" in h:
        return h
    text, visible = entry
    cls = "a11y-page-title" if visible else "a11y-page-title sr-only"
    return h.replace('<div class="entry-content">',
                     f'<div class="entry-content"><h1 class="{cls}">{text}</h1>', 1)


def fix_heading_order(h):
    """Headings jump h2 -> h4 for visual size. Retagging would break Divi's
    per-module CSS, so the element stays put and aria-level carries the real
    outline instead."""
    heads = list(re.finditer(r"<h([1-6])((?:[^>\"']|\"[^\"]*\"|'[^']*')*)>", h))
    stack, out, last = [], [], 0
    for m in heads:
        lvl = int(m.group(1))
        while stack and stack[-1] >= lvl:
            stack.pop()
        stack.append(lvl)
        out.append(min(len(stack), 6))
    for m, new in reversed(list(zip(heads, out))):
        attrs = m.group(2)
        if "aria-level" in attrs:
            continue
        if new != int(m.group(1)):
            tag = f'<h{m.group(1)}{attrs} role="heading" aria-level="{new}">'
            h = h[:m.start()] + tag + h[m.end():]
    return h, last


def patch(path):
    full = os.path.join(ROOT, path)
    h = original = open(full, encoding="utf-8").read()
    h = fix_viewport(h)
    h = fix_colors(h)
    h = add_stylesheet(h, path)
    h = add_skip_link(h)
    h = add_landmarks(h)
    h = fix_image_alt(h)
    h = fix_link_names(h)
    h = fix_iframe_titles(h)
    h = fix_form_labels(h)
    h = add_missing_h1(h, path)
    h, _ = fix_heading_order(h)
    if h != original:
        open(full, "w", encoding="utf-8").write(h)
    return h != original


if __name__ == "__main__":
    pages = sorted(os.path.relpath(p, ROOT)
                   for p in glob.glob(ROOT + "/**/index.html", recursive=True))
    changed = [p for p in pages if patch(p)]
    print(f"patched {len(changed)}/{len(pages)} pages, {patch_stylesheets()} stylesheets")
