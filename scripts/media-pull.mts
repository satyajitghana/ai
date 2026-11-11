// `pnpm media:pull <path-prefix…> | --all`: download media from R2 into
// public/, for tools that read the files themselves (the film renderers, image
// edits). A clone has none of them (lib/media.ts), and the site never needs
// them on disk, so this only fetches what you name:
//
//   pnpm media:pull /articles/marigold-v2       one article's figures
//   pnpm media:pull /films/transformer.mp4      one file
//
// A file already on disk with the right hash is skipped; every download is
// checked against the hash in lib/media-map.json. No credentials needed: it
// reads the public CDN.
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { MEDIA_MAP, PUBLIC, sha16 } from "./media-files"

const BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE || "https://media.thesatyajit.com/ai").replace(/\/+$/, "")
const args = process.argv.slice(2)
const all = args.includes("--all")
const prefixes = args.filter((a) => !a.startsWith("--")).map((a) => "/" + a.replace(/^\/+/, "").replace(/^public\//, ""))

async function main() {
  if (!all && !prefixes.length) {
    console.error("media:pull: name what to fetch (e.g. /articles/<slug>), or --all for everything (~1.6 GB)")
    process.exit(1)
  }
  const wanted = Object.entries(MEDIA_MAP).filter(([p]) => all || prefixes.some((x) => p === x || p.startsWith(x.endsWith("/") ? x : x + "/")))
  const todo = wanted.filter(([p, h]) => !existsSync(join(PUBLIC, p)) || sha16(join(PUBLIC, p)) !== h)
  console.log(`media:pull: ${wanted.length} file(s) match, ${todo.length} to fetch`)
  const failed: string[] = []
  const queue = [...todo]
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let e = queue.shift(); e; e = queue.shift()) {
      const [path, h] = e
      const res = await fetch(`${BASE}${path}?v=${h}`, { headers: { "user-agent": "ai.satyajit.si media:pull" } }).catch(() => null)
      if (!res?.ok) { failed.push(`${path} (${res ? res.status : "network error"})`); continue }
      const body = Buffer.from(await res.arrayBuffer())
      const got = createHash("sha256").update(body).digest("hex").slice(0, 16)
      if (got !== h) { failed.push(`${path} (R2 has ${got}, the map says ${h})`); continue }
      mkdirSync(dirname(join(PUBLIC, path)), { recursive: true })
      writeFileSync(join(PUBLIC, path), body)
    }
  }))
  if (failed.length) {
    console.error(`media:pull: ${failed.length} failed:\n  ${failed.join("\n  ")}`)
    process.exit(1)
  }
  console.log(`media:pull: done`)
}

main().catch((e) => {
  console.error(`media:pull: ${e instanceof Error ? e.message : e}`)
  process.exit(1)
})
