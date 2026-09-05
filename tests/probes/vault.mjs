/* Realtime + vault history, driven against a FAKE Supabase client.
   The network here cannot reach *.supabase.co at all, so the choice is between
   testing the logic against a stand-in and testing nothing. The stand-in is
   deliberately hostile in places: it can refuse an insert, it can report a
   channel error, and it can be an SDK too old to have channel() - because those
   are the states a real household will actually meet, and each one must leave
   the sync working rather than broken. */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:390,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
p.on('dialog',d=>d.accept());
await p.goto('file://'+process.cwd()+'/app.html'); await p.waitForTimeout(400);
await p.evaluate(()=>localStorage.setItem('unfiltered_budget_v2',JSON.stringify({
  onboarded:true,activeMonth:'2026-09',uiMode:'all',stageReached:3,guidesOff:true,sayMode:'brief',
  householdOn:true, syncOptIn:true,
  categories:[{id:'roof',name:'Roof'}],budgets:{'2026-09':{roof:1200}},
  transactions:[],accounts:[],assets:[],goals:[],recurring:[],impulse:[],liabilities:[],
  debts:[],diary:[],intake:{},lessons:[],vault:[]})));
await p.reload(); await p.waitForTimeout(1000);

const o=await p.evaluate(async()=>{
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const out={};
  /* ---- the stand-in ---- */
  const mk=(opts={})=>{
    const rows={user_vaults:[], vault_versions:[]};
    let nid=1;
    const api={rows, subs:[], channels:0, unsubs:0, lastStatus:null};
    const q=(table)=>{
      const st={table, filters:[], _order:null, _limit:null};
      const self={
        select(){ return self; },
        eq(c,v){ st.filters.push([c,v]); return self; },
        in(c,vs){ st.filters.push([c,vs,'in']); return self; },
        order(){ return self; }, limit(n){ st._limit=n; return self; },
        async maybeSingle(){ const r=api._find(st); return {data:r[0]||null,error:null}; },
        async insert(row){ if(opts.refuseInsert) return {error:{message:'relation "public.vault_versions" does not exist'}};
          rows[table].push({...row,id:nid++,created_at:new Date(Date.now()+nid*1000).toISOString()}); return {error:null}; },
        async upsert(row){ const i=rows[table].findIndex(r=>r.user_id===row.user_id);
          if(i<0) rows[table].push({...row}); else rows[table][i]={...rows[table][i],...row}; return {error:null}; },
        async delete(){ return { in:(c,vs)=>{ rows[table]=rows[table].filter(r=>!vs.includes(r[c])); return Promise.resolve({error:null}); } }; },
        then(res){ const r=api._find(st); return Promise.resolve({data:r,error:null}).then(res); }
      };
      /* delete() is called as .delete().in(...) in the app */
      self.delete=()=>({ in:async(c,vs)=>{ rows[table]=rows[table].filter(r=>!vs.includes(r[c])); return {error:null}; } });
      return self;
    };
    api._find=(st)=>{ let r=rows[st.table].slice();
      st.filters.forEach(([c,v,op])=>{ r = op==='in' ? r.filter(x=>v.includes(x[c])) : r.filter(x=>x[c]===v); });
      r.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
      return st._limit?r.slice(0,st._limit):r; };
    const client={
      from:(t)=>q(t),
      auth:{ getSession:async()=>({data:{session:{user:{id:'u1'}}}}), signOut:async()=>({}) }
    };
    if(!opts.noChannel){
      client.channel=(name)=>{ api.channels++;
        const ch={ on(){ return ch; },
          subscribe(cb){ api.lastCb=cb; setTimeout(()=>cb(opts.status||'SUBSCRIBED'),10); return ch; },
          unsubscribe(){ api.unsubs++; } };
        return ch; };
    }
    return {client, api};
  };
  const install=(m)=>{ _sbClient=m.client; };

  /* ---- 1. realtime connects, and the poll slows rather than stops ---- */
  let m=mk(); install(m);
  syncPass='pass-one'; syncActive=true;
  await syncRealtimeStart(); await w(120);
  out.live=syncLive; out.channels=m.api.channels; out.pollAfterLive=!!syncPollTimer;

  /* ---- 2. a channel that errors falls back rather than failing ---- */
  m=mk({status:'CHANNEL_ERROR'}); install(m);
  await syncRealtimeStart(); await w(120);
  out.errLive=syncLive; out.errPoll=!!syncPollTimer;

  /* ---- 3. an SDK with no channel() at all still receives ---- */
  m=mk({noChannel:true}); install(m);
  const okOld=await syncRealtimeStart(); await w(80);
  out.oldSdkReturned=okOld; out.oldSdkLive=syncLive; out.oldSdkPoll=!!syncPollTimer;

  /* ---- 4. pushing files a version, and history reads back ---- */
  m=mk(); install(m); syncLive=false;
  await pushToVault('pass-one');
  state.categories.push({id:'x',name:'Second'}); 
  await pushToVault('pass-one');
  out.vaultRows=m.api.rows.user_vaults.length;      // one row, upserted
  out.versions=m.api.rows.vault_versions.length;    // one per push
  const list=await vaultVersions();
  out.listed=list.length;
  out.ciphertextOnly = m.api.rows.vault_versions.every(r=>{
    const s=String(r.encrypted_payload||'');
    return !/Second|categories|roof/.test(s) && /"alg":"AES-GCM"/.test(s);
  });

  /* ---- 5. restore puts an earlier version back, and files the current one ---- */
  const before=m.api.rows.vault_versions.length;
  const oldest=m.api.rows.vault_versions.slice().sort((a,b)=>a.id-b.id)[0];
  await vaultRestore(oldest.id);
  out.afterRestoreHasSecond=(state.categories||[]).some(c=>c.name==='Second');
  out.filedBeforeRestore=m.api.rows.vault_versions.length>before;

  /* ---- 6. a missing vault_versions table must not break the push ---- */
  m=mk({refuseInsert:true}); install(m);
  let pushed=false;
  try{ pushed=await pushToVault('pass-one'); }catch(_){ pushed=false; }
  out.pushSurvivesNoHistory=pushed===true && m.api.rows.user_vaults.length===1;
  out.noVersionsFiled=m.api.rows.vault_versions.length===0;

  syncActive=false; syncPass=null; syncListenStop();
  return out;
});
await b.close();

const T=[
  ['realtime subscribes to the household row', o.live===true && o.channels===1, JSON.stringify(o)],
  ['...and the poll stays up underneath it as the safety net',
   o.pollAfterLive===true, String(o.pollAfterLive)],
  ['a channel that errors falls back to polling instead of going quiet',
   o.errLive===false && o.errPoll===true, JSON.stringify({live:o.errLive,poll:o.errPoll})],
  ['an SDK too old for channel() still receives changes',
   o.oldSdkReturned===false && o.oldSdkLive===false && o.oldSdkPoll===true,
   JSON.stringify({ret:o.oldSdkReturned,live:o.oldSdkLive,poll:o.oldSdkPoll})],
  ['every push files a version, while the vault stays one row',
   o.vaultRows===1 && o.versions===2, JSON.stringify({rows:o.vaultRows,versions:o.versions})],
  ['...readable back as a list to choose from', o.listed===2, String(o.listed)],
  ['...and what is filed is ciphertext, never a readable budget',
   o.ciphertextOnly===true, String(o.ciphertextOnly)],
  ['restoring an earlier version replaces the current one',
   o.afterRestoreHasSecond===false, String(o.afterRestoreHasSecond)],
  ['...after filing the current one, so restoring is not a one-way door',
   o.filedBeforeRestore===true, String(o.filedBeforeRestore)],
  ['a missing history table cannot stop a budget from syncing',
   o.pushSurvivesNoHistory===true && o.noVersionsFiled===true,
   JSON.stringify({pushed:o.pushSurvivesNoHistory,none:o.noVersionsFiled})],
];
let bad=0; for(const [n,ok,d] of T){ if(!ok) bad++; console.log(`${ok?'ok  ':'FAIL'}  ${n}${ok?'':'\n        '+d}`); }
console.log(`\n${T.length-bad} of ${T.length} hold`);
console.log('page errors:', errs.length?[...new Set(errs)].join(' | '):'none');
process.exit(bad?1:0);
