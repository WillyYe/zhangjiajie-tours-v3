// 共享图片库内核（各首页模块复用，物理隔离）
// 每个模块独立 images/<slug>/ + admin/imglib/<slug>.json，杜绝跨模块借图导致的丢失/混乱。
// 用法：const lib = createImageLib({ slug: 'hero', findReferences }); lib.open(thumbBox, thumb, input, onInput)
import { getFileSha, putFile, putImage, deleteFile } from './github.js';

// 文件名必须是小写字母/数字开头，可含 . - _（与 sanitizeName 输出一致）
const NAME_RE = /^[a-z0-9][a-z0-9._-]*$/;
// 浏览器无法解码重编码的格式：拦截在转换之前，避免无声失败
const BLOCKED_EXT = /\.(heic|heif|tif|tiff)$/i;
const BLOCKED_TYPES = ['image/heic', 'image/heif', 'image/tiff'];

// 全局可见的错误提示（app.js 注入 window.__adminToast）
function toastErr(msg) {
  if (typeof window !== 'undefined' && window.__adminToast) window.__adminToast(msg, 'err');
  else console.error('[imglib]', msg);
}
// 全局兜底：任何未捕获的异步异常都给用户一个可见提示，杜绝完全静默
if (typeof window !== 'undefined' && !window.__imglibRejectBound) {
  window.__imglibRejectBound = true;
  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev.reason;
    toastErr('图片库操作出错：' + (r && r.message ? r.message : String(r)));
  });
}

export function createImageLib({ slug, findReferences }) {
  const LIB_PATH = `admin/imglib/${slug}.json`;
  const imgUrl = (name) => new URL(`../images/${slug}/`, import.meta.url).href + name + '.webp';
  const listUrl = new URL(`./imglib/${slug}.json`, import.meta.url);
  const imgDir = `images/${slug}/`;

  let libModal = null;
  let uploadModal = null;
  let uploadRetryBtn = null;
  let state = { list: [], thumbBox: null, thumb: null, input: null, onInput: null };

  function setStatus(node, msg, type) {
    if (!node) return;
    node.textContent = msg || '';
    node.className = 'img-lib-status ' + (type || '');
    node.hidden = !msg;
  }

  function buildLibModal() {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.hidden = true;
    const modal = document.createElement('div');
    modal.className = 'modal img-lib-modal';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'icon-btn';
    closeBtn.style.cssText = 'margin-left:auto;font-size:18px';
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => (mask.hidden = true);
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `<div class="modal-icon">🖼</div><div><h2>图片库</h2><p class="modal-subtitle" id="libSubtitle">本模块图片库 · 可上传 / 删除</p></div>`;
    header.appendChild(closeBtn);
    const search = document.createElement('input');
    search.className = 'img-lib-search';
    search.type = 'text';
    search.placeholder = '🔍 搜索文件名…';
    search.oninput = () => renderLibGrid(state.input ? state.input.value : '');
    const uploadBtn = document.createElement('button');
    uploadBtn.type = 'button';
    uploadBtn.className = 'btn btn-sm';
    uploadBtn.textContent = '⬆ 上传图片';
    uploadBtn.onclick = () => openUploadPanel();
    const toolbar = document.createElement('div');
    toolbar.className = 'img-lib-toolbar';
    toolbar.append(search, uploadBtn);
    const grid = document.createElement('div');
    grid.className = 'img-lib-grid';
    const status = document.createElement('div');
    status.className = 'img-lib-status';
    status.hidden = true;
    modal.append(header, toolbar, grid, status);
    mask.append(modal);
    mask.addEventListener('click', (e) => { if (e.target === mask) mask.hidden = true; });
    document.body.append(mask);
    return { mask, grid, toolbar, status };
  }

  async function syncList(list, attempt = 0) {
    const content = JSON.stringify([...list].sort(), null, 2) + '\n';
    const sha = await getFileSha(LIB_PATH);
    try {
      await putFile(LIB_PATH, content, sha, `Update ${slug} image list via admin`);
    } catch (e) {
      // 409（并发/连点导致 sha 过期）→ 用最新 sha 重试一次
      if (attempt < 1 && /409/i.test(e.message || '')) return syncList(list, attempt + 1);
      throw e;
    }
  }

  async function openImageLib(thumbBox, thumb, input, onInput) {
    if (!libModal) libModal = buildLibModal();
    state = { list: [], thumbBox, thumb, input, onInput };
    libModal.grid.replaceChildren(Object.assign(document.createElement('div'), { className: 'img-lib-loading', textContent: '加载中…' }));
    setStatus(libModal.status, '', '');
    const sub = libModal.mask.querySelector('#libSubtitle');
    if (sub) sub.textContent = `本模块图片库 · images/${slug}/（仅显示本模块图片）`;
    try {
      const res = await fetch(listUrl);
      state.list = res.ok ? await res.json() : [];
      renderLibGrid(input.value);
    } catch (e) {
      state.list = [];
      renderLibGrid(input.value);
    }
    libModal.mask.hidden = false;
  }

  function renderLibGrid(currentName) {
    const q = (libModal.toolbar.querySelector('.img-lib-search').value || '').toLowerCase().trim();
    const filtered = q ? state.list.filter((n) => n.toLowerCase().includes(q)) : state.list;
    libModal.grid.replaceChildren();
    if (!filtered.length) {
      libModal.grid.append(Object.assign(document.createElement('div'), { className: 'img-lib-err', textContent: q ? '没有匹配的文件' : '图片库为空，点「上传图片」添加' }));
      return;
    }
    let selectedEl = null;
    for (const name of filtered) {
      const cell = document.createElement('div');
      cell.className = 'img-lib-item' + (name === currentName ? ' selected' : '');
      const im = document.createElement('img');
      im.src = imgUrl(name);
      im.loading = 'lazy';
      im.alt = name;
      im.onerror = () => cell.classList.add('broken');
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'img-lib-del';
      delBtn.title = '删除';
      delBtn.textContent = '🗑';
      delBtn.onclick = (e) => { e.stopPropagation(); confirmDelete(name); };
      const label = document.createElement('span');
      label.className = 'img-lib-name';
      label.textContent = name;
      cell.append(im, label, delBtn);
      cell.onclick = () => pickImage(name);
      libModal.grid.append(cell);
      if (name === currentName) selectedEl = cell;
    }
    if (selectedEl) requestAnimationFrame(() => selectedEl.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }

  function pickImage(name) {
    const { input, thumb, thumbBox, onInput } = state;
    input.value = name;
    thumb.src = imgUrl(name);
    thumbBox.classList.remove('no-img');
    onInput(name);
    libModal.mask.hidden = true;
  }

  async function confirmDelete(name) {
    const refs = (findReferences || (() => []))(name);
    if (refs.length) {
      setStatus(libModal.status, `⚠️ 无法删除：${name}.webp 正被引用（${refs.join('、')}）。删除会导致前台破图。`, 'err');
      return;
    }
    if (!confirm(`确认删除 ${name}.webp？此操作不可撤销。`)) return;
    setStatus(libModal.status, '删除中…', 'info');
    try {
      const path = `${imgDir}${name}.webp`;
      const sha = await getFileSha(path);
      if (!sha) { setStatus(libModal.status, `文件不存在：${path}`, 'err'); return; }
      await deleteFile(path, sha, `Delete ${name}.webp via admin`);
      const newList = state.list.filter((n) => n !== name);
      await syncList(newList);
      state.list = newList;
      renderLibGrid(state.input.value);
      setStatus(libModal.status, `已删除 ${name}.webp`, 'ok');
    } catch (e) {
      setStatus(libModal.status, '删除失败：' + e.message, 'err');
      toastErr('删除失败：' + e.message);
    }
  }

  // ---------- 上传（浏览器端转 webp） ----------
  function sanitizeName(raw) {
    return (raw || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '')
      .replace(/\.webp$/, '').replace(/_{2,}/g, '_').replace(/-{2,}/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '');
  }
  // 即时校验文件名：空/非法 → 红字 + 禁用「转换并上传」
  function validateName(nameInput, status, confirmBtn) {
    const raw = (nameInput.value || '').trim();
    const s = sanitizeName(raw);
    if (!raw) {
      setStatus(status, '请填写文件名（仅小写字母/数字，可含 . - _）', 'err');
      confirmBtn.disabled = true;
      return false;
    }
    if (!NAME_RE.test(s)) {
      setStatus(status, '文件名含非法字符，请用小写字母/数字（可含 . - _），不要使用中文或空格', 'err');
      confirmBtn.disabled = true;
      return false;
    }
    setStatus(status, '', '');
    confirmBtn.disabled = false;
    return true;
  }
  async function fileToWebp(file, quality = 0.92) {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', quality));
    if (!blob) throw new Error('当前浏览器不支持 webp 编码（请换 Chrome / Edge）');
    return { blob, w: bitmap.width, h: bitmap.height, ow: bitmap.width, oh: bitmap.height };
  }
  function buildUploadModal() {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.hidden = true;
    const panel = document.createElement('div');
    panel.className = 'modal upload-modal';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'icon-btn';
    closeBtn.style.cssText = 'margin-left:auto;font-size:18px';
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => (mask.hidden = true);
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `<div class="modal-icon">⬆</div><div><h2>上传图片</h2><p class="modal-subtitle">选择本地图片，统一转换为 webp 后上传到 images/${slug}/</p></div>`;
    header.appendChild(closeBtn);
    const fileInput = document.createElement('input');
    fileInput.id = 'upFile';
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/png,image/webp';
    const previewImg = document.createElement('img');
    previewImg.className = 'upload-preview';
    previewImg.hidden = true;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'upload-name';
    nameInput.placeholder = '文件名（不含扩展名，仅小写字母/数字）';
    const meta = document.createElement('div');
    meta.className = 'upload-meta';
    meta.textContent = '';
    const status = document.createElement('div');
    status.className = 'img-lib-status';
    status.hidden = true;
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn btn-primary';
    confirmBtn.textContent = '转换并上传';
    confirmBtn.disabled = true;
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-ghost';
    cancelBtn.textContent = '取消';
    cancelBtn.onclick = () => (mask.hidden = true);
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'btn btn-ghost';
    retryBtn.textContent = '仅重试清单同步';
    retryBtn.hidden = true;
    retryBtn.onclick = async () => {
      retryBtn.disabled = true;
      setStatus(status, '正在重试清单同步…', 'info');
      try {
        await syncList(state.list);
        setStatus(status, '✓ 清单已同步', 'ok');
        retryBtn.hidden = true;
        setTimeout(() => { if (uploadModal) uploadModal.mask.hidden = true; }, 700);
      } catch (e) {
        setStatus(status, '清单同步仍失败：' + e.message, 'err');
        toastErr('清单同步失败：' + e.message);
      } finally {
        retryBtn.disabled = false;
      }
    };
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    actions.append(cancelBtn, retryBtn, confirmBtn);
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.append(
      Object.assign(document.createElement('label'), { className: 'upload-label', textContent: '选择图片（jpg / png / webp）' }),
      fileInput,
      previewImg,
      Object.assign(document.createElement('label'), { className: 'upload-label', textContent: '文件名（自动净化，强制 .webp）' }),
      nameInput,
      meta,
      status,
    );
    panel.append(header, body, actions);
    mask.append(panel);
    mask.addEventListener('click', (e) => { if (e.target === mask) mask.hidden = true; });
    document.body.append(mask);
    uploadRetryBtn = retryBtn;
    const upState = { blob: null, finalName: '' };
    fileInput.onchange = async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      // 前置拦截浏览器无法编码的格式（HEIC/HEIF/TIFF），给出明确提示，不进转换
      if (BLOCKED_EXT.test(file.name) || BLOCKED_TYPES.includes(file.type)) {
        const ext = (file.name.split('.').pop() || file.type || '未知').toUpperCase();
        setStatus(status, `当前格式（${ext}）浏览器无法编码，请先转成 JPG / PNG 再上传`, 'err');
        previewImg.hidden = true;
        confirmBtn.disabled = true;
        return;
      }
      setStatus(status, '正在转换…', 'info');
      try {
        const { blob, w, h, ow, oh } = await fileToWebp(file);
        previewImg.src = URL.createObjectURL(blob);
        previewImg.hidden = false;
        const auto = sanitizeName(file.name.replace(/\.[^.]+$/, ''));
        nameInput.value = auto;
        meta.textContent = `原图 ${ow}×${oh} → webp ${w}×${h}，约 ${(blob.size / 1024).toFixed(0)} KB`;
        upState.blob = blob;
        upState.finalName = auto;
        validateName(nameInput, status, confirmBtn); // 空名/非法名即时报红并禁用
      } catch (e) {
        setStatus(status, '转换失败：' + e.message, 'err');
        confirmBtn.disabled = true;
        toastErr('转换失败：' + e.message);
      }
    };
    nameInput.oninput = () => {
      upState.finalName = nameInput.value;
      validateName(nameInput, status, confirmBtn);
    };
    confirmBtn.onclick = () => doUpload(upState, { previewImg, nameInput, meta, status, confirmBtn });
    return { mask, panel };
  }
  function openUploadPanel() {
    if (!uploadModal) uploadModal = buildUploadModal();
    const m = uploadModal;
    const fileInput = m.panel.querySelector('#upFile');
    const previewImg = m.panel.querySelector('.upload-preview');
    const nameInput = m.panel.querySelector('.upload-name');
    const meta = m.panel.querySelector('.upload-meta');
    const status = m.panel.querySelector('.img-lib-status');
    const confirmBtn = m.panel.querySelector('.btn-primary');
    if (uploadRetryBtn) uploadRetryBtn.hidden = true;
    fileInput.value = '';
    previewImg.src = '';
    previewImg.hidden = true;
    nameInput.value = '';
    meta.textContent = '';
    setStatus(status, '');
    confirmBtn.disabled = true;
    m.mask.hidden = false;
  }
  async function doUpload(upState, refs) {
    const raw = sanitizeName(upState.finalName);
    if (!raw) { setStatus(refs.status, '请填写有效的文件名（仅小写字母/数字，可含 . - _）', 'err'); return; }
    if (!NAME_RE.test(raw)) { setStatus(refs.status, '文件名含非法字符，请用小写字母/数字（可含 . - _）', 'err'); return; }
    if (!upState.blob) { setStatus(refs.status, '请先选择图片', 'err'); return; }
    const finalName = raw;
    const path = `${imgDir}${finalName}.webp`;
    setStatus(refs.status, '上传中…', 'info');
    refs.confirmBtn.disabled = true;
    if (uploadRetryBtn) uploadRetryBtn.hidden = true;
    try {
      const existingSha = await getFileSha(path);
      if (existingSha) {
        if (!confirm(`${path} 已存在，是否覆盖？`)) { setStatus(refs.status, '已取消', 'info'); refs.confirmBtn.disabled = false; return; }
      }
      await putImage(path, upState.blob, existingSha, `Upload ${finalName}.webp via admin`);
      // 乐观更新：图已上服务器 → 立即更新列表 + 渲染 + 提示，不让后续清单失败误判为“上传失败”
      const newList = state.list.includes(finalName) ? state.list : [...state.list, finalName].sort();
      state.list = newList;
      renderLibGrid(state.input.value);
      setStatus(refs.status, `✓ 已上传 ${finalName}.webp（正在同步清单…）`, 'ok');
      // 回读确认服务器确实收到，防止“以为成功其实没传上”
      const confirmSha = await getFileSha(path);
      if (!confirmSha) {
        setStatus(refs.status, '服务器未确认收到图片，请重试上传', 'err');
        toastErr('上传未确认，请重试');
        refs.confirmBtn.disabled = false;
        return;
      }
      // 同步清单：失败不再报“上传失败”，改为非阻塞警告 + 重试按钮
      try {
        await syncList(newList);
        setStatus(refs.status, `✓ 已上传并同步 ${finalName}.webp`, 'ok');
        setTimeout(() => { if (uploadModal) uploadModal.mask.hidden = true; }, 900);
      } catch (e) {
        setStatus(refs.status, `图片已上传成功，但清单未同步：${e.message}（图片已可用，可稍后重试）`, 'warn');
        toastErr('清单同步失败：' + e.message);
        if (uploadRetryBtn) uploadRetryBtn.hidden = false;
      }
    } catch (e) {
      setStatus(refs.status, '上传失败：' + e.message, 'err');
      toastErr('上传失败：' + e.message);
      refs.confirmBtn.disabled = false;
    }
  }

  return { open: openImageLib, imgUrl };
}
