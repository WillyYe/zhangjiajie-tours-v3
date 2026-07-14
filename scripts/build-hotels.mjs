// zhangjiajie-tours-v3 — Hotel module generator
// Reads templates/hotel-category.html + hotels-data.mjs and writes:
//   hotels/<slug>.html  (4 category pages)  +  hotels/index.html (hub)
// Run: node scripts/build-hotels.mjs   (from project root)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hotels, hotelCategories } from '../hotels-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'templates', 'hotel-category.html');
const OUT_DIR = path.join(ROOT, 'hotels');
const IMAGES_DIR = path.join(ROOT, 'images');

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const imgName = (n) => (/\.(webp|jpg|jpeg|avif|png)$/i.test(n) ? n : n + '.webp');
const imgSrc = (n) => '../images/' + imgName(n);

const ACTIVE = 'class="active  text-sm font-bold text-stone hover:text-forest px-4 h-full flex items-center" aria-current="page"';
const NORMAL = 'class="nav-link text-sm font-semibold text-stone hover:text-forest px-4 h-full flex items-center"';

function hotelCard(h) {
  const feats = h.features.map((f) =>
    `<li class="flex items-start gap-2 text-sm text-stone-600"><span class="text-gold-dark mt-0.5">✓</span><span>${escHtml(f)}</span></li>`
  ).join('');
  return `          <article class="card-hover group bg-white rounded-2xl overflow-hidden border border-sand-dark flex flex-col">
            <div class="overflow-hidden h-56">
              <img loading="lazy" decoding="async" src="${imgSrc(h.img)}" alt="${escAttr(h.alt)}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
            </div>
            <div class="p-6 flex flex-col flex-1">
              <div class="flex items-start justify-between gap-3 mb-1">
                <h3 class="font-display text-xl text-forest leading-snug">${escHtml(h.name)}</h3>
                <span class="shrink-0 text-xs font-semibold text-gold-dark bg-gold/10 px-2.5 py-1 rounded-full whitespace-nowrap">${escAttr(h.tier)}</span>
              </div>
              <p class="text-gold-dark text-xs font-semibold uppercase tracking-wide mb-2">${escAttr(h.zh)} · ${escAttr(h.area)}</p>
              <p class="text-sm text-stone-600 leading-relaxed mb-4 flex-1">${escHtml(h.blurb)}</p>
              <ul class="space-y-1.5 mb-5">${feats}</ul>
              <a href="https://wa.me/8618777358302" target="_blank" rel="noopener noreferrer" class="mt-auto inline-flex items-center justify-center gap-2 bg-forest hover:bg-forest-light text-white font-semibold px-5 py-3 rounded-full transition-colors">Ask about ${escAttr(h.name)} →</a>
            </div>
          </article>`;
}

function categoryBody(cat) {
  const cards = cat.hotels.map((id) => hotelCard(hotels[id])).join('\n');
  return `  <!-- ========== Stays in this category ========== -->
  <section class="py-16 lg:py-20 px-6">
    <div class="max-w-[1400px] mx-auto">
      <h2 class="font-display text-3xl md:text-4xl text-forest mb-3">Our ${escHtml(cat.title.toLowerCase())}</h2>
      <p class="text-stone-600 mb-10 max-w-2xl">${escHtml(cat.bodyIntro)}</p>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 fade-in">
${cards}
      </div>
    </div>
  </section>`;
}

function categoryCard(cat) {
  return `          <a href="${cat.slug}.html" class="card-hover group block bg-white rounded-2xl overflow-hidden border border-sand-dark">
            <div class="overflow-hidden"><img loading="lazy" decoding="async" class="w-full h-52 object-cover transition-transform duration-500 group-hover:scale-105" src="${imgSrc(cat.heroImg)}" alt="${escAttr(cat.heroAlt)}"></div>
            <div class="p-6">
              <p class="module-tag">${escAttr(cat.tag)}</p>
              <h3 class="font-display text-xl text-forest mb-2 leading-snug">${escHtml(cat.title)}</h3>
              <p class="text-sm text-stone-600 leading-relaxed mb-4">${escHtml(cat.hubDesc)}</p>
              <span class="text-forest font-semibold text-sm">View stays →</span>
            </div>
          </a>`;
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

// category pages
for (const cat of hotelCategories) {
  if (!validateImage(cat.heroImg)) continue;
  cat.hotels.forEach((id) => validateImage(hotels[id].img));

  const body = categoryBody(cat);
  const jsonLd = itemListJsonLd(cat.hotels.map((id) => ({
    name: hotels[id].name,
    url: `${base}/hotels/${cat.slug}.html#${id}`,
  })));

  const html = fill(tpl, {
    TITLE: escHtml(`${cat.title} in Zhangjiajie | Visit Zhangjiajie`),
    META_DESC: escAttr(cat.metaDesc),
    CANONICAL: `${base}/hotels/${cat.slug}.html`,
    HOTEL_NAV: ACTIVE,
    FOOD_NAV: NORMAL,
    BREADCRUMB: escHtml(cat.title),
    HERO_IMG: imgSrc(cat.heroImg),
    HERO_ALT: escAttr(cat.heroAlt),
    HERO_TAG: escHtml(cat.heroTag),
    H1: escHtml(cat.h1),
    SUBTITLE: escHtml(cat.subtitle),
    INTRO_TEXT: escHtml(cat.intro),
    BODY: body,
    JSONLD: JSON.stringify(jsonLd, null, 2),
  });

  const dest = path.join(OUT_DIR, cat.slug + '.html');
  fs.writeFileSync(dest, html, 'utf8');
  console.log(`  ✓ wrote hotels/${cat.slug}.html (${html.length} bytes)`);
}

// hub page (hotels/index.html)
{
  if (!validateImage('gallery-painting')) { /* still write */ }
  const cards = hotelCategories.map(categoryCard).join('\n');
  const body = `  <!-- ========== Hotels by type ========== -->
  <section class="py-16 lg:py-20 px-6">
    <div class="max-w-[1400px] mx-auto">
      <h2 class="font-display text-3xl md:text-4xl text-forest mb-3">Hotels by type</h2>
      <p class="text-stone-600 mb-10 max-w-2xl">Where you sleep shapes your park days. We’ve grouped our recommended stays by what matters most — scenery, comfort, value, or a central city base.</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 fade-in">
${cards}
      </div>
      <div class="mt-12 text-center">
        <a href="https://wa.me/8618777358302" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 bg-forest hover:bg-forest-light text-white font-semibold px-7 py-3.5 rounded-full transition-colors duration-300">Not sure which fits? Message us →</a>
      </div>
    </div>
  </section>`;

  const jsonLd = itemListJsonLd(hotelCategories.map((c) => ({
    name: c.title,
    url: `${base}/hotels/${c.slug}.html`,
  })));

  const html = fill(tpl, {
    TITLE: 'Where to Stay in Zhangjiajie | Visit Zhangjiajie',
    META_DESC: 'How to choose where to stay in Zhangjiajie — mountain lodges, curated stays, great-value hotels, and city bases, picked by local experts.',
    CANONICAL: `${base}/hotels/index.html`,
    HOTEL_NAV: ACTIVE,
    FOOD_NAV: NORMAL,
    BREADCRUMB: '',
    HERO_IMG: imgSrc('gallery-painting'),
    HERO_ALT: 'Scenic hotel terrace with valley view',
    HERO_TAG: 'Where to stay',
    H1: 'Where to Stay in Zhangjiajie',
    SUBTITLE: 'Base yourself inside Wulingyuan for sunrise at the gates, or in Zhangjiajie city for transport links — here’s how to choose, with our picked stays.',
    INTRO_TEXT: 'Where you sleep shapes your park days. Staying inside Wulingyuan puts you minutes from the gates; the city is better for trains and flights. We’ve grouped our recommended stays by what matters most to you.',
    BODY: body,
    JSONLD: JSON.stringify(jsonLd, null, 2),
  });

  const dest = path.join(OUT_DIR, 'index.html');
  fs.writeFileSync(dest, html, 'utf8');
  console.log(`  ✓ wrote hotels/index.html (${html.length} bytes)`);
}

console.log('\nHotel module generated.\n');
process.exit(process.exitCode || 0);
