"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { ASMBIN_PARTS, ELF, LINES, OBJ_BYTES } from "./data"

// Where the bytes and lines of llm.asm go, beside the 614 MiB file the code reads.
// Linux ELF sections and per-file bytes are from my builds (size -A and the linker map);
// the OS split is the README's; line counts are wc -l at each commit.

const nf = (n: number) => n.toLocaleString("en-US")

function Bar({ parts }: { parts: { label: string; value: number; tone: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0)
  return (
    <div className="flex h-7 w-full overflow-hidden rounded border border-border">
      {parts.map((p) => (
        <div
          key={p.label}
          className={cn("h-full", p.tone)}
          style={{ width: `${(100 * p.value) / total}%` }}
          title={`${p.label}: ${nf(p.value)}`}
        />
      ))}
    </div>
  )
}

const TONES = ["bg-sky-500/80", "bg-amber-500/80", "bg-emerald-500/80", "bg-rose-500/70", "bg-violet-500/70", "bg-lime-500/70", "bg-orange-500/70", "bg-slate-500/70"]

type View = "elf" | "obj" | "lines" | "file"

export function ByteBudget() {
  const [view, setView] = useState<View>("elf")
  const [build, setBuild] = useState<keyof typeof ELF>("fastq8")
  const [commit, setCommit] = useState<"initial" | "fastq8">("fastq8")

  const elf = ELF[build]
  const elfParts = [
    { label: ".text (instructions)", value: elf.text, tone: TONES[0] },
    { label: ".rodata (constants, strings)", value: elf.rodata, tone: TONES[1] },
    { label: "headers and padding", value: elf.total - elf.text - elf.rodata, tone: TONES[7] },
  ]
  const objParts = OBJ_BYTES[commit].map(([label, text, ro], i) => ({ label, value: text + ro, tone: TONES[i % TONES.length] }))
  const objTotal = objParts.reduce((a, p) => a + p.value, 0)
  const lineParts = LINES[commit].rows.map(([label, value], i) => ({ label, value, tone: TONES[i % TONES.length] }))
  const lineTotal = lineParts.reduce((a, p) => a + p.value, 0)
  const fileParts = ASMBIN_PARTS.map((p, i) => ({ label: p.label, value: p.bytes, tone: TONES[i + 2] }))
  const fileTotal = fileParts.reduce((a, p) => a + p.value, 0)

  const tabs: [View, string][] = [
    ["elf", "The binary"],
    ["obj", "Bytes per file"],
    ["lines", "Lines per file"],
    ["file", "What it reads"],
  ]
  const parts = view === "elf" ? elfParts : view === "obj" ? objParts : view === "lines" ? lineParts : fileParts
  const unit = view === "lines" ? "" : " B"

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3 font-medium">Where llm.asm&apos;s bytes go</figcaption>
      <div className="mb-3 flex flex-wrap gap-2">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            aria-pressed={view === k}
            onClick={() => setView(k)}
            className={cn(
              "rounded-md border px-3 py-1 text-xs",
              view === k ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
        {view === "elf" && (
          <select
            className="ml-auto rounded-md border border-border bg-background px-2 py-1 text-xs"
            value={build}
            onChange={(e) => setBuild(e.target.value as keyof typeof ELF)}
            aria-label="Build"
          >
            {(Object.keys(ELF) as (keyof typeof ELF)[]).map((k) => (
              <option key={k} value={k}>
                {ELF[k].label}
              </option>
            ))}
          </select>
        )}
        {(view === "obj" || view === "lines") && (
          <select
            className="ml-auto rounded-md border border-border bg-background px-2 py-1 text-xs"
            value={commit}
            onChange={(e) => setCommit(e.target.value as typeof commit)}
            aria-label="Commit"
          >
            <option value="initial">{LINES.initial.label}</option>
            <option value="fastq8">{LINES.fastq8.label}</option>
          </select>
        )}
      </div>

      <Bar parts={parts} />

      <ul className="mt-3 grid gap-1 sm:grid-cols-2">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className={cn("inline-block h-3 w-3 shrink-0 rounded-sm", p.tone)} />
            <span className="text-muted-foreground">{p.label}</span>
            <span className="ml-auto font-mono tabular-nums">
              {nf(p.value)}
              {unit}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-muted-foreground">
        {view === "elf" && (
          <>
            {nf(elf.total)} bytes on disk.{" "}
            {build === "os" ? (
              <>
                Section sizes are the README&apos;s. The 64-bit kernel is wrapped in a 32-bit ELF so Multiboot loaders accept it,
                and its 2.1 MiB of <code>.bss</code> costs no file bytes.
              </>
            ) : (
              <>
                From <code>size -A</code> on my build, identical to the README. Two program headers, code and constants in one
                segment, and the buffers in <code>.bss</code>, which takes no file space.
              </>
            )}
          </>
        )}
        {view === "obj" && (
          <>
            {nf(objTotal)} bytes of code and constants, by source file, from the linker map of my build. The whole BPE encoder,
            chat template and output decoder are 539 bytes.
          </>
        )}
        {view === "lines" && (
          <>
            {nf(lineTotal)} lines across the Linux engine (<code>shared/</code> plus <code>main.asm</code>), counted with{" "}
            <code>wc -l</code>, comments and blank lines included. The FAST_Q8 commit more than doubled <code>matmul.asm</code>.
          </>
        )}
        {view === "file" && (
          <>
            {nf(fileTotal)} bytes in the v2 <code>.asmbin</code> the binary maps. The 12 KB of code is about two thousandths of a
            percent of what it reads every token.
          </>
        )}
      </p>
    </figure>
  )
}
