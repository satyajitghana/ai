// Catch prose that has been swallowed by `$…$` math.
//
// remark-math treats `$` like a code-span delimiter: any two dollar signs on a
// page can pair up, so a sentence quoting two prices ("it cost $314 up front and
// $1.02 per million tokens") silently becomes one inline-math node containing
// "314 up front and". KaTeX then renders that run of prose in italic serif with
// the dollar signs gone, and on narrow screens an unbreakable math span blows
// out the layout. Nothing else catches it: `validate:content` only reads
// frontmatter, and `validate:mdx` compiles happily because the document *is*
// syntactically valid — it just means something other than what was written.
//
// The fix in the MDX is to escape the literal dollars: `\$314`, `\$1.02`.
//
// Heuristic: parse with the same remark stack the build uses, then flag any
// inlineMath node that reads like English rather than like math — several
// space-separated words, no LaTeX control sequences. Short spans (`$x < 3$`,
// `$O(n \log n)$`) never trip it.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkParse from "remark-parse"
import { unified } from "unified"
import { visit } from "unist-util-visit"

type MathNode = {
  type: string
  value: string
  position?: { start: { line: number } }
}

// Words that appear in prose but effectively never inside a formula. A span has
// to contain one of these *and* look wordy to be reported, which keeps the check
// quiet enough to live inside `pnpm validate`.
// Single letters are excluded on purpose: `a`, `i` and friends are variable
// names far more often than they are English, and `$a = 0.931$` is an equation,
// not swallowed prose. Including `a` here produced exactly that false positive.
const PROSE_WORDS =
  /\b(the|and|per|for|with|from|about|into|than|that|each|every|an|is|are|was|were|it|to|of|in|on|at|by|up|or|but|not|as|its|their|this|these|those|million|billion|thousand|cost|costs|month|year|call|calls|token|tokens|hour|day|run|runs)\b/i

// A short span built around a relational operator is an equation. Prose that has
// been swallowed by a stray `$` does not look like this — it has no operator, or
// it has many words around one.
const EQUATION = /[=<>≤≥≈∼~±]/

function looksLikeProse(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  // Anything with LaTeX machinery in it is math, whatever else it contains.
  if (/[\\^_{}]/.test(v)) return false
  const words = v.split(/\s+/).filter(Boolean)
  if (words.length < 3) return false
  // `x = 3`, `p < 0.05`, `n ≈ 100` — an operator with only a few tokens around
  // it is an equation however many of those tokens happen to be English.
  if (EQUATION.test(v) && words.length <= 5) return false
  return PROSE_WORDS.test(v)
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

const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm)
  .use(remarkMath)

function main() {
  const files = walk("content").sort()
  const hits: string[] = []

  for (const file of files) {
    const tree = processor.parse(readFileSync(file, "utf8"))
    processor.runSync(tree)
    visit(tree, (node) => {
      const n = node as unknown as MathNode
      if (n.type !== "inlineMath" && n.type !== "math") return
      if (!looksLikeProse(n.value)) return
      const line = n.position?.start.line ?? 0
      const preview =
        n.value.length > 72 ? `${n.value.slice(0, 72)}…` : n.value
      hits.push(`${file}:${line}  $${preview}$`)
    })
  }

  if (hits.length) {
    console.error(
      `\n✖ ${hits.length} prose span(s) swallowed by \`$…$\` math.\n` +
        `  Two literal dollar signs on a page pair up into one math span.\n` +
        `  Escape the literal ones: \\$314, \\$1.02\n`,
    )
    for (const h of hits) console.error(`  ${h}`)
    console.error("")
    process.exit(1)
  }

  console.log(`✓ math spans OK (${files.length} files)`)
}

main()
