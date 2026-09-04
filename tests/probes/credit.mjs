import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const URL='file://'+process.cwd()+'/app.html';
let pass=0, fail=0, errs=[];
const clearOverlays=async()=>{ await pg.evaluate(()=>{ document.querySelectorAll('.stagecelebrate,.overlay.on').forEach(x=>x.remove()); }); await pg.waitForTimeout(80); };
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+d:''));} };

const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:844}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto(URL);
await pg.evaluate(()=>{ localStorage.clear(); });
await pg.goto(URL);
await pg.evaluate(()=>{
  state=load();
  state.onboarded=true; state.intake={done:true};
  state.categories=[{id:'c1',name:'Food',parent:null}];
  state.accounts=[{id:'a1',name:'Checking',kind:'checking',balance:2000,updated:'2026-01-01'}];
  state.transactions=[]; state.assets=[]; state.liabilities=[];
  state.activeMonth='2026-08';
  save(); location.reload();
});
await pg.waitForTimeout(700);

// ---- add a credit card through the real form ----
await pg.evaluate(()=>{ activateTab('goals'); deckShow('goals','Accounts'); });
await pg.waitForTimeout(250);
await pg.selectOption('#acctKind','credit');
await pg.waitForTimeout(150);
ok('the limit box only shows up for a card',
  await pg.evaluate(()=>!document.getElementById('acctLimWrap').classList.contains('hide')));
ok('an earmark box is taken away, because owed money has no job',
  await pg.evaluate(()=>document.getElementById('acctPurpose').classList.contains('hide')));
const note=await pg.evaluate(()=>document.getElementById('acctKindNote').innerText);
ok('and it says put in what is on it, not the limit', /on it right now, not the limit/i.test(note), note.slice(0,90));
ok('...and answers the balance-or-repayment question right there', /not spending/i.test(note));

await pg.fill('#acctName','Rewards Card');
await pg.fill('#acctBal','412');
await pg.fill('#acctLim','13700');
await pg.fill('#acctApr','13');
await pg.click('#addAcct');
await pg.waitForTimeout(250);

const acct=await pg.evaluate(()=>state.accounts.find(a=>a.kind==='credit'));
ok('typed as owed, stored as negative', acct.balance===-412, JSON.stringify(acct));
ok('the limit came with it', acct.limit===13700 && acct.apr===13);

const rowTxt=await pg.evaluate(()=>[...document.querySelectorAll('.acct-row')].map(r=>r.innerText).join('\n'));
ok('the row shows the room left, not the debt alone', /13,288|13,288.00/.test(rowTxt.replace(/\s/g,'')) || /room left/i.test(rowTxt), rowTxt.slice(0,160));
ok('and how much of the line is used', /3%|3\.0%/.test(rowTxt), rowTxt.slice(0,200));
ok('the input shows 412, never a minus sign',
  await pg.evaluate(()=>+document.querySelector('.acct-row.owed input[data-acctbal]').value)===412);

// ---- net worth ----
const nw=await pg.evaluate(()=>netWorth());
ok('net worth is 2000 minus what is on the card', Math.abs(nw-1588)<0.01, String(nw));
ok('"In the bank" is not quietly netted against the card',
  await pg.evaluate(()=>assetAcctTotal())===2000);
ok('what is owed has its own figure', await pg.evaluate(()=>owedTotal())===412);
ok('and the two still reconcile to the signed total',
  await pg.evaluate(()=>Math.abs((assetAcctTotal()-owedTotal())-bankTotal())<0.005));
ok('a card is not spendable cash', await pg.evaluate(()=>liquidTotal())===2000);

const sum=await pg.evaluate(()=>document.getElementById('acctSummary').innerText);
ok('the summary answers the question the user actually asked', /it is both/i.test(sum), sum.slice(0,200));
ok('and names the room as borrowing power, not money', /borrowing power, not money/i.test(sum));

// The date rule is deliberate app-wide: anything dated ON the day you set a
// balance is assumed to be in the figure you copied. Backdate the card's
// balance so the logged-since arithmetic below is actually exercised rather
// than being silently skipped and passing for the wrong reason.
await pg.evaluate(()=>{ state.accounts.find(a=>a.kind==='credit').updated='2026-01-01'; save(); });

// ---- buy groceries on the card ----
await pg.evaluate(()=>{ activateTab('tx'); });
await pg.waitForTimeout(250);
await pg.fill('#txAmt','300');
await pg.selectOption('#txCat', await pg.evaluate(()=>state.categories[0].id));
await pg.selectOption('#txAcct', await pg.evaluate(()=>state.accounts.find(a=>a.kind==='credit').id));
await pg.click('#addTx');
await pg.waitForTimeout(300);
await clearOverlays();
ok('the groceries count as spending', await pg.evaluate(()=>monthExpense(state.activeMonth))===300);
ok('and the card expects 712 on it now',
  await pg.evaluate(()=>{const a=state.accounts.find(x=>x.kind==='credit'); return Math.round(-acctExpected(a));})===712);

// ---- pay the card ----
await pg.click('#typeToggle button[data-t="transfer"]');
await pg.waitForTimeout(200);
ok('the move form asks for both ends',
  await pg.evaluate(()=>!document.getElementById('fldAcct').classList.contains('hide')
    && !document.getElementById('fldXfer').classList.contains('hide')));
ok('and the "which account" label becomes "comes out of"',
  await pg.evaluate(()=>document.getElementById('fldAcctLbl').textContent)==='Comes out of');
ok('no category is asked for on a move',
  await pg.evaluate(()=>document.getElementById('fldCat').classList.contains('hide')));
const xn=await pg.evaluate(()=>document.getElementById('xferNote').innerText);
ok('and it says out loud that moving is not spending', /not spending/i.test(xn), xn.slice(0,120));
ok('...and that the destination card was already charged when you bought', /already logged|was the spending/i.test(xn), xn.slice(0,220));

await pg.fill('#txAmt','300');
await pg.selectOption('#txAcct','a1');
await pg.selectOption('#txXferTo', await pg.evaluate(()=>state.accounts.find(a=>a.kind==='credit').id));
await pg.click('#addTx');
await pg.waitForTimeout(300);

ok('paying the card is not a second grocery bill',
  await pg.evaluate(()=>monthExpense(state.activeMonth))===300);
ok('the ledger total treats the move as worth nothing',
  await pg.evaluate(()=>Math.abs(allTimeBalance()-(-300))<0.005), await pg.evaluate(()=>String(allTimeBalance())));
ok('checking expects 300 less',
  await pg.evaluate(()=>Math.round(acctExpected(state.accounts.find(x=>x.id==='a1'))))===1700);
ok('the card is back where it started',
  await pg.evaluate(()=>{const a=state.accounts.find(x=>x.kind==='credit'); return Math.round(-acctExpected(a));})===412);

// ---- the row and the sheet ----
const list=await pg.evaluate(()=>document.getElementById('txList').innerText);
ok('the ledger row names both ends', /Checking\s*→\s*Rewards Card/.test(list), list.slice(0,140));
const xrow=await pg.evaluate(()=>document.querySelector('.tx.transfer .tx-amt').textContent);
ok('a move never wears a minus sign', !/[−-]/.test(xrow) && /⇄/.test(xrow), xrow);
await pg.setViewportSize({width:900,height:900});
await pg.waitForTimeout(200);
const wide=await pg.evaluate(()=>document.getElementById('txList').innerText);
ok('with room for it, the row says moved, not spent', /moved, not spent/.test(wide), wide.slice(0,140));
await pg.setViewportSize({width:390,height:844});
await pg.waitForTimeout(200);

await pg.evaluate(()=>{ const t=state.transactions.find(x=>x.type==='transfer'); openTxSheet(t.id); });
await pg.waitForTimeout(250);
const sheet=await pg.evaluate(()=>document.getElementById('txSheetBody').innerText+' '+document.getElementById('txSheetTitle').innerText);
ok('the sheet calls it money moved', /Money moved/i.test(sheet));
ok('and states it counts as spending nowhere', /nowhere/i.test(sheet), sheet.slice(0,200));
ok('the sheet offers both ends as accounts',
  await pg.evaluate(()=>document.querySelectorAll('#txSheetBody select[data-txedit="acctId"],#txSheetBody select[data-txedit="destAcctId"]').length)===2);

// an edit that would collapse the move is refused
await pg.evaluate(()=>{ const t=state.transactions.find(x=>x.type==='transfer'); editTx(t.id,{destAcctId:t.acctId}); });
await pg.waitForTimeout(200);
ok('a move cannot be edited into having one end',
  await pg.evaluate(()=>{const t=state.transactions.find(x=>x.type==='transfer'); return t.acctId!==t.destAcctId;}));

// ---- double count guard ----
await pg.evaluate(()=>{ closeTxSheet(); state.liabilities.push({id:'l1',name:'Rewards card',value:412}); save(); activateTab('goals'); deckShow('goals','Accounts'); renderAccounts(); });
await pg.waitForTimeout(250);
const sum2=await pg.evaluate(()=>document.getElementById('acctSummary').innerText);
ok('typing the card in twice is caught and named', /subtracting that money twice/i.test(sum2), sum2.slice(-220));

// ---- transfers are filterable ----
await pg.evaluate(()=>{ activateTab('tx'); document.querySelector('.pill[data-f="transfer"]').click(); });
await pg.waitForTimeout(250);
ok('you can look at just the moves',
  await pg.evaluate(()=>document.querySelectorAll('#txList .tx').length)===1);

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
