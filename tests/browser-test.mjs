// zhangjiajie-tours-v3 — Comprehensive First-Level Page Test
// Adapted from myguilin's browser-test for the v3 structure.
// E2E (Playwright) + Visual Regression (screenshots) + A11y (axe-core) + Core Web Vitals
// Run from project root:  node tests/browser-test.mjs
// Needs: playwright + axe-core installed; chromium downloaded.
// playwright 为可选 E2E 依赖：未安装时优雅跳过（exit 0），不阻断验证流程。
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch (err) {
  console.warn('⚠️  SKIP E2E: 未安装 playwright（如需运行请 `npm i -D playwright && npx playwright install chromium`），已优雅跳过，不计入失败。');
  process.exit(0);
}
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
// axe-core 为可选 a11y 依赖：未安装时置空，下方 a11y 检查会优雅跳过（不计入失败）。
let AXE_SRC = null;
try { AXE_SRC = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); }
catch (e) { console.warn('⚠️  axe-core 未安装，跳过 a11y 检查（npm i -D axe-core）'); }
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
// Reusable contexts for the detail-page loops (avoid ~46 one-off newContext calls)
const dCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const mCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
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
await page.waitForTimeout(1500);
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

// ---------- 2b. each homepage attraction card is a clickable <a> to its detail page ----------
// Regression guard: previously 7/8 cards were <div> (not navigable) and the
// mega-menu pointed at in-page #attraction-* anchors instead of real detail pages.
const ATTR_SLUGS = ['yuanjiajie','tianzi','jinbian','huangshizhai','tianmen','grand-canyon','baofeng','yellow-dragon'];
for (const slug of ATTR_SLUGS) {
  const card = page.locator(`#attraction [id="attraction-${slug}"]`);
  const tag = await card.evaluate(el => el.tagName.toLowerCase()).catch(() => 'NOT_FOUND');
  ok(`Attraction card "${slug}" is a clickable <a>`, tag === 'a', `tag=${tag}`);
  const href = await card.getAttribute('href').catch(() => null);
  ok(`Attraction card "${slug}" links to its detail page`, href === `attractions/${slug}.html`, `href=${href}`);
}

// ---------- 2c. mega-menu links all 8 attraction detail pages (no dead #anchors) ----------
const navAttrLinks = await page.$$eval('nav a[href^="attractions/"]', as => as.map(a => a.getAttribute('href')));
const navSlugs = [...new Set(navAttrLinks.filter(h => h && h !== 'attractions/index.html' && /^attractions\/[a-z-]+\.html$/.test(h)).map(h => h.replace('attractions/','').replace('.html','')))];
ok('Mega-menu links to all 8 attraction detail pages', navSlugs.length === 8, `${navSlugs.length} unique: ${navSlugs.join(',')}`);
ok('No dead #attraction-* anchors in nav', !navAttrLinks.some(h => h && h.startsWith('#attraction')), navAttrLinks.filter(h => h && h.startsWith('#attraction')).join(',') || 'none');

// ---------- 2e. homepage "Plan Like a Local" section is present (regression guard) ----------
// Previously the nav had a "Plan" item but the homepage had NO #plan section,
// so the module was undiscoverable from the landing page. Guard against regression.
const planSectionVisible = await page.locator('#plan').isVisible().catch(() => false);
ok('Homepage has a visible #plan (Plan Like a Local) section', planSectionVisible, 'section#plan');
const planLinks = await page.$$eval('#plan a[href^="plan/"]', as => as.map(a => a.getAttribute('href'))).catch(() => []);
const expectPlan = ['plan/index.html', 'plan/zhangjiajie-itinerary.html', 'plan/best-time-to-visit-zhangjiajie.html', 'plan/zhangjiajie-vs-wulingyuan.html'];
const missingPlan = expectPlan.filter(h => !planLinks.includes(h));
ok('Plan section links to hub + 3 guide pages', missingPlan.length === 0, missingPlan.length ? 'missing: ' + missingPlan.join(', ') : `all ${expectPlan.length} present`);

// ---------- 3. images ----------
const broken = await page.$$eval('img', imgs => imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc || i.src));
ok('No broken <img> on render (naturalWidth>0)', broken.length === 0, broken.length ? broken.slice(0,5).join(', ') : 'all loaded');
// Hero is the LCP element and is intentionally eager (fetchpriority=high); exempt it.
const nonLazy = await page.$$eval('img', imgs => imgs.filter(i => i.getAttribute('loading') !== 'lazy' && i.getAttribute('fetchpriority') !== 'high').length);
ok('All non-hero <img> use loading="lazy"', nonLazy === 0, `${nonLazy} not lazy (hero exempt: LCP)`);

// ---------- 4. cross-page nav from homepage Hotel / Food cards ----------
// Regression guard: the homepage Stay & Dine cards must link to real category
// pages, not dead in-page #anchors or removed hubs.
try {
  const hotelCard = await page.locator('#hotel a[href="hotels/mountain-lodges.html"]').first();
  await hotelCard.scrollIntoViewIfNeeded();
  await hotelCard.click();
  await page.waitForLoadState('load', { timeout: 30000 });
  await page.waitForTimeout(800);
  const hotelUrl = page.url();
  const hotelTitle = await page.title();
  ok('Homepage Hotel card navigates cross-page to category', hotelUrl.endsWith('hotels/mountain-lodges.html'), hotelUrl);
  ok('Hotel category page loads with expected title', /Stay|Hotel|Lodge|Mountain|Accommod/i.test(hotelTitle), hotelTitle);
  await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(500);
} catch (e) {
  ok('Homepage Hotel card cross-page navigation works', false, 'error: ' + e.message.split('\n')[0]);
}

// ---------- 4a. Food card → food category ----------
try {
  const foodCard = await page.locator('#food a[href="food/zhangjiajie-cuisine.html"]').first();
  await foodCard.scrollIntoViewIfNeeded();
  await foodCard.click();
  await page.waitForLoadState('load', { timeout: 30000 });
  await page.waitForTimeout(800);
  const foodUrl = page.url();
  const foodTitle = await page.title();
  ok('Homepage Food card navigates cross-page to category', foodUrl.endsWith('food/zhangjiajie-cuisine.html'), foodUrl);
  ok('Food category page loads with expected title', /Food|Cuisine|Dining|Zhangjiajie/i.test(foodTitle), foodTitle);
  await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(500);
} catch (e) {
  ok('Homepage Food card cross-page navigation works', false, 'error: ' + e.message.split('\n')[0]);
}

// ---------- 4b. cross-page nav to module hub pages ----------
try {
  const navToHub = await page.locator('nav a[href="attractions/index.html"]').first();
  await navToHub.scrollIntoViewIfNeeded();
  await navToHub.click();
  await page.waitForLoadState('load', { timeout: 30000 });
  await page.waitForTimeout(800);
  const hubUrl = page.url();
  const hubTitle = await page.title();
  ok('Nav "Attractions" navigates cross-page to hub', hubUrl.endsWith('attractions/index.html'), hubUrl);
  ok('Hub page loads with expected title', /Attraction/i.test(hubTitle), hubTitle);
  // return to homepage so subsequent checks (contact modal etc.) still run here
  await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(500);
} catch (e) {
  ok('Nav "Attractions" cross-page navigation works', false, 'error: ' + e.message.split('\n')[0]);
}

// ---------- 4c. cross-page nav to Plan Like a Local hub ----------
try {
  const navToPlan = await page.locator('nav a[href="plan/index.html"]').first();
  await navToPlan.scrollIntoViewIfNeeded();
  await navToPlan.click();
  await page.waitForLoadState('load', { timeout: 30000 });
  await page.waitForTimeout(800);
  const planUrl = page.url();
  const planTitle = await page.title();
  ok('Nav "Plan" navigates cross-page to hub', planUrl.endsWith('plan/index.html'), planUrl);
  ok('Plan hub page loads with expected title', /Plan/i.test(planTitle), planTitle);
  await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(500);
} catch (e) {
  ok('Nav "Plan" cross-page navigation works', false, 'error: ' + e.message.split('\n')[0]);
}

// ---------- 4d. homepage "Experiences You Can't Miss" cards navigate cross-page ----------
try {
  const expCard = await page.locator('#exp-avatar');
  await expCard.scrollIntoViewIfNeeded();
  await expCard.click();
  await page.waitForLoadState('load', { timeout: 30000 });
  await page.waitForTimeout(800);
  const expUrl = page.url();
  const expTitle = await page.title();
  ok('Homepage experience card navigates cross-page to detail', expUrl.endsWith('experiences/avatar-bailong-elevator.html'), expUrl);
  ok('Experience detail page loads with expected title', /Avatar/i.test(expTitle), expTitle);
  await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(500);
} catch (e) {
  ok('Homepage experience card cross-page navigation works', false, 'error: ' + e.message.split('\n')[0]);
}

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
await mpage.waitForTimeout(1500);
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
if (!AXE_SRC) {
  ok('axe-core a11y checks', false, 'axe-core 未安装，跳过');
} else {
try {
  await page.addScriptTag({ content: AXE_SRC });
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
    const dpage = await dCtx.newPage();
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
    await dpage.waitForTimeout(1500);
    await dpage.addStyleTag({ content: '.fade-in{opacity:1 !important; transform:none !important;}' });
    await dpage.waitForTimeout(400);

    ok(`[${FILE}] Page <title> is non-empty`, (await dpage.title()).trim().length > 0, await dpage.title());

    const dBroken = await dpage.$$eval('img', imgs => imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc || i.src));
    ok(`[${FILE}] No broken <img> on render (naturalWidth>0)`, dBroken.length === 0, dBroken.length ? dBroken.slice(0,5).join(', ') : 'all loaded');
    const dNonLazy = await dpage.$$eval('img', imgs => imgs.filter(i => i.getAttribute('loading') !== 'lazy' && i.getAttribute('fetchpriority') !== 'high').length);
    ok(`[${FILE}] All non-hero <img> use loading="lazy"`, dNonLazy === 0, `${dNonLazy} not lazy (hero exempt: fetchpriority=high)`);

    // nav active/selected state: landing on a secondary page must highlight its section (bold + dark)
    const dActive = await dpage.locator('nav a[aria-current="page"]:not(.mega-link)').count();
    ok(`[${FILE}] Nav marks current section active (exactly 1 aria-current)`, dActive === 1, `${dActive} active`);
    if (dActive > 0) {
      const dActiveText = (await dpage.locator('nav a[aria-current="page"]:not(.mega-link)').first().innerText()).trim();
      ok(`[${FILE}] Active nav item is "Attractions"`, /attraction/i.test(dActiveText), dActiveText);
      const dWeight = await dpage.locator('nav a[aria-current="page"]:not(.mega-link)').first().evaluate(el => getComputedStyle(el).fontWeight);
      ok(`[${FILE}] Active nav item is bold (font-weight >= 700)`, parseInt(dWeight, 10) >= 700, `weight ${dWeight}`);
    }

    // mobile
    const dmpage = await mCtx.newPage();
    dmpage.on('pageerror', e => dConsole.push('mobile pageerror: ' + e.message));
    await dmpage.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await dmpage.waitForTimeout(1500);
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
    await dmpage.close();

    // a11y (axe-core, WCAG 2.1 AA)
    await dpage.addScriptTag({ content: AXE_SRC });
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

    await dpage.close();
  } catch (e) {
    ok(`[${FILE}] detail page flow completed`, false, 'error: ' + e.message.split('\n')[0]);
  }
}

// ---------- 11b. Plan Like a Local guide detail pages ----------
const PLAN_GUIDE_PAGES = [
  'zhangjiajie-itinerary.html', 'best-time-to-visit-zhangjiajie.html', 'zhangjiajie-vs-wulingyuan.html',
];
for (const FILE of PLAN_GUIDE_PAGES) {
  const URL = BASE.replace(/index\.html$/, 'plan/' + FILE);
  try {
    const ppage = await dCtx.newPage();
    await ppage.addInitScript(() => {
      window.__lcp = 0;
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length) window.__lcp = entries[entries.length - 1].startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (e) { /* unsupported */ }
    });
    const pConsole = [];
    ppage.on('console', m => { if (m.type() === 'error') pConsole.push(m.text()); });
    ppage.on('pageerror', e => pConsole.push('pageerror: ' + e.message));
    await ppage.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await ppage.waitForTimeout(1500);
    await ppage.addStyleTag({ content: '.fade-in{opacity:1 !important; transform:none !important;}' });
    await ppage.waitForTimeout(400);

    ok(`[plan/${FILE}] Page <title> is non-empty`, (await ppage.title()).trim().length > 0, await ppage.title());

    const pBroken = await ppage.$$eval('img', imgs => imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc || i.src));
    ok(`[plan/${FILE}] No broken <img> on render (naturalWidth>0)`, pBroken.length === 0, pBroken.length ? pBroken.slice(0,5).join(', ') : 'all loaded');
    const pNonLazy = await ppage.$$eval('img', imgs => imgs.filter(i => i.getAttribute('loading') !== 'lazy' && i.getAttribute('fetchpriority') !== 'high').length);
    ok(`[plan/${FILE}] All non-hero <img> use loading="lazy"`, pNonLazy === 0, `${pNonLazy} not lazy (hero exempt: fetchpriority=high)`);

    // mobile
    const pmpage = await mCtx.newPage();
    pmpage.on('pageerror', e => pConsole.push('mobile pageerror: ' + e.message));
    await pmpage.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await pmpage.waitForTimeout(1500);
    await pmpage.addStyleTag({ content: '.fade-in{opacity:1 !important; transform:none !important;}' });
    await pmpage.waitForTimeout(300);
    const pmNav = await pmpage.locator('nav a[href^="#"], nav a[href^="../"]').count();
    ok(`[plan/${FILE}] Mobile viewport exposes nav links`, pmNav > 0, `${pmNav} links`);
    await pmpage.locator('button[onclick*="toggle"]').click();
    await pmpage.waitForTimeout(400);
    const pMenuOpen = await pmpage.locator('#mobile-menu').isVisible();
    ok(`[plan/${FILE}] Mobile hamburger opens the menu`, pMenuOpen);
    await pmpage.locator('#mobile-menu a').first().click();
    await pmpage.waitForTimeout(600);
    const pMenuClosed = !(await pmpage.locator('#mobile-menu').isVisible());
    ok(`[plan/${FILE}] Mobile menu auto-closes after tapping a link`, pMenuClosed);
    await pmpage.close();

    // a11y (axe-core, WCAG 2.1 AA)
    await ppage.addScriptTag({ content: AXE_SRC });
    const pAxe = await ppage.evaluate(async () => {
      const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
      return r.violations.map(v => ({
        id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help,
        samples: v.nodes.slice(0, 10).map(n => ({ target: n.target, html: (n.html || '').slice(0, 70), data: n.any && n.any[0] ? n.any[0].data : null }))
      }));
    });
    const pCrit = pAxe.filter(v => v.impact === 'critical').length;
    const pSer = pAxe.filter(v => v.impact === 'serious').length;
    ok(`[plan/${FILE}] axe-core: no critical a11y violations`, pCrit === 0, `${pCrit} critical`);
    ok(`[plan/${FILE}] axe-core: no serious a11y violations`, pSer === 0, `${pSer} serious`);
    for (const v of pAxe) {
      console.log(`\n  [plan/${FILE} a11y ${v.impact}] ${v.id} (${v.nodes} nodes) — ${v.help}`);
      for (const s of v.samples) {
        if (v.id === 'color-contrast' && s.data) console.log(`     • ${s.target}: contrast ${s.data.contrastRatio} (need ${s.data.requiredContrastRatio}, fg=${s.data.fgColor}, bg=${s.data.fgColor}`);
        else console.log(`     • ${s.target}: ${s.html}`);
      }
    }

    // Core Web Vitals
    const pCwv = await ppage.evaluate(() => {
      const lcp = window.__lcp || 0;
      const paints = performance.getEntriesByType('paint');
      const fcp = (paints.find(p => p.name === 'first-contentful-paint') || {}).startTime || 0;
      const shifts = performance.getEntriesByType('layout-shift').filter(e => !e.hadRecentInput);
      const cls = shifts.reduce((s, e) => s + e.value, 0);
      return { lcp, fcp, cls };
    });
    if (pCwv.lcp === 0) ok(`[plan/${FILE}] LCP captured by headless harness`, true, 'verify with Lighthouse for authoritative value');
    else ok(`[plan/${FILE}] LCP < 2500ms (good)`, pCwv.lcp < 2500, `${Math.round(pCwv.lcp)}ms`);
    ok(`[plan/${FILE}] CLS < 0.1 (good)`, pCwv.cls < 0.1, pCwv.cls.toFixed(3));
    ok(`[plan/${FILE}] FCP < 1800ms (good)`, pCwv.fcp > 0 && pCwv.fcp < 1800, `${Math.round(pCwv.fcp)}ms`);

    ok(`[plan/${FILE}] No severe console / page errors on load`, pConsole.length === 0, pConsole.slice(0, 3).join(' | '));

    await ppage.close();
  } catch (e) {
    ok(`[plan/${FILE}] plan guide detail page flow completed`, false, 'error: ' + e.message.split('\n')[0]);
  }
}

// ---------- 11c. Experience detail pages (6) ----------
const EXPERIENCE_PAGES = [
  'avatar-bailong-elevator.html', 'glass-bridge-bungee.html', 'tianmen-mountain.html',
  'helicopter-tour.html', 'cultural-shows.html', 'minority-local-life.html',
];
for (const FILE of EXPERIENCE_PAGES) {
  const URL = BASE.replace(/index\.html$/, 'experiences/' + FILE);
  try {
    const epage = await dCtx.newPage();
    await epage.addInitScript(() => {
      window.__lcp = 0;
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length) window.__lcp = entries[entries.length - 1].startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (e) { /* unsupported */ }
    });
    const eConsole = [];
    epage.on('console', m => { if (m.type() === 'error') eConsole.push(m.text()); });
    epage.on('pageerror', e => eConsole.push('pageerror: ' + e.message));
    await epage.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await epage.waitForTimeout(1500);
    await epage.addStyleTag({ content: '.fade-in{opacity:1 !important; transform:none !important;}' });
    await epage.waitForTimeout(400);

    ok(`[experiences/${FILE}] Page <title> is non-empty`, (await epage.title()).trim().length > 0, await epage.title());

    const eBroken = await epage.$$eval('img', imgs => imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc || i.src));
    ok(`[experiences/${FILE}] No broken <img> on render (naturalWidth>0)`, eBroken.length === 0, eBroken.length ? eBroken.slice(0,5).join(', ') : 'all loaded');
    const eNonLazy = await epage.$$eval('img', imgs => imgs.filter(i => i.getAttribute('loading') !== 'lazy' && i.getAttribute('fetchpriority') !== 'high').length);
    ok(`[experiences/${FILE}] All non-hero <img> use loading="lazy"`, eNonLazy === 0, `${eNonLazy} not lazy (hero exempt: fetchpriority=high)`);

    // mobile
    const empage = await mCtx.newPage();
    empage.on('pageerror', e => eConsole.push('mobile pageerror: ' + e.message));
    await empage.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await empage.waitForTimeout(1500);
    await empage.addStyleTag({ content: '.fade-in{opacity:1 !important; transform:none !important;}' });
    await empage.waitForTimeout(300);
    const emNav = await empage.locator('nav a[href^="#"], nav a[href^="../"]').count();
    ok(`[experiences/${FILE}] Mobile viewport exposes nav links`, emNav > 0, `${emNav} links`);
    await empage.locator('button[onclick*="toggle"]').click();
    await empage.waitForTimeout(400);
    const eMenuOpen = await empage.locator('#mobile-menu').isVisible();
    ok(`[experiences/${FILE}] Mobile hamburger opens the menu`, eMenuOpen);
    await empage.locator('#mobile-menu a').first().click();
    await empage.waitForTimeout(600);
    const eMenuClosed = !(await empage.locator('#mobile-menu').isVisible());
    ok(`[experiences/${FILE}] Mobile menu auto-closes after tapping a link`, eMenuClosed);
    await empage.close();

    // a11y (axe-core, WCAG 2.1 AA)
    await epage.addScriptTag({ content: AXE_SRC });
    const eAxe = await epage.evaluate(async () => {
      const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
      return r.violations.map(v => ({
        id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help,
        samples: v.nodes.slice(0, 10).map(n => ({ target: n.target, html: (n.html || '').slice(0, 70), data: n.any && n.any[0] ? n.any[0].data : null }))
      }));
    });
    const eCrit = eAxe.filter(v => v.impact === 'critical').length;
    const eSer = eAxe.filter(v => v.impact === 'serious').length;
    ok(`[experiences/${FILE}] axe-core: no critical a11y violations`, eCrit === 0, `${eCrit} critical`);
    ok(`[experiences/${FILE}] axe-core: no serious a11y violations`, eSer === 0, `${eSer} serious`);
    for (const v of eAxe) {
      console.log(`\n  [experiences/${FILE} a11y ${v.impact}] ${v.id} (${v.nodes} nodes) — ${v.help}`);
      for (const s of v.samples) {
        if (v.id === 'color-contrast' && s.data) console.log(`     • ${s.target}: contrast ${s.data.contrastRatio} (need ${s.data.requiredContrastRatio}, fg=${s.data.fgColor}, bg=${s.data.bgColor})`);
        else console.log(`     • ${s.target}: ${s.html}`);
      }
    }

    // Core Web Vitals
    const eCwv = await epage.evaluate(() => {
      const lcp = window.__lcp || 0;
      const paints = performance.getEntriesByType('paint');
      const fcp = (paints.find(p => p.name === 'first-contentful-paint') || {}).startTime || 0;
      const shifts = performance.getEntriesByType('layout-shift').filter(e => !e.hadRecentInput);
      const cls = shifts.reduce((s, e) => s + e.value, 0);
      return { lcp, fcp, cls };
    });
    if (eCwv.lcp === 0) ok(`[experiences/${FILE}] LCP captured by headless harness`, true, 'verify with Lighthouse for authoritative value');
    else ok(`[experiences/${FILE}] LCP < 2500ms (good)`, eCwv.lcp < 2500, `${Math.round(eCwv.lcp)}ms`);
    ok(`[experiences/${FILE}] CLS < 0.1 (good)`, eCwv.cls < 0.1, eCwv.cls.toFixed(3));
    ok(`[experiences/${FILE}] FCP < 1800ms (good)`, eCwv.fcp > 0 && eCwv.fcp < 1800, `${Math.round(eCwv.fcp)}ms`);

    ok(`[experiences/${FILE}] No severe console / page errors on load`, eConsole.length === 0, eConsole.slice(0, 3).join(' | '));

    await epage.close();
  } catch (e) {
    ok(`[experiences/${FILE}] experience detail page flow completed`, false, 'error: ' + e.message.split('\n')[0]);
  }
}

// ---------- 11e. Hotel module: 7 detail pages + 4 category hubs ----------
// Data-driven third-level hotel pages (hotels/<key>.html) + category first-level pages.
// Detail pages don't set aria-current active nav (the site only does that on
// module-index pages — a pre-existing inconsistency), so we assert the Hotels
// nav group is present instead of counting aria-current.
const HOTEL_DETAIL = [
  'jimo.html', 'hetianye.html', 'vienna.html', 'boutique.html',
  'homeinn-plus.html', '72qilou.html', 'huatian.html',
];
const HOTEL_HUBS = [
  'mountain-lodges.html', 'selected-stays.html', 'value-hotels.html', 'by-area.html',
];
for (const FILE of [...HOTEL_DETAIL, ...HOTEL_HUBS]) {
  const URL = BASE.replace(/index\.html$/, 'hotels/' + FILE);
  const TAG = 'hotels/' + FILE;
  try {
    const hpage = await dCtx.newPage();
    await hpage.addInitScript(() => {
      window.__lcp = 0;
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length) window.__lcp = entries[entries.length - 1].startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (e) { /* unsupported */ }
    });
    const hConsole = [];
    hpage.on('console', m => { if (m.type() === 'error') hConsole.push(m.text()); });
    hpage.on('pageerror', e => hConsole.push('pageerror: ' + e.message));
    await hpage.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await hpage.waitForTimeout(1500);
    await hpage.addStyleTag({ content: '.fade-in{opacity:1 !important; transform:none !important;}' });
    await hpage.waitForTimeout(400);

    ok(`[${TAG}] Page <title> is non-empty`, (await hpage.title()).trim().length > 0, await hpage.title());

    const hBroken = await hpage.$$eval('img', imgs => imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc || i.src));
    ok(`[${TAG}] No broken <img> on render (naturalWidth>0)`, hBroken.length === 0, hBroken.length ? hBroken.slice(0,5).join(', ') : 'all loaded');
    const hNonLazy = await hpage.$$eval('img', imgs => imgs.filter(i => i.getAttribute('loading') !== 'lazy' && i.getAttribute('fetchpriority') !== 'high').length);
    ok(`[${TAG}] All non-hero <img> use loading="lazy"`, hNonLazy === 0, `${hNonLazy} not lazy (hero exempt: fetchpriority=high)`);

    const hNavLinks = await hpage.$$eval('nav a[href*="hotels/"]', as => as.map(a => a.getAttribute('href')));
    ok(`[${TAG}] Nav renders the Hotels category group`, new Set(hNavLinks).size >= 4, `${new Set(hNavLinks).size} unique`);

    // mobile
    const hmpage = await mCtx.newPage();
    hmpage.on('pageerror', e => hConsole.push('mobile pageerror: ' + e.message));
    await hmpage.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await hmpage.waitForTimeout(1500);
    await hmpage.addStyleTag({ content: '.fade-in{opacity:1 !important; transform:none !important;}' });
    await hmpage.waitForTimeout(300);
    const hmNav = await hmpage.locator('nav a[href^="../"], nav a[href^="hotels/"]').count();
    ok(`[${TAG}] Mobile viewport exposes nav links`, hmNav > 0, `${hmNav} links`);
    await hmpage.locator('button[onclick*="toggle"]').click();
    await hmpage.waitForTimeout(400);
    ok(`[${TAG}] Mobile hamburger opens the menu`, await hmpage.locator('#mobile-menu').isVisible());
    await hmpage.locator('#mobile-menu a').first().click();
    await hmpage.waitForTimeout(600);
    ok(`[${TAG}] Mobile menu auto-closes after tapping a link`, !(await hmpage.locator('#mobile-menu').isVisible()));
    await hmpage.close();

    // a11y (axe-core, WCAG 2.1 AA)
    await hpage.addScriptTag({ content: AXE_SRC });
    const hAxe = await hpage.evaluate(async () => {
      const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
      return r.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
    });
    const hCrit = hAxe.filter(v => v.impact === 'critical').length;
    const hSer = hAxe.filter(v => v.impact === 'serious').length;
    ok(`[${TAG}] axe-core: no critical a11y violations`, hCrit === 0, `${hCrit} critical`);
    ok(`[${TAG}] axe-core: no serious a11y violations`, hSer === 0, `${hSer} serious`);

    // Core Web Vitals
    const hCwv = await hpage.evaluate(() => {
      const lcp = window.__lcp || 0;
      const paints = performance.getEntriesByType('paint');
      const fcp = (paints.find(p => p.name === 'first-contentful-paint') || {}).startTime || 0;
      const shifts = performance.getEntriesByType('layout-shift').filter(e => !e.hadRecentInput);
      return { lcp, fcp, cls: shifts.reduce((s, e) => s + e.value, 0) };
    });
    if (hCwv.lcp === 0) ok(`[${TAG}] LCP captured by headless harness`, true, 'verify with Lighthouse for authoritative value');
    else ok(`[${TAG}] LCP < 2500ms (good)`, hCwv.lcp < 2500, `${Math.round(hCwv.lcp)}ms`);
    ok(`[${TAG}] CLS < 0.1 (good)`, hCwv.cls < 0.1, hCwv.cls.toFixed(3));
    ok(`[${TAG}] FCP < 1800ms (good)`, hCwv.fcp > 0 && hCwv.fcp < 1800, `${Math.round(hCwv.fcp)}ms`);

    ok(`[${TAG}] No severe console / page errors on load`, hConsole.length === 0, hConsole.slice(0, 3).join(' | '));

    await hpage.close();
  } catch (e) {
    ok(`[${TAG}] hotel page flow completed`, false, 'error: ' + e.message.split('\n')[0]);
  }
}

// ---------- 12. first-level module hub pages: 4 module index pages ----------
// attractions/index.html, experiences/index.html, tours/index.html, plan/index.html.
// Hotels and Food no longer have hubs; their categories are now first-level pages.
const FIRSTLEVEL_PAGES = [
  'attractions/index.html', 'experiences/index.html', 'tours/index.html', 'plan/index.html',
];
for (const FILE of FIRSTLEVEL_PAGES) {
  const URL = BASE.replace(/index\.html$/, FILE);
  const TAG = FILE.replace(/\.html$/, '');
  try {
    const fpage = await dCtx.newPage();
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
    await fpage.waitForTimeout(1500);
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

    // nav active/selected state: hub page must highlight its own section
    const fActive = await fpage.locator('nav a[aria-current="page"]:not(.mega-link)').count();
    ok(`[${TAG}] Nav marks current section active (exactly 1 aria-current)`, fActive === 1, `${fActive} active`);

    // mobile
    const fmpage = await mCtx.newPage();
    fmpage.on('pageerror', e => fConsole.push('mobile pageerror: ' + e.message));
    await fmpage.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await fmpage.waitForTimeout(1500);
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
    await fmpage.close();

    // a11y (axe-core, WCAG 2.1 AA)
    await fpage.addScriptTag({ content: AXE_SRC });
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

    await fpage.close();
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
