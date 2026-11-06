// Verify the actual audio backend accepts the revised controls as unlock gestures.
// Unit-only: does not claim trusted browser activation or audible output.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('platform/audio.c', 'utf8');
const body = source.match(/EM_JS\(void, AudioInstall, \(void\), \{\n([^]*?)\n\}\);/)[1];
for (const code of ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'KeyE', 'ShiftLeft', 'ArrowLeft', 'Digit1']) {
  const handlers = {};
  let resumes = 0;
  class Context {
    constructor() { this.state = 'suspended'; this.destination = {}; }
    createGain() { return {gain: {value: 0}, connect() {}}; }
    resume() { resumes++; this.state = 'running'; return Promise.resolve(); }
  }
  const Module = {};
  vm.runInNewContext('(function() {' + body + '\n})()', {Module, console, Map, window: {
    AudioContext: Context,
    addEventListener(type, fn, capture) { handlers[type] = {fn, capture}; }
  }});
  assert.equal(Module.doomAudio.ctx, null);
  assert.equal(handlers.keydown.capture, true);
  handlers.keydown.fn({code});
  assert.equal(Module.doomAudio.ctx.state, 'running', code);
  assert.equal(resumes, 1, code);
}
console.log('PASS: all revised gameplay keys unlock audio through capture-phase keydown');
