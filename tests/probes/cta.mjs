/* "These CTAs should be a more prominent bold color to stand out, instead of
   just blending in with the rest of the text."

   Reported against "Enter my notes - log several at once" - the way in to the
   whole batch-logging tool, rendered as .btn.ghost: transparent, a hairline
   border, body-coloured text. Under a heading it reads as a caption somebody
   drew a box around.

   The fix is NOT "make ghost buttons loud". There are 85 of them and most are
   the other half of a pair - Not now, Cancel, Keep it, Delete - and painting
   those loud flattens the hierarchy, which helps nobody.

   The line, and what this file exists to hold:

     a ghost button with a .primary beside it IS the quiet alternative, and
     stays quiet. A ghost button standing alone is not an alternative to
     anything - it is the invitation, and it looks like one.

   So there are three steps now, and the checks below are that all three are
   distinguishable at a glance, readable in both themes, and applied to the
   right buttons rather than to everything. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const errs=[];

const lum=c=>{ const f=v=>{v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
  return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]); };
const ratio=(a,bb)=>{ const L1=lum(a),L2=lum(bb); return (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05); };
const parse=s=>{ const m=String(s).match(/(\d+\.?\d*)/g)||[]; return [ +m[0]||0,+m[1]||0,+m[2]||0, m[3]===undefined?1:+m[3] ]; };
const over=(fg,bg)=>{ const a=fg[3]; return [0,1,2].map(i=>Math.round(fg[i]*a+bg[i]*(1-a))); };

const out={};
for(const theme of ['light','dark']){
  const p=await b.newPage({viewport:{width:390,height:900}});
  p.on('pageerror',e=>errs.push(theme+': '+String(e)));
  await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(300);
  await p.evaluate(t=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify({
    onboarded:true,mindOff:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',
    activeMonth:'2026-09',theme:t,
    categories:[{id:'roof',name:'Roof'}],budgets:{'2026-09':{roof:1250}},
    transactions:[{id:'i1',type:'income',amount:4760,source:'Pay',date:'2026-09-04'}],
    accounts:[],assets:[],liabilities:[],goals:[],recurring:[],impulse:[],debts:[],
    diary:[],intake:{},lessons:[],vault:[]})),theme);
  await p.reload(); await p.waitForTimeout(1600);
  out[theme]=await p.evaluate(async()=>{
    const w=m=>new Promise(x=>setTimeout(x,m));
    activateTab('tx'); await w(1100);
    const read=el=>{ if(!el) return null; const s=getComputedStyle(el);
      /* What is BEHIND the button, which is never the button's own background.
         The first cut started the walk at the button itself, so a tinted
         button reported its own tint as the surface underneath it and every
         contrast came out as 1.00 - a test measuring a colour against itself. */
      let n=el.parentElement, bg='rgba(0, 0, 0, 0)';
      while(n){ const c=getComputedStyle(n).backgroundColor;
        if(c!=='rgba(0, 0, 0, 0)'&&c!=='transparent'){ bg=c; break; } n=n.parentElement; }
      if(bg==='rgba(0, 0, 0, 0)') bg=getComputedStyle(document.body).backgroundColor;
      return { color:s.color, bg:s.backgroundColor, behind:bg, weight:s.fontWeight,
               border:s.borderTopWidth, borderColor:s.borderTopColor,
               visible: el.offsetParent!==null }; };
    const cta=document.getElementById('quickLogBtn');
    /* a ghost that really does stand beside a primary */
    const pair=document.querySelector('#scanPick');
    const prim=document.querySelector('#scanSnap');
    return { cta:read(cta), ghost:read(pair), primary:read(prim),
      ctaLabel:(cta||{textContent:''}).textContent.trim(),
      /* the hierarchy, stated as classes rather than eyeballed */
      ctaIsCta: !!(cta&&cta.classList.contains('cta')),
      pairStaysGhost: !!(pair&&pair.classList.contains('ghost')&&!pair.classList.contains('cta')),
      /* and nothing that declines, cancels or destroys got promoted */
      wrongly:[...document.querySelectorAll('.btn.cta')].filter(el=>
        /not now|cancel|keep it|delete|erase|skip|close|none|not yet|start over|sign out/i
          .test(el.textContent||'')).map(el=>el.textContent.trim()).slice(0,4),
      ctaCount:document.querySelectorAll('.btn.cta').length,
      ghostCount:document.querySelectorAll('.btn.ghost').length };
  });
  await p.close();
}

/* the same question asked of the whole app, not just one screen */
const p2=await b.newPage({viewport:{width:390,height:900}});
p2.on('pageerror',e=>errs.push('sweep: '+String(e)));
await p2.goto('file://'+process.cwd()+'/app.html'); await p2.waitForTimeout(300);
await p2.evaluate(()=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify({
  onboarded:true,mindOff:true,uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',
  activeMonth:'2026-09',
  categories:[{id:'roof',name:'Roof'}],budgets:{'2026-09':{roof:1250}},
  transactions:[{id:'i1',type:'income',amount:4760,source:'Pay',date:'2026-09-04'}],
  accounts:[],assets:[],liabilities:[],goals:[],recurring:[],impulse:[],debts:[],
  diary:[],intake:{},lessons:[],vault:[]})));
await p2.reload(); await p2.waitForTimeout(1600);
const sweep=await p2.evaluate(async()=>{
  const w=m=>new Promise(x=>setTimeout(x,m));
  const bad=[];
  for(const t of ['home','budget','tx','debt','goals','reflect','impulse','learn','settings']){
    activateTab(t); await w(650);
    document.querySelectorAll('#view-'+t+' .btn.cta').forEach(el=>{
      if(el.offsetParent===null) return;
      /* "Beside" means in the same row of controls - the button's own parent -
         not anywhere in the same panel. The first cut used closest('div'),
         which walks up to the whole Track panel and therefore counted the log
         form's Add button as sitting beside a link that is three fields above
         it. That is not a pair a reader has to choose between. */
      const box=el.parentElement;
      if(box && box.querySelector(':scope > .btn.primary')) bad.push(t+': '+el.textContent.trim().slice(0,32));
    });
  }
  return bad;
});
await p2.close();
await b.close();

const T=[];
for(const theme of ['light','dark']){
  const o=out[theme];
  const c=o.cta, g=o.ghost, pr=o.primary;
  const ctaText=ratio(parse(c.color).slice(0,3), over(parse(c.bg), parse(c.behind)));
  const ghostText=ratio(parse(g.color).slice(0,3), over(parse(g.bg), parse(g.behind)));
  T.push([`the invitation is readable in ${theme}`, ctaText>=4.5,
          `${theme} contrast ${ctaText.toFixed(2)}  (${c.color} on ${c.bg} over ${c.behind})`]);
  T.push([`...and it is filled, not transparent like the text around it (${theme})`,
          parse(c.bg)[3]>0.05, `${theme} cta background ${c.bg}`]);
  T.push([`...with a heavier border than a ghost (${theme})`,
          parseFloat(c.border)>parseFloat(g.border),
          `${theme} cta ${c.border} vs ghost ${g.border}`]);
  T.push([`...and heavier type than the button rule pulls everything back to (${theme})`,
          +c.weight>=700 && +c.weight>+g.weight,
          `${theme} cta ${c.weight} vs ghost ${g.weight}`]);
  T.push([`...in the accent, which nothing else in the prose uses (${theme})`,
          c.color!==g.color, `${theme} cta ${c.color} vs ghost ${g.color}`]);
  T.push([`the quiet alternative beside a primary stays quiet (${theme})`,
          out[theme].pairStaysGhost===true && parse(g.bg)[3]<0.05,
          `${theme} ghost background ${g.bg}`]);
  T.push([`...and the one committing action is still the loudest (${theme})`,
          parse(pr.bg)[3]>0.9 && pr.color!==c.color,
          `${theme} primary ${pr.bg} ${pr.color}`]);
}
T.push(['the reported button is the one that changed',
  out.light.ctaIsCta===true && /Enter my notes/.test(out.light.ctaLabel), out.light.ctaLabel]);
T.push(['nothing that declines, cancels or destroys was promoted with it',
  out.light.wrongly.length===0, JSON.stringify(out.light.wrongly)]);
T.push(['...and the quiet step still carries the bulk of the buttons',
  out.light.ghostCount>out.light.ctaCount*3,
  out.light.ctaCount+' invitations vs '+out.light.ghostCount+' quiet ones on this screen']);
T.push(['no invitation is left standing next to a primary, on any tab',
  sweep.length===0, sweep.join(' | ')]);
T.push(['nothing threw while measuring', errs.length===0, [...new Set(errs)].slice(0,2).join(' | ')]);

let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
process.exit(bad?1:0);
