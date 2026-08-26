// tours.js — Tour Packages 后台编辑器（左树 / 中表单 / 右实时预览）
// 标准对齐酒店模块：左树（① 区块设置 ② 套餐卡片）/ 中表单 / 右预览（🃏卡片 / 📄详情）。
// 图片仅限 images/tours/（物理隔离，不借图）；图库选中后自动跳转并高亮当前图。
// 右栏详情预览复用 templates/tour-detail.html（与 build 同源 → 所见即所得）。
import { createImageLib } from '../imglib-core.js';
import { buildToursHubHtml, tourDetailMap } from './tours-render.js';
import { withPv } from '../pv-anchor.js';

let data = null;
let sel = { type: 'block' }; // 'block' | { type: 'card', index }
const ui = { open: 'block', detailOpen: true }; // 当前展开的分组 / 详情编辑器是否展开

const toursLib = createImageLib({
  slug: 'tours',
  findReferences: (name) => {
    if (!data) return [];
    const refs = [];
    for (const it of data.items) {
      if (it.img === name) refs.push(it.title);
      if (it.heroImg === name) refs.push(it.title + '（封面）');
      (it.gallery || []).forEach((g) => { if ((typeof g === 'string' ? g : g.img) === name) refs.push(it.title + '（画廊）'); });
    }
    return refs;
  },
});

// 角标颜色下拉选项（与 BADGE 字典一致）
const BADGE_OPTIONS = [
  ['forest', 'Forest（森林绿）'],
  ['emerald', 'Emerald（翠绿）'],
  ['gold', 'Gold（金）'],
  ['blue', 'Blue（蓝）'],
  ['red', 'Red（红）'],
  ['orange', 'Orange（橙）'],
  ['purple', 'Purple（紫）'],
];

// ---------- DOM helpers（镜像 hero.js / hotels.js / top-attractions.js） ----------
function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'style') n.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') n[k.toLowerCase()] = v;
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) n.append(c);
  return n;
}

function textField(field, value, onInput) {
  const input = el('input', {
    type: 'text',
    value: value ?? '',
    placeholder: field.placeholder || '',
    oninput: (e) => onInput(e.target.value),
  });
  return withPv(el('div', { class: 'field' }, [
    el('label', {}, [field.label, el('span', { class: 'tip', text: ' ' + (field.tip || '') })]),
    input,
  ]), field);
}

function longField(field, value, onInput) {
  const ta = el('textarea', {
    rows: field.rows || 4,
    placeholder: field.placeholder || '',
    oninput: (e) => onInput(e.target.value),
  });
  ta.value = value ?? '';
  return withPv(el('div', { class: 'field' }, [
    el('label', {}, [field.label, el('span', { class: 'tip', text: ' ' + (field.tip || '') })]),
    ta,
  ]), field);
}

function selectField(field, value, onInput, options) {
  const selEl = el('select', { onchange: (e) => onInput(e.target.value) });
  for (const [val, label] of options) {
    const o = el('option', { value: val, text: label });
    if (val === value) o.selected = true;
    selEl.append(o);
  }
  return withPv(el('div', { class: 'field' }, [
    el('label', {}, [field.label, el('span', { class: 'tip', text: ' ' + (field.tip || '') })]),
    selEl,
  ]), field);
}

// 图片字段：仅限本模块图库 images/tours/（自动跳转 + 高亮当前选中图）
function imageField(field, value, onInput, lib = toursLib) {
  const thumbBox = el('div', { class: 'he-thumb-box' + (value ? '' : ' no-img') });
  const thumb = el('img', { class: 'he-thumb', src: value ? lib.imgUrl(value) : '' });
  thumb.onerror = () => thumbBox.classList.add('no-img');
  thumb.onload = () => thumbBox.classList.remove('no-img');
  thumbBox.append(thumb);
  const input = el('input', {
    type: 'text',
    value: value ?? '',
    placeholder: 'webp 文件名（不含扩展名）',
    oninput: (e) => {
      const v = e.target.value;
      onInput(v);
      if (v) { thumb.src = lib.imgUrl(v); thumbBox.classList.remove('no-img'); }
      else { thumb.src = ''; thumbBox.classList.add('no-img'); }
    },
  });
  const btn = el('button', {
    type: 'button',
    class: 'btn btn-sm btn-ghost',
    text: '🖼 浏览图片库',
    onclick: () => lib.open(thumbBox, thumb, input, onInput),
  });
  const row = el('div', { class: 'img-field' }, [thumbBox, input, btn]);
  return withPv(el('div', { class: 'field' }, [
    el('label', {}, [field.label, el('span', { class: 'tip', text: ' ' + (field.tip || '') })]),
    row,
  ]), field);
}

function iconBtn(icon, title, handler) {
  return el('button', {
    class: 'he-act', type: 'button', title, text: icon,
    onclick: (e) => { e.stopPropagation(); handler(); },
  });
}

function slugify(s) {
  return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

let onChangeCb = null;
let onSelectCb = null;
function markDirty() { if (onChangeCb) onChangeCb(); }
function notify(msg, type) {
  if (typeof window !== 'undefined' && typeof window.__adminToast === 'function') window.__adminToast(msg, type);
  else console.log('[tours] ' + msg);
}

function currentSlug() {
  if (sel.type === 'card' && data.items[sel.index]) return data.items[sel.index].slug;
  return null;
}

// ============================================================
// 轻量列表编辑器（字符串数组 / 对象数组，带 上移/下移/删除）
// ============================================================
function stringListEditor(label, arr, onChange, placeholder) {
  const host = el('div', { class: 'field' });
  host.append(el('label', {}, [label, el('span', { class: 'tip', text: ' 逐项编辑，回车新增' })]));
  const listWrap = el('div', { class: 'he-list' });
  function rerender() {
    listWrap.replaceChildren();
    arr.forEach((val, idx) => {
      const inp = el('input', { type: 'text', value: val ?? '', placeholder: placeholder || '', oninput: (e) => { arr[idx] = e.target.value; markDirty(); } });
      const up = iconBtn('↑', '上移', () => { if (idx > 0) { [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]; markDirty(); rerender(); renderPreviewIfNeeded(); } });
      const down = iconBtn('↓', '下移', () => { if (idx < arr.length - 1) { [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]]; markDirty(); rerender(); renderPreviewIfNeeded(); } });
      const del = iconBtn('🗑', '删除', () => { arr.splice(idx, 1); markDirty(); rerender(); renderPreviewIfNeeded(); });
      listWrap.append(el('div', { class: 'he-list-row' }, [inp, up, down, del]));
    });
  }
  const addBtn = el('button', { type: 'button', class: 'btn btn-sm btn-ghost', text: '＋ 新增一项', onclick: () => { arr.push(''); markDirty(); rerender(); renderPreviewIfNeeded(); } });
  rerender();
  host.append(listWrap, addBtn);
  return host;
}

function objectListEditor(label, arr, fields, onChange) {
  // fields: [{ key, label, type:'text'|'long'|'img', placeholder, tip }]
  const host = el('div', { class: 'field' });
  host.append(el('label', {}, [label]));
  const listWrap = el('div', { class: 'he-list he-list-obj' });
  function rerender() {
    listWrap.replaceChildren();
    arr.forEach((obj, idx) => {
      const card = el('div', { class: 'he-obj-card' });
      fields.forEach((f) => {
        if (f.type === 'img') {
          card.append(imageField({ label: f.label }, obj[f.key], (v) => { obj[f.key] = v; markDirty(); renderPreviewIfNeeded(); }));
        } else if (f.type === 'long') {
          card.append(longField({ label: f.label, rows: f.rows || 3 }, obj[f.key], (v) => { obj[f.key] = v; markDirty(); renderPreviewIfNeeded(); }));
        } else {
          card.append(textField({ label: f.label }, obj[f.key], (v) => { obj[f.key] = v; markDirty(); renderPreviewIfNeeded(); }));
        }
      });
      const up = iconBtn('↑', '上移', () => { if (idx > 0) { [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]; markDirty(); rerender(); renderPreviewIfNeeded(); } });
      const down = iconBtn('↓', '下移', () => { if (idx < arr.length - 1) { [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]]; markDirty(); rerender(); renderPreviewIfNeeded(); } });
      const del = iconBtn('🗑', '删除', () => { arr.splice(idx, 1); markDirty(); rerender(); renderPreviewIfNeeded(); });
      card.append(el('div', { class: 'he-list-row he-obj-acts' }, [up, down, del]));
      listWrap.append(card);
    });
  }
  const addBtn = el('button', { type: 'button', class: 'btn btn-sm btn-ghost', text: '＋ 新增一项', onclick: () => {
    const blank = {}; fields.forEach((f) => (blank[f.key] = '')); arr.push(blank); markDirty(); rerender(); renderPreviewIfNeeded();
  } });
  rerender();
  host.append(listWrap, addBtn);
  return host;
}

function renderPreviewIfNeeded() { if (onSelectCb) onSelectCb(sel); }

// ============================================================
// 编辑区：左树 + 中表单
// ============================================================
export function renderEditor(container, d, onChange, onSelect) {
  data = d || { eyebrow: '', title: '', subtitle: '', items: [] };
  onChangeCb = onChange;
  onSelectCb = onSelect;
  if (sel.type === 'card' && !data.items[sel.index]) sel = { type: 'block' };

  const wrap = el('div', { class: 'he' });
  const tree = el('div', { class: 'he-tree' });
  const formHost = el('div', { class: 'he-form-host' });
  wrap.append(tree, formHost);
  container.replaceChildren(wrap);

  // ---------------- 树 ----------------
  function renderTree() {
    tree.replaceChildren();
    tree.append(el('div', { class: 'he-tree-title', text: '🎟 Tour Packages' }));

    // ① 区块设置
    const blockOpen = ui.open === 'block';
    const blockHead = el('div', {
      class: 'he-tree-cat-head' + (sel.type === 'block' ? ' active' : ''),
    }, [
      el('span', { class: 'he-chevron', text: '▸', onclick: (e) => { e.stopPropagation(); ui.open = blockOpen ? null : 'block'; renderTree(); } }),
      el('span', {
        class: 'he-tree-cat-name', text: '区块设置（标题 / 副标题）',
        onclick: () => { ui.open = 'block'; sel = { type: 'block' }; renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel); },
      }),
    ]);
    const blockCat = el('div', { class: 'he-tree-cat' + (blockOpen ? ' open' : '') + (sel.type === 'block' ? ' is-active' : '') }, [blockHead]);
    if (blockOpen) {
      blockCat.append(el('div', { class: 'he-tree-cat-body' }, [
        el('div', { class: 'he-tree-hint', text: '编辑整个区块的标题、副标题与顶部小字（hub 页）。' }),
      ]));
    }
    tree.append(blockCat);

    // ② 套餐卡片
    const cardsOpen = ui.open === 'cards';
    const cardsHead = el('div', { class: 'he-tree-cat-head' }, [
      el('span', { class: 'he-chevron', text: '▸', onclick: (e) => { e.stopPropagation(); ui.open = cardsOpen ? null : 'cards'; renderTree(); } }),
      el('span', {
        class: 'he-tree-cat-name', text: `套餐卡片 (${data.items.length})`,
        onclick: () => {
          ui.open = 'cards';
          if (sel.type !== 'card') sel = { type: 'card', index: 0 };
          renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel);
        },
      }),
      el('span', { class: 'he-tree-actions' }, [iconBtn('➕', '新增套餐', openAddCard)]),
    ]);
    const cardsCat = el('div', { class: 'he-tree-cat' + (cardsOpen ? ' open' : '') }, [cardsHead]);
    if (cardsOpen) {
      const body = el('div', { class: 'he-tree-cat-body' });
      data.items.forEach((it, idx) => {
        const node = el('div', {
          class: 'he-tree-hotel' + (sel.type === 'card' && sel.index === idx ? ' active' : '') + (it.hidden ? ' is-hidden' : ''),
          draggable: true,
        }, [
          el('span', { class: 'he-tree-hotel-zh', text: it.title || '(无标题)' }),
          el('span', { class: 'he-tree-hotel-en', text: it.slug || '' }),
        ]);
        node.onclick = () => { ui.open = 'cards'; sel = { type: 'card', index: idx }; renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel); };
        node.ondragstart = (e) => { e.dataTransfer.setData('text/plain', String(idx)); e.dataTransfer.effectAllowed = 'move'; };
        node.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; node.classList.add('drag-over'); };
        node.ondragleave = () => node.classList.remove('drag-over');
        node.ondrop = (e) => {
          e.preventDefault(); node.classList.remove('drag-over');
          const src = parseInt(e.dataTransfer.getData('text/plain'), 10);
          if (!isNaN(src) && src !== idx) reorder(src, idx);
        };
        node.append(el('span', { class: 'he-tree-hotel-acts' }, [
          iconBtn(it.hidden ? '🚫' : '👁', it.hidden ? '显示套餐' : '隐藏套餐', () => { it.hidden = !it.hidden; markDirty(); renderTree(); if (onSelectCb) onSelectCb(sel); }),
          iconBtn('🗑', '删除套餐', () => deleteCard(idx)),
        ]));
        body.append(node);
      });
      cardsCat.append(body);
    }
    tree.append(cardsCat);
  }

  function reorder(from, to) {
    const arr = data.items;
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    if (sel.type === 'card') {
      if (sel.index === from) sel.index = to;
      else if (from < sel.index && sel.index <= to) sel.index--;
      else if (to <= sel.index && sel.index < from) sel.index++;
    }
    markDirty(); renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel);
  }

  function deleteCard(idx) {
    const it = data.items[idx];
    if (!it) return;
    if (!confirm(`确认删除套餐「${it.title || it.slug}」？\n\n只删除数据、不删除图片（图片可在图库单独管理）。`)) return;
    data.items.splice(idx, 1);
    if (sel.type === 'card') {
      if (sel.index >= data.items.length) {
        sel = data.items.length ? { type: 'card', index: data.items.length - 1 } : { type: 'block' };
      }
    }
    markDirty(); renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel);
  }

  function openAddCard() {
    data.items.push({
      slug: 'new-tour-' + (data.items.length + 1),
      img: '', imgAlt: '', badge: '', badgeColor: 'forest', title: 'New Tour Package', desc: '', hidden: false,
      heroImg: '', heroAlt: '', tagline: '', heroLead: '', duration: '', price: '', overview: '',
      itinerary: [], included: [], excluded: [], gallery: [], faq: [],
    });
    ui.open = 'cards';
    sel = { type: 'card', index: data.items.length - 1 };
    markDirty(); renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel);
  }

  // ---------------- 表单 ----------------
  function renderForm() {
    formHost.replaceChildren();
    if (sel.type === 'block') {
      formHost.append(el('div', { class: 'he-form-head' }, [el('span', { class: 'he-form-key', text: '区块设置' })]));
      formHost.append(textField({ label: '顶部小字 Eyebrow', tip: '金色大写小字，如 Curated Itineraries' }, data.eyebrow, (v) => { data.eyebrow = v; markDirty(); }));
      formHost.append(textField({ label: '区块标题 Title', tip: 'hub 页主标题' }, data.title, (v) => { data.title = v; markDirty(); }));
      formHost.append(longField({ label: '副标题 Subtitle', tip: 'hub 页说明', rows: 3 }, data.subtitle, (v) => { data.subtitle = v; markDirty(); }));
      return;
    }

    const it = data.items[sel.index];
    if (!it) { sel = { type: 'block' }; renderTree(); renderForm(); return; }
    formHost.append(el('div', { class: 'he-form-head' }, [
      el('span', { class: 'he-form-zh', text: it.title || '(无标题)' }),
      el('span', { class: 'he-form-key', text: `#${sel.index + 1} · ${it.slug}` }),
    ]));

    // Slug
    const slugInput = el('input', {
      type: 'text', value: it.slug || '', placeholder: '小写字母/数字/连字符',
      oninput: (e) => { it.slug = e.target.value; markDirty(); },
    });
    const genBtn = el('button', {
      type: 'button', class: 'btn btn-sm btn-ghost', text: '↻ 由标题生成',
      onclick: () => { const s = slugify(it.title || ''); slugInput.value = s; it.slug = s; markDirty(); },
    });
    formHost.append(el('div', { class: 'field' }, [
      el('label', {}, [el('span', { text: 'Slug' }), el('span', { class: 'tip', text: ' 决定详情页链接 tours/<slug>.html' })]),
      el('div', { class: 'img-field' }, [slugInput, genBtn]),
    ]));

    // 基础字段
    formHost.append(imageField({ label: '卡片图 Image', tip: '仅 images/tours/ 图库（点击浏览可上传/删除）', pv: { mode: 'card', anchor: 'tour-' + it.slug } }, it.img, (v) => { it.img = v; markDirty(); if (onSelectCb) onSelectCb(sel); }));
    formHost.append(textField({ label: '图片 Alt' }, it.imgAlt, (v) => { it.imgAlt = v; markDirty(); }));
    formHost.append(textField({ label: '角标文字 Badge', tip: '如 3 Days' }, it.badge, (v) => { it.badge = v; markDirty(); }));
    formHost.append(selectField({ label: '角标颜色 Badge Color' }, it.badgeColor, (v) => { it.badgeColor = v; markDirty(); }, BADGE_OPTIONS));
    formHost.append(textField({ label: '卡片标题 Title', pv: { mode: 'card', anchor: 'tour-' + it.slug } }, it.title, (v) => { it.title = v; markDirty(); if (onSelectCb) onSelectCb(sel); }));
    formHost.append(longField({ label: '描述 Description', rows: 3 }, it.desc, (v) => { it.desc = v; markDirty(); }));

    // 详情页折叠
    const detailToggle = el('button', {
      type: 'button', class: 'he-detail-toggle',
      onclick: () => { ui.detailOpen = !ui.detailOpen; renderForm(); },
    }, [ui.detailOpen ? '▾' : '▸', ' 📦 详情页 Detail page（hero / 行程 / 包含 / 画廊 / FAQ）']);
    formHost.append(detailToggle);

    if (ui.detailOpen) {
      const dsec = el('div', { class: 'he-detail-sec' });
      dsec.append(el('div', { class: 'he-sec-title', text: '① Hero & 概览' }));
      dsec.append(imageField({ label: '详情页封面 Hero Image', tip: '详情页大图，仅 images/tours/', pv: { mode: 'detail', anchor: 'hero' } }, it.heroImg, (v) => { it.heroImg = v; markDirty(); if (onSelectCb) onSelectCb(sel); }));
      dsec.append(textField({ label: '封面 Alt' }, it.heroAlt, (v) => { it.heroAlt = v; markDirty(); }));
      dsec.append(textField({ label: '标签 Tagline', tip: '如 Best of Wulingyuan', pv: { mode: 'detail', anchor: 'hero' } }, it.tagline, (v) => { it.tagline = v; markDirty(); }));
      dsec.append(longField({ label: 'Hero 引言 Hero Lead', rows: 3, pv: { mode: 'detail', anchor: 'hero' } }, it.heroLead, (v) => { it.heroLead = v; markDirty(); }));
      dsec.append(textField({ label: '行程时长 Duration', tip: '如 3 Days / 2 Nights' }, it.duration, (v) => { it.duration = v; markDirty(); }));
      dsec.append(textField({ label: '价格 Price', tip: '如 From ¥1,980 / person' }, it.price, (v) => { it.price = v; markDirty(); }));
      dsec.append(longField({ label: '概览 Overview', rows: 4, pv: { mode: 'detail', anchor: 'overview' } }, it.overview, (v) => { it.overview = v; markDirty(); }));

      dsec.append(el('div', { class: 'he-sec-title', text: '② 每日行程 Itinerary' }));
      dsec.append(objectListEditor('每一项：时段 / 标题 / 说明', it.itinerary || (it.itinerary = []), [
        { key: 'day', label: '时段 Day', type: 'text', placeholder: 'Day 1' },
        { key: 'title', label: '标题 Title', type: 'text', placeholder: 'Arrival & Yuanjiajie' },
        { key: 'text', label: '说明 Text', type: 'long', rows: 3, placeholder: '当天活动…' },
      ]));

      dsec.append(el('div', { class: 'he-sec-title', text: '③ 包含 / 不包含' }));
      dsec.append(stringListEditor('包含 Included', it.included || (it.included = []), null, 'English-speaking guide…'));
      dsec.append(stringListEditor('不包含 Excluded', it.excluded || (it.excluded = []), null, 'Meals…'));

      dsec.append(el('div', { class: 'he-sec-title', text: '④ 画廊 Gallery' }));
      dsec.append(objectListEditor('每张图：图片 / Alt', it.gallery || (it.gallery = []), [
        { key: 'img', label: '图片（图库）', type: 'img' },
        { key: 'alt', label: 'Alt', type: 'text', placeholder: '描述' },
      ]));

      dsec.append(el('div', { class: 'he-sec-title', text: '⑤ 常见问题 FAQ' }));
      dsec.append(objectListEditor('每条：问题 / 答案', it.faq || (it.faq = []), [
        { key: 'q', label: '问题 Question', type: 'text', placeholder: 'How long is the tour?' },
        { key: 'a', label: '答案 Answer', type: 'long', rows: 3, placeholder: 'Answer…' },
      ]));

      formHost.append(dsec);
    }

    const hiddenBtn = el('button', {
      type: 'button', class: 'btn btn-sm',
      text: it.hidden ? '👁 显示此套餐' : '🚫 隐藏此套餐（前台不渲染）',
      onclick: () => { it.hidden = !it.hidden; markDirty(); renderTree(); if (onSelectCb) onSelectCb(sel); },
    });
    formHost.append(el('div', { class: 'field' }, [hiddenBtn]));
  }

  renderTree();
  renderForm();
}

// ============================================================
// 预览区：iframe srcdoc（复用站点真实 CSS → 所见即所得）
// ============================================================
export function renderPreview(container, d, selection) {
  data = d || data;
  const grid = buildToursHubHtml(data);
  const previewGrid = grid
    .replace(/ fade-in/g, '')
    .replace(/src="images\//g, 'src="../images/')
    .replace(/href="tours\//g, 'href="../tours/');
  const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="../styles/tailwind.css"><style>body{margin:0;padding:18px;background:#f3efe7}</style></head><body>${previewGrid}</body></html>`;

  container.replaceChildren();
  const iframe = el('iframe', {
    class: 'pv-detail-iframe',
    title: 'Tour Packages 实时预览',
    style: 'width:100%;height:100%;border:0;background:#f3efe7',
  });
  container.append(iframe);
  iframe.addEventListener('load', () => {
    const idoc = iframe.contentDocument;
    if (!idoc) return;
    const slug = (selection && selection.type === 'card' && data.items[selection.index]) ? data.items[selection.index].slug : currentSlug();
    if (slug) {
      const card = idoc.getElementById('tour-' + slug);
      if (card) { card.style.outline = '3px solid #2563eb'; card.style.outlineOffset = '2px'; }
    }
  }, { once: true });
  iframe.srcdoc = doc;
}

// 详情页预览：复用真实 templates/tour-detail.html（与 build 同源），所见即所得。
export async function renderTourDetailPreview(container, tourObj, slug) {
  container.replaceChildren();
  if (!slug || !tourObj) {
    container.replaceChildren(el('div', { class: 'pv-loading', text: '未选择套餐，无法预览详情页。' }));
    return;
  }
  const iframe = el('iframe', {
    class: 'pv-detail-iframe',
    title: 'Tour detail preview · ' + slug,
    style: 'width:100%;height:100%;border:0;background:#fff',
  });
  container.append(iframe);
  const loading = el('div', { class: 'pv-loading', text: '加载详情页…' });
  container.append(loading);
  try {
    const res = await fetch(`../templates/tour-detail.html`, { cache: 'no-store' });
    if (!res.ok) throw new Error('template not found (' + res.status + ')');
    const tpl = await res.text();
    const others = (data.items || [])
      .filter((o) => !o.hidden && o.slug !== slug)
      .map((o) => ({ slug: o.slug, title: o.title, img: o.img }));
    const map = tourDetailMap(tourObj, slug, others);
    const html = Object.entries(map).reduce((acc, [k, v]) => acc.split(`{{${k}}}`).join(v), tpl);
    loading.remove();
    iframe.srcdoc = html;
  } catch (e) {
    loading.remove();
    container.replaceChildren(el('div', { class: 'pv-loading', text: `详情页预览失败：${e.message}` }));
  }
}
