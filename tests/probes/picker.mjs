/* "It's flickering in the back and won't let me select anything."

   A screenshot of the category picker open over the Log tab, the page behind it
   mid-redraw. Two faults, either one of which is enough on its own.

   1. THE LOOP. pushToVault recorded the timestamp it had just written only
      AFTER filing a version row - a second round trip. Realtime notifies within
      milliseconds of the row committing, so the notification for the device's
      OWN push arrived inside that window, found a stamp it did not recognise,
      pulled, merged, saved, scheduled another push, and went round again for as
      long as the tab stayed open. pullFromVault fed it: it pushed back after
      EVERY pull, and cleared syncLastSeen first to make sure the push went.

      The fifteen-second poll never exposed this, because fifteen seconds is far
      longer than the window. Turning Realtime on closed the gap and the loop ran
      continuously - so the flicker arrived with a change that touched no
      rendering code at all.

   2. THE PICKER. renderTxForm assigned the category <select>'s innerHTML on
      every render, unconditionally, and did not keep the chosen value.
      renderTx runs on every renderAll. On Android that <select> is a NATIVE
      popup drawn over the page: replacing its options while it is open closes
      it or strands it, and the reset selection means a tap landing between two
      rewrites is discarded.

      It was also fighting refreshCatSelects, which wrote a DIFFERENT list to
      the same element - with "New category" on it, which renderTxForm dropped.
      So the two took turns, every render was a real change, and whether the Log
      form offered a way to add a category depended on which ran last.

   The rule underneath 2 is the one worth keeping: rewriting a control with
   markup identical to what it already holds is not free. On a div it is
   invisible. On an open select it is destructive. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);

await p.evaluate(()=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify({
  onboarded:true,mindOff:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',
  activeMonth:'2026-09',
  categories:[{id:'food',name:'Food'},{id:'wal',name:'Walmart',parentId:'food'},
              {id:'ald',name:'Aldi',parentId:'food'},{id:'din',name:'Dining',parentId:'food'},
              {id:'tak',name:'Takeout',parentId:'food'},{id:'sub',name:'Subscriptions'},
              {id:'spo',name:'Spotify',parentId:'sub'},{id:'pow',name:'Power & Wi-Fi'}],
  budgets:{'2026-09':{wal:250,ald:541.67,tak:366.24,spo:20}},
  transactions:[{id:'i1',type:'income',amount:4760,source:'Pay',date:'2026-09-04'}],
  accounts:[{id:'j',name:'Joint account',kind:'checking',balance:5000,updated:'2026-09-11'}],
  assets:[],liabilities:[],goals:[],recurring:[],impulse:[],debts:[],diary:[],intake:{},lessons:[],vault:[]})));
await p.reload(); await p.waitForTimeout(1800);

/* ---- the picker ---- */
const pick=await p.evaluate(async()=>{
  const w=m=>new Promise(x=>setTimeout(x,m));
  activateTab('tx'); await w(1200);
  const sel=document.getElementById('txCat');
  const o={};
  /* every render used to rewrite it; count the rewrites instead of guessing */
  let writes=0;
  const proto=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
  Object.defineProperty(sel,'innerHTML',{configurable:true,
    get(){ return proto.get.call(this); },
    set(v){ writes++; return proto.set.call(this,v); }});

  o.offersNewCategory=[...sel.options].some(x=>x.value==='__new');
  o.offersTheGroup=[...sel.options].some(x=>/Food \(whole group\)/.test(x.text));
  o.offersTheChildren=['Walmart','Aldi','Dining','Takeout'].every(n=>[...sel.options].some(x=>x.text.trim()===n));

  /* pick one, the way a thumb does */
  sel.value='tak'; sel.dispatchEvent(new Event('change',{bubbles:true})); await w(150);
  writes=0;
  /* now redraw the world, repeatedly, exactly as the sync loop was doing */
  for(let i=0;i<5;i++){ renderAll(); await w(60); }
  o.rewritesWhileUnchanged=writes;
  o.keptTheChoice=sel.value;

  /* and with the picker OPEN - which on a phone means focused - a list that
     really has changed waits rather than reshuffling under the thumb */
  sel.focus();
  writes=0;
  state.categories.push({id:'new1',name:'Vet'});
  refreshCatSelects(); await w(80);
  o.heldBackWhileOpen=writes===0;
  o.stillHasOldList=![...sel.options].some(x=>x.text.trim()==='Vet');
  o.choiceSurvivedTheWait=sel.value==='tak';
  sel.blur(); await w(120);
  o.arrivedOnClose=[...sel.options].some(x=>x.text.trim()==='Vet');
  o.choiceSurvivedTheSwap=sel.value==='tak';
  o.newStillOffered=[...sel.options].some(x=>x.value==='__new');

  /* the two writers agree, so neither can undo the other */
  const a=catSelectOptions();
  renderTxForm(); await w(60);
  const afterForm=sel.innerHTML;
  refreshCatSelects(); await w(60);
  o.writersAgree = afterForm===sel.innerHTML && /__new/.test(a);
  return o;
});

/* ---- the loop ---- */
const loop=await p.evaluate(async()=>{
  const w=m=>new Promise(x=>setTimeout(x,m));
  const o={};
  /* A vault in a jar: one row, a stamp, and a subscriber that fires the way
     Realtime does - immediately on commit, well before a second round trip
     could finish. */
  let row={payload:null,stamp:''}, notified=0, pulls=0, pushes=0, subs=[];
  const commit=(payload,stamp)=>{ row={payload,stamp}; subs.forEach(f=>{ notified++; setTimeout(f,1); }); };

  syncActive=true; syncPass='x'; syncLastSeen='';
  window.vaultStamp=async()=>row.stamp;
  window.encryptVault=async s=>JSON.stringify(s);
  window.decryptVault=async pl=>JSON.parse(pl);
  window.getSupabase=async()=>({
    channel:()=>({on:(a,b,fn)=>{subs.push(fn);return{subscribe:cb=>{cb('SUBSCRIBED');return{unsubscribe(){}}}}}}),
    auth:{getSession:async()=>({data:{session:{user:{id:'u'}}}})},
    from:()=>({
      upsert:async r=>{ pushes++; commit(r.encrypted_payload,r.updated_at); return {error:null}; },
      select:()=>({eq:()=>({maybeSingle:async()=>{ pulls++; return {data:{encrypted_payload:row.payload},error:null}; },
                            order:()=>({limit:async()=>({data:[],error:null})})})}),
      insert:async()=>({error:null}), delete:()=>({eq:()=>({lt:async()=>({})})})
    })
  });
  window.vaultFileVersion=async()=>{ await w(120); return true; };   // the second round trip

  /* Arm the subscription. Without this the fakes are never called and every
     claim below passes for the wrong reason - which is how a loop ships under
     a green check. */
  await syncRealtimeStart();
  o.subscribed=subs.length===1;

  await pushToVault('x');            // the first write, as an edit would make it
  const p0=pushes, n0=notified;
  await w(1400);                     // long enough for several rounds of a loop
  o.pushesAfterOneEdit=pushes-p0;
  o.notificationsSettled=notified-n0<=1;
  o.pullsWereNotChased=pulls;

  /* a stamp this device did not write IS news and must be taken */
  row={payload:JSON.stringify(Object.assign({},state,{categories:state.categories.concat([{id:'zz',name:'From her phone'}])})),stamp:'2099-01-01T00:00:00.000Z'};
  const before=pulls;
  await syncCheck();
  await w(200);
  o.tookTheirChange=pulls>before && state.categories.some(c=>c.id==='zz');
  return o;
});

await b.close();

const T=[
  ['the category picker offers the group, its children and a way to add one',
   pick.offersTheGroup===true && pick.offersTheChildren===true && pick.offersNewCategory===true,
   JSON.stringify(pick).slice(0,140)],
  ['...and the two things that write that list write the same list',
   pick.writersAgree===true, String(pick.writersAgree)],

  ['redrawing the whole app does not touch a picker whose list has not changed',
   pick.rewritesWhileUnchanged===0, pick.rewritesWhileUnchanged+' rewrites across five renderAll()'],
  ['...so what was chosen is still chosen afterwards',
   pick.keptTheChoice==='tak', pick.keptTheChoice],

  ['a list that really did change waits while the picker is open',
   pick.heldBackWhileOpen===true && pick.stillHasOldList===true,
   JSON.stringify({held:pick.heldBackWhileOpen,old:pick.stillHasOldList})],
  ['...without losing the choice underneath it',
   pick.choiceSurvivedTheWait===true, String(pick.choiceSurvivedTheWait)],
  ['...and arrives the moment it closes',
   pick.arrivedOnClose===true && pick.choiceSurvivedTheSwap===true && pick.newStillOffered===true,
   JSON.stringify({arrived:pick.arrivedOnClose,kept:pick.choiceSurvivedTheSwap,nw:pick.newStillOffered})],

  ['the fake server is actually wired to the device, or none of this means anything',
   loop.subscribed===true, String(loop.subscribed)],
  ['one edit is one write, however fast the server tells us about it',
   loop.pushesAfterOneEdit===0,
   loop.pushesAfterOneEdit+' further pushes in 1.4s - a loop pushes every couple of seconds forever'],
  ['...and the device does not chase its own echo',
   loop.notificationsSettled===true, String(loop.notificationsSettled)],
  ['a change this device did not make is still taken',
   loop.tookTheirChange===true, String(loop.tookTheirChange)],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
console.log('page errors:', errs.length?[...new Set(errs)].join(' | '):'none');
process.exit(bad?1:0);
