import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',hourlyWage:30,
  categories:[{id:'c1',name:'Food'}],budgets:{'2026-08':{c1:400}},
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:3000,updated:'2026-08-01'}],
  transactions:[],goals:[],impulse:[],recurring:[],
  assets:[{id:'as1',name:'Rental',value:120000,kind:'real'},{id:'as2',name:'Car',value:9000,kind:'stuff',cost:200}],
  liabilities:[{id:'l1',name:'Card',value:800,apr:22}],diary:[],lessons:[],debts:[],vault:[],snapshots:[],
  intake:{why:'I just want to feel like I am working for something',
          reflections:{situation:'survive',moneyStory:'chaos',moneyStoryNote:'It came and went'}}});
await pg.reload(); await pg.waitForTimeout(900);

/* 1. arriving somewhere on purpose */
const a = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  activateTab('home'); await w(400);
  const gut=[...document.querySelectorAll('#view-home [data-arrive]')].find(b=>/gut check/i.test(b.textContent));
  o.gutIsArrival=!!gut;
  gut.click(); await w(500);
  o.tab=currentTab;
  const ar=document.querySelector('#view-impulse .arrival');
  o.note=ar?ar.innerText:'';
  o.saysWhatItIs=/hours of your life/.test(o.note) && /never blocks/.test(o.note);
  o.hasAction=!!(ar&&ar.querySelector('[data-arrun]'));
  /* leaving drops it - a reason is not a preference */
  activateTab('budget'); await w(360);
  o.goneOnLeave=!document.querySelector('.arrival');
  activateTab('impulse'); await w(360);
  o.stillGone=!document.querySelector('.arrival');
  return o;
});
ok('"Run a gut check" is an arrival, not a bare tab switch', a.gutIsArrival===true);
ok('...it lands on Shield', a.tab==='impulse', a.tab);
ok('...and Shield now says what a gut check actually is', a.saysWhatItIs===true, a.note.slice(0,200));
ok('...with the thing you came for one tap away', a.hasAction===true);
ok('leaving drops the reason, because a reason is not a preference',
  a.goneOnLeave===true && a.stillGone===true);

/* 2. Secure the bag */
const bag = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('home'); await w(400);
  const cta=document.getElementById('hhCta');
  const o={key:cta.getAttribute('data-arrive'), noGoto:!cta.getAttribute('data-goto')};
  cta.click(); await w(500);
  o.tab=currentTab;
  const ar=document.querySelector('#view-budget .arrival');
  o.note=ar?ar.innerText:'';
  return o;
});
ok('the hero CTA is an arrival too, with the old bare goto removed',
  !!bag.key && bag.noGoto===true, JSON.stringify(bag));
ok('...landing on Plan with "securing the bag" defined in this app\'s terms',
  bag.tab==='budget' && /every dollar/.test(bag.note) && /a job/.test(bag.note), bag.note.slice(0,180));

/* 3. the money story lands in the Diary and holds the intake answers */
const st = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  arrive('moneystory'); await w(560);
  const o={tab:currentTab};
  const body=document.getElementById('storyBody');
  o.text=body?body.innerText:'';
  o.hasWhy=/working for something/.test(o.text);
  o.hasStory=/Feast or famine/.test(o.text);
  o.hasNote=/It came and went/.test(o.text);
  o.prompts=document.querySelectorAll('[data-storywrite]').length;
  /* the prompt seeds the box rather than replacing what is in it */
  const t=document.getElementById('diaryText'); t.value='half an entry';
  document.querySelector('[data-storywrite="moneyStory"]').click(); await w(260);
  o.kept=/half an entry/.test(t.value) && t.value.length>'half an entry'.length;
  return o;
});
ok('"See my money story" lands in the Diary, not on Home', st.tab==='diary', st.tab);
ok('...holding the intake answers it is talking about, in the person\'s own words',
  st.hasWhy && st.hasStory && st.hasNote, st.text.slice(0,240));
ok('...with a prompt on each, encouraging an entry', st.prompts===3, String(st.prompts));
ok('...seeding the box rather than wiping what is half-written in it', st.kept===true);

/* 4. stage vs survival */
const sv = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('home'); renderNextSteps(); await w(420);
  const o={};
  o.stillSurvival=/survival mode this is the whole game/.test(document.getElementById('nextSteps').innerText);
  o.note=(document.querySelector('.ns-outgrown')||{}).innerText||'';
  o.stored=state.intake.reflections.situation;
  return o;
});
ok('a stage-3 person with real assets is no longer told they are in survival mode',
  sv.stillSurvival===false);
ok('...and the contradiction is named out loud rather than switched quietly',
  /told me at setup/.test(sv.note) && /stage 3/.test(sv.note), sv.note.slice(0,200));
ok('...without overwriting their own answer, which is theirs', sv.stored==='survive');

/* someone genuinely in survival keeps the survival voice */
const still = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  /* genuinely in survival: nothing owned, one category budgeted, walls bare -
     the runway that reads as 7.5 months is an artefact of that empty budget */
  state.assets=[]; state.liabilities=[]; state.stageReached=1; state.uiMode='auto'; save();
  activateTab('home'); renderNextSteps(); await w(420);
  return {txt:document.getElementById('nextSteps').innerText,
          note:!!document.querySelector('.ns-outgrown')};
});
ok('someone actually in survival still gets the survival voice',
  /survival mode this is the whole game/.test(still.txt) && still.note===false, still.txt.slice(0,160));

/* 5. tripwires, and the sovereignty note */
const tw = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  state.uiMode='all'; save();
  activateTab('impulse'); await w(500);
  const body=document.getElementById('tripwireBody');
  return {filled:body.children.length>0,
          buttons:body.querySelectorAll('button').length,
          seeds:body.querySelectorAll('[data-twseed]').length,
          add:!!document.getElementById('twAdd')};
});
ok('Tripwires draws from a cold boot now, instead of only after a sync pull',
  tw.filled===true, JSON.stringify(tw));
ok('...with something to actually press', tw.buttons>=3 && tw.seeds>0 && tw.add===true, JSON.stringify(tw));

const sov = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  state.assets=[{id:'as1',name:'Rental',value:120000,kind:'real'},{id:'as2',name:'Car',value:9000,kind:'stuff',cost:200}];
  state.liabilities=[{id:'l1',name:'Card',value:800,apr:22}]; save();
  activateTab('goals'); await w(400);
  /* The audit lives in a closed accordion, and innerText reads '' for anything
     not rendered - so a note that was there looked absent. Open the drawer. */
  const det=document.getElementById('sovAudit').closest('details'); if(det) det.open=true;
  renderSovereignty(); await w(460);
  const o={asks:document.querySelectorAll('#sovAudit [data-why="sovAudit"]').length};
  document.querySelector('#sovAudit [data-why="sovAudit"]').click(); await w(420);
  o.where=document.querySelectorAll('.why-note').length;
  o.note=[...document.querySelectorAll('.why-note')].map(x=>x.innerText).join(' ');
  return o;
});
ok('every sovereignty figure carries a way to ask where it came from', sov.asks===4, String(sov.asks));
ok('...and the answer names the panel that feeds it', /Assets vs Liabilities/.test(sov.note), sov.note.slice(0,200));
ok('...shows the arithmetic on their own numbers', /\$120,000/.test(sov.note) && /93%/.test(sov.note), sov.note.slice(0,400));
ok('...and says what would actually change it', /What moves it/.test(sov.note), sov.note.slice(-260));

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
