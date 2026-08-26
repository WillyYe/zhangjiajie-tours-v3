// 字段 → 预览跳转 + 高亮 + 自动跟随（Loop 工程：单一真相源 = 各模块 field.pv 声明）
// 用法：在字段构建器里 const wrap = el('div',{class:'field'},[...]); withPv(wrap, field); return wrap;
//      field.pv = { mode:'card'|'detail'|'category'|'', anchor:'pv-card-name' }
// 三种触发：
//   ① 点标签/缩略图 → jumpToField（切模式+滚动+高亮闪）—— 始终有效（手动定位）
//   ② 聚焦字段（focusin）→ 若「自动跟随」开启则 jumpToField —— 编辑即跟随
//   ③ 预览每次重渲染 → scrollToActive（只滚不闪，抵消 iframe 重载丢滚动）—— 保持正在编辑的内容在视区
// 智能暂停：用户在预览区手动滚动后暂停跟随；再次聚焦任意字段即恢复。

const FLASH_MS = 1500;
const FOLLOW_KEY = 'admin.followPreview';

// ---- 模块级状态 ----
let activePv = null;        // 当前激活字段 { mode, anchor }
let followEnabled = true;    // 镜像「自动跟随」开关（默认开）
let paused = false;         // 用户手动滚动预览后暂停
let suppressScroll = false; // 程序滚动期间抑制「手动滚动」误判
const guardedRoots = new WeakSet();

(function initFollow() {
  try {
    const v = localStorage.getItem(FOLLOW_KEY);
    followEnabled = v === null ? true : (v === '1' || v === 'true');
  } catch { followEnabled = true; }
})();

// ---- 开关 API ----
export function setFollowEnabled(on) {
  followEnabled = !!on;
  try { localStorage.setItem(FOLLOW_KEY, on ? '1' : '0'); } catch {}
  if (on) paused = false; // 重新开启即恢复跟随
}
export function isFollowEnabled() { return followEnabled; }
export function resumeFollow() { paused = false; }
export function getActivePv() { return activePv; }

// ---- 预览根（iframe srcdoc 优先，否则内联 DOM） ----
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

// 给某个预览根挂一次性 scroll 监听：用户手动滚动 → 暂停跟随（程序滚动期间 suppress 抑制）
function attachScrollGuard(root) {
  if (!root || guardedRoots.has(root)) return;
  guardedRoots.add(root);
  root.addEventListener('scroll', () => {
    if (suppressScroll) return;
    paused = true;
  }, { passive: true });
}

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

export function flashEl(doc, elm) {
  ensureFlashStyle(doc);
  elm.classList.remove('pv-flash');
  void elm.offsetWidth; // 强制回流以重启动画
  elm.classList.add('pv-flash');
  setTimeout(() => elm.classList.remove('pv-flash'), FLASH_MS);
}

// 滚动到锚点（flash=true 时高亮闪一下），自动轮询等待 iframe 加载
function scrollToAnchor(anchor, flash) {
  const r = getPreviewRoot();
  if (!r) return false;
  attachScrollGuard(r.root);
  let tries = 0;
  const tick = () => {
    const t = findTarget(anchor);
    if (t) {
      suppressScroll = true;
      t.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { suppressScroll = false; }, 400);
      if (flash) flashEl(r.doc, t);
      return true;
    }
    if (tries++ < 25) setTimeout(tick, 80);
    return false;
  };
  return tick();
}

// 重渲染后调用：仅保持激活字段在视区（不闪、不动模式——模式已就位）
export function scrollToActive() {
  if (!followEnabled || paused || !activePv) return;
  if (activePv.mode) {
    const app = window.__adminApp;
    if (app) app.setPreviewModeIfAvailable(activePv.mode);
  }
  scrollToAnchor(activePv.anchor, false);
}

// 切模式（如支持）+ 滚到锚点 + 高亮闪；同时登记为激活字段并恢复跟随
export function jumpToField(mode, anchor) {
  if (!anchor) return;
  activePv = { mode: mode || '', anchor };
  paused = false; // 聚焦/点击字段 = 显式选择 → 恢复跟随
  const app = window.__adminApp;
  if (app && mode) app.setPreviewModeIfAvailable(mode);
  scrollToAnchor(anchor, true);
}

// 给字段包裹层加 data 属性 + 点击/聚焦跳转
export function withPv(wrapper, field) {
  const pv = field && field.pv;
  if (!wrapper || !pv || !pv.anchor) return wrapper;
  wrapper.setAttribute('data-pv-mode', pv.mode || '');
  wrapper.setAttribute('data-pv-anchor', pv.anchor);
  wrapper.style.cursor = 'pointer';
  wrapper.title = '点击在预览中定位（开启「自动跟随」后聚焦即跟随）';
  // ① 手动：点标签 / 缩略图（输入框本身不触发，避免选中文字误跳）
  wrapper.addEventListener('click', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
    e.preventDefault();
    jumpToField(pv.mode, pv.anchor);
  });
  // ② 自动：聚焦字段即跟随（受「自动跟随」开关控制）
  wrapper.addEventListener('focusin', () => {
    if (followEnabled) jumpToField(pv.mode, pv.anchor);
  });
  return wrapper;
}

window.__jumpToField = jumpToField;
