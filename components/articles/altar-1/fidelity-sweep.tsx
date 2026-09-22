"use client"

import { useState } from "react"

// The supporting compression study, drawn. Nobody has plotted it, and it is the
// most informative artefact in the whole release.
//
// Source: 0xSero/glm-5.3-reap-fidelity-study, sweep_summary.json at revision
// ed76f87, linked from the Altar announcement as "the supporting compression
// study". 16 pruning plans at four keep-counts, each with top-1 agreement
// against the unpruned model, mean KL, and KL split by domain.
//
// Two things fall straight out of it. Selection strategy dominates size -- at
// keep=192 the best plan sits at 0.361 KL and the frequency baseline at 0.635,
// a wider gap than two whole rungs of size. And the damage is domain-skewed:
// code KL barely moves while prose KL goes up by an order of magnitude, which
// is why a security-calibrated prune is a defensible idea in the first place.
//
// The third thing is the one to notice: the sweep bottoms out at 192 experts.
// Altar ships 168.

type Plan = {
  name: string
  keep: number
  paramsB: number
  agree: number
  kld: number
  prose: number
  code: number
  multi: number
  family: "max" | "bal" | "plain" | "baseline" | "unpruned"
}

const PLANS: Plan[] = [
  { name: "EXL3 3bpw unpruned", keep: 256, paramsB: 753, agree: 0.9089, kld: 0.0892, prose: 0.126, code: 0.048, multi: 0.084, family: "unpruned" },
  { name: "massmax224", keep: 224, paramsB: 661, agree: 0.8737, kld: 0.1951, prose: 0.282, code: 0.127, multi: 0.148, family: "max" },
  { name: "reapmax224", keep: 224, paramsB: 661, agree: 0.8711, kld: 0.201, prose: 0.325, code: 0.089, multi: 0.152, family: "max" },
  { name: "reap224", keep: 224, paramsB: 661, agree: 0.8462, kld: 0.2799, prose: 0.484, code: 0.09, multi: 0.205, family: "plain" },
  { name: "massmax208", keep: 208, paramsB: 615, agree: 0.8463, kld: 0.2826, prose: 0.43, code: 0.172, multi: 0.198, family: "max" },
  { name: "reapmax208", keep: 208, paramsB: 615, agree: 0.8406, kld: 0.2975, prose: 0.503, code: 0.123, multi: 0.203, family: "max" },
  { name: "massbal208", keep: 208, paramsB: 615, agree: 0.833, kld: 0.3165, prose: 0.504, code: 0.188, multi: 0.195, family: "bal" },
  { name: "reap208", keep: 208, paramsB: 615, agree: 0.8113, kld: 0.4033, prose: 0.715, code: 0.109, multi: 0.294, family: "plain" },
  { name: "mass208", keep: 208, paramsB: 615, agree: 0.8041, kld: 0.4419, prose: 0.805, code: 0.132, multi: 0.277, family: "plain" },
  { name: "massmax192", keep: 192, paramsB: 569, agree: 0.8219, kld: 0.3611, prose: 0.56, code: 0.202, multi: 0.258, family: "max" },
  { name: "massbal192", keep: 192, paramsB: 569, agree: 0.8109, kld: 0.3993, prose: 0.645, code: 0.22, multi: 0.253, family: "bal" },
  { name: "reapmax192", keep: 192, paramsB: 569, agree: 0.809, kld: 0.4058, prose: 0.705, code: 0.15, multi: 0.27, family: "max" },
  { name: "reap192 (mean)", keep: 192, paramsB: 569, agree: 0.775, kld: 0.5487, prose: 0.982, code: 0.126, multi: 0.412, family: "plain" },
  { name: "mass192", keep: 192, paramsB: 569, agree: 0.775, kld: 0.5685, prose: 1.024, code: 0.163, multi: 0.381, family: "plain" },
  { name: "freq192", keep: 192, paramsB: 569, agree: 0.7502, kld: 0.6351, prose: 1.0, code: 0.262, multi: 0.541, family: "baseline" },
  { name: "random192", keep: 192, paramsB: 569, agree: 0.7345, kld: 0.6851, prose: 0.808, code: 0.303, multi: 0.945, family: "baseline" },
]

// Altar-1's own card publishes one number on a different panel.
const ALTAR = { keep: 168, paramsB: 500.8, kld: 0.506 }

const FAMILY_COLOR: Record<Plan["family"], string> = {
  unpruned: "oklch(0.55 0.17 280)",
  max: "oklch(0.56 0.14 200)",
  bal: "oklch(0.62 0.12 165)",
  plain: "oklch(0.66 0.10 120)",
  baseline: "oklch(0.58 0.18 27)",
}

const FAMILY_LABEL: Record<Plan["family"], string> = {
  unpruned: "unpruned reference",
  max: "domain-max aggregation",
  bal: "domain-balanced",
  plain: "global aggregation",
  baseline: "frequency / random baseline",
}

type View = "kld" | "domain"

export function FidelitySweep() {
  const [view, setView] = useState<View>("kld")

  const W = 700
  const H = 300
  const L = 52
  const R = 128
  const T = 18
  const B = 52

  const keeps = [256, 224, 208, 192, 168]
  const px = (keep: number) => L + ((256 - keep) / (256 - 160)) * (W - L - R)
  const yMax = 1.05
  const py = (v: number) => T + ((yMax - v) / yMax) * (H - T - B)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          the linked compression study, plotted — KL against experts kept
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          16 plans · sealed 25-prompt panel · lower is better
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { k: "kld" as View, label: "mean KL, all plans" },
              { k: "domain" as View, label: "KL by domain" },
            ]
          ).map((o) => (
            <button
              key={o.k}
              type="button"
              onClick={() => setView(o.k)}
              aria-pressed={view === o.k}
              className={
                "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors " +
                (view === o.k
                  ? "border-foreground/40 bg-foreground/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full min-w-[620px]"
            role="img"
            aria-label="Mean KL divergence against the unpruned model, plotted against the number of experts kept. The sweep covers 256, 224, 208 and 192 experts. At 192 the plans range from 0.361 for the best domain-max plan to 0.685 for random selection. Altar-1 keeps 168 experts, beyond the right-hand end of the sweep, and reports a single value of 0.506."
          >
            {[0, 0.25, 0.5, 0.75, 1.0].map((v) => (
              <g key={v}>
                <line x1={L} x2={W - R} y1={py(v)} y2={py(v)} className="stroke-foreground/10" strokeWidth={1} />
                <text x={L - 7} y={py(v) + 3} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
                  {v.toFixed(2)}
                </text>
              </g>
            ))}

            {keeps.map((k) => (
              <text key={k} x={px(k)} y={H - B + 15} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
                {k}
              </text>
            ))}
            <text x={(L + W - R) / 2} y={H - B + 31} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
              routed experts kept, of 256
            </text>
            <text x={10} y={T + 2} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
              KL nats
            </text>

            {/* the region the study does not cover */}
            <rect
              x={px(192)}
              y={T}
              width={px(160) - px(192)}
              height={H - T - B}
              className="fill-foreground/[0.04]"
            />
            <text x={px(180)} y={T + 12} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 8 }}>
              no plan in the study
            </text>

            {view === "kld"
              ? PLANS.map((p) => (
                  <g key={p.name}>
                    <circle cx={px(p.keep)} cy={py(p.kld)} r={4.2} fill={FAMILY_COLOR[p.family]} opacity={0.9}>
                      <title>{`${p.name} · keep ${p.keep} (${p.paramsB}B) · KL ${p.kld} · top-1 agreement ${(p.agree * 100).toFixed(2)}%`}</title>
                    </circle>
                    {p.family === "baseline" || p.family === "unpruned" || p.name === "massmax192" ? (
                      <text x={px(p.keep) + 8} y={py(p.kld) + 3} className="fill-muted-foreground font-mono" style={{ fontSize: 8 }}>
                        {p.name}
                      </text>
                    ) : null}
                  </g>
                ))
              : (["prose", "multi", "code"] as const).map((dom, di) => {
                  const col = ["oklch(0.58 0.18 27)", "oklch(0.62 0.13 60)", "oklch(0.55 0.15 155)"][di]
                  const byKeep = new Map<number, number[]>()
                  for (const p of PLANS) {
                    const arr = byKeep.get(p.keep) ?? []
                    arr.push(p[dom])
                    byKeep.set(p.keep, arr)
                  }
                  const pts = [...byKeep.entries()]
                    .sort((a, b) => b[0] - a[0])
                    .map(([k, vs]) => ({ k, v: vs.reduce((s, x) => s + x, 0) / vs.length }))
                  return (
                    <g key={dom}>
                      <polyline
                        points={pts.map((p) => `${px(p.k)},${py(p.v)}`).join(" ")}
                        fill="none"
                        stroke={col}
                        strokeWidth={1.8}
                      />
                      {pts.map((p) => (
                        <circle key={p.k} cx={px(p.k)} cy={py(p.v)} r={3.6} fill={col}>
                          <title>{`${dom} · keep ${p.k} · mean KL ${p.v.toFixed(3)} across plans at that size`}</title>
                        </circle>
                      ))}
                      <text
                        x={px(192) + 8}
                        y={py(pts[pts.length - 1].v) + 3}
                        className="font-mono"
                        fill={col}
                        style={{ fontSize: 9 }}
                      >
                        {dom === "multi" ? "multilingual" : dom}
                      </text>
                    </g>
                  )
                })}

            {/* Altar's single published point */}
            <line x1={px(ALTAR.keep)} x2={px(ALTAR.keep)} y1={T} y2={H - B} className="stroke-foreground/30" strokeDasharray="3 3" strokeWidth={1} />
            <circle cx={px(ALTAR.keep)} cy={py(ALTAR.kld)} r={5.5} className="fill-foreground" />
            <text x={px(ALTAR.keep) - 8} y={py(ALTAR.kld) - 9} textAnchor="end" className="fill-foreground font-mono" style={{ fontSize: 9.5 }}>
              Altar-1 · 0.506
            </text>
            <text x={px(ALTAR.keep) - 8} y={py(ALTAR.kld) + 2} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 8 }}>
              168 experts · 500.8B
            </text>
          </svg>
        </div>

        {view === "kld" ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {(Object.keys(FAMILY_LABEL) as Plan["family"][]).map((f) => (
              <span key={f} className="flex items-center gap-1.5 font-mono text-[10px]">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: FAMILY_COLOR[f] }} />
                <span className="text-muted-foreground">{FAMILY_LABEL[f]}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
            Mean across the plans at each keep-count. Code KL rises from 0.048 to
            0.20; prose KL rises from 0.126 to 0.82. Pruning a mixture-of-experts
            costs natural language roughly four times what it costs code — which
            is the argument for a security-calibrated cut, made by the data rather
            than by the blog post.
          </p>
        )}
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        All 16 plan points are from <code>sweep_summary.json</code> at revision{" "}
        <code>ed76f87</code>. Altar&apos;s 0.506 is from its own model card, on
        the same described panel but not in the same file, and it is a single
        point with no sibling plan at 168 experts to compare against.
      </figcaption>
    </figure>
  )
}
