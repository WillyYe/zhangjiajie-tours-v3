// 共享图片库内核（各首页模块复用，物理隔离）
// 每个模块独立 images/<slug>/ + admin/imglib/<slug>.json，杜绝跨模块借图导致的丢失/混乱。
// 用法：const lib = createImageLib({ slug: 'hero', findReferences }); lib.open(thumbBox, thumb, input, onInput)
import { getFileSha, putFile, putImage, deleteFile } from './github.js';

export function createImageLib({ slug, findReferences }) {
  const LIB_PATH = `admin/imglib/${slug}.json`;
  const imgUrl = (name) => new URL(`../images/${slug}/`, import.meta.url).href + name + '.webp';
  const listUrl = new URL(`./imglib/${slug}.json`, import.meta.url);
  const imgDir = `images/${slug}/`;

  let libModal = null;
  let uploadModal = null;
  let state = { list: [], thumbBox: null, thumb: null, input: null, onInput: null };

  function setStatus(node, msg, type) {
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

  async function syncList(list) {
    const content = JSON.stringify([...list].sort(), null, 2) + '\n';
    const sha = await getFileSha(LIB_PATH);
    await putFile(LIB_PATH, content, sha, `Update ${slug} image list via admin`);
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
    }
  }

  // ---------- 上传（浏览器端转 webp） ----------
  function sanitizeName(raw) {
    return (raw || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '')
      .replace(/\.webp$/, '').replace(/_{2,}/g, '_').replace(/-{2,}/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '');
  }
  async function fileToWebp(file, quality = 0.92) {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', quality));
    if (!blob) throw new Error('当前浏览器不支持 webp 编码');
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
    fileInput.accept = 'image/*';
    const previewImg = document.createElement('img');
    previewImg.className = 'upload-preview';
    previewImg.hidden = true;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'upload-name';
    nameInput.placeholder = '文件名（不含扩展名）';
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
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    actions.append(cancelBtn, confirmBtn);
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.append(
      Object.assign(document.createElement('label'), { className: 'upload-label', textContent: '选择图片（jpg / png / webp …）' }),
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
    const upState = { blob: null, finalName: '' };
    fileInput.onchange = async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      setStatus(status, '正在转换…', 'info');
      try {
        const { blob, w, h, ow, oh } = await fileToWebp(file);
        previewImg.src = URL.createObjectURL(blob);
        previewImg.hidden = false;
        nameInput.value = sanitizeName(file.name.replace(/\.[^.]+$/, ''));
        meta.textContent = `原图 ${ow}×${oh} → webp ${w}×${h}，约 ${(blob.size / 1024).toFixed(0)} KB`;
        upState.blob = blob;
        upState.finalName = nameInput.value;
        confirmBtn.disabled = false;
        setStatus(status, '', '');
      } catch (e) { setStatus(status, '转换失败：' + e.message, 'err'); }
    };
    nameInput.oninput = () => { upState.finalName = nameInput.value; };
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
    if (!raw) { setStatus(refs.status, '请填写有效的文件名', 'err'); return; }
    if (!upState.blob) { setStatus(refs.status, '请先选择图片', 'err'); return; }
    const finalName = raw;
    const path = `${imgDir}${finalName}.webp`;
    setStatus(refs.status, '上传中…', 'info');
    refs.confirmBtn.disabled = true;
    try {
      const existingSha = await getFileSha(path);
      if (existingSha) {
        if (!confirm(`${path} 已存在，是否覆盖？`)) { setStatus(refs.status, '已取消', 'info'); refs.confirmBtn.disabled = false; return; }
      }
      await putImage(path, upState.blob, existingSha, `Upload ${finalName}.webp via admin`);
      const newList = state.list.includes(finalName) ? state.list : [...state.list, finalName].sort();
      await syncList(newList);
      state.list = newList;
      renderLibGrid(state.input.value);
      setStatus(refs.status, `已上传 ${finalName}.webp`, 'ok');
      setTimeout(() => { uploadModal.mask.hidden = true; }, 900);
    } catch (e) {
      setStatus(refs.status, '上传失败：' + e.message, 'err');
      refs.confirmBtn.disabled = false;
    }
  }

  return { open: openImageLib, imgUrl };
}
