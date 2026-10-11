"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { INV_109, SBOX_106, type Circuit } from "./circuits"

// Steps a real released circuit (Swapnil Jain's sbox106_d24 or invsbox109_d30)
// one gate level at a time for an input byte you pick. Every value is computed
// here from the gate list; the reference S-box is computed independently from
// GF(2^8) inversion (modulus 0x11B) and the FIPS-197 affine map, so the last
// line is a real check, not a lookup of the circuit's own answer.

const CIRCUITS: Circuit[] = [SBOX_106, INV_109]
const OPS = ["XOR", "AND", "XNOR"] as const

function gmul(a: number, b: number): number {
  let r = 0
  let x = a
  let y = b
  while (y) {
    if (y & 1) r ^= x
    x <<= 1
    if (x & 0x100) x ^= 0x11b
    y >>= 1
  }
  return r & 0xff
}

function buildTables() {
  const sbox: number[] = []
  for (let x = 0; x < 256; x++) {
    let inv = 0
    if (x) for (let y = 1; y < 256; y++) if (gmul(x, y) === 1) { inv = y; break }
    let out = 0
    for (let i = 0; i < 8; i++) {
      const bit =
        ((inv >> i) ^ (inv >> ((i + 4) % 8)) ^ (inv >> ((i + 5) % 8)) ^ (inv >> ((i + 6) % 8)) ^ (inv >> ((i + 7) % 8)) ^ (0x63 >> i)) & 1
      out |= bit << i
    }
    sbox.push(out)
  }
  const inv: number[] = new Array(256).fill(0)
  sbox.forEach((y, x) => {
    inv[y] = x
  })
  return { sbox, inv }
}

const TABLES = buildTables()

const hex = (v: number) => "0x" + v.toString(16).toUpperCase().padStart(2, "0")

export function CircuitExplorer() {
  const [cid, setCid] = useState(SBOX_106.id)
  const [input, setInput] = useState(0x53)
  const [step, setStep] = useState(24)
  const [picked, setPicked] = useState<number | null>(null)
  const tables = TABLES
  const c = CIRCUITS.find((v) => v.id === cid) ?? SBOX_106
  const isInv = c.id.startsWith("inv")

  // Levels: inputs are level 0; a gate sits one level past its deeper operand.
  const { level, depth, byLevel } = useMemo(() => {
    const lv: number[] = new Array(8).fill(0)
    for (const [, x, y] of c.gates) lv.push(1 + Math.max(lv[x], lv[y]))
    const d = Math.max(...lv)
    const cols: number[][] = Array.from({ length: d + 1 }, () => [])
    lv.forEach((l, s) => cols[l].push(s))
    return { level: lv, depth: d, byLevel: cols }
  }, [c])

  const shown = Math.min(step, depth)

  const values = useMemo(() => {
    const v: number[] = []
    for (let i = 0; i < 8; i++) v.push((input >> (7 - i)) & 1)
    for (const [op, x, y] of c.gates) {
      const a = v[x]
      const b = v[y]
      v.push(op === 1 ? a & b : op === 0 ? a ^ b : 1 ^ a ^ b)
    }
    return v
  }, [c, input])

  const outReady = c.outputs.map((s) => level[s] <= shown)
  const outVal = c.outputs.reduce((acc, s, k) => acc | (values[s] << (7 - k)), 0)
  const ref = isInv ? tables.inv[input] : tables.sbox[input]
  const allReady = outReady.every(Boolean)

  const done = c.gates.filter((_, i) => level[8 + i] <= shown)
  const nAnd = done.filter((g) => g[0] === 1).length
  const nXnor = done.filter((g) => g[0] === 2).length
  const nXor = done.length - nAnd - nXnor

  // Layout: one column per level, gates stacked, outputs marked.
  const maxH = Math.max(...byLevel.map((col) => col.length))
  const CELL = 14
  const GAP = 3
  const COLW = CELL + 6
  const W = 24 + (depth + 1) * COLW
  const H = 22 + maxH * (CELL + GAP) + 6
  const outSet = new Map(c.outputs.map((s, k) => [s, k]))

  const pickedInfo =
    picked !== null && picked >= 8
      ? (() => {
          const [op, x, y] = c.gates[picked - 8]
          const nm = (s: number) => (s < 8 ? `U${s}` : `T${s - 8}`)
          return `${nm(picked)} = ${nm(x)} ${OPS[op]} ${nm(y)} = ${values[x]} ${OPS[op]} ${values[y]} = ${values[picked]}  (level ${level[picked]})`
        })()
      : picked !== null
        ? `U${picked} = bit ${7 - picked} of the input = ${values[picked]}`
        : null

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <figcaption className="mb-3 font-mono text-xs text-muted-foreground">
        A released circuit, evaluated gate by gate in your browser · columns are depth levels
      </figcaption>

      <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Choose a circuit">
        {CIRCUITS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={cid === v.id}
            onClick={() => {
              setCid(v.id)
              setPicked(null)
              setStep(v.id.startsWith("inv") ? 30 : 24)
            }}
            className={cn(
              "rounded-md border px-2 py-0.5 font-mono text-xs",
              cid === v.id ? "border-foreground text-foreground" : "border-border text-muted-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block font-mono text-xs text-muted-foreground">
          Input byte: <span className="text-foreground">{hex(input)}</span> ={" "}
          <span className="text-foreground">{input.toString(2).padStart(8, "0")}</span>
          <Range min={0} max={255} step={1} value={input} onChange={(e) => setInput(Number(e.target.value))} className="mt-1 w-full" />
        </label>
        <label className="block font-mono text-xs text-muted-foreground">
          Evaluated up to level <span className="text-foreground">{shown}</span> of {depth}
          <Range min={0} max={depth} step={1} value={shown} onChange={(e) => setStep(Number(e.target.value))} className="mt-1 w-full" />
        </label>
      </div>

      <div className="mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ minWidth: 520 }}
          className="w-full"
          role="img"
          aria-label={`${c.label}: ${c.gates.length} gates in ${depth} levels. Input ${hex(input)}. Through level ${shown}, ${done.length} gates have been evaluated.`}
        >
          {byLevel.map((col, l) => (
            <g key={l}>
              <text x={24 + l * COLW + CELL / 2} y={11} textAnchor="middle" fontSize={8} className="fill-muted-foreground font-mono">
                {l === 0 ? "in" : l % 2 === 0 || l === 1 ? l : ""}
              </text>
              {col.map((s, k) => {
                const on = level[s] <= shown
                const op = s < 8 ? -1 : c.gates[s - 8][0]
                const x = 24 + l * COLW
                const y = 18 + k * (CELL + GAP)
                const bit = values[s]
                const isOut = outSet.has(s)
                const fill = !on ? "transparent" : bit ? (op === 1 ? "#c2410c" : "var(--foreground)") : "transparent"
                const stroke = op === 1 ? "#c2410c" : "var(--muted-foreground)"
                return (
                  <g
                    key={s}
                    onClick={() => setPicked(s)}
                    style={{ cursor: "pointer" }}
                    opacity={on ? 1 : 0.25}
                  >
                    {op === 1 ? (
                      <rect x={x} y={y} width={CELL} height={CELL} rx={2} fill={fill} stroke={stroke} strokeWidth={1.4} />
                    ) : (
                      <circle cx={x + CELL / 2} cy={y + CELL / 2} r={CELL / 2 - 0.5} fill={fill} stroke={stroke} strokeWidth={op === 2 ? 2.2 : 1} strokeDasharray={op === 2 ? "2 1.5" : undefined} />
                    )}
                    {isOut && (
                      <text x={x + CELL / 2} y={y + CELL / 2 + 3} textAnchor="middle" fontSize={7} className={cn("font-mono", on && bit ? "fill-background" : "fill-foreground")}>
                        {`S${outSet.get(s)}`}
                      </text>
                    )}
                    {picked === s && (
                      <rect x={x - 2} y={y - 2} width={CELL + 4} height={CELL + 4} fill="none" stroke="var(--primary)" strokeWidth={1.5} rx={3} />
                    )}
                  </g>
                )
              })}
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
        <span>■ AND (orange square)</span>
        <span>● XOR (circle)</span>
        <span>◌ XNOR (dashed circle)</span>
        <span>filled = 1, empty = 0, faded = not reached yet</span>
      </div>

      <div className="mt-3 grid gap-1 font-mono text-xs">
        <div>
          Gates evaluated: <span className="text-foreground">{done.length}</span> of {c.gates.length} ({nAnd} AND, {nXor} XOR,{" "}
          {nXnor} XNOR)
        </div>
        <div>
          Output bits ready: {outReady.filter(Boolean).length} of 8 ·{" "}
          {c.outputs.map((s, k) => (
            <span key={k} className={outReady[k] ? "text-foreground" : "text-muted-foreground/40"}>
              {outReady[k] ? values[s] : "·"}
            </span>
          ))}
        </div>
        <div className={allReady ? "text-foreground" : "text-muted-foreground"}>
          {allReady
            ? `Circuit says ${hex(outVal)}; ${isInv ? "inverse S-box" : "S-box"} from field inversion says ${hex(ref)}: ${outVal === ref ? "match" : "MISMATCH"}`
            : `The last output appears at level ${Math.max(...c.outputs.map((s) => level[s]))}.`}
        </div>
        {pickedInfo && <div className="text-foreground">{pickedInfo}</div>}
      </div>
    </figure>
  )
}
