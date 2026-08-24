// 首页 Tour Packages 三卡模块验证器（Loop Engineering verifier）
// ① 前端映射零回归：buildHomeTourCardsHtml(data) === index.html 当前 HOME-TOUR-CARDS 标记内容
// ② 纯文字无图：本模块不放图、不引 images/，与图片库隔离无关（根本无图）
// ③ round-trip：home-data.mjs 的 homeTourCards 块重建后 parse 等价 + 编辑传播
// ④ 卡片数 + hidden 生效 + 锚点：可见卡 3 张；hidden 不渲染；tour-<id>-card 锚点齐全
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildHomeTourCardsHtml, applyHomeTourCards } from '../admin/modules/home-tour-cards-render.js';
import { parseMjs, rebuild } from '../admin/mjs.js';
import { homeTourCards as htData } from '../home-data.mjs';

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
  const m = html.match(/<!--HOME-TOUR-CARDS:START-->([\s\S]*?)<!--HOME-TOUR-CARDS:END-->/);
  if (!m) { no('index.html 含 HOME-TOUR-CARDS 标记'); }
  else {
    const current = m[1].trim();
    const generated = buildHomeTourCardsHtml(htData).trim();
    assert(current === generated, '① Tour 卡前端映射零回归（build === 当前标记内容）',
      current === generated ? '' : '生成与线上不一致');
  }
} catch (e) { no('① 读取 index.html 失败', e.message); }

// applyHomeTourCards 不破坏标记，且能正确重写
try {
  const html = fs.readFileSync(INDEX, 'utf8');
  const out = applyHomeTourCards(html, htData);
  const gm = out.match(/<!--HOME-TOUR-CARDS:START-->([\s\S]*?)<!--HOME-TOUR-CARDS:END-->/);
  assert(/<!--HOME-TOUR-CARDS:START-->/.test(out) && /<!--HOME-TOUR-CARDS:END-->/.test(out), '① applyHomeTourCards 保留标记');
  assert(gm && /id="tour-day"/.test(gm[1]), '① 标记内渲染 #tour-day 子区块');
  assert(gm && (gm[1].match(/id="tour-(day|private|vip)-card"/g) || []).length === 3, '① 标记内渲染 3 张卡片');
} catch (e) { no('① applyHomeTourCards 失败', e.message); }

// ---------- ② 纯文字无图 ----------
try {
  const gen = buildHomeTourCardsHtml(htData);
  assert(!/images\//.test(gen), '② 生成不含任何 images/ 路径（纯文字卡，无图库依赖）');
  assert(!/<img/.test(gen), '② 生成不含 <img>（纯文字卡）');
} catch (e) { no('② 无图校验失败', e.message); }

// ---------- ③ round-trip ----------
try {
  const text = fs.readFileSync(path.join(ROOT, 'home-data.mjs'), 'utf8');
  const { preamble, blocks } = parseMjs(text);
  const htBlock = blocks.find((b) => b.name === 'homeTourCards');
  const newText = rebuild(preamble, blocks, { homeTourCards: htBlock.value });
  const reparsed = parseMjs(newText);
  const htAgain = reparsed.blocks.find((b) => b.name === 'homeTourCards').value;
  const same = JSON.stringify(htAgain) === JSON.stringify(htBlock.value);
  assert(same, '③ homeTourCards 块重建 round-trip 等价（保存→重载字段不变）', same ? '' : '字段漂移');
  const edited = JSON.parse(JSON.stringify(htBlock.value));
  edited.title = 'TEST EDIT TITLE';
  edited.cards[0].price = 'From $999/person';
  const newText2 = rebuild(preamble, blocks, { homeTourCards: edited });
  const again2 = parseMjs(newText2).blocks.find((b) => b.name === 'homeTourCards').value;
  assert(again2.title === 'TEST EDIT TITLE' && again2.cards[0].price === 'From $999/person' && again2.cards.length === htBlock.value.cards.length, '③ 编辑后字段正确落盘（不波及其它块）');
} catch (e) { no('③ round-trip 失败', e.message); }

// ---------- ④ 卡片数 + hidden 生效 + 锚点 ----------
try {
  const gen = buildHomeTourCardsHtml(htData);
  const cardCount = (gen.match(/id="tour-(day|private|vip)-card"/g) || []).length;
  const visCount = htData.cards.filter((c) => !c.hidden).length;
  assert(cardCount === visCount, '④ 卡片数 == 可见 cards 数（hidden 不渲染）', `cards=${cardCount} vis=${visCount}`);
  // 锚点齐全（被导航与 module-index 共享卡片引用）
  for (const id of ['day', 'private', 'vip']) {
    assert(gen.includes('id="tour-' + id + '-card"'), `④ 锚点 tour-${id}-card 存在`);
  }
  // 价格 $数字 包 gold
  assert(/<span class="text-gold">\$129<\/span>/.test(gen), '④ 价格 $数字 包 gold（与线上一致）');
  // popular 高亮环
  assert(gen.includes('tour-private-card" class="bg-white rounded-2xl p-8 shadow-sm card-hover fade-in ring-2 ring-gold/30"'), '④ popular 卡加 ring-2 ring-gold/30 高亮环');
  // hidden 不渲染
  const oneHidden = JSON.parse(JSON.stringify(htData));
  oneHidden.cards[0].hidden = true;
  const outHtml = applyHomeTourCards(fs.readFileSync(INDEX, 'utf8'), oneHidden);
  const m = outHtml.match(/<!--HOME-TOUR-CARDS:START-->([\s\S]*?)<!--HOME-TOUR-CARDS:END-->/);
  assert(!m[1].includes('id="tour-day-card"'), '④ hidden 卡不渲染前台');
} catch (e) { no('④ 卡片数/hidden/锚点校验失败', e.message); }

console.log(`\n首页 Tour 卡 验证器：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
