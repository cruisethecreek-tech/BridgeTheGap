/* "I want every section to have its own explainer card that opens when clicked.
    To minimize the initial on screen text even further."

   The mechanism already existed - Clean mode hides explanatory prose and puts a
   "?" beside its heading that opens a sheet - and it was reaching almost none of
   the prose it was built for. Three separate places had each hand-listed the set
   of "what counts as explanation", and they had drifted apart. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const VIEWS=['home','budget','tx','impulse','debt','goals','reflect','learn','diary','settings'];
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);
await p.evaluate(()=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify({
  onboarded:true,activeMonth:'2026-09',uiMode:'all',stageReached:3,guidesOff:true,sayMode:'clean',
  hourlyWage:24,hoursPerWeek:40,
  categories:[{id:'roof',name:'Roof'},{id:'food',name:'Food'}],budgets:{'2026-09':{roof:1200,food:600}},
  transactions:[{id:'i1',type:'income',amount:3200,date:'2026-09-01',source:'Pay',srcType:'primary'},
                {id:'e1',type:'expense',amount:80,date:'2026-09-03',catId:'food'}],
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:5000,updated:'2026-09-01'}],
  assets:[{id:'as1',name:'Brokerage',value:5741,kind:'real'}],
  goals:[{id:'g1',name:'Cushion',target:3000,saved:400}],
  recurring:[],impulse:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[]})));
await p.reload(); await p.waitForTimeout(1200);

const o=await p.evaluate(async(VIEWS)=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const out={ withProse:0, covered:0, uncovered:[], buttons:0, words:0, perView:{},
              missedBySelector:0, liveMoved:[] };
  for(const v of VIEWS){
    try{ activateTab(v); }catch(e){ continue; }
    await w(420);
    const root=document.getElementById('view-'+v); if(!root) continue;
    out.buttons+=root.querySelectorAll('.say-why').length;
    /* every paragraph the source marked as explanation must at least be SEEN by
       the collector - the bug was a marker read in one place, ignored in the
       place that decides what to look at */
    out.missedBySelector+=[...root.querySelectorAll('[data-say="1"]')]
      .filter(el=>el.offsetParent!==null && !el.matches(SAY_PROSE)).length;
    const vis=el=>el.offsetParent!==null && !el.classList.contains('say-hid');
    const paras=[...root.querySelectorAll('p,.sub,.tab-intro,.build-intro,.dk-sub,.hh-sub,.ltb-note')].filter(vis);
    const words=paras.reduce((s,el)=>s+((el.innerText||'').trim().split(/\s+/).filter(Boolean).length),0);
    out.words+=words; out.perView[v]=words;
    /* prose about the reader's own numbers must NOT be swept into a sheet */
    [...root.querySelectorAll('.ltb-note')].forEach(el=>{
      if(el.classList.contains('say-hid')) out.liveMoved.push(v+': ltb-note');
    });
    root.querySelectorAll('.panel,.databox,.acc-body').forEach(sec=>{
      if(sec.offsetParent===null) return;
      const head=sec.querySelector('h2,h3,.db-head,.ph-title,.acc-hd');
      if(!head||head.offsetParent===null) return;
      const prose=[...sec.querySelectorAll(SAY_PROSE)]
        .filter(el=>el.classList.contains('say-hid')||el.offsetParent!==null)
        .filter(el=>((el.innerText||'').trim().split(/\s+/).filter(Boolean).length)>=8);
      if(!prose.length) return;
      out.withProse++;
      if(sec.querySelector('.say-why')) out.covered++;
      else out.uncovered.push(`${v}: "${(head.innerText||'').trim().slice(0,30)}"`);
    });
  }
  /* and the card actually opens, titled by its own section, carrying the text */
  activateTab('home'); await w(500);
  const btn=document.querySelector('#view-home .say-why');
  out.hasHomeBtn=!!btn;
  if(btn){
    btn.click(); await w(420);
    const sheet=document.getElementById('saySheet');
    out.sheetOpen=!!(sheet&&sheet.classList.contains('on'));
    out.sheetTitle=(document.getElementById('saySheetTitle')||{textContent:''}).textContent.trim();
    out.sheetWords=((document.getElementById('sayBody')||{innerText:''}).innerText||'')
      .trim().split(/\s+/).filter(Boolean).length;
    out.ariaNamed=(btn.getAttribute('aria-label')||'');
  }
  return out;
},VIEWS);
await b.close();

const T=[
  ['every marked paragraph is at least seen by the collector',
   o.missedBySelector===0, `${o.missedBySelector} stamped data-say the selector cannot match`],
  ['every section carrying explanation offers it as a tap instead',
   o.withProse>0 && o.covered===o.withProse,
   `${o.covered} of ${o.withProse}${o.uncovered.length?' | still inline: '+o.uncovered.join(', '):''}`],
  ['...and there are real explainers on screen, not zero sections found',
   o.buttons>=12, String(o.buttons)],
  ['the opening screen is down to a glance, not a page of prose',
   o.perView.home<=60, `home ${o.perView.home} words`],
  ['...and no screen is carrying an essay',
   Math.max(...Object.values(o.perView))<=60, JSON.stringify(o.perView)],
  ['prose across the whole app stays under budget',
   o.words<=330, `${o.words} words`],
  ['what the app says about YOUR numbers is never swept out of sight',
   o.liveMoved.length===0, o.liveMoved.join(' | ')],
  ['the card opens on tap', o.hasHomeBtn===true && o.sheetOpen===true, String(o.sheetOpen)],
  ['...titled by the section it belongs to', !!o.sheetTitle, o.sheetTitle],
  ['...carrying the text that left the screen', o.sheetWords>=8, String(o.sheetWords)],
  ['...and reachable by a reader who cannot see the glyph',
   /what is/i.test(o.ariaNamed), o.ariaNamed],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
console.log('page errors:', errs.length?[...new Set(errs)].join(' | '):'none');
process.exit(bad?1:0);
