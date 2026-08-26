// home-tour-cards.js — 首页 Tour Packages 三卡后台编辑器（左树 / 中表单 / 右实时预览）
// 标准对齐 hotels.js / tours.js：左树（① 区块设置 ② 卡片）/ 中表单 / 右预览（iframe 所见即所得）。
// 数据 homeTourCards 与首页 hero/topAttractions/welcome/nav 同住 home-data.mjs，
// 保存时只重写 homeTourCards 块（mjs.js rebuild 保证 diff 最小，不波及其它块）。
import { buildHomeTourCardsHtml } from './home-tour-cards-render.js';
import { withPv } from '../pv-anchor.js';
import { ensurePreviewFrame, setPreviewSrcdoc, onFrameLoad } from '../preview-frame.js';

let data = null;
let sel = { type: 'block' }; // 'block' | { type: 'card', index }
const ui = { open: 'block' };

// ---------- DOM helpers（镜像 heroes/tours 模块） ----------
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
  return el('div', { class: 'field' }, [
    el('label', {}, [field.label, el('span', { class: 'tip', text: ' ' + (field.tip || '') })]),
    input,
  ]);
}

function longField(field, value, onInput) {
  const ta = el('textarea', {
    rows: field.rows || 4,
    placeholder: field.placeholder || '',
    oninput: (e) => onInput(e.target.value),
  });
  ta.value = value ?? '';
  return el('div', { class: 'field' }, [
    el('label', {}, [field.label, el('span', { class: 'tip', text: ' ' + (field.tip || '') })]),
    ta,
  ]);
}

function selectField(field, value, onInput, options) {
  const selEl = el('select', { onchange: (e) => onInput(e.target.value) });
  for (const [val, label] of options) {
    const o = el('option', { value: val, text: label });
    if (val === value) o.selected = true;
    selEl.append(o);
  }
  return el('div', { class: 'field' }, [
    el('label', {}, [field.label, el('span', { class: 'tip', text: ' ' + (field.tip || '') })]),
    selEl,
  ]);
}

function iconBtn(icon, title, handler) {
  return el('button', {
    class: 'he-act', type: 'button', title, text: icon,
    onclick: (e) => { e.stopPropagation(); handler(); },
  });
}

let onChangeCb = null;
let onSelectCb = null;
function markDirty() { if (onChangeCb) onChangeCb(); }
function notify(msg, type) {
  if (typeof window !== 'undefined' && typeof window.__adminToast === 'function') window.__adminToast(msg, type);
  else console.log('[homeTourCards] ' + msg);
}

function currentCardId() {
  if (sel.type === 'card' && data.cards[sel.index]) return data.cards[sel.index].id;
  return null;
}

// 下拉选项（与渲染字典一致）
const ICON_BG_OPTIONS = [
  ['bg-sand', 'Sand（沙色圆底）'],
  ['bg-gold/20', 'Gold 20%（金底）'],
  ['bg-forest/10', 'Forest 10%（森林底）'],
];
const SUBTITLE_COLOR_OPTIONS = [
  ['stone-500', 'Stone 500（灰）'],
  ['gold-dark', 'Gold Dark（金，加粗）'],
];
const BTN_OPTIONS = [
  ['forest', 'Forest（森林绿按钮）'],
  ['gold', 'Gold（金色按钮）'],
];

// ---------- 轻量列表编辑器（字符串数组，带 上移/下移/删除） ----------
function stringListEditor(label, arr, onChange) {
  const host = el('div', { class: 'field' });
  host.append(el('label', {}, [label, el('span', { class: 'tip', text: ' 逐项编辑，回车新增' })]));
  const listWrap = el('div', { class: 'he-list' });
  function rerender() {
    listWrap.replaceChildren();
    arr.forEach((val, idx) => {
      const inp = el('input', { type: 'text', value: val ?? '', placeholder: '特性文案，不含 ✓', oninput: (e) => { arr[idx] = e.target.value; markDirty(); } });
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

function renderPreviewIfNeeded() { if (onSelectCb) onSelectCb(sel); }

// ============================================================
// 编辑区：左树 + 中表单
// ============================================================
export function renderEditor(container, d, onChange, onSelect) {
  data = d || { eyebrow: '', title: '', cards: [] };
  onChangeCb = onChange;
  onSelectCb = onSelect;
  if (sel.type === 'card' && !data.cards[sel.index]) sel = { type: 'block' };

  const wrap = el('div', { class: 'he' });
  const tree = el('div', { class: 'he-tree' });
  const formHost = el('div', { class: 'he-form-host' });
  wrap.append(tree, formHost);
  container.replaceChildren(wrap);

  // ---------------- 树 ----------------
  function renderTree() {
    tree.replaceChildren();
    tree.append(el('div', { class: 'he-tree-title', text: '🏠 首页 Tour 卡' }));

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
        el('div', { class: 'he-tree-hint', text: '编辑整个区块的顶部小字（eyebrow）与标题（Tour Packages）。' }),
      ]));
    }
    tree.append(blockCat);

    // ② 卡片
    const cardsOpen = ui.open === 'cards';
    const cardsHead = el('div', { class: 'he-tree-cat-head' }, [
      el('span', { class: 'he-chevron', text: '▸', onclick: (e) => { e.stopPropagation(); ui.open = cardsOpen ? null : 'cards'; renderTree(); } }),
      el('span', {
        class: 'he-tree-cat-name', text: `卡片 (${data.cards.length})`,
        onclick: () => {
          ui.open = 'cards';
          if (sel.type !== 'card') sel = { type: 'card', index: 0 };
          renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel);
        },
      }),
      el('span', { class: 'he-tree-actions' }, [iconBtn('➕', '新增卡片', openAddCard)]),
    ]);
    const cardsCat = el('div', { class: 'he-tree-cat' + (cardsOpen ? ' open' : '') }, [cardsHead]);
    if (cardsOpen) {
      const body = el('div', { class: 'he-tree-cat-body' });
      data.cards.forEach((it, idx) => {
        const node = el('div', {
          class: 'he-tree-hotel' + (sel.type === 'card' && sel.index === idx ? ' active' : '') + (it.hidden ? ' is-hidden' : ''),
          draggable: true,
        }, [
          el('span', { class: 'he-tree-hotel-zh', text: (it.icon ? it.icon + ' ' : '') + (it.title || '(无标题)') }),
          el('span', { class: 'he-tree-hotel-en', text: it.id || '' }),
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
          iconBtn(it.hidden ? '🚫' : '👁', it.hidden ? '显示卡片' : '隐藏卡片', () => { it.hidden = !it.hidden; markDirty(); renderTree(); if (onSelectCb) onSelectCb(sel); }),
          iconBtn('🗑', '删除卡片', () => deleteCard(idx)),
        ]));
        body.append(node);
      });
      cardsCat.append(body);
    }
    tree.append(cardsCat);
  }

  function reorder(from, to) {
    const arr = data.cards;
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
    const it = data.cards[idx];
    if (!it) return;
    if (!confirm(`确认删除卡片「${it.title || it.id}」？\n\n只删除数据，不影响其它模块。`)) return;
    data.cards.splice(idx, 1);
    if (sel.type === 'card') {
      if (sel.index >= data.cards.length) {
        sel = data.cards.length ? { type: 'card', index: data.cards.length - 1 } : { type: 'block' };
      }
    }
    markDirty(); renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel);
  }

  function openAddCard() {
    data.cards.push({
      id: 'new-card-' + (data.cards.length + 1),
      icon: '🎟',
      iconBg: 'bg-sand',
      title: 'New Tour Card',
      subtitle: '',
      subtitleColor: 'stone-500',
      desc: '',
      features: [],
      price: 'From $0/person',
      buttonStyle: 'forest',
      popular: false,
      hidden: false,
    });
    ui.open = 'cards';
    sel = { type: 'card', index: data.cards.length - 1 };
    markDirty(); renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel);
  }

  // ---------------- 表单 ----------------
  function renderForm() {
    formHost.replaceChildren();
    if (sel.type === 'block') {
      formHost.append(el('div', { class: 'he-form-head' }, [el('span', { class: 'he-form-key', text: '区块设置' })]));
      formHost.append(textField({ label: '顶部小字 Eyebrow', tip: '金色大写小字，如 Choose Your Style' }, data.eyebrow, (v) => { data.eyebrow = v; markDirty(); }));
      formHost.append(textField({ label: '区块标题 Title', tip: '如 Tour Packages' }, data.title, (v) => { data.title = v; markDirty(); }));
      return;
    }

    const it = data.cards[sel.index];
    if (!it) { sel = { type: 'block' }; renderTree(); renderForm(); return; }
    const cardPv = { pv: { mode: 'card', anchor: 'tour-' + it.id + '-card' } };
    formHost.append(el('div', { class: 'he-form-head' }, [
      el('span', { class: 'he-form-zh', text: (it.icon ? it.icon + ' ' : '') + (it.title || '(无标题)') }),
      el('span', { class: 'he-form-key', text: `#${sel.index + 1} · ${it.id}` }),
    ]));

    // id
    const idInput = el('input', {
      type: 'text', value: it.id || '', placeholder: '小写字母/数字/连字符，决定锚点 tour-<id>-card',
      oninput: (e) => { it.id = e.target.value; markDirty(); },
    });
    formHost.append(withPv(el('div', { class: 'field' }, [
      el('label', {}, [el('span', { text: '卡片 id' }), el('span', { class: 'tip', text: ' 决定前台锚点 id（tour-<id>-card），被导航/共享卡片引用，改前确认无死链' })]),
      idInput,
    ]), cardPv));

    formHost.append(withPv(textField({ label: '图标 Emoji', tip: '如 📅 🎒 💎' }, it.icon, (v) => { it.icon = v; markDirty(); if (onSelectCb) onSelectCb(sel); }), cardPv));
    formHost.append(withPv(selectField({ label: '图标底色 Icon BG', tip: '圆底配色' }, it.iconBg, (v) => { it.iconBg = v; markDirty(); if (onSelectCb) onSelectCb(sel); }, ICON_BG_OPTIONS), cardPv));
    formHost.append(withPv(textField({ label: '标题 Title' }, it.title, (v) => { it.title = v; markDirty(); if (onSelectCb) onSelectCb(sel); }), cardPv));
    formHost.append(withPv(textField({ label: '副标题 Subtitle', tip: '如 One-day highlights / Most Popular ★' }, it.subtitle, (v) => { it.subtitle = v; markDirty(); }), cardPv));
    formHost.append(withPv(selectField({ label: '副标题颜色 Subtitle Color' }, it.subtitleColor, (v) => { it.subtitleColor = v; markDirty(); }, SUBTITLE_COLOR_OPTIONS), cardPv));
    formHost.append(withPv(longField({ label: '描述 Description', rows: 3 }, it.desc, (v) => { it.desc = v; markDirty(); }), cardPv));
    formHost.append(withPv(stringListEditor('特性 Features（每行一条，✓ 自动加）', it.features || (it.features = []), null), cardPv));
    formHost.append(withPv(textField({ label: '价格 Price', tip: '完整展示串，如 From $129/person；$数字 自动金色' }, it.price, (v) => { it.price = v; markDirty(); if (onSelectCb) onSelectCb(sel); }), cardPv));
    formHost.append(withPv(selectField({ label: '按钮配色 Button Style' }, it.buttonStyle, (v) => { it.buttonStyle = v; markDirty(); if (onSelectCb) onSelectCb(sel); }, BTN_OPTIONS), cardPv));

    // popular / hidden 开关
    const popularChk = el('input', { type: 'checkbox', checked: !!it.popular, onchange: (e) => { it.popular = e.target.checked; markDirty(); if (onSelectCb) onSelectCb(sel); } });
    formHost.append(withPv(el('div', { class: 'field field-inline' }, [popularChk, el('label', { class: 'chk', text: '高亮推荐（加金边环，如 Most Popular）' })]), cardPv));
    const hiddenChk = el('input', { type: 'checkbox', checked: !!it.hidden, onchange: (e) => { it.hidden = e.target.checked; markDirty(); if (onSelectCb) onSelectCb(sel); } });
    formHost.append(withPv(el('div', { class: 'field field-inline' }, [hiddenChk, el('label', { class: 'chk', text: '隐藏此卡片（前台不渲染）' })]), cardPv));
  }

  renderTree();
  renderForm();
}

// ============================================================
// 预览区：iframe srcdoc（复用站点真实 CSS → 所见即所得）
// ============================================================
export function renderPreview(container, d, selection) {
  data = d || data;
  const grid = buildHomeTourCardsHtml(data);
  const previewGrid = grid
    .replace(/ fade-in/g, '')
    .replace(/src="images\//g, 'src="../images/')
    .replace(/href="tours\//g, 'href="../tours/');
  const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="../styles/tailwind.css"><style>body{margin:0;padding:18px;background:#f3efe7}</style></head><body>${previewGrid}</body></html>`;

  const tag = (selection && selection.type === 'card' && data.cards[selection.index]) ? data.cards[selection.index].id : currentCardId();
  const iframe = ensurePreviewFrame(container, { cls: 'pv-detail-iframe', title: '首页 Tour 卡 实时预览', bg: '#f3efe7' });
  onFrameLoad(iframe, () => {
    const idoc = iframe.contentDocument;
    if (!idoc) return;
    if (tag) {
      const card = idoc.getElementById('tour-' + tag + '-card');
      if (card) { card.style.outline = '3px solid #2563eb'; card.style.outlineOffset = '2px'; }
    }
  });
  setPreviewSrcdoc(iframe, doc, tag);
}
