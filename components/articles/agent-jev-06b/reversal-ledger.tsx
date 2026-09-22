// Every option-order measurement this site has on record, plus the new one.
//
// The test is always the same: send a decision twice with the option list in a
// different order, realign the answers, and count the ones that changed. It is
// the one experiment that reads a model's architecture from the outside, and it
// costs an afternoon.
//
// Server-rendered SVG, zero JS. Bar widths are +, -, * and / on the measured
// counts; the magnitude column is text.

type Row = {
  model: string
  family: string
  flips: number
  n: number
  magnitude: string
  source: string
  highlight?: boolean
}

const ROWS: Row[] = [
  {
    model: "openjev — Qwen3.5-4B",
    family: "vocabulary readout, letters in one prompt",
    flips: 10,
    n: 36,
    magnitude: "+1.71 logits for slot A",
    source: "/articles/what-decision-models-cannot-do",
  },
  {
    model: "Jev 1.13 — hosted",
    family: "per-option scorer, two-stage above threshold",
    flips: 12,
    n: 100,
    magnitude: "vector moves up to 0.69",
    source: "/articles/jev-is-not-deterministic",
  },
  {
    model: "kev — Qwen2.5-0.5B + LoRA",
    family: "pointer head over a shared prompt",
    flips: 1,
    n: 36,
    magnitude: "not reported",
    source: "/articles/any-model-can-be-jev",
  },
  {
    model: "Jev 1.13 — hosted, kev's probe",
    family: "same model, 36-item perturbation set",
    flips: 0,
    n: 36,
    magnitude: "not reported",
    source: "/articles/any-model-can-be-jev",
  },
  {
    model: "AgentJev-0.6B",
    family: "shared prefix, private branches, set head",
    flips: 0,
    n: 28,
    magnitude: "4.8e-07 logits — one float32 ULP",
    source: "measured here",
    highlight: true,
  },
]

const BAR = 128

function Rate({ flips, n, highlight }: { flips: number; n: number; highlight?: boolean }) {
  const w = (flips / n) * BAR
  return (
    <svg viewBox={`0 0 ${BAR} 12`} className="w-full max-w-[128px]" role="presentation">
      <rect x={0} y={2} width={BAR} height={8} rx={2} className="fill-foreground/8" />
      {flips > 0 ? (
        <rect
          x={0}
          y={2}
          width={w < 2 ? 2 : w}
          height={8}
          rx={2}
          className={highlight ? "fill-foreground/80" : "fill-foreground/45"}
        />
      ) : (
        <line x1={0} y1={6} x2={6} y2={6} className="stroke-foreground/50" strokeWidth={2} />
      )}
    </svg>
  )
}

export function ReversalLedger() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the same option list, sent twice in two orders · how often the answer changed
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2 text-left font-mono text-[11px] tracking-wide text-muted-foreground">
                model
              </th>
              <th className="px-3 py-2 text-left font-mono text-[11px] tracking-wide text-muted-foreground">
                answers changed
              </th>
              <th className="px-3 py-2 text-left font-mono text-[11px] tracking-wide text-muted-foreground">
                how far anything moved
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.model} className="border-t border-border/60 align-top">
                <td className="px-3 py-3">
                  <div className={r.highlight ? "font-mono text-sm font-medium" : "font-mono text-sm"}>
                    {r.model}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">{r.family}</div>
                </td>
                <td className="px-3 py-3">
                  <Rate flips={r.flips} n={r.n} highlight={r.highlight} />
                  <div className="mt-1 font-mono text-xs">
                    {r.flips} / {r.n}
                    <span className="text-muted-foreground">
                      {" "}
                      · {((r.flips / r.n) * 100).toFixed(r.flips ? 1 : 2)}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="font-mono text-xs">{r.magnitude}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {r.source.startsWith("/") ? (
                      <a className="underline decoration-foreground/30 underline-offset-2" href={r.source}>
                        {r.source.replace("/articles/", "")}
                      </a>
                    ) : (
                      r.source
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
        The two hosted rows are the same model on different item sets, and they are in mild
        tension: a true 12% rate produces 0 of 36 about one time in a hundred. The likeliest
        reconciliation is cardinality — the 12% suite permutes 77 Banking77 labels, kev&apos;s
        36 items carry a handful of options each. The AgentJev row is a different kind of
        number: the answer did not change because nothing in the arithmetic changed by more
        than one unit in the last place of a float32.
      </figcaption>
    </figure>
  )
}
