"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import { PLATFORMS, type Pkg, type Risk } from "./packages"

// Pick a platform, tick packages, read the commands. Nothing here talks to a
// TV: it only writes out the adb lines and their undo, so a reader can see
// what a debloat actually is before an agent runs one. The package counts are
// measured from the 248 contributor lists in cleanyourtv (see packages.ts).
// Defaults: every "low" package is ticked, "ask" and "high" are not.

const RISK_LABEL: Record<Risk, string> = {
  low: "low",
  ask: "ask first",
  high: "high",
}

const RISK_COLOR: Record<Risk, string> = {
  low: "oklch(0.62 0.13 160)",
  ask: "oklch(0.72 0.14 75)",
  high: "oklch(0.6 0.19 25)",
}

type Mode = "disable" | "uninstall"

function defaults(key: string): Set<string> {
  const p = PLATFORMS.find((x) => x.key === key) ?? PLATFORMS[0]
  const s = new Set<string>()
  for (const g of p.groups) for (const k of g.pkgs) if (k.risk === "low") s.add(k.id)
  return s
}

export function DebloatPlanner() {
  const [key, setKey] = useState(PLATFORMS[0].key)
  const [picked, setPicked] = useState<Set<string>>(() => defaults(PLATFORMS[0].key))
  const [mode, setMode] = useState<Mode>("disable")
  const [view, setView] = useState<"apply" | "undo">("apply")

  const platform = PLATFORMS.find((x) => x.key === key) ?? PLATFORMS[0]
  const all: Pkg[] = useMemo(() => platform.groups.flatMap((g) => g.pkgs), [platform])
  const chosen = all.filter((p) => picked.has(p.id))
  const highs = chosen.filter((p) => p.risk === "high")

  function choose(k: string) {
    setKey(k)
    setPicked(defaults(k))
  }
  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const applyLines = [
    "adb connect 192.168.1.50:5555",
    "# back up first: what is installed, what is already off",
    "adb shell pm list packages -s > system-before.txt",
    "adb shell pm list packages -d > disabled-before.txt",
    ...chosen.map((p) =>
      mode === "disable"
        ? `adb shell pm disable-user --user 0 ${p.id}`
        : `adb shell pm uninstall -k --user 0 ${p.id}`,
    ),
    "adb shell pm list packages -d   # check, do not trust exit codes",
  ]
  const undoLines = [
    "adb connect 192.168.1.50:5555",
    ...chosen.map((p) =>
      mode === "disable" ? `adb shell pm enable ${p.id}` : `adb shell cmd package install-existing ${p.id}`,
    ),
    "# a factory reset also undoes all of it: both live in /data",
  ]
  const lines = view === "apply" ? applyLines : undoLines

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>debloat planner</span>
        <span className="text-muted-foreground/60">counts from 248 contributor lists · writes commands, runs none</span>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pt-3">
        {PLATFORMS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => choose(p.key)}
            aria-pressed={p.key === key}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10.5px] transition-colors",
              p.key === key
                ? "border-foreground/30 bg-muted/60 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label} <span className="text-muted-foreground/70">· {p.of}</span>
          </button>
        ))}
      </div>
      <p className="px-4 pt-2 text-xs text-muted-foreground">
        {platform.blurb} Each count is how many of the {platform.of} lists for this platform disable the package.
      </p>

      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {platform.groups.map((g) => (
            <div key={g.title}>
              <div className="mb-1 font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">{g.title}</div>
              <ul className="space-y-1">
                {g.pkgs.map((p) => {
                  const on = picked.has(p.id)
                  return (
                    <li key={p.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 transition-colors",
                          on ? "border-foreground/25 bg-muted/40" : "border-transparent hover:bg-muted/20",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(p.id)}
                          className="mt-0.5 shrink-0"
                          aria-label={`${p.what} (${p.id})`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-[13px] text-foreground">{p.what}</span>
                            <span
                              className="rounded px-1 font-mono text-[9.5px]"
                              style={{ color: RISK_COLOR[p.risk], border: `1px solid ${RISK_COLOR[p.risk]}` }}
                            >
                              {RISK_LABEL[p.risk]}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {p.n}/{platform.of} lists
                            </span>
                          </span>
                          <span className="block break-all font-mono text-[10.5px] text-muted-foreground">{p.id}</span>
                          {p.note && on ? (
                            <span className="mt-0.5 block text-[11.5px]" style={{ color: RISK_COLOR[p.risk] }}>
                              {p.note}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          <div>
            <div className="mb-1 font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">
              Never touch
            </div>
            <div className="flex flex-wrap gap-1">
              {platform.never.map((n) => (
                <span key={n} className="rounded border border-dashed px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {(["disable", "uninstall"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10.5px] transition-colors",
                  mode === m
                    ? "border-foreground/30 bg-muted/60 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "disable" ? "pm disable-user" : "pm uninstall --user 0"}
              </button>
            ))}
            <span className="mx-1 self-center text-muted-foreground/40">|</span>
            {(["apply", "undo"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10.5px] transition-colors",
                  view === v
                    ? "border-foreground/30 bg-muted/60 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <pre className="max-h-[420px] overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
            {lines.join("\n")}
          </pre>
          <p className="mt-2 text-xs text-muted-foreground">
            {chosen.length} package{chosen.length === 1 ? "" : "s"} selected.{" "}
            {mode === "disable"
              ? "Disabled packages stay installed with their data; Settings › Apps can turn any of them back on."
              : "Uninstalling a preinstalled package for user 0 removes it for you only; its APK stays in the system image, and install-existing brings it back."}
          </p>
          {highs.length > 0 ? (
            <p className="mt-2 rounded-md border px-2 py-1.5 text-xs" style={{ borderColor: RISK_COLOR.high, color: RISK_COLOR.high }}>
              {highs.length} high-risk package{highs.length === 1 ? "" : "s"} selected. Each one has a precondition, shown under it. Run them
              last, one at a time, and check Home and the inputs after each.
            </p>
          ) : null}
        </div>
      </div>
    </figure>
  )
}
