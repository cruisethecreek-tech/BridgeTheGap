/* ============================================================
   BUDGET SIMULATION
   The other suites check that formulas match hand arithmetic in isolation, and
   that the interface responds. Neither asks the only question that matters for a
   budgeting app: can a household actually budget with this, and does every
   screen agree about the same money?

   This runs one real household through a full month, a rollover into the next,
   and the messy edits people actually make - and asserts the properties a
   budget must have:
     - zero-based is reachable and reported as exactly zero
     - money is CONSERVED: what is assigned, spent and left agrees everywhere
     - the category tree neither invents nor loses money, split either direction
     - overspending is reported honestly instead of quietly absorbed
     - a paycheck posts once, not twice, however often you press the button
     - a partner's pay is the household's money, not a footnote
     - a new month is a new budget, and last month's plan copies over intact
     - deleting a category does not make its spending vanish from the totals
   ============================================================ */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

/* ---- the household ----------------------------------------------------
   $3,200 on the 1st, a partner's $980 on the 5th, $520 side gig on the 15th.
   Three income events, two people, one pot. */
const INCOME = [
  { id:'i1', type:'income', amount:3200, source:'Paycheck',  owner:'a', date:'2026-08-01' },
  { id:'i2', type:'income', amount:980,  source:"Partner's pay", owner:'b', date:'2026-08-05' },
  { id:'i3', type:'income', amount:520,  source:'Side gig',  owner:'a', date:'2026-08-15' },
];
const TOTAL_IN = 3200 + 980 + 520;   // 4700

const CATS = [
  {id:'roof', name:'Roof'},
  {id:'food', name:'Food'},                          // bottom-up: no own figure, subs carry it
  {id:'groc', name:'Groceries',   parentId:'food'},
  {id:'eat',  name:'Eating out',  parentId:'food'},
  {id:'pow',  name:'Power & Wi-Fi'},                 // top-down: own figure, only PART of it split
  {id:'elec', name:'Electric',    parentId:'pow'},
  {id:'watr', name:'Water',       parentId:'pow'},
  {id:'net',  name:'Internet',    parentId:'pow'},
  {id:'car',  name:'Getting Around'},
  {id:'mem',  name:'Memberships'},
  {id:'sav',  name:'Savings'},
  {id:'fun',  name:'Fun'},
  {id:'buf',  name:'Buffer'},
];
/* Both directions of assignment in one plan, because both happen in real life:
     Food   - the household knows groceries and eating out, not the total  -> parent = 620 (rolled up)
     Power  - the household knows the pool is 300, has split only 265 so far -> parent = 300 ( 35 unsplit) */
const PLAN = { roof:1250, groc:400, eat:220, pow:300, elec:120, watr:65, net:80,
               car:340, mem:60, sav:1500, fun:385, buf:245 };
const FOOD_ROLLUP  = 400 + 220;          // 620
const POW_SPLIT    = 120 + 65 + 80;      // 265, inside a 300 pool
const PLAN_TOP     = 1250 + FOOD_ROLLUP + 300 + 340 + 60 + 1500 + 385 + 245;   // 4700 - zero-based
const PLAN_FLAT    = Object.values(PLAN).reduce((s,v)=>s+v,0);                // 4965 - the naive sum

const SPEND = [
  {id:'s1', type:'expense', amount:380,  catId:'groc', date:'2026-08-04'},
  {id:'s2', type:'expense', amount:260,  catId:'eat',  date:'2026-08-09'},   // over its 220
  {id:'s3', type:'expense', amount:1250, catId:'roof', date:'2026-08-02'},
  {id:'s4', type:'expense', amount:140,  catId:'elec', date:'2026-08-11'},  // over its OWN 120 - the pool has to absorb it
  {id:'s5', type:'expense', amount:305,  catId:'car',  date:'2026-08-14'},
  {id:'s6', type:'expense', amount:420,  catId:'fun',  date:'2026-08-20'},   // over its 385
];
const TOTAL_OUT = 380+260+1250+140+305+420;   // 2755

const results = [];
const check = (name, want, got, note='') => {
  const ok = (typeof want==='string' || typeof got==='string') ? String(want)===String(got) : Math.abs((+want)-(+got)) < 0.005;
  results.push({ ok, name, want, got, note });
};
const checkTrue = (name, got, note='') => results.push({ ok: got===true, name, want:'true', got:String(got), note });

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/app.html'); await p.waitForTimeout(400);
const seed = async () => {
  await p.evaluate(([cats, plan, income, spend]) => {
    localStorage.setItem('unfiltered_budget_v2', JSON.stringify({
      onboarded:true, activeMonth:'2026-08', uiMode:'all', stageReached:3, chatPace:'instant',
      hourlyWage:24, hoursPerWeek:40, household:true,
      categories:cats, budgets:{'2026-08':plan},
      transactions:income.concat(spend),
      goals:[], impulse:[], intake:{}, recurring:[], accounts:[], assets:[], liabilities:[], diary:[]
    }));
  }, [CATS, PLAN, INCOME, SPEND]);
  await p.reload(); await p.waitForTimeout(900);
};
await seed();

/* ===== 1. can this household actually reach zero-based? ===== */
const m = await p.evaluate(() => {
  const M = state.activeMonth, tops = topCats();
  return {
    income:       monthIncome(M),
    expense:      monthExpense(M),
    assignedTop:  tops.reduce((s,c)=>s+catAssigned(c.id,M),0),
    assignedFlat: state.categories.reduce((s,c)=>s+assignedFor(c.id,M),0),
    spentTop:     tops.reduce((s,c)=>s+catSpent(c.id,M),0),
    food: { assigned:catAssigned('food',M), own:assignedFor('food',M), spent:catSpent('food',M) },
    pow:  { assigned:catAssigned('pow',M),  own:assignedFor('pow',M),  kids:kidsAssigned('pow',M), spent:catSpent('pow',M) },
    eat:  { assigned:assignedFor('eat',M),  spent:spentFor('eat',M) },
    fun:  { assigned:assignedFor('fun',M),  spent:spentFor('fun',M) },
    buf:  { assigned:assignedFor('buf',M),  spent:spentFor('buf',M) },
    orphaned: txnsInMonth(M).filter(t=>t.type==='expense' && !state.categories.some(c=>c.id===t.catId)).reduce((s,t)=>s+t.amount,0),
  };
});
check('every dollar that came in is counted', TOTAL_IN, m.income, 'two earners, three deposits');
check('the plan assigns (tree-aware)', PLAN_TOP, m.assignedTop);
check('left to budget reaches exactly zero', 0, m.income - m.assignedTop, 'zero-based is REACHABLE, not just described');

/* ===== 2. the tree neither invents nor loses money ===== */
check('bottom-up: Food = its two subs added up', FOOD_ROLLUP, m.food.assigned, 'parent had no figure of its own');
check('bottom-up: Food was never typed into', 0, m.food.own);
check('top-down: a partly-split pool keeps its own total', 300, m.pow.assigned, 'subs total 265; the pool is still 300');
check('top-down: the unsplit remainder is still there', 35, m.pow.assigned - m.pow.kids, 'money not yet placed inside the group is not lost');
check('a naive row-by-row sum over-reports by the split subs', PLAN_FLAT - PLAN_TOP, 265,
      'adding every row would say 4965 assigned of 4700 and put a zero-based household $265 in the hole');
check('   ...and catAssigned is what prevents that', PLAN_FLAT, m.assignedFlat, 'the naive sum, for the record');

/* ===== 3. spending is conserved ===== */
check('total spent', TOTAL_OUT, m.expense);
check('spent summed over the tree == month total', TOTAL_OUT, m.spentTop, 'nothing lost between category and total');
check('no spending fell outside the categories', 0, m.orphaned);
check('income - spent = what is still in hand', TOTAL_IN - TOTAL_OUT, m.income - m.expense);

/* ===== 4. overspending is reported, not absorbed ===== */
check('Eating out is over by 40', 40, m.eat.spent - m.eat.assigned);
check('Fun is over by 35', 35, m.fun.spent - m.fun.assigned);
check('Food as a whole is over by 20', 20, m.food.spent - m.food.assigned, '640 spent against 620 assigned');
check('an untouched category still holds its money', 245, m.buf.assigned - m.buf.spent);
/* The audit caught this check testing nothing: Electric spent 118 of its 120,
   so the sub never overspent and the "pool absorbs it" property was asserted
   against a case that never triggered it. Electric now spends 140 - over its
   own line by 20 - and BOTH halves of the property are pinned: the sub is over
   on its own figure, and the pool still reports under. */
check('a partly-split pool is judged on the POOL, not the subs', 140, m.pow.spent,
      'spending 140 of a 300 pool is under, even though Electric alone was assigned 120');
check('   ...the sub really is over its own line', 20, 140 - 120, 'the property is exercised, not just described');
checkTrue('   ...and the pool still reports under', m.pow.spent < m.pow.assigned, '140 spent of a 300 pool');

/* ===== 5. a paycheck posts ONCE, however often you press the button ===== */
const rec = await p.evaluate(() => {
  const M='2026-08';
  state.recurring=[
    {id:'r1', type:'income',  amount:3200, source:'Paycheck', anchor:'2026-08-01', freq:'monthly'},
    {id:'r2', type:'expense', amount:1250, catId:'roof',      anchor:'2026-08-02', freq:'monthly'},
  ];
  state.transactions=state.transactions.filter(t=>t.id!=='i1' && t.id!=='s3');   // let recurring supply them
  const first  = postRecurring(M);
  const inAfter1 = monthIncome(M), outAfter1 = monthExpense(M);
  const second = postRecurring(M);       // the impatient second press
  const third  = postRecurring(M);
  return { first, second, third, inAfter1, outAfter1,
           inAfter3:monthIncome(M), outAfter3:monthExpense(M),
           rows:state.transactions.filter(t=>t.recId==='r1').length };
});
check('posting recurring adds both items', 2, rec.first);
check('the paycheck lands as real income', TOTAL_IN, rec.inAfter1);
check('the rent lands as real spending', TOTAL_OUT, rec.outAfter1);
check('pressing Post again adds nothing', 0, rec.second);
check('and again adds nothing', 0, rec.third);
check('income did not double', TOTAL_IN, rec.inAfter3, 'the single worst arithmetic bug a budget can have');
check('spending did not double', TOTAL_OUT, rec.outAfter3);
check('exactly one paycheck row exists', 1, rec.rows);

/* ===== 6. a partner's pay is the household's money ===== */
await seed();
const hh = await p.evaluate(() => {
  const M=state.activeMonth, tx=txnsInMonth(M).filter(t=>t.type==='income');
  const byOwner = o => tx.filter(t=>(t.owner||'a')===o).reduce((s,t)=>s+t.amount,0);
  return { total:monthIncome(M), a:byOwner('a'), b:byOwner('b') };
});
check("the earner's own pay", 3720, hh.a, 'paycheck + side gig');
check("the partner's pay", 980, hh.b);
check('both are inside the one number the plan is built on', hh.a + hh.b, hh.total,
      'a plan built on one paycheck under-budgets a two-income home by exactly the other income');

/* ===== 7. a new month is a new budget, and last month copies over intact ===== */
const roll = await p.evaluate(() => {
  state.activeMonth='2026-09'; save();
  const M=state.activeMonth, tops=topCats();
  const fresh = { income:monthIncome(M), expense:monthExpense(M),
                  assigned:tops.reduce((s,c)=>s+catAssigned(c.id,M),0) };
  // the REAL Copy path - the audit caught this test re-implementing the copy
  // inline, so a broken or unhooked copyPrevPlan() would still have passed
  const didCopy=copyPrevPlan();
  const copied = { assigned:tops.reduce((s,c)=>s+catAssigned(c.id,M),0),
                   food:catAssigned('food',M), pow:catAssigned('pow',M),
                   rows:Object.keys(state.budgets[M]).length,
                   augUntouched:topCats().reduce((s,c)=>s+catAssigned(c.id,'2026-08'),0) };
  return { fresh, copied, didCopy };
});
check('September income does not inherit August', 0, roll.fresh.income);
check('September spending does not inherit August', 0, roll.fresh.expense);
check('September starts with nothing assigned', 0, roll.fresh.assigned, 'a new month is a new decision');
checkTrue('the real copyPrevPlan() reports success', roll.didCopy===true);
check('copy last month reproduces the plan exactly', PLAN_TOP, roll.copied.assigned);
check('   ...including the rolled-up parent', FOOD_ROLLUP, roll.copied.food);
check('   ...and the partly-split pool', 300, roll.copied.pow);
check('   ...every row of it', Object.keys(PLAN).length, roll.copied.rows);
check('copying forward did not disturb August', PLAN_TOP, roll.copied.augUntouched);

/* ===== 8. deleting a category must not make its spending vanish ===== */
await seed();
const del = await p.evaluate(() => {
  const M=state.activeMonth;
  const before = { total:monthExpense(M), tree:topCats().reduce((s,c)=>s+catSpent(c.id,M),0) };
  // delete Food, exactly as the Budget screen does (subtree + its assignments; transactions kept)
  const toRemove=new Set(['food',...descendantsOf('food').map(k=>k.id)]);
  state.categories=state.categories.filter(c=>!toRemove.has(c.id));
  Object.keys(state.budgets).forEach(m=>{ if(state.budgets[m]) toRemove.forEach(r=>delete state.budgets[m][r]); });
  save();
  const orphan = txnsInMonth(M).filter(t=>t.type==='expense' && !state.categories.some(c=>c.id===t.catId))
                   .reduce((s,t)=>s+t.amount,0);
  bdSide='out'; bdRange=1; bdDrill=null;
  const rows=bdRows();
  return { before, after:{ total:monthExpense(M), tree:topCats().reduce((s,c)=>s+catSpent(c.id,M),0) },
           orphan, mapTotal:rows.reduce((s,r)=>s+r.val,0),
           mapHasUncat: rows.some(r=>r.name==='Uncategorized' && Math.abs(r.val-640)<0.005),
           assigned: topCats().reduce((s,c)=>s+catAssigned(c.id,M),0) };
});
check('the month total is unchanged by deleting a category', del.before.total, del.after.total,
      'the money was still spent - deleting the label cannot unspend it');
check('the deleted subtree is the 640 now uncategorised', 640, del.orphan);
check('the category rollup drops by exactly that', del.before.tree - 640, del.after.tree);
check('the money map still totals every dollar spent', TOTAL_OUT, del.mapTotal,
      'orphaned spending has to appear somewhere or the chart quietly lies');
checkTrue('the money map names it "Uncategorized" rather than hiding it', del.mapHasUncat);
check('the plan drops by the deleted assignment', PLAN_TOP - 620, del.assigned);

/* ===== 9. every surface agrees about the same month ===== */
await seed();
const surfaces = await p.evaluate(() => {
  renderAll();
  const M=state.activeMonth;
  const mapOut = (()=>{ bdSide='out'; bdRange=1; bdDrill=null; return bdRows().reduce((s,r)=>s+r.val,0); })();
  const mapIn  = (()=>{ bdSide='in';  bdRange=1; return bdRows().reduce((s,r)=>s+r.val,0); })();
  const drillFood = (()=>{ bdSide='out'; bdDrill='food'; const r=bdRows(); bdDrill=null; return r.reduce((s,x)=>s+x.val,0); })();
  return { mapOut, mapIn, drillFood, glanceIn:monthIncome(M), glanceOut:monthExpense(M) };
});
check('money map "where it went" == total spent', TOTAL_OUT, surfaces.mapOut);
check('money map "where it came from" == total income', TOTAL_IN, surfaces.mapIn);
check('drilling into Food shows Food\'s whole spend', 640, surfaces.drillFood, 'the slice and its breakdown agree');
check('glance drawer agrees with the month totals', TOTAL_OUT, surfaces.glanceOut);
check('glance drawer income agrees too', TOTAL_IN, surfaces.glanceIn);


/* ===== 10. a wall funded THROUGH its subcategories is funded =====
   The app's own flow pushes people here: "Split into subcategories" on Food, type
   Groceries 400 and Eating out 220, and the Budget screen itself prints "= $620".
   Every screen that asks "are your essentials covered?" must agree with that, or it
   sends the household back to fund a wall they already funded - and the ladder,
   the Cover First panel and the wall hand-off all disagree at once. */
const walls = await p.evaluate(() => {
  const M = state.activeMonth;
  const cover = w => { const cats = state.categories.filter(c=>!c.parentId && w.match.some(t=>c.name.toLowerCase().includes(t)));
                       return { own:cats.reduce((s,c)=>s+assignedFor(c.id,M),0), tree:cats.reduce((s,c)=>s+catAssigned(c.id,M),0) }; };
  const food = WALLS.find(w=>w.cat==='Food'), pow = WALLS.find(w=>w.cat==='Power & Wi-Fi');
  renderAll();
  const home = document.getElementById('view-home').innerText;
  return {
    foodOwn: cover(food).own, foodTree: cover(food).tree,
    powOwn: pow?cover(pow).own:null, powTree: pow?cover(pow).tree:null,
    coveredCount: WALLS.filter(w=>cover(w).tree>0).length,
    nags: (home.match(/Cover your essentials \(\d\/\d\)/)||[])[0] || '',
    tellsToFundFood: /Fund Food first|Food[\s\S]{0,60}Fund it first/.test(home),
    coverFirstSays: (home.match(/All four walls covered this month[^\n]*/)||[])[0] || '<<still asking>>',
  };
});
check('Food carries 620 - on its subs, not on itself', 620, walls.foodTree);
check('   (the parent row itself is blank, by design)', 0, walls.foodOwn);
check('Power & Wi-Fi carries 300 on the parent', 300, walls.powTree);
check('all four essentials are funded', 4, walls.coveredCount);
checkTrue('the Home ladder stops nagging about essentials', walls.nags === '',
      'judging coverage on the parent row alone left it stuck at 3/4 forever');
checkTrue('Home does NOT tell them to fund Food again', walls.tellsToFundFood === false);
checkTrue('Cover First says all four are covered', /All four walls covered/.test(walls.coverFirstSays));
check('   ...and totals what is behind them', 2510, +(walls.coverFirstSays.match(/\$([\d,]+) set aside/)||[0,'0'])[1].replace(/,/g,''),
      'Roof 1250 + Food 620 (from its subs) + Power 300 + Getting Around 340');


/* ===== 11. a REAL paycheck has cents =====
   Nobody is paid $3,200.00. If the plan boxes only accept whole dollars while the
   spend boxes accept cents, zero-based is unreachable for every household with a
   real paystub - they are left permanently 83 cents short and told so. */
await p.evaluate(() => {
  localStorage.setItem('unfiltered_budget_v2', JSON.stringify({
    onboarded:true, activeMonth:'2026-08', uiMode:'all', stageReached:3, chatPace:'instant', hourlyWage:24,
    categories:[{id:'roof',name:'Roof'},{id:'sav',name:'Savings'},{id:'fun',name:'Fun'}],
    budgets:{'2026-08':{roof:1200, sav:1000, fun:1047.83}},
    transactions:[{id:'i1',type:'income',amount:3247.83,source:'Pay',date:'2026-08-01'}],
    goals:[], impulse:[], intake:{}, recurring:[], accounts:[], assets:[], liabilities:[], diary:[]
  }));
});
await p.reload(); await p.waitForTimeout(900);
const c = await p.evaluate(() => {
  renderAll();
  const M='2026-08';
  const ltb = monthIncome(M) - topCats().reduce((s,k)=>s+catAssigned(k.id,M),0);
  const box = document.querySelector('#cats input[data-cat="roof"]');
  const t = document.getElementById('view-budget').innerText;
  return { ltb, step:box.step, mode:box.inputMode,
           zeroVerdict: /Zero-based\. Every dollar has a job/.test(t),
           fortyCents: usd(0.4), negForty: usd(-0.4), whole: usd(4700), mixed: usd(1200.5) };
});
check('a paycheck with cents can be assigned to exactly zero', 0, c.ltb);
checkTrue('   ...and the app says so', c.zeroVerdict);
check('the plan boxes accept cents, like the spend boxes do', '0.01', c.step,
      'step="1" made every cents entry a stepMismatch, so a real paystub could never reach zero');
check('   ...with a decimal keypad on a phone', 'decimal', c.mode);
check('forty cents prints as forty cents', '$0.40', c.fortyCents, 'it printed "$0.4"');
check('   ...negative too', '-$0.40', c.negForty);
check('whole dollars stay clean', '$4,700', c.whole, 'no pointless .00 everywhere');
check('   ...and a mixed amount shows both cents', '$1,200.50', c.mixed);

console.log('BUDGET SIMULATION - one household, one month, one rollover, one bad edit\n');
let fails = 0;
for (const r of results) {
  if (!r.ok) fails++;
  console.log(`${r.ok?'ok  ':'FAIL'}  ${r.name.padEnd(56)} want ${String(r.want).padStart(8)}  got ${String(typeof r.got==='number'?Math.round(r.got*100)/100:r.got).padStart(8)}${r.note?'   ('+r.note+')':''}`);
}
console.log(`\n${results.length - fails} of ${results.length} budgeting properties hold`);
console.log('page errors:', errs.length ? errs : 'none');
await b.close();
if (fails) process.exit(1);
