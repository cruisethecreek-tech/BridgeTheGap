/* ============================================================
   FUNNEL

   The app's only money model, and the one place a privacy promise is easiest to
   break by accident.

   The rule this suite exists to enforce: the payment platform is reached by a
   LINK, never by a script. Lemon Squeezy (and every processor) offers a
   checkout-overlay script that gives a nicer flow. Embedding it would load
   third-party payment code on a page whose headline is "nothing leaves your
   device" - for every visitor, including everyone who never clicks buy. That is
   a promise broken silently, by a convenience, which is exactly how promises
   get broken.

   Also checks the honest-by-default posture: nothing is offered until it is
   configured, and the app never fakes a purchase path it does not have.
   ============================================================ */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';

const results=[]; const check=(name,ok,detail='')=>results.push({ok,name,detail});
/* Scan CODE, not prose. The first version of this suite failed on both files
   because the comments EXPLAINING why lemon.js is banned contain the string
   "lemon.js" - a detector matching its own documentation. Block and HTML
   comments come out first. Line comments are deliberately left in: stripping
   "//" to end-of-line would eat the rest of any line containing "https://",
   which is exactly where a real payment script would be hiding. */
const decomment = src => src
  .replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/\/\*[\s\S]*?\*\//g,' ');
const app=decomment(readFileSync('app.html','utf8')), landing=decomment(readFileSync('index.html','utf8'));

/* ---- 1. no payment script, in either file, ever ---- */
const PAY_SCRIPTS=[
  {n:'Lemon Squeezy overlay', rx:/lemon\.js|lemonsqueezy\.com\/js|createLemonSqueezy/i},
  {n:'Stripe.js',             rx:/js\.stripe\.com|Stripe\(/},
  {n:'PayPal SDK',            rx:/paypal\.com\/sdk|paypalobjects/i},
  {n:'Gumroad overlay',       rx:/gumroad\.com\/js|gumroad\.js/i},
  {n:'Paddle',                rx:/cdn\.paddle\.com|Paddle\.Setup/i}
];
for(const f of [{n:'app.html',src:app},{n:'index.html',src:landing}]){
  for(const p of PAY_SCRIPTS){
    check(`${f.n} loads no ${p.n}`, !p.rx.test(f.src));
  }
}
/* a <script src> pointing anywhere near a payment host is the general form */
const scriptSrcs = [...app.matchAll(/<script[^>]+src=["']([^"']+)/gi),
                    ...landing.matchAll(/<script[^>]+src=["']([^"']+)/gi)].map(m=>m[1]);
check('no <script src> points at a payment host',
      !scriptSrcs.some(u=>/lemonsqueezy|stripe|paypal|gumroad|paddle|checkout/i.test(u)),
      scriptSrcs.join(' | ')||'(no external scripts)');

/* ---- 2. unconfigured means invisible, not broken ---- */
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const errs=[];
const p = await b.newPage({ viewport:{width:390,height:900} });
p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(500);
await p.evaluate(()=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify({
  onboarded:true,activeMonth:'2026-08',uiMode:'all',stageReached:3,guidesOff:true,
  categories:[],budgets:{},goals:[],impulse:[],recurring:[],accounts:[],assets:[],
  liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],hours:[],
  transactions:Array.from({length:30},(_,i)=>({id:'t'+i,type:'expense',amount:10,date:'2026-08-0'+(i%9+1)}))
})));
await p.reload(); await p.waitForTimeout(900);
const unset = await p.evaluate(async () => {
  activateTab('settings'); await new Promise(r=>setTimeout(r,350));
  const sp=document.getElementById('supportPanel');
  return { panelHidden: !sp || getComputedStyle(sp).display==='none',
           linksHidden: [...document.querySelectorAll('[data-offer]')]
             .every(a=>getComputedStyle(a).display==='none'),
           noDeadHrefs: [...document.querySelectorAll('[data-offer]')].every(a=>a.getAttribute('href')==='#') };
});
check('with no checkout configured the support panel stays hidden', unset.panelHidden===true);
check('...and no offer link is shown', unset.linksHidden===true);
check('...and none of them points anywhere yet', unset.noDeadHrefs===true);

/* ---- 3. configured: the ask appears, is earned, and is safe ---- */
const conf = await p.evaluate(async () => {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const URL='https://accountability.lemonsqueezy.com/checkout/buy/TEST-VARIANT';
  // brand-new user first: nothing logged, nothing kept
  state.transactions=[]; state.impulse=[]; save();
  const sp=document.getElementById('supportPanel');
  const reveal=()=>{
    sp.style.display='none';
    const logged=(state.transactions||[]).length, kept=impulseSaved();
    if(logged>=20||kept>0){ sp.style.display=''; return true; }
    return false;
  };
  const cold=reveal();
  // now a user the app has actually served
  state.impulse=[{id:'i',type:'skip',name:'Sneakers',amount:140,date:'2026-08-10'}]; save();
  const warm=reveal();
  const a=document.querySelector('#supportPanel [data-offer="support"]');
  a.href=URL; a.style.display='';
  return { cold, warm, href:a.getAttribute('href'),
           target:a.getAttribute('target'), rel:a.getAttribute('rel'),
           label:a.textContent.trim(),
           copy:document.getElementById('supportPanel').textContent };
});
check('a brand-new user is never asked to pay for a promise', conf.cold===false);
check('...but someone it has actually served sees the ask', conf.warm===true);
check('the checkout link opens safely in a new tab', conf.target==='_blank' && /noopener/.test(conf.rel||''),
      `${conf.target} ${conf.rel}`);
check('...and points at the configured checkout', conf.href.includes('lemonsqueezy.com/checkout/buy/'), conf.href);
check('the ask says nothing unlocks, so nobody buys a lock', /nothing unlocks/i.test(conf.copy));
check('...and states the model: no ads, no subscription, no affiliates',
      /no ads/i.test(conf.copy) && /no subscription/i.test(conf.copy) && /affiliate/i.test(conf.copy));
check('...and never claims the app can see your numbers',
      /does not see your numbers/i.test(conf.copy));
/* the app must not beg - one ask, no repetition, no guilt verbs */
check('the ask is not written as a plea',
      !/please|help us|we need|support us|donate/i.test(conf.copy), conf.copy.slice(0,120));
await p.close();
await b.close();

console.log('FUNNEL - one honest ask, reached by a link and never by a script\n');
let fails=0;
for(const r of results){ if(!r.ok) fails++; console.log(`${r.ok?'ok  ':'FAIL'}  ${r.name}${r.detail?'\n        '+String(r.detail).replace(/\n/g,' ').slice(0,160):''}`); }
console.log(`\n${results.length-fails} of ${results.length} hold`);
console.log('page errors:', errs.length?errs:'none');
if(fails) process.exit(1);
