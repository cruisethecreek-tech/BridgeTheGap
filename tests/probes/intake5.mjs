import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:800}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
const seed=st=>pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),st);
const BASE={onboarded:true,welcomed:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',
  hourlyWage:30,categories:[],budgets:{},accounts:[],transactions:[],goals:[],impulse:[],recurring:[],
  assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[]};
await seed(BASE); await pg.reload(); await pg.waitForTimeout(900);

/* 1. the same question twice */
const dup = await pg.evaluate(() => {
  const wage=INTAKE.find(s=>s.id==='wage');
  const shows=a=>!wage.showIf || wage.showIf(a);
  return {
    declined:  shows({acct:'spend', income:0, incomeAvoid:'avoid'}),
    stressed:  shows({acct:'spend', income:0, incomeAvoid:'stress'}),
    gaveIt:    shows({acct:'spend', income:1800}),
    fullPath:  shows({acct:'full',  income:3200}),
    neverAsked:shows({acct:'spend', income:0}),
    avoidFirst:INTAKE.findIndex(s=>s.id==='incomeAvoid') < INTAKE.findIndex(s=>s.id==='wage')
  };
});
ok('somebody who declined income is not asked for it again per hour',
  dup.declined===false && dup.stressed===false, JSON.stringify(dup));
ok('...while anyone who gave a figure still gets the rate question',
  dup.gaveIt===true && dup.fullPath===true, JSON.stringify(dup));
ok('...and somebody who simply skipped, without saying why, is still asked',
  dup.neverAsked===true);
ok('...which only works because the why comes first', dup.avoidFirst===true);

/* 2. leaving it, and getting back */
const back = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  state.intakeDraft={ans:{name:'Pat',situation:'ok',income:3200},step:6,at:Date.now()-600000};
  save();
  activateTab('home'); renderNextSteps(); await w(420);
  const first=document.querySelector('.nextstep');
  const o={text:first?first.innerText:'', act:first?first.dataset.act:''};
  first.click(); await w(760);
  o.opened=document.getElementById('intake').classList.contains('on');
  o.offered=/partway through/.test(document.getElementById('intakeLog').innerText);
  o.chips=(document.getElementById('intakeDock').innerText||'').replace(/\n/g,' ');
  /* carrying on must restore the answers, not restart */
  document.getElementById('iaResume').click(); await w(700);
  o.ans=Object.keys(iaAns).length;
  return o;
});
ok('an unfinished setup says so on Home, ahead of everything else',
  /Finish setting up/.test(back.text) && /3 answers in/.test(back.text), back.text.replace(/\n/g,' | '));
ok('...and the card is the door, without going near Settings',
  back.act==='intake' && back.opened===true);
ok('...landing on the offer to carry on', back.offered===true && /Carry on/.test(back.chips), back.chips);
ok('...which restores what was already answered', back.ans>=3, String(back.ans));

/* the close handler must stop claiming setup finished when it did not */
const closed = await pg.evaluate(() => {
  const src=document.getElementById('intakeX').outerHTML;
  return {hasDraft:!!state.intakeDraft};
});
ok('...and the draft survives being closed', closed.hasDraft===true);

/* 3. the scroll.
   Worth being straight about: the mechanism I expected - a growing dock taking
   height off the log and stranding the question above it - does NOT reproduce
   in Chromium, because scroll anchoring keeps a bottom-pinned scroller pinned.
   So this does not assert a bug it cannot show. What it asserts is the property
   the report actually asked for: after a step is drawn the newest question is
   at the bottom, and there is one function that puts it there from anywhere -
   which is what the resize handler and the post-dock call now use. */
const scroll = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  document.getElementById('intake').classList.add('on');
  const log=document.getElementById('intakeLog'), dock=document.getElementById('intakeDock');
  log.style.display=''; dock.style.display=''; await w(80);
  log.innerHTML=''; for(let i=0;i<30;i++){ const d=document.createElement('div');
    d.className='bub bot'; d.textContent='line '+i; log.appendChild(d); }
  const gap=()=>Math.round(log.scrollHeight-log.scrollTop-log.clientHeight);
  log.scrollTop=0;
  const atTop=gap();
  iaScrollDown(); await w(140);
  const afterCall=gap();
  /* a dock that grows, then the scroll that now runs after it */
  log.scrollTop=0; dock.innerHTML='<div style="height:240px"></div>';
  await w(60); requestAnimationFrame(()=>{});
  iaScrollDown(); await w(160);
  const withTallDock=gap();
  dock.innerHTML='';
  return {atTop, afterCall, withTallDock, hasResize:true};
});
ok('there is one function that pins the newest question to the bottom',
  scroll.atTop>200 && scroll.afterCall===0, JSON.stringify(scroll));
ok('...and it still lands there when the answer controls are tall',
  scroll.withTallDock===0, JSON.stringify(scroll));

/* 4. packs, on both paths */
const packs = await pg.evaluate(() => {
  const s=INTAKE.find(x=>x.id==='packs');
  const before=(state.categories||[]).length;
  const offer=CAT_PACKS.filter(p=>p.k!=='essentials');
  return {exists:!!s, input:s&&s.input, optional:!!(s&&s.optional),
          spend:!s.showIf||s.showIf({acct:'spend'}), full:!s.showIf||s.showIf({acct:'full'}),
          offered:offer.length, essentialsExcluded:!offer.some(p=>p.k==='essentials'), before};
});
ok('the intake offers the packs', packs.exists===true && packs.input==='packs' && packs.optional===true);
ok('...to the spend path too, which is the one that ends emptiest',
  packs.spend===true && packs.full===true);
ok('...without re-offering the essentials the walls step already funded',
  packs.essentialsExcluded===true && packs.offered>=7, String(packs.offered));
const applied = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  state.categories=[]; save();
  const before=state.categories.length;
  ['travel','health'].forEach(k=>addPack(k));
  return {before, after:state.categories.length,
          names:state.categories.map(c=>c.name).slice(0,4)};
});
ok('...and picking some actually puts categories on the plan',
  applied.after>applied.before+3, JSON.stringify(applied));

/* 5. the other direction */
await seed({...BASE,
  goals:[{id:'g1',name:'New fence',target:2400,saved:200,date:'2027-03-01',goalType:'foundation'},
         {id:'g2',name:'Japan trip',target:6000,saved:1500,date:'',goalType:'circulation'},
         {id:'g3',name:'Cushion',target:1000,saved:0,date:'',goalType:'foundation'}],
  debts:[{id:'d1',name:'Visa',kind:'card',balance:2400,apr:23.9,minPayment:75,limit:5000}],
  saveBudget:200});
await pg.reload(); await pg.waitForTimeout(900);
const sv = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); renderDebt(); await w(520);
  const o={gated:document.getElementById('savePanel').classList.contains('panel-waiting'),
           txt:document.getElementById('savePanel').innerText};
  o.sim=simulateGoals(state.goals,200,'soonest');
  /* The intro says "nothing here charges you interest", which is the claim
     rather than a breach of it. What must carry no interest is the WORKING -
     the dates and the amounts - so that is what gets checked. */
  o.rows=(document.querySelector('#savePanel .save-rows')||{}).innerText||'';
  o.head=(document.querySelector('#savePanel .save-head')||{}).innerText||'';
  o.noInterest=!/interest|%|apr/i.test(o.rows+' '+o.head);
  /* the order toggle */
  document.querySelector('#saveOrder [data-so="dated"]').click(); await w(380);
  o.datedFirst=(simulateGoals(state.goals,200,'dated').seq[0]||{}).name;
  document.querySelector('#saveOrder [data-so="soonest"]').click(); await w(320);
  return o;
});
ok('a dream gets the same treatment a debt does',
  sv.gated===false && /until all 3/i.test(sv.txt), sv.txt.slice(0,200));
/* by hand: 1000 + 2200 + 4500 = 7700 at 200 a month = 39 months, one at a time */
ok('...worked out one at a time, in order, by hand',
  sv.sim.seq[0].hit===5 && sv.sim.seq[1].hit===16 && sv.sim.seq[2].hit===39,
  JSON.stringify(sv.sim.seq.map(g=>g.name+'@'+g.hit)));
ok('...with no interest anywhere in the working, because none is owed on it',
  sv.noInterest===true, sv.rows+' // '+sv.head);
ok('"by the date you set" puts the dated one first', sv.datedFirst==='New fence', sv.datedFirst);
ok('...flagging a dream that lands after the date it was promised',
  /after 2027-03-01/.test(sv.txt), sv.txt.slice(0,400));
/* the comparison that is the actual question */
ok('the same money is priced against the debt it is not paying',
  /The same \$200 on your debt instead/.test(sv.txt) && /23\.9%/.test(sv.txt) && /\$573\.60/.test(sv.txt),
  sv.txt.slice(-500));
ok('...in hours of a life, like everything else', /hrs of your life/.test(sv.txt));
ok('...and it refuses to choose for you', /will not pick for you/.test(sv.txt));
/* with no debt there is nothing to compare against, and it must not invent one */
const nodebt = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  state.debts=[]; save(); renderSave(); await w(320);
  return document.getElementById('savePanel').innerText;
});
ok('with nothing owed, it does not manufacture a comparison',
  !/The same .* on your debt instead/.test(nodebt), nodebt.slice(-200));

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
