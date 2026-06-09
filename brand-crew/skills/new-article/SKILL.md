---
name: new-article
description: Write a curated long-form AI article for ai.thesatyajit.com. Use when Satyajit wants to publish an evergreen explainer or essay on AI broadly (transformers, RL, diffusion, systems) — a rigorous teaching piece, not a personal build-log. Creates content/articles/<slug>.mdx with valid frontmatter, then runs pnpm validate.
---

# new-article — author a curated AI article

Create `content/articles/<slug>.mdx`. `<slug>` is kebab-case from the title (lowercase, alphanumerics + hyphens, no date prefix). The slug is the URL: `/articles/<slug>`.

Articles are **curated, evergreen explainers/essays on AI broadly** — distinct from `blog` (personal build-log / TIL). Go deep and rigorous; this is a teaching piece.

## Frontmatter (Zod: `articleFrontmatter` — same shape as blog)
```yaml
---
title: <required, concise>
description: <required, 1 sentence, used for SEO + cards>
date: 2026-06-04          # today (YYYY-MM-DD)
tags: [tag-one, tag-two]  # kebab-case topics
draft: false              # set true to stage without publishing
# updated: 2026-06-04     # optional, only when revising later
# cover: /covers/foo.png  # optional
---
```

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
3. Run `pnpm validate` and report the result. Fix any Zod errors and re-run until green.
4. Remind: ship via PR; nothing auto-deploys.
