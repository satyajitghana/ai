---
name: explainer-films
description: >-
  Write and render an explainer film for an article: a 60-110 second animated,
  narrated explanation of how the thing the article is about works — its
  architecture, its technique, what is new about it — presented by a mascot
  (cat, dog, fox, bunny, capybara or fish) who is different in every film, in
  one of eighteen drawn styles (watercolour, crayon, pastel, ballpoint,
  pencil, marker, charcoal, sumi, engraving, stipple, calligraphy, spray,
  chalkboard, blueprint, neon, notebook, riso, pixel). Every article also gets a
  thumbnail painted from the same storyboard, used as its page backdrop and its
  OG image background. Use when an article needs its film or thumbnail, when an
  article's facts change, or when asked for a video explanation of a piece. The
  storyboard is data/films/<slug>.json; every number and quote in it must appear
  in the article, and pnpm validate fails if one does not.
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
| `stat` | `value` (≤ 20 chars), `label` (≤ 14 w), `note?`, `stamp?` | One striking figure. |
| `bars` | `title`, `items[]` (2-5, `{label ≤ 5 w, value, hl?}`), `unit?` (≤ 4 chars), `note?`, `stamp?` | A comparison; `hl` marks the one that matters. |
| `tally` | `label`, `of` (≤ 300), `rows[]` (1-3, `{label, n}`) | n of N. |
| `quote` | `quote` (≤ 30 w, verbatim), `source?`, `mark?`, `stamp?` | Someone's claim the article checks. At most one. |
| `takeaway` | `text` (≤ 22 w), `mark?` | Exactly one: the thing to remember. Not a jab; the insight. |
| `end` | `recap[]` (2-3, ≤ 10 w each), `say?` | The engine adds the sign-off. Give `say` a short recap; the default reads every item. |

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
| `pixel` | 320x180, 16 colours, chiptune | games, voxels, retro, playful subjects | `pico` `night` `wine` |
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
