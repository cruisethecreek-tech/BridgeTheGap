import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const SEED={ onboarded:true, activeMonth:'2026-09', uiMode:'all', stageReached:3, guidesOff:true,
  sayMode:'clean', planView:'left',            /* parked on the view being removed */
  categories:[{id:'food',name:'Food'},{id:'wal',name:'Walmart',parentId:'food'},
              {id:'ald',name:'Aldi',parentId:'food'},{id:'sam',name:"Sam's club",parentId:'food'},
              /* long names are the ones a width change breaks first */
              {id:'em',name:'Emergency Fund'},{id:'os',name:'Online shopping'}],
  budgets:{'2026-09':{wal:250,ald:541.67,sam:400,em:1200,os:1069.40}},
  transactions:[{id:'t1',date:'2026-09-02',amount:122.27,catId:'ald',type:'expense',name:'Aldi run'}],
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:3000}] };
await p.goto('file://'+process.cwd()+'/app.html');
await p.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),SEED);
await p.reload(); await p.waitForTimeout(1100);

const o=await p.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const out={};
  activateTab('budget'); await w(800);
  out.migrated = state.planView;                     // parked on 'left' -> carried home
  const tabs=[...document.querySelectorAll('[data-planview]')];
  out.tabs = tabs.map(t=>t.textContent.trim());
  out.deadTab = !!document.querySelector('[data-planview="left"]');

  /* An input's value is not innerText. Reading the money cell as text alone
     reported the Planned field as empty and would have passed a blank field. */
  const row=id=>{ const r=document.querySelector(`.subrow[data-row="${id}"] .rw-money`); if(!r) return '';
    const f=r.querySelector('input'); return ((f?'$'+f.value+' ':'')+r.innerText).replace(/\s+/g,' ').trim(); };
  out.plannedAldi = row('ald');
  out.plannedGroup = (document.querySelector('.cat.grp[data-row="food"] .rw-money')||{}).innerText?.replace(/\s+/g,' ').trim()||'';

  tabs.find(t=>t.dataset.planview==='spent').click(); await w(500);
  out.spentAldi = row('ald');
  out.spentGroup = (document.querySelector('.cat.grp[data-row="food"] .rw-money')||{}).innerText?.replace(/\s+/g,' ').trim()||'';
  out.spentSam = row('sam');

  // the figure must out-rank its own footnote, or the tab shows two captions
  const fig=document.querySelector('.subrow[data-row="ald"] .sub-spent');
  const hint=fig && fig.querySelector('.rw-left');
  const cs=el=>{const c=getComputedStyle(el);return{size:parseFloat(c.fontSize),weight:+c.fontWeight,color:c.color};};
  out.fig=cs(fig); out.hint=cs(hint);
  out.figBiggerThanHint = out.fig.size - out.hint.size;

  // the two tabs must line their money column up in the same place
  const box=s=>{const e=document.querySelector(s);return e?Math.round(e.getBoundingClientRect().left):null;};
  out.spentLeftEdge = box('.subrow[data-row="ald"] .rw-money');
  out.spentGroupEdge = box('.cat.grp[data-row="food"] .rw-money');
  tabs.find(t=>t.dataset.planview==='planned').click(); await w(500);
  out.plannedLeftEdge = box('.subrow[data-row="ald"] .rw-money');
  out.plannedGroupEdge = box('.cat.grp[data-row="food"] .rw-money');
  out.columnsAgree = Math.abs(out.spentLeftEdge-out.plannedLeftEdge)<=1;
  /* and a group's column must sit where its children's does, in both modes */
  out.groupsAgree = Math.abs(out.plannedGroupEdge-out.plannedLeftEdge)<=1
                 && Math.abs(out.spentGroupEdge-out.spentLeftEdge)<=1;

  /* the header names a column, so it has to stand over that column. It is
     right-aligned and so is the money, so the right edges are the test. */
  const rt=s=>{const e=document.querySelector(s);return e?Math.round(e.getBoundingClientRect().right):null;};
  out.hdr = document.querySelectorAll('.plan-cols.two span')[1]?.textContent.trim();
  out.hdrRight = rt('.plan-cols.two span:nth-child(2)');
  out.moneyRight = rt('.subrow[data-row="ald"] .rw-money');
  out.headerOverColumn = Math.abs(out.hdrRight-out.moneyRight)<=6;

  // nothing overflows the phone
  out.over=[...document.querySelectorAll('#view-budget .subrow, #view-budget .cat.grp')]
    .filter(e=>e.getBoundingClientRect().right>391).length;
  /* min-width:0 lets the cell be narrower than its nowrap footnote, so measure
     the GLYPHS, not the box - a box that fits can still hold text that spills. */
  out.spill=[...document.querySelectorAll('#view-budget .rw-left')].filter(el=>{
    const r=document.createRange(); r.selectNodeContents(el);
    return [...r.getClientRects()].some(x=>x.right>391||x.left<0);
  }).length;
  return out;
});
/* The first pass of this probe only ever looked at 390px, and the width change
   it was guarding broke 320px instead - the emoji was pushed off the name line
   on the two longest categories. A layout probe that measures one width is a
   layout probe that reports the other as fine. */
await p.setViewportSize({width:320,height:1100});
await p.waitForTimeout(400);
const narrow=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  /* A GROUP row's name box is deliberately smaller than a leaf's - it shares
     the row with a collapse arrow and a child count - so the width floor is a
     claim about leaf rows only. Measuring both together set the floor by the
     narrowest box on screen and called a correct group row a failure. */
  const faces=(leavesOnly)=>[...document.querySelectorAll('#cats .rw-nm')].map(el=>{
    const e=el.querySelector('.rw-e'), t=el.querySelector('.rw-t');
    if(!e||!t) return null;
    if(leavesOnly && !el.closest('.subrow')) return null;
    const er=e.getBoundingClientRect(), tr=t.getBoundingClientRect();
    return {n:t.innerText, same:Math.abs(er.top-tr.top)<er.height, w:Math.round(tr.width)};
  }).filter(Boolean);
  const spill=()=>[...document.querySelectorAll('#cats .rw-left')].filter(el=>{
    const r=document.createRange(); r.selectNodeContents(el);
    return [...r.getClientRects()].some(x=>x.right>321||x.left<0);
  }).length;
  setPlanView('planned'); await w(400);
  o.plannedWrapped=faces().filter(x=>!x.same).map(x=>x.n);
  o.plannedNarrowest=Math.min(...faces(true).map(x=>x.w));
  o.plannedSpill=spill();
  setPlanView('spent'); await w(400);
  o.spentWrapped=faces().filter(x=>!x.same).map(x=>x.n);
  o.spentSpill=spill();
  o.edgesAgree=(()=>{const q=s=>{const e=document.querySelector(s);return e?Math.round(e.getBoundingClientRect().left):null;};
    return q('#cats .rw-money');})();
  return o;
});
await b.close();

const T=[
  ['a person parked on the removed view is carried to Planned', o.migrated==='planned', o.migrated],
  ['the switch is down to two tabs', o.tabs.join(',')==='Planned,Spent', o.tabs.join(',')],
  ['and the removed one is not still in the DOM', o.deadTab===false, String(o.deadTab)],
  ['Planned still answers what is left, on a leaf', /541\.67/.test(o.plannedAldi)&&/419\.40 left/.test(o.plannedAldi), o.plannedAldi],
  ['...and on a group', /1,191\.67/.test(o.plannedGroup)&&/left/.test(o.plannedGroup), o.plannedGroup],
  ['Spent now answers it too, which is what makes the cut lossless', /122\.27/.test(o.spentAldi)&&/419\.40 left/.test(o.spentAldi), o.spentAldi],
  ['...on a group as well', /122\.27/.test(o.spentGroup)&&/left/.test(o.spentGroup), o.spentGroup],
  ['a category with nothing spent still shows its remainder', /400 left/.test(o.spentSam), o.spentSam],
  ['the spent figure outranks its own footnote', o.figBiggerThanHint>=3 && o.fig.weight>=700, JSON.stringify({fig:o.fig,hint:o.hint})],
  ['...and is not drawn in the muted colour a caption uses', o.fig.color!==o.hint.color, o.fig.color+' vs '+o.hint.color],
  ['both tabs put the money column in the same place', o.columnsAgree, `${o.plannedLeftEdge} vs ${o.spentLeftEdge}`],
  ['...and a group lines up with its own children', o.groupsAgree,
   `planned ${o.plannedGroupEdge}/${o.plannedLeftEdge}, spent ${o.spentGroupEdge}/${o.spentLeftEdge}`],
  ['the column header stands over the column it names', o.headerOverColumn, `${o.hdr} ends ${o.hdrRight}, money ends ${o.moneyRight}`],
  ['nothing runs off a 390px phone', o.over===0, String(o.over)],
  ['and no remainder footnote spills past the screen edge', o.spill===0, String(o.spill)],
  ['at 320px the face keeps its place on the name, in Planned', narrow.plannedWrapped.length===0, narrow.plannedWrapped.join(' | ')],
  ['...and in Spent, which is the mode that got wider', narrow.spentWrapped.length===0, narrow.spentWrapped.join(' | ')],
  ['...leaving every leaf name real width to be read in', narrow.plannedNarrowest>=90, String(narrow.plannedNarrowest)],
  ['...and no remainder spilling off a 320px screen either',
   narrow.plannedSpill===0 && narrow.spentSpill===0, `${narrow.plannedSpill}/${narrow.spentSpill}`],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
console.log('page errors:', errs.length?errs.join(' | '):'none');
process.exit(bad?1:0);
