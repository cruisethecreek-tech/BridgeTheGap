/* "Last month I invested 1300... how do I plan for something like that, is it
   counted as an expense? Adding it to my income doesn't make sense either...
   Should I have an acorns expense category and if so it feels like a negative
   thing." It felt negative because it was being called negative. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:1400}});
pg.on('pageerror',e=>errs.push(String(e)));
const M=(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;})();
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(([s,M])=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify({...s,activeMonth:M,budgets:{[M]:{rent:1400}}})),
 [{onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,hourlyWage:25,
   categories:[{id:'rent',name:'Rent'}],transactions:[{id:'t1',type:'income',amount:5000,date:M+'-02'}],
   goals:[],impulse:[],recurring:[],accounts:[{id:'a1',name:'Chequing',kind:'checking',balance:5000,updated:M+'-01'}],
   assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[],scans:[]}, M]);
await pg.reload(); await pg.waitForTimeout(950);

const words = await pg.evaluate(() => ({
  acorns:growthKindFor('Acorns'), roth:growthKindFor('Roth IRA'), k401:growthKindFor('401k'),
  vanguard:growthKindFor('Vanguard'), wealth:growthKindFor('Wealthsimple'),
  emergency:growthKindFor('Emergency fund'), savings:growthKindFor('Savings'),
  debt:growthKindFor('Extra debt payment'), snowball:growthKindFor('Debt snowball'),
  retSav:growthKindFor('Retirement savings'),
  food:growthKindFor('Groceries'), rent:growthKindFor('Rent'), coffee:growthKindFor('Coffee'),
  car:growthKindFor('Car payment'), nothing:growthKindFor('') }));
ok('the app knows the names people actually type, not just the word "investment"',
   words.acorns==='invest' && words.roth==='invest' && words.k401==='invest'
     && words.vanguard==='invest' && words.wealth==='invest', JSON.stringify(words));
ok('...saving is told apart from investing', words.emergency==='save' && words.savings==='save',
   words.emergency+'/'+words.savings);
ok('...and paying down debt from both', words.debt==='debt' && words.snowball==='debt');
ok('...with invest winning when a name reads as both', words.retSav==='invest', words.retSav);
ok('a name it cannot place is left alone, rather than tagged wrong',
   !words.food && !words.rent && !words.coffee && !words.car && !words.nothing,
   JSON.stringify([words.food,words.rent,words.coffee,words.car]));

const added = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('budget'); await w(600);
  document.getElementById('catName').value='Acorns';
  document.getElementById('addCat').click(); await w(500);
  const c=state.categories.find(x=>x.name==='Acorns');
  const row=[...document.querySelectorAll('#cats .rw-nm')].find(e=>/Acorns/.test(e.innerText));
  return { growth:c&&c.growth, tag:row?row.innerText.replace(/\s+/g,' '):'',
           toast:(document.querySelector('.toast')||{innerText:''}).innerText.replace(/\s+/g,' ') };
});
ok('typing "Acorns" files it as invested, not as a purchase', added.growth==='invest', String(added.growth));
ok('...the plan row says so on its face', /not spent/i.test(added.tag), added.tag);
ok('...and the app says it guessed, and where to change it',
   /invested, not spent/i.test(added.toast) && /not be counted as spending/i.test(added.toast)
     && /change/i.test(added.toast), added.toast.slice(0,160));

const sheet = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const c=state.categories.find(x=>x.name==='Acorns');
  const btn=[...document.querySelectorAll('#cats [data-catsheet]')].find(e=>e.dataset.catsheet===c.id);
  btn.click(); await w(650);
  const bodyEl=document.getElementById('csBody')||document.body;
  const o={ opts:[...document.querySelectorAll('[data-growthset]')].map(b=>b.dataset.growthset),
    on:[...document.querySelectorAll('[data-growthset].on')].map(b=>b.dataset.growthset),
    body:bodyEl.innerText };
  o.saysNotSpending=/never counts as spending/i.test(o.body);
  o.saysNetWorth=/net worth/i.test(o.body);
  o.balanceLine=/Put away in/i.test(o.body);
  document.querySelector('[data-growthset="save"]').click(); await w(500);
  o.afterSave=state.categories.find(x=>x.name==='Acorns').growth;
  document.querySelector('[data-growthset=""]').click(); await w(500);
  o.afterNone=state.categories.find(x=>x.name==='Acorns').growth;
  document.querySelector('[data-growthset="invest"]').click(); await w(500);
  o.afterBack=state.categories.find(x=>x.name==='Acorns').growth;
  return o;
});
ok('the sheet offers all four kinds of money, which nothing did before',
   sheet.opts.join(',')===',invest,save,debt', sheet.opts.join(','));
ok('...with the current one marked', sheet.on.join(',')==='invest', sheet.on.join(','));
ok('...and explains what the tag actually does', sheet.saysNotSpending && sheet.saysNetWorth,
   JSON.stringify([sheet.saysNotSpending,sheet.saysNetWorth]));
ok('...the balance line reads "put away", not "spent"', sheet.balanceLine===true);
ok('the kind is changeable, in both directions',
   sheet.afterSave==='save' && sheet.afterNone===undefined && sheet.afterBack==='invest',
   JSON.stringify([sheet.afterSave,sheet.afterNone,sheet.afterBack]));

const rep = await pg.evaluate(async () => {
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const cs=document.getElementById('catSheet'); if(cs) cs.classList.remove('on');
  const c=state.categories.find(x=>x.name==='Acorns');
  const M=state.activeMonth;
  budgetFor(M)[c.id]=1300; save(); renderBudget(); await w(500);
  const cb=document.querySelector('input[data-repeat="'+c.id+'"]');
  const o={hasBox:!!cb};
  if(cb){ cb.checked=true; cb.dispatchEvent(new Event('change',{bubbles:true})); await w(650);
    const r=(state.recurring||[]).find(x=>x.catId===c.id);
    o.ruleType=r&&r.type; o.ikind=r&&r.ikind;
    r.anchor=M+'-01'; r.day=1; save();
    state.transactions=state.transactions.filter(t=>t.type==='income');
    o.posted=postRecurring(M, true);
    const tx=state.transactions.find(t=>t.recId===r.id);
    o.txType=tx&&tx.type;
    o.spent=monthExpense(M); o.invested=monthInvested(M); o.used=catUsed(c.id,M);
    o.inBreakdown=(typeof bdRows==='function') ? JSON.stringify(bdRows()).includes('Acorns') : null;
    const cb2=document.querySelector('input[data-repeat="'+c.id+'"]');
    if(cb2){ cb2.checked=false; cb2.dispatchEvent(new Event('change',{bubbles:true})); await w(650); }
    o.left=(state.recurring||[]).filter(x=>x.catId===c.id).length;
  }
  return o;
});
ok('a growth category can repeat, like any other', rep.hasBox===true && rep.posted===1, JSON.stringify(rep));
ok('...and the rule it makes is an invest, not a bill',
   rep.ruleType==='invest' && rep.ikind==='holds', rep.ruleType+'/'+rep.ikind);
ok('...so the month it posts is invested, never spent',
   rep.txType==='invest' && rep.spent===0 && rep.invested===1300,
   JSON.stringify([rep.txType,rep.spent,rep.invested]));
ok('...while still using up the money the plan gave it', rep.used===1300, String(rep.used));
ok('...and it stays out of the spending breakdown', rep.inBreakdown===false, String(rep.inBreakdown));
ok('unticking a growth repeat actually stops it', rep.left===0, String(rep.left));

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
