# Category pack art - image prompts and palette

Nine prompts, one per pack, for an image generator. Plus the palette question,
which has a better answer than "make two sets".

---

## 1. The palette

The app ships two themes and they are not variations on each other - the
background flips from a warm cream to a deep blue-slate:

| token | dark | light |
|---|---|---|
| `--bg` | `#131c27` | `#f4efe6` |
| `--panel-2` (the pack card sits on this) | `#222e3d` | `#f0e9dd` |
| `--accent` | `#cfa76a` | `#835a24` |
| `--accent-2` | `#d78868` | `#a8452c` |
| `--good` | `#6fae83` | `#316743` |
| `--text` | `#ece5d8` | `#2c2620` |

The useful thing about that table: **the hue barely moves, only the lightness
flips.** Gold stays gold, terracotta stays terracotta, sage stays sage. Which
means one set of images can serve both themes, if the art sits in the middle of
the lightness range instead of at either end.

### Use this palette - one set, both modes

| role | hex | why |
|---|---|---|
| **Bronze** (primary, line work) | `#A98047` | midpoint of the two accents |
| **Terracotta** (secondary) | `#C0664A` | midpoint of the two accent-2s |
| **Sage** (growth, "still yours") | `#508A63` | midpoint of the two goods |
| **Warm graphite** (shadow, detail) | `#8C867C` | midpoint of the two texts |

Contrast of each against **both** backgrounds:

| colour | on cream `#f4efe6` | on slate `#131c27` |
|---|---|---|
| Bronze `#A98047` | 3.13:1 | 4.80:1 |
| Terracotta `#C0664A` | 3.50:1 | 4.28:1 |
| Sage `#508A63` | 3.56:1 | 4.22:1 |
| Warm graphite `#8C867C` | 3.15:1 | 4.76:1 |

Every one clears **3:1 on both**, which is the WCAG bar for non-text graphics.
So a single neutral set is not a compromise here - it is a correct answer.

### Never use in these images

- pure white `#FFFFFF` or near-white `#FBF8F3` - vanishes on the light card
- pure black `#000000` or near-black `#131C27` - vanishes on the dark card
- any blue, purple, teal or hot pink - off-palette, and the app has no blue
- a solid background of any colour - see below

### The one technical rule that matters most

**Transparent background.** The card paints its own surface (`--panel-2`), which
is `#222e3d` in dark and `#f0e9dd` in light. If the image carries its own
background it will sit in a visible rectangle on at least one of them. Ask for
PNG with alpha, every time.

### If you want maximum polish later

Generate a second set using the dark-theme accents (`#cfa76a`, `#d78868`,
`#6fae83`) and swap with `<picture>` + `prefers-color-scheme`. Better result,
double the work, and the neutral set is genuinely good enough to ship first.

---

## 2. Before you generate nine images

The pack card currently shows a **21px emoji** (`.pk-ico`). An illustration at
that size is wasted. If you want art on these cards the slot wants to be roughly
**64-88px**, which changes the card layout. Say the word and I will rework
`.pk-card` to take an optional image with the emoji as fallback, so packs
without art still look right.

Generate at **1024x1024** regardless - downscaling is free, upscaling is not.

---

## 3. The prompts

Each one is complete and self-contained. Paste the whole block. The style
paragraph is identical in all nine **on purpose** - that repetition is what makes
them look like a set rather than nine unrelated pictures.

If your generator supports it, make the first image you are happy with and then
reference it as a style anchor for the other eight.

---

### 1. The essentials

> Flat editorial vector illustration, square 1:1, transparent background, no text or lettering of any kind. Thick confident line work at a consistent stroke weight, geometric simplification, generous negative space, subtle paper grain, two-colour risograph feel. Strictly limited palette: bronze `#A98047` for line work and primary fills, terracotta `#C0664A` as secondary, sage green `#508A63` as a small accent, warm graphite `#8C867C` for shadow. No white, no black, no blue.
>
> Subject: a simple house form built from five or six solid stacked blocks, seen straight on. The bottom block is the largest and carries all the others. One upper block is slightly offset, but the base is square and steady. Calm, structural, reassuring rather than precarious. Centred, with clear margin on all four sides.

---

### 2. Health & wellness

> Flat editorial vector illustration, square 1:1, transparent background, no text or lettering of any kind. Thick confident line work at a consistent stroke weight, geometric simplification, generous negative space, subtle paper grain, two-colour risograph feel. Strictly limited palette: bronze `#A98047` for line work and primary fills, terracotta `#C0664A` as secondary, sage green `#508A63` as a small accent, warm graphite `#8C867C` for shadow. No white, no black, no blue.
>
> Subject: a stethoscope, drawn simply, whose tube uncoils downward and becomes a long printed receipt that curls at the bottom. The transition from tube to paper is smooth and deliberate. The receipt is blank - no text, no lines, no numbers, just the shape and the torn edge. Centred, with clear margin on all four sides.

---

### 3. Beauty & grooming

> Flat editorial vector illustration, square 1:1, transparent background, no text or lettering of any kind. Thick confident line work at a consistent stroke weight, geometric simplification, generous negative space, subtle paper grain, two-colour risograph feel. Strictly limited palette: bronze `#A98047` for line work and primary fills, terracotta `#C0664A` as secondary, sage green `#508A63` as a small accent, warm graphite `#8C867C` for shadow. No white, no black, no blue.
>
> Subject: a row of seven identical small bottles and tubes, side by side, receding slightly in a gentle arc so they read as "many, repeating". Each object is tiny and unremarkable on its own; together they form one solid mass. Same object, over and over. Centred, with clear margin on all four sides.

---

### 4. Online shopping

> Flat editorial vector illustration, square 1:1, transparent background, no text or lettering of any kind. Thick confident line work at a consistent stroke weight, geometric simplification, generous negative space, subtle paper grain, two-colour risograph feel. Strictly limited palette: bronze `#A98047` for line work and primary fills, terracotta `#C0664A` as secondary, sage green `#508A63` as a small accent, warm graphite `#8C867C` for shadow. No white, no black, no blue.
>
> Subject: a phone lying flat, seen at a slight angle, with a tall precarious tower of small cardboard parcels rising out of its screen. The parcels get smaller toward the top. Plain sealed boxes with tape - no labels, no logos, no writing. The phone is calm and the tower is absurd. Centred, with clear margin on all four sides.

---

### 5. Trips & travel

> Flat editorial vector illustration, square 1:1, transparent background, no text or lettering of any kind. Thick confident line work at a consistent stroke weight, geometric simplification, generous negative space, subtle paper grain, two-colour risograph feel. Strictly limited palette: bronze `#A98047` for line work and primary fills, terracotta `#C0664A` as secondary, sage green `#508A63` as a small accent, warm graphite `#8C867C` for shadow. No white, no black, no blue.
>
> Subject: a hard-shell suitcase standing upright, seen straight on, with a dotted flight-path arc rising from its handle and curving across the upper third of the frame. Along the dotted arc sit four or five small evenly spaced circles like coins or stops. The suitcase is solid and grounded; the arc is light. Centred, with clear margin on all four sides.

---

### 6. Special occasions

> Flat editorial vector illustration, square 1:1, transparent background, no text or lettering of any kind. Thick confident line work at a consistent stroke weight, geometric simplification, generous negative space, subtle paper grain, two-colour risograph feel. Strictly limited palette: bronze `#A98047` for line work and primary fills, terracotta `#C0664A` as secondary, sage green `#508A63` as a small accent, warm graphite `#8C867C` for shadow. No white, no black, no blue.
>
> Subject: a single calendar page shown as a simple empty grid of squares - no numbers, no words, just the grid. One square is circled in terracotta. Sitting on that circled square, far too large for it, is a wrapped gift box with a ribbon, its weight bending the page. Predictable and still too heavy. Centred, with clear margin on all four sides.

---

### 7. Money that works

> Flat editorial vector illustration, square 1:1, transparent background, no text or lettering of any kind. Thick confident line work at a consistent stroke weight, geometric simplification, generous negative space, subtle paper grain, two-colour risograph feel. Strictly limited palette: bronze `#A98047` for line work and primary fills, terracotta `#C0664A` as secondary, **sage green `#508A63` used generously here** as the dominant secondary, warm graphite `#8C867C` for shadow. No white, no black, no blue.
>
> Subject: a cross-section of ground. Above the line, a young plant with three or four confident leaves in sage green. Below the line, a single large bronze coin standing on edge, half buried, with roots growing out of it and spreading down and outward. The coin is clearly a coin and clearly the root system's origin. Centred, with clear margin on all four sides.

---

### 8. Kids & family

> Flat editorial vector illustration, square 1:1, transparent background, no text or lettering of any kind. Thick confident line work at a consistent stroke weight, geometric simplification, generous negative space, subtle paper grain, two-colour risograph feel. Strictly limited palette: bronze `#A98047` for line work and primary fills, terracotta `#C0664A` as secondary, sage green `#508A63` as a small accent, warm graphite `#8C867C` for shadow. No white, no black, no blue.
>
> Subject: roughly fifteen small everyday children's objects - a shoe, a crayon, a ball, a lunchbox, a toy brick, a sock, a cup, a hairbrush - packed tightly together so their combined silhouette forms one single large shape, like a mosaic. Each object is small and ordinary; the shape they make together is big. No faces, no figures. Centred, with clear margin on all four sides.

---

### 9. Lifestyle

> Flat editorial vector illustration, square 1:1, transparent background, no text or lettering of any kind. Thick confident line work at a consistent stroke weight, geometric simplification, generous negative space, subtle paper grain, two-colour risograph feel. Strictly limited palette: bronze `#A98047` for line work and primary fills, terracotta `#C0664A` as secondary, sage green `#508A63` as a small accent, warm graphite `#8C867C` for shadow. No white, no black, no blue.
>
> Subject: a takeaway coffee cup with a lid, seen straight on, whose rising steam loops back down and into the cup again, forming one continuous closed circuit. The loop is unbroken and obvious. Simple, calm, endless. Centred, with clear margin on all four sides.

---

## 4. If the results come back wrong

The three failure modes, in the order they happen:

1. **It adds text.** Generators cannot resist labelling things. Re-prompt with
   "absolutely no text, letters, numbers, words or signage anywhere in the
   image" as its own sentence at the end.
2. **It fills the background.** Say "transparent background, alpha channel, the
   subject floats with nothing behind it" and reject anything with a rectangle.
3. **It drifts off-palette.** Usually a stray blue or a white highlight. List the
   four hex values again and add "these four colours only, no others".

## 5. Checking one before you commit to nine

Drop the finished PNG onto both `#f4efe6` and `#131c27` before you accept it. If
it reads clearly on both, the set will work. If it only reads on one, the art is
sitting too near that end of the lightness range - ask for "mid-tone values
only, nothing lighter than 65% or darker than 35% lightness".
