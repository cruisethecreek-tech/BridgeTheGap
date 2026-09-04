import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
/* The same trap in the other two maps. A sweep is {amount, goalId} - an OBJECT
   in a cell - which is where an identity comparison would restamp every cell on
   every save and quietly hand every conflict to whichever phone saved last. */
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
const out=await pg.evaluate(()=>{
  const R=[]; const ok=(n,f)=>{let v=false;try{v=f();}catch(e){v=false;}R.push([n,!!v]);};
  const S=(t,by)=>({t,by,d:by});
  const base=()=>({graveyard:[],changelog:[],settingsM:{},cellM:{},categories:[]});
  const mine=Object.assign(base(),{deviceId:'him',sweptDays:{'2026-09-04':{amount:12,goalId:'g1'}},
    cellM:{'sweptDays|2026-09-04':S(500,'him')}});
  const theirs=Object.assign(base(),{deviceId:'her',sweptDays:{'2026-09-06':{amount:9,goalId:'g1'}},
    cellM:{'sweptDays|2026-09-06':S(600,'her')}});
  const m=mergeVault(mine,theirs);
  ok('both partners\' sweeps survive, not just the last one saved',
     ()=>m.sweptDays['2026-09-04'].amount===12 && m.sweptDays['2026-09-06'].amount===9);
  const u=mergeVault(Object.assign(base(),{deviceId:'her',units:{a:'coffees'},cellM:{'units|a':S(100,'her')}}),
                     Object.assign(base(),{deviceId:'him',units:{b:'hours'},cellM:{'units|b':S(100,'him')}}));
  ok('per-field unit labels do not undo each other', ()=>u.units.a==='coffees' && u.units.b==='hours');

  // An object in a cell must not restamp when nothing about it changed.
  state.sweptDays={'2026-09-04':{amount:12,goalId:'g1'}};
  syncPrev=syncSnapshot(state); state.cellM={};
  state.sweptDays={'2026-09-04':{amount:12,goalId:'g1'}};   // same content, new object
  stampChanges();
  ok('rewriting a sweep with identical content stamps nothing',
     ()=>Object.keys(state.cellM||{}).length===0);
  state.sweptDays['2026-09-04'].amount=30; stampChanges();
  ok('...but actually changing the amount does stamp it',
     ()=>!!(state.cellM||{})['sweptDays|2026-09-04']);
  return R;
});
out.forEach(([n,p])=>{ if(!p) console.log('FAIL: '+n); });
const bad=out.filter(x=>!x[1]).length;
console.log(`${out.length-bad} of ${out.length} hold`);
console.log('page errors: '+(errs.length?errs.join(' | '):'none'));
await b.close();
process.exit(bad||errs.length?1:0);
