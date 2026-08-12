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

**PWA** - installable, offline-capable: `manifest.webmanifest`, `sw.js` (network-first page, cache-first assets), `icon*.png` / `icon.svg`. `initPWA`.

---

## Data model (`state`, 18 keys)

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
lesson, onboarded, intake                 // misc
```

Backward compatibility: `defaultState()` supplies every key, so older saves upgrade cleanly (`Object.assign(defaultState(), parsed)`).

---

## Other files
- `budget.html` - redirect stub → `index.html` (keeps old links / saved gut-check URLs working).
- `docs/Budget-Intake.md` - the intake question bank + engine-critical mapping.
- `README.md` - project summary.
