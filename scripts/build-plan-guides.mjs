// zhangjiajie-tours-v3 — Plan Like a Local / Travel Guides detail-page generator.
// Reads templates/guide-page.html + plan-guides-data.mjs and writes one
// fully-populated HTML file per guide into plan/.
//
// Design rules (100分 proven from attractions detail pages):
//  - Heading ladder: h1 (page) -> h2 (section) -> h3 (sub-section). No skips.
//  - Every <img> carries alt + loading="lazy" (hero exempt via fetchpriority=high).
//  - JSON-LD emitted via JSON.stringify.
//  - Referenced images validated against images/ before writing.
// Run: node scripts/build-plan-guides.mjs   (from project root)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { planGuides } from '../plan-guides-data.mjs';
import { siteNav } from '../home-data.mjs';
import { applyNav } from '../admin/modules/nav-render.js';
import { applyIndexNav, buildIndexNav } from './index-nav.mjs';
import { hotelCategories } from '../hotels-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'templates', 'guide-page.html');
const OUT_DIR = path.join(ROOT, 'plan');
const IMAGES_DIR = path.join(ROOT, 'images');

// ---------- escaping helpers ----------
const escAttr = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function imgSrc(name) {
  let n = String(name);
  if (!/\.(webp|jpg|jpeg|avif|png)$/i.test(n)) n += '.webp';
  return '../images/plan/' + n;
}

// ---------- block builders ----------
function buildBlocks(guide, allGuides) {
  const relatedMap = new Map(allGuides.map(g => [g.slug, g]));
  return guide.blocks.map((b) => {
    switch (b.type) {
      case 'p':
        return `          <p>${b.text}</p>`;
      case 'h2':
        return `          <h2>${escHtml(b.text)}</h2>`;
      case 'h3':
        return `          <h3>${escHtml(b.text)}</h3>`;
      case 'ul':
        return `          <ul>\n${b.items.map(i => `            <li>${i}</li>`).join('\n')}\n          </ul>`;
      case 'ol':
        return `          <ol>\n${b.items.map(i => `            <li>${i}</li>`).join('\n')}\n          </ol>`;
      case 'quote':
        return `          <blockquote>\n            ${escHtml(b.text)}\n            <cite>— ${escHtml(b.cite)}</cite>\n          </blockquote>`;
      case 'callout':
        return `          <div class="callout">\n            <p class="callout-title">${escHtml(b.title)}</p>\n            <p>${b.text}</p>\n          </div>`;
      case 'image':
        return `          <figure>\n            <img loading="lazy" decoding="async" src="${imgSrc(b.img)}" alt="${escAttr(b.alt)}" class="w-full">\n            <figcaption>${escHtml(b.caption)}</figcaption>\n          </figure>`;
      default:
        throw new Error(`Unknown block type "${b.type}" in ${guide.slug}`);
    }
  }).join('\n');
}

function buildTags(guide) {
  return guide.tags.map(t => `<span class="guide-tag">${escHtml(t)}</span>`).join(' ');
}

function buildRelated(guide, allGuides) {
  const relatedMap = new Map(allGuides.map(g => [g.slug, g]));
  const related = guide.related
    .map(slug => relatedMap.get(slug))
    .filter(Boolean);
  if (!related.length) return '';
  return related.map(r => `        <a href="./${r.slug}.html" class="card-hover group block bg-white rounded-2xl overflow-hidden border border-sand-dark">
          <div class="overflow-hidden"><img loading="lazy" decoding="async" class="w-full h-52 object-cover transition-transform duration-500 group-hover:scale-105" src="${imgSrc(r.coverImage)}" alt="${escAttr(r.coverAlt || r.title)}"></div>
          <div class="p-6">
            <p class="text-gold-dark text-xs font-bold uppercase tracking-[0.15em] mb-2">${r.date} · ${r.readingTime}</p>
            <h3 class="font-display text-xl text-river mb-2 leading-snug">${escHtml(r.title)}</h3>
            <p class="text-sm text-stone-600 leading-relaxed mb-4">${escHtml(r.excerpt)}</p>
            <div>${r.tags.map(t => `<span class="guide-tag">${escHtml(t)}</span>`).join(' ')}</div>
          </div>
        </a>`).join('\n');
}

// ---------- JSON-LD (Article + BreadcrumbList) ----------
function buildJsonLd(guide) {
  const base = 'https://willyye.github.io/zhangjiajie-tours-v3';
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: guide.title,
        description: guide.excerpt,
        image: base + '/' + imgSrc(guide.coverImage).replace(/^\.\.\//, ''),
        author: { '@type': 'Organization', name: guide.author },
        publisher: { '@type': 'Organization', name: 'Visit Zhangjiajie', logo: { '@type': 'ImageObject', url: base + '/favicon.svg' } },
        datePublished: guide.date,
        dateModified: guide.date,
        mainEntityOfPage: { '@type': 'WebPage', '@id': guide.canonical || (base + '/plan/' + guide.slug + '.html') },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: base + '/' },
          { '@type': 'ListItem', position: 2, name: 'Plan Like a Local', item: base + '/plan/' },
          { '@type': 'ListItem', position: 3, name: guide.title, item: guide.canonical || (base + '/plan/' + guide.slug + '.html') },
        ],
      },
    ],
  };
}

// ---------- image-existence validation ----------
function collectImages(guide) {
  const names = [guide.coverImage];
  for (const b of guide.blocks) {
    if (b.type === 'image') names.push(b.img);
  }
  // related slugs → resolve cover images
  const guideMap = new Map(planGuides.map(g => [g.slug, g]));
  for (const slug of guide.related) {
    const r = guideMap.get(slug);
    if (r && r.coverImage) names.push(r.coverImage);
  }
  return [...new Set(names)].map((n) => imgSrc(n)).map(p => p.replace('../', ''));
}
function validateImages(guide) {
  const missing = collectImages(guide).filter(rel => !fs.existsSync(path.join(ROOT, rel)));
  if (missing.length) {
    console.error(`  ✗ [${guide.slug}] missing images: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

// ---------- main ----------
const template = fs.readFileSync(TEMPLATE, 'utf8');
fs.mkdirSync(OUT_DIR, { recursive: true });

let allOk = true;
for (const guide of planGuides) {
  if (!validateImages(guide)) { allOk = false; continue; }

  const articleBody = buildBlocks(guide, planGuides);
  const tags = buildTags(guide);
  const related = buildRelated(guide, planGuides);
  const jsonLd = JSON.stringify(buildJsonLd(guide), null, 2);

  const map = {
    PAGE_TITLE: escHtml(guide.title) + ' | Visit Zhangjiajie',
    META_DESC: escAttr(guide.excerpt),
    CANONICAL: escAttr(guide.canonical || 'https://willyye.github.io/zhangjiajie-tours-v3/plan/' + guide.slug + '.html'),
    HERO_BG_IMG: escAttr(guide.coverImage + '.webp'),
    SELF_SLUG: escAttr(guide.slug),
    HERO_IMG: escAttr(guide.coverImage + '.webp'),
    HERO_IMG_ALT: escAttr(guide.coverAlt || guide.title),
    BREADCRUMB: escHtml(guide.breadcrumb || guide.title),
    H1: escHtml(guide.title),
    SUBTITLE: escHtml(guide.subtitle || 'Practical trip-planning advice from the Visit Zhangjiajie local team'),
    READING_TIME: escHtml(guide.readingTime),
    DATE: escHtml(guide.date),
    AUTHOR: escHtml(guide.author),
    TAGS: tags,
    ARTICLE_BODY: articleBody,
    RELATED: related,
    JSON_LD: jsonLd,
  };

  let out = template;
  for (const [k, v] of Object.entries(map)) {
    out = out.split(`{{${k}}}`).join(v);
  }

  // Guard: no leftover placeholders
  const leftovers = [...out.matchAll(/\{\{[A-Z_]+\}\}/g)].map(m => m[0]);
  if (leftovers.length) {
    console.error(`  ✗ [${guide.slug}] leftover placeholders: ${[...new Set(leftovers)].join(', ')}`);
    allOk = false;
    continue;
  }

  out = applyNav(out, siteNav, '../');
  out = applyIndexNav(out, buildIndexNav(hotelCategories, '../'));

  const dest = path.join(OUT_DIR, guide.slug + '.html');
  fs.writeFileSync(dest, out, 'utf8');
  console.log(`  ✓ wrote plan/${guide.slug}.html (${out.length} bytes)`);
}

console.log(allOk ? '\nAll plan guide pages generated.\n' : '\nGeneration completed WITH ERRORS — see above.\n');
process.exit(allOk ? 0 : 1);
