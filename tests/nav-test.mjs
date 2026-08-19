// zhangjiajie-tours-v3 — Navigation Bar Focused E2E Test
// Scope: ONLY the navigation bar (desktop + mobile), header scroll behavior,
//       mega-menu, in-page anchors, logo overlap, keyboard + a11y (axe scoped to header).
// Run: node tests/nav-test.mjs   (from project root)
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
const SHOT_DIR = path.join(ROOT, 'tests', 'screenshots-nav');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
const ok = (name, cond, detail = '') => { results.push({ name, pass: !!cond, detail }); console.log(`  ${cond ? '✓' : '✗'} ${name}${detail ? '  [' + detail + ']' : ''}`); };
const consoleErrors = [];

const launchOpts = { args: ['--no-sandbox', '--disable-setuid-sandbox'] };
const browser = await chromium.launch(launchOpts);
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

const rel = (p) => BASE.replace(/index\.html$/, p);

console.log('\n===== NAV BAR TEST — ' + BASE + ' =====\n');
await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(1200);
await page.addStyleTag({ content: '.fade-in{opacity:1 !important; transform:none !important;}' });

// ---------- 1. top-level items present (desktop) ----------
const EXPECTED = ['Home', 'Attractions', 'Experiences', 'Tours', 'Hotels', 'Contact Us']; // Plan intentionally hidden (Food+Plan)
const topTexts = await page.$$eval('#main-header nav > ul > li', lis => lis.map(li => (li.textContent || '').replace(/\s+/g, ' ').trim()));
const joined = topTexts.join(' | ');
ok('Desktop nav exposes expected top-level items', EXPECTED.every(t => joined.includes(t)), joined);
// [FINDING] homepage #plan section is visible but no nav entry points to it (orphaned content)
const planSectionVisible = await page.locator('#plan').isVisible().catch(() => false);
const planInNav = await page.locator('#main-header nav a[href="plan/index.html"]').count();
ok('[FINDING] #plan section visible but NO nav link to it (orphaned)', !(planSectionVisible && planInNav === 0), `planSectionVisible=${planSectionVisible} planNavLinks=${planInNav}`);

// ---------- 2. mega-menu opens on hover (Attractions) ----------
try {
  const attrLi = page.locator('#main-header nav > ul > li:has-text("Attractions")').first();
  await attrLi.hover();
  await page.waitForTimeout(400);
  const megaVisible = await attrLi.locator('.mega-menu').evaluate(el => getComputedStyle(el).visibility === 'visible' && parseFloat(getComputedStyle(el).opacity) > 0.9).catch(() => false);
  ok('Mega-menu opens on hover (Attractions)', megaVisible);
  const megaLinks = await attrLi.locator('.mega-menu a').count();
  ok('Attractions mega-menu has links', megaLinks >= 8, `${megaLinks} links`);
  await page.screenshot({ path: path.join(SHOT_DIR, 'desktop-megamenu.png') });
  // caret rotates
  const caretRot = await attrLi.locator('.dropdown-caret').evaluate(el => getComputedStyle(el).transform);
  ok('Dropdown caret rotates on hover', caretRot !== 'none' && caretRot !== '', caretRot.slice(0, 24));
} catch (e) { ok('Mega-menu hover flow', false, e.message.split('\n')[0]); }
await page.mouse.move(10, 10); await page.waitForTimeout(300);

// ---------- 3. mega-menu link navigates cross-page ----------
try {
  const attrLi = page.locator('#main-header nav > ul > li:has-text("Attractions")').first();
  await attrLi.hover(); await page.waitForTimeout(300);
  await attrLi.locator('.mega-menu a[href="attractions/yuanjiajie.html"]').click();
  await page.waitForLoadState('load'); await page.waitForTimeout(800);
  ok('Mega-menu link navigates to detail page', page.url().endsWith('attractions/yuanjiajie.html'), page.url());
  await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(800);
} catch (e) { ok('Mega-menu link navigation', false, e.message.split('\n')[0]); }

// ---------- 4. cross-page nav (Attractions / Plan / Hotels) ----------
for (const [label, href] of [['Attractions', 'attractions/index.html'], ['Hotels', 'hotels/mountain-lodges.html']]) {
  try {
    const li = page.locator(`#main-header nav > ul > li:has-text("${label}")`).first();
    // top-level <a> (not mega-link)
    const link = li.locator('> a').first();
    await link.click();
    await page.waitForLoadState('load'); await page.waitForTimeout(700);
    ok(`Nav "${label}" navigates cross-page (${href})`, page.url().endsWith(href), page.url());
    await page.goto(BASE, { waitUntil: 'load' }); await page.waitForTimeout(600);
  } catch (e) { ok(`Nav "${label}" cross-page`, false, e.message.split('\n')[0]); }
}

// ---------- 5. in-page anchors scroll (Tours mega -> #tour-ranking; Home -> top) ----------
try {
  const toursLi = page.locator('#main-header nav > ul > li:has-text("Tours")').first();
  await toursLi.hover(); await page.waitForTimeout(300);
  await toursLi.locator('.mega-menu a[href="#tour-ranking"]').click();
  await page.waitForTimeout(900);
  const y1 = await page.evaluate(() => window.scrollY);
  ok('In-page anchor #tour-ranking scrolls page', y1 > 100, `scrollY=${y1}`);
  // back to top via Home
  const homeA = page.locator('#main-header nav a[href="#home"]').first();
  await homeA.click(); await page.waitForTimeout(900);
  const y0 = await page.evaluate(() => window.scrollY);
  ok('Home (#home) anchor scrolls to top', y0 < 200, `scrollY=${y0}`);
} catch (e) { ok('In-page anchor scroll flow', false, e.message.split('\n')[0]); }

// ---------- 6. logo vs first nav item overlap (multiple widths) ----------
async function logoOverlapAt(w) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(400);
  const logo = await page.locator('#main-header > a').first().boundingBox();
  const firstNav = await page.locator('#main-header nav > ul > li').first().boundingBox();
  if (!logo || !firstNav) return { w, overlap: false, note: 'no box' };
  const overlap = logo.x + logo.width > firstNav.x + 1 && logo.y < firstNav.y + firstNav.height && logo.y + logo.height > firstNav.y;
  const gap = Math.round(firstNav.x - (logo.x + logo.width));
  return { w, overlap, gap };
}
for (const w of [1280, 1180, 1100, 1024]) {
  const r = await logoOverlapAt(w);
  ok(`Logo does NOT overlap nav @${w}px`, !r.overlap, r.overlap ? `OVERLAP (logo right=${(r.logo?0:0)})` : `gap=${r.gap}px`);
}
await page.setViewportSize({ width: 1280, height: 900 }); await page.waitForTimeout(300);

// ---------- 7. header scroll: transparent -> solid ----------
try {
  const atTopBg = await page.locator('#main-header').evaluate(el => getComputedStyle(el).backgroundColor);
  const atTopLink = await page.locator('.header-nav-link').first().evaluate(el => getComputedStyle(el).color);
  await page.evaluate(() => window.scrollTo(0, 2200)); await page.waitForTimeout(800);
  const scrolled = await page.locator('#main-header').evaluate(el => el.classList.contains('header-scrolled'));
  const scrolledBg = await page.locator('#main-header').evaluate(el => getComputedStyle(el).backgroundColor);
  const scrolledLink = await page.locator('.header-nav-link').first().evaluate(el => getComputedStyle(el).color);
  ok('Header adds .header-scrolled after scroll>60', scrolled, `class=${scrolled}`);
  ok('Header bg: transparent at top → solid when scrolled', /rgba\(0, 0, 0, 0\)|transparent/.test(atTopBg) && !/rgba\(0, 0, 0, 0\)|transparent/.test(scrolledBg), `top=${atTopBg} scrolled=${scrolledBg}`);
  ok('Nav link color: light at top → dark when scrolled', atTopLink !== scrolledLink, `top=${atTopLink} scrolled=${scrolledLink}`);
  await page.screenshot({ path: path.join(SHOT_DIR, 'desktop-scrolled.png') });
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);
} catch (e) { ok('Header scroll behavior', false, e.message.split('\n')[0]); }

// ---------- 8. keyboard: focus opens mega-menu (focus-within) ----------
try {
  const attrLink = page.locator('#main-header nav > ul > li:has-text("Attractions")').first().locator('> a').first();
  await attrLink.focus();
  await page.waitForTimeout(400);
  const kbMega = await page.locator('#main-header nav > ul > li:has-text("Attractions")').first().locator('.mega-menu').evaluate(el => getComputedStyle(el).visibility === 'visible').catch(() => false);
  ok('Keyboard focus opens mega-menu (focus-within)', kbMega);
  await page.keyboard.press('Escape');
} catch (e) { ok('Keyboard focus opens mega-menu', false, e.message.split('\n')[0]); }

await page.screenshot({ path: path.join(SHOT_DIR, 'desktop-nav.png') });

// ---------- 9. a11y (axe scoped to header/nav) ----------
try {
  const axePath = require.resolve('axe-core/axe.min.js');
  const AXE_SRC = fs.readFileSync(axePath, 'utf8');
  await page.addScriptTag({ content: AXE_SRC });
  const axeRes = await page.evaluate(async () => {
    const r = await axe.run(document.querySelector('#main-header'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    return r.violations.map(v => ({
      id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help,
      samples: v.nodes.slice(0, 4).map(n => ({ target: n.target, html: (n.html || '').slice(0, 60), data: n.any && n.any[0] ? n.any[0].data : null })),
    }));
  });
  const crit = axeRes.filter(v => v.impact === 'critical').length;
  const ser = axeRes.filter(v => v.impact === 'serious').length;
  ok('axe (header scope): no critical violations', crit === 0, `${crit} critical`);
  ok('axe (header scope): no serious violations', ser === 0, `${ser} serious`);
  for (const v of axeRes) {
    console.log(`     [a11y ${v.impact}] ${v.id} (${v.nodes}) — ${v.help}`);
    for (const s of v.samples) {
      if (v.id === 'color-contrast' && s.data) console.log(`       • ${s.target}: contrast ${s.data.contrastRatio} (need ${s.data.requiredContrastRatio}, fg=${s.data.fgColor}, bg=${s.data.bgColor})`);
      else console.log(`       • ${s.target}: ${s.html}`);
    }
  }
} catch (e) { ok('axe (header scope) ran', false, 'axe-core not available: ' + e.message.split('\n')[0]); }

// ---------- 10. mobile nav ----------
try {
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const m = await mctx.newPage();
  m.on('pageerror', e => consoleErrors.push('mobile: ' + e.message));
  await m.goto(BASE, { waitUntil: 'load' }); await m.waitForTimeout(1200);
  const desktopVisibleMobile = await page.locator('#main-header nav').isVisible();
  const navHiddenMobile = !(await m.locator('#main-header nav').isVisible());
  ok('Mobile: desktop nav hidden', navHiddenMobile);
  const toggleVisible = await m.locator('button[onclick*="toggle"]').isVisible();
  ok('Mobile: hamburger toggle visible', toggleVisible);
  await m.locator('button[onclick*="toggle"]').click(); await m.waitForTimeout(400);
  const menuOpen = await m.locator('#mobile-menu').isVisible();
  ok('Mobile: hamburger opens menu', menuOpen);
  await m.screenshot({ path: path.join(SHOT_DIR, 'mobile-menu.png') });
  // tap a link closes menu
  await m.locator('#mobile-menu a[onclick*="closeMobileMenu"]').first().click(); await m.waitForTimeout(600);
  const menuClosed = !(await m.locator('#mobile-menu').isVisible());
  ok('Mobile: menu auto-closes on link tap', menuClosed);
  // mobile nav links navigate
  await m.locator('button[onclick*="toggle"]').click(); await m.waitForTimeout(300);
  await m.locator('#mobile-menu a[href="attractions/index.html"]').first().click();
  await m.waitForLoadState('load'); await m.waitForTimeout(700);
  ok('Mobile: nav link navigates cross-page', m.url().endsWith('attractions/index.html'), m.url());
  // contact button opens modal + closes menu
  await m.goto(BASE, { waitUntil: 'load' }); await m.waitForTimeout(600);
  await m.locator('button[onclick*="toggle"]').click(); await m.waitForTimeout(300);
  await m.locator('#mobile-menu button[onclick*="openContactModal"]').click(); await m.waitForTimeout(500);
  const modalOpen = await m.locator('#contactModal').isVisible();
  const menuClosed2 = !(await m.locator('#mobile-menu').isVisible());
  ok('Mobile: Contact opens modal AND closes menu', modalOpen && menuClosed2, `modal=${modalOpen} menuClosed=${menuClosed2}`);
  await mctx.close();
} catch (e) { ok('Mobile nav flow', false, e.message.split('\n')[0]); }

// ---------- 11. subpage header: solid + nav consistency (Food/Plan hidden site-wide) ----------
try {
  const subs = ['attractions/index.html', 'plan/index.html', 'hotels/mountain-lodges.html', 'experiences/index.html', 'tours/index.html', 'food/zhangjiajie-cuisine.html'];
  for (const p of subs) {
    const sctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const sp = await sctx.newPage();
    await sp.goto(rel(p), { waitUntil: 'load' }); await sp.waitForTimeout(1000);
    const headerBg = await sp.locator('header').first().evaluate(el => getComputedStyle(el).backgroundColor).catch(() => null);
    const solid = !/rgba\(0, 0, 0, 0\)|transparent/.test(headerBg || '');
    ok(`Subpage ${p}: header is solid (not transparent) at top`, solid, `headerBg=${headerBg}`);
    const foodVisible = await sp.locator('header nav a[href*="food/"]').first().isVisible().catch(() => false);
    const planVisible = await sp.locator('header nav a[href*="plan/"]').first().isVisible().catch(() => false);
    ok(`Subpage ${p}: top-nav hides Food (consistent with homepage)`, !foodVisible, `foodVisible=${foodVisible}`);
    ok(`Subpage ${p}: top-nav hides Plan (consistent with homepage)`, !planVisible, `planVisible=${planVisible}`);
    const foodMob = await sp.locator('#mobile-menu a[href*="food/"]').first().isVisible().catch(() => false);
    ok(`Subpage ${p}: mobile menu hides Food`, !foodMob, `foodMobVisible=${foodMob}`);
    await sp.screenshot({ path: path.join(SHOT_DIR, 'subpage-' + p.replace(/\//g, '-').replace('.html', '') + '.png') });
    await sctx.close();
  }
} catch (e) { ok('Subpage header check', false, e.message.split('\n')[0]); }

// ---------- 12. console errors ----------
ok('No severe console / page errors on load', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

await browser.close();
ASSET_SERVER.close();

const failed = results.filter(r => !r.pass).length;
console.log(`\n  NAV TEST SUMMARY: ${results.length - failed} pass, ${failed} fail`);
console.log(`  Screenshots: ${SHOT_DIR}\n`);
process.exit(failed ? 1 : 0);
