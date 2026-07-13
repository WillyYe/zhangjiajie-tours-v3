// zhangjiajie-tours-v3 — Experiences detail-page generator
// Reads templates/experience-page.html + experiences-data.mjs and writes one
// fully-populated HTML file per experience into experiences/.
//
// Design rules:
//  - Heading ladder: h1 -> h2 -> h3 -> h4. No level skips.
//  - Every <img> has alt + loading="lazy" (hero exempt via fetchpriority=high).
//  - All data-driven content is HTML-escaped; JSON-LD is emitted via JSON.stringify.
//  - Referenced images are validated against images/ before writing.
// Run: node scripts/build-experiences.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { experiences } from '../experiences-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'templates', 'experience-page.html');
const OUT_DIR = path.join(ROOT, 'experiences');
const IMAGES_DIR = path.join(ROOT, 'images');

const escAttr = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function imgSrc(name) {
  let n = String(name);
  if (!/\.(webp|jpg|jpeg|avif|png)$/i.test(n)) n += '.webp';
  return '../images/' + n;
}

function buildIntro(e) {
  return e.introParas.map((p) => `          <p>${escHtml(p)}</p>`).join('\n');
}

function buildHighlights(e) {
  return e.highlights.map((h) => `            <article class="highlight-card card-hover bg-white rounded-2xl overflow-hidden border border-sand-dark">
              <img loading="lazy" decoding="async" src="${imgSrc(h.img)}" alt="${escAttr(h.alt)}" class="highlight-img">
              <div class="p-5">
                <h3 class="font-display text-lg text-forest mb-1">${escHtml(h.title)}</h3>
                <p class="text-gold-dark text-xs font-semibold uppercase tracking-wide mb-2">${escHtml(h.sub)}</p>
                <p class="text-stone/80 text-sm leading-relaxed">${escHtml(h.desc)}</p>
              </div>
            </article>`).join('\n');
}

function buildRoutes(e) {
  return e.routes.map((r) => {
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

function buildBestTime(e) {
  const cards = e.bestTime.cards.map((c) =>
    `          <div class="bg-white rounded-2xl border border-sand-dark p-5 text-center">
            <span class="w-10 h-10 mx-auto rounded-full bg-forest/10 text-forest flex items-center justify-center mb-2"><i data-lucide="${escAttr(c.icon)}" class="w-5 h-5"></i></span>
            <p class="font-semibold text-forest">${escHtml(c.period)}</p>
            <p class="text-stone-600 text-sm mt-1">${escHtml(c.desc)}</p>
          </div>`
  ).join('\n');
  return `          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
${cards}
          </div>
          <p class="text-stone-600 text-sm bg-white/60 rounded-xl p-4 border border-sand-dark"><i data-lucide="info" class="w-4 h-4 inline -mt-0.5"></i> ${escHtml(e.bestTime.note)}</p>`;
}

function buildTips(e) {
  return e.tips.map((t) =>
    `          <div class="tip-item">
            <span class="tip-icon shrink-0"><i data-lucide="${escAttr(t.icon)}" class="w-5 h-5 text-white"></i></span>
            <div>
              <p class="font-semibold text-forest text-base">${escHtml(t.title)}</p>
              <p class="text-stone/80 text-sm mt-1">${escHtml(t.desc)}</p>
            </div>
          </div>`
  ).join('\n');
}

function buildGettingThere(e) {
  return e.gettingThere.map((g) =>
    `            <div class="border-b border-sand-dark pb-4 mb-4 last:border-0 last:pb-0 last:mb-0">
              <p class="text-stone/85 leading-relaxed"><strong class="text-forest">${escHtml(g.strong)}</strong> ${escHtml(g.text)}</p>
            </div>`
  ).join('\n');
}

function buildTickets(e) {
  return e.tickets.map((t) =>
    `              <tr><td class="font-semibold text-forest">${escHtml(t.item)}</td><td class="text-stone/80">${escHtml(t.detail)}</td></tr>`
  ).join('\n');
}

function buildFacts(e) {
  return e.facts.map((f) =>
    `              <div class="flex justify-between gap-4 border-b border-sand-dark pb-3 last:border-0 last:pb-0">
                <dt class="text-stone-600">${escHtml(f.label)}</dt>
                <dd class="font-semibold text-forest text-right">${escHtml(f.value)}</dd>
              </div>`
  ).join('\n');
}

function buildGallery(e) {
  return e.gallery.map((g) =>
    `          <a href="${imgSrc(g.img)}" class="gallery-item block" aria-label="${escAttr(g.alt)}">
            <img loading="lazy" decoding="async" src="${imgSrc(g.img)}" alt="${escAttr(g.alt)}" class="w-full h-48 object-cover">
          </a>`
  ).join('\n');
}

function buildFaq(e) {
  return e.faqs.map((f) =>
    `          <div class="bg-white rounded-2xl border border-sand-dark p-5">
            <h3 class="font-display text-lg text-forest mb-2">${escHtml(f.q)}</h3>
            <p class="text-stone/80 text-sm leading-relaxed">${escHtml(f.a)}</p>
          </div>`
  ).join('\n');
}

function buildRelated(e) {
  return e.related.map((r) =>
    `          <a href="${escAttr(r.slug)}.html" class="group block rounded-2xl overflow-hidden border border-sand-dark bg-white card-hover">
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

function buildJsonLd(e) {
  const base = 'https://willyye.github.io/zhangjiajie-tours-v3';
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
          { '@type': 'ListItem', position: 1, name: 'Home', item: base + '/' },
          { '@type': 'ListItem', position: 2, name: 'Experiences', item: base + '/experiences/' },
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

function collectImages(e) {
  const names = [e.heroImg, e.heroBgImg];
  e.highlights.forEach((h) => names.push(h.img));
  e.gallery.forEach((g) => names.push(g.img));
  e.related.forEach((r) => names.push(r.img));
  return names.map(imgSrc).map((p) => p.replace('../', ''));
}

function validateImages(e) {
  const missing = collectImages(e).filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
  if (missing.length) {
    console.error(`  ✗ [${e.slug}] missing images: ${missing.join(', ')}`);
    process.exitCode = 1;
    return false;
  }
  return true;
}

const template = fs.readFileSync(TEMPLATE, 'utf8');
fs.mkdirSync(OUT_DIR, { recursive: true });

let allOk = true;
for (const e of experiences) {
  if (!validateImages(e)) { allOk = false; continue; }

  const map = {
    PAGE_TITLE: escHtml(e.title),
    META_DESC: escAttr(e.metaDesc),
    CANONICAL: escAttr(e.canonical),
    HERO_BG_IMG: escAttr(e.heroBgImg),
    SELF_SLUG: escAttr(e.slug),
    NAV_SELF: escHtml(e.breadcrumb),
    HERO_IMG: escAttr(e.heroImg),
    HERO_IMG_ALT: escAttr(e.heroImgAlt),
    BREADCRUMB: escHtml(e.breadcrumb),
    H1: escHtml(e.h1),
    SUBTITLE: escHtml(e.subtitle),
    HERO_INTRO: escHtml(e.heroIntro),
    TLDR: escHtml(e.tldr),
    INTRO_H2: escHtml(e.introH2),
    INTRO_BODY: buildIntro(e),
    HIGHLIGHTS_INTRO: escHtml(e.highlightsIntro),
    HIGHLIGHTS: buildHighlights(e),
    ROUTES_INTRO: escHtml(e.routesIntro),
    ROUTES: buildRoutes(e),
    BEST_TIME: buildBestTime(e),
    TIPS: buildTips(e),
    GETTING_THERE: buildGettingThere(e),
    TICKETS: buildTickets(e),
    FACTS: buildFacts(e),
    LOCAL_TIP: escHtml(e.localTip),
    GALLERY_TITLE: escHtml(e.galleryTitle),
    GALLERY: buildGallery(e),
    FAQ: buildFaq(e),
    RELATED: buildRelated(e),
  };

  let out = template;
  for (const [k, v] of Object.entries(map)) {
    out = out.split(`{{${k}}}`).join(v);
  }

  const jsonLd = JSON.stringify(buildJsonLd(e), null, 2);
  out = out.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">\n${jsonLd}\n  </script>`
  );

  const leftovers = [...out.matchAll(/\{\{[A-Z_]+\}\}/g)].map((m) => m[0]);
  if (leftovers.length) {
    console.error(`  ✗ [${e.slug}] leftover placeholders: ${[...new Set(leftovers)].join(', ')}`);
    process.exitCode = 1;
    allOk = false;
    continue;
  }

  const dest = path.join(OUT_DIR, e.file);
  fs.writeFileSync(dest, out, 'utf8');
  console.log(`  ✓ wrote ${e.file} (${out.length} bytes)`);
}

console.log(allOk ? '\nAll experience pages generated.\n' : '\nGeneration completed WITH ERRORS — see above.\n');
process.exit(allOk ? 0 : 1);
