import { getConfig, isConfigured, getFile, putFile, getFileSha } from './github.js';
import { parseMjs, rebuild } from './mjs.js';
import { renderEditor as renderHotelsEditor, renderPreview as renderHotelCard, renderCategoryPreview, renderDetailPreview } from './modules/hotels.js';
import { renderEditor as renderHeroEditor, renderPreview as renderHeroPreview } from './modules/hero.js';
import { initResizers } from './resizer.js';
import {
  initSettings,
  openSettings,
  renderStatus as renderSettingsStatus,
  setStatus as setSettingsStatus,
} from './modules/settings.js';

// ---------- 模块注册表 ----------
const MODULES = {
  hotels: {
    file: 'hotels-data.mjs',
    title: '酒店 Hotels',
    hint: '改完右侧实时预览，满意后点「保存并发布」即可上线。',
  },
  hero: {
    file: 'home-data.mjs',
    title: '首屏 Hero',
    hint: '编辑首屏大图与文案，保存即上线。背景图仅限本模块图库。',
  },
};

const state = {
  module: 'hotels',
  preamble: '',
  blocks: [],
  hotels: null,
  categories: [],
  hero: null,
  sha: null,
  dirty: false,
  // 酒店预览模式：'card' = 卡片(默认)，'detail' = 三级详情页
  previewMode: 'card',
  selection: null,
};

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const editorEl = $('editor');
const previewEl = $('preview');
const previewTabsEl = $('previewTabs');
const previewTitleEl = $('previewTitle');
const saveBtn = $('saveBtn');
const reloadBtn = $('reloadBtn');
const statusDot = $('statusDot');
const statusText = $('statusText');
const toastEl = $('toast');

// ---------- Toast ----------
let toastTimer = null;
function toast(msg, type = '') {
  toastEl.textContent = msg;
  toastEl.className = 'toast' + (type ? ' ' + type : '');
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), 2800);
}
window.__adminToast = toast;

// ---------- Preview tabs (🃏 卡片 / 📄 详情) ----------
function setPreviewMode(mode) {
  state.previewMode = mode;
  for (const b of previewTabsEl.querySelectorAll('.ptab')) {
    b.classList.toggle('active', b.dataset.mode === mode);
  }
  renderPreviewForCurrent();
}
previewTabsEl.addEventListener('click', (e) => {
  const b = e.target.closest('.ptab');
  if (!b) return;
  setPreviewMode(b.dataset.mode);
});

// ---------- Status ----------
function setStatus(dirty) {
  state.dirty = dirty;
  if (dirty) {
    statusDot.className = 'dot warn';
    statusText.textContent = '未保存';
    saveBtn.disabled = false;
  } else {
    statusDot.className = 'dot ok';
    statusText.textContent = '就绪';
    saveBtn.disabled = true;
  }
}

// ---------- Load ----------
async function loadModule(name) {
  state.module = name;
  saveBtn.disabled = true;
  const mod = MODULES[name];
  try {
    const { text, sha } = await getFile(mod.file);
    const { preamble, blocks } = parseMjs(text);
    state.preamble = preamble;
    state.blocks = blocks;
    state.sha = sha;
    if (name === 'hotels') {
      const hotelsBlock = blocks.find((b) => b.name === 'hotels');
      const catsBlock = blocks.find((b) => b.name === 'hotelCategories');
      state.hotels = hotelsBlock ? hotelsBlock.value : {};
      state.categories = catsBlock ? catsBlock.value : [];
      state.selection = null;
    } else if (name === 'hero') {
      const heroBlock = blocks.find((b) => b.name === 'hero');
      state.hero = heroBlock ? heroBlock.value : {};
    }
    renderEditorForCurrent();
    renderPreviewForCurrent();
    setStatus(false);
  } catch (e) {
    console.error(e);
    toast('加载失败：' + e.message, 'err');
    statusDot.className = 'dot warn';
    statusText.textContent = '加载失败';
  }
}

// ---------- Editor ----------
function renderEditorForCurrent() {
  const mod = MODULES[state.module];
  $('modTitle').textContent = mod.title;
  $('modHint').textContent = mod.hint;
  if (state.module === 'hotels') {
    renderHotelsEditor(
      editorEl, state.hotels, state.categories,
      () => setStatus(true),
      (key) => { state.selection = { type: 'hotel', key }; renderPreviewForCurrent(); },
      (cat) => { state.selection = { type: 'cat', key: cat.slug }; renderPreviewForCurrent(); },
    );
  } else if (state.module === 'hero') {
    renderHeroEditor(editorEl, state.hero, () => setStatus(true));
  }
}

// ---------- Preview routing ----------
function renderPreviewForCurrent() {
  if (state.module === 'hotels') {
    const sel = state.selection;
    if (!sel) { previewTabsEl.hidden = true; previewTitleEl.textContent = '实时预览'; previewEl.replaceChildren(); return; }
    if (sel.type === 'cat') {
      previewTabsEl.hidden = true;
      previewTitleEl.textContent = '实时预览 · 分类页';
      const cat = state.categories.find((c) => c.slug === sel.key);
      if (cat) renderCategoryPreview(previewEl, cat, state.hotels, state.categories);
      return;
    }
    const h = state.hotels[sel.key];
    const hasDetail = !!(h && h.detail);
    previewTabsEl.hidden = !hasDetail;
    if (hasDetail && state.previewMode === 'detail') {
      previewTitleEl.textContent = '实时预览 · 三级详情页';
      renderDetailPreview(previewEl, h, sel.key, state.categories);
    } else {
      previewTitleEl.textContent = '实时预览 · 酒店卡片';
      renderHotelCard(previewEl, h, sel.key);
    }
  } else if (state.module === 'hero') {
    previewTabsEl.hidden = true;
    previewTitleEl.textContent = '实时预览 · 首屏';
    renderHeroPreview(previewEl, state.hero);
  }
}

// 酒店保存前校验图片引用
async function validateHotelsImages() {
  const fileExists = async (p) => { try { return Boolean(await getFileSha(p)); } catch { return true; } };
  const heroSlugFor = (cat) => {
    const byImg = Object.keys(state.hotels).find((k) => state.hotels[k] && state.hotels[k].img === cat.heroImg);
    if (byImg) return byImg;
    const m = /^hotel-([a-z0-9-]+)-/.exec(cat.heroImg || '');
    return m ? m[1] : null;
  };
  const missing = [];
  for (const cat of state.categories) {
    if (cat.hidden || !cat.heroImg) continue;
    const slug = heroSlugFor(cat);
    const p = `images/${slug ? slug + '/' : ''}${cat.heroImg}.webp`;
    if (!(await fileExists(p))) missing.push(`分类「${cat.title || cat.slug}」封面图 ${p}`);
  }
  for (const [k, h] of Object.entries(state.hotels)) {
    if (!h || h.hidden || !h.img) continue;
    const p = `images/${k}/${h.img}.webp`;
    if (!(await fileExists(p))) missing.push(`酒店「${h.zh || h.name || k}」主图 ${p}`);
  }
  return missing;
}

async function save() {
  if (!state.dirty) return;
  if (!getConfig().token) {
    toast('请先在「设置」中填写 GitHub Token', 'err');
    openSettings();
    return;
  }
  saveBtn.disabled = true;
  try {
    if (state.module === 'hotels') {
      const missing = await validateHotelsImages();
      if (missing.length) {
        toast('图片缺失，已阻止保存：' + missing.slice(0, 3).join('；') + (missing.length > 3 ? ` 等 ${missing.length} 处` : ''), 'err');
        saveBtn.disabled = false;
        return;
      }
      const edited = {};
      const hotelsBlock = state.blocks.find((b) => b.name === 'hotels');
      const catsBlock = state.blocks.find((b) => b.name === 'hotelCategories');
      if (hotelsBlock) edited.hotels = state.hotels;
      if (catsBlock) edited.hotelCategories = state.categories;
      const newText = rebuild(state.preamble, state.blocks, edited);
      const { sha } = await putFile(MODULES.hotels.file, newText, state.sha, 'Update hotels & categories via admin');
      state.sha = sha;
    } else if (state.module === 'hero') {
      const newText = rebuild(state.preamble, state.blocks, { hero: state.hero });
      const { sha } = await putFile(MODULES.hero.file, newText, state.sha, 'Update hero via admin');
      state.sha = sha;
    }
    setStatus(false);
    toast('已保存并发布 🎉', 'ok');
  } catch (e) {
    console.error(e);
    toast('保存失败：' + e.message, 'err');
    saveBtn.disabled = false;
  }
}

// ---------- Wire up ----------
initSettings({ toast });
$('saveBtn').addEventListener('click', save);
$('reloadBtn').addEventListener('click', () => loadModule(state.module));

// 设置保存成功后刷新主内容
let settingsSavedFired = false;
document.addEventListener('settings:saved', () => {
  if (!settingsSavedFired) {
    settingsSavedFired = true;
    loadModule(state.module);
    setTimeout(() => (settingsSavedFired = false), 500);
  }
});

// 模块切换（规划中模块给提示）
document.querySelectorAll('.module').forEach((btn) => {
  if (btn.disabled) return;
  btn.addEventListener('click', () => {
    const mod = btn.dataset.module;
    if (mod === state.module) return;
    document.querySelectorAll('.module').forEach((b) => b.classList.toggle('active', b === btn));
    loadModule(mod);
  });
});

// ---------- Boot ----------
(function boot() {
  initResizers();
  renderSettingsStatus();
  const c = getConfig();
  if (!c.repo || !c.branch) {
    openSettings();
    setSettingsStatus('仓库与分支已预填默认值，填入 Token 后点保存即可。', 'idle');
  } else {
    loadModule('hotels');
  }
})();
