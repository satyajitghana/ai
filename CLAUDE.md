# CLAUDE.md — ai.thesatyajit.com

The agent map for this repo. An **AI-native personal site** (Next.js 16, App Router) whose content is authored and maintained by a crew of Claude agents. You don't hand-edit the site — you launch a skill/agent, it writes a correctly-shaped file, self-validates, and ships a PR.

> Next.js note: this is a pre-release Next.js with breaking changes — read the relevant guide in `node_modules/next/dist/docs/` before writing app/router code (see `AGENTS.md`).

## Architecture
- `app/**` — Next.js App Router pages + route handlers (`/api/*`, `llms.txt`, `feed.xml`, JSON-LD, MCP).
- `lib/content/` — the content layer. `schema.ts` = Zod frontmatter schemas; `index.ts` = loaders that validate every MDX file (throws loudly on bad frontmatter).
- `content/**` — MDX content (blog, logs, projects, papers, snippets, notes).
- `data/*.ts` — typed, hand-curated records (profile, resume, etc.) — single sources of truth for pages, `/api/*`, JSON-LD, the resume PDF, and `llms.txt`.
- `scripts/` — `validate-content.mts` (the safety net), `build-resume-pdf.mts`, `fetch-arxiv.mts` (arXiv candidate fetcher).
- `brand-crew/` — the installable plugin: `skills/`, `commands/`, `agents/`, `hooks/`, `brand/voice.md` (the brand DNA every author reads), `.claude-plugin/plugin.json`.
- `plans/` — `00-ai-site-master-plan.md` (the site) and `01-brand-crew.md` (the crew). Read these for the full design.

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

## Commands
- `pnpm dev` — dev server · `pnpm build` — production build · `pnpm start` — serve build
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm validate:content` — load every MDX through the Zod content layer (loud failure)
- `pnpm validate` — `typecheck` + `validate:content`. **Run this after any content/data edit, before committing.**

## Guardrails (LOCKED)
- **Never edit `data/.generated/*`** — machine-generated, off-limits.
- **Always run `pnpm validate`** before committing any content/data change; fix until green. (A plugin PostToolUse hook also auto-validates content/data edits.)
- **Everything ships via PR** with a Vercel preview — nothing auto-deploys to the site.
- **Never post to social without explicit approval.** `/amplify` only drafts into `drafts/<date>/`; Satyajit reviews and approves before anything is posted.
- **No PDFs stored for papers** — paper links are derived from `arxivId`.
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
