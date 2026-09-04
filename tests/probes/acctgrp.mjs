import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,280):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
/* the user's own seven, plus a card */
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',s), JSON.stringify({
  onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',
  categories:[{id:'c1',name:'Food'}],budgets:{'2026-08':{c1:400}},transactions:[],
  accounts:[
    {id:'a1',name:'Joint Checking',kind:'checking',balance:6637.64,updated:'2026-08-27'},
    {id:'a2',name:'Overflow income',kind:'checking',purpose:'emergency',balance:1000,updated:'2026-08-25'},
    {id:'a3',name:'Acorns invest',kind:'invest',balance:22223.24,updated:'2026-08-25'},
    {id:'a4',name:'Acorns later',kind:'invest',purpose:'retire',balance:21369.96,updated:'2026-08-25'},
    {id:'a5',name:'Stash',kind:'invest',purpose:'retire',balance:18666.38,updated:'2026-08-28'},
    {id:'a6',name:'Coinbase',kind:'other',balance:14782.70,updated:'2026-08-28'},
    {id:'a7',name:'Webull',kind:'invest',balance:1001.89,updated:'2026-08-28'},
    {id:'a8',name:'Rewards Card',kind:'credit',balance:-412,limit:13700,apr:13,updated:'2026-08-28'},
    {id:'a9',name:'Rainy day',kind:'savings',purpose:'emergency',balance:3100,updated:'2026-08-28'}],
  goals:[],impulse:[],recurring:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[]}));
await pg.reload(); await pg.waitForTimeout(800);

const g=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('goals'); deckShow('goals','Accounts'); renderAccounts(); await w(450);
  const groups=[...document.querySelectorAll('#acctList .acg')].map(el=>({
    name:el.querySelector('.acg-n').textContent,
    total:el.querySelector('.acg-v').textContent,
    sub:el.querySelector('.acg-s').textContent,
    rows:[...el.querySelectorAll('[data-row]')].map(r=>r.dataset.row),
    lvls:[...new Set([...el.querySelectorAll('[data-row]')].map(r=>r.dataset.lvl))]
  }));
  return {groups, allRows:[...document.querySelectorAll('#acctList [data-row]')].length,
          bank:bankTotal(), nw:netWorth()};
});
ok('the list is grouped, one header per kind that has something in it',
  g.groups.length===5, JSON.stringify(g.groups.map(x=>x.name)));
ok('...in an order that puts spendable first and owed last',
  g.groups[0].name==='Spending money' && g.groups[g.groups.length-1].name==='Cards & credit lines',
  JSON.stringify(g.groups.map(x=>x.name)));
ok('...with every account still on screen, none lost to a group', g.allRows===9, String(g.allRows));
/* checked by hand: 6637.64 + 1000, and 22223.24 + 21369.96 + 18666.38 + 1001.89 */
ok('each header carries its own total, to the cent',
  g.groups[0].total==='$7,637.64' && g.groups[2].total==='$63,261.47',
  JSON.stringify(g.groups.map(x=>x.name+'='+x.total)));
ok('...and the card group is priced as what is OWED, not as a minus',
  g.groups[4].total==='$412' && !/-/.test(g.groups[4].total), g.groups[4].total);
ok('...and says how many accounts are in it',
  /4 accounts/.test(g.groups[2].sub) && /1 account\b/.test(g.groups[4].sub),
  JSON.stringify(g.groups.map(x=>x.sub)));
ok('every row is tagged with its own group, so a drag knows its siblings',
  g.groups.every(x=>x.lvls.length===1), JSON.stringify(g.groups.map(x=>x.lvls)));

/* reorder is confined to the group */
const ro=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const bankBefore=bankTotal(), nwBefore=netWorth();
  document.getElementById('acctReorderBtn').click(); await w(350);
  const before=[...document.querySelectorAll('#acctList [data-row]')].map(x=>x.dataset.row);
  /* move Stash up inside Investments */
  moveAcct('a5',-1); renderAccounts(); await w(320);
  const after=[...document.querySelectorAll('#acctList [data-row]')].map(x=>x.dataset.row);
  /* siblings the engine would offer for a card: only its own group */
  const cardSibs=dragSiblings('owe','accts').map(x=>x.dataset.row);
  const investSibs=dragSiblings('grow','accts').map(x=>x.dataset.row);
  return {before, after, cardSibs, investSibs,
          totalsUnmoved:bankTotal()===bankBefore && netWorth()===nwBefore,
          spendUntouched:after.slice(0,2).join()===before.slice(0,2).join()};
});
ok('a move inside a group reorders that group',
  JSON.stringify(ro.after)!==JSON.stringify(ro.before), JSON.stringify(ro.before)+' -> '+JSON.stringify(ro.after));
ok('...and leaves the groups above it exactly where they were', ro.spendUntouched===true, JSON.stringify(ro));
ok('...with no total on the page moving', ro.totalsUnmoved===true);
ok('a card can only be dragged among cards',
  ro.cardSibs.length===1 && ro.cardSibs[0]==='a8', JSON.stringify(ro.cardSibs));
ok('...and an investment only among investments',
  ro.investSibs.length===4 && !ro.investSibs.includes('a8'), JSON.stringify(ro.investSibs));

/* editing an account into a card moves it into the cards group */
const moved=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  document.getElementById('acctReorderBtn').click(); await w(250);
  document.querySelector('[data-acctedit="a6"]').click(); await w(300);
  document.getElementById('aeKind').value='savings';
  document.getElementById('aeKind').dispatchEvent(new Event('change',{bubbles:true})); await w(150);
  document.querySelector('[data-acctsave="a6"]').click(); await w(420);
  const grp=[...document.querySelectorAll('#acctList .acg')].find(el=>/Savings/.test(el.querySelector('.acg-n').textContent));
  return {inSavings:[...grp.querySelectorAll('[data-row]')].map(x=>x.dataset.row),
          lvl:(document.querySelector('[data-row="a6"]')||{}).dataset.lvl};
});
ok('changing an account kind moves it into the right group',
  moved.inSavings.includes('a6') && moved.lvl==='save', JSON.stringify(moved));

/* The pencil cost the name its width, and at 320px the body measured 17px -
   "Joint Checking" came out one letter per line. The row wraps now. */
for(const W of [320,360,390]){
  await pg.setViewportSize({width:W,height:1000});
  await pg.waitForTimeout(320);
  const m=await pg.evaluate(async()=>{
    const w=ms=>new Promise(r=>setTimeout(r,ms));
    activateTab('goals'); deckShow('goals','Accounts'); renderAccounts(); await w(320);
    const rows=[...document.querySelectorAll('.acct-row')];
    return rows.map(r=>({ body:Math.round(r.querySelector('.ac-b').getBoundingClientRect().width),
                          nameH:Math.round(r.querySelector('.ac-n').getBoundingClientRect().height) }));
  });
  ok('at '+W+'px every account name has real width to sit in',
    m.every(x=>x.body>=140), JSON.stringify(m));
  ok('...and no name is shredded down the page',
    m.every(x=>x.nameH<=64), JSON.stringify(m));
}

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
