/* "Log against it pulls up the number pad but doesn't record anything." From
   inside a category's sheet. The trail switched tabs and focused the amount and
   never closed the SHEET on top, so the field took focus behind an overlay. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:1000}});
pg.on('pageerror',e=>errs.push(String(e)));
const M=(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;})();
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(([s,M])=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify({...s,activeMonth:M,budgets:{[M]:{sc:329,rent:1400}}})),
 [{onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,hourlyWage:25,
   categories:[{id:'rent',name:'Rent'},{id:'sc',name:'Sugarcreek'}],
   transactions:[],goals:[],impulse:[],recurring:[],accounts:[],assets:[],liabilities:[],
   diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[],scans:[]}, M]);
await pg.reload(); await pg.waitForTimeout(900);

const r = await pg.evaluate(async () => {
  const w=ms=>new Promise(x=>setTimeout(x,ms));
  activateTab('budget'); await w(500);
  openCatSheet('sc'); await w(450);
  const o={ sheetOpen:document.getElementById('catSheet').classList.contains('on') };
  const btn=[...document.querySelectorAll('#catSheet [data-trail="logspend"]')][0];
  o.hasBtn=!!btn;
  o.carriesCat=btn && btn.dataset.trailcat==='sc';
  btn.click(); await w(700);
  o.sheetClosedAfter=!document.getElementById('catSheet').classList.contains('on');
  o.anyOverlayLeft=document.querySelectorAll('.modal-overlay.on').length;
  o.tab=(document.querySelector('.view.on')||{}).id;
  const amt=document.getElementById('txAmt');
  /* the actual fault: the field the number pad opened for has to be ON SCREEN */
  const rect=amt.getBoundingClientRect();
  o.amtVisible=rect.width>0 && rect.height>0 && !!amt.offsetParent;
  o.focused=document.activeElement===amt;
  o.catPreselected=(document.getElementById('txCat')||{}).value;
  /* and it has to actually record */
  amt.value='41.10'; amt.dispatchEvent(new Event('input',{bubbles:true}));
  document.getElementById('addTx').click(); await w(400);
  const t=state.transactions[0];
  o.logged=!!t; o.amount=t&&t.amount; o.filedUnder=t&&t.catId;
  return o;
});
ok('the category sheet offers a way to log against it', r.hasBtn===true && r.sheetOpen===true);
ok('...and it carries the category it was pressed from', r.carriesCat===true, String(r.carriesCat));
ok('pressing it closes the sheet instead of leaving it over the form',
   r.sheetClosedAfter===true && r.anyOverlayLeft===0, `overlays left: ${r.anyOverlayLeft}`);
ok('...and lands on Track', r.tab==='view-tx', r.tab);
/* the reported symptom, stated as the property it broke */
ok('the field the number pad opens for is actually on screen',
   r.amtVisible===true && r.focused===true, JSON.stringify([r.amtVisible,r.focused]));
ok('...with the category you came from already chosen', r.catPreselected==='sc', r.catPreselected);
ok('...so typing an amount records, which is the whole complaint',
   r.logged===true && r.amount===41.10, JSON.stringify([r.logged,r.amount]));
ok('...against the category whose sheet you pressed it in, not whatever was selected',
   r.filedUnder==='sc', String(r.filedUnder));

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
