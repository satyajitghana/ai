// The RL run, as a ledger rather than a curve.
//
// Every figure below is printed on Xiaomi's MiMo-V2.6 announcement or in the
// technical report; none is derived by me except the per-step cost, which is
// just the stated total divided by the stated 30 steps. The reason to lay it
// out this way is that "we scaled RL compute" is the claim of the release, and
// scaling claims are only checkable when the unit costs are visible.
//
// Server-rendered, zero JS.

type Row = {
  label: string
  pro: string
  flash: string
  note?: string
}

const ROWS: Row[] = [
  { label: "RL steps", pro: "30", flash: "30" },
  { label: "trajectories", pro: "~750k", flash: "~750k" },
  {
    label: "prompts × rollouts per step",
    pro: "1,568 × 16",
    flash: "1,568 × 16",
  },
  { label: "tokens per step", pro: "2.7–3.7B", flash: "2.7–3.7B" },
  { label: "max context in training", pro: "1M", flash: "1M" },
  { label: "wall clock", pro: "under 6 days", flash: "under 6 days" },
  { label: "reported cost", pro: "$2.62M", flash: "$0.85M" },
  {
    label: "cost per RL step",
    pro: "$87.3k",
    flash: "$28.3k",
    note: "total ÷ 30",
  },
  {
    label: "DeepSWE v1.1, start → end of RL",
    pro: "58.4 → 72.57",
    flash: "48.8 → 65.68",
  },
  {
    label: "DeepSWE v1.1, released checkpoint",
    pro: "71.9",
    flash: "67.9",
    note: "model card, after MOPD2",
  },
  {
    label: "training-set pass rate",
    pro: "+12% relative",
    flash: "+25% relative",
  },
]

export function RlLedger() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        The production RL run · Xiaomi&rsquo;s own figures
      </div>
      <table className="my-0 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-mono text-xs font-medium text-muted-foreground">
              &nbsp;
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs font-medium">
              Pro · 1.02T / 42B
            </th>
            <th className="px-3 py-2 text-right font-mono text-xs font-medium">
              Flash · 310B / 15B
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.label} className="border-b last:border-b-0">
              <td className="px-3 py-2 align-top">
                {r.label}
                {r.note ? (
                  <span className="ml-1 font-mono text-xs text-muted-foreground">
                    ({r.note})
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs whitespace-nowrap tabular-nums">
                {r.pro}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs whitespace-nowrap tabular-nums">
                {r.flash}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        Reported, not measured — I have not run a step of this. The two DeepSWE
        rows differ because the blog quotes the end of the RL run and the model
        card quotes the shipped checkpoint, which went through a distillation
        stage afterwards.
      </figcaption>
    </figure>
  )
}
