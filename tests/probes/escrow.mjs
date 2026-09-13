/* "Could adding things like this for my mortgage be beneficial to the debt
   payoff planner, and could advice be given by analysis of these numbers?"

   The screenshot that came with it was a servicer's page reading "Monthly
   Payment Amount: $1,230.46" against a balance of $77,266.76 at 3.375%. Typed
   in as it reads, the planner cleared that loan in 70 months. The same page
   said the loan pays off in November 2046 - about 284 months away. Eighteen
   years apart, and nothing on screen to say why.

   The answer was in a different card on the same page: an escrow advance of
   $1,102.23. Taxes and insurance ride inside that payment and they pay down
   nothing. Roughly $440 of it is principal and interest; roughly $790 is not.

   Three things came out of it, and each is checked here on those exact figures:

     1. nothing that is not paying down a balance may enter the engine,
     2. when the servicer prints a payoff date, the app checks itself against
        it and names the usual cause when they disagree,
     3. a rate below what money earns invested is said out loud, because the
        advice a debt app is least likely to give is the one this debt deserves.
*/
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);

const SEED=(debts)=>({onboarded:true,mindOff:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',
  activeMonth:'2026-09',investReturn:7,debtBudget:1500,
  categories:[{id:'c1',name:'Roof'}],budgets:{},transactions:[],accounts:[],assets:[],liabilities:[],
  goals:[],recurring:[],impulse:[],debts,diary:[],intake:{},lessons:[],vault:[]});
const load=async debts=>{ await p.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),SEED(debts));
  await p.reload(); await p.waitForTimeout(1600); };

const REAL={id:'m',name:'Mortgage',kind:'mortgage',balance:77266.76,apr:3.375,
            minPayment:1230.46,saidPayoff:'2046-11'};

await load([REAL]);
const engine=await p.evaluate(REAL=>{
  const raw={...REAL};
  const fixed={...REAL, escrow:790};
  const strip=h=>String(h).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  return {
    /* the figure as the servicer's page prints it */
    piRaw:debtPI(raw), piFixed:Math.round(debtPI(fixed)*100)/100,
    monthsRaw:simulateDebts([raw],debtPI(raw),'avalanche').months,
    monthsFixed:simulateDebts([fixed],debtPI(fixed),'avalanche').months,
    interestRaw:Math.round(simulateDebts([raw],debtPI(raw),'avalanche').totalInterest),
    interestFixed:Math.round(simulateDebts([fixed],debtPI(fixed),'avalanche').totalInterest),
    /* an ordinary debt is untouched by any of it */
    plainCard:debtPI({balance:5000,apr:24.99,minPayment:150}),
    /* escrow can never turn a payment negative */
    silly:debtPI({balance:1000,apr:9,minPayment:100,escrow:400}),
    checkRaw:strip(debtCheckHTML(raw)),
    checkFixed:strip(debtCheckHTML(fixed)),
    cheap:strip(debtCheapHTML(fixed)),
    /* the minimum-cost line is about the part that pays it down */
    minRaw:minPayCost(raw).months, minFixed:minPayCost(fixed).months
  };
},REAL);

/* the servicer's date is the ground truth, so the engine must land on it */
const landsOnIt=await p.evaluate(()=>{
  const d={id:'m',name:'M',kind:'mortgage',balance:77266.76,apr:3.375,minPayment:1230.46,escrow:790,saidPayoff:'2046-11'};
  const c=debtPayoffCheck(d);
  return { kind:c.kind, mine:c.mine, said:c.said, gap:c.gap };
});

/* nothing is claimed where a figure is missing */
const quiet=await p.evaluate(()=>{
  const has=h=>String(h||'').length>0;
  return {
    noDate:has(debtCheckHTML({balance:1000,apr:5,minPayment:100})),
    noRate:has(debtCheckHTML({balance:1000,apr:0,minPayment:100,saidPayoff:'2030-01'})),
    noPayment:has(debtCheckHTML({balance:1000,apr:5,minPayment:0,saidPayoff:'2030-01'})),
    junkDate:has(debtCheckHTML({balance:1000,apr:5,minPayment:100,saidPayoff:'not a month'})),
    dearDebt:has(debtCheapHTML({balance:5000,apr:24.99})),
    /* a rate only just under the return is not worth a paragraph either way */
    borderline:has(debtCheapHTML({balance:5000,apr:6.8})),
    zeroBal:has(debtCheapHTML({balance:0,apr:3}))
  };
});

/* the fields are on the row, and only where they mean something */
const ui=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); await w(700);
  if(typeof deckShow==='function'){ try{ deckShow('debt','Debt Payoff Planner'); }catch(_){} }
  await w(400);
  const esc=document.querySelector('#debtList input[data-debt="m"][data-k="escrow"]');
  const said=document.querySelector('#debtList input[data-debt="m"][data-k="saidPayoff"]');
  const before=(document.querySelector('#debtList [data-drmin="m"]')||{innerText:''}).innerText;
  /* type the escrow the way a thumb does and watch the disagreement close */
  esc.focus(); esc.value='790'; esc.dispatchEvent(new Event('input',{bubbles:true})); await w(400);
  const after=(document.querySelector('#debtList [data-drmin="m"]')||{innerText:''}).innerText;
  return { hasEscrow:!!esc, hasSaid:!!said,
           storedEscrow:state.debts.find(x=>x.id==='m').escrow,
           keptFocus:document.activeElement===esc,
           wasDisagreeing:/One of us is wrong/.test(before),
           nowAgrees:/agrees with your servicer/.test(after),
           saysCheap:/cheaper than/.test(after) };
});

/* a card has no escrow box, because a card has no escrow */
await load([{id:'c',name:'Visa',kind:'card',balance:5000,apr:24.99,minPayment:150}]);
const card=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); await w(700);
  if(typeof deckShow==='function'){ try{ deckShow('debt','Debt Payoff Planner'); }catch(_){} }
  await w(400);
  return { noEscrowBox: !document.querySelector('#debtList input[data-debt="c"][data-k="escrow"]'),
           noCheapNote: !/cheaper than/.test((document.querySelector('#debtList [data-drmin="c"]')||{innerText:''}).innerText) };
});
/* unless one is already set, which must never be stranded where nothing edits it */
await load([{id:'c2',name:'Odd loan',kind:'personal',balance:5000,apr:9,minPayment:150,escrow:20}]);
const stranded=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); await w(700);
  if(typeof deckShow==='function'){ try{ deckShow('debt','Debt Payoff Planner'); }catch(_){} }
  await w(400);
  return { offered: !!document.querySelector('#debtList input[data-debt="c2"][data-k="escrow"]') };
});

await b.close();

const T=[
  ['typed as the servicer prints it, the planner is fourteen years out',
   engine.monthsRaw===70 && engine.monthsFixed===243,
   JSON.stringify({raw:engine.monthsRaw, fixed:engine.monthsFixed})],
  ['...and understates the interest by more than twenty thousand',
   engine.interestFixed-engine.interestRaw>20000,
   JSON.stringify({raw:engine.interestRaw, fixed:engine.interestFixed,
                   hidden:engine.interestFixed-engine.interestRaw})],
  ['naming the escrow lands the engine on the servicer\'s own date',
   landsOnIt.kind==='agrees' && Math.abs(landsOnIt.gap)<=3,
   JSON.stringify(landsOnIt)],
  ['the payment that pays down the balance is the payment less the escrow',
   engine.piFixed===440.46 && engine.piRaw===1230.46,
   JSON.stringify({raw:engine.piRaw, fixed:engine.piFixed})],
  ['...and the minimum-cost line is about that part too',
   engine.minFixed>engine.minRaw*3, JSON.stringify({raw:engine.minRaw, fixed:engine.minFixed})],
  ['a debt with no escrow is the debt it always was',
   engine.plainCard===150, String(engine.plainCard)],
  ['...and escrow larger than the payment cannot make it negative',
   engine.silly===0, String(engine.silly)],

  ['a disagreement with the servicer is stated, with the size of it',
   /One of us is wrong/.test(engine.checkRaw) && /172 months sooner/.test(engine.checkRaw),
   engine.checkRaw.slice(0,120)],
  ['...and names the usual cause rather than leaving it to be found',
   /taxes and insurance/.test(engine.checkRaw) && /escrow/.test(engine.checkRaw),
   String(/taxes and insurance/.test(engine.checkRaw))],
  ['agreement is said too, because that is what makes the figures trustworthy',
   /agrees with your servicer/.test(engine.checkFixed), engine.checkFixed.slice(0,90)],

  ['a rate below what money earns invested is said out loud',
   /3\.375%/.test(engine.cheap) && /cheaper than/.test(engine.cheap), engine.cheap.slice(0,90)],
  ['...naming the one side that is guaranteed and the one side that is not',
   /guaranteed to save/.test(engine.cheap) && /not guaranteed/.test(engine.cheap),
   String(/not guaranteed/.test(engine.cheap))],

  ['nothing is claimed where a figure is missing',
   quiet.noDate===false && quiet.noRate===false && quiet.noPayment===false && quiet.junkDate===false,
   JSON.stringify(quiet)],
  ['...and an expensive debt is never called cheap',
   quiet.dearDebt===false && quiet.borderline===false && quiet.zeroBal===false, JSON.stringify(quiet)],

  ['both boxes are on the mortgage row', ui.hasEscrow===true && ui.hasSaid===true, JSON.stringify(ui)],
  ['...typing the escrow closes the disagreement without rebuilding the row under the thumb',
   ui.wasDisagreeing===true && ui.nowAgrees===true && ui.keptFocus===true && ui.storedEscrow===790,
   JSON.stringify(ui)],
  ['the headline is on the row and the figures wait behind a summary',
   /One of us is wrong/.test(engine.checkRaw)
     && engine.checkRaw.indexOf('2046-11')>engine.checkRaw.indexOf('One of us is wrong'),
   engine.checkRaw.slice(0,110)],
  ['a card is offered no escrow box and told nothing about being cheap',
   card.noEscrowBox===true && card.noCheapNote===true, JSON.stringify(card)],
  ['...but a value already set is always editable, whatever the kind',
   stranded.offered===true, String(stranded.offered)],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
console.log('page errors:', errs.length?[...new Set(errs)].join(' | '):'none');
process.exit(bad?1:0);
