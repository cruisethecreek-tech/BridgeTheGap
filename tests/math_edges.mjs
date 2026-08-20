/* Hostile-input suite: the states a fuzzer rarely stumbles into but real life
   produces - empty, enormous, negative, fractional cents, leap days, month ends,
   legacy saves missing every new key, and deliberately corrupt records. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{width:390,height:900} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/app.html');

const CASES = {
  'totally empty': {},
  'legacy save (none of the new keys)': {onboarded:true,activeMonth:'2026-08',intensity:'blunt',
     categories:[{id:'c1',name:'Food'}],budgets:{'2026-08':{c1:100}},
     transactions:[{id:'t1',type:'expense',amount:40,catId:'c1',date:'2026-08-03'}],
     recurring:[{id:'r1',type:'expense',amount:50,catId:'c1',day:3}]},
  'enormous numbers': {onboarded:true,activeMonth:'2026-08',hourlyWage:1e6,
     categories:[{id:'c1',name:'Roof'}],budgets:{'2026-08':{c1:9e12}},
     transactions:[{id:'t1',type:'income',amount:9e12,source:'X',date:'2026-08-01'}],
     accounts:[{id:'a1',name:'Vault',kind:'checking',purpose:'',balance:9e12,updated:'2026-08-01'}]},
  'negative + zero balances': {onboarded:true,activeMonth:'2026-08',hourlyWage:0,
     categories:[{id:'c1',name:'Food'}],budgets:{'2026-08':{c1:0}},
     accounts:[{id:'a1',name:'Overdrawn',kind:'checking',purpose:'',balance:-450,updated:'2026-08-01'}],
     liabilities:[{id:'l1',name:'Visa',value:5000}]},
  'fractional cents': {onboarded:true,activeMonth:'2026-08',hourlyWage:19.9999,
     categories:[{id:'c1',name:'Food'},{id:'c2',name:'Sub',parentId:'c1'}],
     budgets:{'2026-08':{c1:0.005,c2:0.004}},
     transactions:[{id:'t1',type:'expense',amount:0.001,catId:'c2',date:'2026-08-02'}]},
  'leap day + month ends': {onboarded:true,activeMonth:'2028-02',
     recurring:[{id:'r1',type:'expense',amount:100,catId:null,freq:'monthly',anchor:'2028-01-31'},
                {id:'r2',type:'expense',amount:50,catId:null,freq:'semimonthly',anchor:'2028-01-30'},
                {id:'r3',type:'expense',amount:20,catId:null,freq:'weekly',anchor:'2028-02-26'}]},
  'corrupt records': {onboarded:true,activeMonth:'2026-08',
     categories:[{id:'c1',name:'Food'},{id:'orphan',name:'Ghost',parentId:'does-not-exist'}],
     budgets:{'2026-08':{c1:'notanumber',missing:50}},
     transactions:[{id:'t1',type:'expense',amount:null,catId:'gone',date:'2026-08-02'},
                   {id:'t2',type:'income',amount:100,source:'X',date:'not-a-date'}],
     accounts:[{id:'a1',name:'X',kind:'nonsense',purpose:'nope',balance:'abc',updated:''}],
     goals:[{id:'g1',name:'Dream',target:0,saved:500}]},
  'deep nesting fully funded': {onboarded:true,activeMonth:'2026-08',
     categories:[{id:'a',name:'Getting Around'},{id:'b',name:'Gas',parentId:'a'},
                 {id:'c',name:'Car 1',parentId:'b'},{id:'d',name:'Car 2',parentId:'b'}],
     budgets:{'2026-08':{a:400,b:250,c:150,d:100}},
     transactions:[{id:'t1',type:'expense',amount:60,catId:'c',date:'2026-08-05'}]}
};

const out={};
for(const [name,seed] of Object.entries(CASES)){
  out[name] = await p.evaluate((s)=>{
    const bad=[]; const finite=x=>typeof x==='number'&&isFinite(x);
    try{ state=normalizeState(Object.assign(defaultState(), s)); }
    catch(e){ return ['normalizeState threw: '+e.message]; }
    const M=state.activeMonth;
    const nums={netWorth:netWorth(),assigned:topCats().reduce((t,c)=>t+catAssigned(c.id,M),0),
      spent:monthExpense(M),balance:allTimeBalance(),bank:bankTotal(),invested:monthInvested(M),
      runway:freedomRunway(),essentials:essentialMonthly(),hourly:effectiveHourly()};
    Object.entries(nums).forEach(([k,v])=>{ if(v!==null && !finite(v)) bad.push(k+' is '+v); });
    try{ postRecurring(M); postRecurring(M); }catch(e){ bad.push('postRecurring threw: '+e.message); }
    ['home','budget','tx','impulse','goals','debt','learn','settings'].forEach(t=>{
      try{ activateTab(t); }catch(e){ bad.push('render threw on '+t+': '+e.message); }
    });
    const txt=document.body.innerText||'';
    if(/NaN/.test(txt)) bad.push('NaN visible');
    if(/\$undefined|Infinity/.test(txt)) bad.push('undefined/Infinity visible');
    return bad.length?bad:['clean'];
  }, seed);
}
console.log(JSON.stringify(out,null,1));
console.log('page errors:', errs.length?[...new Set(errs)]:'none');
await b.close();
