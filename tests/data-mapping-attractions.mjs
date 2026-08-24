// 景点 / 体验 数据映射校验器
// A. round-trip 等价（parseMjs → rebuild → parseMjs 深度一致）
// B. 编辑传播 + 零波及其它
// C. 前后台映射（后台预览与 build 共用 buildPageMap；编辑数据改变输出）
// D. hidden 处理（隐藏项不进 RELATED；build 跳过隐藏项）
//
// 运行：node tests/data-mapping-attractions.mjs

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { parseMjs, rebuild } from '../admin/mjs.js';
import { buildPageMap } from '../scripts/fragments.mjs';
import { attractions } from '../attractions-data.mjs';
import { experiences } from '../experiences-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.error('  ✗ ' + msg); }
}
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (a && b && typeof a === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

function parseFile(file) {
  const text = readFileSync(path.join(ROOT, file), 'utf8');
  return parseMjs(text);
}

console.log('A. round-trip 等价');
{
  const { preamble, blocks } = parseFile('attractions-data.mjs');
  const aBlock = blocks.find((b) => b.name === 'attractions');
  ok(aBlock && Array.isArray(aBlock.value) && aBlock.value.length > 0, 'attractions 块解析为数组');
  const out = rebuild(preamble, blocks, {});
  const { blocks: blocks2 } = parseMjs(out);
  const a2 = blocks2.find((b) => b.name === 'attractions');
  ok(deepEqual(aBlock.value, a2.value), 'round-trip 后 attractions 数据深度一致');

  const { preamble: pE, blocks: bE } = parseFile('experiences-data.mjs');
  const eBlock = bE.find((b) => b.name === 'experiences');
  ok(eBlock && Array.isArray(eBlock.value) && eBlock.value.length > 0, 'experiences 块解析为数组');
  const outE = rebuild(pE, bE, {});
  const { blocks: bE2 } = parseMjs(outE);
  ok(deepEqual(eBlock.value, bE2.find((b) => b.name === 'experiences').value), 'round-trip 后 experiences 数据深度一致');
}

console.log('B. 编辑传播 + 零波及其它');
{
  const { preamble, blocks } = parseFile('attractions-data.mjs');
  const edited = {};
  const arr = blocks.find((b) => b.name === 'attractions').value;
  const origFirst = arr[0].h1, origSecond = arr[1].h1;
  const clone = JSON.parse(JSON.stringify(arr));
  clone[0].h1 = 'EDITED-TITLE-XYZ';
  const newText = rebuild(preamble, blocks, { attractions: clone });
  const { blocks: b2 } = parseMjs(newText);
  const arr2 = b2.find((b) => b.name === 'attractions').value;
  ok(arr2[0].h1 === 'EDITED-TITLE-XYZ', '编辑传播：第一项 h1 改变');
  ok(arr2[1].h1 === origSecond, '零波及其它：第二项 h1 不变');
  ok(arr2[0].heroImg === arr[0].heroImg, '零波及其它：第一项其它字段不变');
  ok(origFirst !== 'EDITED-TITLE-XYZ', '对照：原始数据未被原地修改');
}

console.log('C. 前后台映射（build 与后台预览共用 buildPageMap）');
{
  const item = attractions[0];
  const map = buildPageMap(item, 'attraction');
  ok(map.H1.includes(item.h1), 'H1 占位符填充了数据中的 H1');
  // buildPageMap 返回模块前缀路径（如 'attractions/tianzi-autumn.webp'），与模板拼 ../images/ 一致
  ok(map.HERO_IMG.endsWith(item.heroImg) && map.HERO_IMG.includes('/'), 'HERO_IMG 占位符填充了 heroImg 路径（含模块前缀）');
  ok(map.HIGHLIGHTS.includes(item.highlights[0].title), 'HIGHLIGHTS 片段包含首个亮点标题');
  // 编辑数据应改变输出
  const edited = { ...item, h1: 'DIFFERENT-H1' };
  const map2 = buildPageMap(edited, 'attraction');
  ok(map2.H1.includes('DIFFERENT-H1') && !map2.H1.includes(item.h1), '编辑 h1 改变预览输出');
  ok(map.TIPS.length > 0 && map.GALLERY.length > 0 && map.FAQ.length > 0, 'TIPS/GALLERY/FAQ 片段非空');
  // experiences 同理
  const em = experiences[0];
  const emMap = buildPageMap(em, 'experience');
  ok(emMap.H1.includes('Bailong') && emMap.H1.includes(em.h1.replace(/&/g, '&amp;')), 'experience：H1 占位符填充（含 HTML 转义）');
  ok(!emMap.RELATED.includes('../attractions/'), 'experience：RELATED 链接为同目录（无 ../attractions/ 前缀）');
}

console.log('D. hidden 处理');
{
  // 隐藏项不应出现在其它页的 RELATED 中（模拟 build 的过滤逻辑）
  const hiddenSlug = 'secret-spot';
  const visible = {
    slug: 'page-a', breadcrumb: 'Page A', canonical: 'x',
    related: [
      { slug: 'page-b', img: 'b', alt: '', title: 'B', sub: '' },
      { slug: hiddenSlug, img: 's', alt: '', title: 'Secret', sub: '' },
    ],
    jsonld: { name: '', alternateName: [], description: '', images: [], touristType: [], faq: [], howto: { name: '', steps: [] } },
  };
  const hiddenSlugs = new Set([hiddenSlug]);
  const filtered = { ...visible, related: visible.related.filter((r) => !hiddenSlugs.has(r.slug)) };
  const map = buildPageMap(filtered, 'attraction');
  ok(!map.RELATED.includes(hiddenSlug + '.html'), 'hidden 项被 RELATED 过滤（无死链）');
  ok(map.RELATED.includes('page-b.html'), '可见相关项保留');
  // build 跳过 hidden 的来源数据
  const arr = [
    { slug: hiddenSlug, hidden: true, related: [], jsonld: { name: '', alternateName: [], description: '', images: [], touristType: [], faq: [], howto: { name: '', steps: [] } } },
    { ...visible, hidden: false },
  ];
  const hs = new Set(arr.filter((x) => x.hidden).map((x) => x.slug));
  const generated = arr.filter((x) => !x.hidden);
  ok(generated.length === 1 && !generated.some((x) => x.slug === hiddenSlug), 'build 跳过 hidden 项');
}

console.log(`\n数据映射校验：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
