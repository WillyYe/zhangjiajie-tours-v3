// zhangjiajie-tours-v3 — Attraction detail-page generator
// Reads templates/attraction-page.html + attractions-data.mjs and writes one
// fully-populated HTML file per attraction into attractions/.
//
// Design rules (verified against the proven 100分 yuanjiajie.html):
//  - Heading ladder: h1 (page) -> h2 (section) -> h3 (cards / FAQ / related)
//    -> h4 (Local tip + footer). No level skips (static-audit T10).
//  - Every <img> carries alt + loading="lazy" (hero exempt via fetchpriority=high).
//  - All data-driven content is HTML-escaped; JSON-LD is emitted via JSON.stringify.
//  - Referenced images are validated against images/ before writing (static-audit T1).
// Run: node scripts/build-attractions.mjs   (from project root)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { attractions } from '../attractions-data.mjs';
import { siteNav } from '../home-data.mjs';
import { applyNav } from '../admin/modules/nav-render.js';
import { applyIndexNav, buildIndexNav } from './index-nav.mjs';
import { hotelCategories } from '../hotels-data.mjs';
import { buildPageMap, buildAttractionJsonLd, imgSrc } from './fragments.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'templates', 'attraction-page.html');
const OUT_DIR = path.join(ROOT, 'attractions');
const IMAGES_DIR = path.join(ROOT, 'images');

// ---------- image-existence validation ----------
function collectImages(a) {
  const names = [a.heroImg, a.heroBgImg];
  a.highlights.forEach((h) => names.push(h.img));
  a.gallery.forEach((g) => names.push(g.img));
  a.related.forEach((r) => names.push(r.img));
  return names.map(imgSrc).map((p) => p.replace('../', '')); // -> images/xxx.webp
}
function validateImages(a) {
  const missing = collectImages(a).filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
  if (missing.length) {
    console.error(`  ✗ [${a.slug}] missing images: ${missing.join(', ')}`);
    process.exitCode = 1;
    return false;
  }
  return true;
}

// ---------- main ----------
const template = fs.readFileSync(TEMPLATE, 'utf8');
fs.mkdirSync(OUT_DIR, { recursive: true });

let allOk = true;
// hidden 项：前台不生成该详情页，且其它页的相关推荐需过滤掉它（避免死链）
const hiddenSlugs = new Set((attractions || []).filter((a) => a.hidden).map((a) => a.slug));
for (const a of attractions) {
  if (a.hidden) continue;
  if (!validateImages(a)) { allOk = false; continue; }

  const visible = { ...a, related: (a.related || []).filter((r) => !hiddenSlugs.has(r.slug)) };
  const map = buildPageMap(visible, 'attraction');

  let out = template;
  for (const [k, v] of Object.entries(map)) {
    out = out.split(`{{${k}}}`).join(v);
  }

  // Replace the entire JSON-LD block (template ships Yuanjiajie's; swap for this page's).
  const jsonLd = JSON.stringify(buildAttractionJsonLd(a), null, 2);
  out = out.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">\n${jsonLd}\n  </script>`
  );

  // Guard: no leftover placeholders
  const leftovers = [...out.matchAll(/\{\{[A-Z_]+\}\}/g)].map((m) => m[0]);
  if (leftovers.length) {
    console.error(`  ✗ [${a.slug}] leftover placeholders: ${[...new Set(leftovers)].join(', ')}`);
    process.exitCode = 1;
    allOk = false;
    continue;
  }

  out = applyNav(out, siteNav, '../');
  out = applyIndexNav(out, buildIndexNav(hotelCategories, '../'));

  const dest = path.join(OUT_DIR, a.file);
  fs.writeFileSync(dest, out, 'utf8');
  console.log(`  ✓ wrote ${a.file} (${out.length} bytes)`);
}

console.log(allOk ? '\nAll attraction pages generated.\n' : '\nGeneration completed WITH ERRORS — see above.\n');
process.exit(allOk ? 0 : 1);
