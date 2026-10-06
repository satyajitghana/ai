"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { MAPS } from "./maps-data"

// The "Land or Water?" eval asks one question per grid point: 90 rows
// (lat 89..-89) x 180 columns (lon -179..179) at 2 degrees = 16,200 prompts.
// This widget holds nine published 2-degree answer maps (bit-packed in
// maps-data.ts) and lets the reader thin the grid: a coarser grid keeps every
// k-th point in each direction, which is exactly the set of prompts a
// coarser run would have sent, read back from the 2-degree answers rather
// than re-run. Each kept answer is drawn as a k x k block.
//
// Scores are area-weighted (each point weighted by cos(latitude)), the way
// the published Claude chart and the open-model repo both score. "Coastal"
// means the point has a neighbour at 2 degrees (8-connected, longitude wraps)
// whose true answer differs: 3,540 of the 16,200 points.

const R = 90
const C = 180
const STEPS = [2, 4, 6, 10, 18, 30] // degrees; k = step / 2
const SAMPLES = [1, 2, 4]
const ORDINAL: Record<number, string> = { 1: "", 2: "2nd ", 3: "3rd ", 5: "5th ", 9: "9th ", 15: "15th " }
const TOKENS_PER_PROMPT = 52 // measured: 846,900 prompt tokens / 16,200 in the Gemma 4 run

const COL = {
  land: "#efe9da",
  water: "#1d2633",
  landDim: "#6f6a60",
  waterDim: "#141a23",
  coastErr: "#f2a33a",
  inlandErr: "#e5484d",
}

function decode(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(R * C)
  for (let i = 0; i < R * C; i++) {
    const byte = bin.charCodeAt(i >> 3)
    out[i] = (byte >> (7 - (i & 7))) & 1
  }
  return out
}

function fmt(n: number): string {
  return n.toLocaleString("en-US")
}

export function LandOrWaterGrid() {
  const [mapId, setMapId] = useState("opus55")
  const [stepIdx, setStepIdx] = useState(0)
  const [samples, setSamples] = useState(1)
  const [view, setView] = useState<"answers" | "errors">("answers")
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const decoded = useMemo(() => {
    const m: Record<string, Uint8Array> = {}
    for (const x of MAPS) m[x.id] = decode(x.bits)
    return m
  }, [])

  const coastal = useMemo(() => {
    const t = decoded.truth
    const out = new Uint8Array(R * C)
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const v = t[r * C + c]
        let edge = 0
        for (let dr = -1; dr <= 1 && !edge; dr++) {
          const rr = r + dr
          if (rr < 0 || rr >= R) continue
          for (let dc = -1; dc <= 1; dc++) {
            const cc = (c + dc + C) % C
            if (t[rr * C + cc] !== v) {
              edge = 1
              break
            }
          }
        }
        out[r * C + c] = edge
      }
    }
    return out
  }, [decoded])

  const weights = useMemo(() => {
    const w: number[] = []
    for (let r = 0; r < R; r++) w.push(mcos(((89 - 2 * r) * Math.PI) / 180))
    return w
  }, [])

  const step = STEPS[stepIdx]
  const k = step / 2
  const { rows, cols } = useMemo(() => {
    const rs: number[] = []
    for (let r = Math.floor(k / 2); r < R; r += k) rs.push(r)
    const cs: number[] = []
    for (let c = Math.floor(k / 2); c < C; c += k) cs.push(c)
    return { rows: rs, cols: cs }
  }, [k])
  const points = rows.length * cols.length

  const stats = useMemo(() => {
    const p = decoded[mapId]
    const t = decoded.truth
    let wOk = 0
    let wAll = 0
    let wWater = 0
    let errs = 0
    let coastErrs = 0
    for (const r of rows) {
      for (const c of cols) {
        const i = r * C + c
        const w = weights[r]
        wAll += w
        if (!t[i]) wWater += w
        if (p[i] === t[i]) wOk += w
        else {
          errs++
          if (coastal[i]) coastErrs++
        }
      }
    }
    return {
      acc: (100 * wOk) / wAll,
      floor: (100 * wWater) / wAll,
      errs,
      coastErrs,
    }
  }, [decoded, mapId, rows, cols, coastal, weights])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext("2d")
    if (!ctx) return
    const p = decoded[mapId]
    const t = decoded.truth
    const S = 2 // px per 2-degree cell
    ctx.clearRect(0, 0, C * S, R * S)
    for (const r of rows) {
      for (const c of cols) {
        const i = r * C + c
        let fill: string
        if (view === "answers") fill = p[i] ? COL.land : COL.water
        else if (p[i] === t[i]) fill = t[i] ? COL.landDim : COL.waterDim
        else fill = coastal[i] ? COL.coastErr : COL.inlandErr
        ctx.fillStyle = fill
        const r0 = r - Math.floor(k / 2)
        const c0 = c - Math.floor(k / 2)
        ctx.fillRect(c0 * S, r0 * S, k * S, Math.min(k, R - r0) * S)
      }
    }
  }, [decoded, mapId, rows, cols, k, view, coastal])

  const current = MAPS.find((m) => m.id === mapId) ?? MAPS[0]
  const calls = points * samples
  const chip = (on: boolean) =>
    cn(
      "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
      on
        ? "border-primary bg-primary/10 text-foreground"
        : "border-border text-muted-foreground hover:text-foreground"
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          land-or-water · {step}° grid · {fmt(points)} prompts
        </span>
        <div className="flex gap-1.5">
          {(["answers", "errors"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={chip(view === v)}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {MAPS.map((m) => (
            <button key={m.id} type="button" onClick={() => setMapId(m.id)} className={chip(mapId === m.id)}>
              {m.label}
            </button>
          ))}
        </div>

        <canvas
          ref={canvasRef}
          width={C * 2}
          height={R * 2}
          role="img"
          aria-label={`${current.label}: answers on a ${step}-degree grid, ${fmt(points)} prompts`}
          className="block h-auto w-full rounded-md border bg-[#1d2633]"
          style={{ imageRendering: "pixelated" }}
        />
        {view === "errors" && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: COL.coastErr }} />
              wrong, on a coast
            </span>
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: COL.inlandErr }} />
              wrong, inland or open sea
            </span>
            <span>dim = right</span>
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block font-mono text-[11px] text-muted-foreground">
              grid step: {step}° ({rows.length} x {cols.length})
            </span>
            <Range
              min={0}
              max={STEPS.length - 1}
              step={1}
              value={stepIdx}
              onChange={(e) => setStepIdx(Number(e.target.value))}
              aria-label="grid step in degrees"
              className="w-full"
            />
          </label>
          <div>
            <span className="mb-1 block font-mono text-[11px] text-muted-foreground">samples per point</span>
            <div className="flex gap-1.5">
              {SAMPLES.map((s) => (
                <button key={s} type="button" onClick={() => setSamples(s)} className={chip(samples === s)}>
                  {s === 1 ? "1 (logprobs)" : `${s} (sampled)`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">API calls</dt>
            <dd className="text-sm text-foreground">{fmt(calls)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">prompt tokens</dt>
            <dd className="text-sm text-foreground">~{fmt(calls * TOKENS_PER_PROMPT)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">area-weighted</dt>
            <dd className="text-sm text-foreground">
              {mapId === "truth" ? "100.0" : stats.acc.toFixed(1)}%{" "}
              <span className="text-muted-foreground">(all Water {stats.floor.toFixed(1)}%)</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">wrong points</dt>
            <dd className="text-sm text-foreground">
              {fmt(stats.errs)}
              {stats.errs > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  ({Math.round((100 * stats.coastErrs) / stats.errs)}% coastal)
                </span>
              )}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Source: {current.source}. A coarser step keeps every {ORDINAL[k]}point of the 2° answers in each direction, which is the
          set of prompts a coarser run would send; it is read back, not re-run. Prompt tokens assume about 52 per call, the
          Gemma 4 run&apos;s measured average; thinking tokens, which the Claude runs spend, are not counted.
        </p>
      </div>
    </figure>
  )
}
