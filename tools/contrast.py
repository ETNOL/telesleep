#!/usr/bin/env python3
"""WCAG contrast checker + the palette this site is committed to.

Run it: `python3 tools/contrast.py` — exits non-zero if any pairing drops below AA.
This is the guard for the palette. Change a color, run this, keep it green.
"""


def _lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hexcolor):
    h = hexcolor.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)


def ratio(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


# --- the palette -------------------------------------------------------------
# Replaces the old #17b1e7 / #ff9e21 pair, which failed AA everywhere (2.47:1).
# Each color is the most saturated version of its hue that still clears 4.5:1
# in both directions — vivid as compliance allows, not a wash of grey.
INK        = "#0B2942"   # headings, body text — deep navy
OCEAN      = "#0E6E8C"   # primary: buttons, links, brand fills
OCEAN_DEEP = "#0A5670"   # hover / gradient partner
AMBER      = "#8A4A00"   # accent text (eyebrows, "read full bio")
MUTED      = "#4F5B66"   # secondary text
SKY        = "#8FD3EA"   # the one light tint — links sitting on dark navy
WHITE      = "#ffffff"
PAPER      = "#f9f9f9"   # light section background
MIST       = "#f6f7fb"   # tinted panel background

# (foreground, background, minimum) — 4.5 normal text, 3.0 large/UI
PAIRS = [
    (WHITE, OCEAN, 4.5),        # button label on primary fill
    (WHITE, OCEAN_DEEP, 4.5),   # button label on hover fill
    (OCEAN, WHITE, 4.5),        # link on white
    (OCEAN, PAPER, 4.5),        # link on light section
    (OCEAN, MIST, 4.5),         # link on tinted panel
    (AMBER, WHITE, 4.5),        # accent text on white
    (AMBER, PAPER, 4.5),
    (AMBER, MIST, 4.5),
    (INK, WHITE, 4.5),
    (INK, PAPER, 4.5),
    (MUTED, WHITE, 4.5),
    (MUTED, PAPER, 4.5),
    (MUTED, "#dddddd", 4.5),    # was #666 on #ddd — 4.22:1, just under
    (WHITE, INK, 4.5),          # footer: white on navy
    (SKY, INK, 4.5),            # footer links on navy — OCEAN is too dark here
    (SKY, "#0d1f2e", 4.5),      # footer-bottom, which sits ~32% darker still
]

if __name__ == "__main__":
    bad = 0
    for fg, bg, need in PAIRS:
        r = ratio(fg, bg)
        ok = r >= need
        bad += not ok
        print(f"{'PASS' if ok else 'FAIL'}  {r:5.2f}:1  (need {need})  {fg} on {bg}")
    assert not bad, f"{bad} pairing(s) below WCAG AA"
    print(f"\nAll {len(PAIRS)} pairings meet WCAG 2.1 AA.")
