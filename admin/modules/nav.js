// 顶部导航 Nav 后台模块（与 welcome / top-attractions 同布局：左树 / 中表单 / 右实时预览）
// 数据来自 home-data.mjs 的 siteNav 块；导航无自有图库（Hotels 占位交由 buildIndexNav 填充）。
// 右栏预览复用 nav-render.js 的 buildSiteNavMega / buildSiteNavMobile（与 build 同源 → 所见即所得）。
import { buildSiteNavMega, buildSiteNavMobile } from './nav-render.js';
import { ensurePreviewFrame, setPreviewSrcdoc } from '../preview-frame.js';

let data = null;
let sel = { type: 'block' }; // 'block' | { type: 'item', index } | { type: 'child', itemIdx, childIdx }
const ui = { open: 'items' }; // 当前展开的分组

// ---------- DOM helpers（镜像 welcome.js / top-attractions.js） ----------
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

function iconBtn(icon, title, handler) {
  return el('button', {
    class: 'he-act', type: 'button', title, text: icon,
    onclick: (e) => { e.stopPropagation(); handler(); },
  });
}

// 上下移 + 删除 操作按钮组
function moveBtns(handler_up, handler_down, handler_del) {
  return el('span', { class: 'he-tree-hotel-acts' }, [
    iconBtn('上移', '上移', handler_up),
    iconBtn('下移', '下移', handler_down),
    iconBtn('删除', '删除', handler_del),
  ]);
}

let onChangeCb = null;
let onSelectCb = null;
function markDirty() { if (onChangeCb) onChangeCb(); }

// 判断是否为 Hotels 占位项
function isHotelsItem(it) {
  const url = it.url || '';
  return /(^|\/)hotels\//.test(url) || it.label === 'Hotels';
}

// ============================================================
// 编辑区：左树 + 中表单
// ============================================================
export function renderEditor(container, siteNav, onChange, onSelect) {
  data = siteNav || { items: [] };
  if (!Array.isArray(data.items)) data.items = [];
  onChangeCb = onChange;
  onSelectCb = onSelect;
  if (sel.type === 'item' && !data.items[sel.index]) sel = { type: 'block' };
  if (sel.type === 'child' && (!data.items[sel.itemIdx] || !data.items[sel.itemIdx].children[sel.childIdx])) sel = { type: 'block' };

  const wrap = el('div', { class: 'he' });
  const tree = el('div', { class: 'he-tree' });
  const formHost = el('div', { class: 'he-form-host' });
  wrap.append(tree, formHost);
  container.replaceChildren(wrap);

  // ---------------- 树 ----------------
  function renderTree() {
    tree.replaceChildren();
    tree.append(el('div', { class: 'he-tree-title', text: '顶部导航 Nav' }));

    // ① 说明
    const blockOpen = ui.open === 'block';
    const blockHead = el('div', { class: 'he-tree-cat-head' + (sel.type === 'block' ? ' active' : '') }, [
      el('span', { class: 'he-chevron', text: '▸', onclick: (e) => { e.stopPropagation(); ui.open = blockOpen ? null : 'block'; renderTree(); } }),
      el('span', {
        class: 'he-tree-cat-name', text: '说明 / 规则',
        onclick: () => { ui.open = 'block'; sel = { type: 'block' }; renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel); },
      }),
    ]);
    const blockCat = el('div', { class: 'he-tree-cat' + (blockOpen ? ' open' : '') + (sel.type === 'block' ? ' is-active' : '') }, [blockHead]);
    if (blockOpen) {
      blockCat.append(el('div', { class: 'he-tree-cat-body' }, [
        el('div', { class: 'he-tree-hint', text: '一级菜单即首页顶部导航。勾选“隐藏”的项前台不渲染。Hotels 项自动输出酒店二级菜单（与分类同步）。url 以 # 开头（如 #contact）渲染为按钮。' }),
      ]));
    }
    tree.append(blockCat);

    // ② 菜单项
    const itemsOpen = ui.open === 'items';
    const itemsHead = el('div', { class: 'he-tree-cat-head' }, [
      el('span', { class: 'he-chevron', text: '▸', onclick: (e) => { e.stopPropagation(); ui.open = itemsOpen ? null : 'items'; renderTree(); } }),
      el('span', {
        class: 'he-tree-cat-name', text: `菜单项 (${data.items.length})`,
        onclick: () => {
          ui.open = 'items';
          if (sel.type !== 'item' && sel.type !== 'child') sel = { type: 'item', index: 0 };
          renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel);
        },
      }),
      el('span', { class: 'he-tree-actions' }, [iconBtn('➕', '新增菜单项', openAddItem)]),
    ]);
    const itemsCat = el('div', { class: 'he-tree-cat' + (itemsOpen ? ' open' : '') }, [itemsHead]);
    if (itemsOpen) {
      const body = el('div', { class: 'he-tree-cat-body' });
      data.items.forEach((it, idx) => {
        const children = Array.isArray(it.children) ? it.children.filter((c) => !c.hidden) : [];
        const tag = isHotelsItem(it) ? ' 🏨' : (it.hidden ? ' 🚫' : '');
        const node = el('div', {
          class: 'he-tree-hotel' + (sel.type === 'item' && sel.index === idx ? ' active' : '') + (it.hidden ? ' is-hidden' : ''),
          draggable: true,
        }, [
          el('span', { class: 'he-tree-hotel-zh', text: (it.label || '(无标签)') + tag }),
          el('span', { class: 'he-tree-hotel-en', text: (children.length ? `▾ ${children.length} 子项` : (it.url || '')) }),
        ]);
        node.onclick = () => { ui.open = 'items'; sel = { type: 'item', index: idx }; renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel); };
        node.ondragstart = (e) => { e.dataTransfer.setData('text/plain', String(idx)); e.dataTransfer.effectAllowed = 'move'; };
        node.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; node.classList.add('drag-over'); };
        node.ondragleave = () => node.classList.remove('drag-over');
        node.ondrop = (e) => {
          e.preventDefault(); node.classList.remove('drag-over');
          const src = parseInt(e.dataTransfer.getData('text/plain'), 10);
          if (!isNaN(src) && src !== idx) reorderItem(src, idx);
        };
        node.append(moveBtns(
          () => { if (idx > 0) reorderItem(idx, idx - 1); },
          () => { if (idx < data.items.length - 1) reorderItem(idx, idx + 1); },
          () => deleteItem(idx),
        ));
        body.append(node);
      });
      itemsCat.append(body);
    }
    tree.append(itemsCat);
  }

  function reorderItem(from, to) {
    const arr = data.items;
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    if (sel.type === 'item') {
      if (sel.index === from) sel.index = to;
      else if (from < sel.index && sel.index <= to) sel.index--;
      else if (to <= sel.index && sel.index < from) sel.index++;
    }
    markDirty(); renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel);
  }

  function deleteItem(idx) {
    const it = data.items[idx];
    if (!it) return;
    if (!confirm(`确认删除菜单项「${it.label || it.url}」？`)) return;
    data.items.splice(idx, 1);
    if (sel.type === 'item') {
      if (sel.index >= data.items.length) {
        sel = data.items.length ? { type: 'item', index: data.items.length - 1 } : { type: 'block' };
      }
    }
    markDirty(); renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel);
  }

  function openAddItem() {
    data.items.push({ label: 'New Item', url: '#', hidden: false, children: [] });
    ui.open = 'items';
    sel = { type: 'item', index: data.items.length - 1 };
    markDirty(); renderTree(); renderForm(); if (onSelectCb) onSelectCb(sel);
  }

  // ---------------- 表单 ----------------
  function renderForm() {
    formHost.replaceChildren();
    if (sel.type === 'block') {
      formHost.append(el('div', { class: 'he-form-head' }, [el('span', { class: 'he-form-key', text: '说明 / 规则' })]));
      formHost.append(el('div', { class: 'field' }, [
        el('div', { class: 'he-tree-hint', text: '点开左侧「菜单项」分组编辑顶部导航。隐藏项前台不渲染；Hotels 项自动输出酒店二级菜单。' }),
      ]));
      return;
    }

    if (sel.type === 'item') {
      const it = data.items[sel.index];
      if (!it) { sel = { type: 'block' }; renderTree(); renderForm(); return; }
      formHost.append(el('div', { class: 'he-form-head' }, [
        el('span', { class: 'he-form-zh', text: it.label || '(无标签)' }),
        el('span', { class: 'he-form-key', text: `#${sel.index + 1}` }),
      ]));
      formHost.append(textField({ label: '标签 Label', tip: '菜单显示文字' }, it.label, (v) => { it.label = v; markDirty(); }));
      formHost.append(textField({ label: '链接 Url', tip: '页面路径；#contact 渲染为按钮', placeholder: 'index.html / attractions/index.html / #contact' }, it.url, (v) => { it.url = v; markDirty(); }));
      // 隐藏切换
      const hiddenBtn = el('button', {
        type: 'button', class: 'btn btn-sm',
        text: it.hidden ? '👁 显示此菜单项' : '🚫 隐藏此菜单项（前台不渲染）',
        onclick: () => { it.hidden = !it.hidden; markDirty(); renderTree(); if (onSelectCb) onSelectCb(sel); },
      });
      formHost.append(el('div', { class: 'field' }, [hiddenBtn]));
      // 二级子项
      if (!Array.isArray(it.children)) it.children = [];
      formHost.append(el('div', { class: 'he-subhead', text: `二级子项 (${it.children.length})` }));
      it.children.forEach((c, cidx) => {
        const row = el('div', { class: 'he-subrow' + (c.hidden ? ' is-hidden' : '') }, [
          el('input', { type: 'text', value: c.label || '', placeholder: '子项标签', class: 'he-sub-input', oninput: (e) => { c.label = e.target.value; markDirty(); } }),
          el('input', { type: 'text', value: c.url || '', placeholder: '子项链接', class: 'he-sub-input', oninput: (e) => { c.url = e.target.value; markDirty(); } }),
          iconBtn(c.hidden ? '👁' : '🚫', c.hidden ? '显示子项' : '隐藏子项', () => { c.hidden = !c.hidden; markDirty(); renderForm(); }),
          iconBtn('上移', '上移', () => { if (cidx > 0) reorderChild(it, cidx, cidx - 1); }),
          iconBtn('下移', '下移', () => { if (cidx < it.children.length - 1) reorderChild(it, cidx, cidx + 1); }),
          iconBtn('删除', '删除子项', () => {
            if (confirm(`确认删除子项「${c.label || c.url}」？`)) { it.children.splice(cidx, 1); markDirty(); renderForm(); }
          }),
        ]);
        formHost.append(row);
      });
      const addChildBtn = el('button', {
        type: 'button', class: 'btn btn-sm btn-ghost', text: '➕ 新增二级子项',
        onclick: () => { it.children.push({ label: 'New Sub', url: '#' }); markDirty(); renderForm(); },
      });
      formHost.append(el('div', { class: 'field' }, [addChildBtn]));
      formHost.append(el('div', { class: 'field' }, [moveBtns(
        () => { if (sel.index > 0) reorderItem(sel.index, sel.index - 1); },
        () => { if (sel.index < data.items.length - 1) reorderItem(sel.index, sel.index + 1); },
        () => deleteItem(sel.index),
      )]));
      return;
    }
  }

  function reorderChild(it, from, to) {
    const arr = it.children;
    const [m] = arr.splice(from, 1);
    arr.splice(to, 0, m);
    markDirty(); renderForm();
  }

  renderTree();
  renderForm();
}

// ============================================================
// 预览区：iframe srcdoc（复用站点真实 CSS → 所见即所得）
// 桌面 nav 默认 hidden lg:flex，预览强制为 flex；移动菜单强制 block 显示。
// ============================================================
export function renderPreview(container, siteNav, selection) {
  data = siteNav || data;
  const mega = buildSiteNavMega(data)
    .replace(/hidden lg:flex/g, 'flex')
    .replace(/style="width:260px;"/g, 'style="width:260px;position:static;opacity:1;visibility:visible;pointer-events:auto;"');
  const mobile = buildSiteNavMobile(data).replace(/hidden lg:hidden/g, 'block');
  const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="../styles/tailwind.css"><style>body{margin:0;background:#1a3a2a;padding:20px;font-family:sans-serif}.pv-note{color:#cbd5e1;font-size:12px;margin:14px 0 8px}</style></head><body>
  <header style="background:#1a3a2a;display:flex;align-items:center;height:60px;padding:0 8px;">
${mega}
  </header>
  <p class="pv-note">▾ 移动端菜单（展开预览）</p>
${mobile}
</body></html>`;

  const iframe = ensurePreviewFrame(container, { cls: 'pv-detail-iframe', title: '顶部导航实时预览', bg: '#1a3a2a' });
  setPreviewSrcdoc(iframe, doc);
}
