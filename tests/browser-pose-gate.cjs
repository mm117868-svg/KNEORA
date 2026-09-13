const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:8783/';
const countMethod = process.env.TEST_COUNT_METHOD || 'motion';
const out = require('node:path').join(require('node:os').tmpdir(), 'leg-gate-browser');
fs.mkdirSync(out, {recursive: true});
(async () => {
  const browser = await chromium.launch({headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {channel:'chrome'}), args:['--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport:{width:1280,height:960}});
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.addInitScript(countMethod => {
    window.playedPrompts=[];
    const start=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){window.playedPrompts.push({duration:this.buffer?.duration,state:this.context.state});return start.apply(this,args);};
    localStorage.setItem('kr_side','left');
    localStorage.setItem('kr_app_countby',countMethod);
    localStorage.setItem('kr_skeleton','0');
    for(const key of ['angle','video','files','handstart','voice','speak']) localStorage.setItem('kr_app_'+key,'0');
    window.cameraCalls=0;
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
      window.cameraCalls++;
      const c=document.createElement('canvas');c.width=960;c.height=640;
      const ctx=c.getContext('2d');let frame=0;
      const paint=()=>{ctx.fillStyle='#555';ctx.fillRect(0,0,960,640);ctx.fillStyle='#888';ctx.fillRect((frame++%5)*4,0,12,12);};
      paint();setInterval(paint,40);return c.captureStream(25);
    }});
  }, countMethod);
  await page.goto(base+'?debug&nopose');
  await page.waitForFunction(()=>!!window.kr);
  await page.evaluate(()=>{
    window.testLift=0;window.testMissing=false;window.testPartial=true;window.opticalPending=0;
    window.kr.setPose(()=>{
      if(window.testMissing)return {landmarks:[]};
      const p=Array.from({length:33},()=>({x:0,y:0,visibility:0,presence:0}));
      const lift=window.testLift;
      p[23]={x:.28,y:.68,visibility:window.testPartial?0:1,presence:1};
      p[25]={x:.28+.2*Math.cos(lift),y:.68-.3*Math.sin(lift),visibility:1,presence:1};
      p[27]={x:.28+.4*Math.cos(lift),y:.68-.6*Math.sin(lift),visibility:1,presence:1};
      p[15]={x:.1+.02*Math.sin(performance.now()/80),y:.1,visibility:1,presence:1};
      if(window.testHand)p[0]={x:.1,y:.5,visibility:1,presence:1};
      for(const i of [23,25,27]){if(p[i].visibility)p[i].visibility=.25;p[i].presence=.25;}
      return {landmarks:[p]};
    });
  });
  const card=page.locator('.ex-card:not(:disabled)').filter({hasText:'Straight leg raise'}).first();
  await card.click(); await page.locator('dialog[open]').waitFor();
  assert.equal(await page.evaluate(()=>cameraCalls),0);
  await page.locator('.guide-skip').click();
  await page.waitForFunction(()=>document.querySelector('#brief').classList.contains('up'));
  await page.locator('#voiceTest').click();
  await page.waitForFunction(()=>document.querySelector('#voiceStatus').textContent.startsWith('Marin is playing'));
  assert.equal(await page.evaluate(()=>kr.running),false,'voice test must not start recording');
  assert.deepEqual(await page.evaluate(()=>window.playedPrompts[0]),{duration:5,state:'running'});
  const greenPixels=()=>page.evaluate(()=>{
    const c=document.querySelector('#canvas');const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;
    for(let i=0;i<a.length;i+=4)if(a[i+1]>a[i]*1.5&&a[i+1]>a[i+2]*1.3&&a[i+1]>120)n++;
    return n;
  });
  await page.waitForTimeout(300);
  const previewGreen=await greenPixels();assert.ok(previewGreen>250,'knee-ankle skeleton visible without hip, head or torso');
  assert.equal(await page.locator('#skeleton').count(),0);
  await page.screenshot({path:out+'/partial-leg-preview.png'});
  await page.evaluate(()=>{window.testPartial=false;window.testHand=true;});
  await page.waitForFunction(()=>window.kr.countingDown);
  await page.evaluate(()=>window.testHand=false);
  await page.waitForFunction(()=>window.kr.running && !!window.kr.legGate?.reference);
  await page.evaluate(()=>{
    window.kr.monitor.update=function(video,frame,t){
      if(!window.opticalPending)return 0;
      window.opticalPending--;window.opticalFrame=frame;this.counter.reps++;this.counter.times.push(t);return 1;
    };
    if(window.kr.tracker)window.kr.tracker.update=function(video,frame,t){
      if(window.opticalFrame!==frame)return 0;
      this.counter.reps++;this.counter.times.push(t);return 1;
    };
    window.opticalPending=2;
  });
  await page.waitForFunction(()=>window.kr.legGate.events.length===2);
  assert.equal(await page.locator('#reps').innerText(),'0');
  assert.equal(await page.evaluate(()=>kr.legGate.summary().rejected),2);
  await page.evaluate(()=>{window.cycleStart=performance.now();window.cycleTimer=setInterval(()=>{
    const elapsed=(performance.now()-window.cycleStart)/1000;
    window.testLift=elapsed<=3?.6*Math.sin(Math.PI*elapsed/3):0;
    if(elapsed>3.1){clearInterval(window.cycleTimer);window.cycleFinished=true;}
  },30);});
  await page.waitForFunction(()=>window.kr.legGate.cycle?.excursion);
  await page.evaluate(()=>window.opticalPending=2);
  await page.waitForFunction(()=>window.cycleFinished && window.kr.legGate.reps===1);
  assert.equal(await page.locator('#reps').innerText(),'1');
  assert.equal(await page.evaluate(()=>kr.legGate.summary().rejected),3);
  await page.screenshot({path:out+'/confirmed-count.png'});
  await page.evaluate(()=>{window.testPartial=true;window.opticalPending=1;});
  await page.waitForTimeout(650);
  assert.equal(await page.locator('#reps').innerText(),'1');
  const partialGreen=await greenPixels();assert.ok(partialGreen>250);
  await page.evaluate(()=>{window.testMissing=true;window.opticalPending=1;});
  await page.waitForTimeout(600);
  assert.equal(await page.locator('#reps').innerText(),'1');
  assert.equal(await greenPixels(),0,'missing skeleton not fabricated or left stale');
  await page.locator('#finish').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('kr_sessions')||'[]').length>0);
  const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('kr_sessions')).at(-1));
  assert.equal(record.count_source,'pose_gated_optical');
  assert.ok(record.recording.captured&&record.recording.bytes>0,'a real MediaRecorder video was captured');
  assert.equal(await page.locator('.recording-stopped').innerText().then(t=>t.includes('Marin audio is unavailable')),false);
  assert.deepEqual(await page.evaluate(()=>window.playedPrompts.at(-1)),{duration:8.112,state:'running'});
  assert.equal(record.pose_validation.raw_source,countMethod==='track'?'knee_tracker':'monitoring');
  assert.equal(record.pose_validation.repetitions,1);
  assert.equal(record.monitoring.repetitions,6);
  assert.equal(record.pose_validation.rejected,3);
  assert.equal(record.pose_validation.unconfirmed,2);
  assert.equal(record.pose_validation.pending,0);
  assert.match(await page.locator('#simpleExerciseSummary').innerText(),/Camera count confirmed in the selected leg/);
  await page.screenshot({path:out+'/saved-summary.png'});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('kr_sessions')||'[]').at(-1)?.exercise_analysis, null, {timeout:60000});
  assert.equal(await page.locator('dialog.exercise-analysis-dialog[open]').count(),0,'automatic analysis does not interrupt the summary with a modal');
  const replay=page.locator('#exerciseAnalysis video');
  await page.locator('#exerciseAnalysis summary').click();
  assert.ok(await replay.evaluate(v=>v.readyState>=2&&v.videoWidth>0),'recording decodes for replay');
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('link',{name:'Download this recording',exact:true}).click();
  const download=await downloadPromise;const savedVideo=out+'/captured-synthetic.webm';await download.saveAs(savedVideo);assert.ok(fs.statSync(savedVideo).size>0);
  await page.screenshot({path:out+'/analysed-summary.png'});
  for(const view of ['settings','recovery-summary','progress-to-date','recovery-timeline','patient-measures','progress']){
    await page.goto(base+'?view='+view);
    await page.waitForFunction(()=>document.querySelector('.patient-header-nav [aria-current="page"]'));
    assert.equal(await page.locator('.patient-header-nav [aria-current="page"]').getAttribute('data-page'),view);
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,view+' mobile overflow');
  }
  await page.locator('[data-metric="reps"]').click();
  assert.match(await page.locator('[data-progress-chart]').innerText(),/1.*Camera count confirmed/s);
  await page.goto(base+'report.html');
  assert.match(await page.locator('#out').innerText(),/1\/10/);
  assert.match(await page.locator('#out').innerText(),/1 reps \(selected-leg confirmation; 3 rejected and 2 unconfirmed/);
  assert.deepEqual(errors,[]);
  const result={base,countMethod,simulation:true,scratchOnlyCount:0,validLegCycleCount:1,rawOpticalEvents:6,rejected:3,unconfirmed:2,partialPreviewGreenPixels:previewGreen,partialSessionGreenPixels:partialGreen,staleSkeletonHidden:true,storedCountSource:record.count_source,progressAndReport:true,mobileOverflow:false,errors};
  fs.writeFileSync(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
