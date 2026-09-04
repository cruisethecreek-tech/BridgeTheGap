import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
/* "The purple should be actionable and blue is still not formatted enough to
   actually know what it is."
   Purple: "and 16 more, all of them on Track" - a sentence naming a place
   instead of opening one. Blue: "© + = £1 = Accounts Move Money Check" printed
   as though it were a name somebody could recognise. */
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
const tx=[];
for(let i=0;i<23;i++) tx.push({id:'t'+i,type:'invest',amount:5+i,catId:null,
  source:'ACH Withdrawal / Acorns Round-Ups Transfer 090426',date:'2026-09-04',acctId:'chk',ikind:'holds'});
tx.push({id:'soup',type:'invest',amount:25,source:'© + = £1 = Accounts Move Money Check',
         date:'2026-09-04',acctId:'chk',ikind:'holds'});
await pg.evaluate(([s,tx])=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify({...s,transactions:tx})),
 [{onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'full',activeMonth:'2026-09',hourlyWage:70,
   categories:[{id:'c1',name:'Food'}],budgets:{'2026-09':{c1:400}},
   accounts:[{id:'chk',name:'Joint Checking',kind:'checking',balance:6637.64,updated:'2026-08-27',purpose:'sinking'}]}, tx]);
await pg.reload(); await pg.waitForTimeout(1600);
const R=[]; const ok=(n,v,d)=>R.push([n,!!v,d]);

const open=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('goals'); deckShow('goals','Accounts'); await w(700);
  const det=document.querySelector('.ac-work'); if(det) det.open=true; await w(300);
  const rows=[...document.querySelectorAll('.acw-r')];
  return {rowsShown:rows.length,
    rowsAreButtons:rows.every(r=>r.tagName==='BUTTON'),
    more:!!document.querySelector('[data-acwall]'),
    moreIsButton:(document.querySelector('[data-acwall]')||{}).tagName==='BUTTON',
    moreText:(document.querySelector('[data-acwall]')||{innerText:''}).innerText.trim(),
    soupShown:rows.some(r=>/Accounts Move Money/.test(r.innerText)),
    needsName:rows.some(r=>/Needs a name/.test(r.innerText))};
});
ok('the tail is a control, not a sentence about somewhere else',
   open.more===true && open.moreIsButton===true && !/on Track/.test(open.moreText), open.moreText);
ok('every entry is a button that opens it', open.rowsShown>0 && open.rowsAreButtons===true, String(open.rowsShown));
ok('a name OCR never actually read is not printed as though it were one',
   open.soupShown===false, JSON.stringify(open));
ok('...it says what it needs instead', open.needsName===true, JSON.stringify(open));

const more=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const before=document.querySelectorAll('.acw-r').length;
  document.querySelector('[data-acwall]').click(); await w(500);
  const det=document.querySelector('.ac-work'); if(det) det.open=true; await w(250);
  const after=document.querySelectorAll('.acw-r').length;
  const less=!!document.querySelector('[data-acwless]');
  document.querySelector('[data-acwless]').click(); await w(500);
  const d2=document.querySelector('.ac-work'); if(d2) d2.open=true; await w(250);
  return {before, after, less, back:document.querySelectorAll('.acw-r').length};
});
ok('tapping it shows the rest, where you are already looking',
   more.after>more.before && more.after===24, JSON.stringify(more));
ok('...and offers to fold them back up', more.less===true && more.back===more.before, JSON.stringify(more));

const tap=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const det=document.querySelector('.ac-work'); if(det) det.open=true; await w(250);
  const row=[...document.querySelectorAll('.acw-r')].find(r=>/Needs a name/.test(r.innerText));
  if(!row) return {found:false};
  row.click(); await w(450);
  const sheet=document.getElementById('txSheet');
  return {found:true, opened:sheet.classList.contains('on'),
          editable:!!sheet.querySelector('[data-txedit]')};
});
ok('tapping the unreadable one opens it so it can be given a name',
   tap.found && tap.opened===true && tap.editable===true, JSON.stringify(tap));

/* the working must not be cut off - it is the one number that may never truncate */
const fit=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  closeTopOverlay(); await w(250);
  const det=document.querySelector('.ac-work'); if(det) det.open=true; await w(300);
  const doc=document.documentElement;
  const sum=document.querySelector('.acw-sum');
  const over=[...document.querySelectorAll('.ac-work *')]
    .filter(e=>e.getBoundingClientRect().right>doc.clientWidth+1)
    .map(e=>e.className).slice(0,3);
  return {over, text:(sum&&sum.innerText||'').replace(/\s+/g,' '),
          scrollW:doc.scrollWidth, clientW:doc.clientWidth};
});
ok('the working fits the phone it is read on', fit.over.length===0 && fit.scrollW<=fit.clientW,
   JSON.stringify(fit.over)+' '+fit.scrollW+'/'+fit.clientW);
ok('...and the total it ends on is not cut in half', /=\s*\$[\d,]+\.\d\d\s*$/.test(fit.text), fit.text.slice(-40));

R.forEach(([n,p,d])=>{ if(!p) console.log('FAIL: '+n+(d?'  <'+d+'>':'')); });
const bad=R.filter(x=>!x[1]).length;
console.log(`${R.length-bad} of ${R.length} hold`);
console.log('page errors: '+(errs.length?errs.slice(0,2).join(' | '):'none'));
await b.close(); process.exit(bad||errs.length?1:0);
