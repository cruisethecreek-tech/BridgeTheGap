import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,260):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',s), JSON.stringify({
  onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',
  categories:[{id:'c1',name:'Food'}],budgets:{'2026-08':{c1:400}},
  accounts:[{id:'a1',name:'Joint Checking',kind:'checking',balance:2000,updated:'2026-08-01',
             hist:[{d:'2026-07-01',b:1500,how:'first'},{d:'2026-08-01',b:2000,how:'bank'}]},
            {id:'a2',name:'Stash',kind:'invest',balance:18000,updated:'2026-08-01'},
            {id:'a3',name:'Coinbase',kind:'other',balance:14782.70,updated:'2026-08-01'},
            {id:'a4',name:'Everyday Checking',kind:'checking',balance:640,updated:'2026-08-01'}],
  transactions:[{id:'t1',type:'expense',amount:50,date:'2026-08-05',catId:'c1',acctId:'a3'}],
  debts:[{id:'d1',name:'Visa',balance:2400,apr:23.9,minPayment:75},
         {id:'d2',name:'Car loan',balance:9000,apr:6.4,minPayment:220}],
  debtBudget:500,goals:[],impulse:[],recurring:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],vault:[],snapshots:[]}));
await pg.reload(); await pg.waitForTimeout(800);

/* ---- editor ---- */
const ed=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('goals'); deckShow('goals','Accounts'); renderAccounts(); await w(400);
  const o={};
  o.hasPencil=!!document.querySelector('[data-acctedit="a3"]');
  document.querySelector('[data-acctedit="a3"]').click(); await w(300);
  o.opened=!!document.getElementById('aeName');
  o.name=document.getElementById('aeName').value;
  o.creditFieldsHidden=document.getElementById('aeLimWrap').classList.contains('hide');
  /* switch it to a credit card and the credit fields appear without saving */
  document.getElementById('aeKind').value='credit';
  document.getElementById('aeKind').dispatchEvent(new Event('change',{bubbles:true})); await w(200);
  o.creditFieldsShow=!document.getElementById('aeLimWrap').classList.contains('hide');
  o.purposeHidden=document.getElementById('aePurpWrap').classList.contains('hide');
  document.getElementById('aeName').value='Rewards Card';
  document.getElementById('aeLim').value='13700';
  document.getElementById('aeApr').value='13';
  const nwBefore=netWorth();
  document.querySelector('[data-acctsave="a3"]').click(); await w(400);
  const a=state.accounts.find(x=>x.id==='a3');
  o.renamed=a.name; o.kind=a.kind; o.limit=a.limit; o.apr=a.apr;
  o.balanceFlipped=a.balance;                       // 14782.70 becomes owed
  o.nwMoved=Math.round((netWorth()-nwBefore)*100)/100;
  o.txKept=state.transactions.filter(t=>t.acctId==='a3').length;
  return o;
});
ok('every account row offers an editor', ed.hasPencil===true && ed.opened===true);
ok('...prefilled with what it is called now', ed.name==='Coinbase', ed.name);
ok('...showing card fields only once you pick a card', ed.creditFieldsHidden===true && ed.creditFieldsShow===true);
ok('...and dropping the earmark question, which owed money cannot answer', ed.purposeHidden===true);
ok('a rename sticks', ed.renamed==='Rewards Card', ed.renamed);
ok('...and so does the new kind, with its limit and rate',
  ed.kind==='credit' && ed.limit===13700 && ed.apr===13, JSON.stringify(ed));
ok('turning an account into a card turns the balance over with it',
  ed.balanceFlipped===-14782.7, String(ed.balanceFlipped));
ok('...so net worth moves by twice the balance, which is what changing sides means',
  Math.abs(ed.nwMoved-(-29565.4))<0.02, String(ed.nwMoved));
ok('...and nothing logged against it moved', ed.txKept===1, String(ed.txKept));

/* the history survives a rename */
const hist=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  document.querySelector('[data-acctedit="a1"]').click(); await w(280);
  document.getElementById('aeName').value='Main Checking';
  document.querySelector('[data-acctsave="a1"]').click(); await w(350);
  const a=state.accounts.find(x=>x.id==='a1');
  return {name:a.name, readings:(a.hist||[]).length};
});
ok('a rename never costs you the reading history', hist.name==='Main Checking' && hist.readings===2, JSON.stringify(hist));

/* ---- reorder ---- */
const ro=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const o={};
  o.hasBtn=!!document.getElementById('acctReorderBtn');
  const before=[...document.querySelectorAll('#acctList [data-row]')].map(x=>x.dataset.row);
  const bankBefore=bankTotal();
  document.getElementById('acctReorderBtn').click(); await w(350);
  o.grips=document.querySelectorAll('#acctList [data-grip][data-scope="accts"]').length;
  moveAcct('a4',-1); renderAccounts(); await w(300);
  o.after=[...document.querySelectorAll('#acctList [data-row]')].map(x=>x.dataset.row);
  o.before=before;
  o.bankUnchanged=bankTotal()===bankBefore;
  document.getElementById('acctReorderBtn').click(); await w(250);
  o.gripsGone=document.querySelectorAll('#acctList [data-grip]').length===0;
  o.orderKept=[...document.querySelectorAll('#acctList [data-row]')].map(x=>x.dataset.row);
  return o;
});
ok('the accounts list has a reorder mode', ro.hasBtn===true && ro.grips===4, JSON.stringify({b:ro.hasBtn,g:ro.grips}));
ok('...moving one actually moves it', JSON.stringify(ro.after)!==JSON.stringify(ro.before), JSON.stringify(ro));
ok('...and no total on the page changes, because only the display is ordered', ro.bankUnchanged===true);
ok('leaving the mode puts the grips away and keeps the order',
  ro.gripsGone===true && JSON.stringify(ro.orderKept)===JSON.stringify(ro.after), JSON.stringify(ro.orderKept));
await pg.reload(); await pg.waitForTimeout(900);
const persisted=await pg.evaluate(async()=>{ const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('goals'); deckShow('goals','Accounts'); await w(400);
  return [...document.querySelectorAll('#acctList [data-row]')].map(x=>x.dataset.row); });
ok('...and reads the same after a reload', JSON.stringify(persisted)===JSON.stringify(ro.after), JSON.stringify(persisted));

/* ---- debt delete ---- */
const dd=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('debt'); await w(500);
  const o={}; const n0=state.debts.length;
  o.startsAsButton=!!document.querySelector('[data-deldebt="d1"]') && !document.querySelector('.debtrow.confirming');
  document.querySelector('[data-deldebt="d1"]').click(); await w(300);
  o.armedNotFired=state.debts.length===n0 && !!document.querySelector('.debtrow.confirming');
  o.question=document.querySelector('.debtrow.confirming').innerText;
  document.querySelector('[data-deldebtno]').click(); await w(250);
  o.keptIt=state.debts.length===n0 && !document.querySelector('.debtrow.confirming');
  document.querySelector('[data-deldebt="d1"]').click(); await w(250);
  document.querySelector('[data-deldebtyes="d1"]').click(); await w(350);
  o.gone=!state.debts.some(x=>x.id==='d1');
  o.otherKept=state.debts.some(x=>x.id==='d2');
  return o;
});
ok('the debt delete starts as a button, not a question', dd.startsAsButton===true);
ok('...and one tap arms it rather than removing anything', dd.armedNotFired===true);
ok('...with the question naming the balance and the rate',
  /\$2,400/.test(dd.question) && /23\.9%/.test(dd.question), dd.question);
ok('...and saying plainly that removing it pays nothing off',
  /does not pay anything off/.test(dd.question), dd.question);
ok('"Keep it" changes nothing', dd.keptIt===true);
ok('confirming removes that one and only that one', dd.gone===true && dd.otherKept===true);

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
