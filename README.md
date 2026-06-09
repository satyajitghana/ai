# ai.thesatyajit.com

An **AI-native personal site** for Satyajit Ghana — a modern replacement for the
dead "GitHub README" homepage. Every page is **dual-native**: a clean human document
*and* a machine-readable artifact an agent can read, navigate, and call as a tool. The
content is authored and maintained by a crew of **Claude agents** (the `brand-crew`
plugin), and everything ships through a Zod-validated content layer that fails loudly.

🔗 **Live:** https://ai.thesatyajit.com

## What's here

- **Content** — blog, curated long-form **articles** (with an interactive MDX explainer
  kit: math, diagrams, step-throughs, an animated coroutine stepper), daily **logs**,
  **projects** (with screenshots), a personalized **arXiv** digest, snippets, and a
  digital-garden of notes.
- **Resume** — `/resume` (HTML) + a downloadable PDF synced from
  [github.com/satyajitghana/resume](https://github.com/satyajitghana/resume) + `/resume.json`.
- **Quantified self** — `/health` biomarker Biomap, `/github` stats, `/now`, `/uses`, `/reading`.
- **Agent layer** — `/llms.txt`, `/llms-full.txt`, per-page `.md` variants, JSON-LD,
  a JSON API (`/api/*`), an **MCP server** (`/api/mcp/mcp`), an `ask_satyajit` RAG endpoint,
  `openapi.json`, and an AI-welcoming `robots.txt`.
- **Touches** — `⌘K` terminal mode (with autosuggest), per-route OG images, share buttons,
  system-default dark mode, the `md · json · mcp` chip on every page.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · shadcn/ui ·
MDX (`@next/mdx`) + Zod content layer · Vercel AI SDK (`ai` + `@ai-sdk/google`, Gemini) ·
`mcp-handler` · Hanken Grotesk + IBM Plex Mono · Phosphor icons.

## Develop

```bash
pnpm install
pnpm dev            # http://localhost:3000

pnpm validate       # typecheck + content-layer validation (the safety net)
pnpm build          # production build (prebuild syncs the resume PDF)
pnpm lint
```

Config is via env vars — **all optional** (the site runs with none). See
[`.env.example`](./.env.example).

## Content model

Content lives in `content/<kind>/*.mdx` (blog, articles, logs, projects, arxiv, snippets,
notes), validated by `lib/content/schema.ts`. Typed records live in `data/*.ts`. A
malformed file fails `pnpm validate` and the build. See [`CLAUDE.md`](./CLAUDE.md) for the
full content contract and [`plans/`](./plans) for the design.

## The crew (brand-crew plugin)

The site maintains itself via an installable Claude plugin — skills, slash commands,
agents, and a validate hook:

```bash
claude plugin marketplace add satyajitghana/ai
claude plugin install brand-crew@satyajit-ai
```

Then `/blog`, `/article`, `/arxiv`, `/log`, `/project`, `/health`, `/amplify`, … author
on-brand content, self-validate, and ship via PR. Social is drafted, never auto-posted.

## Scripts

- `scripts/fetch-arxiv.mts` — pull + score arXiv candidates for the daily digest.
- `scripts/screenshot-projects.mts` — capture project cover screenshots via headless
  Chrome (local tool; commit the PNGs in `public/projects/`).
- `scripts/build-resume-pdf.mts` — sync the resume PDF (prebuild).

## Deploy

Vercel. Add the `ai.thesatyajit.com` domain, set any env vars you want live (see
`.env.example`), and push — Vercel runs `pnpm build` and deploys, and content regenerates
per deploy. The Zod-validated content layer is loaded during the build, so a malformed
content edit fails the deploy rather than shipping broken.
