# Tripwires - a nudge at the door of the shop

The idea, from a user: opt in to a warning when you open the app that usually
gets you. Amazon, Etsy, the food app at 11pm. Not a block - a nudge that says
run this through Accountability first.

Half of that is buildable today and shipped. The other half must never be built
here. This doc is mostly about which half is which, because the difference is
the whole product.

## What this app cannot do, and will not pretend to

**Accountability cannot see which apps you open.** No web page can. There is no
browser API for it, and there is no clever workaround - the capability simply
does not exist on the web platform, by design.

The only things that CAN intercept an app launch are:

| Mechanism | Platform | What it costs |
|---|---|---|
| `AccessibilityService` | Android, native app | Reads the screen of every app you use. Google Play restricts it to apps whose core function needs it; a budgeting app asking for it would likely be rejected, and should be. |
| Screen Time / Family Controls (`DeviceActivityMonitor`, `ManagedSettings`) | iOS, native app | Requires an Apple entitlement granted case by case, and a native app in the App Store. |

Both mean shipping a native app that watches what you do all day. That is the
exact shape of the thing this app exists to argue against, and it would end the
sentence "nothing leaves your device" as a claim anyone should believe. So it is
not on the roadmap - not "later", not "if we get big". No.

**Push notifications are also out, for a smaller reason.** Web Push works on
installed PWAs (iOS 16.4+ and Android), but it needs a *server* to send the
push, and the subscription registers an endpoint with Apple's or Google's push
service. A local `showNotification()` only fires while something has already
woken the service worker, and the Notification Triggers API that would have
allowed scheduled local notifications was never shipped past an origin trial.
There is no way to make this app ring your phone on its own without a backend.

## What actually got built

**Both phones already ship an automation engine that can watch for an app
opening.** So the app hands that engine a link, and the link lands on the
gut-check with the shop already named. The watching happens in the OS, in the
user's own settings; Accountability never learns it happened.

### 1. Tripwire links

Shield &rarr; **Tripwires**. Pick the shops that actually get you - twelve seeded
one-tap chips plus anything you type - and each gets a link:

```
https://accountability.money/app.html#check=Amazon
```

Opening it opens the Trap Radar with **Amazon** filled in, the trap type guessed
(`trapForName`: a food app is Friction, a resale app is Status, anything with
"renewal" in it is a Leak, everything else is Scroll), and the cursor on the
**price**, which is the only thing still missing.

Set up in the OS, once per app, about a minute each:

- **iPhone** - Shortcuts &rarr; Automation &rarr; App &rarr; *Is Opened* &rarr;
  Run Immediately. The action is either **Show Notification** in your own words
  (gentlest) or **Open URLs** with the tripwire link (lands you on the scan).
  iOS automations watch *apps*, not websites, so a shop you use in Safari needs
  the tripwire on Safari or the share sheet instead.
- **Android** - Modes and Routines on Samsung, or MacroDroid / Tasker. Trigger
  is "app opened", action is a notification or the link.

The panel names both, with a platform switch, and guesses which one you are on
from the user agent.

**Menu wording drifts between OS releases**, so the recipes describe the *shape*
of the automation - trigger, condition, action - rather than pretending to be a
screenshot of one particular version.

### 2. The share sheet (Android)

`manifest.webmanifest` declares a `share_target`, so once Accountability is
installed to the home screen it appears in the Android share sheet. Share a
product from inside Amazon and it opens a gut-check with the **name and the
price already read off it** (`bootEntryTarget` parses `share_title`,
`share_text`, `share_url`; a bare URL falls back to its hostname). The query is
stripped from the address bar immediately afterwards so a shared product title
does not sit in the URL.

This is the strongest interception available, because it fires at the moment you
are actually looking at the thing. iOS has no equivalent for web apps.

### 3. The already-open case

A tripwire fires more than once, and the second time the app is usually still
open in the background - so the OS hands over the link **without reloading the
page**, `boot()` never runs again, and the nudge silently does nothing. That is
the common case, not the edge case: you open Amazon, get sent here, go back, and
open Amazon again. A `hashchange` listener handles it, and declines to stomp on
a scan already in progress.

## Rules it follows

- **Never a block.** You can walk straight past a tripwire. The point is that
  you walked past it *on purpose*, which is a different thing from not noticing.
- **The panel denies what the app cannot do, in its own words**, above the fold,
  before anything else. Someone reading "get a warning when you open Amazon"
  needs to know within one sentence that the app is not watching them.
- **A brand-new user is never dropped into a scan of nothing** - a tripwire link
  on a first run gets the setup chat, same as any other entry.
- **Nothing about a tripwire leaves the device.** The list lives in
  localStorage; the automation lives in the phone's own settings.

## Not verified from here

The sandbox has no phone and no network. Every claim about a menu path is from
knowledge, not from a device this session touched. Before this is announced to
anyone, the release checklist should include: build one iPhone automation and one
Android routine end to end, confirm the link opens the installed PWA rather than
a browser tab, and confirm the Android share sheet actually lists Accountability
after install. `tests/structure.mjs` section 37 covers everything that can be
tested without a phone - the links, the parsing, the guessing, the already-open
case, and the copy that must not lie.
