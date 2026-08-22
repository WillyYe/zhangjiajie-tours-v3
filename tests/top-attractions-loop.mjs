// 首页景点 Top Attractions 模块验证器（Loop Engineering verifier）
// ① 前端映射零回归：buildTopAttractionsHtml(data) === index.html 当前 TOP-ATTRACTION:GRID 标记内容
// ② 图库隔离：图片仅列 admin/imglib/top-attractions.json，且都落在 images/top-attractions/（与根 images 解耦，不借图）
// ③ round-trip：home-data.mjs 的 topAttractions 块重建后 parse 等价 + 编辑传播
// ④ 无死链：每个可见卡片都指向真实存在的 attractions/<slug>.html；且 hidden 卡片不渲染（不产生死链）
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildTopAttractionsHtml, applyTopAttractions, listTopAttractionImages, listTopAttractionLinks } from '../admin/modules/top-attractions-render.js';
import { parseMjs, rebuild } from '../admin/mjs.js';
import { topAttractions as taData } from '../home-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const TA_JSON = path.join(ROOT, 'admin', 'imglib', 'top-attractions.json');
const TA_DIR = path.join(ROOT, 'images', 'top-attractions');

let pass = 0, fail = 0;
const ok = (name) => { pass++; console.log('  ✓ ' + name); };
const no = (name, extra = '') => { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); };
function assert(cond, name, extra) { cond ? ok(name) : no(name, extra); }

// ---------- ① 前端映射零回归 ----------
try {
  const html = fs.readFileSync(INDEX, 'utf8');
  const m = html.match(/<!--TOP-ATTRACTION:GRID:START-->([\s\S]*?)<!--TOP-ATTRACTION:GRID:END-->/);
  if (!m) { no('index.html 含 TOP-ATTRACTION:GRID 标记'); }
  else {
    const current = m[1].trim();
    const generated = buildTopAttractionsHtml(taData).trim();
    assert(current === generated, '① Top Attractions 前端映射零回归（build === 当前标记内容）',
      current === generated ? '' : '生成与线上不一致');
  }
} catch (e) { no('① 读取 index.html 失败', e.message); }

// applyTopAttractions 不破坏标记，且能正确重写
try {
  const html = fs.readFileSync(INDEX, 'utf8');
  const out = applyTopAttractions(html, taData);
  const gm = out.match(/<!--TOP-ATTRACTION:GRID:START-->([\s\S]*?)<!--TOP-ATTRACTION:GRID:END-->/);
  assert(/<!--TOP-ATTRACTION:GRID:START-->/.test(out) && /<!--TOP-ATTRACTION:GRID:END-->/.test(out), '① applyTopAttractions 保留标记');
  assert(gm && /images\/top-attractions\//.test(gm[1]), '① 卡片图指向 images/top-attractions/ 模块目录');
  // 仅校验网格区域内：不得出现根目录景点图引用（其他首页模块用根 images/ 属正常）
  assert(gm && !/src="images\/(yuanjiajie|tianzi|tianmen|jinbianxi|huangshizhai|gallery|yangjiajie)-/.test(gm[1]), '① 网格区域内无遗留根目录景点图引用（仅用模块隔离目录）');
} catch (e) { no('① applyTopAttractions 失败', e.message); }

// ---------- ② 图库隔离 ----------
try {
  const list = JSON.parse(fs.readFileSync(TA_JSON, 'utf8'));
  assert(Array.isArray(list) && list.length > 0, '② top-attractions.json 为有效图片清单');
  let allInDir = true;
  for (const name of list) {
    if (!fs.existsSync(path.join(TA_DIR, name + '.webp'))) allInDir = false;
  }
  assert(allInDir, '② top-attractions.json 列出的图都存在于 images/top-attractions/');
  const dirFiles = fs.readdirSync(TA_DIR).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, ''));
  const symDiff = dirFiles.filter((f) => !list.includes(f)).concat(list.filter((f) => !dirFiles.includes(f)));
  assert(symDiff.length === 0, '② images/top-attractions/ 与 json 清单完全一致（无孤儿/缺漏）',
    '差异: ' + JSON.stringify(symDiff));
  assert(list.every((n) => !n.includes('/')), '② json 仅存文件名（物理隔离，不借图）');
} catch (e) { no('② 图库隔离校验失败', e.message); }

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
  assert(links.length > 0, '④ 存在可见卡片链接');
  let allPagesExist = true;
  const missingPages = [];
  for (const l of links) {
    if (!fs.existsSync(path.join(ROOT, l))) { allPagesExist = false; missingPages.push(l); }
  }
  assert(allPagesExist, '④ 所有可见卡片都指向真实存在的 attractions/<slug>.html（无死链）',
    '缺失: ' + JSON.stringify(missingPages));
  // hidden 卡片不渲染 → 不产生指向不存在页面的死链（验证 applyTopAttractions 跳过 hidden）
  const oneHidden = JSON.parse(JSON.stringify(taData));
  oneHidden.items[0].hidden = true;
  const outHtml = applyTopAttractions(html, oneHidden);
  const m = outHtml.match(/<!--TOP-ATTRACTION:GRID:START-->([\s\S]*?)<!--TOP-ATTRACTION:GRID:END-->/);
  const hiddenSlug = taData.items[0].slug;
  assert(!m[1].includes('attraction-' + hiddenSlug), '④ hidden 卡片不渲染前台（不产生死链）');
  assert(!m[1].includes('href="attractions/' + hiddenSlug + '.html"'), '④ hidden 卡片不产生详情页链接');
} catch (e) { no('④ 无死链校验失败', e.message); }

console.log(`\n首页景点 Top Attractions 验证器：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
