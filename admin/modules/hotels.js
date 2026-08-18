// Hotels 模块：表单渲染 + 实时预览。
// 编辑直接 mutate 传入的 hotels 对象（app.js 持有引用，保存时整体序列化）。

const FIELDS = [
  { key: 'name', label: '英文名 / Name', tip: '酒店英文名（用于英文页面）' },
  { key: 'zh', label: '中文名 / 名称', tip: '酒店中文名' },
  { key: 'area', label: '区域 / Area', tip: '所在区域，如 Wulingyuan Core' },
  { key: 'tier', label: '档次 / Tier', tip: '如 Boutique / Mountain Lodge / Value' },
  { key: 'img', label: '主图文件名 / Image', tip: 'images/ 下的 webp 文件名（不含扩展名）' },
  { key: 'alt', label: '图片 alt 描述', tip: '英文 alt 文本，利于无障碍与 SEO' },
];

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

export function renderEditor(container, hotels, onChange) {
  container.replaceChildren();
  for (const key of Object.keys(hotels)) {
    const h = hotels[key];
    const fieldset = el('fieldset', {}, [el('legend', {}, [h.zh || h.name, el('small', { text: key })])]);

    for (const f of FIELDS) {
      fieldset.append(
        textField(f, h[f.key], (v) => {
          h[f.key] = v;
          onChange();
        })
      );
    }
    fieldset.append(
      longField({ label: '简介 / Blurb', tip: '一段英文介绍' }, h.blurb, (v) => {
        h.blurb = v;
        onChange();
      })
    );
    fieldset.append(
      featuresField(h.features, () => onChange())
    );

    container.append(fieldset);
  }
}

export function renderPreview(container, hotels) {
  container.replaceChildren();
  for (const key of Object.keys(hotels)) {
    const h = hotels[key];
    const card = el('div', { class: 'pv-card' }, [
      el('div', { class: 'pv-img', text: h.img || '(no image)' }),
      el('div', { class: 'pv-body' }, [
        el('div', { class: 'pv-name', text: h.name || '' }),
        el('div', { class: 'pv-zh', text: h.zh || '' }),
        el('div', { class: 'pv-meta', text: `${h.area || ''} · ${h.tier || ''}` }),
        el('div', { class: 'pv-blurb', text: h.blurb || '' }),
        el(
          'ul',
          { class: 'pv-features' },
          (h.features || []).map((f) => el('li', { text: f }))
        ),
      ]),
    ]);
    container.append(card);
  }
}
