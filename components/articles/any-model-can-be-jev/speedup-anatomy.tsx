// Where the "63x faster" comes from, taken apart with the author's own committed
// rows. The headline is the best of five cases on one machine; the other four on
// the same machine and the same day run 1.09x, 3.16x, 4.36x and 24.91x.
//
// The reason is not subtle once the rows are lined up: the baseline's latency is
// a straight line in the number of tokens it was asked to emit, and the cases
// differ almost entirely in that number. Fitted on these five points:
//
//   L40S   autoregressive   95.4 ms + 15.21 ms per decode step      R^2 = 0.983
//   L40S   constrained      48.6 ms + 0.0392 ms per branch token    R^2 = 0.923
//
// so the speedup is (95.4 + 15.21*G) / (48.6 + 0.0392*B) and you choose it by
// choosing G and B. Everything here is computed in the scratchpad from
// results/l40s-stress.json and pasted as literals; nothing transcendental runs
// at render time.
//
// Server-rendered, zero JS. Bar widths are integer/float division, which is
// exact per IEEE-754 and identical in Node and the browser.

interface Row {
  case: string
  gen: number // autoregressive generated tokens
  ar: number // autoregressive mean latency, ms
  branches: number
  padded: number // branch_tokens_padded
  con: number // constrained mean latency, ms
  speedup: number
  headline?: boolean
}

// results/l40s-stress.json — 5 cases, 2 warmups + 3 measured repeats each,
// seed 42, FP16, PyTorch eager attention, batch_size_requests = 1.
const ROWS: Row[] = [
  { case: "enum-255", gen: 13, ar: 187.5, branches: 255, padded: 3060, con: 172.8, speedup: 1.09 },
  { case: "long-context", gen: 10, ar: 167.5, branches: 3, padded: 27, con: 53.1, speedup: 3.16 },
  { case: "enum-64", gen: 13, ar: 286.8, branches: 64, padded: 768, con: 65.9, speedup: 4.36 },
  { case: "fields-12", gen: 98, ar: 1908.1, branches: 24, padded: 216, con: 76.6, speedup: 24.91 },
  { case: "fields-28", gen: 226, ar: 3404.5, branches: 56, padded: 504, con: 54.1, speedup: 62.91, headline: true },
]

const MAXSPEED = 62.91

// Fitted per machine on the same five cases.
const FITS = [
  { machine: "H100", step: 11.4, branch: 0.0257, ratio: 444 },
  { machine: "L40S", step: 15.21, branch: 0.0392, ratio: 388 },
  { machine: "M2 Max", step: 13.74, branch: 0.5732, ratio: 24 },
]

export function SpeedupAnatomy() {
  return (
    <figure className="my-8 space-y-4">
      <div className="overflow-x-auto rounded-md border">
        <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
          L40S · the same five stress cases · the headline is the last row
        </div>
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left font-mono text-xs text-muted-foreground">
              <th className="px-3 py-2 font-normal">case</th>
              <th className="px-3 py-2 text-right font-normal">AR tokens</th>
              <th className="px-3 py-2 text-right font-normal">AR ms</th>
              <th className="px-3 py-2 text-right font-normal">branch tokens</th>
              <th className="px-3 py-2 text-right font-normal">scored ms</th>
              <th className="px-3 py-2 font-normal">speedup</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {ROWS.map((r) => (
              <tr key={r.case} className="border-b last:border-0">
                <td className={`px-3 py-2 ${r.headline ? "font-semibold text-foreground" : "text-foreground/80"}`}>
                  {r.case}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.gen}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.ar.toFixed(1)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.padded}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.con.toFixed(1)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 rounded-sm ${r.headline ? "bg-foreground" : "bg-foreground/30"}`}
                      style={{ width: `${(r.speedup / MAXSPEED) * 100}%`, minWidth: "2px" }}
                    />
                    <span className={`tabular-nums ${r.headline ? "font-semibold" : "text-muted-foreground"}`}>
                      {r.speedup.toFixed(2)}&times;
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
          the two costs, fitted on those five points — a decode step is the same price everywhere
        </div>
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left font-mono text-xs text-muted-foreground">
              <th className="px-3 py-2 font-normal">machine</th>
              <th className="px-3 py-2 text-right font-normal">ms per decode step</th>
              <th className="px-3 py-2 text-right font-normal">ms per batched branch token</th>
              <th className="px-3 py-2 text-right font-normal">ratio</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {FITS.map((f) => (
              <tr key={f.machine} className="border-b last:border-0">
                <td className="px-3 py-2 text-foreground/80">{f.machine}</td>
                <td className="px-3 py-2 text-right tabular-nums">{f.step.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{f.branch.toFixed(4)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{f.ratio}&times;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <figcaption className="text-xs leading-relaxed text-muted-foreground">
        Both tables are computed from{" "}
        <code className="font-mono">results/l40s-stress.json</code>,{" "}
        <code className="font-mono">h100-stress.json</code> and{" "}
        <code className="font-mono">m2-max-stress.json</code> in the release, five
        cases each, mean of three measured repeats. The fits are ordinary least
        squares of latency against token count across those five points; R&sup2; is
        0.98&ndash;1.00 for the autoregressive line and 0.92&ndash;0.97 for the
        scored one. Read the middle column: one decode step costs about the same
        on a laptop as on an H100, because a 350M model emitting one token at a
        time in eager PyTorch is bound by per-step overhead rather than by the
        machine.
      </figcaption>
    </figure>
  )
}
