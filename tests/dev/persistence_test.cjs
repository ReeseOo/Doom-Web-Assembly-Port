// Development diagnostic, not the gameplay acceptance gate.
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
  const page = await browser.newPage();
  page.on('pageerror', e => result.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') result.errors.push(m.text()); });
  page.on('request', r => result.requests.push(new URL(r.url()).pathname));
  await page.goto(`http://127.0.0.1:${server.address().port}/doom/`);
  await page.waitForFunction(() => document.querySelector('#status').dataset.state === 'ready');
  assert.equal(await page.evaluate(() => Module.FS.cwd()), '/');
  result.checks.push('subpath startup and restore before Start');
  // Use exactly the engine close/remove/rename pattern, overwrite while a sync
  // is in flight, and reload without asking for an explicit sync.
  await page.evaluate(async () => {
    const f = Module.FS;
    f.writeFile('./.savegame/temp.dsg', 'first');
    f.rename('./.savegame/temp.dsg', './.savegame/doomsav0.dsg');
    await new Promise(resolve => setTimeout(resolve, 0));
    f.writeFile('./.savegame/temp.dsg', 'second');
    f.unlink('./.savegame/doomsav0.dsg');
    f.rename('./.savegame/temp.dsg', './.savegame/doomsav0.dsg');
  });
  await page.waitForFunction(() => document.querySelector('#save-status').dataset.state === 'saved');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#status').dataset.state === 'ready');
  assert.equal(await page.evaluate(() => Module.FS.readFile('/.savegame/doomsav0.dsg', {encoding:'utf8'})), 'second');
  assert.equal(await page.evaluate(() => Module.FS.analyzePath('/.savegame/temp.dsg').exists), false);
  result.checks.push('renamed save survived reload, latest write preserved, temp removed');
  // Remove synthetic data before starting the engine.
  await page.evaluate(async () => { Module.FS.unlink('/.savegame/doomsav0.dsg'); await Module.persistence.flush(); });
  await page.click('#start');
  await page.waitForTimeout(2500);
  assert.equal(await page.locator('#status').getAttribute('data-state'), 'running');
  assert.equal(await page.evaluate(() => !!Module.FS.analyzePath('/.savegame').exists), true);
  result.checks.push('engine starts after restore');
  assert.equal(result.errors.length, 0);
  assert(result.requests.every(p => p.startsWith('/doom/')));
  result.status = 'pass';
})().catch(error => { result.status = 'fail'; result.error = String(error.stack); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  if (output) fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
});
