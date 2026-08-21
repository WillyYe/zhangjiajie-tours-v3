import { getConfig, isConfigured, getFile, putFile, getFileSha } from './github.js';
import { parseMjs, rebuild } from './mjs.js';
import { renderEditor, renderPreview } from './modules/hotels.js';
import { initResizers } from './resizer.js';
import {
  initSettings,
  openSettings,
  renderStatus as renderSettingsStatus,
  setStatus as setSettingsStatus,
} from './modules/settings.js';

const FILE_PATH = 'hotels-data.mjs';

const state = {
  preamble: '',
  blocks: [],
  hotels: null,
  categories: [],
  sha: null,
  dirty: false,
};

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const editorEl = $('editor');
const previewEl = $('preview');
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
async function load() {
  saveBtn.disabled = true;
  try {
    const { text, sha } = await getFile(FILE_PATH);
    const { preamble, blocks } = parseMjs(text);
    const hotelsBlock = blocks.find((b) => b.name === 'hotels');
    if (!hotelsBlock || !hotelsBlock.value) throw new Error('未在文件中找到 hotels 数据');
    const catsBlock = blocks.find((b) => b.name === 'hotelCategories');
    state.preamble = preamble;
    state.blocks = blocks;
    state.hotels = hotelsBlock.value;
    state.categories = catsBlock ? catsBlock.value : [];
    state.sha = sha;
    renderEditor(
      editorEl,
      state.hotels,
      state.categories,
      () => setStatus(true),
      (key) => renderPreview(previewEl, state.hotels[key], key)
    );
    setStatus(false);
  } catch (e) {
    console.error(e);
    toast('加载失败：' + e.message, 'err');
    statusDot.className = 'dot warn';
    statusText.textContent = '加载失败';
  }
}

// 保存前校验所有被引用的图片是否真实存在于仓库，避免发布破图
// （分类 hero 缺失会导致 build 静默跳过整页；酒店主图缺失则卡片破图）。
// 校验失败（网络/鉴权）不阻断保存，仅 404 缺失才拦截。
async function validateReferencedImages() {
  const fileExists = async (p) => {
    try { return Boolean(await getFileSha(p)); } catch { return true; }
  };
  // 与 build-hotels.mjs 的 heroSlugFor 保持一致：优先按酒店 img 精确匹配，否则按文件名前缀 hotel-<slug>- 推断
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

// ---------- Save ----------
async function save() {
  if (!state.dirty) return;
  if (!getConfig().token) {
    toast('请先在「设置」中填写 GitHub Token', 'err');
    openSettings();
    return;
  }
  saveBtn.disabled = true;
  try {
    const missing = await validateReferencedImages();
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
    const { sha } = await putFile(FILE_PATH, newText, state.sha, 'Update hotels & categories via admin');
    state.sha = sha;
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
$('reloadBtn').addEventListener('click', load);

// 设置保存成功后刷新主内容
let settingsSavedFired = false;
document.addEventListener('settings:saved', () => {
  if (!settingsSavedFired) {
    settingsSavedFired = true;
    if (!state.hotels) load();
    setTimeout(() => (settingsSavedFired = false), 500);
  }
});

// 模块切换（规划中模块给提示）
document.querySelectorAll('.module').forEach((btn) => {
  if (btn.disabled) return;
  btn.addEventListener('click', () => {
    const mod = btn.dataset.module;
    if (mod === 'hotels') return; // 当前唯一可用
    toast('该模块规划中，敬请期待');
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
    load();
  }
})();
