"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { ATT, FigureCard, IDX, IO, Legend, LOCAL } from "./shared"

// KV-cache sharing, drawn as query heads collapsing onto fewer key/value heads.
//   MHA  — H query heads, H KV heads (one each)          cache 1.00×
//   GQA  — H query heads share G KV groups               cache G/H×
//   MQA  — H query heads, 1 KV head                      cache 1/H×
//   MLA  — cache a single compressed latent per token,   ≈0.07× (DeepSeek-V2:
//          up-projected back to H heads at compute time    93.3% smaller than MHA)
// Drag the KV-groups control to watch the connectors re-route and the cache bar
// shrink; flip to MLA for the latent-compression variant. Illustrative; the cache
// multipliers are the real asymptotics, the MLA figure is DeepSeek-V2's reported one.

const H = 8 // query heads
const GROUPS = [8, 4, 2, 1] as const // snap points: MHA → GQA → GQA → MQA

const W = 720
const HH = 250
const MX = 46
const QY = 196
const KY = 60
const CHIP = 26
const qStep = (W - 2 * MX - CHIP) / (H - 1)
const qx = (i: number) => MX + i * qStep
const kx = (g: number, ng: number) => {
  const stepK = ng === 1 ? 0 : (W - 2 * MX - CHIP) / (ng - 1)
  return ng === 1 ? W / 2 - CHIP / 2 : MX + g * stepK
}

type Mode = "grouped" | "mla"

export function KvSharing() {
  const [gi, setGi] = useState(1) // index into GROUPS → default GQA-4
  const [mode, setMode] = useState<Mode>("grouped")
  const g = GROUPS[gi]

  const name = mode === "mla" ? "MLA" : g === H ? "MHA" : g === 1 ? "MQA" : `GQA-${g}`
  // MLA caches (9/2)·d_h per token; in DeepSeek-V2's 128-head config that is ≈0.02× MHA.
  const cache = mode === "mla" ? 0.02 : g / H // relative to MHA=1.00
  const cachePct =
    mode === "mla" ? "(9/2)·d_h/token" : g === H ? "baseline" : `${Math.round((1 - g / H) * 100)}% smaller`

  const group = (i: number) => Math.floor(i / (H / g))

  return (
    <FigureCard label="KV-cache sharing · MHA → GQA → MQA → MLA">
      <svg
        viewBox={`0 0 ${W} ${HH}`}
        className="w-full"
        role="img"
        aria-label={`${name}: ${H} query heads mapping to ${mode === "mla" ? "one compressed latent" : `${g} key/value ${g === 1 ? "head" : "heads"}`}. KV cache is ${mode === "mla" ? "far smaller, about (9/2) times the head dimension per token" : cachePct} than multi-head attention.`}
      >
        <defs>
          <filter id="kv-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity="0.16" />
          </filter>
        </defs>

        <text x={MX} y={30} className="fill-muted-foreground font-mono" fontSize={11}>
          {mode === "mla" ? "cached: one latent cᴷⱽ per token" : `key/value heads (cached) · ${g}`}
        </text>
        <text x={MX} y={QY + CHIP + 20} className="fill-muted-foreground font-mono" fontSize={11}>
          query heads · {H}
        </text>

        {mode === "mla" ? (
          <>
            {/* single latent pill */}
            <rect x={W / 2 - 80} y={KY} width={160} height={CHIP} rx={7} fill={IO} opacity={0.9} stroke={IO} filter="url(#kv-soft)" />
            <text x={W / 2} y={KY + CHIP / 2 + 4} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={600} fill="var(--background)">
              latent cᴷⱽ (d_c)
            </text>
            {/* every query head up-projects from the shared latent */}
            {Array.from({ length: H }, (_, i) => (
              <path
                key={i}
                d={`M ${W / 2} ${KY + CHIP} C ${W / 2} ${(KY + QY) / 2}, ${qx(i) + CHIP / 2} ${(KY + QY) / 2}, ${qx(i) + CHIP / 2} ${QY}`}
                fill="none"
                stroke={IO}
                strokeWidth={1.3}
                opacity={0.4}
              />
            ))}
          </>
        ) : (
          <>
            {/* KV head chips */}
            {Array.from({ length: g }, (_, gg) => (
              <g key={gg}>
                <rect x={kx(gg, g)} y={KY} width={CHIP} height={CHIP} rx={6} fill={IDX} opacity={0.9} stroke={IDX} filter="url(#kv-soft)" className="transition-all duration-300" />
              </g>
            ))}
            {/* connectors query → its KV group */}
            {Array.from({ length: H }, (_, i) => {
              const gg = group(i)
              const x2 = kx(gg, g) + CHIP / 2
              const y2 = KY + CHIP
              const x1 = qx(i) + CHIP / 2
              const y1 = QY
              const my = (y1 + y2) / 2
              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`}
                  fill="none"
                  stroke={IDX}
                  strokeWidth={1.3}
                  opacity={0.4}
                  className="transition-all duration-300"
                />
              )
            })}
          </>
        )}

        {/* query head chips */}
        {Array.from({ length: H }, (_, i) => (
          <g key={i}>
            <rect x={qx(i)} y={QY} width={CHIP} height={CHIP} rx={6} fill={ATT} opacity={0.9} stroke={ATT} filter="url(#kv-soft)" />
            <text x={qx(i) + CHIP / 2} y={QY + CHIP / 2 + 3.5} textAnchor="middle" className="font-mono" fontSize={9} fontWeight={600} fill="var(--background)">
              {i}
            </text>
          </g>
        ))}
      </svg>

      {/* KV-cache bar */}
      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>KV cache per token (relative to MHA)</span>
          <span className="tabular-nums text-foreground">
            {cache.toFixed(2)}× · {cachePct}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(4, cache * 100)}%`, background: mode === "mla" ? IO : IDX }}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">variant</span>
          <button
            type="button"
            onClick={() => setMode("grouped")}
            aria-pressed={mode === "grouped"}
            className={cn(
              "cursor-pointer rounded-md border border-transparent px-2 py-1 font-mono text-[10px] transition-colors",
              mode === "grouped" ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
            )}
            style={mode === "grouped" ? { background: IDX } : undefined}
          >
            grouped
          </button>
          <button
            type="button"
            onClick={() => setMode("mla")}
            aria-pressed={mode === "mla"}
            className={cn(
              "cursor-pointer rounded-md border border-transparent px-2 py-1 font-mono text-[10px] transition-colors",
              mode === "mla" ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
            )}
            style={mode === "mla" ? { background: IO } : undefined}
          >
            MLA latent
          </button>
        </div>
        {mode === "grouped" && (
          <label className="flex min-w-[200px] flex-1 flex-col gap-1">
            <span className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>KV groups (drag to collapse)</span>
              <span className="tabular-nums text-foreground">
                {g} → {name}
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={GROUPS.length - 1}
              value={gi}
              onChange={(e) => setGi(Number(e.target.value))}
              className="w-full cursor-pointer"
              style={{ accentColor: IDX }}
            />
          </label>
        )}
        <div className="ml-auto font-mono text-[10px] text-muted-foreground">
          now: <span className="text-foreground">{name}</span>
        </div>
      </div>

      <Legend
        items={[
          { color: ATT, label: "query head" },
          { color: IDX, label: "key/value head" },
          { color: IO, label: "compressed latent (MLA)" },
          { color: LOCAL, label: "", op: 0 },
        ].filter((i) => i.label)}
      />

      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The KV cache — one key and value vector per head, per token, per layer — is what makes long-context decoding
        memory-bound. <span className="text-foreground">GQA</span> lets several query heads share one KV head, so the
        cache shrinks by the group factor with barely any quality loss; <span className="text-foreground">MQA</span> is
        the limit of one KV head. <span style={{ color: IO }}>MLA</span> takes a different route: cache a single{" "}
        <em>compressed latent</em> per token (DeepSeek-V2 caches <span className="text-foreground">(9/2)·d_h</span>, ≈
        2.25 KV groups' worth) and reconstruct all the heads on the fly — matching or beating MHA quality. Its headline
        93.3% cache cut is measured against DeepSeek 67B, itself a GQA model, not against full MHA.
      </p>
    </FigureCard>
  )
}
