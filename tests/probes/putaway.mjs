/* "Is this a fair assessment? I wasn't given an option to show I'm putting this
   away in investment when I did a bulk upload."

   It was not fair, and the reason is a fix this file already made once and only
   applied to one of the two ways in. qlCatOptions carries the reason in its own
   comment:

     "Every line in here was hard-coded type:'expense', and the only list on
      offer was places money GOES. So a person who moved $145 into savings had
      nowhere to put it - the app would either refuse the entry or record their
      best month as a purchase... which left the whole screen reading as an
      accusation."

   The quick log learned that. commitImport never did. Every outgoing row it
   imported was hard-coded type:'expense', and both of the cards the owner was
   looking at - "You spent more than came in" and "You are on pace to go over" -
   are built on monthExpense. So a month of investing came back as a month of
   overspending, with the arithmetic shown underneath to prove it.

   Nothing here checks that the cards are kind. They are allowed to be harsh;
   the app is called Accountability. What they are not allowed to be is wrong
   about what a number IS. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);

const SEED=()=>({onboarded:true,mindOff:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',
  activeMonth:'2026-09',hourlyWage:70,
  categories:[{id:'c1',name:'Roof'},{id:'c2',name:'Investing',growth:'invest'}],
  budgets:{'2026-09':{c1:5000}},
  transactions:[{id:'i1',type:'income',amount:4760.28,source:'Pay',date:'2026-09-04'}],
  accounts:[],assets:[],liabilities:[],goals:[],recurring:[],impulse:[],debts:[],
  diary:[],intake:{},lessons:[],vault:[]});
const load=async()=>{ await p.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),SEED());
  await p.reload(); await p.waitForTimeout(1600); };

/* the owner's own split: $6,787.68 out, of which $1,470.68 was never spending */
const ROWS=[
  {keep:true,type:'expense',amt:5317.00,date:'2026-09-05',desc:'Rent and the rest',cat:'c1'},
  {keep:true,type:'expense',amt:1000.00,date:'2026-09-06',desc:'Fidelity',cat:'__invest'},
  {keep:true,type:'expense',amt:470.68,date:'2026-09-07',desc:'Acorns',cat:'c2'}];

await load();
const offered=await p.evaluate(async ROWS=>{
  const w=m=>new Promise(x=>setTimeout(x,m));
  activateTab('tx'); await w(600);
  importRows=ROWS.map(r=>({...r}));
  renderImportReview(); await w(400);
  const sels=[...document.querySelectorAll('#importReview select[data-ic]')];
  return { rows:sels.length,
    /* the option the bulk upload never had */
    everyRowOffersIt: sels.length>0 && sels.every(s=>[...s.options].some(o=>o.value==='__invest')),
    label: sels.length?([...sels[0].options].find(o=>o.value==='__invest')||{}).text:'',
    /* and a row already marked keeps its mark through a redraw */
    keepsTheMark: sels.length>1 && sels[1].value==='__invest' };
},ROWS);

const committed=await p.evaluate(async ROWS=>{
  const w=m=>new Promise(x=>setTimeout(x,m));
  importRows=ROWS.map(r=>({...r}));
  commitImport(); await w(500);
  const M='2026-09';
  const t=state.transactions;
  return {
    spent:Math.round(monthExpense(M)*100)/100,
    invested:Math.round(monthInvested(M)*100)/100,
    /* put away is still yours, so net worth has to know */
    netWorth:Math.round(netWorth()*100)/100,
    kinds:t.filter(x=>x.type!=='income').map(x=>x.type).sort().join(','),
    /* the one filed under a category the user marked as investing decided its
       own verb, without being picked twice */
    byCategory:t.some(x=>x.type==='invest' && x.catId==='c2' && Math.abs(x.amount-470.68)<0.005),
    byOption:t.some(x=>x.type==='invest' && Math.abs(x.amount-1000)<0.005),
    msg:(document.getElementById('importReview')||{innerText:''}).innerText.replace(/\s+/g,' ').trim()
  };
},ROWS);

/* what the two cards say once the same money is filed for what it is */
const cards=await p.evaluate(()=>{
  const strip=h=>String(h||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const kept=REPORT_SIGNALS.find(c=>c.k==='kept');
  const r=kept.run();
  return { title:r.t, body:strip(r.body), work:strip(r.work) };
});

/* the same three rows the old way: everything is spending */
const oldWay=await p.evaluate(async ROWS=>{
  const w=m=>new Promise(x=>setTimeout(x,m));
  localStorage.setItem('unfiltered_budget_v2',JSON.stringify({...JSON.parse(localStorage.getItem('unfiltered_budget_v2')),
    transactions:[{id:'i1',type:'income',amount:4760.28,source:'Pay',date:'2026-09-04'}],assets:[]}));
  location.reload();
  return true;
},ROWS);
await p.waitForTimeout(1700);
const asExpense=await p.evaluate(async ROWS=>{
  const w=m=>new Promise(x=>setTimeout(x,m));
  importRows=ROWS.map(r=>({...r, cat:'c1'}));   // all three filed as ordinary spending
  commitImport(); await w(500);
  const strip=h=>String(h||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const r=REPORT_SIGNALS.find(c=>c.k==='kept').run();
  return { spent:Math.round(monthExpense('2026-09')*100)/100, work:strip(r.work), body:strip(r.body) };
},ROWS);

/* a month that goes negative WHILE money is put away says so, because the
   good-month branch always did and the bad-month branch is the one that reads
   as an accusation */
const negative=await p.evaluate(()=>{
  state.transactions=[{id:'i1',type:'income',amount:1000,source:'Pay',date:'2026-09-04'},
                      {id:'e1',type:'expense',amount:1500,catId:'c1',date:'2026-09-05'},
                      {id:'v1',type:'invest',amount:400,source:'Acorns',date:'2026-09-06',ikind:'holds'}];
  const strip=h=>String(h||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const r=REPORT_SIGNALS.find(c=>c.k==='kept').run();
  const out={ title:r.t, body:strip(r.body) };
  /* and a negative month with nothing put away says nothing extra */
  state.transactions=state.transactions.filter(t=>t.type!=='invest');
  out.quiet=strip(REPORT_SIGNALS.find(c=>c.k==='kept').run().body);
  return out;
});

await b.close();

const T=[
  ['every outgoing row in a bulk upload can now be marked as put away',
   offered.everyRowOffersIt===true && offered.rows===3, JSON.stringify(offered)],
  ['...named the same way the quick log names it',
   /Put away/.test(offered.label), offered.label],
  ['...and a row already marked stays marked through a redraw',
   offered.keepsTheMark===true, String(offered.keepsTheMark)],

  ['importing them records put-aways rather than purchases',
   committed.invested===1470.68 && committed.spent===5317, JSON.stringify(committed).slice(0,120)],
  ['...one from the option, one from a category already marked as investing',
   committed.byOption===true && committed.byCategory===true,
   JSON.stringify({opt:committed.byOption, cat:committed.byCategory})],
  ['...and net worth knows, because the money is still yours',
   committed.netWorth===1470.68, String(committed.netWorth)],
  ['...and the confirmation says which part was not spending',
   /put away, not spent/.test(committed.msg) && /1,470\.68/.test(committed.msg),
   committed.msg.slice(0,120)],

  ['the month card is then working from what was actually spent',
   /5,317/.test(cards.work) && !/6,787/.test(cards.work), cards.work],
  ['...the same three rows filed as spending give the harsher figure, as they should',
   asExpense.spent===6787.68 && /6,787/.test(asExpense.work), asExpense.work],
  ['...so the difference between the two readings is the whole of the put-aways',
   Math.abs((asExpense.spent-committed.spent)-1470.68)<0.02,
   JSON.stringify({asExpense:asExpense.spent, committed:committed.spent})],

  ['a negative month names what was put away, which is not part of the gap',
   /put away/.test(negative.body) && /not in the figure above/.test(negative.body),
   negative.body.slice(0,160)],
  ['...and a negative month with nothing put away says nothing extra',
   !/put away/.test(negative.quiet), negative.quiet.slice(0,120)],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
console.log('page errors:', errs.length?[...new Set(errs)].join(' | '):'none');
process.exit(bad?1:0);
