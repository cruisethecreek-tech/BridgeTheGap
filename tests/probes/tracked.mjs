import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
/* Their shape exactly: one account carrying the ledger, one carrying nothing
   and predating the reading history. */
/* Pinned to August 2026 and it went red the morning the month turned: the
   readings were dated 2026-08-20 and 2026-08-27 while "this month" had become
   September, so the account's own history was suddenly last month's and the
   snapshot the trend reads did not exist. Shifting the whole fixture forward by
   a month does not fix it either - day 27 of THIS month is in the future on the
   1st. What this fixture actually means is "a few readings, recently", so it is
   built from today and counted backwards, and every assertion that names a date
   names the same computed one. */
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const ago=n=>{ const d=new Date(); d.setDate(d.getDate()-n); return ymd(d); };
const M0=ymd(new Date()).slice(0,7);                       // the month we are in
const PREVM=(()=>{ const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-1);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; })();
const PRIOR=ago(12), RECENT=ago(5), FIRST=ago(45);
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
 ({onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:M0,hourlyWage:30,
  categories:[{id:'c1',name:'Food'}],budgets:{[M0]:{c1:400}},
  accounts:[
    {id:'jc',name:'Joint Checking',kind:'checking',purpose:'sinking',balance:6637.64,updated:RECENT,
     hist:[{d:FIRST,b:5000,how:'first'},{d:RECENT,b:6637.64,how:'bank'}]},
    {id:'ov',name:'Overflow income',kind:'checking',purpose:'emergency',balance:1000,updated:PRIOR}],
  transactions:[{id:'t1',type:'expense',amount:475.40,date:ago(4),catId:'c1',acctId:'jc'}],
  goals:[],impulse:[],recurring:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],
  vault:[],snapshots:[{month:PREVM,bank:6000,owed:0}]}));
await pg.reload(); await pg.waitForTimeout(800);

/* the backfill: two stored facts become the reading they always were */
const seeded = await pg.evaluate(() => {
  const a=state.accounts.find(x=>x.id==='ov');
  return {hist:a.hist, jc:(state.accounts.find(x=>x.id==='jc').hist||[]).length};
});
ok('an account that predates readings is given the one it already had',
  seeded.hist.length===1 && seeded.hist[0].d===PRIOR && seeded.hist[0].b===1000
    && seeded.hist[0].how==='first', JSON.stringify(seeded.hist));
ok('...and an account that already had readings is left alone', seeded.jc===2, String(seeded.jc));

const r = await pg.evaluate(async (M0) => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('goals'); deckShow('goals','Accounts'); renderAccounts(); await w(420);
  const row=id=>document.querySelector('input[data-acctbal="'+id+'"]').closest('.acct-row').innerText;
  const o={before:row('ov'), bankBefore:bankTotal(), nwBefore:netWorth(),
           snapBefore:(state.snapshots.find(s=>s.month===M0)||{}).bank};
  const toasts=[]; const ot=window.toast; window.toast=m=>{toasts.push(m); return ot&&ot(m);};
  const inp=document.querySelector('input[data-acctbal="ov"]');
  inp.value='1137.46'; inp.dispatchEvent(new Event('change',{bubbles:true}));
  await w(520);
  window.toast=ot;
  o.toasts=toasts;
  o.after=row('ov');
  o.hist=state.accounts.find(x=>x.id==='ov').hist;
  o.bankAfter=bankTotal(); o.nwAfter=netWorth();
  o.snapAfter=(state.snapshots.find(s=>s.month===M0)||{}).bank;
  o.summary=document.getElementById('acctSummary').innerText;
  /* and the trend, which is where "statistics" actually lives */
  activateTab('reflect'); rfTab='trends'; renderReflectTab(); await w(300);
  trendPick='bank'; renderTrendSeries(); await w(300);
  const pts=trendMonths(6).map(m=>({m, v:(state.snapshots.find(s=>s.month===m)||{}).bank ?? null}));
  o.trendNow=(pts.find(p=>p.m===M0)||{}).v;
  return o;
}, M0);
ok('the row said nothing about the reading before, and says it now',
  !/reading/.test(r.before)===false && new RegExp('1 reading, taken '+PRIOR).test(r.before), r.before);
ok('after a change the row states both readings and the movement between them',
  new RegExp('2 readings since '+PRIOR).test(r.after) && /up \$137\.46/.test(r.after), r.after);
ok('...and the reading is actually stored, dated today, read off the bank',
  r.hist.length===2 && r.hist[1].b===1137.46 && r.hist[1].how==='bank', JSON.stringify(r.hist));
ok('typing a balance with nothing logged against it now answers back',
  r.toasts.length===1, JSON.stringify(r.toasts));
ok('...naming the movement and where it landed',
  /up \$137\.46/.test(r.toasts[0]||'') && new RegExp('since '+PRIOR).test(r.toasts[0]||'')
    && /worked out again/.test(r.toasts[0]||''), r.toasts[0]);
/* the four figures that were always moving, silently */
ok('the bank total moved', Math.abs((r.bankAfter-r.bankBefore)-137.46)<0.01, JSON.stringify([r.bankBefore,r.bankAfter]));
ok('net worth moved', Math.abs((r.nwAfter-r.nwBefore)-137.46)<0.01, JSON.stringify([r.nwBefore,r.nwAfter]));
ok('this month\'s snapshot moved', r.snapAfter>r.snapBefore && Math.abs(r.snapAfter-7775)<1,
  JSON.stringify([r.snapBefore,r.snapAfter]));
ok('...and the trend reads the new figure, which is what "statistics" means here',
  Math.abs(r.trendNow-7775)<1, String(r.trendNow));
ok('the emergency-fund line reworks itself from it', /\$1,137\.46/.test(r.summary), r.summary.slice(0,200));

/* an unchanged retype is still a reading - the trend needs the flat months */
const same = await pg.evaluate(async (PRIOR) => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('goals'); deckShow('goals','Accounts'); renderAccounts(); await w(400);
  state.accounts.find(x=>x.id==='ov').hist=[{d:PRIOR,b:1137.46,how:'first'}]; save();
  renderAccounts(); await w(300);
  const toasts=[]; const ot=window.toast; window.toast=m=>{toasts.push(m);};
  const inp=document.querySelector('input[data-acctbal="ov"]');
  inp.value='1137.46'; inp.dispatchEvent(new Event('change',{bubbles:true}));
  await w(500); window.toast=ot;
  return {toasts, hist:state.accounts.find(x=>x.id==='ov').hist};
}, PRIOR);
ok('a balance retyped unchanged still says it was recorded',
  /unchanged/.test(same.toasts[0]||'') && /still a reading/.test(same.toasts[0]||''), same.toasts[0]);
ok('...and is recorded, so a flat month is a fact rather than a gap',
  same.hist.length===2, JSON.stringify(same.hist));

/* the account WITH a ledger must keep its own, different response */
const withLedger = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('goals'); deckShow('goals','Accounts'); renderAccounts(); await w(400);
  const toasts=[]; const ot=window.toast; window.toast=m=>{toasts.push(m);};
  const inp=document.querySelector('input[data-acctbal="jc"]');
  inp.value='6000'; inp.dispatchEvent(new Event('change',{bubbles:true}));
  await w(500); window.toast=ot;
  return {toasts, gap:state.accounts.find(x=>x.id==='jc').lastGap};
});
ok('an account with a ledger still reports the gap instead, not the plain move',
  /without being logged/.test(withLedger.toasts[0]||''), withLedger.toasts[0]);
ok('...and the gap is still recorded', typeof withLedger.gap==='number', String(withLedger.gap));

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
