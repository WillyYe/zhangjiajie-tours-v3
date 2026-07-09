#!/usr/bin/env python3
"""Pixel-level diff of the WebP-rendered vs JPG-rendered full-page screenshots.
Near-zero mean/max diff => the optimization is visually lossless."""
import sys
from PIL import Image, ImageChops

a = Image.open("/tmp/zjv3-vdiff/webp.png").convert("RGB")
b = Image.open("/tmp/zjv3-vdiff/jpg.png").convert("RGB")
print(f"webp.png size: {a.size}")
print(f"jpg.png  size: {b.size}")

# Align to the smaller canvas (viewport scroll rounding can differ by a few px).
w = min(a.width, b.width)
h = min(a.height, b.height)
a = a.crop((0, 0, w, h))
b = b.crop((0, 0, w, h))

diff = ImageChops.difference(a, b)
hist = diff.histogram()
total = count = 0
mx = 0
for ch in range(3):
    for v, c in enumerate(hist[ch * 256:(ch + 1) * 256]):
        total += v * c
        count += c
        if v > mx:
            mx = v
mean = total / count
# fraction of pixels that differ by more than 1/255 (i.e. visible)
changed = sum(c for v, c in enumerate(hist[:256]) if v >= 2) + \
           sum(c for v, c in enumerate(hist[256:512]) if v >= 2) + \
           sum(c for v, c in enumerate(hist[512:768]) if v >= 2)
pct = 100 * changed / count
print(f"mean abs diff / channel: {mean:.3f}  (0-255 scale; <1 == indistinguishable)")
print(f"max  abs diff / channel: {mx}")
print(f"pixels changed >1 level: {pct:.4f}%")
verdict = "VISUALLY LOSSLESS ✓" if mean < 1.0 else ("minor diff — inspect" if mean < 5 else "NOTICEABLE DIFF ✗")
print("verdict:", verdict)
