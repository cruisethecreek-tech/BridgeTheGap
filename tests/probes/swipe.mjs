import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const URL='file://'+process.cwd()+'/app.html';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,200):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto(URL);
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',s), JSON.stringify({
  onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',
  categories:[{id:'c',name:'Food'}],budgets:{'2026-08':{c:400}},
  transactions:[{id:'i',type:'income',amount:3000,date:'2026-08-01'}],
  goals:[],impulse:[],recurring:[],accounts:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[]}));
await pg.reload(); await pg.waitForTimeout(700);

/* real TouchEvents, dispatched at the element, so the listeners run exactly as
   they would under a thumb */
const swipe = (dy, steps=6) => pg.evaluate(async ({dy,steps})=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const el=document.getElementById('tabs');
  const r=el.getBoundingClientRect();
  const x=r.left+r.width*0.25, y=r.top+8;
  const mk=(type,cx,cy)=>{
    const t=new Touch({identifier:1,target:el,clientX:cx,clientY:cy});
    el.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[t],
      targetTouches:type==='touchend'?[]:[t],changedTouches:[t],bubbles:true,cancelable:true}));
  };
  mk('touchstart',x,y);
  for(let i=1;i<=steps;i++){ mk('touchmove',x,y-(dy*i/steps)); await wait(12); }
  mk('touchend',x,y-dy);
  await wait(220);
  return document.getElementById('tabs').classList.contains('more-open');
}, {dy,steps});

const isOpen=()=>pg.evaluate(()=>document.getElementById('tabs').classList.contains('more-open'));

ok('the drawer starts closed', (await isOpen())===false);
ok('there is a visible handle saying it can be dragged',
  await pg.evaluate(()=>{ const g=document.getElementById('tabGrip');
    return !!g && g.getBoundingClientRect().height>=3 && g.getBoundingClientRect().width>=30; }));
ok('...and the handle is not a second stop for a screen reader',
  await pg.evaluate(()=>document.getElementById('tabGrip').getAttribute('aria-hidden')==='true'));

ok('swiping up opens it', (await swipe(70))===true);
ok('...and the tray is actually on screen, not just class-toggled',
  await pg.evaluate(()=>{ const t=document.getElementById('tabMore');
    const r=t.getBoundingClientRect(); return r.height>20 && r.top>=0 && r.bottom<=innerHeight+1; }));
ok('...with every one of the seven options reachable',
  await pg.evaluate(()=>[...document.querySelectorAll('#tabMore .tab')].filter(t=>{
    const r=t.getBoundingClientRect(); return r.width>20 && r.height>20 && r.top>=0 && r.bottom<=innerHeight+1;
  }).length)===7);
ok('...and the handle says it is open', await pg.evaluate(()=>
  getComputedStyle(document.getElementById('tabGrip')).width!=='38px'));

ok('swiping down closes it', (await swipe(-70))===false);
ok('a swipe too small to be decisive does nothing', (await swipe(14))===false);
ok('a swipe down on an already-closed drawer does nothing', (await swipe(-70))===false);

/* The button still works, and the two agree. The pause is the point: a swipe
   arms a short window that swallows the phantom click a phone fires at the end
   of it, and a deliberate press afterwards must land. Half a second is faster
   than any human swipe-then-tap and well past the browser's compat click. */
await pg.waitForTimeout(500);
await pg.evaluate(()=>document.getElementById('moreBtn').click());
await pg.waitForTimeout(150);
ok('the More button still opens it', (await isOpen())===true);
ok('...and reports itself expanded to a screen reader',
  await pg.evaluate(()=>document.getElementById('moreBtn').getAttribute('aria-expanded'))==='true');
ok('swiping down closes what the button opened', (await swipe(-70))===false);
ok('...and the button agrees it is closed',
  await pg.evaluate(()=>document.getElementById('moreBtn').getAttribute('aria-expanded'))==='false');

/* the thing that must not break: tapping the bar */
await pg.evaluate(()=>document.getElementById('moreBtn').click());
await pg.waitForTimeout(150);
await pg.evaluate(()=>document.querySelector('#tabMore .tab[data-view="reflect"]').click());
await pg.waitForTimeout(300);
ok('a plain tap on a drawer option still navigates',
  await pg.evaluate(()=>document.getElementById('view-reflect').classList.contains('on')));

/* a tap that follows a swipe is swallowed once, and only once */
const after = await pg.evaluate(async ()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('home'); await wait(200);
  setMoreOpen(false); await wait(100);
  const el=document.getElementById('tabs'), r=el.getBoundingClientRect();
  const x=r.left+r.width*0.25, y=r.top+8;
  const mk=(type,cx,cy)=>{ const t=new Touch({identifier:1,target:el,clientX:cx,clientY:cy});
    el.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[t],targetTouches:type==='touchend'?[]:[t],
      changedTouches:[t],bubbles:true,cancelable:true})); };
  mk('touchstart',x,y); for(let i=1;i<=6;i++){ mk('touchmove',x,y-70*i/6); await wait(10); } mk('touchend',x,y-70);
  await wait(60);
  /* the click a phone fires after the gesture */
  const opt=document.querySelector('#tabMore .tab[data-view="learn"]');
  opt.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  await wait(250);
  const swallowed=!document.getElementById('view-learn').classList.contains('on');
  /* and the very next real tap must work */
  opt.click(); await wait(250);
  return {swallowed, nextWorks:document.getElementById('view-learn').classList.contains('on')};
});
ok('the tap a phone fires at the end of a swipe does not navigate', after.swallowed===true);
ok('...and the very next real tap does', after.nextWorks===true);

/* The bug the first version had: a swipe that opened nothing left a trap armed,
   and the next tap on the bar - whenever it came - was eaten. */
const stranded = await pg.evaluate(async ()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('home'); setMoreOpen(false); await wait(200);
  const el=document.getElementById('tabs'), r=el.getBoundingClientRect();
  const x=r.left+r.width*0.25, y=r.top+8;
  const mk=(type,cx,cy)=>{ const t=new Touch({identifier:1,target:el,clientX:cx,clientY:cy});
    el.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[t],targetTouches:type==='touchend'?[]:[t],
      changedTouches:[t],bubbles:true,cancelable:true})); };
  /* downward, on a closed drawer: commits nothing at all */
  mk('touchstart',x,y); for(let i=1;i<=6;i++){ mk('touchmove',x,y+70*i/6); await wait(10); } mk('touchend',x,y+70);
  await wait(500);
  document.getElementById('moreBtn').click(); await wait(200);
  return document.getElementById('tabs').classList.contains('more-open');
});
ok('a swipe that opened nothing does not strand a trap for the next tap',
   stranded===true);

/* desktop keeps working with no touch at all */
const dsk=await b.newPage({viewport:{width:1100,height:800}});
await dsk.goto(URL); await dsk.waitForTimeout(500);
await dsk.evaluate(()=>document.getElementById('moreBtn').click());
await dsk.waitForTimeout(150);
ok('with no touch support at all, the button is unaffected',
  await dsk.evaluate(()=>document.getElementById('tabs').classList.contains('more-open')));

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
