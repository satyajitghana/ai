---
name: claude-animation-base
description: >-
  John Heibel's Claude Animation Base, vendored: a character kit and a guide for
  hand-painted short animations — Clawd with 31 acted emotions, drawn key views,
  dances and props, painted with p5.brush watercolour and boiling ink, rendered
  frame by frame in headless Chrome. Use it to make a bespoke painted short, to
  learn the animation rules its guide teaches (reads, timing, anticipation,
  transitions), or as the character library behind receipt-films. Read
  ANIMATION_GUIDE.md before drawing anything.
---

# Claude Animation Base (vendored)

This directory is John Heibel's [Claude Animation Base](https://github.com/JohnHeibel/ClaudeAnimationBase),
vendored under its MIT licence. Start with [ANIMATION_GUIDE.md](ANIMATION_GUIDE.md): the three goals
(handmade, alive, one piece), the timing rules, the review loop, and the full API. [VENDORED.md](VENDORED.md)
says exactly what differs from upstream.

Two ways it is used on this site:

1. **Bespoke painted shorts**, the way upstream intends: a storyboard, a scene file under `src/scenes/`,
   `npm install` here, then `node render.mjs --clip --out=out/video.mp4`. On a machine with no GPU, set
   `NO_GPU=1` and expect p5.brush watercolour fills to cost tens of seconds a frame in software WebGL;
   upstream's README says as much, and it is why the next use exists.
2. **The character behind every Receipts film.** `brand-crew/skills/receipt-films/engine/paint.js`
   re-implements this kit's drawing API (`paint`, `inkLine`, `rectPts`, `glow`, `letter`, `boilSeed`,
   the p5 transform calls) in Canvas2D, and loads `src/clawd.js` from here unchanged. Frames paint in
   about a tenth of a second on four CPU cores instead of a minute.
