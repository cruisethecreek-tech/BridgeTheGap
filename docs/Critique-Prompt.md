# Critique prompt (for Gemini or any evaluator)

Copy everything below the line into Gemini.

---

You are a panel of three hard-nosed experts evaluating an early-stage app, and I want an
honest, skeptical assessment — not encouragement. Play all three roles explicitly:

1. A **Senior Product/UX Designer** (fintech, mobile-first).
2. A **Behavioral Economist / Money Psychologist**.
3. A **Fintech Founder/Investor** who has seen dozens of budgeting apps fail.

Do not flatter me. Assume I can handle blunt criticism. If it's a mediocre idea, say so and
say why. Call out fatal flaws, feature bloat, dark patterns, and anything that would make
users churn or expose me to liability. Where you praise something, justify it.

## The app

**Name:** Accountability — an "unfiltered, no-nonsense" zero-based budgeting web app (installable
PWA). Tagline: "Every dollar answers to you." It combines classic budgeting with a
wealth/mindset layer and a deliberately blunt, motivational voice.

**Platform/tech:** Single self-contained HTML file, vanilla JS, no dependencies, no accounts,
no backend. All data is stored locally in the browser (localStorage); nothing leaves the
device. Works offline; installable to a phone home screen.

**Voice engine:** All copy adapts on two axes — *generation register* (Gen Z / Middle / Mature,
with 2026-appropriate vocabulary) and *intensity* (Clean / Blunt / Savage). Rotating
motivational one-liners, blunt nudges, and tone-matched feedback throughout.

**Structure / flow (7 tabs):** Dashboard → Plan → Track → Defend → Build → Learn → Settings.
The Dashboard has a guided "Do this next" list (computed from the user's state) plus a
numbered "flow" nav.

**Core budgeting:** Zero-based budgeting (every dollar assigned to $0). "Cover First" essentials
(a modernized Four Walls: Roof, Food, Power & Wi-Fi, Getting Around) with coverage tracking.
Categories with subcategories (pool split), recurring transactions that auto-post, and a
one-tap Auto-Rebalance that pulls from flexible categories instead of showing red overspend
errors. An explicit anti-shame stance (slips are "data points," never failures) and a
"Zero-Blindspot Shield" that rewards honest logging.

**Defense (anti-impulse):** A "Trap Radar" gut-check that classifies temptations (Scroll /
Friction / Status / Leak trap), a 24-Hour Cooling Vault (hold a purchase with a countdown
before buying), a "War Chest" scoreboard (traps dodged, money + hours of life reclaimed), and
"Freedom Mode," a global toggle that reprices every dollar in the app as **hours of your life**
using a "True Net Hourly Wage" (take-home minus work overhead, spread over paid + commute time).

**Wealth (build):** Net worth split into real income-generating assets vs. depreciating "stuff,"
with challenges when users log a car/phone/luxury item as an "asset." A "Sovereignty Audit"
(Sovereign Capital Ratio, Overhead Drag, and four tiers: Encumbered → Tethered → Sovereign →
Untouchable) and a "Freedom Runway" (months you could survive without working).

**Mindset & flow layer (inspired by *Psychology of Money*, *Spiritual Economics*, *Wink and
Grow Rich*):** Strategic goal types (Foundation / Skill & Capacity / Leverage & Network /
Circulation); a Network Capital tracker (rate relationship investments by "Return on
Relationship"); an "Enough" anchor that flags lifestyle creep when income exceeds a
user-set comfort baseline; a Circulation Energy audit (tag spends as Growth / Baseline /
Fear); an Offense-vs-Defense meter (income creation vs. cutting/debt) with anti-scarcity
prompts ("you can't frugality your way to freedom"); an independent-income tracker with
milestones and per-gig hourly yield; a skill-investment ROI/payback calculator; and a
Giving & Circulation module (set a give-X%-of-income target).

## What I want evaluated

Score each 1–10 with a one-paragraph justification:

1. **Core concept & market fit** — Is "unfiltered budgeting + wealth-mindset" a real, defensible
   wedge against YNAB, EveryDollar, Monarch, Copilot, Rocket Money, and the "just use a
   spreadsheet" crowd? Who is the ideal user, and is that segment reachable and willing to pay?
2. **UX / information architecture / flow** — Is 7 tabs plus ~20 sub-modules too much cognitive
   load? Does the guided flow actually reduce overwhelm, or is this feature sprawl with a nav
   bolted on? Onboarding, first-session value, mobile ergonomics.
3. **Behavioral psychology** — Are the mechanisms sound and evidence-based (hours-of-life
   reframing / loss aversion, 24-hour cooling-off, anti-shame framing, identity/tone matching,
   gamified streaks)? Where might they backfire — guilt, shame spirals, over-gamification,
   the "savage" tone alienating users, or novelty that fades?
4. **Financial correctness & liability** — Are the principles and math defensible (zero-based,
   the asset-vs-liability definition, the 4%-yield proxy for "work-optional," true hourly wage,
   offense/defense, runway)? Anything misleading, or that edges into regulated financial advice?
5. **Voice/tone strategy** — Does the generation × intensity system create real stickiness and
   differentiation, or is it a gimmick that reads as AI-generated and dates quickly?
6. **Scope discipline** — What is the true MVP core here? What should be cut, merged, or hidden?
   Is the mindset/"spiritual economics" layer a differentiator or a credibility risk?
7. **Retention & habit loop** — Budgeting apps have brutal churn. What is the daily/weekly hook?
   Will people still open this in month 3?
8. **Business model** — Local-only, no-accounts, no-data-collection is privacy-strong but
   limits classic fintech monetization (data, affiliate, aggregation). How could this actually
   make money, and does the architecture help or hurt that?
9. **Differentiation & moat** — What, if anything, is hard to copy?

Then give me:
- **Top 3 genuine strengths.**
- **Top 3 weaknesses or fatal flaws**, ranked by how likely they are to kill the app.
- **The single highest-leverage change** you'd make in the next 30 days.
- **A prioritized 5-item roadmap.**
- **A final verdict:** Is this a solid app idea worth pursuing? Pick one — *strong yes /
  qualified yes / pivot / no* — and defend it in 3–4 sentences, including a sharper one-line
  positioning statement than the current tagline if you can write one.

Assume it's a solo/early build (prototype), not a funded team. Weigh ideas over polish, but be
realistic about execution and go-to-market. Be specific; avoid generic advice.
