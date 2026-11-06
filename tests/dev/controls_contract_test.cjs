const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
class Target {
  handlers = {};
  addEventListener(n,f) {(this.handlers[n] ||= []).push(f);}
  emit(n,e={}) {for (const f of this.handlers[n] || []) f(e);}
}
const window = new Target(), document = new Target(), canvas = new Target();
canvas.getContext = () => ({createImageData: (w,h) => ({data:new Uint8Array(w*h*4)})});
const memory = new ArrayBuffer(4096);
const ctx = vm.createContext({Module:{canvas}, window, document, HEAP32:new Int32Array(memory), HEAPU8:new Uint8Array(memory)});
const source = fs.readFileSync('platform/video_input.c','utf8');
for (const m of source.matchAll(/EM_JS\((\w+), (\w+), \(([^)]*)\), \{([\s\S]*?)\n\}\);/g)) {
  const args = m[3].split(',').map(x=>x.trim().split(/[ *]+/).pop()).join(',');
  vm.runInContext(`function ${m[2]}(${args}) {${m[4]}\n}`,ctx);
}
ctx.video_init(640,400); document.activeElement=canvas;
const steps=[];
function event(type,code,expected=[0,0,0,0],repeat=false) {
  let prevented=false;
  window.emit(type,{code,repeat,preventDefault:()=>{prevented=true;}});
  assert.ok(prevented,code+' default');
  drain(expected);
}
function drain(expected) {
  let count=0;
  while(ctx.video_get_key(0,8)) {
    steps.push([ctx.HEAP32[0],ctx.HEAPU8[8],...expected].join(' ')); count++;
  }
  if(!count) steps.push([-1,0,...expected].join(' '));
}
for(const [code,action] of [['Space',[1,0,0,0]],['KeyE',[2,0,0,0]],['KeyW',[0,1,0,0]],['KeyS',[0,-1,0,0]],['KeyA',[0,0,-1,0]],['KeyD',[0,0,1,0]],['ArrowLeft',[0,0,0,1]],['ArrowRight',[0,0,0,-1]]]) {
  event('keydown',code,action); event('keydown',code,action,true); event('keyup',code);
}
event('keydown','Space',[1,0,0,0]); window.emit('blur'); drain([0,0,0,0]);
event('keydown','KeyE',[2,0,0,0]); canvas.emit('blur'); drain([0,0,0,0]);
event('keydown','KeyW',[0,1,0,0]); document.hidden=true; document.emit('visibilitychange'); drain([0,0,0,0]);
const result=spawnSync(process.argv[2],[],{input:steps.join('\n')+'\n',encoding:'utf8'});
assert.equal(result.status,0,result.stderr); process.stdout.write(result.stdout);
// Raw identities remain usable by menus and save-name typing, not action codes.
for(const [code,value] of [['KeyA',97],['KeyW',119],['KeyS',115],['KeyD',100],['KeyE',101],['Space',32],['Enter',13],['Escape',27],['ArrowUp',173],['ArrowDown',175],['ShiftLeft',182],['Digit1',49],['Digit7',55]]) {
  window.emit('keydown',{code,preventDefault(){}});
  assert.equal(ctx.video_get_key(0,8),1); assert.equal(ctx.HEAPU8[8],value);
  window.emit('keyup',{code,preventDefault(){}}); assert.equal(ctx.video_get_key(0,8),1); assert.equal(ctx.HEAP32[0],0);
}
console.log('PASS: plain letters/Space, menu identities, Shift/digits, repeat/hold, blur/hidden releases, scroll prevention');
