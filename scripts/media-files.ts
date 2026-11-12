// What counts as media, where it lives, and how a script asks whether a path
// exists. R2 is the source of truth (lib/media.ts): lib/media-map.json lists
// every uploaded path, and the files are gitignored, so a fresh clone has none
// of them on disk. A path exists if it is on disk (whoever made it has it) or
// in the map (someone pushed it). Shared by media-push, check-media and the
// validators that used to stat public/.
import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { dirname, extname, join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
export const PUBLIC = join(ROOT, "public")
export const MAP_FILE = join(ROOT, "lib", "media-map.json")

// Folders under public/ whose media lives in R2. Everything else under public/
// (icons, data files, captions) stays in git and is served by Vercel.
export const TOPS = ["thumbs", "films", "articles", "projects"]
export const MEDIA_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif",
  ".mp4", ".webm", ".mov", ".m4a", ".mp3", ".wav",
  ".glb",
])

export const isMediaPath = (path: string) =>
  path.startsWith("/") && !path.includes("..") && TOPS.includes(path.split("/")[1]) && MEDIA_EXT.has(extname(path).toLowerCase())

export const sha16 = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 16)

export const loadMap = (): Record<string, string> => JSON.parse(readFileSync(MAP_FILE, "utf8"))

export const saveMap = (map: Record<string, string>) =>
  writeFileSync(MAP_FILE, JSON.stringify(Object.fromEntries(Object.entries(map).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))), null, 0) + "\n")

/** The committed map, as this checkout has it. */
export const MEDIA_MAP: Record<string, string> = existsSync(MAP_FILE) ? loadMap() : {}

/** A site path ("/articles/x/fig1.png") exists: on disk, or pushed to R2. */
export const mediaExists = (path: string, map: Record<string, string> = MEDIA_MAP) =>
  path in map || existsSync(join(PUBLIC, path))

/** Every media file on disk under the R2 folders, as site paths. */
export function localMedia(dirs: string[] = TOPS.map((t) => join(PUBLIC, t))): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) walk(p)
      else {
        const path = "/" + relative(PUBLIC, p).split(sep).join("/")
        if (isMediaPath(path)) out.push(path)
      }
    }
  }
  for (const d of dirs) if (existsSync(d)) statSync(d).isDirectory() ? walk(d) : out.push("/" + relative(PUBLIC, d).split(sep).join("/"))
  return out.filter(isMediaPath).sort()
}
