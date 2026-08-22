// cache-bust-admin.mjs — 给后台静态资源（admin/ 下所有 ES 模块 + 入口 app.js）
// 注入基于「文件内容」的版本哈希，彻底避免浏览器/CDN 缓存旧 JS 导致的混合态
// （典型症状：index.html 已更新出 nav 按钮，但 app.js 仍是旧缓存 → 报
//  "Cannot read properties of undefined (reading 'file')"）。
//
// 机制：用 import map 把每个模块的说明符映射到 `?v=<hash>`；
// 入口 <script src="app.js?__ADMIN_CACHE__"> 也换成真实 hash。
// hash 由 admin 下所有 .js 内容组合算出 → 任一文件变更 hash 即变 → URL 变 → 缓存破。
// 直接运行：node scripts/cache-bust-admin.mjs
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ADMIN = path.join(ROOT, 'admin');
const INDEX = path.join(ADMIN, 'index.html');

// 递归收集 admin 下所有 .js
function collectJs(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(collectJs(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out.sort();
}

const files = collectJs(ADMIN);

// 组合哈希：任一文件内容变化 → tag 变化
const h = crypto.createHash('sha256');
for (const f of files) h.update(fs.readFileSync(f, 'utf8'));
const tag = h.digest('hex').slice(0, 10);

// 生成 import map（跳过入口 app.js，它由 <script src> 控制）
const imports = {};
for (const f of files) {
  if (path.basename(f) === 'app.js') continue;
  const rel = './' + path.relative(ADMIN, f).split(path.sep).join('/');
  imports[rel] = rel + '?v=' + tag;
}

let html = fs.readFileSync(INDEX, 'utf8');
const before = html;

// 首次运行：占位符替换（新鲜 checkout 时 index.html 仍含占位符）
if (html.includes('__ADMIN_IMPORTMAP__')) {
  const json = JSON.stringify({ imports }, null, 2);
  html = html.replace('__ADMIN_IMPORTMAP__', () => json);
}
if (html.includes('__ADMIN_CACHE__')) {
  html = html.replace(/app\.js\?__ADMIN_CACHE__/g, `app.js?v=${tag}`);
}

// ⚠️ 关键修复：首次注入后占位符已消失，必须始终按新哈希刷新，否则改动永不生效。
// 入口脚本查询串：app.js?v=<旧> → app.js?v=<新>
html = html.replace(/app\.js\?v=[a-f0-9]+/g, `app.js?v=${tag}`);

// import map：整块重建 JSON（定位 <script type="importmap" id="admin-importmap"> … </script>）
const IM_OPEN = '<script type="importmap" id="admin-importmap">';
const imStart = html.indexOf(IM_OPEN);
if (imStart !== -1) {
  const imClose = html.indexOf('</script>', imStart);
  if (imClose !== -1) {
    const json = JSON.stringify({ imports }, null, 2);
    html = html.slice(0, imStart + IM_OPEN.length) + '\n' + json + '\n' + html.slice(imClose);
  }
}

if (html !== before) {
  fs.writeFileSync(INDEX, html, 'utf8');
  console.log(`  ✓ cache-bust admin/index.html (tag=${tag}, ${Object.keys(imports).length} modules mapped)`);
} else {
  console.log(`  • admin/index.html already up to date (tag=${tag})`);
}
