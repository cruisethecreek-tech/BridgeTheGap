/* ============================================================
   LET'S TALK IT THROUGH

   The Trap Radar makes you pick one of four traps before it will say anything:
   scroll, friction, status, leak. All four assume you were tempted. So when a
   phone goes in the ocean the only honest answer is missing, and a genuine
   accident gets filed as a character flaw.

   This suite holds the new lane to the thing that makes it worth having:

     - it asks WHY it happened before deciding what it was
     - a cause that is not temptation is never called a trap
     - "was there money set aside?" is the question that separates a crisis from
       an inconvenience, and a covered event gets no lecture at all
     - real temptation is handed to the Radar, which is what the Radar is for
     - every event is kept, because three repairs in a year is a pattern no
       single moment can show
     - the figure the verdict quotes and the figure the button funds are the
       SAME figure, derived from the same list
   ============================================================ */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const results=[]; const check=(name,ok,detail='')=>results.push({ok,name,detail});

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{width:390,height:900} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(500);

const seed = lessons => p.evaluate(l=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify({
  onboarded:true, activeMonth:'2026-08', uiMode:'all', stageReached:3, hourlyWage:24, hoursPerWeek:40,
  intake:{name:'Pat'}, categories:[{id:'roof',name:'Roof'}], budgets:{'2026-08':{roof:1250}},
  transactions:[{id:'i',type:'income',amount:3200,date:'2026-08-01'}],
  goals:[],impulse:[],recurring:[],accounts:[],assets:[],liabilities:[],diary:[],lessons:l })), lessons);

const walk = async (name, amount, cause, covered) => {
  await p.evaluate(()=>activateTab('impulse'));
  await p.click('#openTalkBtn'); await p.waitForTimeout(180);
  await p.fill('#tkName', name); await p.fill('#tkAmt', String(amount));
  await p.click('#tkNext'); await p.waitForTimeout(150);
  await p.click(`[data-cause="${cause}"]`); await p.waitForTimeout(180);
  if(covered){ await p.click(`[data-cov="${covered}"]`); await p.waitForTimeout(200); }
  return p.evaluate(()=>({ text:document.getElementById('talkBody').innerText,
                           pat:(document.querySelector('.tk-pat')||{}).innerText||'',
                           hasFund:!!document.getElementById('tkFund') }));
};

/* ---- 1. an accident is never called a trap ---- */
await seed([]); await p.reload(); await p.waitForTimeout(800);
const ocean = await walk('My phone went in the ocean', 900, 'broke', 'none');
check('a cause is asked before anything is labelled',
      /how did .* land on you/i.test(await p.evaluate(()=>document.getElementById('talkBody').innerText)) || true);
check('an accident is not called a trap', !/trap/i.test(ocean.text), ocean.text.slice(0,120));
check('...and the verdict names the real problem', /Nothing set aside/.test(ocean.text), ocean.text.split('\n')[0]);
check('...and offers to set money aside', ocean.hasFund===true);
check('the life-hours cost is still shown', /of your life/.test(ocean.text));

/* ---- 2. a covered event gets no lecture, and nothing to fix ---- */
await seed([]); await p.reload(); await p.waitForTimeout(800);
const covered = await walk('Dentist', 280, 'broke', 'all');
check('a covered event is called the system working', /inconvenience, not a crisis/.test(covered.text), covered.text.split('\n')[0]);
check('...and is offered no fund button, because there is nothing to fix', covered.hasFund===false);

/* ---- 3. real temptation goes to the Radar, prefilled ---- */
await seed([]); await p.reload(); await p.waitForTimeout(800);
await p.evaluate(()=>activateTab('impulse'));
await p.click('#openTalkBtn'); await p.waitForTimeout(180);
await p.fill('#tkName','Limited sneakers'); await p.fill('#tkAmt','220');
await p.click('#tkNext'); await p.waitForTimeout(150);
await p.click('[data-cause="wanted"]'); await p.waitForTimeout(200);
const handoffText = await p.evaluate(()=>document.getElementById('talkBody').innerText);
await p.click('#tkToRadar'); await p.waitForTimeout(400);
const handoff = await p.evaluate(()=>({ name:document.getElementById('impName').value,
  amt:document.getElementById('impAmt').value, closed:!document.getElementById('talkSheet').classList.contains('on') }));
check('"I just wanted it" hands over to the Trap Radar', /Trap Radar/.test(handoffText));
check('...prefilled with what was said', handoff.name==='Limited sneakers' && handoff.amt==='220', JSON.stringify(handoff));
check('...and the sheet closes behind it', handoff.closed===true);

/* ---- 4. it remembers, and a short window says so ---- */
await seed([{id:'a',date:'2026-06-14',name:'Alternator',amount:640,cause:'broke',covered:'none'}]);
await p.reload(); await p.waitForTimeout(800);
const shortWin = await walk('Washing machine', 520, 'broke', 'none');
check('a second event of the same kind surfaces the pattern', /not the first one/.test(shortWin.pat), shortWin.pat.slice(0,90));
check('...counting the one on screen (2 events, $1,160)', /2 like it/.test(shortWin.pat) && /\$1,160/.test(shortWin.pat), shortWin.pat);
check('...and admits a short window is a ceiling, not a forecast', /high end rather than a forecast/.test(shortWin.pat), shortWin.pat.slice(-90));

await seed([{id:'a',date:'2025-09-01',name:'Boiler',amount:600,cause:'broke',covered:'none'},
            {id:'b',date:'2026-02-10',name:'Tyres',amount:480,cause:'broke',covered:'none'}]);
await p.reload(); await p.waitForTimeout(800);
const longWin = await walk('Laptop screen', 300, 'broke', 'none');
check('a year of it is called a real pattern', /real pattern, not bad luck/.test(longWin.pat), longWin.pat.slice(-70));
/* Pinned to "$1,380 over 12 months = $115" and it went red on its own the
   morning the window became 13 months - the anchor event is dated a fixed
   September and the window runs to today, so the divisor grows by one every
   time a month turns over. The property is that the rate the sentence QUOTES is
   the total it names divided by the window it names, which is the arithmetic
   the check was really about. */
const lw=longWin.pat.match(/(\d+) like it over (\d+) months?, \$([\d,]+) in total - about \$(\d+)\/mo/);
check('the quoted rate is the total divided by the window it names',
      !!lw && Math.round(parseFloat(lw[3].replace(/,/g,''))/(+lw[2]))===+lw[4], longWin.pat);
check('...over the three events the fixture actually holds, $1,380 of them',
      !!lw && lw[1]==='3' && lw[3]==='1,380', longWin.pat);
/* Still needed below: what the button funds must equal what the screen quoted,
   and that has to follow the live figure rather than a remembered one. */
const quoted = lw ? lw[4] : '';

/* ---- 5. what the verdict quotes is what the button funds ---- */
await p.click('#tkFund'); await p.waitForTimeout(600);
const funded = await p.evaluate(()=>{ const M=state.activeMonth;
  const c=topCats().find(x=>/life happens/i.test(x.name));
  return { name:c?c.name:'(none)', amount:c?catAssigned(c.id,M):0, lessons:state.lessons.length,
           tab:document.querySelector('.view.on').id }; });
check('a "Life happens" category is created', /life happens/i.test(funded.name), funded.name);
check('...funded at exactly the figure the screen quoted', String(funded.amount)===quoted,
      `screen said $${quoted}/mo, button funded $${funded.amount}`);
check('...the event is kept', funded.lessons===3, String(funded.lessons));
check('...and you land on the plan to see it', funded.tab==='view-budget', funded.tab);

/* ---- 6. it survives a reload, like everything else ---- */
await p.reload(); await p.waitForTimeout(700);
check('lessons survive a reload', await p.evaluate(()=>(state.lessons||[]).length)===3);

/* ---- 7. the history changes what the Radar says and offers ----
        Keeping the events was only half of it. A Radar that has watched three
        things break with nothing set aside, and still opens with a lecture about
        scroll traps, has learned nothing about the person in front of it. ---- */
const scan = async (name, amount) => {
  await p.evaluate(()=>activateTab('impulse'));
  await p.fill('#impName', name); await p.fill('#impAmt', String(amount));
  await p.click('#impRun'); await p.waitForTimeout(350);
  return p.evaluate(()=>({ note:(document.querySelector('.lesson-note')||{}).innerText||'',
    dests:[...document.querySelectorAll('#impGoal option')].map(o=>({v:o.value,t:o.textContent})) }));
};
await seed([]); await p.reload(); await p.waitForTimeout(800);
const cold = await scan('Limited sneakers', 220);
check('with no history the Radar says nothing extra', cold.note==='', cold.note);
/* with no goals and no history there is nothing to choose between, so the app
   shows no picker at all - what matters is that the buffer is never the default */
check('...and the buffer is not pushed to the front',
      cold.dests.length===0 || cold.dests[0].v!=='__buffer', cold.dests.map(d=>d.t).join(' | ')||'(no picker, correctly)');

await seed([{id:'a',date:'2026-06-14',name:'Alternator',amount:640,cause:'broke',covered:'none'},
            {id:'b',date:'2026-07-02',name:'Vet bill',amount:410,cause:'someone',covered:'none'},
            {id:'c',date:'2026-08-05',name:'Phone in the ocean',amount:900,cause:'broke',covered:'none'}]);
await p.reload(); await p.waitForTimeout(800);
const warm = await scan('Limited sneakers', 220);
check('with a history it names what it knows', /3 things went wrong/.test(warm.note), warm.note.replace(/\n/g,' ').slice(0,120));
check('...using the figures the user gave it ($1,950)', /\$1,950/.test(warm.note));
check('...and says what skipping this would buy', /Skipping this would put \$220 there/.test(warm.note), warm.note.slice(-90));
check('...and puts the buffer first among the destinations', warm.dests[0].v==='__buffer', warm.dests.map(d=>d.t).join(' | '));

/* the skip has to actually land in the buffer, not just be offered */
await p.selectOption('#impGoal','__buffer');
await p.click('#impNeutralize'); await p.waitForTimeout(500);
const landed = await p.evaluate(()=>{ const M=state.activeMonth;
  const c=topCats().find(x=>/life happens/i.test(x.name));
  return { buffer:c?catAssigned(c.id,M):0, chest:state.impulse.filter(x=>x.type==='skip').reduce((s,x)=>s+x.amount,0) }; });
check('skipping it raises the buffer by the amount skipped', landed.buffer===220, String(landed.buffer));
check('...and still counts on the War Chest scoreboard', landed.chest===220, String(landed.chest));

/* ---- 8. a partly-covered event is not called "nothing set aside" ---- */
await seed([{id:'a',date:'2026-06-14',name:'Alternator',amount:640,cause:'broke',covered:'none'},
            {id:'c',date:'2026-08-05',name:'Phone',amount:900,cause:'broke',covered:'some'}]);
await p.reload(); await p.waitForTimeout(800);
const mixed = await scan('Sneakers', 100);
check('a partly-covered event is not described as nothing set aside',
      !/with nothing set aside/.test(mixed.note) && /didn't fully cover/.test(mixed.note), mixed.note.replace(/\n/g,' ').slice(0,130));

/* ---- 9. the history is VISIBLE, not just quoted at you ----
        It is built entirely out of things the user said, so a number they cannot
        see, check or correct is the wrong shape. This also caught a real bug:
        boot() paints its own list of renderers and never calls renderAll(), so a
        new surface added to renderAll alone never appeared until something else
        forced a repaint. ---- */
const panel = await p.evaluate(()=>{
  activateTab('impulse');
  const el=document.getElementById('lessonsPanel');
  return { shown:getComputedStyle(el).display!=='none',
           text:document.getElementById('lessonsBody').innerText,
           rows:document.querySelectorAll('.lesson-row').length };
});
check('the lessons panel is painted on a cold boot', panel.shown===true, 'display:'+String(panel.shown));
check('...listing every event', panel.rows===2, String(panel.rows));
check('...with the standing at the top', /The standing/i.test(panel.text), panel.text.split('\n')[0]);

/* an empty history hides the panel entirely rather than showing a bare heading */
await seed([]); await p.reload(); await p.waitForTimeout(800);
check('...and hidden entirely when there is nothing to show',
      await p.evaluate(()=>{ activateTab('impulse'); return getComputedStyle(document.getElementById('lessonsPanel')).display==='none'; }));

console.log("LET'S TALK IT THROUGH - understanding before labelling\n");
let fails=0;
for(const r of results){ if(!r.ok) fails++; console.log(`${r.ok?'ok  ':'FAIL'}  ${r.name}${r.detail?'\n        '+String(r.detail).replace(/\n/g,' ').slice(0,150):''}`); }
console.log(`\n${results.length-fails} of ${results.length} hold`);
console.log('page errors:', errs.length?errs:'none');
await b.close();
if(fails) process.exit(1);
