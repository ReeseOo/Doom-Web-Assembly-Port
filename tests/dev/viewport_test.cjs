// Responsive viewport/focus development diagnostic; not the acceptance gate.
// node tests/dev/persistence_test.cjs <dist-dir> <evidence-json>
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(process.argv[2] || 'dist');
const output = process.argv[3];
const result = { errors: [], requests: [], checks: [] };
const server = http.createServer((req, res) => {
  let url = new URL(req.url, 'http://localhost').pathname;
  if (!url.startsWith('/doom/')) return res.writeHead(404).end();
  let file = path.join(root, url.slice(6) || 'index.html');
  if (!file.startsWith(root + '/')) return res.writeHead(403).end();
  fs.readFile(file, (error, data) => {
    if (error) return res.writeHead(404).end();
    res.setHeader('Content-Type', {'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm'}[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});
let browser;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({headless: true, args:['--no-sandbox']});
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.on('pageerror', e => result.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()); });
  page.on('request', r => { if (new URL(r.url()).protocol !== 'blob:') result.requests.push(new URL(r.url()).pathname); });
  await page.goto(`http://127.0.0.1:${server.address().port}/doom/`);
  await page.waitForFunction(() => document.querySelector('#status').dataset.state === 'ready');
  async function geometry(label) {
    const g = await page.evaluate(() => {
      const r = document.querySelector('canvas').getBoundingClientRect();
      return {top:r.top, bottom:r.bottom, width:r.width, height:r.height,
        viewport:innerHeight, scrollY, pageHeight:document.documentElement.scrollHeight,
        focused:document.activeElement.id};
    });
    result.checks.push({label, ...g});
    assert(g.top >= 0 && g.bottom <= g.viewport, JSON.stringify(g));
    assert(Math.abs(g.width / g.height - 1.6) < .01);
    return g;
  }
  await geometry('ready');
  await page.click('#start');
  await page.waitForTimeout(3000);
  assert.equal((await geometry('running')).focused, 'canvas');
  for (const key of ['ArrowDown', ' ', 'PageDown']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(300);
    await geometry('focused ' + key);
  }
  await page.screenshot({path:output.replace(/\.json$/, '.png')});
  for (const [width,height] of [[1280,720],[800,600],[640,480],[1000,700]]) {
    await page.setViewportSize({width,height});
    await page.waitForTimeout(100);
    await geometry(width + 'x' + height);
  }
  // Outside the game, PageDown must retain its native scrolling behavior.
  // A short viewport deliberately needs document scrolling to reach help.
  await page.setViewportSize({width:640,height:300});
  await page.locator('#fullscreen').focus();
  await page.evaluate(() => scrollTo(0,0));
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(500);
  assert(await page.evaluate(() => scrollY > 0));
  result.checks.push('PageDown outside game scrolls a short page normally');
  assert.equal(result.errors.length, 0);
  assert(result.requests.every(p => p.startsWith('/doom/')));
  result.status = 'pass';
})().catch(error => { result.status = 'fail'; result.error = String(error.stack); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  if (output) fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
});
