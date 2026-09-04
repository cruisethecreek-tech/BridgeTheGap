import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',hourlyWage:30,roomPay:500,
  categories:[{id:'c1',name:'Food'}],budgets:{'2026-08':{c1:400}},
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:4000,updated:'2026-08-01'}],
  transactions:[],goals:[{id:'g1',name:'Kitchen',target:10000,saved:0,date:'',goalType:'foundation'}],
  impulse:[],recurring:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],
  debts:[{id:'d1',name:'Home equity',balance:2500,apr:3.49,minPayment:50,limit:50000,secured:true}],
  debtBudget:0,vault:[],snapshots:[]});
await pg.reload(); await pg.waitForTimeout(800);

/* the dropdown has to contain a word the person would recognise */
const label = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('goals'); deckShow('goals','Accounts'); await w(400);
  const sel=document.getElementById('acctKind');
  return {opts:[...sel.options].map(o=>o.textContent),
          sec:[...document.getElementById('acctSecured').options].map(o=>o.textContent),
          lim:document.getElementById('acctLim').placeholder};
});
ok('the account kind names a HELOC, not only a card', label.opts.some(o=>/HELOC/.test(o)), JSON.stringify(label.opts));
ok('...and the collateral question names a home', label.sec.some(o=>/home/i.test(o)), JSON.stringify(label.sec));
ok('...and the limit box no longer suggests a card-sized number', !/^\d+$/.test(label.lim), label.lim);

/* the crossing */
const cross = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); renderDebt(); await w(520);
  const o={};
  o.nwBefore=netWorth(); o.bankBefore=bankTotal();
  o.offered=!!document.getElementById('roomToAccts');
  o.text=document.getElementById('roomResults').innerText;
  o.roomBefore=roomTotal(); o.linesBefore=roomLines().length;
  document.getElementById('roomToAccts').click(); await w(600);
  const a=creditAccts()[0]||{};
  o.made={name:a.name, kind:a.kind, balance:a.balance, limit:a.limit, apr:a.apr, secured:!!a.secured,
          hist:(a.hist||[]).length};
  o.nwAfter=netWorth();
  /* the two things that would be silently wrong: room counted twice, and the
     rate layer seeing the same line as two */
  o.roomAfter=roomTotal(); o.linesAfter=roomLines().length;
  o.pricedNames=pricedLines().map(l=>l.name);
  o.debtsKept=(state.debts||[]).length;
  o.offerGone=!document.getElementById('roomToAccts');
  return o;
});
ok('the planner offers its limited line to the accounts side', cross.offered===true);
ok('...saying why both sides exist rather than calling it a copy',
  /net worth/i.test(cross.text) && /not two copies/.test(cross.text), cross.text.slice(0,400));
ok('one tap makes a credit account carrying everything typed once',
  cross.made.kind==='credit' && cross.made.limit===50000 && cross.made.apr===3.49
    && cross.made.secured===true, JSON.stringify(cross.made));
ok('...with what is owed flipped negative, which is how this side stores it',
  cross.made.balance===-2500, String(cross.made.balance));
ok('...and a first reading, so the balance has a history from today',
  cross.made.hist===1, String(cross.made.hist));
ok('net worth moves by exactly what is owed, once', 
  Math.abs((cross.nwAfter-cross.nwBefore)-(-2500))<0.01,
  JSON.stringify([cross.nwBefore,cross.nwAfter]));
ok('the room is NOT counted twice, which is the whole risk of two sides',
  cross.roomAfter===cross.roomBefore && cross.linesAfter===cross.linesBefore,
  JSON.stringify([cross.roomBefore,cross.roomAfter,cross.linesBefore,cross.linesAfter]));
ok('...and the rate layer still sees one line, not two',
  cross.pricedNames.filter(n=>/Home equity/.test(n)).length===1, JSON.stringify(cross.pricedNames));
ok('the payoff plan keeps its debt, because that was never the duplicate', cross.debtsKept===1);
ok('...and the offer goes away once taken', cross.offerGone===true);

/* the accounts panel must stop calling it a card */
const words = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('goals'); deckShow('goals','Accounts'); renderAccounts(); await w(450);
  return document.getElementById('acctSummary').innerText;
});
ok('the accounts summary stops calling a HELOC "the cards"',
  !/On the cards:/.test(words) && /Home equity/.test(words), words.slice(0,300));
ok('...and says the secured room is a different kind of room',
  /behind something you own/.test(words), words.slice(0,600));
ok('...with a way through to what it could be spent on',
  /Price it against a dream/.test(words), words.slice(0,600));

/* the cost of two sides: they can drift, and a payoff date built on a stale
   balance looks finished when it is not */
const drift = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); renderDebt(); await w(450);
  const clean=!document.querySelector('#roomResults .room-drift');
  const acc=creditAccts()[0]; acc.balance=-3100; save(); renderRoom(); await w(320);
  const t=document.getElementById('roomResults').innerText;
  const nw=netWorth();
  acc.balance=-2500; save();
  return {clean, t, nw};
});
ok('two sides that agree say nothing at all', drift.clean===true);
ok('...and two that disagree are named, with both figures',
  /two different things/.test(drift.t) && /\,500/.test(drift.t) && /\,100/.test(drift.t), drift.t.slice(0,400));
ok('...saying which side each number drives, and refusing to sync silently',
  /net worth only ever reads the Build side/.test(drift.t) && /will not quietly overwrite/.test(drift.t), drift.t.slice(0,700));

/* a second tap must not make a second account */
const twice = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); renderDebt(); await w(450);
  return {offer:!!document.getElementById('roomToAccts'), n:creditAccts().length};
});
ok('a line already on the accounts side is not offered again',
  twice.offer===false && twice.n===1, JSON.stringify(twice));

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
