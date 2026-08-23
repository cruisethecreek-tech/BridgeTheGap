# Audit prompt - logic, mathematics and computation

For an independent model (Gemini, or any other) to review the money math with no
loyalty to how it was built. Attach `app.html`, the `tests/` folder, and this
file. Copy everything below the line.

---

You are auditing the computational correctness of a personal budgeting web app.
Real people will make real financial decisions from these numbers. A wrong figure
here is not a cosmetic defect: it can tell someone they can afford something they
cannot, or that a debt clears years before it does.

Your job is **logic, mathematics and computation only**. Not design, not copy,
not architecture, not performance, not style.

## The subject

`app.html` is a single-file offline PWA, roughly 10,000 lines of HTML, CSS and
vanilla JavaScript. All state lives in one `localStorage` object. There is no
backend and no external data source. Every number on every screen is computed in
this file from what the user typed.

## Ground rules of evidence

The single most useful thing you can do is be **specific and reproducible**. The
single most damaging thing you can do is produce a list of plausible-sounding
findings that are not real, because each one costs hours to disprove.

Therefore, for every finding you report:

1. Name the **function and line**.
2. Give a **concrete input** - actual numbers, dates, a state object - that
   triggers it.
3. State **expected vs actual**, with the expected value worked out **by hand**
   in your answer, step by step, so the arithmetic can be checked without running
   anything.
4. State the **consequence to a user in money or time**: what would the screen
   tell them, and what is the truth?
5. Rate confidence: **Certain** (you traced the arithmetic), **Likely** (you
   reasoned it through but did not fully trace), **Suspect** (worth checking).

If you cannot produce a triggering input, do not report it. Say instead, in a
separate short section, "areas I could not fully verify" and name them.

**Do not trust the tests.** There are eleven suites in `tests/`. They all pass.
A passing test is a **claim to verify, not proof** - during development two of
them passed while asserting hand-arithmetic that was itself wrong, and one
"detector" reported 144 faults that were all artefacts of the detector. Read the
tests as documentation of intent, then check whether the assertion is actually
correct. **A wrong test hiding a real bug is the highest-value finding you can
produce.**

## What is already covered (verify, do not merely repeat)

- `math_audit.mjs` - property fuzz over hundreds of random states
- `math_edges.mjs` - hostile inputs: empty, 9e12, negatives, fractional cents,
  leap days, month-end anchors, corrupt records
- `math_golden.mjs` - one household with the arithmetic written out longhand
- `math_claims.mjs` - every user-facing money claim, hand-verified
- `budget_sim.mjs` - a household budgeting through a full month and a rollover
- `life_units.mjs` - the hours-of-your-life conversion layer
- `structure.mjs` - behaviour, including the debt planner and the report

## Where the money math lives

Go deep on these rather than broad across the file.

**The category tree** (`catAssigned`, `catSpent`, `assignedFor`, `spentFor`,
`kidsAssigned`, `topCats`, `childrenOf`, `descendantsOf`). Categories nest three
levels. A parent's budget is `max(its own figure, sum of its children)`.
Ask: can money be double-counted or lost at any level? Does the rule hold when a
parent has both its own figure and children? What happens to a child's spending
when the parent is deleted?

**Month boundaries** (`monthOf`, `thisMonth`, `todayStr`, `localYMD`,
`shiftMonth`, `daysInMonth`, `txnsInMonth`). All dates are local `YYYY-MM-DD`
strings. Ask: is there any path where UTC and local disagree? What happens on
Dec 31 / Jan 1, on a leap day, and across a DST boundary?

**Recurring schedules** (`recMonthly`, `recOccurrences`, `recNextDue`,
`recAnchor`, `postRecurring`, `leakMonthly`, `leakFreqMult`). Frequency
conversions use `WEEKS_PER_MONTH = 52/12` and `DAYS_PER_MONTH = 365/12`.
Ask: can an occurrence post twice, or fall outside its month? Is posting
idempotent? What does a monthly schedule anchored to the 31st do in February?

**Debt** (`simulateDebts`, `debtPaymentFor`, `investCompare`). Monthly interest
is `balance * apr / 100 / 12`, applied before payments. `debtPaymentFor` binary
searches the simulation for a payment that clears within N months.
Ask: is interest applied at the right point in the cycle? Can the binary search
return a payment that does not actually clear, or miss one that would? Is the
avalanche/snowball ordering correct at every step, or only the first? What
happens when two debts tie?

**Wage and hours** (`effectiveHourly`, `recomputeBlendedWage`, `hourlyFor`,
`monthHours`, `yearHours`, `fmtLife`, `fmtHours`, `estHourlyFromMonthly`,
`intakeBlendedHourly`). The app prices purchases in hours of the user's life.
Ask: is the blended wage worked income over worked hours, with no passive income
inflating it? Can a value be converted to hours twice? Can it divide by zero?

**Net worth and balances** (`netWorth`, `sumAssets`, `sumLiab`, `bankTotal`,
`liquidTotal`, `allTimeBalance`, `investAssetAdd`). The identity is
`netWorth = assets + bank - liabilities`, and `allTimeBalance = income - expense
- invest`. Ask: does deleting an investment transaction correctly unwind the
asset it created? Can the two identities disagree?

**The report** (`REPORT_SIGNALS`, `buildReport`, `rpPct`, `rpByCat`, `rpNotes`,
`rpLife`) - newest code, least exercised. Each signal turns data into a claim.
Ask: does any signal divide by zero, extrapolate from one data point, compare
across windows of different lengths, or state a percentage that its own shown
arithmetic does not produce? Does the on-pace projection handle a month that has
only just started, or a month in the past?

**Suggestion and classification** (`suggestCatFor`, `guessCat`, `growthKindFor`,
`categoryWall`, `wallAssigned`, `mergeDuplicates`). These do not compute money,
but they decide **where money lands**, which has the same consequence.
Ask: can a purchase be filed somewhere that changes a total incorrectly? Can
merging duplicates lose or duplicate an assignment?

## Adversarial inputs to try against every one of the above

Zero. Negative. One cent. `0.1 + 0.2`. A balance of 9,999,999,999. A single
transaction. A category with no name. A subcategory whose parent was deleted. A
recurring item anchored to the 31st. A month with no income. A month with income
and no spending. A user with no wage set. Two debts with identical balance and
rate. A plan of exactly zero. A date in the future. A date in 1970.

Specifically hunt for:

- **Floating point accumulation** over many iterations (the debt simulation runs
  up to 121 months; the report sums arbitrary transaction lists).
- **Division by zero or by a value that can be zero**, producing `Infinity` or
  `NaN` that reaches a screen.
- **Percentages that can exceed 100 or go negative** where the copy assumes they
  cannot.
- **Off-by-one in month or day counts** - especially anything using
  `new Date()` mid-calculation rather than a fixed date string.
- **Any figure shown next to its own arithmetic where the two disagree.** The app
  prints the working under several claims. If the working does not produce the
  number, that is a certain finding.
- **Order-dependence**: does any total change depending on the order transactions
  or categories happen to be in?

## What NOT to report

- Style, naming, formatting, file structure, framework choices.
- Performance, unless a computation is wrong because of it.
- Copy or tone, unless a sentence states a number that the code does not produce.
- Accessibility, security, privacy - separate audits.
- "Consider adding X" suggestions. Only defects in what exists.
- Anything you cannot trigger with a concrete input.

## How to run it

If you can execute code, from the repo root:

```
node tests/math_audit.mjs 400
node tests/math_golden.mjs
node tests/math_claims.mjs
node tests/budget_sim.mjs
```

They need a Chromium that Playwright can drive. If you cannot execute anything,
do it statically: read the functions, hand-compute worked examples, and say
plainly that you could not run them.

Better than running the existing suites: **write your own worked example**. Take
one household, compute every headline figure by hand, then trace the code and see
whether it agrees. That is the method that has caught the most here.

## Output format

Start with a one-paragraph verdict: is the money math sound, and what is the
single most dangerous thing you found?

Then findings, **ordered by consequence to a user**, not by how interesting they
are. For each: title, file and line, triggering input, hand-worked expected vs
actual, user consequence, confidence.

Then: areas you could not verify.

Then: any test in `tests/` whose assertion you believe is **itself wrong**.

If you find nothing in a section, say so explicitly. "No findings" is a real and
useful result. Do not manufacture findings to fill a section, and do not soften a
serious one to be agreeable.
