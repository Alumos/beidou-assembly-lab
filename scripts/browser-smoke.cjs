// Run against the local preview. Requires Playwright and an installed Chrome.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const baseURL = process.env.BEIDOU_TEST_URL || 'http://127.0.0.1:18083/';
const ids = ['geo','igso','meo','control','monitor','inject','ship','car','phone'];
const errors = [];
async function ready(page) {
  await page.waitForFunction(() => document.getElementById('scene-loading').hidden);
}
async function targetPoint(page, id) {
  return page.evaluate(id => {
    const rect = document.getElementById('world').getBoundingClientRect();
    const cam = BeidouScene.camera(rect.width, rect.height, beidouGame.getView());
    const part = BeidouEngine.PARTS.find(p => p.id === id);
    return {x: rect.left + cam.x + part.x * cam.scale, y: rect.top + cam.y + part.y * cam.scale};
  }, id);
}
async function drag(page, id, target) {
  await page.locator(`[data-part="${id}"]`).scrollIntoViewIfNeeded();
  const box = await page.locator(`[data-part="${id}"]`).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const point = typeof target === 'string' ? await targetPoint(page,target) : target;
  await page.mouse.move(point.x, point.y, {steps:14});
  await page.mouse.up();
}
async function verifyFlow(browser, legacy) {
  const context = await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'no-preference'});
  if (legacy) await context.addInitScript(() => {
    window.PointerEvent = undefined;
    window.ResizeObserver = undefined;
    window.structuredClone = undefined;
    Object.fromEntries = undefined;
    CanvasRenderingContext2D.prototype.roundRect = undefined;
    HTMLDialogElement.prototype.showModal = undefined;
    HTMLDialogElement.prototype.close = undefined;
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(baseURL); await ready(page);
  assert.equal(await page.locator('#world-frame #reset-button').count(),1);
  assert.equal(await page.locator('#world-frame #start-button').count(),1);
  assert.deepEqual(await page.locator('.world-view button').allTextContents(),['空间','地面','用户']);
  assert.equal(await page.locator('.message-box, .keyboard-controls, .footer').count(),0);
  const firstCanvas = await page.locator('#world').boundingBox();
  assert(firstCanvas.y < 150 && firstCanvas.height > 430, 'Map should fill the desktop workspace');
  const phone = await page.locator('[data-part="phone"]').boundingBox();
  assert(phone.y + phone.height <= 768, 'All nine cards should fit on a classroom screen');
  // Earth turns before assembly, even without any installed component or moving link.
  const initial = await page.locator('#world').evaluate(c => c.toDataURL());
  await page.waitForFunction(before => document.getElementById('world').toDataURL() !== before, initial);
  await drag(page,'geo','igso');
  assert.equal(await page.locator('#feedback-title').textContent(),'摆放出错，再试一次');
  assert.equal(await page.evaluate(() => beidouGame.getState().placed.length),0);
  if (!legacy) await page.screenshot({path:'artifacts/drop-error.png',fullPage:true});
  const blank = {x:firstCanvas.x+firstCanvas.width*.18,y:firstCanvas.y+firstCanvas.height*.5};
  await drag(page,'geo',blank);
  assert.equal(await page.locator('#feedback-title').textContent(),'这里不是安装位置');
  for (const id of ids) {
    await drag(page,id,id);
    assert((await page.locator('#feedback-title').textContent()).includes('安装正确'));
  }
  assert.equal(await page.locator('#installed-count').textContent(),'9');
  await page.locator('#start-button').click();
  assert.equal(await page.evaluate(() => beidouGame.getState().phase),'running');
  await page.waitForFunction(() => beidouGame.getState().missionTime > .5);
  await page.locator('#pause-button').click();
  assert.equal(await page.evaluate(() => beidouGame.getState().paused),true);
  await page.locator('#pause-button').click();
  // Hold scene geometry constant and compare pixels on the middle of one link.
  // This checks arrow motion independently of Earth, satellite or installation animation.
  const changed = await page.evaluate(() => {
    const c=document.createElement('canvas');c.width=1200;c.height=750;const ctx=c.getContext('2d');
    const state=BeidouEngine.INITIAL();state.placed=['geo','ship'];
    const a=BeidouEngine.PARTS.find(p=>p.id==='geo'),b=BeidouEngine.PARTS.find(p=>p.id==='ship');
    const x=Math.round((a.x+b.x)/2)-60,y=Math.round((a.y+b.y)/2)-60;
    const opts={width:1200,height:750,state,assets:{},earth:null,silhouettes:{},time:0};
    BeidouScene.draw(ctx,Object.assign({},opts,{effectTime:0}));
    const before=ctx.getImageData(x,y,120,120).data;
    BeidouScene.draw(ctx,Object.assign({},opts,{effectTime:.7}));
    const after=ctx.getImageData(x,y,120,120).data;
    return after.reduce((n,v,i)=>n+(v!==before[i]?1:0),0);
  });
  assert(changed > 50,'Signal arrow pixels must change while scene geometry stays fixed');
  assert.equal(await page.locator('#challenge-panel, #clock-lab').count(),0);
  assert.equal(await page.locator('#sound-button').getAttribute('aria-pressed'),'true');
  assert.equal(await page.title(),'任务一：北斗拼装台');
  await page.reload(); await ready(page);
  assert.equal(await page.locator('#installed-count').textContent(),'9');
  await page.locator('#help-button').click();
  assert(await page.locator('#help-dialog').isVisible());
  await page.locator('#help-done').click();
  assert(!await page.locator('#help-dialog').isVisible());
  await page.locator('#reset-button').click();
  assert.equal(await page.locator('#installed-count').textContent(),'0');
  await page.setViewportSize({width:1024,height:768});
  await page.waitForFunction(() => {
    const c=document.getElementById('world');return Math.abs(c.width-c.getBoundingClientRect().width)<2;
  });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth),false);
  await context.close();
  console.log(legacy ? 'PASS: missing APIs, mouse fallback, dialogs, resize, complete flow, moving arrows' : 'PASS: desktop drag errors/success, complete flow, rotating Earth, moving arrows');
}
async function verifyTouch(browser, legacy) {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  if (legacy) await context.addInitScript(()=>{window.PointerEvent=undefined;window.ResizeObserver=undefined;});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(baseURL);await ready(page);
  assert.equal(await page.locator('#motion-button').textContent(),'动画关');
  await page.locator('#motion-button').tap();
  assert.equal(await page.locator('#motion-button').textContent(),'动画开');
  const box=await page.locator('[data-part="geo"]').boundingBox();
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
  const target=await targetPoint(page,'geo');
  for(let i=1;i<=10;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width/2+(target.x-box.x-box.width/2)*i/10,y:box.y+box.height/2+(target.y-box.y-box.height/2)*i/10}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await page.locator('#installed-count').textContent(),'1');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await context.close();
  console.log(legacy ? 'PASS: old touch-event fallback' : 'PASS: mobile touch dragging, reduced-motion override');
}
(async()=>{
  fs.mkdirSync('artifacts',{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.BEIDOU_CHROME_PATH || (process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined)});
  try {
    await verifyFlow(browser,false);await verifyFlow(browser,true);
    await verifyTouch(browser,false);await verifyTouch(browser,true);
    assert.deepEqual(errors,[]);
    console.log('All browser checks passed, with no script or HTTP errors.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
