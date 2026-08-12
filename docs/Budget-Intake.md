# Budget Intake — the setup conversation

A warm, two-minute chat that replaces the blank-page cold start. Same philosophy as
the relationship intake: **warmth first, capture close to their words, never
interrogate.** The difference is that here the *engine-critical* answers write
straight into the app — income, essentials, dream, tone — so the moment the chat
ends, the Home screen is already alive.

## The engine-critical set (★ — never skip these)
These map to real app fields. If a consultation roams, make sure it still covers these.

| ★ Field | Question in the chat | Writes to |
|---|---|---|
| ★ Monthly take-home | "What actually lands in your account after taxes?" | Recurring income + this month's income |
| ★ Pay per hour | "Roughly what do you make per hour, take-home?" | `hourlyWage` (→ hours-to-break-even) |
| ★ Roof | "Rent or mortgage a month?" | Cover First → **Roof** category + assignment |
| ★ Food | "Groceries and eating, monthly?" | Cover First → **Food** |
| ★ Power & Wi-Fi | "Electric, water, phone, internet — monthly?" | Cover First → **Power & Wi-Fi** |
| ★ Getting Around | "Gas, transit, rideshare, car — monthly?" | Cover First → **Getting Around** |
| ★ Debt | "Carrying any debt right now?" (+ how much) | Liability (→ net worth, future payoff) |
| ★ The dream | "What are you actually chasing?" (+ cost) | A goal on the Dreams board |
| ★ Tone | "How do you want me to talk to you?" | `intensity` (Clean / Blunt / Savage) |

Everything below is for the human read — it personalizes the voice, it never gates.

## The bank (by theme)
Pull from these to deepen a live consultation; the chatbot ships a tight subset.

**Money story**
- What did money feel like growing up?
- What's the money moment you're proudest of?
- What's a money decision you'd take back?

**Relationship with money (the deep read)**
- Do you spend to feel something, or avoid looking to feel safe?
- When money's tight, do you go quiet or go blame? (own it vs. deflect — the same "own your part" tell as the relationship intake)
- What does *enough* look like — the number where you'd finally exhale?

**Freedom & dreams**
- What would you do on a Tuesday if money were handled?
- Who are you doing this for besides yourself?
- ★ What are you actually chasing? *(the dream — engine-critical)*

**Stress & habits**
- What's your biggest money stress right now?
- Where does money quietly leak out of your month?
- What's the purchase you always regret?

**The highest-leverage question**
- Why does getting this right matter to you, *right now*? — capture this close to their words; it's the "why" that everything else hangs on.

## How to run it (so it stays a conversation)
- **Warmth first, permission always.** Name the shame and throw it out: "No judgment, no forms that make you feel dumb."
- **Listen more than you type.** Ballpark numbers are fine — momentum beats precision at intake.
- **Never interrogate.** Optional steps can be skipped; if a theme's covered, move on.
- **Capture close to their words.** The free-text "why" feeds the tone and their own read — store it verbatim (`state.intake.why`).
- **The engine still needs the ★ set.** However far the talk roams, land those nine.

## What it is *not*
No credit pull, no account linking, no data leaving the device — everything the chat
captures is stored locally, same as the rest of the app. It's a setup conversation,
not a lead form.
