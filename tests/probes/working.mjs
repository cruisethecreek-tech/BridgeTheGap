import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
/* numbers chosen so the sum is checkable by hand: 6000 in, 1300 out, 400 away */
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',s), JSON.stringify({
  onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',hourlyWage:30,
  categories:[{id:'c1',name:'Food'}],budgets:{'2026-08':{c1:400}},
  accounts:[{id:'a1',name:'Checking',kind:'checking',balance:5000,updated:'2026-08-01'},
            {id:'a2',name:'Savings',kind:'savings',balance:1000,updated:'2026-08-01'}],
  transactions:[
    {id:'i1',type:'income',amount:4000,date:'2026-07-01',source:'Pay',acctId:'a1'},
    {id:'i2',type:'income',amount:2000,date:'2026-08-01',source:'Pay',acctId:'a1'},
    {id:'e1',type:'expense',amount:800,date:'2026-07-05',catId:'c1',acctId:'a1'},
    {id:'e2',type:'expense',amount:500,date:'2026-08-05',catId:'c1',acctId:'a1'},
    {id:'v1',type:'invest',amount:400,date:'2026-08-06',source:'Fund',acctId:'a1'},
    {id:'m1',type:'transfer',amount:250,date:'2026-08-07',acctId:'a1',destAcctId:'a2'}],
  goals:[],impulse:[],recurring:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[]}));
await pg.reload(); await pg.waitForTimeout(800);

const r=await pg.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(600);
  const tiles=[...document.querySelectorAll('#txSummary .stat')].map(t=>({
    k:t.querySelector('.k').textContent.replace('?','').trim(),
    v:t.querySelector('.v').textContent, why:!!t.querySelector('[data-why]') }));
  const btn=document.querySelector('#txSummary [data-why="loggedNet"]');
  if(!btn) return {tiles, opened:false};
  const stripH=Math.round(document.getElementById('txSummary').getBoundingClientRect().height);
  btn.click(); await w(250);
  const note=document.querySelector('.why-note[data-forwhy="loggedNet"]');
  const inTile=!!(note && note.closest('.stat'));
  const rows=[...document.querySelectorAll('.why-note .wk-r')].map(x=>x.innerText.replace(/\n/g,' | '));
  const txt=note?note.innerText:'';
  /* the strip must not have been shoved out of shape by the note */
  const after=Math.round(document.getElementById('txSummary').getBoundingClientRect().height);
  btn.click(); await w(200);
  const closed=!document.querySelector('.why-note[data-forwhy="loggedNet"]');
  return {tiles, opened:true, inTile, rows, txt, stripH, after, closed};
});

ok('the all-time figure now carries a ? where the question gets asked',
  r.tiles.some(t=>/Logged net/.test(t.k) && t.why), JSON.stringify(r.tiles));
ok('...and it opens', r.opened===true);
ok('...below the strip, not inside one tile of the grid', r.inTile===false);
ok('...without shoving the tiles out of shape', r.stripH===r.after, `${r.stripH} -> ${r.after}`);
ok('the working is shown as a sum, line by line',
  r.rows.length===4, JSON.stringify(r.rows));
ok('...money in, with how many entries', /Logged coming in \| 2 entries \| \+\$6,000/.test(r.rows[0]), r.rows[0]);
ok('...money out', /Logged going out \| 2 entries \| −\$1,300/.test(r.rows[1]), r.rows[1]);
ok('...money put away', /Logged put away \| 1 entry \| −\$400/.test(r.rows[2]), r.rows[2]);
ok('...and the total it leaves, which is the number on the tile',
  /Which leaves \| 6 in total \| \$4,300/.test(r.rows[3]), r.rows[3]);
ok('the tile shows that same figure',
  r.tiles.some(t=>/Logged net/.test(t.k) && /\$4,300/.test(t.v)), JSON.stringify(r.tiles));
ok('it names the window the sum covers', /2026-07-01 to 2026-08-07/.test(r.txt), r.txt.slice(0,200));
ok('...and says why a move counts for nothing in it',
  /1 move/.test(r.txt) && /not earned and not spent/.test(r.txt), r.txt.slice(0,400));
ok('it teaches what the figure is FOR, not only what it is not',
  /What it is good for/.test(r.txt) && /logged twice/.test(r.txt), r.txt.slice(0,600));
ok('...and still separates it from net worth and the bank',
  /What it is not/.test(r.txt) && /net worth/.test(r.txt) && /bank balance/.test(r.txt));
ok('tapping again closes it', r.closed===true);

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
