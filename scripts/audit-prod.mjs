// 线上站综合审计：功能 + 响应头 + 移动端 + 视觉 + CWV
// 用法: PROD_URL=https://willyye.github.io/zhangjiajie-tours-v3/ node scripts/audit-prod.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const URL = process.env.PROD_URL || 'https://willyye.github.io/zhangjiajie-tours-v3/';
const OUT = '/tmp/prod-audit';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, cond, detail = '') => { results.push({ name, pass: !!cond, detail }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch();

  // ---------- 桌面：功能 + 响应头 + CWV + axe ----------
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const respHeaders = {};
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('response', async r => {
    const u = r.url();
    if (u === URL || u.endsWith('.woff2') || u.endsWith('.webp') || u.endsWith('lucide.min.js') || u.endsWith('fonts.css') || u.endsWith('tailwind.css')) {
      respHeaders[u] = r.headers();
    }
  });

  const lcpData = { lcp: 0 };
  await page.addInitScript(() => {
    window.__lcp = 0;
    try {
      new PerformanceObserver(list => { const e = list.getEntries(); window.__lcp = e[e.length - 1].startTime; })
        .observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {}
  });

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  // 资源完整性
  const imgInfo = await page.$$eval('img', els => els.map(i => ({
    src: i.currentSrc || i.src,
    nw: i.naturalWidth, nh: i.naturalHeight,
    alt: i.alt,
    lazy: i.getAttribute('loading'),
  })));
  const broken = imgInfo.filter(i => i.nw === 0);
  ok('无破图 (naturalWidth>0)', broken.length === 0, broken.length ? `broken: ${broken.map(b => b.src).join(', ')}` : `${imgInfo.length} 张图全部加载`);

  // 字体
  const fontApplied = await page.evaluate(async () => {
    await document.fonts.ready;
    const hero = document.querySelector('#home h1') || document.querySelector('h1');
    const heroFam = hero ? getComputedStyle(hero).fontFamily : '';
    return {
      inter: document.fonts.check("16px Inter"),
      playfair400: document.fonts.check("400 16px 'Playfair Display'"),
      heroFam,
    };
  });
  ok('Inter 字体已应用', fontApplied.inter, fontApplied.inter ? 'body=Inter' : 'FALLBACK');
  ok('Playfair Display 已应用 (hero)', fontApplied.playfair400 && /Playfair/.test(fontApplied.heroFam), `hero font-family=${fontApplied.heroFam}`);

  // Lucide 渲染成 svg
  const lucideSvgs = await page.$$eval('svg.lucide', e => e.length);
  ok('Lucide 渲染为真实 <svg>', lucideSvgs > 0, `${lucideSvgs} 个 lucide svg`);

  // 零外部运行时依赖
  const ext = await page.evaluate(() => {
    const same = new URL(location.href).origin;
    const out = new Set();
    document.querySelectorAll('img,script,link[rel=stylesheet],link[rel=preload]').forEach(el => {
      const u = el.src || el.href;
      if (u && !u.startsWith(same) && !u.startsWith('data:') && !u.startsWith('blob:')) out.add(new URL(u, location.href).host);
    });
    return [...out];
  });
  ok('零外部运行时依赖', ext.length === 0, ext.length ? `外部域名: ${ext.join(', ')}` : '仅同源请求');

  // SEO / 结构化
  const seo = await page.evaluate(() => ({
    ogTitle: !!document.querySelector('meta[property="og:title"]'),
    ogImage: !!document.querySelector('meta[property="og:image"]'),
    twCard: !!document.querySelector('meta[name="twitter:card"]'),
    canonical: !!document.querySelector('link[rel="canonical"]'),
    themeColor: !!document.querySelector('meta[name="theme-color"]'),
    jsonld: !!document.querySelector('script[type="application/ld+json"]'),
    title: document.title,
    desc: !!document.querySelector('meta[name="description"]'),
    lang: document.documentElement.lang,
  }));
  ok('OG/Twitter/JSON-LD/基础SEO 齐全', seo.ogTitle && seo.ogImage && seo.twCard && seo.canonical && seo.themeColor && seo.jsonld && seo.desc && seo.lang === 'en', JSON.stringify(seo));

  // 地标 / 跳转
  const landmarks = await page.evaluate(() => ({
    main: !!document.getElementById('main'),
    skiplink: !!document.querySelector('a.skip-link'),
    h1: document.querySelectorAll('h1').length,
  }));
  ok('语义地标 + skip-link 存在', landmarks.main && landmarks.skiplink && landmarks.h1 === 1, JSON.stringify(landmarks));

  // axe
  let axe = { violations: [] };
  const axePath = require.resolve('axe-core/axe.min.js');
  await page.addScriptTag({ path: axePath });
  axe = await page.evaluate(async () => await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }));
  const crit = axe.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
  ok('axe WCAG 2.1 AA 无 critical/serious', crit.length === 0, `${axe.violations.length} 总违规 / ${crit.length} 严重`);

  // CWV
  const cwv = await page.evaluate(() => ({
    lcp: window.__lcp || 0,
    cls: performance.getEntriesByType('layout-shift').reduce((s, e) => s + (e.hadRecentInput ? 0 : e.value), 0),
    fcp: (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0,
  }));
  ok('CLS < 0.1', cwv.cls < 0.1, `CLS=${cwv.cls.toFixed(3)}`);
  ok('LCP < 2.5s (容器环境, 参考值)', cwv.lcp < 2500, `LCP=${Math.round(cwv.lcp)}ms`);
  ok('FCP < 1.8s (容器环境, 参考值)', cwv.fcp < 1800, `FCP=${Math.round(cwv.fcp)}ms`);

  // 响应头（重点：_headers 是否真的生效）
  const docH = respHeaders[URL] || {};
  const secHeaders = ['referrer-policy', 'x-content-type-options', 'x-frame-options', 'permissions-policy', 'content-security-policy'];
  const present = secHeaders.filter(h => docH[h]);
  ok('安全响应头已下发 (Referrer-Policy 等)', present.length > 0, `实际下发: ${present.length ? present.join(', ') : 'NONE（_headers 在 GitHub Pages 未生效）'}`);
  ok('静态资源 immutable 长缓存', /immutable|max-age=31536000/.test((respHeaders[URL] || {})['cache-control'] || ''), `首页 cache-control=${(docH['cache-control'] || '无')}`);

  ok('无 console 错误', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  await page.screenshot({ path: `${OUT}/desktop.png`, fullPage: true });

  // ---------- 移动端 375px ----------
  const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const mpage = await mctx.newPage();
  await mpage.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await mpage.waitForTimeout(1000);
  const mobile = await mpage.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    scrollW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
    heroW: (document.querySelector('#home img') || {}).naturalWidth || 0,
    navVisible: !!document.querySelector('nav') || !!document.querySelector('header nav'),
    ctaVisible: !!Array.from(document.querySelectorAll('a,button')).find(e => /explore|discover|book|whatsapp/i.test(e.textContent || '')),
  }));
  ok('移动端无横向溢出', !mobile.overflowX, `scrollW=${mobile.scrollW} winW=${mobile.winW}`);
  ok('移动端 hero 图加载', mobile.heroW > 0, `hero naturalWidth=${mobile.heroW}`);
  await mpage.screenshot({ path: `${OUT}/mobile.png`, fullPage: false });

  await browser.close();

  const passed = results.filter(r => r.pass).length;
  console.log(`\n===== 汇总: ${passed}/${results.length} 通过 =====`);
  // 关键响应头明细
  console.log('--- 响应头实测 ---');
  console.log('首页:', JSON.stringify(docH, null, 0));
  console.log('woff2:', JSON.stringify(respHeaders[Object.keys(respHeaders).find(k => k.endsWith('.woff2'))] || {}));
  const fails = results.filter(r => !r.pass);
  if (fails.length) { console.log('FAIL 项:'); fails.forEach(f => console.log('  -', f.name, '::', f.detail)); }
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('RUNNER ERROR:', e); process.exit(2); });
