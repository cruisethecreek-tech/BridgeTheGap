import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
/* The general form of the Tripwires bug: a container an id-based render fills,
   which nothing calls on the path a person actually takes. Boot, then walk every
   tab exactly as a thumb would, and report any container still empty. */
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',hourlyWage:30,
  categories:[{id:'c1',name:'Food'}],budgets:{'2026-08':{c1:400}},
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:3000,updated:'2026-08-01'}],
  transactions:[{id:'t1',type:'income',amount:3000,date:'2026-08-05',source:'Pay',acctId:'a1'},
                {id:'t2',type:'expense',amount:40,date:'2026-08-10',catId:'c1',acctId:'a1'}],
  goals:[{id:'g1',name:'Kitchen',target:9000,saved:1000,date:'',goalType:'foundation'}],
  impulse:[],recurring:[],assets:[{id:'as1',name:'Car',value:9000,kind:'stuff',cost:200}],
  liabilities:[{id:'l1',name:'Card',value:800,apr:22}],diary:[],intake:{},lessons:[],
  debts:[{id:'d1',name:'Visa',balance:2400,apr:23.9,minPayment:75}],vault:[],snapshots:[]});
await pg.reload(); await pg.waitForTimeout(900);
const TABS=['home','budget','tx','debt','goals','reflect','learn','impulse','diary','settings'];
const empty=[];
for(const t of TABS){
  await pg.evaluate(n=>activateTab(n), t);
  await pg.waitForTimeout(420);
  /* The signal, narrowed to the shape of the actual bug: a PANEL whose whole
     body is empty. An empty banner or result slot is correct - it fills when
     there is something to say. A panel that is a heading, an intro and nothing
     else is a room with no furniture, and it looks to a person exactly like a
     feature that does not work. */
  const bad=await pg.evaluate(v=>{
    const sec=document.getElementById('view-'+v); if(!sec) return [];
    const out=[];
    for(const panel of sec.querySelectorAll('.panel, details.acc')){
      if(panel.classList.contains('panel-waiting')) continue;   // gated on purpose, and it says why
      if(panel.tagName==='DETAILS' && !panel.open) continue;    // a closed drawer draws on open
      if(getComputedStyle(panel).display==='none') continue;
      const body=panel.tagName==='DETAILS'?panel.querySelector('.acc-body'):panel;
      if(!body) continue;
      /* anything a person could read or press, other than the panel's own
         heading and its intro paragraph */
      const meat=[...body.children].filter(el=>{
        if(el.tagName==='H2'||el.tagName==='SUMMARY') return false;
        if(el.tagName==='P'&&el.classList.contains('sub')) return false;
        if(el.classList.contains('sub-more')) return false;
        if(getComputedStyle(el).display==='none') return false;
        return el.textContent.trim().length>0 || el.querySelector('input,select,textarea,button');
      });
      if(!meat.length){
        const h=(panel.querySelector('h2,.acc-hd')||{}).textContent||'(unnamed)';
        out.push(h.trim().slice(0,40));
      }
    }
    return out;
  }, t);
  bad.forEach(h=>empty.push(t+' → "'+h+'"'));
}
console.log(empty.length?'EMPTY CONTAINERS AFTER A NORMAL WALK:\n  '+empty.join('\n  ')
                        :'every container on every tab got filled by walking there');
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit((typeof empty!=='undefined'?empty.length:0)+(typeof bare!=='undefined'?bare.length:0)?1:0);
