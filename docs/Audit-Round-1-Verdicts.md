# Independent audit, round 1 - verdicts

An outside model (Gemini) ran `docs/Audit-Prompt-Math.md` against the full pack.
It returned ten findings and three criticisms of the tests themselves. Per the
working rule, every finding was reproduced here before anything was changed.
Scorecard: **9 of 10 findings confirmed** (one refuted as unreachable), **3 of 3
test criticisms confirmed** - including one that exposed a live bug in the
report engine that my own tests had hidden by seeding the same wrong field.

All fixes are pinned in `tests/structure.mjs` section 21, with the two timezone
cases running in pinned-timezone browser contexts.

| # | Finding | Verdict | Fix |
|---|---|---|---|
| F1 | Negative assignments invent free money | **Confirmed.** `catAssigned` returns `own` unfloored for childless categories; typing `-500` subtracted from the assigned total | Clamp at entry (`Math.max(0,...)`) and heal stored saves in `normalizeState` |
| F2 | Auto-Rebalance destroys money via `max()` pooling | **Refuted as reachable.** The mechanism is real if called with a subcategory id, but `data-rebal` only renders on top-level categories and nothing else calls it. Pinned: no sub target can exist, and real targets conserve to the dollar | Regression test only |
| F3 | Merging duplicates loses money to `max()` pooling | **Confirmed.** $100-own merged with $50-in-kids became $100 | Effective totals computed per month before the tree is touched; survivor gets the sum |
| F4 | Textual CSV dates shift a day east of Greenwich | **Confirmed.** The fallback used `toISOString()` - the very trap a comment 2,000 lines earlier warns about | `localYMD(d)` |
| F5 | Semimonthly on the 15th posts on Feb 1 | **Confirmed.** `aDay-15` hit zero and clamped to the 1st | Month-end when there is no room for the second date |
| F6 | Minimums not capped at balance lock the planner | **Confirmed.** $10 balance + $50 min + $30 budget refused to run for the person one payment from done | `min(min, balance)` in all three checks |
| F7 | Snowball ties break toward maximum interest | **Confirmed** - and their suggested tie-break was insufficient, because interest lands before the sort so tied balances are never tied at sort time. | Rank on the pre-interest (statement) balance, ties toward the dearer rate |
| F8 | The "started" signal prints a false equation | **Confirmed.** `3 × $3.33 = $10.00` after rounding | Division form with ≈, which rounding cannot falsify |
| F9 | Debt subcategory payments invisible to Offense/Defense | **Confirmed.** Name regex checked only the row's own name | Matching categories now include their whole subtree |
| F10 | ms day-arithmetic drifts across DST | **Confirmed.** 30 x 86,400,000 ms is 30 days only when no DST jump intervenes | `shiftDays()` does calendar arithmetic; all shift-then-format sites converted (differences, which round the DST hour away, were left alone) |

## The test criticisms - all three confirmed

**T1** - `budget_sim`'s "partly-split pool" check claimed to prove a sub can
overspend its own line while the pool absorbs it, with data where the sub spent
118 of its 120 and never overspent. The property was asserted against a case
that never triggered it. Electric now spends 140 and both halves are pinned.

**T2** - the rollover test re-implemented the copy inline (`Object.assign`)
instead of calling `copyPrevPlan()`, so a broken or unhooked real function would
still have passed. It calls the real one now and asserts its return.

**T3** - `life_units` seeded `verdict:'skip'` where the app writes
`type:'skip'`, so the War Chest computed $0 and the check matched a vacuous
string. **This one mattered most**: chasing it revealed the report's hours
signal filtered on `i.decision==='buy'` - a field the impulse log has never
written - so the "called a trap" clause could never fire in production. My own
report test seeded the same wrong field and passed. That is the exact failure
mode the audit prompt warned about: the author's tests encode the author's
assumptions.

## What this round says about the process

The outside model found real bugs in code that eleven green suites covered,
found them where the suites could not look (tie-breaking order, DST boundaries,
foreign-timezone parsing, a field-name mismatch between two modules), and its
single wrong finding was wrong in a way that took one grep to settle. The
prompt's evidence rules held: every finding came with a triggering input, which
is why reproduction took an hour instead of a day.
