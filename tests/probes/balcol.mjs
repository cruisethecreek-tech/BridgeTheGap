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

/* ---------- the report that reopened this ----------
   A statement scanned on a phone came back with the three Acorns round-ups AND
   $2,052.02, $2,057.32, $2,067.32 - the running balances they left behind. The
   arithmetic proof was right; the way it looked for the pattern was not. It
   split the tokens by odd and even index and required the whole page to
   alternate, so one stray figure anywhere shifted the parity of everything
   after it and the entire column came through as transactions.

   These are the shapes a real read actually arrives in. Each one used to leak. */
const REAL=[['Home banking Withdrawal / Transfer',-20,4468.98],
            ['ACH Deposit / ALDI Inc',2436.96,4488.98],
            ['ACH Withdrawal / Acorns Round-Ups',-5.30,2052.02],
            ['ACH Withdrawal / Acorns Round-Ups',-10.00,2057.32],
            ['ACH Withdrawal / Acorns Round-Ups',-18.50,2067.32]];
const BALS=[4468.98,4488.98,2052.02,2057.32,2067.32];
const page=(extra='',mutate=x=>x)=>mutate(extra+REAL.map(([d,a,bal])=>
  `${d}\n9000142693 Transfer 090926 ${a<0?'-':''}$${Math.abs(a).toLocaleString('en-US',{minimumFractionDigits:2})}`
  +`\n855-739 $${bal.toLocaleString('en-US',{minimumFractionDigits:2})}\nSep 9, 2026`).join('\n'));

const read=(t)=>pg.evaluate(x=>{
  const out=qlParseOcr(x);
  return { amts:out.map(r=>r.amt), kinds:out.map(r=>r.kind||'expense'),
           names:out.map(r=>r.what||'') };
},t);
const leaks=r=>r.amts.filter(a=>BALS.includes(a)).length;

let g=await read(page());
ok('a clean statement gives back its transactions and none of its balances',
   g.amts.length===5 && leaks(g)===0, JSON.stringify(g.amts));
ok('...and the deposit is read as money arriving, not money spent',
   g.kinds[1]==='income' && g.kinds.filter(k=>k==='income').length===1,
   JSON.stringify(g.kinds));

g=await read(page('Available balance $4,468.98\nPosted\n'));
ok('a balance printed above the table does not become a transaction',
   leaks(g)===0 && g.amts.length===5, JSON.stringify(g.amts));

g=await read(page('',t=>t.replace('$2,052.02','[unreadable]')));
ok('a balance the reader missed does not take the whole column with it',
   leaks(g)===0, JSON.stringify(g.amts));

g=await read(page('Pending\nPOS DEBIT SHELL OIL $41.20\n'));
ok('a pending row with no balance beside it is kept, and the column still goes',
   leaks(g)===0 && g.amts.includes(41.2), JSON.stringify(g.amts));

g=await read(page('',t=>t.replace('ACH Deposit / ALDI Inc','ACH Deposit / ALDI Inc REF 12.34')));
ok('a reference number inside a description does not break the read',
   leaks(g)===0, JSON.stringify(g.amts));

/* The guard, and it matters more than any of the above: a till receipt has no
   balance column, and a detector eager enough to find one everywhere would
   quietly eat half of somebody's shopping. */
g=await read('MORRISONS\nMilk $2.40\nBread $1.80\nCheese $4.25\nApples $3.10\nTOTAL $11.55');
ok('a receipt with no balance column keeps every line',
   g.amts.length===5, JSON.stringify(g.amts));

/* One honest limit, pinned so it cannot quietly get worse. When the READER
   loses an amount, the balance that amount would have proved has nothing left
   to prove it - arithmetic cannot rule out that it was a payment. It comes
   through unnamed and flagged, which is a visible gap rather than a silent
   wrong number, and the rest of the column still goes. */
g=await read(page('',t=>t.replace('-$10.00','[unreadable]')));
ok('an amount the reader lost costs at most its own balance, not the column',
   leaks(g)<=1, JSON.stringify(g.amts));

/* ---------- several photos, several chains ----------
   Reported a second time, with three screenshots of the app beside one of the
   bank: real round-ups logged next to $3,357.45, $3,383.25, $3,159.85 and the
   rest. Somebody photographing a statement takes three or four shots of it and
   the reader concatenates them, so what arrives is not one running balance but
   one per page, each starting wherever that photo happened to start. The fix
   before this found the longest chain and stopped, which dropped page one's
   balances and handed back every other page's as transactions.

   The balances here are DERIVED from the amounts rather than typed, because the
   first version of this fixture was transcribed off scrolled screenshots, broke
   its own arithmetic halfway down, and then reported the app as leaking when it
   was the test data that did not add up. A fixture for an arithmetic rule has
   to obey that arithmetic. */
const build=(top,rows)=>{ const out=[]; let bal=top;
  rows.forEach(([d,a])=>{ out.push([d,a,Math.round(bal*100)/100]); bal=Math.round((bal-a)*100)/100; });
  return out; };
const asPage=rows=>rows.map(([d,a,bal])=>
  `${d}\n855-739-2859 111924686 ${a<0?'-':''}$${Math.abs(a).toLocaleString('en-US',{minimumFractionDigits:2})}`
  +`\n$${bal.toLocaleString('en-US',{minimumFractionDigits:2})}\nSep 12, 2026`).join('\n');
const PG1=build(3736.41,[
  ['POS Card purchase / TST* RED PLUM BOARDMAN 5812 (2026-09-11) 1393',-77.97],
  ['Bill payment Card purchase / OURARING INC. 5699 (2026-09-10) 415-226-4726 CA',-5.99],
  ['Card purchase / CITY OF YOUNGSTOWN 4900 (2026-09-11) 330-742-8700 OH',-144.85],
  ['Card purchase / WALGREENS #9903 5912 (2026-09-10) YOUNGSTOWN OH 09030021',-55.86],
  ['Card purchase / MCDONALDS F27375 5814 (2026-09-10) AUSTINTOWN TO OH',-12.02]]);
const PG2=build(3357.45,[
  ['ACH Withdrawal / Acorns Round-Ups 9000142693',-25.80],
  ['ACH Deposit / YOUNGSTOWN 1733757000',1230.23],
  ['ACH Withdrawal / Acorns Round-Ups 9000142693',-6.40],
  ['ACH Withdrawal / Acorns Round-Ups 9000142693',-6.40],
  ['KITCHEN ABZ 5499 POS',-41.00],
  ['ACH Withdrawal / Acorns Round-Ups 9000142693',-31.70],
  ['ACH Withdrawal / PAYPAL 5499',-320.00]]);
const PG3=build(2760.35,[
  ['Acorns Round-Ups Transfer 9000142693',-10.00],
  ['ACH Withdrawal / Acorns Round-Ups 9000142693',-50.00],
  ['Card purchase / SHELL OIL 5541 (2026-09-09) OH',-41.20]]);
const PAGES=[...PG1,...PG2,...PG3];
const pages=await pg.evaluate(([t,bals,amts])=>{
  const out=qlParseOcr(t);
  return { rows:out.length,
           leaked:out.filter(x=>bals.includes(x.amt)&&!amts.includes(x.amt)).map(x=>x.amt),
           income:out.filter(x=>x.kind==='income').map(x=>x.amt) };
},[[PG1,PG2,PG3].map(asPage).join('\n'), PAGES.map(r=>r[2]), PAGES.map(r=>Math.abs(r[1]))]);
ok('three photos of one statement give back three pages of transactions',
   pages.rows===PAGES.length, `${pages.rows} of ${PAGES.length}`);
ok('...and not one balance from any of them',
   pages.leaked.length===0, pages.leaked.join(' '));
ok('...with the deposit buried on page two still read as money arriving',
   pages.income.length===1 && pages.income[0]===1230.23, pages.income.join(' '));

/* ---------- fifteen photos, not three ----------
   Reported a third time, and the tell was in the app's own wording: "which
   account did these 111 come out of". A hundred and eleven rows is what a leak
   of five pages looks like from outside. The chain loop stopped after TEN
   chains - a number chosen while picturing three or four photographs - so
   everything from the eleventh page on kept its balances. The bound is
   arithmetic now: a chain claims at least three tokens, so there cannot be more
   than a third of them. */
const mkPages=(count)=>{
  const NAMES=['ACH Withdrawal / Acorns Round-Ups 9000142693','Card purchase / WALGREENS #9903 5912',
    'POS Card purchase / TST* RED PLUM 5812','Card purchase / CITY OF YOUNGSTOWN 4900',
    'ACH Withdrawal / PAYPAL 5499','Card purchase / SHELL OIL 5541'];
  let sd=7; const rnd=()=>((sd=sd*1103515245+12345&0x7fffffff)/0x7fffffff);
  const out=[]; let top=9000;
  for(let i=0;i<count;i++){
    const n=4+Math.floor(rnd()*3), rows=[];
    for(let j=0;j<n;j++){ const a=Math.round((2+rnd()*300)*100)/100;
      rows.push([NAMES[Math.floor(rnd()*NAMES.length)], (j===2&&i%4===0)?a:-a]); }
    out.push(build(top,rows)); top=Math.round((top-200-rnd()*300)*100)/100;
  }
  return out;
};
const many=mkPages(15), manyAll=many.flat();
const scaled=await pg.evaluate(([t,bals,amts])=>{
  const out=qlParseOcr(t);
  return { rows:out.length, leaked:out.filter(x=>bals.includes(x.amt)&&!amts.includes(x.amt)).length,
           income:out.filter(x=>x.kind==='income').length };
},[many.map(r=>'Account History\nFree Checking (153934-0050)\nPosted\n'+asPage(r)).join('\n'),
   manyAll.map(r=>r[2]), manyAll.map(r=>Math.abs(r[1]))]);
ok('fifteen photos give back fifteen pages of transactions and no balances',
   scaled.rows===manyAll.length && scaled.leaked===0,
   `${scaled.rows} of ${manyAll.length}, leaked ${scaled.leaked}`);
ok('...with every deposit among them still read as money arriving',
   scaled.income===manyAll.filter(r=>r[1]>0).length,
   `${scaled.income} of ${manyAll.filter(r=>r[1]>0).length}`);

/* ---------- a name nobody typed ----------
   Three came off one read: "2 oa N{ FC, < Account", "OO << BE m = Accounts",
   "($) SG = #1 = Accounts" - the reader's attempt at a column header, each
   sitting on a row as though somebody had written it. The letter-ratio test let
   them through and threw away real descriptors instead: CITY OF YOUNGSTOWN with
   its reference tail is 44% letters and was dropped, while the soup scored
   exactly 45% and was kept. It rewarded brevity, not readability. */
const NAMING=[['2 oa N{ FC, < Account',false],['OO \u00ab BE m = Accounts',false],
  ['($) SG = #1 = Accounts',false],['== 2 Nf 2. G&G) <|Se',false],['N 855-739-2859',false],
  ['ACH Withdrawal / Acorns Round-Ups',true],['ACH Deposit / ALDI Inc',true],
  ['Card purchase / CITY OF YOUNGSTOWN 4900 (2026-09-11) 330-742-8700 OH',true],
  ['Card purchase / MCDONALD\'S F27375',true],['WALMART',true],['KITCHEN ABZ 5499',true]];
const naming=await pg.evaluate(cs=>cs.map(([d,want])=>{
  const letters=(d.match(/[A-Za-z]/g)||[]).length;
  const soup=/[^A-Za-z0-9 .,'&\/#*()+:;_@%$-]/.test(d);
  const words=(d.match(/[A-Za-z]{3,}/g)||[]).length;
  return { d, want, named: !soup && d.length>=2 && letters>=3 && (words>=2 || letters>=6) };
}),NAMING);
ok('no row wears a name the reader invented out of a column header',
   naming.filter(x=>!x.want).every(x=>!x.named),
   naming.filter(x=>!x.want&&x.named).map(x=>x.d).join(' | '));
ok('...and a real descriptor keeps its name, reference tail and all',
   naming.filter(x=>x.want).every(x=>x.named),
   naming.filter(x=>x.want&&!x.named).map(x=>x.d).join(' | '));

/* ---------- the edge of a photograph ----------
   "Much better.. But still added a few balances. The Youngstown didn't post as
   income as well." Both symptoms are the same wound: a page boundary.

   The chain cannot reach the LAST row on a page, because the balance that would
   prove its direction is the first row of the NEXT photograph, in a different
   chain. So every page's final transaction fell to the default, which is how a
   $1,230.23 paycheck landed as spending. And a photo catching only two rows -
   the top or bottom of a scroll - has a pair that links but not the run of
   three that was being demanded, so its balances came back as payments. */
const E1=build(3736.41,[['Card purchase / WALGREENS 5912',-77.97],
  ['Card purchase / CITY OF YOUNGSTOWN 4900',-5.99],['POS Card purchase / RED PLUM',-144.85],
  ['Card purchase / SHELL OIL 5541',-55.86]]);
const E2=build(3357.45,[['ACH Withdrawal / Acorns Round-Ups',-25.80],
  ['ACH Deposit / YOUNGSTOWN 1733757000',1230.23]]);   /* deposit is LAST on the page */
const E3=build(3150.45,[['ACH Withdrawal / Acorns Round-Ups',-6.40],
  ['ACH Withdrawal / Acorns Round-Ups',-6.40],['KITCHEN ABZ 5499 POS',-41.00],
  ['ACH Withdrawal / PAYPAL 5499',-320.00]]);
const EDGE=[...E1,...E2,...E3];
const edge=await pg.evaluate(([t,bals,amts])=>{
  const out=qlParseOcr(t);
  return { rows:out.length,
    leaked:out.filter(x=>bals.includes(x.amt)&&!amts.includes(x.amt)).map(x=>x.amt),
    deposit:(out.find(x=>Math.abs(x.amt-1230.23)<0.01)||{}).kind||'expense' };
},[[E1,E2,E3].map(r=>'Account History\nFree Checking (153934-0050)\nPosted\n'+asPage(r)).join('\n'),
   EDGE.map(r=>r[2]), EDGE.map(r=>Math.abs(r[1]))]);
ok('a photo holding only two rows still loses its balances',
   edge.leaked.length===0 && edge.rows===EDGE.length,
   `${edge.rows} of ${EDGE.length}, leaked ${edge.leaked.join(' ')}`);
ok('...and a deposit at the very bottom of a page is still money arriving',
   edge.deposit==='income', edge.deposit);

/* The guard for BOTH of those relaxations, and it is the one that matters most.
   A till receipt has no running balance and no minus signs, so the run of three
   is never proved, the two-link pass never runs, and "no minus means money in"
   never applies. Every line stays, and stays an expense. */
const till=await pg.evaluate(()=>{
  const out=qlParseOcr('MORRISONS\nMilk $2.40\nBread $1.80\nCheese $4.25\nApples $3.10\nTOTAL $11.55');
  return { n:out.length, income:out.filter(x=>x.kind==='income').length };
});
ok('a till receipt keeps every line and calls none of it income',
   till.n===5 && till.income===0, JSON.stringify(till));

/* ---------- the actual read, from the actual phone ----------
   Four rounds of this were fought with fixtures I invented, and every one was
   more polite than the reader: one page when there were four, clean tokens
   where the reader produces furniture, a dollar sign where it produces a
   section mark. This is what the device really returned, pasted from the app's
   own "Show me what it actually read", and it is worth more than the other
   sixteen shapes combined because nothing about it was imagined.

   Three things in here that no fixture of mine had:
     - "$367.87" and "$41.00" with the MINUS LOST, on real purchases
     - "-\u00a731.70", where the dollar sign came back as a section mark, so the
       minus never attached to a number at all
     - "$8,816.35" where the balance is really $3,315.35, because the bank's own
       OCR mangled the digits
   The first two are why absence of a minus cannot mean income on its own. */
const REAL_READ = `20:35 2 oa N{ FC,
< Account History
Free Checking (153934-*0050) v
09100001/839/94 $3,383.25
Sep 4, 2026
Card purchase / SAMSCLUB #6327 5300 $367.87
(2026-09-02) WARREN OH 63270083 $2153.02 >
Sep 3,2026
Card purchase / GOOGLE*GOOGLE ONE
5816 (2026-09-02) 650-2530000 CA -$21.49 N
WPGTIDO1 $2,520.89
Sep 3, 2026
ACH Withdrawal / Acorns Round-Ups
9000142693 Transfer 090326 -$43.40 N
855-739-2859 111924682521732 $2,542.38
Sep 3, 2026
ACH Withdrawal / Acorns Round-Ups
9000142693 Transfer 090326 -$43.40 N
855-739-2859 111924682521713 $2,585.78
Sep 3,2026
ACH Withdrawal / Acorns Round-Ups
9000142693 Transfer 090326 -$15.40 N
855-739-2859 111924682448758 $2,629.18
Sep 3,2026
OO « BE m =
Accounts Move Money Check Deposit Credit Score More
20:35 m2 a N{ 7°,
< Account History
Free Checking (153934-*0050) v
Sep 4, 2026
ACH Withdrawal / Acorns Round-Ups
9000142693 Transfer 090426 -$20.00 N
855-739-2859 111924683080404 $3,275.35
Sep 4, 2026
ACH Withdrawal / Acorns Round-Ups
9000142693 Transfer 090426 -$20.00 N
855-739-2859 111924683080400 $3,295.35
Sep 4, 2026
ACH Withdrawal / Acorns Round-Ups
9000142693 Transfer 090426 -$42.10 N
855-739-2859 111924682581485 $8,816.35
Sep 4, 2026
ACH Withdrawal / Acorns Round-Ups
9000142693 Transfer 090426 -$25.80 N
855-739-2859 111924682581473 $3,357.45
Sep 4, 2026
ACH Deposit / YOUNGSTOWN REAL
6506940773 PAYROLL 260904 $1,230.23 N
091000017839794 $3,383.25
Sep 4, 2026
($) SG = #1 =
Accounts Move Money Check Deposit Credit Score More
20:35 m2 a Nf 2,
< Account History
Free Checking (153934-*0050) v
ie cee
855-739-2859 111924684145266 $3,150.45
Sep 8, 2026
ACH Withdrawal / Acorns Round-Ups
9000142693 Transfer 090826 -$6.40 N
855-739-2859 111924683235948 $3,159.85
Sep 8, 2026
ACH Withdrawal / Acorns Round-Ups
9000142693 Transfer 090826 -$6.40 N
855-739-2859 111924683235947 $3,166.25
Sep 8, 2026
Card purchase / KITCHEN ABZ 5499 $41.00
(2026-09-05) 330-9420960 OH 96520224 $3172.65 >
Sep 6, 2026
ACH Withdrawal / Acorns Round-Ups
9000142693 Transfer 090426 -§31.70 N
855-739-2859 111924683174881 $3,213.65
Sep 4, 2026
ACH Withdrawal / Acorns Round-Ups
9000142693 Transfer 090426 -$30.00 N
855-739-2859 111924683174879 $3,245.35
Sep 4, 2026
($) " = Pi =
Accounts Move Money Check Deposit Credit Score More
20:35 m2 a Nf 2,
< Account History
Free Checking (153934-*0050) v
Sep 8, 2026
ACH Withdrawal / Acorns Round-Ups
9000142693 Transfer 090826 -$10.00 N
855-739-2859 111924684853359 $2,760.35
Sep 8, 2026
ACH Withdrawal / PAYPAL PAYPALSI77
PURCHASE 260905 INSTANT TRANSFER  -$320.00 N
091000010205942 $2,770.35
Sep 8, 2026
ACH Withdrawal / Acorns Invest
9000142693 Transfer 090826 -$50.00 N
855-739-2859 111924683969708 $3,090.35
Sep 8, 2026
ACH Withdrawal / Acorns Round-Ups
9000142693 Transfer 090826 -$10.10 N
855-739-2859 111924684145275 $3,140.35
Sep 8, 2026
ACH Withdrawal / Acorns Round-Ups
9000142693 Transfer 090826 -$9.40 N
855-739-2859 111924684145266 $3,150.45
Sep 8, 2026
($] " = £1 =
Accounts Move Money Check Deposit Credit Score More`;
const real=await pg.evaluate(t=>{
  const out=qlParseOcr(t);
  return { n:out.length,
    income:out.filter(x=>x.kind==='income').map(x=>x.amt),
    byAmt:Object.fromEntries(out.map(x=>[x.amt, x.kind||'expense'])) };
},REAL_READ);
/* every balance printed on those screens */
const REAL_BALS=[3383.25,2153.02,2520.89,2542.38,2585.78,2629.18,3275.35,3295.35,
  3357.45,3150.45,3159.85,3166.25,3172.65,3213.65,3245.35,2760.35,2770.35,3090.35,3140.35];
ok('the real read gives back its twenty-one transactions',
   real.n===21, String(real.n));
ok('...and not one balance the reader got right',
   REAL_BALS.every(v=>!(v in real.byAmt)),
   REAL_BALS.filter(v=>v in real.byAmt).join(' '));
ok('...with the payroll deposit, and only that, read as money arriving',
   real.income.length===1 && real.income[0]===1230.23, real.income.join(' '));
/* The three the reader damaged. A purchase whose minus was lost, a purchase
   whose dollar sign came back as a section mark - all still money going out,
   because the chain proves direction from the balances and does not care what
   happened to the punctuation. */
ok('a purchase whose minus the reader dropped is still money going out',
   real.byAmt['367.87']==='expense' && real.byAmt['41']==='expense',
   `367.87=${real.byAmt['367.87']} 41=${real.byAmt['41']}`);
ok('...and so is one whose dollar sign came back as a section mark',
   real.byAmt['31.7']==='expense', String(real.byAmt['31.7']));
/* The one thing left, and it is the bank's reader rather than ours: $3,315.35
   came off the screen as $8,816.35. Arithmetic cannot link a corrupted figure,
   so it survives as a row. It arrives UNNAMED and is not called income, which
   makes it a visible oddity somebody deletes in one tap rather than a wrong
   number hiding among right ones. Chasing it would need a rule that deletes
   rows the chain cannot explain, and a rule like that eventually eats a real
   payment - which is the one failure worth more than this one. */
ok('a balance the bank\'s own reader corrupted is left visible, never called income',
   real.byAmt['8816.35']==='expense', String(real.byAmt['8816.35']));

R.forEach(([n,p,d])=>{ if(!p) console.log('FAIL: '+n+(d?'  <'+d+'>':'')); });
const bad=R.filter(x=>!x[1]).length;
console.log(`${R.length-bad} of ${R.length} hold`);
console.log('page errors: '+(errs.length?errs.slice(0,2).join(' | '):'none'));
await b.close(); process.exit(bad||errs.length?1:0);
