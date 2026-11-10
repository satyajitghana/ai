// `pnpm media:push [path…] [--dry-run]`: upload new or changed media to R2 and
// record it in lib/media-map.json. Commit the map with the content that uses
// the files; the files themselves are gitignored (lib/media.ts).
//
// With no paths it scans public/{thumbs,films,articles}; a path may be a file
// or a folder, under public/ or as a site path ("/articles/x"). A file whose
// hash the map already holds is skipped, so re-running is cheap and safe.
//
// Credentials: an R2 API token with Object Read & Write on the bucket, as
// R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_ENDPOINT (the S3 endpoint the
// dashboard shows with the token; R2_ACCOUNT_ID works in its place). R2_BUCKET
// overrides the bucket. Objects go under ai/ only: the bucket is shared by
// every thesatyajit.com site, one top-level prefix each.
//
// Keys are the site path, so a changed file replaces the old object. Pages link
// `?v=<hash>`, and the edge caches each URL for a year, so a page already
// cached keeps its copy; prefer a new filename when changing a published
// figure, or the old URL can serve the new bytes once its cache entry expires.
import { readFileSync, statSync } from "node:fs"
import { extname, join, relative, resolve } from "node:path"

import { AwsClient } from "aws4fetch"

import { PUBLIC, ROOT, isMediaPath, loadMap, localMedia, saveMap, sha16 } from "./media-files"

const PREFIX = "ai"
const BUCKET = process.env.R2_BUCKET || "ai-thesatyajit-media"
const BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE || "https://media.thesatyajit.com/ai").replace(/\/+$/, "")
const CONCURRENCY = 8

const TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".svg": "image/svg+xml", ".avif": "image/avif", ".mp4": "video/mp4", ".webm": "video/webm",
  ".mov": "video/quicktime", ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav",
}

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const targets = args.filter((a) => !a.startsWith("--"))

function endpoint(): string | null {
  const e = process.env.R2_ENDPOINT?.trim().replace(/\/+$/, "").replace(new RegExp(`/${BUCKET}$`), "")
  if (e) return e
  if (process.env.R2_ACCOUNT_ID) return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  return null
}

// "public/articles/x", "/articles/x", "articles/x" or an absolute path → a dir or file under public/
const toDisk = (t: string) => {
  const abs = resolve(t)
  if (abs.startsWith(PUBLIC)) return abs
  return join(PUBLIC, t.replace(/^\/+/, "").replace(/^public\//, ""))
}

async function main() {
  const map = loadMap()
  const paths = localMedia(targets.length ? targets.map(toDisk) : undefined)
  const bad = targets.map(toDisk).filter((d) => { try { statSync(d); return false } catch { return true } })
  if (bad.length) throw new Error(`not found: ${bad.map((d) => relative(ROOT, d)).join(", ")}`)

  const todo = paths
    .map((path) => ({ path, file: join(PUBLIC, path), hash: sha16(join(PUBLIC, path)) }))
    .filter((f) => map[f.path] !== f.hash)
  console.log(`media:push: ${paths.length} media file(s) here, ${todo.length} new or changed`)
  if (!todo.length) return
  for (const f of todo) console.log(`  ${map[f.path] ? "changed" : "new    "}  ${f.path}`)
  if (dryRun) return

  const ep = endpoint()
  const { R2_ACCESS_KEY_ID: id, R2_SECRET_ACCESS_KEY: secret } = process.env
  if (!ep || !id || !secret) {
    console.error(
      "\nmedia:push: no R2 credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT or R2_ACCOUNT_ID).\n" +
        "Nothing was uploaded. Set them in the shell (or the cloud environment), then re-run.\n",
    )
    process.exit(1)
  }
  const r2 = new AwsClient({ accessKeyId: id, secretAccessKey: secret, service: "s3", region: "auto" })

  let done = 0
  const failed: string[] = []
  const queue = [...todo]
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      if (!isMediaPath(f.path)) continue
      const body = readFileSync(f.file)
      const res = await r2.fetch(`${ep}/${BUCKET}/${PREFIX}${f.path.split("/").map(encodeURIComponent).join("/")}`, {
        method: "PUT",
        body,
        headers: {
          "content-type": TYPES[extname(f.path).toLowerCase()] ?? "application/octet-stream",
          "cache-control": "public, max-age=31536000, immutable",
        },
      }).catch((e: unknown) => ({ ok: false, status: 0, statusText: String(e) }) as const)
      if (!res.ok) { failed.push(`${f.path} (${res.status} ${res.statusText})`); continue }
      map[f.path] = f.hash
      done++
    }
  }))
  // record what made it up even if something failed, so a re-run only retries the rest
  saveMap(map)
  console.log(`media:push: uploaded ${done} file(s) to ${BUCKET}/${PREFIX}/, served at ${BASE}; lib/media-map.json updated`)
  if (failed.length) {
    console.error(`media:push: ${failed.length} upload(s) failed:\n  ${failed.join("\n  ")}`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(`media:push: ${e instanceof Error ? e.message : e}`)
  process.exit(1)
})
