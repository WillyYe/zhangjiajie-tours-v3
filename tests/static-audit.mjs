// zhangjiajie-tours-v3 — First-level page static integrity & baseline audit
// Adapted from myguilin's static-audit for the v3 structure.
// Run: node tests/static-audit.mjs   (from project root)
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const htmlPath = path.join(ROOT, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const imagesDir = path.join(ROOT, 'images');

const pass = [];
const fail = [];
const warn = [];
const add = (arr, name, detail = '') => arr.push({ name, detail });

// ---- collect ----
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const IMG_RE = /images\/[A-Za-z0-9_.\/-]+\.(?:webp|jpg|jpeg|avif|png)/i;
const refImgs = new Set();
for (const m of html.matchAll(new RegExp(`(?:src|url)\\(\\s*['"]?(${IMG_RE.source})['"]?\\s*\\)`, 'gi'))) refImgs.add(m[1].toLowerCase());
for (const m of html.matchAll(new RegExp(`src=["'](${IMG_RE.source})["']`, 'gi'))) refImgs.add(m[1].toLowerCase());
const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map(m => m[1]);
const imgTags = [...html.matchAll(/<img\b[^>]*>/g)].map(t => t[0]);

// ---- T1: referenced images exist ----
const missingImgs = [...refImgs].filter(i => !fs.existsSync(path.join(ROOT, i)));
if (missingImgs.length) fail.push({ name: 'Referenced images missing on disk', detail: missingImgs.join(', ') });
else pass.push({ name: `All ${refImgs.size} referenced images exist on disk` });

// ---- T2: in-page anchors resolve ----
const brokenAnchors = hrefs.filter(h => h.startsWith('#') && h.length > 1 && !ids.has(h.slice(1)));
if (brokenAnchors.length) fail.push({ name: 'In-page anchor links with no target id', detail: [...new Set(brokenAnchors)].join(', ') });
else pass.push({ name: `All ${hrefs.filter(h => h.startsWith('#') && h.length > 1).length} in-page #anchors resolve to an element` });

// ---- T3: sub-page .html links ----
const missingPages = hrefs.filter(h => h.endsWith('.html') && !fs.existsSync(path.join(ROOT, h)));
if (missingPages.length) fail.push({ name: 'Sub-page .html links point to missing files', detail: missingPages.join(', ') });
else pass.push({ name: 'All .html sub-page links resolve (single-page site: ' + (hrefs.filter(h => h.endsWith('.html')).length) + ' such links)' });

// ---- T4: alt text ----
const noAltAttr = imgTags.filter(t => !/\balt=/.test(t));
const emptyAlt = imgTags.filter(t => /\balt=["']\s*["']/.test(t));
if (noAltAttr.length) fail.push({ name: 'Images missing alt attribute entirely (a11y)', detail: `${noAltAttr.length} <img> with no alt attribute` });
else if (emptyAlt.length) pass.push({ name: `All ${imgTags.length} <img> carry an alt attribute (${emptyAlt.length} empty-alt decorative — WCAG-OK)` });
else pass.push({ name: `All ${imgTags.length} <img> have descriptive alt text` });

// ---- T5: lazy loading ----
const noLazy = imgTags.filter(t => !/loading=["']lazy["']/.test(t));
if (noLazy.length) warn.push({ name: 'Images without loading="lazy"', detail: `${noLazy.length} <img> not lazy (note: hero/section backgrounds are CSS, not <img>)` });
else pass.push({ name: `All ${imgTags.length} <img> use loading="lazy"` });

// ---- T6: card counts (v3: 8 attractions, 6 experiences) ----
const attrCards = [...html.matchAll(/\bid="attraction-[a-z-]+"/g)].length;
const expCards = [...html.matchAll(/\bid="exp-[a-z-]+"/g)].length;
attrCards === 8 ? pass.push({ name: 'Attractions module has 8 cards' }) : fail.push({ name: 'Attractions card count', detail: `found ${attrCards}, expected 8` });
expCards === 6 ? pass.push({ name: 'Experiences module has 6 cards' }) : fail.push({ name: 'Experiences card count', detail: `found ${expCards}, expected 6` });

// ---- T7: performance budget ----
let totalBytes = 0, maxFile = '', maxBytes = 0;
for (const i of refImgs) {
  const p = path.join(ROOT, i);
  if (fs.existsSync(p)) { const s = fs.statSync(p).size; totalBytes += s; if (s > maxBytes) { maxBytes = s; maxFile = i; } }
}
const totalKB = Math.round(totalBytes / 1024);
if (totalBytes < 2.5 * 1024 * 1024) pass.push({ name: `Referenced image payload ${totalKB}KB (budget <2.5MB)`, detail: `largest: ${maxFile} ${Math.round(maxBytes / 1024)}KB` });
else fail.push({ name: 'Image payload exceeds 2.5MB budget', detail: `${totalKB}KB total` });
const over200 = [...refImgs].filter(i => { const p = path.join(ROOT, i); return fs.existsSync(p) && fs.statSync(p).size > 200 * 1024; });
if (over200.length) warn.push({ name: 'Individual images >200KB (review compression)', detail: over200.map(i => `${i} ${Math.round(fs.statSync(path.join(ROOT, i)).size / 1024)}KB`).join(', ') });

// ---- T8: dead files ----
const allImgFiles = fs.readdirSync(imagesDir).filter(f => /\.(webp|jpg|jpeg|avif|png)$/i.test(f));
const isRef = f => refImgs.has('images/' + f.toLowerCase());
const dead = allImgFiles.filter(f => !isRef(f));
if (dead.length) warn.push({ name: 'Unreferenced image files on disk', detail: dead.join(', ') });
else pass.push({ name: 'No stray dead image files' });

// ---- T9: a11y landmarks / lang ----
if (/<html[^>]*\blang=/.test(html)) pass.push({ name: '<html lang="en"> attribute present (a11y)' });
else fail.push({ name: 'Missing <html lang> attribute', detail: 'screen readers need page language' });
const navCount = (html.match(/<nav\b/g) || []).length;
const footerCount = (html.match(/<footer\b/g) || []).length;
(navCount > 0 ? pass : warn).push({ name: `Landmark: <nav> x${navCount}, <footer> x${footerCount}` });

// ---- T10: heading hierarchy ----
const headings = [...html.matchAll(/<h([1-6])\b[^>]*>/g)].map(m => +m[1]);
const h1Count = headings.filter(x => x === 1).length;
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

// ---- T13: focus-visible styling ----
const focusStyle = /:focus\b|:focus-visible|focus:\\w|@apply\s+focus|class=["'][^"']*\bfocus:/.test(html);
if (focusStyle) pass.push({ name: 'Focus-visible styling present (keyboard navigation)' });
else warn.push({ name: 'No focus-visible styling detected', detail: 'keyboard users may not see focus ring' });

// ---- T14: Contact modal dialog semantics (WCAG 4.1.2) ----
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
// NOTE: v3 uses href="javascript:void(0)" as a placeholder on action links (a11y-safe).
const jsUri = [...html.matchAll(/href=["']javascript:([^"']*)["']/g)].map(m => m[1].trim());
const badJs = jsUri.filter(u => !/^void\(0\)$/.test(u));
if (badJs.length) fail.push({ name: 'javascript: URI used as link (semantics/a11y)', detail: badJs.length + ' non-void occurrence(s) — use <button> for actions' });
else if (jsUri.length) pass.push({ name: `javascript: URIs used only as void(0) placeholders (a11y-safe)`, detail: `${jsUri.length} occurrences` });
else pass.push({ name: 'No javascript: URI links' });

// ---- T16: modal close mechanisms (Close button + ESC) ----
const hasCloseBtn = /<button[^>]*aria-label=["'][^"']*Close/.test(html);
const hasEsc = /Escape/.test(html) && /contactModal/.test(html);
if (hasCloseBtn && hasEsc) pass.push({ name: 'Modal close mechanisms present (Close button + ESC key)' });
else fail.push({ name: 'Modal missing a close mechanism', detail: `closeBtn=${hasCloseBtn}, escHandler=${hasEsc}` });

// ---- T17: mobile menu auto-closes ----
// v3 defines closeMobileMenu() which hides #mobile-menu; it is wired on the mobile "Contact us" link.
const hasCloseFn = /function\s+closeMobileMenu/.test(html) &&
  /getElementById\(['"]mobile-menu['"]\)/.test(html) &&
  /classList\.add\(['"]hidden['"]\)/.test(html);
if (hasCloseFn) pass.push({ name: 'Mobile menu has an auto-close handler (closeMobileMenu hides #mobile-menu)' });
else warn.push({ name: 'Mobile menu auto-close handler not detected', detail: 'verify tapping a section link collapses #mobile-menu' });

// ---- report ----
console.log('\n===== zhangjiajie-tours-v3 First-Level Page — Static Audit =====');
console.log(`referenced images: ${refImgs.size} | <img> tags: ${imgTags.length} | ids: ${ids.size}`);
console.log('\n  PASS');
for (const r of pass) console.log('  ✓ ' + r.name + (r.detail ? '  [' + r.detail + ']' : ''));
console.log('\n  FAIL');
if (!fail.length) console.log('  (none)');
for (const r of fail) console.log('  ✗ ' + r.name + '  → ' + r.detail);
console.log('\n  WARN');
if (!warn.length) console.log('  (none)');
for (const r of warn) console.log('  ! ' + r.name + '  → ' + r.detail);
console.log(`\n  SUMMARY: ${pass.length} pass, ${fail.length} fail, ${warn.length} warn\n`);
process.exit(fail.length ? 1 : 0);
