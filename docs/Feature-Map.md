# Accountability - Feature Map

A one-page "what's in here" for the whole app. The app lives in a single file:
**`app.html`** (HTML + CSS + vanilla JS, ~5,000 lines; `index.html` is the landing
page). One config-gated dependency: the Supabase SDK, lazy-loaded ONLY if the
opt-in encrypted sync is configured and used - otherwise zero external requests
(fonts are self-hosted). Data is stored in the browser under the localStorage key
**`unfiltered_budget_v2`**. Nothing leaves the device unless sync is turned on,
and sync sends only ciphertext.

---

## The flow (primary nav + More)

The bottom nav leads with the three core jobs and tucks the support surfaces behind
a **More** toggle, so a new user sees a sharp, low-clutter front door instead of seven
competing tabs. **Shield** (the anti-impulse differentiator) carries a gold accent.

**Bottom bar (thumb-reach, 5 slots):** Home · Plan · **[I want to...]** · Build · More
**More ▾ expands upward:** Shield · Track · Debt · Learn · Settings.

The nav moved from a top tab strip to a fixed bottom bar with a centre notch holding
the "I want to..." hub. Shield moved into More deliberately: its *action* (the
gut-check) is the hub's gold hero row, reachable in one tap from any screen, while the
Shield *tab* is the review surface (vault, War Chest, badges) you visit less often.
The bar is opaque with a top shadow, respects `env(safe-area-inset-bottom)`, and the
notch button lifts clear when More is expanded. Body padding compensates for both
states so nothing hides behind the bar.

The underlying money journey is unchanged: **Plan → Track → Shield → Build → Learn**
(shown as the numbered flow on Home). Internal view ids in parentheses are unchanged
for code stability; only the labels and grouping changed (`Defend` label → **Shield**).

| Tab | Group | What it does | Key code |
|---|---|---|---|
| **Home** (`home`) | primary | A focused dashboard: home-hero + CTA, a guided **"Do this next"** step list, live snapshot, **"Enough" anchor**, **Cover First** grid. (The old duplicate nav-card grid and the marketing feature cards were removed - the tab bar is the nav, and that copy lives on the landing page.) | `renderHome`, `renderNextSteps`, `renderEnough`, `renderWalls` |
| **Plan** (`budget`) | primary | Zero-based budgeting per month: categories nesting **three levels** (Getting Around → Gas → Car 1 / Car 2), **two-way pool math** (assign the parent and split down, OR fill the subs and let them roll up), **Recurring** engine, **duplicate-tidy** banner, **Auto-Rebalance**. | `renderBudget`, `catAssigned`, `autoRebalance`, `renderRecurring`, `mergeDuplicates` |
| **Shield** (`impulse`) | primary | The **Anti-Trap** system: Trap Radar scan, 24-Hour Cooling Vault, War Chest scoreboard. | `renderCheckResult`, `renderVault`, `renderImpulse` |
| **Build** (`goals`) | primary | Wealth, as **collapsible sections** (`<details class="acc">`) so the tab opens calm instead of stacking six panels: **Assets/Liabilities + Net Worth** (open by default), **Dreams & goals**, **Skill & Capacity**, **Giving & Circulation**, then the stage-3 **Network Capital** and **Sovereignty Audit**. | `renderNetWorth`, `renderSovereignty`, `renderGoals`, `renderNetwork` |
| **Track** (`tx`) | more | Ledger of income + expenses **+ the 🌱 Invest lane** (neither income nor expense: cash drops, the money lands in an auto-managed "Invested capital" asset, so net worth holds and the runway counts it; monthly "Invested" tile, recurring auto-invest supported). An invest entry declares whether it **holds its value** (account, fund - credits the auto "Invested capital" asset, so net worth holds steady) or goes **into you** (health, skills, tools - real growth, but the money is consumed, so no asset is created and net worth does not pretend otherwise). Both count toward the Invested totals; only the first builds net worth. Legacy invest rows with no `ikind` are treated as holds-value. The **🌱 Invested this month** figure also appears on the Home dashboard once anything has ever been invested, so money moving no longer shows up only as an unexplained change in net worth. Also the **⏳ time ledger** ("Your week in hours"): hours invested in health/learning/building/people vs. hours leaked to the screen, with leaked hours priced in dollars at the user's own rate. Energy tags, filters/search, **Zero-Blindspot Shield**. | `renderTx`, `renderTxList`, `investAssetAdd`, `renderTimeLog`, `blindspotShield` |
| **Learn** (`learn`) | more | Money School lessons **+** Insights charts (spending, income-vs-spend, trend, **Abundance & Circulation**). | `renderLesson`, `renderCharts`, `renderCirculation` |
| **Settings** (`settings`) | more | True Net Hourly Wage engine, plus setup chat / install / export / import / reset. | `updateWageNote`, `trCompute` |

Nav mechanics: `activateTab` auto-opens the More group when a hidden view is active and
collapses it otherwise; `#moreBtn` toggles it manually. `MORE_VIEWS` lists the tucked views.

---

## Cross-cutting systems

**Voice engine** - two axes drive all copy:
- **Register** (Gen Z / Middle / Mature) - set at the intake age-gate; 2026-appropriate vocabulary.
- **Intensity** (Clean / Blunt / Savage) - the **Settings > Voice & tone** dial (moved out of the header so it no longer rides above every screen); how much mercy. The rotating truth-quote hero (`.quote-wrap`) now shows on **Home only** (`body.on-home`), keeping the other tabs' headers lean.
- Pickers: `pickVoice` (register x intensity, floored by situation), `pickReg` (register), `pickTrapVoiceCtx`. Quote bank `QUOTES`, plus per-feature matrices (`IMP_*`, `TRAP_RESPONSES`, `CHALLENGE_STING`, `REBALANCE_COPY`, `BLINDSPOT_COPY`, `LIFE_LABELS`).
- **Tone safety lock** - sensitive/essential spend (rent, medical, utilities, groceries, emergencies, and any Cover First essential) forces the **Clean** register regardless of the dial, so the app never roasts someone over a hospital bill or their rent. `SENSITIVE_RX`, `isSensitive`, `effInt`; context-aware pickers `pickVoiceCtx` / `pickTrapVoiceCtx` power the rebalance banner and the impulse gut-check.

**Freedom Mode** (`$` / ⌛ header toggle) - converts every figure into **hours of your life** via `fmtLife` (minutes → hours → work-days → work-months). `money()` is mode-aware; `usd()` is always dollars. Needs an hourly wage. `renderFreedomToggle`, `renderAll`.

**True Net Hourly Wage** (Settings) - `(take-home - overhead) / (your work month + commute hrs)`. The work month comes from `state.hoursPerWeek` when the user gave it (hours/week x 52 / 12), else the full-time default `WORKMONTH_HRS` (2,080/12 = 173.33) - the app asks for real hours rather than assuming 40, and hours/week is editable in Settings next to the wage. The same real month scales `fmtLife`'s day/month buckets and the no-wage income fallback (`effectiveHourly`), so a 60-hour-week person's month of pay reads as "1.0 mo" of THEIR life. Feeds every hours-of-life figure. Stored in `state.hourlyWage`.

**Intake chat** - conversational onboarding; opens on first run or "Setup chat". Age-gate, then the tone dial (so the whole conversation speaks in the chosen voice), then the soul layer (situation / money story / budgeting history), then real data (income -> recurring, essentials -> Cover First, dream -> goal). See `docs/Budget-Intake.md`. `openIntake`, `INTAKE`, `commitIntake`.

**"Left to budget" is one number, computed one way.** Both Home and Plan use `topCats().reduce((s,c)=>s+catAssigned(c.id,M),0)` so each pool is counted exactly once - Home previously summed *every* category including children, which double-counted any parent that had subcategories and made the two tabs disagree about the same month. `ltbNoteHTML` renders the arithmetic in plain words under the cards on both screens, because a negative "left to budget" reads as failure when it usually just means income has not been logged yet: "You've given $2,510 a job but haven't logged any income yet... Nothing is overspent."

**The four traps are defined where they're asked about.** `TRAPS` carries three levels of wording: `label` (the name), `pick` (the plain-words one-liner shown inside the dropdown, e.g. "Scroll Trap - an ad or a feed put it in front of me") and `TRAP_MEANS` (the full explanation, each ending in a concrete "Tell:" so the user can self-identify). Both pickers - the Shield form and the trap-scan modal - are filled from that one source by `fillTrapPickers`, so the wording can never drift between them, and a "What are the four traps?" legend on Shield teaches the vocabulary once. Naming a concept the app invented without ever defining it is just jargon.

**Category nesting + two-way pool math.** Categories nest three levels: Getting Around → Gas → Car 1 / Car 2, or Food → Groceries → Walmart / Meijer (`descendantsOf`, `catDepth`, `catSpent` all recurse; `catName` renders the full breadcrumb). Level 3 is the floor - deeper stops being a plan and starts being filing - enforced by `catDepth` and by simply not offering a split affordance on level-3 rows.

The budgeting math runs in **both directions**, because people know their numbers at different levels. *Top-down:* assign $400 to Getting Around and split it into Gas and its cars - the note reads "$150 left to split into subs." *Bottom-up:* you know water is $70 and electric is $120 but have no idea what the utilities total is, so you fill in only the subs and the parent adds them up ("↑ $190 total, added up from your 2 subs", with a `= $190` roll tag beside the name, and an **Assign $190 →** button that writes the rolled-up figure into the parent's own field in one tap, turning the derived number into a committed one). `catAssigned(id,M)` returns `max(own, sum of children)` recursively, so filling in subs is **never** an error - the old "over-split the pool" warning is gone. Every total that used the flat figure (Left to budget, the summary, next-steps) now uses `catAssigned`. Auto-Rebalance only moves genuinely free money: a pool's dollars already committed to its own subs can't be raided (`freeOf` caps the take by both the pool's surplus and its uncommitted remainder).

**Dig deeper (after the four walls).** Covering the essentials used to end in a dead-end congratulation card. It is replaced by a ladder (`deepenSteps`, `deepenHTML`, `runDeepen`) that hands the user the next real move at the moment they are most engaged, in a deliberate order: **pay yourself first** (creates the category and seeds 10% of income - before the bills, not after), **the membership sweep**, **a real emergency fund** (one month of essentials as the target), then **a payoff date** in the debt calculator. Each step self-detects whether it is already done (`payFirstDone`, `emergencyDone`, `state.subSweep`, `state.debts`), any step can be dismissed with "Not now" (`state.deepenSkipped`), and the ladder shows all four as chips so the user sees the whole path. It appears both under the funded wall on Plan and as a one-line hand-off on the Home walls grid.

**Membership sweep** (`SUB_SEEDS`, `renderSubSweep`, `openSubSweep`; `#subSweepPanel` on Plan, hidden until opened). Twelve generic membership categories as one-tap chips (no brand pricing - the user knows their own numbers), each row showing its annual cost as it is typed, then a total priced in hours of life ("$75/mo is 45 hrs of your life every year, on autopilot"). "Add these to my budget" writes them as **Memberships > each service** using the nested categories, so they roll up into one pool. The copy is explicitly non-judgmental: a membership you use and love is money well spent; the point is knowing which ones those are. Recorded in `state.subSweep`.

Skips are **month-scoped** (`deepenSkipMonth`): "Not now" sets a step aside for the current month only, and the close card never claims a dismissed step was done - it names what was set aside and offers a way back.

**Recurring schedules.** Bills and paychecks don't all run on a day-of-the-month, so each item carries a **frequency** (weekly / every 2 weeks / twice a month / monthly / every 3 months / once a year) plus an **anchor date** - the first time it's due. `recOccurrences(r, month)` works out every date the item lands on inside a given month (clamping to short months, so a 31st anchor bills Feb 28), and `postRecurring` dedupes per **occurrence** rather than per month, so a weekly bill posts four or five times instead of once. Adding a recurring item whose first date has already arrived posts it immediately, rather than leaving a just-created item looking like it did nothing until the next app launch. For the **current** month only, `postRecurring` stops at today, so "Spent" stays a fact rather than a forecast (a weekly bill doesn't book the whole month on the 3rd); past and future months post in full, and boot sweeps last month before this one so nothing is missed by not opening the app. `recNextDue` drives the "next Aug 21" label, and `recMonthly` gives the average-month equivalent shown beside non-monthly items (≈$3,250/mo for a $1,500 bi-weekly paycheck). That same normalization feeds `recomputeBlendedWage`, so a bi-weekly paycheck no longer reads as a monthly one. Legacy items that only carried `day` keep their old behavior exactly: monthly, always due, postable to any month. `REC_FREQS`, `recOccurrences`, `postRecurring`.

**Cover First** (the Four Walls) - Roof / Food / Power & Wi-Fi / Getting Around, matched to categories by keyword (`WALLS`). Drives the Home grid, essential-runway, and sovereignty. Tapping a wall deep-links to its category on Plan and starts the **wall-to-wall guide** (`wallGuideCat`, `wallGuideHTML`): fund it and an inline banner hands you the next uncovered wall, ending in an all-covered close - no bouncing back to Home between essentials. On the Home grid, covered walls collapse to compact ✓ chips (still tappable to adjust) and the whole grid folds to one line when all four are covered; walls are per-month, so they return asking when the month turns. `renderWalls`, `goToWall`, `findOrCreateEssential`.

**Silent Sovereignty Audit** - Sovereign Capital Ratio, Overhead Drag, Pure Freedom Runway, and a 4-tier classification (Encumbered → Tethered → Sovereign → Untouchable). `sovereignty`, `renderSovereignty`.

**Anti-shame** - overspend shows a calm **Rebalance Banner** (never red errors); the **Blindspot Shield** rewards logging. Copy never says failed/bad/violated/ruined.

**Progressive interface** - the app unrolls depth as the user's Freedom Runway grows, so a user in survival mode is not buried in investment tools:
- **Stage 1 Defense** (<3 mo runway): Cover First + Shield only. Build tab and the offense/mindset tools are hidden.
- **Stage 2 Expansion** (3-12 mo): Build tab, Net Worth, Offense vs. Defense, Skills, and the Enough anchor unroll.
- **Stage 3 Sovereignty** (12 mo+): the Sovereignty Audit and Network Capital open.
- **One-way ratchet**: tools never disappear once earned (`stageReached`); crossing a threshold fires a **milestone celebration** (`celebrateStage`). Panels/tabs are gated by a `data-stage` attribute; `.stage-locked` hides anything above the active stage.
- **Override**: Settings > Interface depth toggles `uiMode` between `auto` (guided) and `all` (show everything). Existing users are migrated so they never lose a tool they already used (`evidenceStage`).
- **Retrospective / timeline** (`renderRetro`): auto-captured monthly snapshots (`captureSnapshot` upserts the current month on boot; past months freeze) drive a **Monthly/Quarterly** net-worth timeline with **3M / 6M / 1Y / All / Custom** date ranges, a start-vs-now delta, and a period table. `metricSnapshot`, `retroSeries`, `quarterKey`; state in `snapshots` + `retroView`. Engine: `runwayStage`, `activeStage`, `applyStage`, `STAGE_META`.

**PWA** - installable, offline-capable: `manifest.webmanifest` (with a "Scan a trap" long-press shortcut), `sw.js` (network-first page, cache-first assets), `icon*.png` / `icon.svg`. `initPWA`.

**CSV import** (Track tab) - drag/drop a bank statement; on-device parse with column auto-detection and category auto-guess, review-before-commit. `parseCSV`, `detectCols`, `extractRows`, `guessCat`, `commitImport`.

**Encrypted backup** (Settings) - WebCrypto AES-GCM + PBKDF2 to a portable `.acct` file; restore replaces local state. `encryptBackup`, `restoreBackup`, `renderBackupNote`.

**Sovereign tier - Household Sync (Blind Vault, E2EE)** - opt-in cloud sync for couples that never lets the server read financial data. Config-gated: off until `SUPABASE_URL` / `SUPABASE_ANON_KEY` are set (the free tier never loads the SDK - `getSupabase` lazy-loads it only on use). The whole `state` object is AES-256-GCM encrypted on-device with a user-only **Sync Passphrase** (`encryptVault`/`decryptVault`, PBKDF2 210k); only the ciphertext envelope is stored in Supabase's single `user_vaults` table (`{user_id, encrypted_payload}`, RLS = own row only). The passphrase lives **in memory only** (`syncPass`), never localStorage, so a fresh session re-asks for it. Engine: `sbSignUp/sbSignIn/sbSignOut/sbSession`, `pushToVault`, `pullFromVault` (wrong passphrase → "Invalid Sync Passphrase. We cannot reset this for you."), and a debounced auto-push wired into `save()` (`scheduleVaultPush`). UI in the Household panel (`renderSync`, `#syncPanel`): a Host flow (create account → create passphrase behind a blunt *"we cannot reset it"* warning → `pushToVault` → Vault Active) and a Joiner flow (email + password + passphrase → `signIn` + `pullFromVault`). The vault is the shared source of truth; last write wins (fine for a couple). **Not live-testable in this repo** - needs a real Supabase project + the `user_vaults` table/RLS (SQL is in the code comment). The paid gate itself (Stripe → entitlement → RLS) is a later, separate step; the client lock is cosmetic until then.

**Debt Payoff Planner** (`Debt` tab, in More) - a modernized snowball/avalanche calculator. List debts (name, balance, APR, min payment) or import from liabilities; set a monthly amount; pick **Avalanche** (highest APR first, cheapest) or **Snowball** (lowest balance first, quick wins). Shows debt-free date, total interest **priced in hours of your life**, a payoff-order list, a balance timeline, and a live comparison of how much the chosen strategy saves vs. the other. Simulation validated against the Vertex42 calculator to the penny. `simulateDebts`, `renderDebt`, `renderDebtResults`. Keys: `debts`, `debtBudget`, `debtStrategy`.
Plus a **"Plot twist: invest instead?"** panel - the honest invest-vs-payoff comparison. Same money out each month, run over 5/10/20 years: **Crush the debt first** vs **Minimums + invest the rest** at an expected market return, compared by final net worth, with per-debt flags (debt APR below the return -> investing likely wins; above -> crush it, guaranteed return) and a guaranteed-vs-expected/emergency-fund/match/not-advice caveat. `investCompare`, `renderInvestCompare`. Keys: `investReturn`, `investYears`.

**"Just my spending" mode** - opt-in in Settings for the partner who doesn't run the bills. Drops the Four Walls and zero-based framing entirely: Home hides Cover First, the flow cards, and the budget snapshot (`.hide-in-spending`) and instead leads with a spending panel (`#spendingBox`) - spent this month, an optional personal limit with a progress bar, hours-of-life, recent purchases, and a gut-check button. Hero copy adapts. Everything else stays reachable (nav unchanged); toggling seeds a "Spending" category if there are none. Keys: `spendingMode`, `spendLimit`. `renderSpending`, `applySpending`.

**Reward calendar (spending mode)** - turns the personal `spendLimit` into a **daily allowance** (limit / days in month) and gives spenders a visual streak to chase (`#rewardCalBox`, `renderRewardCalendar`). A month grid marks each past day: green **✓** under allowance, **★** for a no-spend day, red for over, gold ring on today. Below it: a **This-week pace** strip (spent vs. allowance for the elapsed calendar week, ahead/over), an **under-budget streak** and month **ahead** total, and a month-level nudge (`spendRewardRec`). It's **smart / drill-down**: tapping any past day opens a detail card (`#calDay`, `renderCalDay`, `dayEntries`) showing that day's actual ledger entries (income **+** and expense **-**, by category/source/note), how much was **saved** (allowance minus that day's expenses; income doesn't count against the allowance), and what to do with the difference. `calSelDay` holds the selection; default is today. Grid `repeat(7, minmax(0,1fr))` keeps the 7th column inside narrow viewports.

**Data-fragility guard (Home)** - because everything is local, a cleared cache or a new phone wipes the data. A dismissible Home banner (`#dataGuard`, `renderDataGuard`) surfaces once the user has real data (`busy>=4` across transactions/assets/goals/liabilities) **and** has never saved a backup (`state.lastBackup` null): "Your data lives only in this browser… back it up." It links to Settings' encrypted backup, hides after a backup is saved, and can be dismissed for the session (`dataGuardOff`). Directly answers the review-panel "data fragility" risk.

*(Removed: in-app affiliate/referral links.* An earlier build surfaced disclosed Acorns/Stash buttons in the reward-calendar day-detail and a matching landing section. Both were **removed** after a StoryBrand review: putting investing nudges next to a user's saved money made the app the very "Trap" it fights, undercutting the trust that is the moat. Money is now made only by **direct support** - see Monetization.md channel #1 / the "pay once to support the build" link.)*

**Household mode (couples)** - opt-in in Settings; one shared budget that understands two earners, no accounts or sync (stays local). Income can be tagged **Earned by** You / Partner / Joint (`owner` on income tx + recurring). Home shows a Household panel: combined income, per-person split with %, and a **proportional fair-share** of the essentials (income-weighted, not 50/50), plus each partner's true wage. The gut-check also prices a purchase in the partner's life-hours. Sharing across two phones uses the encrypted backup (export/restore). Keys: `householdOn`, `nameA`, `nameB`, `wageB`. `incomeByOwner`, `renderHousehold`, `applyHousehold`.

**Funnel (opt-in, all off by default)** - the app stays free and private; money is made *directly*, not by nudging. A "Weekly Gut-Check" newsletter opt-in (Settings) posts only the email to a provider you set, with tone-matched success (`SUBSCRIBE_WIN`/`SUB_ERR`). Two education/support offers reveal only when their URLs are set: a Method Guide and the **"pay once to support the build"** link - the app's honest, primary money model ("pay for privacy"). Config lives at the top of the script: `NEWSLETTER_ENDPOINT`, `GUIDE_URL`, `SUPPORT_URL` (mirror the same values in `index.html`). Framed as **education, not advice**, with a disclaimer. Nothing is gated; financial data never leaves the device.

---

## Data model (`state`)

```
intensity, register, freedomMode          // voice + display mode
activeMonth                               // "YYYY-MM"
categories: [{id, name, parentId?}]       // parentId = subcategory; nests 3 levels deep (catDepth caps it)
budgets: { "YYYY-MM": { catId: amount } } // per-month assignments
transactions: [{id, type, amount, date, catId|source, note, recId?}]
recurring: [{id, type, amount, day, catId|source}]
goals: [{id, name, target, saved, date}]
assets: [{id, name, value, kind, cost}]   // kind: real|stuff, cost = monthly drain
liabilities: [{id, name, value}]
impulse: [{id, type, name, amount, date, trap?, hours?, goalId?, txId?}]  // skip|buy
vault: [{id, name, amount, trap, unlocksAt}]
hourlyWage, trueRate                      // wage engine
network, skills, giving, givingPct, enough // mindset & build layer
uiMode, stageReached, day1                 // progressive interface (auto|all, ratchet, snapshot)
householdOn, nameA, nameB, wageB           // couples mode (income tagged by owner: a|b|joint)
spendingMode, spendLimit                   // "just my spending" mode + optional personal limit
lastBackup                                 // encrypted-backup timestamp
lesson, onboarded, intake                 // misc (intake.reflections: situation, moneyStory,
                                          //   budgetPast, incomeAvoid, roof, food, commute, debt...)
debts, debtBudget, debtStrategy           // debt payoff planner
investReturn, investYears                 // invest-vs-payoff comparison assumptions
snapshots, retroView                      // monthly metric snapshots + retro view prefs
trackChallenge                            // 30-day money map {start, days}
sweptDays                                 // reward-calendar sweeps {YYYY-MM-DD: {amount, goalId}}
wageAuto                                  // hourlyWage is auto-derived (re-blends on income change)
msNoteDismissed                           // money-story home note dismissed for month
hoursPerWeek                              // real hours worked/week (0 = unknown, 40-hr default applies)
trackStart                                // tracking origin (YYYY-MM-DD); calendar days before it are "pre"
comfortMenu                               // the free comfort list (strings, shown inside every gut-check)
timeLog                                   // time ledger entries [{id, date, kind, hours}], kinds: health|learn|build|people|leak (90-day window)
theme                                     // dark|light override ('' = follow system)
```
Transaction `type` is `income | expense | invest`. Invest reduces the cash balance but
credits the auto-managed `Invested capital` asset (`asset.auto==='invest'`); deleting the
transaction unwinds the asset. Spend streaks, budgets, and the reward calendar all filter
on `type==='expense'`, so investing is never counted as spending.

Backward compatibility: `defaultState()` supplies every key, so older saves upgrade
cleanly (`Object.assign(defaultState(), parsed)`), and `normalizeState()` runs on
every wholesale load (boot, import, restore, sync pull) to clamp invariants (goal
saved ≤ target) and drop records pointing at things that no longer exist.

---

## Other files
- `budget.html` - redirect stub → `app.html` (keeps old links / saved gut-check URLs working).
- `docs/Budget-Intake.md` - the intake question bank + engine-critical mapping.
- `README.md` - project summary.

---

## Money-psychology layer (Learn, Try-this-instead, Free comfort list)

Behavioral-science grounding applied in the app's own voice (concepts applied, no
source text reproduced). Three surfaces:

**1. Lessons (Learn tab, `LESSONS`) - now 17, split into three arcs.**
- *Mechanics* (original 8): zero-based, pay yourself first, emergency fund, sinking
  funds, snowball vs avalanche, the 24-hour rule, value per dollar, assets vs stuff.
- *Psychology* (new): **Your Money Script** (inherited beliefs; write / trace / test a
  replacement), **Notice, Name, Slow, Redesign, Automate** (the five-step change loop -
  design beats willpower), **Name the Feeling First** (comfort spending answers a feeling,
  not a need), **Look at the Number** (avoidance is negatively reinforced; the five-minute
  exposure fix).
- *Growth* (new - the deficit-to-growth arc): **The Growth Ladder** (see -> buffer -> kill
  interest -> capture the raise -> buy skills -> own things that pay you; one rung, one
  buffer at a time), **Catch the Raise** (lifestyle adapts to income within ~2 months; decide
  the split before it lands), **Cutting Has a Floor** (defense caps at zero, offense has no
  ceiling), **Make Money That Isn't Yours Work** (compounding, honestly framed - the app
  refuses to name investments and points at a licensed professional), **Resilience Is
  Recovering** (a slip is a data point; the review replaces the shame spiral).

**2. Trigger swaps (`TRIGGER_SWAPS`, `triggerSwapHTML`).** The object-keyed `SOLUTIONS`
engine could only answer "want a costly thing -> here's a cheaper thing." Trigger swaps
answer the actual driver, keyed to the trap the user already picked in the gut-check:
*scroll* -> 48-hour list / delete saved cards / unfollow the source; *friction* -> name the
feeling / free comfort list / set a floor not a ban; *status* -> compare to your own last
year / remember what the photo hides / define winning yourself; *leak* -> price the year not
the month / audit renewals / set the cancel reminder now. Both engines can render together.

**3. Free comfort list (`state.comfortMenu`, Settings panel + `comfortHTML`).** The user
writes, while calm, the no-cost things that actually help them; the list is surfaced inside
every gut-check at the moment of temptation, with seed suggestions when empty. Comfort
spending is an attempt to change a feeling - this offers a different answer to the same
feeling instead of only shaming the purchase.

**Tone constraint carried through:** patterns are framed as things to notice and try, never
as labels or diagnosis (labelling breeds shame and defensiveness, which is what drives
avoidance in the first place). This composes with the existing situation floor - a user in
survival mode still never gets roasted - and the app continues to route serious distress to
a qualified professional rather than treating it in-app.

---

## "I want to..." intent hub (the FAB)

Borrowed from the intent-first pattern big consumer apps use (state the job, let the
app route you). The app had grown enough surface - gut-check, quick log, notepad
photo, money map, comfort list, debt planner, dreams, insights - that features were
only findable if you already knew which tab hid them. The FAB now opens a sheet of
plain-language intents instead of a single action.

- **Always reachable.** The FAB used to hide on Home and Shield (where the gut-check
  was already visible); as a hub it now shows on every tab.
- **Gut-check stays first and is styled as the hero row**, so the differentiator and
  the FAB's old behaviour are one extra tap away, never buried.
- **Context-aware** (`intentItems`): spend-mode users aren't offered zero-based
  budgeting; the debt row appears only once a debt or liability exists; the dream row
  respects the stage ladder; the comfort row flips between "Set up" and "Update".
- **Routes through the existing deep-link plumbing** (`closeOverlayThenTab`,
  `runNextStep`, focus-after-navigate), so every row lands on the exact field - e.g.
  "Log what I spent" opens Track *with the batch quick-log already open and focused*.
- Joins the overlay/back stack (`closeTopOverlay`), so Android Back closes the sheet
  and the FAB label resets. Engine: `intentItems`, `renderIntentSheet`,
  `openIntentSheet`, `setFabOpen`.
