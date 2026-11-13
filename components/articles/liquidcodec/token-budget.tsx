"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog2 } from "@/lib/dmath"

// Bitrate and sequence length from three numbers: frames per second, codes per
// frame, and the size of each code's vocabulary. Presets are each codec's own
// published configuration:
// - LiquidCodec: config.json (frame_samples 1920 at 24 kHz, n_q 12, fsq_levels [8, 7, 6, 6]).
// - Mimi: 12.5 Hz, 2,048 entries per codebook (kyutai/mimi config.json); 8 codebooks in
//   Moshi (Moshi paper), 12 in Liquid's comparison table.
// - NanoCodec 1.78 kbps: 12.5 fps, 13 codebooks of 2,016 (nvidia/nemo-nano-codec model card).
// - X-Codec 2: 16 kHz with downsampling 2*2*4*4*5 = 320, so 50 Hz; one FSQ code with
//   levels 4^8 = 65,536 (HKUSTAudio/xcodec2-hf config.json).
// - EnCodec 24 kHz: strides 8*5*4*2 = 320, so 75 Hz; 1,024 entries; 2 codebooks for its
//   1.5 kbps setting, 8 for 6 kbps (facebook/encodec_24khz target_bandwidths).
// - DAC 44 kHz: hop 512 at 44,100 Hz; 9 codebooks of 1,024 (descript/dac_44khz config.json).
// - Haru-4B: VibeVoice's continuous tokenizer, one 64-dim vector per 3,200 samples at 24 kHz
//   (7.5 Hz). It has no codebook, so it has no bitrate in this sense.

const ACCENT = "oklch(0.62 0.17 295)"

type Preset = { id: string; name: string; hz: number; cb: number; size: number; sr: number; note: string; continuous?: boolean }

const PRESETS: Preset[] = [
  { id: "liquid", name: "LiquidCodec", hz: 12.5, cb: 12, size: 2016, sr: 24000, note: "GFSQ, 12 groups of [8, 7, 6, 6]" },
  { id: "mimi8", name: "Mimi, 8 codebooks", hz: 12.5, cb: 8, size: 2048, sr: 24000, note: "RVQ, as Moshi uses it" },
  { id: "mimi12", name: "Mimi, 12 codebooks", hz: 12.5, cb: 12, size: 2048, sr: 24000, note: "RVQ, as Liquid compared it" },
  { id: "nano", name: "NanoCodec", hz: 12.5, cb: 13, size: 2016, sr: 22050, note: "FSQ, 13 groups of [8, 7, 6, 6]" },
  { id: "xcodec2", name: "X-Codec 2", hz: 50, cb: 1, size: 65536, sr: 16000, note: "one FSQ code, levels 4 x 8" },
  { id: "encodec15", name: "EnCodec 24 kHz, 1.5 kbps", hz: 75, cb: 2, size: 1024, sr: 24000, note: "RVQ, 2 of 32 codebooks" },
  { id: "encodec6", name: "EnCodec 24 kHz, 6 kbps", hz: 75, cb: 8, size: 1024, sr: 24000, note: "RVQ, 8 of 32 codebooks" },
  { id: "dac", name: "DAC 44 kHz", hz: 44100 / 512, cb: 9, size: 1024, sr: 44100, note: "RVQ, 9 codebooks" },
  { id: "haru", name: "Haru-4B (VibeVoice latents)", hz: 7.5, cb: 1, size: 0, sr: 24000, note: "one 64-dim real vector, no codebook", continuous: true },
]

const HZ = [7.5, 12.5, 21.5, 25, 50, 75, 86.13]
const SIZES = [256, 1024, 2016, 2048, 4096, 16384, 65536]

function group(n: number) {
  const r = Math.round(n * 10) / 10
  const [int, dec] = String(r).split(".")
  const g = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return dec ? `${g}.${dec}` : g
}

export function TokenBudget() {
  const [hzI, setHzI] = useState(1)
  const [cb, setCb] = useState(12)
  const [sizeI, setSizeI] = useState(2)
  const [picked, setPicked] = useState("liquid")
  const [depth, setDepth] = useState<"flat" | "depth" | "maskgit">("depth")

  const hz = HZ[hzI]
  const size = SIZES[sizeI]
  const bits = mlog2(size)
  const bps = hz * cb * bits
  const tokS = hz * cb

  const apply = (p: Preset) => {
    setPicked(p.id)
    if (p.continuous) return
    const hi = HZ.reduce((best, h, i) => (Math.abs(h - p.hz) < Math.abs(HZ[best] - p.hz) ? i : best), 0)
    setHzI(hi)
    setCb(p.cb)
    setSizeI(SIZES.indexOf(p.size))
  }
  const current = PRESETS.find((p) => p.id === picked)
  const isHaru = current?.continuous === true

  // Sequential passes per second of audio for the language model side.
  const backbone = depth === "flat" ? tokS : hz
  const inner = depth === "flat" ? 0 : depth === "depth" ? tokS : hz * Math.ceil(cb / 4)

  const rows = PRESETS.map((p) => ({ ...p, tok: p.continuous ? p.hz : p.hz * p.cb }))
  const maxTok = Math.max(...rows.map((r) => r.tok))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">what a second of speech costs a language model</span>
        <span className="font-mono text-[10px] text-muted-foreground">presets from each codec&apos;s config or card</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => apply(p)}
              aria-pressed={picked === p.id}
              className={`rounded-md border px-2 py-0.5 font-mono text-[11px] ${picked === p.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              {p.name}
            </button>
          ))}
        </div>
        {isHaru ? (
          <p className="mt-3 rounded-md border bg-muted/10 p-2.5 text-[13px] leading-6">
            Haru-4B has no codebook to count. Each 133 ms frame is one 64-dimensional real vector, sampled by a flow head, so the
            language model takes 7.5 steps a second and there is no second axis inside a frame. Bits per second are not defined for
            a vector of real numbers, which is the point of the continuous camp and also the reason it needs a different sampler.
          </p>
        ) : (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block font-mono text-[11px] text-muted-foreground">
                <span className="flex justify-between">
                  <span>frames per second</span>
                  <span className="text-foreground">{hz}</span>
                </span>
                <Range min={0} max={HZ.length - 1} step={1} value={hzI} accent={ACCENT} onChange={(e) => { setHzI(Number(e.target.value)); setPicked("") }} aria-label="frames per second" className="mt-1 w-full" />
              </label>
              <label className="block font-mono text-[11px] text-muted-foreground">
                <span className="flex justify-between">
                  <span>codes per frame</span>
                  <span className="text-foreground">{cb}</span>
                </span>
                <Range min={1} max={32} step={1} value={cb} accent={ACCENT} onChange={(e) => { setCb(Number(e.target.value)); setPicked("") }} aria-label="codebooks per frame" className="mt-1 w-full" />
              </label>
              <label className="block font-mono text-[11px] text-muted-foreground">
                <span className="flex justify-between">
                  <span>entries per codebook</span>
                  <span className="text-foreground">{group(size)}</span>
                </span>
                <Range min={0} max={SIZES.length - 1} step={1} value={sizeI} accent={ACCENT} onChange={(e) => { setSizeI(Number(e.target.value)); setPicked("") }} aria-label="codebook size" className="mt-1 w-full" />
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[12px] sm:grid-cols-4">
              <div className="rounded-md border bg-muted/10 p-2">
                <div className="text-[10px] text-muted-foreground">bits per code</div>
                <div>{bits.toFixed(2)}</div>
              </div>
              <div className="rounded-md border bg-muted/10 p-2">
                <div className="text-[10px] text-muted-foreground">bitrate</div>
                <div style={{ color: ACCENT }}>{(bps / 1000).toFixed(3)} kbps</div>
              </div>
              <div className="rounded-md border bg-muted/10 p-2">
                <div className="text-[10px] text-muted-foreground">codes per second</div>
                <div>{group(tokS)}</div>
              </div>
              <div className="rounded-md border bg-muted/10 p-2">
                <div className="text-[10px] text-muted-foreground">codes in a minute</div>
                <div>{group(tokS * 60)}</div>
              </div>
            </div>
            <div className="mt-3 rounded-md border p-2.5">
              <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                {(
                  [
                    ["flat", "one code per LM step"],
                    ["depth", "one LM step per frame, depth decoder one code at a time"],
                    ["maskgit", "one LM step per frame, 4 codes per depth pass"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDepth(k)}
                    aria-pressed={depth === k}
                    className={`rounded-md border px-2 py-0.5 ${depth === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-2 font-mono text-[12px] leading-6">
                backbone steps per second: <span style={{ color: ACCENT }}>{group(backbone)}</span>
                {depth !== "flat" && (
                  <>
                    , small-decoder passes per second: <span style={{ color: ACCENT }}>{group(inner)}</span>
                  </>
                )}
              </div>
            </div>
          </>
        )}
        <div className="mt-4 space-y-1.5">
          {rows.map((r) => (
            <div key={r.id} className="font-mono text-[11px]">
              <div className="flex justify-between gap-2">
                <span style={r.id === picked ? { color: ACCENT } : undefined}>{r.name}</span>
                <span className="text-muted-foreground">
                  {r.continuous ? `${r.tok} vectors/s` : `${group(r.tok)} codes/s, ${((r.hz * r.cb * mlog2(r.size)) / 1000).toFixed(2)} kbps`}
                </span>
              </div>
              <div className="mt-0.5 h-1.5 rounded-sm bg-muted/30">
                <div className="h-full rounded-sm" style={{ width: `${(r.tok / maxTok) * 100}%`, background: r.id === picked ? ACCENT : "oklch(0.6 0.03 260)" }} />
              </div>
              <div className="text-[10px] text-muted-foreground">
                {r.note}, {group(r.sr)} Hz audio
              </div>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs leading-5 text-muted-foreground">
        Bitrate is frames per second times codes per frame times log2 of the codebook size: the information the codec is allowed
        to keep, not what an MP3 encoder would call quality. Codes per second is what a language model has to emit if it generates
        one code per step. The second panel shows the two ways around that: sum a frame&apos;s codes into one backbone position and
        let a small decoder fill in the codes, one at a time (Liquid&apos;s TTS comparison) or four per pass (the MaskGIT schedule in
        LFM3-Omni&apos;s config). The DAC frame rate is 44,100 / 512, about 86.13.
      </figcaption>
    </figure>
  )
}
