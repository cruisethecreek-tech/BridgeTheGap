import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
/* "Shouldn't it be consistent throughout the entire app - one shows small pills,
   the other emphasizes its own row for the pill. Whatever you choose just make
   it consistent." One pattern, every tab, and the panels behind the pills have
   to still work: a deep link that walks you to a field must open the section
   that field is inside. */
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:844}});
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'clean',activeMonth:'2026-09',hourlyWage:70,
  householdOn:true, intake:{why:"I want to feel like I'm working for something", story:'scarcity'},
  snapshots:[{month:'2026-08',net:0,bank:80000,owed:0,runway:3.3,stage:3},
             {month:'2026-09',net:0,bank:85819,owed:882,runway:3.3,stage:3}],
  categories:[{id:'c1',name:'Food'},{id:'c2',name:'Rent'},{id:'c3',name:'Power'},{id:'c4',name:'Gas'}],
  budgets:{'2026-09':{c1:900,c2:2200,c3:300,c4:245}},
  accounts:[{id:'a1',name:'Chequing',kind:'checking',balance:85819,updated:'2026-09-01'}],
  debts:[{id:'d1',name:'Visa',balance:2000,rate:19.9,min:60,kind:'card'}],
  goals:[{id:'g1',name:'Cushion',target:1000,saved:300}],
  transactions:[{id:'t1',type:'expense',amount:888,date:'2026-09-03',catId:'c1',acctId:'a1'}]});
await pg.reload(); await pg.waitForTimeout(1700);
const R=[]; const ok=(n,v,d)=>R.push([n,!!v,d]);

const all=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const vis=el=>{const s=getComputedStyle(el);return s.display!=='none'&&el.getBoundingClientRect().height>4;};
  const out={tabs:{}, twoPatterns:[], openAtRest:[], px:{}};
  for(const t of ['home','budget','tx','impulse','debt','goals','diary','settings','reflect','learn']){
    activateTab(t); await w(520);
    const v=document.getElementById('view-'+t); if(!v) continue;
    const panels=[...v.querySelectorAll('[data-deck]')];
    out.px[t]=Math.round(v.scrollHeight);
    out.tabs[t]={pills:v.querySelectorAll('.dk-chip').length, panels:panels.length,
                 decks:v.querySelectorAll('.deck').length};
    v.querySelectorAll('details.acc').forEach(d=>{ if(!d.classList.contains('dk-panel'))
      out.twoPatterns.push(t); });
    panels.filter(vis).forEach(el=>out.openAtRest.push(t+': '+el.dataset.deck));
  }
  return out;
});
const decked=Object.entries(all.tabs).filter(([,d])=>d.panels>0);
ok(`every busy tab collapses the same way (${decked.length} tabs)`,
   decked.length>=7 && decked.every(([,d])=>d.decks===1 && d.pills>0), JSON.stringify(all.tabs));
ok('no tab still uses a second, different collapse', all.twoPatterns.length===0, all.twoPatterns.join(','));
ok('nothing is open until somebody asks, on any tab', all.openAtRest.length===0, all.openAtRest.slice(0,3).join(' | '));
ok('the five-screen tabs are not five screens any more',
   all.px.debt<2600 && all.px.settings<2600 && all.px.goals<2600 && all.px.impulse<2000,
   JSON.stringify(all.px));

/* the pill behaves the same on every tab that has one */
const beh=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const vis=el=>{const s=getComputedStyle(el);return s.display!=='none'&&el.getBoundingClientRect().height>4;};
  const bad=[];
  for(const t of ['home','budget','tx','impulse','debt','goals','diary','settings']){
    activateTab(t); deckShow(t,null); await w(480);
    const chips=[...document.querySelectorAll('#deck-'+t+' .dk-chip')];
    if(chips.length<2){ bad.push(t+': only '+chips.length+' pills'); continue; }
    chips[0].click(); await w(240);
    const panels=[...document.querySelectorAll('#deck-'+t+' [data-deck]')];
    const open=panels.filter(vis);
    if(open.length!==1) bad.push(t+': '+open.length+' open after one tap');
    if(!document.body.contains(chips[0])) bad.push(t+': the pill was destroyed by its own tap');
    chips[1].click(); await w(240);
    if(panels.filter(vis).length!==1) bad.push(t+': tapping another stacked instead of swapping');
    chips[1].click(); await w(220);
    if(panels.filter(vis).length!==0) bad.push(t+': tapping the open one did not shut it');
  }
  return bad;
});
ok('one tap opens one section, swaps, and shuts - identically on every tab',
   beh.length===0, beh.slice(0,3).join(' | '));

/* the regression that collapsing creates: links that walk you somewhere */
const walk=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('goals'); deckShow('goals',null); await w(450);
  const inp=document.querySelector('#acctList input, #acctName');
  if(!inp) return {skip:true};
  inp.focus(); await w(250);
  const seen=getComputedStyle(inp.closest('.dk-panel')||inp).display!=='none';
  activateTab('budget'); deckShow('budget',null); await w(400);
  const cal=document.querySelector('#calGrid .cal-c');
  let calSeen=null;
  if(cal){ cal.scrollIntoView({block:'center'}); await w(250);
    calSeen=cal.getBoundingClientRect().width>10; }
  return {seen, calSeen};
});
ok('focusing a field inside a shut section opens it first', walk.skip||walk.seen===true, JSON.stringify(walk));
ok('...and so does scrolling to something inside one', walk.skip||walk.calSeen!==false, JSON.stringify(walk));

/* the deck must not squeeze what it holds */
const width=await pg.evaluate(async ()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  activateTab('goals'); deckShow('goals',null); await w(450);
  const c=document.querySelector('#deck-goals .dk-chip');
  if(!c) return {err:'no pills on Build'};
  deckShow('goals', c.dataset.dk); await w(320);
  const panel=document.querySelector('#deck-goals .dk-panel.dk-on');
  const view=document.getElementById('view-goals');
  if(!panel) return {err:'nothing opened for '+c.dataset.dk,
    chips:[...document.querySelectorAll('#deck-goals .dk-chip')].map(x=>x.dataset.dk)};
  return {panel:Math.round(panel.getBoundingClientRect().width),
          view:Math.round(view.getBoundingClientRect().width)};
});
ok('an opened section gets the full width of the tab, not the card\'s inner width',
   !width.err && width.panel>=width.view-4, JSON.stringify(width));

R.forEach(([n,p,d])=>{ if(!p) console.log('FAIL: '+n+(d?'  <'+d+'>':'')); });
const bad=R.filter(x=>!x[1]).length;
console.log(`${R.length-bad} of ${R.length} hold`);
console.log('page errors: '+(errs.length?errs.slice(0,2).join(' | '):'none'));
await b.close(); process.exit(bad||errs.length?1:0);
