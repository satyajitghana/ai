// Everything the host does around the network, per the released Space bundle.
//
// Three things decide what ChessLFM plays, and none of them is a weight: a
// legal-move generator that builds the mask, a minimax loop that spends up to
// 602 forward passes per move, and a one-line device check that switches that
// loop off. Node and pass counts below are derived from the shipped defaults
// (searchDepth 3, searchRootTopK 12, searchTopK 6) and the shipped decode
// (evaluateBoard = 2 passes per interior node, evaluateValue = 1 per leaf).
//
// Server-rendered, zero JS. Every number is integer arithmetic.

const ROOT_TOPK = 12
const CHILD_TOPK = 6
const DEPTH = 3

const LEVELS = [
  { name: "root", nodes: 1, passes: 2, what: "value + policy" },
  { name: "ply 1", nodes: ROOT_TOPK, passes: 2, what: "value + policy" },
  { name: "ply 2", nodes: ROOT_TOPK * CHILD_TOPK, passes: 2, what: "value + policy" },
  { name: "ply 3", nodes: ROOT_TOPK * CHILD_TOPK * CHILD_TOPK, passes: 1, what: "value only" },
]

const TOTAL_NODES = LEVELS.reduce((s, l) => s + l.nodes, 0)
const TOTAL_PASSES = LEVELS.reduce((s, l) => s + l.nodes * l.passes, 0)
const POLICY_PASSES = 2

const ACCENT = "oklch(0.60 0.15 255)"
const WARN = "oklch(0.65 0.16 45)"

const GUARDS = [
  {
    fn: "evaluateBoard",
    what: "Priors come only from chess.js legal moves; their logits are gathered out of the 1,969-wide move slice and softmaxed over that subset alone.",
  },
  {
    fn: "the turn handler",
    what: "Candidates are filtered a second time against legalUcis() before a move is picked.",
  },
  {
    fn: "the same handler",
    what: "If that filter empties the list, it plays legalUcis()[0] — whatever move the generator happens to emit first.",
  },
  {
    fn: "the move applier",
    what: "If applying the chosen move throws, it catches, logs, and plays legalUcis()[0] instead.",
  },
]

export function DemoPath() {
  const maxPasses = Math.max(...LEVELS.map((l) => l.nodes * l.passes))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          what the host does around the network
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          defaults and control flow from the Space bundle
        </span>
      </div>

      <div className="p-4">
        <div className="mb-2 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
          1 &middot; the device decides whether the advertised engine runs
        </div>
        <pre className="my-0 overflow-x-auto rounded-lg border bg-muted/30 px-3 py-2 font-mono text-[10.5px] leading-5">
          <code>{`te(rt => ({ ...rt,
  useSearch:   Ne.device === "webgpu",
  searchDepth: Ne.device === "webgpu" ? 3 : 0
}))`}</code>
        </pre>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div
            className="rounded-lg border px-3 py-2"
            style={{ borderColor: "oklch(0.60 0.15 255 / 0.45)" }}
          >
            <div className="font-mono text-[11px]" style={{ color: ACCENT }}>
              WebGPU adapter present
            </div>
            <p className="mt-1 mb-0 text-xs leading-5 text-muted-foreground">
              <code className="font-mono">searchDepth: 3</code> &mdash; the depth-3
              minimax configuration the 2004 Elo was measured in.
            </p>
          </div>
          <div
            className="rounded-lg border px-3 py-2"
            style={{ borderColor: "oklch(0.65 0.16 45 / 0.45)" }}
          >
            <div className="font-mono text-[11px]" style={{ color: WARN }}>
              no adapter &rarr; WASM fallback
            </div>
            <p className="mt-1 mb-0 text-xs leading-5 text-muted-foreground">
              <code className="font-mono">searchDepth: 0</code> &mdash; search off,
              the raw one-pass policy, which the model card puts at roughly 1500.
            </p>
          </div>
        </div>
        <p className="mt-2 mb-0 text-xs leading-5 text-muted-foreground">
          The same bundle&apos;s Elo tooltip says &ldquo;the demo plays that exact
          configuration.&rdquo; On a browser without WebGPU it does not, and there is a
          second, quieter path to the same place: if the search throws, the handler
          retries with{" "}
          <code className="font-mono">{`{ useSearch: false, searchDepth: 0, topK: 1 }`}</code>{" "}
          and logs to the console.
        </p>

        <div className="mt-6 mb-2 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
          2 &middot; when it does run, the search costs {TOTAL_PASSES} forward passes
        </div>
        <div className="space-y-1.5">
          {LEVELS.map((l) => {
            const passes = l.nodes * l.passes
            return (
              <div key={l.name} className="flex items-center gap-2">
                <span className="w-12 shrink-0 font-mono text-[10px] text-muted-foreground">
                  {l.name}
                </span>
                <div className="h-3.5 min-w-0 flex-1 rounded-sm bg-muted/40">
                  <div
                    className="h-3.5 rounded-sm"
                    style={{
                      width: `${Math.max((passes / maxPasses) * 100, 1.2)}%`,
                      background: ACCENT,
                      opacity: 0.85,
                    }}
                  />
                </div>
                <span className="w-40 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                  {l.nodes} &times; {l.passes} = {passes} &middot; {l.what}
                </span>
              </div>
            )
          })}
        </div>
        <p className="mt-2 mb-0 text-xs leading-5 text-muted-foreground">
          {TOTAL_NODES} nodes, {TOTAL_PASSES} forward passes, depth {DEPTH}, before
          alpha-beta cutoffs and the FEN cache trim it. The announcement describes this
          as evaluating about 430 positions; 432 is the leaf count, and each of the{" "}
          {TOTAL_NODES - LEVELS[3].nodes} interior nodes needs two passes, not one,
          because the policy logits are only available after the value token has been
          appended. Against the raw policy&apos;s {POLICY_PASSES} passes, that is{" "}
          {TOTAL_PASSES / POLICY_PASSES}&times; the compute per move.
        </p>

        <div className="mt-6 mb-2 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
          3 &middot; four independent guarantees that the move is legal
        </div>
        <ol className="my-0 list-none space-y-1.5 pl-0">
          {GUARDS.map((g, i) => (
            <li key={i} className="flex gap-2 text-xs leading-5 text-muted-foreground">
              <span className="w-4 shrink-0 font-mono text-[10px] text-foreground/60">
                {i + 1}
              </span>
              <span>
                <code className="font-mono text-[11px] text-foreground/80">{g.fn}</code>{" "}
                &mdash; {g.what}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-2 mb-0 text-xs leading-5 text-muted-foreground">
          Measured over 1,700 positions with all four removed, the network&apos;s own
          top choice was already legal 99.65% of the time.
        </p>
      </div>
    </figure>
  )
}
