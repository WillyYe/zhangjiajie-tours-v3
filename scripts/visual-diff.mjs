// willyye.github.io/zhangjiajie-tours-v3 — WebP vs JPG visual-regression diff
// Renders the page twice (once with WebP images, once forced to JPG) and saves
// two full-page screenshots. A separate Python step compares them pixel-by-pixel
// to prove the optimization is visually lossless.
//   node scripts/visual-diff.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const CHROME = process.env.CHROME_PATH;
const launchOpts = { args: ['--no-sandbox', '--disable-setuid-sandbox'] };
if (CHROME) launchOpts.executablePath = CHROME;
const ROOT = process.cwd();
const URL = 'file://' + path.join(ROOT, 'index.html');
const OUT = '/tmp/zjv3-vdiff';
fs.mkdirSync(OUT, { recursive: true });

async function shot(forceJpg, file) {
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  if (forceJpg) {
    // Rewrite every WebP request to its JPG sibling (strip -800 width variant).
    await page.route('**/images/*.webp', (route) => {
      const u = route.request().url();
      const m = u.match(/\/images\/([\w-]+?)(?:-800)?\.webp/);
      const jpg = m ? path.join(ROOT, 'images', m[1] + '.jpg') : null;
      if (jpg && fs.existsSync(jpg)) return route.fulfill({ path: jpg });
      return route.continue();
    });
  }
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.addStyleTag({ content: '.fade-in{opacity:1 !important;transform:none !important;}' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: file, fullPage: true });
  await browser.close();
  console.log('saved', file);
}

await shot(false, path.join(OUT, 'webp.png'));
await shot(true, path.join(OUT, 'jpg.png'));
console.log('done — compare with: python3 scripts/diff-screenshots.py');
