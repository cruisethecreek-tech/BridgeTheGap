import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
/* "The content is good. It's just too distracting when the interface should be
   clean. The extra text should be optional to view."
   So: the words are all still there, and none of them are in the way. These
   checks are about both halves of that - what left the screen, and whether it
   is genuinely one tap away when you want it. */
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
const seed={onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-09',hourlyWage:30,
  categories:[{id:'c1',name:'Food'},{id:'c2',name:'Rent'}],budgets:{'2026-09':{c1:400,c2:1500}},
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:3000,updated:'2026-09-01'}],
  debts:[{id:'d1',name:'Visa',balance:2000,rate:19.9,min:60,kind:'card'}],
  goals:[{id:'g1',name:'Cushion',target:1000,saved:300}],
  transactions:[{id:'t1',type:'income',amount:3200,date:'2026-09-02',source:'Pay',acctId:'a1'}]};
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)), seed);
await pg.reload(); await pg.waitForTimeout(1400);

const R=[]; const ok=(n,v,d)=>R.push([n,!!v,d]);

ok('a new install opens Clean, not buried in prose',
   await pg.evaluate(()=>state.sayMode==='clean'));

await pg.evaluate(()=>activateTab('debt')); await pg.waitForTimeout(700);
const d1=await pg.evaluate(()=>{
  const r=document.querySelector('.view.on');
  return {btn:r.querySelectorAll('.say-why').length, hid:r.querySelectorAll('.say-hid').length,
    firstLabel:(r.querySelector('.say-why')||{}).getAttribute?r.querySelector('.say-why').getAttribute('aria-label'):''};
});
ok('the busiest screen puts its explanations behind buttons', d1.btn>0 && d1.hid>0, JSON.stringify(d1));
ok('and the button says which topic it explains',
   /^What is .+\?$/.test(d1.firstLabel||'') && !/\?\?/.test(d1.firstLabel||''), d1.firstLabel);

/* the tap */
const sheet=await pg.evaluate(()=>{
  const btn=document.querySelector('.view.on .say-why'); if(!btn) return null;
  btn.click();
  const ov=document.getElementById('saySheet');
  return {on:ov.classList.contains('on'),
    title:document.getElementById('saySheetTitle').innerText.trim(),
    paras:document.querySelectorAll('#sayBody .say-para').length,
    words:document.getElementById('sayBody').innerText.trim().split(/\s+/).length};
});
ok('tapping it opens a sheet', sheet && sheet.on, JSON.stringify(sheet));
ok('the sheet is titled with the topic, not "About this"', sheet && sheet.title && sheet.title!=='About this', sheet&&sheet.title);
ok('and it actually contains the words that left the panel', sheet && sheet.paras>0 && sheet.words>15, JSON.stringify(sheet));

ok('Back closes the sheet rather than leaving the tab',
   await pg.evaluate(()=>{ const r=closeTopOverlay(); return r===true && !document.getElementById('saySheet').classList.contains('on'); }));

/* nothing load-bearing may be hidden */
const safe=await pg.evaluate(()=>{
  const bad=[];
  ['home','budget','tx','goals','debt','settings','impulse','reflect','diary'].forEach(t=>{
    activateTab(t);
    document.querySelectorAll('.view.on .say-hid').forEach(el=>{
      const txt=(el.innerText||'').trim();
      if(el.dataset.say!=='1' && /[$%]|\b\d/.test(txt)) bad.push(t+': '+txt.slice(0,50));
      if(el.closest('.empty,.err,.error,form,fieldset')) bad.push(t+' [live box]: '+txt.slice(0,40));
    });
  });
  return bad;
});
ok('no figure the app calculated is ever hidden', safe.length===0, safe.slice(0,3).join(' | '));

/* the empty state and the live voice sample stay put */
/* Both of these live inside sections you open now, so the probe opens them -
   the question is whether they are still SAID, not whether Settings shows
   everything at once, which is the thing that was wrong. */
const keep=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('settings'); await w(500);
  deckShow('settings','Free comfort list'); await w(250);
  const empty=/Nothing yet\. Add a few things/.test(document.querySelector('.view.on').innerText);
  deckShow('settings','Setup & data'); await w(250);
  const sample=/Sounds like:/.test(document.querySelector('.view.on').innerText);
  return {empty, sample};
});
ok('an empty state still says it is empty', keep.empty);
ok('the voice sample still shows what you just picked', keep.sample);

/* the other two modes still work */
const modes=await pg.evaluate(async ()=>{
  const out={};
  for(const m of ['full','brief','clean']){
    state.sayMode=m; save(); sayPass('settings');
    /* prose to measure has to be on screen, so keep one section open */
    deckShow('settings','Setup & data'); sayPass('settings');
    await new Promise(r=>setTimeout(r,180));
    const r=document.querySelector('.view.on');
    out[m]={why:r.querySelectorAll('.say-why').length, hid:r.querySelectorAll('.say-hid').length,
            clamp:r.querySelectorAll('.sub.clampable').length};
  }
  return out;
});
ok('Full shows everything and removes the buttons', modes.full.why===0 && modes.full.hid===0, JSON.stringify(modes.full));
ok('Brief goes back to clipping in place, not hiding', modes.brief.hid===0 && modes.brief.why===0, JSON.stringify(modes.brief));
ok('Clean hides again when you switch back', modes.clean.hid>0 && modes.clean.why>0, JSON.stringify(modes.clean));

/* a render must not undo it */
const survive=await pg.evaluate(async ()=>{
  activateTab('impulse'); await new Promise(r=>setTimeout(r,500));
  const a=document.querySelectorAll('.view.on .say-hid').length;
  renderAll(); await new Promise(r=>setTimeout(r,350));
  return {a, b:document.querySelectorAll('.view.on .say-hid').length};
});
ok('re-rendering a panel does not bring the prose back', survive.b>=survive.a && survive.a>0, JSON.stringify(survive));

/* the watcher must settle, not chase itself */
const settle=await pg.evaluate(async ()=>{
  let n=0; const orig=window.sayPassInner;
  window.sayPassInner=function(v){ n++; return orig.apply(this,arguments); };
  renderAll(); await new Promise(r=>setTimeout(r,900));
  window.sayPassInner=orig; return n;
});
ok('and the watcher settles instead of looping', settle<8, 'passes='+settle);

R.forEach(([n,p,d])=>{ if(!p) console.log('FAIL: '+n+(d?'  <'+d+'>':'')); });
const bad=R.filter(x=>!x[1]).length;
console.log(`${R.length-bad} of ${R.length} hold`);
console.log('page errors: '+(errs.length?errs.slice(0,2).join(' | '):'none'));
await b.close();
process.exit(bad||errs.length?1:0);
