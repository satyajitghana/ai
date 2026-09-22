// A promoted Beacon skill, with every line labelled by where it came from.
//
// The file is exactly what learning.RenderSkill + candidate.candidateBody
// produce (cli/beacon/internal/learning/skills.go and candidate.go, commit
// 63d43f4), rendered here for the trace visible in the project's own dashboard
// screenshot: a Factory Droid session whose first user message was
// "tell me about htis repo", typo and all.
//
// The derivations, all deterministic:
//   title      = kind + ": " + trace.Title, and trace.Title is the first
//                user_message truncated to 80 chars (dashboard/traces.go)
//   kind       = a five-branch strings.Contains switch over that same title;
//                no keyword matches here, so the default "correction" wins
//   slug       = lowercase the title, non-alphanumerics to dashes, cap 48,
//                prefix "beacon-"
//   body       = a fixed five-line template plus the three probabilities
//   evidence   = the trace id and the same title again
//
// Exactly three values in this file came from the decision model, and all three
// are numbers printed to two decimal places. Nothing in the file states the
// lesson, because nothing in the pipeline ever extracts one.
//
// Server-rendered, zero JS.

const FROM = {
  tmpl: { label: "template", tint: "var(--muted-foreground)" },
  title: { label: "first prompt", tint: "oklch(0.55 0.14 250)" },
  kind: { label: "keyword switch", tint: "oklch(0.62 0.15 85)" },
  id: { label: "hash", tint: "var(--muted-foreground)" },
  model: { label: "model", tint: "oklch(0.58 0.19 27)" },
} as const

type Source = keyof typeof FROM

const LINES: [string, Source | null][] = [
  ["---", null],
  ["name: beacon-correction-tell-me-about-htis-repo", "title"],
  ['description: "correction: tell me about htis repo"', "title"],
  ['beacon_memory_id: "memory_9f3c…"', "id"],
  ['beacon_candidate_id: "candidate_41ab…"', "id"],
  ["tags:", null],
  ['  - "beacon"', "tmpl"],
  ['  - "correction"', "kind"],
  ['  - "factory"', "tmpl"],
  ["---", null],
  ["", null],
  ["# correction: tell me about htis repo", "title"],
  ["", null],
  [
    "Use this skill When a future agent in this project hits a similar workflow, regardless of harness.",
    "tmpl",
  ],
  ["", null],
  ["## Guidance", null],
  ["", null],
  ["Reusable lesson extracted from a reviewed Beacon trace.", "tmpl"],
  ["", null],
  ["Trace: 0475ffdc-003d-4617-afdb-6b77e777c1ef", "id"],
  ["Harness: factory", "tmpl"],
  ["Observed workflow: tell me about htis repo", "title"],
  ["", null],
  ["Evaluation signals:", "tmpl"],
  ["- task_success: 0.91", "model"],
  ["- reusable_correction: 0.44", "model"],
  ["- evidence_supported: 0.68", "model"],
  ["", null],
  ["## Beacon Evidence", null],
  ["", null],
  ["- Trace `0475ffdc…`: tell me about htis repo", "title"],
]

export function SkillAnatomy() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        .agents/skills/beacon-correction-tell-me-about-htis-repo/SKILL.md —{" "}
        <span className="text-foreground">31 lines, 3 of them from the model</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">
            The generated SKILL.md file line by line, with the provenance of each line: fixed
            template text, the session&apos;s first user prompt, the keyword switch over that
            prompt, a content hash, or the decision model.
          </caption>
          <tbody>
            {LINES.map(([text, source], i) => (
              <tr key={i}>
                <td className="w-24 border-r px-3 py-0 text-right align-top font-mono text-[10px] leading-6 whitespace-nowrap">
                  {source ? (
                    <span style={{ color: FROM[source].tint }}>{FROM[source].label}</span>
                  ) : null}
                </td>
                <td className="px-3 py-0 font-mono text-[11px] leading-6 whitespace-pre">
                  {text || " "}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        The three red lines are the model&apos;s entire contribution to the artifact, and they
        are the numbers that got the trace here, reprinted. Everything else is a string template,
        a substring of the first thing the user typed, or a hash. There is no lesson in the file
        because no step in the pipeline writes one: the rubric asks whether a reusable lesson
        exists, and nothing then asks what it is.{" "}
        <span className="font-mono">description</span> is what a future agent reads when deciding
        whether to load the skill, and here it is a truncated prompt with a typo in it. Hashes
        are abbreviated and the three probabilities are illustrative; every other character is
        what <span className="font-mono">RenderSkill</span> emits for this trace.
      </p>
    </figure>
  )
}
