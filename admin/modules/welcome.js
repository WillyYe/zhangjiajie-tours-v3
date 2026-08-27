// 欢迎区 Welcome 后台模块（与 top-attractions 同布局：左树 / 中表单 / 右实时预览）
// 数据来自 home-data.mjs 的 welcome 块；图片仅限 images/welcome/（物理隔离，不借图）。
// 右栏预览复用 welcome-render.js 的 buildWelcome（与 build 同源 → 所见即所得）。
import { createImageLib } from '../imglib-core.js';
import { buildWelcome } from './welcome-render.js';
import { ensurePreviewFrame, setPreviewSrcdoc } from '../preview-frame.js';
import { withPv } from '../pv-anchor.js';

let data = null;
let sel = { type: 'block' }; // 'block' | { type: 'para', index } | { type: 'stat', index }
const ui = { open: 'block' }; // 当前展开的分组

const wLib = createImageLib({
  slug: 'welcome',
  findReferences: (name) => (data && data.bgImg === name) ? ['欢迎区背景图'] : [],
});

// ---------- DOM helpers（镜像 top-attractions.js / hero.js） ----------
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

function imageField(field, value, onInput) {
  const thumbBox = el('div', { class: 'he-thumb-box' + (value ? '' : ' no-img') });
  const thumb = el('img', { class: 'he-thumb', src: value ? wLib.imgUrl(value) : '' });
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
      if (v) { thumb.src = wLib.imgUrl(v); thumbBox.classList.remove('no-img'); }
      else { thumb.src = ''; thumbBox.classList.add('no-img'); }
    },
  });
  const btn = el('button', {
    type: 'button',
    class: 'btn btn-sm btn-ghost',
    text: '浏览图片库',
    onclick: () => wLib.open(thumbBox, thumb, input, onInput),
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

// 上下移 + 删除 操作按钮组（按边界禁用上/下）
function moveBtns(type, idx, len) {
  return el('span', { class: 'he-tree-hotel-acts' }, [
    iconBtn('上移', '上移', () => { if (idx > 0) reorder(type, idx, idx - 1); }),
    iconBtn('下移', '下移', () => { if (idx < len - 1) reorder(type, idx, idx + 1); }),
    iconBtn('删除', '删除', () => deleteItem(type, idx)),
  ]);
}

let onChangeCb = null;
let onSelectCb = null;
function markDirty() { if (onChangeCb) onChangeCb(); }
function notify(msg, type) {
  if (typeof window !== 'undefined' && typeof window.__adminToast === 'function') window.__adminToast(msg, type);
  else console.log('[welcome] ' + msg);
}

// ============================================================
// 编辑区：左树 + 中表单
// ============================================================
export function renderEditor(container, welcome, onChange, onSelect) {
  data = welcome || { eyebrow: '', h2: '', paras: [], stats: [], bgImg: '' };
  onChangeCb = onChange;
  onSelectCb = onSelect;
  if ((sel.type === 'para' || sel.type === 'stat')) {
    const arr = sel.type === 'para' ? data.paras : data.stats;
    if (!arr[sel.index]) sel = { type: 'block' };
  }

  const wrap = el('div', { class: 'he' });
  const tree = el('div', { class: 'he-tree' });
  const formHost = el('div', { class: 'he-form-host' });
  wrap.append(tree, formHost);
  container.replaceChildren(wrap);

  // ---------------- 树 ----------------
  function renderTree() {
    tree.replaceChildren();
    tree.append(el('div', { class: 'he-tree-title', text: '欢迎区 Welcome' }));

    // ① 区块设置
    const blockOpen = ui.open === 'block';
    const blockHead = el('div', {
      class: 'he-tree-cat-head' + (sel.type === 'block' ? ' active' : ''),
    }, [
      el('span', { class: 'he-chevron', text: '▸', onclick: (e) => { e.stopPropagation(); ui.open = blockOpen ? null : 'block'; renderTree(); } }),
      el('span', {
        class: 'he-tree-cat-name', text: '区块设置（标题 / 背景图）',
        onclick: () => { ui.open = 'block'; sel = { type: 'block' }; renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel); },
      }),
    ]);
    const blockCat = el('div', { class: 'he-tree-cat' + (blockOpen ? ' open' : '') + (sel.type === 'block' ? ' is-active' : '') }, [blockHead]);
    if (blockOpen) {
      blockCat.append(el('div', { class: 'he-tree-cat-body' }, [
        el('div', { class: 'he-tree-hint', text: '编辑欢迎区的顶部小字、主标题与背景图。' }),
      ]));
    }
    tree.append(blockCat);

    // ② 介绍段落 Paras
    const parasOpen = ui.open === 'paras';
    const parasHead = el('div', { class: 'he-tree-cat-head' }, [
      el('span', { class: 'he-chevron', text: '▸', onclick: (e) => { e.stopPropagation(); ui.open = parasOpen ? null : 'paras'; renderTree(); } }),
      el('span', {
        class: 'he-tree-cat-name', text: `介绍段落 (${data.paras.length})`,
        onclick: () => {
          ui.open = 'paras';
          if (sel.type !== 'para') sel = { type: 'para', index: 0 };
          renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel);
        },
      }),
      el('span', { class: 'he-tree-actions' }, [iconBtn('➕', '新增段落', () => addItem('para'))]),
    ]);
    const parasCat = el('div', { class: 'he-tree-cat' + (parasOpen ? ' open' : '') }, [parasHead]);
    if (parasOpen) {
      const body = el('div', { class: 'he-tree-cat-body' });
      data.paras.forEach((p, idx) => {
        const preview = (p || '').replace(/\*/g, '').slice(0, 30) + ((p || '').length > 30 ? '…' : '');
        const node = el('div', {
          class: 'he-tree-hotel' + (sel.type === 'para' && sel.index === idx ? ' active' : ''),
        }, [
          el('span', { class: 'he-tree-hotel-zh', text: preview || '(空段落)' }),
        ]);
        node.onclick = () => { ui.open = 'paras'; sel = { type: 'para', index: idx }; renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel); };
        node.append(moveBtns('para', idx, data.paras.length));
        body.append(node);
      });
      parasCat.append(body);
    }
    tree.append(parasCat);

    // ③ 数据指标 Stats
    const statsOpen = ui.open === 'stats';
    const statsHead = el('div', { class: 'he-tree-cat-head' }, [
      el('span', { class: 'he-chevron', text: '▸', onclick: (e) => { e.stopPropagation(); ui.open = statsOpen ? null : 'stats'; renderTree(); } }),
      el('span', {
        class: 'he-tree-cat-name', text: `数据指标 (${data.stats.length})`,
        onclick: () => {
          ui.open = 'stats';
          if (sel.type !== 'stat') sel = { type: 'stat', index: 0 };
          renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel);
        },
      }),
      el('span', { class: 'he-tree-actions' }, [iconBtn('➕', '新增指标', () => addItem('stat'))]),
    ]);
    const statsCat = el('div', { class: 'he-tree-cat' + (statsOpen ? ' open' : '') }, [statsHead]);
    if (statsOpen) {
      const body = el('div', { class: 'he-tree-cat-body' });
      data.stats.forEach((s, idx) => {
        const label = `${s.num || ''} ${s.label || ''}`.trim() || '(空指标)';
        const node = el('div', {
          class: 'he-tree-hotel' + (sel.type === 'stat' && sel.index === idx ? ' active' : ''),
        }, [
          el('span', { class: 'he-tree-hotel-zh', text: label }),
        ]);
        node.onclick = () => { ui.open = 'stats'; sel = { type: 'stat', index: idx }; renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel); };
        node.append(moveBtns('stat', idx, data.stats.length));
        body.append(node);
      });
      statsCat.append(body);
    }
    tree.append(statsCat);
  }

  function reorder(type, from, to) {
    const arr = type === 'para' ? data.paras : data.stats;
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    if (sel.type === type) {
      if (sel.index === from) sel.index = to;
      else if (from < sel.index && sel.index <= to) sel.index--;
      else if (to <= sel.index && sel.index < from) sel.index++;
    }
    markDirty(); renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel);
  }

  function deleteItem(type, idx) {
    const arr = type === 'para' ? data.paras : data.stats;
    const it = arr[idx];
    if (!it) return;
    const name = type === 'para' ? ('段落 #' + (idx + 1)) : ('指标「' + ((it.num || it.label || '') + '」'));
    if (!confirm(`确认删除${name}？`)) return;
    arr.splice(idx, 1);
    if (sel.type === type) {
      if (sel.index >= arr.length) {
        sel = arr.length ? { type, index: arr.length - 1 } : { type: 'block' };
      }
    }
    markDirty(); renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel);
  }

  function addItem(type) {
    if (type === 'para') {
      data.paras.push('');
      ui.open = 'paras';
      sel = { type: 'para', index: data.paras.length - 1 };
    } else {
      data.stats.push({ num: '', label: '' });
      ui.open = 'stats';
      sel = { type: 'stat', index: data.stats.length - 1 };
    }
    markDirty(); renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel);
  }

  // ---------------- 表单 ----------------
  function renderForm() {
    formHost.replaceChildren();
    if (sel.type === 'block') {
      formHost.append(
        el('div', { class: 'he-form-head' }, [el('span', { class: 'he-form-key', text: '区块设置' })]),
      );
      formHost.append(textField({ label: '顶部小字 Eyebrow', tip: '金色大写小字，如 UNESCO World Heritage Site', pv: { mode: '', anchor: 'welcome-eyebrow' } }, data.eyebrow, (v) => { data.eyebrow = v; markDirty(); }));
      formHost.append(textField({ label: '主标题 H2', tip: '欢迎区主标题', pv: { mode: '', anchor: 'welcome-h2' } }, data.h2, (v) => { data.h2 = v; markDirty(); }));
      formHost.append(imageField({ label: '背景图 Background', tip: '仅 images/welcome/ 图库（点击浏览可上传/删除）', pv: { mode: '', anchor: 'welcome-bg' } }, data.bgImg, (v) => { data.bgImg = v; markDirty(); }));
      return;
    }

    if (sel.type === 'para') {
      const p = data.paras[sel.index] || '';
      formHost.append(
        el('div', { class: 'he-form-head' }, [
          el('span', { class: 'he-form-zh', text: '介绍段落' }),
          el('span', { class: 'he-form-key', text: `#${sel.index + 1}` }),
        ]),
      );
      formHost.append(longField({ label: '段落正文', tip: '用 *星号* 包住要强调的文字', rows: 6, pv: { mode: '', anchor: 'welcome-para-' + sel.index } }, p, (v) => { data.paras[sel.index] = v; markDirty(); }));
      formHost.append(el('div', { class: 'field' }, [moveBtns('para', sel.index, data.paras.length)]));
      return;
    }

    // stat
    if (!data.stats[sel.index]) data.stats[sel.index] = { num: '', label: '' };
    const s = data.stats[sel.index];
    formHost.append(
      el('div', { class: 'he-form-head' }, [
        el('span', { class: 'he-form-zh', text: '数据指标' }),
        el('span', { class: 'he-form-key', text: `#${sel.index + 1}` }),
      ]),
    );
    formHost.append(textField({ label: '数值 Num', tip: '如 3,000+ / 54%', pv: { mode: '', anchor: 'welcome-stat-' + sel.index } }, s.num, (v) => { s.num = v; markDirty(); }));
    formHost.append(textField({ label: '标签 Label', tip: '如 Sandstone Pillars', pv: { mode: '', anchor: 'welcome-stat-' + sel.index } }, s.label, (v) => { s.label = v; markDirty(); }));
    formHost.append(el('div', { class: 'field' }, [moveBtns('stat', sel.index, data.stats.length)]));
  }

  renderTree();
  renderForm();
}

// ============================================================
// 预览区：iframe srcdoc（复用站点真实 CSS → 所见即所得）
// 预览去掉 fade-in 保证始终可见；图片/链接改 ../ 前缀以适配 /admin/ 基址。
// ============================================================
export function renderPreview(container, welcome, selection) {
  data = welcome || data;
  const grid = buildWelcome(data);
  const previewGrid = grid
    .replace(/ fade-in/g, '')
    .replace(/src="images\//g, 'src="../images/')
    .replace(/url\('images\//g, "url('../images/")
    .replace(/href="(attractions|experiences|tours)\//g, 'href="../$1/');
  const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="../styles/tailwind.css"><style>body{margin:0;padding:18px;background:#f3efe7}</style></head><body>${previewGrid}</body></html>`;

  const iframe = ensurePreviewFrame(container, { cls: 'pv-detail-iframe', title: '欢迎区实时预览', bg: '#f3efe7' });
  setPreviewSrcdoc(iframe, doc);
}
