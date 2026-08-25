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
```

Requires a Chromium that Playwright can drive; the scripts point at
`/opt/pw-browsers/chromium` and are run from the repo root.

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

And **sheet height**: every modal is opened at 700, 780 and 844px and has to fit,
keep its ✕ on screen and hit-testing to itself, and put the overflow on its body
rather than on the sheet. Uncapped, the app map wanted 938px and pushed its own
close button to `y=-115`.

It also checks **id uniqueness in the live dom**, which building this earned: a
panel ended up carrying two `id` attributes, the browser kept the first, and the
code that had been hiding it silently stopped finding it.

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

## What these do NOT cover
- Whether a person understands what a number means. See `USER-TESTING.md` -
  every failure found by real people so far had correct arithmetic underneath.
- Whether the numbers a user types are true (nothing can verify that).
- Browser rendering differences; run the app on a real device before release.

## 10. `layout.mjs` - does it fit the phone it is on?

Every fault this suite exists for was found by a person looking at their own
phone, and none were found by the other nine layers - because the arithmetic was
right and the **pixels** were wrong.

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

