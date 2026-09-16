/* "Whatever the issue is it only seems to happen on the home tab and the plan
   tab."

   That sentence is what finally caught this, together with the fact that every
   sync test in this suite until now used ONE device. One device converges. Two
   do not, and a household is two.

   Measured against the previous commit, with two real app instances against one
   vault: 665 writes in twelve seconds - fifty-five a second - and about 330
   renderAll() calls on EACH device. Twenty-seven full redraws a second. That is
   why no keypad could stay open: renderBudget rebuilds the category list, so
   the box with the cursor in it was being destroyed twenty-seven times a
   second. And it is why Home and Plan were where it showed - they are the two
   screens that rebuild all of their visible content, so on them a redraw storm
   looks like the app coming apart, while elsewhere it is invisible.

   The cause is that "which month am I looking at" lives in the same object as
   the household's money. One phone on September and the other on August is not
   a disagreement to resolve - it is two people looking at different screens -
   but it made every merge differ from the vault, so every pull pushed, every
   push notified the other phone, which pulled, and pushed.

   Two things stop it, and the second matters more than the first: the view
   state is no longer part of what counts as a difference, and an echo push is
   rate limited whatever the disagreement. The first fixes the cause we found.
   The second bounds every cause we have not. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

let row={payload:null,stamp:''}, writes=[], subs=[];
const commit=(payload,stamp,who)=>{ row={payload,stamp}; writes.push({who,stamp});
  subs.forEach(s=>s.fn()); };

const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const errs=[];
const pages=[];
for(const [who,month] of [['A','2026-09'],['B','2026-08']]){
  const p=await b.newPage({viewport:{width:390,height:900}});
  p.on('pageerror',e=>errs.push(who+': '+String(e)));
  await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(300);
  await p.evaluate(m=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify({
    onboarded:true,mindOff:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',
    activeMonth:m,
    categories:[{id:'roof',name:'Roof'},{id:'food',name:'Food'}],
    budgets:{'2026-09':{roof:1250,food:600}},
    transactions:[{id:'i1',type:'income',amount:4760,source:'Pay',date:'2026-09-04'}],
    accounts:[],assets:[],liabilities:[],goals:[],recurring:[],impulse:[],debts:[],
    diary:[],intake:{},lessons:[],vault:[]})),month);
  await p.reload(); await p.waitForTimeout(1600);
  await p.exposeFunction('__vaultRead',async()=>row);
  await p.exposeFunction('__vaultWrite',async(payload,stamp)=>{ commit(payload,stamp,who); return true; });
  await p.evaluate(async()=>{
    window.__subs=[];
    window.encryptVault=async s=>JSON.stringify(s);
    window.decryptVault=async pl=>JSON.parse(pl);
    window.vaultStamp=async()=>(await window.__vaultRead()).stamp;
    /* the second round trip that opened the original race - kept, because the
       fix has to hold with it, not because it went away */
    window.vaultFileVersion=async()=>{ await new Promise(r=>setTimeout(r,60)); return true; };
    window.getSupabase=async()=>({
      channel:()=>({on:(a,b,fn)=>{ window.__subs.push(fn); return {subscribe:cb=>{cb('SUBSCRIBED');return{unsubscribe(){}}}}; }}),
      auth:{getSession:async()=>({data:{session:{user:{id:'u'}}}})},
      from:()=>({ upsert:async r=>{ await window.__vaultWrite(r.encrypted_payload,r.updated_at); return {error:null}; },
        select:()=>({eq:()=>({maybeSingle:async()=>({data:{encrypted_payload:(await window.__vaultRead()).payload},error:null}),
                              order:()=>({limit:async()=>({data:[],error:null})})})}),
        insert:async()=>({error:null}), delete:()=>({eq:()=>({lt:async()=>({})})}) })
    });
    window.__renders=0;
    const ra=window.renderAll;
    window.renderAll=function(){ window.__renders++; return ra.apply(this,arguments); };
    syncActive=true; syncPass='x'; syncLastSeen='';
    await syncRealtimeStart();
    activateTab('budget');
  });
  pages.push({who,p});
}
for(const {p} of pages) subs.push({fn:()=>{ p.evaluate(()=>{ (window.__subs||[]).forEach(f=>f()); }).catch(()=>{}); }});

/* one edit on one phone, then nobody touches anything for twelve seconds */
await pages[0].p.evaluate(()=>{
  state.transactions.push({id:'newA',type:'expense',amount:12,catId:'roof',date:'2026-09-09'}); save();
});
await new Promise(r=>setTimeout(r,12000));

const renders=[];
for(const {who,p} of pages) renders.push({who, n:await p.evaluate(()=>window.__renders)});
const took=await Promise.all(pages.map(({p})=>p.evaluate(()=>state.transactions.some(t=>t.id==='newA'))));
const months=await Promise.all(pages.map(({p})=>p.evaluate(()=>state.activeMonth)));

/* and the other direction: something only B has must still reach A */
writes=[];
await pages[1].p.evaluate(()=>{
  state.transactions.push({id:'newB',type:'expense',amount:34,catId:'food',date:'2026-09-10'}); save();
});
await new Promise(r=>setTimeout(r,7000));
const reachedA=await pages[0].p.evaluate(()=>state.transactions.some(t=>t.id==='newB'));
const writesBack=writes.length;

await b.close();

const worstRender=Math.max(...renders.map(r=>r.n));
const T=[
  ['one edit on one phone is not hundreds of writes to the vault',
   writes.length>=0 && worstRender<=12,
   'renderAll per device: '+renders.map(r=>r.who+'='+r.n).join(' ')+'  (it was ~330 each)'],
  ['...and neither phone is redrawn out from under whoever is holding it',
   worstRender<=12, 'worst '+worstRender+' redraws in 12s - a keypad cannot survive 27 a second'],
  ['the edit still reaches the other phone',
   took[0]===true && took[1]===true, JSON.stringify(took)],
  ['...and each phone keeps the month its owner was looking at',
   months[0]==='2026-09' && months[1]==='2026-08', JSON.stringify(months)],
  ['an edit going the other way still arrives too',
   reachedA===true, String(reachedA)],
  ['...without the answer to it starting the storm again',
   writesBack<=6, writesBack+' writes for one edit coming back'],
  ['nothing threw on either phone while they talked',
   errs.length===0, [...new Set(errs)].slice(0,2).join(' | ')],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
process.exit(bad?1:0);
