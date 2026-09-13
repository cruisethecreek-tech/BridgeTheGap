/* "Why is Kristi zero if she's contributed 2 paychecks?"

   Nothing was miscalculated. Her two paychecks were posted by a repeat set to
   "Both of us", so they landed as Joint - and Joint is out of the ratio by
   definition, because money belonging to both of you cannot say which of you
   earns more.

   What was wrong is that it left silently. $2,436.97, more than half the
   household's income, sat in a box on screen labelled "shared" while the panel
   directly beneath it printed "Pat covers $4,080.32 - 100%" and "Kristi covers
   $0 - 0%". A reader has no way to connect those two facts, and the only
   available conclusion is that the app is broken.

   That is the fourth time in this file a caption has asserted something the
   arithmetic under it could not support. It is the first time it has done so
   attached to a recommendation somebody could act on: the panel was telling one
   person to cover every dollar of the household's essentials, on a denominator
   missing half the household's income.

   So the numbers stay as they are - they are right - and the screen stops
   claiming to be the whole picture when it is not. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);

const SEED=(tx)=>({onboarded:true,mindOff:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',
  activeMonth:'2026-09',householdOn:true,nameA:'Pat',nameB:'Kristi',wageB:34,hourlyWage:70.08,
  categories:[{id:'c1',name:'Roof'}],budgets:{'2026-09':{c1:4080.32}},transactions:tx,
  accounts:[{id:'j',name:'Joint',kind:'checking',balance:5000,updated:'2026-09-11'}],
  assets:[],liabilities:[],goals:[],recurring:[],impulse:[],debts:[],diary:[],intake:{},lessons:[],vault:[]});
const load=async tx=>{ await p.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),SEED(tx));
  await p.reload(); await p.waitForTimeout(1600); };
const read=async()=>p.evaluate(()=>{
  const el=document.querySelector('.household');
  const t=el?el.innerText.replace(/\s+/g,' '):'';
  const inc=incomeByOwner(state.activeMonth);
  return { t, inc:{a:Math.round(inc.a*100)/100,b:Math.round(inc.b*100)/100,
                   j:Math.round(inc.j*100)/100,total:Math.round(inc.total*100)/100},
    explainsZero:/reads \$0 because none of this month's income is marked as theirs/.test(t),
    namesTheJoint:/\$2,436\.97 above is marked Joint/.test(t),
    pointsAtFix:/set <?b?>?Whose|set Whose/.test(t) && /repeat that posts it/.test(t),
    qualified:/from part of the picture/.test(t),
    saysHowMuchIsOut:/is marked Joint, so these percentages describe only/.test(t),
    saysNotAPlan:/Treat them as incomplete rather than as a plan/.test(t),
    claimsWhatEachEarns:/Proportional to what each of you earns/.test(t),
    partialMark: !!document.querySelector('.hh-fair.partial') };
});

/* the reported case, to the cent */
await load([{id:'t1',type:'income',amount:2323.31,source:'Pay',date:'2026-09-09',acctId:'j'},
            {id:'t2',type:'income',amount:1218.49,source:'Spouse Salary',date:'2026-09-05',owner:'joint',acctId:'j'},
            {id:'t3',type:'income',amount:1218.48,source:'Spouse Salary',date:'2026-09-12',owner:'joint',acctId:'j'}]);
const reported=await read();

/* the same money, tagged to the person who actually earned it */
await load([{id:'t1',type:'income',amount:2323.31,source:'Pay',date:'2026-09-09',acctId:'j'},
            {id:'t2',type:'income',amount:1218.49,source:'Spouse Salary',date:'2026-09-05',owner:'b',acctId:'j'},
            {id:'t3',type:'income',amount:1218.48,source:'Spouse Salary',date:'2026-09-12',owner:'b',acctId:'j'}]);
const fixed=await read();
const fixedPct=await p.evaluate(()=>{
  const inc=incomeByOwner(state.activeMonth), base=inc.a+inc.b;
  return { a:Math.round(inc.a/base*100), b:Math.round(inc.b/base*100) };
});

/* nobody without joint income is shown any of it */
await load([{id:'t1',type:'income',amount:3000,source:'Pay',date:'2026-09-09',acctId:'j'},
            {id:'t2',type:'income',amount:2000,source:'Her pay',date:'2026-09-05',owner:'b',acctId:'j'}]);
const clean=await read();

/* a small joint amount is not enough to disown the split, but a person still
   reading zero is always owed the reason */
await load([{id:'t1',type:'income',amount:3000,source:'Pay',date:'2026-09-09',acctId:'j'},
            {id:'t2',type:'income',amount:100,source:'Rebate',date:'2026-09-05',owner:'joint',acctId:'j'}]);
const small=await read();

/* joint only, nobody attributed: the ratio has nothing to divide */
await load([{id:'t1',type:'income',amount:4000,source:'Ours',date:'2026-09-09',owner:'joint',acctId:'j'}]);
const allJoint=await read();

await b.close();

const T=[
  ['the reported figures are reproduced exactly, and they were never wrong',
   reported.inc.a===2323.31 && reported.inc.b===0 && reported.inc.j===2436.97
     && reported.inc.total===4760.28, JSON.stringify(reported.inc)],
  ['the zero now says why it is a zero, by name',
   reported.explainsZero===true && /Kristi reads/.test(reported.t), String(reported.explainsZero)],
  ['...naming the money that is sitting outside the split',
   reported.namesTheJoint===true, String(reported.namesTheJoint)],
  ['...and where to go to fix it, including the repeat that will do it again',
   reported.pointsAtFix===true, String(reported.pointsAtFix)],
  ['the recommendation stops calling itself the fair split of the whole picture',
   reported.qualified===true && reported.partialMark===true,
   JSON.stringify({q:reported.qualified,m:reported.partialMark})],
  ['...says how much is missing from it, against the total',
   reported.saysHowMuchIsOut===true, String(reported.saysHowMuchIsOut)],
  ['...and says plainly it is not a plan',
   reported.saysNotAPlan===true, String(reported.saysNotAPlan)],
  ['...and no longer claims to be proportional to what each of you earns',
   reported.claimsWhatEachEarns===false, String(reported.claimsWhatEachEarns)],

  ['tagging the same money to the person who earned it clears every caveat',
   fixed.explainsZero===false && fixed.qualified===false && fixed.partialMark===false,
   JSON.stringify({z:fixed.explainsZero,q:fixed.qualified,m:fixed.partialMark})],
  ['...and the split becomes the real one rather than 100 to nothing',
   fixedPct.a===49 && fixedPct.b===51, JSON.stringify(fixedPct)],
  ['...saying again what it is proportional to, because now it is true',
   fixed.claimsWhatEachEarns===true, String(fixed.claimsWhatEachEarns)],

  ['a household with no joint income is shown none of this',
   clean.explainsZero===false && clean.qualified===false && clean.claimsWhatEachEarns===true,
   JSON.stringify({z:clean.explainsZero,q:clean.qualified})],
  ['a small joint amount does not disown the split',
   small.qualified===false && small.partialMark===false,
   JSON.stringify({q:small.qualified,m:small.partialMark})],
  ['...but a person reading zero is still owed the reason',
   small.explainsZero===true, String(small.explainsZero)],
  ['when every dollar is joint there is nothing to split and nothing is claimed',
   allJoint.inc.j===4000 && allJoint.claimsWhatEachEarns===false,
   JSON.stringify({j:allJoint.inc.j, claims:allJoint.claimsWhatEachEarns})],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
console.log('page errors:', errs.length?[...new Set(errs)].join(' | '):'none');
process.exit(bad?1:0);
