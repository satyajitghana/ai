// Every link in the corpus has to go somewhere. This checks that they do.
//
// Two classes, and they are not the same kind of problem:
//
//   Internal (`/articles/foo`, `[[wikilink]]`, `/uses`) — a broken one is
//   entirely our fault and is a 404 in published prose. Checked offline
//   against the content files and the `app/` route tree, and it FAILS.
//
//   External (`https://…`) — a broken one is usually someone else moving
//   their page. Checked over the network, so only an unambiguous 404/410
//   fails; 403/402/429, a refused HEAD and a proxy hiccup are reported and
//   ignored, because an agent sandbox produces all of those against perfectly
//   live pages (api.github.com 403s, x.com 402s, a lot of hosts hate HEAD).
//
// The network half is why this sits outside `pnpm validate` — same reasoning
// as `check:spacing`. Run it explicitly.
//
//   pnpm check:links:external                 both halves
//   pnpm check:links:external --internal-only offline, safe in CI
//   pnpm check:links:external --external-only just the network half
import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

// ---------------------------------------------------------------------------
// Proxy / TLS bootstrap
//
// Node's fetch ignores HTTPS_PROXY unless told otherwise, and both that switch
// and the extra CA bundle have to be set before the process starts. When we're
// behind a proxy and nobody has done it, re-exec ourselves once with the right
// environment rather than making every caller remember.
// ---------------------------------------------------------------------------
const CA_BUNDLE = "/root/.ccr/ca-bundle.crt"

function bootstrap(): void {
  if (process.env.CHECK_LINKS_BOOTSTRAPPED) return
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy
  const needsProxy = Boolean(proxy) && !process.env.NODE_USE_ENV_PROXY
  const needsCa = !process.env.NODE_EXTRA_CA_CERTS && existsSync(CA_BUNDLE)
  if (!needsProxy && !needsCa) return

  const env: Record<string, string | undefined> = {
    ...process.env,
    CHECK_LINKS_BOOTSTRAPPED: "1",
  }
  if (needsProxy) env.NODE_USE_ENV_PROXY = "1"
  if (needsCa) env.NODE_EXTRA_CA_CERTS = CA_BUNDLE
  const r = spawnSync(process.argv[0], process.argv.slice(1), {
    stdio: "inherit",
    env: env as NodeJS.ProcessEnv,
  })
  process.exit(r.status ?? 1)
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/** `code` marks a URL that came out of a fenced block or an inline `code` span. */
type Ref = { file: string; line: number; target: string; code?: boolean }

// Markdown inline link / image destination. Deliberately not a full parser:
// destinations in this corpus are plain, and a regex keeps the line number.
const MD_LINK = /\]\(\s*(<[^>]*>|[^()\s]+)(?:\s+"[^"]*")?\s*\)/g
// Bare + autolinked URLs anywhere on the line, including inside JSX props and
// fenced code. Stops at the characters that can't appear in a URL here.
const BARE_URL = /https?:\/\/[^\s)<>"'`\\|]+/g
const WIKILINK = /\[\[([^\]|[]+?)(?:\|[^\]]*)?\]\]/g
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/
// A frontmatter line whose whole value is one URL (`repo: https://…`, or a
// list item). Anything else holding a URL is prose we are quoting.
const FM_VALUE = /^\s*(?:[\w-]+:|-)\s*"?'?https?:\/\/\S+"?'?\s*$/
const FENCE = /^\s*(?:```|~~~)/

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (p.endsWith(".mdx") || p.endsWith(".md")) out.push(p)
  }
  return out
}

// rehype-slug uses github-slugger: strip markdown emphasis and inline code,
// lowercase, drop punctuation, spaces to hyphens. Repeats get `-1`, `-2`, …
function slugify(text: string): string {
  return text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_~]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[ -⁯⸀-⹿\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g, "")
    .replace(/\s/g, "-")
}

type Parsed = {
  file: string
  /** heading slugs in document order, deduped the way rehype-slug does */
  anchors: Set<string>
  internal: Ref[]
  external: Ref[]
  wiki: Ref[]
}

function parse(file: string): Parsed {
  const lines = readFileSync(file, "utf8").split("\n")
  const anchors = new Set<string>()
  const counts = new Map<string, number>()
  const internal: Ref[] = []
  const external: Ref[] = []
  const wiki: Ref[] = []
  const isNote = file.includes(join("content", "notes"))

  let inFence = false
  let inFrontmatter = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const n = i + 1

    if (i === 0 && line.trim() === "---") {
      inFrontmatter = true
      continue
    }
    if (inFrontmatter) {
      if (line.trim() === "---") inFrontmatter = false
      // A URL that IS a frontmatter value (`repo:`, `demo:`) becomes a link on
      // the page and counts as ours. A URL sitting inside a longer value does
      // not: the arXiv digests quote each paper's abstract verbatim, and those
      // abstracts advertise repositories the authors never published. Fixing
      // one would falsify the quotation, so they are reported, never failed.
      for (const m of line.matchAll(BARE_URL)) {
        const url = clean(m[0])
        if (!url || isPlaceholder(url)) continue
        external.push({ file, line: n, target: url, code: !FM_VALUE.test(line) })
      }
      continue
    }

    if (FENCE.test(line)) {
      inFence = !inFence
    }

    // URLs are collected wherever they appear, code included — but a URL in
    // code is flagged, because it is usually a fragment rather than a page: a
    // shell line-continuation cuts it in half, an API `base_url` 404s by
    // design when you GET it, and one article quotes a PyPI URL precisely
    // *because* it 404s. Those are reported, never failed.
    const spans = inlineCodeSpans(line)
    for (const m of line.matchAll(BARE_URL)) {
      const url = clean(m[0])
      if (!url || isPlaceholder(url)) continue
      const idx = m.index ?? 0
      const code = inFence || spans.some(([a, b]) => idx >= a && idx < b)
      external.push({ file, line: n, target: url, code })
    }

    if (inFence) continue

    const heading = line.match(HEADING)
    if (heading) {
      const base = slugify(heading[2])
      if (base) {
        const seen = counts.get(base) ?? 0
        counts.set(base, seen + 1)
        anchors.add(seen === 0 ? base : `${base}-${seen}`)
      }
    }

    for (const m of line.matchAll(MD_LINK)) {
      const dest = m[1].replace(/^<|>$/g, "")
      if (dest.startsWith("/") || dest.startsWith("#")) {
        internal.push({ file, line: n, target: dest })
      }
    }

    // `[[a, b]]` is a nested array literal in a dozen articles, so only notes
    // — the one kind that actually uses wikilinks — are scanned for them.
    if (isNote) {
      for (const m of line.matchAll(WIKILINK)) {
        wiki.push({ file, line: n, target: m[1].trim() })
      }
    }
  }

  return { file, anchors, internal, external, wiki }
}

/** Character ranges covered by `inline code` on one line. */
function inlineCodeSpans(line: string): [number, number][] {
  const spans: [number, number][] = []
  const re = /(`+)(?:(?!\1).)*\1/g
  for (const m of line.matchAll(re)) {
    const i = m.index ?? 0
    spans.push([i, i + m[0].length])
  }
  return spans
}

// Markdown drags trailing sentence punctuation and closing brackets into a
// bare URL; a real URL almost never ends in one of these.
function clean(url: string): string {
  return url.replace(/[.,;:!?'"*_)\]}]+$/, "")
}

function isPlaceholder(url: string): boolean {
  return (
    // template holes, and the reserved names RFC 2606/6761 set aside for docs
    /[<>{}]|\.\.\.|\$\{|YOUR_|example\.(?:com|net|org)\b|\.(?:example|invalid|test|local)(?:[/:?#]|$)|localhost|127\.0\.0\.1/i.test(
      url,
    ) || url.length < 12
  )
}

// ---------------------------------------------------------------------------
// The route table
// ---------------------------------------------------------------------------

/** Every static route in `app/`, plus the dynamic ones as a prefix list. */
function routeTable(): { statics: Set<string>; dynamics: string[] } {
  const statics = new Set<string>()
  const dynamics: string[] = []

  const visit = (dir: string, route: string) => {
    const entries = readdirSync(dir, { withFileTypes: true })
    const hasPage = entries.some(
      (e) => e.isFile() && /^(page|route)\.(tsx?|jsx?|mdx?)$/.test(e.name),
    )
    if (hasPage) {
      if (route.includes("[")) dynamics.push(route)
      else statics.add(route || "/")
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue
      // route groups `(marketing)` and private folders `_lib` add no segment
      const seg = e.name.startsWith("(") || e.name.startsWith("_") ? "" : `/${e.name}`
      visit(join(dir, e.name), route + seg)
    }
  }
  visit("app", "")
  return { statics, dynamics }
}

/** `/articles/[slug]` → does `path` sit under it? */
function matchesDynamic(path: string, pattern: string): boolean {
  const p = path.split("/").filter(Boolean)
  const q = pattern.split("/").filter(Boolean)
  for (let i = 0; i < q.length; i++) {
    if (q[i].startsWith("[...") || q[i].startsWith("[[...")) return p.length > i
    if (q[i].startsWith("[")) {
      if (p[i] === undefined) return false
      continue
    }
    if (p[i] !== q[i]) return false
  }
  return p.length === q.length
}

// ---------------------------------------------------------------------------
// Internal pass
// ---------------------------------------------------------------------------

/** `content/<dir>` backing each URL prefix that renders a content file. */
const CONTENT_ROUTES: Record<string, string> = {
  articles: "articles",
  architectures: "architectures",
  blog: "blog",
  notes: "notes",
  projects: "projects",
  logs: "logs",
  arxiv: "arxiv",
  papers: "arxiv",
}

type Problem = Ref & { why: string }

// next.config.ts rewrites. `/articles/foo.md` is the agent-facing markdown twin
// of `/articles/foo` and `/api/v1/*` is the versioned alias for `/api/*` —
// neither has a folder in `app/`, so resolve them back to what does.
const MD_TWIN_PREFIXES = [
  "blog",
  "articles",
  "architectures",
  "logs",
  "projects",
  "arxiv",
  "snippets",
  "notes",
]
const MD_TWIN_PAGES = ["about", "resume", "health", "now", "uses", "reading"]

function normalize(path: string): string {
  if (path.startsWith("/api/v1/")) return `/api/${path.slice("/api/v1/".length)}`
  if (!path.endsWith(".md")) return path
  const stem = path.slice(0, -3)
  const segs = stem.split("/").filter(Boolean)
  if (segs.length === 2 && MD_TWIN_PREFIXES.includes(segs[0])) return stem
  if (segs.length === 1 && MD_TWIN_PAGES.includes(segs[0])) return stem
  return path
}

function checkInternal(docs: Parsed[]): { problems: Problem[]; counted: number } {
  const byFile = new Map(docs.map((d) => [d.file, d]))
  const { statics, dynamics } = routeTable()
  const problems: Problem[] = []
  let counted = 0

  const slugsIn = (dir: string) =>
    existsSync(join("content", dir))
      ? new Set(
          readdirSync(join("content", dir))
            .filter((f) => f.endsWith(".mdx"))
            .map((f) => f.replace(/\.mdx$/, "")),
        )
      : new Set<string>()

  const kindSlugs = new Map<string, Set<string>>()
  for (const dir of new Set(Object.values(CONTENT_ROUTES))) {
    kindSlugs.set(dir, slugsIn(dir))
  }
  // Snippets render on one index page rather than a route per file; keep the
  // slugs so `/snippets#<slug>` still resolves.
  const snippetSlugs = slugsIn("snippets")

  const anchorsFor = (kind: string, slug: string): Set<string> | null => {
    const d = byFile.get(join("content", kind, `${slug}.mdx`))
    return d ? d.anchors : null
  }

  for (const doc of docs) {
    for (const ref of doc.internal) {
      counted++
      const [rawPath, rawHash] = ref.target.split("#")
      const hash = rawHash ? decodeURIComponent(rawHash) : ""
      const path = normalize(rawPath.split("?")[0].replace(/\/$/, ""))

      // same-page anchor
      if (!path) {
        if (hash && !doc.anchors.has(hash)) {
          problems.push({ ...ref, why: `no heading "#${hash}" in this file` })
        }
        continue
      }

      const segs = path.split("/").filter(Boolean)
      const dir = CONTENT_ROUTES[segs[0]]

      if (dir && segs.length === 2) {
        const slugs = kindSlugs.get(dir)!
        if (!slugs.has(segs[1])) {
          problems.push({ ...ref, why: `no content/${dir}/${segs[1]}.mdx` })
          continue
        }
        if (hash) {
          const anchors = anchorsFor(dir, segs[1])
          if (anchors && !anchors.has(hash)) {
            problems.push({
              ...ref,
              why: `content/${dir}/${segs[1]}.mdx has no heading "#${hash}"`,
            })
          }
        }
        continue
      }

      if (segs[0] === "snippets" && segs.length === 2) {
        if (!snippetSlugs.has(segs[1])) {
          problems.push({ ...ref, why: `no content/snippets/${segs[1]}.mdx` })
        }
        continue
      }

      // plain route: /resume, /uses, /llms.txt, …
      if (statics.has(path) || dynamics.some((d) => matchesDynamic(path, d))) {
        if (hash && segs[0] === "snippets" && !snippetSlugs.has(hash)) {
          problems.push({ ...ref, why: `no snippet "${hash}"` })
        }
        continue
      }
      // a file served straight out of public/
      if (existsSync(join("public", path))) continue

      problems.push({ ...ref, why: "no route under app/ and no file in public/" })
    }

    for (const ref of doc.wiki) {
      counted++
      const slug = ref.target.split("#")[0].trim()
      if (!kindSlugs.get("notes")!.has(slug)) {
        problems.push({ ...ref, why: `wikilink to missing note "${slug}"` })
      }
    }
  }

  return { problems, counted }
}

// ---------------------------------------------------------------------------
// External pass
// ---------------------------------------------------------------------------

type Verdict = "ok" | "broken" | "blocked" | "timeout"
type Result = { url: string; status: number | null; verdict: Verdict; note: string }

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/131.0.0.0 Safari/537.36 (+link-check; ai.thesatyajit.com)"
const TIMEOUT_MS = 10_000
const HOST_CONCURRENCY = 8
const HOST_DELAY_MS = 150

async function probe(url: string, method: "HEAD" | "GET"): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      method,
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    })
  } finally {
    clearTimeout(t)
  }
}

// Statuses that mean "this host dislikes the request", not "the page is gone".
// The sandbox proxy manufactures several of these against live pages, so they
// are informational only and never fail the run.
const BLOCKED = new Set([401, 402, 403, 405, 406, 407, 409, 418, 429, 451, 999])
const RETRY_WITH_GET = new Set([400, 403, 404, 405, 406, 409, 429, 500, 501, 502, 503])

async function check(url: string): Promise<Result> {
  let last = ""
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const res = await probe(url, method)
      // A refused HEAD looks exactly like a dead page on some hosts, so a
      // non-2xx HEAD is always re-asked as GET before anything is believed.
      if (method === "HEAD" && RETRY_WITH_GET.has(res.status)) {
        last = `HEAD ${res.status}`
        continue
      }
      if (res.status >= 200 && res.status < 400) {
        return { url, status: res.status, verdict: "ok", note: method }
      }
      if (res.status === 404 || res.status === 410) {
        return { url, status: res.status, verdict: "broken", note: method }
      }
      if (BLOCKED.has(res.status)) {
        return { url, status: res.status, verdict: "blocked", note: method }
      }
      return { url, status: res.status, verdict: "blocked", note: `${method} ${res.status}` }
    } catch (err) {
      const e = err as Error & { cause?: Error }
      const msg = e.name === "AbortError" ? "timeout" : (e.cause?.message ?? e.message)
      if (method === "HEAD") {
        last = msg
        continue
      }
      return {
        url,
        status: null,
        verdict: msg === "timeout" ? "timeout" : "blocked",
        note: last && last !== msg ? `${last} → ${msg}` : msg,
      }
    }
  }
  // HEAD asked for a GET retry and the loop fell through — shouldn't happen.
  return { url, status: null, verdict: "blocked", note: last || "unknown" }
}

// Two hosts answer in a way that hides a dead link behind a "blocked" status,
// so say so next to the result instead of letting it read as fine.
function hint(url: string, status: number | null): string {
  if (status === 401 && url.includes("huggingface.co")) {
    return "  ← HF answers 401 for gated AND missing repos; confirm with" +
      " https://huggingface.co/api/models?author=<owner>&search=<name>"
  }
  if (status === 403 && url.includes("github.com")) {
    return "  ← the sandbox proxy 403s all of github.com; unverified, not dead"
  }
  return ""
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** One queue per host, at most HOST_CONCURRENCY hosts in flight. */
async function checkAll(urls: string[], onDone: () => void): Promise<Map<string, Result>> {
  const byHost = new Map<string, string[]>()
  for (const u of urls) {
    let host: string
    try {
      host = new URL(u).host
    } catch {
      host = "?"
    }
    const list = byHost.get(host) ?? []
    list.push(u)
    byHost.set(host, list)
  }

  // Busiest hosts first, so the long tail isn't waiting on them at the end.
  const queues = [...byHost.values()].sort((a, b) => b.length - a.length)
  const out = new Map<string, Result>()
  let next = 0

  const worker = async () => {
    for (;;) {
      const i = next++
      if (i >= queues.length) return
      for (const url of queues[i]) {
        out.set(url, await check(url))
        onDone()
        await sleep(HOST_DELAY_MS)
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(HOST_CONCURRENCY, queues.length) }, worker),
  )
  return out
}

// ---------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2)
  const internalOnly = argv.includes("--internal-only")
  const externalOnly = argv.includes("--external-only")

  const docs = walk("content").map(parse)

  let failed = false

  // --- internal -----------------------------------------------------------
  if (!externalOnly) {
    const { problems, counted } = checkInternal(docs)
    if (problems.length) {
      console.error(
        `\n✖ ${problems.length} internal link(s) point at nothing.\n` +
          `  These are 404s in published prose. Fix the target or reword.\n`,
      )
      for (const p of problems) {
        console.error(`  ${p.file}:${p.line}  ${p.target}\n      ${p.why}`)
      }
      console.error("")
      failed = true
    } else {
      console.log(`✓ internal links OK — ${counted} reference(s) resolve`)
    }
  }

  // --- external -----------------------------------------------------------
  if (!internalOnly) {
    const refs = docs.flatMap((d) => d.external)
    const where = new Map<string, Ref[]>()
    for (const r of refs) {
      const list = where.get(r.target) ?? []
      list.push(r)
      where.set(r.target, list)
    }
    const urls = [...where.keys()].sort()

    process.stderr.write(
      `  checking ${urls.length} unique external URL(s) from ${refs.length} reference(s)…\n`,
    )
    let done = 0
    const tick = () => {
      done++
      if (done % 25 === 0 || done === urls.length) {
        process.stderr.write(`  …${done}/${urls.length}\n`)
      }
    }
    const results = await checkAll(urls, tick)

    const group = (v: Verdict) => urls.filter((u) => results.get(u)!.verdict === v)
    const broken = group("broken")
    const blocked = group("blocked")
    const timeouts = group("timeout")
    const ok = group("ok")

    if (blocked.length || timeouts.length) {
      console.log(
        `\nℹ ${blocked.length} blocked-by-environment, ${timeouts.length} timed out — ` +
          `informational, not failures.`,
      )
      for (const u of [...blocked, ...timeouts]) {
        const r = results.get(u)!
        console.log(`  ${r.status ?? "—"}  ${u}  (${r.note})${hint(u, r.status)}`)
      }
    }

    // A 404 only counts against us where a reader was promised a page. The
    // same status on a URL that only ever appears in code is almost always an
    // artifact of pulling it out of code in the first place.
    const inProse = (u: string) => where.get(u)!.some((r) => !r.code)
    const gone = broken.filter(inProse)
    const fragments = broken.filter((u) => !inProse(u))

    if (fragments.length) {
      console.log(
        `\nℹ ${fragments.length} 404/410 URL(s) appear only inside code — ` +
          `a split line, an API base or a deliberate example. Not failures.`,
      )
      for (const u of fragments) {
        console.log(`  ${u}`)
        for (const ref of where.get(u)!) console.log(`        ${ref.file}:${ref.line}`)
      }
    }

    if (gone.length) {
      console.error(`\n✖ ${gone.length} external link(s) in prose are gone (404/410).\n`)
      for (const u of gone) {
        const r = results.get(u)!
        console.error(`  ${r.status}  ${u}`)
        for (const ref of where.get(u)!) console.error(`        ${ref.file}:${ref.line}`)
      }
      console.error("")
      failed = true
    } else {
      console.log(`\n✓ external links OK — no 404/410 in prose among ${urls.length} URL(s)`)
    }

    console.log(
      `  ${ok.length} reachable · ${gone.length} gone · ${fragments.length} code-only 404 · ` +
        `${blocked.length} blocked · ${timeouts.length} timeout`,
    )
  }

  if (failed) process.exit(1)
}

if (!process.argv.includes("--internal-only")) bootstrap()
await main()
