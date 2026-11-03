// Development-only startup diagnostic. No gameplay acceptance claims.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/dev/startup_test.cjs <evidence-prefix>
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const prefix = process.argv[2];
if (!prefix || !prefix.startsWith('artifacts/')) throw Error('Supply artifacts/ evidence prefix');
const result = { browser: null, events: [], errors: [], requests: [] };
const root = path.resolve('dist');
const server = http.createServer((req, res) => {
  const name = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  const file = req.url === '/' ? path.join(root, 'index.html') : name;
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', {'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm'}[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});
let browser;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  result.browser = browser.version();
  const page = await browser.newPage();
  page.on('console', msg => result.events.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', error => result.errors.push(String(error)));
  page.on('response', response => result.requests.push({path: new URL(response.url()).pathname, status: response.status()}));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => !document.querySelector('#start').disabled);
  await page.evaluate(() => {
    window.startupProbe = { clicks: 0, calls: 0, returns: 0 };
    document.querySelector('#start').addEventListener('click', () => startupProbe.clicks++, true);
    const original = Module.callMain;
    Module.callMain = function (...args) {
      startupProbe.calls++;
      const ret = original.apply(this, args);
      startupProbe.returns++;
      startupProbe.returnType = typeof ret;
      return ret;
    };
  });
  const state = () => page.evaluate(() => ({
    status: document.querySelector('#status').textContent,
    state: document.querySelector('#status').dataset.state || null,
    disabled: document.querySelector('#start').disabled,
    title: document.title, probe: {...startupProbe},
    canvas: document.querySelector('canvas').toDataURL(),
    wadBytes: Module.FS.stat('/doom1.wad').size,
    noInitialRun: Module.noInitialRun
  }));
  result.ready = await state();
  await page.waitForTimeout(3000);
  result.idle = await state();
  result.noAutostart = result.idle.probe.calls === 0 && result.idle.canvas === result.ready.canvas && !result.idle.disabled;
  await page.screenshot({path: prefix + '-ready.png'});
  const t = Date.now();
  try { await page.locator('#start').click({timeout: 5000}); result.click = 'resolved'; }
  catch (error) { result.click = String(error); }
  result.clickMs = Date.now() - t;
  await page.waitForTimeout(1500);
  result.started = await state();
  await page.waitForTimeout(1000);
  result.later = await state();
  // The initial title is legitimately static; do not demand animation here.
  result.canvasPresented = result.started.canvas !== result.ready.canvas;
  result.frameChanged = result.started.canvas !== result.later.canvas;
  result.singleStart = result.later.probe.clicks === 1 && result.later.probe.calls === 1;
  await page.screenshot({path: prefix + '-started.png'});
  for (const key of ['ready','idle','started','later']) delete result[key].canvas;
  result.status = result.noAutostart && result.singleStart && result.canvasPresented && !result.errors.length ? 'pass' : 'fail';
})().catch(error => { result.status = 'fail'; result.error = String(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  fs.writeFileSync(prefix + '.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
});
