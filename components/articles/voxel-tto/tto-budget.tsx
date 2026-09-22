// What one scene costs, and how the paper's two runtime numbers reconcile.
//
// Section 4.7 states four things about ten 518x518 images: VoxelTTO without
// TTO takes 2.304 s; BF16 cuts the backbone from 1.959 s to 0.1956 s; a TTO
// step is 0.2662 s forward plus 0.075 s backward; "20 steps complete in under
// 7 s and total runtime is under 7.4 s".
//
// Naively 6.824 + 2.304 = 9.13 s, which is not under 7.4. The reconciliation
// is that 2.304 s is the FP32-backbone figure used for the Figure 8 comparison
// against baselines at their official precision. Swap in the BF16 backbone and
// the feed-forward pass is 2.304 - 1.959 + 0.1956 = 0.5406 s, so
// 6.824 + 0.5406 = 7.3646 s — "under 7.4 s", to three significant figures.
//
// That reconstruction is MINE, not the paper's: the decomposition bar below is
// reasoned, the four inputs to it are reported. Server-rendered, zero JS.

const FWD = "oklch(0.60 0.15 255)" // TTO forward
const BWD = "oklch(0.72 0.15 195)" // TTO backward
const FF = "oklch(0.55 0.16 155)" // the feed-forward pass itself

const STEPS = 20
const STEP_FWD = 0.2662
const STEP_BWD = 0.075
const TTO_FWD = STEPS * STEP_FWD // 5.324
const TTO_BWD = STEPS * STEP_BWD // 1.500
const TTO = TTO_FWD + TTO_BWD // 6.824

const BASE_REPORTED = 2.304 // with the FP32 backbone
const BACKBONE_FP32 = 1.959
const BACKBONE_BF16 = 0.1956
const REST = BASE_REPORTED - BACKBONE_FP32 // 0.345 — voxels, U-Net, decoder, render
const FEEDFWD = REST + BACKBONE_BF16 // 0.5406
const TOTAL = TTO + FEEDFWD // 7.3646

const W = 700
const H = 250
const BAR_X = 22
const BAR_W = W - 44
const BAR_Y = 92
const BAR_H = 44
const UNIT = BAR_W / TOTAL

export function TtoBudget() {
  const segs = [
    { label: "TTO forward", v: TTO_FWD, c: FWD },
    { label: "TTO backward", v: TTO_BWD, c: BWD },
    { label: "the actual reconstruction", v: FEEDFWD, c: FF },
  ]
  let acc = 0

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one scene · ten 518×518 images</span>
        <span className="text-muted-foreground/60">
          {TOTAL.toFixed(2)} s end to end
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`A single bar of ${TOTAL.toFixed(2)} seconds split into three parts: ${TTO_FWD.toFixed(2)} seconds of test-time-optimisation forward passes, ${TTO_BWD.toFixed(2)} seconds of backward passes, and ${FEEDFWD.toFixed(2)} seconds for the feed-forward reconstruction itself. Test-time optimisation is 92.7 percent of the per-scene cost and 12.6 times the reconstruction it is correcting.`}
        >
          <text x={BAR_X} y={30} className="fill-foreground font-mono" fontSize={11}>
            where a scene&apos;s seven seconds go
          </text>
          <text
            x={BAR_X}
            y={48}
            className="fill-muted-foreground font-mono"
            fontSize={9.5}
          >
            {STEPS} LoRA steps at {STEP_FWD} s forward + {STEP_BWD} s backward,
            then the reconstruction
          </text>

          {segs.map((s) => {
            const x = BAR_X + acc * UNIT
            const w = s.v * UNIT
            acc += s.v
            return (
              <g key={s.label}>
                <rect
                  x={x}
                  y={BAR_Y}
                  width={w}
                  height={BAR_H}
                  fill={s.c}
                  fillOpacity={0.82}
                />
                <text
                  x={x + 8}
                  y={BAR_Y + 19}
                  className="fill-background font-mono"
                  fontSize={11}
                  fontWeight={600}
                >
                  {s.v.toFixed(2)} s
                </text>
                {w > 110 ? (
                  <text
                    x={x + 8}
                    y={BAR_Y + 34}
                    className="fill-background font-mono"
                    fontSize={9}
                  >
                    {s.label}
                  </text>
                ) : null}
              </g>
            )
          })}

          {/* the small one gets a leader line rather than a squeezed label */}
          <line
            x1={BAR_X + (TTO + FEEDFWD / 2) * UNIT}
            x2={BAR_X + (TTO + FEEDFWD / 2) * UNIT}
            y1={BAR_Y + BAR_H}
            y2={BAR_Y + BAR_H + 16}
            stroke={FF}
            strokeWidth={1}
          />
          <text
            x={W - 24}
            y={BAR_Y + BAR_H + 28}
            textAnchor="end"
            fill={FF}
            className="font-mono"
            fontSize={9.5}
          >
            the actual reconstruction
          </text>

          <line
            x1={BAR_X}
            x2={W - 22}
            y1={172}
            y2={172}
            stroke="currentColor"
            className="text-border"
            strokeWidth={1}
          />

          {[
            {
              x: BAR_X,
              n: `${((TTO / TOTAL) * 100).toFixed(1)}%`,
              k: "of the per-scene cost is TTO",
            },
            {
              x: 262,
              n: `${(TTO / FEEDFWD).toFixed(1)}×`,
              k: "the pass it is correcting",
            },
            {
              x: 498,
              n: `${(TOTAL / 2.293).toFixed(1)}×`,
              k: "DA3's 2.293 s baseline",
            },
          ].map((r) => (
            <g key={r.k}>
              <text
                x={r.x}
                y={204}
                className="fill-foreground font-mono"
                fontSize={22}
              >
                {r.n}
              </text>
              <text
                x={r.x}
                y={222}
                className="fill-muted-foreground font-mono"
                fontSize={9.5}
              >
                {r.k}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </figure>
  )
}
