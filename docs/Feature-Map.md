# Accountability - Feature Map

A one-page "what's in here" for the whole app. The app lives in a single file:
**`app.html`** (HTML + CSS + vanilla JS, ~5,000 lines; `index.html` is the landing
page). One config-gated dependency: the Supabase SDK, lazy-loaded ONLY if the
opt-in encrypted sync is configured and used - otherwise zero external requests
(fonts are self-hosted). Data is stored in the browser under the localStorage key
**`unfiltered_budget_v2`**. Nothing leaves the device unless sync is turned on,
and sync sends only ciphertext.

---

## Plan vs Track

Both tabs can end up creating transactions, which is what makes the boundary
confusing. The rule is **tense**, not mechanism:

- **Plan** is money that has not happened yet. Assigning, the four walls,
  Recurring, the membership sweep. Deciding what repeats is a plan, even though
  it eventually posts entries.
- **Track** is money that already happened. Logging, CSV import, the time ledger.
  Anything Recurring posts lands here like any other entry.

Each view states this at the top (`.tab-intro`) and points at the other, because
neither is guessable from the tab name alone.

`refreshCatSelects()` keeps every category picker in sync from one place. Ten
sites create categories and only some of them refreshed the Recurring picker, so
it could sit there saying "Add a category first" with four funded walls directly
above it. It preserves the current selection across a redraw.

## The ladder

Three stages gated on **runway** (`runwayStage`), which never drops once earned
(`activeStage`, plus `evidenceStage` so a returning user who already logged assets
keeps their tools). `STAGE_META` carries what each rung opens.

**Stage map** (`stageMapHTML`, `openStageMap`) - tapping the stage bar opens all
three rungs at once: what each one gives, whether it is unlocked, and a progress
bar toward the ones that are not. The ladder used to be invisible from below - you
could see "3 mo to Stage 2" but never what Stage 2 was, which makes a gate feel
arbitrary instead of earned.

**The gate stays runway, deliberately.** A "confirm I finished Stage 1" button was
considered and rejected: it would hand someone net worth, offense tracking and the
sovereignty audit while they still have no cushion, and every one of those tools
reads wrong without one. Settings keeps **Show everything** for anyone who wants
past the system entirely, and the map says so rather than pretending the gate is
the only option.

## Visual language

**Midnight** (dark, the default) is a deep blue ground carrying warm ochre
content - the pairing of a warm painting hung on a midnight wall. The app's first
palette was blue but COLD: blue-grey text on near-black navy, which read as a
trading terminal. The blue was never the problem; the temperature of everything
sitting on it was. Text is warm cream, the accent is soft gold, so the ground
stays blue and everything on it stays warm.

**Ledger** (light) is paper rather than white, because a budget is a ledger and a
ledger is paper. The `auto` theme setting picks per device.

The **expression layer** at the end of the stylesheet lowers the voice of the
whole interface in one place. Before it, the app carried 241 declarations at
weight 700+ against 33 at 600 or below, 42 `text-transform:uppercase` rules and
47 `letter-spacing` rules: nothing was quiet, so nothing had hierarchy, and every
micro-label read as instrument telemetry. Headings and prose use a **system serif
stack** (Iowan / Palatino / Georgia) - no font file, so "zero external requests"
stays literally true.

**Emoji are navigation only.** The app carried 116 distinct glyphs, which is the
single strongest machine-made signal: a person picks eight icons and reuses them.
336 decorative runs were removed; what remains is the tab bar and the theme
toggle. Two glyphs that turned out to be functional rather than decorative were
replaced with words or marks instead of restored - the Freedom Mode toggle now
reads `$ / hrs`, and the action button is a `+`.

Contrast is checked, not assumed: every foreground/background pair in both themes
meets WCAG AA or better. The light accent was darkened from `#9a6b2f` to
`#8a5f28` because the original sat at 4.06 on paper and 4.39 behind button text,
both short of AA for normal-size text.

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
| **Learn** (`learn`) | more | Money School lessons - **swipe** left/right to move between them (the arrow buttons are gone; dots are tappable and arrow keys work), and every card's **"Try this" is a button that lands on the surface that does it** (`LESSON_ACTIONS` maps all 19 by title: Pay Yourself First -> the Recurring form, The Emergency Fund -> the starter-cushion rung, Debt Snowball -> the payoff planner, The 24-Hour Rule -> a live gut-check, 168 Hours -> the time ledger). **+** Insights charts (spending, income-vs-spend, trend, **Abundance & Circulation**). | `renderLesson`, `LESSON_ACTIONS`, `lessonGo`, `lessonStep`, `renderCharts` |
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

**The unit rule.** `money()` converting everything is right for a figure you *read* and wrong for two kinds it does not own, so **`actMoney()`** (always dollars) marks the exceptions:

1. **A figure you act on.** Every input takes dollars - the app says so itself, *"you always type dollars, only the display changes"* - so a button reading `Assign 3.2 days`, or an instruction reading `Set it to at least 1.6 days`, names a value the field will not accept. Same fault as offering to bank ten minutes into a goal: goals hold dollars, and nobody can deposit ten minutes.
2. **A figure whose own caption already converts.** The headline converts too and the card prints one amount twice in two units: *"Spent this month 20.3 days / That's 162 hrs of life"*.

Applies to button labels, typed-value instructions (`Set it to`, `Assign your last`, `You need at least`, `Give`), and any headline with a life aside beneath it. The **Debt planner** states its own version of the rule in its intro - *"the interest priced in hours of your life"* - so what you **pay** and what you **owe** stay dollars while what the debt **costs** carries the life framing. Locked by `tests/life_units.mjs`.

**True Net Hourly Wage** (Settings) - `(take-home - overhead) / (your work month + commute hrs)`. The work month comes from `state.hoursPerWeek` when the user gave it (hours/week x 52 / 12), else the full-time default `WORKMONTH_HRS` (2,080/12 = 173.33) - the app asks for real hours rather than assuming 40, and hours/week is editable in Settings next to the wage. The same real month scales `fmtLife`'s day/month buckets and the no-wage income fallback (`effectiveHourly`), so a 60-hour-week person's month of pay reads as "1.0 mo" of THEIR life. Feeds every hours-of-life figure. Stored in `state.hourlyWage`.

**Intake chat** - conversational onboarding; opens on first run or "Setup chat". Age-gate, then the tone dial (so the whole conversation speaks in the chosen voice), then the soul layer (situation / money story / budgeting history), then real data (income -> recurring, essentials -> Cover First, dream -> goal). See `docs/Budget-Intake.md`. `openIntake`, `INTAKE`, `commitIntake`.

**"Left to budget" is one number, computed one way.** Both Home and Plan use `topCats().reduce((s,c)=>s+catAssigned(c.id,M),0)` so each pool is counted exactly once - Home previously summed *every* category including children, which double-counted any parent that had subcategories and made the two tabs disagree about the same month. `ltbNoteHTML` renders the arithmetic in plain words under the cards on both screens, because a negative "left to budget" reads as failure when it usually just means income has not been logged yet: "You've given $2,510 a job but haven't logged any income yet... Nothing is overspent."

**The four traps are defined where they're asked about.** `TRAPS` carries three levels of wording: `label` (the name), `pick` (the plain-words one-liner shown inside the dropdown, e.g. "Scroll Trap - an ad or a feed put it in front of me") and `TRAP_MEANS` (the full explanation, each ending in a concrete "Tell:" so the user can self-identify). Both pickers - the Shield form and the trap-scan modal - are filled from that one source by `fillTrapPickers`, so the wording can never drift between them, and a "What are the four traps?" legend on Shield teaches the vocabulary once. Naming a concept the app invented without ever defining it is just jargon.

**Category nesting + two-way pool math.** Categories nest three levels: Getting Around → Gas → Car 1 / Car 2, or Food → Groceries → Walmart / Meijer (`descendantsOf`, `catDepth`, `catSpent` all recurse; `catName` renders the full breadcrumb). Level 3 is the floor - deeper stops being a plan and starts being filing - enforced by `catDepth` and by simply not offering a split affordance on level-3 rows.

The budgeting math runs in **both directions**, because people know their numbers at different levels. *Top-down:* assign $400 to Getting Around and split it into Gas and its cars - the note reads "$150 left to split into subs." *Bottom-up:* you know water is $70 and electric is $120 but have no idea what the utilities total is, so you fill in only the subs and the parent adds them up ("↑ $190 total, added up from your 2 subs", with a `= $190` roll tag beside the name, and an **Assign $190 →** button that writes the rolled-up figure into the parent's own field in one tap, turning the derived number into a committed one). `catAssigned(id,M)` returns `max(own, sum of children)` recursively, so filling in subs is **never** an error - the old "over-split the pool" warning is gone. Every total that used the flat figure (Left to budget, the summary, next-steps) now uses `catAssigned`. Auto-Rebalance only moves genuinely free money: a pool's dollars already committed to its own subs can't be raided (`freeOf` caps the take by both the pool's surplus and its uncommitted remainder).

**Accounts - what's actually in the bank** (`state.accounts`, Build tab). Everything else in the app is derived from logged transactions, which meant a new user with $8,000 in checking was told they had $0 - and net worth and Freedom Runway were understated to match. Accounts are the one surface where the user simply states the truth: name, kind (`ACCT_KINDS` - checking/savings/cash/investment/other, each flagged liquid or not) and an earmark (`ACCT_PURPOSES` - emergency, college, sinking, a dream, retirement). `bankTotal` feeds net worth, `liquidTotal` feeds the runway (falling back to the transaction-derived figure only when no accounts exist), and `earmarked(purpose)` is what turns "savings" into answerable questions - how much is emergency money, how much is the kids'. Balances are never silently edited: editing one restamps its `updated` date, and `loggedSince` shows the drift between what has been logged and what the user last said was real, leaving the reconciliation to them. The Track tab's transaction-derived figure is relabelled "Logged net (all time)" once accounts exist, with a note explaining it is not a bank balance.

**Dig deeper (after the four walls).** Covering the essentials used to end in a dead-end congratulation card. It is replaced by a ladder (`deepenSteps`, `deepenHTML`, `runDeepen`) that hands the user the next real move at the moment they are most engaged, as one sequenced ladder: **$1,000 between you and disaster** -> **the membership sweep** (a quick win that funds the rest) -> **kill the interest** (done only when balances are entered AND cleared) -> **grow it to three months of essentials** -> **pay yourself first, every month** -> **fund what's coming for the kids** -> **own where you live outright** (hidden unless a mortgage liability exists) -> **build it, and let it move** (giving). The order is the widely-taught one because it works, written in the app's own words rather than branded as anyone's program, and every rung reads the user's real numbers (`emergencyMoney` combines earmarked account balances with matching goal progress; `debtsOutstanding`, `hasMortgage`) instead of asking them to self-report. The savings rungs create and focus a real earmarked account rather than a wishful goal. Each step self-detects whether it is already done (`payFirstDone`, `emergencyDone`, `state.subSweep`, `state.debts`), any step can be dismissed with "Not now" (`state.deepenSkipped`), and the ladder shows all four as chips so the user sees the whole path. It appears both under the funded wall on Plan and as a one-line hand-off on the Home walls grid.

**Membership sweep** (`SUB_SEEDS`, `renderSubSweep`, `openSubSweep`; `#subSweepPanel` on Plan, hidden until opened). Twelve generic membership categories as one-tap chips (no brand pricing - the user knows their own numbers), each row showing its annual cost as it is typed, then a total priced in hours of life ("$75/mo is 45 hrs of your life every year, on autopilot"). "Add these to my budget" writes them as **Memberships > each service** using the nested categories, so they roll up into one pool. The copy is explicitly non-judgmental: a membership you use and love is money well spent; the point is knowing which ones those are. Recorded in `state.subSweep`.

Skips are **month-scoped** (`deepenSkipMonth`): "Not now" sets a step aside for the current month only, and the close card never claims a dismissed step was done - it names what was set aside and offers a way back.

**Recurring schedules.** Bills and paychecks don't all run on a day-of-the-month, so each item carries a **frequency** (weekly / every 2 weeks / twice a month / monthly / every 3 months / once a year) plus an **anchor date** - the first time it's due. `recOccurrences(r, month)` works out every date the item lands on inside a given month (clamping to short months, so a 31st anchor bills Feb 28), and `postRecurring` dedupes per **occurrence** rather than per month, so a weekly bill posts four or five times instead of once. Adding a recurring item whose first date has already arrived posts it immediately, rather than leaving a just-created item looking like it did nothing until the next app launch. For the **current** month only, `postRecurring` stops at today, so "Spent" stays a fact rather than a forecast (a weekly bill doesn't book the whole month on the 3rd); past and future months post in full, and boot sweeps last month before this one so nothing is missed by not opening the app. `recNextDue` drives the "next Aug 21" label, and `recMonthly` gives the average-month equivalent shown beside non-monthly items (≈$3,250/mo for a $1,500 bi-weekly paycheck). That same normalization feeds `recomputeBlendedWage`, so a bi-weekly paycheck no longer reads as a monthly one. Legacy items that only carried `day` keep their old behavior exactly: monthly, always due, postable to any month. `REC_FREQS`, `recOccurrences`, `postRecurring`.

**Cover First** (the Four Walls) - Roof / Food / Power & Wi-Fi / Getting Around, matched to categories by keyword (`WALLS`). Drives the Home grid, essential-runway, and sovereignty. Tapping a wall deep-links to its category on Plan and starts the **wall-to-wall guide** (`wallGuideCat`, `wallGuideHTML`): fund it and an inline banner hands you the next uncovered wall, ending in an all-covered close - no bouncing back to Home between essentials. On the Home grid, covered walls collapse to compact ✓ chips (still tappable to adjust) and the whole grid folds to one line when all four are covered; walls are per-month, so they return asking when the month turns. `renderWalls`, `goToWall`, `findOrCreateEssential`.

**Money map** (`renderBreakdown`, `bdRows`, `bdDonutSVG`) - a donut of where money
went and where it came from, over a **1 / 3 / 6 / 12 month** window. A single month
is a snapshot and a snapshot lies: one car repair makes Getting Around look like a
habit, so the interval is a first-class control rather than something faked by
clicking the month arrows twelve times. Expenses drill into the category tree
(Food → Groceries → Walmart) and money booked straight to a parent shows as
"(direct)" so nothing vanishes on the way down. Income groups by source and does
not drill. Slices are `stroke-dasharray` on one circle each: no library, no canvas.

**Quick glance** (`renderGlance`, `glanceReady`) - an edge pull-tab opening money
in, money out, and what that leaves for the active month, plus today's spend
against the daily allowance in spending mode. Gated on `genuineTxDates`, the same
predicate the calendar origin uses, so an auto-posted paycheck does not count as
"tracking has started" and nobody meets a drawer reading $0 / $0 / $0 on day one.

**Silent Sovereignty Audit** - Sovereign Capital Ratio, Overhead Drag, Pure Freedom Runway, and a 4-tier classification (Encumbered → Tethered → Unbound → Untouchable). The rank is deliberately NOT called "Sovereign": that name belongs to the paid sync tier, and a free rank sharing it reads as a paywall. `sovereignty`, `renderSovereignty`.

**Anti-shame** - overspend shows a calm **Rebalance Banner** (never red errors); the **Blindspot Shield** rewards logging. Copy never says failed/bad/violated/ruined.

**Progressive interface** - the app unrolls depth as the user's Freedom Runway grows, so a user in survival mode is not buried in investment tools:
- **Stage 1 Defense** (<3 mo runway): Cover First + Shield only. Build tab and the offense/mindset tools are hidden.
- **Stage 2 Expansion** (3-12 mo): Build tab, Net Worth, Offense vs. Defense, Skills, and the Enough anchor unroll.
- **Stage 3 Autonomy & Leverage** (12 mo+): the Sovereignty Audit and Network Capital open.
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

**New-month plan prompt** (`#newMonthBanner`, `newMonthPromptHTML`) - a fresh month opens as blank assign boxes, and the `Copy last month` button sits in a toolbar nobody reads, so people retyped a whole budget or quietly stopped budgeting. When the active month is genuinely untouched **and** the previous month has a plan, the month itself offers to carry it forward: it names last month's total and category count, says how that lands against the income logged so far (matches to the dollar / leaves $X unassigned / is $X more than has come in), and offers `Copy <month> and edit it` or `Start from scratch`. Dismissal is remembered per month in `state.planPromptSkip`.

**Repeats live on the row** (`repeatCtrlHTML`, `wireRepeat`, `recForCat`, `ROW_FREQS`) - setting up a recurring bill meant leaving the category you were looking at, scrolling to a separate section, and retyping its name, its amount and its category: three facts already on screen. Every **leaf** category now carries a `↻` checkbox; ticking it creates the recurring item from the row (amount seeded from that month's assignment, monthly by default, anchored to the 1st) and reveals a frequency select offering **weekly / every 2 weeks / monthly / every 3 months**. Groups do not get one - their subs carry the bills. A category assigned **$0** refuses and focuses its Assign box instead, because a repeat with no amount posts nothing. Unticking removes the template and leaves anything already posted alone. The Recurring panel stays for income and anything that is not a category, and **its form now autofills the amount** from the chosen category's assignment - never overwriting a figure someone typed. `.sub-name` gained a `min-width` floor and wraps rather than ellipsing: once the toggle joined the assign box, split and delete on one row, "Internet" was rendering as `"I..."`.

**Sheets fit the phone they open on** (`.modal`, `.modal.sheet`) - every modal had no `max-height` and no `overflow`, so it grew to whatever its content wanted. The app map wants 938px; on a 780px phone the overlay bottom-aligns the sheet, so the extra 158px went off the **top** and put the modal's own ✕ at `y=-115`. A sheet you cannot close is the worst state in an app, and it was on all of them - map, ladder, freedom explainer, talk-through, gut-check. `.modal` is now a flex column capped at `88dvh` (`88vh` fallback) with its last child scrolling, so the heading and the ✕ stay pinned where a thumb expects them. The intent sheet had the same trap by a different route: it scrolled **itself**, and its ✕ is absolutely positioned inside it, so scrolling scrolled the close button away. It now holds still and lets the list scroll, with its cap giving back the 96px it floats above the FAB. `tests/structure.mjs` checks every sheet at 700/780/844px: it fits, the ✕ is on screen and hit-tests to itself, and the overflow lands on the body not the sheet.

**Outside numbers** (`OUTSIDE`, `outsideFresh`, the `o*` report signals) - inflation and rates, **shipped, not fetched**. The app promises "nothing leaves your device", so it does not call anyone to ask what CPI is: the figures are baked at build time and refreshed on deploy (`docs/DEPLOY.md` has the step). Four cards ride the report's rails, each tied to the user's own budget and never shown as trivia: prices up 3.4% against **their** hourly rate (with "has not changed since March" when the app watched the wage get set - `state.wageSetAt`); grocery inflation against **their** food line ("a year ago about $633 bought the same cart"); the national average savings APY against **their** idle cash, average and high-yield both priced in dollars a year with no account named; and the average new-card APR against **their** dearest debt. Every card is stamped with its as-of date on screen and labelled "baked into the app, never fetched"; a standing line under them says the numbers say what is, not what to do. The CPI card requires a wage the user actually set - `effectiveHourly()`'s income-based estimate is not a footing for "your hour buys 3% less". And a build whose figures have aged past 240 days **goes quiet on its own**, saying the numbers are too old to show as current - stale-but-silent is the designed failure mode, because a stale figure presented as current is the one way this feature could hurt someone. Equities were considered and dropped on purpose: a daily-moving number beside the impulse tools invites exactly the behaviour the app exists to fight.

**The Accountability Report** (`REPORT_SIGNALS`, `buildReport`, `renderReport`) - the app measured plenty and concluded nothing. It knew the top category, the priciest weekday, net worth, income against expense, and it never once put two months side by side and said what changed; the user held two screens in their head and did the comparing, which is the one job software is better at than people. Reflect now **opens on the verdict**, with the charts underneath as the evidence. Eight signals: on-pace for the month while there is still time to act, what you kept (with the three-month trend), the biggest category drift against last month, a habit that **started**, a habit that **stopped**, the essentials' share of income, investing consistency across three months, and the hours of life the month cost. Four rules, each inherited rather than invented: **silence over speculation** (every signal declares the data it needs and does not appear below it - `spendTendencies()` has always worked this way; what is missing is listed separately as something to unlock); **show the working** (every card carries the arithmetic that produced it, because a conclusion nobody can check is one nobody should trust); **observation then a choice** (the nudge is always a fact about their own numbers - "at this rate that is about $1,440 a year" - never an instruction); and **never congratulate someone who is drowning** (a month that went negative leads with the bad news, and a keep rate refuses to render at all when nothing has been spent, because "you kept 100%" after one paycheck measures what has not been logged rather than what was kept). A signal that throws is dropped rather than taking the page with it.

**A posted bill says which bill** (`recTxNote`, `normalizeState` backfill) - every entry a recurring schedule posted was noted `Recurring`, so four bills in a row read `Recurring, Recurring, Recurring, Recurring` and the list said nothing at all. The transaction already carries `recId`, so the app knows perfectly well that it was automatic; the note is the one place that should say **what it was**. It names the bill now - the category for an expense, the source for a paycheck - and "posted automatically" moves to the sub line as `· repeats`, which has room for it. `normalizeState` backfills entries already saved under the old note, from the schedule that made them or from the category they landed in when that schedule is gone, so past months read properly without anyone re-logging anything. It only ever rewrites the exact placeholder, so a note somebody typed themselves (`"Recurring bill I typed myself"`) is never touched.

**The multi-line log guesses the category** (`suggestCatFor`, `HABIT_WORDS`, `qlCatOptions`) - every row's dropdown defaulted to whichever category happened to be **first**, so a notepad full of coffees logged itself as `Rent / mortgage` unless you corrected every line by hand. A wrong confident default is worse than none, because it looks decided. Rows start on **Which category?** and the app earns the answer instead, strongest evidence first: (1) the user's own past entries with the same description - a habit they repeat, which is the whole point; (2) a bill they already told the app **repeats**, matched by name through `state.recurring`; (3) the category and subcategory names themselves; (4) common purchase vocabulary, pointed **only** at categories that already exist, so it never invents one. A guess lands on a subcategory over its parent, because the sub is the more specific home. Below a confidence floor it guesses **nothing** rather than guessing wrong. Guesses are **marked** (accent left border) so they never read as decisions, and it only ever fills a dropdown nobody has touched - one correction is permanent and no amount of further typing overwrites it. The OCR path calls the same function, which is where it pays off most: a photographed notepad arrives categorised. Whatever it could not guess logs as **Uncategorized** and the toast says how many, rather than filing it under something wrong and silent.

**A mode you can leave from where you are** (`setReorder`, `.reorder-done`) - Reorder is a mode, and the only way out of it sat in a toolbar at the top of the list. Move something to the bottom of a long plan and you had to scroll all the way back up to say you were finished. A **Done reordering** pill now floats above the bar for as long as the mode is on (the FAB hides while it does - one clear action at a time), and finishing scrolls you back to the toolbar so the next thing you reach for is where you left it. The toolbar button itself had turned into an empty outlined pill the moment you pressed it: it carries `.btn ghost primary`, and `.ghost` is declared **after** `.primary` at the same specificity, so `.ghost` won the background while `.primary` still set the text to `--on-accent` - near-white letters on a near-white panel. `.btn.ghost.primary` now names the combination, which settles it for every such button rather than patching the one that was noticed. `tests/palette.mjs` could never have caught this: the fault is not in any token pair, it is in which rule won on one live element.

**Rows that fit the phone** (`.tx`, `.time-row`, `.summary`, `.decision`, `.rf-tabs`, `.cat-name`) - a transaction row is four things on one line: date, what it was, how much, delete. `.tx-amt` was `white-space:nowrap` with **no `flex-shrink:0`**, so flex squeezed its box below its content and the amount painted outside it, straight across the category chip beside it - text on text, on every row, at every width. `.tx-title` was one `nowrap`+ellipsis line holding the chip and the note together, so a long category ate the whole width and the note truncated to three pixels. Sizing the boxes right stopped the collision but could not create room that is not there: at 360px the date, amount and delete button leave about 40px for the description. A phone gets **two lines** now - date and amount on top like a bank statement, the description underneath with the full width. The same sweep found four more: a stat grid pushed a 320px page sideways because a grid item's default `min-width:auto` refused to let `$2,638.50` shrink; a category name leaned 9px onto `"Assign $"`; an impulse row left 45px for `"Mechanical keyboard"`; and the fourth Reflect sub-tab sat off the right edge of a horizontal scroller with nothing to say it was there, so `In vs out` was a report you could only find by guessing. `tests/layout.mjs` now checks ten tabs at four phone widths for text on text, text off the glass, sideways scroll and crushed labels.

**Money that is not spending** (`category.growth`, `growthKindFor`, `GROWTH_TAG`) - the intake's leak finder correctly kept `Savings`, `Investing / retirement` and `Extra debt payments` out of the leak total, and then the commit filed all three as ordinary spending categories. `Investing / retirement` landed on the Plan looking exactly like Takeout, and a retirement contribution logged against it would have counted as money spent. They are still assigned - a zero-based plan gives investing a job like anything else - they are just no longer **called** spending: the category carries its kind, the Plan tags it (`Invested, not spent`), and choosing it on Track while the form says Expense switches to **Invest** and says why.

**Rename a subcategory** (`catEditId`, `saveRename`) - the ✎ existed only on top-level categories, so fixing a typo in `Groecries` meant deleting it, which takes its transactions' category with it. The rename engine was already generic; only the affordance was missing. It is on all three levels now, at any depth, and while a row is being renamed the rest of it steps aside so the field has the width.

**Which log type is selected** (`.typetoggle`) - Invest carried the `.on` class exactly like Expense and Income and had **no rule to paint it**, so choosing it silently switched the form underneath while the toggle still looked like Expense was selected. It gets `accent-2`, because `accent` already means Expense and telling growth apart from spending at a glance is the whole point of the third option.

**Your order, not creation order** (`catOrder`, `moveCat`, `catReorder`, `category.sort`) - category order was array order, which is creation order, which is an accident. People read a budget in a shape that means something to them: the rent at the top because it frightens them, or the fun money at the top because it is what they overspend. **Reorder** on the Plan toolbar turns on a mode that puts a `⠿` grip on every row, and you drag it where you want it. It started as `↑`/`↓` buttons on the theory that HTML5 drag does not fire on touch - true, but the conclusion was wrong: **pointer events** carry touch, mouse and stylus down one path with no library, and `touch-action:none` on the grip alone is what stops the browser claiming the gesture as a page scroll. That is why the handle is a handle and not the whole row - the list still has to scroll normally under a finger that is not on the grip. Arrows also meant counting taps to move a category down eleven rows, with the list re-rendering under your thumb after each one. Rows are **not** shuffled in the DOM mid-drag: the source stays put and greys out, a ghost follows the pointer and a line shows where it will land, and only the release writes anything (`moveCatTo`, then one `renderBudget()`). Shuffling live is where the bugs are, because the plan is a flat list holding three nesting levels plus split notes and add-rows, so "move this element" means "move it and the four unrelated-looking ones that belong to it". A drag is confined to the row's own siblings, so a subcategory can never be dropped into the top level however far you drag it. Auto-scroll runs while a finger sits near the edge of the glass, or you could only ever drop something already on screen. **Escape** abandons a drag. The grip is still a real `<button>`, so **arrow keys move a row too** - drag is the preferred way, not the only way, and a screen reader keeps a path. Subcategories reorder **inside** their parent and can never escape it. While the mode is on the editing controls **collapse** rather than dim: dimming still costs the width, and on a subcategory row the arrows plus a greyed-out amount squeezed the name to `"E..."`. Order is an explicit `sort` field rather than array position, so it survives merges, imports and a restore from backup, all of which rebuild the array; `normalizeState` seeds it from current position, so an existing budget keeps exactly the order it had. **`categoryOptions()` routes through `topCats`/`childrenOf`** - it used to filter `state.categories` raw, so reordering the plan left every category picker in creation order and the app disagreed with the user about their own arrangement.

**First-time area guides** (`AREA_GUIDE`, `renderAreaGuide`, `state.seenGuide`) - the app's premise is that someone who has never budgeted and someone who has run zero-based for ten years both move without hesitating. An audit of a brand-new install found the second half fine and the first half missing: every screen said what to **do** (*"No debts yet. Add what you owe"*) and no screen said what it **is** or why it exists. Build had no heading at all (all `<details>`), Learn had 911 characters and nothing to press, Settings had 3,133 characters and no orientation. Each of the ten areas now introduces itself **once** at the top of the view - what it is, why it matters, the one thing to do first - then never returns. Dismissal is per area; **"I know my way around"** turns all of them off in one tap; the map replays them. Survives reload via `state.seenGuide`.

**How this app fits together** (`#appMap`, `appMapHTML`, `MAP_ORDER`, `areaUsed`) - a map, because *"where am I and what have I not touched"* is a question no individual screen can answer. Nine areas in the order the app intends, the first six numbered as the loop (decide, record, look, defend, build, clear), each showing what it is for and **whether you have actually used it** - so it reads as progress rather than a menu. Tapping a row goes there. Reachable from any first-time guide and from Settings.

**Reflect** (`view-reflect`, `renderReflectTab`, `rfTab`) - one destination for the four reports, each a sub-tab: **Breakdown** (the drillable donut with its own 1/3/6/12 window), **Trends** (every category you spent in, biggest first, walked month by month), **Net worth** (the headline, its two halves, and the balance trend, with editing still linked back to Build), **In vs out** (six months of income against spending). They previously sat inside Learn between Money School and Abundance & Circulation, and "Spending by category" carried the line *"use the month arrows on the Plan tab to change the period"* - a report telling you to operate it from somewhere else. The month arrows live on the report now and move `state.activeMonth`, so Plan and Reflect stay one truth. Learn went back to teaching only. With nothing logged, Reflect explains itself instead of drawing empty charts.

**Panels wait until they mean something** (`panelGates`, `applyPanelGates`, `.panel-waiting`) - a brand-new guided user was shown 27 panels across 8 tabs while the stage ladder, the entire mechanism for not overwhelming people, hid six. Panels that need data (bank import, cooling vault, the two debt-projection panels, Abundance & Circulation) now fold to their heading plus one line naming what brings them back, and reopen the moment it arrives. Panels you **input** through are never gated - you cannot get data without them. `#subSweepPanel` was left alone because it already gated itself in CSS; adding a second mechanism on top gave that div two `id` attributes, the browser kept the first, and the original hide silently stopped working. Locked by `tests/structure.mjs`.

**Let's talk it through** (`#talkSheet`, `openTalk`/`renderTalk`, `CAUSES`, `state.lessons`) - a conversational lane for money that left because something *happened*. The Trap Radar requires a trap before it will speak, and all four (scroll, friction, status, leak) assume temptation, so an accident has no honest answer there. This asks **why it happened** first: something broke, someone needed you, a bill was bigger than expected, a one-off chance, "I don't know", or "honestly, I wanted it". The first three are `kind:'risk'` and are never called traps - they route to *"was there money set aside?"*, which is the whole difference between a crisis and an inconvenience; a **covered** event is told it is the system working and offered nothing to fix. The grey ones ask what you were doing right before, which is where triggers actually live. `wanted` hands straight to the Radar, prefilled. Every event is kept in `state.lessons`, and `lessonPattern()` surfaces what one moment cannot - *"3 like it over 12 months, $1,380 in total, about $115/mo"* - with a short window explicitly called a ceiling rather than a forecast. **The pattern folds in the event on screen**, because the verdict's figure and the amount the "Set money aside" button assigns to a `Life happens` category must be the same number. Locked by `tests/talk_through.mjs`.

**The history feeds back into the Radar** (`riskStanding`, `lessonNoteHTML`, `renderLessons`). Keeping the events was only half of it - a Radar that has watched three things break with nothing set aside and still opens with a lecture about scroll traps has learned nothing about the person in front of it. Two things the history earns: the gut-check card carries a **What you've told me** note built entirely from figures the user supplied (*"3 things went wrong on you in the last 3 months with nothing set aside - $1,950 of it… Skipping this would put $220 there, about 0.3 months of cover"*), and the **buffer becomes a destination** - `__buffer` in the neutralize picker raises this month's assignment on `Life happens` instead of crediting a goal, promoted to first place only when the history says it is the gap. A **What you've told me** panel on Defend lists every event with its cause and coverage, because a number the app quotes at you but never shows is one you cannot check or correct. Partly-covered events count toward the gap (it is real) but are never described as *"nothing set aside"* - that would be calling someone a liar with their own data. Empty history hides the panel and changes nothing on the card.

**Destructive actions live where you go on purpose.** The global footer sits under every screen, and `Reset all` sat in it as a plain link one space from `Export data` - a permanent wipe of a browser-only store with no server copy, a mistap away on every tab. The footer now carries only the constructive half (`Install app`, `Export data`, `Import`) plus a **`Start over` signpost** that scrolls Settings' Start-over block into view and flashes it, rather than triggering anything. That block (`#startOver`) states what is lost, offers **Back it up first** (which jumps to and fires the encrypted backup) before **Erase everything**, and `resetEverything()` takes **two** confirmations - the second naming the actual counts ("this erases 3 categories, 2 transactions, 1 goal"), because nobody gets a second chance at this. `Re-run setup chat` moved to Settings for the same reason.

**Photo capture (intake budget photo, quick-log notepad)** - every photo entry point pairs a camera input (`capture="environment"`) with a plain gallery input, behind two separate buttons. A single `accept="image/*"` input lets the browser decide, and in-app browsers routinely offer only the gallery; `capture` forces the camera but hides the gallery, so one input cannot do both jobs. Both inputs share a handler and clear their own `value`, so re-picking the same photo after a bad OCR read still fires `change`.

**Reward calendar (spending mode)** - turns the personal `spendLimit` into a **daily allowance** (limit / days in month) and gives spenders a visual streak to chase (`#rewardCalBox`, `renderRewardCalendar`). A month grid marks each past day: green **✓** under allowance, **★** for a no-spend day, red for over, gold ring on today. Below it: a **This-week pace** strip (spent vs. allowance for the elapsed calendar week, ahead/over), an **under-budget streak** and month **ahead** total, and a month-level nudge (`spendRewardRec`). It's **smart / drill-down**: tapping any past day opens a detail card (`#calDay`, `renderCalDay`, `dayEntries`) showing that day's actual ledger entries (income **+** and expense **-**, by category/source/note), how much was **saved** (allowance minus that day's expenses; income doesn't count against the allowance), and what to do with the difference. If a goal exists, the day offers to **bank** its real surplus toward it (never more than the month's honest surplus). **Units:** a goal holds dollars - its target and progress are dollars - so nobody can bank ten minutes into an emergency fund. In life-hours mode the card keeps **time** for what the day cost you ("1.7 hrs saved", "25 min spent of a 2.1 hrs allowance") and switches to **dollars** for what actually moves ("Bank $40 toward..."), with one sentence joining them: *That's 1.7 hrs of your life you didn't hand over - $40 still sitting in your account.* Goal readouts elsewhere stay in the active unit, since "your emergency fund is 41 hrs of work" is a valid translation; only the **action** has to be dollars. If **no** goal exists yet, the card asks for the one thing that is missing - a name - inline (`.cal-newgoal`), then creates the goal and banks the money in a single press without leaving the screen. It used to jump to the Goals tab and focus a blank four-field form that knew nothing about the day or the amount, so the button promised "bank it toward" and banked nothing. `calSelDay` holds the selection; default is today. Grid `repeat(7, minmax(0,1fr))` keeps the 7th column inside narrow viewports.

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
theme                                     // 'auto' (default, follows the OS) | 'light' | 'dark' explicit override
diary                                     // money diary [{id, date, ts, kind, prompt, text, acted:[{what,id,amount,label}]}]
autoBackup                                // backup reminder cadence: off | launch | weekly (default) | monthly
backupNagDay                              // YYYY-MM-DD the reminder was answered or dismissed (day-scoped, not session)
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

**Money diary (`state.diary`, Diary tab).** The budget asks for numbers; people
think in stories. An entry is written in plain words under one of four framings
(a win, a hard one, something coming up, just writing), stamped with the date and
time, and kept in a timeline.

The app then READS the entry for money facts and offers to log them - it never
writes anything on its own. `diaryScan` is deterministic pattern matching done
on-device (`diaryAmounts`, `diaryWhen`, `diaryDate`, `diaryCategory`): no model,
no network, nothing to phone home with. A dollar-signed figure with no income
word is treated as money out; a bare number is only read as money when a money
verb sits beside it, so years, house numbers, times and percentages stay out of
the budget. Tense and date come from whichever marker sits CLOSEST to the amount
(`DIARY_REACH`), so a "yesterday" in the first sentence cannot date a plan in the
third. Category is guessed from the words around that amount, preferring a
category the user already has.

Findings become offer cards: past outflow to a category (with a picker),
past inflow as income, and anything future or saved as a goal rather than a
transaction. Approving writes it and records what it did on the entry, so the
timeline shows "logged $340 - Getting Around" under the words that produced it.
Declining leaves the budget untouched. Deleting an entry never removes what it
already logged.

**4. Diary echo (`diaryEcho`, `diaryEchoHTML`, inside the gut-check).** A diary
only read on the day it is written is a notebook. The gut-check surfaces one
entry, chosen by relevance, verbatim, while the cart is still open. Scoring is
keyword overlap with what is being bought (dominant), then entry kind (a hard one
outweighs a note), then recency; a funded plan nudges but does not decide - at a
larger bonus it beat everything for every purchase and the same quote surfaced
every time. Below a threshold it shows nothing: silence beats a non-sequitur.

It is the one surface the register/intensity dial does **not** reach. These are
the user's own words about their own hard weeks, and quoting somebody's grief
back at them in the savage voice is the one place this app must not go. The
framing is identical at clean, blunt and savage, and that is asserted in the
tests.

**3. Free comfort list (`state.comfortMenu`; collected in intake, editable in Settings,
rendered by `comfortHTML`).** The user names, while calm, the no-cost things that actually
help them; the list is surfaced inside every gut-check at the moment of temptation, with
seed suggestions when empty. Comfort spending is an attempt to change a feeling - this
offers a different answer to the same feeling instead of only shaming the purchase.

It is **asked during setup** (`INTAKE` step `comfort`, `renderComfortStep`, just before
`why`) rather than left in Settings. The feature only pays off if the list exists before
the first urge, and every other route to it was post-hoc: wander into Settings, open the
FAB hub, or hit a gut-check and meet the empty state - which asks someone mid-urge to go
do calm reflective setup, the one thing they cannot do right then. The intake step is
chip-taps only and skippable, so it costs about two taps; free-text entry stays on the
Settings card. `commitIntake` unions the picks into any existing list rather than
overwriting, so re-running setup never wipes entries added later.

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
