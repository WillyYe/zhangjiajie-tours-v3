// imglib-isolation-loop.mjs —— 「体验模块隔离图库 + 选图跳到并显示 + 前后台映射」闭环验证。
//
// 背景（本轮需求）：
//   1) 体验模块要做成与酒店同构的「模块 + 详情页 + 本模块独立图片库」结构；
//      体验图片物理隔离到 images/experiences/，景点继续用根 images/（11/12 张图两边共用，
//      所以是 COPY 而非 MOVE，根目录必须保持完整，否则景点破图）。
//   2) 图库选图后要「直接跳到对应的图片，并显示出来」：
//      打开图库时定位到当前已选图（.selected + scrollIntoView），
//      点选后关闭弹窗、回填输入框、缩略图立刻换图、并滚动+高亮该字段。
//   3) 前后台必须正确映射：build 出来的详情页与后台 iframe 预览都必须解析到同一路径。
//
// 本 loop 分两层：
//   A. 静态层（构建产物 + 纯函数）——保证前台映射正确、景点零回归、避免 .map(imgSrc) 索引坑
//   B. 浏览器层（Playwright + 真实 admin 页面）——保证后台三个模块的图库行为真的可用

import { chromium } from 'playwright';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { buildPageMap, imgSrc } from '../scripts/fragments.mjs';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const http = require('http');

const results = [];
function assert(cond, msg) { results.push({ ok: !!cond, msg }); }

console.log('━━━ imglib-isolation-loop ━━━');
console.log('── A 静态层：前台映射与零回归 ──');

// A1 隔离目录存在且与数据引用一一对应
const ISO_DIR = path.join(ROOT, 'images/experiences');
const isoFiles = fs.existsSync(ISO_DIR) ? fs.readdirSync(ISO_DIR).filter((f) => /\.webp$/i.test(f)) : [];
assert(isoFiles.length > 0, `images/experiences/ 隔离图库存在且非空（${isoFiles.length} 张）`);

// A2 体验详情页所有图片引用都落在隔离目录，且文件真实存在
const expPages = fs.readdirSync(path.join(ROOT, 'experiences'))
  .filter((f) => f.endsWith('.html') && f !== 'index.html');
let expLeak = [], expMissing = [];
for (const f of expPages) {
  const s = fs.readFileSync(path.join(ROOT, 'experiences', f), 'utf8');
  const refs = [...s.matchAll(/\.\.\/images\/([a-z0-9/._-]+\.(?:webp|jpg|jpeg|png|avif))/gi)].map((m) => m[1]);
  for (const r of refs) {
    if (!r.startsWith('experiences/')) expLeak.push(`${f} → ${r}`);
    else if (!fs.existsSync(path.join(ROOT, 'images', r))) expMissing.push(`${f} → images/${r}`);
  }
}
assert(expPages.length >= 6, `体验详情页数量正常（${expPages.length} 页）`);
assert(expLeak.length === 0, `体验详情页图片 100% 走隔离目录（越界 ${expLeak.length} 处）`);
expLeak.slice(0, 5).forEach((x) => console.log('     越界 ' + x));
assert(expMissing.length === 0, `体验详情页引用的隔离图全部落盘（缺失 ${expMissing.length} 处）`);
expMissing.slice(0, 5).forEach((x) => console.log('     缺失 ' + x));

// A3 景点零回归：仍走根 images/，不得被误加 experiences/ 前缀
const atPages = fs.readdirSync(path.join(ROOT, 'attractions'))
  .filter((f) => f.endsWith('.html') && f !== 'index.html');
let atLeak = [], atMissing = [];
for (const f of atPages) {
  const s = fs.readFileSync(path.join(ROOT, 'attractions', f), 'utf8');
  const refs = [...s.matchAll(/\.\.\/images\/([a-z0-9/._-]+\.(?:webp|jpg|jpeg|png|avif))/gi)].map((m) => m[1]);
  for (const r of refs) {
    if (r.startsWith('experiences/')) atLeak.push(`${f} → ${r}`);
    else if (!fs.existsSync(path.join(ROOT, 'images', r))) atMissing.push(`${f} → images/${r}`);
  }
}
assert(atLeak.length === 0, `景点详情页零污染（未被加隔离前缀，异常 ${atLeak.length} 处）`);
assert(atMissing.length === 0, `景点详情页图片全部存在于根 images/（缺失 ${atMissing.length} 处）`);
atMissing.slice(0, 5).forEach((x) => console.log('     缺失 ' + x));

// A4 buildPageMap 的 hero 占位符必须带/不带前缀（模板硬编码 ../images/{{HERO_IMG}}）
const sample = { heroImg: 'x.webp', heroBgImg: 'y.webp', highlights: [], gallery: [], related: [], introParas: [] };
const mExp = buildPageMap(sample, 'experience');
const mAt = buildPageMap(sample, 'attraction');
assert(mExp.HERO_IMG === 'experiences/x.webp' && mExp.HERO_BG_IMG === 'experiences/y.webp',
  `buildPageMap(experience) hero 带隔离前缀（实际 ${mExp.HERO_IMG}）`);
assert(mAt.HERO_IMG === 'attractions/x.webp' && mAt.HERO_BG_IMG === 'attractions/y.webp',
  `buildPageMap(attraction) hero 带隔离前缀 attractions/（实际 ${mAt.HERO_IMG}）`);

// A5 imgSrc 默认无前缀 —— 保证 food/plan-guides/hotels 等其它调用方零影响
assert(imgSrc('a') === '../images/a.webp', `imgSrc 默认无前缀（${imgSrc('a')}）`);
assert(imgSrc('a', 'experiences/') === '../images/experiences/a.webp', `imgSrc 支持前缀（${imgSrc('a', 'experiences/')}）`);

// A6 防回归：imgSrc 现在有第二参，裸 .map(imgSrc) 会把数组下标当前缀传进去
const scriptFiles = fs.readdirSync(path.join(ROOT, 'scripts')).filter((f) => f.endsWith('.mjs'));
const bareMap = scriptFiles.filter((f) => /\.map\(imgSrc\)/.test(fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8')));
assert(bareMap.length === 0, `无裸 .map(imgSrc) 调用（会把下标当前缀，命中 ${bareMap.join(', ') || '无'}）`);

// A7 隔离图库静态清单与磁盘一致（与酒店 admin/imglib/<slug>.json 同构）
const manifestPath = path.join(ROOT, 'admin/imglib/experiences.json');
assert(fs.existsSync(manifestPath), 'admin/imglib/experiences.json 静态清单存在');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const onDisk = isoFiles.map((f) => f.replace(/\.webp$/i, '')).sort();
  assert(JSON.stringify([...manifest].sort()) === JSON.stringify(onDisk),
    `静态清单与磁盘一致（清单 ${manifest.length} / 磁盘 ${onDisk.length}）`);
}

console.log('── B 浏览器层：后台图库真实行为 ──');

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
};
const SERVER = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.statusCode = 404; return res.end('not found');
  }
  res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});
await new Promise((r) => SERVER.listen(0, '127.0.0.1', r));
const PORT = SERVER.address().port;
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

const browser = await chromium.launch(
  process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
    : { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
);
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

const bad = [];
page.on('response', (r) => { if (r.status() >= 400) bad.push({ status: r.status(), url: r.url() }); });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + (e.message || e)));

// mock GitHub Contents API：数据文件 + 目录列举（景点走 listDir，体验优先走静态清单）
for (const f of ['attractions-data.mjs', 'experiences-data.mjs', 'hotels-data.mjs']) {
  await page.route(`**/contents/${f}**`, (route) => {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: b64(text), sha: 'loop', encoding: 'base64' }) });
  });
}
await page.route(/\/contents\/images(\/[a-z-]+)?(\?|$)/i, (route) => {
  const u = new URL(route.request().url());
  const rel = u.pathname.split('/contents/')[1] || 'images';
  const dir = path.join(ROOT, rel);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(webp|jpg|jpeg|png|avif)$/i.test(f)) : [];
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(files.map((name) => ({ name, type: 'file' }))) });
});
await page.addInitScript(() => {
  localStorage.setItem('gh_repo', 'willyye/zhangjiajie-tours-v3');
  localStorage.setItem('gh_branch', 'main');
});
await page.goto(`http://127.0.0.1:${PORT}/admin/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(500);

// ---- 通用：景点/体验（spot-core）模块图库检查 ----
async function checkSpotModule(module, label, expectPrefix, expectSubtitle) {
  await page.click(`.module[data-module="${module}"]`);
  await page.waitForSelector('.he-tree-hotel', { timeout: 6000 });
  await page.waitForTimeout(900);

  // B1 表单缩略图按模块解析
  const thumbSrc = await page.evaluate(() => {
    const t = document.querySelector('.he-form .img-thumb[src], #heForm .img-thumb[src], .img-thumb[src]');
    return t ? t.getAttribute('src') : null;
  });
  assert(thumbSrc && thumbSrc.startsWith(expectPrefix),
    `[${label}] 表单缩略图解析到 ${expectPrefix}（实际 ${thumbSrc}）`);

  // B2 打开图库：副标题要按模块刷新（同一弹窗被两个模块复用，易出现陈旧副标题）
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.img-field-btns .btn')].find((x) => x.textContent.includes('浏览图库'));
    b && b.click();
  });
  await page.waitForSelector('[data-modal="img-lib"]:not([hidden]) .img-lib-item', { timeout: 6000 });
  const subtitle = await page.textContent('[data-modal="img-lib"] #spotLibSubtitle');
  assert((subtitle || '').includes(expectSubtitle), `[${label}] 图库副标题正确刷新（实际「${subtitle}」）`);

  // B3 图库缩略图路径按模块隔离
  const libSrcs = await page.$$eval('[data-modal="img-lib"] .img-lib-item img', (els) => els.map((e) => e.getAttribute('src')));
  const libLeak = libSrcs.filter((s) => !s.startsWith(expectPrefix));
  assert(libSrcs.length > 0 && libLeak.length === 0,
    `[${label}] 图库 ${libSrcs.length} 张缩略图全部走 ${expectPrefix}（越界 ${libLeak.length}）`);

  // B4 打开时定位到当前已选图：.selected 存在且在滚动容器可视区内（scrollIntoView 生效）
  await page.waitForTimeout(700); // 等 smooth 滚动结束
  const sel = await page.evaluate(() => {
    const grid = document.querySelector('[data-modal="img-lib"] .img-lib-grid');
    const s = grid && grid.querySelector('.img-lib-item.selected');
    if (!s) return { has: false };
    // scrollIntoView 作用于最近的可滚动祖先，断言要对着同一个容器
    let box = s.parentElement;
    while (box && box !== document.body && box.scrollHeight <= box.clientHeight + 1) box = box.parentElement;
    const c = (box && box !== document.body ? box : grid).getBoundingClientRect();
    const r = s.getBoundingClientRect();
    return {
      has: true,
      inView: r.bottom > c.top - 4 && r.top < c.bottom + 4,
      name: (s.querySelector('.img-lib-name') || {}).textContent,
      dbg: `item ${Math.round(r.top)}~${Math.round(r.bottom)} vs box ${Math.round(c.top)}~${Math.round(c.bottom)}`,
    };
  });
  if (sel.has && !sel.inView) console.log('     ' + sel.dbg);
  assert(sel.has, `[${label}] 打开图库时当前图被标记为已选（${sel.name || 'n/a'}）`);
  assert(!sel.has || sel.inView, `[${label}] 已选图被滚动到可视区内（跳到对应图片）`);

  // B5 点选一张不同的图 → 弹窗关闭 + 输入框回填 + 缩略图换图 + 高亮
  const picked = await page.evaluate(() => {
    const items = [...document.querySelectorAll('[data-modal="img-lib"] .img-lib-item')];
    const target = items.find((i) => !i.classList.contains('selected')) || items[0];
    const name = (target.querySelector('.img-lib-name') || {}).textContent;
    target.click();
    return name;
  });
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => {
    const modal = document.querySelector('[data-modal="img-lib"]');
    const t = document.querySelector('.img-thumb[src]');
    const inp = document.querySelector('.img-field-row input[type="text"]');
    return {
      closed: !!modal && modal.hidden,
      thumb: t ? t.getAttribute('src') : null,
      val: inp ? inp.value : null,
      flashed: !!document.querySelector('.img-thumb.img-just-picked'),
    };
  });
  assert(after.closed, `[${label}] 点选后图库弹窗自动关闭`);
  assert(after.val === picked, `[${label}] 点选后输入框回填「${picked}」（实际 ${after.val}）`);
  assert(after.thumb === expectPrefix + picked + '.webp',
    `[${label}] 点选后缩略图立刻显示该图（实际 ${after.thumb}）`);
  assert(after.flashed, `[${label}] 点选后跳到该字段并高亮（img-just-picked）`);
}

await checkSpotModule('experiences', '体验', '../images/experiences/', 'images/experiences/');
await checkSpotModule('attractions', '景点', '../images/attractions/', 'images/attractions/');

// B6 回到体验模块：副标题不得残留景点的"根目录"文案（陈旧副标题回归防护）
await page.click('.module[data-module="experiences"]');
await page.waitForTimeout(800);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.img-field-btns .btn')].find((x) => x.textContent.includes('浏览图库'));
  b && b.click();
});
await page.waitForSelector('[data-modal="img-lib"]:not([hidden]) .img-lib-item', { timeout: 6000 });
const sub2 = await page.textContent('[data-modal="img-lib"] #spotLibSubtitle');
assert((sub2 || '').includes('images/experiences/'), `模块间来回切换后副标题不残留（实际「${sub2}」）`);
await page.evaluate(() => { const m = document.querySelector('[data-modal="img-lib"]'); if (m) m.hidden = true; });

// B7 酒店模块：选图后同样跳到并高亮（与景点/体验行为一致）
await page.click('.module[data-module="hotels"]');
await page.waitForSelector('.he-tree-hotel', { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1500); // 树会在数据加载后重渲染，等稳定再点，否则点到旧节点
await page.evaluate(() => { const h = document.querySelector('.he-tree-hotel'); h && h.click(); });
await page.waitForSelector('.img-field .he-thumb-box', { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(600);
const hotelPick = await page.evaluate(async () => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('浏览图片库'));
  if (!btn) return { opened: false };
  btn.click();
  await new Promise((r) => setTimeout(r, 1200));
  // 页面里同时存在景点/体验（spot-core）与酒店两个图库弹窗，必须锁定酒店那一个（.img-lib-modal）
  const grid = document.querySelector('.img-lib-modal .img-lib-grid');
  const cell = grid && grid.querySelector('.img-lib-item');
  if (!cell) return { opened: true, picked: false };
  const name = (cell.querySelector('.img-lib-name') || {}).textContent;
  const selInView = (() => {
    const s = grid.querySelector('.img-lib-item.selected');
    if (!s) return null;
    let box = s.parentElement;
    while (box && box !== document.body && box.scrollHeight <= box.clientHeight + 1) box = box.parentElement;
    const c = (box && box !== document.body ? box : grid).getBoundingClientRect();
    const r = s.getBoundingClientRect();
    return r.bottom > c.top - 4 && r.top < c.bottom + 4;
  })();
  cell.click();
  await new Promise((r) => setTimeout(r, 400));
  const thumb = document.querySelector('.he-thumb-box .he-thumb');
  return {
    opened: true, picked: true, name, selInView,
    flashed: !!document.querySelector('.he-thumb-box.img-just-picked'),
    thumbHasName: !!(thumb && name && thumb.getAttribute('src').includes(name + '.webp')),
  };
});
assert(hotelPick.opened && hotelPick.picked, `[酒店] 图库可打开且有图片可选（opened=${hotelPick.opened} picked=${hotelPick.picked}）`);
if (hotelPick.picked) {
  assert(hotelPick.selInView !== false, '[酒店] 打开图库时已选图在可视区内（跳到对应图片）');
  assert(hotelPick.thumbHasName, `[酒店] 选图后缩略图显示该图（${hotelPick.name}）`);
  assert(hotelPick.flashed, '[酒店] 选图后跳到该字段并高亮（img-just-picked）');
}

// B8 全程零 404 / 零控制台错误
const realBad = bad.filter((b) => !/\/contents\//.test(b.url));
assert(realBad.length === 0, `后台加载与图库操作全程零 404（实际 ${realBad.length}）`);
realBad.slice(0, 5).forEach((b) => console.log(`     404 ${b.status} ${b.url}`));
assert(consoleErrors.length === 0, `零控制台错误（实际 ${consoleErrors.length}）`);
consoleErrors.slice(0, 3).forEach((e) => console.log('     ' + e));

await browser.close();
SERVER.close();

let pass = 0, fail = 0;
for (const r of results) {
  if (r.ok) { pass++; console.log(`  ✓ ${r.msg}`); }
  else { fail++; console.log(`  ✗ ${r.msg}`); }
}
console.log(`━━━ ${pass}/${pass + fail} passed ━━━`);
process.exit(fail ? 1 : 0);
