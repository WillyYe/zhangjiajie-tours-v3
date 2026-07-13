// zhangjiajie-tours-v3 — Attraction detail-page generator
// Reads templates/attraction-page.html + attractions-data.mjs and writes one
// fully-populated HTML file per attraction into attractions/.
//
// Design rules (verified against the proven 100分 yuanjiajie.html):
//  - Heading ladder: h1 (page) -> h2 (section) -> h3 (cards / FAQ / related)
//    -> h4 (Local tip + footer). No level skips (static-audit T10).
//  - Every <img> carries alt + loading="lazy" (hero exempt via fetchpriority=high).
//  - All data-driven content is HTML-escaped; JSON-LD is emitted via JSON.stringify.
//  - Referenced images are validated against images/ before writing (static-audit T1).
// Run: node scripts/build-attractions.mjs   (from project root)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { attractions } from '../attractions-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'templates', 'attraction-page.html');
const OUT_DIR = path.join(ROOT, 'attractions');
const IMAGES_DIR = path.join(ROOT, 'images');

// ---------- escaping helpers ----------
const escAttr = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Always resolve to ../images/<name>.webp (data may omit the extension).
function imgSrc(name) {
  let n = String(name);
  if (!/\.(webp|jpg|jpeg|avif|png)$/i.test(n)) n += '.webp';
  return '../images/' + n;
}

// ---------- fragment builders ----------
function buildIntro(a) {
  return a.introParas.map((p) => `          <p>${escHtml(p)}</p>`).join('\n');
}

function buildHighlights(a) {
  return a.highlights.map((h) => `            <article class="highlight-card card-hover bg-white rounded-2xl overflow-hidden border border-sand-dark">
              <img loading="lazy" decoding="async" src="${imgSrc(h.img)}" alt="${escAttr(h.alt)}" class="highlight-img">
              <div class="p-5">
                <h3 class="font-display text-lg text-forest mb-1">${escHtml(h.title)}</h3>
                <p class="text-gold-dark text-xs font-semibold uppercase tracking-wide mb-2">${escHtml(h.sub)}</p>
                <p class="text-stone/80 text-sm leading-relaxed">${escHtml(h.desc)}</p>
              </div>
            </article>`).join('\n');
}

function buildRoutes(a) {
  return a.routes.map((r) => {
    const steps = r.steps.map((s, i) =>
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

function buildBestTime(a) {
  const cards = a.bestTime.cards.map((c) =>
    `          <div class="bg-white rounded-2xl border border-sand-dark p-5 text-center">
            <span class="w-10 h-10 mx-auto rounded-full bg-forest/10 text-forest flex items-center justify-center mb-2"><i data-lucide="${escAttr(c.icon)}" class="w-5 h-5"></i></span>
            <p class="font-semibold text-forest">${escHtml(c.period)}</p>
            <p class="text-stone-600 text-sm mt-1">${escHtml(c.desc)}</p>
          </div>`
  ).join('\n');
  return `          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
${cards}
          </div>
          <p class="text-stone-600 text-sm bg-white/60 rounded-xl p-4 border border-sand-dark"><i data-lucide="info" class="w-4 h-4 inline -mt-0.5"></i> ${escHtml(a.bestTime.note)}</p>`;
}

function buildTips(a) {
  return a.tips.map((t) =>
    `          <div class="tip-item">
            <span class="tip-icon shrink-0"><i data-lucide="${escAttr(t.icon)}" class="w-5 h-5 text-white"></i></span>
            <div>
              <p class="font-semibold text-forest text-base">${escHtml(t.title)}</p>
              <p class="text-stone/80 text-sm mt-1">${escHtml(t.desc)}</p>
            </div>
          </div>`
  ).join('\n');
}

function buildGettingThere(a) {
  return a.gettingThere.map((g) =>
    `            <div class="border-b border-sand-dark pb-4 mb-4 last:border-0 last:pb-0 last:mb-0">
              <p class="text-stone/85 leading-relaxed"><strong class="text-forest">${escHtml(g.strong)}</strong> ${escHtml(g.text)}</p>
            </div>`
  ).join('\n');
}

function buildTickets(a) {
  return a.tickets.map((t) =>
    `              <tr><td class="font-semibold text-forest">${escHtml(t.item)}</td><td class="text-stone/80">${escHtml(t.detail)}</td></tr>`
  ).join('\n');
}

function buildFacts(a) {
  return a.facts.map((f) =>
    `              <div class="flex justify-between gap-4 border-b border-sand-dark pb-3 last:border-0 last:pb-0">
                <dt class="text-stone-600">${escHtml(f.label)}</dt>
                <dd class="font-semibold text-forest text-right">${escHtml(f.value)}</dd>
              </div>`
  ).join('\n');
}

function buildGallery(a) {
  return a.gallery.map((g) =>
    `          <a href="${imgSrc(g.img)}" class="gallery-item block" aria-label="${escAttr(g.alt)}">
            <img loading="lazy" decoding="async" src="${imgSrc(g.img)}" alt="${escAttr(g.alt)}" class="w-full h-48 object-cover">
          </a>`
  ).join('\n');
}

function buildFaq(a) {
  // Static, accessible Q&A (h3 question + p answer). No JS dependency.
  return a.faqs.map((f) =>
    `          <div class="bg-white rounded-2xl border border-sand-dark p-5">
            <h3 class="font-display text-lg text-forest mb-2">${escHtml(f.q)}</h3>
            <p class="text-stone/80 text-sm leading-relaxed">${escHtml(f.a)}</p>
          </div>`
  ).join('\n');
}

function buildRelated(a) {
  return a.related.map((r) =>
    `          <a href="../attractions/${escAttr(r.slug)}.html" class="group block rounded-2xl overflow-hidden border border-sand-dark bg-white card-hover">
            <div class="h-40 overflow-hidden">
              <img loading="lazy" decoding="async" src="${imgSrc(r.img)}" alt="${escAttr(r.alt)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
            </div>
            <div class="p-4">
              <h3 class="font-display text-base text-forest">${escHtml(r.title)}</h3>
              <p class="text-stone-600 text-sm mt-0.5">${escHtml(r.sub)}</p>
            </div>
          </a>`
  ).join('\n');
}

// ---------- JSON-LD (TouristAttraction + Breadcrumb + FAQ + HowTo) ----------
function buildJsonLd(a) {
  const base = 'https://willyye.github.io/zhangjiajie-tours-v3';
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
          { '@type': 'ListItem', position: 1, name: 'Home', item: base + '/' },
          { '@type': 'ListItem', position: 2, name: 'Attractions', item: base + '/attractions/' },
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

// ---------- image-existence validation ----------
function collectImages(a) {
  const names = [a.heroImg, a.heroBgImg];
  a.highlights.forEach((h) => names.push(h.img));
  a.gallery.forEach((g) => names.push(g.img));
  a.related.forEach((r) => names.push(r.img));
  return names.map(imgSrc).map((p) => p.replace('../', '')); // -> images/xxx.webp
}
function validateImages(a) {
  const missing = collectImages(a).filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
  if (missing.length) {
    console.error(`  ✗ [${a.slug}] missing images: ${missing.join(', ')}`);
    process.exitCode = 1;
    return false;
  }
  return true;
}

// ---------- main ----------
const template = fs.readFileSync(TEMPLATE, 'utf8');
fs.mkdirSync(OUT_DIR, { recursive: true });

let allOk = true;
for (const a of attractions) {
  if (!validateImages(a)) { allOk = false; continue; }

  const introBody = buildIntro(a);
  const highlights = buildHighlights(a);
  const routes = buildRoutes(a);
  const bestTime = buildBestTime(a);
  const tips = buildTips(a);
  const gettingThere = buildGettingThere(a);
  const tickets = buildTickets(a);
  const facts = buildFacts(a);
  const gallery = buildGallery(a);
  const faq = buildFaq(a);
  const related = buildRelated(a);

  const map = {
    PAGE_TITLE: escHtml(a.title),
    META_DESC: escAttr(a.metaDesc),
    CANONICAL: escAttr(a.canonical),
    HERO_BG_IMG: escAttr(a.heroBgImg),
    SELF_SLUG: escAttr(a.slug),
    NAV_SELF: escHtml(a.breadcrumb),
    HERO_IMG: escAttr(a.heroImg),
    HERO_IMG_ALT: escAttr(a.heroImgAlt),
    BREADCRUMB: escHtml(a.breadcrumb),
    H1: escHtml(a.h1),
    SUBTITLE: escHtml(a.subtitle),
    HERO_INTRO: escHtml(a.heroIntro),
    TLDR: escHtml(a.tldr),
    INTRO_H2: escHtml(a.introH2),
    INTRO_BODY: introBody,
    HIGHLIGHTS_INTRO: escHtml(a.highlightsIntro),
    HIGHLIGHTS: highlights,
    ROUTES_INTRO: escHtml(a.routesIntro),
    ROUTES: routes,
    BEST_TIME: bestTime,
    TIPS: tips,
    GETTING_THERE: gettingThere,
    TICKETS: tickets,
    FACTS: facts,
    LOCAL_TIP: escHtml(a.localTip),
    GALLERY_TITLE: escHtml(a.galleryTitle),
    GALLERY: gallery,
    FAQ: faq,
    RELATED: related,
  };

  let out = template;
  for (const [k, v] of Object.entries(map)) {
    out = out.split(`{{${k}}}`).join(v);
  }

  // Replace the entire JSON-LD block (template ships Yuanjiajie's; swap for this page's).
  const jsonLd = JSON.stringify(buildJsonLd(a), null, 2);
  out = out.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">\n${jsonLd}\n  </script>`
  );

  // Guard: no leftover placeholders
  const leftovers = [...out.matchAll(/\{\{[A-Z_]+\}\}/g)].map((m) => m[0]);
  if (leftovers.length) {
    console.error(`  ✗ [${a.slug}] leftover placeholders: ${[...new Set(leftovers)].join(', ')}`);
    process.exitCode = 1;
    allOk = false;
    continue;
  }

  const dest = path.join(OUT_DIR, a.file);
  fs.writeFileSync(dest, out, 'utf8');
  console.log(`  ✓ wrote ${a.file} (${out.length} bytes)`);
}

console.log(allOk ? '\nAll attraction pages generated.\n' : '\nGeneration completed WITH ERRORS — see above.\n');
process.exit(allOk ? 0 : 1);
