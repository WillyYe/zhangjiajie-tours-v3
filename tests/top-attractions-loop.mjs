// 首页 Top 8 Must-See Spots 模块验证器（Loop Engineering verifier）
// ① 前端映射零回归：buildTopAttractionsHtml(data) === index.html 当前 TOP-ATTRACTION 标记内容
// ② 表格无图片：生成的表格区块不得引用图片（Top 8 现为纯表格）
// ③ round-trip：home-data.mjs 的 topAttractions 块重建后 parse 等价 + 编辑传播
// ④ 无死链：每个可见行都指向真实存在的 attractions/<slug>.html；且 hidden 行不渲染（不产生死链）
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildTopAttractionsHtml, applyTopAttractions, listTopAttractionLinks } from '../admin/modules/top-attractions-render.js';
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
  const m = html.match(/<!--TOP-ATTRACTION:START-->([\s\S]*?)<!--TOP-ATTRACTION:END-->/);
  if (!m) { no('index.html 含 TOP-ATTRACTION:START/END 标记'); }
  else {
    const current = m[1].trim();
    const generated = buildTopAttractionsHtml(taData).trim();
    assert(current === generated, '① Top 8 前端映射零回归（build === 当前标记内容）',
      current === generated ? '' : '生成与线上不一致');
  }
} catch (e) { no('① 读取 index.html 失败', e.message); }

// applyTopAttractions 不破坏标记，且能正确重写
try {
  const html = fs.readFileSync(INDEX, 'utf8');
  const out = applyTopAttractions(html, taData);
  assert(/<!--TOP-ATTRACTION:START-->/.test(out) && /<!--TOP-ATTRACTION:END-->/.test(out), '① applyTopAttractions 保留 START/END 标记');
  const gm = out.match(/<!--TOP-ATTRACTION:START-->([\s\S]*?)<!--TOP-ATTRACTION:END-->/);
  assert(gm && /<table/.test(gm[1]), '① 生成内容为 <table> 表格');
  assert(gm && /<thead>/.test(gm[1]) && /<tbody>/.test(gm[1]), '① 表格含 thead / tbody');
} catch (e) { no('① applyTopAttractions 失败', e.message); }

// ---------- ② 表格无图片 / 无根目录景点图引用 ----------
try {
  const generated = buildTopAttractionsHtml(taData);
  assert(!/images\//.test(generated), '② Top 8 表格不引用任何图片（纯表格数据驱动）');
} catch (e) { no('② 表格图片检查失败', e.message); }

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
  // 改动后也能等价写回
  const edited = JSON.parse(JSON.stringify(taBlock.value));
  edited.title = 'TEST EDIT TITLE';
  const newText2 = rebuild(preamble, blocks, { topAttractions: edited });
  const again2 = parseMjs(newText2).blocks.find((b) => b.name === 'topAttractions').value;
  assert(again2.title === 'TEST EDIT TITLE' && again2.items.length === taBlock.value.items.length, '③ 编辑后字段正确落盘（不波及其它块）');
} catch (e) { no('③ round-trip 失败', e.message); }

// ---------- ④ 无死链 + hidden 生效 ----------
try {
  const html = fs.readFileSync(INDEX, 'utf8');
  const links = listTopAttractionLinks(taData);
  assert(links.length > 0, '④ 存在可见行详情页链接');
  let allPagesExist = true;
  const missingPages = [];
  for (const l of links) {
    if (!fs.existsSync(path.join(ROOT, l))) { allPagesExist = false; missingPages.push(l); }
  }
  assert(allPagesExist, '④ 所有可见行都指向真实存在的 attractions/<slug>.html（无死链）',
    '缺失: ' + JSON.stringify(missingPages));
  // hidden 行不渲染 → 不产生指向不存在页面的死链
  const oneHidden = JSON.parse(JSON.stringify(taData));
  oneHidden.items[0].hidden = true;
  const outHtml = applyTopAttractions(html, oneHidden);
  const m = outHtml.match(/<!--TOP-ATTRACTION:START-->([\s\S]*?)<!--TOP-ATTRACTION:END-->/);
  const hiddenSlug = taData.items[0].slug;
  assert(!m[1].includes('id="attraction-' + hiddenSlug + '"'), '④ hidden 行不渲染前台（不产生死链）');
  assert(!m[1].includes('href="attractions/' + hiddenSlug + '.html"'), '④ hidden 行不产生详情页链接');
} catch (e) { no('④ 无死链校验失败', e.message); }

console.log(`\n首页 Top 8 Must-See Spots 验证器：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
