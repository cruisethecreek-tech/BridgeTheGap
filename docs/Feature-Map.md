# Accountability - Feature Map

A one-page "what's in here" for the whole app. Everything lives in a single file:
**`index.html`** (HTML + CSS + vanilla JS, ~2,300 lines, zero dependencies).
Data is stored in the browser under the localStorage key **`unfiltered_budget_v2`**.
Nothing leaves the device.

---

## The flow (primary nav + More)

The bottom nav leads with the three core jobs and tucks the support surfaces behind
a **More** toggle, so a new user sees a sharp, low-clutter front door instead of seven
competing tabs. **Shield** (the anti-impulse differentiator) carries a gold accent.

**Primary:** Home · Plan · **Shield** · Build   **More ▾:** Track · Learn · Settings.

The underlying money journey is unchanged: **Plan → Track → Shield → Build → Learn**
(shown as the numbered flow on Home). Internal view ids in parentheses are unchanged
for code stability; only the labels and grouping changed (`Defend` label → **Shield**).

| Tab | Group | What it does | Key code |
|---|---|---|---|
| **Home** (`home`) | primary | Hero (voice-adapted), a guided **"Do this next"** step list, live snapshot, **"Enough" anchor**, **Cover First** grid, nav cards. | `renderHome`, `renderNextSteps`, `renderEnough`, `renderWalls` |
| **Plan** (`budget`) | primary | Zero-based budgeting per month: categories + **subcategories** (pool split), **Recurring** engine, **duplicate-tidy** banner, **Auto-Rebalance**. | `renderBudget`, `autoRebalance`, `renderRecurring`, `mergeDuplicates` |
| **Shield** (`impulse`) | primary | The **Anti-Trap** system: Trap Radar scan, 24-Hour Cooling Vault, War Chest scoreboard. | `renderCheckResult`, `renderVault`, `renderImpulse` |
| **Build** (`goals`) | primary | Wealth: **Net Worth** + Assets/Liabilities, **Sovereignty Audit**, Goals (with strategic types), **Network Capital**. | `renderNetWorth`, `renderSovereignty`, `renderGoals`, `renderNetwork` |
| **Track** (`tx`) | more | Ledger of income + expenses, **energy tags**, filters/search, **Zero-Blindspot Shield**. | `renderTx`, `renderTxList`, `blindspotShield` |
| **Learn** (`learn`) | more | Money School lessons **+** Insights charts (spending, income-vs-spend, trend, **Abundance & Circulation**). | `renderLesson`, `renderCharts`, `renderCirculation` |
| **Settings** (`settings`) | more | True Net Hourly Wage engine, plus setup chat / install / export / import / reset. | `updateWageNote`, `trCompute` |

Nav mechanics: `activateTab` auto-opens the More group when a hidden view is active and
collapses it otherwise; `#moreBtn` toggles it manually. `MORE_VIEWS` lists the tucked views.

---

## Cross-cutting systems

**Voice engine** - two axes drive all copy:
- **Register** (Gen Z / Middle / Mature) - set at the intake age-gate; 2026-appropriate vocabulary.
- **Intensity** (Clean / Blunt / Savage) - the header dial; how much mercy.
- Pickers: `pickVoice` (register×intensity), `pickReg` (register), `pickTrapVoice`. Quote bank `QUOTES`, plus per-feature matrices (`IMP_*`, `TRAP_RESPONSES`, `CHALLENGE_STING`, `REBALANCE_COPY`, `BLINDSPOT_COPY`, `LIFE_LABELS`).
- **Tone safety lock** - sensitive/essential spend (rent, medical, utilities, groceries, emergencies, and any Cover First essential) forces the **Clean** register regardless of the dial, so the app never roasts someone over a hospital bill or their rent. `SENSITIVE_RX`, `isSensitive`, `effInt`; context-aware pickers `pickVoiceCtx` / `pickTrapVoiceCtx` power the rebalance banner and the impulse gut-check.

**Freedom Mode** (`$` / ⌛ header toggle) - converts every figure into **hours of your life** via `fmtLife` (minutes → hours → work-days → work-months). `money()` is mode-aware; `usd()` is always dollars. Needs an hourly wage. `renderFreedomToggle`, `renderAll`.

**True Net Hourly Wage** (Impulse tab) - `(take-home − overhead) / (160 + commute×4)`. Feeds every hours-of-life figure. Stored in `state.hourlyWage`.

**Intake chat** - conversational onboarding; opens on first run or "Setup chat". Age-gate first, then writes real data (income → recurring, essentials → Cover First, dream → goal, tone/register). `openIntake`, `INTAKE`, `commitIntake`.

**Cover First** (the Four Walls) - Roof / Food / Power & Wi-Fi / Getting Around, matched to categories by keyword (`WALLS`). Drives the Home grid, essential-runway, and sovereignty. `renderWalls`, `findOrCreateEssential`.

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

**"Just my spending" mode** - opt-in in Settings for the partner who doesn't run the bills. Drops the Four Walls and zero-based framing entirely: Home hides Cover First, the flow cards, and the budget snapshot (`.hide-in-spending`) and instead leads with a spending panel (`#spendingBox`) - spent this month, an optional personal limit with a progress bar, hours-of-life, recent purchases, and a gut-check button. Hero copy adapts. Everything else stays reachable (nav unchanged); toggling seeds a "Spending" category if there are none. Keys: `spendingMode`, `spendLimit`. `renderSpending`, `applySpending`.

**Household mode (couples)** - opt-in in Settings; one shared budget that understands two earners, no accounts or sync (stays local). Income can be tagged **Earned by** You / Partner / Joint (`owner` on income tx + recurring). Home shows a Household panel: combined income, per-person split with %, and a **proportional fair-share** of the essentials (income-weighted, not 50/50), plus each partner's true wage. The gut-check also prices a purchase in the partner's life-hours. Sharing across two phones uses the encrypted backup (export/restore). Keys: `householdOn`, `nameA`, `nameB`, `wageB`. `incomeByOwner`, `renderHousehold`, `applyHousehold`.

**Funnel (opt-in, all off by default)** - the app stays free and private; money is made *alongside* it. A "Weekly Gut-Check" newsletter opt-in (Settings) posts only the email to a provider you set, with tone-matched success (`SUBSCRIBE_WIN`/`SUB_ERR`). Two education/support offers (a Method Guide + a tip link) reveal only when their URLs are set. Config lives at the top of the script: `NEWSLETTER_ENDPOINT`, `GUIDE_URL`, `SUPPORT_URL` (mirror the same values in `index.html`). Framed as **education, not advice**, with a disclaimer. Nothing is gated; financial data never leaves the device.

---

## Data model (`state`)

```
intensity, register, freedomMode          // voice + display mode
activeMonth                               // "YYYY-MM"
categories: [{id, name, parentId?}]       // parentId = subcategory
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
lesson, onboarded, intake                 // misc
```

Backward compatibility: `defaultState()` supplies every key, so older saves upgrade cleanly (`Object.assign(defaultState(), parsed)`).

---

## Other files
- `budget.html` - redirect stub → `index.html` (keeps old links / saved gut-check URLs working).
- `docs/Budget-Intake.md` - the intake question bank + engine-critical mapping.
- `README.md` - project summary.
