/* "For tracking purposes does it matter who this income came from since it was
   household income? Where from should be either Kristi or Pat as a drop down
   instead of being typable - it can't be linked to anything tangible."

   It matters, in four places, and the sheet was already printing the answer as
   a fact - "Whose: Both of you - outside your true hourly rate" - while giving
   no control to change it. That is why a person reaches for the free-text field
   next to it: it was the only one on the screen that looked like it might say
   who.

   But "Where from" is a PAYER, not a person, and it is load-bearing:
   incomeDueRest decides which payday has already been logged by comparing that
   string against a recurring rule's source. Turning it into a name would break
   every repeat somebody has set up, which is the whole weekly-pay fix. So the
   payer stays typed and gains the list of payers already used, and whose it is
   becomes its own control, named with the names the app already knows. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);

const SEED=(x={})=>({onboarded:true,mindOff:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',
  activeMonth:'2026-09',householdOn:true,nameA:'Pat',nameB:'Kristi',wageB:24.37,
  categories:[{id:'c1',name:'Roof'}],budgets:{},
  transactions:[{id:'t1',type:'income',amount:2436.97,source:'Spouse Salary',date:'2026-09-09',owner:'joint',acctId:'j'},
                {id:'t2',type:'income',amount:4200,source:'ALDI PAYROLL',date:'2026-09-04',acctId:'j'}],
  accounts:[{id:'j',name:'Joint account',kind:'checking',balance:5000,updated:'2026-09-11'}],
  assets:[],liabilities:[],goals:[],
  recurring:[{id:'r1',type:'income',name:'Aldi',source:'ALDI PAYROLL',amount:1050,freq:'weekly',anchor:'2026-09-04'}],
  impulse:[],debts:[],diary:[],intake:{},lessons:[],vault:[],...x});
const load=async st=>{ await p.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),st);
  await p.reload(); await p.waitForTimeout(1600); };

await load(SEED());
const sheet=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(700);
  openTxSheet('t1'); await w(500);
  const own=document.querySelector('#txSheet [data-txedit="owner"]');
  const src=document.querySelector('#txSheet [data-txedit="source"]');
  const list=document.getElementById('txsSrcList');
  return {
    hasWhose:!!own,
    /* the names the app already knew, on the one sheet that never used them */
    labels: own?[...own.options].map(o=>o.text):[],
    showing: own?own.value:null,
    /* the payer stays typed, because a repeat is matched on this string */
    payerTypable: !!src && src.tagName==='INPUT',
    payerSuggestions: list?[...list.options].map(o=>o.value):[],
    /* regression guard: a second function called incomeSourceOptions shadowed
       the one that fills this, and it would have rendered as blank options */
    kinds:[...document.querySelectorAll('#txSheet [data-txedit="srcType"] option')].map(o=>o.text)
  };
});

/* changing it has to change the four things that read it */
const moves=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const own=()=>document.querySelector('#txSheet [data-txedit="owner"]');
  const set=async v=>{ own().value=v; own().dispatchEvent(new Event('change',{bubbles:true})); await w(400); };
  const snap=()=>({ personal:Math.round(personalMonthlyIncome()*100)/100,
                    rate:hourlyFor(state.transactions.find(t=>t.id==='t1').owner||'a') });
  const joint=snap();
  await set('b');  const kristi={...snap(), stored:state.transactions.find(t=>t.id==='t1').owner};
  await set('a');  const t=state.transactions.find(x=>x.id==='t1');
  const pat={...snap(), hasProp:('owner' in t), stored:t.owner};
  await set('joint');
  return { joint, kristi, pat };
});

/* the split on Reflect reads the same field */
const split=await p.evaluate(()=>{
  const before=(()=>{ let a=0,b=0,j=0;
    txnsInMonth('2026-09').filter(t=>t.type==='income').forEach(t=>{const o=t.owner||'a';
      if(o==='b')b+=t.amount; else if(o==='joint')j+=t.amount; else a+=t.amount;});
    return {a:Math.round(a*100)/100,b:Math.round(b*100)/100,j:Math.round(j*100)/100}; })();
  return before;
});

/* and the repeat still finds its payday, which is why the payer stayed a string */
const repeat=await p.evaluate(()=>{
  /* Built from nothing so the rule's own auto-posting cannot blur the result:
     one weekly rule, and one of its future paydays logged by hand. */
  state.transactions=[];
  state.recurring=[{id:'r9',type:'income',name:'Aldi',source:'ALDI PAYROLL',
                    amount:1050,freq:'weekly',anchor:'2026-09-04'}];
  const all=incomeDueRest('2026-09');
  const day=(recOccurrences(state.recurring[0],'2026-09')||[]).filter(d=>d>todayStr())[0];
  state.transactions=[{id:'z1',type:'income',amount:1050,source:'ALDI PAYROLL',date:day}];
  const logged=incomeDueRest('2026-09');
  /* same payday, same rule, different payer written on it */
  state.transactions[0].source='Something else entirely';
  const renamed=incomeDueRest('2026-09');
  return { all:all.hits, logged:logged.hits, renamed:renamed.hits,
           matchesOnSource: logged.hits===all.hits-1 && renamed.hits===all.hits };
});

/* household off: there is no "whose" to answer, so nothing is asked */
await load(SEED({householdOn:false,
  transactions:[{id:'t3',type:'income',amount:900,source:'Paycheck',date:'2026-09-09',acctId:'j'}]}));
const solo=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(700); openTxSheet('t3'); await w(500);
  return { noWhose: !document.querySelector('#txSheet [data-txedit="owner"]'),
           stillHasPayer: !!document.querySelector('#txSheet [data-txedit="source"]') };
});
/* unless a value is already on the row, which must always be fixable */
await load(SEED({householdOn:false,
  transactions:[{id:'t4',type:'income',amount:900,source:'Paycheck',date:'2026-09-09',owner:'joint',acctId:'j'}]}));
const stranded=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(700); openTxSheet('t4'); await w(500);
  return { offered: !!document.querySelector('#txSheet [data-txedit="owner"]') };
});

await b.close();

const T=[
  ['the sheet that reports whose income it is can now change it',
   sheet.hasWhose===true, String(sheet.hasWhose)],
  ['...named with the names the app already knew, not "Mine" and "Partner"',
   sheet.labels.join(',')==='Pat,Kristi,Both of us', JSON.stringify(sheet.labels)],
  ['...showing what the row actually says', sheet.showing==='joint', String(sheet.showing)],
  ['it moves the hourly rate that every hours-of-your-life figure is built on',
   moves.joint.rate!==moves.kristi.rate && moves.kristi.rate===24.37,
   JSON.stringify({joint:moves.joint.rate, kristi:moves.kristi.rate})],
  ['...and the personal income the rate falls back to when no wage is set',
   Math.abs((moves.pat.personal-moves.kristi.personal)-2436.97)<0.02,
   JSON.stringify({k:moves.kristi.personal, p:moves.pat.personal})],
  ['...stored as a value when it is somebody else\'s',
   moves.kristi.stored==='b', String(moves.kristi.stored)],
  ['...and by its absence when it is yours, which is what every reader assumes',
   moves.pat.hasProp===false && moves.pat.stored===undefined, JSON.stringify(moves.pat)],
  ['the household split reads the same field, so it moves too',
   split.j===2436.97 && split.b===0 && split.a>0, JSON.stringify(split)],

  ['where the money came from stays typed, because it is a payer and not a person',
   sheet.payerTypable===true, String(sheet.payerTypable)],
  ['...and that is load-bearing: a repeat finds its payday by matching that string',
   repeat.matchesOnSource===true, JSON.stringify(repeat)],
  ['...but it now offers every payer already used, so it is pick-or-type',
   sheet.payerSuggestions.includes('ALDI PAYROLL') && sheet.payerSuggestions.includes('Spouse Salary'),
   JSON.stringify(sheet.payerSuggestions)],
  ['the Kind list is still the list of kinds, not a second thing wearing its name',
   sheet.kinds.includes('Primary Job') && sheet.kinds.includes('Side Hustle')
     && sheet.kinds.every(k=>k.length>0),
   JSON.stringify(sheet.kinds).slice(0,140)],

  ['nobody running this alone is asked whose it is, because there is no answer',
   solo.noWhose===true && solo.stillHasPayer===true, JSON.stringify(solo)],
  ['...unless a value is already on the row, which must always be fixable',
   stranded.offered===true, String(stranded.offered)],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
console.log('page errors:', errs.length?[...new Set(errs)].join(' | '):'none');
process.exit(bad?1:0);
