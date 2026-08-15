# Budget Intake - the setup conversation

A warm, two-minute chat that replaces the blank-page cold start. Same philosophy as
the relationship intake: **warmth first, capture close to their words, never
interrogate.** The difference is that here the *engine-critical* answers write
straight into the app - income, essentials, dream, tone - so the moment the chat
ends, the Home screen is already alive.

## Account type - the first fork (spender path recommended)
Right after the name, the chat asks whether they run the whole household budget or just want to track their own spending (`acct`: full | spend). **The lighter "just my spending" path is presented first and gently recommended** - full zero-based means logging every dollar manually, which is the #1 churn risk for a manual app, so most people start light (spend vs. a daily allowance + the reward-calendar streak, the habit that actually sticks). Full zero-based is one tap away for anyone who runs the household budget. A **spender** path skips the Four Walls, income, debt, and dream entirely and instead offers an optional spending limit - then lands in "Just my spending" mode. The engine skips steps via each step's `showIf(answers)`. The star (★) set below applies to the **full** path.

## Full path = a conversational budget builder
For the **full** path, the intake doesn't just capture the essentials - it builds the
whole zero-based budget in conversation, so every screen afterward is just edit / add /
remove. Three engine pieces do this (`input:'loop'` and `input:'zeroClose'`):

1. **Multi-income loop** (`moreIncome`) - after the main paycheck: "anything else land each
   month?" Tap chips (Partner's pay / Side gig / Benefits / Something else), enter an amount
   for each; they're summed into the total income. Each becomes its own recurring income.
   (The personal *hourly wage* is still derived from the main paycheck only, not household.)
2. **Expense-building loop** (`expenses`) - after the Four Walls: "the rest of where your
   money goes." A wrap of common-category chips (Subscriptions, Eating out, Insurance,
   Health, Childcare, Debt payment, Fun money, Personal care, Pets, Savings, + Something
   else). Tap → enter amount → it's added (chosen chips drop off, a running total shows).
   Each becomes a funded category. This is the "conversational list" that builds the budget.
3. **Zero-based close** (`zeroClose`) - totals income vs. everything assigned and routes the
   leftover: "you bring in $X, assigned $Y, $Z is loose - park it in Savings / toward your
   dream / leave as buffer." Picking savings/goal funds a Savings category with the
   remainder, so the user walks out already at $0 left to budget.

Engine: `intakeIncomeTotal`, `intakeAssignedTotal`, `findOrCreateCat`, `renderLoop`,
`askLoopAmount`, `renderZeroClose`; `commitIntake` writes it all. The **spender** path is
untouched and stays light - it skips all three.

## Reflection beats (engagement, not interrogation)
Between the numbers, the full path interleaves short **pain-point / aspiration** questions
(`input:'reflect'`, `renderReflect`) so setup feels like a conversation, not a form - and so
the app captures the emotional signal the numbers miss. One quick chip question per
emotionally-rich section (not every section), each **skippable**, each with a **tailored
one-line reply** so the user feels heard; the richest opens an optional free-text aspiration.
- **Roof** (`roofFeel`): love it / fine / outgrowing / dreaming of owning - the last two open
  "where would you live if you could?" (`roofFeelNote`).
- **Food** (`foodStyle`): cook / eat out / both.
- **Getting Around** (`commuteFeel`): drains me / fine / love it / sick of the car payment.
- **Debt** (`debtFeel`, only if carrying debt): treading water / slowly winning / just starting.
All are stored under `state.intake.reflections` (`{roof, roofIdeal, food, commute, debt}`) for
later personalization. Utilities is intentionally skipped - it's not emotionally rich, and
every extra question risks fatigue.

**Reflections drive action (the payoff).** The captured feelings aren't just stored - they
change what the app does, so the user sees it *listened*:
- **Dream step remembers the roof aspiration.** If `roofFeel` is `own`/`outgrow`, the dream
  question calls it back ("You said you're dreaming of owning (\"a place near the water\") -
  want that to be the dream?") and **pre-fills** the input via a step-level `prefill(a)`
  (the money/text dock now honors `prefill`). `commuteFeel==='payment'` pre-fills "Pay off
  the car." One tap turns a feeling into a real goal on the board.
- **Debt planner acknowledges the pain.** `#debtReflectNote` (in `renderDebt`) shows a
  tailored line when `reflections.commute==='payment'` ("the car payment weighs on you - add
  it here, watch it free your cash flow") or `reflections.debt==='treading'` ("this is the
  tool that shows you the shore"). Styled `.reflect-note`.
More hooks can hang off the same `reflections` object (e.g. an eating-out watch from
`food==='out'`).

## The engine-critical set (★ - never skip these)
These map to real app fields. If a consultation roams, make sure it still covers these.

| ★ Field | Question in the chat | Writes to |
|---|---|---|
| ★ Monthly take-home | "What actually lands in your account after taxes?" | Recurring income + this month's income |
| ★ Pay per hour | Derived, not re-asked: if monthly take-home is known, the chat proposes an estimate (income × 12 ÷ 2,080) as a **confirm pill** - "that's about $20/hr, sound right?" [✓ Yep] / [✎ Set my own] / [🤔 Help me work it out]. Only asks cold if income was skipped. | `hourlyWage` (→ hours-to-break-even). `estHourlyFromMonthly`, step `suggest` |
| ★ Roof | "Rent or mortgage a month?" | Cover First → **Roof** category + assignment |
| ★ Food | "Groceries and eating, monthly?" | Cover First → **Food** |
| ★ Power & Wi-Fi | "Electric, water, phone, internet - monthly?" | Cover First → **Power & Wi-Fi** |
| ★ Getting Around | "Gas, transit, rideshare, car - monthly?" | Cover First → **Getting Around** |
| ★ Debt | "Carrying any debt right now?" (+ how much) | Liability (→ net worth, future payoff) |
| ★ The dream | "What are you actually chasing?" (+ cost) | A goal on the Dreams board |
| ★ Tone | "How do you want me to talk to you?" | `intensity` (Clean / Blunt / Savage) |

Everything below is for the human read - it personalizes the voice, it never gates.

## The bank (by theme)
Pull from these to deepen a live consultation; the chatbot ships a tight subset.

**Money story**
- What did money feel like growing up?
- What's the money moment you're proudest of?
- What's a money decision you'd take back?

**Relationship with money (the deep read)**
- Do you spend to feel something, or avoid looking to feel safe?
- When money's tight, do you go quiet or go blame? (own it vs. deflect - the same "own your part" tell as the relationship intake)
- What does *enough* look like - the number where you'd finally exhale?

**Freedom & dreams**
- What would you do on a Tuesday if money were handled?
- Who are you doing this for besides yourself?
- ★ What are you actually chasing? *(the dream - engine-critical)*

**Stress & habits**
- What's your biggest money stress right now?
- Where does money quietly leak out of your month?
- What's the purchase you always regret?

**The highest-leverage question**
- Why does getting this right matter to you, *right now*? - capture this close to their words; it's the "why" that everything else hangs on.

## Editing answers
Every question from the income step onward shows a **← Back** control (`iaBack`) that
drops the current question and the last answer, clears it, and re-opens the prior
step so a figure can be changed - without restarting the chat. Derived-suggestion
steps track a manual-override flag (`iaForceInput`, reset per step).

## How to run it (so it stays a conversation)
- **Warmth first, permission always.** Name the shame and throw it out: "No judgment, no forms that make you feel dumb."
- **Listen more than you type.** Ballpark numbers are fine - momentum beats precision at intake.
- **Never interrogate.** Optional steps can be skipped; if a theme's covered, move on.
- **Capture close to their words.** The free-text "why" feeds the tone and their own read - store it verbatim (`state.intake.why`).
- **The engine still needs the ★ set.** However far the talk roams, land those nine.

## What it is *not*
No credit pull, no account linking, no data leaving the device - everything the chat
captures is stored locally, same as the rest of the app. It's a setup conversation,
not a lead form.
