# Supabase, and what the app actually asks of it

The server is **blind**. Your budget is encrypted on the device with AES-256-GCM
under a key derived from your Sync Passphrase (PBKDF2, 210,000 iterations), and
only the ciphertext envelope ever leaves. Supabase stores a string it cannot
read, and neither can anyone with access to the database - including you.

That is the constraint every line below is written against. **Nothing in this
file puts a readable financial figure on a server**, and nothing should be added
that does.

---

## Run this once

Paste into the Supabase dashboard, SQL Editor. Safe to run more than once.

### 1. The vault (you may already have this)

```sql
create table if not exists public.user_vaults (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  encrypted_payload text not null,
  updated_at        timestamptz not null default now()
);

alter table public.user_vaults enable row level security;

drop policy if exists "own vault" on public.user_vaults;
create policy "own vault" on public.user_vaults
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### 2. Instant updates instead of a poll every 15 seconds

```sql
alter publication supabase_realtime add table public.user_vaults;
```

That is the whole change. The app subscribes to its own row and pulls the
moment it moves. **The server still only signals that the row changed** - it has
no idea what is in it, and the device does the decrypting exactly as before.

If you skip this, nothing breaks: the app falls back to checking every 15
seconds, and the Settings panel says which of the two you are getting.

### 3. Version history, so a bad sync is undoable

```sql
create table if not exists public.vault_versions (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  encrypted_payload text not null,
  created_at        timestamptz not null default now()
);

create index if not exists vault_versions_user_time
  on public.vault_versions (user_id, created_at desc);

alter table public.vault_versions enable row level security;

drop policy if exists "own versions" on public.vault_versions;
create policy "own versions" on public.vault_versions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Keep it bounded server-side rather than trusting the client to tidy up:

```sql
create or replace function public.prune_vault_versions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.vault_versions
   where user_id = new.user_id
     and id not in (
       select id from public.vault_versions
        where user_id = new.user_id
        order by created_at desc
        limit 20
     );
  return null;
end $$;

drop trigger if exists trg_prune_vault_versions on public.vault_versions;
create trigger trg_prune_vault_versions
  after insert on public.vault_versions
  for each row execute function public.prune_vault_versions();
```

**Why this exists.** The push is an `upsert` - it overwrites the one row, and
what was there is gone. This app has already shipped a merge bug once that
swallowed a partner's month of budgeting, and under the old design that was
unrecoverable. Twenty versions is a couple of weeks of ordinary editing and a
few hundred kilobytes of ciphertext.

Filing a version can never block a push. If these tables do not exist, the
insert fails silently and your budget still syncs.

---

## What is deliberately NOT here

- **No statement photos in Storage.** The app promises the scan is read on your
  device and never uploaded. That promise is worth more than the convenience,
  and it cannot be un-broken once it is.
- **No plaintext financial rows.** Row-level security protects you from other
  users. It does not protect you from a breach, a misconfigured policy, or
  anyone with database access. Ciphertext-only is what makes "even we cannot
  read your money" a fact rather than a slogan.
- **No analytics that profile spending.** Same reason.

## Worth checking yourself

Two things nobody can verify from a development machine, because the network
there cannot reach Supabase at all:

1. **Does the round trip actually work between two real phones?** Sign in on
   both, change a category on one, watch the other. The dashboard's Logs will
   show whether the requests arrive and what RLS decided.
2. **Can a signed-in user read only their own rows?** Worth confirming against
   the policies above rather than assuming.

## Still to come, and why it is waiting

**Join codes and anonymous sign-in.** Right now both partners sign in to the
*same* account, which is why the vault is keyed on `user_id`. Anonymous auth
gives each person their own id and would show them an empty vault, so making
join codes work needs a household/membership table and new policies. That is a
schema change to a sync round trip that has not yet been confirmed working on
two devices - the wrong order. It waits for step 1 above.
