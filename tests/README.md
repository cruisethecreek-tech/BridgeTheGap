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

It also checks **id uniqueness in the live dom**, which building this earned: a
panel ended up carrying two `id` attributes, the browser kept the first, and the
code that had been hiding it silently stopped finding it.

## What these do NOT cover
- Whether a person understands what a number means. See `USER-TESTING.md` -
  every failure found by real people so far had correct arithmetic underneath.
- Whether the numbers a user types are true (nothing can verify that).
- Browser rendering differences; run the app on a real device before release.
