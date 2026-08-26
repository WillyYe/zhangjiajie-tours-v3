// 预览 iframe 内容守卫单元测试（方案 C 核心：内容/选择项未变则不重载）
//
// 直接验证 preview-frame.js 的 setPreviewSrcdoc 守卫逻辑：
//   - 内容（html）与 tag 都不变 → 返回 false，不触发 srcdoc 赋值（不闪、不丢滚动）
//   - 内容变化 → 返回 true，计数 +1
//   - tag（如所选卡片 id/slug）变化 → 即使 html 相同也返回 true，计数 +1（保证选中描边/滚动同步）
//   - onFrameLoad 复用 iframe 时旧 handler 被移除，不会重复绑定
//
// 运行：node tests/preview-frame-guard-test.mjs

import {
  srcdocAssignCount,
  resetSrcdocAssignCount,
  setPreviewSrcdoc,
  onFrameLoad,
} from '../admin/preview-frame.js';

let pass = 0;
let fail = 0;
const fails = [];

function ok(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; fails.push(name); console.log('  ✗ ' + name); }
}

// 模拟 iframe：仅需 set/get srcdoc 与 __lastKey（setPreviewSrcdoc 不依赖真实 DOM）
function fakeIframe() {
  const f = {};
  Object.defineProperty(f, 'srcdoc', {
    set(v) { f.__srcdoc = v; },
    get() { return f.__srcdoc; },
  });
  return f;
}

console.log('A. 内容守卫：未变化则跳过重载');
resetSrcdocAssignCount();
const f = fakeIframe();
ok('首次赋值返回 true 且计数=1', setPreviewSrcdoc(f, '<p>hi</p>', 'a') === true && srcdocAssignCount() === 1);
ok('相同 html+tag 再次赋值返回 false（不重载）', setPreviewSrcdoc(f, '<p>hi</p>', 'a') === false);
ok('计数仍为 1（未发生多余赋值）', srcdocAssignCount() === 1);

console.log('B. 内容变化触发重载');
resetSrcdocAssignCount();
const g = fakeIframe();
setPreviewSrcdoc(g, '<p>v1</p>', 'a');
ok('html 变化 → 返回 true', setPreviewSrcdoc(g, '<p>v2</p>', 'a') === true);
ok('计数 = 2', srcdocAssignCount() === 2);

console.log('C. tag 变化即使 html 相同也重载（选中卡片切换）');
resetSrcdocAssignCount();
const h = fakeIframe();
setPreviewSrcdoc(h, '<p>same</p>', 'card-1');
ok('tag 变化 → 返回 true（保证选中同步）', setPreviewSrcdoc(h, '<p>same</p>', 'card-2') === true);
ok('计数 = 2', srcdocAssignCount() === 2);
ok('tag 回到 card-1 再次变化 → 仍重载', setPreviewSrcdoc(h, '<p>same</p>', 'card-1') === true);

console.log('D. onFrameLoad 复用：旧 handler 被移除');
let fireCount = 0;
// 支持 addEventListener/removeEventListener 的假 iframe
function fakeIframeWithEvents() {
  const f = fakeIframe();
  f._listeners = {};
  f.addEventListener = (type, fn) => { (f._listeners[type] ||= []).push(fn); };
  f.removeEventListener = (type, fn) => {
    if (!f._listeners[type]) return;
    f._listeners[type] = f._listeners[type].filter((x) => x !== fn);
  };
  return f;
}
const f2 = fakeIframeWithEvents();
const handlerA = () => { fireCount++; };
const handlerB = () => { fireCount += 10; };
onFrameLoad(f2, handlerA);
// 模拟一次 load
f2.__onLoad();
ok('handlerA 触发（fire=1）', fireCount === 1);
onFrameLoad(f2, handlerB); // 复用 iframe，重绑
f2.__onLoad(); // 仅应触发最新 handlerB
ok('重绑后只触发 handlerB（fire=11，旧 handlerA 已移除）', fireCount === 11);

console.log('');
console.log(`预览内容守卫单元测试： ${pass} 通过 / ${fail} 失败`);
if (fail > 0) {
  console.log('失败项：\n - ' + fails.join('\n - '));
  process.exit(1);
}
