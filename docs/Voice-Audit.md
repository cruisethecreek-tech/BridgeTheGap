# Voice audit - where the app talks, and where it stopped

Prompted by a phone note on the Accountability Report: *"These words have lost
its savage."* They had. This is the sweep that came out of it.

## The engine

`state.register` (Loose / Plain / Measured) x `state.intensity` (clean / blunt /
savage), read through `pickVoice`, `pickReg`, `pickVoiceCtx` and `pickTrapVoiceCtx`.
Two safety rules sit under it and neither is optional:

- **The situation floor** (`baseInt`, `iaTone`) - somebody who said they are
  surviving gets clean, whatever they picked.
- **The topic lock** (`isSensitive`, `effInt`) - rent, medical, utilities,
  groceries, childcare, emergencies force clean. Roasting someone over a hospital
  bill is how you lose them.

There are **18 voiced copy tables**. The problem was never the engine.

## What the sweep found

Twenty-four user-facing surfaces, checked for whether they reach the voice
engine at all:

| Surface | Voice | Verdict |
|---|---|---|
| Gut-check verdict | yes | The original, and still the best of them |
| Home hero + stats | yes | `HOME_COPY` |
| Offense vs Defense | yes | `SCARCITY_COPY`, `DEBT_BALANCE` |
| **Accountability Report** | **yes, now** | 14 signals, 0 voice calls before this pass |
| Payback card | flat | Its conclusion is an opinion - should be voiced |
| Do this next | flat | Its subtitles are nudges - should be voiced |
| Reward nudge (`spendRewardRec`) | flat | Pure opinion, four fixed strings |
| Calendar day card | flat | *"No shame - one day doesn't sink the month"* is voice with no dial |
| Spend mode panel | flat | The kept line is a verdict |
| Money story note | flat | Explicitly a personal nudge |
| Debt planner verdict | flat | Should be voiced |
| Invest compare verdict | flat | Should be voiced |
| Circulation verdict | flat | *"Fear is winning the flow"* wants a dial |
| Impulse scoreboard | flat | The monthly celebration |
| Enough anchor | flat | Should be voiced |
| Talk-through | flat | Should be voiced |
| Tripwires | flat | **Correct.** A factual disclosure; voice would undermine it |
| Vault | flat | **Correct.** Timers and actions |
| Net worth, Breakdown | flat | **Correct.** Figures and charts |
| Quick log | flat | **Correct.** A form |
| Diary, Lessons | flat | **Correct.** The user's own words |
| Cover First walls | flat | Labels; the tag above them is voiced |

**21 of 24 flat, of which about 12 should not be.**

### After the second pass

**15 of 24 voiced. The nine still flat are all flat by design**, and the reasons
are in the table above: a factual disclosure, timers, charts, forms, labels, and
the user's own words.

One of the twelve was **reclassified while wiring it**. The talk-through is
reached when money left because something *happened* - the car, the hospital -
and every line in it is either an interview prompt or a gentle reframe (*"an
inconvenience, not a crisis - which is exactly what the money was for"*, *"it
stung instead of wrecking you"*). Savage there is the precise failure the
sensitive lock exists to prevent. It stays clean by design rather than by
neglect, and `tests/structure.mjs` section 49 now asserts it contains **no**
voice call at all.

Two things the wiring exposed:

- **The picker was report-named.** `rpSay` became `voice`, because it is the
  general one now - nineteen call sites moved with it.
- **A step nobody sees is not a fix.** "Do this next" got its voice on the
  all-clear line first, which almost never fires - the giving step beats it for
  nearly everyone. The voice moved to the **assign** step, which is the one
  people actually read, and the existing survival branch was left alone: that is
  the tone floor doing its job one layer earlier, and it has to win over the
  intensity dial.

Two older assertions broke and both were **pinned to exact phrasing rather than
to the property** - the crush-vs-invest tie and the payback card's "want". They
now check that the verdict is *called* a tie and *called* a want, at every
intensity, which is what they were always trying to protect.

## What this pass fixed

The Report - the flagship, and the one that was screenshotted. Fourteen signals,
zero voice calls: everyone got the same prose whether they had asked for clean,
blunt or savage.

The arithmetic is deliberately untouched. `body` and `work` are facts and facts
have no tone. What gained a voice is the **closer** - the line that says what the
number means to you, which is the only part that was ever an opinion.

Same card, three settings:

> **clean** - If that line has not grown to match, the same money is buying
> slightly less food.
>
> **blunt** - If your food line did not grow with it, you are buying less food
> for the same money - before that reads as overspending.
>
> **savage** - If your food line stayed flat, you already took a cut. The shelf
> moved; your budget did not, and the app will call it overspending unless you
> say otherwise.

Two rules the picker had to get right, and they pull opposite ways:

1. Signals that judge **their spending** pass a context and get floored to clean
   on anything sensitive.
2. An **outside number is not a judgement of them**. Nobody is being roasted for
   the price of bread, so those pass `ctx:null` deliberately - the app keeps its
   teeth about the world without ever turning them on the person reading it.

It is deterministic, not random. A report that reworded itself every time you
navigated back would feel unstable, and this is a page people re-read.

`tests/structure.mjs` section 44 pins it: the closers must actually differ across
intensities, savage must bite where it is allowed to, clean must stay measured on
the same card, the survival floor must hold whatever was picked, and **the
arithmetic must not move when the voice does**.

## Still to do

Nothing on the intensity axis - every surface that carries an opinion now moves
with it.

One caveat worth stating rather than discovering later: the Report's new table
is written properly for **middle** at all three intensities, with genz and mature
variants only where the vocabulary genuinely differs. `pickVoice` falls back to
middle, so nothing breaks - but a Loose user is currently reading Plain wording
on those cards. That is strictly better than the one flat string they had before,
and it is not finished.
