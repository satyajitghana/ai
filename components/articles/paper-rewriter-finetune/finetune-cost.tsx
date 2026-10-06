"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What a narrow-task fine-tune costs, calibrated on the two runs Maxime Rivest
// actually published rather than on spec-sheet FLOPs.
//
// Calibration (reasoned from the model cards and my token count of the dataset):
//   - 9B, all weights, one B300, 6 h over 189,983,131 tokens
//       -> 8,796 tokens/s at 8.954B params -> 7.875e13 token-params per second
//   - 4B, LoRA rank 32, one RTX 3090 at home, 38 h over the same tokens
//       -> 1,389 tokens/s at 4.206B params -> 5.84e12 token-params per second
// Scaling to another size assumes time grows linearly with parameter count,
// which is the 6ND rule of thumb; it ignores that small models use a GPU less
// efficiently, so small-model estimates are optimistic.
//
// Defaults reproduce his dataset: 4,416 papers, 20,394 conversations (4.62 per
// paper), 9,316 tokens per conversation on average (measured with the model's
// own tokenizer), one pass. The teacher price per paper defaults to his own
// "about $4,600" for 4,416 papers at pay-per-use prices (~$1.04 a paper).

const TOKENS_PER_CONV = 9316
const CONV_PER_PAPER = 20394 / 4416

type Rig = {
  key: string
  label: string
  sub: string
  rate: number // token-params per second
  price: number // default $/h
  priceNote: string
}

const RIGS: Rig[] = [
  {
    key: "b300",
    label: "Rented B300 · all weights",
    sub: "his 9B run: 6 h for one pass",
    rate: 7.875e13,
    price: 7.85,
    priceNote: "Nebius on-demand before 1 Oct, per a third-party price list",
  },
  {
    key: "3090",
    label: "Home RTX 3090 · LoRA r32",
    sub: "his 4B run: 38 h for one pass",
    rate: 5.84e12,
    price: 0.3,
    priceNote: "an assumption for power or a marketplace rental; set your own",
  },
]

const SIZES = [0.8, 2, 4, 9, 27]

const GOOD = "oklch(0.55 0.15 155)"
const WARM = "oklch(0.66 0.14 60)"

function fmtInt(n: number) {
  return Math.round(n).toLocaleString("en-US")
}
function fmtMoney(n: number) {
  if (n >= 100) return "$" + fmtInt(n)
  return "$" + n.toFixed(2)
}
function fmtHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 48) return `${h.toFixed(1)} h`
  return `${(h / 24).toFixed(1)} days`
}

export function FinetuneCost() {
  const [papers, setPapers] = useState(4416)
  const [passes, setPasses] = useState(1)
  const [size, setSize] = useState(9)
  const [rigKey, setRigKey] = useState("b300")
  const [price, setPrice] = useState(7.85)
  const [teacher, setTeacher] = useState(1.04)

  const rig = RIGS.find((r) => r.key === rigKey) ?? RIGS[0]
  const convs = papers * CONV_PER_PAPER
  const tokens = convs * TOKENS_PER_CONV * passes
  const hours = (tokens * size * 1e9) / rig.rate / 3600
  const train = hours * price
  const data = papers * teacher
  const total = train + data
  const trainShare = total > 0 ? (train / total) * 100 : 0

  const pickRig = (r: Rig) => {
    setRigKey(r.key)
    setPrice(r.price)
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          narrow-task fine-tune · calibrated on the two published runs
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">reasoned estimate</span>
      </div>

      <div className="grid gap-4 p-3 sm:grid-cols-2 sm:p-4">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {RIGS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => pickRig(r)}
                aria-pressed={rigKey === r.key}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  rigKey === r.key
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">{rig.sub}</div>

          <div>
            <div className="mb-1 flex justify-between font-mono text-[10px]">
              <span>base model</span>
              <span>{size}B params</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  aria-pressed={size === s}
                  className={cn(
                    "cursor-pointer rounded border px-2 py-0.5 font-mono text-[10px]",
                    size === s ? "border-foreground/30 bg-muted/50" : "border-border text-muted-foreground",
                  )}
                >
                  {s}B
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <div className="mb-1 flex justify-between font-mono text-[10px]">
              <span>papers rewritten by the teacher</span>
              <span className="tabular-nums">{fmtInt(papers)}</span>
            </div>
            <Range
              min={100}
              max={10000}
              step={100}
              value={papers}
              onChange={(e) => setPapers(Number(e.target.value))}
              aria-label="Papers rewritten by the teacher"
              accent={GOOD}
            />
          </label>

          <label className="block">
            <div className="mb-1 flex justify-between font-mono text-[10px]">
              <span>passes over the data</span>
              <span className="tabular-nums">{passes.toFixed(2)}</span>
            </div>
            <Range
              min={0.1}
              max={3}
              step={0.05}
              value={passes}
              onChange={(e) => setPasses(Number(e.target.value))}
              aria-label="Passes over the data"
              accent={GOOD}
            />
          </label>

          <label className="block">
            <div className="mb-1 flex justify-between font-mono text-[10px]">
              <span>GPU price per hour</span>
              <span className="tabular-nums">${price.toFixed(2)}</span>
            </div>
            <Range
              min={0}
              max={15}
              step={0.05}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              aria-label="GPU price per hour"
              accent={WARM}
            />
            <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">default: {rig.priceNote}</div>
          </label>

          <label className="block">
            <div className="mb-1 flex justify-between font-mono text-[10px]">
              <span>teacher price per paper</span>
              <span className="tabular-nums">${teacher.toFixed(2)}</span>
            </div>
            <Range
              min={0}
              max={2}
              step={0.01}
              value={teacher}
              onChange={(e) => setTeacher(Number(e.target.value))}
              aria-label="Teacher price per paper"
              accent={WARM}
            />
            <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">
              default: his ~$4,600 for 4,416 papers at pay-per-use prices; 0 if a subscription covered it
            </div>
          </label>
        </div>

        <div className="space-y-2 font-mono text-[11px]">
          <Row k="conversations" v={fmtInt(convs)} />
          <Row k="tokens trained on" v={`${(tokens / 1e6).toFixed(0)}M`} />
          <Row k="GPU time" v={fmtHours(hours)} />
          <Row k="training bill" v={fmtMoney(train)} strong color={GOOD} />
          <Row k="teacher bill" v={fmtMoney(data)} strong color={WARM} />
          <div className="pt-1">
            <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
              <span>training share of the total</span>
              <span className="tabular-nums">{trainShare.toFixed(1)}%</span>
            </div>
            <div className="flex h-4 overflow-hidden rounded-sm bg-muted/40">
              <div style={{ width: `${trainShare}%`, background: GOOD }} />
              <div style={{ width: `${100 - trainShare}%`, background: WARM, opacity: 0.6 }} />
            </div>
          </div>
          <p className="pt-2 font-sans text-xs leading-relaxed text-muted-foreground">
            At his defaults the GPU line is about a hundredth of the bill. The tweet&apos;s
            headline number is the cheap part; the teacher&apos;s rewrites are the expensive part,
            and his own write-up found that past about a thousand examples the judge stopped
            telling checkpoints apart.
          </p>
        </div>
      </div>
    </figure>
  )
}

function Row({ k, v, strong, color }: { k: string; v: string; strong?: boolean; color?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-dashed border-border/60 pb-1">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn("tabular-nums", strong && "text-sm font-semibold")} style={color ? { color } : undefined}>
        {v}
      </span>
    </div>
  )
}
