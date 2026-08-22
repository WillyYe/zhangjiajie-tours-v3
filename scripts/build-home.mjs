// 首页区块生成器（与 build-hotels.mjs 共用 index.html 标记区思路）
// 导出 buildHero / applyHero / applyHome，供 build 串联与验证器复用（单一事实源）。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const imgName = (n) => (/\.(webp|jpg|jpeg|avif|png)$/i.test(n) ? n : n + '.webp');
// 正文 *强调* 约定：先转义 HTML，再把 *...* 转 <em>（与酒店模块一致）
const emText = (s) => escHtml(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');

const HERO_GRAD = 'linear-gradient(to bottom, rgba(26,58,42,0.3) 0%, rgba(26,58,42,0.5) 50%, rgba(26,58,42,0.85) 100%)';

// 纯函数：由 hero 数据生成 hero <section>（含内联背景图，数据驱动）
export function buildHero(hero) {
  const eyebrow = (hero && hero.eyebrow) || '';
  const h1a = (hero && hero.h1Line1) || '';
  const h1b = (hero && hero.h1Line2) || '';
  const desc = (hero && hero.desc) || '';
  const bg = (hero && hero.bgImg) || 'hero-tianzi-clouds';
  return `<section id="home" class="hero-bg min-h-screen flex items-center justify-center relative" style="background-image: ${HERO_GRAD}, url('images/hero/${imgName(bg)}');">\n` +
`    <div class="text-center px-6 max-w-4xl">\n` +
`      <p class="text-gold text-sm font-medium tracking-[0.3em] uppercase mb-6 fade-in">${escHtml(eyebrow)}</p>\n` +
`      <h1 class="font-display text-5xl md:text-7xl text-white leading-tight mb-8 fade-in">\n` +
`        ${escHtml(h1a)}<br>${escHtml(h1b)}\n` +
`      </h1>\n` +
`      <p class="text-lg md:text-xl text-white/80 leading-relaxed max-w-2xl mx-auto mb-10 fade-in">\n` +
`        ${emText(desc)}\n` +
`      </p>\n` +
`    </div>\n` +
`    <div class="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">\n` +
`      <svg width="30" height="30" fill="none" stroke="white" stroke-width="1.5" viewBox="0 0 24 24" class="opacity-60"><path d="M12 5v14M5 12l7 7 7-7"/></svg>\n` +
`    </div>\n` +
`  </section>`;
}

// 按 HOME:HERO 标记重写 index.html
export function applyHero(html, hero) {
  const block = buildHero(hero);
  return html.replace(/<!--HOME:HERO:START-->[\s\S]*?<!--HOME:HERO:END-->/, `<!--HOME:HERO:START-->\n${block}\n  <!--HOME:HERO:END-->`);
}

// 调度：当前仅 hero；welcome / siteNav 后续模块接入（保持单一入口）
export function applyHome(html, data) {
  let out = html;
  if (data && data.hero) out = applyHero(out, data.hero);
  return out;
}

// CLI：node scripts/build-home.mjs 直接重写 index.html（供手动/串联调用）
if (import.meta.url === `file://${process.argv[1]}`) {
  const { hero } = await import('../home-data.mjs');
  const html = fs.readFileSync(INDEX, 'utf8');
  fs.writeFileSync(INDEX, applyHome(html, { hero }), 'utf8');
  console.log('  ✓ rewrote index.html hero block (build-home)');
}
