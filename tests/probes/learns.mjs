/* "It's smart by choosing investing, it's not smart by recognizing my past
   choices such as Acorns vs Stash. Right now I still have to manually choose
   those from the drop down. It's not learning."

   It was not, and two things compounded to make sure of it.

   looksPutAway's word list carries 'acorns', 'stash', 'fidelity', 'vanguard'
   and forty more, and suggestCatFor RETURNED on it - first line, before any of
   the four learning passes ran. So every destination in the household collapsed
   into one generic answer and no correction could ever change it, because the
   correction was never consulted.

   And the pass that did read history only looked at expenses and only read
   t.note. A put-away is neither: it is stored as type 'invest' with its
   description on t.source. The entire class of money being complained about
   was invisible to the code meant to learn from it.

   The generic answer is now the fallback rather than the gate.

   Which exposed a third thing, found by running it: with three Acorns entries
   in the history, "ACH Withdrawal / Betterment deposit" came back as ACORNS -
   it shares "ach", "withdrawal" and "transfer" with them, and that is every
   line a bank prints. Boilerplate scores nothing now. A confidently wrong
   guess is worse than a generic one, and the checks below hold both halves:
   it must learn, and it must refuse to guess when it does not know.

   The second half of the report: "Read it for me is useless if it's not a step
   by step guide to know to push it. Step 1 upload a photo, step 2 read it for
   me, step 3 review entries." It was three buttons in a row with no order
   between them. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:1400}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);
await p.evaluate(()=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify({
  onboarded:true,mindOff:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',
  activeMonth:'2026-09',
  categories:[{id:'ac',name:'Acorns',growth:'invest'},{id:'st',name:'Stash',growth:'invest'},
              {id:'food',name:'Food'},{id:'tak',name:'Takeout',parentId:'food'}],
  budgets:{},
  transactions:[
    /* exactly how the app stores a put-away the owner filed by hand */
    {id:'v1',type:'invest',amount:100,catId:'ac',source:'ACH Withdrawal / Acorns Later Transfer',date:'2026-08-21',ikind:'holds'},
    {id:'v2',type:'invest',amount:7.5,catId:'ac',source:'ACH Withdrawal / Acorns Round-Ups',date:'2026-08-21',ikind:'holds'},
    {id:'v3',type:'invest',amount:50,catId:'st',source:'ACH Withdrawal / Stash Capital',date:'2026-08-22',ikind:'holds'},
    {id:'e1',type:'expense',amount:60,catId:'tak',note:"ARTURO'S PIZZA KITCHEN",date:'2026-08-23'}],
  accounts:[{id:'j',name:'Joint account',kind:'checking',balance:900,updated:'2026-09-11'}],
  assets:[],liabilities:[],goals:[],recurring:[],impulse:[],debts:[],
  diary:[],intake:{},lessons:[],vault:[]})));
await p.reload(); await p.waitForTimeout(1700);

const g=await p.evaluate(()=>{
  const ask=t=>suggestCatFor(t);
  return {
    acornsLater: ask('ACH Withdrawal / Acorns Later Transfer 9000142693 092126'),
    acornsRound: ask('ACH Withdrawal / Acorns Round-Ups 9000142693'),
    stash:       ask('ACH Withdrawal / Stash Capital 8551234'),
    pizza:       ask("ARTURO'S PIZZA KITCHEN 5812 800-9355961"),
    /* a put-away destination it has never been told about, and has no category
       for, must fall back to the generic bucket - not to a neighbour */
    betterment:  ask('ACH Withdrawal / Betterment deposit WEB'),
    vanguard:    ask('Vanguard brokerage transfer'),
    /* and pure plumbing identifies nothing at all */
    plumbing:    ask('ACH Withdrawal WEB 111924683034203'),
    /* the generic answer still exists where it belongs */
    roth:        ask('transfer to my roth ira')
  };
});

/* a correction must stick, and more typing must never undo it */
const sticks=await p.evaluate(async()=>{
  const w=m=>new Promise(r=>setTimeout(r,m));
  activateTab('tx'); await w(900);
  document.getElementById('quickLogBtn').click(); await w(600);
  const row=document.querySelector('#qlList .ql-row');
  const what=row.querySelector('.ql-what'), cat=row.querySelector('.ql-cat');
  what.value='ACH Withdrawal / Acorns Later'; what.dispatchEvent(new Event('input',{bubbles:true}));
  await w(200);
  const guessed=cat.value, marked=cat.classList.contains('guessed');
  cat.value='st'; cat.dispatchEvent(new Event('change',{bubbles:true}));   // the owner disagrees
  await w(150);
  what.value='ACH Withdrawal / Acorns Later Transfer'; what.dispatchEvent(new Event('input',{bubbles:true}));
  await w(250);
  return { guessed, marked, afterCorrection:cat.value, markCleared:!cat.classList.contains('guessed') };
});

/* the three steps */
const steps=await p.evaluate(async()=>{
  const w=m=>new Promise(r=>setTimeout(r,m));
  const read=()=>[...document.querySelectorAll('#qlSteps .qs')]
    .map(l=>({n:l.dataset.qs, cls:[...l.classList].filter(c=>c!=='qs').join(' ')}));
  quickLogOpen=false; renderQuickLog(); await w(200);
  document.getElementById('quickLogBtn').click(); await w(600);
  const o={};
  /* Guarded rather than called bare. Against a build without the steps this
     threw a ReferenceError and the whole probe died with a stack trace instead
     of reporting which claims failed - a test that crashes tells you less than
     one that fails. */
  const mark=()=>{ if(typeof qlStepMark==='function') qlStepMark(); };
  o.exists=!!document.getElementById('qlSteps');
  o.count=document.querySelectorAll('#qlSteps .qs').length;
  o.labels=[...document.querySelectorAll('#qlSteps .qs-t')].map(e=>e.textContent.trim());
  o.onOpen=read();
  /* the read button belongs to step two, not loose in a row of three */
  const rb=document.getElementById('qlRead');
  o.readInStepTwo=!!(rb && rb.closest('.qs') && rb.closest('.qs').dataset.qs==='2');
  o.readHiddenWithNoPhoto=!!rb && rb.classList.contains('hide');
  if(!rb) return o;
  /* a photo lights step two */
  qlPages=[{file:{},url:'data:image/gif;base64,R0lGODlhAQABAAAAACw='}];
  rb.classList.remove('hide'); mark(); await w(200);
  o.afterPhoto=read();
  /* a filled line lights step three */
  const what=document.querySelector('#qlList .ql-what');
  what.value='ACH Withdrawal / Acorns Later'; what.dispatchEvent(new Event('input',{bubbles:true}));
  await w(250);
  o.afterLine=read();
  return o;
});
await b.close();

const at=(rows,n)=>(((rows||[]).find(r=>r.n===String(n))||{}).cls||'');
const T=[
  ['a destination you have filed before comes back as that destination',
   g.acornsLater==='ac' && g.acornsRound==='ac',
   JSON.stringify({later:g.acornsLater, round:g.acornsRound})+' - both were the generic bucket'],
  ['...and the other one comes back as the other one',
   g.stash==='st', g.stash+' - Acorns and Stash were indistinguishable'],
  ['ordinary spending still learns the way it always did',
   g.pizza==='tak', g.pizza],

  ['a place it has never been told about is not filed as a neighbour',
   g.betterment!=='ac' && g.betterment!=='st' && g.vanguard!=='ac' && g.vanguard!=='st',
   JSON.stringify({betterment:g.betterment, vanguard:g.vanguard})],
  ['...it gets the honest generic answer instead',
   g.betterment==='__invest' && g.vanguard==='__invest',
   JSON.stringify({betterment:g.betterment, vanguard:g.vanguard})],
  ['...and the words every bank line carries identify nothing',
   g.plumbing==='', 'ACH WITHDRAWAL WEB 111924683034203 -> "'+g.plumbing+'"'],
  ['money put away with no destination named is still put away',
   g.roth==='__invest', g.roth],

  ['the guess is marked as a guess, not presented as a decision',
   sticks.guessed==='ac' && sticks.marked===true,
   JSON.stringify({guessed:sticks.guessed, marked:sticks.marked})],
  ['...and a correction survives more typing',
   sticks.afterCorrection==='st' && sticks.markCleared===true,
   JSON.stringify(sticks)],

  ['reading a statement is three numbered steps, not three loose buttons',
   steps.exists===true && steps.count===3, JSON.stringify(steps.labels)],
  ['...and "Read it for me" is step two rather than something to discover',
   steps.readInStepTwo===true && steps.readHiddenWithNoPhoto===true,
   JSON.stringify({inTwo:steps.readInStepTwo, hidden:steps.readHiddenWithNoPhoto})],
  ['you start on step one',
   /now/.test(at(steps.onOpen,1)) && /todo/.test(at(steps.onOpen,2)), JSON.stringify(steps.onOpen)],
  ['...a photo ticks it and lights the read',
   /done/.test(at(steps.afterPhoto,1)) && /now/.test(at(steps.afterPhoto,2)),
   JSON.stringify(steps.afterPhoto)],
  ['...and a line on the page moves you to checking them',
   /done/.test(at(steps.afterLine,2)) && /now/.test(at(steps.afterLine,3)),
   JSON.stringify(steps.afterLine)],

  ['nothing threw', errs.length===0, [...new Set(errs)].slice(0,2).join(' | ')],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
process.exit(bad?1:0);
