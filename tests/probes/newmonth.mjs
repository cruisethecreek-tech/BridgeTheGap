/* "They told me to log my income but it didn't give me an opportunity to choose
   one of my already existing recurring payments... and it also didn't move any
   of my bank balance over that I already had accumulated from last month to
   cover these bills." The 1st of a month, rent due before payday. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:1200}});
pg.on('pageerror',e=>errs.push(String(e)));
/* frozen to the 1st, which is the whole shape of the report */
const CLOCK=new Date('2026-09-01T09:00:00').getTime();
await pg.addInitScript(t=>{ const R=Date, d=t-R.now();
  class S extends R{ constructor(...a){ if(!a.length) super(R.now()+d); else super(...a); }
    static now(){ return R.now()+d; } }
  window.Date=S;
}, CLOCK);
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(()=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-09',hourlyWage:30,
  categories:[{id:'rent',name:'Rent'},{id:'food',name:'Food'}],
  budgets:{'2026-08':{rent:1400,food:600},'2026-09':{rent:1400,food:600}},
  /* last month's wages, still sitting there */
  accounts:[{id:'a1',name:'Chequing',kind:'checking',balance:2600,updated:'2026-08-30'}],
  /* the paycheck rule he already set up - next one lands on the 4th */
  recurring:[{id:'p',type:'income',amount:1476.92,source:'Paycheck',freq:'biweekly',anchor:'2026-09-04',acctId:'a1'}],
  transactions:[],goals:[],impulse:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],
  debts:[],vault:[],snapshots:[],scans:[],opening:{}})));
await pg.reload(); await pg.waitForTimeout(950);

/* ---- 1. the shape he actually saw ---- */
const before = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('budget'); await w(600);
  return { today:todayStr(), month:state.activeMonth,
    income:monthIncome(state.activeMonth), toBudget:monthToBudget(state.activeMonth),
    bank:bankTotal(), suggestion:openingSuggestion(state.activeMonth),
    note:(document.getElementById('lifeKeyPlan')||{innerText:''}).innerText.replace(/\s+/g,' '),
    hasOffer:!!document.querySelector('#view-budget [data-carryin]') };
});
ok('the month opens before payday, with last month money still in the account',
   before.today==='2026-09-01' && before.income===0 && before.bank===2600, JSON.stringify(before.bank));
ok('...and the app no longer just says "log a paycheck" at it',
   /money you already have/i.test(before.note), before.note.slice(0,220));
ok('...it names what is actually sitting there', before.suggestion===2600 && /\$2,600/.test(before.note),
   String(before.suggestion));
ok('...and offers to put it to work', before.hasOffer===true);

/* ---- 2. carrying it in funds the plan without inventing income ---- */
const after = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const M=state.activeMonth;
  const keptBefore={inc:monthIncome(M)};
  /* The button opens a picker now rather than committing every account at once -
     "I don't want to add the full 83706 but I should be able to carry certain
     accounts". One chequing account here, so it is ticked and the total is the
     same; the extra tap is the point of the change. */
  const btn=document.querySelector('#view-budget [data-carryin]');
  btn.click(); await w(400);
  const box=btn.parentElement.querySelector('.carrypick');
  box.querySelector('[data-carrygo]').click(); await w(600);
  return { opening:openingFor(M), toBudget:monthToBudget(M), income:monthIncome(M),
    incomeUnmoved:monthIncome(M)===keptBefore.inc,
    note:(document.getElementById('lifeKeyPlan')||{innerText:''}).innerText.replace(/\s+/g,' '),
    ltbClass:(document.querySelector('#summary .stat.ltb')||{className:''}).className,
    canClear:!!document.querySelector('#view-budget [data-carryclear]') };
});
ok('carrying it in funds the plan', after.opening===2600 && after.toBudget===2600, JSON.stringify([after.opening,after.toBudget]));
/* the line that matters: this is money he HAD, not money he earned */
ok('...without counting as income earned this month', after.income===0 && after.incomeUnmoved===true,
   String(after.income));
ok('...and the note shows both halves rather than one figure standing for two',
   /Already in the account/.test(after.note) && /logged this month/.test(after.note)
     && /to budget/.test(after.note), after.note.slice(0,200));
ok('...with a way to take it back if it was wrong', after.canClear===true);

/* the whole point: 2,600 in, 2,000 assigned, so 600 is genuinely spare */
const spare = await pg.evaluate(() => {
  const M=state.activeMonth;
  return { ltb:monthToBudget(M)-topCats().reduce((s,c)=>s+catAssigned(c.id,M),0),
           note:(document.getElementById('lifeKeyPlan')||{innerText:''}).innerText.replace(/\s+/g,' ') };
});
ok('the plan stops reading as minus two thousand dollars',
   Math.abs(spare.ltb-600)<0.005 && !/-\$2,000/.test(spare.note), String(spare.ltb));

/* ---- 3. clearing it puts the figure back where it was ---- */
const cleared = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  document.querySelector('[data-carryclear]').click(); await w(500);
  return { opening:openingFor(state.activeMonth), toBudget:monthToBudget(state.activeMonth) };
});
ok('clearing it is honest too - the plan goes back to unfunded',
   cleared.opening===0 && cleared.toBudget===0, JSON.stringify(cleared));

/* ---- 4. logging income offers the rule he already set up ---- */
const rec = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(600);
  const o={ onExpense:(document.getElementById('recFill')||{innerHTML:''}).innerHTML.trim() };
  document.querySelector('#typeToggle button[data-t="income"]').click(); await w(400);
  const box=document.getElementById('recFill');
  o.chips=[...box.querySelectorAll('[data-recfill]')].map(c=>c.innerText.replace(/\s+/g,' '));
  o.says=box.innerText.replace(/\s+/g,' ');
  if(o.chips.length){ box.querySelector('[data-recfill]').click(); await w(400); }
  o.amt=(document.getElementById('txAmt')||{}).value;
  o.date=(document.getElementById('txDate')||{}).value;
  o.src=(document.getElementById('txSrc')||{}).value;
  /* and logging it must not be offered twice */
  document.getElementById('addTx').click(); await w(500);
  o.logged=state.transactions.length;
  o.stillOffered=document.querySelectorAll('#recFill [data-recfill]').length;
  o.leftAfter=[...document.querySelectorAll('#recFill [data-recfill]')].map(c=>c.innerText.replace(/\s+/g,' ')).join(' | ');
  o.incomeNow=monthIncome(state.activeMonth);
  o.linked=(state.transactions[0]||{}).recId;
  o.calLanded=(typeof calMonthSums==='function') ? calMonthSums(state.activeMonth).landed : null;
  return o;
});
ok('the form says nothing about repeats while you are logging an expense', rec.onExpense==='');
/* biweekly means TWO paydays in September, and both are genuinely unlanded */
ok('switching to income offers the rule you already set up',
   rec.chips.length===2 && rec.chips.every(c=>/Paycheck/.test(c) && /1,476\.92/.test(c)),
   JSON.stringify(rec.chips));
ok('...dated the day it is actually due, not today',
   /Sep 4/.test(rec.chips[0]), rec.chips[0]);
ok('...and says plainly that nothing is logged until you press the button',
   /Nothing is logged until you press/.test(rec.says), rec.says.slice(-120));
ok('tapping it fills the form from the rule',
   rec.amt==='1476.92' && rec.date==='2026-09-04' && rec.src==='Paycheck',
   JSON.stringify([rec.amt,rec.date,rec.src]));
/* the one that landed drops off; the one still to come does not - offering a
   paid occurrence again is how a month gets paid twice */
ok('...the one you just logged drops off, and the next one does not',
   rec.logged===1 && rec.stillOffered===1 && rec.incomeNow===1476.92
     && /Sep 18/.test(rec.leftAfter||''),
   JSON.stringify([rec.logged,rec.stillOffered,rec.leftAfter]));
/* and the entry is tied to the rule, so the calendar agrees with the ledger */
ok('...because the entry is linked to the rule, not just a copy of its numbers',
   rec.linked==="p" && rec.calLanded===1, JSON.stringify([rec.linked,rec.calLanded]));

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
