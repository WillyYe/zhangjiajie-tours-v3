// 首页 Welcome 模块验证器（Loop Engineering verifier）
// ① 前端映射零回归：buildWelcome(welcome) === index.html 当前 HOME:WELCOME 标记内容
// ② 图库隔离：welcome 图仅列 admin/imglib/welcome.json，且都落在 images/welcome/
// ③ round-trip：home-data.mjs 的 welcome 块重建后 parse 等价
// ④ 零回归：build-home.mjs 已改为引用 welcome-render.js 单一真源、标记保留、酒店模块不受污染
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildWelcome, applyWelcome } from '../admin/modules/welcome-render.js';
import { parseMjs, rebuild } from '../admin/mjs.js';
import { welcome as welcomeData } from '../home-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const WELCOME_JSON = path.join(ROOT, 'admin', 'imglib', 'welcome.json');
const WELCOME_DIR = path.join(ROOT, 'images', 'welcome');

let pass = 0, fail = 0;
const ok = (name) => { pass++; console.log('  ✓ ' + name); };
const no = (name, extra = '') => { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); };
function assert(cond, name, extra) { cond ? ok(name) : no(name, extra); }

// ---------- ① 前端映射零回归 ----------
try {
  const html = fs.readFileSync(INDEX, 'utf8');
  const m = html.match(/<!--HOME:WELCOME:START-->([\s\S]*?)<!--HOME:WELCOME:END-->/);
  if (!m) { no('index.html 含 HOME:WELCOME 标记'); }
  else {
    const current = m[1].trim();
    const generated = buildWelcome(welcomeData).trim();
    assert(current === generated, '① Welcome 前端映射零回归（buildWelcome === 当前标记内容）',
      current === generated ? '' : '生成与线上不一致');
  }
} catch (e) { no('① 读取 index.html 失败', e.message); }

// applyWelcome 不破坏标记，且能正确重写
try {
  const html = fs.readFileSync(INDEX, 'utf8');
  const out = applyWelcome(html, welcomeData);
  assert(/<!--HOME:WELCOME:START-->/.test(out) && /<!--HOME:WELCOME:END-->/.test(out), '① applyWelcome 保留 HOME:WELCOME 标记');
  // 背景图指向模块目录 images/welcome/
  assert(/url\('images\/welcome\/[^']+'\)/.test(out), '① welcome 背景图指向 images/welcome/ 模块目录');
} catch (e) { no('① applyWelcome 失败', e.message); }

// 强调约定 *文字* → <em class="wk-em">
try {
  const html = buildWelcome(welcomeData);
  assert(/<em class="wk-em">Wulingyuan Scenic Area<\/em>/.test(html), '① *强调* 渲染为 <em class="wk-em">');
} catch (e) { no('① 强调渲染校验失败', e.message); }

// ---------- ② 图库隔离 ----------
try {
  const list = JSON.parse(fs.readFileSync(WELCOME_JSON, 'utf8'));
  assert(Array.isArray(list) && list.length > 0, '② welcome.json 为有效图片清单');
  let allInDir = true;
  for (const name of list) {
    if (!fs.existsSync(path.join(WELCOME_DIR, name + '.webp'))) { allInDir = false; }
  }
  assert(allInDir, '② welcome.json 列出的图都存在于 images/welcome/');
  const dirFiles = fs.readdirSync(WELCOME_DIR).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, ''));
  const symDiff = dirFiles.filter((f) => !list.includes(f)).concat(list.filter((f) => !dirFiles.includes(f)));
  assert(symDiff.length === 0, '② images/welcome/ 与 welcome.json 清单一致（无孤儿/缺漏）',
    '差异: ' + JSON.stringify(symDiff));
  assert(list.every((n) => !n.includes('/')), '② welcome.json 仅存文件名（物理隔离于 images/welcome/）');
} catch (e) { no('② 图库隔离校验失败', e.message); }

// ---------- ③ round-trip ----------
try {
  const text = fs.readFileSync(path.join(ROOT, 'home-data.mjs'), 'utf8');
  const { preamble, blocks } = parseMjs(text);
  const wBlock = blocks.find((b) => b.name === 'welcome');
  const newText = rebuild(preamble, blocks, { welcome: wBlock.value });
  const reparsed = parseMjs(newText);
  const wAgain = reparsed.blocks.find((b) => b.name === 'welcome').value;
  const same = JSON.stringify(wAgain) === JSON.stringify(wBlock.value);
  assert(same, '③ welcome 块重建 round-trip 等价（保存→重载字段不变）',
    same ? '' : '字段漂移');
  const edited = JSON.parse(JSON.stringify(wBlock.value));
  edited.h2 = 'TEST EDIT';
  const newText2 = rebuild(preamble, blocks, { welcome: edited });
  const again2 = parseMjs(newText2).blocks.find((b) => b.name === 'welcome').value;
  assert(again2.h2 === 'TEST EDIT' && again2.eyebrow === wBlock.value.eyebrow, '③ welcome 块编辑后字段正确落盘');
} catch (e) { no('③ round-trip 失败', e.message); }

// ---------- ④ 零回归 ----------
try {
  const html = fs.readFileSync(INDEX, 'utf8');
  // HOME:HERO 标记仍完好（welcome 改动不波及 hero 区）
  assert(/<!--HOME:HERO:START-->/.test(html) && /<!--HOME:HERO:END-->/.test(html), '④ HOME:HERO 标记完好（不污染 hero 区）');
  // build-home.mjs 已改为引用 welcome-render.js 单一真源，本地不再重复定义 buildWelcome
  const bh = fs.readFileSync(path.join(ROOT, 'scripts', 'build-home.mjs'), 'utf8');
  assert(bh.includes("from '../admin/modules/welcome-render.js'"), '④ build-home.mjs 引用 welcome-render.js 单一真源');
  assert(!/export function buildWelcome/.test(bh), '④ build-home.mjs 不再本地定义 buildWelcome（避免双真源）');
  // 酒店数据不被污染（welcome 改动不波及）
  const hotelsText = fs.readFileSync(path.join(ROOT, 'hotels-data.mjs'), 'utf8');
  assert(!hotelsText.includes('export const welcome'), '④ hotels-data.mjs 不含 welcome 块（模块数据互不污染）');
} catch (e) { no('④ 零回归校验失败', e.message); }

console.log(`\n首页 Welcome 验证器：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
