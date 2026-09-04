import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
/* "Audit the entire app to ensure this doesn't happen again."
   The Sovereignty Audit printed a tier and three figures built from a panel two
   screens away, and never said so. The general fault: a HEADLINE figure - one
   the app computed rather than one you typed - stating itself with no way to
   ask where it came from. A number you typed needs no explanation. A number the
   app derived and cannot justify is asking to be trusted. */
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',hourlyWage:30,hoursPerWeek:40,
  categories:[{id:'c1',name:'Food'},{id:'c2',name:'Rent'}],budgets:{'2026-08':{c1:400,c2:1400}},
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:3000,updated:'2026-08-01'}],
  transactions:[{id:'t1',type:'income',amount:3000,date:'2026-08-05',source:'Pay',acctId:'a1'},
                {id:'t2',type:'expense',amount:440,date:'2026-08-10',catId:'c1',acctId:'a1'}],
  goals:[{id:'g1',name:'Kitchen',target:9000,saved:1000,date:'',goalType:'foundation'}],
  impulse:[{id:'i1',type:'skip',amount:60,date:'2026-08-09'}],recurring:[],
  assets:[{id:'as1',name:'Rental',value:120000,kind:'real',cost:0},
          {id:'as2',name:'Car',value:9000,kind:'stuff',cost:200}],
  liabilities:[{id:'l1',name:'Card',value:800,apr:22}],diary:[],intake:{},lessons:[],
  debts:[{id:'d1',name:'Visa',balance:2400,apr:23.9,minPayment:75}],debtBudget:500,
  vault:[],snapshots:[{month:'2026-07',bank:2500,owed:0}]});
await pg.reload(); await pg.waitForTimeout(900);
const TABS=['home','budget','tx','debt','goals','reflect','learn','impulse','diary','settings'];
const bare=[];
for(const t of TABS){
  await pg.evaluate(n=>activateTab(n), t);
  await pg.waitForTimeout(450);
  const found=await pg.evaluate(v=>{
    const sec=document.getElementById('view-'+v); if(!sec) return [];
    const out=[];
    /* The headline figures: the big derived numbers each panel leads with. */
    const SEL='.stat .s-v,.fstat .s-v,.sov-m .v,.hero-num,.nw,.verdict,.t-name,.lev-n,.room-n,.rg-v';
    for(const el of sec.querySelectorAll(SEL)){
      if(!el.offsetParent) continue;
      const txt=el.textContent.trim();
      if(!/[0-9]/.test(txt) && !/tier/i.test(txt)) continue;    // a word is not a figure
      /* is there a way to ask, on it or on the block that holds it? */
      const host=el.closest('.stat,.fstat,.sov-m,.sov-tier,.panel,.levcard,.roomgoal,.acc-body');
      const ask=host&&host.querySelector('[data-why],.why-q,details,summary,[data-work],.ac-work');
      if(ask) continue;
      /* typed, not derived - the box beside it IS the explanation */
      if(host&&host.querySelector('input,select,textarea')) continue;
      const label=(host&&(host.querySelector('.s-k,.k,.t-sub,h2')||{}).textContent||'').trim().slice(0,34);
      out.push(`${label||'?'} = ${txt.slice(0,18)}`);
    }
    return out;
  }, t);
  found.forEach(f=>bare.push(t+' → '+f));
}
console.log(bare.length?'FIGURES THAT WILL NOT SHOW THEIR WORKING:\n  '+bare.join('\n  ')
                       :'every headline figure can be asked where it came from');
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit((typeof empty!=='undefined'?empty.length:0)+(typeof bare!=='undefined'?bare.length:0)?1:0);
