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
console.log(`${pairs} colour pairs checked across both themes`);
console.log(`tightest: ${tightest.n} = ${tightest.v.toFixed(2)}`);
if (fails.length) { console.log('\nFAIL'); fails.forEach(f => console.log('  ' + f)); process.exit(1); }
console.log('no token role inverted, every pair meets AA');
