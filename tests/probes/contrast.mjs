import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
/* --ink is a recessed SURFACE in this file, not a text colour - the token
   declaration says so in a comment. Using it for text renders near-invisible
   copy that reads as a disabled control. Measured, so it cannot come back. */
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const errs=[]; const R=[]; const ok=(n,v,d)=>R.push([n,!!v,d]);
for(const theme of ['light','dark']){
  const pg=await b.newPage({viewport:{width:390,height:844}, colorScheme:theme});
  pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto('file://'+process.cwd()+'/app.html');
  await pg.evaluate(([s,t])=>{localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)); localStorage.setItem('theme',t);},
   [{onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'clean',theme,activeMonth:'2026-09',hourlyWage:70,
     householdOn:true,categories:[{id:'c1',name:'Food'}],budgets:{'2026-09':{c1:900}},
     accounts:[{id:'a1',name:'Chequing',kind:'checking',balance:85819,updated:'2026-09-01'}],
     transactions:[{id:'t1',type:'expense',amount:888,date:'2026-09-03',catId:'c1',acctId:'a1'}]}, theme]);
  await pg.reload(); await pg.waitForTimeout(1600);
  const res=await pg.evaluate(()=>{
    activateTab('debt');
    const lum=c=>{const m=c.match(/[\d.]+/g).map(Number);
      const f=v=>{v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);};
      return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2]);};
    const ratio=(a,b)=>{const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);};
    const bgOf=el=>{let e=el; while(e){const c=getComputedStyle(e).backgroundColor;
      if(c&&!/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; e=e.parentElement;} return 'rgb(255,255,255)';};
    const out={};
    const chip=document.querySelector('#deck-home .dk-chip');
    if(chip) out.chip=+ratio(getComputedStyle(chip).color, bgOf(chip)).toFixed(2);
    sayPass('debt');
    // the sheet body, opened for real
    const why=document.querySelector('.view.on .say-why')||document.querySelector('.say-why');
    if(why){ why.click();
      const p=document.querySelector('#sayBody .say-para');
      if(p) out.sheet=+ratio(getComputedStyle(p).color, bgOf(p)).toFixed(2);
      closeTopOverlay(); }
    return out;
  });
  ok(`the "more" rows are readable in ${theme}`, res.chip>=4.5, theme+' chip contrast '+res.chip);
  if(res.sheet!==undefined) ok(`the explanation sheet is readable in ${theme}`, res.sheet>=4.5, theme+' sheet contrast '+res.sheet);
  await pg.close();
}
R.forEach(([n,p,d])=>{ if(!p) console.log('FAIL: '+n+(d?'  <'+d+'>':'')); else console.log('ok   '+n+'  ('+d+')'); });
const bad=R.filter(x=>!x[1]).length;
console.log(`${R.length-bad} of ${R.length} hold`);
console.log('page errors: '+(errs.length?errs.slice(0,2).join(' | '):'none'));
await b.close(); process.exit(bad||errs.length?1:0);
