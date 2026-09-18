---
name: film-narration
description: >-
  Add a spoken narration track and captions to an article film on ai.thesatyajit.com, using Piper text-to-speech on CPU — no GPU, no API, no per-character billing. Writes one voice clip per scene, places each at its scene offset, mixes the film's generated score underneath as a bed, muxes mono AAC/Opus into the mp4 and webm, and emits a WebVTT caption track. Use when a film explains something rather than just illustrating it, when the user asks for narration, voiceover, audio, a talking version, or a 3Blue1Brown-style explainer. Not for the silent ambient loops that open most articles — those stay muted and autoplaying.
---

# film-narration — give a film a voice

Films made with `hand-drawn-canvas-animation` are silent by default, and most
should stay that way: an article opener is an illustration, and a reader who
did not ask for sound should not get any. Narrate a film only when it carries
an **argument** — a derivation, a comparison, a mechanism — where a voice adds
something a caption cannot.

## The rule that decides everything else

**The narration sets the pace. The film is retimed to fit it.**

Not the reverse. Write the line you want for a beat, synthesise it, measure it,
and if it does not fit, lengthen that scene's `dur` in the film's `TIMELINE`.
Speeding the voice up or hacking the sentence shorter both make the film worse.
`narrate.py` exits non-zero on a beat that overruns, on purpose.

Aim for **≥0.5s** of silence between the end of a line and the next cut, and
start each line 0.3s after its scene begins so the cut lands before the voice.

Half a second sounds generous and is not. Piper is stochastic — the same text
resynthesised comes out a different length. Measured across one 13-beat script
resynthesised twice, drift reached **0.42s on a single five-second line**, in
both directions. A beat that fits with 0.2s to spare today overruns tomorrow,
which means the film is not reproducible from its own script. `narrate.py`
flags anything under 0.5s as TIGHT for this reason.

## Setup

```bash
python3 -m venv ttsenv && ./ttsenv/bin/pip install piper-tts
B=https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high
curl -sLO $B/en_US-lessac-high.onnx -O $B/en_US-lessac-high.onnx.json
```

`en_US-lessac-high` is ~114 MB and synthesises a minute of speech in seconds on
CPU. Other voices live under `rhasspy/piper-voices`; `-high` variants are worth
the size for anything a reader will sit through.

## Write the script

One object per scene, in film order, matching the `TIMELINE` exactly:

```json
[
  {"name": "write",  "dur": 3.5, "say": "An L L M answers by writing words.",
                                 "show": "An LLM answers by writing words."},
  {"name": "decide", "dur": 4.0, "say": "Jev never writes. It picks one of your options."}
]
```

`say` is read aloud; `show` is what the caption displays and defaults to `say`.
**They differ whenever the synth needs help.** Initialisms must be spelled out
(`R L C D`, `L L M`) or they are read as words — and that spelling must never
reach the screen. `narrate.py` warns if a caption still looks spelled-out.

Write to complement the on-screen captions, not to read them aloud. Budget
roughly 2.3 words per second.

## Run it

```bash
SKILL=brand-crew/skills/film-narration
python3 $SKILL/scripts/narrate.py script.json \
  --piper ./ttsenv/bin/piper --voice en_US-lessac-high.onnx --out narration
```

Prints a per-beat fit report and writes `narration/voice.wav` (mono 48k, full
film length, normalised to -17 LUFS) and `narration/captions.vtt`. Fix any
overrun by editing the film's `TIMELINE`, re-render, and run it again.

Then mix and mux:

```bash
POSTER_AT=48 $SKILL/scripts/mux.sh out/film.mp4 narration/voice.wav \
  out/film-final.mp4 public/articles/<slug>/<slug>-film
cp narration/captions.vtt public/articles/<slug>/<slug>-film.vtt
```

The third argument is the render's scored version, mixed underneath the voice
at 0.13 gain as a bed; pass `-` for voice alone.

## Wire it into the article

A narrated film **must** use `narrated` on `<Video>`, and must ship captions:

```mdx
<Video
  src="/articles/<slug>/<slug>-film"
  poster="/articles/<slug>/<slug>-film-poster.jpg"
  narrated
  captions="/articles/<slug>/<slug>-film.vtt"
  alt="…"
  caption="…"
/>
```

`narrated` swaps autoplay-loop-muted for `controls`. This is not cosmetic:
browsers only autoplay **muted**, so a narrated film left on the default is a
silent film, and one that loops is rude. Captions are not optional — narration
without them is an accessibility regression, and the `.md` agent variants and
print view get nothing from an audio track.

Say in the `alt` that the film is narrated and captioned.

## Before committing

- `pnpm validate`, then **`pnpm build`** — validate does not do static
  generation and cannot catch a deploy failure.
- Serve the build and check the `.vtt` returns `text/vtt`, and that the
  rendered `<video>` has `controls` and no `autoplay`/`loop`/`muted`.
- Check the **other** films on the site still render autoplay/loop/muted —
  the `narrated` prop defaults to false, but a regression here is silent.
- **Listen to it.** Duration, levels and alignment are measurable; pronunciation
  is not. Proper nouns and coined terms are where Piper goes wrong. Fix them
  with phonetic respellings in `say`, which leaves `show` untouched.
