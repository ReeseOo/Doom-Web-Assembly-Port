// Browser acceptance checks: B3 (subpath load), R1 (boots), R2 (not frozen), T1 (responsive),
// I1 (key hold/release), I2 (no page scroll), A1 (sound effects output).
// Runs inside the toolchain container with no network. Usage:
//   node browser.spec.js <dist-dir> <evidence-dir>
// Not yet implemented here: R3 colors, G1 gameplay.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [root, evid] = [process.argv[2], process.argv[3]];
const PREFIX = '/doom/'; // serve ONLY under a subpath so absolute asset paths fail (B3)
const IDS = ['B3', 'R1', 'R2', 'T1', 'I1', 'I2', 'A1'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm',
  '.data': 'application/octet-stream', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

const results = [];
const rec = (id, pass, detail) => results.push({ id, status: pass ? 'pass' : 'fail', detail });
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const distinct = (arr) => new Set(arr).size;
const writeResults = () => fs.writeFileSync(path.join(evid, 'browser_results.json'), JSON.stringify(results, null, 2));

// Watchdog: never hang the gate. Anything not recorded by then fails.
const watchdog = setTimeout(() => {
  for (const id of IDS) if (!results.find((r) => r.id === id)) rec(id, false, 'timed out');
  writeResults();
  console.log(JSON.stringify(results));
  process.exit(0);
}, 240000);

// The port may gate the game behind a Start control (browsers also require a user gesture
// before audio can play). Find a visible Start/Play control and click it; fall back to the canvas.
async function startGame(page) {
  const sel = 'button, [role=button], a, input[type=button], input[type=submit], [id*=start i], [class*=start i], [id*=play i], [class*=play i]';
  const wanted = /start|play|begin|launch|click/i;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    for (const el of await page.$$(sel)) {
      if (!(await el.isVisible().catch(() => false))) continue;
      const text = (await el.innerText().catch(() => '')) || '';
      const value = (await el.getAttribute('value').catch(() => '')) || '';
      const idc = ((await el.getAttribute('id').catch(() => '')) || '') + ' ' + ((await el.getAttribute('class').catch(() => '')) || '');
      if (wanted.test(text) || wanted.test(value) || wanted.test(idc)) {
        await el.click().catch(() => {});
        return `clicked control "${(text || value || idc).trim().slice(0, 40)}"`;
      }
    }
    await sleep(500);
  }
  const c = await page.$('canvas');
  if (c && (await c.isVisible().catch(() => false))) { await c.click().catch(() => {}); return 'no start control found; clicked canvas'; }
  return 'no start control or visible canvas found';
}

// Walk the Doom menu to E1M1: any key opens the menu, then New Game, Episode 1, default skill.
async function startLevel(page) {
  const c = await page.$('canvas');
  if (c) await c.click({ position: { x: 40, y: 40 } }).catch(() => {}); // focus the game
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); await sleep(900); }
  await sleep(4000); // level load and screen wipe
}

// Hashes of the 3D view area (top 80% of the canvas) as PNG screenshots.
async function viewHashes(page, canvas, n, gapMs) {
  const box = await canvas.boundingBox();
  const clip = { x: box.x, y: box.y, width: box.width, height: Math.floor(box.height * 0.8) };
  const hs = [];
  for (let i = 0; i < n; i++) { hs.push(sha(await page.screenshot({ clip }))); await sleep(gapMs); }
  return hs;
}

// Runs in the page: max RMS seen on audio tapped before the destination, over `ms` milliseconds.
const SAMPLER = (ms) => new Promise((resolve) => {
  const a = window.__audio || { ctxs: [] };
  const out = { ctxs: a.ctxs.length, states: a.ctxs.map((c) => c.state), peak: 0 };
  const buf = new Float32Array(2048);
  const t0 = performance.now();
  const timer = setInterval(() => {
    for (const c of a.ctxs) {
      const an = c.__tap; if (!an) continue;
      an.getFloatTimeDomainData(buf);
      let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      const rms = Math.sqrt(s / buf.length); if (rms > out.peak) out.peak = rms;
    }
    if (performance.now() - t0 >= ms) { clearInterval(timer); resolve(out); }
  }, 30);
});

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

    // A1 setup: before any page script runs, tap everything connected to an audio destination.
    await page.addInitScript(() => {
      window.__audio = { ctxs: [] };
      const origConnect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (dest, ...rest) {
        try {
          if (dest instanceof AudioDestinationNode) {
            const ctx = this.context;
            if (!ctx.__tap) { ctx.__tap = ctx.createAnalyser(); ctx.__tap.fftSize = 2048; window.__audio.ctxs.push(ctx); }
            origConnect.call(this, ctx.__tap);
          }
        } catch (e) {}
        return origConnect.call(this, dest, ...rest);
      };
    });

    const errors = [];
    const wasm = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !String(m.location().url || '').includes('favicon')) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('response', (r) => { if (r.url().split('?')[0].endsWith('.wasm')) wasm.push({ url: r.url().replace(/^.*\/doom\//, ''), status: r.status(), type: r.headers()['content-type'] }); });

    const resp = await page.goto(url, { waitUntil: 'load', timeout: 30000 }).catch((e) => ({ err: String(e) }));

    const loaded = resp && !resp.err && resp.status() === 200; // B3 is recorded after the start gesture, below

    // Start gesture (see startGame above), then R1.
    const startNote = await startGame(page);
    fs.writeFileSync(path.join(evid, 'start_gesture.txt'), startNote + '\n');

    // R1: canvas present and nonblank within 15 s of the start gesture, no console/page errors
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
      !canvas ? 'no canvas within 15 s' : !nonblank ? 'canvas stayed blank' : errors.length ? `console/page errors: ${errors.slice(0, 3).join(' | ')}` : `canvas drawn after start (${startNote}), no errors`);

    // B3: page loads under /doom/ and the wasm file is served as application/wasm.
    // Checked after the start gesture, because the port may fetch the wasm only when Start is clicked.
    const wasmOk = wasm.some((w) => w.status === 200 && w.type === 'application/wasm');
    rec('B3', loaded && wasmOk, loaded
      ? (wasmOk ? `loaded from /doom/ with application/wasm (${wasm.map((w) => w.url).join(', ')})` : `page loaded but no wasm 200 with application/wasm; wasm responses seen: ${JSON.stringify(wasm)}`)
      : `page did not load: ${resp && resp.err}`);

    // R2: canvas pixels change over ~12 s (the title screen is static for about 5 s before the demo starts)
    if (canvas) {
      const hashes = [];
      for (let i = 0; i < 12; i++) { const s = await canvas.screenshot(); hashes.push(sha(s)); if (i === 11) fs.writeFileSync(path.join(evid, 'R2_canvas_last.png'), s); await sleep(1000); }
      const d = distinct(hashes);
      rec('R2', d > 1, `${d} distinct frames in 12 samples over ~12 s`);
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

    if (!canvas) {
      for (const id of ['I1', 'I2', 'A1']) rec(id, false, 'no canvas');
    } else {
      await startLevel(page);

      // I1: holding Left turns the view; releasing stops it. Turning can't be blocked by a wall.
      const idle = distinct(await viewHashes(page, canvas, 5, 200)); // baseline noise
      await page.keyboard.down('ArrowLeft');
      await sleep(300);
      const moving = distinct(await viewHashes(page, canvas, 8, 150));
      fs.writeFileSync(path.join(evid, 'I1_during_turn.png'), await page.screenshot());
      await page.keyboard.up('ArrowLeft');
      await sleep(800);
      const after = distinct(await viewHashes(page, canvas, 5, 200));
      fs.writeFileSync(path.join(evid, 'I1_after_release.png'), await page.screenshot());
      // Informational only: does the game release a held key when the window loses focus?
      await page.keyboard.down('ArrowLeft');
      await sleep(500);
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await sleep(600);
      const blurred = distinct(await viewHashes(page, canvas, 4, 200));
      await page.keyboard.up('ArrowLeft');
      await sleep(300);
      const blurOk = blurred <= idle + 1;
      const i1pass = moving >= Math.max(4, idle + 2) && after <= idle + 1;
      rec('I1', i1pass, `distinct view frames: idle ${idle}, while turning ${moving}, after release ${after}; blur-release (informational, not gating): ${blurOk ? 'ok' : 'key stayed held'}`);

      // I2: arrow keys, Space and PageDown must not scroll the page.
      await page.evaluate(() => { document.documentElement.style.minHeight = '4000px'; document.body.style.minHeight = '4000px'; window.scrollTo(0, 0); });
      const scrollable = await page.evaluate(() => { window.scrollTo(0, 50); const y = window.scrollY; window.scrollTo(0, 0); return y > 0; });
      await canvas.click({ position: { x: 40, y: 40 } }).catch(() => {});
      const scrolled = [];
      for (const k of ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Space']) {
        await page.keyboard.press(k); await sleep(150);
        const yk = await page.evaluate(() => window.scrollY);
        if (yk !== 0) { scrolled.push(`${k}=>${yk}`); await page.evaluate(() => window.scrollTo(0, 0)); }
      }
      // Informational, not gating: PageDown is not a game control.
      await page.keyboard.press('PageDown'); await sleep(150);
      const yPg = await page.evaluate(() => window.scrollY);
      await page.evaluate(() => window.scrollTo(0, 0));
      rec('I2', scrolled.length === 0, scrollable
        ? (scrolled.length ? `page scrolled on: ${scrolled.join(', ')}` : `no scroll on arrows/Space; PageDown (informational) scrollY ${yPg}`)
        : 'page not scrollable even programmatically, so nothing to prevent');

      // A1: sound effects are output. Compare audio level in a trigger window to a baseline just before it.
      const sample = (ms) => page.evaluate(SAMPLER, ms);
      const rises = (t, b) => t.peak >= 0.003 && (b.peak < 0.0005 || t.peak >= 1.5 * b.peak);
      await sleep(1000);
      const baseFire = await sample(1500);
      const pf = sample(2500);
      await sleep(300);
      for (let i = 0; i < 3; i++) { await page.keyboard.down('Control'); await sleep(120); await page.keyboard.up('Control'); await sleep(500); }
      const fire = await pf;
      await sleep(1000);
      const baseMenu = await sample(1500);
      const pm = sample(2500);
      await sleep(300);
      await page.keyboard.press('Escape'); await sleep(400);
      await page.keyboard.press('ArrowDown'); await sleep(400);
      await page.keyboard.press('ArrowDown'); await sleep(400);
      await page.keyboard.press('ArrowUp'); await sleep(400);
      await page.keyboard.press('Escape'); await sleep(300);
      const menu = await pm;
      const states = [].concat(baseFire.states, fire.states, menu.states);
      const running = states.includes('running');
      const fireUp = rises(fire, baseFire), menuUp = rises(menu, baseMenu);
      fs.writeFileSync(path.join(evid, 'A1_audio_levels.json'), JSON.stringify({ baseFire, fire, baseMenu, menu }, null, 2));
      const f = (n) => n.toFixed(4);
      rec('A1', fire.ctxs > 0 && running && fireUp && menuUp,
        fire.ctxs === 0 ? 'no AudioContext connected to a destination'
          : `contexts ${fire.ctxs}, running ${running}; fire: base ${f(baseFire.peak)} -> ${f(fire.peak)} (${fireUp ? 'rise' : 'no rise'}); menu: base ${f(baseMenu.peak)} -> ${f(menu.peak)} (${menuUp ? 'rise' : 'no rise'})`);
    }
  } catch (e) {
    for (const id of IDS) if (!results.find((r) => r.id === id)) rec(id, false, `harness error: ${e}`);
  } finally {
    clearTimeout(watchdog);
    if (browser) await browser.close().catch(() => {});
    server.close();
    writeResults();
    console.log(JSON.stringify(results));
    process.exit(0);
  }
})();
