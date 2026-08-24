// 景点 / 体验 / 行程 模块：后台(admin) 数据 → 前台(已生成 HTML) 一一映射校验
//
// 背景（2026-08-24 用户报告「后台改了景点/体验/行程，前台不变」）：
//   rebuild-hotels.yml 只监听 hotels-data.mjs + home-data.mjs，漏掉
//   experiences-data.mjs / tours-data.mjs → 这两个模块后台改了前台不更新。
//   本校验器锁定「已生成的 HTML 必须反映当前数据文件」，是 publish-loop 的
//   前端落地闭环。只读、不跑 build、不改动任何文件。
//
// 运行：node tests/data-mapping-sitepages.mjs
//       （CI 中作为 pull_request 门禁；本地用于发布前自检）

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attractions } from '../attractions-data.mjs';
import { experiences } from '../experiences-data.mjs';
import { tours } from '../tours-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; fails.push(msg); console.error('  ✗ ' + msg); }
}

// HTML 转义（与模板一致）：& < > 转义后再做 includes 比对
const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

// 读取生成文件（不存在返回空串，由调用方判缺失）
const readHtml = (rel) => {
  const p = path.join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
};

// 单个 item 的落地校验：详情页（由本模块 *-data.mjs 驱动，是后台→前台闭环的核心）。
// 注：hub/index 页（attractions/index.html 等）由 module-index-data.mjs 驱动，
// 属于另一数据源（非后台可编辑），不在本 admin→frontend 闭环校验范围内。
function checkItem(module, item, label) {
  const slug = item.slug;
  if (!slug) { ok(false, `${label}: 缺 slug，无法定位生成文件`); return; }
  if (item.hidden) { console.log(`  · ${label} (${slug}) 隐藏，跳过`); return; }

  const detailRel = path.join(module, slug + '.html');
  const detail = readHtml(detailRel);
  if (!detail) { ok(false, `${label}: 生成文件缺失 ${detailRel}`); return; }

  const primary = item.h1 || item.title;
  // ① 详情页必须含主标题（HTML 转义后）
  if (primary) ok(detail.includes(esc(primary).slice(0, 60)), `${label} 详情页含主标题「${primary.slice(0, 30)}…」`);
  // ② 详情页必须含 hero 图引用（base 名即可，证明数据→图片映射）
  if (item.heroImg) ok(detail.includes(item.heroImg), `${label} 详情页含 hero 图 ${item.heroImg}`);
}

console.log('A. Attractions 数据 → 前台映射');
{
  for (const it of attractions) checkItem('attractions', it, 'attractions:' + (it.slug || '?'));
}

console.log('\nB. Experiences 数据 → 前台映射');
{
  for (const it of experiences) checkItem('experiences', it, 'experiences:' + (it.slug || '?'));
}

console.log('\nC. Tours 数据 → 前台映射');
{
  const items = Array.isArray(tours) ? tours : (tours.items || []);
  ok(items.length > 0, `tours.items 解析为 ${items.length} 条`);
  for (const it of items) checkItem('tours', it, 'tours:' + (it.slug || '?'));
}

console.log(`\n景点/体验/行程 前台映射校验：${pass} 通过 / ${fail} 失败`);
if (fail) { console.log('FAILS:\n' + fails.map((f) => ' - ' + f).join('\n')); process.exit(1); }
