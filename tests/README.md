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

## What these do NOT cover
- Whether a person understands what a number means. See `USER-TESTING.md` -
  every failure found by real people so far had correct arithmetic underneath.
- Whether the numbers a user types are true (nothing can verify that).
- Browser rendering differences; run the app on a real device before release.
