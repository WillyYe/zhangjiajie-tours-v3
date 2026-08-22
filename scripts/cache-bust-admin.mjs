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

// 注入 import map（占位 __ADMIN_IMPORTMAP__）→ 合法 JSON
if (html.includes('__ADMIN_IMPORTMAP__')) {
  const json = JSON.stringify({ imports }, null, 2);
  html = html.replace('__ADMIN_IMPORTMAP__', () => json);
}

// 入口脚本查询串占位 → 真实 hash
if (html.includes('__ADMIN_CACHE__')) {
  html = html.replace(/app\.js\?__ADMIN_CACHE__/g, `app.js?v=${tag}`);
}

if (html !== before) {
  fs.writeFileSync(INDEX, html, 'utf8');
  console.log(`  ✓ cache-bust admin/index.html (tag=${tag}, ${Object.keys(imports).length} modules mapped)`);
} else {
  console.log(`  • admin/index.html already up to date (tag=${tag})`);
}
