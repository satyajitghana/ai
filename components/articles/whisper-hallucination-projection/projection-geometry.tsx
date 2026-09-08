"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"
import { mcos, msin } from "@/lib/dmath"

// Section 3.2-3.4 and Algorithm 1 (Appendix A), staged as one picture. The real
// operation is h~ = h - alpha*(h B^T) B for a rank-r basis B in a d-dimensional
// decoder space (Eq. 1) -- here collapsed to 2D: the horizontal axis stands in
// for the estimated hallucination direction, the vertical axis for every other
// decoder dimension. The example vectors' coordinates are illustrative (the
// paper never publishes literal hidden-state values); everything else --
// per-model layer/rank/alpha/gamma, and the gate condition p_ns_base >= gamma --
// is transcribed from Section 5.1 and Appendix C.
//
// The gate badge is real logic, not decoration: gated mode computes
// p_ns_base >= gamma using the illustrative example's p_ns_base and the
// selected model's actual published gamma, exactly as Algorithm 1 does, and
// alpha only takes effect when that condition holds.

type ModelKey = "small" | "medium" | "large"

const MODEL_CONFIG: Record<ModelKey, { label: string; layer: number; rank: number; alpha: number; gamma: number }> = {
  small: { label: "Whisper small", layer: 10, rank: 1, alpha: 1.0, gamma: 0.15 },
  medium: { label: "Whisper medium", layer: 24, rank: 2, alpha: 0.75, gamma: 0.1 },
  large: { label: "Whisper large-v3", layer: 28, rank: 4, alpha: 1.0, gamma: 0.05 },
}

type ExampleKey = "nonspeech" | "speech"

// Illustrative decoder-state coordinates (subspace units, orthogonal units) and
// an illustrative base no-speech probability -- not values from the paper.
const EXAMPLES: Record<ExampleKey, { label: string; x: number; y: number; pns: number }> = {
  nonspeech: { label: "non-speech, hallucination-prone", x: 6.6, y: 1.5, pns: 0.82 },
  speech: { label: "genuine speech", x: 0.5, y: 5.8, pns: 0.02 },
}

const H_COLOR = "oklch(0.6 0.03 250)" // original vector, muted
const PROJ_COLOR = "oklch(0.58 0.19 27)" // removed component
const RESULT_COLOR = "oklch(0.55 0.16 155)" // h-tilde, green

const W = 440
const H = 350
const ORIGIN_X = 96
const ORIGIN_Y = 258
const SCALE = 34 // px per data unit
const X_MAX = 8
const Y_MAX = 6.4

const px = (x: number) => ORIGIN_X + x * SCALE
const py = (y: number) => ORIGIN_Y - y * SCALE

type Mode = "always" | "gated"

export function ProjectionGeometry() {
  const [model, setModel] = useState<ModelKey>("large")
  const [example, setExample] = useState<ExampleKey>("nonspeech")
  const [mode, setMode] = useState<Mode>("gated")
  const [alpha, setAlpha] = useState(1.0)

  const cfg = MODEL_CONFIG[model]
  const ex = EXAMPLES[example]

  const gateOpen = mode === "always" ? true : ex.pns >= cfg.gamma
  const effectiveAlpha = gateOpen ? alpha : 0

  const result = useMemo(() => {
    const rx = ex.x * (1 - effectiveAlpha)
    return { x: rx, y: ex.y }
  }, [ex, effectiveAlpha])

  const removed = ex.x - result.x

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">projecting a decoder state away from the hallucination subspace · Eq. 1, Algorithm 1</span>
        <span className="font-mono text-[10px] text-muted-foreground/60">illustrative geometry, real parameters</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`A ${ex.label} decoder state, ${gateOpen ? "with" : "without"} projection applied at strength alpha=${effectiveAlpha.toFixed(2)} for ${cfg.label}. ${gateOpen ? `${removed.toFixed(2)} units removed along the hallucination direction.` : "Gate closed: state left unchanged."}`}
        >
          <defs>
            <marker id="pg-arrow-h" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={H_COLOR} strokeWidth={1.5} />
            </marker>
            <marker id="pg-arrow-r" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={RESULT_COLOR} strokeWidth={1.5} />
            </marker>
          </defs>

          {/* extra guide rays hinting at rank > 1 -- purely illustrative */}
          {Array.from({ length: cfg.rank - 1 }, (_, i) => {
            const angle = (i + 1) * 5 // degrees, small fan above the axis
            const rad = (angle * Math.PI) / 180
            const x2 = px(X_MAX * 0.55 * mcos(rad))
            const y2 = py(X_MAX * 0.55 * msin(rad))
            return (
              <line
                key={i}
                x1={ORIGIN_X}
                y1={ORIGIN_Y}
                x2={x2}
                y2={y2}
                stroke={PROJ_COLOR}
                strokeWidth={1}
                strokeDasharray="2 3"
                opacity={0.35}
              />
            )
          })}

          {/* axes */}
          <line x1={ORIGIN_X} y1={ORIGIN_Y} x2={px(X_MAX)} y2={ORIGIN_Y} stroke="var(--border)" strokeWidth={1.5} />
          <line x1={ORIGIN_X} y1={ORIGIN_Y} x2={ORIGIN_X} y2={py(Y_MAX)} stroke="var(--border)" strokeWidth={1.5} />
          <text x={px(X_MAX)} y={ORIGIN_Y + 38} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>
            hallucination-subspace direction{cfg.rank > 1 ? ` (r=${cfg.rank}, one shown)` : " (r=1)"}
          </text>
          <text x={ORIGIN_X - 8} y={py(Y_MAX) + 6} textAnchor="start" className="fill-muted-foreground font-mono" fontSize={10}>
            everything else
          </text>

          {/* removed component, drawn along the x-axis */}
          {removed > 0.001 ? (
            <>
              <line x1={px(result.x)} y1={ORIGIN_Y} x2={px(ex.x)} y2={ORIGIN_Y} stroke={PROJ_COLOR} strokeWidth={4} opacity={0.55} strokeLinecap="round" />
              <text x={px((result.x + ex.x) / 2)} y={ORIGIN_Y + 18} textAnchor="middle" className="font-mono" fontSize={9.5} fontWeight={600} fill={PROJ_COLOR}>
                removed: α·(h·b) = {removed.toFixed(2)}
              </text>
            </>
          ) : null}

          {/* dashed drop lines from vector tips to the axis */}
          <line x1={px(ex.x)} y1={py(ex.y)} x2={px(ex.x)} y2={ORIGIN_Y} stroke={H_COLOR} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
          {removed > 0.001 ? (
            <line x1={px(result.x)} y1={py(result.y)} x2={px(result.x)} y2={ORIGIN_Y} stroke={RESULT_COLOR} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
          ) : null}

          {/* original h */}
          <line x1={ORIGIN_X} y1={ORIGIN_Y} x2={px(ex.x)} y2={py(ex.y)} stroke={H_COLOR} strokeWidth={2} markerEnd="url(#pg-arrow-h)" opacity={0.85} />
          <text x={px(ex.x) + 8} y={py(ex.y) - 4} className="font-mono" fontSize={10.5} fill={H_COLOR}>
            h
          </text>

          {/* result h-tilde (only distinct from h when something was removed) */}
          {removed > 0.001 ? (
            <>
              <line x1={ORIGIN_X} y1={ORIGIN_Y} x2={px(result.x)} y2={py(result.y)} stroke={RESULT_COLOR} strokeWidth={2.5} markerEnd="url(#pg-arrow-r)" />
              <text x={Math.max(px(result.x) - 8, ORIGIN_X + 24)} y={py(result.y) + 14} textAnchor="end" className="font-mono" fontSize={10.5} fontWeight={700} fill={RESULT_COLOR}>
                h&#771;
              </text>
            </>
          ) : (
            <text x={px(X_MAX)} y={py(Y_MAX) + 20} textAnchor="end" className="font-mono" fontSize={10} fill={RESULT_COLOR}>
              h&#771; = h {gateOpen ? "(α = 0)" : "(gate closed)"}
            </text>
          )}

          <circle cx={ORIGIN_X} cy={ORIGIN_Y} r={2.5} fill="var(--muted-foreground)" />
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">model</span>
            {(Object.keys(MODEL_CONFIG) as ModelKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setModel(k)}
                aria-pressed={model === k}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                  model === k ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {MODEL_CONFIG[k].label.replace("Whisper ", "")}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">example</span>
            {(Object.keys(EXAMPLES) as ExampleKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setExample(k)}
                aria-pressed={example === k}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                  example === k ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {k === "nonspeech" ? "non-speech" : "genuine speech"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">mode</span>
            {(["gated", "always"] as Mode[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                aria-pressed={mode === k}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                  mode === k ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-mono text-[10px] text-muted-foreground">α = {alpha.toFixed(2)}</span>
          <Range
            min={0}
            max={1.5}
            step={0.05}
            value={alpha}
            onChange={(e) => setAlpha(Number(e.target.value))}
            accent={PROJ_COLOR}
            className="w-40"
            aria-label="projection strength alpha"
          />
          <button
            type="button"
            onClick={() => setAlpha(cfg.alpha)}
            className="cursor-pointer rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
          >
            use {cfg.label}&rsquo;s selected α = {cfg.alpha}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-muted/20 px-3 py-2 font-mono text-[10.5px] sm:grid-cols-4">
          <div>
            <div className="text-muted-foreground">config</div>
            <div className="text-foreground">
              ℓ={cfg.layer}, r={cfg.rank}, γ={cfg.gamma}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">p_ns_base (this example)</div>
            <div className="text-foreground">{ex.pns.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">gate {mode === "always" ? "(bypassed)" : `p_ns_base ≥ γ?`}</div>
            <div className="font-semibold" style={{ color: gateOpen ? RESULT_COLOR : "var(--muted-foreground)" }}>
              {mode === "always" ? "always applies" : gateOpen ? `open (${ex.pns.toFixed(2)} ≥ ${cfg.gamma})` : `closed (${ex.pns.toFixed(2)} < ${cfg.gamma})`}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">effective α · removed</div>
            <div className="text-foreground">
              {effectiveAlpha.toFixed(2)} · {removed.toFixed(2)}
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Eq. 1 is exactly the arrow math above: <span className="text-foreground">h&#771; = h − α(hB<sup>&#8868;</sup>)B</span>{" "}
          removes only the component of a decoder state that lies along the estimated hallucination basis{" "}
          <span className="text-foreground">B</span>, leaving the rest untouched. In{" "}
          <span className="font-semibold" style={{ color: RESULT_COLOR }}>
            gated
          </span>{" "}
          mode that subtraction only happens when Whisper&rsquo;s own unprojected no-speech probability already
          clears the model&rsquo;s threshold γ — switch the example to &ldquo;genuine speech&rdquo; and, for every
          model here, the gate stays closed and h&#771; = h exactly, which is the entire reason gated projection
          costs so much less WER than always-on. Switch to &ldquo;always&rdquo; mode and the same speech example
          gets projected anyway, whether or not it needed it.
        </p>
      </div>
    </figure>
  )
}
