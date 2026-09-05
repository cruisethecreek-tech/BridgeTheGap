import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const URL='file://'+process.cwd()+'/app.html';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' ').slice(0,220):''));} };

const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto(URL);

/* These fixtures were written in August 2026 and pinned there. Everything inside
   them is internally consistent, so they kept passing for weeks - until the 1st
   of September, when "this month" moved and every check that compares fixture
   data against the live clock went red at once. Shifted as a block, so the
   fixture always means "now" and the relative gaps between its months are
   preserved. Nothing here is dated past the 28th, so no day falls off the end
   of a shorter month. */
const MSHIFT=(()=>{const d=new Date(); return (d.getFullYear()*12+d.getMonth())-(2026*12+7);})();
const shiftYM=(ym,n)=>{ let [y,m]=ym.split('-').map(Number); m+=n; y+=Math.floor((m-1)/12); m=((m-1)%12+12)%12+1; return `${y}-${String(m).padStart(2,'0')}`; };
const live=o=>JSON.parse(JSON.stringify(o).replace(/2026-(0[1-9]|1[0-2])/g, mm=>shiftYM(mm,MSHIFT)));
const seed = st => pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)), live(st));
const BASE={onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',hourlyWage:30,
  categories:[{id:'food',name:'Food'},{id:'rent',name:'Rent'}],
  budgets:{'2026-08':{food:400,rent:1200}},
  transactions:[{id:'i1',type:'income',amount:4000,date:'2026-08-01'},
                {id:'e1',type:'expense',amount:1200,date:'2026-08-02',catId:'rent'},
                {id:'e2',type:'expense',amount:300,date:'2026-08-05',catId:'food'}],
  goals:[],impulse:[],recurring:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[]};

const report = async () => pg.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('reflect'); rfTab='report'; renderReflectTab(); await wait(200);
  const {signals,locked}=buildReport();
  /* textContent, not innerText. Each finding's numbers, arithmetic and nudge
     sit inside a fold now, so innerText reports only the headlines and every
     assertion about what the report SAYS came back false. What is being
     checked here is whether the app makes the statement at all, not whether it
     is painted on arrival - the fold probe is what covers the painting. */
  return { txt:document.getElementById('rpBody').textContent,
           ks:signals.map(s=>s.k), locked:locked.map(l=>l.t),
           order:signals.map(s=>({k:s.k,bad:!!s.bad,standing:!!s.standing,outside:!!s.outside})) };
});

/* ---- the user's own situation ---- */
await seed({...BASE, accounts:[
  {id:'chk',name:'Checking',kind:'checking',balance:2000,updated:'2026-01-01'},
  {id:'card',name:'Rewards Card',kind:'credit',balance:-4000,limit:13700,apr:13,updated:'2026-01-01'},
  {id:'heloc',name:'Equity Line',kind:'credit',balance:0,limit:25000,apr:3.6,secured:true,updated:'2026-01-01'}]});
await pg.reload(); await pg.waitForTimeout(600);
let r=await report();

ok('it notices the dearest money on its own', r.ks.includes('rateSpread'), r.ks.join(','));
ok('...and prices what keeping it costs for a year', /\$520/.test(r.txt), r.txt.slice(0,300));
ok('...against what the cheaper room would cost', /\$144/.test(r.txt), r.txt);
ok('...and shows the arithmetic rather than asserting it', /×\s*\(13%\s*−\s*3\.6%\)/.test(r.txt), r.txt);
ok('...in hours of life, like everything else in the app', /hrs|hours|days/.test(r.txt));
ok('it names the reason the cheap rate is cheap', /backed by something you own/i.test(r.txt), r.txt);
ok('...and says plainly what could be lost', /take the house/i.test(r.txt));
ok('and it refuses to tell you to do it', /not going to tell you to do it/i.test(r.txt));
ok('nothing in the rate layer says "you should"',
  !/\byou should\b|\bwe recommend\b|\bmove it\b(?! )/i.test(r.txt), r.txt);

/* ---- would a trivial spread be dressed up as a finding? ---- */
await seed({...BASE, accounts:[
  {id:'chk',name:'Checking',kind:'checking',balance:2000,updated:'2026-01-01'},
  {id:'card',name:'Rewards Card',kind:'credit',balance:-200,limit:13700,apr:13,updated:'2026-01-01'},
  {id:'heloc',name:'Equity Line',kind:'credit',balance:0,limit:25000,apr:8,updated:'2026-01-01'}]});
await pg.reload(); await pg.waitForTimeout(600);
r=await report();
ok('a spread worth almost nothing is called almost nothing', /not much/i.test(r.txt), r.txt);
ok('...and does not pretend it is a finding', /not worth an afternoon/i.test(r.txt));

/* ---- a cheap line with no room cannot absorb anything ---- */
await seed({...BASE,
  accounts:[{id:'chk',name:'Checking',kind:'checking',balance:2000,updated:'2026-01-01'},
            {id:'card',name:'Card',kind:'credit',balance:-4000,limit:13700,apr:19,updated:'2026-01-01'}],
  liabilities:[{id:'m',name:'Mortgage',value:210000,apr:4.1}]});
await pg.reload(); await pg.waitForTimeout(600);
r=await report();
ok('a cheap mortgage is not offered as somewhere to put a card balance',
  !r.ks.includes('rateSpread'), r.ks.join(','));
ok('...but two balances at two rates still get ordered', r.ks.includes('rateOrder'), r.ks.join(','));
ok('...as what a dollar is worth against each, not as an instruction',
  /same dollar/i.test(r.txt) && /whether you can stick to it is not/i.test(r.txt), r.txt);
ok('...and it says the plan you finish beats the better one you abandon',
  /abandoned in March/i.test(r.txt));

/* ---- idle cash against a carried balance ---- */
await seed({...BASE, accounts:[
  {id:'chk',name:'Checking',kind:'checking',balance:9000,updated:'2026-01-01'},
  {id:'card',name:'Card',kind:'credit',balance:-1000,limit:13700,apr:13,updated:'2026-01-01'}]});
await pg.reload(); await pg.waitForTimeout(600);
r=await report();
ok('idle cash against a priced balance is noticed', r.ks.includes('rateIdle'), r.ks.join(','));
ok('...and the buffer is protected before the interest is chased',
  /three months of your essentials/i.test(r.txt), r.txt);
ok('...and the cost of losing the flexibility is stated too',
  /money on a card is gone/i.test(r.txt));

/* ---- no buffer: the answer flips, and says so ---- */
await seed({...BASE, accounts:[
  {id:'chk',name:'Checking',kind:'checking',balance:600,updated:'2026-01-01'},
  {id:'card',name:'Card',kind:'credit',balance:-1000,limit:13700,apr:13,updated:'2026-01-01'}]});
await pg.reload(); await pg.waitForTimeout(600);
r=await report();
ok('with no buffer it says the buffer comes first', /buffer comes before the interest/i.test(r.txt), r.txt);
ok('...and calls that the right answer, not a disappointing one', /right answer rather than a disappointing one/i.test(r.txt));

/* ---- the play that works ---- */
await seed({...BASE,
  accounts:[{id:'chk',name:'Checking',kind:'checking',balance:2000,updated:'2026-01-01'},
            {id:'card',name:'Rewards Card',kind:'credit',balance:0,limit:13700,apr:13,updated:'2026-01-01'}],
  transactions:[...BASE.transactions,
    {id:'c1',type:'expense',amount:300,date:'2026-07-04',catId:'food',acctId:'card'},
    {id:'c2',type:'expense',amount:250,date:'2026-08-04',catId:'food',acctId:'card'},
    {id:'c3',type:'expense',amount:400,date:'2026-08-14',catId:'food',acctId:'card'}]});
await pg.reload(); await pg.waitForTimeout(600);
r=await report();
ok('clearing the card every month is recognised as the play working', r.ks.includes('rateClear'), r.ks.join(','));
ok('...and priced, so it is a fact and not a compliment', /only arrangement where rewards are actually free/i.test(r.txt));

/* ---- what it does not know ---- */
await seed({...BASE, accounts:[
  {id:'chk',name:'Checking',kind:'checking',balance:2000,updated:'2026-01-01'},
  {id:'card',name:'Store Card',kind:'credit',balance:-800,limit:2000,updated:'2026-01-01'}]});
await pg.reload(); await pg.waitForTimeout(600);
r=await report();
ok('a balance with no rate is named as something it cannot read',
  r.locked.some(l=>/Store Card/.test(l)), JSON.stringify(r.locked));
ok('...and the rate is called the whole story', r.locked.some(l=>/the rate is the whole story/.test(l)));

/* ---- the trend, over three readings ---- */
await seed({...BASE,
  accounts:[{id:'card',name:'Card',kind:'credit',balance:-3000,limit:13700,apr:13,updated:'2026-01-01'}],
  snapshots:[{month:'2026-06',bank:0,owed:1000},{month:'2026-07',bank:0,owed:2000},{month:'2026-08',bank:0,owed:3000}]});
await pg.reload(); await pg.waitForTimeout(600);
r=await report();
ok('three rising readings is reported as a direction', r.ks.includes('owedTrend'), r.ks.join(','));
{ const i=r.order.findIndex(o=>o.k==='owedTrend');
  const firstGood=r.order.findIndex(o=>!o.bad);
  ok('...and leads with the bad news, ahead of everything that is not bad',
     r.order[i].bad===true && (firstGood<0 || i<firstGood), JSON.stringify(r.order).slice(0,200)); }
ok('...while refusing to call a one-off a habit', /reads exactly the same from here/i.test(r.txt), r.txt);
const twoOnly=await (async()=>{ await seed({...BASE,
  accounts:[{id:'card',name:'Card',kind:'credit',balance:-3000,limit:13700,apr:13,updated:'2026-01-01'}],
  snapshots:[{month:'2026-07',bank:0,owed:2000},{month:'2026-08',bank:0,owed:3000}]});
  await pg.reload(); await pg.waitForTimeout(600); return report(); })();
ok('two readings is not yet a direction', !twoOnly.ks.includes('owedTrend'), twoOnly.ks.join(','));

/* ---- standing vs the month ---- */
await seed({...BASE, accounts:[
  {id:'chk',name:'Checking',kind:'checking',balance:2000,updated:'2026-01-01'},
  {id:'card',name:'Card',kind:'credit',balance:-4000,limit:13700,apr:13,updated:'2026-01-01'},
  {id:'heloc',name:'Equity Line',kind:'credit',balance:0,limit:25000,apr:3.6,secured:true,updated:'2026-01-01'}]});
await pg.reload(); await pg.waitForTimeout(600);
r=await report();
ok('a situation reading is marked as one, not passed off as the month',
  /true right now, not just in/i.test(r.txt), r.txt.slice(0,200));
const firstStanding=r.order.findIndex(o=>o.standing&&!o.bad);
  /* Three bands, not two: the month's own reading, then your standing
     situation, then outside context - which was already last and has to
     stay last, so it is excluded here rather than counted as the month. */
  const lastMonth=r.order.map((o,i)=>(!o.standing&&!o.bad&&!o.outside)?i:-1).filter(i=>i>=0).pop();
ok('...and sits behind the month it is not about',
  firstStanding<0 || lastMonth==null || firstStanding>lastMonth, JSON.stringify(r.order));

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
