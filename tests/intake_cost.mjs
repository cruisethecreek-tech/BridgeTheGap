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
