# ai.thesatyajit.com — AI-native personal site (master plan)

> Source: refined "ultraplan". This is the build spec for the site itself.
> Companion: `01-maintenance-crew.md` (the agents/skills/plugin that keep it updated).

## Context

Satyajit is building `ai.thesatyajit.com` — **his AI site, managed by Claude** — to replace a dead "GitHub README" homepage: who he is, what he works on, projects, GitHub stats, a from-scratch downloadable resume, a technical blog, frequent daily logs, and publications/patents. There are **two differentiators, both first-class:**
1. **Agent-native runtime** — an agent handed the URL (Claude, ChatGPT, etc.) can read, navigate, and call the live site as a tool; human visitors chat with an AI grounded in his content.
2. **Agent-operated repo** — the *codebase itself* is built to be maintained by Claude (Claude Code / web), via **Claude Skills** that author blogs, add logs, update health panels, projects, and other data, with validation that fails loudly so an agent can't corrupt the site. The site is literally "managed by Claude." See §11.

The local repo is a fresh **Next.js 16.2.6** scaffold (App Router, root `app/`, React 19, TypeScript strict, pnpm, Tailwind v4 CSS-first with OKLch tokens, shadcn/ui `radix-lyra`, Phosphor icons, `next-themes` dark mode with a `d` hotkey, currently Geist + JetBrains fonts). We build on it.

> ⚠️ **Next.js 16 differs from training data.** Build with Turbopack (default). Read `node_modules/next/dist/docs/` before touching routing/metadata/caching APIs.

### Decisions (locked)
- **Fonts:** Hanken Grotesk (display + body) + IBM Plex Mono (accent). Replace Geist/JetBrains.
- **Aesthetic:** editorial minimal, "editorial × terminal" (§9).
- **AI scope:** full stack in first build — static AI-readability **and** hosted MCP server **and** on-site RAG chat.
- **Publications/Patents:** both. Publications seeded with one verified paper + Scholar. Patents seeded (two final USPTO records).
- **Zod 4** (latest). MCP SDK `@1.26.0` accepts `^3.25 || ^4.0`; `mcp-handler@1.1.0` peers SDK+Next only.
- **Life tracking:** `/health` quantified-self dashboard (§8).

### Next.js 16 gotchas (load-bearing)
- `params`/`searchParams` are **Promises** — `await` everywhere. `npx next typegen`.
- Route handlers **uncached by default** — opt in `export const dynamic = "force-static"` or `use cache`+`cacheLife`/`cacheTag` in an extracted helper.
- `revalidateTag` needs 2nd arg: `revalidateTag("github", "max")`.
- `middleware.ts` → `proxy.ts` (nodejs-only). We avoid it (explicit `.md` routes).
- `robots.ts`/`sitemap.ts` are special statically-cached metadata handlers.
- `images.domains` deprecated → `images.remotePatterns`.
- **Velite/Contentlayer broken** under Turbopack → `@next/mdx` + custom content layer.

## 1. Content layer (single source of truth)
- Render MDX via `@next/mdx` (`@mdx-js/loader`,`@mdx-js/react`,`@types/mdx`); root `mdx-components.tsx` + `pageExtensions`; Turbopack needs remark/rehype plugins as **string names** (`remark-gfm`, `remark-math`, `rehype-slug`, `rehype-pretty-code`, `rehype-katex`).
- **MDX explainer kit** (`components/mdx/`, registered in `mdx-components.tsx`) so blog posts can embed rich/interactive content (e.g. "how transformers work"): `<Math>`/`$$…$$` (KaTeX), `<Diagram>` (Mermaid/SVG, e.g. a transformer block), `<AttentionMatrix>`, `<StepThrough>`, slider-driven `<Plot>`, `<CodeBlock>` (filename+copy), `<Callout>`, `<Figure>`, optional `<Sandbox>` (runnable). Posts may also colocate a one-off `viz.tsx`. **Interactive components MUST degrade to static SVG/prose** so `.md` variants + `llms-full.txt` keep full content for agents/no-JS (dual-native). Import KaTeX CSS in `globals.css`.
- `lib/content/` server-only, `gray-matter`+`fast-glob`, **Zod 4** (`lib/content/schema.ts`) so malformed posts fail the build. Feeds HTML pages, `.md` variants, JSON API, sitemap, `llms.txt`, MCP, chat corpus.
- `content/`: `blog/<slug>.mdx`, `logs/<YYYY-MM-DD-slug>.mdx`, `projects/<slug>.mdx`, `papers/<YYYY-MM-DD>.mdx` (daily arXiv digest). `data/`: profile, resume, publications, patents, health, now, uses, reading, interests (typed TS).

### 1b. `/papers` — arxiv-sanity-style daily digest (links only, NO stored PDFs)
- **Source:** free arXiv Atom API (`export.arxiv.org/api/query`), categories from `data/interests.ts` (cs.CV, cs.LG, cs.AI, cs.CL, cs.RO + keywords: 3D, LiDAR, point cloud, diffusion, LLM…). Fetch script: `scripts/fetch-arxiv.mts` (mechanical candidate pull + keyword scoring).
- **Curation:** the `paper-scout` agent ranks candidates against the interest profile, picks top ~5–10, writes a 1–3 sentence "take" per paper in Satyajit's voice → `content/papers/<date>.mdx` (Zod-validated frontmatter: `date`, `papers[]: { arxivId, title, authors[], categories[], abstract, take, standout? }`; body = optional daily commentary).
- **Links only:** per paper → `abs` (arxiv.org/abs/<id>), `pdf` (arxiv.org/pdf/<id>), `html` (arxiv.org/html/<id>v1, fall back to ar5iv.labs.arxiv.org/html/<id>). We never mirror PDFs.
- **Pages:** `/papers` (reverse-chron digests, arxiv-sanity-style cards, tag filter) + `/papers/[date]`. Flows to `/api/papers`, `.md` variants, llms.txt, MCP (`list_papers`/`get_papers_digest`), chat corpus — same as all content.
- **Brand flow:** standout paper → amplifier drafts X thread + LinkedIn explainer (approval-gated); if big enough → blog-author writes a full explainer blog using the MDX math/diagram kit.

## 2. AI-agent layer (full)
- `/llms.txt` + `/llms-full.txt` (force-static) + `/ai.txt` from content layer.
- `.md` variants: `app/md/[...slug]/route.ts` + `rewrites()`; pages emit `<link rel="alternate" type="text/markdown">`.
- JSON-LD via `schema-dts` (`lib/jsonld.ts`): Person+WebSite, BlogPosting, CreativeWork/SoftwareSourceCode, ScholarlyArticle.
- JSON API (force-static): `api/{profile,resume,projects,posts,posts/[slug],publications,patents,search}`.
- `robots.ts` (allow * + GPTBot/ClaudeBot/anthropic-ai/PerplexityBot/Google-Extended/CCBot + Sitemap), `sitemap.ts`, `ai.txt`.
- **MCP** `api/mcp/[transport]/route.ts` via `mcp-handler@1.1.0` (Streamable HTTP, SDK `@1.26.0`). Read-only Zod4 tools: get_profile, get_resume, list_projects, get_project, list_posts, get_post, search_content, list_publications, list_patents, get_health. Node runtime.
- **RAG chat** `api/chat/route.ts` (Node, streaming) `@anthropic-ai/sdk` `stream:true`; build-time `data/.generated/corpus.json`, keyword retrieval via `/api/search`; **prompt caching mandatory**; `ANTHROPIC_API_KEY` server-only; `components/chat/` UI.

## 3. Resume → PDF
`data/resume.ts` → HTML `/resume` + PDF. **`@react-pdf/renderer` at BUILD time** (`lib/resume/ResumeDocument.tsx`, `scripts/build-resume-pdf.mts` → `public/satyajit-ghana-resume.pdf` as `prebuild`). `@media print` fallback.

## 4. GitHub stats
`lib/github.ts` GraphQL (profile+repos+languages+contributions), `GITHUB_TOKEN`, `use cache`+`cacheLife("hours")`+`cacheTag("github")`, bust via `revalidateTag("github","max")` (Vercel Cron).

## 5. Design system / fonts
`layout.tsx`: Hanken_Grotesk + IBM_Plex_Mono via next/font/google `variable`. `globals.css @theme inline`: `--font-sans`/`--font-heading`→Hanken, `--font-mono`→IBM Plex. **Flip `@layer base html` from `font-mono` to `font-sans`.** Keep `d` hotkey dark mode.

## 6. Route tree (key)
app/: layout, page, about, resume, projects/[slug], blog/[slug], logs/[slug], papers + papers/[date], publications, patents, github, health, now, uses, reading, skills/[topic], colophon, **/opengraph-image.tsx, llms.txt, llms-full.txt, ai.txt, feed.xml, resume.json, openapi.json, robots.ts, sitemap.ts, md/[...slug], api/*, api/mcp/[transport]. public/.well-known/ai-plugin.json, humans.txt, security.txt. mdx-components.tsx, CLAUDE.md, AGENTS.md, .claude/{settings.json,skills/*,agents/*}. All `[slug]`: await params, generateStaticParams, dynamicParams=false.

## 7. Deployment (Vercel)
`prebuild` PDF; server env `ANTHROPIC_API_KEY`/`GITHUB_TOKEN`/`SITE_URL`; hourly cron revalidate; domain + `metadataBase`; `next.config.ts` withMDX+pageExtensions+remotePatterns+rewrites; no custom webpack.

## 8. `/health` biomarker dashboard (modeled on ottolab.com/u/satyajit)
- **A "Health Stack":** pill tags of devices/supplements. **B "Biomap":** treemap of biomarkers (label, value+unit, status caption when out of range), colored by category, sized by `weight`.
- `data/health.ts` (Zod4): `panelDate`, `stack:{type:"device"|"supplement";name;url?}[]`, `biomarkers:{key;label;value;unit;category;weight?;optimalRange?{min?;max?};note?}[]`. Category enum: cardiovascular|metabolic|liver_kidney|hormonal|nutritional|blood_panel|vitals → 7 OKLch tokens.
- **Status derived** (`lib/health/status.ts`): value vs optimalRange → optimal|borderline|low|elevated.
- **Treemap** via `d3-hierarchy` (`treemap()`+`treemapSquarify`) server-side → absolutely-positioned divs in aspect-ratio box.
- Manual ingestion v1; flows to `/api/health`, `/health.md`, `get_health` MCP, chat corpus. Only listed markers exposed.

## 9. Feel — "dual-native"
editorial × terminal; `md · json · mcp` chip (Open in Claude / Copy as prompt) on every page; hero = "ask my site" console; terminal/CLI mode (backtick / ⌘K) + `npx satyajitghana`; perf-first motion (View Transitions, scroll reveals, number tickers, reduced-motion); dark mode first-class; all motion = progressive enhancement over semantic SSR.

## 10. Additional pages (tiered)
**Dropped (2026-06-04):** `npx satyajitghana` terminal business card — not needed for now.
**Tier 1 additions (locked 2026-06-04):** `/snippets` (searchable copy-button snippets + MCP search; snippet-keeper skill), `/notes` digital garden (evergreen interlinked notes with [[backlinks]]; RAG fuel), `/changelog` (auto-generated from merged agent PRs — makes "managed by Claude" visible), **`ask_satyajit`** (RAG chat exposed as public MCP tool + POST /api/ask with cited answers; degrades to 503 without ANTHROPIC_API_KEY). Rejected: agent guestbook, agent-traffic panel, point-cloud hero, GitHub README auto-sync.
**No-API-key mode (locked):** site must fully build & run with zero env keys — GitHub stats render from `data/github-dummy.ts` seed when `GITHUB_TOKEN` absent; chat/ask return graceful "offline" without `ANTHROPIC_API_KEY`.
**Tier 1:** /now /uses /reading /skills/[topic] (port existing .md) ; WakaTime + now-playing widgets; chip+Open-in-Claude; dynamic OG; /resume.json (JSON Resume); RSS/Atom feed.xml; career timeline + Silver Medalist.
**Tier 2:** CP ratings; Talks & teaching; TIL microblog; giscus; vim nav; /openapi.json + /.well-known/ai-plugin.json + humans.txt + security.txt; agent activity log.

## 11–12. Agent-operated repo + subagents
See `01-maintenance-crew.md` for the full design.

## Seed data (verify; patents final)
**Profile:** Satyajit Ghana · Head of Engineering @ Inkers Technology (Bengaluru) · github.com/satyajitghana (287 repos, 958 stars, 181 followers) · linkedin.com/in/satyajitghana · medium · scholar rZCRakQAAAAJ · x:@thesudoer_
**Education:** M.S. Ramaiah Univ. of Applied Sciences — 2021, CGPA 9.78/10, Silver Medalist.
**Publications:** *Adaptive Visual Learning Using Augmented Reality and Machine Learning Techniques* — J. Computational and Theoretical Nanoscience 17(11):4952–4956, 2020. DOI 10.1166/jctn.2020.8982. Authors: Satyajit Ghana, Shikhar Singh, Aryan Jalali, Vivek Badani.
**Patents (FINAL — USPTO non-provisional, "Patent Pending"):**
1. "Method and System for Performing Structural Defect Analysis in a Structural Environment" — App 19/634,310, filed 2026-03-31, conf 7336, docket ALL.8733.USU1, IN priority 202541073783 (2025-08-02), inventors Manish Kumar Giri/Satyajit Ghana/Adit Deven Doshi, assignee Inkers Technology Pvt Ltd, claims 20 (3 indep).
2. "Data Acquisition Device" — App 19/634,339, filed 2026-03-31, conf 2970, docket ALL.8734.USU1, IN priority 202541073784 (2025-08-02), same inventors/assignee, claims 18 (1 indep).

## Implementation order
1. Foundation (fonts, MDX, content layer, shared layout) → 2. Core pages + data + GitHub stats + health → 3. Resume PDF → 4. AI-readability → 5. MCP → 6. RAG chat → 7. Extras+aesthetic (Tier 1) → 8. Agent-operated repo → 9. Subagent crew → 10. Deploy.

## Libraries
`@next/mdx @mdx-js/loader @mdx-js/react @types/mdx gray-matter fast-glob zod@^4 remark-gfm rehype-slug rehype-pretty-code schema-dts @react-pdf/renderer @anthropic-ai/sdk mcp-handler@^1.1.0 @modelcontextprotocol/sdk@^1.26.0 d3-hierarchy @types/d3-hierarchy tsx feed`. Avoid: Velite, Contentlayer, proxy.ts, images.domains, single-arg revalidateTag.

## Env (server-only)
`ANTHROPIC_API_KEY GITHUB_TOKEN SITE_URL`; Tier-1 widgets: `WAKATIME_API_KEY SPOTIFY_*`/`LASTFM_API_KEY`.

## Accepted deviations (audited 2026-06-04)
- **RAG corpus** is built at runtime from the content layer (memoized; files traced via `outputFileTracingIncludes`) instead of a build-time `data/.generated/corpus.json` — functionally equivalent, one less build step.
- **GitHub caching** uses tagged `fetch(..., { next: { revalidate: 3600, tags: ["github"] } })` instead of `use cache`/`cacheLife` — same semantics; bust via `POST /api/github/revalidate` (`revalidateTag("github","max")`).
- **/changelog** derives from `git log --no-merges` (every change ships as a PR anyway) rather than the GitHub PR API — no token needed.
- **Crew lives in `brand-crew/` plugin layout** (installable) rather than loose `.claude/skills|agents` — per the locked one-`claude plugin add` decision.
- **Math/CodeBlock MDX components** are provided by the pipeline itself (remark-math+KaTeX `$$`, rehype-pretty-code fences) rather than bespoke wrappers.
- **Stars figure corrected** 958 → 222 (verified against GitHub API, owned non-fork repos; the 958 research figure was not reproducible).
