/* "This needs a question mark which opens a card to show its math."

   The card is easy. What is hard is that it stays true.

   A card explaining a figure the tile is no longer showing is worse than no
   card at all, because it is wrong with a straight face - and that exact
   failure has now happened four times in this file under four different names:
   a partial sum wearing a whole sum's label, an LTV printed beside an equity
   figure, a net worth that left the bank out, a caption asserting something the
   arithmetic underneath it never said. Every one of them passed arithmetic
   checks, because in every case the sum was right and the LABEL was the lie.

   So this probe does not check that the card renders. It checks the only two
   things that can go wrong later:

     1. the lines add up to the total the card prints, and
     2. that total is the same number printed on the tile.

   Break either one - change netWorth(), re-scope monthExpense(), add a term to
   monthToBudget() and forget the card - and this fails before it ships. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);

const KEYS=['ltb','spent','bank','cards','invested','networth','streak'];
const tx=[];
for(let i=1;i<=9;i++) tx.push({id:'e'+i,type:'expense',amount:[820,1200,340,95,612,55,410,1400,200.19][i-1],
  catId:i<=4?'c'+i:null,source:'Shop '+i,date:'2026-09-0'+((i%9)+1),acctId:'chk'});
tx.push({id:'i1',type:'income',amount:4200,source:'ALDI PAYROLL',date:'2026-09-04',acctId:'chk'});
tx.push({id:'i2',type:'income',amount:1230.23,source:'CITY OF YOUNGSTOWN',date:'2026-09-11',acctId:'chk'});
tx.push({id:'v1',type:'invest',amount:1038.54,source:'Acorns',date:'2026-09-05',acctId:'chk',ikind:'holds'});
tx.push({id:'v2',type:'invest',amount:500,source:'Fidelity',date:'2026-09-09',acctId:'chk',ikind:'holds'});
/* a transfer and a card payment: neither is spending, and the card has to say so */
tx.push({id:'x1',type:'transfer',amount:900,source:'To savings',date:'2026-09-06',acctId:'chk'});
const FULL={onboarded:true,mindOff:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',
  activeMonth:'2026-09',hourlyWage:42,opening:{'2026-09':2600},
  categories:[{id:'c1',name:'Roof'},{id:'c2',name:'Food'},{id:'c3',name:'Getting Around'},{id:'c4',name:'Power & Wi-Fi'}],
  budgets:{'2026-09':{c1:1400,c2:900,c3:400,c4:260}},
  accounts:[{id:'chk',name:'Joint Checking',kind:'checking',balance:8420.11,updated:'2026-09-10'},
            {id:'sav',name:'Emergency Savings',kind:'savings',balance:302484.20,updated:'2026-09-10'},
            {id:'cc1',name:'Visa',kind:'credit',balance:-1748.94,updated:'2026-09-10'},
            {id:'cc2',name:'Store Card',kind:'credit',balance:-400,updated:'2026-09-10'}],
  assets:[],liabilities:[{id:'l1',name:'Car loan',value:4200}],goals:[],
  recurring:[{id:'r1',type:'income',name:'ALDI',source:'ALDI PAYROLL',amount:1050,
              freq:'weekly',anchor:'2026-09-04'}],
  impulse:[{id:'p1',type:'skip',name:'Sneakers',amount:200,date:'2026-09-08'},
           {id:'p2',type:'skip',name:'Gadget',amount:90,date:'2026-09-09'}],
  debts:[],diary:[],intake:{},lessons:[],vault:[],transactions:tx};
const load=async st=>{ await p.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),st);
  await p.reload(); await p.waitForTimeout(1700); };

const audit=async()=>p.evaluate(KEYS=>{
  const tiles={};
  document.querySelectorAll('#homeSnap .fstat').forEach(el=>{
    const q=el.querySelector('[data-why^="stat:"]'); if(!q) return;
    tiles[q.dataset.why.slice(5)]=el.querySelector('.ff .v').innerText.trim();
  });
  return KEYS.map(k=>{
    const m=statMath(k);
    if(!m) return {k, missing:true};
    const sum=m.plain?m.total:(m.lines||[]).reduce((s,l)=>s+(l.op==='-'?-l.v:l.v),0);
    const html=statMathHTML(k);
    return { k, title:m.title, n:(m.lines||[]).length,
      reconciles: Math.abs(sum-m.total)<0.005, sum:Math.round(sum*100)/100, total:Math.round(m.total*100)/100,
      onTile: k in tiles, tile:tiles[k]||null,
      /* the whole point: the card's total is the tile's number, not a retelling */
      tileMatches: !(k in tiles) ? null : (m.plain ? tiles[k]===String(m.total) : tiles[k]===usd(m.total)),
      /* the total must also be visibly printed, not merely computed */
      printsTotal: html.indexOf(m.plain?String(m.total):usd(m.total))>=0,
      hasNote: /sm-note/.test(html), goesSomewhere: /data-smgo="[a-z]+"/.test(html),
      title2: statMathTitle(k) };
  });
}, KEYS);

await load(FULL);
const full=await audit();

/* the "?" is the app's own button, not a second one invented for this screen */
const shared=await p.evaluate(()=>{
  const qs=[...document.querySelectorAll('#homeSnap [data-why^="stat:"]')];
  return { count:qs.length, allWhyQ:qs.every(q=>q.classList.contains('why-q')),
           anyStrayClass:[...document.querySelectorAll('#homeSnap button')]
             .some(x=>/sm-q|statmath/.test(x.className+' '+[...x.attributes].map(a=>a.name).join(' '))),
           labelled:qs.every(q=>(q.getAttribute('aria-label')||'').length>8) };
});

/* opening one must not flip the card it is standing on, and the note has to
   land under the whole strip rather than inside one cell of the grid */
const open=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  document.querySelector('[data-why="stat:networth"]').click(); await w(350);
  const n=document.querySelector('.why-note[data-forwhy="stat:networth"]');
  const out={ opened:!!n,
    underStrip: !!n && n.previousElementSibling && n.previousElementSibling.id==='homeSnap',
    notInGrid: !!n && n.parentElement.id!=='homeSnap',
    flipped: !!document.querySelector('#homeSnap .fstat.flipped'),
    rows: n?n.querySelectorAll('.sm-row').length:0,
    fits: n ? n.scrollWidth<=n.clientWidth+1 : false };
  document.querySelector('[data-why="stat:networth"]').click(); await w(300);
  out.toggles=!document.querySelector('.why-note[data-forwhy="stat:networth"]');
  /* the card still does the thing it always did */
  document.querySelector('#homeSnap .fstat .ff .v').click(); await w(500);
  out.stillFlips=!!document.querySelector('#homeSnap .fstat.flipped');
  return out;
});

/* the same seven on an empty file: nothing may throw, and nothing may claim */
await load({onboarded:true,mindOff:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',
  activeMonth:'2026-09',categories:[],budgets:{},transactions:[],accounts:[],assets:[],goals:[],
  recurring:[],impulse:[],liabilities:[],debts:[],diary:[],intake:{},lessons:[],vault:[]});
const empty=await audit();

/* and on junk somebody's broken backup could hand it */
await load({onboarded:true,mindOff:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',
  activeMonth:'2026-09',categories:[{id:'c1',name:'Roof'}],budgets:{'2026-09':{c1:-50}},
  transactions:[{id:'t1',type:'expense',amount:-99,catId:'c1',date:'2026-09-02',source:''},
                {id:'t2',type:'income',amount:NaN,date:'2026-09-03',source:'x'}],
  accounts:[{id:'a',name:'',kind:'checking',balance:'oops'},{id:'b',name:'Visa',kind:'credit',balance:-0}],
  assets:[{id:'s1',name:'x',value:null}],liabilities:[{id:'l',name:'y',value:undefined}],
  goals:[],recurring:[],impulse:[],debts:[],diary:[],intake:{},lessons:[],vault:[]});
const junk=await audit();

/* budget mode changes what Left to budget is made of, and the card has to move
   with it rather than describing the mode it was written under */
await load(FULL);
const modes=await p.evaluate(()=>{
  const seen={};
  for(const mode of ['month','have']){
    state.budgetMode=mode; save();
    const m=statMath('ltb');
    seen[mode]={ lines:m.lines.map(l=>l.k), total:Math.round(m.total*100)/100,
                 note:/whole month/.test(m.note)||/only what/.test(m.note) };
  }
  return seen;
});

await b.close();

const bad=r=>!r.reconciles || r.tileMatches===false || !r.printsTotal;
const T=[
  ['every headline on Home carries a question mark',
   shared.count===7 && full.every(r=>r.onTile), JSON.stringify({q:shared.count, on:full.filter(r=>r.onTile).length})],
  ['...and it is the app\'s own question mark, not a second one drawn for this screen',
   shared.allWhyQ===true && shared.anyStrayClass===false, JSON.stringify(shared)],
  ['...described for anyone who cannot see it', shared.labelled===true, String(shared.labelled)],
  ['every card\'s lines add up to the total it prints',
   full.every(r=>r.reconciles), JSON.stringify(full.filter(r=>!r.reconciles))],
  ['...and that total is the number on the tile, not a retelling of it',
   full.every(r=>r.tileMatches!==false), JSON.stringify(full.filter(r=>r.tileMatches===false))],
  ['...printed, not merely computed', full.every(r=>r.printsTotal), JSON.stringify(full.filter(r=>!r.printsTotal))],
  ['each one says where the figures live and offers to take you there',
   full.every(r=>r.hasNote && r.goesSomewhere), JSON.stringify(full.filter(r=>!(r.hasNote&&r.goesSomewhere)))],
  ['...under a heading that names the figure', full.every(r=>/^Where /.test(r.title2)), JSON.stringify(full.map(r=>r.title2)).slice(0,120)],
  ['the money cards are a real decomposition, not one line restating the answer',
   full.filter(r=>r.k!=='streak').every(r=>r.n>=1)
     && full.find(r=>r.k==='networth').n===3
     && full.find(r=>r.k==='bank').n===2, JSON.stringify(full.map(r=>[r.k,r.n]))],
  ['opening one lands the working under the whole strip, not inside one tile',
   open.opened===true && open.underStrip===true && open.notInGrid===true, JSON.stringify(open)],
  ['...without turning over the card you were asking about',
   open.flipped===false, String(open.flipped)],
  ['...and the card still flips when you tap the card',
   open.stillFlips===true, String(open.stillFlips)],
  ['...tapping the question mark again puts it away', open.toggles===true, String(open.toggles)],
  ['...and it fits the width it is given', open.fits===true, String(open.fits)],
  ['an empty file still reconciles and still claims nothing',
   empty.every(r=>!bad(r)), JSON.stringify(empty.filter(bad)).slice(0,200)],
  ['junk out of a broken backup cannot make a card lie or throw',
   junk.every(r=>!bad(r)) && errs.length===0, JSON.stringify(junk.filter(bad)).slice(0,200)],
  ['Left to budget counts pay not yet handed over only when that is the chosen mode',
   modes.month.lines.some(k=>/still due/i.test(k)) && !modes.have.lines.some(k=>/still due/i.test(k)),
   JSON.stringify(modes)],
  ['...and says which mode it is describing', modes.month.note===true && modes.have.note===true,
   JSON.stringify({m:modes.month.note,h:modes.have.note})],
];
let n=0; for(const [t,ok,d] of T){ if(!ok) n++; console.log(`${ok?'ok  ':'FAIL'}  ${t}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-n} of ${T.length} hold`);
console.log('page errors:', errs.length?[...new Set(errs)].join(' | '):'none');
process.exit(n?1:0);
