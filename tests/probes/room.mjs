import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const URL='file://'+process.cwd()+'/app.html';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto(URL);
const seed = st => pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)), st);

/* The screenshot: Home equity, 3.49%, nothing drawn. Plus a dream to weigh it against. */
await seed({onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',hourlyWage:30,
  categories:[{id:'c1',name:'Food'}],budgets:{'2026-08':{c1:400}},
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:4000,updated:'2026-08-01'}],
  transactions:[],goals:[{id:'g1',name:'Kitchen',target:12000,saved:2000,date:'',goalType:'foundation'}],
  impulse:[],recurring:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],
  debts:[],debtBudget:0,vault:[],snapshots:[]});
await pg.reload(); await pg.waitForTimeout(800);

/* 1. the add form takes a zero-balance line */
const added = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); await w(400);
  const o={};
  o.hasLimField=!!document.getElementById('debtLim');
  const ks=document.getElementById('debtKindSel');
  ks.value='line'; ks.dispatchEvent(new Event('change',{bubbles:true})); await w(200);
  document.getElementById('debtName').value='Home equity';
  document.getElementById('debtApr').value='3.49';
  let alerted=null; const oa=window.alert; window.alert=m=>{alerted=m;};
  document.getElementById('addDebt').click(); await w(300);
  o.refusedWithoutLimit=!!alerted && state.debts.length===0;
  o.refusalMentionsLimit=/limit/i.test(alerted||'');
  ks.value='line'; ks.dispatchEvent(new Event('change',{bubbles:true})); await w(200);
  document.getElementById('debtName').value='Home equity';
  document.getElementById('debtApr').value='3.49';
  document.getElementById('debtLim').value='50000';
  alerted=null; document.getElementById('addDebt').click(); await w(400);
  window.alert=oa;
  o.acceptedWithLimit=state.debts.length===1 && !alerted;
  const d=state.debts[0]||{};
  o.stored={bal:d.balance, apr:d.apr, limit:d.limit};
  o.room=debtRoom(d); o.util=debtUtil(d);
  o.rowShowsRoom=/left to draw/.test(document.getElementById('debtList').textContent);
  return o;
});
ok('the add form takes a credit limit', added.hasLimField===true);
ok('a line with no balance and no limit is still refused', added.refusedWithoutLimit===true);
ok('...and the refusal says a limit is the other way in', added.refusalMentionsLimit===true, added.refusalMentionsLimit);
ok('a line at zero with a limit is accepted, which it was not before', added.acceptedWithLimit===true, JSON.stringify(added));
ok('...and stores the limit, not a zero', added.stored.limit===50000 && added.stored.bal===0, JSON.stringify(added.stored));
ok('...with the room worked out', added.room===50000 && added.util===0, JSON.stringify([added.room,added.util]));
ok('...and the row says what is left to draw', added.rowShowsRoom===true);

/* 2. the panel */
const panel = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  renderDebt(); await w(400);
  const el=document.getElementById('roomPanel');
  return {gated:el.classList.contains('panel-waiting'), text:el.textContent,
          total:roomTotal(), cheap:(cheapestRoom()||{}).name};
});
ok('the room panel is open once a line has room', panel.gated===false, panel.text.slice(0,120));
ok('...and leads with the room', /\$50,000/.test(panel.text), panel.text.slice(0,200));
ok('...saying plainly it is not money', /not money/.test(panel.text));
ok('...and tracking utilisation', /0% used/.test(panel.text) && /50,000 total limit/.test(panel.text), panel.text.slice(0,400));

/* 3. no pace yet - it must ask rather than invent one */
ok('a dream with no date and no monthly amount is not priced', /put a <b>date<\/b>|put a .date./i.test(panel.text.replace(/\n/g,' ')) || /date/.test(panel.text), panel.text.slice(0,600));

/* 4. give it a pace: the comparison */
const cmp = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  state.roomPay=500; save(); renderRoom(); await w(320);
  const m=borrowOrWait(10000, 3.49, 500);
  return {text:document.getElementById('roomResults').textContent, m};
});
/* 10,000 at 500/mo: saving takes 20 months exactly. Borrowing at 3.49% takes a
   little longer and the extra is the interest. */
ok('waiting is 20 months at $500 on a $10,000 gap', cmp.m.waitMonths===20, String(cmp.m.waitMonths));
ok('...borrowing takes longer than waiting', cmp.m.borrowMonths>cmp.m.waitMonths, JSON.stringify([cmp.m.borrowMonths,cmp.m.waitMonths]));
ok('...and the interest is exactly what the extra months are',
  Math.abs(cmp.m.interest-(cmp.m.borrowMonths*500-10000))<500, JSON.stringify(cmp.m));
ok('...the interest is a sane fraction of the price', cmp.m.interest>100 && cmp.m.interest<600, String(cmp.m.interest));
ok('both sides are drawn, never one', /Wait for it/.test(cmp.text) && /Borrow it today/.test(cmp.text), cmp.text.slice(0,300));
ok('...and it names what the interest actually bought', /buys you/.test(cmp.text), cmp.text.slice(0,600));
ok('...in hours of your life, like everything else here', /hrs/.test(cmp.text), cmp.text.slice(0,700));
ok('it says a dream returns nothing, which is why it is not leverage',
  /returns nothing/.test(cmp.text) && /no break-even/.test(cmp.text), cmp.text.slice(-500));

/* 4b. the blend: a dream bigger than the cheap line must not be priced at the
   cheap line's rate - that was the first draft, and it is the same fault the
   rate signals refuse. */
const blend = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  state.debts=[{id:'d1',name:'Home equity',balance:0,apr:3.49,minPayment:0,limit:3000,secured:true},
               {id:'d2',name:'Visa',balance:0,apr:23.9,minPayment:0,limit:20000}];
  state.goals=[{id:'g1',name:'Kitchen',target:10000,saved:0,date:'',goalType:'foundation'}];
  state.roomPay=500; save(); renderRoom(); await w(320);
  return {dr:drawRoom(10000), text:document.getElementById('roomResults').textContent};
});
ok('the draw fills the cheap line first, then the dear one',
  blend.dr.lines.length===2 && blend.dr.lines[0].apr===3.49 && blend.dr.lines[0].amt===3000, JSON.stringify(blend.dr.lines));
ok('...and the rate quoted is the blend of what was actually taken',
  Math.abs(blend.dr.apr-((3000*3.49+7000*23.9)/10000))<0.02, String(blend.dr.apr));
ok('...which is nowhere near the cheap line alone', blend.dr.apr>17, String(blend.dr.apr));
ok('...and the screen says where the money came from',
  /blended/.test(blend.text) && /Home equity/.test(blend.text) && /Visa/.test(blend.text), blend.text.slice(0,700));

/* 5. secured: the house has to be named */
const sec = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  state.debts=[{id:'d1',name:'Home equity',balance:0,apr:3.49,minPayment:0,limit:50000,secured:true}];
  state.goals=[{id:'g1',name:'Kitchen',target:10000,saved:0,date:'',goalType:'foundation'}];
  save(); renderRoom(); await w(300);
  return document.getElementById('roomResults').textContent;
});
ok('a secured line says what is standing behind it',
  /backed by something you own/i.test(sec) && /something they can take/i.test(sec), sec.slice(-400));

/* 6. a payment under the interest must never print a payoff */
const never = await pg.evaluate(() => borrowOrWait(20000, 24, 100));
ok('a payment under the interest is refused, not looped', never.never===true && never.borrowMonths===undefined, JSON.stringify(never));

/* 7. room shorter than the dream */
const short = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  state.debts=[{id:'d1',name:'Home equity',balance:0,apr:3.49,minPayment:0,limit:3000,secured:true}];
  save(); renderRoom(); await w(300);
  return document.getElementById('roomResults').textContent;
});
ok('room that does not cover the dream says so instead of pricing a fantasy',
  /covers/.test(short) && /to find/.test(short) && /wait either way/.test(short), short.slice(0,600));

/* 8. clearing the limit removes it, it does not store a zero */
const cleared = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  renderDebt(); await w(350);
  const inp=document.querySelector('#debtList input[data-debt][data-k="limit"]');
  inp.value=''; inp.dispatchEvent(new Event('input',{bubbles:true})); await w(320);
  return {has:'limit' in state.debts[0], revolving:pricedLines()[0].revolving,
          /* The line itself stays, because it holds the limit box you would
             retype into - taking the field away on clearing it is the "set it
             once and never correct it" bug. What must go is the DERIVED
             summary, which is now the only thing that reads as a fact. */
          roomGone:(document.querySelector('#debtList .dr-sum')||{}).innerHTML==='',
          boxKept:!!document.querySelector('#debtList input[data-debt][data-k="limit"]'),
          gated:document.getElementById('roomPanel').classList.contains('panel-waiting')};
});
ok('clearing the limit removes it rather than storing a zero', cleared.has===false, JSON.stringify(cleared));
ok('...so the debt stops being revolving', cleared.revolving===false);
ok('...and the room figure goes with it, while the box to retype stays',
  cleared.roomGone===true && cleared.boxKept===true, JSON.stringify(cleared));

/* 9. a limit typed here reaches the rate signals, which only knew accounts */
const sig = await pg.evaluate(async () => {
  state.debts=[{id:'d1',name:'Visa',balance:6000,apr:23.9,minPayment:120},
               {id:'d2',name:'Home equity',balance:0,apr:3.49,limit:50000,secured:true}];
  save();
  const s=REPORT_SIGNALS.find(x=>x.k==='rateSpread').run();
  return s?{t:s.t, n:s.nudge}:null;
});
ok('a line added in the planner now feeds the rate spread signal', !!sig && /Visa/.test(sig.t), JSON.stringify(sig&&sig.t));
ok('...and it carries the secured warning through', !!sig && /house/.test(sig.n), (sig&&sig.n||'').slice(0,200));

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
