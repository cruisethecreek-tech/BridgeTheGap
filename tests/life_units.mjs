/* ============================================================
   LIFE-HOURS UNIT COHERENCE

   Freedom Mode reprices the whole app in hours of your life: money() quietly
   becomes fmtLife(). That is right for a figure you READ, and it silently
   corrupts two kinds of figure it does not own:

     1. A figure you ACT on. Every input in this app takes dollars - the app
        says so itself ("you always type dollars, only the display changes").
        So a button reading "Assign 3.2 days", or an instruction reading "Set it
        to at least 1.6 days", names a value the field will not accept. This is
        the same fault as offering to bank ten minutes into an emergency fund:
        goals hold dollars, and nobody can deposit ten minutes.

     2. A figure that already has a life translation printed beside it. The
        headline converts too, and the card prints one amount twice in two
        different units: "Spent this month 20.3 days / That's 162 hrs of life".

   Neither shows up in dollar mode, neither breaks any arithmetic, and every
   math suite passes straight through both. Only reading the screen in Freedom
   Mode catches them - so this suite reads the screen.
   ============================================================ */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const LIFE = /\b\d[\d,.]*\s*(min|hrs?|hours?|days?|mo|months?)\b/i;
const DOLLARS = /\$\s?\d/;

/* The fixture was written in August 2026 and pinned there. Every figure inside
   it is internally consistent, so almost everything kept passing - but the app
   compares fixture data against the LIVE clock in a few places, and on the 1st
   of September the "You cover $X" line stopped rendering because the household's
   income was suddenly last month's. A fixture that means "now" has to say now.
   Nothing here is dated past the 20th, so no date can fall off the end of a
   shorter month. */
const LIVE_M=(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;})();
const LIVE_PREV=(()=>{const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;})();
const liveMonths=o=>JSON.parse(JSON.stringify(o).split('2026-08').join(LIVE_M).split('2026-07').join(LIVE_PREV));

/* One household rich enough to light up every panel that prints money. */
const STATE = {
  onboarded:true, activeMonth:'2026-08', uiMode:'all', stageReached:3, chatPace:'instant',
  hourlyWage:24, hoursPerWeek:40, register:'middle', intensity:'blunt',
  spendingMode:true, spendLimit:1550, trackStart:'2026-08-01', theme:'light',
  enough:3500, givePct:10, householdOn:true, wageB:19, debtBudget:900,
  freedomMode:true,
  categories:[{id:'roof',name:'Roof'},{id:'food',name:'Food'},{id:'groc',name:'Groceries',parentId:'food'},
    {id:'eat',name:'Eating out',parentId:'food'},{id:'pow',name:'Power & Wi-Fi'},{id:'elec',name:'Electric',parentId:'pow'},
    {id:'car',name:'Getting Around'},{id:'mem',name:'Memberships'},{id:'sav',name:'Savings'},{id:'fun',name:'Fun'}],
  budgets:{'2026-07':{roof:1250,groc:400,eat:220,pow:300,car:340,mem:60,sav:900,fun:230},
           '2026-08':{roof:1250,groc:400,eat:220,pow:300,car:340,mem:60,sav:900,fun:230}},
  transactions:[
    {id:'i1',type:'income',amount:3200,source:'Paycheck',owner:'a',date:'2026-08-01',hours:173},
    {id:'i2',type:'income',amount:980,source:"Partner's pay",owner:'b',date:'2026-08-05'},
    {id:'i3',type:'income',amount:520,source:'Side gig',owner:'a',date:'2026-08-15',hours:20},
    {id:'s1',type:'expense',amount:1250,catId:'roof',date:'2026-08-02'},
    {id:'s2',type:'expense',amount:380,catId:'groc',date:'2026-08-04'},
    {id:'s3',type:'expense',amount:260,catId:'eat',date:'2026-08-09'},
    {id:'s4',type:'expense',amount:118,catId:'elec',date:'2026-08-11'},
    {id:'s5',type:'expense',amount:305,catId:'car',date:'2026-08-14'},
    {id:'s6',type:'expense',amount:270,catId:'fun',date:'2026-08-20'},
    {id:'v1',type:'invest',amount:400,source:'Index fund',date:'2026-08-06',ikind:'holds'}],
  recurring:[{id:'r1',type:'income',amount:3200,source:'Paycheck',anchor:'2026-08-01',freq:'monthly',hours:173},
             {id:'r3',type:'expense',amount:60,catId:'mem',anchor:'2026-08-18',freq:'monthly'}],
  goals:[{id:'g1',name:'Emergency fund',target:6000,saved:1400,date:'2027-06-01',goalType:'foundation'}],
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:2150}],
  assets:[{id:'as1',name:'Index fund',value:12000,kind:'real'},{id:'as2',name:'Truck',value:9000,kind:'stuff',cost:180}],
  liabilities:[{id:'l1',name:'Credit card',value:2400}],
  debts:[{id:'d1',name:'Credit card',balance:2400,minPayment:75,apr:23.9},
         {id:'d2',name:'Car loan',balance:8600,minPayment:240,apr:6.4}],
  skills:[{id:'sk1',name:'Welding course',cost:1200,lift:400}],
  network:[{id:'n1',name:'Mentor - Dee',value:'intro to the shop'}],
  impulse:[{id:'p1',name:'New phone',amount:1100,date:'2026-08-10',type:'skip'}],   // type:, the field logNeutralize actually writes - verdict: made the War Chest $0 and the test checked a vacuous string
  vault:[{id:'w1',name:'New phone',amount:1100,unlocksAt:Date.now()+86400000,trap:'status'}],
  diary:[{id:'dy1',date:'2026-08-19',ts:'2026-08-19T18:40:00',kind:'win',text:'Skipped takeout twice.',acted:[{amount:38,label:'Eating out'}]}],
  sweptDays:{}, goalsGiven:[], impulseStreak:3, intake:{}
};

const fails=[]; let checked=0;
const fail=(what,where,text)=>fails.push({what,where,text});

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{width:420,height:1000} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);
await p.evaluate(st=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(st)), liveMonths(STATE));
await p.reload(); await p.waitForTimeout(1100);

/* the debt planner says three different things depending on what you can pay,
   and only one of them renders at a time - so drive all three */
const PASSES=[['home',0],['budget',0],['tx',0],['impulse',0],['goals',0],['diary',0],['settings',0],
              ['debt',100],['debt',330],['debt',900]];
for (const [tab, debtBudget] of PASSES) {
  await p.evaluate(([t,db])=>{ if(db){ state.debtBudget=db; save(); }
    activateTab(t);
    if(t==='debt'){ if(typeof renderDebt==='function') renderDebt();
                    if(typeof renderDebtResults==='function') renderDebtResults(); }   // the "set it to at least" message lives here
    if(t==='home'){ calSelDay=3; if(typeof renderRewardCalendar==='function') renderRewardCalendar(); } }, [tab,debtBudget]);
  await p.waitForTimeout(400);
  await p.evaluate(()=>document.querySelectorAll('.view.on details').forEach(d=>d.open=true));
  await p.waitForTimeout(300);

  const found = await p.evaluate(() => {
    const view=document.querySelector('.view.on');
    /* #timeRows is the week-in-hours ledger: its "+1 hr" controls are GENUINE
       time, not converted money, so they are the one legitimate exception. */
    /* Judged by accessible name where there is one. That is what a screen reader
       announces and what the control therefore claims to do - a ledger row that
       shows "-1.4 days" but announces "Open the Food entry" is a record you can
       open, not a field you can type days into. A button with no label is still
       judged on its text. */
    const buttons=[...view.querySelectorAll('button')]
      .filter(el=>!el.closest('#timeRows'))
      .map(el=>((el.getAttribute('aria-label')||el.innerText)||'').trim()).filter(Boolean);
    /* a caption that does the converting means the figure above it must not */
    const asides=[...view.querySelectorAll('*')].filter(el=>{
      const t=(el.innerText||'').trim();
      /* a CONVERTING caption carries a figure ("84 hrs of your life"). Static
         prose that merely mentions the phrase ("Tap any card to flip between
         dollars and hours of your life") converts nothing and is not a pair. */
      return el.children.length===0
        && /(of your life|of life|of work)\b/i.test(t)
        && /\b\d[\d,.]*\s*(min|hrs?|hours?|days?|mo)\b/i.test(t);
    }).map(el=>{
      /* walk up until the block holds more than the caption itself - the
         headline the caption is converting usually sits one or two levels up */
      const aside=(el.innerText||'').trim();
      let box=el.parentElement, block='';
      for(let hops=0; box && hops<4; hops++, box=box.parentElement){
        /* A .unit-work line IS the same amount in two units, on purpose - it is
           the field saying "you typed 40 a week, here is the month I will use".
           That is the fix, not the fault, so it never counts as the headline a
           life caption is wrongly converting. */
        let t=(box.innerText||'').trim();
        box.querySelectorAll('.unit-work').forEach(u=>{ const ut=(u.innerText||'').trim(); if(ut) t=t.replace(ut,''); });
        t=t.trim();
        const rest=t.replace(aside,'').trim();
        if(/\$\s?\d/.test(rest) || /\b\d[\d,.]*\s*(min|hrs?|hours?|days?|mo)\b/i.test(rest)){ block=t; break; }
      }
      return { aside, block };
    });
    return { buttons, asides, text:view.innerText };
  });

  /* ---- 1. no button asks you to act on a time value ----
     Read by ACCESSIBLE NAME, not by the pixels inside it. The rule is about what
     a control says it does, and that is precisely what aria-label carries: a
     ledger row in Life mode displays "-1.4 days" and announces "Open the Food
     entry", which is not an invitation to type days into anything. A command
     button with no label still gets judged on its text, as before. */
  for(const t of found.buttons){ checked++;
    if(LIFE.test(t) && !/\+\s*\d+\s*(hr|min)/i.test(t)) fail('button names a time value you cannot type', tab, t);
  }
  // ---- 2. a life caption must sit under a DOLLAR figure, not a second life figure ----
  for(const a of found.asides){ checked++;
    const headline=a.block.replace(a.aside,'').trim();
    if(LIFE.test(headline) && !DOLLARS.test(headline))
      fail('same amount printed twice, in two units', tab, a.block.replace(/\n/g,' / '));
  }
  // ---- 3. an instruction to type a value must name dollars ----
  /* capture the VALUE the imperative names - a number plus its unit word. The
     decimal point matters: "1.6 days" must not truncate to "1". */
  const IMPERATIVE=/(?:Set it to at least|Set it to|Set your|Assign your last|You need at least roughly|You need at least|Give)\s+(?:roughly\s+)?(\$?\s?[\d,]+(?:\.\d+)?\s*(?:min|hrs?|hours?|days?|mo|months?)?)/gi;
  for(const line of found.text.split('\n')){
    for(const m of line.matchAll(IMPERATIVE)){
      checked++;
      const value=m[1].trim();
      if(LIFE.test(value)) fail('instruction names a value the field will not accept', tab, line.trim());
    }
  }
}

/* ---- 3b. branches the main household never reaches. The Home ladder only
        nags about assigning when money is UNassigned, and the debt planner only
        says "you are not outrunning the interest" when the interest beats what
        you can pay - which needs a nastier debt than a normal household has. ---- */
const hard = await p.evaluate(() => {
  const out={}, keep={budgets:JSON.parse(JSON.stringify(state.budgets)), debts:state.debts, debtBudget:state.debtBudget};
  // money left unassigned, and a giving target not yet met
  state.budgets['2026-08']={roof:1250}; state.givePct=10; state.goalsGiven=[]; save();
  activateTab('home'); renderHome();
  out.ladder=(document.getElementById('nextSteps')||{}).innerText||'';
  // a debt whose interest outruns the payment
  state.debts=[{id:'x1',name:'Payday loan',balance:20000,minPayment:100,apr:29.9}];
  state.debtBudget=300; save();
  activateTab('debt'); if(typeof renderDebt==='function') renderDebt();
  if(typeof renderDebtResults==='function') renderDebtResults();
  out.debt=document.getElementById('view-debt').innerText;
  Object.assign(state, keep); save(); renderAll();   // put the household back for the checks below
  return out;
});
for(const [where,txt] of [['ladder',hard.ladder],['debt-interest',hard.debt]]){
  for(const line of txt.split('\n')){
    for(const m of line.matchAll(/(?:Set it to at least|Assign your last|You need at least roughly|Give)\s+(?:roughly\s+)?(\$?\s?[\d,]+(?:\.\d+)?\s*(?:min|hrs?|hours?|days?|mo|months?)?)/gi)){
      checked++;
      if(LIFE.test(m[1].trim())) fail('instruction names a value the field will not accept', where, line.trim());
    }
  }
}

/* ---- 4. stat cards that pair a dollar figure with its own life equivalent.
        These are SIBLINGS, not a caption under a headline, so the generic pair
        rule cannot see them: "War Chest 0 min / Life Reclaimed 0 hrs" is the
        same amount twice with no phrase to key off. ---- */
const pairs = await p.evaluate(() => {
  activateTab('impulse'); if(typeof renderImpulse==='function') renderImpulse();
  const grab=k=>{ const el=[...document.querySelectorAll('#view-impulse .stat')]
                    .find(s=>(s.innerText||'').startsWith(k)); return el?el.innerText.replace(/\n/g,' ').trim():''; };
  const v=(()=>{ const e=document.querySelector('.vaultitem'); return e?e.innerText.replace(/\n/g,' / '):''; })();
  return { war:grab('War Chest'), life:grab('Life Reclaimed'), vault:v };
});
for(const [name,txt,need] of [
  ['War Chest is dollars, since Life Reclaimed sits beside it', pairs.war, DOLLARS],
  ['Life Reclaimed is the one in hours', pairs.life, LIFE],
  ['a vaulted item shows its price, with the hours as the aside', pairs.vault, DOLLARS],
]){ checked++; if(txt && !need.test(txt)) fail(name,'pairs',txt); }

/* ---- 5. the specific sentences that were broken, by name ---- */
const named = await p.evaluate(() => {
  activateTab('home'); calSelDay=3; renderRewardCalendar(); renderAll();
  const home=document.getElementById('view-home').innerText;
  activateTab('budget');
  /* The roll-up prompt moved off the Plan row and into the category's own sheet
     when the list was cut back to a line each. Same sentence, same rule about
     what it may say, one tap further in - so the test follows it there. */
  const grp=state.categories.find(c=>state.categories.some(k=>k.parentId===c.id));
  if(grp && typeof openCatSheet==='function') openCatSheet(grp.id);
  const plan=document.getElementById('view-budget').innerText
    + '\n' + ((document.getElementById('catSheetBody')||{}).innerText||'');
  return {
    allowance:(home.match(/Your daily allowance is [^)]*\)/)||[''])[0],
    spent:(home.match(/Spent this month\n[^\n]*/)||[''])[0].replace('\n',' '),
    fair:(home.match(/^You \w+ \$[\d,.]+/m)||[''])[0],
    assign:(plan.match(/Assign \$[\d,]+ →/)||[''])[0],
  };
});
const named_checks=[
  ['the allowance shows dollar-per-day arithmetic, not time ÷ days', /\(\$[\d,]+ ÷ \d+ days\)/.test(named.allowance), named.allowance],
  ['"Spent this month" is dollars because its caption converts', DOLLARS.test(named.spent), named.spent],
  ['"You cover", not "You covers"', /^You cover \$/.test(named.fair), named.fair],
  ['the roll-up button assigns a dollar figure', /Assign \$[\d,]+ →/.test(named.assign), named.assign],
];
for(const [name,ok,txt] of named_checks){ checked++; if(!ok) fail(name,'named',txt); }

console.log('LIFE-HOURS UNIT COHERENCE - every surface, in Freedom Mode\n');
for(const [name,ok,txt] of named_checks) console.log(`${ok?'ok  ':'FAIL'}  ${name.padEnd(58)} ${txt}`);
if(fails.length){
  console.log('\nFAILURES:');
  for(const f of fails) console.log(`  [${f.where}] ${f.what}\n      ${f.text}`);
}
console.log(`\n${checked} strings checked, ${fails.length} unit faults`);
console.log('page errors:', errs.length?errs:'none');
await b.close();
if(fails.length) process.exit(1);
