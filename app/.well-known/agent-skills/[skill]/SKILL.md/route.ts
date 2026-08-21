import { getSkill, getSkills } from "@/lib/skills"
import { absoluteUrl } from "@/lib/site"

// Serves each SKILL.md at the URL its index entry names, byte-for-byte, so the
// sha256 in /.well-known/agent-skills/index.json actually verifies.
export const dynamic = "force-static"
export const dynamicParams = true

export function generateStaticParams() {
  return getSkills().map((s) => ({ skill: s.name }))
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ skill: string }> },
) {
  const { skill } = await params
  const found = getSkill(skill)

  if (!found) {
    const names = getSkills().map((s) => s.name)
    return new Response(
      [
        "# 404 — no such skill",
        "",
        `There is no skill named \`${skill}\`.`,
        "",
        "## Available skills",
        "",
        ...names.map((n) => `- [${n}](${absoluteUrl(`/.well-known/agent-skills/${n}/SKILL.md`)})`),
        "",
        `The full index, with digests: ${absoluteUrl("/.well-known/agent-skills/index.json")}`,
        "",
      ].join("\n"),
      {
        status: 404,
        headers: {
          "content-type": "text/markdown; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    )
  }

  return new Response(found.body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  })
}
