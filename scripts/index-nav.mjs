// zhangjiajie-tours-v3 — index.html hotel-nav block generator (pure, no side effects)
// Shared by scripts/build-hotels.mjs (post-build rewrite) and tests/index-nav-loop.mjs (verifier),
// so the build output and the test assertions use the exact same logic (single source of truth).
const imgName = (n) => (/\.(webp|jpg|jpeg|avif|png)$/i.test(n) ? n : n + '.webp');
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Build the three dynamic blocks from hotelCategories (hidden categories are skipped).
// Each block is the inner HTML between the matching <!--HOTEL-NAV:*:START/END--> markers.
// Indentation matches the original hand-written index.html exactly so that with all 4
// categories visible the output is byte-identical (zero regression).
export function buildIndexNav(cats) {
  const vis = cats.filter((c) => !c.hidden);
  const topHref = vis.length ? `hotels/${vis[0].slug}.html` : '#';

  const megaLinks = vis.map((c) =>
    `                <a href="hotels/${c.slug}.html" class="mega-link">${c.navLabel}</a>`
  ).join('\n');

  const mega =
`          <li class="nav-item h-full flex items-center">
            <a href="${topHref}" class="nav-link text-[13px] font-medium header-nav-link px-3 h-full flex items-center gap-1 transition-colors duration-200">
              Hotels
              <svg class="dropdown-caret" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
            </a>
            <div class="mega-menu" style="width:480px;">
              <div class="grid grid-cols-2 gap-x-8 gap-y-1">
${megaLinks}
              </div>
            </div>
          </li>`;

  const mobile = vis.map((c) =>
    `      <a href="hotels/${c.slug}.html" class="block text-stone/80 py-1 pl-3 text-sm" onclick="closeMobileMenu()">${c.navLabel}</a>`
  ).join('\n');

  const cards = vis.map((c) => {
    // cardImg 形如 `hotel-jimo-1`，物理目录为文件名前缀 `hotel-<dir>-` 中的 <dir>
    // （与 build-hotels.mjs 的 heroSlugFor 推断规则一致；分类 slug 如 mountain-lodges
    // 并不等于图片目录 jimo，不能用 c.slug）。fallback 到 c.slug 仅作兜底。
    const m = /^hotel-([a-z0-9-]+)-/.exec(c.cardImg || '');
    const dir = (m && m[1]) || c.slug;
    const img = `images/${dir}/${imgName(c.cardImg)}`;
    return `        <a href="hotels/${c.slug}.html" class="group relative min-h-[240px] rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 fade-in block">
          <img src="${img}" alt="${escAttr(c.cardAlt)}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" loading="lazy" decoding="async">
          <div class="absolute inset-0 bg-gradient-to-t from-forest/85 via-forest/20 to-transparent"></div>
          <div class="absolute inset-0 flex flex-col justify-end p-6 text-white">
            <h3 class="font-display text-xl md:text-2xl mb-1">${escHtml(c.cardTitle)}</h3>
            <p class="text-white/80 text-sm">${c.cardDesc}</p>
          </div>
        </a>`;
  }).join('\n');

  return { mega, mobile, cards: `      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">\n${cards}\n      </div>` };
}

// Replace the content between START/END markers in an HTML string (keeps the markers).
export function applyIndexNav(html, blocks) {
  const repl = (h, name, content) => {
    const re = new RegExp(`(<!--HOTEL-NAV:${name}:START-->)[\\s\\S]*?(<!--HOTEL-NAV:${name}:END-->)`, 'g');
    return h.replace(re, `$1\n${content}\n$2`);
  };
  return ['MEGA', 'MOBILE', 'CARDS'].reduce((h, n) => repl(h, n, blocks[n.toLowerCase()]), html);
}
