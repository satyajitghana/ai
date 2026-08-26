/**
 * check:mobile — walk the site at phone widths and fail on horizontal overflow.
 *
 * The failure this catches is the one nobody notices on a desktop: a single
 * element wider than the viewport makes the whole *page* scroll sideways, which
 * reads to a phone user as a stray margin down the right-hand edge of every
 * screen. It is always one element, and it is usually a row of things that was
 * never given permission to wrap.
 *
 * Deliberately allowed: an element that overflows *inside* an ancestor which
 * scrolls on purpose (`overflow-x: auto | scroll`). Wide tables, code blocks
 * and article diagrams are supposed to scroll in their own box — the house rule
 * is that the page body must not.
 *
 * Needs a server on BASE (default http://localhost:3000), so like check:agents
 * and check:spacing it lives outside `pnpm validate`.
 *
 *   pnpm check:mobile                 # every route, both widths
 *   pnpm check:mobile /articles       # just these routes
 */

const BASE = process.env.BASE ?? "http://localhost:3000"

// same resolution dance as check:spacing and check:interactive — playwright is
// a global install here, not a project dependency
async function loadChromium() {
  const candidates = ["playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright/index.js"]
  for (const spec of candidates) {
    try {
      const mod = await import(spec)
      const chromium = mod?.chromium ?? mod?.default?.chromium
      if (chromium) return chromium
    } catch {
      /* try the next one */
    }
  }
  console.error("playwright not found. Install it globally (npm i -g playwright) or add it as a dev dependency.")
  process.exit(1)
}

// 360 is the common Android floor; 390 is iPhone 14/15/16.
const WIDTHS = [360, 390]

const STATIC_ROUTES = [
  "/",
  "/articles",
  "/blog",
  "/arxiv",
  "/projects",
  "/resume",
  "/about",
  "/now",
  "/uses",
  "/reading",
  "/notes",
  "/snippets",
  "/models",
  "/architectures",
  "/publications",
  "/patents",
  "/health",
  "/colophon",
  "/changelog",
  "/developers",
  "/contact",
  "/privacy",
  "/this-route-does-not-exist",
]

type Offender = {
  tag: string
  cls: string
  text: string
  right: number
  width: number
}

async function routesToCheck(): Promise<string[]> {
  const argv = process.argv.slice(2).filter((a) => a.startsWith("/"))
  if (argv.length) return argv

  // one representative of each dynamic collection, plus a paginated list page
  const { getArticles, getBlogPosts, getProjects, getArxivDigests, getNotes, getSnippets } =
    await import("../lib/content/index")
  return [
    ...STATIC_ROUTES,
    "/articles?page=2",
    "/articles?page=8",
    ...getArticles().slice(0, 8).map((a) => `/articles/${a.slug}`),
    ...getBlogPosts().slice(0, 2).map((p) => `/blog/${p.slug}`),
    ...getProjects().slice(0, 2).map((p) => `/projects/${p.slug}`),
    ...getArxivDigests().slice(0, 1).map((p) => `/arxiv/${p.slug}`),
    ...getNotes().slice(0, 1).map((n) => `/notes/${n.slug}`),
    ...getSnippets().slice(0, 1).map((s) => `/snippets/${s.slug}`),
  ]
}

const routes = await routesToCheck()
const chromium = await loadChromium()
const browser = await chromium.launch({ headless: true })
let failures = 0
let checked = 0

for (const width of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const page = await ctx.newPage()

  for (const route of routes) {
    let res
    try {
      res = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 90_000 })
    } catch {
      console.log(`  \x1b[31m✗\x1b[0m ${width}px ${route} — navigation failed`)
      failures++
      continue
    }
    // the 404 route is meant to 404; everything else must be 200
    const status = res?.status() ?? 0
    if (status >= 500) {
      console.log(`  \x1b[31m✗\x1b[0m ${width}px ${route} — HTTP ${status}`)
      failures++
      continue
    }
    await page.waitForTimeout(220)

    const doc = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    checked++

    if (doc.scrollWidth > doc.clientWidth + 1) {
      // Inlined, with no named function bindings inside: tsx compiles a named
      // function to one wrapped in a `__name` helper that does not exist in the
      // page, and evaluate() would throw. Same reason as in check:spacing.
      const offenders: Offender[] = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth
        const out: {
          tag: string
          cls: string
          text: string
          right: number
          width: number
        }[] = []
        for (const el of Array.from(document.querySelectorAll("body *"))) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 && r.height === 0) continue
          if (r.right <= vw + 1 && r.left >= -1) continue

          // an element may overflow inside an ancestor that scrolls on purpose
          let a: Element | null = el.parentElement
          let contained = false
          while (a && a !== document.body) {
            const ox = getComputedStyle(a).overflowX
            if (ox === "auto" || ox === "scroll") {
              contained = true
              break
            }
            a = a.parentElement
          }
          if (contained) continue

          out.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.getAttribute("class") || "").slice(0, 90),
            text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 50),
            right: Math.round(r.right),
            width: Math.round(r.width),
          })
        }
        // the widest offender is the cause; its children are consequences
        return out
          .filter(
            (o) => !out.some((p) => p !== o && o.text.length > 0 && p.text.includes(o.text) && p.width >= o.width),
          )
          .slice(0, 6)
      })
      failures++
      console.log(
        `  \x1b[31m✗\x1b[0m ${width}px ${route} — page scrolls to ${doc.scrollWidth}px (viewport ${doc.clientWidth})`,
      )
      for (const o of offenders) {
        console.log(`       <${o.tag} class="${o.cls}"> w=${o.width} right=${o.right}`)
        if (o.text) console.log(`         “${o.text}”`)
      }
    }
  }
  await ctx.close()
}

await browser.close()

if (failures) {
  console.log(
    `\n\x1b[31m✗ ${failures} horizontal overflow${failures === 1 ? "" : "s"}\x1b[0m across ${checked} page loads.`,
  )
  console.log("  A page must never scroll sideways. Let the row wrap, or give the wide")
  console.log("  thing its own `overflow-x-auto` box so only that box scrolls.")
  process.exit(1)
}

console.log(`\n\x1b[32m✓ no horizontal overflow\x1b[0m — ${checked} page loads at ${WIDTHS.join("px / ")}px`)
