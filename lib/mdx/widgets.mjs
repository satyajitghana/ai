// Which article widgets load lazily, decided in one place for the MDX plugin
// (remark-lazy-widgets.mjs) and the registry generator
// (scripts/gen-widget-registry.mts). Plain .mjs because Turbopack loads MDX
// plugins by path and cannot compile TypeScript for them.
//
// A widget is a module under components/articles/ that an MDX file imports and
// that starts with "use client". Server components there are left alone: they
// render to HTML and ship no JavaScript, so there is nothing to defer.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

export const PREFIX = "@/components/articles/"
const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"]

/** Absolute path of the module behind `@/components/articles/<rel>`, or null. */
export function resolveWidget(root, rel) {
  const base = join(root, "components", "articles", rel)
  for (const ext of EXTENSIONS) if (existsSync(base + ext)) return base + ext
  for (const ext of EXTENSIONS) if (existsSync(join(base, "index" + ext))) return join(base, "index" + ext)
  return null
}

const USE_CLIENT = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*["']use client["']/

/** True when the module is a client component file. */
export function isClientModule(file) {
  return USE_CLIENT.test(readFileSync(file, "utf8"))
}

/** True when `@/components/articles/<rel>` should be loaded lazily. */
export function isLazyWidget(root, rel) {
  const file = resolveWidget(root, rel)
  return file !== null && isClientModule(file)
}

const IMPORT = /^import\s*\{[^}]*\}\s*from\s*["']@\/components\/articles\/([^"']+)["']/gm

/** Every lazy widget module that some MDX file under content/ imports, sorted. */
export function collectWidgets(root) {
  const found = new Set()
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (f.endsWith(".mdx")) for (const m of readFileSync(p, "utf8").matchAll(IMPORT)) found.add(m[1])
    }
  }
  walk(join(root, "content"))
  return [...found].filter((rel) => isLazyWidget(root, rel)).sort()
}
