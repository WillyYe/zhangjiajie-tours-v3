// zhangjiajie-tours-v3 — Tour Packages generator
// Reads templates/tour-hub.html + tours-data.mjs and writes:
//   tours/index.html        (hub card grid)
//   tours/<slug>.html       (per-package detail page)
// Run: node scripts/build-tours.mjs   (from project root)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { tours } from '../tours-data.mjs';
import { siteNav } from '../home-data.mjs';
import { hotelCategories } from '../hotels-data.mjs';
import { applyNav } from '../admin/modules/nav-render.js';
import { applyIndexNav, buildIndexNav } from './index-nav.mjs';
import { buildToursHubHtml, tourDetailMap, fillTourDetail, listTourImages } from '../admin/modules/tours-render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATE_HUB = path.join(ROOT, 'templates', 'tour-hub.html');
const TEMPLATE_DETAIL = path.join(ROOT, 'templates', 'tour-detail.html');
const OUT_DIR = path.join(ROOT, 'tours');
const IMAGES_DIR = path.join(ROOT, 'images');
const base = 'https://willyye.github.io/zhangjiajie-tours-v3';

const imgName = (n) => (/\.(webp|jpg|jpeg|avif|png)$/i.test(n) ? n : n + '.webp');
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function fillHub(tpl, map) {
  let out = tpl;
  for (const [k, v] of Object.entries(map)) out = out.split(`{{${k}}}`).join(v);
  const leftovers = [...out.matchAll(/\{\{[A-Z_]+\}\}/g)].map((m) => m[0]);
  if (leftovers.length) { console.error('  ✗ hub leftover placeholders: ' + [...new Set(leftovers)].join(', ')); process.exitCode = 1; }
  return out;
}

function validateImage(n) {
  const p = path.join(IMAGES_DIR, 'tours', imgName(n));
  if (!fs.existsSync(p)) { console.error('  ✗ missing image: tours/' + imgName(n)); process.exitCode = 1; return false; }
  return true;
}

const tplHub = fs.readFileSync(TEMPLATE_HUB, 'utf8');
const tplDetail = fs.readFileSync(TEMPLATE_DETAIL, 'utf8');
fs.mkdirSync(OUT_DIR, { recursive: true });

const data = tours || { eyebrow: '', title: '', subtitle: '', items: [] };
const items = (data.items || []).filter((it) => !it.hidden);
let allOk = true;

// ---------- hub ----------
const hubHero = (items[0] && items[0].heroImg) || 'peaks-panorama';
if (!validateImage(hubHero)) allOk = false;
const hubJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.title, url: `${base}/tours/${it.slug}.html` })),
};
const hubHtml = fillHub(tplHub, {
  TITLE: escAttr(`${data.title} | Visit Zhangjiajie`),
  META_DESC: escAttr(data.subtitle),
  CANONICAL: `${base}/tours/index.html`,
  HERO_IMG: `../images/tours/${imgName(hubHero)}`,
  HERO_ALT: escAttr(`${data.title} hero`),
  HERO_TAG: escAttr(data.eyebrow || 'Tour Packages'),
  H1: escAttr(data.title),
  SUBTITLE: escAttr(data.subtitle),
  BREADCRUMB: 'Tours',
  INTRO_TEXT: escAttr(data.subtitle),
  // hub 页位于 tours/ 目录，卡片链接应为同目录 <slug>.html（而非 tours/<slug>.html）。
  // 后台预览端会在浏览器里把 "tours/" 重映射为 "../tours/"，这里对构建产物做相反的重映射。
  BODY: buildToursHubHtml(data).replace(/href="tours\//g, 'href="'),
  JSONLD: JSON.stringify(hubJsonLd, null, 2),
});
let out = applyNav(hubHtml, siteNav, '../');
out = applyIndexNav(out, buildIndexNav(hotelCategories, '../'));
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), out, 'utf8');
console.log(`  ✓ wrote tours/index.html (${out.length} bytes)`);

// ---------- detail pages ----------
const expectedSlugs = new Set(['index']);
const others = items.map((it) => ({ slug: it.slug, title: it.title, img: it.img }));

for (const it of items) {
  if (!it.heroImg) { console.error(`  ✗ skipped tours/${it.slug}.html (no heroImg)`); allOk = false; continue; }
  if (!validateImage(it.heroImg)) { allOk = false; continue; }
  if (!validateImage(it.img)) { allOk = false; continue; }
  (it.gallery || []).forEach((g) => validateImage(typeof g === 'string' ? g : g.img));

  const map = tourDetailMap(it, it.slug, others.filter((o) => o.slug !== it.slug));
  let html = fillTourDetail(tplDetail, map);

  const leftovers = [...html.matchAll(/\{\{[A-Z_]+\}\}/g)].map((m) => m[0]);
  if (leftovers.length) { console.error(`  ✗ [${it.slug}] leftover placeholders: ${[...new Set(leftovers)].join(', ')}`); process.exitCode = 1; allOk = false; continue; }

  html = applyNav(html, siteNav, '../');
  html = applyIndexNav(html, buildIndexNav(hotelCategories, '../'));
  fs.writeFileSync(path.join(OUT_DIR, it.slug + '.html'), html, 'utf8');
  console.log(`  ✓ wrote tours/${it.slug}.html (${html.length} bytes)`);
  expectedSlugs.add(it.slug);
}

// ---------- 孤儿页清理 ----------
for (const f of fs.readdirSync(OUT_DIR)) {
  if (!f.endsWith('.html')) continue;
  const slug = f.slice(0, -5);
  if (!expectedSlugs.has(slug)) {
    fs.unlinkSync(path.join(OUT_DIR, f));
    console.log(`  ✓ removed orphan tours/${f} (not in current data)`);
  }
}

console.log(allOk ? '\nAll tour pages generated.\n' : '\nGeneration completed WITH ERRORS — see above.\n');
process.exit(allOk ? 0 : 1);
