import { cn } from "@/lib/utils"

// Same three questions, asked of every programme in this piece: is the
// wiring topology fixed, are the weights on it fixed, and what's the one
// thing that actually gets trained? Laid out this way, the "does the
// connectome matter" disagreement resolves into a pattern: everyone whose
// only free parameter is a readout got a null result on wiring identity;
// everyone who trained parameters *inside* the wired network (or used the
// specific wiring to find specific cells) got a positive one.

type Cell = "frozen" | "trained" | "mixed"

type Row = {
  name: string
  topology: Cell
  weights: Cell
  trained: string
  result: string
}

const ROWS: Row[] = [
  {
    name: "flyvis (Lappalainen et al.)",
    topology: "frozen",
    weights: "trained",
    trained: "734 params: time constants, resting potentials, unitary synapse strengths",
    result: "predicts real recorded tuning",
  },
  {
    name: "conn2res reservoir / oruk",
    topology: "frozen",
    weights: "frozen",
    trained: "a ridge readout only",
    result: "scrambled wiring ties it",
  },
  {
    name: "fly-brain-escape",
    topology: "frozen",
    weights: "trained",
    trained: "~8k cell-type-level gain params",
    result: "wiring learns faster, not more accurately",
  },
  {
    name: "AxonWeave",
    topology: "frozen",
    weights: "trained",
    trained: "edge weights directly, by design",
    result: "a library, not a result",
  },
  {
    name: "FLM (fly language model)",
    topology: "frozen",
    weights: "frozen",
    trained: "a 278,528-param adapter",
    result: "matched control wins",
  },
  {
    name: "NeuroMechFly / flygym",
    topology: "mixed",
    weights: "mixed",
    trained: "a controller, for a fixed simulated body",
    result: "different question: what the body demands",
  },
]

const DOT: Record<Cell, string> = {
  frozen: "oklch(0.62 0.15 205)",
  trained: "oklch(0.6 0.14 155)",
  mixed: "oklch(0.68 0.16 40)",
}

function Pill({ state }: { state: Cell }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px]">
      <span className="size-1.5 rounded-full" style={{ background: DOT[state] }} aria-hidden />
      {state}
    </span>
  )
}

export function FrozenVsTrained() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        what's frozen, what's trained, across every programme in this piece
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b bg-muted/30 font-mono text-[11px] text-muted-foreground uppercase">
              <th className="px-4 py-2 font-medium">programme</th>
              <th className="px-3 py-2 font-medium">topology</th>
              <th className="px-3 py-2 font-medium">weights</th>
              <th className="px-3 py-2 font-medium">what's trained</th>
              <th className="px-3 py-2 font-medium">what it found</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr key={row.name} className={cn("border-b text-[12px]", i % 2 ? "bg-muted/10" : "")}>
                <td className="px-4 py-2.5 font-medium text-foreground">{row.name}</td>
                <td className="px-3 py-2.5">
                  <Pill state={row.topology} />
                </td>
                <td className="px-3 py-2.5">
                  <Pill state={row.weights} />
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{row.trained}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{row.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t px-4 py-3 font-mono text-[11px] leading-5 text-muted-foreground">
        Every row with weights frozen and only a readout trained found the wiring's{" "}
        <em>identity</em> didn&rsquo;t matter. Every row that trained parameters inside the wired
        network &mdash; or used the wiring to pick out specific, otherwise-anonymous cells &mdash;
        found something real.
      </div>
    </figure>
  )
}
