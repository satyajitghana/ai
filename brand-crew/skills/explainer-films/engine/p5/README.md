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
