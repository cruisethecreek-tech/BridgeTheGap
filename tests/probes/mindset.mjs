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

/* Every card has a picture, every picture decodes, and the picture opens into
   something you can actually read - which is the whole reason it is not just
   shown at card width and left there. */
await load(SEED());
const pic=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const out={ allNamed:MIND_CARDS.every(c=>!!c.img),
              distinct:new Set(MIND_CARDS.map(c=>c.img)).size,
              total:MIND_CARDS.length };
  const im=document.querySelector('#mindBody .mind-fig img');
  out.inCard=!!im;
  if(im){
    if(!im.complete) await new Promise(r=>{ im.onload=r; im.onerror=r; setTimeout(r,4000); });
    out.decoded=im.naturalWidth>0 && im.naturalHeight>0;
    out.w=im.naturalWidth; out.h=im.naturalHeight;
    out.lazy=im.getAttribute('loading')==='lazy';
    out.sized=!!im.getAttribute('width') && !!im.getAttribute('height');
    out.alt=(im.getAttribute('alt')||'').length>3;
    /* the copy on screen is a thumbnail whatever we call it */
    out.cardWide=Math.round(im.getBoundingClientRect().width);
    im.closest('.mind-fig').click(); await w(350);
    const ov=document.getElementById('mindZoom');
    out.opens=!!(ov&&ov.classList.contains('on'));
    out.fitsFirst=!!(ov&&!ov.classList.contains('big'));
    const zi=document.getElementById('mzImg');
    out.zoomFits=zi?Math.round(zi.getBoundingClientRect().width)<=innerWidth:null;
    if(zi){ zi.click(); await w(350); }
    out.bigAfterTap=!!(ov&&ov.classList.contains('big'));
    out.zoomBig=zi?Math.round(zi.getBoundingClientRect().width)>innerWidth*2:null;
    out.hint=(document.getElementById('mzHint')||{textContent:''}).textContent.length>10;
    /* Back closes the picture and leaves the card standing behind it */
    history.back(); await w(500);
    out.backShutsZoom=!(ov&&ov.classList.contains('on'));
    out.cardSurvives=document.getElementById('mindSheet').classList.contains('on');
  }
  /* every file is really there, not just named */
  const srcs=MIND_CARDS.map(c=>c.img);
  const probes=await Promise.all(srcs.map(sr=>new Promise(r=>{
    const t=new Image(); t.onload=()=>r(t.naturalWidth>0); t.onerror=()=>r(false); t.src=sr;
  })));
  out.everyFileLoads=probes.every(Boolean);
  out.loaded=probes.filter(Boolean).length;
  return out;
});

/* a card written without a picture is still a card, not a broken frame */
const noPic=await p.evaluate(()=>{
  const html=mindCardHTML({k:'x',t:'Title here',punch:'Punch here.',body:'Body here.'},{actions:false});
  return { noImg:html.indexOf('<img')<0, stillHasWords:/Punch here\./.test(html) };
});

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
  ['every card names a picture, and no two share one',
   pic.allNamed===true && pic.distinct===pic.total, JSON.stringify({a:pic.allNamed,d:pic.distinct,t:pic.total})],
  ['...every one of those files is really on disk and decodes',
   pic.everyFileLoads===true && pic.loaded===pic.total, `${pic.loaded} of ${pic.total}`],
  ['the picture leads the card', pic.inCard===true && pic.decoded===true, JSON.stringify({in:pic.inCard,d:pic.decoded,w:pic.w,h:pic.h})],
  ['...lazily, and at a stated size so the card cannot jump under a thumb',
   pic.lazy===true && pic.sized===true, JSON.stringify({l:pic.lazy,s:pic.sized})],
  ['...described for anyone who cannot see it', pic.alt===true, String(pic.alt)],
  ['at card width it is a thumbnail, so tapping it opens a real view',
   pic.cardWide<420 && pic.opens===true, JSON.stringify({w:pic.cardWide,o:pic.opens})],
  ['...which shows the whole picture first', pic.fitsFirst===true && pic.zoomFits===true,
   JSON.stringify({f:pic.fitsFirst,z:pic.zoomFits})],
  ['...and one tap makes it wider than the screen, which is what reading it takes',
   pic.bigAfterTap===true && pic.zoomBig===true, JSON.stringify({b:pic.bigAfterTap,z:pic.zoomBig})],
  ['...saying so, rather than leaving it to be discovered', pic.hint===true, String(pic.hint)],
  ['Back closes the picture and leaves the card it came from standing',
   pic.backShutsZoom===true && pic.cardSurvives===true, JSON.stringify({b:pic.backShutsZoom,c:pic.cardSurvives})],
  ['a card written without a picture is still a card, not a broken frame',
   noPic.noImg===true && noPic.stillHasWords===true, JSON.stringify(noPic)],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
console.log('page errors:', errs.length?[...new Set(errs)].join(' | '):'none');
process.exit(bad?1:0);
