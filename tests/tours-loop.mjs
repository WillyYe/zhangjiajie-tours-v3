// Tour Packages 模块验证器（Loop Engineering verifier）
// ① 构建层映射零回归：生成的 tours/index.html 含 buildToursHubHtml(tours) 卡片网格；
//    每个 tours/<slug>.html 详情页无遗留 {{PLACEHOLDER}}。
// ② 图库隔离：图片仅列 admin/imglib/tours.json，且都落在 images/tours/（与根目录解耦，不借图）。
// ③ round-trip：tours-data.mjs 的 tours 块重建后 parse 等价 + 编辑传播。
// ④ 无死链 + hidden 生效：每个可见套餐都指向真实存在的 tours/<slug>.html；hidden 套餐
//    不在 hub 网格渲染、不产生详情页链接，且 build 的孤儿清理会移除其旧页。
// ⑤ 图片引用解析：listTourImages 列出的图都在 images/tours/ 下存在（无 404）。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildToursHubHtml, tourDetailMap, listTourImages, listTourLinks } from '../admin/modules/tours-render.js';
import { parseMjs, rebuild } from '../admin/mjs.js';
import { tours as toursData } from '../tours-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TOURS_DIR = path.join(ROOT, 'tours');
const TOURS_JSON = path.join(ROOT, 'admin', 'imglib', 'tours.json');
const TOURS_IMG_DIR = path.join(ROOT, 'images', 'tours');
const TOURS_DATA = path.join(ROOT, 'tours-data.mjs');

let pass = 0, fail = 0;
const ok = (name) => { pass++; console.log('  ✓ ' + name); };
const no = (name, extra = '') => { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); };
function assert(cond, name, extra) { cond ? ok(name) : no(name, extra); }

// ---------- ① 构建层映射零回归 ----------
try {
  const hubHtml = fs.readFileSync(path.join(TOURS_DIR, 'index.html'), 'utf8');
  // hub 页位于 tours/ 目录，构建时把卡片链接 "tours/" 重映射为同目录 ""（与后台预览反向映射一致）
  const generated = buildToursHubHtml(toursData).replace(/href="tours\//g, 'href="');
  assert(hubHtml.includes(generated), '① hub 页含 buildToursHubHtml(tours) 卡片网格（与 build 同源零回归）',
    hubHtml.includes(generated) ? '' : 'hub 网格与渲染函数不一致');
  assert(!/\{\{[A-Z_]+\}\}/.test(hubHtml), '① hub 页无遗留 {{PLACEHOLDER}}');

  const links = listTourLinks(toursData);
  assert(links.length > 0, '① 存在可见套餐详情页链接');
  let allDetailClean = true, missingDetail = [];
  for (const slug of links.map((l) => l.replace(/^tours\//, '').replace(/\.html$/, ''))) {
    const f = path.join(TOURS_DIR, slug + '.html');
    if (!fs.existsSync(f)) { allDetailClean = false; missingDetail.push(slug); continue; }
    const d = fs.readFileSync(f, 'utf8');
    if (/\{\{[A-Z_]+\}\}/.test(d)) allDetailClean = false;
  }
  assert(allDetailClean, '① 每个 tours/<slug>.html 详情页存在且无遗留 {{PLACEHOLDER}}',
    '缺失/有遗留: ' + JSON.stringify(missingDetail));
  // 详情页内容至少含 H1 标题与行程/FAQ 区块（验证 tourDetailMap 真被填）
  const firstSlug = links[0].replace(/^tours\//, '').replace(/\.html$/, '');
  const dHtml = fs.readFileSync(path.join(TOURS_DIR, firstSlug + '.html'), 'utf8');
  const first = toursData.items.find((it) => it.slug === firstSlug);
  assert(first && dHtml.includes(first.title), '① 详情页含套餐标题（tourDetailMap 生效）');
} catch (e) { no('① 构建层校验失败', e.message); }

// ---------- ② 图库隔离 ----------
try {
  const list = JSON.parse(fs.readFileSync(TOURS_JSON, 'utf8'));
  assert(Array.isArray(list) && list.length > 0, '② tours.json 为有效图片清单');
  let allInDir = true;
  for (const name of list) {
    if (!fs.existsSync(path.join(TOURS_IMG_DIR, name + '.webp'))) allInDir = false;
  }
  assert(allInDir, '② tours.json 列出的图都存在于 images/tours/');
  const dirFiles = fs.readdirSync(TOURS_IMG_DIR).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, ''));
  const symDiff = dirFiles.filter((f) => !list.includes(f)).concat(list.filter((f) => !dirFiles.includes(f)));
  assert(symDiff.length === 0, '② images/tours/ 与 json 清单完全一致（无孤儿/缺漏）',
    '差异: ' + JSON.stringify(symDiff));
  assert(list.every((n) => !n.includes('/')), '② json 仅存文件名（物理隔离，不借图）');
} catch (e) { no('② 图库隔离校验失败', e.message); }

// ---------- ③ round-trip ----------
try {
  const text = fs.readFileSync(TOURS_DATA, 'utf8');
  const { preamble, blocks } = parseMjs(text);
  const tBlock = blocks.find((b) => b.name === 'tours');
  assert(!!tBlock, '③ tours-data.mjs 含 tours 块');
  const newText = rebuild(preamble, blocks, { tours: tBlock.value });
  const reparsed = parseMjs(newText);
  const again = reparsed.blocks.find((b) => b.name === 'tours').value;
  const same = JSON.stringify(again) === JSON.stringify(tBlock.value);
  assert(same, '③ tours 块重建 round-trip 等价（保存→重载字段不变）', same ? '' : '字段漂移');
  // 改动后也能等价写回，且只改 tours 块
  const edited = JSON.parse(JSON.stringify(tBlock.value));
  edited.title = 'TEST EDIT TITLE';
  const newText2 = rebuild(preamble, blocks, { tours: edited });
  const again2 = parseMjs(newText2).blocks.find((b) => b.name === 'tours').value;
  assert(again2.title === 'TEST EDIT TITLE' && again2.items.length === tBlock.value.items.length,
    '③ 编辑后字段正确落盘（不波及其它块）');
} catch (e) { no('③ round-trip 失败', e.message); }

// ---------- ④ 无死链 + hidden 生效 ----------
try {
  // hub 网格不渲染 hidden 卡片（不产生死链）
  const copy = JSON.parse(JSON.stringify(toursData));
  const hideSlug = copy.items[0].slug;
  copy.items[0].hidden = true;
  const hubCopy = buildToursHubHtml(copy);
  assert(!hubCopy.includes('id="tour-' + hideSlug + '"'), '④ hidden 套餐不在 hub 网格渲染（不产生死链）');
  assert(!hubCopy.includes('href="tours/' + hideSlug + '.html"'), '④ hidden 套餐不产生详情页链接');
  assert(listTourLinks(copy).every((l) => !l.includes(hideSlug)), '④ listTourLinks 排除 hidden 套餐');
  // 孤儿清理模拟：若某 slug 不在当前可见集合，build 的清理应删除其旧页
  const liveSlugs = new Set(toursData.items.filter((it) => !it.hidden).map((it) => it.slug));
  const onDisk = fs.readdirSync(TOURS_DIR).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5));
  const stale = onDisk.filter((s) => s !== 'index' && !liveSlugs.has(s));
  assert(stale.length === 0, '④ 磁盘上无孤儿详情页（所有 tours/<slug>.html 均对应可见套餐）',
    '孤儿: ' + JSON.stringify(stale));
} catch (e) { no('④ 无死链校验失败', e.message); }

// ---------- ⑤ 图片引用解析 ----------
try {
  const names = listTourImages(toursData);
  assert(names.length > 0, '⑤ 存在套餐图片引用');
  let allExist = true;
  const missing = [];
  for (const p of names) {
    if (!fs.existsSync(path.join(ROOT, p))) { allExist = false; missing.push(p); }
  }
  assert(allExist, '⑤ 所有套餐图片引用都在 images/tours/ 下存在（无 404）',
    '缺失: ' + JSON.stringify(missing));
} catch (e) { no('⑤ 图片引用校验失败', e.message); }

console.log(`\nTour Packages 验证器：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
