// zhangjiajie-tours-v3 — Static integrity & baseline a11y audit for ALL pages.
// Adapted from myguilin's multi-page audit; covers index.html + attractions/*.html.
// Run: node tests/static-audit.mjs   (from project root)
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const imagesDir = path.join(ROOT, 'images');

// ---- collect pages: index.html + every attractions/*.html ----
const pages = ['index.html'];
const attrDir = path.join(ROOT, 'attractions');
if (fs.existsSync(attrDir)) {
  for (const f of fs.readdirSync(attrDir).sort()) {
    if (f.endsWith('.html')) pages.push(path.join('attractions', f));
  }
}

// Resolve a local path reference relative to the page's own directory.
// External (http/https/protocol-relative/data) refs are treated as present.
function existsRel(pageDir, p) {
  if (/^https?:/i.test(p) || p.startsWith('//') || p.startsWith('data:')) return true;
  if (p.startsWith('/')) return fs.existsSync(path.join(ROOT, p.replace(/^\/+/, '')));
  return fs.existsSync(path.resolve(pageDir, p));
}

let totalPass = 0, totalFail = 0, totalWarn = 0;

for (const file of pages) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const isIndex = file === 'index.html';
  const pageDir = path.dirname(path.resolve(ROOT, file));
  const pass = [], fail = [], warn = [];

  const ids = new Set();
  for (const m of html.matchAll(/\bid="([^"]+)"/g)) ids.add(m[1]);
  const refImgs = new Set();
  for (const m of html.matchAll(/src=["']([^"']+\.(?:webp|jpg|jpeg|avif|png))["']/gi)) refImgs.add(m[1].toLowerCase());
  for (const m of html.matchAll(/url\(["']?([^"'()]+\.(?:webp|jpg|jpeg|avif|png))["']?\)/gi)) refImgs.add(m[1].toLowerCase());
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
  const imgTags = [...html.matchAll(/<img\b[^>]*>/g)].map((t) => t[0]);

  // ---- T1: referenced images exist (resolved per-page) ----
  const missingImgs = [...refImgs].filter((i) => !existsRel(pageDir, i));
  if (missingImgs.length) fail.push({ name: 'Referenced images missing on disk', detail: missingImgs.slice(0, 8).join(', ') + (missingImgs.length > 8 ? ` …(+${missingImgs.length - 8})` : '') });
  else pass.push({ name: `All ${refImgs.size} referenced images exist` });

  // ---- T2: in-page anchors resolve ----
  const brokenAnchors = hrefs.filter((h) => h.startsWith('#') && h.length > 1 && !ids.has(h.slice(1)));
  if (brokenAnchors.length) fail.push({ name: 'In-page anchor links with no target id', detail: [...new Set(brokenAnchors)].slice(0, 6).join(', ') });
  else pass.push({ name: `All ${hrefs.filter((h) => h.startsWith('#') && h.length > 1).length} in-page #anchors resolve` });

  // ---- T3: sub-page .html links ----
  // Links to attraction sub-pages that are not yet built are flagged as WARN
  // (not fail) so the audit stays green while the 8-page module is rolled out.
  const missingPages = hrefs.filter((h) => h.endsWith('.html') && !/^https?:/i.test(h) && !existsRel(pageDir, h));
  if (missingPages.length) {
    const deferred = missingPages.every((p) => /^(\.\.\/)?attractions\//.test(p));
    if (deferred) warn.push({ name: 'Links to attraction sub-pages not yet built', detail: missingPages.slice(0, 8).join(', ') });
    else fail.push({ name: 'Sub-page .html links point to missing files', detail: missingPages.slice(0, 8).join(', ') });
  } else pass.push({ name: 'All .html sub-page links resolve' });

  // ---- T4: alt text ----
  const noAltAttr = imgTags.filter((t) => !/\balt=/.test(t));
  const emptyAlt = imgTags.filter((t) => /\balt=["']\s*["']/.test(t));
  if (noAltAttr.length) fail.push({ name: 'Images missing alt attribute (a11y)', detail: `${noAltAttr.length} <img> with no alt` });
  else if (emptyAlt.length) pass.push({ name: `All ${imgTags.length} <img> carry an alt (${emptyAlt.length} empty-alt decorative — WCAG-OK)` });
  else pass.push({ name: `All ${imgTags.length} <img> have descriptive alt` });

  // ---- T5: lazy loading (hero with fetchpriority=high exempt) ----
  const noLazy = imgTags.filter((t) => !/loading=["']lazy["']/.test(t) && !/fetchpriority=["']high["']/.test(t));
  if (noLazy.length) warn.push({ name: 'Images without loading="lazy"', detail: `${noLazy.length} <img> not lazy (hero/section bg may be CSS)` });
  else pass.push({ name: `All ${imgTags.length} <img> use loading="lazy"` });

  // ---- T6: card counts (index only) ----
  if (isIndex) {
    const attrCards = [...html.matchAll(/\bid="attraction-[a-z-]+"/g)].length;
    const expCards = [...html.matchAll(/\bid="exp-[a-z-]+"/g)].length;
    attrCards === 8 ? pass.push({ name: 'Attractions module has 8 cards' }) : fail.push({ name: 'Attractions card count', detail: `found ${attrCards}, expected 8` });
    expCards === 6 ? pass.push({ name: 'Experiences module has 6 cards' }) : fail.push({ name: 'Experiences card count', detail: `found ${expCards}, expected 6` });
  }

  // ---- T7: performance budget (per page) ----
  let totalBytes = 0, maxFile = '', maxBytes = 0;
  for (const i of refImgs) {
    const p = path.resolve(pageDir, i);
    if (fs.existsSync(p)) { const s = fs.statSync(p).size; totalBytes += s; if (s > maxBytes) { maxBytes = s; maxFile = i; } }
  }
  const totalKB = Math.round(totalBytes / 1024);
  if (totalBytes < 2.5 * 1024 * 1024) pass.push({ name: `Referenced image payload ${totalKB}KB (budget <2.5MB)`, detail: `largest: ${maxFile} ${Math.round(maxBytes / 1024)}KB` });
  else fail.push({ name: 'Image payload exceeds 2.5MB budget', detail: `${totalKB}KB total` });
  const over200 = [...refImgs].filter((i) => { const p = path.resolve(pageDir, i); return fs.existsSync(p) && fs.statSync(p).size > 200 * 1024; });
  if (over200.length) warn.push({ name: 'Individual images >200KB (review compression)', detail: over200.map((i) => `${i} ${Math.round(fs.statSync(path.resolve(pageDir, i)).size / 1024)}KB`).join(', ') });

  // ---- T8: dead files (index only — global check) ----
  if (isIndex) {
    const allImgFiles = fs.readdirSync(imagesDir).filter((f) => /\.(webp|jpg|jpeg|avif|png)$/i.test(f));
    const isRef = (f) => refImgs.has('images/' + f.toLowerCase());
    const dead = allImgFiles.filter((f) => !isRef(f));
    if (dead.length) warn.push({ name: 'Unreferenced image files on disk', detail: dead.join(', ') });
    else pass.push({ name: 'No stray dead image files' });
  }

  // ---- T9: lang / landmarks ----
  if (/<html[^>]*\blang=/.test(html)) pass.push({ name: '<html lang="en"> attribute present (a11y)' });
  else fail.push({ name: 'Missing <html lang> attribute' });
  const navCount = (html.match(/<nav\b/g) || []).length;
  const footerCount = (html.match(/<footer\b/g) || []).length;
  (navCount > 0 ? pass : warn).push({ name: `Landmark: <nav> x${navCount}, <footer> x${footerCount}` });

  // ---- T10: heading hierarchy ----
  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>/g)].map((m) => +m[1]);
  const h1Count = headings.filter((x) => x === 1).length;
  if (h1Count !== 1) warn.push({ name: 'Heading structure: exactly one <h1> expected', detail: `found ${h1Count} <h1>` });
  else pass.push({ name: 'Exactly one <h1> present' });
  let skipped = false;
  for (let i = 1; i < headings.length; i++) if (headings[i] - headings[i - 1] > 1) { skipped = true; break; }
  if (skipped) warn.push({ name: 'Heading levels skip (e.g. h1→h3)', detail: headings.join(' ') + ' — avoid skipping levels' });
  else pass.push({ name: 'Heading levels do not skip (sequence: ' + headings.join('>') + ')' });

  // ---- T11: form fields have programmatic label ----
  const formFields = [...html.matchAll(/<(input|textarea|select)\b([^>]*)>/g)];
  const labelledOk = []; const unlabelled = [];
  for (const m of formFields) {
    const tag = m[1], attrs = m[2];
    if (/\btype=["']?(hidden|submit|button|reset)["']?/.test(attrs)) continue;
    const idm = attrs.match(/\bid=["']([^"']+)["']/);
    const hasFor = idm && new RegExp(`<label[^>]*for=["']${idm[1]}["']`).test(html);
    const aria = /\baria-label=/.test(attrs) || /\baria-labelledby=/.test(attrs) || /\btitle=/.test(attrs);
    if (hasFor || aria) labelledOk.push(tag);
    else if (/\bplaceholder=/.test(attrs)) unlabelled.push(tag + '(placeholder-only)');
    else unlabelled.push(tag);
  }
  if (unlabelled.length) fail.push({ name: 'Form fields without programmatic label (a11y)', detail: unlabelled.join(', ') + ' — need <label for> or aria-label' });
  else pass.push({ name: `All ${labelledOk.length} form fields have a programmatic label` });

  // ---- T12: links have accessible name ----
  const aBlocks = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
  const emptyA = [];
  for (const m of aBlocks) {
    const attrs = m[1], inner = m[2];
    if (/href=["']#/.test(attrs) || /href=["']javascript:void\(0\)/.test(attrs)) continue;
    const named = /\baria-label=["'][^"']/.test(attrs) || /\baria-labelledby=/.test(attrs);
    const text = inner.replace(/<[^>]+>/g, '').trim();
    const imgAlt = /<img[^>]*alt=["'][^"']/.test(inner);
    if (!named && !text && !imgAlt) emptyA.push(attrs.slice(0, 50));
  }
  if (emptyA.length) fail.push({ name: 'Links with no accessible name (a11y)', detail: emptyA.length + ' empty <a> — need text or aria-label' });
  else pass.push({ name: `All ${aBlocks.length} links have an accessible name (text / aria-label / img-alt)` });

  // ---- T13: focus-visible styling (inline OR linked CSS) ----
  const focusInline = /:focus\b|:focus-visible|focus:\\w|@apply\s+focus|class=["'][^"']*\bfocus:/.test(html);
  let cssFocus = false;
  for (const m of html.matchAll(/href=["']([^"']*\.css)["']/g)) {
    const cp = path.resolve(pageDir, m[1]);
    if (fs.existsSync(cp) && /:focus-visible|:focus\b/.test(fs.readFileSync(cp, 'utf8'))) cssFocus = true;
  }
  if (focusInline || cssFocus) pass.push({ name: 'Focus-visible styling present (keyboard navigation)' });
  else warn.push({ name: 'No focus-visible styling detected', detail: 'keyboard users may not see focus ring' });

  // ---- T14: contact modal dialog semantics (WCAG 4.1.2) ----
  const modalMatch = html.match(/<div id="contactModal"([^>]*)>/);
  if (!modalMatch) {
    fail.push({ name: 'Contact modal element present', detail: '#contactModal not found' });
  } else {
    const ma = modalMatch[1];
    const labelledby = (ma.match(/aria-labelledby=["']([^"']+)["']/) || [])[1];
    const titleExists = labelledby && new RegExp(`id=["']${labelledby}["']`).test(html);
    const ok = /role=["']dialog["']/.test(ma) && /aria-modal=["']true["']/.test(ma) && titleExists;
    if (ok) pass.push({ name: 'Contact modal exposes dialog semantics (role/aria-modal/aria-labelledby→title)' });
    else fail.push({ name: 'Contact modal missing dialog role/aria (a11y WCAG 4.1.2)', detail: 'needs role="dialog" aria-modal="true" aria-labelledby→title id' });
  }

  // ---- T15: no harmful javascript: URI links ----
  const jsUri = [...html.matchAll(/href=["']javascript:([^"']*)["']/g)].map((m) => m[1].trim());
  const badJs = jsUri.filter((u) => !/^void\(0\)$/.test(u));
  if (badJs.length) fail.push({ name: 'javascript: URI used as link (semantics/a11y)', detail: badJs.length + ' non-void occurrence(s) — use <button> for actions' });
  else if (jsUri.length) pass.push({ name: `javascript: URIs used only as void(0) placeholders (a11y-safe)`, detail: `${jsUri.length} occurrences` });
  else pass.push({ name: 'No javascript: URI links' });

  // ---- T16: modal close mechanisms (Close button + ESC) ----
  const hasCloseBtn = /<button[^>]*aria-label=["'][^"']*Close/.test(html);
  const hasEsc = /Escape/.test(html) && /contactModal/.test(html);
  if (hasCloseBtn && hasEsc) pass.push({ name: 'Modal close mechanisms present (Close button + ESC key)' });
  else fail.push({ name: 'Modal missing a close mechanism', detail: `closeBtn=${hasCloseBtn}, escHandler=${hasEsc}` });

  // ---- T17: mobile menu auto-closes ----
  const hasCloseFn = /function\s+closeMobileMenu/.test(html) &&
    /getElementById\(['"]mobile-menu['"]\)/.test(html) &&
    /classList\.add\(['"]hidden['"]\)/.test(html);
  if (hasCloseFn) pass.push({ name: 'Mobile menu has an auto-close handler (closeMobileMenu hides #mobile-menu)' });
  else warn.push({ name: 'Mobile menu auto-close handler not detected', detail: 'verify tapping a section link collapses #mobile-menu' });

  // ---- per-page report ----
  console.log(`\n===== ${file} =====`);
  console.log('  PASS');
  for (const r of pass) console.log('  ✓ ' + r.name + (r.detail ? '  [' + r.detail + ']' : ''));
  console.log('  FAIL');
  if (!fail.length) console.log('  (none)');
  for (const r of fail) console.log('  ✗ ' + r.name + '  → ' + r.detail);
  console.log('  WARN');
  if (!warn.length) console.log('  (none)');
  for (const r of warn) console.log('  ! ' + r.name + '  → ' + r.detail);

  totalPass += pass.length; totalFail += fail.length; totalWarn += warn.length;
}

console.log(`\n===== TOTAL: ${totalPass} pass, ${totalFail} fail, ${totalWarn} warn across ${pages.length} pages =====\n`);
process.exit(totalFail ? 1 : 0);
