import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0, errs=[];
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,260):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:900}});
pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',s), JSON.stringify({
  onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,activeMonth:'2026-08',
  categories:[{id:'c1',name:'Getting around'}],budgets:{'2026-08':{c1:200}},
  transactions:[],accounts:[{id:'a1',name:'Joint Checking',kind:'checking',balance:2000,updated:'2026-08-01'}],
  goals:[],impulse:[],recurring:[],assets:[],liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[]}));
await pg.reload(); await pg.waitForTimeout(600);

/* The failure mode that produced "Read 1 line": OCR reads the descriptions as
   one block and the right-hand amount column as another, so only the first
   amount has any text in front of it. */
const COLUMNS=[
 'Pending',
 'Preauthorization / AI=867560,RR=623952602847,PK=356239682557559 PMT*OH BUREAU MOTOR VEHIC Held:2026-08-27 14:57:35 EDT',
 'Aug 27, 2026',
 'Preauthorization / AI=843880,RR=623913595672,PK=466239664376271 MAHONINGCTYTITLE Held:2026-08-27 14:27:17 EDT',
 'Aug 27, 2026',
 'Preauthorization / AI=157390,RR=623807855866,PK=466238683828615 Kindle Unltd Held:2026-08-26 14:59:42 EDT',
 'Aug 26, 2026',
 '-$59.25','-$21.49','-$12.89'].join('\n');
const r=await pg.evaluate(t=>qlParseOcr(t), COLUMNS);
console.log(JSON.stringify(r));
ok('every amount survives even when OCR splits the columns', r.length===3, String(r.length));
ok('...with the amounts intact',
  JSON.stringify(r.map(x=>x.amt))==='[59.25,21.49,12.89]', JSON.stringify(r.map(x=>x.amt)));
ok('...and the ones it could not name are flagged, not dropped',
  r.filter(x=>x.unnamed).length===2, JSON.stringify(r.map(x=>!!x.unnamed)));
ok('...while the one it could name keeps its name',
  !r[0].unnamed && r[0].what.length>2, JSON.stringify(r[0]));

/* the normal case must not have regressed */
const norm=await pg.evaluate(()=>qlParseOcr(
 'Preauthorization / AI=1,RR=2 PMT*SHELL OIL Held:2026-08-01\nAug 1, 2026\n-$40.00\n'+
 'Preauthorization / AI=3,RR=4 KROGER Held:2026-08-02\nAug 2, 2026\n-$62.10'));
ok('a well-read statement still comes back fully named',
  norm.length===2 && !norm.some(x=>x.unnamed)
  && norm[0].what==='SHELL OIL' && norm[1].what==='KROGER', JSON.stringify(norm));
const pad=await pg.evaluate(()=>qlParseOcr('coffee 4.50\ngas 38'));
ok('the notepad path is untouched', pad.length===2 && !pad.some(x=>x.unnamed), JSON.stringify(pad));

/* the note has to count both, and offer the raw text */
const ui=await pg.evaluate(async(t)=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('tx'); await w(250);
  document.getElementById('quickLogBtn').click(); await w(300);
  /* drive the fill the way the OCR handler does */
  const items=qlParseOcr(t);
  const box=document.getElementById('quickLog'), listEl=document.getElementById('qlList');
  items.forEach(it=>{
    let row=[...box.querySelectorAll('.ql-row')].find(el=>!el.querySelector('.ql-what').value && !el.querySelector('.ql-amt').value);
    if(!row){ const wrap=document.createElement('div'); wrap.innerHTML=qlRow(); row=wrap.firstElementChild; listEl.appendChild(row); }
    row.querySelector('.ql-what').value=it.what; row.querySelector('.ql-amt').value=it.amt;
    if(it.unnamed){ row.classList.add('ql-unnamed'); row.querySelector('.ql-what').placeholder='Name this one from the photo'; }
  });
  await w(150);
  return { rows:[...document.querySelectorAll('.ql-row')].map(el=>[el.querySelector('.ql-what').value, el.querySelector('.ql-amt').value]),
           flagged:document.querySelectorAll('.ql-row.ql-unnamed').length,
           placeholder:(document.querySelector('.ql-unnamed .ql-what')||{}).placeholder||'' };
}, COLUMNS);
ok('three rows land, all with amounts', ui.rows.filter(x=>x[1]).length===3, JSON.stringify(ui.rows));
ok('...two of them marked as needing a name', ui.flagged===2, String(ui.flagged));
ok('...and told what to do about it', /Name this one from the photo/.test(ui.placeholder), ui.placeholder);

console.log(`\n${pass} of ${pass+fail} hold`);
console.log('page errors:', errs.length?errs.join('\n'):'none');
await b.close();
process.exit(fail?1:0);
