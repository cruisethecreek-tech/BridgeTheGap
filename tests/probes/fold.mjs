/* "This is entirely too. Much text and facts in one scroll.. Think about the
    physiology of bombarding new users with an overload of numbers and
    information."

   The explainer cards moved PROSE and did nothing about figures: the payoff
   planner put 21 of them in front of somebody who came to ask one question, and
   the count was identical in all three modes because no mode had ever been
   about numbers. A fold is that same card idea applied to facts. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);
const SEED={onboarded:true,activeMonth:'2026-09',uiMode:'all',stageReached:3,guidesOff:true,
  sayMode:'brief',                      /* the mode the report came from */
  hourlyWage:70,hoursPerWeek:40,debtBudget:1500,debtStrategy:'snowball',
  categories:[{id:'roof',name:'Roof'}],budgets:{'2026-09':{roof:1200}},
  transactions:[{id:'i1',type:'income',amount:5000,date:'2026-09-01',source:'Pay'}],
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:5000,updated:'2026-09-01'}],
  debts:[{id:'d1',name:'Heloc',balance:1282.76,apr:3.49,min:100,kind:'heloc',limit:25000},
         {id:'d2',name:'Bears Den mortgage',balance:78000,apr:4.375,min:850,kind:'mortgage',worth:234800,secured:true}],
  assets:[],goals:[],recurring:[],impulse:[],liabilities:[],diary:[],intake:{},lessons:[],vault:[]};
await p.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),SEED);
await p.reload(); await p.waitForTimeout(1300);

const o=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const out={};
  const figs=()=>{const t=(document.getElementById('view-debt').innerText||'');
    return (t.match(/\$[\d,]+(?:\.\d\d)?|\b\d+(?:\.\d+)?%|\b(?:19|20)\d\d\b|\b\d+ ?(?:hrs?|yrs?|mo)\b/g)||[]).length;};
  activateTab('debt'); await w(900);
  const root=document.getElementById('view-debt');
  out.figures=figs();
  out.chips=[...root.querySelectorAll('.fold-chip')].map(c=>c.textContent.trim());
  /* Same pill height as the deck's, because a second size is a second thing to
     learn and the ask was explicitly for one language across the app. */
  const ch=[...root.querySelectorAll('.fold-chip')].map(c=>Math.round(c.getBoundingClientRect().height));
  const dk=[...document.querySelectorAll('.dk-chip')].filter(c=>c.offsetParent!==null)
    .map(c=>Math.round(c.getBoundingClientRect().height));
  out.chipH=Math.min(...ch); out.deckH=dk.length?Math.min(...dk):0;
  /* a person in Brief must get the same cards a person in Clean gets */
  out.whys=root.querySelectorAll('.say-why').length;
  out.mode=state.sayMode;
  out.noClampLeft=root.querySelectorAll('.sub-more,.clampable').length;
  /* the one answer that stays */
  out.heroText=(root.querySelector('.debt-hero')||{innerText:''}).innerText.replace(/\s+/g,' ').trim();
  /* open one */
  const chip=[...root.querySelectorAll('.fold-chip')].find(c=>/Month by month/i.test(c.textContent));
  out.hadChart=!!root.querySelector('[data-fold="Month by month"] svg');
  chip.click(); await w(450);
  const sheet=document.getElementById('saySheet'), body=document.getElementById('sayBody');
  out.opened=!!(sheet&&sheet.classList.contains('on'));
  out.title=(document.getElementById('saySheetTitle')||{textContent:''}).textContent.trim();
  out.sheetHasChart=!!body.querySelector('svg');
  /* MOVED, not copied - a clone would have dropped the chart's own listeners */
  out.movedNotCopied = body.querySelectorAll('svg').length===1
                    && root.querySelectorAll('[data-fold="Month by month"] svg').length===0;
  out.chartTapTargets=body.querySelectorAll('[data-hit],[data-chart],rect').length;
  /* opening a second fold must hand the first one back, not strand it */
  const other=[...root.querySelectorAll('.fold-chip')].find(c=>/interest/i.test(c.textContent));
  other.click(); await w(450);
  out.secondTitle=(document.getElementById('saySheetTitle')||{textContent:''}).textContent.trim();
  out.firstReturned=!!root.querySelector('[data-fold="Month by month"] svg');
  /* closing hands it back too */
  dismissOverlay(); await w(400);
  out.closed=!(document.getElementById('saySheet')||{classList:{contains:()=>false}}).classList.contains('on');
  out.allReturned=root.querySelectorAll('[data-fold]').length===4
                && [...root.querySelectorAll('[data-fold]')].every(el=>el.closest('#sayBody')===null);
  out.figuresAfter=figs();
  return out;
});
/* A panel re-rendering while its fold is open. Renderers rebuild with innerHTML,
   so the block's way home disappears underneath it - and the bookkeeping that
   tidies up is the same bookkeeping a naive sweep would have just deleted.
   Neither fault shows as a visible bug on the day: the screen looks right,
   while a dead subtree sits in the sheet and the map grows on every render. */
const race=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); await w(700);
  const root=()=>document.getElementById('view-debt');
  const o={ groupsAtStart:foldGroups.size };
  root().querySelector('.fold-chip').click(); await w(400);
  renderDebtResults(); sayPass('debt'); await w(600);   // the rug, pulled
  dismissOverlay(); await w(400);
  o.chips=root().querySelectorAll('.fold-chip').length;
  o.folds=root().querySelectorAll('[data-fold]').length;
  o.stranded=document.getElementById('sayBody').querySelectorAll('[data-fold]').length;
  root().querySelector('.fold-chip').click(); await w(400);
  o.reopens=document.getElementById('saySheet').classList.contains('on')
         && ((document.getElementById('sayBody')||{innerText:''}).innerText||'').trim().length>10;
  dismissOverlay(); await w(300);
  for(let i=0;i<6;i++){ renderDebtResults(); sayPass('debt'); await w(150); }
  o.groupsAfter=foldGroups.size;
  o.chipsAfter=root().querySelectorAll('.fold-chip').length;
  return o;
});

/* The report was the worst offender in the app: nine findings, each carrying
   five to thirteen figures, ninety-three in one scroll. The finding stays; its
   numbers go behind a tap. */
const rf=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('reflect'); await w(900);
  const root=document.getElementById('view-reflect');
  const t=(root.innerText||'');
  const out={ figures:(t.match(/\$[\d,]+(?:\.\d\d)?|\b\d+(?:\.\d+)?%|\b(?:19|20)\d\d\b|\b\d+ ?(?:hrs?|yrs?|mo)\b/g)||[]).length,
    chips:root.querySelectorAll('.fold-chip').length,
    findings:root.querySelectorAll('.rp-t').length,
    height:Math.round(root.scrollHeight) };
  /* every finding keeps its headline on the page - a report you cannot scan is
     not a report, however short it is */
  out.titlesVisible=[...root.querySelectorAll('.rp-t')].every(e=>e.offsetParent!==null);
  const chip=root.querySelector('.fold-chip');
  if(chip){
    chip.click(); await w(450);
    out.opened=document.getElementById('saySheet').classList.contains('on');
    /* the sheet names the FINDING, not the chip - they are deliberately different */
    out.sheetTitle=(document.getElementById('saySheetTitle')||{textContent:''}).textContent.trim();
    out.chipLabel=chip.textContent.trim();
    dismissOverlay(); await w(350);
  }
  return out;
});
await b.close();

const T=[
  ['the report came from Brief, and Brief now gets the same cards as Clean',
   o.mode==='brief' && o.whys>=2, `${o.mode} whys=${o.whys}`],
  ['...with the clip-and-More pattern gone entirely', o.noClampLeft===0, String(o.noClampLeft)],
  ['the screen leads with one answer, not a wall of figures',
   /Debt-free by/.test(o.heroText) && !/Total interest/.test(o.heroText), o.heroText.slice(0,70)],
  ['the rest of the facts wait behind named chips', o.chips.length===4,
   o.chips.join(' | ')],
  ['...and each chip says what it holds, not "more"',
   o.chips.every(c=>c.length>6 && !/^more/i.test(c)), o.chips.join(' | ')],
  ['the chips are a thumb-sized target, the same size as the pills beside them',
   o.chipH>=36 && (o.deckH===0 || o.chipH===o.deckH), `fold ${o.chipH}px vs deck ${o.deckH}px`],
  ['the figures a new arrival is met with drop well under the old 21',
   o.figures<=10, `${o.figures} on arrival`],
  ['a fold opens in the same sheet the explainers use', o.opened===true, String(o.opened)],
  ['...titled by its own name', /Month by month/i.test(o.title), o.title],
  ['...carrying the real chart, moved rather than copied',
   o.hadChart && o.sheetHasChart && o.movedNotCopied,
   JSON.stringify({had:o.hadChart, inSheet:o.sheetHasChart, moved:o.movedNotCopied})],
  ['...with its tap targets intact, so the chart still works',
   o.chartTapTargets>0, String(o.chartTapTargets)],
  ['opening another hands the first one back rather than stranding it',
   /interest/i.test(o.secondTitle) && o.firstReturned===true,
   `${o.secondTitle} | returned=${o.firstReturned}`],
  ['closing the sheet puts everything back where it belongs',
   o.closed===true && o.allReturned===true, `closed=${o.closed} back=${o.allReturned}`],
  ['...and the screen is as short as it was before anything opened',
   o.figuresAfter===o.figures, `${o.figures} then ${o.figuresAfter}`],
  ['a panel re-rendering under an open fold strands nothing in the sheet',
   race.stranded===0 && race.chips===4 && race.folds===4, JSON.stringify(race)],
  ['...and the fold still opens afterwards, with its content',
   race.reopens===true, String(race.reopens)],
  ['...and the bookkeeping does not grow by four on every render',
   race.groupsAfter<=8 && race.chipsAfter===4, `${race.groupsAfter} groups after 8 renders`],
  ['the report stops firing ninety-three figures at one arrival',
   rf.figures<=15, `${rf.figures} on the report`],
  ['...while every finding keeps its headline on the page',
   rf.findings>=5 && rf.titlesVisible===true, `${rf.findings} findings, all visible=${rf.titlesVisible}`],
  ['...each with its own way in', rf.chips>=rf.findings, `${rf.chips} chips for ${rf.findings} findings`],
  ['...and the sheet names the finding, not the chip',
   rf.opened===true && rf.sheetTitle.length>10 && rf.sheetTitle!==rf.chipLabel,
   `chip "${rf.chipLabel}" -> sheet "${rf.sheetTitle}"`],
  ['the report is no longer five screens tall', rf.height<=2600, `${rf.height}px`],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
console.log('page errors:', errs.length?[...new Set(errs)].join(' | '):'none');
process.exit(bad?1:0);
