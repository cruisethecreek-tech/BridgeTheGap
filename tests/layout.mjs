/* ============================================================
   LAYOUT

   Every fault this suite exists for was found by a person looking at their own
   phone, and none of them were found by any of the other nine suites - because
   the arithmetic was right and the PIXELS were wrong.

   The one that started it: a transaction row is four things on one line - date,
   what it was, how much, delete. `.tx-amt` was `white-space:nowrap` with no
   `flex-shrink:0`, so flex squeezed its BOX below its content and the amount
   painted outside it, straight across the category chip next to it. Text on
   text, on every row, at every width.

   Three things are checked on ten tabs at four phone widths:

     1. no two unrelated pieces of text share pixels
     2. no text is pushed off the side of the glass, and the page never
        scrolls sideways
     3. no text is crushed into a sliver - a label with 45px to live in
        ("Mechanic...") is not a label

   Two things ARE stacked on purpose and are excluded by name: the two faces of
   a flip stat card, which share one box because that is what a flip card is,
   and the contents of a closed <details>, which Chromium still reports rects
   for. Comparison is over LINE boxes rather than bounding boxes, because an
   inline span that wraps to a second line has one rect spanning both and would
   otherwise "overlap" everything above it.
   ============================================================ */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const results=[]; const check=(name,ok,detail='')=>results.push({ok,name,detail});
const VIEWS=['home','budget','tx','impulse','debt','goals','reflect','learn','diary','settings'];
const WIDTHS=[320,360,390,430];   // small Android, iPhone SE/13 mini, iPhone 14, iPhone Pro Max

/* One household rich enough to light up every panel, with the long names and
   awkward amounts that actually break layouts: a category that does not fit,
   a four-figure amount with cents, a note longer than its row. */
const HOUSE={onboarded:true,activeMonth:'2026-08',uiMode:'all',stageReached:3,guidesOff:true,hourlyWage:24,
 categories:[{id:'food',name:'Food'},{id:'groc',name:'Groceries',parentId:'food'},{id:'eat',name:'Eating out',parentId:'food'},
   {id:'roof',name:'Roof over my head'},{id:'car',name:'Getting Around'},{id:'fun',name:'Fun / entertainment'},
   {id:'inv',name:'Investing / retirement',growth:'invest'}],
 budgets:{'2026-08':{groc:650,eat:520,roof:1250,car:340,fun:300,inv:2400}},
 transactions:[{id:'i1',type:'income',amount:3247.83,date:'2026-08-01',hours:160,note:'Paycheck from the warehouse job'},
  {id:'t1',type:'expense',amount:1250,catId:'roof',date:'2026-08-02',note:'Rent for August, paid late'},
  {id:'t3',type:'expense',amount:1247.99,catId:'fun',date:'2026-08-04',note:'Concert tickets plus the hotel',energy:'fear'},
  {id:'t2',type:'expense',amount:87.42,catId:'groc',date:'2026-08-03',energy:'growth'},
  {id:'t5',type:'invest',amount:500,date:'2026-08-06',note:'Index fund'}],
 goals:[{id:'g',name:'Emergency fund that covers three months',target:9000,saved:2400}],
 impulse:[{id:'p',name:'Mechanical keyboard',amount:189,trap:'scroll',date:'2026-08-03',decision:'skip'}],
 recurring:[{id:'r',type:'expense',amount:1250,catId:'roof',freq:'monthly',anchor:'2026-08-01'}],
 accounts:[{id:'a',name:'Checking',kind:'checking',balance:2150}],
 assets:[{id:'as',name:'Index fund at the brokerage',value:12000,kind:'real'}],
 liabilities:[{id:'l',name:'Credit card',value:2400}],
 debts:[{id:'d',name:'Credit card balance',balance:2400,minPayment:75,apr:23.9}],debtBudget:400,
 diary:[],intake:{},lessons:[],vault:[],hours:[]};

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const errs=[];
const overlaps=[], offscreen=[], crushed=[], sideways=[];

for(const w of WIDTHS){
  const p = await b.newPage({ viewport:{width:w,height:900} });
  p.on('pageerror',e=>errs.push(`${w}px: ${e.message}`));
  await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);
  await p.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),HOUSE);
  await p.reload(); await p.waitForTimeout(1000);
  for(const v of VIEWS){
    const r = await p.evaluate(async(v)=>{
      activateTab(v); await new Promise(r=>setTimeout(r,450));
      const root=document.getElementById('view-'+v); if(!root) return null;
      const vis=e=>{const s=getComputedStyle(e); return s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity>0.05;};
      const byDesign=e=>{
        for(let a=e; a && a!==root; a=a.parentElement){
          const s=getComputedStyle(a);
          if(s.backfaceVisibility==='hidden'||s.contentVisibility==='hidden') return true;
          const par=a.parentElement;
          if(par && par.tagName==='DETAILS' && !par.open && a.tagName!=='SUMMARY') return true;
        }
        return false;
      };
      const leaves=[...root.querySelectorAll('*')].filter(e=>{
        if(!vis(e)||e.offsetParent===null||byDesign(e)) return false;
        const r=e.getBoundingClientRect();
        return [...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()) && r.width>0 && r.height>0;
      });
      const id=e=>(e.className||e.tagName)+' "'+e.textContent.trim().slice(0,26)+'"';
      const ov=[];
      for(let i=0;i<leaves.length;i++)for(let j=i+1;j<leaves.length;j++){
        const A=leaves[i],B=leaves[j];
        if(A.contains(B)||B.contains(A)) continue;
        let ox=0,oy=0;
        for(const a of A.getClientRects())for(const c of B.getClientRects()){
          const x=Math.min(a.right,c.right)-Math.max(a.left,c.left);
          const y=Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top);
          if(x>2&&y>2&&x*y>ox*oy){ ox=x; oy=y; }
        }
        if(ox>2&&oy>2) ov.push(`${id(A)} <> ${id(B)} (${Math.round(ox)}x${Math.round(oy)})`);
      }
      const off=leaves.filter(e=>{const r=e.getBoundingClientRect(); return r.right>innerWidth+1||r.left<-1;}).map(id);
      const cr=leaves.filter(e=>e.scrollWidth>e.clientWidth+1 && e.clientWidth<60 && getComputedStyle(e).overflow!=='visible')
        .map(e=>id(e)+' in '+e.clientWidth+'px of '+e.scrollWidth);
      return { ov, off, cr, hscroll: document.documentElement.scrollWidth>innerWidth+1 ? document.documentElement.scrollWidth : 0 };
    },v);
    if(!r) continue;
    r.ov.forEach(x=>overlaps.push(`${v}@${w}: ${x}`));
    r.off.forEach(x=>offscreen.push(`${v}@${w}: ${x}`));
    r.cr.forEach(x=>crushed.push(`${v}@${w}: ${x}`));
    if(r.hscroll) sideways.push(`${v}@${w}: page is ${r.hscroll}px wide`);
  }
  await p.close();
}

check('no two pieces of text share pixels', overlaps.length===0, overlaps.slice(0,6).join(' | '));
check('nothing is pushed off the side of the glass', offscreen.length===0, offscreen.slice(0,6).join(' | '));
check('the page never scrolls sideways', sideways.length===0, sideways.slice(0,6).join(' | '));
check('no label is crushed into a sliver', crushed.length===0, crushed.slice(0,6).join(' | '));

/* The row that started this: whatever else changes, an amount must never be
   allowed to shrink below the text inside it. */
const p = await b.newPage({ viewport:{width:390,height:900} });
p.on('pageerror',e=>errs.push('tx: '+e.message));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);
await p.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),HOUSE);
await p.reload(); await p.waitForTimeout(900);
const row = await p.evaluate(async()=>{
  activateTab('tx'); await new Promise(r=>setTimeout(r,450));
  const rows=[...document.querySelectorAll('.tx')];
  return rows.map(r=>{
    const amt=r.querySelector('.tx-amt'), chip=r.querySelector('.tag-cat');
    const cs=amt?getComputedStyle(amt):null;
    return { shrink:cs?cs.flexShrink:'-', fits:amt?amt.scrollWidth<=amt.clientWidth+1:true,
             chipWhole: chip ? chip.scrollWidth<=chip.clientWidth+1 : true };
  });
});
check('an amount can never be squeezed below the number inside it',
      row.length>0 && row.every(r=>r.shrink==='0' && r.fits), JSON.stringify(row.slice(0,3)));
check('...and the category chip is never shaved to fit beside it',
      row.every(r=>r.chipWhole), JSON.stringify(row.slice(0,3)));
await p.close();

console.log('LAYOUT - ten tabs, four phone widths, no text on text\n');
let fails=0;
for(const r of results){ if(!r.ok) fails++; console.log(`${r.ok?'ok  ':'FAIL'}  ${r.name}${r.detail?'\n        '+String(r.detail).replace(/\n/g,' ').slice(0,240):''}`); }
console.log(`\n${results.length-fails} of ${results.length} hold`);
console.log(`checked ${VIEWS.length} tabs x ${WIDTHS.length} widths`);
console.log('page errors:', errs.length?errs:'none');
await b.close();
if(fails) process.exit(1);
