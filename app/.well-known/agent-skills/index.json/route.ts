import { SITE } from "@/lib/discovery"
import { getSkills } from "@/lib/skills"
import { absoluteUrl } from "@/lib/site"

// Agent Skills Discovery index (v0.2.0 RFC — cloudflare/agent-skills-discovery-rfc).
//
// These are the brand-crew skills that author and maintain this site: real
// Claude Code skills, versioned in the repository, installable as a plugin. The
// index exists so an agent can find and verify them without cloning — each entry
// carries a sha256 of the exact bytes served at its `url`.
export const dynamic = "force-static"

export function GET() {
  const skills = getSkills()

  const index = {
    $schema: "https://agentskills.io/schemas/v0.2.0/index.json",
    version: "0.2.0",
    name: "brand-crew",
    description:
      "The Claude Code skills that author and maintain ai.thesatyajit.com — publishing articles, daily arXiv digests, build logs, projects, snippets and notes into a Zod-validated content layer.",
    // What an agent actually needs before it decides to install any of this:
    // not what the skills are, but when reaching for them is the right move and
    // when it plainly is not. Per-skill `description` fields say what each one
    // does; this says whether the set is relevant at all.
    whenToUse:
      "Install these when you are working inside the satyajitghana/ai repository and need to add or maintain its content — a new article, the daily arXiv digest, a build log, a project page, a snippet or a note — so the file lands with correct frontmatter, passes the Zod content layer, and ships through the repo's PR workflow. They encode one site's house style, schema and validation pipeline, so they are not useful as general-purpose writing, research or publishing skills, and they are not a way to read the site's content: for that use the MCP server, the JSON API, or the markdown twin of any page.",
    homepage: absoluteUrl("/colophon"),
    documentation: absoluteUrl("/developers"),
    license: SITE.license,
    install: {
      marketplace: "satyajitghana/ai",
      command: "claude plugin install brand-crew@satyajit-ai",
    },
    skills: skills.map((s) => ({
      name: s.name,
      type: "skill",
      description: s.description,
      url: absoluteUrl(`/.well-known/agent-skills/${s.name}/SKILL.md`),
      sha256: s.sha256,
      bytes: s.bytes,
    })),
  }

  return new Response(JSON.stringify(index, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  })
}
