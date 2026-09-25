# CLAUDE.md — ai.thesatyajit.com

The agent map for this repo. An **AI-native personal site** (Next.js 16, App Router) whose content is authored and maintained by a crew of Claude agents. You don't hand-edit the site — you launch a skill/agent, it writes a correctly-shaped file, self-validates, and ships a PR.

> Next.js note: this is a pre-release Next.js with breaking changes — read the relevant guide in `node_modules/next/dist/docs/` before writing app/router code (see `AGENTS.md`).

## Architecture
- `app/**` — Next.js App Router pages + route handlers (`/api/*`, `llms.txt`, `feed.xml`, JSON-LD, MCP).
- `lib/content/` — the content layer. `schema.ts` = Zod frontmatter schemas; `index.ts` = loaders that validate every MDX file (throws loudly on bad frontmatter).
- `content/**` — MDX content (blog, logs, projects, papers, snippets, notes).
- `data/*.ts` — typed, hand-curated records (profile, resume, etc.) — single sources of truth for pages, `/api/*`, JSON-LD, the resume PDF, and `llms.txt`.
- `scripts/` — `validate-content.mts` (the safety net), `build-resume-pdf.mts`, `fetch-arxiv.mts` (arXiv candidate fetcher — dedups against ids already in `content/arxiv/`, and anchors its date window to arXiv's newest returned paper so a fast local clock never empties the results).
- `brand-crew/` — the installable plugin: `skills/`, `commands/`, `agents/`, `hooks/`, `brand/voice.md` (the brand DNA every author reads), `.claude-plugin/plugin.json`. Two skills are vendored rather than ours — `skills/hand-drawn-canvas-animation/` (MIT, Alexey Fateev) and `skills/claude-animation-base/` (MIT, John Heibel); each `VENDORED.md` gives the upstream commit and the local deltas.
- `data/.generated/` — machine-written snapshots, never hand-edited. `model-cards.json` and `repo-cards.json` back `<ModelCard repo="owner/name" />` and `<RepoCard repo="owner/name" />`: a model's or a repository's own facts, committed rather than fetched at render time so the numbers land in a PR diff and get reviewed like any other content, and so a published page stays pinned to the date — and, for a repo, the commit — the card displays instead of silently restating itself whenever someone pushes upstream.
- `lib/media.ts` — `mediaUrl()`: every film, poster and thumbnail URL goes through it. Empty `NEXT_PUBLIC_MEDIA_BASE` = served from `public/` by Vercel's CDN (committed to GitHub); set it to move them to a media CDN (the plan is Cloudflare R2 at `media.thesatyajit.com`). Page analytics is Cloudflare Web Analytics, a beacon in `app/layout.tsx` that renders only when `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` is set.
- `plans/` — `00-ai-site-master-plan.md` (the site), `01-brand-crew.md` (the crew), `02-seo.md`, and `03-media-analytics-distribution.md` (media CDN, analytics, approval-gated auto-posting with a posted-ledger, backlinks). Read these for the full design.

## Content-layer contract
Every content kind is an `.mdx` file under `content/<kind>/`. Frontmatter is Zod-validated by `lib/content/schema.ts`; a malformed file fails `pnpm validate` and the build. The slug is the filename minus `.mdx`, and it is the URL (`/<kind>/<slug>`).

| Kind | File naming | Required frontmatter | Notes |
|---|---|---|---|
| **blog** | `content/blog/<slug>.mdx` | `title, description, date` (+ `tags[]`, `draft`, `updated?`, `cover?`) | `<slug>` kebab-case, no date prefix. `draft: true` hides it. |
| **articles** | `content/articles/<slug>.mdx` | `title, description, date` (+ `tags[]`, `draft`, `updated?`, `cover?`) | Long-form flagship explainers (usually one paper). Same frontmatter as blog. **Must combine original interactive components _and_ real figures from the paper** — see "Article production standard" below. |
| **logs** | `content/logs/YYYY-MM-DD-slug.mdx` | `date` (+ `title?`, `tags[]`) | Dated daily build log; `date` matches the filename prefix. |
| **projects** | `content/projects/<slug>.mdx` | `title, description, date` (+ `stack[]`, `repo?`, `demo?`, `featured`, `cover?`) | `repo`/`demo` must be URLs. |
| **papers** | `content/papers/YYYY-MM-DD.mdx` | `date` + `papers[]` (≥1) | Daily arXiv digest; **filename === date** (validator enforces `slug === date`). Each entry: `arxivId, title, authors[], categories[], abstract, take, standout`. Links are **derived** from `arxivId` (`paperLinks()`); **no PDFs stored**. |
| **snippets** | `content/snippets/<slug>.mdx` | `title, date, lang` (+ `description?`, `tags[]`) | Small copy-paste code (`lang`: cuda/python/cpp/bash). |
| **notes** | `content/notes/<slug>.mdx` | `title, date` (+ `tags[]`, `updated?`) | Digital-garden, interlinked with `[[wikilinks]]` (target = note slug). |

Dates are `YYYY-MM-DD`. MDX body may use `<Callout type="tip|note|warning">`, fenced code (rehype-pretty-code), and KaTeX math.

## Article production standard (`content/articles/*`)
A flagship article is **not** interactives-only and **not** a wall of prose. Every paper-backed article ships **both**:
1. **Original interactive components** — the house style. Custom SSR/zero-JS `"use client"` widgets (e.g. `BenchBars`, animated diagrams) in `components/articles/<slug>/`, imported per-MDX. These are our *explanation* of the mechanism.
2. **Real figures from the source paper** — the architecture/method diagram **and** the headline benchmark/results figure(s). These are the paper's *own* evidence; readers want to see the actual figure, not only our redrawing.

Rules for paper figures:
- **Serve assets locally.** Download the figure and commit it to `public/articles/<slug>/figN.png`; reference it as `/articles/<slug>/figN.png`. **Never hotlink** arXiv/other hosts.
- **Embed with `<Figure src alt caption />`** (globally registered — no import). Every `caption` ends with attribution: `(paper, Figure N).` Write a real `alt` for screen readers.
- **Flatten transparent figures onto white** before committing (many arXiv figures are transparent RGBA and vanish in dark mode) and cap width ~1600px. PIL: `bg=Image.new('RGBA',im.size,(255,255,255,255)); bg.alpha_composite(im.convert('RGBA'))`.
- **Pick the important ones** (usually 1–3): the method/architecture diagram + the key quantitative result. Skip decorative, appendix, and pure-text-table figures. Interactives and paper figures are complementary — keep both even when they overlap.
- Fetch figures from `arxiv.org/html/<id>vN/…` (or `ar5iv.labs.arxiv.org/html/<id>` when arXiv HTML 404s). Figures are treated as academic/commentary use. (This is the one exception to papers' "no PDFs/assets stored" rule — that rule governs the daily **digest**, not flagship articles.)

## Article films (`public/articles/<slug>/*-film.*`)
Some articles open with a short film. Hand-drawn ones are built with the vendored **hand-drawn-canvas-animation** skill (`brand-crew/skills/hand-drawn-canvas-animation/`, read its `VENDORED.md` first), rendered outside the Next.js tree, and **only the output is committed** — an `.mp4`, a `.webm` and a `-poster.jpg`, never the `.html` source. Embed with `<Video src poster alt caption />` (globally registered), where `src` omits the extension.

- **Look at the contact sheet before the full render** (`node render.mjs film.html --grid 28`). Layout collisions — a label under a caption rule, a grid running off-frame — are obvious there and invisible in code.
- **Derive geometry, don't eyeball it.** Arrows that start near a hand instead of at it, and stacks that don't share a centre line with the character pointing at them, are the tell. Compute the anchor position from the puppet's own body plan and lay everything off it.
- **Compress before committing.** The player is `muted` + `loop`, so drop the audio track; x264 `-crf 33 -tune animation` and VP9 `-crf 46` are invisible on flat vector art. The `.webm` is listed first in `<Video>`, so that is the file most browsers fetch — it is the one that has to be small.
- **Narration is opt-in and changes the player.** A film with a voice track passes `narrated` to `<Video>`, which swaps autoplay-loop-muted for `controls` — browsers only autoplay muted, so a narrated film that autoplays is silent, and one that loops is rude. A narrated film also ships a WebVTT `captions` track; narration without captions is an accessibility regression. Voiced on CPU with **Kokoro-82M** (Piper is available for a draft but sounds it), one wav per beat, placed at its scene offset with a ~0.3s lead so the cut lands before the voice. Write the beat, then set the scene's `dur` to fit the speech — not the reverse — and keep ~0.25s of headroom on Kokoro, ~0.5s on Piper, which is stochastic and drifts up to 0.42s between runs. Spell initialisms out for the synth (`R L C D`) and map them back for the caption track, or the spelling hack ends up on screen.
- **Manim is the other option, for a film that is arithmetic rather than argument.** Community Edition renders on CPU; it needs `libcairo2-dev libpango1.0-dev` and a LaTeX with `dvisvgm` for `MathTex`. Same narration pipeline: instrument the scene to print `self.renderer.time` per act, then write beats whose durations match those boundaries.
- **The caption must say what the film is not.** These are drawn explanations, not recordings: if a film shows a distribution or a benchmark, the caption states plainly that the figures are illustrative and points at where the measured numbers are.

## Explainer films and thumbnails (`data/films/`, `public/films/`, `public/thumbs/`)
Every article has an **explainer storyboard**, and from it two things are painted: a **thumbnail** for every article, and a 60-110 s narrated **film** for a chosen set. A film explains how the article's subject works — the architecture, the technique, what is new — not what is wrong with it: a title, the one-sentence idea, one to three mechanism scenes (a diagram that builds as the narrator names its parts while packets flow along its edges, a layer stack, a process, an attention-style grid, an equation term by term, the usual way vs this one), at most two number scenes, a takeaway and a recap. The article's evaluation gets one scene at most. These are separate from the hand-drawn article films above.

- **You write a storyboard, not code.** `data/films/<slug>.json`; the contract — scene types, word limits, narration budget, styles, the host, truth rules — is `brand-crew/skills/explainer-films/SKILL.md`. Eighteen styles, each with its own ground, line, type, transition and score: watercolour, chalkboard, blueprint, neon, notebook, riso, pixel, and eleven drawing media (crayon, pastel, ballpoint, pencil, marker, charcoal, sumi, engraving, stipple, calligraphy, spray). Every film has its **own host**: a cat, dog, fox, bunny, capybara or fish with its own name, fur, ears, hat, glasses, outfit and prop, presenting big from the right of the frame, cropped by the bottom edge (no stage). Not Clawd.
- **The film is held to the article.** `pnpm validate:films` fails if a storyboard has no mechanism scene, if a digit a viewer sees or hears is absent from the article's MDX, if a key figure does not sit near a word from its own label, if a quote is not verbatim, if diagram nodes overlap or crowd the host, if narration runs past its budget, if two films share a host's name or look, if any article has no storyboard or thumbnail, or if a film or thumbnail is **stale** against the storyboard, the article's date and the engine (hashed into `data/.generated/films.json` and `thumbs.json`).
- **Edit an article → update its storyboard → re-render.** `node brand-crew/skills/explainer-films/build.mjs --thumbs <slug>` for the thumbnail; `build.mjs <slug>` (or `--stale`) for a film: Kokoro-82M voices every beat on CPU (cached by text), the frames are painted in headless Chromium, `audio.py` places each line on its beat, synthesizes an effect for every cue and the style's score, and writes `public/films/<slug>.mp4` (960x540 H.264 + AAC), `.vtt` captions and `-poster.webp`. `--social --out=drafts/films` renders a 1280x720 cut for `/amplify`, not committed.
- **On the page:** the thumbnail sits faint behind the article's title (`app/articles/[slug]/page.tsx`) and behind the title in its OG image (the OG route reads it at build; `*.jpg` never reaches a function). The film (`components/site/article-film.tsx`) is ambient by default — muted, looping, playing only while on screen; **sound on** restarts it with narration and captions and plays once; never autoplays under `prefers-reduced-motion`; always has a pause; native controls without JS. Its transcript is on the page and in the article's `VideoObject`, and the film is `og:video`. Pages read only the manifests, never `public/` via `fs`.
- **The painter comes from a vendored skill.** `brand-crew/skills/claude-animation-base/` is John Heibel's Claude Animation Base (MIT, see its `VENDORED.md`): a guide to timing and animation principles worth reading before any bespoke short. `explainer-films/engine/paint.js` re-implements its drawing API in Canvas2D (~0.1 s a frame with no GPU instead of 44-91 s).
- **Twelve styles are real p5.brush, painted once and reused.** `engine/brushbake.js` paints each shape and line with the vendored p5.brush (`engine/vendor/`, MIT, one local patch noted at its head) on WebGL2, keeps the painting keyed by its geometry, and lays it down with `multiply` (or, for a pigment that covers, un-mixed into alpha); fades and reveals reuse it. The host's outline is its traced silhouette inked in p5.brush every drawing. `render.mjs` runs WebGL on Mesa llvmpipe through a private Xvfb (about 7x faster bakes than SwiftShader) and falls back to SwiftShader; it checks which one it got rather than assuming. Readability is measured, not assumed: a fill is judged by the colour it actually lands at (`PB.landed`, from grey swatches per medium), and `pnpm validate:films` sizes diagram nodes from each style's real glyph widths (`metrics.json`, rewritten by `node render.mjs metrics` after a font change).
- **Motion is the engine's, not the storyboard's** (SKILL.md, "Motion"): drawings on twos with the linework boiling, every frame painted and shutter-blurred where things move, arrivals that come into focus, a camera that punches in on each beat and holds, cuts snapped to the score's beat, and a recap that replays the film's own diagrams. Motion blur averages several paints per frame, so a film paints 2-3x slower than on twos.
- **Budget:** ~40-60 KB per thumbnail; ~1.5-2.5 MB per film. Encoder settings were chosen by measurement (see `render.mjs` and `audio.py`).

## Discoverability (`lib/jsonld.tsx`, `lib/related.ts`)
The technical SEO surface is already comprehensive — JSON-LD throughout, a `Person` entity with `sameAs` and `knowsAbout`, `@id` entity references, `BreadcrumbList`, `dateModified`, per-route OG images, `llms.txt`, `.md` twins and permissive AI-crawler directives. **Audit before adding to it**; a `knowsAbout` block was once added that already existed and was better scoped.

Two things are load-bearing and easy to break:

- **Articles emit `citation`.** `citationsFromBody()` pulls arXiv abstract pages, DOIs, GitHub and Hugging Face repos out of the body — deduplicated, capped at 20, order-stable so the JSON-LD does not churn between builds. 213 of 252 articles carry at least one. This is the most relevant signal the site has: an answer engine deciding whether a page is grounded reads the citation graph, not the prose. Articles are `TechArticle`, not `Article`.
- **Every article gets `<RelatedArticles>`, and no article is an orphan.** The plan lives in `lib/related.ts` and is computed once per build over the whole corpus, because coverage is a property of the graph and ranking is per-page. Pass one is tag overlap, Jaccard-scored so a five-tag article cannot out-rank a tight pair by having more tags to collide on, tie-broken by recency. That alone took orphans from 122 to 20 — the recency tie-break piles the same recent hubs onto many lists (the busiest takes 40 inbound) and starves the tail. Pass two places each remaining orphan on the page it matches best, with deterministic tie-breaks so the HTML does not churn between builds. Result: in-degree min 1 / median 5. `pnpm validate:links` fails if that ever regresses — which it can only do when an article shares no tag with anything else, and the fix is a tag. The anchor text is the target's own title: descriptive and unique per target. Never "read more".

What none of this fixes is **backlinks**, which come from other people citing the work. The lever there is `/amplify` plus Satyajit's approval, not markup.

## data/*.ts records (typed, hand-curated)
`profile` (identity + `seedStats`), `resume` (feeds `/resume`, the PDF, `/resume.json`), `publications`, `patents`, `health` (Zod-validated **inline** at import — bad edit throws), `now` (bump `updated`), `uses`, `reading`, `interests` (arXiv categories + keyword weights driving the digest). Edit through the skills below; `pnpm typecheck` catches shape errors.

## How to add X (one-liners → the skill / command)
- New blog post → `/blog` (**new-post**) → `content/blog/<slug>.mdx`
- Daily log → `/log` (**new-log**) → `content/logs/<today>-<slug>.mdx`
- Project page → `/project <repo-url>` (**new-project**)
- Daily arXiv digest → `/papers` (**add-papers-digest**) — runs `scripts/fetch-arxiv.mts`, curates, writes `content/papers/<date>.mdx`
- Code snippet → `/snippet` (**add-snippet**); note → `/note` (**new-note**)
- /now or /uses → `/me` (**update-now** / **update-uses**)
- /reading entry → `/read` (**add-reading**)
- Publication / patent → `/pub` (**add-publication** / **add-patent**)
- Health panel → `/health` (**update-health**)
- Refresh GitHub seed stats → `/refresh` (**refresh-seed-stats**)
- Cross-platform social drafts → `/amplify` (**amplify**) → `drafts/<date>/…`
- An article's explainer film and thumbnail → `/film <slug>` (**explainer-films**) → `data/films/<slug>.json` + `public/thumbs/<slug>.jpg` (+ `public/films/<slug>.mp4` for filmed articles)
- A bespoke painted short → **claude-animation-base** (vendored; read its `ANIMATION_GUIDE.md`)

## Commands
- `pnpm dev` — dev server · `pnpm build` — production build · `pnpm start` — serve build
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm validate:content` — load every MDX through the Zod content layer (loud failure)
- `pnpm validate:mdx` — **compile** every MDX body the way the build does (same remark plugins), so JSX/MDX syntax errors fail here instead of at the Vercel build
- `pnpm validate:math` — parse every MDX with the build's remark stack and report any `$…$` span that reads like English rather than like math (two literal dollar signs pairing up — see the guardrail below)
- `pnpm validate:placeholders` — read the prose of every MDX file (frontmatter description included) and the reader-visible text of every `components/articles/**/*.tsx`, and fail on a placeholder token nobody substituted — `RUN2_PERMS`, `COMP_MEDIAN`, `TBD`, a `TODO:` with an instruction after it. An article once shipped with four of those in published prose because its author was still measuring; every other check passed on it. Legitimate ALL_CAPS is everywhere here (`Q4_K_M`, `F8_E4M3`, `AGENT_BACKEND`, `W_U`), and it is the same *shape* as a placeholder, so the test is not shape but whether the corpus ever **shows** the token — in a code fence, in backticks, in a JSX attribute, in a URL. A name that only ever appears in running prose, nowhere in any code, is a value that does not exist yet
- `pnpm validate:links` — assert no article is an orphan (see "Discoverability"), and print the in-degree spread
- `pnpm validate:assets` — assert every `<Figure src>`, `<Video src>`, `poster` and `captions` path resolves to a committed file under `public/`. A broken `src` passes every other check and ships an empty box; asset directories need not match the slug (`/articles/fastlio2/` serves `fast-lio2-lidar-inertial-odometry`), so it resolves the literal path rather than guessing one
- `pnpm fetch:models` / `pnpm check:models` — refresh, and verify, the `<ModelCard>` snapshot (`data/.generated/model-cards.json`). The repo list is derived from the `<ModelCard repo=…>` tags in `content/**.mdx`, so adding a card and re-running is the whole workflow.
- `pnpm fetch:repos` / `pnpm check:repos` — the same for `<RepoCard>` (`data/.generated/repo-cards.json`), with **two sources**: the GitHub REST API (conditional ETag requests, `GITHUB_TOKEN` when there is one), or — when the API is unreachable, which is the usual case in an agent sandbox — a **local clone** at `../<owner>/<name>`, which yields the pinned commit and its date, the licence parsed from the licence file (conservatively: `custom`, never a guess), the tracked file count, a language breakdown and whether tests exist. That is what the author of the article actually read. Each field records which source it came from and when, and the card says so. `--clones` snapshots every clone sitting beside this checkout; `--clone-only` / `--api-only` / `--force` pin the behaviour.
- `pnpm validate:films [--storyboards] [--only=slug,…]` — hold every explainer storyboard to its article (a mechanism scene, numbers, quotes, label proximity, diagram layout, narration budget, unique hosts) and every rendered film and thumbnail to its storyboard and the engine (freshness hash, files present). `--storyboards` skips the render checks while authoring
- `pnpm validate` — `typecheck` + `validate:content` + `validate:mdx` + `validate:math` + `validate:placeholders` + `validate:links` + `validate:assets` + `validate:films` + `check:models` + `check:repos`. **Run this after any content/data edit, before committing.**
- `pnpm check:links:external [--internal-only|--external-only]` — walks every link in `content/**`. The **internal** half is offline and strict: `](/articles/<slug>)` and friends must resolve to a real content file, an anchor (`#some-heading`) must be a heading that exists in that file, `[[wikilinks]]` in notes must hit a real note, and any other site-absolute path must be a route under `app/` (`.md` twins and `/api/v1/*` are resolved through `next.config.ts`'s rewrites). The **external** half hits the network, so only an unambiguous 404/410 fails — 403/402/429, a refused HEAD and a proxy hiccup are printed as informational, because an agent sandbox produces all of those against live pages. Requests are grouped by host so no one domain gets hammered. Two answers are worse than useless and the report says so inline: the sandbox proxy 403s **every** `github.com` URL (real repo or not — verify those through the GitHub MCP `search_repositories` with `repo:owner/name`, which is not proxied), and Hugging Face returns **401 for a missing repo exactly as for a gated one** (verify with `https://huggingface.co/api/models?author=<owner>&search=<name>`, which lists what actually exists). A URL that only ever appears inside code or inside a quoted arXiv abstract is reported but never failed — it is usually a split line, an API base or a deliberate example, and rewriting a quoted abstract would falsify the quotation. Network calls keep it outside `validate`, same as `check:spacing`; `--internal-only` is offline and cheap enough to run after any edit that adds a cross-link.
- `pnpm check:spacing [slug…]` — renders articles in a headless browser and reports words fused together at JSX element boundaries (`the restskip`). Needs `pnpm dev` running, so it is deliberately outside `validate`. Run it after writing a component with prose that wraps around inline tags. A full run needs `NODE_OPTIONS=--max-old-space-size=8192 pnpm dev` — Turbopack holds every compiled route and the default heap dies around a hundred articles in.

## Guardrails (LOCKED)
- **Never edit `data/.generated/*`** — machine-generated, off-limits.
- **Always run `pnpm validate`** before committing any content/data change; fix until green. (A plugin PostToolUse hook also auto-validates content/data edits.)
- **Everything ships via PR** with a Vercel preview — nothing auto-deploys to the site.
- **`pnpm validate` is not the build.** It typechecks and compiles MDX; it does not do static generation or output-file tracing, so it cannot catch a deploy failure. Run **`pnpm build`** before opening or updating a PR.
- **Watch the serverless function budget.** Vercel rejects any function over **250 MB uncompressed**. `/articles/[slug]` bundles every article (template-literal `import()`), so it grows with the corpus. Check the largest trace after a build:
  ```bash
  python3 -c "
  import json,os,glob
  for nft in glob.glob('.next/server/**/*.nft.json', recursive=True):
      root=os.path.dirname(os.path.abspath(nft))
      t=sum(os.path.getsize(os.path.normpath(os.path.join(root,f))) for f in json.load(open(nft)).get('files',[]) if os.path.exists(os.path.normpath(os.path.join(root,f))))
      print(f'{t/1048576:8.1f} MB  {nft}')" | sort -rn | head -5
  ```
  Two rules keep it down: content routes pair their template-literal `import()` with **`dynamicParams = false`** (the pattern the Next.js MDX guide documents), and **nothing reads `public/` with `fs` on a path the tracer can't resolve** — that pulls the whole directory into every function reachable from it.
- **Never post to social without explicit approval.** `/amplify` only drafts into `drafts/<date>/`; Satyajit reviews and approves before anything is posted.
- **No PDFs stored for papers** — paper links are derived from `arxivId`.
- **MDX prose: escape a bare `<`.** In MDX a `<` starts a JSX tag, so `<2%`, `x < 3`, `<0.5` etc. in prose break the build (`validate:content` only checks frontmatter — `validate:mdx` catches these). Write `&lt;`, or wrap the expression in `` `code` `` or `$math$`.
- **MDX prose: escape a literal `$`.** `remark-math` treats `$` like a code-span delimiter, so any two dollar signs on a page pair up: "it cost \$314 up front and \$1.02 per million" silently becomes one inline-math node reading *314 up front and*, rendered in italic serif with the dollars gone and unbreakable on narrow screens. `validate:mdx` compiles it happily — the document is valid, it just means something else. Write `\$314`. `pnpm validate:math` (inside `pnpm validate`) flags any math span that reads like English.
- **JSX prose: put spaces where a line break can't.** JSX trims every line of a text node, so a space that lands next to a newline disappears — including a *leading* space, whenever its text runs onto a further line (`<code>x</code> and then prose that wraps` renders `xand`). Use `{" "}` between the element and the text, or a leading space inside the tag (`<em> word</em>`). `pnpm check:spacing` catches what slips through.
- **Numbers that reach the DOM go through `lib/dmath`.** `Math.exp/log/pow/sin/cos/hypot/atan2` are only "implementation-dependent approximations" per spec, so Node and Chrome can differ by one ULP — enough to make an SVG coordinate serialize differently on server and client and trigger a hydration mismatch. Use the `m*` wrappers; `+ - * /`, `sqrt`, `round`, `min`, `max` are exact and fine as-is.
- Quality gate: if there's nothing meaningful to publish, no-op — never post filler.

## The crew
Specialist subagents live in `brand-crew/agents/` (read each file's frontmatter `description` for what it does + when to use it). They cover the brand lifecycle — PLAN (editor-in-chief routes requests), CREATE (blog-author, log-writer, project-curator, paper-scout, reading-curator, publications-archivist, health-ingestor, profile-keeper), POLISH (voice-editor, design-reviewer), SHIP (content-validator, agent-readiness-auditor), AMPLIFY (amplifier, social-poster), and MAINTAIN (stats-refresher, weekly-digest). Vague request? Talk to **editor-in-chief**; it routes and chains the right specialists. See `plans/01-brand-crew.md`.

## Install the crew (plugin)
```bash
claude plugin marketplace add satyajitghana/ai
claude plugin install brand-crew@satyajit-ai
```
This installs all skills, slash commands, agents, and the validate hook. Versioned with the repo; identical in Claude Code local and web.

## Social drafts (`drafts/`)

The `amplifier` agent writes platform-ready social drafts to `drafts/<YYYY-MM-DD>/<slug>/` (`x-thread.md`, `linkedin.md`, `hashnode.md`, `devto.md`). Drafts are git-tracked and reviewed in the PR. **Nothing is ever posted without Satyajit's explicit approval** — `social-poster` only acts on drafts approved in the current conversation.
