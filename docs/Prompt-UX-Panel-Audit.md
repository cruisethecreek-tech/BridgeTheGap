# Prompt - full experience audit (panel format)

A deep-dive UX, flow, information-architecture and experience critique of the
whole product, structured as six specialists who each own one territory and are
held to it. For Gemini, Grok, or any capable model.

**Attach:** `app.html`, `index.html`, and screenshots (list below). Copy
everything under the line into the model.

## Screenshots worth attaching, in this order

The reviewer cannot click. Screenshots are the difference between a real
critique and a plausible one. Shoot these on a phone, in one sitting, without
tidying anything up first:

1. The landing page, top and mid-scroll
2. First launch, before any data - the intake conversation, 3 or 4 shots through it
3. Home immediately after setup finishes
4. Plan, with real categories, including one group expanded
5. Plan in reorder mode
6. Track, the log form, plus the multi-line "log several at once" panel
7. Shield, mid gut-check
8. Debt, with a debt entered and a monthly amount set
9. Reflect, the report, then one of the charts
10. Build (goals) with the accordions closed - as it first appears
11. Settings, scrolled top to bottom (2 or 3 shots)
12. The "I want to…" hub, open
13. Anything that looked wrong to you and you have not mentioned

---

You are auditing the complete experience of a finished-but-not-yet-launched
consumer product. The build is functionally complete and heavily tested for
correctness. What has **not** been systematically reviewed is whether a real
human can move through it without friction, confusion or fatigue.

Your job is to find where the experience fails people, and to be specific enough
that a solo founder can act on every word. This is the final review before
launch, so calibrate accordingly: name what blocks launch and what does not.

## The product, in facts

**Accountability** (accountability.money) - a zero-based budgeting web app that
prices every purchase in **hours of the user's life**, argues back in real time
when the user is tempted, and speaks in a deliberately blunt, unfiltered voice.

- **One static HTML file.** No backend, no accounts, no bank linking, no sync
  by default. Everything is in the browser's localStorage. Installable as a PWA.
- **Mobile first.** Assume the overwhelming majority of use is one-handed, on a
  phone, often in a shop or immediately after spending money.
- **Ten screens**, reached by a bottom bar of `Home`, `Plan`, a centre "I want
  to…" button, and `More`, which expands to `Shield`, `Track`, `Debt`,
  `Reflect`, `Learn`, `Diary`, `Settings`.
- **What each screen is for:** Home is the daily glance. Plan is the zero-based
  budget (nested categories to three levels, drag to reorder, per-row recurring
  toggles). Track is logging money in and out, including a multi-line
  paste/photo path. Shield is the impulse-purchase gut-check and a 24-hour
  cooling vault. Debt is a snowball/avalanche payoff planner. Reflect opens on a
  written "Accountability Report" (verdict cards) with four chart sub-tabs
  behind it. Build (labelled Goals) holds seven collapsed accordions - accounts,
  assets/liabilities, dreams, skill investments, giving, network capital, a
  wealth audit. Learn is lessons. Diary is journalling. Settings holds seven
  panels and about 37 controls.
- **Progressive disclosure exists**: a three-stage ladder hides advanced areas
  until the user's situation warrants them, plus a "guided vs everything" mode
  toggle. Nine elements are stage-gated. First-time visitors to each area get a
  one-off explainer card.
- **An "I want to…" hub** sits in the centre of the bottom bar and maps intents
  ("log what I spent", "gut-check something") to destinations.
- **The intake** is a conversational setup that can build a complete zero-based
  budget, or take a lighter "just track my spending" path.

## Constraints - recommendations that ignore these are wasted words

1. **No backend, no accounts.** Anything requiring a server, a login, or bank
   integration is out. Local-first is the product, not a limitation to route
   around.
2. **The privacy promise is absolute** and is the brand's core asset: no
   analytics, no tracking, no third-party scripts. This means **you cannot
   assume any usage data exists.** Do not recommend "look at your funnel
   metrics" - there is no funnel data and there never will be.
3. **The voice is the product, not decoration.** Blunt, sometimes savage, tuned
   by register and intensity. Do not recommend sanitising it into neutral
   fintech copy - that deletes the differentiator. **Do** flag any specific
   place where the voice costs comprehension, or where it would land wrong on
   someone in genuine financial distress.
4. **Solo founder, limited hours.** Every recommendation needs an implied size.
   A redesign nobody can build is not a finding.
5. **No dark patterns, ever.** No manufactured urgency, no guilt, no
   engagement-farming. The app's declared villain is manipulative design; if you
   catch it doing the thing it condemns, that is a top-severity finding.

## The design principles it claims to hold itself to

Judge fidelity to these - and separately, say if you think any of them is wrong.

- **Silence over speculation.** A panel or insight does not appear until there
  is enough data to be right. Not greyed out, not hedged - absent.
- **Show the working.** Every number is shown with the arithmetic that produced
  it, because a conclusion nobody can check is one nobody should trust.
- **Observation, then a choice - never an instruction.** "Takeout is up 41%" is
  allowed. "Cut your takeout" is not.
- **Never congratulate someone who is drowning.**
- **Hours of your life** is the core unit and the reason the product exists.

## The panel

Six specialists. **Each owns their territory exclusively** - do not write six
versions of the same observation. If something falls in another seat, say so and
move on. Each gives their own headed section, in their own voice, and each ends
with **their** single highest-value fix.

### Seat 1 - Information architecture and navigation
Owns: the shape of the thing. Can people find what they need?

- Is a ten-screen app with a four-item bottom bar and a `More` drawer the right
  structure, or is it two apps wearing one coat?
- Are the screen names right? `Shield`, `Build`, `Reflect`, `Track`, `Plan` -
  do these say what they hold to someone who has never budgeted?
- Does the "I want to…" hub solve the navigation problem, or admit it? A hub
  that maps intents to destinations can be a genuine shortcut or a confession
  that the destinations are unfindable. Which is it here, and how would you tell?
- Settings holds 7 panels and ~37 controls - including the true-wage engine,
  which powers the app's core mechanic. Is that the right home for it?
- Build/Goals presents as 7 collapsed accordions with no visible content. Judge
  that first impression.
- Is the three-stage progressive-disclosure ladder helping, or hiding the
  product from the people who bought into it?

### Seat 2 - First run and time-to-value
Owns: everything from landing page to the first moment the app is useful.

- Walk the path of someone who has **never budgeted in their life** and is
  slightly ashamed about money. Where do they hesitate? Where would they quit?
- Walk the path of someone who has used YNAB for five years. Where do they get
  bored or condescended to? Can they skip ahead?
- Is the conversational intake the right instrument, or is a chat that builds a
  budget slower than a form that builds a budget? Argue it both ways, then pick.
- How long until this app tells the user something they did not already know?
  Count it in screens and in minutes. Is that fast enough?
- Empty states: what does each screen look like with zero data, and does it
  teach or does it just apologise?
- Does the app ever ask for something the user does not have to hand (APR,
  minimum payment, hours worked per week), and how gracefully does it survive
  not getting it?

### Seat 3 - Interaction design and mobile ergonomics
Owns: how it feels in a hand. UI craft.

- Thumb reach, touch-target sizes, one-handed operation, anything requiring
  precision on a moving bus.
- Forms: input types, keyboards raised, decimal entry, tab order, how errors are
  surfaced, how much typing is demanded.
- The specific interactions: drag-to-reorder categories, the per-row recurring
  toggle, the three-level category tree, modal sheets, the multi-line log.
- Density and rhythm: which screens are too busy, which are too empty, and does
  the visual hierarchy actually rank things by importance?
- The design system: type scale, spacing, colour semantics, the two themes.
  Where is it inconsistent enough to be noticed?
- Is anything genuinely delightful? Say so if not.

### Seat 4 - Content design and voice
Owns: the words. Every label, heading, button, error, empty state, insight.

- Does the blunt voice ever cost clarity? Name the specific strings.
- Labels and jargon: "zero-based", "four walls", "War Chest", "Trap Radar",
  "true hourly wage", "life hours". Which of these teach, and which are private
  language the user has to decode?
- Button labels: does every one say what happens next?
- The Accountability Report writes sentences about the user's money. Judge that
  writing specifically - is it insight or is it narration?
- Tone under stress: the app tunes intensity, but find any place where a blunt
  line would land on someone who just lost a job or cannot pay rent.
- Is the reading level appropriate for the audience it claims - people who have
  never budgeted?

### Seat 5 - Accessibility and inclusion
Owns: whether everyone can use it, and whether it is safe for people in distress.

- Contrast, focus states, keyboard operability, screen-reader semantics,
  heading structure, labelling of inputs, live regions for dynamic content.
- Touch target minimums, motion and animation, and whether anything relies on
  colour alone to carry meaning.
- Cognitive load: the app makes people do arithmetic-adjacent thinking while
  possibly anxious. Where is the load unnecessary?
- Drag-to-reorder has a keyboard path - verify the pattern is sound and say what
  a screen-reader user actually experiences.
- **Financial distress is an accessibility issue here.** Judge whether the
  product is safe for someone in real crisis, and name any moment it is not.
- Numeracy: does the app assume comfort with percentages and rates that a
  struggling user may not have?

### Seat 6 - Trust, ethics and the return visit
Owns: whether it is honest, and whether anyone comes back on day eight.

- Audit for the thing it condemns. Any manufactured urgency, guilt, streak
  pressure, or engagement bait? The app has streaks and a "reward calendar" -
  judge whether those cross the line it drew for itself.
- The privacy claims are absolute and prominent. Are they **kept**, and are they
  stated in a way a sceptical person would believe rather than dismiss?
- The money ask: a single pay-what-you-want panel that stays hidden until the
  app has demonstrably helped. Judge the honesty and the timing.
- **Manual entry is the retention problem.** With no bank sync, every user must
  type their own transactions forever. What is the realistic honest answer -
  what keeps someone logging in week six? Is there a version of this product
  that survives that, and does the current design find it?
- What is the emotional arc? Does the app leave people feeling capable or
  scolded? Does that change between day 1 and day 60?
- Would you personally keep using it? Answer plainly.

## Cross-examination

After the six sections, run a short round where the panel **disagrees on the
record**. Do not smooth it out - the disagreements are the useful part.

At minimum, resolve these three:

1. **Voice vs clarity** (Seat 4 vs Seat 5) - where blunt tone and cognitive
   accessibility genuinely conflict, which wins and why?
2. **Progressive disclosure vs discoverability** (Seat 1 vs Seat 2) - hiding
   features protects beginners and starves everyone else. Where is the line?
3. **Honesty vs retention** (Seat 6 vs everyone) - the honest answer to
   "will people keep typing transactions?" may be no. If so, say it out loud
   and say what follows.

## Consolidated deliverables

After the panel and the cross-examination, produce these together:

**A. The five worst moments in the product.** Ranked. For each: the screen, what
the user is trying to do, what actually happens, and why it is bad. These should
be the five things you would fix if you could fix nothing else.

**B. Launch triage.** Every finding sorted into exactly one:
- **Blocks launch** - a real person will fail, be misled, or be hurt
- **Fix in the first month** - real damage, survivable briefly
- **Backlog** - genuine but not urgent
- **Deliberate, leave it** - looks like a flaw, is actually a correct choice

**C. The one thing.** If the founder does exactly one thing from this entire
review before launching, what is it?

**D. What you could not judge.** Name what needs real users, a real device, or
interaction you could not perform. Be honest about the limits of a static read.

## Evidence rules

- **Quote the product.** Name the screen, the panel, the button, the exact
  string. "The onboarding is confusing" is worthless; "on Plan, the empty state
  says X, which assumes the user already knows Y" is actionable.
- **Describe click paths** as steps: "Home > More > Debt > scroll past two
  panels".
- **No generic heuristics.** Do not recite Nielsen's ten. Apply them silently
  and report only what this product actually does.
- **Separate what you see from what you infer.** If you are guessing at
  behaviour you cannot observe in a static file or a screenshot, mark it.
- **No redesign fantasies.** Every recommendation must be buildable by one
  person in a single-file app with no backend.
- **Say when something is good** and why, specifically. A review with no
  positives is not brave, it is uncalibrated - and the founder needs to know
  what not to break.

## Output format

Open with a **one-paragraph verdict**: is this launchable, and what is the
single biggest experience risk?

Then the six panel sections, each headed and in that specialist's voice, each
ending with their own highest-value fix. Then the cross-examination. Then
deliverables A through D.

Do not soften. This founder has previously removed a working revenue feature
because a reviewer made a correct hard argument. A well-evidenced hard call will
be acted on; a hedged one will be ignored.
