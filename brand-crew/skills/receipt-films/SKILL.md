---
name: receipt-films
description: >-
  Write and render a "Receipts" film for an article: a 40-60 second painted,
  narrated animation — watercolour and boiling ink drawn in code every frame,
  Clawd presenting each beat — that opens on a full-bleed word punch, walks
  through the article's claim and its measured numbers, and ends on a till
  receipt of every figure it showed. Voice by Kokoro on CPU; effects and score
  synthesized to the picture's own cues. Use when an article needs its film,
  when an article's numbers change, or when asked for a shareable video of a
  piece. The film is a storyboard in data/films/<slug>.json; every number and
  quote in it must appear in the article, and pnpm validate fails if one does not.
---

# Receipts films

Every article can carry a short film at the top of its page: the article's
argument, in its own numbers, printed on paper. The film is not written as
code. It is a **storyboard** — a small JSON file — and a shared engine turns it
into frames. You write the storyboard; the engine owns the look.

```
data/films/<slug>.json            the storyboard (you write this)
public/films/<slug>.mp4           the film: 960x540 H.264 on twos, AAC voice + score
public/films/<slug>.vtt           captions
public/films/<slug>-poster.webp   the title card, for no-JS and before play
data/.generated/films.json        manifest: duration, sizes, transcript, and a hash that goes stale when the storyboard, the article date or the engine changes
```

Storyboards exist for every article; films are rendered for a chosen set (each is
~1.3 MB, so the repo carries the recent and featured ones). An unrendered
storyboard is still checked, and renders with one command.

## The look and the sound (fixed — do not fight them)

**Painted.** `engine/paint.js` is a Canvas2D painter with the drawing API of the
vendored [claude-animation-base](../claude-animation-base/) — watercolour glazes
that pool at their edges, flat washes, tapered ink lines, dry brush, hatching,
glow, paper and grain — and every frame is painted from scratch, twelve new
drawings a second, so the linework boils like drawn animation. Clawd, the
base's character, loads unchanged from `../claude-animation-base/src/clawd.js`
and performs each beat: inspects the claim through a magnifier, takes a
surprised hop when a number lands, bounces while a tally fills, presents the
receipt. Headlines and numbers are hand-lettered (Permanent Marker, which is
capitals only — a value whose case matters, like `map[string]struct{}` or
`14.1 s`, switches to Hanken automatically); labels and quotes are in the
site's Hanken Grotesk and IBM Plex Mono. p5.brush itself took 44-91 s a frame
on this site's GPU-less build machine; this painter takes about 0.1 s.

**Narrated and scored.** Every scene says a line — generated from its own
fields (a scene's `say` overrides it) — voiced by Kokoro-82M (`af_heart`,
Apache-2.0) on CPU. Each scene lasts as long as the longer of its reading time
and its line. `audio.py` then synthesizes a sound for every cue the scenes
emit — a paper thwack per punch, a pen scratch on a marked quote, a stamp
thunk, ticks as cells fill, a whoosh under each brush wipe, a receipt printer —
and a small score (electric piano, plucked arpeggio, bass, brushed drums, paper
crackle, 120 bpm, key from the slug) that ducks under the voice. Nothing is
sampled; the same storyboard always sounds the same. Captions are WebVTT, from
the same lines.

## The shape of a film

1. **title** — the hook. `punch` is two to four chunks shown full-bleed on hard
   cuts a third of a second apart; they are the first thing anyone scrolling a
   feed sees, so they carry the sharpest true claim. Then the composed title:
   kicker (the subject), `headline`, `sub`.
2. **two to four beats** — `claim`, `stat`, `versus`, `tally`, `list` (at most
   one list: it is the slowest scene to read). Each beat is one read. Pick the scene that makes the number *visible*: a ratio is
   a `versus`, "n of N" is a `tally`, a single striking figure is a `stat`,
   somebody's words that the article checks are a `claim`.
3. **verdict** — the take, one sentence, with the phrase that carries it marked.
4. **end** — the receipt. Every figure the film showed, as `receipt` lines (plus
   at most one more that the article states), and `total` as the verdict in
   ≤ 10 words.

With narration a film runs 40-60 seconds. The engine times every scene from the
words on screen (4 words a second, plus time to find each read) and from the
narrator's line, so **the length is set by how much you write**. Write less.
`render.mjs sheet` prints the silent duration; the narrated one is longer.

## Scenes and limits

All strings are plain text. Limits are enforced by `pnpm validate:films`.

| type | fields | limits |
|---|---|---|
| `title` | `punch[]`, `headline`, `sub?` | punch 2-4 chunks of ≤ 4 words; headline ≤ 10 words; sub ≤ 12 |
| `claim` | `quote`, `label?` ("The claim", "The pitch", "The README"…), `source?`, `mark?`, `markStyle?` (circle, underline, strike, highlight), `stamp?`, `note?` | quote ≤ 30 words, **verbatim from the article**; mark is a phrase inside the quote |
| `stat` | `value`, `label`, `from?`, `stamp?`, `note?` | value ≤ 20 characters; label ≤ 14 words |
| `versus` | `label`, `a: {label, value}`, `b: {label, value}`, `unit?`, `ratio?`, `stamp?`, `note?` | values numeric; unit is appended verbatim (`" s"`, `"B"`, `"%"`); ratio ≤ 6 characters |
| `tally` | `label`, `of`, `rows: [{label, n}]` (1-3), `stamp?`, `note?` | `of` ≤ 300; each `n` ≤ `of` |
| `list` | `label?`, `items: [{text, mark?}]` | 2-3 items of ≤ 8 words; mark `yes` / `no` or none (numbered) |
| `verdict` | `text`, `mark?`, `stamp?` | ≤ 16 words; mark is a phrase inside text |
| `end` | — | must be last |

Any scene but `end` may also carry `say` (≤ 45 words): the line the narrator
speaks for it, replacing the one generated from its fields. Use it when the
generated line reads badly aloud — a code identifier, a unit the voice
mispronounces, a number that is clearer said as the article says it. It is
checked like everything else: every digit in it must be in the article.

Top level: `slug`, `kicker` (≤ 6 words: what the article is about — the model,
the project, the idea), `palette` (see below), `scenes`, `receipt` (2-6
`[label, value]` pairs), `total`. The article's date is added at render time
from its frontmatter; do not write one.

`note` is a one-line mono footnote for a caveat the number cannot stand
without ("one draw per arm, four prompts"). Use it when the article states one.

## Truth rules

These are the reason the films are worth watching, and the checker enforces
the mechanical half of them.

- **Every number on screen is in the article.** Each digit string in the
  storyboard (values, labels, punch, receipt) must appear in the article's MDX,
  with thousands separators and number words ("fourteen") both accepted. A
  number you computed yourself — a ratio the article never states — does not go
  on screen.
- **Quotes are verbatim.** A `claim.quote` must be a contiguous run of words in
  the article (markdown stripped). You may cut from the start or end of a
  quoted sentence; you may not splice two sentences or reword one.
- **Stamps mean what the article means.** The site labels claims Measured
  (computed from a file the author read), Reported (someone else's number) and
  Reasoned (inference). A stamp must match how the article labels that figure.
  If the article reports a vendor's number, the stamp is `reported`, never
  `measured`. If you are unsure, leave the stamp off.
- **Paraphrase only what the article says.** A headline or verdict may be
  shorter than the article's sentence; it may not be stronger. No "destroys",
  "crushes", "insane". The article's own title and "The take" section are the
  safest sources for the headline and verdict.
- **Don't flatter.** If the article's verdict is mixed, the film's is mixed.

### Articles with standing content constraints

Films inherit every constraint on their article. In particular:
`fly-connectome-computing` names no ticker, price, market figure or purchase
path and does not evaluate the token; `runtime-abliteration` shows mechanism
and published numbers only, never a recipe; `confidence-gated-fraud-detection`
shows the gating decision and its accuracy, nothing that reads as evasion
advice; `zcode-disclosure` and `openmuse` show no exploit path; anything
touching the Jev trader shows architecture, never returns or strategy.

## Palettes

`pink-blue` · `orange-fblue` · `red-marine` · `green-pink` · `purple-sun` ·
`teal-flame` · `blue-orange` · `flame-grape`. Pick by subject so the series
reads as a taxonomy: image and video generation `pink-blue`; agents and
runtimes `orange-fblue`; inference, serving and kernels `red-marine`;
robotics, 3D and spatial `green-pink`; evaluation, benchmarks and audits
`purple-sun`; training, RL and distillation `teal-flame`; from-scratch
explainers `blue-orange`; everything else `flame-grape`.

## Workflow

```bash
# 1. write data/films/<slug>.json, then check it against the article
pnpm validate:films --storyboards --only=<slug>
# 2. look before you listen: a silent contact sheet every half second
node brand-crew/skills/receipt-films/render.mjs sheet data/films/<slug>.json --every=0.5 --cols=8 --w=240 --out=/tmp/<slug>.jpg
# 3. hear what the narrator will say
node brand-crew/skills/receipt-films/render.mjs lines data/films/<slug>.json
# 4. render: voice, paint, score, mux; writes public/films and the manifest
node brand-crew/skills/receipt-films/build.mjs <slug>          # or --stale
# a 1280x720 cut for social, not committed
node brand-crew/skills/receipt-films/build.mjs <slug> --social --out=drafts/films
```

Needs Node, Playwright's Chromium, ffmpeg, and `pip install kokoro soundfile`
(the voice model downloads from Hugging Face on first use, ~330 MB). Voice wavs
are cached in `~/.cache/receipt-films` by text, so re-rendering after a visual
change never re-voices.

Read the sheet like a viewer: is the hook legible at thumbnail size, does each
beat hold long enough to read, does any text collide with Clawd, a stamp or a
bar? Read the lines like a listener: a label that reads fine on screen can
sound wrong aloud ("3 processes the reference manifest…"); fix it with a
scene's `say`. Fix the words, not the engine.
