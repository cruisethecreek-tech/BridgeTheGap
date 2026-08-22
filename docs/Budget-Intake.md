# Budget Intake - the setup conversation

A warm chat that replaces the blank-page cold start - about two minutes on the light
"just my spending" path, closer to ten on the full budget build (the intro no longer
promises "two minutes" up front, and the account-type step states each path's real
time so nobody feels baited). Same philosophy as
the relationship intake: **warmth first, capture close to their words, never
interrogate.** The difference is that here the *engine-critical* answers write
straight into the app - income, essentials, dream, tone - so the moment the chat
ends, the Home screen is already alive.

## Review before anything is written
The last step is **not** a blind "Set me up". It shows every answer the user gave -
name, setup type, income, hourly rate, the walls, other bills, dream, limit, why -
each on a tappable row. Tapping one re-asks **that single question**, appending to
the transcript rather than rewriting it, and drops the user straight back on the
review with the new value. Nothing is committed until the button is pressed, and
the button is latched against a double-tap. If an edit unlocks a question that now
has no answer (switching "just track spending" to the full budget), the flow goes
there first instead of returning early. `renderReview`, `iaSummaryRows`,
`iaEditStep`, `iaFirstUnanswered`; steps opt in by carrying a short `sum` label.

**An unfinished setup survives.** `iaSaveDraft` writes `{ans, step}` to
`state.intakeDraft` after every move; `iaResumeOffer` runs at `openIntake` and
offers "Carry on" or "Start fresh" before asking anything. `commitIntake` clears
it, so a deliberate re-run never meets a stale resume.

The save fires **after** `runIntakeStep` lands, not before, so the draft records
the question being asked rather than the one just answered - resume picks up
where you stopped rather than repeating a step. Drafts with no meaningful answers
are not written, so a visitor who opens and immediately closes is not offered a
resume for nothing.

**Extra income is available on both paths.** `moreIncome` used to be full-budget
only, so a spender with a side gig could log exactly one income. It now shows for
anyone who entered an income, and `commitIntake` no longer discards
`extraIncome` in spending mode - it was collecting the answers and throwing them
away.

**Photograph the budget you already have.** Anyone who answers anything but
"never really tried" at `budgetPast` is offered the camera (`budgetPhoto`,
`renderBudgetPhoto`). **Two file inputs, not one:** `accept="image/*"` alone
leaves the choice to the browser, and an in-app browser (a link opened inside
Instagram, Messenger, a Custom Tab) commonly answers with the gallery alone, so
"Photograph it" offered no camera to anyone who had not already taken the photo.
`capture="environment"` forces the camera but removes the gallery, so neither
input can serve both jobs: `#bpCam` (capture) backs **Take a photo** and
`#bpFile` backs **Pick from my photos**. Both feed the same handler, and each
clears its own `value` so retrying the *same* photo after a bad read still fires
`change`. The quick-log "Snap my notepad" row (`#qlCam` / `#qlPhoto`) works the
same way. On desktop `capture` is ignored and both open a file dialog. The receipt reader is reused - `loadTesseract` plus
`qlParseOcr` - with `bpParse` dropping the rows a budget sheet carries that a
receipt does not: totals, subtotals, the income line at the top.

`bpApply` maps what it read onto the four walls by keyword and drops the rest
into `expenses`, then sets `photoFilled`. The six number-asking steps
(`essIntro`, `roof`, `food`, `util`, `transport`, `expenses`) test that flag, so
they stand down.

**The feeling questions deliberately do not.** `roofFeel`, `foodStyle`,
`commuteFeel`, `debtFeel` all still run: the photo replaces the typing, not the
conversation, and a spreadsheet cannot tell you how the commute feels.

Note for anyone adding a gate like this: those six steps already declared
`showIf` later in their object literal, so a second `showIf` key was silently
discarded (last key wins) and the guard did nothing while looking correct. Merge
into the existing condition rather than adding a second one.

**Pacing.** Bot lines type before they land. `iaBotSay` shows a three-dot bubble
for `iaTypingDelay(text)` milliseconds, then swaps in the sentence and only then
renders the dock, so the answer buttons never appear before the question has been
read. The delay scales with length (`340 + words*22`, clamped 380-1500ms), so a
four-word acknowledgement returns fast and a long one takes a moment.

`iaSayGen` guards it: Back or an edit during the beat increments the counter and
the pending line is abandoned rather than dropped into a transcript that has moved
on. The delay is 0 under `prefers-reduced-motion`, and 0 when `state.chatPace` is
`'instant'` (Settings → Chat pacing), which is also what the test harness sets so
assertions do not sit through the animation.

**Cadence is part of the voice.** The copy was warm from the start; what read as
machine-made was that every line had the same shape. 17 of 20 questions and 27 of
35 replies used the same `X - now Y` pivot, only 2 replies were a single sentence,
and lengths clustered tightly around 23 words. A person answering you varies:
sometimes four words, sometimes a paragraph. When writing new intake copy, vary
the length deliberately, avoid the balanced-clause pivot, and do not open every
reply by affirming the answer that was just given.

**Back is available from the second step onward.** `iaBackTarget` walks backwards
to the last step the user actually answered, stepping over informational beats
(intro, continue, finish, review) which are not questions. The age gate is a
valid target - getting it wrong sets the wrong voice for the whole conversation,
so it has to be undoable. Only the very first screen has no Back, because there
is nothing behind it. `iaCanBack()` is the single source of truth, so every dock
that renders a Back button agrees with what `iaBack()` will actually do.

Money questions show a **`$` prefix inside the field** and a plain-words hint under
it ("Dollars per month, after taxes - what actually lands in your account. Type 3200
for $3,200."), because a bare `e.g. 3200` placeholder names neither the unit nor the
period. Steps carry the hint via a `hint` property.

## Account type - the first fork (spender path recommended)
**Tone comes second, right after the age gate** - "how much mercy do you want from me?"
(Clean / Blunt / Savage) - so the entire conversation speaks in the user's chosen voice,
swears included: at Blunt the accountability intro says "I help you see through the
bullshit"; Savage goes harder ("the same damn room", "don't bullshit the numbers",
"that's YOUR damn money", "show the hell up"). Clean users never see a swear, and the
intake applies the same floor as the live app (`iaTone`): survival collapses to Clean,
treading water eases Savage to Blunt. Consent before cursing, always. **The situation
question comes third - right after tone and BEFORE the intro** - so the floor is already
known when the intro speaks: someone in survival mode never gets the savage intro first
and the softening after.

After the situation, intro, name and the remaining soul-layer questions (money story, budgeting
history - see below), the chat asks whether they run the whole household budget or just
want to track their own spending (`acct`: full | spend). **The lighter "just my spending"
path is presented first and gently recommended** - full zero-based means logging every
dollar manually, which is the #1 churn risk for a manual app, so most people start light
(spend vs. a daily allowance + the reward-calendar streak, the habit that actually sticks).
Full zero-based is one tap away for anyone who runs the household budget.

**The chooser states the real cost, and owns it.** It used to advertise "~2 min"
for a path that runs 17 steps and 16 questions, then hand over seven fixed-bill
fields one screen after promising "no full-budget homework". Both chips now carry
counted numbers - `~6 min` / `~10 min` - and the bot names the question counts
aloud (16 and 22). It does not apologise for asking, either: *"Money doesn't get
sorted in thirty seconds, and I'm not going to pretend otherwise"* in the
forgiving voice, up to *"if six minutes is too much to spend on the thing that
decides where your life actually goes, stop here"* in savage. Nothing in this app
works in under a minute, and pretending otherwise only buys a setup nobody
finishes. **The one exception is `situation:'survive'`** - `iaTone()` already
floors it to `clean`, so someone drowning gets the honest number without being
shown the door. Not committing and not being able to are different things.
`tests/intake_cost.mjs` recounts both paths on every run and fails if either
drifts from what the screen claims, so the promise cannot rot as steps are
added. The **spender**
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
- **Three ways to see where it goes** (`deepOffer`, reflect): "map my averages now · ~5 min"
  (the leak finder), "I'll track it for real (30 days)" - the notebook-friendly honest path -
  or "just track as I go · nothing to fill in." **Every option that costs time says so**, because
  the leak finder is the heaviest form in the app and it used to be the unlabelled first choice,
  offered one step after a chooser promising "~2 min". The 30-day choice sets `state.trackChallenge` and lights a **Money Map**
  on the spend Home (day X of 30, days logged, dismissible); the leak finder still recommends
  the real track because estimates undercount.
- **The "map my averages" leak finder** (`deepDive`, `input:'leak'`, `leakFinder`).
  **The little stuff leads and the fixed bills fold away** behind an optional `<details>`.
  It used to open with seven bill fields - rent, utilities, phone, insurance, car payment - on
  a path whose own chooser promises *"no full-budget homework unless you want it"*, which is
  exactly what those fields are. Someone who picked "just track my spending" is asking about
  the coffee and the takeout, not their mortgage. The bills reopen automatically if any were
  already entered, so Back never hides work. Skipping them sets no `billsMapped` flag, and
  **`blindSpend` then says what it actually counted** ("just the day-to-day, since you skipped
  the fixed bills") and warns that the unaccounted figure is inflated by the rent sitting
  inside it - otherwise the headline number is somebody's mortgage dressed up as a mystery.
  One screen - **fixed bills** as flat monthly amounts (rent, utilities, phone,
  insurance, car, debt) and **variable leaks** as frequency x cost (`leakMonthly`: coffee
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
**The soul layer (situation + money story).** Before any numbers, two foundational
reflections set how the app shows up:
- **Situation** (`situation`): surviving / treading water / stable but stuck / stable and
  ready to build - "where are you right now, honestly?" Asked right after tone, BEFORE the
  intro, so the tone floor is live before the app's longest speech. No judgment; each answer gets a
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

**The intro defines the name, and the definition is the thesis:** *Accountability is the
**ability** to hold yourself accountable.* The brand mark already says it (Account**ability**,
with "ability" in gold) - the app can't hold anyone accountable and never claims to; it builds
the ability in the user by showing them the truth and handing the decision back. An ability is
a muscle, which is exactly *why* **there is no secret sauce - just small wins that stack when
you show up** (the "are you willing" beat). The same definition anchors the landing page in its
own band under the hero.

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
| ★ Pay per hour | Derived, not re-asked: if monthly take-home is known, the chat proposes an estimate as a **confirm pill** - "that's about $29/hr, sound right?" [✓ Yep] / [⏱ I work different hours] / [✎ Set my own] / [🤔 Help me work it out]. **Hours per week is an input, never an assumption** - the estimate starts from a 40-hour week and says so, and one tap corrects it: $60k at 55 hrs/wk is $21/hr, not $29, and the app names the gap ("those extra hours are $8/hr of your real rate"). The "Help me work it out" path is two steps for the same reason: salary, then real hours worked. Only asks cold if income was skipped. | `hourlyWage`, `hoursPerWeek` (→ hours-to-break-even, true-rate denominator, and the main-job hours behind the side-gig blend). `estHourlyFromMonthly(m,hpw)`, `yearHours`, `monthHours`, step `suggest` |
| ★ Roof | "Rent or mortgage a month?" | Cover First → **Roof** category + assignment |
| ★ Food | "Groceries and eating, monthly?" | Cover First → **Food** |
| ★ Power & Wi-Fi | "Electric, water, phone, internet - monthly?" | Cover First → **Power & Wi-Fi** |
| ★ Getting Around | "Gas, transit, rideshare, car - monthly?" | Cover First → **Getting Around** |
| ★ Debt | "Carrying any debt right now?" (+ how much) | Liability (→ net worth, future payoff) |
| ★ The dream | "What are you actually chasing?" (+ cost) | A goal on the Dreams board |
| ★ Tone | "How do you want to be held accountable?" - stated as the voice used from that point on | `intensity` (Forgiving / Blunt / Savage; stored values stay `clean`/`blunt`/`savage`) |
| ★ Free comfort list | "What actually helps when money isn't the answer?" - chip taps only, optional, asked just before "why this matters" | `comfortMenu` (surfaced inside every gut-check) |

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

## The "why" is the ultimate reminder
The final free-text question ("why does getting this right matter to you, right now?") is
stored verbatim and then WORKED: it sits at the top of Home every session ("Why you're
here, in your words: ...") and is quoted back inside the gut-check verdict at the exact
moment of temptation - "In your own words, why this matters: '...' This buy moves you away
from that. Did we switch goalposts - or is that still the goal?" (tone-matched; savage asks
if they're about to bullshit themselves). A "My why changed - update it" control lets the
goalposts move honestly instead of silently. Engine: `renderWhyCard`, `whyReminderHTML`,
`wireWhyEdit`.

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
