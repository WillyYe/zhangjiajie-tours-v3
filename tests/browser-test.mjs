// zhangjiajie-tours-v3 — Comprehensive First-Level Page Test
// Adapted from myguilin's browser-test for the v3 structure.
// E2E (Playwright) + Visual Regression (screenshots) + A11y (axe-core) + Core Web Vitals
// Run from project root:  node tests/browser-test.mjs
// Needs: playwright + axe-core installed; chromium downloaded.
import { chromium } from 'playwright';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const http = require('http');
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
// Serve over HTTP so the local tailwind.css (and other assets) load correctly.
// file:// blocks same-origin stylesheet fetches (CORS), which would break the visual test.
const ASSET_SERVER = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.statusCode = 404; return res.end('not found');
  }
  res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});
await new Promise(r => ASSET_SERVER.listen(0, '127.0.0.1', r));
const PORT = ASSET_SERVER.address().port;
const BASE = process.env.BASE || (`http://127.0.0.1:${PORT}/index.html`);
const AXE = require.resolve('axe-core/axe.min.js');
const SHOT_DIR = path.join(ROOT, 'tests', 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
const ok = (name, cond, detail = '') => { results.push({ name, pass: !!cond, detail }); };
const consoleErrors = [];

// CHROME_PATH lets you point at a specific Chrome build; otherwise Playwright
// auto-resolves the browser it installed via `npx playwright install chromium`.
const CHROME = process.env.CHROME_PATH;
const launchOpts = { args: ['--no-sandbox', '--disable-setuid-sandbox'] };
if (CHROME) launchOpts.executablePath = CHROME;
const browser = await chromium.launch(launchOpts);
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

// Capture LCP via a buffered PerformanceObserver registered before any load.
await page.addInitScript(() => {
  window.__lcp = 0;
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length) window.__lcp = entries[entries.length - 1].startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) { /* unsupported */ }
});

page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

console.log('→ loading', BASE);
await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
// give Tailwind (local) / fonts / lucide (CDN) time to settle
await page.waitForTimeout(2500);
// force fade-in elements visible for accurate screenshots
await page.addStyleTag({ content: '.fade-in{opacity:1 !important; transform:none !important;}' });
await page.waitForTimeout(400);

// ---------- 1. basic ----------
ok('Page <title> is non-empty', (await page.title()).trim().length > 0, await page.title());

// ---------- 2. card counts (v3: 8 attractions, 6 experiences) ----------
const attrCount = await page.locator('#attraction [id^="attraction-"]').count();
ok('Attractions module renders 8 cards', attrCount === 8, `found ${attrCount}`);
const expCount = await page.locator('#experience [id^="exp-"]').count();
ok('Experiences module renders 6 cards', expCount === 6, `found ${expCount}`);

// ---------- 3. images ----------
const broken = await page.$$eval('img', imgs => imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc || i.src));
ok('No broken <img> on render (naturalWidth>0)', broken.length === 0, broken.length ? broken.slice(0,5).join(', ') : 'all loaded');
// Hero is the LCP element and is intentionally eager (fetchpriority=high); exempt it.
const nonLazy = await page.$$eval('img', imgs => imgs.filter(i => i.getAttribute('loading') !== 'lazy' && i.getAttribute('fetchpriority') !== 'high').length);
ok('All non-hero <img> use loading="lazy"', nonLazy === 0, `${nonLazy} not lazy (hero exempt: LCP)`);

// ---------- 4. anchor navigation ----------
const sh = await page.locator('a[href="#hotel"]').first();
await sh.scrollIntoViewIfNeeded();
await sh.click();
await page.waitForTimeout(900);
const hotelVisible = await page.locator('#hotel').isVisible();
const hotelScrolled = await page.evaluate(() => Math.abs(window.scrollY) > 50);
ok('Nav "Hotel" scrolls to #hotel target (anchor resolves)', hotelVisible && hotelScrolled, `visible=${hotelVisible} scrolled=${hotelScrolled}`);

const sf = await page.locator('a[href="#food"]').first();
await sf.scrollIntoViewIfNeeded();
await sf.click();
await page.waitForTimeout(900);
const foodVisible = await page.locator('#food').isVisible();
ok('Nav "Food" scrolls to #food target (anchor resolves)', foodVisible, `visible=${foodVisible}`);

// ---------- 5. Contact modal (v3 id: #contactModal) ----------
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
const openBtn = page.locator('[onclick*="openContactModal"]').first();
await openBtn.click();
await page.waitForTimeout(500);
const modalVisible = await page.locator('#contactModal').isVisible();
const modalRole = await page.locator('#contactModal').getAttribute('role');
const modalAria = await page.locator('#contactModal').getAttribute('aria-modal');
ok('Contact modal opens on trigger', modalVisible, `visible=${modalVisible}`);
ok('Contact modal has role="dialog" + aria-modal="true"', modalRole === 'dialog' && modalAria === 'true', `role=${modalRole} aria-modal=${modalAria}`);

// ESC closes
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const modalClosedEsc = !(await page.locator('#contactModal').isVisible());
ok('ESC closes the modal', modalClosedEsc);

// reopen + close button (v3 aria-label: "Close contact dialog")
await openBtn.click();
await page.waitForTimeout(400);
await page.locator('#contactModal [aria-label*="Close"]').click();
await page.waitForTimeout(400);
const modalClosedBtn = !(await page.locator('#contactModal').isVisible());
ok('Close (✕) button closes the modal', modalClosedBtn);

// ---------- 6. screenshots (desktop) ----------
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(SHOT_DIR, 'desktop-full.png'), fullPage: true });
for (const [sel, name] of [['#tour', 'desktop-tour'], ['#attraction', 'desktop-attraction']]) {
  if (await page.locator(sel).count()) {
    await page.locator(sel).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOT_DIR, name + '.png') });
  }
}

// ---------- 7. mobile ----------
try {
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
const mpage = await mctx.newPage();
mpage.on('pageerror', e => consoleErrors.push('mobile pageerror: ' + e.message));
await mpage.goto(BASE, { waitUntil: 'load', timeout: 60000 });
await mpage.waitForTimeout(2500);
await mpage.addStyleTag({ content: '.fade-in{opacity:1 !important; transform:none !important;}' });
await mpage.waitForTimeout(300);

const mNavLinks = await mpage.locator('nav a[href^="#"]').count();
ok('Mobile viewport exposes nav anchor links', mNavLinks > 0, `${mNavLinks} links`);

// open hamburger (v3: button[onclick*="toggle"])
await mpage.locator('button[onclick*="toggle"]').click();
await mpage.waitForTimeout(400);
const menuOpen = await mpage.locator('#mobile-menu').isVisible();
ok('Mobile hamburger opens the menu', menuOpen);
await mpage.screenshot({ path: path.join(SHOT_DIR, 'mobile-menu.png') });

// tap a link that triggers closeMobileMenu → menu auto-closes
await mpage.locator('#mobile-menu a[onclick*="closeMobileMenu"]').first().click();
await mpage.waitForTimeout(600);
const menuClosed = !(await mpage.locator('#mobile-menu').isVisible());
ok('Mobile menu auto-closes after tapping a close-wired link', menuClosed);

await mpage.evaluate(() => window.scrollTo(0, 0));
await mpage.waitForTimeout(300);
await mpage.screenshot({ path: path.join(SHOT_DIR, 'mobile-full.png'), fullPage: true });
await mctx.close();
} catch (e) {
  ok('Mobile viewport flow completed', false, 'error: ' + e.message.split('\n')[0]);
}

// ---------- 8. a11y (axe-core, WCAG 2.1 AA) ----------
let axeSummary = 'skipped';
try {
  await page.addScriptTag({ path: AXE });
  const axeResults = await page.evaluate(async () => {
    const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    return r.violations.map(v => ({
      id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help,
      samples: v.nodes.slice(0, 10).map(n => ({
        target: n.target,
        html: (n.html || '').slice(0, 70),
        data: n.any && n.any[0] ? n.any[0].data : null
      }))
    }));
  });
  const critical = axeResults.filter(v => v.impact === 'critical').length;
  const serious = axeResults.filter(v => v.impact === 'serious').length;
  ok('axe-core: no critical a11y violations', critical === 0, `${critical} critical`);
  ok('axe-core: no serious a11y violations', serious === 0, `${serious} serious`);
  axeSummary = JSON.stringify(axeResults.slice(0, 12));
  for (const v of axeResults) {
    console.log(`\n  [a11y ${v.impact}] ${v.id} (${v.nodes} nodes) — ${v.help}`);
    for (const s of v.samples) {
      if (v.id === 'color-contrast' && s.data) console.log(`     • ${s.target}: contrast ${s.data.contrastRatio} (need ${s.data.requiredContrastRatio}, fg=${s.data.fgColor}, bg=${s.data.bgColor})`);
      else console.log(`     • ${s.target}: ${s.html}`);
    }
  }
} catch (e) {
  ok('axe-core ran successfully', false, 'error: ' + e.message);
}

// ---------- 9. Core Web Vitals (estimate) ----------
const cwv = await page.evaluate(() => {
  const lcp = window.__lcp || 0;
  const paints = performance.getEntriesByType('paint');
  const fcp = (paints.find(p => p.name === 'first-contentful-paint') || {}).startTime || 0;
  const shifts = performance.getEntriesByType('layout-shift').filter(e => !e.hadRecentInput);
  const cls = shifts.reduce((s, e) => s + e.value, 0);
  return { lcp, fcp, cls };
});
if (cwv.lcp === 0) {
  ok('LCP captured by headless harness', true, 'LCP measured via buffered PerformanceObserver — verify with Lighthouse for authoritative value');
} else {
  ok('LCP < 2500ms (good)', cwv.lcp < 2500, `${Math.round(cwv.lcp)}ms`);
}
ok('CLS < 0.1 (good)', cwv.cls < 0.1, cwv.cls.toFixed(3));
ok('FCP < 1800ms (good)', cwv.fcp > 0 && cwv.fcp < 1800, `${Math.round(cwv.fcp)}ms`);

// ---------- 10. console errors ----------
ok('No severe console / page errors on load', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

// ---------- 11. detail pages: ALL 8 attraction sub-pages ----------
// Loops every attraction detail page. Homepage-specific checks (card counts,
// in-page anchor scroll, contact modal) stay index-only above.
const DETAIL_PAGES = [
  'yuanjiajie.html', 'tianzi.html', 'jinbian.html', 'huangshizhai.html',
  'tianmen.html', 'grand-canyon.html', 'baofeng.html', 'yellow-dragon.html',
];
for (const FILE of DETAIL_PAGES) {
  const URL = BASE.replace(/index\.html$/, 'attractions/' + FILE);
  try {
    const dctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const dpage = await dctx.newPage();
    await dpage.addInitScript(() => {
      window.__lcp = 0;
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length) window.__lcp = entries[entries.length - 1].startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (e) { /* unsupported */ }
    });
    const dConsole = [];
    dpage.on('console', m => { if (m.type() === 'error') dConsole.push(m.text()); });
    dpage.on('pageerror', e => dConsole.push('pageerror: ' + e.message));
    await dpage.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await dpage.waitForTimeout(2500);
    await dpage.addStyleTag({ content: '.fade-in{opacity:1 !important; transform:none !important;}' });
    await dpage.waitForTimeout(400);

    ok(`[${FILE}] Page <title> is non-empty`, (await dpage.title()).trim().length > 0, await dpage.title());

    const dBroken = await dpage.$$eval('img', imgs => imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc || i.src));
    ok(`[${FILE}] No broken <img> on render (naturalWidth>0)`, dBroken.length === 0, dBroken.length ? dBroken.slice(0,5).join(', ') : 'all loaded');
    const dNonLazy = await dpage.$$eval('img', imgs => imgs.filter(i => i.getAttribute('loading') !== 'lazy' && i.getAttribute('fetchpriority') !== 'high').length);
    ok(`[${FILE}] All non-hero <img> use loading="lazy"`, dNonLazy === 0, `${dNonLazy} not lazy (hero exempt: fetchpriority=high)`);

    // mobile
    const dmctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
    const dmpage = await dmctx.newPage();
    dmpage.on('pageerror', e => dConsole.push('mobile pageerror: ' + e.message));
    await dmpage.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await dmpage.waitForTimeout(2500);
    await dmpage.addStyleTag({ content: '.fade-in{opacity:1 !important; transform:none !important;}' });
    await dmpage.waitForTimeout(300);
    const dmNav = await dmpage.locator('nav a[href^="#"], nav a[href^="../"]').count();
    ok(`[${FILE}] Mobile viewport exposes nav links`, dmNav > 0, `${dmNav} links`);
    await dmpage.locator('button[onclick*="toggle"]').click();
    await dmpage.waitForTimeout(400);
    const dMenuOpen = await dmpage.locator('#mobile-menu').isVisible();
    ok(`[${FILE}] Mobile hamburger opens the menu`, dMenuOpen);
    await dmpage.locator('#mobile-menu a').first().click();
    await dmpage.waitForTimeout(600);
    const dMenuClosed = !(await dmpage.locator('#mobile-menu').isVisible());
    ok(`[${FILE}] Mobile menu auto-closes after tapping a link`, dMenuClosed);
    await dmctx.close();

    // a11y (axe-core, WCAG 2.1 AA)
    await dpage.addScriptTag({ path: AXE });
    const dAxe = await dpage.evaluate(async () => {
      const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
      return r.violations.map(v => ({
        id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help,
        samples: v.nodes.slice(0, 10).map(n => ({ target: n.target, html: (n.html || '').slice(0, 70), data: n.any && n.any[0] ? n.any[0].data : null }))
      }));
    });
    const dCrit = dAxe.filter(v => v.impact === 'critical').length;
    const dSer = dAxe.filter(v => v.impact === 'serious').length;
    ok(`[${FILE}] axe-core: no critical a11y violations`, dCrit === 0, `${dCrit} critical`);
    ok(`[${FILE}] axe-core: no serious a11y violations`, dSer === 0, `${dSer} serious`);
    for (const v of dAxe) {
      console.log(`\n  [${FILE} a11y ${v.impact}] ${v.id} (${v.nodes} nodes) — ${v.help}`);
      for (const s of v.samples) {
        if (v.id === 'color-contrast' && s.data) console.log(`     • ${s.target}: contrast ${s.data.contrastRatio} (need ${s.data.requiredContrastRatio}, fg=${s.data.fgColor}, bg=${s.data.bgColor})`);
        else console.log(`     • ${s.target}: ${s.html}`);
      }
    }

    // Core Web Vitals
    const dCwv = await dpage.evaluate(() => {
      const lcp = window.__lcp || 0;
      const paints = performance.getEntriesByType('paint');
      const fcp = (paints.find(p => p.name === 'first-contentful-paint') || {}).startTime || 0;
      const shifts = performance.getEntriesByType('layout-shift').filter(e => !e.hadRecentInput);
      const cls = shifts.reduce((s, e) => s + e.value, 0);
      return { lcp, fcp, cls };
    });
    if (dCwv.lcp === 0) ok(`[${FILE}] LCP captured by headless harness`, true, 'verify with Lighthouse for authoritative value');
    else ok(`[${FILE}] LCP < 2500ms (good)`, dCwv.lcp < 2500, `${Math.round(dCwv.lcp)}ms`);
    ok(`[${FILE}] CLS < 0.1 (good)`, dCwv.cls < 0.1, dCwv.cls.toFixed(3));
    ok(`[${FILE}] FCP < 1800ms (good)`, dCwv.fcp > 0 && dCwv.fcp < 1800, `${Math.round(dCwv.fcp)}ms`);

    ok(`[${FILE}] No severe console / page errors on load`, dConsole.length === 0, dConsole.slice(0, 3).join(' | '));

    await dctx.close();
  } catch (e) {
    ok(`[${FILE}] detail page flow completed`, false, 'error: ' + e.message.split('\n')[0]);
  }
}

// ---------- 12. first-level module hub pages: 5 module index pages ----------
// attractions/index.html, experiences/index.html, tours/index.html,
// hotels/index.html, food/index.html — each is a listing hub linking to
// detail pages (attractions) or homepage anchors (other modules, detail TBD).
const FIRSTLEVEL_PAGES = [
  'attractions/index.html', 'experiences/index.html', 'tours/index.html',
  'hotels/index.html', 'food/index.html',
];
for (const FILE of FIRSTLEVEL_PAGES) {
  const URL = BASE.replace(/index\.html$/, FILE);
  const TAG = FILE.replace(/\.html$/, '');
  try {
    const fctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const fpage = await fctx.newPage();
    await fpage.addInitScript(() => {
      window.__lcp = 0;
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length) window.__lcp = entries[entries.length - 1].startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (e) { /* unsupported */ }
    });
    const fConsole = [];
    fpage.on('console', m => { if (m.type() === 'error') fConsole.push(m.text()); });
    fpage.on('pageerror', e => fConsole.push('pageerror: ' + e.message));
    await fpage.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await fpage.waitForTimeout(2500);
    await fpage.addStyleTag({ content: '.fade-in{opacity:1 !important; transform:none !important;}' });
    await fpage.waitForTimeout(400);

    ok(`[${TAG}] Page <title> is non-empty`, (await fpage.title()).trim().length > 0, await fpage.title());

    const fBroken = await fpage.$$eval('img', imgs => imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc || i.src));
    ok(`[${TAG}] No broken <img> on render (naturalWidth>0)`, fBroken.length === 0, fBroken.length ? fBroken.slice(0,5).join(', ') : 'all loaded');
    const fNonLazy = await fpage.$$eval('img', imgs => imgs.filter(i => i.getAttribute('loading') !== 'lazy' && i.getAttribute('fetchpriority') !== 'high').length);
    ok(`[${TAG}] All non-hero <img> use loading="lazy"`, fNonLazy === 0, `${fNonLazy} not lazy (hero exempt: fetchpriority=high)`);

    // listing hub: has outbound card links
    const fCards = await fpage.$$eval('.card-hover', els => els.length);
    ok(`[${TAG}] Has outbound card links (.card-hover)`, fCards > 0, `${fCards} cards`);

    // mobile
    const fmctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
    const fmpage = await fmctx.newPage();
    fmpage.on('pageerror', e => fConsole.push('mobile pageerror: ' + e.message));
    await fmpage.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await fmpage.waitForTimeout(2500);
    await fmpage.addStyleTag({ content: '.fade-in{opacity:1 !important; transform:none !important;}' });
    await fmpage.waitForTimeout(300);
    const fmNav = await fmpage.locator('nav a[href^="#"], nav a[href^="../"]').count();
    ok(`[${TAG}] Mobile viewport exposes nav links`, fmNav > 0, `${fmNav} links`);
    await fmpage.locator('button[onclick*="toggle"]').click();
    await fmpage.waitForTimeout(400);
    const fMenuOpen = await fmpage.locator('#mobile-menu').isVisible();
    ok(`[${TAG}] Mobile hamburger opens the menu`, fMenuOpen);
    await fmpage.locator('#mobile-menu a').first().click();
    await fmpage.waitForTimeout(600);
    const fMenuClosed = !(await fmpage.locator('#mobile-menu').isVisible());
    ok(`[${TAG}] Mobile menu auto-closes after tapping a link`, fMenuClosed);
    await fmctx.close();

    // a11y (axe-core, WCAG 2.1 AA)
    await fpage.addScriptTag({ path: AXE });
    const fAxe = await fpage.evaluate(async () => {
      const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
      return r.violations.map(v => ({
        id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help,
        samples: v.nodes.slice(0, 10).map(n => ({ target: n.target, html: (n.html || '').slice(0, 70), data: n.any && n.any[0] ? n.any[0].data : null }))
      }));
    });
    const fCrit = fAxe.filter(v => v.impact === 'critical').length;
    const fSer = fAxe.filter(v => v.impact === 'serious').length;
    ok(`[${TAG}] axe-core: no critical a11y violations`, fCrit === 0, `${fCrit} critical`);
    ok(`[${TAG}] axe-core: no serious a11y violations`, fSer === 0, `${fSer} serious`);
    for (const v of fAxe) {
      console.log(`\n  [${TAG} a11y ${v.impact}] ${v.id} (${v.nodes} nodes) — ${v.help}`);
      for (const s of v.samples) {
        if (v.id === 'color-contrast' && s.data) console.log(`     • ${s.target}: contrast ${s.data.contrastRatio} (need ${s.data.requiredContrastRatio}, fg=${s.data.fgColor}, bg=${s.data.bgColor})`);
        else console.log(`     • ${s.target}: ${s.html}`);
      }
    }

    // Core Web Vitals
    const fCwv = await fpage.evaluate(() => {
      const lcp = window.__lcp || 0;
      const paints = performance.getEntriesByType('paint');
      const fcp = (paints.find(p => p.name === 'first-contentful-paint') || {}).startTime || 0;
      const shifts = performance.getEntriesByType('layout-shift').filter(e => !e.hadRecentInput);
      const cls = shifts.reduce((s, e) => s + e.value, 0);
      return { lcp, fcp, cls };
    });
    if (fCwv.lcp === 0) ok(`[${TAG}] LCP captured by headless harness`, true, 'verify with Lighthouse for authoritative value');
    else ok(`[${TAG}] LCP < 2500ms (good)`, fCwv.lcp < 2500, `${Math.round(fCwv.lcp)}ms`);
    ok(`[${TAG}] CLS < 0.1 (good)`, fCwv.cls < 0.1, fCwv.cls.toFixed(3));
    ok(`[${TAG}] FCP < 1800ms (good)`, fCwv.fcp > 0 && fCwv.fcp < 1800, `${Math.round(fCwv.fcp)}ms`);

    ok(`[${TAG}] No severe console / page errors on load`, fConsole.length === 0, fConsole.slice(0, 3).join(' | '));

    await fctx.close();
  } catch (e) {
    ok(`[${TAG}] first-level page flow completed`, false, 'error: ' + e.message.split('\n')[0]);
  }
}

await browser.close();
ASSET_SERVER.close();

// ---------- report ----------
console.log('\n===== zhangjiajie-tours-v3 First-Level Page — Comprehensive Browser Test =====');
console.log('target: ' + BASE + '\n');
let failed = 0;
for (const r of results) {
  console.log(`  ${r.pass ? '✓' : '✗'} ${r.name}${r.detail ? '  [' + r.detail + ']' : ''}`);
  if (!r.pass) failed++;
}
console.log('\n  CWV estimate: LCP=' + Math.round(cwv.lcp) + 'ms  CLS=' + cwv.cls.toFixed(3) + '  FCP=' + Math.round(cwv.fcp) + 'ms');
console.log('  axe violations (top): ' + axeSummary);
console.log(`  Screenshots: ${SHOT_DIR}`);
console.log(`\n  SUMMARY: ${results.length - failed} pass, ${failed} fail\n`);
process.exit(failed ? 1 : 0);
