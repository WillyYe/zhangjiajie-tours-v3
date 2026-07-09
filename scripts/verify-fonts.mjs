// Verify self-hosted fonts actually load (HTTP 200) and are applied.
// Catches silent fallback: if @font-face path is wrong, the page renders with
// system fonts and produces NO console error — so we must check network + document.fonts.
import http from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize } from 'path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const MIME = { '.html':'text/html','.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.json':'application/json' };

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const fp = normalize(join(ROOT, p));
    if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const data = await readFile(fp);
    res.writeHead(200, { 'Content-Type': MIME[extname(fp)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();
const fontResponses = [];
const failed = [];
page.on('response', r => {
  const u = r.url();
  if (/\.woff2|fonts\.css$/.test(u)) fontResponses.push(`${r.status()} ${u.split('/').pop()}`);
  if (r.status() >= 400) failed.push(`${r.status()} ${u}`);
});
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const entries = await page.evaluate(() => [...document.fonts].map(f => `${f.family} w${f.weight} ${f.style} -> ${f.status}`));

console.log('Font CSS / woff2 responses:');
fontResponses.forEach(s => console.log('  ' + s));
console.log('\ndocument.fonts entries:');
entries.forEach(s => console.log('  ' + s));
const ok = failed.length === 0 && entries.length > 0 && entries.every(e => e.includes('loaded'));
console.log('\nFAILED responses (>=400):', failed.length ? failed : 'none');
console.log('RESULT:', ok ? 'PASS — self-hosted fonts load & apply' : 'FAIL — check above');

await browser.close();
server.close();
process.exit(ok ? 0 : 1);
