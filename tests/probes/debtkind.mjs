import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:1000}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',hourlyWage:30,
  categories:[{id:'c1',name:'Food'}],budgets:{'2026-08':{c1:400}},
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:3000,updated:'2026-08-01'}],
  transactions:[],goals:[],impulse:[],recurring:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],
  debts:[],debtBudget:0,vault:[],snapshots:[]});
await pg.reload(); await pg.waitForTimeout(850);

/* the dropdown decides which fields exist */
const f = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); renderDebt(); await w(500);
  const o={}, sel=document.getElementById('debtKindSel');
  o.kinds=[...sel.options].map(x=>x.value).filter(Boolean);
  const shown=()=>({lim:!document.getElementById('debtLimWrap').classList.contains('hide'),
                    worth:!document.getElementById('debtWorthWrap').classList.contains('hide'),
                    lbl:(document.getElementById('debtWorthLbl')||{}).textContent||''});
  o.blank=shown();
  const pick=async v=>{ sel.value=v; sel.dispatchEvent(new Event('change',{bubbles:true})); await w(200); return shown(); };
  o.card=await pick('card');
  o.mortgage=await pick('mortgage');
  o.auto=await pick('auto');
  o.student=await pick('student');
  return o;
});
ok('the planner asks what kind of debt it is', f.kinds.length>=7, JSON.stringify(f.kinds));
ok('nothing extra is asked before a kind is chosen', f.blank.lim===false && f.blank.worth===false);
ok('a credit card is asked for its limit and not for a value',
  f.card.lim===true && f.card.worth===false, JSON.stringify(f.card));
ok('a mortgage is asked for the home value and not for a limit',
  f.mortgage.worth===true && f.mortgage.lim===false && /Home value/.test(f.mortgage.lbl), JSON.stringify(f.mortgage));
ok('...and a car loan for the car value, named as the car', /Car value/.test(f.auto.lbl), f.auto.lbl);
ok('a student loan is asked for neither, because it has no other side',
  f.student.lim===false && f.student.worth===false, JSON.stringify(f.student));

/* adding, and what the row then says */
const add = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const set=(id,v)=>{ document.getElementById(id).value=v; };
  const sel=document.getElementById('debtKindSel');
  sel.value='mortgage'; sel.dispatchEvent(new Event('change',{bubbles:true})); await w(200);
  set('debtName','Bears Den'); set('debtBal','78000'); set('debtApr','5.9'); set('debtMin','850'); set('debtWorth','240000');
  document.getElementById('addDebt').click(); await w(420);
  sel.value='auto'; sel.dispatchEvent(new Event('change',{bubbles:true})); await w(200);
  set('debtName','The truck'); set('debtBal','22000'); set('debtApr','8.4'); set('debtMin','480'); set('debtWorth','16500');
  document.getElementById('addDebt').click(); await w(460);
  const o={n:state.debts.length};
  const m=state.debts.find(d=>d.name==='Bears Den'), c=state.debts.find(d=>d.name==='The truck');
  o.m={kind:m.kind, worth:m.worth, secured:!!m.secured, eq:debtEquity(m), ltv:debtLTV(m), under:debtUnderwater(m)};
  o.c={kind:c.kind, worth:c.worth, eq:debtEquity(c), under:debtUnderwater(c)};
  o.rows=document.getElementById('debtList').innerText;
  o.editable=!!document.querySelector(`input[data-debt="${m.id}"][data-k="worth"]`)
            && document.querySelector(`input[data-debt="${m.id}"][data-k="worth"]`).value==='240000';
  return o;
});
ok('a mortgage stores its kind, its value and that something backs it',
  add.m.kind==='mortgage' && add.m.worth===240000 && add.m.secured===true, JSON.stringify(add.m));
ok('...and equity is the value less what is owed, by hand',
  add.m.eq===162000 && add.m.ltv===32.5 && add.m.under===false, JSON.stringify(add.m));
ok('a car worth less than its loan is named as underwater',
  add.c.eq===-5500 && add.c.under===true, JSON.stringify(add.c));
ok('...and the row says both, in words rather than a sign',
  /\$162,000 equity/.test(add.rows) && /\$5,500 underwater/.test(add.rows), add.rows.slice(0,400));
ok('...and a value already set is still editable, not frozen into a label',
  add.editable===true, String(add.editable));
ok('...with the kind on the row so it can be corrected later', /Mortgage|Car loan/.test(add.rows), add.rows.slice(0,200));

/* the Reflect signal - the "asset or liability" answer they asked for */
const sig = await pg.evaluate(() => {
  const s=REPORT_SIGNALS.find(x=>x.k==='debtEquity').run();
  return s?{t:s.t, body:s.body, work:s.work, nudge:s.nudge, bad:s.bad}:null;
});
ok('Reflect gets a signal about what is behind the loan', !!sig, JSON.stringify(sig&&sig.t));
ok('...leading with the underwater one, because that is the one nobody knows',
  /truck/i.test(sig.t) && sig.bad===true, sig.t);
ok('...showing its arithmetic', /16,500/.test(sig.work) && /22,000/.test(sig.work), sig.work);
ok('...saying the thing that actually matters - you cannot sell your way out',
  /cannot get out of this by selling/.test(sig.nudge), sig.nudge.slice(0,200));
ok('...and still naming the net across everything, so it is not one-sided',
  /nets to/.test(sig.nudge), sig.nudge.slice(0,300));

/* clearing the truck's shortfall flips the signal to the positive one */
const flip = await pg.evaluate(() => {
  const c=state.debts.find(d=>d.name==='The truck'); c.balance=9000; save();
  const s=REPORT_SIGNALS.find(x=>x.k==='debtEquity').run();
  return {t:s.t, bad:s.bad, nudge:s.nudge};
});
ok('with nothing underwater it reports the equity instead', /buying you something/.test(flip.t) && flip.bad===false, flip.t);
ok('...and refuses to call the debt free', /does not/.test(flip.nudge) && /free/.test(flip.nudge), flip.nudge.slice(0,200));

/* an old debt with no kind still works, and can be given one */
const legacy = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  state.debts=[{id:'old',name:'Visa',balance:2400,apr:23.9,minPayment:75,limit:5000}];
  save(); renderDebt(); await w(450);
  const o={revolving:debtRevolving(state.debts[0]), room:/left to draw/.test(document.getElementById('debtList').innerText)};
  const sel=document.querySelector('select[data-debtkind="old"]');
  o.picker=!!sel;
  sel.value='card'; sel.dispatchEvent(new Event('change',{bubbles:true})); await w(420);
  o.kind=state.debts[0].kind;
  return o;
});
ok('a debt from before types existed still behaves, on its limit alone',
  legacy.revolving===true && legacy.room===true, JSON.stringify(legacy));
ok('...and can be told what it is, from the row', legacy.picker===true && legacy.kind==='card', JSON.stringify(legacy));

/* Reported from a phone: a mortgage balance went 80,000 -> 40,000 and the equity
   beside it kept showing the old figure. redrawRoomLine looked the row up by its
   LIMIT field, which a mortgage has never had. */
const live = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  state.debts=[{id:'m1',name:'Bears Den',kind:'mortgage',balance:80000,apr:4.75,minPayment:850,worth:210000,secured:true}];
  save(); renderDebt(); await w(460);
  const sumText=()=>document.querySelector('[data-drsum="m1"]').innerText;
  const o={before:sumText()};
  const bal=document.querySelector('input[data-debt="m1"][data-k="balance"]');
  bal.value='40000'; bal.dispatchEvent(new Event('input',{bubbles:true})); await w(360);
  o.after=sumText();
  o.eq=debtEquity(state.debts[0]); o.ltv=debtLTV(state.debts[0]);
  /* and the input a thumb is in must survive its own keystroke */
  const worth=document.querySelector('input[data-debt="m1"][data-k="worth"]');
  worth.focus(); worth.value='250000'; worth.dispatchEvent(new Event('input',{bubbles:true})); await w(360);
  const still=document.querySelector('input[data-debt="m1"][data-k="worth"]');
  o.sameNode=still===worth;
  o.keptFocus=document.activeElement===still;
  o.afterWorth=sumText();
  return o;
});
ok('the equity line was stale before, and moves with the balance now',
  /\$130,000 equity/.test(live.before) && /\$170,000 equity/.test(live.after),
  JSON.stringify([live.before,live.after]));
ok('...to the figure that is actually right: 210,000 less 40,000',
  live.eq===170000 && live.ltv===19, JSON.stringify([live.eq,live.ltv]));
ok('...and typing in the value box does not tear the box out from under you',
  live.sameNode===true && live.keptFocus===true, JSON.stringify(live));
ok('...while the summary beside it still keeps up', /\$210,000 equity/.test(live.afterWorth), live.afterWorth);


console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
