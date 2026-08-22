// zhangjiajie-tours-v3 — Top Attractions 构建入口（Node 端，含 fs CLI）
// 纯函数全部来自 admin/modules/top-attractions-render.js（与后台预览同源 → 单一真源）。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildTopAttractionsHtml,
  applyTopAttractions,
  listTopAttractionImages,
} from '../admin/modules/top-attractions-render.js';

// 供其它 Node 脚本 / 测试复用（单一真源）
export { buildTopAttractionsHtml, applyTopAttractions, listTopAttractionImages };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// CLI：node scripts/build-top-attractions.mjs 直接重写 index.html（供手动/串联调用）
if (import.meta.url === `file://${process.argv[1]}`) {
  const { topAttractions } = await import('../home-data.mjs');
  const INDEX = path.join(ROOT, 'index.html');
  const html = fs.readFileSync(INDEX, 'utf8');
  const out = applyTopAttractions(html, topAttractions);
  fs.writeFileSync(INDEX, out, 'utf8');
  console.log('  ✓ rewrote index.html Top Attractions grid (build-top-attractions)');
}
