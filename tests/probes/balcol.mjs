import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
/* The exact page that was reported, typed out as the OCR would hand it over:
   description, amount, running balance, for each line. Every real amount must
   survive; not one balance may be logged as a transaction. */
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.waitForTimeout(900);
const R=[]; const ok=(n,v,d)=>R.push([n,!!v,d]);

const STATEMENT = `ACH Withdrawal / Acorns Invest
9000142693 Transfer 090126
855-739-2859 111924680794483
-$25.00
$5,086.75
Sep 1, 2026
ACH Withdrawal / Acorns Later
9000142693 Transfer 090126
855-739-2859 111924680245989
-$200.00
$5,111.75
Sep 1, 2026
ACH Withdrawal / Acorns Round-Ups
9000142693 Transfer 090126
855-739-2859 111924680992391
-$22.50
$5,311.75
Sep 1, 2026
ACH Withdrawal / Acorns Round-Ups
9000142693 Transfer 090126
855-739-2859 111924680992389
-$45.80
$5,334.25
Sep 1, 2026
ACH Withdrawal / Acorns Round-Ups
9000142693 Transfer 090126
855-739-2859 111924680040461
-$7.80
$5,380.05
Sep 1, 2026`;

const r=await pg.evaluate(t=>{
  const rows=qlParseOcr(t);
  return {rows:rows.map(x=>({what:(x.what||'').slice(0,26), amt:x.amt, unnamed:!!x.unnamed})),
          dropped:rows[0]?rows[0].balancesDropped:0};
}, STATEMENT);

const amts=r.rows.map(x=>x.amt).sort((a,b)=>a-b);
const want=[7.8,22.5,25,45.8,200];
ok('every real amount on the page survives', JSON.stringify(amts)===JSON.stringify(want), JSON.stringify(amts));
ok('...and not one running balance is logged as a transaction',
   !r.rows.some(x=>x.amt>4000), JSON.stringify(r.rows.filter(x=>x.amt>4000)));
ok('...five lines in, five rows out', r.rows.length===5, String(r.rows.length));
ok('...and it says how many balances it set aside', r.dropped>=4, String(r.dropped));
ok('the names come through, rather than the account number',
   r.rows.filter(x=>/Acorns/i.test(x.what)).length>=4, JSON.stringify(r.rows.map(x=>x.what)));

/* the OCR soup that came back as a transaction name */
const soup=await pg.evaluate(()=>qlParseOcr(`== 2° Nf 2°. G&G) <|Se
$25.00
Uber Eats order
$18.40`));
ok('a name OCR turned to soup is shown as unnamed, not as soup',
   soup.length===2 && soup[0].unnamed===true && soup[0].amt===25, JSON.stringify(soup));
ok('...while a real name beside it is kept', /Uber Eats/.test(soup[1].what||''), JSON.stringify(soup[1]));

/* and a statement with no balance column must not lose half its rows */
const plain=await pg.evaluate(()=>qlParseOcr(`POS DEBIT TESCO
-$14.20
POS DEBIT SHELL
-$52.00
POS DEBIT BOOTS
-$8.15
POS DEBIT ALDI
-$31.40`));
ok('a statement with no balance column keeps every row', plain.length===4, JSON.stringify(plain.map(x=>x.amt)));

/* several pages at once - the other half of the report */
const multi=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  /* the picker only exists once the panel is open - the first version of this
     check read a null element and reported the app's fault as its own */
  activateTab('tx');
  if(typeof openQuickLogFor==='function') openQuickLogFor(null);
  else { quickLogOpen=true; renderQuickLog(); }
  await w(700);
  const el=document.getElementById('qlPhoto');
  return {found:!!el, multiple:!!(el&&el.multiple),
          scan:!!(document.getElementById('scanFiles')||{}).multiple,
          holdsPages:typeof qlPages!=='undefined'};
});
ok('the quick log picker takes more than one photo', multi.found&&multi.multiple===true, JSON.stringify(multi));
ok('...and there is somewhere to hold the pages', multi.holdsPages===true, JSON.stringify(multi));
ok('the statement reader already did', multi.scan===true);

R.forEach(([n,p,d])=>{ if(!p) console.log('FAIL: '+n+(d?'  <'+d+'>':'')); });
const bad=R.filter(x=>!x[1]).length;
console.log(`${R.length-bad} of ${R.length} hold`);
console.log('page errors: '+(errs.length?errs.slice(0,2).join(' | '):'none'));
await b.close(); process.exit(bad||errs.length?1:0);
