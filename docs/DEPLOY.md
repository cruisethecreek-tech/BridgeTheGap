# Deploying Accountability

The site is pure static files. Every internal path is **relative**, so the only
host-specific pieces are `CNAME`, the canonical/og tags in `index.html`, the
absolute `start_url`/`scope` in the manifest, and the `CANONICAL_HOST` constant
described below.

---

## 0. Read this first: which branch actually ships

`origin/main` contains **only `README.md` and an old `index.html`** titled
"Bridge the Gap Program". It has **no `app.html`** and was last touched
2026-01-11. All of Accountability lives on
`claude/unfiltered-budgeting-app-sif6n0`, which is **123 commits ahead of main
and zero commits behind** - it fast-forwards cleanly.

Both GitHub Pages and Cloudflare Pages deploy from a branch you nominate, and
both default to the repository's default branch. So unless the branch was
changed by hand, **anything currently live is the old Bridge the Gap page, not
this app.**

Two ways to fix it, and they are a genuine choice:

- **Merge the branch into `main`** and let both hosts keep their defaults. This
  is the normal end state and what you want before launch.
- **Point the host's production branch at
  `claude/unfiltered-budgeting-app-sif6n0`** while it is still in progress. Good
  for previewing, but `main` stays wrong, which will bite later.

Whichever you pick, confirm afterwards that `/app.html` returns 200 on the live
host. If it 404s, the host is building the wrong branch.

---

## 1. Pick one canonical host

There are up to three addresses in play:

| Address | What it is |
| --- | --- |
| `accountability.money` | the real one |
| `bridgethegap-9mv.pages.dev` | Cloudflare Pages preview address |
| `cruisethecreek-tech.github.io` | GitHub Pages preview address |

**Budgets are stored in `localStorage`, which is scoped per origin.** A budget
built on the pages.dev address does not exist on the custom domain, and vice
versa. There is no server copy to fall back on - that is the whole design.

The app guards against this: on a `*.pages.dev` or `*.github.io` host it shows a
notice naming the real address and offering the backup screen first. It never
redirects on its own, because a silent redirect to an empty app is exactly how
someone loses a month of work without knowing why. See `CANONICAL_HOST` in
`app.html` and the matching constant in the `previewOriginNotice` block in
`index.html` - **change both if the domain ever changes.**

Serve from **one** host. The other should stay a preview or be turned off.

### Recommendation: Cloudflare Pages

Given you already have `bridgethegap-9mv.pages.dev`, Cloudflare is the better
production host here:

- **Apex domains work natively** via CNAME flattening. GitHub Pages needs four
  hardcoded A records, and those IPs have changed before.
- **`_headers` works** (see below). GitHub Pages gives you no control over
  response headers at all, so caching and security headers are whatever GitHub
  decides.
- If the domain's DNS is on Cloudflare anyway, custom-domain setup is one click
  and the certificate is automatic.

GitHub Pages remains perfectly viable, and `CNAME` is already committed for it.
Keeping the file costs nothing on Cloudflare, which ignores it.

---

## 2A. Cloudflare Pages (recommended)

**Build settings** - it is a static site with no build step:

- Framework preset: **None**
- Build command: *(empty)*
- Build output directory: `/`
- Production branch: see section 0

**Custom domain:** Pages project → Custom domains → add `accountability.money`.
If the zone is on Cloudflare, DNS is created for you. If DNS lives elsewhere,
add a CNAME for the apex pointing at `bridgethegap-9mv.pages.dev` (this needs a
registrar that supports ALIAS/ANAME at the apex; if yours does not, move the
zone to Cloudflare or use GitHub Pages instead).

**www:** add `www.accountability.money` as a second custom domain, then create a
Redirect Rule in the Cloudflare dashboard sending `www` to the apex with a 301.
`_redirects` in this repo is path-based only and cannot do hostname redirects.

**`_headers`** ships in the repo root and does two jobs:

- `sw.js` and the HTML shells are served `no-cache, must-revalidate`, so an
  update reaches people on their next load instead of whenever a cache expires.
  The service worker is the thing that gates everyone else's updates, so it must
  never be stale.
- Baseline security headers: `nosniff`, `no-referrer`, `X-Frame-Options: DENY`,
  and a `Permissions-Policy` that denies geolocation, mic, camera and payment.
  Receipt capture uses `<input type="file" accept="image/*">`, which goes through
  the OS picker and does **not** need the camera permission, so denying it is
  safe.

**Known gap - no Content-Security-Policy yet.** A CSP would let the edge *prove*
the "nothing leaves your device" claim rather than just assert it. It is not
enabled because receipt OCR lazy-loads `tesseract.js` from jsDelivr, and
tesseract fetches its wasm core and language data from further CDN paths at
runtime. Shipping a policy without confirming that exact host list would break
OCR for anyone who uses it. Worth doing deliberately: turn on OCR, watch the
network tab, write the host list down, then add the policy in report-only mode
before enforcing it.

---

## 2B. GitHub Pages (alternative)

At your registrar, for the apex `accountability.money`, four **A records**:

    185.199.108.153
    185.199.109.153
    185.199.110.153
    185.199.111.153

Optional matching **AAAA records** for IPv6:
`2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`,
`2606:50c0:8003::153`

Then a **CNAME** for `www` pointing at `cruisethecreek-tech.github.io`.

GitHub → Settings → Pages → Custom domain → `accountability.money` → Save, then
tick **Enforce HTTPS** once the certificate issues (up to an hour; the box is
greyed out until then).

The `CNAME` file in the repo root does the same job and survives redeploys -
keep it. Deleting it silently drops the custom domain on the next push.

Note that `_headers` does nothing here, so the caching and security headers
above do not apply.

---

## 3. What to expect

- Anyone who installed the PWA from a preview address keeps that install, but
  it is a different origin, so **their data does not migrate**. They must
  export a backup from Settings before switching and import it after. This is
  the single most likely way to lose real user data during the move.
- The service-worker cache is `accountability-v4`, so returning visitors pick up
  the new shell rather than a stale one.
- Sharing a preview URL after launch splits your users across two data stores.
  Once the custom domain is live, stop handing out the pages.dev address.

## 4. Verify after going live

- `https://accountability.money/` loads the landing page
- `https://accountability.money/app.html` loads the app **(a 404 here means the
  host is building the wrong branch - see section 0)**
- Visiting the pages.dev address shows the preview notice; visiting the custom
  domain shows no notice
- Share the URL into a chat app and confirm the preview card shows the shield
  screenshot (og:image)
- Install the PWA and confirm it opens at the app, not the landing page
- Long-press the installed icon and confirm the "Gut check" shortcut works
- `curl -sI https://accountability.money/sw.js | grep -i cache-control` shows
  `no-cache` (Cloudflare only)
