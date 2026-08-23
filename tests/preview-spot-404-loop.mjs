// preview-spot-404-loop.mjs —— 后台「景点/体验」详情页预览 404 闭环验证。
//
// 背景（用户报告后台体验模块预览点相关链接 404）：
//   预览用 iframe srcdoc 复用真实模板，iframe 继承父 URL = /admin/。
//   experience 的 RELATED 卡片用同目录相对链接 slug.html → 在 /admin/ 下解析成
//   admin/<slug>.html → 404。修复：让 buildPageMap 给 experience 的相关链接也加
//   ../experiences/ 前缀（与 attractions 的 ../attractions/ 一致），真实页面同目录等价，
//   预览 iframe 也能正确解析到 /experiences/<slug>.html，不依赖 <base> 注入。
//
// 本 loop 用真实浏览器（Playwright + 系统 Chrome）验证两类 404：
//   A. 预览初始加载（模板/CSS/字体/图片/hero）零 404
//   B. 点击相关链接后，零新增 404
// 覆盖 attractions 与 experiences 两个模块。

import { chromium } from 'playwright';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const http = require('http');
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
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

const browser = await chromium.launch(
  process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
    : { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
);
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const results = [];
function assert(cond, msg) { results.push({ ok: !!cond, msg }); }

const bad = [];
page.on('response', (r) => {
  if (r.status() >= 400) bad.push({ status: r.status(), url: r.url(), frame: r.frame()?.url() || '(top)' });
});
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + (e.message || e)));

for (const [pat, file] of Object.entries({ 'attractions-data.mjs': 'attractions-data.mjs', 'experiences-data.mjs': 'experiences-data.mjs' })) {
  await page.route(`**/contents/${pat}`, (route) => {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: b64(text), sha: 'loop', encoding: 'base64' }) });
  });
}
await page.addInitScript(() => {
  localStorage.setItem('gh_repo', 'willyye/zhangjiajie-tours-v3');
  localStorage.setItem('gh_branch', 'main');
});
await page.goto(`http://127.0.0.1:${PORT}/admin/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(400);

async function checkModule(module, label) {
  const before = bad.length;
  await page.click(`.module[data-module="${module}"]`);
  await page.waitForSelector('.he-tree-hotel', { timeout: 5000 });
  await page.waitForTimeout(1200); // 等预览 iframe 内容加载

  const pv = await page.evaluate(() => {
    const f = document.querySelector('.pv-iframe');
    return { hasFrame: !!f, srcdocLen: f ? (f.srcdoc || '').length : 0 };
  });
  assert(pv.hasFrame && pv.srcdocLen > 1000, `[${label}] 预览 iframe 已渲染（srcdoc ${pv.srcdocLen} 字节）`);

  const initBad = bad.filter((b) => b.frame.includes('/admin/'));
  assert(initBad.length === 0, `[${label}] 预览初始加载零 404/4xx（实际 ${initBad.length}）`);
  for (const b of initBad.slice(0, 5)) console.log(`     404 ${b.status} ${b.url}`);

  // 点击第一个 RELATED 卡片链接（a.card-hover），验证跳转后零新增 404
  const clicked = await page.evaluate(() => {
    const f = document.querySelector('.pv-iframe');
    if (!f || !f.contentDocument) return null;
    const a = f.contentDocument.querySelector('a.card-hover[href$=".html"]');
    if (!a) return null;
    const href = a.getAttribute('href');
    a.click();
    return href;
  });
  await page.waitForTimeout(700);
  const navBad = bad.filter((b) => b.frame.includes('/admin/') && b.status >= 400);
  const newBad = navBad.length - before;
  if (clicked) {
    assert(newBad === 0, `[${label}] 点击相关链接「${clicked}」后零新增 404（实际新增 ${newBad}）`);
    for (const b of bad.filter((x) => x.frame.includes('/admin/')).slice(-3)) console.log(`     点击后 404 ${b.status} ${b.url}`);
  } else {
    assert(true, `[${label}] 无相关链接（无需点击验证）`);
  }
}

console.log('━━━ preview-spot-404-loop ━━━');
await checkModule('experiences', '体验');
await checkModule('attractions', '景点');
assert(consoleErrors.length === 0, `加载/预览期间零控制台错误（实际 ${consoleErrors.length}）`);
for (const e of consoleErrors.slice(0, 3)) console.log('     ' + e);

await browser.close();
ASSET_SERVER.close();

let pass = 0, fail = 0;
for (const r of results) {
  if (r.ok) { pass++; console.log(`  ✓ ${r.msg}`); }
  else { fail++; console.log(`  ✗ ${r.msg}`); }
}
console.log(`━━━ ${pass}/${pass + fail} passed ━━━`);
process.exit(fail ? 1 : 0);
