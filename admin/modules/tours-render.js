// Tour Packages 纯渲染函数（无 Node / 浏览器全局依赖）
// 同时被 scripts/build-tours.mjs（构建）与 admin/modules/tours.js（后台预览）import，
// 保证“后台所见”与“线上所得”永远一致（单一真源，杜绝前后台漂移）。
// 注意：本文件不得 import fs / path / 任何浏览器全局，否则浏览器端会崩溃、Node 端也会报错。

const imgName = (n) => (/\.(webp|jpg|jpeg|avif|png)$/i.test(n) ? n : n + '.webp');
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 角标颜色：运营只选关键字，不写裸类名（与 index.html 现有 class 一致）
export const BADGE = {
  forest: 'bg-forest/90',
  emerald: 'bg-emerald-600/90',
  gold: 'bg-gold/90',
  blue: 'bg-blue-600/90',
  red: 'bg-red-600/90',
  orange: 'bg-orange-500/90',
  purple: 'bg-purple-700/90',
};

const BASE = 'https://willyye.github.io/zhangjiajie-tours-v3';

// ---------- 套餐卡片（hub 网格 + 后台卡片预览共用） ----------
function hubCardHtml(it, i) {
  const slug = it.slug;
  const badgeClass = BADGE[it.badgeColor] || BADGE.forest;
  const badge = it.badge ? `<div class="absolute top-3 left-3 ${badgeClass} text-white text-xs font-medium px-2.5 py-1 rounded-full">${escHtml(it.badge)}</div>` : '';
  const duration = it.duration ? `<span class="text-xs font-semibold text-gold-dark bg-gold/10 px-2.5 py-1 rounded-full whitespace-nowrap">${escAttr(it.duration)}</span>` : '';
  return `        <!-- ${i + 1}. ${it.title} -->
        <a id="tour-${slug}" href="tours/${slug}.html" class="card-hover bg-white rounded-2xl overflow-hidden shadow-sm fade-in block group">
          <div class="relative h-52 overflow-hidden">
            <img loading="lazy" decoding="async" src="../images/tours/${imgName(it.img)}" alt="${escAttr(it.imgAlt)}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
            ${badge}
          </div>
          <div class="p-5">
            <div class="flex items-start justify-between gap-3 mb-2">
              <h3 class="font-display text-xl text-forest leading-snug">${escHtml(it.title)}</h3>
              ${duration}
            </div>
            <p class="text-stone-500 text-sm leading-relaxed">${escHtml(it.desc)}</p>
          </div>
        </a>`;
}

// 纯函数：由 tours 数据生成 hub 卡片网格（含 grid 容器）。
// hidden 项被跳过（不渲染、不产生死链）。缩进与 index.html 原硬编码一致 → 零回归。
export function buildToursHubHtml(data) {
  const items = (data && data.items) || [];
  const vis = items.filter((it) => !it.hidden);
  const cards = vis.map((it, i) => hubCardHtml(it, i)).join('\n\n');
  return `      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">\n\n${cards}\n\n      </div>`;
}

// ---------- 详情页各区块 ----------
function itineraryHtml(list) {
  if (!list || !list.length) return '';
  const items = list.map((it) => {
    const day = escHtml(it.day || '');
    const title = escHtml(it.title || '');
    const text = escHtml(it.text || '');
    return `        <div class="tl-item">
          <div class="tl-dot">${day.replace(/^Day\s*/i, '').slice(0, 4) || '•'}</div>
          <div class="bg-white rounded-2xl border border-sand-dark p-6 md:p-7 fade-in">
            <p class="text-gold-dark text-xs font-bold uppercase tracking-[0.15em] mb-1">${day}</p>
            <h3 class="font-display text-lg md:text-xl text-forest mb-2">${title}</h3>
            <p class="text-stone/80 leading-relaxed text-sm md:text-base">${text}</p>
          </div>
        </div>`;
  }).join('\n');
  return `      <div class="space-y-6">\n${items}\n      </div>`;
}

function includedHtml(list) {
  if (!list || !list.length) return '';
  return list.map((x) => `          <li class="flex items-start gap-2 text-stone-700"><span class="text-forest mt-0.5">✓</span><span>${escHtml(x)}</span></li>`).join('\n');
}

function excludedHtml(list) {
  if (!list || !list.length) return '';
  return list.map((x) => `          <li class="flex items-start gap-2 text-stone-700"><span class="text-red-500 mt-0.5">✕</span><span>${escHtml(x)}</span></li>`).join('\n');
}

function galleryHtml(list) {
  if (!list || !list.length) return '';
  return `      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">\n` + list.map((g) => {
    const img = typeof g === 'string' ? g : g.img;
    const alt = (typeof g === 'string' ? '' : g.alt) || '';
    return `        <img loading="lazy" decoding="async" src="../images/tours/${imgName(img)}" alt="${escAttr(alt)}" class="w-full h-48 object-cover rounded-xl">`;
  }).join('\n') + '\n      </div>';
}

function faqSectionHtml(items) {
  if (!items || !items.length) return '';
  const cards = items.map((it) => `          <div class="bg-white rounded-2xl border border-sand-dark p-6 md:p-7 fade-in">
            <h3 class="font-display text-lg md:text-xl text-forest mb-2">${escHtml(it.q)}</h3>
            <p class="text-stone/80 leading-relaxed text-sm md:text-base">${escHtml(it.a)}</p>
          </div>`).join('\n');
  return `  <!-- ========== FAQ ========== -->
  <section id="faq" class="max-w-[1100px] mx-auto px-6 pb-16">
    <h2 class="font-display text-2xl md:text-3xl text-forest mb-6">Frequently asked questions</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
${cards}
    </div>
  </section>`;
}

function otherWaysHtml(others) {
  const vis = (others || []).filter((o) => o && o.slug);
  if (!vis.length) return '';
  const cards = vis.map((o) => `          <a href="../tours/${escAttr(o.slug)}.html" class="card-hover group block bg-white rounded-2xl overflow-hidden border border-sand-dark">
            <div class="overflow-hidden h-44"><img loading="lazy" decoding="async" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" src="../images/tours/${imgName(o.img)}" alt="${escAttr(o.title)}"></div>
            <div class="p-5">
              <p class="text-xs font-semibold uppercase tracking-wide text-gold-dark mb-1">Tour Package</p>
              <h3 class="font-display text-lg text-forest group-hover:text-gold-dark transition-colors">${escHtml(o.title)}</h3>
            </div>
          </a>`).join('\n');
  return `  <!-- ========== Other packages ========== -->
  <section id="other-ways" class="max-w-[1400px] mx-auto px-6 pb-20">
    <h2 class="font-display text-2xl md:text-3xl text-forest mb-6">Other tour packages</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
${cards}
    </div>
  </section>`;
}

function tourJsonLd(t, slug, canonical) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: t.title,
    description: t.overview || t.heroLead || '',
    url: canonical,
    touristType: ['Foreign tourists', 'Families', 'Adventure travelers'],
    provider: { '@type': 'Organization', name: 'Visit Zhangjiajie', url: BASE },
  };
  return data;
}

export function tourDetailMap(t, slug, others) {
  const canonical = `${BASE}/tours/${slug}.html`;
  return {
    TITLE: escHtml(`${t.title} | Visit Zhangjiajie`),
    META_DESC: escAttr(t.overview || t.heroLead || ''),
    CANONICAL: canonical,
    OG_IMAGE: `${BASE}/images/tours/${imgName(t.heroImg)}`,
    HERO_IMG: `../images/tours/${imgName(t.heroImg)}`,
    HERO_ALT: escAttr(t.heroAlt || t.title),
    CAT_LINK: 'index.html',
    CAT_NAME: 'Tours',
    TOUR_NAME: escHtml(t.title),
    TAGLINE: escHtml(t.tagline || ''),
    HERO_LEAD: escHtml(t.heroLead || ''),
    DURATION: escHtml(t.duration || ''),
    PRICE: escHtml(t.price || ''),
    OVERVIEW: escHtml(t.overview || ''),
    ITINERARY: itineraryHtml(t.itinerary),
    INCLUDED: includedHtml(t.included),
    EXCLUDED: excludedHtml(t.excluded),
    GALLERY_TITLE: escHtml(t.galleryTitle || 'Gallery'),
    GALLERY_SUB: escHtml(t.gallerySub || ''),
    GALLERY: galleryHtml(t.gallery),
    FAQ_SECTION: faqSectionHtml(t.faq),
    OTHER_WAYS: otherWaysHtml(others),
    JSONLD: JSON.stringify(tourJsonLd(t, slug, canonical), null, 2),
  };
}

export function fillTourDetail(template, map) {
  let out = template;
  for (const [k, v] of Object.entries(map)) out = out.split(`{{${k}}}`).join(v);
  return out;
}

// 汇总所有可见卡片引用的图片（images/tours/<img>.webp），供保存前校验与构建校验
export function listTourImages(data) {
  const items = (data && data.items) || [];
  const names = [];
  for (const it of items) {
    if (it.hidden) continue;
    if (it.img) names.push(it.img);
    if (it.heroImg) names.push(it.heroImg);
    (it.gallery || []).forEach((g) => names.push(typeof g === 'string' ? g : g.img));
  }
  return names.map((n) => `images/tours/${imgName(n)}`);
}

// 汇总所有可见详情页链接（tours/<slug>.html），供无死链校验
export function listTourLinks(data) {
  const items = (data && data.items) || [];
  return items.filter((it) => !it.hidden).map((it) => `tours/${it.slug}.html`);
}
