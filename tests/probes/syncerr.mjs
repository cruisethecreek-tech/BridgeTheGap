/* A real setup attempt showed the panel saying "Email signups are disabled" -
   Supabase talking to a developer, printed verbatim to somebody trying to share
   a budget with their wife. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
let pass=0, fail=0;
const ok=(n,c,d='')=>{ if(c){pass++;console.log('ok    '+n);} else {fail++;console.log('FAIL  '+n+(d?'\n        '+String(d).replace(/\n/g,' | ').slice(0,300):''));} };
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const pg=await b.newPage({viewport:{width:390,height:1000}});
pg.on('pageerror',e=>console.log('PAGEERROR',String(e)));
await pg.goto('file://'+process.cwd()+'/app.html');
await pg.evaluate(()=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify(
 {onboarded:true,uiMode:'all',stageReached:3,guidesOff:true,householdOn:true,activeMonth:'2026-09',
  categories:[],budgets:{},transactions:[],goals:[],impulse:[],recurring:[],accounts:[],assets:[],
  liabilities:[],diary:[],intake:{},lessons:[],debts:[],vault:[],snapshots:[],scans:[],opening:{}})));
await pg.reload(); await pg.waitForTimeout(900);

const r = await pg.evaluate(() => {
  const t=m=>syncPlainErr(new Error(m));
  return {
    signup:t('Email signups are disabled'),
    dupe:t('User already registered'),
    creds:t('Invalid login credentials'),
    unconf:t('Email not confirmed'),
    table:t('relation "public.user_vaults" does not exist'),
    net:t('Failed to fetch'),
    pass:t('Wrong passphrase, or the vault is damaged.'),
    unknown:t('Some brand new server problem nobody mapped'),
    empty:t('') };
});
/* the reported one, and the thing it must now tell you */
ok('a server error is rewritten in plain words the app would use',
   /not accepting new accounts yet/.test(r.signup) && !/^Email signups are disabled/.test(r.signup),
   r.signup.slice(0,110));
ok('...with the next step named, not just the problem',
   /Sign In \/ Providers/.test(r.signup) && /allow new users to sign up/.test(r.signup), r.signup.slice(0,180));
/* the discipline that matters: translating must not destroy the evidence */
ok('...and the raw text is kept, because that is what a bug report needs',
   /se-raw/.test(r.signup) && /Email signups are disabled/.test(r.signup), r.signup.slice(-90));
ok('an existing account is pointed at the door it should have used',
   /Link to an existing vault/.test(r.dupe), r.dupe.slice(0,90));
ok('a wrong password says which password it means',
   /if your partner set it up/.test(r.creds), r.creds.slice(0,110));
ok('an unconfirmed email explains why a working signup still cannot sign in',
   /never confirmed/.test(r.unconf), r.unconf.slice(0,110));
ok('a missing table points at the SQL rather than at the person',
   /vault table has not been created/.test(r.table), r.table.slice(0,110));
ok('a network failure says nothing was lost',
   /nothing has been changed or lost/.test(r.net), r.net.slice(0,110));
ok('a bad passphrase says it is not the account password',
   /not the account password/.test(r.pass), r.pass.slice(0,110));
/* an unmapped error must still reach the screen intact - swallowing it would be
   worse than printing server-speak */
ok('an error nobody mapped is still shown, verbatim',
   /Some brand new server problem/.test(r.unknown), r.unknown);
ok('...and nothing at all stays nothing at all', r.empty==='');

console.log(`\n${pass} of ${pass+fail} hold`);
await b.close();
process.exit(fail?1:0);
