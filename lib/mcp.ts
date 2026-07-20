// Shared implementation logic for the hosted MCP server ("satyajit-ai").
// The route file (app/api/mcp/[transport]/route.ts) stays thin: it wires these
// pure-ish helpers to MCP tools. Everything here is read-only.
//
// Data sources are server-only. Some live datasets (resume, health,
// publications, patents) are built by parallel agents and may not exist yet —
// those are imported DEFENSIVELY via lazy `await import(...)` so this module
// (and the route) compiles and runs regardless of the other agents' progress.

import {
  getBlogPost,
  getBlogPosts,
  getLog,
  getLogs,
  getArxivDigest,
  getArxivDigests,
  getProject,
  getProjects,
  getSnippets,
} from "@/lib/content"
import { paperLinks } from "@/lib/content/schema"
import { searchContent } from "@/lib/search"

// ── result helpers ──────────────────────────────────────────────────────────

// MCP tools return a content array; we serialize structured payloads to JSON
// text so any client can read them. `json` is the canonical happy-path shape.
export function json(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  }
}

// A graceful, non-fatal message (e.g. a dataset isn't wired up yet, or a slug
// wasn't found). `isError` lets the client surface it without crashing.
export function notice(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    isError: true,
  }
}

// Lazily import an optional `@/data/*` (or `@/lib/*`) module that a parallel
// agent may not have created yet. Returns null instead of throwing so callers
// can degrade gracefully.
async function tryImport<T>(loader: () => Promise<T>): Promise<T | null> {
  try {
    return await loader()
  } catch {
    return null
  }
}

// ── profile ─────────────────────────────────────────────────────────────────

export async function getProfilePayload() {
  const { profile } = await import("@/data/profile")
  const interestsMod = await tryImport(() => import("@/data/interests"))
  return {
    name: profile.name,
    title: profile.title,
    company: profile.company,
    location: profile.location,
    tagline: profile.tagline,
    bio: profile.bio,
    links: profile.links,
    github: profile.github,
    seedStats: profile.seedStats,
    interests: interestsMod?.interests ?? null,
  }
}

// ── resume (defensive) ──────────────────────────────────────────────────────

export async function getResumePayload() {
  const mod = await tryImport(() => import("@/data/resume"))
  if (!mod) {
    return notice(
      "Resume is not yet available (data/resume.ts not found). Try get_profile instead."
    )
  }
  return json(mod.resume)
}

// ── projects ────────────────────────────────────────────────────────────────

export function listProjectsPayload() {
  return json(
    getProjects().map((p) => ({
      slug: p.slug,
      title: p.title,
      description: p.description,
      date: p.date,
      stack: p.stack,
      repo: p.repo,
      demo: p.demo,
      featured: p.featured,
      url: p.url,
      readingTimeMins: p.readingTimeMins,
    }))
  )
}

export function getProjectPayload(slug: string) {
  const project = getProject(slug)
  if (!project) {
    return notice(
      `No project with slug "${slug}". Use list_projects to see available slugs.`
    )
  }
  return json(project)
}

// ── posts (blog / logs) ─────────────────────────────────────────────────────

export type PostType = "blog" | "logs"

export function listPostsPayload(type: PostType, limit?: number) {
  const items = type === "blog" ? getBlogPosts() : getLogs()
  const sliced = limit && limit > 0 ? items.slice(0, limit) : items
  return json(
    sliced.map((p) => ({
      type,
      slug: p.slug,
      title: p.title ?? p.slug,
      description: "description" in p ? p.description : undefined,
      date: p.date,
      tags: p.tags,
      url: p.url,
      readingTimeMins: p.readingTimeMins,
    }))
  )
}

export function getPostPayload(type: PostType, slug: string) {
  const post = type === "blog" ? getBlogPost(slug) : getLog(slug)
  if (!post) {
    return notice(
      `No ${type} post with slug "${slug}". Use list_posts({ type: "${type}" }) to see available slugs.`
    )
  }
  return json(post)
}

// ── full-text search across all content kinds (BM25, via lib/search) ─────────

export function searchContentPayload(query: string, limit?: number) {
  const q = query.trim()
  if (!q) {
    return notice("search_content requires a non-empty query.")
  }
  const cap = limit && limit > 0 ? limit : 20
  // BM25 over contextualized chunks (lib/search.ts) — ranked, not first-substring.
  const matches = searchContent(q, cap).map((r) => ({
    kind: r.kind,
    slug: r.slug,
    title: r.title,
    url: r.url,
    section: r.field,
    snippet: r.snippet,
    score: Number(r.score.toFixed(2)),
  }))
  return json({ query, count: matches.length, matches })
}

// ── publications / patents (defensive; fall back to resume) ─────────────────

export async function listPublicationsPayload() {
  const mod = await tryImport(() => import("@/data/publications"))
  if (mod && "publications" in mod) {
    return json(mod.publications)
  }
  // Fall back to the resume's publications if the standalone dataset is absent.
  const resumeMod = await tryImport(() => import("@/data/resume"))
  if (resumeMod) {
    return json(resumeMod.resume.publications)
  }
  return notice(
    "Publications are not yet available (no data/publications.ts and no data/resume.ts)."
  )
}

export async function listPatentsPayload() {
  const mod = await tryImport(() => import("@/data/patents"))
  if (mod && "patents" in mod) {
    return json(mod.patents)
  }
  const resumeMod = await tryImport(() => import("@/data/resume"))
  if (resumeMod) {
    return json(resumeMod.resume.patents)
  }
  return notice(
    "Patents are not yet available (no data/patents.ts and no data/resume.ts)."
  )
}

// ── health (defensive; derive statuses if lib/health/status.ts exists) ───────

export async function getHealthPayload() {
  const mod = await tryImport(() => import("@/data/health"))
  if (!mod) {
    return notice(
      "Health data is not yet available (data/health.ts not found)."
    )
  }
  const { health } = mod

  const statusMod = await tryImport(() => import("@/lib/health/status"))
  const biomarkers = health.biomarkers.map((b) => ({
    ...b,
    status: statusMod ? statusMod.deriveStatus(b.value, b.optimalRange) : null,
  }))

  return json({
    panelDate: health.panelDate,
    stack: health.stack,
    biomarkers,
  })
}

// ── papers (arXiv digests) ──────────────────────────────────────────────────

export function listPapersPayload(limit?: number) {
  const digests = getArxivDigests()
  const sliced = limit && limit > 0 ? digests.slice(0, limit) : digests
  return json(
    sliced.map((d) => ({
      date: d.date,
      slug: d.slug,
      url: d.url,
      paperCount: d.papers.length,
      standoutCount: d.papers.filter((p) => p.standout).length,
      papers: d.papers.map((p) => ({
        arxivId: p.arxivId,
        title: p.title,
        standout: p.standout,
        categories: p.categories,
      })),
    }))
  )
}

export function getArxivDigestPayload(date: string) {
  const digest = getArxivDigest(date)
  if (!digest) {
    return notice(
      `No papers digest for "${date}" (slug is YYYY-MM-DD). Use list_papers to see available dates.`
    )
  }
  return json({
    date: digest.date,
    slug: digest.slug,
    url: digest.url,
    papers: digest.papers.map((p) => ({
      arxivId: p.arxivId,
      title: p.title,
      authors: p.authors,
      categories: p.categories,
      abstract: p.abstract,
      take: p.take,
      standout: p.standout,
      links: paperLinks(p.arxivId),
    })),
  })
}

// ── snippets ────────────────────────────────────────────────────────────────

export function searchSnippetsPayload(query?: string) {
  const all = getSnippets()
  const q = query?.trim().toLowerCase()
  const filtered = q
    ? all.filter((s) => {
        const hay = [
          s.title,
          s.description ?? "",
          s.lang,
          s.tags.join(" "),
          s.body,
        ]
          .join("\n")
          .toLowerCase()
        return hay.includes(q)
      })
    : all
  return json(
    filtered.map((s) => ({
      slug: s.slug,
      title: s.title,
      description: s.description,
      lang: s.lang,
      tags: s.tags,
      date: s.date,
      url: s.url,
      body: s.body,
    }))
  )
}

// ── ask_satyajit (grounded RAG answer) ──────────────────────────────────────

// Same grounded persona+corpus prompt as /api/chat and /api/ask, via the AI SDK
// (OpenAI provider). Returns `json` on success so the answer is a clean payload.
export async function askSatyajitPayload(question: string) {
  const {
    agentTools,
    AGENT_MAX_STEPS,
    buildSystemPrompt,
    chatModel,
    chatModelId,
    isChatOnline,
  } = await import("@/lib/chat")
  if (!isChatOnline()) {
    return notice(
      "Chat is offline (no GOOGLE_API_KEY configured). Use search_content + get_post to research, or read /llms-full.txt."
    )
  }

  const { generateText, stepCountIs } = await import("ai")
  const { text } = await generateText({
    model: chatModel("fast"),
    system: await buildSystemPrompt(),
    prompt: question,
    // Same small tool set as the site agent: it retrieves the pages it needs
    // rather than reasoning over a corpus stuffed into the prompt.
    tools: agentTools(),
    stopWhen: stepCountIs(AGENT_MAX_STEPS),
    maxOutputTokens: 1024,
  })

  return json({
    question,
    answer: text || "(no answer)",
    model: chatModelId("fast"),
  })
}
