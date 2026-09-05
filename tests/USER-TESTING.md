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

### The one that kept getting reported: a category that arrives empty

Three earlier rounds of *"it did not load onto her phone"* were transport
problems - a locked vault sending nothing. This one was not, and it hides in
plain sight because the category **does** arrive. Only the money is missing.

Run this with both phones on **Vault active** and the same month open:

1. On A, create a new category and assign it a real amount. Say `Sam's Club`,
   `$50`.
2. On B, in the **same month**, change some *other* category's assignment. Any
   one, any amount. This is the step that used to cause the damage, and it is
   also the most ordinary thing two people sharing a budget do.
3. Wait about twenty seconds, or reopen the app on each phone.
4. On B, `Sam's Club` should be there **with $50 in it**. On A, B's change
   should be there too, and every other assignment A made should be untouched.

What went wrong before: B's copy of the whole month's budget overwrote A's, so
`Sam's Club` landed with nothing in it and A silently lost every assignment made
since the last sync. An empty category looks exactly like a category that never
arrived, which is why it read as sync being broken four times running.

Worth checking at the same time, since they share the mechanism:

- Clear an assignment to zero on one phone. It must **stay** cleared after the
  other phone syncs, rather than being restored from the older copy.
- Set the **carried-in balance** for a month on one phone. It should reach the
  other without disturbing any other month's.

If a category still arrives empty, say which phone assigned it, which phone is
missing it, and what **Last sent** reads on the phone that made the change - the
Household panel prints it. That last line separates "never sent" from "sent and
lost", and they have opposite fixes.

### Clean: is anything missing that should not be?

The app now opens in **Clean**: panels show what they do, and the explanation
sits behind a small **?** next to each heading. Settings shows
`2026-09-03 · clean screens`, and **Settings -> How much it explains** switches
between Clean, Brief and Full at any time.

Automated checks prove no calculated figure and no empty state was moved off the
screen. What they cannot prove is whether a screen still makes sense to someone
who has not read the manual. That is what this pass is for.

Walk every tab and, on each one, ask only these:

1. **Can you tell what the screen is for without tapping anything?** If a panel
   is now just a heading and a form with no idea what it does, that panel needed
   a word or two on it and did not get to keep them. Note which one.
2. **Is the ? where you expect it?** It should sit beside the heading of the
   thing it explains, every time, and never anywhere else.
3. **Does the sheet answer the question you had?** The title should name the
   panel you asked from, and the text should be the same words that used to sit
   underneath it - not a summary.
4. **Did anything you need disappear?** Empty states ("Nothing yet..."),
   error messages, running totals and anything with a figure in it are supposed
   to stay on the panel. If one of those went behind a **?**, that is a bug and
   worth reporting with the tab name.

Then flip to **Full** in Settings and back to **Clean**. Everything should come
back and go away again, with nothing left behind and no duplicate **?** anywhere.

The one screen deliberately left alone is **Learn**: on that tab the reading is
the point, so the lesson text stays where it is.

### Home: is the right stuff still on it?

Home should now be about two phone screens instead of five. Settings shows
`2026-09-03 · Home cut down`.

What should still be **on** Home, without tapping anything: the hero, **Do this
next**, your money cards, the note explaining a negative "left to budget" with
its two buttons, and **Cover First**.

Everything else is in one card at the bottom, **More on your money**, with a row
for each: your true hourly wage, Household, Your evolution, Offense vs. Defense,
the "Enough" anchor, why you're here, your money story.

1. **Scroll Home top to bottom.** It should end at that card. If a panel you use
   constantly is now behind a row, say which - that is a judgement call and
   yours to make, not mine.
2. **Tap a row.** That panel opens underneath, fully working - type in it, press
   its buttons. Tapping another row swaps to it; tapping the open one shuts it.
3. **Check the rows are readable**, not washed-out grey. They were, briefly.
4. **Rows only exist when there is something behind them.** Turn Household off in
   Settings and its row should disappear from Home entirely, not open onto an
   empty panel.

Also worth a look, since it moved: the **☰** quick-glance handle is now on the
**right** edge instead of the left, where it was sitting on top of the first
letters of lines. Open a few sheets and confirm it is not covering any close
button, and that it disappears behind the dark backdrop while a sheet is open.

### One pattern everywhere: the pill

Settings shows `2026-09-03 · one pattern everywhere`. Every busy tab now ends in
one card of pills - Home, Plan, Track, Shield, Debt, Build, Diary and Settings -
and they all behave identically: tap a pill, that section opens below; tap
another, it swaps; tap the open one, it shuts.

Two tabs are deliberately left alone: **Reflect** is a single tool with its own
switcher inside it, and **Learn** is where the reading is the point.

Walk each tab and check:

1. **The tab opens on the thing you came to do.** Shield opens on the scan form,
   Debt on the payoff planner, Plan on the month. If a tab opens on nothing but
   a card of pills and you expected to do something immediately, say which.
2. **Every pill opens something real.** Type in it, press its buttons. Nothing
   should open onto an empty box.
3. **Nothing is stuck shut.** Anything that used to walk you somewhere - Freedom
   Mode sending you to your hourly rate, a payoff step sending you to a debt -
   should open the section it lands in, not scroll to a blank space. This is the
   part most likely to have a hole in it, so it is worth trying a few.
4. **Nothing is squeezed.** Open **Plan -> The month, laid out** and check the
   calendar cells are still big enough to tap, especially on a small phone.

The pill you have open is filled in and shows a `▴`; the shut ones are outlined
and show a `▾`.

### Does it sound different now?

Settings shows `2026-09-04 · voice back, sharing findable`.

Go to **Settings -> Voice & tone** and move the dial between **Forgiving**,
**Blunt** and **Savage**, then walk the tabs. What should change:

- the line under the title on Home
- the line over **Cover First**
- the sentence each tab opens with (Plan, Track, Shield, Debt, Build, Diary)
- the descriptions under **Do this next**

What should NOT change, and is worth checking as hard as the rest: **no button
should ever change its name.** `Add category` stays `Add category` at every
setting. If a control renames itself with the mood, that is a bug - tell me
which one.

Two things override the dial on purpose: anything about rent, medical or the
other essentials stays gentle even on Savage, and arithmetic explanations
("income minus assigned equals...") never change tone. If Savage starts
editing your sums, that is a bug.

The honest limit: about a fifth of what the app asserts moves with the dial.
If a screen still reads the same to you at both ends, name it and it gets wired.

### Setting up sharing, for the first time

With **We share this budget as a couple** on and sharing not yet set up, Home
and Plan should both carry a banner naming your partner - *"Sam cannot see any
of this"* - with one button.

1. **Tap it.** It should land you in Settings with the Household section already
   open and the sync panel on screen, not somewhere you have to hunt from.
2. **Set sharing up.** The banner should disappear from both tabs and not come
   back.
3. **Turn household mode off and on again.** The banner should follow.

This is the path your wife's phone takes too, from the other side. If the button
lands on an empty box or a section you still have to open yourself, that is the
bug worth reporting - it has been that twice already.

### Reading a statement, after the balance-column fix

Settings shows `2026-09-04 · voice, sharing, balance column`.

Photograph a page of your statement - **several pages at once now works, and so
does taking one shot, then another**. The pages appear numbered in the order they
will be read.

What to check against the paper:

1. **Count the rows.** Five transactions on the page should give five rows. If
   you get ten, the running-balance column is being read as transactions again.
2. **Look for your balances.** No row should carry a figure that is your account
   balance rather than an amount. Those were the `$5,311.75` rows.
3. **Check the names.** Anything the reader could not make out should come
   through blank with the amount filled in, not as scrambled characters. A blank
   is honest; `== 2° Nf 2°. G&G)` is not.
4. **Check nothing was lost.** Every amount on the paper should appear exactly
   once. The note above the rows says how many it read and how many it could
   name.

The balance column is only dropped when the arithmetic proves it - each balance
being the next one minus the amount between. A statement with no balance column
should come through completely untouched, so if you use a bank that lists only
amounts, nothing here should change for you.

### Put-aways that had nowhere to sit

Settings shows `2026-09-04 · put-aways land in their category`.

If you logged money into savings or investing using **→ Put away (savings or
investing)**, those entries have no category on them. Open **Plan**: a box near
the top should say how many there are and what they total, with a picker of your
savings and investing categories and one button.

1. **Pick Acorns and file them.** They should land on the Acorns line, roll up
   into Investing, and the box should disappear.
2. **Check the Plan column.** Switch it to **Spent** - Acorns should now show the
   total, tagged as put away rather than spent. It is still your money and net
   worth should not move, because it was already counted there.
3. **Log a new one categorised to Acorns.** You should no longer need to pick
   "Put away" at all - choosing Acorns records it as money put away, in Acorns,
   because Acorns lives under Investing.

Nothing was ever duplicated and nothing was lost - the entries were filed under
nothing, which is why the Plan line read $0 while the money had clearly moved.

If a savings or investing category of yours does **not** appear in that picker,
tell me its name: it means the app has not recognised its group as a growth
category, and that is a one-line fix.

### Carrying in what you actually mean

Settings shows `2026-09-04 · carry what you choose`.

On **Plan**, the button under the left-to-budget note no longer offers your whole
net worth. Tap it and you get a list of your accounts:

1. **Check what starts ticked.** Chequing and cash, yes. Savings, retirement and
   anything you have put away, no. A credit card should not be in the list at
   all - that is money you owe.
2. **Tick and untick.** The figure at the bottom should move as you go, before
   you commit anything.
3. **Check the subtraction.** If you have already logged income this month, it
   comes off the total, so the same dollars are never counted twice.
4. **Commit it.** Left to budget should stop being permanently negative, and
   **Income** should still show only what you actually logged - carried-in money
   is money you already had, not money you earned this month.

Do this on **Home** as well as **Plan**. The same note is drawn on both, and
until now tapping it on one opened the picker on the other.

### The month turning over

If you leave the app open on your phone for days, it should notice when the
calendar moves. **Your evolution** on Home should say **Now · Sep** in September,
not Now · Aug, and the table should have a row for each month. If it is stuck on
an old month, tell me - it means the app is not noticing the rollover on your
device even after this.

### And the pill that did nothing

On **Shield**, **What you've told me** should open when you tap it. If you have
never talked anything through, the pill should not be there at all rather than
being there and dead.

### Show the work, on an account

Settings shows `2026-09-04 · the working is actionable`.

Open **Build → Accounts**, expand **Show the work** on an account with a lot of
entries behind it:

1. **The tail is a button.** "Show the other 16 ↓" should unroll the rest right
   there, and offer to fold them back. It should no longer just tell you they
   are on Track.
2. **Every row opens.** Tap one - the entry should open so you can fix its name,
   amount, date or category without leaving.
3. **Anything unreadable says so.** An entry whose name came out as symbols
   should read **Needs a name** rather than printing the symbols. Tap it and
   give it one.
4. **The equation fits.** The line above the rows should end on a complete
   figure. If it is cut off mid-number on your phone, that is a bug worth
   reporting - it is the one number in the app that must never be truncated.

If a row you can read perfectly well says "Needs a name", tell me what it says -
it means the test is too strict and is throwing away something legitimate.

### The equity badge

Settings shows `2026-09-04 · the badge names its own figure`.

On **Debt**, any loan with a value on the thing behind it (a mortgage, a car)
shows an equity figure and a percentage. Read the whole line out loud:

- With equity: **"$132,000 equity - 62.9% of it is yours"**. That should be true
  when spoken. The old line said 37.1%, which was your *loan*, and it read as
  though you owned barely a third of your own house.
- Underwater: **"$5,000 underwater - owe 135.7% of its value"**. Here the
  loan-to-value is the right number, and it says it is the loan.

Worth checking anywhere else a percentage sits next to a dollar figure, on any
tab. Each badge should say what it is a share of - used, yours, owe, left,
covered. If you find one that just says a bare percentage and leaves you to
infer, that is the same bug in a different place, and it is worth telling me.

### Two tabs on the plan, not three

Settings shows `2026-09-04 · two tabs, and what is left under both`.

On **Plan**, the switch above the list is now **Planned / Spent**. Remaining is
gone, because the figure it showed was already printed under the field in
Planned, so it was a tab offering less than the tab you were standing on.

What to check:

- **Nothing went missing with it.** Tap **Spent**. Every row that has money
  assigned should still show what is left underneath the spent figure, exactly
  as Planned does. If you can see what has gone but not what remains, the
  removal cost you something and I need to know.
- **If you were sitting on Remaining**, the app should open on Planned by
  itself. It should not open blank, and it should not lose your categories.
- **The Spent number should look like a number**, not like a caption. It was
  drawing at the same size and grey as the small print underneath it - a CSS
  rule from elsewhere in the file had been quietly winning for a long time. The
  big figure should be dark and bold, the "$419.40 left" under it small and
  muted.
- **The money column should not move when you switch tabs.** Put a thumb beside
  it, tap between Planned and Spent, and watch the left edge of the figures. It
  used to jump about 19px. If it still shifts, say so.
- Worth a look on your **narrowest** screen and with a **long** number in it
  (a category with $1,000+ left). The hint is set not to wrap, so if it collides
  with the category name or runs off the edge, that is a real report.

### Nothing goes below zero

Settings shows `2026-09-04 · no quantity goes below zero`.

Nobody reported this - a test found it by typing `-5` into every number field in
the app and asking what stuck. Four of them kept it.

Worth a minute if you want to see it gone:

- **Settings, hourly wage.** Type `-5`. It should land on `0`, not `-5`. Then
  put your real wage back.
- Same for a **partner's wage** if the household split is on, the **spending
  limit** in spend mode, the **debt budget** on the payoff planner, and the
  **amount** and **rate** on the leverage panel.
- The one that is *meant* to accept a negative is the **expected return** on
  leverage. An investment that loses money is a real thing to plan for, and the
  screen should not refuse it.

If a figure anywhere reads as negative hours - *"-3.4 hrs of your life"* - that
is this bug still alive somewhere I did not find, and it is worth telling me.

### A monthly plan on weekly pay

Settings shows `2026-09-04 · the month counts the paydays still coming`.

This is the one you reported. **Left to budget** was comparing money that had
arrived against a plan for the whole month, which for weekly pay reads negative
for most of the month and only comes true on the last payday.

On **Home**, the note under the cards should now read three parts, not two:

> Already in the account **$2,983.42** + logged this month **$1,230.23** + still
> due this month **$3,690.69** (3 more paydays on your rules) = **$7,904.34** to
> budget - assigned **$6,624.21** = **$1,280.13** still waiting for a job.

What to check, and what would be a real report:

- **The payday count is right.** It says how many it is counting. Count your own
  remaining paydays this month. If it says 3 and you have 2 left, tell me - a
  plan told it has money that is not coming is the worst failure this could have.
- **It should not count a payday you never got.** If a paycheck was due on the
  1st and never landed, the app should NOT quietly assume it. It only counts
  dates after today.
- **It should not count one twice.** If you log a paycheck ahead of its date,
  the total should not jump.
- **A finished month** should show no "still due" line at all.
- If you have **no recurring income rules** set up, nothing changes for you -
  the app will not guess a pay schedule it was never told.

### Net worth on Home

Same build. Your Net worth tile was showing **$507.20** while your bank showed
**$69,767.88** - Home was leaving the bank out of the sum entirely.

- Open **Home**. Net worth should now be roughly your bank, minus the cards,
  plus anything you own.
- Open **Reflect**. The net worth there should be **the same number**. It always
  used the correct definition, so the two disagreed. If they still disagree, that
  is a real report.

### Choosing how your month counts money

Settings shows `2026-09-04 · the month counts the paydays still coming` or later.

You asked for this to be your choice rather than mine, and for irregular income
to be handled honestly. Both are in.

**In Settings**, under the household toggles, there are now two options:

- *Everything I expect this month, including paydays still to come*
- *Only what I actually hold right now*

The line underneath tells you which is running and **how it got there**. Before
you pick, it says "Not chosen yet, so this is read from your setup". After you
pick, it says "Your choice". If it ever says "Your choice" when you never chose,
that is a real report.

**In the note on Home or Plan**, the other mode is offered in one tap, with the
amount named - *"Count the $3,690.69 still due this month →"* or *"Only count
what I actually have →"*. It only appears when the two modes would actually
print different numbers.

Worth checking:

- **Switch between them and watch the figure.** The difference should be exactly
  the paydays still ahead, nothing else.
- **Your choice should stick** through closing and reopening the app, and should
  not quietly revert.
- **If you sync with your wife**, this travels with the rest of the settings, so
  you should both be looking at the same kind of month.

### If your income is irregular

If you have **no repeating income set up** - tips, commission, shifts that vary -
the app will not guess a pay schedule it was never told. A month counts what you
carried in plus what actually landed, and when the plan looks short it says so
in as many words rather than leaving you to wonder what you configured wrong.

Turning on *"everything I expect this month"* in that situation should change
**nothing at all**, because there is nothing to project. If it changes a figure,
that is money the app invented and I want to know immediately.

### Every section explains itself on tap

Settings shows `2026-09-05 · every section explains itself on tap`.

You asked for the Acorns pattern - a small mark next to a heading that opens a
card with the explanation, so the screen itself stays short. The app already had
it; it was reaching almost none of the text.

What to look for:

- A small **?** sits beside section headings. Tap it and a card slides up,
  titled with that section's name, holding the words that used to be on screen.
- **Home should be noticeably shorter.** The line under the big heading, and the
  Four Walls line, are both behind taps now.
- **Debt and Learn should be much shorter** where a panel is waiting to unlock.
  You should still see the sentence saying what unlocks it - if that line has
  gone, that is a real report.

Three things I left on screen on purpose. Tell me if you disagree with any:

1. **The left-to-budget note** on Home and Plan - the "$X + $Y = $Z to budget"
   arithmetic. That is about your numbers, not a lesson, and a plan whose
   explanation needs a tap reads like an accusation with no reason given.
2. **The one-liners under each "More" row.** Seven words telling you what the
   pills below are beats tapping to find out.
3. **Learn's lesson text.** Learn is where you go to read.

If any section still shows a paragraph you would rather tap for, tell me which
heading it sits under and I will move it.
