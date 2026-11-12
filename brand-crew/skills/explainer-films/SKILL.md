---
name: explainer-films
description: >-
  Write and render an explainer film for an article. New films use the story
  format: a 3-5 minute narrated explanation told in chapters (cold open,
  problem, idea, the mechanism in depth with worked examples and charts, the
  paper's own figures, limits, takeaway). Older films are a 90-125 second
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

**New films use the story format.** Add `"format": "story"` to the
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
renders through          story/render.mjs → story/studio.html → story/explainer.js + story/scenes.js
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
chapters, a diagram, two charts, two traces, an inset into the tree search,
two of the paper's figures, the limits as steps; 17 scenes, 725 words of
narration, 4 min 49 s. Rendered at 1280x720, x264 CRF 36 `-tune animation`
(`STORY_FLAGS` in `build.mjs`; the legacy path stays at 34): 7.1 MB, small mono
type (tick labels, trace sub-labels) still crisp. Painted in about 200 s on an
M1 Max with 4 pages, about 280 s end to end with the voice cached.

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
