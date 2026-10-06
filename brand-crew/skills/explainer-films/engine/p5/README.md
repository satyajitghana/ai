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
paper lands much lighter than it multiplies. Where a fill disappears, pass the
colour multiply would have landed at (`watercolour.js`), or raise its alpha.
Strokes need no change: weights are scaled as `brushbake.js` scales them.

**Covering media (pastel, chalkboard, spray, blueprint's rotring):** ops with
`cover: true` are painted on a plain ground, un-mixed into colour and alpha and
laid on with `source-over`, fresh on every drawing. They work as they are.

**Canvas2D-only (neon, riso, pixel):** nothing goes through `PB`, so the p5
tier paints them exactly as the live tier does (same pixels). A port gives
their marks to p5.brush in this file: riso's flat spot inks could be
`brush.fill` with `fillTexture` and a per-ink offset for misregistration;
neon's glow is light, which pigment cannot paint (the animation kit says the
same of `glow()`), so it keeps its 2D glow; pixel is painted at 640x360 and
scaled up hard-edged on purpose and should stay as it is.

## Cost

Every hand-off between Canvas2D and the p5 canvas (a texture upload, then a
readback when 2D drawing resumes) costs ~20 ms on the farm's UHD 770; a
diagram drawing has ~15, and a motion-blurred frame repeats them per sub-paint.
On the pilot strip that was 80% of the brush time. Runs of brush ops share one
hand-off; a style that interleaves 2D and brush calls less paints faster.

## Per style

- **sumi** (`sumi.js`): washes landed at twice multiply's tint (they all but
  vanished); a closed outline of many vertices is painted as one stroke per
  side of its bounding box, since brush.polygon's stroke-per-edge beaded the
  sumi brush round every rounded box. The host's outline (`PB.loops`) still
  beads: it is brush.polygon in p5tier.js.
- **engraving** (`engraving.js`): the host's ruled tone without hatch
  `gradient`, which compounds across the sheet into stripes ~34 px apart;
  now even rules ~13 px apart.
- **stipple**: no file; the dots land crisper and as dense as live.
- **calligraphy** (`calligraphy.js`): tints landed at 1.5x multiply's tint;
  the nib is unchanged.
- **notebook**: no file; pen and marker hatching match the live tier.
