// Compile every MDX file the way the app does, so MDX/JSX *syntax* errors
// (e.g. a bare `<` before a digit, like writing "16% → <2%" in prose, which MDX
// reads as the start of a JSX tag) fail `pnpm validate` locally instead of only
// at the Vercel build. `validate:content` checks frontmatter via the Zod content
// layer; this is the missing half — it checks the compiled body.
//
// Uses the same remark plugins as next.config.ts (remark-frontmatter strips the
// YAML block, remark-math protects `$…$`/`$$…$$` so comparisons inside math are
// safe, remark-gfm for tables/strikethrough). The rehype stage runs only after
// the body is already valid MDX, so the remark stage is what catches syntax bugs.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"

// @mdx-js/mdx is a transitive dep (via @next/mdx) and isn't hoisted to the top
// level under pnpm, so resolve it from the pnpm store by its versioned directory.
async function resolveCompile(): Promise<
  (source: string, opts: unknown) => Promise<unknown>
> {
  const pnpmDir = "node_modules/.pnpm"
  const entry = readdirSync(pnpmDir).find((d) => d.startsWith("@mdx-js+mdx@"))
  if (!entry) {
    throw new Error(
      "Could not find @mdx-js/mdx under node_modules/.pnpm — run `pnpm install`.",
    )
  }
  const mod = join(
    process.cwd(),
    pnpmDir,
    entry,
    "node_modules/@mdx-js/mdx/index.js",
  )
  const { compile } = (await import(pathToFileURL(mod).href)) as {
    compile: (source: string, opts: unknown) => Promise<unknown>
  }
  return compile
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (p.endsWith(".mdx") || p.endsWith(".md")) out.push(p)
  }
  return out
}

async function main() {
  const compile = await resolveCompile()
  const files = walk("content").sort()
  const errors: string[] = []

  for (const file of files) {
    const source = readFileSync(file, "utf8")
    try {
      await compile(source, {
        remarkPlugins: [remarkFrontmatter, remarkGfm, remarkMath],
        rehypePlugins: [],
      })
    } catch (err) {
      const e = err as { message?: string; line?: number; column?: number }
      const where =
        e.line != null ? ` (${e.line}:${e.column ?? 0})` : ""
      errors.push(`${file}${where}: ${e.message ?? String(err)}`)
    }
  }

  if (errors.length) {
    console.error(
      `✗ MDX compile failed for ${errors.length} file(s) — the Vercel build ` +
        `would fail on these:\n`,
    )
    for (const e of errors) console.error("  " + e + "\n")
    console.error(
      "Tip: a bare `<` in prose starts a JSX tag. Write `&lt;` (or wrap the " +
        "expression in `code`/`$math$`) for things like `<2%` or `x < 3`.",
    )
    process.exit(1)
  }

  console.log(`✓ MDX compiles — ${files.length} files`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
