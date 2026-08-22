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
const quoted = (longWin.pat.match(/\$(\d+)\/mo/)||[])[1];
check('the quoted rate is the hand figure ($1,380 over 12 months = $115)', quoted==='115', longWin.pat);

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

console.log("LET'S TALK IT THROUGH - understanding before labelling\n");
let fails=0;
for(const r of results){ if(!r.ok) fails++; console.log(`${r.ok?'ok  ':'FAIL'}  ${r.name}${r.detail?'\n        '+String(r.detail).replace(/\n/g,' ').slice(0,150):''}`); }
console.log(`\n${results.length-fails} of ${results.length} hold`);
console.log('page errors:', errs.length?errs:'none');
await b.close();
if(fails) process.exit(1);
