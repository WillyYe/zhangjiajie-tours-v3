// Data-driven generator for first-level (module hub) pages.
// Usage: node scripts/build-module-index.mjs
// Reads templates/module-index.html + module-index-data.mjs, emits one page
// per module (attractions/index.html, experiences/index.html, ...).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { modules, SITE_BASE } from '../module-index-data.mjs';
import { siteNav } from '../home-data.mjs';
import { applyNav } from '../admin/modules/nav-render.js';
import { applyIndexNav, buildIndexNav } from './index-nav.mjs';
import { hotelCategories } from '../hotels-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'templates', 'module-index.html');

const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const tpl = fs.readFileSync(TEMPLATE, 'utf8');

function cardHtml(c) {
  const meta = (c.date && c.readingTime)
    ? `<p class="text-gold-dark text-xs font-bold uppercase tracking-[0.15em] mb-2">${c.date} · ${c.readingTime}</p>`
    : `<p class="module-tag">${esc(c.tag)}</p>`;
  const tags = Array.isArray(c.tags) && c.tags.length
    ? `<div>${c.tags.map(t => `<span class="module-tag">${esc(t)}</span>`).join(' ')}</div>`
    : '';
  return `        <a href="${c.href}" class="card-hover group block bg-white rounded-2xl overflow-hidden border border-sand-dark">
          <div class="overflow-hidden"><img loading="lazy" decoding="async" class="w-full h-52 object-cover transition-transform duration-500 group-hover:scale-105" src="../images/${c.img}" alt="${esc(c.alt)}"></div>
          <div class="p-6">
            ${meta}
            <h3 class="font-display text-xl text-forest mb-2 leading-snug">${esc(c.title)}</h3>
            <p class="text-sm text-stone-600 leading-relaxed mb-4">${esc(c.desc)}</p>${tags ? '\n            ' + tags : ''}
          </div>
        </a>`;
}

function itemListJson(m) {
  return m.cards.map((c, i) => {
    let url;
    if (c.href.startsWith('./')) {
      const dir = m.canonical.replace(/\/index\.html$/, '/');
      url = dir + c.href.slice(2);
    } else if (c.href.startsWith('../#')) {
      url = SITE_BASE + c.href.slice(3);
    } else if (/^https?:/i.test(c.href)) {
      url = c.href;
    } else {
      url = SITE_BASE;
    }
    return `    {
      "@type": "ListItem",
      "position": ${i + 1},
      "name": ${JSON.stringify(c.title)},
      "url": ${JSON.stringify(url)}
    }`;
  }).join(',\n');
}

let allOk = true;

for (const m of modules) {
  // ---- image existence validation ----
  const imgs = [m.heroImg, ...m.cards.map((c) => c.img)];
  const missing = imgs.filter((img) => !fs.existsSync(path.join(ROOT, 'images', img)));
  if (missing.length) {
    console.error(`✗ [${m.slug}] missing images on disk: ${missing.join(', ')}`);
    allOk = false;
    continue;
  }

  const cards = m.cards.map(cardHtml).join('\n');
  const itemList = itemListJson(m);

  let out = tpl;
  const map = {
    '{{PAGE_TITLE}}': m.title,
    '{{META_DESC}}': m.metaDesc,
    '{{CANONICAL}}': m.canonical,
    '{{HERO_IMG}}': m.heroImg,
    '{{HERO_IMG_ALT}}': m.heroImgAlt,
    '{{BREADCRUMB}}': m.breadcrumb,
    '{{HERO_EYEBROW}}': m.heroEyebrow,
    '{{H1}}': m.h1,
    '{{HERO_DESC}}': m.heroDesc,
    '{{INTRO}}': m.intro,
    '{{GRID_TITLE}}': m.gridTitle,
    '{{GRID_INTRO}}': m.gridIntro,
    '{{CARDS}}': cards,
    '{{ITEMLIST}}': itemList
  };
  for (const [k, v] of Object.entries(map)) {
    if (!out.includes(k)) { console.error(`✗ [${m.slug}] placeholder ${k} not found in template`); allOk = false; }
    out = out.split(k).join(v);
  }

  // Data-driven nav (single source = siteNav; skip hidden items like Plan/Food).
  out = applyNav(out, siteNav, '../');
  out = applyIndexNav(out, buildIndexNav(hotelCategories, '../'));

  // Mark the current module's top-level nav link as active + expose it to
  // assistive tech via aria-current="page". Exactly one top-level link should
  // carry it per page (mega-link sub-items are excluded by the test's :not()).
  // Skip when the module's nav item is hidden (Plan/Food): there is no link to
  // mark, and the page is intentionally unreachable from the nav — not an error.
  {
    const navItem = siteNav.items.find((it) => it.url === `${m.slug}/index.html`);
    if (navItem && navItem.hidden) {
      // hidden module: no nav link to mark active
    } else {
      const activeHref = `../${m.slug}/index.html`;
      const re = new RegExp(`(<a href="${activeHref}"[^>]*class="nav-link)([^"]*)(")`);
      if (re.test(out)) {
        out = out.replace(re, `$1 active$2" aria-current="page"`);
      } else {
        console.error(`✗ [${m.slug}] active nav link ${activeHref} not found — aria-current not injected`);
        allOk = false;
      }
    }
  }

  const leftovers = out.match(/\{\{[A-Z_]+\}\}/g);
  if (leftovers) {
    console.error(`✗ [${m.slug}] leftover placeholders: ${[...new Set(leftovers)].join(', ')}`);
    allOk = false;
    continue;
  }

  const outPath = path.join(ROOT, m.file);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, out, 'utf8');
  console.log(`✓ [${m.slug}] -> ${m.file}  (${m.cards.length} cards)`);
}

if (!allOk) {
  console.error('\nGenerator finished with errors.');
  process.exit(1);
}
console.log('\nAll first-level module pages generated.');
