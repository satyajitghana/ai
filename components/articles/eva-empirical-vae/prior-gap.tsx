"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mlog, msin } from "@/lib/dmath"

// An illustration, not the paper's data. Two neighbouring latent tokens
// (z_t, z_t+1) whose aggregate posterior is a correlated Gaussian with unit
// marginals: exactly what a per-token KL to N(0,1) can be fully satisfied by
// while still leaving the tokens dependent on each other. The standard VAE
// prior samples the two coordinates independently; EVA's prior samples
// z_t+1 from N(rho * z_t, 1 - rho^2), which for this toy is the exact
// conditional. "Off-manifold" counts prior samples that fall outside the 95%
// ellipse of the true joint (squared Mahalanobis distance > 5.991). The
// "unpaid KL" is the mutual information -0.5 log(1 - rho^2) in nats: the
// divergence between the true joint and the product of its marginals, which
// no per-token N(0,1) prior can remove.

const N = 900
const CHI2_95 = 5.991
const A_POST = "oklch(0.62 0.13 250)"
const A_PRIOR = "oklch(0.68 0.17 45)"

// Halton sequence: a fixed, evenly spread set of uniforms, identical on server
// and client, so the cloud does not reshuffle on hydration.
function halton(i: number, b: number) {
  let f = 1
  let r = 0
  let n = i
  while (n > 0) {
    f = f / b
    r = r + f * (n % b)
    n = Math.floor(n / b)
  }
  return r
}

const NORMALS: [number, number][] = (() => {
  const out: [number, number][] = []
  for (let i = 1; i <= N; i++) {
    const u1 = halton(i, 2)
    const u2 = halton(i, 3)
    const r = Math.sqrt(-2 * mlog(u1))
    out.push([r * mcos(2 * Math.PI * u2), r * msin(2 * Math.PI * u2)])
  }
  return out
})()

// A second, different set for the prior's draws.
const NORMALS_B: [number, number][] = (() => {
  const out: [number, number][] = []
  for (let i = 1; i <= N; i++) {
    const u1 = halton(i + 7, 5)
    const u2 = halton(i + 7, 7)
    const r = Math.sqrt(-2 * mlog(u1))
    out.push([r * mcos(2 * Math.PI * u2), r * msin(2 * Math.PI * u2)])
  }
  return out
})()

type Prior = "standard" | "eva"

export function PriorGap() {
  const [rhoI, setRhoI] = useState(85)
  const [prior, setPrior] = useState<Prior>("standard")
  const rho = rhoI / 100
  const s = Math.sqrt(1 - rho * rho)

  const { post, samp, outside, mi } = useMemo(() => {
    const post = NORMALS.map(([a, b]) => [a, rho * a + s * b] as [number, number])
    const samp = NORMALS_B.map(([a, b]) =>
      prior === "standard" ? ([a, b] as [number, number]) : ([a, rho * a + s * b] as [number, number]),
    )
    let outside = 0
    for (const [a, b] of samp) {
      const m2 = (a * a - 2 * rho * a * b + b * b) / (1 - rho * rho)
      if (m2 > CHI2_95) outside++
    }
    const mi = -0.5 * mlog(1 - rho * rho)
    return { post, samp, outside, mi }
  }, [rho, s, prior])

  const W = 300
  const H = 300
  const R = 3.6
  const px = (v: number) => (W / 2 + (v / R) * (W / 2)).toFixed(1)
  const py = (v: number) => (H / 2 - (v / R) * (H / 2)).toFixed(1)
  const pct = ((outside / N) * 100).toFixed(1)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">prior gap · two neighbouring latent tokens</span>
        <span className="font-mono text-[10px] text-muted-foreground">illustrative toy, not the paper&apos;s data</span>
      </div>

      <div className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,300px)_1fr]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[300px] rounded-lg border bg-background" role="img"
          aria-label={`Scatter of ${N} posterior latents and ${N} prior samples; ${pct}% of prior samples fall outside the posterior's 95% region`}>
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="currentColor" strokeOpacity={0.15} />
          <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="currentColor" strokeOpacity={0.15} />
          {post.map(([a, b], i) => (
            <circle key={`p${i}`} cx={px(a)} cy={py(b)} r={1.6} fill={A_POST} fillOpacity={0.45} />
          ))}
          {samp.map(([a, b], i) => (
            <circle key={`s${i}`} cx={px(a)} cy={py(b)} r={1.6} fill={A_PRIOR} fillOpacity={0.55} />
          ))}
          <text x={W - 6} y={H / 2 - 5} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
            z_t
          </text>
          <text x={W / 2 + 5} y={12} className="fill-muted-foreground font-mono text-[10px]">
            z_t+1
          </text>
        </svg>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            {(["standard", "eva"] as Prior[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrior(p)}
                aria-pressed={prior === p}
                className={
                  prior === p
                    ? "rounded-md border border-foreground/50 bg-muted px-2.5 py-1"
                    : "rounded-md border px-2.5 py-1 text-muted-foreground hover:bg-muted/50"
                }
              >
                {p === "standard" ? "N(0,1) per token" : "autoregressive N(μ̂, σ̂²)"}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-xs">
              <span>dependency between neighbours ρ</span>
              <span className="text-base font-semibold" style={{ color: A_PRIOR }}>
                {rho.toFixed(2)}
              </span>
            </span>
            <Range
              min={0}
              max={98}
              step={1}
              value={rhoI}
              accent={A_PRIOR}
              onChange={(e) => setRhoI(Number(e.target.value))}
              aria-label="Correlation between neighbouring latent tokens"
              className="mt-1 w-full"
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <Stat k="prior samples off the posterior" v={`${outside} of ${N} (${pct}%)`} hl />
            <Stat k="5% would be expected by chance" v={`${Math.round(N * 0.05)} of ${N}`} />
            <Stat k="KL a per-token N(0,1) cannot remove" v={`${mi.toFixed(3)} nats per pair`} />
            <Stat k="each marginal on its own" v="exactly N(0,1)" />
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <span style={{ color: A_POST }}>Blue</span> is where real latents live; <span style={{ color: A_PRIOR }}>orange</span> is
            what the prior hands the decoder at sampling time. Both coordinates are standard normal on their own, so a
            per-token KL to N(0,1) is perfectly happy. The standard prior still draws the two independently, which
            fills the corners where no training image ever put a latent. Switch to the autoregressive prior and the
            second token is drawn given the first; the off-manifold count drops back to chance.
          </p>
        </div>
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
