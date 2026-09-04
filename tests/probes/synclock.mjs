/* A real two-phone test: a category added on one phone never reached the other.
   Not the merge - the passphrase is memory-only, so every page load starts
   locked, which means nothing is received AND nothing is sent, and the only
   thing that knew was an unlock box on another tab. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const M=(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;})();
const base={onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:M,hourlyWage:30,
  nameA:'Pat',nameB:'Kristi',meIs:'b',
  categories:[{id:'f',name:'Food'}],budgets:{[M]:{f:400}},
  transactions:[{id:'t',type:'income',amount:3000,date:M+'-01'}],
  goals:[],impulse:[],recurring:[],accounts:[],assets:[],liabilities:[],diary:[],intake:{},
  lessons:[],debts:[],vault:[],snapshots:[],scans:[],opening:{},changelog:[],graveyard:[],settingsM:{}};

async function look(extra){
  const pg=await b.newPage({viewport:{width:390,height:1000}});
  pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto('file://'+process.cwd()+'/app.html');
  await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),{...base,...extra});
  await pg.reload(); await pg.waitForTimeout(950);
  const r=await pg.evaluate(async()=>{
    const w=ms=>new Promise(x=>setTimeout(x,ms));
    activateTab('budget'); await w(550);
    const plan=(document.getElementById('lifeKeyPlan')||{innerText:''}).innerText.replace(/\s+/g,' ');
    activateTab('tx'); await w(550);
    const track=(document.getElementById('txMonthNote')||{innerText:''}).innerText.replace(/\s+/g,' ');
    return { plan, track, banner:!!document.querySelector('.view.on .sync-lock'),
             btn:!!document.querySelector('[data-syncunlockgo]'),
             field:!!document.querySelector('[data-syncpassin]'),
             tabAfter:(document.querySelector('.view.on')||{}).id,
             /* the two things that silently do nothing while locked */
             pollsOff:syncPollTimer===null, active:syncActive, pass:syncPass!==null };
  });
  await pg.close(); return r;
}

/* the reported state: set up, reopened, locked */
const locked = await look({householdOn:true, syncOptIn:true});
ok('a reopened phone starts locked, so it neither sends nor receives',
   locked.active===false && locked.pass===false && locked.pollsOff===true,
   JSON.stringify([locked.active,locked.pass,locked.pollsOff]));
ok('...and the budget screen says so, instead of looking synced',
   locked.banner===true && /not syncing/i.test(locked.plan), locked.plan.slice(0,140));
ok('...on Track too, because that is the other screen people live on',
   /not syncing/i.test(locked.track), locked.track.slice(0,120));
ok('...naming BOTH directions, since sending stops as well as receiving',
   /nothing you change here reaches/i.test(locked.plan) && /nothing of theirs reaches you/i.test(locked.plan),
   locked.plan.slice(0,240));
ok('...naming the partner it has stopped reaching', /Pat/.test(locked.plan), locked.plan.slice(0,160));
ok('...and saying why it locks, so it does not read as a fault',
   /key that no server holds/i.test(locked.plan), locked.plan.slice(0,220));
ok('...with the way to fix it right there, not on another tab', locked.btn===true && locked.field===true,
   JSON.stringify([locked.btn,locked.field]));

/* This probe used to assert that a household who never set sync up is left
   alone. That was the bug, reported as "how is a person there to go to settings
   to sync for the first time - there's no call to action": two people could run
   this on two phones for a month, each holding half a budget, with nothing on
   any screen saying so. Being told is now the correct behaviour - but it must
   INVITE rather than warn, and it must name the person who cannot see it. */
const never = await look({householdOn:true, syncOptIn:false, nameB:'Kristi'});
ok('a household that never shared is told so, by name', /Kristi cannot see/.test(never.plan||''), (never.plan||'').slice(0,80));
ok('...as an invitation, not as the "not syncing" warning',
   !/not syncing/i.test(never.plan||'') && /Share this budget/i.test(never.plan||''), (never.plan||'').slice(0,110));
const solo = await look({householdOn:false, syncOptIn:true});
ok('...and neither is somebody not sharing a budget at all', solo.banner===false, solo.plan.slice(0,90));


/* ---- the passphrase now survives a reload, and is proved before it is trusted ---- */
const remember = await (async () => {
  const pg=await b.newPage({viewport:{width:390,height:1000}});
  pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto('file://'+process.cwd()+'/app.html');
  await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
    {...base, householdOn:true, syncOptIn:true});
  await pg.reload(); await pg.waitForTimeout(900);
  const o=await pg.evaluate(async()=>{
    const w=ms=>new Promise(x=>setTimeout(x,ms));
    const out={};
    /* stand in for the network: the vault opens for the right key only */
    window.__pulled=0;
    pullFromVault=async(pass)=>{ window.__pulled++; if(pass!=='right') throw new Error('Wrong passphrase, or the vault is damaged.'); return true; };
    sbSession=async()=>({user:{id:'u1'}});
    syncPassRemember('right');
    out.stored=syncPassRecall();
    await refreshSyncState(); await w(250);
    out.active=syncActive; out.pass=syncPass; out.polling=syncPollTimer!==null;
    out.note=syncNote;
    activateTab('budget'); await w(400);
    out.banner=!!document.querySelector('.view.on .sync-lock');
    /* a stale key must be discarded rather than left to fail later */
    syncActive=false; syncPass=null; syncPollStop();
    syncPassRemember('wrong');
    await refreshSyncState(); await w(250);
    out.badActive=syncActive; out.badStored=syncPassRecall(); out.badView=syncUI.view;
    /* signing out forgets it */
    syncPassRemember('right'); await sbSignOut(); await w(120);
    out.afterOut=syncPassRecall();
    return out;
  });
  await pg.close(); return o;
})();
ok('a remembered passphrase survives the reload and picks sync back up',
   remember.active===true && remember.pass==='right' && remember.polling===true,
   JSON.stringify([remember.active,remember.polling]));
ok('...saying so, rather than silently resuming', /Picked up where you left off/.test(remember.note||''), remember.note);
ok('...and the "not syncing" warning is gone, because it is syncing',
   remember.banner===false, String(remember.banner));
/* a stored key is a claim, not a fact */
ok('a stale passphrase is proved and thrown away, not left to fail later',
   remember.badActive===false && remember.badStored==='' && remember.badView==='unlock',
   JSON.stringify([remember.badActive,remember.badStored,remember.badView]));
ok('signing out forgets it', remember.afterOut==='', remember.afterOut);


/* ---- the regression that hid all of the above ----
   syncOptIn was added after people had already set sync up. It gates the
   session check, the unlock prompt, the passphrase restore AND the warning
   banner - so an install that joined a vault before the flag existed was told
   it had never opted in, shown the setup menu while signed in, and synced
   nothing in either direction with nothing on screen admitting it. */
const legacy = await (async () => {
  const pg=await b.newPage({viewport:{width:390,height:1000}});
  pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto('file://'+process.cwd()+'/app.html');
  await pg.evaluate(s=>{
    const st={...s}; delete st.syncOptIn;              // an install from before the field
    localStorage.setItem('unfiltered_budget_v2', JSON.stringify(st));
    localStorage.setItem('sb-qyqddhylijvroroooidv-auth-token', JSON.stringify({access_token:'x'}));
  }, {...base, householdOn:true});
  await pg.reload(); await pg.waitForTimeout(950);
  const o=await pg.evaluate(async()=>{
    const w=ms=>new Promise(x=>setTimeout(x,ms));
    sbSession=async()=>({user:{id:'u1'}});
    const out={optIn:state.syncOptIn};
    await refreshSyncState(); await w(300);
    out.view=syncUI.view;
    activateTab('budget'); await w(400);
    out.banner=!!document.querySelector('.view.on .sync-lock');
    return out;
  });
  await pg.close(); return o;
})();
ok('somebody who set sync up before the flag existed is not told they never did',
   legacy.optIn===true, String(legacy.optIn));
ok('...they are offered the unlock, not the setup menu they already completed',
   legacy.view==='unlock', legacy.view);
ok('...and the warning reaches them, which it could not while the flag was false',
   legacy.banner===true, String(legacy.banner));

/* signing out really means out - it must not be undone by a leftover token */
const signedOut = await (async () => {
  const pg=await b.newPage({viewport:{width:390,height:1000}});
  await pg.goto('file://'+process.cwd()+'/app.html');
  await pg.evaluate(s=>{
    localStorage.setItem('unfiltered_budget_v2', JSON.stringify({...s, householdOn:true, syncOptIn:false}));
    localStorage.setItem('sb-qyqddhylijvroroooidv-auth-token', JSON.stringify({access_token:'x'}));
  }, base);
  await pg.reload(); await pg.waitForTimeout(900);
  const o=await pg.evaluate(()=>state.syncOptIn);
  await pg.close(); return o;
})();
ok('...while an explicit "signed out" is left alone, token or no token',
   signedOut===false, String(signedOut));


/* ---- "every time I press unlock sync it navigates to the Build tab, but when
   I go back to Plan I have to press it again" ---- */
const inline = await (async () => {
  const pg=await b.newPage({viewport:{width:390,height:1000}});
  pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto('file://'+process.cwd()+'/app.html');
  await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
    {...base, householdOn:true, syncOptIn:true});
  await pg.reload(); await pg.waitForTimeout(900);
  const o=await pg.evaluate(async()=>{
    const w=ms=>new Promise(x=>setTimeout(x,ms));
    const out={};
    pullFromVault=async(pass)=>{ if(pass!=='right') throw new Error('Wrong passphrase, or the vault is damaged.'); return true; };
    sbSession=async()=>({user:{id:'u1'}});
    activateTab('budget'); await w(500);
    out.startTab=(document.querySelector('.view.on')||{}).id;
    /* pressing it with nothing typed must not navigate anywhere */
    document.querySelector('[data-syncunlockgo]').click(); await w(250);
    out.emptyTab=(document.querySelector('.view.on')||{}).id;
    out.emptyErr=(document.querySelector('[data-syncunlockerr]')||{innerText:''}).innerText;
    /* a wrong one explains itself, in place */
    document.querySelector('[data-syncpassin]').value='nope';
    document.querySelector('[data-syncunlockgo]').click(); await w(400);
    out.badErr=(document.querySelector('[data-syncunlockerr]')||{innerText:''}).innerText;
    out.badTab=(document.querySelector('.view.on')||{}).id;
    out.stillLocked=!!document.querySelector('.view.on .sync-lock');
    /* the right one unlocks and the warning goes, without leaving Plan */
    document.querySelector('[data-syncpassin]').value='right';
    document.querySelector('[data-syncunlockgo]').click(); await w(600);
    out.tab=(document.querySelector('.view.on')||{}).id;
    out.gone=!document.querySelector('.view.on .sync-lock');
    out.active=syncActive; out.polling=syncPollTimer!==null; out.remembered=syncPassRecall();
    /* and it stays gone when you move around */
    activateTab('tx'); await w(400);
    out.goneOnTrack=!document.querySelector('.view.on .sync-lock');
    activateTab('budget'); await w(400);
    out.goneBack=!document.querySelector('.view.on .sync-lock');
    return out;
  });
  await pg.close(); return o;
})();
ok('unlocking happens where you are standing, not on another tab',
   inline.startTab==='view-budget' && inline.tab==='view-budget', `${inline.startTab} -> ${inline.tab}`);
ok('...pressing it empty says what is wanted instead of navigating',
   inline.emptyTab==='view-budget' && /not the account password/i.test(inline.emptyErr), inline.emptyErr);
ok('...a wrong passphrase explains itself in place and stays locked',
   inline.badTab==='view-budget' && /does not open this vault/i.test(inline.badErr) && inline.stillLocked===true,
   inline.badErr.slice(0,110));
ok('the right one unlocks, and the warning disappears underneath you',
   inline.gone===true && inline.active===true && inline.polling===true, JSON.stringify(inline));
ok('...it is remembered, so this is not asked again on the next reload',
   inline.remembered==='right', inline.remembered);
/* the actual complaint: pressing it again after moving */
ok('...and it does not come back when you move between tabs',
   inline.goneOnTrack===true && inline.goneBack===true,
   JSON.stringify([inline.goneOnTrack,inline.goneBack]));

/* the panel it used to walk to is refreshed on arrival now, either way */
const arrival = await (async () => {
  const pg=await b.newPage({viewport:{width:390,height:1000}});
  await pg.goto('file://'+process.cwd()+'/app.html');
  await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
    {...base, householdOn:true, syncOptIn:true});
  await pg.reload(); await pg.waitForTimeout(900);
  const o=await pg.evaluate(async()=>{
    const w=ms=>new Promise(x=>setTimeout(x,ms));
    sbSession=async()=>({user:{id:'u1'}});
    let called=0; const real=refreshSyncState; refreshSyncState=async(...a)=>{ called++; return real(...a); };
    activateTab('goals'); await w(500);
    return {called};
  });
  await pg.close(); return o;
})();
ok('arriving at the Household tab refreshes the sync panel rather than showing a stale one',
   arrival.called>=1, String(arrival.called));

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
