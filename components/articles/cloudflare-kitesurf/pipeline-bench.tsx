"use client"

import { useMemo, useState } from "react"

import { tablistKeys } from "@/components/articles/ui/tablist-keys"
import { cn } from "@/lib/utils"

import { BENCH, type BenchRow, type Triple } from "./data"

// Which stages of a browser run for each agent task, in Kitesurf and in headless Chromium, and
// what Cloudflare's own benchmark measured end to end for the same task on one page.
// The stage map is read from cloudflare/kitesurf at 4a29038 (see the article for the files).
// The benchmark gives only end-to-end numbers per task; nothing here is a per-stage timing.

type Task = "html" | "shot" | "pdf"
type State = "run" | "lazy" | "skip"

const TASKS: { id: Task; label: string }[] = [
  { id: "html", label: "extract HTML" },
  { id: "shot", label: "screenshot" },
  { id: "pdf", label: "PDF" },
]

type Stage = { name: string; ks: string; where: string; state: Record<Task, State>; note: Partial<Record<Task, string>> }

const STAGES: Stage[] = [
  {
    name: "fetch",
    ks: "SandboxOutbound: CORS, cookies, headers",
    where: "engine Worker",
    state: { html: "run", shot: "run", pdf: "run" },
    note: {},
  },
  {
    name: "parse to DOM",
    ks: "Blitz + html5ever, compiled to Wasm",
    where: "PageScript isolate",
    state: { html: "run", shot: "run", pdf: "run" },
    note: {},
  },
  {
    name: "run scripts",
    ks: "parser scripts baked into a module, run by V8; eval and inserted scripts on Boa",
    where: "PageScript isolate",
    state: { html: "run", shot: "run", pdf: "run" },
    note: {},
  },
  {
    name: "style",
    ks: "Stylo cascade",
    where: "PageScript isolate",
    state: { html: "lazy", shot: "run", pdf: "run" },
    note: { html: "behind a dirty flag: resolved when something reads geometry or the load settles" },
  },
  {
    name: "layout",
    ks: "Taffy, incremental",
    where: "PageScript isolate",
    state: { html: "lazy", shot: "run", pdf: "run" },
    note: { html: "same dirty flag as style" },
  },
  {
    name: "paint",
    ks: "blitz-paint records the scene, a draw list with text already shaped by Parley",
    where: "PageScript isolate",
    state: { html: "skip", shot: "run", pdf: "run" },
    note: { html: "recorded only when a renderer pulls a frame, and none is loaded (renderer-laziness e2e test)" },
  },
  {
    name: "raster",
    ks: "the renderer replays the scene into pixels with vello_cpu, software, in Wasm",
    where: "PageRenderer isolate",
    state: { html: "skip", shot: "run", pdf: "skip" },
    note: { pdf: "PDF is drawn as vectors, not pixels" },
  },
  {
    name: "encode",
    ks: "PNG / JPEG encoder, or Krilla for PDF",
    where: "PageRenderer isolate",
    state: { html: "skip", shot: "run", pdf: "run" },
    note: {},
  },
]

const CHROME = [
  "browser process + network service",
  "renderer process: Blink parse, V8 with its JIT, style, layout, paint",
  "GPU process (software in a container): raster and compositor frames",
]

const STATE_LABEL: Record<State, string> = { run: "runs", lazy: "on demand", skip: "skipped" }

const MED = "__median__"

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const n = s.length
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}

function medianRow(key: "s" | "h"): { k: Triple; b: Triple; c: Triple } {
  const pick = (b: "k" | "b" | "c"): Triple => {
    const rows = BENCH.map((r) => r[`${b}${key}` as keyof BenchRow] as Triple).filter((t): t is [number, number, number] => t !== null)
    return [median(rows.map((t) => t[0])), median(rows.map((t) => t[1])), median(rows.map((t) => t[2]))]
  }
  return { k: pick("k"), b: pick("b"), c: pick("c") }
}

const fmtMs = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`)
const fmtMiB = (v: number) => `${v >= 100 ? Math.round(v) : v.toFixed(1)} MiB`

const BACKENDS = [
  { id: "k" as const, label: "Kitesurf (Workers)", tone: "oklch(0.7 0.16 55)" },
  { id: "b" as const, label: "Browser Run (warm Chrome)", tone: "oklch(0.62 0.12 250)" },
  { id: "c" as const, label: "Chrome, cold start", tone: "oklch(0.75 0.05 250)" },
]

const METRICS = [
  { i: 0, label: "wall time", fmt: fmtMs },
  { i: 1, label: "CPU time", fmt: fmtMs },
  { i: 2, label: "memory", fmt: fmtMiB },
]

export function PipelineBench() {
  const [task, setTask] = useState<Task>("shot")
  const [page, setPage] = useState<string>(MED)

  const benchKey: "s" | "h" = task === "html" ? "h" : "s"
  const nums = useMemo(() => {
    if (page === MED) return medianRow(benchKey)
    const r = BENCH.find((x) => x.slug === page)
    if (!r) return medianRow(benchKey)
    return { k: r[`k${benchKey}`], b: r[`b${benchKey}`], c: r[`c${benchKey}`] }
  }, [page, benchKey])

  const isolates = task === "html" ? 1 : 2

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        what runs for one agent task, and what it cost on Cloudflare&apos;s benchmark
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 text-xs" role="tablist" aria-label="Agent task" onKeyDown={tablistKeys()}>
        <span className="w-14 shrink-0 font-mono text-muted-foreground">task</span>
        {TASKS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={task === t.id}
            tabIndex={task === t.id ? 0 : -1}
            onClick={() => setTask(t.id)}
            className={cn(
              "rounded border px-2 py-1 font-mono text-[11px]",
              task === t.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-0 md:grid-cols-[3fr_2fr]">
        <div className="border-b px-4 py-3 md:border-r md:border-b-0">
          <div className="mb-2 font-mono text-[11px] text-muted-foreground">
            Kitesurf: at least {isolates} Dynamic Worker{isolates > 1 ? "s" : ""} loaded per page (one more per cross-origin iframe or web worker)
          </div>
          <ol className="space-y-1">
            {STAGES.map((s) => {
              const st = s.state[task]
              const note = s.note[task]
              return (
                <li
                  key={s.name}
                  className={cn("rounded border px-2 py-1.5 text-xs", st === "skip" && "border-dashed opacity-50", st === "lazy" && "border-dashed")}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="font-medium">{s.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {s.where} · {STATE_LABEL[st]}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">{s.ks}</div>
                  {note ? <div className="mt-0.5 text-[11px] italic text-muted-foreground">{note}</div> : null}
                </li>
              )
            })}
          </ol>
        </div>
        <div className="border-b px-4 py-3 md:border-b-0">
          <div className="mb-2 font-mono text-[11px] text-muted-foreground">headless Chromium: the same stages for every task</div>
          <ul className="space-y-1">
            {CHROME.map((c) => (
              <li key={c} className="rounded border px-2 py-1.5 text-[11px] text-muted-foreground">
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">
            A cold Chrome took a median 172 ms just to be ready for CDP on this run, and that time is left out of its wall
            time below.
          </p>
        </div>
      </div>

      <div className="border-t px-4 py-3 text-xs">
        {task === "pdf" ? (
          <p className="text-[11px] text-muted-foreground">
            The benchmark measures only screenshots and HTML. There is no published PDF timing for any backend.
          </p>
        ) : (
          <>
            <label className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
              page
              <select
                value={page}
                onChange={(e) => setPage(e.target.value)}
                className="max-w-full rounded border bg-background px-1 py-0.5 text-[11px] text-foreground"
                aria-label="Benchmark page"
              >
                <option value={MED}>median of the 38 pages</option>
                {BENCH.map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-3">
              {METRICS.map((m) => {
                const vals = BACKENDS.map((b) => nums[b.id])
                const max = Math.max(1, ...vals.map((v) => (v ? v[m.i] : 0)))
                return (
                  <div key={m.label}>
                    <div className="mb-1 font-mono text-[11px] text-muted-foreground">{m.label}</div>
                    <div className="space-y-0.5">
                      {BACKENDS.map((b) => {
                        const v = nums[b.id]
                        return (
                          <div key={b.id} className="flex items-center gap-2">
                            <span className="w-40 shrink-0 truncate text-[11px] sm:w-48">{b.label}</span>
                            <div className="relative h-4 flex-1 overflow-hidden rounded-sm bg-muted">
                              {v ? (
                                <div className="h-full" style={{ width: `${((v[m.i] / max) * 100).toFixed(2)}%`, background: b.tone }} />
                              ) : null}
                            </div>
                            <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums">{v ? m.fmt(v[m.i]) : "failed"}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
      <figcaption className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Stage map read from the Kitesurf source at commit 4a29038. Numbers are Cloudflare&apos;s, from
        kitesurf.dev/benchmarks (run of 13 November 2026, median of 5 runs per page). Kitesurf&apos;s memory sums its
        isolates; Chrome&apos;s is PSS over its process tree, so the two are not the same measurement.
      </figcaption>
    </figure>
  )
}
