// 可拖拽调整面板宽度。支持三条分隔线：sidebar、preview、tree。
// 宽度持久化到 localStorage，刷新后自动恢复。
// 使用 Pointer Events + setPointerCapture，保证 Windows/macOS 鼠标移出窗口仍能拖动。

const STORAGE_KEY = 'admin-resizer-widths';

const CONFIG = {
  sidebar: { selector: '.sidebar', min: 180, max: 380, default: 248, direction: 1 },
  preview: { selector: '.preview', min: 320, max: 1000, default: 560, direction: -1 },
  tree:    { selector: '.he-tree', min: 150, max: 360, default: 210, direction: 1 },
};

function readSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function writeSaved(saved) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

export function initResizers() {
  const saved = readSaved();
  for (const [key, cfg] of Object.entries(CONFIG)) {
    const el = document.querySelector(cfg.selector);
    const w = saved[key] ?? cfg.default;
    if (el) el.style.width = clamp(w, cfg.min, cfg.max) + 'px';
  }

  document.querySelectorAll('.resizer[data-resizer]').forEach(bindResizer);
}

export function bindResizer(bar) {
  if (bar._resizerBound) return;
  bar._resizerBound = true;
  bar.addEventListener('pointerdown', onPointerDown);

  // 动态创建的 resizer（如 hotels.js 里的 tree/form 分隔条）
  // 绑定事件时同步应用已保存的宽度，避免 initResizers 时元素尚不存在。
  const key = bar.dataset.resizer;
  const cfg = CONFIG[key];
  if (!cfg) return;
  const saved = readSaved();
  const w = saved[key] ?? cfg.default;
  const el = document.querySelector(cfg.selector);
  if (el) el.style.width = clamp(w, cfg.min, cfg.max) + 'px';
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function onPointerDown(e) {
  if (e.button !== 0) return;
  e.preventDefault();

  const bar = e.currentTarget;
  const key = bar.dataset.resizer;
  const cfg = CONFIG[key];
  if (!cfg) return;

  const el = document.querySelector(cfg.selector);
  if (!el) return;

  bar.setPointerCapture(e.pointerId);
  bar.classList.add('dragging');
  document.body.classList.add('resizing');

  const startX = e.clientX;
  const startW = el.getBoundingClientRect().width;
  const direction = cfg.direction ?? 1;

  function onMove(ev) {
    if (ev.pointerId !== e.pointerId) return;
    const delta = ev.clientX - startX;
    const w = clamp(startW + delta * direction, cfg.min, cfg.max);
    el.style.width = w + 'px';
  }

  function onUp(ev) {
    if (ev && ev.pointerId !== e.pointerId) return;
    bar.releasePointerCapture(e.pointerId);
    bar.classList.remove('dragging');
    document.body.classList.remove('resizing');

    const saved = readSaved();
    saved[key] = el.getBoundingClientRect().width;
    writeSaved(saved);

    bar.removeEventListener('pointermove', onMove);
    bar.removeEventListener('pointerup', onUp);
    bar.removeEventListener('pointercancel', onUp);
  }

  bar.addEventListener('pointermove', onMove);
  bar.addEventListener('pointerup', onUp);
  bar.addEventListener('pointercancel', onUp);
}
