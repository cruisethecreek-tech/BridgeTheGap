import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
/* "The three ways of speaking has been lost - blunt and savage vocabulary has
   been lost, and only applied to the intake."
   Measured before anything changed: 9 of 738 lines on screen moved across the
   whole dial, and six tabs moved by nothing. The dial was decoration.
   What it must own is the app's ASSERTIONS. What it must never touch is a
   control's name. */
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const errs=[]; const R=[]; const ok=(n,v,d)=>R.push([n,!!v,d]);
/* a fresh budget with everything still to do, so every step fires */
const raw={onboarded:true,uiMode:'all',stageReached:1,guidesOff:true,sayMode:'full',
  register:'middle', activeMonth:'2026-09', householdOn:true, nameB:'Sam',
  categories:[{id:'c1',name:'Food'}],budgets:{},accounts:[],transactions:[],goals:[],debts:[]};
async function look(intensity, extra={}){
  const pg=await b.newPage({viewport:{width:390,height:900}});
  pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto('file://'+process.cwd()+'/app.html');
  await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)), {...raw,...extra,intensity});
  await pg.reload(); await pg.waitForTimeout(1400);
  const r=await pg.evaluate(async ()=>{
    const w=ms=>new Promise(r=>setTimeout(r,ms));
    const out={steps:[], leads:{}, labels:[]};
    activateTab('home'); await w(500);
    out.steps=[...document.querySelectorAll('#nextSteps .nextstep')].map(x=>x.innerText.replace(/\s+/g,' ').trim());
    out.hero=(document.getElementById('hhSub')||{innerText:''}).innerText.trim();
    out.walls=(document.getElementById('wallsTag')||{innerText:''}).innerText.trim();
    for(const t of ['budget','tx','impulse','debt','goals','diary']){
      activateTab(t); await w(380);
      const lead=document.querySelector('#view-'+t+' .tab-intro, #deck-'+t+' .dk-sub');
      out.leads[t]=lead?lead.innerText.trim():'';
      /* control names must be identical at every setting */
      [...document.querySelectorAll('#view-'+t+' button')]
        .filter(x=>!x.classList.contains('dk-chip')&&!x.classList.contains('say-why'))
        .forEach(x=>out.labels.push(t+'|'+x.innerText.trim()));
    }
    return out;
  });
  await pg.close(); return r;
}
const c=await look('clean'), bl=await look('blunt'), sv=await look('savage');

ok('the steps on Home change with the dial',
   JSON.stringify(c.steps)!==JSON.stringify(bl.steps) && JSON.stringify(bl.steps)!==JSON.stringify(sv.steps),
   (bl.steps[0]||'').slice(0,60));
ok('the opening line changes with it too', c.hero!==bl.hero && bl.hero!==sv.hero, sv.hero.slice(0,60));
ok('...and so does the line over the four walls', c.walls!==bl.walls && bl.walls!==sv.walls, sv.walls.slice(0,60));

const flat=Object.keys(c.leads).filter(t=>c.leads[t]===bl.leads[t]||bl.leads[t]===sv.leads[t]);
ok('every tab opens on a sentence that moves with the dial', flat.length===0, 'flat: '+flat.join(','));

ok('Savage is not just Blunt with a full stop moved',
   Object.keys(c.leads).every(t=>bl.leads[t]!==sv.leads[t]));

/* the half that matters just as much: what must NOT move */
ok('no control renames itself when the mood changes',
   JSON.stringify(c.labels)===JSON.stringify(sv.labels),
   c.labels.filter((x,i)=>x!==sv.labels[i]).slice(0,2).join(' | '));

/* the tone floor still holds - a hospital bill is never savaged */
const lock=await (async()=>{
  const pg=await b.newPage({viewport:{width:390,height:900}});
  await pg.goto('file://'+process.cwd()+'/app.html');
  await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),{...raw,intensity:'savage'});
  await pg.reload(); await pg.waitForTimeout(1200);
  const r=await pg.evaluate(()=>({ sensitive:effInt('Medical bill'), rent:effInt('Rent'), normal:effInt('Sneakers') }));
  await pg.close(); return r;
})();
ok('a medical bill is still spoken to gently, whatever the dial says', lock.sensitive==='clean', JSON.stringify(lock));
ok('...and rent too', lock.rent==='clean');
ok('...while an impulse buy gets the setting you chose', lock.normal==='savage', lock.normal);

/* the sync call to action */
const sync=await (async()=>{
  const pg=await b.newPage({viewport:{width:390,height:900}});
  await pg.goto('file://'+process.cwd()+'/app.html');
  await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
    {...raw,intensity:'blunt',householdOn:true,nameB:'Sam'});
  await pg.reload(); await pg.waitForTimeout(1400);
  const r=await pg.evaluate(async ()=>{
    const w=ms=>new Promise(r=>setTimeout(r,ms));
    activateTab('home'); await w(500);
    /* The step list only ever shows three, and a fresh budget fills all three
       with money basics - correctly. So the invitation is a banner, which is the
       same place the app already tells you sync is locked. */
    const inv=document.querySelector('#view-home .sync-invite');
    const step=inv&&inv.querySelector('[data-gosync]');
    const o={offered:!!inv, text:inv?inv.innerText.replace(/\s+/g,' ').trim():'',
             onPlan:!!document.querySelector('#view-budget .sync-invite')};
    if(step){ step.click(); await w(700);
      o.landedOn=document.body.dataset.view;
      const sp=document.getElementById('syncPanel');
      o.panelSeen=!!sp && sp.offsetParent!==null && sp.getBoundingClientRect().height>10;
      o.sectionOpen=!!sp && !!sp.closest('.dk-panel.dk-on'); }
    return o;
  });
  await pg.close(); return r;
})();
ok('a household with no sharing is told so, on Home', sync.offered===true, sync.text.slice(0,80));
ok('...and it names the person who cannot see it', /Sam cannot see/.test(sync.text), sync.text.slice(0,50));
ok('...and tapping it lands on the sync panel, opened', sync.landedOn==='settings' && sync.panelSeen===true, JSON.stringify(sync));
ok('...with the section it lives in already open', sync.sectionOpen===true, JSON.stringify(sync));

R.forEach(([n,p,d])=>{ if(!p) console.log('FAIL: '+n+(d?'  <'+d+'>':'')); });
const bad=R.filter(x=>!x[1]).length;
console.log(`${R.length-bad} of ${R.length} hold`);
console.log('page errors: '+(errs.length?errs.slice(0,2).join(' | '):'none'));
await b.close(); process.exit(bad||errs.length?1:0);
