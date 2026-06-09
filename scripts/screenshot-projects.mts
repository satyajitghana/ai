// Capture real screenshots of each project's live demo into public/projects/
// using headless Chrome (puppeteer-core + the system google-chrome). Waits for
// the page to settle and for intro animations to finish before shooting.
//
// This is a LOCAL/manual tool — Vercel's build container has no Chrome, so run
// it on your machine and commit the resulting PNGs as static assets:
//   pnpm tsx scripts/screenshot-projects.mts            # all
//   pnpm tsx scripts/screenshot-projects.mts vritti hyr # a subset
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { mkdirSync } from "node:fs"
import puppeteer from "puppeteer-core"

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, "../public/projects")

const CHROME =
  process.env.CHROME_PATH ?? "/usr/bin/google-chrome"

// slug → live demo URL.
const DEMOS: Record<string, string> = {
  // vritti is behind a Cloudflare human-check — headless Chrome only gets the
  // challenge page, so its cover is omitted (add a screenshot by hand if wanted).
  fabrik: "https://fabrik-ui.vercel.app",
  atoms: "https://atoms.thesatyajit.com",
  botcha: "https://botcha-verify.vercel.app",
  penora: "https://penora-ui.vercel.app",
  rentree: "https://rentree-now.vercel.app",
  hyr: "https://hyred.vercel.app",
  tapcn: "https://tapcn.vercel.app",
  mocklab: "https://mocklab-sigma.vercel.app",
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  mkdirSync(outDir, { recursive: true })
  const only = process.argv.slice(2)
  const entries = Object.entries(DEMOS).filter(
    ([slug]) => only.length === 0 || only.includes(slug)
  )

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
    ],
  })

  for (const [slug, url] of entries) {
    const page = await browser.newPage()
    try {
      // 16:9 viewport at 2× for a crisp cover.
      await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 })
      // `domcontentloaded` (not networkidle) — many of these keep connections
      // open (analytics, websockets, looping animations) and never go idle.
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 })
      // Let fonts settle and intro animations finish before shooting.
      await page
        .evaluate(() => (document as Document).fonts?.ready)
        .catch(() => {})
      await sleep(7000)
      const out = resolve(outDir, `${slug}.png`)
      await page.screenshot({ path: out as `${string}.png`, type: "png" })
      console.log(`  ✓ ${slug} ← ${url}`)
    } catch (err) {
      console.warn(`  ⚠ ${slug}: ${(err as Error).message}`)
    } finally {
      await page.close()
    }
  }

  await browser.close()
}

main().catch((err) => {
  console.error("screenshot run failed:", err)
  process.exit(1)
})
