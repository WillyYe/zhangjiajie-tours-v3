// 预览 iframe 内容守卫单元测试（方案 C 核心：内容/选择项未变则不重载）
//
// 直接验证 preview-frame.js 的 setPreviewSrcdoc 守卫逻辑：
//   - 内容（html）与 tag 都不变 → 返回 false，不触发 srcdoc 赋值（不闪、不丢滚动）
//   - 内容变化 → 返回 true，计数 +1
//   - tag（如所选卡片 id/slug）变化 → 即使 html 相同也返回 true，计数 +1（保证选中描边/滚动同步）
//   - onFrameLoad 支持「同一 iframe 注册多个 handler」（模块的描边 + App 的 scrollToActive 共存），
//     复用 iframe 时多次注册均生效、互不覆盖；clearFrameHandlers 可清空（供每渲染周期清理）
//
// 运行：node tests/preview-frame-guard-test.mjs

import {
  srcdocAssignCount,
  resetSrcdocAssignCount,
  setPreviewSrcdoc,
  onFrameLoad,
  clearFrameHandlers,
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

console.log('D. onFrameLoad 多 handler：复用 iframe 时多次注册均生效（不互相覆盖）');
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
function fireLoad(f) { (f._listeners['load'] || []).forEach((fn) => fn()); }
const f2 = fakeIframeWithEvents();
const handlerA = () => { fireCount += 1; };
const handlerB = () => { fireCount += 10; };
onFrameLoad(f2, handlerA);
fireLoad(f2); // 模拟一次 load
ok('handlerA 触发（fire=1）', fireCount === 1);
onFrameLoad(f2, handlerB); // 复用 iframe，追加注册（不移除旧）
fireLoad(f2);
ok('复用后两者都触发（fire=12：A+B 共存）', fireCount === 12);
clearFrameHandlers(f2); // app.js 每渲染周期清理
fireLoad(f2);
ok('clearFrameHandlers 后 load 不再触发（fire 仍为 12）', fireCount === 12);

console.log('');
console.log(`预览内容守卫单元测试： ${pass} 通过 / ${fail} 失败`);
if (fail > 0) {
  console.log('失败项：\n - ' + fails.join('\n - '));
  process.exit(1);
}
