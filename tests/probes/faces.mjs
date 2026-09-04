import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,260):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:1100}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
/* the nine off their screenshot, in their order */
const CATS=['Food','Power & Wi-Fi','Getting Around','Debt Payments','Emergency Fund',
            'Fun Money','Online shopping','Dream Fund','Trips & travel'];
await pg.evaluate(([cats])=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',hourlyWage:30,
  categories:cats.map((n,i)=>({id:'c'+i,name:n})),
  budgets:{'2026-08':Object.fromEntries(cats.map((n,i)=>['c'+i,100]))},
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:3000,updated:'2026-08-01'}],
  transactions:[],goals:[],impulse:[],recurring:[],assets:[],liabilities:[],diary:[],
  intake:{},lessons:[],debts:[],vault:[],snapshots:[]})), [CATS]);
await pg.reload(); await pg.waitForTimeout(800);

const g = await pg.evaluate(async ([cats]) => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('budget'); renderBudget(); await w(480);
  const o={};
  o.guesses=cats.map(n=>n+' '+guessCatEmoji(n,''));
  o.rendered=[...document.querySelectorAll('#cats .rw-nm')].map(el=>{
    const e=el.querySelector('.rw-e'), t=el.querySelector('.rw-t');
    return {e:e?e.textContent:'', t:t?t.textContent:''};
  });
  o.allHaveOne=o.rendered.every(r=>r.e.length>0);
  o.distinct=new Set(o.rendered.map(r=>r.e)).size;
  o.hidden=[...document.querySelectorAll('#cats .rw-e')].every(x=>x.getAttribute('aria-hidden')==='true');
  /* nothing is stored until somebody chooses */
  o.stored=state.categories.filter(c=>'emoji' in c).length;
  /* the guess follows a rename, which is the whole reason it is not stored */
  const food=state.categories.find(c=>c.name==='Food');
  o.beforeRename=catEmoji(food);
  food.name='Groceries'; save(); renderBudget(); await w(300);
  o.afterRename=catEmoji(food);
  food.name='Food'; save();
  return o;
}, [CATS]);
console.log('guesses:', g.guesses.join(' | '));
ok('every category has a face without anyone typing anything', g.allHaveOne===true,
  JSON.stringify(g.rendered));
ok('...and nine categories do not all get the same one', g.distinct>=8, String(g.distinct));
ok('...with the name still rendered beside it, not replaced',
  g.rendered.every(r=>r.t.length>0), JSON.stringify(g.rendered.map(r=>r.t)));
ok('the face is hidden from a screen reader, which gains nothing from it', g.hidden===true);
ok('nothing is written to the data until somebody actually chooses', g.stored===0, String(g.stored));
ok('the guess follows a rename, because it is derived and not frozen',
  g.beforeRename!==g.afterRename && g.afterRename==='\u{1F6D2}',
  JSON.stringify([g.beforeRename,g.afterRename]));

/* order matters: specific beats the generic word inside it */
const ord = await pg.evaluate(() => ({
  carIns:guessCatEmoji('Car insurance',''), ins:guessCatEmoji('Insurance',''),
  petFood:guessCatEmoji('Pet food',''), food:guessCatEmoji('Food',''),
  coffee:guessCatEmoji('Coffee',''), gas:guessCatEmoji('Gas station',''),
  unknown:guessCatEmoji('Zorblax',''), save:guessCatEmoji('Zorblax','save'),
  invest:guessCatEmoji('Zorblax','invest')
}));
ok('"Car insurance" beats "insurance", which beats nothing',
  ord.carIns==='\u{1F697}' && ord.ins==='\u{1F6E1}️', JSON.stringify(ord));
ok('"Pet food" beats "food"', ord.petFood==='\u{1F43E}' && ord.food==='\u{1F37D}️', JSON.stringify(ord));
ok('a name that matches nothing still gets a face', ord.unknown==='\u{1F9FE}', ord.unknown);
ok('...and money put away or invested gets one that agrees with how it is coloured',
  ord.save==='\u{1F3E6}' && ord.invest==='\u{1F4C8}', JSON.stringify(ord));

/* the override */
const ov = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  openCatSheet('c0'); await w(360);
  document.querySelector('[data-editcat="c0"]').click(); await w(320);
  o.hasField=!!document.querySelector('input[data-face="c0"]');
  o.picks=document.querySelectorAll('#catSheetBody [data-pickface]').length;
  document.querySelector('input[data-face="c0"]').value='\u{1F355}';
  document.querySelector('[data-renamesave="c0"]').click(); await w(400);
  const c=state.categories.find(x=>x.id==='c0');
  o.stored=c.emoji; o.shown=catEmoji(c);
  /* a chosen face must survive a rename - the whole point of storing it */
  c.name='Pantry'; save();
  o.afterRename=catEmoji(c);
  /* auto puts it back to guessing */
  openCatSheet('c0'); await w(300);
  document.querySelector('[data-editcat="c0"]').click(); await w(300);
  document.querySelector('[data-faceauto]').click(); await w(320);
  o.hasProp='emoji' in state.categories.find(x=>x.id==='c0');
  o.backToGuess=catEmoji(state.categories.find(x=>x.id==='c0'));
  /* none means none, and must not fall back to the guess */
  document.querySelector('[data-editcat="c0"]').click(); await w(300);
  document.querySelector('[data-facenone]').click(); await w(320);
  o.none=catEmoji(state.categories.find(x=>x.id==='c0'));
  o.noneStored=state.categories.find(x=>x.id==='c0').emoji;
  renderBudget(); await w(300);
  o.noneRendered=!document.querySelector('#cats [data-catsheet="c0"] .rw-e');
  closeCatSheet();
  return o;
});
ok('the sheet offers a face field beside the rename', ov.hasField===true);
ok('...with quick picks, so a phone keyboard is not needed', ov.picks>=12, String(ov.picks));
ok('a chosen face is stored and shown', ov.stored==='\u{1F355}' && ov.shown==='\u{1F355}', JSON.stringify(ov));
ok('...and survives a rename, which is why choosing is different from guessing',
  ov.afterRename==='\u{1F355}', ov.afterRename);
ok('"Auto" hands the choice back to the name', ov.hasProp===false && ov.backToGuess.length>0,
  JSON.stringify([ov.hasProp,ov.backToGuess]));
ok('"None" means none, and never falls back to a guess',
  ov.none==='' && ov.noneStored==='' && ov.noneRendered===true, JSON.stringify(ov));

/* the ledger names categories too, and a face on half the rows would look
   broken rather than personal */
const led = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  state.categories=[{id:'c0',name:'Food'},{id:'c1',name:'Getting Around'}];
  state.transactions=[
    {id:'t1',type:'expense',amount:20,date:'2026-08-10',catId:'c0'},
    {id:'t2',type:'expense',amount:40,date:'2026-08-11',catId:'c1',note:'Tyres'},
    {id:'t3',type:'income',amount:900,date:'2026-08-12',source:'Paycheck'}];
  save(); activateTab('tx'); renderTx(); await w(480);
  return [...document.querySelectorAll('#txList .tx')].map(el=>({
    what:(el.querySelector('.tx-what')||{}).textContent||'',
    tail:(el.querySelector('.tx-tail')||{}).textContent||'',
    faces:el.querySelectorAll('.tx-e').length}));
});
const PLATE='\u{1F37D}', BUS='\u{1F68C}';
ok('an expense with no note wears the face on the name itself',
  (led.find(r=>/Food/.test(r.what))||{what:''}).what.includes(PLATE), JSON.stringify(led));
ok('...and one with a note wears it on the category beside the note',
  (led.find(r=>/Tyres/.test(r.what))||{tail:''}).tail.includes(BUS), JSON.stringify(led));
ok('...never twice on one row, and never on income',
  led.every(r=>r.faces<=1) && (led.find(r=>/Paycheck/.test(r.what))||{}).faces===0, JSON.stringify(led));

/* geometry: the face must not cost the name its line */
await pg.evaluate(([cats])=>{ state.categories=cats.map((n,i)=>({id:'c'+i,name:n}));
  state.budgets={'2026-08':Object.fromEntries(cats.map((n,i)=>['c'+i,100]))};
  state.transactions=[]; save(); }, [CATS]);
for(const W of [320,390]){
  await pg.setViewportSize({width:W,height:1100}); await pg.waitForTimeout(320);
  const m = await pg.evaluate(async () => {
    const w=ms=>new Promise(r=>setTimeout(r,ms));
    activateTab('budget'); renderBudget(); await w(360);
    const doc=document.documentElement;
    const rows=[...document.querySelectorAll('#cats .rw-nm')].map(el=>{
      const e=el.querySelector('.rw-e'), t=el.querySelector('.rw-t');
      if(!e||!t) return null;
      const er=e.getBoundingClientRect(), tr=t.getBoundingClientRect();
      return {sameLine:Math.abs(er.top-tr.top)<er.height, tw:Math.round(tr.width), th:Math.round(tr.height)};
    }).filter(Boolean);
    return {rows, over:doc.scrollWidth>doc.clientWidth};
  });
  ok('at '+W+'px the face never wraps off its own name',
    m.rows.length>0 && m.rows.every(r=>r.sameLine), JSON.stringify(m.rows.slice(0,3)));
  ok('...and the name keeps real width beside it',
    m.rows.every(r=>r.tw>=90) && m.over===false, JSON.stringify(m.rows.map(r=>r.tw)));
}

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
