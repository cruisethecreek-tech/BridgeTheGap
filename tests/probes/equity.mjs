import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
/* Reported with the arithmetic done: "$132,000 equity - 37.1% of its value".
   78,000 / 210,000 = 37.1%, which is the LOAN. The equity share is
   132,000 / 210,000 = 62.9%. The number was right and the caption made it a lie:
   the reader is told their equity is 37.1% of the value.
   This checks the pairing, not the arithmetic - the arithmetic was never wrong. */
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'full',activeMonth:'2026-09',hourlyWage:70,
  categories:[{id:'c1',name:'Food'}],budgets:{'2026-09':{c1:400}},
  debts:[{id:'m1',name:'Bears Den mortgage',balance:78000,apr:4.375,min:850,kind:'mortgage',worth:210000,secured:true},
         {id:'m2',name:'Upside down car',balance:19000,apr:7.9,min:410,kind:'auto',worth:14000,secured:true},
         {id:'h1',name:'Heloc',balance:1282.76,apr:3.49,min:100,kind:'heloc',limit:25000,secured:true}]});
await pg.reload(); await pg.waitForTimeout(1500);
const R=[]; const ok=(n,v,d)=>R.push([n,!!v,d]);

const nums=await pg.evaluate(()=>{
  const m=(state.debts||[]).find(d=>d.id==='m1');
  return {ltv:debtLTV(m), eqPct:debtEquityPct(m), eq:debtEquity(m)};
});
ok('the loan-to-value is still worked out, and still right', nums.ltv===37.1, String(nums.ltv));
ok('...and the share that is actually yours is its complement',
   nums.eqPct===62.9 && nums.eq===132000, JSON.stringify(nums));

const row=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); await w(700);
  const txt=[...document.querySelectorAll('#view-debt .dr-eq')]
    .map(x=>x.innerText.replace(/\s+/g,' ').trim());
  return txt;
});
const mort=row.find(t=>/132,000/.test(t))||'';
ok('the equity figure carries the equity share, not the debt share',
   /62\.9%/.test(mort) && !/37\.1%/.test(mort), mort);
ok('...and says whose it is, in words', /of it is yours/i.test(mort), mort);
ok('...so no figure is captioned as something it is not',
   !/132,000 equity.*37\.1% of its value/.test(mort), mort);

const under=row.find(t=>/underwater/i.test(t))||'';
ok('underwater is the one case the loan-to-value IS the story',
   /5,000 underwater/.test(under) && /135\.7%/.test(under), under);
ok('...and it says it is the loan it is talking about',
   /owe .*% of its value/i.test(under), under);

/* the same sentence in Reflect said "you are 37.1% of the way in" - which reads
   as progress toward owning it, and is the same lie in prose */
const refl=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('reflect'); await w(800);
  return (document.getElementById('view-reflect')||{innerText:''}).innerText.replace(/\s+/g,' ');
});
ok('Reflect no longer calls the debt share "how far in you are"',
   !/37\.1% of the way in/.test(refl), refl.slice(0,80));
if(/of it is yours with/.test(refl))
  ok('...it names both halves and which is which', /62\.9%.*yours.*37\.1%.*owed/.test(refl), refl.slice(0,140));

R.forEach(([n,p,d])=>{ if(!p) console.log('FAIL: '+n+(d?'  <'+d+'>':'')); });
const bad=R.filter(x=>!x[1]).length;
console.log(`${R.length-bad} of ${R.length} hold`);
console.log('page errors: '+(errs.length?errs.slice(0,2).join(' | '):'none'));
await b.close(); process.exit(bad||errs.length?1:0);
