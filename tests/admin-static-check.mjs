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
  // 2026-08-21: <base> injection for relative resource resolution under admin/
  ['_fillDetailTpl injects <base href="../">', /replace\(['"]<meta charset="UTF-8">['"], ['"]<meta charset="UTF-8">\\n  <base href="\.\.\/">['"]\)/],
];
let pass = 0, fail = 0;
for (const [name, re] of checks) {
  if (re.test(src)) { console.log('  ✓', name); pass++; }
  else { console.log('  ✗', name); fail++; }
}
console.log(`\n  admin-${pass}-${fail}`);
process.exit(fail ? 1 : 0);
