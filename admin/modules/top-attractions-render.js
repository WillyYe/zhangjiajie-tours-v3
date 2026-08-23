// 共享纯函数（无 Node / 浏览器全局依赖）→ 单一真源
// 同时被 scripts/build-top-attractions.mjs（构建）与 admin/modules/top-attractions.js（后台预览）import。
// 因此后台“所见”与线上“所得”永远一致，杜绝前后台漂移。
// 注意：本文件不得 import fs / path / 任何浏览器全局，否则浏览器端会崩溃、Node 端也会报错。

const imgName = (n) => (/\.(webp|jpg|jpeg|avif|png)$/i.test(n) ? n : n + '.webp');
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 角标颜色：运营只选关键字，不写裸类名（与 index.html 现有 class 完全一致）
export const BADGE = {
  forest: 'bg-forest/90',
  emerald: 'bg-emerald-600/90',
  gold: 'bg-gold/90',
  blue: 'bg-blue-600/90',
  red: 'bg-red-600/90',
  orange: 'bg-orange-500/90',
  purple: 'bg-purple-700/90',
};

function cardHtml(it, i) {
  const slug = it.slug;
  const badgeClass = BADGE[it.badgeColor] || BADGE.forest;
  return `        <!-- ${i + 1}. ${it.title} -->
        <a id="attraction-${slug}" href="attractions/${slug}.html" class="card-hover bg-white rounded-2xl overflow-hidden shadow-sm fade-in block group">
          <div class="relative h-52 overflow-hidden">
            <img width="${it.imgW}" height="${it.imgH}" loading="lazy" decoding="async" src="images/top-attractions/${imgName(it.img)}" alt="${escAttr(it.imgAlt)}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">
            <div class="absolute top-3 left-3 ${badgeClass} text-white text-xs font-medium px-2.5 py-1 rounded-full">${escHtml(it.badge)}</div>
          </div>
          <div class="p-5">
            <h3 class="font-display text-xl text-forest mb-2 group-hover:text-gold-dark transition-colors">${escHtml(it.title)}</h3>
            <p class="text-stone-500 text-sm leading-relaxed">${escHtml(it.desc)}</p>
          </div>
        </a>`;
}

// 纯函数：由 topAttractions 数据生成卡片网格（含 grid 容器）。
// hidden 项被跳过（不渲染、不产生死链）。缩进与 index.html 原硬编码一致 → 零回归。
export function buildTopAttractionsHtml(data) {
  const items = (data && data.items) || [];
  const vis = items.filter((it) => !it.hidden);
  const cards = vis.map((it, i) => cardHtml(it, i)).join('\n\n');
  return `      <div class="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">\n\n${cards}\n\n      </div>`;
}

// 按 TOP-ATTRACTION:GRID 标记重写 index.html
export function applyTopAttractions(html, data) {
  const block = buildTopAttractionsHtml(data);
  return html.replace(
    /<!--TOP-ATTRACTION:GRID:START-->[\s\S]*?<!--TOP-ATTRACTION:GRID:END-->/,
    `<!--TOP-ATTRACTION:GRID:START-->\n${block}\n      <!--TOP-ATTRACTION:GRID:END-->`
  );
}

// 列出所有可见卡片引用的图片（images/top-attractions/<img>.webp），供保存前校验
export function listTopAttractionImages(data) {
  const items = (data && data.items) || [];
  return items.filter((it) => !it.hidden).map((it) => `images/top-attractions/${imgName(it.img)}`);
}

// 列出所有可见卡片的详情页链接（attractions/<slug>.html），供无死链校验
export function listTopAttractionLinks(data) {
  const items = (data && data.items) || [];
  return items.filter((it) => !it.hidden).map((it) => `attractions/${it.slug}.html`);
}
