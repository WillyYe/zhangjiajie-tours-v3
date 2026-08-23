// zhangjiajie-tours-v3 — Experiences detail-page generator
// Reads templates/experience-page.html + experiences-data.mjs and writes one
// fully-populated HTML file per experience into experiences/.
//
// Design rules:
//  - Heading ladder: h1 -> h2 -> h3 -> h4. No level skips.
//  - Every <img> has alt + loading="lazy" (hero exempt via fetchpriority=high).
//  - All data-driven content is HTML-escaped; JSON-LD is emitted via JSON.stringify.
//  - Referenced images are validated against images/ before writing.
// Run: node scripts/build-experiences.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { experiences } from '../experiences-data.mjs';
import { siteNav } from '../home-data.mjs';
import { applyNav } from '../admin/modules/nav-render.js';
import { applyIndexNav, buildIndexNav } from './index-nav.mjs';
import { hotelCategories } from '../hotels-data.mjs';
import { buildPageMap, buildExperienceJsonLd, imgSrc } from './fragments.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'templates', 'experience-page.html');
const OUT_DIR = path.join(ROOT, 'experiences');
const IMAGES_DIR = path.join(ROOT, 'images');

function collectImages(e) {
  const names = [e.heroImg, e.heroBgImg];
  e.highlights.forEach((h) => names.push(h.img));
  e.gallery.forEach((g) => names.push(g.img));
  e.related.forEach((r) => names.push(r.img));
  return names.map(imgSrc).map((p) => p.replace('../', ''));
}

function validateImages(e) {
  const missing = collectImages(e).filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
  if (missing.length) {
    console.error(`  ✗ [${e.slug}] missing images: ${missing.join(', ')}`);
    process.exitCode = 1;
    return false;
  }
  return true;
}

const template = fs.readFileSync(TEMPLATE, 'utf8');
fs.mkdirSync(OUT_DIR, { recursive: true });

let allOk = true;
// hidden 项：前台不生成该详情页，且其它页的相关推荐需过滤掉它（避免死链）
const hiddenSlugs = new Set((experiences || []).filter((e) => e.hidden).map((e) => e.slug));
for (const e of experiences) {
  if (e.hidden) continue;
  if (!validateImages(e)) { allOk = false; continue; }

  const visible = { ...e, related: (e.related || []).filter((r) => !hiddenSlugs.has(r.slug)) };
  const map = buildPageMap(visible, 'experience');

  let out = template;
  for (const [k, v] of Object.entries(map)) {
    out = out.split(`{{${k}}}`).join(v);
  }

  const jsonLd = JSON.stringify(buildExperienceJsonLd(e), null, 2);
  out = out.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">\n${jsonLd}\n  </script>`
  );

  const leftovers = [...out.matchAll(/\{\{[A-Z_]+\}\}/g)].map((m) => m[0]);
  if (leftovers.length) {
    console.error(`  ✗ [${e.slug}] leftover placeholders: ${[...new Set(leftovers)].join(', ')}`);
    process.exitCode = 1;
    allOk = false;
    continue;
  }

  out = applyNav(out, siteNav, '../');
  out = applyIndexNav(out, buildIndexNav(hotelCategories, '../'));

  const dest = path.join(OUT_DIR, e.file);
  fs.writeFileSync(dest, out, 'utf8');
  console.log(`  ✓ wrote ${e.file} (${out.length} bytes)`);
}

console.log(allOk ? '\nAll experience pages generated.\n' : '\nGeneration completed WITH ERRORS — see above.\n');
process.exit(allOk ? 0 : 1);
