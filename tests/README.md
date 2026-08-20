# Math audit

Three layers, because each catches what the others cannot. Run all three before
any public release.

```bash
node tests/math_audit.mjs 400        # property fuzz (optionally: <states> <seed>)
node tests/math_edges.mjs            # hostile inputs
node tests/math_golden.mjs           # hand-computed scenario
node tests/math_claims.mjs           # every money claim, hand-verified
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

## What these do NOT cover
- Whether a person understands what a number means. See `USER-TESTING.md` -
  every failure found by real people so far had correct arithmetic underneath.
- Whether the numbers a user types are true (nothing can verify that).
- Browser rendering differences; run the app on a real device before release.
