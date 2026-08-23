# Lemon Squeezy setup

The platform decision is made: **Lemon Squeezy**, as merchant of record. The app
is wired for it and inert until you paste one URL in two places.

## Why this one

The deciding factor is **merchant of record**, not fees. As MoR, Lemon Squeezy is
the legal seller: it registers for, collects and remits sales tax and EU VAT, and
issues the invoices. A Stripe payment link would leave all of that on you
personally, and digital-goods VAT has no small-seller threshold in the EU - one
€15 sale to Germany creates an obligation. For a solo founder selling a digital
product worldwide, that is the whole ballgame.

**Known risk, accepted:** Stripe acquired Lemon Squeezy and is building migration
paths toward Stripe Managed Payments. There is no announced shutdown date, and
Lemon Squeezy is operating normally. The app is built so this costs nothing to
survive: the checkout is **one constant in each file** and no code anywhere knows
the vendor's name. Migrating is editing two lines.

## What to create in Lemon Squeezy

1. **Store** - name it whatever the payer should see on their card statement and
   receipt. `Accountability` is the safe choice; a name they do not recognise
   causes chargebacks.

2. **Product**, with these settings, which are not the defaults:

   | Setting | Value | Why |
   |---|---|---|
   | Type | Digital / single payment | Not a subscription. The model is pay once. |
   | Name | `Accountability` | What they think they are buying. |
   | Pricing | **Pay what you want**, minimum ~$9, suggested ~$19 | Matches the honest framing and captures both ends. Set a floor so it cannot be $0. |
   | Deliverable | A short thank-you + the app link | There is no file to deliver. Say so plainly. |
   | **License keys** | **OFF** | Critical. The app has no lock, so a key would be theatre - and a key that unlocks nothing is worse than no key. |
   | Discount codes | Optional | Fine to use. |

3. **Product description** - say exactly what the money buys, because it is
   unusual and a confused buyer refunds. Something like:

   > This app is free and always will be. There is no locked version, no
   > subscription, and nothing here unlocks a feature - you already have all of
   > it. This is for people who want the thing to keep existing. It never sees
   > your financial data, so it has nothing to sell but itself.

4. **Share > copy the checkout link.** It looks like:

   ```
   https://YOURSTORE.lemonsqueezy.com/checkout/buy/VARIANT_ID
   ```

   Any link containing `/checkout/buy/` is the shareable one. Do **not** copy a
   `?cart=` URL from your browser after opening it - those are single-use and
   specific to one customer.

## Wiring it in

Paste the same URL into **both** files, replacing `YOUR_SUPPORT_URL`:

- `app.html` - the `SUPPORT_URL` constant in the funnel config block
- `index.html` - the `SUPPORT_URL` var in the go-live block at the bottom

Then:

```
node tests/funnel.mjs
```

Nothing else is needed. Both files reveal their offer only once the URL is set,
so today's deploy is already safe with the placeholder in place.

## The rule that must not be broken

**Link only. Never their script.**

Lemon Squeezy offers `lemon.js` for an overlay checkout that keeps the buyer on
your page. Do not add it. It would load third-party payment code on a page whose
headline promise is that nothing about the visitor goes anywhere - for **every**
visitor, including everyone who never clicks buy. A link sends nothing until
someone chooses to go.

`tests/funnel.mjs` fails the build if a payment script from any processor appears
in either file. Verified by embedding a real `lemon.js` tag: two checks fail.

## Where the ask appears in the app

A single panel in Settings, and it **waits until the app has earned it** - it
stays hidden until someone has logged 20+ entries or actually talked themselves
out of a purchase. A brand-new user is being asked to pay for a promise; someone
thirty transactions in is being asked to pay for something that already worked.
Same principle the Accountability Report runs on: say nothing until there is
something to say.

The copy names what the app did for them (their War Chest figure, which they can
check) rather than pleading. `tests/funnel.mjs` asserts it never reads as a plea:
no "please", no "help us", no "donate".

## What is deliberately NOT built

- **No license keys or in-app unlock.** Everything ships as readable source; a
  client-side lock is flippable in 30 seconds and a savvy user flipping it
  experiences catching the app in a lie. See `docs/Monetization.md`.
- **No affiliate links.** Built once, removed on the argument that an affiliate
  link next to a user's saved money makes the app the Trap it exists to fight.
- **No overlay script.** See above.

## After the first sale

Two things worth checking once, because both are quiet failures:

1. **The receipt** - buy your own product with a real card. Confirm the store
   name on the statement is recognisable and the delivery email says something
   human. This is the single highest-value test and it costs one transaction fee.
2. **Refunds** - decide the policy before you need it. For a pay-what-you-want
   product with nothing to claw back, "ask and you get it, no questions" costs
   almost nothing and matches the brand.
