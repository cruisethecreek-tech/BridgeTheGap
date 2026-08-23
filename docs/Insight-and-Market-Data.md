# Recommendations, and outside numbers

> **Status: both parts are built.** Part 1 shipped as the Accountability Report
> (Reflect opens on it). Part 2 shipped as Option B exactly as recommended -
> baked and dated, inflation and rates only, no equities, every figure tied to
> the user's own budget, with the 240-day staleness guard. `docs/DEPLOY.md`
> carries the refresh step.

Two questions, deep-dived:

1. Can the app give **accountability recommendations** from spending habits, investing
   habits and trends?
2. Can it show **national market fluctuations, projected inflation and interest
   rates** - as information, not advice?

Short answers: **(1) yes, and most of the ingredients are already built - what is
missing is the layer that puts them together and the discipline to stay quiet
when it does not know enough.** **(2) yes for inflation and rates, mostly no for
equities, and the right way to deliver it is almost certainly to ship the
numbers rather than fetch them.**

---

# Part 1 - recommendations from the user's own data

## What already exists

The app is further along here than it looks. It already computes:

| Engine | Where | What it says |
|---|---|---|
| `spendTendencies()` | `app.html` | Top category, priciest weekday, weekend share, repeat purchase. 90-day window, needs 6+ expenses. |
| Reflect › Breakdown | `renderBreakdown` | Where it went and came from, 1/3/6/12-month window, drill into a slice. |
| Reflect › Trends | `renderCharts` | Every category for one month, biggest first, walk back month by month. |
| Reflect › Net worth | `netWorth()` | Assets minus liabilities, running balance. |
| Reflect › In vs out | `renderCharts` | Income against expense. |
| `lessonPattern()` | talk-through | Groups past purchases by **cause**, and names a pattern once it has two of a kind. |
| True rate / blended wage | `recomputeBlendedWage` | What an hour of their life is actually worth after commute, prep and overhead. |
| Time ledger | `TIME_KINDS` | Hours invested vs hours leaked, priced at their own rate. |
| War Chest | impulse log | Money and hours kept by not buying. |
| Walls | `wallAssigned()` | Whether the essentials are actually covered. |

That is a lot of raw material. The gap is not measurement.

## What is missing

Four specific holes, each verified against the source rather than assumed:

**1. No month-over-month comparison.** "Trends" is a single-month chart you walk
backwards through. The app never says *"Takeout is up 40% on last month"* - the
user has to hold two screens in their head and do it themselves. This is the
single biggest miss, because a trend is the whole point of tracking and the app
currently makes the human compute it.

**2. No savings rate.** `grep -c "savingsRate" app.html` returns **0**. The app
knows income and it knows what was set aside, and it never divides one by the
other. Savings rate is the one number that most honestly summarises a month.

**3. Investing is a bare total.** `monthInvested(month)` sums the month and stops.
There is no consistency measure (did you invest every month, or once in March?),
no share-of-income, no streak. For an app with a growth lane, the investing side
is measured far more thinly than the spending side.

**4. No on-pace projection.** Nothing says *"eleven days in, at this rate you land
at $1,480 against a $1,200 plan."* The only mention of the word forecast in the
codebase is a caveat explaining that something is deliberately **not** one.

## The design: an Accountability Report

One destination that reads the user's data and tells them what it says. Not a new
chart - a **verdict layer** on top of charts that already exist.

Rules it has to follow, all of which the app already believes elsewhere:

- **Silence over speculation.** Every signal declares the data it needs. Below
  that, it does not appear at all - it does not appear greyed out, hedged, or
  with a smaller number. `spendTendencies()` already does this (`exp.length < 6`
  returns `null`) and it is the right precedent.
- **Show the working.** Every claim carries its arithmetic, the way the leak
  finder and the recap already do. A recommendation the user cannot check is a
  recommendation they should not trust.
- **Observation plus a choice, never an instruction.** "Takeout is up 40% on last
  month" is an observation. "Cut your takeout" is advice. The app's whole voice
  is the first thing.
- **Never congratulate someone who is drowning.** Already enforced by
  `tests/intake_cost.mjs` and `iaTone()`; the report inherits it.

### Signals worth computing

Each one below is cheap - the data is already in `state`.

| Signal | Needs | Says |
|---|---|---|
| Category drift | 2 months with spend in that category | "Takeout: $310 this month vs $220 last. Up 41%." |
| Savings rate | income + set-aside in a month | "You kept 12% of what you earned." |
| Savings rate trend | 3 months | "12%, 9%, 4% - it has fallen every month since June." |
| Investing consistency | 3 months | "You invested in 2 of the last 3 months. $500 total, 5% of income." |
| On-pace | 5+ days into a month, a plan | "11 days in. At this rate: $1,480 against a $1,200 plan." |
| New habit forming | same note 3+ times in 30 days, absent in the 30 before | "'DoorDash' appeared 5 times this month and never before that." |
| Habit ended | a note that stopped | "No 'Cigarettes' logged in 34 days. That is $190 and 7.8 hours kept." |
| Essentials drift | walls + 2 months | "Your essentials took 68% of income, up from 61%." |
| Hours traded | wage + spend | "You spent 94 hours of your life this month. 12 of them on things you called a trap." |

The last one is the app's actual thesis and nothing currently states it as a
monthly figure.

### Where it lives

Reflect already exists as "one place to reflect" and has sub-tabs. The report is
a fifth sub-tab, or better, the **first thing Reflect shows** - the verdict, with
the charts underneath as the evidence. That ordering matches how the app already
treats the intake recap.

---

# Part 2 - outside numbers

## "Market data" is three different things

Worth separating, because they have very different value here and very different
availability:

**(a) Inflation (CPI).** Monthly, public domain, slow-moving, and *directly*
relevant to a budget. This is the one that matters most for this app - see below.

**(b) Interest rates.** Fed funds, treasury yields, mortgage rates, savings APY.
Monthly to daily, public, relevant to anyone with debt or savings.

**(c) Equity markets** - "national market fluctuations". Daily, volatile, mostly
**licensed** rather than public, and the **least** useful thing a zero-based
budgeting app could show. A ticker on a budgeting screen invites exactly the
behaviour this app exists to fight: reacting to a number that moved today. My
recommendation is to not build (c) at all, and it is the only part of this
request I would push back on.

## Three hard constraints

**1. A static app cannot keep an API key.** Anything shipped in `app.html` is
public. FRED, most rate APIs and essentially all equity data require a key, so
they are unusable directly - not difficult, *unusable*, because publishing the
key is both a terms violation and an invitation to have it revoked.

**2. CORS.** A browser can only read a cross-origin response if that server sends
`Access-Control-Allow-Origin`. Many government APIs do not. **I could not verify
this from here** - this sandbox's network policy denies `api.bls.gov`,
`api.stlouisfed.org` and `api.frankfurter.app` at the proxy (403 on CONNECT), so
any CORS claim I made would be a guess. It has to be tested from a real browser
against each candidate before anyone commits to a live-fetch design.

**3. "Never phones home" is the product.** It is in the meta description, the
landing hero eyebrow, and a whole section headed *"Nothing leaves your device."*
Every outbound call that exists today - the Tesseract reader, the Supabase sync
SDK, the newsletter POST - is **user-initiated and opt-in**, and none of them
send financial data. A market-data feature that fetches on load would break the
strongest promise the app makes, for a number that changes monthly.

Note the nuance: fetching public data **sends nothing about the user**. The cost
is an IP address and the fact that the app is running. That is small, but it is
not zero, and the claim on the landing page is currently absolute.

## Three ways to deliver it

### Option A - live fetch from keyless sources, opt-in

Off by default, behind an explicit toggle worded like the OCR reader's.

- *For:* always current.
- *Against:* CORS unverified; needs network; rate limits (BLS v1 is roughly 25
  queries/day per IP); a third party can change or drop the endpoint and the
  feature silently dies; and it dents "never phones home" even when opt-in.

### Option B - ship the numbers, do not fetch them (recommended)

Bake a small dated table into the app - CPI, fed funds, average mortgage rate,
average savings APY - and refresh it when you deploy.

- *For:* no key, no CORS, no network call, works offline, **keeps the privacy
  promise absolutely intact**, and cannot break because someone else's API
  changed. The app already redeploys regularly, and `sw.js` already precaches.
- *Against:* as fresh as the last deploy. That is genuinely fine for CPI (monthly)
  and rates (slow), and genuinely not fine for equities - which is a further
  argument for dropping (c).
- *Requirement:* every figure is stamped **"as of August 2026"** on screen. A
  stale number presented as current is the one way this feature could actually
  hurt someone.

### Option C - a proxy

A tiny serverless function holding the key and adding CORS headers.

- *For:* unlocks every source including keyed ones.
- *Against:* it is a server. Recurring cost, an operational dependency, and the
  privacy story changes from "nothing leaves your device" to "trust our proxy".
  For a monthly CPI print, that is a large price.

## What it should actually DO with the numbers

This is the part that makes it worth building at all. A number on a screen is
trivia. Connected to *their* budget it is information, and this app has a
uniquely good hook for it: **hours of your life**.

- **Wage vs CPI.** "Your rate has been $24/hr since January. Prices are up 3.1%
  since then. Your hour buys about 3% less than it did." That is the app's entire
  thesis, stated with an outside number, and it is an observation rather than
  advice.
- **Category vs its own index.** "Your grocery spend is flat at $650. Food prices
  are up 2.4% this year. You are bringing home slightly less food for the same
  money." Devastating, true, and impossible for the user to work out alone.
- **Savings vs rates.** "Your $2,150 is in a checking account. Average savings
  APY is X%. At that rate it would earn about $Y a year." Information. It names
  no product, recommends no bank, and links nowhere - which is also what keeps it
  clear of the referral trap the Monetization doc already decided against.
- **Debt vs rates.** Their card is at 23.9%. Context on what that is relative to
  prevailing rates is fair information.

## What it must never do

- Project returns, or imply any figure will continue.
- Show a daily-moving number anywhere near the impulse tools.
- Name a product, fund, bank or ticker - the moment it does, it is advice and it
  is also a referral surface.
- Present a stale figure without its date.
- Sit behind a paywall. `docs/Monetization.md` already rules out feature-gating
  inside the app.

A single standing line of copy, in the app's own voice, should carry the frame:
*this is what the outside numbers are, not what you should do about them.*

---

# Recommendation

**Build Part 1 first, and build it fully.** It uses data the app already has,
breaks no promises, needs no network, and closes four real gaps - month-over-month
drift, savings rate, investing consistency, on-pace. It is also the part the user
actually asked for first, and the part that makes the app *more* itself.

**Then Part 2 as Option B**, scoped to inflation and interest rates only, every
figure dated, and every figure connected to something in the user's own budget
rather than displayed on its own. Drop the equity ticker.

**Before any live-fetch design, verify CORS from a real browser** against each
candidate source. That test has not been run and cannot be run from this
environment.
