// willyye.github.io/zhangjiajie-tours-v3 — Post-optimization verification
// Asserts: zero third-party RUNTIME requests, Lucide renders from local file,
// skip-to-content link + <main> landmark present, JSON-LD parses.
import { chromium } from 'playwright';
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const http = require('http');
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
const ASSET_SERVER = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.statusCode = 404; return res.end('not found');
  }
  res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});
await new Promise(r => ASSET_SERVER.listen(0, '127.0.0.1', r));
const PORT = ASSET_SERVER.address().port;
const BASE = `http://127.0.0.1:${PORT}/index.html`;

const browser = await chromium.launch();
const page = await browser.newPage();
const thirdParty = [];
page.on('request', req => {
  const u = req.url();
  if (u.startsWith('http') && !u.includes(`127.0.0.1:${PORT}`)) thirdParty.push(u);
});
await page.goto(BASE, { waitUntil: 'networkidle' });

const lucideGlobal = await page.evaluate(() => typeof window.lucide);
const lucideIcons = await page.$$eval('svg.lucide', els => els.length);
const hasSkipLink = await page.$('a.skip-link[href="#main"]') !== null;
const hasMain = await page.$('main#main') !== null;
const jsonLd = await page.$$eval('script[type="application/ld+json"]', els =>
  els.map(e => { try { return JSON.parse(e.textContent); } catch { return null; } }).filter(Boolean)
);

// emulate reduced motion to confirm fade-in content is still visible
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.reload({ waitUntil: 'networkidle' });
const fadeVisibleUnderReduce = await page.$eval('#home .fade-in', el => getComputedStyle(el).opacity);

console.log('--- Post-optimization verification ---');
console.log('Third-party runtime requests :', thirdParty.length ? thirdParty : 'NONE ✓');
console.log('window.lucide defined        :', lucideGlobal);
console.log('Rendered lucide <svg> icons  :', lucideIcons);
console.log('Skip-to-content link present :', hasSkipLink);
console.log('<main> landmark present      :', hasMain);
console.log('JSON-LD blocks parsed        :', jsonLd.length, jsonLd.map(j => j['@type']).join(','));
console.log('fade-in opacity @reduce      :', fadeVisibleUnderReduce, '(should be 1)');

const pass =
  thirdParty.length === 0 &&
  lucideGlobal === 'object' &&
  lucideIcons > 0 &&
  hasSkipLink && hasMain &&
  jsonLd.length > 0 && jsonLd[0]['@type'] === 'TravelAgency' &&
  fadeVisibleUnderReduce === '1';

console.log('\nRESULT:', pass ? 'PASS ✓' : 'FAIL ✗');
await browser.close();
ASSET_SERVER.close();
process.exit(pass ? 0 : 1);
