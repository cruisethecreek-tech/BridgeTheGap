# Accountability - Feature Map

A one-page "what's in here" for the whole app. Everything lives in a single file:
**`index.html`** (HTML + CSS + vanilla JS, ~2,300 lines, zero dependencies).
Data is stored in the browser under the localStorage key **`unfiltered_budget_v2`**.
Nothing leaves the device.

---

## The 7 tabs (top nav)

| Tab | What it does | Key code |
|---|---|---|
| **Home** | Landing: hero (voice-adapted), live snapshot (Left to budget / Spent / Streak / Net worth), **Cover First** essentials grid, "Pick your path" cards, feature strip. | `renderHome`, `renderWalls` |
| **Budget** | Zero-based budgeting per month. Categories with assignments + spend bars, **subcategories** (pool split), **duplicate-tidy** banner, **Auto-Rebalance** on overspend. | `renderBudget`, `autoRebalance`, `mergeDuplicates` |
| **Transactions** | Ledger of income + expenses, recurring engine (auto-posts monthly), filters/search, **Zero-Blindspot Shield**. | `renderTx`, `renderTxList`, `renderRecurring`, `blindspotShield` |
| **Insights** | Charts: spending-by-category, 6-month income-vs-spending, cash-balance trend (inline SVG). | `renderCharts` |
| **Impulse Check** | The **Anti-Trap** system: Trap Radar scan, 24-Hour Cooling Vault, War Chest scoreboard, plus **Assets vs. Liabilities** + **Silent Sovereignty Audit**. | `renderCheckResult`, `renderVault`, `renderImpulse`, `renderNetWorth`, `renderSovereignty` |
| **Dreams & Goals** | Savings goals with progress, deadlines, and per-goal nudges. Fund from impulse skips. | `renderGoals` |
| **Money School** | Rotating original lessons (zero-based, emergency fund, snowball vs. avalanche, what's an asset…). | `renderLesson`, `LESSONS` |

---

## Cross-cutting systems

**Voice engine** - two axes drive all copy:
- **Register** (Gen Z / Middle / Mature) - set at the intake age-gate; 2026-appropriate vocabulary.
- **Intensity** (Clean / Blunt / Savage) - the header dial; how much mercy.
- Pickers: `pickVoice` (register×intensity), `pickReg` (register), `pickTrapVoice`. Quote bank `QUOTES`, plus per-feature matrices (`IMP_*`, `TRAP_RESPONSES`, `CHALLENGE_STING`, `REBALANCE_COPY`, `BLINDSPOT_COPY`, `LIFE_LABELS`).

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
