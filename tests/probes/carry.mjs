import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
/* "How could I plan a whole month from income that isn't logged but it won't let
   me add the bank balance from the previous month? Left to budget will always be
   negative. I don't want to add the full 83706 but I should be able to carry
   certain accounts in my savings." */
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.addInitScript(t=>{ const R=Date,o=t-R.now();
  class S extends R{ constructor(...a){ a.length?super(...a):super(R.now()+o);} static now(){return R.now()+o;} }
  window.Date=S; }, new Date('2026-09-04T04:29:00').getTime());
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'full',activeMonth:'2026-09',hourlyWage:70,
  categories:[{id:'c1',name:'Roof'},{id:'c2',name:'Food'}],
  budgets:{'2026-09':{c1:4000,c2:2026.21}},
  accounts:[{id:'chk',name:'Joint chequing',kind:'checking',balance:5230.23,updated:'2026-09-01'},
            {id:'sav',name:'Emergency',kind:'savings',balance:12000,updated:'2026-09-01'},
            {id:'ret',name:'401k',kind:'invest',balance:66476.05,updated:'2026-09-01'},
            {id:'visa',name:'Visa',kind:'credit',balance:900,updated:'2026-09-01'}],
  transactions:[{id:'i1',type:'income',amount:1230.23,date:'2026-09-01',source:'Pay',acctId:'chk'}]});
await pg.reload(); await pg.waitForTimeout(1600);
const R=[]; const ok=(n,v,d)=>R.push([n,!!v,d]);

const open=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('budget'); await w(700);
  const btn=document.querySelector('#view-budget [data-carryin]');
  const o={offered:!!btn, label:btn?btn.innerText.trim():''};
  if(btn){ btn.click(); await w(400);
    /* this note is drawn on Home and on Plan, so everything in it exists twice */
    o.where={buttons:document.querySelectorAll('[data-carryin]').length,
             pickers:document.querySelectorAll('.carrypick').length};
    const box=btn.parentElement.querySelector('.carrypick');
    o.sameScreen=!!box && !!btn.closest('#view-budget');
    o.picker=!!box;
    o.rows=[...box.querySelectorAll('[data-carrypick]')].map(x=>({
      id:x.dataset.carrypick, on:x.checked,
      name:x.closest('.cp-row').querySelector('.cp-n').textContent}));
    o.sum=(box.querySelector('[data-carrysum]')||{textContent:''}).textContent; }
  return o;
});
ok('the picker opens beside the button that was pressed, not on another screen',
   open.sameScreen===true, JSON.stringify(open.where));
ok('the button no longer commits every account at once',
   !/83,?706|78,?476/.test(open.label), open.label);
ok('...it opens a picker of your accounts', open.picker===true && open.rows.length>=3, JSON.stringify(open.rows));
ok('a credit card is never offered as money you have',
   !open.rows.some(r=>r.id==='visa'), JSON.stringify(open.rows.map(r=>r.id)));
ok('what you spend from starts ticked; what you put away does not',
   open.rows.find(r=>r.id==='chk').on===true &&
   open.rows.find(r=>r.id==='sav').on===false &&
   open.rows.find(r=>r.id==='ret').on===false, JSON.stringify(open.rows));
ok('...and the total is the chequing balance less income already logged',
   /\$4,000\b/.test(open.sum), open.sum);

/* tick savings too and the figure moves before it is committed */
const live=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const box=document.querySelector('#view-budget .carrypick');
  const sav=box.querySelector('[data-carrypick="sav"]');
  sav.checked=true; sav.click(); sav.checked=true; sav.dispatchEvent(new Event('click',{bubbles:true}));
  await w(250);
  return (box.querySelector('[data-carrysum]')||{textContent:''}).textContent;
});
ok('ticking another account moves the figure before you commit it',
   /\$16,000\b/.test(live), live);

const done=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  document.querySelector('#view-budget [data-carrygo]').click(); await w(600);
  const M='2026-09';
  return {opening:openingFor(M), toBudget:monthToBudget(M),
    ltb:Math.round((monthToBudget(M)-topCats().reduce((s,c)=>s+catAssigned(c.id,M),0))*100)/100,
    from:(state.openingFrom||{})[M], earned:monthIncome(M),
    pickerGone:!document.querySelector('#view-budget .carrypick')};
});
ok('what you ticked is what gets carried in', done.opening===16000, String(done.opening));
ok('...and it is remembered as which accounts, not just a number',
   Array.isArray(done.from) && done.from.length===2, JSON.stringify(done.from));
ok('...the month has something to budget from at last',
   done.toBudget===17230.23, String(done.toBudget));
ok('...so left to budget is no longer permanently negative',
   done.ltb>0, String(done.ltb));
ok('...and money you EARNED is still only what you logged',
   done.earned===1230.23, String(done.earned));
ok('...the picker closes once you have used it', done.pickerGone===true);

R.forEach(([n,p,d])=>{ if(!p) console.log('FAIL: '+n+(d?'  <'+d+'>':'')); });
const bad=R.filter(x=>!x[1]).length;
console.log(`${R.length-bad} of ${R.length} hold`);
console.log('page errors: '+(errs.length?errs.slice(0,2).join(' | '):'none'));
await b.close(); process.exit(bad||errs.length?1:0);
