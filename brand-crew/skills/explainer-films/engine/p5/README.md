# Styles in the p5 tier

`render.mjs --p5` (and `build.mjs --p5`) paints every frame in one real p5.js
2.x WEBGL canvas, with p5.brush's p5 build painting each shape, line and wash
straight into it, in drawing order (`engine/p5tier.js`). A style needs a file
here only when it should look or behave differently in that tier.

- One file per style, `engine/p5/<style>.js`. Every file is loaded after the
  engine for every film in the p5 tier, so a file touches `STYLES.<style>` and
  nothing else (wrap the methods it changes; see `watercolour.js`).
- The file is hashed into that style's engine hash only (`hash.mjs`), so
  porting one style never makes another style's films stale.
- Verify with full-resolution crops (`thumb --full`, `strip --dump=<dir>`)
  beside the live tier, never with a contact sheet.

## Recipe, by kind of style

**Transparent media through `PB` (watercolour, crayon, ballpoint, pencil,
marker, charcoal, sumi, engraving, stipple, calligraphy, notebook):** they
already paint through `PB.shape`/`PB.line`/`PB.loops`, so they work as they
are. p5.brush mixes each stroke into what is under it as pigment, where the
other tiers multiply a painting made on white; a pale fill mixed into a pale
paper lands much lighter than it multiplies. Where a fill disappears, push the
colour multiply would have landed at further from the paper and raise its
alpha (`watercolour.js`: a sixth of the live tier's tint before, about the
same after). Strokes need no change: weights are scaled as `brushbake.js`
scales them.

A p5.brush fill lands up to three times stronger on one seed than another, and
the p5 tier repaints every op on every drawing, so a fill flickers. Paint a
fill that should hold still (a dried wash) with `BOILN` set to 0 around the
`PB.shape` call, which leaves the boil out of its seed, and in two thinner
passes, which keeps an unlucky seed from leaving it bare (`watercolour.js`).

p5.brush grows a fill (and lays massed gestures) past the outline by a share
of each edge's length, so a box's four long edges throw spikes or streaks far
out; the other tiers crop them on their scratch canvas. Cut the outline into
short edges first, nudged off the line under `eps` so `PB` does not simplify
them away (`spray.js`). A clip rect leaves a hard cut instead.

**Covering media (pastel, chalkboard, spray, blueprint's rotring):** ops with
`cover: true` are painted on a plain ground, un-mixed into colour and alpha and
laid on with `source-over`, fresh on every drawing. Pastel and chalkboard work
as they are. Spray needs the short-edge outline above; blueprint's rotring
lands one pixel wide and hard-edged here (soft and nearer two in the live
tier), so `blueprint.js` draws it heavier.

**Canvas2D-only (neon, riso, pixel):** nothing goes through `PB`, so the p5
tier paints them exactly as the live tier does (same pixels). A port gives
their marks to p5.brush in this file. Riso was tried and left as it is: its
spot inks as `brush.fill` (three impressions, a per-ink drum offset, dried
seeds) never land flat, so a print reads as mottled watercolour, a dark ink
needs pushing to keep paper type on it above 3:1 and then goes blotchy, and a
thumbnail paints 1.5x slower. Neon's glow is light, which pigment cannot
paint (the animation kit says the same of `glow()`), so it keeps its 2D glow;
pixel is painted at 640x360 and scaled up hard-edged on purpose and should
stay as it is.

## Cost

Every hand-off between Canvas2D and the p5 canvas (a texture upload, then a
readback when 2D drawing resumes) costs ~20 ms on the farm's UHD 770; a
diagram drawing has ~15, and a motion-blurred frame repeats them per sub-paint.
On the pilot strip that was 80% of the brush time. Runs of brush ops share one
hand-off; a style that interleaves 2D and brush calls less paints faster.
