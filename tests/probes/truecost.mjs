/* Three numbers the app had every input for and never said out loud.

   What they have in common is the only reason they were built together: each
   one is arithmetic on figures the user has already given, not a lesson about
   money in general. A warning shown to everybody is a documentary. A figure
   worked out from somebody's own statement is accountability, and this app only
   has standing to do the second one.

   So what is checked here is mostly the restraint. That the betting bucket
   catches a bookmaker and not a pizza chain. That a rate of zero is never
   quietly read as seven. That a projection is in today's money rather than the
   flattering kind. That the one screen carrying a helpline does not fire under
   a scratch card. Getting the sums right is the easy half. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);
const SEED=(x={})=>({onboarded:true,activeMonth:'2026-09',uiMode:'all',stageReached:3,mindOff:true,
  guidesOff:true,sayMode:'brief',categories:[{id:'roof',name:'Roof'}],budgets:{},
  transactions:[],accounts:[],assets:[],goals:[],recurring:[],impulse:[],liabilities:[],
  debts:[],diary:[],intake:{},lessons:[],vault:[],...x});
const load=async st=>{ await p.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),st);
  await p.reload(); await p.waitForTimeout(1500); };

await load(SEED());

/* ---------- 1. the scanner's new vocabulary ---------- */
const bets=await p.evaluate(()=>{
  const g=n=>scanGroupOf(n).g, B='Betting and gambling';
  const caught=['DRAFTKINGS PARLAY','FANDUEL SPORTSBOOK','PAYPAL *DRAFTKINGS','HOLLYWOOD CASINO',
    'OHIO LOTTERY','BETMGM NJ','BET365 DEPOSIT','CAESARS SPORTSBOOK','PRIZEPICKS','CHUMBA CASINO',
    'POWERBALL TICKET','OFF TRACK BETTING','SQ *RACEBOOK'];
  /* Every one of these is a name the vocabulary could plausibly have eaten, and
     each is somebody's ordinary week if it did. */
  const spared=['LITTLE CAESARS #4412','BET+ SUBSCRIPTION','BETTER HOMES MAGAZINE',
    'BARSTOOL SPORTS SHOP','UNDERDOG SPORTS BAR','TARGET T-1129','METRO TRANSIT',
    'SPEEDWAY 4421','BETTERHELP THERAPY','ALPHABET INC'];
  return { hit:caught.filter(n=>g(n)===B).length, hitOf:caught.length, missed:caught.filter(n=>g(n)!==B),
           wrong:spared.filter(n=>g(n)===B), sparedOf:spared.length,
           crypto:g('COINBASE INC')!==B && g('KRAKEN EXCHANGE')!==B };
});

/* ---------- the reading, and when it raises its voice ---------- */
const read=await p.evaluate(()=>{
  const R=(rows)=>scanRead(rows);
  const bet=(what,amt)=>({what,amt,kind:'expense'});
  const other=(what,amt)=>({what,amt,kind:'expense'});
  /* a pattern: eleven deposits, real weight */
  const heavy=R([...Array(11)].map((_,i)=>bet('DRAFTKINGS',30)).concat([other('KROGER',400),other('SHELL',120)]));
  /* one scratch card inside an ordinary month: the bucket says so, the helpline does not appear */
  const light=R([bet('OHIO LOTTERY',8), other('KROGER',400), other('SHELL',120)]);
  /* under the floor even though it is a pattern - four small tickets */
  const small=R([bet('OHIO LOTTERY',10),bet('OHIO LOTTERY',10),bet('OHIO LOTTERY',10),bet('OHIO LOTTERY',10),
                 other('KROGER',900)]);
  return {
    heavyAmt:heavy.bet&&heavy.bet.amt, heavyN:heavy.bet&&heavy.bet.n, heavyPct:heavy.betPct, heavyLoud:heavy.betLoud,
    lightSeen:!!light.bet, lightAmt:light.bet&&light.bet.amt, lightLoud:light.betLoud,
    smallSeen:!!small.bet, smallLoud:small.betLoud,
    noneSeen:!!R([other('KROGER',400)]).bet, noneLoud:R([other('KROGER',400)]).betLoud };
});

/* the helpline is on the screen, dialable, and nothing about it is a verdict */
const help=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('track'); await w(500);
  if(typeof deckShow==='function'){ try{ deckShow('track','Read a statement'); }catch(_){} }
  await w(300);
  const rows=[...Array(11)].map(()=>({what:'DRAFTKINGS',amt:30,kind:'expense'}))
    .concat([{what:'KROGER',amt:400,kind:'expense'}]);
  scanResult={ records:rows, read:scanRead(rows), pages:2, dropped:0, text:'x', at:todayStr() };
  renderScanOut(); await w(300);
  const el=document.querySelector('.scan-bet');
  const t=el?el.innerText:'';
  const a=el?el.querySelector('a[href^="tel:"]'):null;
  return { shown:!!el, tel:a?a.getAttribute('href'):null,
           saysTotal:/330/.test(t), saysCount:/\b11\b/.test(t),
           /* the register system reaches every other line of prose in this app.
              It must not reach this one, in any of the three settings. */
           noVerdict:!/problem|addict|stop|quit|shame|should/i.test(t) };
});
const regs=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const out=[];
  for(const r of ['clean','blunt','savage']){
    state.register=r;
    renderScanOut(); await w(120);
    const el=document.querySelector('.scan-bet');
    out.push(el?el.innerText.replace(/\s+/g,' ').trim():'');
  }
  return { same:new Set(out).size===1, n:out.length, len:out[0].length };
});

/* ---------- 2. what the minimum costs ---------- */
const min=await p.evaluate(()=>{
  const C=d=>minPayCost(d);
  const txt=d=>debtMinHTML(d).replace(/<[^>]+>/g,'');
  const visa={name:'Visa', balance:5000, apr:24.99, minPayment:150};
  const under={name:'U', balance:8000, apr:26, minPayment:100};
  const v=C(visa);
  /* the honest check: this must be the same simulator the payoff date uses, or
     the two numbers on one screen can contradict each other */
  const viaPlanner=simulateDebts([visa],150,'avalanche');
  return {
    okKind:v.kind, okMonths:v.months, okInterest:v.interest, okTotal:v.total,
    matchesPlanner: Math.abs(v.months-viaPlanner.months)<1
      && Math.abs(v.interest-Math.round(viaPlanner.totalInterest*100)/100)<0.02,
    /* total paid has to equal what was borrowed plus the interest named */
    adds: Math.abs(v.total-(5000+v.interest))<0.02,
    never:C(under).kind,
    neverSaysInterest:/never clears/.test(txt(under)) && /173/.test(txt(under)),
    /* a rate of 0 in this app means "not told yet". Answering $0 of interest
       there would be a fabrication, and the flattering kind. */
    norate:C({balance:3000,apr:0,minPayment:90}).kind,
    norateAsks:/Add the rate/.test(txt({balance:3000,apr:0,minPayment:90})),
    nomin:C({balance:3000,apr:19,minPayment:0}).kind,
    nominAsks:/Add the minimum/.test(txt({balance:3000,apr:19,minPayment:0})),
    paidOff:C({balance:0,apr:19,minPayment:90}),
    junk:C({balance:-500,apr:-4,minPayment:-9}),
    junkTxt:txt({balance:-500,apr:-4,minPayment:-9})
  };
});

/* on the row, live, without a full redraw stealing the keyboard */
await load(SEED({debts:[{id:'d1',name:'Visa',balance:5000,apr:24.99,minPayment:150}], debtBudget:300}));
const row=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); await w(600);
  if(typeof deckShow==='function'){ try{ deckShow('debt','Debt Payoff Planner'); }catch(_){} }
  await w(400);
  const el=document.querySelector('#debtList [data-drmin="d1"]');
  const before=el?el.innerText:'';
  /* change the rate the way a thumb does, and check the line moves without the
     row being rebuilt underneath the field that has focus */
  const apr=document.querySelector('#debtList input[data-debt="d1"][data-k="apr"]');
  apr.focus(); apr.value='9'; apr.dispatchEvent(new Event('input',{bubbles:true})); await w(300);
  const after=document.querySelector('#debtList [data-drmin="d1"]');
  return { onRow:!!el, saysCost:/4 yrs 10 mo/.test(before) && /3,622/.test(before),
           moved:after.innerText!==before, keptFocus:document.activeElement===apr,
           note:!!document.querySelector('.debt-minnote'),
           noteWarnsLonger:/longer than the one above, never shorter/.test(
             (document.querySelector('.debt-minnote')||{innerText:''}).innerText) };
});

/* ---------- 3. what the money becomes if it is kept ---------- */
await load(SEED());
const kept=await p.evaluate(()=>{
  const before=state.investReturn;
  const at=r=>{ state.investReturn=r; return {grew:keptGrowsTo(200), metric:keptMetric(200)}; };
  const seven=at(7), zero=at(0), three=at(3), ten=at(10);
  state.investReturn=before;
  /* 7% expected less 3% inflation is 4% real, thirty years: 200 * 1.04^30 */
  const hand=Math.round(200*Math.pow(1.04,30));
  return {
    seven:seven.grew, handChecks:seven.grew===hand,
    /* the whole point: this must NOT be the nominal 200 * 1.07^30 = 1523 */
    notNominal: seven.grew !== Math.round(200*Math.pow(1.07,30)),
    /* clearing the box writes 0, and `||7` would silently answer for 7% */
    zeroIsHonest: zero.grew===200 && zero.metric===null,
    threeIsHonest: three.grew===200 && three.metric===null,
    tenMoves: ten.grew>seven.grew,
    noneAt0: keptMetric(0)===null, noneAtNeg: keptMetric(-5)===null,
    tinySkipped: keptMetric(1)===null || keptMetric(1)[1]!=='$1'
  };
});

const radar=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('impulse'); await w(600);
  if(typeof deckShow==='function'){ try{ deckShow('impulse','Trap Radar'); }catch(_){} }
  await w(300);
  document.getElementById('impName').value='Sneakers';
  document.getElementById('impAmt').value='200';
  const sel=document.getElementById('impTrap'); if(sel) sel.value='scroll';
  document.getElementById('impRun').click(); await w(600);
  const card=document.getElementById('impResult');
  const ks=[...card.querySelectorAll('.metric .k')].map(e=>e.innerText);
  const vs=[...card.querySelectorAll('.metric .v')].map(e=>e.innerText);
  const i=ks.findIndex(k=>/If kept/.test(k));
  const note=card.querySelector('.kept-note');
  return { hasMetric:i>=0, label:i>=0?ks[i]:'', value:i>=0?vs[i]:'',
           hasNote:!!note,
           saysTodaysMoney:!!note && /today's money/.test(note.innerText),
           saysNotAdvice:!!note && /not a forecast and not advice/.test(note.innerText),
           namesRate:!!note && /7%/.test(note.innerText) && /3%/.test(note.innerText) };
});

/* a tool that replaces a real cost must NOT be argued with by this number: the
   app just proved with arithmetic that it beats keeping the money. */
const tool=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const run=async(rep)=>{
    document.getElementById('impName').value='Mulcher';
    document.getElementById('impAmt').value='200';
    const sel=document.getElementById('impTrap'); if(sel) sel.value='tool';
    sel.dispatchEvent(new Event('change',{bubbles:true})); await w(250);
    const ra=document.getElementById('impRepAmt'); if(ra) ra.value=rep;
    document.getElementById('impRun').click(); await w(500);
    const c=document.getElementById('impResult');
    return { note:!!c.querySelector('.kept-note'),
             metric:[...c.querySelectorAll('.metric .k')].some(e=>/If kept/.test(e.innerText)) };
  };
  const pays=await run('80');     // replaces $80/mo: keeping the money is the worse move
  const want=await run('');       // replaces nothing: keeping it is the real alternative
  return { paysQuiet:!pays.note && !pays.metric, wantSpeaks:want.note && want.metric };
});

await b.close();

const T=[
  ['the scanner knows a bookmaker when it reads one',
   bets.hit===bets.hitOf, `${bets.hit} of ${bets.hitOf}, missed ${JSON.stringify(bets.missed)}`],
  ['...and files nobody\'s pizza, streaming or therapy as a bet',
   bets.wrong.length===0, JSON.stringify(bets.wrong)],
  ['...and does not call buying an asset badly a bet, which is not its call to make',
   bets.crypto===true, String(bets.crypto)],
  ['the reading carries the total and what share of the month it is',
   read.heavyAmt===330 && read.heavyN===11 && read.heavyPct>0, JSON.stringify(read)],
  ['the helpline appears when it is a pattern with weight behind it',
   read.heavyLoud===true && help.shown===true, JSON.stringify({l:read.heavyLoud,s:help.shown})],
  ['...and never under one scratch card, which is scolding, not accounting',
   read.lightSeen===true && read.lightLoud===false, JSON.stringify({seen:read.lightSeen,loud:read.lightLoud})],
  ['...nor under four small ones below the floor',
   read.smallSeen===true && read.smallLoud===false, JSON.stringify({seen:read.smallSeen,loud:read.smallLoud})],
  ['...and not at all when there is nothing to say',
   read.noneSeen===false && read.noneLoud===false, JSON.stringify({s:read.noneSeen,l:read.noneLoud})],
  ['the number is stated and no verdict is attached to it',
   help.saysTotal===true && help.saysCount===true && help.noVerdict===true, JSON.stringify(help)],
  ['...the helpline can actually be dialled',
   help.tel==='tel:18004262537', String(help.tel)],
  ['...and this is the one surface the register never reaches',
   regs.same===true && regs.n===3 && regs.len>80, JSON.stringify(regs).slice(0,120)],

  ['the minimum payment says what it costs, in years and in interest',
   min.okKind==='ok' && min.okMonths===58 && min.okInterest===3622.3, JSON.stringify(min).slice(0,120)],
  ['...adding up: what you hand over is the balance plus the interest named',
   min.adds===true, `${min.okTotal} vs 5000+${min.okInterest}`],
  ['...worked out by the same simulator as the payoff date beside it, so the two cannot disagree',
   min.matchesPlanner===true, String(min.matchesPlanner)],
  ['...and says plainly when a minimum never clears the debt at all',
   min.never==='never' && min.neverSaysInterest===true, JSON.stringify({k:min.never,t:min.neverSaysInterest})],
  ['a rate of nothing is a question, not a free ride',
   min.norate==='norate' && min.norateAsks===true, JSON.stringify({k:min.norate,a:min.norateAsks})],
  ['...same for a missing minimum', min.nomin==='nomin' && min.nominAsks===true,
   JSON.stringify({k:min.nomin,a:min.nominAsks})],
  ['a cleared debt and a junk row say nothing at all',
   min.paidOff===null && min.junk===null && min.junkTxt==='', JSON.stringify({p:min.paidOff,j:min.junk})],
  ['the line is on the row and reads as money, not as a setting',
   row.onRow===true && row.saysCost===true, JSON.stringify(row)],
  ['...it moves the moment the rate does, without the row being rebuilt under the thumb',
   row.moved===true && row.keptFocus===true, JSON.stringify({m:row.moved,f:row.keptFocus})],
  ['...and the page admits every one of those figures is the optimistic version',
   row.note===true && row.noteWarnsLonger===true, JSON.stringify({n:row.note,w:row.noteWarnsLonger})],

  ['money kept is grown at a real rate, so the answer is in today\'s money',
   kept.handChecks===true && kept.notNominal===true, JSON.stringify(kept).slice(0,120)],
  ['...a rate of nothing is answered as nothing, not quietly as seven percent',
   kept.zeroIsHonest===true && kept.threeIsHonest===true, JSON.stringify({z:kept.zeroIsHonest,t:kept.threeIsHonest})],
  ['...and a rate the user raises moves it', kept.tenMoves===true, String(kept.tenMoves)],
  ['nothing is claimed about no money, negative money, or a rounding error',
   kept.noneAt0===true && kept.noneAtNeg===true && kept.tinySkipped===true, JSON.stringify(kept).slice(0,90)],
  ['the Trap Radar carries it as one tile beside the price',
   radar.hasMetric===true && /If kept 30 yrs/.test(radar.label), JSON.stringify(radar).slice(0,120)],
  ['...and says what it assumed rather than leaving a number to assert it',
   radar.hasNote===true && radar.saysTodaysMoney===true && radar.namesRate===true, JSON.stringify(radar)],
  ['...out loud that it is arithmetic, not advice', radar.saysNotAdvice===true, String(radar.saysNotAdvice)],
  ['a thing that replaces a real cost is not argued with by this number',
   tool.paysQuiet===true, JSON.stringify(tool)],
  ['...but a pure want is, because there keeping the money is the real alternative',
   tool.wantSpeaks===true, JSON.stringify(tool)],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
console.log('page errors:', errs.length?[...new Set(errs)].join(' | '):'none');
process.exit(bad?1:0);
