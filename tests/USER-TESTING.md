# Watching five strangers (the part no test can do)

Every failure found so far by real people - "what's 3200?", no review screen,
the invest entry vanishing - had **correct arithmetic underneath**. The math
harness cannot catch a single one of them. This is how you find the rest.

## The rule
**Say nothing.** Not one hint, not one "you just need to tap there". The moment
you explain something, that person is spent as a tester and you have learned
only that *you* understand your own app. Their confusion is the finding.

## Who
Five people who have never seen it. Not you, not anyone who has watched you
build it. Ideally a mix: someone who budgets already, someone who avoids
looking at money at all, someone over 55, someone under 25, someone who runs a
household with a partner.

## Setup
Hand them a phone with a clean install (clear the site data first - a returning
user sees a different app). Open the landing page, not `app.html`. Then read
this once, verbatim:

> "I'd like you to set this up as if it were your own money. Say out loud what
> you're thinking - including when something is confusing or annoying. I'm not
> going to help, and that's not me being difficult - if you get stuck, that's
> the app's fault and it's exactly what I need to see. Nothing you do is wrong."

Then stop talking. Let silences run. If they ask a question, answer with
"what do you think it does?" and note the question - **every question they ask
is a piece of missing copy.**

## What to write down
Not opinions. Behaviour.

- **Where their thumb hovers before it lands.** Hesitation = unclear affordance.
- **Every number they read out loud and get wrong.** ("So I've overspent by
  two thousand?" when it means income isn't logged yet.)
- **Every word of your vocabulary they cannot define.** Scroll Trap, Four Walls,
  Life-hours, War Chest, Freedom Runway, Sovereignty, zero-based.
- **Where they stop.** The step they abandon is the step to cut or rewrite.
- **What they expect to happen that doesn't.** ("I thought that would save it.")
- **Anything they type that you did not anticipate** - a category name, a why,
  a number in the wrong unit.

## Tasks, in order
Give one at a time. Do not read ahead.

1. "Set it up however fits you." (Just this. Watch the whole intake.)
2. "You just got paid. Put that in."
3. "You spent $40 at the grocery store this morning. Record that."
4. "You're thinking about buying something for $200. Use the app to decide."
5. "How much do you have in the bank, according to this?"
6. "You pay $14 a month for something you forgot about. Find it and deal with it."
7. "Tell me what this app thinks about your money right now."

Task 7 is the real test. If they can't summarise their own position after
using it, the dashboard has failed no matter how correct the numbers are.

## Afterwards
Three questions only:
- "What would you tell a friend this app is for?"
- "What was the most annoying part?"
- "Would you open it again tomorrow? Honestly - I'd rather know."

## Reading the results
- **Three or more people hitting the same confusion is a bug**, not a
  preference. Fix it before release.
- **One person hitting it** is worth noting, not necessarily fixing.
- If nobody completes setup unaided, do not release. Fix and re-run with five
  new people (the old five are now experts and useless as testers).

## Before you call it releasable
- [ ] `node tests/math_audit.mjs 400` - no invariant violated
- [ ] `node tests/math_edges.mjs` - every case clean
- [ ] `node tests/math_golden.mjs` - all figures match
- [ ] `node tests/math_claims.mjs` - all claims verified
- [ ] Five strangers, five clean installs, no help given
- [ ] At least three of them complete setup and can answer task 7
- [ ] Tried on a real iPhone AND a real Android, not just a desktop browser
- [ ] Backup exported, cache cleared, backup restored, numbers identical

## Household Sync - the round trip only a human can run

The build environment refuses outbound HTTPS to `*.supabase.co` and to
`cdn.jsdelivr.net`, where the Supabase SDK loads from. No sign-up, push or pull
has ever been executed by the suite, and none can be. Everything below has to be
done by a person, on a machine with an open network.

**Two separate browser profiles, not two tabs** - the session and the vault
passphrase are per-profile, and two tabs share both, which would make a broken
join look like a working one.

1. **Profile A** - Build → Household Sync → *Set up Household Sync* → email and
   a password → create a Sync Passphrase → expect **Vault Active**.
2. **Profile B** - same panel → *Link to an existing vault* → the same email,
   password and passphrase → expect A's budget to appear.
3. Change a figure in A, reload B, confirm it moved.

Three things are most likely to bite, in this order:

- **Email confirmation is still on.** Supabase requires it by default. `signUp`
  succeeds, no session is created, and the vault is never written - so step 1
  looks like it worked and step 2 finds nothing. Authentication → Sign In /
  Providers → Email → uncheck **Confirm email**.
- **`user_vaults` was never created.** The SQL lives in the code comment above
  `SUPABASE_URL`. Without the table, push fails on a table that does not exist.
- **Key format.** The project uses a `sb_publishable_...` key, which needs a
  recent `supabase-js`. The CDN URL is unpinned (`@supabase/supabase-js@2`) so it
  should resolve new enough, but that is an assumption, not a tested fact.

Record the exact error text if it breaks. "It didn't work" cannot be acted on;
`relation "public.user_vaults" does not exist` can.

### After the merge change: does one partner still erase the other?

The merge itself is proven by `syncmerge` without a network. What a person still
has to check is that the vault round-trips at all, and that the two phones
converge rather than ping-pong.

With both profiles linked and **Vault active** on each:

1. In A, log an expense. In B - *without reloading first* - edit an account
   balance. Wait about twenty seconds.
2. Both should end up on both phones: A's expense and B's balance. Before this
   change, whichever synced second erased the other's work.
3. Delete something in A. Confirm it does not come back on B, and does not
   reappear on A after the next check.
4. Open **Household Sync** on either phone. The **Changes** list should name
   both of you, with the right times.

If entries duplicate rather than merge, the ids are being regenerated somewhere
and that is worth reporting. If one side keeps winning, note which phone and
what its clock says - the tie-break is by timestamp, and a device with a badly
wrong clock will always look "newer".
