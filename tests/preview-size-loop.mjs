// preview-size-loop.mjs —— 保证景点 / 顶部导航 / 欢迎区 三个预览不再塌缩成小窗。
//
// 根因（2026-08-22 用户报告「预览窗口小、不方便查看」）：
//   .preview 是普通 block、内部 #preview 无高度，而预览 iframe 内联 height:100%
//   解析不到父高度 → 回退成浏览器默认 ~150px 小窗。三个模块共用 pv-detail-iframe。
//
// 修复：.preview 改 flex 纵向列、#preview flex:1 撑满剩余高度，iframe height:100% 即有可解析父高；
//        预览默认宽度 460 → 560（resizer 同步）。
//
// 验证分两层：
//   ① 静态门禁：解析 admin/style.css 与 admin/resizer.js，断言修复的关键 CSS / 配置存在；
//   ② 运行时门禁：jsdom 真实 import 三个模块并跑 renderPreview，断言各产出
//      <iframe class="pv-detail-iframe"> 且内联 style 含 height:100%（与 CSS 的 flex 父高配合填满）。
//   注：jsdom 不计算布局像素，真正的「填满」由 CSS flex 链保证（见 ①）。

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const results = [];
function assert(cond, msg) {
  results.push({ ok: !!cond, msg });
}

// ============================================================
// ① 静态门禁：CSS / 配置
// ============================================================
function staticGate() {
  const css = fs.readFileSync(path.join(ROOT, 'admin/style.css'), 'utf8');
  const resizer = fs.readFileSync(path.join(ROOT, 'admin/resizer.js'), 'utf8');

  // --- .preview 必须 flex 纵向列 ---
  const previewBlock = css.match(/\.preview\s*\{[\s\S]*?\}/);
  assert(!!previewBlock, 'style.css 含 .preview 规则');
  if (previewBlock) {
    const b = previewBlock[0];
    assert(/display:\s*flex/.test(b), '[.preview] display:flex（纵向列布局）');
    assert(/flex-direction:\s*column/.test(b), '[.preview] flex-direction:column');
    assert(/min-height:\s*0/.test(b), '[.preview] min-height:0（允许子项收缩）');
  }

  // --- #preview 必须弹性撑满（给 iframe 高度:100% 一个真实父高）---
  // 规则有两种写法：.preview > #preview 或 .preview #preview
  const ppRules = css.match(/\.preview\s*[>#]?\s*#preview\s*\{[\s\S]*?\}/g) || [];
  assert(ppRules.length > 0, 'style.css 含 .preview > #preview 规则');
  const ppJoined = ppRules.join('\n');
  assert(/flex:\s*1/.test(ppJoined), '[#preview] flex:1 1 auto（撑满 .preview 剩余高度）');
  assert(/min-height:\s*0/.test(ppJoined), '[#preview] min-height:0');

  // --- pv-detail-iframe 必须 height:100% ---
  const iframeRule = css.match(/\.pv-detail-iframe\s*\{[\s\S]*?\}/);
  assert(!!iframeRule, 'style.css 含 .pv-detail-iframe 规则');
  if (iframeRule) {
    assert(/height:\s*100%/.test(iframeRule[0]), '[.pv-detail-iframe] height:100%（配合父高填满）');
  }

  // --- resizer 默认宽度 460 → 560，上限放宽 ---
  const previewCfg = resizer.match(/preview:\s*\{[\s\S]*?\}/);
  assert(!!previewCfg, 'resizer.js 含 preview 配置');
  if (previewCfg) {
    const c = previewCfg[0];
    assert(/default:\s*560/.test(c), '[resizer] preview default: 560（默认更宽）');
    assert(/max:\s*1000/.test(c), '[resizer] preview max: 1000（可拖更宽）');
    assert(/min:\s*320/.test(c), '[resizer] preview min: 320');
  }
}

// ============================================================
// ② 运行时门禁：jsdom 真实渲染三个预览
// ============================================================
async function runtimeGate() {
  const dom = new JSDOM('<!DOCTYPE html><div id="editor"></div><div id="preview"></div>', {
    url: 'http://localhost/admin/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLIFrameElement = dom.window.HTMLIFrameElement;
  globalThis.Node = dom.window.Node;
  globalThis.URL = dom.window.URL;

  const ta = await import('../admin/modules/top-attractions.js');
  const nav = await import('../admin/modules/nav.js');
  const welcome = await import('../admin/modules/welcome.js');

  const taData = {
    eyebrow: 'Explore', title: 'Top Attractions', subtitle: 's',
    items: [{ slug: 'tianzi', img: 'tianzi', badge: '', badgeColor: 'forest', title: 'Tianzi', desc: 'd', hidden: false }],
  };
  const navData = {
    items: [
      { label: 'Home', url: 'index.html', hidden: false },
      { label: 'Hotels', url: '/hotels/', hidden: false },
      { label: 'Contact Us', url: '#contact', hidden: false },
    ],
  };
  const welcomeData = {
    eyebrow: 'UNESCO', h2: 'Welcome', paras: ['p1 *em*'], stats: [{ num: '3000+', label: 'pillars' }], bgImg: 'intro-bg',
  };

  function check(mod, renderPreview, data, label) {
    const preview = document.getElementById('preview');
    preview.replaceChildren();
    renderPreview(preview, data, { type: 'block' });
    const iframe = preview.querySelector('iframe.pv-detail-iframe');
    assert(!!iframe, `[${label}] 产出 <iframe class="pv-detail-iframe">`);
    if (iframe) {
      assert(/height:\s*100%/.test(iframe.getAttribute('style') || ''), `[${label}] iframe 内联 style 含 height:100%（与 CSS flex 父高配合填满）`);
    }
  }

  check(ta, ta.renderPreview, taData, '景点 Top Attractions');
  check(nav, nav.renderPreview, navData, '顶部导航 Nav');
  check(welcome, welcome.renderPreview, welcomeData, '欢迎区 Welcome');
}

// ============================================================
// 跑
// ============================================================
console.log('━━━ preview-size-loop ━━━');
staticGate();
await runtimeGate();

let pass = 0, fail = 0;
for (const r of results) {
  if (r.ok) { pass++; console.log(`  ✓ ${r.msg}`); }
  else { fail++; console.log(`  ✗ ${r.msg}`); }
}
console.log(`━━━ ${pass}/${pass + fail} passed ━━━`);
process.exit(fail ? 1 : 0);
