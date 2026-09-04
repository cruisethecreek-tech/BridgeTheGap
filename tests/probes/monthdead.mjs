import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
/* "Now is September... Not August." and "What you've told me doesn't do
   anything. It's a dead action." */
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const R=[]; const ok=(n,v,d)=>R.push([n,!!v,d]); const errs=[];

/* --- the month turning over while the app is open --- */
const pg=await b.newPage({viewport:{width:390,height:900}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.addInitScript(t=>{ const R=Date; window.__off=t-R.now();
  class S extends R{ constructor(...a){ a.length?super(...a):super(R.now()+window.__off);} static now(){return R.now()+window.__off;} }
  window.Date=S; }, new Date('2026-08-30T10:00:00').getTime());
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'full',activeMonth:'2026-08',hourlyWage:70,
  categories:[{id:'c1',name:'Food'}],budgets:{'2026-08':{c1:400}},
  accounts:[{id:'a1',name:'Chequing',kind:'checking',balance:5000,updated:'2026-08-01'}],
  lessons:[{id:'l1',date:'2026-08-20',name:'Jacket',amount:200,cause:'scroll',covered:'',note:'Bought it anyway'}],
  transactions:[{id:'t1',type:'income',amount:3000,date:'2026-08-01',source:'Pay',acctId:'a1'}]});
await pg.reload(); await pg.waitForTimeout(1500);
const aug=await pg.evaluate(()=>({months:(state.snapshots||[]).map(s=>s.month), now:thisMonth()}));
ok('August is on the record while it is August', aug.months.includes('2026-08'), JSON.stringify(aug));

/* the app stays open; the calendar moves; nobody reloads */
const sep=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  window.__off += 5*24*3600*1000;                 // now the 4th of September
  document.dispatchEvent(new Event('visibilitychange'));
  await w(700);
  return {now:thisMonth(), months:(state.snapshots||[]).map(s=>s.month)};
});
ok('the month turning over is noticed without a reload', sep.now==='2026-09', sep.now);
ok('...and September lands on the record by itself',
   sep.months.includes('2026-09'), JSON.stringify(sep.months));

/* --- the dead pill --- */
const dead=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('impulse'); await w(600);
  const chip=[...document.querySelectorAll('#deck-impulse .dk-chip')].find(c=>/told me/.test(c.dataset.dk));
  const o={offered:!!chip};
  if(chip){ chip.click(); await w(400);
    const p=document.getElementById('lessonsPanel');
    o.opens = p && getComputedStyle(p).display!=='none' && p.getBoundingClientRect().height>20;
    o.hasContent = p && /jacket/i.test(p.innerText||''); }
  return o;
});
ok('the pill is offered when there is something behind it', dead.offered===true);
ok('...and tapping it actually opens the panel', dead.opens===true, JSON.stringify(dead));
ok('...with what you told it inside', dead.hasContent===true, JSON.stringify(dead));

/* and when there is nothing to say, no pill at all rather than a dead one */
const empty=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  state.lessons=[]; save(); renderAll(); activateTab('impulse'); await w(600);
  return {chip:!![...document.querySelectorAll('#deck-impulse .dk-chip')].find(c=>/told me/.test(c.dataset.dk)),
          others:document.querySelectorAll('#deck-impulse .dk-chip').length};
});
ok('an empty one is not offered at all, rather than offered and dead',
   empty.chip===false && empty.others>0, JSON.stringify(empty));

R.forEach(([n,p,d])=>{ if(!p) console.log('FAIL: '+n+(d?'  <'+d+'>':'')); });
const bad=R.filter(x=>!x[1]).length;
console.log(`${R.length-bad} of ${R.length} hold`);
console.log('page errors: '+(errs.length?errs.slice(0,2).join(' | '):'none'));
await b.close(); process.exit(bad||errs.length?1:0);
