// 共享纯函数（无 Node / 浏览器全局依赖）→ 单一真源
// 同时被 scripts/build-top-attractions.mjs（构建）与 admin/modules/top-attractions.js（后台预览）import。
// 因此后台“所见”与线上“所得”永远一致，杜绝前后台漂移。
// 注意：本文件不得 import fs / path / 任何浏览器全局，否则浏览器端会崩溃、Node 端也会报错。

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function tableRowHtml(it, idx) {
  const rank = idx + 1;
  return `          <tr id="attraction-${it.slug}" class="bg-white even:bg-stone-50 hover:bg-stone-100 transition-colors">
            <td class="py-4 px-5 text-stone-500 font-display font-semibold w-12">${rank}</td>
            <td class="py-4 px-5">
              <a href="attractions/${it.slug}.html" class="font-display text-lg text-forest hover:text-gold-dark transition-colors">${escHtml(it.title)}</a>
            </td>
            <td class="py-4 px-5 text-stone-600">${escHtml(it.highlight)}</td>
            <td class="py-4 px-5 text-stone-600 whitespace-nowrap">${escHtml(it.time)}</td>
            <td class="py-4 px-5 text-stone-600"><span class="mr-2">${escHtml(it.vibeEmoji || '')}</span>${escHtml(it.vibe)}</td>
          </tr>`;
}

// 纯函数：由 topAttractions 数据生成完整「Top 8 Must-See Spots」区块（标题 + 表格）。
// hidden 项被跳过（不渲染、不产生死链）。缩进与 index.html 原硬编码一致 → 零回归。
export function buildTopAttractionsHtml(data) {
  const d = data || {};
  const items = (d.items || []).filter((it) => !it.hidden);
  const rows = items.map((it, i) => tableRowHtml(it, i)).join('\n');
  return `  <section id="attraction" class="py-24 px-6 bg-sand">
    <div class="max-w-5xl mx-auto">
      <div class="text-center mb-12 fade-in">
        <p class="text-gold-dark text-sm font-medium tracking-[0.2em] uppercase mb-4">${escHtml(d.eyebrow || '')}</p>
        <h2 class="font-display text-4xl md:text-5xl text-forest mb-6">${escHtml(d.title || '')}</h2>
        <p class="text-stone-600 text-lg max-w-2xl mx-auto">${escHtml(d.subtitle || '')}</p>
      </div>
      <div class="overflow-x-auto rounded-2xl shadow-sm fade-in">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-forest text-white">
              <th class="py-4 px-5 font-semibold text-sm tracking-wide w-12">#</th>
              <th class="py-4 px-5 font-semibold text-sm tracking-wide">Spot</th>
              <th class="py-4 px-5 font-semibold text-sm tracking-wide">Highlight</th>
              <th class="py-4 px-5 font-semibold text-sm tracking-wide">Time</th>
              <th class="py-4 px-5 font-semibold text-sm tracking-wide">Vibe</th>
            </tr>
          </thead>
          <tbody>
${rows || '            <tr><td colspan="5" class="py-8 px-5 text-center text-stone-500">No spots published yet.</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="text-center mt-10 fade-in">
        <a href="attractions/index.html" class="inline-flex items-center gap-2 bg-forest text-white font-semibold px-7 py-3.5 rounded-full hover:bg-forest-light transition-colors duration-300">View all ${items.length} attractions &rarr;</a>
      </div>
    </div>
  </section>`;
}

// 按 TOP-ATTRACTION:START/END 标记重写 index.html（整区块由数据驱动）
export function applyTopAttractions(html, data) {
  const block = buildTopAttractionsHtml(data);
  return html.replace(
    /<!--TOP-ATTRACTION:START-->[\s\S]*?<!--TOP-ATTRACTION:END-->/,
    `<!--TOP-ATTRACTION:START-->\n${block}\n  <!--TOP-ATTRACTION:END-->`
  );
}

// Top 8 表格不使用图片；保持函数签名兼容，返回空数组。
export function listTopAttractionImages(data) {
  return [];
}

// 列出所有可见行的详情页链接（attractions/<slug>.html），供无死链校验
export function listTopAttractionLinks(data) {
  const items = (data && data.items) || [];
  return items.filter((it) => !it.hidden).map((it) => `attractions/${it.slug}.html`);
}
