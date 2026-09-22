import { mpow } from "@/lib/dmath"

// What the palette's improvement/baseline axis does to a reader with
// red-green colour vision deficiency.
//
// Left panel: the three series of figure_VIGIL/plot_comparison_radar.py drawn on
// their four POPE_Adv spokes, in that script's own colours — DPO #D88F8A,
// DA-DPO #8BCF8B, VIGIL (Ours) #0F4D92. Right panel: the identical geometry with
// every fill run through a deuteranope simulation.
//
// Simulation: sRGB -> linear light -> LMS with the matrix of Vienot, Brettel &
// Mollon (1999), project onto the dichromat plane, invert, re-encode. The
// transform belongs in linear light, which is where it is applied here. The
// inverse matrix is precomputed to 10 decimals rather than inverted at render
// time so the two runs cannot diverge.
//
// The only transcendental in the whole file is the gamma exponent, and it goes
// through lib/dmath's mpow, because a colour computed on the server and the same
// colour computed in the browser have to serialize to the same attribute string.
// Everything else — the matrix products, the polyline coordinates — is +, -, *
// and /, which are exact.
//
// Lines, not bars, on purpose: a bar carries its identity in its position as
// well as its fill, a line carries it only in its colour. The published figure
// this redraws is a radar chart, which is lines.

const M_RGB2LMS = [
  [17.8824, 43.5161, 4.11935],
  [3.45565, 27.1554, 3.86714],
  [0.0299566, 0.184309, 1.46709],
] as const

const M_LMS2RGB = [
  [0.080944448, -0.130504409, 0.116721066],
  [-0.010248534, 0.054019327, -0.113614708],
  [-0.000365297, -0.004121615, 0.693511405],
] as const

// Deuteranopia: the M cone's response is reconstructed from L and S.
const DEUTER = [
  [1, 0, 0],
  [0.494207, 0, 1.24827],
  [0, 0, 1],
] as const

type M3 = readonly (readonly number[])[]
const mul = (m: M3, v: number[]) => [0, 1, 2].map((r) => m[r][0] * v[0] + m[r][1] * v[1] + m[r][2] * v[2])

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : mpow((c + 0.055) / 1.055, 2.4))
const toSrgb = (c: number) => {
  const x = Math.min(1, Math.max(0, c))
  return x <= 0.0031308 ? x * 12.92 : 1.055 * mpow(x, 1 / 2.4) - 0.055
}

const hex2rgb = (h: string) =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)

const rgb2hex = (v: number[]) =>
  "#" +
  v
    .map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()

function deuteranope(hex: string): string {
  const lin = hex2rgb(hex).map(toLinear)
  return rgb2hex(mul(M_LMS2RGB, mul(DEUTER, mul(M_RGB2LMS, lin))).map(toSrgb))
}

// figure_VIGIL/plot_comparison_radar.py — the four POPE_Adv entries of
// data_comparison['results'], in file order. Backbone names are shortened to
// fit the tick row on a 390px screen; the article spells them out.
const SPOKES = [
  { backbone: "Qwen-7B", v: [82.8, 84.2, 86.9] },
  { backbone: "LLaVA-7B", v: [82.8, 84.2, 86.9] },
  { backbone: "InternVL-26B", v: [85.5, 86.8, 89.4] },
  { backbone: "Qwen-72B", v: [84.5, 87.4, 89.8] },
]

const SERIES = [
  { name: "DPO", hex: "#D88F8A", role: "baseline" },
  { name: "DA-DPO", hex: "#8BCF8B", role: "improvement" },
  { name: "VIGIL (Ours)", hex: "#0F4D92", role: "proposed" },
]

// Deltas are CIEDE2000 on the sRGB pair, before and after the same simulation.
// Computed by the script this article links; carried here as data so the
// component does not ship a colour-difference implementation to render four rows.
const PAIRS = [
  { a: "#8BCF8B", b: "#E9A6A1", label: "green_3 / red_2", note: "the stated improvement-vs-baseline axis", before: 45.5, after: 5.2 },
  { a: "#8BCF8B", b: "#D88F8A", label: "DA-DPO / DPO", note: "the two baselines in the radar above", before: 48.0, after: 6.9 },
  { a: "#0F4D92", b: "#8BCF8B", label: "blue_main / green_3", note: "ours against everything else", before: 61.7, after: 64.2 },
  { a: "#D4685F", b: "#DA7B73", label: "red ramp, steps 1-2", note: "CellSpliceNet: one hue, ordered by rank", before: 5.2, after: 4.6 },
]

// One SVG per panel rather than one wide one, so the pair stacks on a phone
// instead of halving the type size.
const W = 350
const H = 212
const X0 = 32
const PANEL_W = 300
const PT = 14
const PB = 44
const PH = H - PT - PB
const LO = 80
const HI = 91

const yOf = (v: number) => PT + PH - ((v - LO) / (HI - LO)) * PH
const xOf = (i: number) => X0 + 26 + (i * (PANEL_W - 44)) / (SPOKES.length - 1)

function Panel({ title, sim }: { title: string; sim: boolean }) {
  return (
    <div>
      <div className="mb-1 font-mono text-[10px] text-muted-foreground">{title}</div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={
          sim
            ? "The same three series simulated for deuteranopia: DPO and DA-DPO are both a muted olive and hard to separate; VIGIL is still clearly a distinct violet-blue."
            : "POPE-Adv scores for DPO in pink, DA-DPO in green and VIGIL in dark blue, across four vision-language backbones."
        }
      >
        <rect x={X0} y={PT} width={PANEL_W} height={PH} fill="#ffffff" />

        {[82, 85, 88, 91].map((t) => (
          <g key={t}>
            <line x1={X0} y1={yOf(t)} x2={X0 + PANEL_W} y2={yOf(t)} stroke="#e6e6e6" strokeWidth={0.8} />
            <text x={X0 - 5} y={yOf(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8}>
              {t}
            </text>
          </g>
        ))}

        {SERIES.map((s, si) => {
          const colour = sim ? deuteranope(s.hex) : s.hex
          const pts = SPOKES.map((sp, i) => `${xOf(i)},${yOf(sp.v[si])}`).join(" ")
          return (
            <g key={s.name}>
              <polyline points={pts} fill="none" stroke={colour} strokeWidth={2.4} />
              {SPOKES.map((sp, i) => (
                <circle key={i} cx={xOf(i)} cy={yOf(sp.v[si])} r={2.8} fill={colour} />
              ))}
            </g>
          )
        })}

        <line x1={X0} y1={PT + PH} x2={X0 + PANEL_W} y2={PT + PH} stroke="var(--foreground)" strokeWidth={1.6} />

        {SPOKES.map((sp, i) => (
          <text
            key={sp.backbone}
            x={xOf(i)}
            y={PT + PH + 12}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            fontSize={7.5}
          >
            {sp.backbone}
          </text>
        ))}

        {/* series labels, drawn in their own colour — which is the problem */}
        {SERIES.map((s, si) => {
          const colour = sim ? deuteranope(s.hex) : s.hex
          return (
            <g key={s.name}>
              <rect x={X0 + si * 100} y={PT + PH + 21} width={9} height={9} fill={colour} />
              <text
                x={X0 + si * 100 + 13}
                y={PT + PH + 28.5}
                className="fill-muted-foreground font-mono"
                fontSize={8.5}
              >
                {s.name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function RedGreenAxis() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>VIGIL POPE_Adv · the radar&apos;s three series, unrolled</span>
        <span className="hidden text-muted-foreground/50 sm:inline">axis floor 80 · hue, not height</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
          <Panel title="as published" sim={false} />
          <Panel title="deuteranopia, simulated" sim={true} />
        </div>

        <div className="mt-4 space-y-2 border-t pt-3">
          {PAIRS.map((p) => (
            <div key={p.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px]">
              <span className="flex shrink-0 items-center gap-0.5">
                <span className="inline-block h-3 w-5 ring-1 ring-black/15" style={{ background: p.a }} />
                <span className="inline-block h-3 w-5 ring-1 ring-black/15" style={{ background: p.b }} />
                <span className="px-1 text-muted-foreground">→</span>
                <span className="inline-block h-3 w-5 ring-1 ring-black/15" style={{ background: deuteranope(p.a) }} />
                <span className="inline-block h-3 w-5 ring-1 ring-black/15" style={{ background: deuteranope(p.b) }} />
              </span>
              <span className="w-40 shrink-0 text-foreground">{p.label}</span>
              <span className="tabular-nums text-muted-foreground">
                ΔE00 {p.before.toFixed(1)} → <span className="text-foreground">{p.after.toFixed(1)}</span>
              </span>
              <span className="text-muted-foreground/70">{p.note}</span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Blue survives: it is the one channel a red-green dichromat still has, so
          the half of the scheme that is a rhetorical device — <em>mine is the
          blue one</em> — is also the half that is accessible. The half that
          claims to be semantic does not survive. The green and the red the skill
          nominates for &ldquo;improvement&rdquo; and &ldquo;baseline&rdquo; come
          out of the simulation as{" "}
          <code className="text-foreground">{deuteranope("#8BCF8B")}</code> and{" "}
          <code className="text-foreground">{deuteranope("#E9A6A1")}</code>: one
          step apart in red, one in green, eighteen in blue. The last row is the
          control — a ramp inside a single hue loses nothing, because it was
          encoding rank in luminance and never asked hue to carry anything.
        </p>
      </div>
    </figure>
  )
}
