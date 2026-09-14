/* "The number pad keeps disappearing when clicked on. The zero is also awkward
   in the text bar / The calculator also does not add to the total it just
   brings it to zero / When looking at the graphic glitches."

   Four complaints, one field. All four came out of the same decision: that a
   budget amount is a browser number input which the list redraws around.

   1. THE KEYPAD. Every box committed on `input` and called planRefresh() on
      `change`, and planRefresh rebuilds the whole list with innerHTML. A
      browser fires `change` on the field you are LEAVING before it focuses the
      one you are tapping - so moving from Dining to Coffee destroyed the
      Coffee box mid-tap, focus fell to <body>, and the keypad shut. Every
      second category, the keyboard closed on you. The row also carried
      data-catsheet, so a thumb that landed on the dollar sign rather than the
      80px box opened a full-screen sheet over the top, which closes it too.

   2. THE ZERO. Every unassigned row was pre-filled with a literal 0 that had
      to be deleted before a number could be typed.

   3. THE CALCULATOR. The phone's pad has + - x ( ) printed on it, so people
      press them. <input type="number"> holding "250+52" reports its value as
      the EMPTY STRING, and parseFloat('')||0 is 0 - so the one figure on the
      screen that was already right got wiped at the exact moment somebody was
      trying to add to it.

   4. THE GLITCH. A row with nothing assigned had no "$x left" line and was a
      line shorter than its neighbours. Typing the first number into it GREW
      it, shoving every row below down the screen - once per category, while
      the thumb was travelling between them.

   The rule underneath 3 is the one worth keeping: a box that cannot read what
   is in it writes NOTHING. Half-typed is the normal state of a field somebody
   is still typing in. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);

const SEED={onboarded:true,mindOff:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',
  activeMonth:'2026-09',
  categories:[{id:'wal',name:'Walmart'},{id:'ald',name:'Aldi'},{id:'din',name:'Dining'},
              {id:'cof',name:'Coffee'},{id:'food',name:'Food'},{id:'tak',name:'Takeout',parentId:'food'}],
  budgets:{'2026-09':{wal:250,ald:541.67,cof:52,tak:366.24}},
  transactions:[{id:'i1',type:'income',amount:4760.28,source:'Pay',date:'2026-09-04'},
                {id:'e1',type:'expense',amount:4,catId:'wal',date:'2026-09-05'},
                {id:'e2',type:'expense',amount:580.68,catId:'ald',date:'2026-09-06'},
                {id:'e3',type:'expense',amount:431.34,catId:'tak',date:'2026-09-07'}],
  accounts:[],assets:[],liabilities:[],goals:[],recurring:[],impulse:[],debts:[],
  diary:[],intake:{},lessons:[],vault:[]};
await p.evaluate(s=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(s)),SEED);
await p.reload(); await p.waitForTimeout(1800);

/* ---- the reader, on its own ---- */
const ev=await p.evaluate(()=>{
  const r=s=>{ const o=amtEval(s); return o.ok?o.value:'NO'; };
  return { plain:r('250'), cents:r('1200.83'), commas:r('1,200.50'), dollar:r('$40'),
           sum:r('250+52'), minus:r('250-50'), times:r('4x12'), unicodeTimes:r('4×12'),
           divide:r('100/4'), unicodeMinus:r('−500'), brackets:r('(250+52)*2'),
           spaces:r('  50 + 50 '), trailingDot:r('250.'), leadingDot:r('.5'),
           halfTyped:r('250+'), openBracket:r('((3+4)'), divByZero:r('100/0'),
           junk:r('abc'), doubleDot:r('2..5'), sci:r('12e3'),
           empty:amtEval('').empty, hasOpSum:amtEval('250+52').hasOp, hasOpPlain:amtEval('-500').hasOp,
           boxPlain:amtBox(302), boxCents:amtBox(541.666), boxZero:amtBox(0) };
});

/* ---- the field, on the screen ---- */
const field=await p.evaluate(async()=>{
  const w=m=>new Promise(x=>setTimeout(x,m));
  activateTab('budget'); await w(1200);
  setPlanView('planned'); await w(350);
  const q=id=>document.querySelector('#cats input[data-cat="'+id+'"]');
  const hint=id=>{ const h=document.querySelector('#cats [data-row="'+id+'"] .rw-left');
                   return h?h.innerText.trim():null; };
  const o={};
  const din=q('din'), wal=q('wal');
  /* 2. the zero */
  o.emptyWhenUnassigned = din.value==='';
  o.placeholderIsZero   = din.placeholder==='0';
  o.assignedShowsFigure = wal.value==='250';
  o.stillNumericPad     = din.inputMode==='decimal';

  /* 4. the row does not change height when a figure lands in it */
  const h=id=>Math.round(document.querySelector('#cats [data-row="'+id+'"]').getBoundingClientRect().height);
  o.heightsEvenBefore = h('din')===h('wal');
  din.focus(); din.value='300'; din.dispatchEvent(new Event('input',{bubbles:true})); await w(120);
  o.heightUnchanged = h('din')===h('wal');
  /* and the line under it arrived without a rebuild */
  o.hintLive = hint('din');
  o.sameNodeAfterTyping = document.querySelector('#cats input[data-cat="din"]')===din;

  /* 1. the keypad: moving to the next field must not destroy it */
  const cof=q('cof'), was=cof;
  din.dispatchEvent(new Event('change',{bubbles:true}));
  din.blur(); cof.focus();
  await w(300);
  o.nextFieldSurvived = document.querySelector('#cats input[data-cat="cof"]')===was;
  o.focusHeld = document.activeElement===was;

  /* ...and the tap that lands beside the box goes into the box, not into a sheet */
  cof.blur(); await w(200);
  const dol=document.querySelector('#cats [data-row="din"] .sa-row');
  dol.dispatchEvent(new MouseEvent('click',{bubbles:true})); await w(250);
  o.sheetStayedShut = !document.getElementById('catSheet').classList.contains('on');
  o.tapPutCursorInTheBox = document.activeElement===document.querySelector('#cats input[data-cat="din"]');
  /* the name is still the doorway it always was */
  document.querySelector('#cats [data-row="din"] .rw-nm').click(); await w(300);
  o.nameStillOpensTheSheet = document.getElementById('catSheet').classList.contains('on');
  closeCatSheet(); await w(300);
  return o;
});

/* ---- 3. the calculator, and what it refuses to do ---- */
const calc=await p.evaluate(async()=>{
  const w=m=>new Promise(x=>setTimeout(x,m));
  const q=id=>document.querySelector('#cats input[data-cat="'+id+'"]');
  const type=async(id,v)=>{ const e=q(id); e.focus(); e.value=v;
    e.dispatchEvent(new Event('input',{bubbles:true})); await w(80);
    return assignedFor(id,'2026-09'); };
  const o={};
  o.sum = await type('din','250+52');
  /* shown where the remainder normally sits, while it is being typed */
  const h=document.querySelector('#cats [data-row="din"] .rw-left');
  o.working = h?h.innerText.trim():'';
  /* half-typed leaves the figure it is being added to alone */
  o.midSum = await type('din','250+');
  o.junk   = await type('din','abc');
  /* blur puts the answer in the box */
  q('din').blur(); await w(200);
  o.boxAfterBlur = q('din').value;
  o.afterBlur = assignedFor('din','2026-09');
  /* an unreadable box gets the stored figure back rather than keeping "250+" */
  const e=q('din'); e.focus(); e.value='250+'; e.dispatchEvent(new Event('input',{bubbles:true}));
  await w(80); e.blur(); await w(250);
  o.unreadableBoxRestored = q('din').value;
  /* negative is still clamped, whatever route it arrives by */
  o.negative = await type('din','-500');
  o.negativeViaSum = await type('din','100-600');
  return o;
});

/* ---- nothing else on the list moved ---- */
const rest=await p.evaluate(async()=>{
  const w=m=>new Promise(x=>setTimeout(x,m));
  const o={};
  const hint=id=>{ const h=document.querySelector('#cats [data-row="'+id+'"] .rw-left');
                   return h?h.innerText.trim():null; };
  /* a row with nothing assigned still says nothing, rather than "$0 left" */
  const e=document.querySelector('#cats input[data-cat="din"]');
  e.focus(); e.value=''; e.dispatchEvent(new Event('input',{bubbles:true})); await w(120);
  o.zeroStillSilent = hint('din')===null;
  o.stillNoHeightJump = Math.round(document.querySelector('#cats [data-row="din"]').getBoundingClientRect().height)
                      === Math.round(document.querySelector('#cats [data-row="wal"]').getBoundingClientRect().height);
  e.blur(); await w(300);
  /* the group total follows a sub being typed into, without waiting for a redraw */
  const tak=document.querySelector('#cats input[data-cat="tak"]');
  tak.focus(); tak.value='500'; tak.dispatchEvent(new Event('input',{bubbles:true})); await w(150);
  const g=document.querySelector('#cats [data-row="food"] .rw-fig');
  o.groupFigureFollows = g?g.innerText.trim():'';
  o.groupHintFollows = hint('food');
  tak.blur(); await w(350);
  /* Enter still walks down the list, and still does not rebuild it mid-step */
  const wal=document.querySelector('#cats input[data-cat="wal"]');
  wal.focus(); wal.value='100+100';
  wal.dispatchEvent(new Event('input',{bubbles:true})); await w(80);
  wal.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); await w(200);
  o.enterComputed = wal.value;
  o.enterMovedOn = document.activeElement && document.activeElement.dataset
                   ? document.activeElement.dataset.cat : null;
  o.enterKeptTheField = document.activeElement===document.querySelector('#cats input[data-cat="ald"]');
  document.activeElement.blur(); await w(350);
  o.storedAfterEnter = assignedFor('wal','2026-09');
  /* and once the thumb is gone the list is rebuilt for real */
  o.rebuiltOnLeave = document.querySelector('#cats input[data-cat="wal"]').value==='200';
  return o;
});

await b.close();

const T=[
  ['the reader takes a plain amount, cents, commas and a dollar sign',
   ev.plain===250 && ev.cents===1200.83 && ev.commas===1200.5 && ev.dollar===40, JSON.stringify(ev).slice(0,120)],
  ['...and the arithmetic printed on the phone\'s own keypad',
   ev.sum===302 && ev.minus===200 && ev.times===48 && ev.divide===25 && ev.brackets===604,
   JSON.stringify({sum:ev.sum,minus:ev.minus,times:ev.times,div:ev.divide,br:ev.brackets})],
  ['...including the characters some keyboards actually send',
   ev.unicodeTimes===48 && ev.unicodeMinus===-500, JSON.stringify({x:ev.unicodeTimes,m:ev.unicodeMinus})],
  ['...and the ways a real thumb leaves a number half-written',
   ev.spaces===100 && ev.trailingDot===250 && ev.leadingDot===0.5,
   JSON.stringify({sp:ev.spaces,dot:ev.trailingDot,lead:ev.leadingDot})],
  ['a box it cannot read is refused rather than called zero',
   ev.halfTyped==='NO' && ev.openBracket==='NO' && ev.divByZero==='NO'
     && ev.junk==='NO' && ev.doubleDot==='NO' && ev.sci==='NO', JSON.stringify(ev).slice(0,200)],
  ['...and an empty box is empty, which is a different thing again',
   ev.empty===true, String(ev.empty)],
  ['a sum knows it is a sum, and a signed number knows it is not',
   ev.hasOpSum===true && ev.hasOpPlain===false, JSON.stringify({s:ev.hasOpSum,p:ev.hasOpPlain})],
  ['what goes back into a box is plain enough for the box to read again',
   ev.boxPlain==='302' && ev.boxCents==='541.67' && ev.boxZero==='',
   JSON.stringify({a:ev.boxPlain,b:ev.boxCents,c:ev.boxZero})],

  ['a category with nothing assigned offers an empty box, not a 0 to delete first',
   field.emptyWhenUnassigned===true && field.placeholderIsZero===true,
   JSON.stringify({v:field.emptyWhenUnassigned,ph:field.placeholderIsZero})],
  ['...one that has money shows it', field.assignedShowsFigure===true, String(field.assignedShowsFigure)],
  ['...and the phone still raises a number pad over it', field.stillNumericPad===true,
   String(field.stillNumericPad)],

  ['every row is the same height whether or not it has a figure in it',
   field.heightsEvenBefore===true, String(field.heightsEvenBefore)],
  ['...so typing the first number into one does not shove the list down the screen',
   field.heightUnchanged===true, String(field.heightUnchanged)],
  ['...while what is left still appears as you type it',
   /\$300\b/.test(field.hintLive||''), field.hintLive],
  ['...without the field being rebuilt under the thumb',
   field.sameNodeAfterTyping===true, String(field.sameNodeAfterTyping)],

  ['moving to the next category does not destroy the box you are moving to',
   field.nextFieldSurvived===true && field.focusHeld===true,
   JSON.stringify({survived:field.nextFieldSurvived,focus:field.focusHeld})],
  ['a tap beside the box puts the cursor in the box',
   field.tapPutCursorInTheBox===true, String(field.tapPutCursorInTheBox)],
  ['...instead of opening a sheet over the keypad',
   field.sheetStayedShut===true, String(field.sheetStayedShut)],
  ['...and the name is still the doorway it always was',
   field.nameStillOpensTheSheet===true, String(field.nameStillOpensTheSheet)],

  ['the pad\'s plus key adds to the figure instead of zeroing it',
   calc.sum===302, String(calc.sum)],
  ['...showing the running answer where the remainder sits',
   /^= \$302/.test(calc.working||''), calc.working],
  ['...and leaving it in the box once the thumb is gone',
   calc.boxAfterBlur==='302' && calc.afterBlur===302,
   JSON.stringify({box:calc.boxAfterBlur,stored:calc.afterBlur})],
  ['a half-typed sum leaves the figure it is being added to alone',
   calc.midSum===302, String(calc.midSum)],
  ['...as does anything else it cannot read', calc.junk===302, String(calc.junk)],
  ['...and an unreadable box is given the stored figure back rather than left holding it',
   calc.unreadableBoxRestored==='302', calc.unreadableBoxRestored],
  ['a negative assignment is still clamped, by either route',
   calc.negative===0 && calc.negativeViaSum===0,
   JSON.stringify({plain:calc.negative,sum:calc.negativeViaSum})],

  ['a category with nothing assigned still says nothing, rather than "$0 left"',
   rest.zeroStillSilent===true, String(rest.zeroStillSilent)],
  ['...and the space it would take is still held open',
   rest.stillNoHeightJump===true, String(rest.stillNoHeightJump)],
  ['a pool\'s total follows a subcategory being typed into, without a redraw',
   /\$500\b/.test(rest.groupFigureFollows||'') && /\$68\.66\b/.test(rest.groupHintFollows||''),
   JSON.stringify({fig:rest.groupFigureFollows,hint:rest.groupHintFollows})],
  ['Enter still works the sum out and walks on to the next category',
   rest.enterComputed==='200' && rest.enterMovedOn==='ald',
   JSON.stringify({v:rest.enterComputed,next:rest.enterMovedOn})],
  ['...into a field that is still there when it arrives',
   rest.enterKeptTheField===true, String(rest.enterKeptTheField)],
  ['...and what it worked out is what was kept',
   rest.storedAfterEnter===200 && rest.rebuiltOnLeave===true,
   JSON.stringify({stored:rest.storedAfterEnter,rebuilt:rest.rebuiltOnLeave})],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
console.log('page errors:', errs.length?[...new Set(errs)].join(' | '):'none');
process.exit(bad?1:0);
