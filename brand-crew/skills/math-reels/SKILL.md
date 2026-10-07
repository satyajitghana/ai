---
name: math-reels
description: >-
  Write and render a math reel: a 15-20 second, 1280x720, music-only video for
  one result family of OpenAI's openai/math release (372 families), drawn
  programmatically in one fixed dark style — the mathematical object animated
  with a small library of exact Canvas2D primitives (number line, plot, graph,
  grid/tensor, shape, Venn, sequence, equation, dependency tree), then the
  before-to-after achievement, then an honest verification badge. Use when a
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
| `render.mjs` | frames → ffmpeg (H.264 + AAC), posters, previews |
| `audio.py` | the procedural music bed (numpy only) |
| `check.mjs` | the offline truth checker |
| `fonts/` | Hanken Grotesk + IBM Plex Mono (the site's fonts), OFL; math is KaTeX from `node_modules` |

## Commands

```bash
# author → check → preview (fine on any machine, including the Linux server)
node brand-crew/skills/math-reels/check.mjs data/math-reels/107.json --reviews=<dir of review *.jsonl>
node brand-crew/skills/math-reels/render.mjs plan  data/math-reels/107.json      # engine-side checks, timings, sound events
node brand-crew/skills/math-reels/render.mjs frame data/math-reels/107.json --t=1.8,5,10.8,14.2 --out=/tmp/x/107.png
node brand-crew/skills/math-reels/render.mjs sheet data/math-reels/107.json --every=1 --out=/tmp/x/107-sheet.jpg

# full renders: the Windows farm only (refused on Linux without --allow-linux)
node brand-crew/skills/math-reels/render.mjs data/math-reels/107.json data/math-reels/130.json --out=public/films/math/ --workers=2
```

The full render writes `public/films/math/<id>.mp4` (1280x720, 30 fps, H.264 `-crf 32 -tune animation`, AAC 96 kb/s stereo, `+faststart`) and `<id>-poster.webp` (the object scene at its fullest, with the top bar naming the family). On win32 it drives the installed Chrome (then Edge) through Playwright; `--chrome=`, `--ffmpeg=`, `--python=` override the tools, `--no-audio` skips the bed, `--crf=` and `--fps=` tune the encode. It needs Playwright, ffmpeg on `PATH` and Python 3 with numpy.

**Always look at a sheet or frames before a render.** Collisions are obvious in a picture and invisible in JSON.

## The reel, scene by scene

Fixed order, fixed style; the spec only fills the slots. Total 15-20 s (the checker enforces it).

| Scene | Default (range) | What is on screen |
|---|---|---|
| `title` | 2.6 s (2-3) | discipline chip in the discipline's colour, the kind chip ("Claimed proof", "Claimed improved bound", ...), the family number as a watermark, the title, a one-line `Claim: ...` subtitle |
| `object` | 8 s (6-9) | the mathematical object, drawn and animated by 1-3 primitive panels; up to 3 caption `beats` |
| `achievement` | 4.4 s (3-5) | `bound`: best known → claimed, side by side, with an arrow; or `status`: the statement, what was known, and a **CLAIMED** stamp |
| `verify` | 2.6 s (2-3) | the Lean badge — `main`: "Lean-checked: main theorem" (green tick), `part`: "Lean: part only" (amber half), `none`: "Manuscript only" (grey page) — what exactly is formalized, the standing "Claim, not yet peer-reviewed" pill, and what we checked |
| `end` | 1.6 s (1.2-2) | `ai.thesatyajit.com` + `/articles/openai-math`, fading to black so the loop closes |

From the object scene on, a top bar names the family (`107 · short title` left, discipline right) and a hairline in the accent colour fills along the bottom as the reel plays. Scenes fade in over 0.55 s and out over 0.35 s.

**Style (do not vary per reel).** Background `#0b0d12` with a faint dot grid, a slow accent glow and a vignette. Text `#ECE9E2`, secondary `#C3C8D0`, muted `#8E95A1`. One accent per discipline (`DISCIPLINES` in `engine/reel.js`, similar lightness, never two on one reel). Verification colours are semantic and shared: green Lean, amber partial and the peer-review pill, grey manuscript-only; crossings and similar "events" are `hot` yellow. Hanken Grotesk for text, IBM Plex Mono for numbers and counters, KaTeX for every formula. Captions and statements are 23-28 px and nothing that carries meaning is under 18 px (only chrome and legends go down to 14-17 px): it has to survive a phone.

**Sound.** No narration. `audio.py` lays a quiet two-chord pad (D major 9 → B minor 9) with a low drone and a breath of air, and soft synthesized chimes on the engine's events: `cut` (scene change), `tick` (a number-line marker lands), `land` (the result lands), `stamp`, `badge`. Seeded by the family id; peak ≤ −4.4 dBFS. The captions are the on-screen text itself; there is no `.vtt`.

## Spec format

```jsonc
{
  "$schema": "../../brand-crew/skills/math-reels/schema.json",
  "id": "107",                                   // 3 digits = file name = family
  "discipline": "Theoretical computer science",  // exactly the catalogue's string
  "kind": "improved-bound",                      // proof | disproof | counterexample | improved-bound | partial | conditional
  "short": "Matrix multiplication, $\\omega \\le 9/4$",          // top bar, ≤ 44 chars
  "title": { "title": "...", "subtitle": "Claim: ..." },          // ≤ 64 / ≤ 110 chars
  "object": { "dur": 8.6, "layout": "sequence", "panels": [ {...}, {...} ], "beats": [ { "at": 0.2, "text": "..." } ] },
  "achievement": { "form": "bound", "before": { "label", "tex", "note" }, "after": { "label", "tex", "note" }, "note": "..." },
  "verify": { "lean": "main", "detail": "...", "ourCheck": "..." },
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
| `equation` | KaTeX display lines that stack or replace one another | `lines[{tex,note,tone,at,size}], mode: stack | replace` |
| `tree` | a dependency tree built bottom-up: what the main theorem rests on, styled by status | `nodes[{id,label,parent,status: lean | paper | prior}]` (one node without `parent` is the root) |

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

**3. Write the text tight.** Limits are hard (the engine refuses longer): `short` 44, `title` 64, `subtitle` 110, `heading` 72, beat `text` 96, `note` 80, `detail` 100, `context` 110, `label` 72, `ourCheck` 80 visible characters (TeX counts as one). Beats: at most three, at least ~2.5 s apart, the first at ~0.2 s; each one sentence, present tense, no hype words ("revolutionary", "stunning"). Marker labels 1-3 words, notes ≤ 25 characters. Dates as "2 Oct 2026" or "Aug 2026". A `subtitle` that states the result starts with "Claim:".

**4. Choose the numbers.** Use as few digits as tell the story, but never round a claimed value into something the paper does not say: write the paper's own form (`9/4 = 2.25`, `1 - 10^{-13}`) and quote it. Old bounds: the immediately previous record (the "before"), plus at most two historical anchors on a number line. When the improvement is tiny (`0.000122`), show it as tiny — a zoom, or a note — rather than drawing it as a leap.

**5. Time it.** Defaults sum to 19.2 s; the object scene is the only one worth stretching. In the object scene the eye needs ~0.6 s to find a new element; give a slide 1.4-1.6 s, a zoom 2 s, a graph's edges ~2.5-5 s, and leave ≥ 1.5 s of hold on the finished picture before the cut.

**6. Check, look, iterate.** `check.mjs` (with `--reviews`), `render.mjs plan`, then a `sheet` and 4 `frame`s at: the title (~1.8 s), mid-object, end of object, achievement after the stamp/arrow. Fix collisions by moving labels (`side: below`), shortening text or changing `y`, not by shrinking type.

## Not in scope

The narrated explainer films and thumbnails are `explainer-films` — never modify that folder (its files are hashed into every film's freshness check); this skill copies its patterns, not its code. Embedding reels on the site is a separate step: the outputs land in `public/films/math/` and go through `mediaUrl()` like every other film.
