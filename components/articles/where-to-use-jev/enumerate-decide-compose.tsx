// The pattern, instantiated six times, with the artifact that does each job
// named rather than described.
//
// The point of drawing it six times is the middle column. It is the same width
// in every row because the model's contribution really is the same size in every
// row — one index, or one probability — while the two outer columns are
// different code each time and are where all the work is. The last row is the
// punchline: on this site's own corpus the middle column is empty and the thing
// still ships.
//
// Segment widths are fixed and semantic, not quantitative. The measured numbers
// are on the line underneath each row.
//
// Server-rendered SVG, zero JS, integer geometry.

const PASS = "oklch(0.60 0.15 255)"

type Row = {
  system: string
  where: string
  enumerate: [string, string]
  decide: [string, string]
  compose: [string, string]
  measured: string
  noModel?: boolean
}

const ROWS: Row[] = [
  {
    system: "WindTunnel",
    where: "browser agent",
    enumerate: ["adapter.observe() — every live WebMCP", "tool, plus FINISH and ABSTAIN, cap 255"],
    decide: ["one Choice", "→ an id"],
    compose: ["menu.find(id), then Mercury 2.5", "writes the arguments"],
    measured:
      "49/49 tasks, rank 1 of 21. Getting the answer set onto eight sites took 7,302 added lines across 44 tools.",
  },
  {
    system: "jev-linkmap",
    where: "internal links",
    enumerate: ["candidates.py — TF-IDF cosine, headings", "×4, chrome filter, already-linked spans masked"],
    decide: ["8,460 noul", "answers"],
    compose: ["place_links — max 3 per page,", "one use per anchor phrase"],
    measured:
      "8,460 link decisions in 5.9 s for $0.27. The enumerator makes zero model calls; the cap then discards 1,704 of 2,383 yeses.",
  },
  {
    system: "jev-semgrep",
    where: "grep by meaning",
    enumerate: ["a nested forEach — 30 lines ×", "however many meanings you passed"],
    decide: ["one probability", "per (line, meaning)"],
    compose: ["disjunctive normal form in the", "harness: AND and NOT are && and !"],
    measured:
      "309 lines of dependency-free Node. An embedding cannot do the NOT, because the line is encoded before the query exists.",
  },
  {
    system: "json-render",
    where: "generative UI",
    enumerate: ["buildCandidates — 322 lines, 42 fully", "configured element recipes"],
    decide: ["50 keys,", "in 2 calls"],
    compose: ["structuredClone into a tree,", "then validate the whole thing"],
    measured:
      "Two calls for an eight-element dashboard. 668.6 bytes per candidate, so about 200 recipes fit one 32k request.",
  },
  {
    system: "Stanley",
    where: "code review",
    enumerate: ["enabledHunks — identifiers a hunk", "declares, intersected with what others use"],
    decide: ["23 questions,", "all typed"],
    compose: ["69 policy constants decide what", "every returned probability means"],
    measured:
      "11,199 lines of source. The model's entire surface is 23 question definitions; one linked pair gets exactly one follow-up.",
  },
  {
    system: "this site",
    where: "related articles",
    enumerate: ["lib/related.ts — Jaccard over tag sets,", "then a second coverage pass"],
    decide: ["— none —", ""],
    compose: ["top four; the anchor text is the", "target's own title"],
    measured: "123 lines, zero model calls, 122 orphans to 0. The cheapest thing on this list is the one with no model in it.",
    noModel: true,
  },
]

export function EnumerateDecideCompose() {
  const W = 900
  const LX = 16
  const LABEL = 128
  const EW = 300
  const DW = 132
  const CW = 300
  const x1 = LX + LABEL // 144  enumerate
  const x2 = x1 + EW + 8 // 452  decide
  const x3 = x2 + DW + 8 // 592  compose
  const TOP = 56
  const ROW = 92
  const SH = 46
  const H = TOP + ROWS.length * ROW + 34

  const head = (x: number, w: number, t: string, sub: string) => (
    <g key={t}>
      <text x={x + w / 2} y={22} textAnchor="middle" className="fill-foreground font-mono" style={{ fontSize: 11 }}>
        {t}
      </text>
      <text x={x + w / 2} y={36} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
        {sub}
      </text>
    </g>
  )

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the same three boxes, six times — the middle one never gets bigger
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[820px]"
        role="img"
        aria-label="Six systems drawn as the same three-stage pipeline: enumerate in code, decide with the model, compose in code. WindTunnel enumerates live WebMCP tools and Mercury writes the arguments, solving 49 of 49 tasks after 7,302 added lines of tool code. jev-linkmap enumerates anchor candidates with TF-IDF and no model at all, takes 8,460 yes-or-no answers in 5.9 seconds for 27 cents, and then a cap discards 1,704 of the 2,383 yeses. jev-semgrep enumerates thirty lines times however many meanings with a nested forEach and evaluates disjunctive normal form in the harness. json-render enumerates 42 configured element recipes in a 322-line file and composes the tree in code. Stanley builds hunk relations with regex, asks 23 typed questions and applies 69 policy constants. The last row is this site's own lib/related.ts, which enumerates and composes with 123 lines of tag arithmetic and has no model in the middle at all."
      >
        {head(x1, EW, "ENUMERATE", "deterministic code you own")}
        {head(x2, DW, "DECIDE", "the model")}
        {head(x3, CW, "COMPOSE", "deterministic code you own")}

        {ROWS.map((r, i) => {
          const t = TOP + i * ROW
          const seg = (x: number, w: number, lines: [string, string], accent: boolean) => (
            <g>
              <rect
                x={x}
                y={t}
                width={w}
                height={SH}
                rx={5}
                className={accent ? "fill-background" : "fill-muted/40"}
                stroke={accent ? PASS : "var(--border)"}
                strokeWidth={accent ? 1.8 : 1.2}
                strokeDasharray={accent && r.noModel ? "4 4" : undefined}
                opacity={accent && r.noModel ? 0.55 : 1}
              />
              <text
                x={x + 10}
                y={t + 19}
                className="fill-foreground font-mono"
                style={{ fontSize: 9.5 }}
                opacity={accent && r.noModel ? 0.6 : 1}
              >
                {lines[0]}
              </text>
              <text
                x={x + 10}
                y={t + 33}
                className="fill-foreground font-mono"
                style={{ fontSize: 9.5 }}
              >
                {lines[1]}
              </text>
            </g>
          )
          return (
            <g key={r.system}>
              <text x={LX} y={t + 19} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
                {r.system}
              </text>
              <text x={LX} y={t + 33} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
                {r.where}
              </text>

              {seg(x1, EW, r.enumerate, false)}
              {seg(x2, DW, r.decide, true)}
              {seg(x3, CW, r.compose, false)}

              {/* connectors */}
              <line x1={x1 + EW} y1={t + SH / 2} x2={x2} y2={t + SH / 2} className="stroke-border" strokeWidth={1.2} />
              <line x1={x2 + DW} y1={t + SH / 2} x2={x3} y2={t + SH / 2} className="stroke-border" strokeWidth={1.2} />

              <text x={LX} y={t + SH + 20} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
                {r.measured}
              </text>
            </g>
          )
        })}

        <text x={LX} y={H - 12} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          Box widths are semantic, not measured. The numbers under each row are.
        </text>
      </svg>
    </figure>
  )
}
