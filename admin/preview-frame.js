// 预览 iframe 复用 + 内容守卫（C 优化：内容/选择未变则不重载，消除逐键白屏闪烁）
// 统一封装，供各模块预览渲染器复用，避免「每次渲染都重建 iframe + 整体 srcdoc 重载」带来的闪烁。
//
// 用法：
//   const iframe = ensurePreviewFrame(container, { cls:'pv-detail-iframe', title:'…', bg:'#f3efe7' });
//   onFrameLoad(iframe, () => { /* 每次「实际重载」后执行：选中描边 / 滚动同步 IO */ });
//   setPreviewSrcdoc(iframe, html, tag);     // tag 变化（如所选卡片 id）也会触发重载
// 空/加载态：detachPreviewFrame(container) 后 append 自己的提示节点即可。

let _assignCount = 0; // 实际发生 srcdoc 赋值的次数（仅用于测试护栏）
export function srcdocAssignCount() { return _assignCount; }
export function resetSrcdocAssignCount() { _assignCount = 0; }

// 复用同一预览 iframe：找到匹配 class 的则复用，否则移除旧 iframe 重建；并清掉残留的空/加载态节点。
export function ensurePreviewFrame(container, opts = {}) {
  const cls = opts.cls || 'pv-detail-iframe';
  let iframe = container.querySelector('iframe.' + cls);
  if (!iframe) {
    const old = container.querySelector('iframe');
    if (old) old.remove();
    iframe = document.createElement('iframe');
    iframe.className = cls;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    container.appendChild(iframe);
  }
  if (opts.title != null) iframe.title = opts.title;
  if (opts.bg != null) iframe.style.background = opts.bg;
  // 清掉非 iframe 子节点（空态/加载态提示），避免叠加显示
  for (const c of Array.from(container.children)) {
    if (c !== iframe) c.remove();
  }
  return iframe;
}

// 移除预览 iframe（切到空/加载态时用）
export function detachPreviewFrame(container) {
  const f = container.querySelector('iframe');
  if (f) f.remove();
}

// 管理可复用的 load 监听：每次渲染重新绑定，避免 {once:true} 在复用 iframe 上只触发一次就失效。
export function onFrameLoad(iframe, handler) {
  if (iframe.__onLoad) iframe.removeEventListener('load', iframe.__onLoad);
  iframe.__onLoad = handler;
  iframe.addEventListener('load', handler);
}

// 内容守卫：key = tag + '\u0000' + html；未变则跳过重载（不闪、不丢滚动）；变化才赋值并计数。
export function setPreviewSrcdoc(iframe, html, tag) {
  const key = (tag == null ? '' : String(tag)) + '\u0000' + html;
  if (iframe.__lastKey === key) return false;
  iframe.__lastKey = key;
  _assignCount++;
  iframe.srcdoc = html;
  return true;
}

if (typeof window !== 'undefined') {
  window.__previewFrame = { srcdocAssignCount, resetSrcdocAssignCount };
}
