// Browser acceptance checks: B3 (subpath load), R1 (boots cleanly), R2 (not frozen), T1 (responsive).
// Runs inside the toolchain container with no network. Usage:
//   node browser.spec.js <dist-dir> <evidence-dir>
// Not yet implemented here: R3 colors, I1 keys, I2 no scroll, G1 gameplay, A1 audio.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [root, evid] = [process.argv[2], process.argv[3]];
const PREFIX = '/doom/'; // serve ONLY under a subpath so absolute asset paths fail (B3)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm',
  '.data': 'application/octet-stream', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

const results = [];
const rec = (id, pass, detail) => results.push({ id, status: pass ? 'pass' : 'fail', detail });
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!p.startsWith(PREFIX)) { res.writeHead(404); return res.end('not found'); }
  const rel = p.slice(PREFIX.length) || 'index.html';
  const file = path.resolve(root, rel);
  if (!file.startsWith(path.resolve(root)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}${PREFIX}index.html`;
  let browser;
  try {
    browser = await chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });

    const errors = [];
    const wasm = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !String(m.location().url || '').includes('favicon')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('response', (r) => { if (r.url().endsWith('.wasm')) wasm.push({ status: r.status(), type: r.headers()['content-type'] }); });

    const resp = await page.goto(url, { waitUntil: 'load', timeout: 30000 }).catch((e) => ({ err: String(e) }));

    // B3: page and wasm load under /doom/ with the right MIME type
    const loaded = resp && !resp.err && resp.status() === 200;
    const wasmOk = wasm.some((w) => w.status === 200 && w.type === 'application/wasm');
    rec('B3', loaded && wasmOk, loaded ? (wasmOk ? 'loaded from /doom/ with application/wasm' : 'page loaded but no wasm 200 with application/wasm') : `page did not load: ${resp && resp.err}`);

    // R1: canvas present and nonblank within 15 s, no console/page errors during boot
    let canvas = null;
    try { canvas = await page.waitForSelector('canvas', { timeout: 15000 }); } catch (e) {}
    let nonblank = false, shot0 = null;
    if (canvas) {
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        shot0 = await canvas.screenshot();
        if (shot0.length > 5000) { nonblank = true; break; } // crude: blank canvases compress to tiny PNGs
        await sleep(500);
      }
      if (shot0) fs.writeFileSync(path.join(evid, 'R1_canvas.png'), shot0);
    }
    rec('R1', !!canvas && nonblank && errors.length === 0,
      !canvas ? 'no canvas within 15 s' : !nonblank ? 'canvas stayed blank' : errors.length ? `console/page errors: ${errors.slice(0, 3).join(' | ')}` : 'canvas drawn, no errors');

    // R2: canvas pixels change over ~3 s
    if (canvas) {
      const hashes = [];
      for (let i = 0; i < 4; i++) { const s = await canvas.screenshot(); hashes.push(sha(s)); if (i === 3) fs.writeFileSync(path.join(evid, 'R2_canvas_last.png'), s); await sleep(1000); }
      const distinct = new Set(hashes).size;
      rec('R2', distinct > 1, `${distinct} distinct frames in 4 samples over ~3 s`);
    } else {
      rec('R2', false, 'no canvas');
    }

    // T1: requestAnimationFrame averages >= 30 fps over 10 s, no gap over 250 ms
    const t1 = await page.evaluate(() => new Promise((resolve) => {
      let frames = 0, last = performance.now(), maxGap = 0; const start = last;
      function tick(now) {
        frames++; maxGap = Math.max(maxGap, now - last); last = now;
        if (now - start < 10000) requestAnimationFrame(tick);
        else resolve({ fps: frames / ((now - start) / 1000), maxGap });
      }
      requestAnimationFrame(tick);
    }));
    rec('T1', t1.fps >= 30 && t1.maxGap <= 250, `avg ${t1.fps.toFixed(1)} fps, max gap ${t1.maxGap.toFixed(0)} ms`);
  } catch (e) {
    for (const id of ['B3', 'R1', 'R2', 'T1']) if (!results.find((r) => r.id === id)) rec(id, false, `harness error: ${e}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.close();
    fs.writeFileSync(path.join(evid, 'browser_results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  }
})();
