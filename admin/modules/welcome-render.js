// 共享纯函数（无 Node / 浏览器全局依赖）→ 单一真源
// 同时被 scripts/build-home.mjs（构建）与 admin/modules/welcome.js（后台预览）import。
// 因此后台"所见"与线上"所得"永远一致，杜绝前后台漂移。
// 注意：本文件不得 import fs / path / 任何浏览器全局，否则浏览器端会崩溃、Node 端也会报错。

const imgName = (n) => (/\.(webp|jpg|jpeg|avif|png)$/i.test(n) ? n : n + '.webp');
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ========== 欢迎区 Welcome ==========
// 纯函数：由 welcome 数据生成 stats 条 + intro block（+ 区内固定底部导航）。
// 背景图来自独立图库 images/welcome/。*强调* 约定转 <em class="wk-em">（CSS 统一白色加粗）。
export function buildWelcome(w) {
  const eyebrow = (w && w.eyebrow) || '';
  const h2 = (w && w.h2) || '';
  const paras = (w && Array.isArray(w.paras)) ? w.paras : [];
  const stats = (w && Array.isArray(w.stats)) ? w.stats : [];
  const bg = (w && w.bgImg) || 'intro-bg';
  const emWk = (s) => escHtml(s).replace(/\*([^*]+)\*/g, '<em class="wk-em">$1</em>');
  const statsHtml = stats.map((s, i) =>
    `      <div id="welcome-stat-${i}"><p class="font-display text-3xl text-sand">${escHtml(s.num)}</p><p class="text-white/60 text-sm mt-1">${escHtml(s.label)}</p></div>`
  ).join('\n');
  const parasHtml = paras.map((p, i) =>
    `          <p id="welcome-para-${i}" class="text-white/90 leading-relaxed text-base md:text-lg">\n            ${emWk(p)}\n          </p>`
  ).join('\n\n');
  return `  <!-- Quick stats bar (under Hero) -->
  <section class="bg-forest py-10 border-t border-white/10">
    <div class="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
${statsHtml}
    </div>
  </section>

  <!-- Home intro block — text-focused, blurred grand backdrop -->
  <section class="relative py-24 px-6 overflow-hidden">
    <!-- Blurred grand background photo (Xihai Peak Forest) -->
    <div id="welcome-bg" class="absolute inset-0 bg-cover bg-center" style="background-image:url('images/welcome/${imgName(bg)}');"></div>
    <!-- Dark green overlay like the hero, for text legibility -->
    <div class="absolute inset-0" style="background: linear-gradient(to bottom, rgba(26,58,42,0.72) 0%, rgba(26,58,42,0.86) 100%);"></div>

    <!-- Content: text is the focus — visitor-centric + SEO-optimized -->
    <div class="relative z-10 max-w-3xl mx-auto text-center">
      <p id="welcome-eyebrow" class="text-gold text-xs font-semibold tracking-[0.3em] uppercase mb-5 fade-in">${escHtml(eyebrow)}</p>
      <h2 id="welcome-h2" class="font-display text-4xl md:text-5xl lg:text-6xl text-white leading-tight mb-7 fade-in">${escHtml(h2)}</h2>

        <div class="text-left space-y-5 fade-in">
${parasHtml}
        </div>
    </div>

    <!-- Understated navigation (de-emphasized — plain text links, no cards) -->
    <nav class="relative z-10 mt-14 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-white/60 fade-in">
      <a href="attractions/index.html" class="hover:text-white hover:pl-1 transition-all duration-200 inline-block py-3">Attractions</a>
      <a href="experiences/index.html" class="hover:text-white hover:pl-1 transition-all duration-200 inline-block py-3">Experiences</a>
      <a href="tours/index.html" class="hover:text-white hover:pl-1 transition-all duration-200 inline-block py-3">Tours</a>
      <a href="#hotel" class="hover:text-white hover:pl-1 transition-all duration-200 inline-block py-3">Hotels</a>
      <button type="button" onclick="openContactModal(event)" class="hover:text-white transition-colors cursor-pointer">Contact</button>
    </nav>
  </section>`;
}

export function applyWelcome(html, welcome) {
  const block = buildWelcome(welcome);
  return html.replace(/<!--HOME:WELCOME:START-->[\s\S]*?<!--HOME:WELCOME:END-->/, `<!--HOME:WELCOME:START-->\n${block}\n  <!--HOME:WELCOME:END-->`);
}
