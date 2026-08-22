// 首屏 Hero 后台模块（与酒店模块同布局：表单 + 独立图库 + 实时预览）
// 数据来自 home-data.mjs 的 hero 块；图片仅限 images/hero/（物理隔离）。
import { createImageLib } from '../imglib-core.js';

let currentHero = null;

// 引用检查：背景图被 hero.bgImg 引用时禁止删除（避免前台破图）
const heroLib = createImageLib({
  slug: 'hero',
  findReferences: (name) => (currentHero && currentHero.bgImg === name) ? ['首屏背景图'] : [],
});

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

function imageField(field, value, onInput) {
  const thumbBox = el('div', { class: 'he-thumb-box' + (value ? '' : ' no-img') });
  const thumb = el('img', { class: 'he-thumb', src: value ? heroLib.imgUrl(value) : '' });
  thumb.onerror = () => thumbBox.classList.add('no-img');
  thumb.onload = () => thumbBox.classList.remove('no-img');
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
    onclick: () => heroLib.open(thumbBox, thumb, input, onInput),
  });
  const row = el('div', { class: 'img-field' }, [thumbBox, input, btn]);
  return el('div', { class: 'field' }, [
    el('label', {}, [field.label, el('span', { class: 'tip', text: ' ' + (field.tip || '') })]),
    row,
  ]);
}

export function renderEditor(container, hero, onChange) {
  currentHero = hero || {};
  const h = currentHero;
  container.replaceChildren(
    el('div', { class: 'module-head' }, [
      el('h2', { text: '首屏 Hero 编辑' }),
      el('p', { class: 'hint', text: '编辑后点右上角「保存并发布」即上线。背景图仅限本模块图库，不与其他模块混用。' }),
    ]),
    textField({ label: '顶部小字 Eyebrow', tip: '金色大写小字，如 UNESCO World Heritage Site', placeholder: 'UNESCO World Heritage Site' }, h.eyebrow, (v) => { h.eyebrow = v; onChange(); }),
    textField({ label: '主标题第一行', tip: 'H1 第一行' }, h.h1Line1, (v) => { h.h1Line1 = v; onChange(); }),
    textField({ label: '主标题第二行', tip: 'H1 第二行（自动换行分隔）' }, h.h1Line2, (v) => { h.h1Line2 = v; onChange(); }),
    longField({ label: '描述 Description', tip: '用 *星号* 包住要强调的文字', rows: 4 }, h.desc, (v) => { h.desc = v; onChange(); }),
    imageField({ label: '背景图 Background', tip: '仅 images/hero/ 图库（点击浏览可上传/删除）' }, h.bgImg, (v) => { h.bgImg = v; onChange(); }),
  );
}

export function renderPreview(container, hero) {
  currentHero = hero || {};
  const h = currentHero;
  const bg = h.bgImg || 'hero-tianzi-clouds';
  const bgUrl = heroLib.imgUrl(bg);
  const section = el('div', {
    class: 'hero-preview',
    style: `background-image: linear-gradient(to bottom, rgba(26,58,42,0.3) 0%, rgba(26,58,42,0.5) 50%, rgba(26,58,42,0.85) 100%), url('${bgUrl}');`,
  });
  section.append(
    el('div', { class: 'hero-preview-inner' }, [
      h.eyebrow ? el('p', { class: 'hp-eyebrow', text: h.eyebrow }) : null,
      el('h3', { class: 'hp-h1', html: `${escapeText(h.h1Line1 || '')}<br>${escapeText(h.h1Line2 || '')}` }),
      h.desc ? el('p', { class: 'hp-desc', html: emText(h.desc) }) : null,
    ]),
  );
  container.replaceChildren(
    el('p', { class: 'preview-cap', text: '↑ 首屏预览（缩放，与线上同构）' }),
    section,
  );
}

function escapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function emText(s) {
  return escapeText(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
