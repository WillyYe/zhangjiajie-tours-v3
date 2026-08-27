// 闭环回归：welcome / nav 模块「预览跟随」真正生效（聚焦即跟随 + 编辑后不丢跟随）。
// 修复前：这两个模块从不调用 withPv，字段无 data-pv-anchor、预览无对应 id → 完全无跟随。
// 修复后：字段带锚点、预览 HTML 产出 id，聚焦/打字均应将目标滚入视区。
//
// 关键 harness 修正：单开手风琴（ui.open 同时只能一个分组展开）。不再盲目点所有 cat-head
// （会把已展开分组折叠），改为：先判断叶子是否存在，不存在才逐个点 cat-name 直到叶子出现。
//
// 运行：node tests/preview-follow-welcome-nav-loop.mjs
import { chromium } from 'playwright';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const http = require('http');
const MIME = { '.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png' };
const ASSET_SERVER = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) { res.statusCode = 404; return res.end('nf'); }
  res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});
await new Promise((r) => ASSET_SERVER.listen(0, '127.0.0.1', r));
const PORT = ASSET_SERVER.address().port;
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

const browser = await chromium.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + (e.message || '').slice(0, 200)));

await page.route('**/contents/**', (route) => {
  const url = route.request().url();
  const name = decodeURIComponent(url.split('/').pop().split('?')[0]);
  if (name.endsWith('.mjs')) {
    const fp = path.join(ROOT, name);
    const text = (fs.existsSync(fp) && !fs.statSync(fp).isDirectory()) ? fs.readFileSync(fp, 'utf8') : 'export default {};\n';
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: b64(text), sha: 'x', encoding: 'base64' }) });
  } else route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'nf' }) });
});
await page.addInitScript(() => {
  localStorage.setItem('gh_repo', 'willyye/zhangjiajie-tours-v3');
  localStorage.setItem('gh_branch', 'main');
  localStorage.setItem('admin.followPreview', '1');
});
await page.goto(`http://127.0.0.1:${PORT}/admin/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(800);

let pass = 0, fail = 0;
const results = [];
function assert(cond, name, extra = '') {
  if (cond) { pass++; results.push(`  ✅ ${name} ${extra}`); }
  else { fail++; results.push(`  ❌ ${name} ${extra}`); }
}

async function openModule(name) {
  await page.click(`.module[data-module="${name}"]`, { timeout: 5000 });
  await page.waitForTimeout(400);
}
// 单开手风琴：确保叶子(.he-tree-hotel)可见。不盲目折叠已展开分组。
// 注意：renderTree() 会重建树 DOM，故每次点击后必须重新查询 cat-name（旧节点已脱离文档）。
async function ensureLeaves() {
  let n = await page.$$eval('.he-tree-hotel', (e) => e.length).catch(() => 0);
  if (n > 0) return true;
  for (let attempt = 0; attempt < 6; attempt++) {
    const names = await page.$$('.he-tree-cat-name');
    if (!names.length) return false;
    const target = names[Math.min(attempt, names.length - 1)];
    await target.click().catch(() => {});
    await page.waitForTimeout(300);
    n = await page.$$eval('.he-tree-hotel', (e) => e.length).catch(() => 0);
    if (n > 0) return true;
  }
  return false;
}
async function selectTreeItem(idx) {
  const items = await page.$$('.he-tree-hotel');
  if (!items.length) return false;
  const i = idx < 0 ? items.length - 1 : Math.min(idx, items.length - 1);
  // 用程序化 click：导航树项是 draggable 节点，Playwright 真实鼠标点击会被浏览器当拖拽起点而不触发 onclick
  await items[i].evaluate((el) => el.click()).catch(() => {});
  await page.waitForTimeout(400);
  return true;
}
function measure(anchor) {
  return page.evaluate((a) => {
    const f = document.querySelector('#preview iframe');
    const root = f && f.contentDocument ? f.contentDocument : document.getElementById('preview');
    const el = root.querySelector ? root.querySelector('#' + CSS.escape(a)) : null;
    if (!el) return { exists: false };
    const r = el.getBoundingClientRect();
    const vh = (f && f.contentDocument) ? f.contentDocument.defaultView.innerHeight : (document.getElementById('preview').clientHeight || 900);
    const cy = r.top + r.height / 2;
    const scrollTop = (f && f.contentDocument) ? Math.round(f.contentDocument.documentElement.scrollTop) : Math.round(document.getElementById('preview').scrollTop || 0);
    return { exists: true, inView: cy >= -10 && cy <= vh + 10, scrollTop, flashed: el.classList.contains('pv-flash') };
  }, anchor);
}
async function currentAnchor() {
  return page.evaluate(() => {
    const w = document.querySelector('.he-form-host [data-pv-anchor]');
    return w ? w.getAttribute('data-pv-anchor') : null;
  });
}
async function focusFirstPvInput() {
  await page.evaluate(() => {
    const w = document.querySelector('.he-form-host [data-pv-anchor]');
    const inp = w && w.querySelector('input,textarea,select');
    if (inp) inp.focus();
  });
}
async function focusPvInputByAnchorPrefix(prefix) {
  return page.evaluate((p) => {
    const ws = Array.from(document.querySelectorAll('.he-form-host [data-pv-anchor]'));
    const w = ws.find((x) => (x.getAttribute('data-pv-anchor') || '').startsWith(p));
    if (!w) return null;
    // 子项输入框自身即被 withPv 包裹（锚点在 input 上），需直接聚焦该元素
    const inp = (w.tagName === 'INPUT' || w.tagName === 'TEXTAREA' || w.tagName === 'SELECT') ? w : w.querySelector('input,textarea,select');
    if (inp) { inp.focus(); return w.getAttribute('data-pv-anchor'); }
    return null;
  }, prefix);
}

// ============ 1) WELCOME：聚焦末段 → 跟随滚动；编辑 → 不丢跟随 ============
console.log('== WELCOME 跟随 ==');
await openModule('welcome');
const wLeaves = await ensureLeaves();
assert(wLeaves, 'welcome 树展开且有叶子（段落/指标）');
await selectTreeItem(-1); // 最后一个段落（在预览底部，必须滚动）
const wAnchor = await currentAnchor();
assert(!!wAnchor && wAnchor.startsWith('welcome-para-'), 'welcome 段落字段带 pv 锚点', `(${wAnchor})`);
// 先把预览滚到顶部，确保“滚动是必要动作”
await page.evaluate(() => {
  const f = document.querySelector('#preview iframe');
  if (f && f.contentDocument) f.contentDocument.documentElement.scrollTop = 0;
  else { const p = document.getElementById('preview'); if (p) p.scrollTop = 0; }
});
await page.waitForTimeout(150);
const wBefore = await measure(wAnchor);
await focusFirstPvInput();
await page.waitForTimeout(1600);
const wAfterFocus = await measure(wAnchor);
assert(wAfterFocus.exists, 'welcome 聚焦后预览存在目标锚点', `(${wAnchor})`);
assert(wAfterFocus.inView, 'welcome 聚焦后目标滚入视区（跟随生效）', `scrollTop ${wBefore.scrollTop}→${wAfterFocus.scrollTop} flash=${wAfterFocus.flashed ? 'Y' : 'n'}`);

// 编辑：打字触发重渲染 → iframe 重载 → scrollToActive 应把目标保持/滚回视区
await page.keyboard.type('Z');
await page.waitForTimeout(1600);
const wAfterEdit = await measure(wAnchor);
assert(wAfterEdit.exists, 'welcome 编辑后目标锚点仍存', `(${wAnchor})`);
assert(wAfterEdit.inView, 'welcome 编辑后目标仍在视区（不丢跟随，不跳回顶部）', `scrollTop=${wAfterEdit.scrollTop}`);

// ============ 2) NAV：聚焦菜单项 label → 跟随；聚焦二级子项 → 滚动到下方 mobile ============
console.log('== NAV 跟随 ==');
await openModule('nav');
const nLeaves = await ensureLeaves();
assert(nLeaves, 'nav 树展开且有菜单项叶子');
// 选一个有二级子项的项（Attractions，index 1）
const nOk = await selectTreeItem(1);
assert(nOk, 'nav 选中含子项的菜单项');
const nAnchor = await currentAnchor();
assert(!!nAnchor && nAnchor.startsWith('nav-item-'), 'nav 菜单项字段带 pv 锚点', `(${nAnchor})`);
await page.evaluate(() => {
  const f = document.querySelector('#preview iframe');
  if (f && f.contentDocument) f.contentDocument.documentElement.scrollTop = 0;
  else { const p = document.getElementById('preview'); if (p) p.scrollTop = 0; }
});
await page.waitForTimeout(150);
await focusFirstPvInput(); // 聚焦 label → nav-item-X（顶部）
await page.waitForTimeout(1600);
const nAfterItem = await measure(nAnchor);
assert(nAfterItem.exists, 'nav 聚焦菜单项后预览存在目标锚点', `(${nAnchor})`);
assert(nAfterItem.inView, 'nav 聚焦菜单项后目标在视区（跟随生效）', `scrollTop=${nAfterItem.scrollTop}`);

// 聚焦二级子项输入 → 应滚到下方 mobile 菜单中的 nav-child-X-Y
const childAnchor = await focusPvInputByAnchorPrefix('nav-child-');
assert(!!childAnchor, 'nav 二级子项输入接上跟随锚点', `(${childAnchor})`);
if (childAnchor) {
  await page.waitForTimeout(1600);
  const nAfterChild = await measure(childAnchor);
  assert(nAfterChild.exists, 'nav 聚焦子项后预览存在目标锚点', `(${childAnchor})`);
  assert(nAfterChild.inView, 'nav 聚焦子项后目标滚入视区（滚动到下方 mobile）', `scrollTop=${nAfterChild.scrollTop}`);
}

assert(pageErrors.length === 0, '无运行时 pageerror', pageErrors.length ? JSON.stringify(pageErrors.slice(0, 3)) : '');

console.log(results.join('\n'));
console.log(`\n结果：PASS ${pass} / FAIL ${fail}`);
await browser.close();
ASSET_SERVER.close();
process.exit(fail ? 1 : 0);
