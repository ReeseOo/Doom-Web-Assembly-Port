// MUS decoding/rendering and lifecycle tests; mock graph is not browser evidence.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const path = require('node:path'), root = path.resolve(__dirname, '../..');
const src = fs.readFileSync(path.join(root, 'platform/audio.c'), 'utf8'), funcs = {};
for (const m of src.matchAll(/EM_JS\(\w+, (\w+), \(([^]*?)\), \{\n([^]*?)\n\}\);/g)) {
  funcs[m[1]] = {args: m[2] === 'void' ? [] : m[2].split(',').map(x => x.trim().match(/(\w+)$/)[1]), body: m[3]};
}
class Node {
  constructor() { this.gain = {value: 0, setValueAtTime(v) {this.value = v;}}; }
  connect(n) {this.output = n;} disconnect() {} stop() {this.stopped = true;}
  start(time, offset) {this.offset = offset;}
}
class Context {
  constructor() {this.currentTime = 0; this.state = 'suspended'; this.destination = {};}
  resume() {this.state = 'running'; return Promise.resolve();}
  createGain() {return new Node();} createBufferSource() {return new Node();}
  createBuffer(c, n, r) {const pcm = new Float32Array(n); return {duration:n/r, getChannelData:() => pcm};}
}
const urls = new Map(); let nextURL = 0;
class Blob { constructor(parts) {this.code=parts.join('');} }
const URL = {createObjectURL(blob) {const id=String(++nextURL);urls.set(id,blob.code);return id;}, revokeObjectURL(id) {urls.delete(id);}};
class Worker {
  constructor(url) {this.code=urls.get(url);}
  terminate() {this.dead=true;}
  postMessage(song) {
    setImmediate(()=>{
      if(this.dead)return;
      const self=this;
      const ctx=vm.createContext({console,postMessage(data){if(!self.dead)self.onmessage({data});}});
      vm.runInContext(this.code,ctx);
      ctx.onmessage({data:song});
    });
  }
}
const events = {}, sandbox = vm.createContext({console, Blob, URL, Worker, Module: {}, window: {
  AudioContext: Context, addEventListener(k, f) {events[k] = f;}
}});
function call(k, ...args) {const f = funcs[k]; return vm.runInContext(`(function(${f.args}) {${f.body}\n})`, sandbox)(...args);}
(async()=>{
call('AudioInstall'); call('MusicInstall'); const a = sandbox.Module.doomAudio, m = a.music;
const wad = fs.readFileSync(path.join(root,'assets/doom1.wad'));
let total = 0, first;
for (let i = 0; i < wad.readUInt32LE(4); ++i) {
  const p = wad.readUInt32LE(8) + i*16, start = wad.readUInt32LE(p), size = wad.readUInt32LE(p+4);
  const name = wad.toString('ascii',p+8,p+16).replace(/\0.*$/, '');
  const d = wad.subarray(start,start+size);
  if (d.toString('ascii',0,4) !== 'MUS\x1a') continue;
  sandbox.HEAPU8 = d;
  const id = call('MusicRegister',0,size); assert.ok(id, name);
  const song = m.songs.get(id); assert.ok(song.events.length > 10);
  const before = performance.now(), pcm = m.render(song);
  let peak=0, sum=0, audible=0, windows=0;
  for(let i=0; i<pcm.length; i+=2205) {
    let energy=0, n=Math.min(2205,pcm.length-i);
    for(let j=i;j<i+n;++j) {assert.ok(Number.isFinite(pcm[j])); peak=Math.max(peak,Math.abs(pcm[j])); energy+=pcm[j]*pcm[j];}
    sum+=energy; ++windows; if(Math.sqrt(energy/n)>0.002) ++audible;
  }
  assert.ok(peak>0.002); assert.ok(audible/windows>0.5, name);
  console.log(`${name}: ${song.duration.toFixed(2)}s, ${song.events.length} events, peak ${peak.toFixed(3)}, RMS ${Math.sqrt(sum/pcm.length).toFixed(3)}, audible ${(100*audible/windows).toFixed(1)}%, render ${(performance.now()-before).toFixed(0)}ms`);
  if(!first) first=id;
  ++total;
}
assert.equal(total,13);
call('MusicCommand',5,first); call('MusicCommand',6,1);
assert.equal(m.source,null); assert.ok(m.current); // queued before first gesture
const start = performance.now(); events.keydown();
assert.equal(a.ctx.state,'running'); assert.ok(m.job); assert.equal(m.source,null);
await new Promise(setImmediate); assert.ok(m.source.loop); assert.equal(urls.size,0);
assert.equal(m.source.output,m.gain); assert.equal(m.gain.output,a.master);
call('MusicCommand',1,63); assert.equal(m.gain.gain.value,63/127);
a.ctx.currentTime=4; call('MusicCommand',2,0); assert.equal(m.offset,4); assert.equal(m.source,null);
call('MusicCommand',3,0); assert.equal(m.source.offset,4);
const old=m.source; call('MusicCommand',5,first); call('MusicCommand',6,0);
assert.ok(old.stopped); assert.equal(m.source.loop,false); assert.equal(m.offset,0);
m.source.onended(); assert.equal(call('MusicCommand',7,0),0);
call('MusicCommand',5,first); call('MusicCommand',6,1); call('MusicCommand',4,first);
assert.equal(m.current,null); assert.equal(m.source,null); assert.equal(m.songs.has(first),false);
assert.throws(()=>m.decode(Uint8Array.from([77,85,83,26])));
console.log(`PASS: ${total} supplied MUS scores, graph, first-gesture queue, volume, pause/resume, replacement, end, unregister; first render ${(performance.now()-start).toFixed(0)}ms`);

})().catch(e=>{console.error(e);process.exitCode=1;});
