"use client"

// The four ONNX graphs of sam3-onnx and which of them each prompt type touches.
// Sizes, node counts and tensor shapes are read from the v0.6.0 files; the
// per-stage milliseconds are the benchmark doc's (reported) or my run (measured).

import { useState } from "react"

import { DEVICES, GRAPHS, TENSORS, mb, tensorBytes } from "./data"

type Prompt = "text" | "box" | "negbox" | "point"

const PROMPTS: { id: Prompt; label: string; note: string }[] = [
  { id: "text", label: "text", note: "tokens, language encoder, decoder with every box slot masked" },
  { id: "box", label: "example box", note: "tokens for the word visual, one live box slot out of 16" },
  { id: "negbox", label: "box + negative box", note: "two live slots; the second carries label 0" },
  { id: "point", label: "click", note: "the point decoder only, run twice (the second pass takes the first mask back in)" },
]

const ACTIVE: Record<Prompt, { lang: boolean; dec: boolean; pt: boolean }> = {
  text: { lang: true, dec: true, pt: false },
  box: { lang: true, dec: true, pt: false },
  negbox: { lang: true, dec: true, pt: false },
  point: { lang: false, dec: false, pt: true },
}

const ON = "oklch(0.58 0.15 45)"
const OFF = "oklch(0.7 0.01 250)"

function Box({ x, y, w, h, title, sub, on }: { x: number; y: number; w: number; h: number; title: string; sub: string; on: boolean }) {
  return (
    <g opacity={on ? 1 : 0.38}>
      <rect x={x} y={y} width={w} height={h} rx={6} fill="var(--card)" stroke={on ? ON : OFF} strokeWidth={on ? 2 : 1} />
      <text x={x + w / 2} y={y + 20} textAnchor="middle" fontSize={12} fontWeight={600} fill="currentColor">{title}</text>
      <text x={x + w / 2} y={y + 36} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.7}>{sub}</text>
    </g>
  )
}

function Arrow({ d, on }: { d: string; on: boolean }) {
  return <path d={d} fill="none" stroke={on ? ON : OFF} strokeWidth={on ? 2 : 1} opacity={on ? 1 : 0.4} markerEnd="url(#sam3arrow)" />
}

export function GraphSplit() {
  const [prompt, setPrompt] = useState<Prompt>("text")
  const [dev, setDev] = useState("cuda")
  const a = ACTIVE[prompt]
  const d = DEVICES.find((x) => x.id === dev) ?? DEVICES[0]
  const per = prompt === "text" ? d.text : prompt === "box" ? d.box : prompt === "negbox" ? d.negBox : d.point
  const cache = TENSORS.filter((t) => t.used === (a.pt ? "point decoder" : "decoder")).reduce((s, t) => s + tensorBytes(t.shape), 0)
  const dead = TENSORS.filter((t) => t.used === "nobody").reduce((s, t) => s + tensorBytes(t.shape), 0)

  return (
    <figure className="my-8 rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        sam3-onnx v0.6.0 · four graphs, pick a prompt
      </div>
      <div className="flex flex-wrap gap-2 px-3 pt-3">
        {PROMPTS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPrompt(p.id)}
            aria-pressed={prompt === p.id}
            className={`rounded border px-2 py-1 font-mono text-xs ${prompt === p.id ? "bg-foreground text-background" : ""}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="px-3 pt-2 text-xs text-muted-foreground">{PROMPTS.find((p) => p.id === prompt)?.note}</p>

      <svg viewBox="0 0 560 250" role="img" aria-label="The image encoder feeds the decoder and the point decoder; the language encoder feeds the decoder" className="w-full">
        <defs>
          <marker id="sam3arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" fill="currentColor" opacity={0.6} />
          </marker>
        </defs>
        <text x={8} y={22} fontSize={10} fill="currentColor" opacity={0.7}>image 3x1008x1008 uint8</text>
        <Arrow d="M20 30 L20 62 L50 62" on />
        <Box x={50} y={42} w={150} h={50} title="image encoder" sub={`${(GRAPHS.image.bytes / 1e9).toFixed(2)} GB, ${(GRAPHS.image.params / 1e6).toFixed(0)}M weights`} on />
        <text x={8} y={160} fontSize={10} fill="currentColor" opacity={0.7}>tokens 1x32 int64</text>
        <Arrow d="M20 168 L20 188 L50 188" on={a.lang} />
        <Box x={50} y={160} w={150} h={50} title="language encoder" sub={`${(GRAPHS.language.bytes / 1e9).toFixed(2)} GB`} on={a.lang} />
        <Arrow d="M200 56 L300 56 L300 100" on={!a.pt} />
        <text x={206} y={50} fontSize={9} fill="currentColor" opacity={0.7}>fpn 0-2, pos 2</text>
        <Arrow d="M200 188 L300 188 L300 150" on={a.lang} />
        <text x={206} y={182} fontSize={9} fill="currentColor" opacity={0.7}>mask, 32x1x256</text>
        <Box x={235} y={100} w={130} h={50} title="decoder" sub={`${mb(GRAPHS.decoder.bytes).toFixed(0)} MB, 16 box slots`} on={a.dec} />
        <Arrow d="M365 125 L430 125" on={a.dec} />
        <text x={438} y={121} fontSize={10} fill="currentColor">boxes, scores,</text>
        <text x={438} y={134} fontSize={10} fill="currentColor">N x 1x288x288 masks</text>
        <Arrow d="M125 42 L125 14 L430 14 L430 30" on={a.pt} />
        <text x={150} y={10} fontSize={9} fill="currentColor" opacity={0.7}>image_embeddings, high_res 1-2</text>
        <Box x={380} y={30} w={170} h={50} title="point decoder" sub={`${mb(GRAPHS.point.bytes).toFixed(1)} MB, points: dynamic`} on={a.pt} />
        <text x={380} y={98} fontSize={10} fill="currentColor" opacity={a.pt ? 1 : 0.4}>iou x3, low_res 3x288x288</text>
      </svg>

      <div className="grid gap-2 border-t px-3 py-3 text-sm sm:grid-cols-2">
        <div>
          <label className="font-mono text-xs text-muted-foreground" htmlFor="sam3dev">device (reported)</label>
          <select id="sam3dev" value={dev} onChange={(e) => setDev(e.target.value)} className="mt-1 block w-full rounded border bg-background px-2 py-1 text-sm">
            {DEVICES.filter((x) => x.src === "reported").map((x) => (
              <option key={x.id} value={x.id}>{x.label}</option>
            ))}
          </select>
        </div>
        <dl className="font-mono text-xs leading-6">
          <div className="flex justify-between"><dt>encode, once per image</dt><dd>{d.encode.toLocaleString("en-US")} ms</dd></div>
          <div className="flex justify-between"><dt>this prompt, each time</dt><dd>{per.toLocaleString("en-US")} ms</dd></div>
          <div className="flex justify-between"><dt>cache per image</dt><dd>{mb(cache).toFixed(0)} MB</dd></div>
          <div className="flex justify-between"><dt>outputs nobody reads</dt><dd>{mb(dead).toFixed(0)} MB</dd></div>
        </dl>
      </div>
    </figure>
  )
}
