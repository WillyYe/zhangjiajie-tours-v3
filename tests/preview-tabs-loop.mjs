// 后台预览「卡片/详情」切换按钮可见性回归测试（Playwright）
// 回归目标：style.css 修复前 .preview-tabs 的 display:inline-flex 覆盖 [hidden] 属性，
//           导致本应隐藏切换按钮的模块（只详情/只卡片/单区块）也一直显示按钮。
// 验证：#previewTabs 的 getComputedStyle().display 与规划一致：
//   - 只详情 / 只卡片 / 单区块模块 → 'none'（hidden 属性生效）
//   - 卡片+详情模块选中对应卡片时 → 'inline-flex'（hidden 被移除）
// 运行：node tests/preview-tabs-loop.mjs   （可选 CHROME_PATH=...）
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

// 拦截 GitHub Contents API：.mjs 一律返回本地内容（缺失则空模块），其余 404，彻底离线、确定性。
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

const tabsState = () => page.evaluate(() => {
  const el = document.getElementById('previewTabs');
  if (!el) return { missing: true, display: 'MISSING', hidden: false };
  return { missing: false, display: getComputedStyle(el).display, hidden: el.hasAttribute('hidden') };
});
async function openModule(name) {
  await page.click(`.module[data-module="${name}"]`);
  await page.waitForTimeout(500);
}

console.log('A. 加载无致命错误');
ok(pageErrors.length === 0, 'admin 加载无 pageerror' + (pageErrors.length ? '：' + pageErrors.slice(0, 2).join(' | ') : ''));

console.log('B. 应隐藏切换按钮的模块（只详情 / 只卡片 / 单区块）');
for (const m of ['attractions', 'experiences', 'homeTourCards', 'hero', 'welcome', 'nav']) {
  await openModule(m);
  const s = await tabsState();
  ok(!s.missing && s.display === 'none', `${m} 切换按钮隐藏（display=${s.display}）`);
}

console.log('C. 卡片+详情模块选中对应卡片时应显示按钮');
// hotels：选中第一间酒店（种子数据均含 detail）→ 显 卡片/详情
await openModule('hotels');
await page.waitForSelector('.he-tree-hotel', { timeout: 5000 });
await page.click('.he-tree-hotel'); // 第一间酒店
await page.waitForTimeout(500);
{
  const s = await tabsState();
  ok(!s.missing && !s.hidden && s.display !== 'none', `hotels 选中酒店后切换按钮显示（hidden=${s.hidden}, display=${s.display}）`);
}
// topAttractions：行默认折叠，先展开「表格行」分类，再点首行选中 → 显示（联动景点详情页预览）
await openModule('topAttractions');
await page.click('.he-tree-cat-name:has-text("表格行")', { timeout: 5000 });
await page.waitForSelector('.he-tree-hotel', { timeout: 5000 });
await page.click('.he-tree-hotel'); // 第一行
await page.waitForTimeout(400);
{
  const s = await tabsState();
  ok(!s.missing && !s.hidden && s.display !== 'none', `topAttractions 选中行后切换按钮显示（hidden=${s.hidden}, display=${s.display}）`);
}
// tours：套餐卡默认折叠，先展开「套餐卡片」分类，再点首卡选中 → 显示
await openModule('tours');
await page.click('.he-tree-cat-name:has-text("套餐卡片")', { timeout: 5000 });
await page.waitForSelector('.he-tree-hotel', { timeout: 5000 });
await page.click('.he-tree-hotel'); // 第一张套餐卡
await page.waitForTimeout(400);
{
  const s = await tabsState();
  ok(!s.missing && !s.hidden && s.display !== 'none', `tours 选中套餐卡后切换按钮显示（hidden=${s.hidden}, display=${s.display}）`);
}

console.log(`\n预览切换按钮可见性：${pass} 通过 / ${fail} 失败`);
await browser.close();
ASSET_SERVER.close();
process.exit(fail ? 1 : 0);
