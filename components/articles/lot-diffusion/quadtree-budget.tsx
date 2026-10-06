"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Quadtree token budget for a 1024x1024 FLUX.2 klein 4B image.
//
// The lattice is the pretrained DiT's own token grid: the VAE latent is
// 128x128x32, patchified 2x2, so 64x64 tokens of D = 128 numbers each
// (in_channels = 128 in the model's transformer/config.json; hidden size
// 24 heads x 128 = 3072).
//
// The split rule is the paper's custom-detail-map rule (LoT, arXiv 2610.05816,
// appendix A.3, Eq. 23): start from 8x8 blocks; a block of extent b in
// {8, 4, 2} splits into four children whenever max D(q) >= t_b, with
// t_8 <= t_4 <= t_2; recursion stops when the test fails or a 1x1 token is
// reached. D is the detail field after the user's gain and clipping to [0, 1].
// The paper does not publish its thresholds; the three below are mine.
//
// RoPE centre (Eq. 13) and shape features (Eq. 11) are the paper's formulas.
// The speed estimate is a two-parameter fit t(c) = a + b / c to the paper's
// own 4B timings (dense 5.7783 s; Table 5 "Ours" rows), normalised so c = 1
// gives 1.0x. It is only measured between 1.5x and 2.9x compression.
// The detail fields themselves are toy scenes drawn for this page.

const N = 64
const TH: Record<number, number> = { 8: 0.2, 4: 0.45, 2: 0.75 }
const LOG2: Record<number, number> = { 1: 0, 2: 1, 4: 2, 8: 3, 16: 4, 64: 6 }
const FILL: Record<number, string> = {
  1: "oklch(0.62 0.17 15)",
  2: "oklch(0.74 0.14 55)",
  4: "oklch(0.88 0.08 90)",
  8: "oklch(0.7 0.08 240)",
}
const ACCENT = "oklch(0.62 0.17 15)"

type Scene = { id: string; name: string; blurb: string }
const SCENES: Scene[] = [
  { id: "box", name: "bounding boxes", blurb: "a subject box (0.6) with a finer box for the face (1.0); background 0.3" },
  { id: "dof", name: "depth of field", blurb: "detail = 1 minus blur radius, focused on the subject" },
  { id: "paint", name: "painted map", blurb: "the paper's four brush scores 0, 0.3, 0.6 and 1" },
]

function clamp01(x: number) {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

function field(id: string): number[] {
  const f = new Array<number>(N * N).fill(0)
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const y = r + 0.5
      const x = c + 0.5
      let v = 0
      if (id === "box") {
        v = 0.3
        if (y > 14 && y < 60 && x > 18 && x < 44) v = 0.6
        if (y > 14 && y < 27 && x > 25 && x < 37) v = 1
      } else if (id === "dof") {
        // wall at depth 8 above row 30, floor coming toward the camera below it,
        // subject at depth 3 in an ellipse; focal depth 3.
        let d = 8
        if (y > 30) d = 8 - ((y - 30) / 34) * 6.5
        const ex = (x - 30) / 11
        const ey = (y - 38) / 21
        if (ex * ex + ey * ey < 1) d = 3
        const blur = Math.abs(1 / d - 1 / 3)
        v = clamp01(1 - blur / 0.34)
      } else {
        // sky 0; mountain band 0.3 with a jagged ridge; meadow 0.6; a person 1.
        const ridge = 24 + 5 * Math.abs(((x % 16) - 8) / 8)
        v = 0
        if (y > ridge) v = 0.3
        if (y > 36) v = 0.6
        const hx = (x - 44) / 4
        const hy = (y - 30) / 4
        if (hx * hx + hy * hy < 1) v = 1
        if (y > 34 && y < 54 && x > 39 && x < 49) v = 1
      }
      f[r * N + c] = v
    }
  }
  return f
}

type Tok = { r: number; c: number; e: number }

function layout(f: number[], gain: number): Tok[] {
  const out: Tok[] = []
  const peak = (r0: number, c0: number, e: number) => {
    let m = 0
    for (let r = r0; r < r0 + e; r++) for (let c = c0; c < c0 + e; c++) if (f[r * N + c] > m) m = f[r * N + c]
    return clamp01(gain * m)
  }
  const rec = (r: number, c: number, e: number) => {
    if (e > 1 && peak(r, c, e) >= TH[e]) {
      const h = e / 2
      rec(r, c, h)
      rec(r, c + h, h)
      rec(r + h, c, h)
      rec(r + h, c + h, h)
    } else out.push({ r, c, e })
  }
  for (let r = 0; r < N; r += 8) for (let c = 0; c < N; c += 8) rec(r, c, 8)
  return out
}

const fitTime = (c: number) => 1.333 + 4.485 / c
const speedOf = (c: number) => fitTime(1) / fitTime(c)

export function QuadtreeBudget() {
  const [scene, setScene] = useState("box")
  const [g100, setG100] = useState(150)
  const [sel, setSel] = useState<Tok | null>(null)
  const gain = g100 / 100

  const f = useMemo(() => field(scene), [scene])
  const toks = useMemo(() => layout(f, gain), [f, gain])

  const L = toks.length
  const comp = (N * N) / L
  const counts: Record<number, number> = { 1: 0, 2: 0, 4: 0, 8: 0 }
  for (const t of toks) counts[t.e] += 1
  const inRange = comp >= 1.5 && comp <= 2.95

  const preview: { r: number; c: number; v: number }[] = []
  for (let r = 0; r < N; r += 2) {
    for (let c = 0; c < N; c += 2) {
      const v = (f[r * N + c] + f[r * N + c + 1] + f[(r + 1) * N + c] + f[(r + 1) * N + c + 1]) / 4
      preview.push({ r, c, v: Math.round(245 - 200 * clamp01(gain * v)) })
    }
  }

  const s = sel && toks.find((t) => t.r === sel.r && t.c === sel.c && t.e === sel.e) ? sel : null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">quadtree token layout · 64 x 64 lattice, 1024 px</span>
        <span className="font-mono text-[10px] text-muted-foreground">split rule: paper Eq. 23 · thresholds mine</span>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Layout source">
          {SCENES.map((sc) => (
            <button
              key={sc.id}
              type="button"
              role="tab"
              aria-selected={scene === sc.id}
              onClick={() => {
                setScene(sc.id)
                setSel(null)
              }}
              className={
                "rounded-md border px-2.5 py-1 font-mono text-xs " +
                (scene === sc.id ? "border-foreground/50 bg-muted" : "text-muted-foreground hover:bg-muted/50")
              }
            >
              {sc.name}
            </button>
          ))}
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">{SCENES.find((x) => x.id === scene)?.blurb}</p>

        <label className="block">
          <span className="flex items-baseline justify-between font-mono text-xs">
            <span>detail gain (the budget knob)</span>
            <span className="text-base font-semibold" style={{ color: ACCENT }}>
              x{gain.toFixed(2)}
            </span>
          </span>
          <Range
            min={30}
            max={250}
            step={5}
            value={g100}
            accent={ACCENT}
            onChange={(e) => setG100(Number(e.target.value))}
            aria-label="Detail gain"
            className="mt-1 w-full"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
          <svg
            viewBox={`0 0 ${N} ${N}`}
            className="aspect-square w-full max-w-[28rem] rounded border bg-background"
            role="img"
            aria-label={`Token layout with ${L} tokens`}
          >
            {toks.map((t) => {
              const on = s && s.r === t.r && s.c === t.c
              return (
                <rect
                  key={`${t.r}-${t.c}-${t.e}`}
                  x={t.c}
                  y={t.r}
                  width={t.e}
                  height={t.e}
                  fill={FILL[t.e]}
                  stroke={on ? "black" : "rgba(0,0,0,0.45)"}
                  strokeWidth={on ? 0.5 : 0.08}
                  onClick={() => setSel(t)}
                  style={{ cursor: "pointer" }}
                />
              )
            })}
          </svg>

          <div className="space-y-2">
            <div className="font-mono text-[10px] text-muted-foreground">detail field D(q) after gain</div>
            <svg viewBox={`0 0 ${N} ${N}`} className="aspect-square w-full rounded border" aria-hidden="true">
              {preview.map((p) => (
                <rect key={`${p.r}-${p.c}`} x={p.c} y={p.r} width={2} height={2} fill={`rgb(${p.v},${p.v},${p.v})`} />
              ))}
            </svg>
            <div className="space-y-1 font-mono text-[11px]">
              {[1, 2, 4, 8].map((e) => (
                <div key={e} className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 rounded-sm border" style={{ background: FILL[e] }} />
                  <span>
                    {e}x{e}: {counts[e]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Stat k="tokens in the DiT sequence" v={`${L} of 4,096`} hl />
          <Stat k="compression 4096 / L" v={`${comp.toFixed(2)}x`} />
          <Stat
            k="speed, fit to paper's 4B timings"
            v={`~${speedOf(comp).toFixed(2)}x${inRange ? "" : " (outside 1.5-2.9x, extrapolated)"}`}
          />
        </div>

        <div className="rounded-lg border px-3 py-2 font-mono text-[11px] leading-relaxed">
          {s ? (
            <>
              <div>
                token {s.e}x{s.e} at top-left (u, v) = ({s.r}, {s.c})
              </div>
              <div>
                RoPE centre (Eq. 13) = ({(s.r + (s.e - 1) / 2).toFixed(1)}, {(s.c + (s.e - 1) / 2).toFixed(1)})
              </div>
              <div>
                shape features s(e) (Eq. 11) = ({LOG2[s.e]}, {LOG2[s.e]}, {LOG2[s.e * s.e]}, 0)
              </div>
              <div>
                input: {s.e * s.e * 128} numbers, projected by A_e transpose to 128, then W_in to 3072
              </div>
              <div>
                output head h_e: 3072 to {s.e * s.e * 128} numbers of asymmetric velocity
              </div>
            </>
          ) : (
            <span className="text-muted-foreground">Click a token to see its position, shape features and head sizes.</span>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Blocks start at 8x8 and split while the brightest cell under them clears the threshold for their size (0.2,
          0.45, 0.75 here). The gain multiplies the whole detail field, so it moves every block at once, which is how the
          paper exposes the budget for painted maps. Real layouts from texture variance also contain rectangles such as
          2x1 and 8x1; this quadtree only makes squares.
        </p>
      </div>
    </figure>
  )
}

function Stat({ k, v, hl }: { k: string; v: string; hl?: boolean }) {
  return (
    <div className={hl ? "rounded-lg border border-foreground/40 bg-muted/40 px-3 py-2" : "rounded-lg border px-3 py-2"}>
      <div className="font-mono text-[10px] text-muted-foreground">{k}</div>
      <div className="mt-0.5 font-mono text-sm">{v}</div>
    </div>
  )
}
