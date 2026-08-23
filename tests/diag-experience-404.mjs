// 诊断：后台 Experiences 预览的 404 来源
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

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox'] } : { args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

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
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: b64(text), sha: 'smoke', encoding: 'base64' }) });
  });
}
await page.addInitScript(() => {
  localStorage.setItem('gh_repo', 'willyye/zhangjiajie-tours-v3');
  localStorage.setItem('gh_branch', 'main');
});
await page.goto(`http://127.0.0.1:${PORT}/admin/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(500);
await page.click('.module[data-module="experiences"]');
await page.waitForSelector('.he-tree-hotel', { timeout: 5000 });
await page.waitForTimeout(1200); // 等预览 iframe 内容加载

const pvInfo = await page.evaluate(() => {
  const f = document.querySelector('.pv-iframe');
  return { hasFrame: !!f, srcdocLen: f ? (f.srcdoc || '').length : 0, base: f ? f.baseURI : null };
});
console.log('preview frame:', JSON.stringify(pvInfo));

console.log('\n=== 404/4xx 在预览加载期间 ===');
for (const b of bad) console.log(`  ${b.status}  ${b.url}   (frame: ${b.frame})`);
if (!bad.length) console.log('  (无)');

// 抓取预览 iframe 里所有 <a href> 同目录相对链接（可能点击后 404）
const relatedLinks = await page.evaluate(() => {
  const f = document.querySelector('.pv-iframe');
  if (!f || !f.contentDocument) return [];
  return [...f.contentDocument.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => h && !h.startsWith('http') && !h.startsWith('mailto') && !h.startsWith('#') && !h.startsWith('data:'));
});
console.log('\n=== 预览 iframe 内相对链接（前 20，点击可能 404 的同目录无前缀者）===');
for (const h of relatedLinks.slice(0, 20)) console.log('  ' + h);
const suspect = relatedLinks.filter((h) => !h.startsWith('../') && !h.startsWith('/') && h.endsWith('.html'));
console.log('\n=== 同目录相对 .html 链接（在 admin/ base 下会 404）===');
for (const h of suspect) console.log('  ' + h);
if (!suspect.length) console.log('  (无)');

console.log('\nconsole errors:', consoleErrors.length ? consoleErrors.slice(0, 5).join(' | ') : '(无)');

// 修复验证：点击一个「同目录相对」相关链接，验证不再 404
console.log('\n=== 点击相关链接验证（修复后不应 404）===');
const before = bad.length;
const clicked = await page.evaluate(() => {
  const f = document.querySelector('.pv-iframe');
  if (!f || !f.contentDocument) return null;
  const a = [...f.contentDocument.querySelectorAll('a[href$=".html"]')].find((x) => !x.getAttribute('href').startsWith('..'));
  if (!a) return null;
  const href = a.getAttribute('href');
  a.click();
  return href;
});
await page.waitForTimeout(800);
const afterNav = bad.filter((b) => b.frame.includes('/admin/') && b.status >= 400);
console.log('  点击链接:', clicked);
console.log('  点击后新增 404（admin/ 下）:', afterNav.length, afterNav.map((b) => b.url).join(', '));
console.log('  ' + (afterNav.length === 0 ? '✓ 修复生效：相关链接不再 404' : '✗ 仍 404'));

await browser.close();
ASSET_SERVER.close();

