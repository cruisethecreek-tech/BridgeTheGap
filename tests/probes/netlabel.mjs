/* "This doesn't look right." - a photo of the invest panel, both cards negative,
   both captioned "net worth in 5 yrs". The panel only knows the debts listed on
   it and the money aimed at them; it has never seen a bank balance and it cannot
   see the home behind a HELOC. This probe walks the reporter's own shape. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:1200}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',hourlyWage:30,
  categories:[],budgets:{},transactions:[],goals:[],impulse:[],recurring:[],
  accounts:[{id:'a1',name:'Chequing',kind:'checking',balance:6000,updated:'2026-08-01'}],
  assets:[],liabilities:[],diary:[],intake:{},lessons:[],vault:[],snapshots:[],
  debts:[{id:'h',name:'Heloc',kind:'line',balance:18000,apr:3.49,minPayment:120,limit:25000}],
  debtBudget:220, investReturn:10, investYears:5});
await pg.reload(); await pg.waitForTimeout(900);

const r = await pg.evaluate(async () => {
  const w=ms=>new Promise(x=>setTimeout(x,ms));
  activateTab('debt'); await w(600);
  const num=t=>{ const m=String(t).replace(/,/g,'').match(/(-?)\$?(-?[\d.]+)/); return m?parseFloat((m[1]==='-'?'-':'')+m[2].replace('-','')):NaN; };
  const cards=[...document.querySelectorAll('.iv-card')].map(c=>({
    net:num((c.querySelector('.iv-net')||{}).textContent||''),
    sub:((c.querySelector('.sub')||{}).textContent||'').trim(),
    work:((c.querySelector('.iv-work')||{textContent:''}).textContent||'').replace(/\s+/g,' ').trim(),
    parts:[...c.querySelectorAll('.iv-work b')].map(x=>num(x.textContent))}));
  const panel=document.getElementById('investPanel');
  const cmp=investCompare(state.debts,state.debtBudget,10,60);
  return { cards,
    scope:((document.querySelector('.iv-scope')||{textContent:''}).textContent||'').replace(/\s+/g,' ').trim(),
    text:panel.innerText, worth:netWorth(),
    gap:Math.round((cmp.investFirst.net-cmp.crush.net)*100)/100 };
});

ok('the two cards are still there and still negative on this shape',
   r.cards.length===2 && r.cards.every(c=>c.net<0), JSON.stringify(r.cards.map(c=>c.net)));
ok('nothing on the panel calls that figure your net worth',
   !/net worth in/i.test(r.text), (r.text.match(/net worth[^\n]*/i)||[''])[0]);
ok('each card says what its number is the end of',
   r.cards.every(c=>/left of this one decision after 5 yrs/.test(c.sub)),
   r.cards.map(c=>c.sub).join(' | '));
ok('each card prints the two halves that made it',
   r.cards.every(c=>c.parts.length===2 && /invested/.test(c.work) && /still owed/.test(c.work)),
   r.cards.map(c=>c.work).join(' | '));
ok('...and the halves reconcile to the number above them',
   r.cards.every(c=>Math.abs((c.parts[0]-c.parts[1])-c.net)<1),
   r.cards.map(c=>`${c.parts[0]}-${c.parts[1]}=${c.net}`).join(' | '));
ok('the scope line says the bank balance is not in there',
   /bank balance is not in there/i.test(r.scope), r.scope.slice(0,140));
ok('...names the home behind the HELOC, which no debt figure can see',
   /your home behind Heloc/i.test(r.scope), r.scope.slice(0,240));
ok('...quotes the real net worth so the two can be told apart',
   /not your net worth, which is \$6,000 today/.test(r.scope) && r.worth===6000, r.scope.slice(-180));
ok('...and points at the gap, the one figure the decision hangs on',
   /gap between the two cards/i.test(r.scope) && r.gap>0, String(r.gap));

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
