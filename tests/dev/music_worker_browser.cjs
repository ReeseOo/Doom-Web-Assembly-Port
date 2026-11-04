// Real Chromium cold-score timing and lifecycle diagnostic. Not a protected gate.
// docker run with dist:/site, tests/dev:/devtests and evidence:/evidence.
const {chromium}=require('playwright');
const fs=require('fs'), http=require('http'), path=require('path'), assert=require('assert/strict');
const result={errors:[],phases:[], lifecycle:[]};
const server=http.createServer((req,res)=>{const f=path.join('/site',new URL(req.url,'http://localhost').pathname);fs.readFile(f.endsWith('/')?f+'index.html':f,(e,d)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type', {'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm'}[path.extname(f)]||'application/octet-stream');res.end(d);});});
let browser;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage();page.on('pageerror',e=>result.errors.push(String(e)));
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
 await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.click('#start');
 await page.waitForFunction(()=>window.Module?.doomAudio?.music?.current);
 // Start measurement before the first audio-unlocking key. No canvas click.
 await page.evaluate(()=>{
  window.probe={phase:null,raf:[],timer:[],inputs:[],sent:[],lastRAF:performance.now(),lastTimer:performance.now()};
  function tick(t){const p=probe;if(p.phase)p.raf.push(t-p.lastRAF);p.lastRAF=t;requestAnimationFrame(tick);}requestAnimationFrame(tick);
  setInterval(()=>{const p=probe,t=performance.now();if(p.phase)p.timer.push(t-p.lastTimer);p.lastTimer=t;},10);
  window.addEventListener('keydown',e=>{if(e.key==='Shift')probe.inputs.push(performance.now());},true);
 });
 async function phase(name,action,waitMusic=true){
  await page.evaluate(name=>{const p=probe;p.phase=name;p.raf=[];p.timer=[];p.inputs=[];p.sent=[];p.lastRAF=p.lastTimer=performance.now();p.begin=performance.now();},name);
  await action();
  // Continuous trusted input while cold synthesis is in flight. CDP send-to-handler
  // roundtrip upper-bounds the browser dispatch latency (includes transport).
  const latencies=[];let done=false;const start=Date.now();
  while(Date.now()-start<20000){
   const before=Date.now();await page.keyboard.press('Shift');latencies.push(Date.now()-before);
   done=await page.evaluate(()=>!!Module.doomAudio.music.source);
   if((!waitMusic||done)&&Date.now()-start>2000)break;
   await page.waitForTimeout(35);
  }
  const data=await page.evaluate(()=>{const p=probe,m=Module.doomAudio.music;p.phase=null;return {elapsed:performance.now()-p.begin,rafMax:Math.max(...p.raf),eventLoopMax:Math.max(...p.timer),inputEvents:p.inputs.length,source:!!m.source,job:!!m.job,duration:m.current?.duration,bufferSeconds:m.current?.buffer?.duration,context:Module.doomAudio.ctx.state};});
  result.phases.push({name,...data,inputRoundtripMax:Math.max(...latencies),inputsSent:latencies.length});
  assert.ok(data.rafMax<=250,`${name} rAF gap ${data.rafMax}`);assert.ok(data.eventLoopMax<=250,`${name} event loop gap ${data.eventLoopMax}`);assert.ok(Math.max(...latencies)<=250,`${name} input delay`);assert.equal(data.inputEvents,latencies.length);if(waitMusic)assert.ok(data.source,`${name} rendered`);
 }
 await phase('first activation',()=>page.keyboard.press('Enter'));
 await phase('New Game cold E1M1',async()=>{for(let i=0;i<3;i++){await page.keyboard.press('Enter');await page.waitForTimeout(350);}});
 assert.equal(result.phases[1].duration,96);
 await phase('cold long E1M3 transition',async()=>{await page.keyboard.type('idclev13',{delay:80});});
 assert.ok(result.phases[2].duration>200,'long cold score selected');
 // Exercise cancellation and stale completion without needing an engine test export.
 await page.evaluate(()=>{
  const m=Module.doomAudio.music;
  m.halt();m.current.buffer=null;m.kick();const old=m.job;
  if(!old)throw Error('no cold job');
  const next={events:m.current.events,duration:m.current.duration};
  m.halt();m.current=next;m.kick();const replacement=m.job;
  old.worker.dispatchEvent(new MessageEvent('message',{data:{pcm:new Float32Array(22050)}}));
  if(m.job!==replacement||next.buffer)throw Error('stale completion accepted');
  m.paused=true;m.halt();if(m.job||m.source)throw Error('pause leaked job');
  m.paused=false;m.kick();if(!m.job)throw Error('resume did not restart');
  m.halt();m.current=null;if(m.job||m.source)throw Error('stop leaked job');
 });result.lifecycle.push('replace cancels job; stale completion ignored; pause cancels; resume restarts; stop releases worker');
 assert.deepEqual(result.errors,[]);
 result.pass=true;
})().catch(e=>{result.pass=false;result.failure=String(e.stack);process.exitCode=1;}).finally(async()=>{fs.writeFileSync('/evidence/worker-browser.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(browser)await browser.close();server.close();});
