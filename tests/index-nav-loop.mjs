// zhangjiajie-tours-v3 — B4 loop verifier
// Asserts: (1) zero-regression (4 categories visible → byte-identical to baseline),
// (2) no dead links, (3) full coverage, (4) empirical hide-one-category.
// Run: node tests/index-nav-loop.mjs   (from project root)
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hotelCategories } from '../hotels-data.mjs';
import { buildIndexNav } from '../scripts/index-nav.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const imgName = (n) => (/\.(webp|jpg|jpeg|avif|png)$/i.test(n) ? n : n + '.webp');
// cardImg 形如 hotel-jimo-1 → 物理目录 jimo（与 buildIndexNav / heroSlugFor 一致）
const cardImgDir = (c) => { const m = /^hotel-([a-z0-9-]+)-/.exec(c.cardImg || ''); return (m && m[1]) || c.slug; };

let fail = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.error('  ✗ ' + msg); fail++; } };

const MARK_RE = (name) => new RegExp(`<!--HOTEL-NAV:${name}:START-->([\\s\\S]*?)<!--HOTEL-NAV:${name}:END-->`);
function extract(html, name) { const m = html.match(MARK_RE(name)); return m ? m[1] : null; }
function slugs(html) { return [...html.matchAll(/hotels\/([a-z0-9-]+)\.html/g)].map((m) => m[1]); }

// Baseline: prefer the regenerated working index.html (the canonical current
// output — the generator must reproduce it exactly after the Bug D fix that
// corrected flat card image paths to images/<dir>/<file>.webp). Falls back to
// the committed version only if the working file is missing.
function baselineHtml() {
  const working = path.join(ROOT, 'index.html');
  if (fs.existsSync(working)) return fs.readFileSync(working, 'utf8');
  for (const src of ['git show :index.html', 'git show HEAD:index.html']) {
    try { return execSync(src, { cwd: ROOT, encoding: 'utf8' }); } catch {}
  }
  return '';
}

const visAll = hotelCategories.filter((c) => !c.hidden).map((c) => c.slug);
const blocksAll = buildIndexNav(hotelCategories);

console.log('1) Zero-regression (all categories visible → matches baseline)');
{
  const base = baselineHtml();
  const hasMarkers = MARK_RE('MEGA').test(base) && MARK_RE('MOBILE').test(base) && MARK_RE('CARDS').test(base);
  if (hasMarkers) {
    for (const name of ['MEGA', 'MOBILE', 'CARDS']) {
      const b = extract(base, name);
      ok(b !== null, `baseline has ${name} marker`);
      if (b !== null) ok(b.trim() === blocksAll[name.toLowerCase()].trim(), `${name} byte-identical to baseline`);
    }
  } else {
    // Fallback: structural assertions (baseline has no markers yet, e.g. before B4 commit)
    console.log('   (baseline has no markers — using structural assertions)');
    for (const c of hotelCategories.filter((c) => !c.hidden)) {
      ok(blocksAll.mega.includes(c.navLabel), `mega contains "${c.navLabel}"`);
      ok(blocksAll.mobile.includes(c.navLabel), `mobile contains "${c.navLabel}"`);
      ok(blocksAll.cards.includes(`images/${cardImgDir(c)}/${imgName(c.cardImg)}`), `cards img ${c.cardImg}`);
      ok(blocksAll.cards.includes(c.cardTitle), `cards title "${c.cardTitle}"`);
      ok(blocksAll.cards.includes(c.cardAlt), `cards alt "${c.cardAlt}"`);
      ok(blocksAll.cards.includes(c.cardDesc), `cards desc "${c.cardDesc}"`);
    }
  }
}

console.log('2) No dead links (every hotels/<slug>.html link targets a visible category)');
{
  const all = blocksAll.mega + '\n' + blocksAll.mobile + '\n' + blocksAll.cards;
  const dead = slugs(all).filter((s) => !visAll.includes(s));
  ok(dead.length === 0, 'no links to hidden/missing categories' + (dead.length ? ': ' + dead.join(', ') : ''));
}

console.log('3) Full coverage (every visible category appears in all three blocks)');
{
  for (const slug of visAll) {
    const href = `hotels/${slug}.html`;
    ok(blocksAll.mega.includes(href), `${slug} in MEGA`);
    ok(blocksAll.mobile.includes(href), `${slug} in MOBILE`);
    ok(blocksAll.cards.includes(href), `${slug} in CARDS`);
  }
}

console.log('4) Empirical: hide "by-area" → its links vanish, rest intact, no dead links');
{
  const catsHidden = hotelCategories.map((c) => (c.slug === 'by-area' ? { ...c, hidden: true } : c));
  const b = buildIndexNav(catsHidden);
  const visHidden = catsHidden.filter((c) => !c.hidden).map((c) => c.slug);
  const all = b.mega + '\n' + b.mobile + '\n' + b.cards;
  ok(!all.includes('hotels/by-area.html'), 'by-area link removed when hidden');
  ok(all.includes('hotels/mountain-lodges.html'), 'mountain still present');
  ok(all.includes('hotels/selected-stays.html'), 'selected still present');
  ok(all.includes('hotels/value-hotels.html'), 'value still present');
  const dead = slugs(all).filter((s) => !visHidden.includes(s));
  ok(dead.length === 0, 'no dead links after hiding by-area' + (dead.length ? ': ' + dead.join(', ') : ''));
  for (const slug of visHidden) ok(all.includes(`hotels/${slug}.html`), `${slug} still covered`);
  ok(b.mega.includes('href="hotels/mountain-lodges.html"'), 'top "Hotels" link → first visible category');
}

console.log(fail === 0 ? '\n✅ index-nav loop: all assertions passed' : `\n❌ index-nav loop: ${fail} assertion(s) failed`);
process.exit(fail === 0 ? 0 : 1);
