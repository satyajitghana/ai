---
name: math-reels
description: >-
  Write and render a math reel: a 15-21 second, 1280x720 video for one result
  family of OpenAI's openai/math release (372 families), drawn programmatically
  in one fixed dark style — a plain-words line, the mathematical object
  animated with a small library of exact Canvas2D primitives (number line,
  plot, graph, grid/tensor, shape, Venn, sequence, equation with a term
  visualiser, dependency tree), optionally the key idea of the proof as one of
  14 archetypes, then the before-to-after achievement, then an honest
  verification badge; music bed, optional Kokoro narration and captions. Use when a
  family needs its reel, when writing data/math-reels/<id>.json specs, or when
  previewing or rendering reels. Not the narrated explainer films
  (explainer-films) and never AI-generated imagery.
---

# Math reels

One reel per openai/math family. A reel is a **spec** (`data/math-reels/<id>.json`) that the engine turns into frames: no code per reel, no hand-drawn art, no generated imagery. Every number and formula on screen comes from our reviews, the article (`content/articles/openai-math.mdx`) or the release catalogue (`components/articles/openai-math/catalogue-data.ts`), and every result is labelled as a claim.

| File | What it is |
|---|---|
| `schema.json` | JSON Schema for a spec (`"$schema": "../../brand-crew/skills/math-reels/schema.json"` in each spec gives editor completion) |
| `reel.html`, `engine/reel.js` | the page and the engine: `REEL.load(spec)`, `REEL.frame(t)`; a frame is a pure function of `t` |
| `render.mjs` | frames → ffmpeg (H.264 + AAC), posters, captions, previews |
| `audio.py` | the procedural music bed (numpy only), and the narration: `tts` (Kokoro-82M), ducking, `speak`/`words` checks |
| `voice.mjs`, `voice.test.mjs` | narration timing (fit scenes to lines, place lines, WebVTT), pure functions, tested offline |
| `pronounce.json` | how the narrator says initialisms and names (`say` rewrites, misaki `phonemes`) |
| `pronounce.mjs`, `pronounce.test.mjs`, `plain-words.txt` | offline pronunciation coverage: every narrated word is plain English the voice knows (`plain-words.txt`, written by `audio.py lexicon` with misaki) or is in `pronounce.json` |
| `check.mjs` | the offline truth checker |
| `hash.mjs` | what a rendered reel depends on (spec + engine + the pronunciations its voice uses), for the manifest and `pnpm validate:reels` |
| `generators/` | the Python that wrote the first 369 specs, batch by batch; the JSON is the source of truth (see `generators/README.md`) |
| `fonts/` | Hanken Grotesk + IBM Plex Mono (the site's fonts) with their latin-ext subsets, OFL; math is KaTeX from `node_modules` |

## Commands

```bash
# author → check → preview (fine on any machine, including the Linux server)
node brand-crew/skills/math-reels/check.mjs data/math-reels/107.json --reviews=<dir of review *.jsonl>
node brand-crew/skills/math-reels/render.mjs plan  data/math-reels/107.json      # engine-side checks, timings, sound events
node brand-crew/skills/math-reels/render.mjs frame data/math-reels/107.json --t=1.8,5,10.8,14.2 --out=/tmp/x/107.png --check   # --check lists text outside the frame
node brand-crew/skills/math-reels/render.mjs sheet data/math-reels/107.json --every=1 --out=/tmp/x/107-sheet.jpg [--bench]    # --bench prints paint/screenshot ms
node brand-crew/skills/math-reels/voice.test.mjs                                   # narration timing, offline
node brand-crew/skills/math-reels/pronounce.test.mjs                               # every narrated word covered, offline
python3 brand-crew/skills/math-reels/audio.py speak "Erdős and the FFT"            # what the voice will be given
pnpm validate:reels                                                                # all specs + pronunciation + stale/missing reels (inside pnpm validate)

# full renders: the Windows farm only (refused on Linux without --allow-linux)
node brand-crew/skills/math-reels/render.mjs data/math-reels/107.json data/math-reels/130.json --out=public/films/math/ --workers=2 \
     --python=C:\Users\inkers\films\venv\Scripts\python.exe      # the venv with kokoro, for specs with a voice
node brand-crew/skills/math-reels/render.mjs --stale --out=public/films/math/ --workers=4 --python=...   # every missing or stale reel
```

**Freshness.** A render into `public/films/math` records each reel in `data/.generated/math-reels.json` (`sha`, `bytes`, `posterBytes`, `duration`, `hasVoice`, `vtt` bytes, voice `speed`, `rendered`): machine-written, never hand-edited (`--manifest` forces the write for another `--out`, `--no-manifest` skips it; `--no-audio`/`--no-voice` renders never write it). The sha is `hash.mjs`: the spec as committed, the engine files (`reel.html`, `engine/reel.js`, `render.mjs`, `audio.py`, `voice.mjs`, the fonts, the KaTeX version) and only the `pronounce.json` entries the reel's own voice uses. `pnpm validate:reels` runs `check.mjs` over every spec (review quotes against `data/math-wall/notes.json` when the checkout has it: a snapshot of some review fields, so it confirms quotes and never fails one it lacks; otherwise structural), the pronunciation coverage, and freshness: a **stale** reel (hash moved), a manifest entry without its files, or one without a spec **fails**; a spec with **no reel yet is a warning**, so validate stays green until the farm has rendered them. `render.mjs plan` is not in it (it needs a browser).

`plan` also compiles every TeX string with KaTeX, measures formulas against the frame (shrinking them to a floor, refusing below it), checks every character against the bundled fonts' real coverage, and, for a spec with `voice`, times the lines (by estimate, 3 words a second, unless `--voice-durations=<json {id: [sec...]}>` gives real ones) and reports which scenes it lengthened.

The full render writes `public/films/math/<id>.mp4` (1280x720, 30 fps, H.264 `-crf 32 -tune animation`, AAC 96 kb/s stereo, `+faststart`), `<id>-poster.webp` (the object scene at its fullest, with the top bar naming the family) and, for a voiced spec, `<id>.vtt` (captions from the voice lines at their real times). On win32 it drives the installed Chrome (then Edge) through Playwright; `--chrome=`, `--ffmpeg=`, `--python=` override the tools, `--no-audio` skips the bed, `--crf=` and `--fps=` tune the encode. It needs Playwright, ffmpeg on `PATH` and Python 3 with numpy.

**Always look at a sheet or frames before a render.** Collisions are obvious in a picture and invisible in JSON.

## The reel, scene by scene

Fixed order, fixed style; the spec only fills the slots. Total 15-20 s, or 15-21 s with a `proof` scene or a `voice` (the checker and `plan` enforce it).

| Scene | Default (range) | With `proof` | What is on screen |
|---|---|---|---|
| `title` | 2.6 s (2-3) | 2.5 | discipline chip in the discipline's colour, the kind chip ("Claimed proof", "Claimed improved bound", ...), the family number as a watermark, the title (word by word), a one-line `Claim: ...` subtitle |
| `object` | 8 s (6-9) | 6 | the `plain` line on top (if any), then the mathematical object, drawn and animated by 1-3 primitive panels; up to 3 caption `beats` |
| `proof` (optional) | — | 5.5 (5-6) | "How it's proved" + a "simplified" tag; the key idea as an animated archetype; 2-4 plain-language steps as captions, with step dots |
| `achievement` | 4.4 s (3-5) | 3.5 | `bound`: best known → claimed, side by side, with an arrow; or `status`: the statement, what was known, and a **CLAIMED** stamp |
| `verify` | 2.6 s (2-3) | 2 | the Lean badge — `main`: "Lean-checked: main theorem" (green tick), `part`: "Lean: part only" (amber half), `none`: "Manuscript only" (grey page) — what exactly is formalized, the standing "Claim, not yet peer-reviewed" pill, and what we checked |
| `end` | 1.6 s (1.2-2) | 1.2 | `ai.thesatyajit.com` + `/articles/openai-math`, fading to black so the loop closes |

From the object scene on, a top bar names the family (`107 · short title` left, discipline right) and a hairline in the accent colour fills along the bottom as the reel plays, a soft light at its head.

**Motion (the engine's, not the spec's).** Every scene is drawn in a *layer*: one camera matrix applied to the canvas and to that scene's DOM labels together, so text and graphics move as one (`withLayer` in `engine/reel.js`). The camera pushes in slowly on each scene's focal point (2-3.4 % over the scene) and drifts on one shared, continuous path; the background pattern drifts at a third of that (parallax). Cuts overlap by 0.75 s: title → object is a slanted wipe along an accent light bar; object → proof → achievement → verify push through (the old scene scales up and fades in the first half, the new one settles in from 95.5 % in the second half, so text never sits on text); verify → end dissolves; the end fades to black so the loop closes. Panels in a `sequence` hand over the same way. The stamp's hit dips the camera 3 px. Inside the primitives: lines draw themselves with a light at the head; nodes, markers, boxes and cells pop with a small overshoot; crossings, landings and marks flare with a ring; counters bump as they tick; the number-line slide leaves a glowing trail, rings out on landing and brackets the gap; a zoom streams a powers-of-ten ruler; the matmul sweep lights the row, the column and the one pair being multiplied, product by product; plot regions open left to right; morphs leave a ghost of the starting shape; formulas assemble term by term; titles, captions and steps arrive word by word. Staggered reveals scale to the panel: per-item delay = min(default, 45 % of the panel / items), so a 390-node lattice still finishes. Accent strokes are drawn twice, the second time into a half-size glow buffer that is blurred and added back (bloom). A frame is still a pure function of `t`. Cost: ~12 ms of paint per frame here (screenshot ~60 ms), against ~3 ms before.

**Style (do not vary per reel).** Background `#0b0d12`, the discipline's pattern drawn faintly and kept quiet behind the centre (lattice: algebra, number theory, groups, operator algebras, algebraic geometry; waves, flowing: analysis, functional analysis, PDE, mathematical physics, dynamics; a network with travelling packets: combinatorics, TCS, logic; contour lines: convex/metric and differential geometry, topology; random walks: probability), dimmed while the maths is on, two slow pools of light and a vignette. Text `#ECE9E2`, secondary `#C3C8D0`, muted `#8E95A1`. One accent per discipline (`DISCIPLINES` in `engine/reel.js`, similar lightness, never two on one reel). Verification colours are semantic and shared: green Lean, amber partial and the peer-review pill, grey manuscript-only; crossings and similar "events" are `hot` yellow. Hanken Grotesk for text, IBM Plex Mono for numbers and counters (both with Latin Extended-A: Lazić, Forstnerič, Erdős), KaTeX for every formula. Captions and statements are 23-28 px and nothing that carries meaning is under 18 px (only chrome and legends go down to 14-17 px): it has to survive a phone.

**Sound.** `audio.py` lays a quiet two-chord pad (D major 9 → B minor 9) with a low drone and a breath of air, and soft synthesized chimes on the engine's events: `cut` (scene change), `tick` (a number-line marker lands), `land` (the result lands), `stamp`, `badge`. Seeded by the family id; peak ≤ −4.4 dBFS. Without a `voice` the captions are the on-screen text itself and there is no `.vtt`.

**Narration (optional, `voice`).** Spoken lines per scene, 40-55 words in all, written as speech. On the farm `render.mjs` voices each line with Kokoro-82M (`audio.py tts`, voice `af_heart`, speed 1.1, the explainer films' settings, copied not imported), caching every wav by a hash of what is actually said (`~/.cache/math-reels/voice`, or `MATH_REELS_CACHE`, or `--voice-cache=`). `voice.mjs` then lengthens any scene too short for its lines — 0.3 s lead so the cut lands first, 0.15 s between lines, 0.25 s tail, rounded up to 0.1 s, never past the scene's maximum — and, if that takes the reel past 21 s, takes the time back from scenes with slack (end, verify, title, achievement, proof, in that order; never the object scene, never below a scene's minimum or below its own lines). If the lines still cannot fit, `render.mjs` re-voices the reel at Kokoro speed 1.18, then 1.25, and only then fails that reel cleanly (the others carry on). `plan --voice-scale=1.15` stress-tests this with slower-than-estimated speech: at 1.15 all but one of the 372 specs fit (149), most at speed 1.18. The explainer films measured ~3.1 words/s at 1.1, so the 3 words/s estimate is slightly conservative; most reels are planned at 20.5-21 s, so the speed fallback is the margin. A voice line is at most 96 characters (`plan` refuses longer; split it). `audio.py` mixes the voice at −3 dBFS peak over the bed, ducked about 10 dB while anyone talks, and `<id>.vtt` is written from the lines (cues of ~12 words, timed by word share). `pronounce.json` spells initialisms for the voice (`FFT` → "F F T", `K3` → "K three", `klt` → "K L T", `CAT zero` → "C A T zero"; captions keep the original), rewrites the few phrases where a variable `a` would be read as the article (to the sentinel `Ay`, /ˈA/), and gives misaki phonemes (US notation) for ~330 names and terms misaki does not know or says wrong (Erdős, Grothendieck, Kolmogorov, Lie, cohomology, plethysm, ...), each in its native or standard English pronunciation. A lowercase entry also covers the capitalised word; a hyphen between letters is a word break (Kazhdan-Lusztig is two entries; p-adic is "p" + "adic"); a possessive uses its base. `python audio.py words --in lines.json` on a machine with misaki lists any name the voice would guess, and `tts` refuses those unless `--allow-guess`; `pronounce.test.mjs` (and `pnpm validate:reels`) finds the same thing offline from `plain-words.txt`: a new word fails until it is added to `pronounce.json`, or, if misaki already knows it, to `plain-words.txt` with `python audio.py lexicon --in lines.json`. TTS cannot run on the Linux server: there `plan`, `frame` and `sheet` time the lines by estimate.

## Spec format

```jsonc
{
  "$schema": "../../brand-crew/skills/math-reels/schema.json",
  "id": "107",                                   // 3 digits = file name = family
  "discipline": "Theoretical computer science",  // exactly the catalogue's string
  "kind": "improved-bound",                      // proof | disproof | counterexample | improved-bound | partial | conditional
  "short": "Matrix multiplication, $\\omega \\le 9/4$",          // top bar, ≤ 44 chars
  "title": { "title": "...", "subtitle": "Claim: ..." },          // ≤ 64 / ≤ 110 chars
  "plain": "Multiplying two big tables of numbers takes about $n^3$ steps; ...",   // optional, ≤ 110, everyday words
  "object": { "dur": 8.6, "layout": "sequence", "panels": [ {...}, {...} ], "beats": [ { "at": 0.2, "text": "..." } ] },
  "achievement": { "form": "bound", "before": { "label", "tex", "note" }, "after": { "label", "tex", "note" }, "note": "..." },
  "proof": { "archetype": "squeeze", "steps": ["...", "...", "..."], "data": { ... } },  // optional, see below
  "verify": { "lean": "main", "detail": "...", "ourCheck": "..." },
  "voice": [ { "scene": "title", "text": "Faster matrix multiplication." }, ... ],    // optional narration
  "sources": [ { "ref": "review 107, known_before", "quote": "2.371177 (Dupont et al. ...)" } ]
}
```

Text fields are **rich text**: `$TeX$` (KaTeX), `==accent==`, `**bold**`. Inside TeX, `\hl{...}` paints the accent, `\mute{...}` dims, `\hot{...}` is yellow. Fields named `tex`, and `statement` lines, are TeX without `$`. **Anything that is not Latin text goes inside `$...$`**: Greek letters, ≤, →, ∞, subscripts. The fonts have no such glyphs, so the engine refuses them outside math rather than let a system fallback creep in. Allowed outside math: ASCII, Latin-1, – — ‘ ’ “ ” · × … −.

Times (`at`, `from`, `until`, `dur` inside primitives) are seconds from the start of their panel (or of the object scene for `from`/`until`/`beats`).

### Primitives (`object.primitive`, or each of `object.panels[]`)

`layout`: `single` (one panel), `sequence` (panels one after another, crossfaded; set `until` on one and `from` on the next), `split` (side by side; only for two small objects).

| Primitive | Draws | Key parameters |
|---|---|---|
| `numberline` | an axis with ticks; markers (dots or rings) with a label and a note; shaded ranges; a **slide** from the old value to the claimed one with a trail and a landing pulse; a **zoom** into a gap too small to see, with a live `×10^k` counter | `min, max, ticks[], axisLabel, markers[{v,label,note,tone,at,side,style,derived}], ranges[{from,to,label,note,side}], slide{from,to,at,dur,label,note}, zoom{min,max,at,dur,counter,ticks}` |
| `graph` | nodes and edges, drawn in order; crossings computed and marked; packets flowing | `preset: twopage` (K_n's two-page drawing; crossings computed and **asserted equal to Z(n)**), `butterfly` (FFT network, `inLabel: "$x_{#}$"`, `highlight`), `complete` (K_n on a circle, `colours[]`, `crossings`), or `nodes[{id,x,y,label,tone,fill}]` in 0-1 stage coordinates + `edges[[a,b,{tone}]]`; `counter{label,done}`, `edgeAt`, `edgeDur` |
| `grid` | a matrix of cells with values and outlined blocks; `preset: matmul` (A × B = C sweep with a product counter); `preset: tensor` (isometric a×b×c box with highlighted cells) | `rows, cols, cells[[r,c,tone]], values[][], blocks[{r,c,h,w,label}], caption`; `n, sweepAt, sweep`; `dims, cells[[i,j,k,tone]], axes[]` |
| `plot` | axes, curves drawn left to right, shaded regions between curves, dashed asymptotes, points | `x:[a,b], y:[c,d], xticks, yticks, xlabel, ylabel, curves[{f:"x*log(x)",label,tone,dash,at}], regions[{f,f2,from,to}], asymptotes[{x}|{y}], points[{x,y,label}]` (`f` is a JS expression in `x` with `Math` in scope) |
| `shape` | polygons, regular polygons, circles, ellipses, superellipses (unit-square coordinates), with **morphs** between any two | `shapes[{kind,points|n|r|rx|ry|p,label,tone,morph{...,at,dur}}], points[{p,label}], axes` |
| `venn` | 2-3 sets, shaded regions, members | `sets[{label,tone}], regions[{set:"A&B&!C",label}], members[{x,y,label}]` |
| `sequence` | terms or digits in boxes, revealed in turn, some marked | `items[], marks{index: tone or {tone,at}}, perRow, ellipsis, index:"$a_{#}$", caption` |
| `equation` | KaTeX display lines that stack or replace one another, assembling term by term; optionally *visualised* (below) | `lines[{tex,note,tone,at,size,y,terms,relation}], mode: stack | replace` |
| `tree` | a dependency tree built bottom-up: what the main theorem rests on, styled by status | `nodes[{id,label,parent,status: lean | paper | prior}]` (one node without `parent` is the root) |

Number line extras: `slide.gap` (rich text, ≤ 40, numbers need a quote) labels the bracket drawn between the old and the claimed value after the landing; `slide.gap: false` hides the bracket; `slide.gapSide`.

### The equation visualiser (optional, per equation line)

Tag parts of a formula with `\term{name}{...}` (a KaTeX macro; names are letters and digits) and describe them:

```jsonc
{ "tex": "\\term{a}{r^{-3}} \\cdot \\term{b}{O(r^2)} = \\term{d}{o(1)}", "y": 0.56,
  "terms": {
    "a": { "label": "blows up", "tone": "bad", "at": 0.7, "mark": "brace",        // brace | box | arrow; side: below | above
           "visual": { "kind": "curve", "f": "1/(x*x*x)", "x": [0.25, 1], "y": [0, 40], "dx": -200, "w": 150, "h": 70 } },
    "d": { "label": "tends to zero", "mark": "box" } },
  "relation": { "kind": "le", "left": { "from": 1.4, "v": 1, "label": "$\\omega(v,Jv)$" }, "right": { "v": 1.2 }, "label": "..." } }
```

- `terms.<name>`: (a term's box is the union of everything it inks, so `\term{a}{\binom{n}{k}}` and fractions get their brace under the whole construct) the term takes its `tone` (with a short glow) at `at` (seconds after the line appears; default 0.9 + 0.7 per term), a brace/box/arrow and a short `label` (rich text, 1-3 words: "error term", "dimension $n$"), and optionally a **mini visual** under the caption joined by a leader line: `curve` (`f` in `x`, `x`, `y`, optional dashed `ref` level), `line` (`min`, `max`, `marks[{v, tone, label}]`), `shape` (`shape`: circle/regular/ball/superellipse, `n`), `graph` (`n`, `edges` or complete), `dots` (`n`, `mark[]` indices), `bar` (`v`, `max`); `dx`/`dy` move it, `w`/`h` size it. Every mini visual is tagged **illustrative** on screen unless `illustrative: false` (only for drawn values that are quoted).
- `relation`: animates what the line says. `lt`/`le`/`gt`/`ge`: the left side as a bar that shrinks (or grows) from `left.from` to `left.v` past the right side's `right.v`; `eq`: two bars slide together and merge; `sub`: the tagged `term` slides out and `tex` slides in its place (keep the widths similar, or use `mode: replace`). Bars are tagged "illustrative lengths" unless `illustrative: false`.
- `y` (0-1) places a line in the stage to leave room under it; in `replace` mode a visualised line moves up and its note goes to the bottom.

**Never ship an equation-only reel when a term can be visualised**, and label illustrative visuals as illustrative on screen (the engine does by default).

### The proof scene (optional): how it's proved, simplified

`proof: { archetype, steps, data, dur?, label? }` adds a 5-6 s scene between `object` and `achievement`. `steps` are 2-4 captions in plain words (≤ 72 visible characters, aim for 60), and step *k* also starts stage *k* of the archetype's animation. Jargon goes only in small labels inside `data`. The scene says "How it's proved" with a "simplified" tag, and every archetype except `cancellation` is tagged illustrative.

| Archetype | Use when the proof... | Animation | `data` |
|---|---|---|---|
| `counterexample` | exhibits an object where the property fails | a chain of cases, each ticked, then one breaks with a red flare | `items, breakAt, label, labels[], caption` |
| `construction` | builds the object from parts | pieces fly in and snap into place, each with its role | `pieces[{label, role, tone}], result` |
| `squeeze` | pins a value between a lower and an upper bound (or closes the old gap) | two brackets close in on the value | `min, max, lower{v, from, label}, upper{...}, lowerStep, upperStep, target{v, label}` |
| `amplify` | boosts a small gain by copying, nesting or tensor powers | a block copied into itself level by level, zooming out, with a live copy count | `k, levels, unit, label` |
| `reduction` | turns the problem into another, solved one | a chain of boxes, arrows lighting in turn | `boxes[], arrow` |
| `contradiction` | assumes a minimal counterexample and derives a smaller one | the bad case, a smaller copy, then it cracks: "impossible" | `assume, smaller, impossible` |
| `induction` | climbs from a base case, one step at a time | the same step repeated, stacking like stairs | `levels, labels[], base, var, step` |
| `probabilistic` | shows a random object works with positive probability / on average | a cloud of samples settles; the average crosses a threshold | `samples, threshold, mean, thresholdLabel, label` |
| `monotone` | follows a quantity that only decreases (energy, potential) to a bound | a falling staircase plot hitting a floor | `floor, label, floorLabel, ylabel` |
| `counting` | uses pigeonhole or double counting | items drop into boxes; one overflows | `boxes, items, overflowInto, label, boxLabel` |
| `correspondence` | matches two families (a bijection, an injection) | two columns linked by arrows | `left[], right[], pairs[[i, j]], leftTitle, rightTitle, label` |
| `local-to-global` | checks small pieces and glues | patches ticked one by one, then stitched | `cols, rows, patchLabel, label` |
| `cancellation` | sums terms that cancel in pairs | the formula's tagged terms pair up, are struck out, and the rest lands | `tex` (with `\term`), `cancel[[a, b]], result, label` |
| `rearrange` | cuts and moves pieces (dissection, rearrangement) | a shape cut into strips that move and re-form | `pieces, to: column | square, label` |

**Truth rule for proofs.** The key idea must come from the review's `explainer`/`claim` fields or the paper's own proof overview — never invented, never a generic template forced onto a proof it does not describe. If the idea cannot be stated honestly in 2-4 plain steps, leave the scene out. Numbers in steps and labels follow the same quote rule as everything else.

Tones: `accent`/`claim`/`new` (the discipline colour), `ink`, `soft`, `old`/`mute`, `faint`, `ok`, `warn`, `bad`, `hot`, `cool`, or `#rrggbb`. Old values are `old` (default for markers), the claim is `claim`.

## Truth rules

1. **Every number a viewer reads has a quote behind it.** `sources[]` holds verbatim quotes with a `ref` starting `review`, `article` or `catalogue`. `check.mjs` fails a spec if a multi-digit or decimal number in any shown text (titles, beats, labels, notes, `tex`, statements, details) is in no quote, and if a non-integer marker position is unquoted without a `derived` formula. Article and catalogue quotes are checked verbatim against the files; review quotes against the review JSONL when `--reviews` is passed.
2. **A claim is a claim.** The kind chip says "Claimed ...", stamps carry **CLAIMED**, the `after` label says "Claimed, <date>", and the verify scene always shows "Claim, not yet peer-reviewed" (a custom `review` text must still contain "claim").
3. **Verification is the catalogue's, not ours.** `verify.lean` must match the catalogue (`l`: 0 main, 1 part, 2 none) — the checker enforces it. `detail` says exactly what is and is not formalized when it matters (family 130: the Lean covers only the subsequential circuit theorem, not the 10⁻¹³ algorithm). `ourCheck` says what *we* did and did not do ("we did not build the Lean").
4. **Computed, not asserted.** Where the engine can compute the thing shown, it does, and refuses a mismatch: the two-page drawing's crossings must equal Z(n), the matmul counter counts real products. Prefer those presets to hand-placed numbers.
5. **Pictures are illustrative, numbers are not.** A schematic (a convex body, a Venn diagram, a small instance) is an illustration of the object; say so in a beat when a viewer could mistake it for data ("a small instance", "schematically"). Never plot invented data as if it were measured.
6. **The strongest honest qualifier goes on screen.** If the review's caveats change what the headline means (only over ℂ; only for all but finitely many p; non-constructive; galactic constants), put the most important one in `achievement.note` or the `after.note`.

## Authoring guide (for the other 369 specs)

Read the family's review(s) (`claim`, `known_before`, `kind`, `lean`, `caveats`, `explainer`), its row in the catalogue, and the article section if it has one. Then:

**1. Pick the achievement form from the review's `kind`.**
- `improved bound` → `form: bound`. *Before* = the best bound in `known_before` with its author and year (the most recent, not the most famous); *after* = the claimed bound, stated exactly as the review states it (strict or not, the field, the regime). If the claim is only in a restricted setting, the setting goes in `after.note`.
- `proof` of a named conjecture/problem → `form: status`, `stamp: proved`; `label` = whose conjecture and when; `statement` = the formula (1-2 lines); `context` = what was known before (the strongest partial result, with its number).
- `disproof/counterexample` → `status` with `stamp: disproved` or `counterexample` (statement = the conjecture that fails, `context` = the counterexample's size or shape), or `bound` when it beats a believed-optimal bound (130).
- `partial` → `stamp: partial`; `conditional` → `stamp: conditional` and the condition in `note`.

**2. Pick the primitive from what the object is.**

| The result is about... | Use |
|---|---|
| an exponent, constant or threshold improving (ω, a ratio, a density, an approximation factor) | `numberline` with history markers and a `slide` old → new; a `zoom` when the change is invisible at full scale |
| a growth rate, an inequality between functions, a region, an asymptote | `plot` (curves + `regions` between them) |
| graphs, colourings, crossings, networks, circuits, Cayley graphs | `graph` (preset when one fits, else explicit nodes) |
| matrices, ranks, blocks, tensors, operators as arrays, grids/lattices | `grid` (`matmul`, `tensor`, or cells + blocks) |
| convex bodies, polytopes, curves, surfaces in section, packings | `shape` (with a morph between the two objects being compared) |
| inclusions and separations between classes (complexity classes, groups, properties) | `venn` |
| integer sequences, digits, primes, words, partitions | `sequence` |
| an identity, a formula, a definition the viewer must see | `equation` (`replace` to transform one form into another) |
| a proof assembled from lemmas, some in Lean | `tree` (status `lean` / `paper` / `prior`) |

Two panels in `sequence` work well: the object first (what is being measured), then the measurement (107: the matmul sweep, then ω on a line; 130: the butterfly, then the zoom). Keep to one panel when one tells the story (165). Prefer a small, exact instance (K₇, n = 8, a 4×4 product) over a big vague one.

**3. Write the text tight, and for a non-mathematician.** A viewer who knows no maths must be able to follow title → `plain` line → proof steps → claim. `plain` (≤ 110) says what the result is about in everyday words with an analogy; proof `steps` are plain sentences; jargon stays in small labels. Limits are hard (the engine refuses longer): `short` 44, `title` 64, `subtitle` 110, `plain` 110, `heading` 72, beat `text` 96, proof step 72, `note` 80, `detail` 100, `context` 110, `label` 72, `ourCheck` 80, `gap` 40 visible characters (TeX counts as one). Text outside `$...$` may use ASCII, Latin-1, Latin Extended-A and common punctuation (the fonts' real coverage); everything else goes in TeX. Beats: at most three, at least ~2.5 s apart, the first at ~0.2 s; each one sentence, present tense, no hype words ("revolutionary", "stunning"). Marker labels 1-3 words, notes ≤ 25 characters. Dates as "2 Oct 2026" or "Aug 2026". A `subtitle` that states the result starts with "Claim:".

**4. Choose the numbers.** Use as few digits as tell the story, but never round a claimed value into something the paper does not say: write the paper's own form (`9/4 = 2.25`, `1 - 10^{-13}`) and quote it. Old bounds: the immediately previous record (the "before"), plus at most two historical anchors on a number line. When the improvement is tiny (`0.000122`), show it as tiny — a zoom, or a note — rather than drawing it as a leap.

**5. Time it.** Defaults sum to 19.2 s (20.7 s with a proof scene, whose defaults are shorter elsewhere; set `object.dur` ≤ 6.3 with a proof); the object scene is the only one worth stretching. With a `voice`, write each scene's line to fit it — about 3 words a second after a 0.3 s lead: title ≤ 6 words, verify ≤ 4, object ≤ 15, proof ≤ 14, achievement ≤ 8 at the proof defaults — `plan` lengthens a short scene and refuses past 21 s. In the object scene the eye needs ~0.6 s to find a new element; give a slide 1.4-1.6 s, a zoom 2 s, a graph's edges ~2.5-5 s, and leave ≥ 1.5 s of hold on the finished picture before the cut.

**6. Check, look, iterate.** `check.mjs` (with `--reviews`), `render.mjs plan`, then a `sheet` and 4 `frame --check`s at: the title (~1.8 s), mid-object, end of object (and mid-proof), achievement after the stamp/arrow. Fix collisions by moving labels (`side: below`), shortening text or changing `y`, not by shrinking type.

## Not in scope

The narrated explainer films and thumbnails are `explainer-films` — never modify that folder (its files are hashed into every film's freshness check); this skill copies its patterns, not its code. Embedding reels on the site is a separate step: the outputs land in `public/films/math/` and go through `mediaUrl()` like every other film.
