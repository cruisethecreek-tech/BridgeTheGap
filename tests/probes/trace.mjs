/* Four rounds into "the keypad disappears", and three of the fixes were aimed
   at causes inferred from screenshots. The last recording killed the remaining
   theory: at 3.20s the keypad is gone and the cursor is still in the field.
   Something dismisses the keyboard WITHOUT the box losing focus - a
   device-level event. Nothing in this repository can see it, and no probe here
   has an IME to close.

   So this checks an instrument rather than a fix. The claims it makes are the
   ones that decide whether the instrument is worth anything:

     it is silent until switched on, and costs nothing while off,
     it records the events that could actually be responsible,
     it notices the one thing an event log would otherwise miss - the focused
       box being taken out of the page by a render,
     and it never touches the vault, because a diagnostic that syncs itself to
       a partner's phone is a new bug rather than a tool. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);
await p.evaluate(()=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify({
  onboarded:true,mindOff:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',
  activeMonth:'2026-09',
  categories:[{id:'shop',name:'Online shopping'},{id:'amz',name:'Amazon orders',parentId:'shop'}],
  budgets:{'2026-09':{amz:41.41}},
  transactions:[{id:'i1',type:'income',amount:4760,source:'Pay',date:'2026-09-04'}],
  accounts:[],assets:[],liabilities:[],goals:[],recurring:[],impulse:[],debts:[],
  diary:[],intake:{},lessons:[],vault:[]})));
await p.reload(); await p.waitForTimeout(1600);

const off=await p.evaluate(async()=>{
  const w=m=>new Promise(x=>setTimeout(x,m));
  activateTab('budget'); await w(1000);
  const inp=document.querySelector('#cats input[data-cat="amz"]');
  inp.focus(); inp.blur(); window.dispatchEvent(new Event('resize'));
  renderAll(); await w(300);
  return { on:traceOn, lines:traceLog.length,
           /* a stored vault must never carry it */
           inState:JSON.stringify(state).indexOf('traceLog')>=0
                 || JSON.stringify(state).indexOf('traceOn')>=0 };
});

const on=await p.evaluate(async()=>{
  const w=m=>new Promise(x=>setTimeout(x,m));
  traceStart(); await w(100);
  const o={};
  const inp=document.querySelector('#cats input[data-cat="amz"]');
  inp.focus(); await w(60);
  /* It names the full path - "Online shopping > Amazon orders" - which is more
     use in a report than the leaf alone, so the claim is that it names the
     category, not that it names it a particular way. */
  o.sawFocus=traceLog.some(l=>/focus arrived at the amount box for .*Amazon orders/.test(l));
  window.dispatchEvent(new Event('resize')); await w(60);
  o.sawResize=traceLog.some(l=>/the page was resized/.test(l) && /window \d+x\d+/.test(l));
  window.dispatchEvent(new Event('blur')); await w(60);
  o.sawWindowBlur=traceLog.some(l=>/the WINDOW lost focus/.test(l));
  document.dispatchEvent(new Event('visibilitychange')); await w(60);
  o.sawVisibility=traceLog.some(l=>/the page came back|the page was HIDDEN/.test(l));

  /* the one an event log misses: the box taken out from under the cursor */
  document.querySelector('#cats input[data-cat="amz"]').focus(); await w(60);
  renderBudget(); await w(200);
  o.sawTheBoxRemoved=traceLog.some(l=>/the box that had the cursor was REMOVED/.test(l));
  o.sawTheRedraw=traceLog.some(l=>/the app redrew: renderBudget/.test(l));

  /* every line is timestamped, so a cause and its effect can be ordered */
  o.timestamped=traceLog.every(l=>/^\s*\d+\.\d\ds\s/.test(l));
  o.text=traceText();
  traceStop();
  o.stopped=traceOn===false;
  o.keptWhatItRecorded=traceLog.length>0;
  return o;
});

const ui=await p.evaluate(async()=>{
  const w=m=>new Promise(x=>setTimeout(x,m));
  activateTab('settings'); deckShow('settings','Which version is this'); await w(600);
  const box=document.getElementById('tracePanel');
  return { there:!!box, visible:!!(box&&box.offsetParent),
           hasCopy:!!document.getElementById('traceCopy'),
           text:(box||{innerText:''}).innerText.replace(/\s+/g,' ').slice(0,200) };
});

/* the box with the cursor in it looks like the box with the cursor in it */
const ring=await p.evaluate(async()=>{
  const w=m=>new Promise(x=>setTimeout(x,m));
  activateTab('budget'); await w(900);
  const inp=document.querySelector('#cats input[data-cat="amz"]');
  const plain=getComputedStyle(inp).outlineWidth;
  inp.focus(); await w(120);
  const s=getComputedStyle(inp);
  return { plain, focused:s.outlineWidth, style:s.outlineStyle };
});

await b.close();

const T=[
  ['it is silent until it is switched on',
   off.on===false && off.lines===0, JSON.stringify(off)],
  ['...and a stored vault never carries it, so it cannot reach a partner\'s phone',
   off.inState===false, String(off.inState)],

  ['it records focus arriving, and says which box in plain words',
   on.sawFocus===true, String(on.sawFocus)],
  ['...the page being resized, which is what a keyboard does to it',
   on.sawResize===true, String(on.sawResize)],
  ['...the window losing focus to something outside the page',
   on.sawWindowBlur===true, String(on.sawWindowBlur)],
  ['...and the page being hidden or coming back',
   on.sawVisibility===true, String(on.sawVisibility)],
  ['it notices the box being taken out from under the cursor by a redraw',
   on.sawTheBoxRemoved===true, String(on.sawTheBoxRemoved)],
  ['...and names the redraw that did it, so the two can be put in order',
   on.sawTheRedraw===true && on.timestamped===true,
   JSON.stringify({redraw:on.sawTheRedraw, stamped:on.timestamped})],
  ['what gets copied out carries the build and the phone, not just the lines',
   /ACCOUNTABILITY trace/.test(on.text) && /\d{4}-\d{2}-\d{2}/.test(on.text)
     && on.text.split('\n').length>4, on.text.split('\n').slice(0,3).join(' | ')],
  ['stopping stops it, and keeps what it already recorded',
   on.stopped===true && on.keptWhatItRecorded===true,
   JSON.stringify({stopped:on.stopped, kept:on.keptWhatItRecorded})],

  ['it is reachable without a console, next to the build it belongs to',
   ui.there===true && ui.visible===true && ui.hasCopy===true, JSON.stringify(ui).slice(0,160)],

  ['the box with the cursor in it is visibly the box with the cursor in it',
   ring.plain==='0px' && parseFloat(ring.focused)>=2 && ring.style!=='none',
   JSON.stringify(ring)],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
console.log('page errors:', errs.length?[...new Set(errs)].join(' | '):'none');
process.exit(bad?1:0);
