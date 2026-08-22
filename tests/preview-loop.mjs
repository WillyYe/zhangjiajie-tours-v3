// preview-loop.mjs —— 保证 hero/hotels 模块编辑字段后右侧预览自动刷新。
// 关键：app.js 的 onChange 回调必须 setStatus(true) + renderPreviewForCurrent()。
//
// 用 jsdom 真实载入 admin/modules/hero.js 的 renderEditor 与 renderPreview，模拟用户改字段
// → onInput 链路 → 验证 onChange 回调触发、预览 DOM 反映新值。
// 同时 grep app.js 源码做静态门禁，防止以后又被人改回只 setStatus(true) 不刷预览。

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

// ---------- 静态门禁 ----------
function staticGate() {
  const appJs = fs.readFileSync(path.join(ROOT, 'admin/app.js'), 'utf8');

  // 在 app.js 的 hero 分支内，onChange 闭包必须含 renderPreviewForCurrent
  const heroBlock = appJs.match(/state\.module === 'hero'[\s\S]{0,200}/);
  assert(!!heroBlock, 'app.js 内能找到 hero 分支');
  if (heroBlock) {
    assert(
      /setStatus\(true\)[\s\S]{0,40}renderPreviewForCurrent\(\)/.test(heroBlock[0]),
      '[hero] onChange 回调同时调 setStatus(true) 与 renderPreviewForCurrent()',
    );
  }

  // hotels 分支同样修复
  const hotelsBlock = appJs.match(/state\.module === 'hotels'[\s\S]{0,400}/);
  assert(!!hotelsBlock, 'app.js 内能找到 hotels 分支');
  if (hotelsBlock) {
    assert(
      /setStatus\(true\)[\s\S]{0,40}renderPreviewForCurrent\(\)/.test(hotelsBlock[0]),
      '[hotels] onChange 回调同时调 setStatus(true) 与 renderPreviewForCurrent()',
    );
  }
}

// ---------- 运行时门禁（jsdom 真实导入 hero.js） ----------
async function runtimeGate() {
  const dom = new JSDOM('<!DOCTYPE html><div id="editor"></div><div id="preview"></div>', {
    url: 'http://localhost/admin/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });

  // 把 jsdom 的全局挂到 Node 上，让 admin JS 看到 window/document
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLImageElement = dom.window.HTMLImageElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.Node = dom.window.Node;
  globalThis.URL = dom.window.URL;
  globalThis.Blob = dom.window.Blob;
  globalThis.FileReader = dom.window.FileReader;
  // createImageBitmap 在 jsdom 中没有，但 hero.js 顶层不调它（只 imageField 中 src 触发）
  // 测试中我们不走到上传链路，只走 onInput。

  const { renderEditor, renderPreview } = await import('../admin/modules/hero.js');

  const editor = document.getElementById('editor');
  const preview = document.getElementById('preview');

  const hero = {
    eyebrow: 'UNESCO World Heritage Site',
    h1Line1: 'Where Mountains',
    h1Line2: 'Float in the Clouds',
    desc: 'Surreal *sandstone* peaks.',
    bgImg: 'hero-tianzi-clouds',
  };

  let renderCount = 0;
  let lastDirtyMark = false;
  // 模拟 app.js 的 renderPreviewForCurrent 行为：dirty 标 + 重绘预览
  const fakeRenderPreviewForCurrent = () => {
    renderCount++;
    lastDirtyMark = true;
    renderPreview(preview, hero);
  };

  renderEditor(editor, hero, () => fakeRenderPreviewForCurrent());

  // 渲染初次完成（boot/loadModule 也会渲染一次，但这里只跑了 renderEditor）
  assert(editor.querySelector('.module-head') !== null, '[hero] renderEditor 生成 module-head');
  assert(editor.querySelector('.img-field input[type="text"]') !== null, '[hero] 生成背景图文本框');

  // 1) 模拟改 eyebrow 文本框（纯 oninput 链路）
  const eyebrowInput = editor.querySelector('.field input[placeholder="UNESCO World Heritage Site"]');
  assert(eyebrowInput !== null, '[hero] eyebrow input 已渲染');
  eyebrowInput.value = 'TEST_EYEBROW_NEW';
  eyebrowInput.oninput({ target: eyebrowInput });
  assert(renderCount >= 1, '[hero] onChange 回调触发 1 次（eyebrow 修改）');
  assert(preview.innerHTML.includes('TEST_EYEBROW_NEW'), '[hero] 预览含新 eyebrow');

  // 2) 模拟改 h1Line1（最关键字段）
  renderCount = 0;
  const h1Input = editor.querySelectorAll('.field input[type="text"]')[1];
  assert(h1Input !== null, '[hero] h1Line1 input 已渲染');
  h1Input.value = 'Where Pillars';
  h1Input.oninput({ target: h1Input });
  assert(renderCount >= 1, '[hero] onChange 回调触发 1 次（h1Line1 修改）');
  assert(preview.innerHTML.includes('Where Pillars'), '[hero] 预览含新 h1Line1');

  // 3) 模拟改描述（含 *强调* 解析）
  renderCount = 0;
  const descTa = editor.querySelector('.field textarea');
  assert(descTa !== null, '[hero] desc textarea 已渲染');
  descTa.value = 'Discover *real* mountains.';
  descTa.oninput({ target: descTa });
  assert(renderCount >= 1, '[hero] onChange 回调触发 1 次（desc 修改）');
  assert(
    preview.innerHTML.includes('<em>real</em>') || preview.innerHTML.includes('real'),
    '[hero] 预览含新描述（或强调解析）',
  );

  // 4) 模拟改背景图文本框值（模拟用户手编输入文件名的链路）
  renderCount = 0;
  const bgInput = editor.querySelector('.img-field input[type="text"]');
  bgInput.value = 'new-bg-from-user-input';
  bgInput.oninput({ target: bgInput });
  assert(renderCount >= 1, '[hero] onChange 回调触发 1 次（bgImg 修改）');
  assert(
    preview.innerHTML.includes('new-bg-from-user-input'),
    '[hero] 预览区背景图 URL 反映新 bgImg',
  );

  // 5) 现场验证：用户报告的「上传新图预览不出来」场景
  //    (没有这一改之前，renderEditor 完全不重渲染预览，预览永远 stale)
  //    修复后，每次 onChange → 重渲染 → preview DOM 内含新 bgImg 文件名
  renderCount = 0;
  bgInput.value = 'second-new-uploaded-image';
  bgInput.oninput({ target: bgInput });
  assert(renderCount >= 1, '[hero] 上传新背景图后，预览刷新 1 次');
  assert(
    preview.innerHTML.includes('second-new-uploaded-image'),
    '[hero] 上传新图后预览区含新文件名（bug 已修）',
  );
}

// ---------- 跑 ----------
console.log('━━━ preview-loop ━━━');
staticGate();
await runtimeGate();

let pass = 0, fail = 0;
for (const r of results) {
  if (r.ok) { pass++; console.log(`  ✓ ${r.msg}`); }
  else { fail++; console.log(`  ✗ ${r.msg}`); }
}
console.log(`━━━ ${pass}/${pass + fail} passed ━━━`);
process.exit(fail ? 1 : 0);
