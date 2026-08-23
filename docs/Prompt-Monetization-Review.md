# Prompt - monetization strategy review

For an independent model (Gemini) to pressure-test how this app should make
money. Attach `docs/Monetization.md` and `index.html` alongside this prompt if
you can; everything essential is restated below either way. Copy everything
below the line.

---

You are reviewing the monetization strategy for a shipped, working product. Your
job is to find the best realistic path to revenue for a solo founder, and to
attack the current plan where it is weak. You are not being asked whether the
product should exist - it exists, it is live, and it works.

Play a panel of four who genuinely disagree with each other: a fintech
founder-investor who has priced consumer products, a pricing strategist, an
indie-hacker who has actually run solo one-person software businesses on
Gumroad/LemonSqueezy/app stores, and a consumer-brand strategist focused on
trust positioning. Let them argue. Judge results, not effort.

## The product, in facts

- **Accountability** (accountability.money): a zero-based budgeting web app that
  prices every purchase in hours of the user's life, fights impulse buys in real
  time, and speaks with a deliberately unfiltered voice.
- **Architecture**: one static HTML file, no backend, no accounts, no bank
  linking. All data lives in the browser's localStorage. Hosted free on
  Cloudflare Pages. Marginal cost per user: zero.
- **The differentiator is a promise**: "No account. Nothing leaves your device.
  Never phones home." It is on the landing page as an absolute claim, and the
  entire trust position depends on it staying true.
- **One optional paid-shaped feature exists in code**: end-to-end-encrypted
  two-phone household sync (client-side AES-256-GCM, passphrase never leaves the
  devices, a Supabase table that only ever holds ciphertext). It is inert until
  configured. This is the only feature with recurring infrastructure cost.
- **Founder**: solo, non-corporate, building under the "cruisethecreek" name,
  with content/audience ambitions but no meaningful audience yet. Assume limited
  hours per week and no appetite for compliance burden.
- **Audience thesis**: privacy-conscious people, FIRE/frugality communities, and
  people burned by Mint-style apps that monetized their data.

## Non-negotiable constraints - do not spend words proposing violations

1. **No monetizing user data, ever.** No analytics resale, no lead-gen, no
   bank-link partnerships. This is the moat; selling it is burning it.
2. **No affiliate links to financial products.** This was BUILT, then removed
   on a strategy review's argument the founder accepted: the app's villain is
   "the Trap" - engineered nudges toward spending - and an affiliate link next
   to a user's saved money makes the app the Trap. Do not relitigate unless you
   have a genuinely new argument, and expect to lose.
3. **No fake client-side locks.** Everything ships as readable source; a "Pro"
   flag in localStorage is flippable in 30 seconds, and a savvy user flipping it
   experiences catching the app in a lie. Enforced payment must live where
   enforcement is real: a store, or a server-side entitlement for the sync tier.
4. **The privacy claims stay absolute** for the local app. The sync tier is the
   one scoped exception and its copy already says so.
5. Ads are not formally banned but treat them as brand-hostile; argue for them
   only if you can carry the burden of proof, which is heavy.
6. **Time has a hard cost.** For every unit-economic and break-even calculation,
   value the founder's time at exactly **$100/hour**. Every hour spent on
   customer support, tax compliance, or arguing with App Review is a $100 debit
   against the bottom line. This is a modelling constant, not a market wage -
   its job is to stop "just spend a weekend on it" from reading as free. Use it
   consistently and show it in the arithmetic.

## Platform status - already decided, now judge it

Since this doc was first written, **Lemon Squeezy has been chosen, wired and
tested** as the checkout, on merchant-of-record grounds. The integration is a
plain link (never their overlay script, which would put third-party payment code
on a page promising nothing leaves the visitor's device). Both files stay inert
until the URL is set; nothing has been sold yet.

So do not treat channel choice as greenfield. Judge the decision that was made:
**was merchant-of-record worth the fee premium for this specific seller, and is
Lemon Squeezy the right MoR given Stripe is folding it into Stripe Managed
Payments with no announced end date?** If you would reverse it, say so and price
the reversal.

## What the current plan says (attack this)

From the founder's own strategy doc:

1. Ship free with a tip-jar link.
2. Add a one-time honor-system purchase (~$15-25, "the app has no lock; you are
   buying trust and supporting the maker") via Gumroad or LemonSqueezy.
3. Market to three named communities (FIRE subreddits, no-buy/frugal circles,
   privacy circles), not "everyone".
4. Only if there is pull: wrap the PWA for the app stores as a paid app - the
   store is the only real paywall this architecture can have.
5. Later, maybe: the encrypted sync tier as the one recurring-price feature,
   priced recurring because its costs recur, sold as "we structurally cannot
   read your data".

## The questions to answer

**1. Pricing, and why anyone pays at all.** Is $15-25 one-time right? What do
comparable tools actually charge and what does that imply here - YNAB, Monarch,
Copilot, PocketSmith, Lunch Money on the subscription side; Actual Budget (free,
open-source) as the zero-price anchor; and any honor-system or DRM-free indie
comps you can name with real numbers. What does pay-what-you-want with a floor
actually do to revenue in practice?

Then the question that actually decides this model. There is no lock, the source
is readable, and the buyer already has everything. **So why does a human open
their wallet?** Map the specific behavioural mechanism - reciprocity, identity,
guilt, signalling, sunk investment in their own data, something else - and say
which one this product can honestly pull on.

**Then write the checkout copy: two sentences, in the app's own blunt voice.**
Constraints on that copy, and they are hard: the app's test suite fails the build
if the ask reads as a plea, so **no "please", no "help us", no "donate", no
guilt, no manufactured scarcity.** The app's declared villain is manipulative
design; copy that guilts someone into paying makes it the thing it condemns and
is an automatic fail. Blunt is welcome. Coercive is not. Show the two sentences
verbatim.

Finish with **one number** you would charge, and defend it.

**2. Channel mechanics - do the arithmetic, do not estimate it.**

Use these rates. They were checked against current published pricing in August
2026; if you have better information say so, but do not silently substitute
half-remembered numbers:

| Platform | Fee | Merchant of record? |
|---|---|---|
| Lemon Squeezy | 5% + $0.50 | **Yes** |
| Gumroad | 10% direct sale (sources disagree on whether a fixed ~$0.50 applies; one all-in estimate lands near 12.9% + $0.80 once card processing is counted) | **Yes** |
| Stripe payment link | 2.9% + $0.30 | **No** |

Two things the simple table hides, and both matter for this seller:

- Lemon Squeezy **stacks**: roughly +1.5% on international cards, +1.5% on
  PayPal, and ~1% on payouts to non-US banks. A privacy-first indie app sells
  heavily outside the US, so model the international case, not just the domestic
  one.
- The Gumroad number is genuinely contested across sources. Treat the spread as
  real uncertainty and say how much it changes the answer.

**Calculate the exact net payout on a $25 sale** on each, domestic and
international. Then, using the $100/hour constant, **quantify the liability of
running global VAT and US sales tax yourself on Stripe** versus paying the MoR
premium: registration, filing cadence, thresholds, and the hours per year. Show
the break-even sale volume at which each option wins.

Then judge the decision already made (see "Platform status" above): keep Lemon
Squeezy, or move, and what moving would cost.

**3. The app-store wrap.** Costs and cuts (developer fees, the 15% small-business
tiers), the real risk that a thin PWA wrapper gets rejected, the maintenance tax
of a native shell, and whether a paid listing is worth it BEFORE there is
evidence of web-side demand. Sequence it.

**4. The sync tier - solve for N.** Use these constants: Supabase Pro at
**$25/month**; a merchant of record taking **~6%** all-in; the founder's time at
**$100/hour**; and support for end-to-end-encrypted sync edge cases costing at
**least 2 hours a month** (a passphrase nobody can reset generates support load
by design - and it cannot be resolved by the founder, who structurally cannot
read the data, which makes each ticket longer, not shorter).

At what monthly price, and **exactly how many paying households N**, does this
tier clear its own infrastructure plus its own maintenance time? Show the
arithmetic. If N is uncomfortably high, say the number out loud and say what to
do instead until it is reached - including whether the honest answer is "do not
ship this tier at all".

**5. The audience play.** The founder's strongest long-term asset may be
distribution (content around Life-Hour pricing, Trap Radar, the app's voice).
Give a realistic view: what does the app-as-lead-magnet path earn, on what
timescale, at what content cadence - and does it conflict with charging for the
app, or compound with it?

**6. Sequencing and kill-criteria.** Produce a 90-day plan for a solo founder at
roughly 5-10 hours a week: what ships in which order, what each step costs,
what signal advances to the next step, and - just as important - the number
that says STOP, this channel is dead. Then give revenue scenarios (pessimistic /
median / good) for year one with your assumptions stated, so the founder can
tell ambition from arithmetic.

**7. What would change the answer.** Name the two or three observations that
should flip the strategy (e.g. "if X% of visitors click the tip jar", "if the
App Store listing outsells web 5:1").

## Evidence rules

- Label every number as **fact** (you are confident it is current and real) or
  **estimate** (your reasoning, stated). Do not invent citations, prices, or fee
  schedules - if you are not sure of a platform's current fee, say so and
  reason with a range.
- Comps must be named products with their actual model, not "many apps do X".
- No generic advice ("build an email list", "post consistently") without the
  specific mechanism, cost, and expected magnitude attached.
- If a recommendation depends on effort the founder does not have (a backend, a
  support queue, a marketing budget), say so explicitly rather than assuming it.

## Output format

Start with a one-paragraph verdict: the single path you would bet on, and the
biggest weakness in the founder's current plan.

Then: the ranked options with unit economics; the panel's genuine disagreements
(where two experts would choose differently, show both cases rather than
smoothing them over); the 90-day plan; the kill-criteria; the year-one
scenarios; and what would change your mind.

Do not soften. The founder removed a working revenue channel on a reviewer's
argument once already - a correct hard argument will be acted on.
