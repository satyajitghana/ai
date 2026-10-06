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

Per style, so far (`media()` styles land their fills from inside `shape`,
`hl` and `shadow`, after the label lift; their files swap `PB.shape` for
the length of those calls only, so `PB.shape` sees the landed colour):

- `crayon.js`: fills land at the multiply tint; mixed raw they went chalky
  and cool on the cream paper. Massed fills are seeded once, not per drawing:
  re-seeded, the whole gesture turned every drawing and strobed under labels.
- `charcoal.js`: fills land at the multiply tint; mixed raw, a lifted fill
  came out lighter than the grey paper, which charcoal cannot do. Massed
  fills are seeded once, as crayon's are.
- `pencil.js`: fills land at the multiply tint; mixed raw, pale fills took
  a lavender cast on the cream paper.
- ballpoint, marker: no file. On near-white paper mixing and multiply land
  alike; fills, strokes and the host match the live tier at full resolution.

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

Every hand-off between Canvas2D and the p5 canvas is a texture upload one
way or a readback the other (~10 ms each at 1920x1080 on the farm's UHD 770,
plus the GPU work it waits for). When every brush op paid both, that was 80%
of the brush time. `p5tier.js` now hands the frame to the p5 canvas once per
frame and keeps it there: 2D drawing in between lands on G's emptied canvas as
an overlay and is uploaded over the frame before the next brush op; faded ops
are faded on the GPU (a framebuffer copy laid back at 1 - a); covering media
un-mix on the GPU in one shader pass. A readback happens only at the end of
the frame (or sub-frame, under motion blur) and before 2D drawing that needs
the pixels under it: a composite other than source-over (multiply, screen,
destination-*), a clip, a clear, a put or a read. A style that multiplies or
clips between brush ops costs a readback there, so prefer source-over for 2D
marks laid between brush work.

Measured on the farm (sail-robot-trajectories, 22-24 s strip, 49 frames,
watercolour): 1.41 s/frame before, 1.10 after. A thumbnail painted again in
the same page (the steady state of a batch): watercolour (the same film)
0.73 s before, 0.46 after; pastel (jepa-anything) 1.08 s before, 0.40 after,
since covering media no longer read back. What remains is
p5.brush's own work: a watercolour wash rasterizes its fill mask in Canvas2D
and uploads it (`getShaderMask`), about half of a frame. `render.mjs strip
... --profile` splits PB.stats into brush, up, back, fade and cover with the
GPU drained at each edge; `--cpuprofile=file` writes a V8 profile of the frames.

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
