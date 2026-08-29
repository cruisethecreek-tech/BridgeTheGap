/* Palette invariants. Both themes are checked from the stylesheet itself, so a
   new token or a hand-tweaked colour cannot quietly drop below AA.

   The bug this exists to prevent: --ink is used ONLY as a background, and in the
   Ledger palette it was set to the text colour. Every recessed row rendered
   near-black on paper. Nothing errored; it just looked wrong. */
import fs from 'node:fs';
const s = fs.readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const block = (start) => {
  const i = s.indexOf(start), j = s.indexOf('\n  }', i);
  return Object.fromEntries([...s.slice(i, j).matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map(m => [m[1].slice(2), m[2]]));
};
const dark = block('  :root{'), light = block(':root[data-theme="light"]{');
const L = h => { const c=[0,2,4].map(i=>parseInt(h.slice(1+i,3+i),16)/255)
  .map(x=>x<=.03928?x/12.92:((x+.055)/1.055)**2.4); return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
const ratio = (a,b) => { const x=L(a), y=L(b), hi=Math.max(x,y), lo=Math.min(x,y); return (hi+.05)/(lo+.05); };

const SURFACES = ['bg','panel','panel-2','ink'];
const INKS = ['text','muted','accent','accent-2','good','bad'];
let fails = [];

// 1. a surface token must invert between themes. Dark in both means a role was mixed up.
for (const k of SURFACES.concat(['on-accent'])) {
  if (!(k in dark) || !(k in light)) { fails.push(`token --${k} missing from a theme`); continue; }
  if (L(dark[k]) < 0.12 && L(light[k]) < 0.12) fails.push(`--${k} is dark in BOTH themes (${dark[k]} / ${light[k]}) - it is used as a background`);
  if (L(dark[k]) > 0.5 && L(light[k]) > 0.5) fails.push(`--${k} is light in BOTH themes (${dark[k]} / ${light[k]})`);
}
// 2. every foreground on every surface clears WCAG AA.
let pairs = 0, tightest = { n: '', v: 99 };
for (const [name, t] of [['Ledger', light], ['Midnight', dark]])
  for (const fg of INKS) for (const bg of SURFACES) {
    if (!t[fg] || !t[bg]) continue;
    const v = ratio(t[fg], t[bg]); pairs++;
    if (v < tightest.v) tightest = { n: `${name} ${fg} on ${bg}`, v };
    if (v < 4.5) fails.push(`${name}: --${fg} on --${bg} is ${v.toFixed(2)}, below AA`);
  }
// 3. text on the accent fill (buttons) has to be readable too.
for (const [name, t] of [['Ledger', light], ['Midnight', dark]]) {
  const v = ratio(t['on-accent'], t['accent']); pairs++;
  if (v < 4.5) fails.push(`${name}: --on-accent on --accent is ${v.toFixed(2)}, below AA`);
}
/* ============================================================
   4. THE PER-VIEW TINTS

   "The website is completely monotone... each page has its own distinct colour.
   Almost transparent." Ten rooms, two themes, twenty triples - and every one of
   the ways this goes wrong is silent:

   - a view named here that no view element uses tints nothing, and the tab it
     was meant for keeps falling back to the gold
   - a view element with no entry falls back to the gold too, so two rooms look
     identical and the whole point is gone
   - a light-theme entry left out means the DARK hue lands on warm paper, where
     a colour picked to glow on navy either vanishes or shouts
   - and the wash, however low, sits under every word on the page: if it moves a
     contrast pair below AA then a colour scheme has cost somebody the text

   The last one is the reason this lives in the palette suite rather than the
   structure suite. It is composited here rather than trusted: panel + tint at
   the real alpha, then every ink re-checked against that composite.
   ============================================================ */
const triples = (sel) => Object.fromEntries([...s.matchAll(
  new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + 'body\\[data-view="([a-z]+)"\\]\\s*\\{--view:\\s*([0-9]+),\\s*([0-9]+),\\s*([0-9]+)\\}', 'g'))]
  .map(m => [m[1], [+m[2], +m[3], +m[4]]]));
const tintDark = triples('\n  '), tintLight = triples('  :root[data-theme="light"] ');
const viewIds = [...new Set([...s.matchAll(/id="view-([a-z]+)"/g)].map(m => m[1]))];
const hex = ([r,g,b]) => '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
/* what a wash at alpha A over surface S actually is, which is what the eye and
   the contrast formula both see */
const over = (rgbT, surfaceHex, alpha) => {
  const s0 = [0,2,4].map(i => parseInt(surfaceHex.slice(1+i,3+i),16));
  return hex(s0.map((c,i) => Math.round(c*(1-alpha) + rgbT[i]*alpha)));
};
const PANEL_A = 0.028, HERO_A = 0.07;   // must match the two rules in app.html

for (const [name, tint, theme] of [['Ledger', tintLight, light], ['Midnight', tintDark, dark]]) {
  const keys = Object.keys(tint);
  if (!keys.length) { fails.push(`${name}: no per-view tints found at all`); continue; }
  for (const v of viewIds) if (!tint[v]) fails.push(`${name}: view "${v}" exists but has no tint - it falls back to the accent and looks like another room`);
  for (const k of keys) if (!viewIds.includes(k)) fails.push(`${name}: tint named "${k}" matches no view element - it colours nothing`);
  /* no two rooms may share a colour, or the cue stops being a cue */
  const seen = new Map();
  for (const [k, t] of Object.entries(tint)) {
    const key = t.join(',');
    if (seen.has(key)) fails.push(`${name}: "${k}" and "${seen.get(key)}" are the same colour (${key}) - two rooms that look alike`);
    else seen.set(key, k);
  }
  /* the rule above a heading and the active tab label paint the hue at FULL
     strength on a panel, so it has to be visible there - not AA, it carries no
     text, but a bar you cannot see is not a signal */
  for (const [k, t] of Object.entries(tint)) {
    const v = ratio(hex(t), theme.panel);
    if (v < 1.6) fails.push(`${name}: the "${k}" rule is ${v.toFixed(2)} against the panel - invisible`);
  }
  /* and the wash must cost nobody their text */
  for (const [k, t] of Object.entries(tint)) {
    const washedPanel = over(t, theme.panel, PANEL_A);
    const washedHero  = over(t, theme.bg, HERO_A);
    for (const fg of INKS) {
      if (!theme[fg]) continue;
      const a = ratio(theme[fg], washedPanel); pairs++;
      if (a < 4.5) fails.push(`${name}/${k}: --${fg} on the washed panel is ${a.toFixed(2)}, below AA`);
      const b = ratio(theme[fg], washedHero); pairs++;
      if (b < 4.5) fails.push(`${name}/${k}: --${fg} on the washed header is ${b.toFixed(2)}, below AA`);
    }
  }
}
console.log(`${viewIds.length} views tinted in both themes, washes composited and re-checked`);

console.log(`${pairs} colour pairs checked across both themes`);
console.log(`tightest: ${tightest.n} = ${tightest.v.toFixed(2)}`);
if (fails.length) { console.log('\nFAIL'); fails.forEach(f => console.log('  ' + f)); process.exit(1); }
console.log('no token role inverted, every pair meets AA');
