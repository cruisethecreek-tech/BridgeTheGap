# Monetization - the honest version

Gemini's critique scored the business model 2/10 and recommended a freemium
license-key model. The instinct (charge for it, target privacy/FIRE communities)
is right. The mechanism (a "Pro license key" that gates features) is **not
enforceable** in this app, and pretending otherwise will backfire. This doc lays
out what actually works given the architecture.

## The hard truth about a client-side app

Everything ships to the browser as readable source. There is no server to check
a license against. That means:

- **A feature paywall is bypassable in about 30 seconds** by anyone who opens
  dev tools. A "Pro" flag in localStorage or a license-key check in JS can be
  flipped or deleted by the user.
- **You cannot do real freemium DRM** without adding a backend and accounts -
  which would destroy the local-only, no-account, nothing-leaves-the-device
  promise that is the app's actual differentiator.

So do not build a fake lock. Build a model that works *with* the architecture
instead of fighting it.

## What actually works here

### 1. One-time purchase (honor system) - recommended
Sell the whole app for a one-time price on a storefront that handles payment and
delivery (Gumroad, LemonSqueezy, Ko-fi, or a simple "buy" page). The buyer gets
the file / the install link. There is no lock inside the app - you are selling
**convenience, trust, and support of the maker**, exactly like a paid iOS
utility or a "pay what you want" tool.

- Privacy-first, anti-consumerist, and FIRE audiences *respect this model* and
  reliably pay for tools they value, precisely because it is honest and not
  surveilling them.
- Suggested price: **$15-25 one-time.** Low enough to be an impulse yes, high
  enough to signal quality.
- Optional "name your price, $9 minimum" to capture goodwill.

### 2. App Store distribution (the real "paywall")
If you want an enforced price, the enforcement lives in the **store**, not the
code. Wrap the PWA (Capacitor / a thin native shell / PWABuilder) and list it on
the Apple App Store or Google Play as a paid app or one-time in-app purchase.
The store handles payment and access; the app itself stays local-only. This is
the only way to get a genuinely enforced price without building a backend.

### 3. Tip jar + "support the build" inside the app
A single, no-pressure "This app is free and stores nothing about you. If it
saved you money, you can support it" link to your storefront. Converts your
best-served users without gating anyone. Pairs well with #1.

### 4. Audience / brand play (cruisethecreek)
The strongest asset is not the code - it is distribution. If this is a brand
extension, the app is a **lead magnet and trust-builder**, not the product. It
earns money indirectly: email list growth, community, coaching, courses,
affiliate/partnership content, YouTube/TikTok around the app's ideas (Life-Hour
currency, Trap Radar, Sovereignty tiers make great content hooks). The app being
free and private is a *feature* of this funnel, not a leak in it.

### 5. Honest referral links (the reward calendar) - live
The reward calendar already earns a natural place to point someone: the moment it
tells a spender "you saved $X today, here's what to do with it." That prompt can
carry **referral links** to investing apps (Acorns, Stash, SoFi, a HYSA, etc.).
When a reader signs up through your link, the partner pays a referral bonus. This
is implemented (`PARTNERS` + `partnerLinks()`), off until you paste real referral
URLs, and it does **not** compromise the privacy promise, because it shares *zero
user data* - it is just an outbound link the reader chooses to click. Rules that
keep it clean:

- **Disclose it, every time.** US law (FTC) requires an affiliate disclosure. The
  block already carries one ("Accountability may earn a referral bonus... at no
  extra cost to you"). Keep it visible; never bury it.
- **Stay education, not advice.** Show *options* and say "do your own research",
  never "you should invest in X." That line keeps you clear of giving regulated
  financial advice.
- **Only list partners you'd actually stand behind**, and only with a referral
  relationship you truly have. Don't imply a partnership that doesn't exist.
- **Never trade data for the payout.** The kickback is for the referral click,
  not for anything about the user. The second it requires sending user data, it
  becomes channel #-none (see below).

Realistic economics: referral bonuses are lumpy and depend on the partner's
current promo (often $5-$25 per funded signup, sometimes a share of a bonus).
It won't replace a salary at small scale, but it's real money that rides on top
of a free product without gating anyone - which is exactly the point.

## What NOT to do

- **No in-app license-key gate** presented as secure. It is not, and a savvy
  user flipping it feels like catching you in a lie.
- **No "Pro unlocks the Vault / Freedom Mode"** style feature-gating in the
  client. Same reason. If a feature is the hook, gating it client-side just
  teaches people to bypass it.
- **No data-for-money affiliate deals.** A *disclosed referral link that shares
  no user data* (channel #5) is fine and is live. What stays off the table is any
  deal where the payout depends on sending user data, linking a bank/account, or
  lead-selling - that contradicts the privacy promise and re-introduces the
  compliance burden the local model avoids. Outbound links: yes. Data pipes: no.

## The moat (be realistic)

There is no technical moat - the code is copyable in an afternoon with an LLM.
The defensible assets are:

1. **Brand + audience** (the cruisethecreek distribution and voice).
2. **The specific point of view** - the Life-Hour currency, the anti-shame
   stance, the Sovereignty framing, the unfiltered tone. A clone can copy the
   code but not the reputation or the taste behind the copy.
3. **Trust** - "genuinely stores nothing, no account, open to inspect" is a
   position most fintech *cannot* credibly take. Lean into it hard.

## Recommended path (solo, low-lift first)

1. Ship it free with a tip-jar link (#3) to build word of mouth and the list.
2. Add a one-time "buy / support" option (#1) on Gumroad or LemonSqueezy.
3. Market to three specific communities, not "everyone":
   r/financialindependence and r/fire, r/nobuy and r/frugal, and
   privacy/minimalism circles that avoid Mint/Rocket Money on principle.
4. Only if there is real pull, wrap it for the App Store (#2) for an enforced
   price and a second discovery channel.

One-line positioning to sell against: **"The budgeting app that stores nothing,
sells nothing, and tells you the truth - it just makes you look your money in
the eye."**
