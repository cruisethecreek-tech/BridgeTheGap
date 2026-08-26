/* ============================================================
   HOSTILE

   Why this suite exists, in the user's words: "I'm not understanding how
   your audits don't catch this."

   Fair. Every other suite in this folder is a REGRESSION net. Each section is
   named after something a person found on a phone, and the property was written
   after the report. A net built that way documents history and is always exactly
   one report behind whoever is using the app. The fixtures make it worse: they
   are written from the working example, so the recurring-source fixture said
   source:'Hollywood' - already named - and the bug lived in the input nobody
   thought to supply.

   This suite does not know what the bugs are. It supplies the inputs nobody
   thinks to supply - nothing, zero, negative, absurd, non-numeric, duplicate -
   to every form in the app, and then asserts properties that hold for ALL of
   them:

     1. NOTHING IN, NOTHING INVENTED. A form submitted empty either refuses, or
        creates a record whose identity the person actually gave. It never
        christens a record with a generic word. This is the class that let a
        nameless income rule become the string "Income", collide with the next
        nameless rule, and report a correct paycheck $836.97 short.

     2. NO IMPOSSIBLE NUMBER EVER REACHES STATE. Not NaN, not Infinity, not
        undefined, not a negative amount. Money that cannot exist will be
        rendered, summed and compared against.

     3. NO IMPOSSIBLE NUMBER EVER REACHES THE SCREEN. Every tab is swept after
        every hostile action for NaN, Infinity, undefined and [object Object].

     4. NOTHING THROWS. A page error means the app stopped doing its job at the
        exact moment someone was mid-task.

   A failure here is a bug nobody has hit yet. That is the entire point.
   ============================================================ */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const results=[]; const check=(name,ok,detail='')=>results.push({ok,name,detail});
const VIEWS=['home','budget','tx','impulse','debt','goals','reflect','learn','diary','settings'];

/* Words the app must never use as a record's identity when the person supplied
   none. Each one is a name that cannot be told apart from the next record that
   also supplied none - which is what makes it dangerous rather than merely ugly. */
const INVENTED=['income','investment','expense','untitled','unnamed','category','goal',
                'account','asset','debt','skill','item','thing','new','none','n/a'];

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{width:390,height:900} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
p.on('dialog',d=>d.dismiss());           // a confirm() is a refusal, and refusing is a pass
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(500);

const BASE={onboarded:true,activeMonth:'2026-08',uiMode:'all',stageReached:3,guidesOff:true,
  hourlyWage:24,hoursPerWeek:40,
  categories:[{id:'roof',name:'Roof'},{id:'fun',name:'Fun'}],
  budgets:{'2026-08':{roof:1200,fun:200}},
  transactions:[{id:'i1',type:'income',amount:3200,date:'2026-08-01',source:'Hollywood',srcType:'primary'},
                {id:'e1',type:'expense',amount:80,date:'2026-08-05',catId:'fun'}],
  goals:[],impulse:[],recurring:[],accounts:[{id:'ac1',name:'Checking',balance:2000,updated:'2026-08-01'}],
  assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[]};

const seed = st => p.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)), st);

/* Every submit in the app. Nothing here says what any of them do. */
const BUTTONS=['addTx','addRec','addCat','addGoal','addAcct','addAsset','addLiab','addDebt',
               'addSkill','addGive','addNet','qlAdd','qlSave','swAdd','twAdd','comfortAdd',
               'diarySave','tkSave'];

/* A record's "identity" is whatever a person would read to tell it from another. */
function identityFields(){ return ['name','source','label','title','dest','note']; }

const snapshot = () => p.evaluate(() => JSON.parse(JSON.stringify(state)));

/* Walk every collection in state and report anything that cannot be a number,
   anything negative that is money, and any identity the person did not supply. */
async function inspect(before, label, typed){
  const after = await snapshot();
  const faults=[];
  const walk=(node,path)=>{
    if(node===null||node===undefined) return;
    if(typeof node==='number'){
      if(!Number.isFinite(node)) faults.push(`${path} = ${node}`);
      if(/amount|balance|value|cost|target|saved|apr|min|limit|wage|hours|price/i.test(path)
         && node<0 && !/net|delta|diff|change/i.test(path)) faults.push(`${path} = ${node} (negative)`);
      return;
    }
    if(typeof node==='string'){ if(node==='NaN'||node==='undefined'||node==='Infinity') faults.push(`${path} = "${node}"`); return; }
    if(Array.isArray(node)){ node.forEach((x,i)=>walk(x,`${path}[${i}]`)); return; }
    if(typeof node==='object'){ Object.keys(node).forEach(k=>walk(node[k],`${path}.${k}`)); }
  };
  walk(after,'state');

  /* anything that appeared, carrying a name nobody typed */
  const invented=[];
  for(const key of Object.keys(after)){
    if(!Array.isArray(after[key])) continue;
    const had=new Set((Array.isArray(before[key])?before[key]:[]).map(x=>x&&x.id));
    for(const row of after[key]){
      if(!row||typeof row!=='object'||had.has(row.id)) continue;
      for(const f of identityFields()){
        const v=(row[f]==null?'':String(row[f])).trim().toLowerCase();
        if(v && INVENTED.includes(v) && !typed.includes(v))
          invented.push(`${key}.${f} = "${row[f]}"`);
      }
    }
  }
  return {faults, invented, after};
}

/* Sweep every tab for a number that cannot exist, rendered. */
async function sweepScreen(){
  return p.evaluate(async (views) => {
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const hits=[];
    for(const v of views){
      try{ activateTab(v); }catch(e){ hits.push(`${v}: threw ${e.message}`); continue; }
      await wait(60);
      const t=(document.getElementById('view-'+v)||{}).innerText||'';
      const m=t.match(/NaN|Infinity|\[object Object\]|\bundefined\b|\$-\d/g);
      if(m) hits.push(`${v}: ${[...new Set(m)].join(', ')}`);
    }
    return hits;
  }, VIEWS);
}

/* ---------- 1. every form, every field left out in turn ---------- */
/* Two blind spots had to be cleared before this found anything, and both were
   the same mistake the fixtures make.

   The first version clicked each button once with the form emptied. It missed
   the bug it was written for, because recType defaults to "expense" and the
   nameless source lives in the income branch. So every option of every select
   gets its turn.

   The second version emptied EVERY field at once. It still missed, because an
   all-empty form is stopped by the first guard on the handler - "Enter an
   amount" - and no guard after it is ever reached. A form with one hole in it is
   the shape that finds the missing guard, and it is also the shape of what
   people actually do: they fill the form and miss a box.

   So: fill everything plausibly, blank exactly one field, submit. For every
   field, on every branch, of every form. */
/* Reset through the app's own load(), not by assigning a parsed literal. The
   first version did the latter and produced three page errors that were purely
   the harness's fault: load() merges a stored state over defaultState(), so a
   fixture that omits an array still comes back whole, and skipping that door
   handed the app a state no real user could ever have. A test harness that
   enters through a door the user cannot use reports faults the user cannot
   hit - and, worse, hides the ones they can. */
async function reset(st){
  await p.evaluate(s=>{ localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s));
    try{ state=load(); if(typeof renderAll==='function') renderAll(); }catch(e){} }, st);
  await p.waitForTimeout(90);
}
/* Some forms live behind a door rather than on a tab. Opening a door is not the
   same as knowing what is behind it, so these stay in the spirit of the suite -
   but anything still unreachable is PRINTED as a gap rather than quietly
   counted as covered. A form nobody probes is not a form that passed. */
async function openForm(bid, pick){
  await p.evaluate((b)=>{ const OP={
      qlAdd:  ()=>{ openQuickLogFor(todayStr()); },
      qlSave: ()=>{ openQuickLogFor(todayStr()); },
      twAdd:  ()=>{ renderTripwires(); },
      /* the sweep only draws its Add button once a row exists, which is the
         state a person is in by the time they could press it */
      swAdd:  ()=>{ subSweepRows=[{name:'Probe',amt:'9'}]; renderSubSweep(); } };
    try{ if(OP[b]) OP[b](); }catch(e){} }, bid);
  await p.waitForTimeout(120);
  return p.evaluate(async ([bid,pick]) => {
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const el=document.getElementById(bid); if(!el) return {how:'missing'};
    const view=el.closest('[id^="view-"]');
    if(view){ try{ activateTab(view.id.replace('view-','')); }catch(e){} await wait(100); }
    let d=el.closest('details'); while(d){ d.open=true; d=d.parentElement&&d.parentElement.closest('details'); }
    await wait(60);
    if(el.offsetParent===null && !el.closest('.on')) return {how:'hidden'};
    if(pick){ const sel=document.getElementById(pick.id);
      if(sel){ sel.value=pick.value; sel.dispatchEvent(new Event('change',{bubbles:true})); await wait(130); } }
    const region=el.closest('.card,.panel,details,.sheet,form')||document;
    const ids=[...region.querySelectorAll('input,textarea')]
      .filter(i=>i.type!=='checkbox'&&i.type!=='radio'&&i.type!=='date'&&i.type!=='file'&&i.offsetParent!==null&&i.id)
      .map(i=>i.id);
    return {how:'open', ids};
  }, [bid,pick||null]);
}
/* fill it the way someone who means it would, with one box left alone */
async function submitMissing(bid, pick, holeId){
  return p.evaluate(async ([bid,pick,hole]) => {
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const el=document.getElementById(bid); if(!el) return 'missing';
    if(pick){ const sel=document.getElementById(pick.id);
      if(sel){ sel.value=pick.value; sel.dispatchEvent(new Event('change',{bubbles:true})); await wait(130); } }
    const region=el.closest('.card,.panel,details,.sheet,form')||document;
    region.querySelectorAll('input,textarea').forEach(i=>{
      if(i.type==='checkbox'||i.type==='radio'||i.type==='date'||i.type==='file') return;
      i.value = (i.id===hole) ? '' : ((i.type==='number'||i.inputMode==='decimal')?'25':'probe');
      i.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await wait(70);
    el.click(); await wait(220);
    return 'clicked';
  }, [bid,pick||null,holeId]);
}
const branchesOf = bid => p.evaluate((b)=>{
  const el=document.getElementById(b); if(!el) return [];
  const region=el.closest('.card,.panel,details,.sheet,form')||document;
  const out=[];
  region.querySelectorAll('select').forEach(sel=>{
    if(!sel.id||sel.options.length<2) return;
    [...sel.options].slice(0,6).forEach(o=>out.push({id:sel.id, value:o.value}));
  });
  return out.slice(0,18);
}, bid);

const emptyReport=[]; const unreachable=[];
let probes=0;
await seed(BASE); await p.reload(); await p.waitForTimeout(500);
for(const id of BUTTONS){
  const first=await openForm(id,null);
  if(first.how!=='open'){ unreachable.push(`${id}: ${first.how}`); continue; }
  const branches=[null, ...(await branchesOf(id))];
  for(const pick of branches){
    const o=await openForm(id,pick);
    if(o.how!=='open') continue;
    for(const hole of [null, ...o.ids]){
      await reset(BASE);
      const before=await snapshot();
      if(await submitMissing(id,pick,hole)!=='clicked') continue;
      probes++;
      const r=await inspect(before, id, ['probe']);
      const where=`${id}${pick?` [${pick.id}=${pick.value}]`:''}${hole?` missing:${hole}`:' complete'}`;
      if(r.faults.length)   emptyReport.push(`${where} IMPOSSIBLE: ${r.faults.slice(0,2).join('; ')}`);
      if(r.invented.length) emptyReport.push(`${where} INVENTED: ${r.invented.slice(0,2).join('; ')}`);
    }
  }
}
check('no form with one box left empty invents an identity for the record it creates',
      !emptyReport.some(x=>/INVENTED/.test(x)),
      emptyReport.filter(x=>/INVENTED/.test(x)).slice(0,6).join(' | '));
check('no form with one box left empty writes a number that cannot exist',
      !emptyReport.some(x=>/IMPOSSIBLE/.test(x)),
      emptyReport.filter(x=>/IMPOSSIBLE/.test(x)).slice(0,6).join(' | '));

let screen=await sweepScreen();
check('nothing unrenderable reaches the screen after all of that',
      screen.length===0, screen.join(' | '));

/* ---------- 2. every number field, filled with what a number field invites ---------- */
const JUNK=['-5','abc','1e21','999999999999'];
const junkReport=[];
for(const bad of JUNK){
  for(const id of BUTTONS){
    await seed(BASE); await p.reload(); await p.waitForTimeout(260);
    const o=await openForm(id,null); if(o.how!=='open') continue;
    const before=await snapshot();
    await p.evaluate(async ([bid,val])=>{
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      const el=document.getElementById(bid);
      const region=el.closest('.card,.panel,details,.sheet,form')||document;
      region.querySelectorAll('input,textarea').forEach(i=>{
        if(i.type==='checkbox'||i.type==='radio'||i.type==='date'||i.type==='file') return;
        i.value=(i.type==='number'||i.inputMode==='decimal')?val:'probe';
        i.dispatchEvent(new Event('input',{bubbles:true})); });
      await wait(60); el.click(); await wait(200);
    },[id,bad]);
    const r=await inspect(before, id, ['probe']);
    if(r.faults.length) junkReport.push(`${id} <- "${bad}": ${r.faults.slice(0,2).join('; ')}`);
  }
  const sc=await sweepScreen();
  if(sc.length) junkReport.push(`screen after "${bad}": ${sc.slice(0,2).join(' | ')}`);
}
check('no number a field will accept can put an impossible value into your data',
      junkReport.length===0, junkReport.slice(0,4).join(' | '));

/* ---------- 3. two of everything, named the same ---------- */
/* The failure this catches is not the duplicate. It is the app answering a
   question about "the one called X" when there are two of them. */
await seed({...BASE,
  recurring:[{id:'r1',type:'income',amount:1600,source:'Twin',freq:'biweek',anchor:'2026-08-01'},
             {id:'r2',type:'income',amount:2436.97,source:'Twin',freq:'biweek',anchor:'2026-08-15'}],
  categories:[{id:'c1',name:'Twin'},{id:'c2',name:'Twin'}],
  accounts:[{id:'a1',name:'Twin',balance:100,updated:'2026-08-01'},
            {id:'a2',name:'Twin',balance:900,updated:'2026-08-01'}],
  goals:[{id:'g1',name:'Twin',target:1000,saved:0},{id:'g2',name:'Twin',target:5000,saved:0}]});
await p.reload(); await p.waitForTimeout(500);
const twins=await p.evaluate(()=>{
  const out={};
  /* if a name is ambiguous, an answer derived from an arbitrary pick is worse
     than no answer - it is stated with the same confidence as a true one */
  out.expected = typeof txExpectedFor==='function' ? txExpectedFor('Twin') : null;
  out.rules=(state.recurring||[]).filter(r=>(r.source||'')==='Twin').length;
  return out;
});
check('with two streams sharing a name, the app declines to say what "it" pays',
      twins.rules===2 && twins.expected===0, JSON.stringify(twins));
const twinScreen=await sweepScreen();
check('...and duplicate names do not break any screen', twinScreen.length===0, twinScreen.join(' | '));

/* ---------- 4. an empty life ---------- */
/* Every panel, on a state with nothing in it. Division by a month with no income
   is where impossible numbers are born. */
await seed({onboarded:true,activeMonth:'2026-08',uiMode:'all',stageReached:3,guidesOff:true,
  categories:[],budgets:{},transactions:[],goals:[],impulse:[],recurring:[],accounts:[],
  assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[]});
await p.reload(); await p.waitForTimeout(500);
const emptyScreen=await sweepScreen();
check('an app with nothing logged in it renders no impossible number',
      emptyScreen.length===0, emptyScreen.join(' | '));

check('nothing threw at any point', errs.length===0, [...new Set(errs)].slice(0,4).join(' | '));

console.log('HOSTILE - the inputs nobody thinks to supply\n');
let fails=0;
for(const r of results){ if(!r.ok) fails++; console.log(`${r.ok?'ok  ':'FAIL'}  ${r.name}${r.detail?'\n        '+String(r.detail).replace(/\n/g,' ').slice(0,400):''}`); }
console.log(`\n${results.length-fails} of ${results.length} hold`);
console.log(`${probes} form submissions probed across ${BUTTONS.length} forms`);
if(unreachable.length) console.log('not reachable in this fixture:', unreachable.join(', '));
console.log('page errors:', errs.length?[...new Set(errs)]:'none');
await b.close();
if(fails) process.exit(1);
