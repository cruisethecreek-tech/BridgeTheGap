/* Configuring real Supabase keys turned a promise into a claim that had to be
   re-checked: "the free tier stays 100% local and offline - the SDK is NOT
   loaded until a user explicitly opts into Sync." The moment the keys were live
   that stopped being true, because Household mode alone was enough to make the
   app go looking for a session on boot. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const base={onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-09',
  categories:[],budgets:{},transactions:[],goals:[],impulse:[],recurring:[],accounts:[],assets:[],
  liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[],scans:[],opening:{}};

async function run(label, extra){
  const pg=await b.newPage({viewport:{width:390,height:1000}});
  const net=[], errs=[];
  pg.on('request',r=>{ if(!r.url().startsWith('file:')) net.push(r.url()); });
  pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto('file://'+process.cwd()+'/app.html');
  await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),{...base,...extra});
  await pg.reload(); await pg.waitForTimeout(1100);
  const r=await pg.evaluate(async()=>{
    const w=ms=>new Promise(x=>setTimeout(x,ms));
    activateTab('goals'); await w(500); renderSync(); await w(400);
    return { configured:syncConfigured(), sdk:!!window.supabase,
      panel:(document.getElementById('syncPanel')||{innerText:''}).innerText.replace(/\s+/g,' ') };
  });
  await pg.close();
  return {...r, net, errs, label};
}

/* the shipped config */
const plain = await run('local only', {});
ok('the project is configured, so sync is a real offer rather than "coming soon"',
   plain.configured===true);
ok('...and a local-only user still touches no network at all',
   plain.net.length===0 && plain.sdk===false, JSON.stringify(plain.net));

/* the case that broke: household on, sync never started */
const hh = await run('household, no sync', {householdOn:true});
ok('turning on Household mode is not opting into Sync',
   hh.net.length===0 && hh.sdk===false, JSON.stringify(hh.net));
ok('...and nothing throws where a person could not see it',
   hh.errs.length===0, JSON.stringify(hh.errs));
ok('...while the panel still offers to set it up',
   /Set up Household Sync/.test(hh.panel) && /Link to an existing vault/.test(hh.panel),
   hh.panel.slice(0,120));
ok('...naming what it protects, before anyone commits to it',
   /end-to-end encrypted/.test(hh.panel) && /even we can't read it/.test(hh.panel),
   hh.panel.slice(0,160));

/* somebody who HAS started sync is allowed to go looking for their session -
   this is the one case where a request on boot is what the person asked for */
const opted = await run('opted in', {householdOn:true, syncOptIn:true});
ok('a person who already started sync does get their session checked',
   opted.net.length>0, JSON.stringify(opted.net).slice(0,140));
/* and a network that refuses must not become an uncaught error */
ok('...and an unreachable sync service is a state, not a crash',
   opted.errs.length===0, JSON.stringify(opted.errs));

console.log(`\n${pass} of ${pass+fail} hold`);
await b.close();
process.exit(fail?1:0);
