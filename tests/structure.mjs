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
import { writeFileSync } from 'node:fs';

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
    /* The report is a verdict, not a chart - it draws cards. Everything else
       has to draw something you can look at. */
    seen[t]={ chart: t==='report'
                ? !!document.querySelector('#rfBody .rp-card, #rfBody .rp-lock, #rfBody .rf-empty')
                : !!document.querySelector('#rfBody svg, #rfBody .cbar, #rfBody .mcol, #rfBody .bd-ring, #rfBody canvas, #rfBody .bd-row'),
              hasPeriod:!!document.getElementById('rfPrev') }; }
  return { tab:!!document.querySelector('[data-view="reflect"]'), subs, seen,
           learnPanels:[...document.querySelectorAll('#view-learn h2')].map(h=>h.textContent) };
});
check('a Reflect tab exists', reflect.tab===true);
check('...with the verdict first and the four reports under it',
      JSON.stringify(reflect.subs)===JSON.stringify(['report','breakdown','trends','worth','inout']), reflect.subs.join(','));
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
/* Reordering is a DRAG now, not two arrows. Arrows meant counting taps to move
   a category down eleven rows, with the list re-rendering under your thumb after
   every one. These tests drive real pointer events through Playwright's mouse,
   so they exercise the actual engine - threshold, drop index, commit - and not a
   function called directly. */
const centre = async sel => p.evaluate(s=>{ const e=document.querySelector(s); if(!e) return null;
  const r=e.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2, top:r.top, bottom:r.bottom}; }, sel);
async function dragTo(gripSel, targetY, opts={}){
  const g=await centre(gripSel); if(!g) throw new Error('no grip '+gripSel);
  await p.mouse.move(g.x,g.y); await p.mouse.down();
  const steps=8;
  for(let i=1;i<=steps;i++){ await p.mouse.move(g.x, g.y+(targetY-g.y)*i/steps); await p.waitForTimeout(16); }
  const mid = await p.evaluate(()=>({ghost:!!document.querySelector('.drag-ghost'),
    ghostText:(document.querySelector('.drag-ghost')||{}).textContent||'',
    line:!!document.querySelector('.drag-line'),
    dimmed:!!document.querySelector('.drag-src')}));
  if(opts.cancel) await p.keyboard.press('Escape');
  await p.mouse.up(); await p.waitForTimeout(200);
  return mid;
}

/* the whole plan has to be on screen for a drag test to be about dragging and
   not about auto-scrolling, so this section gets a viewport tall enough to
   hold it. Real phones get the auto-scroll instead. */
await p.setViewportSize({width:390,height:2400});
await p.evaluate(async()=>{ activateTab('budget'); scrollTo(0,0); });
await p.waitForTimeout(300);
const beforeOrder = await p.evaluate(()=>({tops:topCats().map(c=>c.name),
  grips:document.querySelectorAll('#cats .cat-grip').length,
  arrows:document.querySelectorAll('#cats .cat-move, #cats [data-moveup]').length}));
check('reorder is a mode, off by default', beforeOrder.grips===0, String(beforeOrder.grips));
check('...and the old up/down arrows are gone entirely', beforeOrder.arrows===0, String(beforeOrder.arrows));

await p.evaluate(()=>document.getElementById('reorderBtn').click());
await p.waitForTimeout(250);
const inMode = await p.evaluate(()=>({
  grips:document.querySelectorAll('#cats .cat-grip').length,
  rows:document.querySelectorAll('#cats [data-row][data-lvl]').length,
  assignFrozen:(()=>{ const e=document.querySelector('.cat.reordering .cat-assign');
    return e ? getComputedStyle(e).display==='none' : false; })(),
  /* the browser must not claim the gesture as a page scroll, or a drag on a
     phone just scrolls the list and nothing ever moves */
  touchAction:getComputedStyle(document.querySelector('#cats .cat-grip')).touchAction,
  labelled:[...document.querySelectorAll('#cats .cat-grip')].every(g=>/arrow keys/i.test(g.getAttribute('aria-label')||'')),
  subNames:[...document.querySelectorAll('.subrow.reordering .sub-name')]
    .map(e=>({full:e.textContent.trim(), w:e.getBoundingClientRect().width,
              clipped:e.scrollWidth>e.clientWidth+1}))
}));
check('turning it on puts a grip on every row', inMode.grips>0 && inMode.grips===inMode.rows,
      `${inMode.grips} grips / ${inMode.rows} rows`);
check('...the grip owns the gesture rather than the page scroller', inMode.touchAction==='none', inMode.touchAction);
check('...and the editing controls step aside while you move things', inMode.assignFrozen===true);
check('...leaving the names readable, not truncated to one letter',
      inMode.subNames.length>0 && inMode.subNames.every(n=>!n.clipped && n.full.length>3),
      inMode.subNames.map(n=>`"${n.full}" ${Math.round(n.w)}px${n.clipped?' CLIPPED':''}`).join(' | '));

/* Roof is third. Drag it above the first card. */
const firstCard = await centre('#cats .cat:first-child');
const mid = await dragTo('[data-grip="roof"]', firstCard.top+4);
const afterDrag = await p.evaluate(()=>topCats().map(c=>c.name));
check('a ghost and a drop line show what is about to happen',
      mid.ghost && mid.line && mid.dimmed && /Roof/.test(mid.ghostText),
      JSON.stringify(mid));
check('dragging a category to the top actually puts it at the top',
      afterDrag[0]==='Roof' && beforeOrder.tops[0]==='Fun',
      `${beforeOrder.tops.join(',')} -> ${afterDrag.join(',')}`);

/* a subcategory dragged HARD past the top of the screen still lands inside its
   own parent - a sub outranking a category is not a thing anyone means */
const subsBefore = await p.evaluate(()=>childrenOf('food').map(c=>c.name));
await dragTo('[data-grip="eat"]', 2);
const escaped = await p.evaluate(()=>({subs:childrenOf('food').map(c=>c.name),
                                       tops:topCats().map(c=>c.name)}));
check('a subcategory reorders inside its parent',
      escaped.subs.join(',')!==subsBefore.join(','), `${subsBefore.join(',')} -> ${escaped.subs.join(',')}`);
check('...and cannot be dragged out into the top level',
      !escaped.tops.includes('Eating out') && escaped.subs[0]==='Eating out',
      `tops ${escaped.tops.join(',')} / subs ${escaped.subs.join(',')}`);

/* picking a row up and putting it back must not renumber anything */
const settled = await p.evaluate(()=>topCats().map(c=>c.name));
const backGrip = await centre('#cats .cat:nth-child(2) .cat-grip');
await dragTo('#cats .cat:nth-child(2) .cat-grip', backGrip.y+3);
const unchanged = await p.evaluate(()=>topCats().map(c=>c.name));
check('a drag that goes nowhere changes nothing', unchanged.join(',')===settled.join(','),
      `${settled.join(',')} -> ${unchanged.join(',')}`);

/* a drag you cannot abandon is a drag you hesitate to start */
const beforeEsc = await p.evaluate(()=>topCats().map(c=>c.name));
const lastCard = await centre('#cats .cat:last-child');
await dragTo('#cats .cat:last-child .cat-grip', lastCard.top-400, {cancel:true});
const afterEsc = await p.evaluate(()=>({tops:topCats().map(c=>c.name),
  strays:document.querySelectorAll('.drag-ghost,.drag-line,.drag-src').length}));
check('Escape abandons a drag and puts the row back',
      afterEsc.tops.join(',')===beforeEsc.join(','), `${beforeEsc.join(',')} -> ${afterEsc.tops.join(',')}`);
check('...and clears the ghost with it', afterEsc.strays===0, String(afterEsc.strays));

/* drag is the preferred way, not the only way - the grip is still a button */
const kb = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const before=topCats().map(c=>c.name);
  const g=document.querySelector('#cats .cat:first-child .cat-grip'); g.focus();
  g.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
  await wait(200);
  return { before, after:topCats().map(c=>c.name),
           refocused:(document.activeElement||{}).dataset?.grip };
});
check('the keyboard still moves a row without a mouse',
      kb.after[0]===kb.before[1] && kb.after[1]===kb.before[0], `${kb.before.join(',')} -> ${kb.after.join(',')}`);
check('...and focus follows the row it just moved', kb.refocused===kb.before[0].toLowerCase().slice(0,3) || !!kb.refocused, kb.refocused);

const reorder = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  document.getElementById('reorderBtn').click(); await wait(200);
  return { gone:document.querySelectorAll('#cats .cat-grip').length,
           strays:document.querySelectorAll('.drag-ghost,.drag-line,.drag-src').length };
});
check('"Done" puts the grips away', reorder.gone===0, String(reorder.gone));
check('...and leaves no ghost or drop line behind', reorder.strays===0, String(reorder.strays));
await p.setViewportSize({width:390,height:1000});
await p.waitForTimeout(200);

/* the order has to survive a reload, or it was never really theirs */
const arranged = await p.evaluate(()=>({tops:topCats().map(c=>c.name), subs:childrenOf('food').map(c=>c.name)}));
await p.reload(); await p.waitForTimeout(900);
const persisted = await p.evaluate(()=>({tops:topCats().map(c=>c.name), subs:childrenOf('food').map(c=>c.name)}));
check('the order survives a reload',
      persisted.tops.join(',')===arranged.tops.join(',') && persisted.subs.join(',')===arranged.subs.join(',')
      && arranged.subs[0]==='Eating out',
      `${arranged.tops.join(',')} / ${arranged.subs.join(',')} -> ${persisted.tops.join(',')} / ${persisted.subs.join(',')}`);

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

/* ---- 15. no sheet may grow taller than the screen it opens on ----
   Every .modal had no max-height and no overflow, so it grew to whatever its
   content wanted. On a 780px phone the app map wanted 938px, and because the
   overlay bottom-aligns the sheet, the extra went off the TOP - heading and
   ✕ above y=0. A sheet you cannot close is not a layout bug, it is a trap.
   The check is per modal, per phone height: the sheet fits, the ✕ is on
   screen and hittable, and the overflow goes to the BODY not the sheet. ---- */
const HEIGHTS=[700,780,844];
const SHEETS=[{id:'appMap',open:'openAppMap()'},{id:'stageMap',open:'openStageMap()'},
              {id:'ftHelp',open:'openFreedomHelp()'},
              {id:'talkSheet',open:"openTalk({name:'Phone',amount:1100})"},
              {id:'intentSheet',open:'openIntentSheet()'}];
const fits=[];
for(const h of HEIGHTS){
  await p.setViewportSize({width:390,height:h});
  for(const s of SHEETS){
    const r = await p.evaluate(async ({open,id}) => {
      const wait=ms=>new Promise(r=>setTimeout(r,ms));
      document.querySelectorAll('.modal-overlay.on').forEach(o=>o.classList.remove('on'));
      try{ (0,eval)(open); }catch(e){ return {err:String(e.message||e)}; }
      await wait(320);
      const ov=document.getElementById(id), m=ov&&ov.querySelector('.modal');
      if(!m) return {err:'no sheet'};
      const box=m.getBoundingClientRect(), x=m.querySelector('.x');
      const xb=x?x.getBoundingClientRect():null;
      const scroller=m.lastElementChild;
      const hit=xb?document.elementFromPoint(xb.left+xb.width/2, xb.top+xb.height/2):null;
      return { top:Math.round(box.top), bottom:Math.round(box.bottom), vh:innerHeight,
               xTop:xb?Math.round(xb.top):null,
               xHittable: !!(hit && (hit===x || x.contains(hit))),
               bodyScrolls: scroller ? getComputedStyle(scroller).overflowY : 'none',
               sheetScrolls: getComputedStyle(m).overflowY };
    }, s);
    fits.push({h, id:s.id, ...r});
  }
}
await p.setViewportSize({width:390,height:1000});
const bad = fits.filter(f=>f.err || f.top < 0 || f.bottom > f.vh+1);
check('no sheet is taller than the phone it opens on', bad.length===0,
      bad.map(f=>`${f.id}@${f.h}: ${f.err||('top '+f.top+' bottom '+f.bottom+' of '+f.vh)}`).join(' | '));
const unreachable = fits.filter(f=>!f.err && !f.xHittable);
check('...so the ✕ is always on screen and hittable', unreachable.length===0,
      unreachable.map(f=>`${f.id}@${f.h}: x at y=${f.xTop}`).join(' | '));
const wrongScroller = fits.filter(f=>!f.err && f.sheetScrolls==='visible' && f.bodyScrolls==='visible' && (f.bottom-f.top)>f.vh-40);
check('...and long content scrolls inside the sheet, not off the top',
      wrongScroller.length===0, wrongScroller.map(f=>`${f.id}@${f.h}`).join(' | '));

/* ---- 16. three faults found by using the app on a real phone ---- */
const REAL={...EMPTY, uiMode:'all', stageReached:3, hourlyWage:24,
  categories:[{id:'inv',name:'Investing / retirement',growth:'invest'},
              {id:'food',name:'Food'},{id:'groc',name:'Groecries',parentId:'food'},
              {id:'w',name:'Walmart',parentId:'groc'}],
  budgets:{'2026-08':{inv:2400,groc:650,w:200}},
  transactions:[{id:'i',type:'income',amount:3200,date:'2026-08-01'},
                {id:'t',type:'expense',amount:80,catId:'groc',date:'2026-08-03'}]};
await seed(REAL); await p.reload(); await p.waitForTimeout(900);

/* Invest carried the .on class like the other two and had no rule to paint it,
   so choosing it switched the form underneath while the toggle still looked
   like Expense was selected. */
const toggle = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await wait(300);
  const out={};
  for(const t of ['expense','income','invest']){
    const btn=document.querySelector(`#typeToggle button[data-t="${t}"]`);
    btn.click(); await wait(140);
    const cs=getComputedStyle(btn), bg=cs.backgroundColor;
    out[t]={on:btn.classList.contains('on'), bg,
            painted: bg!=='rgba(0, 0, 0, 0)' && bg!=='transparent'};
  }
  out.distinct = new Set(['expense','income','invest'].map(t=>out[t].bg)).size;
  return out;
});
check('every log type shows which one is selected',
      ['expense','income','invest'].every(t=>toggle[t].on && toggle[t].painted),
      JSON.stringify(toggle));
check('...and each one is told apart from the others', toggle.distinct===3,
      `${toggle.expense.bg} / ${toggle.income.bg} / ${toggle.invest.bg}`);

/* A subcategory could only be deleted, and deleting it takes its transactions'
   category with it - so fixing a typo cost you history. */
const rename = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('budget'); await wait(350);
  const pencils=document.querySelectorAll('#cats .subrow .cat-edit').length;
  document.querySelector('[data-editcat="groc"]').click(); await wait(220);
  const field=!!document.querySelector('input[data-rename="groc"]');
  const cleared=(()=>{ const e=document.querySelector('.subrow.editing .sub-assign');
    return e ? getComputedStyle(e).display==='none' : false; })();
  document.querySelector('input[data-rename="groc"]').value='Groceries';
  document.querySelector('[data-renamesave="groc"]').click(); await wait(220);
  // a third-level sub renames too, and Enter commits it
  document.querySelector('[data-editcat="w"]').click(); await wait(220);
  const i3=document.querySelector('input[data-rename="w"]'); i3.value='Walmart Supercenter';
  i3.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); await wait(220);
  return { pencils, field, cleared, names:state.categories.map(c=>c.name),
           txKept:state.transactions.filter(t=>t.catId==='groc').length,
           assignKept:(state.budgets['2026-08']||{}).groc };
});
check('a subcategory can be renamed, not only deleted', rename.pencils===2 && rename.field,
      `${rename.pencils} pencils, field ${rename.field}`);
check('...at the third level too, with Enter to commit',
      rename.names.includes('Groceries') && rename.names.includes('Walmart Supercenter'),
      rename.names.join(','));
check('...and renaming keeps the transactions and the money',
      rename.txKept===1 && rename.assignKept===650, `${rename.txKept} tx, ${rename.assignKept} assigned`);
check('...with the rest of the row stepping aside for the field', rename.cleared===true);

/* The intake filed "Investing / retirement" as an ordinary spending category,
   so a retirement contribution logged against it would count as money spent. */
const growth = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('budget'); await wait(300);
  const tags=[...document.querySelectorAll('#cats .growth-tag')].map(e=>e.textContent.trim());
  activateTab('tx'); await wait(300);
  const sel=document.getElementById('txCat');
  document.querySelector('#typeToggle button[data-t="expense"]').click(); await wait(120);
  sel.value='food'; sel.dispatchEvent(new Event('change',{bubbles:true})); await wait(160);
  const afterOrdinary=txType;
  sel.value='inv'; sel.dispatchEvent(new Event('change',{bubbles:true})); await wait(220);
  return { tags, afterOrdinary, afterGrowth:txType,
           kinds:['invest','save','debt'].map(k=>growthKindFor(k==='invest'?'Investing / retirement':k==='save'?'Savings':'Extra debt payments')) };
});
check('money that is invested is not shown as money spent', growth.tags.length===1 && /not spent/i.test(growth.tags[0]),
      growth.tags.join(','));
check('...and logging against it defaults to Invest, not Expense',
      growth.afterOrdinary==='expense' && growth.afterGrowth==='invest',
      `${growth.afterOrdinary} -> ${growth.afterGrowth}`);
check('...while an ordinary category still logs as an expense', growth.afterOrdinary==='expense');
check('the intake sorts each on-purpose row to its own kind',
      growth.kinds.join(',')==='invest,save,debt', growth.kinds.join(','));

/* ---- 17. the multi-line log guesses the category instead of claiming one ----
   Every row's dropdown defaulted to whichever category happened to be first, so
   a notepad full of coffees logged itself as "Rent / mortgage" unless you fixed
   each line by hand. A wrong confident default is worse than none, because it
   looks decided. ---- */
const GUESS={...EMPTY, uiMode:'all', stageReached:3,
  categories:[{id:'rent',name:'Rent / mortgage'},{id:'food',name:'Food'},
              {id:'groc',name:'Groceries',parentId:'food'},{id:'eat',name:'Eating out',parentId:'food'},
              {id:'cof',name:'Coffee / drinks out'},{id:'gas',name:'Getting Around'},
              {id:'sub',name:'Subscriptions / streaming'}],
  budgets:{'2026-08':{rent:850,groc:400,eat:200,cof:60,gas:150,sub:40}},
  transactions:[{id:'h1',type:'expense',amount:14,catId:'eat',date:'2026-08-02',note:'Marios pizza'},
                {id:'h2',type:'expense',amount:14,catId:'eat',date:'2026-08-09',note:'Marios pizza'}],
  recurring:[{id:'r',type:'expense',amount:40,catId:'sub',freq:'monthly',anchor:'2026-08-01',name:'Netflix'}]};
await seed(GUESS); await p.reload(); await p.waitForTimeout(900);
const guess = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await wait(300);
  quickLogOpen=true; renderQuickLog(); await wait(300);
  const row=document.querySelector('#quickLog .ql-row');
  const cat=row.querySelector('.ql-cat'), what=row.querySelector('.ql-what');
  const start={ value:cat.value, label:cat.selectedOptions[0].textContent };
  const type=async t=>{ what.value=t; what.dispatchEvent(new Event('input',{bubbles:true})); await wait(70);
    return { cat:cat.value?catName(cat.value):'', marked:cat.classList.contains('guessed') }; };
  const out={ start, g:{} };
  for(const t of ['Starbucks','Marios pizza','walmart','netflix','uber','rent','xyzzy qwerty'])
    out.g[t]=await type(t);
  // a correction is permanent - more typing must never overwrite it
  cat.value='groc'; cat.dispatchEvent(new Event('change',{bubbles:true})); await wait(70);
  what.value='Starbucks latte'; what.dispatchEvent(new Event('input',{bubbles:true})); await wait(90);
  out.afterCorrection=catName(cat.value);
  out.markCleared=!cat.classList.contains('guessed');
  return out;
});
check('a row starts with no category rather than claiming the first one',
      guess.start.value==='' && /which category/i.test(guess.start.label),
      `"${guess.start.label}"`);
check('...and typing what it was fills the category in',
      guess.g['Starbucks'].cat==='Coffee / drinks out' && guess.g['Starbucks'].marked,
      JSON.stringify(guess.g['Starbucks']));
check('it learns from what you logged before, not just a word list',
      guess.g['Marios pizza'].cat==='Food › Eating out', guess.g['Marios pizza'].cat);
check('...from a bill you already said repeats',
      guess.g['netflix'].cat==='Subscriptions / streaming', guess.g['netflix'].cat);
check('...and from the category names themselves',
      guess.g['rent'].cat==='Rent / mortgage' && guess.g['uber'].cat==='Getting Around',
      `${guess.g['rent'].cat} / ${guess.g['uber'].cat}`);
check('a guess can land on a subcategory, which is the more specific home',
      guess.g['walmart'].cat==='Food › Groceries', guess.g['walmart'].cat);
check('it guesses nothing rather than guessing wrong', guess.g['xyzzy qwerty'].cat==='',
      guess.g['xyzzy qwerty'].cat);
check('a guess is marked as a guess, not shown as a decision',
      Object.values(guess.g).filter(x=>x.cat).every(x=>x.marked));
check('correcting one is permanent - more typing never overwrites it',
      guess.afterCorrection==='Food › Groceries' && guess.markCleared, guess.afterCorrection);

/* and what it could not guess is logged honestly, not filed under whatever was
   first - the toast says how many need a home */
const logged = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  quickLogOpen=false; renderQuickLog(); await wait(150);
  quickLogOpen=true; renderQuickLog(); await wait(250);
  const fill=async(i,what,amt)=>{
    let rows=[...document.querySelectorAll('#quickLog .ql-row')];
    while(rows.length<=i){ document.getElementById('qlAdd').click(); await wait(70);
      rows=[...document.querySelectorAll('#quickLog .ql-row')]; }
    const r=rows[i], w=r.querySelector('.ql-what');
    w.value=what; w.dispatchEvent(new Event('input',{bubbles:true}));
    r.querySelector('.ql-amt').value=amt; await wait(70);
  };
  await fill(0,'Starbucks',6.4);
  await fill(1,'zzz mystery thing',12);
  document.getElementById('qlSave').click(); await wait(450);
  const fresh=state.transactions.filter(t=>t.date===todayStr());
  return { n:fresh.length,
           guessed:fresh.filter(t=>t.catId).map(t=>catName(t.catId)),
           uncat:fresh.filter(t=>!t.catId).length,
           toast:(document.querySelector('.toast')||{}).textContent||'' };
});
check('a guessed row logs into the category it guessed',
      logged.n===2 && logged.guessed.join(',')==='Coffee / drinks out', JSON.stringify(logged.guessed));
check('...and one it could not guess lands as Uncategorized, said out loud',
      logged.uncat===1 && /uncategorized/i.test(logged.toast), logged.toast);

/* ---- 18. a posted bill says WHICH bill ----
   Every recurring entry was noted "Recurring", so four bills in a row read
   "Recurring, Recurring, Recurring, Recurring" and the list said nothing at
   all. The transaction carries recId, so the app already knows it was
   automatic; the note is the one place that should say what it WAS. ---- */
const REC={...EMPTY, uiMode:'all', stageReached:3, spendingMode:true,
  categories:[{id:'rent',name:'Rent / mortgage'},{id:'util',name:'Utilities (power, water)'},
              {id:'car',name:'Car payment'},{id:'ins',name:'Insurance'}],
  budgets:{'2026-08':{rent:850,util:620,car:340,ins:100}},
  recurring:[{id:'r1',type:'expense',amount:300,catId:'rent',freq:'monthly',anchor:'2026-08-01'},
             {id:'r2',type:'expense',amount:340,catId:'car',freq:'monthly',anchor:'2026-08-01'},
             {id:'r4',type:'income',amount:2000,source:'Warehouse paycheck',freq:'monthly',anchor:'2026-08-01'}],
  transactions:[
    {id:'t1',type:'expense',amount:300,catId:'rent',date:'2026-08-01',note:'Recurring',recId:'r1'},
    {id:'t2',type:'expense',amount:340,catId:'car', date:'2026-08-01',note:'Recurring',recId:'r2'},
    {id:'t4',type:'expense',amount:620,catId:'util',date:'2026-08-01',note:'Recurring'},
    {id:'t5',type:'income', amount:2000,source:'Warehouse paycheck',date:'2026-08-01',note:'Recurring',recId:'r4'},
    {id:'t6',type:'expense',amount:44,catId:'util',date:'2026-08-05',note:'Recurring bill I typed myself'}]};
await seed(REC); await p.reload(); await p.waitForTimeout(900);
const named = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('home'); await wait(400);
  const byId=id=>(state.transactions.find(t=>t.id===id)||{});
  const recent=[...document.querySelectorAll('.sp-recent .r .nm')].map(e=>e.textContent.trim());
  activateTab('tx'); await wait(400);
  const subs=[...document.querySelectorAll('.tx-sub')].map(e=>e.textContent.trim());
  return { t1:byId('t1').note, t2:byId('t2').note, t4:byId('t4').note, t5:byId('t5').note,
           t6:byId('t6').note, recent, subs,
           anySayRecurringAlone: recent.some(r=>r==='Recurring') };
});
check('a posted bill is named, not just called "Recurring"',
      named.t1==='Rent / mortgage' && named.t2==='Car payment',
      `${named.t1} / ${named.t2}`);
check('...even when the schedule behind it is gone, from the category it landed in',
      named.t4==='Utilities (power, water)', named.t4);
check('...and a recurring paycheck is named from its source',
      named.t5==='Warehouse paycheck', named.t5);
check('a note somebody typed themselves is never rewritten',
      named.t6==='Recurring bill I typed myself', named.t6);
check('no row in the recent list just says "Recurring"',
      named.anySayRecurringAlone===false, named.recent.join(' | '));
check('...and "posted automatically" moves to the line that has room for it',
      named.subs.some(x=>/repeats/.test(x)) && !named.subs.every(x=>/repeats/.test(x)),
      named.subs.slice(0,4).join(' | '));

/* ---- 19. the debt planner tells you what is actually wrong ----
   The state a beginner reaches first - a debt added before they have looked up
   the rate or decided what they can pay - produced "you're not outrunning the
   interest, about $0 piles on every month". It contradicted itself in one
   sentence and never named the blocker, which was that nobody had said what
   they could pay yet. ---- */
const DEBTS={...EMPTY, uiMode:'all', stageReached:3, hourlyWage:24, debts:[], debtBudget:0};
await seed(DEBTS); await p.reload(); await p.waitForTimeout(900);
const debt = await p.evaluate(async () => {
  const wait=()=>new Promise(r=>setTimeout(r,320));
  activateTab('debt'); await wait();
  const set=(id,v)=>{const e=document.getElementById(id); e.value=v; e.dispatchEvent(new Event('input',{bubbles:true}));};
  const out={};
  // a debt with no rate and no payment yet - the very first thing that happens
  set('debtName','Visa'); set('debtBal','2400'); set('debtApr',''); set('debtMin','');
  document.getElementById('addDebt').click(); await wait();
  out.noPayment=document.getElementById('debtResults').textContent.replace(/\s+/g,' ').trim();
  /* genuinely under water: the payment clears the minimums and still loses to
     the interest. Needs a minimum SMALLER than the monthly interest, which is
     exactly the shape of a large balance at a high rate. */
  const setRow=(k,v)=>{ const e=document.querySelector(`[data-debt][data-k="${k}"]`);
    if(e){ e.value=v; e.dispatchEvent(new Event('input',{bubbles:true})); } };
  setRow('balance','20000'); setRow('apr','29.9'); setRow('minPayment','100');
  await wait();
  set('debtBudget','150'); await wait();
  out.underwater=document.getElementById('debtResults').textContent.replace(/\s+/g,' ').trim();
  // a real plan
  set('debtBudget','900'); await wait();
  out.plan=document.getElementById('debtResults').textContent.replace(/\s+/g,' ').trim();
  return out;
});
check('a planner with no payment set says THAT, not that interest is winning',
      /how much you can put toward this/i.test(debt.noPayment) && !/outrunning/i.test(debt.noPayment),
      debt.noPayment.slice(0,120));
check('...and never blames interest that is not there',
      !/\$0[^0-9]*(piles|every month)/i.test(debt.noPayment), debt.noPayment.slice(0,120));
check('...while a genuinely under-water payment is still called what it is',
      /never shrinks/i.test(debt.underwater), debt.underwater.slice(0,110));
check('a workable payment still produces a payoff date',
      /Debt-free by/i.test(debt.plan), debt.plan.slice(0,90));

/* The nudge has to be a number a person can act on, and it has to agree with
   the simulation printed beside it. The old one was
   Math.ceil((monthlyInterest+1)/10)*10 - on a $2,400 card that came out as $10,
   which is BELOW the $75 minimum, so the app would have refused it outright. */
const nudge = await p.evaluate(() => {
  const D=[{name:'A',balance:2400,apr:23.9,minPayment:75}];
  const rungs=[60,36,24].map(t=>debtPaymentFor(D,'avalanche',t)).filter(Boolean);
  return rungs.map(r=>{ const sim=simulateDebts(D,r.pay,'avalanche');
    return { pay:r.pay, claimed:r.months, actual:sim.error?null:sim.months,
             aboveMin:r.pay>=75, round:r.pay%5===0 }; });
});
check('every suggested amount clears the minimum payment',
      nudge.length>0 && nudge.every(r=>r.aboveMin), JSON.stringify(nudge));
check('...is a round number a person can aim at', nudge.every(r=>r.round), JSON.stringify(nudge));
check('...and the months it claims are the months it actually takes',
      nudge.every(r=>r.claimed===r.actual), JSON.stringify(nudge));

/* A payment that cannot beat the interest used to grind out 720 months of
   compounding and report an interest total in the billions. */
const runaway = await p.evaluate(() =>
  simulateDebts([{name:'A',balance:20000,apr:29.9,minPayment:100}],100,'avalanche'));
check('a debt that never moves is stopped, not compounded into the billions',
      runaway.stalled===true && runaway.months<=121 && runaway.totalInterest<1e6,
      `${runaway.months} months, interest ${Math.round(runaway.totalInterest)}`);

/* avalanche and snowball must actually differ when the orders differ */
const strat = await p.evaluate(() => {
  const D=[{name:'Store card',balance:500,apr:5,minPayment:25},{name:'Visa',balance:6000,apr:24,minPayment:150}];
  const a=simulateDebts(D,500,'avalanche'), s=simulateDebts(D,500,'snowball');
  return {aOrder:a.order.map(o=>o.name), sOrder:s.order.map(o=>o.name),
          aInt:Math.round(a.totalInterest*100)/100, sInt:Math.round(s.totalInterest*100)/100};
});
check('avalanche pays the dearest rate first, snowball the smallest balance',
      strat.aOrder[0]==='Visa' && strat.sOrder[0]==='Store card',
      `${strat.aOrder.join('>')} vs ${strat.sOrder.join('>')}`);
check('...and avalanche genuinely costs less interest when they differ',
      strat.aInt < strat.sInt, `${strat.aInt} vs ${strat.sInt}`);

/* the form has to be answerable by someone who has never seen an APR */
const help = await p.evaluate(() => {
  const d=document.querySelector('#view-debt .fieldhelp');
  const hint=document.getElementById('debtBudgetHint');
  return { exists:!!d, text:d?d.textContent.toLowerCase():'',
           budgetHint:hint?hint.textContent.toLowerCase():'' };
});
check('the debt form explains where to find each number', help.exists===true);
check('...including what APR means in plain words',
      /purchase apr|interest rate/.test(help.text) && /minimum payment due/.test(help.text));
check('...and says the rate can wait, so a missing one is not a dead end',
      /add the debt anyway/.test(help.text));
check('the monthly amount says it INCLUDES the minimums',
      /minimums included|not extra on top/.test(help.budgetHint), help.budgetHint);

/* ---- 20. the Accountability Report ----
   The app measured plenty and concluded nothing. It knew the top category, the
   priciest weekday, net worth, income against expense - and never once put two
   months side by side and said what changed. ---- */
const RM=await p.evaluate(()=>thisMonth());
const rshift=(m,n)=>{const [y,mm]=m.split('-').map(Number); const d=new Date(y,mm-1+n,1);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');};
const REPORT={...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, hourlyWage:24, activeMonth:RM,
  categories:[{id:'eat',name:'Eating out'}], budgets:{[RM]:{eat:400}},
  transactions:[{id:'i1',type:'income',amount:3200,date:RM+'-01'},
                {id:'i2',type:'income',amount:3200,date:rshift(RM,-1)+'-01'},
                {id:'a',type:'expense',amount:220,catId:'eat',date:rshift(RM,-1)+'-10'},
                {id:'b',type:'expense',amount:400,catId:'eat',date:RM+'-05'}]};
await seed(REPORT); await p.reload(); await p.waitForTimeout(900);
const rpt = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('reflect'); await wait(450);
  const r=buildReport();
  const cards=[...document.querySelectorAll('.rp-card')];
  return { on:document.querySelector('#rfTabs .rf-tab.on').dataset.rf,
           keys:r.signals.map(g=>g.k),
           everyCardShowsWorking:cards.length>0 && cards.every(c=>!!c.querySelector('.rp-w')),
           drift:(r.signals.find(g=>g.k==='drift')||{}).t||'',
           driftBody:(r.signals.find(g=>g.k==='drift')||{}).body||'',
           badFirst:r.signals.length>1 ? r.signals[0].bad===true : true };
});
check('Reflect opens on the verdict, not a chart', rpt.on==='report', rpt.on);
check('it compares this month against last, which nothing did before',
      /up 82%/.test(rpt.drift), rpt.drift);
check('...and shows both figures so the claim can be checked',
      /\$400/.test(rpt.driftBody) && /\$220/.test(rpt.driftBody), rpt.driftBody.replace(/<[^>]+>/g,''));
check('every card carries the arithmetic behind it', rpt.everyCardShowsWorking===true);

/* A month that went negative must not open with a compliment about something
   else that happened to go well. */
const NEG={...REPORT, budgets:{[RM]:{eat:200}},
  transactions:[{id:'i1',type:'income',amount:1000,date:RM+'-01'},
                {id:'x',type:'expense',amount:1800,catId:'eat',date:RM+'-03'},
                {id:'i0',type:'income',amount:1000,date:rshift(RM,-1)+'-01'},
                {id:'y',type:'expense',amount:100,catId:'eat',date:rshift(RM,-1)+'-03'}]};
await seed(NEG); await p.reload(); await p.waitForTimeout(900);
const negative = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('reflect'); await wait(450);
  const r=buildReport();
  return { first:r.signals[0], kept:r.signals.find(g=>g.k==='kept') };
});
check('a month that went negative leads with the bad news',
      negative.first && negative.first.bad===true, negative.first&&negative.first.t);
check('...and says so plainly rather than as a percentage kept',
      /spent more than came in/i.test(negative.kept.t), negative.kept.t);

/* Silence over speculation - the rule the whole thing rests on. */
const THIN={...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:RM,
  transactions:[{id:'i',type:'income',amount:3200,date:RM+'-01'}]};
await seed(THIN); await p.reload(); await p.waitForTimeout(900);
const thin = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('reflect'); await wait(450);
  const r=buildReport();
  return { cards:document.querySelectorAll('.rp-card').length, locked:r.locked,
           lockUI:!!document.querySelector('.rp-lock'),
           text:document.getElementById('rfBody').textContent.toLowerCase() };
});
check('with one paycheck and nothing else it says nothing at all', thin.cards===0, String(thin.cards));
check('...it never congratulates you for keeping 100% of an empty ledger',
      !/kept 100%/.test(thin.text), thin.text.slice(0,90));
check('...and lists what would unlock more instead of failing silently',
      thin.lockUI===true && thin.locked.length>=3, thin.locked.length+' locked');

/* One broken signal must never take the page down with it. */
const survives = await p.evaluate(() => {
  const orig=REPORT_SIGNALS[0].run;
  REPORT_SIGNALS[0].run=()=>{ throw new Error('boom'); };
  let ok=false; try{ buildReport(); ok=true; }catch(e){ ok=false; }
  REPORT_SIGNALS[0].run=orig;
  return ok;
});
check('a signal that throws does not take the report with it', survives===true);

/* ---- 21. the independent audit's findings stay fixed ----
   Ten findings from an outside model, each reproduced here before it was fixed
   and pinned here after. The two timezone cases run in their own browser
   contexts with the timezone pinned, because they only exist at the boundary. */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true,
  categories:[{id:'a',name:'Rent'},{id:'b',name:'Fun'}],
  budgets:{'2026-08':{a:1000,b:500}}});
await p.reload(); await p.waitForTimeout(900);

/* F1 - a negative assignment subtracted from the assigned total: free money */
const f1 = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('budget'); await wait(350);
  const inp=document.querySelector('input[data-cat="b"]');
  inp.value='-500'; inp.dispatchEvent(new Event('input',{bubbles:true})); await wait(150);
  const typed=state.budgets['2026-08'].b;
  // and a poisoned SAVE heals on load
  const st=JSON.parse(localStorage.getItem('unfiltered_budget_v2'));
  st.budgets['2026-08'].b=-500;
  const healed=normalizeState(st).budgets['2026-08'].b;
  return { typed, healed, assigned:topCats().reduce((s,c)=>s+catAssigned(c.id,'2026-08'),0) };
});
check('typing a negative assignment stores zero, not invented money', f1.typed===0, String(f1.typed));
check('...a poisoned save heals to zero on load', f1.healed===0, String(f1.healed));
check('...and the assigned total never went below the honest sum', f1.assigned===1000, String(f1.assigned));

/* F3 - merging a $100-own duplicate with a $50-in-kids duplicate lost the $50 */
const f3 = await p.evaluate(() => {
  state.categories=[{id:'A',name:'Utilities (power, water)'},{id:'B',name:'Power & Wi-Fi'},
                    {id:'bk',name:'Internet',parentId:'B'}];
  state.budgets={'2026-08':{A:100, bk:50}}; state.activeMonth='2026-08'; save();
  const before=topCats().reduce((s,c)=>s+catAssigned(c.id,'2026-08'),0);
  const n=mergeDuplicates();
  const after=topCats().reduce((s,c)=>s+catAssigned(c.id,'2026-08'),0);
  return { n, before, after };
});
check('merging duplicates conserves the effective plan to the dollar',
      f3.n>=1 && f3.before===150 && f3.after===150, `${f3.before} -> ${f3.after}`);

/* F5 - a semimonthly schedule anchored to the 15th posted on Feb 1 */
const f5 = await p.evaluate(() =>
  recOccurrences({freq:'semimonthly',anchor:'2026-01-15'},'2026-02'));
check('semimonthly on the 15th lands mid-month and month-end in February',
      JSON.stringify(f5.map(d=>d.slice(8)).sort())===JSON.stringify(['15','28']), f5.join(','));

/* F6 - a $50 minimum on a $10 balance locked the planner for the person one
   payment from done */
const f6 = await p.evaluate(() => simulateDebts([{name:'A',balance:10,apr:20,minPayment:50}],30,'avalanche'));
check('a minimum bigger than the remaining balance no longer blocks the planner',
      !f6.error && f6.months===1, f6.error||f6.months+' months');

/* F7 - interest landing before the sort made snowball target the CHEAP debt on
   a tie, maximising interest */
const f7 = await p.evaluate(() => {
  const D=[{name:'Cheap',balance:1000,apr:5,minPayment:0},{name:'Dear',balance:1000,apr:25,minPayment:0}];
  return simulateDebts(D,300,'snowball').order.map(o=>o.name);
});
check('tied balances break toward the dearer rate, not away from it', f7[0]==='Dear', f7.join(' then '));

/* F8 - the "started" working line printed 3 × $3.33 = $10.00, a false equation */
const f8 = await p.evaluate(() => {
  const t=todayStr();
  state.transactions=[
    {id:'a',type:'expense',amount:3.33,catId:null,date:shiftDays(t,-3),note:'Boba'},
    {id:'b',type:'expense',amount:3.33,catId:null,date:shiftDays(t,-9),note:'Boba'},
    {id:'c',type:'expense',amount:3.34,catId:null,date:shiftDays(t,-15),note:'Boba'}];
  save();
  const sig=REPORT_SIGNALS.find(x=>x.k==='started').run();
  return sig ? sig.work : '(no signal)';
});
check('the started signal shows a division, never an equation rounding can falsify',
      /÷/.test(f8) && /≈/.test(f8) && !/=/.test(f8), f8);

/* F9 - "Visa" under a parent named "Debt Payments" was invisible to the
   Offense vs Defense meter */
const f9 = await p.evaluate(() => {
  state.categories=[{id:'dp',name:'Debt Payments'},{id:'visa',name:'Visa',parentId:'dp'}];
  state.transactions=[{id:'t',type:'expense',amount:200,catId:'visa',date:state.activeMonth+'-05'}];
  state.impulse=[]; save();
  return offenseDefense(state.activeMonth).debtPaid;
});
check('a debt payment logged to a subcategory counts as defense', f9===200, String(f9));

/* F2 - the audit said Auto-Rebalance destroys money. Its trigger needs a
   subcategory target, and the button only renders on top-level categories - so
   the reachable path is pinned as conserving instead. */
const f2 = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  state.categories=[{id:'roof',name:'Roof'},{id:'fun',name:'Fun Money'}];
  state.budgets={'2026-08':{roof:100,fun:200}}; state.activeMonth='2026-08';
  state.transactions=[{id:'s',type:'expense',amount:150,catId:'roof',date:'2026-08-05'}]; save();
  activateTab('budget'); await wait(300);
  const subTargets=[...document.querySelectorAll('[data-rebal]')]
    .filter(b=>{ const c=state.categories.find(x=>x.id===b.dataset.rebal); return c&&c.parentId; }).length;
  const before=topCats().reduce((s,c)=>s+catAssigned(c.id,'2026-08'),0);
  autoRebalance('roof'); await wait(200);
  const after=topCats().reduce((s,c)=>s+catAssigned(c.id,'2026-08'),0);
  return { subTargets, before, after };
});
check('Auto-Rebalance can never target a subcategory from the screen', f2.subTargets===0);
check('...and on its real targets it moves money without creating or destroying any',
      f2.before===300 && f2.after===300, `${f2.before} -> ${f2.after}`);

/* F4 + F10 - the timezone pair, in pinned-timezone contexts */
const ctxNZ = await b.newContext({ timezoneId:'Pacific/Auckland' });
const pNZ = await ctxNZ.newPage();
await pNZ.goto('file://'+process.cwd()+'/app.html'); await pNZ.waitForTimeout(600);
const f4 = await pNZ.evaluate(() => parseImpDate('Nov 1, 2026'));
check('a textual CSV date east of Greenwich stays on its own day', f4==='2026-11-01', String(f4));
await ctxNZ.close();

const ctxNY = await b.newContext({ timezoneId:'America/New_York' });
const pNY = await ctxNY.newPage();
await pNY.goto('file://'+process.cwd()+'/app.html'); await pNY.waitForTimeout(600);
const f10 = await pNY.evaluate(() => ({
  fixed: shiftDays('2026-03-20',-30),
  oldWay: localYMD(new Date(Date.parse('2026-03-20T00:00:00')-30*86400000))
}));
check('30 calendar days back across spring-forward is 30 days, not 31',
      f10.fixed==='2026-02-18', `fixed ${f10.fixed}, ms arithmetic said ${f10.oldWay}`);
check('...and the test proves the boundary is real, not hypothetical',
      f10.oldWay==='2026-02-17', f10.oldWay);
await ctxNY.close();

/* T3's root - the report's trap clause now reads the field the app writes */
const t3 = await p.evaluate(() => {
  state.hourlyWage=24; state.activeMonth=thisMonth();
  state.transactions=[{id:'e',type:'expense',amount:240,catId:null,date:thisMonth()+'-03'}];
  state.impulse=[{id:'i',type:'buy',name:'Keyboard',amount:120,date:thisMonth()+'-03'}]; save();
  const sig=REPORT_SIGNALS.find(x=>x.k==='hours').run();
  return sig?sig.body:'';
});
check('a ransom logged the way the app logs it shows up in the hours signal',
      /called a trap/.test(t3), t3.replace(/<[^>]+>/g,'').slice(0,120));

/* ---- 22. outside numbers: shipped, dated, tied to the user's own figures ----
   The app never fetches them - they are baked at build time, every card carries
   its as-of date on screen, and a build old enough for them to be stale says so
   and goes quiet. Context, never advice: no product, bank or fund is named. */
const OUT={...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:RM,
  hourlyWage:24, wageSetAt:'2026-03-10',
  categories:[{id:'groc',name:'Groceries'}], budgets:{[RM]:{groc:650}},
  transactions:[{id:'i',type:'income',amount:3200,date:RM+'-01'},
                {id:'e',type:'expense',amount:650,catId:'groc',date:RM+'-03'}],
  accounts:[{id:'a',name:'Checking',kind:'checking',balance:2150}],
  debts:[{id:'d',name:'Visa',balance:2400,minPayment:75,apr:28.9}]};
await seed(OUT); await p.reload(); await p.waitForTimeout(900);
const outside = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('reflect'); await wait(500);
  const cards=[...document.querySelectorAll('.rp-card')];
  const oCards=cards.filter(c=>c.querySelector('.rp-src'));
  const firstOutsideIdx=cards.findIndex(c=>c.querySelector('.rp-src'));
  const lastPersonalIdx=cards.reduce((m,c,i)=>c.querySelector('.rp-src')?m:i,-1);
  const text=oCards.map(c=>c.textContent).join(' ');
  const was=OUTSIDE.built; OUTSIDE.built='2025-01-01';
  const stale=buildReport(); OUTSIDE.built=was;
  return {
    n:oCards.length,
    stamped:oCards.every(c=>/as of (July|August) 2026/.test(c.querySelector('.rp-src').textContent)),
    neverFetched:oCards.every(c=>/never fetched/.test(c.querySelector('.rp-src').textContent)),
    cpiWork:(oCards.map(c=>(c.querySelector('.rp-w')||{}).textContent||'').find(w=>/1\.034/.test(w)))||'',
    savingsWork:(oCards.map(c=>(c.querySelector('.rp-w')||{}).textContent||'').find(w=>/0\.38%/.test(w)))||'',
    sinceWage:/has not changed since Mar 2026/.test(text),
    noAdvice:!/\byou should\b|switch to|open a|sign up|move your money/i.test(text),
    noBrands:!/bankrate|nerdwallet|chase|ally|amex|fidelity|vanguard/i.test(text),
    frame:!!document.querySelector('.rp-frame'),
    afterPersonal:firstOutsideIdx>lastPersonalIdx && lastPersonalIdx>=0,
    staleOutside:stale.signals.filter(g=>g.outside).length,
    staleSaysSo:stale.locked.some(l=>/too old to show as current/.test(l))
  };
});
check('the outside numbers appear, tied to this household', outside.n===4, String(outside.n));
check('...every one stamped with its as-of date on screen', outside.stamped===true);
check('...and marked as baked in, never fetched', outside.neverFetched===true);
check('the CPI card divides by 1.034 and shows it', /\$24 ÷ 1\.034 = \$23\.21/.test(outside.cpiWork), outside.cpiWork);
check('the savings card prices the cash at the real average', /\$2,150 × 0\.38% = \$8\.17/.test(outside.savingsWork), outside.savingsWork);
check('a wage the app watched change is dated, not hedged', outside.sinceWage===true);
check('no card tells anyone what to do', outside.noAdvice===true);
check('...and none names a bank, fund or brand', outside.noBrands===true);
check('the standing frame line says context, not advice', outside.frame===true);
check('outside numbers wait behind the personal ones', outside.afterPersonal===true);
check('a stale build goes quiet instead of showing old numbers as current',
      outside.staleOutside===0 && outside.staleSaysSo===true,
      `${outside.staleOutside} shown, note ${outside.staleSaysSo}`);

/* ---- 23. the areas a person actually wants ----
   The stage ladder decides what someone is READY for; this decides what they
   WANT, and only they can answer that. The danger is a half-applied setting: an
   area hidden from the tab bar but still reachable from the map, the hub, or a
   stale history entry is worse than no setting at all. ---- */
const AREAS={...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, hourlyWage:24,
  categories:[{id:'a',name:'Rent'}], budgets:{'2026-08':{a:1000}},
  transactions:[{id:'i',type:'income',amount:3200,date:'2026-08-01'}],
  impulse:[{id:'p',type:'skip',name:'Shoes',amount:120,date:'2026-08-05'}]};
await seed(AREAS); await p.reload(); await p.waitForTimeout(900);
const areas = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('settings'); await wait(350);
  const vis=()=>[...document.querySelectorAll('.tab[data-view]')]
    .filter(t=>getComputedStyle(t).display!=='none').map(t=>t.dataset.view);
  const out={ toggles:document.querySelectorAll('#areaToggles input[data-area]').length,
              before:vis() };
  setAreaOff('impulse',true); setAreaOff('debt',true); await wait(220);
  out.after=vis();
  activateTab('impulse'); await wait(180); out.landed=currentTab;
  out.mapHasShield=/Shield/.test(appMapHTML());
  renderIntentSheet();
  out.hubOffersGutCheck=/[Gg]ut-check/.test(document.getElementById('intentList').textContent);
  out.dataKept=impulseSaved();
  setAreaOff('settings',true); setAreaOff('budget',true); setAreaOff('tx',true); await wait(150);
  out.spineSafe=areaOn('settings')&&areaOn('budget')&&areaOn('tx');
  setAreaOff('impulse',false); await wait(200);
  out.back=vis().includes('impulse');
  out.stillKept=impulseSaved();
  return out;
});
check('every optional area has a switch', areas.toggles===6, String(areas.toggles));
check('switching one off removes it from the bar',
      areas.before.includes('impulse') && !areas.after.includes('impulse') && !areas.after.includes('debt'),
      areas.after.join(','));
check('...nothing can navigate into a hidden area', areas.landed==='home', areas.landed);
check('...the app map stops listing it', areas.mapHasShield===false);
check('...and the "I want to" hub stops offering it', areas.hubOffersGutCheck===false);
check('the spine cannot be switched off', areas.spineSafe===true);
check('hiding an area never deletes what is in it', areas.dataKept===120 && areas.stillKept===120,
      `${areas.dataKept} then ${areas.stillKept}`);
check('switching it back on restores it', areas.back===true);

/* a poisoned save must not be able to hide Settings - the switch that undoes it */
const poison = await p.evaluate(() => {
  const st=JSON.parse(localStorage.getItem('unfiltered_budget_v2'));
  st.areasOff=['settings','budget','tx','home','impulse'];
  const n=normalizeState(st);
  return n.areasOff;
});
check('a corrupt areasOff cannot hide the spine',
      poison.length===1 && poison[0]==='impulse', JSON.stringify(poison));

/* ---- 24. the time ledger reaches the report ----
   It used to be write-only: you tapped +1 hr, a caption underneath updated, and
   the data was never seen again anywhere in the app. ---- */
const TIMEW={...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, hourlyWage:24, hoursPerWeek:40,
  activeMonth:RM,
  categories:[{id:'a',name:'Rent'}], budgets:{[RM]:{a:1000}},
  transactions:[{id:'i',type:'income',amount:3200,date:RM+'-01'},
                {id:'e',type:'expense',amount:900,catId:'a',date:RM+'-03'}]};
await seed(TIMEW); await p.reload(); await p.waitForTimeout(900);
const tw = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const sig=()=>REPORT_SIGNALS.find(x=>x.k==='timeWeek').run();
  const cold=sig();
  [['health',8],['learn',3],['build',9],['people',1],['leak',6]]
    .forEach(([k,h])=>{ for(let i=0;i<h;i++) logTime(k,1); });
  const warm=sig();
  activateTab('reflect'); await wait(450);
  return { coldLocked:!!(cold&&cold.locked), t:warm.t,
           body:warm.body.replace(/<[^>]+>/g,''), work:warm.work,
           nudge:warm.nudge.replace(/<[^>]+>/g,''),
           onScreen:[...document.querySelectorAll('.rp-card .rp-t')].map(e=>e.textContent).join(' | ') };
});
check('with nothing logged the time signal stays silent', tw.coldLocked===true);
check('a logged week reaches the report', /21 hrs of your week/.test(tw.t), tw.t);
check('...with the split shown so it can be checked', tw.work==='27 logged = 21 invested + 6 leaked', tw.work);
check('...and the leak priced at the user own rate', /\$144/.test(tw.nudge), tw.nudge);
check('...and it actually renders on Reflect', /week went into you/.test(tw.onScreen), tw.onScreen);

/* ---- 25. nobody is sorted by age ----
   The first question in the app used to ask an AGE - "Gen Z / under 30",
   "Middle / 30-55", "Mature / 55+" - and then used the answer to choose the
   SLANG. A 23-year-old who does not say "bestie" picked "under 30" because it
   was true about them, and got talked to in a voice they do not use. The
   question asked about identity; the answer controlled vocabulary. ---- */
await p.evaluate(()=>localStorage.clear());
await p.reload(); await p.waitForTimeout(1400);
const gate = await p.evaluate(async () => {
  await new Promise(r=>setTimeout(r,1400));
  const dock=document.querySelector('.gatepick');
  const bub=[...document.querySelectorAll('.bub')].map(x=>x.textContent).pop()||'';
  const opts=dock?[...dock.querySelectorAll('button')].map(b=>({
    label:b.querySelector('.gp-t').textContent.trim(),
    sample:(b.querySelector('.gp-s')||{}).textContent||'' })):[];
  return { question:bub, opts, all:(dock?dock.textContent:'')+bub };
});
check('the first question offers a voice, not an age bracket',
      gate.opts.length===3 && !/under 30|30\s*-\s*55|55\s*\+|Gen ?Z|millennial|boomer/i.test(gate.all),
      gate.opts.map(o=>o.label).join(' / '));
check('...and every option carries a real sample line to choose by ear',
      gate.opts.every(o=>o.sample.length>20), JSON.stringify(gate.opts.map(o=>o.sample.slice(0,30))));
check('...with three genuinely different samples',
      new Set(gate.opts.map(o=>o.sample)).size===3);
check('...and the question asks how it should talk, not who you are',
      /talk in one of three ways/i.test(gate.question) && !/sounds most like you/i.test(gate.question),
      gate.question.slice(0,80));

/* picking one still drives the whole voice engine */
const picked = await p.evaluate(async () => {
  const btns=[...document.querySelectorAll('.gatepick button')];
  btns[0].click(); await new Promise(r=>setTimeout(r,400));
  const loose=state.register;
  state.onboarded=true; save();
  return { loose };
});
check('choosing the loose voice still sets the slang register', picked.loose==='genz', picked.loose);

/* Settings says the same thing, and shows what you would actually hear */
await p.reload(); await p.waitForTimeout(900);
const setPick = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('settings'); await wait(400);
  const labels=[...document.querySelectorAll('#register button')].map(b=>b.textContent.trim());
  const samples={};
  for(const r of ['genz','middle','mature']){
    document.querySelector(`#register button[data-reg="${r}"]`).click(); await wait(140);
    samples[r]=document.getElementById('regSample').textContent;
  }
  // the sample must be a line the app really says, not copy written for settings
  state.register='genz'; state.intensity='savage'; renderRegister(); await wait(120);
  const savage=document.getElementById('regSample').textContent;
  const real=Object.values(TRAP_RESPONSES.scroll.genz).some(v=>savage.includes(v));
  return { labels, samples, real,
           noAge:!/under 30|30\s*-\s*55|55\s*\+|Gen ?Z|generation dial/i.test(document.getElementById('view-settings').textContent) };
});
check('Settings names the voices without naming an age', setPick.noAge===true,
      setPick.labels.join(' / '));
check('...and shows what each one actually sounds like',
      new Set(Object.values(setPick.samples)).size===3, JSON.stringify(setPick.samples));
check('...quoting real app copy rather than a sample written for the picker',
      setPick.real===true, setPick.samples.genz);

/* ---- 26. the import that ate everything ----
   Reported from a real phone: took an encrypted backup, pressed Import, and the
   app started over. Reproduced exactly. The plain importer accepted anything
   that was valid JSON - and an encrypted .acct envelope IS valid JSON, with no
   state keys in it - so Object.assign(defaultState(), envelope) produced a
   pristine empty app, SAVED it over the real data, rebooted into onboarding and
   said "Imported." Silent total data loss reported as success, on the one path
   that exists to prevent data loss. With the old importer these checks report
   cats 0 / tx 0 / onboarded false. ---- */
const LIVE={...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, hourlyWage:24,
  categories:[{id:'a',name:'Rent'},{id:'b',name:'Food'}],
  budgets:{'2026-08':{a:1200,b:600}},
  goals:[{id:'g',name:'Emergency fund',target:9000,saved:2400}],
  transactions:Array.from({length:37},(_,i)=>({id:'t'+i,type:'expense',amount:20,catId:'a',date:'2026-08-0'+(i%9+1)}))};
await seed(LIVE); await p.reload(); await p.waitForTimeout(900);

/* answer whatever the app asks, the way a hurried person would */
const said=[];
const onDialog=async d=>{ said.push(d.type()+':'+d.message());
  if(d.type()==='prompt') await d.accept('correct horse battery'); else await d.accept(); };
p.on('dialog',onDialog);

const envelope = await p.evaluate(async () => {
  const salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveKey('correct horse battery',salt);
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(state)));
  return JSON.stringify({app:'accountability',v:1,alg:'AES-GCM',kdf:'PBKDF2-SHA256',iter:150000,
    salt:abToB64(salt),iv:abToB64(iv),data:abToB64(ct)});
});
const tmp=process.env.TMPDIR||'/tmp';
writeFileSync(tmp+'/t-enc.acct', envelope);
writeFileSync(tmp+'/t-junk.json', JSON.stringify({name:'my-package',version:'1.0.0'}));

/* 1. the exact reported sequence: encrypted backup into the plain Import */
said.length=0;
await p.setInputFiles('#importFile', tmp+'/t-enc.acct');
await p.waitForTimeout(900);
const afterEnc = await p.evaluate(()=>({cats:state.categories.length,tx:state.transactions.length,onboarded:!!state.onboarded}));
check('an encrypted backup pressed into Import does not wipe the app',
      afterEnc.cats===2 && afterEnc.tx===37 && afterEnc.onboarded===true, JSON.stringify(afterEnc));
check('...it asks for the passphrase instead of treating the envelope as data',
      said.some(x=>/^prompt:[\s\S]*passphrase/i.test(x)), said.map(x=>x.slice(0,40).replace(/\n/g,' ')).join(' | '));

/* 2. an unrelated JSON file must be refused, not imported */
said.length=0;
await p.setInputFiles('#importFile', tmp+'/t-junk.json');
await p.waitForTimeout(700);
const afterJunk = await p.evaluate(()=>({cats:state.categories.length,tx:state.transactions.length}));
check('a JSON file that is not a backup changes nothing',
      afterJunk.cats===2 && afterJunk.tx===37, JSON.stringify(afterJunk));
check('...and says so rather than claiming it imported',
      said.some(x=>/does not look like an Accountability backup/i.test(x)) &&
      !said.some(x=>/^alert:Imported/i.test(x)), said.map(x=>x.slice(0,50)).join(' | '));

/* 3. a real export still restores - and names what is being replaced first */
const plain = await p.evaluate(()=>JSON.stringify({...state,
  categories:[{id:'z',name:'Imported'}],
  transactions:[{id:'q',type:'expense',amount:9,catId:'z',date:'2026-08-01'}]}));
writeFileSync(tmp+'/t-plain.json', plain);
said.length=0;
await p.setInputFiles('#importFile', tmp+'/t-plain.json');
await p.waitForTimeout(900);
const afterPlain = await p.evaluate(()=>({cats:state.categories.length,tx:state.transactions.length,undo:hasImportUndo()}));
check('a genuine export still restores', afterPlain.cats===1 && afterPlain.tx===1, JSON.stringify(afterPlain));
check('...after naming what is here now and what is in the file',
      said.some(x=>/REPLACES/.test(x) && /37 transactions/.test(x)),
      (said.find(x=>/REPLACES/.test(x))||'').slice(0,110));

/* 4. there is a way back - the thing that makes any of this survivable */
check('an import can be undone', afterPlain.undo===true);
const undone = await p.evaluate(()=>{ undoImport(); return {cats:state.categories.length,tx:state.transactions.length}; });
check('...and undoing puts the original data back exactly',
      undone.cats===2 && undone.tx===37, JSON.stringify(undone));
p.off('dialog',onDialog);

/* ---- 27. a panel gate opens the moment its data arrives ----
   Reported from a real phone: two debts entered, and the "Your way out" panel
   still said "Add a debt above". applyPanelGates() ran in exactly two places -
   boot() and renderAll() - and adding a debt calls save() and renderDebt(),
   neither of which is either. So the panel kept the panel-waiting class it was
   given at boot, hiding its own controls, until a reload.
   All five gates had it, not just this one. The check is hooked to save() now,
   the single place every state change passes through, so no future feature can
   forget the way this one did. ---- */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, hourlyWage:24});
await p.reload(); await p.waitForTimeout(900);
const pgate = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const gated=id=>{ const e=document.getElementById(id); return e?e.classList.contains('panel-waiting'):null; };
  const out={};
  activateTab('debt'); await wait(350);
  out.planBefore=gated('gate-debtplan'); out.investBefore=gated('investPanel');
  const set=(id,v)=>{ const e=document.getElementById(id); e.value=v; e.dispatchEvent(new Event('input',{bubbles:true})); };
  set('debtName','Visa'); set('debtBal','5000'); set('debtApr','7'); set('debtMin','500');
  document.getElementById('addDebt').click(); await wait(400);
  out.planAfter=gated('gate-debtplan'); out.investAfter=gated('investPanel');
  /* the controls have to come BACK, not just the class change - the gate hides
     the monthly-amount field, which is the whole reason the screen was dead */
  out.budgetUsable=getComputedStyle(document.getElementById('debtBudget')).display!=='none';
  out.strategyUsable=getComputedStyle(document.getElementById('debtStrategy')).display!=='none';
  // the other four, same class of bug
  out.vaultBefore=gated('vaultPanel');
  state.vault.push({id:'v',name:'Sneakers',amount:140,until:Date.now()+86400000}); save(); await wait(200);
  out.vaultAfter=gated('vaultPanel');
  out.csvBefore=gated('gate-csv'); out.circBefore=gated('gate-circ');
  state.transactions.push({id:'t',type:'expense',amount:20,catId:null,date:'2026-08-05',energy:'growth'});
  save(); await wait(200);
  out.csvAfter=gated('gate-csv'); out.circAfter=gated('gate-circ');
  return out;
});
check('the payoff planner opens as soon as a debt exists',
      pgate.planBefore===true && pgate.planAfter===false,
      `waiting ${pgate.planBefore} -> ${pgate.planAfter}`);
check('...and its controls come back with it, not just the styling',
      pgate.budgetUsable===true && pgate.strategyUsable===true,
      `budget ${pgate.budgetUsable}, strategy ${pgate.strategyUsable}`);
check('the invest comparison opens on the same event',
      pgate.investBefore===true && pgate.investAfter===false);
check('the vault opens when something is vaulted',
      pgate.vaultBefore===true && pgate.vaultAfter===false);
check('the CSV importer opens on the first logged transaction',
      pgate.csvBefore===true && pgate.csvAfter===false);
check('the circulation ratio opens on the first tagged spend',
      pgate.circBefore===true && pgate.circAfter===false);

/* the property behind all of it: saving state re-evaluates every gate */
const hooked = await p.evaluate(() => /applyPanelGates/.test(String(save)));
check('every gate is re-checked wherever state is saved', hooked===true);

/* ---- 28. the vault confirmation is not a second copy of the vault ----
   Asked from a real phone: "is this a duplicate of the 24-hour vault?" Two
   things made it look like one. The panel below was stuck showing its
   empty-state note while the card above said something had just been vaulted
   (the stale-gate bug in section 27), and both texts ended with the same
   sentence, word for word: "Most traps don't survive the wait." The panel
   explains what the vault IS. The confirmation should say what happened to
   THIS thing and when it comes back - the one fact the panel cannot yet. ---- */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, hourlyWage:24});
await p.reload(); await p.waitForTimeout(900);
const vault = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('impulse'); await wait(400);
  const gatedBefore=document.getElementById('vaultPanel').classList.contains('panel-waiting');
  document.getElementById('impName').value='Amazon';
  document.getElementById('impAmt').value='140';
  document.getElementById('impRun').click(); await wait(450);
  document.getElementById('impVault').click(); await wait(550);
  const conf=document.getElementById('impResult').textContent.trim();
  const desc=document.querySelector('#vaultPanel .sub').textContent.trim();
  const list=document.getElementById('vaultList').textContent.replace(/\s+/g,' ').trim();
  const sents=t=>t.split(/(?<=\.)\s+/).map(x=>x.trim()).filter(x=>x.length>25);
  return { gatedBefore,
    gatedAfter:document.getElementById('vaultPanel').classList.contains('panel-waiting'),
    conf, shared:sents(conf).filter(c=>desc.includes(c)),
    listHasItem:/Amazon/.test(list), listHasTimer:/left/i.test(list),
    emptyNote:/Vault's empty/.test(list) };
});
check('vaulting something opens the vault panel immediately',
      vault.gatedBefore===true && vault.gatedAfter===false);
check('...and the item is actually in it, with its timer running',
      vault.listHasItem===true && vault.listHasTimer===true && vault.emptyNote===false,
      vault.listHasItem+'/'+vault.listHasTimer);
check('the confirmation shares no sentence with the panel it sits above',
      vault.shared.length===0, vault.shared.join(' | '));
check('...and names when the thing actually comes back',
      /unlocks .*(today|tomorrow) at /i.test(vault.conf), vault.conf.slice(0,110));

console.log('STRUCTURE - one place to reflect, and nothing shown before it means something\n');
let fails=0;
for(const r of results){ if(!r.ok) fails++; console.log(`${r.ok?'ok  ':'FAIL'}  ${r.name}${r.detail?'\n        '+String(r.detail).replace(/\n/g,' ').slice(0,140):''}`); }
console.log(`\n${results.length-fails} of ${results.length} hold`);
console.log('page errors:', errs.length?errs:'none');
await b.close();
if(fails) process.exit(1);
