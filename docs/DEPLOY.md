# Deploying to accountability.money

The site is a static GitHub Pages deploy. Everything in the repo uses **relative
paths**, so the only host-specific pieces are `CNAME`, the canonical/og tags in
`index.html`, and the absolute `start_url`/`scope` in the manifest.

## One-time DNS setup

At your registrar, for the apex domain `accountability.money`, create four
**A records** pointing at GitHub Pages:

    185.199.108.153
    185.199.109.153
    185.199.110.153
    185.199.111.153

(and optionally the matching AAAA records for IPv6:
`2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`)

Then add a **CNAME record** for `www` pointing at `cruisethecreek-tech.github.io`.

## In the repo settings
GitHub → Settings → Pages → Custom domain → `accountability.money` → Save, then
tick **Enforce HTTPS** once the certificate is issued (can take up to an hour;
the box is greyed out until then).

The `CNAME` file in the repo root does the same job and survives redeploys - keep
it. Deleting it silently drops the custom domain on the next push.

## What to expect
- `cruisethecreek-tech.github.io/BridgeTheGap/` will **redirect** to the custom
  domain once it is live. Until DNS propagates, the old URL may 404 - that is
  normal, not a broken build.
- Anyone who installed the PWA from the old URL keeps that install; it is a
  different origin, so their data does not migrate. Local data is per-origin.
  Worth a note in release comms if anyone was already using it.
- The service-worker cache was bumped to `accountability-v4`, so returning
  visitors pick up the new shell rather than a stale one.

## Verify after going live
- `https://accountability.money/` loads the landing page
- `https://accountability.money/app.html` loads the app
- Share the URL into a chat app and confirm the preview card shows the shield
  screenshot (og:image)
- Install the PWA and confirm it opens at the app, not the landing page
- Long-press the installed icon and confirm the "Gut check" shortcut works
