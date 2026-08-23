// 后台 Attractions / Experiences 模块冒烟测试（Playwright）
// 拦截 GitHub Contents API 返回本地数据文件；预设 localStorage 跳过设置弹窗；
// 验证：模块图（左树）渲染、表单字段渲染、切换无控制台错误。
// 运行：CHROME_PATH="..." node tests/admin-spot-smoke.mjs
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

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.error('  ✗ ' + m); } };

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox'] } : { args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon/.test(m.text()) && !/ERR_ABORTED/.test(m.text())) consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + (e.message || e.stack || e)));

// 拦截 GitHub Contents API（repo 为空时路径含双斜杠，用 ** 匹配）
for (const [pat, file] of Object.entries({ 'attractions-data.mjs': 'attractions-data.mjs', 'experiences-data.mjs': 'experiences-data.mjs' })) {
  await page.route(`**/contents/${pat}`, (route) => {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: b64(text), sha: 'smoke', encoding: 'base64' }) });
  });
}

// 预设 localStorage，避免 boot 弹出设置遮罩挡住点击
await page.addInitScript(() => {
  localStorage.setItem('gh_repo', 'willyye/zhangjiajie-tours-v3');
  localStorage.setItem('gh_branch', 'main');
});
await page.goto(`http://127.0.0.1:${PORT}/admin/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(800);

console.log('A. 加载即无运行时/import 错误');
ok(consoleErrors.length === 0, 'admin 加载无控制台错误' + (consoleErrors.length ? '：' + consoleErrors.slice(0, 3).join(' | ') : ''));
const hasToast = await page.evaluate(() => typeof window.__adminToast === 'function');
ok(hasToast, 'app.js 已执行（__adminToast 存在）');

// A-2. 侧栏顺序：hotels 必须在 experiences 之后（2026-08-23 用户要求）
// 仅统计带 data-module 的启用模块（忽略「规划中」灰显 disabled 按钮）
const sidebarOrder = await page.evaluate(() =>
  [...document.querySelectorAll('.module-list .module')]
    .map((b) => b.dataset.module)
    .filter((m) => m && m !== 'undefined'),
);
const idxHotels = sidebarOrder.indexOf('hotels');
const idxExp = sidebarOrder.indexOf('experiences');
ok(idxHotels > idxExp && idxHotels === sidebarOrder.length - 1, `侧栏顺序 hotels 在 experiences 之后（${(sidebarOrder.join(' > '))}）`);

async function openModule(name, expectMin) {
  consoleErrors.length = 0;
  await page.click(`.module[data-module="${name}"]`);
  await page.waitForSelector('.he-tree-hotel', { timeout: 5000 });
  const info = await page.evaluate(() => ({
    tree: document.querySelectorAll('.he-tree-hotel').length,
    fields: document.querySelectorAll('.he-form-host .field, .he-form-host .sub-fields, .he-form-host .check-row').length,
    active: document.querySelector('.module.active')?.dataset.module,
  }));
  ok(info.tree >= expectMin, `${name} 左树渲染 ${info.tree} 项（>= ${expectMin}）`);
  ok(info.fields > 5, `${name} 表单渲染 ${info.fields} 个字段控件`);
  ok(info.active === name, `${name} 切换后激活态正确（${info.active}）`);
  ok(consoleErrors.length === 0, `${name} 切换无控制台错误` + (consoleErrors.length ? '：' + consoleErrors.slice(0, 3).join(' | ') : ''));
}

console.log('B. Attractions 模块');
await openModule('attractions', 7);
console.log('C. Experiences 模块');
await openModule('experiences', 6);

console.log(`\n后台冒烟：${pass} 通过 / ${fail} 失败`);
await browser.close();
ASSET_SERVER.close();
process.exit(fail ? 1 : 0);
