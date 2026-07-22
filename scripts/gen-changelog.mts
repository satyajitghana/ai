import fs from "node:fs"
import path from "node:path"

import { readChangelogFromGit } from "../lib/changelog"

// Prebuild: snapshot the git changelog into data/.generated/changelog.json so
// the /changelog page has data in the production serverless runtime, where
// `git` isn't available. Machine-generated — do not hand-edit.

const OUT_DIR = path.join(process.cwd(), "data", ".generated")
const OUT = path.join(OUT_DIR, "changelog.json")

try {
  const entries = readChangelogFromGit()
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(entries, null, 2) + "\n")
  console.log(`✓ changelog snapshot — ${entries.length} entries → ${path.relative(process.cwd(), OUT)}`)
} catch (err) {
  console.warn("⚠ could not generate changelog snapshot (no git?) — leaving as-is:", (err as Error).message)
}
