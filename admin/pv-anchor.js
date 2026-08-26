// 字段 → 预览跳转 + 高亮（Loop 工程：单一真相源 = 各模块 field.pv 声明）
// 用法：在字段构建器里 const wrap = el('div',{class:'field'},[...]); withPv(wrap, field); return wrap;
//      field.pv = { mode:'card'|'detail'|'category'|'', anchor:'pv-card-name' }
// 点击字段 → 切到对应预览模式 → 等 iframe load → 滚动到锚点 → 高亮闪一下

const FLASH_MS = 1500;

function ensureFlashStyle(doc) {
  if (doc.getElementById('pv-flash-style')) return;
  const s = doc.createElement('style');
  s.id = 'pv-flash-style';
  s.textContent =
    '.pv-flash{outline:3px solid #378ADD;outline-offset:2px;border-radius:8px;' +
    'animation:pvFlash 1.5s ease-out;}' +
    '@keyframes pvFlash{0%{box-shadow:0 0 0 0 rgba(55,138,221,.55);}' +
    '100%{box-shadow:0 0 0 16px rgba(55,138,221,0);}}';
  (doc.head || doc.documentElement).appendChild(s);
}

function flashEl(doc, elm) {
  ensureFlashStyle(doc);
  elm.classList.remove('pv-flash');
  void elm.offsetWidth; // 强制回流以重启动画
  elm.classList.add('pv-flash');
  setTimeout(() => elm.classList.remove('pv-flash'), FLASH_MS);
}

// 预览根：优先 iframe（srcdoc），否则直接 DOM（hotels 卡片/分类、hero 等）
function getPreviewRoot() {
  const previewEl = document.getElementById('preview');
  if (!previewEl) return null;
  const iframe = previewEl.querySelector('iframe');
  if (iframe && iframe.contentDocument) {
    return { doc: iframe.contentDocument, root: iframe.contentDocument, isFrame: true };
  }
  return { doc: previewEl.ownerDocument, root: previewEl, isFrame: false };
}

function findTarget(anchor) {
  const r = getPreviewRoot();
  if (!r) return null;
  try {
    return r.root.querySelector('#' + CSS.escape(anchor)) || null;
  } catch {
    return null;
  }
}

function jumpToField(mode, anchor) {
  if (!anchor) return;
  // 1) 切预览模式（如该模块支持此模式才切）
  const app = window.__adminApp;
  if (app && mode) app.setPreviewModeIfAvailable(mode);
  // 2) 轮询等待目标出现（iframe 可能还在 load）
  let tries = 0;
  const tick = () => {
    const t = findTarget(anchor);
    if (t) {
      const r = getPreviewRoot();
      t.scrollIntoView({ behavior: 'smooth', block: 'center' });
      flashEl(r.doc, t);
      return;
    }
    if (tries++ < 20) setTimeout(tick, 80);
  };
  tick();
}

// 给字段包裹层加 data 属性 + 点击跳转；按默认值仅点标签/缩略图才跳，输入框 focus 不跳
export function withPv(wrapper, field) {
  const pv = field && field.pv;
  if (!wrapper || !pv || !pv.anchor) return wrapper;
  wrapper.setAttribute('data-pv-mode', pv.mode || '');
  wrapper.setAttribute('data-pv-anchor', pv.anchor);
  wrapper.style.cursor = 'pointer';
  wrapper.title = '点击在预览中定位';
  wrapper.addEventListener('click', (e) => {
    const tag = e.target.tagName;
    // 仅拦截可编辑输入与按钮；缩略图(img)允许点击定位（"点图片跳转"）
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
    e.preventDefault();
    jumpToField(pv.mode, pv.anchor);
  });
  return wrapper;
}

export { jumpToField, flashEl };
window.__jumpToField = jumpToField;
