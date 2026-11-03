// Run: python3 tests/dev/input_engine_test.py. Executes actual EM_JS bodies
// and feeds their emitted events through the supplied engine action path.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const engine = process.env.DOOM_INPUT_ENGINE;
if (!engine) {
  // Preserve the original direct Node invocation, but never skip engine checks.
  const run = spawnSync('python3', ['tests/dev/input_engine_test.py'], {stdio: 'inherit'});
  process.exit(run.status === null ? 1 : run.status);
}
const constants = spawnSync(engine, ['--constants'], {encoding: 'utf8'});
assert.equal(constants.status, 0, constants.stderr);
const K = JSON.parse(constants.stdout);
let source = fs.readFileSync('platform/video_input.c', 'utf8');
class Target {
  handlers = {};
  addEventListener(name, fn) { (this.handlers[name] ||= []).push(fn); }
  emit(name, event = {}) { for (const fn of this.handlers[name] || []) fn(event); }
}
const window = new Target(), document = new Target(), canvas = new Target();
let rendered;
canvas.getContext = () => ({createImageData: (w,h) => ({data: new Uint8Array(w*h*4)}),
  putImageData: image => { rendered = [...image.data]; }});
canvas.focus = () => { document.activeElement = canvas; };
document.getElementById = () => canvas;
const memory = new ArrayBuffer(4096);
const context = vm.createContext({Module: {canvas}, window, document,
  HEAPU32: new Uint32Array(memory), HEAP32: new Int32Array(memory),
  HEAPU8: new Uint8Array(memory), UTF8ToString: () => 'Doom <safe title>'});
for (const match of source.matchAll(/EM_JS\((\w+), (\w+), \(([^)]*)\), \{([\s\S]*?)\n\}\);/g)) {
  const args = match[3].split(',').map(x => x.trim().split(/[ *]+/).pop()).join(',');
  vm.runInContext(`function ${match[2]}(${args}) {${match[4]}\n}`, context);
}
context.video_init(3, 1, K.fire, K.use);
const state = context.Module.doomVideoInput;
context.HEAPU32.set([0xff0000, 0x00ff00, 0x0000ff], 16);
context.video_draw(64);
assert.deepEqual(rendered, [255,0,0,255,0,255,0,255,0,0,255,255]);
// Replaced memory view is respected on next draw.
context.HEAPU32 = new Uint32Array(1024); context.HEAPU32[16] = 0x123456;
context.video_draw(64); assert.deepEqual(rendered.slice(0,4), [18,52,86,255]);
function key(type, code, repeat = false) {
  let prevented = false;
  window.emit(type, {code, repeat, preventDefault: () => { prevented = true; }});
  return prevented;
}
function drain() {
  const events = [];
  while (context.video_get_key(0, 8)) events.push([context.HEAP32[0], context.HEAPU8[8]]);
  return events;
}
assert.equal(key('keydown','ArrowUp'), false); // unfocused page unaffected
canvas.focus();
assert.equal(key('keydown','ArrowUp'), true);
key('keydown','ArrowUp', true); key('keyup','ArrowUp');
assert.deepEqual(drain(), [[1,K.up],[0,K.up]]);
key('keydown','ControlLeft'); key('keydown','ControlRight'); key('keyup','ControlLeft');
assert.deepEqual(drain(), [[1,K.fire]]);
key('keyup','ControlRight'); assert.deepEqual(drain(), [[0,K.fire]]);
key('keydown','Space'); drain(); canvas.emit('blur');
assert.deepEqual(drain(), [[0,K.use]]);
key('keydown','ShiftLeft'); drain(); window.emit('blur');
assert.deepEqual(drain(), [[0,K.shift]]);
key('keydown','ArrowLeft'); drain(); document.hidden = true;
document.emit('visibilitychange'); assert.deepEqual(drain(), [[0,K.left]]);
for (const [code, doom] of [['Enter',13], ['Escape',27], ['Tab',9], ['KeyW',119], ['Digit1',49]]) {
  key('keydown',code); key('keyup',code); assert.deepEqual(drain(), [[1,doom],[0,doom]]);
}
// Saturate queue with a held engine-visible fire key, then release everything.
key('keydown','ControlLeft'); drain();
for (let i=0;i<2000;i++) { key('keydown','Space'); key('keyup','Space'); }
assert.ok(state.queue.length <= 1024);
window.emit('blur'); drain();
assert.equal(state.delivered.some(Boolean), false);
assert.equal(state.held.some(Boolean), false);
context.video_title(1); assert.equal(document.title, 'Doom <safe title>');
const count = window.handlers.keydown.length;
context.video_init(3,1,K.fire,K.use); assert.equal(window.handlers.keydown.length,count);
console.log('PASS: RGB/opaque alpha, memory growth, down/up, repeats, modifier aliases, blur/visibility, focus/defaults, overflow recovery, title, idempotence');

// Capture browser-generated events one transition at a time; the C harness
// calls I_GetEvent -> D_PostEvent/D_PopEvent -> G_Responder -> G_BuildTiccmd.
// Expected buttons derive from compiled engine headers, not duplicated values.
const steps = [];
function checkpoint(expected) {
  const events = drain();
  for (let [down, code] of events) {
    // Optional negative control: recreate the reviewed defect only at the
    // engine boundary, so the action-path assertion itself must reject it.
    if (process.env.DOOM_INPUT_NEGATIVE_CONTROL === 'fire' && code === K.fire) code = 0x9d;
    if (process.env.DOOM_INPUT_NEGATIVE_CONTROL === 'use' && code === K.use) code = 32;
    steps.push(`${down} ${code} ${expected}`);
  }
  if (!events.length) steps.push(`-1 0 ${expected}`);
}
checkpoint(0);
key('keydown', 'ControlLeft'); checkpoint(K.attack);
key('keydown', 'ControlLeft', true); checkpoint(K.attack);
key('keydown', 'ControlRight'); checkpoint(K.attack);
key('keyup', 'ControlLeft'); checkpoint(K.attack);
key('keyup', 'ControlRight'); checkpoint(0);
key('keydown', 'ControlRight'); checkpoint(K.attack);
key('keyup', 'ControlRight'); checkpoint(0);
key('keydown', 'Space'); checkpoint(K.use_button);
key('keyup', 'Space'); checkpoint(0);
key('keydown', 'ControlLeft'); checkpoint(K.attack);
key('keydown', 'Space'); checkpoint(K.attack | K.use_button);
key('keyup', 'ControlLeft'); checkpoint(K.use_button);
key('keyup', 'Space'); checkpoint(0);
key('keydown', 'ControlLeft'); checkpoint(K.attack);
window.emit('blur'); checkpoint(0);
key('keydown', 'Space'); checkpoint(K.use_button);
canvas.emit('blur'); checkpoint(0);
key('keydown', 'ControlRight'); checkpoint(K.attack);
document.hidden = true; document.emit('visibilitychange'); checkpoint(0);
const actions = spawnSync(engine, [], {input: steps.join('\n') + '\n', encoding: 'utf8'});
assert.equal(actions.status, 0, actions.stderr);
process.stdout.write(actions.stdout);
