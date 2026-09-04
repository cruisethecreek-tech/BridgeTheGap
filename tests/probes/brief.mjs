import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,220):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
/* Clean is the default now. This probe is about Brief - clipping in place with a
   More - so it asks for that mode rather than assuming the app boots into it. */
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',s), JSON.stringify({
  onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',activeMonth:'2026-08',hourlyWage:30,
  categories:[{id:'c1',name:'Food'}],budgets:{'2026-08':{c1:400}},
  transactions:[{id:'i',type:'income',amount:3000,date:'2026-08-01'},
                {id:'e',type:'expense',amount:120,date:'2026-08-05',catId:'c1'}],
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:2000,updated:'2026-08-01'}],
  goals:[],impulse:[],recurring:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[]}));
await pg.reload(); await pg.waitForTimeout(800);

const look=async(view,openFirst=true)=>pg.evaluate(async([v,openFirst])=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab(v); deckShow(v,null); await w(500);
  /* The long intros live inside sections now. A reader clamping one has it
     open, so open the first and measure the state somebody is actually in -
     except when the question is about the tab AT REST, which is the state you
     land in and the one that was too long in the first place. */
  const first=openFirst?document.querySelector('#deck-'+v+' .dk-chip'):null;
  if(first){ deckShow(v, first.dataset.dk); sayPass(v); await w(340); }
  const root=document.getElementById('view-'+v);
  const subs=[...root.querySelectorAll('.panel .sub, .acc-body .sub')];
  return {
    total:subs.length,
    clamped:subs.filter(x=>x.classList.contains('clampable')).length,
    mores:root.querySelectorAll('.sub-more').length,
    /* the whole point: no word is lost */
    fullTextKept:subs.every(x=>!x.classList.contains('clampable') || x.innerText.length>60),
    tallest:Math.max(0,...subs.filter(x=>x.classList.contains('clampable')).map(x=>Math.round(x.getBoundingClientRect().height))),
    rule:!!root.querySelector('.panel>h2')
  };
}, [view,openFirst]);

/* Home used to be the best example of a screen full of long intros. It is not
   any more, on purpose: everything that was not "where do I stand" or "what do I
   do next" moved into the More card. So Brief gets measured where long intros
   still live. Home gets checked for the opposite now. */
const home=await look('home', false);
ok('Home has no wall of intros left for Brief to clip', home.clamped===0, JSON.stringify(home));
const trk=await look('tx');
ok('long intros are clamped where they still live', trk.clamped>0, JSON.stringify(trk));
ok('...and each clamped one gets exactly one More', trk.mores===trk.clamped, JSON.stringify(trk));
ok('...clipped to about two lines, not eight', trk.tallest>0 && trk.tallest<=46, String(trk.tallest));
ok('...with every word still in the DOM and readable', trk.fullTextKept===true);

const goals=await look('goals');
ok('the accounts panel is clamped too', goals.clamped>0, JSON.stringify(goals));

/* nothing that is already short grows a pointless More */
const shortOnes=await pg.evaluate(()=>{
  const subs=[...document.querySelectorAll('#view-goals .panel .sub, #view-goals .acc-body .sub')];
  return subs.filter(x=>x.dataset.noclamp==='1').every(x=>!(x.nextElementSibling&&x.nextElementSibling.classList.contains('sub-more')));
});
ok('a short intro never grows a More that reveals nothing', shortOnes===true);

/* More opens it, and says so */
const opened=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const btn=document.querySelector('#view-goals .sub-more'); if(!btn) return null;
  const el=btn.previousElementSibling;
  const before=Math.round(el.getBoundingClientRect().height);
  btn.click(); await w(120);
  const after=Math.round(el.getBoundingClientRect().height);
  const label=btn.textContent, aria=btn.getAttribute('aria-expanded');
  btn.click(); await w(120);
  return {before, after, label, aria, backTo:Math.round(el.getBoundingClientRect().height), backLabel:btn.textContent};
});
ok('More opens that one paragraph', opened && opened.after>opened.before, JSON.stringify(opened));
ok('...and says Less once it is open', opened.label==='Less' && opened.aria==='true');
ok('...and closes again', opened.backTo===opened.before && opened.backLabel==='More');

/* a heading you can find */
const rule=await pg.evaluate(()=>{
  const h=document.querySelector('#view-goals .panel>h2, #view-home .panel>h2');
  if(!h) return null;
  const cs=getComputedStyle(h,'::before');
  return {w:cs.width, h:cs.height, bg:cs.backgroundColor};
});
ok('every panel heading carries an accent rule above it',
  rule && parseFloat(rule.w)>=20 && parseFloat(rule.h)>=2, JSON.stringify(rule));

/* Full mode gives it all back */
const full=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('settings'); await w(400);
  document.querySelector('#sayMode button[data-say="full"]').click(); await w(300);
  activateTab('goals'); deckShow('goals','Accounts'); await w(500);
  return {clamped:document.querySelectorAll('#view-goals .sub.clampable').length,
          brief:document.body.classList.contains('say-brief'),
          stored:state.sayMode};
});
ok('Full mode un-clips everything', full.clamped===0 && full.brief===false, JSON.stringify(full));
ok('...and the choice is remembered', full.stored==='full');
const backBrief=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('settings'); await w(350);
  document.querySelector('#sayMode button[data-say="brief"]').click(); await w(300);
  activateTab('goals'); deckShow('goals','Accounts'); await w(500);
  return document.querySelectorAll('#view-goals .sub.clampable').length;
});
ok('...and switching back clamps again', backBrief>0, String(backBrief));
/* Brief is no longer the default - Clean is, and Brief is the middle setting.
   The old assertion was true and is now false: a fact about the app, not a
   check that needed loosening. */
ok('Clean is the default for someone new, with Brief a step up from it',
  await pg.evaluate(()=>{ const s=normalizeState({}); return s.sayMode; })==='clean');

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
