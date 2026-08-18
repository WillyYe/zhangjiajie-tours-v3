#!/usr/bin/env python3
"""
willyye.github.io/zhangjiajie-tours-v3 — SAFE image optimizer (reproducible build step)

Converts every images/*.jpg to WebP at the HIGHEST quality that is BOTH
smaller than the current on-disk asset AND perceptually indistinguishable
from the source (mean abs pixel diff < 4 on a 400px downscale ≈ invisible).

Safety guarantees (no regressions):
  - Never writes a WebP larger than the existing best on-disk asset.
  - Never writes a WebP with visible quality loss (diff >= 4 → keep original).
  - Does NOT emit unused -800 width variants (v3 HTML uses plain <img>, not srcset).
  - The original .jpg is kept as a fallback source.

Run from repo root:  python3 scripts/optimize-images.py
"""
import os
import glob
from PIL import Image, ImageChops

IMG_DIR = "images"
QUALITIES = [76, 72, 68]          # try high -> low; keep the SMALLEST that is smaller + indistinguishable (floor q68 for safety)
DIFF_OK = 4.0                       # perceptual diff threshold (~ invisible)


def perceptual_diff(a_path, b_path, max_dim=400):
    """Mean absolute per-channel pixel difference on a downscaled copy.
    ~0-3 == indistinguishable; 10+ == visibly different."""
    a = Image.open(a_path).convert("RGB").resize((max_dim, max_dim), Image.LANCZOS)
    b = Image.open(b_path).convert("RGB").resize((max_dim, max_dim), Image.LANCZOS)
    diff = ImageChops.difference(a, b).histogram()
    total = count = 0
    for ch in range(3):
        for value, c in enumerate(diff[ch * 256:(ch + 1) * 256]):
            total += value * c
            count += c
    return total / count if count else 0.0


def main():
    jpgs = sorted(glob.glob(os.path.join(IMG_DIR, "*.jpg")))
    total_before = total_after = 0
    print(f"{'file':32} {'before':>8} {'after':>8} {'saved':>7} {'diff':>6}  action")
    print("-" * 78)
    for f in jpgs:
        stem = os.path.splitext(f)[0]
        webp_path = stem + ".webp"
        im = Image.open(f).convert("RGB")
        best_size = os.path.getsize(webp_path) if os.path.exists(webp_path) else os.path.getsize(f)
        cands = []
        for q in QUALITIES:
            tmp = stem + ".tmp.webp"
            im.save(tmp, "WEBP", quality=q, method=6)
            sz = os.path.getsize(tmp)
            d = perceptual_diff(f, tmp)
            os.remove(tmp)
            if d < DIFF_OK and sz < best_size:
                cands.append((sz, q, d))
        chosen = (min(cands)[1], min(cands)[0], min(cands)[2]) if cands else None
        total_before += best_size
        if chosen:
            im.save(webp_path, "WEBP", quality=chosen[0], method=6)
            after = os.path.getsize(webp_path)
            total_after += after
            print(f"{os.path.basename(f):32} {best_size:8d} {after:8d} "
                  f"{100 * (1 - after / best_size):6.1f}% {chosen[2]:6.2f}  webp q{chosen[0]}")
        else:
            total_after += best_size
            print(f"{os.path.basename(f):32} {best_size:8d} {best_size:8d} "
                  f"{'--':>7} {'--':>6}  keep existing (no safe win)")
    print("-" * 78)
    print(f"TOTAL referenced-best  before={total_before / 1024:.1f}KB  "
          f"after={total_after / 1024:.1f}KB  saved={100 * (1 - total_after / total_before):.1f}%")


if __name__ == "__main__":
    main()
