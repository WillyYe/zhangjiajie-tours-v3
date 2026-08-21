// Static regression tests for admin/modules/hotels.js — catches fetch-path and
// other silent template-loading bugs that the Playwright E2E cannot detect
// (because E2E tests the *built* detail pages, not the srcdoc preview template).
import { readFileSync } from 'node:fs';

const src = readFileSync('admin/modules/hotels.js', 'utf8');
const checks = [
  // 2026-08-21 regression: fetch('../templates/...') from admin/modules/ → admin/templates/
  // returns GitHub Pages 404 page content; the bug was that fetch() didn't check r.ok
  // and used the 404 body as the template, so the preview pane rendered GitHub's 404.
  ['fetch uses ../../templates/ (not ../)', /fetch\(new URL\(['"]\.\.\/\.\.\/templates\/hotel-detail\.html['"]/],
  ['fetch checks r.ok before reading body', /fetch\([\s\S]{0,200}\.ok[\s\S]{0,200}throw new Error/],
  // 2026-08-21 (rollback): <base href="../"> injection is WRONG.
  // iframe srcdoc inherits parent URL = /admin/, so the template's ../styles/tailwind.css
  // already resolves to root /styles/tailwind.css correctly. Adding <base href="../">
  // shifts base from /admin/ up to /zhangjiajie-tours-v3/, and then ../styles/ resolves
  // to /styles/ (drops the repo segment), causing CSS/fonts/images to 404 → unstyled preview.
  ['NO <base href="../"> injection (would break CSS)', (s) => !/<base href=["']\.\.\/["']/.test(s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''))],
];
let pass = 0, fail = 0;
for (const [name, check] of checks) {
  const ok = typeof check === 'function' ? check(src) : check.test(src);
  if (ok) { console.log('  ✓', name); pass++; }
  else { console.log('  ✗', name); fail++; }
}
console.log(`\n  admin-${pass}-${fail}`);
process.exit(fail ? 1 : 0);
