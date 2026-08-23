/* ============================================================
   INTAKE COST HONESTY

   The setup chat tells people what it will cost them before they commit:
   "about 5 minutes and 16 questions", "about 10 minutes and 22 questions",
   "Map my averages now · ~3 min". Those are promises, and a promise about
   length rots the moment somebody adds a step - which is exactly what happened
   before: the spend path advertised "~2 min" while running seventeen steps, and
   the chooser promised "no full-budget homework" one screen before handing over
   seven fixed-bill fields.

   Nothing else can catch that. It is not a bug, no arithmetic is wrong, and
   every other suite passes straight through it. So this one counts the paths
   and holds the copy to what it says.
   ============================================================ */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

/* What each screen claims, and what a claim is allowed to be off by. Minutes are
   an estimate and get a wider band; the question count is countable and is not
   allowed to drift more than one. */
const CLAIMS = {
  spend: { minutes:6,  questions:16, chip:'Just track my spending · ~6 min' },
  full:  { minutes:10, questions:22, chip:'Build my whole budget · ~10 min' },
};
const MINUTE_BAND = 0.25;    // the modelled time may exceed the claim by at most this - under-stating is the dishonest direction
const OVERSTATE_MAX = 2;     // ...and a wildly padded claim scares people off a path they could afford

/* Time model, stated openly so the numbers are arguable rather than magic:
   reading the bot at 200 wpm, ~5s to decide and tap an answer, ~11s to type one.
   The bulk screens (the leak finder, the expenses grid, the income/debt loops)
   are one "answer" each but many fields, so they carry their own weight. */
const WPM = 200, TAP_S = 5, TYPE_S = 11;
const BULK_S = { leak:150, expenses:120, loop:45 };

const results=[]; const check=(name,ok,detail='')=>results.push({ok,name,detail});

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(700);

const measured = await p.evaluate(([WPM,TAP_S,TYPE_S,BULK_S]) => {
  const NO_ANSWER = new Set(['continue','zeroClose','photo']);   // a tap onward, not a question
  const run = ans => {
    let questions=0, seconds=0, steps=[];
    for(const s of INTAKE){
      let show=true; try{ show=(typeof s.showIf==='function')?!!s.showIf(ans):true; }catch(e){ show=false; }
      if(!show) continue;
      steps.push(s.id);
      let bot=''; try{ bot = typeof s.bot==='function' ? String(s.bot(ans)) : String(s.bot||''); }catch(e){}
      seconds += bot.replace(/<[^>]*>/g,' ').trim().split(/\s+/).filter(Boolean).length / WPM * 60;
      if(NO_ANSWER.has(s.input)){ seconds += TAP_S; continue; }
      questions++;
      if(BULK_S[s.input]!=null) seconds += BULK_S[s.input];
      else if(s.input==='money'||s.input==='text') seconds += TYPE_S;
      else seconds += TAP_S;
    }
    return { questions, minutes:Math.round(seconds/60*10)/10, steps };
  };
  const base={name:'Pat',age:'middle',register:'middle',intensity:'blunt',situation:'ok',wage:24,hoursPerWeek:40,budgetPast:'lapsed'};
  const acct=INTAKE.find(s=>s.id==='acct'), deep=INTAKE.find(s=>s.id==='deepOffer');
  return {
    spend: run({...base, acct:'spend', income:3300, deepDive:'light'}),
    spendDeep: run({...base, acct:'spend', income:3300, deepDive:'deep'}),
    full:  run({...base, acct:'full',  income:3300}),
    chips: acct.options.map(o=>o.label),
    deepChips: deep.options.map(o=>o.label),
    /* every tone of the chooser, so the stance can be checked where it belongs */
    says: ['clean','blunt','savage'].map(t=>({t, text:acct.bot({...base, tone:t, acct:undefined})})),
    survives: acct.bot({...base, tone:'savage', situation:'survive'}),
  };
}, [WPM,TAP_S,TYPE_S,BULK_S]);

/* ---- 1. the advertised chips exist, word for word ---- */
for(const [k,c] of Object.entries(CLAIMS))
  check(`the ${k} chip still reads "${c.chip}"`, measured.chips.includes(c.chip), measured.chips.join(' | '));

/* ---- 2. the question counts are true ---- */
for(const [k,c] of Object.entries(CLAIMS)){
  const got=measured[k].questions;
  /* EXACT. A tolerance here defeats the point: one slipped step is how "~2 min"
     came to sit on top of a seventeen-step path. Adding a question now forces
     whoever added it to update what the screen promises. */
  check(`${k}: claims ${c.questions} questions, actually asks ${got}`, got===c.questions,
        got!==c.questions ? `the path changed - update CLAIMS and the acct copy to match` : '');
}

/* ---- 3. the minutes are not UNDER-stated ---- */
for(const [k,c] of Object.entries(CLAIMS)){
  const got=measured[k].minutes;
  check(`${k}: claims ~${c.minutes} min, models at ${got} min`,
        got <= c.minutes*(1+MINUTE_BAND) && c.minutes <= got*OVERSTATE_MAX,
        got>c.minutes*(1+MINUTE_BAND) ? 'the path grew past what the screen promises' : (c.minutes>got*OVERSTATE_MAX?'the claim is padded far beyond the real cost':''));
}

/* ---- 4. the map's own claim ---- */
const mapChip=measured.deepChips.find(l=>/Map my averages/.test(l));
check('"Map my averages" states its cost', /· ~\d+ min/.test(mapChip||''), mapChip);
check('the free option says it is free', measured.deepChips.some(l=>/nothing to fill in/.test(l)), measured.deepChips.join(' | '));
const mapCost=measured.spendDeep.minutes-measured.spend.minutes;
const mapClaim=+((mapChip||'').match(/~(\d+) min/)||[0,0])[1];
check(`the map claims ~${mapClaim} min, adds ${Math.round(mapCost*10)/10} min`, mapCost <= mapClaim*(1+MINUTE_BAND));

/* ---- 4b. bot copy renders as copy, not as source ----
        iaBub/iaBotSay build DOM nodes and never parse HTML, so a raw "<b>" in a
        step's text renders literally: "<b>Just track my spending</b>". The
        emphasis marker is **like this**. This walks every step in every tone
        and every path, because a tag in a branch nobody rendered is invisible
        until a real person hits that branch on their phone. ---- */
const copy = await p.evaluate(() => {
  const bad=[], base={name:'Pat',age:'middle',register:'middle',situation:'ok',wage:24,hoursPerWeek:40,budgetPast:'lapsed',income:3300};
  const variants=[];
  for(const tone of ['clean','blunt','savage'])
    for(const reg of ['genz','middle','mature'])
      for(const acct of ['spend','full'])
        for(const dd of ['deep','light','track'])
          variants.push({...base, tone, register:reg, acct, deepDive:dd});
  variants.push({...base, tone:'savage', situation:'survive'}, {...base, tone:'savage', situation:'treading'});
  let checked=0;
  for(const a of variants) for(const s of INTAKE){
    for(const [what,val] of [['bot',s.bot],['hint',s.hint],['why',s.why]]){
      let t=''; try{ t = typeof val==='function' ? String(val(a)) : (val==null?'':String(val)); }catch(e){ continue; }
      if(!t) continue; checked++;
      if(/<\/?[a-zA-Z][^>]*>/.test(t)) bad.push(`${s.id}.${what}: ${t.slice(0,90)}`);
    }
    for(const o of (s.options||[])){
      for(const [what,val] of [['label',o.label],['reply',o.reply]]){
        const t=String(val==null?'':val); if(!t) continue; checked++;
        if(/<\/?[a-zA-Z][^>]*>/.test(t)) bad.push(`${s.id}.option.${what}: ${t.slice(0,90)}`);
      }
    }
  }
  /* and the renderer really must not parse markup, whatever it is handed */
  const log=document.getElementById('intakeLog'); log.innerHTML='';
  iaBub('<img src=x onerror=alert(1)><b>x</b>','me');
  iaBub('a **bold** bit and a literal <b>tag</b>','bot');
  const bubs=[...log.querySelectorAll('.bub')];
  return { bad, checked,
    userTagsRendered: bubs[0].querySelectorAll('*').length,
    botBolds: [...bubs[1].querySelectorAll('b')].map(x=>x.textContent),
    botKeepsTagLiteral: bubs[1].textContent.includes('<b>tag</b>') };
});
check(`no step's copy contains raw HTML (${copy.checked} strings across every tone and path)`,
      copy.bad.length===0, copy.bad.slice(0,4).join('\n        '));
check('a user bubble renders no elements at all', copy.userTagsRendered===0, String(copy.userTagsRendered));
check('the ** marker still bolds in bot copy', copy.botBolds.length===1 && copy.botBolds[0]==='bold', JSON.stringify(copy.botBolds));
check('a stray tag in bot copy stays literal rather than silently working', copy.botKeepsTagLiteral);

/* ---- 4c. the income questions add up ----
        The running strip summed only the EXTRA sources, so a $3,200 paycheck
        plus a $1,500 side gig plus a $6,000 partner displayed "= $7,500" while
        the household actually brings in $10,700 - a wrong total shown at the
        exact moment somebody is checking their numbers. And "Done - that's all
        my income" moved straight on without ever reading the picture back. ---- */
const income = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  document.getElementById('intake').classList.add('on');
  document.getElementById('intakeLog').innerHTML='';
  state.chatPace='instant';
  iaAns={name:'Pat',age:'middle',register:'middle',tone:'blunt',situation:'ok',acct:'spend',
         income:3200, hoursPerWeek:40, wage:18.50};
  const step=INTAKE.find(s=>s.id==='moreIncome'); iaStep=INTAKE.indexOf(step);
  const dock=()=>document.getElementById('intakeDock');
  const chip=t=>[...dock().querySelectorAll('button[data-ci]')].find(b=>b.innerText.includes(t));
  const strip=()=>{const e=dock().querySelector('.loop-sum');return e?e.innerText:'';};
  renderLoop(step);
  const out={ stripWithNoExtras:strip(), amountPlaceholders:{} };
  chip('Side gig').click(); await wait(50);
  out.amountPlaceholders['Side gig']=document.getElementById('iaLoopAmt').placeholder;
  document.getElementById('iaLoopAmt').value=1500; document.getElementById('iaLoopAmtGo').click(); await wait(60);
  out.gigAsksHours=!!document.getElementById('iaLoopHrs');
  document.getElementById('iaLoopHrs').value=20; document.getElementById('iaLoopHrsGo').click(); await wait(200);
  chip("Partner's pay").click(); await wait(50);
  out.amountPlaceholders['Partner']=document.getElementById('iaLoopAmt').placeholder;
  document.getElementById('iaLoopAmt').value=6000; document.getElementById('iaLoopAmtGo').click(); await wait(60);
  out.partnerAsksHours=!!document.getElementById('iaLoopHrs');
  document.getElementById('iaLoopHrs').value=160; document.getElementById('iaLoopHrsGo').click(); await wait(200);
  out.strip=strip();
  chip('Benefits').click(); await wait(50);
  document.getElementById('iaLoopAmt').value=800; document.getElementById('iaLoopAmtGo').click(); await wait(150);
  out.benefitsAsksHours=!!document.getElementById('iaLoopHrs');
  out.stripAll=strip();
  const bubs=()=>[...document.querySelectorAll('#intakeLog .bub.bot')].map(b=>b.textContent);
  out.rates=bubs().filter(t=>/an hour\b/.test(t));
  const adv=window.iaAdvance; window.iaAdvance=()=>{};
  document.getElementById('iaLoopDone').click(); await wait(300);
  window.iaAdvance=adv;
  out.recap=bubs().pop();
  return out;
});
const money=t=>[...String(t).matchAll(/\$([\d,]+(?:\.\d+)?)/g)].map(m=>+m[1].replace(/,/g,''));
const eq=(a,b)=>Math.abs(a-b)<0.005;
const baseOnly=money(income.stripWithNoExtras).pop();
const stripTotal=money(income.stripAll).pop();
check(`the running total counts income 1 as income (got ${baseOnly})`, eq(baseOnly,3200), income.stripWithNoExtras);
check(`...and every source after it (got ${stripTotal}, want 11500)`, eq(stripTotal,11500), income.stripAll);
check('a monthly side-gig amount is not suggested as "$40"', /e\.g\. 500/.test(income.amountPlaceholders['Side gig']||''),
      income.amountPlaceholders['Side gig']);
check("a partner's amount gets its own realistic example", /e\.g\. 2400/.test(income.amountPlaceholders['Partner']||''),
      income.amountPlaceholders['Partner']);
check('a side gig is asked for its hours', income.gigAsksHours===true);
check("a partner's pay is asked for theirs", income.partnerAsksHours===true);
check('passive benefits are not', income.benefitsAsksHours===false);
check(`every worked source reports its own rate (${income.rates.length} of 2)`, income.rates.length===2, income.rates.join('  //  '));
check('the side gig rate is right ($1,500 / 20 hrs = $75)', /\$75 an hour/.test(income.rates[0]||''), income.rates[0]);
check("the partner's rate is right ($6,000 / 160 hrs = $37.50)", /\$37\.50 an hour/.test(income.rates[1]||''), income.rates[1]);
check('Done reads the whole picture back instead of moving on', /landing each month/.test(income.recap||''),
      (income.recap||'(nothing said)').slice(0,110));
check('the recap names every dollar, not just the extras', /\$11,500/.test(income.recap||''), income.recap);
/* $3,200 pay + $1,500 gig + $800 benefits = $5,500 is yours; the $6,000 is theirs. */
check('the recap separates what is yours from the household total', /\$5,500 of it is yours/.test(income.recap||''), income.recap);
/* ...but the RATE counts only what you sold hours for: ($3,200 + $1,500) / (173.3 + 20)
   = $24.31. Folding the passive $800 in would quote $28.45 - a rate the app never
   prices with, because recomputeBlendedWage ignores income with no hours. */
check('the recap rate ignores passive income, like the wage engine does',
      /\$24\.31 an hour/.test(income.recap||''), income.recap);

/* ---- 4d. the leak finder shows its working ----
        "2 /wk x $50" producing "$433" is the most surprising number on that
        screen: everybody computes $400 in their head, because a month feels
        like 4 weeks and is actually 4.33. A budgeting app cannot hand someone a
        figure they think is wrong and say nothing. ---- */
const leaks = await p.evaluate(() => {
  document.getElementById('intake').classList.add('on');
  document.getElementById('intakeLog').innerHTML='';
  iaAns={name:'Pat',age:'middle',register:'middle',tone:'blunt',situation:'ok',acct:'spend',income:3200,wage:18.5,deepDive:'deep',leaks:[]};
  leakFinder({});
  const dock=document.getElementById('intakeDock');
  const set=(sel,v)=>{const e=dock.querySelector(sel); e.value=v; e.dispatchEvent(new Event('input',{bubbles:true}));};
  set('[data-ln="1"]',2); set('[data-lc="1"]',50);                 // 2/wk x $50
  const f=dock.querySelector('[data-lf="5"]'); f.value='day'; f.dispatchEvent(new Event('change',{bubbles:true}));
  set('[data-ln="5"]',1); set('[data-lc="5"]',9);                  // 1/day x $9
  return {
    weekly:  dock.querySelector('[data-lm="1"]').textContent,
    weeklyWork: dock.querySelector('[data-lw="1"]').textContent,
    daily:   dock.querySelector('[data-lm="5"]').textContent,
    dailyWork: dock.querySelector('[data-lw="5"]').textContent,
    /* the same $100/wk as a RECURRING item must land on the same number - one
       rounded 4.33 here against recMonthly's exact 52/12 was a real mismatch */
    viaRecurring: recMonthly({amount:100, freq:'weekly'}),
    viaLeak: leakMonthly(2,'week',50),
    monthUnchanged: leakMonthly(3,'month',20),
  };
});
check('2/wk x $50 is $433, not $400', /\$433/.test(leaks.weekly), leaks.weekly);
check('...and the row says why', /\$100\/wk × 4\.33 wks a month/.test(leaks.weeklyWork), leaks.weeklyWork);
check('1/day x $9 is $274', /\$274/.test(leaks.daily), leaks.daily);
check('...with the daily multiplier shown', /\$9\/day × 30\.42 days a month/.test(leaks.dailyWork), leaks.dailyWork);
check(`$100/wk agrees with the recurring engine (${Math.round(leaks.viaLeak*100)/100} vs ${Math.round(leaks.viaRecurring*100)/100})`,
      Math.abs(leaks.viaLeak-leaks.viaRecurring)<0.005,
      'a rounded 4.33 here against recMonthly\'s exact 52/12 disagreed by a third of a dollar');
check('a monthly amount is left alone', Math.abs(leaks.monthUnchanged-60)<0.005, String(leaks.monthUnchanged));

/* ---- 4e. savings are not a leak ----
        The finder asked about bills and habits and called EVERYTHING else
        unaccounted, so a household putting $8,000 of $13,400 away was told it
        was "bleeding out while nobody watched" - the exact opposite of the
        truth, aimed at the person doing the best job of anyone. ---- */
const fair = await p.evaluate(() => {
  const step=INTAKE.find(s=>s.id==='blindSpend');
  const base={name:'Pat',age:'middle',register:'middle',situation:'ok',acct:'spend',deepDive:'deep',
              wage:18.5,income:13400,billsMapped:true,tone:'savage'};
  const bills=[{name:'Rent / mortgage',monthly:850,fixed:true},{name:'Insurance',monthly:360,fixed:true}];
  const habits=[{name:'Takeout / delivery',monthly:433}];
  const saving=[{name:'Savings',monthly:4000,fixed:true,purpose:true},
                {name:'Investing / retirement',monthly:4000,fixed:true,purpose:true}];
  const strip=t=>String(t).replace(/\*\*/g,'');
  // the finder offers the rows at all
  document.getElementById('intake').classList.add('on');
  document.getElementById('intakeLog').innerHTML='';
  iaAns={...base, leaks:[]}; leakFinder({});
  const dock=document.getElementById('intakeDock');
  const rowFor=i=>dock.querySelector('[data-fx="p'+i+'"]');
  const set=(sel,v)=>{const e=dock.querySelector(sel); e.value=v; e.dispatchEvent(new Event('input',{bubbles:true}));};
  set('[data-fx="p0"]',4000); set('[data-fx="p1"]',4000); set('[data-ln="1"]',2); set('[data-lc="1"]',50);
  const stripTotal=document.getElementById('leakTotal').textContent;
  /* read the DOM BEFORE Go - it advances the intake and replaces the dock */
  const offersRows = ON_PURPOSE.length===3 && !!rowFor(0) && !!rowFor(1) && !!rowFor(2);
  document.getElementById('leakGo').click();
  const collected=iaAns.leaks;
  return {
    offersRows, stripTotal,
    /* hand-check the arithmetic the verdict must land on:
       in 850 + 360 bills, 433 habits, 8,000 put away = 9,643 mapped
       of 13,400 income, so 3,757 is what the screen never asked about */
    wantMapped: 850+360+433+8000, wantRest: 13400-(850+360+433+8000),
    taggedPurpose: collected.filter(x=>x.purpose).map(x=>x.name),
    habitsOnly: collected.filter(x=>!x.fixed).reduce((s,x)=>s+x.monthly,0),
    withSaving: strip(step.bot({...base, leaks:bills.concat(habits,saving)})),
    without:    strip(step.bot({...base, leaks:bills.concat(habits)})),
  };
});
check('the finder asks what you already put away', fair.offersRows===true);
check('...and counts it in the running total ($8,000 + $433 = $8,433)', /\$8,433/.test(fair.stripTotal), fair.stripTotal);
check('savings are tagged as on-purpose, not as leaks', fair.taggedPurpose.length===2, fair.taggedPurpose.join(', '));
check('...and stay out of the habits the spending limit is built on', Math.abs(fair.habitsOnly-433)<0.005, String(fair.habitsOnly));
check('the verdict names the money going somewhere on purpose', /\$8,000 of that is money you're deliberately sending somewhere/.test(fair.withSaving), fair.withSaving.slice(0,150));
check(`...so the leftover is ${fair.wantRest} (income minus everything mapped), not income minus bills+habits`,
      money(fair.withSaving).includes(fair.wantRest) && money(fair.withSaving).includes(fair.wantMapped),
      fair.withSaving.slice(-180));
check('...and without the savings rows the leftover is bigger by exactly them',
      money(fair.without).includes(fair.wantRest+8000), fair.without.slice(-160));
check('nobody is told they are bleeding out', !/bleeding out|couldn't name/i.test(fair.withSaving+fair.without), fair.without.slice(-170));
check('the leftover is named as unasked-about, not as waste',
      /didn't ask about/.test(fair.without) && /Not waste/.test(fair.without), fair.without.slice(-140));

/* ---- 4f. nothing congratulates someone who just said they are struggling ----
        The intro opened with "Great." one bubble after a user answered "Treading
        water" and was told "Exhausting, that one." The affirmation was keyed to
        the GENERATION dial and blind to what had just been disclosed - the app
        talking over the person instead of listening. Silence is warmer than the
        wrong word, so an opener now has to be earned. ---- */
const kind = await p.evaluate(() => {
  const CONGRATS=/^\s*(great|wonderful|bet|nice|perfect|awesome|amazing|excellent|brilliant|love (that|it)|beautiful|fantastic)\b/i;
  const bad=[]; let checked=0;
  const base={name:'Pat',wage:24,hoursPerWeek:40,budgetPast:'lapsed',income:3300};
  for(const situation of ['survive','treading','stuck'])
    for(const register of ['genz','middle','mature'])
      for(const tone of ['clean','blunt','savage'])
        for(const acct of ['spend','full'])
          for(const s of INTAKE){
            let t=''; try{ t = typeof s.bot==='function' ? String(s.bot({...base, situation, register, tone, acct})) : String(s.bot||''); }catch(e){ continue; }
            if(!t) continue; checked++;
            if(CONGRATS.test(t.replace(/\*\*/g,''))) bad.push(`${s.id} [${situation}/${register}]: ${t.slice(0,60)}`);
          }
  /* ...and the one place it IS earned still says it */
  const intro=INTAKE.find(s=>s.id==='intro');
  const built=['genz','middle','mature'].map(register=>String(intro.bot({...base, situation:'build', register, tone:'blunt'})));
  return { bad, checked, built:built.map(t=>t.slice(0,12)) };
});
check(`nothing congratulates a struggling user (${kind.checked} lines across every situation, register, tone and path)`,
      kind.bad.length===0, kind.bad.slice(0,3).join('\n        '));
check('...but "stable, ready to build" still gets one, in its own voice',
      kind.built.every(t=>/^(Bet|Great|Wonderful)\./.test(t)), kind.built.join(' | '));

/* ---- 4g. no step may claim a position it does not hold ----
        The wage step opened "Last setup question" - true when it was written,
        false the moment it moved up so each income could get its own rate. Seven
        questions still followed it on the spend path, twelve on the full one.
        Copy that describes its own POSITION rots whenever anything is reordered,
        which is precisely why it needs a test rather than care. ---- */
const position = await p.evaluate(() => {
  const NO_ANSWER=new Set(['continue','zeroClose','photo','start']);
  const CLAIMS=[
    {re:/\b(last (setup )?question|final question|last one)\b/i, max:0,  what:'claims to be the last question'},
    {re:/\b(one more|one last|just one more)\b/i,                max:2,  what:'claims one question remains'},
    {re:/\b(almost done|nearly there|nearly done)\b/i,           max:4,  what:'claims the end is near'},
  ];
  const base={name:'Pat',register:'middle',situation:'ok',wage:22,hoursPerWeek:40,budgetPast:'lapsed',income:3300};
  const paths=[{acct:'spend',deepDive:'deep'},{acct:'spend',deepDive:'light'},{acct:'full'}];
  const bad=[]; let checked=0;
  for(const extra of paths) for(const tone of ['clean','blunt','savage']){
    const a={...base,...extra,tone};
    const vis=INTAKE.filter(s=>{ try{ return !s.showIf||s.showIf(a); }catch(e){ return false; } });
    vis.forEach((s,i)=>{
      let t=''; try{ t = typeof s.bot==='function' ? String(s.bot(a)) : String(s.bot||''); }catch(e){ return; }
      if(!t) return;
      const after=vis.slice(i+1).filter(x=>!NO_ANSWER.has(x.input)).length;
      for(const c of CLAIMS){ if(!c.re.test(t)) continue; checked++;
        if(after>c.max) bad.push(`${s.id} [${extra.acct}/${tone}] ${c.what} but ${after} follow`); }
    });
  }
  return { bad:[...new Set(bad)], checked };
});
check(`no step claims a position it does not hold (${position.checked} positional claims across every path and tone)`,
      position.bad.length===0, position.bad.slice(0,4).join('\n        '));

/* ---- 4h. an instruction to leave needs a way out ----
        The savage chooser ends "if six minutes is too much to spend on the thing
        that decides where your life actually goes, STOP HERE" - and then offered
        two buttons, both of which continue. Telling someone to leave and not
        letting them is worse than never saying it. ---- */
const exits = await p.evaluate(() => {
  const TELLS_YOU_TO_GO=/stop here|isn't your app|is not your app|walk away|come back when/i;
  const base={name:'Pat',register:'middle',situation:'ok',wage:22,hoursPerWeek:40,budgetPast:'lapsed',income:3300};
  const missing=[], present=[];
  let checked=0;
  for(const tone of ['clean','blunt','savage'])
    for(const acct of ['spend','full'])
      for(const s of INTAKE){
        let t=''; try{ t = typeof s.bot==='function' ? String(s.bot({...base,tone,acct})) : String(s.bot||''); }catch(e){ continue; }
        if(!TELLS_YOU_TO_GO.test(t)) continue;
        checked++;
        const bail=(typeof s.bail==='function')?s.bail({...base,tone,acct}):null;
        if(bail && bail.label && bail.bye) present.push(`${s.id}/${tone}: "${bail.label}"`);
        else missing.push(`${s.id}/${tone} says go, offers nothing`);
      }
  /* and the exit has to be worded like the line that invited it. Guarded,
     because a step with no bail at all must FAIL this suite, not crash it - a
     harness that throws cannot tell you whether the feature is missing or the
     test is. */
  const acct=INTAKE.find(s=>s.id==='acct');
  const labels=['clean','blunt','savage'].map(tone=>{
    try{ const bl=(typeof acct.bail==='function')?acct.bail({...base,tone}):null; return (bl&&bl.label)||'(no exit)'; }
    catch(e){ return '(threw)'; } });
  return { missing, present:[...new Set(present)], checked, labels };
});
check(`copy that tells you to leave offers the door (${exits.checked} such lines)`,
      exits.missing.length===0, exits.missing.slice(0,3).join('\n        '));
check('...and the door is worded in the same voice as the line', new Set(exits.labels).size===3, exits.labels.join(' | '));
check('...savage, which literally says "stop here", says it on the button', exits.labels[2]==='Stop here', exits.labels[2]);

/* ---- 5. the stance is actually in the conversation ---- */
for(const {t,text} of measured.says){
  check(`${t}: names the real minutes`, /\*\*6 minutes\*\*/.test(text) && /\*\*10 minutes\*\*/.test(text));
  check(`${t}: names the question counts`, /16 questions/.test(text) && /22 questions/.test(text));
  check(`${t}: says the quiet part rather than apologising for asking`,
        /isn't your app|keep the six minutes|not going to pretend otherwise/.test(text));
}
/* ...but never at someone who is drowning. iaTone floors survival to clean. */
check('survival never gets told to leave', !/isn't your app|stop here|keep the six minutes/.test(measured.survives),
      measured.survives.slice(0,90));

console.log('INTAKE COST HONESTY - does the setup chat tell the truth about itself?\n');
console.log(`  just track my spending   ${measured.spend.questions} questions, ~${measured.spend.minutes} min modelled   (${measured.spend.steps.length} steps)`);
console.log(`    + map my averages      ${measured.spendDeep.questions} questions, ~${measured.spendDeep.minutes} min modelled`);
console.log(`  build my whole budget    ${measured.full.questions} questions, ~${measured.full.minutes} min modelled   (${measured.full.steps.length} steps)\n`);
let fails=0;
for(const r of results){ if(!r.ok) fails++; console.log(`${r.ok?'ok  ':'FAIL'}  ${r.name}${r.detail?'\n        '+r.detail:''}`); }
console.log(`\n${results.length-fails} of ${results.length} claims hold`);
console.log('page errors:', errs.length?errs:'none');
await b.close();
if(fails) process.exit(1);
