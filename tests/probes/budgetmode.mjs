/* "I think that should be the choice of the user. It should be either or
    depending on their choice. Some users get paid by irregular income, such as
    tips or commission as well."

   Two coherent ways to run a zero-based month, and the second half of that is
   the sharper point: projecting from repeating rules is only honest when
   repeating rules describe the money. For tips or commission there is nothing
   to project FROM, and guessing would tell somebody they have money that may
   never arrive. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const CLOCK = Date.parse('2026-09-04T12:00:00');
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:1200}});
await p.addInitScript(t=>{ const R=Date,d=t-R.now();
  class S extends R{ constructor(...a){ a.length?super(...a):super(R.now()+d); } static now(){ return R.now()+d; } }
  window.Date=S; }, CLOCK);
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);

const BASE={ onboarded:true, activeMonth:'2026-09', uiMode:'all', stageReached:3,
  guidesOff:true, sayMode:'clean',
  categories:[{id:'roof',name:'Roof'},{id:'food',name:'Food'}],
  budgets:{'2026-09':{roof:3200,food:3424.21}},
  opening:{'2026-09':2983.42}, openingFrom:{'2026-09':['a1']},
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:9000,updated:'2026-09-04'}],
  transactions:[], goals:[], impulse:[], assets:[], liabilities:[], diary:[],
  intake:{}, lessons:[], debts:[], vault:[] };
const REGULAR={...BASE, recurring:[{id:'r1',type:'income',source:'Paycheck',
  amount:1230.23, freq:'weekly', anchor:'2026-09-04'}]};
/* tips: money arrives, nothing repeats, and no rule could describe it */
const TIPS={...BASE, recurring:[], transactions:[
  {id:'x1',type:'income',amount:180.55,date:'2026-09-01',source:'Tips'},
  {id:'x2',type:'income',amount:242.10,date:'2026-09-03',source:'Tips'}]};

const load=async st=>{ await p.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),st);
  await p.reload(); await p.waitForTimeout(900); };

await load(REGULAR);
const reg=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const o={M:'2026-09'};
  o.derived=budgetMode(); o.chosen=budgetModeChosen();
  o.monthTotal=monthToBudget(o.M);
  setBudgetMode('have'); await w(400);
  o.haveMode=budgetMode(); o.haveChosen=budgetModeChosen(); o.haveTotal=monthToBudget(o.M);
  activateTab('home'); await w(600);
  o.haveNote=(document.querySelector('.ltb-note')||{innerText:''}).innerText.replace(/\s+/g,' ');
  o.offersMonth=!!document.querySelector('[data-budgetmode="month"]');
  document.querySelector('[data-budgetmode="month"]')?.click(); await w(600);
  o.backTo=budgetMode(); o.backTotal=monthToBudget(o.M);
  o.monthNote=(document.querySelector('.ltb-note')||{innerText:''}).innerText.replace(/\s+/g,' ');
  o.offersHave=!!document.querySelector('[data-budgetmode="have"]');
  return o;
});

await load(TIPS);
const tips=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const o={M:'2026-09'};
  o.derived=budgetMode(); o.rules=hasIncomeRules(); o.ahead=incomeDueRest(o.M);
  o.total=monthToBudget(o.M); o.landed=monthIncome(o.M); o.opening=openingFor(o.M);
  activateTab('home'); await w(700);
  const note=(document.querySelector('.ltb-note')||{innerText:''}).innerText.replace(/\s+/g,' ');
  o.note=note;
  o.saysIrregular=/tips, commission or shifts that vary/i.test(note);
  o.offersSwap=!!document.querySelector('[data-budgetmode]');
  /* forcing 'month' must change nothing at all - there is nothing to project */
  setBudgetMode('month'); await w(400);
  o.forcedTotal=monthToBudget(o.M);
  return o;
});

/* the setting is reachable and honest about being derived vs chosen */
await load(REGULAR);
const set=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('settings'); await w(700);
  const o={};
  const radios=[...document.querySelectorAll('input[name="budgetMode"]')];
  o.count=radios.length;
  o.checked=(radios.find(r=>r.checked)||{}).value||'';
  o.whyDerived=(document.getElementById('budgetModeWhy')||{innerText:''}).innerText.replace(/\s+/g,' ');
  const have=radios.find(r=>r.value==='have');
  have.checked=true; have.dispatchEvent(new Event('change',{bubbles:true})); await w(500);
  o.afterPick=state.budgetMode;
  o.whyChosen=(document.getElementById('budgetModeWhy')||{innerText:''}).innerText.replace(/\s+/g,' ');
  return o;
});
/* a stored choice survives a reload and is not re-derived */
const stuck=await p.evaluate(()=>state.budgetMode);
await p.reload(); await p.waitForTimeout(800);
const afterReload=await p.evaluate(()=>({stored:state.budgetMode, eff:budgetMode(), chosen:budgetModeChosen()}));
await b.close();

const T=[
  ['with repeating income and no choice made, a month counts what is coming',
   reg.derived==='month' && reg.chosen===false, `${reg.derived} chosen=${reg.chosen}`],
  /* 4,213.65 rather than the 2,983.42 carried in, because the rule POSTS the
     paycheck due today and that money has genuinely landed. "Only what I hold"
     means money in hand, not money with no rule attached to it - and 4,213.65
     is the exact figure on the screenshot that started this. */
  ['choosing "only what I hold" drops the projection from the figure itself',
   reg.haveMode==='have' && reg.haveChosen===true && Math.abs(reg.haveTotal-4213.65)<0.02,
   `${reg.haveTotal} vs month ${reg.monthTotal}`],
  ['...and the difference between the modes is exactly the paydays ahead',
   Math.abs((reg.monthTotal-reg.haveTotal)-3690.69)<0.02,
   `${reg.monthTotal} - ${reg.haveTotal}`],
  ['...and the note offers the other mode by name and amount',
   reg.offersMonth===true && /Count the .* still due/i.test(reg.haveNote), reg.haveNote.slice(0,150)],
  ['switching back from the note restores the fuller figure',
   reg.backTo==='month' && reg.backTotal>reg.haveTotal, `${reg.backTotal}`],
  ['...and that mode offers the other one too, so neither is a trap',
   reg.offersHave===true, String(reg.offersHave)],
  ['on tips and commission, with nothing repeating, a month counts what landed',
   tips.derived==='have' && tips.rules===false && tips.ahead.hits===0,
   JSON.stringify({d:tips.derived, rules:tips.rules, ahead:tips.ahead})],
  ['...which is opening plus what actually arrived, and nothing invented',
   Math.abs(tips.total-(2983.42+422.65))<0.02, `${tips.total} = ${tips.opening} + ${tips.landed}`],
  ['...and the app says why rather than leaving them to wonder',
   tips.saysIrregular===true, tips.note.slice(0,180)],
  ['...and asking for the other mode still invents nothing, having nothing to invent',
   Math.abs(tips.forcedTotal-tips.total)<0.02, `${tips.forcedTotal} vs ${tips.total}`],
  ['Settings carries the choice as two real options',
   set.count===2 && set.checked==='month', JSON.stringify({n:set.count, on:set.checked})],
  ['...and admits when it derived rather than was told',
   /Not chosen yet/i.test(set.whyDerived) && /Your choice/i.test(set.whyChosen),
   set.whyDerived.slice(0,110)],
  ['picking there stores it', set.afterPick==='have', String(set.afterPick)],
  ['a chosen mode survives a reload and is never re-derived',
   afterReload.stored==='have' && afterReload.eff==='have' && afterReload.chosen===true,
   JSON.stringify(afterReload)],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
console.log('page errors:', errs.length?[...new Set(errs)].join(' | '):'none');
process.exit(bad?1:0);
