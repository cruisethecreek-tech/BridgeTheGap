/* ============================================================
   STRUCTURE

   Two things this suite exists to stop.

   1. Reports scattered across tabs. The four charts lived inside Learn, between
      a school and a philosophy panel, and one of them told you to go to the PLAN
      tab to change the period it was showing. A report you cannot steer from
      where you are reading it is a poster. They are one destination now, with a
      period control that belongs to them.

   2. Everything visible on day one. A brand-new guided user was shown 27 panels
      across 8 tabs, and the stage ladder - the entire mechanism for not
      overwhelming people - was hiding six of them. Panels that need data now
      wait for it, and say what will bring them back.

   It also checks id uniqueness in the LIVE dom, because building this turned up
   a panel carrying two id attributes: the second was ignored, so the code that
   had been hiding it silently stopped finding it.
   ============================================================ */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const results=[]; const check=(name,ok,detail='')=>results.push({ok,name,detail});
const VIEWS=['home','budget','tx','impulse','debt','goals','reflect','learn','diary','settings'];

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{width:390,height:1000} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(500);

const seed = st => p.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)), st);
const EMPTY={onboarded:true,activeMonth:'2026-08',uiMode:'guided',stageReached:1,
  categories:[],budgets:{},transactions:[],goals:[],impulse:[],recurring:[],accounts:[],
  assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[]};
const FULL={...EMPTY, uiMode:'all', stageReached:3, hourlyWage:24,
  categories:[{id:'roof',name:'Roof'},{id:'fun',name:'Fun'}],
  budgets:{'2026-08':{roof:1250,fun:300}},
  transactions:[{id:'i1',type:'income',amount:3200,date:'2026-08-01'},
                {id:'i0',type:'income',amount:3100,date:'2026-07-01'},
                {id:'s1',type:'expense',amount:1250,catId:'roof',date:'2026-08-02'},
                {id:'s2',type:'expense',amount:270,catId:'fun',date:'2026-08-20'}],
  accounts:[{id:'a',name:'Checking',kind:'checking',balance:2150}],
  assets:[{id:'as',name:'Index fund',value:12000,kind:'real'}],
  liabilities:[{id:'l',name:'Card',value:2400}],
  debts:[{id:'d',name:'Card',balance:2400,minPayment:75,apr:23.9}], debtBudget:400};

/* ---- 1. Reflect exists, is reachable, and owns the four reports ---- */
await seed(FULL); await p.reload(); await p.waitForTimeout(900);
const reflect = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('reflect'); await wait(200);
  const subs=[...document.querySelectorAll('#rfTabs .rf-tab')].map(b=>b.dataset.rf);
  const seen={};
  for(const t of subs){ rfTab=t; renderReflectTab(); await wait(120);
    seen[t]={ chart:!!document.querySelector('#rfBody svg, #rfBody .cbar, #rfBody .mcol, #rfBody .bd-ring, #rfBody canvas, #rfBody .bd-row'),
              hasPeriod:!!document.getElementById('rfPrev') }; }
  return { tab:!!document.querySelector('[data-view="reflect"]'), subs, seen,
           learnPanels:[...document.querySelectorAll('#view-learn h2')].map(h=>h.textContent) };
});
check('a Reflect tab exists', reflect.tab===true);
check('...with the four reports as sub-tabs',
      JSON.stringify(reflect.subs)===JSON.stringify(['breakdown','trends','worth','inout']), reflect.subs.join(','));
for(const t of reflect.subs) check(`...and "${t}" actually draws something`, reflect.seen[t].chart===true);
check('Learn went back to teaching only',
      reflect.learnPanels.length===2 && /Money School/.test(reflect.learnPanels[0]), reflect.learnPanels.join(' | '));

/* ---- 2. the period control belongs to the report, not another tab ---- */
const period = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  rfTab='trends'; renderReflectTab(); await wait(150);
  const before=state.activeMonth;
  document.getElementById('rfPrev').click(); await wait(200);
  const after=state.activeMonth;
  const shown=document.querySelector('.rf-m').innerText;
  const plan=document.getElementById('mLabel').innerText;
  document.getElementById('rfNext').click(); await wait(200);
  return { before, after, back:state.activeMonth, shown, plan,
           text:document.getElementById('rfBar').innerText };
});
check('the report carries its own month arrows', period.after==='2026-07', period.after);
check('...they walk back and forward', period.back==='2026-08', period.back);
check('...the report and the Plan header stay one truth', /July 2026/.test(period.plan), period.plan.replace(/\n/g,' '));
check('...and nothing tells you to go to another tab to change it',
      !/on the Plan tab|Plan tab/i.test(period.text), period.text.replace(/\n/g,' ').slice(0,90));

/* ---- 3. net worth is assembled in one place, and adds up ---- */
const worth = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  rfTab='worth'; renderReflectTab(); await wait(150);
  const t=document.getElementById('rfBody').innerText;
  return { text:t, nw:netWorth(), a:sumAssets()+bankTotal(), l:sumLiab(),
           hasTrend:!!document.querySelector('#trendChart svg'),
           editLink:!!document.getElementById('rfEditNW') };
});
check('net worth shows the headline figure', worth.text.includes(String(worth.nw).replace(/\B(?=(\d{3})+(?!\d))/g,',')), String(worth.nw));
check('...and its two halves reconcile to it', Math.abs((worth.a-worth.l)-worth.nw)<0.005,
      `${worth.a} - ${worth.l} = ${worth.a-worth.l}, headline ${worth.nw}`);
check('...with the balance trend on the same screen', worth.hasTrend===true);
check('...and editing still lives in Build, linked from here', worth.editLink===true);

/* ---- 4. an empty app says so instead of drawing nothing ---- */
await seed(EMPTY); await p.reload(); await p.waitForTimeout(900);
const empty = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('reflect'); await wait(200);
  return { text:document.getElementById('rfBody').innerText, cta:!!document.getElementById('rfLog') };
});
check('with nothing logged, Reflect explains rather than drawing empty charts',
      /Nothing to reflect on yet/.test(empty.text), empty.text.replace(/\n/g,' ').slice(0,80));
check('...and offers the way out of that', empty.cta===true);

/* ---- 5. panels that need data wait for it, and say what unlocks them ---- */
const gates = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const out={};
  for(const v of ['budget','tx','impulse','debt','learn']){ activateTab(v); await wait(120);
    out[v]=[...document.querySelectorAll('#view-'+v+' .panel-waiting')].map(el=>({
      h:(el.querySelector('h2')||{}).textContent||'?',
      note:(el.querySelector('.pw-note')||{}).textContent||'',
      keepsHeading:!!el.querySelector('h2'),
      hidesControls:[...el.querySelectorAll('input,select,button')].every(c=>c.offsetParent===null) }));
  }
  return out;
});
const allWaiting=Object.values(gates).flat();
check(`panels with nothing to show fold away (${allWaiting.length} of them)`, allWaiting.length>=3,
      allWaiting.map(x=>x.h).join(' | '));
check('...each keeping its heading, so no tool is a secret', allWaiting.every(x=>x.keepsHeading));
check('...each saying what will bring it back', allWaiting.every(x=>x.note.length>10),
      allWaiting.map(x=>x.note.slice(0,40)).join(' // '));
check('...and hiding its controls until then', allWaiting.every(x=>x.hidesControls));

/* an input panel is never gated - you cannot get data without it */
const inputs = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); await wait(150);
  const first=document.querySelector('#view-debt .panel');
  return { h:(first.querySelector('h2')||{}).textContent, waiting:first.classList.contains('panel-waiting'),
           usable:[...first.querySelectorAll('input')].some(i=>i.offsetParent!==null) };
});
check('the panel you ADD debts in is never gated', inputs.waiting===false, inputs.h);
check('...and stays usable with no debts', inputs.usable===true);

/* ---- 6. the gates reopen the moment there is data ---- */
await seed(FULL); await p.reload(); await p.waitForTimeout(900);
const reopened = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); await wait(200);
  return [...document.querySelectorAll('#view-debt .panel')].map(el=>({
    h:(el.querySelector('h2')||{}).textContent, waiting:el.classList.contains('panel-waiting') }));
});
check('adding a debt reopens the payoff panels', reopened.every(x=>!x.waiting),
      reopened.map(x=>x.h+(x.waiting?' [still waiting]':'')).join(' | '));

/* ---- 7. every id in the live dom is unique ----
        A panel ended up with two id attributes while this was being built. The
        browser keeps the first, so getElementById for the second returned null
        and the code that had been hiding that panel silently stopped working. */
const dup = await p.evaluate(() => {
  const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);
  return [...new Set(ids.filter((v,i)=>ids.indexOf(v)!==i))];
});
check('no id appears twice in the live document', dup.length===0, dup.join(', '));

/* ---- 8. every view is reachable from the tab bar ---- */
const nav = await p.evaluate(views => {
  const tabs=[...document.querySelectorAll('.tab[data-view]')].map(t=>t.dataset.view);
  return { missing:views.filter(v=>!tabs.includes(v)), orphanTabs:tabs.filter(v=>!document.getElementById('view-'+v)) };
}, VIEWS);
check('every view has a tab', nav.missing.length===0, nav.missing.join(','));
check('...and every tab has a view', nav.orphanTabs.length===0, nav.orphanTabs.join(','));

/* ---- 9. every area introduces itself, once ----
        The premise is that a first-time budgeter and a ten-year veteran can both
        move without hesitating. The audit found the second half fine and the
        first half missing: every screen said what to DO ("No debts yet. Add what
        you owe") and no screen said what it IS or why it exists. ---- */
await seed(EMPTY); await p.reload(); await p.waitForTimeout(900);
const guides = await p.evaluate(async views => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const out={};
  for(const v of views){ activateTab(v); await wait(120);
    const el=document.querySelector('#view-'+v+' .areaguide');
    out[v]= el ? { title:(el.querySelector('.ag-t')||{}).textContent||'',
                   why:((el.querySelector('.ag-w')||{}).textContent||'').length,
                   first:((el.querySelector('.ag-first')||{}).textContent||''),
                   atTop:el===document.querySelector('#view-'+v).firstElementChild } : null;
  }
  return out;
}, VIEWS);
const missingG=VIEWS.filter(v=>!guides[v]);
check(`every area introduces itself (${VIEWS.length-missingG.length} of ${VIEWS.length})`, missingG.length===0, missingG.join(','));
check('...each naming itself, not another screen', VIEWS.every(v=>!guides[v]||guides[v].title.length>10),
      VIEWS.map(v=>guides[v]&&guides[v].title.slice(0,24)).join(' | '));
check('...each saying WHY the screen exists', VIEWS.every(v=>!guides[v]||guides[v].why>60));
check('...each naming one thing to do first', VIEWS.every(v=>!guides[v]||/Start with:/.test(guides[v].first)));
check('...and sitting at the top where it is read first', VIEWS.every(v=>!guides[v]||guides[v].atTop));
const gTitles=VIEWS.map(v=>guides[v]&&guides[v].title);
check('...with no two areas sharing a description', new Set(gTitles).size===gTitles.length);

/* ---- 10. dismissal is per area, sticks, and is reversible ---- */
const dismiss = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('budget'); await wait(120);
  document.querySelector('#view-budget [data-agok]').click(); await wait(120);
  const planGone=!document.querySelector('#view-budget .areaguide');
  activateTab('tx'); await wait(120);
  const trackStill=!!document.querySelector('#view-tx .areaguide');
  document.querySelector('#view-tx [data-agoff]').click(); await wait(120);
  activateTab('goals'); await wait(120);
  const allOff=!document.querySelector('#view-goals .areaguide');
  openAppMap(); await wait(120);
  document.getElementById('mapReplay').click(); await wait(150);
  activateTab('goals'); await wait(120);
  return { planGone, trackStill, allOff, back:!!document.querySelector('#view-goals .areaguide') };
});
check('dismissing one area does not dismiss the others', dismiss.planGone && dismiss.trackStill,
      `plan gone ${dismiss.planGone}, track still shown ${dismiss.trackStill}`);
check('"I know my way around" turns them all off at once', dismiss.allOff===true);
check('...and the map brings every one of them back', dismiss.back===true);

await p.evaluate(async()=>{ activateTab('budget'); await new Promise(r=>setTimeout(r,120));
  const btn=document.querySelector('#view-budget [data-agok]'); if(btn) btn.click(); });
await p.waitForTimeout(200); await p.reload(); await p.waitForTimeout(900);
check('a dismissed guide stays dismissed across a reload',
      await p.evaluate(async()=>{ activateTab('budget'); await new Promise(r=>setTimeout(r,150));
        return !document.querySelector('#view-budget .areaguide'); }));

/* ---- 11. the map answers "where am I, and what have I not touched" ---- */
const map = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  openAppMap(); await wait(150);
  const rows=[...document.querySelectorAll('.map-row')].map(r=>({v:r.dataset.mapgo, used:r.classList.contains('used')}));
  const prog=(document.querySelector('.map-prog')||{}).innerText||'';
  document.querySelector('.map-row').click(); await wait(220);
  return { rows, prog, closed:!document.getElementById('appMap').classList.contains('on'),
           went:document.querySelector('.view.on').id };
});
check(`the map lists every area (${map.rows.length})`, map.rows.length===9, map.rows.map(r=>r.v).join(','));
check('...says how many you have actually used', /of \d+ areas used/.test(map.prog), map.prog.replace(/\n/g,' '));
check('...marks an untouched app as untouched', map.rows.every(r=>!r.used), map.rows.filter(r=>r.used).map(r=>r.v).join(','));
check('...and a row takes you there, closing behind it', map.closed && map.went==='view-budget', map.went);

await seed(FULL); await p.reload(); await p.waitForTimeout(900);
const litUp = await p.evaluate(async () => {
  await new Promise(r=>setTimeout(r,120)); openAppMap();
  await new Promise(r=>setTimeout(r,180));
  return [...document.querySelectorAll('.map-row')].filter(r=>r.classList.contains('used')).map(r=>r.dataset.mapgo);
});
check('areas you have used are marked done, so it reads as progress', litUp.length>=4, litUp.join(','));

/* ---- 12. the plan is in YOUR order, and everything follows it ----
        Category order was array order, which is creation order, which is an
        accident. People read a budget in a shape that means something to them -
        the rent at the top because it frightens them, the fun money at the top
        because it is what they overspend. ---- */
const ORDERED={...EMPTY, uiMode:'all', stageReached:3, guidesOff:true,
  categories:[{id:'fun',name:'Fun'},{id:'food',name:'Food'},
              {id:'groc',name:'Groceries',parentId:'food'},{id:'eat',name:'Eating out',parentId:'food'},
              {id:'roof',name:'Roof'},{id:'car',name:'Getting Around'}],
  budgets:{'2026-08':{fun:300,groc:400,eat:220,roof:1250,car:340}},
  transactions:[{id:'i',type:'income',amount:3200,date:'2026-08-01'}]};
await seed(ORDERED); await p.reload(); await p.waitForTimeout(900);
const reorder = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('budget'); await wait(200);
  const before=topCats().map(c=>c.name);
  const noArrows=document.querySelectorAll('#cats .cat-move').length;
  document.getElementById('reorderBtn').click(); await wait(200);
  const arrows=document.querySelectorAll('#cats .cat-move').length;
  const assignFrozen=(()=>{ const e=document.querySelector('.cat.reordering .cat-assign');
    return e ? getComputedStyle(e).display==='none' : false; })();
  /* the names must stay READABLE - the arrows took width and squeezed a
     subcategory down to "E..." until the editing controls collapsed instead */
  const subNames=[...document.querySelectorAll('.subrow.reordering .sub-name')]
    .map(e=>({full:e.textContent.trim(), w:e.getBoundingClientRect().width,
              clipped:e.scrollWidth>e.clientWidth+1}));
  // Roof is third: two moves up puts it first
  document.querySelector('[data-moveup="roof"]').click(); await wait(120);
  document.querySelector('[data-moveup="roof"]').click(); await wait(120);
  const after=topCats().map(c=>c.name);
  // a sub moves inside its parent and cannot escape it
  document.querySelector('[data-movedn="groc"]').click(); await wait(120);
  const subs=childrenOf('food').map(c=>c.name);
  const stillTop=topCats().map(c=>c.name);
  // the ends are dead ends
  const firstUp=document.querySelector('#cats .cat .cm-b[data-moveup]').disabled;
  const downs=[...document.querySelectorAll('#cats .cat .cm-b[data-movedn]')];
  const lastDown=downs[downs.length-1].disabled;
  document.getElementById('reorderBtn').click(); await wait(150);
  return { before, after, subs, stillTop, noArrows, arrows, assignFrozen, subNames, firstUp, lastDown,
           gone:document.querySelectorAll('#cats .cat-move').length };
});
check('reorder is a mode, off by default', reorder.noArrows===0 && reorder.arrows>0, `${reorder.noArrows} -> ${reorder.arrows}`);
check('...and the editing controls step aside while you move things', reorder.assignFrozen===true);
check('...leaving the names readable, not truncated to one letter',
      reorder.subNames.length>0 && reorder.subNames.every(n=>!n.clipped && n.full.length>3),
      reorder.subNames.map(n=>`"${n.full}" ${Math.round(n.w)}px${n.clipped?' CLIPPED':''}`).join(' | '));
check('moving a category up actually moves it',
      reorder.after[0]==='Roof' && reorder.before[0]==='Fun', `${reorder.before.join(',')} -> ${reorder.after.join(',')}`);
check('a subcategory reorders inside its parent', reorder.subs[0]==='Eating out', reorder.subs.join(','));
check('...and cannot escape it into the top level', reorder.stillTop.length===4 && !reorder.stillTop.includes('Groceries'), reorder.stillTop.join(','));
check('the first row cannot go up', reorder.firstUp===true);
check('the last row cannot go down', reorder.lastDown===true);
check('"Done" puts the arrows away', reorder.gone===0);

/* the order has to survive a reload, or it was never really theirs */
await p.reload(); await p.waitForTimeout(900);
const persisted = await p.evaluate(()=>({tops:topCats().map(c=>c.name), subs:childrenOf('food').map(c=>c.name)}));
check('the order survives a reload', persisted.tops[0]==='Roof' && persisted.subs[0]==='Eating out',
      persisted.tops.join(',')+' / '+persisted.subs.join(','));

/* and every OTHER list of categories must agree - a picker still in creation
   order means the app disagrees with the user about their own arrangement */
const agrees = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await wait(200);
  const picker=[...document.querySelectorAll('#txCat option')].map(o=>o.textContent.trim()).filter(Boolean);
  const plan=topCats().map(c=>c.name);
  return { picker, plan, firstPicker:picker[0], firstPlan:plan[0] };
});
check('the transaction picker follows the plan order', agrees.firstPicker===agrees.firstPlan,
      `picker starts "${agrees.firstPicker}", plan starts "${agrees.firstPlan}"`);

/* an existing budget must not get shuffled by the feature arriving */
await seed({...ORDERED, categories:ORDERED.categories.map(c=>{const {sort,...rest}=c; return rest;})});
await p.reload(); await p.waitForTimeout(900);
check('a budget from before this feature keeps the order it had',
      (await p.evaluate(()=>topCats().map(c=>c.name).join(',')))==='Fun,Food,Roof,Getting Around');

/* ---- 13. repeats are set where you plan, not in a second form ----
        Setting up a recurring bill meant leaving the category you were looking
        at, scrolling to a separate section, and retyping its name, its amount
        and its category - three facts already on screen. ---- */
const REPEAT={...EMPTY, uiMode:'all', stageReached:3, guidesOff:true,
  categories:[{id:'roof',name:'Roof'},{id:'pow',name:'Power & Wi-Fi'},
              {id:'elec',name:'Electric',parentId:'pow'},{id:'net',name:'Internet',parentId:'pow'},
              {id:'fun',name:'Fun'}],
  budgets:{'2026-08':{roof:1250,elec:120,net:80,fun:0}},
  transactions:[{id:'i',type:'income',amount:3200,date:'2026-08-01'}]};
await seed(REPEAT); await p.reload(); await p.waitForTimeout(900);
const rep = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('budget'); await wait(250);
  const boxes=document.querySelectorAll('#cats [data-repeat]').length;
  const onGroup=!!document.querySelector('#cats [data-repeat="pow"]');
  const click=id=>{ const c=document.querySelector('[data-repeat="'+id+'"]'); c.checked=!c.checked; c.dispatchEvent(new Event('change',{bubbles:true})); };
  click('roof'); await wait(200);
  const afterTick=(state.recurring||[]).map(r=>({cat:r.catId, amt:r.amount, freq:r.freq}));
  const freqOpts=[...document.querySelectorAll('[data-repfreq="roof"] option')].map(o=>o.value);
  const sel=document.querySelector('[data-repfreq="roof"]'); sel.value='quarterly';
  sel.dispatchEvent(new Event('change',{bubbles:true})); await wait(200);
  const afterFreq=(state.recurring||[]).map(r=>r.freq);
  click('elec'); await wait(200);
  const withSub=(state.recurring||[]).length;
  // a zero-amount category cannot repeat nothing
  click('fun'); await wait(250);
  const zeroRefused=(state.recurring||[]).every(r=>r.catId!=='fun');
  const zeroUnticked=!document.querySelector('[data-repeat="fun"]').checked;
  click('elec'); await wait(200);
  const afterUntick=(state.recurring||[]).length;
  // names stay readable with the control on the row
  const names=[...document.querySelectorAll('.subrow .sub-name')].map(e=>({n:e.textContent.trim(), clipped:e.scrollWidth>e.clientWidth+1}));
  return { boxes, onGroup, afterTick, freqOpts, afterFreq, withSub, zeroRefused, zeroUnticked, afterUntick, names };
});
check('every leaf category carries a repeat toggle', rep.boxes===4, String(rep.boxes));
check('...but a group does not - its subs carry the bills', rep.onGroup===false);
check('ticking it creates the recurring item from the row',
      rep.afterTick.length===1 && rep.afterTick[0].cat==='roof' && rep.afterTick[0].amt===1250 && rep.afterTick[0].freq==='monthly',
      JSON.stringify(rep.afterTick));
check('...offering weekly, biweekly, monthly and quarterly',
      JSON.stringify(rep.freqOpts)===JSON.stringify(['weekly','biweekly','monthly','quarterly']), rep.freqOpts.join(','));
check('...and the frequency sticks', rep.afterFreq[0]==='quarterly', rep.afterFreq.join(','));
check('a subcategory can repeat on its own', rep.withSub===2, String(rep.withSub));
check('a category with no amount cannot repeat nothing', rep.zeroRefused && rep.zeroUnticked,
      `refused ${rep.zeroRefused}, unticked ${rep.zeroUnticked}`);
check('unticking removes it', rep.afterUntick===1, String(rep.afterUntick));
check('...and the name is still readable beside the control',
      rep.names.length>0 && rep.names.every(n=>!n.clipped && n.n.length>3),
      rep.names.map(n=>`"${n.n}"${n.clipped?' CLIPPED':''}`).join(' | '));

/* it has to survive a reload and agree with the Recurring panel */
await p.reload(); await p.waitForTimeout(900);
const persistRep = await p.evaluate(async () => {
  await new Promise(r=>setTimeout(r,150)); activateTab('budget');
  await new Promise(r=>setTimeout(r,250));
  return { n:(state.recurring||[]).length, freq:(state.recurring[0]||{}).freq,
           ticked:document.querySelector('[data-repeat="roof"]').checked,
           panel:(document.getElementById('recList')||{}).innerText||'' };
});
check('a row-set repeat survives a reload', persistRep.n===1 && persistRep.freq==='quarterly' && persistRep.ticked,
      JSON.stringify({n:persistRep.n, freq:persistRep.freq, ticked:persistRep.ticked}));
check('...and shows up in the Recurring panel as one item', /quarterly/.test(persistRep.panel), persistRep.panel.replace(/\n/g,' ').slice(0,90));

/* ---- 14. the Recurring form stops asking for what it already knows ---- */
const autofill = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const cat=document.getElementById('recCat'), amt=document.getElementById('recAmt');
  amt.value=''; cat.value='net'; cat.dispatchEvent(new Event('change',{bubbles:true})); await wait(120);
  const filled=amt.value;
  amt.value='999'; cat.value='elec'; cat.dispatchEvent(new Event('change',{bubbles:true})); await wait(120);
  return { filled, kept:amt.value };
});
check('picking a category fills the amount from what it is assigned', autofill.filled==='80', autofill.filled);
check('...but never overwrites a figure someone typed', autofill.kept==='999', autofill.kept);

console.log('STRUCTURE - one place to reflect, and nothing shown before it means something\n');
let fails=0;
for(const r of results){ if(!r.ok) fails++; console.log(`${r.ok?'ok  ':'FAIL'}  ${r.name}${r.detail?'\n        '+String(r.detail).replace(/\n/g,' ').slice(0,140):''}`); }
console.log(`\n${results.length-fails} of ${results.length} hold`);
console.log('page errors:', errs.length?errs:'none');
await b.close();
if(fails) process.exit(1);
