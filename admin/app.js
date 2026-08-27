import { getConfig, isConfigured, getFile, putFile, getFileSha } from './github.js';
import { parseMjs, rebuild } from './mjs.js';
import { renderEditor as renderHotelsEditor, renderPreview as renderHotelCard, renderCategoryPreview, renderDetailPreview } from './modules/hotels.js';
import { renderEditor as renderHeroEditor, renderPreview as renderHeroPreview } from './modules/hero.js';
import { renderEditor as renderTopAttractionsEditor, renderPreview as renderTopAttractionsPreview, renderAttractionDetailPreview } from './modules/top-attractions.js';
import { renderEditor as renderHomeTourCardsEditor, renderPreview as renderHomeTourCardsPreview } from './modules/home-tour-cards.js';
import { renderEditor as renderWelcomeEditor, renderPreview as renderWelcomePreview } from './modules/welcome.js';
import { renderEditor as renderNavEditor, renderPreview as renderNavPreview } from './modules/nav.js';
import { renderEditor as renderAttractionsEditor, renderPreview as renderAttractionsPreview } from './modules/attractions.js';
import { renderEditor as renderExperiencesEditor, renderPreview as renderExperiencesPreview } from './modules/experiences.js';
import { collectImageNames } from './modules/spot-core.js';
import { listTopAttractionImages } from './modules/top-attractions-render.js';
import { listTourImages } from './modules/tours-render.js';
import { renderEditor as renderToursEditor, renderPreview as renderToursPreview, renderTourDetailPreview } from './modules/tours.js';
import { initResizers } from './resizer.js';
import {
  initSettings,
  openSettings,
  renderStatus as renderSettingsStatus,
  setStatus as setSettingsStatus,
} from './modules/settings.js';
import { scrollToActive, setFollowEnabled, isFollowEnabled } from './pv-anchor.js';
import { onFrameLoad, clearFrameHandlers } from './preview-frame.js';

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
  topAttractions: {
    file: 'home-data.mjs',
    title: '⭐ Top 8 Must-See Spots',
    hint: '编辑首页 Top 8 必看景点卡片，保存即上线。图片仅限本模块图库 images/top-attractions/，不与其他模块混用。',
  },
  homeTourCards: {
    file: 'home-data.mjs',
    title: '🏠 首页 Tour 卡',
    hint: '编辑首页「Tour Packages」三张文字卡（Day / Private / VIP）。数据驱动、纯文字无图库，保存即上线。与 🎟 Tour Packages（hub 行程页）相互独立。',
  },
  welcome: {
    file: 'home-data.mjs',
    title: '欢迎区 Welcome',
    hint: '编辑欢迎区的标题、介绍段落与数据指标，保存即上线。背景图仅限本模块图库 images/welcome/。',
  },
  nav: {
    file: 'home-data.mjs',
    title: '🧭 顶部导航 Nav',
    hint: '编辑首页顶部导航菜单，保存即上线。隐藏项前台不渲染；Hotels 项自动输出酒店二级菜单。',
  },
  attractions: {
    file: 'attractions-data.mjs',
    title: '🏞 景点详情页 Attractions',
    hint: '编辑景点详情页（H1、亮点、路线、票务、画廊、FAQ 等），保存即上线。图片为根目录 images/ 图库。隐藏项前台不生成该页。',
  },
  experiences: {
    file: 'experiences-data.mjs',
    title: '🎢 体验 Experiences',
    hint: '编辑体验页（玻璃桥、天门山、直升机等），保存即上线。图片为根目录 images/ 图库。隐藏项前台不生成该页。',
  },
  tours: {
    file: 'tours-data.mjs',
    title: '🎟 Tour Packages',
    hint: '编辑套餐卡片与每套餐详情页（行程 / 包含 / 画廊 / FAQ）。图片仅限 images/tours/，不借图。',
  },
};

const state = {
  module: 'hotels',
  preamble: '',
  blocks: [],
  hotels: null,
  categories: [],
  hero: null,
  topAttractions: null,
  topAttractionsSel: { type: 'block' },
  homeTourCards: null,
  homeTourCardsSel: { type: 'block' },
  welcome: null,
  welcomeSel: { type: 'block' },
  nav: null,
  navSel: { type: 'block' },
  attractions: null,
  attractionsSel: null,
  experiences: null,
  experiencesSel: null,
  tours: null,
  toursSel: { type: 'block' },
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

// 供 pv-anchor.js 切预览模式（仅当该模块支持此模式才切）
window.__adminApp = {
  get state() { return state; },
  setPreviewModeIfAvailable(mode) {
    const tab = previewTabsEl.querySelector(`.ptab[data-mode="${mode}"]`);
    if (tab) setPreviewMode(mode);
  },
};

// ---------- Preview tabs (🃏 卡片 / 📄 详情) ----------
function setPreviewMode(mode) {
  if (mode === state.previewMode) return; // 幂等早退：模式未变不重渲染（斩断重渲染闭环）
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
    } else if (name === 'topAttractions') {
      const taBlock = blocks.find((b) => b.name === 'topAttractions');
      state.topAttractions = taBlock ? taBlock.value : { eyebrow: '', title: '', subtitle: '', items: [] };
      state.topAttractionsSel = { type: 'block' };
    } else if (name === 'homeTourCards') {
      const htBlock = blocks.find((b) => b.name === 'homeTourCards');
      state.homeTourCards = htBlock ? htBlock.value : { eyebrow: '', title: '', cards: [] };
      state.homeTourCardsSel = { type: 'block' };
    } else if (name === 'welcome') {
      const wBlock = blocks.find((b) => b.name === 'welcome');
      state.welcome = wBlock ? wBlock.value : { eyebrow: '', h2: '', paras: [], stats: [], bgImg: '' };
      state.welcomeSel = { type: 'block' };
    } else if (name === 'nav') {
      const navBlock = blocks.find((b) => b.name === 'siteNav');
      state.nav = navBlock ? navBlock.value : { items: [] };
      if (!Array.isArray(state.nav.items)) state.nav.items = [];
      state.navSel = { type: 'block' };
    } else if (name === 'attractions') {
      const aBlock = blocks.find((b) => b.name === 'attractions');
      state.attractions = aBlock ? aBlock.value : [];
      state.attractionsSel = state.attractions.length ? state.attractions[0].slug : null;
    } else if (name === 'experiences') {
      const eBlock = blocks.find((b) => b.name === 'experiences');
      state.experiences = eBlock ? eBlock.value : [];
      state.experiencesSel = state.experiences.length ? state.experiences[0].slug : null;
    } else if (name === 'tours') {
      const tBlock = blocks.find((b) => b.name === 'tours');
      state.tours = tBlock ? tBlock.value : { eyebrow: '', title: '', subtitle: '', items: [] };
      state.toursSel = { type: 'block' };
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
      () => { setStatus(true); renderPreviewForCurrent(); },
      (key) => { state.selection = { type: 'hotel', key }; renderPreviewForCurrent(); },
      (cat) => { state.selection = { type: 'cat', key: cat.slug }; renderPreviewForCurrent(); },
    );
  } else if (state.module === 'hero') {
    renderHeroEditor(editorEl, state.hero, () => { setStatus(true); renderPreviewForCurrent(); });
  } else if (state.module === 'topAttractions') {
    renderTopAttractionsEditor(
      editorEl, state.topAttractions,
      () => { setStatus(true); renderPreviewForCurrent(); },
      (sel) => { state.topAttractionsSel = sel; renderPreviewForCurrent(); },
    );
  } else if (state.module === 'homeTourCards') {
    renderHomeTourCardsEditor(
      editorEl, state.homeTourCards,
      () => { setStatus(true); renderPreviewForCurrent(); },
      (sel) => { state.homeTourCardsSel = sel; renderPreviewForCurrent(); },
    );
  } else if (state.module === 'welcome') {
    renderWelcomeEditor(
      editorEl, state.welcome,
      () => { setStatus(true); renderPreviewForCurrent(); },
      (sel) => { state.welcomeSel = sel; renderPreviewForCurrent(); },
    );
  } else if (state.module === 'nav') {
    renderNavEditor(
      editorEl, state.nav,
      () => { setStatus(true); renderPreviewForCurrent(); },
      (sel) => { state.navSel = sel; renderPreviewForCurrent(); },
    );
  } else if (state.module === 'attractions') {
    renderAttractionsEditor(
      editorEl, state.attractions,
      () => { setStatus(true); renderPreviewForCurrent(); },
      (slug) => { state.attractionsSel = slug; renderPreviewForCurrent(); },
    );
  } else if (state.module === 'experiences') {
    renderExperiencesEditor(
      editorEl, state.experiences,
      () => { setStatus(true); renderPreviewForCurrent(); },
      (slug) => { state.experiencesSel = slug; renderPreviewForCurrent(); },
    );
  } else if (state.module === 'tours') {
    renderToursEditor(
      editorEl, state.tours,
      () => { setStatus(true); renderPreviewForCurrent(); },
      (sel) => { state.toursSel = sel; renderPreviewForCurrent(); },
    );
  }
}

// ---------- Preview routing ----------
// 实时预览渲染（去抖 120ms）：合并连续按键，减少 iframe srcdoc 重载，配合自动跟随更顺滑
let previewRenderTimer = null;
function renderPreviewForCurrent() {
  if (previewRenderTimer) clearTimeout(previewRenderTimer);
  previewRenderTimer = setTimeout(renderPreviewNow, 120);
}

function renderPreviewNow() {
  // 清理上一渲染周期注册的 iframe load handler，避免随编辑次数累积（每个周期只保留当前 handler）。
  const _f = previewEl.querySelector('iframe');
  if (_f) clearFrameHandlers(_f);
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
  } else if (state.module === 'topAttractions') {
    const sel = state.topAttractionsSel || { type: 'block' };
    const isCard = sel.type === 'card' && !!state.topAttractions.items[sel.index];
    const isDetail = isCard && state.previewMode === 'detail';
    // 仅选中某张景点卡片时才显示 卡片/详情 切换；区块设置（block）模式只有卡片预览
    previewTabsEl.hidden = !isCard;
    if (isDetail) {
      previewTitleEl.textContent = '实时预览 · 景点详情页';
      const slug = state.topAttractions.items[sel.index].slug;
      renderAttractionDetailPreview(previewEl, slug);
    } else {
      previewTitleEl.textContent = '实时预览 · 景点卡片';
      renderTopAttractionsPreview(previewEl, state.topAttractions, sel);
    }
  } else if (state.module === 'homeTourCards') {
    previewTabsEl.hidden = true;
    previewTitleEl.textContent = '实时预览 · 首页 Tour 卡';
    renderHomeTourCardsPreview(previewEl, state.homeTourCards, state.homeTourCardsSel || { type: 'block' });
  } else if (state.module === 'welcome') {
    previewTabsEl.hidden = true;
    previewTitleEl.textContent = '实时预览 · 欢迎区';
    renderWelcomePreview(previewEl, state.welcome, state.welcomeSel || { type: 'block' });
  } else if (state.module === 'nav') {
    previewTabsEl.hidden = true;
    previewTitleEl.textContent = '实时预览 · 顶部导航';
    renderNavPreview(previewEl, state.nav, state.navSel || { type: 'block' });
  } else if (state.module === 'attractions') {
    previewTabsEl.hidden = true;
    previewTitleEl.textContent = '实时预览 · 景点详情页';
    renderAttractionsPreview(previewEl, state.attractions, state.attractionsSel);
  } else if (state.module === 'experiences') {
    previewTabsEl.hidden = true;
    previewTitleEl.textContent = '实时预览 · 体验页';
    renderExperiencesPreview(previewEl, state.experiences, state.experiencesSel);
  } else if (state.module === 'tours') {
    const sel = state.toursSel || { type: 'block' };
    const isCard = sel.type === 'card' && !!state.tours.items[sel.index];
    const isDetail = isCard && state.previewMode === 'detail';
    // 仅选中某套餐卡片时才显示 卡片/详情 切换；区块设置（block）模式只有卡片预览
    previewTabsEl.hidden = !isCard;
    if (isDetail) {
      previewTitleEl.textContent = '实时预览 · 套餐详情页';
      const it = state.tours.items[sel.index];
      renderTourDetailPreview(previewEl, it, it.slug);
    } else {
      previewTitleEl.textContent = '实时预览 · 套餐卡片';
      renderToursPreview(previewEl, state.tours, sel);
    }
  }
  // 关键：setPreviewSrcdoc 赋 srcdoc 是异步重载，iframe 此时仍是旧内容。
  // 若同步调用 scrollToActive()，findTarget 找不到目标 → 不滚动 → 编辑时预览跳回顶部。
  // 改为把 scrollToActive 挂到 iframe 的 load 事件上（内容加载完成后再滚回激活字段），
  // 与模块注册的描边 handler 共存（onFrameLoad 支持多 handler）。
  const pvIframe = previewEl.querySelector('iframe');
  if (pvIframe) onFrameLoad(pvIframe, () => scrollToActive());
  else scrollToActive();
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

// 景点保存前校验图片引用（仅可见卡片，hidden 不产生死链）
async function validateTopAttractionImages() {
  const fileExists = async (p) => { try { return Boolean(await getFileSha(p)); } catch { return true; } };
  const missing = [];
  for (const p of listTopAttractionImages(state.topAttractions)) {
    if (!(await fileExists(p))) missing.push(`景点卡片图 ${p}`);
  }
  return missing;
}

// 景点/体验 保存前校验根图片引用（跳过 hidden 项，不产生死链）
async function validateSpotImages(arr) {
  const fileExists = async (p) => { try { return Boolean(await getFileSha(p)); } catch { return true; } };
  const missing = [];
  for (const name of collectImageNames(arr)) {
    const p = `images/${name}.webp`;
    if (!(await fileExists(p))) missing.push(`图片 ${p}`);
  }
  return missing;
}

// 套餐保存前校验图片引用（仅可见套餐，hidden 不产生死链；图片落在 images/tours/）
async function validateTourImages() {
  const fileExists = async (p) => { try { return Boolean(await getFileSha(p)); } catch { return true; } };
  const missing = [];
  for (const p of listTourImages(state.tours)) {
    if (!(await fileExists(p))) missing.push(`套餐图 ${p}`);
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
    } else if (state.module === 'topAttractions') {
      const missing = await validateTopAttractionImages();
      if (missing.length) {
        toast('图片缺失，已阻止保存：' + missing.slice(0, 3).join('；') + (missing.length > 3 ? ` 等 ${missing.length} 处` : ''), 'err');
        saveBtn.disabled = false;
        return;
      }
      const newText = rebuild(state.preamble, state.blocks, { topAttractions: state.topAttractions });
      const { sha } = await putFile(MODULES.topAttractions.file, newText, state.sha, 'Update topAttractions via admin');
      state.sha = sha;
    } else if (state.module === 'homeTourCards') {
      const newText = rebuild(state.preamble, state.blocks, { homeTourCards: state.homeTourCards });
      const { sha } = await putFile(MODULES.homeTourCards.file, newText, state.sha, 'Update homeTourCards via admin');
      state.sha = sha;
    } else if (state.module === 'welcome') {
      const newText = rebuild(state.preamble, state.blocks, { welcome: state.welcome });
      const { sha } = await putFile(MODULES.welcome.file, newText, state.sha, 'Update welcome via admin');
      state.sha = sha;
    } else if (state.module === 'nav') {
      const newText = rebuild(state.preamble, state.blocks, { siteNav: state.nav });
      const { sha } = await putFile(MODULES.nav.file, newText, state.sha, 'Update siteNav via admin');
      state.sha = sha;
    } else if (state.module === 'attractions') {
      const missing = await validateSpotImages(state.attractions);
      if (missing.length) {
        toast('图片缺失，已阻止保存：' + missing.slice(0, 3).join('；') + (missing.length > 3 ? ` 等 ${missing.length} 处` : ''), 'err');
        saveBtn.disabled = false;
        return;
      }
      const newText = rebuild(state.preamble, state.blocks, { attractions: state.attractions });
      const { sha } = await putFile(MODULES.attractions.file, newText, state.sha, 'Update attractions via admin');
      state.sha = sha;
    } else if (state.module === 'experiences') {
      const missing = await validateSpotImages(state.experiences);
      if (missing.length) {
        toast('图片缺失，已阻止保存：' + missing.slice(0, 3).join('；') + (missing.length > 3 ? ` 等 ${missing.length} 处` : ''), 'err');
        saveBtn.disabled = false;
        return;
      }
      const newText = rebuild(state.preamble, state.blocks, { experiences: state.experiences });
      const { sha } = await putFile(MODULES.experiences.file, newText, state.sha, 'Update experiences via admin');
      state.sha = sha;
    } else if (state.module === 'tours') {
      const missing = await validateTourImages();
      if (missing.length) {
        toast('图片缺失，已阻止保存：' + missing.slice(0, 3).join('；') + (missing.length > 3 ? ` 等 ${missing.length} 处` : ''), 'err');
        saveBtn.disabled = false;
        return;
      }
      const newText = rebuild(state.preamble, state.blocks, { tours: state.tours });
      const { sha } = await putFile(MODULES.tours.file, newText, state.sha, 'Update tours via admin');
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

// 自动跟随预览开关（默认开；localStorage 持久化）
(function initFollowToggle() {
  const el = document.getElementById('followToggle');
  if (!el) return;
  el.checked = isFollowEnabled();
  el.addEventListener('change', () => setFollowEnabled(el.checked));
})();
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
