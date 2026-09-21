/* "It shows -844.39 but the dropdowns only show -33.70."

   Reproduced on the reporter's own Food pool, to the cent:

     assigned directly to Food       745.00
     assigned across its 6 subs    1,714.81
     catAssigned reports           1,714.81
     spent directly against Food     877.49
     spent across its subs         1,681.71
     the row prints                 -844.39
     the subs add up to               +33.10

   THE FIRST ATTEMPT AT THIS WAS WRONG AND THE GATE CAUGHT IT. Reading
   catAssigned's max(own, kids) beside catSpent's own + kids, it looked like a
   plain contradiction, and the fix looked like making assignment sum the way
   spending does. budget_sim refused it and said why:

     top-down: a partly-split pool keeps its own total  want 300  got 565
     a naive row-by-row sum over-reports by the split subs - it would read
     4,965 assigned of 4,700 and put a zero-based household $265 in the hole

   That max() is load-bearing. It is what lets this app be budgeted two ways:
   BOTTOM UP, leave the pool blank and type into the subs and the pool sums
   them; or TOP DOWN, type $300 on the pool and carve $265 of it into subs,
   where the pool is still $300 and $35 is unsplit. Adding the two double-counts
   every dollar anyone organised. The totals were never the fault.

   What was missing is the other half of the picture. spentFor counts money
   logged STRAIGHT at a pool, in no sub at all, and no screen ever said so. On
   Food that is $877.49 - which is why -$844.39 sat above six children adding to
   +$33.10 and no amount of staring at the children could explain it. The money
   that accounts for the gap was not on the page.

   So these checks hold two things: the arithmetic stays exactly as it was, both
   budgeting styles included, and the figure that makes a pool's remainder
   readable is now printed where the remainder is read. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);
await p.evaluate(()=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify({
  onboarded:true,mindOff:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',
  activeMonth:'2026-09',
  categories:[{id:'food',name:'Food'},{id:'wal',name:'Walmart',parentId:'food'},
    {id:'ald',name:'Aldi',parentId:'food'},{id:'din',name:'Dining',parentId:'food'},
    {id:'cof',name:'Coffee / drinks out',parentId:'food'},{id:'tak',name:'Takeout',parentId:'food'},
    {id:'sam',name:"Sam's club",parentId:'food'},
    /* a pool inside a pool, which is the other half of the screenshot */
    {id:'fun',name:'Fun Money'},{id:'shop',name:'Online shopping',parentId:'fun'},
    {id:'amz',name:'Amazon orders',parentId:'shop'}],
  budgets:{'2026-09':{food:745, ald:586.56, cof:52, tak:708.38, sam:367.87, amz:76.83}},
  transactions:[
    {id:'a',type:'expense',amount:586.56,catId:'ald',date:'2026-09-05'},
    {id:'b',type:'expense',amount:18.90,catId:'cof',date:'2026-09-05'},
    {id:'c',type:'expense',amount:708.38,catId:'tak',date:'2026-09-05'},
    {id:'d',type:'expense',amount:367.87,catId:'sam',date:'2026-09-05'},
    {id:'e',type:'expense',amount:877.49,catId:'food',date:'2026-09-06'},
    {id:'i1',type:'income',amount:6000,source:'Pay',date:'2026-09-02'}],
  accounts:[],assets:[],liabilities:[],goals:[],recurring:[],impulse:[],debts:[],
  diary:[],intake:{},lessons:[],vault:[]})));
await p.reload(); await p.waitForTimeout(1800);

const o=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const M='2026-09', r2=n=>Math.round(n*100)/100;
  const kids=childrenOf('food');
  const out={
    own:assignedFor('food',M),
    kids:r2(kidsAssigned('food',M)),
    assigned:r2(catAssigned('food',M)),
    used:r2(catUsed('food',M)),
    left:r2(catAssigned('food',M)-catUsed('food',M)),
    kidsLeft:r2(kids.reduce((s,k)=>s+(catAssigned(k.id,M)-catUsed(k.id,M)),0)),
    ownLeft:r2(assignedFor('food',M)-spentFor('food',M)),
    ownSpentDirect:r2(spentFor('food',M)),
    /* both budgeting styles, on their own fixtures */
    topDown:(()=>{ state.categories.push({id:'td',name:'TD'},{id:'td1',name:'TD1',parentId:'td'});
      const B=budgetFor(M); B.td=300; B.td1=265; return r2(catAssigned('td',M)); })(),
    bottomUp:(()=>{ state.categories.push({id:'bu',name:'BU'},{id:'bu1',name:'BU1',parentId:'bu'},{id:'bu2',name:'BU2',parentId:'bu'});
      const B=budgetFor(M); B.bu1=320; B.bu2=300; return r2(catAssigned('bu',M)); })(),
    /* a plain category is untouched by any of this */
    leafUnchanged:assignedFor('ald',M)===586.56 && r2(catAssigned('ald',M))===586.56,
    /* and a pool inside a pool still rolls all the way up */
    nested:r2(catAssigned('fun',M))
  };
  activateTab('budget'); await w(1100); setPlanView('planned'); await w(400);
  const row=id=>document.querySelector('#cats [data-row="'+id+'"]');
  out.foodPrints=(row('food')||{innerText:''}).innerText.replace(/\s+/g,' ').trim();
  /* the pool inside a pool is no longer flush with its parent */
  const fun=row('fun'), shop=row('shop'), amz=row('amz');
  const L=el=>el?Math.round(el.getBoundingClientRect().left):null;
  out.indent={fun:L(fun), shop:L(shop), amz:L(amz)};
  out.nestedIndented = L(shop)>L(fun) && L(amz)>L(shop);
  /* and the sheet names the money resting on the pool AND what left it */
  openCatSheet('food'); await w(500);
  out.sheet=(document.getElementById('catSheetBody')||{innerText:''}).innerText.replace(/\s+/g,' ');
  const btn=document.querySelector('[data-assignnow="food"]');
  out.offersToClear=!!btn;
  out.rollupLabel=btn?btn.textContent.trim():'';
  closeCatSheet(); await w(300);
  /* a pool with nothing spent straight at it must not grow a line saying so */
  out.quietRow=(row('fun')||{innerText:''}).innerText.replace(/\s+/g,' ').trim();
  out.quietPoolSaysNothing=!/spent here/.test(out.quietRow);
  return out;
});
await b.close();

const T=[
  ['the totals are left exactly as they were, because they were not the fault',
   o.assigned===1714.81 && o.used===2559.2 && o.left===-844.39,
   JSON.stringify({assigned:o.assigned, used:o.used, left:o.left})],
  ['...and both ways of budgeting a pool still work',
   o.topDown===300 && o.bottomUp===620,
   'top-down pool of 300 with 265 split out reads '+o.topDown
     +'; bottom-up pool with nothing typed on it reads '+o.bottomUp],

  ['the money spent straight at a pool is now on the row',
   /\$877\.49 spent here/.test(o.foodPrints), o.foodPrints.slice(0,140)],
  ['...which is what makes the remainder readable: subs, plus that',
   Math.abs((o.kidsLeft - o.ownSpentDirect) - o.left)<0.02,
   'subs '+o.kidsLeft+' minus '+o.ownSpentDirect+' spent at the pool = '+o.left],
  ['...and the sheet explains it in words',
   /was spent straight at/.test(o.sheet) && /\$877\.49/.test(o.sheet), o.sheet.slice(0,190)],
  ['a pool nobody has spent directly from says nothing extra',
   o.quietPoolSaysNothing===true, o.quietRow.slice(0,90)],

  ['a category with no subs is untouched by any of it',
   o.leafUnchanged===true, String(o.leafUnchanged)],
  ['a pool inside a pool is drawn inside it',
   o.nestedIndented===true, JSON.stringify(o.indent)+' - groups carried no depth class at all'],
  ['the roll-up button still offers the subs\' total, unchanged',
   o.offersToClear===true && /Assign/.test(o.rollupLabel), o.rollupLabel],

  ['nothing threw', errs.length===0, [...new Set(errs)].slice(0,2).join(' | ')],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
process.exit(bad?1:0);
