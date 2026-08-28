// hotels-imglib-delete-loop.mjs —— 酒店图库「删除前引用检查」闭环验证。
//
// 背景：旧实现 findReferences 只扫 h.img 一个字段，漏掉 cardImg / heroImg / gallery[].img /
// rooms[].img / detail.*.img，导致删除被这些字段引用的图不会被拦截 → 前台破图。
// 现抽到 admin/modules/hotel-refs.js 的 findHotelImageReferences（递归扫全部图片字段），
// 本 loop 用纯 Node 单测验证覆盖度 + 误判防护，与 spot-refs 测试同构。

import { findHotelImageReferences } from '../admin/modules/hotel-refs.js';

const results = [];
function assert(cond, msg) { results.push({ ok: !!cond, msg }); }

// 一个覆盖全部图片字段的酒店 fixture（外加若干纯文本字段做误判防护）
const hotels = {
  jimo: {
    zh: '季默酒店', name: 'Jimo',
    img: 'hotel-jimo-hero',                  // 顶层主图
    cardImg: 'hotel-jimo-card',              // 卡片图
    heroImg: 'hotel-jimo-heroimg',           // hero 图
    heroAlt: 'this is alt, not image',       // 纯文本：绝不能被当成图片
    cardAlt: 'alt text',                     // 纯文本
    galleryTitle: '画廊标题',                 // 纯文本
    description: 'hotel-jimo-hero',           // 文本字段恰好含图片名：key 非 img，不应误判
    gallery: [
      { img: 'hotel-jimo-g1', alt: 'a' },
      { img: 'hotel-jimo-g2', alt: 'b' },
    ],
    rooms: [
      { img: 'hotel-jimo-r1' },
      { img: 'hotel-jimo-r2' },
    ],
    detail: {
      rooms: [
        { img: 'hotel-jimo-dr1' },
        { img: 'hotel-jimo-dr2' },
      ],
      gallery: [
        { img: 'hotel-jimo-dg1', alt: 'a' },
      ],
      faqs: [{ q: '问题', a: '答案' }],
    },
  },
};
const categories = [
  { title: '山居', slug: 'mountain-lodges', heroImg: 'hotel-jimo-heroimg' }, // 复用 jimo 的 heroImg
  { title: '经济', slug: 'value', heroImg: 'other-hero' },
];

console.log('━━━ hotels-imglib-delete-loop ━━━');

// 1) 每种图片字段的引用都被检出（删除应被拦截）
const blocked = [
  ['顶层 img', 'hotel-jimo-hero'],
  ['cardImg', 'hotel-jimo-card'],
  ['heroImg', 'hotel-jimo-heroimg'],
  ['gallery[0].img', 'hotel-jimo-g1'],
  ['gallery[1].img', 'hotel-jimo-g2'],
  ['rooms[0].img', 'hotel-jimo-r1'],
  ['rooms[1].img', 'hotel-jimo-r2'],
  ['detail.rooms[0].img', 'hotel-jimo-dr1'],
  ['detail.rooms[1].img', 'hotel-jimo-dr2'],
  ['detail.gallery[0].img', 'hotel-jimo-dg1'],
];
for (const [field, name] of blocked) {
  const refs = findHotelImageReferences(hotels, categories, name);
  assert(refs.length >= 1, `被 ${field}（${name}）引用的图删除前应被拦截（命中 ${refs.length} 处：${refs.join('、')}）`);
}

// 2) 分类 heroImg 复用也能检出
const catRefs = findHotelImageReferences(hotels, categories, 'hotel-jimo-heroimg');
assert(catRefs.some((r) => r.includes('分类')), `分类 heroImg 复用应被检出（${catRefs.join('、')}）`);

// 3) 未被引用的图：删除应被放行（refs 为空）
const free = findHotelImageReferences(hotels, categories, 'hotel-jimo-not-used');
assert(free.length === 0, `未引用的图（hotel-jimo-not-used）删除前应放行（refs=${free.length}）`);

// 4) 扩展名归一化：'x.webp' 与 'x' 视为同一张图
const extRefs = findHotelImageReferences(hotels, categories, 'hotel-jimo-card.webp');
assert(extRefs.length >= 1, `扩展名归一化：cardImg('hotel-jimo-card') 应匹配入参 'hotel-jimo-card.webp'（命中 ${extRefs.length}）`);

// 5) 误判防护：纯文本字段（heroAlt / cardAlt / galleryTitle / 含图片名的 description）不得被当成图片
const falsePositive = findHotelImageReferences(hotels, categories, 'hotel-jimo-hero'); // 仅顶层 img 命中，不应有文本字段
assert(!falsePositive.some((r) => r.includes('description')), '文本字段 description 含图片名不应被误判为图片引用');
const altRefs = findHotelImageReferences(hotels, categories, 'this is alt, not image');
assert(altRefs.length === 0, `纯文本 heroAlt 值不应被当成图片（refs=${altRefs.length}）`);
const titleRefs = findHotelImageReferences(hotels, categories, '画廊标题');
assert(titleRefs.length === 0, `纯文本 galleryTitle 不应被当成图片（refs=${titleRefs.length}）`);

// 6) 边界：空/非对象输入不抛错
assert(Array.isArray(findHotelImageReferences(null, null, 'x')), 'null 输入返回数组不抛错');
assert(Array.isArray(findHotelImageReferences({}, [], '')), '空输入返回数组不抛错');

let pass = 0, fail = 0;
for (const r of results) {
  if (r.ok) { pass++; console.log(`  ✓ ${r.msg}`); }
  else { fail++; console.log(`  ✗ ${r.msg}`); }
}
console.log(`━━━ ${pass}/${pass + fail} passed ━━━`);
process.exit(fail ? 1 : 0);
