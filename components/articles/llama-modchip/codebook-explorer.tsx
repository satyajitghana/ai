"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The LUT-VQ3-64 codebook, as shipped in vq3/vq3_codebook.h (ggml_vq3_cb[128][3]):
// 128 int8 triples. A 7-bit index picks one; the kernel multiplies it by the
// block's FP16 scale d (times GGML_VQ3_G) and the 8-weight sub-block's
// multiplier m in 2..9. Here the table is drawn as three 2D projections of the
// int8 cube [-128, 127]^3, with the projection of the inscribed ball (a disk of
// radius 127) and, optionally, a 3-bit-per-coordinate scalar grid for
// comparison. Only + - * / and sqrt are used, so server and client agree.
const CB: number[] = [
  -24, -19, -24, -37, -20, -123, -41, -18, 18, 23, -6, 27, 29, -15, -65, -3, 4, 0, -59, -25, 72, -68, -13, -66,
  11, -54, -122, -84, -5, 30, 35, -51, 51, -19, 8, 50, 54, 9, 62, 12, -74, -55, -41, -73, -34, 16, 46, 19,
  -62, -70, -111, 69, -14, 116, -65, -73, 20, 70, 11, 12, 75, -2, -40, 55, 43, -65, -6, 62, -121, -47, 32, 16,
  73, -64, 65, -22, 67, 121, 62, 61, -9, 5, 80, -18, -123, -46, 55, -119, -58, -56, -24, -120, -122, -57, 48, -72,
  -125, -52, -3, -30, 77, 27, -19, -126, -11, 43, -118, -118, -56, 69, -22, 52, -122, 119, 120, 6, -116, 123, -22, -59,
  124, -26, 115, 127, 4, -10, -97, -121, -34, 119, 46, -48, 117, 54, -115, 7, 117, 76, 9, 120, 26, -122, -113, 102,
  -123, -114, 19, 5, 124, -58, 51, 122, -8, 100, -123, 51, 114, -111, -62, 62, 123, 52, -56, 119, -59, -122, 6, -31,
  -123, 8, 120, -121, 40, -121, 122, -120, -3, -127, 1, 15, 114, 114, 111, 121, 114, 28, -114, 97, 118, -119, 116, 48,
  5, -19, 75, 16, -14, 126, 10, 8, -122, -18, -41, -70, 18, -35, -16, -13, -51, 18, -37, -47, 123, 29, 16, -25,
  -15, 8, -63, -15, 14, 120, -19, -71, 69, -75, -42, -18, 31, -64, 121, 60, -2, -118, -15, 37, -26, 1, 49, 66,
  20, -81, 0, 43, 42, 120, 66, -41, 8, 63, -53, -98, 4, 58, -67, 63, -62, -38, -115, -30, -124, -108, -47, 118,
  53, 59, -124, -54, 31, -125, 58, 65, 56, -62, 19, 123, -5, -119, 115, -66, 13, -23, -24, -121, 38, -31, -120, -66,
  -61, -113, 118, -63, 46, 65, 30, -121, 48, 35, -124, -54, 118, -18, 34, -76, -122, 46, 56, -122, -4, 118, 26, 62,
  122, -48, -117, 115, 44, 120, 122, -56, -12, 38, 112, 124, -113, -115, -109, 124, -70, 44, 121, 55, 14, 63, 110, -59,
  25, 123, -120, -47, 113, -121, -24, 124, -9, 116, -106, 119, -51, 117, 60, -40, 124, 122, 114, -118, -124, -115, 55, 13,
  -124, 4, -76, -124, 26, 64, -74, 117, 8, -119, 59, -46, 110, 120, -115, 121, 116, -38, -115, 114, -106, -122, 121, -25,
]

type Axis = 0 | 1 | 2
const AXES: { key: string; a: Axis; b: Axis }[] = [
  { key: "x / y", a: 0, b: 1 },
  { key: "x / z", a: 0, b: 2 },
  { key: "y / z", a: 1, b: 2 },
]

// a 3-bit uniform scalar grid: 8 levels per coordinate, 512 points per triple
const LEVELS = [-112, -80, -48, -16, 16, 48, 80, 112]

// the 24-byte block_vq3_0, in bits
const LAYOUT = [
  { label: "FP16 scale d", bits: 16, tone: "bg-violet-500/80" },
  { label: "20 x 7-bit 3D indices (60 weights)", bits: 140, tone: "bg-sky-500/80" },
  { label: "2 x 6-bit 2D tail indices (4 weights)", bits: 12, tone: "bg-amber-500/80" },
  { label: "8 x 3-bit sub-scales", bits: 24, tone: "bg-emerald-500/80" },
]

const FORMATS = [
  { name: "Q4_0", bytes: 36, per: 64 },
  { name: "Fractal-64", bytes: 30, per: 64 },
  { name: "Q3_K", bytes: 110, per: 256 },
  { name: "LUT-VQ3-64", bytes: 24, per: 64 },
  { name: "Q2_K", bytes: 84, per: 256 },
  { name: "IQ2_XXS", bytes: 66, per: 256 },
  { name: "IQ1_M", bytes: 56, per: 256 },
  { name: "IQ1_S", bytes: 50, per: 256 },
]

const S = 300
const toPx = (v: number) => ((v + 128) / 255) * (S - 20) + 10

export function CodebookExplorer() {
  const [ax, setAx] = useState(0)
  const [grid, setGrid] = useState(false)
  const [pick, setPick] = useState<number | null>(5)
  const { a, b } = AXES[ax]

  const pts = Array.from({ length: 128 }, (_, i) => {
    const c = [CB[3 * i], CB[3 * i + 1], CB[3 * i + 2]]
    const r = Math.sqrt(c[0] * c[0] + c[1] * c[1] + c[2] * c[2])
    return { i, c, r }
  })
  const outside = pts.filter((p) => p.r > 127).length
  const sel = pick === null ? null : pts[pick]
  const r127 = (127 / 255) * (S - 20)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        The 128-entry LUT-VQ3-64 codebook from vq3_codebook.h · int8 coordinates
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5 text-xs">
        <span className="font-mono text-muted-foreground">projection</span>
        {AXES.map((x, j) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setAx(j)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px]",
              ax === j ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {x.key}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setGrid((g) => !g)}
          className={cn(
            "ml-2 rounded border px-2 py-0.5 font-mono text-[11px]",
            grid ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
          )}
        >
          {grid ? "hide" : "show"} 3-bit scalar grid
        </button>
      </div>

      <div className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,320px)_1fr]">
        <svg
          viewBox={`0 0 ${S} ${S}`}
          className="w-full max-w-[320px]"
          role="img"
          aria-label="Scatter plot of the 128 codebook entries projected onto two axes, with the inscribed disk of radius 127"
        >
          <rect x={10} y={10} width={S - 20} height={S - 20} className="fill-none stroke-muted-foreground/40" />
          <circle cx={S / 2} cy={S / 2} r={r127} className="fill-none stroke-muted-foreground/40" strokeDasharray="4 4" />
          {grid &&
            LEVELS.map((u) =>
              LEVELS.map((v) => (
                <circle key={`${u}:${v}`} cx={toPx(u)} cy={toPx(-v)} r={2} className="fill-muted-foreground/40" />
              ))
            )}
          {pts.map((p) => (
            <circle
              key={p.i}
              cx={toPx(p.c[a])}
              cy={toPx(-p.c[b])}
              r={pick === p.i ? 6 : 3.5}
              className={cn(
                "cursor-pointer",
                pick === p.i ? "fill-amber-500" : p.r > 127 ? "fill-sky-500/80" : "fill-emerald-500/80"
              )}
              onClick={() => setPick(p.i)}
              onMouseEnter={() => setPick(p.i)}
            />
          ))}
        </svg>

        <div className="space-y-3 text-xs">
          <p className="text-muted-foreground">
            <span className="text-emerald-600 dark:text-emerald-400">Green</span>: inside the ball of radius 127.{" "}
            <span className="text-sky-600 dark:text-sky-400">Blue</span>: outside it, toward the cube&apos;s corners.{" "}
            {128 - outside} inside, {outside} outside.
          </p>
          {sel && (
            <div className="rounded border px-3 py-2 font-mono text-[11px]">
              <div>
                index {sel.i} = 0b{sel.i.toString(2).padStart(7, "0")}
              </div>
              <div>
                entry ({sel.c[0]}, {sel.c[1]}, {sel.c[2]}), |c| = {sel.r.toFixed(1)}
              </div>
              <div className="text-muted-foreground">weight_j = d x G x m x entry_j, for its three weights</div>
            </div>
          )}
          <div>
            <div className="mb-1 font-mono text-[11px] text-muted-foreground">
              one block_vq3_0: 64 weights in 24 bytes = 192 bits
            </div>
            <div className="flex h-5 w-full overflow-hidden rounded-sm border">
              {LAYOUT.map((l) => (
                <div
                  key={l.label}
                  className={cn(l.tone, "h-full")}
                  style={{ width: `${((l.bits / 192) * 100).toFixed(2)}%` }}
                  title={`${l.label}: ${l.bits} bits`}
                />
              ))}
            </div>
            <ul className="mt-1.5 space-y-0.5 font-mono text-[11px]">
              {LAYOUT.map((l) => (
                <li key={l.label} className="flex items-center gap-2">
                  <span className={cn(l.tone, "inline-block size-2.5 shrink-0 rounded-sm")} />
                  <span className="text-muted-foreground">{l.label}</span>
                  <span className="ml-auto tabular-nums">{l.bits} bits</span>
                </li>
              ))}
            </ul>
          </div>
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left font-normal">format</th>
                <th className="text-right font-normal">block</th>
                <th className="text-right font-normal">bits / weight</th>
              </tr>
            </thead>
            <tbody>
              {FORMATS.map((f) => (
                <tr key={f.name} className={f.name === "LUT-VQ3-64" ? "text-amber-600 dark:text-amber-400" : ""}>
                  <td>{f.name}</td>
                  <td className="text-right tabular-nums">
                    {f.bytes} B / {f.per}
                  </td>
                  <td className="text-right tabular-nums">{((f.bytes * 8) / f.per).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </figure>
  )
}
