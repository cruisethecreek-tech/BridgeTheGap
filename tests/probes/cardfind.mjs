import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const URL='file://'+process.cwd()+'/app.html';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,220):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto(URL);
const seed=st=>pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),st);
const BASE={onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',
  categories:[{id:'c',name:'Food'}],budgets:{'2026-08':{c:400}},
  transactions:[{id:'i',type:'income',amount:3000,date:'2026-08-01'}],
  goals:[],impulse:[],recurring:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[]};

/* the user's actual situation: seven asset accounts, no card anywhere */
await seed({...BASE, accounts:[
  {id:'a1',name:'Joint Checking',kind:'checking',balance:3000,updated:'2026-08-01'},
  {id:'a2',name:'Overflow income',kind:'checking',balance:1000,updated:'2026-08-01'},
  {id:'a3',name:'Stash',kind:'invest',balance:18000,updated:'2026-08-01'}]});
await pg.reload(); await pg.waitForTimeout(600);

const acct=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('goals'); deckShow('goals','Accounts'); await w(300);
  const d=[...document.querySelectorAll('#view-goals details')].find(x=>/Accounts/.test(x.textContent.slice(0,40)));
  if(d) d.open=true; await w(150);
  return {head:d?d.querySelector('.acc-sub').textContent:'', body:d?d.textContent:''};
});
ok('the panel no longer says it is only about the bank',
  !/actually in the bank/i.test(acct.head), acct.head);
ok('...and names what you owe as belonging there too',
  /what you owe/i.test(acct.head), acct.head);
ok('the intro tells you cards go here', /cards and lines of credit belong here/i.test(acct.body), acct.body.slice(0,200));
ok('...naming the exact kind to pick', /Credit card \/ line of credit/.test(acct.body));
ok('...and saying $0 is a real answer on a line kept at zero',
  /\$0 is a real answer/.test(acct.body));
ok('...and why it matters: net worth, room, and the rate',
  /off your net worth/i.test(acct.body) && /room figure/i.test(acct.body) && /costing you/i.test(acct.body), acct.body.slice(0,400));
ok('...and that it is what puts them in the Move list',
  /Move/.test(acct.body) && /twice/.test(acct.body));

const xn=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(300);
  document.querySelector('#typeToggle button[data-t="transfer"]').click(); await w(250);
  return {txt:document.getElementById('xferNote').textContent,
          hasTrail:!!document.querySelector('#xferNote [data-trail="account"]')};
});
ok('with no card anywhere, Move says where a card comes from',
  /has to exist here before it can be somewhere money lands/i.test(xn.txt), xn.txt);
ok('...and hands you the way to add one rather than naming a tab',
  xn.hasTrail===true);

/* once a card exists, the nudge goes away and the card is in both lists */
await seed({...BASE, accounts:[
  {id:'a1',name:'Joint Checking',kind:'checking',balance:3000,updated:'2026-08-01'},
  {id:'a3',name:'Rewards Card',kind:'credit',balance:-412,limit:13700,apr:13,updated:'2026-08-01'},
  {id:'a4',name:'Equity Line',kind:'credit',balance:0,limit:25000,apr:3.6,secured:true,updated:'2026-08-01'}]});
await pg.reload(); await pg.waitForTimeout(600);
const after=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(300);
  document.querySelector('#typeToggle button[data-t="transfer"]').click(); await w(250);
  const opts=id=>[...document.querySelectorAll('#'+id+' option')].map(o=>o.textContent);
  return {note:document.getElementById('xferNote').textContent,
          landsIn:opts('txXferTo'), out:opts('txAcct'),
          def:(document.getElementById('txXferTo')||{}).value,
          invest:opts('txInvPick')};
});
ok('the nudge disappears once a card exists',
  !/has to exist here/i.test(after.note), after.note.slice(0,120));
ok('the card and the line are both places money can land',
  after.landsIn.includes('Rewards Card') && after.landsIn.includes('Equity Line'),
  after.landsIn.join(', '));
ok('...and both are places money can come out of',
  after.out.includes('Rewards Card') && after.out.includes('Equity Line'), after.out.join(', '));
ok('...with a card preselected, because that is what a move usually is',
  after.def==='a3', after.def);
ok('but an investment still cannot land in a line of credit',
  !after.invest.includes('Rewards Card') && !after.invest.includes('Equity Line'), after.invest.join(', '));

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
