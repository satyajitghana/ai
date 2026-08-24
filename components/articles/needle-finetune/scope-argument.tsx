"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// What fine-tuning is worth, and why.
//
// Cactus report the lift as a range rather than a table: "Fine-tuning lifts
// accuracy by 21 to 58 points and puts Needle 2 ahead of DeepSeek V4 Flash, a
// frontier cloud model, on three of the four benchmarks." The per-benchmark
// values live in a chart on the page rather than in text, so the bars below show
// each base score with the stated band drawn over it, not invented points.
//
// The reason given is narrow scope: your product exposes a fixed, limited set of
// tools, so a small specialist trained on exactly those beats a large generalist.
// The slider makes that concrete. A tool-calling model has to allocate capacity
// across whatever vocabulary of functions and argument schemas it might see; halve
// the vocabulary and every remaining tool gets more of the model. That is a
// hand-wave as a scaling law and an obvious truth as an engineering fact, which is
// roughly the epistemic status the claim deserves until per-benchmark numbers are
// published.
//
// Base scores are the measured ones from the four tables.

const ACCENT = "oklch(0.60 0.15 255)"
const GOOD = "oklch(0.55 0.16 155)"

const BASE = [
  { l: "Mobile Actions", v: 63.7 },
  { l: "DroidCall", v: 17.0 },
  { l: "Seal-Tools in-domain", v: 32.6 },
  { l: "Seal-Tools out-of-domain", v: 28.7 },
]

const LO = 21
const HI = 58

const HW = [
  { l: "Raspberry Pi 5", v: "500+ tok/s decode · 800+ prefill" },
  { l: "Meta Quest 3S · Apple Vision Pro", v: "400–1,500 tok/s" },
  { l: "sub-$200 phones (Samsung A-series)", v: "300–700 tok/s" },
  { l: "ESP32-S3 · ESP32-P4 · STM32H7 · i.MX RT", v: "28 MB peak session RAM, deterministic" },
]

export function ScopeArgument() {
  const [lift, setLift] = useState(40)
  const [vocab, setVocab] = useState(12)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          reported lift: +{LO} to +{HI} points · ahead of DeepSeek V4 Flash on three of four
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          fine-tunes on a laptop in minutes to hours
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-2">
          {BASE.map((b) => {
            const at = Math.min(100, b.v + lift)
            return (
              <div key={b.l}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-[10px] text-foreground">{b.l}</span>
                  <span className="font-mono text-[9px] tabular-nums text-muted-foreground">
                    base {b.v.toFixed(1)} → {at.toFixed(1)} at +{lift}
                  </span>
                </div>
                <div className="relative mt-1 h-5 rounded-sm bg-muted/40">
                  <div className="absolute left-0 h-5 rounded-sm" style={{ width: `${b.v}%`, background: ACCENT, opacity: 0.55 }} />
                  <div
                    className="absolute h-5 rounded-sm border-y border-dashed"
                    style={{
                      left: `${Math.min(100, b.v + LO)}%`,
                      width: `${Math.max(0, Math.min(100, b.v + HI) - Math.min(100, b.v + LO))}%`,
                      background: GOOD,
                      opacity: 0.18,
                      borderColor: GOOD,
                    }}
                    title={`reported band: +${LO} to +${HI}`}
                  />
                  <div
                    className="absolute top-0 h-5 border-l-2"
                    style={{ left: `${at}%`, borderColor: GOOD }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {(
            [
              ["base checkpoint, measured", ACCENT],
              ["the reported +21 to +58 band", GOOD],
            ] as const
          ).map(([l, c]) => (
            <span key={l} className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: c, opacity: 0.6 }} />
              {l}
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">lift</span>
          <Range
            min={LO}
            max={HI}
            step={1}
            value={lift}
            onChange={(e) => setLift(Number(e.target.value))}
            className="flex-1"
            aria-label="points of accuracy gained by fine-tuning"
            accent={GOOD}
          />
          <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">+{lift}</span>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            why narrow scope wins — how many tools your product actually exposes
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">tools</span>
            <Range
              min={2}
              max={200}
              step={1}
              value={vocab}
              onChange={(e) => setVocab(Number(e.target.value))}
              className="flex-1"
              aria-label="number of tools in the product's vocabulary"
              accent={ACCENT}
            />
            <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{vocab}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {Array.from({ length: Math.min(vocab, 200) }, (_, i) => (
              <span
                key={i}
                className="inline-block h-2.5 w-2.5 rounded-[2px]"
                style={{ background: ACCENT, opacity: 0.35 + 0.6 * (1 / Math.max(1, vocab / 12)) }}
              />
            ))}
          </div>
          <div className="mt-2 font-mono text-[10px] text-muted-foreground">
            {vocab <= 20 ? (
              <>
                A smart lamp, a thermostat, a media player, a timer. This is what a{" "}
                <span className="text-foreground">product</span>{" "}exposes — and 45M parameters spread over{" "}
                {vocab} functions is a great deal of model per function.
              </>
            ) : vocab <= 80 ? (
              <>A larger surface — a phone assistant, a car, a home hub. Still bounded, still enumerable.</>
            ) : (
              <>
                At this width you are no longer building a product&rsquo;s tool surface, you are building a
                general API-calling model — and that is the regime where a frontier model earns its cost.
              </>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-1">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            what it runs on once you have fine-tuned it
          </div>
          {HW.map((h) => (
            <div key={h.l} className="flex flex-wrap items-baseline gap-2 font-mono text-[10px]">
              <span className="w-64 shrink-0 truncate text-right text-foreground">{h.l}</span>
              <span className="text-muted-foreground">{h.v}</span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The claim on the page is the interesting one and I want to state exactly what it does and does not say.
          It says fine-tuning lifts accuracy by{" "}
          <span className="text-foreground">21 to 58 points</span>{" "}and puts a 45 MB-of-RAM model ahead of
          DeepSeek V4 Flash on three of four benchmarks. It does not say which benchmark got which lift, and the
          per-benchmark values live in a chart rather than a table — so the bands above are the stated range drawn
          over the measured base scores, not points I have.
          <br />
          <br />
          The mechanism, though, is not mysterious and does not need a scaling law. A general model has to
          allocate capacity across every function and argument schema it might ever see. Your device exposes
          twelve. Turning a light on does not need world knowledge or open-ended prose — it needs a mapping from a
          messy sentence to one of twelve typed signatures, and{" "}
          <span className="text-foreground">that is a small problem that happens to be the whole problem</span>.
          The interesting part is not that a specialist wins; it is that the specialist is now small enough to
          train on the laptop you are reading this on.
        </p>
      </div>
    </figure>
  )
}
