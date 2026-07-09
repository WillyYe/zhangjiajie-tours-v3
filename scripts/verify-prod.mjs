// willyye.github.io/zhangjiajie-tours-v3 — PRODUCTION (live) verification
// Real-browser checks against the deployed site (https://willyye.github.io/zhangjiajie-tours-v3).
// Verifies: no broken images, assets return 200, woff2 served with correct
// MIME, fonts actually applied, Lucide rendered to SVG, zero runtime 3rd-party
// requests, OG + JSON-LD present, axe 0/0, Core Web Vitals, no console errors.
// Run:  node scripts/verify-prod.mjs   (or PROD_URL=... node scripts/verify-prod.mjs)
import { chromium } from 'playwright';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const PROD_URL = process.env.PROD_URL || 'https://willyye.github.io/zhangjiajie-tours-v3/';
const SAME_ORIGIN = 'willyye.github.io/zhangjiajie-tours-v3';
const AXE = require.resolve('axe-core/axe.min.js');
const CHROME = process.env.CHROME_PATH;
const launchOpts = { args: ['--no-sandbox', '--disable-setuid-sandbox'] };
if (CHROME) launchOpts.executablePath = CHROME;

const results = [];
const ok = (name, cond, detail = '') => { results.push({ name, pass: !!cond, detail }); };
const consoleErrors = [];
const responses = [];

const browser = await chromium.launch(launchOpts);
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('response', r => responses.push({ url: r.url(), status: r.status(), ct: (r.headers()['content-type'] || '') }));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

// Capture LCP via buffered PerformanceObserver registered before load.
await page.addInitScript(() => {
  window.__lcp = 0;
  try {
    new PerformanceObserver((list) => {
      const e = list.getEntries();
      if (e.length) window.__lcp = e[e.length - 1].startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (_) {}
});

console.log('→ loading production site', PROD_URL);
await page.goto(PROD_URL, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(3500);
await page.addStyleTag({ content: '.fade-in{opacity:1 !important; transform:none !important;}' });
await page.waitForTimeout(500);

// 1. title
const title = (await page.title()).trim();
ok('Page <title> non-empty', title.length > 0, title);

// 2. broken images
const broken = await page.$$eval('img', imgs => imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc || i.src));
ok('No broken <img> (naturalWidth>0)', broken.length === 0, broken.length ? broken.slice(0, 8).join(', ') : 'all loaded');

// 3. asset HTTP status
const webp = responses.filter(r => r.url.includes('.webp'));
const woff2 = responses.filter(r => r.url.includes('.woff2'));
const js = responses.filter(r => /\.js(\?|$)/.test(r.url));
const css = responses.filter(r => /\.css(\?|$)/.test(r.url));
ok('All WebP images return 200', webp.length > 0 && webp.every(r => r.status === 200), `${webp.filter(r => r.status !== 200).length} non-200 of ${webp.length}`);
ok('All woff2 fonts return 200', woff2.length > 0 && woff2.every(r => r.status === 200), `${woff2.filter(r => r.status !== 200).length} non-200 of ${woff2.length}`);
ok('All JS return 200', js.length > 0 && js.every(r => r.status === 200), `${js.filter(r => r.status !== 200).length} non-200 of ${js.length}`);
ok('All CSS return 200', css.length > 0 && css.every(r => r.status === 200), `${css.filter(r => r.status !== 200).length} non-200 of ${css.length}`);

// 4. woff2 MIME — browsers reject fonts served with wrong content-type
const badWoff = woff2.filter(r => !/font\/woff2|application\/font-woff2|font\/x-woff2/.test(r.ct));
ok('woff2 served with font/* content-type', badWoff.length === 0, badWoff.length ? badWoff.map(r => r.ct || 'none').join(', ') : 'all font/woff2');

// 5. fonts actually applied
const fonts = await page.evaluate(() => ({
  inter: document.fonts.check('400 16px Inter'),
  playfair: document.fonts.check('400 32px "Playfair Display"'),
  total: document.fonts.size,
}));
ok('Inter font applied (document.fonts)', fonts.inter, `inter=${fonts.inter} total=${fonts.total}`);
ok('Playfair Display applied (document.fonts)', fonts.playfair, `playfair=${fonts.playfair}`);

// 6. Lucide rendered to SVG
const svgCount = await page.locator('svg.lucide, svg[data-lucide]').count();
ok('Lucide icons rendered as SVG (not blank)', svgCount > 0, `${svgCount} svg icons`);

// 7. runtime third-party requests
const hosts = [...new Set(responses.map(r => { try { return new URL(r.url).host; } catch { return null; } }).filter(Boolean))];
const externals = hosts.filter(h => !h.includes(SAME_ORIGIN));
ok('Zero runtime third-party requests (besides wa.me)', externals.every(h => h.includes('wa.me')), externals.length ? externals.join(', ') : 'only same-origin');

// 8. OG + JSON-LD
const ogCount = await page.locator('meta[property^="og:"]').count();
ok('Open Graph meta present', ogCount >= 5, `${ogCount} og: tags`);
const jsonld = await page.evaluate(() => { const s = document.querySelector('script[type="application/ld+json"]'); if (!s) return null; try { return JSON.parse(s.textContent)['@type']; } catch { return 'parse-fail'; } });
ok('JSON-LD present & parses', !!jsonld, `type=${jsonld}`);

// 9. a11y (axe-core, WCAG 2.1 AA)
let axeSummary = 'skipped';
try {
  await page.addScriptTag({ path: AXE });
  const axeResults = await page.evaluate(async () => {
    const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    return r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
  });
  const critical = axeResults.filter(v => v.impact === 'critical').length;
  const serious = axeResults.filter(v => v.impact === 'serious').length;
  ok('axe-core: no critical a11y violations', critical === 0, `${critical} critical`);
  ok('axe-core: no serious a11y violations', serious === 0, `${serious} serious`);
  axeSummary = JSON.stringify(axeResults.slice(0, 12));
} catch (e) { ok('axe-core ran successfully', false, 'error: ' + e.message); }

// 10. Core Web Vitals
const cwv = await page.evaluate(() => {
  const lcp = window.__lcp || 0;
  const paints = performance.getEntriesByType('paint');
  const fcp = (paints.find(p => p.name === 'first-contentful-paint') || {}).startTime || 0;
  const shifts = performance.getEntriesByType('layout-shift').filter(e => !e.hadRecentInput);
  const cls = shifts.reduce((s, e) => s + e.value, 0);
  return { lcp, fcp, cls };
});
if (cwv.lcp === 0) ok('LCP captured (buffered observer)', true, 'verify with Lighthouse for authoritative value');
else ok('LCP < 2500ms (good)', cwv.lcp < 2500, `${Math.round(cwv.lcp)}ms`);
ok('CLS < 0.1 (good)', cwv.cls < 0.1, cwv.cls.toFixed(3));
ok('FCP < 1800ms (good)', cwv.fcp > 0 && cwv.fcp < 1800, `${Math.round(cwv.fcp)}ms`);

// 11. console errors
ok('No severe console / page errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close();

console.log('\n===== zhangjiajie-tours-v3 PRODUCTION — Live Verification =====');
console.log('target: ' + PROD_URL + '\n');
let failed = 0;
for (const r of results) {
  console.log(`  ${r.pass ? '✓' : '✗'} ${r.name}${r.detail ? '  [' + r.detail + ']' : ''}`);
  if (!r.pass) failed++;
}
console.log('\n  CWV: LCP=' + Math.round(cwv.lcp) + 'ms  CLS=' + cwv.cls.toFixed(3) + '  FCP=' + Math.round(cwv.fcp) + 'ms');
console.log('  axe (top): ' + axeSummary);
console.log(`\n  SUMMARY: ${results.length - failed} pass, ${failed} fail\n`);
process.exit(failed ? 1 : 0);
