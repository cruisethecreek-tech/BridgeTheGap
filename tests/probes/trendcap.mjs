/* "It is not showing correct figures on graph."

   Two faults, and the screenshot had both of them in one scroll.

   1. The Investing line plots investedUpTo(m) - a RUNNING TOTAL - while the
      caption under it counted only that month's entries. Seeded across two
      months it read "$1,565.40 ... 2 entries behind it, biggest: Fidelity
      $365.40", and two entries worth $565.40 do not add to $1,565.40. It
      happened to agree for somebody whose investing was all in one month, which
      is the worst way for a fault like this to hide: it is correct until the
      day it is not, and nothing changes on screen when it stops being correct.

   2. The category breakdown renders directly under the trend card with nothing
      between them. So "Everything you have put away, adding up as it goes" was
      immediately followed by Roof $1,248.38 and Food $718.25 - money that is
      spending, under a heading that says Investing. The sentence explaining the
      two halves lives at the top of the tab and has scrolled away by the time
      anybody reaches the list.

   A list with no heading of its own borrows the one above it. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);

const TX=[
  /* investing in TWO months, so cumulative and this-month cannot coincide */
  {id:'v1',type:'invest',amount:1000,source:'Acorns',date:'2026-08-10',ikind:'holds'},
  {id:'v2',type:'invest',amount:200,source:'Acorns Later Transfer',date:'2026-09-03',ikind:'holds'},
  {id:'v3',type:'invest',amount:365.40,source:'Fidelity',date:'2026-09-08',ikind:'holds'},
  {id:'i1',type:'income',amount:4000,source:'Pay',date:'2026-09-02'},
  {id:'e1',type:'expense',amount:1248.38,catId:'c1',date:'2026-09-04'},
  {id:'e2',type:'expense',amount:718.25,catId:'c2',date:'2026-09-05'}];
await p.evaluate(([s,tx])=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify({...s,transactions:tx})),
 [{onboarded:true,mindOff:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',activeMonth:'2026-09',
   categories:[{id:'c1',name:'Roof'},{id:'c2',name:'Food'}],budgets:{'2026-09':{c1:1300,c2:800}},
   accounts:[],assets:[],liabilities:[],goals:[],recurring:[],impulse:[],debts:[],diary:[],
   intake:{},lessons:[],vault:[]},TX]);
await p.reload(); await p.waitForTimeout(1800);

const o=await p.evaluate(async()=>{
  const w=m=>new Promise(x=>setTimeout(x,m));
  const flat=el=>(el?el.innerText:'').replace(/\s+/g,' ').trim();
  activateTab('reflect'); await w(1000);
  document.querySelector('[data-rf="trends"]').click(); await w(900);

  trendPick='invest'; renderTrendSeries(); await w(600);
  const inv={ cap:flat(document.getElementById('trendBody')),
              cumulative:investedUpTo('2026-09'), thisMonth:monthInvested('2026-09') };
  const cat=flat(document.getElementById('catChart'));

  trendPick='spent'; renderTrendSeries(); await w(600);
  const spent={ cap:flat(document.getElementById('trendBody')), val:monthExpense('2026-09') };

  /* the list is the same whichever line is picked above it, which is the whole
     reason it must name itself */
  const catAgain=flat(document.getElementById('catChart'));
  return { inv, spent, cat, catAgain,
    headingFirst: cat.indexOf('Spent in September 2026')===0,
    headingBeforeRows: cat.indexOf('Spent in September 2026') < cat.indexOf('Roof'),
    sameBothWays: cat===catAgain };
});

await b.close();

const capInv=o.inv.cap, capSpent=o.spent.cap;
const T=[
  ['the investing line really is a running total, not one month',
   o.inv.cumulative===1565.4 && o.inv.thisMonth===565.4,
   JSON.stringify({cumulative:o.inv.cumulative, month:o.inv.thisMonth})],
  ['...and the headline shown is that running total',
   /Investing \$1,565\.40/.test(capInv), capInv.slice(0,90)],
  ['the entry count no longer claims to account for a figure it cannot',
   !/2 entr(y|ies) behind it/.test(capInv), capInv.slice(0,150)],
  ['...it says what those entries did - added this month - and how many there are in all',
   /2 entries added it this month, 3 in all/.test(capInv), capInv.slice(0,170)],
  ['...and the biggest is labelled as this month\'s, not the total\'s',
   /biggest this month: Fidelity/.test(capInv), capInv.slice(0,190)],
  ['the movement since last month is still the movement, not the total',
   /up \$565\.40 since Aug/.test(capInv), capInv.slice(0,110)],

  ['a series that is NOT cumulative still reads "behind it", because there it is true',
   /entr(y|ies) behind it/.test(capSpent) && !/added it this month/.test(capSpent),
   capSpent.slice(0,140)],
  ['...and never claims a total it does not have',
   !/in all/.test(capSpent), capSpent.slice(0,140)],

  ['the category list names itself before its first row',
   o.headingFirst===true && o.headingBeforeRows===true, o.cat.slice(0,80)],
  ['...says which month it is about', /Spent in September 2026/.test(o.cat), o.cat.slice(0,60)],
  ['...and says out loud that it is not the line above it',
   /it is not the line above it/.test(o.cat), o.cat.slice(0,130)],
  ['...whichever line is picked above it, because it never changes with it',
   o.sameBothWays===true, String(o.sameBothWays)],
  ['the rows under that heading are spending, and add to what was spent',
   /Roof \$1,248\.38/.test(o.cat) && /Food \$718\.25/.test(o.cat) && o.spent.val===1966.63,
   JSON.stringify({spent:o.spent.val})],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
console.log('page errors:', errs.length?[...new Set(errs)].join(' | '):'none');
process.exit(bad?1:0);
