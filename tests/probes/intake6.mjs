/* Two faults from one real walk through the intake, on the spending path.
   1. "She chose bi weekly but it didn't ask her how many hours she worked."
   2. "There was no drop down that told her what was in each category. She chose
      all of them then found herself deleting everything inside of it." */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:1200}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(()=>localStorage.clear());
await pg.reload(); await pg.waitForTimeout(900);

/* ---- 1. every pay cadence asks the hours, not just the hourly one ---- */
const hours = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const out={};
  const run=async(freqLabel)=>{
    iaAns={acct:'spend', name:'Pat'};
    const step=INTAKE.find(s=>s.id==='income');
    document.getElementById('intakeLog').innerHTML='';
    runPayHelper(step); await w(250);
    const chip=[...document.querySelectorAll('#intakeDock button[data-pf]')].find(x=>x.textContent.trim()===freqLabel);
    if(!chip) return {noChip:true};
    chip.click(); await w(250);
    const inp=document.getElementById('iaHelpInput'); inp.value='1680';
    document.getElementById('iaHelpGo').click(); await w(300);
    const ask=(document.getElementById('intakeLog').lastElementChild||{}).innerText||'';
    const o={ asked:/how many hours a week/i.test(ask), ask,
              canSkip:!!document.getElementById('iaHelpSkip'),
              skipLabel:(document.getElementById('iaHelpSkip')||{}).textContent||'' };
    return o;
  };
  out.biweekly=await run('Every 2 weeks');
  out.weekly=await run('Every week');
  out.monthly=await run('Once a month');
  out.yearly=await run("I only know the salary");
  out.hourly=await run('By the hour');
  /* and the answer actually reaches state */
  iaAns={acct:'spend'};
  document.getElementById('intakeLog').innerHTML='';
  runPayHelper(INTAKE.find(s=>s.id==='income')); await w(250);
  [...document.querySelectorAll('#intakeDock button[data-pf]')].find(x=>x.textContent.trim()==='Every 2 weeks').click(); await w(250);
  document.getElementById('iaHelpInput').value='1680'; document.getElementById('iaHelpGo').click(); await w(300);
  document.getElementById('iaHelpInput').value='32'; document.getElementById('iaHelpGo').click(); await w(400);
  out.stored=iaAns.hoursPerWeek; out.monthlyFromBiweekly=iaAns.income;
  return out;
});
ok('a biweekly payday is asked how many hours that week actually is',
   hours.biweekly.asked===true, hours.biweekly.ask.slice(0,140));
ok('...and so is every other cadence, which is the half that was missing',
   hours.weekly.asked && hours.monthly.asked && hours.yearly.asked && hours.hourly.asked,
   JSON.stringify({w:hours.weekly.asked,m:hours.monthly.asked,y:hours.yearly.asked,h:hours.hourly.asked}));
ok('...it says why it wants them, since the budget does not need them',
   /hours of your life/i.test(hours.biweekly.ask) && /not about the money/i.test(hours.biweekly.ask),
   hours.biweekly.ask.slice(0,180));
ok('...and admits what it will assume if you decline',
   /I will guess 40/i.test(hours.biweekly.ask), hours.biweekly.ask.slice(-90));
ok('...declining is a real option everywhere the arithmetic does not need it',
   hours.biweekly.canSkip && hours.weekly.canSkip && hours.monthly.canSkip && hours.yearly.canSkip,
   JSON.stringify([hours.biweekly.skipLabel]));
/* the hourly path MUST have them - the monthly figure is derived from them */
ok('...but not on the hourly path, where the month cannot be worked out without them',
   hours.hourly.canSkip===false);
ok('the hours reach the answers, and the money is still converted right',
   hours.stored===32 && Math.abs(hours.monthlyFromBiweekly-1680*26/12)<0.01,
   JSON.stringify([hours.stored,hours.monthlyFromBiweekly]));

/* ---- 2. the packs show what is in them, and can be taken in part ---- */
/* The pay helper ends with a deferred iaAdvance, which lands on whatever the
   dock is showing by then - including this section's render. A reload is the
   only isolation that cannot race it. */
await pg.evaluate(()=>localStorage.clear());
await pg.reload(); await pg.waitForTimeout(900);
const packs = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  iaAns={acct:'spend', packPick:{}};
  document.getElementById('intakeLog').innerHTML='';
  const step=INTAKE.find(s=>s.input==='packs');
  renderPacksStep(step); await w(300);
  const o={};
  const chips=()=>[...document.querySelectorAll('#intakeDock button[data-pk]')];
  o.chipCount=chips().length;
  o.showsCountBeforeTapping=chips().every(c=>/\d/.test(c.textContent));
  o.nothingRevealed=!document.querySelector('.ia-pkopen');
  const first=chips()[0]; const key=first.dataset.pk;
  first.click(); await w(250);
  o.opens=!!document.querySelector('.ia-pkopen');
  o.lists=document.querySelectorAll('.ia-pkc').length;
  o.everyRowSaysWhatItIs=[...document.querySelectorAll('.ia-pkc .pkc-w')].every(e=>e.textContent.trim().length>10);
  o.pack=CAT_PACKS.find(p=>p.k===key).cats.length;
  o.takenAll=(iaAns.packPick[key]||[]).length;
  /* untick two of them */
  const rows=[...document.querySelectorAll('.ia-pkc')];
  rows[0].click(); await w(200);
  rows[1].click(); await w(200);
  o.afterUntick=(iaAns.packPick[key]||[]).length;
  o.doneLabel=document.getElementById('iaPkDone').textContent;
  o.chipShowsPartial=/\d+\/\d+/.test(chips().find(c=>c.dataset.pk===key).textContent);
  /* None empties it entirely, which is the same as not taking the pack */
  document.querySelector('[data-pknone]').click(); await w(250);
  o.afterNone=(iaAns.packs||[]).indexOf(key);
  /* take it back, then commit and see what actually lands on the plan */
  document.querySelector('[data-pkall]').click(); await w(250);
  const rows2=[...document.querySelectorAll('.ia-pkc')];
  rows2[0].click(); await w(200);
  o.commitPick=(iaAns.packPick[key]||[]).slice();
  state=JSON.parse(JSON.stringify(defaultState())); state.onboarded=true;
  (iaAns.packs||[]).forEach(k=>addPack(k,(iaAns.packPick||{})[k]));
  const flat=CAT_PACKS.find(p=>p.k===key).flat;
  o.landed=state.categories.filter(c=>flat?true:c.parentId).length;
  o.droppedOne=!state.categories.some(c=>c.name===rows2[0].querySelector('.pkc-t').textContent.replace(/^[✓+]\s*/,''));
  return o;
});
ok('the packs step shows how many are in each pack before you commit to one',
   packs.showsCountBeforeTapping===true && packs.chipCount>2, String(packs.chipCount));
ok('...and nothing is revealed until you look, so the list is not a wall',
   packs.nothingRevealed===true);
ok('tapping a pack opens it and shows every category inside',
   packs.opens===true && packs.lists===packs.pack, `${packs.lists} of ${packs.pack}`);
ok('...each with the line somebody wrote to explain it',
   packs.everyRowSaysWhatItIs===true);
ok('...opening still takes the whole pack, so one tap is the fast path',
   packs.takenAll===packs.pack, `${packs.takenAll}/${packs.pack}`);
ok('...and now you can put two back, which is the whole request',
   packs.afterUntick===packs.pack-2, String(packs.afterUntick));
ok('...the chip says it is partial, and the button counts categories not packs',
   packs.chipShowsPartial===true && /Add \d+ categor/.test(packs.doneLabel), packs.doneLabel);
ok('...emptying a pack by hand is the same as not taking it', packs.afterNone===-1);
ok('what you ticked is what lands on the plan, not the whole pack',
   packs.landed===packs.pack-1 && packs.droppedOne===true,
   `${packs.landed} landed of ${packs.pack}`);

/* ---- 3. and a mass delete for the plan that already got flooded ---- */
const cull = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const M=thisMonth();
  state=JSON.parse(JSON.stringify(defaultState()));
  state.onboarded=true; state.uiMode='all'; state.stageReached=3; state.guidesOff=true; state.activeMonth=M;
  state.categories=[{id:'g',name:'Lifestyle'},{id:'c1',name:'Streaming',parentId:'g'},
                    {id:'c2',name:'Takeout',parentId:'g'},{id:'keep',name:'Rent'}];
  state.budgets={[M]:{keep:1400,c1:20}};
  state.transactions=[{id:'t1',type:'expense',amount:20,catId:'c1',date:M+'-03'}];
  state.recurring=[{id:'r1',type:'expense',amount:20,catId:'c1',freq:'monthly',anchor:M+'-01',day:1}];
  save(); activateTab('budget'); renderBudget(); await w(500);
  const o={ before:state.categories.length, noBoxesYet:document.querySelectorAll('[data-cull]').length };
  document.getElementById('cullBtn').click(); await w(500);
  o.boxes=document.querySelectorAll('[data-cull]').length;
  o.barPrompt=(document.getElementById('cullBar')||{innerText:''}).innerText;
  const g=document.querySelector('[data-cull="g"]');
  g.checked=true; g.dispatchEvent(new Event('change',{bubbles:true})); await w(350);
  o.barCount=(document.getElementById('cullBar')||{innerText:''}).innerText;
  document.getElementById('cullGo').click(); await w(500);
  o.after=state.categories.map(c=>c.name);
  o.txKept=state.transactions.length;
  o.txOrphaned=state.transactions[0]&&!state.categories.some(c=>c.id===state.transactions[0].catId);
  o.ruleGone=(state.recurring||[]).length;
  o.assignGone=state.budgets[M].c1===undefined;
  o.modeOff=!document.querySelector('[data-cull]');
  return o;
});
ok('a plan you flooded can be pruned in one pass, not one sheet at a time',
   cull.noBoxesYet===0 && cull.boxes===4, `${cull.boxes} tickable`);
ok('...the bar says what will go before anything goes',
   /Nothing is removed until you press/.test(cull.barPrompt), cull.barPrompt.slice(0,90));
ok('...counting the subcategories that ride along, not just what you ticked',
   /3 categories to remove/.test(cull.barCount) && /1 ticked, the rest are inside/.test(cull.barCount),
   cull.barCount.slice(0,160));
ok('...and it warns that logged entries survive as Uncategorized',
   /will stay on Track as Uncategorized/.test(cull.barCount), cull.barCount.slice(0,180));
ok('removing takes the group and everything in it, and leaves the rest',
   cull.after.join(',')==='Rent', cull.after.join(','));
ok('...deleting a category never deletes money', cull.txKept===1 && cull.txOrphaned===true);
ok('...its assignment goes with it', cull.assignGone===true);
/* the hole the single-category delete had too */
ok('...and so does a repeat rule, which would otherwise post into a ghost forever',
   cull.ruleGone===0, String(cull.ruleGone));
ok('...then the mode turns itself off', cull.modeOff===true);

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
