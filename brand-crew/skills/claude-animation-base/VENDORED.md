# Vendored: claude-animation-base

This skill is **not ours**. It is John Heibel's Claude Animation Base, vendored
so that `brand-crew` can use its character and guide without a network fetch,
and so the exact version the site's films were drawn with sits next to them.

| | |
|---|---|
| Upstream | https://github.com/JohnHeibel/ClaudeAnimationBase |
| Commit | `b1d7e89b4bcf44084078b6341edb0798ba93bbe7` (2026-09-23) |
| Author | John Heibel |
| Licence | MIT — full text in `LICENSE` in this directory |

The character, Clawd, is Anthropic's Claude Code mascot as this kit draws it.
The kit's MIT licence covers the code; it grants nothing over the character's
design, and neither does this site.

## Local deltas

1. **`render.mjs` — container launch flags and timeouts.** In a container
   running as root, Chrome's sandbox refuses to start and the default
   `/dev/shm` is too small, so root adds `--no-sandbox --disable-dev-shm-usage`.
   With `NO_GPU=1` set, WebGL runs on SwiftShader
   (`--use-angle=swiftshader --enable-unsafe-swiftshader`). Page load and the
   `window.ready` wait have no timeout, because a software-rendered first frame
   can take longer than upstream's 30 s and 60 s. No effect on a machine with a
   GPU that isn't root.
2. **`docs/emotions.webp` removed** (6.4 MB). It is an animated copy of
   `docs/emotions.jpg`, which stays and which the guide links.
3. **`SKILL.md` and this file**, which upstream does not have.

Nothing else is changed. `src/`, `ANIMATION_GUIDE.md`, `studio.html`, the
package files and the other docs are byte-for-byte upstream. `node_modules/`
is not vendored; run `npm install` here to use the kit directly.

## Not published from this site

`lib/skills.ts` skips any skill directory containing a `VENDORED.md`, so this
one is absent from `/.well-known/agent-skills/`.
