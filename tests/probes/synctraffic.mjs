/* Three rounds of "it still did not load" with no way for either side to tell
   whether a phone had ever pushed. A vault holds only what was last pushed to
   it, so a device locked since the change was made never sent it - and the
   other person pulls a vault that does not contain the thing, which looks
   exactly like a broken merge. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,260):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:1000}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(()=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,householdOn:true,syncOptIn:true,
  activeMonth:'2026-09',nameA:'Pat',nameB:'Kristi',deviceId:'devA',meIs:'a',
  categories:[],budgets:{},transactions:[],goals:[],impulse:[],recurring:[],accounts:[],assets:[],
  liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[],scans:[],opening:{},
  changelog:[],graveyard:[],settingsM:{}})));
await pg.reload(); await pg.waitForTimeout(900);

const r = await pg.evaluate(async () => {
  const w=ms=>new Promise(x=>setTimeout(x,ms));
  const out={};
  out.neverSent=syncTrafficHTML().replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  /* a push records what it wrote, so the next poll does not read back its own write */
  let upserted=null, pushes=0;
  sbSession=async()=>({user:{id:'u1'}});
  getSupabase=async()=>({from:()=>({
    upsert:async(row)=>{ upserted=row; pushes++; return {error:null}; },
    select:()=>({eq:()=>({maybeSingle:async()=>({data:{updated_at:upserted?upserted.updated_at:''},error:null})})})
  })});
  syncPass='k'; syncActive=true;
  await pushToVault('k'); await w(50);
  out.stampRecorded = syncLastSeen===upserted.updated_at && state.syncLastPush===upserted.updated_at;
  out.afterSend=syncTrafficHTML().replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  /* the churn this prevents: a check straight after a push must find nothing new */
  pullFromVault=async()=>{ out.pulledBack=true; return true; };
  out.pulledBack=false;
  const got=await syncCheck(); await w(50);
  out.noSelfPull = got===false && out.pulledBack===false;
  /* and a real change from the other side is still picked up */
  upserted={updated_at:new Date(Date.now()+60000).toISOString()};
  const got2=await syncCheck(); await w(50);
  out.stillReceives = got2===true;
  return out;
});
ok('a phone that has never pushed says so, loudly',
   /Nothing from this phone has reached the vault yet/.test(r.neverSent), r.neverSent.slice(0,120));
ok('...naming it as the reason their partner is missing something',
   /if your partner is missing something you added here, this is why/i.test(r.neverSent), r.neverSent.slice(-110));
ok('a push records the timestamp it wrote', r.stampRecorded===true, String(r.stampRecorded));
ok('...and the panel then reports both directions',
   /Last sent/.test(r.afterSend) && /Last received/.test(r.afterSend), r.afterSend);
ok('...so the next check does not pull back what this phone just wrote',
   r.noSelfPull===true, String(r.noSelfPull));
ok('...while a genuine change from the other phone still comes down',
   r.stillReceives===true, String(r.stillReceives));

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
