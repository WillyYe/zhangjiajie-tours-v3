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
import { getFile, putFile, putImage, getFileSha, listDir } from '../github.js';
import { bindResizer, initResizers } from '../resizer.js';

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

// ---------- Schema（attractions 与 experiences 共用同一套字段骨架）----------
// type: text | textarea | image | checkbox | json | list | object
const SCHEMA = [
  { key: 'file', label: '文件名 file', type: 'text', tip: '生成页面的文件名，一般不动' },
  { key: 'slug', label: 'Slug（URL 路径）', type: 'text', tip: '地址栏路径，谨慎修改' },
  { key: 'title', label: 'SEO 标题 title', type: 'text', tip: '浏览器标签 / 分享卡片标题' },
  { key: 'metaDesc', label: 'Meta Description', type: 'textarea', tip: '搜索摘要，150 字内' },
  { key: 'canonical', label: 'Canonical URL', type: 'text', tip: '规范链接，一般不动' },
  { key: 'breadcrumb', label: '面包屑 breadcrumb', type: 'text' },
  { key: 'h1', label: 'H1 主标题', type: 'text' },
  { key: 'subtitle', label: '副标题 subtitle', type: 'text' },
  { key: 'heroImg', label: 'Hero 主图', type: 'image', tip: '根目录 images/<name>.webp' },
  { key: 'heroImgAlt', label: 'Hero Alt', type: 'text' },
  { key: 'heroBgImg', label: 'Hero 背景图', type: 'image' },
  { key: 'heroIntro', label: 'Hero 导语', type: 'textarea' },
  { key: 'tldr', label: '摘要 TL;DR', type: 'textarea' },
  { key: 'introH2', label: '导语 H2', type: 'text' },
  { key: 'introParas', label: '导语段落', type: 'list', of: { type: 'textarea' }, tip: '多条段落' },
  { key: 'highlightsIntro', label: '亮点导语', type: 'text' },
  { key: 'highlights', label: '亮点 Highlights', type: 'list', of: { type: 'object', fields: [
    { key: 'img', label: '图片', type: 'image' },
    { key: 'alt', label: 'Alt', type: 'text' },
    { key: 'title', label: '标题', type: 'text' },
    { key: 'sub', label: '副标', type: 'text' },
    { key: 'desc', label: '描述', type: 'textarea' },
  ] } },
  { key: 'routesIntro', label: '路线导语', type: 'text' },
  { key: 'routes', label: '路线 Routes', type: 'list', of: { type: 'object', fields: [
    { key: 'icon', label: '图标', type: 'text' },
    { key: 'title', label: '标题', type: 'text' },
    { key: 'sub', label: '副标', type: 'text' },
    { key: 'steps', label: '步骤', type: 'list', of: { type: 'object', fields: [
      { key: 'strong', label: '强调', type: 'text' },
      { key: 'text', label: '说明', type: 'textarea' },
    ] } },
  ] } },
  { key: 'bestTime', label: '最佳时间 Best Time', type: 'object', fields: [
    { key: 'cards', label: '时间卡片', type: 'list', of: { type: 'object', fields: [
      { key: 'icon', label: '图标', type: 'text' },
      { key: 'period', label: '时段', type: 'text' },
      { key: 'desc', label: '说明', type: 'textarea' },
    ] } },
    { key: 'note', label: '备注', type: 'textarea' },
  ] },
  { key: 'tips', label: '贴士 Tips', type: 'list', of: { type: 'object', fields: [
    { key: 'icon', label: '图标', type: 'text' },
    { key: 'title', label: '标题', type: 'text' },
    { key: 'desc', label: '描述', type: 'textarea' },
  ] } },
  { key: 'gettingThere', label: '到达方式', type: 'list', of: { type: 'object', fields: [
    { key: 'strong', label: '强调', type: 'text' },
    { key: 'text', label: '说明', type: 'textarea' },
  ] } },
  { key: 'tickets', label: '票务 Tickets', type: 'list', of: { type: 'object', fields: [
    { key: 'item', label: '项目', type: 'text' },
    { key: 'detail', label: '说明', type: 'textarea' },
  ] } },
  { key: 'facts', label: '事实 Facts', type: 'list', of: { type: 'object', fields: [
    { key: 'label', label: '标签', type: 'text' },
    { key: 'value', label: '值', type: 'text' },
  ] } },
  { key: 'localTip', label: '本地贴士', type: 'textarea' },
  { key: 'galleryTitle', label: '画廊标题', type: 'text' },
  { key: 'gallery', label: '画廊 Gallery', type: 'list', of: { type: 'object', fields: [
    { key: 'img', label: '图片', type: 'image' },
    { key: 'alt', label: 'Alt', type: 'text' },
  ] } },
  { key: 'faqs', label: 'FAQ', type: 'list', of: { type: 'object', fields: [
    { key: 'q', label: '问题', type: 'textarea' },
    { key: 'a', label: '答案', type: 'textarea' },
  ] } },
  { key: 'related', label: '相关推荐 Related', type: 'list', of: { type: 'object', fields: [
    { key: 'slug', label: 'Slug', type: 'text' },
    { key: 'img', label: '图片', type: 'image' },
    { key: 'alt', label: 'Alt', type: 'text' },
    { key: 'title', label: '标题', type: 'text' },
    { key: 'sub', label: '副标', type: 'text' },
  ] } },
  { key: 'geo', label: '地理坐标 Geo', type: 'object', fields: [
    { key: 'lat', label: '纬度 lat', type: 'text' },
    { key: 'lng', label: '经度 lng', type: 'text' },
  ] },
  { key: 'jsonld', label: '结构化数据 JSON-LD', type: 'json', tip: '机器可读 SEO 数据，谨慎修改' },
  { key: 'hidden', label: '隐藏（前台不生成该详情页）', type: 'checkbox', tip: '勾选后前台不生成、相关推荐也过滤掉它' },
];

// ---------- 图片库（根目录 images/）----------
let _imgLibModal = null;
let _imgLibListEl = null;
let _imgLibLoading = false;
// 当前图库所在子目录（'' = 根 images/；'experiences' = 隔离图库 images/experiences/）
let _imgLibBase = '';
// 当前图库已有的图片名（不含扩展名），用于上传后同步静态清单
let _imgLibNames = [];

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
  const folder = 'images' + (_imgLibBase ? '/' + _imgLibBase : '');
  const thumbBase = '../images/' + (_imgLibBase ? _imgLibBase + '/' : '');
  try {
    const names = await loadLibNames(folder);
    _imgLibListEl.replaceChildren();
    const webps = names.filter((n) => /\.(webp|jpg|jpeg|avif|png)$/i.test(n));
    _imgLibNames = webps.map((n) => n.replace(/\.(webp|jpg|jpeg|avif|png)$/i, ''));
    if (!webps.length) _imgLibListEl.append(el('p', { class: 'hint', text: '图库为空，可上传图片。' }));
    let selectedEl = null;
    // 数据里 heroImg 等字段可能带扩展名（yuanjiajie-avatar.webp），列表项是去扩展名的，
    // 必须两边都归一化，否则"当前已选图"永远匹配不上、定位失效。
    const cur = String(currentName || '').replace(/\.(webp|jpg|jpeg|avif|png)$/i, '');
    for (const n of webps) {
      const name = n.replace(/\.(webp|jpg|jpeg|avif|png)$/i, '');
      const isSel = !!cur && name === cur;
      const card = el('button', { class: 'img-lib-item' + (isSel ? ' selected' : ''), type: 'button', onclick: () => _imgLibPick && _imgLibPick(name) }, [
        el('img', { src: thumbBase + n, alt: name, loading: 'lazy', onerror: (e) => (e.target.style.visibility = 'hidden') }),
        el('span', { class: 'img-lib-name', text: name }),
      ]);
      if (isSel) selectedEl = card;
      _imgLibListEl.append(card);
    }
    // 选图后跳到对应图片：打开图库时把已选图片滚动到视野中央并显示出来
    if (selectedEl) requestAnimationFrame(() => selectedEl.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  } catch (e) {
    _imgLibListEl.replaceChildren(el('p', { class: 'hint', text: '加载图库失败：' + e.message }));
  } finally {
    _imgLibLoading = false;
  }
}

function openImageLibrary(currentName, onPick, base) {
  _imgLibBase = base || '';
  if (!_imgLibModal) {
    const mask = el('div', { class: 'modal-mask', 'data-modal': 'img-lib', hidden: true });
    const panel = el('div', { class: 'modal modal-wide' });
    const closeBtn = el('button', { type: 'button', class: 'icon-btn', text: '✕', onclick: () => (mask.hidden = true) });
    const header = el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-icon', text: '🖼' }),
      el('div', {}, [el('h2', { text: '选择图片' }), el('p', { class: 'modal-subtitle', id: 'spotLibSubtitle', text: _imgLibBase ? `本模块图片库 · images/${_imgLibBase}/（仅显示本模块图片）` : '根目录 images/ 图库（景点与体验共用）' })]),
      closeBtn,
    ]);
    const fileInput = el('input', { type: 'file', accept: 'image/*', class: 'img-upload-input' });
    const uploadBtn = el('button', { type: 'button', class: 'btn btn-primary', text: '上传选中文件到图库' });
    const uploadStatus = el('div', { class: 'img-lib-status', hidden: true });
    const listEl = el('div', { class: 'img-lib-grid' });
    uploadBtn.addEventListener('click', async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) { setStatus(uploadStatus, '请先选择一个图片文件', 'err'); return; }
      try {
        setStatus(uploadStatus, '转换并上传中…', 'info');
        const blob = await fileToWebp(f);
        const base = (f.name || 'image').replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const name = base || ('img-' + Date.now());
        await putImage('images/' + (_imgLibBase ? _imgLibBase + '/' : '') + name + '.webp', blob, null, 'Upload image via admin');
        setStatus(uploadStatus, '已上传 images/' + (_imgLibBase ? _imgLibBase + '/' : '') + name + '.webp', 'ok');
        if (_imgLibBase) await syncLibList([..._imgLibNames, name]);
        await ensureImageList();
      } catch (e) {
        setStatus(uploadStatus, '上传失败：' + e.message, 'err');
      }
    });
    const actions = el('div', { class: 'modal-actions' }, [uploadBtn]);
    panel.append(header, el('div', { class: 'modal-body' }, [fileInput, uploadStatus, listEl]), actions);
    mask.append(panel);
    mask.addEventListener('click', (e) => { if (e.target === mask) mask.hidden = true; });
    document.body.append(mask);
    _imgLibModal = mask;
    _imgLibListEl = listEl;
  }
  // 副标题必须每次打开都刷新：同一弹窗被景点（根图库）与体验（隔离图库）复用
  const sub = _imgLibModal.querySelector('#spotLibSubtitle');
  if (sub) sub.textContent = _imgLibBase
    ? `本模块图片库 · images/${_imgLibBase}/（仅显示本模块图片）`
    : '根目录 images/ 图库（景点与体验共用）';
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
  if (field.type === 'text') {
    const input = el('input', { type: 'text', value: obj[key] == null ? '' : String(obj[key]) });
    input.addEventListener('input', () => { obj[key] = input.value; onChange(); });
    parent.append(fieldRow(field.label, input, field.tip));
  } else if (field.type === 'textarea') {
    const ta = el('textarea', {}, obj[key] == null ? '' : String(obj[key]));
    ta.addEventListener('input', () => { obj[key] = ta.value; onChange(); });
    parent.append(fieldRow(field.label, ta, field.tip));
  } else if (field.type === 'checkbox') {
    const wrap = el('label', { class: 'check-row' }, [
      (() => { const c = el('input', { type: 'checkbox' }); c.checked = !!obj[key]; c.addEventListener('change', () => { obj[key] = c.checked; onChange(); }); return c; })(),
      el('span', { text: field.label + (field.tip ? '（' + field.tip + '）' : '') }),
    ]);
    parent.append(wrap);
  } else if (field.type === 'image') {
    parent.append(renderImageField(obj, key, onChange, field.label, field.tip, imgPrefix, imgBase));
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
    parent.append(fieldRow(field.label, el('div', {}, [ta, status]), field.tip));
  } else if (field.type === 'object') {
    const sub = el('fieldset', { class: 'sub-fields' }, [el('legend', { text: field.label })]);
    const target = obj[key] == null || typeof obj[key] !== 'object' ? (obj[key] = {}) : obj[key];
    for (const sf of field.fields) renderField(sub, target, sf, onChange, imgPrefix, imgBase);
    parent.append(sub);
  } else if (field.type === 'list') {
    parent.append(renderListField(obj, key, field, onChange, imgPrefix, imgBase));
  }
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
  const clear = el('button', { type: 'button', class: 'btn btn-sm btn-ghost', text: '清空', onclick: () => { input.value = ''; obj[key] = ''; updateThumb(); onChange(); } });
  return fieldRow(label, el('div', { class: 'img-field' }, [
    thumb,
    el('div', { class: 'img-field-row' }, [input, el('div', { class: 'img-field-btns' }, [browse, clear])]),
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
  const ui = { slug: null };

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
