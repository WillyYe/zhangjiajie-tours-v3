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
const ui = { catSlug: null, hotelKey: null, openCat: null };

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) node.append(c);
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

export function renderEditor(container, hotels, categories, onChange, onSelect) {
  container.replaceChildren();
  let tiers = buildTiers(hotels, categories);
  if (!tiers.length) {
    container.append(el('p', { class: 'hint', text: '暂无酒店数据。' }));
    return;
  }

  ui.catSlug = tiers[0].slug;
  ui.hotelKey = tiers[0].hotels[0];
  ui.openCat = ui.catSlug; // 默认展开选中酒店所在分类

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
    markDirty(); renderTree(); renderForm();
    if (usedByCats.length) notify(`已删除。提示：${usedByCats.map((c) => c.title).join('、')} 的分类封面图已清空（曾复用该酒店主图）。`, 'info');
  }
  function deleteCat(cat) {
    if (cat.slug === '__uncat') return;
    if (!confirm(`确认删除分类「${cat.title}」？\n\n旗下酒店不会删除，会落入「未分类」。`)) return;
    const i = categories.indexOf(cat);
    if (i >= 0) categories.splice(i, 1);
    if (ui.catSlug === cat.slug) { ui.catSlug = null; ui.openCat = null; }
    markDirty(); renderTree(); renderForm();
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
      ui.hotelKey = keyV; ui.catSlug = m.cat.slug; ui.openCat = m.cat.slug;
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
    const map = { title: 'title', tag: 'tag', slug: 'slug', heroImg: 'heroImg', heroAlt: 'heroAlt', heroTag: 'heroTag', h1: 'h1', subtitle: 'subtitle', hubDesc: 'hubDesc', metaDesc: 'metaDesc', intro: 'intro', bodyIntro: 'bodyIntro' };
    for (const k of Object.keys(map)) m.inputs[k].value = cat[map[k]] || '';
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
    };
    const status = el('div', { class: 'img-lib-status', hidden: true });
    const confirmBtn = el('button', { type: 'button', class: 'btn btn-primary', text: '保存' });
    const cancelBtn = el('button', { type: 'button', class: 'btn btn-ghost', text: '取消', onclick: () => (mask.hidden = true) });
    const actions = el('div', { class: 'modal-actions' }, [cancelBtn, confirmBtn]);
    panel.append(header, el('div', { class: 'modal-body' }, [
      fieldRow('标题 Title', inputs.title), fieldRow('标签 Tag', inputs.tag), fieldRow('Slug（影响 URL，谨慎）', inputs.slug),
      fieldRow('封面图 Hero Image', inputs.heroImg), fieldRow('封面 Alt', inputs.heroAlt), fieldRow('封面标签 Hero Tag', inputs.heroTag),
      fieldRow('H1', inputs.h1), fieldRow('副标题 Subtitle', inputs.subtitle), fieldRow('简介卡片 Hub Desc', inputs.hubDesc),
      fieldRow('Meta Description', inputs.metaDesc), fieldRow('导语 Intro', inputs.intro), fieldRow('正文导语 Body Intro', inputs.bodyIntro),
    ]), status, actions);
    mask.append(panel);
    mask.addEventListener('click', (e) => { if (e.target === mask) mask.hidden = true; });
    document.body.append(mask);
    const m = { mask, inputs, status, cat: null };
    confirmBtn.addEventListener('click', () => {
      const slugV = inputs.slug.value.trim();
      if (slugV && !/^[a-z0-9-]+$/.test(slugV)) { setStatus(status, 'Slug 仅含小写字母、数字和连字符', 'err'); return; }
      const data = {};
      for (const k of Object.keys(inputs)) data[k] = inputs[k].value.trim();
      Object.assign(m.cat, data);
      markDirty(); renderTree();
      mask.hidden = true;
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
        class: 'he-tree-cat-head',
        onclick: () => {
          if (open) {
            ui.openCat = null;
            ui.hotelKey = null;
          } else {
            ui.openCat = c.slug;
            if (!c.hotels.includes(ui.hotelKey)) {
              ui.hotelKey = c.hotels[0];
              ui.catSlug = c.slug;
            }
          }
          renderTree();
          renderForm();
        },
      }, [
        el('span', { class: 'he-chevron', text: '▸' }),
        el('span', { class: 'he-tree-cat-name', text: c.title }),
        el('span', { class: 'he-tree-count', text: String(c.hotels.length) }),
      ]);
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
          class: 'he-tree-hotel' + (k === ui.hotelKey ? ' active' : '') + (h && h.hidden ? ' is-hidden' : ''),
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
    const cat = catOfHotel(key);
    ui.catSlug = cat ? cat.slug : ui.catSlug;
    ui.openCat = ui.catSlug; // 确保父分类展开（单开）
    renderTree();
    renderForm();
  }

  function renderForm() {
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

    // 初次/切换时同步右侧预览
    onSelect && onSelect(ui.hotelKey);
  }

  renderTree();
  renderForm();
}

export function renderPreview(container, hotel, slug) {
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
