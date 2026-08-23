// 子目录部署模拟验证：复现 GitHub Pages 的 /zhangjiajie-tours-v3/ 子路径条件，
// 证明 spot-core.js 的模板 fetch 不再越出仓库（之前本地根部署测试掩盖了此 bug）。
//
// 机制：把静态服务器根设在仓库的【父目录】，于是仓库以 /zhangjiajie-tours-v3/ 子路径暴露，
// 与 GitHub Pages 项目页完全一致。此时若 fetch 仍用文档相对 '../../templates/...'，
// 会被解析到域名根 /templates/... → 404；正确写法(import.meta.url)应解析到
// /zhangjiajie-tours-v3/templates/... → 200。
//
// 运行：CHROME_PATH="..." node tests/diag-subpath-fetch.mjs
import { chromium } from 'playwright';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const PARENT = path.resolve(ROOT, '..'); // 服务器根 = 仓库父目录，使仓库位于 /zhangjiajie-tours-v3/
const REPO = 'zhangjiajie-tours-v3';
const http = require('http');
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
};
const ASSET_SERVER = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PARENT, urlPath);
  if (!filePath.startsWith(PARENT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.statusCode = 404; return res.end('not found');
  }
  res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});
await new Promise((r) => ASSET_SERVER.listen(0, '127.0.0.1', r));
const PORT = ASSET_SERVER.address().port;
const BASE = `http://127.0.0.1:${PORT}/${REPO}`;
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.error('  ✗ ' + m); } };

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox'] } : { args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon/.test(m.text()) && !/ERR_ABORTED/.test(m.text())) consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + (e.message || e.stack || e)));

// 捕获所有网络响应，重点看 templates 相关请求是否越界
const responses = [];
page.on('response', (r) => responses.push({ url: r.url(), status: r.status() }));

// 拦截 GitHub Contents API（attractions/experiences 数据走 API；其余模块静态文件由服务器提供）
for (const pat of ['attractions-data.mjs', 'experiences-data.mjs']) {
  await page.route(`**/contents/${pat}`, (route) => {
    const text = fs.readFileSync(path.join(ROOT, pat), 'utf8');
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: b64(text), sha: 'diag', encoding: 'base64' }) });
  });
}

await page.addInitScript(() => {
  localStorage.setItem('gh_repo', 'willyye/zhangjiajie-tours-v3');
  localStorage.setItem('gh_branch', 'main');
});
await page.goto(`${BASE}/admin/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(800);

console.log('A. 加载无错误');
ok(consoleErrors.length === 0, 'admin 加载无控制台错误' + (consoleErrors.length ? '：' + consoleErrors.slice(0, 3).join(' | ') : ''));

// 模拟：点开模块，等待对应模板请求到达 + iframe 出现本模块专属标记文本（消除异步重渲染竞态）
async function checkPreview(name, templateFile, marker) {
  consoleErrors.length = 0;
  responses.length = 0;
  await page.click(`.module[data-module="${name}"]`);
  // 等本模块模板请求真正发出并 200（证明 fetch 路径正确，未越界）
  await page.waitForResponse(
    (r) => r.url().includes(`/${REPO}/templates/${templateFile}`) && r.status() === 200,
    { timeout: 8000 },
  ).catch(() => {});
  // 等 iframe 内容出现本模块专属标记（避免读到上一个模块遗留内容）
  await page.waitForFunction((mk) => {
    const f = document.querySelector('.pv-iframe');
    try { return f && f.contentDocument && f.contentDocument.body && f.contentDocument.body.innerText.includes(mk); } catch (e) { return false; }
  }, marker, { timeout: 8000 });

  const txt = await page.evaluate(() => {
    const f = document.querySelector('.pv-iframe');
    return f.contentDocument.body.innerText.slice(0, 600);
  });
  const escaped = responses.filter((r) => r.url.endsWith(`templates/${templateFile}`) && !r.url.includes(`/${REPO}/`));
  const correct = responses.filter((r) => r.url.includes(`/${REPO}/templates/${templateFile}`));
  const correctOk = correct.filter((r) => r.status === 200);
  const allTemplates = responses.filter((r) => r.url.includes('templates/')).map((r) => `${r.status} ${r.url.replace(/^https?:\/\/[^/]+/, '')}`);
  console.log(`  [${name}] 模板相关请求: ${JSON.stringify(allTemplates)}`);

  console.log(`  [${name}] 预览文本前 120 字: ${txt.replace(/\s+/g, ' ').slice(0, 120)}`);
  ok(escaped.length === 0, `[${name}] 无越界请求(落到域名根 /templates/${templateFile})（实际 ${escaped.length} 个）`);
  ok(correctOk.length >= 1, `[${name}] 模板请求命中 /${REPO}/templates/${templateFile} 且 HTTP 200（实际 ${correctOk.length} 个）`);
  ok(!/There isn't a GitHub Pages site here/i.test(txt), `[${name}] 预览 iframe 未显示 GitHub 404 页`);
  ok(txt.trim().length > 50, `[${name}] 预览 iframe 渲染出真实模板内容（${txt.trim().length} 字）`);
  ok(consoleErrors.length === 0, `[${name}] 渲染无控制台错误` + (consoleErrors.length ? '：' + consoleErrors.slice(0, 3).join(' | ') : ''));
}

console.log('B. 子目录部署下 Attractions 预览');
await checkPreview('attractions', 'attraction-page.html', 'Tianzi Mountain');
console.log('C. 子目录部署下 Experiences 预览');
await checkPreview('experiences', 'experience-page.html', 'Avatar Mountains');

console.log(`\n子目录部署模拟：${pass} 通过 / ${fail} 失败`);
await browser.close();
ASSET_SERVER.close();
process.exit(fail ? 1 : 0);
