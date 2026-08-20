/* ============================================================
   MATH AUDIT - property-based fuzzing over the whole money engine.
   Instead of checking "does 2+2 print 4", it generates hundreds of random
   but plausible app states and asserts things that must NEVER be false.
   A single counterexample is a bug, and the seed makes it reproducible.
   ============================================================ */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const N = +(process.argv[2] || 300);          // how many random states to try
let seed = +(process.argv[3] || 20260820);
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ri = (a,b) => a + Math.floor(rnd()*(b-a+1));
const money = () => Math.round(rnd()*4000*100)/100;
const pick = a => a[ri(0,a.length-1)];

function makeState(i){
  const M='2026-08';
  const cats=[], budgets={[M]:{}};
  const tops=ri(0,5);
  for(let t=0;t<tops;t++){
    const id='c'+t; cats.push({id,name:pick(['Roof','Food','Power & Wi-Fi','Getting Around','Fun Money','Memberships','Pets'])+t});
    if(rnd()<0.7) budgets[M][id]=money();
    const kids=ri(0,3);
    for(let k=0;k<kids;k++){
      const kid=id+'k'+k; cats.push({id:kid,name:'Sub'+k,parentId:id});
      if(rnd()<0.7) budgets[M][kid]=money();
      const g=ri(0,2);
      for(let j=0;j<g;j++){ const gid=kid+'g'+j; cats.push({id:gid,name:'Leaf'+j,parentId:kid}); if(rnd()<0.7) budgets[M][gid]=money(); }
    }
  }
  const txs=[];
  for(let t=0;t<ri(0,25);t++){
    const type=pick(['income','expense','expense','invest']);
    const day=String(ri(1,28)).padStart(2,'0');
    const tx={id:'t'+t,type,amount:money(),date:`${M}-${day}`};
    if(type==='expense') tx.catId = cats.length&&rnd()<0.9 ? pick(cats).id : null;
    if(type==='income') tx.source='Pay';
    if(type==='invest'){ tx.source='Fund'; tx.ikind=pick(['holds','self']); }
    txs.push(tx);
  }
  const accounts=[];
  for(let a=0;a<ri(0,4);a++) accounts.push({id:'a'+a,name:'Acct'+a,kind:pick(['checking','savings','cash','invest','other']),
    purpose:pick(['','emergency','college','sinking','retire']),balance:money(),updated:'2026-08-10'});
  const recurring=[];
  for(let r=0;r<ri(0,4);r++){
    const type=pick(['expense','income','invest']);
    const it={id:'r'+r,type,amount:money(),freq:pick(['weekly','biweekly','semimonthly','monthly','quarterly','yearly']),
      anchor:`2026-0${ri(6,8)}-${String(ri(1,28)).padStart(2,'0')}`};
    if(type==='expense') it.catId=cats.length?pick(cats).id:null; else it.source='Src';
    if(type==='invest') it.ikind=pick(['holds','self']);
    recurring.push(it);
  }
  return { onboarded:true, activeMonth:M, stageReached:3, hourlyWage:pick([0,12,22.5,40]), hoursPerWeek:pick([0,32,40,55]),
    categories:cats, budgets, transactions:txs, accounts, recurring,
    assets:rnd()<0.5?[{id:'as1',name:'Car',value:money(),kind:pick(['real','stuff']),cost:0}]:[],
    liabilities:rnd()<0.5?[{id:'l1',name:pick(['Visa','Mortgage']),value:money()}]:[],
    goals:rnd()<0.5?[{id:'g1',name:'Emergency fund',target:2000,saved:money(),goalType:'foundation'}]:[],
    debts:rnd()<0.4?[{id:'d1',name:'Visa',balance:money(),apr:19,minPayment:50}]:[],
    timeLog:[], comfortMenu:[], subSweep:null, deepenSkipped:[], deepenSkipMonth:'', giving:[], givingPct:0 };
}

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{width:390,height:900} });
const pageErrs=[]; p.on('pageerror',e=>pageErrs.push(e.message));
await p.goto('file://'+process.cwd()+'/app.html');

const violations=[];
for(let i=0;i<N;i++){
  const st=makeState(i);
  const v = await p.evaluate((seedState)=>{
    const bad=[];
    const near=(a,b,tol=0.02)=>Math.abs(a-b)<=tol;
    const finite=x=>typeof x==='number'&&isFinite(x);
    state=normalizeState(Object.assign(defaultState(), seedState));
    const M=state.activeMonth;

    // --- accounting identities ---
    if(!near(netWorth(), sumAssets()+bankTotal()-sumLiab())) bad.push('netWorth != assets + bank - liabilities');
    const inc=state.transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exp=state.transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const inv=state.transactions.filter(t=>t.type==='invest').reduce((s,t)=>s+t.amount,0);
    if(!near(allTimeBalance(), inc-exp-inv)) bad.push('allTimeBalance != income - expense - invest');
    if(!near(monthExpense(M), state.transactions.filter(t=>t.type==='expense'&&monthOf(t.date)===M).reduce((s,t)=>s+t.amount,0))) bad.push('monthExpense contaminated');
    if(!near(monthInvested(M), state.transactions.filter(t=>t.type==='invest'&&monthOf(t.date)===M).reduce((s,t)=>s+t.amount,0))) bad.push('monthInvested wrong');

    // --- category tree ---
    state.categories.forEach(c=>{
      const kids=childrenOf(c.id);
      const rollSpend=spentFor(c.id,M)+descendantsOf(c.id).reduce((s,k)=>s+spentFor(k.id,M),0);
      if(!near(catSpent(c.id,M), rollSpend)) bad.push('catSpent != own + descendants ('+c.id+')');
      const expect=kids.length?Math.max(assignedFor(c.id,M), kids.reduce((s,k)=>s+catAssigned(k.id,M),0)):assignedFor(c.id,M);
      if(!near(catAssigned(c.id,M), expect)) bad.push('catAssigned != max(own, sum kids) ('+c.id+')');
      if(catDepth(c.id)>3) bad.push('nesting deeper than 3 ('+c.id+')');
    });

    // --- the two tabs must agree (this is the bug class that shipped once) ---
    const planAssigned=topCats().reduce((s,c)=>s+catAssigned(c.id,M),0);
    renderHome(); renderBudget();
    const grab=(el,label)=>{ const t=(document.getElementById(el)||{}).textContent||''; const m=t.match(new RegExp(label+'\\s*(-?\\$[\\d,]+(?:\\.\\d+)?)')); return m?m[1]:null; };
    const h=grab('homeSnap','Left to budget'), pl=grab('summary','Left to budget');
    if(h&&pl&&h!==pl) bad.push('Home LTB '+h+' != Plan LTB '+pl);
    if(!finite(planAssigned)) bad.push('assigned not finite');

    // --- recurring schedules ---
    state.recurring.forEach(r=>{
      ['2026-07','2026-08','2026-09','2027-02'].forEach(m=>{
        const occ=recOccurrences(r,m);
        const dim=daysInMonth(m);
        occ.forEach(d=>{
          if(monthOf(d)!==m) bad.push('occurrence outside its month');
          if(+d.slice(8,10)>dim) bad.push('occurrence past end of month');
          if(r.anchor && d<r.anchor) bad.push('occurrence before anchor');
        });
        if(new Set(occ).size!==occ.length) bad.push('duplicate occurrences');
        if(occ.slice().sort().join()!==occ.join()) bad.push('occurrences unsorted');
      });
    });
    // idempotence + no future posting in the current month
    const before=state.transactions.length;
    const first=postRecurring(thisMonth()); const second=postRecurring(thisMonth());
    if(second!==0) bad.push('postRecurring not idempotent');
    state.transactions.slice(before).forEach(t=>{ if(t.date>todayStr()) bad.push('posted a future-dated transaction'); });

    // --- invest asset conservation ---
    const holds=state.transactions.filter(t=>t.type==='invest'&&(t.ikind||'holds')!=='self').reduce((s,t)=>s+t.amount,0);
    const asset=(state.assets.find(a=>a.auto==='invest')||{}).value||0;
    if(asset>0 && asset>holds+0.02) bad.push('invest asset exceeds holds-value contributions');

    // --- runway sanity ---
    const rw=freedomRunway();
    if(rw!==null && (!finite(rw)||rw<0)) bad.push('runway not a sane number');

    // --- nothing non-finite reaches a formatter ---
    [0,1,-1,0.005,1e9].forEach(x=>{ if(/NaN|Infinity|undefined/.test(usd(x)+money(x)+fmtLife(x))) bad.push('formatter produced NaN/undefined'); });

    // --- render every surface and sweep the DOM ---
    ['home','budget','tx','impulse','goals','debt','learn','settings'].forEach(t=>{ try{ activateTab(t); }catch(e){ bad.push('activateTab threw on '+t+': '+e.message); } });
    const txt=document.body.innerText||'';
    if(/NaN/.test(txt)) bad.push('NaN visible in UI');
    if(/\$undefined|undefined,|Infinity/.test(txt)) bad.push('undefined/Infinity visible in UI');

    // --- export -> import round trip preserves every headline figure ---
    const snapshot={nw:netWorth(),as:planAssigned,sp:monthExpense(M),bal:allTimeBalance(),bank:bankTotal()};
    const clone=normalizeState(Object.assign(defaultState(), JSON.parse(JSON.stringify(state))));
    const keep=state; state=clone;
    const after={nw:netWorth(),as:topCats().reduce((s,c)=>s+catAssigned(c.id,M),0),sp:monthExpense(M),bal:allTimeBalance(),bank:bankTotal()};
    state=keep;
    Object.keys(snapshot).forEach(k=>{ if(!near(snapshot[k],after[k])) bad.push('round trip changed '+k); });

    return bad;
  }, st);
  if(v.length) violations.push({ i, seedUsed:seed, problems:[...new Set(v)] });
}

console.log('states tested:', N);
console.log('states with violations:', violations.length);
if(violations.length){
  const tally={};
  violations.forEach(v=>v.problems.forEach(pr=>tally[pr]=(tally[pr]||0)+1));
  console.log('\nDISTINCT PROBLEMS:');
  Object.entries(tally).sort((a,b)=>b[1]-a[1]).forEach(([k,c])=>console.log('  ['+c+'x] '+k));
  console.log('\nfirst failing case index:', violations[0].i);
} else console.log('no invariant violated');
console.log('page errors:', pageErrs.length?[...new Set(pageErrs)]:'none');
await b.close();
