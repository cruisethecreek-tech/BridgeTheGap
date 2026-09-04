import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:1100}});
/* This probe pins August dates and asks "how many hours THIS WEEK", so it began
   failing the moment the calendar moved past them - nothing to do with the code
   it tests. Same frozen clock the structure suite uses: a Date subclass, not a
   Proxy, because a Proxy stopped the app booting at all. */
await pg.addInitScript(target => {
  const Real=Date, offset=target-Real.now();
  class Shifted extends Real {
    constructor(...a){ if(a.length===0) super(Real.now()+offset); else super(...a); }
    static now(){ return Real.now()+offset; }
  }
  window.Date=Shifted;
}, new Date('2026-08-30T10:30:00').getTime());
pg.on('pageerror',e=>errs.push(String(e)));
pg.on('dialog',d=>d.accept('Exercise'));
await pg.goto('file://'+process.cwd()+'/app.html');
/* an install from BEFORE this existed: hours logged under the old field name */
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',hourlyWage:30,hoursPerWeek:40,
  categories:[{id:'c1',name:'Food'}],budgets:{'2026-08':{c1:400}},
  accounts:[],transactions:[],goals:[],impulse:[],recurring:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],
  timeLog:[{id:'e1',date:'2026-08-28',kind:'health',hours:2},
           {id:'e2',date:'2026-08-28',kind:'leak',hours:6}],
  debts:[],vault:[],snapshots:[]});
await pg.reload(); await pg.waitForTimeout(850);

const t = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); deckShow('tx','Your week in hours'); renderTimeLog(); await w(500);
  const o={};
  o.cats=timeCats().map(c=>c.id);
  o.hasSleep=!!timeCat('sleep');
  /* the whole point of reusing the old ids: nothing needed migrating */
  o.oldHealth=timeUsed('health'); o.oldLeak=timeUsed('leak');
  o.free=timeFree(); o.planned=timePlannedTotal(); o.unplanned=timeUnplanned();
  o.head=document.querySelector('.time-head').innerText;
  o.targets=document.querySelectorAll('[data-ttarget]').length;
  return o;
});
ok('the week has categories now, sleep among them', t.cats.length>=6 && t.hasSleep===true, JSON.stringify(t.cats));
ok('hours logged before this existed still land in the right lane, with no migration',
  t.oldHealth===2 && t.oldLeak===6, JSON.stringify([t.oldHealth,t.oldLeak]));
ok('the budget is 168 less what is sold to work', t.free===128, String(t.free));
ok('...and it says how much of that is still unplanned',
  t.unplanned===t.free-t.planned && /unplanned/.test(t.head), JSON.stringify([t.free,t.planned,t.unplanned]));
ok('every lane can be aimed at, like a category can be assigned to', t.targets>=6, String(t.targets));

/* subcategories, and the roll-up */
const sub = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  document.querySelector('[data-tsub="health"]').click(); await w(320);
  const kid=timeChildren('health')[0];
  o.made=!!kid; o.name=kid&&kid.name; o.parent=kid&&kid.parentId;
  /* an hour on the child rolls into the parent, exactly like money */
  logTime(kid.id,3); await w(320);
  o.childUsed=timeUsed(kid.id); o.parentUsed=timeUsed('health');
  /* and so does a target */
  const inp=document.querySelector(`[data-ttarget="${kid.id}"]`);
  inp.value='4'; inp.dispatchEvent(new Event('change',{bubbles:true})); await w(360);
  o.childTgt=timeTarget(kid.id); o.parentTgt=timeTarget('health');
  o.indent=!!document.querySelector('.time-row.lvl1');
  return o;
});
ok('a lane can be split into subcategories', sub.made===true && sub.name==='Exercise' && sub.parent==='health',
  JSON.stringify(sub));
ok('...an hour on the sub rolls up into its parent, like money does',
  sub.childUsed===3 && sub.parentUsed===5, JSON.stringify([sub.childUsed,sub.parentUsed]));
ok('...and so does its target', sub.childTgt===4 && sub.parentTgt===9, JSON.stringify([sub.childTgt,sub.parentTgt]));
ok('...and it is drawn underneath, not beside', sub.indent===true);

/* a new top-level lane */
const nw = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  document.getElementById('timeCatNew').value='Church';
  document.getElementById('timeCatAdd').click(); await w(380);
  return {has:timeCats().some(c=>c.name==='Church'), rows:document.querySelectorAll('.time-row').length};
});
ok('a lane the app never thought of can be added', nw.has===true, JSON.stringify(nw));

/* the leak lane reads the other way: its target is a ceiling */
const leak = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const inp=document.querySelector('[data-ttarget="leak"]');
  inp.value='3'; inp.dispatchEvent(new Event('change',{bubbles:true})); await w(360);
  const row=document.querySelector('[data-timerow="leak"]');
  return {txt:row.innerText, over:!!row.querySelector('.tr-h.over')};
});
ok('a cap on screen drift reads as a cap, and 6h against 3h is over it',
  /cap/.test(leak.txt) && leak.over===true, leak.txt);

/* the 168 ceiling still holds */
const cap = await pg.evaluate(async () => {
  const before=timeLoggedTotal();
  logTime('sleep',200);
  return {before, after:timeLoggedTotal()};
});
ok('a week still cannot hold more than 168 hours', cap.after===cap.before, JSON.stringify(cap));

/* removing a lane keeps the hours that were logged against it */
const del = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const kid=timeChildren('health')[0];
  const before=timeUsed('health');
  removeTimeCat(kid.id); renderTimeLog(); await w(320);
  return {before, after:timeUsed('health'), gone:!timeCat(kid.id)};
});
ok('removing a subcategory moves its hours up rather than deleting them',
  del.gone===true && del.after===del.before, JSON.stringify(del));

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
