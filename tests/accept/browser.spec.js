// Browser acceptance checks:
//   B3 subpath load, R1 boots, R2 not frozen, R3 title-screen colors vs the WAD, T1 responsive,
//   I1 key hold/release, I2 no page scroll, A1 sound effects, G1 gameplay,
//   M1 music, S1 saves persist across a page reload.
// Runs inside the toolchain container with no network. Usage:
//   node browser.spec.js <dist-dir> <evidence-dir> [wad-path]
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [root, evid] = [process.argv[2], process.argv[3]];
const WAD_PATH = process.argv[4] || '/assets/doom1.wad';
const PREFIX = '/doom/'; // serve ONLY under a subpath so absolute asset paths fail (B3)
const IDS = ['B3', 'R1', 'R2', 'R3', 'T1', 'I1', 'I2', 'A1', 'G1', 'M1', 'S1'];
const R3_MAX_ERR = 30; // mean abs error per channel (0-255) between canvas and TITLEPIC
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm',
  '.data': 'application/octet-stream', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

const results = [];
const rec = (id, pass, detail) => results.push({ id, status: pass ? 'pass' : 'fail', detail });
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const distinct = (arr) => new Set(arr).size;
const b64 = (buf) => buf.toString('base64');
const writeResults = () => fs.writeFileSync(path.join(evid, 'browser_results.json'), JSON.stringify(results, null, 2));
const save = (name, buf) => fs.writeFileSync(path.join(evid, name), buf);

// Watchdog: never hang the gate. Anything not recorded by then fails.
const watchdog = setTimeout(() => {
  for (const id of IDS) if (!results.find((r) => r.id === id)) rec(id, false, 'timed out');
  writeResults();
  console.log(JSON.stringify(results));
  process.exit(0);
}, 420000);

// Run a check; if it throws and recorded nothing, record a failure naming the error.
async function guard(id, fn) {
  try { await fn(); } catch (e) { if (!results.find((r) => r.id === id)) rec(id, false, `harness error: ${e.message}`); }
}

// ---- WAD reading (R3 reference image comes from the supplied WAD, not from the port) ----
function loadWad(file) {
  const buf = fs.readFileSync(file);
  const num = buf.readInt32LE(4), dir = buf.readInt32LE(8), lumps = {};
  for (let i = 0; i < num; i++) {
    const o = dir + 16 * i;
    const pos = buf.readInt32LE(o), size = buf.readInt32LE(o + 4);
    const name = buf.toString('latin1', o + 8, o + 16).replace(/\0.*$/, '');
    if (!(name in lumps)) lumps[name] = buf.subarray(pos, pos + size);
  }
  return lumps;
}
function decodeTitle(lumps) {
  const pal = lumps.PLAYPAL, p = lumps.TITLEPIC;
  if (!pal || !p) throw new Error('PLAYPAL or TITLEPIC missing from the WAD');
  const w = p.readInt16LE(0), h = p.readInt16LE(2);
  if (w !== 320 || h !== 200) throw new Error(`TITLEPIC is ${w}x${h}, expected 320x200`);
  const rgba = Buffer.alloc(w * h * 4, 0);
  for (let x = 0; x < w; x++) {
    let o = p.readInt32LE(8 + 4 * x);
    while (p[o] !== 255) {
      const top = p[o], len = p[o + 1];
      for (let j = 0; j < len; j++) {
        const idx = p[o + 3 + j], y = top + j;
        if (y < h) {
          const d = (y * w + x) * 4;
          rgba[d] = pal[idx * 3]; rgba[d + 1] = pal[idx * 3 + 1]; rgba[d + 2] = pal[idx * 3 + 2]; rgba[d + 3] = 255;
        }
      }
      o += len + 4;
    }
  }
  return rgba;
}

// ---- Functions that run inside the page ----
const REF_SETUP = (refB64) => {
  const bin = atob(refB64); const a = new Uint8ClampedArray(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  window.__ref = a;
};
const REF_PNG = async () => {
  const oc = new OffscreenCanvas(320, 200); const ctx = oc.getContext('2d');
  ctx.putImageData(new ImageData(window.__ref, 320, 200), 0, 0);
  const blob = await oc.convertToBlob({ type: 'image/png' });
  const u = new Uint8Array(await blob.arrayBuffer()); let s = '';
  for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
  return btoa(s);
};
const FRAME_COMPARE = async (pngB64) => {
  const bin = atob(pngB64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const bmp = await createImageBitmap(new Blob([u], { type: 'image/png' }));
  const oc = new OffscreenCanvas(320, 200); const ctx = oc.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, 320, 200);
  const d = ctx.getImageData(0, 0, 320, 200).data; const ref = window.__ref;
  let e1 = 0, e2 = 0;
  for (let i = 0; i < d.length; i += 4) {
    e1 += Math.abs(d[i] - ref[i]) + Math.abs(d[i + 1] - ref[i + 1]) + Math.abs(d[i + 2] - ref[i + 2]);
    e2 += Math.abs(d[i + 2] - ref[i]) + Math.abs(d[i + 1] - ref[i + 1]) + Math.abs(d[i] - ref[i + 2]); // captured with red/blue swapped
  }
  const n = 320 * 200 * 3;
  return { err: e1 / n, errSwapped: e2 / n };
};
const PNG_DIFF = async ([a, b]) => {
  const load = async (s) => {
    const bin = atob(s); const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([u], { type: 'image/png' }));
    const oc = new OffscreenCanvas(160, 100); const x = oc.getContext('2d');
    x.drawImage(bmp, 0, 0, 160, 100);
    return x.getImageData(0, 0, 160, 100).data;
  };
  const A = await load(a), B = await load(b); let e = 0;
  for (let i = 0; i < A.length; i += 4) e += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
  return e / (160 * 100 * 3);
};
// Max RMS seen on audio tapped before the destination, over `ms` milliseconds.
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
// RMS every 50 ms over `ms` milliseconds (music is continuous, effects are short).
const MUSIC_SAMPLER = (ms) => new Promise((resolve) => {
  const a = window.__audio || { ctxs: [] };
  const out = { ctxs: a.ctxs.length, states: a.ctxs.map((c) => c.state), rms: [] };
  const buf = new Float32Array(2048);
  const t0 = performance.now();
  const timer = setInterval(() => {
    let m = 0;
    for (const c of a.ctxs) {
      const an = c.__tap; if (!an) continue;
      an.getFloatTimeDomainData(buf);
      let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      m = Math.max(m, Math.sqrt(s / buf.length));
    }
    out.rms.push(m);
    if (performance.now() - t0 >= ms) { clearInterval(timer); resolve(out); }
  }, 50);
});

// ---- Page helpers ----
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
async function waitCanvas(page) {
  try { return await page.waitForSelector('canvas', { timeout: 15000 }); } catch (e) { return null; }
}
// Walk the Doom menu to E1M1: any key opens the menu, then New Game, Episode 1, default skill.
async function startLevel(page) {
  const c = await page.$('canvas');
  if (c) await c.click({ position: { x: 40, y: 40 } }).catch(() => {}); // focus the game
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); await sleep(900); }
  await sleep(4000); // level load and screen wipe
}
const key = async (page, k, wait = 300) => { await page.keyboard.press(k); await sleep(wait); };

// Screenshot of a fraction of the canvas (fractions of its on-screen box).
async function clipShot(page, canvas, fx, fy, fw, fh) {
  const b = await canvas.boundingBox();
  return page.screenshot({ clip: { x: b.x + b.width * fx, y: b.y + b.height * fy, width: b.width * fw, height: b.height * fh } });
}
const viewShot = (page, canvas) => clipShot(page, canvas, 0, 0, 1, 0.8);            // 3D view (top 80%)
const ammoShot = (page, canvas) => clipShot(page, canvas, 0, 170 / 200, 46 / 320, 18 / 200); // status-bar ammo number
async function viewHashes(page, canvas, n, gapMs) {
  const hs = [];
  for (let i = 0; i < n; i++) { hs.push(sha(await viewShot(page, canvas))); await sleep(gapMs); }
  return hs;
}

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

    // Audio setup: before any page script runs, tap everything connected to an audio destination.
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

    const startNote = await startGame(page);
    save('start_gesture.txt', startNote + '\n');

    // Frames captured during R1 and R2 are kept: R3 looks for the title screen among them.
    const candidates = [];

    // R1: canvas present and nonblank within 15 s of the start gesture, no console/page errors
    const canvas = await waitCanvas(page);
    let nonblank = false, shot0 = null;
    if (canvas) {
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        shot0 = await canvas.screenshot();
        candidates.push(shot0);
        if (shot0.length > 5000) { nonblank = true; break; } // crude: blank canvases compress to tiny PNGs
        await sleep(500);
      }
      if (shot0) save('R1_canvas.png', shot0);
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
      for (let i = 0; i < 12; i++) {
        const s = await canvas.screenshot(); candidates.push(s); hashes.push(sha(s));
        if (i === 11) save('R2_canvas_last.png', s);
        await sleep(1000);
      }
      const d = distinct(hashes);
      rec('R2', d > 1, `${d} distinct frames in 12 samples over ~12 s`);
    } else {
      rec('R2', false, 'no canvas');
    }

    // R3: the title screen on the canvas matches TITLEPIC decoded from the supplied WAD.
    await guard('R3', async () => {
      if (!candidates.length) { rec('R3', false, 'no canvas frames captured'); return; }
      const ref = decodeTitle(loadWad(WAD_PATH));
      await page.evaluate(REF_SETUP, b64(ref));
      save('R3_reference.png', Buffer.from(await page.evaluate(REF_PNG), 'base64'));
      let best = null, bestPng = null;
      for (const png of candidates) {
        const r = await page.evaluate(FRAME_COMPARE, b64(png));
        if (!best || r.err < best.err) { best = r; bestPng = png; }
      }
      save('R3_best_frame.png', bestPng);
      rec('R3', best.err < R3_MAX_ERR && best.err < best.errSwapped,
        `best of ${candidates.length} frames: error ${best.err.toFixed(1)}/255 (needs < ${R3_MAX_ERR}), error if red/blue were swapped ${best.errSwapped.toFixed(1)} (must be higher)`);
    });

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
      for (const id of ['I1', 'I2', 'A1', 'G1', 'M1', 'S1']) rec(id, false, 'no canvas');
    } else {
      await startLevel(page);
      const levelStart = Date.now();
      const errStart = errors.length;

      // I1: holding Left turns the view; releasing stops it. Turning can't be blocked by a wall.
      const idle = distinct(await viewHashes(page, canvas, 5, 200)); // baseline noise
      await page.keyboard.down('ArrowLeft');
      await sleep(300);
      const moving = distinct(await viewHashes(page, canvas, 8, 150));
      save('I1_during_turn.png', await page.screenshot());
      await page.keyboard.up('ArrowLeft');
      await sleep(800);
      const after = distinct(await viewHashes(page, canvas, 5, 200));
      save('I1_after_release.png', await page.screenshot());
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

      // I2: arrows and Space must not scroll the page (PageDown is informational).
      await page.evaluate(() => { document.documentElement.style.minHeight = '4000px'; document.body.style.minHeight = '4000px'; window.scrollTo(0, 0); });
      const scrollable = await page.evaluate(() => { window.scrollTo(0, 50); const y = window.scrollY; window.scrollTo(0, 0); return y > 0; });
      await canvas.click({ position: { x: 40, y: 40 } }).catch(() => {});
      const scrolled = [];
      for (const k of ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Space']) {
        await page.keyboard.press(k); await sleep(150);
        const yk = await page.evaluate(() => window.scrollY);
        if (yk !== 0) { scrolled.push(`${k}=>${yk}`); await page.evaluate(() => window.scrollTo(0, 0)); }
      }
      await page.keyboard.press('PageDown'); await sleep(150);
      const yPg = await page.evaluate(() => window.scrollY);
      await page.evaluate(() => window.scrollTo(0, 0));
      rec('I2', scrolled.length === 0, scrollable
        ? (scrolled.length ? `page scrolled on: ${scrolled.join(', ')}` : `no scroll on arrows/Space; PageDown (informational) scrollY ${yPg}`)
        : 'page not scrollable even programmatically, so nothing to prevent');

      // A1: sound effects are output. Compare audio level in a trigger window to a baseline just before it.
      const sample = (ms) => page.evaluate(SAMPLER, ms);
      const rises = (t, b) => t.peak >= 0.003 && (b.peak < 0.0005 || t.peak >= 1.5 * b.peak || t.peak - b.peak >= 0.01);
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
      save('A1_audio_levels.json', JSON.stringify({ baseFire, fire, baseMenu, menu }, null, 2));
      const f = (n) => n.toFixed(4);
      rec('A1', fire.ctxs > 0 && running && fireUp && menuUp,
        fire.ctxs === 0 ? 'no AudioContext connected to a destination'
          : `contexts ${fire.ctxs}, running ${running}; fire: base ${f(baseFire.peak)} -> ${f(fire.peak)} (${fireUp ? 'rise' : 'no rise'}); menu: base ${f(baseMenu.peak)} -> ${f(menu.peak)} (${menuUp ? 'rise' : 'no rise'})`);

      // G1: in a started level the player can move and fire (ammo number changes), and
      // 60 s of play pass with no new errors. Door opening is attempted but not gating.
      await guard('G1', async () => {
        const ammoA = sha(await ammoShot(page, canvas)); await sleep(500);
        const ammoB = sha(await ammoShot(page, canvas));
        const ammoStable = ammoA === ammoB;

        const idleG = distinct(await viewHashes(page, canvas, 4, 150));
        await page.keyboard.down('ArrowUp'); await sleep(300);
        const mvFwd = distinct(await viewHashes(page, canvas, 6, 150));
        await page.keyboard.up('ArrowUp'); await sleep(300);
        await page.keyboard.down('ArrowDown'); await sleep(300);
        const mvBack = distinct(await viewHashes(page, canvas, 6, 150));
        await page.keyboard.up('ArrowDown'); await sleep(500);
        const moved = Math.max(mvFwd, mvBack) >= Math.max(3, idleG + 1);

        const ammoBeforeShot = await ammoShot(page, canvas);
        save('G1_ammo_before.png', ammoBeforeShot);
        for (let i = 0; i < 3; i++) { await page.keyboard.down('Control'); await sleep(120); await page.keyboard.up('Control'); await sleep(500); }
        await sleep(500);
        const ammoAfterShot = await ammoShot(page, canvas);
        save('G1_ammo_after.png', ammoAfterShot);
        const fired = sha(ammoBeforeShot) !== sha(ammoAfterShot);

        // Door attempt: walk forward pressing Space. Evidence only.
        save('G1_door_before.png', await viewShot(page, canvas));
        await page.keyboard.down('ArrowUp');
        for (let i = 0; i < 8; i++) { await page.keyboard.press('Space'); await sleep(250); }
        await page.keyboard.up('ArrowUp');
        await sleep(500);
        save('G1_door_after.png', await viewShot(page, canvas));

        const elapsed = (Date.now() - levelStart) / 1000;
        if (elapsed < 60) await sleep((60 - elapsed) * 1000 + 500);
        const newErrors = errors.slice(errStart);
        const total = (Date.now() - levelStart) / 1000;
        rec('G1', ammoStable && moved && fired && newErrors.length === 0 && total >= 60,
          `ammo region stable while idle: ${ammoStable}; view changed while moving: ${moved} (idle ${idleG}, forward ${mvFwd}, back ${mvBack}); ammo number changed after 3 shots: ${fired}; ${total.toFixed(0)} s of play, ${newErrors.length} new errors${newErrors.length ? ': ' + newErrors.slice(0, 2).join(' | ') : ''}; door attempt screenshots saved (informational)`);
      });

      // M1: music. Idle in the level, audio should be continuously audible with no input.
      await guard('M1', async () => {
        await sleep(1200);
        const m = await page.evaluate(MUSIC_SAMPLER, 4000);
        const audible = m.rms.filter((v) => v > 0.0008).length / Math.max(1, m.rms.length);
        const peak = Math.max(0, ...m.rms);
        const running2 = m.states.includes('running');
        save('M1_levels.json', JSON.stringify(m, null, 2));
        rec('M1', m.ctxs > 0 && running2 && audible >= 0.5 && peak >= 0.002,
          m.ctxs === 0 ? 'no AudioContext connected to a destination'
            : `contexts ${m.ctxs}, running ${running2}; ${(audible * 100).toFixed(0)}% of samples audible (needs >= 50%), peak ${peak.toFixed(4)} (needs >= 0.002) while idle`);
      });

      // S1: a save made in the menu survives a page reload and loads back to the same view.
      await guard('S1', async () => {
        const p2 = await browser.newPage({ viewport: { width: 1000, height: 700 } });
        try {
          await p2.goto(url, { waitUntil: 'load', timeout: 30000 });
          await startGame(p2);
          let c2 = await waitCanvas(p2);
          if (!c2) { rec('S1', false, 'no canvas on a fresh page'); return; }
          await startLevel(p2);
          const fresh = await viewShot(p2, c2);
          await p2.keyboard.down('ArrowLeft'); await sleep(500); await p2.keyboard.up('ArrowLeft'); await sleep(700);
          const saved = await viewShot(p2, c2);
          // Save Game: Escape menu, Down x3, Enter, Enter (slot 1), type a name, Enter.
          await key(p2, 'Escape', 600);
          for (let i = 0; i < 3; i++) await key(p2, 'ArrowDown');
          await key(p2, 'Enter', 600);
          await key(p2, 'Enter', 500);
          await key(p2, 'a', 300);
          await key(p2, 'Enter', 1500);
          await sleep(3500); // let the port flush to browser storage
          await p2.reload({ waitUntil: 'load', timeout: 30000 });
          await startGame(p2);
          c2 = await waitCanvas(p2);
          if (!c2) { rec('S1', false, 'no canvas after reload'); return; }
          await sleep(4000);
          await key(p2, 'Enter', 700);                                   // first key opens the menu
          await key(p2, 'ArrowDown'); await key(p2, 'ArrowDown');
          await key(p2, 'Enter', 700);                                   // Load Game
          await key(p2, 'Enter', 3500);                                  // slot 1: loads the game
          const loadedShot = await viewShot(p2, c2);
          save('S1_fresh.png', fresh); save('S1_saved.png', saved); save('S1_after_reload_load.png', loadedShot);
          const turnDiff = await p2.evaluate(PNG_DIFF, [b64(fresh), b64(saved)]);
          const dSaved = await p2.evaluate(PNG_DIFF, [b64(saved), b64(loadedShot)]);
          const dFresh = await p2.evaluate(PNG_DIFF, [b64(fresh), b64(loadedShot)]);
          rec('S1', turnDiff > 8 && dSaved < 8 && dSaved < dFresh,
            `view difference fresh vs saved ${turnDiff.toFixed(1)} (needs > 8); saved vs loaded-after-reload ${dSaved.toFixed(1)} (needs < 8 and below fresh vs loaded ${dFresh.toFixed(1)})`);
        } finally { await p2.close().catch(() => {}); }
      });
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
