import { profile } from "@/data/profile"
import {
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
        ]) + article.body
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
