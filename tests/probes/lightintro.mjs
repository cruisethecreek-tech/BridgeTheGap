import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(()=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(
 {onboarded:false,welcomed:false,categories:[],budgets:{},accounts:[],transactions:[],goals:[],
  impulse:[],recurring:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[]})));
await pg.reload(); await pg.waitForTimeout(1100);

const w = await pg.evaluate(async () => {
  const wt=ms=>new Promise(r=>setTimeout(r,ms));
  const el=document.getElementById('iaWelcome');
  const words=t=>t.split(/\s+/).filter(Boolean).length;
  const o={shown:el.classList.contains('on'), short:el.innerText, shortW:words(el.innerText)};
  o.mode=state.sayMode;
  /* the three things that must survive any shortening */
  o.notVerdict=/not a verdict/.test(o.short);
  o.accountability=/accountability/i.test(o.short);
  o.notReal=/I am not real/.test(o.short);
  o.privacy=/stays in this browser/.test(o.short);
  o.canGo=!!document.getElementById('iaWelGo');
  document.getElementById('iaWelMore').click(); await wt(300);
  o.long=el.innerText; o.longW=words(o.long);
  o.modeAfter=state.sayMode;
  const ap=t=>t.replace(/[\u2018\u2019]/g,"'");
  const L=ap(o.long);
  o.longHasAll=/I'm listening/.test(L)&&/I'm watching/.test(L)&&/You can do better/.test(L);
  document.getElementById('iaWelLess').click(); await wt(280);
  o.backW=words(el.innerText); o.modeBack=state.sayMode;
  return o;
});
ok('the starting line opens on the short version', w.shown===true && w.mode!=='full', w.mode);
ok('...which is well under half of what it was', w.shortW<180 && w.longW>320,
  JSON.stringify([w.shortW,w.longW]));
/* what a shortening is not allowed to drop */
ok('...still saying where you are is not a verdict', w.notVerdict===true);
ok('...still saying this is accountability, not budgeting', w.accountability===true);
ok('...still saying the tool is not a person and cannot want it for you', w.notReal===true);
ok('...and still carrying the privacy promise', w.privacy===true);
ok('...with the way in still on screen', w.canGo===true);
ok('the long version is one tap and holds everything it always did',
  w.longHasAll===true && w.longW>w.shortW*2, JSON.stringify([w.shortW,w.longW]));
ok('...and the choice is the app-wide say-mode setting, not a peek at this screen',
  w.modeAfter==='full' && w.modeBack!=='full', JSON.stringify([w.modeAfter,w.modeBack]));
ok('...reversible from the same screen', w.backW===w.shortW, JSON.stringify([w.backW,w.shortW]));

/* the chat */
const c = await pg.evaluate(() => {
  const a={name:'Pat',income:3200,situation:'ok',register:'middle',tone:'blunt',wage:20,
           hoursPerWeek:40,extraIncome:[{amount:400,hours:20}],acct:'full'};
  const words=t=>String(t).split(/\s+/).filter(Boolean).length;
  let full=0, brief=0;
  INTAKE.forEach(s=>{
    full+=words(typeof s.bot==='function'?s.bot(a):(s.bot||''));
    state.sayMode='brief'; brief+=words(iaBotText(s,a));
  });
  /* a step with no short form must fall through rather than go blank */
  const plain=INTAKE.find(s=>!s.botShort && s.bot);
  state.sayMode='brief';
  const fell=iaBotText(plain,a)===(typeof plain.bot==='function'?plain.bot(a):plain.bot);
  /* and full mode must still get every original word */
  state.sayMode='full';
  const heavy=INTAKE.find(s=>s.id==='acct');
  const fullBack=iaBotText(heavy,a)===heavy.bot(a);
  /* nothing may produce undefined or NaN on partial answers */
  const bad=[];
  [{},{income:0},{acct:'spend',income:1200},{payFreq:'hourly',payAmt:19,income:2400}].forEach(p=>{
    INTAKE.filter(s=>s.botShort).forEach(s=>{
      try{ const t=String(typeof s.botShort==='function'?s.botShort(p):s.botShort);
        if(/undefined|NaN|null/.test(t)) bad.push(s.id);
      }catch(e){ bad.push(s.id+' THREW'); } });
  });
  state.sayMode='brief';
  return {full, brief, shorts:INTAKE.filter(s=>s.botShort).length, fell, fullBack, bad:[...new Set(bad)]};
});
ok('the heaviest questions gained a short form', c.shorts>=12, String(c.shorts));
ok('...cutting the chat by a quarter without touching the light ones',
  c.brief<c.full*0.8 && c.brief>c.full*0.6, JSON.stringify([c.full,c.brief]));
ok('a question with no short form falls through to the one it has', c.fell===true);
ok('...and full mode still gets every original word', c.fullBack===true);
ok('no short form breaks on a partial answer set', c.bad.length===0, c.bad.join(', '));

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
