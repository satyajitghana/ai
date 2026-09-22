// The one part of SEIG that is not standing in for a capability: who is allowed
// to write what.
//
// Read out of the method section sentence by sentence. The material stage runs
// through "a material-only tool that permits only material-related edits"; the
// composition stage "is not allowed to edit object geometry or materials"; the
// lighting stage optimises lighting "while keeping object shape, appearance,
// layout, and camera fixed". Those are not orderings, they are permissions, and
// they are enforced by the tool the agent is handed rather than by an
// instruction it reads.
//
// The blanks are as important as the marks. The geometry stage's permissions are
// never stated, and there is no code release, so I cannot fill that row in.
//
// Server-rendered, zero JS.
type Cell = "write" | "frozen" | "unstated"

const FACTORS = ["geometry", "material", "layout", "lighting", "camera"] as const

const STAGES: { stage: string; note: string; cells: Cell[] }[] = [
  {
    stage: "initialization",
    note: "creates every leaf node; lighting and camera set coarsely",
    cells: ["write", "write", "write", "write", "write"],
  },
  {
    stage: "geometry",
    note: "local shape edits, transforms, structural edits — no freeze stated",
    cells: ["write", "unstated", "unstated", "unstated", "unstated"],
  },
  {
    stage: "material",
    note: "“a material-only tool that permits only material-related edits”",
    cells: ["frozen", "write", "frozen", "frozen", "frozen"],
  },
  {
    stage: "composition",
    note: "“not allowed to edit object geometry or materials”; may move the camera",
    cells: ["frozen", "frozen", "write", "unstated", "write"],
  },
  {
    stage: "lighting",
    note: "“keeping object shape, appearance, layout, and camera fixed”",
    cells: ["frozen", "frozen", "frozen", "write", "frozen"],
  },
]

const MARK: Record<Cell, { glyph: string; cls: string; label: string }> = {
  write: { glyph: "write", cls: "bg-foreground text-background", label: "may write" },
  frozen: { glyph: "frozen", cls: "border border-foreground/30 text-muted-foreground", label: "frozen by the tool" },
  unstated: { glyph: "—", cls: "text-muted-foreground/50", label: "not stated in the paper" },
}

export function StagePermissions() {
  const frozen = STAGES.reduce((n, s) => n + s.cells.filter((c) => c === "frozen").length, 0)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        which stage may write which scene factor
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr>
              <th className="px-3 py-2 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                stage
              </th>
              {FACTORS.map((f) => (
                <th
                  key={f}
                  className="px-2 py-2 text-center font-mono text-[10px] tracking-wide text-muted-foreground uppercase"
                >
                  {f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STAGES.map((s) => (
              <tr key={s.stage} className="border-t">
                <td className="px-3 py-2.5 align-top">
                  <p className="font-mono text-[12px] text-foreground">{s.stage}</p>
                  <p className="mt-0.5 max-w-[22ch] text-[10.5px] leading-4 text-muted-foreground">
                    {s.note}
                  </p>
                </td>
                {s.cells.map((c, i) => (
                  <td key={FACTORS[i]} className="px-2 py-2.5 text-center align-top">
                    <span
                      title={MARK[c].label}
                      className={`inline-block rounded px-1.5 py-0.5 font-mono text-[9.5px] tracking-wide uppercase ${MARK[c].cls}`}
                    >
                      {MARK[c].glyph}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
        {frozen} of the 25 cells are frozen by the tool the agent is handed, not by a line in
        its prompt. That is the guarantee — and it is also, word for word, the paper&apos;s own
        limitation: errors from an early stage &quot;may propagate throughout the pipeline,
        leading to local minima from which later stages cannot easily recover.&quot;
      </figcaption>
    </figure>
  )
}
