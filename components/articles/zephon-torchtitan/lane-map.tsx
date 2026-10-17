"use client"

import { useMemo, useState } from "react"

// Lanes vs ranks. The global batch of the paper's 1B run is N = 448 packed
// sequences, consumed as microbatches of m = 7, so every optimizer step is
// N / m = 64 microbatches. Zephon splits the stream into L lanes; a data-
// parallel world of G replicas takes L / G lanes each (contiguous blocks, the
// engine's default mapping). The rules the integration enforces:
//   G | L       every replica owns the same number of lanes
//   L | N / m   every lane hands over whole microbatches each step
// In "lanes" mode a record's content is a pure function of (seed, step, lane,
// index in lane), so the batch fingerprint never moves when G changes. In
// "rank-sharded" mode (a DistributedSampler-style loader with per-rank
// packing) content depends on (G, rank), so it does. The hashes are a toy
// integer mix, not SHA-256, and the colours are illustrative.

const N = 448
const MB = 7
const MICRO = N / MB // 64
const SEED = 42
const BASE_G = 16

const LANE_OPTS = [8, 16, 32, 64, 128]
const G_OPTS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64]

const W = 720
const COLS = 32
const ROWS = N / COLS // 14
const CW = W / COLS
const CH = 15
const BAR_Y = 26
const BAR_H = 20
const GRID_Y = 92

function mix(...xs: number[]): number {
  let h = 0x811c9dc5 | 0
  for (const x of xs) {
    h = Math.imul(h ^ (x | 0), 0x01000193)
    h ^= h >>> 13
    h = Math.imul(h, 0x5bd1e995)
    h ^= h >>> 15
  }
  return h >>> 0
}

type Mode = "lanes" | "sharded"

function contents(mode: Mode, L: number, G: number, step: number): number[] {
  const out: number[] = []
  if (mode === "lanes") {
    const q = N / L
    for (let lane = 0; lane < L; lane++) {
      for (let k = 0; k < q; k++) out.push(mix(SEED, step, lane, k))
    }
  } else {
    const per = N / G
    for (let r = 0; r < G; r++) {
      for (let j = 0; j < per; j++) out.push(mix(SEED, step, 1000 + G, r, j))
    }
  }
  return out
}

function fingerprint(vals: number[]): string {
  let h = 0x811c9dc5 | 0
  for (const v of vals) h = Math.imul(h ^ v, 0x01000193)
  return (h >>> 0).toString(16).padStart(8, "0")
}

function problem(L: number, G: number): string | null {
  if (MICRO % L !== 0)
    return `${N} sequences / ${MB} per microbatch = ${MICRO} microbatches per step, which cannot give each of ${L} lanes a whole microbatch.`
  if (G > L) return `${G} replicas but only ${L} lanes: some replicas would own no lane. Zephon refuses this.`
  if (L % G !== 0)
    return `${L} lanes do not split evenly over ${G} replicas. The TorchTitan adapter refuses to start; Zephon on its own only warns.`
  return null
}

function hue(i: number, n: number): number {
  return Math.round((i * 360) / n + 200) % 360
}

export function LaneMap() {
  const [L, setL] = useState(64)
  const [G, setG] = useState(16)
  const [mode, setMode] = useState<Mode>("lanes")
  const [step, setStep] = useState(151)

  const err =
    mode === "lanes"
      ? problem(L, G)
      : MICRO % G !== 0
        ? `${MICRO} microbatches per step do not split evenly over ${G} GPUs.`
        : null
  const legal = useMemo(
    () => G_OPTS.filter((g) => problem(L, g) === null),
    [L],
  )

  const vals = useMemo(
    () => (err ? [] : contents(mode, L, G, step)),
    [err, mode, L, G, step],
  )
  const fp = err ? "--------" : fingerprint(vals)
  const baseErr = mode === "lanes" ? problem(L, BASE_G) : null
  const baseFp = baseErr ? null : fingerprint(contents(mode, L, BASE_G, step))
  const same = !err && baseFp !== null && baseFp === fp

  const lanesPerRank = err ? 0 : L / G
  const accum = err ? 0 : MICRO / G
  const q = MICRO % L === 0 ? N / L : 0

  const laneW = W / L
  const showRankLabels = !err && W / G >= 26

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>
          lanes vs ranks · N = {N} sequences, m = {MB} per microbatch
        </span>
        <span className="text-muted-foreground/50">illustrative · toy hash</span>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-muted-foreground">loader</span>
            {(["lanes", "sharded"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-md border px-2 py-1 ${mode === m ? "border-foreground/50 bg-foreground/10" : "text-muted-foreground"}`}
              >
                {m === "lanes" ? "Zephon lanes" : "rank-sharded"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-muted-foreground">step</span>
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(150, s - 1))}
              className="rounded-md border px-2 py-1"
              aria-label="previous step"
            >
              &larr;
            </button>
            <span className="w-8 text-center">{step}</span>
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(180, s + 1))}
              className="rounded-md border px-2 py-1"
              aria-label="next step"
            >
              &rarr;
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 font-mono text-xs">
          <span className="mr-1 w-20 text-muted-foreground">lanes L</span>
          {LANE_OPTS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setL(v)}
              disabled={mode === "sharded"}
              className={`rounded-md border px-2 py-1 disabled:opacity-40 ${L === v ? "border-foreground/50 bg-foreground/10" : "text-muted-foreground"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1 font-mono text-xs">
          <span className="mr-1 w-20 text-muted-foreground">GPUs G</span>
          {G_OPTS.map((v) => {
            const ok = mode === "sharded" ? MICRO % v === 0 : problem(L, v) === null
            return (
              <button
                key={v}
                type="button"
                onClick={() => setG(v)}
                className={`rounded-md border px-2 py-1 ${G === v ? "border-foreground/50 bg-foreground/10" : ok ? "" : "text-muted-foreground line-through decoration-red-500/60"}`}
              >
                {v}
              </button>
            )
          })}
        </div>

        <svg
          viewBox={`0 0 ${W} ${GRID_Y + ROWS * CH + 4}`}
          className="w-full"
          role="img"
          aria-label="Top: a bar of lanes with the data-parallel ranks drawn above as brackets over contiguous blocks of lanes. Below: the global batch of 448 sequences as a grid of coloured cells; in lanes mode the colours stay the same when the GPU count changes."
        >
          <text x={0} y={12} fontSize={11} className="font-mono" fill="var(--muted-foreground)">
            {mode === "lanes" ? "ranks own contiguous blocks of lanes" : "ranks own every G-th document"}
          </text>
          {mode === "lanes" && MICRO % L === 0
            ? Array.from({ length: L }, (_, i) => (
                <rect
                  key={`l${i}`}
                  x={i * laneW + 0.5}
                  y={BAR_Y + 26}
                  width={Math.max(0.5, laneW - 1)}
                  height={BAR_H - 6}
                  fill={`hsl(${hue(i, L)} 55% 55%)`}
                  opacity={0.85}
                />
              ))
            : null}
          {!err && mode === "lanes"
            ? Array.from({ length: G }, (_, r) => {
                const x0 = r * lanesPerRank * laneW
                const w = lanesPerRank * laneW
                return (
                  <g key={`r${r}`}>
                    <rect
                      x={x0 + 1}
                      y={BAR_Y}
                      width={Math.max(1, w - 2)}
                      height={BAR_H}
                      rx={3}
                      fill="var(--muted-foreground)"
                      opacity={0.14}
                      stroke="var(--muted-foreground)"
                      strokeOpacity={0.5}
                    />
                    {showRankLabels ? (
                      <text
                        x={x0 + w / 2}
                        y={BAR_Y + 14}
                        textAnchor="middle"
                        fontSize={10}
                        className="font-mono"
                        fill="currentColor"
                      >
                        r{r}
                      </text>
                    ) : null}
                  </g>
                )
              })
            : null}
          {!err && mode === "sharded"
            ? Array.from({ length: G }, (_, r) => (
                <rect
                  key={`s${r}`}
                  x={(r * W) / G + 1}
                  y={BAR_Y}
                  width={Math.max(1, W / G - 2)}
                  height={BAR_H}
                  rx={3}
                  fill={`hsl(${hue(r, G)} 45% 55%)`}
                  opacity={0.5}
                />
              ))
            : null}

          {err ? (
            <text x={W / 2} y={GRID_Y + (ROWS * CH) / 2} textAnchor="middle" fontSize={13} className="font-mono" fill="oklch(0.62 0.2 25)">
              configuration refused
            </text>
          ) : (
            vals.map((v, i) => {
              const c = i % COLS
              const rr = Math.floor(i / COLS)
              const owner = mode === "lanes" ? Math.floor(i / q) : Math.floor(i / (N / G))
              const n = mode === "lanes" ? L : G
              return (
                <g key={i}>
                  <rect
                    x={c * CW + 0.5}
                    y={GRID_Y + rr * CH + 0.5}
                    width={CW - 1}
                    height={CH - 4}
                    fill={`hsl(${v % 360} 40% ${48 + ((v >>> 9) % 22)}%)`}
                  />
                  <rect
                    x={c * CW + 0.5}
                    y={GRID_Y + rr * CH + CH - 3.5}
                    width={CW - 1}
                    height={2}
                    fill={`hsl(${hue(owner, n)} 60% 50%)`}
                  />
                </g>
              )
            })
          )}
        </svg>

        <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <div className="rounded-md border px-3 py-2">
            <div className="text-muted-foreground">lanes per GPU</div>
            <div className="mt-0.5 text-base">{err || mode === "sharded" ? "-" : lanesPerRank}</div>
          </div>
          <div className="rounded-md border px-3 py-2">
            <div className="text-muted-foreground">microbatches per GPU per step</div>
            <div className="mt-0.5 text-base">{err ? "-" : accum}</div>
          </div>
          <div className="rounded-md border px-3 py-2">
            <div className="text-muted-foreground">sequences per lane per step</div>
            <div className="mt-0.5 text-base">{err || mode === "sharded" ? "-" : q}</div>
          </div>
          <div className="rounded-md border px-3 py-2">
            <div className="text-muted-foreground">batch fingerprint</div>
            <div className="mt-0.5 text-base">{fp}</div>
          </div>
        </div>

        <p className="font-mono text-xs leading-relaxed text-muted-foreground" aria-live="polite">
          {err
            ? err
            : baseFp === null
              ? `16 GPUs is not legal with ${L} lanes, so compare fingerprints across the legal counts.`
              : same
              ? `Same fingerprint as the 16-GPU run at step ${step}.`
              : G === BASE_G
                ? `This is the 16-GPU baseline for step ${step}. Change G and watch the fingerprint.`
                : `Differs from the 16-GPU run at step ${step}: a different global batch.`}
          {mode === "lanes" && !err ? ` Legal GPU counts for ${L} lanes: ${legal.join(", ")}.` : ""}
        </p>
      </div>
    </figure>
  )
}
