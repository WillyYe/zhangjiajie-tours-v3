// 首页 Top 8 Must-See Spots 后台模块（与酒店模块同布局：左树 / 中表单 / 右实时预览）
// 数据来自 home-data.mjs 的 topAttractions 块（纯文字表格：# / Spot / Highlight / Time / Vibe）。
// 右栏预览复用 top-attractions-render.js 的 buildTopAttractionsHtml（与 build 同源 → 所见即所得）。
// 选中某一行时可切到「详情页预览」tab，复用景点详情页真实模板（与 attractions 模块预览同源）。
import { buildTopAttractionsHtml } from './top-attractions-render.js';
import { renderSpotDetailPreview } from './spot-core.js';
import { bindResizer } from '../resizer.js';

let data = null;
let sel = { type: 'block' }; // 'block' | { type: 'card', index }
const ui = { open: 'block' }; // 当前展开的分组

// ---------- DOM helpers（镜像 hero.js / hotels.js） ----------
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
  else console.log('[top-attractions] ' + msg);
}

// 当前选中行的 slug（用于详情页预览关联）
function currentSlug() {
  if (sel.type === 'card' && data.items[sel.index]) return data.items[sel.index].slug;
  return null;
}

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
  const treeResizer = el('div', { class: 'resizer', 'data-resizer': 'tree', title: '左右拖动调整分类树宽度' });
  bindResizer(treeResizer);
  wrap.append(tree, treeResizer, formHost);
  container.replaceChildren(wrap);

  // ---------------- 树 ----------------
  function renderTree() {
    tree.replaceChildren();
    tree.append(el('div', { class: 'he-tree-title', text: 'Top 8 Must-See Spots' }));

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
        el('div', { class: 'he-tree-hint', text: '编辑整个区块的标题、副标题与顶部小字。' }),
      ]));
    }
    tree.append(blockCat);

    // ② 表格行
    const rowsOpen = ui.open === 'rows';
    const rowsHead = el('div', { class: 'he-tree-cat-head' }, [
      el('span', { class: 'he-chevron', text: '▸', onclick: (e) => { e.stopPropagation(); ui.open = rowsOpen ? null : 'rows'; renderTree(); } }),
      el('span', {
        class: 'he-tree-cat-name', text: `表格行 (${data.items.length})`,
        onclick: () => {
          ui.open = 'rows';
          if (sel.type !== 'card') sel = { type: 'card', index: 0 };
          renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel);
        },
      }),
      el('span', { class: 'he-tree-actions' }, [iconBtn('➕', '新增行', openAddRow)]),
    ]);
    const rowsCat = el('div', { class: 'he-tree-cat' + (rowsOpen ? ' open' : '') }, [rowsHead]);
    if (rowsOpen) {
      const body = el('div', { class: 'he-tree-cat-body' });
      data.items.forEach((it, idx) => {
        const node = el('div', {
          class: 'he-tree-hotel' + (sel.type === 'card' && sel.index === idx ? ' active' : '') + (it.hidden ? ' is-hidden' : ''),
          draggable: true,
        }, [
          el('span', { class: 'he-tree-hotel-zh', text: (it.rank != null ? it.rank + '. ' : '') + (it.spot || '(无标题)') }),
          el('span', { class: 'he-tree-hotel-en', text: it.slug || '' }),
        ]);
        node.onclick = () => { ui.open = 'rows'; sel = { type: 'card', index: idx }; renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel); };
        node.ondragstart = (e) => { e.dataTransfer.setData('text/plain', String(idx)); e.dataTransfer.effectAllowed = 'move'; };
        node.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; node.classList.add('drag-over'); };
        node.ondragleave = () => node.classList.remove('drag-over');
        node.ondrop = (e) => {
          e.preventDefault(); node.classList.remove('drag-over');
          const src = parseInt(e.dataTransfer.getData('text/plain'), 10);
          if (!isNaN(src) && src !== idx) reorder(src, idx);
        };
        node.append(el('span', { class: 'he-tree-hotel-acts' }, [
          iconBtn(it.hidden ? '🚫' : '👁', it.hidden ? '显示行' : '隐藏行', () => { it.hidden = !it.hidden; markDirty(); renderTree(); if (onSelectCb) onSelectCb(sel); }),
          iconBtn('🗑', '删除行', () => deleteRow(idx)),
        ]));
        body.append(node);
      });
      rowsCat.append(body);
    }
    tree.append(rowsCat);
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

  function deleteRow(idx) {
    const it = data.items[idx];
    if (!it) return;
    if (!confirm(`确认删除行「${it.spot || it.slug}」？\n\n只删除数据，不影响其它模块。`)) return;
    data.items.splice(idx, 1);
    if (sel.type === 'card') {
      if (sel.index >= data.items.length) {
        sel = data.items.length ? { type: 'card', index: data.items.length - 1 } : { type: 'block' };
      }
    }
    markDirty(); renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel);
  }

  function openAddRow() {
    data.items.push({
      slug: 'new-spot-' + (data.items.length + 1),
      rank: data.items.length + 1, spot: 'New Spot', highlight: '', time: '', vibe: '', hidden: false,
    });
    ui.open = 'rows';
    sel = { type: 'card', index: data.items.length - 1 };
    markDirty(); renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel);
  }

  // ---------------- 表单 ----------------
  function renderForm() {
    formHost.replaceChildren();
    if (sel.type === 'block') {
      formHost.append(
        el('div', { class: 'he-form-head' }, [el('span', { class: 'he-form-key', text: '区块设置' })]),
      );
      formHost.append(textField({ label: '顶部小字 Eyebrow', tip: "金色大写小字，如 Don't Miss These" }, data.eyebrow, (v) => { data.eyebrow = v; markDirty(); }));
      formHost.append(textField({ label: '区块标题 Title', tip: '区块主标题' }, data.title, (v) => { data.title = v; markDirty(); }));
      formHost.append(longField({ label: '副标题 Subtitle', tip: '区块下方一句说明', rows: 3 }, data.subtitle, (v) => { data.subtitle = v; markDirty(); }));
      return;
    }

    const it = data.items[sel.index];
    if (!it) { sel = { type: 'block' }; renderTree(); renderForm(); return; }
    formHost.append(
      el('div', { class: 'he-form-head' }, [
        el('span', { class: 'he-form-zh', text: it.spot || '(无标题)' }),
        el('span', { class: 'he-form-key', text: `#${sel.index + 1} · ${it.slug}` }),
      ]),
    );

    // Slug（关联景点详情页预览，运营一般不动）
    const slugInput = el('input', {
      type: 'text', value: it.slug || '', placeholder: '小写字母/数字/连字符',
      oninput: (e) => { it.slug = e.target.value; markDirty(); },
    });
    const genBtn = el('button', {
      type: 'button', class: 'btn btn-sm btn-ghost', text: '↻ 由标题生成',
      onclick: () => { const s = slugify(it.spot || ''); slugInput.value = s; it.slug = s; markDirty(); },
    });
    formHost.append(el('div', { class: 'field' }, [
      el('label', {}, [el('span', { text: 'Slug' }), el('span', { class: 'tip', text: ' 关联后台「详情页预览」tab 的景点（attractions/<slug>.html）' })]),
      el('div', { class: 'img-field' }, [slugInput, genBtn]),
    ]));

    formHost.append(textField({ label: '序号 Rank', tip: '表格第 1 列 #，留空按列表顺序' }, String(it.rank != null ? it.rank : ''), (v) => { it.rank = v === '' ? null : (parseInt(v, 10) || 0); markDirty(); }));
    formHost.append(textField({ label: 'Spot 景点名', tip: '表格第 2 列' }, it.spot, (v) => { it.spot = v; markDirty(); if (onSelectCb) onSelectCb(sel); }));
    formHost.append(textField({ label: 'Highlight 亮点', tip: '表格第 3 列，一句话亮点' }, it.highlight, (v) => { it.highlight = v; markDirty(); }));
    formHost.append(textField({ label: 'Time 用时', tip: '表格第 4 列，如 3–4 hrs' }, it.time, (v) => { it.time = v; markDirty(); }));
    formHost.append(textField({ label: 'Vibe 氛围', tip: '表格第 5 列，可带 emoji' }, it.vibe, (v) => { it.vibe = v; markDirty(); }));

    const hiddenBtn = el('button', {
      type: 'button', class: 'btn btn-sm',
      text: it.hidden ? '👁 显示此行' : '🚫 隐藏此行（前台不渲染）',
      onclick: () => { it.hidden = !it.hidden; markDirty(); renderTree(); if (onSelectCb) onSelectCb(sel); },
    });
    formHost.append(el('div', { class: 'field' }, [hiddenBtn]));
  }

  renderTree();
  renderForm();
}

// ============================================================
// 预览区：iframe srcdoc（复用站点真实 CSS → 所见即所得）
// 注意：不要注入 <base href="../">。iframe srcdoc 继承父 URL = /admin/，
// 下面路径已用 ../（如 ../styles/tailwind.css），从 /admin/ 出发 = 根/... 正确解析。
// 预览去掉 fade-in 保证始终可见。
// ============================================================
export function renderPreview(container, d, selection) {
  data = d || data;
  const tbl = buildTopAttractionsHtml(data);
  const previewTbl = tbl.replace(/ fade-in/g, '');
  const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="../styles/tailwind.css"><style>body{margin:0;padding:18px;background:#f3efe7}</style></head><body>${previewTbl}</body></html>`;

  container.replaceChildren();
  const iframe = el('iframe', {
    class: 'pv-detail-iframe',
    title: 'Top 8 Must-See Spots 实时预览',
    style: 'width:100%;height:100%;border:0;background:#f3efe7',
  });
  container.append(iframe);
  iframe.addEventListener('load', () => {
    const idoc = iframe.contentDocument;
    if (!idoc) return;
    const slug = (selection && selection.type === 'card' && data.items[selection.index]) ? data.items[selection.index].slug : currentSlug();
    if (slug) {
      const row = idoc.getElementById('spot-' + slug);
      if (row) { row.style.outline = '3px solid #2563eb'; row.style.outlineOffset = '2px'; }
    }
  }, { once: true });
  iframe.srcdoc = doc;
}

// ============================================================
// 详情页预览：用真实模板 templates/attraction-page.html + 实时 attractions-data.mjs
// 渲染（所见即所得），不再 fetch 已部署页（只读、易过期、与后台数据漂移）。
// 复用 spot-core 的 renderSpotDetailPreview（单一真源 → 与「景点详情页」模块预览完全一致）。
// ============================================================
export async function renderAttractionDetailPreview(container, slug) {
  container.replaceChildren();
  if (!slug) {
    container.replaceChildren(el('div', { class: 'pv-loading', text: '未选择景点卡片，无法预览详情页。' }));
    return;
  }
  try {
    const mod = await import('../../attractions-data.mjs');
    const arr = mod.attractions || [];
    await renderSpotDetailPreview(container, arr, slug, 'attraction');
  } catch (e) {
    container.replaceChildren(el('div', { class: 'pv-loading', text: '加载详情数据失败：' + e.message }));
  }
}
