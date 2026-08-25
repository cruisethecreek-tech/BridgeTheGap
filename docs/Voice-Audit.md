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

The twelve flat surfaces above that should not be. Roughly in order of how often
a person sees them: the reward nudge, the calendar day card, Do this next, the
spend-mode kept line, the money story note, the payback card, the circulation
verdict, the impulse celebration, the debt and invest verdicts, Enough, and the
talk-through.

One caveat worth stating rather than discovering later: the Report's new table
is written properly for **middle** at all three intensities, with genz and mature
variants only where the vocabulary genuinely differs. `pickVoice` falls back to
middle, so nothing breaks - but a Loose user is currently reading Plain wording
on those cards. That is strictly better than the one flat string they had before,
and it is not finished.
