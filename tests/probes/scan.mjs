/* "Instead of taking actual screenshots is a scan feature possible where I can
   open up my bank statement and quickly skim all the transactions... even if it
   wasn't completely uploaded into the track portion, would be nice if it could
   analyze my spending habits and notice where I'm spending too much, to report
   back in reflect." Tesseract is not run here - the reader is already covered by
   qlocr. What is walked is everything downstream of it. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:1200}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',hourlyWage:25,
  categories:[{id:'c1',name:'Food'}],budgets:{'2026-08':{c1:400}},
  transactions:[{id:'i1',type:'income',amount:3200,date:'2026-08-01'}],
  goals:[],impulse:[],recurring:[],accounts:[{id:'a1',name:'Chequing',kind:'checking',balance:2000,updated:'2026-08-01'}],
  assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[],scans:[]});
await pg.reload(); await pg.waitForTimeout(900);

/* ---- 1. the panel exists, is reachable, and is wired ---- */
const panel = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); deckShow('tx','Read a statement'); await w(600);
  const p=document.getElementById('scanPanel');
  return { there:!!p, visible:!!(p&&p.offsetParent!==null),
    heading:(p&&p.querySelector('h2').textContent)||'',
    blurb:(p&&p.querySelector('.sub').textContent)||'',
    snap:!!document.getElementById('scanSnap'), pick:!!document.getElementById('scanPick'),
    multi:(document.getElementById('scanFiles')||{}).multiple===true,
    camOnly:(document.getElementById('scanCam')||{}).getAttribute('capture')==='environment',
    startNote:(document.getElementById('scanNote')||{textContent:''}).textContent };
});
ok('the statement reader is a real panel on Track', panel.there && panel.visible && /Read a statement/.test(panel.heading), panel.heading);
ok('...it says the pages never leave the device', /no upload/i.test(panel.blurb) && /nothing leaves the browser/i.test(panel.blurb), panel.blurb.slice(0,120));
ok('...and that nothing lands in the ledger on its own', /nothing lands in your ledger unless you send it there/i.test(panel.blurb), panel.blurb.slice(-90));
ok('it takes MANY pages, which is the whole ask', panel.multi===true && panel.camOnly===true);
ok('...offering both the camera and the photo roll', panel.snap && panel.pick);
ok('...and says up front what reads well and what does not', /Reads best/.test(panel.startNote) && /Reads worst/.test(panel.startNote), panel.startNote.slice(0,120));

/* ---- 2. grouping, without needing a single category to exist ---- */
const grp = await pg.evaluate(() => {
  const g=t=>scanGroupOf(t).g;
  return { coffee:g('STARBUCKS STORE 4471'), gas:g('SHELL OIL 12345678'),
    grocery:g('KROGER #221'), sub:g('NETFLIX.COM'), rent:g('GREYSTAR RENT PMT'),
    roth:g('TRANSFER TO SAVINGS'), fee:g('OVERDRAFT FEE'), takeout:g('DOORDASH*WENDYS'),
    junk:g('ZZQ HOLDINGS LLC'), blank:g(''),
    /* the ordered-list property: the specific must beat the generic word in it */
    order:g('AMAZON PRIME'), plain:g('AMAZON MKTPLACE') };
});
ok('a merchant is placed with no categories of your own in play',
   grp.coffee==='Coffee' && grp.gas==='Gas and fuel' && grp.grocery==='Groceries' && grp.rent==='Rent or mortgage',
   JSON.stringify(grp));
ok('...money that stayed yours is not called spending', grp.roth==='Put away', grp.roth);
ok('...a fee is named as one', grp.fee==='Fees and interest', grp.fee);
ok('...and the specific beats the generic word inside it',
   grp.order==='Subscriptions' && grp.plain==='Online shopping', grp.order+'/'+grp.plain);
ok('a name it cannot place is not guessed at, it is admitted',
   grp.junk==='Not recognised' && grp.blank==='Not recognised', grp.junk+'/'+grp.blank);

/* ---- 3. the dedupe, which is what makes the drip count mean anything ---- */
const merged = await pg.evaluate(() => {
  const p1=[{what:'STARBUCKS',amt:5.25},{what:'SHELL OIL',amt:48.10},{what:'STARBUCKS',amt:5.25}];
  const p2=[{what:'SHELL OIL',amt:48.10},{what:'KROGER',amt:112.44}];   // overlap: Shell again
  const p3=[{what:'STARBUCKS',amt:5.25}];                                // page 3 re-shows one coffee
  const out=scanMerge([p1,p2,p3]);
  return { n:out.length, keys:out.map(r=>r.what+':'+r.amt),
    /* two genuinely separate coffees on ONE page are two coffees */
    twoOnOnePage:scanMerge([[{what:'STARBUCKS',amt:5.25},{what:'STARBUCKS',amt:5.25}]]).length,
    /* the same coffee re-photographed is one coffee */
    sameAcross:scanMerge([[{what:'STARBUCKS',amt:5.25}],[{what:'STARBUCKS',amt:5.25}]]).length };
});
ok('an overlapping page does not double-count what the last one already gave',
   merged.n===4 && merged.sameAcross===1, `${merged.n} kept: ${merged.keys.join(', ')}`);
ok('...while two real charges on one page both survive', merged.twoOnOnePage===2, String(merged.twoOnOnePage));

/* ---- 4. the reading ---- */
const read = await pg.evaluate(() => {
  const recs=[
    {what:'STARBUCKS',amt:5.25},{what:'STARBUCKS',amt:4.85},{what:'STARBUCKS',amt:6.10},
    {what:'DUNKIN',amt:3.90},{what:'STARBUCKS',amt:5.25},
    {what:'KROGER',amt:212.44},{what:'SHELL OIL',amt:48.10},
    {what:'GREYSTAR RENT PMT',amt:1450},{what:'TRANSFER TO SAVINGS',amt:300},
    {what:'ZZQ HOLDINGS LLC',amt:88.00},
    {what:'PAYROLL DEPOSIT',amt:2600,kind:'income'}];
  const R=scanRead(recs);
  return { spent:R.spent, putAway:R.putAway, inAmt:R.inAmt, out:R.spendCount, inC:R.inCount,
    top:R.top&&R.top.g, topPct:R.topPct, unknownPct:R.unknownPct,
    drip:R.drips[0]&&{g:R.drips[0].g,n:R.drips[0].n,amt:R.drips[0].amt,avg:R.drips[0].avg},
    putAwayInSpend:R.spendGroups.some(g=>g.keep),
    groups:R.groups.map(g=>g.g) };
});
/* by hand: 5.25+4.85+6.10+3.90+5.25 = 25.35 coffee; +212.44 +48.10 +1450 +88 = 1823.89
   spent. The $300 into savings is NOT in that total - see below. */
ok('the reading totals what was spent, and keeps money in separate',
   read.spent===1823.89 && read.inAmt===2600 && read.out===9 && read.inC===1,
   JSON.stringify([read.spent,read.inAmt,read.out,read.inC]));
ok('...the biggest place it went is named', read.top==='Rent or mortgage' && read.topPct===79.5,
   read.top+' '+read.topPct);
/* The fault this replaced: the headline counted a $300 transfer into savings as
   money that went out, so the best thing in the statement made the month look
   worse. Put away is still SHOWN - it is just not spending, and every
   percentage divides by what was actually spent. */
ok('...money you put away is never counted as money that went out',
   read.putAwayInSpend===false && read.groups.includes('Put away') && read.putAway===300,
   String(read.putAway));
ok('...the drip is counted: five coffees nobody adds up by eye',
   read.drip && read.drip.g==='Coffee' && read.drip.n===5 && read.drip.amt===25.35 && read.drip.avg===5.07,
   JSON.stringify(read.drip));
ok('...and the share it could not place is stated, not hidden',
   read.unknownPct===4.8, String(read.unknownPct));

/* The bug the first render showed on sight: bare substring matching filed
   NETFLIX.COM as retirement saving, because n-ETF-lix contains "etf". A
   subscription reported as savings moves money out of the column this app is
   trying to grow, silently. Word boundaries, and a phrase stays a phrase. */
const bound = await pg.evaluate(() => ({
  netflix:scanGroupOf('NETFLIX.COM').g,
  realEtf:scanGroupOf('VANGUARD ETF PURCHASE').g,
  phrase:scanGroupOf('SQ *BLUE BOTTLE').g,
  star:scanGroupOf('TST* THE DINER').g,
  bp:scanGroupOf('BP#3492 FUEL').g,
  notBp:scanGroupOf('BPAY SERVICES').g,
  ira:scanGroupOf('FIDELITY IRA CONTRIB').g,
  notIra:scanGroupOf('MIRAGE HOTEL').g }));
ok('a three-letter ticker inside a longer word is not a match',
   bound.netflix==='Subscriptions' && bound.notIra!=='Put away' && bound.notBp!=='Gas and fuel',
   JSON.stringify(bound));
ok('...while the real one still is', bound.realEtf==='Put away' && bound.ira==='Put away',
   bound.realEtf+'/'+bound.ira);
ok('...and a keyword written as a phrase stays a phrase',
   bound.phrase==='Eating out' && bound.star==='Eating out' && bound.bp==='Gas and fuel',
   JSON.stringify([bound.phrase,bound.star,bound.bp]));

/* ---- 5. Reflect: a reading, labelled as one, next to the ledger not inside it ---- */
const rep = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const sig=REPORT_SIGNALS.find(s=>s.k==='scanRead');
  const before=sig.run();
  state.scans=[{at:'2026-08-30',pages:3,spent:1823.89,putAway:300,inAmt:2600,outCount:9,unknownPct:4.8,
    groups:[{g:'Rent or mortgage',emoji:'🏠',amt:1450,n:1},{g:'Groceries',emoji:'🛒',amt:212.44,n:1},{g:'Coffee',emoji:'☕',amt:25.35,n:5}],
    drips:[{g:'Coffee',emoji:'☕',amt:25.35,n:5,avg:5.07}]}];
  save();
  const after=sig.run();
  const nwBefore=netWorth(), txBefore=state.transactions.length;
  activateTab('reflect'); await w(700);
  const card=[...document.querySelectorAll('#reportCards .rp-card, .rp-card')]
    .map(c=>c.innerText).find(t=>/statement read/i.test(t))||'';
  return { lockedFirst:!!(before&&before.locked), door:before&&before.do,
    title:after.t, body:after.body, work:after.work, nudge:after.nudge, bad:after.bad,
    card, nwSame:netWorth()===nwBefore, txSame:state.transactions.length===txBefore };
});
ok('with nothing scanned the card says what it needs and offers the door',
   rep.lockedFirst===true && rep.door==='scan', JSON.stringify([rep.lockedFirst,rep.door]));
ok('a kept reading reaches Reflect', /statement read/i.test(rep.title) && rep.card.length>0, rep.title);
ok('...and calls itself a reading in its own title, not a month',
   /Your last statement read/.test(rep.title), rep.title);
ok('...naming the pages and the day it was read off', /<b>3<\/b> pages on 2026-08-30/.test(rep.body), rep.body.slice(0,120));
ok('...and saying there that put-away money is not spending',
   /\$300<\/b> moved and stayed yours, which is not counted as spending/.test(rep.body), rep.body.slice(0,220));
ok('...it names the biggest bucket and prices it', /rent or mortgage/i.test(rep.body) && /\$1,450/.test(rep.body), rep.body.slice(0,200));
ok('...surfaces the drip, which the statement itself cannot show you',
   /coffee/i.test(rep.body) && /5<\/b> separate goes/.test(rep.body), rep.body.slice(-160));
ok('...shows its working like every other card here', /79\.5% of what you spent/.test(rep.work), rep.work);
ok('...and says plainly it is a photograph, not the ledger',
   /reading of a photograph, not your ledger/.test(rep.nudge), rep.nudge.slice(0,120));
ok('keeping a reading moves nothing else in the app', rep.nwSame===true && rep.txSame===true);

/* ---- 6. a reading nobody should trust says so itself ---- */
const shaky = await pg.evaluate(() => {
  state.scans=[{at:'2026-08-30',pages:2,spent:1000,inAmt:0,outCount:9,unknownPct:44.0,
    groups:[{g:'Groceries',emoji:'🛒',amt:300,n:2}],drips:[]}];
  save();
  return REPORT_SIGNALS.find(s=>s.k==='scanRead').run().nudge;
});
ok('a reading that could not place a third of the money says so first',
   /Treat this one gently/.test(shaky) && /<b>44%<\/b> of it landed in <b>Not recognised<\/b>/.test(shaky), shaky.slice(0,140));

/* ---- 7. the push into Track is opt-in, reviewed, and writes nothing by itself ---- */
const push = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); deckShow('tx','Read a statement'); await w(500);
  const txBefore=state.transactions.length;
  scanResult={ pages:1, dropped:0, at:'2026-08-30', text:'raw',
    records:[{what:'STARBUCKS',amt:5.25},{what:'KROGER',amt:112.44},{what:'',amt:9.99,unnamed:true}],
    read:scanRead([{what:'STARBUCKS',amt:5.25},{what:'KROGER',amt:112.44},{what:'',amt:9.99,unnamed:true}]) };
  scanToQuickLog(); await w(400);
  const rows=[...document.querySelectorAll('#qlList .ql-row')];
  const filled=rows.filter(r=>r.querySelector('.ql-amt').value);
  return { txSame:state.transactions.length===txBefore,
    open:!!document.querySelector('#quickLog .ql-panel'),
    filled:filled.length,
    amounts:filled.map(r=>r.querySelector('.ql-amt').value),
    unnamedFlagged:!!document.querySelector('#qlList .ql-row.ql-unnamed'),
    note:(document.getElementById('qlOcrNote')||{textContent:''}).textContent,
    /* the seed must be consumed - a second render cannot paste them again */
    afterRerender:(renderQuickLog(), [...document.querySelectorAll('#qlList .ql-row')].filter(r=>r.querySelector('.ql-amt').value).length) };
});
ok('sending a reading to Track writes no transaction on its own', push.txSame===true);
ok('...it opens the quick log with every record waiting for review',
   push.open===true && push.filled===3 && push.amounts.includes('5.25') && push.amounts.includes('9.99'),
   JSON.stringify(push.amounts));
ok('...an amount that lost its name is flagged rather than dropped', push.unnamedFlagged===true);
ok('...and the panel says nothing has counted yet', /Nothing has counted yet/.test(push.note), push.note.slice(0,120));
ok('the handover is consumed once - a redraw does not paste them twice',
   push.afterRerender===0, String(push.afterRerender));

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
