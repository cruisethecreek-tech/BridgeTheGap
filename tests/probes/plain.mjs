import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:1100}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
/* their numbers off the screenshot */
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',hourlyWage:30,
  categories:[],budgets:{},accounts:[],transactions:[],goals:[],impulse:[],recurring:[],assets:[],
  liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[],
  lev:{amt:25000,apr:3.9,ret:15,years:5,pay:300,cash:600}});
await pg.reload(); await pg.waitForTimeout(900);

const g = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); deckShow('debt','Borrowing to build'); renderLeverage(); await w(460);
  const o={};
  /* the four-sentence explanation, available without turning anything on */
  /* a closed <details> renders nothing, so innerText reads '' - open it to read
     the copy, the same trap the sovereignty note set earlier */
  const d=document.querySelector('#levPanel .lev-101');
  o.closedByDefault=!!d && !d.open;
  if(d) d.open=true; await w(160);
  o.hasStory=!!d; o.story=d?d.innerText:'';
  if(d){ d.open=false; delete d.dataset.opened; }
  o.sw=!!document.getElementById('levPlain');
  o.sharpLabels=[...document.querySelectorAll('#levPanel [data-plain]')].map(x=>x.textContent);
  o.sharpHead=document.getElementById('levResults').innerText.split('\n')[0];
  o.hintsHidden=[...document.querySelectorAll('#levPanel [data-plainh]')].every(x=>!x.textContent);
  return o;
});
ok('the panel explains what borrowing to build even is, without switching anything on',
  g.hasStory===true && /borrow \$100/.test(g.story) && /5% a year/.test(g.story), g.story.slice(0,140));
ok('...ending on the point of the whole thing - it magnifies both directions',
  /bigger/.test(g.story) && /both directions/.test(g.story), g.story.slice(-200));
ok('...closed by default, so it is a door rather than a lecture', g.closedByDefault===true);
ok('there is a switch for plain words', g.sw===true);
ok('...and off, the sharp labels are exactly as they were',
  g.sharpLabels[0]==='Amount borrowed' && g.sharpLabels[2]==='You expect it to return %/yr',
  JSON.stringify(g.sharpLabels));
ok('...with no hints cluttering the form until asked for', g.hintsHidden===true);
/* the dollars go to everyone, because a percentage is the shape nobody feels */
ok('even in sharp mode the headline now says the dollars beside the percentage',
  /2\.68%/.test(g.sharpHead) && /\$669\.88/.test(g.sharpHead), g.sharpHead);

const p = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const cb=document.getElementById('levPlain');
  cb.checked=true; cb.dispatchEvent(new Event('change',{bubbles:true})); await w(460);
  const o={labels:[...document.querySelectorAll('#levPanel [data-plain]')].map(x=>x.textContent),
           hints:[...document.querySelectorAll('#levPanel [data-plainh]')].map(x=>x.textContent).filter(Boolean),
           txt:document.getElementById('levResults').innerText};
  o.stored=state.plainWords;
  o.storyOpen=!!document.querySelector('#levPanel .lev-101').open;
  return o;
});
ok('plain mode swaps every label for ordinary English',
  p.labels[0]==='Money you would borrow' && p.labels[1]==='What they charge you for it'
    && p.labels[2]==='What you think it will make you', JSON.stringify(p.labels));
ok('...and puts a plain hint under the ones that need one',
  p.hints.length>=4 && p.hints.some(h=>/not yours/i.test(h)) && p.hints.some(h=>/guess/i.test(h)),
  JSON.stringify(p.hints));
ok('the headline becomes dollars, with no percentage in it at all',
  /\$669\.88 a year/.test(p.txt.split('\n')[0]) && !/%/.test(p.txt.split('\n')[0]), p.txt.split('\n')[0]);
ok('...and the comparison is dollars against dollars',
  /\$3,750 a year against the \$669\.88/.test(p.txt), p.txt.slice(0,300));
ok('the metric strip loses its jargon too',
  /What it must make, a year/.test(p.txt) && /Total fee over/.test(p.txt) && !/Break-even/.test(p.txt),
  p.txt.slice(0,500));
ok('...as do the two outcome cards',
  /If your guess is right/.test(p.txt) && /If it makes nothing/.test(p.txt)
    && !/If it returns/.test(p.txt), p.txt.slice(0,400));
ok('...and the words "position" and "interest" are gone from the sub-lines',
  !/position/.test(p.txt) && !/of interest/.test(p.txt), p.txt.slice(0,500));
ok('the closing note says the one thing that matters, in plain terms',
  /promise you made/.test(p.txt) && /hope you have/.test(p.txt) && /court/.test(p.txt),
  p.txt.slice(-400));
/* The actual ask was "how would my 13 year old understand this", so the thing
   worth guarding is the vocabulary, not any one sentence. Nine letters is a
   rough line and a real one: enforceable, break-even and asymmetry all crossed
   it, and all three were in here. */
const longWords=[...new Set((p.labels.join(' ')+' '+p.hints.join(' ')+' '+p.txt)
  .match(/[A-Za-z][A-Za-z'-]{9,}/g)||[])]
  .filter(w=>!/^(automatically|subscription)$/i.test(w));
ok('plain mode keeps a plain vocabulary, with nothing over nine letters',
  longWords.length===0, longWords.join(', '));
ok('...and still refuses to say whether to do it', /will not tell you whether to do it/.test(p.txt));
ok('the choice is remembered', p.stored===true);
ok('...and turning plain words on opens the explanation for you',
  p.storyOpen===true, String(p.storyOpen));

/* both cards are still drawn - the rule that must survive any rewording */
const both = await pg.evaluate(() => {
  const t=document.getElementById('levResults').innerText;
  return {cards:document.querySelectorAll('#levResults .lev-card').length,
          down:/If it makes nothing/.test(t)};
});
ok('plain mode never prints an upside without the matching downside',
  both.cards===2 && both.down===true, JSON.stringify(both));

/* and it survives a reload */
await pg.reload(); await pg.waitForTimeout(800);
const kept = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); deckShow('debt','Borrowing to build'); renderLeverage(); await w(420);
  return {on:document.getElementById('levPlain').checked,
          label:document.querySelector('[data-plain="levAmt"]').textContent};
});
ok('...and is still on after a reload', kept.on===true && kept.label==='Money you would borrow', JSON.stringify(kept));

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
