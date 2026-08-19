import { getConfig, setConfig, isConfigured, verifyToken, verifyRepo } from '../github.js';

// 本项目的默认仓库/分支，避免运营人员把 placeholder 当成已填值
export const DEFAULTS = {
  repo: 'WillyYe/zhangjiajie-tours-v3',
  branch: 'main',
};

let showToast = (msg, type) => console.log(`[toast ${type}]`, msg);

export function initSettings({ toast }) {
  showToast = toast || showToast;

  const $ = (id) => document.getElementById(id);
  $('openSettings').addEventListener('click', openSettings);
  const openSettings2 = $('openSettings2');
  if (openSettings2) openSettings2.addEventListener('click', openSettings);
  $('closeSettings').addEventListener('click', closeSettings);
  $('toggleToken').addEventListener('click', toggleToken);
  $('testSettings').addEventListener('click', () => validateAndRun(null));
  $('saveSettings').addEventListener('click', saveSettings);

  // 输入框变化时清空旧状态
  ['cfgToken', 'cfgRepo', 'cfgBranch'].forEach((id) => {
    $(id).addEventListener('input', () => setStatus('', 'idle'));
  });

  // 实时简单校验 repo 格式
  $('cfgRepo').addEventListener('blur', () => {
    const repo = $('cfgRepo').value.trim();
    if (repo && !/^[^/]+\/.+$/.test(repo)) {
      setStatus('仓库格式需为 owner/repo', 'err');
    }
  });

  renderStatus();
}

export function openSettings() {
  const c = getConfig();
  const $ = (id) => document.getElementById(id);
  $('cfgToken').value = c.token || '';
  $('cfgRepo').value = c.repo || DEFAULTS.repo;
  $('cfgBranch').value = c.branch || DEFAULTS.branch;
  $('settingsModal').hidden = false;
  setStatus('', 'idle');
}

function closeSettings() {
  document.getElementById('settingsModal').hidden = true;
}

function toggleToken() {
  const input = document.getElementById('cfgToken');
  const btn = document.getElementById('toggleToken');
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈 隐藏';
  } else {
    input.type = 'password';
    btn.textContent = '👁 显示';
  }
}

export function setStatus(text, type) {
  const el = document.getElementById('settingsStatus');
  const box = document.getElementById('settingsStatusBox');
  if (!el) return;
  el.textContent = text;
  el.className = 'hint status-' + type;
  if (box) {
    box.className = 'status-box status-' + type;
    box.hidden = !text;
  }
}

async function validateAndRun(onOk) {
  const token = document.getElementById('cfgToken').value.trim();
  const repo = document.getElementById('cfgRepo').value.trim();
  const branch = document.getElementById('cfgBranch').value.trim() || 'main';

  if (!repo) {
    setStatus('❌ 请填写仓库', 'err');
    return;
  }
  if (!/^[^/]+\/.+$/.test(repo)) {
    setStatus('❌ 仓库格式需为 owner/repo', 'err');
    return;
  }

  setStatus('正在测试连接…', 'idle');

  try {
    // Token 可选：不填也能读公开仓库
    if (token) await verifyToken(token);
    await verifyRepo(repo, branch, token);
    if (onOk) {
      onOk({ token, repo, branch });
    } else {
      setStatus('✅ 连接成功，可以保存。', 'ok');
    }
  } catch (e) {
    console.error(e);
    setStatus('❌ ' + e.message, 'err');
  }
}

async function saveSettings() {
  await validateAndRun(({ token, repo, branch }) => {
    setConfig({ token, repo, branch });
    setStatus('✅ 已保存，连接成功。', 'ok');
    showToast('设置已保存', 'ok');
    closeSettings();
    renderStatus();
    // app.js 会在 initSettings 后监听 ? 不需要，由 app.js 自己 boot 时加载
    // 这里触发一个自定义事件，让 app.js 知道配置已更新
    document.dispatchEvent(new CustomEvent('settings:saved', { detail: { token, repo, branch } }));
  });
}

export function renderStatus() {
  const c = getConfig();
  const connected = isConfigured();
  const hasToken = Boolean(c.token);

  const dot = document.getElementById('settingsDot');
  const text = document.getElementById('settingsText');
  const summary = document.getElementById('settingsSummary');

  if (!dot || !text || !summary) return;

  if (connected && hasToken) {
    dot.className = 'dot ok';
    text.textContent = '已连接';
    summary.textContent = `${c.repo} · ${c.branch}`;
  } else if (connected) {
    dot.className = 'dot warn';
    text.textContent = '只读';
    summary.textContent = `${c.repo} · ${c.branch}（未填 Token）`;
  } else {
    dot.className = 'dot';
    text.textContent = '未配置';
    summary.textContent = '点击 ⚙ 设置 GitHub';
  }
}
