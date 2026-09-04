/* "It's August 31st why did it pull up September's tracking prematurely?"
   Nothing was premature. One tap of the planning calendar's forward arrow moves
   state.activeMonth, activeMonth is GLOBAL, and it is saved - so looking ahead
   relocated Plan, Track and Reflect, and stayed there across restarts. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:1400}});
pg.on('pageerror',e=>errs.push(String(e)));
const M=(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;})();
const nextM=(()=>{let [y,m]=M.split('-').map(Number); m++; if(m>12){m=1;y++;} return `${y}-${String(m).padStart(2,'0')}`;})();
const seed={onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:M,hourlyWage:25,
  categories:[{id:'rent',name:'Rent'}],budgets:{[M]:{rent:1400}},
  transactions:[{id:'t1',type:'income',amount:3200,date:M+'-02'},
                {id:'t2',type:'expense',amount:1400,catId:'rent',date:M+'-03'}],
  goals:[],impulse:[],recurring:[],accounts:[{id:'a1',name:'Chequing',kind:'checking',balance:2000,updated:M+'-01'}],
  assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[],scans:[]};
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),seed);
await pg.reload(); await pg.waitForTimeout(950);

/* ---- 1. walking forward says where you are, instead of rendering a blank ---- */
const fwd = await pg.evaluate(async (nextM) => {
  const w=ms=>new Promise(x=>setTimeout(x,ms));
  activateTab('budget'); await w(650);
  document.getElementById('mNext').click(); await w(600);
  const o={ month:state.activeMonth, expected:nextM,
    planLabel:document.getElementById('mLabel').innerText.replace(/\s+/g,' '),
    hasBack:!!document.getElementById('mBack') };
  activateTab('tx'); await w(600);
  const note=document.getElementById('txMonthNote');
  o.trackNote=(note&&note.innerText||'').replace(/\s+/g,' ');
  o.trackBack=!!document.getElementById('txBack');
  o.trackSummary=(document.getElementById('txSummary')||{innerText:''}).innerText.replace(/\s+/g,' ');
  return o;
}, nextM);
ok('the plan walks forward when you ask it to', fwd.month===fwd.expected, fwd.month+' vs '+fwd.expected);
ok('...and the label says you are ahead instead of going blank',
   /planning ahead/i.test(fwd.planLabel) && fwd.hasBack===true, fwd.planLabel);
ok('Track names the month its figures belong to', /a month that has not happened yet/.test(fwd.trackNote),
   fwd.trackNote.slice(0,150));
ok('...so an empty screen reads as "not yet", not as "you logged nothing"',
   /Income \$0/.test(fwd.trackSummary) && fwd.trackNote.length>0, fwd.trackSummary.slice(0,90));
ok('...and offers one tap back from the tab that has no month control at all',
   fwd.trackBack===true);

/* ---- 2. one tap comes home, from Track ---- */
const back = await pg.evaluate(async () => {
  const w=ms=>new Promise(x=>setTimeout(x,ms));
  document.getElementById('txBack').click(); await w(600);
  return { month:state.activeMonth, now:thisMonth(),
    note:(document.getElementById('txMonthNote')||{innerText:''}).innerText.trim(),
    summary:(document.getElementById('txSummary')||{innerText:''}).innerText.replace(/\s+/g,' ') };
});
ok('one tap comes home', back.month===back.now, back.month);
ok('...the banner goes away when there is nothing to explain', back.note==='', back.note);
ok('...and the figures for the month you live in are back', /\$3,200/.test(back.summary), back.summary.slice(0,80));

/* ---- 3. the reported fault: it must not still be there tomorrow ---- */
const persist = await pg.evaluate(async (nextM) => {
  const w=ms=>new Promise(x=>setTimeout(x,ms));
  state.activeMonth=nextM; save();          // walked forward, then closed the app
  return {stored:JSON.parse(localStorage.getItem('unfiltered_budget_v2')).activeMonth};
}, nextM);
ok('walking forward is remembered while you are in there', persist.stored===nextM, persist.stored);
await pg.reload(); await pg.waitForTimeout(950);
const reopened = await pg.evaluate(async () => {
  const w=ms=>new Promise(x=>setTimeout(x,ms));
  activateTab('tx'); await w(650);
  return { month:state.activeMonth, now:thisMonth(),
    summary:(document.getElementById('txSummary')||{innerText:''}).innerText.replace(/\s+/g,' '),
    note:(document.getElementById('txMonthNote')||{innerText:''}).innerText.trim(),
    stored:JSON.parse(localStorage.getItem('unfiltered_budget_v2')).activeMonth };
});
ok('the app never OPENS in a month that has not happened',
   reopened.month===reopened.now && reopened.stored===reopened.now,
   reopened.month+' stored='+reopened.stored);
ok('...so Track opens on your real figures, not an empty next month',
   /\$3,200/.test(reopened.summary) && reopened.note==='', reopened.summary.slice(0,80));

/* ---- 4. a PAST month is a place you may genuinely be working, so it is kept -
       but it has to say so, which was the actual silence ---- */
const past = await pg.evaluate(async () => {
  const w=ms=>new Promise(x=>setTimeout(x,ms));
  state.activeMonth=shiftMonth(thisMonth(),-1); save();
  activateTab('tx'); renderTx(); await w(500);
  const o={ note:(document.getElementById('txMonthNote')||{innerText:''}).innerText.replace(/\s+/g,' '),
            back:!!document.getElementById('txBack') };
  activateTab('budget'); renderBudget(); await w(500);
  o.planLabel=document.getElementById('mLabel').innerText.replace(/\s+/g,' ');
  return o;
});
ok('a finished month is left alone rather than snapped away from',
   /already finished/.test(past.note), past.note.slice(0,140));
ok('...and says so, where before it rendered a blank',
   /looking back/i.test(past.planLabel) && past.back===true, past.planLabel);
/* it survives a reload, because somebody may be part way through reconciling it */
await pg.reload(); await pg.waitForTimeout(950);
const pastKept = await pg.evaluate(() => ({month:state.activeMonth, now:thisMonth()}));
ok('...and a past month is still there when you come back to it',
   pastKept.month<pastKept.now, pastKept.month);

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
