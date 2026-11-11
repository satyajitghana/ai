// `pnpm validate:media`: media lives in R2, never in git (lib/media.ts).
//
//   1. git tracks no media under public/{films,articles,projects}. Thumbnails
//      are the exception: the OG routes read them at build, so they are both
//      committed and pushed.
//   2. every media file on disk under those folders is in lib/media-map.json
//      with its current hash. One that is not was never pushed: the page links
//      it same-origin and it 404s on Vercel, where the file does not exist.
//   3. `--remote[=<ref>]`: every map entry added or changed since <ref>
//      (default origin/master) is fetched from the media CDN and hashed, so a
//      map that names an upload that never happened fails here, not in
//      production. CI runs this on every pull request (.github/workflows/media.yml).
//   4. `--html`: after `pnpm build`, no prerendered page links a media file
//      same-origin. This is the check that catches a component or MDX path that
//      skips mediaUrl, whatever shape the code takes.
//
// Runs on node's own TypeScript support (node scripts/check-media.mts), so CI
// needs no install.
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { MEDIA_MAP, PUBLIC, ROOT, TOPS, isMediaPath, localMedia, sha16 } from "./media-files"

const BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE || "https://media.thesatyajit.com/ai").replace(/\/+$/, "")
const args = process.argv.slice(2)
const remote = args.find((a) => a === "--remote" || a.startsWith("--remote="))
const html = args.includes("--html")

const problems: string[] = []
const git = (...a: string[]) => {
  const r = spawnSync("git", a, { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
  if (r.status !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr.trim()}`)
  return r.stdout
}

// 1. nothing in git that belongs in R2
const tracked = git("ls-files", "-z", ...TOPS.filter((t) => t !== "thumbs").map((t) => `public/${t}`))
  .split("\0")
  .filter(Boolean)
  .map((p) => "/" + p.slice("public/".length))
  .filter(isMediaPath)
for (const p of tracked) problems.push(`${p} is committed; media lives in R2. git rm --cached it and pnpm media:push`)

// 2. nothing on disk that was never pushed
const here = localMedia()
for (const path of here) {
  const h = sha16(join(PUBLIC, path))
  if (MEDIA_MAP[path] === h) continue
  problems.push(`${path} ${MEDIA_MAP[path] ? "changed since it was pushed" : "was never pushed"}: run pnpm media:push`)
}

// and the map itself is well formed
for (const [path, h] of Object.entries(MEDIA_MAP)) {
  if (!isMediaPath(path)) problems.push(`lib/media-map.json lists ${path}, which is not a media path`)
  if (!/^[0-9a-f]{16}$/.test(h)) problems.push(`lib/media-map.json has a bad hash for ${path}: ${h}`)
}

// 3. what the map claims is really in R2
async function checkRemote(ref: string) {
  let before: Record<string, string> = {}
  try {
    before = JSON.parse(git("show", `${ref}:lib/media-map.json`))
  } catch {
    console.log(`validate:media: no lib/media-map.json at ${ref}; checking every entry`)
  }
  const changed = Object.entries(MEDIA_MAP).filter(([p, h]) => before[p] !== h)
  const queue = [...changed]
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let e = queue.shift(); e; e = queue.shift()) {
      const [path, h] = e
      const res = await fetch(`${BASE}${path}?v=${h}`, { headers: { "user-agent": "ai.satyajit.si validate:media" } }).catch(() => null)
      if (!res?.ok) { problems.push(`${path}: the map lists it but ${BASE} returns ${res ? res.status : "a network error"}`); continue }
      const got = createHash("sha256").update(Buffer.from(await res.arrayBuffer())).digest("hex").slice(0, 16)
      if (got !== h) problems.push(`${path}: R2 has ${got}, the map says ${h}; re-run pnpm media:push`)
    }
  }))
  console.log(`validate:media: ${changed.length} map entr${changed.length === 1 ? "y" : "ies"} new since ${ref}, fetched from ${BASE}`)
}

// 4. no prerendered page links media same-origin
function checkHtml() {
  const dir = join(ROOT, ".next", "server", "app")
  if (!existsSync(dir)) { problems.push("--html needs a build: run pnpm build first"); return }
  const SAME_ORIGIN = new RegExp(`(?:src|href|poster|srcSet|content)="(/(?:${TOPS.join("|")})/[^"?#\\s]+)`, "g")
  let pages = 0
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (f.endsWith(".html")) {
        pages++
        for (const m of readFileSync(p, "utf8").matchAll(SAME_ORIGIN))
          if (isMediaPath(m[1])) problems.push(`${relative(dir, p)} links ${m[1]} same-origin; route it through mediaUrl`)
      }
    }
  }
  walk(dir)
  console.log(`validate:media: scanned ${pages} prerendered pages`)
}

async function main() {
  if (remote) await checkRemote(remote.includes("=") ? remote.split("=")[1] : "origin/master")
  if (html) checkHtml()
  const unique = [...new Set(problems)]
  if (unique.length) {
    console.error(`\n✖ validate:media: ${unique.length} problem(s)\n`)
    for (const p of unique.slice(0, 50)) console.error(`  ${p}`)
    if (unique.length > 50) console.error(`  … and ${unique.length - 50} more`)
    process.exit(1)
  }
  console.log(`✓ media OK: ${Object.keys(MEDIA_MAP).length} files in R2, none committed, ${here.length} on disk all pushed`)
}

main().catch((e) => {
  console.error(`validate:media: ${e instanceof Error ? e.message : e}`)
  process.exit(1)
})
