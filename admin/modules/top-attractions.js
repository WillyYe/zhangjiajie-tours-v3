// 景点 Top Attractions 后台模块（与酒店模块同布局：左树 / 中表单 / 右实时预览）
// 数据来自 home-data.mjs 的 topAttractions 块；图片仅限 images/top-attractions/（物理隔离，不借图）。
// 右栏预览复用 top-attractions-render.js 的 buildTopAttractionsHtml（与 build 同源 → 所见即所得）。
import { createImageLib } from '../imglib-core.js';
import { buildTopAttractionsHtml, BADGE } from './top-attractions-render.js';

let data = null;
let sel = { type: 'block' }; // 'block' | { type: 'card', index }
const ui = { open: 'block' }; // 当前展开的分组

const taLib = createImageLib({
  slug: 'top-attractions',
  findReferences: (name) => (data ? data.items.filter((it) => it.img === name).map((it) => it.title) : []),
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

function selectField(field, value, onInput, options) {
  const sel = el('select', { onchange: (e) => onInput(e.target.value) });
  for (const [val, label] of options) {
    const o = el('option', { value: val, text: label });
    if (val === value) o.selected = true;
    sel.append(o);
  }
  return el('div', { class: 'field' }, [
    el('label', {}, [field.label, el('span', { class: 'tip', text: ' ' + (field.tip || '') })]),
    sel,
  ]);
}

// 图片字段：仅限本模块图库 images/top-attractions/
function imageField(field, value, onInput) {
  const thumbBox = el('div', { class: 'he-thumb-box' + (value ? '' : ' no-img') });
  const thumb = el('img', { class: 'he-thumb', src: value ? taLib.imgUrl(value) : '' });
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
      if (v) { thumb.src = taLib.imgUrl(v); thumbBox.classList.remove('no-img'); }
      else { thumb.src = ''; thumbBox.classList.add('no-img'); }
    },
  });
  const btn = el('button', {
    type: 'button',
    class: 'btn btn-sm btn-ghost',
    text: '🖼 浏览图片库',
    onclick: () => taLib.open(thumbBox, thumb, input, onInput),
  });
  const row = el('div', { class: 'img-field' }, [thumbBox, input, btn]);
  return el('div', { class: 'field' }, [
    el('label', {}, [field.label, el('span', { class: 'tip', text: ' ' + (field.tip || '') })]),
    row,
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

// 选中卡片高亮（写入右侧预览时由 iframe load 触发）
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
  wrap.append(tree, formHost);
  container.replaceChildren(wrap);

  // ---------------- 树 ----------------
  function renderTree() {
    tree.replaceChildren();
    tree.append(el('div', { class: 'he-tree-title', text: '景点 Top Attractions' }));

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

    // ② 景点卡片
    const cardsOpen = ui.open === 'cards';
    const cardsHead = el('div', { class: 'he-tree-cat-head' }, [
      el('span', { class: 'he-chevron', text: '▸', onclick: (e) => { e.stopPropagation(); ui.open = cardsOpen ? null : 'cards'; renderTree(); } }),
      el('span', {
        class: 'he-tree-cat-name', text: `景点卡片 (${data.items.length})`,
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
    if (!confirm(`确认删除卡片「${it.title || it.slug}」？\n\n只删除数据、不删除图片（图片可在图库单独管理）。`)) return;
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
      slug: 'new-attraction-' + (data.items.length + 1),
      img: '', imgAlt: '', imgW: 800, imgH: 450,
      badge: '', badgeColor: 'forest', title: 'New Attraction', desc: '', hidden: false,
    });
    ui.open = 'cards';
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
      formHost.append(textField({ label: '顶部小字 Eyebrow', tip: '金色大写小字，如 Explore' }, data.eyebrow, (v) => { data.eyebrow = v; markDirty(); }));
      formHost.append(textField({ label: '区块标题 Title', tip: '区块主标题' }, data.title, (v) => { data.title = v; markDirty(); }));
      formHost.append(longField({ label: '副标题 Subtitle', tip: '区块下方一句说明', rows: 3 }, data.subtitle, (v) => { data.subtitle = v; markDirty(); }));
      return;
    }

    const it = data.items[sel.index];
    if (!it) { sel = { type: 'block' }; renderTree(); renderForm(); return; }
    formHost.append(
      el('div', { class: 'he-form-head' }, [
        el('span', { class: 'he-form-zh', text: it.title || '(无标题)' }),
        el('span', { class: 'he-form-key', text: `#${sel.index + 1} · ${it.slug}` }),
      ]),
    );

    // Slug（可手改，附“由标题生成”）
    const slugInput = el('input', {
      type: 'text', value: it.slug || '', placeholder: '小写字母/数字/连字符',
      oninput: (e) => { it.slug = e.target.value; markDirty(); },
    });
    const genBtn = el('button', {
      type: 'button', class: 'btn btn-sm btn-ghost', text: '↻ 由标题生成',
      onclick: () => { const s = slugify(it.title || ''); slugInput.value = s; it.slug = s; markDirty(); },
    });
    formHost.append(el('div', { class: 'field' }, [
      el('label', {}, [el('span', { text: 'Slug' }), el('span', { class: 'tip', text: ' 决定 id 与详情页链接 attractions/<slug>.html' })]),
      el('div', { class: 'img-field' }, [slugInput, genBtn]),
    ]));

    formHost.append(imageField({ label: '卡片图 Image', tip: '仅 images/top-attractions/ 图库（点击浏览可上传/删除）' }, it.img, (v) => { it.img = v; markDirty(); if (onSelectCb) onSelectCb(sel); }));
    formHost.append(textField({ label: '图片 Alt', tip: '无障碍替代文本（屏幕阅读器）' }, it.imgAlt, (v) => { it.imgAlt = v; markDirty(); }));
    formHost.append(textField({ label: '图宽 imgW', tip: '锁定显示比例，防加载抖动' }, String(it.imgW || ''), (v) => { it.imgW = parseInt(v, 10) || 0; markDirty(); }));
    formHost.append(textField({ label: '图高 imgH', tip: '锁定显示比例，防加载抖动' }, String(it.imgH || ''), (v) => { it.imgH = parseInt(v, 10) || 0; markDirty(); }));
    formHost.append(textField({ label: '角标文字 Badge', tip: '卡片左上角小标签' }, it.badge, (v) => { it.badge = v; markDirty(); }));
    formHost.append(selectField({ label: '角标颜色 Badge Color', tip: '选关键字，不写裸类名' }, it.badgeColor, (v) => { it.badgeColor = v; markDirty(); }, BADGE_OPTIONS));
    formHost.append(textField({ label: '卡片标题 Title' }, it.title, (v) => { it.title = v; markDirty(); if (onSelectCb) onSelectCb(sel); }));
    formHost.append(longField({ label: '描述 Description', rows: 3 }, it.desc, (v) => { it.desc = v; markDirty(); }));

    const hiddenBtn = el('button', {
      type: 'button', class: 'btn btn-sm',
      text: it.hidden ? '👁 显示此卡片' : '🚫 隐藏此卡片（前台不渲染）',
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
// 预览去掉 fade-in 保证始终可见；图片/链接改 ../ 前缀以适配 /admin/ 基址。
// ============================================================
export function renderPreview(container, d, selection) {
  data = d || data;
  const grid = buildTopAttractionsHtml(data);
  const previewGrid = grid
    .replace(/ fade-in/g, '')
    .replace(/src="images\//g, 'src="../images/')
    .replace(/href="attractions\//g, 'href="../attractions/');
  const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="../styles/tailwind.css"><style>body{margin:0;padding:18px;background:#f3efe7}</style></head><body>${previewGrid}</body></html>`;

  container.replaceChildren();
  const iframe = el('iframe', {
    class: 'pv-detail-iframe',
    title: 'Top Attractions 实时预览',
    style: 'width:100%;height:100%;border:0;background:#f3efe7',
  });
  container.append(iframe);
  iframe.addEventListener('load', () => {
    const idoc = iframe.contentDocument;
    if (!idoc) return;
    const slug = (selection && selection.type === 'card' && data.items[selection.index]) ? data.items[selection.index].slug : currentSlug();
    if (slug) {
      const card = idoc.getElementById('attraction-' + slug);
      if (card) { card.style.outline = '3px solid #2563eb'; card.style.outlineOffset = '2px'; }
    }
  }, { once: true });
  iframe.srcdoc = doc;
}

// ============================================================
// 详情页预览：渲染已有的独立详情页 attractions/<slug>.html（只读，不编辑详情内容）
// 与酒店「三级详情页」预览同理，但景点详情页是独立部署页面，直接 fetch 线上真实页面注入 iframe。
// 详情页资源用 ../styles、../images（相对 attractions/ 子目录），在 srcdoc（基址 /admin/）下解析正确。
// ============================================================
export async function renderAttractionDetailPreview(container, slug) {
  container.replaceChildren();
  if (!slug) {
    container.replaceChildren(el('div', { class: 'pv-loading', text: '未选择景点卡片，无法预览详情页。' }));
    return;
  }
  const iframe = el('iframe', {
    class: 'pv-detail-iframe',
    title: 'Attraction detail preview · ' + slug,
    style: 'width:100%;height:100%;border:0;background:#fff',
  });
  container.append(iframe);
  const loading = el('div', { class: 'pv-loading', text: '加载详情页…' });
  container.append(loading);
  try {
    const res = await fetch(`../attractions/${encodeURIComponent(slug)}.html`, { cache: 'no-store' });
    if (!res.ok) throw new Error('not found (' + res.status + ')');
    const html = await res.text();
    loading.remove();
    iframe.srcdoc = html;
  } catch (e) {
    loading.remove();
    container.replaceChildren(el('div', { class: 'pv-loading', text: `暂无「${slug}」的详情页（attractions/${slug}.html 不存在或未部署）。` }));
  }
}
