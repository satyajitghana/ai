---
name: new-article
description: Write a curated long-form AI article for ai.thesatyajit.com. Use when Satyajit wants to publish an evergreen explainer or essay on AI broadly (transformers, RL, diffusion, systems) — a rigorous teaching piece, not a personal build-log. Creates content/articles/<slug>.mdx with valid frontmatter, then runs pnpm validate.
---

# new-article — author a curated AI article

Create `content/articles/<slug>.mdx`. `<slug>` is kebab-case from the title (lowercase, alphanumerics + hyphens, no date prefix). The slug is the URL: `/articles/<slug>`.

Articles are **curated, evergreen explainers/essays on AI broadly** — distinct from `blog` (personal build-log / TIL). Go deep and rigorous; this is a teaching piece.

## Frontmatter (Zod: `articleFrontmatter`)
```yaml
---
title: <required, concise>
description: <required, 1 sentence, used for SEO + cards>
date: 2026-06-04          # today (YYYY-MM-DD)
tags: [tag-one, tag-two]  # kebab-case; reuse existing tags (data/taxonomy.ts TAG_ALIASES / DROPPED_TAGS)
draft: false              # set true to stage without publishing
rating:                   # 0–3 each, score the subject + this page as a reader gets it
  novelty: 1
  verification: 2
  runnable: 2
  explains: 2
  takeaway: 1
  durability: 2
  reach: 1
  unique: 2
  why: "<= 160 chars: what a reader gets here that they can't get elsewhere."
topic: inference-serving  # exactly one id from data/taxonomy.ts TOPICS
kind: model               # paper | model | tool | teardown | roundup | essay | guide | dataset
level: practitioner       # intro | practitioner | research
runsOn: consumer-gpu      # browser | phone | cpu | consumer-gpu | workstation | datacenter | api | none
licence: Apache-2.0       # optional: SPDX id, or proprietary | mixed | source-available | non-commercial | custom | unlicensed | n/a
# updated: 2026-06-04     # optional, only when revising later
# cover: /covers/foo.png  # optional
---
```
Do not add `interest` / `helpful`; they are deprecated.

## Rating (every new article is rated)
Anchors are in `lib/content/rating.ts` (`RUBRIC`). Be stingy: **3 is rare**, the corpus
mean per dimension is ~1.5, and `pnpm validate:ratings` fails once 50+ are rated if any
dimension's mean passes 2.2. Score and tier are computed, never written.
- `verification` 3 = reproduces the headline result, or shows from primary files that it is materially wrong; 2 = measures key facts from files/code/configs.
- `unique` is the angle, not the evidence: a careful recount of a well-covered release can be verification 3 / unique 1.
- `explains` 3 only when interactives are built from real code or data and carry the core mechanism.
- `novelty` for an essay or guide scores the argument, not the subject.
- `runnable`: code that must be trained from scratch to do anything = 1; a concept page = 0 with `runsOn: none`.
- Topic boundaries: SLAM → robotics; a domain benchmark → its domain (evals only when it is about evaluation method); decision models → llm-architecture.

## Body
- MDX. Read `brand-crew/brand/voice.md` first and write in that voice: precise, engineer-first, dry wit, no marketing fluff, show the math/code/numbers.
- Rendered with the **MDX explainer kit** — use freely for a rich, interactive piece:
  `<Math>`/`$$…$$` and `$…$`, `<Diagram>`, `<AttentionMatrix>`, `<StepThrough>`,
  `<Plot>`, `<Callout type="tip|note|warning">…</Callout>`, `<Figure>`.
- DUAL-NATIVE RULE: always write full prose (and static math/figure) alongside any
  interactive component, so the `.md` variant + `llms-full.txt` stay complete for
  agents and no-JS readers. An interactive viz must never be the only carrier of an idea.

## Steps
1. Pick the slug; confirm `content/articles/<slug>.mdx` does not already exist.
2. Write the file with the frontmatter above + a deep, prose-complete body.
3. Rate it (section above) last, after the body exists — rate the page you wrote, not the one you planned.
4. Run `pnpm validate` and report the result (it includes `validate:ratings`). Fix any Zod errors and re-run until green.
5. Remind: ship via PR; nothing auto-deploys.
