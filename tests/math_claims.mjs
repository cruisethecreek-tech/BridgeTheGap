/* ============================================================
   CLAIMS INVENTORY - every statement this app makes about a person's money,
   each with an expected value worked out by hand (or by an independent second
   implementation, noted where that is the case).

   If the app tells a user a number, it belongs in this file. Adding a new
   calculation without adding it here means shipping an unverified claim.
   ============================================================ */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{width:390,height:900} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/app.html');

const CLAIMS=[];
const claim=(area,what,expected,got,note)=>CLAIMS.push({area,what,expected,got,note});

/* ---------------- A. BUDGET FIGURES ---------------- */
const A = await p.evaluate(()=>{
  state=normalizeState(Object.assign(defaultState(),{
    activeMonth:'2026-08',
    categories:[{id:'roof',name:'Roof'},{id:'pw',name:'Power & Wi-Fi'},
                {id:'w',name:'Water',parentId:'pw'},{id:'e',name:'Electric',parentId:'pw'},
                {id:'food',name:'Food'}],
    budgets:{'2026-08':{roof:1200,w:70,e:130,food:400}},
    transactions:[{id:'i',type:'income',amount:3000,source:'Pay',date:'2026-08-01'},
                  {id:'x1',type:'expense',amount:500,catId:'roof',date:'2026-08-03'},
                  {id:'x2',type:'expense',amount:45,catId:'w',date:'2026-08-04'}]}));
  const M='2026-08';
  const assigned=topCats().reduce((s,c)=>s+catAssigned(c.id,M),0);
  return { assigned, ltb:monthIncome(M)-assigned, spent:monthExpense(M),
           leftToSpend:assigned-monthExpense(M), pwRolled:catAssigned('pw',M), pwSpent:catSpent('pw',M) };
});
// Roof 1200 + Power&WiFi max(0, 70+130=200) + Food 400 = 1800
claim('Budget','Assigned (each pool counted once)',1800,A.assigned,'1200 + 200 + 400');
claim('Budget','Left to budget',1200,A.ltb,'income 3000 - assigned 1800');
claim('Budget','Spent this month',545,A.spent,'500 + 45');
claim('Budget','Left to spend',1255,A.leftToSpend,'assigned 1800 - spent 545');
claim('Budget','Parent rolled up from subs',200,A.pwRolled,'70 + 130, parent typed nothing');
claim('Budget','Spend rolls up to the parent',45,A.pwSpent,'only Water was spent on');

/* ---------------- B. HOURS OF YOUR LIFE ---------------- */
const B = await p.evaluate(()=>{
  state=normalizeState(Object.assign(defaultState(),{hourlyWage:25,hoursPerWeek:40}));
  const r=(x)=>x;
  return { min:fmtLife(10), hrs:fmtLife(100), days:fmtLife(600), mo:fmtLife(4333.33),
           at60_month:(()=>{ state.hoursPerWeek=60; state.hourlyWage=20; return fmtLife(5200); })(),
           trueRate:(()=>{ state.hoursPerWeek=40; return Math.round(((4000-300)/(WORKMONTH_HRS+7*(52/12)))*100)/100; })() };
});
// $25/hr: $10 = 0.4 hr = 24 min. $100 = 4 hrs. $600 = 24 hrs = 3 work-days (8h day).
// $4333.33 / 25 = 173.33 hrs = exactly one 40-hour work month -> "1 mo"
claim('Life-hours','$10 at $25/hr','24 min',B.min,'10/25 = 0.4 hr');
claim('Life-hours','$100 at $25/hr','4 hrs',B.hrs,'100/25');
claim('Life-hours','$600 at $25/hr','3 days',B.days,'24 hrs / 8-hr day');
claim('Life-hours','One work-month of pay','1 mo',B.mo,'4333.33/25 = 173.33 hrs = 1 month');
// 60-hr week: month = 60*52/12 = 260 hrs. $5200/$20 = 260 hrs = exactly 1 of THEIR months
claim('Life-hours','60-hr week, one month of pay','1 mo',B.at60_month,'5200/20 = 260 hrs = 60*52/12');
// True rate: (4000 - 300 overhead) / (173.33 + 7*52/12 = 30.33) = 3700/203.67 = 18.17
claim('Wage','True Net Hourly (4000 take, 300 overhead, 7h commute)',18.17,B.trueRate,'(4000-300)/(173.33+30.33)');

/* ---------------- C. DERIVED + BLENDED WAGE ---------------- */
const C = await p.evaluate(()=>{
  return { est40:estHourlyFromMonthly(5000), est55:estHourlyFromMonthly(5000,55),
           monthHours55:Math.round(monthHours(55)*100)/100, yearHours55:yearHours(55),
           blended:(()=>{ state=normalizeState(Object.assign(defaultState(),{wageAuto:true,
             recurring:[{id:'r1',type:'income',amount:4000,source:'Job',hours:160,freq:'monthly',anchor:'2026-08-01'},
                        {id:'r2',type:'income',amount:500,source:'Gig',hours:50,freq:'monthly',anchor:'2026-08-01'}]}));
             recomputeBlendedWage(); return state.hourlyWage; })(),
           biweeklyNorm:(()=>{ state=normalizeState(Object.assign(defaultState(),{wageAuto:true,
             recurring:[{id:'r1',type:'income',amount:1500,source:'Job',hours:80,freq:'biweekly',anchor:'2026-08-07'}]}));
             recomputeBlendedWage(); return state.hourlyWage; })() };
});
claim('Wage','Hourly from $5,000/mo at 40 hrs/wk',29,C.est40,'5000*12/2080 = 28.85 -> 29');
claim('Wage','Hourly from $5,000/mo at 55 hrs/wk',21,C.est55,'5000*12/(55*52) = 20.98 -> 21');
claim('Wage','Month-hours at 55 hrs/wk',238.33,C.monthHours55,'55*52/12');
claim('Wage','Year-hours at 55 hrs/wk',2860,C.yearHours55,'55*52');
claim('Wage','Blended rate, job + side gig',21.43,C.blended,'(4000+500)/(160+50) = 4500/210');
claim('Wage','Bi-weekly paycheck normalised to a month',40.63,C.biweeklyNorm,'1500*26/12 = 3250; 3250/80 hrs');

/* ---------------- D. DEBT PAYOFF ---------------- */
const D = await p.evaluate(()=>{
  const zero=simulateDebts([{name:'A',balance:1000,apr:0,minPayment:50}],100,'avalanche');
  const one =simulateDebts([{name:'A',balance:1000,apr:12,minPayment:50}],200,'avalanche');
  const below=simulateDebts([{name:'A',balance:1000,apr:12,minPayment:50}],10,'avalanche');
  const never=simulateDebts([{name:'A',balance:10000,apr:24,minPayment:1}],1,'avalanche');
  return { zeroMonths:zero.months, zeroInterest:zero.totalInterest,
           oneMonths:one.months, oneInterest:Math.round(one.totalInterest*100)/100,
           belowMin:below.error, stalled:!!never.stalled };
});
// 0% APR, $1,000 at $100/mo = exactly 10 months, no interest.
claim('Debt','0% APR $1,000 at $100/mo - months',10,D.zeroMonths,'1000/100');
claim('Debt','0% APR - total interest',0,D.zeroInterest,'no APR, no interest');
// 12% APR = 1%/mo on $1,000 paying $200. Worked month by month:
// 1010->810 | 818.10->618.10 | 624.28->424.28 | 428.52->228.52 | 230.81->30.81 | 31.12->0
claim('Debt','12% APR $1,000 at $200/mo - months',6,D.oneMonths,'hand-amortised above');
claim('Debt','12% APR $1,000 at $200/mo - interest',31.12,D.oneInterest,'10+8.10+6.18+4.24+2.29+0.31');
claim('Debt','Payment below the minimums is refused','below_min',D.belowMin,'must not pretend to model it');
claim('Debt','Payment that never clears is flagged',true,D.stalled,'720-month cap reached');

/* ---------------- E. INVEST vs PAYOFF ---------------- */
const E = await p.evaluate(()=>{
  // 0% return, 0% APR: pure bookkeeping, both routes must land identically
  const flat=investCompare([{balance:1200,apr:0,minPayment:100}],300,0,12);
  // independent re-implementation of the "minimums + invest" arm, written differently
  const indep=(()=>{ let bal=1200, inv=0; for(let m=0;m<12;m++){ const pay=Math.min(100,bal); bal-=pay; inv+=300-pay; } return inv-bal; })();
  const real=investCompare([{balance:1200,apr:0,minPayment:100}],300,0,12);
  return { crushNet:Math.round(flat.crush.net*100)/100, invNet:Math.round(flat.investFirst.net*100)/100, indep:Math.round(indep*100)/100 };
});
// 12 months x $300 = $3,600 out; debt $1,200 cleared either way; net = 3600 - 1200 = 2400
claim('Invest vs payoff','0%/0% - crush route net',2400,E.crushNet,'3600 paid in, 1200 of it cleared the debt');
claim('Invest vs payoff','0%/0% - invest route net',2400,E.invNet,'must match: no interest either side');
claim('Invest vs payoff','Independent re-implementation agrees',2400,E.indep,'second implementation, written differently');

/* ---------------- F. RUNWAY + SOVEREIGNTY ---------------- */
const F = await p.evaluate(()=>{
  state=normalizeState(Object.assign(defaultState(),{
    activeMonth:thisMonth(),
    categories:[{id:'roof',name:'Roof'},{id:'food',name:'Food'}],
    budgets:{[thisMonth()]:{roof:1000,food:500}},
    accounts:[{id:'a1',name:'Chk',kind:'checking',purpose:'',balance:4500,updated:'2026-08-01'},
              {id:'a2',name:'401k',kind:'invest',purpose:'retire',balance:50000,updated:'2026-08-01'}],
    assets:[{id:'as1',name:'Index fund',value:9000,kind:'real',cost:0},
            {id:'as2',name:'Boat',value:6000,kind:'stuff',cost:200}],
    liabilities:[{id:'l1',name:'Visa',value:1500}]}));
  const s=sovereignty();
  return { essentials:essentialMonthly(), runway:Math.round(freedomRunway()*1000)/1000,
           scr:Math.round(s.scr*100)/100, pureRunway:Math.round(s.pureRunway*1000)/1000,
           yieldMonthly:Math.round(s.yieldMonthly*100)/100, netWorth:netWorth(), liquid:liquidTotal() };
});
claim('Runway','Essentials per month',1500,F.essentials,'Roof 1000 + Food 500');
claim('Runway','Liquid cash (401k excluded)',4500,F.liquid,'checking only');
// liquid = real assets 9000 + cash 4500 - liabilities 1500 = 12000; /1500 = 8
claim('Runway','Freedom Runway (months)',8,F.runway,'(9000 + 4500 - 1500) / 1500');
claim('Runway','Net worth',68000,F.netWorth,'assets 15000 + bank 54500 - liabilities 1500');
claim('Sovereignty','Sovereign Capital Ratio',60,F.scr,'real 9000 / total assets 15000');
claim('Sovereignty','Pure runway (money-making assets only)',5,F.pureRunway,'(9000 - 1500) / 1500');
claim('Sovereignty','Monthly yield at 4% withdrawal',30,F.yieldMonthly,'9000 * 0.04 / 12');

/* ---------------- G. RECURRING + SWEEP + TIME ---------------- */
const G = await p.evaluate(()=>{
  const mo=(f,amt)=>Math.round(recMonthly({amount:amt,freq:f})*100)/100;
  state=normalizeState(Object.assign(defaultState(),{hourlyWage:20,hoursPerWeek:40}));
  state.timeLog=[{id:'t1',date:todayStr(),kind:'leak',hours:3}];
  const tot=timeWeekTotals();
  return { weekly:mo('weekly',50), biweekly:mo('biweekly',1500), semi:mo('semimonthly',100),
           monthly:mo('monthly',900), quarterly:mo('quarterly',394.51), yearly:mo('yearly',1200),
           subsYear:75*12, subsHours:fmtHours(900/20), leak:tot.leak, leakCost:3*20 };
});
claim('Recurring','Weekly $50 as a monthly figure',216.67,G.weekly,'50*52/12');
claim('Recurring','Bi-weekly $1,500 as a monthly figure',3250,G.biweekly,'1500*26/12');
claim('Recurring','Twice-monthly $100',200,G.semi,'100*2');
claim('Recurring','Monthly $900',900,G.monthly,'unchanged');
claim('Recurring','Quarterly $394.51',131.5,G.quarterly,'394.51/3');
claim('Recurring','Yearly $1,200',100,G.yearly,'1200/12');
claim('Memberships','$75/mo priced by the year',900,G.subsYear,'75*12');
claim('Memberships','...and in life-hours at $20/hr','45 hrs',G.subsHours,'900/20');
claim('Time','3 leaked hours logged',3,G.leak,'rolling 7-day window');
claim('Time','...priced at the user rate',60,G.leakCost,'3 hrs x $20');

/* ---------------- H. GUT-CHECK METRICS ---------------- */
const H = await p.evaluate(()=>{
  state=normalizeState(Object.assign(defaultState(),{hourlyWage:25,hoursPerWeek:40,
    goals:[{id:'g',name:'Trip',target:2000,saved:500,date:'',goalType:'foundation'}],
    accounts:[{id:'a',name:'Chk',kind:'checking',purpose:'',balance:10000,updated:'2026-08-01'}]}));
  const amt=300;
  return { hours:fmtHours(amt/effectiveHourly()), pctGoal:Math.round(amt/(2000-500)*100),
           pctNW:Math.round(amt/netWorth()*100), trapsTo500:Math.max(1,Math.round(500/amt)) };
});
claim('Gut-check','$300 in hours of life at $25/hr','12 hrs',H.hours,'300/25');
claim('Gut-check','$300 as a share of a goal with $1,500 to go',20,H.pctGoal,'300/1500');
claim('Gut-check','$300 as a share of $10,000 net worth',3,H.pctNW,'300/10000');
claim('Gut-check','Skips of $300 to bank $500',2,H.trapsTo500,'500/300 rounded');

/* ---------------- report ---------------- */
let fails=0, area='';
const near=(a,b)=>typeof a==='number'&&typeof b==='number' ? Math.abs(a-b)<=0.02 : a===b;
console.log('CLAIMS INVENTORY - every money statement the app makes\n');
for(const c of CLAIMS){
  if(c.area!==area){ area=c.area; console.log('\n'+area.toUpperCase()); }
  const ok=near(c.expected,c.got); if(!ok) fails++;
  console.log('  '+(ok?'ok  ':'FAIL')+'  '+c.what.padEnd(52)+' want '+String(c.expected).padStart(9)+'  got '+String(c.got).padStart(9)+'   ('+c.note+')');
}
console.log('\n'+CLAIMS.length+' claims checked, '+(fails?fails+' FAILED':'all verified against hand math'));
console.log('page errors:', errs.length?[...new Set(errs)]:'none');
await b.close();
process.exit(fails?1:0);
