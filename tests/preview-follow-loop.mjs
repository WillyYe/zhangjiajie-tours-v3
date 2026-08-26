// 后台预览「编辑即跟随」回归测试（Playwright）
// 回归目标：字段级自动跟随（聚焦字段 → 预览滚动+定位），含：
//   B. 聚焦字段 → 预览 iframe 内锚点滚入视区
//   C. 用户在预览区手动滚动 → 暂停跟随；再次聚焦字段 → 恢复
//   D. 关闭「自动跟随」开关 → 聚焦字段不再滚动预览
//   E. 聚焦详情字段 → 预览自动切到详情页并定位（card↔detail 模式自动切换）
// 运行：node tests/preview-follow-loop.mjs   （可选 CHROME_PATH=...）
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
});
await page.goto(`http://127.0.0.1:${PORT}/admin/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(800);

async function openModule(name) {
  await page.click(`.module[data-module="${name}"]`);
  await page.waitForTimeout(500);
}
// 若模块需要先选中树项才出表单，则选第一个树项
async function ensureForm() {
  const has = await page.$('.he-form-host [data-pv-anchor]');
  if (has) return;
  const tree = await page.$('.he-tree-hotel');
  if (tree) { await tree.click(); await page.waitForTimeout(400); }
}

async function focusPvField(anchor) {
  return await page.evaluate((a) => {
    const f = document.querySelector(`[data-pv-anchor="${a}"]`);
    if (!f) return false;
    const inp = f.querySelector('input,textarea,select,button') || f;
    inp.focus();
    return true;
  }, anchor);
}
async function scrollPreviewTo(top) {
  await page.evaluate((t) => {
    const f = document.querySelector('#preview iframe');
    if (!f || !f.contentDocument) return;
    f.contentDocument.documentElement.scrollTop = t;
    f.contentDocument.body.scrollTop = t;
  }, top);
}
async function anchorInView(anchor) {
  return await page.evaluate((a) => {
    const f = document.querySelector('#preview iframe');
    if (!f || !f.contentDocument) return null;
    const el = f.contentDocument.getElementById(a);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const vh = f.contentDocument.defaultView.innerHeight;
    const cy = r.top + r.height / 2;
    return cy >= -5 && cy <= vh + 5;
  }, anchor);
}
async function waitAnchorInView(anchor, timeout = 2500) {
  try {
    await page.waitForFunction((a) => {
      const f = document.querySelector('#preview iframe');
      if (!f || !f.contentDocument) return false;
      const el = f.contentDocument.getElementById(a);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const vh = f.contentDocument.defaultView.innerHeight;
      const cy = r.top + r.height / 2;
      return cy >= -5 && cy <= vh + 5;
    }, anchor, { timeout });
    return true;
  } catch { return false; }
}

console.log('A. 加载无致命错误');
ok(pageErrors.length === 0, 'admin 加载无 pageerror' + (pageErrors.length ? '：' + pageErrors.slice(0, 2).join(' | ') : ''));

console.log('B. 聚焦字段 → 预览自动跟随（flash 验证，与内容高度无关）');
await openModule('attractions');
await ensureForm();
await focusPvField('tldr');
const flashed = await page.waitForFunction(() => {
  const f = document.querySelector('#preview iframe');
  const el = f && f.contentDocument && f.contentDocument.getElementById('tldr');
  return !!el && el.classList.contains('pv-flash');
}, { timeout: 2000 }).then(() => true).catch(() => false);
ok(flashed, '聚焦 tldr 后预览内 #tldr 被高亮（pv-flash）—— 证明「聚焦即跟随」生效');

console.log('C. 手动滚动 → 暂停跟随；重渲染不回拉；再次跳转 → 恢复（tours 详情页，内容高可滚动）');
await openModule('tours');
await page.click('.he-tree-cat-name:has-text("套餐卡片")', { timeout: 5000 });
await page.waitForSelector('.he-tree-hotel', { timeout: 5000 });
await page.click('.he-tree-hotel');
await page.waitForTimeout(500);
await page.evaluate(() => window.__jumpToField('detail', 'overview'));
const cIn = await waitAnchorInView('overview');
ok(cIn, '跳转到 overview 后滚入视区');
await page.waitForTimeout(500); // 等跳跃的 suppress 窗口（400ms）结束，确保接下来手动滚动被视为用户滚动
await scrollPreviewTo(0); // 手动滚到顶部 → 触发暂停
await page.waitForTimeout(250);
async function previewScrollTop() {
  await page.waitForFunction(() => {
    const f = document.querySelector('#preview iframe');
    return f && f.contentDocument && f.contentDocument.documentElement;
  }, { timeout: 3000 }).catch(() => {});
  return await page.evaluate(() => {
    const f = document.querySelector('#preview iframe');
    return (f && f.contentDocument && f.contentDocument.documentElement) ? f.contentDocument.documentElement.scrollTop : -1;
  });
}
const topManually = await previewScrollTop();
// 重渲染但不聚焦（改任意字段值派发 input）→ 暂停期间不应把预览滚回激活锚点
await page.evaluate(() => {
  const ta = document.querySelector('.he-form-host [data-pv-anchor] textarea, .he-form-host [data-pv-anchor] input');
  if (ta) { ta.value = (ta.value || '') + ' x'; ta.dispatchEvent(new Event('input', { bubbles: true })); }
});
await page.waitForTimeout(500);
const topAfterRender = await previewScrollTop();
ok(Math.abs(topAfterRender - topManually) < 5,
  `暂停期间重渲染保持手动滚动位置（scrollTop ${topManually}→${topAfterRender}，未回拉激活字段）`);
await page.evaluate(() => window.__jumpToField('detail', 'overview')); // 再次跳转 → 恢复
const cResume = await waitAnchorInView('overview');
ok(cResume, '再次跳转 overview → 恢复跟随（滚入视区）');

console.log('D. 关闭「自动跟随」开关 → 聚焦不滚动/不闪（确定性：检查不出现高亮）');
await openModule('attractions');
await ensureForm();
await page.uncheck('#followToggle');
await page.waitForTimeout(200);
await focusPvField('tldr');
const flashedOff = await page.waitForFunction(() => {
  const f = document.querySelector('#preview iframe');
  const el = f && f.contentDocument && f.contentDocument.getElementById('tldr');
  return !!el && el.classList.contains('pv-flash');
}, { timeout: 1800 }).then(() => true).catch(() => false);
ok(!flashedOff, '关闭开关后聚焦 tldr 预览不闪（自动跟随已禁用）');
await page.check('#followToggle');
await page.waitForTimeout(150);

console.log('E. 聚焦详情字段 → 自动切到详情页并定位（card↔detail 切换）');
await openModule('tours');
await page.click('.he-tree-cat-name:has-text("套餐卡片")', { timeout: 5000 });
await page.waitForSelector('.he-tree-hotel', { timeout: 5000 });
await page.click('.he-tree-hotel');
await page.waitForTimeout(500);
const eSwitch = await page.evaluate(() => {
  window.__jumpToField('detail', 'hero');
  return true;
});
await page.waitForTimeout(400);
const eDetailActive = await page.evaluate(() => {
  const b = document.querySelector('#previewTabs .ptab[data-mode="detail"]');
  return !!b && b.classList.contains('active');
});
const eHeroIn = await waitAnchorInView('hero');
ok(eDetailActive, '预览切换到「详情」页（detail 页签激活）');
ok(eHeroIn, '详情页 #hero 滚入视区');

console.log(`\n预览自动跟随：${pass} 通过 / ${fail} 失败`);
await browser.close();
ASSET_SERVER.close();
process.exit(fail ? 1 : 0);
