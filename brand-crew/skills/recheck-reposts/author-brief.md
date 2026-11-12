# Author brief: one flagship article for ai.satyajit.si (shared checkout)

<!-- Handed to each parallel author by the recheck-reposts skill, together with a
     subject message naming the slug, sources, related articles, a component
     idea, the storyboard host and a SCRATCH directory. Replace <TODAY> and
     <REPO>. Revised 2026-11-12: shared checkout (no worktrees), human voice,
     clips, story-format storyboards. -->

You are writing ONE flagship article for ai.satyajit.si, an AI-native Next.js site whose articles are rigorous explainers of new AI work. Your task message names the slug, the subject, the sources, the storyboard host and your SCRATCH directory.

TODAY is <TODAY>. Use `date: <TODAY>`.

## You share ONE checkout with other agents
The repo is `<REPO>`. Several authors edit it at the same time. There are no worktrees: disk is tight.
- Create or edit ONLY:
  - `content/articles/<slug>.mdx`
  - `components/articles/<slug>/**`
  - `public/articles/<slug>/**` (media; gitignored, the lead pushes it to R2)
  - `data/films/<slug>.json`
  - an existing article only if your task message names it.
- Never run a git command that writes (`commit`, `add`, `checkout`, `stash`, `reset`). Read-only git is fine. The lead commits.
- Never run `pnpm media:push`, `gen:widgets`, `fetch:models`, `fetch:repos`, `reposts`, `build`, `dev`, `build.mjs` or `render.mjs`. Never edit `data/.generated/*`, `lib/media-map.json`, the widget registry, `pronounce.json`, the film engine, shared components or other articles.
- A corpus-wide check may fail on another author's half-written file. Fix only failures that name your files; report the rest.
- Prefix heavy commands with `nice -n 10`. Never kill a process you did not start.
- Keep SCRATCH under 2 GB and delete clones and downloads when you finish. Don't download model weights: read configs and safetensors headers with HTTP range requests.

## Read first
- `CLAUDE.md`: the content contract, "Article production standard" and the MDX/JSX guardrails (escape a bare `<` as `&lt;` and `$` as `\$`; `{" "}` at JSX boundaries; DOM numbers through `lib/dmath`).
- `brand-crew/brand/voice.md`, all of it, especially "Sound like a person, not a pipeline".
- `brand-crew/skills/new-article/SKILL.md`, one or two recent articles near your topic and their components, `components/articles/ui/range.tsx`.
- `brand-crew/skills/explainer-films/SKILL.md`, "Story format (long films)", and `data/films/latent-sparse-attention.json` as the model storyboard.
- `lib/content/rating.ts` and `data/taxonomy.ts`. Rate stingily.

## Deliverables
1. **`content/articles/<slug>.mdx`**, detailed: 2,500–4,500 words (a roundup ~600–900 per item).
   - Frontmatter per the schema: `title` as `Subject: hook`, `description`, `date`, existing `tags`, `rating`, `topic`, `kind`, `level`, `runsOn`.
   - Explain the mechanism from first principles (the problem, why the old way fails, how this works, the math where it helps), then check the claims against the primary sources.
   - Know where every number comes from: one you computed, the publisher's, or your arithmetic on those. Say it in the sentence ("the paper's Table 2 reports", "on the safetensors headers I count"), not with a "(reported)" tag on each number; at most three such tags per article. One short note at the end can list what you ran versus read.
   - Link related site articles; cite primary sources inline (arXiv abs pages, GitHub, Hugging Face feed the JSON-LD citation graph).
2. **One or two original interactive components** in `components/articles/<slug>/`: `"use client"`, SSR-safe, no new dependencies. The prose carries every idea the widget shows. `npx eslint components/articles/<slug>`.
3. **Real figures**: the method diagram and the headline result. `public/articles/<slug>/figN.png` (`.jpg` for photos), flattened onto white, ≤1600 px wide, `<Figure src alt caption />`, captions ending `(… paper, Figure N).` Never hotlink. arXiv HTML `https://arxiv.org/html/<id>v1/…` or ar5iv; repos by `git clone --depth 1` into SCRATCH.
4. **More visuals, including video.** Project-page and README images, result grids, screenshots, and clips: project-page or Hugging Face demos, or the X post's own video (`curl -s https://api.fxtwitter.com/2/status/<POST_ID>` lists `media.videos[].url`; credit "video from @handle's post on X", as `content/articles/aa-3d.mdx` does). Cut to ≤15 s of the part that shows the mechanism or result, no audio, ≤960 px wide: `ffmpeg -an -c:v libx264 -crf 30 -preset slow -pix_fmt yuv420p -movflags +faststart` → `clipN.mp4`, `-c:v libvpx-vp9 -crf 42 -b:v 0` → `clipN.webm`, plus `clipN-poster.jpg`; ≤1.5 MB each. `<Video src="/articles/<slug>/clipN" poster alt caption />`. Aim for 4–8 visuals where the sources have them.
5. **Storyboard `data/films/<slug>.json` in the story format** (`"format": "story"`), with the host and style from your task message. Hook, chapters, several mechanism scenes, the article's figures and clips, 400–750 words. Every digit a viewer sees or hears must appear in the MDX. Pass `pnpm validate:films --storyboards --only=<slug>`. Pronunciation: `~/.cache/explainer-films/kvenv/bin/python brand-crew/skills/explainer-films/audio.py words --films data/films`; reword flagged words, and list unavoidable names in your report. The lead's film pass adds bespoke scenes and renders.

## Sources
Read the X post's thread and replies through the fxtwitter mirror when a source is thin: `https://api.fxtwitter.com/2/thread/<POST_ID>`, `…/2/conversation/<POST_ID>`. A link someone else replied with is a lead, not a source.

## Rules
- Verify every number against the paper, code, config or card. Never invent one; if a claim can't be checked, say so.
- Don't execute code from third-party repositories unless your task message grants it (and Satyajit did). Reading and cloning are fine.
- `<ModelCard repo>` / `<RepoCard repo>` are fine; name the ids in your report.

## Validate (fix what is yours)
`pnpm typecheck`, `validate:content`, `validate:mdx`, `validate:math`, `validate:placeholders`, `validate:links`, `validate:ratings`, `check:tells <slug>`, `validate:films --storyboards --only=<slug>`, eslint on your folder, `check:links:external --internal-only`. `validate:assets`, `validate:media` and `validate:widgets` complain until the lead pushes media and regenerates the registry.

## Report back (concise)
Slug and title; word count; 5–8 key findings, each saying where its number comes from; figures and clips with sources; components; card ids; names the voice may mispronounce; validation results; anything unverified; the exact files you created or edited.
