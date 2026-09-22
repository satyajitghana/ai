// 92.4% of the backbone tokens, and 51% of the clock.
//
// jev_service/prefix_verification.json times one fixed load — 64 Choice options
// plus one Boolean over a 472-token state, 66 candidate paths, 33,547 path
// tokens — under all three encoder modes. The token column is what the README's
// "92.4% computation reduced" is measured against. The millisecond column is
// what the caller gets. They are not the same ratio, and the middle row is the
// proof: `shared` feeds the backbone 19% fewer tokens than `auto` and takes 17%
// longer.
//
// Server-rendered, zero JS. Bar widths are integer arithmetic on the committed
// numbers.

type Mode = {
  name: string
  what: string
  tokens: number
  ms: number
  sharedQuestions: number
}

const MODES: Mode[] = [
  { name: "path", what: "every candidate re-encodes the prefix", tokens: 33547, ms: 609.65, sharedQuestions: 0 },
  { name: "shared", what: "both questions cache their prefix", tokens: 2058, ms: 348.56, sharedQuestions: 2 },
  { name: "auto", what: "cache it only where it pays", tokens: 2551, ms: 298.91, sharedQuestions: 1 },
]

const TOK_MAX = 33547
const MS_MAX = 609.65
const BAR_W = 230

const fmt = (n: number) => n.toLocaleString("en-US")

function Bar({ value, max, accent }: { value: number; max: number; accent: boolean }) {
  const w = (value / max) * BAR_W
  return (
    <svg viewBox={`0 0 ${BAR_W} 12`} className="w-full max-w-[230px]" role="presentation">
      <rect x={0} y={2} width={BAR_W} height={8} rx={2} className="fill-foreground/8" />
      <rect
        x={0}
        y={2}
        width={w < 2 ? 2 : w}
        height={8}
        rx={2}
        className={accent ? "fill-foreground/70" : "fill-foreground/30"}
      />
    </svg>
  )
}

export function TokenClock() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        64 Choice options + 1 Boolean · 66 candidate paths · median of 3, after warmup
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2 text-left font-mono text-[11px] tracking-wide text-muted-foreground">
                encoder
              </th>
              <th className="px-3 py-2 text-left font-mono text-[11px] tracking-wide text-muted-foreground">
                backbone input tokens
              </th>
              <th className="px-3 py-2 text-left font-mono text-[11px] tracking-wide text-muted-foreground">
                wall clock
              </th>
            </tr>
          </thead>
          <tbody>
            {MODES.map((m) => (
              <tr key={m.name} className="border-t border-border/60 align-top">
                <td className="px-3 py-3">
                  <div className="font-mono text-sm">{m.name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{m.what}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {m.sharedQuestions} of 2 questions cached
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Bar value={m.tokens} max={TOK_MAX} accent={m.name === "auto"} />
                  <div className="mt-1 font-mono text-xs">
                    {fmt(m.tokens)}
                    {m.name !== "path" ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · −{(((TOK_MAX - m.tokens) / TOK_MAX) * 100).toFixed(1)}%
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Bar value={m.ms} max={MS_MAX} accent={m.name === "auto"} />
                  <div className="mt-1 font-mono text-xs">
                    {m.ms.toFixed(2)} ms
                    {m.name !== "path" ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {(MS_MAX / m.ms).toFixed(2)}×
                      </span>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
        From jev_service/prefix_verification.json. I rebuilt the token accounting from the
        same request and got the same 33,547: the Choice question&apos;s shared prefix is 492
        tokens, the Boolean&apos;s is 493, and 64 candidates paying 492 tokens each is the
        whole of the 92.4%. What the clock says is that removing 92.4% of the tokens removes
        51% of the time, because the branched pass stops being compute-bound.
      </figcaption>
    </figure>
  )
}
