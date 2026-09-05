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
    hidden:subs.filter(x=>x.classList.contains('say-hid')).length,
    whys:root.querySelectorAll('.say-why').length,
    /* the pattern that was removed, watched so it cannot return by any route */
    clamped:subs.filter(x=>x.classList.contains('clampable')).length,
    mores:root.querySelectorAll('.sub-more').length,
    /* the whole point, and it survives the change of mechanism: no word is lost.
       textContent rather than innerText, because hidden is precisely the state
       being checked and innerText would report every one of them as empty. */
    fullTextKept:subs.every(x=>!x.classList.contains('say-hid') || (x.textContent||'').trim().length>40),
    rule:!!root.querySelector('.panel>h2')
  };
}, [view,openFirst]);

/* This probe was written when Brief CLIPPED - two lines and a More under each
   intro - and every check below asserted that. It was rewritten, not deleted,
   when the report came in: "No it didn't give the acorns treatment I requested."
   The reader was in Brief, and Brief was the one mode that never used the
   explainer cards, so nothing built for them had ever reached that reader.

   The subject of the probe is unchanged - what does Brief do with a long intro -
   and the answer is now "hides it and offers a card", which is what Clean does.
   The property that mattered under the old mechanism still matters under the
   new one and is still checked: not one word is thrown away to get the screen
   short. */
const home=await look('home', false);
ok('Home has no wall of intros left in the first place', home.clamped===0, JSON.stringify(home));
const trk=await look('tx');
ok('long intros are hidden where they still live', trk.hidden>0, JSON.stringify(trk));
ok('...and the clip-and-More pattern is gone', trk.clamped===0 && trk.mores===0, JSON.stringify(trk));
ok('...replaced by the card Clean has always used', trk.whys>0, JSON.stringify(trk));
ok('...with every word still in the DOM and one tap from being read', trk.fullTextKept===true);

const goals=await look('goals');
ok('the accounts panel gets the same treatment', goals.hidden>0 && goals.clamped===0, JSON.stringify(goals));

/* The card opens, and hands the page back afterwards. Under the old mechanism
   this measured a paragraph growing taller in place - which is the thing the
   reporter objected to, because it moves everything below it. */
const opened=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const btn=document.querySelector('#view-goals .say-why') || document.querySelector('#view-tx .say-why');
  if(!btn) return null;
  const view=btn.closest('.view');
  const before=Math.round(view.scrollHeight);
  btn.click(); await w(320);
  const sheet=document.getElementById('saySheet');
  const words=((document.getElementById('sayBody')||{innerText:''}).innerText||'')
    .trim().split(/\s+/).filter(Boolean).length;
  const on=sheet.classList.contains('on');
  dismissOverlay(); await w(280);
  return {before, after:Math.round(view.scrollHeight), on, words,
          off:!sheet.classList.contains('on')};
});
ok('the card opens with the words in it', opened && opened.on===true && opened.words>=8, JSON.stringify(opened));
ok('...and closes again', opened && opened.off===true, JSON.stringify(opened));
ok('...without the page under it changing height, which clipping could never do',
   opened && opened.after===opened.before, JSON.stringify(opened));

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
/* Leaving Full has to put the cards BACK. This asked whether it clamped again;
   the same round trip, asked of the mechanism that replaced clamping. It is the
   check that would catch a one-way door - a reader who tried Full and could
   never get the short screen back. */
const backBrief=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('settings'); await w(350);
  document.querySelector('#sayMode button[data-say="brief"]').click(); await w(300);
  activateTab('goals'); deckShow('goals','Accounts'); await w(500);
  const root=document.getElementById('view-goals');
  return { hidden:root.querySelectorAll('.sub.say-hid').length,
           whys:root.querySelectorAll('.say-why').length,
           clamped:root.querySelectorAll('.sub.clampable').length };
});
ok('...and switching back hides them again, with the cards restored',
   backBrief.hidden>0 && backBrief.whys>0 && backBrief.clamped===0, JSON.stringify(backBrief));
/* Brief is no longer the default - Clean is, and Brief is the middle setting.
   The old assertion was true and is now false: a fact about the app, not a
   check that needed loosening. */
ok('Clean is the default for someone new, with Brief a step up from it',
  await pg.evaluate(()=>{ const s=normalizeState({}); return s.sayMode; })==='clean');

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
