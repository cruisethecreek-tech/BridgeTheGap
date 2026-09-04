/* Two rounds of "is that even the build you are looking at?" with no way to
   answer it, on either side. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,200):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:1000}});
pg.on('pageerror',e=>console.log('PAGEERROR',String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(()=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-09',
  categories:[],budgets:{},transactions:[],goals:[],impulse:[],recurring:[],accounts:[],assets:[],
  liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[]})));
await pg.reload(); await pg.waitForTimeout(900);
const r=await pg.evaluate(async()=>{
  const w=ms=>new Promise(x=>setTimeout(x,ms));
  activateTab('settings'); deckShow('settings','Which version is this'); await w(600);
  const el=document.getElementById('buildLine');
  return { there:!!el, text:(el||{innerText:''}).innerText.replace(/\s+/g,' '),
    stamp:BUILD_STAMP, visible:!!(el&&el.offsetParent) };
});
ok('the app can say which build it is', r.there===true && r.visible===true);
ok('...and it is stamped, not left as a placeholder',
   r.stamp.indexOf('__')!==0 && /\d{4}-\d{2}-\d{2}/.test(r.stamp), r.stamp);
ok('...shown where somebody can read it out', new RegExp(r.stamp.split(' ')[0]).test(r.text), r.text.slice(0,90));
ok('...saying what it is for', /report something/i.test(r.text), r.text.slice(-90));
console.log(`\n${pass} of ${pass+fail} hold`);
await b.close();
process.exit(fail?1:0);
