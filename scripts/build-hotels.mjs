// zhangjiajie-tours-v3 — Hotel module generator
// Reads templates/hotel-category.html + hotels-data.mjs and writes:
//   hotels/<slug>.html  (4 category pages); no hub — categories are first-level.
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
// slug 指定 → 落到该酒店物理隔离目录 images/<slug>/；否则回退根目录（兜底）
const imgSrc = (n, slug) => '../images/' + (slug ? slug + '/' : '') + imgName(n);
// 分类 hero 图复用某家酒店的 img，据此反查其 slug 以便解析到 images/<slug>/
// 优先按 hotels[k].img 精确匹配；匹配不到时（hero 图可能与某酒店主图不同名）按文件名前缀 hotel-<slug>- 推断
const heroSlugFor = (cat) => {
  const byImg = Object.keys(hotels).find((k) => hotels[k] && hotels[k].img === cat.heroImg);
  if (byImg) return byImg;
  const m = /^hotel-([a-z0-9-]+)-/.exec(cat.heroImg || '');
  return m ? m[1] : null;
};

const ACTIVE = 'text-forest font-bold';
const NORMAL = '';

function hotelCard(h, slug) {
  const feats = h.features.map((f) =>
    `<li class="flex items-start gap-2 text-sm text-stone-600"><span class="text-gold-dark mt-0.5">✓</span><span>${escHtml(f)}</span></li>`
  ).join('');
  return `          <article class="card-hover group bg-white rounded-2xl overflow-hidden border border-sand-dark flex flex-col">
            <div class="overflow-hidden h-56">
              <img loading="lazy" decoding="async" src="${imgSrc(h.img, slug)}" alt="${escAttr(h.alt)}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
            </div>
            <div class="p-6 flex flex-col flex-1">
              <div class="flex items-start justify-between gap-3 mb-1">
                <h3 class="font-display text-xl text-forest leading-snug">${escHtml(h.name)}</h3>
                <span class="shrink-0 text-xs font-semibold text-gold-dark bg-gold/10 px-2.5 py-1 rounded-full whitespace-nowrap">${escAttr(h.tier)}</span>
              </div>
              <p class="text-gold-dark text-xs font-semibold uppercase tracking-wide mb-2">${escAttr(h.zh)} · ${escAttr(h.area)}</p>
              <p class="text-sm text-stone-600 leading-relaxed mb-4 flex-1">${escHtml(h.blurb)}</p>
              <ul class="space-y-1.5 mb-5">${feats}</ul>
              <a href="mailto:zjjpark@outlook.com" class="mt-auto inline-flex items-center justify-center gap-2 bg-forest hover:bg-forest-light text-white font-semibold px-5 py-3 rounded-full transition-colors">Ask about ${escAttr(h.name)} →</a>
            </div>
          </article>`;
}

function categoryBody(cat) {
  const cards = cat.hotels.filter((id) => hotels[id] && !hotels[id].hidden).map((id) => hotelCard(hotels[id], id)).join('\n');
  const main = `  <!-- ========== Stays in this category ========== -->
  <section class="py-16 lg:py-20 px-6">
    <div class="max-w-[1400px] mx-auto">
      <h2 class="font-display text-3xl md:text-4xl text-forest mb-3">Our ${escHtml(cat.title.toLowerCase())}</h2>
      <p class="text-stone-600 mb-10 max-w-2xl">${escHtml(cat.bodyIntro)}</p>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 fade-in">
${cards}
      </div>
    </div>
  </section>`;
  return main + '\n' + faqSection(HOTEL_FAQ) + '\n' + relatedSection(hotelCategories, cat, 'Other ways to browse hotels');
}

function categoryCard(cat) {
  return `          <a href="${cat.slug}.html" class="card-hover group block bg-white rounded-2xl overflow-hidden border border-sand-dark">
            <div class="overflow-hidden"><img loading="lazy" decoding="async" class="w-full h-52 object-cover transition-transform duration-500 group-hover:scale-105" src="${imgSrc(cat.heroImg, heroSlugFor(cat))}" alt="${escAttr(cat.heroAlt)}"></div>
            <div class="p-6">
              <p class="module-tag">${escAttr(cat.tag)}</p>
              <h3 class="font-display text-xl text-forest mb-2 leading-snug">${escHtml(cat.title)}</h3>
              <p class="text-sm text-stone-600 leading-relaxed">${escHtml(cat.hubDesc)}</p>
            </div>
          </a>`;
}

const HOTEL_FAQ = [
  ['Which area should I stay in?', 'Wulingyuan puts you minutes from the park gates — best for early sunrise starts. Zhangjiajie city (Yongding) is better for the train station, airport and Tianmen Mountain.'],
  ['Do you book hotels for me?', 'We don’t take payment, but message us by email and we’ll recommend and help reserve the right stay for your dates — free, no obligation.'],
  ['What’s the price range?', 'From around ¥130/night at value stays to ¥600+ at scenic-view and international hotels. Peak season (May–Oct and holidays) books out early — reserve ahead.'],
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
  const cards = cats.filter((c) => !c.hidden && c.slug !== current.slug).map(relatedCard).join('\n');
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

function validateImage(n, slug) {
  const p = path.join(IMAGES_DIR, slug || '', imgName(n));
  if (!fs.existsSync(p)) { console.error('  ✗ missing image: ' + (slug ? slug + '/' : '') + imgName(n)); process.exitCode = 1; return false; }
  return true;
}

// ---------- main ----------
const tpl = fs.readFileSync(TEMPLATE, 'utf8');
fs.mkdirSync(OUT_DIR, { recursive: true });
const base = 'https://willyye.github.io/zhangjiajie-tours-v3';

// category pages
for (const cat of hotelCategories) {
  if (cat.hidden) {
    // 隐藏分类：删除其已生成的页面，彻底从站点移除
    const stale = path.join(OUT_DIR, cat.slug + '.html');
    if (fs.existsSync(stale)) { fs.unlinkSync(stale); console.log(`  ✓ removed hidden hotels/${cat.slug}.html`); }
    continue;
  }
  const heroSlug = heroSlugFor(cat);
  if (!validateImage(cat.heroImg, heroSlug)) continue;
  const visibleIds = cat.hotels.filter((id) => hotels[id] && !hotels[id].hidden);
  visibleIds.forEach((id) => validateImage(hotels[id].img, id));

  const body = categoryBody(cat);
  const jsonLd = itemListJsonLd(visibleIds.map((id) => ({
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
    HERO_IMG: imgSrc(cat.heroImg, heroSlug),
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

// No hub page generated — categories are first-level.

process.exit(process.exitCode || 0);
