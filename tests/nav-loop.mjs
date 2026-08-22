// 顶部导航 Nav 模块验证器（Loop Engineering verifier）
// ① 前端映射零回归：buildSiteNavMega/Mobile(siteNav) === index.html 当前 HOME:NAV 标记内容
// ② hidden 跳过：被隐藏的一级项不在生成结果中、且不留死链
// ③ Hotels 输出 HOTEL-NAV 占位（交由 buildIndexNav 填充）
// ④ Contact（# 开头 url）输出按钮
// ⑤ round-trip：home-data.mjs 的 siteNav 块重建后 parse 等价
// ⑥ 零回归：build-home.mjs 引用 nav-render.js 单一真源；build-hotels.mjs 已把 siteNav 传入 applyHome
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSiteNavMega, buildSiteNavMobile, applyNav } from '../admin/modules/nav-render.js';
import { parseMjs, rebuild } from '../admin/mjs.js';
import { siteNav as siteNavData } from '../home-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const BUILD_HOME = path.join(ROOT, 'scripts', 'build-home.mjs');
const BUILD_HOTELS = path.join(ROOT, 'scripts', 'build-hotels.mjs');

let pass = 0, fail = 0;
const ok = (name) => { pass++; console.log('  ✓ ' + name); };
const no = (name, extra = '') => { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); };
function assert(cond, name, extra) { cond ? ok(name) : no(name, extra); }

// ---------- ① 前端映射零回归 ----------
// 注意：HOME:NAV 内嵌的 HOTEL-NAV 子区由 applyIndexNav（build-hotels 后处理）填充酒店二级菜单，
// 与 buildSiteNavMega 输出的空占位不同。比对前先把 HOTEL-NAV 子区归一化为空占位，
// 以隔离验证「导航骨架 == buildSiteNavMega/Mobile 输出」这一单一真源关系。
const stripHotelNav = (s) => s
  .replace(/<!--HOTEL-NAV:MEGA:START-->[\s\S]*?<!--HOTEL-NAV:MEGA:END-->/, '<!--HOTEL-NAV:MEGA:START-->\n          <!--HOTEL-NAV:MEGA:END-->')
  .replace(/<!--HOTEL-NAV:MOBILE:START-->[\s\S]*?<!--HOTEL-NAV:MOBILE:END-->/, '<!--HOTEL-NAV:MOBILE:START-->\n      <!--HOTEL-NAV:MOBILE:END-->');
try {
  const html = fs.readFileSync(INDEX, 'utf8');
  const mMega = html.match(/<!--HOME:NAV:MEGA:START-->([\s\S]*?)<!--HOME:NAV:MEGA:END-->/);
  const mMob = html.match(/<!--HOME:NAV:MOBILE:START-->([\s\S]*?)<!--HOME:NAV:MOBILE:END-->/);
  if (!mMega) no('index.html 含 HOME:NAV:MEGA 标记');
  else assert(stripHotelNav(mMega[1]).trim() === buildSiteNavMega(siteNavData).trim(), '① MEGA 前端映射零回归（导航骨架 == buildSiteNavMega，HOTEL-NAV 子区除外）');
  if (!mMob) no('index.html 含 HOME:NAV:MOBILE 标记');
  else assert(stripHotelNav(mMob[1]).trim() === buildSiteNavMobile(siteNavData).trim(), '① MOBILE 前端映射零回归（导航骨架 == buildSiteNavMobile，HOTEL-NAV 子区除外）');
  // 正向：HOTEL-NAV 子区确实被 applyIndexNav 填充（非空）
  assert(/<!--HOTEL-NAV:MEGA:START-->[\s\S]*?\S[\s\S]*?<!--HOTEL-NAV:MEGA:END-->/.test(html), '① HOTEL-NAV:MEGA 子区已被 buildIndexNav 填充（非空）');
} catch (e) { no('① 读取 index.html 失败', e.message); }

// applyNav 不破坏标记，且能正确重写
try {
  const html = fs.readFileSync(INDEX, 'utf8');
  const out = applyNav(html, siteNavData);
  assert(/<!--HOME:NAV:MEGA:START-->/.test(out) && /<!--HOME:NAV:MEGA:END-->/.test(out), '① applyNav 保留 HOME:NAV:MEGA 标记');
  assert(/<!--HOME:NAV:MOBILE:START-->/.test(out) && /<!--HOME:NAV:MOBILE:END-->/.test(out), '① applyNav 保留 HOME:NAV:MOBILE 标记');
} catch (e) { no('① applyNav 失败', e.message); }

// ---------- ② hidden 跳过 / 无死链 ----------
try {
  const mega = buildSiteNavMega(siteNavData);
  const mob = buildSiteNavMobile(siteNavData);
  const all = mega + '\n' + mob;
  // siteNav 中 Attractions / Tours 默认 hidden:true → 不应出现在生成结果
  const hiddenLabels = siteNavData.items.filter((it) => it.hidden).map((it) => it.label);
  let leak = hiddenLabels.filter((l) => l && all.includes('>' + l + '<'));
  assert(leak.length === 0, '② 隐藏的一级项不出现在生成导航（无泄漏）', '泄漏: ' + JSON.stringify(leak));
  // 不得出现死锚点 #tour-*
  assert(!/#tour-/.test(all), '② 生成导航不含死锚点 #tour-*');
} catch (e) { no('② hidden 校验失败', e.message); }

// ---------- ③ Hotels 占位 ----------
try {
  const mega = buildSiteNavMega(siteNavData);
  const mob = buildSiteNavMobile(siteNavData);
  assert(/<!--HOTEL-NAV:MEGA:START-->/.test(mega) && /<!--HOTEL-NAV:MEGA:END-->/.test(mega), '③ MEGA 中 Hotels 输出 HOTEL-NAV:MEGA 占位');
  assert(/<!--HOTEL-NAV:MOBILE:START-->/.test(mob) && /<!--HOTEL-NAV:MOBILE:END-->/.test(mob), '③ MOBILE 中 Hotels 输出 HOTEL-NAV:MOBILE 占位');
} catch (e) { no('③ Hotels 占位校验失败', e.message); }

// ---------- ④ Contact 按钮 ----------
try {
  const mega = buildSiteNavMega(siteNavData);
  assert(/openContactModal\(event\)/.test(mega), '④ MEGA 中 Contact（# 开头 url）渲染为 openContactModal 按钮');
} catch (e) { no('④ Contact 按钮校验失败', e.message); }

// ---------- ⑤ round-trip ----------
try {
  const text = fs.readFileSync(path.join(ROOT, 'home-data.mjs'), 'utf8');
  const { preamble, blocks } = parseMjs(text);
  const navBlock = blocks.find((b) => b.name === 'siteNav');
  const newText = rebuild(preamble, blocks, { siteNav: navBlock.value });
  const reparsed = parseMjs(newText);
  const navAgain = reparsed.blocks.find((b) => b.name === 'siteNav').value;
  const same = JSON.stringify(navAgain) === JSON.stringify(navBlock.value);
  assert(same, '⑤ siteNav 块重建 round-trip 等价（保存→重载字段不变）', same ? '' : '字段漂移');
  const edited = JSON.parse(JSON.stringify(navBlock.value));
  edited.items[0].label = 'TEST EDIT';
  const newText2 = rebuild(preamble, blocks, { siteNav: edited });
  const again2 = parseMjs(newText2).blocks.find((b) => b.name === 'siteNav').value;
  assert(again2.items[0].label === 'TEST EDIT' && again2.items.length === navBlock.value.items.length, '⑤ siteNav 块编辑后字段正确落盘');
} catch (e) { no('⑤ round-trip 失败', e.message); }

// ---------- ⑥ 零回归 / build 串联 ----------
try {
  const bh = fs.readFileSync(BUILD_HOME, 'utf8');
  assert(bh.includes("from '../admin/modules/nav-render.js'"), '⑥ build-home.mjs 引用 nav-render.js 单一真源');
  assert(!/export function buildSiteNavMega/.test(bh), '⑥ build-home.mjs 不再本地定义 nav 函数（避免双真源）');
  const bhot = fs.readFileSync(BUILD_HOTELS, 'utf8');
  assert(bhot.includes('siteNav') && /applyHome\([^)]*siteNav/.test(bhot), '⑥ build-hotels.mjs 已将 siteNav 传入 applyHome（nav 真正数据驱动）');
  // 生成的 index.html 确实存在 HOTEL-NAV 占位（证明 applyNav 在构建中生效）
  const html = fs.readFileSync(INDEX, 'utf8');
  assert(/<!--HOME:NAV:MEGA:START-->[\s\S]*?<!--HOTEL-NAV:MEGA:START-->/.test(html), '⑥ 构建产物 index.html 的 HOME:NAV 已含 HOTEL-NAV 占位（applyNav 已生效）');
} catch (e) { no('⑥ 零回归/串联校验失败', e.message); }

console.log(`\n顶部导航 Nav 验证器：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
