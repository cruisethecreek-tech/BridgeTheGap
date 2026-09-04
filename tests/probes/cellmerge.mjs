import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
/* "Passphrase worked but it still did not load Sam's Club into the budget."
   The category merges item by item and always arrived. The MONEY did not:
   budgets is one field holding every assignment for every month, and it was
   merged whole. Two people assigning in the same month meant one of them lost
   the lot - and a category that lands with nothing in it looks identical to a
   category that never landed. These checks are about the money. */
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.waitForFunction(()=>typeof window.mergeVault==='function'||typeof mergeVault==='function');

const out=await pg.evaluate(()=>{
  const R=[]; const ok=(n,c)=>R.push([n,!!c]);
  const S=(t,by)=>({t,by,d:by});
  const base=()=>({graveyard:[],changelog:[],settingsM:{},cellM:{},categories:[]});

  // 1. Sam's Club, start to finish. He adds the category AND assigns $50.
  //    She, later and independently, assigns $20 to groceries.
  const his=Object.assign(base(),{
    deviceId:'him',
    categories:[{id:'c1',name:'Groceries',_m:S(100,'him')},{id:'c9',name:"Sam's Club",_m:S(500,'him')}],
    budgets:{'2026-09':{c1:400,c9:50}},
    cellM:{'budgets|2026-09|c1':S(100,'him'),'budgets|2026-09|c9':S(500,'him')}});
  const hers=Object.assign(base(),{
    deviceId:'her',
    categories:[{id:'c1',name:'Groceries',_m:S(100,'him')}],
    budgets:{'2026-09':{c1:420}},
    cellM:{'budgets|2026-09|c1':S(900,'her')}});
  const m=mergeVault(hers, his);
  ok("Sam's Club category reaches her", (m.categories||[]).some(c=>c.name==="Sam's Club"));
  ok("Sam's Club arrives with its $50, not empty", m.budgets['2026-09'].c9===50);
  ok("her newer groceries figure survives", m.budgets['2026-09'].c1===420);

  // 2. Symmetry: merging the other direction must land on the same numbers.
  const m2=mergeVault(his, hers);
  ok("same result whichever phone merges", m2.budgets['2026-09'].c9===50 && m2.budgets['2026-09'].c1===420);

  // 3. Clearing an assignment must beat a stale copy of it.
  const cleared=Object.assign(base(),{deviceId:'her',budgets:{'2026-09':{}},
    cellM:{'budgets|2026-09|c9':S(900,'her')}});
  const m3=mergeVault(cleared, his);
  ok("taking an assignment back is not undone by the other phone",
     !((m3.budgets['2026-09']||{}).c9));

  // 4. Never stamped on either side (a budget that predates syncing) still travels.
  const oldHim=Object.assign(base(),{deviceId:'him',budgets:{'2026-07':{c1:300}}});
  const nothing=Object.assign(base(),{deviceId:'her'});
  const m4=mergeVault(nothing, oldHim);
  ok("a budget made before syncing existed still comes across", m4.budgets['2026-07'].c1===300);

  // 5. Other months are not collateral damage.
  const m5=mergeVault(Object.assign(base(),{deviceId:'her',budgets:{'2026-08':{c1:11}},
      cellM:{'budgets|2026-08|c1':S(900,'her')}}), his);
  ok("assignments in months the other phone never touched are kept",
     m5.budgets['2026-08'].c1===11 && m5.budgets['2026-09'].c9===50);

  // 6. opening balance is the same shape and the same trap.
  const oHis=Object.assign(base(),{deviceId:'him',opening:{'2026-09':1200},cellM:{'opening|2026-09':S(500,'him')}});
  const oHers=Object.assign(base(),{deviceId:'her',opening:{'2026-08':300},cellM:{'opening|2026-08':S(400,'her')}});
  const m6=mergeVault(oHers,oHis);
  ok("carried-in balances merge per month too", m6.opening['2026-09']===1200 && m6.opening['2026-08']===300);

  // 7. The blob path still works for things that really are one value.
  const w1=Object.assign(base(),{deviceId:'her',hourlyWage:30,settingsM:{hourlyWage:S(100,'her')}});
  const w2=Object.assign(base(),{deviceId:'him',hourlyWage:44,settingsM:{hourlyWage:S(900,'him')}});
  ok("a single-value setting still takes the newer one", mergeVault(w1,w2).hourlyWage===44);

  // 8. A live edit stamps only the cell it touched.
  state.budgets=state.budgets||{}; state.budgets['2026-09']=state.budgets['2026-09']||{};
  syncPrev=syncSnapshot(state); state.cellM={};
  state.budgets['2026-09'].zz=77; stampChanges();
  const ks=Object.keys(state.cellM||{});
  ok("editing one assignment stamps one cell", ks.length===1 && ks[0]==='budgets|2026-09|zz');
  return R;
});
out.forEach(([n,p])=>{ if(!p) console.log('FAIL: '+n); });
const bad=out.filter(x=>!x[1]).length;
console.log(`${out.length-bad} of ${out.length} hold`);
console.log('page errors: '+(errs.length?errs.join(' | '):'none'));
await b.close();
process.exit(bad||errs.length?1:0);
