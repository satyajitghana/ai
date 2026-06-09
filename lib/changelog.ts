import { execSync } from "node:child_process"

// Build-time changelog, sourced from git history. Server-only: runs `git log`
// once during the build (or dev render) and parses it into typed entries.
// Wrapped in try/catch so a missing .git (e.g. on a CI checkout) yields [].

export type ChangelogEntry = {
  hash: string
  date: string // YYYY-MM-DD
  subject: string
  body?: string
}

// Record/field separators unlikely to appear in commit text.
const FIELD = ""
const RECORD = ""

// Drop noise: merge commits, lockfile bumps, formatting-only, WIP, version tags.
const TRIVIAL_RE =
  /^(merge\b|wip\b|chore\(release\)|bump version|v?\d+\.\d+\.\d+$|\.{3}|fixup!|squash!)/i

export function getChangelog(): ChangelogEntry[] {
  try {
    const format = ["%h", "%ad", "%s", "%b"].join(FIELD) + RECORD
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
      .filter(
        (entry) =>
          entry.hash &&
          entry.subject &&
          !TRIVIAL_RE.test(entry.subject)
      )
  } catch {
    return []
  }
}
