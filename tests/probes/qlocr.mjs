import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const URL='file://'+process.cwd()+'/app.html';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,240):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto(URL);
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',s), JSON.stringify({
  onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',hourlyWage:70,
  categories:[{id:'c1',name:'Getting around'}],budgets:{'2026-08':{c1:200}},
  transactions:[{id:'i',type:'income',amount:3000,date:'2026-08-01'},
                {id:'e1',type:'expense',amount:59.25,date:'2026-08-27',catId:'c1',note:'OH BUREAU MOTOR VEHIC',acctId:'a1'}],
  accounts:[{id:'a1',name:'Joint Checking',kind:'checking',balance:2000,updated:'2026-08-01'}],
  goals:[],impulse:[],recurring:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[]}));
await pg.reload(); await pg.waitForTimeout(600);

/* What OCR actually hands back: the $ survives on one and not the others. */
const OCR=[
 'Pending',
 'Preauthorization / AI=867560,RR=623952',
 '602847,PK=356239682557559 PMT*OH',
 'BUREAU MOTOR VEHIC Held:2026-08-27',
 '14:57:35 EDT Exp:2026-08-30 14:57:35 EDT',
 'Aug 27, 2026','-$59.25',
 'Preauthorization / AI=843880,RR=62',
 '3913595672,PK=466239664376271',
 'MAHONINGCTYTITLE Held:2026-08-27',
 '14:27:17 EDT Exp:2026-08-30 14:27:17 EDT',
 'Aug 27, 2026','-21.49',
 'Preauthorization / AI=157390,RR=62380',
 '7855866,PK=466238683828615 Kindle',
 'Unltd Held:2026-08-26 14:59:42 EDT',
 'Exp:2026-08-29 14:59:42 EDT',
 'Aug 26, 2026','—12.89',
 'Preauthorization / AI=107440,RR=623818',
 '890417,PK=356238640867014 AIRBNB *',
 'HMREJET25N Held:2026-08-26 13:48:06',
 'EDT Exp:2026-08-29 13:48:06 EDT',
 'Aug 26, 2026','-329.00'].join('\n');

const r=await pg.evaluate(t=>qlParseOcr(t), OCR);
console.log(JSON.stringify(r));
ok('all four survive even when OCR eats three of the dollar signs',
  r.length===4, String(r.length));
ok('...with the right amounts',
  JSON.stringify(r.map(x=>x.amt))==='[59.25,21.49,12.89,329]', JSON.stringify(r.map(x=>x.amt)));
ok('...and the right names',
  JSON.stringify(r.map(x=>x.what))==='["OH BUREAU MOTOR VEHIC","MAHONINGCTYTITLE","Kindle Unltd","AIRBNB"]',
  JSON.stringify(r.map(x=>x.what)));
ok('no reference number sneaks in as a price',
  !r.some(x=>x.amt>100000||[2026,62,623952].includes(x.amt)));

const clean=await pg.evaluate(()=>qlParseOcr('Preauthorization / AI=1,RR=2 PMT*SHELL OIL Held:2026-08-01\nAug 1, 2026\n-$40.00'));
ok('a clean single record still reads', clean.length===1 && clean[0].amt===40 && clean[0].what==='SHELL OIL', JSON.stringify(clean));

/* the notepad path, decided by the text rather than by whether a pattern hit */
const pad=await pg.evaluate(()=>qlParseOcr('coffee 4.50\ngas 38\nlunch with sam 12.75'));
ok('a handwritten notepad still reads every line, decimals or not',
  pad.length===3 && pad[1].what==='gas' && pad[1].amt===38, JSON.stringify(pad));
const padD=await pg.evaluate(()=>qlParseOcr('coffee $4.50\ngas $38'));
ok('...and a notepad with dollar signs is read as a statement, correctly',
  padD.length===2 && padD[0].what==='coffee' && padD[1].amt===38, JSON.stringify(padD));
ok('a statement with no readable amount reports nothing rather than guessing',
  await pg.evaluate(()=>qlParseOcr('Preauthorization / AI=99,RR=88 SOME MERCHANT Held:2026-08-01').length)===0);

/* --- the delete --- */
const del=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  activateTab('tx'); await w(250);
  openTxSheet('e1'); await w(300);
  const body=()=>document.getElementById('txSheetBody').innerText;
  o.startsAsButton=!!document.querySelector('[data-txdel="e1"]') && !document.querySelector('.cs-arm');
  const n0=state.transactions.length;
  document.querySelector('[data-txdel="e1"]').click(); await w(250);
  o.armedNotFired=state.transactions.length===n0 && !!document.querySelector('.cs-arm');
  o.question=document.querySelector('.cs-arm').innerText;
  document.querySelector('[data-txdelno]').click(); await w(220);
  o.keptIt=state.transactions.length===n0 && !document.querySelector('.cs-arm');
  /* a stale arm must not survive leaving the sheet */
  document.querySelector('[data-txdel="e1"]').click(); await w(200);
  closeTxSheet(); openTxSheet('e1'); await w(280);
  o.reopenNotArmed=!document.querySelector('.cs-arm') && txDelArm===null;
  /* and the real thing */
  document.querySelector('[data-txdel="e1"]').click(); await w(220);
  document.querySelector('[data-txdelyes="e1"]').click(); await w(380);
  o.gone=!state.transactions.some(t=>t.id==='e1');
  o.sheetClosed=!document.getElementById('txSheet').classList.contains('on');
  return o;
});
ok('the delete starts as a button, not a question', del.startsAsButton===true);
ok('...and one tap arms it rather than deleting anything', del.armedNotFired===true);
ok('...with the question naming the amount and what it was',
  /\$59\.25/.test(del.question) && /Getting around/.test(del.question), del.question);
ok('...and saying what the plan gets back',
  /gets the \$59\.25 back/.test(del.question), del.question);
ok('"Keep it" changes nothing', del.keptIt===true);
ok('an armed delete never survives leaving the sheet', del.reopenNotArmed===true);
ok('confirming actually deletes', del.gone===true);
ok('...and the sheet it just emptied closes itself', del.sheetClosed===true);

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
