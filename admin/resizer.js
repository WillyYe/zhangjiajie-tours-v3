// 可拖拽调整面板宽度。支持三条分隔线：sidebar、preview、tree。
// 宽度持久化到 localStorage，刷新后自动恢复。

const STORAGE_KEY = 'admin-resizer-widths';

const CONFIG = {
  sidebar: { selector: '.sidebar', min: 180, max: 380, default: 248 },
  preview: { selector: '.preview', min: 300, max: 800, default: 460 },
  tree:    { selector: '.he-tree', min: 150, max: 360, default: 210 },
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
  bar.addEventListener('mousedown', onMouseDown);

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

function onMouseDown(e) {
  e.preventDefault();
  const bar = e.currentTarget;
  const key = bar.dataset.resizer;
  const cfg = CONFIG[key];
  if (!cfg) return;

  const el = document.querySelector(cfg.selector);
  if (!el) return;

  const startX = e.clientX;
  const startW = el.getBoundingClientRect().width;
  bar.classList.add('dragging');

  // 全屏遮罩避免鼠标移出窗口时丢失事件，同时显示 resize 光标
  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;z-index:2000;cursor:col-resize;';
  document.body.appendChild(mask);

  function onMove(ev) {
    const delta = ev.clientX - startX;
    const w = clamp(startW + delta, cfg.min, cfg.max);
    el.style.width = w + 'px';
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    window.removeEventListener('mouseup', onUp);
    mask.removeEventListener('mouseup', onUp);
    bar.classList.remove('dragging');
    mask.remove();

    const saved = readSaved();
    saved[key] = el.getBoundingClientRect().width;
    writeSaved(saved);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  window.addEventListener('mouseup', onUp);
  mask.addEventListener('mouseup', onUp);
}
