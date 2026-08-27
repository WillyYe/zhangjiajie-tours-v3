// 实证测试：编辑时预览是否真正跟随（重载后把激活字段滚回视区，而非跳回顶部）
// 这是之前缺的「test/prod 鸿沟」护栏：旧测试只测聚焦跟随，没测「打字→重渲染→重载→滚动恢复」。
// 运行：node tests/preview-edit-follow-loop.mjs
import { chromium } from 'playwright';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const http = require('http');
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
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
await new Promise((r) => ASSET_SERVER.listen(0, '127.0.0.1', r));
const PORT = ASSET_SERVER.address().port;
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push('PAGEERROR: ' + (e.message || e.stack || e)));

await page.route('**/contents/**', (route) => {
  const url = route.request().url();
  const name = decodeURIComponent(url.split('/').pop().split('?')[0]);
  if (name.endsWith('.mjs')) {
    const fp = path.join(ROOT, name);
    const text = (fs.existsSync(fp) && !fs.statSync(fp).isDirectory()) ? fs.readFileSync(fp, 'utf8') : 'export default {};\n';
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: b64(text), sha: 'smoke', encoding: 'base64' }) });
  } else {
    route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'not found' }) });
  }
});
await page.addInitScript(() => {
  localStorage.setItem('gh_repo', 'willyye/zhangjiajie-tours-v3');
  localStorage.setItem('gh_branch', 'main');
  localStorage.setItem('admin.followPreview', '1');
});
await page.goto(`http://127.0.0.1:${PORT}/admin/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(800);

let pass = 0, fail = 0;
function check(name, cond, extra = '') { if (cond) { pass++; console.log(`  ✓ ${name} ${extra}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); } }

async function openModule(name) {
  await page.click(`.module[data-module="${name}"]`, { timeout: 5000 });
  await page.waitForTimeout(400);
}
async function expandAndSelectLast(module) {
  await openModule(module);
  const heads = await page.$$('.he-tree-cat-head, .he-tree-cat-name');
  for (const h of heads) {
    const isOpen = await h.evaluate((el) => { const c = el.closest('.he-tree-cat'); return !!(c && c.classList.contains('open')); }).catch(() => false);
    if (!isOpen) { await h.click().catch(() => {}); await page.waitForTimeout(120); }
  }
  await page.waitForTimeout(250);
  const items = await page.$$('.he-tree-hotel, .he-tree-leaf, [data-tree-item]');
  if (!items.length) return false;
  await items[items.length - 1].click().catch(() => {});
  await page.waitForTimeout(400);
  return true;
}
async function measure(anchor) {
  return page.evaluate((a) => {
    const f = document.querySelector('#preview iframe');
    const root = f && f.contentDocument ? f.contentDocument : document.getElementById('preview');
    const el = root.querySelector ? root.querySelector('#' + CSS.escape(a)) : null;
    if (!el) return { exists: false };
    const r = el.getBoundingClientRect();
    const vh = (f && f.contentDocument) ? f.contentDocument.defaultView.innerHeight : (document.getElementById('preview').clientHeight || 900);
    const cy = r.top + r.height / 2;
    const scrollTop = (f && f.contentDocument) ? f.contentDocument.documentElement.scrollTop : (document.getElementById('preview').scrollTop || 0);
    return { exists: true, inView: cy >= -10 && cy <= vh + 10, scrollTop: Math.round(scrollTop), assign: (window.__previewFrame ? window.__previewFrame.srcdocAssignCount() : -1) };
  }, anchor);
}

console.log('== 编辑跟随实证（topAttractions 末项强测试）==');
const ok = await expandAndSelectLast('topAttractions');
check('选中末项', ok);
const fld = await page.evaluate(() => {
  const w = document.querySelector('.he-form-host [data-pv-anchor]') || document.querySelector('[data-pv-anchor]');
  if (!w) return null;
  return { anchor: w.getAttribute('data-pv-anchor'), mode: w.getAttribute('data-pv-mode') || '' };
});
check('读到真实锚点', !!fld, fld ? `anchor=${fld.anchor}` : '');
if (fld) {
  // 先把预览滚到顶部，确保后续“重载后需滚回底部”是强断言
  await page.evaluate(() => { const f = document.querySelector('#preview iframe'); if (f && f.contentDocument) f.contentDocument.documentElement.scrollTop = 0; });
  await page.waitForTimeout(120);
  // 聚焦真实字段 → 聚焦跟随
  await page.evaluate(() => { const w = document.querySelector('.he-form-host [data-pv-anchor]') || document.querySelector('[data-pv-anchor]'); const i = w && w.querySelector('input,textarea,select'); if (i) i.focus(); });
  await page.waitForTimeout(1400);
  const focusState = await measure(fld.anchor);
  check('聚焦后目标在视区', focusState.exists && focusState.inView, `scrollTop=${focusState.scrollTop}`);
  // 重置赋值计数，模拟一次编辑
  await page.evaluate(() => { if (window.__previewFrame) window.__previewFrame.resetSrcdocAssignCount(); });
  // 打字 → 触发重渲染（debounce 120ms）+ iframe 重载
  await page.evaluate(() => {
    const w = document.querySelector('.he-form-host [data-pv-anchor]') || document.querySelector('[data-pv-anchor]');
    const i = w && w.querySelector('input,textarea,select');
    if (i) { i.focus(); i.value = (i.value || '') + '·'; i.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await page.waitForTimeout(1600);
  const afterEdit = await measure(fld.anchor);
  check('编辑触发了预览重载', afterEdit.assign > 0, `srcdocAssign=${afterEdit.assign}`);
  check('编辑后重载目标仍滚回视区（真跟随）', afterEdit.exists && afterEdit.inView, `scrollTop=${afterEdit.scrollTop}`);
  check('编辑后未跳回顶部', afterEdit.scrollTop > 0, `scrollTop=${afterEdit.scrollTop}`);
}

console.log(`\n结果： ${pass} 通过 / ${fail} 失败`);
console.log('pageErrors:', pageErrors.length ? pageErrors.slice(0, 5) : 'none');
await browser.close();
ASSET_SERVER.close();
process.exit(fail ? 1 : 0);
