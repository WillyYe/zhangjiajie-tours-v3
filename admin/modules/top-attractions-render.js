// 共享纯函数（无 Node / 浏览器全局依赖）→ 单一真源
// 同时被 scripts/build-top-attractions.mjs（构建）与 admin/modules/top-attractions.js（后台预览）import。
// 因此后台“所见”与线上“所得”永远一致，杜绝前后台漂移。
// 注意：本文件不得 import fs / path / 任何浏览器全局，否则浏览器端会崩溃、Node 端也会报错。

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 单行：# / Spot / Highlight / Time / Vibe
function rowHtml(it, i) {
  const rank = it.rank != null ? it.rank : (i + 1);
  return `              <tr id="spot-${escAttr(it.slug || '')}"><td class="font-bold text-gold-dark">${escHtml(String(rank))}</td><td class="font-semibold text-forest">${escHtml(it.spot || '')}</td><td>${escHtml(it.highlight || '')}</td><td>${escHtml(it.time || '')}</td><td>${escHtml(it.vibe || '')}</td></tr>`;
}

// 纯函数：由 topAttractions 数据生成「Top 8 Must-See Spots」文字表格（含标题 + overflow 包装）。
// hidden 项被跳过（不渲染）。缩进与 index.html 原硬编码一致 → 零回归。
export function buildTopAttractionsHtml(data) {
  const items = (data && data.items) || [];
  const vis = items.filter((it) => !it.hidden);
  const rows = vis.map((it, i) => rowHtml(it, i)).join('\n');
  const eyebrow = (data && data.eyebrow) || '';
  const title = (data && data.title) || '';
  const subtitle = (data && data.subtitle) || '';
  return `      <div class="text-center mb-12 fade-in">
        <p class="text-gold-dark text-sm font-medium tracking-[0.2em] uppercase mb-4">${escHtml(eyebrow)}</p>
        <h2 class="font-display text-4xl md:text-5xl text-forest mb-6">${escHtml(title)}</h2>
        <p class="text-stone-600 text-lg max-w-2xl mx-auto">${escHtml(subtitle)}</p>
      </div>
      <div class="overflow-x-auto fade-in">
        <table class="compare-table rounded-xl overflow-hidden shadow-sm">
          <thead><tr><th>#</th><th>Spot</th><th>Highlight</th><th>Time</th><th>Vibe</th></tr></thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>`;
}

// 按 TOP-8-TABLE 标记重写 index.html
export function applyTopAttractions(html, data) {
  const block = buildTopAttractionsHtml(data);
  return html.replace(
    /<!--TOP-8-TABLE:START-->[\s\S]*?<!--TOP-8-TABLE:END-->/,
    `<!--TOP-8-TABLE:START-->\n${block}\n      <!--TOP-8-TABLE:END-->`
  );
}

// 表格无图片（纯文字），返回空数组（供保存前校验，无图可校验）
export function listTopAttractionImages(data) {
  return [];
}

// 表格无详情页链接（纯文字），返回空数组（供无死链校验）
export function listTopAttractionLinks(data) {
  return [];
}
