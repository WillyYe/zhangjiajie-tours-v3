// 首页 Top 8 Must-See Spots 模块验证器（Loop Engineering verifier）
// ① 前端映射零回归：buildTopAttractionsHtml(data) === index.html 当前 TOP-8-TABLE 标记内容
// ② 表格式无图：本模块纯文字、无图片引用、无图库依赖
// ③ round-trip：home-data.mjs 的 topAttractions 块重建后 parse 等价 + 编辑传播
// ④ 无死链 + hidden 生效：表格行数 == 可见 items 数；hidden 行不渲染
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildTopAttractionsHtml, applyTopAttractions, listTopAttractionImages, listTopAttractionLinks } from '../admin/modules/top-attractions-render.js';
import { parseMjs, rebuild } from '../admin/mjs.js';
import { topAttractions as taData } from '../home-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');

let pass = 0, fail = 0;
const ok = (name) => { pass++; console.log('  ✓ ' + name); };
const no = (name, extra = '') => { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); };
function assert(cond, name, extra) { cond ? ok(name) : no(name, extra); }

// ---------- ① 前端映射零回归 ----------
try {
  const html = fs.readFileSync(INDEX, 'utf8');
  const m = html.match(/<!--TOP-8-TABLE:START-->([\s\S]*?)<!--TOP-8-TABLE:END-->/);
  if (!m) { no('index.html 含 TOP-8-TABLE 标记'); }
  else {
    const current = m[1].trim();
    const generated = buildTopAttractionsHtml(taData).trim();
    assert(current === generated, '① Top 8 表格前端映射零回归（build === 当前标记内容）',
      current === generated ? '' : '生成与线上不一致');
  }
} catch (e) { no('① 读取 index.html 失败', e.message); }

// applyTopAttractions 不破坏标记，且能正确重写
try {
  const html = fs.readFileSync(INDEX, 'utf8');
  const out = applyTopAttractions(html, taData);
  const gm = out.match(/<!--TOP-8-TABLE:START-->([\s\S]*?)<!--TOP-8-TABLE:END-->/);
  assert(/<!--TOP-8-TABLE:START-->/.test(out) && /<!--TOP-8-TABLE:END-->/.test(out), '① applyTopAttractions 保留标记');
  assert(gm && /class="compare-table/.test(gm[1]), '① 标记内渲染 compare-table 文字表格');
  assert(gm && !/<img/.test(gm[1]), '① 表格纯文字、无图片引用（表格式无图库）');
} catch (e) { no('① applyTopAttractions 失败', e.message); }

// ---------- ② 表格式无图（与图片库隔离无关，本模块根本不放图） ----------
try {
  assert(listTopAttractionImages(taData).length === 0, '② 表格模块无图片引用（listTopAttractionImages 返回空）');
  assert(listTopAttractionLinks(taData).length === 0, '② 表格模块无详情页链接（listTopAttractionLinks 返回空）');
  const gen = buildTopAttractionsHtml(taData);
  assert(!/images\//.test(gen), '② 生成表格不含任何 images/ 路径（纯文字表）');
} catch (e) { no('② 无图校验失败', e.message); }

// ---------- ③ round-trip ----------
try {
  const text = fs.readFileSync(path.join(ROOT, 'home-data.mjs'), 'utf8');
  const { preamble, blocks } = parseMjs(text);
  const taBlock = blocks.find((b) => b.name === 'topAttractions');
  const newText = rebuild(preamble, blocks, { topAttractions: taBlock.value });
  const reparsed = parseMjs(newText);
  const taAgain = reparsed.blocks.find((b) => b.name === 'topAttractions').value;
  const same = JSON.stringify(taAgain) === JSON.stringify(taBlock.value);
  assert(same, '③ topAttractions 块重建 round-trip 等价（保存→重载字段不变）', same ? '' : '字段漂移');
  const edited = JSON.parse(JSON.stringify(taBlock.value));
  edited.title = 'TEST EDIT TITLE';
  const newText2 = rebuild(preamble, blocks, { topAttractions: edited });
  const again2 = parseMjs(newText2).blocks.find((b) => b.name === 'topAttractions').value;
  assert(again2.title === 'TEST EDIT TITLE' && again2.items.length === taBlock.value.items.length, '③ 编辑后字段正确落盘（不波及其它块）');
} catch (e) { no('③ round-trip 失败', e.message); }

// ---------- ④ 行数 + hidden 生效 ----------
try {
  const html = fs.readFileSync(INDEX, 'utf8');
  const gen = buildTopAttractionsHtml(taData);
  const rowCount = (gen.match(/<tr id="spot-/g) || []).length;
  const visCount = taData.items.filter((it) => !it.hidden).length;
  assert(rowCount === visCount, '④ 表格行数 == 可见 items 数（hidden 不渲染）', `rows=${rowCount} vis=${visCount}`);
  const oneHidden = JSON.parse(JSON.stringify(taData));
  oneHidden.items[0].hidden = true;
  const outHtml = applyTopAttractions(html, oneHidden);
  const m = outHtml.match(/<!--TOP-8-TABLE:START-->([\s\S]*?)<!--TOP-8-TABLE:END-->/);
  const hiddenSlug = taData.items[0].slug;
  assert(!m[1].includes('id="spot-' + hiddenSlug + '"'), '④ hidden 行不渲染前台');
} catch (e) { no('④ 行数/hidden 校验失败', e.message); }

console.log(`\n首页 Top 8 Must-See Spots 验证器：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
