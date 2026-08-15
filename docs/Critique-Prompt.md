# Critique prompt (for Gemini or any evaluator)

**How to use it.** This prompt is self-contained — it describes the app in text, so
you can paste it alone and get a critique of the *summary*. For a real critique,
**attach the actual files** so the evaluator judges the real thing:

- `app.html` — the whole app in one file (all copy, UX, logic).
- `index.html` — the landing page (this is what the StoryBrand / grunt-test parts judge).
- 4–6 screenshots (Home, Shield gut-check, Build, the landing hero, the reward calendar) —
  the evaluator reads HTML but doesn't *see* the rendered result; screenshots fix that.

The evaluator only knows what you paste — it has no access to the repo. It critiques;
it doesn't change code. Bring its verdict back to the build session to turn the good
parts into real changes.

Copy everything below the line.

---

I've attached the actual app (`app.html`), the landing page (`index.html`), and
screenshots. Critique the **real implementation** — the actual copy, flows, and visuals —
not just my summary. Quote specific lines and screens you'd change. (If nothing is
attached, critique the description below and say what you'd need to go deeper.)

You are a skeptical review panel for an early-stage product. Play **four** experts
explicitly, and let them disagree with each other:

1. A **StoryBrand / brand-messaging strategist** (Donald Miller SB7 school).
2. A **senior fintech product & UX designer** (mobile-first).
3. A **behavioral economist / money psychologist**.
4. A **fintech founder-investor** who has watched dozens of budgeting apps die.

**Rules:** Do not flatter me. No encouragement for its own sake. Assume I can take blunt
criticism and would rather hear the fatal flaw now than later. Where you praise something,
justify it. Call out dark patterns, feature bloat, legal/liability risk, and anything that
drives churn. Be specific — generic advice is worthless to me.

## The product

**Name:** "Accountability" — an unfiltered, privacy-first zero-based budgeting web app
(installable PWA). Tagline: "Every dollar answers to you."

- **Tech:** single self-contained HTML file, vanilla JS, no accounts, no backend. All data
  is local to the browser; nothing leaves the device. Works offline; installable to a phone.
- **Tabs:** Home, Plan, **Shield** (anti-impulse gut-check), **Build** (net worth, goals,
  giving — as collapsible sections), plus Track, Debt, Learn, Settings.
- **Signature mechanic:** "Freedom Mode" reprices every dollar in the app as **hours of your
  life**, using a true net hourly wage. A "Trap Radar" gut-check and a 24-hour cooling vault
  intervene *before* an impulse buy.
- **Voice engine:** copy adapts by generation (Gen Z / Middle / Mature) and intensity
  (Clean / Blunt / Savage); explicitly anti-shame (slips are "data points," never failures).
- **Modes:** a full-budget path and a lighter "just my spending" mode with a reward calendar
  (daily allowance → streak). Household mode for couples. A debt payoff planner
  (snowball/avalanche) with an invest-instead comparison.

## The positioning (my current StoryBrand)

- **Hero (customer):** the "capable-but-leaking" earner — makes real money, still can't say
  where a third of it goes, done being surveilled or talked down to.
- **What they want:** "I want to be the one my money answers to."
- **Villain:** "The Trap" — frictionless checkouts and nudges that keep you on autopilot.
- **Guide promises:** nothing leaves your device; free (no paywall); no shame.
- **One-liner:** "Most people who make good money still watch it slip away — and every app
  that offers to help wants their bank login in return. Accountability is a brutally honest
  budgeting app that lives only on your device and prices every purchase in the hours of life
  it costs — so you stop leaking money and start buying back your freedom."
- **Direct CTA:** "Open the app — free."

## How it makes money

Free and private. A weekly "gut-check" email opt-in, and **disclosed** affiliate/referral
links (e.g. Acorns, Stash) shown only in the "what to do with the money you saved" prompt.
No user data is sold; no feature is gated.

## What I want from you

**A. Grunt test.** In ~5 seconds, does the pitch answer (1) what is it, (2) how does it make
my life better, (3) what do I do next? Score each pass / partial / fail.

**B. StoryBrand audit.** Is the **hero** clearly the customer, not the brand? Is the **want**
singular and primal? Is the **villain** sharp? Is **authority** too thin? Is there a real
**stakes** beat and a clear **3-step plan**? Rate my one-liner, and rewrite it better if you can.

**C. Score each 1–10** with a one-paragraph justification: concept & market fit; positioning
clarity; differentiation & moat; UX & scope discipline; behavioral soundness (and where it
could **backfire** — shame, over-gamification, the "savage" tone); financial correctness &
liability; retention / habit loop; monetization realism; privacy-as-a-wedge.

**D. Then:** top 3 genuine strengths; top 3 things most likely to **kill it** (ranked); the
single highest-leverage change in the next 30 days; a prioritized 5-step roadmap; and an honest
read on the **affiliate tension** — does pointing a privacy-first, anti-consumerist audience
toward investing apps for a referral kickback undercut the trust that is the whole moat? How
would you resolve it?

**E. Final verdict:** pick one — *strong yes / qualified yes / pivot / no* — and defend it in
3–4 sentences. Give me a sharper one-line positioning than mine if you can write one.

**Context:** solo/early prototype, not funded. Weigh the idea and the story over polish, but be
realistic about execution and go-to-market. I can also paste more screenshots — tell me what
else you need to sharpen this.
