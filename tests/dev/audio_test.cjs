// Backend JS unit tests with real WAD samples. Not browser/acceptance evidence.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const code = fs.readFileSync(path.join(root, 'platform/audio.c'), 'utf8');
const funcs = {};
for (const match of code.matchAll(/EM_JS\(\w+, (\w+), \(([^]*?)\), \{\n([^]*?)\n\}\);/g)) {
  const params = match[2] === 'void' ? [] : match[2].split(',').map(p => p.trim().match(/(\w+)$/)[1]);
  funcs[match[1]] = { params, body: match[3] };
}
const events = {};
let resumed = 0;
class Node {
  constructor() { this.connections = []; this.gain = this.pan = { setValueAtTime(v) { this.value = v; } }; }
  connect(n) { this.connections.push(n); }
  disconnect() { this.connections = []; }
  start() { this.started = true; }
  stop() { this.stopped = true; }
}
class Context {
  constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; }
  resume() { ++resumed; this.state = 'running'; return Promise.resolve(); }
  createGain() { return new Node(); }
  createStereoPanner() { return new Node(); }
  createBufferSource() { return new Node(); }
  createBuffer(ch, count, rate) { const pcm = new Float32Array(count); return { duration: count / rate, getChannelData: () => pcm }; }
}
const sandbox = vm.createContext({Module: {}, console, Map, window: {
  AudioContext: Context, addEventListener(type, fn) { events[type] = fn; }
}});
function call(name, ...args) {
  const f = funcs[name];
  return vm.runInContext(`(function(${f.params.join(',')}) {${f.body}\n})`, sandbox)(...args);
}
call('AudioInstall'); call('AudioInstall');
assert.equal(sandbox.Module.doomAudio.ctx, null);
assert.ok(events.keydown && events.click && events.pointerdown);
events.keydown();
const a = sandbox.Module.doomAudio;
assert.equal(a.ctx.state, 'running'); assert.equal(resumed, 1);
assert.equal(a.master.connections[0], a.ctx.destination);
const wad = fs.readFileSync(path.join(root, 'assets/doom1.wad'));
const count = wad.readUInt32LE(4), dir = wad.readUInt32LE(8);
let tested = 0;
for (let i = 0; i < count; ++i) {
  const p = dir + 16 * i;
  const name = wad.toString('ascii', p + 8, p + 16).replace(/\0.*$/, '');
  if (!name.startsWith('DS')) continue;
  const data = wad.subarray(wad.readUInt32LE(p), wad.readUInt32LE(p) + wad.readUInt32LE(p + 4));
  assert.equal(data.readUInt16LE(0), 3);
  const n = data.readUInt32LE(4), rate = data.readUInt16LE(2);
  assert.ok(n > 48 && n <= data.length - 8 && rate >= 3000);
  sandbox.HEAPU8 = data;
  assert.equal(call('PlaySample', i, 0, 24, n - 32, rate, 100, 128), 0);
  assert.equal(call('AudioIsPlaying', 0), 1);
  const pcm = a.buffers.get(i).getChannelData(0);
  assert.equal(pcm[0], (data[24] - 128) / 128);
  assert.ok(pcm.some(v => Math.abs(v) > 0.01));
  const old = a.channels[0];
  call('PlaySample', i, 0, 24, n - 32, rate, 127, 0);
  old.source.onended();
  assert.ok(a.channels[0]); // old completion cannot erase replacement
  a.ctx.currentTime += a.buffers.get(i).duration + 1;
  assert.equal(call('AudioIsPlaying', 0), 0);
  call('StopSound', 0); assert.equal(a.channels[0], null);
  ++tested;
}
assert.ok(tested >= 55);
a.ctx.state = 'suspended'; events.click(); assert.equal(a.ctx.state, 'running');
console.log(`PASS: ${tested} real WAD DS lumps decoded; gesture resume, destination connection, channel replacement, expiry and stop`);
