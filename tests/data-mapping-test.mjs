// 酒店模块：后台(admin) ↔ 前台(frontend) 一一映射测试
// 重点：admin 保存路径 (mjs.js rebuild) 不得丢字段；前台构建输出须映射后台数据。
// 只查 bug，不新增功能。
import assert from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMjs, rebuild } from '../admin/mjs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'hotels-data.mjs');

let pass = 0, fail = 0, fails = [];
function ok(name) { pass++; console.log('  ✓', name); }
function bad(name, e) { fail++; fails.push(name + ' :: ' + (e && e.message)); console.log('  ✗', name, '\n     ', e && e.message); }

// ---------- 解析当前数据 ----------
const text0 = readFileSync(DATA, 'utf8');
const { preamble, blocks } = parseMjs(text0);
const hotelsB = blocks.find((b) => b.name === 'hotels');
const catsB = blocks.find((b) => b.name === 'hotelCategories');
assert(hotelsB && catsB, 'hotels / hotelCategories blocks must exist');
const hotels0 = JSON.parse(JSON.stringify(hotelsB.value));
const cats0 = JSON.parse(JSON.stringify(catsB.value));

// ================= 测试 A：无改动 round-trip 等价 =================
try {
  const rt = rebuild(preamble, blocks, { hotels: hotelsB.value, hotelCategories: catsB.value });
  const b2 = parseMjs(rt).blocks;
  const hotels1 = b2.find((b) => b.name === 'hotels').value;
  const cats1 = b2.find((b) => b.name === 'hotelCategories').value;
  assert.deepStrictEqual(hotels1, hotels0, 'round-trip 后 hotels 必须完全相等');
  assert.deepStrictEqual(cats1, cats0, 'round-trip 后 hotelCategories 必须完全相等');
  // 未被编辑的块应原样保留（preamble + 任何其它块）
  assert.ok(rt.includes(preamble.trim().slice(0, 30)), 'preamble 应原样保留');
  ok('A1 round-trip 等价（无改动，数据零丢失）');
} catch (e) { bad('A1 round-trip 等价（无改动）', e); }

// ================= 测试 B：编辑传播 + 不波及其它酒店 =================
try {
  const edited = JSON.parse(JSON.stringify(hotels0));
  edited.jimo.blurb = 'EDITED BLURB ' + Date.now();
  edited.jimo.detail.tagline = 'EDITED TAGLINE';
  edited.jimo.detail.rooms.push({ img: 'x', alt: 'a', name: 'New Room', nameZh: '', features: [] });
  const rt2 = rebuild(preamble, blocks, { hotels: edited });
  const hotels2 = parseMjs(rt2).blocks.find((b) => b.name === 'hotels').value;
  assert.strictEqual(hotels2.jimo.blurb, edited.jimo.blurb, 'blurb 编辑未传播');
  assert.strictEqual(hotels2.jimo.detail.tagline, 'EDITED TAGLINE', 'tagline 编辑未传播');
  assert.strictEqual(hotels2.jimo.detail.rooms.length, edited.jimo.detail.rooms.length, 'rooms 新增未传播');
  assert.strictEqual(hotels2.jimo.detail.rooms.at(-1).name, 'New Room', 'rooms 尾项内容错误');
  // 其它酒店必须完全不变
  for (const k of Object.keys(hotels0)) {
    if (k === 'jimo') continue;
    assert.deepStrictEqual(hotels2[k], hotels0[k], '酒店 ' + k + ' 被意外改动');
  }
  ok('B1 编辑传播 + 其它酒店零改动');
} catch (e) { bad('B1 编辑传播 + 不波及其它', e); }

// ================= 测试 B2：隐藏酒店(detail) round-trip 仍保留 hidden =================
try {
  const edited = JSON.parse(JSON.stringify(hotels0));
  edited.hetianye.hidden = true;
  const rt3 = rebuild(preamble, blocks, { hotels: edited });
  const hotels3 = parseMjs(rt3).blocks.find((b) => b.name === 'hotels').value;
  assert.strictEqual(hotels3.hetianye.hidden, true, 'hidden 标志保存后丢失');
  ok('B2 hidden 标志保存后仍保留');
} catch (e) { bad('B2 hidden 标志保留', e); }

// ================= 测试 C：前台构建输出映射后台数据 =================
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// C1 三级详情页：name / tagline / 每个 room.name 必须出现
for (const [k, h] of Object.entries(hotels0)) {
  if (!h.detail) continue;
  const fp = path.join(ROOT, 'hotels', k + '.html');
  if (!existsSync(fp)) { bad('C1 详情页存在 ' + k, new Error('hotels/' + k + '.html 未生成')); continue; }
  const html = readFileSync(fp, 'utf8');
  try {
    assert.ok(html.includes(h.name), '详情页 ' + k + ' 缺 name');
    if (h.detail.tagline) assert.ok(html.includes(h.detail.tagline), '详情页 ' + k + ' 缺 tagline');
    if (h.detail.intro) assert.ok(html.includes(escHtml(h.detail.intro).slice(0, 40)), '详情页 ' + k + ' 缺 intro 片段');
    for (const r of (h.detail.rooms || [])) assert.ok(html.includes(r.name), '详情页 ' + k + ' 缺房间 ' + r.name);
    for (const g of (h.detail.gallery || [])) {
      const img = typeof g === 'string' ? g : g.img;
      assert.ok(html.includes(img), '详情页 ' + k + ' 缺 gallery 图 ' + img);
    }
    ok('C1 详情页 ' + k + ' 映射 name/tagline/rooms/gallery');
  } catch (e) { bad('C1 详情页 ' + k, e); }
}
// C2 分类 hub 页：每张可见酒店卡含其 name
for (const cat of cats0) {
  if (cat.hidden) continue;
  const fp = path.join(ROOT, 'hotels', cat.slug + '.html');
  if (!existsSync(fp)) { bad('C2 hub 页存在 ' + cat.slug, new Error('hotels/' + cat.slug + '.html 未生成')); continue; }
  const html = readFileSync(fp, 'utf8');
  try {
    for (const id of (cat.hotels || [])) {
      const h = hotels0[id];
      if (!h || h.hidden) continue;
      assert.ok(html.includes(h.name), 'hub ' + cat.slug + ' 缺酒店 ' + id + ' (' + h.name + ')');
    }
    ok('C2 hub ' + cat.slug + ' 含全部可见酒店');
  } catch (e) { bad('C2 hub ' + cat.slug, e); }
}

// ================= 测试 D：隐藏酒店不应生成详情页（构建逻辑一致性） =================
// 当前数据无 hidden 酒店，这里验证生成循环对 hidden 的处理在逻辑上一致：
// 读取 build-hotels.mjs，确认 detail 生成循环包含对 h.hidden 的跳过。
try {
  const buildSrc = readFileSync(path.join(ROOT, 'scripts', 'build-hotels.mjs'), 'utf8');
  const loop = buildSrc.slice(buildSrc.indexOf('三级酒店详情页：凡'), buildSrc.indexOf('// expectedSlugs'));
  assert.ok(/if \(!h \|\| !h\.detail\) continue/.test(loop), 'detail 循环应跳过无 detail 酒店');
  assert.ok(/if \(cat && cat\.hidden\) continue/.test(loop), 'detail 循环应跳过隐藏分类');
  // 注意：若此处失败说明隐藏酒店仍生成详情页（映射不一致 bug）
  assert.ok(/if \(h\.hidden\) continue/.test(loop), 'detail 循环应跳过隐藏酒店 (h.hidden)');
  ok('D1 详情页生成对 h.hidden 有跳过（前后台一致）');
} catch (e) { bad('D1 隐藏酒店跳过', e); }

console.log(`\n=== 映射测试: ${pass} 通过, ${fail} 失败 ===`);
if (fail) { console.log('FAILS:\n' + fails.map((f) => ' - ' + f).join('\n')); process.exit(1); }
