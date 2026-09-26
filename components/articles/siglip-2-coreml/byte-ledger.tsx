"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where the bytes of google/siglip2-base-patch16-256 are.
//
// Parameter counts are summed from the model.safetensors header on the Hub
// (read with an HTTP range request, 49,016 bytes of JSON, no weights), grouped
// by tensor-name prefix. They add up to the header's own total, 375,234,050.
//
// Two configurations correspond to files that exist, and the ledger shows
// their measured sizes beside the arithmetic:
//   fp32, both towers  -> model.safetensors, 1,500,985,224 bytes
//   fp16, both towers  -> the two Core ML weight.bin files, 749,313,024 bytes
// The third toggle, label vectors instead of the text tower, is reasoned: 37
// cached 768-wide fp32 vectors are 37 x 768 x 4 = 113,664 bytes, and it is not
// something FluidInference ships.

type Part = { id: string; label: string; tower: "image" | "text"; params: number }

const PARTS: Part[] = [
  { id: "img-layers", label: "image: 12 transformer layers", tower: "image", params: 85_054_464 },
  { id: "img-head", label: "image: MAP pooling head", tower: "image", params: 7_087_104 },
  { id: "img-emb", label: "image: patch + position embeddings, final norm", tower: "image", params: 788_736 },
  { id: "txt-table", label: "text: 256,000 x 768 token table", tower: "text", params: 196_608_000 },
  { id: "txt-layers", label: "text: 12 transformer layers", tower: "text", params: 85_054_464 },
  { id: "txt-rest", label: "text: positions, final norm, head", tower: "text", params: 641_280 },
]

const LABEL_VECTORS_BYTES = 37 * 768 * 4
const MEASURED = { fp32: 1_500_985_224, fp16: 749_313_024 }

const IMG = "oklch(0.62 0.13 160)"
const TXT = "oklch(0.60 0.15 255)"
const VEC = "oklch(0.66 0.16 45)"

const mb = (bytes: number) => (bytes / 1e6).toFixed(1)
const mib = (bytes: number) => (bytes / 1048576).toFixed(1)
// Thousands separators by hand: toLocaleString depends on the ICU build, and
// this string is rendered on the server and again in the browser.
const int = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")

export function ByteLedger() {
  const [fp16, setFp16] = useState(true)
  const [textTower, setTextTower] = useState(true)

  const width = fp16 ? 2 : 4
  const rows = PARTS.filter((p) => textTower || p.tower === "image").map((p) => ({
    ...p,
    bytes: p.params * width,
  }))
  const total = rows.reduce((a, r) => a + r.bytes, 0) + (textTower ? 0 : LABEL_VECTORS_BYTES)
  const fullFp32 = PARTS.reduce((a, p) => a + p.params, 0) * 4
  const measured = textTower ? (fp16 ? MEASURED.fp16 : MEASURED.fp32) : null

  const pill = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
      active
        ? "border-foreground/30 bg-muted/50 text-foreground"
        : "border-border text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          siglip2-base-patch16-256 · bytes by part
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={!fp16} onClick={() => setFp16(false)} className={pill(!fp16)}>
            fp32
          </button>
          <button type="button" aria-pressed={fp16} onClick={() => setFp16(true)} className={pill(fp16)}>
            fp16
          </button>
          <button
            type="button"
            aria-pressed={textTower}
            onClick={() => setTextTower(true)}
            className={pill(textTower)}
          >
            ship text tower
          </button>
          <button
            type="button"
            aria-pressed={!textTower}
            onClick={() => setTextTower(false)}
            className={pill(!textTower)}
          >
            ship 37 label vectors
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex h-5 w-full overflow-hidden rounded-sm bg-muted/40" aria-hidden="true">
          {rows.map((r) => (
            <span
              key={r.id}
              style={{
                width: `${((r.bytes / fullFp32) * 100).toFixed(2)}%`,
                background: r.tower === "image" ? IMG : TXT,
                opacity: r.id.endsWith("layers") ? 0.9 : r.id === "txt-table" ? 0.6 : 0.45,
              }}
              className="border-r border-background"
            />
          ))}
        </div>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          bar width is against the fp32 checkpoint with both towers, {mb(fullFp32)} MB
        </p>

        <ul className="mt-3 space-y-1">
          {rows.map((r) => (
            <li key={r.id} className="grid grid-cols-[1fr_auto] gap-2 font-mono text-[11px]">
              <span className="truncate">
                <span
                  className="mr-1.5 inline-block h-2 w-2 rounded-sm"
                  style={{ background: r.tower === "image" ? IMG : TXT }}
                />
                {r.label}
                <span className="text-muted-foreground"> · {int(r.params)} params</span>
              </span>
              <span className="text-right tabular-nums">{mb(r.bytes)} MB</span>
            </li>
          ))}
          {!textTower && (
            <li className="grid grid-cols-[1fr_auto] gap-2 font-mono text-[11px]">
              <span className="truncate">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: VEC }} />
                37 breed prompts, embedded once (fp32)
              </span>
              <span className="text-right tabular-nums">{mb(LABEL_VECTORS_BYTES)} MB</span>
            </li>
          )}
        </ul>

        <div className="mt-3 border-t pt-2 font-mono text-[11px] leading-relaxed">
          <p>
            <span className="text-muted-foreground">computed </span>
            <span className="tabular-nums">
              {int(total)} B = {mb(total)} MB = {mib(total)} MiB
            </span>
          </p>
          <p className="text-muted-foreground">
            {measured !== null ? (
              <>
                measured file{fp16 ? "s" : ""}:{" "}
                <span className="tabular-nums text-foreground">
                  {int(measured)} B = {mb(measured)} MB = {mib(measured)} MiB
                </span>{" "}
                ({fp16 ? "Core ML weight.bin, image + text" : "model.safetensors"})
              </>
            ) : (
              <>no such file exists: reasoned, and it gives up labels typed at run time</>
            )}
          </p>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Parameter counts summed from the checkpoint&apos;s safetensors header. In fp16 with both
        towers the arithmetic lands within 1.2 MB of the Core ML files; the gap is the image
        package&apos;s attention-pooling query, which the converter can fold into a constant. The
        text tower is three quarters of either download, and its token table alone is over half.
      </figcaption>
    </figure>
  )
}
