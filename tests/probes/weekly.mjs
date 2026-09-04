/* The reported case, in the reporter's own numbers.
   "Should I be budgeting from paycheck to paycheck? It's zero based budgeting,
    why am I getting penalized for a month's budget when I'm only getting paid
    weekly??"

   On the 4th of September, paid weekly: $2,983.42 carried in, $1,230.23 landed,
   $6,624.21 assigned, and Home reading -$2,410.56 in red. Nothing in those four
   figures is wrong. The comparison is: money that has ARRIVED against a plan
   for a WHOLE MONTH, which for anyone not paid monthly in advance reads broken
   for twenty-odd days out of thirty and only comes true on the last payday. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const CLOCK = Date.parse('2026-09-04T12:00:00');
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:1100}});
await p.addInitScript(target=>{
  const Real=Date, offset=target-Real.now();
  class Shifted extends Real {
    constructor(...a){ if(a.length===0) super(Real.now()+offset); else super(...a); }
    static now(){ return Real.now()+offset; }
  }
  window.Date=Shifted;
}, CLOCK);
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);

/* Weekly pay anchored to Friday Sept 4. Occurrences: 4, 11, 18, 25.
   The 4th is today and is the one already logged, so three are still to come. */
const SEED={ onboarded:true, activeMonth:'2026-09', uiMode:'all', stageReached:3,
  guidesOff:true, sayMode:'clean',
  categories:[{id:'roof',name:'Roof'},{id:'food',name:'Food'},{id:'save',name:'Save'}],
  budgets:{'2026-09':{roof:3200,food:1424.21,save:2000}},          // 6,624.21 assigned
  openingFrom:{'2026-09':['a1']},
  opening:{'2026-09':2983.42},
  recurring:[{id:'r1',type:'income',source:'Paycheck',amount:1230.23,freq:'weekly',anchor:'2026-09-04'}],
  /* No hand-typed paycheck here. The app posts what its own rules say is due,
     so seeding one as well produced two on the same day - which is the exact
     double-entry the app warns about elsewhere ("a paycheck entered by hand
     that a recurring rule also posted"). The fixture was making the fault it
     then reported. The rule posts the 4th on its own. */
  transactions:[],
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:69767.88,updated:'2026-09-04'},
            {id:'c1',name:'Visa',kind:'credit',balance:-2148.94,limit:9000,updated:'2026-09-04'}],
  assets:[{id:'as1',name:'Brokerage',value:507.20,kind:'real'}],
  liabilities:[], goals:[], impulse:[], diary:[], intake:{}, lessons:[], debts:[], vault:[] };
await p.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),SEED);
await p.reload(); await p.waitForTimeout(1000);

const o=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const out={};
  out.today=todayStr();
  const M='2026-09';
  out.due=incomeDueRest(M);
  out.landed=monthIncome(M);
  out.opening=openingFor(M);
  out.toBudget=monthToBudget(M);
  out.assigned=topCats().reduce((s,c)=>s+catAssigned(c.id,M),0);
  out.ltb=Math.round((out.toBudget-out.assigned)*100)/100;
  /* net worth, the app's one definition against what Home actually prints */
  out.netWorthFn=Math.round(netWorth()*100)/100;
  out.bank=Math.round(bankTotal()*100)/100;
  activateTab('home'); await w(800);
  const tile=[...document.querySelectorAll('#homeSnap .stat, #homeSnap [class*=stat]')]
    .map(x=>x.innerText.replace(/\s+/g,' ').trim());
  out.nwTile=tile.find(t=>/Net worth/i.test(t))||'';
  out.ltbTile=tile.find(t=>/Left to budget/i.test(t))||'';
  out.note=(document.querySelector('.ltb-note')||{}).innerText||'';
  return out;
});

/* A future occurrence that HAS been logged must not be counted twice. */
const dbl=await p.evaluate(async()=>{
  state.transactions.push({id:'t2',type:'income',amount:1230.23,date:'2026-09-11',
                           source:'Paycheck',srcType:'primary'});
  save();
  return { due:incomeDueRest('2026-09'), landed:monthIncome('2026-09'),
           toBudget:monthToBudget('2026-09') };
});
/* A month already finished has nothing still to come. */
const past=await p.evaluate(()=>incomeDueRest('2026-08'));
/* A month not started yet counts all of its paydays. */
const future=await p.evaluate(()=>incomeDueRest('2026-10'));
await b.close();

const T=[
  ['the clock is where the report was made', o.today==='2026-09-04', o.today],
  ['the three paydays still to come this month are counted, and only those',
   o.due.hits===3 && Math.abs(o.due.total-3690.69)<0.01, JSON.stringify(o.due)],
  ['...and today’s paycheck is not counted twice, having already landed',
   Math.abs(o.landed-1230.23)<0.01, String(o.landed)],
  ['the month now has what was carried in, what landed, and what is coming',
   Math.abs(o.toBudget-(2983.42+1230.23+3690.69))<0.02,
   `${o.toBudget} = ${o.opening} carried + ${o.landed} landed + ${o.due.total} coming`],
  ['a monthly plan on weekly pay stops reading as broken',
   o.ltb>0, `left to budget ${o.ltb} against ${o.assigned} assigned`],
  ['...and the tile is no longer the red penalty it was',
   !/-\$/.test(o.ltbTile), o.ltbTile.replace(/\n/g,' ')],
  ['the note names all three parts rather than handing over a total',
   /Already in the account/.test(o.note) && /still due this month/.test(o.note)
     && /3 more paydays/.test(o.note), o.note.slice(0,200)],
  ['a paycheck logged ahead of its date is not counted twice',
   dbl.due.hits===2 && Math.abs(dbl.toBudget-o.toBudget)<0.02,
   JSON.stringify({due:dbl.due, landed:dbl.landed, toBudget:dbl.toBudget})],
  ['a month already over has nothing still to come', past.hits===0, JSON.stringify(past)],
  ['a month not yet begun counts every payday in it', future.hits>=4, JSON.stringify(future)],
  ['Home’s net worth is the app’s one definition of the phrase',
   Math.abs(o.netWorthFn-(69767.88-2148.94+507.20))<0.02, String(o.netWorthFn)],
  ['...and the tile prints that, with the bank in it',
   /\$68,126\.14/.test(o.nwTile),
   o.nwTile.replace(/\n/g,' ')],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
console.log('page errors:', errs.length?[...new Set(errs)].join(' | '):'none');
process.exit(bad?1:0);
