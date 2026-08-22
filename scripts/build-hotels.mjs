// zhangjiajie-tours-v3 — Hotel module generator
// Reads templates/hotel-category.html + hotels-data.mjs and writes:
//   hotels/<slug>.html  (4 category pages); no hub — categories are first-level.
// Run: node scripts/build-hotels.mjs   (from project root)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hotels, hotelCategories } from '../hotels-data.mjs';
import { hero as homeHero, topAttractions, welcome, siteNav } from '../home-data.mjs';
import { buildIndexNav, applyIndexNav } from './index-nav.mjs';
import { applyHome } from './build-home.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'templates', 'hotel-category.html');
const TEMPLATE_DETAIL = path.join(ROOT, 'templates', 'hotel-detail.html');
const OUT_DIR = path.join(ROOT, 'hotels');
const IMAGES_DIR = path.join(ROOT, 'images');
const base = 'https://willyye.github.io/zhangjiajie-tours-v3';

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
              <a href="${escAttr(slug)}.html" class="mt-auto inline-flex items-center justify-center gap-2 bg-forest hover:bg-forest-light text-white font-semibold px-5 py-3 rounded-full transition-colors">View ${escAttr(h.name)} →</a>
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
  return main + '\n' + faqSection(cat.faq) + '\n' + relatedSection(hotelCategories, cat, 'Other ways to browse hotels');
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

// FAQ 现在按分类存放在 hotelCategories[].faq（见 hotels-data.mjs），
// 每条 { q, a, qZh?, aZh? }；EN 必填，ZH 可选。cat.faq 为空则整段不渲染。

function faqSection(items) {
  if (!items || !items.length) return '';
  const cards = items.map((it) => {
    const zh = [];
    if (it.qZh) zh.push(`          <h4 class="font-display text-base text-stone-500 mt-3">${escHtml(it.qZh)}</h4>`);
    if (it.aZh) zh.push(`          <p class="text-stone/70 leading-relaxed text-sm md:text-base mt-1">${escHtml(it.aZh)}</p>`);
    const zhBlock = zh.length ? '\n' + zh.join('\n') : '';
    return `          <div class="bg-white rounded-2xl border border-sand-dark p-6 md:p-7 fade-in">
            <h3 class="font-display text-lg md:text-xl text-forest mb-2">${escHtml(it.q)}</h3>
            <p class="text-stone/80 leading-relaxed text-sm md:text-base">${escHtml(it.a)}</p>${zhBlock}
          </div>`;
  }).join('\n');
  return `  <!-- ========== FAQ ========== -->
  <section id="pv-faq" class="max-w-[1400px] mx-auto px-6 pb-16">
    <h2 class="font-display text-2xl md:text-3xl text-forest mb-6">Frequently asked questions</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
${cards}
    </div>
  </section>`;
}

function relatedCard(cat) {
  const desc = [escHtml(cat.cardBlurb || cat.hubDesc)];
  const zhDesc = cat.cardBlurbZh || cat.hubDescZh;
  if (zhDesc) desc.push(`<span class="block text-stone-500 mt-1">${escHtml(zhDesc)}</span>`);
  return `          <a href="${cat.slug}.html" class="card-hover group block bg-white rounded-2xl overflow-hidden border border-sand-dark">
            <div class="p-6">
              <p class="text-xs font-semibold uppercase tracking-wide text-gold-dark mb-1">${escAttr(cat.tag)}</p>
              <h3 class="font-display text-lg text-forest group-hover:text-gold-dark transition-colors">${escHtml(cat.title)}</h3>
              <p class="text-sm text-stone-600 mt-1">${desc.join('')}</p>
            </div>
          </a>`;
}

function relatedSection(cats, current, label) {
  const cards = cats.filter((c) => !c.hidden && c.slug !== current.slug).map(relatedCard).join('\n');
  return `  <!-- ========== Related categories ========== -->
  <section id="pv-other" class="max-w-[1400px] mx-auto px-6 pb-20">
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

// ---------- detail pages (3rd level) ----------
const tplDetail = fs.readFileSync(TEMPLATE_DETAIL, 'utf8');

function findCatOf(key) {
  return hotelCategories.find((c) => (c.hotels || []).includes(key));
}

function roomCard(r, slug) {
  const feats = (r.features || []).map((f) =>
    `<li class="flex gap-2"><span class="text-gold-dark">✓</span><span>${escHtml(f)}</span></li>`
  ).join('');
  const zh = r.nameZh
    ? `            <p class="text-gold-dark text-xs font-semibold uppercase tracking-wide mb-2">${escAttr(r.nameZh)}</p>\n`
    : '';
  return `        <article class="card-hover group bg-white rounded-2xl overflow-hidden border border-sand-dark flex flex-col">
          <div class="overflow-hidden h-56"><img loading="lazy" decoding="async" src="${imgSrc(r.img, slug)}" alt="${escAttr(r.alt || r.name)}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"></div>
          <div class="p-6 flex flex-col flex-1">
            <h3 class="font-display text-xl text-forest leading-snug">${escHtml(r.name)}</h3>
${zh}            <ul class="space-y-1.5 text-sm text-stone-600">${feats}</ul>
          </div>
        </article>`;
}

function galleryImg(g, slug) {
  const img = typeof g === 'string' ? g : g.img;
  const alt = (typeof g === 'string' ? '' : g.alt) || '';
  return `        <img loading="lazy" decoding="async" src="${imgSrc(img, slug)}" alt="${escAttr(alt)}" class="w-full h-48 object-cover rounded-xl">`;
}

function hotelJsonLd(h, key, detail) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Hotel',
    name: h.name,
    alternateName: (detail && detail.alternateName) || h.zh || '',
    description: ((detail && (detail.jsonDesc || detail.intro)) || h.blurb || ''),
    url: `${base}/hotels/${key}.html`,
    address: { '@type': 'PostalAddress', addressRegion: 'Hunan', addressCountry: 'CN' },
    areaServed: (detail && detail.areaServed) || h.area || '',
  };
  return JSON.stringify(data, null, 2);
}

function generateDetail(key, h, cat, detail) {
  const slug = key;
  const catLink = cat ? `${cat.slug}.html` : '#';
  const catName = cat ? cat.title : 'Hotels';
  const metaDesc = detail.metaDesc || detail.intro || h.blurb || '';
  return fill(tplDetail, {
    TITLE: escHtml(`${h.name} | Visit Zhangjiajie`),
    META_DESC: escAttr(metaDesc),
    CANONICAL: `${base}/hotels/${key}.html`,
    OG_IMAGE: `${base}/images/${slug}/${imgName(h.img)}`,
    HERO_IMG: imgSrc(h.img, slug),
    HERO_ALT: escAttr(detail.heroAlt || h.alt || ''),
    CAT_LINK: catLink,
    CAT_NAME: escHtml(catName),
    HOTEL_NAME: escHtml(h.name),
    TAGLINE: escHtml(detail.tagline || h.tier || ''),
    HERO_LEAD: escHtml(detail.heroLead || h.blurb || ''),
    AREA_TIER: escHtml(detail.areaTier || `${h.area || ''} · ${h.tier || ''}`),
    INTRO_TEXT: escHtml(detail.intro || h.blurb || ''),
    ROOMS_TITLE: escHtml(detail.roomsTitle || 'Rooms & suites'),
    ROOMS_SUB: escHtml(detail.roomsSub || ''),
    ROOMS: (detail.rooms || []).map((r) => roomCard(r, slug)).join('\n'),
    GALLERY_TITLE: escHtml(detail.galleryTitle || `Inside ${h.name}`),
    GALLERY_SUB: escHtml(detail.gallerySub || ''),
    GALLERY: (detail.gallery || []).map((g) => galleryImg(g, slug)).join('\n'),
    FAQ_SECTION: faqSection(detail.faq),
    OTHER_WAYS: relatedSection(hotelCategories, cat, 'Other ways to browse hotels'),
    JSONLD: hotelJsonLd(h, key, detail),
  });
}

// ---------- main ----------
const tpl = fs.readFileSync(TEMPLATE, 'utf8');
fs.mkdirSync(OUT_DIR, { recursive: true });

// category pages
// 记录本次应当存在的页面 slug，循环结束后据此清理孤儿页（删除/改名分类、历史 schema 残留等）。
const expectedSlugs = new Set();
// 统一删除可能残留的旧页，避免线上显示过期内容
function removeStale(slug, reason) {
  const stale = path.join(OUT_DIR, slug + '.html');
  if (fs.existsSync(stale)) { fs.unlinkSync(stale); console.log(`  ✓ removed stale hotels/${slug}.html (${reason})`); }
}

for (const cat of hotelCategories) {
  if (cat.hidden) {
    // 隐藏分类：删除其已生成的页面，彻底从站点移除
    removeStale(cat.slug, 'category hidden');
    continue;
  }
  const heroSlug = heroSlugFor(cat);
  if (!validateImage(cat.heroImg, heroSlug)) {
    // hero 图缺失：删掉可能残留的旧页（否则线上会停留在上一次成功构建的内容）
    removeStale(cat.slug, 'hero image missing');
    continue;
  }
  const visibleIds = cat.hotels.filter((id) => hotels[id] && !hotels[id].hidden);
  if (!visibleIds.length) {
    // 空分类（酒店被删光或全隐藏）：不再生成空白页，并清理旧页
    removeStale(cat.slug, 'no visible hotels');
    continue;
  }
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
  expectedSlugs.add(cat.slug);
}

// 三级酒店详情页：凡 hotels[key].detail 存在即生成 hotels/<key>.html（数据驱动，可被后台编辑）
for (const key of Object.keys(hotels)) {
  const h = hotels[key];
  if (!h || !h.detail) continue;
  if (h.hidden) continue; // 后台隐藏的酒店：hub 卡片已不显示，其三级详情页也不应生成
  const cat = findCatOf(key);
  if (cat && cat.hidden) continue;
  if (!validateImage(h.img, key)) {
    console.log(`  ✗ skipped detail hotels/${key}.html (hero image missing)`);
    continue;
  }
  (h.detail.rooms || []).forEach((r) => validateImage(r.img, key));
  (h.detail.gallery || []).forEach((g) => validateImage((typeof g === 'string' ? g : g.img), key));
  const html = generateDetail(key, h, cat, h.detail);
  fs.writeFileSync(path.join(OUT_DIR, key + '.html'), html, 'utf8');
  console.log(`  ✓ wrote hotels/${key}.html (detail, ${html.length} bytes)`);
  expectedSlugs.add(key);
}

// 孤儿页清理：删除 hotels/ 下所有不在 expectedSlugs ∪ detailSlugs 中的 .html。
// expectedSlugs = 4 个分类页 + 含 detail 的酒店详情页（由本脚本生成）；detailSlugs = 含 detail 的酒店（兜底保护）。
// 现在三级页由 hotels[key].detail 数据驱动生成；若某酒店被后台移除 detail 或改名，其旧静态页会被清理。
const detailSlugs = new Set(Object.keys(hotels).filter((k) => hotels[k] && hotels[k].detail && !hotels[k].hidden));
for (const f of fs.readdirSync(OUT_DIR)) {
  if (!f.endsWith('.html')) continue;
  const slug = f.slice(0, -5);
  if (!expectedSlugs.has(slug) && !detailSlugs.has(slug)) {
    fs.unlinkSync(path.join(OUT_DIR, f));
    console.log(`  ✓ removed orphan hotels/${f} (not in current data)`);
  }
}

// No hub page generated — categories are first-level.

// Post-build: rewrite index.html hotel-nav blocks from hotelCategories (B4 fix).
// Hidden/deleted categories are skipped → no dead links on the home page.
try {
  const INDEX = path.join(ROOT, 'index.html');
  if (fs.existsSync(INDEX)) {
    let html = fs.readFileSync(INDEX, 'utf8');
    // 顺序关键：先 applyHome/applyNav 生成 HOME:NAV 与 HOTEL-NAV 占位，
    // 再 applyIndexNav 填充 HOTEL-NAV（酒店二级菜单），否则会被 applyNav 清空。
    html = applyHome(html, { hero: homeHero, topAttractions, welcome, siteNav });
    html = applyIndexNav(html, buildIndexNav(hotelCategories));
    fs.writeFileSync(INDEX, html, 'utf8');
    console.log('  ✓ rewrote index.html blocks (B4 hotel-nav + home hero)');
  }
} catch (e) {
  console.error('  ✗ index.html rewrite failed: ' + e.message);
  process.exitCode = 1;
}

process.exit(process.exitCode || 0);
