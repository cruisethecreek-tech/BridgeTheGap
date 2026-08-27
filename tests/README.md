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

