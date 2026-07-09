#!/usr/bin/env python3
"""
willyye.github.io/zhangjiajie-tours-v3 — HTML image-reference rewriter (reproducible build step)

After optimize-images.py has produced images/*.webp, this rewrites index.html so
that:
  * every <img src="images/X.jpg"> becomes
        <picture><source srcset="images/X.webp" type="image/webp"><img ...></picture>
    (the original .jpg stays as a graceful fallback)
  * every CSS background-image url('images/X.jpg') becomes url('images/X.webp')

Idempotent-ish: only rewrites references that still point at .jpg, so it is safe
to re-run after adding new images.
"""
import re

HTML = "index.html"


def rewrite(html: str) -> str:
    # 1) CSS background-image urls -> webp
    html = re.sub(
        r"url\(['\"]?images/([\w-]+)\.jpg['\"]?\)",
        r"url('images/\1.webp')",
        html,
    )

    # 2) <img ... src="images/X.jpg" ...> -> <picture> wrapper (jpg kept as fallback)
    def img_repl(m):
        before, src, after = m.group(1), m.group(2), m.group(3)
        webp = src[:-4] + ".webp"
        return (
            f'<picture><source srcset="{webp}" type="image/webp">'
            f'<img{before}src="{src}"{after}></picture>'
        )

    html = re.sub(
        r'<img\b([^>]*?)\bsrc="(images/[\w-]+\.jpg)"([^>]*)>',
        img_repl,
        html,
    )
    return html


def main():
    with open(HTML, encoding="utf-8") as f:
        html = f.read()
    new = rewrite(html)
    with open(HTML, "w", encoding="utf-8") as f:
        f.write(new)
    n_picture = new.count("<picture>")
    n_jpg_ref = len(re.findall(r'images/[\w-]+\.jpg', new))
    print(f"wrote {HTML}: <picture>={n_picture}, remaining .jpg refs={n_jpg_ref}")


if __name__ == "__main__":
    main()
