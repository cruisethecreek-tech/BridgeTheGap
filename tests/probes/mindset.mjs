/* The mindset cards: the owner's own writing, shown once a day on opening.

   The content is not what this checks - it is stored verbatim and nothing is
   allowed to touch it. What decides whether a card like this is welcome or
   merely tolerated is everything AROUND it: how often it appears, whether it
   repeats, whether it can be turned off, and whether turning it off loses it. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);
const SEED=(x={})=>({onboarded:true,activeMonth:'2026-09',uiMode:'all',stageReached:3,
  guidesOff:true,sayMode:'brief',categories:[{id:'roof',name:'Roof'}],budgets:{},
  transactions:[],accounts:[],assets:[],goals:[],recurring:[],impulse:[],liabilities:[],
  debts:[],diary:[],intake:{},lessons:[],vault:[],...x});
const load=async st=>{ await p.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),st);
  await p.reload(); await p.waitForTimeout(1600); };

await load(SEED());
const first=await p.evaluate(()=>{
  const ov=document.getElementById('mindSheet');
  const t=(document.getElementById('mindBody')||{innerText:''}).innerText;
  return { open:!!(ov&&ov.classList.contains('on')),
           words:t.trim().split(/\s+/).filter(Boolean).length,
           hasPunch:/mindset/i.test(t), day:state.mindDay, seen:(state.mindSeen||[]).length,
           canDismiss:!!document.getElementById('mindGot'),
           canTurnOff:!!document.getElementById('mindOff') };
});
/* second open on the same day must be quiet */
await p.reload(); await p.waitForTimeout(1600);
const again=await p.evaluate(()=>({ open:document.getElementById('mindSheet').classList.contains('on') }));

/* every card before any repeat */
const rotation=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const order=[]; state.mindSeen=[]; state.mindDay='';
  for(let i=0;i<MIND_CARDS.length;i++){
    const before=(state.mindSeen||[]).slice();
    const c=mindNext(); order.push(c.k); mindMark(c.k);
    if((state.mindSeen||[]).length===0) break;    // round reset on the last one
  }
  return { order, unique:new Set(order).size, total:MIND_CARDS.length, resets:(state.mindSeen||[]).length };
});

/* the off switch, and what survives it */
await load(SEED());
const off=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const btn=document.getElementById('mindOff'); if(btn) btn.click(); await w(400);
  return { stored:!!state.mindOff, closed:!document.getElementById('mindSheet').classList.contains('on') };
});
await p.reload(); await p.waitForTimeout(1600);
const afterOff=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const out={ opened:document.getElementById('mindSheet').classList.contains('on') };
  activateTab('learn'); await w(700);
  if(typeof deckShow==='function'){ try{ deckShow('learn','Mindset cards'); }catch(_){ } }
  await w(400);
  const rows=[...document.querySelectorAll('[data-mindopen]')];
  out.inLibrary=rows.length;
  if(rows.length){ rows[0].click(); await w(400);
    out.opensFromLibrary=document.getElementById('mindSheet').classList.contains('on');
    out.libraryHasNoActions=!document.getElementById('mindGot');
    dismissOverlay(); await w(300); }
  out.canTurnBackOn=!!document.getElementById('mindOn');
  return out;
});

/* never over somebody being onboarded */
await load(SEED({onboarded:false}));
const raw=await p.evaluate(()=>document.getElementById('mindSheet').classList.contains('on'));

/* the words are the owner's, untouched */
const text=await p.evaluate(()=>{
  const c=MIND_CARDS.find(x=>x.k==='rich');
  return { punch:c.punch, bodyStart:c.body.slice(0,58),
           dashes:MIND_CARDS.some(x=>/[—–]/.test(x.body+x.punch+x.t)),
           all:MIND_CARDS.length };
});
await b.close();

const T=[
  ['a card opens when the app does', first.open===true, JSON.stringify(first)],
  ['...carrying the whole thing, not a trimmed version',
   first.words>=120, `${first.words} words`],
  ['...with a way to close it and a way to stop them',
   first.canDismiss===true && first.canTurnOff===true, JSON.stringify(first)],
  ['opening the app again the same day does not show another',
   again.open===false, String(again.open)],
  ['every card is shown before any is shown twice',
   rotation.unique===rotation.total, JSON.stringify(rotation)],
  ['...and the set starts over rather than going silent', rotation.resets===0, JSON.stringify(rotation)],
  ['turning them off is remembered', off.stored===true && off.closed===true, JSON.stringify(off)],
  ['...and they stop opening with the app', afterOff.opened===false, String(afterOff.opened)],
  ['...but every one is still on Learn, so nothing was lost',
   afterOff.inLibrary===6 && afterOff.opensFromLibrary===true,
   JSON.stringify(afterOff)],
  ['...opened from there without the dismiss buttons, which belong to the prompt',
   afterOff.libraryHasNoActions===true, String(afterOff.libraryHasNoActions)],
  ['...and they can be turned back on from the same place',
   afterOff.canTurnBackOn===true, String(afterOff.canTurnBackOn)],
  ['nothing interrupts somebody who has not finished setting up', raw===false, String(raw)],
  ['the owner\'s words are stored exactly as written',
   /^Poor mindset spends to look better today/.test(text.punch)
     && /^A poor mindset sees money as something to spend/.test(text.bodyStart)
     && text.all===6, JSON.stringify(text).slice(0,140)],
  ['...and carry none of the dashes this project bans', text.dashes===false, String(text.dashes)],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
console.log('page errors:', errs.length?[...new Set(errs)].join(' | '):'none');
process.exit(bad?1:0);
