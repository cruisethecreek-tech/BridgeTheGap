import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
/* "So all of these did not land in investing for acorns. Should I delete the
   investing category? And if it didn't land there where did it go?"
   Nowhere visible. "Put away" sat in the same dropdown as the categories, so it
   was picked INSTEAD of one, and the entry carried no category at all. Two
   different questions - which pool, and did the money leave you - in one list
   that could only answer one of them. */
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
/* his shape exactly: Acorns is a leaf under an Investing group */
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'full',activeMonth:'2026-09',hourlyWage:70,
  categories:[{id:'inv',name:'Investing',growth:'invest'},
              {id:'ac',name:'Acorns',parentId:'inv'},
              {id:'st',name:'Stash',parentId:'inv'},
              {id:'food',name:'Food'}],
  budgets:{'2026-09':{ac:300,food:400}},
  accounts:[{id:'a1',name:'Chequing',kind:'checking',balance:5000,updated:'2026-09-01'}],
  transactions:[
    /* the twelve that went in with no category */
    ...[43.40,43.40,40.60,17.90,5.40,5.40,5.00,7.80,45.80,22.50,200,25]
      .map((a,i)=>({id:'p'+i,type:'invest',amount:a,source:'ACH Withdrawal / Acorns',date:'2026-09-04',ikind:'holds'}))]});
await pg.reload(); await pg.waitForTimeout(1500);
const R=[]; const ok=(n,v,d)=>R.push([n,!!v,d]);

/* 1. the leaf inherits its group, which is why "Acorns" alone looked ordinary */
const inh=await pg.evaluate(()=>({
  acorns:growthOf((state.categories||[]).find(c=>c.id==='ac')),
  puts:catPutsAway((state.categories||[]).find(c=>c.id==='ac')),
  food:growthOf((state.categories||[]).find(c=>c.id==='food'))}));
ok('a category under Investing counts as investing, without being told twice',
   inh.acorns==='invest' && inh.puts===true, JSON.stringify(inh));
ok('...and an ordinary category is left alone', inh.food==='', JSON.stringify(inh));

/* 2. where the money actually went, before the repair */
const before=await pg.evaluate(()=>({
  stranded:strandedPutAways('2026-09').length,
  onPlan:catUsed('ac','2026-09'),
  inNetWorth:typeof sumAssetsKind==='function'}));
ok('the entries were real, and none of them reached the Plan line',
   before.stranded===12 && before.onPlan===0, JSON.stringify(before));

/* 3. the offer to file them, where the money lives */
const offer=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('budget'); await w(600);
  const box=document.querySelector('#view-budget .stranded');
  return {shown:!!box, text:box?box.innerText.replace(/\s+/g,' ').slice(0,120):'',
    opts:[...document.querySelectorAll('#strandedCat option')].map(o=>o.textContent)};
});
ok('Plan says how many are unfiled and what they add up to',
   offer.shown && /12 put-away entries have no category/.test(offer.text) && /\$462\.20/.test(offer.text),
   offer.text);
ok('...offering only the categories money can be put away into',
   offer.opts.some(o=>/Acorns/.test(o)) && !offer.opts.some(o=>/Food/.test(o)), JSON.stringify(offer.opts));
ok('...naming the group so two "Acorns" could be told apart',
   offer.opts.some(o=>/Investing \/ Acorns/.test(o)), JSON.stringify(offer.opts));

/* 4. one tap files them all */
const after=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  document.getElementById('strandedCat').value='ac';
  document.getElementById('strandedGo').click(); await w(600);
  return {stranded:strandedPutAways('2026-09').length,
    onPlan:Math.round(catUsed('ac','2026-09')*100)/100,
    parent:Math.round(catUsed('inv','2026-09')*100)/100,
    spentNotInvested:Math.round(catSpent('ac','2026-09')*100)/100,
    gone:!document.querySelector('#view-budget .stranded')};
});
ok('one tap files every one of them', after.stranded===0, String(after.stranded));
ok('...and the money lands on the Acorns line', after.onPlan===462.20, String(after.onPlan));
ok('...rolling up into Investing, like money does', after.parent===462.20, String(after.parent));
ok('...counted as put away, never as spending', after.spentNotInvested===0, String(after.spentNotInvested));
ok('...and the offer stops once there is nothing left to file', after.gone===true);

/* 5. and from now on, picking Acorns just does the right thing */
const fresh=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const n=state.transactions.length;
  /* what the quick log does with a row categorised to Acorns */
  const cat=(state.categories||[]).find(c=>c.id==='ac');
  const isPut=catPutsAway(cat);
  state.transactions.push({id:'new1',type:isPut?'invest':'expense',amount:50,catId:'ac',
                           source:'Acorns',date:'2026-09-04',ikind:'holds'});
  save(); await w(200);
  const t=state.transactions.find(x=>x.id==='new1');
  return {type:t.type, catId:t.catId, onPlan:Math.round(catUsed('ac','2026-09')*100)/100};
});
ok('a new entry categorised to Acorns is recorded as a put-away, in Acorns',
   fresh.type==='invest' && fresh.catId==='ac', JSON.stringify(fresh));
ok('...and shows on the Plan line straight away', fresh.onPlan===512.20, String(fresh.onPlan));

/* 6. nothing is counted twice */
const dup=await pg.evaluate(()=>{
  const M='2026-09';
  const invest=txnsInMonth(M).filter(t=>t.type==='invest').reduce((s,t)=>s+t.amount,0);
  const expense=txnsInMonth(M).filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  return {invest:Math.round(invest*100)/100, expense, used:Math.round(catUsed('ac',M)*100)/100};
});
ok('nothing is double counted - it is one entry wearing one hat',
   dup.invest===512.20 && dup.expense===0, JSON.stringify(dup));

R.forEach(([n,p,d])=>{ if(!p) console.log('FAIL: '+n+(d?'  <'+d+'>':'')); });
const bad=R.filter(x=>!x[1]).length;
console.log(`${R.length-bad} of ${R.length} hold`);
console.log('page errors: '+(errs.length?errs.slice(0,2).join(' | '):'none'));
await b.close(); process.exit(bad||errs.length?1:0);
