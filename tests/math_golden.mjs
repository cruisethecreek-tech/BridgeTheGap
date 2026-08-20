/* GOLDEN SCENARIOS - the arithmetic is written out longhand so a human with a
   calculator can confirm the app agrees with reality, not merely with itself.
   Every expected value below was worked out by hand, not read off the screen. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{width:390,height:900} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/app.html');

const S = {
  onboarded:true, activeMonth:'2026-08', stageReached:3,
  hourlyWage:0, hoursPerWeek:50,             // wage derived, so we test the fallback too
  categories:[
    {id:'roof',name:'Roof'},
    {id:'ga',name:'Getting Around'},{id:'gas',name:'Gas',parentId:'ga'},
    {id:'car1',name:'Car 1',parentId:'gas'},{id:'car2',name:'Car 2',parentId:'gas'},
    {id:'pw',name:'Power & Wi-Fi'},{id:'water',name:'Water',parentId:'pw'},{id:'elec',name:'Electric',parentId:'pw'},
    {id:'food',name:'Food'}
  ],
  budgets:{'2026-08':{ roof:1200, ga:500, gas:300, car1:180, car2:150, water:70, elec:130, food:400 }},
  transactions:[
    {id:'i1',type:'income',amount:5000,source:'Paycheck',date:'2026-08-01'},
    {id:'e1',type:'expense',amount:1200,catId:'roof',date:'2026-08-02'},
    {id:'e2',type:'expense',amount:90,catId:'car1',date:'2026-08-05'},
    {id:'e3',type:'expense',amount:60,catId:'car2',date:'2026-08-07'},
    {id:'e4',type:'expense',amount:45,catId:'water',date:'2026-08-09'},
    {id:'v1',type:'invest',amount:400,source:'Roth',date:'2026-08-10',ikind:'holds'},
    {id:'v2',type:'invest',amount:100,source:'Supplements',date:'2026-08-11',ikind:'self'}
  ],
  assets:[{id:'as1',name:'Invested capital',value:400,kind:'real',cost:0,auto:'invest'}],
  liabilities:[{id:'l1',name:'Visa',value:2000}],
  accounts:[
    {id:'a1',name:'Checking',kind:'checking',purpose:'',balance:3200,updated:'2026-08-15'},
    {id:'a2',name:'Emergency',kind:'savings',purpose:'emergency',balance:2400,updated:'2026-08-15'},
    {id:'a3',name:'401k',kind:'invest',purpose:'retire',balance:18000,updated:'2026-08-15'}
  ],
  recurring:[], goals:[], debts:[], timeLog:[], comfortMenu:[]
};

/* ---- worked by hand ----
 Assigned (each pool counted ONCE, parent = max(own, sum of kids)):
   Roof                 1200
   Getting Around       max(500, Gas) where Gas = max(300, 180+150=330) = 330  -> max(500,330) = 500
   Power & Wi-Fi        max(0,   70+130=200)                                   = 200
   Food                  400
   TOTAL                1200 + 500 + 200 + 400                                 = 2300
 Left to budget = income 5000 - assigned 2300                                  = 2700
 Spent (expenses only, invest excluded) = 1200+90+60+45                        = 1395
 catSpent(Getting Around) = 90 + 60                                            = 150
 catSpent(Gas)            = 90 + 60                                            = 150
 catSpent(Power & Wi-Fi)  = 45                                                 = 45
 Invested this month = 400 + 100                                               = 500
 Logged net (all time) = 5000 - 1395 - 500                                     = 3105
 Bank total = 3200 + 2400 + 18000                                              = 23600
 Liquid (401k is not liquid) = 3200 + 2400                                     = 5600
 Net worth = assets 400 + bank 23600 - liabilities 2000                        = 22000
 Essentials (the four walls, rolled up) = 1200 + 500 + 200 + 400               = 2300
 Runway = (real assets 400 + liquid 5600 - liabilities 2000) / 2300 = 4000/2300 = 1.739...
 Hourly fallback = income 5000 / month-hours(50/wk) where 50*52/12 = 216.667    = 23.0769
 Emergency fund in months = 2400 / 2300                                        = 1.043...
------------------------- */
const EXPECT = {
  assigned:2300, leftToBudget:2700, spent:1395,
  spentGettingAround:150, spentGas:150, spentPowerWifi:45,
  invested:500, loggedNet:3105, bank:23600, liquid:5600, netWorth:22000,
  essentials:2300, runway:1.7391, hourly:23.0769, emergencyMonths:1.0435
};

const got = await p.evaluate((seed)=>{
  state=normalizeState(Object.assign(defaultState(), seed));
  const M=state.activeMonth;
  const r4=x=>Math.round(x*10000)/10000;
  return {
    assigned: topCats().reduce((s,c)=>s+catAssigned(c.id,M),0),
    leftToBudget: monthIncome(M)-topCats().reduce((s,c)=>s+catAssigned(c.id,M),0),
    spent: monthExpense(M),
    spentGettingAround: catSpent('ga',M), spentGas: catSpent('gas',M), spentPowerWifi: catSpent('pw',M),
    invested: monthInvested(M), loggedNet: allTimeBalance(),
    bank: bankTotal(), liquid: liquidTotal(), netWorth: netWorth(),
    essentials: essentialMonthly(), runway: r4(freedomRunway()),
    hourly: r4(effectiveHourly()), emergencyMonths: r4(earmarked('emergency')/essentialMonthly())
  };
}, S);

let fails=0;
console.log('GOLDEN SCENARIO - hand-computed vs app\n');
for(const k of Object.keys(EXPECT)){
  const want=EXPECT[k], have=got[k];
  const ok=Math.abs(want-have)<=0.01;
  if(!ok) fails++;
  console.log((ok?'  ok   ':'  FAIL ')+k.padEnd(20)+' expected '+String(want).padStart(10)+'   got '+String(have).padStart(10));
}
console.log('\n'+(fails?fails+' MISMATCH(ES)':'all '+Object.keys(EXPECT).length+' hand-computed figures match'));
console.log('page errors:', errs.length?[...new Set(errs)]:'none');
await b.close();
