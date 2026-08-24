// home-tour-cards-render.js — 首页 Tour Packages 三卡纯渲染（build 与 admin 预览共用单一真源）
// 无 node / 浏览器全局依赖（与 tours-render.js / top-attractions-render.js 同约束）。
//
// 以前台 index.html 现有 #tour-day 硬编码 3 卡为基准镜像：
//   • icon 背景三选一（iconBg）
//   • 副标题颜色（subtitleColor: stone-500 | gold-dark）
//   • 特性列表（features）渲染时统一加 ✓
//   • 价格串中 $数字 包 gold（与线上 "From <span class="text-gold">$129</span>/person" 一致）
//   • 按钮配色（buttonStyle: forest | gold）
//   • popular=true 加 ring-2 ring-gold/30 高亮环
//   • hidden=true 不渲染（不产生死链）

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// icon 背景：运营只选关键字，不写裸类名（与现有 class 一致）
const ICON_BG = {
  'bg-sand': 'bg-sand',
  'bg-gold/20': 'bg-gold/20',
  'bg-forest/10': 'bg-forest/10',
};
// 副标题颜色（gold-dark 自带 font-medium，与前台 "Most Popular ★" 加粗一致）
const SUBTITLE_COLOR = {
  'stone-500': 'text-stone-500',
  'gold-dark': 'text-gold-dark font-medium',
};
// 按钮配色
const BTN_STYLE = {
  forest: 'bg-forest hover:bg-forest-light text-white',
  gold: 'bg-gold hover:bg-gold-dark text-white',
};

// 价格：把 $数字 包成 gold（与线上一致）
function priceHtml(p) {
  return escHtml(p).replace(/(\$[0-9,]+)/g, '<span class="text-gold">$1</span>');
}

// ---------- 单卡 ----------
function cardHtml(c) {
  const iconBg = ICON_BG[c.iconBg] || ICON_BG['bg-sand'];
  const subColor = SUBTITLE_COLOR[c.subtitleColor] || SUBTITLE_COLOR['stone-500'];
  const btn = BTN_STYLE[c.buttonStyle] || BTN_STYLE.forest;
  const ring = c.popular ? ' ring-2 ring-gold/30' : '';
  const features = (c.features || []).map((f) => `              <li>✓ ${escHtml(f)}</li>`).join('\n');
  return `          <div id="tour-${escAttr(c.id)}-card" class="bg-white rounded-2xl p-8 shadow-sm card-hover fade-in${ring}">
            <div class="flex items-center gap-3 mb-5">
              <div class="w-12 h-12 ${iconBg} rounded-full flex items-center justify-center text-2xl">${escHtml(c.icon)}</div>
              <div><h3 class="font-display text-2xl text-forest">${escHtml(c.title)}</h3><p class="${subColor} text-sm">${escHtml(c.subtitle)}</p></div>
            </div>
            <p class="text-stone-600 text-sm mb-4">${escHtml(c.desc)}</p>
            <ul class="text-stone-500 text-sm space-y-2 mb-6">
${features}
            </ul>
            <p class="font-display text-2xl text-forest mb-1">${priceHtml(c.price)}</p>
            <button type="button" onclick="openContactModal(event)" class="mt-4 inline-block w-full text-center ${btn} font-semibold py-3 rounded-full transition-colors">Inquire Now →</button>
          </div>`;
}

// 纯函数：由 homeTourCards 数据生成 #tour-day 子区块（含 eyebrow + 标题 + 卡片网格）。
// hidden 项被跳过（不渲染、不产生死链）。缩进与 index.html 原硬编码一致 → 零回归。
export function buildHomeTourCardsHtml(data) {
  const d = data || {};
  const eyebrow = escHtml(d.eyebrow || '');
  const title = escHtml(d.title || '');
  const vis = (d.cards || []).filter((c) => !c.hidden);
  const cards = vis.map(cardHtml).join('\n\n');
  return `      <div id="tour-day">
        <div class="text-center mb-12 fade-in">
          <p class="text-gold-dark text-sm font-medium tracking-[0.2em] uppercase mb-4">${eyebrow}</p>
          <h2 class="font-display text-4xl md:text-5xl text-forest mb-6">${title}</h2>
        </div>

        <!-- Tour type tabs/cards -->
        <div class="grid lg:grid-cols-3 gap-8">

${cards}

        </div>
      </div>`;
}

// 按 HOME-TOUR-CARDS 标记重写 index.html
export function applyHomeTourCards(html, data) {
  const block = buildHomeTourCardsHtml(data);
  // 注意：正则不消耗 `<!--` 前的缩进空格，那些空格保留，故替换串不再加前导空格（避免叠加成 12 空格）。
  return html.replace(
    /<!--HOME-TOUR-CARDS:START-->[\s\S]*?<!--HOME-TOUR-CARDS:END-->/,
    `<!--HOME-TOUR-CARDS:START-->\n${block}\n<!--HOME-TOUR-CARDS:END-->`,
  );
}
