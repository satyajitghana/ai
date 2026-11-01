import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")

export type Tone = "sky" | "emerald" | "amber" | "rose" | "violet" | "slate"

export const TONE: Record<Tone, string> = {
  sky: "border-sky-500/50 bg-sky-500/15",
  emerald: "border-emerald-500/50 bg-emerald-500/15",
  amber: "border-amber-500/60 bg-amber-500/15",
  rose: "border-rose-500/50 bg-rose-500/15",
  violet: "border-violet-500/50 bg-violet-500/15",
  slate: "border-border bg-muted/60",
}

export const DOT: Record<Tone, string> = {
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  slate: "bg-muted-foreground/60",
}

export const TEXT: Record<Tone, string> = {
  sky: "text-sky-500",
  emerald: "text-emerald-500",
  amber: "text-amber-500",
  rose: "text-rose-500",
  violet: "text-violet-500",
  slate: "text-muted-foreground",
}

export function Panel({ title, sub, children, className }: { title: string; sub?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <figure className={cn("my-8 overflow-hidden rounded-xl border border-border bg-card", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-2.5">
        <span className="text-sm font-medium">{title}</span>
        {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
      </div>
      <div className="p-4">{children}</div>
    </figure>
  )
}

export function Chip({ tone = "slate", active, onClick, children, title }: { tone?: Tone; active?: boolean; onClick?: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-left text-[12px] leading-tight transition-colors hover:bg-muted",
        active ? TONE[tone] : "border-border",
      )}
    >
      {children}
    </button>
  )
}

export function Tag({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cn("inline-block rounded border px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide", TONE[tone])}>{children}</span>
}

export function Src({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[11px] text-muted-foreground">{children}</code>
}

export const EVIDENCE: Record<string, Tone> = { READ: "sky", MEASURED: "emerald", INFERRED: "amber", REPORTED: "violet" }

export function Ev({ kind }: { kind: "READ" | "MEASURED" | "INFERRED" | "REPORTED" }) {
  return <Tag tone={EVIDENCE[kind]}>{kind}</Tag>
}
