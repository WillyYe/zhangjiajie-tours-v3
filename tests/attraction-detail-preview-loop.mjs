// attraction-detail-preview-loop.mjs —— 景点后台「详情页预览」闭环验证。
//
// 背景（2026-08-22 用户报告「后台景点的详情预览和卡片的预览都一样了，详情页要做出来」）：
//   景点模块此前只有卡片预览（buildTopAttractionsHtml），没有详情预览 tab；
//   详情页内容来自另一个数据文件 attractions-data.mjs + 模板，后台根本没接。
//   按用户选定方案（只读预览已有详情页）：景点模块加「卡片/详情」tab，
//   详情 tab 用 fetch('../attractions/<slug>.html') 渲染线上真实详情页。
//
// 验证分两层：
//   ① 静态/源码门禁：app.js 接线、index.html 含详情 tab、top-attractions.js 实现走 fetch('../attractions/...)
//   ② 运行时门禁：jsdom 真实 import 模块，断言 renderAttractionDetailPreview 为可导出的函数

import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(ROOT, 'admin/app.js'), 'utf8');
const TA = fs.readFileSync(path.join(ROOT, 'admin/modules/top-attractions.js'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'admin/index.html'), 'utf8');

const results = [];
function assert(cond, msg) { results.push({ ok: !!cond, msg }); }
function no(msg, detail) { results.push({ ok: false, msg: msg + (detail ? ' → ' + detail : '') }); }

// ============================================================
// ① 静态 / 源码门禁
// ============================================================
try {
  assert(/renderAttractionDetailPreview/.test(APP) && /from '\.\/modules\/top-attractions\.js'/.test(APP),
    '① app.js 从 modules/top-attractions.js 导入 renderAttractionDetailPreview');

  // topAttractions 预览路由：选中卡片时显示 tab，详情模式调用 renderAttractionDetailPreview
  // （state.module==='topAttractions' 在 app.js 出现 3 次：loadModule/preview 路由/save；
  //   下列子串在 renderPreviewForCurrent 内唯一，直接断言更稳健）
  assert(/const isCard = sel\.type === 'card' && !!state\.topAttractions\.items\[sel\.index\];/.test(APP),
    '① 仅选中卡片(isCard)时才显示 卡片/详情 tab');
  assert(/previewTabsEl\.hidden = !isCard;/.test(APP), '① 非卡片选择时隐藏 tab（block 模式只有卡片预览）');
  assert(/const isDetail = isCard && state\.previewMode === 'detail';/.test(APP),
    '① 选中卡片且 previewMode==="detail" 时进入详情预览');
  assert(/renderAttractionDetailPreview\(previewEl, slug\);/.test(APP),
    '① 详情模式调用 renderAttractionDetailPreview(previewEl, slug)');
  assert(/const slug = state\.topAttractions\.items\[sel\.index\]\.slug;/.test(APP),
    '① 取当前选中卡片的 slug 作为详情页文件名');

  // index.html 含 详情 ptab
  assert(/class="ptab[^"]*"\s+data-mode="detail"/.test(INDEX) || /data-mode="detail"/.test(INDEX),
    '① admin/index.html 含 data-mode="detail" 的预览 tab');

  // top-attractions.js 实现走 fetch('../attractions/...') 且导出函数
  assert(/export async function renderAttractionDetailPreview/.test(TA),
    '① top-attractions.js 导出 async renderAttractionDetailPreview');
  assert(/fetch\(`\.\.\/attractions\/\$\{encodeURIComponent\(slug\)\}\.html`/.test(TA),
    '① 详情预览用 fetch("../attractions/<slug>.html") 渲染线上真实详情页');
  assert(/iframe\.srcdoc = html/.test(TA), '① 详情页 HTML 注入 iframe.srcdoc（基址 /admin/，../styles 解析正确）');
  assert(/暂无「\$\{slug\}」的详情页/.test(TA), '① 无详情页时给出友好提示（如 yuanjiajie / yellow-dragon）');
} catch (e) { no('① 静态门禁异常', e.message); }

// ============================================================
// ② 运行时门禁：jsdom 真实 import 模块
// ============================================================
try {
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
  assert(typeof ta.renderAttractionDetailPreview === 'function',
    '② renderAttractionDetailPreview 是可调用的导出函数');
} catch (e) { no('② 运行时 import 失败', e.message); }

// ============================================================
// 汇总
// ============================================================
const pass = results.filter((r) => r.ok).length;
const fail = results.length - pass;
for (const r of results) console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.msg);
console.log(`\n${fail === 0 ? '✅' : '❌'} attraction-detail-preview loop: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
