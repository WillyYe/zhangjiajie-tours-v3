// 首页 Hero 模块验证器（Loop Engineering verifier）
// ① 前端映射零回归：buildHero(hero) === index.html 当前 hero 标记内容
// ② 图库隔离：hero 图仅列 admin/imglib/hero.json，且都落在 images/hero/
// ③ round-trip：home-data.mjs 的 hero 块重建后 parse 等价
// ④ 零回归：hotels-data.mjs / 酒店模块不受影响（home-data 改动不波及其它）
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildHero, applyHero } from '../scripts/build-home.mjs';
import { parseMjs, rebuild } from '../admin/mjs.js';
import { hero as heroData } from '../home-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const HERO_JSON = path.join(ROOT, 'admin', 'imglib', 'hero.json');
const HERO_DIR = path.join(ROOT, 'images', 'hero');

let pass = 0, fail = 0;
const ok = (name) => { pass++; console.log('  ✓ ' + name); };
const no = (name, extra = '') => { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); };
function assert(cond, name, extra) { cond ? ok(name) : no(name, extra); }

// ---------- ① 前端映射零回归 ----------
try {
  const html = fs.readFileSync(INDEX, 'utf8');
  const m = html.match(/<!--HOME:HERO:START-->([\s\S]*?)<!--HOME:HERO:END-->/);
  if (!m) { no('index.html 含 HOME:HERO 标记'); }
  else {
    const current = m[1].trim();
    const generated = buildHero(heroData).trim();
    assert(current === generated, '① Hero 前端映射零回归（buildHero === 当前标记内容）',
      current === generated ? '' : '生成与线上不一致');
  }
} catch (e) { no('① 读取 index.html 失败', e.message); }

// applyHero 不破坏标记，且能正确重写
try {
  const html = fs.readFileSync(INDEX, 'utf8');
  const out = applyHero(html, heroData);
  assert(/<!--HOME:HERO:START-->/.test(out) && /<!--HOME:HERO:END-->/.test(out), '① applyHero 保留 HOME:HERO 标记');
  // 检查 url 指向模块目录 images/hero/（与 bgImg 解耦，运营改 bgImg 仍过）
  assert(/url\('images\/hero\/[^']+'\)/.test(out), '① hero 背景图指向 images/hero/ 模块目录');
  assert(!/url\('images\/hero-tianzi-clouds\.webp'\)/.test(html), '① index.html 无遗留根目录 hero 背景引用');
} catch (e) { no('① applyHero 失败', e.message); }

// ---------- ② 图库隔离 ----------
try {
  const list = JSON.parse(fs.readFileSync(HERO_JSON, 'utf8'));
  assert(Array.isArray(list) && list.length > 0, '② hero.json 为有效图片清单');
  let allInDir = true;
  for (const name of list) {
    if (!fs.existsSync(path.join(HERO_DIR, name + '.webp'))) { allInDir = false; }
  }
  assert(allInDir, '② hero.json 列出的图都存在于 images/hero/');
  const dirFiles = fs.readdirSync(HERO_DIR).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, ''));
  const symDiff = dirFiles.filter((f) => !list.includes(f)).concat(list.filter((f) => !dirFiles.includes(f)));
  assert(symDiff.length === 0, '② images/hero/ 与 hero.json 清单完全一致（无孤儿/缺漏）',
    '差异: ' + JSON.stringify(symDiff));
  // hero 模块图不得出现在根 images/ 作为模块自有（根副本为全站共用，允许；此处仅确认模块目录独立）
  assert(list.every((n) => !n.includes('/')), '② hero.json 仅存文件名（物理隔离于 images/hero/）');
} catch (e) { no('② 图库隔离校验失败', e.message); }

// ---------- ③ round-trip ----------
try {
  const text = fs.readFileSync(path.join(ROOT, 'home-data.mjs'), 'utf8');
  const { preamble, blocks } = parseMjs(text);
  const heroBlock = blocks.find((b) => b.name === 'hero');
  const newText = rebuild(preamble, blocks, { hero: heroBlock.value });
  const reparsed = parseMjs(newText);
  const heroAgain = reparsed.blocks.find((b) => b.name === 'hero').value;
  const same = JSON.stringify(heroAgain) === JSON.stringify(heroBlock.value);
  assert(same, '③ hero 块重建 round-trip 等价（保存→重载字段不变）',
    same ? '' : '字段漂移');
  // 改动后也能等价写回
  const edited = JSON.parse(JSON.stringify(heroBlock.value));
  edited.eyebrow = 'TEST EDIT';
  const newText2 = rebuild(preamble, blocks, { hero: edited });
  const again2 = parseMjs(newText2).blocks.find((b) => b.name === 'hero').value;
  assert(again2.eyebrow === 'TEST EDIT' && again2.h1Line1 === heroBlock.value.h1Line1, '③ hero 块编辑后字段正确落盘');
} catch (e) { no('③ round-trip 失败', e.message); }

// ---------- ④ 零回归：酒店模块不受影响 ----------
try {
  const hotelsExists = fs.existsSync(path.join(ROOT, 'hotels-data.mjs'));
  const hotelsModExists = fs.existsSync(path.join(ROOT, 'admin', 'modules', 'hotels.js'));
  assert(hotelsExists && hotelsModExists, '④ 酒店数据/模块文件完好');
  // home-data.mjs 改动不应触发 hotels 数据重建差异（两者独立文件）
  const hotelsText = fs.existsSync(path.join(ROOT, 'hotels-data.mjs')) ? fs.readFileSync(path.join(ROOT, 'hotels-data.mjs'), 'utf8') : '';
  assert(!hotelsText.includes('export const hero'), '④ hotels-data.mjs 不含 hero 块（模块数据互不污染）');
} catch (e) { no('④ 零回归校验失败', e.message); }

console.log(`\n首页 Hero 验证器：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
