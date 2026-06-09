// Resume PDF for download. Primary source is Satyajit's maintained resume in his
// GitHub repo (https://github.com/satyajitghana/resume) — fetched at build time
// so the site always serves the latest one-pager from /satyajit-ghana-resume.pdf.
// Falls back to generating from data/resume.ts (lib/resume/ResumeDocument.tsx) if
// the fetch fails (e.g. offline), so the build never breaks.
//
// Run directly with `pnpm tsx scripts/build-resume-pdf.mts`; wired as `prebuild`.
import { createElement } from "react"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { statSync, writeFileSync } from "node:fs"
import { renderToFile } from "@react-pdf/renderer"
import type { DocumentProps } from "@react-pdf/renderer"
import type { ReactElement } from "react"

import { resume } from "../data/resume"
import { ResumeDocument } from "../lib/resume/ResumeDocument"

const here = dirname(fileURLToPath(import.meta.url))
const outputPath = resolve(here, "../public/satyajit-ghana-resume.pdf")

const RESUME_URL =
  process.env.RESUME_PDF_URL ??
  "https://raw.githubusercontent.com/satyajitghana/resume/master/satyajit-resume-one-pager-ats.pdf"

async function fetchMaintained(): Promise<boolean> {
  try {
    const res = await fetch(RESUME_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    // Sanity-check it's actually a PDF, not an error page.
    if (buf.length < 5000 || buf.subarray(0, 4).toString("latin1") !== "%PDF") {
      throw new Error("response was not a PDF")
    }
    writeFileSync(outputPath, buf)
    console.log(
      `✓ Fetched maintained resume → ${outputPath} (${(buf.length / 1024).toFixed(1)} KB)`
    )
    return true
  } catch (err) {
    console.warn(
      `⚠ Could not fetch maintained resume PDF (${(err as Error).message}); generating from data/resume.ts instead.`
    )
    return false
  }
}

async function generate(): Promise<void> {
  const element = createElement(ResumeDocument, {
    resume,
  }) as unknown as ReactElement<DocumentProps>
  await renderToFile(element, outputPath)
  const { size } = statSync(outputPath)
  console.log(
    `✓ Generated resume PDF → ${outputPath} (${(size / 1024).toFixed(1)} KB)`
  )
}

async function main() {
  if (!(await fetchMaintained())) {
    await generate()
  }
}

main().catch((err) => {
  console.error("Failed to build resume PDF:", err)
  process.exit(1)
})
