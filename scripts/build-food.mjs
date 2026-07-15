// zhangjiajie-tours-v3 — Food module generator
// Reads templates/hotel-category.html (reused) + food-data.mjs and writes:
//   food/<slug>.html  (5 category pages); no hub — categories are first-level.
// Run: node scripts/build-food.mjs   (from project root)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { foodCategories } from '../food-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'templates', 'hotel-category.html');
const OUT_DIR = path.join(ROOT, 'food');
const IMAGES_DIR = path.join(ROOT, 'images');

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const imgName = (n) => (/\.(webp|jpg|jpeg|avif|png)$/i.test(n) ? n : n + '.webp');
const imgSrc = (n) => '../images/' + imgName(n);

const ACTIVE = 'text-forest font-bold';
const NORMAL = '';

function dishCard(d) {
  return `          <article class="card-hover group bg-white rounded-2xl overflow-hidden border border-sand-dark flex flex-col">
            <div class="overflow-hidden h-52">
              <img loading="lazy" decoding="async" src="${imgSrc(d.img)}" alt="${escAttr(d.name + ' — ' + d.zh)}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
            </div>
            <div class="p-6 flex-1">
              <h3 class="font-display text-lg text-forest mb-1 leading-snug">${escHtml(d.name)}</h3>
              <p class="text-gold-dark text-xs font-semibold uppercase tracking-wide mb-2">${escAttr(d.zh)}</p>
              <p class="text-sm text-stone-600 leading-relaxed">${escHtml(d.desc)}</p>
            </div>
          </article>`;
}

function restaurantCard(r, fallbackImg) {
  const img = r.img ? imgSrc(r.img) : imgSrc(fallbackImg);
  const alt = r.img ? `${escAttr(r.name)} — ${escAttr(r.zh)}` : `${escAttr(r.zh)} restaurant in Zhangjiajie`;
  return `          <article class="card-hover group bg-white rounded-2xl overflow-hidden border border-sand-dark flex flex-col">
            <div class="overflow-hidden h-52">
              <img loading="lazy" decoding="async" src="${img}" alt="${alt}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
            </div>
            <div class="p-6 flex flex-col flex-1">
              <div class="flex items-start justify-between gap-3 mb-1">
                <h3 class="font-display text-lg text-forest leading-snug">${escHtml(r.name)}</h3>
                <span class="shrink-0 text-xs font-semibold text-gold-dark bg-gold/10 px-2.5 py-1 rounded-full whitespace-nowrap">${escAttr(r.price)}</span>
              </div>
              <p class="text-gold-dark text-xs font-semibold uppercase tracking-wide mb-2">${escAttr(r.zh)} · ${escAttr(r.cuisine)}</p>
              <ul class="text-sm text-stone-600 leading-relaxed space-y-1 mb-4 flex-1">
                <li><span class="text-forest font-medium">Try:</span> ${escHtml(r.signature)}</li>
                <li><span class="text-forest font-medium">Where:</span> ${escHtml(r.area)}</li>
              </ul>
              <a href="https://wa.me/8618777358302" target="_blank" rel="noopener noreferrer" class="mt-auto inline-flex items-center justify-center gap-2 bg-forest hover:bg-forest-light text-white font-semibold px-5 py-2.5 rounded-full transition-colors text-sm">Ask us to book →</a>
            </div>
          </article>`;
}

function categoryBody(cat) {
  const cards = (cat.type === 'dishes'
    ? cat.dishes.map(dishCard)
    : cat.restaurants.map((r) => restaurantCard(r, cat.heroImg))).join('\n');
  const main = `  <!-- ========== Items in this category ========== -->
  <section class="py-16 lg:py-20 px-6">
    <div class="max-w-[1400px] mx-auto">
      <h2 class="font-display text-3xl md:text-4xl text-forest mb-3">${escHtml(cat.bodyIntro)}</h2>
      <p class="text-stone-600 mb-10 max-w-2xl">${escHtml(cat.intro)}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 fade-in">
${cards}
      </div>
    </div>
  </section>`;
  return main + '\n' + faqSection(FOOD_FAQ) + '\n' + relatedSection(foodCategories, cat, 'Other ways to browse food');
}

function categoryCard(cat) {
  return `          <a href="${cat.slug}.html" class="card-hover group block bg-white rounded-2xl overflow-hidden border border-sand-dark">
            <div class="overflow-hidden"><img loading="lazy" decoding="async" class="w-full h-52 object-cover transition-transform duration-500 group-hover:scale-105" src="${imgSrc(cat.heroImg)}" alt="${escAttr(cat.heroAlt)}"></div>
            <div class="p-6">
              <p class="module-tag">${escAttr(cat.tag)}</p>
              <h3 class="font-display text-xl text-forest mb-2 leading-snug">${escHtml(cat.title)}</h3>
              <p class="text-sm text-stone-600 leading-relaxed">${escHtml(cat.hubDesc)}</p>
            </div>
          </a>`;
}

const FOOD_FAQ = [
  ['What’s the one dish to try?', 'Sanxia Guo (three-pot stew) — smoked pork, tripe and tofu in a dry chilli pot. It’s Zhangjiajie’s signature and on nearly every local table.'],
  ['Is the food very spicy?', 'Hunan cooking is chilli-forward, but most kitchens adjust the heat if you ask. Say “wee-spicy” (微辣) for mild.'],
  ['Do restaurants have English menus?', 'The top-rated spots do, or we can translate and even help book on WhatsApp before you go.'],
];

function faqSection(items) {
  const cards = items.map(([q, a]) => `          <div class="bg-white rounded-2xl border border-sand-dark p-6 md:p-7 fade-in">
            <h3 class="font-display text-lg md:text-xl text-forest mb-2">${escHtml(q)}</h3>
            <p class="text-stone/80 leading-relaxed text-sm md:text-base">${escHtml(a)}</p>
          </div>`).join('\n');
  return `  <!-- ========== FAQ ========== -->
  <section class="max-w-[1400px] mx-auto px-6 pb-16">
    <h2 class="font-display text-2xl md:text-3xl text-forest mb-6">Frequently asked questions</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
${cards}
    </div>
  </section>`;
}

function relatedCard(cat) {
  return `          <a href="${cat.slug}.html" class="card-hover group block bg-white rounded-2xl overflow-hidden border border-sand-dark">
            <div class="p-6">
              <p class="text-xs font-semibold uppercase tracking-wide text-gold-dark mb-1">${escAttr(cat.tag)}</p>
              <h3 class="font-display text-lg text-forest group-hover:text-gold-dark transition-colors">${escHtml(cat.title)}</h3>
              <p class="text-sm text-stone-600 mt-1">${escHtml(cat.hubDesc)}</p>
            </div>
          </a>`;
}

function relatedSection(cats, current, label) {
  const cards = cats.filter((c) => c.slug !== current.slug).map(relatedCard).join('\n');
  return `  <!-- ========== Related categories ========== -->
  <section class="max-w-[1400px] mx-auto px-6 pb-20">
    <h2 class="font-display text-2xl md:text-3xl text-forest mb-6">${escHtml(label)}</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
${cards}
    </div>
  </section>`;
}

function itemListJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: it.url })),
  };
}

function fill(tpl, map) {
  let out = tpl;
  for (const [k, v] of Object.entries(map)) out = out.split(`{{${k}}}`).join(v);
  const leftovers = [...out.matchAll(/\{\{[A-Z_]+\}\}/g)].map((m) => m[0]);
  if (leftovers.length) { console.error('  ✗ leftover placeholders: ' + [...new Set(leftovers)].join(', ')); process.exitCode = 1; }
  return out;
}

function validateImage(n) {
  const p = path.join(IMAGES_DIR, imgName(n));
  if (!fs.existsSync(p)) { console.error('  ✗ missing image: ' + imgName(n)); process.exitCode = 1; return false; }
  return true;
}

// ---------- main ----------
const tpl = fs.readFileSync(TEMPLATE, 'utf8');
fs.mkdirSync(OUT_DIR, { recursive: true });
const base = 'https://willyye.github.io/zhangjiajie-tours-v3';

for (const cat of foodCategories) {
  if (!validateImage(cat.heroImg)) continue;
  if (cat.type === 'dishes') cat.dishes.forEach((d) => validateImage(d.img));

  const body = categoryBody(cat);
  const items = (cat.type === 'dishes' ? cat.dishes : cat.restaurants).map((x) => ({
    name: x.name, url: `${base}/food/${cat.slug}.html`,
  }));

  const html = fill(tpl, {
    TITLE: escHtml(`${cat.title} in Zhangjiajie | Visit Zhangjiajie`),
    META_DESC: escAttr(cat.metaDesc),
    CANONICAL: `${base}/food/${cat.slug}.html`,
    HOTEL_NAV: NORMAL,
    FOOD_NAV: ACTIVE,
    BREADCRUMB: escHtml(cat.title),
    HERO_IMG: imgSrc(cat.heroImg),
    HERO_ALT: escAttr(cat.heroAlt),
    HERO_TAG: escHtml(cat.heroTag),
    H1: escHtml(cat.h1),
    SUBTITLE: escHtml(cat.subtitle),
    INTRO_TEXT: escHtml(cat.intro),
    BODY: body,
    JSONLD: JSON.stringify(itemListJsonLd(items), null, 2),
  });

  const dest = path.join(OUT_DIR, cat.slug + '.html');
  fs.writeFileSync(dest, html, 'utf8');
  console.log(`  ✓ wrote food/${cat.slug}.html (${html.length} bytes)`);
}

// No hub page generated — categories are first-level.

process.exit(process.exitCode || 0);
