"use client"

import { useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

// A port of the code that decides "mentioned" and "cited" for every tracked
// answer in OpenSEO (every-app/open-seo at deb4491):
//
//   markdownToText()  src/server/features/ai-visibility/providers/dataforseoEvidence.ts:98-123
//   aiMentionSpans()  src/server/features/ai-visibility/services/aiVisibilityMatching.ts:11-62
//   ownedAiDomain()   aiVisibilityMatching.ts:5-9
//   matchAiBrand()    aiVisibilityMatching.ts:69-81
//
// The regular expressions are copied as written. The one simplification: the
// original NFD-normalises the answer and maps spans back to UTF-16 offsets so
// accented names match either Unicode form; the presets here are plain ASCII,
// so that step is skipped and the offsets are identical.
//
// Pure function of the inputs: no randomness, no timers.

type Preset = {
  key: string
  label: string
  brand: string
  domain: string
  markdown: string
  citations: string[]
  note: string
}

const PRESETS: Preset[] = [
  {
    key: "pill",
    label: "Cited, never named",
    brand: "Bitwarden",
    domain: "bitwarden.com",
    markdown:
      "For a free option, **1Password** has no free tier, so most reviewers point to an open-source manager with unlimited devices [1] and a self-hostable server [bitwarden.com](https://bitwarden.com/help/). Proton Pass is the other common pick.",
    citations: ["https://bitwarden.com/help/", "https://www.security.org/password-manager/best/"],
    note: "The [bitwarden.com] link label is a citation pill, so markdownToText deletes it before matching. Bitwarden is cited but not mentioned.",
  },
  {
    key: "generic",
    label: "A generic name",
    brand: "Linear",
    domain: "linear.app",
    markdown:
      "Jira is the safe enterprise choice. If your process is strictly linear, a kanban board in Trello is enough, and GitHub Projects is free for open source.",
    citations: ["https://www.atlassian.com/software/jira"],
    note: "\"linear\" as an adjective matches the brand Linear: the match is case-insensitive with word boundaries and nothing else. The code comment says this is accepted for simplicity.",
  },
  {
    key: "alias",
    label: "One name per brand",
    brand: "Proton Pass",
    domain: "proton.me",
    markdown:
      "Proton's password manager is the privacy pick, and it ships with SimpleLogin aliases. Bitwarden remains the best free option.",
    citations: ["https://proton.me/pass"],
    note: "The answer means Proton Pass but never writes those two words together, so there is no mention. There is no alias list; only the brand name and the domain are searched.",
  },
  {
    key: "url",
    label: "Bare URL in prose",
    brand: "Keeper",
    domain: "keepersecurity.com",
    markdown:
      "Enterprise teams often trial https://www.keepersecurity.com/business.html before committing, though 1Password Business is more common.",
    citations: [],
    note: "URLs and email addresses are blanked before matching, so the domain inside a URL is not a mention. Keeper is neither mentioned nor cited here.",
  },
]

// ---- ported logic -------------------------------------------------------

function citationPill(label: string, url: string): boolean {
  const text = label
    .replace(/^\[|\]$/g, "")
    .trim()
    .toLowerCase()
  if (/^\d+$/.test(text)) return true
  try {
    const host = new URL(url).hostname.toLowerCase()
    return text.replace(/^www\./, "") === host.replace(/^www\./, "")
  } catch {
    return false
  }
}

function markdownToText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)\s]*\)/g, "")
    .replace(/\[((?:[^[\]]|\[[^\]]*\])*)\]\((https?:\/\/[^)\s]+)\)/g, (_m, label: string, url: string) =>
      citationPill(label, url) ? "" : label,
    )
    .replace(/\*\*|__|`/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^(\s*)[*+-]\s+/gm, "$1")
}

type Span = { start: number; end: number }

function aiMentionSpans(text: string, names: string[]): Span[] {
  const prose = text.replace(
    /(?:https?:\/\/|www\.)[^\s<>]+|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/giu,
    (value) => " ".repeat(value.length),
  )
  const found = new Map<string, Span>()
  for (const name of new Set(names.map((n) => n.trim()).filter((n) => n.length >= 2))) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
    const pattern = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])${escaped}(?![\\p{L}\\p{M}\\p{N}_])`, "giu")
    for (const match of prose.matchAll(pattern)) {
      const start = match.index ?? 0
      const end = start + match[0].length
      found.set(`${start}:${end}`, { start, end })
    }
  }
  const sorted = [...found.values()].sort((a, b) => a.start - b.start || b.end - a.end)
  return sorted.filter(
    (span, i, all) => !all.slice(0, i).some((o) => o.start <= span.start && o.end >= span.end),
  )
}

function ownedAiDomain(hostname: string, owned: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "")
  const domain = owned.toLowerCase().replace(/^www\./, "")
  return !!domain && (host === domain || host.endsWith(`.${domain}`))
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

// ---- view ---------------------------------------------------------------

function Highlighted({ text, spans }: { text: string; spans: Span[] }) {
  const parts: ReactNode[] = []
  let at = 0
  spans.forEach((s, i) => {
    if (s.start > at) parts.push(text.slice(at, s.start))
    parts.push(
      <mark key={i} className="rounded bg-emerald-500/25 px-0.5 text-inherit">
        {text.slice(s.start, s.end)}
      </mark>,
    )
    at = s.end
  })
  if (at < text.length) parts.push(text.slice(at))
  return <>{parts}</>
}

function Verdict({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "rounded-md border px-2 py-0.5 font-mono text-xs",
        ok
          ? "border-emerald-600/60 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
          : "border-border text-muted-foreground",
      )}
    >
      {label}: {ok ? "yes" : "no"}
    </span>
  )
}

export function MentionMatcher() {
  const [key, setKey] = useState(PRESETS[0].key)
  const preset = PRESETS.find((p) => p.key === key) ?? PRESETS[0]
  const [brand, setBrand] = useState(preset.brand)
  const [domain, setDomain] = useState(preset.domain)
  const [markdown, setMarkdown] = useState(preset.markdown)

  const choose = (p: Preset) => {
    setKey(p.key)
    setBrand(p.brand)
    setDomain(p.domain)
    setMarkdown(p.markdown)
  }

  const text = markdownToText(markdown)
  const spans = aiMentionSpans(text, [brand, domain])
  const hosts = preset.citations.map(hostOf).filter((h): h is string => !!h)
  const cited = hosts.some((h) => ownedAiDomain(h, domain))
  const edited = brand !== preset.brand || domain !== preset.domain || markdown !== preset.markdown

  return (
    <figure className="not-prose my-8 rounded-lg border p-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => choose(p)}
            className={cn(
              "border-border hover:bg-muted rounded-md border px-2.5 py-1 text-xs",
              key === p.key && "bg-muted font-semibold",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="text-muted-foreground">Brand name (the project name)</span>
          <input
            className="border-border bg-background mt-1 w-full rounded-md border px-2 py-1 font-mono text-xs"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Domain</span>
          <input
            className="border-border bg-background mt-1 w-full rounded-md border px-2 py-1 font-mono text-xs"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
        </label>
      </div>

      <label className="mt-3 block text-xs">
        <span className="text-muted-foreground">Answer markdown, as the scraper returns it</span>
        <textarea
          className="border-border bg-background mt-1 h-24 w-full rounded-md border px-2 py-1 font-mono text-xs"
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
        />
      </label>

      <div className="mt-3 text-xs">
        <div className="text-muted-foreground">Prose after markdownToText, with matched spans</div>
        <p className="bg-muted/40 mt-1 rounded-md p-2 leading-relaxed">
          <Highlighted text={text} spans={spans} />
        </p>
      </div>

      <div className="mt-2 text-xs">
        <span className="text-muted-foreground">Cited sources (from the answer&apos;s source list): </span>
        <span className="font-mono">{hosts.length ? hosts.join(", ") : "none"}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Verdict ok={spans.length > 0} label="mentioned" />
        <Verdict ok={cited} label="cited" />
        <span className="text-muted-foreground font-mono text-xs">
          firstMention: {spans.length ? spans[0].start : "null"}
        </span>
      </div>

      <figcaption className="text-muted-foreground mt-3 text-xs leading-relaxed">
        {edited ? "Edited input. " : ""}
        {preset.note} The source list stays the preset&apos;s; edit the domain to see the citation test change.
      </figcaption>
    </figure>
  )
}
