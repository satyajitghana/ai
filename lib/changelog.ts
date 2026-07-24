import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

// Changelog, sourced from git history. `git` isn't available in the production
// serverless runtime, so a prebuild step (scripts/gen-changelog.mts) snapshots
// the log into data/.generated/changelog.json; getChangelog() prefers that
// artifact and falls back to a live `git log` in dev. Either way, missing data
// yields [] rather than throwing.

export type ChangelogEntry = {
  hash: string
  date: string // YYYY-MM-DD
  subject: string
  body?: string
}

// Field / record separators unlikely to appear in commit text (US / RS
// controls). We ask git to emit them via its own %x1f/%x1e format escapes
// (passing raw control bytes through the shell + JSON.stringify would get
// escaped to literal "" text and silently break the parse), then split
// the output on the real control characters git wrote.
const FIELD_FMT = "%x1f"
const RECORD_FMT = "%x1e"
const FIELD = "\x1f"
const RECORD = "\x1e"

// Drop noise: merge commits, lockfile bumps, formatting-only, WIP, version tags.
const TRIVIAL_RE =
  /^(merge\b|wip\b|chore\(release\)|bump version|v?\d+\.\d+\.\d+$|\.{3}|fixup!|squash!)/i

const GENERATED = path.join(process.cwd(), "data", ".generated", "changelog.json")

// Parse `git log` output. Exported so the prebuild script and the dev fallback
// share one implementation.
export function readChangelogFromGit(): ChangelogEntry[] {
  const format = ["%h", "%ad", "%s", "%b"].join(FIELD_FMT) + RECORD_FMT
  const raw = execSync(
    `git log --no-merges --date=short --pretty=format:${JSON.stringify(format)}`,
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  )
  return raw
    .split(RECORD)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, date, subject, body] = record.split(FIELD)
      return {
        hash: hash?.trim() ?? "",
        date: date?.trim() ?? "",
        subject: subject?.trim() ?? "",
        body: body?.trim() || undefined,
      } satisfies ChangelogEntry
    })
    .filter((e) => e.hash && e.subject && !TRIVIAL_RE.test(e.subject))
}

export function getChangelog(): ChangelogEntry[] {
  // Prefer the build-time snapshot (works in the serverless runtime with no git).
  try {
    if (fs.existsSync(GENERATED)) {
      const parsed = JSON.parse(fs.readFileSync(GENERATED, "utf8"))
      if (Array.isArray(parsed) && parsed.length) return parsed as ChangelogEntry[]
    }
  } catch {
    // fall through to live git
  }
  try {
    return readChangelogFromGit()
  } catch {
    return []
  }
}
