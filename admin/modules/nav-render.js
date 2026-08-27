// 顶部导航 Nav 纯函数（浏览器安全 → 前台 build 与后台预览共用单一真源）
// 由 siteNav.items 生成 MEGA（桌面）与 MOBILE（移动）两段菜单。
// 跳过 hidden 项；一级 + 二级下拉（简洁）；Hotels 项输出 HOTEL-NAV 占位，
// 交由 buildIndexNav 自动填充（保留 B4 的酒店二级与 hotelCategories 同步）。
// # 开头 url（Contact）渲染为按钮。
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// base: 子页在子目录（attractions/ experiences/ ...），链接需 ../ 前缀；首页 root 传 ''
// 仅对 root-relative 路径（attractions/x.html）加前缀；#锚点 / http(s):// / 绝对 / 开头不加。
const withBase = (base, url) => {
  if (!base) return url;
  if (/^(#|https?:\/\/|\/)/.test(url)) return url;
  return base + url;
};

export function buildSiteNavMega(nav, base = '') {
  const items = (nav && Array.isArray(nav.items)) ? nav.items : [];
  const lis = items.filter((it) => !it.hidden).map((it, idx) => {
    const url = withBase(base, it.url || '#');
    const isContact = url.startsWith('#');
    const isHotels = /(^|\/)hotels\//.test(url) || it.label === 'Hotels';
    const children = Array.isArray(it.children) ? it.children.filter((c) => !c.hidden) : [];
    if (isHotels) {
      return '          <!--HOTEL-NAV:MEGA:START-->\n          <!--HOTEL-NAV:MEGA:END-->';
    }
    if (isContact) {
      return `          <li id="nav-item-${idx}" class="nav-item h-full flex items-center">\n            <button type="button" onclick="openContactModal(event)" class="text-[13px] font-semibold border px-4 py-1.5 rounded-full transition-all duration-200 cursor-pointer header-cta">${escHtml(it.label)}</button>\n          </li>`;
    }
    if (!children.length) {
      return `          <li id="nav-item-${idx}" class="nav-item h-full flex items-center">\n            <a href="${escAttr(url)}" class="nav-link text-[13px] font-medium header-nav-link px-3 h-full flex items-center transition-colors duration-200">${escHtml(it.label)}</a>\n          </li>`;
    }
    const twoCol = children.length >= 6;
    const links = children.map((c) => `                <a href="${escAttr(withBase(base, c.url || '#'))}" class="mega-link">${escHtml(c.label)}</a>`).join('\n');
    const inner = twoCol
      ? `              <div class="grid grid-cols-2 gap-x-10 gap-y-1">\n${links}\n              </div>`
      : `              <div class="flex flex-col gap-1">\n${links}\n              </div>`;
    return `          <li id="nav-item-${idx}" class="nav-item h-full flex items-center">\n            <a href="${escAttr(url)}" class="nav-link text-[13px] font-medium header-nav-link px-3 h-full flex items-center gap-1 transition-colors duration-200">\n              ${escHtml(it.label)}\n              <svg class="dropdown-caret" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>\n            </a>\n            <div class="mega-menu" style="width:${twoCol ? 560 : 260}px;">\n${inner}\n            </div>\n          </li>`;
  }).join('\n');
  return `        <nav class="hidden lg:flex items-center h-full">\n          <ul class="flex items-center h-full" style="gap:1.618rem;">\n${lis}\n          </ul>\n        </nav>`;
}

export function buildSiteNavMobile(nav, base = '') {
  const items = (nav && Array.isArray(nav.items)) ? nav.items : [];
  const links = items.filter((it) => !it.hidden).map((it, idx) => {
    const url = withBase(base, it.url || '#');
    const isContact = url.startsWith('#');
    const isHotels = /(^|\/)hotels\//.test(url) || it.label === 'Hotels';
    const children = Array.isArray(it.children) ? it.children.filter((c) => !c.hidden) : [];
    if (isHotels) {
      return '      <!--HOTEL-NAV:MOBILE:START-->\n      <!--HOTEL-NAV:MOBILE:END-->';
    }
    if (isContact) {
      return `      <button type="button" onclick="openContactModal(event);document.getElementById('mobile-menu').classList.add('hidden')" class="block text-forest font-semibold py-2 pt-3 border-t border-sand-dark mt-2 cursor-pointer">${escHtml(it.label)}</button>`;
    }
    let out = `      <a href="${escAttr(url)}" class="block text-stone font-semibold py-2" onclick="closeMobileMenu()">${escHtml(it.label)}</a>`;
    if (children.length) {
      out += '\n' + children.map((c, cidx) => `      <a id="nav-child-${idx}-${cidx}" href="${escAttr(withBase(base, c.url || '#'))}" class="block text-stone/80 py-1 pl-3 text-sm" onclick="closeMobileMenu()">${escHtml(c.label)}</a>`).join('\n');
    }
    return out;
  }).join('\n');
  return `    <div id="mobile-menu" class="hidden lg:hidden bg-white border-t border-sand-dark px-6 py-4 space-y-1 max-h-[80vh] overflow-y-auto">\n${links}\n    </div>`;
}

// 页脚 "Explore" 块：由 siteNav 生成（跳过 hidden + 无 footerLabel 的项），
// 使 siteNav 成为全站导航唯一真源 —— 翻 hidden 即全站（含页脚）同步隐藏。
export function buildSiteNavFooter(nav, base = '') {
  const items = (nav && Array.isArray(nav.items)) ? nav.items : [];
  const lis = items
    .filter((it) => !it.hidden && it.footerLabel)
    .map((it) => `            <li><a href="${escAttr(withBase(base, it.url || '#'))}" class="hover:text-white hover:pl-1 transition-all duration-200 inline-block">${escHtml(it.footerLabel)}</a></li>`)
    .join('\n');
  return `        <div>\n          <h4 class="text-white/90 font-semibold text-sm uppercase tracking-wider mb-5">Explore</h4>\n          <ul class="space-y-3 text-sm">\n${lis}\n          </ul>\n        </div>`;
}

// base: 子页传 '../'（链接在子目录），首页传 ''（root）。
export function applyNav(html, siteNav, base = '') {
  html = html.replace(/<!--HOME:NAV:MEGA:START-->[\s\S]*?<!--HOME:NAV:MEGA:END-->/, `<!--HOME:NAV:MEGA:START-->\n${buildSiteNavMega(siteNav, base)}\n<!--HOME:NAV:MEGA:END-->`);
  html = html.replace(/<!--HOME:NAV:MOBILE:START-->[\s\S]*?<!--HOME:NAV:MOBILE:END-->/, `<!--HOME:NAV:MOBILE:START-->\n${buildSiteNavMobile(siteNav, base)}\n<!--HOME:NAV:MOBILE:END-->`);
  html = html.replace(/<!--HOME:NAV:FOOTER:START-->[\s\S]*?<!--HOME:NAV:FOOTER:END-->/, `<!--HOME:NAV:FOOTER:START-->\n${buildSiteNavFooter(siteNav, base)}\n<!--HOME:NAV:FOOTER:END-->`);
  return html;
}
