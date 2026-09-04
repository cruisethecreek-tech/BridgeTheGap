import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,260):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
/* the screenshot's own day: five on Aug 28, typed in this order, Fees last */
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',s), JSON.stringify({
  onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',
  categories:[{id:'c1',name:'Getting Around'},{id:'c2',name:'Fees'},{id:'c3',name:'Power & Wi-Fi'}],
  budgets:{'2026-08':{c1:300,c2:100,c3:200}},
  transactions:[
    {id:'t1',type:'expense',amount:329,date:'2026-08-28',catId:'c1',note:'Sugarcreek'},
    {id:'t2',type:'expense',amount:59.25,date:'2026-08-28',catId:'c1',note:'OH BUREAU MOTOR VEHIC'},
    {id:'t3',type:'expense',amount:12.89,date:'2026-08-28',catId:'c1',note:'Kindle Unltd'},
    {id:'t4',type:'expense',amount:52.77,date:'2026-08-28',catId:'c1'},
    {id:'t5',type:'expense',amount:21.49,date:'2026-08-28',catId:'c2'},
    {id:'t6',type:'expense',amount:60.70,date:'2026-08-27',catId:'c3'},
    {id:'t7',type:'expense',amount:44.16,date:'2026-08-26',catId:'c1',note:'Franks'}],
  accounts:[],goals:[],impulse:[],recurring:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[]}));
await pg.reload(); await pg.waitForTimeout(700);

const read=()=>pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(500);
  return [...document.querySelectorAll('#txList .tx')].map(x=>x.dataset.txsheet);
});
let order=await read();
ok('the newest thing logged today is first, not fifth',
  order[0]==='t5', JSON.stringify(order));
ok('...and the rest of today follows, newest to oldest',
  JSON.stringify(order.slice(0,5))==='["t5","t4","t3","t2","t1"]', JSON.stringify(order));
ok('...with older days still below today',
  order[5]==='t6' && order[6]==='t7', JSON.stringify(order));

/* and a genuinely new entry, added through the real form, lands at the top */
const after=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(400);
  document.getElementById('txAmt').value='9.99';
  document.getElementById('txDate').value='2026-08-28';
  document.getElementById('txCat').value='c2';
  document.getElementById('txNote').value='Brand new';
  document.getElementById('addTx').click(); await w(500);
  const first=document.querySelector('#txList .tx');
  return first?first.innerText.replace(/\n/g,' '):'';
});
ok('an entry logged right now appears at the top of its day',
  /Brand new/.test(after), after);

/* the photo path says what it actually accepts */
const photo=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(300);
  document.getElementById('quickLogBtn').click(); await w(350);
  const head=document.getElementById('quickLog').innerText;
  return { label:(document.getElementById('qlSnap')||{}).textContent||'(missing)', head };
});
ok('the camera button is not named for one kind of paper',
  !/notepad/i.test(photo.label) && /photo/i.test(photo.label), photo.label);

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
