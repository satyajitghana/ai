# Author brief: one flagship article for ai.thesatyajit.com

<!-- Handed to each parallel author by the recheck-reposts skill, together with a
     subject message naming the slug, worktree, scratch cap, sources, related
     articles, a component idea and the storyboard host. Replace <TODAY>. -->

You are writing ONE flagship article for ai.thesatyajit.com. It is an AI-native Next.js site whose articles are rigorous, receipt-driven explainers of new AI work. Your task message names the slug, the subject and the sources. It also names your WORKTREE (a git worktree on branch `art/<slug>`, with node_modules symlinked and public/films and public/thumbs excluded) and your SCRATCH directory.

Work ONLY inside your worktree and scratch. Never touch /home/user/ai.

TODAY is <TODAY>. Use `date: <TODAY>`.

## The machine is shared
- It has 4 CPU cores, and five other authors are working at the same time.
- Prefix every pnpm, npx, node, python or ffmpeg command with `nice -n 19`.
- Never kill a process you did not start.
- Disk is tight: check `df -h /`; it is shared by every author. Keep your scratch under the cap in your task message, and delete it at the end.

## Read first (in the worktree)
- `CLAUDE.md`. It covers the content contract, the "Article production standard", explainer films, and the MDX/JSX guardrails: escape a bare `<` and `$`; put spaces at JSX boundaries with `{" "}`; route DOM numbers through `lib/dmath`.
- `brand-crew/brand/voice.md`, `brand-crew/skills/new-article/SKILL.md` and `brand-crew/agents/articles-author.md`.
- The exemplars named in your task message, plus `components/articles/ui/range.tsx`.
- `brand-crew/skills/explainer-films/SKILL.md`, for the storyboard.

## Deliverables (in the worktree)
1. **`content/articles/<slug>.mdx`**
   - Frontmatter: `title` (`Subject: hook` form), `description`, `date: <TODAY>`, `tags` (reuse existing tags; grep `content/articles` for them).
   - 1,800–3,200 words.
   - Explain the mechanism from first principles, then check the claims against the primary sources.
   - Label every number: **measured** (you computed it from a file or run), **reported** (the publisher's figure, not re-run), or **reasoned** (your arithmetic on the other two).
   - Link related site articles; grep `content/articles` and `content/architectures`.
2. **At least one ORIGINAL interactive component** in `components/articles/<slug>/`.
   - `"use client"`, SSR-safe, no new dependencies.
   - Dual-native: the prose must carry every idea the widget shows.
   - Run `nice -n 19 npx eslint components/articles/<slug>`.
3. **Real figures from the source**: at least the method diagram and the headline result, where they exist.
   - Commit to `public/articles/<slug>/figN.png` (or `.jpg` for photos).
   - Flatten transparent images onto white and cap width at 1600px.
   - Embed with `<Figure src alt caption />`. Each caption ends with an attribution such as `(… paper, Figure N).` or `(… model card).`
   - Never hotlink.
4. **Storyboard `data/films/<slug>.json`**, using the style, host species, name and hat in your task message; the rest of the look is your choice, but it must be unique.
   - Every digit a viewer sees or hears must appear in the MDX.
   - Diagram layout: keep connected nodes well apart. The checker fails an edge whose arrow would be drawn backwards, which happens when two boxes sit too close along the edge. Keep wide nodes between x 12 and 84.
   - Pass `nice -n 19 pnpm validate:films --storyboards --only=<slug>`.
   - Run `nice -n 19 python3 brand-crew/skills/explainer-films/audio.py words --films data/films`. If a word of yours is flagged, reword the narration rather than editing `pronounce.json`.
   - Do NOT run `build.mjs`; the lead renders the thumbnail.

## Read the post's thread for sources
The X post your article is based on often keeps its real source and extra explanation in the **thread** (the author's follow-up posts) and the **replies** — "repo in the post below 👇", a 🧵 whose later posts carry the paper, or "source in the replies". Read them through the fxtwitter mirror (no auth):
- author's continuation posts: `curl -s "https://api.fxtwitter.com/2/thread/<POST_ID>"` → its `thread` array
- first page of replies: `curl -s "https://api.fxtwitter.com/2/conversation/<POST_ID>"` → its `replies` array

Each post object has `text`, `raw_text.facets` (t.co links expanded to `replacement`), and `quote`. Pull paper/repo links (arxiv.org, github.com, huggingface.co, `*.github.io`, openreview, modelscope) from there. A link someone **else** replied with is a lead to confirm, not a source to trust. Your task message already lists the sources the lead found this way; read the thread yourself if any is thin.

## Rules
- Verify every number against the paper, code, config or card. Never invent one.
- If a claim cannot be checked, say so in the article.
- Do not execute code from third-party repositories. Reading it is fine, and cloning with `git clone --depth 1` is fine.
  - curl to github.com is blocked, but `git clone` and `raw.githubusercontent.com` work.
  - Hugging Face works with curl and HTTP range requests, e.g. read safetensors headers without downloading the weights.
  - Any exception is stated in your task message.
- Do not edit `data/.generated/*`, other articles, the engine, shared components or `pronounce.json`.
- `<ModelCard repo=…>` and `<RepoCard repo=…>` are allowed.
  - To check a card, run `nice -n 19 pnpm fetch:models <id>`, or `pnpm fetch:repos <owner/name> --clone-only --clones-dir=<dir>`.
  - Then revert `data/.generated/` with `git checkout data/.generated` before committing. The lead fetches the cards.

## Validate
All of these must pass:
- `pnpm typecheck`
- `pnpm validate:content`
- `pnpm validate:mdx`
- `pnpm validate:math`
- `pnpm validate:placeholders`
- `pnpm validate:links`
- `pnpm validate:assets`
- `pnpm validate:films --storyboards --only=<slug>`
- eslint on your component folder
- `pnpm check:links:external --internal-only`

Do not run `pnpm build` or `pnpm dev`.

`validate:models` / `check:models` / `check:repos` will say a new card is missing from the snapshot; that is expected, so name it in your report.

## Commit
Commit on `art/<slug>` with a message ending in:
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01LhELW9PoZpU2rQ7AcDGuQV

Do not push.

## Report back (concise)
- Slug and title.
- 5–8 findings, each labelled measured, reported or reasoned.
- Figures and their sources.
- Components.
- Any ModelCard/RepoCard ids to fetch.
- Validation results.
- Anything unverified.
