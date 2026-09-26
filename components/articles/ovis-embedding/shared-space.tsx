"use client"

import { useState, type ReactNode } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mexp, mlog, mpow, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A toy of the space Ovis-Embedding trains: four concepts, each present in all
// four modalities. Every item is a unit vector with two parts: a "meaning"
// part, drawn as the angle around the circle, and a "modality" part, one
// extra direction per modality, weighted by the gap slider. The modality part
// lives in dimensions a 2-D picture cannot show, so the rings only spread out
// to say that it has grown. The instruction slider adds a component along the
// *target* modality's direction to the query alone, which is what prefixing
// "retrieve an audio clip" is meant to do. Similarity is the cosine of the two
// normalised vectors, and the softmax is Eq. (5) of the paper: sim/τ,
// exponentiated, normalised over the candidate pool. The "one source" pool is
// what a homogeneous-source micro-batch looks like: every candidate comes from
// one dataset, so from the target modality. Every number here is invented;
// nothing is a measurement of the model.

type Mod = "text" | "image" | "video" | "audio"
const MODS: Mod[] = ["text", "image", "video", "audio"]

const MOD_COLOUR: Record<Mod, string> = {
  text: "oklch(0.62 0.13 250)",
  image: "oklch(0.7 0.14 75)",
  video: "oklch(0.64 0.15 150)",
  audio: "oklch(0.63 0.17 20)",
}

// degrees: a small spread so one concept's four items don't coincide
const JITTER: Record<Mod, number> = { text: -7, image: 4, video: 10, audio: -2 }

type Concept = { k: string; deg: number; items: Record<Mod, string> }
const CONCEPTS: Concept[] = [
  { k: "dog", deg: 45, items: { text: "“a dog barks”", image: "dog photo", video: "dog clip", audio: "bark" } },
  { k: "wave", deg: 135, items: { text: "“a wave breaks”", image: "wave photo", video: "surf clip", audio: "surf roar" } },
  { k: "rain", deg: 225, items: { text: "“rain on a roof”", image: "storm photo", video: "rain clip", audio: "rainfall" } },
  { k: "piano", deg: 315, items: { text: "“a piano chord”", image: "piano photo", video: "recital clip", audio: "chord" } },
]

type Item = { id: string; c: number; m: Mod; label: string; rad: number }
const DEG = Math.PI / 180
const ITEMS: Item[] = CONCEPTS.flatMap((c, ci) =>
  MODS.map((m) => ({ id: `${c.k}-${m}`, c: ci, m, label: c.items[m], rad: (c.deg + JITTER[m]) * DEG })),
)

const TAUS = [0.01, 0.02, 0.03, 0.05, 0.08, 0.12, 0.2, 0.35, 0.5, 1]

// plot frame
const W = 320
const H = 250
const CX = W / 2
const CY = H / 2
const R = 92
const GAP_MAX = 1.5

function ringRadius(m: Mod, gap: number) {
  const k = MODS.indexOf(m) - 1.5
  return R + k * 14 * (gap / GAP_MAX)
}

function xy(it: Item, gap: number): [number, number] {
  const r = ringRadius(it.m, gap)
  return [CX + r * mcos(it.rad), CY - r * msin(it.rad)]
}

function Glyph({ m, x, y, r, fill, stroke }: { m: Mod; x: number; y: number; r: number; fill: string; stroke?: string }) {
  const sw = stroke ? 1.6 : 0
  if (m === "text") return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} rx={1.5} fill={fill} stroke={stroke} strokeWidth={sw} />
  if (m === "image") return <circle cx={x} cy={y} r={r * 1.1} fill={fill} stroke={stroke} strokeWidth={sw} />
  if (m === "video")
    return (
      <polygon
        points={`${x},${y - r * 1.25} ${x + r * 1.2},${y + r * 0.9} ${x - r * 1.2},${y + r * 0.9}`}
        fill={fill}
        stroke={stroke}
        strokeWidth={sw}
      />
    )
  return (
    <polygon
      points={`${x},${y - r * 1.3} ${x + r * 1.3},${y} ${x},${y + r * 1.3} ${x - r * 1.3},${y}`}
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
    />
  )
}

function Chip({ on, onClick, children, colour }: { on: boolean; onClick: () => void; children: ReactNode; colour?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
        on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
      style={on && colour ? { borderColor: colour } : undefined}
    >
      {children}
    </button>
  )
}

function Slider({
  label,
  value,
  shown,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  shown: string
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{shown}</span>
      </div>
      <Range min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full" aria-label={label} />
    </div>
  )
}

export function SharedSpace() {
  const [qid, setQid] = useState("dog-text")
  const [target, setTarget] = useState<Mod>("audio")
  const [gap, setGap] = useState(0.5)
  const [instr, setInstr] = useState(0)
  const [tauIdx, setTauIdx] = useState(3)
  const [gamma, setGamma] = useState(2)
  const [pool, setPool] = useState<"mixed" | "source">("mixed")

  const tau = TAUS[tauIdx]
  const q = ITEMS.find((i) => i.id === qid) ?? ITEMS[0]
  const tgt: Mod = target === q.m ? (MODS.find((m) => m !== q.m) as Mod) : target

  // cosine of [cos θ, sin θ, gap·onehot(m) (+ instr·onehot(target) on the query)]
  const nq = Math.sqrt(1 + gap * gap + instr * instr)
  const nc = Math.sqrt(1 + gap * gap)
  const sim = (c: Item) =>
    (mcos(q.rad - c.rad) + (c.m === q.m ? gap * gap : 0) + (c.m === tgt ? instr * gap : 0)) / (nq * nc)

  const cands = ITEMS.filter((i) => i.id !== q.id && (pool === "mixed" || i.m === tgt))
  const scored = cands.map((it) => ({ it, s: sim(it) }))
  const maxS = Math.max(...scored.map((x) => x.s))
  const ex = scored.map((x) => mexp((x.s - maxS) / tau))
  const Z = ex.reduce((a, b) => a + b, 0)
  const probs = scored.map((x, i) => ({ ...x, p: ex[i] / Z })).sort((a, b) => b.p - a.p)

  const isPositive = (it: Item) => it.c === q.c && it.m === tgt
  const posEntry = probs.find((x) => isPositive(x.it))
  const pi = posEntry ? posEntry.p : 0
  const loss = -mlog(Math.max(pi, 1e-12))
  const focal = mpow(1 - pi, gamma)
  const hit = probs.length > 0 && isPositive(probs[0].it)

  // where the probability that is NOT on the positive goes
  let sibling = 0
  let own = 0
  let other = 0
  for (const x of probs) {
    if (isPositive(x.it)) continue
    if (x.it.c === q.c) sibling += x.p
    else if (x.it.m === q.m) own += x.p
    else other += x.p
  }

  const top = probs.slice(0, 5)
  const qxy = xy(q, gap)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one space for four modalities: a toy, every number invented</span>
        <span className="font-mono text-[10px] text-muted-foreground">π = softmax(cos / τ) at the positive</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full"
              role="img"
              aria-label="Sixteen items on a circle: four concepts at four angles, each in text, image, video and audio. Lines run from the query to its three most probable candidates."
            >
              <circle cx={CX} cy={CY} r={R} fill="none" stroke="currentColor" strokeOpacity={0.08} />
              {CONCEPTS.map((c) => (
                <text
                  key={c.k}
                  x={CX + 48 * mcos(c.deg * DEG)}
                  y={CY - 48 * msin(c.deg * DEG) + 3}
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono"
                  fontSize={9}
                  opacity={0.75}
                >
                  {c.k}
                </text>
              ))}
              {top.slice(0, 3).map((x) => {
                const p = xy(x.it, gap)
                return (
                  <line
                    key={`l-${x.it.id}`}
                    x1={qxy[0]}
                    y1={qxy[1]}
                    x2={p[0]}
                    y2={p[1]}
                    stroke="currentColor"
                    strokeOpacity={0.15 + 0.6 * x.p}
                    strokeWidth={0.6 + 3 * x.p}
                  />
                )
              })}
              {ITEMS.map((it) => {
                const p = xy(it, gap)
                const isQ = it.id === q.id
                const inPool = isQ || pool === "mixed" || it.m === tgt
                return (
                  <g key={it.id} onClick={() => setQid(it.id)} className="cursor-pointer" opacity={inPool ? 1 : 0.18}>
                    <title>{`${it.label} (${it.m})`}</title>
                    <Glyph m={it.m} x={p[0]} y={p[1]} r={isQ ? 6.5 : 5} fill={MOD_COLOUR[it.m]} stroke={isQ ? "currentColor" : undefined} />
                    {isPositive(it) && (
                      <circle cx={p[0]} cy={p[1]} r={11} fill="none" stroke="currentColor" strokeOpacity={0.55} strokeDasharray="2 2" />
                    )}
                  </g>
                )
              })}
            </svg>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
              {MODS.map((m) => (
                <span key={m} className="inline-flex items-center gap-1">
                  <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden>
                    <Glyph m={m} x={6} y={6} r={3.6} fill={MOD_COLOUR[m]} />
                  </svg>
                  {m}
                </span>
              ))}
              <span>· angle = meaning · click an item to query with it · dashed ring = the positive</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="mb-1 font-mono text-[10px] text-muted-foreground">
                query: <span className="text-foreground">{q.label}</span> ({q.m}) · retrieve a
              </div>
              <div className="flex flex-wrap gap-1.5">
                {MODS.filter((m) => m !== q.m).map((m) => (
                  <Chip key={m} on={tgt === m} onClick={() => setTarget(m)} colour={MOD_COLOUR[m]}>
                    {m}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1 font-mono text-[10px] text-muted-foreground">candidate pool</div>
              <div className="flex flex-wrap gap-1.5">
                <Chip on={pool === "mixed"} onClick={() => setPool("mixed")}>
                  mixed: all 15 items
                </Chip>
                <Chip on={pool === "source"} onClick={() => setPool("source")}>
                  one source: target modality only
                </Chip>
              </div>
            </div>

            <Slider label="modality gap" value={gap} shown={gap.toFixed(2)} min={0} max={GAP_MAX} step={0.05} onChange={setGap} />
            <Slider
              label="instruction names the target"
              value={instr}
              shown={instr.toFixed(2)}
              min={0}
              max={1}
              step={0.05}
              onChange={setInstr}
            />
            <Slider
              label="temperature τ"
              value={tauIdx}
              shown={tau.toFixed(2)}
              min={0}
              max={TAUS.length - 1}
              step={1}
              onChange={setTauIdx}
            />
            <Slider label="focal exponent γ (unpublished)" value={gamma} shown={gamma.toFixed(1)} min={0} max={4} step={0.5} onChange={setGamma} />
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">
              softmax over {cands.length} candidates, top {top.length}
            </div>
            <div className="space-y-1">
              {top.map((x) => {
                const pos = isPositive(x.it)
                return (
                  <div key={x.it.id} className="flex items-center gap-2">
                    <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden className="shrink-0">
                      <Glyph m={x.it.m} x={6} y={6} r={3.6} fill={MOD_COLOUR[x.it.m]} />
                    </svg>
                    <span className={cn("w-28 shrink-0 truncate font-mono text-[10px]", pos ? "text-foreground" : "text-muted-foreground")}>
                      {x.it.label}
                      {pos ? " ✓" : ""}
                    </span>
                    <div className="relative h-3 flex-1 rounded-sm bg-muted/40">
                      <div
                        className="absolute inset-y-0 left-0 rounded-sm"
                        style={{ width: `${(x.p * 100).toFixed(2)}%`, background: MOD_COLOUR[x.it.m], opacity: pos ? 1 : 0.55 }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{x.p.toFixed(3)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
            <Stat label="π, the positive's share" value={pi.toFixed(3)} />
            <Stat label="InfoNCE loss, −log π" value={loss.toFixed(2)} />
            <Stat label={`focal weight, (1 − π)^${gamma.toFixed(1)}`} value={focal.toFixed(3)} />
            <Stat label="hit@1" value={hit ? "yes" : "no"} tone={hit ? "good" : "bad"} />
            <div className="col-span-2 rounded-lg border bg-muted/15 px-3 py-2">
              <div className="text-muted-foreground">where the rest of the probability goes</div>
              <div className="mt-1 flex h-3 overflow-hidden rounded-sm bg-muted/40">
                <div style={{ width: `${(sibling * 100).toFixed(2)}%`, background: "oklch(0.7 0.12 300)" }} />
                <div style={{ width: `${(own * 100).toFixed(2)}%`, background: MOD_COLOUR[q.m] }} />
                <div style={{ width: `${(other * 100).toFixed(2)}%`, background: "oklch(0.6 0.02 260)" }} />
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-muted-foreground">
                <span>same meaning, wrong modality {(sibling * 100).toFixed(1)}%</span>
                <span>query&apos;s own modality {(own * 100).toFixed(1)}%</span>
                <span>the rest {(other * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-1 px-3 pb-3 text-sm leading-6 text-muted-foreground sm:px-4 sm:pb-4">
        At the defaults, the caption &ldquo;a dog barks&rdquo; finds its concept at once, and then
        cannot choose: the photo, the clip and the bark all carry the same meaning, so the softmax
        splits between them and the bark you asked for gets well under half. Push the gap past
        about one and the other <em>captions</em> overtake all three, because every text item shares
        the same modality direction: the query-modality bias MMEB-v3 measures. Raise the instruction
        slider and the bark pulls ahead, which is the job a task instruction has to do. The
        one-source pool removes both failure modes from the loss, since every negative is already
        audio. A smaller τ sharpens the softmax, and the focal weight falls toward zero for any query
        whose π is already near one.
      </p>
    </figure>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border bg-muted/15 px-3 py-2">
      <div className="text-muted-foreground">{label}</div>
      <div
        className="mt-0.5 text-sm tabular-nums"
        style={tone ? { color: tone === "good" ? "oklch(0.64 0.15 150)" : "oklch(0.63 0.17 20)" } : undefined}
      >
        {value}
      </div>
    </div>
  )
}
