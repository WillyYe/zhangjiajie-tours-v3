// scripts/extract-detail.mjs
// Reverse-extract a hotel's `detail` data object from a static hotels/<key>.html page.
// All 7 detail pages share the same section-comment skeleton, so this single parser is generic.
// Output: JS object literal (paste-ready) and/or JSON. No external deps.
//
// Usage:
//   node scripts/extract-detail.mjs                 # extract all 7, print summary
//   node scripts/extract-detail.mjs jimo            # extract one key
//   node scripts/extract-detail.mjs --emit-js       # also write /tmp/extract/<key>.detail.mjs
//   node scripts/extract-detail.mjs --emit-json     # also write /tmp/extract/<key>.json
//   node scripts/extract-detail.mjs jimo --validate # compare extracted jimo vs hotels-data.mjs (text-alignment check)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HOTELS_DIR = path.join(ROOT, 'hotels');

// ---------- tiny HTML helpers (markup is uniform + project-owned, so regex is reliable) ----------
function dec(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&#8217;/g, '’').replace(/&#8216;/g, '‘')
    .replace(/&#8211;/g, '–').replace(/&#8212;/g, '—').replace(/&#8230;/g, '…')
    .trim();
}
const stripTags = (s) => s.replace(/<[^>]+>/g, '');
const collapse = (s) => s.replace(/\s+/g, ' ').trim();
const txt = (s) => collapse(dec(stripTags(s)));
const imgBase = (src) => src.split('/').pop().replace(/\.[a-z0-9]+$/i, '');

function sliceBetween(html, start, end) {
  const i = html.indexOf(start);
  if (i < 0) throw new Error(`marker not found: ${start}`);
  const j = html.indexOf(end, i);
  if (j < 0) throw new Error(`marker not found: ${end}`);
  return html.slice(i + start.length, j);
}
function first(html, re) {
  const m = html.match(re);
  return m ? m[1] : '';
}
function all(html, re) {
  const out = []; let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

// ---------- section extractors ----------
function extractHero(html) {
  const s = sliceBetween(html, '<!-- ========== HERO ========== -->', '<!-- ========== Intro / at a glance ========== -->');
  const heroImg = first(s, /<img id="heroImg"[^>]*\bsrc="([^"]*)"/);
  return {
    heroAlt: first(s, /<img id="heroImg"[^>]*\balt="([^"]*)"/),
    tagline: txt(first(s, /<span class="inline-block bg-gold\/90[^"]*">([\s\S]*?)<\/span>/)),
    heroLead: txt(first(s, /<p class="text-white\/85[^"]*">([\s\S]*?)<\/p>/)),
    _heroImg: imgBase(heroImg),
  };
}

function extractIntro(html) {
  const s = sliceBetween(html, '<!-- ========== Intro / at a glance ========== -->', '<!-- ========== Card grid (injected) ========== -->');
  return {
    areaTier: txt(first(s, /<p class="text-gold-dark text-xs font-bold uppercase tracking[^"]*">([\s\S]*?)<\/p>/)),
    intro: txt(first(s, /<p class="text-stone\/85[^"]*">([\s\S]*?)<\/p>/)),
  };
}

function extractRooms(html) {
  const s = sliceBetween(html, '<!-- ========== Stays in this category ========== -->', '<!-- ========== Gallery ========== -->');
  const rooms = all(s, /(<article class="card-hover[\s\S]*?<\/article>)/g).map((art) => {
    const imgM = art.match(/<img[^>]*\bsrc="([^"]*)"[^>]*\balt="([^"]*)"/);
    const name = txt(first(art, /<h3 class="font-display[^"]*">([\s\S]*?)<\/h3>/));
    const nameZh = txt(first(art, /<p class="text-gold-dark text-xs font-semibold uppercase tracking-wide mb-2">([\s\S]*?)<\/p>/));
    const features = all(art, /<li[^>]*>([\s\S]*?)<\/li>/g).map((li) => txt(li).replace(/^[✓\s]+/, ''));
    const room = { img: imgBase(imgM[1]), alt: imgM[2], name };
    if (nameZh) room.nameZh = nameZh;
    room.features = features;
    return room;
  });
  return {
    roomsTitle: txt(first(s, /<h2 class="font-display[^"]*">([\s\S]*?)<\/h2>/)),
    roomsSub: txt(first(s, /<p class="text-stone-600 mb-10 max-w-2xl">([\s\S]*?)<\/p>/)),
    rooms,
  };
}

function extractGallery(html) {
  const s = sliceBetween(html, '<!-- ========== Gallery ========== -->', '<!-- ========== FAQ ========== -->');
  const imgs = [];
  const gre = /<img loading="lazy"[^>]*\bsrc="([^"]*)"[^>]*\balt="([^"]*)"/g;
  let gm;
  while ((gm = gre.exec(s)) !== null) imgs.push({ img: imgBase(gm[1]), alt: gm[2] });
  return {
    galleryTitle: txt(first(s, /<h2 class="font-display[^"]*">([\s\S]*?)<\/h2>/)),
    gallerySub: txt(first(s, /<p class="text-stone-600 mb-10 max-w-2xl">([\s\S]*?)<\/p>/)),
    gallery: imgs,
  };
}

function extractFaq(html) {
  const s = sliceBetween(html, '<!-- ========== FAQ ========== -->', '<!-- ========== Related categories ========== -->');
  const faq = [];
  const re = /<h3 class="font-display[^"]*">([\s\S]*?)<\/h3>\s*<p class="text-stone[^"]*">([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(s)) !== null) faq.push({ q: txt(m[1]), a: txt(m[2]) });
  return { faq };
}

function extractSeo(html) {
  const metaDesc = first(html, /<meta name="description" content="([^"]*)"/);
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  const json = ld ? ld[1] : '';
  const grab = (k) => { const m = json.match(new RegExp('"' + k + '"\\s*:\\s*"([^"]*)"')); return m ? dec(m[1]) : null; };
  const out = { metaDesc };
  const alternateName = grab('alternateName');
  const jsonDesc = grab('description');
  const areaServed = grab('areaServed');
  if (alternateName) out.alternateName = alternateName;
  if (jsonDesc) out.jsonDesc = jsonDesc;
  if (areaServed) out.areaServed = areaServed;
  return out;
}

export function extractDetail(key) {
  const file = path.join(HOTELS_DIR, key + '.html');
  const html = fs.readFileSync(file, 'utf8');
  const hero = extractHero(html);
  const intro = extractIntro(html);
  const rooms = extractRooms(html);
  const gallery = extractGallery(html);
  const faq = extractFaq(html);
  const seo = extractSeo(html);

  const detail = {};
  if (hero.tagline) detail.tagline = hero.tagline;
  if (hero.heroLead) detail.heroLead = hero.heroLead;
  if (hero.heroAlt) detail.heroAlt = hero.heroAlt;
  if (intro.areaTier) detail.areaTier = intro.areaTier;
  if (intro.intro) detail.intro = intro.intro;
  if (seo.metaDesc) detail.metaDesc = seo.metaDesc;
  if (seo.alternateName) detail.alternateName = seo.alternateName;
  if (seo.jsonDesc) detail.jsonDesc = seo.jsonDesc;
  if (seo.areaServed) detail.areaServed = seo.areaServed;
  detail.roomsTitle = rooms.roomsTitle || 'Rooms & suites';
  detail.roomsSub = rooms.roomsSub || '';
  detail.rooms = rooms.rooms;
  detail.galleryTitle = gallery.galleryTitle || `Inside ${key}`;
  detail.gallerySub = gallery.gallerySub || '';
  detail.gallery = gallery.gallery;
  detail.faq = faq.faq;
  return detail;
}

// ---------- JS-literal emitter (matches repo single-quote style) ----------
function jsLit(v, ind = 2) {
  const pad = ' '.repeat(ind);
  const pad1 = ' '.repeat(ind + 2);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    const items = v.map((x) => pad1 + jsLit(x, ind + 2));
    return '[\n' + items.join(',\n') + '\n' + pad + ']';
  }
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length === 0) return '{}';
    const items = keys.map((k) => `${pad1}${k}: ${jsLit(v[k], ind + 2)}`);
    return '{\n' + items.join(',\n') + '\n' + pad + '}';
  }
  if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  return String(v);
}

// ---------- semantic compare (for --validate) ----------
function norm(v) {
  if (typeof v === 'string') return collapse(dec(v)).replace(/[’']/g, "'");
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = norm(v[k]); return o; }
  return v;
}
function deepEq(a, b) {
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a)) { if (a.length !== b.length) return false; return a.every((x, i) => deepEq(x, b[i])); }
  if (a && typeof a === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEq(a[k], b[k]));
  }
  return a === b;
}

// ---------- CLI ----------
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
const args = process.argv.slice(2);
const keys = args.filter((a) => !a.startsWith('--'));
const emitJs = args.includes('--emit-js');
const emitJson = args.includes('--emit-json');
const validate = args.includes('--validate');
const allKeys = ['jimo', 'hetianye', 'vienna', 'boutique', 'homeinn-plus', '72qilou', 'huatian'];
const targets = keys.length ? keys : allKeys;

let mismatches = 0;
for (const key of targets) {
  let detail;
  try {
    detail = extractDetail(key);
  } catch (e) {
    console.log(`✗ ${key}: ${e.message}`);
    mismatches++;
    continue;
  }
  console.log(`✓ ${key}: ${detail.rooms.length} rooms, ${detail.gallery.length} gallery, ${detail.faq.length} faq` +
    (detail.tagline ? `, tagline="${detail.tagline}"` : '') + (detail.areaTier ? `, areaTier="${detail.areaTier}"` : ''));

  if (emitJson) {
    fs.mkdirSync('/tmp/extract', { recursive: true });
    fs.writeFileSync(`/tmp/extract/${key}.json`, JSON.stringify(detail, null, 2), 'utf8');
  }
  if (emitJs) {
    fs.mkdirSync('/tmp/extract', { recursive: true });
    const lit = `    detail: ${jsLit(detail, 4)},\n`;
    fs.writeFileSync(`/tmp/extract/${key}.detail.mjs`, lit, 'utf8');
  }

  if (validate && key === 'jimo') {
    const data = await import(path.join(ROOT, 'hotels-data.mjs'));
    const expected = data.hotels.jimo.detail;
    const a = norm(detail), b = norm(expected);
    // ignore _heroImg (not stored in detail)
    if (deepEq(a, b)) {
      console.log(`   ✓ VALIDATE jimo: extracted == hotels-data.mjs.detail (text-aligned, zero regression)`);
    } else {
      mismatches++;
      console.log(`   ✗ VALIDATE jimo: extracted detail differs from hotels-data.mjs`);
      console.log('   extracted:', JSON.stringify(a, null, 0));
      console.log('   expected :', JSON.stringify(b, null, 0));
    }
  }
}
process.exit(mismatches ? 1 : 0);
}
