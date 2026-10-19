import { mediaUrl } from "@/lib/media"

// earshot 0.3.0 (commit 925ebe5), `earshot sfx render whoosh_fast/crisp`, run by us on a shared 4-core CPU VM
// on 19 Oct 2026 (2 threads, nice 19). "delivered" is the bank entry at its own seed; "aimed" is the same id with
// --dur 0.8 --apex 0.32. Lengths and loudest-5-ms times were measured by us on the WAVs (5 ms windows, 1 ms hop)
// and agree with earshot's own meta. Both takes are stereo at a -1 dBFS peak, summed to mono at one gain for the
// page, followed by 0.25 s of silence, and encoded as 32 kb/s Opus. A server component: no client JS.

const FPS = 60
const SPAN = 1.1 // s, the right edge of the timeline
const W = 600
const X0 = 8
const X1 = W - 8

const x = (t: number) => (X0 + ((X1 - X0) * t) / SPAN).toFixed(2)

const TAKES = [
  {
    id: "delivered",
    label: "as delivered (bank entry, its own seed)",
    dur: 1.0561,
    peak: 0.1305,
  },
  {
    id: "aimed",
    label: "aimed: --dur 0.8 --apex 0.32",
    dur: 0.8,
    peak: 0.3205,
  },
]

const frames = Array.from({ length: Math.floor(SPAN * FPS) + 1 }, (_, k) => k)

export function AimedTake() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
        {TAKES.map((t) => (
          <label key={t.id} className="block">
            <span className="font-mono text-[11px]">
              {t.label}, {t.dur.toFixed(3)} s
            </span>
            <audio
              controls
              preload="none"
              src={mediaUrl(`/articles/earshot/sfx_whoosh_crisp-${t.id}.webm`)}
              className="mt-1 w-full"
            />
          </label>
        ))}
      </div>
      <div className="px-3 pb-3 sm:px-4" aria-hidden="true">
        <svg viewBox={`0 0 ${W} 92`} className="w-full" role="presentation">
          {frames.map((k) => (
            <line
              key={k}
              x1={x(k / FPS)}
              x2={x(k / FPS)}
              y1={k % 6 === 0 ? 4 : 8}
              y2={78}
              className="stroke-muted-foreground"
              strokeOpacity={k % 6 === 0 ? 0.35 : 0.12}
              strokeWidth={1}
            />
          ))}
          <line x1={x(0.32)} x2={x(0.32)} y1={2} y2={80} className="stroke-amber-500" strokeWidth={1.5} strokeDasharray="3 3" />
          {TAKES.map((t, i) => {
            const y = 14 + i * 34
            return (
              <g key={t.id}>
                <rect
                  x={x(0)}
                  y={y}
                  width={(Number(x(t.dur)) - X0).toFixed(2)}
                  height={22}
                  rx={4}
                  className="fill-muted stroke-border"
                />
                <rect x={(Number(x(t.peak)) - 2).toFixed(2)} y={y - 2} width={4} height={26} rx={1} className="fill-foreground" />
                <text x={(Number(x(t.peak)) + 6).toFixed(2)} y={y + 15} className="fill-foreground font-mono" fontSize={10}>
                  loudest at {t.peak.toFixed(4)} s
                </text>
              </g>
            )
          })}
          <text x={X0} y={90} className="fill-muted-foreground font-mono" fontSize={9}>
            0 s
          </text>
          <text x={x(0.32)} y={90} textAnchor="middle" className="fill-amber-500 font-mono" fontSize={9}>
            target 0.32 s
          </text>
          <text x={X1} y={90} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
            {SPAN} s
          </text>
        </svg>
      </div>
      <figcaption className="border-t px-4 py-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
        One bank sound, two takes: earshot 0.3.0 on a shared 4-core CPU VM, 19 Oct 2026, measured by us. Thin ticks are
        frames at 60 fps (16.7 ms), thick ones every 0.1 s. The aimed take&apos;s loudest 5 ms lands 0.5 ms after the
        target. Both share one gain; stereo summed to mono, Opus at 32 kb/s.
      </figcaption>
    </figure>
  )
}
