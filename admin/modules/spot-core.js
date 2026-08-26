// spot-core.js — 参数化「景点 / 体验」详情页编辑器核心
//
// 一套代码服务 attractions 与 experiences 两个模块（schema 相同，仅模板与预览类型不同）。
// 达到酒店模块标准：左扁平树（隐藏/删除/新增/拖拽排序/灰显）｜中 schema 驱动表单（覆盖全部嵌套字段）｜右 iframe srcdoc 实时预览（复用真实模板 + scripts/fragments.mjs 共享片段，所见即所得）。
//
// 图片为根目录扁平存储 images/<name>.webp（与现有站点约定一致），提供根级图库浏览 + 上传。
//
// 浏览器 ESM：import 语句的相对路径按「本模块文件」解析（admin/modules/spot-core.js → ../../ 落到仓库根，正确）。
// 但运行时 fetch() 的相对路径是按「文档基准 location.href = admin/index.html」解析的，admin/ 只深 1 层，
// 故 fetch('../../...') 在 GitHub Pages 子目录部署(/zhangjiajie-tours-v3/)下会多上一级、越出仓库落到用户名根 → 404。
// 因此下方 loadTemplate 用 new URL('../../'+template, import.meta.url) 把相对路径改回按模块文件解析，本地/子目录部署都成立。

import * as Fragments from '../../scripts/fragments.mjs';
import { applyNav } from './nav-render.js';
import { applyIndexNav, buildIndexNav } from '../../scripts/index-nav.mjs';
import { siteNav } from '../../home-data.mjs';
import { hotelCategories } from '../../hotels-data.mjs';
import { getFile, putFile, putImage, getFileSha, listDir, deleteFile } from '../github.js';
import { bindResizer, initResizers } from '../resizer.js';
import { withPv } from '../pv-anchor.js';

const imgName = Fragments.imgName;

// ---------- DOM helpers ----------
function el(tag, attrs = {}, children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'dataset') { for (const [dk, dv] of Object.entries(v)) e.dataset[dk] = dv; }
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  if (children != null) {
    const arr = Array.isArray(children) ? children : [children];
    for (const c of arr) if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}
function iconBtn(icon, title, handler) {
  return el('button', { class: 'he-act', type: 'button', title, text: icon, onclick: (e) => { e.stopPropagation(); handler(); } });
}
function fieldRow(label, input, tip) {
  return el('div', { class: 'field' }, [
    el('label', {}, [label, tip ? el('span', { class: 'tip', text: ' ' + tip }) : null]),
    input,
  ]);
}
function notify(msg, type) {
  if (typeof window !== 'undefined' && typeof window.__adminToast === 'function') window.__adminToast(msg, type);
  else console.log('[spot] ' + msg);
}

import { SCHEMA, findSpotImageReferences } from './spot-refs.js';

// ---------- 图片库（根目录 images/）----------
let _imgLibModal = null;
let _imgLibListEl = null;
let _imgLibLoading = false;
// 当前图库所在子目录（'' = 根 images/；'experiences' = 隔离图库 images/experiences/）
let _imgLibBase = '';
// 当前图库已有的图片名（不含扩展名），用于上传后同步静态清单
let _imgLibNames = [];
// 刚刚上传图片的 objectURL 映射（内存级即时预览，不依赖 Pages 部署），避免"上传成功但图库看不到"
let _justUploaded = {};
// 当前模块的全部 spots 数据（删除前引用检查用它扫描所有 type:'image' 字段，防前台破图）
let _imgLibSpots = [];
// 打开图库时选中的字段名 + 状态条 DOM（删除反馈复用上传状态条）
let _imgLibCurrentName = '';
let _imgLibStatus = null;

// 隔离图库（imgBase 非空）与酒店模块同构：优先读静态清单 admin/imglib/<base>.json（秒开、免 API），
// 清单缺失时回落到 GitHub listDir。根图库（景点）保持原有 listDir 行为不变。
const LIB_BASE = 'admin/imglib/';
async function loadLibNames(folder) {
  if (_imgLibBase) {
    try {
      const res = await fetch(new URL('../imglib/' + _imgLibBase + '.json', import.meta.url));
      if (res.ok) {
        const arr = await res.json();
        if (Array.isArray(arr) && arr.length) return arr.map((n) => (/\.[a-z0-9]+$/i.test(n) ? n : n + '.webp'));
      }
    } catch (e) { /* 回落 listDir */ }
  }
  return await listDir(folder);
}

// 上传/删除后把静态清单同步回仓库，避免下次打开还是旧列表（与酒店 syncHotelList 同构）
async function syncLibList(names) {
  if (!_imgLibBase) return;
  const path = LIB_BASE + _imgLibBase + '.json';
  const content = JSON.stringify([...new Set(names)].sort(), null, 2) + '\n';
  const sha = await getFileSha(path);
  await putFile(path, content, sha, `Update ${_imgLibBase} image list via admin`);
}

async function ensureImageList(currentName) {
  if (_imgLibLoading) return;
  _imgLibLoading = true;
  _imgLibCurrentName = currentName || '';
  const folder = 'images' + (_imgLibBase ? '/' + _imgLibBase : '');
  try {
    const names = await loadLibNames(folder);
    const webps = names.filter((n) => /\.(webp|jpg|jpeg|avif|png)$/i.test(n));
    // 合并：保留本次会话刚上传、但 Pages 尚未部署导致清单里还没有的名字，避免刷新后"刚传的图消失"
    _imgLibNames = Array.from(new Set([...webps.map((n) => n.replace(/\.(webp|jpg|jpeg|avif|png)$/i, '')), ...Object.keys(_justUploaded)]));
    renderLibGrid(currentName);
  } catch (e) {
    _imgLibListEl.replaceChildren(el('p', { class: 'hint', text: '加载图库失败：' + e.message }));
  } finally {
    _imgLibLoading = false;
  }
}

// 用内存中的 _imgLibNames 直接渲染网格（删除后立即反映，不重新 fetch 清单，避免 Pages 部署延迟导致陈旧显示）
function renderLibGrid(currentName, instant) {
  if (!_imgLibListEl) return;
  _imgLibListEl.replaceChildren();
  if (!_imgLibNames.length) {
    _imgLibListEl.append(el('p', { class: 'hint', text: '图库为空，点「上传选中文件到图库」添加' }));
    return;
  }
  const thumbBase = '../images/' + (_imgLibBase ? _imgLibBase + '/' : '');
  // 数据里 heroImg 等字段可能带扩展名，列表项是去扩展名的，必须两边都归一化，否则"当前已选图"匹配不上
  const cur = String(currentName || '').replace(/\.(webp|jpg|jpeg|avif|png)$/i, '');
  let selectedEl = null;
  for (const name of _imgLibNames) {
    const isSel = !!cur && name === cur;
    const justAdded = (instant && instant[name]) || _justUploaded[name];
    const card = el('div', { class: 'img-lib-item' + (isSel ? ' selected' : '') + (justAdded ? ' just-added' : ''), onclick: () => _imgLibPick && _imgLibPick(name) }, [
      el('img', { src: justAdded || (thumbBase + name + '.webp'), alt: name, loading: 'lazy', onerror: (e) => { if (!justAdded) e.target.style.visibility = 'hidden'; } }),
      el('span', { class: 'img-lib-name', text: name }),
    ]);
    // 根库（imgBase 为空 = 根 images/）也允许删除：delete 前由 findAllReferences 做引用检查
    // （扫描本模块全部 spot 的 image 字段 + 首页 index.html 的 images/<base>/ 引用），
    // 仅当确无任何引用才放行，运营可安全清理历史孤儿图而绝不破前台（A）。
    card.append(el('button', {
      type: 'button', class: 'img-lib-del', title: '删除', text: '🗑',
      onclick: (e) => { e.stopPropagation(); confirmDelete(name); },
    }));
    if (isSel) selectedEl = card;
    _imgLibListEl.append(card);
  }
  if (selectedEl) requestAnimationFrame(() => selectedEl.scrollIntoView({ block: 'center', behavior: 'smooth' }));
}

// 综合引用检查：① 本模块全部 spots 的 image 字段（防破详情页）；② 首页 index.html 的
// <img src="images/[base/]name.webp">（防破首页静态区块 / Top 8 网格）。任一命中即拦截删除。
async function findAllReferences(name) {
  const refs = [];
  if (_imgLibSpots && _imgLibSpots.length) {
    refs.push(...findSpotImageReferences(_imgLibSpots, name));
  }
  refs.push(...await findIndexImageReferences(name, _imgLibBase));
  return refs;
}

// 扫描首页 index.html 里 `images/<base>/<name>.webp`（base 为空=根库）的直接引用。
// 后台只读 fetch 线上 index.html，命中即视为被前台引用 → 删除时拦截，避免破图。
const _IDX_IMG_RE = /src=["']images\/((?:[a-z0-9_-]+)\/)?([a-zA-Z0-9_-]+)\.(?:webp|jpg|jpeg|png|avif)["']/gi;
async function findIndexImageReferences(name, base) {
  const target = String(name).replace(/\.(webp|jpg|jpeg|avif|png)$/i, '');
  try {
    const res = await fetch(new URL('../../index.html', import.meta.url));
    if (!res.ok) return [];
    const html = await res.text();
    _IDX_IMG_RE.lastIndex = 0;
    const refs = [];
    let m;
    while ((m = _IDX_IMG_RE.exec(html))) {
      const sub = m[1] ? m[1].replace(/\/$/, '') : '';
      if (sub !== (base || '')) continue;
      if (m[2] !== target) continue;
      const ctx = html.slice(Math.max(0, m.index - 240), m.index);
      const altM = /alt=["']([^"']{0,40})/i.exec(ctx);
      refs.push('首页 index.html（' + (altM ? altM[1] : m[2]) + '）');
    }
    return refs;
  } catch (e) { return []; }
}

// 删除单张图：先引用检查（防破图），再二次确认，最后删 GitHub 文件 + 同步清单 + 重渲染
async function confirmDelete(name) {
  const refs = await findAllReferences(name);
  if (refs.length) {
    const shown = refs.slice(0, 5).join('、') + (refs.length > 5 ? ' 等' : '');
    setStatus(_imgLibStatus, `⚠️ 无法删除：${name}.webp 正被引用（${shown}）。删除会导致前台破图。`, 'err');
    return;
  }
  if (!confirm(
    `确认删除 ${name}.webp？\n\n` +
    `⚠️ 一级删除图片的风险约束：\n` +
    `1. 不可恢复：删除后 GitHub 仓库中该文件立即移除，无法通过“撤销”恢复；\n` +
    `2. 引用检查：系统已自动检查本模块详情页及首页 index.html，若该图正被引用会拦截本次删除；\n` +
    `3. 破图风险：若绕过检查或后续误改引用路径，可能导致前台破图，需重新上传同名图片或修复引用。\n\n` +
    `确定要继续删除吗？`
  )) return;
  try {
    setStatus(_imgLibStatus, '删除中…', 'info');
    const path = `images/${_imgLibBase ? _imgLibBase + '/' : ''}${name}.webp`;
    const sha = await getFileSha(path);
    if (!sha) { setStatus(_imgLibStatus, `文件不存在：${path}`, 'err'); return; }
    await deleteFile(path, sha, `Delete ${name}.webp via admin`);
    const newNames = _imgLibNames.filter((n) => n !== name);
    await syncLibList(newNames);
    _imgLibNames = newNames;
    renderLibGrid(_imgLibCurrentName);
    setStatus(_imgLibStatus, `已删除 ${name}.webp`, 'ok');
  } catch (e) {
    setStatus(_imgLibStatus, '删除失败：' + e.message, 'err');
    notify('删除失败：' + e.message, 'err');
  }
}

export function openImageLibrary(currentName, onPick, base, spots) {
  _imgLibBase = base || '';
  // 显式传入引用检查数据源：spot 类模块由 renderForm 已填 _imgLibSpots；
  // top-attractions 无 spot 数据，传 [] 避免误用其它模块残留数据，仅靠首页 index.html 扫描保护。
  if (spots !== undefined) _imgLibSpots = spots;
  if (!_imgLibModal) {
    const mask = el('div', { class: 'modal-mask', 'data-modal': 'img-lib', hidden: true });
    const panel = el('div', { class: 'modal modal-wide' });
    const closeBtn = el('button', { type: 'button', class: 'icon-btn', text: '✕', onclick: () => (mask.hidden = true) });
    const header = el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-icon', text: '🖼' }),
      el('div', {}, [el('h2', { text: '选择图片' }), el('p', { class: 'modal-subtitle', id: 'spotLibSubtitle', text: _imgLibBase ? `本模块图片库 · images/${_imgLibBase}/（仅显示本模块图片）` : '根目录 images/ 图库（历史共享图，删除前会检查是否被前台引用）' })]),
      closeBtn,
    ]);
    const fileInput = el('input', { type: 'file', accept: 'image/*', class: 'img-upload-input' });
    const uploadBtn = el('button', { type: 'button', class: 'btn btn-primary', text: '上传选中文件到图库' });
    const uploadStatus = el('div', { class: 'img-lib-status', hidden: true });
    const progress = el('div', { class: 'upload-progress', hidden: true }, [el('div', { class: 'upload-progress-bar' })]);
    const listEl = el('div', { class: 'img-lib-grid' });
    function setProgress(pct) {
      progress.hidden = !(pct > 0);
      const bar = progress.firstChild;
      if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
    }
    uploadBtn.addEventListener('click', async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) { setStatus(uploadStatus, '请先选择一个图片文件', 'err'); return; }
      if (uploadBtn.disabled) return; // 防止连点重复上传
      uploadBtn.disabled = true;
      try {
        setProgress(15);
        setStatus(uploadStatus, '① 正在把图片转换为 webp…', 'info');
        const blob = await fileToWebp(f);
        setProgress(45);
        setStatus(uploadStatus, '② 转换完成，正在上传到 GitHub…', 'info');
        const base = (f.name || 'image').replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const name = base || ('img-' + Date.now());
        await putImage('images/' + (_imgLibBase ? _imgLibBase + '/' : '') + name + '.webp', blob, null, 'Upload image via admin');
        setProgress(80);
        setStatus(uploadStatus, '③ 已上传，正在同步图库清单…', 'info');
        // 乐观即时更新：直接把新图加入内存列表并立即渲染，不等 Pages 部署（解决"上传成功但图库看不到"）
        if (!_imgLibNames.includes(name)) _imgLibNames = [..._imgLibNames, name];
        _justUploaded[name] = URL.createObjectURL(blob);
        renderLibGrid(_imgLibCurrentName, { [name]: _justUploaded[name] });
        if (_imgLibBase) await syncLibList(_imgLibNames);
        setProgress(100);
        setStatus(uploadStatus, `✓ 已上传 ${name}.webp 并加入图库（当前为上传原图即时预览；GitHub Pages 部署约 1–3 分钟后缩略图也会稳定显示）`, 'ok');
        fileInput.value = '';
      } catch (e) {
        setProgress(0);
        setStatus(uploadStatus, '上传失败：' + e.message, 'err');
        notify('上传失败：' + e.message, 'err');
      } finally {
        uploadBtn.disabled = false;
        setTimeout(() => setProgress(0), 1600);
      }
    });
    const refreshBtn = el('button', { type: 'button', class: 'btn btn-sm btn-ghost', text: '🔄 刷新图库' });
    refreshBtn.addEventListener('click', async () => {
      setStatus(uploadStatus, '刷新中…', 'info');
      try { await ensureImageList(_imgLibCurrentName); setStatus(uploadStatus, '已刷新图库列表', 'ok'); }
      catch (e) { setStatus(uploadStatus, '刷新失败：' + e.message, 'err'); }
    });
    const actions = el('div', { class: 'modal-actions' }, [refreshBtn, uploadBtn]);
    panel.append(header, el('div', { class: 'modal-body' }, [fileInput, progress, uploadStatus, listEl]), actions);
    mask.append(panel);
    mask.addEventListener('click', (e) => { if (e.target === mask) mask.hidden = true; });
    document.body.append(mask);
    _imgLibModal = mask;
    _imgLibListEl = listEl;
    _imgLibStatus = uploadStatus; // 删除反馈复用上传状态条（之前漏赋，导致删除无提示/被引用拦截静默失效）
  }
  // 副标题必须每次打开都刷新：同一弹窗被景点（根图库）与体验（隔离图库）复用
  const sub = _imgLibModal.querySelector('#spotLibSubtitle');
  if (sub) sub.textContent = _imgLibBase
    ? `本模块图片库 · images/${_imgLibBase}/（仅显示本模块图片）`
    : '根目录 images/ 图库（历史共享图，删除前会检查是否被前台引用）';
  // 选图后：关闭弹窗，由字段侧回调把缩略图滚到视野并高亮，做到"直接跳到对应图片并显示出来"
  _imgLibPick = (name) => {
    _imgLibModal.hidden = true;
    onPick(name);
  };
  _imgLibModal.hidden = false;
  ensureImageList(currentName);
}

let _imgLibPick = null;

function setStatus(box, msg, type) {
  if (!box) return;
  box.hidden = !msg;
  box.textContent = msg || '';
  box.className = 'img-lib-status' + (type ? ' ' + type : '');
}

function fileToWebp(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1600;
      let { width, height } = img;
      if (width > max || height > max) {
        const r = Math.min(max / width, max / height);
        width = Math.round(width * r); height = Math.round(height * r);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('WebP 转换失败'))), 'image/webp', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片读取失败')); };
    img.src = url;
  });
}

// ---------- 单值字段编辑器 ----------
function renderField(parent, obj, field, onChange, imgPrefix, imgBase) {
  const key = field.key;
  let row;
  if (field.type === 'text') {
    const input = el('input', { type: 'text', value: obj[key] == null ? '' : String(obj[key]) });
    input.addEventListener('input', () => { obj[key] = input.value; onChange(); });
    row = fieldRow(field.label, input, field.tip);
  } else if (field.type === 'textarea') {
    const ta = el('textarea', {}, obj[key] == null ? '' : String(obj[key]));
    ta.addEventListener('input', () => { obj[key] = ta.value; onChange(); });
    row = fieldRow(field.label, ta, field.tip);
  } else if (field.type === 'checkbox') {
    row = el('label', { class: 'check-row' }, [
      (() => { const c = el('input', { type: 'checkbox' }); c.checked = !!obj[key]; c.addEventListener('change', () => { obj[key] = c.checked; onChange(); }); return c; })(),
      el('span', { text: field.label + (field.tip ? '（' + field.tip + '）' : '') }),
    ]);
  } else if (field.type === 'image') {
    row = renderImageField(obj, key, onChange, field.label, field.tip, imgPrefix, imgBase);
  } else if (field.type === 'json') {
    const text = JSON.stringify(obj[key] == null ? {} : obj[key], null, 2);
    const ta = el('textarea', { class: 'json-area' }, text);
    const status = el('div', { class: 'img-lib-status', hidden: true });
    ta.addEventListener('input', () => {
      try {
        obj[key] = JSON.parse(ta.value);
        setStatus(status, '', '');
        onChange();
      } catch (e) {
        setStatus(status, 'JSON 解析失败：' + e.message, 'err');
      }
    });
    row = fieldRow(field.label, el('div', {}, [ta, status]), field.tip);
  } else if (field.type === 'object') {
    const sub = el('fieldset', { class: 'sub-fields' }, [el('legend', { text: field.label })]);
    const target = obj[key] == null || typeof obj[key] !== 'object' ? (obj[key] = {}) : obj[key];
    for (const sf of field.fields) renderField(sub, target, sf, onChange, imgPrefix, imgBase);
    row = sub;
  } else if (field.type === 'list') {
    row = renderListField(obj, key, field, onChange, imgPrefix, imgBase);
  }
  // 字段 → 预览跳转：field.pv 声明了 mode/anchor 才挂跳转（点击标签/缩略图跳到对应卡片或详情）
  if (row) parent.append(withPv(row, field));
}

function renderImageField(obj, key, onChange, label, tip, imgPrefix, imgBase) {
  const val = obj[key] || '';
  const thumb = el('img', { class: 'img-thumb', alt: '' });
  const updateThumb = () => {
    if (obj[key]) { thumb.src = '../images/' + (imgPrefix || '') + imgName(obj[key]); thumb.classList.remove('img-broken'); }
    else { thumb.removeAttribute('src'); thumb.classList.add('img-broken'); }
  };
  updateThumb();
  thumb.addEventListener('error', () => thumb.classList.add('img-broken'));
  const input = el('input', { type: 'text', value: val, placeholder: '图片名（不含扩展名），如 tianzi-autumn' });
  input.addEventListener('input', () => { obj[key] = input.value.trim(); updateThumb(); onChange(); });
  // 选图后：回填 → 立刻显示缩略图 → 滚动到该字段并短暂高亮，避免运营人员选完不知道改了哪一处
  const jumpToThumb = () => {
    requestAnimationFrame(() => {
      thumb.scrollIntoView({ block: 'center', behavior: 'smooth' });
      thumb.classList.add('img-just-picked');
      setTimeout(() => thumb.classList.remove('img-just-picked'), 1400);
    });
  };
  const browse = el('button', { type: 'button', class: 'btn btn-sm', text: '浏览图库', onclick: () => openImageLibrary(obj[key], (name) => { input.value = name; obj[key] = name; updateThumb(); jumpToThumb(); onChange(); }, imgBase) });
  // 根库入口：景点/体验历史共享图（images/ 根目录）也需可管理（清理孤儿图），故每个 image 字段旁提供根库浏览。
  const browseRoot = el('button', { type: 'button', class: 'btn btn-sm btn-ghost', title: '浏览根目录 images/ 历史图库（景点与体验共用，含可清理的孤儿图）', text: '🌐 根库', onclick: () => openImageLibrary(obj[key], (name) => { input.value = name; obj[key] = name; updateThumb(); jumpToThumb(); onChange(); }, '') });
  const clear = el('button', { type: 'button', class: 'btn btn-sm btn-ghost', text: '清空', onclick: () => { input.value = ''; obj[key] = ''; updateThumb(); onChange(); } });
  return fieldRow(label, el('div', { class: 'img-field' }, [
    thumb,
    el('div', { class: 'img-field-row' }, [input, el('div', { class: 'img-field-btns' }, [browse, browseRoot, clear])]),
  ]), tip);
}

function renderListField(obj, key, field, onChange, imgPrefix, imgBase) {
  if (!Array.isArray(obj[key])) obj[key] = [];
  const list = obj[key];
  const box = el('fieldset', { class: 'sub-fields' }, [el('legend', { text: field.label })]);
  const listEl = el('div', { class: 'list-items' });

  function renderItems() {
    listEl.replaceChildren();
    list.forEach((item, idx) => {
      const card = el('div', { class: 'list-item', draggable: true });
      const head = el('div', { class: 'list-item-head' }, [
        el('span', { class: 'list-grip', text: '⠿' }),
        el('span', { class: 'list-idx', text: '#' + (idx + 1) }),
        el('span', { class: 'list-item-title', text: listItemSummary(field.of, item) }),
      ]);
      const del = iconBtn('🗑', '删除该项', () => { list.splice(idx, 1); renderItems(); onChange(); });
      head.append(del);
      const body = el('div', { class: 'list-item-body' });
      if (field.of.type === 'object') {
        for (const sf of field.of.fields) renderField(body, item, sf, onChange, imgPrefix, imgBase);
      } else {
        const scalarType = field.of.type;
        const input = scalarType === 'textarea'
          ? el('textarea', {}, item == null ? '' : String(item))
          : el('input', { type: 'text', value: item == null ? '' : String(item) });
        input.addEventListener('input', () => { list[idx] = input.value; onChange(); });
        body.append(fieldRow('', input));
      }
      const up = iconBtn('↑', '上移', () => { if (idx > 0) { list.splice(idx, 1); list.splice(idx - 1, 0, item); renderItems(); onChange(); } });
      const down = iconBtn('↓', '下移', () => { if (idx < list.length - 1) { list.splice(idx, 1); list.splice(idx + 1, 0, item); renderItems(); onChange(); } });
      head.append(up, down);
      card.append(head, body);
      // drag reorder
      card.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', String(idx)));
      card.addEventListener('dragover', (e) => e.preventDefault());
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        const src = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (!isNaN(src) && src !== idx) { const [x] = list.splice(src, 1); list.splice(idx, 0, x); renderItems(); onChange(); }
      });
      listEl.append(card);
    });
    if (!list.length) listEl.append(el('p', { class: 'hint', text: '（暂无条目）' }));
  }
  renderItems();

  const addBtn = el('button', { type: 'button', class: 'btn btn-dashed', text: '+ 添加', onclick: () => {
    list.push(field.of.type === 'object' ? {} : '');
    renderItems(); onChange();
  } });
  box.append(listEl, addBtn);
  return box;
}

function listItemSummary(of, item) {
  if (of.type === 'object') {
    const f = (of.fields || []).find((x) => x.key === 'title' || x.key === 'q' || x.key === 'period' || x.key === 'item' || x.key === 'label' || x.key === 'name');
    const v = f ? item[f.key] : '';
    return v ? String(v).slice(0, 40) : (of.fields[0] ? '(空)' : '');
  }
  return String(item == null ? '' : item).slice(0, 40);
}

// ---------- 编辑器（左树 + 中表单）----------
export function createSpotEditor(config) {
  const { title, itemLabel, template, kind, imgBase } = config;
  const imgPrefix = imgBase ? imgBase + '/' : '';
  const ui = { slug: null, libOpen: false };

  function findItem(arr) { return arr.find((i) => i.slug === ui.slug); }

  function renderEditor(container, arr, onChange, onSelect) {
    container.replaceChildren();
    if (!arr || !arr.length) {
      container.append(el('div', { class: 'he-empty', text: '暂无' + itemLabel + '数据。' }));
      return;
    }
    if (!findItem(arr)) ui.slug = arr[0].slug;

    const wrap = el('div', { class: 'he' });
    const tree = el('div', { class: 'he-tree' });
    const treeResizer = el('div', { class: 'resizer', 'data-resizer': 'tree', title: '左右拖动调整分类树宽度' });
    bindResizer(treeResizer);
    const formHost = el('div', { class: 'he-form-host' });
    wrap.append(tree, treeResizer, formHost);
    container.append(wrap);
    initResizers();

    function renderTree() {
      tree.replaceChildren();
      tree.append(el('div', { class: 'he-tree-title', text: title }));
      arr.forEach((item, idx) => {
        const node = el('div', {
          class: 'he-tree-hotel' + (item.slug === ui.slug ? ' active' : '') + (item.hidden ? ' is-hidden' : ''),
          draggable: true,
          onclick: () => selectItem(item.slug),
          ondragstart: (e) => e.dataTransfer.setData('text/plain', String(idx)),
          ondragover: (e) => { e.preventDefault(); node.classList.add('drag-over'); },
          ondragleave: () => node.classList.remove('drag-over'),
          ondrop: (e) => {
            e.preventDefault(); node.classList.remove('drag-over');
            const src = parseInt(e.dataTransfer.getData('text/plain'), 10);
            if (!isNaN(src) && src !== idx) { const [x] = arr.splice(src, 1); arr.splice(idx, 0, x); onChange(); renderTree(); }
          },
        }, [
          el('span', { class: 'he-tree-hotel-zh', text: item.h1 || item.breadcrumb || item.slug }),
          el('span', { class: 'he-tree-hotel-en', text: item.slug }),
        ]);
        node.append(el('span', { class: 'he-tree-hotel-acts' }, [
          iconBtn(item.hidden ? '🚫' : '👁', item.hidden ? '显示' : '隐藏', () => { item.hidden = !item.hidden; onChange(); renderTree(); }),
          iconBtn('🗑', '删除', () => {
            if (!confirm(`确认删除「${item.h1 || item.slug}」？只删除数据、不删除图片。`)) return;
            const i = arr.indexOf(item); if (i >= 0) arr.splice(i, 1);
            if (ui.slug === item.slug) ui.slug = arr.length ? arr[0].slug : null;
            onChange(); renderTree(); renderForm();
          }),
        ]));
        tree.append(node);
      });
      // 图片库分组：独立入口，可直接管理本模块图片 / 删除图片（带引用检查）
      const libOpen = ui.libOpen;
      const libHead = el('div', { class: 'he-tree-cat-head' }, [
        el('span', { class: 'he-chevron', text: '▸', onclick: (e) => { e.stopPropagation(); ui.libOpen = !libOpen; renderTree(); } }),
        el('span', {
          class: 'he-tree-cat-name', text: '🖼 图片库',
          onclick: () => { ui.libOpen = !libOpen; renderTree(); },
        }),
      ]);
      const libCat = el('div', { class: 'he-tree-cat' + (libOpen ? ' open' : '') }, [libHead]);
      if (libOpen) {
        libCat.append(el('div', { class: 'he-tree-cat-body' }, [
          el('div', { class: 'he-tree-hint', text: `管理本模块图片库 images/${imgBase}/。删除前会检查是否被本模块详情页或首页引用——正被引用的图无法删除（防破图）。` }),
          el('button', {
            type: 'button', class: 'btn btn-primary', text: '🖼 打开图片库',
            onclick: () => openImageLibrary(null, () => {}, imgBase),
          }),
        ]));
      }
      tree.append(libCat);

      // 新增按钮
      const addBtn = el('button', { class: 'he-tree-add', type: 'button', text: '+ 新增' + itemLabel, onclick: () => {
        const slug = (prompt('新' + itemLabel + '的 slug（英文，如 new-spot）：') || '').trim().toLowerCase().replace(/\s+/g, '-');
        if (!slug) return;
        if (!/^[a-z0-9-]+$/.test(slug)) { notify('slug 仅含小写字母、数字和连字符', 'err'); return; }
        if (arr.some((i) => i.slug === slug)) { notify('该 slug 已存在', 'err'); return; }
        const neu = { slug, file: slug + '.html', title: itemLabel + ' ' + slug, metaDesc: '', canonical: 'https://willyye.github.io/zhangjiajie-tours-v3/' + (kind === 'experience' ? 'experiences' : 'attractions') + '/' + slug + '.html', heroImg: '', heroImgAlt: '', heroBgImg: '', breadcrumb: slug, h1: itemLabel, subtitle: '', heroIntro: '', tldr: '', introH2: '', introParas: [], highlightsIntro: '', highlights: [], routesIntro: '', routes: [], bestTime: { cards: [], note: '' }, tips: [], gettingThere: [], tickets: [], facts: [], localTip: '', galleryTitle: '', gallery: [], faqs: [], related: [], jsonld: { name: '', description: '', images: [], touristType: [], faq: [], howto: { name: '', steps: [] } } };
        arr.push(neu);
        ui.slug = slug; onChange(); renderTree(); renderForm();
        notify('已新增（未保存，点保存并发布后生效）', 'info');
      } });
      tree.append(addBtn);
    }

    function selectItem(slug) {
      ui.slug = slug;
      renderTree(); renderForm();
      if (onSelect) onSelect(slug);
    }

    function renderForm() {
      _imgLibSpots = arr; // 引用检查数据源：删除图时扫描本模块全部 spot 的 image 字段，防前台破图（C）
      formHost.replaceChildren();
      const item = findItem(arr);
      if (!item) { formHost.append(el('div', { class: 'he-empty', text: '请选择一项。' })); return; }
      formHost.append(el('div', { class: 'he-form-head' }, [
        el('div', { class: 'he-form-zh', text: item.h1 || item.slug }),
        el('div', { class: 'he-form-key', text: item.slug + (item.hidden ? ' · 已隐藏' : '') }),
      ]));
      for (const f of SCHEMA) renderField(formHost, item, f, () => { onChange(); }, imgPrefix, imgBase);
    }

    renderTree();
    renderForm();
  }

  // ---------- 预览（iframe srcdoc，复用真实模板 + 共享片段）----------
  // 单模块实例内仍用 config.template
  function loadTemplate() { return loadTemplateNamed(template); }
  async function renderPreview(container, arr, slug) {
    container.replaceChildren();
    const item = (arr || []).find((i) => i.slug === slug);
    if (!item) { container.append(el('div', { class: 'pv-empty', text: '请选择一项以预览。' })); return; }
    const iframe = el('iframe', { class: 'pv-iframe', title: '实时预览' });
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    container.append(iframe);
    try {
      const tpl = await loadTemplate();
      iframe.srcdoc = fillTemplate(tpl, item, kind);
    } catch (e) {
      container.replaceChildren(el('div', { class: 'pv-empty', text: '预览加载失败：' + e.message }));
    }
  }

  return { renderEditor, renderPreview, title, itemLabel, kind, template };
}

// ============================================================
// 模块级：详情页真实模板渲染（多模块复用，单一真源）
// ============================================================
// tplCache 模块级共享，key 为模板路径 → 多模块复用同一份缓存
const tplCache = {};
async function loadTemplateNamed(tplPath) {
  if (tplCache[tplPath]) return tplCache[tplPath];
  // 按本模块文件(admin/modules/spot-core.js)解析相对路径，而非文档基准(admin/index.html)。
  // 这样 ../../ 在「本地根部署」与「GitHub Pages 子目录部署」(/zhangjiajie-tours-v3/) 下都正确回到仓库根，
  // 避免请求越出仓库落到用户名根 → 404。参考 hotels.js:1471 同款写法。
  const url = new URL('../../' + tplPath, import.meta.url).href;
  const res = await fetch(url);
  if (!res.ok) throw new Error('模板加载失败 HTTP ' + res.status + ' @ ' + url);
  const t = await res.text();
  tplCache[tplPath] = t;
  return t;
}
function fillTemplate(tpl, item, k = 'attraction') {
  const cleaned = item.related ? { ...item, related: item.related } : item;
  const map = Fragments.buildPageMap(cleaned, k);
  let out = tpl;
  for (const [kk, v] of Object.entries(map)) out = out.split('{{' + kk + '}}').join(v);
  const jsonld = k === 'experience' ? Fragments.buildExperienceJsonLd(item) : Fragments.buildAttractionJsonLd(item);
  out = out.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    '<script type="application/ld+json">\n' + JSON.stringify(jsonld, null, 2) + '\n  </script>'
  );
  out = applyNav(out, siteNav, '../');
  out = applyIndexNav(out, buildIndexNav(hotelCategories, '../'));
  // 后台预览：srcdoc iframe 里必须立即看到内容，不能依赖模板里的 JS setTimeout + CSS transition。
  // 强制 .fade-in 元素处于最终可见状态，避免运营人员只看到 hero 渐变背景。
  out = out.replace(/<head\b[^>]*>/i, (m) => m + '<style id="admin-preview-no-fade">.fade-in,.fade-in.visible{opacity:1!important;transform:none!important;transition:none!important}</style>');
  const leftovers = [...out.matchAll(/\{\{[A-Z_]+\}\}/g)].map((m) => m[0]);
  if (leftovers.length) console.warn('[spot-preview] leftover placeholders:', [...new Set(leftovers)].join(', '));
  return out;
}

// 供其它模块复用：用真实模板渲染某个 spot/experience 详情页（所见即所得）。
// 例如 Top 8 模块的「详情页」tab 直接复用，避免只 fetch 已部署页（只读、易过期、与后台数据漂移）。
export async function renderSpotDetailPreview(container, arr, slug, k = 'attraction', tplPath = 'templates/attraction-page.html') {
  container.replaceChildren();
  const item = (arr || []).find((i) => i.slug === slug);
  if (!item) { container.append(el('div', { class: 'pv-empty', text: '未找到 slug=' + slug + ' 的详情数据。' })); return; }
  const iframe = el('iframe', { class: 'pv-iframe', title: '实时预览 · ' + slug });
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = '0';
  container.append(iframe);
  try {
    const tpl = await loadTemplateNamed(tplPath);
    iframe.srcdoc = fillTemplate(tpl, item, k);
  } catch (e) {
    container.replaceChildren(el('div', { class: 'pv-empty', text: '预览加载失败：' + e.message }));
  }
}

// 收集一个数组所有引用到的根图片名（用于保存前校验死链；跳过 hidden 项）
export function collectImageNames(arr) {
  const names = [];
  const push = (n) => { if (n && !names.includes(n)) names.push(String(n).replace(/\.(webp|jpg|jpeg|avif|png)$/i, '')); };
  for (const it of arr || []) {
    if (it.hidden) continue;
    push(it.heroImg); push(it.heroBgImg);
    for (const h of it.highlights || []) push(h.img);
    for (const g of it.gallery || []) push(g.img);
    for (const r of it.related || []) push(r.img);
  }
  return names;
}
