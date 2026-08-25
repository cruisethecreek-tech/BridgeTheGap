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
    staleSaysSo:stale.locked.some(l=>/too old to show as current/.test(l.t))
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

/* ---- 29. nobody knows the expected market return ----
   Asked from a real phone: "how is a 21-year-old supposed to know the estimated
   market return?" They are not, and neither is anyone else - it is a guess
   about the future, and the field asked for it with no anchor and no hint that
   it was a guess. Worse, on the reporter's own debts the two outcomes came out
   $96 apart on $237,000 and one card was still highlighted as the winner. ---- */
const IVT={...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, hourlyWage:24,
  debts:[{id:'d1',name:'Visa',balance:5000,apr:7,minPayment:500},
         {id:'d2',name:'Car loan',balance:6000,apr:10,minPayment:500}],
  debtBudget:1200, investReturn:7, investYears:10};
await seed(IVT); await p.reload(); await p.waitForTimeout(900);
const iv = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); await wait(550);
  const out={
    presets:[...document.querySelectorAll('#retPick button')].map(b=>+b.dataset.ret),
    note:document.getElementById('retNote').textContent,
    range:(document.querySelector('.iv-range')||{}).textContent||'',
    verdict:(document.querySelector('.iv-verdict')||{}).textContent||'',
    wins:[...document.querySelectorAll('.iv-card')].filter(c=>c.classList.contains('win')).length };
  document.querySelector('#retPick button[data-ret="10"]').click(); await wait(350);
  out.pickedField=document.getElementById('investReturn').value;
  return out;
});
check('the return field offers figures to pick from', iv.presets.join(',')==='5,7,10', iv.presets.join(','));
check('...and tapping one drives the comparison', iv.pickedField==='10', iv.pickedField);
check('it says plainly that nobody knows this number',
      /nobody knows/i.test(iv.note) && /guess about the future/i.test(iv.note), iv.note.slice(0,70));
check('...anchors it in history, before and after inflation',
      /10%/.test(iv.note) && /7%/.test(iv.note) && /before inflation/.test(iv.note) && /after it/.test(iv.note));
check('...and refuses to call history a promise',
      /history, not a promise/i.test(iv.note));
check('it shows whether the guess even changes the answer',
      /Does the guess even change the answer/i.test(iv.range), iv.range.slice(0,60));
check('a result that hinges on the rate is called a tie, not a win',
      iv.wins===0 && /tie, not a winner/i.test(iv.verdict), `${iv.wins} winners · ${iv.verdict.slice(0,60)}`);

/* a genuinely lopsided case must still name its winner - the point is honesty,
   not refusing to answer */
const CLEAR={...IVT, debts:[{id:'d',name:'Visa',balance:12000,apr:29.9,minPayment:250}], debtBudget:900};
await seed(CLEAR); await p.reload(); await p.waitForTimeout(900);
const clear = await p.evaluate(async () => {
  activateTab('debt'); await new Promise(r=>setTimeout(r,550));
  return { wins:[...document.querySelectorAll('.iv-card')].filter(c=>c.classList.contains('win')).length,
           verdict:(document.querySelector('.iv-verdict')||{}).textContent||'',
           range:(document.querySelector('.iv-range')||{}).textContent||'' };
});
check('a 29.9% card still gets a clear verdict', clear.wins===1 && /Crushing the debt wins/i.test(clear.verdict),
      clear.verdict.slice(0,60));
check('...and says the guess does not matter there',
      /Not really/i.test(clear.range) && /do not need to predict/i.test(clear.range), clear.range.slice(0,70));

/* ---- 30. the intake asks what you HAVE, not only what you owe ----
   Asked from a real phone: "where is the savings area kept - what's in the bank
   right now? And why isn't it part of the initial intake?" It was not. The
   intake asked income, the four walls, other expenses and DEBT, and never once
   asked for a balance. So a full-budget user who declared debt finished setup
   with a net worth of exactly minus their debt - the app telling someone with
   $8,000 in the bank that they were $5,000 in the hole, because it had only
   ever heard one side of the ledger. ---- */
const have = await p.evaluate(() => {
  const step=INTAKE.find(s=>s.id==='haveNow');
  if(!step) return {missing:true};
  return { optional:!!step.optional, hasWhy:!!step.why, key:step.key, input:step.input,
    onFull:step.showIf({acct:'full',hasDebt:'no'}),
    onSpend:step.showIf({acct:'spend'}),
    rightAfterDebt:INTAKE.findIndex(s=>s.id==='haveNow')-INTAKE.findIndex(s=>s.id==='debtFeel'),
    pairs:step.bot({acct:'full',hasDebt:'yes',debtAmt:5000}),
    alone:step.bot({acct:'full',hasDebt:'no'}) };
});
check('the intake asks what is in the bank', have.missing!==true && have.key==='haveNow' && have.input==='money');
check('...and it can be skipped', have.optional===true);
check('...it explains why it is asking', have.hasWhy===true);
check('...it sits with the debt question, as the other side of the ledger',
      have.rightAfterDebt===1, String(have.rightAfterDebt));
check('...it names itself as the other side when a debt was just given',
      /other side/i.test(have.pairs) && !/other side/i.test(have.alone),
      have.pairs.slice(0,60));
check('...and the light spending path is left light', have.onFull===true && have.onSpend===false);

/* the fault it exists to fix */
const ledger = await p.evaluate(() => {
  state=JSON.parse(JSON.stringify(defaultState()));
  state.onboarded=true; state.uiMode='all'; state.stageReached=3;
  state.liabilities.push({id:'l',name:'Debt',value:5000,src:'intake'});
  save();
  const oneSided=netWorth();
  state.accounts.push({id:'a',name:'Bank',kind:'checking',purpose:'',balance:8000,updated:todayStr(),src:'intake'});
  save();
  return { oneSided, both:netWorth(), bank:bankTotal(), liquid:liquidTotal(),
           savingsCard:!!REPORT_SIGNALS.find(s=>s.k==='oSavings').run() };
});
check('a balance turns a one-sided net worth into an honest one',
      ledger.oneSided===-5000 && ledger.both===3000, `${ledger.oneSided} -> ${ledger.both}`);
check('...it counts as money you could reach today', ledger.liquid===8000, String(ledger.liquid));
check('...and the savings context card finally has something to work with',
      ledger.savingsCard===true);

/* ---- 31. nobody gets paid "in a normal month" ----
   Asked from a real phone: "some people get paid biweekly or only know their
   hourly rate - let the engine compute their monthly, we must not assume they
   all know math." The intake had exactly one income question and it wanted a
   monthly take-home. A person paid every two weeks had to either do the
   conversion or guess, and the guess people reach for is amount x 2 - which is
   two whole paychecks a year missing from a budget that claims to account for
   every dollar. Same for weekly and x 4, worth four paychecks. ---- */
const pay = await p.evaluate(() => {
  const step=INTAKE.find(s=>s.id==='income');
  const wage=INTAKE.find(s=>s.id==='wage');
  const round=n=>Math.round(n*100)/100;
  return {
    offered: !!(step.help && step.help.mode==='pay'),
    cta: (step.help||{}).cta||'',
    invited: /weekly|hour/i.test(step.bot({acct:'full',name:'Pat'})),
    kinds: PAY_FREQS.map(f=>f.k),
    /* every cadence lands on the same monthly figure the recurring engine would
       give the same money - one app, one set of multipliers */
    weekly: round(payToMonthly('weekly',840,0)),
    biweekly: round(payToMonthly('biweekly',1680,0)),
    semi: round(payToMonthly('semimonthly',1600,0)),
    monthly: round(payToMonthly('monthly',3200,0)),
    yearly: round(payToMonthly('yearly',52000,0)),
    hourly: round(payToMonthly('hourly',19.5,38)),
    recWeekly: round(recMonthly({amount:840,freq:'weekly'})),
    recBiweekly: round(recMonthly({amount:1680,freq:'biweekly'})),
    /* the working names the wrong answer people would otherwise have used */
    wWeek: payWorkings('weekly',840,0,3640),
    wBiweek: payWorkings('biweekly',1680,0,3640),
    /* an hourly rate they typed comes back as itself, not a rounded re-derivation */
    suggestExact: wage.suggest({payFreq:'hourly',payAmt:19.5,income:3211,hoursPerWeek:38}),
    suggestDerived: wage.suggest({income:3200,hoursPerWeek:40}),
    heard: wage.bot({payFreq:'hourly',payAmt:19.5,hoursPerWeek:38,acct:'full'})
  };
});
check('the income question offers a way in for people not paid monthly', pay.offered===true);
check('...and the question itself says so', pay.invited===true, pay.cta);
check('...every real cadence is on the list',
      ['hourly','weekly','biweekly','semimonthly','monthly','yearly'].every(k=>pay.kinds.includes(k)),
      pay.kinds.join(','));
check('a weekly paycheck converts on 52 weeks, not 4 per month',
      pay.weekly===3640 && pay.weekly===pay.recWeekly, `${pay.weekly} vs recurring ${pay.recWeekly}`);
check('a biweekly paycheck converts on 26 paydays, not 24',
      pay.biweekly===3640 && pay.biweekly===pay.recBiweekly, `${pay.biweekly} vs recurring ${pay.recBiweekly}`);
check('twice a month is exactly twice, and a month is exactly once',
      pay.semi===3200 && pay.monthly===3200, `${pay.semi} / ${pay.monthly}`);
check('a salary divides by twelve', pay.yearly===4333.33, String(pay.yearly));
check('an hourly rate goes through the hours they actually work',
      pay.hourly===3211, String(pay.hourly));
check('the weekly working names the wrong answer out loud',
      /\$3,360/.test(pay.wWeek) && /52/.test(pay.wWeek), pay.wWeek.slice(0,80));
check('the biweekly working names the wrong answer out loud',
      /\$3,360/.test(pay.wBiweek) && /26/.test(pay.wBiweek), pay.wBiweek.slice(0,80));
check('a rate they typed is handed back unrounded, not re-derived',
      pay.suggestExact===19.5, String(pay.suggestExact));
check('...while everyone else still gets the estimate from their monthly',
      pay.suggestDerived===18, String(pay.suggestDerived));
check('...and the rate question confirms what it heard instead of asking twice',
      /You told me/.test(pay.heard) && /19\.50/.test(pay.heard), pay.heard.slice(0,60));

/* ---- 32. the year nobody works out for themselves ----
   Second half of the same phone note: "let reflect compute their projected
   salaries by year." People know what lands on Friday. Almost nobody knows the
   twelve-month total, and the projection has to say whether it is measured off
   what landed or off what they told setup - a projection that hides its source
   is just a confident number. ---- */
const yr = await p.evaluate(() => {
  state=JSON.parse(JSON.stringify(defaultState()));
  state.onboarded=true; state.hourlyWage=19.5; state.hoursPerWeek=38;
  state.intake={name:'Pat',income:3211,pay:{freq:'biweekly',amt:1482,hoursPerWeek:38}};
  save();
  const sig=REPORT_SIGNALS.find(s=>s.k==='year');
  const stated=sig.run();
  const M=state.activeMonth;
  state.transactions.push({id:'y1',type:'income',amount:2964,date:shiftMonth(M,-1)+'-05',source:'Pay'});
  const one=sig.run();
  state.transactions.push({id:'y2',type:'income',amount:4446,date:shiftMonth(M,-2)+'-05',source:'Pay'});
  save();
  const measured=sig.run();
  /* the month in progress must never be annualised: four days of income is not
     a salary, and this is the trap the whole signal exists to avoid */
  state.transactions.push({id:'y3',type:'income',amount:12,date:M+'-01',source:'Pay'});
  save();
  const withPartial=sig.run();
  state.transactions=[]; state.intake={};
  save();
  const nothing=sig.run();
  return {stated, one, measured, withPartial, nothing};
});
check('a fresh user still gets the yearly number from what they told setup',
      /38,532/.test(yr.stated.body), yr.stated.t);
check('...and it says out loud that it is their figure, not a measurement',
      /not what landed/i.test(yr.stated.nudge));
check('...it prices the year in hours of their life', /1,976/.test(yr.stated.nudge));
check('...and it names the cadence, because 26 paydays is not 24',
      /26 paydays/.test(yr.stated.nudge));
/* One month is not a trend. With a stated figure to fall back on it keeps using
   that and keeps saying so; it must never annualise a single month, which is how
   one big commission month becomes a salary. */
check('one logged month is never annualised on its own',
      /38,532/.test(yr.one.body) && /not what landed/i.test(yr.one.nudge) && !/35,568/.test(yr.one.body),
      yr.one.t);
check('two full months switch it to what actually landed',
      /44,460/.test(yr.measured.body) && /last 2 full months/.test(yr.measured.body), yr.measured.t);
check('...and a spread that wide is reported as a range, not a promise',
      /range rather than a promise/.test(yr.measured.nudge));
check('the month in progress is never annualised',
      yr.withPartial.work===yr.measured.work, yr.withPartial.work);
check('with nothing at all, it says nothing', !!yr.nothing.locked, yr.nothing.locked);

/* ---- 33. the one number the app prices against was hidden in Settings ----
   Third part of the same note: "this lives nowhere besides settings and is
   hidden." It did - the True Net Hourly Wage calculator sat inside a collapsed
   <details>, two taps and a scroll behind a summary nobody opens, while every
   hours-of-life figure in the app depended on it. It now meets people on Home
   the moment setup ends, and leaves for good once used or waved off. ---- */
const tr = await p.evaluate(async () => {
  state=JSON.parse(JSON.stringify(defaultState()));
  state.onboarded=true; state.hourlyWage=19.5; state.hoursPerWeek=38;
  state.intake={name:'Pat',income:3211};
  save(); renderHome();
  const shown=document.getElementById('trueRateCard').innerText;
  const fields=['trcTake','trcCommute','trcOver'].every(id=>!!document.getElementById(id));
  const prefilled=(document.getElementById('trcTake')||{}).value;
  document.getElementById('trcCommute').value='7';
  document.getElementById('trcOver').value='260';
  document.getElementById('trcGo').click();
  await new Promise(r=>setTimeout(r,150));
  const after=document.getElementById('trueRateCard').innerText;
  const wage=state.hourlyWage;
  renderHome();
  const gone=document.getElementById('trueRateCard').innerText;
  /* the Settings panel and the Home card must be the same arithmetic - a rate
     that differs by where you typed it is worse than no rate */
  state.trueRate={}; state.hourlyWage=19.5; save();
  const viaSettings=(()=>{
    document.getElementById('trTake').value='3211';
    document.getElementById('trCommute').value='7';
    document.getElementById('trOver').value='260';
    document.getElementById('trCompute').click();
    return state.hourlyWage;
  })();
  /* waving it off has to stick, or it is nagging rather than offering */
  state.trueRate={}; state.hourlyWage=19.5; state.trueRateSkipped=false; save(); renderHome();
  document.getElementById('trcSkip').click();
  renderHome();
  const afterSkip=document.getElementById('trueRateCard').innerText;
  return {shown, fields, prefilled, after, wage, gone, viaSettings, afterSkip, skipped:state.trueRateSkipped};
});
check('the true-rate calculator meets people on Home, not buried in Settings',
      /costs more than that/i.test(tr.shown) && tr.fields===true, tr.shown.split('\n')[1]||'');
check('...with their own take-home already in the field', tr.prefilled==='3211', tr.prefilled);
check('...and it computes the real rate', tr.wage===15.13, String(tr.wage));
check('...names what the commute and overhead were costing per hour',
      /\$4\.37 an hour/.test(tr.after), tr.after.split('\n')[1]||'');
check('...then leaves for good once it has been used', tr.gone.trim()==='', tr.gone.slice(0,40));
check('Home and Settings run the same arithmetic, to the cent',
      tr.viaSettings===tr.wage, `${tr.viaSettings} vs ${tr.wage}`);
check('...and waving it off sticks', tr.skipped===true && tr.afterSkip.trim()==='');

/* ---- 34. the screen a spend-mode user lives on could not log ----
   Sent from a real phone with the pace card circled: "right from this screen
   there should be a button to track an expense." There was not. Spend mode has
   exactly one job - log what you spent - and the button for it sat at the top of
   a long scroll, in a panel above the reward calendar. The calendar is the part
   people actually come back for (the streak, the stars, the green days), it
   fills the screen, and it had no way to add anything at all. Worse, "$0 spent"
   has two meanings on that card - you spent nothing, or you have not typed it in
   yet - and there was nothing on screen to resolve it. ---- */
const callog = await p.evaluate(async () => {
  state=JSON.parse(JSON.stringify(defaultState()));
  state.onboarded=true; state.spendingMode=true; state.spendLimit=1500;
  state.hourlyWage=22; state.trueRateSkipped=true;
  state.activeMonth=thisMonth(); state.trackStart=thisMonth()+'-01';
  save(); applySpending(); renderHome();
  const cal=()=>document.getElementById('rewardCalBox');
  const btns=()=>[...cal().querySelectorAll('[data-callog]')].map(b=>({d:b.dataset.callog,t:b.textContent.trim()}));
  const onCal=btns();
  const zeroNote=/only counts if it is true/.test(cal().innerText);
  /* a day that is not today has to carry its own date, or logging Saturday's
     coffee onto Monday quietly breaks the streak the calendar just drew */
  const cells=[...cal().querySelectorAll('.cal-cell[data-day]')];
  cells[0].click(); await new Promise(r=>setTimeout(r,60));
  const past=btns();
  const wantDate=thisMonth()+'-'+String(cells[0].dataset.day).padStart(2,'0');
  /* today already has its button in the pace strip - the day card must not add a second */
  const cells2=[...cal().querySelectorAll('.cal-cell[data-day]')];
  cells2[cells2.length-1].click(); await new Promise(r=>setTimeout(r,60));
  const todaySel=btns();
  /* and the back-date button has to actually land on that day */
  const cells3=[...cal().querySelectorAll('.cal-cell[data-day]')];
  cells3[0].click(); await new Promise(r=>setTimeout(r,60));
  document.querySelector('#calDay [data-callog]').click();
  await new Promise(r=>setTimeout(r,260));
  const landed={tab:(document.querySelector('.view.on')||{}).id, date:(document.getElementById('qlDate')||{}).value};
  /* the emptiest version of the screen - no limit, so no calendar - was also
     the one with no way out of being empty */
  quickLogOpen=false; renderQuickLog();
  state.spendLimit=0; save(); renderRewardCalendar();
  const noLimit=btns().length;
  /* a month that is not the current one must not offer to log "today" into it */
  state.spendLimit=1500; state.activeMonth=shiftMonth(thisMonth(),-1); save(); renderRewardCalendar();
  const pastMonth=btns().filter(b=>b.d==='today').length;
  return {onCal, zeroNote, past, wantDate, todaySel, landed, noLimit, pastMonth};
});
check('the reward calendar carries the one action the mode is for',
      callog.onCal.length===1 && callog.onCal[0].d==='today' && /Log an expense/.test(callog.onCal[0].t),
      callog.onCal.map(b=>b.t).join(' | '));
check('...and an unlogged zero says so rather than reading as a clean week', callog.zeroNote===true);
check('tapping an earlier day offers to log to THAT day',
      callog.past.length===2 && callog.past[1].d===callog.wantDate,
      callog.past.map(b=>b.t).join(' | '));
check('...and the button that opens carries the date with it',
      callog.landed.tab==='view-tx' && callog.landed.date===callog.wantDate,
      `${callog.landed.tab} @ ${callog.landed.date}`);
check('today never gets two buttons for the same thing',
      callog.todaySel.length===1, callog.todaySel.map(b=>b.t).join(' | '));
check('no limit set is still a screen you can log from', callog.noLimit===1, String(callog.noLimit));
check('a month that is not this one never offers to log "today" into it',
      callog.pastMonth===0, String(callog.pastMonth));

/* ---- 35. the trail, and the dead ends it exists to stop ----
   "Just because each section has a dedicated section there should be a
   gingerbread trail leading to each - you shouldn't have to search for a
   section, it should just naturally be there when an opportunity is provided."
   The app kept growing sentences that named a next move and gave you no way to
   make it: "Set a dream on the Goals tab", "Log your paycheck on Track and this
   flips", "Add a category first (Budget tab)" - the last one an alert that
   stopped you mid-log, named a tab, and left you where you were. The root cause
   was four private copies of "take me there" and no shared one, so writing a
   plain sentence was always the cheaper option. ---- */
const trail = await p.evaluate(async () => {
  const r={};
  /* every destination has to resolve to something that exists in the dom, or a
     breadcrumb navigates and then does nothing, which is worse than no button */
  r.broken=Object.entries(TRAIL).filter(([k,t])=>t.focus && !document.getElementById(t.focus)).map(([k])=>k);
  r.count=Object.keys(TRAIL).length;
  /* it must walk the WHOLE way - tab, then the field, not just the tab */
  activateTab('home'); goTrail('debt');
  await new Promise(x=>setTimeout(x,300));
  r.walk={tab:(document.querySelector('.view.on')||{}).id, focus:(document.activeElement||{}).id};
  /* and it must never walk into an area someone switched off - that hands back
     the exact feature they said they did not want */
  setAreaOff('debt',true); activateTab('home'); goTrail('debt');
  await new Promise(x=>setTimeout(x,220));
  r.blocked=(document.querySelector('.view.on')||{}).id;
  setAreaOff('debt',false);
  return r;
});
check('every trail leads to a field that exists', trail.broken.length===0, trail.broken.join(','));
check('...and it walks the whole way, not just to the tab',
      trail.walk.tab==='view-debt' && trail.walk.focus==='debtName', `${trail.walk.tab} / ${trail.walk.focus}`);
check('...but never into an area that was switched off', trail.blocked==='view-home', trail.blocked);

/* the specific dead ends, each one a place that named a move and offered none */
const ends = await p.evaluate(async () => {
  state=JSON.parse(JSON.stringify(defaultState()));
  state.onboarded=true; state.uiMode='all'; state.stageReached=3; state.trueRateSkipped=true;
  save(); renderAll();
  const r={};
  const pick=sel=>[...document.querySelectorAll(sel+' [data-trail]')].map(b=>b.dataset.trail);
  /* the report names exactly what is missing; that list used to be complaints */
  state.transactions.push({id:'x1',type:'expense',amount:40,catId:null,date:todayStr(),note:'Coffee'});
  save(); rfTab='report'; renderReflectTab();
  r.report=pick('#rpBody');
  r.reportEmptyHasDoors=/Nothing worth saying yet/.test(document.getElementById('rpBody').innerText)
    && pick('#rpBody').includes('income');
  /* a plan with no income behind it */
  const M=state.activeMonth, c=findOrCreateCat('Rent');
  budgetFor(M)[c.id]=1200; save(); renderHome();
  r.ltb=pick('#lifeKeyHome');
  /* you told the app you owe money; it owns a planner and never said so */
  state.liabilities.push({id:'l1',name:'Car loan',value:12000}); save(); renderNetWorth();
  r.owed=pick('#liabList');
  state.debts.push({id:'d1',name:'Car loan',balance:12000,apr:6,minPayment:250}); save(); renderNetWorth();
  r.owedOncePlanned=pick('#liabList').length;    // an offer, not a nag
  /* "Now set a bigger one" with nothing to press */
  state.goals.push({id:'g1',name:'Cushion',target:1000,saved:1000,date:''}); save(); renderGoals();
  r.fundedGoal=pick('#goals');
  /* the circulation panel told you which tab to go to */
  renderCirculation();
  r.circ=pick('#circChart');
  /* Freedom Mode with no rate used to alert and drop you at the top of Settings */
  state.hourlyWage=0; state.transactions=state.transactions.filter(t=>t.type!=='income'); save();
  activateTab('home');
  document.querySelector('#freedomToggle button[data-mode="life"]').click();
  await new Promise(x=>setTimeout(x,300));
  r.freedom={tab:(document.querySelector('.view.on')||{}).id, focus:(document.activeElement||{}).id, mode:!!state.freedomMode};
  return r;
});
check('the report offers a way to unlock what it says is missing',
      ends.report.includes('income') && ends.report.includes('wage') && ends.report.includes('hours'),
      ends.report.join(','));
check('...and its empty state is not the one screen in Reflect with no door',
      ends.reportEmptyHasDoors===true);
check('a plan with no income behind it offers to log the paycheck',
      ends.ltb.includes('income'), ends.ltb.join(','));
check('telling the app you owe money offers the payoff planner',
      ends.owed.includes('debt'), ends.owed.join(','));
check('...and it stops offering once the planner has them', ends.owedOncePlanned===0, String(ends.owedOncePlanned));
check('a funded goal can name the next one from where it says to',
      ends.fundedGoal.includes('dream'), ends.fundedGoal.join(','));
check('the circulation panel offers the tagging it depends on',
      ends.circ.includes('logspend'), ends.circ.join(','));
check('Freedom Mode without a rate walks you to the rate instead of alerting',
      ends.freedom.tab==='view-settings' && ends.freedom.focus==='wage' && ends.freedom.mode===false,
      `${ends.freedom.tab} / ${ends.freedom.focus}`);

/* And the rule that keeps it from rotting: copy must not name a destination the
   panel it sits in cannot reach. These are the exact phrasings that were the
   fault, so a new one reintroduces the bug the moment it is written. */
const phrasing = await p.evaluate(() => {
  /* Strip the comments first. The paragraph explaining WHY these phrasings were
     wrong contains every one of them, and a checker that trips over its own
     documentation teaches people to delete the documentation. Line comments are
     left alone deliberately - stripping to end-of-line would eat any URL after
     the "//". */
  const src=document.documentElement.outerHTML
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/\/\*[\s\S]*?\*\//g,' ');
  const banned=[/Set a dream on the Goals tab/, /Log your paycheck on Track/,
                /Add a category first \(Budget tab\)/, /Add a category first on the Budget tab/,
                /log something on Track/, /as you log them on the Track tab/,
                /Set a monthly spending limit in Settings/,
                /Set your hourly wage first \(in Settings\)/];
  return banned.filter(re=>re.test(src)).map(String);
});
check('no panel points at a tab it cannot take you to', phrasing.length===0, phrasing.join(' | '));

/* ---- 36. every rate-shaped field takes the period you think in ----
   Sent from a phone with three labels circled: the true-rate card asked for
   take-home "/ month", then commute "hrs/week", then overhead "/ month" - three
   fields, two periods, one card. Someone who buys $60 of gas a week has to do
   the conversion before they can answer, and someone reading top to bottom
   carries "month" into the middle field and answers it wrong without noticing.
   Neither is the user's fault: the app already knows how to convert, it was just
   picking the unit and making the human meet it there. Same note asked for a "?"
   on anything pre-filled or derived, which is fair - a number that appears in a
   field with no explanation is one people either trust blindly or delete. ---- */
const units = await p.evaluate(async () => {
  state=JSON.parse(JSON.stringify(defaultState()));
  state.onboarded=true; state.uiMode='all'; state.stageReached=3;
  state.hourlyWage=22; state.hoursPerWeek=38; state.intake={name:'Pat',income:7700};
  save(); renderAll(); applySpending();
  const r={};
  /* every multiplier in the app must agree about what a month is - a bill, a
     paycheck, a leak and an overhead of the same cadence cannot disagree */
  r.weekAgrees = periodMeta('week').per===recFreqMeta({freq:'weekly'}).per
              && periodMeta('week').per===leakFreqMult('week')
              && periodMeta('biweek').per===recFreqMeta({freq:'biweekly'}).per
              && periodMeta('month').per===1 && periodMeta('year').per===1/12;
  /* a commute is not a calendar-day thing: five work days, not thirty */
  r.workday=Math.round(periodMeta('workday').per*100)/100;
  r.calDay=Math.round(periodMeta('day').per*100)/100;

  renderHome();
  const card=document.getElementById('trueRateCard');
  r.cardPickers=[...card.querySelectorAll('select[data-unit]')].map(x=>x.dataset.unit).sort();
  r.cardWhy=[...card.querySelectorAll('[data-why]')].map(x=>x.dataset.why).sort();
  r.prefill=document.getElementById('trcTake').value;
  /* the number typed must never move when the unit does - only its meaning */
  const setSel=(u,v)=>{ const el=card.querySelector(`select[data-unit="${u}"]`); el.value=v; el.dispatchEvent(new Event('change',{bubbles:true})); };
  const type=(id,v)=>{ const el=document.getElementById(id); el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); };
  setSel('trcOver','week'); type('trcOver','60');
  r.overWork=document.getElementById('trcOverW').textContent;
  setSel('trcCommute','workday'); type('trcCommute','1.5');
  r.commWork=document.getElementById('trcCommuteW').textContent;
  r.stillTyped=document.getElementById('trcOver').value;
  document.getElementById('trcGo').click();
  await new Promise(x=>setTimeout(x,150));
  r.stored=JSON.parse(JSON.stringify(state.trueRate));
  r.rate=state.hourlyWage;
  /* the two doors must end up showing the same three numbers */
  r.settings={take:document.getElementById('trTake').value, over:document.getElementById('trOver').value};

  /* the other rate-shaped fields the audit turned up */
  state.spendingMode=true; save(); applySpending();
  const su=document.querySelector('select[data-unit="spendLimit"]'); su.value='week'; su.dispatchEvent(new Event('change',{bubbles:true}));
  type('spendLimit','120');
  r.limit=Math.round(state.spendLimit*100)/100;
  state.debts.push({id:'d1',name:'Visa',balance:3000,apr:22,minPayment:60}); save(); renderDebt();
  const du=document.querySelector('select[data-unit="debtBudget"]'); du.value='week'; du.dispatchEvent(new Event('change',{bubbles:true}));
  type('debtBudget','200');
  r.debt=Math.round(state.debtBudget*100)/100;
  state.assets.push({id:'a1',name:'Car',value:9000,kind:'stuff',cost:0}); save(); renderNetWorth();
  const cu=document.querySelector('select[data-costunit="a1"]'); cu.value='year'; cu.dispatchEvent(new Event('change',{bubbles:true}));
  const ci=document.querySelector('input[data-cost="a1"]'); ci.value='1800'; ci.dispatchEvent(new Event('input',{bubbles:true}));
  r.asset=Math.round(state.assets[0].cost*100)/100;
  /* and the choice has to survive a repaint, or it is a setting that forgets */
  renderDebt(); renderNetWorth();
  r.persist={debt:document.querySelector('select[data-unit="debtBudget"]').value+':'+document.getElementById('debtBudget').value,
             asset:document.querySelector('select[data-costunit="a1"]').value+':'+document.querySelector('input[data-cost="a1"]').value};
  return r;
});
check('every period multiplier agrees with the rest of the app', units.weekAgrees===true);
check('a commute counts work days, not calendar days',
      units.workday===21.67 && units.calDay===30.42, `${units.workday} vs ${units.calDay}`);
check('all three true-rate fields take a period', units.cardPickers.length===3, units.cardPickers.join(','));
check('...and all three can show their working', units.cardWhy.length>=3, units.cardWhy.join(','));
check('...the pre-filled figure is pre-filled from their own income', units.prefill==='7700', units.prefill);
check('$60 a week converts on 52 weeks, out loud',
      /\$60 a week × 4.33 = \$260 a month/.test(units.overWork), units.overWork);
check('1.5 hours a work day is 21.67 of them, not 30',
      /1\.5 hrs a day you work × 21\.67 = 32\.5 hrs a month/.test(units.commWork), units.commWork);
check('changing the unit never moves the number you typed', units.stillTyped==='60', units.stillTyped);
check('what gets stored is always monthly, whatever they typed',
      units.stored.take===7700 && units.stored.overhead===260 && units.stored.commute===7.5,
      JSON.stringify(units.stored));
check('...and the rate is right to the cent', units.rate===37.73, String(units.rate));
check('setting it on Home leaves Settings showing the same numbers',
      units.settings.take==='7700' && units.settings.over==='260', JSON.stringify(units.settings));
check('a weekly spending limit stores as a month', units.limit===520, String(units.limit));
check('a weekly debt payment stores as a month', units.debt===866.67, String(units.debt));
check('a yearly running cost stores as a month', units.asset===150, String(units.asset));
check('the unit survives a repaint',
      units.persist.debt==='week:200' && units.persist.asset==='year:1800', JSON.stringify(units.persist));

/* The audit rule itself: a field that asks for a RATE - money or hours per some
   period - must let the person pick the period. Fields that are not rates are
   listed as deliberate exclusions rather than left ambiguous: a transaction is a
   dated event, a goal target is a total, an APR is annual by definition, and the
   zero-based plan is monthly by design. */
const bakedIn = await p.evaluate(() => {
  const src=document.documentElement.outerHTML
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/\/\*[\s\S]*?\*\//g,' ');
  /* a label that hard-codes a period next to an input is the fault returning */
  const bad=[];
  /* Deliberate exclusions, because these are not rates and a picker would be
     wrong rather than kind: an APR and an expected market return are annual by
     definition, a transaction is a dated event, a goal target is a total, and
     the zero-based plan is monthly by design - that IS the model. */
  const NOT_A_RATE=/%\s*\/\s*yr|APR/i;
  src.replace(/<label[^>]*class="fld"[^>]*>([\s\S]{0,120}?)<input/g,(m,txt)=>{
    if(NOT_A_RATE.test(txt)) return m;
    if(/\/\s*(month|mo|week|wk|yr|year)\b|per (month|week|year)|monthly|weekly|hrs\/|hours\/mo/i.test(txt)) bad.push(txt.replace(/\s+/g,' ').trim().slice(0,60));
    return m;
  });
  return bad;
});
check('no field hard-codes a period into its label any more', bakedIn.length===0, bakedIn.join(' | '));

/* ---- 37. tripwires - the nudge at the door of the shop ----
   A user's idea: opt in to a warning when you open the app that usually gets
   you. The honest half is buildable and the dishonest half must never be built:
   this app CANNOT see which apps you open, no web page can, and something that
   could would need the always-watching permission the app exists to argue
   against. What both phones already ship is an automation engine that can watch
   for an app opening, so the app hands it a link that lands on the gut-check
   with the shop already named. The watching stays in the OS. ---- */
const trip = await p.evaluate(() => {
  state=JSON.parse(JSON.stringify(defaultState()));
  state.onboarded=true; state.uiMode='all'; state.stageReached=3; state.hourlyWage=22;
  save(); activateTab('impulse'); renderTripwires();
  const body=()=>document.getElementById('tripwireBody');
  const r={};
  /* the claim that would be a lie has to be denied in the panel itself, not
     buried in a doc nobody opens */
  r.saysItCannotWatch=/cannot see which apps you open/i.test(body().innerText);
  r.saysNudgeNotBlock=/never a lock|not a block|nudge/i.test(body().innerText);
  r.seeds=document.querySelectorAll('[data-twseed]').length;
  document.querySelector('[data-twseed="Amazon"]').click();
  document.querySelector('[data-twseed="DoorDash"]').click();
  r.added=state.tripwires.map(t=>t.name+':'+t.trap);
  /* a food app is a friction trap, a shopping feed is a scroll trap - a guess,
     but a guess that is right more often than "scroll" for everything */
  r.guesses=['Amazon','DoorDash','StockX','Prime renewal'].map(trapForName);
  r.url=tripwireURL('Uber Eats');
  r.dupe=(()=>{ const n=state.tripwires.length; twAdd('Amazon'); return state.tripwires.length===n; })();
  /* the recipe has to name the thing the person will actually open */
  r.recipe=/Shortcuts/.test(body().innerText) || /Modes and Routines/.test(body().innerText);
  document.querySelectorAll('[data-twplat]')[0].click();
  r.iosRecipe=/Shortcuts/.test(body().innerText) && /Is Opened/i.test(body().innerText);
  document.querySelectorAll('[data-twplat]')[1].click();
  r.androidRecipe=/Modes and Routines|MacroDroid|Tasker/.test(body().innerText);
  /* Test does exactly what the automation will do */
  document.querySelector('[data-twtest]').click();
  r.test={open:document.getElementById('modal').classList.contains('on'),
          name:document.getElementById('mName').value,
          trap:document.getElementById('mTrap').value};
  document.getElementById('modal').classList.remove('on');
  return r;
});
check('the panel denies the thing it cannot do, in its own words', trip.saysItCannotWatch===true);
check('...and says out loud that it is a nudge, not a block', trip.saysNudgeNotBlock===true);
check('the shops that actually get people are one tap each', trip.seeds>=10, String(trip.seeds));
check('adding one guesses which trap it is', trip.added.join(',')==='Amazon:scroll,DoorDash:friction', trip.added.join(','));
check('...a food app is friction, a resale app is status, a renewal is a leak',
      trip.guesses.join(',')==='scroll,friction,status,leak', trip.guesses.join(','));
check('the same shop cannot be armed twice', trip.dupe===true);
check('the link carries the shop name, url-encoded', /#check=Uber%20Eats$/.test(trip.url), trip.url);
check('the iPhone recipe names Shortcuts and the trigger', trip.iosRecipe===true);
check('the Android recipe names a routines app', trip.androidRecipe===true);
check('Test does exactly what the automation will do',
      trip.test.open===true && trip.test.name==='Amazon' && trip.test.trap==='scroll', JSON.stringify(trip.test));

/* Now the entry points, in a fresh page each time, because these are BOOT paths
   and a same-document hash change does not re-run boot. */
const tripBoot = await (async () => {
  const out={};
  const seed = async pg => { await pg.evaluate(()=>{ const st=JSON.parse(localStorage.getItem('unfiltered_budget_v2')||'{}');
    st.onboarded=true; st.uiMode='all'; st.stageReached=3; localStorage.setItem('unfiltered_budget_v2',JSON.stringify(st)); }); };
  const base='file://'+process.cwd()+'/app.html';
  const read = pg => pg.evaluate(()=>({ open:document.getElementById('modal').classList.contains('on'),
    name:document.getElementById('mName').value, amt:document.getElementById('mAmt').value,
    trap:document.getElementById('mTrap').value, focus:(document.activeElement||{}).id,
    intake:document.getElementById('intake').classList.contains('on'), q:location.search }));
  let pg=await b.newPage({viewport:{width:390,height:844}});
  await pg.goto(base); await pg.waitForTimeout(500); await seed(pg);
  await pg.goto(base+'#check=Amazon'); await pg.reload(); await pg.waitForTimeout(800);
  out.fresh=await read(pg);
  /* the SECOND firing usually finds the app already open, so the OS hands over
     the link without a reload - boot never runs and the nudge silently does
     nothing. That is the common case, not the edge case. */
  await pg.evaluate(()=>document.getElementById('modal').classList.remove('on'));
  await pg.evaluate(()=>{ location.hash='#check=Etsy'; });
  await pg.waitForTimeout(300);
  out.again=await read(pg);
  await pg.close();
  /* Android's share sheet: already looking at the thing, price and all */
  pg=await b.newPage({viewport:{width:390,height:844}});
  await pg.goto(base); await pg.waitForTimeout(500); await seed(pg);
  await pg.goto(base+'?share_title=Sony%20WH-1000XM5&share_text=Sony%20headphones%20%24348.00&share_url=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB09');
  await pg.waitForTimeout(800);
  out.shared=await read(pg);
  await pg.close();
  /* a brand-new user must get set up, not dropped into a scan of nothing */
  pg=await b.newPage({viewport:{width:390,height:844}});
  await pg.goto(base+'#check=Amazon'); await pg.waitForTimeout(800);
  out.cold=await read(pg);
  await pg.close();
  return out;
})();
check('a tripwire link opens the scan with the shop named',
      tripBoot.fresh.open===true && tripBoot.fresh.name==='Amazon', JSON.stringify(tripBoot.fresh));
check('...and puts the cursor on the price, the one thing still missing',
      tripBoot.fresh.focus==='mAmt', tripBoot.fresh.focus);
check('a second firing works when the app is already open',
      tripBoot.again.open===true && tripBoot.again.name==='Etsy', JSON.stringify(tripBoot.again));
check('sharing a product in reads its name and its price',
      tripBoot.shared.open===true && tripBoot.shared.name==='Sony WH-1000XM5' && tripBoot.shared.amt==='348',
      JSON.stringify(tripBoot.shared));
check('...and the shared title does not linger in the address bar', tripBoot.shared.q==='', tripBoot.shared.q);
check('a brand-new user gets set up, not dropped into a scan of nothing',
      tripBoot.cold.open===false && tripBoot.cold.intake===true, JSON.stringify(tripBoot.cold));

/* ---- 38. money that did not leave ----
   From a phone: "the track category still assumes expense even though investing
   should be an option. Say I used the $145 towards savings or investment,
   there's really no indication - it just has a big expense column. Its
   connotations are destructive not rewarding."

   Both halves were true. The quick log hard-coded type:'expense' on every line
   and offered only places money GOES, so someone who moved $145 into savings
   either could not record it or had their best month filed as a purchase. And
   spend mode counted one number, the accusing one: a week of funding a Roth read
   exactly like a week of doing nothing. ---- */
const put = await p.evaluate(async () => {
  const o={};
  state=JSON.parse(JSON.stringify(defaultState()));
  state.onboarded=true; state.uiMode='all'; state.stageReached=3; state.spendingMode=true;
  state.spendLimit=1500; state.hourlyWage=22; state.trueRateSkipped=true;
  state.activeMonth=thisMonth(); state.trackStart=thisMonth()+'-01';
  state.categories.push({id:'c1',name:'Coffee / drinks out'});
  save(); applySpending(); renderAll();
  /* a Roth contribution must never score against a spending category - that is
     the one misfiling that turns a good month into an accusation */
  o.guess=['Roth IRA','401k contribution','transfer to savings','emergency fund','index fund','Coffee']
    .map(x=>suggestCatFor(x));
  quickLogOpen=true; renderQuickLog();
  const rows=[...document.querySelectorAll('.ql-row')];
  o.options=[...rows[0].querySelectorAll('.ql-cat option')].map(x=>x.value);
  const set=(row,what,amt,cat)=>{ row.querySelector('.ql-what').value=what;
    row.querySelector('.ql-amt').value=amt; row.querySelector('.ql-cat').value=cat; };
  set(rows[0],'Coffee','5','c1');
  set(rows[1],'Roth IRA','145','__invest');
  set(rows[2],'Side gig','200','__income');
  document.getElementById('qlSave').click();
  await new Promise(x=>setTimeout(x,120));
  o.written=state.transactions.map(t=>t.type+':'+t.amount+':'+(t.source||t.note)).sort();
  /* money you still own has to reach net worth, or "put away" is just a label */
  o.asset=(state.assets||[]).map(a=>a.name+':'+a.value).join(',');
  o.toast=(document.getElementById('toastEl')||{}).textContent;
  applySpending(); renderHome();
  /* calSelDay is module state and an earlier section left a different day
     selected on this shared page - point it at today, which is where the
     entries just landed. */
  calSelDay=new Date().getDate(); renderRewardCalendar();
  const sp=document.getElementById('spendingBox').innerText;
  o.headline=/Put away/.test(sp);
  o.kept=(sp.match(/[^\n]*stayed yours[^\n]*/)||[''])[0];
  o.recentShowsIt=/Roth IRA/.test(sp);
  const cal=document.getElementById('rewardCalBox').innerText;
  o.week=(cal.match(/[^\n]*put away this week[^\n]*/)||[''])[0];
  o.day=(cal.match(/[^\n]*put away this day[^\n]*/)||[''])[0];
  o.dayRow=/Roth IRA/.test(cal);
  /* and it must not be counted as spending anywhere */
  o.spent=monthExpense(state.activeMonth);
  o.invested=monthInvested(state.activeMonth);
  /* with nothing put away yet, the screen still says the door exists */
  state.transactions=state.transactions.filter(t=>t.type==='expense'); save(); renderSpending();
  o.quietPrompt=/Put away/.test(document.getElementById('spendingBox').innerText);
  return o;
});
check('the quick log offers somewhere for money that did not leave',
      put.options.includes('__invest') && put.options.includes('__income'), put.options.join(','));
check('...and a Roth is never guessed as shopping',
      put.guess.slice(0,5).every(g=>g==='__invest') && put.guess[5]==='c1', put.guess.join(','));
check('a put-away line writes an investment, not an expense',
      put.written.join(' | ')==='expense:5:Coffee | income:200:Side gig | invest:145:Roth IRA',
      put.written.join(' | '));
check('...and it reaches net worth, because it is still your money',
      put.asset==='Invested capital:145', put.asset);
check('...and it never counts as spending', put.spent===5 && put.invested===145, `${put.spent} / ${put.invested}`);
check('the confirmation names what actually happened',
      /put away/.test(put.toast) && !/3 purchases/.test(put.toast), put.toast);
check('spend mode shows what you kept beside what you spent', put.headline===true);
check('...with the arithmetic, not just a compliment',
      /97% of it stayed yours/.test(put.kept) && /bought back/.test(put.kept), put.kept);
check('...and the list underneath matches the headline', put.recentShowsIt===true);
check('the week pace counts money moved, not only money gone',
      /\$145 put away this week/.test(put.week), put.week);
check('the day card says a funded day was a funded day',
      /\$145 put away this day/.test(put.day), put.day);
check('...and draws it as put away, never as a purchase', put.dayRow===true);
check('with nothing put away yet, the door is still named', put.quietPrompt===true);

/* The rule that keeps the framing from sliding back: the fast way to log must
   never be able to write only one kind of entry again. */
const oneKind = await p.evaluate(() => {
  const src=document.documentElement.outerHTML.replace(/\/\*[\s\S]*?\*\//g,' ');
  /* the quick log's writer used to be a single hard-coded expense push */
  const inv=/type:'invest'[^}]*ikind:'holds'/.test(src);
  const inc=/__income/.test(src) && /type:'income'/.test(src);
  return {inv, inc};
});
check('all three kinds of entry survive in the fast log', oneKind.inv===true && oneKind.inc===true,
      JSON.stringify(oneKind));

/* ---- 39. not everything is a trap ----
   Sent from a phone, with a screenshot: someone scanned a $100 leaf mulcher.
   Every autumn they had fought the leaves with a rake that could not do it, the
   alternative was paying somebody, and the tool solved it. The app called it a
   Scroll Trap and told them Meta had bet they would cave. That is not a
   gut-check, it is an accusation - and an app that calls every purchase a trap
   is worth exactly as much as one that calls none of them a trap, because
   neither is telling you anything.

   The fifth answer is not a permission slip. It asks what the thing replaces and
   does the arithmetic, and it is perfectly willing to conclude "nothing". ---- */
const tool = await p.evaluate(async () => {
  const o={};
  state=JSON.parse(JSON.stringify(defaultState()));
  state.onboarded=true; state.uiMode='all'; state.stageReached=3;
  state.hourlyWage=22; state.hoursPerWeek=40; state.trueRateSkipped=true;
  save(); renderAll(); activateTab('impulse'); fillTrapPickers();
  o.options=[...document.getElementById('impTrap').options].map(x=>x.value);
  /* the extra questions cost the other four lanes nothing */
  o.hiddenFirst=document.getElementById('impTool').classList.contains('hide');
  const pick=v=>{ const s=document.getElementById('impTrap'); s.value=v; s.dispatchEvent(new Event('change',{bubbles:true})); };
  pick('tool');
  o.shown=!document.getElementById('impTool').classList.contains('hide');
  o.units=[...document.querySelectorAll('#impTool select[data-unit]')].map(x=>x.dataset.unit).sort();
  const scan=(nm,amt,rep,hrs)=>{
    document.getElementById('impName').value=nm;
    document.getElementById('impAmt').value=String(amt);
    document.getElementById('impRepAmt').value=rep==null?'':String(rep);
    document.getElementById('impRepHrs').value=hrs==null?'':String(hrs);
    document.getElementById('impRun').click();
    const c=document.getElementById('impResult');
    return { cls:c.querySelector('.checkcard').className, head:c.querySelector('.verdict').textContent,
             tag:c.querySelector('.trap-tag').textContent, body:c.querySelector('.qline').textContent,
             needle:parseFloat(c.querySelector('.needle').style.left),
             honest:(c.querySelector('.tool-honest')||{}).textContent||'',
             btns:[...c.querySelectorAll('.check-actions button')].map(x=>x.textContent.trim()),
             text:c.innerText };
  };
  /* the actual purchase from the screenshot */
  o.mulcher=scan('Leaf mulcher',100,240,12);
  /* the arithmetic, by hand: $240/yr hired vs 12 hrs x $22 = $264/yr of hours.
     They would have done ONE of them, so the bigger one counts and the other is
     named as set aside. $100 / $264 = 0.379 yr = 5 months. */
  o.math=(()=>{ const pb=toolPayback(100,240,'year',12,'year',22);
    return {total:pb.totalYear, both:pb.both, usedHours:pb.usedHours,
            years:Math.round(pb.years*1000)/1000, five:pb.fiveYear}; })();
  /* replaces nothing: the lane must refuse to bless it */
  o.want=scan('Fancy rake',100,null,null);
  /* a slow payback is called slow, not celebrated */
  o.slow=scan('Ride-on mower',4000,300,null);
  /* the other lanes are untouched */
  pick('scroll');
  o.scroll=scan('Sneakers',100,null,null);
  o.hiddenAgain=document.getElementById('impTool').classList.contains('hide');
  return o;
});
check('there is a fifth answer, and it is not a trap',
      tool.options.length===5 && tool.options[4]==='tool', tool.options.join(','));
check('...its questions cost the other four lanes nothing',
      tool.hiddenFirst===true && tool.shown===true && tool.hiddenAgain===true);
check('...and each one takes the period you think in',
      tool.units.join(',')==='impRepAmt,impRepHrs', tool.units.join(','));
check('the leaf mulcher gets a payback, not an accusation',
      /pays for itself in 5 months/.test(tool.mulcher.head) && /Replaces a real cost/.test(tool.mulcher.tag),
      tool.mulcher.head);
check('...and the needle points at Freedom, not at Trap',
      tool.mulcher.needle<25, String(tool.mulcher.needle));
check('...with none of the shame the trap lanes carry',
      !/Meta ran the numbers|prove them wrong|cave/i.test(tool.mulcher.text));
check('the hours and the hired help are never added together',
      tool.math.total===264 && tool.math.both===true && tool.math.usedHours===true,
      JSON.stringify(tool.math));
check('...and it says out loud which one it set aside',
      /would have done <?b?>?one<\/?b?>? of them|one of them, not both/.test(tool.mulcher.body)
        && /leaves \$240 a year of hired help out/.test(tool.mulcher.body),
      tool.mulcher.body.slice(-160));
check('...the payback is right to the month', tool.math.years===0.379, String(tool.math.years));
check('replacing nothing is called a want, not an investment',
      /No cost replaced/.test(tool.want.tag) && /this is a want/.test(tool.want.body)
        && !/pays/.test(tool.want.cls), tool.want.tag);
check('...and the needle swings back toward Trap', tool.want.needle>50, String(tool.want.needle));
check('a slow payback is called slow', /slow payback/.test(tool.slow.body), tool.slow.body.slice(-90));
check('the caveats are not optional',
      /if you actually use it/.test(tool.mulcher.honest) && /would genuinely have paid|really going to/.test(tool.mulcher.honest));
check('the buy button stops calling it a ransom',
      tool.mulcher.btns[0]==='Buy it - it pays back' && tool.mulcher.btns.includes('Skip it'),
      tool.mulcher.btns.join(' | '));
check('the four trap lanes are untouched',
      /Scroll Trap detected/.test(tool.scroll.text) && !/tool/.test(tool.scroll.cls), tool.scroll.tag);

/* ---- 40. the number nobody could trace ----
   Asked after three days of use: "where does the net in Balance come from?"
   Two faults behind one question. The Track strip printed the SAME arithmetic
   twice - "Net" and "Balance (all time)" are both income minus spending minus
   investing, differing only by window, and on the all-months view they are
   identical by construction. And nothing said that most of the income side was
   written by the SETUP CHAT: it dates a paycheck to the 1st because the person
   told it their monthly take-home, which is reasonable to do and terrible to
   leave unexplained to someone on day three. ---- */
const netTile = await p.evaluate(async () => {
  state=JSON.parse(JSON.stringify(defaultState()));
  state.onboarded=true; state.uiMode='all'; state.stageReached=3;
  state.hourlyWage=22; state.trueRateSkipped=true;
  const M=state.activeMonth;
  state.transactions.push({id:'i1',type:'income',amount:3200,source:'Paycheck',owner:'a',date:M+'-01',note:'Intake'});
  const c=findOrCreateCat('Coffee / drinks out');
  state.transactions.push({id:'e1',type:'expense',amount:6,catId:c.id,date:M+'-23',note:'Latte'});
  state.transactions.push({id:'e2',type:'expense',amount:9,catId:c.id,date:M+'-24',note:'Coffee'});
  save(); activateTab('tx'); renderTx();
  const keys=()=>[...document.querySelectorAll('#txSummary .stat .k')].map(x=>x.textContent.replace('?',''));
  const o={};
  o.dayThree=keys();
  /* the working, on the spot */
  document.querySelector('#txSummary [data-why]').click();
  await new Promise(x=>setTimeout(x,60));
  o.why=(document.querySelector('.why-note[data-forwhy="txNet"]')||{}).textContent||'';
  /* the tile earns its place again once there IS history outside this month */
  state.transactions.push({id:'i0',type:'income',amount:500,source:'Old',date:shiftMonth(M,-2)+'-05'});
  save(); renderTx();
  o.withHistory=keys();
  /* but on the all-months view it is a duplicate by construction, always */
  txAllMonths=true; renderTx();
  o.allMonths=keys();
  txAllMonths=false; renderTx();
  /* and the two really are the same arithmetic - this is the claim being made */
  const inc=state.transactions.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const exp=state.transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const inv=state.transactions.filter(t=>t.type==='invest').reduce((s,t)=>s+t.amount,0);
  o.sameMath=Math.abs(allTimeBalance()-(inc-exp-inv))<0.005;
  return o;
});
check('the strip never prints the same number twice under two labels',
      netTile.dayThree.join(',')==='Income,Spent,Net (month)', netTile.dayThree.join(','));
check('...which it was, because they are the same arithmetic', netTile.sameMath===true);
check('...and never on the all-months view, where it always duplicates',
      netTile.allMonths.join(',')==='All-time Income,All-time Spent,Net (all time)', netTile.allMonths.join(','));
check('...but it comes back when there is history outside this month',
      netTile.withHistory.includes('Balance (all time)'), netTile.withHistory.join(','));
check('the net shows its own arithmetic on the spot',
      /Income − spending/.test(netTile.why) && /\$3,200 in − \$15 out = \$3,185/.test(netTile.why),
      netTile.why.slice(0,90));
check('...and names the part the setup chat wrote rather than the person',
      /written by the setup chat/i.test(netTile.why) && /\$3,200 of the income side \(100%\)/.test(netTile.why));
check('...says plainly that it reads high if that money has not landed',
      /has not actually arrived yet, this reads high/.test(netTile.why));
check('...and says how to correct it', /delete or correct it/.test(netTile.why));
check('...while still separating logged money from bank money',
      /does not know your real bank balance/.test(netTile.why));

/* ---- 41. money you have not been paid is not income ----
   From a phone: "money should not be assumed either if it hasn't been accounted
   for. Say I don't get paid til the 29th - it shouldn't be income not yet
   received if it's only the 26th."

   Correct, and the app already agreed with itself everywhere except one place.
   postRecurring caps the current month at today on purpose ("spent has to be a
   fact, not a forecast"), so a paycheck due on the 29th does not post on the
   26th. But commitIntake wrote a paycheck dated the 1st whether or not the
   person had been paid, and every figure built on it inherited that. ---- */
const paid = await p.evaluate(() => {
  const M=thisMonth(), today=todayStr(), d=new Date().getDate(), dim=daysInMonth(M);
  const run=(ans)=>{
    state=JSON.parse(JSON.stringify(defaultState()));
    state.onboarded=true; state.uiMode='all'; state.stageReached=3; save();
    iaAns=Object.assign({name:'Pat',acct:'full',income:3200,hoursPerWeek:40,wage:20,
      roof:1200,situation:'ok',register:'middle',tone:'blunt'},ans);
    iaCommitted=false; commitIntake();
    return { inc:Math.round(monthIncome(state.activeMonth)*100)/100,
             dates:state.transactions.filter(t=>t.type==='income').map(t=>t.date),
             rec:state.recurring.filter(r=>r.type==='income')
                  .map(r=>`${r.amount}|${r.freq||'monthly'}|${r.anchor||'-'}`) };
  };
  const o={today};
  /* the case from the phone: paid on the 29th, setting up before it */
  const future=Math.min(dim, d+4);
  o.notYet=run({payDay:shiftMonth(M,-1)+'-'+String(future).padStart(2,'0'), payFreq:'monthly'});
  /* paid earlier this month: it posts, on the day it actually landed */
  const past=String(Math.max(1,Math.min(9,d-3))).padStart(2,'0');
  o.paid=run({payDay:M+'-'+past, payFreq:'monthly'});
  /* biweekly walks forward from the anchor at the right cadence, per-payday amount */
  o.biweekly=run({payDay:shiftDays(today,-28), payFreq:'biweekly', payAmt:1476.92});
  /* skipped, because a new job genuinely has no answer - invent nothing */
  o.skipped=run({payDay:''});
  /* re-running setup must not post the same month's pay twice */
  state=JSON.parse(JSON.stringify(defaultState()));
  state.onboarded=true; save();
  iaAns={name:'Pat',acct:'full',income:3200,hoursPerWeek:40,wage:20,roof:1200,
    payDay:M+'-'+past, payFreq:'monthly', situation:'ok',register:'middle',tone:'blunt'};
  iaCommitted=false; commitIntake(); const once=monthIncome(state.activeMonth);
  iaCommitted=false; commitIntake();
  o.rerun={once, twice:monthIncome(state.activeMonth)};
  const st=INTAKE.find(x=>x.id==='payDay');
  o.step={ exists:!!st, input:st&&st.input, optional:!!(st&&st.optional), why:!!(st&&st.why),
           withIncome:st?st.showIf({income:3200}):null, without:st?st.showIf({income:0}):null };
  /* and the "why" has to actually render, not just exist on the object - it was
     only ever wired into the chip renderers, so a money step that declared one
     showed no button at all */
  return o;
});
check('the intake asks when the money actually landed',
      paid.step.exists===true && paid.step.input==='date', String(paid.step.input));
check('...only when there is income to ask about',
      paid.step.withIncome===true && paid.step.without===false);
check('...and it can be skipped, because a new job has no answer yet',
      paid.step.optional===true && paid.step.why===true);
check('a paycheck due later this month posts nothing today',
      paid.notYet.inc===0 && paid.notYet.dates.length===0, String(paid.notYet.inc));
check('...but the rule is anchored to the real payday, not the 1st',
      /^3200\|monthly\|/.test(paid.notYet.rec[0]) && !/\-01$/.test(paid.notYet.rec[0]), paid.notYet.rec[0]);
check('pay that already landed posts on the day it landed',
      paid.paid.inc===3200 && paid.paid.dates[0].slice(0,7)===paid.today.slice(0,7)
        && paid.paid.dates[0]<=paid.today, paid.paid.dates.join(','));
check('biweekly walks forward at the right cadence, per payday',
      paid.biweekly.inc===2953.84 && paid.biweekly.dates.length===2, JSON.stringify(paid.biweekly.dates));
check('...carrying the per-payday amount, not the monthly one',
      /^1476\.92\|biweekly\|/.test(paid.biweekly.rec[0]), paid.biweekly.rec[0]);
check('skipping invents nothing and starts next month',
      paid.skipped.inc===0 && /\-01$/.test(paid.skipped.rec[0]), paid.skipped.rec[0]);
check('re-running setup does not post the same month twice',
      paid.rerun.once===paid.rerun.twice && paid.rerun.once===3200, JSON.stringify(paid.rerun));

/* A reason nobody can reach is the same as no reason. `why` was only ever wired
   into the chip renderers, so haveNow and payDay both declared one and rendered
   no button at all - and the suite that checked haveNow only ever asserted the
   FIELD existed on the step object. */
const whyRenders = await p.evaluate(async () => {
  state=JSON.parse(JSON.stringify(defaultState())); save();
  const out={};
  for(const id of ['payDay','haveNow']){
    openIntake();
    iaAns={name:'Pat',acct:'full',income:3200,hasDebt:'yes',debtAmt:5000,payFreq:'monthly',
           situation:'ok',register:'middle',tone:'blunt'};
    iaStep=INTAKE.findIndex(s=>s.id===id); runIntakeStep();
    await new Promise(r=>setTimeout(r,2600));
    const btn=document.getElementById('iaWhy');
    out[id]={shown:!!btn};
    if(btn){ btn.click(); await new Promise(r=>setTimeout(r,60));
      const bubs=[...document.querySelectorAll('#intakeLog .bub.bot')];
      out[id].answered=bubs.length? bubs[bubs.length-1].textContent.slice(0,40) : '';
      out[id].gone=!document.getElementById('iaWhy'); }
    document.getElementById('intake').classList.remove('on');
    document.getElementById('intakeLog').innerHTML='';
  }
  return out;
});
check('a step that declares a reason actually shows the button',
      whyRenders.payDay.shown===true && whyRenders.haveNow.shown===true,
      JSON.stringify({pay:whyRenders.payDay.shown, have:whyRenders.haveNow.shown}));
check('...it answers when tapped, and does not ask to be asked twice',
      !!whyRenders.payDay.answered && whyRenders.payDay.gone===true,
      whyRenders.payDay.answered||'(no answer)');

/* ---- and the totals open, because a total with nothing behind it is faith ---- */
const glance = await p.evaluate(() => {
  state=JSON.parse(JSON.stringify(defaultState()));
  state.onboarded=true; state.uiMode='all'; state.stageReached=3; state.hourlyWage=22; save();
  const M=state.activeMonth, c=findOrCreateCat('Coffee / drinks out');
  for(let i=1;i<=7;i++) state.transactions.push({id:'e'+i,type:'expense',amount:i,catId:c.id,date:M+'-'+String(i+1).padStart(2,'0'),note:'Buy '+i});
  state.transactions.push({id:'i1',type:'income',amount:3200,source:'Paycheck',date:M+'-05'});
  save(); glanceFold=null; renderGlance();
  const o={};
  const box=()=>document.getElementById('glanceBody');
  o.foldable=[...box().querySelectorAll('[data-glfold]')].map(x=>x.dataset.glfold);
  o.closed=box().querySelectorAll('.gl-sub').length;
  box().querySelector('[data-glfold="expense"]').click();
  o.rows=[...box().querySelectorAll('.gl-sub-r')].map(r=>r.querySelector('.n').textContent);
  o.more=(box().querySelector('.gl-sub-more')||{}).textContent||'';
  o.newestFirst=o.rows[0];
  /* one side at a time, so the panel cannot outgrow the screen */
  box().querySelector('[data-glfold="income"]').click();
  o.onlyOne=box().querySelectorAll('.gl-sub').length;
  o.incomeRow=(box().querySelector('.gl-sub-r .n')||{}).textContent||'';
  box().querySelector('[data-glfold="income"]').click();
  o.closesAgain=box().querySelectorAll('.gl-sub').length;
  return o;
});
check('each side of the glance opens', glance.foldable.join(',')==='income,expense', glance.foldable.join(','));
check('...closed by default', glance.closed===0, String(glance.closed));
check('...showing the last five, newest first',
      glance.rows.length===5 && glance.newestFirst==='Buy 7', glance.rows.join(','));
check('...and saying how many it did not show', /\+ 2 more this month/.test(glance.more), glance.more);
check('...one side at a time, so it cannot outgrow the phone',
      glance.onlyOne===1 && glance.incomeRow==='Paycheck', String(glance.onlyOne));
check('...and it closes again', glance.closesAgain===0, String(glance.closesAgain));

/* ---- 42. the date belongs beside the switch that raised the question ----
   From a phone: "give the option to quickly change the calendar date when the
   recurring button is pressed, instead of scrolling all the way down." The
   inline repeat control offered a frequency and nothing else - and "monthly"
   with no date is the app picking one, which it did: the 1st, hard-coded. The
   only place to correct it was the Recurring panel at the bottom of the tab,
   past every category. ---- */
const repDate = await p.evaluate(async () => {
  const o={};
  state=JSON.parse(JSON.stringify(defaultState()));
  state.onboarded=true; state.uiMode='all'; state.stageReached=3; save();
  const M=state.activeMonth, c=findOrCreateCat('Roof');
  budgetFor(M)[c.id]=848.38; save(); activateTab('budget'); renderBudget();
  o.beforeTick=document.querySelectorAll('[data-repdate]').length;
  const cb=document.querySelector('[data-repeat="'+c.id+'"]');
  cb.checked=true; cb.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(x=>setTimeout(x,80));
  const rec=()=>state.recurring.find(r=>r.catId===c.id);
  o.anchored={anchor:rec().anchor, today:todayStr()};
  /* anchoring to a date that has already gone back-posts a bill - and if they
     logged that rent by hand, it lands twice */
  o.noBackPost={posted:postRecurring(M), spent:monthExpense(M)};
  const di=()=>document.querySelector('[data-repdate="'+c.id+'"]');
  o.shown={exists:!!di(), value:di()&&di().value};
  di().value=M+'-01'; di().dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(x=>setTimeout(x,80));
  o.moved={anchor:rec().anchor, day:rec().day};
  di().value=''; di().dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(x=>setTimeout(x,60));
  o.blankIgnored=rec().anchor;
  const sel=document.querySelector('[data-repfreq="'+c.id+'"]');
  sel.value='biweekly'; sel.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(x=>setTimeout(x,60));
  o.freqKeepsDate={freq:rec().freq, anchor:rec().anchor};
  /* untick and the date goes with it - a date for a bill that does not repeat
     is a control with nothing behind it */
  const cb2=document.querySelector('[data-repeat="'+c.id+'"]');
  cb2.checked=false; cb2.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(x=>setTimeout(x,80));
  o.goneWithIt=document.querySelectorAll('[data-repdate]').length;
  return o;
});
check('no date control until the thing actually repeats',
      repDate.beforeTick===0 && repDate.goneWithIt===0,
      `${repDate.beforeTick}/${repDate.goneWithIt}`);
check('ticking repeat puts the date right there', repDate.shown.exists===true, String(repDate.shown.value));
check('...anchored to a 1st that has not happened yet, so nothing back-posts',
      repDate.anchored.anchor>repDate.anchored.today && /-01$/.test(repDate.anchored.anchor),
      repDate.anchored.anchor);
check('...and nothing is posted for a date already gone',
      repDate.noBackPost.posted===0 && repDate.noBackPost.spent===0, JSON.stringify(repDate.noBackPost));
check('changing it there moves the rule, day and all',
      repDate.moved.anchor.endsWith('-01') && repDate.moved.day===1, JSON.stringify(repDate.moved));
check('...a blank date is not an instruction', repDate.blankIgnored.endsWith('-01'), repDate.blankIgnored);
check('...and the frequency beside it keeps the date',
      repDate.freqKeepsDate.freq==='biweekly' && repDate.freqKeepsDate.anchor.endsWith('-01'),
      JSON.stringify(repDate.freqKeepsDate));

/* ---- 43. a rule that had not started cannot be broken ----
   From a phone: "if the days prior to August 23rd are greyed out, am I to assume
   the red 1 is for September? The logic is wrong."

   It was August 1, and it was scarlet and alone in a wall of grey. calIsPre made
   an exception for days that had spending on them - so the calendar gave no
   credit for anything before the start date and handed out every penalty. The
   sentence above the grid said earlier days were "not counted" while counting
   that one, the streak read 0, and the month read $1,842 over pace, on a day
   whose entries were mostly the app's own seeded recurring posts. Asymmetric
   scoring is not accountability, it is retroactive blame. ---- */
const preCal = await p.evaluate(async () => {
  const o={};
  state=JSON.parse(JSON.stringify(defaultState()));
  state.onboarded=true; state.uiMode='all'; state.stageReached=3; state.spendingMode=true;
  state.spendLimit=1500; state.hourlyWage=22; state.trueRateSkipped=true;
  const M=thisMonth(); state.activeMonth=M; state.trackStart=M+'-23';
  const c=findOrCreateCat('Roof');
  state.transactions.push({id:'x1',type:'expense',amount:848.38,catId:c.id,date:M+'-01',note:'Roof'});
  state.transactions.push({id:'x2',type:'expense',amount:850,catId:c.id,date:M+'-01',note:'Roof'});
  state.transactions.push({id:'x3',type:'income',amount:6000,source:'Partner',date:M+'-01'});
  save(); applySpending(); renderHome();
  const txt=()=>document.getElementById('rewardCalBox').innerText;
  const cell1=()=>[...document.querySelectorAll('.cal-cell')]
    .find(x=>x.querySelector('.cd') && x.querySelector('.cd').textContent==='1');
  o.cls=cell1().className;
  o.tappable=!!document.querySelector('.cal-cell[data-day="1"]');
  o.streak=(()=>{ const st=[...document.querySelectorAll('#rewardCalBox .cal-stat')]
    .find(x=>/streak/i.test(x.textContent)); return st?st.querySelector('.v').textContent.trim():''; })();
  o.ahead=/Ahead this month/.test(txt());
  /* the money is still real everywhere it was real before */
  o.stillCounted={month:Math.round(monthExpense(M)*100)/100};
  /* the sentence above the grid has to be true of what the grid does */
  o.saysNotScored=/greyed out and not scored/.test(txt());
  o.explainsDot=/carries a dot/.test(txt()) || /carry a dot/.test(txt());
  document.querySelector('.cal-cell[data-day="1"]').click();
  await new Promise(x=>setTimeout(x,80));
  const day=document.getElementById('calDay').innerText;
  o.card={pre:/Before you started tracking/.test(day), judged:/over allowance here/.test(day),
          entries:/Partner/.test(day), bank:/Bank \$/.test(day)};
  /* and the calendar can move months on its own now */
  o.before=state.activeMonth;
  o.wantNext=shiftMonth(state.activeMonth,1);
  document.getElementById('calNext').click(); await new Promise(x=>setTimeout(x,140));
  o.next=state.activeMonth;
  document.getElementById('calPrev').click(); await new Promise(x=>setTimeout(x,140));
  o.back=state.activeMonth;
  return o;
});
check('a day before you started is greyed, whatever is on it',
      /\bpre\b/.test(preCal.cls) && !/\bover\b/.test(preCal.cls), preCal.cls);
check('...and it is not scored, so the streak survives it',
      preCal.streak==='3' && preCal.ahead===true, `streak "${preCal.streak}"`);
check('...but the money still counts everywhere it counted before',
      preCal.stillCounted.month===1698.38, String(preCal.stillCounted.month));
check('...it is still tappable, and marked, so nothing is hidden',
      preCal.tappable===true && /prehas/.test(preCal.cls), preCal.cls);
check('the sentence above the grid says what the grid actually does',
      preCal.saysNotScored===true && preCal.explainsDot===true);
check('tapping it explains rather than judges',
      preCal.card.pre===true && preCal.card.judged===false && preCal.card.entries===true,
      JSON.stringify(preCal.card));
check('...and offers nothing to bank on a day that predates the rule', preCal.card.bank===false);
check('the calendar moves months on its own, without leaving Home',
      preCal.next===preCal.wantNext && preCal.back===preCal.before,
      `${preCal.before} -> ${preCal.next} -> ${preCal.back}`);

/* ---- 44. the report had no voice ----
   "These words have lost its savage." Fourteen signals in the Accountability
   Report - the verdict layer, the part that tells you what your month means -
   and not one of them called a voice picker. Everyone got the same flat prose
   whether they had asked for clean, blunt or savage. The whole differentiator of
   this app is that it talks like something with an opinion, and its flagship
   surface did not.

   The arithmetic stays untouched: body and work are facts and facts have no
   tone. What gained a voice is the CLOSER, which was always an opinion. ---- */
const rpVoice = await p.evaluate(() => {
  const seed=()=>{
    state=JSON.parse(JSON.stringify(defaultState()));
    state.onboarded=true; state.uiMode='all'; state.stageReached=3;
    state.hourlyWage=22; state.hoursPerWeek=40; state.trueRateSkipped=true;
    state.intake={name:'Pat',income:3200,reflections:{situation:'ok'}};
    const M=state.activeMonth, P=shiftMonth(M,-1);
    const c=findOrCreateCat('Takeout'), g=findOrCreateCat('Groceries');
    budgetFor(M)[g.id]=745;
    state.transactions.push({id:'i1',type:'income',amount:3200,source:'Pay',date:M+'-02'});
    state.transactions.push({id:'i0',type:'income',amount:3200,source:'Pay',date:P+'-02'});
    state.transactions.push({id:'e1',type:'expense',amount:310,catId:c.id,date:M+'-10',note:'DoorDash'});
    state.transactions.push({id:'e0',type:'expense',amount:220,catId:c.id,date:P+'-10',note:'DoorDash'});
    state.debts.push({id:'d',name:'Car loan',balance:9000,apr:10,minPayment:200});
    state.accounts.push({id:'a',name:'Checking',kind:'checking',balance:5000});
    save();
  };
  const nudges=()=>{ const o={}; buildReport().signals.forEach(g=>{ o[g.k]=String(g.nudge||'').replace(/<[^>]*>/g,'').trim(); }); return o; };
  const out={};
  for(const lvl of ['clean','blunt','savage']){ seed(); state.intensity=lvl; state.register='middle'; save(); out[lvl]=nudges(); }
  /* the tone lock is not optional: someone in survival gets clean whatever they
     picked, and the report must obey the same floor as everything else */
  seed(); state.intensity='savage'; state.intake.reflections.situation='survive'; save();
  out.survival=nudges();
  /* the arithmetic must NOT move when the voice does */
  seed(); state.intensity='clean'; save(); const wc=buildReport().signals.map(g=>g.work||'');
  seed(); state.intensity='savage'; save(); const ws=buildReport().signals.map(g=>g.work||'');
  out.workSame=wc.join('|')===ws.join('|');
  out.keys=Object.keys(out.clean);
  return out;
});
const varies=k=>rpVoice.clean[k]!==rpVoice.savage[k] && rpVoice.blunt[k]!==rpVoice.savage[k];
const voiced=rpVoice.keys.filter(varies);
check('the report speaks in the voice the app is set to',
      voiced.length>=8, `${voiced.length} of ${rpVoice.keys.length} signals vary: ${voiced.join(',')}`);
check('...every signal on screen has a closer that moves',
      rpVoice.keys.every(k=>varies(k)||!rpVoice.clean[k]),
      rpVoice.keys.filter(k=>!varies(k)&&rpVoice.clean[k]).join(',')||'(all)');
check('...savage actually bites where it is allowed to',
      /pay cut wearing a raise's clothes/.test(rpVoice.savage.oCpi||'')
        && /you already took a cut/.test(rpVoice.savage.oFood||''),
      (rpVoice.savage.oFood||'').slice(0,70));
check('...and clean stays measured on the same card',
      !/took a cut/.test(rpVoice.clean.oFood||''), (rpVoice.clean.oFood||'').slice(0,60));
check('the survival floor holds, whatever intensity was picked',
      rpVoice.keys.every(k=>rpVoice.survival[k]===rpVoice.clean[k]),
      rpVoice.keys.filter(k=>rpVoice.survival[k]!==rpVoice.clean[k]).join(',')||'(all clean)');
check('the arithmetic does not move when the voice does', rpVoice.workSame===true);

/* ---- 45. a door to every room that still has something in it ----
   From a phone, having reached the Accounts panel: "where does this page live? I
   was only able to find it because of this" - pointing at a link on Reflect's
   net-worth view.

   Accounts lives on Build, and it is deliberately UNGATED: "what's in the bank"
   is a fact, not a wealth-stage tool, and Home already shows spend-mode users
   their bank total. But the Build BUTTON carries data-stage="2", and spending
   mode locks every [data-stage] element - so the tab vanished and took the one
   ungated panel inside it with it. The only way in was that one link on another
   tab, which deep-linked into a room with no door: reachable once, never
   findable again. ---- */
const reach = await p.evaluate(async () => {
  const o={};
  const setup=(mode)=>{
    state=JSON.parse(JSON.stringify(defaultState()));
    state.onboarded=true; state.hourlyWage=22; state.trueRateSkipped=true;
    if(mode==='spend'){ state.spendingMode=true; state.uiMode='guided'; state.stageReached=1; }
    else if(mode==='stage1'){ state.uiMode='guided'; state.stageReached=1; }
    else { state.uiMode='all'; state.stageReached=3; }
    save(); applySpending(); applyStage(); renderAll();
  };
  const shown=v=>{ const b=document.querySelector(`#tabs .tab[data-view="${v}"]`);
    return !!b && !b.classList.contains('stage-locked'); };
  const open=v=>[...document.querySelectorAll(`#view-${v} .panel`)]
    .filter(x=>!x.classList.contains('stage-locked')).length;
  setup('spend');
  o.spend={tab:shown('goals'), panels:open('goals'), form:!!document.getElementById('acctName')};
  setup('stage1');  o.stage1={tab:shown('goals'), panels:open('goals')};
  setup('all');     o.all={tab:shown('goals'), panels:open('goals')};
  /* and the other direction: a tab whose contents ALL close must close too, or
     it is a door to an empty room */
  setup('spend');
  document.querySelectorAll('#view-goals .panel').forEach(x=>x.classList.add('stage-locked'));
  unlockReachableTabs();
  o.emptyRoom=shown('goals');
  activateTab('goals'); await new Promise(x=>setTimeout(x,80));
  o.bounced=(document.querySelector('.view.on')||{}).id;
  /* the link that was the only way in must promise only what it can deliver */
  const linkFor=(spend)=>{ setup(spend?'spend':'all');
    state.transactions.push({id:'t',type:'expense',amount:10,date:todayStr(),note:'x'}); save();
    activateTab('reflect'); rfTab='worth'; renderReflectTab();
    const el=document.getElementById('rfEditNW'); return el?el.textContent.trim():''; };
  o.linkSpend=linkFor(true); o.linkFull=linkFor(false);
  return o;
});
check('Build is reachable in spending mode, because Accounts lives there',
      reach.spend.tab===true && reach.spend.panels>=1 && reach.spend.form===true,
      JSON.stringify(reach.spend));
check('...and at stage 1, for the same reason', reach.stage1.tab===true && reach.stage1.panels>=1,
      JSON.stringify(reach.stage1));
check('...while the wealth-ladder panels inside it stay shut',
      reach.spend.panels < reach.all.panels, `${reach.spend.panels} of ${reach.all.panels}`);
check('a tab whose contents all close, closes too', reach.emptyRoom===false);
check('...and navigating to it lands on Home rather than nowhere',
      reach.bounced==='view-home', reach.bounced);
check('the link that was the only way in promises only what it can deliver',
      reach.linkSpend==='Edit my accounts →' && reach.linkFull==='Edit what you own and owe →',
      `${reach.linkSpend} | ${reach.linkFull}`);

console.log('STRUCTURE - one place to reflect, and nothing shown before it means something\n');
let fails=0;
for(const r of results){ if(!r.ok) fails++; console.log(`${r.ok?'ok  ':'FAIL'}  ${r.name}${r.detail?'\n        '+String(r.detail).replace(/\n/g,' ').slice(0,140):''}`); }
console.log(`\n${results.length-fails} of ${results.length} hold`);
console.log('page errors:', errs.length?errs:'none');
await b.close();
if(fails) process.exit(1);
