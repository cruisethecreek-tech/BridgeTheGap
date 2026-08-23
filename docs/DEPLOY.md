# Deploying Accountability

The site is pure static files. Every internal path is **relative**, so the only
host-specific pieces are `CNAME`, the canonical/og tags in `index.html`, the
absolute `start_url`/`scope` in the manifest, and the `CANONICAL_HOST` constant
described below.

Domain: **accountability.money**, owned. Host: **Cloudflare Pages**, project
`bridgethegap-9mv`.

---

## 1. Branch

`main` is the branch to deploy. Feature work happens on
`claude/unfiltered-budgeting-app-sif6n0` and reaches `main` by pull request;
`main` currently holds everything through PR #64. Both Cloudflare Pages and
GitHub Pages default to the repository's default branch, so the default is
correct and needs no change.

Sanity check after any deploy: `/app.html` must return 200. A 404 there means
the host is building a branch that predates the app.

---

## 2. One canonical host, and why it matters

Three addresses can reach this app:

| Address | What it is |
| --- | --- |
| `accountability.money` | the real one |
| `bridgethegap-9mv.pages.dev` | Cloudflare's permanent preview alias (cannot be turned off) |
| `cruisethecreek-tech.github.io` | GitHub Pages preview address, if Pages is enabled |

**Budgets live in `localStorage`, which is scoped per origin.** A budget built
on the pages.dev alias does not exist on the custom domain, and the reverse.
There is no server copy to fall back on - that is the whole design.

Cloudflare always serves the production deployment at both the custom domain and
the `*.pages.dev` alias, so this is a permanent condition, not a launch-week one.
The app guards against it: on a `*.pages.dev` or `*.github.io` host it shows a
notice naming the real address and offering the backup screen first. It never
redirects on its own, because a silent redirect to an empty app is exactly how
someone loses a month of work without ever learning why.

`CANONICAL_HOST` is defined in `app.html`, with a matching constant in the
`previewOriginNotice` block in `index.html`. **Change both if the domain ever
changes.**

Once the custom domain is live, stop handing out the pages.dev address.

---

## 3. Cloudflare Pages setup

**Build settings** - static site, no build step:

- Framework preset: **None**
- Build command: *(empty)*
- Build output directory: `/`
- Production branch: `main`

**DNS.** The cleanest path is to move the zone to Cloudflare: add
`accountability.money` as a site on the free plan, then set the two Cloudflare
nameservers it gives you at your registrar. Once the zone is active, Pages →
your project → Custom domains → add `accountability.money`, and Cloudflare
creates the record itself (CNAME flattening handles the apex, so there are no
IP addresses to hardcode). The certificate is automatic.

If you would rather leave DNS at the registrar, the apex needs an ALIAS/ANAME
record pointing at `bridgethegap-9mv.pages.dev`. Many registrars do not support
that at the apex; if yours does not, either move the zone to Cloudflare or use
GitHub Pages (section 5).

**www.** Add `www.accountability.money` as a second custom domain, then create a
Redirect Rule in the Cloudflare dashboard sending it to the apex with a 301.
`_redirects` cannot do this - it matches paths, not hostnames.

---

## 4. `_headers`

`_headers` in the repo root is read by Cloudflare Pages (GitHub Pages ignores
it). It does two jobs:

- `sw.js` and the HTML shells are served `no-cache, must-revalidate`, so updates
  reach people on their next load instead of whenever a cache happens to
  expire. The service worker gates everyone else's updates, so it is the one
  file that must never be stale.
- Baseline security headers: `nosniff`, `no-referrer`, `X-Frame-Options: DENY`,
  and a `Permissions-Policy` denying geolocation, microphone, camera and
  payment. Receipt capture uses `<input type="file" accept="image/*">`, which
  goes through the OS picker and does **not** need the camera permission, so
  denying it is safe.

**Known gap - no Content-Security-Policy yet.** A CSP would let the edge *prove*
the "nothing leaves your device" claim rather than merely assert it, which is
worth real money to a privacy pitch. It is not enabled because receipt OCR
lazy-loads `tesseract.js` from jsDelivr, and tesseract then fetches its wasm
core and language data from further CDN paths at runtime. Shipping a policy
without confirming that exact host list would break OCR for anyone who uses it.
Do it deliberately: turn on OCR, watch the network tab, write down every host,
add the policy in `Content-Security-Policy-Report-Only` first, then enforce.

---

## 5. GitHub Pages (fallback only)

Not the chosen host, but `CNAME` is committed so this path stays open.

Four **A records** on the apex:

    185.199.108.153
    185.199.109.153
    185.199.110.153
    185.199.111.153

Optional **AAAA** for IPv6: `2606:50c0:8000::153`, `2606:50c0:8001::153`,
`2606:50c0:8002::153`, `2606:50c0:8003::153`. Then a **CNAME** for `www` at
`cruisethecreek-tech.github.io`. Settings → Pages → Custom domain → Save, then
**Enforce HTTPS** once the certificate issues.

`_headers` does nothing here, so none of section 4 applies.

**One caveat while serving from Cloudflare:** the committed `CNAME` file claims
`accountability.money` for GitHub Pages *if* Pages is enabled on this repo.
Since DNS will point at Cloudflare, GitHub cannot validate the domain and may
retry certificate provisioning and email about it. Harmless, but if the noise
bothers you, turn GitHub Pages off in repo settings - the `CNAME` file can stay.

---

## 6. Migration risk

Anyone who installed the PWA from a preview address keeps that install, but it
is a different origin, so **their data does not migrate**. They must export a
backup from Settings before switching and import it after. This is by far the
most likely way to lose real user data during the move, and it applies to your
own household first.

The service-worker cache is `accountability-v4`, so returning visitors pick up
the new shell rather than a stale one.

---

## 7. Verify after going live

- `https://accountability.money/` loads the landing page
- `https://accountability.money/app.html` loads the app (a 404 means the host is
  building the wrong branch - see section 1)
- Visiting `bridgethegap-9mv.pages.dev` shows the preview notice; visiting the
  custom domain shows none
- Share the URL into a chat app and confirm the preview card shows the shield
  screenshot (og:image)
- Install the PWA and confirm it opens at the app, not the landing page
- Long-press the installed icon and confirm the "Gut check" shortcut works
- `curl -sI https://accountability.money/sw.js | grep -i cache-control` returns
  `no-cache`
- `curl -sI https://accountability.money/ | grep -i x-content-type` returns
  `nosniff`

## Refresh the outside numbers (every deploy)

`app.html` carries a small baked table called `OUTSIDE` - CPI, food-at-home CPI,
the national average savings APY and high-yield ballpark, the average new-card
APR, and the fed funds rate, each with its as-of label. The app never fetches
these (that is the point - "nothing leaves your device" stays absolute), so a
deploy is when they update.

Before deploying:
1. Check the latest BLS CPI release (all items and food-at-home, 12-month), the
   FDIC national savings average, a current new-card APR survey, and the Fed's
   H.15 for the effective funds rate.
2. Update the figures and their `asOf` labels in the `OUTSIDE` constant, and set
   `OUTSIDE.built` to today.
3. Run `node tests/structure.mjs` - section 22 asserts the cards still show
   their dates and arithmetic.

If a deploy ships without this step, nothing breaks: once `built` is more than
240 days old the outside cards go quiet on their own and the report says the
figures are too old to show as current. Stale-but-silent is the designed
failure mode; stale-shown-as-current is the one this exists to prevent.

