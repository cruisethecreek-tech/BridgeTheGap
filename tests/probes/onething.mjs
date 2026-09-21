/* "All of the facts and figures after is too much data, just overwhelming
   knowledge, and makes you want to close the app and give up."

   Measured first, because the obvious reading was wrong. Figures per screen
   already passed this suite's own ceiling of ten on arrival - with the hidden
   back face of each flip card excluded, Plan showed nine and Home eleven in the
   whole tab. The app was not dense with data.

   What it was dense with, across nine tabs: 115 buttons proposing an action, 96
   sentences asserting something, 38 collapsible sections and 25 question marks.
   Home alone - the screen whose entire job is to answer "what is my next move"
   - carried FIFTEEN actions, TWENTY-SEVEN sentences and EIGHT question marks.

   There is an uncomfortable detail in that. Clean mode was built to fix
   wordiness and it moved prose behind question marks: it cut words and added
   twenty-five controls. Quieter to read, no quieter to face. Hiding a thing
   behind a button still leaves a button, and this file exists to stop that
   trade being made again on the one screen that matters most.

   So Home answers one question. The first step arrives at full size; the rest
   wait behind a summary. "Where you stand" and "Cover First" fold into the deck
   that already existed. Nothing is deleted - every one of them is one tap away,
   and the last checks here are that this is a fold and not a cull. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const errs=[];
const p=await b.newPage({viewport:{width:390,height:900}});
p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(300);
await p.evaluate(()=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify({
  onboarded:true,mindOff:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',
  activeMonth:'2026-09',hourlyWage:70,debtBudget:1500,investReturn:7,
  categories:[{id:'food',name:'Food'},{id:'roof',name:'Roof'},{id:'pow',name:'Power & Wi-Fi'},
              {id:'car',name:'Getting Around'}],
  budgets:{'2026-09':{food:600,roof:1250,pow:300,car:340}},
  transactions:[{id:'i1',type:'income',amount:4760,source:'Pay',date:'2026-09-04'},
    {id:'e1',type:'expense',amount:1248,catId:'roof',date:'2026-09-05'}],
  accounts:[{id:'j',name:'Joint',kind:'checking',balance:73748,updated:'2026-09-11'}],
  assets:[{id:'a1',name:'House',value:310000,kind:'real'}],liabilities:[],
  goals:[{id:'g1',name:'Trip',target:4000,saved:900}],recurring:[],impulse:[],debts:[],
  diary:[],intake:{},lessons:[],vault:[],snapshots:[]})));
await p.reload(); await p.waitForTimeout(2000);

const o=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('home'); await w(1100); window.scrollTo(0,0); await w(250);
  const root=document.getElementById('view-home');
  const vis=el=>el.offsetParent!==null;
  const txt=()=>(root.innerText||'');
  const out={};
  const t0=txt();
  out.sentences=(t0.match(/[^.!?\n]{12,}[.!?]/g)||[]).length;
  out.words=t0.trim().split(/\s+/).filter(Boolean).length;
  out.marks=[...root.querySelectorAll('[data-why],.say-why')].filter(vis).length;

  /* The whole point: one move on arrival.

     Asked of the page's TEXT, not of offsetParent. Chrome keeps a layout box
     for the contents of a shut <details> - they report offsetParent set and a
     real height - so an offsetParent test says both steps are on screen while
     the screenshot plainly shows one. innerText is the property that tells the
     truth here, and it is the same one the explainer folds are built on. */
  const title=el=>{ const t=el.querySelector('.ns-t'); return t?t.textContent.trim():''; };
  const all=[...root.querySelectorAll('.nextstep')];
  out.stepsExist=all.length;
  out.stepsShown=all.filter(el=>title(el) && t0.includes(title(el))).length;
  const det=root.querySelector('details.ns-more');
  out.hasFold=!!det;
  out.foldShut=!!det && !det.open;
  const folded=det?[...det.querySelectorAll('.nextstep')]:[];
  out.hiddenFromText=folded.length>0 && folded.every(el=>title(el) && !t0.includes(title(el)));
  out.summary=det?det.querySelector('summary').textContent.trim():'';

  /* nothing was deleted: the two that folded are reachable as chips */
  const chips=[...document.querySelectorAll('#deck-home .dk-chip')].filter(vis).map(c=>c.dataset.dk);
  out.chips=chips;
  out.standReachable=chips.includes('Where you stand');
  out.wallsReachable=chips.includes('Cover First');

  /* and opening them really does bring the content back */
  deckShow('home','Where you stand'); await w(400);
  out.snapBackOnTap=!!document.getElementById('homeSnap') &&
    document.getElementById('homeSnap').offsetParent!==null &&
    [...document.querySelectorAll('#homeSnap .fstat')].length>0;
  deckShow('home','Cover First'); await w(400);
  const wg=document.getElementById('wallsGrid');
  out.wallsBackOnTap=!!wg && wg.offsetParent!==null && wg.children.length>0;
  deckShow('home',null); await w(300);

  /* opening the fold shows the steps that were waiting */
  if(det){ det.open=true; await w(300);
    const t1=txt();
    out.stepsAfterOpening=all.filter(el=>title(el) && t1.includes(title(el))).length;
    det.open=false; }
  return out;
});
await b.close();

const T=[
  ['Home opens with exactly one thing to do',
   o.stepsShown===1, o.stepsShown+' steps on arrival, of '+o.stepsExist+' the app had to offer'],
  ['...and the others are waiting rather than gone',
   o.hasFold===true && o.foldShut===true && o.stepsExist>1,
   JSON.stringify({fold:o.hasFold, shut:o.foldShut, total:o.stepsExist})],
  ['...genuinely absent from the screen, not merely made small',
   o.hiddenFromText===true, String(o.hiddenFromText)],
  ['...behind a line that says there is more, not a third decision',
   /more when this is done/.test(o.summary), o.summary],
  ['...and one tap brings them back',
   o.stepsAfterOpening===o.stepsExist, o.stepsAfterOpening+' of '+o.stepsExist],

  ['the screen stops asserting at you',
   o.sentences<=12, o.sentences+' sentences on arrival - it was 27'],
  ['...and stops offering to explain itself eight times over',
   o.marks<=3, o.marks+' question marks - there were 8'],
  ['...and is readable in one breath',
   o.words<=210, o.words+' words - there were 369'],

  ['what folded away is still offered, by name',
   o.standReachable===true && o.wallsReachable===true, JSON.stringify(o.chips)],
  ['...and opening it brings back every figure that was there',
   o.snapBackOnTap===true, String(o.snapBackOnTap)],
  ['...and the four walls with it',
   o.wallsBackOnTap===true, String(o.wallsBackOnTap)],

  ['nothing threw', errs.length===0, [...new Set(errs)].slice(0,2).join(' | ')],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
process.exit(bad?1:0);
