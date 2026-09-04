import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:1000}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
/* A paycheck every two weeks, rent on the 1st, a subscription on the 12th,
   and an automatic invest - the shape of an ordinary month. */
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',hourlyWage:30,
  categories:[{id:'rent',name:'Rent'},{id:'subs',name:'Subscriptions'}],
  budgets:{'2026-08':{rent:1400,subs:20}},
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:3000,updated:'2026-08-01'}],
  calConfirm:true,
  transactions:[],goals:[],impulse:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],
  recurring:[
    {id:'r1',type:'income',amount:1476.92,source:'Paycheck',freq:'biweekly',anchor:'2026-08-07',acctId:'a1'},
    {id:'r2',type:'expense',amount:1400,catId:'rent',freq:'monthly',anchor:'2026-08-01',acctId:'a1'},
    {id:'r3',type:'expense',amount:19.99,catId:'subs',freq:'monthly',anchor:'2026-08-12',acctId:'a1'},
    {id:'r4',type:'invest',amount:200,source:'Index fund',freq:'monthly',anchor:'2026-08-15',acctId:'a1',ikind:'holds'},
    {id:'r5',type:'expense',amount:60,catId:'subs',freq:'monthly',anchor:'2026-08-31',acctId:'a1'}],
  vault:[],snapshots:[]});
await pg.reload(); await pg.waitForTimeout(900);

const c = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('budget'); deckShow('budget','The month, laid out'); renderRecurring(); await w(520);
  const o={};
  o.occ=calOccurrences('2026-08').map(x=>x.date+' '+x.label+' '+x.type+(x.landed?' [got]':''));
  o.sums=calMonthSums('2026-08');
  o.cells=document.querySelectorAll('#calGrid .cal-c').length;
  o.padded=document.querySelectorAll('#calGrid .cal-c.pad').length;
  o.withStuff=document.querySelectorAll('#calGrid .cal-c.has').length;
  o.boxes=document.querySelectorAll('#calList input[data-calland]').length;
  o.navText=document.getElementById('calNav').innerText;
  o.listText=document.getElementById('calList').innerText;
  return o;
});
/* Aug 2026 has 31 days and starts on a Saturday. Biweekly from the 7th gives
   the 7th and the 21st. So: 1st rent, 7th pay, 12th sub, 15th invest, 21st pay. */
ok('every occurrence in the month is laid out, on the day it falls',
  c.occ.length===6 && c.occ[0].startsWith('2026-08-01') && c.occ[5].startsWith('2026-08-31'),
  JSON.stringify(c.occ));
ok('...a biweekly paycheck landing twice, not once',
  c.occ.filter(x=>/Paycheck/.test(x)).length===2, JSON.stringify(c.occ));
ok('the grid holds the whole month plus the lead-in days',
  c.cells===31+c.padded && c.padded===6, JSON.stringify([c.cells,c.padded]));
ok('...with a marked day for each date something falls on', c.withStuff===6, String(c.withStuff));
ok('every occurrence gets its own box to tick', c.boxes===6, String(c.boxes));
ok('the month totals both directions, and the net',
  Math.abs(c.sums.inAll-2953.84)<0.01 && Math.abs(c.sums.outAll-1679.99)<0.01,
  JSON.stringify(c.sums));
ok('...and says how many have actually landed', /0 of 6/.test(c.navText), c.navText);
ok('nothing is ticked before anything is logged', c.sums.landed===0);

/* the tick */
const t = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const o={txBefore:state.transactions.length};
  const toasts=[]; const ot=window.toast; window.toast=m=>{toasts.push(m);};
  const cb=document.querySelector('input[data-calland="r2"][data-caldate="2026-08-01"]');
  cb.checked=true; cb.dispatchEvent(new Event('change',{bubbles:true}));
  await w(520);
  o.toast=toasts[0]||'';
  const tx=state.transactions.find(x=>x.recId==='r2');
  o.tx=tx?{type:tx.type,amount:tx.amount,date:tx.date,catId:tx.catId,acctId:tx.acctId,recId:tx.recId}:null;
  o.txAfter=state.transactions.length;
  o.spent=spentFor('rent','2026-08');
  o.stillTicked=document.querySelector('input[data-calland="r2"][data-caldate="2026-08-01"]').checked;
  o.landed=calMonthSums('2026-08').landed;
  /* and off again */
  toasts.length=0;
  const cb2=document.querySelector('input[data-calland="r2"][data-caldate="2026-08-01"]');
  cb2.checked=false; cb2.dispatchEvent(new Event('change',{bubbles:true}));
  await w(520);
  window.toast=ot;
  o.offToast=toasts[0]||'';
  o.txEnd=state.transactions.length;
  o.spentEnd=spentFor('rent','2026-08');
  o.ruleKept=(state.recurring||[]).some(r=>r.id==='r2');
  return o;
});
ok('ticking one writes exactly one entry to the tracker', t.txAfter===t.txBefore+1, JSON.stringify([t.txBefore,t.txAfter]));
ok('...the same shape the scheduler writes, carrying rule, category and account',
  t.tx && t.tx.type==='expense' && t.tx.amount===1400 && t.tx.date==='2026-08-01'
    && t.tx.catId==='rent' && t.tx.acctId==='a1' && t.tx.recId==='r2', JSON.stringify(t.tx));
ok('...so the month spend counts it immediately', t.spent===1400, String(t.spent));
ok('...and the box stays ticked, because it reads the tracker', t.stillTicked===true && t.landed===1);
ok('...saying where it went', /on Track now/.test(t.toast), t.toast);
ok('unticking takes exactly that entry back off', t.txEnd===t.txBefore && t.spentEnd===0,
  JSON.stringify([t.txEnd,t.spentEnd]));
ok('...and never touches the rule', t.ruleKept===true);
ok('...saying so, because a box you can untick is not a delete',
  /repeat rule is untouched/.test(t.offToast), t.offToast);

/* what the scheduler already posted must show as landed - one truth, not two */
const auto = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  /* this half is about the OTHER mode: what the scheduler posts by itself has
     to read as landed, or the calendar keeps a second opinion of the tracker */
  state.transactions=[]; state.calConfirm=false; save();
  const n=postRecurring('2026-08');
  save(); renderRecurring(); await w(500);
  const boxes=[...document.querySelectorAll('#calList input[data-calland]')];
  return {posted:n, ticked:boxes.filter(x=>x.checked).length, total:boxes.length,
          landed:calMonthSums('2026-08').landed};
});
ok('anything the scheduler already posted shows as landed, with no second record',
  auto.ticked===auto.posted && auto.landed===auto.posted && auto.posted>0,
  JSON.stringify(auto));

/* the toggle itself: turning waiting ON must not un-log anything, and turning
   it OFF must catch up rather than leave the month half empty */
const mode = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const had=state.transactions.length;
  const cb=document.getElementById('calConfirm');
  cb.checked=true; cb.dispatchEvent(new Event('change',{bubbles:true})); await w(480);
  const onKept=state.transactions.length;
  state.transactions=[]; save(); renderRecurring(); await w(380);
  const whileOn=postRecurring('2026-08');
  const cb2=document.getElementById('calConfirm');
  cb2.checked=false; cb2.dispatchEvent(new Event('change',{bubbles:true})); await w(520);
  return {had, onKept, whileOn, caughtUp:state.transactions.length, stored:state.calConfirm};
});
ok('turning waiting on never un-logs what is already there', mode.onKept===mode.had, JSON.stringify(mode));
ok('...and stops the scheduler posting anything on its own', mode.whileOn===0, String(mode.whileOn));
ok('turning it back off catches up what was due, rather than leaving a hole',
  mode.caughtUp>0 && mode.stored===false, JSON.stringify(mode));

/* a bill dated in the past and never ticked is a signal, not a bug */
const late = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  state.transactions=[]; state.calConfirm=true; save(); renderRecurring(); await w(450);
  /* Requiring at least one future day in a fixed fixture month is a fact about
     what day it is, not about the calendar code - on the last day of the month
     there is no "still to come" and this went red on its own. The partition is
     the property: a day is set apart if and only if it falls after today. */
  const days=[...document.querySelectorAll('#calList .cal-day')].map(d=>({
    date:d.id.replace('calday-',''), ahead:d.classList.contains('ahead')}));
  return {days, today:todayStr(), note:document.getElementById('calList').innerText};
});
ok('days still to come are marked apart from days already gone',
  late.days.length>0
    && late.days.every(d=>d.ahead===(d.date>late.today))
    && (late.days.some(d=>d.ahead) ? /still to come/.test(late.note) : true)
    && late.days.some(d=>!d.ahead),
  JSON.stringify({today:late.today, days:late.days}));
ok('...and an unticked bill in the past is named as information, not an error',
  /telling you something, not a bug/.test(late.note), late.note.slice(-260));

/* 320px */
await pg.setViewportSize({width:320,height:1000}); await pg.waitForTimeout(320);
const geo = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('budget'); deckShow('budget','The month, laid out'); renderRecurring(); await w(420);
  const doc=document.documentElement;
  const over=[...document.querySelectorAll('#calPanel *')]
    .filter(e=>e.getBoundingClientRect().right>doc.clientWidth+1).map(e=>e.className);
  const cell=document.querySelector('#calGrid .cal-c').getBoundingClientRect();
  return {scrollW:doc.scrollWidth, clientW:doc.clientWidth, over:over.slice(0,4), cellW:Math.round(cell.width)};
});
ok('the calendar fits a 320px phone', geo.scrollW<=geo.clientW && geo.over.length===0, JSON.stringify(geo));
ok('...with cells wide enough to touch', geo.cellW>=32, String(geo.cellW));

/* "I'm not seeing how to plan ahead for future months? What good is a plan if
   you can't see what you are planning for" - the arrows, and what a month that
   has not happened is allowed to claim. */
await pg.setViewportSize({width:390,height:1000}); await pg.waitForTimeout(300);
/* This section was pinned to August and stepped to September to see what a
   month that HAS NOT HAPPENED is allowed to claim. On the 1st of September that
   stopped being a future month, and four checks about planning ahead were
   suddenly asserting things about the month the user is standing in. What the
   section means is "one month forward from wherever now is", so it starts from
   the live month and the yearly rule is anchored two months out rather than to
   a fixed October. */
const ahead = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  state.activeMonth=thisMonth(); state.transactions=[]; state.calConfirm=true;
  const plus=n=>shiftMonth(thisMonth(),n);
  /* a yearly one that only exists two months out, to prove stepping finds it */
  state.recurring.push({id:'r9',type:'expense',amount:340,catId:'subs',freq:'yearly',anchor:plus(2)+'-09',acctId:'a1'});
  save(); activateTab('budget'); deckShow('budget','The month, laid out'); renderRecurring(); await w(500);
  const o={hasArrows:!!document.getElementById('calPrev')&&!!document.getElementById('calNext')};
  o.noBackWhenHere=!document.getElementById('calNow');
  document.getElementById('calNext').click(); await w(560);
  o.month=state.activeMonth;
  o.nav=document.getElementById('calNav').innerText;
  o.boxes=[...document.querySelectorAll('#calList input[data-calland]')];
  o.allDisabled=o.boxes.length>0 && o.boxes.every(b=>b.disabled);
  o.count=o.boxes.length;
  o.note=document.getElementById('calList').innerText;
  o.sums=calMonthSums(state.activeMonth);
  o.hasBack=!!document.getElementById('calNow');
  /* the budget moved with it, not just this panel */
  o.budgetMonth=state.activeMonth;
  /* step on to October and the yearly one is there */
  document.getElementById('calNext').click(); await w(520);
  o.twoOutHasYearly=calOccurrences(state.activeMonth).some(x=>x.r.id==='r9');
  document.getElementById('calNext').click(); await w(520);
  o.oct=state.activeMonth;
  o.octHasYearly=calOccurrences(state.activeMonth).some(x=>x.r.id==='r9');
  o.now=thisMonth(); o.next=plus(1); o.twoOut=plus(2); o.threeOut=plus(3);
  /* and back */
  document.getElementById('calNow').click(); await w(520);
  o.backHome=state.activeMonth;
  delete o.boxes;
  return o;
});
ok('the calendar carries its own month arrows', ahead.hasArrows===true);
ok('...with no "back to this month" while you are already on it', ahead.noBackWhenHere===true);
ok('stepping forward moves the whole Plan tab, not just this panel',
  ahead.month===ahead.next && ahead.budgetMonth===ahead.next, JSON.stringify([ahead.month,ahead.next]));
ok('...and a month that has not happened is labelled as planned, not counted as landed',
  /planned/i.test(ahead.nav) && /set up to bring/.test(ahead.nav) && ahead.sums.landed===0, ahead.nav);
ok('...with every box unticked and unavailable, because none of it has happened',
  ahead.count>0 && ahead.allDisabled===true, JSON.stringify([ahead.count,ahead.allDisabled]));
ok('...and the note says why rather than leaving dead boxes unexplained',
  /Nothing here can be ticked yet/.test(ahead.note), ahead.note.slice(-300));
ok('a yearly repeat is found by stepping to the month it actually falls in',
  ahead.oct===ahead.threeOut && ahead.octHasYearly===false, JSON.stringify([ahead.oct,ahead.threeOut,ahead.octHasYearly]));
ok('...and is there in the month it belongs to, not the ones around it',
  ahead.twoOutHasYearly===true, JSON.stringify([ahead.twoOut,ahead.twoOutHasYearly]));
ok('"back to this month" returns you to the month you are actually in',
  ahead.backHome===ahead.now, `${ahead.backHome} vs ${ahead.now}`);

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
