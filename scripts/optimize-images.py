#!/usr/bin/env python3
"""
willyye.github.io/zhangjiajie-tours-v3 — image optimizer (reproducible build step)

Converts every images/*.jpg to high-quality WebP (keeps the original .jpg as a
fallback). For large images (width >= 1200) it also emits a width-800 variant
used by the hero <img srcset>.

Quality floor is deliberately high (q82) so the result is visually identical to
the source. A perceptual diff (mean absolute pixel difference on a downscaled
copy) is printed per image as a sanity check.

Run:  python3 scripts/optimize-images.py
"""
import os
import glob
from PIL import Image, ImageChops

IMG_DIR = "images"
QUALITY = 82  # high floor — visually lossless for photos


def make_width_variant(im, width):
    ratio = width / im.width
    height = max(1, round(im.height * ratio))
    return im.resize((width, height), Image.LANCZOS)


def perceptual_diff(a_path, b_path, max_dim=400):
    """Mean absolute per-channel pixel difference on a downscaled copy.
    ~0-3 == indistinguishable; 10+ == visibly different."""
    a = Image.open(a_path).convert("RGB").resize((max_dim, max_dim), Image.LANCZOS)
    b = Image.open(b_path).convert("RGB").resize((max_dim, max_dim), Image.LANCZOS)
    diff = ImageChops.difference(a, b)
    hist = diff.histogram()  # 768 entries: 256 per RGB channel
    total = 0
    count = 0
    for ch in range(3):
        for value, c in enumerate(hist[ch * 256:(ch + 1) * 256]):
            total += value * c
            count += c
    return total / count if count else 0.0


def main():
    jpgs = sorted(glob.glob(os.path.join(IMG_DIR, "*.jpg")))
    total_src = total_webp = 0
    print(f"{'file':34} {'jpg':>8} {'webp':>8} {'saved':>7} {'diff':>6}")
    print("-" * 66)
    for f in jpgs:
        stem = os.path.splitext(f)[0]
        im = Image.open(f).convert("RGB")
        w, _ = im.size
        webp_path = stem + ".webp"
        im.save(webp_path, "WEBP", quality=QUALITY, method=4)
        if w >= 1200:
            make_width_variant(im, 800).save(
                stem + "-800.webp", "WEBP", quality=QUALITY, method=4
            )
        sz_jpg = os.path.getsize(f)
        sz_webp = os.path.getsize(webp_path)
        total_src += sz_jpg
        total_webp += sz_webp
        d = perceptual_diff(f, webp_path)
        print(
            f"{os.path.basename(f):34} {sz_jpg:8d} {sz_webp:8d} "
            f"{100 * (1 - sz_webp / sz_jpg):6.1f}% {d:6.2f}"
        )
    print("-" * 66)
    print(
        f"TOTAL  jpg={total_src / 1024:.1f}KB  webp={total_webp / 1024:.1f}KB  "
        f"saved={100 * (1 - total_webp / total_src):.1f}%"
    )


if __name__ == "__main__":
    main()
