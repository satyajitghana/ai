// Every <Figure>, <Video>, poster and caption track must point at a file that
// exists: pushed to R2 (lib/media-map.json) or, for captions, committed under
// public/.
//
// A broken `src` is invisible to the rest of `pnpm validate`: the frontmatter is
// fine, the MDX compiles, the build succeeds, and the page ships with an empty
// box where the paper's figure should be. Next/Image would fail at request time
// on a missing file, and a plain <img> just renders nothing — either way nobody
// finds out until a reader does.
//
// Asset directories are NOT required to match the slug (several articles predate
// that convention — `/articles/fastlio2/` serves
// `fast-lio2-lidar-inertial-odometry`), so this resolves the literal path rather
// than guessing one.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

import { mediaExists } from "./media-files"

// `[^>]` already spans newlines, so the pattern needs no dotAll flag — which is
// as well, since this tsconfig targets below ES2018 and `s` would not compile.
const FIGURE = /<(Figure|Video)\b[^>]*?\bsrc="(\/[^"]+)"/g
const POSTER = /\bposter="(\/[^"]+)"/g
const CAPTIONS = /\bcaptions="(\/[^"]+)"/g

// <Video src> omits the extension — the component emits a <source> per format.
const VIDEO_EXT = [".webm", ".mp4"]

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (p.endsWith(".mdx") || p.endsWith(".md")) out.push(p)
  }
  return out
}

function main() {
  const files = walk("content").sort()
  const missing: string[] = []
  let checked = 0

  for (const file of files) {
    const src = readFileSync(file, "utf8")
    const note = (kind: string, path: string) =>
      missing.push(`${file}  ${kind}  ${path}`)

    for (const m of src.matchAll(FIGURE)) {
      checked++
      const [, kind, path] = m
      const ok =
        kind === "Video"
          ? VIDEO_EXT.some((e) => mediaExists(path + e))
          : mediaExists(path)
      if (!ok) note(kind === "Video" ? "Video src (no .webm/.mp4)" : "Figure src", path)
    }
    for (const m of src.matchAll(POSTER)) {
      checked++
      if (!mediaExists(m[1])) note("poster", m[1])
    }
    for (const m of src.matchAll(CAPTIONS)) {
      checked++
      if (!existsSync(join("public", m[1]))) note("captions", m[1])
    }
  }

  if (missing.length) {
    console.error(
      `\n✖ ${missing.length} asset reference(s) point at a file that is neither in R2 nor in public/.\n` +
        `  Push the media (pnpm media:push), commit the caption, or fix the path. Never hotlink.\n`,
    )
    for (const m of missing) console.error(`  ${m}`)
    console.error("")
    process.exit(1)
  }

  console.log(`✓ assets OK — ${checked} reference(s) resolve`)
}

main()
