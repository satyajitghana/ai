/**
 * check-space-drops — finds words fused together at JSX element boundaries.
 *
 * The bug: JSX normalizes each text node by trimming every line, dropping
 * blank lines, and joining what is left with single spaces. Two consequences,
 * the second of which is easy to miss:
 *
 *   1. Whitespace between elements that contains a newline disappears:
 *        the rest
 *        <em>skip</em>
 *      renders "the restskip".
 *
 *   2. A leading space IS trimmed too, whenever its text node runs onto a
 *      further line — because that first line gets trimmed like any other:
 *        <code>C(m,2)</code> pairwise judgments per iteration, and then some
 *        more prose wrapped onto the next line
 *      renders "C(m,2)pairwise". The same markup with nothing after it on a
 *      second line would have been fine, which is what makes this one sneaky.
 *
 * The robust fixes are an explicit {" "} between them, or a leading space
 * inside the tag (<em> skip</em>) — neither depends on how the line wraps.
 *
 * Why this checks the DOM rather than the source: a static regex over-reports
 * by roughly 30:1. Sibling <span>s inside a `flex gap-2` container look
 * identical to the defect in source and are correct; so does the in-tag-space
 * idiom. The rendered text is the only ground truth, so this drives a real
 * browser and inspects prose containers only.
 *
 * Usage:
 *   pnpm dev                       # in another shell
 *   pnpm check:spacing             # all articles
 *   pnpm check:spacing kimi-k3 …   # specific slugs
 *
 * Exits non-zero if anything is found.
 */

import { readdirSync } from "node:fs"
import { join } from "node:path"

const BASE = process.env.SITE_URL ?? "http://localhost:3000"
const CONTENT = join(process.cwd(), "content", "articles")

// Prose containers only. Flex/grid layout wrappers legitimately place elements
// next to each other with no text space, so scanning them would be pure noise.
// Keep these mutually exclusive — `article figure p` would be subsumed by
// `article p` and only make every hit inside a figure get reported twice.
const SELECTORS = "article p, article li, article td"

function slugs(): string[] {
  const argv = process.argv.slice(2)
  if (argv.length) return argv
  return readdirSync(CONTENT)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""))
    .sort()
}

/**
 * Playwright is intentionally not a project dependency — it would pull browser
 * binaries into every install for one optional check. Resolve it from wherever
 * it happens to live instead.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
async function loadChromium(): Promise<any> {
  const candidates = ["playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright/index.js"]
  for (const spec of candidates) {
    try {
      const mod: any = await import(spec)
      const chromium = mod?.chromium ?? mod?.default?.chromium
      if (chromium) return chromium
    } catch {
      // try the next candidate
    }
  }
  console.error("playwright not found. Install it globally (npm i -g playwright) or add it as a dev dependency.")
  process.exit(1)
}

async function main() {
  const chromiumLauncher = await loadChromium()
  const browser = await chromiumLauncher.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } })
  const page = await ctx.newPage()

  const targets = slugs()
  const findings: { slug: string; hits: string[] }[] = []
  let unreachable = 0

  for (const slug of targets) {
    let res
    try {
      res = await page.goto(`${BASE}/articles/${slug}`, { waitUntil: "domcontentloaded", timeout: 120_000 })
    } catch {
      unreachable++
      console.error(`  ?  ${slug} — could not load (is \`pnpm dev\` running?)`)
      continue
    }
    if (!res || res.status() !== 200) {
      unreachable++
      console.error(`  ?  ${slug} — HTTP ${res?.status() ?? "??"}`)
      continue
    }
    await page.waitForTimeout(600)

    // NOTE: no named inner functions in here. tsx/esbuild rewrites them with a
    // __name helper that does not exist in the page, so evaluate() throws.
    const hits: string[] = await page.evaluate((sel: string) => {
      const out: string[] = []
      const ENDS = /[A-Za-z0-9)\u201d\u2019%]/
      const STARTS = /[A-Za-z0-9(\u201c]/
      const stack: Element[] = Array.from(document.querySelectorAll(sel))
      const seen = new Set<Element>() // nested matches (li in li) would double-report
      while (stack.length) {
        const el = stack.pop() as Element
        if (seen.has(el)) continue
        seen.add(el)
        for (const node of Array.from(el.childNodes)) {
          if (node.nodeType !== 1) continue
          const child = node as Element
          if (child.classList && child.classList.contains("katex")) continue // KaTeX manages its own spacing
          // sub/sup are meant to abut their base: w<sub>t</sub>, m<sup>2</sup>
          if (child.tagName === "SUB" || child.tagName === "SUP") continue
          const own = child.textContent || ""
          // A lone capital is the acronym-initial device, where fusing IS the
          // point: **M**oment**U**m **O**rthogonalized by **N**ewton-schulz.
          // Genuine drops involve a word or phrase, never one letter.
          if (/^[A-Z]$/.test(own)) continue
          const prev = child.previousSibling
          const next = child.nextSibling
          if (prev && prev.nodeType === 3) {
            const t = prev.textContent || ""
            if (t && own && ENDS.test(t.slice(-1)) && STARTS.test(own[0])) {
              out.push(t.slice(-20) + "\u25ae" + own.slice(0, 20))
            }
          }
          if (next && next.nodeType === 3) {
            const t = next.textContent || ""
            if (t && own && ENDS.test(own.slice(-1)) && STARTS.test(t[0])) {
              out.push(own.slice(-20) + "\u25ae" + t.slice(0, 20))
            }
          }
          stack.push(child)
        }
      }
      return out
    }, SELECTORS)

    if (hits.length) {
      findings.push({ slug, hits })
      console.error(`  ✗  ${slug} — ${hits.length}`)
      for (const h of hits) console.error(`       ${h}`)
    }
  }

  await browser.close()

  const total = findings.reduce((a, f) => a + f.hits.length, 0)
  if (unreachable) console.error(`\n${unreachable} page(s) unreachable — results are incomplete.`)
  if (total) {
    console.error(`\n✗ ${total} fused word boundar${total === 1 ? "y" : "ies"} across ${findings.length} page(s).`)
    console.error(`  Fix with {" "} before the element, or a leading space inside its tag.`)
    process.exit(1)
  }
  console.log(`✓ no space drops — ${targets.length - unreachable} page(s) checked`)
  if (unreachable) process.exit(1)
}

main()
