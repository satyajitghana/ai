// fetch-reposts.mts — what Satyajit reposted on X that the site has not handled yet.
//
// Links he wants written up arrive as reposts on https://x.com/thesudoer_. This
// reads that timeline through the fxtwitter mirror API (x.com itself needs a
// login), drops every post already decided in data/reposts-ledger.json, and for
// the rest prints the text, the links, the quoted post, and which site pages
// already mention the same arXiv ids, repos or names. It suggests; the agent
// running the recheck-reposts skill decides, and records the decision so the
// next recheck skips it.
//
//   pnpm reposts                      new reposts, newest first (stops at the first
//                                     page that is entirely in the ledger)
//   pnpm reposts --pages=8 --all      ignore the ledger; read 8 pages
//   pnpm reposts --json               machine-readable
//   pnpm reposts --no-threads         skip reading each post's thread (faster)
//   pnpm reposts record --status=article --slug=trackeverything 2104004642158051563
//   pnpm reposts record --status=skip --note="meme" 2102822762662228398 …
//                                     (author, url and date come from the last scan)
//
// Statuses: article (a new article; --slug), update (an existing article gained a
// section or note; --slug), covered (the site already had it; --slug), skip (no
// article; --note says why), triaged (decided before this ledger existed).
//
// Many posts keep their substance in the thread: "repo in the post below 👇",
// "情報元はリプ欄" (the source is in the replies), a 🧵 whose second post has the
// paper. So for every new post this also reads its thread (the author's own
// continuation posts) and the first page of replies, and prints the
// continuation text and links, the author's replies that carry a link, and
// paper or repo links other people replied with. Thread links count toward the
// coverage hints like the post's own.
//
// The API returns reposts newest-repost first, but `created_at` is when the
// original was posted, not when it was reposted, so there is no date cutoff:
// paging stops at the first page whose every post is already decided.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { profile } from "../data/profile"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const LEDGER = join(ROOT, "data", "reposts-ledger.json")
// the last scan, so `record` can fill in each post's author, url and date
const LAST = join(tmpdir(), "reposts-last-scan.json")
const BASE = "https://api.fxtwitter.com/2"
const API = `${BASE}/profile`
const UA = { "User-Agent": "Mozilla/5.0 (ai.thesatyajit.com recheck-reposts)" }
const STATUSES = ["article", "update", "covered", "skip", "triaged"] as const
type Status = (typeof STATUSES)[number]

type Entry = { status: Status; slug?: string; note?: string; author: string; url: string; posted: string; decided: string }
type Ledger = { handle: string; updated: string; entries: Record<string, Entry> }

type Facet = { type?: string; original?: string; replacement?: string; display?: string }
type Post = {
  id: string
  url: string
  text?: string
  created_at?: string
  author?: { screen_name?: string; name?: string }
  raw_text?: { text?: string; facets?: Facet[] }
  quote?: Post
  media?: { all?: { type?: string; url?: string }[] }
  reposted_by?: { screen_name?: string } | null
  replying_to?: unknown
  is_note_tweet?: boolean
}

const args = process.argv.slice(2)
const opt = Object.fromEntries(
  args.filter((a) => a.startsWith("--")).map((a) => {
    const [k, ...v] = a.slice(2).split("=")
    return [k, v.length ? v.join("=") : "true"]
  }),
)
const positional = args.filter((a) => !a.startsWith("--"))
const today = new Date().toISOString().slice(0, 10)

function handle(): string {
  if (opt.handle) return opt.handle
  const m = /x\.com\/([A-Za-z0-9_]+)/.exec(profile.links.x ?? "")
  if (!m) throw new Error("no X handle: pass --handle=<name> or set profile.links.x")
  return m[1]
}

function loadLedger(h: string): Ledger {
  if (!existsSync(LEDGER)) return { handle: h, updated: today, entries: {} }
  const l = JSON.parse(readFileSync(LEDGER, "utf8")) as Ledger
  for (const [id, e] of Object.entries(l.entries)) {
    if (!/^\d+$/.test(id)) throw new Error(`ledger: "${id}" is not a post id`)
    if (!STATUSES.includes(e.status)) throw new Error(`ledger ${id}: unknown status "${e.status}"`)
    if ((e.status === "article" || e.status === "update" || e.status === "covered") && !e.slug)
      throw new Error(`ledger ${id}: status ${e.status} needs a slug`)
  }
  return l
}

function saveLedger(l: Ledger) {
  // sorted by id (ids are time-ordered), so a diff shows only what was added
  const entries = Object.fromEntries(Object.entries(l.entries).sort(([a], [b]) => (BigInt(a) < BigInt(b) ? -1 : 1)))
  writeFileSync(LEDGER, JSON.stringify({ handle: l.handle, updated: today, entries }, null, 2) + "\n")
}

async function page(h: string, cursor?: string): Promise<{ results: Post[]; next?: string }> {
  const url = `${API}/${h}/statuses${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: UA })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const d = (await res.json()) as { results?: Post[]; cursor?: { bottom?: string } }
      return { results: d.results ?? [], next: d.cursor?.bottom }
    } catch (e) {
      if (attempt === 2) throw new Error(`fxtwitter profile API failed (${url}): ${e instanceof Error ? e.message : e}`)
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt))
    }
  }
  return { results: [] }
}

// every link a post carries: its facets (t.co expanded), bare URLs in the text,
// and the same for the post it quotes
function links(p: Post): string[] {
  const out = new Set<string>()
  const add = (u?: string) => {
    if (!u || /^https?:\/\/(t\.co|pic\.x\.com)\//.test(u)) return
    if (/x\.com\/[^/]+\/status\/\d+\/(photo|video)\//.test(u)) return
    out.add(u.replace(/[).,]+$/, ""))
  }
  for (const f of p.raw_text?.facets ?? []) if (f.type === "url") add(f.replacement ?? f.original)
  for (const m of (p.raw_text?.text ?? p.text ?? "").matchAll(/https?:\/\/[^\s)]+/g)) add(m[0])
  return [...out]
}

// A post's thread: the author's continuation posts (/2/thread), and from the
// first page of replies (/2/conversation) the author's replies with a link and
// any paper or repo link someone else replied with. Best-effort: a failure
// returns nothing rather than failing the scan.
type Thread = { more: { text: string; links: string[] }[]; replies: { text: string; links: string[] }[]; others: string[] }
const PRIMARY = /^https?:\/\/([\w-]+\.)?(arxiv\.org|github\.com|huggingface\.co|openreview\.net|[\w-]+\.github\.io|modelscope\.(cn|ai))\//

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20_000) })
      if (res.ok) return (await res.json()) as Record<string, unknown>
      if (res.status === 404) return null
    } catch {}
    await new Promise((r) => setTimeout(r, 1500))
  }
  return null
}

async function thread(p: Post): Promise<Thread> {
  const author = p.author?.screen_name
  const [t, c] = await Promise.all([getJson(`${BASE}/thread/${p.id}`), getJson(`${BASE}/conversation/${p.id}`)])
  const text = (q: Post) => (q.raw_text?.text ?? q.text ?? "").replace(/https:\/\/t\.co\/\w+/g, "").trim()
  const more = ((t?.thread as Post[] | undefined) ?? [])
    .filter((q) => q.id !== p.id && q.author?.screen_name === author)
    .map((q) => ({ text: text(q), links: links(q) }))
  const seen = new Set(more.flatMap((m) => m.links))
  const replies: Thread["replies"] = []
  const others = new Set<string>()
  for (const q of (c?.replies as Post[] | undefined) ?? []) {
    const ls = links(q).filter((u) => !seen.has(u))
    if (!ls.length) continue
    if (q.author?.screen_name === author) replies.push({ text: text(q), links: ls })
    else for (const u of ls) if (PRIMARY.test(u)) others.add(u)
  }
  return { more, replies: replies.slice(0, 6), others: [...others].slice(0, 6) }
}

// content index: every MDX body once, lower-cased, for coverage hints
let INDEX: { path: string; text: string }[] | null = null
function index() {
  if (INDEX) return INDEX
  const files: string[] = []
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (f.endsWith(".mdx")) files.push(p)
    }
  }
  walk(join(ROOT, "content"))
  INDEX = files.map((p) => ({ path: relative(join(ROOT, "content"), p).replace(/\.mdx$/, ""), text: readFileSync(p, "utf8").toLowerCase() }))
  return INDEX
}

// Keys worth searching the site for. Strong: arXiv ids and Hugging Face / GitHub
// repos from the links. Weak: distinctive names in the text (CamelCase, digits or
// hyphens: TrackEverything, Julia-1, Qwen3.8-27B). A weak name the site already
// uses on more than COMMON pages (WebGPU, OpenAI) says nothing about this post.
const COMMON = 12
const GENERIC = new Set(["neurips", "iclr", "icml", "cvpr", "iccv", "eccv", "acl", "emnlp", "webgpu", "openai", "github", "huggingface", "arxiv"])
function keys(p: Post, extra: string[] = []): { key: string; strong: boolean }[] {
  const k = new Map<string, boolean>()
  const all = [...links(p), ...(p.quote ? links(p.quote) : []), ...extra]
  for (const u of all) {
    const ax = /arxiv\.org\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5})/.exec(u)
    if (ax) k.set(ax[1], true)
    const hf = /huggingface\.co\/(?:datasets\/|spaces\/)?([\w.-]+\/[\w.-]+)/.exec(u)
    if (hf && !/^(papers|blog|docs)\//.test(hf[1])) k.set(hf[1], true)
    const gh = /github\.com\/([\w.-]+\/[\w.-]+)/.exec(u)
    if (gh) k.set(gh[1].replace(/\.git$/, ""), true)
  }
  const text = `${p.text ?? ""} ${p.quote?.text ?? ""}`
  for (const m of text.matchAll(/\b[A-Za-z][A-Za-z0-9]*(?:[-.][A-Za-z0-9]+)+\b|\b[A-Z][a-z]+[A-Z][A-Za-z0-9]+\b|\b[A-Za-z]+[0-9][A-Za-z0-9]*\b/g)) {
    const w = m[0]
    if (w.length < 5 || k.has(w) || GENERIC.has(w.toLowerCase()) || /^(https?|www|x\.com|pic\.x|t\.co)/i.test(w) || /\.(com|ai|io|co|dev|org|net)$/i.test(w)) continue
    k.set(w, false)
  }
  return [...k].map(([key, strong]) => ({ key, strong })).slice(0, 16)
}

function coverage(p: Post, extra: string[] = []): { key: string; strong: boolean; pages: string[] }[] {
  const idx = index()
  const hits: { key: string; strong: boolean; pages: string[] }[] = []
  const direct = idx.filter((f) => f.text.includes(`status/${p.id}`)).map((f) => f.path)
  if (direct.length) hits.push({ key: `this post (${p.id})`, strong: true, pages: direct })
  for (const { key, strong } of keys(p, extra)) {
    const pages = idx.filter((f) => f.text.includes(key.toLowerCase())).map((f) => f.path)
    if (!pages.length || (!strong && pages.length > COMMON)) continue
    hits.push({ key, strong, pages: pages.slice(0, 6) })
  }
  return hits.sort((a, b) => Number(b.strong) - Number(a.strong))
}

function summary(p: Post, th?: Thread) {
  const extra = th ? [...th.more.flatMap((m) => m.links), ...th.replies.flatMap((r) => r.links), ...th.others] : []
  return {
    id: p.id,
    url: p.url,
    author: `@${p.author?.screen_name ?? "?"}`,
    posted: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : "",
    own: !p.reposted_by,
    text: p.raw_text?.text ?? p.text ?? "",
    links: links(p),
    media: (p.media?.all ?? []).map((m) => m.type ?? "?"),
    quote: p.quote
      ? { author: `@${p.quote.author?.screen_name ?? "?"}`, url: p.quote.url, text: p.quote.raw_text?.text ?? p.quote.text ?? "", links: links(p.quote) }
      : null,
    thread: th ?? null,
    coverage: coverage(p, extra),
  }
}

async function scan() {
  const h = handle()
  const ledger = loadLedger(h)
  const maxPages = Number(opt.pages ?? 10)
  const includeSeen = opt.all === "true"
  const fresh: Post[] = []
  let cursor: string | undefined
  let pages = 0
  for (; pages < maxPages; pages++) {
    const { results, next } = await page(h, cursor)
    if (!results.length) break
    const unseen = results.filter((p) => !ledger.entries[p.id])
    fresh.push(...(includeSeen ? results : unseen))
    // newest-repost first: a page with nothing new means everything older is done
    if (!includeSeen && unseen.length === 0) { pages++; break }
    if (!next) { pages++; break }
    cursor = next
  }
  // read every new post's thread, four at a time
  const threads = new Map<string, Thread>()
  if (opt["no-threads"] !== "true") {
    const queue = [...fresh]
    await Promise.all(Array.from({ length: 4 }, async () => {
      for (let p = queue.shift(); p; p = queue.shift()) threads.set(p.id, await thread(p))
    }))
  }
  const out = fresh.map((p) => summary(p, threads.get(p.id)))
  writeFileSync(LAST, JSON.stringify({ handle: h, posts: out }))
  if (opt.json === "true") {
    process.stdout.write(JSON.stringify({ handle: h, pages, count: out.length, posts: out }, null, 2) + "\n")
    return
  }
  console.log(`@${h}: ${out.length} post(s) not in the ledger, from ${pages} page(s) (${Object.keys(ledger.entries).length} already decided)\n`)
  for (const s of out) {
    console.log(`── ${s.id}  ${s.author}  posted ${s.posted}${s.own ? "  (own post)" : ""}`)
    console.log(`   ${s.url}`)
    console.log(s.text.split("\n").map((l) => `   │ ${l}`).join("\n"))
    if (s.quote) console.log(`   quotes ${s.quote.author}: ${s.quote.text.replace(/\s+/g, " ").slice(0, 280)}`)
    if (s.links.length) console.log(`   links: ${s.links.join("  ")}`)
    if (s.quote?.links.length) console.log(`   quote links: ${s.quote.links.join("  ")}`)
    if (s.media.length) console.log(`   media: ${s.media.join(", ")}`)
    for (const m of s.thread?.more ?? []) {
      console.log(`   thread ↳ ${m.text.replace(/\s+/g, " ").slice(0, 400)}`)
      if (m.links.length) console.log(`     thread links: ${m.links.join("  ")}`)
    }
    for (const r of s.thread?.replies ?? []) console.log(`   author reply ↳ ${r.text.replace(/\s+/g, " ").slice(0, 200)}  [${r.links.join("  ")}]`)
    if (s.thread?.others.length) console.log(`   replies link: ${s.thread.others.join("  ")}`)
    if (!s.coverage.length) console.log("   on the site: nothing found")
    for (const c of s.coverage) console.log(`   on the site ${c.strong ? "(link)" : "(name)"}: ${c.key} → ${c.pages.join(", ")}`)
    console.log()
  }
}

function record() {
  const h = handle()
  const ledger = loadLedger(h)
  const status = opt.status as Status
  if (!STATUSES.includes(status)) throw new Error(`record: --status must be one of ${STATUSES.join(", ")}`)
  if ((status === "article" || status === "update" || status === "covered") && !opt.slug) throw new Error(`record: --status=${status} needs --slug`)
  if (status === "skip" && !opt.note) throw new Error("record: --status=skip needs --note saying why")
  const ids = positional.slice(1)
  if (!ids.length) throw new Error("record: give one or more post ids")
  const src = opt.from ?? LAST
  const cache = existsSync(src) ? (JSON.parse(readFileSync(src, "utf8")) as { posts: ReturnType<typeof summary>[] }).posts : []
  for (const id of ids) {
    if (!/^\d+$/.test(id)) throw new Error(`record: "${id}" is not a post id`)
    const s = cache.find((p) => p.id === id)
    const prev = ledger.entries[id]
    ledger.entries[id] = {
      status,
      ...(opt.slug ? { slug: opt.slug } : {}),
      ...(opt.note ? { note: opt.note } : {}),
      author: s?.author ?? prev?.author ?? "",
      url: s?.url ?? prev?.url ?? `https://x.com/i/status/${id}`,
      posted: s?.posted ?? prev?.posted ?? "",
      decided: today,
    }
  }
  saveLedger(ledger)
  console.log(`recorded ${ids.length} post(s) as ${status}${opt.slug ? ` → ${opt.slug}` : ""}`)
}

;(positional[0] === "record" ? Promise.resolve(record()) : scan()).catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
