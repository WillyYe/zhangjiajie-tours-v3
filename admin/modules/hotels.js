// Hotels 模块：三级分级编辑器 + 实时预览 + 图片库。
// 一级 分类 / 二级 酒店 / 三级 编辑表单。
// 编辑直接 mutate 传入的 hotels 对象（app.js 持有引用，保存时整体序列化）。

// 图片基准路径（相对 admin/ 页面 → 仓库根 images/）。运营时同域 GitHub Pages 一致。
const IMG_BASE = '../images/';

const FIELDS = [
  { key: 'name', label: '英文名 / Name', tip: '酒店英文名（用于英文页面）' },
  { key: 'zh', label: '中文名 / 名称', tip: '酒店中文名' },
  { key: 'area', label: '区域 / Area', tip: '所在区域，如 Wulingyuan Core' },
  { key: 'tier', label: '档次 / Tier', tip: '如 Boutique / Mountain Lodge / Value' },
  { key: 'img', label: '主图 / Image', tip: 'images/ 下的 webp 文件名（不含扩展名）' },
  { key: 'alt', label: '图片 alt 描述', tip: '英文 alt 文本，利于无障碍与 SEO' },
];

// 当前选中的 一级/二级（UI 状态）
const ui = { catSlug: null, hotelKey: null };

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
function imageField(field, value, onInput) {
  const thumbBox = el('div', { class: 'he-thumb-box' + (value ? '' : ' no-img') });
  const thumb = el('img', { class: 'he-thumb', src: value ? IMG_BASE + value + '.webp' : '' });
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
    onclick: () => openImageLib(thumbBox, thumb, input, onInput),
  });

  const row = el('div', { class: 'img-field' }, [thumbBox, input, btn]);
  return el('div', { class: 'field' }, [
    el('label', {}, [field.label, el('span', { class: 'tip', text: ' ' + field.tip })]),
    row,
  ]);
}

// ---------- 图片库 modal（全局单例） ----------
let libModal = null;
function buildLibModal() {
  const mask = el('div', { class: 'modal-mask', hidden: true });
  const modal = el('div', { class: 'modal img-lib-modal' });
  const closeBtn = el('button', { type: 'button', class: 'icon-btn', style: 'margin-left:auto;font-size:18px', text: '✕', onclick: () => (mask.hidden = true) });
  const header = el('div', { class: 'modal-header' }, [
    el('div', { class: 'modal-icon', text: '🖼' }),
    el('div', {}, [
      el('h2', { text: '图片库' }),
      el('p', { class: 'modal-subtitle', text: '点击一张图作为主图（images/ 下的 webp）' }),
    ]),
    closeBtn,
  ]);
  const grid = el('div', { class: 'img-lib-grid' });
  modal.append(header, grid);
  mask.append(modal);
  mask.addEventListener('click', (e) => { if (e.target === mask) mask.hidden = true; });
  document.body.append(mask);
  return { mask, grid };
}

async function openImageLib(thumbBox, thumb, input, onInput) {
  if (!libModal) libModal = buildLibModal();
  libModal.grid.replaceChildren(el('div', { class: 'img-lib-loading', text: '加载中…' }));
  try {
    const list = await (await fetch('./image-list.json')).json();
    libModal.grid.replaceChildren();
    for (const name of list) {
      const cell = el('button', {
        type: 'button',
        class: 'img-lib-item',
        onclick: () => {
          input.value = name;
          thumb.src = IMG_BASE + name + '.webp';
          thumbBox.classList.remove('no-img');
          onInput(name);
          libModal.mask.hidden = true;
        },
      });
      const im = el('img', { src: IMG_BASE + name + '.webp', loading: 'lazy', alt: name });
      im.addEventListener('error', () => cell.classList.add('broken'));
      cell.append(im, el('span', { class: 'img-lib-name', text: name }));
      libModal.grid.append(cell);
    }
  } catch (e) {
    libModal.grid.replaceChildren(el('div', { class: 'img-lib-err', text: '图片库清单不可用（缺少 admin/image-list.json）' }));
  }
  libModal.mask.hidden = false;
}

// 由 categories 推导出 一级(分类) → 二级(酒店) 的映射，并把游离酒店归入「未分类」
function buildTiers(hotels, categories) {
  const cats = (categories && Array.isArray(categories) ? categories : [])
    .map((c) => ({ ...c, hotels: (c.hotels || []).filter((k) => hotels[k]) }))
    .filter((c) => c.hotels.length);

  const placed = new Set(cats.flatMap((c) => c.hotels));
  const uncat = Object.keys(hotels).filter((k) => !placed.has(k));
  if (uncat.length) cats.push({ slug: '__uncat', title: '未分类 · Uncategorized', hotels: uncat });

  return cats;
}

export function renderEditor(container, hotels, categories, onChange, onSelect) {
  container.replaceChildren();
  const tiers = buildTiers(hotels, categories);
  if (!tiers.length) {
    container.append(el('p', { class: 'hint', text: '暂无酒店数据。' }));
    return;
  }

  ui.catSlug = tiers[0].slug;
  ui.hotelKey = tiers[0].hotels[0];

  const wrap = el('div', { class: 'he' });

  // 一级：分类
  const lvl1 = el('div', { class: 'he-level' });
  lvl1.append(el('div', { class: 'he-step', text: '① 分类 Category' }));
  const catRow = el('div', { class: 'he-cats' });
  lvl1.append(catRow);

  // 二级：酒店
  const lvl2 = el('div', { class: 'he-level' });
  lvl2.append(el('div', { class: 'he-step', text: '② 酒店 Hotel' }));
  const hotelRow = el('div', { class: 'he-hotels' });
  lvl2.append(hotelRow);

  // 三级：编辑表单
  const lvl3 = el('div', { class: 'he-level' });
  lvl3.append(el('div', { class: 'he-step', text: '③ 编辑 Edit' }));
  const formHost = el('div', { class: 'he-form' });
  lvl3.append(formHost);

  wrap.append(lvl1, lvl2, lvl3);
  container.append(wrap);

  const catBySlug = (slug) => tiers.find((c) => c.slug === slug);

  function renderCats() {
    catRow.replaceChildren();
    for (const c of tiers) {
      catRow.append(
        el('button', {
          class: 'he-cat' + (c.slug === ui.catSlug ? ' active' : ''),
          type: 'button',
          text: c.title,
          onclick: () => {
            ui.catSlug = c.slug;
            ui.hotelKey = c.hotels[0];
            renderCats();
            renderHotels();
            renderForm();
          },
        })
      );
    }
  }

  function renderHotels() {
    hotelRow.replaceChildren();
    const c = catBySlug(ui.catSlug);
    if (!c) return;
    for (const k of c.hotels) {
      const h = hotels[k];
      hotelRow.append(
        el(
          'button',
          {
            class: 'he-hotel' + (k === ui.hotelKey ? ' active' : ''),
            type: 'button',
            onclick: () => {
              ui.hotelKey = k;
              renderHotels();
              renderForm();
            },
          },
          [
            el('span', { class: 'he-hotel-zh', text: h.zh || '' }),
            el('span', { class: 'he-hotel-en', text: h.name || k }),
          ]
        )
      );
    }
  }

  function renderForm() {
    formHost.replaceChildren();
    const h = hotels[ui.hotelKey];
    if (!h) return;

    formHost.append(
      el('div', { class: 'he-form-head' }, [
        el('span', { class: 'he-form-zh', text: h.zh || '' }),
        el('span', { class: 'he-form-key', text: ui.hotelKey }),
      ])
    );

    for (const f of FIELDS) {
      const commit = (v) => {
        h[f.key] = v;
        onChange();
        onSelect && onSelect(ui.hotelKey);
      };
      if (f.key === 'img') {
        formHost.append(imageField(f, h.img, commit));
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

  renderCats();
  renderHotels();
  renderForm();
}

export function renderPreview(container, hotel) {
  container.replaceChildren();
  if (!hotel) return;
  const imgWrap = el('div', { class: 'pv-img' });
  if (hotel.img) {
    const im = el('img', { class: 'pv-img-el', src: IMG_BASE + hotel.img + '.webp', alt: hotel.alt || '' });
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
