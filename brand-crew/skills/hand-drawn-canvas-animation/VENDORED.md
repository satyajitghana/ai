# Vendored: hand-drawn-canvas-animation

This skill is **not ours**. It is vendored verbatim (with the two deltas noted
below) so that `brand-crew` can make films without a network fetch, and so the
version that produced a given article's video is pinned next to the article.

| | |
|---|---|
| Upstream | https://github.com/alesha-pro/tools/tree/main/skills/hand-drawn-canvas-animation |
| Commit | `9dee46e3b5ca091ff0ccc49e1c657705d3033ca6` (2026-09-18) |
| Author | Alexey Fateev |
| Licence | MIT — full text in `LICENSE` in this directory |

The MIT licence permits this, and requires the copyright notice to travel with
the copy, which is why `LICENSE` sits here rather than only at the repo root.

## Local deltas

Two, both recorded here so a re-vendor can reapply or drop them:

1. **`scripts/render.mjs` — Chrome launch flags.** Upstream launches Chrome with
   defaults. In a container running as root the sandbox refuses to start, and
   the default `/dev/shm` is too small for 1920x1080 frame buffers, so the
   render dies partway. Added `--no-sandbox --disable-dev-shm-usage
   --disable-gpu`. No effect outside a container.
2. **This file**, which upstream does not have.

Nothing else is changed. `core.js`, the references, the examples and the other
scripts are byte-for-byte upstream.

## Using it here

Films for this site are built outside the Next.js tree and only their rendered
output is committed, which is why `public/articles/<slug>/` holds an `.mp4`, a
`.webm` and a poster but no `.html`. Render with:

```bash
SKILL=brand-crew/skills/hand-drawn-canvas-animation
cp $SKILL/assets/core.js $SKILL/scripts/{render.mjs,package.json} <workdir>/
cd <workdir> && npm i && CHROME=$(which chromium) node render.mjs film.html --grid 28 --ar 16:9 --width 1280
```

A film of your own loads `core.js` from beside itself, so that flat layout is
all it needs. The bundled **examples do not** — they load `../assets/core.js`,
so to run one, mirror the skill's own shape instead (`assets/core.js` and
`examples/<name>.html`, with `render.mjs` at the root) and pass the path as
`examples/<name>.html`. Copied flat, an example renders nothing and the render
times out waiting for `window.__ready` rather than reporting a missing file.

`--grid 28` renders a contact sheet and nothing else. Look at that first: it is
far cheaper than a full render and it is where layout collisions show up.

Then compress before committing — the player is `muted` and `loop`, so audio is
dead weight, and the `.webm` is listed first in `<Video>` so it is the file most
browsers actually fetch:

```bash
ffmpeg -i out/film.mp4 -an -c:v libx264 -tune animation -preset veryslow \
  -crf 33 -pix_fmt yuv420p -movflags +faststart film.mp4
ffmpeg -i out/film.mp4 -an -c:v libvpx-vp9 -crf 46 -b:v 0 -row-mt 1 \
  -deadline good -cpu-used 1 -pix_fmt yuv420p film.webm
```

Check a text-heavy and a grain-heavy frame against the source before replacing
anything; dense stipple needs a higher VP9 crf to pay off, flat vector art does
not degrade until far past these numbers.
