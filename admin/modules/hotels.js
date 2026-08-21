// Hotels 模块：三级分级编辑器 + 实时预览 + 图片库。
// 一级 分类 / 二级 酒店 / 三级 编辑表单。
// 编辑直接 mutate 传入的 hotels 对象（app.js 持有引用，保存时整体序列化）。

import { getFileSha, putImage, deleteFile, putFile } from '../github.js';
import { bindResizer, initResizers } from '../resizer.js';

// 图片基准路径：相对本模块（admin/modules/）→ 仓库根 images/。
// 物理隔离：每家酒店图片位于 images/<slug>/，用 import.meta.url 解析避免路径误判。
const imgUrl = (slug, name) => new URL(`../../images/${slug}/`, import.meta.url).href + name + '.webp';

const FIELDS = [
  { key: 'name', label: '英文名 / Name', tip: '酒店英文名（用于英文页面）' },
  { key: 'zh', label: '中文名 / 名称', tip: '酒店中文名' },
  { key: 'area', label: '区域 / Area', tip: '所在区域，如 Wulingyuan Core' },
  { key: 'tier', label: '档次 / Tier', tip: '如 Boutique / Mountain Lodge / Value' },
  { key: 'img', label: '主图 / Image', tip: 'images/ 下的 webp 文件名（不含扩展名）' },
  { key: 'alt', label: '图片 alt 描述', tip: '英文 alt 文本，利于无障碍与 SEO' },
];

// 当前选中的 一级/二级/展开分类（UI 状态）
const ui = { catSlug: null, hotelKey: null, openCat: null, view: 'hotel', faqOpen: true, otherOpen: true, detailOpen: true };

// 数组项上下移动（详情页 Rooms/Gallery/FAQ 排序用）
function moveItem(arr, i, dir) {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  const [x] = arr.splice(i, 1);
  arr.splice(j, 0, x);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c != null) node.append(c);
  return node;
}

function textField(field, value, onInput) {
  const input = el('input', {
    type: 'text',
    value: value ?? '',
    oninput: (e) => onInput(e.target.value),
  });
  return el('div', { class: 'field' }, [
    el('label', {}, [field.label, el('span', { class: 'tip', text: ' ' + field.tip })]),
    input,
  ]);
}

function longField(field, value, onInput) {
  const ta = el('textarea', { oninput: (e) => onInput(e.target.value) });
  ta.value = value ?? '';
  return el('div', { class: 'field' }, [
    el('label', {}, [field.label, el('span', { class: 'tip', text: ' ' + field.tip })]),
    ta,
  ]);
}

function featuresField(value, onChange) {
  const list = el('div', { class: 'features-list' });

  function renderRow(idx) {
    const input = el('input', {
      type: 'text',
      value: value[idx] ?? '',
      placeholder: '一条特色',
      oninput: (e) => {
        value[idx] = e.target.value;
        onChange();
      },
    });
    const del = el('button', {
      class: 'del',
      type: 'button',
      text: '×',
      onclick: () => {
        value.splice(idx, 1);
        list.replaceChildren(...value.map((_, i) => renderRow(i)));
        onChange();
      },
    });
    return el('div', { class: 'feature-row' }, [input, del]);
  }

  list.replaceChildren(...value.map((_, i) => renderRow(i)));

  const add = el('button', {
    class: 'add-feature',
    type: 'button',
    text: '+ 添加一条特色',
    onclick: () => {
      value.push('');
      list.replaceChildren(...value.map((_, i) => renderRow(i)));
      onChange();
    },
  });

  return el('div', { class: 'field' }, [
    el('label', {}, ['特色 / Features', el('span', { class: 'tip', text: ' 每条一行' })]),
    list,
    add,
  ]);
}

// 图片字段：缩略图 + 文本框 + 图片库浏览按钮
function imageField(field, value, onInput, hotels, categories, slug) {
  const thumbBox = el('div', { class: 'he-thumb-box' + (value ? '' : ' no-img') });
  const thumb = el('img', { class: 'he-thumb', src: value ? imgUrl(slug, value) : '' });
  thumb.addEventListener('error', () => thumbBox.classList.add('no-img'));
  thumb.addEventListener('load', () => thumbBox.classList.remove('no-img'));
  thumbBox.append(thumb);

  const input = el('input', {
    type: 'text',
    value: value ?? '',
    placeholder: 'webp 文件名（不含扩展名）',
    oninput: (e) => onInput(e.target.value),
  });

  const btn = el('button', {
    type: 'button',
    class: 'btn btn-sm btn-ghost',
    text: '🖼 浏览图片库',
    onclick: () => openImageLib(thumbBox, thumb, input, onInput, hotels, categories, slug),
  });

  const row = el('div', { class: 'img-field' }, [thumbBox, input, btn]);
  return el('div', { class: 'field' }, [
    el('label', {}, [field.label, el('span', { class: 'tip', text: ' ' + field.tip })]),
    row,
  ]);
}

// ---------- 图片库 modal（全局单例） ----------
let libModal = null;
let uploadModal = null;
// 当前图片库会话状态（跨函数共享）
let libState = { list: [], hotels: null, thumbBox: null, thumb: null, input: null, onInput: null };

function setStatus(node, msg, type) {
  node.textContent = msg || '';
  node.className = 'img-lib-status ' + (type || '');
  node.hidden = !msg;
}

function buildLibModal() {
  const mask = el('div', { class: 'modal-mask', hidden: true });
  const modal = el('div', { class: 'modal img-lib-modal' });
  const closeBtn = el('button', { type: 'button', class: 'icon-btn', style: 'margin-left:auto;font-size:18px', text: '✕', onclick: () => (mask.hidden = true) });
  const header = el('div', { class: 'modal-header' }, [
    el('div', { class: 'modal-icon', text: '🖼' }),
    el('div', {}, [
      el('h2', { text: '图片库' }),
      el('p', { class: 'modal-subtitle', id: 'libSubtitle', text: '本酒店图片库（images/<slug>/）· 可上传 / 删除' }),
    ]),
    closeBtn,
  ]);
  const search = el('input', { class: 'img-lib-search', type: 'text', placeholder: '🔍 搜索文件名…' });
  search.addEventListener('input', () => renderLibGrid(libState.input ? libState.input.value : ''));
  const uploadBtn = el('button', { type: 'button', class: 'btn btn-sm', text: '⬆ 上传图片', onclick: () => openUploadPanel() });
  const toolbar = el('div', { class: 'img-lib-toolbar' }, [search, uploadBtn]);
  const grid = el('div', { class: 'img-lib-grid' });
  const status = el('div', { class: 'img-lib-status', hidden: true });
  modal.append(header, toolbar, grid, status);
  mask.append(modal);
  mask.addEventListener('click', (e) => { if (e.target === mask) mask.hidden = true; });
  document.body.append(mask);
  return { mask, grid, toolbar, status };
}

// 扫描哪些酒店 / 分类引用了某张图（用于删除保护）
function findReferences(hotels, categories, name) {
  const refs = [];
  for (const [k, h] of Object.entries(hotels || {})) {
    if (h && typeof h === 'object' && h.img === name) {
      refs.push(h.zh || h.name || k);
    }
  }
  // 分类 hero 也可能复用该图（如 mountain-lodges 用 hetianye 主图），删除会破前台分类页
  for (const c of categories || []) {
    if (c && c.heroImg === name) refs.push('分类「' + (c.title || c.slug) + '」hero');
  }
  return refs;
}

const LIB_BASE = 'admin/imglib/';
// 把某酒店的图片清单写回仓库 admin/imglib/<slug>.json（保持排序；文件不存在则新建）
async function syncHotelList(slug, list) {
  const content = JSON.stringify([...list].sort(), null, 2) + '\n';
  const sha = await getFileSha(LIB_BASE + slug + '.json');
  await putFile(LIB_BASE + slug + '.json', content, sha, `Update ${slug} image list via admin`);
}

async function openImageLib(thumbBox, thumb, input, onInput, hotels, categories, slug) {
  if (!libModal) libModal = buildLibModal();
  libState = { list: [], hotels, categories, slug, thumbBox, thumb, input, onInput };
  libModal.grid.replaceChildren(el('div', { class: 'img-lib-loading', text: '加载中…' }));
  setStatus(libModal.status, '', '');
  const sub = libModal.mask.querySelector('#libSubtitle');
  if (sub) sub.textContent = `本酒店图片库 · images/${slug}/（仅显示 ${slug} 的图片）`;
  try {
    const res = await fetch(new URL(`../imglib/${slug}.json`, import.meta.url));
    libState.list = res.ok ? await res.json() : [];
    renderLibGrid(input.value);
  } catch (e) {
    libState.list = [];
    renderLibGrid(input.value);
  }
  libModal.mask.hidden = false;
}

function renderLibGrid(currentName) {
  const q = (libModal.toolbar.querySelector('.img-lib-search').value || '').toLowerCase().trim();
  const filtered = q ? libState.list.filter((n) => n.toLowerCase().includes(q)) : libState.list;
  libModal.grid.replaceChildren();
  if (!filtered.length) {
    libModal.grid.append(el('div', { class: 'img-lib-err', text: q ? '没有匹配的文件' : '图片库为空，点「上传图片」添加' }));
    return;
  }
  let selectedEl = null;
  for (const name of filtered) {
    const cell = el('div', { class: 'img-lib-item' + (name === currentName ? ' selected' : '') });
    const im = el('img', { src: imgUrl(libState.slug, name), loading: 'lazy', alt: name });
    im.addEventListener('error', () => cell.classList.add('broken'));
    const delBtn = el('button', {
      type: 'button',
      class: 'img-lib-del',
      title: '删除',
      text: '🗑',
      onclick: (e) => { e.stopPropagation(); confirmDelete(name); },
    });
    cell.append(im, el('span', { class: 'img-lib-name', text: name }), delBtn);
    cell.addEventListener('click', () => pickImage(name));
    libModal.grid.append(cell);
    if (name === currentName) selectedEl = cell;
  }
  // 选中定位：滚动到视野中央
  if (selectedEl) {
    requestAnimationFrame(() => selectedEl.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }
}

function pickImage(name) {
  const { input, thumb, thumbBox, onInput, slug } = libState;
  input.value = name;
  thumb.src = imgUrl(slug, name);
  thumbBox.classList.remove('no-img');
  onInput(name);
  libModal.mask.hidden = true;
}

async function confirmDelete(name) {
  const refs = findReferences(libState.hotels, libState.categories, name);
  if (refs.length) {
    setStatus(libModal.status, `⚠️ 无法删除：${name}.webp 正被引用（${refs.join('、')}）。删除会导致前台破图。`, 'err');
    return;
  }
  if (!confirm(`确认删除 ${name}.webp？此操作不可撤销。`)) return;
  setStatus(libModal.status, '删除中…', 'info');
  try {
    const path = `images/${libState.slug}/${name}.webp`;
    const sha = await getFileSha(path);
    if (!sha) {
      setStatus(libModal.status, `文件不存在：${path}`, 'err');
      return;
    }
    await deleteFile(path, sha, `Delete ${name}.webp via admin`);
    const newList = libState.list.filter((n) => n !== name);
    await syncHotelList(libState.slug, newList);
    libState.list = newList;
    renderLibGrid(libState.input.value);
    setStatus(libModal.status, `已删除 ${name}.webp`, 'ok');
  } catch (e) {
    setStatus(libModal.status, '删除失败：' + e.message, 'err');
  }
}

// ---------- 上传面板 ----------
function sanitizeName(raw) {
  return (raw || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/\.webp$/, '')
    .replace(/_{2,}/g, '_')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');
}

// 浏览器端把任意图片转成 webp（不缩放，保持原尺寸；webp 通常显著更小）
async function fileToWebp(file, quality = 0.92) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', quality));
  if (!blob) throw new Error('当前浏览器不支持 webp 编码');
  return { blob, w: bitmap.width, h: bitmap.height, ow: bitmap.width, oh: bitmap.height };
}

function buildUploadModal() {
  const mask = el('div', { class: 'modal-mask', hidden: true });
  const panel = el('div', { class: 'modal upload-modal' });
  const closeBtn = el('button', { type: 'button', class: 'icon-btn', style: 'margin-left:auto;font-size:18px', text: '✕', onclick: () => (mask.hidden = true) });
  const header = el('div', { class: 'modal-header' }, [
    el('div', { class: 'modal-icon', text: '⬆' }),
    el('div', {}, [
      el('h2', { text: '上传图片' }),
      el('p', { class: 'modal-subtitle', text: '选择本地图片，统一转换为 webp 后上传到 images/' }),
    ]),
    closeBtn,
  ]);
  const fileInput = el('input', { id: 'upFile', type: 'file', accept: 'image/*' });
  const previewImg = el('img', { class: 'upload-preview', hidden: true });
  const nameInput = el('input', { type: 'text', class: 'upload-name', placeholder: '文件名（不含扩展名）' });
  const meta = el('div', { class: 'upload-meta', text: '' });
  const status = el('div', { class: 'img-lib-status', hidden: true });
  const confirmBtn = el('button', { type: 'button', class: 'btn btn-primary', text: '转换并上传', disabled: true });
  const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost', text: '取消', onclick: () => (mask.hidden = true) });
  const actions = el('div', { class: 'modal-actions' }, [cancelBtn, confirmBtn]);
  panel.append(header, el('div', { class: 'modal-body' }, [
    el('label', { class: 'upload-label', text: '选择图片（jpg / png / webp …）' }),
    fileInput,
    previewImg,
    el('label', { class: 'upload-label', text: '文件名（自动净化，强制 .webp）' }),
    nameInput,
    meta,
    status,
  ]), actions);
  mask.append(panel);
  mask.addEventListener('click', (e) => { if (e.target === mask) mask.hidden = true; });
  document.body.append(mask);

  const state = { blob: null, finalName: '' };

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    setStatus(status, '正在转换…', 'info');
    try {
      const { blob, w, h, ow, oh } = await fileToWebp(file);
      previewImg.src = URL.createObjectURL(blob);
      previewImg.hidden = false;
      nameInput.value = sanitizeName(file.name.replace(/\.[^.]+$/, ''));
      const kb = (blob.size / 1024).toFixed(0);
      meta.textContent = `原图 ${ow}×${oh} → webp ${w}×${h}，约 ${kb} KB`;
      state.blob = blob;
      state.finalName = nameInput.value;
      confirmBtn.disabled = false;
      setStatus(status, '', '');
    } catch (e) {
      setStatus(status, '转换失败：' + e.message, 'err');
    }
  });

  nameInput.addEventListener('input', () => { state.finalName = nameInput.value; });
  confirmBtn.addEventListener('click', () => doUpload(state, { fileInput, previewImg, nameInput, meta, status, confirmBtn }));

  return { mask, panel };
}

function openUploadPanel() {
  if (!uploadModal) uploadModal = buildUploadModal();
  const m = uploadModal;
  const fileInput = m.panel.querySelector('#upFile');
  const previewImg = m.panel.querySelector('.upload-preview');
  const nameInput = m.panel.querySelector('.upload-name');
  const meta = m.panel.querySelector('.upload-meta');
  const status = m.panel.querySelector('.img-lib-status');
  const confirmBtn = m.panel.querySelector('.btn-primary');
  fileInput.value = '';
  previewImg.src = '';
  previewImg.hidden = true;
  nameInput.value = '';
  meta.textContent = '';
  setStatus(status, '', '');
  confirmBtn.disabled = true;
  m.mask.hidden = false;
}

async function doUpload(state, refs) {
  const raw = sanitizeName(state.finalName);
  if (!raw) { setStatus(refs.status, '请填写有效的文件名', 'err'); return; }
  if (!state.blob) { setStatus(refs.status, '请先选择图片', 'err'); return; }
  // 物理隔离：自动加 hotel-<slug>- 前缀，确保新图归入当前酒店图片库
  const prefix = `hotel-${libState.slug}-`;
  const finalName = raw.startsWith(prefix) ? raw : prefix + raw;
  const path = `images/${libState.slug}/${finalName}.webp`;
  setStatus(refs.status, '上传中…', 'info');
  refs.confirmBtn.disabled = true;
  try {
    const existingSha = await getFileSha(path);
    if (existingSha) {
      const ok = confirm(`images/${libState.slug}/${finalName}.webp 已存在，是否覆盖？`);
      if (!ok) { setStatus(refs.status, '已取消', 'info'); refs.confirmBtn.disabled = false; return; }
    }
    await putImage(path, state.blob, existingSha, `Upload ${finalName}.webp via admin`);
    const newList = libState.list.includes(finalName) ? libState.list : [...libState.list, finalName].sort();
    await syncHotelList(libState.slug, newList);
    libState.list = newList;
    renderLibGrid(libState.input.value);
    setStatus(refs.status, `已上传 ${finalName}.webp`, 'ok');
    setTimeout(() => { uploadModal.mask.hidden = true; }, 900);
  } catch (e) {
    setStatus(refs.status, '上传失败：' + e.message, 'err');
    refs.confirmBtn.disabled = false;
  }
}

// 由 categories 推导出 一级(分类) → 二级(酒店) 的映射，并把游离酒店归入「未分类」。
// 注意：保留对原始 cat 对象的引用（不拷贝），以便树操作直接 mutate 并随保存落盘。
function buildTiers(hotels, categories) {
  const cats = (categories && Array.isArray(categories) ? categories : [])
    .map((c) => {
      c.hotels = (c.hotels || []).filter((k) => hotels[k]);
      return c;
    })
    .filter((c) => c.hotels.length);

  const placed = new Set(cats.flatMap((c) => c.hotels));
  const uncat = Object.keys(hotels).filter((k) => !placed.has(k));
  if (uncat.length) cats.push({ slug: '__uncat', title: '未分类 · Uncategorized', hotels: uncat });

  return cats;
}

export function renderEditor(container, hotels, categories, onChange, onSelect, onSelectCat) {
  container.replaceChildren();
  let tiers = buildTiers(hotels, categories);
  if (!tiers.length) {
    container.append(el('p', { class: 'hint', text: '暂无酒店数据。' }));
    return;
  }

  ui.catSlug = tiers[0].slug;
  ui.hotelKey = tiers[0].hotels[0];
  ui.openCat = ui.catSlug; // 默认展开选中酒店所在分类
  ui.view = 'cat'; // 方案 A：初始展示第一个分类的编辑表单（含 FAQ）

  const catBySlug = (slug) => tiers.find((c) => c.slug === slug);
  const catOfHotel = (key) => tiers.find((c) => c.hotels.includes(key));

  const wrap = el('div', { class: 'he' });

  // 左：可折叠树（① 分类 ▸ ② 酒店）
  const tree = el('div', { class: 'he-tree' });

  // 中：tree / form 分隔条
  const treeResizer = el('div', { class: 'resizer', 'data-resizer': 'tree', title: '左右拖动调整分类树宽度' });
  bindResizer(treeResizer);

  // 右：编辑表单宿主（③ 编辑）
  const formHost = el('div', { class: 'he-form-host' });

  wrap.append(tree, treeResizer, formHost);
  container.append(wrap);
  initResizers(); // 对新渲染出的 tree 分隔条应用已保存宽度并确保事件绑定

  // ===== 树操作：隐藏 / 删除 / 新增 / 编辑分类 / 拖拽排序 =====
  function notify(msg, type) {
    if (typeof window !== 'undefined' && typeof window.__adminToast === 'function') window.__adminToast(msg, type);
    else console.log('[hotels] ' + msg);
  }
  function iconBtn(icon, title, handler) {
    return el('button', { class: 'he-act', type: 'button', title, text: icon, onclick: (e) => { e.stopPropagation(); handler(); } });
  }
  function slugify(s) {
    return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function fieldRow(label, input) {
    return el('div', { class: 'field' }, [el('label', { text: label }), input]);
  }
  function markDirty() { onChange(); }

  function toggleHotelHidden(key) {
    const h = hotels[key]; if (!h) return;
    h.hidden = !h.hidden; markDirty(); renderTree();
  }
  function toggleCatHidden(cat) {
    if (cat.slug === '__uncat') return;
    cat.hidden = !cat.hidden; markDirty(); renderTree();
  }
  function deleteHotel(key) {
    const h = hotels[key]; if (!h) return;
    if (!confirm(`确认删除酒店「${h.zh || h.name || key}」？\n\n只删除数据、不删除图片。该酒店将从所有分类移除。`)) return;
    const usedByCats = categories.filter((c) => c.heroImg === h.img);
    delete hotels[key];
    for (const c of categories) {
      const i = (c.hotels || []).indexOf(key);
      if (i >= 0) c.hotels.splice(i, 1);
      if (h.img && c.heroImg === h.img) c.heroImg = '';
    }
    if (ui.hotelKey === key) ui.hotelKey = null;
    if (ui.view === 'hotel' && !ui.hotelKey) ui.view = 'cat';
    markDirty(); renderTree(); renderForm();
    if (usedByCats.length) notify(`已删除。提示：${usedByCats.map((c) => c.title).join('、')} 的分类封面图已清空（曾复用该酒店主图）。`, 'info');
  }
  function deleteCat(cat) {
    if (cat.slug === '__uncat') return;
    if (!confirm(`确认删除分类「${cat.title}」？\n\n旗下酒店不会删除，会落入「未分类」。`)) return;
    const i = categories.indexOf(cat);
    if (i >= 0) categories.splice(i, 1);
    markDirty();
    // A：删除当前分类后保持【分类级】视图，自动跳到下一个有效分类，FAQ/跨链接编辑入口不消失
    if (ui.catSlug === cat.slug) {
      const remaining = categories.filter((c) => c.slug !== '__uncat');
      const next = remaining[0] || null;
      ui.view = 'cat';
      if (next) { ui.catSlug = next.slug; ui.openCat = next.slug; }
      else { ui.catSlug = null; ui.openCat = null; }
    }
    renderTree();
    renderForm();
  }
  function reorderHotel(cat, srcKey, targetKey) {
    const arr = cat.hotels; if (!arr) return;
    const si = arr.indexOf(srcKey), ti = arr.indexOf(targetKey);
    if (si < 0 || ti < 0 || si === ti) return;
    arr.splice(si, 1); arr.splice(ti, 0, srcKey);
    markDirty(); renderTree();
  }

  // 新增酒店弹窗
  let addHotelModal = null;
  function openAddHotel(cat) {
    if (!addHotelModal) addHotelModal = buildAddHotelModal();
    const m = addHotelModal; m.cat = cat;
    m.zh.value = ''; m.name.value = ''; m.key.value = '';
    setStatus(m.status, '', '');
    m.mask.hidden = false;
    setTimeout(() => m.zh.focus(), 50);
  }
  function buildAddHotelModal() {
    const mask = el('div', { class: 'modal-mask', 'data-modal': 'add-hotel', hidden: true });
    const panel = el('div', { class: 'modal' });
    const closeBtn = el('button', { type: 'button', class: 'icon-btn', text: '✕', onclick: () => (mask.hidden = true) });
    const header = el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-icon', text: '➕' }),
      el('div', {}, [el('h2', { text: '新增酒店' }), el('p', { class: 'modal-subtitle', text: '加入当前分类，并创建默认字段（保存后生效）' })]),
      closeBtn,
    ]);
    const zh = el('input', { type: 'text', placeholder: '中文名（必填），如 山水酒店' });
    const name = el('input', { type: 'text', placeholder: '英文名（必填），如 Shanshui Hotel' });
    const key = el('input', { type: 'text', class: 'upload-name', placeholder: 'key（默认由英文名生成，可手动改成拼音）' });
    name.addEventListener('input', () => { const s = slugify(name.value); key.value = s ? 'hotel-' + s : ''; });
    const status = el('div', { class: 'img-lib-status', hidden: true });
    const confirmBtn = el('button', { type: 'button', class: 'btn btn-primary', text: '创建' });
    const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost', text: '取消', onclick: () => (mask.hidden = true) });
    const actions = el('div', { class: 'modal-actions' }, [cancelBtn, confirmBtn]);
    panel.append(header, el('div', { class: 'modal-body' }, [
      fieldRow('中文名 / 名称', zh), fieldRow('英文名 / Name', name), fieldRow('Key（可改成拼音，如 hotel-shanshui-jiudian）', key),
    ]), actions);
    mask.append(panel);
    mask.addEventListener('click', (e) => { if (e.target === mask) mask.hidden = true; });
    document.body.append(mask);
    const m = { mask, zh, name, key, status, cat: null };
    confirmBtn.addEventListener('click', () => {
      const zhV = zh.value.trim(), nameV = name.value.trim();
      if (!zhV || !nameV) { setStatus(status, '请填写中文名与英文名', 'err'); return; }
      const keyV = key.value.trim() || ('hotel-' + slugify(nameV));
      if (!/^[A-Za-z_$][\w$-]*$/.test(keyV)) { setStatus(status, 'Key 需以字母/下划线开头，仅含字母数字、下划线和连字符', 'err'); return; }
      if (hotels[keyV]) { setStatus(status, '该 Key 已存在，请换一个', 'err'); return; }
      hotels[keyV] = { name: nameV, zh: zhV, area: '', tier: '', img: '', alt: '', blurb: '', features: [] };
      if (!m.cat.hotels) m.cat.hotels = [];
      m.cat.hotels.push(keyV);
      ui.hotelKey = keyV; ui.catSlug = m.cat.slug; ui.openCat = m.cat.slug; ui.view = 'hotel';
      markDirty(); renderTree(); renderForm();
      mask.hidden = true;
      notify('已新增酒店（未保存，点保存并发布后生效）', 'info');
    });
    return m;
  }

  // 编辑分类弹窗
  let editCatModal = null;
  function openEditCat(cat) {
    if (cat.slug === '__uncat') return;
    if (!editCatModal) editCatModal = buildEditCatModal();
    const m = editCatModal; m.cat = cat;
    const map = { title: 'title', tag: 'tag', slug: 'slug', heroImg: 'heroImg', heroAlt: 'heroAlt', heroTag: 'heroTag', h1: 'h1', subtitle: 'subtitle', hubDesc: 'hubDesc', metaDesc: 'metaDesc', intro: 'intro', bodyIntro: 'bodyIntro', cardBlurb: 'cardBlurb', cardBlurbZh: 'cardBlurbZh' };
    for (const k of Object.keys(map)) m.inputs[k].value = cat[map[k]] || '';
    m.faqItems = (cat.faq || []).map((it) => ({ q: it.q || '', a: it.a || '', qZh: it.qZh || '', aZh: it.aZh || '' }));
    m.renderFaqList();
    setStatus(m.status, '', '');
    m.mask.hidden = false;
  }
  function buildEditCatModal() {
    const mask = el('div', { class: 'modal-mask', 'data-modal': 'edit-cat', hidden: true });
    const panel = el('div', { class: 'modal' });
    const closeBtn = el('button', { type: 'button', class: 'icon-btn', text: '✕', onclick: () => (mask.hidden = true) });
    const header = el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-icon', text: '⚙' }),
      el('div', {}, [el('h2', { text: '编辑分类' }), el('p', { class: 'modal-subtitle', text: '修改分类信息（保存后生效）' })]),
      closeBtn,
    ]);
    const inputs = {
      title: el('input', { type: 'text' }), tag: el('input', { type: 'text' }), slug: el('input', { type: 'text' }),
      heroImg: el('input', { type: 'text' }), heroAlt: el('input', { type: 'text' }), heroTag: el('input', { type: 'text' }),
      h1: el('input', { type: 'text' }),
      subtitle: el('textarea', {}), hubDesc: el('textarea', {}), metaDesc: el('textarea', {}), intro: el('textarea', {}), bodyIntro: el('textarea', {}),
      cardBlurb: el('input', { type: 'text' }), cardBlurbZh: el('input', { type: 'text' }),
    };
    const faqList = el('div', { class: 'faq-list' });
    const status = el('div', { class: 'img-lib-status', hidden: true });
    const m = { mask, inputs, status, cat: null, faqItems: [] };

    function renderFaqList() {
      faqList.replaceChildren();
      m.faqItems.forEach((it, i) => {
        const q = el('input', { type: 'text', value: it.q || '', placeholder: 'Question (EN)' });
        const qZh = el('input', { type: 'text', value: it.qZh || '', placeholder: '问题 (ZH)' });
        const a = el('textarea', { placeholder: 'Answer (EN)' }, it.a || '');
        const aZh = el('textarea', { placeholder: '答案 (ZH)' }, it.aZh || '');
        q.addEventListener('input', () => { m.faqItems[i].q = q.value; });
        qZh.addEventListener('input', () => { m.faqItems[i].qZh = qZh.value; });
        a.addEventListener('input', () => { m.faqItems[i].a = a.value; });
        aZh.addEventListener('input', () => { m.faqItems[i].aZh = aZh.value; });
        const del = iconBtn('🗑', '删除该条', () => { m.faqItems.splice(i, 1); renderFaqList(); });
        const card = el('div', { class: 'faq-item', draggable: true }, [
          el('div', { class: 'faq-item-head' }, [el('span', { class: 'faq-grip', text: '⠿' }), el('span', { class: 'faq-idx', text: 'Q' + (i + 1) }), del]),
          fieldRow('问题 EN', q),
          fieldRow('问题 ZH', qZh),
          fieldRow('答案 EN', a),
          fieldRow('答案 ZH', aZh),
        ]);
        card.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(i)); });
        card.addEventListener('dragover', (e) => e.preventDefault());
        card.addEventListener('drop', (e) => {
          e.preventDefault();
          const src = parseInt(e.dataTransfer.getData('text/plain'), 10);
          if (!isNaN(src) && src !== i) {
            const [x] = m.faqItems.splice(src, 1);
            m.faqItems.splice(i, 0, x);
            renderFaqList();
          }
        });
        faqList.append(card);
      });
      if (!m.faqItems.length) faqList.append(el('p', { class: 'faq-empty', text: '暂无常见问题，保存后该区块不在前端显示。' }));
    }
    m.renderFaqList = renderFaqList;

    const addFaqBtn = el('button', { type: 'button', class: 'btn btn-dashed', text: '+ 添加问题', onclick: () => { m.faqItems.push({ q: '', a: '', qZh: '', aZh: '' }); renderFaqList(); } });
    const confirmBtn = el('button', { type: 'button', class: 'btn btn-primary', text: '保存' });
    const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost', text: '取消', onclick: () => (mask.hidden = true) });
    const actions = el('div', { class: 'modal-actions' }, [cancelBtn, confirmBtn]);
    panel.append(header, el('div', { class: 'modal-body' }, [
      fieldRow('标题 Title', inputs.title), fieldRow('标签 Tag', inputs.tag), fieldRow('Slug（影响 URL，谨慎）', inputs.slug),
      fieldRow('封面图 Hero Image', inputs.heroImg), fieldRow('封面 Alt', inputs.heroAlt), fieldRow('封面标签 Hero Tag', inputs.heroTag),
      fieldRow('H1', inputs.h1), fieldRow('副标题 Subtitle', inputs.subtitle), fieldRow('简介卡片 Hub Desc', inputs.hubDesc),
      fieldRow('Meta Description', inputs.metaDesc), fieldRow('导语 Intro', inputs.intro), fieldRow('正文导语 Body Intro', inputs.bodyIntro),
      fieldRow('跨链接简介 Card Blurb (EN)', inputs.cardBlurb),
      fieldRow('跨链接简介 Card Blurb (ZH)', inputs.cardBlurbZh),
      el('div', { class: 'faq-section' }, [
        el('p', { class: 'faq-section-title', text: 'FAQ 常见问题' }),
        el('p', { class: 'faq-section-hint', text: '每条含中英文问题与答案；留空则前端不显示该区块。可拖拽排序、逐条删除。' }),
        faqList,
        addFaqBtn,
      ]),
    ]), status, actions);
    mask.append(panel);
    mask.addEventListener('click', (e) => { if (e.target === mask) mask.hidden = true; });
    document.body.append(mask);
    confirmBtn.addEventListener('click', () => {
      const slugV = inputs.slug.value.trim();
      if (slugV && !/^[a-z0-9-]+$/.test(slugV)) { setStatus(status, 'Slug 仅含小写字母、数字和连字符', 'err'); return; }
      const data = {};
      for (const k of Object.keys(inputs)) data[k] = inputs[k].value.trim();
      Object.assign(m.cat, data);
      m.cat.faq = m.faqItems
        .filter((it) => (it.q || '').trim() && (it.a || '').trim())
        .map((it) => ({ q: it.q.trim(), a: it.a.trim(), qZh: (it.qZh || '').trim(), aZh: (it.aZh || '').trim() }));
      markDirty(); renderTree(); renderForm();
      mask.hidden = true;
      onSelectCat && onSelectCat(m.cat);
      notify('分类已更新（未保存，点保存并发布后生效）', 'info');
    });
    return m;
  }

  function renderTree() {
    tiers = buildTiers(hotels, categories); // 每次用最新数据重算
    tree.replaceChildren();
    tree.append(el('div', { class: 'he-tree-title', text: '酒店分类 · Hotels' }));
    for (const c of tiers) {
      const open = c.slug === ui.openCat;
      const isUncat = c.slug === '__uncat';
      const catNode = el('div', { class: 'he-tree-cat' + (open ? ' open' : '') + (c.hidden ? ' is-hidden' : '') });

      const head = el('div', {
        class: 'he-tree-cat-head' + (ui.view === 'cat' && c.slug === ui.catSlug ? ' active' : ''),
      });
      const chevron = el('span', {
        class: 'he-chevron', text: '▸',
        onclick: () => {
          // 仅折叠/展开，不改变当前编辑层级（FAQ 等分类内容不因此丢失）
          ui.openCat = open ? null : c.slug;
          renderTree();
          renderForm();
        },
      });
      const nameSpan = el('span', {
        class: 'he-tree-cat-name', text: c.title,
        onclick: () => {
          // 选中该分类：展开 + 切换到分类编辑表单（含 FAQ / 跨链接简介）
          ui.openCat = c.slug;
          ui.view = 'cat';
          ui.catSlug = c.slug;
          renderTree();
          renderForm();
          onSelectCat && onSelectCat(c);
        },
      });
      head.append(
        chevron,
        nameSpan,
        el('span', { class: 'he-tree-count', text: String(c.hotels.length) }),
      );
      if (!isUncat) {
        head.append(el('span', { class: 'he-tree-actions' }, [
          iconBtn(c.hidden ? '🚫' : '👁', c.hidden ? '显示分类' : '隐藏分类', () => toggleCatHidden(c)),
          iconBtn('➕', '新增酒店', () => openAddHotel(c)),
          iconBtn('⚙', '编辑分类', () => openEditCat(c)),
          iconBtn('🗑', '删除分类', () => deleteCat(c)),
        ]));
      }

      const body = el('div', { class: 'he-tree-cat-body' });
      for (const k of c.hotels) {
        const h = hotels[k];
        const hotelBtn = el('div', {
          class: 'he-tree-hotel' + (ui.view === 'hotel' && k === ui.hotelKey ? ' active' : '') + (h && h.hidden ? ' is-hidden' : ''),
          draggable: true,
          onclick: () => selectHotel(k),
          ondragstart: (e) => { e.dataTransfer.setData('text/plain', k); e.dataTransfer.effectAllowed = 'move'; },
          ondragover: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; hotelBtn.classList.add('drag-over'); },
          ondragleave: () => hotelBtn.classList.remove('drag-over'),
          ondrop: (e) => {
            e.preventDefault();
            hotelBtn.classList.remove('drag-over');
            const src = e.dataTransfer.getData('text/plain');
            if (src && src !== k) reorderHotel(c, src, k);
          },
        }, [
          el('span', { class: 'he-tree-hotel-zh', text: h ? (h.zh || '') : k }),
          el('span', { class: 'he-tree-hotel-en', text: h ? (h.name || k) : '(已删除)' }),
        ]);
        hotelBtn.append(el('span', { class: 'he-tree-hotel-acts' }, [
          iconBtn(h && h.hidden ? '🚫' : '👁', h && h.hidden ? '显示酒店' : '隐藏酒店', () => toggleHotelHidden(k)),
          iconBtn('🗑', '删除酒店', () => deleteHotel(k)),
        ]));
        body.append(hotelBtn);
      }

      catNode.append(head, body);
      tree.append(catNode);
    }
  }

  function selectHotel(key) {
    ui.hotelKey = key;
    ui.view = 'hotel';
    const cat = catOfHotel(key);
    ui.catSlug = cat ? cat.slug : ui.catSlug;
    ui.openCat = ui.catSlug; // 确保父分类展开（单开）
    renderTree();
    renderForm();
  }

  function renderForm() {
    if (ui.view === 'cat') { renderCatForm(); return; }
    renderHotelForm();
  }

  function renderHotelForm() {
    formHost.replaceChildren();
    const h = hotels[ui.hotelKey];
    if (!h) {
      formHost.append(el('div', { class: 'he-empty', text: '请选择一个酒店进行编辑。' }));
      return;
    }

    formHost.append(
      el('div', { class: 'he-form-head' }, [
        el('span', { class: 'he-form-zh', text: h.zh || '' }),
        el('span', { class: 'he-form-key', text: ui.hotelKey }),
      ]),
      el('div', { class: 'he-step', text: '③ 编辑 Edit' })
    );

    for (const f of FIELDS) {
      const commit = (v) => {
        h[f.key] = v;
        onChange();
        onSelect && onSelect(ui.hotelKey);
      };
      if (f.key === 'img') {
        formHost.append(imageField(f, h.img, commit, hotels, categories, ui.hotelKey));
      } else {
        formHost.append(textField(f, h[f.key], commit));
      }
    }
    formHost.append(
      longField({ label: '简介 / Blurb', tip: '一段英文介绍' }, h.blurb, (v) => {
        h.blurb = v;
        onChange();
        onSelect && onSelect(ui.hotelKey);
      })
    );
    formHost.append(featuresField(h.features, () => onChange()));

    // ===== 三级详情页编辑器（可折叠） =====
    appendDetailModule(formHost, h);

    // 初次/切换时同步右侧预览
    onSelect && onSelect(ui.hotelKey);
  }

  // 方案 A：分类级编辑表单（内联，含 FAQ 编辑器 + 跨链接简介），与右栏分类页预览同层级
  // 三区并列：① 基本信息（不可折叠）｜ ② FAQ module（可折叠一级 + 二级问答）｜ ③ Other Ways module（可折叠一级 + 二级跨链接卡片）
  function renderCatForm() {
    const cat = catBySlug(ui.catSlug);
    formHost.replaceChildren();
    if (!cat) {
      formHost.append(el('div', { class: 'he-empty', text: '请选择一个分类。' }));
      return;
    }
    const sync = () => onSelectCat && onSelectCat(cat);

    formHost.append(
      el('div', { class: 'he-form-head' }, [
        el('span', { class: 'he-form-zh', text: cat.title || '' }),
        el('span', { class: 'he-form-key', text: 'category/' + cat.slug }),
      ]),
      el('div', { class: 'he-step', text: '③ 编辑分类 Edit' })
    );

    // C：明确层级，避免被误认为酒店内容
    formHost.append(el('p', { class: 'he-cat-note', text: '本页编辑【分类级】内容（含 FAQ 与跨链接简介），对所有该分类生成的页面生效。' }));

    function catField(label, tip, key, type) {
      const input = type === 'textarea' ? el('textarea', {}) : el('input', { type: 'text' });
      input.value = cat[key] || '';
      input.addEventListener('input', () => { cat[key] = input.value; markDirty(); sync(); });
      return el('div', { class: 'field' }, [
        el('label', {}, [label, el('span', { class: 'tip', text: ' ' + tip })]),
        input,
      ]);
    }

    // ① 基本信息（cardBlurb / cardBlurbZh 已搬到 ③ Other Ways module，避免重复）
    const metaFieldDefs = [
      ['标题 Title', '分类标题', 'title'],
      ['标签 Tag', '如 Mountain Lodges', 'tag'],
      ['Slug（影响 URL，谨慎）', '仅小写字母、数字和连字符', 'slug'],
      ['封面图 Hero Image', 'webp 文件名（不含扩展名）', 'heroImg'],
      ['封面 Alt', '英文 alt 描述', 'heroAlt'],
      ['封面标签 Hero Tag', '如 Where to stay', 'heroTag'],
      ['H1', '页面主标题', 'h1'],
      ['副标题 Subtitle', 'H1 下方小字', 'subtitle', 'textarea'],
      ['简介卡片 Hub Desc', '分类卡片描述', 'hubDesc', 'textarea'],
      ['Meta Description', 'SEO 描述', 'metaDesc', 'textarea'],
      ['导语 Intro', '分类页导语', 'intro', 'textarea'],
      ['正文导语 Body Intro', '正文上方导语', 'bodyIntro', 'textarea'],
    ];
    for (const [label, tip, key, type] of metaFieldDefs) {
      formHost.append(catField(label, tip, key, type));
    }

    // ② FAQ 常见问题 module（与酒店列表同级的一级，可折叠；二级 = 每条问答）
    formHost.append(buildFaqSection(cat, sync));

    // ③ Other Ways to Browse module（与酒店列表同级的一级，可折叠；二级 = 每个跨链接卡片）
    formHost.append(buildOtherWaysSection(cat, sync));

    sync();
  }

  // ----- ② FAQ 常见问题模块（一级，折叠树 + 内联二级问答） -----
  function buildFaqSection(cat, sync) {
    const isOpen = ui.faqOpen !== false;
    cat.faq = cat.faq || [];

    const head = el('div', {
      class: 'he-catsec-head' + (isOpen ? ' open' : ''),
      onclick: (e) => {
        if (e.target.closest('.he-catsec-actions')) return;
        ui.faqOpen = !isOpen;
        renderForm();
      },
    }, [
      el('span', { class: 'he-chevron', text: isOpen ? '▾' : '▸' }),
      el('span', { class: 'he-catsec-emoji', text: '❓' }),
      el('span', { class: 'he-catsec-name', text: 'FAQ 常见问题' }),
      el('span', { class: 'he-catsec-count', text: String(cat.faq.length) }),
      el('div', { class: 'he-catsec-actions' }, [
        el('button', {
          type: 'button', class: 'btn btn-dashed btn-mini', text: '+ 添加问题',
          onclick: (e) => {
            e.stopPropagation();
            cat.faq.push({ q: '', a: '', qZh: '', aZh: '' });
            ui.faqOpen = true;
            markDirty(); sync(); renderForm();
          },
        }),
      ]),
    ]);

    const body = el('div', { class: 'he-catsec-body' + (isOpen ? '' : ' collapsed') });
    const faqList = el('div', { class: 'faq-list' });
    if (!cat.faq.length) {
      faqList.append(el('p', { class: 'faq-empty', text: '暂无常见问题。该模块留空则前端不显示 FAQ 区块。' }));
    } else {
      cat.faq.forEach((it, i) => {
        const q = el('input', { type: 'text', value: it.q || '', placeholder: 'Question (EN)' });
        const qZh = el('input', { type: 'text', value: it.qZh || '', placeholder: '问题 (ZH)' });
        const a = el('textarea', { placeholder: 'Answer (EN)' }); a.value = it.a || '';
        const aZh = el('textarea', { placeholder: '答案 (ZH)' }); aZh.value = it.aZh || '';
        q.addEventListener('input', () => { cat.faq[i].q = q.value; markDirty(); sync(); });
        qZh.addEventListener('input', () => { cat.faq[i].qZh = qZh.value; markDirty(); sync(); });
        a.addEventListener('input', () => { cat.faq[i].a = a.value; markDirty(); sync(); });
        aZh.addEventListener('input', () => { cat.faq[i].aZh = aZh.value; markDirty(); sync(); });
        const del = el('button', {
          type: 'button', class: 'he-act', title: '删除该条', text: '🗑',
          onclick: (e) => {
            e.stopPropagation();
            if (!confirm(`删除该问题？\n\nQ: ${it.q || '(未命名)'}`)) return;
            cat.faq.splice(i, 1); markDirty(); sync(); renderForm();
          },
        });
        const card = el('div', { class: 'faq-item', draggable: true }, [
          el('div', { class: 'faq-item-head' }, [
            el('span', { class: 'faq-grip', text: '⠿' }),
            el('span', { class: 'faq-idx', text: 'Q' + (i + 1) }),
            del,
          ]),
          fieldRow('问题 EN', q),
          fieldRow('问题 ZH', qZh),
          fieldRow('答案 EN', a),
          fieldRow('答案 ZH', aZh),
        ]);
        card.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', String(i)));
        card.addEventListener('dragover', (e) => e.preventDefault());
        card.addEventListener('drop', (e) => {
          e.preventDefault();
          const src = parseInt(e.dataTransfer.getData('text/plain'), 10);
          if (!isNaN(src) && src !== i) {
            const [x] = cat.faq.splice(src, 1);
            cat.faq.splice(i, 0, x);
            markDirty(); sync(); renderForm();
          }
        });
        faqList.append(card);
      });
    }
    body.append(faqList);

    return el('section', { class: 'he-catsec he-catsec-faq' }, [
      head,
      el('p', { class: 'he-catsec-hint', text: '每条含中英文问题与答案；留空则前端不显示该模块。可拖拽排序、逐条删除。' }),
      body,
    ]);
  }

  // ----- ③ Other Ways to Browse 模块（一级，折叠树 + 二级跨链接卡片） -----
  function buildOtherWaysSection(cat, sync) {
    const isOpen = ui.otherOpen !== false;
    const others = categories.filter((c) => c.slug !== cat.slug && c.slug !== '__uncat' && !c.hidden);

    const head = el('div', {
      class: 'he-catsec-head' + (isOpen ? ' open' : ''),
      onclick: (e) => {
        if (e.target.closest('.he-catsec-actions')) return;
        ui.otherOpen = !isOpen;
        renderForm();
      },
    }, [
      el('span', { class: 'he-chevron', text: isOpen ? '▾' : '▸' }),
      el('span', { class: 'he-catsec-emoji', text: '🗂' }),
      el('span', { class: 'he-catsec-name', text: 'Other Ways to Browse' }),
      el('span', { class: 'he-catsec-count', text: String(others.length) }),
    ]);

    const body = el('div', { class: 'he-catsec-body' + (isOpen ? '' : ' collapsed') });
    if (!others.length) {
      body.append(el('p', { class: 'he-catsec-empty', text: '暂无其他分类可供跨链。至少需要两个分类才会渲染该模块。' }));
    } else {
      others.forEach((o) => {
        const cur = o.cardBlurb || o.hubDesc || '';
        const curZh = o.cardBlurbZh || '';
        const preview = (cur + (curZh ? ('  ·  ' + curZh) : '')).slice(0, 120);

        const blurb = el('textarea', { rows: 2, placeholder: '跨链接简介 (EN)，留空则回退 Hub Desc' });
        blurb.value = o.cardBlurb || '';
        blurb.addEventListener('input', () => { o.cardBlurb = blurb.value; markDirty(); sync(); });

        const blurbZh = el('textarea', { rows: 2, placeholder: '跨链接简介 (ZH)' });
        blurbZh.value = o.cardBlurbZh || '';
        blurbZh.addEventListener('input', () => { o.cardBlurbZh = blurbZh.value; markDirty(); sync(); });

        const card = el('div', { class: 'he-other-item' }, [
          el('div', { class: 'he-other-item-head' }, [
            o.tag ? el('span', { class: 'he-other-tag', text: o.tag }) : null,
            el('span', { class: 'he-other-title', text: o.title || o.slug }),
            el('span', { class: 'he-other-cat', text: 'category/' + o.slug }),
          ]),
          el('div', { class: 'he-other-preview', text: preview || '(未设置简介，将回退 Hub Desc)' }),
          fieldRow('跨链接简介 EN（留空则回退 Hub Desc）', blurb),
          fieldRow('跨链接简介 ZH', blurbZh),
        ]);
        body.append(card);
      });
    }

    return el('section', { class: 'he-catsec he-catsec-other' }, [
      head,
      el('p', { class: 'he-catsec-hint', text: '编辑其他分类作为跨链接卡片时显示在【本分类页底】的简介。卡片顺序 = hotelCategories 数组顺序（去重当前 + 隐藏）；要调整顺序，请直接调整左侧分类顺序。' }),
      body,
    ]);
  }

  // ===== 三级详情页编辑器（可折叠一级；二级 = 简介 / Rooms / Gallery / FAQ） =====
  function appendDetailModule(host, h) {
    const slug = ui.hotelKey;
    const sync = () => { markDirty(); onSelect && onSelect(ui.hotelKey); };
    const sec = el('section', { class: 'he-catsec he-catsec-detail' });
    const isOpen = ui.detailOpen !== false;

    const body = el('div', { class: 'he-catsec-body' + (isOpen ? '' : ' collapsed') });
    const head = el('div', {
      class: 'he-catsec-head' + (isOpen ? ' open' : ''),
      onclick: (e) => {
        if (e.target.closest('.he-catsec-actions')) return;
        ui.detailOpen = !isOpen;
        body.classList.toggle('collapsed', !ui.detailOpen);
        head.classList.toggle('open', ui.detailOpen);
      },
    }, [
      el('span', { class: 'he-chevron', text: isOpen ? '▾' : '▸' }),
      el('span', { class: 'he-catsec-emoji', text: '🏨' }),
      el('span', { class: 'he-catsec-name', text: '详情页 Detail page' }),
      el('span', { class: 'he-catsec-count', text: h.detail ? '已建' : '未建' }),
    ]);

    if (!h.detail) {
      body.append(el('p', { class: 'he-catsec-empty', text: '该酒店暂无三级详情页。点下方按钮基于当前酒店创建空白详情页（含 Rooms / Gallery / FAQ 空数组），保存后前端即生成该详情页。' }));
      body.append(el('button', {
        type: 'button', class: 'btn btn-primary', text: '➕ 创建详情页',
        onclick: () => {
          h.detail = {
            tagline: '', heroLead: '', areaTier: '', intro: '', metaDesc: '', heroAlt: '',
            alternateName: '', jsonDesc: '', areaServed: '',
            roomsTitle: '', roomsSub: '', rooms: [],
            galleryTitle: '', gallerySub: '', gallery: [],
            faq: [],
          };
          markDirty();
          renderForm(); // 重新渲染整表以展开详情编辑区
        },
      }));
    } else {
      const d = h.detail;
      body.append(buildDetailMetaEditor(d, sync));
      body.append(buildRoomsEditor(d, slug, sync));
      body.append(buildGalleryEditor(d, slug, sync));
      body.append(buildDetailFaqEditor(d, sync));
    }

    sec.append(
      head,
      el('p', { class: 'he-catsec-hint', text: '详填并保存后，前端即生成 hotels/' + slug + '.html 三级页（与构建脚本同源）。可删除 / 上下移动排序。' }),
      body
    );
    host.append(sec);
  }

  // 二级：简介 & SEO 字段
  function buildDetailMetaEditor(d, sync) {
    const wrap = el('div', { class: 'he-sub', 'data-pv-anchor': 'pv-hero' });
    wrap.append(el('p', { class: 'he-sub-title', text: '📝 简介 & SEO' }));
    function detailField(label, tip, key, type) {
      const input = type === 'textarea' ? el('textarea', {}) : el('input', { type: 'text' });
      input.value = d[key] || '';
      input.addEventListener('input', () => { d[key] = input.value; sync(); });
      return el('div', { class: 'field' }, [el('label', {}, [label, el('span', { class: 'tip', text: ' ' + tip })]), input]);
    }
    const introDefs = [
      ['Tagline（徽标小字）', '如 Boutique retreat', 'tagline'],
      ['Hero 导语 Hero Lead', '首屏大段英文介绍（默认回退 blurb）', 'heroLead', 'textarea'],
      ['区域·档次 Area·Tier', '如 Wulingyuan · Boutique', 'areaTier'],
      ['简介 Intro', '首屏下方导语段落', 'intro', 'textarea'],
      ['Rooms 标题', '如 Rooms & suites', 'roomsTitle'],
      ['Rooms 副标题', '房间区小字', 'roomsSub', 'textarea'],
      ['Gallery 标题', '如 Inside JiMO', 'galleryTitle'],
      ['Gallery 副标题', '图集区小字', 'gallerySub', 'textarea'],
    ];
    const seoDefs = [
      ['Meta Description', 'SEO 描述（留空回退 intro/blurb）', 'metaDesc', 'textarea'],
      ['Hero Alt', '首图 alt 描述', 'heroAlt'],
      ['Alternate Name', '中文别名（JSON-LD）', 'alternateName'],
      ['JSON-LD Description', '结构化数据描述（留空回退 intro）', 'jsonDesc', 'textarea'],
      ['Area Served', 'JSON-LD 服务区域', 'areaServed'],
    ];
    for (const [label, tip, key, type] of introDefs) wrap.append(detailField(label, tip, key, type));
    wrap.append(el('p', { class: 'he-sub-note', text: '— SEO 字段（留空则前端回退默认值）—' }));
    for (const [label, tip, key, type] of seoDefs) wrap.append(detailField(label, tip, key, type));
    return wrap;
  }

  // 二级：Rooms 全结构化（图 + 英文名 + 中文名 + 特色）
  function buildRoomsEditor(d, slug, sync) {
    d.rooms = d.rooms || [];
    const wrap = el('div', { class: 'he-sub', 'data-pv-anchor': 'pv-rooms' });
    wrap.append(el('p', { class: 'he-sub-title', text: '🛏 Rooms（全结构化：图 + 英文名 + 中文名 + 特色）' }));
    const list = el('div', { class: 'he-room-list' });
    function renderList() {
      list.replaceChildren();
      d.rooms.forEach((r, i) => {
        const card = el('div', { class: 'he-room-card' });
        card.append(imageField({ label: '房间主图 / Image', tip: 'webp 文件名（不含扩展名）' }, r.img || '', (v) => { r.img = v; sync(); }, hotels, categories, slug));
        card.append(textField({ label: '英文名 / Name', tip: '如 Mansi Deluxe Twin' }, r.name || '', (v) => { r.name = v; sync(); }));
        card.append(textField({ label: '中文名 / 名称', tip: '如 漫时光豪华双床房' }, r.nameZh || '', (v) => { r.nameZh = v; sync(); }));
        card.append(featuresField(r.features || (r.features = []), () => sync()));
        card.append(el('div', { class: 'he-item-ctrls' }, [
          iconBtn('↑', '上移', () => { moveItem(d.rooms, i, -1); sync(); renderList(); }),
          iconBtn('↓', '下移', () => { moveItem(d.rooms, i, 1); sync(); renderList(); }),
          iconBtn('🗑', '删除房间', () => { if (confirm('删除该房间？')) { d.rooms.splice(i, 1); sync(); renderList(); } }),
        ]));
        list.append(card);
      });
      if (!d.rooms.length) list.append(el('p', { class: 'he-catsec-empty', text: '暂无房间，点下方添加。' }));
    }
    renderList();
    wrap.append(list, el('button', { type: 'button', class: 'btn btn-dashed', text: '+ 添加房间', onclick: () => { d.rooms.push({ img: '', name: '', nameZh: '', features: [] }); sync(); renderList(); } }));
    return wrap;
  }

  // 二级：Gallery（图 + alt）
  function buildGalleryEditor(d, slug, sync) {
    d.gallery = d.gallery || [];
    const wrap = el('div', { class: 'he-sub', 'data-pv-anchor': 'pv-gallery' });
    wrap.append(el('p', { class: 'he-sub-title', text: '🖼 Gallery（每张：图 + alt 描述）' }));
    const list = el('div', { class: 'he-gallery-list' });
    function renderList() {
      list.replaceChildren();
      d.gallery.forEach((g, i) => {
        const obj = typeof g === 'string' ? { img: g, alt: '' } : g;
        if (typeof g === 'string') d.gallery[i] = obj;
        const card = el('div', { class: 'he-gallery-card' });
        card.append(imageField({ label: '图片 / Image', tip: 'webp 文件名（不含扩展名）' }, obj.img || '', (v) => { obj.img = v; sync(); }, hotels, categories, slug));
        card.append(textField({ label: 'Alt 描述', tip: '英文 alt' }, obj.alt || '', (v) => { obj.alt = v; sync(); }));
        card.append(el('div', { class: 'he-item-ctrls' }, [
          iconBtn('↑', '上移', () => { moveItem(d.gallery, i, -1); sync(); renderList(); }),
          iconBtn('↓', '下移', () => { moveItem(d.gallery, i, 1); sync(); renderList(); }),
          iconBtn('🗑', '删除', () => { d.gallery.splice(i, 1); sync(); renderList(); }),
        ]));
        list.append(card);
      });
      if (!d.gallery.length) list.append(el('p', { class: 'he-catsec-empty', text: '暂无图片，点下方添加。' }));
    }
    renderList();
    wrap.append(list, el('button', { type: 'button', class: 'btn btn-dashed', text: '+ 添加图片', onclick: () => { d.gallery.push({ img: '', alt: '' }); sync(); renderList(); } }));
    return wrap;
  }

  // 二级：FAQ（中英文问题与答案，可拖拽排序）
  function buildDetailFaqEditor(d, sync) {
    d.faq = d.faq || [];
    const wrap = el('div', { class: 'he-sub', 'data-pv-anchor': 'pv-faq' });
    wrap.append(el('p', { class: 'he-sub-title', text: '❓ FAQ（中英文问题与答案）' }));
    const list = el('div', { class: 'faq-list' });
    function renderList() {
      list.replaceChildren();
      d.faq.forEach((it, i) => {
        const q = el('input', { type: 'text', value: it.q || '', placeholder: 'Question (EN)' });
        const qZh = el('input', { type: 'text', value: it.qZh || '', placeholder: '问题 (ZH)' });
        const a = el('textarea', { placeholder: 'Answer (EN)' }); a.value = it.a || '';
        const aZh = el('textarea', { placeholder: '答案 (ZH)' }); aZh.value = it.aZh || '';
        q.addEventListener('input', () => { d.faq[i].q = q.value; sync(); });
        qZh.addEventListener('input', () => { d.faq[i].qZh = qZh.value; sync(); });
        a.addEventListener('input', () => { d.faq[i].a = a.value; sync(); });
        aZh.addEventListener('input', () => { d.faq[i].aZh = aZh.value; sync(); });
        const del = iconBtn('🗑', '删除', () => { if (confirm('删除该问题？')) { d.faq.splice(i, 1); sync(); renderList(); } });
        const card = el('div', { class: 'faq-item', draggable: true }, [
          el('div', { class: 'faq-item-head' }, [el('span', { class: 'faq-grip', text: '⠿' }), el('span', { class: 'faq-idx', text: 'Q' + (i + 1) }), del]),
          fieldRow('问题 EN', q), fieldRow('问题 ZH', qZh), fieldRow('答案 EN', a), fieldRow('答案 ZH', aZh),
        ]);
        card.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', String(i)));
        card.addEventListener('dragover', (e) => e.preventDefault());
        card.addEventListener('drop', (e) => {
          e.preventDefault();
          const src = parseInt(e.dataTransfer.getData('text/plain'), 10);
          if (!isNaN(src) && src !== i) { const [x] = d.faq.splice(src, 1); d.faq.splice(i, 0, x); sync(); renderList(); }
        });
        list.append(card);
      });
      if (!d.faq.length) list.append(el('p', { class: 'faq-empty', text: '暂无常见问题。' }));
    }
    renderList();
    wrap.append(list, el('button', { type: 'button', class: 'btn btn-dashed', text: '+ 添加问题', onclick: () => { d.faq.push({ q: '', a: '', qZh: '', aZh: '' }); sync(); renderList(); } }));
    return wrap;
  }

  renderTree();
  renderForm();
}

export function renderPreview(container, hotel, slug) {
  // 切到卡片预览时，清理详情模式可能残留的滚动同步 IO
  if (container._pvIO) { container._pvIO.disconnect(); container._pvIO = null; }
  container.classList.remove('detail-mode');
  container.replaceChildren();
  if (!hotel) return;
  const imgWrap = el('div', { class: 'pv-img' });
  if (hotel.img) {
    const im = el('img', { class: 'pv-img-el', src: slug ? imgUrl(slug, hotel.img) : hotel.img + '.webp', alt: hotel.alt || '' });
    im.addEventListener('error', () => (imgWrap.textContent = '(图片加载失败: ' + hotel.img + ')'));
    imgWrap.append(im);
  } else {
    imgWrap.textContent = '(no image)';
  }
  const card = el('div', { class: 'pv-card' }, [
    imgWrap,
    el('div', { class: 'pv-body' }, [
      el('div', { class: 'pv-name', text: hotel.name || '' }),
      el('div', { class: 'pv-zh', text: hotel.zh || '' }),
      el('div', { class: 'pv-meta', text: `${hotel.area || ''} · ${hotel.tier || ''}` }),
      el('div', { class: 'pv-blurb', text: hotel.blurb || '' }),
      el(
        'ul',
        { class: 'pv-features' },
        (hotel.features || []).map((f) => el('li', { text: f }))
      ),
    ]),
  ]);
  container.append(card);
}

// 分类页实时预览（方案 A）：编辑分类时在右栏渲染该分类页片段，所见即所得
export function renderCategoryPreview(container, cat, hotels, categories) {
  container.classList.remove('detail-mode');
  container.replaceChildren();
  if (!cat) return;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escAttr = (s) => esc(s).replace(/"/g, '&quot;');
  const heroSlug = (() => {
    const byImg = Object.keys(hotels).find((k) => hotels[k] && hotels[k].img === cat.heroImg);
    if (byImg) return byImg;
    const mm = /^hotel-([a-z0-9-]+)-/.exec(cat.heroImg || '');
    return mm ? mm[1] : null;
  })();
  const heroSrc = `../images/${heroSlug ? heroSlug + '/' : ''}${esc(cat.heroImg)}.webp`;
  const cards = (cat.hotels || []).filter((id) => hotels[id] && !hotels[id].hidden).map((id) => {
    const h = hotels[id];
    return `<article class="pv-cat-card">
      <img class="pv-cat-card-img" src="../images/${id}/${esc(h.img)}.webp" alt="${escAttr(h.alt)}" onerror="this.style.display='none'">
      <div class="pv-cat-card-body">
        <h4>${esc(h.name)}</h4>
        <p class="pv-cat-card-zh">${esc(h.zh)} · ${esc(h.area)}</p>
        <p class="pv-cat-card-blurb">${esc(h.blurb)}</p>
      </div>
    </article>`;
  }).join('');
  const faqHtml = (cat.faq && cat.faq.length)
    ? cat.faq.map((it) => `<div class="pv-cat-faq"><h5>${esc(it.q)}</h5><p>${esc(it.a)}</p>${it.qZh ? `<h6>${esc(it.qZh)}</h6>` : ''}${it.aZh ? `<p class="pv-zh">${esc(it.aZh)}</p>` : ''}</div>`).join('')
    : '<p class="pv-empty">暂无常见问题（保存后该区块不显示）</p>';
  const others = categories.filter((c) => !c.hidden && c.slug !== cat.slug).map((c) => {
    const desc = c.cardBlurb || c.hubDesc;
    return `<a class="pv-cat-rel" href="#"><p class="pv-cat-rel-tag">${esc(c.tag)}</p><h4>${esc(c.title)}</h4><p>${esc(desc)}</p></a>`;
  }).join('');
  container.innerHTML = `<div class="pv-cat">
    <div class="pv-cat-hero">
      <img src="${heroSrc}" alt="${escAttr(cat.heroAlt)}" onerror="this.style.display='none'">
      <div class="pv-cat-hero-ov"></div>
      <div class="pv-cat-hero-txt">
        <span class="pv-cat-tag">${esc(cat.heroTag)}</span>
        <h3>${esc(cat.h1)}</h3>
        <p>${esc(cat.subtitle)}</p>
      </div>
    </div>
    <section class="pv-cat-sec">
      <h3 class="pv-cat-h2">Our ${esc(cat.title.toLowerCase())}</h3>
      <div class="pv-cat-grid">${cards}</div>
    </section>
    <section class="pv-cat-sec">
      <h3 class="pv-cat-h2">Frequently asked questions</h3>
      <div class="pv-cat-faqs">${faqHtml}</div>
    </section>
    <section class="pv-cat-sec">
      <h3 class="pv-cat-h2">Other ways to browse hotels</h3>
      <div class="pv-cat-rels">${others}</div>
    </section>
  </div>`;
}

// ---------- 三级详情页 实时预览（复用 hotel-detail.html 模板，iframe srcdoc 所见即所得） ----------
const BASE = 'https://willyye.github.io/zhangjiajie-tours-v3';
let _detailTpl = null;
let _detailFillTimer = null;
const _escHtml = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const _escAttr = (s) => _escHtml(s).replace(/"/g, '&quot;');
const _imgName = (n) => (/\.(webp|jpg|jpeg|avif|png)$/i.test(n) ? n : n + '.webp');
const _imgSrc = (n, slug) => '../images/' + (slug ? slug + '/' : '') + _imgName(n);
const _findCatOf = (key, cats) => (cats || []).find((c) => (c.hotels || []).includes(key));

function _roomCard(r, slug) {
  const feats = (r.features || []).map((f) => `<li class="flex gap-2"><span class="text-gold-dark">✓</span><span>${_escHtml(f)}</span></li>`).join('');
  const zh = r.nameZh ? `            <p class="text-gold-dark text-xs font-semibold uppercase tracking-wide mb-2">${_escAttr(r.nameZh)}</p>\n` : '';
  return `        <article class="card-hover group bg-white rounded-2xl overflow-hidden border border-sand-dark flex flex-col">
          <div class="overflow-hidden h-56"><img loading="lazy" decoding="async" src="${_imgSrc(r.img, slug)}" alt="${_escAttr(r.alt || r.name)}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"></div>
          <div class="p-6 flex flex-col flex-1">
            <h3 class="font-display text-xl text-forest leading-snug">${_escHtml(r.name)}</h3>
${zh}            <ul class="space-y-1.5 text-sm text-stone-600">${feats}</ul>
          </div>
        </article>`;
}
function _galleryImg(g, slug) {
  const img = typeof g === 'string' ? g : g.img;
  const alt = (typeof g === 'string' ? '' : g.alt) || '';
  return `        <img loading="lazy" decoding="async" src="${_imgSrc(img, slug)}" alt="${_escAttr(alt)}" class="w-full h-48 object-cover rounded-xl">`;
}
function _hotelJsonLd(h, key, detail) {
  const data = {
    '@context': 'https://schema.org', '@type': 'Hotel', name: h.name,
    alternateName: (detail && detail.alternateName) || h.zh || '',
    description: (detail && (detail.jsonDesc || detail.intro)) || h.blurb || '',
    url: `${BASE}/hotels/${key}.html`,
    address: { '@type': 'PostalAddress', addressRegion: 'Hunan', addressCountry: 'CN' },
    areaServed: (detail && detail.areaServed) || h.area || '',
  };
  return JSON.stringify(data, null, 2);
}
function _faqSection(items) {
  if (!items || !items.length) return '';
  const cards = items.map((it) => `          <div class="bg-white rounded-2xl border border-sand-dark p-6 md:p-7 fade-in">
            <h3 class="font-display text-lg md:text-xl text-forest mb-2">${_escHtml(it.q)}</h3>
            <p class="text-stone/80 leading-relaxed text-sm md:text-base">${_escHtml(it.a)}</p>
          </div>`).join('\n');
  return `  <!-- ========== FAQ ========== -->
  <section id="pv-faq" class="max-w-[1400px] mx-auto px-6 pb-16">
    <h2 class="font-display text-2xl md:text-3xl text-forest mb-6">Frequently asked questions</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
${cards}
    </div>
  </section>`;
}
function _relatedCard(c) {
  const desc = _escHtml(c.cardBlurb || c.hubDesc);
  return `          <a href="${c.slug}.html" class="card-hover group block bg-white rounded-2xl overflow-hidden border border-sand-dark">
            <div class="p-6">
              <p class="text-xs font-semibold uppercase tracking-wide text-gold-dark mb-1">${_escAttr(c.tag)}</p>
              <h3 class="font-display text-lg text-forest group-hover:text-gold-dark transition-colors">${_escHtml(c.title)}</h3>
              <p class="text-sm text-stone-600 mt-1">${desc}</p>
            </div>
          </a>`;
}
function _relatedSection(cats, current, label) {
  const cards = (cats || []).filter((c) => !c.hidden && c.slug !== current.slug).map(_relatedCard).join('\n');
  return `  <!-- ========== Related categories ========== -->
  <section id="pv-other" class="max-w-[1400px] mx-auto px-6 pb-20">
    <h2 class="font-display text-2xl md:text-3xl text-forest mb-6">${_escHtml(label)}</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
${cards}
    </div>
  </section>`;
}
function _fillDetailTpl(tpl, hotel, key, categories) {
  const detail = hotel.detail || {};
  const slug = key;
  const cat = _findCatOf(key, categories);
  const catLink = cat ? cat.slug + '.html' : '#';
  const metaDesc = detail.metaDesc || detail.intro || hotel.blurb || '';
  const map = {
    TITLE: _escHtml(`${hotel.name} | Visit Zhangjiajie`),
    META_DESC: _escAttr(metaDesc),
    CANONICAL: `${BASE}/hotels/${key}.html`,
    OG_IMAGE: `${BASE}/images/${slug}/${_imgName(hotel.img)}`,
    HERO_IMG: _imgSrc(hotel.img, slug),
    HERO_ALT: _escAttr(detail.heroAlt || hotel.alt || ''),
    CAT_LINK: catLink,
    CAT_NAME: _escHtml(cat ? cat.title : ''),
    HOTEL_NAME: _escHtml(hotel.name),
    TAGLINE: _escHtml(detail.tagline || hotel.tier || ''),
    HERO_LEAD: _escHtml(detail.heroLead || hotel.blurb || ''),
    AREA_TIER: _escHtml(detail.areaTier || `${hotel.area || ''} · ${hotel.tier || ''}`),
    INTRO_TEXT: _escHtml(detail.intro || hotel.blurb || ''),
    ROOMS_TITLE: _escHtml(detail.roomsTitle || 'Rooms & suites'),
    ROOMS_SUB: _escHtml(detail.roomsSub || ''),
    ROOMS: (detail.rooms || []).map((r) => _roomCard(r, slug)).join('\n'),
    GALLERY_TITLE: _escHtml(detail.galleryTitle || `Inside ${hotel.name}`),
    GALLERY_SUB: _escHtml(detail.gallerySub || ''),
    GALLERY: (detail.gallery || []).map((g) => _galleryImg(g, slug)).join('\n'),
    FAQ_SECTION: _faqSection(detail.faq),
    OTHER_WAYS: _relatedSection(categories, cat, 'Other ways to browse hotels'),
    JSONLD: _hotelJsonLd(hotel, key, detail),
  };
  let out = tpl;
  for (const [k, v] of Object.entries(map)) out = out.split(`{{${k}}}`).join(v);
  // 注意：不要注入 <base href="../">。iframe srcdoc 继承父 URL = /admin/，
  // 模板里所有路径已用 ../(如 ../styles/tailwind.css)，从 /admin/ 出发 = 根/... 正确解析。
  // 若再加 <base href="../">，base 会先升一层到 /zhangjiajie-tours-v3/，再叠 ../ 就把
  // zhangjiajie-tours-v3/ 这层 segment 吞掉，CSS/字体/图片全部 404。
  const leftovers = [...out.matchAll(/\{\{[A-Z_]+\}\}/g)].map((m) => m[0]);
  if (leftovers.length) console.warn('[detail-preview] leftover placeholders:', [...new Set(leftovers)].join(', '));
  return out;
}

export function renderDetailPreview(container, hotel, key, categories) {
  if (!hotel || !hotel.detail) {
    container.classList.remove('detail-mode');
    if (container._pvIO) { container._pvIO.disconnect(); container._pvIO = null; }
    container.replaceChildren(el('div', { class: 'pv-empty', text: '该酒店暂无详情页数据（在左侧「详情页」模块点「创建详情页」）。' }));
    return;
  }
  container.classList.add('detail-mode');
  const run = () => {
    if (!_detailTpl) return;
    const html = _fillDetailTpl(_detailTpl, hotel, key, categories);
    // 清理旧滚动同步 IO
    if (container._pvIO) { container._pvIO.disconnect(); container._pvIO = null; }
    // 建滚动同步状态：编辑器 4 子区(pv-hero/rooms/gallery/faq) → iframe 对应锚点
    const mainDoc = container.ownerDocument;
    const editorRoot = mainDoc.getElementById('editor');
    const subs = mainDoc.querySelectorAll('.he-sub[data-pv-anchor]');
    const syncState = { active: null, anchors: null, iwin: null };
    const tryScroll = () => {
      const t = syncState.active && syncState.anchors ? syncState.anchors[syncState.active] : null;
      if (t && syncState.iwin) syncState.iwin.scrollTo({ top: t.offsetTop - 8, behavior: 'smooth' });
    };
    if (editorRoot && subs.length) {
      const ratios = new Map();
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) ratios.set(e.target, e.isIntersecting ? e.intersectionRatio : 0);
        let best = null, bestR = 0;
        for (const [el, r] of ratios) if (r > bestR) { bestR = r; best = el; }
        if (!best) return;
        const a = best.getAttribute('data-pv-anchor');
        if (a !== syncState.active) { syncState.active = a; tryScroll(); }
      }, { root: editorRoot, rootMargin: '0px 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });
      subs.forEach((s) => io.observe(s));
      container._pvIO = io;
    }
    container.replaceChildren();
    const iframe = el('iframe', { class: 'pv-detail-iframe', title: 'detail-preview' });
    container.append(iframe);
    iframe.addEventListener('load', () => {
      const idoc = iframe.contentDocument;
      if (!idoc) return;
      syncState.anchors = {
        'pv-hero': idoc.getElementById('hero'),
        'pv-intro': idoc.getElementById('pv-intro'),
        'pv-rooms': idoc.getElementById('pv-rooms'),
        'pv-gallery': idoc.getElementById('pv-gallery'),
        'pv-faq': idoc.getElementById('pv-faq'),
        'pv-other': idoc.getElementById('pv-other'),
      };
      syncState.iwin = idoc.defaultView;
      tryScroll();
    }, { once: true });
    iframe.srcdoc = html;
  };
  if (_detailTpl) {
    clearTimeout(_detailFillTimer);
    _detailFillTimer = setTimeout(run, 120);
  } else {
    container.replaceChildren(el('div', { class: 'pv-loading', text: '加载详情页模板…' }));
    // templates/ 在仓库根；admin/modules/hotels.js → 上两级到根
    fetch(new URL('../../templates/hotel-detail.html', import.meta.url))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}（路径错或文件不在）`);
        return r.text();
      })
      .then((t) => { _detailTpl = t; run(); })
      .catch((e) => {
        console.error('[detail-preview] 模板加载失败:', e);
        container.replaceChildren(el('div', { class: 'pv-empty', text: '详情页模板加载失败：' + e.message + '（请确认 admin/ → 仓库根 templates/hotel-detail.html 路径）' }));
      });
  }
}
