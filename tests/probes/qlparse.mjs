import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const URL='file://'+process.cwd()+'/app.html';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,240):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto(URL);
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',s), JSON.stringify({
  onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',
  categories:[{id:'c1',name:'Getting around'},{id:'c2',name:'Trips'}],
  budgets:{'2026-08':{c1:200,c2:400}},
  transactions:[{id:'i',type:'income',amount:3000,date:'2026-08-01'}],
  accounts:[{id:'a1',name:'Free Checking',kind:'checking',balance:2000,updated:'2026-08-01'}],
  goals:[],impulse:[],recurring:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[]}));
await pg.reload(); await pg.waitForTimeout(600);

/* Exactly what the bank screen says, wrapped exactly as it wraps. */
const BANK=`Pending

Preauthorization / AI=867560,RR=623952
602847,PK=356239682557559 PMT*OH
BUREAU MOTOR VEHIC Held:2026-08-27
14:57:35 EDT Exp:2026-08-30 14:57:35 EDT
Aug 27, 2026
-$59.25

Preauthorization / AI=843880,RR=62
3913595672,PK=466239664376271
MAHONINGCTYTITLE Held:2026-08-27
14:27:17 EDT Exp:2026-08-30 14:27:17 EDT
Aug 27, 2026
-$21.49

Preauthorization / AI=157390,RR=62380
7855866,PK=466238683828615 Kindle
Unltd Held:2026-08-26 14:59:42 EDT
Exp:2026-08-29 14:59:42 EDT
Aug 26, 2026
-$12.89

Preauthorization / AI=107440,RR=623818
890417,PK=356238640867014 AIRBNB *
HMREJET25N Held:2026-08-26 13:48:06
EDT Exp:2026-08-29 13:48:06 EDT
Aug 26, 2026
-$329.00`;

const rows=await pg.evaluate(t=>qlParseOcr(t), BANK);
console.log(JSON.stringify(rows,null,1));

ok('four records, not nine fragments', rows.length===4, String(rows.length));
ok('the amounts are the amounts on the screen',
  JSON.stringify(rows.map(r=>r.amt))==='[59.25,21.49,12.89,329]', JSON.stringify(rows.map(r=>r.amt)));
ok('no reference number is ever mistaken for a price',
  !rows.some(r=>[23952,62,76271,2026,867560,843880].includes(r.amt)), JSON.stringify(rows.map(r=>r.amt)));
ok('the description stops before "Held"', !rows.some(r=>/Held/i.test(r.what)), JSON.stringify(rows.map(r=>r.what)));
ok('...and carries none of the bank plumbing',
  !rows.some(r=>/AI=|RR=|PK=|Preauthorization|EDT|Exp:/i.test(r.what)), JSON.stringify(rows.map(r=>r.what)));
ok('...and no stranded reference digits', !rows.some(r=>/\d{8,}/.test(r.what)), JSON.stringify(rows.map(r=>r.what)));
ok('the processor tag comes off the front', rows[0].what==='OH BUREAU MOTOR VEHIC', rows[0].what);
ok('a merchant with no tag is left exactly alone', rows[1].what==='MAHONINGCTYTITLE', rows[1].what);
ok('a two-word merchant survives the line wrap it was split across',
  rows[2].what==='Kindle Unltd', rows[2].what);
ok('a booking code comes off the end', rows[3].what==='AIRBNB', rows[3].what);
ok('nothing is read as money in, because a statement writes debits as minus',
  !rows.some(r=>r.kind==='income'), JSON.stringify(rows.map(r=>r.kind)));

/* a deposit, which is the one that does mean money arriving */
const dep=await pg.evaluate(t=>qlParseOcr(t),
  'ACH Credit / PAYROLL DIRECT DEP Held:2026-08-25 09:00:00 EDT\nAug 25, 2026\n+$1,300.00');
ok('an explicit plus is read as money in', dep.length===1 && dep[0].kind==='income', JSON.stringify(dep));
ok('...with the thousands separator handled', dep[0].amt===1300, String(dep[0].amt));

/* the handwriting path this was built for must not regress */
const pad=await pg.evaluate(t=>qlParseOcr(t), 'coffee 4.50\ngas 38\nlunch with sam 12.75');
ok('a handwritten notepad still reads the way it always did',
  pad.length===3 && pad[0].what==='coffee' && pad[0].amt===4.5
    && pad[1].amt===38 && pad[2].what==='lunch with sam' && pad[2].amt===12.75, JSON.stringify(pad));
const orphans=await pg.evaluate(()=>qlParseOcr('$14.00\n$9.99'));
ok('a price with nothing to call it is kept and flagged, never dropped',
  orphans.length===2 && orphans.every(x=>x.unnamed===true && x.what===''), JSON.stringify(orphans));
ok('a merchant with a star in its name keeps it',
  (await pg.evaluate(()=>qlParseOcr('Bed * Bath $40.00')))[0].what==='Bed * Bath',
  JSON.stringify(await pg.evaluate(()=>qlParseOcr('Bed * Bath $40.00'))));

/* the Clear button */
const clr=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(250);
  document.getElementById('quickLogBtn').click(); await w(250);
  const o={};
  o.exists=!!document.getElementById('qlClear');
  /* with nothing typed it just clears */
  document.getElementById('qlClear').click(); await w(120);
  o.emptyClearsAtOnce=document.getElementById('qlClear').textContent==='Clear';
  /* fill three rows */
  for(let i=0;i<2;i++) document.getElementById('qlAdd').click();
  const rows=[...document.querySelectorAll('.ql-row')];
  rows.forEach((r,i)=>{ r.querySelector('.ql-what').value='thing'+i;
    r.querySelector('.ql-amt').value=String(10+i); });
  document.getElementById('qlClear').click(); await w(120);
  o.armed=document.getElementById('qlClear').textContent;
  o.stillThere=document.querySelectorAll('.ql-row').length;
  document.getElementById('qlClear').click(); await w(150);
  o.after=document.querySelectorAll('.ql-row').length;
  o.emptyAfter=!document.querySelector('.ql-what').value && !document.querySelector('.ql-amt').value;
  o.label=document.getElementById('qlClear').textContent;
  /* typing again cancels an armed clear */
  document.querySelector('.ql-what').value='x';
  document.getElementById('qlClear').click(); await w(120);
  const armedAgain=document.getElementById('qlClear').textContent;
  document.querySelector('.ql-what').dispatchEvent(new Event('input',{bubbles:true})); await w(120);
  o.disarmedByTyping=document.getElementById('qlClear').textContent==='Clear' && armedAgain!=='Clear';
  return o;
});
ok('there is a Clear button', clr.exists===true);
ok('...which clears at once when there is nothing to lose', clr.emptyClearsAtOnce===true);
ok('...but asks first when there is', /Clear 3 lines\?/.test(clr.armed) && clr.stillThere===3, JSON.stringify(clr));
ok('...and the second tap actually clears', clr.after===1 && clr.emptyAfter===true);
ok('...and the button goes back to saying Clear', clr.label==='Clear');
ok('typing again cancels an armed clear', clr.disarmedByTyping===true);

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
