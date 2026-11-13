---
name: explainer-films
description: >-
  Write and render an explainer film for an article. New films use Story v2
  ("format": "story2"): a film whose shape and length fit the article, built
  around recordings of the article's own widgets, clips and figures played
  full-frame, with a host that moves or leaves the frame. Films made before
  it are the story format (3-5 minutes, told in chapters) or, older still, a 90-125 second
  animated, narrated explanation of how the thing the article is about works — its
  architecture, its technique, what is new about it — presented by a mascot
  (cat, dog, fox, bunny, capybara or fish) who is different in every film, in
  one of eighteen drawn styles (watercolour, crayon, pastel, ballpoint,
  pencil, marker, charcoal, sumi, engraving, stipple, calligraphy, spray,
  chalkboard, blueprint, neon, notebook, riso, pixel). Every article also gets a
  thumbnail painted from the same storyboard, used as the cover of an article
  with no film and as the card in its OG image. Use when an article needs its film or thumbnail, when an
  article's facts change, or when asked for a video explanation of a piece. The
  storyboard is data/films/<slug>.json; every number and quote in it must appear
  in the article, and pnpm validate fails if one does not. Architecture explainers
  (content/architectures/<slug>.mdx) get films the same way, in their own
  namespace: data/films/architectures/<slug>.json, keyed architectures/<slug>.
---

# Explainer films

A film **explains**. Someone who watches it should come away knowing how the
model, system or technique works and what is new about it: the moving parts,
how data flows through them, the one idea that makes it different. The
article's evaluation — what holds, what doesn't — gets at most one scene. A film
that lists numbers or criticises without explaining the mechanism is the wrong
film, and the checker refuses one with no mechanism scene.

You write a **storyboard** (JSON); the engine owns the look, the host's
drawing and motion, the voice and the music.

```
data/films/<slug>.json            the storyboard (you write this)
public/thumbs/<slug>.jpg          thumbnail, every article (build.mjs --thumbs)
public/films/<slug>.mp4 .vtt      the film and captions, for a chosen set (build.mjs <slug>)
public/films/<slug>-poster.webp   the title card
data/.generated/films.json        manifests with a hash that goes stale when the
data/.generated/thumbs.json       storyboard, the article date or the engine changes
```

## Story format (long films)

**Superseded for new films by Story v2 (the section after this one), which
has every scene described here.** What follows is still the reference for
those scenes, for bespoke modules, and for the ~45 films rendered in this
format. Add `"format": "story"` to the
storyboard and you get a film of three to five minutes, told as a story in
chapters, with six scene types the short format does not have. Everything else
on this page (the host, the styles, the truth rules, figures, diagrams)
applies to it unchanged. The short format stays for the films already made and
for a thumbnail-only storyboard; do not convert an existing storyboard unless
you mean to re-render its film and thumbnail.

```
"format": "story"        opt-in, per storyboard
scenes                   10-24 (chapter cards count)
narration                400-750 words (the checker enforces both ends); each beat ≤ 40 words
renders through          story/render.mjs → story/studio.html → story/explainer.js + story/scenes.js + story/bespoke.js
bespoke scenes           custom/<key>/<module>.js, one per film (see "Bespoke scenes")
```

**Why it is separate.** Every legacy film and thumbnail is hashed against the
engine (`hash.mjs`), so editing `engine/explainer.js`, `render.mjs`,
`studio.html`, `audio.py`, or adding any file to `engine/` or `fonts/`, stales
all of them. The story engine lives in `story/`: a fork of `explainer.js`
(`story/explainer.js`), its new scenes (`story/scenes.js`), its page and its
renderer, on top of the same painter, styles, host, fonts and sound. A story
storyboard's hash is the legacy engine's for its style plus every file in
`story/` (`storyEngineSha`); a legacy storyboard never reaches that code, so its
hash is what it always was. Change the story engine freely: it stales only
story films. Treat `engine/explainer.js` as frozen; improvements go in
`story/`.

### The arc

A story film is not a longer slideshow. It answers a question:

1. **Hook** (optional, scene 0): the cold open. A concrete question or
   situation, before the title. It plays over silence; the score starts on
   the title's punches.
2. **Title**, then **chapters**. Two to six `chapter` cards ("The hidden
   bill", "Buckets instead of keys", "Does it hold up?"), the first right after
   the title. The folio names the current chapter and the progress bar is cut
   into chapters.
3. **The problem, and why the usual way fails**: a `diagram` of the usual
   way, a `chart` of where the cost goes, the paper's figure that shows it.
4. **The idea** (`idea`).
5. **The mechanism, in depth**, over several scenes: a `trace` that walks one
   concrete thing through it with the article's real numbers, an `inset` that
   opens one part, a `code` scene with the article's own lines, an `equation`.
   The checker wants at least three mechanism scenes of at least two kinds.
6. **Evidence**: the paper's own figures (up to four `figure` scenes) and
   at most four number scenes (`stat`, `bars`, `tally`, `chart`).
7. **Limits**: what the article found does not hold (`steps` or `compare`
   titled for it, or a `quote` with its stamp). One scene, in the article's
   words, not a jab.
8. **Takeaway** (exactly one) and **end**.

### Story-only scenes

| type | fields | notes |
|---|---|---|
| `chapter` | `title` (≤ 6 w), `sub?` (≤ 14), `say?` | A chapter card: "Chapter Two" (in words: the engine draws no digit), dots for where we are, the name set large. Keep `say` short ("Chapter two. Buckets instead of keys."). Not two in a row, not right before the takeaway or end. |
| `hook` | `text` (≤ 24 w), `mark?`, `sub?` (≤ 14), `say?` | The cold open. Only as scene 0, with the title next. A question, typed on as it is said, over a big painted question mark. |
| `chart` | `title`, `x` / `y` `{label ≤ 5 w, ticks?: number[], tickLabels?: string[], log?, zero?}`, `series[]` (1-4, `{label ≤ 5 w, points: [[x, y]] 2-24, hl?, dashed?}`), `kind?` (`line` / `scatter`), `illustrative?`, `stamp?`, `steps[]` (1-5, `{show?: [series index], mark?: {series, point, label ≤ 6 w}, note?, term?, say}`) | A plot that draws itself: axes draw on, each series traces left to right on the step that `show`s it (none listed: all at step 0), a `mark` rings one point with a callout. Series are labelled at their ends, no legend. Ticks and their labels are exactly yours; the engine computes none. A log axis suits context lengths (`ticks: [128, 512, 1000, 10000]`, `tickLabels: ["128k", "512k", "1M", "10M"]`). |
| `trace` | `title`, `stages[]` (2-6, `{label ≤ 4 w, sub? ≤ 5 w}`), `steps[]` (2-8, `{at: stage index, value ≤ 32 chars / 6 w, note?, term?, say}`) | The worked example. One concrete thing walks the stages; at each the big card under the current stage says what it has become ("512 keys" → "128 pool keys" → "64 buckets"). Values already passed stay under their stages, so the whole computation is on screen at the end. Steps may stay on a stage or skip one. |
| `code` | `title?`, `credit?` (≤ 10 w, e.g. the file path), `code[]` (2-14 lines, ≤ 64 chars), `steps[]` (1-5, `{lines: [from, to] 1-based, note?, term?, say}`) | The article's own code on a card, a range highlighted per step, the rest dimmed. Light syntax colour (keywords, strings, comments). No line numbers. **Every line must appear verbatim in the article** (a code fence or inline code), as a quote must. |
| `inset` | `title`, `nodes` (2-8), `edges?`, `groups?`, `open` (a node id), `inner {title? ≤ 6 w, nodes (2-8), edges?}`, `steps[]` (2-9, `{inner?: bool, show?, flow?, highlight?, note?, term?, say}`) | A diagram, then one node opened: the camera dives in, the node's box grows into a frame, and the inner diagram builds inside it. Steps with `inner: true` name inner ids; the first step is outside; a later step without `inner` comes back out. Both diagrams use the diagram rules below (positions, overlap, arrows); keep the inner title to one line. |
| `custom` | `module`, `mechanism?`, `title?`, `params?`, `steps[]` (1-8, `{say, note?, term?, …}`) | A bespoke scene: drawn by this film's own module. Every story film needs at least one with `mechanism: true`. See "Bespoke scenes" below. |

### Bespoke scenes

The built-in scene types make every film look like the others. A **bespoke
scene** is drawn by code written for this film alone, from the article's own
widget, figure or idea: k-means centroids moving each iteration, an attention
mask filling, a tape machine stepping, a denoising trajectory, a chart
morphing. **Every story film from now on has at least one bespoke mechanism
scene** (the checker fails one without it; `nex-n2-6` and `raon-1-nano`,
written before, are exempt).

**In the storyboard:**

```json
{ "type": "custom", "module": "buckets", "mechanism": true,
  "title": "Buckets by meaning, one block at a time",
  "params": { "query": 150,
              "legend": ["512 keys in a block, 64 dims each", "128 pool keys", "..."] },
  "steps": [ { "say": "Picture the index space in two dimensions...", "term": "..." },
             { "say": "Every four neighbouring keys are summed..." } ] }
```

| field | |
|---|---|
| `module` | the file `brand-crew/skills/explainer-films/custom/<key>/<module>.js` (key: the film's key, e.g. `latent-sparse-attention` or `architectures/transformer`) |
| `mechanism` | `true` counts it as a mechanism scene (and toward the bespoke rule). Each module is its own kind for the "two kinds" rule |
| `title` | optional heading (≤ 8 words), drawn by the engine |
| `params` | anything the module needs. **Every string in it is screen text** (≤ 14 words each; digits checked against the article). Numbers are geometry. `"data": "article"` declares the numbers are the article's (see Truth) |
| `steps[]` | 1-8 beats: `say` (required, ≤ 40 words), `note?`, `term?`, plus any fields the module reads (strings in them are screen text too) |

**The module** is a plain script (not an ES module) that calls
`BESPOKE.define({ plan?, draw, stampAt?, host? })` once. Wrap its private state
in a function, as the examples do; it runs in the page beside every other
module.

```js
BESPOKE.define((() => {
  // fixed data, computed once with its own seeded PRNG (never Math.random)
  return {
    // optional: per-step minimum seconds, sounds, and where motion needs every frame
    plan: (params, steps) => ({
      min: [3.2, 3.2, 4.6],                                  // seconds; the voice may make a step longer
      events: [{ step: 0, at: .2, type: 'ticks', n: 16, span: 1.2 }, { step: 2, at: .3, type: 'ding' }],
      motion: [{ step: 2, from: 0, to: 3.2 }],               // painted on ones, unsmeared; or motion: 'all'
    }),
    stampAt: k => [1230, k.top + 30],                         // where the Illustrative stamp goes (optional)
    draw(k) {                                                 // every frame; a pure function of k
      const grow = k.ease(k.p(1, 1.2, .2))                   // step 1's progress over 1.2 s, after 0.2 s
      k.seed('ring'); k.line(k.circle(600, 590, 255, 72), .8, k.dim)
      k.text(k.params.legend[k.step], 1010, 420, { role: 'head', size: 40, maxW: 360, lines: 2 })
      k.point = [1000, 420]; k.mood = 'thinking'
    },
  }
})())
```

The kit `k`, handed to `draw` each frame:

| | |
|---|---|
| time | `k.step` (current beat), `k.s` (its step object), `k.steps`, `k.lt` (scene time), `k.t`, `k.dur`; `k.at(i)` when step i starts, `k.since(i)`, `k.p(i, d, delay)` 0→1 over `d` s after step i starts (+delay), `k.span(a, b)` 0→1 over scene time; all are 1 in a thumbnail |
| easing | `k.ease`, `k.easeOut`, `k.expoOut`, `k.backOut`, `k.lerp`, `k.clamp`, `k.seg` |
| state | `k.thumb` (a still: draw the finished state), `k.mini` (the recap replay), `k.params`, `k.top` (y under the heading), `k.W`/`k.H` (1920x1080) |
| colour | `k.P` (palette: `a`, `b`, `hi`, `light`, `bg`, …), `k.ink`, `k.dim`, `k.paper`, `k.dark`, `k.pixel`, `k.tone('a'|'b'|'hi'|'light')`, `k.textOn(col)`, `k.mix(a, b, t)` |
| paint (the style's own brush) | `k.shape(pts, {fill, op, sw, ink})`, `k.line(pts, sw, col, {closed})`, `k.flat(pts, col, a)` (opaque, no brush), `k.hl(x, y, w, h, col, t)` (the style's highlighter), `k.arrow(pts, col, sw, t)`, `k.glow(x, y, r, col, a)` (dark styles only), `k.seed(key)` (call before each shape: its boil and brush texture are keyed to it) |
| geometry | `k.circle(x, y, r)`, `k.ellipse`, `k.rect(x, y, w, h)`, `k.rrect(x, y, w, h, r)`, `k.through(pts)` (a smooth curve), `k.partial(pts, t)` (a path drawn to t), `k.along(pts, d)`, `k.lenOf(pts)` |
| transform | `k.push()`, `k.pop()`, `k.translate`, `k.rotate`, `k.scale`, `k.alpha(a)` (inside push/pop), `k.focus(t, px)` (arrive out of focus, sharpen as t→1) |
| type | `k.text(str, x, y, {role: head|body|mono|label, size, min, maxW, lines, lh, col, align, alpha})` returns `{w, h, px}`; `k.measure(str, same)` sizes it without drawing |
| host | set `k.point = [x, y]` (what it points at), `k.mood` (neutral, happy, surprised, thinking, proud, excited), `k.hop = false` to keep it still |
| random | `k.rng(seed)` → a seeded `() => [0, 1)`, the same every frame and every render |
| more | `k.STORY`: the engine's internals (`layoutDiagram`, `drawNode`, `drawEdge`, …) for a module that wants the diagram look |

The engine draws the scene's `title`, the folio, each step's `note` and
`term`, the host, and the Illustrative stamp; the module draws the rest.
Room: content keeps to x 110-1380 (the host stands right of that) and from
`k.top` to about y 930 (the caption and lower-third live below). Size text
with `k.measure` and stack by the heights it returns: pixel's type is twice
as wide as sumi's, and the checker cannot measure a module's layout, so look
at it in **pixel and one other style** before rendering.

**Truth, enforced while it draws.** A module never makes a number that reaches
the screen. Every string drawn (through `k.text` or anything else that writes
text) is audited: if it holds a digit, it must be a piece of one of the
scene's own strings (title, `params`, a step's `note`, `term` or other
fields), cut at word edges and never through a number, or the render stops
with an error. So "45,056" shows only if the storyboard wrote "45,056", and
values switch rather than count: a counter ticking from "8,192" to
"45,056" would show numbers the article never printed, and cannot be drawn.
The checker holds the scene's strings to the article. The audit compares
without case, since some styles set type in capitals.

**Simulations are labelled.** A scene whose `params` do not say
`"data": "article"` is a simulation (toy clusters, random scores, a synthetic
trajectory) and is stamped **Illustrative** by the engine. With
`"data": "article"`, every number anywhere in `params` must be one the
article prints (the checker enforces it), and there is no stamp. Plot the
article's own measurements that way; keep a toy a toy.

**Determinism.** No `Math.random` (it throws while a module draws; use
`k.rng`), no clock, no network, no `import()`: the checker refuses a module
that mentions them, and a frame must be a pure function of time. Modules are
at most 60 KB.

**Hashing.** A film's hash covers its own modules and nothing else's: editing
`custom/<key>/x.js` stales that film alone, and a story film with no bespoke
scenes hashes as before. The runtime is `story/bespoke.js`, part of the story
engine, so it is frozen like the rest of `story/`.

**Worked example:** `custom/latent-sparse-attention/buckets.js` animates the
article's BucketLab widget: 64 toy keys on a circle (the index space in two
dimensions), pooled 4 to 1, merged by the code's Ward rule in real
mutual-cheapest rounds (cost a_b + a_b' - a_(b+b'), cap 16) down to 8 buckets,
a centroid per bucket, then a query that scores the centroids and lights the
best 3; beside it, a legend of what each stage is in the real block, in the
article's numbers. `beam.js` animates its TreeBeam: four rows of nodes, the
beam keeping the best and fanning to four children per kept node, then the
bill as two bars, 45,056 against 1,310,720. Both are stamped Illustrative.

**Designing one.** Start from what the article already animates or draws (a
widget in `components/articles/<slug>/`, a key figure, the worked example in
its prose) and ask what moving picture would make the mechanism obvious in
ten seconds: the state of the thing at each step, changing as the narrator
names it. One idea per scene, three to six steps, the narration naming what
moves. Write the module, then
`node brand-crew/skills/explainer-films/story/render.mjs sheet <sb.json> --at=<times in the scene> --cols=2 --w=960 --out=x.jpg`
in this style and in pixel, and fix what collides.

### Lower-thirds: `term`

In a story film any beat may carry `term`: `"Word: what it means"` (≤ 10
words, the word part ≤ 3). It slides in at the bottom-left a beat after its
line starts and leaves before the next: the viewer has the new word on screen
while the picture explains it. Use it the first time a term of art appears
(Indexer, Centroid, Prefill), not on every step. It shares the bottom of the
frame with `note`, so a step has one or the other. Where it goes: `steps[]`
of diagram, stack, grid, figure, chart, trace, code, inset; `items[]` of
steps; `parts[]` of equation; or the scene itself for idea and stat.

### Limits that change in the story format

Diagrams take up to 10 nodes, 14 edges and 8 steps; stacks, steps and grids
up to 6 steps or items; equations 5 parts; figures 5 steps; a beat's `say`
40 words. Quotes: two; figures: four; number scenes: four.

### Truth, for the new scenes

The checker holds them to the article like any other scene:

- A chart's every point (`y`, and `x` unless it sits on an x tick) must be a
  number the article has (2.3 matches the article's "2.30"). A chart whose
  shape is the point and whose numbers are not the article's sets
  `"illustrative": true` and is stamped Illustrative; its points are then not
  checked, its labels and ticks still are. A tick drawn without a label must be
  in the article; a tick label's digits must be.
- A trace's values, a chart's labels and tick labels, a term, a chapter title:
  their digits must be in the article, like every visible field.
- Code lines are verbatim. Number words in `say` are not checked, so do not
  invent one.

### Writing one

- Write the **beats first**, as a script, chapter by chapter; then choose the
  picture for each. 550-700 words reads well; at Kokoro's pace that is 3.5 to
  4.5 minutes.
- Explain one mechanism properly rather than three in passing: the build-up
  (diagram), the worked example with real numbers (trace), the zoom into the
  hard part (inset or equation), then the evidence.
- Every chapter needs at least one picture that moves (a diagram building, a
  trace, a chart drawing). Two text cards in a row (idea, takeaway, quote) is
  a sign of a slideshow.
- Check and look, exactly as for a short film:
  `pnpm validate:films --storyboards --only=<key>` (or `--file=<draft.json>`
  for a draft outside `data/films`), then
  `node brand-crew/skills/explainer-films/story/render.mjs sheet <storyboard.json> --every=3 --cols=8 --w=320 --out=/tmp/<slug>.jpg`
  and `--at=48,78,99 --cols=2 --w=960` to read individual frames.
- Render through `build.mjs` as for any film (it routes by `format`):
  `node brand-crew/skills/explainer-films/build.mjs --thumbs <key>` and
  `node brand-crew/skills/explainer-films/build.mjs <key>`. Preview first with
  `--preview --out=<scratch dir>`.

**Pilot:** `data/films/latent-sparse-attention.json` (sumi): a hook, three
chapters, a diagram, two charts, two bespoke scenes (`buckets`, `beam`), a
trace, two of the paper's figures, the limits as steps; 17 scenes, 4 min 57 s.
Rendered at 1280x720, x264 CRF 36 `-tune animation` (`STORY_FLAGS` in
`build.mjs`; the legacy path stays at 34): 7.5 MB, small mono type (tick
labels, trace sub-labels) still crisp. Painted in about 225 s on an M1 Max
with 3 pages, about 260 s end to end with the voice cached. Keep the default
3 pages on a Mac: a render with 4 once lost its WebGL context in p5.brush
(`clearTarget` of null) and had to be rerun.

### Rendering on a Mac

`story/render.mjs` paints WebGL on the machine's own GPU through ANGLE's
Metal backend on macOS (checked, not assumed); on Linux it uses the same
Xvfb/llvmpipe path as `render.mjs`. The legacy `render.mjs` has no Mac path
(it throws "no GPU: Mesa llvmpipe" there), which is one more reason new films
use the story format. The renderer needs Playwright (with its Chromium) and
`build.mjs` needs Kokoro; neither is a dependency of the site, so point at them:

```
NODE_PATH=<dir with node_modules/playwright>       # or PLAYWRIGHT_PATH=<path to playwright's index.js>
EXPLAINER_PYTHON=<venv python with kokoro, soundfile, numpy, scipy>
EXPLAINER_CACHE=<scratch dir for voiced lines>      # default ~/.cache/explainer-films
```

On Satyajit's Mac both are installed in `~/.cache/explainer-films` (outside any
session's scratch, so they persist):

```
export NODE_PATH=~/.cache/explainer-films/node_modules
export EXPLAINER_PYTHON=~/.cache/explainer-films/kvenv/bin/python
```

To rebuild them: `npm i playwright@1.65.0` there (it matches the cached
chromium-1254), a venv with `pip install kokoro soundfile numpy scipy`, and
`brew install espeak-ng`. The same Python runs the pronunciation check:
`$EXPLAINER_PYTHON brand-crew/skills/explainer-films/audio.py words`.

Kokoro's English front end (misaki) falls back to espeak-ng; the
`espeakng-loader` wheel on macOS has a broken built-in data path, so link its
`libespeak-ng.dylib` and `espeak-ng-data` to Homebrew's `espeak-ng`.

## Story v2 (new films use this)

**From 13 November 2026 a new film is `"format": "story2"`.** The story format
made about 45 films that feel like one film: the same skeleton at the same
four to five minutes, the host always at the right edge pointing left at a
box, a chapter card every few scenes, the real thing shown once and small on
a card, one kind of motion. Story v2 has every scene the story format has and
adds what was missing: the article's own footage full-frame, a host that
moves or leaves, a shape and length chosen per film, and two more ways for a
picture to move. Films already made stay as they are; do not convert one
unless you mean to re-render it.

```
"format": "story2"       opt-in, per storyboard
scenes                   5-24
narration                120-750 words; each beat ≤ 40 words
chapter cards            optional (none, or up to six); with none, the progress bar is one line
mechanism                at least one mechanism scene of any kind (pan and sort count; so does a bespoke scene with mechanism: true)
renders through          story2/render.mjs → story2/studio.html → story2/explainer.js + scenes.js + bespoke.js + stage.js
voice                    build.mjs voices it with --allow-guess: a name the voice does not know is guessed, not refused
```

**Why it is separate, again.** Every story film hashes all of `story/`, so
that directory is frozen like `engine/`. `story2/` is a fork of it, hashed
only into story2 films (`hash.mjs`: `isStory2`, `story2EngineSha`). Change
`story2/` freely: it stales story2 films and nothing else. `isStory` is still
exactly `"format": "story"`, so no legacy or story hash moved when this was
added. Do not add `pronounce.json` entries for a story2 film: an entry stales
every storyboard that contains the word, and the voice's guess is allowed here.

### The variety rules

These are the point of the format. Before writing a storyboard, look at the
two or three films rendered most recently and make this one differ from them
in all three.

1. **Shape and length fit the article.** A 90-second cut for one idea
   (5-8 scenes, 150-220 words), a two to three minute mechanism or data film
   (9-14 scenes, 280-450 words), a longer deep dive only when the article has
   that much mechanism. No fixed arc: a film may open cold on footage, have no
   idea card, no chapter cards, no limits scene.
2. **Real footage first.** If the article has a widget, a viewer, a demo clip
   or a figure, the film is built around recordings of it (`footage`,
   `split`), and the drawn scenes are what connects them. A drawn diagram of
   something the article can show running is the wrong picture.
3. **Staging changes.** No more than two scenes in a row with the host in the
   same place. Use `"host": "left"`, `"corner"` and `"off"`; footage is
   `off` by default.
4. **Pacing changes.** Short lines over footage, a `hold` after a reveal, a
   quote in the second voice, a run of fast cuts and then one long scene.
   Not every scene needs a `term`, a `note` or a stamp.
5. **More than one kind of motion.** A film that only fades parts in is a
   slideshow. Use a `pan` for a process, a `sort` for a count that regroups,
   a clip that plays, a still the camera moves across, a bespoke scene.

### Staging and pacing, on any scene

| field | |
|---|---|
| `host` | `"right"` (default), `"left"` (the host mirrored at the left edge, the scene's content moved right), `"corner"` (a small host bottom right, content centred), `"off"` (no host, content centred). `footage` and `split` default to `off` and take only `off` or `corner`; `pan` defaults to `corner` |
| `hold` | seconds (≤ 6) the scene stays after its last line, with no narration: a breath after a reveal |
| `voice` | `"b"` gives the line to the second voice (`VOICE2` in `build.mjs`, Kokoro `am_michael`): a quote, a critic's verdict, an aside. On `title`, `idea`, `stat`, `bars`, `tally`, `quote`, `takeaway`, `chapter`, `hook`, `compare`, `steps`, `equation` it is the whole scene; on `footage`, `split`, `pan`, `sort` and `custom` it goes on a step. Sparingly: one or two lines a film |

A film may open cold on a `footage` or `split` scene instead of a `hook`: the
title is then scene 1.

### Story v2 scenes

| type | fields | notes |
|---|---|---|
| `footage` | `src`, `credit` (≤ 10 w), `title?` (≤ 6 w, a chip on the picture, or the heading of a framed one), `tone?`, `layout?` (`full` / `frame`), `shape?` `[w, h]`, `steps[]` (1-8, `{say?, hold?, clip? [from, to], at?, focus? [x, y, w, h], from? [x, y, w, h], drift?, caption? ≤ 14 w, term?, voice?}`) | The article's own clip or picture, big. `full` (default) fills the frame, cropped to 16:9; `frame` shows it large inside a frame drawn in the film's medium, nothing cropped unless a step asks. See "Footage" below. Up to twelve `footage` and `split` scenes a film. |
| `split` | `panes[]` (2-4, `{src, label ≤ 4 w, clip?, at?, focus?, tone?}`), `credit`, `title?`, `steps[]` (1-8, `{say?, hold?, seek?, solo?, caption?, term?, voice?}`) | The same thing two, three or four ways, side by side on one clock. Every clip plays from its `clip` start as the scene runs; a step with `seek` cuts all panes to that second (counted from each pane's `clip` start); a step with `solo: i` widens pane i and dims the rest while the line is about it. Record the panes with the same actions at the same times and they stay in step. |
| `pan` | `title?`, `stations[]` (2-7, `{label ≤ 4 w, value? ≤ 14 chars, sub? ≤ 10 w, tone?}`), `steps[]` (2-8, `{at: station index, say, note?, term?, voice?}`) | A wide canvas and a camera that travels it without stopping: stations stand along a path, each step sends the camera on to one with a marker running ahead, and between arrivals it keeps drifting. For a process, a pipeline, a worked example whose stages are few words each. A mechanism scene. |
| `sort` | `title`, `of` (2-240), `unit?` (≤ 4 w), `states[]` (1-5, `{bins[] (1-6, {label ≤ 5 w, n, rest?, tone?}), say, note?, term?, voice?}`) | A counted set, regrouped: `of` dots stand in bins, and between states every dot travels its own arc to the bin it belongs to next. Each state's bins must hold exactly `of`. A bin's `n` is drawn over it and must be the article's; mark the remainder `rest: true` and its count is not drawn (and not checked), since 40 minus 28 is your arithmetic, not the article's number. A mechanism scene. |

All four are in `story2/stage.js`. A footage or split step without `say` is a
**hold**, not a beat: the picture plays for `hold` seconds (or its clip's
length) and nobody speaks. A scene needs at least one spoken step.

### Footage

- **Only what the article shows.** `src` is a path the article's MDX itself
  embeds with `<Video>` or `<Figure>` (the checker reads the MDX), on disk or
  pushed. To use a recording of a widget, record it (below), embed it in the
  article with a caption, then use it.
- **Cut each line to its own span.** `clip: [from, to]` is seconds of the
  clip. The span is retimed between 0.6x and 1.7x so it ends as the line
  does, then holds its last frame; a step with no `clip` carries on from
  where the step before stopped; `at` freezes one moment. Write spans from
  the cue list the capture tool writes, and keep a span within about 1.5x of
  its line's length.
- **Stills move.** On a picture, each step eases slowly from the last
  `focus` (or `from`) to its own across the whole step, and a still with no
  regions gets a slow push. On a clip, a `focus` reframes in a second and the
  clip plays in it; `drift: true` asks a clip for the slow move.
- **Captions are lower-thirds.** `caption` is a plate over the bottom of the
  picture for the length of its step: what the viewer is looking at, in a few
  words. A step has a `caption`, a `term` or neither.
- **Numbers in the narration are the article's prose, not the widget's
  readout.** The checker reads the MDX, not `components/articles/**`. Drive a
  widget to the settings the article discusses and say only what the article
  prints.
- **No pixel style.** Its frame is 320 px wide; the checker refuses footage in it.
- **Look at the encoded film, not the sheet.** A film with footage is encoded
  without `-tune animation` at CRF 33 (`STORY2_FLAGS`; 31 cost a third more file for no visible gain on interface text). Pull frames from the
  mp4 (`ffmpeg -ss <t> -i film.mp4 -frames:v 1 x.png`) to judge interface text.

### Recording a widget: `capture.mjs`

```
NEXT_PUBLIC_MEDIA_BASE=http://localhost:3457 PORT=3457 pnpm dev      # the site, serving its media from public/
node brand-crew/skills/explainer-films/capture.mjs brand-crew/skills/explainer-films/shots/<slug>.json [--only=name] [--out=<scratch>]
```

A shot list (`shots/<slug>.json`) names the page, and for each clip the
element to film and the actions to perform: `click`, `hover`, `drag`,
`slide` (a range input), `select`, `key` (held), `wheel`, `wait`. The head of
`capture.mjs` has the whole format; `shots/` has three worked lists (a 3D
viewer walked through, a chart filtered, a playground played). It writes
`public/articles/<slug>/<name>.mp4`, `.webm` and `-poster.jpg`, and
`shots/cues/<slug>.<name>.json` with the second each action started at.

- Time is virtual: the page's clock is advanced 1/24 s per screenshot, so a
  WebGL viewer never drops a frame and an action lands on the frame its cue
  says. Wall time is about 2-3x the clip.
- `NEXT_PUBLIC_MEDIA_BASE` matters. Without it the page links its media from
  the CDN, which refuses a localhost referer, and you record broken images.
  The tool prints every failed request; read that list.
- Do not edit `content/` while a capture runs against `pnpm dev`: Fast
  Refresh reloads the page under the camera.
- A clip keeps the widget's own shape unless the shot gives `size`. A tall
  widget is filmed tall, and the film crops into it with `focus`.
  `"fit": "cover"` with `"size": [1280, 720]` films a 16:9 window of a canvas.
- Use new file names. R2 keys by path; never overwrite a published clip.
- Then embed each clip in the article with `<Video>` and a caption that says
  what is being done in it, run `pnpm media:push`, and commit the shot list
  and cues with the storyboard.

### Motion for bespoke modules

The kit a module draws with (`story2/bespoke.js`) has everything in the
table above, plus:

| | |
|---|---|
| `k.arc(p0, p1, lift, t)` | where a thing is, t of the way from p0 to p1 along an arc `lift` px high: elements that travel |
| `k.morph(a, b, t, n?)` | a path t of the way from path a to path b, both resampled to n points: one shape becoming another |
| `k.travel(pts, t, len?)` | the stretch of a path a traveller has just covered, head at t, tail `len` px behind |
| `k.cam(cx, cy, z?)` | inside `push()`/`pop()`: look at a point of a canvas wider than the frame. Move it a little every frame (with `motion: 'all'` in `plan`) and the scene is one continuous shot |
| `k.shift`, `k.stage` | how far the engine slid the content for this scene's `host`, and which staging it is |

A module is laid out for a host on the right (content in x 110-1380); the
engine slides it for `left`, `corner` and `off`.

### Checking and rendering

Exactly as for a story film, through `story2/render.mjs`:

```
pnpm validate:films --file=<draft.json>                     # or --storyboards --only=<key>
node brand-crew/skills/explainer-films/story2/render.mjs sheet <sb.json> --every=4 --cols=8 --w=320 --out=<sheet.jpg>
node brand-crew/skills/explainer-films/build.mjs <key> --preview --out=<scratch dir>
node brand-crew/skills/explainer-films/build.mjs <key> && node brand-crew/skills/explainer-films/build.mjs --thumbs <key>
```

A sheet made without the voice pass is timed to guesses, and footage spans
are cut to the voice: check sync on a `--preview`, at several timestamps,
before the final render. Set `"thumb": { "scene": i }` to the scene that
says most about the film: usually a drawn one (a bespoke scene, a sort, a
pan), so the thumbnail is in the film's medium, or a footage scene when the
footage is the film (its last step's framing is the still).
A film's hash covers the storyboard, the engine and its modules, not the
bytes of a clip: re-record a clip and the film that plays it has to be
re-rendered by hand.

**The first three:** `beach-house-three-models` (riso; opens cold on three
recorded walkthroughs side by side, mostly footage), `full-attention-census`
(engraving; a fast data film around the recorded census chart and KV
calculator) and `e-means` (chalkboard; a mechanism film around the authors'
clips, the bespoke race and the recorded playground).

## Namespaces: films for other kinds

Articles are keyed by their bare slug. Architecture explainers
(`content/architectures/<slug>.mdx`, one per `data/architectures.ts` entry that
has one) get films too, keyed `architectures/<slug>`. The key is the path
everywhere, so nothing else about a film changes:

```
data/films/architectures/<slug>.json              the storyboard; its "slug" field is "architectures/<slug>"
content/architectures/<slug>.mdx                  "the article": every digit, quote and label is checked against it
public/thumbs/architectures/<slug>.jpg            thumbnail, every doc that exists
public/films/architectures/<slug>.mp4 .vtt        the film, captions and -poster.webp, when rendered
"architectures/<slug>"                            its key in films.json and thumbs.json
```

Every rule on this page applies unchanged. Hosts are unique across both
namespaces, so check a name against `data/films/*.json` and
`data/films/architectures/*.json`. A `figure` may use a picture under
`/architectures/` if the doc shows it. Pass the key wherever a slug goes:
`pnpm validate:films --storyboards --only=architectures/<slug>`,
`build.mjs --thumbs architectures/<slug>`, `build.mjs architectures/<slug>`,
and `python3 audio.py words --films data/films/architectures` for the
pronunciation check. For the pipeline, a new namespace is its content
directory plus one entry in `hash.mjs`'s `NAMESPACES`, which sits outside the
engine hash, so adding one stales nothing.

## Workflow

1. **Read the whole article.** Find the mechanism: the architecture section,
   the "how it works", the diagrams, the widgets. Write down in one sentence
   what is new (that is your `idea` scene) and the three to six parts that
   make it work (that is your diagram).
2. **Plan 6-10 scenes** (below). Always: `title` → `idea` → one to three
   mechanism scenes → at most two number scenes → `takeaway` → `end`. Vary it:
   not every film needs `stat`, not every film needs `compare`; a training
   recipe is `steps`, an architecture is `diagram` or `stack`, an attention
   variant is `grid`, a loss is `equation`.
3. **Write `data/films/<slug>.json`.** Take the host's `species` and `name`
   and the suggested `style` from your brief; dress the host for the subject.
4. `pnpm validate:films --storyboards --only=<slug>` until it passes.
5. **Look at it.** `node brand-crew/skills/explainer-films/render.mjs sheet data/films/<slug>.json --every=4 --cols=6 --w=320 --out=/tmp/<slug>.jpg`
   (it needs a `date` field only for the notebook and blueprint title cards;
   the sheet works without one) and open the image. Fix labels that wrap
   badly, nodes that crowd, a flow that goes the wrong way.
6. Films: `node brand-crew/skills/explainer-films/build.mjs <slug>`. Thumbnails:
   `node brand-crew/skills/explainer-films/build.mjs --thumbs <slug>`.

## Scenes

Every scene may carry `say`: the narration for its beat (≤ 34 words). Scenes
with steps (`diagram`, `stack`, `grid`) *must* give each step a `say`, and the
picture is timed to it: nodes appear as they are named, packets flow while
the flow is described. **Write every line for the ear**: short sentences, no
parentheses, no code punctuation, numbers the way a person says them
("eighty-four", "one point eight five percent"). The whole film's narration is
≤ 280 words (about 105 s); aim for 180-260.

**Names have to be sayable.** The voice (Kokoro) spells out any word missing
from its dictionary, which is how "Qwen" came out "Q-wen". `audio.py`'s
`pronounce.json` table says how to read model and product names (Qwen, CUDA,
LiDAR, llama.cpp…), and `build.mjs` refuses to voice a film with a name or
acronym the voice would have to guess. Before you finish a storyboard, run
`python3 brand-crew/skills/explainer-films/audio.py words`: it lists every such
word with the guess. Add a line to `pronounce.json` for each (misaki phonemes; copy
the style of the entries there) rather than respelling the name in `say`,
because the captions show `say` as written.

| type | fields | notes |
|---|---|---|
| `title` | `headline` (≤ 10 w), `sub?` (≤ 14), `punch?` (0-3 chunks of ≤ 4 w), `say?` | Headline says what the film explains: "How a giant hash table feeds a language model", not a verdict. `say` usually starts "Hi, I'm <name>!" |
| `idea` | `text` (≤ 28 w), `mark?`, `label?` (≤ 5 w, default "The idea") | The one-sentence answer to *what is new here*. `mark` is a phrase inside `text` to highlight. |
| `diagram` | `title`, `nodes[]` (2-9), `edges[]`, `groups?[]`, `steps[]` (1-6) | The workhorse. See below. |
| `stack` | `title`, `layers[]` (2-7, bottom first, `{label}`), `input?`, `output?`, `repeat?` `{from,to,label:"x 48"}`, `side?` `{label,to}`, `steps[]` `{show?, highlight?[], side?, flow?, note?, say}` | A model as a layer stack; `side` is a component plugged into layer `to` (an adapter, a memory, a table). `flow` sends a token up the stack. |
| `steps` | `title`, `items[]` (2-5, `{text ≤ 7 w, sub? ≤ 5 w, say?}`), `say?` (intro) | A process or algorithm, station by station, the host pointing at each in turn. Training recipes, pipelines, inference loops. |
| `compare` | `title?`, `left` / `right` `{title ≤ 5 w, items[1-3] ≤ 10 w, say?}` | The usual way vs this one. The right side is the new idea. |
| `grid` | `title`, `rows`, `cols` (2-16), `rowLabel?`, `colLabel?`, `steps[]` `{pattern, label?, note?, say}` | A matrix whose cells light by pattern: `dense`, `none`, `causal`, `diagonal`, `sliding:W`, `block:B`, `sparse:0.25`, `topk:K`, `pages:P` (KV-cache pages), `rows:1,3`, `cols:0,2`, `quant` (magnitudes with outliers). Attention masks, sparsity, cache layouts, routing. |
| `equation` | `text` (≤ 48 chars, plain text, `x` not `×` unless the article uses it), `parts[]` (1-4, `{match, note ≤ 12 w, say?}`), `say?`, `title?` | A formula explained one term at a time; `match` is a substring of `text`. |
| `figure` | `src`, `credit` (≤ 10 w), `title?`, `clip?` `[from, to]` s, `steps[]` (1-4, `{focus? [x, y, w, h], note?, say}`) | A picture or clip **the article itself shows**, on a card; each step frames a region of it. See below. At most two. |
| `stat` | `value` (≤ 20 chars), `label` (≤ 14 w), `note?`, `stamp?` | One striking figure. |
| `bars` | `title`, `items[]` (2-5, `{label ≤ 5 w, value, hl?}`), `unit?` (≤ 4 chars), `note?`, `stamp?` | A comparison; `hl` marks the one that matters. |
| `tally` | `label`, `of` (≤ 300), `rows[]` (1-3, `{label, n}`) | n of N. |
| `quote` | `quote` (≤ 30 w, verbatim), `source?`, `mark?`, `stamp?` | Someone's claim the article checks. At most one. |
| `takeaway` | `text` (≤ 22 w), `mark?` | Exactly one: the thing to remember. Not a jab; the insight. |
| `end` | `recap[]` (2-3, ≤ 10 w each), `say?` | The engine adds the sign-off. Give `say` a short recap; the default reads every item. |

### Figures and clips

A `figure` scene puts the article's own evidence on screen: the paper's
architecture diagram, the tool's interface, a clip of the thing running. The
checker refuses anything the article does not itself show: `src` is the same
path as the article's `<Figure src>` or `<Video src>` (a video's may omit the
extension, as the article's does), pushed to R2 (`lib/media-map.json`) or on
disk under `public/`. A fresh clone has no media on disk: `pnpm media:pull
/articles/<slug>` fetches the article's figures before a render.

- **Pick what explains.** The method or architecture figure, the interface, a
  clip of output. A results chart only when it *is* the point, and then say so.
- **Steps frame regions.** `focus` is `[x, y, w, h]` in percent of the picture
  (omit it for the whole picture); the camera eases to it on the step's line.
  Look at the picture and measure: a region is right when its part fills the
  card. The card keeps the picture's shape, so a region of another shape is
  widened to it, and what the widening takes in is washed back toward the
  picture's own ground (a chart's white, a terminal's black): context, not a
  word cut at the edge. Still, start and end a region between words, not
  through one. Name in `say` what the viewer is looking at, in the article's
  words.
- **`credit` says whose it is**, as the article's caption does: "paper,
  Figure 2", "the project's README", "the project's own animation; its
  claims". Numbers inside a picture are its source's, not ours; if the article
  treats them as claims, the credit or the line says so.
- **Clips** play muted, once, from when the card lands, and then hold their
  last frame; `clip` picks the span in seconds (default the first 12 s). A
  loop would restart every counter in the clip and show its in-between
  values, so end the span on the frame the narration names.
- A figure scene is evidence, not a mechanism scene: a film still needs a
  diagram, stack, steps, grid, equation or compare.

`stamp`: `measured`, `reported`, `reasoned` (how the article labels a figure),
or `holds` / `does not hold` / `half true` on a quote. Match the article; if
unsure, leave it off.

### Diagrams

```json
{ "type": "diagram", "title": "One lookup, sixteen ways",
  "nodes": [
    { "id": "ng",   "label": "Last 2-3 tokens", "kind": "doc",   "at": [6, 20] },
    { "id": "h",    "label": "hash",            "kind": "op",    "at": [30, 20] },
    { "id": "mods", "label": "16 prime moduli", "sub": "each near 20 million", "kind": "stack", "at": [58, 20] },
    { "id": "rows", "label": "16 rows x 160",   "kind": "grid",  "at": [88, 20] },
    { "id": "vec",  "label": "2,560-wide vector","kind": "pill", "at": [88, 85] },
    { "id": "res",  "label": "Residual stream", "sub": "layer 2", "at": [40, 85] } ],
  "edges": [ { "from": "ng", "to": "h" }, { "from": "h", "to": "mods", "label": "3 multipliers" },
             { "from": "mods", "to": "rows" }, { "from": "rows", "to": "vec" }, { "from": "vec", "to": "res", "label": "gated in" } ],
  "steps": [
    { "show": ["ng", "h"], "say": "Take the last two or three token ids, and hash them." },
    { "show": ["mods"], "flow": ["ng>h", "h>mods"], "say": "Reduce the hash modulo sixteen different primes." },
    { "show": ["rows"], "focus": ["mods", "rows"], "say": "Each head picks one row of a hundred and sixty numbers." },
    { "show": ["vec", "res"], "flow": ["rows>vec", "vec>res"], "say": "Concatenate the rows and gate them into the residual stream." } ] }
```

- `at: [x, y]` is a percentage of the diagram area (x 0-100 left to right, y
  0-100 top to bottom; these are node centres, and the area is about 1,100 px
  wide). Think in a loose grid: columns at x ≈ 6, 36, 70, rows at y ≈ 10, 50,
  90 — three columns fit a row, four only with short labels. The host
  presents from the right; the checker keeps nodes clear of it and refuses
  overlaps. An L or U shape (across the top, down the side, back along the
  bottom) fits more than a straight line. The checker sizes each node the
  way the engine will, from the style's real glyph widths in `metrics.json`
  (so a node that passes in one style can fail in pixel, whose type is
  widest); after changing a style's fonts, `node render.mjs metrics` rewrites
  that table.
- `label` ≤ 5 words (≤ 3 reads best), `sub` ≤ 5 words.
- `kind`: `box` (default, a component), `pill` (a value or output), `stack`
  (many of something: experts, heads, replicas), `db` (a store, cache, table),
  `op` (an operation: `+`, `hash`, `top-k` — keep the label to one short word),
  `grid` (a tensor or matrix), `doc` (text, a prompt, a file), `chip` (hardware:
  GPU, CPU, NPU), `user`, `cloud` (a service or API). `tone`: `a` / `b` / `hi` /
  `light` overrides the colour.
- `edges` appear once both ends are shown. `label` ≤ 3 words; `dashed` for
  optional or feedback paths; `bend` (-1..1) curves one that would cross.
  An edge is drawn from just outside one box to just outside the other, so
  two connected nodes set too close (wide boxes a column apart, say) put
  those points past each other and the arrow points back at its source. The
  checker refuses it; give the pair more room along the edge, or drop a
  sub-label to narrow the boxes.
- `groups` draw a dashed frame with a label around nodes ("GPU 0", "Prefill").
- Steps build it: `show` names what appears, `flow` sends packets along edges
  in order (`"a>b"`), `highlight` rings nodes and dims the rest, `focus` zooms
  toward nodes, `note` is a one-line caption.
- Narrate the parts in the order data moves through them.

## Styles

Pick the suggested style unless the subject clearly wants another. Each has its
own ground, line, type, transition and score.

| style | look | suits | palettes |
|---|---|---|---|
| `watercolour` | real p5.brush washes that bleed and pool, charcoal ink | science, robotics, neuroscience, anything warm | `pink-blue` `orange-blue` `red-marine` `green-pink` `purple-sun` `teal-flame` |
| `chalkboard` | slate, chalk hatching, lo-fi piano | theory, training, papers, math | `green` `slate` `night` |
| `blueprint` | drafting grid, white construction lines, synth arps | systems, serving, kernels, hardware, infra | `cobalt` `navy` `teal` |
| `neon` | glowing tubes on a synthwave floor | agents, realtime, audio, security | `club` `ocean` `sunset` |
| `notebook` | ruled paper, ballpoint, highlighter, ukulele | tools, evals, datasets, tutorials | `yellow` `pink` `green` |
| `riso` | two-ink print, flat fills, misregistration, marimba | image, video, 3D, design, vision | `pink-blue` `orange-teal` `yellow-violet` `green-red` |
| `pixel` | 640x360, 16 colours, chiptune | games, voxels, retro, playful subjects | `pico` `night` `wine` |
| `crayon` | waxy massed crayon on cartridge paper, a music box | beginner-friendly explainers, education, anything playful | `primary` `garden` `berry` |
| `pastel` | soft chalk pastel covering toned paper, a harp | vision, generative art, calm long reads | `slate` `umber` `moss` |
| `ballpoint` | four-colour pen, cross-hatched, dot-grid sketchbook, pizzicato | how-tos, debugging stories, systems sketches | `bic` `sketch` |
| `pencil` | coloured pencil hatched over graphite, lo-fi | papers, careful derivations, surveys | `meadow` `dusk` `sea` |
| `marker` | felt-tip streaks and a fine liner on white, ukulele | product launches, APIs, tools | `pop` `tropic` |
| `charcoal` | massed charcoal on grey paper, one accent colour, jazz | security, safety, critiques, serious subjects | `ember` `cobalt` |
| `sumi` | ink washes and a round ink brush on rice paper, koto | elegant ideas, minimal architectures, sparse models | `ink` `indigo` |
| `engraving` | tone in ruled lines like a banknote, harpsichord | numerics, precision, maths, classic algorithms | `bank` `chart` |
| `stipple` | airbrushed dots, a fine pen, typewriter, marimba | data, datasets, measurement | `duotone` `ink` |
| `calligraphy` | a broad nib in iron-gall ink with watercolour tints, harpsichord | language, text, writing systems, tokenizers | `ink` `emerald` |
| `spray` | aerosol on concrete or brick, boom-bap | agents in the wild, open source, fast-moving releases | `concrete` `brick` |

Pixel has large, blocky text: keep its labels short.

**Twelve styles are painted by p5.brush** (`engine/vendor/`, MIT), the same
library the animation base uses, in `engine/brushbake.js`: watercolour and
the eleven drawing media above, each a description of its medium (fill by
wash, hatch or mass; which brush draws lines; whether its pigment covers what
is under it), and chalkboard, blueprint and notebook draw their lines and
fills with real pastel, rotring, pen and marker. Three brushes are ours,
built from p5.brush's parts: `sumi` (a round ink brush that swells and lifts),
`nib` (a broad nib at 45 degrees) and `stipple`. p5.brush needs
WebGL2; with no GPU, `render.mjs` runs it on Mesa llvmpipe through a private
Xvfb, falling back to SwiftShader, and even there a wash costs tens to
hundreds of milliseconds, far too slow to paint per frame. The vendored copy
carries one local patch, noted at its head: its blend pass read a texel past
the region it had copied, which on llvmpipe drew a thin grey line beside every
stroke on a dark ground. So each shape and line is painted once, alone, on white, and
kept, keyed by its geometry; a frame lays the kept paintings down with
`multiply`, which is what transparent pigment on paper does. Fades apply
opacity at lay-down and a highlight sweeping on is the finished painting
clipped, so neither costs a new painting. A shape whose geometry changes every
frame (a bar growing, a flow line drawing itself) is painted once per
distinct geometry. The host is traced from its own pixels every drawing and
inked along that silhouette in p5.brush charcoal, so its outline boils like a
hand-inked one, and its pigment mottling is a p5.brush wash. Without WebGL the
style falls back to its Canvas2D washes, which is why a watercolour contact
sheet or film is slower than the other styles: minutes, not seconds.
`flat` stays opaque Canvas2D in every style, since it has to cover what is
under it (title cards, the plate behind an edge label), and `multiply` can't.

## Motion

The engine owns how a film moves; a storyboard never asks for it. All of it
is off in the pixel style, whose hard edges are the point, and in thumbnails.

- **On twos, except where things move.** A drawing is held for two frames and
  the linework boils at 12 drawings a second, as hand animation does. Each
  scene's `plan` declares *motion windows* (a cut, parts arriving on a beat,
  packets running a flow step); inside one, every frame is painted.
- **Motion blur.** In a window that asks for it, a frame is the average of
  five to eight paints spread over a half-frame shutter (1/48 s): wipes sweep,
  pops smear, the camera's punch softens. Every sub-frame boils to the frame's
  own drawing, and the host keeps the frame's pose, so only motion smears: a
  fast hop averaged over the shutter read as five ghosts, not as speed.
- **Arrivals come into focus.** Nodes, layers, cards, stamps, headline words
  and a stat's figure arrive blurred and sharpen as they land (`focus(k)`);
  headings drop in word by word. Slides and rises use expo-out, decelerating
  hard and settling.
- **The camera steps on the beat.** Each beat punches in and settles into a
  slightly closer framing that holds until the next; the folio stays put. It
  does not drift between beats: a camera that never stops changes every pixel
  of every drawing, and measured a third more file for a push-in nobody sees.
- **Cuts land on the music.** Scene lengths are rounded up to the next beat of
  the style's score; `audio.py` is handed the grid's start (`beat0`) and the
  cut times, and puts a soft low hit on each cut.
- **The recap replays the film.** The end card shows up to three of the
  film's mechanism scenes rebuilding at twice speed above the recap lines,
  sized to the room the lines leave.

It costs 2-3x the paint time of the same film on twos and about a seventh
more file.

## The host

Every film has its own host — a **cat, dog, fox, bunny, capybara or fish** —
who presents from the right of the frame, big and cropped by the bottom edge
like a presenter in shot (there is no floor or stage). It points at what the
narration is about, talks when the narrator talks, bounces when a number
lands. The checker refuses a duplicate name or an identical look.

```json
"mascot": { "species": "capybara", "name": "Nutmeg", "fur": "brown", "ears": "up", "hat": "none",
            "glasses": "round", "outfit": "labcoat", "prop": "book", "patch": "none", "accent": "#3B7DD8" }
```

- `species` and `name`: from your brief (a registry balances species and keeps
  names unique). The name is one capitalised word.
- `fur`: white cream grey brown chocolate black caramel orange ginger gold lilac
  mint peach sky rose coral teal blue. Fit the species: foxes orange or ginger,
  capybaras brown or caramel, fish bright (gold, coral, teal, blue, orange).
- `ears`: up lop one-down tall short (cats: `lop` is a folded ear; dogs: `lop`
  is floppy, `up` is pointed; fish and capybaras ignore it)
- `hat`: none hardhat beret wizard cap headphones crown goggles party chef beanie flower tophat bandana yuzu
- `glasses`: none round square shades monocle
- `outfit`: none scarf bowtie labcoat hoodie cape vest overalls tie
- `prop`: pointer clipboard wrench magnifier book carrot pencil flag none
  (`pointer` is held out toward what is being explained — a good default; a
  fish points with its fin and holds nothing, so give it `none`)
- `patch`: none eye belly spots socks (spots on a cat are forehead stripes)
- `accent`: a hex colour for the outfit

Dress it for the subject: a hard hat and wrench for infrastructure, headphones
for audio, goggles for robotics, a beret for image models, a lab coat for
research, a wizard hat for agents, a chef's hat for data pipelines, a yuzu on a
capybara because it is a capybara. Vary the rest so the host is recognisably
this film's.

## Truth rules

The checker enforces the mechanical half.

- **Every number a viewer sees or hears is in the article** (digits in any
  visible field or `say`; number words in `say` are not checked, so do not
  invent one). A ratio you computed yourself does not go in.
- **Explain what the article explains.** Paraphrase freely, simplify, but do
  not add mechanism the article does not describe, and do not make it stronger.
  If the article says "probably" or labels something Reasoned, so do you.
- **Quotes are verbatim**: a contiguous run of the article's words.
- **Criticism is one scene at most**, and only if the article's point is
  critical. The `takeaway` states the insight, not a jab.
- **Standing content constraints carry over.** `fly-connectome-computing`:
  cover the neuroscience and the engineering; no ticker, price, market figure
  or purchase path, and no evaluation of the token. `runtime-abliteration`:
  the mechanism and published research only, never a recipe or a pipeline.
  `confidence-gated-fraud-detection`: the gating decision and its accuracy,
  nothing that reads as evasion advice. `zcode-disclosure`, `openmuse`: no
  exploit path. Anything about trading systems: architecture and decision
  boundary only, no strategy, returns or backtests.
