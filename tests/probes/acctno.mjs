/* "The app should be able to identify these accounts for auto populating - this
   bank account is associated with this transfer because the account number in
   the description matched. In the build tab you should be able to attach an
   account number."

   A statement names itself in its header - "Benefits Plus (195794-*0050)" - and
   names the other end of every internal move in the line itself - "Transfer to
   Loan 0002". Both are already in text the reader hands over. Tell the app once
   which digits are yours and it stops asking.

   Every check that matters here is about a LOOSE match, because the lines these
   run against are made of long digit runs:

     ACH Deposit / Cc hosting 4270465600 Cc hosting 111000021024413

   "0002" is literally inside 111000021024413. That string is the routing number
   on an unrelated deposit, and a substring match would file somebody's paycheck
   as a transfer to their loan - taking it out of income, out of Left to budget,
   and out of every figure downstream. So the digits must sit in the text as
   their own run with a non-digit on each side.

   The lines below are transcribed from the owner's own screenshots. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);

const SEED=(x={})=>({onboarded:true,mindOff:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',
  activeMonth:'2026-09',categories:[{id:'c1',name:'Roof'}],budgets:{},transactions:[],
  accounts:[{id:'bp',name:'Benefits Plus',kind:'checking',balance:929.55,updated:'2026-09-11',acctNo:'195794-0050'},
            {id:'l2',name:'Loan 0002',kind:'credit',balance:-1200,updated:'2026-09-11',acctNo:'195794-0002'},
            {id:'l3',name:'Loan 0003',kind:'credit',balance:-800,updated:'2026-09-11',acctNo:'195794-0003'},
            {id:'nn',name:'Unnumbered',kind:'savings',balance:50,updated:'2026-09-11'}],
  assets:[],liabilities:[],goals:[],recurring:[],impulse:[],debts:[],diary:[],intake:{},lessons:[],vault:[],...x});
const load=async st=>{ await p.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),st);
  await p.reload(); await p.waitForTimeout(1600); };

const HEADER='Account History  Benefits Plus (195794-*0050)  Available Balance $929.55  Balance $1,000.00';
const MOVES=[
 'Home banking Withdrawal / Transfer to Loan 0003: NetWorth24 09/11/2026 08:49 322473:',
 'Home banking Withdrawal / Transfer to Loan 0002: NetWorth24 09/09/2026 09:56 292690:',
 'Home banking Deposit / Transfer from Loan 0002: NetWorth24 09/04/2026 09:30 241334:'];
const NOT_MOVES=[
 'ACH Deposit / Cc hosting 1800948598 Cc hosting 091000011346314',
 'ACH Deposit / Cc hosting 4270465600 Cc hosting 111000021024413',
 'ACH Withdrawal / ATT 9864031004 PAYMENT 090426 031100201430678',
 'ACH Deposit / Cc hosting 1800948598 Cc hosting 091000011048654'];

await load(SEED());
const m=await p.evaluate(([HEADER,MOVES,NOT_MOVES])=>{
  const nm=a=>a?a.name:null;
  return {
    header:nm(acctByNumberIn(HEADER)),
    moves:MOVES.map(l=>nm(acctByNumberIn(l,'bp','bp'))),
    notMoves:NOT_MOVES.map(l=>nm(acctByNumberIn(l,'bp','bp'))),
    /* the trap, stated rather than assumed */
    substringIsReal:'111000021024413'.indexOf('0002')>=0,
    boundedRejectsIt:!acctNoRx('0002').test('Cc hosting 111000021024413'),
    twoDigitsRefused:acctNoRx('50')===null && acctNoRx('7')===null,
    threeAccepted:!!acctNoRx('050'),
    /* decoration differs between the header and the line, so only digits are kept */
    digitsOnly:acctRuns('195794-*0050').join('-')==='195794-0050' && acctRuns('xxxx-0050').join('-')==='0050',
    unnumberedNeverMatches:nm(acctByNumberIn('Unnumbered savings 12345'))===null
      || nm(acctByNumberIn('Unnumbered savings 12345'))!=='Unnumbered',
    /* the account a line came OUT of is not somewhere it moved TO */
    selfExcluded:nm(acctByNumberIn('Transfer within 195794-0050 account','bp','bp'))===null,
    withNumbers:acctsWithNumbers().length
  };
},[HEADER,MOVES,NOT_MOVES]);

/* ============================================================
   THE OWNER'S REAL ACCOUNT LIST

   Asked, after the first version shipped: "Are these last 4 enough?" They are
   not, and the screenshot that came with the question is the proof. Three of
   these end 0050 and two end 0000, because a credit union numbers an account as
   a member number and then a suffix. Matching the suffix alone did not fail
   safe - it filed a statement from 153934-*0050 against Benefits Plus with
   complete confidence, which is the worst available outcome. */
const REAL=[
  ['bp','Benefits Plus',        '195794-0050'],
  ['sv','Savings',              '195794-0000'],
  ['he','Home Equity Loc',      '195794-0003'],
  ['fk','Free Checking Kristi', '153934-0050'],
  ['fd','Free Checking Donovan','436067-0050'],
  ['bz','Business Free Checking','481557-1000'],
  ['ls','LLC Savings',          '481557-0000']];
await load(SEED({accounts:REAL.map(([id,name,no])=>
  ({id,name,kind:'checking',balance:100,updated:'2026-09-11',acctNo:no}))}));
const real=await p.evaluate(REAL=>{
  const nm=a=>a?a.name:null;
  const hdr=(name,no)=>nm(acctByNumberIn(`${name} ${no.split('-')[0]}-*${no.split('-')[1]}`));
  return {
    /* every one of the seven headers finds its own account and no other */
    headers:REAL.map(([id,name,no])=>[name, hdr(name,no)]),
    allRight:REAL.every(([id,name,no])=>hdr(name,no)===name),
    /* a line inside a 195794 statement naming a bare suffix means that member's */
    suffixScoped:nm(acctByNumberIn('Transfer to Loan 0003: NetWorth24',null,'bp')),
    /* and the same bare suffix from a different member's statement is not
       silently handed the first account that happens to end the same way */
    suffixOther:nm(acctByNumberIn('Transfer to Loan 0000: NetWorth24',null,'bz')),
    noClashes:!acctAnyClash()
  };
},REAL);
/* the same list stored the way the first version advised */
await load(SEED({accounts:REAL.map(([id,name,no])=>
  ({id,name,kind:'checking',balance:100,updated:'2026-09-11',acctNo:no.split('-')[1]}))}));
const lastFour=await p.evaluate(()=>{
  const nm=a=>a?a.name:null;
  return { kristi:nm(acctByNumberIn('Free Checking 153934-*0050')),
           llc:nm(acctByNumberIn('LLC Savings 481557-*0000')),
           /* 0003 and 1000 appear once, so those still work */
           equity:nm(acctByNumberIn('Home Equity Loc 195794-*0003')),
           flagged:(state.accounts||[]).filter(a=>acctNoClash(a).length).map(a=>a.name).length,
           anyClash:acctAnyClash(),
           toldOnScreen:/is also on/.test((document.getElementById('acctList')||{innerText:''}).innerText) };
});
await load(SEED());

/* longest stored number wins, tested on text where both really appear */
const longest=await p.evaluate(()=>{
  state.accounts.push({id:'full',name:'Full number',kind:'savings',balance:1,acctNo:'80050'});
  const t='Transfer from 80050 to somewhere';
  const a=acctByNumberIn(t);
  state.accounts.pop();
  return a?a.name:null;
});

/* end to end on the real screen: seed a read and watch what the rows become */
const ui=await p.evaluate(async([HEADER,MOVES,NOT_MOVES])=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(600);
  quickLogOpen=true;
  qlSeed=MOVES.map((l,i)=>({what:l,amt:100+i,kind:'expense'}))
    .concat(NOT_MOVES.map((l,i)=>({what:l,amt:200+i,kind:'income'})));
  qlSeedNote='x';
  qlSeedText=HEADER+'\n'+MOVES.concat(NOT_MOVES).join('\n');
  renderQuickLog(); await w(700);
  const rows=[...document.querySelectorAll('.ql-row')].filter(r=>r.querySelector('.ql-what').value);
  const sel=document.getElementById('qlAcct');
  const note=(document.querySelector('.ql-acct-n')||{innerText:''}).innerText;
  return {
    /* the statement answered the question it used to ask */
    acctPicked: sel?sel.value:null,
    noteNamesIt: /Benefits Plus/.test(note) && /0050/.test(note),
    noteExplains: /photographed/.test(note),
    rows: rows.map(r=>({ what:r.querySelector('.ql-what').value.slice(0,44),
                         cat:r.querySelector('.ql-cat').value,
                         guessed:r.querySelector('.ql-cat').classList.contains('guessed') })),
    /* the option only exists for accounts that can be matched at all */
    moveOptions:[...document.querySelector('.ql-cat').options].filter(o=>o.value.indexOf('__move:')===0).length
  };
},[HEADER,MOVES,NOT_MOVES]);

/* and what logging them actually records */
const logged=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  document.getElementById('qlSave').click(); await w(700);
  const t=state.transactions;
  return { n:t.length,
    transfers:t.filter(x=>x.type==='transfer').map(x=>({to:x.destAcctId, from:x.acctId, amt:x.amount})),
    income:t.filter(x=>x.type==='income').length,
    expense:t.filter(x=>x.type==='expense').length,
    /* the whole point: a move between two of your own accounts is not spending */
    spentThisMonth:monthExpense('2026-09') };
});

/* nobody who has not filled the field in is affected by any of it */
await load(SEED({accounts:[{id:'a1',name:'Checking',kind:'checking',balance:500,updated:'2026-09-11'}]}));
const off=await p.evaluate(async([HEADER,MOVES])=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(600);
  quickLogOpen=true;
  qlSeed=MOVES.map((l,i)=>({what:l,amt:100+i,kind:'expense'}));
  qlSeedNote='x'; qlSeedText=HEADER;
  renderQuickLog(); await w(700);
  const opts=[...document.querySelector('.ql-cat').options];
  const note=(document.querySelector('.ql-acct-n')||{innerText:''}).innerText;
  return { noMoveOptions:opts.filter(o=>o.value.indexOf('__move:')===0).length===0,
           nothingGuessedAsMove:[...document.querySelectorAll('.ql-cat')].every(c=>c.value.indexOf('__move:')!==0),
           stillAsks:/Which account|will go against/.test(note),
           offersTheIdea:/last four/i.test(note) || /Build/.test(note) };
},[HEADER,MOVES]);

/* the field exists where the owner asked for it, and keeps only digits */
await load(SEED());
const build=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('goals'); await w(700);
  const addField=!!document.getElementById('acctNo');
  const shownOnRow=/0050/.test((document.querySelector('.acct-row .ac-k')||{innerText:''}).innerText)
    || [...document.querySelectorAll('.acct-row .ac-k')].some(e=>/no\. 0050/.test(e.innerText));
  document.querySelector('[data-acctedit="bp"]').click(); await w(400);
  const f=document.getElementById('aeNo');
  const prefilled=f?f.value:null;
  /* a person types what the bank printed, decoration and all */
  if(f) f.value='xxxx-*9911';
  document.querySelector('[data-acctsave="bp"]').click(); await w(500);
  const a=state.accounts.find(x=>x.id==='bp');
  /* and something too short is refused rather than stored to match everything */
  const a2=state.accounts.find(x=>x.id==='l2');
  document.querySelector('[data-acctedit="l2"]').click(); await w(400);
  const f2=document.getElementById('aeNo'); if(f2) f2.value='7';
  document.querySelector('[data-acctsave="l2"]').click(); await w(500);
  return { addField, shownOnRow, prefilled, stored:a.acctNo,
           shortRefused:!state.accounts.find(x=>x.id==='l2').acctNo };
});

await b.close();

const T=[
  ['the statement header says which account it is, and the app reads it',
   m.header==='Benefits Plus', String(m.header)],
  ['a line naming another of your accounts is recognised as a move to it',
   m.moves.join(',')==='Loan 0003,Loan 0002,Loan 0002', JSON.stringify(m.moves)],
  ['"0002" really does sit inside a routing number on an unrelated deposit',
   m.substringIsReal===true, String(m.substringIsReal)],
  ['...and a bounded match refuses it, so a paycheck is never filed as a transfer',
   m.boundedRejectsIt===true && m.notMoves.every(x=>x===null), JSON.stringify(m.notMoves)],
  ['two digits are refused outright, three are the shortest that count',
   m.twoDigitsRefused===true && m.threeAccepted===true, JSON.stringify(m)],
  ['only the digits are kept, because the decoration differs between header and line',
   m.digitsOnly===true, String(m.digitsOnly)],
  ['an account with no number stored matches nothing',
   m.unnumberedNeverMatches===true && m.withNumbers===3, JSON.stringify({u:m.unnumberedNeverMatches,w:m.withNumbers})],
  ['...and an account is never a move to itself', m.selfExcluded===true, String(m.selfExcluded)],
  ['the longest stored number wins when more than one is really in the text',
   longest==='Full number', String(longest)],

  ['all seven of the owner\'s real accounts resolve to themselves and no other',
   real.allRight===true, JSON.stringify(real.headers)],
  ['...including the three that end 0050 and the two that end 0000',
   real.noClashes===true, String(real.noClashes)],
  ['a bare suffix in a line means the member number of the statement it is in',
   real.suffixScoped==='Home Equity Loc', String(real.suffixScoped)],
  ['...and the same suffix read from another member\'s statement finds that member\'s',
   real.suffixOther==='LLC Savings', String(real.suffixOther)],
  ['stored as only the last four, the colliding ones refuse to answer rather than answer wrongly',
   lastFour.kristi===null && lastFour.llc===null, JSON.stringify(lastFour)],
  ['...the ones whose last four happens to be unique still work',
   lastFour.equity==='Home Equity Loc', String(lastFour.equity)],
  ['...and Build says which accounts cannot be told apart, where it can still be fixed',
   lastFour.anyClash===true && lastFour.flagged===5 && lastFour.toldOnScreen===true,
   JSON.stringify(lastFour)],

  ['a scan no longer asks which account it came from - it says',
   ui.acctPicked==='bp' && ui.noteNamesIt===true, JSON.stringify({a:ui.acctPicked,n:ui.noteNamesIt})],
  ['...and says what told it, rather than asking to be trusted',
   ui.noteExplains===true, String(ui.noteExplains)],
  ['the three moves are pre-marked as moves, and marked as guesses',
   ui.rows.filter(r=>r.cat.indexOf('__move:')===0).length===3
     && ui.rows.filter(r=>r.cat.indexOf('__move:')===0).every(r=>r.guessed),
   JSON.stringify(ui.rows.map(r=>[r.cat,r.guessed]))],
  ['...and the four deposits are left alone',
   ui.rows.filter(r=>r.cat.indexOf('__move:')===0).length===3 && ui.rows.length===7,
   JSON.stringify(ui.rows.length)],
  ['the move option exists once per account that can be matched',
   ui.moveOptions===3, String(ui.moveOptions)],
  ['logging them records transfers, not purchases',
   logged.transfers.length===3 && logged.expense===0, JSON.stringify(logged)],
  ['...out of the statement\'s account and into the one named in the line',
   logged.transfers.every(t=>t.from==='bp') && logged.transfers.map(t=>t.to).join(',')==='l3,l2,l2',
   JSON.stringify(logged.transfers)],
  ['...so none of it counts as money spent', logged.spentThisMonth===0, String(logged.spentThisMonth)],

  ['somebody who never fills the field in is not offered a move at all',
   off.noMoveOptions===true && off.nothingGuessedAsMove===true, JSON.stringify(off)],
  ['...is still asked which account, exactly as before',
   off.stillAsks===true, String(off.stillAsks)],
  ['...and is told the field exists, once, where it would have helped',
   off.offersTheIdea===true, String(off.offersTheIdea)],

  ['the field is on Build, on the add form and in the editor',
   build.addField===true && build.prefilled==='195794-0050', JSON.stringify(build)],
  ['...shown on the row without opening anything', build.shownOnRow===true, String(build.shownOnRow)],
  ['...keeps the digit runs of whatever was typed, and nothing else',
   build.stored==='9911', String(build.stored)],
  ['...and refuses something too short to mean anything', build.shortRefused===true, String(build.shortRefused)],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
console.log('page errors:', errs.length?[...new Set(errs)].join(' | '):'none');
process.exit(bad?1:0);
