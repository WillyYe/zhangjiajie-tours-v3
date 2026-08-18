// GitHub Contents API 封装 —— 零后端，纯浏览器直连。
// PAT / repo / branch 只存本浏览器 localStorage，不上传任何服务器。

const API = 'https://api.github.com';

export function getConfig() {
  return {
    token: localStorage.getItem('gh_token') || '',
    repo: localStorage.getItem('gh_repo') || '',
    branch: localStorage.getItem('gh_branch') || 'main',
  };
}

export function setConfig({ token, repo, branch }) {
  if (token) localStorage.setItem('gh_token', token);
  if (repo) localStorage.setItem('gh_repo', repo);
  if (branch) localStorage.setItem('gh_branch', branch || 'main');
}

export function isConfigured() {
  const c = getConfig();
  return Boolean(c.token && c.repo && c.branch);
}

// UTF-8 安全的 base64 编解码
function b64encode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64decode(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/\s/g, ''))));
}

export async function getFile(path) {
  const { token, repo, branch } = getConfig();
  const url = `${API}/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`读取 ${path} 失败 (${res.status}) ${msg.slice(0, 200)}`);
  }
  const data = await res.json();
  return { text: b64decode(data.content), sha: data.sha };
}

export async function putFile(path, text, sha, message) {
  const { token, repo, branch } = getConfig();
  const url = `${API}/repos/${repo}/contents/${path}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const body = JSON.stringify({
    message: message || `Update ${path} via admin`,
    content: b64encode(text),
    sha,
    branch,
  });

  const res = await fetch(url, { method: 'PUT', headers, body });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`写入 ${path} 失败 (${res.status}) ${msg.slice(0, 200)}`);
  }
  const data = await res.json();
  return { sha: data.content.sha };
}
