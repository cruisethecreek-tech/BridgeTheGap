import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
/* A fixed handle over left-aligned text clipped the first characters of every
   line it crossed ("See the ladder" -> "e the ladder"). This asks the only
   question that matters: does it sit on top of any words? */
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:844}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'clean',activeMonth:'2026-09',hourlyWage:70,
  householdOn:true,categories:[{id:'c1',name:'Food'},{id:'c2',name:'Rent'}],budgets:{'2026-09':{c1:900,c2:2200}},
  accounts:[{id:'a1',name:'Chequing',kind:'checking',balance:85819,updated:'2026-09-01'}],
  transactions:[{id:'t1',type:'expense',amount:888,date:'2026-09-03',catId:'c1',acctId:'a1'}]});
await pg.reload(); await pg.waitForTimeout(1600);
const R=[]; const ok=(n,v,d)=>R.push([n,!!v,d]);
const r=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const g=document.getElementById('glance');
  if(g) g.style.display='';
  await w(200);
  const tab=document.getElementById('glanceTab');
  const tr=tab.getBoundingClientRect();
  const out={side: tr.left > innerWidth/2 ? 'right':'left', over:[]};
      const textHits=(el,tr)=>{
        for(const n of el.childNodes){
          if(n.nodeType!==3 || !n.textContent.trim()) continue;
          const rg=document.createRange(); rg.selectNodeContents(n);
          for(const r2 of rg.getClientRects()){
            if(r2.width<1||r2.height<1) continue;
            if(r2.left<tr.right && r2.right>tr.left && r2.top<tr.bottom && r2.bottom>tr.top) return true;
          }
        }
        return false;
      };
  /* every word-bearing element the handle's box actually covers */
  for(const t of ['home','budget','goals','debt']){
    activateTab(t); await w(420);
    document.querySelectorAll('.view.on h2,.view.on h3,.view.on p,.view.on button,.view.on .stat-l,.view.on b').forEach(el=>{
      const s=getComputedStyle(el); if(s.display==='none'||s.visibility==='hidden') return;
      const r2=el.getBoundingClientRect();
      if(r2.height<4||r2.width<4) return;
      if(!(el.innerText||'').trim()) return;
      if(textHits(el,tr)) out.over.push(t+': '+(el.innerText||'').trim().slice(0,34));
    });
  }
  return out;
});
ok('the quick-glance handle sits on the ragged edge of lines, not their start', r.side==='right', r.side);
ok('...so it covers no words on any tab', r.over.length===0, r.over.slice(0,3).join(' | '));
R.forEach(([n,p,d])=>{ if(!p) console.log('FAIL: '+n+(d?'  <'+d+'>':'')); });
const bad=R.filter(x=>!x[1]).length;
console.log(`${R.length-bad} of ${R.length} hold`);
console.log('page errors: '+(errs.length?errs.slice(0,2).join(' | '):'none'));
await b.close(); process.exit(bad||errs.length?1:0);
