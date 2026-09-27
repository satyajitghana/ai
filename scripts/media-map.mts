// media-map.mts: runs before `next build` (package.json prebuild) and decides,
// file by file, what the site serves from the media CDN (lib/media.ts).
//
// 1. Fetch ${NEXT_PUBLIC_MEDIA_BASE}/index.json, which media-sync uploads last,
//    after every file it lists is in the bucket: { files: { "/films/x.mp4": hash } }.
// 2. Keep an entry only if this checkout has the file and its SHA-256 starts with
//    the same 16 hex digits. A figure this commit adds or changes is not in the
//    bucket yet (or not with this content), so it stays same-origin. Write the
//    kept entries to lib/media-map.json.
// 3. On Vercel, delete the kept files from public/ so they are not copied into
//    the deployment: they are served from R2, and every deployment stores its
//    own copy of public/. Three kinds are never deleted:
//      - thumbnails, which the OG image routes read at build;
//      - any path a component names as a literal ("/articles/…"): those links
//        do not go through mediaUrl, so they must stay same-origin;
//      - anything not an image or a video (captions, the JSON that <Receipts>
//        reads, data files interactives fetch). The index never lists these.
//
// Everything degrades to same-origin: no base, no index, a network error, a
// hash mismatch. Locally it only writes the map when MEDIA_MAP=1, so a local
// build is always same-origin and the committed lib/media-map.json stays `{}`.
//
//   MEDIA_MAP=1 NEXT_PUBLIC_MEDIA_BASE=… pnpm tsx scripts/media-map.mts        # map only
//   … MEDIA_INDEX=path/to/index.json                                             # a local index
//   … --dry-run                                                                  # report what would be pruned

import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, extname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const PUBLIC = join(ROOT, "public")
const OUT = join(ROOT, "lib", "media-map.json")
const MEDIA = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif", ".mp4", ".webm"])

const onVercel = process.env.VERCEL === "1"
const dryRun = process.argv.includes("--dry-run")
const base = (process.env.NEXT_PUBLIC_MEDIA_BASE ?? "").replace(/\/+$/, "")

const log = (m: string) => console.log(`media-map: ${m}`)
const write = (map: Record<string, string>) => writeFileSync(OUT, JSON.stringify(map, null, 0) + "\n")

async function loadIndex(): Promise<Record<string, string> | null> {
  try {
    if (process.env.MEDIA_INDEX) return (JSON.parse(readFileSync(process.env.MEDIA_INDEX, "utf8")) as { files: Record<string, string> }).files
    const res = await fetch(`${base}/index.json`, { signal: AbortSignal.timeout(15_000), cache: "no-store" })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const d = (await res.json()) as { files?: Record<string, string> }
    if (!d.files || typeof d.files !== "object") throw new Error("no files in index")
    return d.files
  } catch (e) {
    log(`index unavailable (${e instanceof Error ? e.message : e}); serving everything same-origin`)
    return null
  }
}

// every "/articles/…" or "/films/…" literal in component code: served same-origin, never pruned
function literalPaths(): Set<string> {
  const out = new Set<string>()
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(tsx?|mts)$/.test(f)) for (const m of readFileSync(p, "utf8").matchAll(/["'`](\/(?:articles|films|thumbs|projects)\/[^"'`$]+)["'`]/g)) out.add(m[1])
    }
  }
  for (const d of ["components", "app", "lib"]) if (existsSync(join(ROOT, d))) walk(join(ROOT, d))
  return out
}

const sha16 = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 16)

async function main() {
  if (!onVercel && process.env.MEDIA_MAP !== "1") {
    log("local build: same-origin (set MEDIA_MAP=1 to build the map)")
    return
  }
  if (!base) {
    write({})
    log("NEXT_PUBLIC_MEDIA_BASE is unset: same-origin")
    return
  }
  const index = await loadIndex()
  if (!index) return write({})

  const map: Record<string, string> = {}
  let mismatched = 0, missing = 0
  for (const [path, hash] of Object.entries(index)) {
    if (!path.startsWith("/") || path.includes("..") || !MEDIA.has(extname(path).toLowerCase())) continue
    const file = join(PUBLIC, path)
    if (!existsSync(file)) { missing++; continue }
    if (sha16(file) !== hash) { mismatched++; continue }
    map[path] = hash
  }
  write(Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b))))
  log(`${Object.keys(map).length} of ${Object.keys(index).length} indexed files served from ${base} (${mismatched} changed here, ${missing} not in this checkout)`)

  if (!onVercel && !dryRun) return
  const keep = literalPaths()
  let pruned = 0, bytes = 0
  for (const path of Object.keys(map)) {
    if (path.startsWith("/thumbs/") || keep.has(path)) continue
    const file = join(PUBLIC, path)
    bytes += statSync(file).size
    pruned++
    if (!dryRun) rmSync(file)
  }
  log(`${dryRun ? "would leave" : "left"} ${pruned} files (${(bytes / 1048576).toFixed(1)} MB) out of the deployment; kept ${keep.size} component-literal paths and every thumbnail`)
}

main().catch((e) => {
  // never fail the build over media: same-origin is always correct
  log(`failed (${e instanceof Error ? e.message : e}); serving everything same-origin`)
  try { write({}) } catch {}
})
