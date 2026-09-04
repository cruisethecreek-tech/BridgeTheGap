import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const URL='file://'+process.cwd()+'/app.html';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,240):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto(URL);
const seed = st => pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)), st);

/* The screenshot's own situation: a balance read on the 25th, income and
   spending logged since, and a projection asking to be trusted. */
await seed({onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',hourlyWage:30,
  categories:[{id:'food',name:'Food'}], budgets:{'2026-08':{food:400}},
  accounts:[{id:'chk',name:'Joint Checking',kind:'checking',purpose:'sinking',balance:3843.28,updated:'2026-08-25'},
            {id:'sav',name:'Overflow income',kind:'checking',purpose:'emergency',balance:1000,updated:'2026-08-25'}],
  transactions:[{id:'t1',type:'income',amount:3000,date:'2026-08-26',source:'Paycheck',acctId:'chk'},
                {id:'t2',type:'expense',amount:150,date:'2026-08-26',catId:'food',acctId:'chk'},
                {id:'t3',type:'expense',amount:55.64,date:'2026-08-27',catId:'food',acctId:'chk'}],
  goals:[],impulse:[],recurring:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[]});
await pg.reload(); await pg.waitForTimeout(700);
await pg.evaluate(()=>{ activateTab('goals'); deckShow('goals','Accounts'); renderAccounts(); });
await pg.waitForTimeout(300);

const row=()=>pg.evaluate(()=>document.querySelector('.acct-row').textContent);
ok('the projection is still there', /Expected now/.test(await row()));
ok('...and now offers to show its work', await pg.evaluate(()=>!!document.querySelector('.ac-work')));
await pg.evaluate(()=>{ document.querySelector('.ac-work').open=true; });
await pg.waitForTimeout(150);
let t=await row();
ok('the work names how many entries are behind it', /3 entries since 2026-08-25/.test(t), t);
const sumLine=await pg.evaluate(()=>document.querySelector('.acw-sum').textContent);
ok('...and adds them up in one line, start to finish',
  /^\$3,843\.28 \+ \$3,000 − \$205\.64 = \$6,637\.64$/.test(sumLine.trim()), sumLine);
ok('...broken down by kind, with counts', /money in.*1.*\+\$3,000/s.test(t.replace(/\n/g,' ')) && /money out.*2/s.test(t.replace(/\n/g,' ')), t);
ok('...and the entries themselves, newest first', /Paycheck/.test(t) && /Food/.test(t));
ok('...and says out loud that the bank wins', /the bank is right/i.test(t));

/* the honest dismissal */
ok('there is a way to say the bank still says this',
  await pg.evaluate(()=>!!document.querySelector('[data-acctkeep="chk"]')));
ok('...labelled with the figure it would keep',
  /Bank still says \$3,843\.28/.test(t), t);
await pg.evaluate(()=>document.querySelector('[data-acctkeep="chk"]').click());
await pg.waitForTimeout(350);
const a=await pg.evaluate(()=>state.accounts.find(x=>x.id==='chk'));
ok('confirming changes no money', a.balance===3843.28, String(a.balance));
ok('...but moves the date, so it counts as checked', a.updated===await pg.evaluate(()=>todayStr()));
ok('...and records the gap rather than dismissing it',
  Math.abs(a.lastGap-(-2794.36))<0.01, String(a.lastGap));
ok('...and the prompt is gone, because there is nothing logged since now',
  !/Expected now/.test(await row()), await row());

/* is it recorded? */
ok('a reading was kept', (a.hist||[]).length>=1, JSON.stringify(a.hist));
ok('...with how it was arrived at', a.hist[a.hist.length-1].how==='confirmed', JSON.stringify(a.hist));

/* a typed balance, on a later day */
await pg.evaluate(()=>{
  const acc=state.accounts.find(x=>x.id==='chk');
  acc.hist=[{d:'2026-06-30',b:2000,how:'first'},{d:'2026-07-31',b:2500,how:'bank'}];
  acc.balance=2500; acc.updated='2026-07-31'; save(); renderAccounts();
});
await pg.waitForTimeout(250);
const inp=await pg.$('input[data-acctbal="chk"]');
await inp.fill('6637.64'); await inp.dispatchEvent('change'); await pg.waitForTimeout(350);
const a2=await pg.evaluate(()=>state.accounts.find(x=>x.id==='chk'));
ok('typing a new balance is recorded too', a2.hist.length===3 && a2.hist[2].b===6637.64, JSON.stringify(a2.hist));
ok('...and named as read off the bank', a2.hist[2].how==='bank');
await pg.evaluate(()=>{ const acc=state.accounts.find(x=>x.id==='chk'); acc.balance=6600; save(); });
const inp2=await pg.$('input[data-acctbal="chk"]');
await inp2.fill('6700'); await inp2.dispatchEvent('change'); await pg.waitForTimeout(300);
const a3=await pg.evaluate(()=>state.accounts.find(x=>x.id==='chk'));
ok('a correction the same day is one reading, not two',
  a3.hist.length===3 && a3.hist[2].b===6700, JSON.stringify(a3.hist));

/* the row says so */
await pg.evaluate(()=>renderAccounts()); await pg.waitForTimeout(250);
t=await row();
ok('the row says how many readings it holds', /3 readings since 2026-06-30/.test(t), t);
await pg.evaluate(()=>{ document.querySelector('.ac-hist').open=true; });
await pg.waitForTimeout(150); t=await row();
/* 2,000 on the 30th, 2,500 on the 31st, 6,700 today: the summary reports the
   distance from the FIRST reading to the last, not the last hop. */
ok('...and what moved between them, first reading to last', /up \$4,700/.test(t), t);
ok('...and that history starts the day the account was added',
  /cannot be recovered/i.test(t));

/* the aggregate trend can finally name which account moved */
await pg.evaluate(()=>{
  state.accounts=[
    {id:'chk',name:'Joint Checking',kind:'checking',balance:6637.64,updated:'2026-08-27',
     hist:[{d:'2026-07-31',b:3843.28,how:'bank'},{d:'2026-08-27',b:6637.64,how:'bank'}]},
    {id:'st',name:'Stash',kind:'invest',balance:16671.22,updated:'2026-08-26',
     hist:[{d:'2026-07-31',b:18671.22,how:'bank'},{d:'2026-08-26',b:16671.22,how:'bank'}]}];
  state.snapshots=[{month:'2026-07',bank:22514,owed:0},{month:'2026-08',bank:23308,owed:0}];
  save();
});
const read=await pg.evaluate(async()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('reflect'); rfTab='trends'; renderReflectTab(); await wait(250);
  trendPick='bank'; renderTrendSeries(); await wait(250);
  const pts=trendMonths(6).map(m=>({m, v:(state.snapshots.find(s=>s.month===m)||{}).bank ?? null}));
  const i=pts.findIndex(p=>p.m==='2026-08');
  return trendRead(TREND_SERIES.find(x=>x.k==='bank'), pts, i).replace(/<[^>]*>/g,' ');
});
ok('the aggregate is still the headline', /\$23,308/.test(read), read);
ok('...but it no longer hides which account did it',
  /Joint Checking up/.test(read) && /Stash down/.test(read), read);
ok('...with the real per-account figures, not the net',
  /2,794/.test(read) && /2,000/.test(read), read);

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
