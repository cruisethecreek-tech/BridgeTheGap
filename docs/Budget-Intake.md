# Budget Intake - the setup conversation

A warm chat that replaces the blank-page cold start - about two minutes on the light
"just my spending" path, closer to ten on the full budget build (the intro no longer
promises "two minutes" up front, and the account-type step states each path's real
time so nobody feels baited). Same philosophy as
the relationship intake: **warmth first, capture close to their words, never
interrogate.** The difference is that here the *engine-critical* answers write
straight into the app - income, essentials, dream, tone - so the moment the chat
ends, the Home screen is already alive.

## Account type - the first fork (spender path recommended)
**Tone comes second, right after the age gate** - "how much mercy do you want from me?"
(Clean / Blunt / Savage) - so the entire conversation speaks in the user's chosen voice,
swears included: at Blunt the accountability intro says "I help you see through the
bullshit"; Savage goes harder ("the same damn room", "don't bullshit the numbers",
"that's YOUR damn money", "show the hell up"). Clean users never see a swear, and the
intake applies the same floor as the live app (`iaTone`): survival collapses to Clean,
treading water eases Savage to Blunt. Consent before cursing, always.

After the name and the three soul-layer questions (situation, money story, budgeting
history - see below), the chat asks whether they run the whole household budget or just
want to track their own spending (`acct`: full | spend). **The lighter "just my spending"
path is presented first and gently recommended** - full zero-based means logging every
dollar manually, which is the #1 churn risk for a manual app, so most people start light
(spend vs. a daily allowance + the reward-calendar streak, the habit that actually sticks).
Full zero-based is one tap away for anyone who runs the household budget. The **spender**
path skips the Four Walls, debt, and dream; income is asked but optional (skipping it
triggers the `incomeAvoid` follow-up), and the path ends with the deep-dive offer and an
optional spending limit before landing in "Just my spending" mode. The engine skips steps
via each step's `showIf(answers)`, and `pruneStaleAnswers()` clears any answer whose gate
no longer passes (so switching paths mid-chat can never commit leftovers from the other
path). The star (★) set below applies to the **full** path.

## Full path = a conversational budget builder
For the **full** path, the intake doesn't just capture the essentials - it builds the
whole zero-based budget in conversation, so every screen afterward is just edit / add /
remove. Three engine pieces do this (`input:'loop'` and `input:'zeroClose'`):

1. **Multi-income loop** (`moreIncome`) - after the main paycheck: "anything else land each
   month?" Tap chips (Partner's pay / Side gig / Benefits / Something else), enter an amount
   for each; they're summed into the total income. Each becomes its own recurring income.
   **Side-gig hours (the "blend your true rate" move).** Work-type sources cost the user's
   *time*, not just add money. The Side gig chip (and any custom source) follows the amount
   with a skippable hours question ("roughly how many hours a month does that take? Skip if
   it's passive, like rent or benefits") stored as `hours` on the income item. The next step
   `trueRate` reveals the **blended take-home rate**: main-job hours (income ÷ confirmed main
   rate) plus the captured side-gig hours, so `hourlyWage = (main + side pay) ÷ (main + side
   hours)`. A low-paying gig **drags the rate down**, so every purchase then costs *more*
   hours of life - priced against the whole truth, not one paycheck. Passive income (partner,
   benefits, rental) has no hours and stays out of the wage blend (still in the budget total).
   Engine: `intakeWorkHours`, `intakeBlendedHourly`, `askLoopHours`; the wage step's own
   reassurance switches to "I'll blend in your side-gig hours next" when work-hours exist.
   Custom sources guard against numeric-only names ("that looks like an amount - give it a
   label"). If a source is named **Partner**, the next step (`householdOffer`) offers the full
   couples view: opting in flips on Household mode, sets the partner's name, derives their
   wage from their income, and tags that income `owner:'b'` so the fair split works.
2. **Expense-building loop** (`expenses`) - after the Four Walls: "the rest of where your
   money goes." A wrap of common-category chips (Subscriptions, Insurance, Health,
   Childcare, Debt payment, Fun money, Personal care, Pets, Savings, + Something else -
   no "Eating out" chip: food is already a Four Walls answer, a second chip double-counted
   it). Tap → enter amount → it's added (chosen chips drop off, a running total shows).
   Each becomes a funded category. This is the "conversational list" that builds the budget.
   For users with many expenses, a **"⊞ Add several at once"** fallback (`bulkLoop`, step
   flag `bulk:true`) swaps the tap-loop for a scrollable grid of all the common categories
   with amount fields + blank custom rows - fill the ones that apply, "Add all" in one go
   (deduped against what's already added). Kills the one-at-a-time fatigue.
3. **Zero-based close** (`zeroClose`) - totals income vs. everything assigned and routes the
   leftover: "you bring in $X, assigned $Y, $Z is loose - park it in Savings / toward your
   dream / leave as buffer." Picking savings/goal funds a Savings category with the
   remainder, so the user walks out already at $0 left to budget.

Engine: `intakeIncomeTotal`, `intakeAssignedTotal`, `findOrCreateCat`, `renderLoop`,
`askLoopAmount`, `renderZeroClose`; `commitIntake` writes it all.

## Spender path: light by default, deep by choice
The **spender** path skips the three full-path engines but is no longer a dead end:
- **Income is optional, and skipping it gets a follow-up** (`incomeAvoid`, reflect): "what's
  behind not wanting to put income in?" - I don't want to look / it's irregular / it stresses
  me / I just want to watch spending. Avoidance is a tell; each answer gets a warm, no-push
  reply. (The full-path income is required; this only fires for spenders who skip.)
- **The wage question is reframed for spend mode** - it's the gut-check engine here (every
  purchase priced in hours of your life), not a leftover from the budget path, and it says so.
- **Three ways to see where it goes** (`deepOffer`, reflect): "map my averages now" (the
  leak finder), "I'll track it for real (30 days)" - the notebook-friendly honest path - or
  "just track as I go." The 30-day choice sets `state.trackChallenge` and lights a **Money Map**
  on the spend Home (day X of 30, days logged, dismissible); the leak finder still recommends
  the real track because estimates undercount.
- **The "map my averages" leak finder** (`deepDive`, `input:'leak'`, `leakFinder`).
  One screen in two passes - **fixed bills** as flat monthly amounts (rent, utilities, phone,
  insurance, car, debt) then **variable leaks** as frequency x cost (`leakMonthly`: coffee
  4x/wk @ $6 = ~$104; a pack a day @ $9 = ~$274). Live running total.
- **The gateway to budgeting.** Spend tracking is the on-ramp, not the destination. Once
  there's tracked spend, the spend Home shows a quiet bridge: "seeing it is sometimes enough
  to change it; sometimes you want every dollar earmarked" -> a one-tap switch to full
  budgeting (`spendingMode=false`, categories already built from the leaks carry over).
- **The blind-spend reveal** (`blindSpend`): income minus *everything mapped* (bills + habits)
  = the money you couldn't name - "not gone, just invisible." Because fixed bills are included,
  the leftover is an honest blind-spot figure, not income-minus-a-few-habits. If mapped spend
  *exceeds* income, it flips to the "this gap is the debt/stress you've been feeling, now it's
  on the table" reality check. The habits (not the rent) are also priced in hours of life.
  Mapped items become real budgeted categories in spend mode via `commitIntake`.

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
**The soul layer (situation + money story).** Before any numbers, right after the name, two
foundational reflections set how the app shows up:
- **Situation** (`situation`): surviving / treading water / stable but stuck / stable and
  ready to build - "where are you right now, honestly?" No judgment; each answer gets a
  tailored, human reply. This one **drives the plan**: the `acct` step reframes its
  recommendation for survival ("start light, no full-budget homework"), the close softens
  ("one small win this week - that's all I'm asking"), and on Home the "Do this next" cards
  lead survival users with **"🛟 Start a $100 cushion"** and soften the assign prompt to
  "one small move at a time, no pressure to be perfect." Building users get the normal
  zero-based flow.
- **Money story** (`moneyStory`): never enough / tight but managed / comfortable / feast or
  famine - "what did money feel like growing up?" Names the pattern (grip vs. blow it; the
  swing) so the user feels seen; the "never enough" answer opens an optional free-text note.
  **It also lives on Home** (`moneyStoryNote`/`renderMoneyStoryNote`, the `#moneyStoryCard`
  strip): one gentle, personalized line that reads the answer plus a couple of reliable
  signals - a `fear` user on a 5+ gut-check streak with a War Chest gets *permission* ("one
  small planned treat isn't slipping, it's how you keep this up"); a `chaos` user in a
  bigger-than-average income month gets a *steadying* nudge ("give this surplus a job before
  it evaporates"). It only speaks when it has something real to say and is dismissible for
  the month (`state.msNoteDismissed`) so it never nags.

The intro and close also carry the honest frame the whole thing rests on: **there is no
secret sauce - just small wins that stack when you show up** (the "are you willing" beat).

**Situation also floors the tone (the "digital psychologist" move).** `baseInt()` softens the
user's chosen intensity by who they told us they are: `survive` collapses blunt/savage to
**clean** (someone barely holding on needs wins, not a roast), `treading` eases savage down to
blunt. It only ever softens - never hardens past their choice - so the blunt "reality check"
is simply left intact for the stable-but-stuck users who can take it and need the push. This
composes with the existing topic safety-lock (`effInt` = sensitive-topic clean OR situation
floor), so rent/medical/groceries stay gentle for everyone regardless of situation.

All are stored under `state.intake.reflections` (`{situation, moneyStory, moneyStoryNote,
roof, roofIdeal, food, commute, debt}`) for later personalization. Utilities is intentionally
skipped - it's not emotionally rich, and every extra question risks fatigue.

**Every reflection can explain itself.** Reflect steps with a `why` field show a quiet
"Why are you asking?" control; tapping it drops a plain-language reason into the chat (and
removes the button). The soul-layer questions (situation, money story, budgeting history) all
carry one, so a wary user can see the intent before answering instead of feeling interrogated.

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
