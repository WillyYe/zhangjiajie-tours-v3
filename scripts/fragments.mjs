// zhangjiajie-tours-v3 — shared fragment builders for attraction/experience detail pages.
//
// Pure string functions. NO node-only (fs/path) and NO browser-only (DOM/fetch) deps,
// so the exact same code runs in:
//   - build scripts (node)        → scripts/build-attractions.mjs / build-experiences.mjs
//   - admin live preview (browser) → admin/modules/spot-core.js (iframe srcdoc)
//
// This is the single source of truth: build output and admin preview are guaranteed identical.
// (Verified: build + static-audit show byte-level zero regression after extraction.)

const escAttr = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const imgName = (n) => (/\.(webp|jpg|jpeg|avif|png)$/i.test(n) ? n : n + '.webp');

// Always resolve to ../images/<name>.webp (data may omit the extension).
// `prefix` isolates a module's images into a subfolder, e.g. 'experiences/'
// → ../images/experiences/<name>.webp (matches per-module physical isolation).
export function imgSrc(name, prefix = '') {
  let n = String(name);
  if (!/\.(webp|jpg|jpeg|avif|png)$/i.test(n)) n += '.webp';
  return '../images/' + prefix + n;
}

// ---------- fragment builders (identical shape for both content types) ----------

export function buildIntro(d) {
  return (d.introParas || []).map((p) => `          <p>${escHtml(p)}</p>`).join('\n');
}

export function buildHighlights(d, prefix = '') {
  return (d.highlights || []).map((h) => `            <article class="highlight-card card-hover bg-white rounded-2xl overflow-hidden border border-sand-dark">
              <img loading="lazy" decoding="async" src="${imgSrc(h.img, prefix)}" alt="${escAttr(h.alt)}" class="highlight-img">
              <div class="p-5">
                <h3 class="font-display text-lg text-forest mb-1">${escHtml(h.title)}</h3>
                <p class="text-gold-dark text-xs font-semibold uppercase tracking-wide mb-2">${escHtml(h.sub)}</p>
                <p class="text-stone/80 text-sm leading-relaxed">${escHtml(h.desc)}</p>
              </div>
            </article>`).join('\n');
}

export function buildRoutes(d) {
  return (d.routes || []).map((r) => {
    const steps = (r.steps || []).map((s, i) =>
      `                <li class="route-step"><span class="route-dot">${i + 1}</span><p class="text-stone/85 text-sm"><strong>${escHtml(s.strong)}</strong> ${escHtml(s.text)}</p></li>`
    ).join('\n');
    return `            <article class="bg-white rounded-2xl border border-sand-dark p-6 card-hover">
              <div class="flex items-center gap-3 mb-4">
                <span class="w-10 h-10 rounded-full bg-forest/10 text-forest flex items-center justify-center shrink-0"><i data-lucide="${escAttr(r.icon)}" class="w-5 h-5"></i></span>
                <div>
                  <h3 class="font-display text-lg text-forest">${escHtml(r.title)}</h3>
                  <p class="text-stone-600 text-xs">${escHtml(r.sub)}</p>
                </div>
              </div>
              <ol class="space-y-3">
${steps}
              </ol>
            </article>`;
  }).join('\n');
}

export function buildBestTime(d) {
  const cards = (d.bestTime && d.bestTime.cards || []).map((c) =>
    `          <div class="bg-white rounded-2xl border border-sand-dark p-5 text-center">
            <span class="w-10 h-10 mx-auto rounded-full bg-forest/10 text-forest flex items-center justify-center mb-2"><i data-lucide="${escAttr(c.icon)}" class="w-5 h-5"></i></span>
            <p class="font-semibold text-forest">${escHtml(c.period)}</p>
            <p class="text-stone-600 text-sm mt-1">${escHtml(c.desc)}</p>
          </div>`
  ).join('\n');
  const note = (d.bestTime && d.bestTime.note) || '';
  return `          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
${cards}
          </div>
          <p class="text-stone-600 text-sm bg-white/60 rounded-xl p-4 border border-sand-dark"><i data-lucide="info" class="w-4 h-4 inline -mt-0.5"></i> ${escHtml(note)}</p>`;
}

export function buildTips(d) {
  return (d.tips || []).map((t) =>
    `          <div class="tip-item">
            <span class="tip-icon shrink-0"><i data-lucide="${escAttr(t.icon)}" class="w-5 h-5 text-white"></i></span>
            <div>
              <p class="font-semibold text-forest text-base">${escHtml(t.title)}</p>
              <p class="text-stone/80 text-sm mt-1">${escHtml(t.desc)}</p>
            </div>
          </div>`
  ).join('\n');
}

export function buildGettingThere(d) {
  return (d.gettingThere || []).map((g) =>
    `            <div class="border-b border-sand-dark pb-4 mb-4 last:border-0 last:pb-0 last:mb-0">
              <p class="text-stone/85 leading-relaxed"><strong class="text-forest">${escHtml(g.strong)}</strong> ${escHtml(g.text)}</p>
            </div>`
  ).join('\n');
}

export function buildTickets(d) {
  return (d.tickets || []).map((t) =>
    `              <tr><td class="font-semibold text-forest">${escHtml(t.item)}</td><td class="text-stone/80">${escHtml(t.detail)}</td></tr>`
  ).join('\n');
}

export function buildFacts(d) {
  return (d.facts || []).map((f) =>
    `              <div class="flex justify-between gap-4 border-b border-sand-dark pb-3 last:border-0 last:pb-0">
                <dt class="text-stone-600">${escHtml(f.label)}</dt>
                <dd class="font-semibold text-forest text-right">${escHtml(f.value)}</dd>
              </div>`
  ).join('\n');
}

export function buildGallery(d, prefix = '') {
  return (d.gallery || []).map((g) =>
    `          <a href="${imgSrc(g.img, prefix)}" class="gallery-item block" aria-label="${escAttr(g.alt)}">
            <img loading="lazy" decoding="async" src="${imgSrc(g.img, prefix)}" alt="${escAttr(g.alt)}" class="w-full h-48 object-cover">
          </a>`
  ).join('\n');
}

export function buildFaq(d) {
  return (d.faqs || []).map((f) =>
    `          <div class="bg-white rounded-2xl border border-sand-dark p-5">
            <h3 class="font-display text-lg text-forest mb-2">${escHtml(f.q)}</h3>
            <p class="text-stone/80 text-sm leading-relaxed">${escHtml(f.a)}</p>
          </div>`
  ).join('\n');
}

// relatedPrefix: attraction pages link out with '../attractions/<slug>.html';
// experience pages live in the same folder, so just '<slug>.html'.
export function buildRelated(d, relatedPrefix, prefix = '') {
  return (d.related || []).map((r) =>
    `          <a href="${relatedPrefix}${escAttr(r.slug)}.html" class="group block rounded-2xl overflow-hidden border border-sand-dark bg-white card-hover">
            <div class="h-40 overflow-hidden">
              <img loading="lazy" decoding="async" src="${imgSrc(r.img, prefix)}" alt="${escAttr(r.alt)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
            </div>
            <div class="p-4">
              <h3 class="font-display text-base text-forest">${escHtml(r.title)}</h3>
              <p class="text-stone-600 text-sm mt-0.5">${escHtml(r.sub)}</p>
            </div>
          </a>`
  ).join('\n');
}

// ---------- placeholder map (everything except JSON-LD) ----------
// `kind` selects the related-link prefix AND the image subfolder prefix
// (experiences are physically isolated under images/experiences/).
export function buildPageMap(d, kind) {
  const relatedPrefix = kind === 'experience' ? '../experiences/' : '../attractions/';
  const imgPrefix = kind === 'experience' ? 'experiences/' : 'attractions/';
  // Templates hardcode `../images/{{HERO_IMG}}` / `../images/{{HERO_BG_IMG}}`,
  // so these two bare-filename placeholders must carry the subfolder prefix.
  const heroPath = (v) => (v ? imgSrc(v, imgPrefix).slice('../images/'.length) : '');
  return {
    PAGE_TITLE: escHtml(d.title),
    META_DESC: escAttr(d.metaDesc),
    CANONICAL: escAttr(d.canonical),
    HERO_BG_IMG: escAttr(heroPath(d.heroBgImg)),
    SELF_SLUG: escAttr(d.slug),
    NAV_SELF: escHtml(d.breadcrumb),
    HERO_IMG: escAttr(heroPath(d.heroImg)),
    HERO_IMG_ALT: escAttr(d.heroImgAlt),
    BREADCRUMB: escHtml(d.breadcrumb),
    H1: escHtml(d.h1),
    SUBTITLE: escHtml(d.subtitle),
    HERO_INTRO: escHtml(d.heroIntro),
    TLDR: escHtml(d.tldr),
    INTRO_H2: escHtml(d.introH2),
    INTRO_BODY: buildIntro(d),
    HIGHLIGHTS_INTRO: escHtml(d.highlightsIntro),
    HIGHLIGHTS: buildHighlights(d, imgPrefix),
    ROUTES_INTRO: escHtml(d.routesIntro),
    ROUTES: buildRoutes(d),
    BEST_TIME: buildBestTime(d),
    TIPS: buildTips(d),
    GETTING_THERE: buildGettingThere(d),
    TICKETS: buildTickets(d),
    FACTS: buildFacts(d),
    LOCAL_TIP: escHtml(d.localTip),
    GALLERY_TITLE: escHtml(d.galleryTitle),
    GALLERY: buildGallery(d, imgPrefix),
    FAQ: buildFaq(d),
    RELATED: buildRelated(d, relatedPrefix, imgPrefix),
  };
}

// ---------- JSON-LD ----------
const BASE = 'https://willyye.github.io/zhangjiajie-tours-v3';

export function buildAttractionJsonLd(a) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TouristAttraction',
        name: a.jsonld.name,
        alternateName: a.jsonld.alternateName,
        description: a.jsonld.description,
        image: a.jsonld.images,
        geo: { '@type': 'GeoCoordinates', latitude: a.geo.lat, longitude: a.geo.lng },
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Wulingyuan District',
          addressRegion: 'Zhangjiajie, Hunan',
          addressCountry: 'CN',
        },
        isPartOf: {
          '@type': 'TouristAttraction',
          name: 'Wulingyuan Scenic Area',
          isPartOf: { '@type': 'TouristAttraction', name: 'Zhangjiajie National Forest Park' },
        },
        touristType: a.jsonld.touristType,
        openingHoursSpecification: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          opens: '07:00',
          closes: '17:00',
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Attractions', item: BASE + '/attractions/' },
          { '@type': 'ListItem', position: 3, name: a.breadcrumb, item: a.canonical },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: a.jsonld.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'HowTo',
        name: a.jsonld.howto.name,
        step: a.jsonld.howto.steps.map((s) => ({ '@type': 'HowToStep', name: s.name, text: s.text })),
      },
    ],
  };
}

export function buildExperienceJsonLd(e) {
  const touristAttraction = {
    '@type': 'TouristAttraction',
    name: e.jsonld.name,
    alternateName: e.jsonld.alternateName,
    description: e.jsonld.description,
    image: e.jsonld.images,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Zhangjiajie',
      addressRegion: 'Hunan',
      addressCountry: 'CN',
    },
    touristType: e.jsonld.touristType,
  };
  if (e.geo) {
    touristAttraction.geo = { '@type': 'GeoCoordinates', latitude: e.geo.lat, longitude: e.geo.lng };
  }
  return {
    '@context': 'https://schema.org',
    '@graph': [
      touristAttraction,
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: BASE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Experiences', item: BASE + '/experiences/' },
          { '@type': 'ListItem', position: 3, name: e.breadcrumb, item: e.canonical },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: e.jsonld.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'HowTo',
        name: e.jsonld.howto.name,
        step: e.jsonld.howto.steps.map((s) => ({ '@type': 'HowToStep', name: s.name, text: s.text })),
      },
    ],
  };
}
