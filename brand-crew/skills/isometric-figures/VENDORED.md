# Vendored: isometric-figures (upstream name: Anatomy)

This skill is **not ours**. It is Ryan's Anatomy skill, copied in and renamed so
`brand-crew` can draw isometric machine figures without a network fetch, and so
the exact version the site uses sits in the repo. The article
[Anatomy: a Claude skill that draws machines](/articles/anatomy-machine-skill)
reviews it.

| | |
|---|---|
| Upstream | https://github.com/wheresryan22/anatomy |
| Commit | `689dcf966e63d92be10a5d593c6e19e10acd4422` (2026-10-12) |
| Author | Ryan (wheresryan22) |
| Licence | MIT — full text in `LICENSE` in this directory |

## Local deltas

1. **Renamed.** `SKILL.md` frontmatter `name: anatomy` → `name: isometric-figures`,
   and its title. Everything else in `SKILL.md` is upstream, so the body still
   says "Anatomy" in places, and the CSS tokens keep their `--anatomy-*` names.
2. **Built example pages removed** (14 files, about 11 MB). They are generated:
   `node examples/<name>/build.mjs` (add `--light`) writes them again, and
   `.gitignore` now ignores them.
3. **Upstream repository files removed:** `.github/`, `CONTRIBUTING.md`,
   `CODE_OF_CONDUCT.md`, `SECURITY.md`.
4. **This file**, and an ESLint ignore for this directory in the site's
   `eslint.config.mjs` (upstream `kit/react/live.tsx` trips the site's
   `react-hooks/refs` rule twice; the code is left as upstream wrote it).

Nothing else is changed. `kit/`, `references/`, `scripts/`, `tests/`, `evals/`,
`agents/` and the example sources are byte-for-byte upstream.

## Using it on this site

React components built from the kit run through the site's own rules, which
upstream does not follow: numbers that reach the DOM go through `lib/dmath`
(the kit uses plain `Math.sin`/`cos`/`hypot`, which can differ between Node and
Chrome and break hydration), and the component must pass the site's ESLint. See
`components/articles/anatomy-machine-skill/` for a port that does both.

## Not published from this site

`lib/skills.ts` skips any skill directory containing a `VENDORED.md`, so this
one is absent from `/.well-known/agent-skills/`.
