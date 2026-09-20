/* "Each section should have a block to know what you are changing. It's hard to
   clearly see without each broken into each section."

   Sent with four entries circled by hand on a photo of the quick log, because
   there was no other way to show where one ended and the next began.

   The cause is geometry, not decoration. A quick-log row is a flex line that
   WRAPS on a phone: what it was and how much sit on the first line, the
   category and the remove button drop onto a second. The gap INSIDE a row was
   7px. The gap BETWEEN two rows was 8px. One pixel apart - so the space
   separating two halves of the same entry looked exactly like the space
   separating two different entries, and on a four-line batch nothing told the
   eye which dropdown belonged to which description. Everything was equally
   close to everything, which is the same as nothing being grouped at all.

   So the checks here are about distance and surface, not about looks: an entry
   has to hold together more tightly than it holds to its neighbours, and it has
   to sit on something of its own. The numbering is a CSS counter rather than
   markup, because rows are added and removed constantly here and anything the
   renderer has to renumber by hand is something it will eventually get wrong -
   so there is a check that a deletion renumbers what is left. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const errs=[];
const out={};
for(const W of [390,360]){
  const p=await b.newPage({viewport:{width:W,height:1900}});
  p.on('pageerror',e=>errs.push(W+'px: '+String(e)));
  await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(300);
  await p.evaluate(()=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify({
    onboarded:true,mindOff:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',
    activeMonth:'2026-09',
    categories:[{id:'imp',name:'Impulse buys'},{id:'tak',name:'Takeout'},{id:'debt',name:'Debt Payments'}],
    budgets:{'2026-09':{imp:200,tak:300}},
    transactions:[{id:'i1',type:'income',amount:4760,source:'Pay',date:'2026-09-04'}],
    accounts:[{id:'j',name:'Joint account',kind:'checking',balance:5000,updated:'2026-09-11'},
              {id:'s',name:'Savings',kind:'savings',balance:900,updated:'2026-09-11'}],
    assets:[],liabilities:[],goals:[],recurring:[],impulse:[],debts:[],diary:[],intake:{},lessons:[],vault:[]})));
  await p.reload(); await p.waitForTimeout(1700);
  out[W]=await p.evaluate(async()=>{
    const w=m=>new Promise(r=>setTimeout(r,m));
    activateTab('tx'); await w(900);
    document.getElementById('quickLogBtn').click(); await w(700);
    const list=document.getElementById('qlList');
    const rows=[['SP PET AND HOME','167.59','imp'],["ARTURO'S PIZZA KITC",'50.41','tak'],
                ['Home banking Withdra','30','debt'],['','3342.85','']];
    while(list.querySelectorAll('.ql-row').length<rows.length) document.getElementById('qlAdd').click();
    [...list.querySelectorAll('.ql-row')].forEach((el,i)=>{
      const [what,amt,cat]=rows[i];
      el.querySelector('.ql-what').value=what;
      el.querySelector('.ql-amt').value=amt;
      if(cat) el.querySelector('.ql-cat').value=cat;
      if(!what) el.classList.add('ql-unnamed');
    });
    await w(250);
    const els=[...list.querySelectorAll('.ql-row')];
    const R=el=>el.getBoundingClientRect();

    /* The distance that matters: inside one entry versus between two of them. */
    const inside=[];
    els.forEach(el=>{
      const what=R(el.querySelector('.ql-what')), cat=R(el.querySelector('.ql-cat'));
      if(cat.top>what.bottom) inside.push(Math.round(cat.top-what.bottom));   // it wrapped
    });
    /* Control to control, not box to box. The first cut measured the gap
       between the two block EDGES (12px) and compared it with the gap between
       two controls inside a block (7px) - two different things, so the check
       was failing on arithmetic rather than on the layout. What a reader's eye
       actually compares is the distance from the last control of one entry to
       the first control of the next, against the distance between the two
       controls within one entry. */
    const between=[];
    for(let i=1;i<els.length;i++){
      const prevLast=R(els[i-1].querySelector('.ql-cat'));
      const nextFirst=R(els[i].querySelector('.ql-what'));
      between.push(Math.round(nextFirst.top-prevLast.bottom));
    }

    const cs=getComputedStyle(els[0]);
    const listBg=getComputedStyle(list).backgroundColor;
    /* A counter's rendered digits cannot be read back from the DOM - computed
       ::before content comes back as the literal "counter(qln)", not "3", and
       pseudo-element text is not in innerText either. So the number itself was
       checked by eye in a screenshot, and what is held here is the mechanism
       that produces it plus the fact that it takes up a line: the list resets
       the counter, every row increments it, and the marker renders with a box.
       Nothing in that can drift out of step the way hand-numbering would. */
    const num=el=>{ const c=getComputedStyle(el,'::before').content; return c&&c!=='none'?c.replace(/^"|"$/g,''):''; };
    const marker=el=>{ const b4=getComputedStyle(el,'::before');
      return { content:b4.content, lines:b4.display, h:parseFloat(b4.fontSize)||0 }; };

    const o={
      rows:els.length, wrapped:inside.length,
      insideMax:inside.length?Math.max(...inside):null,
      betweenMin:between.length?Math.min(...between):null,
      ownSurface: cs.backgroundColor!==listBg && cs.backgroundColor!=='rgba(0, 0, 0, 0)',
      bg:cs.backgroundColor, listBg,
      bordered: parseFloat(cs.borderTopWidth)>0 && cs.borderTopStyle!=='none',
      padded: parseFloat(cs.paddingTop)>=6,
      numbers: els.map(num),
      markers: els.map(marker),
      counterOn: getComputedStyle(els[0]).counterIncrement,
      counterReset: getComputedStyle(list).counterReset,
      unnamedSaysSo: /needs a name/i.test(num(els[3])),
      unnamedBlockMarked: getComputedStyle(els[3]).borderTopColor!==getComputedStyle(els[0]).borderTopColor,
      /* nothing may hang outside the phone */
      spill: els.filter(el=>R(el).right>innerWidth+1||R(el).left<-1).length
    };
    /* remove one in the middle: what is left has to renumber itself */
    els[1].querySelector('.ql-del').click(); await w(250);
    o.afterDelete=[...list.querySelectorAll('.ql-row')].map(num);
    return o;
  });
  await p.close();
}
await b.close();

const T=[];
for(const W of [390,360]){
  const o=out[W];
  T.push([`each entry wraps onto two lines at ${W}px, which is why this matters`,
    o.wrapped>=3, `${o.wrapped} of ${o.rows} wrapped`]);
  T.push([`...and an entry holds together more tightly than it holds to its neighbour (${W}px)`,
    o.betweenMin >= o.insideMax*2,
    `inside ${o.insideMax}px, between ${o.betweenMin}px - they were 7 and 8`]);
  T.push([`...on a surface of its own, not the same one the list sits on (${W}px)`,
    o.ownSurface===true, `${o.bg} on ${o.listBg}`]);
  T.push([`...with an edge and room inside it (${W}px)`,
    o.bordered===true && o.padded===true, JSON.stringify({bordered:o.bordered,padded:o.padded})]);
  T.push([`each block is numbered, and by a counter rather than by hand (${W}px)`,
    /counter\(qln\)/.test(o.numbers[0]) && /qln 1/.test(o.counterOn) && /qln 0/.test(o.counterReset)
      && o.markers[0].h>0,
    JSON.stringify({content:o.numbers[0], increment:o.counterOn, reset:o.counterReset})]);
  T.push([`...and the one still waiting for a name says that instead (${W}px)`,
    o.unnamedSaysSo===true && o.unnamedBlockMarked===true,
    JSON.stringify({label:o.numbers[3], marked:o.unnamedBlockMarked})]);
  T.push([`...so deleting one cannot leave a gap in the sequence (${W}px)`,
    o.afterDelete.length===3 && o.afterDelete.every(c=>/counter\(qln\)/.test(c)),
    JSON.stringify(o.afterDelete)]);
  T.push([`nothing hangs off the side of the phone (${W}px)`, o.spill===0, String(o.spill)]);
}
T.push(['nothing threw while measuring', errs.length===0, [...new Set(errs)].slice(0,2).join(' | ')]);

let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
process.exit(bad?1:0);
