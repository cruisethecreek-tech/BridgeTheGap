/* "Why is pressing the sync button necessary... and will there be a change log
   so we know who changed what and when, so all account balances are always
   accurate?" Both are the same fault: sync sent the whole state and a pull
   REPLACED the whole state, so whoever synced second erased the other. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:1000}});
pg.on('pageerror',e=>errs.push(String(e)));
const M=(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;})();
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(([M])=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,householdOn:true,activeMonth:M,
  nameA:'Pat',nameB:'Kristi',deviceId:'devA',meIs:'a',
  categories:[{id:'food',name:'Food'}],budgets:{[M]:{food:400}},
  accounts:[{id:'a1',name:'Chequing',kind:'checking',balance:2000,updated:M+'-01'}],
  transactions:[],goals:[],impulse:[],recurring:[],assets:[],liabilities:[],diary:[],intake:{},
  lessons:[],debts:[],vault:[],snapshots:[],scans:[],opening:{},changelog:[],graveyard:[],settingsM:{}})), [M]);
await pg.reload(); await pg.waitForTimeout(900);

/* ---- 1. the exact scenario that lost data ---- */
const clobber = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  /* Pat's phone: log a coffee */
  state.transactions.push({id:'coffee',type:'expense',amount:4.5,catId:'food',date:todayStr(),note:'Coffee'});
  save(); await w(20);
  const patState=JSON.parse(JSON.stringify(state));

  /* Kristi's phone: a copy from BEFORE the coffee, where she edits the balance */
  const kristi=JSON.parse(JSON.stringify(state));
  kristi.transactions=kristi.transactions.filter(t=>t.id!=='coffee');   // she never had it
  kristi.deviceId='devB'; kristi.meIs='b';
  kristi.accounts[0]={...kristi.accounts[0], balance:2600};
  kristi.accounts[0]._m={t:new Date(Date.now()+1000).toISOString(), by:'b', d:'devB'};
  kristi.changelog=[{id:'k1',t:kristi.accounts[0]._m.t,by:'b',d:'devB',kind:'edit',what:'accounts',label:'Chequing',amount:2600}];

  /* what the OLD code did: replace. what the new code does: merge. */
  const replaced=JSON.parse(JSON.stringify(kristi));
  const merged=mergeVault(patState, kristi);
  return {
    oldKeptCoffee:replaced.transactions.some(t=>t.id==='coffee'),
    oldBalance:replaced.accounts[0].balance,
    newKeptCoffee:merged.transactions.some(t=>t.id==='coffee'),
    newBalance:merged.accounts[0].balance,
    newTxCount:merged.transactions.length };
});
ok('the old behaviour is confirmed: replacing loses the coffee entirely',
   clobber.oldKeptCoffee===false, String(clobber.oldKeptCoffee));
ok('merging keeps BOTH - his entry and her balance',
   clobber.newKeptCoffee===true && clobber.newBalance===2600,
   JSON.stringify([clobber.newKeptCoffee,clobber.newBalance]));
ok('...without duplicating anything', clobber.newTxCount===1, String(clobber.newTxCount));

/* ---- 2. newest wins, per item, deterministically ---- */
const wins = await pg.evaluate(() => {
  const mk=(bal,t,d,by)=>({...JSON.parse(JSON.stringify(state)), deviceId:d,
    accounts:[{id:'a1',name:'Chequing',kind:'checking',balance:bal,_m:{t,by,d}}]});
  const older=mk(100,'2026-09-02T10:00:00.000Z','devA','a');
  const newer=mk(999,'2026-09-02T11:00:00.000Z','devB','b');
  const tieA=mk(111,'2026-09-02T12:00:00.000Z','devA','a');
  const tieB=mk(222,'2026-09-02T12:00:00.000Z','devB','b');
  return { newerWins:mergeVault(older,newer).accounts[0].balance,
           orderDoesNotMatter:mergeVault(newer,older).accounts[0].balance,
           tie1:mergeVault(tieA,tieB).accounts[0].balance,
           tie2:mergeVault(tieB,tieA).accounts[0].balance };
});
ok('the newer edit wins, whichever side it arrived from',
   wins.newerWins===999 && wins.orderDoesNotMatter===999, JSON.stringify(wins));
/* without a stable tie-break two phones can disagree forever */
ok('...and a same-millisecond tie resolves identically on both phones',
   wins.tie1===wins.tie2, JSON.stringify([wins.tie1,wins.tie2]));

/* ---- 3. a delete must not be resurrected ---- */
const graves = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  state.transactions=[{id:'gone',type:'expense',amount:9,catId:'food',date:todayStr(),note:'Mistake'}];
  save(); await w(20);
  const withIt=JSON.parse(JSON.stringify(state));
  state.transactions=[];            // Pat deletes it
  save(); await w(20);
  const afterDel=JSON.parse(JSON.stringify(state));
  const merged=mergeVault(afterDel, withIt);          // her phone still has it
  /* but an edit made AFTER the delete is a deliberate revival */
  const revived=JSON.parse(JSON.stringify(withIt));
  revived.transactions[0]._m={t:new Date(Date.now()+60000).toISOString(),by:'b',d:'devB'};
  const merged2=mergeVault(afterDel, revived);
  return { stays:merged.transactions.length, tomb:(afterDel.graveyard||[]).length,
           revives:merged2.transactions.length };
});
ok('a deletion is recorded, so the other phone cannot resurrect it',
   graves.tomb>=1 && graves.stays===0, JSON.stringify(graves));
ok('...but an edit made after the delete brings it back on purpose',
   graves.revives===1, String(graves.revives));

/* ---- 4. the change log the question actually asked for ---- */
const log = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  state.changelog=[]; state.graveyard=[]; syncPrev=null; save(); await w(20);
  state.accounts[0].balance=3100; save(); await w(20);
  state.transactions.push({id:'t9',type:'expense',amount:12.4,catId:'food',date:todayStr(),note:'Lunch'});
  save(); await w(20);
  const html=changeLogHTML(10);
  return { n:state.changelog.length,
    kinds:state.changelog.map(e=>e.kind+':'+e.what).join(','),
    named:state.changelog.every(e=>e.by && e.t && e.d),
    html:html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim() };
});
ok('every change is recorded with who, when and on which device',
   log.n>=2 && log.named===true, `${log.n} entries`);
ok('...and reads as a sentence, not a diff',
   /Pat changed account Chequing/.test(log.html) && /Pat added entry Lunch/.test(log.html),
   log.html.slice(0,180));
ok('...an account balance edit is logged, which is the point of the request',
   /edit:accounts/.test(log.kinds), log.kinds);

/* ---- 5. two logs become one, without duplicates ---- */
const logs = await pg.evaluate(() => {
  const mine=JSON.parse(JSON.stringify(state));
  const theirs=JSON.parse(JSON.stringify(state));
  theirs.deviceId='devB';
  theirs.changelog=[{id:'shared',t:'2026-09-02T09:00:00.000Z',by:'b',d:'devB',kind:'add',what:'transactions',label:'Petrol'},
                    ...mine.changelog];
  const m=mergeVault(mine,theirs);
  const ids=m.changelog.map(e=>e.id);
  return { total:m.changelog.length, unique:new Set(ids).size,
           hasTheirs:ids.includes('shared'),
           newestFirst:m.changelog.every((e,i,a)=>i===0||a[i-1].t>=e.t) };
});
ok('both phones and one log, newest first, no repeats',
   logs.total===logs.unique && logs.hasTheirs===true && logs.newestFirst===true,
   JSON.stringify(logs));

/* ---- 6. the button is no longer what makes sync happen ---- */
const auto = await pg.evaluate(() => ({
  pollExists:typeof syncPollStart==='function' && typeof syncCheck==='function',
  readsStamp:typeof vaultStamp==='function',
  pushOnSave:/scheduleVaultPush/.test(String(save)) }));
ok('receiving runs on its own now, and reads the timestamp before pulling',
   auto.pollExists===true && auto.readsStamp===true);
ok('...while sending was always automatic, which is why the button felt pointless',
   auto.pushOnSave===true);

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
