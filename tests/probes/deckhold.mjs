/* "Even this screen disappears automatically and it doesn't even have a
   keyboard. There is a glitch within the app."

   It did not need a keyboard, and that sentence is what finally located this.
   Three rounds had gone into the number pad on the assumption that the input
   was the subject. It was not: a screen was closing itself, and the field
   inside it went with it.

   deckLive decides which panels are real enough to have a chip. One of its
   tests was "is this panel's body empty", and deckPass then clears deckOpen
   for any open panel not in that list. But a renderer that clears its box
   before refilling it is empty for a frame - so a pass landing inside that
   frame closed the panel the reader was standing in, and nothing reopened it
   when the content came back a moment later.

   And passes are constant. sayPass runs on every window resize - which Android
   fires several times while a soft keyboard animates, and again when a Custom
   Tab hides its toolbar on a scroll - on every details toggle, and eighty
   milliseconds after any DOM mutation at all, through the observer that keeps
   Clean mode tidy.

   Measured before the fix: open a panel, empty its body for one frame, run the
   pass. deckOpen became null and reopenedByItself was false. Permanent, from a
   moment.

   Hidden, stage-locked and the two spending-mode classes still close a panel,
   and that is deliberate: those are changes of state, and a panel the ladder
   has locked must not stay open just because somebody was reading it.
   Emptiness is not a state. It is a moment. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);
await p.evaluate(()=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify({
  onboarded:true,mindOff:true,uiMode:'all',stageReached:3,sayMode:'brief',activeMonth:'2026-09',
  hourlyWage:70,debtBudget:1500,investReturn:7,
  categories:[{id:'roof',name:'Roof'},{id:'food',name:'Food'}],
  budgets:{'2026-09':{roof:1250,food:600}},
  transactions:[{id:'i1',type:'income',amount:4760,source:'Pay',date:'2026-09-04'},
                {id:'e1',type:'expense',amount:300,catId:'food',date:'2026-09-05'}],
  accounts:[{id:'j',name:'Joint',kind:'checking',balance:5000,updated:'2026-09-11'}],
  assets:[{id:'a1',name:'Car',value:9000,kind:'stuff'}],liabilities:[],goals:[],recurring:[],impulse:[],
  debts:[{id:'m',name:'Mortgage',kind:'mortgage',balance:77266,apr:3.375,minPayment:1230,escrow:790}],
  diary:[],intake:{},lessons:[],vault:[]})));
await p.reload(); await p.waitForTimeout(2000);

/* the exact reported shape, on the panel a reader is standing in */
const one=await p.evaluate(async()=>{
  const w=m=>new Promise(x=>setTimeout(x,m));
  activateTab('debt'); await w(1200);
  const host=document.getElementById('deck-debt');
  const label=[...host.querySelectorAll(':scope > [data-deck]')].map(e=>e.dataset.deck)[0];
  const el=()=>[...host.querySelectorAll(':scope > [data-deck]')].find(x=>x.dataset.deck===label);
  const open=()=>!!(el()&&el().classList.contains('dk-on'));
  deckShow('debt',label); await w(400);
  const o={label, opened:open()};
  sayPass('debt'); await w(200);
  o.survivesAPlainPass=open();
  /* a renderer mid-refill: empty for one frame, and a pass lands in it */
  const e=el(), body=e.matches('details')?e.querySelector('.acc-body'):e;
  const saved=body.innerHTML;
  body.innerHTML='';
  deckPass('debt'); await w(120);
  o.stayedOpenThroughTheEmptyFrame=deckOpen['debt']===label;
  o.deckNotHidden=!host.hidden;
  o.chipStillThere=!!host.querySelector('.dk-chip[data-dk="'+CSS.escape(label)+'"]');
  body.innerHTML=saved;
  deckPass('debt'); await w(200);
  o.contentCameBack=open();
  return o;
});

/* every panel on every tab, against what a phone actually does to the viewport */
const sweep=await p.evaluate(async()=>{
  const w=m=>new Promise(x=>setTimeout(x,m));
  const TABS=['home','budget','tx','debt','goals','reflect','impulse','learn','settings'];
  const lost=[]; let tried=0;
  for(const t of TABS){
    activateTab(t); await w(700);
    const host=document.getElementById('deck-'+t); if(!host) continue;
    /* The chips are what a thumb can actually reach, so they are what gets
       swept. Asking every [data-deck] in the page was the first cut and it
       opened two panels that were already hidden - which the next pass then
       correctly closed, and the probe reported the app's correct behaviour as
       a fault. A sweep has to model a user, not the DOM. */
    const labels=[...host.querySelectorAll('.dk-chip')].map(e=>e.dataset.dk);
    for(const label of labels){
      deckShow(t,label); await w(120);
      if(deckOpen[t]!==label) continue;            // it declined to open; not this test's business
      tried++;
      /* the keyboard animating, and a Custom Tab toolbar hiding on a scroll */
      for(let i=0;i<4;i++){ window.dispatchEvent(new Event('resize')); await w(190); }
      await w(320);
      if(deckOpen[t]!==label) lost.push(t+'/'+label);
      deckShow(t,null); await w(60);
    }
  }
  return {tried, lost};
});

/* the closes that are supposed to happen still happen */
const deliberate=await p.evaluate(async()=>{
  const w=m=>new Promise(x=>setTimeout(x,m));
  activateTab('debt'); await w(700);
  const host=document.getElementById('deck-debt');
  const el=[...host.querySelectorAll(':scope > [data-deck]')][1];
  const label=el.dataset.deck;
  const o={};
  deckShow('debt',label); await w(200);
  el.hidden=true; deckPass('debt'); await w(120);
  o.hiddenCloses=deckOpen['debt']===null;
  el.hidden=false;
  deckShow('debt',label); await w(200);
  el.classList.add('stage-locked'); deckPass('debt'); await w(120);
  o.lockedCloses=deckOpen['debt']===null;
  el.classList.remove('stage-locked');
  /* a panel that cannot legitimately be shown is never opened in the first
     place, rather than flashed up and withdrawn */
  el.hidden=true;
  o.refusedWhileHidden = deckShow('debt',label)===false && deckOpen['debt']!==label;
  el.hidden=false;
  /* and a panel that is removed from the page entirely cannot be stood on */
  deckShow('debt',label); await w(200);
  const parent=el.parentNode; parent.removeChild(el);
  deckPass('debt'); await w(120);
  o.removedCloses=deckOpen['debt']===null;
  parent.appendChild(el);
  return o;
});

await b.close();

const T=[
  ['a panel the reader opened survives an ordinary pass',
   one.opened===true && one.survivesAPlainPass===true,
   JSON.stringify({opened:one.opened,pass:one.survivesAPlainPass})],
  ['...and survives being empty for a frame while its renderer refills it',
   one.stayedOpenThroughTheEmptyFrame===true,
   'deckOpen went '+String(one.stayedOpenThroughTheEmptyFrame)+' - it used to go null, and nothing put it back'],
  ['...without the deck hiding itself out from under it',
   one.deckNotHidden===true && one.chipStillThere===true,
   JSON.stringify({hidden:!one.deckNotHidden, chip:one.chipStillThere})],
  ['...and the content comes back when the render finishes',
   one.contentCameBack===true, String(one.contentCameBack)],

  ['every panel on every tab is still open after the viewport is shaken',
   sweep.lost.length===0 && sweep.tried>=6,
   sweep.tried+' panels opened, lost: '+(sweep.lost.join(', ')||'none')],

  ['a panel that is hidden still closes, because that is a change of state',
   deliberate.hiddenCloses===true, String(deliberate.hiddenCloses)],
  ['...so does one the ladder locks',
   deliberate.lockedCloses===true, String(deliberate.lockedCloses)],
  ['...and one taken off the page entirely cannot be stood on',
   deliberate.removedCloses===true, String(deliberate.removedCloses)],
  ['a panel that cannot be shown is refused, not flashed up and withdrawn',
   deliberate.refusedWhileHidden===true, String(deliberate.refusedWhileHidden)],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
console.log('page errors:', errs.length?[...new Set(errs)].join(' | '):'none');
process.exit(bad?1:0);
