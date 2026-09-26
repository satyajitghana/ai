import { readFileSync } from "node:fs"
import { join } from "node:path"

import { architectures } from "@/data/architectures"
import { profile } from "@/data/profile"
import {
  getArchitectureDoc,
  getArticle,
  getArxivDigest,
  getBlogPost,
  getLog,
  getNote,
  getProject,
  getSnippet,
  paperLinks,
} from "@/lib/content"
import { absoluteUrl } from "@/lib/site"

// Markdown serializers for the agent-facing `.md` variants. Everything an agent
// fetches goes through here, so keep output clean, complete, and self-describing.

function header(title: string, canonical: string, meta: string[] = []): string {
  return [
    `# ${title}`,
    "",
    `> ${profile.name} — ${profile.title} @ ${profile.company.name}`,
    `> canonical: ${absoluteUrl(canonical)}`,
    ...meta.map((m) => `> ${m}`),
    "",
  ].join("\n")
}

// <Receipts src="…"> renders a dataset that lives in a separate JSON file, so an
// agent reading the .md variant would otherwise get a bare path and none of the
// evidence. Expand it into a real markdown table from the same file the browser
// reads. Every other component carries its content inline in attributes (alt,
// caption, claim), which is why this is the only one that needs expanding.
//
// A missing file degrades to a plain link rather than throwing: the HTML route
// already fails the build loudly on that, and an agent asking for markdown is
// better served a URL than a 500.
interface ReceiptsColumn {
  key: string
  label: string
  align?: "left" | "right"
}
interface ReceiptsData {
  claim: string
  method?: string
  source?: string
  captured?: string
  note?: string
  columns: ReceiptsColumn[]
  rows: Record<string, string | number | boolean | null>[]
}

function receiptCell(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "yes" : "no"
  if (typeof value === "number") return value.toLocaleString("en-US")
  return String(value).replace(/\|/g, "\\|")
}

function expandReceipts(body: string): string {
  return body.replace(
    /<Receipts\s+src="([^"]+)"\s*\/>/g,
    (whole, src: string) => {
      let data: ReceiptsData
      try {
        data = JSON.parse(
          readFileSync(join(process.cwd(), "public", src), "utf8")
        ) as ReceiptsData
      } catch {
        return `> receipts: ${absoluteUrl(src)}`
      }
      const head = `| ${data.columns.map((c) => c.label).join(" | ")} |`
      const rule = `| ${data.columns
        .map((c) => (c.align === "right" ? "---:" : ":---"))
        .join(" | ")} |`
      const rows = data.rows.map(
        (r) => `| ${data.columns.map((c) => receiptCell(r[c.key])).join(" | ")} |`
      )
      return [
        `**Receipts.** ${data.claim}`,
        "",
        head,
        rule,
        ...rows,
        "",
        ...(data.note ? [data.note, ""] : []),
        ...(data.method ? [`> method: ${data.method}`] : []),
        ...(data.source ? [`> source: ${data.source}`] : []),
        ...(data.captured ? [`> captured: ${data.captured}`] : []),
        `> data: ${absoluteUrl(src)} (${data.rows.length} rows)`,
      ].join("\n")
    }
  )
}

function jsonBlock(data: unknown): string {
  return ["```json", JSON.stringify(data, null, 2), "```"].join("\n")
}

export function contentMarkdown(
  kind: string,
  slug: string
): string | undefined {
  switch (kind) {
    case "blog": {
      const post = getBlogPost(slug)
      if (!post) return undefined
      return (
        header(post.title, `/blog/${slug}`, [
          `date: ${post.date}`,
          ...(post.tags.length ? [`tags: ${post.tags.join(", ")}`] : []),
        ]) + post.body
      )
    }
    case "articles": {
      const article = getArticle(slug)
      if (!article) return undefined
      return (
        header(article.title, `/articles/${slug}`, [
          `date: ${article.date}`,
          ...(article.tags.length
            ? [`tags: ${article.tags.join(", ")}`]
            : []),
        ]) + expandReceipts(article.body)
      )
    }
    case "architectures": {
      const doc = getArchitectureDoc(slug)
      const arch = architectures.find((a) => a.slug === slug)
      if (!doc || !arch) return undefined
      return (
        header(doc.title, `/architectures/${slug}`, [
          `architecture: ${arch.name} (${arch.family}, ${arch.year})`,
          `date: ${doc.date}`,
          ...(doc.tags.length ? [`tags: ${doc.tags.join(", ")}`] : []),
          ...(arch.paper ? [`paper: ${arch.paper}`] : []),
        ]) + doc.body
      )
    }
    case "logs": {
      const log = getLog(slug)
      if (!log) return undefined
      return (
        header(log.title ?? `Log — ${log.date}`, `/logs/${slug}`, [
          `date: ${log.date}`,
        ]) + log.body
      )
    }
    case "projects": {
      const project = getProject(slug)
      if (!project) return undefined
      return (
        header(project.title, `/projects/${slug}`, [
          `stack: ${project.stack.join(", ")}`,
          ...(project.repo ? [`repo: ${project.repo}`] : []),
        ]) + project.body
      )
    }
    case "arxiv": {
      const digest = getArxivDigest(slug)
      if (!digest) return undefined
      const papers = digest.papers
        .map((p) => {
          const links = paperLinks(p.arxivId)
          return [
            `## ${p.standout ? "★ " : ""}${p.title}`,
            "",
            `- arXiv: ${p.arxivId} — [abs](${links.abs}) · [pdf](${links.pdf}) · [html](${links.html}) · [ar5iv](${links.ar5iv})`,
            `- authors: ${p.authors.join(", ")}`,
            `- categories: ${p.categories.join(", ")}`,
            "",
            `**Abstract.** ${p.abstract}`,
            "",
            `**Take.** ${p.take}`,
          ].join("\n")
        })
        .join("\n\n")
      return (
        header(`arXiv digest — ${digest.date}`, `/arxiv/${slug}`, [
          `papers: ${digest.papers.length}`,
        ]) +
        (digest.body.trim() ? digest.body.trim() + "\n\n" : "") +
        papers
      )
    }
    case "snippets": {
      const snippet = getSnippet(slug)
      if (!snippet) return undefined
      return (
        header(snippet.title, `/snippets`, [
          `lang: ${snippet.lang}`,
          `date: ${snippet.date}`,
        ]) + snippet.body
      )
    }
    case "notes": {
      const note = getNote(slug)
      if (!note) return undefined
      return (
        header(note.title, `/notes/${slug}`, [`date: ${note.date}`]) + note.body
      )
    }
    default:
      return undefined
  }
}

export async function dataPageMarkdown(
  page: string
): Promise<string | undefined> {
  switch (page) {
    // The homepage. `/` is the URL an agent tries first and the one an
    // acceptmarkdown probe checks, so it needs a markdown twin like every other
    // page — an orientation document rather than a dump, pointing at the
    // indexes that hold the actual corpus.
    case "home": {
      const { getArticles, getBlogPosts, getProjects } = await import("@/lib/content")
      const articles = getArticles().slice(0, 10)
      const posts = getBlogPosts().slice(0, 5)
      const projects = getProjects().filter((p) => p.featured).slice(0, 5)

      return (
        header(`${profile.name} — ${profile.title}`, "/") +
        [
          profile.tagline,
          "",
          ...profile.bio,
          "",
          "## When to use this site",
          "",
          "Reach for it when a task needs Satyajit Ghana's own writing, records or opinions —",
          "who he is and what he has built, what he has written about a specific model, paper or",
          "architecture, or what appeared in his dated arXiv digests. It is not a general search",
          "engine, a paper database, or a source of truth about anything outside its own content.",
          "",
          "## Agent surfaces",
          "",
          `- [/llms.txt](${absoluteUrl("/llms.txt")}) — curated index of every page`,
          `- [/llms-full.txt](${absoluteUrl("/llms-full.txt")}) — the whole corpus in one file`,
          `- [/openapi.json](${absoluteUrl("/openapi.json")}) — OpenAPI 3.1 description of the JSON API`,
          `- [/developers](${absoluteUrl("/developers")}) — API, MCP server and versioning policy`,
          `- MCP (Streamable HTTP): \`${absoluteUrl("/api/mcp/mcp")}\``,
          "- Any page has a markdown twin: append `.md`, or send `Accept: text/markdown`.",
          "",
          "## Sections",
          "",
          ...["articles", "blog", "logs", "projects", "arxiv", "notes", "snippets"].map(
            (s) => `- [/${s}](${absoluteUrl(`/${s}`)})`
          ),
          "",
          "## Latest articles",
          "",
          ...articles.map((a) => `- [${a.title}](${absoluteUrl(a.url)}) — ${a.description}`),
          "",
          "## Featured projects",
          "",
          ...projects.map((p) => `- [${p.title}](${absoluteUrl(p.url)}) — ${p.description}`),
          "",
          "## Latest posts",
          "",
          ...posts.map((p) => `- [${p.title}](${absoluteUrl(p.url)}) — ${p.description}`),
          "",
        ].join("\n")
      )
    }
    case "about": {
      return (
        header("About Satyajit Ghana", "/about") +
        [
          profile.tagline,
          "",
          ...profile.bio,
          "",
          "## Links",
          "",
          ...Object.entries(profile.links).map(([k, v]) => `- ${k}: ${v}`),
        ].join("\n")
      )
    }
    case "resume": {
      try {
        const { resume } = await import("@/data/resume")
        return (
          header("Resume — Satyajit Ghana", "/resume", [
            `pdf: ${absoluteUrl("/satyajit-ghana-resume.pdf")}`,
            `json: ${absoluteUrl("/resume.json")}`,
          ]) + jsonBlock(resume)
        )
      } catch {
        return undefined
      }
    }
    case "health": {
      try {
        const { health } = await import("@/data/health")
        const { deriveStatus } = await import("@/lib/health/status")
        const withStatus = health.biomarkers.map((b) => ({
          ...b,
          status: deriveStatus(b.value, b.optimalRange),
        }))
        return (
          header("Health — biomarker panel", "/health", [
            `panel date: ${health.panelDate}`,
          ]) + jsonBlock({ ...health, biomarkers: withStatus })
        )
      } catch {
        return undefined
      }
    }
    case "now": {
      try {
        const { now } = await import("@/data/now")
        return header("Now", "/now") + jsonBlock(now)
      } catch {
        return undefined
      }
    }
    case "uses": {
      try {
        const { uses } = await import("@/data/uses")
        return header("Uses", "/uses") + jsonBlock(uses)
      } catch {
        return undefined
      }
    }
    case "reading": {
      try {
        const { reading } = await import("@/data/reading")
        return header("Reading", "/reading") + jsonBlock(reading)
      } catch {
        return undefined
      }
    }
    default:
      return undefined
  }
}
