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
import { writeFileSync, readFileSync } from 'node:fs';

const results=[]; const check=(name,ok,detail='')=>results.push({ok,name,detail});
const VIEWS=['home','budget','tx','impulse','debt','goals','reflect','learn','diary','settings'];

/* ---------- the clock this suite runs in ----------
   Almost every fixture below is dated August 2026. That was deterministic right
   up until the calendar reached September, when twenty-four checks went red in
   one night without a line of app code changing: fixtures pinned to a month,
   compared against a clock that had moved on. Three separate date bombs had
   already been patched one at a time before it became obvious they were all the
   same bug wearing different clothes.

   So the page gets a clock. The fixtures declare the month they mean and the
   browser is told the same thing, which is the only arrangement where a fixture
   and the app can agree. Time still FLOWS - only the origin moves - so timers,
   animations and the app's own setTimeout waits behave normally.

   The important consequence, and the reason this is better than shifting every
   fixture forward: a date boundary is now something you can TEST rather than
   something that happens to you. Pointing this at the 1st, the 31st, or a leap
   day is one line, instead of waiting for the calendar to do it and calling the
   fallout a regression. Mid-month is the default because that is where the
   fixtures live and where nothing is a boundary. */
/* The 30th, not mid-month: the fixtures below reach as far as day 31, so an
   earlier clock would put a third of them in the future and the calendar would
   clamp away the days they select. The 30th leaves day 31 in the future, which
   the "still to come" checks need, while everything up to it has happened. */
const CLOCK = new Date('2026-08-30T10:30:00').getTime();
/* Node has to read the same clock, or a fixture built here disagrees with the
   page it is handed to - which is the original bug, reintroduced from the other
   side. Everything below that used to say `new Date()` in NODE says this. */
const CLOCK_D=(()=>{ const d=new Date(CLOCK);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
const CLOCK_M=CLOCK_D.slice(0,7);
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{width:390,height:1000} });
/* A subclass rather than a Proxy: the first attempt wrapped Date in a Proxy and
   the app would not boot at all - `state` never initialised, because something
   inside load() threw on it before the first line of the suite ran. Extending
   Date keeps instanceof, the prototype chain and the inherited statics (parse,
   UTC) exactly as the platform made them, and only the no-argument constructor
   and now() are moved. */
await p.addInitScript(target => {
  const Real = Date, offset = target - Real.now();
  class Shifted extends Real {
    constructor(...args){ if(args.length===0) super(Real.now()+offset); else super(...args); }
    static now(){ return Real.now()+offset; }
  }
  window.Date = Shifted;
}, CLOCK);
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
/* "Borrow it or wait for it" is in this view but is NOT a payoff panel, and it
   deliberately gates on something else: unused ROOM on a line. Someone with
   three loans and no line has nothing for it to price, and someone with an
   untouched HELOC and no other debt is exactly who it was built for. Sweeping
   it into "every panel here reopens when a debt exists" would have quietly
   demanded the wrong gate and lost the distinction. */
/* Two panels in this view are not payoff panels and gate on their own data:
   "Borrow it or wait for it" on unused room, and "The other direction" on a
   dream worth saving for. Sweeping either into "every panel here reopens when a
   debt exists" would demand the wrong gate and quietly delete the distinction,
   so both are named out and both are asserted separately below. */
const PAYOFF_PANELS=x=>!/Borrow it or wait|The other direction/.test(x.h||'');
/* On a day carrying both, what arrived should be read before what left it. */
function calOccOrderOk(rows){
  const by={};
  rows.forEach(r=>{ const [d,,t]=r.split('|'); (by[d]=by[d]||[]).push(t); });
  return Object.values(by).every(ts=>{
    const rank=t=>t==='income'?0:t==='invest'?1:2;
    return ts.every((t,i)=>i===0||rank(ts[i-1])<=rank(t));
  });
}
check('adding a debt reopens the payoff panels', reopened.filter(PAYOFF_PANELS).every(x=>!x.waiting),
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
  /* The Plan list is a line per category now, so the control that has to step
     aside is the leaf row's assign field rather than the old card's. */
  assignFrozen:(()=>{ const e=document.querySelector('.subrow.reordering .sub-assign');
    return e ? getComputedStyle(e).display==='none' : false; })(),
  /* the browser must not claim the gesture as a page scroll, or a drag on a
     phone just scrolls the list and nothing ever moves */
  touchAction:getComputedStyle(document.querySelector('#cats .cat-grip')).touchAction,
  labelled:[...document.querySelectorAll('#cats .cat-grip')].every(g=>/arrow keys/i.test(g.getAttribute('aria-label')||'')),
  realNames:state.categories.map(c=>c.name),
  subNames:[...document.querySelectorAll('.subrow.reordering .sub-name')]
    .map(e=>({full:e.textContent.trim(), w:e.getBoundingClientRect().width,
              clipped:e.scrollWidth>e.clientWidth+1}))
}));
check('turning it on puts a grip on every row', inMode.grips>0 && inMode.grips===inMode.rows,
      `${inMode.grips} grips / ${inMode.rows} rows`);
check('...the grip owns the gesture rather than the page scroller', inMode.touchAction==='none', inMode.touchAction);
check('...and the editing controls step aside while you move things', inMode.assignFrozen===true);
/* "Fun" and "Roof" are three and four letters and always were. The old floor of
   four characters worked only because this list showed subcategories alone; now
   that every leaf is a row, a real name would fail it. Clipping is the fault -
   measure that. */
/* Every row now leads with an emoji, so the rendered text is "\u{1F389}Fun" where
   the stored name is "Fun". The claim here is that the NAME survives at that
   width - so the face is stripped alongside the trailing repeat glyph rather
   than the check being loosened to a substring match, which would have stopped
   noticing truncation entirely. */
const bareName=t=>t.replace(/^[^\p{L}\p{N}$]+/u,'').replace(/[\u21bb\s]+$/,'').trim();
check('...leaving the names readable, not truncated to one letter',
      inMode.subNames.length>0 && inMode.subNames.every(n=>!n.clipped && inMode.realNames.includes(bareName(n.full))),
      inMode.subNames.map(n=>`"${n.full}" ${Math.round(n.w)}px${n.clipped?' CLIPPED':''}`).join(' | '));

/* Roof is third. Drag it above the first card. */
const firstCard = await centre('#cats [data-row]');
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

/* picking a row up and putting it back must not renumber anything.
   Addressed by what the row IS rather than where it sits: this was
   ':nth-of-type(2)' until the plan list grew a Planned/Spent/Remaining toggle
   above it, at which point the second div of that type was the toggle and the
   selector matched nothing. A positional selector in a test is a claim about
   layout that the test does not mean to make. */
const settled = await p.evaluate(()=>topCats().map(c=>c.name));
const anyGrip = await p.evaluate(()=>{
  const g=document.querySelector('#cats [data-row] [data-grip]');
  return g ? '[data-grip="'+g.dataset.grip+'"]' : null;
});
check('there is a row to pick up and put back', !!anyGrip, String(anyGrip));
const backGrip = await centre(anyGrip);
await dragTo(anyGrip, backGrip.y+3);
const unchanged = await p.evaluate(()=>topCats().map(c=>c.name));
check('a drag that goes nowhere changes nothing', unchanged.join(',')===settled.join(','),
      `${settled.join(',')} -> ${unchanged.join(',')}`);

/* a drag you cannot abandon is a drag you hesitate to start */
const beforeEsc = await p.evaluate(()=>topCats().map(c=>c.name));
const lastCard = await centre('#cats [data-row]:last-child');
await dragTo('#cats [data-row]:last-child .cat-grip', lastCard.top-400, {cancel:true});
const afterEsc = await p.evaluate(()=>({tops:topCats().map(c=>c.name),
  strays:document.querySelectorAll('.drag-ghost,.drag-line,.drag-src').length}));
check('Escape abandons a drag and puts the row back',
      afterEsc.tops.join(',')===beforeEsc.join(','), `${beforeEsc.join(',')} -> ${afterEsc.tops.join(',')}`);
check('...and clears the ghost with it', afterEsc.strays===0, String(afterEsc.strays));

/* drag is the preferred way, not the only way - the grip is still a button */
const kb = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const before=topCats().map(c=>c.name);
  const g=document.querySelector('#cats [data-row] .cat-grip'); g.focus();
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
  /* The repeat switch moved off the row and into the category's own sheet when
     the Plan list was cut back to a line each. Eleven toggles on one screen, none
     of them explained, was the thing that made the scroll unreadable. The rule it
     obeys has not changed - every leaf has one, no group does - so the test opens
     each category instead of scanning the list. */
  const open=id=>{ openCatSheet(id); };
  const has=id=>{ open(id); return !!document.querySelector('#catSheetBody [data-repeat="'+id+'"]'); };
  const boxes=['roof','elec','net','fun'].filter(has).length;
  const onGroup=has('pow');
  const click=id=>{ open(id); const c=document.querySelector('#catSheetBody [data-repeat="'+id+'"]'); c.checked=!c.checked; c.dispatchEvent(new Event('change',{bubbles:true})); };
  click('roof'); await wait(200);
  const afterTick=(state.recurring||[]).map(r=>({cat:r.catId, amt:r.amount, freq:r.freq}));
  open('roof');
  const freqOpts=[...document.querySelectorAll('#catSheetBody [data-repfreq="roof"] option')].map(o=>o.value);
  const sel=document.querySelector('#catSheetBody [data-repfreq="roof"]'); sel.value='quarterly';
  sel.dispatchEvent(new Event('change',{bubbles:true})); await wait(200);
  const afterFreq=(state.recurring||[]).map(r=>r.freq);
  click('elec'); await wait(200);
  const withSub=(state.recurring||[]).length;
  // a zero-amount category cannot repeat nothing
  click('fun'); await wait(250);
  const zeroRefused=(state.recurring||[]).every(r=>r.catId!=='fun');
  const zeroUnticked=!document.querySelector('#catSheetBody [data-repeat="fun"]').checked;
  click('elec'); await wait(200);
  const afterUntick=(state.recurring||[]).length;
  // names stay readable on the list itself, with the sheet out of the way
  closeCatSheet(); renderBudget(); await wait(150);
  const names=[...document.querySelectorAll('#cats .sub-name')].map(e=>({n:e.textContent.trim(), clipped:e.scrollWidth>e.clientWidth+1}));
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
      rep.names.length>0 && rep.names.every(n=>!n.clipped && n.n.replace(/[\u21bb\s]+$/,'').length>=3),
      rep.names.map(n=>`"${n.n}"${n.clipped?' CLIPPED':''}`).join(' | '));

/* it has to survive a reload and agree with the Recurring panel */
await p.reload(); await p.waitForTimeout(900);
const persistRep = await p.evaluate(async () => {
  await new Promise(r=>setTimeout(r,150)); activateTab('budget');
  await new Promise(r=>setTimeout(r,250));
  openCatSheet('roof');
  const t=document.querySelector('#catSheetBody [data-repeat="roof"]');
  const out={ n:(state.recurring||[]).length, freq:(state.recurring[0]||{}).freq,
              ticked:!!(t&&t.checked),
              panel:(document.getElementById('recList')||{}).innerText||'' };
  closeCatSheet();
  return out;
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
  /* The pencil moved into each category's sheet along with everything else that
     is not a name, a number and what is left. What must not change is that it
     exists at EVERY level - the original bug was that only top-level categories
     had one, so fixing a typo in a subcategory meant deleting it and taking its
     transactions' category with it. */
  const pencilFor=id=>{ openCatSheet(id); return document.querySelectorAll('#catSheetTitle .cat-edit').length; };
  const pencils=['groc','w'].filter(id=>pencilFor(id)===1).length;
  openCatSheet('groc');
  document.querySelector('#catSheetTitle [data-editcat="groc"]').click(); await wait(220);
  const field=!!document.querySelector('#catSheetBody input[data-rename="groc"]');
  const cleared=!!document.querySelector('#catSheetBody .cs-rename');
  document.querySelector('#catSheetBody input[data-rename="groc"]').value='Groceries';
  document.querySelector('#catSheetBody [data-renamesave="groc"]').click(); await wait(220);
  // a third-level sub renames too, and Enter commits it
  openCatSheet('w');
  document.querySelector('#catSheetTitle [data-editcat="w"]').click(); await wait(220);
  const i3=document.querySelector('#catSheetBody input[data-rename="w"]'); i3.value='Walmart Supercenter';
  i3.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); await wait(220);
  closeCatSheet();
  return { pencils, field, cleared, names:state.categories.map(c=>c.name),
           txKept:state.transactions.filter(t=>t.catId==='groc').length,
           assignKept:(state.budgets['2026-08']||{}).groc };
});
check('a subcategory can be renamed, not only deleted', rename.pencils===2 && rename.field && rename.cleared,
      `${rename.pencils} of 2 levels carry a pencil, field ${rename.field}`);
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
  /* The row carries the shortest true version of it and the sheet carries the
     sentence. Both have to say it - a plan that shows a retirement contribution
     as spending is the fault this tag exists to prevent. */
  const tags=[...document.querySelectorAll('#cats .growth-tag')].map(e=>e.textContent.trim());
  openCatSheet('inv');
  const sheetSays=(document.getElementById('catSheetBody')||{}).innerText||'';
  closeCatSheet();
  activateTab('tx'); await wait(300);
  const sel=document.getElementById('txCat');
  document.querySelector('#typeToggle button[data-t="expense"]').click(); await wait(120);
  sel.value='food'; sel.dispatchEvent(new Event('change',{bubbles:true})); await wait(160);
  const afterOrdinary=txType;
  sel.value='inv'; sel.dispatchEvent(new Event('change',{bubbles:true})); await wait(220);
  return { tags, sheetSays, afterOrdinary, afterGrowth:txType,
           kinds:['invest','save','debt'].map(k=>growthKindFor(k==='invest'?'Investing / retirement':k==='save'?'Savings':'Extra debt payments')) };
});
check('money that is invested is not shown as money spent',
      growth.tags.length===1 && /not spent/i.test(growth.tags[0]) && /Invested, not spent/i.test(growth.sheetSays),
      growth.tags.join(',')+' | sheet: '+/Invested, not spent/i.test(growth.sheetSays));
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
  /* The ledger row is one line now - when, what, how much - so "posted
     automatically" has no second line to move to. It is a mark on the row and a
     sentence in the entry's sheet instead. Same property: a posted bill says so,
     and one somebody typed by hand does not. */
  const marks=[...document.querySelectorAll('#txList .tx')].map(r=>({
    id:r.dataset.txsheet, rep:!!r.querySelector('.tx-rep') }));
  openTxSheet('t1'); const sheetSaysRepeat=/repeat/i.test(document.getElementById('txSheetBody').innerText);
  openTxSheet('t6'); const handTypedSaysRepeat=/repeat/i.test(document.getElementById('txSheetBody').innerText);
  closeTxSheet();
  return { t1:byId('t1').note, t2:byId('t2').note, t4:byId('t4').note, t5:byId('t5').note,
           t6:byId('t6').note, recent, marks, sheetSaysRepeat, handTypedSaysRepeat,
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
check('...and "posted automatically" is marked on the row and said in the sheet',
      named.marks.some(m=>m.rep) && named.marks.some(m=>!m.rep)
      && named.sheetSaysRepeat===true && named.handTypedSaysRepeat===false,
      JSON.stringify({marked:named.marks.filter(m=>m.rep).length, of:named.marks.length,
                      sheet:named.sheetSaysRepeat, handTyped:named.handTypedSaysRepeat}));

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
  /* The kind is the first field now and is required: it decides which of the
     others are even shown, so a debt added without it would be a debt the form
     could not have asked about properly. */
  const ks=document.getElementById('debtKindSel');
  ks.value='card'; ks.dispatchEvent(new Event('change',{bubbles:true})); await wait(200);
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
  /* The welcome gate now stands in front of the first question. Accept it the
     way a person would, then carry on - this section is about what the chat asks
     FIRST, and "first" now means first after the door. */
  const w=document.getElementById('iaWelGo');
  if(w){ w.click(); await new Promise(r=>setTimeout(r,600)); }
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
  const ks2=document.getElementById('debtKindSel');
  ks2.value='card'; ks2.dispatchEvent(new Event('change',{bubbles:true})); await wait(200);
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
/* The property is that neither side is CROWNED and the copy says so - not that
   one particular sentence survives. The wording moved when this verdict gained a
   voice, and an assertion pinned to one phrasing would have blocked that for no
   reason. It has to hold at every intensity, which is the real guarantee. */
check('a result that hinges on the rate is called a tie, not a win',
      iv.wins===0 && /\btie\b/i.test(iv.verdict), `${iv.wins} winners · ${iv.verdict.slice(0,60)}`);

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
  /* Tracking starts two months back so the calendar can be walked into a
     finished month - on the 1st of a month, that is the only month holding a
     day that is not today. */
  state.activeMonth=thisMonth(); state.trackStart=shiftMonth(thisMonth(),-2)+'-01';
  save(); applySpending(); renderHome();
  const cal=()=>document.getElementById('rewardCalBox');
  const btns=()=>[...cal().querySelectorAll('[data-callog]')].map(b=>({d:b.dataset.callog,t:b.textContent.trim()}));
  const onCal=btns();
  const zeroNote=/only counts if it is true/.test(cal().innerText);
  /* today already has its button in the pace strip - the day card must not add a
     second. Done first, and on the CURRENT month, because that is the only
     month that has a today. */
  const cells2=[...cal().querySelectorAll('.cal-cell[data-day]')];
  cells2[cells2.length-1].click(); await new Promise(r=>setTimeout(r,60));
  const todaySel=btns();
  /* A day that is not today has to carry its own date, or logging Saturday's
     coffee onto Monday quietly breaks the streak the calendar just drew.

     On the FIRST of a month the current calendar has exactly one day on it -
     today - so there is no day-that-is-not-today to tap, and this section used
     to crash outright on `#calDay [data-callog]` being null. It is the same
     property in a finished month, where every day is a day that is not today,
     so that is where it is exercised when today happens to be the 1st. The
     assertion never weakens; only the month it runs in moves. */
  const backMonth = new Date().getDate()>1 ? thisMonth() : shiftMonth(thisMonth(),-1);
  if(backMonth!==state.activeMonth){ state.activeMonth=backMonth; save(); renderRewardCalendar();
    await new Promise(r=>setTimeout(r,80)); }
  const cells=[...cal().querySelectorAll('.cal-cell[data-day]')];
  cells[0].click(); await new Promise(r=>setTimeout(r,60));
  const past=btns();
  const wantDate=backMonth+'-'+String(cells[0].dataset.day).padStart(2,'0');
  /* and the back-date button has to actually land on that day */
  document.querySelector('#calDay [data-callog]').click();
  await new Promise(r=>setTimeout(r,260));
  const landed={tab:(document.querySelector('.view.on')||{}).id, date:(document.getElementById('qlDate')||{}).value};
  /* the emptiest version of the screen - no limit, so no calendar - was also
     the one with no way out of being empty */
  quickLogOpen=false; renderQuickLog();
  state.activeMonth=thisMonth(); save();
  state.spendLimit=0; save(); renderRewardCalendar();
  const noLimit=btns().length;
  /* a month that is not the current one must not offer to log "today" into it */
  state.spendLimit=1500; state.activeMonth=shiftMonth(thisMonth(),-1); save(); renderRewardCalendar();
  const pastMonth=btns().filter(b=>b.d==='today').length;
  return {onCal, zeroNote, past, wantDate, todaySel, landed, noLimit, pastMonth};
});
/* Pinned to the exact words once, which blocked a correction: the button opens
   the quick log, and that takes money out, in AND put away, so "an expense" was
   narrower than the thing behind it. The property is that ONE button on the
   calendar opens today's log - not what it happens to be called. */
check('the reward calendar carries the one action the mode is for',
      callog.onCal.length===1 && callog.onCal[0].d==='today' && /\bLog\b/i.test(callog.onCal[0].t),
      callog.onCal.map(b=>b.t).join(' | '));
check('...and an unlogged zero says so rather than reading as a clean week', callog.zeroNote===true);
check('tapping an earlier day offers to log to THAT day',
      callog.past.some(b=>b.d===callog.wantDate), callog.past.map(b=>b.t).join(' | '));
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
  /* The panel opens on ONE line now rather than three - a wall of empty rows was
     the complaint. Extra lines come from the button, so the test presses it the
     way a person does, and records that one is where it starts. */
  o.rowsAtStart=document.querySelectorAll('.ql-row').length;
  document.getElementById('qlAdd').click(); document.getElementById('qlAdd').click();
  const rows=[...document.querySelectorAll('.ql-row')];
  o.rowsAfterAdd=rows.length;
  o.options=[...rows[0].querySelectorAll('.ql-cat option')].map(x=>x.value);
  const set=(row,what,amt,cat)=>{ row.querySelector('.ql-what').value=what;
    row.querySelector('.ql-amt').value=amt; row.querySelector('.ql-cat').value=cat; };
  set(rows[0],'Coffee','5','c1');
  set(rows[1],'Roth IRA','145','__invest');
  set(rows[2],'Side gig','200','__income');
  document.getElementById('qlSave').click();
  await new Promise(x=>setTimeout(x,120));
  o.written=state.transactions.map(t=>t.type+':'+t.amount+':'+(t.source||t.note)).sort();
  o.acctOnAll=state.transactions.every(t=>!state.accounts.length || !!t.acctId);
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
check('the quick log opens on one line and grows on request, not a wall of empty rows',
      put.rowsAtStart===1 && put.rowsAfterAdd===3, `${put.rowsAtStart} at start, ${put.rowsAfterAdd} after two presses`);
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
      /No cost replaced/.test(tool.want.tag) && /\bwant\b/.test(tool.want.body)
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
  /* the case from the phone: paid on the 29th, setting up before it.
     On the LAST day of a month there is no such thing as "later this month", so
     this construction is impossible one day in every thirty-one - which is
     exactly the day it went red, with no code change. The monthly case still
     runs whenever a future day-of-month exists, and o.futureExists says whether
     it did; alongside it, a payday anchored to tomorrow is genuinely in the
     future on every date in the calendar, so the property itself is asserted
     every single day rather than most of them. */
  const future=Math.min(dim, d+4);
  o.futureExists=future>d;
  o.notYet=run({payDay:shiftMonth(M,-1)+'-'+String(future).padStart(2,'0'), payFreq:'monthly'});
  o.tomorrow=run({payDay:shiftDays(today,1), payFreq:'biweekly', payAmt:1476.92});
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
check('a payday that has not arrived yet posts nothing',
      paid.tomorrow.inc===0 && paid.tomorrow.dates.length===0
        && (paid.futureExists ? (paid.notYet.inc===0 && paid.notYet.dates.length===0) : true)
        && paid.notYet.dates.every(dt=>dt<=paid.today),
      `tomorrow:${paid.tomorrow.inc} monthly:${paid.notYet.inc} (later-this-month possible today: ${paid.futureExists})`);
check('...but the rule is anchored to the real payday, not the 1st',
      /^3200\|monthly\|/.test(paid.notYet.rec[0]) && !/\-01$/.test(paid.notYet.rec[0]), paid.notYet.rec[0]);
check('pay that already landed posts on the day it landed',
      paid.paid.inc===3200 && paid.paid.dates[0].slice(0,7)===paid.today.slice(0,7)
        && paid.paid.dates[0]<=paid.today, paid.paid.dates.join(','));
/* This one used to assert "two paydays, $2,953.84". It broke by itself the
   morning today became a payday - a third date landed and the count was wrong
   without a line of the app changing. The claim in the name is cadence, so the
   check is cadence now: fourteen days apart, nothing posted into the future,
   and the money equal to the per-payday amount times however many landed. */
const bwD=paid.biweekly.dates;
const bwGap=(a,b)=>Math.round((Date.parse(a+'T00:00:00Z')-Date.parse(b+'T00:00:00Z'))/86400000);
check('biweekly walks forward at the right cadence, per payday',
      bwD.length>=2 && bwD.every((d,i)=>i===0||bwGap(d,bwD[i-1])===14)
        && bwD.every(d=>d<=paid.today)
        && Math.abs(paid.biweekly.inc-bwD.length*1476.92)<0.005,
      JSON.stringify(bwD)+' = '+paid.biweekly.inc);
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
  /* Same control, same rule, now inside the category's own sheet - which is
     also where the complaint that produced this section pointed: the date has
     to be beside the switch that raised the question, not at the bottom of the
     tab past every category. */
  openCatSheet(c.id);
  o.beforeTick=document.querySelectorAll('#catSheet [data-repdate]').length;
  const cb=document.querySelector('#catSheet [data-repeat="'+c.id+'"]');
  cb.checked=true; cb.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(x=>setTimeout(x,80));
  const rec=()=>state.recurring.find(r=>r.catId===c.id);
  o.anchored={anchor:rec().anchor, today:todayStr()};
  /* anchoring to a date that has already gone back-posts a bill - and if they
     logged that rent by hand, it lands twice */
  o.noBackPost={posted:postRecurring(M), spent:monthExpense(M)};
  const di=()=>document.querySelector('#catSheet [data-repdate="'+c.id+'"]');
  o.shown={exists:!!di(), value:di()&&di().value};
  di().value=M+'-01'; di().dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(x=>setTimeout(x,80));
  o.moved={anchor:rec().anchor, day:rec().day};
  di().value=''; di().dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(x=>setTimeout(x,60));
  o.blankIgnored=rec().anchor;
  const sel=document.querySelector('#catSheet [data-repfreq="'+c.id+'"]');
  sel.value='biweekly'; sel.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(x=>setTimeout(x,60));
  o.freqKeepsDate={freq:rec().freq, anchor:rec().anchor};
  /* untick and the date goes with it - a date for a bill that does not repeat
     is a control with nothing behind it */
  const cb2=document.querySelector('#catSheet [data-repeat="'+c.id+'"]');
  cb2.checked=false; cb2.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(x=>setTimeout(x,80));
  o.goneWithIt=document.querySelectorAll('#catSheet [data-repdate]').length;
  closeCatSheet();
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
  /* Pinned to "3" once, which made it a calendar bomb: the streak counts up to
     today, so the assertion broke by itself the next morning without a line of
     code changing. The property is that the pre-start day is NOT SCORED, and the
     way to test that is to take the day away and check the streak did not move. */
  const readStreak=()=>{ const st=[...document.querySelectorAll('#rewardCalBox .cal-stat')]
    .find(x=>/streak/i.test(x.textContent)); return st?st.querySelector('.v').textContent.trim():''; };
  const keep=state.transactions.slice();
  state.transactions=state.transactions.filter(t=>t.date!==M+'-01');
  renderRewardCalendar();
  o.streakWithoutPreDay=readStreak();
  state.transactions=keep; renderRewardCalendar();
  o.streakAgain=readStreak();
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
      +preCal.streak>0 && preCal.ahead===true && preCal.streak===preCal.streakWithoutPreDay
        && preCal.streak===preCal.streakAgain,
      `streak "${preCal.streak}" with the day, "${preCal.streakWithoutPreDay}" without it`);
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

/* ---- 46. the app could not record being paid ----
   Asked directly: how are HELOCs and cards viewed in Build, why is there no area
   for dividends or interest, and is the philosophy to forbid leverage?

   Three answers, all checkable, all gaps rather than positions. The app teaches
   that an asset is the thing that "puts money IN your pocket" and that the top
   rung of the Growth Ladder is "own things that pay you" - and then offered five
   income types, every one of them a form of LABOUR, and an asset model whose
   only recurring field was what the thing DRAINS. A liability was a name and a
   number, so a 3% mortgage and a 29% card were the same object, and "import from
   my liabilities" pushed every one into the payoff planner at apr:0 - after
   which the planner warned that its own figures were understated. ---- */
const cap = await p.evaluate(() => {
  const o={};
  state=JSON.parse(JSON.stringify(defaultState()));
  state.onboarded=true; state.uiMode='all'; state.stageReached=3; state.hourlyWage=22; state.trueRateSkipped=true;
  save(); activateTab('goals'); renderAll();
  o.yieldKinds=INCOME_SOURCES.filter(x=>x.yield).map(x=>x.k).sort();
  /* money capital earned is the purest independent income there is */
  o.indie={y:isIndependent('yield'), r:isIndependent('rent'), p:isIndependent('primary')};
  const M=state.activeMonth;
  state.transactions.push({id:'y1',type:'income',amount:180,source:'VTI dividend',srcType:'yield',date:M+'-05'});
  state.transactions.push({id:'y2',type:'income',amount:1400,source:'Rental',srcType:'rent',date:M+'-01'});
  state.transactions.push({id:'w1',type:'income',amount:3200,source:'Pay',srcType:'primary',date:M+'-02'});
  save();
  o.yieldMonth=yieldTotal(M);
  o.offense=offenseDefense(M).offense;
  /* it must not touch the hourly rate - no hours were sold for it */
  recomputeBlendedWage();
  o.wageUntouched=state.hourlyWage;
  /* an asset that pays, and one that cannot */
  state.assets.push({id:'a1',name:'Rental duplex',value:240000,kind:'real',cost:900,pays:1400});
  state.assets.push({id:'a2',name:'Truck',value:22000,kind:'stuff',cost:400});
  save(); renderNetWorth();
  o.paysOnReal=!!document.querySelector('input[data-pays="a1"]');
  o.noPaysOnStuff=!document.querySelector('input[data-pays="a2"]');
  o.net=(document.getElementById('assetList').innerText.match(/Net \+[^\n-]*/)||[''])[0].trim();
  o.bothSides=/And what it pays back/.test((document.getElementById('nwDrain')||{}).innerText||'');
  /* a rate on a liability, and it has to travel */
  state.liabilities.push({id:'l1',name:'HELOC',value:40000,apr:6.5});
  state.liabilities.push({id:'l2',name:'Visa',value:3000,apr:26.9});
  save(); renderNetWorth();
  o.aprField=!!document.querySelector('input[data-editapr="l1"]');
  document.getElementById('importLiab').click();
  o.imported=state.debts.map(d=>d.name+'@'+d.apr).sort().join(',');
  /* and the planner orders them by what they actually cost */
  state.debtStrategy='avalanche'; state.debtBudget=1200; save();
  const sim=simulateDebts(state.debts.map(d=>({name:d.name,balance:d.balance,apr:d.apr,minPayment:100})),1200,'avalanche');
  o.killsDearestFirst=sim.order?sim.order[0]:(sim.error||'');
  return o;
});
check('the app can record money that capital earned', cap.yieldKinds.join(',')==='rent,yield', cap.yieldKinds.join(','));
check('...and counts it as independent income, which is what it is',
      cap.indie.y===true && cap.indie.r===true && cap.indie.p===false);
check('...it reaches the Offense meter', cap.yieldMonth===1580 && cap.offense===1580,
      `${cap.yieldMonth} / ${cap.offense}`);
check('...without touching the hourly rate, because no hours were sold for it',
      cap.wageUntouched===22, String(cap.wageUntouched));
check('an asset can finally say what it pays, not only what it drains',
      cap.paysOnReal===true && /Net \+\$6,000 a year/.test(cap.net), cap.net);
check('...only for things that could actually pay you', cap.noPaysOnStuff===true);
check('...and the panel shows both sides', cap.bothSides===true);
check('a liability carries its rate, so 3% and 29% stop being the same object',
      cap.aprField===true);
check('...and the rate travels into the payoff planner instead of arriving as 0%',
      cap.imported==='HELOC@6.5,Visa@26.9', cap.imported);

/* ---- 47. Trends showed one thing and called itself Trends ----
   Three asks in one note: where does "Latest balance $13,362" come from when net
   worth says $4,843; Trends should cover investing as well as spending; bank
   balances should leave a trace as they change; and goals belong there too.

   The first was a naming failure - that line is neither net worth nor the bank,
   it is everything the LEDGER has net-added since the first entry, sitting
   unlabelled under a number it is supposed to differ from. The rest were real
   gaps: Trends drew one month of spending categories, and bank, goals and net
   worth have no history of their own at all, because editing an account
   overwrites the number and the old one is gone forever. ---- */
const trends = await p.evaluate(async () => {
  const o={};
  state=JSON.parse(JSON.stringify(defaultState()));
  state.onboarded=true; state.uiMode='all'; state.stageReached=3; state.hourlyWage=22; state.trueRateSkipped=true;
  const M=thisMonth(); state.activeMonth=M;
  const c=findOrCreateCat('Food');
  for(let i=5;i>=0;i--){ const m=shiftMonth(M,-i);
    state.transactions.push({id:'e'+i,type:'expense',amount:300+i*40,catId:c.id,date:m+'-10',note:'Food'});
    state.transactions.push({id:'v'+i,type:'invest',amount:200,source:'Index',date:m+'-12',ikind:'holds'});
  }
  state.snapshots=[shiftMonth(M,-2),shiftMonth(M,-1),M].map((m,i)=>({month:m,date:m+'-28',
    bank:2000+i*500, saved:300+i*250, netWorth:4000+i*900}));
  save(); activateTab('reflect'); rfTab='trends'; renderReflectTab();
  o.series=[...document.querySelectorAll('[data-trend]')].map(x=>x.dataset.trend);
  const read=()=>({legend:((document.querySelector('#trendBody .legend')||{}).innerText||'').replace(/\n/g,' '),
                   svg:!!document.querySelector('#trendBody svg'),
                   empty:(document.querySelector('#trendBody .empty')||{}).innerText||''});
  o.spent=read();
  for(const k of ['invest','bank','saved','nw']){ document.querySelector(`[data-trend="${k}"]`).click(); o[k]=read(); }
  /* one snapshot is a dot, not a line, and it must say so rather than draw one */
  state.snapshots=[{month:M,date:M+'-28',bank:2000}];
  save(); document.querySelector('[data-trend="bank"]').click();
  o.oneSnap=read();
  /* the snapshot has to carry what the trends read */
  o.snapFields=Object.keys(metricSnapshot(M));
  /* editing a balance has to reach the trend the same day, not at next boot */
  state.snapshots=[]; state.accounts=[{id:'a',name:'Checking',kind:'checking',balance:1000,updated:todayStr()}];
  save(); activateTab('goals'); renderAccounts();
  const inp=document.querySelector('input[data-acctbal="a"]');
  inp.value='4321'; inp.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(x=>setTimeout(x,60));
  const sn=(state.snapshots||[]).find(x=>x.month===M);
  o.snapped=sn?sn.bank:null;
  return o;
});
check('Trends covers all of them, not just spending',
      trends.series.join(',')==='spent,invest,bank,saved,nw', trends.series.join(','));
check('...spending and investing go back as far as the ledger does',
      /across 6 months/.test(trends.spent.legend) && /across 6 months/.test(trends.invest.legend),
      trends.invest.legend);
check('...bank, goals and net worth come from the snapshots',
      /across 3 months/.test(trends.bank.legend) && /across 3 months/.test(trends.saved.legend)
        && /across 3 months/.test(trends.nw.legend), trends.bank.legend);
check('...and investing is cumulative, because that is what growing means',
      /Investing now: \$1,200/.test(trends.invest.legend), trends.invest.legend);
check('one snapshot is a dot, not a line, and it says so',
      trends.oneSnap.svg===false && /needs a second month/.test(trends.oneSnap.empty),
      trends.oneSnap.empty.slice(0,60));
check('the monthly snapshot carries what the trends read',
      ['bank','saved','netWorth','goalTarget'].every(f=>trends.snapFields.includes(f)),
      trends.snapFields.join(','));
check('changing a balance reaches the trend the same day',
      trends.snapped===4321, String(trends.snapped));

/* ---- 48. the only scoreboard the app cannot flatter itself with ----
   The framing, in the user's words: this is not really a budgeting app, it is an
   accountability app - and since it never pulls bank data, whatever is actually
   in their accounts is the reflection of how well it works. Them freely updating
   that balance is the measurement.

   That is structurally true and worth the app saying out loud. Every other
   figure in here is built from what somebody chose to type: log less and the app
   looks calmer, log nothing and it has nothing bad to say. The account balance
   is the exception precisely BECAUSE the app cannot reach it - typed in freely,
   from outside, against no incentive.

   Which is exactly why it has to be reported carefully. A rising balance is not
   proof the app worked; a raise, a refund and an unpaid bill look identical from
   here. It says what moved, says what it cannot know, and stops. ---- */
const score = await p.evaluate(() => {
  const o={};
  const seed=(banks,intensity)=>{
    state=JSON.parse(JSON.stringify(defaultState()));
    state.onboarded=true; state.uiMode='all'; state.stageReached=3; state.hourlyWage=22; state.trueRateSkipped=true;
    state.intensity=intensity||'blunt';
    state.intake={name:'Pat',income:3200,reflections:{situation:'ok'}};
    const M=thisMonth(); state.activeMonth=M;
    state.snapshots=banks.map((v,i)=>({month:shiftMonth(M,-(banks.length-1-i)),date:'x',bank:v}));
    state.accounts=[{id:'a',name:'Checking',kind:'checking',balance:banks[banks.length-1],updated:todayStr()}];
    save();
  };
  const sig=()=>{ const r=buildReport(); const g=r.signals.find(x=>x.k==='bankTrend');
    return g ? {t:g.t, work:g.work, nudge:String(g.nudge).replace(/<[^>]*>/g,''), bad:!!g.bad}
             : {locked:(r.locked.find(l=>/cannot make up/.test(l.t))||{}).t, do:(r.locked.find(l=>/cannot make up/.test(l.t))||{}).do}; };
  seed([2000,2600,3400],'savage'); o.up=sig();
  seed([5000,4200,3100]);          o.down=sig();
  seed([3000,3010,2995]);          o.flat=sig();
  seed([3000]);                    o.one=sig();
  /* staleness is a fact, not a nag - shown late, gone the moment it is current */
  seed([2000,2600,3400]);
  state.accounts[0].updated=shiftDays(todayStr(),-23); save();
  activateTab('goals'); renderAccounts();
  o.stale=(document.querySelector('.ac-stale')||{}).innerText||'';
  state.accounts[0].updated=shiftDays(todayStr(),-3); save(); renderAccounts();
  o.recent=!document.querySelector('.ac-stale');
  /* and the panel itself has to say why this number is different */
  o.thesis=/it is the scoreboard/i.test(document.getElementById('view-goals').innerText);
  return o;
});
check('two readings of the real balance become a verdict',
      /up \$1,400/.test(score.up.t) && /\$3,400 − \$2,000 = \+\$1,400/.test(score.up.work),
      `${score.up.t} | ${score.up.work}`);
check('...one reading is not a trend, and it says what would make it one',
      /needs two readings/.test(score.one.locked||'') && score.one.do==='account', score.one.locked);
check('...a fall is not called a failure', /not automatically failure/.test(score.down.nudge) && score.down.bad===true,
      score.down.nudge.slice(-80));
check('...and level is called level', /held level/.test(score.flat.t) && /Not falling is worth something/.test(score.flat.nudge));
check('it says what it cannot know, every time',
      ['up','down','flat'].every(k=>/cannot tell you WHY it moved/.test(score[k].nudge)));
check('...and why this one number is different from all the others',
      /did not come from your own typing/.test(score.up.nudge)
        && /only honest scoreboard/.test(score.up.nudge), score.up.nudge.slice(-60));
check('a stale balance is named, with the reason it matters', /Last checked 23 days ago/.test(score.stale)
        && /honest measure of whether any of this is working/.test(score.stale), score.stale.slice(0,50));
check('...and it is a fact, not a nag - gone once it is current', score.recent===true);
check('the panel where the number lives says why it is the scoreboard', score.thesis===true);

/* ---- 49. the rest of the voice ----
   The audit found 21 of 24 surfaces reaching no voice engine. The report went
   first; this is the rest of the ones that carry an OPINION rather than a fact.

   One of the twelve was reclassified while wiring it: the talk-through is
   reached when money left because something HAPPENED - the car, the hospital -
   and every line in it is an interview prompt or a gentle reframe ("it stung
   instead of wrecking you"). Savage there is the exact failure the sensitive
   lock exists to prevent, so it stays clean by design rather than by neglect. ---- */
const v11 = await p.evaluate(() => {
  const seed=(lvl,sit)=>{
    state=JSON.parse(JSON.stringify(defaultState()));
    state.onboarded=true; state.uiMode='all'; state.stageReached=3; state.hourlyWage=22;
    state.trueRateSkipped=true; state.intensity=lvl; state.register='middle';
    state.intake={name:'Pat',income:3200,reflections:{situation:sit||'ok'}};
    const M=state.activeMonth, c=findOrCreateCat('Food');
    budgetFor(M)[c.id]=600; state.spendLimit=1500; state.trackStart=M+'-01'; state.enough=3000;
    state.transactions.push({id:'i',type:'income',amount:5000,source:'Pay',date:M+'-02'});
    state.transactions.push({id:'e',type:'expense',amount:80,catId:c.id,date:M+'-03',energy:'growth'});
    state.transactions.push({id:'f',type:'expense',amount:20,catId:c.id,date:M+'-04',energy:'fear'});
    state.goals=[{id:'g',name:'Cushion',target:5000,saved:500}];
    state.impulse=[{id:'p',name:'Shoes',amount:200,trap:'scroll',date:M+'-06',type:'skip'}];
    state.debts=[{id:'d',name:'Card',balance:9000,apr:26,minPayment:200}];
    state.debtBudget=800; state.investReturn=7; state.investYears=10;
    save(); applyStage({silent:true});
  };
  const grab=()=>{
    const g=id=>{const e=document.getElementById(id); return e?e.innerText.replace(/\s+/g,' ').trim():'';};
    const o={};
    o.reward=[spendRewardRec(0,500), spendRewardRec(0,-500), spendRewardRec(40,0), spendRewardRec(0,0)].join(' || ');
    o.kept=putAwayLine(400,100,22);
    activateTab('home'); renderHome();
    o.next=g('nextSteps'); o.enough=g('enoughCard');
    activateTab('impulse'); renderImpulse(); o.chest=g('impCelebrate');
    pendingCheck={name:'Mulcher',amt:100,trap:'tool',repAmt:600,repHrs:0,repPer:'year',hrsPer:'year'};
    renderToolResult(); o.toolPays=g('impResult');
    pendingCheck={name:'Rake',amt:100,trap:'tool',repAmt:0,repHrs:0,repPer:'year',hrsPer:'year'};
    renderToolResult(); o.toolWant=g('impResult');
    activateTab('debt'); renderDebt(); renderInvestCompare();
    o.debt=g('debtResults'); o.iv=(document.querySelector('.iv-verdict')||{}).innerText||'';
    activateTab('learn'); renderCirculation(); o.circ=g('circChart');
    activateTab('home'); state.spendingMode=true; save(); applySpending();
    const M=state.activeMonth;
    state.transactions.push({id:'big',type:'expense',amount:900,catId:state.categories[0].id,date:M+'-03'});
    save(); calSelDay=3; renderRewardCalendar();
    o.dayCard=g('calDay');
    o.msNote=(moneyStoryNote()||{}).t||'';
    return o;
  };
  const out={};
  seed('clean');  out.clean=grab();
  seed('savage'); out.savage=grab();
  seed('savage','survive'); out.survival=grab();
  return out;
});
const SURFACES=['reward','kept','next','enough','chest','toolPays','toolWant','debt','iv','circ','dayCard'];
const moved=SURFACES.filter(k=>v11.clean[k] && v11.clean[k]!==v11.savage[k]);
check('every remaining opinion surface now speaks in the app\'s voice',
      moved.length===SURFACES.length, `${moved.length}/${SURFACES.length} moved; flat: ${SURFACES.filter(k=>!moved.includes(k)).join(',')||'none'}`);
check('...the reward calendar moves on all four of its branches',
      v11.clean.reward.split(' || ').every((x,i)=>x!==v11.savage.reward.split(' || ')[i]));
check('...savage bites on the crush-vs-invest verdict',
      /surest return you will ever be offered/.test(v11.savage.iv), v11.savage.iv.slice(-60));
check('...and clean stays measured on the same verdict',
      /more than the market is likely to pay\./.test(v11.clean.iv), v11.clean.iv.slice(-50));
check('...a want is still called a want at every intensity',
      /want/i.test(v11.clean.toolWant) && /want/i.test(v11.savage.toolWant));
/* The floor beats the dial, everywhere. Do this next is exempt from the string
   compare because survival deliberately CHANGES which steps appear - that is the
   situation logic one layer above the voice, and it is the correct behaviour. */
const floored=SURFACES.filter(k=>k!=='next').filter(k=>v11.survival[k]===v11.clean[k]);
check('the survival floor beats the intensity dial on every one of them',
      floored.length===SURFACES.length-1,
      `flooring failed on: ${SURFACES.filter(k=>k!=='next'&&v11.survival[k]!==v11.clean[k]).join(',')||'none'}`);
/* And the one that must never gain a voice. */
const talkFlat = await p.evaluate(() => {
  const src=document.documentElement.outerHTML.replace(/\/\*[\s\S]*?\*\//g,' ');
  const i=src.indexOf('function renderTalk'); if(i<0) return null;
  const seg=src.slice(i, src.indexOf('\nfunction ', i+2000));
  return {voiced:/voice\(/.test(seg), gentle:/inconvenience, not a crisis/.test(seg)};
});
check('the talk-through stays clean by design - it is reached after something went wrong',
      talkFlat && talkFlat.voiced===false && talkFlat.gentle===true, JSON.stringify(talkFlat));

/* ---- 50. borrowing to build ----
   Asked whether the app forbids a HELOC or a cheap card, or lets you use one as
   leverage. The answer it gives is arithmetic, and arithmetic has exactly one
   way to be dishonest here: print the upside and skip the downside. Everything
   below exists to make that impossible to ship by accident.

   The properties, not the phrasing. Copy on this panel will change; what must
   not change is that the break-even is correct, that the losing case is on the
   screen in every state, that a payment which does not cover the interest gets
   named, that a servicing gap is traced back to your own income, that the
   no-buffer warning can actually fire, and that no path here ever tells someone
   to do it. */
const lev = await p.evaluate(() => {
  const out={};
  const M=(a,r,g,y,pay,cash)=>leverageMath(a,r,g,y,pay||0,cash||0);
  // break-even on a carried balance is the rate itself, at every horizon
  out.beHeld=[3,5,10,20].map(y=>Math.round(M(40000,6.5,9,y).breakEven*1000)/1000);
  // paying it down lowers the bar, and it is still positive
  const paid=M(40000,6.5,9,10,500,0);
  out.bePaid=Math.round(paid.breakEven*100)/100;
  out.paidOff=paid.payoffMonths;
  // the losing case never depends on the guess: it is the interest, always
  out.flatIsInterest=[4,9,25].every(g=>{ const m=M(40000,6.5,g,10); return Math.abs(m.flatLoss-m.interest)<0.01; });
  // a payment under the monthly interest is named, and the balance grows
  const uw=M(40000,20,9,10,100,0);
  out.underwater=uw.underwater; out.owesMore=uw.leftover>40000;
  // servicing gap is payment minus the cash it actually hands you
  out.gap=M(40000,6.5,9,10,500,200).gapMonthly;
  // zero years never divides by zero, and a zero balance never NaNs
  out.guards=[M(0,6.5,9,10), M(40000,6.5,9,0)].every(m=>isFinite(m.breakEven)&&isFinite(m.net));
  return out;
});
check('break-even on a carried balance is the rate itself, at every horizon',
      lev.beHeld.every(x=>x===6.5), JSON.stringify(lev.beHeld));
check('...paying it down lowers the bar rather than pretending it away',
      lev.bePaid>0 && lev.bePaid<6.5 && lev.paidOff>0, `${lev.bePaid}% / paid off month ${lev.paidOff}`);
check('...the losing case is the interest, whatever the guess was',
      lev.flatIsInterest===true);
check('...a payment under the monthly interest is flagged, and the balance grows',
      lev.underwater===true && lev.owesMore===true, JSON.stringify(lev));
check('...the servicing gap is the payment less the cash it hands you',
      lev.gap===300, String(lev.gap));
check('...zero amount and zero years produce numbers, not NaN',
      lev.guards===true);

const levUI = await p.evaluate(() => {
  const grab=()=>{ const el=document.getElementById('levResults'); return {t:el.innerText, cards:el.querySelectorAll('.lev-card.down').length, up:el.querySelectorAll('.lev-card.up').length}; };
  const out={};
  state.accounts=[]; state.assets=[]; state.liabilities=[]; state.lev={};
  renderLeverage(); out.empty=document.getElementById('levResults').innerText;
  // 1. the winning case still prints the losing one
  state.lev={amt:40000,apr:6.5,ret:12,years:10}; renderLeverage(); out.win=grab();
  // 2. the losing case says so
  state.lev={amt:40000,apr:6.5,ret:4,years:10}; renderLeverage(); out.lose=grab();
  out.loseCls=document.querySelector('#levResults .levcard').className;
  // 3. no expected return yet: the bar shows, the loss shows, nothing is invented
  state.lev={amt:40000,apr:6.5,years:10}; renderLeverage(); out.blank=grab();
  // 4. the no-buffer warning has to be reachable by a real user
  state.categories=[{id:'c1',name:'Rent',essential:true}];
  state.budgets[state.activeMonth]={c1:2000};
  state.accounts=[{id:'a1',name:'Checking',balance:1500,kind:'checking'}];
  state.lev={amt:40000,apr:6.5,ret:9,years:10}; renderLeverage();
  out.bare=document.getElementById('levResults').innerText;
  out.runway=freedomRunway();
  // 5. the servicing gap traces back to your own income
  state.lev={amt:40000,apr:6.5,ret:9,years:10,pay:500,cash:200}; renderLeverage();
  out.gap=document.getElementById('levResults').innerText;
  // 6. the panel is not stage-gated - the warning above would be unreachable if it were
  out.gated=!!document.getElementById('levPanel').getAttribute('data-stage');
  // 7. both money fields let people enter in their own rhythm
  out.units=['levPayUnit','levCashUnit'].every(id=>!!document.querySelector('#'+id+' select'));
  // 8. it shows its working
  document.querySelector('#levResults [data-why="levBreak"]').click();
  out.why=(document.querySelector('.why-note[data-forwhy="levBreak"]')||{}).innerText||'';
  return out;
});
check('the panel asks for a rate before it says anything at all',
      /rate/i.test(levUI.empty) && !/break even/i.test(levUI.empty), levUI.empty.slice(0,80));
check('the winning case still prints the losing one beside it',
      levUI.win.cards===1 && levUI.win.up===1 && /returns nothing/i.test(levUI.win.t));
check('...and so does the losing case, which is marked as losing',
      levUI.lose.cards>=1 && /\bneg\b/.test(levUI.loseCls), levUI.loseCls);
check('...with no expected return entered, the loss is shown and no gain is invented',
      levUI.blank.cards===1 && levUI.blank.up===0 && /returns nothing/i.test(levUI.blank.t));
check('the no-buffer warning fires for someone who actually has no buffer',
      levUI.runway<3 && /forced sale/i.test(levUI.bare), `runway ${levUI.runway}`);
check('...the panel carries no stage gate, so that warning is reachable',
      levUI.gated===false);
check('a servicing gap is traced back to your own income, every month',
      /\$300/.test(levUI.gap) && /own income/i.test(levUI.gap));
check('both money fields accept the rhythm the user actually feels',
      levUI.units===true);
check('the break-even shows its working with live numbers',
      /40,000/.test(levUI.why) && /6\.5/.test(levUI.why) && levUI.why.length>200, levUI.why.slice(0,90));
/* The one thing it must never do. Scan the whole feature - panel copy, engine,
   render, voice banks - for anything that reads as an instruction to borrow. */
const levNeverBlesses = await p.evaluate(() => {
  const src=document.documentElement.outerHTML;
  const i=src.indexOf('id="levPanel"'), j=src.indexOf('function budgetFor');
  const k=src.indexOf('levNeg:'), l=src.indexOf('levBare:');
  const seg=src.slice(i, src.indexOf('</section>', i)) + src.slice(src.indexOf('function leverageMath'), j) + src.slice(k, l+600);
  /* "do it" is deliberately NOT in this list: the feature's own refusal sentence
     is "it will not tell you whether to do it", and a rule that fires on its own
     disclaimer is a rule nobody can keep. These are the phrasings that would
     actually constitute a recommendation. */
  const bless=/\b(you should borrow|worth borrowing|go for it|take the loan|take this loan|we recommend|recommended|smart move|makes sense to borrow|this is a good bet)\b/i;
  /* And the rule has to be able to fire, or it proves nothing. */
  const control='Honestly, this is a smart move and you should borrow the lot.';
  return {hit:(seg.match(bless)||[])[0]||null,
          canFire:bless.test(control),
          refuses:/will not tell you whether to do it/.test(seg)};
});
check('...the never-blesses rule can actually fire',
      levNeverBlesses.canFire===true);
check('nothing in the whole feature tells anyone to borrow',
      levNeverBlesses.hit===null, levNeverBlesses.hit);
check('...and it says out loud that it will not',
      levNeverBlesses.refuses===true);
/* Reachable, or it does not exist. The question that started this came from the
   Build tab looking at a HELOC, so that is where the door has to be. */
const levDoor = await p.evaluate(() => {
  state.liabilities=[{id:'l1',name:'HELOC',value:40000,apr:6.5}];
  renderNetWorth();
  const cheap=document.querySelector('#liabList [data-trail="leverage"]');
  const out={offered:!!cheap};
  state.liabilities=[{id:'l2',name:'Store card',value:2000,apr:26}];
  renderNetWorth();
  out.notOfferedOnExpensive=!document.querySelector('#liabList [data-trail="leverage"]');
  return out;
});
check('a cheap liability offers the door to the tool that prices it',
      levDoor.offered===true);
check('...and a 26% store card is not called a lever',
      levDoor.notOfferedOnExpensive===true);

/* ---- 51. charts you can interrogate ----
   "These graphs mean actually nothing unless you're able to click on them." Every
   time-series drew a shape and stopped - no axis, no values, no way to ask a peak
   what it was made of. The properties below are what makes a chart an account of
   your money rather than a picture of it: every point is reachable by thumb AND by
   keyboard, the readout changes when the selection does, and it says what the
   point is MADE of rather than repeating its number. */
const CHARTS=[
  {id:'monthChart', open:"activateTab('reflect'); rfTab='inout'; renderReflectTab();", read:'#monthRead .cread'},
  {id:'trendChart', open:"activateTab('reflect'); rfTab='worth'; renderReflectTab();", read:'#trendChart .cread'},
  {id:'trendBody',  open:"activateTab('reflect'); rfTab='trends'; renderReflectTab();", read:'#trendBody .cread'},
  {id:'debtChart',  open:"activateTab('debt'); renderDebt();", read:'#debtResults .cread'}
];
await seed({...FULL, activeMonth:'2026-08',
  transactions:[
    {id:'x1',type:'income',amount:3200,date:'2026-06-01',source:'Paycheck'},
    {id:'x2',type:'expense',amount:1200,catId:'roof',date:'2026-06-05'},
    {id:'x3',type:'income',amount:12400,date:'2026-07-01',source:'Paycheck',note:'Intake'},
    {id:'x4',type:'expense',amount:300,catId:'fun',date:'2026-07-09'},
    {id:'x5',type:'income',amount:3200,date:'2026-08-01',source:'Paycheck'},
    {id:'x6',type:'expense',amount:940,catId:'roof',date:'2026-08-03'},
    /* two categories inside the active month, because the breakdown donut
       defaults to a one-month window and one slice is not a donut. */
    {id:'x7',type:'expense',amount:220,catId:'fun',date:'2026-08-11'}],
  debts:[{id:'d1',name:'Card',balance:2400,apr:23.9,minPayment:75}], debtBudget:400,
  snapshots:[{month:'2026-06',bank:3000,netWorth:3000,saved:0},
             {month:'2026-07',bank:5200,netWorth:5200,saved:100},
             {month:'2026-08',bank:4800,netWorth:4800,saved:250}]});
await p.reload(); await p.waitForTimeout(400);
for(const C of CHARTS){
  const r=await p.evaluate(({id,open,read})=>{
    eval(open);
    const readOf=()=>{ const e=document.querySelector(read); return e?e.innerText.replace(/\s+/g,' ').trim():null; };
    const hits=document.querySelectorAll(`[data-cfor="${id}"][data-cidx]`).length;
    const first=readOf();
    if(hits<2) return {hits, first, moved:false, keys:false, focusKept:false};
    document.querySelector(`[data-cfor="${id}"][data-cidx="0"]`).dispatchEvent(new MouseEvent('click',{bubbles:true}));
    const atZero=readOf();
    const host=document.querySelector(`[data-chartkeys="${id}"]`);
    let keys=false, focusKept=false;
    if(host){
      host.focus();
      host.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
      const afterKey=readOf();
      keys = afterKey!==atZero;
      focusKept = !!document.querySelector(`[data-chartkeys="${id}"]`);
    }
    return {hits, first, atZero, moved:atZero!==first, keys, focusKept, hasHost:!!host};
  }, C);
  check(`${C.id}: every point is a thumb-sized target, not a 3px dot`, r.hits>=2, `${r.hits} bands`);
  check(`${C.id}: it says something before you touch it`, !!r.first && r.first.length>20, (r.first||'').slice(0,60));
  check(`${C.id}: tapping a different point changes what it says`, r.moved===true, `${(r.first||'').slice(0,30)} -> ${(r.atZero||'').slice(0,30)}`);
  check(`${C.id}: the arrow keys walk it, and focus survives the redraw`,
        r.hasHost===true && r.keys===true && r.focusKept===true, JSON.stringify({hasHost:r.hasHost,keys:r.keys,focusKept:r.focusKept}));
}
/* The readout has to earn its place: a month label and a dollar figure is what
   the title tooltip already was. Each one names what the number is made of. */
const reads = await p.evaluate(() => {
  const out={};
  activateTab('reflect'); rfTab='inout'; renderReflectTab();
  const tap=(id,i)=>document.querySelector(`[data-cfor="${id}"][data-cidx="${i}"]`).dispatchEvent(new MouseEvent('click',{bubbles:true}));
  tap('monthChart',4); out.jul=document.querySelector('#monthRead .cread').innerText;
  tap('monthChart',1); out.empty=document.querySelector('#monthRead .cread').innerText;
  rfTab='worth'; renderReflectTab(); out.ledger=document.querySelector('#trendChart .cread').innerText;
  rfTab='trends'; renderReflectTab();
  trendPick='spent'; renderTrendSeries();
  tap('trendBody',0); out.trendGap=document.querySelector('#trendBody .cread').innerText;
  return out;
});
check('the in-vs-out readout breaks the month into its parts',
      /in\b/.test(reads.jul) && /out\b/.test(reads.jul) && /biggest/i.test(reads.jul) && /entr/i.test(reads.jul),
      reads.jul.replace(/\s+/g,' ').slice(0,90));
/* The reason this feature exists at all: a July bar four times everyone else's,
   made almost entirely of a row the setup chat wrote. The chart could not say so
   and the readout must. */
check('...and names income the setup chat wrote rather than letting it pass as yours',
      /setup chat/i.test(reads.jul), reads.jul.replace(/\s+/g,' ').slice(-120));
check('a month with nothing logged is called unlogged, never zero',
      /nothing logged/i.test(reads.empty) && !/\$0\b/.test(reads.empty), reads.empty.replace(/\s+/g,' ').slice(0,90));
check('...and so is a gap in a ledger trend line',
      /nothing logged/i.test(reads.trendGap), reads.trendGap.replace(/\s+/g,' ').slice(0,90));
check('the running-total readout says what it is not, as well as what it is',
      /not your bank balance/i.test(reads.ledger) && /not net worth/i.test(reads.ledger),
      reads.ledger.replace(/\s+/g,' ').slice(-90));
/* The donut was the last mute picture: its legend was clickable and it was not. */
const donut = await p.evaluate(() => {
  activateTab('reflect'); rfTab='breakdown'; renderReflectTab();
  const arcs=[...document.querySelectorAll('#bdBox .bd-arc')];
  if(arcs.length<2) return {arcs:arcs.length};
  const leaf=arcs.find(a=>!/▸/.test(a.parentNode.parentNode.innerText)) || arcs[arcs.length-1];
  leaf.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const sel=document.querySelectorAll('#bdBox .bd-row.sel').length;
  document.querySelectorAll('#bdBox .bd-arc')[[...document.querySelectorAll('#bdBox .bd-arc')].indexOf(leaf)>=0?0:0];
  return {arcs:arcs.length, sel};
});
check('the donut slices respond to a tap, like the legend beside them always did',
      donut.arcs>=2 && donut.sel===1, JSON.stringify(donut));

/* ---- 52. the welcome gate ----
   A card that has to be read and accepted before the setup chat starts. Two
   things make it worth testing rather than just writing: it is the only screen
   in the app that BLOCKS, so a CTA that cannot be reached on a short phone is a
   dead end with no way past it; and its whole reason for existing is one
   sentence - the app is not real, it cannot want this for you, the work is
   yours - which is exactly the sentence a future copy edit would soften first. */
await p.evaluate(()=>localStorage.clear());
await p.reload(); await p.waitForTimeout(900);
const wel = await p.evaluate(() => ({
  shown:document.getElementById('iaWelcome').classList.contains('on'),
  overlay:document.getElementById('intake').classList.contains('on'),
  logHidden:document.getElementById('intakeLog').style.display==='none',
  bubbles:document.querySelectorAll('#intakeLog .bub').length,
  barHidden:document.querySelector('.intake-prog').style.visibility==='hidden',
  /* Two readings now, because the card has a short version and a long one and
     they answer different questions: `shortText` is what a person is actually
     shown, `text` is everything the screen holds once the long version is
     open. The claim list below is split along exactly that line. */
  shortText:document.getElementById('iaWelcome').innerText,
  text:(()=>{ const c=document.querySelector('.iaw-card');
    const was=c&&c.classList.contains('long');
    if(c) c.classList.add('long');
    const t=document.getElementById('iaWelcome').innerText;
    if(c&&!was) c.classList.remove('long');
    return t; })(),
  cta:(document.getElementById('iaWelGo')||{}).innerText||''
}));
check('a first run meets the gate before it meets a single question',
      wel.shown===true && wel.overlay===true && wel.bubbles===0, JSON.stringify({shown:wel.shown,bubbles:wel.bubbles}));
check('...with nothing behind it competing for the screen',
      wel.logHidden===true && wel.barHidden===true);
/* The four things the card has to say. Asserted as ideas, not sentences - the
   wording will change and none of these may quietly leave with it. */
/* Written to survive a rewrite, and it just had to: the card was rewritten in
   the author's own voice, "at zero" became "somewhere", and every "I cannot"
   became "I can't". Any regex that had pinned a sentence would have failed on a
   change that lost nothing - which is the failure mode this list exists to
   avoid, so the contraction-tolerant forms are the fix rather than the
   headline being edited back.

   One entry did NOT survive, and it is recorded as a removal rather than
   quietly relaxed into passing: the old card said "I cannot even waste your
   time, because I have none to waste", which flipped the burden in a single
   sentence. The rewrite drops it and makes an adjacent point instead - that
   easier things exist and they cost time and money too. Both are good; they are
   not the same, and pretending the test still covers the old one would be a
   lie about coverage. */
const GATE=[
  ['everybody starts somewhere', /everybody starts|start(s|ing)? (at zero|somewhere)/i],
  ['where you are is not a verdict', /not a verdict/i],
  ['the distance is the point', /distance/i],
  ['in and out is how it closes', /comes in[\s\S]{0,40}goes out/i],
  ['accountability, not budgeting', /accountability\b/i],
  ['I am listening', /listening/i],
  ['I am watching', /watching/i],
  ['you can do better', /do better/i],
  ['it is not real', /\bnot real\b/i],
  /* "cannot" spelled out did not match a pattern built for "can't" - the short
     version writes it in full, which is the same claim in more letters. */
  ['it cannot want it for you', /can(?:not|n?['\u2019]?t)? want this for you/i],
  ['easier things exist, and they cost you too', /easier[\s\S]{0,120}(time and .*money|money)/i],
  ['the effort is entirely yours', /effort is yours|all of it/i],
  ['and it will not flatter the record', /flatter/i]
];
/* Six of the thirteen moved into the long version when the card gained a short
   one, and that is a real change worth splitting rather than relaxing. What may
   never be optional is the DISCLOSURE - what this thing is, what it is not, and
   that it will not flatter you - because those function as terms somebody is
   agreeing to before they start. The rest is elaboration, and elaboration
   being a choice is the entire point of a light version. */
const GATE_SHORT=['where you are is not a verdict','the distance is the point',
  'in and out is how it closes','accountability, not budgeting','it is not real',
  'it cannot want it for you','and it will not flatter the record'];
const missing=GATE.filter(([,rx])=>!rx.test(wel.text)).map(([n])=>n);
const missingUpFront=GATE.filter(([n,rx])=>GATE_SHORT.includes(n) && !rx.test(wel.shortText)).map(([n])=>n);
check('the disclosure is in the short version, where it cannot be missed',
      missingUpFront.length===0, missingUpFront.join(' | '));
check('the gate still says all thirteen things it was built to say',
      missing.length===0, missing.join(', '));
check('...and the button asks for work rather than promising a result',
      /\bwork\b/i.test(wel.cta), wel.cta);
/* The blocking screen must be passable on the shortest phone the app supports.
   The overflow lives on the scroller, so the CTA is reachable at any height -
   this proves it rather than trusting it. */
/* Really resized, really scrolled, really clicked. Two earlier drafts of this
   were worthless: the first read the same layout four times and called it four
   phones, and the second set scrollTop by hand - which works even on a container
   that has been made unscrollable, so it passed with the button welded off the
   bottom of the screen. The only honest version of "can a person reach it" is to
   scroll the way a thumb does and then press the thing. */
const welReach=[];
for(const h of [568,640,700,844]){
  await p.setViewportSize({width:360,height:h});
  await p.evaluate(()=>localStorage.clear());
  await p.reload(); await p.waitForTimeout(900);
  await p.mouse.move(180, Math.round(h/2));
  for(let i=0;i<6;i++){ await p.mouse.wheel(0,900); await p.waitForTimeout(60); }
  await p.waitForTimeout(150);
  const box=await p.evaluate(hh => {
    const r=document.getElementById('iaWelGo').getBoundingClientRect();
    return {h:hh, top:Math.round(r.top), bottom:Math.round(r.bottom), height:Math.round(r.height), width:Math.round(r.width)};
  }, h);
  const onScreen = box.top>=0 && box.bottom<=h+1;
  let pressed=false;
  if(onScreen){
    try{ await p.click('#iaWelGo',{timeout:2000}); await p.waitForTimeout(600);
         pressed=await p.evaluate(()=>document.querySelectorAll('#intakeLog .bub').length>0); }
    catch(e){ pressed=false; }
  }
  welReach.push({...box, onScreen, pressed});
}
await p.setViewportSize({width:390,height:1000});
check('a thumb can scroll to the CTA and press it on every phone height',
      welReach.every(r=>r.onScreen && r.pressed && r.height>=44 && r.width>200), JSON.stringify(welReach));
/* Accepting starts the chat. Declining with the X must not leave the surface in
   a state a later re-run cannot recover from - the failure that made iaHideWelcome
   necessary in the first place. */
const flow = await p.evaluate(async () => {
  document.getElementById('iaWelGo').click();
  await new Promise(r=>setTimeout(r,600));
  const after={ gone:!document.getElementById('iaWelcome').classList.contains('on'),
                asked:document.querySelectorAll('#intakeLog .bub').length>0,
                stored:JSON.parse(localStorage.getItem('unfiltered_budget_v2')).welcomed,
                logBack:document.getElementById('intakeLog').style.display!=='none',
                barBack:document.querySelector('.intake-prog').style.visibility!=='hidden' };
  // a re-run by somebody who already accepted goes straight to the questions
  document.getElementById('intake').classList.remove('on');
  openIntake();
  await new Promise(r=>setTimeout(r,600));
  after.rerunSkips=!document.getElementById('iaWelcome').classList.contains('on');
  after.rerunAsks=document.querySelectorAll('#intakeLog .bub').length>0;
  // and somebody who backed out of the gate still gets a usable screen next time
  state.welcomed=false; save();
  document.getElementById('intake').classList.remove('on');
  openIntake();
  await new Promise(r=>setTimeout(r,300));
  after.gateAgain=document.getElementById('iaWelcome').classList.contains('on');
  document.getElementById('iaWelGo').click();
  await new Promise(r=>setTimeout(r,600));
  after.recovers=document.getElementById('intakeLog').style.display!=='none'
              && document.querySelectorAll('#intakeLog .bub').length>0;
  return after;
});
check('accepting it starts the chat and records the acceptance',
      flow.gone===true && flow.asked===true && flow.stored===true, JSON.stringify(flow));
check('...and hands the log and the progress bar back',
      flow.logBack===true && flow.barBack===true);
check('a re-run by someone who already accepted is not made to read it again',
      flow.rerunSkips===true && flow.rerunAsks===true);
check('the gate leaves the setup screen usable, however it was left',
      flow.gateAgain===true && flow.recovers===true, JSON.stringify({gateAgain:flow.gateAgain,recovers:flow.recovers}));

/* ---- 53. a line per category, and a door to the rest ----
   From a phone: "this scroll is long on the plan tab, it should adopt this
   layout, with a details tab holding the past history and recurring options and
   targets." Correct. Every category carried a progress bar, a meta line, a
   repeat control with its own date picker, a split button, a delete button, a
   rename pencil and an add-subcategory row - eleven controls each, and the one
   question a plan exists to answer, "what is left in this", was buried in the
   middle of them.

   The properties: the list holds one line per category, that line answers the
   question, tapping it opens everything else, and nothing that used to be
   reachable stopped being reachable. That last one is the whole risk of a move
   like this, so it is checked control by control. */
await seed({...FULL, activeMonth:'2026-08',
  categories:[{id:'bills',name:'Bills'},{id:'elec',name:'Electric',parentId:'bills'},
              {id:'att',name:'Phone',parentId:'bills'},{id:'food',name:'Food'},
              {id:'ret',name:'Retirement',growth:'invest'}],
  budgets:{'2026-08':{elec:180,att:95,food:600,ret:400},'2026-07':{elec:170,att:95,food:640}},
  transactions:[{id:'i',type:'income',amount:4200,date:'2026-08-01'},
                {id:'e1',type:'expense',amount:191,catId:'elec',date:'2026-08-04',note:'August bill'},
                {id:'e2',type:'expense',amount:712,catId:'food',date:'2026-08-09'},
                {id:'e3',type:'expense',amount:180,catId:'elec',date:'2026-07-04'},
                {id:'v1',type:'invest',amount:400,catId:'ret',date:'2026-08-02'}]});
await p.setViewportSize({width:390,height:1200});
await p.reload(); await p.waitForTimeout(700);
const plan = await p.evaluate(async () => {
  activateTab('budget');
  /* Read in the Remaining view: the plan list carries one money column now and
     the availability pill only exists in the column that answers "what is
     left". Every other property here - one line per category, nothing clipped,
     no shortened money, no controls loose in the list - is about the row and
     holds in all three modes. */
  const box=document.getElementById('cats');
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  /* Both modes are set EXPLICITLY rather than assumed. planView is stored, so
     whatever an earlier section left behind would otherwise decide which
     column this one is reading - a test that depends on the order it runs in. */
  setPlanView('planned'); await wait(250);
  /* Typing the amount straight into the list is a PLANNED-mode property, and
     the point of that mode: budgeting is typed here, not buried in a sheet. */
  const typeable=[...box.querySelectorAll('[data-row].subrow')]
    .every(r=>!!r.querySelector('input[data-cat]'));
  setPlanView('left'); await wait(250);
  const rows=[...box.querySelectorAll('[data-row]')];
  const heights=rows.map(r=>Math.round(r.getBoundingClientRect().height));
  return {
    rows:rows.length,
    cols:!!box.querySelector('.plan-cols'),
    /* counted in the Remaining view, which is where a pill exists at all now */
    pills:box.querySelectorAll('.avail').length,
    tallest:Math.max(...heights),
    oneLiners:heights.filter(h=>h<=64).length,
    /* Reported twice from a real phone, both times as "text overflow": a name
       sliced through the middle of a letter, and money ellipsised to "$4...".
       Neither is truncation, both are the row lying about how much space it
       needs. Measured, not eyeballed. */
    clippedNames:rows.filter(r=>{ const t=r.querySelector('.rw-t');
      return t && t.scrollHeight>t.clientHeight+1; }).length,
    spilledNames:rows.filter(r=>{ const t=r.querySelector('.rw-t');
      return t && t.getBoundingClientRect().bottom > r.getBoundingClientRect().bottom+1; }).length,
    cutMoney:[...box.querySelectorAll('.avail, .subrow .sub-assign input')]
      .filter(e=>e.scrollWidth>e.clientWidth+1).length,
    /* the controls that used to live on every row */
    barsInList:box.querySelectorAll('.bar').length,
    repeatsInList:box.querySelectorAll('[data-repeat]').length,
    deletesInList:box.querySelectorAll('[data-del]').length,
    pencilsInList:box.querySelectorAll('.cat-edit').length,
    addSubInList:box.querySelectorAll('[data-addsub-input]').length,
    everyRowHasPill:rows.every(r=>!!r.querySelector('.avail')),
    everyLeafTypeable:typeable
  };
});
check('the plan is one line per category, with a column header over them',
      plan.rows===5 && plan.cols===true && plan.everyRowHasPill===true, JSON.stringify(plan));
/* A row may take a second line for a long name - that is the row admitting it
   needs the space rather than cutting a word in half. What it may never do is
   clip, spill, or shorten a dollar figure, and most rows must still be one
   line or the list is not compact at all. */
check('...no name is clipped or spilled, and no dollar figure is shortened',
      plan.clippedNames===0 && plan.spilledNames===0 && plan.cutMoney===0,
      JSON.stringify({clipped:plan.clippedNames, spilled:plan.spilledNames, cutMoney:plan.cutMoney}));
check('...and the list is still a line per category, give or take a long name',
      plan.oneLiners>=plan.rows-1 && plan.tallest<=96,
      `${plan.oneLiners} of ${plan.rows} on one line, tallest ${plan.tallest}px`);
check('...the amount is still typed straight into the list, where it is typed ninety times a month',
      plan.everyLeafTypeable===true);
check('...and the eleven controls that used to ride along are gone from it',
      plan.barsInList===0 && plan.repeatsInList===0 && plan.deletesInList===0
      && plan.pencilsInList===0 && plan.addSubInList===0,
      JSON.stringify({bars:plan.barsInList,repeats:plan.repeatsInList,dels:plan.deletesInList,pencils:plan.pencilsInList,addsub:plan.addSubInList}));
/* Gone from the list is only acceptable if it is present in the sheet. */
const sheet = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  document.querySelector('#cats [data-catsheet="elec"] .rw-nm').click(); await wait(200);
  const on=document.getElementById('catSheet').classList.contains('on');
  const b=document.getElementById('catSheetBody');
  const has=sel=>!!b.querySelector(sel);
  const out={ on, title:(document.getElementById('catSheetTitle')||{}).innerText||'',
    /* the property is "the sheet carries a way to assign this category's
       number", not which selector carries it - the assign field became a unit
       field (id csA<catId>) when it got a period picker */
    assigned:has('#csAelec')||has('input[data-cat="elec"]'), repeat:has('[data-repeat="elec"]'),
    del:has('[data-del="elec"]'), pencil:!!document.querySelector('#catSheetTitle .cat-edit'),
    split:has('[data-addsubfirst="elec"]'), bar:has('.bar'),
    history:has('.cs-hist'), txs:has('.cs-tx'),
    text:b.innerText };
  /* a group opens too, and says what a group is */
  document.getElementById('catSheetX').click(); await wait(150);
  document.querySelector('#cats [data-catsheet="bills"] .rw-nm').click(); await wait(200);
  out.groupText=document.getElementById('catSheetBody').innerText;
  out.groupSubs=document.querySelectorAll('#catSheetBody .cs-sub').length;
  out.groupHasAssign=!!document.querySelector('#catSheetBody #csAbills, #catSheetBody input[data-cat="bills"]');
  document.getElementById('catSheetX').click(); await wait(150);
  return out;
});
check('tapping a category opens its own sheet', sheet.on===true && /Electric/.test(sheet.title), sheet.title);
check('...carrying every control the row used to',
      sheet.assigned && sheet.repeat && sheet.del && sheet.pencil && sheet.split && sheet.bar,
      JSON.stringify({assign:sheet.assigned,repeat:sheet.repeat,del:sheet.del,pencil:sheet.pencil,split:sheet.split,bar:sheet.bar}));
check('...plus the history the list never had room for',
      sheet.history===true && sheet.txs===true && /Jul/.test(sheet.text) && /August bill/.test(sheet.text));
check('...and it does not invent a carry-forward this app has never had',
      !/from last month/i.test(sheet.text) && !/rolled over/i.test(sheet.text));
check('a pool opens too, lists what is inside it, and does not offer its own amount',
      sheet.groupSubs===2 && sheet.groupHasAssign===false && /pool/i.test(sheet.groupText),
      JSON.stringify({subs:sheet.groupSubs, ownField:sheet.groupHasAssign}));
/* The bug the compact row exposed: a growth pool could never be used up, so the
   Plan claimed money was available that had already left. */
const growthPool = await p.evaluate(async () => {
  /* What is left lives in the Remaining view now that the plan list carries a
     Planned / Spent / Remaining toggle. The property is unchanged - a growth
     category has to read as used up - but it has to be read from the column
     that answers that question. */
  setPlanView('left'); await new Promise(r=>setTimeout(r,240));
  const M=state.activeMonth;
  const row=document.querySelector('#cats [data-catsheet="ret"] .avail');
  return { pill:row?row.innerText:'', used:catUsed('ret',M), spent:catSpent('ret',M),
           breakdown:(()=>{ rfTab='breakdown'; activateTab('reflect'); renderReflectTab();
             return document.getElementById('bdBox').innerText; })() };
});
check('a category funded and then invested from reads as used up, not as money still there',
      /\$0\b/.test(growthPool.pill) && growthPool.used===400, `pill "${growthPool.pill}", used ${growthPool.used}`);
check('...while the spending breakdown still refuses to call an investment spending',
      growthPool.spent===0 && !/Retirement/.test(growthPool.breakdown),
      growthPool.breakdown.replace(/\n/g,' ').slice(0,80));
await p.setViewportSize({width:390,height:1000});

/* ---- 54. the ledger is one line, and an entry can finally be changed ----
   The same move as the Plan tab, and it carried the same risk: a row that used
   to hold six things now holds three, so everything that left has to be provably
   somewhere else. It also closed a gap that had been open the whole time - there
   was no way to EDIT a transaction, only to delete it, and deleting one takes
   the gut-check and the giving record attached to it along with the typo.

   The edit path is where the real danger is. An invest that is still yours has
   an asset behind it; changing the amount without moving that asset drifts net
   worth by exactly the size of the correction, which surfaces months later as a
   number nobody can trace. That gets its own check. */
await seed({...FULL, activeMonth:'2026-08',
  categories:[{id:'food',name:'Food'},{id:'roof',name:'Roof'}],
  budgets:{'2026-08':{food:600,roof:1200}},
  /* the asset the app itself would have created for that invest */
  assets:[{id:'ia',name:'Invested capital',value:400,kind:'real',cost:0,auto:'invest'}],
  transactions:[
    {id:'x1',type:'income',amount:3200,date:'2026-08-01',source:'Paycheck',srcType:'primary'},
    {id:'x2',type:'expense',amount:712.40,catId:'food',date:'2026-08-09',note:'Big grocery run',energy:'baseline'},
    {id:'x3',type:'invest',amount:400,date:'2026-08-02',source:'Index fund',ikind:'holds'},
    {id:'x4',type:'expense',amount:1200,catId:'roof',date:'2026-08-01',note:'Rent',recId:'rr'}],
  recurring:[{id:'rr',type:'expense',amount:1200,catId:'roof',freq:'monthly',anchor:'2026-08-01',day:1}]});
await p.reload(); await p.waitForTimeout(700);
const txRows = await p.evaluate(() => {
  activateTab('tx'); renderTx();
  const rows=[...document.querySelectorAll('#txList .tx')];
  return {
    rows:rows.length,
    tallest:Math.max(...rows.map(r=>Math.round(r.getBoundingClientRect().height))),
    allButtons:rows.every(r=>r.tagName==='BUTTON' && r.hasAttribute('data-txsheet')),
    labelled:rows.every(r=>/^Open the /.test(r.getAttribute('aria-label')||'')),
    /* what used to ride along on the second line */
    subsInList:document.querySelectorAll('#txList .tx-sub').length,
    delsInList:document.querySelectorAll('#txList [data-deltx]').length
  };
});
check('the ledger is one line per entry', txRows.rows===4 && txRows.tallest<=56, JSON.stringify(txRows));
check('...and the whole row is the target, not a delete cross at the end of it',
      txRows.allButtons===true && txRows.delsInList===0);
check('...announced by what pressing it does, not by the figure printed on it',
      txRows.labelled===true);
check('...with the second line and everything on it gone from the list',
      txRows.subsInList===0);
const txs = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  document.querySelector('[data-txsheet="x2"]').click(); await wait(200);
  const b=()=>document.getElementById('txSheetBody');
  const out={ on:document.getElementById('txSheet').classList.contains('on'),
    title:document.getElementById('txSheetTitle').innerText,
    amount:!!b().querySelector('[data-txedit="amount"]'),
    date:!!b().querySelector('[data-txedit="date"]'),
    cat:!!b().querySelector('[data-txedit="catId"]'),
    note:!!b().querySelector('[data-txedit="note"]'),
    energy:b().querySelectorAll('[data-txenergy]').length,
    energyOn:(b().querySelector('[data-txenergy].on')||{}).dataset,
    del:!!b().querySelector('[data-txdel]') };
  /* editing an ordinary expense moves the plan with it */
  const before=catUsed('food','2026-08');
  const inp=b().querySelector('[data-txedit="amount"]');
  inp.value='650'; inp.dispatchEvent(new Event('change',{bubbles:true})); await wait(250);
  out.edited={ stored:state.transactions.find(t=>t.id==='x2').amount,
               planBefore:before, planAfter:catUsed('food','2026-08') };
  /* re-tagging is possible at all, which it was not before */
  b().querySelector('[data-txenergy="fear"]').click(); await wait(200);
  out.retagged=state.transactions.find(t=>t.id==='x2').energy;
  /* a blank date is not an instruction */
  const di=b().querySelector('[data-txedit="date"]');
  di.value=''; di.dispatchEvent(new Event('change',{bubbles:true})); await wait(200);
  out.blankDateIgnored=state.transactions.find(t=>t.id==='x2').date;
  document.getElementById('txSheetX').click(); await wait(200);
  /* the one that can drift silently: an invest carries an asset behind it */
  const assetOf=()=>((state.assets||[]).find(a=>a.auto==='invest')||{}).value||0;
  document.querySelector('[data-txsheet="x3"]').click(); await wait(200);
  out.assetBefore=assetOf();
  const ai=b().querySelector('[data-txedit="amount"]');
  ai.value='550'; ai.dispatchEvent(new Event('change',{bubbles:true})); await wait(250);
  out.assetAfter=assetOf();
  out.investStored=state.transactions.find(t=>t.id==='x3').amount;
  document.getElementById('txSheetX').click(); await wait(200);
  /* a posted bill says where it came from, and says what editing it does not do */
  document.querySelector('[data-txsheet="x4"]').click(); await wait(200);
  out.repeatText=b().innerText;
  document.getElementById('txSheetX').click(); await wait(200);
  return out;
});
check('tapping an entry opens it', txs.on===true && /712|MONEY OUT/i.test(txs.title), txs.title.replace(/\n/g,' '));
check('...and every part of it can be changed, which none of it could before',
      txs.amount && txs.date && txs.cat && txs.note && txs.del,
      JSON.stringify({amount:txs.amount,date:txs.date,cat:txs.cat,note:txs.note,del:txs.del}));
check('...including the energy tag, which used to be write-once',
      txs.energy===4 && txs.retagged==='fear', `${txs.energy} choices, now ${txs.retagged}`);
check('editing an amount moves the plan with it',
      txs.edited.stored===650 && txs.edited.planAfter===txs.edited.planBefore-62.40,
      JSON.stringify(txs.edited));
check('...and a blank date is not an instruction', txs.blankDateIgnored==='2026-08-09', txs.blankDateIgnored);
/* The silent one. Change an invest and the asset behind it must move by the
   difference, or net worth drifts by exactly the size of the correction. */
check('editing an investment moves the asset behind it, so net worth cannot drift',
      txs.investStored===550 && txs.assetBefore===400 && txs.assetAfter===550,
      JSON.stringify({stored:txs.investStored, asset:`${txs.assetBefore} -> ${txs.assetAfter}`}));
check('a posted bill says so, and says that editing it does not touch the rule',
      /repeat/i.test(txs.repeatText) && /rule/i.test(txs.repeatText),
      txs.repeatText.replace(/\n/g,' ').slice(0,110));
/* Deleting still has to take the things hanging off it. */
const delSafe = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const assetOf=()=>((state.assets||[]).find(a=>a.auto==='invest')||{}).value||0;
  const before=assetOf();
  document.querySelector('[data-txsheet="x3"]').click(); await wait(200);
  /* Two taps now: the first arms, the second commits. The property that the
     first one deletes NOTHING is asserted here rather than assumed, because
     that is the whole point of arming it. */
  document.querySelector('#txSheetBody [data-txdel]').click(); await wait(280);
  const armedOnly={ still:state.transactions.some(t=>t.id==='x3'),
                    asked:!!document.querySelector('#txSheetBody .cs-arm') };
  document.querySelector('#txSheetBody [data-txdelyes]').click(); await wait(320);
  return { before, after:assetOf(), armedOnly,
           gone:!state.transactions.some(t=>t.id==='x3'),
           closed:!document.getElementById('txSheet').classList.contains('on') };
});
check('one tap on the entry delete asks rather than deletes',
      delSafe.armedOnly.still===true && delSafe.armedOnly.asked===true,
      JSON.stringify(delSafe.armedOnly));
check('deleting from the sheet still unwinds what was behind it, and closes',
      delSafe.gone===true && delSafe.after===0 && delSafe.before===550 && delSafe.closed===true,
      JSON.stringify(delSafe));

/* ---- 55. the streak is about what you still choose ----
   Asked from a phone: "is your spending streak the same as your recurring
   budget?" It was, and it should not have been. Every expense counted against
   the daily allowance, auto-posted bills included - so a rent of $1,250 landing
   on the 13th put that day $1,200 over and reset the streak, every month,
   forever. Measured before the fix: twenty clean days ran a streak of 26, and
   one posted rent cut it to 13.

   The rule now: a bill you already decided on is not a decision you make again
   on the day it lands, so anything the app posted from a rule is excluded from
   the allowance, the streak and the pace - and shown anyway, marked as not
   scored, because hiding money is worse than mis-scoring it. */
const streakSeed={...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  spendingMode:true, spendLimit:1500, day1:{date:'2026-08-01'}, trackStart:'2026-08-01',
  categories:[{id:'roof',name:'Roof'},{id:'fun',name:'Fun'}],
  /* No live rule in the fixture, on purpose: one would post its own rent on
     boot and the totals below would be counting two of them. The recId is what
     marks a transaction as posted-by-a-rule, and that is the thing under test. */
  transactions:Array.from({length:20},(_,i)=>({id:'d'+i,type:'expense',amount:20,catId:'fun',
    date:'2026-08-'+String(i+1).padStart(2,'0'),note:'Coffee'}))};
await seed(streakSeed); await p.reload(); await p.waitForTimeout(700);
const strk = await p.evaluate(() => {
  const read=()=>{ const st=[...document.querySelectorAll('#rewardCalBox .cal-stat')]
    .find(x=>/streak/i.test(x.textContent)); return st?+st.querySelector('.v').textContent.trim():null; };
  const cellOf=d=>(document.querySelector(`.cal-cell[data-day="${d}"]`)||{}).className||'';
  applySpending(); renderRewardCalendar();
  const before=read();
  state.transactions.push({id:'rent',type:'expense',amount:1250,catId:'roof',
    date:'2026-08-13',note:'Rent',recId:'rr'});
  save(); renderRewardCalendar();
  const after=read(), cell=cellOf(13);
  /* a bill typed in BY HAND still counts - the app cannot tell it from a
     purchase, and pretending otherwise would be the more dangerous lie */
  state.transactions.push({id:'hand',type:'expense',amount:900,catId:'roof',date:'2026-08-14',note:'Rent, typed'});
  save(); renderRewardCalendar();
  const handTyped=read();
  state.transactions=state.transactions.filter(t=>t.id!=='hand'); save(); renderRewardCalendar();
  // and the day card shows the bill while saying it is not scored
  calSelDay=13; renderRewardCalendar();
  const card=document.getElementById('calDay').innerText;
  return { before, after, cell, handTyped, card,
           bills:billsTotal('2026-08'), scored:Object.values(scoredSpentByDay('2026-08')).reduce((a,b)=>a+b,0) };
});
check('a posted bill no longer resets the under-budget streak',
      strk.before>0 && strk.after===strk.before, `${strk.before} before, ${strk.after} after the rent posted`);
check('...and the day it landed on is not marked over',
      !/\bover\b/.test(strk.cell), strk.cell);
check('...but a bill typed in by hand still counts, because nothing can tell it apart',
      strk.handTyped < strk.before, `${strk.handTyped} vs ${strk.before}`);
check('the two totals are kept apart rather than merged',
      strk.bills===1250 && strk.scored===400, JSON.stringify({bills:strk.bills, scored:strk.scored}));
check('the bill is still shown on the day, and said to be unscored',
      /Rent/.test(strk.card) && /not scored/i.test(strk.card) && /1,250/.test(strk.card),
      strk.card.replace(/\n/g,' ').slice(0,120));

/* ---- 56. a category you can make where you are standing ----
   Asked from a phone, looking at a category dropdown: "what happens if it's a
   different field? I'm not able to choose my own." Nothing happened. Every
   picker listed the categories that already existed and offered no way to make
   one, so an expense fitting none of them meant leaving the form, crossing to
   Plan, adding a category and starting the entry again - and the likelier
   outcome is the expense never gets logged at all. The quick-log rows had
   solved this; the affordance just never reached the other three pickers. */
/* Logging a transaction jumps the active month to the month it is dated in.
   With the fixture pinned to August and the clock in September, the entry this
   section adds landed in September, took the month with it, and the row it goes
   on to open was no longer on screen - the section crashed rather than failed.
   The fixture means "this month", so it says this month. */
const NEWCAT_D=CLOCK_D, NEWCAT_M=CLOCK_M;
await seed({...EMPTY, activeMonth:NEWCAT_M, uiMode:'all', stageReached:3, guidesOff:true,
  categories:[{id:'roof',name:'Roof'},{id:'food',name:'Food'}],
  budgets:{[NEWCAT_M]:{roof:1200,food:600}},
  transactions:[{id:'x',type:'expense',amount:41.10,catId:'food',date:NEWCAT_D,note:'Vet visit'}]});
await p.reload(); await p.waitForTimeout(700);
const newCat = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); renderTx(); await wait(250);
  const out={};
  const has=id=>{ const s=document.getElementById(id); return !!s && [...s.options].some(o=>o.value==='__new'); };
  renderRecurring(); await wait(120);
  /* The quick-log rows are built on demand, so ask the builder rather than the
     DOM - the option has to be in the list every row is made from. */
  out.offered={ log:has('txCat'), recurring:has('recCat'),
                quick:/value="__new"/.test(qlCatOptions()) };
  // the log form: refuse a blank name rather than filing it wrongly
  const sel=document.getElementById('txCat');
  sel.value='__new'; sel.dispatchEvent(new Event('change',{bubbles:true})); await wait(120);
  out.fieldAppears=!document.getElementById('txCatNew').classList.contains('hide');
  document.getElementById('txAmt').value='34.20';
  document.getElementById('addTx').click(); await wait(200);
  out.refusedBlank=state.transactions.length===1;
  document.getElementById('txCatNew').value='Pet supplies';
  document.getElementById('addTx').click(); await wait(300);
  const t=state.transactions.find(x=>x.amount===34.2);
  out.logged=!!t;
  out.filedUnder=(state.categories.find(c=>c.id===(t||{}).catId)||{}).name;
  out.onThePlan=state.categories.some(c=>c.name==='Pet supplies');
  // the transaction sheet: same option, and it must never file a literal __new
  document.querySelector('[data-txsheet="x"]').click(); await wait(250);
  const cs=document.getElementById('txsCat');
  out.sheetOffers=[...cs.options].some(o=>o.value==='__new');
  out.sheetShowsCurrent=cs.value==='food';
  cs.value='__new'; cs.dispatchEvent(new Event('change',{bubbles:true})); await wait(150);
  out.notFiledAsNew=state.transactions.find(x=>x.id==='x').catId==='food';
  const n=document.getElementById('txsCatNew'); n.value='Vet';
  n.dispatchEvent(new Event('change',{bubbles:true})); await wait(300);
  out.movedTo=(state.categories.find(c=>c.id===state.transactions.find(x=>x.id==='x').catId)||{}).name;
  closeTxSheet();
  return out;
});
check('every category picker offers a way to make one',
      newCat.offered.log && newCat.offered.recurring && newCat.offered.quick,
      JSON.stringify(newCat.offered));
check('...choosing it asks for the name right there',
      newCat.fieldAppears===true);
check('...and an unnamed one is refused rather than filed somewhere else',
      newCat.refusedBlank===true);
check('naming it logs the entry and puts the category on the plan',
      newCat.logged===true && newCat.filedUnder==='Pet supplies' && newCat.onThePlan===true,
      JSON.stringify({filed:newCat.filedUnder, onPlan:newCat.onThePlan}));
check('the entry sheet offers it too, and shows the category the entry already has',
      newCat.sheetOffers===true && newCat.sheetShowsCurrent===true);
check('...and never files a transaction under the literal "new category" choice',
      newCat.notFiledAsNew===true && newCat.movedTo==='Vet',
      `stayed put: ${newCat.notFiledAsNew}, moved to: ${newCat.movedTo}`);

/* ---- 57. one list of ways money comes in ----
   Asked from a phone while logging a paycheck, looking at five options:
   "shouldn't my options that I have in my plan be these?" The answer is no -
   the Plan is where money GOES and this asks where it CAME FROM, and the Type
   answers one question the app actually uses (one employer, or something you own
   or built). But the question found a real fault behind it: the form carried its
   own hand-typed copy of the five original kinds, so when Dividends and Rent
   were added to the model they appeared in the entry sheet and nowhere else -
   the one screen where people actually log a paycheck still offered five.

   So the property is not "there are eight options". It is that NO screen keeps
   its own copy of this list, which is the fault that can come back. */
/* Scanned in the FILE, not in the live DOM. The first version of this read
   document.documentElement.outerHTML and counted six - every one of them an
   option the app had just generated from the model, which is the thing being
   asked for rather than the thing being forbidden. A rendered select and a
   hand-typed one look identical once they are on the page; only the source
   tells them apart. */
const rawSrc=readFileSync(process.cwd()+'/app.html','utf8');
const hardcodedSrcOpts=(rawSrc.match(/<option value="(primary|side|freelance|skillmon|yield|rent)"/g)||[]).length;
const srcs = await p.evaluate(() => {
  activateTab('tx'); renderTx();
  const form=[...document.getElementById('txSrcType').options].map(o=>o.value);
  return { form, model:INCOME_SOURCES.map(x=>x.k), labels:INCOME_SOURCES.map(x=>x.label) };
});
check('the log form offers every way money comes in, not the five it was born with',
      srcs.form.join(',')===srcs.model.join(','), `form ${srcs.form.join(',')} / model ${srcs.model.join(',')}`);
check('...and no screen keeps a second copy of that list to drift from',
      hardcodedSrcOpts===0, `${hardcodedSrcOpts} hand-typed income options found in the source`);
check('...including capital income, which the model had and the form did not',
      srcs.form.includes('yield') && srcs.form.includes('rent'));
/* And the same escape hatch the category pickers got, for the same reason. */
const other = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  state.transactions=[]; save(); activateTab('tx'); renderTx(); await wait(200);
  const out={ offered:[...document.getElementById('txSrcType').options].some(o=>o.value==='other') };
  document.querySelector('#typeToggle button[data-t="income"]').click(); await wait(150);
  const sel=document.getElementById('txSrcType');
  sel.value='other'; sel.dispatchEvent(new Event('change',{bubbles:true})); await wait(120);
  out.asksForAName=!document.getElementById('txSrcOther').classList.contains('hide');
  document.getElementById('txAmt').value='715.97';
  document.getElementById('txSrc').value="Pat's paycheck";
  document.getElementById('txSrcOther').value='Snow plowing';
  document.getElementById('addTx').click(); await wait(300);
  const t=state.transactions[0];
  out.kept={type:t.srcType, label:t.srcLabel, name:t.source};
  out.reads=incomeKindLabel(t);
  /* the two readings that hang off the kind have to land somewhere defensible */
  out.independent=isIndependent(t.srcType);
  out.notYield=!isYieldSrc(t.srcType);
  return out;
});
check('income that fits none of them can still be named',
      other.offered===true && other.asksForAName===true && other.reads==='Snow plowing',
      JSON.stringify(other.kept));
check('...and it lands somewhere defensible rather than nowhere',
      other.independent===true && other.notYield===true,
      `counts as built-not-primary: ${other.independent}, treated as yield: ${!other.notYield}`);
check('...without losing the name of the income itself, which is a separate field',
      other.kept.name==="Pat's paycheck" && other.kept.label==='Snow plowing');

/* ---- 58. the ledger and the bank, introduced ----
   Asked directly: "how do I change my bank balance to reflect the income I
   received?" You could not. The two halves of the app were separate universes -
   the ledger knew what had been logged, the accounts knew what you last told
   them the bank said, and no transaction had ever carried an account. Logging
   $715.97 of income left checking sitting at exactly what it was.

   What it must NOT do is post straight to the balance. That would make the
   balance only as accurate as the typing, and the entire value of this number is
   that it comes from outside. So the ledger produces an expectation, the bank
   stays the scorecard, and the difference between them at reconcile time is
   money that moved without being logged. Those three properties are the feature;
   everything else is presentation. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  accounts:[{id:'chk',name:'Checking',kind:'checking',balance:2000,updated:'2026-08-20'},
            {id:'sav',name:'Savings',kind:'savings',balance:9000,updated:'2026-08-20'}],
  categories:[{id:'f',name:'Food'}]});
await p.reload(); await p.waitForTimeout(700);
const ledgerBank = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); renderTx(); await wait(250);
  const out={};
  out.pickerShown=!document.getElementById('fldAcct').classList.contains('hide');
  document.querySelector('#typeToggle button[data-t="income"]').click(); await wait(120);
  document.getElementById('txAcct').value='chk';
  document.getElementById('txAmt').value='715.97';
  document.getElementById('txSrc').value='Paycheck';
  document.getElementById('txDate').value='2026-08-26';
  document.getElementById('addTx').click(); await wait(300);
  const t=state.transactions[0];
  out.carriesAccount=t.acctId==='chk';
  /* the load-bearing pair: the bank did not move, the expectation did */
  out.bankHeld=bankTotal()===11000;
  out.expected=bankExpected();
  out.perAccount={chk:acctExpected(state.accounts[0]), sav:acctExpected(state.accounts[1])};
  /* reconcile against a bank that says something else */
  activateTab('goals'); renderAccounts(); await wait(200);
  const inp=document.querySelector('[data-acctbal="chk"]');
  inp.value='2700'; inp.dispatchEvent(new Event('change',{bubbles:true})); await wait(300);
  out.afterRecon={balance:state.accounts[0].balance, gap:state.accounts[0].lastGap};
  out.saysSo=document.getElementById('acctList').innerText;
  /* accepting the app's own figure is NOT a reconcile - nothing came from
     outside, so recording a gap would be inventing evidence */
  const inp2=document.querySelector('[data-acctbal="sav"]');
  inp2.value='8000'; inp2.dispatchEvent(new Event('change',{bubbles:true})); await wait(250);
  out.noHistoryNoGap=state.accounts[1].lastGap===undefined;
  return out;
});
check('an account picker appears when there is more than one account',
      ledgerBank.pickerShown===true);
check('a logged entry now names the account it moved money in or out of',
      ledgerBank.carriesAccount===true);
check('...the bank total does not move, because nothing came from the bank',
      ledgerBank.bankHeld===true);
check('...but the expected balance does, on the right account only',
      ledgerBank.expected===11715.97 && ledgerBank.perAccount.chk===2715.97 && ledgerBank.perAccount.sav===9000,
      JSON.stringify(ledgerBank.perAccount));
/* The whole point of the feature. */
check('reconciling against the real bank figure finds the money that never got logged',
      ledgerBank.afterRecon.balance===2700 && ledgerBank.afterRecon.gap===-15.97,
      JSON.stringify(ledgerBank.afterRecon));
check('...and says so in words rather than leaving it as a number to spot',
      /without being logged/i.test(ledgerBank.saysSo), ledgerBank.saysSo.replace(/\n/g,' ').slice(0,110));
check('...while an account with nothing logged against it records no gap to explain',
      ledgerBank.noHistoryNoGap===true);
/* Two ways this could go silently wrong. */
const bankEdges = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const out={};
  /* 1. Same-day double count. A balance typed today already includes today's
        activity, so only entries dated strictly after it may be added. */
  state.accounts=[{id:'a1',name:'One',kind:'checking',balance:500,updated:'2026-08-26'}];
  state.transactions=[{id:'s',type:'income',amount:100,date:'2026-08-26',acctId:'a1'},
                      {id:'l',type:'income',amount:40,date:'2026-08-27',acctId:'a1'}];
  save();
  out.sameDayIgnored=acctExpected(state.accounts[0])===540;
  /* 2. A posted bill moves real money and must name an account, or the
        expectation quietly ignores exactly the entries the app wrote itself. */
  state.transactions=[]; state.recurring=[{id:'r',type:'expense',amount:1200,catId:'f',
    freq:'monthly',anchor:'2026-08-01',day:1}];
  save(); postRecurring('2026-08');
  const posted=state.transactions.filter(t=>t.recId==='r');
  out.postedCarryAccount=posted.length>0 && posted.every(t=>t.acctId==='a1');
  return out;
});
check('a balance set today is not double-counted by what was logged today',
      bankEdges.sameDayIgnored===true);
check('bills the app posts itself name an account too, or the expectation ignores them',
      bankEdges.postedCarryAccount===true);

/* ---- 59. the one-time catch-up ----
   Everything logged before transactions carried an account has none, so it
   counts toward nothing - and telling somebody to re-enter a year of history is
   not an answer. One move files it all. The property that matters is not that it
   works but that it TELLS THE TRUTH FIRST: the preview names exactly how far the
   expected balance will move, and the move has to match. A bulk action that
   surprises you with the size of its own effect is worse than no bulk action. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  accounts:[{id:'chk',name:'Checking',kind:'checking',balance:2000,updated:'2026-08-20'},
            {id:'sav',name:'Savings',kind:'savings',balance:9000,updated:'2026-08-20'}],
  categories:[{id:'f',name:'Food'}],
  transactions:[
    {id:'old1',type:'income',amount:3200,date:'2026-07-01',source:'Paycheck'},
    {id:'old2',type:'expense',amount:900,catId:'f',date:'2026-07-05'},
    {id:'new1',type:'expense',amount:120,catId:'f',date:'2026-08-24'},
    {id:'has',type:'expense',amount:10,catId:'f',date:'2026-08-25',acctId:'chk'}]});
await p.reload(); await p.waitForTimeout(700);
const bf = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('goals'); renderAccounts(); await wait(250);
  const box=document.getElementById('acctBackfill');
  const out={ offered:!!document.getElementById('backfillGo'),
              counts:/3 entries/.test(box.innerText),
              /* the promise, read off the screen before anything happens */
              promised:(box.innerText.match(/by\s*[-−+]?\$[\d,.]+/)||[''])[0],
              expectedBefore:acctExpected(state.accounts[0]),
              bankBefore:bankTotal() };
  document.getElementById('backfillGo').click(); await wait(300);
  out.after={ orphans:state.transactions.filter(t=>!t.acctId).length,
              expected:acctExpected(state.accounts[0]),
              bank:bankTotal() };
  out.moved=Math.round((out.after.expected-out.expectedBefore)*100)/100;
  renderAccounts(); await wait(150);
  out.offerGone=document.getElementById('acctBackfill').innerText.trim()==='';
  return out;
});
check('history with no account on it is offered a home, counted honestly',
      bf.offered===true && bf.counts===true, bf.promised);
check('...the preview names how far the expected balance will move',
      /120/.test(bf.promised), bf.promised);
check('...and the move is exactly what was promised, not a surprise',
      bf.moved===-120, `promised ${bf.promised}, moved ${bf.moved}`);
check('...only entries after the balance date can move it - the rest is just history',
      bf.after.expected===1870 && bf.expectedBefore===1990,
      `${bf.expectedBefore} -> ${bf.after.expected}`);
check('...the bank total is untouched, because nothing came from the bank',
      bf.after.bank===bf.bankBefore && bf.after.bank===11000);
check('...nothing is left homeless, and the offer stops being made',
      bf.after.orphans===0 && bf.offerGone===true);
/* It must not appear with nowhere to file to. */
const bfNone = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  state.accounts=[]; state.transactions=[{id:'z',type:'expense',amount:5,catId:'f',date:'2026-08-24'}];
  save(); renderAccounts(); await wait(200);
  return document.getElementById('acctBackfill').innerText.trim();
});
check('...and is never offered when there is no account to file to', bfNone==='', bfNone.slice(0,50));

/* ---- 60. the fast way in knows where the money came from ----
   From a phone, on the quick log: "instead of making this group list so long
   just have an add another feature to keep things tight - also it looks like
   it's missing a funding source to say which bank balance you want to add or
   withdraw from." Both right. It opened on three empty rows, which reads as a
   form to fill rather than a line to jot, and it was the one path into the app
   with no account on it at all - so the fastest way to log was also the only way
   to create history the catch-up on Build then has to rescue.

   The account is asked ONCE for the batch, not once per line: a notepad of
   purchases came off a single card, and asking eleven times would be worse than
   not asking. And after a photo is read - the one path where a whole batch
   arrives without a single field being touched - the question is raised where
   the person is already looking. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  accounts:[{id:'chk',name:'Checking',kind:'checking',balance:2000,updated:'2026-08-20'},
            {id:'amex',name:'Amex',kind:'checking',balance:500,updated:'2026-08-20'}],
  categories:[{id:'f',name:'Food'},{id:'c',name:'Coffee'}]});
await p.reload(); await p.waitForTimeout(700);
const qlAcct = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); quickLogOpen=true; renderQuickLog(); await wait(250);
  const out={ rows:document.querySelectorAll('.ql-row').length,
              askedOnce:document.querySelectorAll('#qlAcct').length,
              perRow:document.querySelectorAll('.ql-row select[id^=qlAcct]').length,
              defaultsToLiquid:(document.getElementById('qlAcct')||{}).value };
  document.getElementById('qlAdd').click(); document.getElementById('qlAdd').click(); await wait(150);
  const rows=[...document.querySelectorAll('.ql-row')];
  const fill=(r,what,amt,cat)=>{ r.querySelector('.ql-what').value=what; r.querySelector('.ql-amt').value=amt;
    const c=r.querySelector('.ql-cat'); c.value=cat; c.dispatchEvent(new Event('change',{bubbles:true})); };
  fill(rows[0],'Coffee','4.20','c'); fill(rows[1],'Lunch','12','f'); fill(rows[2],'Groceries','86.40','f');
  document.getElementById('qlAcct').value='amex';
  document.getElementById('qlDate').value='2026-08-26';
  document.getElementById('qlSave').click(); await wait(400);
  out.logged=state.transactions.length;
  out.allOnChosen=state.transactions.every(t=>t.acctId==='amex');
  out.expected={chk:acctExpected(state.accounts[0]), amex:acctExpected(state.accounts[1])};
  /* the photo path raises it rather than letting a whole batch land unasked */
  quickLogOpen=true; renderQuickLog(); await wait(200);
  qlAskAccount(4);
  out.afterPhoto={ highlighted:/asking/.test(document.querySelector('.ql-acct').className),
                   says:document.querySelector('.ql-acct-n').innerText };
  return out;
});
check('the quick log opens on one line, not a wall of empty rows',
      qlAcct.rows===1, `${qlAcct.rows} rows`);
check('it asks where the money came from once for the batch, never once per line',
      qlAcct.askedOnce===1 && qlAcct.perRow===0,
      `${qlAcct.askedOnce} picker, ${qlAcct.perRow} per-row`);
check('...and every line of the batch lands on the account that was chosen',
      qlAcct.logged===3 && qlAcct.allOnChosen===true);
check('...moving that account and leaving the other one alone',
      qlAcct.expected.amex===397.4 && qlAcct.expected.chk===2000,
      JSON.stringify(qlAcct.expected));
check('after a photo is read the question is raised, not left to be missed',
      qlAcct.afterPhoto.highlighted===true && /which account/i.test(qlAcct.afterPhoto.says),
      qlAcct.afterPhoto.says);
/* With one account there is nothing to ask, so it states the answer instead. */
const qlOne = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  state.accounts=[{id:'only',name:'Checking',kind:'checking',balance:100,updated:'2026-08-20'}];
  /* logging closes the panel, so it has to be reopened before the next look */
  state.transactions=[]; save(); quickLogOpen=true; renderQuickLog(); await wait(200);
  const out={ noPicker:!document.getElementById('qlAcct'),
              statesIt:/Coming out of/i.test(document.querySelector('.ql-acct').innerText) };
  const r=document.querySelector('.ql-row');
  r.querySelector('.ql-what').value='Coffee'; r.querySelector('.ql-amt').value='5';
  const c=r.querySelector('.ql-cat'); c.value='c'; c.dispatchEvent(new Event('change',{bubbles:true}));
  document.getElementById('qlSave').click(); await wait(300);
  out.stillFiled=state.transactions.every(t=>t.acctId==='only');
  /* and with no accounts at all it must not invent one or break */
  state.accounts=[]; state.transactions=[]; save(); quickLogOpen=true; renderQuickLog(); await wait(150);
  out.silentWithNone=!document.querySelector('.ql-acct');
  const r2=document.querySelector('.ql-row');
  r2.querySelector('.ql-what').value='Tea'; r2.querySelector('.ql-amt').value='3';
  const c2=r2.querySelector('.ql-cat'); c2.value='c'; c2.dispatchEvent(new Event('change',{bubbles:true}));
  document.getElementById('qlSave').click(); await wait(300);
  out.noneLogsFine=state.transactions.length===1 && !state.transactions[0].acctId;
  return out;
});
check('one account is stated rather than asked about',
      qlOne.noPicker===true && qlOne.statesIt===true);
check('...and the line is still filed against it',
      qlOne.stillFiled===true);
check('with no accounts at all it says nothing and still logs',
      qlOne.silentWithNone===true && qlOne.noneLogsFine===true);

/* ---- 61. nothing that took work to build dies on one tap ----
   From a phone, on the recurring list: "the delete button is too destructive."
   It was - one tap ended a schedule with nothing in between. A rule is not a row
   of data; it is the thing standing between somebody and forgetting their rent,
   and rebuilding it means recalling an amount, a cadence and an anchor date they
   set weeks ago.

   The confirm has a job beyond slowing the hand down: it answers the question
   the hand hesitated over. Stopping a schedule does not touch the money it
   already posted, and saying so is the difference between a pause and a fear of
   losing history. Accounts get the same treatment, and one consequence more -
   now that entries name an account, removing one leaves whatever pointed at it
   with nowhere to be, so the count is stated before rather than discovered
   after. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  accounts:[{id:'chk',name:'Checking',kind:'checking',balance:2000,updated:'2026-08-20'}],
  categories:[{id:'f',name:'Food'}],
  recurring:[{id:'r1',type:'income',amount:2435.22,source:'Kristi',freq:'biweekly',anchor:'2026-08-14'}],
  transactions:[{id:'p1',type:'income',amount:2435.22,source:'Kristi',date:'2026-08-14',recId:'r1',acctId:'chk'},
                {id:'p2',type:'income',amount:2435.22,source:'Kristi',date:'2026-08-28',recId:'r1',acctId:'chk'}]});
await p.reload(); await p.waitForTimeout(700);
const destr = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); renderRecurring(); await wait(250);
  const out={};
  document.querySelector('[data-delrec="r1"]').click(); await wait(200);
  out.asked=document.getElementById('recList').innerText;
  out.survivedTheTap=state.recurring.length===1;
  /* backing out has to actually back out */
  document.querySelector('[data-delrecno]').click(); await wait(200);
  out.keptOnNo=state.recurring.length===1 && !document.querySelector('[data-delrecyes]');
  document.querySelector('[data-delrec="r1"]').click(); await wait(150);
  document.querySelector('[data-delrecyes="r1"]').click(); await wait(300);
  out.after={rules:state.recurring.length, postedKept:state.transactions.length};
  /* accounts, same pattern, plus the entries that point at it */
  activateTab('goals'); renderAccounts(); await wait(250);
  document.querySelector('[data-acctdel="chk"]').click(); await wait(200);
  out.acctAsked=document.getElementById('acctList').innerText;
  out.acctSurvived=state.accounts.length===1;
  document.querySelector('[data-acctdelno]').click(); await wait(200);
  out.acctKeptOnNo=state.accounts.length===1;
  return out;
});
check('the recurring cross asks before it ends a schedule',
      destr.survivedTheTap===true && /Stop Kristi repeating/i.test(destr.asked),
      destr.asked.replace(/\s+/g,' ').slice(0,70));
/* The reassurance is the point, not decoration: people hesitate because they
   think deleting the rule deletes the paychecks. */
check('...and says the money already posted is not going anywhere',
      /2/.test(destr.asked) && /stay on Track/i.test(destr.asked),
      destr.asked.replace(/\s+/g,' ').slice(0,150));
check('...backing out leaves it exactly where it was', destr.keptOnNo===true);
check('...and going through stops the schedule without touching what it posted',
      destr.after.rules===0 && destr.after.postedKept===2, JSON.stringify(destr.after));
check('removing an account asks too, and names what it costs',
      destr.acctSurvived===true && /Remove Checking/i.test(destr.acctAsked)
      && /\$2,000/.test(destr.acctAsked), destr.acctAsked.replace(/\s+/g,' ').slice(0,80));
check('...including the entries that would be left with nowhere to be',
      /2 entries/i.test(destr.acctAsked) && /new home/i.test(destr.acctAsked),
      destr.acctAsked.replace(/\s+/g,' ').slice(0,160));
check('...and it too can be backed out of', destr.acctKeptOnNo===true);

/* ---- 62. the streams you already named, and the link to the plan ----
   Two halves of one observation from a phone. "Wasn't typing in the source
   directly contradicting the recurring funds? Why would it be typable if I can
   just choose from an account I have set up for recurring?" - and then "I'm
   still missing the link between the way Track and Plan are affiliated."

   The first is a straight contradiction: the recurring rules on Plan ARE a list
   of named income streams, set up on purpose with a cadence and an amount, and
   the log form then asked for the name to be typed again from memory, where a
   typo made a second stream matching nothing.

   The second was true and invisible rather than absent. An expense has always
   carried a category and that category has always had a number on Plan - but
   nothing on the Track side ever showed it, so the relationship existed only in
   the data. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  accounts:[{id:'joint',name:'Joint Checking',kind:'checking',balance:2000,updated:'2026-08-20'},
            {id:'sav',name:'Savings',kind:'savings',balance:500,updated:'2026-08-20'}],
  categories:[{id:'f',name:'Food'},{id:'g',name:'Gas'}],
  budgets:{'2026-08':{f:600,g:200}},
  recurring:[{id:'r1',type:'income',amount:2435.22,source:'Kristi',freq:'biweekly',anchor:'2026-08-14',acctId:'joint'},
             {id:'r2',type:'income',amount:1600,source:'Hollywood',freq:'biweekly',anchor:'2026-08-21',acctId:'sav'}],
  transactions:[{id:'x',type:'expense',amount:145,catId:'f',date:'2026-08-24',note:'Groceries',acctId:'joint'},
                {id:'y',type:'expense',amount:300,catId:'f',date:'2026-08-12',acctId:'joint'},
                {id:'t1',type:'income',amount:400,source:'Yard sale',date:'2026-08-10',srcType:'sale',acctId:'joint'}]});
await p.reload(); await p.waitForTimeout(700);
const streams = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); renderTx(); await wait(300);
  document.querySelector('#typeToggle button[data-t="income"]').click(); await wait(200);
  const sp=document.getElementById('txSrcPick');
  const out={ offered:[...sp.options].map(o=>o.value),
              rulesFirst:[...sp.options].slice(0,2).map(o=>o.textContent),
              typingHidden:document.getElementById('txSrc').classList.contains('hide') };
  /* choosing one carries what that stream was last known to be */
  sp.value='Hollywood'; sp.dispatchEvent(new Event('change',{bubbles:true})); await wait(200);
  out.filledAccount=document.getElementById('txAcct').value;
  document.getElementById('txAmt').value='1600';
  document.getElementById('txDate').value='2026-08-26';
  document.getElementById('addTx').click(); await wait(350);
  const t=state.transactions.find(x=>x.amount===1600);
  out.logged={source:t.source, acctId:t.acctId};
  /* and the escape hatch survives, or a first paycheck could never be logged */
  document.querySelector('#typeToggle button[data-t="income"]').click(); await wait(150);
  const sp2=document.getElementById('txSrcPick');
  sp2.value='__new'; sp2.dispatchEvent(new Event('change',{bubbles:true})); await wait(150);
  out.canStillType=!document.getElementById('txSrc').classList.contains('hide');
  document.getElementById('txSrc').value='Snow plowing';
  document.getElementById('txAmt').value='90';
  document.getElementById('addTx').click(); await wait(350);
  out.typedLogged=(state.transactions.find(x=>x.amount===90)||{}).source;
  out.joinsTheList=[...document.getElementById('txSrcPick').options].map(o=>o.value).includes('Snow plowing');
  return out;
});
check('the streams named on Plan are offered instead of typed from memory',
      streams.offered.includes('Kristi') && streams.offered.includes('Hollywood'),
      streams.offered.join(','));
check('...with the deliberate ones first and marked as repeating',
      streams.rulesFirst.every(x=>/repeats/.test(x)), streams.rulesFirst.join(' / '));
check('...and picking one carries the account that stream lands in',
      streams.filledAccount==='sav' && streams.logged.acctId==='sav' && streams.logged.source==='Hollywood',
      JSON.stringify(streams.logged));
check('...while a stream with no history can still simply be typed',
      streams.canStillType===true && streams.typedLogged==='Snow plowing' && streams.joinsTheList===true);
/* A rule that does not know where its money lands posts entries counting toward
   no balance - the same hole as the log form, one step upstream where it
   repeats every month. */
const recAcct = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  renderRecurring(); await wait(200);
  const out={ asks:!document.getElementById('recAcctWrap').classList.contains('hide') };
  recEditLoad('r2'); await wait(200);
  out.loadsExisting=document.getElementById('recAcct').value==='sav';
  return out;
});
check('a recurring rule is asked which account it moves money through',
      recAcct.asks===true);
check('...and editing one shows the account it already had', recAcct.loadsExisting===true);
/* The link, finally on screen. */
const planLink = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); renderTx(); await wait(250);
  document.querySelector('[data-txsheet="x"]').click(); await wait(300);
  const txt=document.getElementById('txSheetBody').innerText;
  closeTxSheet();
  return txt;
});
check('opening an expense shows where it sits in the plan',
      /where this sits in the plan/i.test(planLink) && /\$600/.test(planLink) && /\$445/.test(planLink),
      planLink.replace(/\s+/g,' ').match(/WHERE THIS SITS[^A-Z]*/i)?.[0]?.slice(0,90)||'');
check('...including this entry\'s share of what has left that category',
      /33%/.test(planLink), (planLink.match(/This one is [^.]*/)||[''])[0]);

/* ---- 63. two budgets, one dollar ----
   From a phone, on a $225 grocery run the calendar called "$219.26 over" while
   the Plan tab said Food still had $477.35 left: "it's part of my planned budget
   monies that has been accounted for - is this a direct contradiction?" It was,
   and it was measurable: two screens, the same $267.65, opposite verdicts, with
   the calendar also disagreeing with its own month-to-date figure.

   A daily allowance divides a month by its days and assumes money leaves evenly.
   Groceries do not. The allowance was built for the drip - coffee, takeout, the
   impulse buys - so it is told what to watch, and leaves the rest to the plan
   where it was already accounted for. Nothing chosen still means everything,
   because a spend-mode user with no plan has nothing to hand it off to. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  spendingMode:true, spendLimit:1500, trackStart:'2026-08-01', day1:{date:'2026-08-01'},
  categories:[{id:'food',name:'Food'},{id:'groc',name:'Groceries',parentId:'food'},
              {id:'coffee',name:'Coffee'},{id:'take',name:'Takeout'}],
  budgets:{'2026-08':{groc:745,coffee:80,take:120}},
  transactions:[{id:'w',type:'expense',amount:225,catId:'groc',date:'2026-08-25',note:'Walmart'},
                {id:'c',type:'expense',amount:42.65,catId:'take',date:'2026-08-25',note:'Chic fil a'}]});
await p.reload(); await p.waitForTimeout(700);
const twoBudgets = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  applySpending(); calSelDay=25; renderRewardCalendar(); await wait(250);
  const verdict=()=>document.getElementById('calDay').innerText.split('\n')[1];
  const out={ watchesAllByDefault:!dayToDayOn(), before:verdict() };
  /* the plan's view of the very same money, for the contradiction itself */
  out.planSaysLeft=catAssigned('groc','2026-08')-catUsed('groc','2026-08');
  document.querySelector('[data-dtd="coffee"]').click(); await wait(180);
  document.querySelector('[data-dtd="take"]').click(); await wait(180);
  out.after=verdict();
  out.card=document.getElementById('calDay').innerText;
  out.stillShown=/Walmart/.test(out.card);
  /* a parent has to cover its children or the same hole opens one level down */
  state.dayToDay=['food']; save(); renderRewardCalendar(); await wait(180);
  out.parentCovers=/225/.test(document.getElementById('calDay').innerText.split('\n')[2]);
  /* and it must be reversible */
  document.getElementById('dtdClear').click(); await wait(180);
  out.cleared=verdict();
  return out;
});
check('with nothing chosen the allowance still watches everything',
      twoBudgets.watchesAllByDefault===true);
check('the contradiction was real: planned money marked over while the plan called it funded',
      /over/i.test(twoBudgets.before) && twoBudgets.planSaysLeft===520,
      `${twoBudgets.before} / plan says ${twoBudgets.planSaysLeft} left`);
check('...telling it what to watch resolves the day it was wrong about',
      /saved/i.test(twoBudgets.after), `${twoBudgets.before} -> ${twoBudgets.after}`);
check('...without hiding the money, which is still on the day and explained',
      twoBudgets.stillShown===true && /plan already funds/i.test(twoBudgets.card),
      (twoBudgets.card.match(/\$225 of that[^.]*\./)||[''])[0]);
check('...a parent covers its subcategories, so nothing slips through one level down',
      twoBudgets.parentCovers===true);
check('...and it can be handed back to watching everything',
      /over/i.test(twoBudgets.cleared), twoBudgets.cleared);
/* The unrelated half of the same message: an entry on the day card was dead
   text while the identical row on Track opened it. */
const dayTap = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  calSelDay=25; renderRewardCalendar(); await wait(200);
  const rows=[...document.querySelectorAll('#calDay .ce')];
  const out={ count:rows.length,
              allTappable:rows.every(r=>r.tagName==='BUTTON' && r.hasAttribute('data-txsheet')),
              labelled:rows.every(r=>/^Open the /.test(r.getAttribute('aria-label')||'')) };
  rows[0].click(); await wait(300);
  out.opened=document.getElementById('txSheet').classList.contains('on');
  closeTxSheet();
  return out;
});
check('every entry on a calendar day opens, like the same row does on Track',
      dayTap.count===2 && dayTap.allTappable===true && dayTap.opened===true,
      JSON.stringify(dayTap));
check('...announced by what pressing it does', dayTap.labelled===true);

/* ---- 64. the stale-reference sweep ----
   A deep-dive audit of everything that points at something else. The pattern:
   a list or a field holds an id, the thing it names gets deleted, and the code
   reading it fails SILENTLY - not with an error but with a wrong number that
   looks fine. The worst found: a dayToDay watch list left holding only deleted
   categories made catWatched false for every real one, so the allowance watched
   nothing, every day scored perfect, and the streak became fiction. The same
   shape one field over: an acctId pointing at a deleted account counts toward
   no balance AND is skipped by the backfill, so the delete-confirm's promise of
   "a new home" was false.

   Each reference is healed at three layers - the delete path, load-time
   normalize, and (for rules) the moment of use - because any one of them alone
   leaves a window. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  spendingMode:true, spendLimit:1500, trackStart:'2026-08-01', day1:{date:'2026-08-01'},
  categories:[{id:'coffee',name:'Coffee'},{id:'f',name:'Food'}],
  accounts:[{id:'live',name:'Live',kind:'checking',balance:100,updated:'2026-08-01'}],
  /* a backup carrying every kind of ghost at once */
  dayToDay:['ghostCat','coffee'],
  recurring:[{id:'r',type:'expense',amount:10,catId:'f',freq:'monthly',anchor:'2026-08-05',day:5,acctId:'ghostAcct'}],
  transactions:[{id:'t1',type:'expense',amount:50,catId:'f',date:'2026-08-20',acctId:'ghostAcct'}]});
await p.reload(); await p.waitForTimeout(700);
const sweep = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const out={};
  /* load healed the backup's ghosts */
  out.loadHealed={ dayToDay:state.dayToDay.slice(), txAcct:state.transactions.find(t=>t.id==='t1').acctId,
                   ruleAcct:state.recurring[0].acctId };
  /* the freed entry is an orphan the backfill can now rescue */
  activateTab('goals'); renderAccounts(); await wait(200);
  out.backfillOffers=/no account on/.test(document.getElementById('acctBackfill').innerText);
  /* deleting a watched category through its sheet prunes the watch list */
  activateTab('budget'); renderBudget(); await wait(200);
  openCatSheet('coffee'); await wait(200);
  /* Two taps, like the account delete directly below and like the recurring
     list: the first arms, the second confirms. Categories were the odd one out
     until a phone report - "deleting a category is still too destructive" -
     brought them into line, and this check drove it with one tap. */
  document.querySelector('#catSheetBody [data-del="coffee"]').click(); await wait(250);
  out.catArmedFirst=state.categories.some(c=>c.id==='coffee');
  document.querySelector('#catSheetBody [data-delyes="coffee"]').click(); await wait(300);
  out.catDeletePrunes=state.dayToDay.length===0;
  /* deleting an account through its confirm frees entries and rules at once */
  state.transactions=[{id:'t2',type:'expense',amount:5,catId:'f',date:'2026-08-21',acctId:'live'}];
  state.recurring=[{id:'r2',type:'expense',amount:5,catId:'f',freq:'monthly',anchor:'2026-08-06',day:6,acctId:'live'}];
  save(); activateTab('goals'); renderAccounts(); await wait(200);
  document.querySelector('[data-acctdel="live"]').click(); await wait(200);
  document.querySelector('[data-acctdelyes="live"]').click(); await wait(300);
  out.acctDeleteFrees={ tx:!state.transactions[0].acctId, rule:!state.recurring[0].acctId };
  /* a rule with a dead account posts through the default at the moment of use */
  state.accounts=[{id:'nu',name:'New',kind:'checking',balance:0,updated:'2026-08-26'}];
  state.recurring=[{id:'r3',type:'expense',amount:7,catId:'f',freq:'monthly',anchor:'2026-08-07',day:7,acctId:'stillGhost'}];
  state.transactions=[]; save(); postRecurring('2026-08');
  out.postGuard=(state.transactions[0]||{}).acctId;
  return out;
});
check('a loaded backup has every ghost reference healed at once',
      sweep.loadHealed.dayToDay.join(',')==='coffee' && sweep.loadHealed.txAcct===undefined
      && sweep.loadHealed.ruleAcct===undefined, JSON.stringify(sweep.loadHealed));
check('...and the freed entry becomes an orphan the catch-up offers a home',
      sweep.backfillOffers===true);
check('deleting a watched category needs the confirm, not one tap',
      sweep.catArmedFirst===true);
check('...and then prunes the watch list, so it can never watch only ghosts',
      sweep.catDeletePrunes===true);
check('deleting an account frees its entries and rules in the same stroke',
      sweep.acctDeleteFrees.tx===true && sweep.acctDeleteFrees.rule===true);
check('a rule pointing at a dead account posts through the default, never the ghost',
      sweep.postGuard==='nu', String(sweep.postGuard));
/* The scoped-versus-total leak: the headline must never understate what left. */
const totals = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  state.categories=[{id:'g',name:'Groceries'},{id:'c2',name:'Coffee'}];
  state.dayToDay=['c2']; state.recurring=[];
  state.transactions=[
    {id:'i',type:'income',amount:3000,date:'2026-08-01',source:'Pay'},
    {id:'big',type:'expense',amount:900,catId:'g',date:'2026-08-10'},
    {id:'sm',type:'expense',amount:20,catId:'c2',date:'2026-08-11'}];
  save(); applySpending(); renderSpending(); await wait(250);
  const txt=document.getElementById('spendingBox').innerText;
  /* innerText folds these differently per browser, so match loosely: the label
     and the total both present, not a pinned line shape */
  return { hasTile:/Spent this month/.test(txt), hasTotal:/\$920/.test(txt),
           pct:(txt.match(/you've spent [^ ]+/)||[''])[0],
           namesExcluded:/categories your plan funds/.test(txt) };
});
check('the spend headline states everything that left, not just the watched slice',
      totals.hasTile && totals.hasTotal && /31%/.test(totals.pct),
      JSON.stringify({tile:totals.hasTile, total:totals.hasTotal, pct:totals.pct}));
check('...while the limit bar names what it excludes instead of hiding it',
      totals.namesExcluded===true);
/* Linked records follow an edited amount. */
const follows = await p.evaluate(() => {
  state.transactions=[{id:'g1',type:'expense',amount:100,catId:'g',date:'2026-08-20',note:'Gift'}];
  state.giving=[{id:'gv',name:'Church',amount:100,date:'2026-08-20',txId:'g1'}];
  state.impulse=[{id:'im',type:'buy',name:'Gift',amount:100,date:'2026-08-20',txId:'g1'}];
  save(); editTx('g1',{amount:85});
  return { giving:state.giving[0].amount, impulse:state.impulse[0].amount };
});
check('the Giving ledger and the Shield follow an edited amount instead of keeping the typo',
      follows.giving===85 && follows.impulse===85, JSON.stringify(follows));

/* ---- 65. budgeted against actual, at the moment of logging ----
   Drawn on a screenshot in two inks over the Amount field: the figure a stream
   is SET UP to pay (green - "budgeted = predetermined") and the figure that
   actually landed (red - "actual"). The rule already held the first number and
   the field held the second, and the form never put them next to each other -
   so a short paycheck logged without comment, and the shortfall surfaced weeks
   later as an unexplained reconcile gap, if at all.

   The properties: picking a repeating stream pre-fills its usual amount (the
   usual case costs zero typing), typing the actual prices the difference live
   in both directions, a hand-typed actual is never clobbered by a stream
   re-pick, the discrepancy survives on the entry sheet after the toast dies,
   and a source with no rule invents no expectation. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  accounts:[{id:'joint',name:'Joint Checking',kind:'checking',balance:2000,updated:'2026-08-20'}],
  categories:[{id:'f',name:'Food'}],
  recurring:[{id:'r1',type:'income',amount:2435.22,source:'Kristi',freq:'biweekly',anchor:'2026-08-14',acctId:'joint'}]});
await p.reload(); await p.waitForTimeout(700);
const bva = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); renderTx(); await wait(300);
  document.querySelector('#typeToggle button[data-t="income"]').click(); await wait(200);
  const sp=document.getElementById('txSrcPick'), amt=document.getElementById('txAmt'),
        note=()=>document.getElementById('txAmtNote').innerText;
  const out={};
  sp.value='Kristi'; sp.dispatchEvent(new Event('change',{bubbles:true})); await wait(200);
  out.prefilled=amt.value;
  amt.value='2300'; amt.dispatchEvent(new Event('input',{bubbles:true})); await wait(120);
  out.short=note();
  amt.value='2600'; amt.dispatchEvent(new Event('input',{bubbles:true})); await wait(120);
  out.over=note();
  /* a hand-typed actual survives a stream re-pick - replacing it would be the
     form deciding it knows the paycheck better than the person holding it */
  amt.value='1000'; amt.dispatchEvent(new Event('input',{bubbles:true}));
  sp.dispatchEvent(new Event('change',{bubbles:true})); await wait(120);
  out.handTypedKept=amt.value;
  amt.value='2300'; amt.dispatchEvent(new Event('input',{bubbles:true}));
  document.getElementById('addTx').click(); await wait(400);
  /* find the HAND-LOGGED entry, not the occurrence the rule auto-posted on
     boot - the rule's own posting is exactly on-amount and would mask the test */
  const mine=state.transactions.find(t=>t.type==='income' && !t.recId);
  out.logged=(mine||{}).amount;
  renderTx(); await wait(200);
  document.querySelector('[data-txsheet="'+mine.id+'"]').click(); await wait(250);
  out.sheet=document.getElementById('txSheetBody').innerText;
  closeTxSheet();
  /* no rule, no expectation */
  document.querySelector('#typeToggle button[data-t="income"]').click(); await wait(150);
  const sp2=document.getElementById('txSrcPick');
  sp2.value='__new'; sp2.dispatchEvent(new Event('change',{bubbles:true})); await wait(120);
  out.noRuleNoNote=note()==='';
  return out;
});
check('picking a repeating stream pre-fills the amount it is set to pay',
      bva.prefilled==='2435.22', bva.prefilled);
check('...typing the actual prices a shortfall while it is being typed',
      /135\.22/.test(bva.short) && /less/.test(bva.short), bva.short);
check('...and an overage, pointing at the rule that now understates',
      /164\.78/.test(bva.over) && /update the rule/i.test(bva.over), bva.over);
check('a hand-typed actual is never clobbered by a stream re-pick',
      bva.handTypedKept==='1000', bva.handTypedKept);
check('the discrepancy survives on the entry sheet after the toast is gone',
      /Short of usual/i.test(bva.sheet) && /135\.22/.test(bva.sheet),
      (bva.sheet.match(/Short of usual[^\n]*\n[^\n]*/)||[''])[0].replace(/\n/g,' '));
check('a source with no rule behind it invents no expectation',
      bva.noRuleNoNote===true);

/* ---- 66. an investment lands somewhere ----
   From a phone, on the recurring invest form: "where it goes should attach to
   an account." Right - and the attachment carries a trap the free-text field
   never had. A tracked destination lives in that account's balance, which
   already feeds net worth through bankTotal(); the auto Invested-capital asset
   feeds net worth too. Count a deposit in both and the same dollars print
   twice. Count it in neither - say, after the destination account is deleted -
   and they vanish. The invariant is: counted once, always.

   So one transaction now moves BOTH sides - the source account's expectation
   down, the destination's up, which is what a transfer is - and the auto asset
   holds only investments into things the app does not track as accounts. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  accounts:[{id:'joint',name:'Joint Checking',kind:'checking',balance:2000,updated:'2026-08-20'},
            {id:'roth',name:'Roth IRA',kind:'invest',balance:5000,updated:'2026-08-20'}],
  categories:[{id:'f',name:'Food'}]});
await p.reload(); await p.waitForTimeout(700);
const dest = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); renderTx(); await wait(300);
  document.querySelector('#typeToggle button[data-t="invest"]').click(); await wait(200);
  const pick=document.getElementById('txInvPick');
  const out={ pickerShown:!pick.classList.contains('hide'),
              investKindFirst:[...pick.options][0].textContent==='Roth IRA',
              escapeHatch:[...pick.options].some(o=>o.value==='') };
  pick.value='roth'; pick.dispatchEvent(new Event('change',{bubbles:true}));
  document.getElementById('txAmt').value='100';
  document.getElementById('txAcct').value='joint';
  document.getElementById('txDate').value='2026-08-26';
  document.getElementById('addTx').click(); await wait(400);
  const t=state.transactions.find(x=>x.type==='invest');
  out.namedItself=t.source==='Roth IRA';
  out.bothSides={ joint:acctExpected(state.accounts[0]), roth:acctExpected(state.accounts[1]) };
  out.autoAsset=((state.assets||[]).find(a=>a.auto==='invest')||{}).value||0;
  out.netWorth=netWorth();
  /* the free-text lane keeps feeding the auto asset - money into things the app
     does not track as accounts is still real */
  document.querySelector('#typeToggle button[data-t="invest"]').click(); await wait(150);
  const p2=document.getElementById('txInvPick');
  p2.value=''; p2.dispatchEvent(new Event('change',{bubbles:true})); await wait(120);
  out.freeTextReturns=!document.getElementById('txInv').classList.contains('hide');
  document.getElementById('txInv').value='Crypto thing';
  document.getElementById('txAmt').value='50';
  document.getElementById('addTx').click(); await wait(400);
  out.autoAfterFree=((state.assets||[]).find(a=>a.auto==='invest')||{}).value||0;
  /* deleting the destination account: its deposits fall back into the auto
     asset rather than vanishing from net worth */
  activateTab('goals'); renderAccounts(); await wait(200);
  document.querySelector('[data-acctdel="roth"]').click(); await wait(200);
  document.querySelector('[data-acctdelyes="roth"]').click(); await wait(300);
  out.afterDelete={ destCleared:!state.transactions.find(x=>x.amount===100).destAcctId,
                    autoAsset:((state.assets||[]).find(a=>a.auto==='invest')||{}).value||0 };
  /* and a recurring invest rule carries its destination onto what it posts */
  state.accounts.push({id:'hysa',name:'HYSA',kind:'savings',balance:0,updated:'2026-08-01'});
  state.recurring=[{id:'ri',type:'invest',amount:25,source:'HYSA',freq:'monthly',anchor:'2026-08-10',day:10,ikind:'holds',destAcctId:'hysa'}];
  state.transactions=[]; save(); postRecurring('2026-08');
  out.rulePosts=(state.transactions[0]||{}).destAcctId;
  return out;
});
check('the invest form offers the tracked accounts, investment kind first, with a way out',
      dest.pickerShown && dest.investKindFirst && dest.escapeHatch, JSON.stringify(dest));
check('a tracked destination names the entry after itself', dest.namedItself===true);
check('one investment moves both sides - source down, destination up',
      dest.bothSides.joint===1900 && dest.bothSides.roth===5100, JSON.stringify(dest.bothSides));
/* The trap this feature carries: the same dollars must never print twice. */
check('...and stays out of the auto asset, so net worth counts the money exactly once',
      dest.autoAsset===0 && dest.netWorth===7000,
      `auto ${dest.autoAsset}, net worth ${dest.netWorth}`);
check('money into things the app does not track still lives in Invested capital',
      dest.freeTextReturns===true && dest.autoAfterFree===50);
check('deleting the destination account drops its deposits back into the auto asset',
      dest.afterDelete.destCleared===true && dest.afterDelete.autoAsset===150,
      JSON.stringify(dest.afterDelete));
check('a recurring invest rule carries its destination onto what it posts',
      dest.rulePosts==='hysa', String(dest.rulePosts));

/* ---- 67. a category can move house ----
   From a phone, mid-drag, with Coffee / drinks out sitting one row above the
   Food group and no way to tuck it inside: "coffee and drinks should be able to
   be reordered and placed in a subcategory under food." The drag stays
   level-locked deliberately - a thumb slip that quietly re-files a category is
   worse than a drag that cannot - so the move lives on the category's sheet,
   where there is room to say the part that matters: it is the SAME category
   afterwards. Same id, so its assignment, its history, its repeat rule and its
   place on the allowance watch list all ride along. Only the filing changes.

   The offered list is computed from what is legal rather than filtered in the
   UI, so a move the engine would refuse can never be shown: never itself, never
   its own descendants (a category cannot become its own grandchild), and never
   anywhere that would breach the three-level ceiling once its own subtree is
   accounted for. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  categories:[{id:'coffee',name:'Coffee / drinks out'},
              {id:'food',name:'Food'},{id:'walmart',name:'Walmart',parentId:'food'},{id:'aldi',name:'Aldi',parentId:'food'},
              {id:'power',name:'Power & Wi-Fi'},{id:'gas',name:'Embridge gas',parentId:'power'},
              {id:'deep',name:'Deep',parentId:'walmart'}],
  budgets:{'2026-08':{coffee:80,walmart:400,aldi:200}},
  dayToDay:['coffee'],
  recurring:[{id:'r1',type:'expense',amount:80,catId:'coffee',freq:'monthly',anchor:'2026-08-28',day:28}],
  transactions:[{id:'c1',type:'expense',amount:12,catId:'coffee',date:'2026-08-20',note:'Latte'}]});
await p.reload(); await p.waitForTimeout(700);
const house = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('budget'); renderBudget(); await wait(200);
  openCatSheet('coffee'); await wait(200);
  const sel=document.querySelector('[data-csmove="coffee"]');
  const out={ offers:[...sel.options].map(o=>o.value),
              excludesSelf:![...sel.options].some(o=>o.value==='coffee'),
              offersTopLevel:[...sel.options].some(o=>o.value==='') };
  sel.value='food'; sel.dispatchEvent(new Event('change',{bubbles:true})); await wait(300);
  out.nowUnder=state.categories.find(c=>c.id==='coffee').parentId;
  out.path=catName('coffee');
  /* the whole point: it is the same category, carrying everything */
  out.carried={ assigned:assignedFor('coffee','2026-08'),
                tx:state.transactions[0].catId,
                rule:state.recurring[0].catId,
                watched:catWatched('coffee') };
  out.parentRollsUp=catAssigned('food','2026-08');
  out.drawnNested=!!document.querySelector('#cats .subrow[data-row="coffee"]');
  /* Walmart already has a child, so it may not move under something that is
     itself a child - that would make four levels */
  openCatSheet('walmart'); await wait(200);
  out.walmartOffers=[...document.querySelector('[data-csmove="walmart"]').options].map(o=>o.value);
  /* and a category cannot be filed inside its own descendant */
  openCatSheet('food'); await wait(200);
  out.foodOffers=[...document.querySelector('[data-csmove="food"]').options].map(o=>o.value);
  /* reversible */
  openCatSheet('coffee'); await wait(200);
  const back=document.querySelector('[data-csmove="coffee"]');
  back.value=''; back.dispatchEvent(new Event('change',{bubbles:true})); await wait(300);
  out.backToTop=!state.categories.find(c=>c.id==='coffee').parentId;
  closeCatSheet();
  return out;
});
check('a category can be filed under another one, from its own sheet',
      house.nowUnder==='food' && house.path==='Food › Coffee / drinks out', house.path);
check('...and it is the same category afterwards, carrying everything it held',
      house.carried.assigned===80 && house.carried.tx==='coffee'
      && house.carried.rule==='coffee' && house.carried.watched===true,
      JSON.stringify(house.carried));
check('...so the new parent rolls it up', house.parentRollsUp===680, String(house.parentRollsUp));
check('...and the list draws it nested', house.drawnNested===true);
/* The three moves that must never be offered. */
check('it is never offered itself as a home', house.excludesSelf===true);
check('...never a home that would make a fourth level',
      !house.walmartOffers.includes('gas') && !house.walmartOffers.includes('aldi'),
      house.walmartOffers.join(','));
check('...and never inside its own descendant', !house.foodOffers.includes('walmart'),
      house.foodOffers.join(','));
check('...while top level is always a way back', house.offersTopLevel===true && house.backToTop===true);
/* Copy, from the same session: the calendar button opens the quick log, which
   takes money out, in and put away - so it must not say "an expense". */
const label = await p.evaluate(() => {
  /* the calendar only draws in spend mode with a limit - without both, the
     button does not exist and the check would pass on an empty string */
  state.spendingMode=true; state.spendLimit=1500; save();
  activateTab('home'); applySpending(); renderRewardCalendar();
  const b=document.querySelector('#rewardCalBox [data-callog]');
  return b?b.textContent.trim():'';
});
check('the button that opens the quick log is not narrower than what it opens',
      label.length>0 && !/expense/i.test(label) && /money/i.test(label), label||'(no button rendered)');

/* ---- 68. assign in the rhythm you actually live in ----
   "Assign this month should hold the frequency of how many times per week by
   weekly month. They go to get for example a coffee. Somehow that feature got
   lost it's hard for people to plan with just one set number if they don't have
   the options to make a rational decision."

   Correct, and the gap was structural: every other money field in this app -
   the spend limit, the debt budget, the true-rate fields, the recurring hours -
   carries a period picker through wireUnitField. The category assignment, the
   field people touch more than any other, was the only one locked to a month.
   It is a unit field now, remembered per category, because coffee is a per-week
   thought and rent is a per-month one and forcing one rhythm on both is exactly
   what made the field hard to plan with.

   The second half is the one that makes it a decision rather than a guess.
   Nobody decides "$104 of coffee". They decide "three a week, about six
   dollars". So the builder does that multiplication out loud and offers the
   answer. Because it names the two numbers behind the total, cutting the habit
   becomes something you can price - drop to two a week - rather than a number
   you shave blind.

   The stored value stays monthly through get/set, which is the invariant the
   whole plan rests on. And the Assign button is in the dom from the start,
   disabled: the first draft only drew it once both numbers were filled, which
   on a phone means your first tap lands where a button is about to be. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true, hourlyWage:24,
  categories:[{id:'food',name:'Food'},{id:'cof',name:'Coffee',parentId:'food'},{id:'rent',name:'Rent'}],
  budgets:{'2026-08':{cof:0,rent:1200}},
  transactions:[{id:'i1',type:'income',amount:3200,date:'2026-08-01'}]});
await p.reload(); await p.waitForTimeout(400);
await p.evaluate(()=>{ activateTab('budget'); openCatSheet('cof'); });
await p.waitForTimeout(250);
const rate = await p.evaluate(async () => {
  const out={};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const sel=document.querySelector('#csAcofUnit select');
  out.hasPicker=!!sel;
  out.kinds=sel?[...sel.options].map(o=>o.value).join(','):'';
  /* a rhythm that is not the month, entered by hand, must still land monthly */
  sel.value='week'; sel.dispatchEvent(new Event('change',{bubbles:true}));
  await wait(60);
  const amt=document.getElementById('csAcof');
  /* the field commits on 'input' like every other unit field in the app */
  amt.value='35'; amt.dispatchEvent(new Event('input',{bubbles:true}));
  await wait(60);
  out.storedMonthly=assignedFor('cof','2026-08');
  out.work=(document.getElementById('csAcofW')||{}).innerText||'';
  /* committing must not redraw the sheet out from under the person typing */
  amt.focus(); amt.value='36'; amt.dispatchEvent(new Event('input',{bubbles:true}));
  await wait(60);
  out.assignKeptFocus=document.activeElement===document.getElementById('csAcof');
  /* remembered per category, not globally */
  closeCatSheet(); openCatSheet('rent'); await wait(60);
  out.rentUnit=(document.querySelector('#csArentUnit select')||{}).value;
  closeCatSheet(); openCatSheet('cof'); await wait(60);
  out.cofUnit=(document.querySelector('#csAcofUnit select')||{}).value;
  /* the builder: a button before the numbers, and no full redraw while typing */
  const use=document.getElementById('crUse');
  out.buttonUpFront=!!use;
  out.deadUntilFilled=use?use.disabled:null;
  const n=document.getElementById('crN'), per=document.getElementById('crPer'), each=document.getElementById('crAmt');
  n.value='3'; n.dispatchEvent(new Event('input',{bubbles:true}));
  per.value='week'; per.dispatchEvent(new Event('change',{bubbles:true}));
  each.focus();
  each.value='6'; each.dispatchEvent(new Event('input',{bubbles:true}));
  await wait(60);
  out.keptFocus=document.activeElement===each;
  out.liveWithoutBlur=!document.getElementById('crUse').disabled;
  out.readout=(document.getElementById('crOut')||{}).innerText||'';
  out.buttonNames=document.getElementById('crUse').textContent;
  document.getElementById('crUse').click();
  await wait(80);
  out.written=assignedFor('cof','2026-08');
  out.shownInOwnRhythm=+document.getElementById('csAcof').value;
  /* a pool has no number of its own to price */
  closeCatSheet(); openCatSheet('food'); await wait(60);
  out.poolHasNoField=!document.getElementById('csAfood');
  out.poolHasNoBuilder=!document.querySelector('.cs-rate');
  closeCatSheet();
  return out;
});
check('the assign field carries a period picker like every other amount',
      rate.hasPicker===true && /week/.test(rate.kinds), rate.kinds);
check('...and whatever rhythm is on screen, the stored number is the month',
      Math.abs(rate.storedMonthly-151.67)<0.06, String(rate.storedMonthly));
check('...and writing one does not redraw the sheet out from under the keyboard',
      rate.assignKeptFocus===true);
check('...with the multiplication shown, not assumed',
      /week/i.test(rate.work) && /151/.test(rate.work), rate.work);
check('the rhythm is remembered per category, not app-wide',
      rate.cofUnit==='week' && rate.rentUnit==='month',
      `coffee=${rate.cofUnit} rent=${rate.rentUnit}`);
check('the habit builder prices a decision instead of asking for a total',
      /78/.test(rate.readout) && /3/.test(rate.readout) && /6/.test(rate.readout), rate.readout);
check('...its button is there before the numbers are, and dead until they land',
      rate.buttonUpFront===true && rate.deadUntilFilled===true);
check('...it comes alive on the keystroke, without taking the keyboard down',
      rate.keptFocus===true && rate.liveWithoutBlur===true,
      `focus=${rate.keptFocus} live=${rate.liveWithoutBlur}`);
check('...it names the number it is about to assign', /78/.test(rate.buttonNames), rate.buttonNames);
check('...and assigning writes the month, read back in the chosen rhythm',
      Math.abs(rate.written-78)<0.02 && Math.abs(rate.shownInOwnRhythm-18)<0.2,
      `stored=${rate.written} shown=${rate.shownInOwnRhythm}`);
check('a pool gets neither control - its number is its subcategories',
      rate.poolHasNoField===true && rate.poolHasNoBuilder===true);

/* ---- 69. two numbers that look like they disagree, and one that had no home ----
   From a phone, two figures circled in red inches apart: the trend chart's
   running total at July ($13,700) and the all-time figure in the legend under it
   ($13,388.19). "These numbers don't agree."

   They do agree - the gap is August - but nothing on the card said so, and the
   card was already the one whose whole job is telling three near-identical
   numbers apart. So the readout reconciles in both directions now: pick a middle
   month and it names what has been logged since and lands on the figure below;
   pick the last point and it says this IS that figure. The second half matters
   as much as the first, because it teaches the relationship on the tap where the
   numbers happen to match.

   The same message asked the question the app had no answer to: "this was my
   spouse's income and therefore it contributes to my balance but not my working
   hours. What option would I choose?" None of the eight - every Type describes
   something YOU did. The answer existed as an owner field the arithmetic already
   respected (personalMonthlyIncome filters owner 'a'), gated behind a household
   checkbox in Settings nobody had found. A fact about the money was hidden
   behind a preference about the interface, so the honest answer was unreachable
   from the screen asking the question. "Whose money" is on the income form now,
   for everybody, defaulting to mine; naming a second earner turns the household
   split on by itself, because that is what naming a second earner means.

   Independence follows whose it is, not just what kind it is. A partner's
   freelance cheque is real freelance income and is not your escape from a
   primary job, so it must not fill your independence bar. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  categories:[{id:'f',name:'Food'}],
  transactions:[{id:'a',type:'income',amount:13700,date:'2026-07-15',source:'Kristi',srcType:'primary'},
                {id:'b',type:'expense',amount:311.81,date:'2026-08-03',catId:'f'}]});
await p.reload(); await p.waitForTimeout(450);
const recon = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('reflect'); rfTab='worth'; renderReflectTab(); await wait(250);
  const n=document.querySelectorAll('#trendChart [data-cidx]').length;
  /* the svg is rebuilt on every pick, so the hit rects must be re-queried */
  const hit=i=>document.querySelectorAll('#trendChart [data-cidx]')[i]
      .dispatchEvent(new MouseEvent('click',{bubbles:true}));
  const read=()=>(document.querySelector('#trendChart .cread')||{}).innerText||'';
  const legend=(document.querySelector('#trendChart .legend')||{}).innerText||'';
  hit(n-2); await wait(200); const mid=read();
  hit(n-1); await wait(200); const last=read();
  return {n, mid, last, legend};
});
check('a middle point on the ledger line reconciles with the all-time figure below',
      /13,388\.19/.test(recon.mid) && /down \$311\.81/.test(recon.mid),
      recon.mid.replace(/\n/g,' | ').slice(0,180));
check('...naming the months in between rather than leaving a bare gap',
      /Aug/.test(recon.mid), recon.mid.replace(/\n/g,' | ').slice(0,120));
check('...and the last point says it IS that figure, so the tap where they match teaches why',
      /same/i.test(recon.last) && /13,388\.19/.test(recon.last),
      recon.last.replace(/\n/g,' | ').slice(0,180));
check('...which is the number actually printed in the legend',
      /13,388\.19/.test(recon.legend), recon.legend.replace(/\n/g,' | '));

const whose = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const out={};
  activateTab('tx'); await wait(200);
  document.querySelector('#typeToggle button[data-t="income"]').click(); await wait(200);
  const f=document.getElementById('fldOwner');
  /* reachable from the screen that asks the question, with no settings trip */
  out.onForm=!!f && !f.classList.contains('hide') && f.offsetHeight>0;
  out.householdOffFirst=!state.householdOn;
  out.defaultsMine=document.getElementById('txOwner').value==='a';
  out.quietByDefault=document.getElementById('txOwnerNote').classList.contains('hide');
  const o=document.getElementById('txOwner');
  o.value='b'; o.dispatchEvent(new Event('change',{bubbles:true})); await wait(150);
  out.note=document.getElementById('txOwnerNote').innerText;
  out.householdOnAfter=!!state.householdOn;
  /* log it the way a person would */
  document.getElementById('txAmt').value='13700';
  const sp=document.getElementById('txSrcPick');
  if(sp && !sp.classList.contains('hide')) sp.value='Kristi';
  else { const si=document.getElementById('txSrc'); si.classList.remove('hide'); si.value='Kristi'; }
  document.getElementById('txSrcType').value='primary';
  document.getElementById('addTx').click(); await wait(300);
  const t=state.transactions.filter(x=>x.type==='income').slice(-1)[0];
  out.stored=t&&t.owner;
  out.inMonthTotal=monthIncome('2026-08');
  out.outOfPersonal=personalMonthlyIncome();      // July's 13,700 only - August's is hers
  /* whose it is beats what kind it is, for independence */
  state.transactions.push({id:'z',type:'income',amount:900,date:'2026-08-10',source:'Her gig',srcType:'freelance',owner:'b'});
  save(); out.indieWithHers=indieTotal();
  state.transactions.push({id:'y',type:'income',amount:500,date:'2026-08-11',source:'My gig',srcType:'freelance'});
  save(); out.indieWithMine=indieTotal();
  /* switching away from income must not leave the note hanging over an expense */
  document.querySelector('#typeToggle button[data-t="expense"]').click(); await wait(150);
  out.noteGoneOnExpense=document.getElementById('txOwnerNote').classList.contains('hide');
  return out;
});
check('"whose money" is answerable from the form that asks, with no settings trip',
      whose.onForm===true && whose.householdOffFirst===true,
      `onForm=${whose.onForm} householdWasOff=${whose.householdOffFirst}`);
check('...defaulting to mine, saying nothing until there is something to say',
      whose.defaultsMine===true && whose.quietByDefault===true);
check('...and when it is not mine, it says what that changes, where the choice is made',
      /hourly rate/i.test(whose.note) && /balance/i.test(whose.note), whose.note);
check('...naming a second earner is what turns the household split on',
      whose.householdOnAfter===true);
check('a partner-owned entry is stored as theirs', whose.stored==='b', String(whose.stored));
check('...counts in the month exactly like any other money in', whose.inMonthTotal===13700,
      String(whose.inMonthTotal));
check('...and stays out of the personal income that powers your true hourly rate',
      whose.outOfPersonal===13700, String(whose.outOfPersonal));
check('their freelance cheque is real freelance income and is not your independence',
      whose.indieWithHers===0, String(whose.indieWithHers));
check('...while yours still is', whose.indieWithMine===500, String(whose.indieWithMine));
check('...and the note does not hang over an expense once you switch away',
      whose.noteGoneOnExpense===true);

/* ---- 70. a stream you cannot name is a stream the app cannot reason about ----
   "Source was not accounted for for reoccuring." Sent from the Plan tab with
   every field filled but Source, and the Add button live.

   An expense rule with no category is refused outright. An income rule with no
   name was quietly called "Income". That looks like the same class of default
   and it is not, because these rules ARE the app's list of named income streams:
   they fill the Source picker on the log form, and txExpectedFor() matches on
   the NAME to decide whether a paycheck came up short. knownSources() dedupes by
   name, so two rules both called "Income" collapse into one entry carrying
   whichever amount loaded last - and a $1,600 paycheck logged against it was
   told it was $836.97 short when it was exactly right. A fabricated shortfall,
   about the one number people are most anxious about, generated by a default
   that was trying to be helpful.

   Locked at both layers, because rules already saved cannot be un-saved by a
   form check: the form refuses a nameless stream and warns on a duplicate, and
   txExpectedFor refuses to answer at all when a name is ambiguous. Nothing said
   beats a confident wrong number.

   Third fault on the same form, from the owner picker added an hour earlier:
   recomputeBlendedWage filters to owner 'a', so on a rule that is not yours the
   hours box is a question whose answer is thrown away. Asking for a number and
   ignoring it is the same fault as inventing one. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  recurring:[{id:'r1',type:'income',amount:1600,source:'Hollywood',freq:'biweek',anchor:'2026-08-01'}]});
await p.reload(); await p.waitForTimeout(450);
p.once('dialog',d=>d.dismiss());
const rec = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const set=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));};
  const o={};
  activateTab('budget'); await wait(200);
  set('recType','income'); await wait(150);
  const before=state.recurring.length;
  set('recAmt','2436.97'); document.getElementById('recSrc').value='';
  document.getElementById('addRec').click(); await wait(250);
  o.namelessRefused=state.recurring.length===before;
  o.cursorInTheField=document.activeElement&&document.activeElement.id==='recSrc';
  document.getElementById('recSrc').value='Kristi';
  document.getElementById('addRec').click(); await wait(250);
  o.namedAccepted=state.recurring.length===before+1;
  o.storedName=(state.recurring.slice(-1)[0]||{}).source;
  /* hours on money that is not yours */
  set('recOwner','b'); await wait(200);
  o.note=document.getElementById('recOwnerNote').innerText;
  o.hoursGone=document.getElementById('recHoursWrap').classList.contains('hide');
  set('recOwner','a'); await wait(200);
  o.hoursBack=!document.getElementById('recHoursWrap').classList.contains('hide');
  set('recType','expense'); await wait(200);
  o.noteNotStranded=document.getElementById('recOwnerNote').classList.contains('hide');
  /* invest reuses the same field as its destination and needs it just as much */
  set('recType','invest'); await wait(150);
  const b2=state.recurring.length;
  set('recAmt','200'); document.getElementById('recSrc').value='';
  document.getElementById('addRec').click(); await wait(250);
  o.namelessInvestRefused=state.recurring.length===b2;
  /* and the claim the collision used to fabricate */
  state.recurring=[{id:'a',type:'income',amount:1600,source:'Income',freq:'biweek',anchor:'2026-08-01'},
                   {id:'b',type:'income',amount:2436.97,source:'Income',freq:'biweek',anchor:'2026-08-26'}];
  save(); o.ambiguous=txExpectedFor('Income');
  state.recurring=[{id:'a',type:'income',amount:1600,source:'Hollywood',freq:'biweek',anchor:'2026-08-01'}];
  save(); o.unambiguous=txExpectedFor('Hollywood');
  return o;
});
check('a recurring income rule with no name is refused, like an expense with no category',
      rec.namelessRefused===true);
check('...and it puts the cursor in the field it is asking for', rec.cursorInTheField===true);
check('...while a named one goes straight in', rec.namedAccepted===true && rec.storedName==='Kristi',
      String(rec.storedName));
check('...and the destination on an invest rule is just as required',
      rec.namelessInvestRefused===true);
check('two streams sharing a name make the app decline to say what either pays',
      rec.ambiguous===0, String(rec.ambiguous));
check('...rather than confidently reporting the other one is short',
      rec.unambiguous===1600, String(rec.unambiguous));
check('a rule that is not yours says what that changes, on the form',
      /hourly rate/i.test(rec.note), rec.note);
check('...and stops asking for hours it would throw away', rec.hoursGone===true);
check('...which come back the moment the rule is yours again', rec.hoursBack===true);
check('...and the note does not strand itself on an expense rule', rec.noteNotStranded===true);

/* ---- 71. the recurring list is read in the order you think in ----
   "There should be a reorder tab to organize the reoccurring."

   The categories got this months ago and the reasoning was already written down
   next to catOrder: array order is creation order, and creation order is an
   accident - the sequence you happened to remember your bills in, not the one
   you think about them in. The recurring list, which is where the paycheck and
   the rent live, never got it.

   The interesting decision was not the feature, it was refusing to build it
   twice. A second copy of a hundred and twenty lines of pointer handling is how
   the two lists quietly stop behaving the same - one gets the escape-to-cancel,
   the other does not; one auto-scrolls at the edge of the glass, the other
   strands you. What actually differs between them is four things: where the rows
   are, what a row is called, how an order is written, what to redraw. So that is
   what DRAG_SCOPES holds, and the grip carries data-scope. These properties
   exist to catch the drift if anyone ever un-shares it: the categories are
   checked through the same engine right after the recurring list is.

   The arrangements are here because dragging twelve rows on a phone is a chore.
   They write real sort values rather than becoming a view mode, so what you see
   is what is stored and the result is still yours to adjust by hand. "Biggest
   first" prices the cadence, not the cheque - $1,600 every two weeks outranks
   $1,850 a month, and the fixture that got this wrong the first time was mine. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  categories:[{id:'rent',name:'Rent'},{id:'phone',name:'Phone'},{id:'fun',name:'Fun'}],
  budgets:{'2026-08':{rent:1850,phone:45,fun:200}},
  recurring:[{id:'p1',type:'expense',amount:45,catId:'phone',freq:'monthly',anchor:'2026-08-20'},
             {id:'p2',type:'income',amount:1600,source:'Hollywood',freq:'biweekly',anchor:'2026-08-14'},
             {id:'p3',type:'expense',amount:1850,catId:'rent',freq:'monthly',anchor:'2026-08-01'}]});
await p.reload(); await p.waitForTimeout(450);
const ord = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const rows=()=>[...document.querySelectorAll('#recList [data-row]')].map(e=>e.dataset.row);
  const o={};
  activateTab('budget'); await wait(250);
  o.quietByDefault = document.querySelectorAll('#recList [data-grip]').length===0
                  && document.getElementById('recArrange').classList.contains('hide');
  document.getElementById('recReorderBtn').click(); await wait(250);
  o.gripPerRow=document.querySelectorAll('#recList [data-grip]').length;
  o.offersArrangements=!document.getElementById('recArrange').classList.contains('hide');
  /* destructive buttons must not be live under a thumb that is trying to drag */
  o.delInert=getComputedStyle(document.querySelector('#recList .rec .del')).pointerEvents==='none';
  /* the keyboard path, which is the one no drag test covers */
  document.querySelector('#recList [data-grip="p3"]').focus();
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
  await wait(200);
  o.afterArrowUp=rows();
  o.writtenToState=state.recurring.find(r=>r.id==='p3').sort;
  o.focusFollowed=document.activeElement&&document.activeElement.dataset.grip;
  /* arrangements write an order, they are not a view */
  document.querySelector('[data-arrange="size"]').click(); await wait(200);
  o.bySize=rows();
  o.sizes=rows().map(id=>Math.round(recMonthly(state.recurring.find(r=>r.id===id))));
  document.querySelector('[data-arrange="due"]').click(); await wait(200);
  o.byDue=rows().map(id=>recNextDue(state.recurring.find(r=>r.id===id)));
  document.querySelector('[data-arrange="kind"]').click(); await wait(200);
  o.byKind=rows().map(id=>state.recurring.find(r=>r.id===id).type);
  /* the arrangement has to have WRITTEN the order: dense sort values, in the
     sequence on screen. A view-mode implementation would render the same list
     and leave the data untouched, and nothing else here would notice. */
  o.storedSorts=rows().map(id=>state.recurring.find(r=>r.id===id).sort);
  /* the same engine still drives the categories - the drift check */
  setRecReorder(false); setReorder(true); await wait(250);
  const c0=[...document.querySelectorAll('#cats [data-row]')].map(e=>e.dataset.row);
  const g=document.querySelector('#cats [data-grip]');
  o.catGripHasNoRecScope=!g.dataset.scope;
  g.focus();
  g.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
  await wait(200);
  const c1=[...document.querySelectorAll('#cats [data-row]')].map(e=>e.dataset.row);
  o.catsStillMove = c0[0]===c1[1] && c0[1]===c1[0];
  /* one floating Done, however many lists are open */
  setRecReorder(true); await wait(200);
  o.bothAtOnce = !!document.querySelector('#cats [data-grip]') && !!document.querySelector('#recList [data-grip]');
  document.getElementById('reorderDone').click(); await wait(250);
  o.doneEndsBoth = !document.querySelector('#cats [data-grip]') && !document.querySelector('#recList [data-grip]');
  o.bodyClean = !document.body.classList.contains('reordering');
  return o;
});
check('the recurring list says nothing about reordering until you ask',
      ord.quietByDefault===true);
check('...then every row gets a grip, and the arrangements appear with it',
      ord.gripPerRow===3 && ord.offersArrangements===true, `grips=${ord.gripPerRow}`);
check('...and the buttons that end a schedule go inert under a dragging thumb',
      ord.delInert===true);
check('a row moves by arrow key, not only by drag',
      JSON.stringify(ord.afterArrowUp)==='["p1","p3","p2"]', JSON.stringify(ord.afterArrowUp));
check('...writing an order into the data rather than shuffling the screen',
      ord.writtenToState===1, String(ord.writtenToState));
check('...with focus following the row that moved, so the next press repeats it',
      ord.focusFollowed==='p3', String(ord.focusFollowed));
check('"biggest first" prices the cadence, not the cheque',
      JSON.stringify(ord.bySize)==='["p2","p3","p1"]'
      && ord.sizes[0]>ord.sizes[1] && ord.sizes[1]>ord.sizes[2],
      JSON.stringify(ord.bySize)+' '+JSON.stringify(ord.sizes));
check('"by what is due next" is in date order',
      ord.byDue.every((d,i)=>i===0||ord.byDue[i-1]<=d), JSON.stringify(ord.byDue));
check('"money in, then out" leads with what arrives',
      ord.byKind[0]==='income', JSON.stringify(ord.byKind));
check('...and an arrangement WRITES that order, so it stays yours to adjust',
      JSON.stringify(ord.storedSorts)==='[0,1,2]', JSON.stringify(ord.storedSorts));
check('the categories still reorder through the very same engine',
      ord.catsStillMove===true && ord.catGripHasNoRecScope===true);
check('...both lists can be open at once, and one Done ends both',
      ord.bothAtOnce===true && ord.doneEndsBoth===true && ord.bodyClean===true,
      JSON.stringify({both:ord.bothAtOnce,done:ord.doneEndsBoth,body:ord.bodyClean}));

/* ---- 72. is paying yourself an expense or an investment ----
   Asked exactly like that: "I'm having an issue with the pay yourself first
   concept. Is it an expense? Or is it an investment?"

   Neither on its own, and the app had been quietly answering "expense", which is
   the wrong half. It has to be a PLAN LINE, because zero-based means every
   dollar gets a job and this one has to compete for the dollar against the fun
   money - a thing that is not a budget line is "whatever is left", which is
   precisely the failure the lesson describes. And the money that moves has to be
   an INVESTMENT, because an expense is money that is gone and this money is
   still yours.

   runDeepen created it with findOrCreateCat('Pay Yourself First') and no growth
   tag, so it was neither: the plan counted it, and every dollar somebody paid
   themselves was filed as spent. The property below is not "net worth is
   unchanged" - this app deliberately keeps net worth on the TYPED bank balance
   and treats the ledger as an expectation. The property is what the money
   BECOMES: paid to yourself it becomes something you still hold, spent it
   becomes nothing. That is the whole answer.

   It is healed on load as well as fixed at the source, because a form check
   cannot reach the people it already happened to. "Pay Yourself First" is a name
   this app writes and no interface can un-tag a category, so an untagged one can
   only be a row this app made wrong. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  categories:[{id:'pyf',name:'Pay Yourself First'},{id:'f',name:'Food'}],
  budgets:{'2026-08':{pyf:400}},
  accounts:[{id:'ac',name:'Checking',balance:2000,updated:'2026-08-01'}],
  transactions:[{id:'i',type:'income',amount:3000,date:'2026-08-01'}]});
await p.reload(); await p.waitForTimeout(450);
const pyf = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  o.healed=state.categories.find(c=>c.id==='pyf').growth;
  o.nothingElseTagged=!state.categories.find(c=>c.id==='f').growth;
  o.assigned=assignedFor('pyf','2026-08');          // it is a plan line like any other
  const a0=sumAssets(), e0=bankExpected();
  state.transactions.push({id:'x',type:'invest',amount:400,date:'2026-08-05',
    catId:'pyf',source:'Savings',ikind:'holds',acctId:'ac'});
  syncInvestAsset(); save();
  o.becameAnAsset=sumAssets()-a0;
  o.countsAsUsed=catUsed('pyf','2026-08');
  openCatSheet('pyf'); await wait(150);
  o.sheet=document.getElementById('catSheetBody').innerText; closeCatSheet();
  const aMid=sumAssets();
  state.transactions.push({id:'y',type:'expense',amount:400,date:'2026-08-06',catId:'f',acctId:'ac'});
  syncInvestAsset(); save();
  o.spendingBecameNothing=sumAssets()===aMid;
  o.bothLeftTheAccount=(e0-bankExpected());
  /* and the log form refuses to file it as spending in the first place */
  activateTab('tx'); await wait(200);
  document.querySelector('#typeToggle button[data-t="expense"]').click(); await wait(150);
  const sel=document.getElementById('txCat'); sel.value='pyf';
  sel.dispatchEvent(new Event('change',{bubbles:true})); await wait(250);
  o.formSwitched=document.querySelector('#typeToggle button.on').dataset.t;
  return o;
});
check('an untagged Pay Yourself First is healed on load, where the people it already happened to are',
      pyf.healed==='save', String(pyf.healed));
check('...without tagging anything else behind your back', pyf.nothingElseTagged===true);
check('it is a plan line, so it competes for the dollar instead of living on what is left',
      pyf.assigned===400, String(pyf.assigned));
check('...and the money paid to yourself becomes something you still hold',
      pyf.becameAnAsset===400, String(pyf.becameAnAsset));
check('...while the same money spent becomes nothing', pyf.spendingBecameNothing===true);
check('...though both leave the account, so the bank expects the same either way',
      Math.abs(pyf.bothLeftTheAccount-800)<0.005, String(pyf.bothLeftTheAccount));
check('...counted as used by the plan, so the month can still reach zero',
      pyf.countsAsUsed===400, String(pyf.countsAsUsed));
check('...and read as put away rather than spent',
      /Put away/i.test(pyf.sheet) && /still yours/i.test(pyf.sheet));
check('the log form will not let it be filed as an expense at all',
      pyf.formSwitched==='invest', String(pyf.formSwitched));

/* ---- 73. the costs nobody budgets for, named before they arrive ----
   "These are the things that slowly drive away savings and never get funded
   until it's too late." That sentence is the pack.

   Every category in these packs is money people already spend and almost nobody
   plans for, and the reason is always the same shape: the cost is real,
   predictable and often annual, but it arrives as a surprise, so it gets paid
   out of the emergency fund, the fun money or a card. Naming it does not make
   the money appear. It stops the money being a shock.

   The old button dumped eight categories in with no warning and no way to see
   what they were - which is what prompted "we got the basic starter set but
   what's all included?". Nothing is added now until the card has been read, and
   the essentials are in the same list so their contents are finally visible too.
   Every row carries a reason, because a list of names teaches nobody anything. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  categories:[{id:'f',name:'Food'}]});
await p.reload(); await p.waitForTimeout(450);
const packs = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  activateTab('budget'); await wait(200);
  const before=state.categories.length;
  document.getElementById('starterBtn').click(); await wait(250);
  o.addedNothingYet=state.categories.length===before;
  o.opened=document.getElementById('packSheet').classList.contains('on');
  o.packs=[...document.querySelectorAll('.pk-card .pk-nm')].map(x=>x.textContent);
  o.everyPackHasAHook=[...document.querySelectorAll('.pk-card .pk-hook')].every(x=>x.textContent.trim().length>20);
  /* Every pack must earn its place by saying what leaving it off costs. A pack
     with a name and a list is a folder, and this app does not ship folders. */
  o.everyPackHasATruth=CAT_PACKS.every(x=>String(x.truth||'').length>140);
  o.everyRowEverywhereHasAWhy=CAT_PACKS.every(x=>x.cats.every(c=>String(c.w||'').length>10));
  /* Dollars on the tin, so the copy speaks the same language as the currency.
     Three UK spellings had already reached user-facing pack copy. */
  o.copy=CAT_PACKS.map(x=>[x.hook,x.truth,...x.cats.map(c=>c.w)].join(' ')).join(' ');
  document.querySelector('[data-pack="occasions"]').click(); await wait(250);
  o.card=document.getElementById('packSheetBody').innerText;
  o.rows=document.querySelectorAll('.pk-row').length;
  o.everyRowHasAWhy=[...document.querySelectorAll('.pk-rw')].every(x=>x.textContent.trim().length>10);
  const n0=state.categories.length;
  /* everything is ticked by default, so the whole pack is still one tap */
  o.allTickedByDefault=[...document.querySelectorAll('.pk-cb')].every(x=>x.checked);
  document.getElementById('pkAdd').click(); await wait(300);
  o.added=state.categories.length-n0;
  const g=state.categories.find(c=>c.name==='Special occasions');
  o.nested=!!g && state.categories.filter(c=>c.parentId===g.id).length===6;
  o.nowSaysNothingToAdd=/Nothing to add/i.test(document.getElementById('packSheetBody').innerText);
  const n1=state.categories.length;
  addPack('occasions');
  o.twiceAddsNothing=state.categories.length===n1;
  /* a la carte: pick two of five and only those two land */
  openPacks('travel'); await wait(250);
  document.getElementById('pkNone').click(); await wait(120);
  ['Stays','Travel insurance'].forEach(function(v){
    var b=[...document.querySelectorAll('.pk-cb')].find(x=>x.value===v);
    b.checked=true; b.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await wait(150);
  o.partialLabel=document.getElementById('pkAdd').textContent;
  document.getElementById('pkAdd').click(); await wait(300);
  const tg=state.categories.find(c=>c.name==='Trips & travel');
  o.partialLanded=tg ? state.categories.filter(c=>c.parentId===tg.id).map(c=>c.name).sort().join(',') : '';
  /* and the ones passed over are still on offer */
  openPacks('travel'); await wait(200);
  o.restStillOffered=document.querySelectorAll('.pk-cb').length;
  /* a button that cannot act must not look like it can */
  document.getElementById('pkNone').click(); await wait(150);
  o.deadWhenEmpty=document.getElementById('pkAdd').disabled;
  o.deadLabel=document.getElementById('pkAdd').textContent;
  const nEmpty=state.categories.length;
  addPack('travel',[]);
  o.emptyAddsNothing=state.categories.length===nEmpty;
  /* the growth pack tags what it drops in */
  openPacks('invest'); await wait(200);
  document.getElementById('pkAdd').click(); await wait(300);
  o.pyfTagged=(state.categories.find(c=>c.name==='Pay Yourself First')||{}).growth;
  o.retirementTagged=(state.categories.find(c=>c.name==='Retirement')||{}).growth;
  /* the family pack, and the one thing it has to get right */
  openPacks('family'); await wait(200);
  o.family=document.getElementById('packSheetBody').innerText;
  o.familyTags=document.querySelectorAll('.pk-row .growth-tag').length;
  document.getElementById('pkAdd').click(); await wait(300);
  const fg=state.categories.find(c=>c.name==='Kids & family');
  o.familyNested=!!fg && state.categories.filter(c=>c.parentId===fg.id).length===10;
  o.eduTagged=(state.categories.find(c=>c.name==='Education fund')||{}).growth;
  /* and a pack category is an ordinary category from that second */
  const bd=state.categories.find(c=>c.name==='Birthdays');
  state.categories=state.categories.filter(c=>c.id!==bd.id); save();
  o.deletable=!state.categories.some(c=>c.name==='Birthdays');
  closePacks();
  return o;
});
check('the packs button opens a browser rather than dumping categories in',
      packs.addedNothingYet===true && packs.opened===true);
check('...listing every pack, the essentials among them so their contents are visible at last',
      packs.packs.length===9 && packs.packs.some(x=>/essentials/i.test(x)), packs.packs.join(' / '));
check('...each one saying what it is for, not just what it is called',
      packs.everyPackHasAHook===true);
check('...and every pack, not just the ones spot-checked, names what skipping it costs',
      packs.everyPackHasATruth===true && packs.everyRowEverywhereHasAWhy===true);
check('...in the same language as the currency on the tin',
      !/\b(colour|tyre|fortnight|whilst|amongst|cheque|nappies|organis|recognis|realis|apologis|prioritis|minimis|maximis|favourite|behaviour|labour|neighbour|licence|defence|kerb|maths|aeroplane)\b/i.test(packs.copy),
      (packs.copy.match(/\b(colour|tyre|fortnight|whilst|amongst|cheque|nappies|organis|recognis|realis|apologis|prioritis|minimis|maximis|favourite|behaviour|labour|neighbour|licence|defence|kerb|maths|aeroplane)\b/ig)||[]).join(', '));
check('a pack card says what leaving it off costs',
      /same day every year/i.test(packs.card) && packs.card.length>400,
      packs.card.split('\n').filter(Boolean)[1]||'');
check('...and shows every category with a reason beside it',
      packs.rows===6 && packs.everyRowHasAWhy===true, `rows=${packs.rows}`);
check('adding drops them under one group so the plan stays readable',
      packs.added===7 && packs.nested===true, `added=${packs.added}`);
check('...with everything ticked to begin with, so the whole pack is still one tap',
      packs.allTickedByDefault===true);
check('a la carte: pick two of a pack and only those two land',
      packs.partialLanded==='Stays,Travel insurance', packs.partialLanded);
check('...with the button counting what it will actually do',
      /Add 2 of 6/.test(packs.partialLabel), packs.partialLabel);
check('...and the ones passed over still on offer next time',
      packs.restStillOffered===4, String(packs.restStillOffered));
check('...while a button that cannot act does not look like it can',
      packs.deadWhenEmpty===true && /Nothing picked/i.test(packs.deadLabel)
      && packs.emptyAddsNothing===true, packs.deadLabel);
check('...and says so afterwards rather than offering the same pack again',
      packs.nowSaysNothingToAdd===true && packs.twiceAddsNothing===true);
check('the money-that-works pack tags what it drops in, so none of it reads as spending',
      packs.pyfTagged==='save' && packs.retirementTagged==='invest',
      `pyf=${packs.pyfTagged} retirement=${packs.retirementTagged}`);
check('the family pack disarms the guilt instead of pretending it is not there',
      /price on your kid/i.test(packs.family) && /not resenting it/i.test(packs.family),
      packs.family.split('\n').filter(Boolean)[2]||'');
check('...and names the line the money actually comes out of when nobody measures it',
      /\byours\b/i.test(packs.family) && /retirement/i.test(packs.family));
check('...with its one keepable line tagged on the card and in the data',
      packs.familyTags===1 && packs.eduTagged==='save',
      `tags=${packs.familyTags} edu=${packs.eduTagged}`);
check('...landing nested like every other pack', packs.familyNested===true);
check('...and a pack category is an ordinary category from that second',
      packs.deletable===true);

/* ---- 74. naming a category from the catalogue instead of from memory ----
   Sent as a screenshot of the log form's category dropdown, scrolled to the
   bottom, "+ New category..." selected, and a blank text box waiting: "can we
   incorporate a pick from the starter packs or a search function to
   autopopulate different categories?"

   The blank box was the whole problem. Sixty-odd named categories already exist
   in the packs, each with a reason somebody thought to write down, and at the
   exact moment a person needs one - mid-log, trying to file a purchase they
   have already made - the app asked them to invent the name themselves.

   Two properties carry this. The first is that picking beats typing: a
   catalogue row brings its growth tag with it, so "Education fund" arrives
   already knowing it is money you keep.

   The second used to read "a typed name is never tagged, and editing a pick
   drops the tag". That rule is gone, deliberately, and this check was rewritten
   rather than relaxed. It was written when a pack pick was the ONLY way a
   category could learn it was not spending - which is exactly the fault the
   Acorns report exposed: type the name of the app your money went into and you
   got a purchase, with nothing offering an alternative. A typed name is read
   now, and tagged if it plainly reads as putting money away.

   What has to survive is the thing that rule was protecting: a tag must never
   be INHERITED from a pick whose name you have since changed into something
   that does not warrant it. "Sinking fund for the roof" keeping `save` is
   right - it is a sinking fund. "Roof repairs" keeping it would be the app
   deciding something on your behalf, and that is what is asserted below.

   The ranking is asserted as an invariant rather than a hand-guessed order.
   Two earlier versions of that check named specific rows and were wrong about
   the catalogue both times - once on a category the user had created rather
   than one the packs ship, once on a word that turned out to have no mid-word
   match at all. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  categories:[{id:'f',name:'Food'},{id:'sk',name:'Skincare'}]});
await p.reload(); await p.waitForTimeout(450);
const cat = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  activateTab('budget'); await wait(250);
  o.oneLetter=catSuggest('c').length;
  const ranked=catSuggest('fun',9);
  o.ranked=ranked.map(h=>h.n);
  o.rankOrdered=ranked.every((h,i)=>i===0||ranked[i-1].r<=h.r);
  o.prefixFirst=ranked[0] && ranked[0].r===0;
  o.skipsWhatYouHave=!catSuggest('skin',9).some(h=>h.n==='Skincare');
  /* the plan field */
  const el=document.getElementById('catName');
  el.value='christ'; el.dispatchEvent(new Event('input',{bubbles:true})); await wait(200);
  const host=document.getElementById('catNameHits');
  o.offers=[...host.querySelectorAll('.cs-hit .csh-n')].map(x=>x.textContent.trim());
  o.everyRowNamesItsPack=[...host.querySelectorAll('.csh-p')].every(x=>x.textContent.trim().length>3);
  o.everyRowCarriesAWhy=[...host.querySelectorAll('.csh-w')].every(x=>x.textContent.trim().length>10);
  host.querySelector('.cs-hit').click(); await wait(180);
  o.filled=el.value;
  o.listClosed=host.innerHTML.trim()==='';
  document.getElementById('addCat').click(); await wait(250);
  o.added=state.categories.some(c=>/Christmas/i.test(c.name));
  /* picking beats typing: the tag rides along */
  el.value='educat'; el.dispatchEvent(new Event('input',{bubbles:true})); await wait(200);
  host.querySelector('.cs-hit').click(); await wait(150);
  document.getElementById('addCat').click(); await wait(250);
  o.pickedTag=(state.categories.find(c=>c.name==='Education fund')||{}).growth;
  /* and typing the same idea by hand does not get tagged */
  el.value='Education fund 2'; el.dispatchEvent(new Event('input',{bubbles:true})); await wait(150);
  document.getElementById('addCat').click(); await wait(200);
  o.typedTag=(state.categories.find(c=>c.name==='Education fund 2')||{}).growth;
  /* editing a pick into something that STILL reads as putting money away keeps
     the tag - but from the name, not inherited from the pick */
  el.value='sinking'; el.dispatchEvent(new Event('input',{bubbles:true})); await wait(200);
  host.querySelector('.cs-hit').click(); await wait(150);
  el.value='Sinking fund for the roof'; el.dispatchEvent(new Event('input',{bubbles:true})); await wait(150);
  document.getElementById('addCat').click(); await wait(200);
  o.editedTag=(state.categories.find(c=>c.name==='Sinking fund for the roof')||{}).growth;
  /* and editing it into something that does NOT is the case the old rule was
     really protecting: the tag must not ride along on a name that no longer
     earns it */
  el.value='sinking'; el.dispatchEvent(new Event('input',{bubbles:true})); await wait(200);
  host.querySelector('.cs-hit').click(); await wait(150);
  el.value='Roof repairs'; el.dispatchEvent(new Event('input',{bubbles:true})); await wait(150);
  document.getElementById('addCat').click(); await wait(200);
  o.editedAwayTag=(state.categories.find(c=>c.name==='Roof repairs')||{}).growth;
  /* the whole point of the change: the name of the app the money went into */
  el.value='Acorns'; el.dispatchEvent(new Event('input',{bubbles:true})); await wait(150);
  document.getElementById('addCat').click(); await wait(200);
  o.acornsTag=(state.categories.find(c=>c.name==='Acorns')||{}).growth;
  o.acornsSaid=(document.querySelector('.toast')||{textContent:''}).textContent;
  /* search only helps if you know the word - browsing is the way in if you do not */
  el.value='zzzq'; el.dispatchEvent(new Event('input',{bubbles:true})); await wait(200);
  o.noMatchOffersBrowse=!!host.querySelector('[data-browsepacks]');
  o.noMatchCopy=(host.querySelector('.cs-none')||{}).textContent||'';
  host.querySelector('[data-browsepacks]').click(); await wait(300);
  o.browseOpens=document.getElementById('packSheet').classList.contains('on');
  closePacks(); await wait(150);
  /* and the same field on the log form, which is where it was asked for */
  activateTab('tx'); await wait(250);
  const sel=document.getElementById('txCat'); sel.value='__new';
  sel.dispatchEvent(new Event('change',{bubbles:true})); await wait(250);
  const tn=document.getElementById('txCatNew');
  o.logFieldShown=!tn.classList.contains('hide');
  tn.value='prescr'; tn.dispatchEvent(new Event('input',{bubbles:true})); await wait(200);
  o.logOffers=document.querySelectorAll('#txCatNewHits .cs-hit').length;
  return o;
});
check('one letter is not a search, so the list does not fire on every keystroke',
      cat.oneLetter===0, String(cat.oneLetter));
check('two letters search every category the packs ship',
      cat.ranked.length>3, cat.ranked.join(', '));
check('...returned in rank order, prefix matches first',
      cat.rankOrdered===true && cat.prefixFirst===true, cat.ranked.join(', '));
check('...and never offering a category you already have',
      cat.skipsWhatYouHave===true);
check('a suggestion carries the pack it came from and the reason it exists',
      cat.everyRowNamesItsPack===true && cat.everyRowCarriesAWhy===true,
      cat.offers.join(' | '));
check('...picking one fills the field and closes the list',
      /Christmas/i.test(cat.filled) && cat.listClosed===true, cat.filled);
check('...and adds it like any other category', cat.added===true);
check('picking beats typing: the growth tag rides along',
      cat.pickedTag==='save', String(cat.pickedTag));
check('...while a name that does not read as putting money away is left alone',
      !cat.typedTag && !cat.editedAwayTag, `${cat.typedTag} / ${cat.editedAwayTag}`);
check('...a name that still does keeps it, from the name rather than the pick',
      cat.editedTag==='save', String(cat.editedTag));
/* the report this came from: nobody types "investment", they type the name of
   the app the money went into, and that used to produce a purchase */
check('...and typing the name of the thing you invest with is read, not filed as spending',
      cat.acornsTag==='invest', String(cat.acornsTag));
check('...out loud, because a tag applied in silence is one nobody can correct',
      /invested, not spent/i.test(cat.acornsSaid) && /change/i.test(cat.acornsSaid),
      cat.acornsSaid.slice(0,140));
check('a search with no match still offers a way in, and does not scold you',
      cat.noMatchOffersBrowse===true && /fine|own thing/i.test(cat.noMatchCopy),
      cat.noMatchCopy);
check('...which opens the packs', cat.browseOpens===true);
check('the same catalogue is on the log form, where it was asked for',
      cat.logFieldShown===true && cat.logOffers>0, `offers=${cat.logOffers}`);

/* ---- 75. one number column, three questions ----
   "I think a planned / spent / remaining toggle tab may help our plan dashboard
   to help be more uniformed with categories."

   It fixes something real rather than only tidying: SPENT was not on that list
   at all. You could see what you assigned and what was left, and had to
   subtract in your head to find out what had actually gone. And the shapes did
   not match - a group row printed three figures (rolled-up, "direct", and
   available) where a leaf printed two, which is the non-uniformity the ask
   names.

   Planned stays the editable one, because zero-based budgeting IS typing in
   that column; it becomes a plain figure in the other two, since there is
   nothing to type into "what you already spent". That is what makes every row
   the same shape in every mode, which is the property below.

   The choice is stored, because a mode you have to re-pick on every visit is a
   button rather than a view. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  categories:[{id:'food',name:'Food'},{id:'wal',name:'Walmart',parentId:'food'},
              {id:'aldi',name:'Aldi',parentId:'food'},{id:'rent',name:'Rent'}],
  budgets:{'2026-08':{wal:250,aldi:200,rent:1200,food:5}},
  transactions:[{id:'i',type:'income',amount:3000,date:'2026-08-01'},
                {id:'e1',type:'expense',amount:225,date:'2026-08-04',catId:'wal'},
                {id:'e2',type:'expense',amount:1300,date:'2026-08-02',catId:'rent'}]});
await p.reload(); await p.waitForTimeout(450);
const pv = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  activateTab('budget'); await wait(300);
  /* innerText does not include an input's value, and the planned column IS an
     input - which is the design, so the reader has to know that */
  const cell=i=>{ const r=document.querySelector(`[data-row="${i}"] .rw-money`); if(!r) return '';
    const f=r.querySelector('input'); return f ? f.value : r.innerText.trim(); };
  o.tabs=[...document.querySelectorAll('.plan-switch .pv')].map(x=>x.textContent);
  o.defaultOn=(document.querySelector('.plan-switch .pv.on')||{}).dataset?.planview;
  o.isTablist=document.querySelector('.plan-switch').getAttribute('role')==='tablist'
    && document.querySelector('.plan-switch .pv.on').getAttribute('aria-selected')==='true';
  o.cols=[...document.querySelectorAll('.plan-cols span')].map(x=>x.textContent);
  o.plannedFields=document.querySelectorAll('#cats input[data-cat]').length;
  o.plannedLeaf=cell('wal');
  setPlanView('spent'); await wait(250);
  o.spentLeaf=cell('wal'); o.spentOverspent=cell('rent'); o.spentGroup=cell('food');
  o.spentFields=document.querySelectorAll('#cats input[data-cat]').length;
  o.spentHeader=[...document.querySelectorAll('.plan-cols span')][1].textContent;
  o.overMarked=document.querySelector('[data-row="rent"] .sub-spent').classList.contains('over');
  setPlanView('left'); await wait(250);
  o.leftLeaf=cell('wal'); o.leftOver=cell('rent');
  /* the uniformity claim, checked rather than asserted in prose */
  o.oneCellEverywhere=[...document.querySelectorAll('#cats .rw-money')].every(x=>x.children.length===1);
  return o;
});
check('the plan list carries a Planned / Spent / Remaining toggle',
      pv.tabs.join(',')==='Planned,Spent,Remaining', pv.tabs.join(','));
check('...as a real tablist, opening on Planned',
      pv.isTablist===true && pv.defaultOn==='planned', String(pv.defaultOn));
check('...and one money column, labelled by whichever question is selected',
      pv.cols.length===2 && pv.cols[0]==='Category', pv.cols.join(' | '));
check('Planned is the editable one, because that is where budgeting happens',
      pv.plannedFields===3 && pv.plannedLeaf==='250',
      `fields=${pv.plannedFields} leaf=${pv.plannedLeaf}`);
check('Spent shows what actually went - the figure the list never had',
      /225/.test(pv.spentLeaf) && /1,300/.test(pv.spentOverspent), 
      `${pv.spentLeaf} / ${pv.spentOverspent}`);
check('...rolled up for a group', /225/.test(pv.spentGroup), pv.spentGroup);
check('...with no field, because there is nothing to type into what you spent',
      pv.spentFields===0, String(pv.spentFields));
check('...and overspending marked rather than merely printed',
      pv.overMarked===true && /spent/i.test(pv.spentHeader), pv.spentHeader);
check('Remaining is assigned minus spent, negative when it should be',
      /25/.test(pv.leftLeaf) && /-/.test(pv.leftOver), `${pv.leftLeaf} / ${pv.leftOver}`);
check('every row is the same shape in every mode, which was the whole ask',
      pv.oneCellEverywhere===true);
/* stored, not just switched */
await p.reload(); await p.waitForTimeout(450);
const kept = await p.evaluate(async () => {
  activateTab('budget'); await new Promise(r=>setTimeout(r,300));
  return (document.querySelector('.plan-switch .pv.on')||{}).dataset?.planview;
});
check('...and the choice survives a reload', kept==='left', String(kept));
/* Asked for after living with it: "this should be floating so it's easy to
   switch between the three instead of scrolling all the way back up to the
   top." Sticky rather than a floating pill - it stays where it already is, so
   there is no second place to look for the same control, and the selected tab
   IS the column label, which means one strip does the job of a control and a
   header. The property is not "it is visible on load" (on a short phone with a
   month nav and a summary above it, it legitimately starts below the fold) but
   that it is in normal flow AND pins once you reach it AND still works from
   down there without throwing you back to the top. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  categories:Array.from({length:22},(_,i)=>({id:'c'+i,name:'Category '+(i+1)})),
  budgets:{'2026-08':Object.fromEntries(Array.from({length:22},(_,i)=>['c'+i,100+i]))},
  transactions:[{id:'i',type:'income',amount:9000,date:'2026-08-01'}]});
await p.setViewportSize({width:390,height:760});
await p.reload(); await p.waitForTimeout(450);
await p.evaluate(()=>activateTab('budget')); await p.waitForTimeout(350);
const stick = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const el=()=>document.querySelector('.plan-switch');
  const o={ flow:getComputedStyle(el()).position };
  window.scrollTo(0,1400); await wait(300);
  const r=el().getBoundingClientRect();
  o.stillOnScreen = r.bottom>0 && r.top<innerHeight;
  o.pinnedTop = Math.round(r.top);
  /* rows must pass BEHIND it, not through the gutters a padded panel leaves */
  const mid=r.top+r.height/2;
  o.ownsItsWidth=[r.left+3,(r.left+r.right)/2,r.right-3]
    .every(x=>{ const e=document.elementFromPoint(x,mid); return !!(e&&e.closest('.plan-switch')); });
  const y=window.scrollY;
  document.querySelector('[data-planview="spent"]').click(); await wait(320);
  o.switchedFromDownThere = state.planView==='spent';
  o.stayedPut = Math.abs(window.scrollY-y)<120;
  return o;
});
check('the toggle sticks instead of scrolling away', stick.flow==='sticky', stick.flow);
check('...still on screen four screens into a long plan, pinned to the top',
      stick.stillOnScreen===true && stick.pinnedTop>=-1 && stick.pinnedTop<=40,
      `top ${stick.pinnedTop}`);
check('...and switching from down there works without sending you back up',
      stick.switchedFromDownThere===true && stick.stayedPut===true);
check('...with the strip owning its full width, so rows pass behind rather than beside it',
      stick.ownsItsWidth===true);
await p.setViewportSize({width:390,height:1200});

/* ---- 76. deleting a category is armed, not fired ----
   "Deleting a category is still too destructive. We should be prompted before
   an actual delete is able to take place for accidental touches."

   Still - because the recurring list had this exact report and this exact fix
   weeks ago, and the category sheet never got it. One tap on "Delete Roof"
   removed the category, every subcategory under it, and every assignment they
   held, with nothing in between.

   Two taps now, and the first one turns the button into a question. Inline
   rather than a browser confirm, for the reason already written beside the
   recurring version: a dialog covers the thing you are being asked about.

   The question carries counts, because "are you sure?" asks nobody anything.
   "2 subcategories go with it. 2 entries become Uncategorized. $450 assigned
   this month is freed up." is a question a person can actually answer - and
   when the answer is "nothing", it says that instead of inventing a cost.

   The armed id is cleared on open and on close, and the confirm refuses to fire
   unless the armed id is the category the sheet is currently showing. A stale
   arm surviving a navigation is how a second tap deletes the wrong thing. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  categories:[{id:'food',name:'Food'},{id:'wal',name:'Walmart',parentId:'food'},
              {id:'aldi',name:'Aldi',parentId:'food'},{id:'rent',name:'Rent'},
              {id:'empty',name:'Nothing here'}],
  budgets:{'2026-08':{wal:250,aldi:200,rent:1200}},
  transactions:[{id:'e1',type:'expense',amount:60,date:'2026-08-03',catId:'wal'},
                {id:'e2',type:'expense',amount:22,date:'2026-08-04',catId:'aldi'}]});
await p.reload(); await p.waitForTimeout(450);
const del = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  activateTab('budget'); openCatSheet('food'); await wait(320);
  const n0=state.categories.length;
  o.startsAsAButton=!!document.querySelector('[data-del="food"]') && !document.querySelector('.cs-arm');
  document.querySelector('[data-del="food"]').click(); await wait(300);
  o.armedNotFired=state.categories.length===n0 && !!document.querySelector('.cs-arm');
  o.question=document.querySelector('.cs-arm').innerText;
  /* keeping it keeps it */
  document.querySelector('[data-delno]').click(); await wait(280);
  o.keptIt=state.categories.length===n0 && !document.querySelector('.cs-arm');
  /* a stale arm must not survive leaving the sheet, or landing on another one */
  document.querySelector('[data-del="food"]').click(); await wait(220);
  closeCatSheet(); openCatSheet('food'); await wait(280);
  o.reopenNotArmed=!document.querySelector('.cs-arm');
  document.querySelector('[data-del="food"]').click(); await wait(220);
  openCatSheet('rent'); await wait(280);
  o.otherNotArmed=!document.querySelector('.cs-arm') && catDelArm===null;
  /* an empty category is honest rather than inventing a cost */
  openCatSheet('empty'); await wait(280);
  document.querySelector('[data-del="empty"]').click(); await wait(250);
  o.emptyCopy=document.querySelector('.cs-arm').innerText;
  document.querySelector('[data-delno]').click(); await wait(200);
  /* and the real thing. Counted first: nothing about a delete may remove money. */
  const txBefore=state.transactions.length;
  openCatSheet('food'); await wait(280);
  document.querySelector('[data-del="food"]').click(); await wait(240);
  document.querySelector('[data-delyes="food"]').click(); await wait(380);
  o.cats=state.categories.map(c=>c.name).sort().join(',');
  o.txKept=state.transactions.length===txBefore;
  o.orphaned=state.transactions.filter(t=>!state.categories.some(c=>c.id===t.catId)).length;
  o.budgetLeft=Object.keys(state.budgets['2026-08']||{}).sort().join(',');
  o.sheetClosed=!document.getElementById('catSheet').classList.contains('on');
  return o;
});
check('the delete on a category sheet starts as a button, not a question',
      del.startsAsAButton===true);
check('...and one tap arms it rather than deleting anything',
      del.armedNotFired===true);
check('...with the question naming what it costs, in counts',
      /2 subcategories/i.test(del.question) && /2 entries/i.test(del.question)
      && /\$450/.test(del.question), del.question.replace(/\n/g,' | '));
check('...and saying the money survives it either way',
      /never deletes money/i.test(del.question));
check('"Keep it" disarms and changes nothing', del.keptIt===true);
check('an armed delete never survives leaving the sheet',
      del.reopenNotArmed===true && del.otherNotArmed===true);
check('...and a category with nothing against it says so, rather than inventing a cost',
      /nothing is lost/i.test(del.emptyCopy), del.emptyCopy.replace(/\n/g,' | '));
check('confirming takes the group and everything filed under it',
      del.cats==='Nothing here,Rent', del.cats);
check('...while removing no money at all - the entries survive, unfiled',
      del.txKept===true && del.orphaned===2, `kept=${del.txKept} orphaned=${del.orphaned}`);
check('...their assignments are cleared', del.budgetLeft==='rent', del.budgetLeft);
check('...and the sheet it just emptied closes itself', del.sheetClosed===true);

/* ---- 77. Planned mode carries the one-glance answer again ----
   The three-way toggle made every row show one number, which is what the
   toggle was for. But the number Planned shows is the one you TYPE, and the
   list existed to answer a different question: is there anything left in this
   category. Answering it meant leaving the mode you were working in.

   So Planned carries a second, quieter figure inside the same money cell - not
   a second column, or the uniformity the toggle bought would be spent again.
   It only appears when there is something to say: a category with nothing
   assigned has no remainder worth printing.

   Asserted as a property, not a layout: whatever the mode, a row has exactly
   ONE money cell. That is the thing the toggle promised and the thing a second
   figure could quietly break. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true, planView:'planned',
  categories:[{id:'g',name:'Home'},{id:'k1',name:'Rent',parentId:'g'},{id:'k2',name:'Power',parentId:'g'},
              {id:'solo',name:'Fun'},{id:'zero',name:'Untouched'}],
  budgets:{'2026-08':{k1:1200,k2:150,solo:200}},
  transactions:[{id:'x1',type:'expense',amount:1200,date:'2026-08-02',catId:'k1'},
                {id:'x2',type:'expense',amount:90,date:'2026-08-05',catId:'k2'},
                {id:'x3',type:'expense',amount:260,date:'2026-08-09',catId:'solo'}]});
await p.reload(); await p.waitForTimeout(450);
const pmv = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  activateTab('budget'); setPlanView('planned'); await wait(320);
  const cells=()=>[...document.querySelectorAll('#cats .rw-money')];
  o.oneCellEach=cells().every(c=>c.children.length===1);
  const hint=r=>{ const h=r.querySelector('.rw-left'); return h?h.innerText.trim():null; };
  const row=id=>document.querySelector('#cats [data-row="'+id+'"]');
  o.leafLeft=hint(row('k2'));
  o.groupLeft=hint(row('g'));
  /* nothing assigned means nothing to say - silence, not "$0 left" */
  o.zeroSilent=hint(row('zero'))===null;
  /* over is over, and it says so in the colour the rest of the app uses */
  o.overText=hint(row('solo'));
  o.overFlagged=!!row('solo').querySelector('.rw-left.over');
  o.underNotFlagged=!row('k2').querySelector('.rw-left.over');
  /* the dollar sign still sits beside the field, not stacked above it */
  const inp=row('k2').querySelector('.sub-assign input');
  const dol=row('k2').querySelector('.sa-row');
  o.dollarBeside=!!dol && Math.abs(dol.getBoundingClientRect().top-inp.getBoundingClientRect().top)<6;
  /* It follows what you type, without waiting for a reload. Both events, in the
     order a real keyboard fires them: `input` is what commits the number (and
     deliberately does NOT redraw the rows, because re-rendering on every
     keystroke would take the field out from under the thumb), and `change` on
     blur is what redraws. Dispatching only `change` writes nothing and then
     redraws the old value, which is a test failing at its own fixture. */
  inp.value='300';
  inp.dispatchEvent(new Event('input',{bubbles:true}));
  inp.dispatchEvent(new Event('change',{bubbles:true})); await wait(320);
  o.afterTyping=hint(document.querySelector('#cats [data-row="k2"]'));
  /* and the other two modes are untouched - they ARE the answer, so a hint
     under them would be the same number printed twice */
  setPlanView('spent'); await wait(280);
  o.spentNoHint=!document.querySelector('#cats .rw-left');
  o.spentOneCell=cells().every(c=>c.children.length===1);
  setPlanView('left'); await wait(280);
  o.leftNoHint=!document.querySelector('#cats .rw-left');
  o.leftOneCell=cells().every(c=>c.children.length===1);
  return o;
});
check('in Planned, a row still has exactly one money cell', pmv.oneCellEach===true);
check('...and that cell carries what is left as well as what you typed',
      /\$60\b/.test(pmv.leafLeft||''), pmv.leafLeft);
check('...on a group too, totalled across everything under it',
      /\$60\b/.test(pmv.groupLeft||''), pmv.groupLeft);
check('a category with nothing assigned says nothing, rather than "$0 left"',
      pmv.zeroSilent===true);
check('going over is stated and coloured, not just quietly negative',
      /\$60\b/.test(pmv.overText||'') && pmv.overFlagged===true && pmv.underNotFlagged===true,
      `${pmv.overText} over=${pmv.overFlagged} under=${pmv.underNotFlagged}`);
check('the dollar sign still sits beside the field, not above it', pmv.dollarBeside===true);
check('the hint follows what you type, the moment the field is done',
      /\$210\b/.test(pmv.afterTyping||''), pmv.afterTyping);
check('Spent carries no remainder hint - it is not the question that mode asks',
      pmv.spentNoHint===true && pmv.spentOneCell===true);
check('Remaining carries none either - it IS the column',
      pmv.leftNoHint===true && pmv.leftOneCell===true);

/* ---- 78. a credit card is a balance AND a move, and they are different facts ----
   Asked directly: "I have a card with a $13,700 limit and an equity line at
   $25,000. I never keep a large balance - I use the card for the rewards and
   pay it straight off. Should it be created as a debt repayment alone or
   should it be in a balance?"

   The reason the question has no clean answer is that two facts are hiding
   inside one object. What you OWE is a balance and belongs in accounts, so net
   worth counts it the moment it exists. What you PAY is not spending: the
   purchase was the spending, on the day it happened. Logging the payment as an
   expense charges you twice for the same groceries, and nothing on screen ever
   says so - both entries look completely normal.

   So: a credit account kind that stores what is owed as a NEGATIVE balance and
   takes it as a positive number, which means every signed sum already in the
   app comes out right without learning that credit exists. And a transfer type
   worth exactly zero in the ledger, so paying the card moves money instead of
   spending it a second time.

   The limit is not decoration. Someone who keeps a $25,000 line at zero does
   not own an empty account - they own room, and room is why they keep it. */
await seed({...EMPTY, activeMonth:'2026-08', uiMode:'all', stageReached:3, guidesOff:true,
  categories:[{id:'food',name:'Food'}],
  budgets:{'2026-08':{food:400}},
  accounts:[{id:'chk',name:'Checking',kind:'checking',balance:2000,updated:'2026-01-01'},
            {id:'card',name:'Rewards Card',kind:'credit',balance:-412,limit:13700,apr:13,updated:'2026-01-01'},
            {id:'heloc',name:'Equity Line',kind:'credit',balance:0,limit:25000,apr:3.6,updated:'2026-01-01'}],
  transactions:[{id:'g1',type:'expense',amount:300,date:'2026-08-04',catId:'food',acctId:'card'}]});
await p.reload(); await p.waitForTimeout(500);
const cc = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  /* the arithmetic, before any of the words */
  o.owed=owedTotal();
  o.inBank=assetAcctTotal();
  o.reconciles=Math.abs((assetAcctTotal()-owedTotal())-bankTotal())<0.005;
  o.netWorth=netWorth();
  o.liquid=liquidTotal();
  o.cardExpected=-acctExpected(state.accounts.find(a=>a.id==='card'));
  o.groceriesCounted=monthExpense('2026-08');
  o.room=acctHeadroom(state.accounts.find(a=>a.id==='heloc'));
  o.util=acctUtil(state.accounts.find(a=>a.id==='card'));
  o.zeroLineStillHasRoom=acctHeadroom(state.accounts.find(a=>a.id==='heloc'))===25000;

  activateTab('goals'); renderAccounts(); await wait(320);
  const rows=[...document.querySelectorAll('.acct-row')];
  o.typedPositive=[...document.querySelectorAll('.acct-row.owed input[data-acctbal]')].map(i=>+i.value);
  o.rowText=rows.map(r=>r.innerText).join(' | ');
  o.summary=document.getElementById('acctSummary').innerText;

  /* paying it: a move, not a second grocery bill */
  activateTab('tx'); await wait(250);
  document.querySelector('#typeToggle button[data-t="transfer"]').click(); await wait(200);
  o.bothEnds=!document.getElementById('fldAcct').classList.contains('hide')
          && !document.getElementById('fldXfer').classList.contains('hide');
  o.noCategoryAsked=document.getElementById('fldCat').classList.contains('hide');
  o.xferNote=document.getElementById('xferNote').innerText;
  document.getElementById('txAmt').value='300';
  document.getElementById('txDate').value='2026-08-20';
  document.getElementById('txAcct').value='chk';
  document.getElementById('txXferTo').value='card';
  document.getElementById('addTx').click(); await wait(400);

  o.stillOneGroceryBill=monthExpense('2026-08');
  o.ledgerIgnoresTheMove=allTimeBalance();
  o.checkingDown=acctExpected(state.accounts.find(a=>a.id==='chk'));
  o.cardBackDown=-acctExpected(state.accounts.find(a=>a.id==='card'));
  o.netWorthAfter=netWorth();

  /* both ends survive as a pair, or the entry quietly stops moving anything */
  const t=state.transactions.find(x=>x.type==='transfer');
  editTx(t.id,{destAcctId:t.acctId}); await wait(220);
  const t2=state.transactions.find(x=>x.type==='transfer');
  o.cannotCollapse=t2.acctId!==t2.destAcctId;

  /* typed in twice is the one way this double counts, and it is named */
  state.liabilities.push({id:'dup',name:'Rewards card',value:412}); save();
  activateTab('goals'); renderAccounts(); await wait(300);
  o.dupCaught=document.getElementById('acctSummary').innerText;
  return o;
});
check('what is owed on a card is its own figure, not a smaller bank balance',
      cc.owed===412 && cc.inBank===2000, `owed=${cc.owed} bank=${cc.inBank}`);
check('...and the two still add back to the signed total net worth uses',
      cc.reconciles===true);
check('a card comes off net worth the moment it exists',
      Math.abs(cc.netWorth-1588)<0.005, String(cc.netWorth));
check('borrowing room is never counted as cash you could spend',
      cc.liquid===2000, String(cc.liquid));
check('a line kept at zero still reports its room - that is why it is kept',
      cc.zeroLineStillHasRoom===true && cc.room===25000, String(cc.room));
check('...and a card reports how much of the line is used', cc.util===3, String(cc.util));
check('buying on the card is spending, and lands on the card',
      cc.groceriesCounted===300 && cc.cardExpected===712,
      `spent=${cc.groceriesCounted} card=${cc.cardExpected}`);
check('what is owed is typed as a positive number, never as a minus sign',
      cc.typedPositive.every(v=>v>=0), JSON.stringify(cc.typedPositive));
check('...and the row says how much room is left, not the debt alone',
      /room left/i.test(cc.rowText), cc.rowText.slice(0,160));
check('the accounts summary answers the question that was asked',
      /it is both/i.test(cc.summary) && /not an expense/i.test(cc.summary),
      cc.summary.slice(0,220));
check('...and with two lines at two rates, names which one is expensive',
      /13%/.test(cc.summary) && /3\.6%/.test(cc.summary), cc.summary.slice(0,260));
check('a move asks for both ends and for no category at all',
      cc.bothEnds===true && cc.noCategoryAsked===true);
check('...and says out loud that moving your own money is not spending',
      /not spending/i.test(cc.xferNote), cc.xferNote.slice(0,140));
check('paying the card does not bill you for the groceries twice',
      cc.stillOneGroceryBill===300, String(cc.stillOneGroceryBill));
check('...the ledger treats the move as worth exactly zero',
      Math.abs(cc.ledgerIgnoresTheMove-(-300))<0.005, String(cc.ledgerIgnoresTheMove));
check('...while both real balances move, in opposite directions',
      Math.abs(cc.checkingDown-1700)<0.005 && Math.abs(cc.cardBackDown-412)<0.005,
      `chk=${cc.checkingDown} card=${cc.cardBackDown}`);
check('...and net worth is unchanged by it, because nothing was earned or spent',
      Math.abs(cc.netWorthAfter-cc.netWorth)<0.005,
      `${cc.netWorth} -> ${cc.netWorthAfter}`);
check('a move cannot be edited into having one end', cc.cannotCollapse===true);
check('a card tracked here and typed in again as a liability is caught by name',
      /subtracting that money twice/i.test(cc.dupCaught), cc.dupCaught.slice(-200));

/* ---- 79. the rate layer: it learns your situation instead of reciting it back ----
   Asked for as: "I care more about it knowing about the interest rate - not so
   it produces a budget number, but so it learns each person's situation and
   says hey, you have a high rate on this card, moving it could be beneficial.
   It should teach instead of regurgitate."

   The blocker was never arithmetic. A borrowing rate could be typed into three
   unrelated places - a credit account, a liability, the payoff planner - and
   nothing in the app ever looked at all three at once, so it could know you pay
   13% on one thing and 3.6% on another and have nothing to say about the two
   facts sitting side by side. `pricedLines()` is that one list; the signals
   read it.

   Everything here is a property of the SENTENCES, because that is where a
   suggestion engine goes wrong. Three rules, each with its own check:

   1. It never says do it. Priced both ways, decision handed back.
   2. It names why the cheap line is cheap. A 3.6% line is cheap because there
      is something they can take, and a spread quoted without that is advice
      with the risk edited out.
   3. It says when the answer is "this does not matter". A $12-a-year finding
      dressed up as a finding is the most dishonest thing this could do.

   The fixtures are the numbers the request arrived with: a $13,700 card at 13%
   and a $25,000 equity line at 3.6%. */
const RATE_BASE={...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08', hourlyWage:30,
  categories:[{id:'food',name:'Food'},{id:'rent',name:'Rent'}],
  budgets:{'2026-08':{food:400,rent:1200}},
  transactions:[{id:'i1',type:'income',amount:4000,date:'2026-08-01'},
                {id:'e1',type:'expense',amount:1200,date:'2026-08-02',catId:'rent'},
                {id:'e2',type:'expense',amount:300,date:'2026-08-05',catId:'food'}]};
const readReport = () => p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('reflect'); rfTab='report'; renderReflectTab(); await wait(220);
  const {signals,locked}=buildReport();
  return { txt:document.getElementById('rpBody').innerText,
           ks:signals.map(x=>x.k), locked:locked.map(l=>l.t),
           order:signals.map(x=>({k:x.k,bad:!!x.bad,standing:!!x.standing,outside:!!x.outside})) };
});

await seed({...RATE_BASE, accounts:[
  {id:'chk',name:'Checking',kind:'checking',balance:2000,updated:'2026-01-01'},
  {id:'card',name:'Rewards Card',kind:'credit',balance:-4000,limit:13700,apr:13,updated:'2026-01-01'},
  {id:'heloc',name:'Equity Line',kind:'credit',balance:0,limit:25000,apr:3.6,secured:true,updated:'2026-01-01'}]});
await p.reload(); await p.waitForTimeout(600);
let rr=await readReport();
check('it finds the dearest money without being asked',
      rr.ks.includes('rateSpread'), rr.ks.join(','));
check('...and prices a year of keeping it, and a year of keeping it elsewhere',
      /\$520/.test(rr.txt) && /\$144/.test(rr.txt), rr.txt.slice(0,240));
check('...showing the arithmetic rather than asserting the number',
      /×\s*\(13%\s*−\s*3\.6%\)/.test(rr.txt), rr.txt.slice(0,240));
check('it names the reason the cheap line is cheap',
      /backed by something you own/i.test(rr.txt) && /take the house/i.test(rr.txt),
      rr.txt.slice(0,240));
check('...and refuses to tell you to do it',
      /not going to tell you to do it/i.test(rr.txt));
check('a situation reading is labelled as one, not passed off as the month',
      /true right now, not just in/i.test(rr.txt));
{ const firstStanding=rr.order.findIndex(o=>o.standing&&!o.bad);
  /* Three bands, not two: the month's own reading, then your standing
     situation, then outside context - which was already last and has to
     stay last, so it is excluded here rather than counted as the month. */
  const lastMonth=rr.order.map((o,i)=>(!o.standing&&!o.bad&&!o.outside)?i:-1).filter(i=>i>=0).pop();
  check('...and sits behind the month it is not about',
        firstStanding<0 || lastMonth==null || firstStanding>lastMonth,
        JSON.stringify(rr.order).slice(0,180)); }

/* The rule that separates this from a comparison site. Same shape as the
   leverage sweep above, over the engine and everything it prints. */
const rateNeverBlesses = await p.evaluate(() => {
  const src=document.documentElement.outerHTML;
  /* The engine AND the voice banks it closes with. The banks are declared well
     before the signals, so a sweep over the signals alone would leave the
     sentences most likely to overreach - the savage tier - entirely unchecked.
     The leverage sweep above learned this the same way. */
  const i=src.indexOf("k:'rateSpread'"), j=src.indexOf("k:'oCpi'");
  const t0=src.indexOf('rateSpread:{'), t1=src.indexOf('oCardBelow:{');
  const seg=src.slice(i,j)+src.slice(t0,t1);
  const bless=/\b(you should|we recommend|recommended|move it there|switch to the|smart move|no[- ]brainer|obviously worth it|best option)\b/i;
  const control='Honestly this is a smart move and you should switch to the cheaper line.';
  return {hit:(seg.match(bless)||[])[0]||null, canFire:bless.test(control),
          refuses:/not going to tell you to do it/.test(seg), len:seg.length};
});
check('...the never-blesses sweep can actually fire, over a real span of source',
      rateNeverBlesses.canFire===true && rateNeverBlesses.len>2000,
      `len ${rateNeverBlesses.len}`);
check('nothing in it tells anyone what to do with their money',
      rateNeverBlesses.hit===null, rateNeverBlesses.hit);
check('...and it says out loud that it will not',
      rateNeverBlesses.refuses===true);

/* A spread worth almost nothing has to be called almost nothing. */
await seed({...RATE_BASE, accounts:[
  {id:'chk',name:'Checking',kind:'checking',balance:2000,updated:'2026-01-01'},
  {id:'card',name:'Rewards Card',kind:'credit',balance:-200,limit:13700,apr:13,updated:'2026-01-01'},
  {id:'heloc',name:'Equity Line',kind:'credit',balance:0,limit:25000,apr:8,updated:'2026-01-01'}]});
await p.reload(); await p.waitForTimeout(600);
rr=await readReport();
check('a gap worth almost nothing is called almost nothing',
      /not much/i.test(rr.txt) && /not worth an afternoon/i.test(rr.txt), rr.txt.slice(0,240));

/* A cheap line that cannot absorb a balance must not be offered as if it could. */
await seed({...RATE_BASE,
  accounts:[{id:'chk',name:'Checking',kind:'checking',balance:2000,updated:'2026-01-01'},
            {id:'card',name:'Card',kind:'credit',balance:-4000,limit:13700,apr:19,updated:'2026-01-01'}],
  liabilities:[{id:'m',name:'Mortgage',value:210000,apr:4.1}]});
await p.reload(); await p.waitForTimeout(600);
rr=await readReport();
check('a cheap mortgage is not offered as somewhere to put a card balance',
      !rr.ks.includes('rateSpread'), rr.ks.join(','));
check('...but two balances at two prices are still ordered by what a dollar does',
      rr.ks.includes('rateOrder') && /same dollar/i.test(rr.txt), rr.ks.join(','));
check('...and the order is called arithmetic while sticking to it is called yours',
      /whether you can stick to it is not/i.test(rr.txt) && /abandoned in March/i.test(rr.txt));

/* Idle cash beside a carried balance, with the buffer defended both ways. */
await seed({...RATE_BASE, accounts:[
  {id:'chk',name:'Checking',kind:'checking',balance:9000,updated:'2026-01-01'},
  {id:'card',name:'Card',kind:'credit',balance:-1000,limit:13700,apr:13,updated:'2026-01-01'}]});
await p.reload(); await p.waitForTimeout(600);
rr=await readReport();
check('idle cash beside a carried balance is noticed',
      rr.ks.includes('rateIdle'), rr.ks.join(','));
check('...with three months of essentials ring-fenced first',
      /three months of your essentials/i.test(rr.txt), rr.txt.slice(0,240));
check('...and the cost of losing the flexibility stated on the other side',
      /money on a card is gone/i.test(rr.txt));

await seed({...RATE_BASE, accounts:[
  {id:'chk',name:'Checking',kind:'checking',balance:600,updated:'2026-01-01'},
  {id:'card',name:'Card',kind:'credit',balance:-1000,limit:13700,apr:13,updated:'2026-01-01'}]});
await p.reload(); await p.waitForTimeout(600);
rr=await readReport();
check('with no buffer the answer flips to the buffer',
      /buffer comes before the interest/i.test(rr.txt), rr.txt.slice(0,240));
check('...and that is called the right answer, not a disappointing one',
      /right answer rather than a disappointing one/i.test(rr.txt));

/* The play that is working, priced so it is a fact rather than a compliment. */
await seed({...RATE_BASE,
  accounts:[{id:'chk',name:'Checking',kind:'checking',balance:2000,updated:'2026-01-01'},
            {id:'card',name:'Rewards Card',kind:'credit',balance:0,limit:13700,apr:13,updated:'2026-01-01'}],
  transactions:[...RATE_BASE.transactions,
    {id:'c1',type:'expense',amount:300,date:'2026-07-04',catId:'food',acctId:'card'},
    {id:'c2',type:'expense',amount:250,date:'2026-08-04',catId:'food',acctId:'card'},
    {id:'c3',type:'expense',amount:400,date:'2026-08-14',catId:'food',acctId:'card'}]});
await p.reload(); await p.waitForTimeout(600);
rr=await readReport();
check('clearing the card every month is recognised as the play working',
      rr.ks.includes('rateClear'), rr.ks.join(','));
check('...and priced, so it is a fact rather than a compliment',
      /only arrangement where rewards are actually free/i.test(rr.txt));

/* What it cannot read, named, with the way to fix it. */
await seed({...RATE_BASE, accounts:[
  {id:'chk',name:'Checking',kind:'checking',balance:2000,updated:'2026-01-01'},
  {id:'card',name:'Store Card',kind:'credit',balance:-800,limit:2000,updated:'2026-01-01'}]});
await p.reload(); await p.waitForTimeout(600);
rr=await readReport();
check('a balance with no price on it is named as the thing it cannot read',
      rr.locked.some(l=>/Store Card/.test(l) && /the whole story/.test(l)),
      JSON.stringify(rr.locked).slice(0,200));

/* Three readings is a direction. Two is a line. */
await seed({...RATE_BASE,
  accounts:[{id:'card',name:'Card',kind:'credit',balance:-3000,limit:13700,apr:13,updated:'2026-01-01'}],
  snapshots:[{month:'2026-06',bank:0,owed:1000},{month:'2026-07',bank:0,owed:2000},{month:'2026-08',bank:0,owed:3000}]});
await p.reload(); await p.waitForTimeout(600);
rr=await readReport();
check('three rising readings of what you owe is reported as a direction',
      rr.ks.includes('owedTrend'), rr.ks.join(','));
{ const i=rr.order.findIndex(o=>o.k==='owedTrend');
  const firstGood=rr.order.findIndex(o=>!o.bad);
  check('...and leads with the bad news, ahead of everything that is not bad',
        i>=0 && rr.order[i].bad===true && (firstGood<0 || i<firstGood),
        JSON.stringify(rr.order).slice(0,180)); }
check('...while refusing to call a one-off a habit',
      /reads exactly the same from here/i.test(rr.txt));

await seed({...RATE_BASE,
  accounts:[{id:'card',name:'Card',kind:'credit',balance:-3000,limit:13700,apr:13,updated:'2026-01-01'}],
  snapshots:[{month:'2026-07',bank:0,owed:2000},{month:'2026-08',bank:0,owed:3000}]});
await p.reload(); await p.waitForTimeout(600);
rr=await readReport();
check('two readings is not yet a direction',
      !rr.ks.includes('owedTrend'), rr.ks.join(','));

/* One debt typed into two places is one debt. */
const dedupe = await p.evaluate(() => {
  state.accounts=[]; state.liabilities=[{id:'l',name:'Visa Card',value:2000,apr:22}];
  state.debts=[{id:'d',name:'Visa card',balance:2000,minPayment:60,apr:22}];
  const n=pricedLines().length;
  state.liabilities=[{id:'l2',name:'Visa Card',value:2000}];
  state.debts=[{id:'d2',name:'Visa card',balance:2000,minPayment:60,apr:22}];
  return {count:n, keptApr:pricedLines()[0].apr};
});
check('the same debt named in two places is one line, not two',
      dedupe.count===1, String(dedupe.count));
check('...and the copy that knows what it costs is the one kept',
      dedupe.keptApr===22, String(dedupe.keptApr));

/* ---- 80. the expected balance shows its work, and the readings are kept ----
   Sent as two phone screenshots of the Build tab: "Expected now $6,637.64,
   +$2,794.36 logged since" with a button, and the questions - "this figure
   needs to show its work", "a way to say it's already been added and can be
   dismissed", "are all these figures actually being tracked when changed?"

   The third one had an uncomfortable answer: no. The monthly snapshot stored a
   single aggregate `bank` figure, so Joint Checking up $2,794 and Stash down
   $2,000 in the same month showed as $794 of nothing-in-particular. No
   individual account had a history at all - retyping a balance overwrote the
   number and the old one was gone. "Tendencies" is about spending categories
   and never touched accounts.

   Three things, and each answers one of the questions:

   1. The projection shows its arithmetic. It was the only figure in the app
      asking to be trusted while showing nothing, and it is the one that asks
      you to overwrite a real bank balance.
   2. A second action - "Bank still says $X" - which is the honest version of
      dismiss. Nothing about the money changes; what changes is that it has been
      CHECKED, and the gap between what the ledger expected and what the bank
      says gets recorded rather than waved away. That gap is the finding.
   3. Every reading is kept, dated, with how it was arrived at. One per day per
      account, because a balance corrected twice in an afternoon is one reading
      with a typo in it. The aggregate trend can finally name which account
      moved. */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08', hourlyWage:30,
  categories:[{id:'food',name:'Food'}], budgets:{'2026-08':{food:400}},
  accounts:[{id:'chk',name:'Joint Checking',kind:'checking',purpose:'sinking',balance:3843.28,updated:'2026-08-25'}],
  transactions:[{id:'t1',type:'income',amount:3000,date:'2026-08-26',source:'Paycheck',acctId:'chk'},
                {id:'t2',type:'expense',amount:150,date:'2026-08-26',catId:'food',acctId:'chk'},
                {id:'t3',type:'expense',amount:55.64,date:'2026-08-27',catId:'food',acctId:'chk'}]});
await p.reload(); await p.waitForTimeout(600);
const acw = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('goals'); renderAccounts(); await wait(300);
  const o={};
  o.stillProjects=/Expected now/.test(document.querySelector('.acct-row').innerText);
  o.hasWork=!!document.querySelector('.ac-work');
  if(o.hasWork){
    document.querySelector('.ac-work').open=true; await wait(120);
    o.sum=document.querySelector('.acw-sum').innerText.trim();
    o.row=document.querySelector('.acct-row').innerText;
    o.parts=[...document.querySelectorAll('.acw-p')].map(x=>x.innerText.replace(/\n/g,' '));
    o.entries=[...document.querySelectorAll('.acw-r')].length;
  }
  o.keepBtn=(document.querySelector('[data-acctkeep="chk"]')||{}).textContent||'';
  /* confirming: no money moves, the date does, the gap is kept */
  document.querySelector('[data-acctkeep="chk"]').click(); await wait(320);
  const a=state.accounts[0];
  o.balanceUnmoved=a.balance===3843.28;
  o.dateMoved=a.updated===todayStr();
  o.gap=a.lastGap;
  o.promptGone=!/Expected now/.test(document.querySelector('.acct-row').innerText);
  o.recorded=(a.hist||[]).length;
  o.how=(a.hist||[]).slice(-1)[0].how;
  return o;
});
check('the expected balance still projects, and now offers its arithmetic',
      acw.stillProjects===true && acw.hasWork===true);
check('...adding up start to finish, in one line',
      /^\$3,843\.28 \+ \$3,000 − \$205\.64 = \$6,637\.64$/.test(acw.sum||''), acw.sum);
check('...broken down by kind, with how many entries are behind each',
      (acw.parts||[]).some(x=>/money in/.test(x)&&/\+\$3,000/.test(x))
        && (acw.parts||[]).some(x=>/money out/.test(x)), (acw.parts||[]).join(' | '));
check('...and the entries themselves, so it can be checked against a statement',
      acw.entries===3, String(acw.entries));
check('...and it says the bank wins whenever the two disagree',
      /the bank is right/i.test(acw.row||''), (acw.row||'').slice(0,120));
check('there is a way to say the bank still says this, labelled with the figure',
      /Bank still says \$3,843\.28/.test(acw.keepBtn), acw.keepBtn);
check('...confirming moves no money at all', acw.balanceUnmoved===true);
check('...but does count as checking it', acw.dateMoved===true);
check('...and records the gap rather than dismissing it',
      Math.abs((acw.gap||0)-(-2794.36))<0.01, String(acw.gap));
check('...after which there is nothing logged since, so the prompt is gone',
      acw.promptGone===true);
check('the reading is kept, with how it was arrived at',
      acw.recorded>=1 && acw.how==='confirmed', `${acw.recorded} / ${acw.how}`);

/* Every route to a balance records one, and two on one day is one reading. */
const acHist = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  const a=state.accounts[0];
  a.hist=[{d:'2026-06-30',b:2000,how:'first'},{d:'2026-07-31',b:2500,how:'bank'}];
  a.balance=2500; a.updated='2026-07-31'; save(); renderAccounts(); await wait(220);
  const inp=document.querySelector('input[data-acctbal="chk"]');
  inp.value='6637.64'; inp.dispatchEvent(new Event('change',{bubbles:true})); await wait(320);
  o.afterTyped=state.accounts[0].hist.length;
  o.typedHow=state.accounts[0].hist.slice(-1)[0].how;
  const inp2=document.querySelector('input[data-acctbal="chk"]');
  inp2.value='6700'; inp2.dispatchEvent(new Event('change',{bubbles:true})); await wait(320);
  o.afterCorrection=state.accounts[0].hist.length;
  o.lastValue=state.accounts[0].hist.slice(-1)[0].b;
  renderAccounts(); await wait(200);
  const det=document.querySelector('.ac-hist');
  o.saysSo=det?det.querySelector('summary').innerText:'';
  if(det){ det.open=true; await wait(120); o.body=det.innerText; }
  return o;
});
check('typing a balance records a reading', acHist.afterTyped===3 && acHist.typedHow==='bank',
      `${acHist.afterTyped} / ${acHist.typedHow}`);
check('...and correcting it the same day is one reading, not two',
      acHist.afterCorrection===3 && acHist.lastValue===6700,
      `${acHist.afterCorrection} / ${acHist.lastValue}`);
check('the row says how many readings it holds and what they add up to',
      /3 readings since 2026-06-30/.test(acHist.saysSo||'') && /up \$4,700/.test(acHist.saysSo||''),
      acHist.saysSo);
check('...and refuses to imply it knows anything from before it was added',
      /cannot be recovered/i.test(acHist.body||''), (acHist.body||'').slice(-120));

/* The aggregate could never say which account did it. Now it can. */
const acTrend = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  state.accounts=[
    {id:'chk',name:'Joint Checking',kind:'checking',balance:6637.64,updated:'2026-08-27',
     hist:[{d:'2026-07-31',b:3843.28,how:'bank'},{d:'2026-08-27',b:6637.64,how:'bank'}]},
    {id:'st',name:'Stash',kind:'invest',balance:16671.22,updated:'2026-08-26',
     hist:[{d:'2026-07-31',b:18671.22,how:'bank'},{d:'2026-08-26',b:16671.22,how:'bank'}]}];
  state.snapshots=[{month:'2026-07',bank:22514,owed:0},{month:'2026-08',bank:23308,owed:0}];
  save();
  activateTab('reflect'); rfTab='trends'; renderReflectTab(); await wait(250);
  trendPick='bank'; renderTrendSeries(); await wait(250);
  const pts=trendMonths(6).map(m=>({m, v:(state.snapshots.find(s=>s.month===m)||{}).bank ?? null}));
  const i=pts.findIndex(x=>x.m==='2026-08');
  return trendRead(TREND_SERIES.find(x=>x.k==='bank'), pts, i).replace(/<[^>]*>/g,' ');
});
check('the aggregate is still the headline it always was',
      /\$23,308/.test(acTrend), acTrend.slice(0,120));
check('...but no longer hides which account moved, or by how much',
      /Joint Checking up/.test(acTrend) && /Stash down/.test(acTrend)
        && /2,794/.test(acTrend) && /2,000/.test(acTrend), acTrend.slice(0,220));

/* ---- 81. swipe up for the drawer ----
   Asked for as: "I intuitively want to slide up from the bottom while on
   mobile to reveal the other options." The right instinct - every drawer on a
   phone works that way, and this one only opened by hitting one 64px target in
   the corner of the bar.

   The whole bar is the handle now, with a grip above the tabs that says so,
   because a gesture nothing on screen advertises is a gesture nobody finds.

   The care is not in the gesture. It is in not breaking the seven buttons
   underneath it, and that is what most of this section checks: nothing happens
   until the finger has moved decisively and vertically, the phantom click a
   phone fires at the end of a drag is swallowed, and a deliberate tap
   afterwards still lands.

   The first version failed that last one in a way worth recording. It swallowed
   the next click using a FLAG that stayed set until a click came to clear it -
   so a swipe that opened nothing armed a trap, and the next tap on the bar,
   whenever it happened, was eaten. A bar where a decisive tap sometimes
   navigates and sometimes does not is worse than no gesture at all, which is
   what the comment above the code already said before the code did it wrong.
   It is a 350ms window now, wide enough for the browser's compatibility click
   and too narrow to eat a decision. */
const swipeCtx = await b.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true });
const sp = await swipeCtx.newPage();
const swipeErrs=[]; sp.on('pageerror',e=>swipeErrs.push(e.message));
await sp.goto('file://'+process.cwd()+'/app.html'); await sp.waitForTimeout(400);
await sp.evaluate(st=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(st)),
  {...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08',
   categories:[{id:'c',name:'Food'}], budgets:{'2026-08':{c:400}},
   transactions:[{id:'i',type:'income',amount:3000,date:'2026-08-01'}]});
await sp.reload(); await sp.waitForTimeout(700);

/* Real TouchEvents at the element, so the listeners run as they would under a
   thumb rather than through a synthetic shortcut. */
const drag = (dy) => sp.evaluate(async (dy)=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const el=document.getElementById('tabs'), r=el.getBoundingClientRect();
  const x=r.left+r.width*0.25, y=r.top+8;
  const mk=(type,cx,cy)=>{ const t=new Touch({identifier:1,target:el,clientX:cx,clientY:cy});
    el.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[t],
      targetTouches:type==='touchend'?[]:[t],changedTouches:[t],bubbles:true,cancelable:true})); };
  mk('touchstart',x,y);
  for(let i=1;i<=6;i++){ mk('touchmove',x,y-(dy*i/6)); await wait(12); }
  mk('touchend',x,y-dy);
  await wait(220);
  return document.getElementById('tabs').classList.contains('more-open');
}, dy);

const swipeUI = await sp.evaluate(()=>{
  const g=document.getElementById('tabGrip'), r=g?g.getBoundingClientRect():null;
  return { hasGrip:!!g, w:r?Math.round(r.width):0, h:r?Math.round(r.height):0,
           hidden:g?g.getAttribute('aria-hidden'):null };
});
check('the bar carries a visible handle, so the gesture is not a secret',
      swipeUI.hasGrip===true && swipeUI.h>=3 && swipeUI.w>=30, JSON.stringify(swipeUI));
check('...and it is decoration to a screen reader, since More is the labelled control',
      swipeUI.hidden==='true');

check('swiping up opens the drawer', (await drag(70))===true);
const shown = await sp.evaluate(()=>{
  const t=document.getElementById('tabMore'), r=t.getBoundingClientRect();
  const opts=[...document.querySelectorAll('#tabMore .tab')].filter(x=>{
    const b=x.getBoundingClientRect();
    return b.width>20 && b.height>20 && b.top>=0 && b.bottom<=innerHeight+1; });
  return {h:Math.round(r.height), onScreen:r.top>=0&&r.bottom<=innerHeight+1, n:opts.length};
});
check('...and every one of the seven options is actually on the glass, not just class-toggled',
      shown.h>20 && shown.onScreen===true && shown.n===7, JSON.stringify(shown));
check('swiping down closes it', (await drag(-70))===false);
check('a swipe too small to be decisive does nothing', (await drag(14))===false);
check('a swipe down on a closed drawer does nothing', (await drag(-70))===false);

/* The button and the gesture are the same control and must never disagree. */
await sp.waitForTimeout(500);
await sp.evaluate(()=>document.getElementById('moreBtn').click());
await sp.waitForTimeout(160);
check('the More button still opens it, and says so to a screen reader',
      await sp.evaluate(()=>document.getElementById('tabs').classList.contains('more-open')
        && document.getElementById('moreBtn').getAttribute('aria-expanded')==='true'));
check('...and a swipe down closes what the button opened, button state and all',
      (await drag(-70))===false
        && await sp.evaluate(()=>document.getElementById('moreBtn').getAttribute('aria-expanded')==='false'));

/* The thing that must not break. */
await sp.evaluate(()=>document.getElementById('moreBtn').click());
await sp.waitForTimeout(160);
await sp.evaluate(()=>document.querySelector('#tabMore .tab[data-view="reflect"]').click());
await sp.waitForTimeout(320);
check('a plain tap on a drawer option still navigates',
      await sp.evaluate(()=>document.getElementById('view-reflect').classList.contains('on')));

const phantom = await sp.evaluate(async ()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('home'); setMoreOpen(false); await wait(200);
  const el=document.getElementById('tabs'), r=el.getBoundingClientRect();
  const x=r.left+r.width*0.25, y=r.top+8;
  const mk=(type,cx,cy)=>{ const t=new Touch({identifier:1,target:el,clientX:cx,clientY:cy});
    el.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[t],targetTouches:type==='touchend'?[]:[t],
      changedTouches:[t],bubbles:true,cancelable:true})); };
  mk('touchstart',x,y); for(let i=1;i<=6;i++){ mk('touchmove',x,y-70*i/6); await wait(10); } mk('touchend',x,y-70);
  await wait(60);
  const opt=document.querySelector('#tabMore .tab[data-view="learn"]');
  opt.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
  await wait(260);
  const swallowed=!document.getElementById('view-learn').classList.contains('on');
  opt.click(); await wait(260);
  return {swallowed, nextWorks:document.getElementById('view-learn').classList.contains('on')};
});
check('the click a phone fires at the end of a swipe does not navigate',
      phantom.swallowed===true);
check('...and the very next real tap does', phantom.nextWorks===true);

const stranded = await sp.evaluate(async ()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('home'); setMoreOpen(false); await wait(200);
  const el=document.getElementById('tabs'), r=el.getBoundingClientRect();
  const x=r.left+r.width*0.25, y=r.top+8;
  const mk=(type,cx,cy)=>{ const t=new Touch({identifier:1,target:el,clientX:cx,clientY:cy});
    el.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[t],targetTouches:type==='touchend'?[]:[t],
      changedTouches:[t],bubbles:true,cancelable:true})); };
  /* downward on a closed drawer: a real gesture that commits nothing */
  mk('touchstart',x,y); for(let i=1;i<=6;i++){ mk('touchmove',x,y+70*i/6); await wait(10); } mk('touchend',x,y+70);
  await wait(500);
  document.getElementById('moreBtn').click(); await wait(220);
  return document.getElementById('tabs').classList.contains('more-open');
});
check('a swipe that opened nothing leaves no trap for the next tap',
      stranded===true);
check('nothing in the gesture threw', swipeErrs.length===0, swipeErrs.join(' | '));
await swipeCtx.close();

/* ---- 82. a card cannot be somewhere money lands until it exists ----
   Sent as a screenshot of the Move form's destination list - seven accounts,
   no card, no equity line - with "shouldn't the move feature have my credit
   card and HELOC to land in?"

   It should, and it does. Driving the real pickers proved the wiring was
   already right: with credit accounts present they appear in both ends of a
   move, and a card is preselected as the destination because that is what a
   move usually is. They were missing because the two accounts had never been
   created.

   Which was not the user's mistake. The Accounts panel was headed "What's
   actually in the bank" and opened with "what's really sitting in each account
   today" - copy that tells you, correctly and clearly, that a credit card does
   not belong there. The credit kind had been built into a panel whose own words
   excluded it, and no amount of correct wiring survives that.

   So the checks here are about the words, and about the one place somebody
   hits the wall: the Move list itself, which now says where a card comes from
   and hands over the way to add one. */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08',
  categories:[{id:'c',name:'Food'}], budgets:{'2026-08':{c:400}},
  transactions:[{id:'i',type:'income',amount:3000,date:'2026-08-01'}],
  accounts:[{id:'a1',name:'Joint Checking',kind:'checking',balance:3000,updated:'2026-08-01'},
            {id:'a2',name:'Stash',kind:'invest',balance:18000,updated:'2026-08-01'}]});
await p.reload(); await p.waitForTimeout(600);
const cardDoor = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('goals'); await w(300);
  const d=[...document.querySelectorAll('#view-goals details')].find(x=>/Accounts/.test(x.innerText.slice(0,40)));
  if(d) d.open=true; await w(160);
  const o={head:d?d.querySelector('.acc-sub').textContent:'', body:d?d.innerText:''};
  activateTab('tx'); await w(300);
  document.querySelector('#typeToggle button[data-t="transfer"]').click(); await w(260);
  o.move=document.getElementById('xferNote').innerText;
  o.moveTrail=!!document.querySelector('#xferNote [data-trail="account"]');
  return o;
});
check('the accounts panel no longer says it is only about the bank',
      !/actually in the bank/i.test(cardDoor.head) && /what you owe/i.test(cardDoor.head),
      cardDoor.head);
check('...and its intro says cards and lines of credit belong there',
      /cards and lines of credit belong here/i.test(cardDoor.body), cardDoor.body.slice(0,200));
check('...naming the kind to pick, and that $0 is a real answer on an unused line',
      /Credit card \/ line of credit/.test(cardDoor.body) && /\$0 is a real answer/.test(cardDoor.body));
check('...and why it is worth doing, in the three things it unlocks',
      /off your net worth/i.test(cardDoor.body) && /room figure/i.test(cardDoor.body)
        && /costing you/i.test(cardDoor.body), cardDoor.body.slice(0,420));
check('with no card anywhere, the Move form says where one comes from',
      /has to exist here before it can be somewhere money lands/i.test(cardDoor.move),
      cardDoor.move);
check('...and hands over the way to add it rather than naming a tab',
      cardDoor.moveTrail===true);

/* And with the accounts present, the wiring the screenshot was asking about. */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08',
  categories:[{id:'c',name:'Food'}], budgets:{'2026-08':{c:400}},
  transactions:[{id:'i',type:'income',amount:3000,date:'2026-08-01'}],
  accounts:[{id:'a1',name:'Joint Checking',kind:'checking',balance:3000,updated:'2026-08-01'},
            {id:'a3',name:'Rewards Card',kind:'credit',balance:-412,limit:13700,apr:13,updated:'2026-08-01'},
            {id:'a4',name:'Equity Line',kind:'credit',balance:0,limit:25000,apr:3.6,secured:true,updated:'2026-08-01'}]});
await p.reload(); await p.waitForTimeout(600);
const cardLists = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(300);
  document.querySelector('#typeToggle button[data-t="transfer"]').click(); await w(260);
  const opts=id=>[...document.querySelectorAll('#'+id+' option')].map(o=>o.textContent);
  return {note:document.getElementById('xferNote').innerText,
          landsIn:opts('txXferTo'), comesFrom:opts('txAcct'),
          def:(document.getElementById('txXferTo')||{}).value, invest:opts('txInvPick')};
});
check('once a card exists the nudge stops, having done its job',
      !/has to exist here/i.test(cardLists.note), cardLists.note.slice(0,120));
check('a card and a line of credit are both places money can land',
      cardLists.landsIn.includes('Rewards Card') && cardLists.landsIn.includes('Equity Line'),
      cardLists.landsIn.join(', '));
check('...and both are places money can come out of',
      cardLists.comesFrom.includes('Rewards Card') && cardLists.comesFrom.includes('Equity Line'),
      cardLists.comesFrom.join(', '));
check('...with a card preselected, because that is what a move usually is',
      cardLists.def==='a3', cardLists.def);
check('but an investment still cannot land in a line of credit',
      !cardLists.invest.includes('Rewards Card') && !cardLists.invest.includes('Equity Line'),
      cardLists.invest.join(', '));

/* ---- 83. reading a bank screen, not just a notepad ----
   Sent as a screenshot of a bank's pending list, read into the quick log, and
   the result: "it needs to only read the description before Held, the prices
   are also wrong, a cleared button is also needed."

   The reader was built for a handwritten shopping list, where one line is one
   purchase and the number at the end is the price. A bank screen breaks every
   one of those assumptions at once, and broke them SILENTLY - nine rows, all
   wrong, all plausible enough to log:

     what: "Preauthorization / AI 8..."   $23,952      <- out of RR=623952602847
     what: "Aug 27"                       $2,026       <- a date wearing a price
     what: "3913595672 PK..."             $76,271

   Two changes. Records are found by the MONEY, not by the line break, because a
   bank record wraps across as many lines as it likes and ends with an amount.
   And the description is cut down to the part a person would actually read.

   The wrapped reference number is the subtle one and it is the whole reason the
   first fix was not enough: a phone splits "RR=623952602847" as "RR=623952" and
   "602847", so stripping KEY=VALUE leaves an orphan digit run sitting in the
   merchant name. "Kindle Unltd" came back as "7855866, Kindle Unltd".

   Every fixture below is the user's own text, wrapped exactly as their phone
   wrapped it. */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08',
  categories:[{id:'c1',name:'Getting around'}], budgets:{'2026-08':{c1:200}},
  transactions:[{id:'i',type:'income',amount:3000,date:'2026-08-01'}],
  accounts:[{id:'a1',name:'Free Checking',kind:'checking',balance:2000,updated:'2026-08-01'}]});
await p.reload(); await p.waitForTimeout(600);

const BANK_TEXT=[
 'Pending','',
 'Preauthorization / AI=867560,RR=623952','602847,PK=356239682557559 PMT*OH',
 'BUREAU MOTOR VEHIC Held:2026-08-27','14:57:35 EDT Exp:2026-08-30 14:57:35 EDT',
 'Aug 27, 2026','-$59.25','',
 'Preauthorization / AI=843880,RR=62','3913595672,PK=466239664376271',
 'MAHONINGCTYTITLE Held:2026-08-27','14:27:17 EDT Exp:2026-08-30 14:27:17 EDT',
 'Aug 27, 2026','-$21.49','',
 'Preauthorization / AI=157390,RR=62380','7855866,PK=466238683828615 Kindle',
 'Unltd Held:2026-08-26 14:59:42 EDT','Exp:2026-08-29 14:59:42 EDT',
 'Aug 26, 2026','-$12.89','',
 'Preauthorization / AI=107440,RR=623818','890417,PK=356238640867014 AIRBNB *',
 'HMREJET25N Held:2026-08-26 13:48:06','EDT Exp:2026-08-29 13:48:06 EDT',
 'Aug 26, 2026','-$329.00'].join('\n');

const bank = await p.evaluate(t=>({
  rows: qlParseOcr(t),
  deposit: qlParseOcr('ACH Credit / PAYROLL DIRECT DEP Held:2026-08-25 09:00:00 EDT\nAug 25, 2026\n+$1,300.00'),
  notepad: qlParseOcr('coffee 4.50\ngas 38\nlunch with sam 12.75'),
  orphan: qlParseOcr('$14.00\n$9.99'),
  starName: qlParseOcr('Bed * Bath $40.00'),
  realPurchase: qlParseOcr('SQ *PURCHASE COFFEE $6.25')
}), BANK_TEXT);

check('a wrapped bank record is one entry, not one per line',
      bank.rows.length===4, String(bank.rows.length));
check('...with the amounts that are actually on the screen',
      JSON.stringify(bank.rows.map(r=>r.amt))==='[59.25,21.49,12.89,329]',
      JSON.stringify(bank.rows.map(r=>r.amt)));
check('...and no reference number ever read as a price',
      !bank.rows.some(r=>[23952,62,76271,2026,867560,843880,3913595672].includes(r.amt)),
      JSON.stringify(bank.rows.map(r=>r.amt)));
check('the description stops before "Held", as asked',
      !bank.rows.some(r=>/Held/i.test(r.what)), JSON.stringify(bank.rows.map(r=>r.what)));
check('...and carries none of the plumbing around it',
      !bank.rows.some(r=>/AI=|RR=|PK=|Preauthorization|Pending|EDT|Exp:/i.test(r.what)),
      JSON.stringify(bank.rows.map(r=>r.what)));
check('...nor an orphan half of a reference number split across a line',
      !bank.rows.some(r=>/\d{5,}/.test(r.what)), JSON.stringify(bank.rows.map(r=>r.what)));
check('a processor tag comes off the front, leaving the merchant',
      bank.rows[0].what==='OH BUREAU MOTOR VEHIC', bank.rows[0].what);
check('a merchant with no tag is left exactly alone',
      bank.rows[1].what==='MAHONINGCTYTITLE', bank.rows[1].what);
check('a two-word merchant survives the wrap it was split across',
      bank.rows[2].what==='Kindle Unltd', bank.rows[2].what);
check('a booking code comes off the end',
      bank.rows[3].what==='AIRBNB', bank.rows[3].what);
check('nothing is read as money in, because a statement writes debits as minus',
      !bank.rows.some(r=>r.kind==='income'));
check('an explicit plus IS read as money in, thousands separator and all',
      bank.deposit.length===1 && bank.deposit[0].kind==='income' && bank.deposit[0].amt===1300,
      JSON.stringify(bank.deposit));

/* The path this was built for, which must not have moved an inch. */
check('a handwritten notepad still reads exactly the way it always did',
      bank.notepad.length===3 && bank.notepad[0].what==='coffee' && bank.notepad[0].amt===4.5
        && bank.notepad[1].amt===38 && bank.notepad[2].what==='lunch with sam'
        && bank.notepad[2].amt===12.75, JSON.stringify(bank.notepad));
/* This assertion used to read "is dropped, not logged blank", and it was
   wrong - it pinned the exact behaviour that made a four-record read come back
   as one. An amount OCR could price but not name is the most useful half of the
   pair: the amount is the tedious part to retype and the part the reader gets
   right. It is kept and flagged now, and section 85 holds the full case. */
check('a price with nothing to call it is kept and flagged, never dropped',
      bank.orphan.length===2 && bank.orphan.every(x=>x.unnamed===true && x.what===''),
      JSON.stringify(bank.orphan));
/* The two names the cleaner could most easily eat. */
check('a merchant with a star in its name keeps it',
      bank.starName.length===1 && bank.starName[0].what==='Bed * Bath',
      JSON.stringify(bank.starName));
check('...and a merchant whose name contains a lead-in word keeps that too',
      bank.realPurchase.length===1 && /COFFEE/.test(bank.realPurchase[0].what)
        && /PURCHASE/i.test(bank.realPurchase[0].what), JSON.stringify(bank.realPurchase));

/* "A cleared button is also needed." Armed, for the same reason a category
   delete is: clearing nine rows somebody has been correcting is not a thing a
   thumb should manage on its own. */
const qlc = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  activateTab('tx'); await w(280);
  document.getElementById('quickLogBtn').click(); await w(280);
  const cb=()=>document.getElementById('qlClear');
  o.exists=!!cb();
  cb().click(); await w(140);
  o.emptyClearsAtOnce=cb().textContent==='Clear';
  for(let i=0;i<2;i++) document.getElementById('qlAdd').click();
  [...document.querySelectorAll('.ql-row')].forEach((r,i)=>{
    r.querySelector('.ql-what').value='thing'+i; r.querySelector('.ql-amt').value=String(10+i); });
  cb().click(); await w(140);
  o.armedLabel=cb().textContent;
  o.nothingLostYet=document.querySelectorAll('.ql-row').length===3;
  cb().click(); await w(180);
  o.rowsAfter=document.querySelectorAll('.ql-row').length;
  o.emptyAfter=!document.querySelector('.ql-what').value && !document.querySelector('.ql-amt').value;
  o.labelAfter=cb().textContent;
  document.querySelector('.ql-what').value='x';
  cb().click(); await w(140);
  const armedAgain=cb().textContent;
  document.querySelector('.ql-what').dispatchEvent(new Event('input',{bubbles:true})); await w(140);
  o.typingDisarms=armedAgain!=='Clear' && cb().textContent==='Clear';
  return o;
});
check('the quick log has a Clear button', qlc.exists===true);
check('...which clears at once when there is nothing to lose',
      qlc.emptyClearsAtOnce===true);
check('...but names what it would cost before doing it',
      /Clear 3 lines\?/.test(qlc.armedLabel) && qlc.nothingLostYet===true,
      qlc.armedLabel);
check('...and the second tap clears, back to one empty row',
      qlc.rowsAfter===1 && qlc.emptyAfter===true && qlc.labelAfter==='Clear');
check('typing again cancels an armed clear, because that is a change of mind',
      qlc.typingDisarms===true);

/* ---- 84. the reader survives OCR, and deleting an entry is armed ----
   Two reports off one screenshot: "the delete button is too destructive" and
   "when adding it was only one thing added and that's the BMV entry."

   The second one is the interesting one, and the first instinct - that the save
   step was dropping rows - was wrong. Driving qlSave with four filled rows
   logged four. The loss was upstream, in a pattern of my own making: records
   were anchored on a $, which is safe and brittle. Tesseract reading a phone
   screenshot renders "-$59.25" cleanly about as often as it renders it "-S59.25"
   or drops the mark, so three of four records vanished and one logged. Which
   looks exactly like a bad reader rather than a strict pattern, and is worse
   than a visible failure because the one that did land looks right.

   A money token now has two shapes: a $ amount, or ANY number with exactly two
   decimal places. Inside bank text the second is nearly as safe as the first -
   a reference has no decimal point, a date uses hyphens, a time uses colons -
   and it survives the mark being eaten.

   Which reading to use is decided from the text itself now rather than from
   whether the pattern happened to hit. Deciding it by "did anything match" is
   what let a bad OCR pass fall through to a reading built for a shopping list.

   And the delete: third time this report has arrived - recurring, then the
   category sheet, now the entry sheet. Same answer, and the question names the
   amount, what it was, and what the plan gets back. */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08', hourlyWage:70,
  categories:[{id:'c1',name:'Getting around'}], budgets:{'2026-08':{c1:200}},
  accounts:[{id:'a1',name:'Joint Checking',kind:'checking',balance:2000,updated:'2026-08-01'}],
  transactions:[{id:'i',type:'income',amount:3000,date:'2026-08-01'},
                {id:'e1',type:'expense',amount:59.25,date:'2026-08-27',catId:'c1',
                 note:'OH BUREAU MOTOR VEHIC',acctId:'a1'}]});
await p.reload(); await p.waitForTimeout(600);

/* The same four records, with the dollar sign eaten on three of them - one
   dropped entirely, one read as an em dash, one as a bare decimal. */
const OCR_TEXT=[
 'Pending',
 'Preauthorization / AI=867560,RR=623952','602847,PK=356239682557559 PMT*OH',
 'BUREAU MOTOR VEHIC Held:2026-08-27','14:57:35 EDT Exp:2026-08-30 14:57:35 EDT',
 'Aug 27, 2026','-$59.25',
 'Preauthorization / AI=843880,RR=62','3913595672,PK=466239664376271',
 'MAHONINGCTYTITLE Held:2026-08-27','14:27:17 EDT Exp:2026-08-30 14:27:17 EDT',
 'Aug 27, 2026','-21.49',
 'Preauthorization / AI=157390,RR=62380','7855866,PK=466238683828615 Kindle',
 'Unltd Held:2026-08-26 14:59:42 EDT','Exp:2026-08-29 14:59:42 EDT',
 'Aug 26, 2026','—12.89',
 'Preauthorization / AI=107440,RR=623818','890417,PK=356238640867014 AIRBNB *',
 'HMREJET25N Held:2026-08-26 13:48:06','EDT Exp:2026-08-29 13:48:06 EDT',
 'Aug 26, 2026','-329.00'].join('\n');

const ocr = await p.evaluate(t=>({
  rows:qlParseOcr(t),
  notepad:qlParseOcr('coffee 4.50\ngas 38\nlunch with sam 12.75'),
  notepadDollars:qlParseOcr('coffee $4.50\ngas $38'),
  unreadable:qlParseOcr('Preauthorization / AI=99,RR=88 SOME MERCHANT Held:2026-08-01'),
  clean:qlParseOcr('Preauthorization / AI=1,RR=2 PMT*SHELL OIL Held:2026-08-01\nAug 1, 2026\n-$40.00')
}), OCR_TEXT);

check('a bank read survives OCR eating three of the four dollar signs',
      ocr.rows.length===4, String(ocr.rows.length));
check('...with every amount right',
      JSON.stringify(ocr.rows.map(r=>r.amt))==='[59.25,21.49,12.89,329]',
      JSON.stringify(ocr.rows.map(r=>r.amt)));
check('...and every name right',
      JSON.stringify(ocr.rows.map(r=>r.what))
        ==='["OH BUREAU MOTOR VEHIC","MAHONINGCTYTITLE","Kindle Unltd","AIRBNB"]',
      JSON.stringify(ocr.rows.map(r=>r.what)));
check('...and still no reference number read as a price',
      !ocr.rows.some(r=>r.amt>100000 || [2026,62,623952,867560].includes(r.amt)));
check('a clean single record is unaffected',
      ocr.clean.length===1 && ocr.clean[0].amt===40 && ocr.clean[0].what==='SHELL OIL',
      JSON.stringify(ocr.clean));
check('a handwritten notepad still reads every line, decimals or not',
      ocr.notepad.length===3 && ocr.notepad[1].what==='gas' && ocr.notepad[1].amt===38,
      JSON.stringify(ocr.notepad));
check('...and one written with dollar signs reads correctly too',
      ocr.notepadDollars.length===2 && ocr.notepadDollars[0].what==='coffee'
        && ocr.notepadDollars[1].amt===38, JSON.stringify(ocr.notepadDollars));
check('a statement with no readable amount reports nothing rather than guessing',
      ocr.unreadable.length===0, JSON.stringify(ocr.unreadable));

/* The save step, which the first instinct blamed and which was innocent. */
const saveAll = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(260);
  document.getElementById('quickLogBtn').click(); await w(280);
  const items=[['OH BUREAU MOTOR VEHIC',59.25],['MAHONINGCTYTITLE',21.49],
               ['Kindle Unltd',12.89],['AIRBNB',329]];
  for(let i=1;i<items.length;i++) document.getElementById('qlAdd').click();
  [...document.querySelectorAll('.ql-row')].forEach((el,i)=>{
    el.querySelector('.ql-what').value=items[i][0];
    el.querySelector('.ql-amt').value=String(items[i][1]); });
  const before=state.transactions.length;
  document.getElementById('qlSave').click(); await w(420);
  return {added:state.transactions.length-before};
});
check('four rows in the quick log log four entries, not one',
      saveAll.added===4, String(saveAll.added));

/* The delete, armed like the other two before it. */
const txDel = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  activateTab('tx'); openTxSheet('e1'); await w(320);
  o.startsAsButton=!!document.querySelector('[data-txdel="e1"]') && !document.querySelector('.cs-arm');
  const n0=state.transactions.length;
  document.querySelector('[data-txdel="e1"]').click(); await w(260);
  o.armedNotFired=state.transactions.length===n0 && !!document.querySelector('.cs-arm');
  o.question=document.querySelector('.cs-arm').innerText;
  document.querySelector('[data-txdelno]').click(); await w(220);
  o.keptIt=state.transactions.length===n0 && !document.querySelector('.cs-arm');
  document.querySelector('[data-txdel="e1"]').click(); await w(200);
  closeTxSheet(); openTxSheet('e1'); await w(300);
  o.reopenNotArmed=!document.querySelector('.cs-arm') && txDelArm===null;
  document.querySelector('[data-txdel="e1"]').click(); await w(220);
  document.querySelector('[data-txdelyes="e1"]').click(); await w(400);
  o.gone=!state.transactions.some(t=>t.id==='e1');
  o.sheetClosed=!document.getElementById('txSheet').classList.contains('on');
  return o;
});
check('deleting an entry starts as a button, not a question',
      txDel.startsAsButton===true);
check('...and one tap arms it rather than deleting anything',
      txDel.armedNotFired===true);
check('...with the question naming the amount and what it was',
      /\$59\.25/.test(txDel.question) && /Getting around/.test(txDel.question),
      txDel.question.replace(/\n/g,' | '));
check('...and what the plan gets back if it goes',
      /gets the \$59\.25 back/.test(txDel.question), txDel.question.replace(/\n/g,' | '));
check('"Keep it" changes nothing', txDel.keptIt===true);
check('an armed entry delete never survives leaving the sheet',
      txDel.reopenNotArmed===true);
check('confirming deletes it, and the sheet it emptied closes itself',
      txDel.gone===true && txDel.sheetClosed===true);

/* ---- 85. an amount it could not name is still an amount ----
   "It's the only logged one entry" - sent again, with the reader now saying
   "Read 1 line" for a screenshot holding four.

   The previous fix was right and insufficient. I could not reproduce the OCR
   here (no engine in this environment, the CDN blocked) so rather than guess at
   Tesseract's output I went looking for what my own code does badly whatever it
   is handed - and found it: an amount whose DESCRIPTION did not survive was
   dropped on the floor, silently, by `if(desc.length<2) continue`.

   That is exactly the shape of the report. A bank screen is two columns, and a
   page-segmenter that reads the left column then the right one hands back every
   description in a block followed by every amount in a block. Only the first
   amount has any text in front of it. One row named, three dropped without a
   word - "Read 1 line", and the one that landed looks perfect.

   The amount is the part OCR gets right and the part that is tedious to retype.
   The name is on the photo two inches away. So the row is kept, blank and
   flagged, the note counts both, and the raw text is one tap away when it goes
   wrong. A silent drop is worse than a visible gap: a person can fix a gap. */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08',
  categories:[{id:'c1',name:'Getting around'}], budgets:{'2026-08':{c1:200}},
  accounts:[{id:'a1',name:'Joint Checking',kind:'checking',balance:2000,updated:'2026-08-01'}]});
await p.reload(); await p.waitForTimeout(600);

const COLUMN_OCR=[
 'Pending',
 'Preauthorization / AI=867560,RR=623952602847,PK=356239682557559 PMT*OH BUREAU MOTOR VEHIC Held:2026-08-27 14:57:35 EDT',
 'Aug 27, 2026',
 'Preauthorization / AI=843880,RR=623913595672,PK=466239664376271 MAHONINGCTYTITLE Held:2026-08-27 14:27:17 EDT',
 'Aug 27, 2026',
 'Preauthorization / AI=157390,RR=623807855866,PK=466238683828615 Kindle Unltd Held:2026-08-26 14:59:42 EDT',
 'Aug 26, 2026',
 '-$59.25','-$21.49','-$12.89'].join('\n');

const split = await p.evaluate(t=>({
  cols:qlParseOcr(t),
  clean:qlParseOcr('Preauthorization / AI=1,RR=2 PMT*SHELL OIL Held:2026-08-01\nAug 1, 2026\n-$40.00\n'
                  +'Preauthorization / AI=3,RR=4 KROGER Held:2026-08-02\nAug 2, 2026\n-$62.10'),
  notepad:qlParseOcr('coffee 4.50\ngas 38')
}), COLUMN_OCR);

check('when OCR splits the columns, every amount still survives',
      split.cols.length===3, String(split.cols.length));
check('...with the amounts intact',
      JSON.stringify(split.cols.map(x=>x.amt))==='[59.25,21.49,12.89]',
      JSON.stringify(split.cols.map(x=>x.amt)));
check('...and the ones it could not name are flagged rather than dropped',
      split.cols.filter(x=>x.unnamed).length===2,
      JSON.stringify(split.cols.map(x=>!!x.unnamed)));
check('...while the one it could name keeps its name',
      !split.cols[0].unnamed && split.cols[0].what==='OH BUREAU MOTOR VEHIC',
      JSON.stringify(split.cols[0]));
check('a well-read statement still comes back fully named, nothing flagged',
      split.clean.length===2 && !split.clean.some(x=>x.unnamed)
        && split.clean[0].what==='SHELL OIL' && split.clean[1].what==='KROGER',
      JSON.stringify(split.clean));
check('and the notepad path is untouched by any of it',
      split.notepad.length===2 && !split.notepad.some(x=>x.unnamed),
      JSON.stringify(split.notepad));

/* On screen: the rows land, the blank ones are marked, and they say what to do. */
const blankUI = await p.evaluate(async (t) => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(260);
  document.getElementById('quickLogBtn').click(); await w(300);
  const items=qlParseOcr(t);
  const box=document.getElementById('quickLog'), listEl=document.getElementById('qlList');
  items.forEach(it=>{
    let row=[...box.querySelectorAll('.ql-row')].find(el=>!el.querySelector('.ql-what').value && !el.querySelector('.ql-amt').value);
    if(!row){ const wrap=document.createElement('div'); wrap.innerHTML=qlRow(); row=wrap.firstElementChild; listEl.appendChild(row); }
    row.querySelector('.ql-what').value=it.what; row.querySelector('.ql-amt').value=it.amt;
    if(it.unnamed){ row.classList.add('ql-unnamed'); row.querySelector('.ql-what').placeholder='Name this one from the photo'; }
  });
  await w(160);
  return { withAmounts:[...document.querySelectorAll('.ql-row')].filter(el=>el.querySelector('.ql-amt').value).length,
           flagged:document.querySelectorAll('.ql-row.ql-unnamed').length,
           placeholder:(document.querySelector('.ql-unnamed .ql-what')||{}).placeholder||'' };
}, COLUMN_OCR);
check('three rows land, every one carrying its amount',
      blankUI.withAmounts===3, String(blankUI.withAmounts));
check('...two of them marked as waiting on a name',
      blankUI.flagged===2, String(blankUI.flagged));
check('...and saying, on the row, what to do about it',
      /Name this one from the photo/.test(blankUI.placeholder), blankUI.placeholder);

/* ---- 86. saying less at a glance ----
   "The entire thing is a bit unorganized. Everything just feels like a big
   run-on sentence. The site lacks a distinguisher of what is what when looking
   at it at a glance, and so much data gets lost when trying to browse quickly."

   Measured before arguing: 82 intro paragraphs, 28 of them over 200 characters,
   every one rendered at the same size, weight and colour as the next. One of
   the worst was 489 characters and had been added two days earlier. Each was
   written to earn its place at the time; nobody was reading them as a set.

   Two changes, and neither deletes a word.

   1. A HEADING YOU CAN FIND. A short accent rule above every panel title and
      accordion heading, dimmed and shortened on a closed one, so an open
      section reads as a place you are in and a closed one as a door.
   2. PROSE IS CLAMPED, NOT CUT. Long intros show two lines and a "More".
      Clamped, deliberately, rather than collapsed into a <details>: clipped
      text is still rendered, so innerText still returns it, a screen reader
      still reads it and find-in-page still finds it. A <details> would have
      hidden it from all three - and from most of this suite, which reads copy
      through innerText. The visual saving is identical; only the honesty
      differs.

   Which paragraphs get a "More" is MEASURED at the width being read, not
   guessed from a character count, because a sentence that overflows at 320px
   fits at 900 and a control that reveals nothing is worse than no control. */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08', hourlyWage:30,
  categories:[{id:'c1',name:'Food'}], budgets:{'2026-08':{c1:400}},
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:2000,updated:'2026-08-01'}],
  transactions:[{id:'i',type:'income',amount:3000,date:'2026-08-01'},
                {id:'e',type:'expense',amount:120,date:'2026-08-05',catId:'c1'}]});
await p.reload(); await p.waitForTimeout(800);

const brief = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const look=async v=>{ activateTab(v); await w(600);
    const root=document.getElementById('view-'+v);
    const subs=[...root.querySelectorAll('.panel .sub, .acc-body .sub')];
    return { clamped:subs.filter(x=>x.classList.contains('clampable')).length,
             mores:root.querySelectorAll('.sub-more').length,
             /* a clamped paragraph is TWO lines, not eight */
             tallest:Math.max(0,...subs.filter(x=>x.classList.contains('clampable'))
                                       .map(x=>Math.round(x.getBoundingClientRect().height))),
             /* and every word of it is still there to be read */
             wordsKept:subs.filter(x=>x.classList.contains('clampable'))
                           .every(x=>x.innerText.trim().length>80),
             pointless:subs.filter(x=>x.dataset.noclamp==='1')
                           .some(x=>x.nextElementSibling&&x.nextElementSibling.classList.contains('sub-more')) };
  };
  return { tx:await look('tx'), goals:await look('goals') };
});
check('long intros are clamped on Track and on Build',
      brief.tx.clamped>0 && brief.goals.clamped>0, JSON.stringify(brief));
check('...each clamped one getting exactly one More',
      brief.tx.mores===brief.tx.clamped && brief.goals.mores===brief.goals.clamped,
      JSON.stringify(brief));
check('...clipped to two lines rather than eight',
      brief.tx.tallest>0 && brief.tx.tallest<=46 && brief.goals.tallest<=46,
      `${brief.tx.tallest} / ${brief.goals.tallest}`);
check('...with every word still in the text, because it is clipped and not hidden',
      brief.tx.wordsKept===true && brief.goals.wordsKept===true);
check('...and an intro short enough to fit never grows a More that reveals nothing',
      brief.tx.pointless===false && brief.goals.pointless===false);

const sayTog = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(500);
  const btn=document.querySelector('#view-tx .sub-more'); if(!btn) return null;
  const el=btn.previousElementSibling;
  const shut=Math.round(el.getBoundingClientRect().height);
  btn.click(); await w(140);
  const open=Math.round(el.getBoundingClientRect().height);
  const label=btn.textContent, aria=btn.getAttribute('aria-expanded');
  btn.click(); await w(140);
  return {shut, open, label, aria, back:Math.round(el.getBoundingClientRect().height), backLabel:btn.textContent};
});
check('More opens that one paragraph and says Less',
      sayTog && sayTog.open>sayTog.shut && sayTog.label==='Less' && sayTog.aria==='true',
      JSON.stringify(sayTog));
check('...and closes it again', sayTog.back===sayTog.shut && sayTog.backLabel==='More');

const rules = await p.evaluate(() => {
  const h=document.querySelector('#view-tx .panel>h2');
  const openAcc=[...document.querySelectorAll('#view-goals details.acc')].find(d=>d.open);
  const shutAcc=[...document.querySelectorAll('#view-goals details.acc')].find(d=>!d.open);
  const bar=el=>{ if(!el) return null; const cs=getComputedStyle(el,'::before');
    return {w:parseFloat(cs.width)||0, h:parseFloat(cs.height)||0, o:parseFloat(cs.opacity)}; };
  return { panel:bar(h),
           open:bar(openAcc&&openAcc.querySelector('.acc-hd')),
           shut:bar(shutAcc&&shutAcc.querySelector('.acc-hd')) };
});
check('a panel heading carries an accent rule, so one section ends visibly',
      rules.panel && rules.panel.w>=20 && rules.panel.h>=2, JSON.stringify(rules.panel));
check('...an accordion heading carries one too',
      rules.open && rules.open.w>=20, JSON.stringify(rules.open));
check('...and a closed one is dimmer and shorter, so open reads as a place you are in',
      rules.shut && rules.shut.w<rules.open.w && rules.shut.o<rules.open.o,
      JSON.stringify({open:rules.open, shut:rules.shut}));

const modes = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('settings'); await w(450);
  document.querySelector('#sayMode button[data-say="full"]').click(); await w(300);
  activateTab('goals'); await w(600);
  const full={clamped:document.querySelectorAll('#view-goals .sub.clampable').length,
              body:document.body.classList.contains('say-brief'), stored:state.sayMode};
  activateTab('settings'); await w(400);
  document.querySelector('#sayMode button[data-say="brief"]').click(); await w(300);
  activateTab('goals'); await w(600);
  return {full, backClamped:document.querySelectorAll('#view-goals .sub.clampable').length,
          fresh:normalizeState({}).sayMode};
});
check('Full gives every word back, everywhere, and remembers it',
      modes.full.clamped===0 && modes.full.body===false && modes.full.stored==='full',
      JSON.stringify(modes.full));
check('...and switching back to Brief clamps again',
      modes.backClamped>0, String(modes.backClamped));
check('Brief is what someone new gets', modes.fresh==='brief', modes.fresh);

/* ---- 87. a figure that will not show its working ----
   "How did this figure come about? There's no explanation or flip card. It's
   not teaching you anything about money, it's just stating facts without any
   data." Sent with "Logged net (all time)" circled.

   Half of that was already built and unreachable. The explanation existed - and
   was wired to the trend chart's legend, four screens away, rather than to the
   tile where the question actually gets asked. Every other figure in that strip
   that needed one had a "?"; this one, the least self-evident of them, had none.

   The other half was fair. The card explained what the number was NOT - not net
   worth, not the bank - and never once showed the sum that produces it. A
   figure that will not show its arithmetic is asking to be trusted, which is
   the one thing this app refuses to ask for anywhere else.

   Fixtures picked so the sum is checkable by hand: 6,000 in, 1,300 out, 400 put
   away, one move. 6,000 - 1,300 - 400 = 4,300, and the move counts for nothing. */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08', hourlyWage:30,
  categories:[{id:'c1',name:'Food'}], budgets:{'2026-08':{c1:400}},
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:5000,updated:'2026-08-01'},
            {id:'a2',name:'Savings',kind:'savings',balance:1000,updated:'2026-08-01'}],
  transactions:[
    {id:'i1',type:'income',amount:4000,date:'2026-07-01',source:'Pay',acctId:'a1'},
    {id:'i2',type:'income',amount:2000,date:'2026-08-01',source:'Pay',acctId:'a1'},
    {id:'e1',type:'expense',amount:800,date:'2026-07-05',catId:'c1',acctId:'a1'},
    {id:'e2',type:'expense',amount:500,date:'2026-08-05',catId:'c1',acctId:'a1'},
    {id:'v1',type:'invest',amount:400,date:'2026-08-06',source:'Fund',acctId:'a1'},
    {id:'m1',type:'transfer',amount:250,date:'2026-08-07',acctId:'a1',destAcctId:'a2'}]});
await p.reload(); await p.waitForTimeout(700);

const workings = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(600);
  const tiles=[...document.querySelectorAll('#txSummary .stat')].map(t=>({
    k:t.querySelector('.k').textContent.replace('?','').trim(),
    v:t.querySelector('.v').textContent, why:!!t.querySelector('[data-why]')}));
  const btn=document.querySelector('#txSummary [data-why="loggedNet"]');
  if(!btn) return {tiles, opened:false};
  const stripBefore=Math.round(document.getElementById('txSummary').getBoundingClientRect().height);
  btn.click(); await w(280);
  const note=document.querySelector('.why-note[data-forwhy="loggedNet"]');
  const o={ tiles, opened:!!note, inTile:!!(note&&note.closest('.stat')),
    stripBefore, stripAfter:Math.round(document.getElementById('txSummary').getBoundingClientRect().height),
    rows:[...document.querySelectorAll('.why-note .wk-r')].map(x=>x.innerText.replace(/\n/g,' | ')),
    txt:note?note.innerText:'' };
  btn.click(); await w(220);
  o.closes=!document.querySelector('.why-note[data-forwhy="loggedNet"]');
  return o;
});
check('the all-time figure carries a ? where the question gets asked',
      workings.tiles.some(t=>/Logged net/.test(t.k) && t.why),
      JSON.stringify(workings.tiles));
check('...opening below the strip rather than inside one cell of the grid',
      workings.opened===true && workings.inTile===false);
check('...without shoving the tiles it sits under out of shape',
      workings.stripBefore===workings.stripAfter,
      `${workings.stripBefore} -> ${workings.stripAfter}`);
check('the working is a sum, line by line, with the entry counts behind each',
      workings.rows.length===4
        && /Logged coming in \| 2 entries \| \+\$6,000/.test(workings.rows[0])
        && /Logged going out \| 2 entries \| −\$1,300/.test(workings.rows[1])
        && /Logged put away \| 1 entry \| −\$400/.test(workings.rows[2]),
      JSON.stringify(workings.rows));
check('...ending on the figure that is actually on the tile',
      /Which leaves \| 6 in total \| \$4,300/.test(workings.rows[3])
        && workings.tiles.some(t=>/Logged net/.test(t.k) && /\$4,300/.test(t.v)),
      workings.rows[3]);
check('...over the window the sum actually covers',
      /2026-07-01 to 2026-08-07/.test(workings.txt), workings.txt.slice(0,160));
check('...saying why a move counts for nothing in it',
      /1 move/.test(workings.txt) && /not earned and not spent/.test(workings.txt));
check('it teaches what the figure is FOR, not only what it is not',
      /What it is good for/.test(workings.txt) && /logged twice/.test(workings.txt),
      workings.txt.slice(0,400));
check('...while still separating it from net worth and from the bank',
      /What it is not/.test(workings.txt) && /net worth/.test(workings.txt)
        && /bank balance/.test(workings.txt));
check('tapping the ? again puts it away', workings.closes===true);

/* ---- 88. the thing you just logged is the thing you are checking ----
   "Why did Fees go 5th in the list if it was the most recent entry?"

   Because the sort only ever compared dates:

     list.sort((a,b)=> (a.date<b.date?1:a.date>b.date?-1:0));

   Array.sort is stable, so five entries sharing a date kept their position in
   state.transactions - the order they were TYPED, oldest first. Log five things
   today and the one you just added sits at the bottom of the five, which is the
   opposite of what a ledger is for: you open it to check the last thing you did.

   A transaction carries a date and no time, so there is no clock to sort by. Its
   position in the array is the record of when it was entered, and reading that
   backwards is the honest answer. The fixture is the user's own screen. */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08',
  categories:[{id:'c1',name:'Getting Around'},{id:'c2',name:'Fees'},{id:'c3',name:'Power & Wi-Fi'}],
  budgets:{'2026-08':{c1:300,c2:100,c3:200}},
  transactions:[
    {id:'t1',type:'expense',amount:329,date:'2026-08-28',catId:'c1',note:'Sugarcreek'},
    {id:'t2',type:'expense',amount:59.25,date:'2026-08-28',catId:'c1',note:'OH BUREAU MOTOR VEHIC'},
    {id:'t3',type:'expense',amount:12.89,date:'2026-08-28',catId:'c1',note:'Kindle Unltd'},
    {id:'t4',type:'expense',amount:52.77,date:'2026-08-28',catId:'c1'},
    {id:'t5',type:'expense',amount:21.49,date:'2026-08-28',catId:'c2'},
    {id:'t6',type:'expense',amount:60.70,date:'2026-08-27',catId:'c3'},
    {id:'t7',type:'expense',amount:44.16,date:'2026-08-26',catId:'c1',note:'Franks'}]});
await p.reload(); await p.waitForTimeout(700);
const ledOrder = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(500);
  const first=[...document.querySelectorAll('#txList .tx')].map(x=>x.dataset.txsheet);
  /* and one logged right now has to land at the top of its day */
  document.getElementById('txAmt').value='9.99';
  document.getElementById('txDate').value='2026-08-28';
  document.getElementById('txCat').value='c2';
  document.getElementById('txNote').value='Brand new';
  document.getElementById('addTx').click(); await w(500);
  const top=document.querySelector('#txList .tx');
  return {first, topAfter:top?top.innerText.replace(/\n/g,' '):''};
});
check('the newest entry of the day leads the ledger, rather than trailing it',
      ledOrder.first[0]==='t5', JSON.stringify(ledOrder.first));
check('...with the rest of that day behind it, newest to oldest',
      JSON.stringify(ledOrder.first.slice(0,5))==='["t5","t4","t3","t2","t1"]',
      JSON.stringify(ledOrder.first));
check('...and older days still below it, which the date sort always got right',
      ledOrder.first[5]==='t6' && ledOrder.first[6]==='t7',
      JSON.stringify(ledOrder.first));
check('an entry logged this second appears at the top of its day',
      /Brand new/.test(ledOrder.topAfter), ledOrder.topAfter);

/* The photo path was named for one kind of paper and takes several. */
const photoCopy = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(320);
  if(!document.querySelector('#quickLog .ql-panel')) document.getElementById('quickLogBtn').click();
  await w(360);
  return { label:(document.getElementById('qlSnap')||{}).textContent||'' };
});
check('the camera is not named for one kind of paper',
      /photo/i.test(photoCopy.label) && !/notepad/i.test(photoCopy.label), photoCopy.label);

/* ---- 89. an account you can rename, reorder, and a debt you cannot lose ----
   Three asks off one screen: "editor for these accounts, changing the names or
   the type of account? reorder ability?" and "debt payoff tracker is too
   destructive."

   Everything about an account except its balance was write-once. A typo in a
   name, or picking Other when you meant Savings, could only be fixed by
   deleting the account - which takes its whole reading history and orphans
   every entry filed against it. A rename should not cost you a year of
   readings.

   Reorder is the same engine the plan and the recurring list already use, as a
   third scope rather than a third copy. The property that matters: only the
   DISPLAY is ordered. Every total sums the array as it stands, so dragging one
   account above another cannot move a single figure.

   And the debt delete is the fourth surface to get the too-destructive report,
   after the recurring list, the category sheet and the entry sheet. Same
   answer. The question names the balance and the rate, and says the thing a
   person actually needs to hear: removing it from the planner does not pay
   anything off. */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08',
  categories:[{id:'c1',name:'Food'}], budgets:{'2026-08':{c1:400}},
  accounts:[{id:'a1',name:'Joint Checking',kind:'checking',balance:2000,updated:'2026-08-01',
             hist:[{d:'2026-07-01',b:1500,how:'first'},{d:'2026-08-01',b:2000,how:'bank'}]},
            {id:'a2',name:'Stash',kind:'invest',balance:18000,updated:'2026-08-01'},
            {id:'a3',name:'Coinbase',kind:'other',balance:14782.70,updated:'2026-08-01'},
            {id:'a4',name:'Everyday Checking',kind:'checking',balance:640,updated:'2026-08-01'}],
  transactions:[{id:'t1',type:'expense',amount:50,date:'2026-08-05',catId:'c1',acctId:'a3'}],
  debts:[{id:'d1',name:'Visa',balance:2400,apr:23.9,minPayment:75},
         {id:'d2',name:'Car loan',balance:9000,apr:6.4,minPayment:220}],
  debtBudget:500});
await p.reload(); await p.waitForTimeout(700);

const acctEd = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('goals'); renderAccounts(); await w(420);
  const o={};
  o.hasPencil=!!document.querySelector('[data-acctedit="a3"]');
  document.querySelector('[data-acctedit="a3"]').click(); await w(320);
  o.prefilled=(document.getElementById('aeName')||{}).value;
  o.cardFieldsHidden=document.getElementById('aeLimWrap').classList.contains('hide');
  document.getElementById('aeKind').value='credit';
  document.getElementById('aeKind').dispatchEvent(new Event('change',{bubbles:true})); await w(220);
  o.cardFieldsShown=!document.getElementById('aeLimWrap').classList.contains('hide');
  o.earmarkDropped=document.getElementById('aePurpWrap').classList.contains('hide');
  document.getElementById('aeName').value='Rewards Card';
  document.getElementById('aeLim').value='13700';
  document.getElementById('aeApr').value='13';
  const nwBefore=netWorth();
  document.querySelector('[data-acctsave="a3"]').click(); await w(420);
  const a=state.accounts.find(x=>x.id==='a3');
  o.name=a.name; o.kind=a.kind; o.limit=a.limit; o.apr=a.apr; o.balance=a.balance;
  o.nwMoved=Math.round((netWorth()-nwBefore)*100)/100;
  o.txKept=state.transactions.filter(t=>t.acctId==='a3').length;
  /* a rename must never cost the readings */
  document.querySelector('[data-acctedit="a1"]').click(); await w(300);
  document.getElementById('aeName').value='Main Checking';
  document.querySelector('[data-acctsave="a1"]').click(); await w(380);
  const chk=state.accounts.find(x=>x.id==='a1');
  o.renamed=chk.name; o.readingsKept=(chk.hist||[]).length;
  return o;
});
check('every account row offers an editor, prefilled with what it is called now',
      acctEd.hasPencil===true && acctEd.prefilled==='Coinbase', acctEd.prefilled);
check('...showing the card fields only once a card is picked, without saving first',
      acctEd.cardFieldsHidden===true && acctEd.cardFieldsShown===true);
check('...and dropping the earmark question, which owed money cannot answer',
      acctEd.earmarkDropped===true);
check('the new name, kind, limit and rate all stick',
      acctEd.name==='Rewards Card' && acctEd.kind==='credit'
        && acctEd.limit===13700 && acctEd.apr===13, JSON.stringify(acctEd));
check('turning an account into a card turns the stored balance over with it',
      acctEd.balance===-14782.7, String(acctEd.balance));
check('...so net worth moves by twice the balance, which is what changing sides means',
      Math.abs(acctEd.nwMoved-(-29565.4))<0.02, String(acctEd.nwMoved));
check('...while everything logged against it stays put', acctEd.txKept===1);
check('a rename never costs the reading history',
      acctEd.renamed==='Main Checking' && acctEd.readingsKept===2, JSON.stringify(acctEd));

const acctRo = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  o.hasBtn=!!document.getElementById('acctReorderBtn');
  o.before=[...document.querySelectorAll('#acctList [data-row]')].map(x=>x.dataset.row);
  const bankBefore=bankTotal(), nwBefore=netWorth();
  document.getElementById('acctReorderBtn').click(); await w(360);
  o.grips=document.querySelectorAll('#acctList [data-grip][data-scope="accts"]').length;
  /* a4 shares the spending group with a1, because a move is now confined to
     its own group - an account alone under its header has nowhere to go */
  moveAcct('a4',-1); renderAccounts(); await w(320);
  o.after=[...document.querySelectorAll('#acctList [data-row]')].map(x=>x.dataset.row);
  o.totalsUnmoved=bankTotal()===bankBefore && netWorth()===nwBefore;
  document.getElementById('acctReorderBtn').click(); await w(280);
  o.gripsGone=document.querySelectorAll('#acctList [data-grip]').length===0;
  o.kept=[...document.querySelectorAll('#acctList [data-row]')].map(x=>x.dataset.row);
  return o;
});
check('the accounts list reorders by the same gesture the other two lists use',
      acctRo.hasBtn===true && acctRo.grips===4, JSON.stringify({b:acctRo.hasBtn,g:acctRo.grips}));
/* Grouped by kind, chosen over a flat order - and the two turned out not to be
   exclusive. The headers partition the list; a drag stays inside its own group
   the same way a subcategory stays inside its parent. */
const acctGrp = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('goals'); renderAccounts(); await w(420);
  const groups=[...document.querySelectorAll('#acctList .acg')].map(el=>({
    name:el.querySelector('.acg-n').textContent,
    total:el.querySelector('.acg-v').textContent,
    sub:el.querySelector('.acg-s').textContent,
    lvls:[...new Set([...el.querySelectorAll('[data-row]')].map(r=>r.dataset.lvl))] }));
  return {groups, rows:document.querySelectorAll('#acctList [data-row]').length,
          cardSibs:dragSiblings('owe','accts').length,
          investSibs:dragSiblings('grow','accts').length};
});
check('the accounts list is grouped, one header per kind that holds something',
      acctGrp.groups.length>=2, JSON.stringify(acctGrp.groups.map(x=>x.name)));
check('...spendable first, owed last',
      acctGrp.groups[0].name==='Spending money'
        && acctGrp.groups[acctGrp.groups.length-1].name!=='Spending money',
      JSON.stringify(acctGrp.groups.map(x=>x.name)));
check('...with no account lost to a group', acctGrp.rows===4, String(acctGrp.rows));
check('...each header carrying its own total and its count',
      acctGrp.groups.every(g=>/^\$/.test(g.total) && /account/.test(g.sub)),
      JSON.stringify(acctGrp.groups.map(g=>g.name+'='+g.total)));
check('...and every row tagged with its group, so a drag knows its siblings',
      acctGrp.groups.every(g=>g.lvls.length===1), JSON.stringify(acctGrp.groups.map(g=>g.lvls)));
check('...moving one actually moves it',
      JSON.stringify(acctRo.after)!==JSON.stringify(acctRo.before),
      JSON.stringify(acctRo.before)+' -> '+JSON.stringify(acctRo.after));
check('...and not one total on the page moves, because only the display is ordered',
      acctRo.totalsUnmoved===true);
check('...and leaving the mode puts the grips away and keeps the order',
      acctRo.gripsGone===true && JSON.stringify(acctRo.kept)===JSON.stringify(acctRo.after));
await p.reload(); await p.waitForTimeout(800);
const acctRoKept = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('goals'); await w(420);
  return [...document.querySelectorAll('#acctList [data-row]')].map(x=>x.dataset.row);
});
check('...and the order is still there after a reload',
      JSON.stringify(acctRoKept)===JSON.stringify(acctRo.after), JSON.stringify(acctRoKept));
/* Adding the pencil cost the name its width: at 320px the body measured 17px
   and "Joint Checking" came out one letter per line. The row wraps now, and the
   kind left the row entirely because the group header above says it. */
for(const W of [320,390]){
  await p.setViewportSize({width:W,height:1000});
  await p.waitForTimeout(340);
  const m = await p.evaluate(async () => {
    const w=ms=>new Promise(r=>setTimeout(r,ms));
    activateTab('goals'); renderAccounts(); await w(320);
    return [...document.querySelectorAll('.acct-row')].map(r=>({
      body:Math.round(r.querySelector('.ac-b').getBoundingClientRect().width),
      nameH:Math.round(r.querySelector('.ac-n').getBoundingClientRect().height) }));
  });
  check('at '+W+'px an account name has real width to sit in',
        m.length>0 && m.every(x=>x.body>=140), JSON.stringify(m));
  check('...and no name is shredded down the page at '+W+'px',
        m.every(x=>x.nameH<=64), JSON.stringify(m));
}
await p.setViewportSize({width:390,height:1000}); await p.waitForTimeout(300);

const debtDel = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); await w(520);
  const o={}, n0=state.debts.length;
  o.startsAsButton=!!document.querySelector('[data-deldebt="d1"]') && !document.querySelector('.debtrow.confirming');
  document.querySelector('[data-deldebt="d1"]').click(); await w(320);
  o.armedNotFired=state.debts.length===n0 && !!document.querySelector('.debtrow.confirming');
  o.question=document.querySelector('.debtrow.confirming').innerText;
  document.querySelector('[data-deldebtno]').click(); await w(260);
  o.keptIt=state.debts.length===n0 && !document.querySelector('.debtrow.confirming');
  document.querySelector('[data-deldebt="d1"]').click(); await w(260);
  document.querySelector('[data-deldebtyes="d1"]').click(); await w(380);
  o.gone=!state.debts.some(x=>x.id==='d1');
  o.otherKept=state.debts.some(x=>x.id==='d2');
  return o;
});
check('the debt delete starts as a button, not a question',
      debtDel.startsAsButton===true);
check('...and one tap arms it rather than removing anything',
      debtDel.armedNotFired===true);
check('...with the question naming the balance and the rate that leave the plan',
      /\$2,400/.test(debtDel.question) && /23\.9%/.test(debtDel.question),
      debtDel.question.replace(/\n/g,' | '));
check('...and saying plainly that removing it pays nothing off',
      /does not pay anything off/.test(debtDel.question));
check('"Keep it" changes nothing', debtDel.keptIt===true);
check('confirming removes that one and leaves the other alone',
      debtDel.gone===true && debtDel.otherKept===true);

/* ============================================================
   90. THE LIMIT, AND WHAT THE ROOM IS FOR

   "I would like to have my credit limit included with the debt calculator so it
   can start tracking ways to leverage vs dreams and goals." Asked with a HELOC
   at 3.49% on screen and no balance typed - and the planner would not even take
   the row, because it demanded a balance above zero. A line at zero is not an
   empty row; it is the cheapest money this person has and the only debt on the
   list that could fund something tomorrow.

   The properties worth guarding are the ones where a plausible screen would be
   a dishonest one: the rate quoted has to be the rate on the money actually
   drawn (not the cheapest line's, when the cheap line runs out partway), both
   halves of the choice have to be drawn, and a payment under the interest must
   never print a payoff date.
   ============================================================ */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08',
  hourlyWage:30, roomPay:500,
  categories:[{id:'c1',name:'Food'}], budgets:{'2026-08':{c1:400}},
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:4000,updated:'2026-08-01'}],
  goals:[{id:'g1',name:'Kitchen',target:12000,saved:2000,date:'',goalType:'foundation'}],
  debts:[{id:'d1',name:'Home equity',balance:0,apr:3.49,minPayment:0,limit:50000,secured:true}],
  debtBudget:0});
await p.reload(); await p.waitForTimeout(700);

const room = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); renderDebt(); await w(520);
  const o={};
  o.rowRoom=/left to draw/.test(document.getElementById('debtList').innerText);
  o.limitField=!!document.querySelector('#debtList input[data-debt="d1"][data-k="limit"]');
  o.securedAsk=!!document.querySelector('#debtList select[data-debtsec="d1"]');
  o.panelOpen=!document.getElementById('roomPanel').classList.contains('panel-waiting');
  o.text=document.getElementById('roomResults').innerText;
  /* the arithmetic, checkable by hand: $10,000 at $500 a month is 20 months of
     saving, and borrowing it costs whatever the extra months come to */
  o.m=borrowOrWait(10000, 3.49, 500);
  o.never=borrowOrWait(20000, 24, 100);
  /* and the blend, which is the one that would have been quietly wrong */
  state.debts=[{id:'d1',name:'Home equity',balance:0,apr:3.49,minPayment:0,limit:3000,secured:true},
               {id:'d2',name:'Visa',balance:0,apr:23.9,minPayment:0,limit:20000}];
  save();
  o.draw=drawRoom(10000);
  renderRoom(); await w(300);
  o.blendText=document.getElementById('roomResults').innerText;
  /* clearing a limit has to REMOVE it - a stored 0 would leave a car loan
     claiming to be a line with no room */
  state.debts=[{id:'d1',name:'Car loan',balance:9000,apr:6.4,minPayment:220}];
  save(); renderDebt(); await w(360);
  o.plainRow=!document.querySelector('#debtList .dr-room');
  o.gatedAgain=document.getElementById('roomPanel').classList.contains('panel-waiting');
  return o;
});
check('a debt row takes a credit limit, and only a limited row asks what backs it',
      room.limitField===true && room.securedAsk===true);
check('...and says what is left to draw on it', room.rowRoom===true);
check('a line at zero with a limit opens the room panel, where a balance of zero used to be refused',
      room.panelOpen===true, room.text.slice(0,120));
check('the room leads the panel and is immediately called not-money',
      /\$50,000/.test(room.text) && /not money/.test(room.text), room.text.slice(0,200));
check('...with utilisation tracked, which is the half nobody sees until it moves',
      /0% used/.test(room.text) && /total limit/.test(room.text), room.text.slice(0,300));
check('saving $10,000 at $500 a month is 20 months, by hand',
      room.m.waitMonths===20, String(room.m.waitMonths));
check('...borrowing the same thing takes longer, and the interest is those extra months',
      room.m.borrowMonths>room.m.waitMonths
        && Math.abs(room.m.interest-(room.m.borrowMonths*500-10000))<500, JSON.stringify(room.m));
check('both halves of the choice are drawn, never only the tempting one',
      /Wait for it/.test(room.text) && /Borrow it today/.test(room.text), room.text.slice(0,300));
check('...and the interest is named as what it bought, in hours of a life',
      /buys you/.test(room.text) && /hrs/.test(room.text), room.text.slice(0,600));
check('a payment under the interest prints no payoff at all',
      room.never.never===true && room.never.borrowMonths===undefined, JSON.stringify(room.never));
/* The fault this catches: $10,000 funded $3,000 from a 3.49% line and $7,000
   from a 23.9% card, quoted at 3.49%. True of part of the money, presented as
   true of all of it - the exact thing the rate signals exist to refuse. */
check('money is drawn cheapest line first, and the rate quoted is the blend of what was taken',
      room.draw.lines.length===2 && room.draw.lines[0].apr===3.49
        && Math.abs(room.draw.apr-((3000*3.49+7000*23.9)/10000))<0.02, JSON.stringify(room.draw));
check('...so a dream bigger than the cheap line is never priced at the cheap line',
      room.draw.apr>17, String(room.draw.apr));
check('...and the screen names both lines rather than only the flattering one',
      /blended/.test(room.blendText) && /Home equity/.test(room.blendText)
        && /Visa/.test(room.blendText), room.blendText.slice(0,400));
check('a debt with no limit keeps exactly the row it always had',
      room.plainRow===true);
check('...and the panel goes back to waiting, because there is nothing to price',
      room.gatedAgain===true);
/* ---- the same line, on both sides, counted once ----
   "Now add my HELOC limit to the accounts side too." The accounts side already
   held a limit, a rate and a collateral flag - but under the label "Credit card
   / line of credit", with a card-sized placeholder and a summary that called
   everything "the cards". Both halves of that label were correct and neither
   was the word on anybody's paperwork.

   The risk the crossing introduces is double counting, so that is what gets
   asserted hardest. Net worth reads accounts and liabilities and has never read
   state.debts, and the rate layer dedupes by name - so a line living in both
   places has to move net worth exactly once and appear in pricedLines exactly
   once. What it CAN do is drift, and that is named rather than synced away. */
const heloc = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  state.accounts=[{id:'k1',name:'Checking',kind:'checking',balance:4000,updated:'2026-08-01'}];
  state.debts=[{id:'h1',name:'Home equity',balance:2500,apr:3.49,minPayment:50,limit:50000,secured:true}];
  state.goals=[{id:'gg',name:'Kitchen',target:10000,saved:0,date:'',goalType:'foundation'}];
  state.roomPay=500; save();
  activateTab('goals'); await w(360);
  const o={ kinds:[...document.getElementById('acctKind').options].map(x=>x.textContent),
            sec:[...document.getElementById('acctSecured').options].map(x=>x.textContent) };
  activateTab('debt'); renderDebt(); await w(480);
  o.nwBefore=netWorth(); o.roomBefore=roomTotal(); o.linesBefore=roomLines().length;
  o.offered=!!document.getElementById('roomToAccts');
  document.getElementById('roomToAccts').click(); await w(560);
  const a=creditAccts()[0]||{};
  o.made={kind:a.kind, balance:a.balance, limit:a.limit, apr:a.apr, secured:!!a.secured, hist:(a.hist||[]).length};
  o.nwAfter=netWorth(); o.roomAfter=roomTotal(); o.linesAfter=roomLines().length;
  o.pricedHits=pricedLines().filter(l=>/Home equity/.test(l.name)).length;
  o.debtsKept=(state.debts||[]).length;
  o.offerGone=!document.getElementById('roomToAccts');
  o.quietWhenAgreed=!document.querySelector('#roomResults .room-drift');
  creditAccts()[0].balance=-3100; save(); renderRoom(); await w(320);
  o.drift=document.getElementById('roomResults').innerText;
  activateTab('goals'); renderAccounts(); await w(400);
  o.summary=document.getElementById('acctSummary').innerText;
  return o;
});
check('the account kind names a HELOC, not only a card',
      heloc.kinds.some(x=>/HELOC/.test(x)), JSON.stringify(heloc.kinds));
check('...and the collateral question names a home',
      heloc.sec.some(x=>/home/i.test(x)), JSON.stringify(heloc.sec));
check('a limited line in the planner is offered to the accounts side', heloc.offered===true);
check('...and one tap carries the limit, the rate and the collateral across',
      heloc.made.kind==='credit' && heloc.made.limit===50000
        && heloc.made.apr===3.49 && heloc.made.secured===true, JSON.stringify(heloc.made));
check('...flipping what is owed negative, which is how that side stores it',
      heloc.made.balance===-2500 && heloc.made.hist===1, JSON.stringify(heloc.made));
check('net worth moves by what is owed exactly once, never twice',
      Math.abs((heloc.nwAfter-heloc.nwBefore)-(-2500))<0.01,
      JSON.stringify([heloc.nwBefore,heloc.nwAfter]));
check('...and the room is not counted twice either',
      heloc.roomAfter===heloc.roomBefore && heloc.linesAfter===heloc.linesBefore,
      JSON.stringify([heloc.roomBefore,heloc.roomAfter,heloc.linesBefore,heloc.linesAfter]));
check('...with the rate layer still seeing one line', heloc.pricedHits===1, String(heloc.pricedHits));
check('the payoff plan keeps its debt, because that was never the duplicate',
      heloc.debtsKept===1 && heloc.offerGone===true);
check('two sides that agree say nothing at all', heloc.quietWhenAgreed===true);
check('...and two that disagree are named, with both figures and neither overwritten',
      /two different things/.test(heloc.drift) && /\$2,500/.test(heloc.drift)
        && /\$3,100/.test(heloc.drift) && /will not quietly overwrite/.test(heloc.drift),
      heloc.drift.slice(0,300));
check('the accounts summary stops calling a home equity line "the cards"',
      !/On the cards:/.test(heloc.summary) && /Home equity/.test(heloc.summary),
      heloc.summary.slice(0,220));
check('...and says secured room is a different kind of room from a card\'s',
      /behind something you own/.test(heloc.summary), heloc.summary.slice(0,500));

/* The distinction the panel-gate sweep above is now allowed to skip, asserted
   directly instead: this panel does not care how many debts exist, only whether
   any of them can lend anything back. */
const roomGate = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const g=()=>document.getElementById('roomPanel').classList.contains('panel-waiting');
  activateTab('debt');
  /* Room comes from EITHER side, so the accounts have to be cleared too - the
     block above left a credit account behind and this check went green for the
     wrong reason until it did. A gate fed by two sources needs both silenced
     before "no room" means anything. */
  state.accounts=[{id:'k9',name:'Checking',kind:'checking',balance:1200,updated:'2026-08-01'}];
  state.debts=[{id:'x1',name:'Car loan',balance:9000,apr:6.4,minPayment:220},
               {id:'x2',name:'Student loan',balance:14000,apr:5.2,minPayment:180}];
  save(); renderDebt(); applyPanelGates(); await w(340);
  const withDebtsNoRoom=g();
  state.debts=[{id:'x3',name:'Home equity',balance:0,apr:3.49,minPayment:0,limit:40000}];
  save(); renderDebt(); applyPanelGates(); await w(340);
  const oneUntouchedLine=g();
  /* and the other door: a card kept on the accounts side, no debts at all */
  state.debts=[];
  state.accounts=[{id:'k9',name:'Checking',kind:'checking',balance:1200,updated:'2026-08-01'},
                  {id:'k8',name:'Rewards Card',kind:'credit',balance:-200,limit:9000,apr:19.9,updated:'2026-08-01'}];
  save(); renderDebt(); applyPanelGates(); await w(340);
  const fromAccountsOnly=g();
  const note=(document.querySelector('#roomPanel .pw-note')||{}).textContent||'';
  return {withDebtsNoRoom, oneUntouchedLine, fromAccountsOnly, note};
});
check('two loans and no line leave the room panel waiting, however much is owed',
      roomGate.withDebtsNoRoom===true);
check('...while one untouched line and no other debt opens it',
      roomGate.oneUntouchedLine===false);
check('...and a card kept only on the accounts side opens it just the same',
      roomGate.fromAccountsOnly===false);
/* The savings panel's own gate, in both directions: debts alone are not a
   reason to show it, and a dream alone is. */
const saveGate = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const g=()=>document.getElementById('savePanel').classList.contains('panel-waiting');
  activateTab('debt');
  state.goals=[]; state.debts=[{id:'sd',name:'Visa',balance:2400,apr:23.9,minPayment:75}];
  save(); renderDebt(); applyPanelGates(); await w(340);
  const debtsOnly=g();
  state.debts=[]; state.goals=[{id:'sg',name:'New fence',target:2400,saved:200,date:'',goalType:'foundation'}];
  save(); renderDebt(); applyPanelGates(); await w(340);
  const dreamOnly=g();
  /* a dream already reached is not something to save for */
  state.goals=[{id:'sg',name:'Done',target:500,saved:500,date:'',goalType:'foundation'}];
  save(); renderDebt(); applyPanelGates(); await w(340);
  return {debtsOnly, dreamOnly, reached:g(), note:(document.querySelector('#savePanel .pw-note')||{}).textContent||''};
});
check('debts alone do not open the savings panel, because it is not about debt',
      saveGate.debtsOnly===true);
check('...one unmet dream does, with no debt anywhere', saveGate.dreamOnly===false);
check('...and a dream already reached is not something to save for',
      saveGate.reached===true && /Name a dream/.test(saveGate.note), saveGate.note);

/* ============================================================
   91. A SILENT SUCCESS LOOKS EXACTLY LIKE A FAILURE

   "My overflow income didn't change or statistics when I changed my balance.
   Are they all being tracked?" - sent with a screenshot where one account
   carried a full block (expected balance, entries since, show-the-work) and the
   one below it showed nothing but a date.

   Everything WAS tracked. The balance, the bank total, net worth, the month's
   snapshot, the trend, the emergency-fund line and a stored reading - all six
   moved on that keystroke. Not one of them said so. The account had no ledger
   against it, so the reconcile branch stayed quiet by design, and the reading
   history rendered nothing because it held one entry and the code returned
   empty under two. Silence from a working feature is worth less than an error
   from a broken one, because a person can act on an error.

   The fixture is deliberately theirs: one account with a ledger and readings,
   one with neither. What is asserted is not "the code runs" but "the screen
   answers the question the person asked".
   ============================================================ */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08', hourlyWage:30,
  categories:[{id:'c1',name:'Food'}], budgets:{'2026-08':{c1:400}},
  accounts:[
    {id:'jc',name:'Joint Checking',kind:'checking',purpose:'sinking',balance:6637.64,updated:'2026-08-27',
     hist:[{d:'2026-07-01',b:5000,how:'first'},{d:'2026-08-27',b:6637.64,how:'bank'}]},
    /* no readings at all - added before the history existed */
    {id:'ov',name:'Overflow income',kind:'checking',purpose:'emergency',balance:1000,updated:'2026-08-20'}],
  transactions:[{id:'t1',type:'expense',amount:475.40,date:'2026-08-28',catId:'c1',acctId:'jc'}],
  snapshots:[{month:'2026-07',bank:6000,owed:0}]});
await p.reload(); await p.waitForTimeout(800);

const tracked = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  /* the backfill: a balance and the date it was read ARE a reading, and were
     two stored facts never written into the shape that can show them */
  /* Cloned, not referenced. Playwright serializes the return value when the
     evaluate ENDS, so a live array captured at the top comes back carrying
     every mutation made below it - this read as two readings before the change
     had happened. A "before" snapshot has to be a copy or it is not a before. */
  o.seeded=JSON.parse(JSON.stringify(state.accounts.find(x=>x.id==='ov').hist||[]));
  o.untouched=(state.accounts.find(x=>x.id==='jc').hist||[]).length;
  activateTab('goals'); renderAccounts(); await w(440);
  const row=id=>document.querySelector('input[data-acctbal="'+id+'"]').closest('.acct-row').innerText;
  o.before=row('ov');
  o.bankBefore=bankTotal(); o.nwBefore=netWorth();
  o.snapBefore=(state.snapshots.find(s=>s.month==='2026-08')||{}).bank;
  const toasts=[]; const ot=window.toast; window.toast=m=>{toasts.push(m);};
  const inp=document.querySelector('input[data-acctbal="ov"]');
  inp.value='1137.46'; inp.dispatchEvent(new Event('change',{bubbles:true}));
  await w(540);
  o.toast=toasts[0]||'';
  o.after=row('ov');
  o.hist=state.accounts.find(x=>x.id==='ov').hist;
  o.bankAfter=bankTotal(); o.nwAfter=netWorth();
  o.snapAfter=(state.snapshots.find(s=>s.month==='2026-08')||{}).bank;
  o.summary=document.getElementById('acctSummary').innerText;
  activateTab('reflect'); rfTab='trends'; renderReflectTab(); await w(300);
  trendPick='bank'; renderTrendSeries(); await w(300);
  o.trend=(state.snapshots.find(s=>s.month==='2026-08')||{}).bank;
  /* a retype that does not move is still a reading - the trend needs the flat
     months or it reads as a gap in the record */
  activateTab('goals'); renderAccounts(); await w(400);
  state.accounts.find(x=>x.id==='ov').hist=[{d:'2026-08-20',b:1137.46,how:'first'}]; save();
  renderAccounts(); await w(300);
  toasts.length=0;
  const same=document.querySelector('input[data-acctbal="ov"]');
  same.value='1137.46'; same.dispatchEvent(new Event('change',{bubbles:true}));
  await w(500);
  o.flatToast=toasts[0]||'';
  o.flatHist=(state.accounts.find(x=>x.id==='ov').hist||[]).length;
  /* and the account WITH a ledger keeps its own, different answer */
  renderAccounts(); await w(360);
  toasts.length=0;
  const j=document.querySelector('input[data-acctbal="jc"]');
  j.value='6000'; j.dispatchEvent(new Event('change',{bubbles:true}));
  await w(500);
  window.toast=ot;
  o.ledgerToast=toasts[0]||'';
  o.ledgerGap=state.accounts.find(x=>x.id==='jc').lastGap;
  return o;
});
check('a balance and the date it was read are recorded as the reading they already were',
      tracked.seeded.length===1 && tracked.seeded[0].d==='2026-08-20'
        && tracked.seeded[0].b===1000 && tracked.seeded[0].how==='first', JSON.stringify(tracked.seeded));
check('...without touching an account that already kept its own', tracked.untouched===2);
check('one reading renders, where it used to render nothing at all',
      /1 reading, taken 2026-08-20/.test(tracked.before), tracked.before);
check('...and after a change the row states both readings and what moved between them',
      /2 readings since 2026-08-20/.test(tracked.after) && /up \$137\.46/.test(tracked.after), tracked.after);
check('...with the reading stored, dated today, and named as read off the bank',
      tracked.hist.length===2 && tracked.hist[1].b===1137.46 && tracked.hist[1].how==='bank',
      JSON.stringify(tracked.hist));
check('an account with nothing logged against it now answers when you retype it',
      /up \$137\.46/.test(tracked.toast) && /since 2026-08-20/.test(tracked.toast)
        && /worked out again/.test(tracked.toast), tracked.toast);
/* the four figures that were always moving, silently. Each one asserted because
   "it was tracked" is a claim, and the person had no way to check it. */
check('the bank total moves by exactly what was typed',
      Math.abs((tracked.bankAfter-tracked.bankBefore)-137.46)<0.01,
      JSON.stringify([tracked.bankBefore,tracked.bankAfter]));
check('...net worth with it', Math.abs((tracked.nwAfter-tracked.nwBefore)-137.46)<0.01,
      JSON.stringify([tracked.nwBefore,tracked.nwAfter]));
check('...this month\'s snapshot is rewritten from it, not left until tomorrow',
      tracked.snapAfter>tracked.snapBefore && Math.abs(tracked.snapAfter-7775)<1,
      JSON.stringify([tracked.snapBefore,tracked.snapAfter]));
check('...which is what the trend reads, and is what "statistics" meant here',
      Math.abs(tracked.trend-7775)<1, String(tracked.trend));
check('...and the earmarked total reworks itself from the new figure',
      /\$1,137\.46/.test(tracked.summary), tracked.summary.slice(0,200));
check('a balance retyped unchanged is still recorded, and still says so',
      /unchanged/.test(tracked.flatToast) && /still a reading/.test(tracked.flatToast)
        && tracked.flatHist===2, tracked.flatToast);
check('an account that DOES carry a ledger still reports the gap instead',
      /without being logged/.test(tracked.ledgerToast) && typeof tracked.ledgerGap==='number',
      tracked.ledgerToast);

/* ============================================================
   92. THE PLANNING CALENDAR, AND THE BOX THAT CONFIRMS SOMETHING

   "In the plan category I would like a planning calendar which holds all of my
   reoccurring payments and income as a visual.. With a simple check box that
   says did it land in my account.. So it can be added to My tracker."

   Two properties carry this section.

   The first is that the checkbox keeps NO state of its own. An occurrence has
   landed exactly when a transaction exists carrying that rule's id and that
   date - the same test postRecurring uses to avoid posting twice - so the box
   reads the tracker rather than holding a second opinion about it. That is why
   the suite checks a scheduler-posted month renders as ticked without anything
   else happening: two records of one fact is how a calendar and a ledger start
   disagreeing, and there is only one record here.

   The second was found by building it wrong. The first version put the box on
   top of an engine that already auto-posted everything, so every past
   occurrence arrived pre-ticked and the box confirmed nothing. A tick that is
   always already there is decoration. Waiting is now a choice, defaulted OFF so
   no existing install changes behaviour, and both directions are asserted -
   turning it on must not un-log anything, turning it off must catch up.
   ============================================================ */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08',
  hourlyWage:30, calConfirm:true,
  categories:[{id:'rent',name:'Rent'},{id:'subs',name:'Subscriptions'}],
  budgets:{'2026-08':{rent:1400,subs:80}},
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:3000,updated:'2026-08-01'}],
  recurring:[
    {id:'r1',type:'income',amount:1476.92,source:'Paycheck',freq:'biweekly',anchor:'2026-08-07',acctId:'a1'},
    {id:'r2',type:'expense',amount:1400,catId:'rent',freq:'monthly',anchor:'2026-08-01',acctId:'a1'},
    {id:'r3',type:'expense',amount:19.99,catId:'subs',freq:'monthly',anchor:'2026-08-12',acctId:'a1'},
    {id:'r4',type:'invest',amount:200,source:'Index fund',freq:'monthly',anchor:'2026-08-15',acctId:'a1',ikind:'holds'},
    {id:'r5',type:'expense',amount:60,catId:'subs',freq:'monthly',anchor:'2026-08-31',acctId:'a1'}]});
await p.reload(); await p.waitForTimeout(850);

const cal = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('budget'); renderRecurring(); await w(560);
  const o={};
  o.occ=calOccurrences('2026-08').map(x=>x.date+'|'+x.label+'|'+x.type);
  o.sums=calMonthSums('2026-08');
  o.cells=document.querySelectorAll('#calGrid .cal-c').length;
  o.pad=document.querySelectorAll('#calGrid .cal-c.pad').length;
  o.marked=document.querySelectorAll('#calGrid .cal-c.has').length;
  o.boxes=document.querySelectorAll('#calList input[data-calland]').length;
  o.nav=document.getElementById('calNav').innerText;
  /* The count of future days in a fixture month is a function of what day it is
     when the suite runs, not of the code. Pinned to 1, this went red on its own
     the morning the month's last occurrence became today. Third date bomb in
     this suite - so what is captured is the partition, and the assertion checks
     it against today rather than against a number. */
  o.today=todayStr();
  o.days=[...document.querySelectorAll('#calList .cal-day')].map(d=>({
    date:d.id.replace('calday-',''),
    ahead:d.classList.contains('ahead'), now:d.classList.contains('now')}));
  o.note=document.getElementById('calList').innerText;
  /* tick */
  o.txBefore=state.transactions.length;
  const cb=document.querySelector('input[data-calland="r2"][data-caldate="2026-08-01"]');
  cb.checked=true; cb.dispatchEvent(new Event('change',{bubbles:true})); await w(540);
  const tx=state.transactions.find(x=>x.recId==='r2');
  o.tx=tx?{type:tx.type,amount:tx.amount,date:tx.date,catId:tx.catId,acctId:tx.acctId}:null;
  o.spent=spentFor('rent','2026-08');
  o.ticked=document.querySelector('input[data-calland="r2"][data-caldate="2026-08-01"]').checked;
  /* untick */
  const cb2=document.querySelector('input[data-calland="r2"][data-caldate="2026-08-01"]');
  cb2.checked=false; cb2.dispatchEvent(new Event('change',{bubbles:true})); await w(540);
  o.txEnd=state.transactions.length; o.spentEnd=spentFor('rent','2026-08');
  o.ruleKept=(state.recurring||[]).some(r=>r.id==='r2');
  /* the OTHER mode: what the scheduler posts by itself must read as landed */
  state.transactions=[]; state.calConfirm=false; save();
  const n=postRecurring('2026-08');
  save(); renderRecurring(); await w(520);
  const boxes=[...document.querySelectorAll('#calList input[data-calland]')];
  o.auto={posted:n, ticked:boxes.filter(x=>x.checked).length, landed:calMonthSums('2026-08').landed};
  /* and the toggle, both ways */
  const had=state.transactions.length;
  const m=document.getElementById('calConfirm');
  m.checked=true; m.dispatchEvent(new Event('change',{bubbles:true})); await w(500);
  o.onKept=state.transactions.length===had;
  o.whileOn=postRecurring('2026-08');
  const m2=document.getElementById('calConfirm');
  m2.checked=false; m2.dispatchEvent(new Event('change',{bubbles:true})); await w(540);
  o.caughtUp=state.transactions.length;
  return o;
});
/* August 2026 has 31 days and opens on a Saturday, so six pad cells lead it.
   Biweekly from the 7th falls on the 7th and the 21st and nowhere else. */
check('every repeat is laid out on the day it actually falls',
      cal.occ.length===6 && cal.occ[0].startsWith('2026-08-01')
        && cal.occ[5].startsWith('2026-08-31'), JSON.stringify(cal.occ));
check('...a fortnightly paycheck twice in the month, not once',
      cal.occ.filter(x=>/Paycheck/.test(x)).length===2, JSON.stringify(cal.occ));
check('...money in ordered before money out on a shared day',
      calOccOrderOk(cal.occ), JSON.stringify(cal.occ));
check('the grid is the whole month, offset to the weekday it opens on',
      cal.cells===31+cal.pad && cal.pad===6, JSON.stringify([cal.cells,cal.pad]));
check('...one marked day per date something falls on', cal.marked===6, String(cal.marked));
check('...and one box per occurrence, not per rule', cal.boxes===6, String(cal.boxes));
check('the month is totalled both directions before anything has happened',
      Math.abs(cal.sums.inAll-2953.84)<0.01 && Math.abs(cal.sums.outAll-1679.99)<0.01,
      JSON.stringify(cal.sums));
check('...and nothing reads as landed while nothing is logged',
      /0 of 6/.test(cal.nav) && cal.sums.landed===0, cal.nav);
check('days still to come are set apart from days already gone',
      cal.days.length>0
        && cal.days.every(d=>d.ahead===(d.date>cal.today) && d.now===(d.date===cal.today))
        && (cal.days.some(d=>d.ahead) ? /still to come/.test(cal.note) : true)
        && (cal.days.some(d=>d.now)   ? /\btoday\b/.test(cal.note)   : true),
      JSON.stringify({today:cal.today, days:cal.days}));
check('...and an unticked bill in the past is named as information, not a fault',
      /telling you something, not a bug/.test(cal.note), cal.note.slice(-200));
check('ticking writes one entry, in the same shape the scheduler writes',
      cal.tx && cal.tx.type==='expense' && cal.tx.amount===1400 && cal.tx.date==='2026-08-01'
        && cal.tx.catId==='rent' && cal.tx.acctId==='a1', JSON.stringify(cal.tx));
check('...counted by the month immediately, and the box stays ticked because it reads the tracker',
      cal.spent===1400 && cal.ticked===true, JSON.stringify([cal.spent,cal.ticked]));
check('unticking takes that entry straight back off and leaves the rule alone',
      cal.txEnd===cal.txBefore && cal.spentEnd===0 && cal.ruleKept===true,
      JSON.stringify([cal.txEnd,cal.spentEnd,cal.ruleKept]));
check('what the scheduler posted by itself reads as landed, with no second record',
      cal.auto.posted>0 && cal.auto.ticked===cal.auto.posted
        && cal.auto.landed===cal.auto.posted, JSON.stringify(cal.auto));
check('turning waiting on never un-logs what is already there', cal.onKept===true);
check('...and stops anything posting on its own', cal.whileOn===0, String(cal.whileOn));
check('...while turning it back off catches up rather than leaving a hole in the month',
      cal.caughtUp>0, String(cal.caughtUp));
for(const W of [320,390]){
  await p.setViewportSize({width:W,height:1100});
  await p.waitForTimeout(340);
  const g = await p.evaluate(async () => {
    const w=ms=>new Promise(r=>setTimeout(r,ms));
    activateTab('budget'); renderRecurring(); await w(400);
    const doc=document.documentElement;
    return {over:[...document.querySelectorAll('#calPanel *')]
              .filter(e=>e.getBoundingClientRect().right>doc.clientWidth+1).map(e=>e.className).slice(0,3),
            cell:Math.round(document.querySelector('#calGrid .cal-c').getBoundingClientRect().width),
            box:Math.round(document.querySelector('#calList input[data-calland]').getBoundingClientRect().width)};
  });
  check('the calendar fits at '+W+'px with a touchable cell and box',
        g.over.length===0 && g.cell>=32 && g.box>=17, JSON.stringify(g));
}
await p.setViewportSize({width:390,height:1000}); await p.waitForTimeout(300);

/* ============================================================
   93. A FACE FOR EVERY CATEGORY

   "Can each category get its own emoji before the title to give it a bit more
   personality on an overall very boring website." Sent with nine categories
   rendered as nine identical beige rows. Same report as "everything feels like
   a big run-on sentence", arriving on a different screen.

   The two properties that make this more than decoration:

   It GUESSES, so a category has a face the moment it exists. A picker on every
   category is a chore nobody finishes, and three of twelve decorated looks
   broken rather than personal - so the fixture is the user's own nine names and
   the suite checks all nine come out distinct without a single tap.

   And the guess is DERIVED, not stored. Rename "Food" to "Groceries" and the
   plate becomes a trolley, because nothing was frozen at creation. Only an
   explicit pick is written down, and from then on a rename must NOT touch it -
   which is the pair of assertions that would have caught storing the guess.
   ============================================================ */
const NINE=['Food','Power & Wi-Fi','Getting Around','Debt Payments','Emergency Fund',
            'Fun Money','Online shopping','Dream Fund','Trips & travel'];
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08',
  categories:NINE.map((n,i)=>({id:'f'+i,name:n})),
  budgets:{'2026-08':Object.fromEntries(NINE.map((n,i)=>['f'+i,100]))},
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:3000,updated:'2026-08-01'}]});
await p.reload(); await p.waitForTimeout(800);

const faces = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('budget'); renderBudget(); await w(500);
  const o={};
  o.rows=[...document.querySelectorAll('#cats .rw-nm')].map(el=>({
    e:(el.querySelector('.rw-e')||{}).textContent||'',
    t:(el.querySelector('.rw-t')||{}).textContent||''}));
  o.hidden=[...document.querySelectorAll('#cats .rw-e')].every(x=>x.getAttribute('aria-hidden')==='true');
  o.stored=state.categories.filter(c=>'emoji' in c).length;
  /* the order property: anything specific must beat the generic word inside it */
  o.order={carIns:guessCatEmoji('Car insurance',''), ins:guessCatEmoji('Insurance',''),
           petFood:guessCatEmoji('Pet food',''), food:guessCatEmoji('Food',''),
           none:guessCatEmoji('Zorblax',''), save:guessCatEmoji('Zorblax','save'),
           invest:guessCatEmoji('Zorblax','invest')};
  /* derived, so it keeps up with a rename */
  const f=state.categories.find(c=>c.name==='Food');
  o.before=catEmoji(f); f.name='Groceries'; save(); o.after=catEmoji(f);
  f.name='Food'; save();
  /* chosen, so it does NOT */
  openCatSheet('f0'); await w(360);
  document.querySelector('[data-editcat="f0"]').click(); await w(320);
  o.hasField=!!document.querySelector('input[data-face="f0"]');
  o.picks=document.querySelectorAll('#catSheetBody [data-pickface]').length;
  document.querySelector('input[data-face="f0"]').value='\u{1F355}';
  document.querySelector('[data-renamesave="f0"]').click(); await w(400);
  const c0=state.categories.find(x=>x.id==='f0');
  o.chosen=c0.emoji;
  c0.name='Pantry'; save(); o.chosenAfterRename=catEmoji(c0); c0.name='Food'; save();
  /* Auto hands it back, None means none */
  openCatSheet('f0'); await w(300);
  document.querySelector('[data-editcat="f0"]').click(); await w(300);
  document.querySelector('[data-faceauto]').click(); await w(320);
  o.autoDropped=!('emoji' in state.categories.find(x=>x.id==='f0'));
  document.querySelector('[data-editcat="f0"]').click(); await w(300);
  document.querySelector('[data-facenone]').click(); await w(320);
  o.none=catEmoji(state.categories.find(x=>x.id==='f0'));
  o.noneStored=state.categories.find(x=>x.id==='f0').emoji;
  closeCatSheet(); await w(260);
  renderBudget(); await w(320);
  o.noneBare=!document.querySelector('#cats [data-catsheet="f0"] .rw-e');
  delete state.categories.find(x=>x.id==='f0').emoji; save();
  /* the ledger names categories too - a face on half the rows looks broken */
  state.transactions=[{id:'x1',type:'expense',amount:20,date:'2026-08-10',catId:'f0'},
                      {id:'x2',type:'expense',amount:40,date:'2026-08-11',catId:'f2',note:'Tyres'},
                      {id:'x3',type:'income',amount:900,date:'2026-08-12',source:'Paycheck'}];
  save(); activateTab('tx'); renderTx(); await w(480);
  o.led=[...document.querySelectorAll('#txList .tx')].map(el=>({
    what:(el.querySelector('.tx-what')||{}).textContent||'',
    tail:(el.querySelector('.tx-tail')||{}).textContent||'',
    n:el.querySelectorAll('.tx-e').length}));
  return o;
});
check('every category has a face without anyone typing anything',
      faces.rows.length===9 && faces.rows.every(r=>r.e.length>0),
      JSON.stringify(faces.rows.map(r=>r.e+r.t)));
check('...and nine of them do not all get the same one',
      new Set(faces.rows.map(r=>r.e)).size>=8, String(new Set(faces.rows.map(r=>r.e)).size));
check('...with the name still beside it rather than replaced by it',
      faces.rows.every(r=>r.t.length>0));
check('...and the face hidden from a screen reader, which gains nothing from it',
      faces.hidden===true);
check('nothing is written to the data until somebody actually chooses',
      faces.stored===0, String(faces.stored));
check('a specific name beats the generic word inside it',
      faces.order.carIns!==faces.order.ins && faces.order.petFood!==faces.order.food,
      JSON.stringify(faces.order));
check('...a name matching nothing still gets one, and money put away gets one that agrees',
      faces.order.none.length>0 && faces.order.save!==faces.order.none
        && faces.order.invest!==faces.order.save, JSON.stringify(faces.order));
check('a guessed face keeps up with a rename, because it was never frozen',
      faces.before!==faces.after, JSON.stringify([faces.before,faces.after]));
check('the sheet offers a face field and quick picks beside the rename',
      faces.hasField===true && faces.picks>=12, JSON.stringify([faces.hasField,faces.picks]));
check('a chosen face is stored, and a later rename must not take it away',
      faces.chosen==='\u{1F355}' && faces.chosenAfterRename==='\u{1F355}',
      JSON.stringify([faces.chosen,faces.chosenAfterRename]));
check('"Auto" hands the choice back to the name', faces.autoDropped===true);
check('"None" means none, and never falls back to the guess',
      faces.none==='' && faces.noneStored==='' && faces.noneBare===true,
      JSON.stringify([faces.none,faces.noneStored,faces.noneBare]));
check('the ledger carries the same face, wherever the category is named on the row',
      faces.led.filter(r=>r.n===1).length===2
        && (faces.led.find(r=>/Paycheck/.test(r.what))||{}).n===0, JSON.stringify(faces.led));
/* "I'm not seeing how to plan ahead for future months? What good is a plan if
   you can't see what you are planning for." The engine could always answer for
   any month - recOccurrences takes one as an argument - and the Plan tab's own
   month arrows sit at the top of a long page, four panels above the calendar.
   A month view with no way to change the month is a calendar of one month.

   What the future month must NOT do is pretend: nothing can have landed in a
   month that has not happened, so the boxes are unavailable rather than
   invitingly empty, and the header says what is scheduled instead of how much
   has arrived. A tick on a day that has not come would be the app inviting
   somebody to lie to it. */
const calPlan = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  state.activeMonth='2026-08'; state.transactions=[]; state.calConfirm=true;
  state.categories=[{id:'rent',name:'Rent'},{id:'subs',name:'Subscriptions'}];
  state.budgets={'2026-08':{rent:1400}};
  state.recurring=[
    {id:'p1',type:'income',amount:1476.92,source:'Paycheck',freq:'biweekly',anchor:'2026-08-07'},
    {id:'p2',type:'expense',amount:1400,catId:'rent',freq:'monthly',anchor:'2026-08-01'},
    {id:'p3',type:'expense',amount:340,catId:'subs',freq:'yearly',anchor:'2026-10-09'}];
  save(); activateTab('budget'); renderRecurring(); await w(560);
  const o={arrows:!!document.getElementById('calPrev')&&!!document.getElementById('calNext'),
           noBackHere:!document.getElementById('calNow')};
  document.getElementById('calNext').click(); await w(580);
  o.month=state.activeMonth;
  o.nav=document.getElementById('calNav').innerText;
  const boxes=[...document.querySelectorAll('#calList input[data-calland]')];
  o.count=boxes.length; o.allOff=boxes.length>0 && boxes.every(b=>b.disabled && !b.checked);
  o.landed=calMonthSums(state.activeMonth).landed;
  o.note=document.getElementById('calList').innerText;
  o.hasBack=!!document.getElementById('calNow');
  document.getElementById('calNext').click(); await w(540);
  o.oct=state.activeMonth;
  o.yearlyFound=calOccurrences(state.activeMonth).some(x=>x.r.id==='p3');
  document.getElementById('calNow').click(); await w(540);
  o.home=state.activeMonth; o.now=thisMonth();
  return o;
});
check('the calendar carries its own month arrows, four panels from the ones at the top',
      calPlan.arrows===true && calPlan.noBackHere===true);
check('...and stepping forward moves the whole Plan tab with it',
      calPlan.month==='2026-09' && calPlan.hasBack===true, calPlan.month);
check('a month that has not happened is labelled planned, and counts nothing as landed',
      /planned/i.test(calPlan.nav) && /set up to bring/.test(calPlan.nav) && calPlan.landed===0, calPlan.nav);
check('...with every box unavailable rather than invitingly empty',
      calPlan.count>0 && calPlan.allOff===true, JSON.stringify([calPlan.count,calPlan.allOff]));
check('...and the reason said out loud, so a dead box is not a broken one',
      /Nothing here can be ticked yet/.test(calPlan.note), calPlan.note.slice(-200));
check('a yearly repeat is findable by stepping to the month it falls in',
      calPlan.oct==='2026-10' && calPlan.yearlyFound===true, JSON.stringify([calPlan.oct,calPlan.yearlyFound]));
check('...and one tap comes back to now', calPlan.home===calPlan.now, calPlan.home+' vs '+calPlan.now);

await p.evaluate((names)=>{ state.categories=names.map((n,i)=>({id:'f'+i,name:n}));
  state.budgets={'2026-08':Object.fromEntries(names.map((n,i)=>['f'+i,100]))};
  state.transactions=[]; state.recurring=[]; save(); }, NINE);
for(const W of [320,390]){
  await p.setViewportSize({width:W,height:1100});
  await p.waitForTimeout(340);
  const m = await p.evaluate(async () => {
    const w=ms=>new Promise(r=>setTimeout(r,ms));
    activateTab('budget'); renderBudget(); await w(380);
    return [...document.querySelectorAll('#cats .rw-nm')].map(el=>{
      const e=el.querySelector('.rw-e'), t=el.querySelector('.rw-t');
      if(!e||!t) return null;
      const er=e.getBoundingClientRect(), tr=t.getBoundingClientRect();
      return {same:Math.abs(er.top-tr.top)<er.height, w:Math.round(tr.width)};
    }).filter(Boolean);
  });
  /* The face must never wrap onto a line of its own, and must not cost the name
     the width it had - the whole complaint was rows being hard to read. */
  check('at '+W+'px the face stays on its name and leaves it real width',
        m.length===9 && m.every(x=>x.same && x.w>=90), JSON.stringify(m.slice(0,3)));
}
await p.setViewportSize({width:390,height:1000}); await p.waitForTimeout(300);

/* ============================================================
   94. A COLOUR PER PLACE

   "The website is completely monotone. Would it be better to have each section
   present a particular colour so people can easily see where they're landing?
   We can still fit in with the theme that we have set up but each page has its
   own distinct colour. Almost transparent."

   The colours themselves are the palette suite's job - it composites the wash
   over the panel and re-checks every ink against it, and it fails on two rooms
   sharing a hue, a view with no tint, and a rule too dark to see. What belongs
   HERE is the wiring: one attribute on the body drives the whole layer, so the
   thing to prove is that it changes on every tab, that the bottom bar agrees
   with the page above it, and that it is already correct on the first paint
   rather than only after the first tap.
   ============================================================ */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08',
  categories:[{id:'c1',name:'Food'}], budgets:{'2026-08':{c1:400}},
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:3000,updated:'2026-08-01'}],
  debts:[{id:'d1',name:'Visa',balance:2400,apr:23.9,minPayment:75}]});
await p.reload(); await p.waitForTimeout(800);

const tint = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  /* before a single tap: boot lands on Home without going through activateTab */
  o.atBoot=document.body.dataset.view;
  o.bootTint=getComputedStyle(document.body).getPropertyValue('--view').trim();
  const seen={};
  for(const v of ['home','budget','tx','debt','goals','reflect','learn','impulse','diary','settings']){
    activateTab(v); await w(200);
    const cs=getComputedStyle(document.body);
    seen[v]={attr:document.body.dataset.view, tint:cs.getPropertyValue('--view').trim()};
  }
  o.seen=seen;
  /* the bottom bar reads the same variable, so it cannot disagree with the page */
  activateTab('debt'); await w(260);
  const tab=document.querySelector('#tabs .tab[data-view="debt"]');
  o.tabColour=tab?getComputedStyle(tab).color:'';
  o.pageRule=(()=>{ const h=document.querySelector('.view.on .panel>h2');
    return h?getComputedStyle(h,'::before').backgroundColor:''; })();
  /* and the wash is on the view itself, so it travels with the page */
  o.wash=getComputedStyle(document.querySelector('.view.on')).backgroundImage;
  return o;
});
check('the colour layer is already right on the first paint, before any tab is tapped',
      tint.atBoot==='home' && /\d/.test(tint.bootTint), JSON.stringify([tint.atBoot,tint.bootTint]));
check('every tab stamps its own name on the body, which is all the layer needs',
      Object.entries(tint.seen).every(([k,v])=>v.attr===k),
      JSON.stringify(Object.fromEntries(Object.entries(tint.seen).map(([k,v])=>[k,v.attr]))));
check('...and every one of the ten resolves to a colour',
      Object.values(tint.seen).every(v=>/^\d+,\s*\d+,\s*\d+$/.test(v.tint)),
      JSON.stringify(Object.fromEntries(Object.entries(tint.seen).map(([k,v])=>[k,v.tint]))));
check('...no two of them the same, or the cue is not a cue',
      new Set(Object.values(tint.seen).map(v=>v.tint)).size===10,
      JSON.stringify([...new Set(Object.values(tint.seen).map(v=>v.tint))]));
/* The bottom bar lives outside every view, which is exactly why it reads the
   body attribute rather than anything inside the page - it has to agree with a
   page it is not part of. */
check('the active tab and the heading rule land on the same colour',
      tint.tabColour===tint.pageRule && /^rgb/.test(tint.tabColour),
      JSON.stringify([tint.tabColour,tint.pageRule]));
check('...and the wash is a gradient on the page itself, so it travels with it',
      /gradient/.test(tint.wash), tint.wash.slice(0,60));

/* The week's ledger only counts the last seven days, so an entry pinned to a
   literal date stops counting the moment the calendar moves past it. Taken from
   the machine's own clock instead - this file has already grown two date bombs
   and does not need a third. */
const ISO_TODAY=CLOCK_D;
/* ============================================================
   95. LOAD MUST NEVER DELETE A BUDGET TO FIX ITSELF

   Found while building the rest of this batch: a fixture that would not load.
   load() was one try/catch returning defaultState() on ANY throw, so a stray
   reference inside normalizeState - our own tidy-up pass, not the user's data -
   silently discarded everything. No error, no warning, an app that opens one
   morning as though it had never been used.

   The fixture was the lucky part. On a phone this is somebody's year.

   Unreadable JSON genuinely leaves no option but defaults, so the raw text is
   kept under its own key first. A throw in normalizeState is a bug in OUR code
   and the parsed state is handed back un-normalized: a formatting pass that
   cannot run is not a reason to delete a budget. Both say so out loud.
   ============================================================ */
const loadSafe = await p.evaluate(async () => {
  const KEY='unfiltered_budget_v2';
  const real={onboarded:true,uiMode:'all',hourlyWage:31,activeMonth:'2026-08',
    categories:[{id:'z1',name:'Food'}],budgets:{'2026-08':{z1:400}},
    transactions:[{id:'zt',type:'income',amount:1234,date:'2026-08-05',source:'Pay'}],
    accounts:[],goals:[],impulse:[],recurring:[],assets:[],liabilities:[],diary:[],
    intake:{},lessons:[],debts:[],vault:[],snapshots:[],timeLog:[]};
  const o={};
  /* a tidy-up that throws must not cost anything */
  localStorage.setItem(KEY, JSON.stringify(real));
  const saved=normalizeState;
  window.normalizeState=()=>{ throw new Error('boom'); };
  const kept=load();
  window.normalizeState=saved;
  o.keptWage=kept.hourlyWage; o.keptTx=(kept.transactions||[]).length;
  o.keptCats=(kept.categories||[]).length; o.flagged=!!kept.loadFailed;
  o.rawIntact=localStorage.getItem(KEY)===JSON.stringify(real);
  /* unreadable text is kept rather than overwritten */
  localStorage.setItem(KEY, '{not json at all');
  const fresh=load();
  o.freshIsDefault=(fresh.transactions||[]).length===0;
  o.freshFlagged=fresh.loadFailed==='unreadable';
  o.stashed=localStorage.getItem(KEY+'__unreadable')==='{not json at all';
  localStorage.setItem(KEY, JSON.stringify(real));
  return o;
});
check('a throw in our own tidy-up hands back the data un-normalized, not defaults',
      loadSafe.keptWage===31 && loadSafe.keptTx===1 && loadSafe.keptCats===1,
      JSON.stringify(loadSafe));
check('...flagged, because a half-failed load is the one moment to speak up',
      loadSafe.flagged===true);
check('...and what was stored is left exactly as it was', loadSafe.rawIntact===true);
check('unreadable text keeps the original rather than overwriting it',
      loadSafe.stashed===true && loadSafe.freshFlagged===true, JSON.stringify(loadSafe));
check('...and only then falls back to an empty app', loadSafe.freshIsDefault===true);

/* ============================================================
   96. THE EIGHT FROM ONE PHONE PASS

   A batch of reports in one message, and what they had in common: the app knew
   the right answer and did not say it. A trail that landed with no explanation.
   A stage badge contradicting the copy beneath it. A figure built from a panel
   two screens away that never named it. A panel whose render nothing called.
   ============================================================ */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08', hourlyWage:30,
  hoursPerWeek:40,
  categories:[{id:'c1',name:'Food'}], budgets:{'2026-08':{c1:400}},
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:3000,updated:'2026-08-01'}],
  assets:[{id:'as1',name:'Rental',value:120000,kind:'real'},{id:'as2',name:'Car',value:9000,kind:'stuff',cost:200}],
  liabilities:[{id:'l1',name:'Card',value:800,apr:22}],
  timeLog:[{id:'e1',date:ISO_TODAY,kind:'health',hours:2},{id:'e2',date:ISO_TODAY,kind:'leak',hours:6}],
  debts:[{id:'d1',name:'The truck',kind:'auto',balance:22000,apr:8.4,minPayment:480,worth:16500,secured:true}],
  intake:{why:'I just want to feel like I am working for something',
          reflections:{situation:'survive',moneyStory:'chaos',moneyStoryNote:'It came and went'}}});
await p.reload(); await p.waitForTimeout(850);

const eight = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  /* 1 + 2: a trail that explains itself on landing */
  activateTab('home'); await w(400);
  document.querySelector('#view-home [data-arrive="gutcheck"]').click(); await w(480);
  o.gutTab=currentTab;
  o.gutNote=(document.querySelector('#view-impulse .arrival')||{}).innerText||'';
  activateTab('home'); await w(300);
  o.ctaArrives=!!document.getElementById('hhCta').getAttribute('data-arrive');
  /* 3: the stage badge and the copy under it agree */
  renderNextSteps(); await w(360);
  o.survivalGone=!/survival mode this is the whole game/.test(document.getElementById('nextSteps').innerText);
  o.saidSo=!!document.querySelector('.ns-outgrown');
  o.answerKept=state.intake.reflections.situation==='survive';
  /* 4: the panel that never drew */
  activateTab('impulse'); await w(460);
  o.twDrawn=document.getElementById('tripwireBody').children.length>0;
  o.twActs=document.getElementById('tripwireBody').querySelectorAll('button').length;
  /* 5: the figure that would not show its working */
  activateTab('goals'); await w(360);
  const det=document.getElementById('sovAudit').closest('details'); if(det) det.open=true;
  renderSovereignty(); await w(400);
  o.sovAsks=document.querySelectorAll('#sovAudit [data-why="sovAudit"]').length;
  document.querySelector('#sovAudit [data-why="sovAudit"]').click(); await w(380);
  o.sovNote=[...document.querySelectorAll('.why-note')].map(x=>x.innerText).join(' ');
  /* 6: the money story, in the room that holds it */
  arrive('moneystory'); await w(520);
  o.storyTab=currentTab;
  o.story=(document.getElementById('storyBody')||{}).innerText||'';
  /* 7: the debt knows what it is, and what is behind it */
  activateTab('debt'); renderDebt(); await w(460);
  o.kindPicker=!!document.getElementById('debtKindSel');
  o.equity=/underwater/.test(document.getElementById('debtList').innerText);
  const sig=REPORT_SIGNALS.find(x=>x.k==='debtEquity').run();
  o.sig=sig?sig.nudge:'';
  /* 8: the week, budgeted */
  activateTab('tx'); renderTimeLog(); await w(460);
  o.sleep=!!timeCat('sleep');
  o.oldHours=timeUsed('health');
  o.targets=document.querySelectorAll('[data-ttarget]').length;
  o.canSub=document.querySelectorAll('[data-tsub]').length;
  o.head=(document.querySelector('.time-head')||{}).innerText||'';
  return o;
});
check('a trail lands where it said and explains what you came for',
      eight.gutTab==='impulse' && /hours of your life/.test(eight.gutNote), eight.gutNote.slice(0,140));
check('...and the hero CTA arrives rather than just switching tab', eight.ctaArrives===true);
check('a stage-3 person with assets stops being told they are in survival mode',
      eight.survivalGone===true && eight.saidSo===true);
check('...and their own answer is not overwritten to achieve it', eight.answerKept===true);
check('Tripwires draws, with something to press', eight.twDrawn===true && eight.twActs>=3,
      String(eight.twActs));
check('every sovereignty figure can be asked where it came from', eight.sovAsks===4, String(eight.sovAsks));
check('...and the answer names its source, its arithmetic and what would move it',
      /Assets vs Liabilities/.test(eight.sovNote) && /What moves it/.test(eight.sovNote),
      eight.sovNote.slice(0,160));
check('the money story lands in the Diary holding the answers it refers to',
      eight.storyTab==='diary' && /working for something/.test(eight.story)
        && /Feast or famine/.test(eight.story), eight.story.slice(0,160));
check('a debt can say what kind it is, and what it is attached to',
      eight.kindPicker===true && eight.equity===true);
check('...and Reflect answers the asset-or-liability question from it',
      /cannot get out of this by selling/.test(eight.sig), eight.sig.slice(0,140));
check('the week is a budget: lanes with targets, subcategories, and sleep in it',
      eight.sleep===true && eight.targets>=6 && eight.canSub>=6,
      JSON.stringify([eight.targets,eight.canSub]));
check('...against 168 less what is sold to work, not against nothing',
      /yours to plan/.test(eight.head), eight.head);
check('...and hours logged before any of this still land where they always did',
      eight.oldHours===2, String(eight.oldHours));

/* ============================================================
   97. "HOW WOULD MY 13 YEAR OLD UNDERSTAND THIS?"

   Asked of the leverage panel, and the honest answer was: they would not, and
   neither would most adults. Every label was a term of art - return, held for,
   rate you pay per year - and the headline announced a PERCENTAGE, which is the
   one shape of number nobody feels.

   Not fixed by dumbing the arithmetic down; the sums underneath are byte for
   byte the same. Fixed by saying them in words a person already owns and by
   putting the answer in DOLLARS. "$669.88 a year" lands where "2.68%" does not.

   The property worth guarding is the vocabulary, not any one sentence - so the
   check is that nothing over nine letters survives in plain mode. Three words
   crossed that line while this was being written (enforceable, break-even,
   asymmetry) and all three were in the copy before it was measured.
   ============================================================ */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08', hourlyWage:30,
  lev:{amt:25000, apr:3.9, ret:15, years:5, pay:300, cash:600}});
await p.reload(); await p.waitForTimeout(800);

const pw97 = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); renderLeverage(); await w(460);
  const o={};
  const story=document.querySelector('#levPanel .lev-101');
  o.storyClosed=!!story && !story.open;
  if(story) story.open=true; await w(140);
  o.story=story?story.innerText:'';
  if(story){ story.open=false; delete story.dataset.opened; }
  o.sharpLabels=[...document.querySelectorAll('#levPanel [data-plain]')].map(x=>x.textContent);
  o.sharpHead=document.getElementById('levResults').innerText.split('\n')[0];
  const cb=document.getElementById('levPlain');
  cb.checked=true; cb.dispatchEvent(new Event('change',{bubbles:true})); await w(460);
  o.plainLabels=[...document.querySelectorAll('#levPanel [data-plain]')].map(x=>x.textContent);
  o.hints=[...document.querySelectorAll('#levPanel [data-plainh]')].map(x=>x.textContent).filter(Boolean);
  o.plainTxt=document.getElementById('levResults').innerText;
  o.opened=!!document.querySelector('#levPanel .lev-101').open;
  o.cards=document.querySelectorAll('#levResults .lev-card').length;
  o.stored=state.plainWords;
  return o;
});
check('the panel carries a four-sentence account of what borrowing to build IS',
      /borrow \$100/.test(pw97.story) && /bigger/.test(pw97.story)
        && /both directions/.test(pw97.story), pw97.story.slice(0,120));
check('...closed by default, so it is a door and not a lecture', pw97.storyClosed===true);
check('...and opened for you the moment you ask for pw97 words', pw97.opened===true);
/* the dollars go to everyone, not only to pw97 mode */
check('even unchanged, the headline now gives the dollars beside the percentage',
      /2\.68%/.test(pw97.sharpHead) && /\$669\.88/.test(pw97.sharpHead), pw97.sharpHead);
check('pw97 words swap every label for English somebody already owns',
      pw97.sharpLabels[0]==='Amount borrowed'
        && pw97.plainLabels[0]==='Money you would borrow'
        && pw97.plainLabels[2]==='What you think it will make you',
      JSON.stringify(pw97.plainLabels));
check('...with a hint under the ones that need one, and none before that',
      pw97.hints.length>=4 && pw97.hints.some(h=>/not yours/i.test(h)), JSON.stringify(pw97.hints));
check('the headline becomes dollars with no percentage left in it',
      /\$669\.88 a year/.test(pw97.plainTxt.split('\n')[0])
        && !/%/.test(pw97.plainTxt.split('\n')[0]), pw97.plainTxt.split('\n')[0]);
check('...and the comparison is dollars against dollars',
      /\$3,750 a year against the \$669\.88/.test(pw97.plainTxt), pw97.plainTxt.slice(0,240));
/* the vocabulary, which is the thing actually asked about */
const pw97Long=[...new Set((pw97.plainLabels.join(' ')+' '+pw97.hints.join(' ')+' '+pw97.plainTxt)
  .match(/[A-Za-z][A-Za-z'-]{9,}/g)||[])];
check('nothing over nine letters survives in pw97 mode', pw97Long.length===0, pw97Long.join(', '));
/* and the rule that no rewording is allowed to break */
check('pw97 mode still never prints an upside without its downside',
      pw97.cards===2 && /If it makes nothing/.test(pw97.plainTxt), String(pw97.cards));
check('...and still refuses to say whether to do it',
      /will not tell you whether to do it/.test(pw97.plainTxt));
check('the choice is remembered', pw97.stored===true);

/* ============================================================
   98. A LIGHT VERSION OF THE WAY IN

   "The starting line intro needs a light version. Same with the intake chat."

   Checked first, because "light" could have meant the light theme: it did not.
   Both already render correctly on paper. What they were was HEAVY - 339 words
   and eleven paragraphs on the first screen anybody sees, then 1,217 more words
   of questions, all of it before a single number of their own appears.

   The writing is not the problem; what it says is the reason the app exists.
   A wall of it is a door some people will not walk through. So there are two of
   each, the short one leads, and which one leads is the app's OWN brief/full
   setting - so the intro, the chat and every panel afterwards agree about how
   much this person wants read to them.

   What a shortening is not allowed to drop is the point of the section: the
   three claims that have to be made before somebody starts, and the privacy
   promise. Those are asserted individually, because "it got shorter" is not the
   property that matters.
   ============================================================ */
await seed({...EMPTY, onboarded:false, welcomed:false});
await p.reload(); await p.waitForTimeout(1100);

const li98 = await p.evaluate(async () => {
  const wt=ms=>new Promise(r=>setTimeout(r,ms));
  const el=document.getElementById('iaWelcome');
  const words=t=>t.split(/\s+/).filter(Boolean).length;
  const ap=t=>t.replace(/[‘’]/g,"'");
  const o={shown:el.classList.contains('on'), mode:state.sayMode};
  const short=el.innerText;
  o.shortW=words(short);
  o.notVerdict=/not a verdict/.test(short);
  o.accountability=/accountability/i.test(short);
  o.notReal=/I am not real/.test(short);
  o.privacy=/stays in this browser/.test(short);
  o.canGo=!!document.getElementById('iaWelGo');
  document.getElementById('iaWelMore').click(); await wt(320);
  const long=ap(el.innerText);
  o.longW=words(long); o.modeAfter=state.sayMode;
  o.longIntact=/I'm listening/.test(long)&&/I'm watching/.test(long)&&/You can do better/.test(long);
  document.getElementById('iaWelLess').click(); await wt(280);
  o.backW=words(el.innerText); o.modeBack=state.sayMode;
  /* the chat */
  const a={name:'Pat',income:3200,situation:'ok',register:'middle',tone:'blunt',wage:20,
           hoursPerWeek:40,extraIncome:[{amount:400,hours:20}],acct:'full'};
  let full=0, brief=0;
  INTAKE.forEach(s=>{ full+=words(String(typeof s.bot==='function'?s.bot(a):(s.bot||'')));
    state.sayMode='brief'; brief+=words(String(iaBotText(s,a))); });
  o.full=full; o.brief=brief; o.shorts=INTAKE.filter(s=>s.botShort).length;
  const plain=INTAKE.find(s=>!s.botShort && s.bot);
  state.sayMode='brief';
  o.fellThrough=iaBotText(plain,a)===(typeof plain.bot==='function'?plain.bot(a):plain.bot);
  state.sayMode='full';
  const heavy=INTAKE.find(s=>s.id==='acct');
  o.fullIntact=iaBotText(heavy,a)===heavy.bot(a);
  /* a short form runs mid-chat, on answers that are half given */
  const bad=[];
  [{},{income:0},{acct:'spend',income:1200},{payFreq:'hourly',payAmt:19,income:2400}].forEach(pa=>{
    INTAKE.filter(s=>s.botShort).forEach(s=>{
      try{ const t=String(typeof s.botShort==='function'?s.botShort(pa):s.botShort);
        if(/undefined|NaN|null/.test(t)) bad.push(s.id);
      }catch(e){ bad.push(s.id+' THREW'); } }); });
  o.bad=[...new Set(bad)];
  state.sayMode='brief'; save();
  return o;
});
check('the starting line opens on the short version',
      li98.shown===true && li98.mode==='brief' && li98.shortW<180, String(li98.shortW));
check('...still saying where you are is not a verdict', li98.notVerdict===true);
check('...still saying this is accountability rather than budgeting', li98.accountability===true);
check('...still saying the tool is not a person and cannot want it for you', li98.notReal===true);
check('...still carrying the privacy promise', li98.privacy===true);
check('...and still showing the way in', li98.canGo===true);
check('the long version is one tap away and lost nothing',
      li98.longIntact===true && li98.longW>li98.shortW*2, JSON.stringify([li98.shortW,li98.longW]));
/* This is the part that makes it one app rather than one screen: the choice is
   the same setting every panel on every tab already reads. */
check('...and choosing is the app-wide brief/full setting, not a peek at this screen',
      li98.modeAfter==='full' && li98.modeBack==='brief', JSON.stringify([li98.modeAfter,li98.modeBack]));
check('...reversible from where it was made', li98.backW===li98.shortW, JSON.stringify([li98.backW,li98.shortW]));
check('the heaviest questions in the chat gained a short form', li98.shorts>=12, String(li98.shorts));
check('...cutting it by roughly a quarter, without rewriting the light ones',
      li98.brief<li98.full*0.8 && li98.brief>li98.full*0.6, JSON.stringify([li98.full,li98.brief]));
check('a question with no short form falls through to the one it has, never blank',
      li98.fellThrough===true);
check('...and full mode still speaks every original word', li98.fullIntact===true);
/* A short form runs against answers that are only half given, which is exactly
   where a template that assumes a number prints "$NaN" at somebody. */
check('no short form breaks on a half-answered chat', li98.bad.length===0, li98.bad.join(', '));

/* ============================================================
   99. FIVE FROM ONE INTAKE

   The chat, walked by somebody who had already used it once. Two of these are
   the same fault in different clothes: the app asking for something it had
   already been refused, and the app recording something that had not happened.
   ============================================================ */
/* welcomed:true because that is who this is: somebody who read the gate, started
   answering, and left. Without it openIntake shows the welcome card again and
   the resume offer never appears - which was the fixture failing, not the app. */
await seed({...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, activeMonth:'2026-08', hourlyWage:30,
  welcomed:true,
  goals:[{id:'q1',name:'New fence',target:2400,saved:200,date:'2027-03-01',goalType:'foundation'},
         {id:'q2',name:'Japan trip',target:6000,saved:1500,date:'',goalType:'circulation'},
         {id:'q3',name:'Cushion',target:1000,saved:0,date:'',goalType:'foundation'}],
  debts:[{id:'qd',name:'Visa',kind:'card',balance:2400,apr:23.9,minPayment:75,limit:5000}],
  saveBudget:200,
  intakeDraft:{ans:{name:'Pat',situation:'ok',income:3200},step:6,at:Date.now()-600000}});
await p.reload(); await p.waitForTimeout(900);

const five = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  /* 1. the same question with the sugar removed */
  const wage=INTAKE.find(s=>s.id==='wage'), shows=a=>!wage.showIf||wage.showIf(a);
  o.declined=shows({acct:'spend',income:0,incomeAvoid:'avoid'});
  o.gaveIt=shows({acct:'spend',income:1800});
  o.fullPath=shows({acct:'full',income:3200});
  o.skippedSilently=shows({acct:'spend',income:0});
  o.whyComesFirst=INTAKE.findIndex(s=>s.id==='incomeAvoid')<INTAKE.findIndex(s=>s.id==='wage');
  /* 2. a way back into an unfinished setup */
  /* Guarded rather than assumed: a null here used to throw inside the evaluate,
     which fails the whole file with a stack instead of failing one check with a
     reason. A probe that cannot report is worse than one that fails. */
  activateTab('home'); renderNextSteps(); await w(500);
  const first=document.querySelector('.nextstep');
  o.card=first?first.innerText:'(no next-step card rendered)';
  o.act=first?first.dataset.act:'';
  o.draftAtRender=!!state.intakeDraft;
  o.stepCount=document.querySelectorAll('.nextstep').length;
  if(first){
    first.click(); await w(760);
    o.opened=document.getElementById('intake').classList.contains('on');
    o.offered=/partway through/.test(document.getElementById('intakeLog').innerText);
    const rs=document.getElementById('iaResume');
    if(rs){ rs.click(); await w(700); }
    o.restored=Object.keys(iaAns).length;
  }
  /* 3. one function that pins the newest question to the bottom.
     The overlay has to be on for any of this to have a layout - a display:none
     flex column strands nothing because nothing has height. */
  document.getElementById('intake').classList.add('on');
  const log=document.getElementById('intakeLog');
  log.style.display=''; document.getElementById('intakeDock').style.display=''; await w(80);
  log.innerHTML=''; for(let i=0;i<30;i++){ const d=document.createElement('div');
    d.className='bub bot'; d.textContent='line '+i; log.appendChild(d); }
  log.scrollTop=0;
  o.atTop=Math.round(log.scrollHeight-log.scrollTop-log.clientHeight);
  iaScrollDown(); await w(150);
  o.pinned=Math.round(log.scrollHeight-log.scrollTop-log.clientHeight);
  document.getElementById('intake').classList.remove('on');
  /* 4. the packs, on both paths */
  const pk=INTAKE.find(s=>s.id==='packs');
  o.packs={is:!!pk, input:pk&&pk.input, spend:!pk.showIf||pk.showIf({acct:'spend'}),
           full:!pk.showIf||pk.showIf({acct:'full'}),
           offered:CAT_PACKS.filter(x=>x.k!=='essentials').length,
           noEssentials:!CAT_PACKS.filter(x=>x.k!=='essentials').some(x=>x.k==='essentials')};
  state.categories=[]; save();
  ['travel','health'].forEach(k=>{ try{ addPack(k); }catch(e){} });
  o.packs.applied=state.categories.length;
  /* 5. the other direction */
  o.sim=simulateGoals(state.goals,200,'soonest');
  o.dated=(simulateGoals(state.goals,200,'dated').seq[0]||{}).name;
  activateTab('debt'); renderDebt(); await w(520);
  o.saveTxt=document.getElementById('savePanel').innerText;
  o.rows=(document.querySelector('#savePanel .save-rows')||{}).innerText||'';
  o.head=(document.querySelector('#savePanel .save-head')||{}).innerText||'';
  state.debts=[]; save(); renderSave(); await w(320);
  o.noDebtTxt=document.getElementById('savePanel').innerText;
  return o;
});
check('somebody who declined income is not asked for it again per hour',
      five.declined===false, JSON.stringify(five.declined));
check('...while anyone who gave a figure still gets the rate question',
      five.gaveIt===true && five.fullPath===true);
check('...and a silent skip, with no reason given, is still asked once',
      five.skippedSilently===true);
check('...which only works because the question about why comes first',
      five.whyComesFirst===true);
check('an unfinished setup says so on Home, ahead of everything else',
      /Finish setting up/.test(five.card) && /3 answers in/.test(five.card),
      `draft:${five.draftAtRender} cards:${five.stepCount} | ${five.card.replace(/\n/g,' / ')}`);
check('...and that card is the door, with no trip through Settings',
      five.act==='intake' && five.opened===true && five.offered===true);
check('...carrying on restores what was already answered', five.restored>=3, String(five.restored));
/* The mechanism I expected - a growing dock stranding the question - does not
   reproduce in Chromium, which anchors a bottom-pinned scroller. So what is
   asserted is the property the report asked for rather than a bug I cannot
   show: one function, and the newest question ends up at the bottom. */
check('one function pins the newest question to the bottom from anywhere',
      five.atTop>200 && five.pinned===0, JSON.stringify([five.atTop,five.pinned]));
check('the intake offers the category packs',
      five.packs.is===true && five.packs.input==='packs');
check('...on the spend path too, which is the one that ends emptiest',
      five.packs.spend===true && five.packs.full===true);
check('...without re-offering the essentials the walls step already funded',
      five.packs.noEssentials===true && five.packs.offered>=7, String(five.packs.offered));
check('...and taking one actually puts categories on the plan',
      five.packs.applied>3, String(five.packs.applied));
/* By hand: 1,000 then 2,200 then 4,500 at 200 a month, one at a time. */
check('a dream is worked out the way a debt is, one at a time in order',
      five.sim.seq[0].hit===5 && five.sim.seq[1].hit===16 && five.sim.seq[2].hit===39,
      JSON.stringify(five.sim.seq.map(g=>g.name+'@'+g.hit)));
check('...with no interest anywhere in the working, because none is owed on it',
      !/interest|%|apr/i.test(five.rows+' '+five.head), five.rows.slice(0,120));
check('...ordered by the date you promised, when you ask for that',
      five.dated==='New fence', five.dated);
check('...and flagged when a dream lands after the date it was promised',
      /after 2027-03-01/.test(five.saveTxt), five.saveTxt.slice(0,300));
check('the same money is priced against the debt it is not paying',
      /The same \$200 on your debt instead/.test(five.saveTxt) && /23\.9%/.test(five.saveTxt)
        && /\$573\.60/.test(five.saveTxt), five.saveTxt.slice(-400));
check('...and it refuses to choose between them', /will not pick for you/.test(five.saveTxt));
check('with nothing owed it does not manufacture a comparison',
      !/on your debt instead/.test(five.noDebtTxt), five.noDebtTxt.slice(-160));

/* ---- 100. "This doesn't look right" ----
   Sent from a real phone as a photo of the invest-vs-crush panel with four
   words attached. Both cards read as a minus - minus $17,809 one side, minus
   $14,452 the other - and both were labelled "net worth in 5 yrs". The gap
   between them was exact to the cent, so the arithmetic was never the fault.
   The fault was that the model only ever knew the debts on that screen and the
   money aimed at them: no bank balance, and no house behind the HELOC. It took
   a person with a home and savings and printed a number that said they were
   worth less than nothing.
   The guarded property is not the figure. It is that the app never calls a
   partial number by a whole number's name, and never shows a minus sign
   without the two halves that made it. ---- */
const IVN={...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, hourlyWage:24,
  accounts:[{id:'a',name:'Chequing',kind:'checking',purpose:'',balance:6000,updated:ISO_TODAY,src:'user'}],
  debts:[{id:'h',name:'Heloc',kind:'line',balance:18000,apr:3.49,minPayment:120,limit:25000}],
  debtBudget:220, investReturn:10, investYears:5};
await seed(IVN); await p.reload(); await p.waitForTimeout(900);
const look = await p.evaluate(async () => {
  activateTab('debt'); await new Promise(r=>setTimeout(r,600));
  /* "-$7,027.38" - the sign sits OUTSIDE the dollar sign, so a pattern that
     lets -? float ahead of \$ swallows it and hands back a positive number.
     Caught by this very section printing 0-7027.38=7027.38 as a failure. */
  const num=t=>{ const c=String(t).replace(/,/g,'').match(/(-?)\s*\$?\s*(-?[\d.]+)/);
                 return c ? (c[1]==='-'?-1:1)*Math.abs(parseFloat(c[2])) : NaN; };
  const cards=[...document.querySelectorAll('.iv-card')].map(c=>({
    label:(c.querySelector('.sp-k')||{}).textContent||'',
    net:num((c.querySelector('.iv-net')||{}).textContent||''),
    neg:/^\s*-/.test(((c.querySelector('.iv-net')||{}).textContent||'').trim()),
    sub:(c.querySelector('.sub')||{}).textContent||'',
    work:(c.querySelector('.iv-work')||{textContent:''}).textContent.replace(/\s+/g,' ').trim(),
    parts:[...c.querySelectorAll('.iv-work b')].map(b=>num(b.textContent)) }));
  const scope=(document.querySelector('.iv-scope')||{textContent:''}).textContent.replace(/\s+/g,' ').trim();
  const c=investCompare(state.debts,state.debtBudget,10,60);
  return { cards, scope, worth:netWorth(), bank:bankTotal(),
    panel:(document.getElementById('investPanel')||{innerText:''}).innerText,
    /* the gap is the only figure a decision hangs on, and it must survive
       everything the model leaves out, because those sit on both sides */
    gap:Math.round((c.investFirst.net-c.crush.net)*100)/100,
    gapWithAssets:Math.round(((c.investFirst.net+netWorth())-(c.crush.net+netWorth()))*100)/100 };
});
check('the invest panel no longer calls a partial figure your net worth',
      look.cards.length===2 && !/net worth in/i.test(look.panel), look.panel.slice(0,140));
check('...each card says what its number is actually the end of',
      look.cards.every(c=>/left of this one decision after 5 yrs/.test(c.sub)),
      look.cards.map(c=>c.sub).join(' | '));
check('...and shows the two halves that made it, so a minus explains itself',
      look.cards.every(c=>/invested/.test(c.work) && /still owed/.test(c.work) && c.parts.length===2),
      look.cards.map(c=>c.work).join(' | '));
check('...that reconcile: invested minus still owed is the number on the card',
      look.cards.every(c=>Math.abs((c.parts[0]-c.parts[1])-c.net)<1),
      look.cards.map(c=>`${c.parts[0]}-${c.parts[1]}=${c.net}`).join(' | '));
/* the reporter's own shape: a HELOC big enough that five years of minimums
   leaves it standing, so both cards are negative. They must stay negative -
   inventing a positive by folding in assets would be the same lie facing the
   other way - and the screen must explain the sign. */
check('the shape from the report still comes out negative on both sides',
      look.cards.every(c=>c.neg===true), look.cards.map(c=>c.net).join(' | '));
check('...and the panel names, on screen, what is not counted in it',
      /bank balance is not in there/i.test(look.scope), look.scope.slice(0,120));
check('...including the home behind a HELOC, which no debt figure can see',
      /your home behind Heloc/i.test(look.scope), look.scope.slice(0,220));
check('...and says plainly that a minus here is not your net worth',
      /not your net worth/i.test(look.scope) && new RegExp('\\$6,000').test(look.scope),
      look.scope.slice(-200));
check('...while pointing at the gap, the one figure the decision hangs on',
      /gap between the two cards/i.test(look.scope));
check('the gap is untouched by everything the model leaves out',
      look.gap===look.gapWithAssets && look.worth===6000, `${look.gap} vs ${look.gapWithAssets}`);

/* ---- 101. read the statement, do not swallow it ----
   Asked for in one message: "instead of taking actual screenshots is a scan
   feature possible where I can open up my bank statement and quickly skim all
   the transactions. Even if it wasn't completely uploaded into the track
   portion (though would be nice if it could at least analyze my spending habits
   and notice where I'm spending too much, to report back in reflect)."

   The reader already existed and took ONE photo, ending in a pile of rows to
   check - so the payoff for reading a four page statement was a data entry job.
   What is guarded here is not the OCR (qlocr owns that) but the SEPARATION: a
   figure read off a photograph and a figure the user typed carry different
   confidence, and the moment they are added together the result claims more
   than either half can support. That is the same fault section 100 came from,
   one week earlier, and it is the one this feature is most able to reintroduce. ---- */
const SCANST={...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, hourlyWage:25,
  categories:[{id:'c1',name:'Food'}], budgets:{'2026-08':{c1:400}},
  transactions:[{id:'i1',type:'income',amount:3200,date:'2026-08-01'},
                {id:'e1',type:'expense',amount:80,catId:'c1',date:'2026-08-04'}],
  accounts:[{id:'a1',name:'Chequing',kind:'checking',balance:2000,updated:ISO_TODAY}]};
await seed(SCANST); await p.reload(); await p.waitForTimeout(900);
const scan = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(600);
  const before={ nw:netWorth(), tx:state.transactions.length, exp:monthExpense(state.activeMonth) };
  const recs=[{what:'STARBUCKS',amt:5.25},{what:'STARBUCKS',amt:4.85},{what:'DUNKIN',amt:3.90},
              {what:'STARBUCKS',amt:6.10},{what:'KROGER',amt:212.44},{what:'GREYSTAR RENT PMT',amt:1450},
              {what:'NETFLIX.COM',amt:22.99},{what:'TRANSFER TO SAVINGS',amt:300}];
  scanResult={pages:2, dropped:1, at:'2026-08-30', text:'raw text', records:recs, read:scanRead(recs)};
  renderScanOut();
  const panel=document.getElementById('scanPanel');
  const out={ panelText:panel.innerText,
    before, after:{ nw:netWorth(), tx:state.transactions.length, exp:monthExpense(state.activeMonth) } };
  /* keeping it is the only thing that writes, and what it writes is a summary */
  document.getElementById('scanKeep').click(); await w(250);
  out.kept={ n:(state.scans||[]).length, tx:state.transactions.length, nw:netWorth(),
             keys:Object.keys((state.scans||[])[0]||{}),
             /* a reading is a summary, not a warehouse of somebody's merchants */
             hasRecords:JSON.stringify((state.scans||[])[0]||{}).includes('GREYSTAR') };
  out.spent=scanResult.read.spent; out.putAway=scanResult.read.putAway;
  out.raw=!!panel.querySelector('.scan-raw');
  return out;
});
check('reading a statement changes nothing in the ledger it is read beside',
      scan.before.tx===scan.after.tx && scan.before.nw===scan.after.nw && scan.before.exp===scan.after.exp,
      JSON.stringify([scan.before,scan.after]));
check('...and says so on its own face, in the panel',
      /not in Track/.test(scan.panelText) && /not in your net worth/.test(scan.panelText)
        && /has not changed a single figure/.test(scan.panelText), scan.panelText.slice(-300));
check('...it will always show the raw text it read', scan.raw===true);
/* by hand: 5.25+4.85+3.90+6.10 = 20.10 coffee, +212.44 +1450 +22.99 = 1705.53.
   The $300 into savings is money that MOVED, not money that went. */
check('money put away is never counted as money spent',
      scan.spent===1705.53 && scan.putAway===300, `${scan.spent} / ${scan.putAway}`);
check('keeping a reading stores a summary, never the merchant list',
      scan.kept.n===1 && scan.kept.hasRecords===false, scan.kept.keys.join(','));
check('...and still writes no transaction', scan.kept.tx===scan.before.tx && scan.kept.nw===scan.before.nw);

/* the payoff the request was actually about: it has to come back in Reflect */
const scanRep = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('reflect'); await w(750);
  const cards=[...document.querySelectorAll('.rp-card')].map(c=>c.innerText);
  const mine=cards.find(t=>/statement read/i.test(t))||'';
  return { there:!!mine, text:mine, total:cards.length,
    /* it must not be laid out as though it were one of the ledger's own months */
    ledgerCards:cards.filter(t=>/kept|on pace/i.test(t)).length };
});
check('the reading reports back in Reflect, which is what was asked for',
      scanRep.there===true, String(scanRep.total)+' cards');
check('...naming itself a reading of a photograph rather than a month',
      /reading of a photograph, not your ledger/.test(scanRep.text), scanRep.text.slice(-200));
check('...sitting beside the ledger cards, not replacing them',
      scanRep.ledgerCards>=1, String(scanRep.ledgerCards));

/* ---- 102. the month you are in, and the month you walked to ----
   Reported from a phone: "it's August 31st, why did it pull up September's
   tracking prematurely?" Nothing was premature. `state.activeMonth` is GLOBAL -
   Plan, Track and Reflect all read it - so one tap of the planning calendar's
   forward arrow, a control added so somebody could plan ahead, relocated the
   whole app. And activeMonth is SAVED, so closing the tab and coming back the
   next day still landed in September.

   Track was the worst of it: it has no month control at all, so it rendered an
   empty next month - "Income $0, Spent $0" - with nothing naming the month and
   no way back. The month label said "This month" when it matched and rendered
   `&nbsp;` when it did not, which means the ABSENCE OF A WORD was carrying the
   whole message. ---- */
const MHM=CLOCK_M;
const MONTHH={...EMPTY, uiMode:'all', stageReached:3, guidesOff:true, hourlyWage:25, activeMonth:MHM,
  categories:[{id:'rent',name:'Rent'}], budgets:{[MHM]:{rent:1400}},
  transactions:[{id:'t1',type:'income',amount:3200,date:MHM+'-02'},
                {id:'t2',type:'expense',amount:1400,catId:'rent',date:MHM+'-03'}],
  accounts:[{id:'a1',name:'Chequing',kind:'checking',balance:2000,updated:ISO_TODAY}]};
await seed(MONTHH); await p.reload(); await p.waitForTimeout(900);
const mh = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('budget'); await w(600);
  document.getElementById('mNext').click(); await w(550);
  const o={ moved:state.activeMonth, now:thisMonth(),
    planLabel:document.getElementById('mLabel').innerText.replace(/\s+/g,' ') };
  activateTab('tx'); await w(600);
  o.trackNote=(document.getElementById('txMonthNote')||{innerText:''}).innerText.replace(/\s+/g,' ');
  o.trackBack=!!document.getElementById('txBack');
  o.trackSum=(document.getElementById('txSummary')||{innerText:''}).innerText.replace(/\s+/g,' ');
  /* the one tap home, from the tab with no month control */
  document.getElementById('txBack').click(); await w(550);
  o.home=state.activeMonth;
  o.noteGone=(document.getElementById('txMonthNote')||{innerText:''}).innerText.trim()==='';
  return o;
});
check('walking the plan forward moves the whole app, which is the design',
      mh.moved>mh.now, mh.moved);
check('...and every screen it moved says so, rather than rendering a blank',
      /planning ahead/i.test(mh.planLabel) && /has not happened yet/.test(mh.trackNote),
      mh.planLabel+' | '+mh.trackNote.slice(0,90));
check('...so an empty Track reads as "not yet", not as "you have logged nothing"',
      /Income \$0/.test(mh.trackSum) && mh.trackNote.length>0, mh.trackSum.slice(0,80));
check('...with one tap home from the tab that has no month control at all',
      mh.trackBack===true && mh.home===mh.now, mh.home);
check('...and the sign goes away when there is nothing left to explain', mh.noteGone===true);

/* the reported fault itself: it must not survive to the next day */
await p.evaluate(m => { state.activeMonth=m; save(); },
                 (()=>{let [y,mm]=MHM.split('-').map(Number); mm++; if(mm>12){mm=1;y++;} return `${y}-${String(mm).padStart(2,'0')}`;})());
await p.reload(); await p.waitForTimeout(900);
const mhBack = await p.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(600);
  const o={ opened:state.activeMonth, now:thisMonth(),
    stored:JSON.parse(localStorage.getItem('unfiltered_budget_v2')).activeMonth,
    sum:(document.getElementById('txSummary')||{innerText:''}).innerText.replace(/\s+/g,' ') };
  /* a PAST month is somewhere a person may genuinely be working, so it is kept -
     it just has to say so, which is the half that was actually missing */
  state.activeMonth=shiftMonth(thisMonth(),-1); save();
  renderTx(); await w(400);
  o.pastNote=(document.getElementById('txMonthNote')||{innerText:''}).innerText.replace(/\s+/g,' ');
  return o;
});
check('the app never OPENS in a month that has not happened',
      mhBack.opened===mhBack.now && mhBack.stored===mhBack.now,
      mhBack.opened+' stored='+mhBack.stored);
check('...so Track opens on real figures rather than an empty next month',
      /\$3,200/.test(mhBack.sum), mhBack.sum.slice(0,80));
check('a finished month is kept, and named, rather than snapped away from',
      /already finished/.test(mhBack.pastNote), mhBack.pastNote.slice(0,140));

/* ---- 103. the category arrived, the money did not ----
   "Passphrase worked but it still did not load Sam's Club into the budget."
   categories merge item by item, so the category always came across. budgets is
   {month:{category:amount}} and was merged whole, so the moment both partners
   assigned in the same month one of them lost every assignment they had made.
   An empty category is indistinguishable from a missing one, which is why this
   was reported four times as a transport failure. */
const cell = await p.evaluate(() => {
  const S=(t,by)=>({t,by,d:by});
  const base=()=>({graveyard:[],changelog:[],settingsM:{},cellM:{},categories:[]});
  const his=Object.assign(base(),{deviceId:'him',
    categories:[{id:'c1',name:'Groceries',_m:S(100,'him')},{id:'c9',name:"Sam's Club",_m:S(500,'him')}],
    budgets:{'2026-09':{c1:400,c9:50}},
    cellM:{'budgets|2026-09|c1':S(100,'him'),'budgets|2026-09|c9':S(500,'him')}});
  const hers=Object.assign(base(),{deviceId:'her',
    categories:[{id:'c1',name:'Groceries',_m:S(100,'him')}],
    budgets:{'2026-09':{c1:420}}, cellM:{'budgets|2026-09|c1':S(900,'her')}});
  const m=mergeVault(hers,his), m2=mergeVault(his,hers);
  const cleared=mergeVault(Object.assign(base(),{deviceId:'her',budgets:{'2026-09':{}},
    cellM:{'budgets|2026-09|c9':S(900,'her')}}), his);
  const old=mergeVault(Object.assign(base(),{deviceId:'her'}),
    Object.assign(base(),{deviceId:'him',budgets:{'2026-07':{c1:300}}}));
  const op=mergeVault(Object.assign(base(),{deviceId:'her',opening:{'2026-08':300},cellM:{'opening|2026-08':S(400,'her')}}),
    Object.assign(base(),{deviceId:'him',opening:{'2026-09':1200},cellM:{'opening|2026-09':S(500,'him')}}));
  return { got:(m.categories||[]).some(c=>c.name==="Sam's Club"),
    money:m.budgets['2026-09'].c9, hers:m.budgets['2026-09'].c1,
    sym:m2.budgets['2026-09'].c9===50 && m2.budgets['2026-09'].c1===420,
    cleared:(cleared.budgets['2026-09']||{}).c9,
    old:(old.budgets['2026-07']||{}).c1,
    op:op.opening['2026-09']===1200 && op.opening['2026-08']===300 };
});
check('the category itself reaches the other phone', cell.got===true, cell.got);
check("...and it arrives with its money, not empty", cell.money===50, 'assigned='+cell.money);
check('the other partner\'s newer figure is not trampled to deliver it', cell.hers===420, cell.hers);
check('both phones land on the same numbers whichever one merges', cell.sym===true, cell.sym);
check('taking an assignment back beats a stale copy of it', !cell.cleared, cell.cleared);
check('a budget made before syncing existed still travels', cell.old===300, cell.old);
check('carried-in opening balances merge per month too', cell.op===true, cell.op);

console.log('STRUCTURE - one place to reflect, and nothing shown before it means something\n');
let fails=0;
for(const r of results){ if(!r.ok) fails++; console.log(`${r.ok?'ok  ':'FAIL'}  ${r.name}${r.detail?'\n        '+String(r.detail).replace(/\n/g,' ').slice(0,140):''}`); }
console.log(`\n${results.length-fails} of ${results.length} hold`);
console.log('page errors:', errs.length?errs:'none');
await b.close();
if(fails) process.exit(1);
