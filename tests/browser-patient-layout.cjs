const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:8876/';
const path=require('node:path'),os=require('node:os');
const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/London'});
const surgery=new Date(Date.parse(today+'T12:00:00Z')-12*86400000).toISOString().slice(0,10);
const age=Number(today.slice(0,4))-1960;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:1280,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(surgery=>{if(!localStorage.getItem('kr_patient')){localStorage.setItem('kr_patient','SYNTHETIC LAYOUT TEST');localStorage.setItem('kr_opdate',surgery);localStorage.setItem('kr_side','left');}},surgery);
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:1000});await page.goto(base+'?nopose');await page.locator('.mini-calendar').waitFor();
  assert.deepEqual(await page.locator('.patient-header-nav a').allTextContents(),['Home','Recovery summary','Exercise metrics','Recovery timeline']);
  const profile=await page.locator('#patientDetails').boundingBox(),calendar=await page.locator('#progress').boundingBox();
  if(width>700){assert.ok(Math.abs(profile.y-calendar.y)<2);assert.ok(calendar.x>profile.x+profile.width-1);}else assert.ok(calendar.y>profile.y+profile.height);
  assert.equal(await page.locator('#cameraOptions').getAttribute('open'),null);
  await page.locator('#patientName').fill('Synthetic Patient');await page.locator('#patientDob').fill('1960-01-01');await page.locator('#patientName').focus();
  assert.equal(await page.locator('#patientAge').innerText(),`${age} years`);assert.equal(await page.locator('#patientPostop').innerText(),'12 days');
  await page.reload();await page.locator('.mini-calendar').waitFor();assert.equal(await page.locator('#patientName').inputValue(),'Synthetic Patient');assert.equal(await page.locator('#patientDob').inputValue(),'1960-01-01');
  await page.screenshot({path:path.join(os.tmpdir(),'recovery-home-'+width+'.png')});
  await page.locator('#cameraOptions>summary').click();assert.ok(await page.locator('#side').isVisible());
  await page.locator('#settingsDone').click();assert.equal(await page.locator('#cameraOptions').getAttribute('open'),null);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.goto(base+'?view=settings&nopose#side');await page.locator('#side').waitFor();assert.equal(await page.locator('#cameraOptions').getAttribute('open'),'');assert.equal(await page.evaluate(()=>document.activeElement.id),'side');
  await page.goto(base+'?view=recovery-summary');await page.locator('.rs-primary-trend').first().waitFor();
  assert.equal(await page.locator('.rs-movement-chart').count(),1);assert.equal(await page.locator('.rs-range,.rs-comparison,.rs-measurement-records').count(),0);
  const text=await page.locator('#recoverySummary').innerText();for(const unwanted of ['Muscle strength','Pain and effort','Recovery measurements over time','Compare the two camera sources'])assert.ok(!text.includes(unwanted),unwanted);
  const graphs=await page.locator('[data-recovery-graphs]').boundingBox(),form=await page.locator('#recoveryCheck').boundingBox();assert.ok(graphs.y+graphs.height<=form.y);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(os.tmpdir(),'recovery-summary-'+width+'.png')});
  await page.locator('[data-start-sequence]').click();assert.equal(await page.locator('[name=motion]').inputValue(),'bend');assert.equal(await page.locator('[data-measurement-plan]').inputValue(),'both');
 }
 await page.goto(base+'tests/recovery-summary-fixture.html');await page.locator('.rs-primary-trend').first().waitFor();
 assert.match(await page.locator('[data-trend-stat=straighten]').innerText(),/5°/);
 const oldCircles=await page.locator('.rs-primary-trend').first().locator('circle').count();assert.ok(oldCircles>0);
 await page.locator('[data-open-camera]').click();await page.getByRole('button',{name:'Simulate open-palm trigger (software test)'}).click();await page.locator('[data-measurement-preview]').waitFor();
 assert.equal(await page.locator('[name=confirmed]').isChecked(),true);await page.locator('[data-save-measurement]').click();assert.match(await page.locator('[data-save-status]').innerText(),/Saved knee bending: 96°/);
 assert.match(await page.locator('.rs-primary-trend').first().innerText(),/96°/);
 // Review must be invalidated when its measurement context changes.
 await page.locator('[data-open-camera]').click();await page.locator('[data-capture]').click();await page.locator('[data-measurement-preview]').waitFor();await page.locator('[name=motion]').selectOption('straighten');assert.equal(await page.locator('[data-save-measurement]').isDisabled(),true);
 assert.deepEqual(errors,[]);console.log('PASS: desktop/mobile layout, profile persistence, collapsed settings, legacy links, one combined graph, removed sections, synthetic palm capture/save and stale-result invalidation.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
