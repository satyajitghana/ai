import { createHash } from "node:crypto"
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"

import matter from "gray-matter"

// The brand-crew skills, read off disk so the published index cannot drift from
// what is actually in the repository.
//
// These are real, installable Claude Code skills — the ones that author and
// maintain this site. Publishing them under /.well-known/agent-skills means an
// agent can discover and verify them without cloning anything: the index
// carries a sha256 of each SKILL.md, and the same bytes are served at the URL
// the digest describes.

const SKILLS_DIR = join(process.cwd(), "brand-crew", "skills")

export type Skill = {
  name: string
  description: string
  body: string
  sha256: string
  bytes: number
}

function read(): Skill[] {
  if (!existsSync(SKILLS_DIR)) return []

  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const file = join(SKILLS_DIR, d.name, "SKILL.md")
      if (!existsSync(file)) return null
      const raw = readFileSync(file)
      const { data } = matter(raw.toString())
      return {
        name: typeof data.name === "string" ? data.name : d.name,
        description: typeof data.description === "string" ? data.description : "",
        body: raw.toString(),
        // Digest of the exact bytes served at the skill's URL, so a client can
        // verify what it downloaded against what the index promised.
        sha256: createHash("sha256").update(raw).digest("hex"),
        bytes: raw.byteLength,
      }
    })
    .filter((s): s is Skill => s !== null && s.description.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
}

let cache: Skill[] | undefined

export function getSkills(): Skill[] {
  cache ??= read()
  return cache
}

export function getSkill(name: string): Skill | undefined {
  return getSkills().find((s) => s.name === name)
}
