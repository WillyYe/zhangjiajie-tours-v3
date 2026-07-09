#!/usr/bin/env python3
"""Recompress the hero image (LCP element) to cut first-load bytes.

Generates at two widths (1600w desktop, 800w mobile):
  - images/hero-liriver.webp  + hero-liriver-800.webp   (Pillow native, q75)
  - images/hero-liriver.avif  + hero-liriver-800.avif    (if pillow-avif-plugin present, q58)

Run from the repo root: python3 scripts/recompress-hero.py
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "images", "hero-liriver.jpg")
TARGETS = [(1600, "hero-liriver"), (800, "hero-liriver-800")]

try:
    from pillow_avif import AvifImagePlugin  # noqa: F401
    AVIF_OK = True
except Exception:
    AVIF_OK = False

print(f"AVIF support: {'yes' if AVIF_OK else 'no'}")
if not os.path.exists(SRC):
    raise SystemExit(f"source missing: {SRC}")


def save_webp(im, out_path, quality=75):
    im.save(out_path, "WEBP", quality=quality, method=4, exact=False)
    return os.path.getsize(out_path)


def save_avif(im, out_path, quality=58):
    im.save(out_path, "AVIF", quality=quality)
    return os.path.getsize(out_path)


for width, name in TARGETS:
    with Image.open(SRC) as src:
        src = src.convert("RGB")
        h = round(src.height * width / src.width)
        im = src.resize((width, h), Image.LANCZOS)

        wp = os.path.join(ROOT, "images", f"{name}.webp")
        wsz = save_webp(im, wp)
        print(f"  {name}.webp  -> {wsz/1024:.1f} KB ({width}w)")

        if AVIF_OK:
            ap = os.path.join(ROOT, "images", f"{name}.avif")
            asz = save_avif(im, ap)
            print(f"  {name}.avif  -> {asz/1024:.1f} KB ({width}w)")

print("done")
