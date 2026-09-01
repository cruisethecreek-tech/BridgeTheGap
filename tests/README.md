# Math audit

Layers, because each catches what the others cannot. Run all of them before any
public release.

```bash
node tests/math_audit.mjs 400        # property fuzz (optionally: <states> <seed>)
node tests/math_edges.mjs            # hostile inputs
node tests/math_golden.mjs           # hand-computed scenario
node tests/math_claims.mjs           # every money claim, hand-verified
node tests/budget_sim.mjs            # can a household actually budget with this?
node tests/palette.mjs               # every colour readable in both themes
node tests/life_units.mjs            # Freedom Mode says things that make sense
node tests/intake_cost.mjs           # the setup chat tells the truth about itself
node tests/talk_through.mjs          # understanding before labelling
node tests/structure.mjs             # one place to reflect, nothing shown too early
node tests/layout.mjs                # ten tabs, four phone widths, no text on text
node tests/funnel.mjs                # one honest ask, by link and never by script
node tests/hostile.mjs               # the inputs nobody thinks to supply
```

Requires a Chromium that Playwright can drive; the scripts point at
`/opt/pw-browsers/chromium` and are run from the repo root.

## Why `hostile.mjs` exists, and what it cannot do

Asked directly, after a bug reached a phone that 615 passing properties had not
caught: *"I'm not understanding how your audits don't catch this."*

The answer is structural and worth writing down. **Every other suite here is a
regression net.** Each section is named after something a person found, and the
property was written after the report. A net built that way documents history
and is permanently one report behind whoever is using the app. The fixtures make
it worse, because they get written from the working example: the recurring-source
fixture said `source:'Hollywood'` - already named - so the bug lived in the input
nobody thought to supply.

`hostile.mjs` is the one suite that does not know what the bugs are. It supplies
the inputs nobody thinks to supply, to every form, and asserts properties that
hold for all of them: nothing in, nothing invented; no impossible number reaches
your data; no impossible number reaches the screen; nothing throws.

Building it taught the same lesson twice, in miniature:

1. **v1 clicked every button with the form emptied and missed the bug it was
   written for**, because `recType` defaults to `expense` and the nameless
   source lives in the income branch. A fuzzer that leaves the dropdowns alone
   only ever exercises the path already known to work. So it walks every option
   of every select.
2. **v2 emptied every field at once and still missed it**, because an all-empty
   form is stopped by the first guard on the handler - "Enter an amount" - and no
   guard after it is ever reached. **A form with one hole in it** is the shape
   that finds the missing guard, and it is also the shape of what people actually
   do: they fill the form and miss a box. So it is leave-one-out: fill everything
   plausibly, blank exactly one field, submit, for every field on every branch of
   every form.

Only after both corrections did it find the bug on its own, with the fix
reverted:

```
FAIL  no form with one box left empty invents an identity for the record it creates
      addRec [recType=income] missing:recSrc INVENTED: transactions.source = "Income"
```

A third lesson came from the harness rather than the app. The first `reset()`
assigned a parsed fixture straight to `state`, and three page errors appeared
that no user could ever hit - because `load()` merges a stored state over
`defaultState()`, and skipping that door handed the app a shape that cannot
exist. **A harness that enters through a door the user cannot use reports faults
they cannot hit, and hides the ones they can.** It resets through `load()` now.

Against the fixed code it is 8 of 8 across **289 form submissions on 18 forms**,
with `tkSave` printed as still unreachable - it lives several steps into the
talk-through flow. That line is deliberate output rather than a silent skip: a
form nobody probed is not a form that passed.

**What this suite does not do.** It covers one class: input handling, invented
identity, impossible numbers. It would not have caught the ledger readout whose
two figures looked like they disagreed, or the assign field that was missing its
period picker for months. Those are faults of *meaning* and *absence* - the app
was arithmetically correct and said the wrong thing, or correctly did not say a
thing it should have. Nothing in this folder finds those. A person using the app
on a real phone finds those, and that is not a gap this suite can close.

## 1. `math_audit.mjs` - property fuzz
Generates hundreds of random but plausible app states (nested categories, mixed
transactions, accounts, recurring schedules on every frequency) and asserts
things that must NEVER be false, whatever the data:

- `netWorth = assets + bank - liabilities`
- `allTimeBalance = income - expense - invest`
- `monthExpense` contains no income or invest rows
- `catSpent(x) = own spend + every descendant's spend`
- `catAssigned(x) = max(own, sum of children)` at every level, nesting never past 3
- **Home and Plan report the identical "Left to budget"** (this exact bug shipped once)
- recurring occurrences stay inside their month, never precede the anchor, never
  duplicate, never exceed the month's length, and posting is idempotent
- nothing future-dated is ever posted into the current month
- the auto invest asset never exceeds holds-value contributions
- no `NaN`, `undefined` or `Infinity` reaches any rendered surface
- export -> import preserves every headline figure

A failure prints the seed, so any counterexample is reproducible.

## 2. `math_edges.mjs` - hostile inputs
The states a fuzzer rarely stumbles into: empty, enormous (9e12), negative
balances, fractional cents, leap days and month-end anchors (Jan 31 -> Feb 29),
legacy saves carrying none of the newer keys, and deliberately corrupt records
(string amounts, null values, orphaned parents, bad dates). Every case must
survive `normalizeState`, render all eight tabs, and show no `NaN`.

## 3. `math_golden.mjs` - hand-computed scenario
One realistic household, with the arithmetic written out longhand in the file so
a person with a calculator can confirm it. **This is the layer that proves the
app agrees with reality rather than merely with itself** - the invariants above
all passed while `essentialMonthly` was under-counting split categories, and only
the hand math caught it.

## 4. `math_claims.mjs` - the claims inventory
Every statement the app makes about a person's money, each with a value worked
out by hand (or by an independently written second implementation, noted
inline): budget figures, life-hours conversions, the true-rate and blended-wage
engines, debt payoff months and interest, the invest-vs-payoff comparison,
runway, the sovereignty metrics, recurring frequency conversions, membership
totals, the time ledger and the gut-check metrics.

**If the app tells a user a number, it belongs in this file.** Adding a
calculation without adding it here means shipping an unverified claim.

## 5. `budget_sim.mjs` - can a household actually budget with this?

Layers 1 to 4 answer "is the machine correct?" This one answers the only question
the app exists for. One household - two earners, three deposits, thirteen
categories nested two deep, a plan built to exactly zero - is run through a full
month, a rollover into the next, and the messy edits people actually make.

It asserts the properties a **budget** must have, not the properties a program
must have:

- zero-based is *reachable*, and reported as exactly zero
- money is conserved: assigned, spent and left agree on every screen
- the tree neither invents nor loses money, assigned **either direction** -
  bottom-up (fill the subs, the parent adds them up) and top-down (a pool split
  only partway, the remainder still there)
- a naive row-by-row sum over-reports by the split subs, which is why
  `catAssigned` exists
- overspending is reported honestly instead of quietly absorbed
- a paycheck posts once, however many times you press Post
- a partner's pay is the household's money, not a footnote
- a new month is a new budget, and Copy last month reproduces the plan intact
- deleting a category cannot unspend its money: the total holds and the orphaned
  spending surfaces as Uncategorized rather than vanishing from the chart
- **a real paycheck has cents**, and can still be assigned to exactly zero

The last two found live faults on the first run. Both were invisible to every
other layer because every other layer asks the app to check its own arithmetic,
and the app's arithmetic was right - it was the *budgeting* that was wrong:

1. Four screens judged "are your essentials covered?" by the parent category's
   own figure. A household that funded Food the way the app's own
   "Split into subcategories" flow teaches - $400 Groceries, $220 Eating out,
   printed on the Budget screen as "= $620" - was told on Home to go fund Food.
   Forever. Now every such question goes through one `wallAssigned()` helper.
2. The plan boxes were `step="1"` while the spend boxes were `step="0.01"`. You
   could spend $47.83 but never assign $1,047.83, so a household paid $3,247.83
   could not reach zero-based at all. And forty cents printed as `$0.4`.

## 6. `life_units.mjs` - does Freedom Mode still make sense?

Freedom Mode reprices the whole app in hours of your life: `money()` quietly
becomes `fmtLife()`. That is right for a figure you **read**, and it silently
corrupts two kinds of figure it does not own:

1. **A figure you act on.** Every input in this app takes dollars - the app says
   so itself, "you always type dollars, only the display changes". So a button
   reading `Assign 3.2 days`, or an instruction reading `Set it to at least
   1.6 days`, names a value the field will not accept. Same fault as offering to
   bank ten minutes into an emergency fund: goals hold dollars.
2. **A figure that already has a life caption beside it.** The headline converts
   too, and the card prints one amount twice in two units:
   `Spent this month 20.3 days / That's 162 hrs of life`.

Neither breaks any arithmetic. Every math suite passes straight through both,
because the numbers were right the whole time - it was the *words* that were
wrong. Only reading the screen in Freedom Mode catches them, so this suite reads
the screen: it walks every tab with a household rich enough to light up each
panel, plus the branches a normal household never reaches (money left
unassigned, a debt whose interest outruns the payment), and asserts

- no button label names a time value you cannot type (the week-in-hours ledger's
  `+1 hr` controls are the one legitimate exception - those are real hours)
- no life caption sits under a second life figure
- no imperative (`Set it to`, `Assign your last`, `You need at least`, `Give`)
  names a value in minutes, checking the **value** rather than the sentence,
  since a sentence can mix
- the sibling stat pairs (`War Chest` / `Life Reclaimed`) keep one of each

Verified by reintroducing all fourteen original faults and confirming each is
caught.

## 7. `intake_cost.mjs` - does the setup chat tell the truth about itself?

The chooser tells people what setup will cost before they commit: *"about 6
minutes and 16 questions"*, *"about 10 minutes and 22 questions"*,
*"Map my averages now · ~3 min"*. Those are promises, and a promise about length
rots the moment somebody adds a step. That is exactly what had happened - the
spend path advertised **~2 min** while running seventeen steps, and the same
screen promised *"no full-budget homework"* one question before handing over
seven fixed-bill fields.

No other suite can catch it. Nothing is a bug, no arithmetic is wrong, and every
math layer passes straight through. So this one counts both paths and holds the
copy to what it says:

- the advertised chips exist **word for word**
- the question count is **exact** - a tolerance here is how "~2 min" came to sit
  on a seventeen-step path, so adding a question forces whoever added it to
  update the promise
- the modelled minutes never **exceed** the claim (under-stating is the
  dishonest direction), and the claim is never padded past double the real cost
- "Map my averages" states its own cost, and the free option says it is free
- **the stance is actually in the conversation**, in all three tones: the real
  minutes, the real question counts, and the app saying the quiet part instead
  of apologising for asking
- ...but never at someone drowning. `iaTone()` floors survival to `clean`, and
  that version carries the honest number without the door

The time model is stated in the file rather than hidden: reading at 200 wpm, ~5s
to decide and tap an answer, ~11s to type one, with the bulk screens (leak
finder, expenses grid, income/debt loops) carrying their own weight since each
is one "answer" but many fields. Arguable on purpose - argue with the constants,
not with a magic number.

## 8. `talk_through.mjs` - understanding before labelling

The Trap Radar makes you pick one of four traps before it will say anything:
scroll, friction, status, leak. All four assume you were tempted. So when a phone
goes in the ocean the only honest answer is missing, and a genuine accident gets
filed as a character flaw.

This suite holds the "Let's talk it through" lane to what makes it worth having:
that a cause is asked **before** anything is labelled, that a non-temptation
cause is never called a trap, that a **covered** event is called the system
working and offered nothing to fix, that real temptation is handed to the Radar
prefilled, that events are kept across reloads, and - the one that already caught
a bug - that **the figure the verdict quotes is the figure the button funds**.
They were computed from different lists, so the screen said $180/mo and the
button set aside $115.

It also covers the **feedback loop**: that a cold history changes nothing, that a
run of unfunded accidents makes the gut-check name what it knows and promote the
buffer to first destination, that skipping actually raises the buffer, that a
partly-covered event is never described as "nothing set aside", and that the
lessons panel paints **on a cold boot** - which caught a real bug, since `boot()`
maintains its own list of renderers and never calls `renderAll()`, so a surface
added to `renderAll` alone never appears until something forces a repaint.

## 9. `structure.mjs` - navigation and disclosure

Two things it exists to stop.

**Reports scattered across tabs.** The four charts lived inside Learn, between a
school and a philosophy panel, and one of them told you to go to the **Plan** tab
to change the period it was showing. A report you cannot steer from where you are
reading it is a poster. They are one Reflect destination now, with sub-tabs and a
period control that belongs to them, and the suite asserts each sub-tab actually
draws, that the arrows move both Reflect and Plan, and that no copy points at
another tab.

**Everything visible on day one.** A brand-new guided user saw 27 panels across 8
tabs while the stage ladder hid six. Panels that need data now wait for it, keep
their heading so no tool is a secret, say what will bring them back, and reopen
the moment data arrives. Panels you *input* through are never gated.

It also holds the **first-time guides** (every area introduces itself once, names
itself rather than another screen, says *why* it exists, names one thing to do
first, sits at the top, and no two share a description; dismissal is per area,
survives reload, can be turned off wholesale and replayed) and the **map** (lists
every area, counts how many you have used, marks used ones done, and navigates).

It also holds **category reordering**, which is a drag now rather than two arrow
buttons. These are real pointer events driven through Playwright's mouse, not
functions called directly, so the threshold, the drop index and the commit all
get exercised: the grip owns the gesture (`touch-action:none`) instead of the
page scroller, a ghost and a drop line appear once you move, a category dragged
above the list lands first, a subcategory dragged hard past the top of the screen
stays inside its parent, a drag that goes nowhere renumbers nothing, **Escape**
abandons one and clears the ghost, the arrow keys still move a row without a
mouse, and leaving the mode leaves no ghost, line or greyed row behind. The
section runs at a 2,400px viewport so the test is about dragging rather than
about auto-scrolling; real phones get the auto-scroll.

It also holds **borrowing to build**, the leverage tool, where the arithmetic has
exactly one way to be dishonest: print the upside and skip the downside. The
break-even on a carried balance has to land on the rate itself at every horizon,
paying it down has to lower that bar rather than pretend it away, the losing case
has to equal the interest whatever the guess was, a payment under the monthly
interest has to be flagged with a balance that grows, and a servicing gap has to
trace back to the user's own income. On the screen: the winning case still prints
the losing one beside it, no gain is invented when no expected return has been
entered, the under-three-months warning fires for someone who actually has no
buffer, the panel carries no stage gate (it would make that warning unreachable),
both money fields take any period, and the `?` shows live working. Two doors have
to exist and one has to stay shut: a cheap liability offers the trail to it, a 26%
store card is not called a lever. And a regex sweep of the whole feature - panel,
engine, render, voice banks - asserts nothing in it tells anyone to borrow. That
last one carries a control string it must match, because a never-fires rule
proves nothing; the feature's own "it will not tell you whether to do it" is
deliberately outside the pattern.

It also holds **charts you can interrogate**. Every time-series drew a shape and
stopped, so the properties are: every point is a thumb-sized band rather than a
3px dot, the chart says something before you touch it, tapping a different point
changes what it says, the arrow keys walk it and focus survives the redraw, the
readout names what the number is made of (including income the setup chat wrote
rather than letting it pass as yours), a month with nothing logged is called
unlogged and never printed as zero, and the donut slices respond to a tap the way
their legend always did.

And the **welcome gate**, the one screen in the app that blocks. It checks the
twelve ideas the card exists to say - ground zero, the distance, accountability
over budgeting, listening/watching/do-better, and the boundary that the app is
not real, cannot want it for you, cannot waste your time, and that the effort is
entirely the user's - as patterns rather than sentences, so copy can change and
none of them can quietly leave with it. It also checks the flow in both
directions: accepting starts the chat and records it, a re-run by someone who
already accepted is not made to read it again, and the setup screen stays usable
however the gate was left. The reachability check took three attempts to become
real: the first read one layout four times and called it four phones, the second
set `scrollTop` by hand (which works on a container made unscrollable, so it
passed with the button welded off-screen), and only the third resizes for real,
scrolls with the wheel like a thumb, and presses the button. That version was
confirmed by making the CTA unreachable and watching it fail.

It also holds **the compact Plan**. The list has to be one line per category
under a column header, no row taller than a line, the amount still typed
straight into it, and the eleven controls that used to ride along gone from it -
which is only acceptable if the sheet has them, so the sheet is checked control
by control (assign, repeat, delete, pencil, split, bar) plus the history the list
never had room for. A pool opens too, lists what is inside it, and does not offer
an amount field of its own. And two negative checks: the sheet must not invent a
carry-forward this app has never had, and a category funded then invested from
must read as used up on the Plan while the spending breakdown still refuses to
call that investment spending.

Fixing this section also turned up a **date bomb in an older one**: the reward
calendar's streak was pinned to `'3'`, so the assertion broke by itself the next
morning without a line of code changing. It now removes the pre-start day and
checks the streak did not move, which is the property that was meant all along.

And **the ledger**, which got the same treatment as the Plan for the same
reason. One line per entry, the whole row as the target rather than a delete
cross, the second line and everything on it gone from the list - and, since gone
is only acceptable if it is somewhere, every field checked as editable in the
entry's sheet, including the energy tag that had been write-once since it was
built. Editing an amount has to move the plan with it, a blank date is not an
instruction, and the one that can drift silently gets its own property: editing
an investment must move the asset behind it, or net worth is wrong by exactly
the size of the correction. Deleting from the sheet still has to unwind what was
behind it.

That section also settled how `life_units.mjs` reads a button. The rule is "no
button asks you to act on a time value", and a ledger row in Life mode displays
"-1.4 days" while announcing "Open the Food entry" - so it now judges by
**accessible name** where there is one, which is exactly what the control claims
to do. A command button with no label is still judged on its text.

It also holds **what the streak is allowed to score**. A posted bill must not
reset the under-budget streak or mark its day over, the bill and the
discretionary total have to stay two separate numbers, and the bill still has to
appear on the day card saying it was not scored. The counter-case is asserted
too, because it is the seam: a bill typed in **by hand** still counts, since
nothing can tell it from a purchase.

And **making a category where you are standing** - all four pickers offer it, an
unnamed one is refused rather than filed somewhere else, naming it both logs the
entry and puts the category on the plan, and no transaction is ever written
against the literal "new category" choice.

And **one list of ways money comes in**. The property is not "there are eight
options" - it is that no screen keeps its own copy of that list, which is the
fault that came back: the log form had a hand-typed set of the five original
kinds, so two income types added to the model showed up in the entry sheet and
nowhere else. That check scans the **source file**, because the first version
read the rendered DOM and counted six - every one of them an option the app had
just generated from the model, which is the thing being asked for rather than the
thing being forbidden. Confirmed by hand-typing two options back in and watching
it fail.

It also holds **the ledger meeting the bank**. Three properties are the feature
and the rest is presentation: a logged entry names the account it moved money
through, the bank total does *not* move when you log (nothing came from the
bank), and the expected balance does - on the right account only. Then the
payoff: reconciling against what the bank actually says has to surface the
difference as money that never got logged, and say so in words rather than
leaving it as a number to spot.

The **one-time catch-up** that files account-less history is checked on its
promise rather than its mechanism: the preview names how far the expected balance
will move, and the actual move has to match it to the cent. A bulk action that
surprises you with the size of its own effect is worse than no bulk action. It
also has to stop offering itself once nothing is homeless, and never appear when
there is no account to file to.

Two edges are pinned because they fail silently: a balance typed today must not
be double-counted by entries dated today, and accepting the app's own projected
figure must record no gap, since nothing came from outside and a gap there would
be invented evidence. The double-count guard was confirmed by relaxing the date
comparison and watching it fail.

And **the quick log knowing its funding source**. It has to open on one line
rather than three, ask for the account exactly once for the whole batch (never
once per line), file every line of that batch - expense, income and put-away -
against the chosen account, move that account's expected balance and leave the
others alone, and raise the question after a photo is read rather than letting a
whole batch land unasked. The two degenerate cases are checked too: one account
is stated rather than asked about but still filed against, and with no accounts
at all it says nothing and still logs.

And **the confirms on things that took work to build**. A recurring schedule and
an account both have to survive the first tap, say what stopping actually costs -
including that the money already posted is untouched, which is the fear people
actually hesitate over - be genuinely backable-out-of, and then do exactly what
they promised and no more. The account one additionally has to name how many
entries would be left pointing at nothing.

And **the income streams already named on Plan**, which the log form has to
offer rather than ask you to retype: rules first and marked as repeating, past
sources after, picking one carrying the account that stream lands in, and free
text still reachable - a first paycheck has no history to choose from, so a list
you cannot escape would be worse than no list. Recurring rules have to be asked
which account they move money through, and editing one has to show the account it
already had.

Plus **the link between Track and Plan on screen**: opening an expense shows what
its category has assigned, what is used with this entry included, what is left,
and this entry's share of the category's spending. That relationship always
existed in the data; the test is that it is now visible from the thing that
caused it.

And **the two budgets that were judging the same dollar**. The section asserts
the contradiction first - planned money marked over on one screen while the plan
calls it funded on another - then that scoping the allowance resolves the day it
was wrong about, without hiding the money: the excluded spend stays on the day
card, named and explained. A parent has to cover its subcategories or the hole
reopens one level down, nothing chosen has to keep watching everything (a
spend-mode user has no plan to hand off to), and the whole thing has to be
reversible. Plus the small one from the same message: every entry on a calendar
day has to open, like the identical row on Track always did.

And **the stale-reference sweep**: a backup carrying every kind of ghost at once
(a watch list naming a deleted category, a transaction and a rule naming a
deleted account) has to come back healed on load, the freed entry has to become
an orphan the catch-up offers a home, deleting a watched category has to prune
the watch list, deleting an account has to free its entries and rules in the
same stroke, and a rule pointing at a dead account has to post through the
default. Plus the two leaks the same audit found: the spend headline must state
everything that left rather than the watched slice, and the Giving ledger and
Shield must follow an edited amount instead of keeping the typo.

And **budgeted against actual**: picking a repeating stream pre-fills the amount
it is set to pay, typing the actual prices a shortfall and an overage live, a
hand-typed actual survives a stream re-pick (the form must never decide it knows
the paycheck better than the person holding it), the discrepancy outlives the
toast as a fact on the entry sheet, and a source with no rule invents no
expectation. The test targets the hand-logged entry, not the occurrence the rule
auto-posts on boot - the rule's own posting is exactly on-amount and would mask
everything.

And **the invest destination**, whose one invariant is that the dollars are
counted once, always: a tracked destination moves both sides of the transfer
(source expectation down, destination up), stays out of the auto
Invested-capital asset so net worth never prints the same money twice, falls
back into it when the destination account is deleted so it never vanishes
either, keeps the free-text lane for things the app does not track, and rides a
recurring rule onto everything it posts.

And **moving a category under another**: it has to arrive as the same category
carrying its assignment, its history, its repeat rule and its watch-list place,
the new parent has to roll it up, and the three moves that must never be offered
have to be absent from the list rather than merely rejected - itself, its own
descendants, and any home that would make a fourth level. Reversible to top level
throughout.

That section also caught an older assertion pinned to the exact words "Log an
expense", which blocked correcting a button that was narrower than the panel it
opens. It asserts the property now. Two of this session's failures were the same
shape: a check that queries a surface the fixture never rendered passes on an
empty string, so the new one asserts the label is non-empty before judging it.

It holds **assign in the rhythm you live in**. The category assignment was the
only money field in the app with no period picker on it, which made "$104 of
coffee" the only way to say "three a week at six dollars". The properties are the
ones that survive a rewrite: the field offers rhythms, whatever rhythm is on
screen the *stored* number is still the month, the rhythm is remembered per
category rather than app-wide, and the habit builder multiplies out loud and
writes the month it names. Two of them are phone properties rather than maths
ones - the Assign button exists **before** the numbers do (disabled), because a
button that materialises on completion eats your first tap; and it comes alive on
the keystroke without a re-render, because redrawing the sheet mid-number takes
the keyboard down with it. Neither is visible in a screenshot and both were
wrong in the first draft.

It holds **two numbers that look like they disagree**. The trend chart's running
total and the all-time figure in its own legend sit inches apart and differ until
you tap the last point. The properties check the reconciliation in *both*
directions - a middle point names what has been logged since and lands on the
figure below, and the last point says it IS that figure - because the second half
is what teaches the relationship, and a check that only tested the mismatch case
would let it rot.

And **whose money it is**. The answer to "my spouse earned this" existed as an
owner field the arithmetic already respected, gated behind a Settings checkbox:
a fact about the money hidden behind a preference about the interface, so the
honest answer was unreachable from the screen asking the question. The properties
pin reachability first (the field is on the form with household mode still off),
then the split the whole thing exists for - a partner's paycheque counts in the
month total and stays out of the personal income that powers your true hourly
rate - and finally that independence follows whose it is, not just what kind it
is. The fixture logs it through the form the way a person would, because a
property proved by writing straight to state would have passed while the picker
was still hidden.

It holds **a stream has to be named**. The bug underneath was not the blank
field - it was that a blank field became the string "Income", two rules called
"Income" merged, and the app then told someone a correct paycheck was $836.97
short. So the properties are pinned at both layers, and deliberately: the form
refuses a nameless rule, *and* `txExpectedFor` declines to answer on an ambiguous
name. A form check alone would have left every rule already saved still
fabricating shortfalls, and a suite that only tested the form would have called
that fixed.

The same section holds the smallest property in the file: a field that would
throw its answer away does not ask for it. `recomputeBlendedWage` reads only your
own hours, so the hours box on a partner-owned rule was collecting a number
nothing would ever read. Asking for a number and ignoring it is the same fault as
inventing one, pointed the other way, and neither shows up in arithmetic tests.

It holds **one drag engine, two lists**. When the recurring list got the reorder
the categories already had, the tempting move was to copy the pointer handling.
The properties here exist because of what that costs: two copies drift, and the
drift is invisible - one list keeps escape-to-cancel, the other loses it; one
auto-scrolls at the edge of the glass, the other strands you. So the section
checks the recurring list *and then immediately checks the categories through the
same engine*, which is the assertion that fails the day someone un-shares it.

It also pins the difference between an arrangement and a view. "Biggest first"
must **write** dense sort values, not render a sorted copy - a view-mode
implementation would look identical on screen and nothing else in the folder
would notice. And it must price the cadence rather than the cheque: $1,600 every
two weeks outranks $1,850 a month. The fixture that got that wrong the first time
was the test's, not the app's - it used a `freq` key that does not exist, which
`recFreq` silently coerces to monthly. Fixtures written from memory rather than
from the option list are their own small version of the same disease.

It holds **what the money becomes**. The Pay Yourself First section is worth
reading for what it does *not* assert: "net worth is unchanged" was the obvious
property and it is wrong for this app, which deliberately keeps net worth on the
typed bank balance and treats the ledger as an expectation. The first draft
asserted it anyway, failed, and the failure was the test's misunderstanding
rather than a bug. The property that actually answers "expense or investment?" is
what the money *becomes*: paid to yourself it becomes something you still hold,
spent it becomes nothing, and both leave the account. The section also pins the
load-time heal, because a source fix never reaches the people the bug already
happened to.

Three fixtures in this stretch were wrong in the same way - a `freq` key that
does not exist, a state with no accounts so no money could visibly move, an
assertion about a model the app does not use. Each was caught by a failing test
and each was mine, not the app's. That is the tax on writing fixtures from memory
instead of from the code, and it is the same disease `hostile.mjs` exists to
treat: the inputs you think to supply are the ones you already know work.

`layout.mjs` also holds **type over decoration**, which is a different failure
from everything else in that suite. A texture composites *under* the words, so
nothing overlaps, nothing overflows, and every other check stays green while the
hook line drops below AA. The palette suite cannot catch it either - it reads the
stylesheet, and the stylesheet says `--muted` on `--panel-2`, which passes. What
is actually behind the type is `--panel-2` plus however much texture landed
there.

So it reads pixels: hide the type, screenshot the surface, take the worst pixel
behind each of the 27 text runs. And it asserts the sample **count** alongside
the ratio, because a contrast check that silently measured nothing is the purest
form of a test that passes forever. Building it, the first ratio reported was
`1:1` - the sheet scrolls, the last cards were outside the screenshot, and the
check was reading unpainted pixels. That is the same class of bug as every
vacuous assertion in this folder, caught only because the number was absurd.

The section also records which defence is load bearing, which is not the one I
would have guessed: pulling the mask and leaving the alpha high measures 4.16:1,
while raising the alpha with the mask in place still passes. The mask does the
work; the alphas are margin.

The category-catalogue section is where the **assert the invariant, not the
example** lesson finally got learned the hard way. The ranking check named
specific rows twice and was wrong about the catalogue both times: once on a
category the *user* had created rather than one the packs ship, once on a word
that turned out to have no mid-word match at all. The version that holds asserts
that the returned ranks come back non-decreasing - which is the actual property,
survives any edit to the pack copy, and cannot be wrong about what is in the
list because it does not claim to know.

Its other pair of properties is the one worth copying elsewhere: picking a
catalogue row brings its growth tag along, **and** a name typed by hand is never
silently tagged, **and** editing a pick drops the tag. Testing only the first
would have shipped an app that quietly decides things on your behalf.

Adding the Planned/Spent/Remaining toggle broke a drag test, and the break was
worth more than the feature. The check reached for
`#cats [data-row]:nth-of-type(2) .cat-grip` - and once a toggle div sat above
the list, the second div of that type was the toggle, so the selector matched
nothing and the suite died on a null. **A positional selector in a test is a
claim about layout that the test does not mean to make.** It addresses the row
by what it is now, and says so where the next person will read it.

And **sheet height**: every modal is opened at 700, 780 and 844px and has to fit,
keep its ✕ on screen and hit-testing to itself, and put the overflow on its body
rather than on the sheet. Uncapped, the app map wanted 938px and pushed its own
close button to `y=-115`.

It also checks **id uniqueness in the live dom**, which building this earned: a
panel ended up carrying two `id` attributes, the browser kept the first, and the
code that had been hiding it silently stopped finding it.

It holds **not everything is a trap** - the fifth gut-check lane, where the
properties guard against it becoming a rationalisation button. The payback has to
be right to the month, the needle has to point at Freedom when the arithmetic
does and swing back toward Trap when it does not, replacing nothing has to be
called a **want** rather than an investment, a slow payback has to be called
slow, the caveats have to be present, and the hired cost and the saved hours must
**never be added together** - you would have done one of them, not both, so the
larger counts and the other is named out loud as set aside. The four trap lanes
have to be untouched, and their extra questions must cost those lanes nothing.

It holds **money that did not leave** - the rule that the fast way to log must
never be able to write only one kind of entry again. A Roth contribution is never
guessed as shopping, a put-away line writes an investment rather than an expense,
it reaches net worth (it is still your money), it never counts as spending, the
confirmation does not call it a purchase, and spend mode has to show what was
kept beside what was spent - in the headline, in the list underneath it, in the
week pace, and on the day itself. With nothing put away yet the screen still has
to name the door.

It holds **the tripwires**, where the most important properties are about copy
rather than code: the panel must deny, in its own words, that the app can see
which apps you open, and must say it is a nudge and not a block. Then the
mechanics - the link carries the shop name url-encoded, the trap guess is right
for a food app and a resale app and a renewal, the same shop cannot be armed
twice, Test does exactly what the automation will do, and both platform recipes
name the thing the person will actually open. The entry points run in fresh
pages because they are boot paths: a link opens the scan with the cursor on the
price, a **second firing works when the app is already open** (a same-document
hash change does not re-run boot, which is the common case and was a real bug),
a shared product yields its name and its price, the shared title does not linger
in the address bar, and a brand-new user gets the setup chat rather than a scan
of nothing.

It holds **the period pickers** - the rule that a field asking for a *rate* must
let the person choose the period. Every multiplier has to agree with the rest of
the app (a bill, a paycheck, a leak and an overhead of the same cadence cannot
disagree about what a month is), a commute has to count **work days and not
calendar days** (21.67 a month, not 30.42 - the bug that fell out of building
this), the typed number must never move when the unit does, what gets stored must
always be monthly, the two true-rate doors must end up showing the same three
numbers, and the chosen unit has to survive a repaint. Then the audit rule
itself: no `<label class="fld">` may hard-code a period into its text, with the
things that are not rates listed as deliberate exclusions rather than left
ambiguous - an APR and an expected market return are annual by definition.

It holds **the trail** - the rule that a panel must never name a destination it
cannot take you to. Every entry in `TRAIL` has to resolve to a field that exists
in the dom (a breadcrumb that navigates and then does nothing is worse than no
button), the walk has to end **in the field** rather than on the tab, and it must
refuse to walk into an area switched off in Settings. Then the specific dead ends
- the report's locked list, a plan with no income behind it, telling the app you
owe money, a funded goal, the circulation panel, Freedom Mode without a rate -
each has to carry its own door, and the offer to plan a debt has to **stop** once
the planner has it, so it is an offer rather than a nag. Finally the phrasings
that were the fault (*"Set a dream on the Goals tab"*, *"Add a category first
(Budget tab)"*) are banned strings, so writing one again fails the build. That
check strips block and HTML comments first - the paragraph explaining why those
phrasings were wrong contains every one of them, and a checker that trips over
its own documentation teaches people to delete the documentation.

And three properties that came from one phone note about getting paid. **The
cadence helper**: every real pay frequency is offered, weekly converts on 52
weeks rather than four per month, biweekly on 26 paydays rather than 24, and both
conversions land on exactly the figure `recMonthly` gives the same money - one
app, one set of multipliers. The working names the wrong answer out loud
(`$3,360`), because that is the number the person would otherwise have typed. An
hourly rate someone typed comes back to the rate question unrounded instead of
being re-derived from the monthly figure built out of it. **The yearly
projection** must say which of two things it is doing - measuring what landed, or
repeating what they told setup - and it must never annualise the month in
progress or a single logged month. **The true-rate card** has to appear on Home
with their own take-home already in the field, compute to the cent what the
Settings panel computes, name what the commute and overhead were costing per
hour, and then leave for good once it has been used or waved off.

It also holds **Planned mode's remainder** and **the credit card**. The plan
toggle gave the list one money column and the property that guards it is
mechanical - every row has exactly **one** child of `.rw-money`, in every mode -
so putting the "what is left" figure back into Planned had to happen inside that
cell rather than beside it. The section checks it appears only when something is
assigned, goes red when negative, follows what you type without a reload, and
that Spent and Remaining stay clean, because in those modes the figure on the
row already **is** the answer.

The credit card section is the one where the arithmetic is checked before any of
the words. What is owed is its own figure rather than a smaller bank balance,
the two halves still add back to the signed total net worth uses, borrowing room
is never counted as spendable cash, a line kept at zero still reports its room,
and a card comes off net worth the moment it exists. Then the fault the feature
exists to prevent, driven through the real form: buying on the card is spending
and lands on the card, paying it off is **not a second grocery bill**, the
ledger treats the move as worth exactly zero while both real balances move in
opposite directions, and net worth does not budge because nothing was earned or
spent. Plus the two ways it could still lie: a move edited into having one end,
and a card typed in again under Liabilities.

One assumption in the first draft of the probe was wrong in a way worth keeping:
it added the card and immediately logged a purchase against it, then asserted
the card had moved. It had not - and that is by design. Anything dated **on** the
day you set a balance is assumed to be inside the figure you copied, app-wide.
The probe was passing on a fixture that never reached the code it claimed to
test, which is the same fault this suite has caught in itself four times now.

It also holds **the rate layer**, which is the section most about words and
least about arithmetic. The engine reads every borrowing line the app knows
about - credit account, liability, payoff planner - and says what a balance
costs where it is against what it would cost somewhere cheaper. Three
properties guard it, and each is a way a suggestion engine goes wrong:

- **It never says do it.** A regex sweep over the whole rate family looks for
  the phrasings that would actually constitute a recommendation, carries a
  control string so a never-fires rule cannot pass by accident, and asserts the
  swept span is a real length rather than an empty slice.
- **It names why the cheap line is cheap.** The spread against a `secured` line
  has to say, in the same card, that the rate is lower because there is
  something they can take. A spread quoted without that is advice with the risk
  edited out, so the check reads for both halves.
- **It says when nothing matters.** Below a threshold the signal has to call the
  gap "not much" and point elsewhere. Checked with a fixture built to land
  under it.

Then the situational edges: a cheap **mortgage** must not be offered as
somewhere to put a card balance (it has no room and cannot take one), the
idle-cash signal must **flip its whole answer** when the buffer is thin rather
than quietly disappearing, three readings of what you owe is a direction while
two is only a line, and the same debt typed into two places is one line with
the priced copy kept.

It also holds **the expected balance and its history**, which came from a phone
screenshot and three questions, one of which had an uncomfortable answer. The
projection asking you to overwrite a real bank balance showed none of its
arithmetic, and no individual account had a history at all - only a single
aggregate figure per month, so two accounts moving in opposite directions
cancelled out into nothing-in-particular.

The checks are behavioural, not cosmetic. The work has to add up start to
finish in one line, break down by kind with the entry counts, and list the
entries themselves so it can be checked against a statement. "Bank still says
$X" has to move **no money at all** while still counting as having checked it,
and it has to **record the gap** rather than swallowing it - a dismiss button
that quietly deleted the finding would be worse than no button. Every route to
a balance has to record a reading, two corrections on one day have to collapse
into one, and the aggregate trend has to name which account moved and by how
much rather than printing the net.

It also holds **the swipe-up drawer**, driven with real `TouchEvent`s at the
element in a `hasTouch` context rather than through a synthetic shortcut, so the
listeners run the way they would under a thumb. The gesture itself is the easy
half; the section is mostly about the seven buttons underneath it. A swipe too
small to be decisive must do nothing, a plain tap on a drawer option must still
navigate, the compatibility click a phone fires at the end of a drag must be
swallowed, and the very next real tap must land.

That last pair is where the first version failed, and the failing case is now
its own property: **a swipe that opened nothing must leave no trap for the next
tap.** The original swallowed the following click with a flag that waited for a
click to clear it, so a non-committing swipe armed a trap that ate whatever came
next, minutes later if that is when it came. The check waits half a second - far
longer than any browser's compat click, far shorter than a human swipe-then-tap
- and presses More.

It also holds **the door to a credit account**, which is a section about copy
rather than wiring - because the wiring was already right. A screenshot asked
why a card and a HELOC were not in the Move form's destination list; driving the
real pickers showed they appear the moment they exist, with a card preselected.
They were missing because the accounts had never been created, and the Accounts
panel's own heading said *"What's actually in the bank"* - correctly telling
anyone reading it that a credit card does not go there. A feature built into a
panel whose words exclude it is a feature nobody finds, and no test of the
wiring would ever have caught it.

So the checks read the panel's framing, and the one place somebody hits the
wall: with no credit account anywhere the Move form has to say where one comes
from and hand over the trail, and that nudge has to stop once a card exists.
Both ends of a move must offer cards; an investment still must not be able to
land in a line of credit.

It also holds **reading a bank screen**, where the fixtures are the user's own
pasted text wrapped exactly as their phone wrapped it. The quick-log reader was
built for a handwritten shopping list and a bank's pending list breaks every one
of its assumptions silently - nine rows, all wrong, every price lifted out of a
reference number and every description carrying the plumbing around it.

The properties are about what a person would read: a wrapped record is one entry
rather than one per line, the amounts are the ones on the screen, no reference
number is ever read as a price, and the description stops before `Held` with no
orphan half of a wrapped reference left in it. Then the two names the cleaner
could most easily eat, both asserted positively: a merchant with a star in its
name keeps it, and a merchant whose name *contains* a lead-in word
(`SQ *PURCHASE COFFEE`) keeps that too. And the path it was built for - a
handwritten `coffee 4.50` - has to read exactly as it always did.

The Clear button is checked the way the category delete is: it clears at once
when there is nothing to lose, names what it would cost when there is, needs the
second tap, and disarms when you start typing again.

It also holds **surviving OCR**, which is the section that exists because a
probe blamed the wrong thing first. A batch read from a bank screenshot logged
one entry instead of four, and the obvious suspect was the save step - so the
suite drives `qlSave` with four filled rows and asserts four land. It always
did. The loss was a `$`-anchored pattern meeting an OCR pass that eats dollar
signs, and the fixture now feeds exactly that: the same four records with the
mark dropped on one, read as an em dash on another, and intact on only one.

The property that follows is worth stating plainly: **a statement the reader
cannot get an amount out of must report nothing**, rather than falling through
to a reading built for a shopping list and producing rows nobody can explain.
Which reading applies is decided from the text, not from whether a pattern
happened to match.

The entry delete is checked the way the category delete is - armed, the question
naming the amount and what the plan gets back, no stale arm surviving a
navigation - because this is the third surface to get the same report.

It also holds **the amount with no name**, a section written without being able
to reproduce the failure. The reader said "Read 1 line" for a screenshot holding
four, and no OCR engine was available locally to see why. Rather than guess at
Tesseract, the question became what the code does badly *whatever* it is handed -
and the answer was that an amount whose description did not survive was dropped
silently.

So the fixture is the shape that produces it: a two-column page read as one
block of descriptions followed by one block of amounts, where only the first
amount has any text in front of it. The properties are that every amount
survives, the ones that could not be named are flagged rather than dropped, the
one that could keeps its name, and a well-read statement still comes back with
nothing flagged at all - that last one being what stops the fix from turning
into a machine for producing blank rows.

It also holds **saying less at a glance**, which is mostly a set of assertions
about *rendered geometry* rather than copy. A clamped paragraph has to be two
lines and not eight, measured from its bounding box; each clamped one has to get
exactly one More and each short one none, because a control that reveals nothing
is worse than no control; and the accent rule on a closed accordion has to be
dimmer and shorter than on an open one, since that difference is the whole
"which section am I in" signal.

The property that guards the approach is this: **every word of a clamped
paragraph is still in `innerText`.** The text is clipped, not hidden, which is
why a `<details>` was rejected - it would have taken the copy away from screen
readers, find-in-page, and most of this suite, which reads copy through
`innerText`. The visual saving would have been identical and the honesty would
not.

It also holds **a figure showing its working**, where the fixtures are chosen so
the sum can be checked by hand: 6,000 in, 1,300 out, 400 put away, one move.
6,000 - 1,300 - 400 = 4,300, the move counts for nothing, and the total in the
card has to be the figure on the tile - checked as one assertion, because a
working that does not land on the number it explains is worse than none.

The reachability property is the one worth naming: the explanation for that
figure had existed for weeks, wired to a chart legend four screens from the tile
that raises the question. So the check is not "does the copy exist" but "does
the tile carry a way to reach it". And a `?` inside a grid tile must open its
note *below the strip* without changing the strip's height - asserted by
measuring the strip before and after, because a note dropped into one cell of a
four-cell grid pushes that tile's own number out of shape.

It also holds **editing and reordering an account**, where two properties carry
the section. A rename must not cost the reading history - checked by counting
readings before and after - and reordering must move **no total at all**,
checked by comparing `bankTotal()` and `netWorth()` either side of a drag,
because only the display is sorted and a second sorted copy is exactly how that
would break.

The awkward one is asserted rather than avoided: flipping an account to a card
flips what its stored balance *means*, since owed is held negative. So net worth
has to move by **twice** the balance, and the suite states that number outright
rather than checking it merely changed.

The debt delete is checked the way the other three armed deletes are, and it is
the fourth surface to get the same report - which is itself the argument for the
pattern being a pattern.

**Grouping the accounts under headers by kind** turned out to change what
reordering means, and that is what the checks are built around. A drag is now
confined to its own group, so the suite tags every row with `data-lvl` and
asserts each group's rows all carry the same one - a group whose rows disagree
is a group a drag can escape. The fixture had to change with it: it originally
held one checking, one investment and one other account, so after the editor
turned the third into a card **every account was alone under its own header**
and `moveAcct` correctly did nothing. The check failed on a fixture that could
not express the thing it was testing, not on the code. A second checking account
fixes it, and the lesson is worth keeping - *when reordering gains a boundary,
any fixture with one item per bucket stops testing reordering at all.*

The header itself is checked for carrying its own total and its own count, since
a header that only labels is a line of decoration; and the width checks moved
here too, because the group header is what let the row stop naming its kind. At
320px the row body measured **17px** with the pencil added and "Joint Checking"
came out one letter per line - so the geometry is asserted at 320 and 390, on
the body's real width and the name's rendered height, not on a character count.

**The credit limit and the room** brought one property worth the whole section.
The panel prices unused room against what someone is saving for, and the first
draft quoted the **cheapest line's rate over the total room** - so a $10,000
dream funded $3,000 from a 3.49% line and $7,000 from a 23.9% card came out
priced at 3.49%. Every individual number in it was real. The screen was still a
lie, of the exact shape the rate signals were written to refuse: *true of part
of the money, presented as true of all of it.* The suite asserts the blend
arithmetic by hand - cheapest line first, `(3000x3.49 + 7000x23.9)/10000` - and,
separately, that the answer is **above 17%**, because the failing version would
have passed any check that only asked whether a rate was printed.

Two more are guarded because a plausible screen would be a dishonest one: both
halves of the choice have to render (a borrow-or-wait panel that showed only the
borrow side would be the worst surface in the app), and a payment under the first
month's interest must print **no payoff date at all** rather than whatever a
capped loop happens to reach.

The gating check needed narrowing rather than satisfying. A sweep asserted that
*every* panel in the Debt view reopens once a debt exists - but this panel gates
on **room**, not on debts, deliberately: two loans and no line have nothing for
it to price, and one untouched HELOC with no other debt is exactly who asked for
it. Feeding the fixture a limit would have made the sweep pass and quietly
deleted the distinction, so the sweep now skips this panel by name and the
separate gate is asserted directly, in both directions.

**Letting one line live on two screens** put the suite's attention exactly where
the damage would be. A HELOC can now sit in the payoff planner *and* on the
accounts side, which immediately raises the question of whether anything gets
counted twice. It does not - `netWorth()` reads accounts and liabilities and has
never read `state.debts`, and `pricedLines()` dedupes by name - but "it does not"
is a claim, so it is three assertions: net worth moves by the owed amount
**exactly once**, the room total and line count are **unchanged** by the
crossing, and the rate layer sees **one** line, not two. None of those would fail
loudly on their own; a double count just makes a person poorer on paper and looks
like arithmetic.

Then a fixture leak of the useful kind. The block that crosses a HELOC over left
a credit account in state, and the *next* check - "two loans and no line leave
the room panel waiting" - went green off the leftover account's room rather than
off what it was testing. The panel gates on room from **either** side, which is
correct, and the check had only silenced one of them. A gate fed by two sources
needs both cleared before "no room" means anything, and the fix added the missing
third case: a card kept only on the accounts side, with no debts at all, opens
the panel too.

**The hardest thing to test is a feature that works silently.** A user reported
that changing a balance did nothing - and every figure had moved: the balance,
the bank total, net worth, the month's snapshot, the trend and a stored reading.
Six correct behaviours, zero visible ones. No suite caught it because every
suite was asking "did the number change" and the answer was always yes. So the
section asserts all six *and* asserts that the screen says so - the row states
both readings and the movement, and the app answers when you type into an
account with no ledger against it. **A silent success is worth less than a loud
failure**, because a person can act on a failure.

That section also caught a test bug of a kind worth naming. A "before" snapshot
was taken as `o.seeded = a.hist` - a live reference - and Playwright serializes
the return value when the *evaluate ends*, so it came back carrying every
mutation made after it. The before-state showed the after-state and the check
failed on a fixture that could not represent a before. **A snapshot has to be a
copy or it is not a snapshot** (`JSON.parse(JSON.stringify(...))`).

**The planning calendar** is guarded on the property that makes it safe rather
than the pixels that make it look right: the checkbox keeps **no state**. An
occurrence has landed exactly when a transaction with that rule's id and date
exists, so the suite checks that a month the *scheduler* posted renders as fully
ticked with nothing else happening. Two records of one fact is how a calendar
and a ledger start disagreeing, and there is only one record here.

Its second property came from building it wrong. The first version put the box
on an engine that already auto-posted everything, so every past occurrence
arrived pre-ticked - a tick that is always already there confirms nothing. The
probe that found this looked like a fixture problem (`5 of 5 have landed` before
anything was ticked) and was actually the feature being pointless. Waiting is
now a mode, and both directions are asserted: turning it on must not un-log
anything, turning it off must catch up what was due.

**Category faces** are guarded on the two properties that separate them from
decoration. Every category must get one **without anyone typing anything** - so
the fixture is the user's own nine names and the check is that all nine come out
distinct on a cold start. And the guess must be **derived rather than stored**:
renaming a category changes its face, while a *chosen* face survives a rename.
That is one assertion in each direction, and storing the guess at creation would
fail exactly one of them - which is why both are there rather than the easier
"a face is present".

Adding it broke an unrelated check, correctly. A drag test asserted the rendered
row text matched a real category name, and rows now read `🎉Fun` where the stored
name is `Fun`. The fix strips the face before comparing rather than loosening the
check to a substring match - which would have passed but stopped noticing
truncation, the thing that check exists for. **When rendered text gains a prefix,
strip it; do not weaken the comparison.**

**Planning ahead** is checked for what a future month is not allowed to claim.
The boxes must be *disabled*, nothing may read as landed, and the note has to say
why - because a dead checkbox with no explanation is indistinguishable from a
broken one. The suite also steps two months forward to find a yearly repeat,
which is the case that proves the calendar reads the month it is given rather
than the month it was built for.

One collision worth remembering: the new block declared `const plan` in a file
that already had one, and the suite failed to parse at all rather than failing a
check. That is the third identifier collision this file has produced. In a
single-scope test file of this size, name new bindings for their section.

## The per-view tints, and why they live in the palette suite

Ten rooms in two themes is twenty colour triples, and every way it goes wrong is
silent: a view with no tint falls back to the accent and looks like another room;
a tint naming no view colours nothing; a light-theme entry left out puts the dark
hue on warm paper. None of those throw.

But the reason this is a **palette** test rather than a structure one is the wash
itself. It sits under every word on the page, so the suite **composites** it -
panel plus tint at the real alpha, taken from the same constants the stylesheet
uses - and re-checks every ink against that composite rather than against the
bare token. 290 pairs. A colour scheme that costs somebody their text is the one
failure here that actually hurts, and it is invisible to any check that reads
`--panel` alone.

All five failure modes were verified by breaking them, which is the only way to
know a suite can fail: two rooms given the same hue, a light entry deleted, the
wash alpha pushed to 60%, and a tint set to the panel's own colour each produced
the specific message they should. A check that has never failed is a guess.

## Two sweeps that came out of one phone pass

`deadpanel.mjs` and `unexplained.mjs` exist because two of eight reports were
not really about the feature named in them.

**`deadpanel.mjs`** generalises the Tripwires bug: its render function was wired
only into the sync-pull path and into its own add/remove handlers - handlers on
controls that could not exist until something drew them. So the panel was empty
from boot for everybody. The sweep boots cold and walks every tab the way a
thumb would, then reports any **panel whose entire body is empty**.

Getting the rule right mattered more than writing it. The first version flagged
any empty container and produced 29 hits, nearly all correct behaviour - banners
that fill when there is something to say, result slots that fill after an
action. Narrowed to *a panel with a heading, an intro and nothing else*, it
reports exactly one thing on the broken build (`impulse → "Tripwires"`) and
nothing on the fixed one. **A sweep that flags 29 things flags nothing.**

**`unexplained.mjs`** is the "audit the entire app" half of the Sovereignty
Audit report. It walks every tab and finds **headline figures with no way to ask
where they came from** - skipping anything you typed, since the box beside it is
the explanation. Its most useful property is that it came back almost empty: the
only figures in the whole app that could not show their working were the three
in the panel that was reported. That is worth knowing in both directions.

## A load that fails must not delete anything

The most serious thing in this batch was found by a fixture that would not load.
`load()` was a single try/catch returning `defaultState()` on any throw, so a
stray reference inside `normalizeState` - our own tidy-up pass, not the user's
data - silently discarded an entire budget. Nothing errored to the page. The app
simply opened one morning as though it had never been used.

Section 95 asserts the two halves separately, because they are different
failures: a throw inside our tidy-up hands back the **parsed state
un-normalized** (checked by stubbing `normalizeState` to throw and confirming
the wage, the categories and the transactions all survive), and unreadable JSON
stashes the raw text under its own key **before** falling back. Both set a flag
the app surfaces on the next boot.

The general rule this leaves: **a catch that returns a default is a catch that
can delete data.** Anywhere one exists, ask what it is discarding.

## Measuring readability instead of claiming it

*"How would my 13 year old understand this?"* is not a check you can write by
asserting a feeling, so section 97 asserts the **vocabulary**: nothing over nine
letters survives in plain mode. That is a crude line and a real one - three words
crossed it while the copy was being written (*enforceable*, *break-even*,
*asymmetry*), and all three were in the text before anything measured it.

A scratch script also scored Flesch-Kincaid on both modes (3.8 → 2.2). It is not
in the gate, because the formula is badly behaved on text this full of dollar
amounts, and a number that moves for the wrong reasons is worse than no number.
The word-length rule survived because it is blunt enough to be honest.

The other half of that section is the rule no rewording may break: both outcome
cards still render, and the panel still refuses to say whether to borrow. **A
readability pass is exactly when a safety property gets quietly dropped**, so it
is asserted in the same block that checks the words.

## The fourth identifier collision

`const plain` collided with an existing `plain` and the suite failed to *parse*.
That is the fourth time this file has done it, and the rule was written down two
commits earlier: **name new bindings for their section.** Renaming with a regex
then broke it a second way - `\bplain\b` matched inside the selector string
`[data-plain]`, so the query silently returned nothing and one check failed with
an empty array. Renaming identifiers by regex touches strings too; the boundary
that saved `data-plainh` is the same one that ate `data-plain`.

## Splitting a claim list instead of relaxing it

The welcome screen has a gate of thirteen claims it must make - asserted as
ideas rather than sentences, so a rewrite cannot quietly drop one. Giving the
screen a short version broke it, correctly: six of the thirteen moved behind a
tap.

The wrong fix is to point the check at the expanded text and move on, which
keeps it green while deleting what it was for. The right one is to decide which
claims may be optional. **Disclosure may not** - what this thing is, what it is
not, that it cannot want it for you, that it will not flatter you, and the
privacy promise, because those function as terms somebody agrees to before
starting. **Elaboration may**, since that is what a light version is.

So there are two readings of the card now: `shortText` for what a person is
actually shown, and `text` for everything the screen holds once the long version
is open. Seven claims are checked against the first, all thirteen against the
second. A shortening that ate a disclosure would still fail.

One regex needed widening on the way, and only because the copy got clearer:
`can't want this for you` was written out in full as `cannot`, which the old
pattern did not match. **A pattern built around a contraction breaks when the
writing stops contracting.**

## Not asserting a bug you cannot reproduce

A report said the intake never scrolls to the new question. The mechanism looked
obvious on inspection - the log scrolls, then the dock renders underneath and
takes height off it - and the first version of the check asserted exactly that:
grow the dock, watch the question strand.

**It did not strand.** Chromium anchors a bottom-pinned scroller, so the
hypothesised failure is handled by the browser. The check was rewritten to
assert the property the report actually asked for - one function, and the newest
question ends up at the bottom from anywhere - and both the suite comment and the
Feature Map say the reproduction failed. A green check that claims to guard a
bug nobody has seen is worse than no check: it makes the next person believe the
question is closed.

## A probe that cannot report is worse than one that fails

The same section threw inside `page.evaluate` on a null `.nextstep`, which fails
the **whole file** with a stack trace instead of failing one check with a reason.
Guarded, it printed `draft:true cards:3` and the actual card text - and the fault
turned out to be the fixture: it never set `welcomed`, so opening the intake
showed the welcome gate rather than the resume offer. **Diagnostics in the
failure detail are how a fixture bug tells you it is a fixture bug.**

### A test can go stale on its own

One check in this suite was pinned to *"two paydays, $2,953.84"* from an anchor
28 days back. It broke overnight, with no code change, the morning today itself
became a payday and a third date landed. That is the second date bomb this
suite has grown (the first pinned a reward streak to `3`), and the fix is the
same shape both times: **assert the property the name claims, not a count that
happens to hold today.** The check now says the dates are fourteen days apart,
none of them are in the future, and the money equals the per-payday amount times
however many landed - which is what "walks forward at the right cadence"
actually means.

## The suite runs on its own clock

Three date bombs got patched one at a time before the pattern was obvious. Then
the calendar reached the 1st of a month and **twenty-four more checks went red in
a single night**, with no app code changed. That is when it stopped being a
series of unlucky assertions and started being one bug.

The bug: **a fixture pinned to a month, compared against a clock that had moved
on.** Every fixture in `structure.mjs` is dated August 2026, which was perfectly
deterministic - right up until August ended. Then `thisMonth()` disagreed with
every one of them, and everything that compares fixture data against *now*
failed at once: snapshots with no current month, an account whose readings were
suddenly last month's, a calendar stepping "forward" into the month it was
already in.

So the page is now told what month it is. One line at the top of the suite
installs a shifted `Date` before the app loads, and the fixtures and the app
finally agree because they are reading the same clock. Time still **flows** -
only the origin moves - so timers and the app's own `setTimeout` waits behave
normally.

Two details worth keeping:

- **A subclass, not a Proxy.** Wrapping `Date` in a Proxy stopped the app booting
  at all: `state` never initialised, because something in `load()` threw on it
  before the first check ran. `class Shifted extends Date` keeps `instanceof`,
  the prototype chain and the inherited statics exactly as the platform made
  them, and moves only the no-argument constructor and `now()`.
- **Node has to read the same clock.** Fixtures built in Node with `new Date()`
  disagree with a page that has been told otherwise - the original bug, from the
  other side. `CLOCK_D` / `CLOCK_M` are the one reading everything derives from.

The date chosen is the **30th**, not mid-month: fixtures reach as far as day 31,
so an earlier clock would put a third of them in the future and the calendar
would clamp away the days they select. The 30th leaves day 31 ahead, which the
"still to come" checks need, and everything below it has happened.

The real gain is not that the red went away. It is that **a date boundary is now
something you test on purpose.** Pointing the suite at the 1st, the 31st, a leap
day or a DST switch is one line. Before this, the only way to exercise a month
boundary was to be working at midnight on the 31st - which is exactly how these
were found, and is not a test strategy.

Suites whose fixtures already say "now" (`life_units`, `talk_through`, and the
`rates` / `tracked` / `cal` probes) take the other road instead: they compute
their months from the live clock. **Either is fine; mixing them inside one
fixture is what breaks.** A fixture declares its own clock, or it uses the live
one. Never both.

## The branch nobody walked

The `intake6` probe covers two faults found by watching one person set the app
up, and both were in code the suite already exercised.

The pay-cadence helper had tests. They walked the **hourly** path, because that
is the interesting one - it is where the monthly figure gets derived and where
the conversion could be wrong. The hours question lives on that path, and on
that path it was asked. On weekly, biweekly, semimonthly, monthly and yearly the
helper called `finish(f, amt, 0)` and no test noticed, because the number those
paths exist to produce was correct. The consequence was two layers down: no
hours on file means `effectiveHourly()` falls back to a 2,080-hour year, so the
app silently assumed a 40-hour week for everyone who is not paid hourly.

`intake_cost.mjs` counts the questions the intake asks and checks the advertised
totals. It could not catch this either, because the hours question is inside a
**helper**, not a step - it never appeared in the count it was missing from.

So the probe walks **every branch of the picker**, asserts the question appears
on each, and asserts the two halves that differ: it is required on hourly (the
month cannot be computed without it) and skippable everywhere else. A branch
that only differs in what it *omits* needs a test that visits all of them.

The packs fault has the same shape as the growth tag one section up: `addPack`
had accepted a per-category pick list the whole time, and the intake step never
passed one, so ticking 4 of 11 committed all 11. The probe asserts what lands on
the plan, not what the step thinks it selected - `o.landed === pack - 1` after
unticking one - because the step's own state agreeing with itself is exactly
what a broken hand-off looks like.

## A capability nobody can reach

The `growthcat` probe covers marking a category as *invested, saved or debt paid
down*. Every piece of the machinery it exercises **already worked** and had
already been tested: the invest transaction type, the growth tag, the breakdown
exclusion, `catUsed` adding invested to spent. Section 14 of this repo's history
is literally "growth lane: invest transaction type end to end."

What no test asked was **how a person gets the tag onto a category**, and the
answer was: by accident. Pick a name out of a pack that happens to carry one, or
type a word like "investing" during the intake. Type *Acorns* and you got a
purchase. The feature was complete and unreachable, which is the same thing as
absent - the third time this repo has hit that exact shape (`renderTripwires`
never called; the sovereignty audit explained nowhere you could see it).

Chasing it turned up two real defects that the end-to-end tests could not have
caught, because they only ever tested the lane starting from Track:

- ticking *repeat* on a plan row hard-coded `type:'expense'`, so a tagged
  category's own automation posted it as spending every month
- unticking matched by type, so a growth rule kept running after the box cleared
- `postRecurring`'s invest branch never carried `catId`, so the money could not
  be attributed back and the row read *$1,300 assigned, $0 used*, forever

The probe asserts the reachability first and the arithmetic second, in that
order, because that is the order the fault occurred in. The rule worth keeping:
**test how the user turns the capability on, not just what it does once it is
on.** A green suite over an unreachable feature is a suite testing itself.

## The absence of a word was the message

Section 102 and the `monthhome` probe came from four words on a phone: *"why did
it pull up September's tracking prematurely?"* The suite could not have caught
it, and it is worth being precise about why.

Every assertion about the month controls checked that they **work**: tap forward,
the month advances; tap back, it returns; the figures follow. All true, all still
true. What nothing checked was what the screen **says** while you are somewhere
other than now - and the answer was `&nbsp;`. The label rendered "This month"
when the month matched and a literal blank when it did not, so the only signal
that you were looking at next month was the *disappearance* of a caption most
people never read in the first place.

That is the same fault as section 100, one turn earlier, in its second form.
There, a caption asserted something the function could not support. Here, a
caption said nothing at all and the silence asserted *"this is now"*.

What is guarded now:

- walking forward still moves the whole app (that is the design, not the bug)
- but every screen it moved **says so**, and the assertion reads the words
- Track, which has no month control at all, gets a banner and a way home
- the app **never opens** in a month that has not happened
- a **past** month is still kept across a reload, because someone may be part
  way through reconciling it - it just has to be named

The reusable rule: **when a state has two cases, assert what the screen says in
both.** A check that only ever exercises the happy case will pass forever while
the other one renders nothing.

## Two numbers with different confidence

Section 101 and the `scan` probe cover reading a bank statement off photographs.
Almost none of what they assert is about the OCR - `qlocr` already owns that.
What they guard is the **separation**.

A figure read off a photograph and a figure the user typed do not carry the same
weight, and the moment they are added together the result claims more than
either half can support. So the checks are shaped around that one property:

- reading a statement changes **no** transaction, **no** net worth, **no** month
  total - asserted by snapshotting all three across a full read
- the panel says so itself, on screen, in the same breath as the figures
- keeping a reading stores a **summary**, and the assertion is that the stored
  blob does not contain a merchant name from the fixture
- in Reflect it appears **beside** the ledger's own cards, naming itself a
  reading of a photograph, never laid out as one of the ledger's months
- the raw text is always one tap away

Two arithmetic rules ride along, and both came from looking at the first render
rather than from the suite:

**Money put away is not money that went out.** The headline counted a $300
transfer into savings as spending, so the best thing in the statement made the
month look worse. Now it is shown, marked, and excluded from the total and from
every percentage.

**`includes('etf')` matches n-etf-lix.** The first pass filed NETFLIX.COM under
retirement saving. Matching is on word boundaries now; the check asserts both
directions - the false positive is gone *and* `VANGUARD ETF PURCHASE` still
lands in Put away, because a fix that only tightens is how a classifier quietly
stops classifying.

The lesson is the older one, restated: **a suite cannot catch a fault it has no
reason to look for.** Both of these were found by rendering the panel and
reading it, at 390px, like a person would.

## A caption is an assertion

Section 100 came from a photo and four words: *"This doesn't look right."* Both
cards of the invest comparison read as a minus and both were captioned **net
worth in 5 yrs**. Every existing check on that panel passed, and every one of
them was right to: the gap between the two cards was exact to the cent, the
winner was crowned correctly, the tie guard held. The suite had 12 assertions
about that panel and not one of them read the caption.

`investCompare` returns `invest - debtLeft` over the debts listed on the screen.
It has never seen an account balance and it cannot see the house behind a HELOC.
The number was right; **the four words underneath it were a claim the function
had no way to support**, and they turned a partial figure into an accusation
about a person's whole life.

What is guarded now is the labelling, not the figure:
- no caption anywhere in the panel says *net worth in N yrs*
- both cards print the two halves that make them, and the halves reconcile to
  the number on the card (`invested - still owed = net`)
- the reporter's own shape stays **negative on both sides** - inventing a
  positive by folding assets in would be the same lie facing the other way
- the scope line names what is left out, including *your home behind Heloc*
- the gap is asserted to be identical with and without net worth added to both
  branches, which is the reason the comparison was still trustworthy

The general lesson, and the reason it is worth a section: **a caption is an
assertion, and it deserves a check like any other.** Assertions in this suite
overwhelmingly read numbers. This one read six words of prose sitting under a
number, and that is where the fault was.

### The third one, on the last day of a month

It happened again, and the shape was identical. A calendar check asserted
`aheadMarked === 1` - exactly one day in the fixture month still in the future.
That was true every day of August except the last one, and on the 31st the
month's final occurrence stopped being *ahead* and became *today*. No code
changed; the calendar was right; the number was a fact about the clock.

The rewrite captures the **partition** and checks it against `todayStr()`: every
listed day is `.ahead` if and only if its date is after today, and `.now` if and
only if it is today, with the on-screen wording required wherever each case
actually occurs. That assertion cannot go stale, because it is finally asserting
what its own name says.

Three date bombs now, all the same mistake: **a count that happens to hold today
is not the property.** If a check's expected value would change by waiting, it is
measuring the calendar.

## What these do NOT cover
- Whether a person understands what a number means. See `USER-TESTING.md` -
  every failure found by real people so far had correct arithmetic underneath.
- Whether the numbers a user types are true (nothing can verify that).
- Browser rendering differences; run the app on a real device before release.

## 10. `layout.mjs` - does it fit the phone it is on?

Every fault this suite exists for was found by a person looking at their own
phone, and none were found by the other nine layers - because the arithmetic was
right and the **pixels** were wrong.

It now also measures **the phone with the system font turned up**, which is where
the same person found the next two: a category name sliced through the middle of
a letter, and the Available column shortened to `$4...`. Neither is truncation;
both are a row lying about how much space it needs, and the suite could not see
either one because it only ever measured at the browser's default type size. The
Plan is re-rendered at 320, 390 and 412px with the row text painted half again as
large, and three rules hold at every one: no dollar figure is shortened (in a
pill or inside an input), no name is clipped or spilled past its row, and the
page still does not scroll sideways. Money first, deliberately - a plan whose
Available column reads `$4...` is not a plan, so the name is what yields.

The one that started it: a transaction row is four things on one line - date,
what it was, how much, delete. `.tx-amt` was `white-space:nowrap` with no
`flex-shrink:0`, so flex squeezed its **box** below its content and the amount
painted outside it, straight across the category chip beside it. Text on text,
on every row, at every width. `.tx-title` was one `nowrap` + ellipsis line
holding the chip and the note together, so a long category ate the whole width
and `"Rent for August, paid late"` truncated to three pixels of it.

Ten tabs at 320, 360, 390 and 430px, with a household whose names and amounts
are the awkward ones - a category that does not fit, a four-figure amount with
cents, a note longer than its row:

- no two unrelated pieces of text share pixels
- nothing is pushed off the side of the glass, and the page never scrolls
  sideways
- no label is crushed into a sliver - `"Mechanic..."` in 45px is not a label
- **no ordinary word is broken across lines.** A box squeezed narrower than its
  own words does not *overflow* - it wraps, one letter at a time, and grows tall
  instead of wide. `"Partner"` became `"Par / tne / r"` and every other check here
  was blind to it: nothing overlapped, nothing left the glass, nothing scrolled.
  The symptom that defines it is a **mid-word break**. Words over 20 characters
  are exempt (a long URL genuinely has to break), `nowrap` text is skipped (it
  cannot wrap, so multiple rects there are a clipping artifact), and hyphens and
  slashes are excluded because `"Wi-Fi"` splitting after the hyphen is typography
  rather than a fault. Verified the only way that counts: reverting the CSS fix
  makes it fail, and the fixture that triggers it - a biweekly income with cents
  and a long name - is now in `HOUSE`.
- an amount can never be squeezed below the number inside it, and the category
  chip is never shaved to fit beside it

Two things **are** stacked on purpose and are excluded by name: the two faces of
a flip stat card, which share one box because that is what a flip card is, and
the contents of a closed `<details>`, which Chromium still reports rects for.
Comparison is over **line boxes** rather than bounding boxes, because an inline
span that wraps to a second line has one rect spanning both and would otherwise
"overlap" everything above it - the first version of this suite reported 144
faults on Goals, and every one was that.

Verified by putting the original fault back: five of the six checks fail.

It also walks every rendered text element in **both themes** and asks the only
question that matters - can you read it? Anything under 1.6:1 against its
effective background is not low contrast, it is invisible. `palette.mjs` checks
token **pairs** and could never see the fault that prompted this: the Reorder
button carries `.btn ghost primary`, `.ghost` is declared after `.primary` at
the same specificity, so `.ghost` won the background while `.primary` still set
the text to `--on-accent` - near-white on near-white. The fault is not in any
pair, it is in which rule won on one live element.

Note the limit honestly: the sweep visits each tab's **default** state, so it
would not have caught that button either - it only turns invisible once pressed.
Stateful controls need their own checks, and the pressed Reorder button has one.

It found four more the same day it was written - a stat grid pushing a 320px
page sideways because a grid item's default `min-width:auto` refused to let
`$2,638.50` shrink, a category name leaning 9px onto `"Assign $"`, an impulse
row leaving 45px for its name, and the fourth Reflect sub-tab sitting off the
right edge of the glass with nothing to say it was there.

## 12. `funnel.mjs` - the money model, and the promise it could break

The app's only revenue path is also the easiest place to break a privacy promise
by accident. Every processor offers a checkout-overlay script that gives a nicer
flow; embedding one would load third-party payment code on a page whose headline
is *"nothing leaves your device"* - for **every** visitor, including everyone who
never clicks buy. A promise broken silently, by a convenience.

So: **link only, never a script.** The suite fails on any of Lemon Squeezy,
Stripe, PayPal, Gumroad or Paddle appearing in either file, and on any
`<script src>` pointing at a payment host. Verified by embedding a real
`lemon.js` tag - two checks fail.

It also holds the honest-by-default posture: with no checkout configured the
support panel stays hidden and no link points anywhere; with one configured, the
ask still waits until the app has earned it (20+ entries logged, or a purchase
actually talked out of), opens in a new tab with `rel=noopener`, says plainly
that **nothing unlocks**, and never reads as a plea - no "please", no "help us",
no "donate".

One note on the detector: the first version failed on both files because the
comments *explaining* why `lemon.js` is banned contain the string `lemon.js`. It
strips block and HTML comments before scanning. Line comments are left in on
purpose - stripping `//` to end-of-line would eat the rest of any line
containing `https://`, which is exactly where a real payment script would hide.

