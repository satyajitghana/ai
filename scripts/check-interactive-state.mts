/**
 * check-interactive-state — drives the interactive components whose state
 * handling was rewritten, and fails if any of them stops behaving.
 *
 * These are the components that used to set state from a mount effect, hold
 * simulation state in a ref they wrote during render, or define a child
 * component inside their own render. Every one of those is now expressed the
 * way React wants it, and every one of those rewrites could plausibly break
 * something a type checker and a lint rule cannot see: a filter that no longer
 * survives a deep link, an animation that stops advancing, an SVG node that
 * stops responding to a click.
 *
 * Nothing here asserts on appearance — `check:space-drops` and the render pass
 * cover that. This asserts on behaviour.
 *
 * Needs a server:
 *   pnpm build && pnpm start   (or pnpm dev)
 *   BASE=http://localhost:3000 pnpm check:interactive
 */

const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/$/, "")

type Result = { name: string; ok: boolean; detail: string }
const results: Result[] = []
const record = (name: string, ok: boolean, detail = "") => results.push({ name, ok, detail })

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
  const chromium = await loadChromium()
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1400 } })
  const page = await ctx.newPage()

  // ── ArticlesList: filter/sort/page read from the URL during render ────────
  await page.goto(`${BASE}/articles`, { waitUntil: "networkidle", timeout: 120000 })
  await page.waitForTimeout(400)
  await page.getByRole("button", { name: /^Featured/ }).click()
  await page.waitForTimeout(400)
  record("articles · a filter click writes the URL", page.url().includes("filter=featured"), page.url())
  record(
    "articles · the clicked tab is selected",
    (await page.getByRole("button", { name: /^Featured/ }).getAttribute("aria-pressed")) === "true",
  )

  // The page is statically prerendered, so the served HTML necessarily shows
  // the default view — what matters is that the client resolves the real one
  // from the query string.
  await page.goto(`${BASE}/articles?filter=featured&sort=signal`, { waitUntil: "networkidle" })
  await page.waitForTimeout(600)
  const filterOn = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /^Featured/.test(x.textContent ?? ""))
    return b?.getAttribute("aria-pressed")
  })
  const sortOn = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => (x.textContent ?? "").trim() === "signal")
    return b?.getAttribute("aria-pressed")
  })
  record("articles · a deep link restores the filter", filterOn === "true")
  record("articles · a deep link restores the sort", sortOn === "true")

  // back-compat: ?featured=1 was the old spelling and still has to work
  await page.goto(`${BASE}/articles?featured=1`, { waitUntil: "networkidle" })
  await page.waitForTimeout(600)
  const legacy = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /^Featured/.test(x.textContent ?? ""))
    return b?.getAttribute("aria-pressed")
  })
  record("articles · the legacy ?featured=1 link still works", legacy === "true")

  // ── ArchitecturesList ────────────────────────────────────────────────────
  await page.goto(`${BASE}/architectures`, { waitUntil: "networkidle" })
  await page.waitForTimeout(400)
  const chip = page.locator("button[aria-pressed]").nth(1)
  await chip.click()
  await page.waitForTimeout(400)
  record("architectures · a family click writes the URL", page.url().includes("family="), page.url())
  const familyUrl = page.url()
  await page.goto(familyUrl, { waitUntil: "networkidle" })
  await page.waitForTimeout(500)
  record(
    "architectures · the family survives a reload",
    (await page.locator("button[aria-pressed='true']").count()) > 0,
  )

  // ── zvec nav-graph: the walk stops itself instead of an effect stopping it ─
  await page.goto(`${BASE}/articles/zvec`, { waitUntil: "networkidle" })
  await page.waitForTimeout(500)
  const play = page.getByRole("button", { name: "play" }).first()
  if (await play.count()) {
    await play.click()
    await page.waitForTimeout(900)
    const mid = (await page.getByRole("button", { name: /pause|replay|play/ }).first().textContent())?.trim()
    record("zvec · play starts the walk", mid === "pause" || mid === "replay", `label=${mid}`)
    await page.waitForTimeout(6000)
    const end = (await page.getByRole("button", { name: /pause|replay|play/ }).first().textContent())?.trim()
    record("zvec · the walk stops itself at the end", end === "replay", `label=${end}`)
  } else {
    record("zvec · the play control is present", false)
  }

  // ── phase dials: simulation moved from a ref to state, must still animate ─
  await page.goto(`${BASE}/articles/unconventional-un-0`, { waitUntil: "networkidle" })
  await page.waitForTimeout(1200)
  const geometry = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("svg line")]
        .slice(0, 40)
        .map((l) => `${l.getAttribute("x2")},${l.getAttribute("y2")}`)
        .join("|"),
    )
  const before = await geometry()
  await page.waitForTimeout(1200)
  record("un-0 · the oscillator dials animate", before !== (await geometry()))

  // ── moe-architecture: the hoisted Node still selects on click ─────────────
  await page.goto(`${BASE}/articles/mixture-of-experts-from-scratch`, { waitUntil: "networkidle" })
  await page.waitForTimeout(600)
  const node = page.locator('g[role="button"][aria-label="embeddings"]').first()
  if (await node.count()) {
    await node.click()
    await page.waitForTimeout(400)
    record(
      "moe · the hoisted Node still responds to a click",
      (await node.getAttribute("aria-pressed")) === "true",
    )
  } else {
    record("moe · the diagram nodes render", false)
  }

  await browser.close()

  const failed = results.filter((r) => !r.ok)
  const pad = Math.max(...results.map((r) => r.name.length))
  for (const r of results) {
    console.log(`${r.ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${r.name.padEnd(pad)}  ${r.detail}`)
  }
  console.log("")
  if (failed.length) {
    console.error(`\x1b[31m${failed.length} of ${results.length} interactive checks failed\x1b[0m (BASE=${BASE})`)
    process.exit(1)
  }
  console.log(`\x1b[32m✓ all ${results.length} interactive checks passed\x1b[0m (BASE=${BASE})`)
}

await main()
