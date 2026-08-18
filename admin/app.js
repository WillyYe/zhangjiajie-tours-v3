import { getConfig, setConfig, isConfigured, getFile, putFile } from './github.js';
import { parseMjs, rebuild } from './mjs.js';
import { renderEditor, renderPreview } from './modules/hotels.js';

const FILE_PATH = 'hotels-data.mjs';

const state = {
  preamble: '',
  blocks: [],
  hotels: null,
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
    state.preamble = preamble;
    state.blocks = blocks;
    state.hotels = hotelsBlock.value;
    state.sha = sha;
    renderEditor(editorEl, state.hotels, () => setStatus(true));
    renderPreview(previewEl, state.hotels);
    setStatus(false);
  } catch (e) {
    console.error(e);
    toast('加载失败：' + e.message, 'err');
    statusDot.className = 'dot warn';
    statusText.textContent = '加载失败';
  }
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
    const newText = rebuild(state.preamble, state.blocks, 'hotels', state.hotels);
    const { sha } = await putFile(FILE_PATH, newText, state.sha, 'Update hotels via admin');
    state.sha = sha;
    setStatus(false);
    toast('已保存并发布 🎉', 'ok');
  } catch (e) {
    console.error(e);
    toast('保存失败：' + e.message, 'err');
    saveBtn.disabled = false;
  }
}

// ---------- Settings modal ----------
function openSettings() {
  const c = getConfig();
  $('cfgToken').value = c.token;
  $('cfgRepo').value = c.repo;
  $('cfgBranch').value = c.branch || 'main';
  $('settingsStatus').textContent = '';
  $('settingsModal').hidden = false;
}
function closeSettings() {
  $('settingsModal').hidden = true;
}
function saveSettings() {
  setConfig({
    token: $('cfgToken').value.trim(),
    repo: $('cfgRepo').value.trim(),
    branch: $('cfgBranch').value.trim() || 'main',
  });
  $('settingsStatus').textContent = '已保存本机配置。';
  toast('设置已保存', 'ok');
  closeSettings();
  if (!state.hotels) load(); // 首次配置后自动加载
}

// ---------- Wire up ----------
$('openSettings').addEventListener('click', openSettings);
$('closeSettings').addEventListener('click', closeSettings);
$('saveSettings').addEventListener('click', saveSettings);
$('saveBtn').addEventListener('click', save);
$('reloadBtn').addEventListener('click', load);

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
  const c = getConfig();
  if (!c.repo || !c.branch) {
    openSettings();
    $('settingsStatus').textContent = '请先填写仓库与分支（写入需要 GitHub Token）。';
  } else {
    load();
  }
})();
