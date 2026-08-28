// hotel-refs.js — 酒店图片引用检查的纯数据层（零浏览器依赖，可在 Node 单测）
//
// 与 spot-refs.js 同构：把"删除前的引用检查"抽成纯函数，供 admin/modules/hotels.js 的图库删除保护
// 调用，并在 Node 下直接单测（tests/hotels-imglib-delete-loop.mjs）。
//
// 旧实现只扫 h.img 一个字段，漏掉 cardImg / heroImg / gallery[].img / rooms[].img / detail.*.img，
// 删除被这些字段引用的图不会被拦截 → 前台破图。改为递归扫描全部图片字段。

const IMG_EXT_RE = /\.(webp|jpg|jpeg|avif|png)$/i;
export function normImgName(s) {
  return String(s == null ? '' : s).replace(IMG_EXT_RE, '');
}

// 递归收集某节点（含嵌套 rooms / detail.gallery / detail.rooms）内的所有图片字段 { field, value }。
// 图片字段判定：key 为 'img' 或以 'Img' 结尾（cardImg / heroImg / …）；
// 这样 gallery[].img / rooms[].img / detail.rooms[].img / detail.gallery[].img 自动被纳入，
// 而 heroAlt / cardAlt / galleryTitle 等纯文本字段（不以 img 结尾）不会被误判为图片。
function collectHotelImageNames(node, acc, prefix) {
  if (Array.isArray(node)) {
    node.forEach((it, i) => collectHotelImageNames(it, acc, prefix ? `${prefix}[${i}]` : `[${i}]`));
    return;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if ((k === 'img' || k.toLowerCase().endsWith('img')) && typeof v === 'string' && v) {
        acc.push({ field: path, value: v });
      } else if (v && typeof v === 'object') {
        collectHotelImageNames(v, acc, path);
      }
    }
  }
}

// 纯函数：查找 name 被哪些酒店 / 分类引用（删除保护的主防线）。
// 返回示例：['季默酒店（cardImg）', '季默酒店（rooms[0].img）', '分类「山居」hero']
export function findHotelImageReferences(hotels, categories, name) {
  const target = normImgName(name);
  if (!target) return [];
  const refs = [];
  for (const [k, h] of Object.entries(hotels || {})) {
    if (!h || typeof h !== 'object') continue;
    const found = [];
    collectHotelImageNames(h, found);
    for (const hit of found.filter((f) => normImgName(f.value) === target)) {
      refs.push(`${h.zh || h.name || k}（${hit.field}）`);
    }
  }
  // 分类 heroImg 也可能复用某酒店主图，删除会破前台分类页
  for (const c of categories || []) {
    if (c && c.heroImg && normImgName(c.heroImg) === target) {
      refs.push(`分类「${c.title || c.slug}」hero`);
    }
  }
  return refs;
}
