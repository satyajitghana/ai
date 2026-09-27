"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// A per-task cost ledger for jevgrep, anchored on the repository's own
// variance-repeat aggregate (specs/done/jevgrep/assets/variance-repeat-aggregate.json,
// commit 762028f):
//
//   baseline Sol bill, ten tasks      $7.6220690   -> $0.7622069 per task
//   jg Sol bill, ten tasks            $4.5195532   -> share removed 40.70%
//   Jev known subtotal, ten tasks     $1.021334412 over 5,173 client calls
//                                      -> $0.000197 per call, 517.3 calls per task
//   solves                             8/10 baseline, 7/10 with jg
//
// The price slider rescales the whole agent bill by (price / $4), Sol's input
// price on Vercel AI Gateway. That is an assumption: it holds the trajectory
// fixed while the model gets cheaper. GPT-5.6 Terra's and Luna's input, output
// and cached-read prices are 1/2 and 1/20 of Sol's (1/1.67 and 1/16.7 for
// output), so the input ratio is a fair single knob.
//
// Everything below is + - * / on those literals, so nothing can serialize
// differently on the server and in the browser.

const B_SOL = 0.7622069 // measured: baseline Sol bill per task
const SOL_PRICE = 4 // reported: $ per million input tokens, GPT-5.6 Sol
const CALLS = 517.3 // measured: Jev client calls per task, repeat cohort
const BASE_SOLVES = 8

const AGENT = "oklch(0.62 0.03 250)"
const JEV = "oklch(0.68 0.15 65)"
const WIN = "oklch(0.56 0.14 155)"
const LOSE = "oklch(0.58 0.19 27)"

type Preset = {
  key: string
  label: string
  share: number
  price: number
  micro: number
  solves: number
}

const PRESETS: Preset[] = [
  { key: "published", label: "as published (Jev = $0)", share: 40.7, price: 4, micro: 0, solves: 7 },
  { key: "counted", label: "repeat, Jev counted", share: 40.7, price: 4, micro: 197, solves: 7 },
  { key: "first", label: "first run, Jev counted", share: 27.3, price: 4, micro: 197, solves: 6 },
  { key: "terra", label: "on a Terra-priced agent", share: 40.7, price: 2, micro: 197, solves: 7 },
  { key: "luna", label: "on a Luna-priced agent", share: 40.7, price: 0.2, micro: 197, solves: 7 },
]

const PRICE_MARKS = [
  { p: 0.2, name: "Luna" },
  { p: 2, name: "Terra" },
  { p: 4, name: "Sol" },
]

function usd(v: number) {
  if (v >= 10) return `$${v.toFixed(1)}`
  if (v >= 1) return `$${v.toFixed(2)}`
  return `$${v.toFixed(3)}`
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

export function CostLedger() {
  const [share, setShare] = useState(40.7) // percent of the agent bill jg removes
  const [price, setPrice] = useState(4) // $ per million input tokens
  const [micro, setMicro] = useState(197) // Jev cost per call, in millionths of a dollar
  const [solves, setSolves] = useState(7)

  const s = share / 100
  const B = (B_SOL * price) / SOL_PRICE
  const J = (CALLS * micro) / 1_000_000
  const agentJg = B * (1 - s)
  const totalJg = agentJg + J
  const net = (B - totalJg) / B
  const cpsBase = B / (BASE_SOLVES / 10)
  const cpsJg = totalJg / (solves / 10)
  const perSolve = (cpsBase - cpsJg) / cpsBase

  // Break-evens, each holding the other three knobs where they are.
  const shareNeeded = J / B // share of the bill jg must remove to break even
  const shareFor40 = 0.4 + J / B // share it must remove for "40% lower" to stay true
  const priceNeeded = s > 0 ? (SOL_PRICE * J) / (s * B_SOL) : Infinity
  const solvesNeeded = BASE_SOLVES * (totalJg / B) // solves for per-solve parity

  const verdict =
    net >= 0.4
      ? { tone: WIN, text: "The 40% survives." }
      : net > 0
        ? { tone: WIN, text: `A saving survives, but it is ${pct(net)}, not 40%.` }
        : { tone: LOSE, text: "jg costs more than it saves: Jev's bill is larger than the agent saving." }

  const max = Math.max(B, totalJg)
  const w = (v: number) => `${((v / max) * 100).toFixed(2)}%`

  const active = PRESETS.find(
    (p) => p.share === share && p.price === price && p.micro === micro && p.solves === solves,
  )?.key

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          cost ledger · one average SWE-bench task · anchored on the repo&rsquo;s repeat cohort
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-4 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setShare(p.share)
                setPrice(p.price)
                setMicro(p.micro)
                setSolves(p.solves)
              }}
              aria-pressed={active === p.key}
              className={`cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10.5px] transition-colors ${
                active === p.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-[11px] text-muted-foreground">
              <span>share of the agent bill jg removes</span>
              <span className="tabular-nums text-foreground">{share.toFixed(1)}%</span>
            </span>
            <Range
              min={0}
              max={70}
              step={0.1}
              value={share}
              onChange={(e) => setShare(Number(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="Share of the coding agent's bill that jg removes, in percent"
            />
            <span className="font-mono text-[10px] text-muted-foreground">
              repeat 40.7% · first run of the same package 27.3%
            </span>
          </label>

          <div className="block">
            <span className="flex items-baseline justify-between font-mono text-[11px] text-muted-foreground">
              <span>coding-model input price, $ per million</span>
              <span className="tabular-nums text-foreground">${price.toFixed(2)}</span>
            </span>
            <Range
              min={0.2}
              max={8}
              step={0.1}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="Coding model input price in dollars per million tokens"
            />
            <span className="font-mono text-[10px] text-muted-foreground">
              {PRICE_MARKS.map((m, i) => (
                <span key={m.name}>
                  {i ? " · " : ""}
                  <button
                    type="button"
                    onClick={() => setPrice(m.p)}
                    className="cursor-pointer underline decoration-dotted underline-offset-2 hover:text-foreground"
                  >
                    {m.name} ${m.p.toFixed(2)}
                  </button>
                </span>
              ))}
            </span>
          </div>

          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-[11px] text-muted-foreground">
              <span>Jev cost per call</span>
              <span className="tabular-nums text-foreground">${(micro / 1_000_000).toFixed(6)}</span>
            </span>
            <Range
              min={0}
              max={600}
              step={1}
              value={micro}
              onChange={(e) => setMicro(Number(e.target.value))}
              className="w-full cursor-pointer"
              accent={JEV}
              aria-label="Jev cost per call in millionths of a dollar"
            />
            <span className="font-mono text-[10px] text-muted-foreground">
              measured mean $0.000197 · {CALLS} calls per task · ${J.toFixed(3)} per task
            </span>
          </label>

          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-[11px] text-muted-foreground">
              <span>tasks solved with jg, out of 10</span>
              <span className="tabular-nums text-foreground">
                {solves} <span className="text-muted-foreground">vs {BASE_SOLVES} baseline</span>
              </span>
            </span>
            <Range
              min={4}
              max={10}
              step={1}
              value={solves}
              onChange={(e) => setSolves(Number(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="Tasks solved with jg out of ten"
            />
            <span className="font-mono text-[10px] text-muted-foreground">
              first run 6 · repeat 7 · baseline, run once, 8
            </span>
          </label>
        </div>

        <div className="mt-5 space-y-2.5">
          <div>
            <div className="mb-1 flex justify-between font-mono text-[10.5px] text-muted-foreground">
              <span>baseline · agent alone</span>
              <span className="tabular-nums text-foreground">{usd(B)}</span>
            </div>
            <div className="flex h-5 w-full overflow-hidden rounded-sm bg-muted/40">
              <div style={{ width: w(B), background: AGENT }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between font-mono text-[10.5px] text-muted-foreground">
              <span>
                with jg · <span style={{ color: AGENT }}>agent {usd(agentJg)}</span> +{" "}
                <span style={{ color: JEV }}>Jev {usd(J)}</span>
              </span>
              <span className="tabular-nums text-foreground">{usd(totalJg)}</span>
            </div>
            <div className="flex h-5 w-full overflow-hidden rounded-sm bg-muted/40">
              <div style={{ width: w(agentJg), background: AGENT }} />
              <div style={{ width: w(J), background: JEV }} />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">per attempted task</div>
            <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: net > 0 ? WIN : LOSE }}>
              {net >= 0 ? `${pct(net)} lower` : `${pct(-net)} higher`}
            </div>
          </div>
          <div className="rounded-md border px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">per solved task</div>
            <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: perSolve > 0 ? WIN : LOSE }}>
              {usd(cpsJg)}
              <span className="text-xs font-normal text-muted-foreground"> vs {usd(cpsBase)}</span>
            </div>
          </div>
          <div className="rounded-md border px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">Jev as a share of the saving</div>
            <div className="font-mono text-xl font-semibold tabular-nums text-foreground">
              {s * B > 0 ? pct(J / (s * B)) : "—"}
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm font-medium" style={{ color: verdict.tone }}>
          {verdict.text}
        </p>

        <ul className="mt-2 space-y-1 font-mono text-[11px] leading-5 text-muted-foreground">
          <li>
            break-even share removed: <span className="text-foreground">{pct(shareNeeded)}</span> of the agent bill ·
            to keep &ldquo;40% lower&rdquo; true: <span className="text-foreground">{pct(shareFor40)}</span>
          </li>
          <li>
            break-even coding-model price:{" "}
            <span className="text-foreground">
              {Number.isFinite(priceNeeded) ? `$${priceNeeded.toFixed(2)} per million input` : "none"}
            </span>{" "}
            ({Number.isFinite(priceNeeded) ? `${pct(priceNeeded / SOL_PRICE)} of Sol` : "no saving to protect"})
          </li>
          <li>
            solves needed for cost per solve to match the baseline:{" "}
            <span className="text-foreground">{solvesNeeded.toFixed(1)} of 10</span>
          </li>
        </ul>

        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Bills are the repeat cohort&rsquo;s per-task means. The price knob scales the whole agent bill by its input
          price relative to Sol&rsquo;s $4 per million and holds the trajectory fixed, which a cheaper model would not.
          Jev&rsquo;s known cost is a lower bound: three of ten tasks in the repeat have incomplete Jev metadata.
        </p>
      </div>
    </figure>
  )
}
