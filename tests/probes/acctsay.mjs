/* Sent as a screenshot of a Joint Checking row: "Bank said this on 2026-08-27",
   Expected now $5,313.86, and two chips. "This is a bit extreme, I need it to at
   least give me the option to use the current banking balance, not a figure from
   last month." */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:1100}});
pg.on('pageerror',e=>errs.push(String(e)));
/* frozen so "last month" is a fact rather than a race */
const CLOCK=new Date('2026-09-02T10:00:00').getTime();
await pg.addInitScript(t=>{ const R=Date, d=t-R.now();
  class S extends R{ constructor(...a){ if(!a.length) super(R.now()+d); else super(...a); } static now(){ return R.now()+d; } }
  window.Date=S; }, CLOCK);
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(()=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-09',hourlyWage:30,
  categories:[{id:'f',name:'Food'}],budgets:{'2026-09':{f:400}},
  accounts:[{id:'jc',name:'Joint Checking',kind:'checking',purpose:'sinking',balance:6637.64,updated:'2026-08-27',
             hist:[{d:'2026-08-27',b:6637.64,how:'bank'}]},
            {id:'ov',name:'Overflow income',kind:'checking',purpose:'emergency',balance:1137.46,updated:'2026-09-02',
             hist:[{d:'2026-09-02',b:1137.46,how:'bank'}]}],
  transactions:[{id:'x1',type:'expense',amount:1323.78,catId:'f',date:'2026-08-28',acctId:'jc'}],
  goals:[],impulse:[],recurring:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],
  vault:[],snapshots:[],scans:[],opening:{},changelog:[],graveyard:[],settingsM:{}})));
await pg.reload(); await pg.waitForTimeout(950);

const r = await pg.evaluate(async () => {
  const w=ms=>new Promise(x=>setTimeout(x,ms));
  activateTab('goals'); deckShow('goals','Accounts'); await w(650);
  const row=id=>document.querySelector('input[data-acctbal="'+id+'"]').closest('.acct-row');
  const o={ jc:row('jc').innerText.replace(/\s+/g,' '), ov:row('ov').innerText.replace(/\s+/g,' ') };
  o.chips=[...row('jc').querySelectorAll('.ac-acts button')].map(x=>x.textContent.trim());
  o.hasSay=!!row('jc').querySelector('[data-acctsay]');
  o.staleFlagged=!!row('jc').querySelector('.ac-age.old');
  o.freshNotFlagged=!row('ov').querySelector('.ac-age.old');
  return o;
});
ok('a reading from last month says so, instead of leaving you to work it out',
   /last month/.test(r.jc) && /6 days ago/.test(r.jc), r.jc.slice(0,150));
ok('...and is marked as stale, while a reading from today is not',
   r.staleFlagged===true && r.freshNotFlagged===true,
   JSON.stringify([r.staleFlagged,r.freshNotFlagged]));
ok('there are three answers now, not two',
   r.chips.length===3, JSON.stringify(r.chips));
ok('...and the third one is the bank, which is the only one that finds anything',
   r.hasSay===true && /read it off the bank/.test(r.chips[2]), r.chips[2]||'');

/* the point of the button: it has to lead somewhere */
const act = await pg.evaluate(async () => {
  const w=ms=>new Promise(x=>setTimeout(x,ms));
  document.querySelector('[data-acctsay="jc"]').click(); await w(500);
  const inp=document.querySelector('input[data-acctbal="jc"]');
  return { focused:document.activeElement===inp, lit:inp.classList.contains('ac-asking'),
           toast:(document.querySelector('.toast')||{innerText:''}).innerText.replace(/\s+/g,' ') };
});
ok('pressing it puts you in the box that answers the question',
   act.focused===true && act.lit===true, JSON.stringify([act.focused,act.lit]));
ok('...and says what typing there will do', /difference from what was expected/.test(act.toast), act.toast.slice(0,140));

/* and the gap is still found, which is what the whole screen exists for */
const gap = await pg.evaluate(async () => {
  const w=ms=>new Promise(x=>setTimeout(x,ms));
  const inp=document.querySelector('input[data-acctbal="jc"]');
  inp.value='5100'; inp.dispatchEvent(new Event('change',{bubbles:true}));
  await w(500);
  const a=state.accounts.find(x=>x.id==='jc');
  return { bal:a.balance, updated:a.updated, gap:a.lastGap, recon:a.lastRecon,
           readings:(a.hist||[]).length,
           logged:(state.changelog||[]).filter(e=>e.what==='accounts').length };
});
/* expected was 6637.64 - 1323.78 = 5313.86; the bank says 5100, so 213.86 left
   without being logged - the number the app says it exists to find */
ok('typing the real balance records it as a reading taken today',
   gap.bal===5100 && gap.updated==='2026-09-02' && gap.readings===2, JSON.stringify(gap));
ok('...and finds the money that moved without being logged',
   Math.abs(gap.gap-(-213.86))<0.01 && gap.recon==='2026-09-02', String(gap.gap));
ok('...and the change log records who touched the balance',
   gap.logged>=1, String(gap.logged));

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
