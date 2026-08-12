# Accountability

An unfiltered, no-nonsense **zero-based budgeting** app - every dollar gets a job,
with a gut check for every purchase, dreams/goals tracking, honest
assets-vs-liabilities, cost-of-ownership, charts, and an installable (PWA) experience.

## Pages
- `index.html` - the public **landing / explainer** page (the marketing front door)
- `app.html` - the Accountability budgeting **app** itself (installable, offline-capable)
- `shots/` - product screenshots used by the landing page
- `manifest.webmanifest`, `sw.js`, `icon*.png`, `icon.svg` - PWA support (installs the app at `app.html`)
- `budget.html` - redirect stub pointing to `app.html` (kept so old links / saved `#gutcheck` URLs work)

Everything is a self-contained static site; the app stores data locally in the
browser (nothing leaves the device). Visitors land on `index.html`; the "Open the
app" buttons and the installed PWA open `app.html`.
