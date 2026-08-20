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

export async function verifyToken(token) {
  const res = await fetch(`${API}/user`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`Token 校验失败 (${res.status}) ${msg.slice(0, 200)}`);
  }
  return await res.json();
}

export async function verifyRepo(repo, branch, token) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!/^[^/]+\/.+$/.test(repo)) throw new Error('仓库格式需为 owner/repo');

  const repoRes = await fetch(`${API}/repos/${repo}`, { headers });
  if (!repoRes.ok) {
    const msg = await repoRes.text().catch(() => '');
    throw new Error(`仓库不存在或不可访问 (${repoRes.status}) ${msg.slice(0, 200)}`);
  }
  if (!branch) return { repo: true };

  const branchRes = await fetch(
    `${API}/repos/${repo}/branches/${encodeURIComponent(branch)}`,
    { headers }
  );
  if (!branchRes.ok) {
    const msg = await branchRes.text().catch(() => '');
    throw new Error(`分支不存在 (${branchRes.status}) ${msg.slice(0, 200)}`);
  }
  return { repo: true, branch: true };
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

// 查询文件 SHA；不存在返回 null（用于「新建 vs 更新」判断，以及删除时必填）
export async function getFileSha(path) {
  const { token, repo, branch } = getConfig();
  const url = `${API}/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`查询 ${path} 失败 (${res.status}) ${msg.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.sha;
}

// Blob → 纯 base64（去掉 data: 前缀）
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result || '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.onabort = () => reject(new Error('文件读取被中止'));
    reader.readAsDataURL(blob);
  });
}

// 上传/更新二进制图片（blob 为浏览器 Blob，如 canvas.toBlob 结果）
export async function putImage(path, blob, sha, message) {
  const { token, repo, branch } = getConfig();
  const url = `${API}/repos/${repo}/contents/${path}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const content = await blobToBase64(blob);
  const body = JSON.stringify({
    message: message || `Upload ${path} via admin`,
    content,
    branch,
    ...(sha ? { sha } : {}),
  });
  const res = await fetch(url, { method: 'PUT', headers, body });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`上传 ${path} 失败 (${res.status}) ${msg.slice(0, 200)}`);
  }
  const data = await res.json();
  return { sha: data.content.sha };
}

// 删除文件（sha 必填）
export async function deleteFile(path, sha, message) {
  const { token, repo, branch } = getConfig();
  const url = `${API}/repos/${repo}/contents/${path}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const body = JSON.stringify({
    message: message || `Delete ${path} via admin`,
    sha,
    branch,
  });
  const res = await fetch(url, { method: 'DELETE', headers, body });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`删除 ${path} 失败 (${res.status}) ${msg.slice(0, 200)}`);
  }
  return true;
}
