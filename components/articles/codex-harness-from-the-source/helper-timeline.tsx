"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { Ev, Panel, Src } from "./ui"

// codex-rs/linux-sandbox/src/linux_run_main.rs: run_main() 135-329; the inner stage (about 167-250) runs inside bubblewrap.
type Step = { stage: "outer" | "inner"; label: string; src: string; note: string; fs: boolean; caps: boolean; seccomp: boolean }

const STEPS: Step[] = [
  { stage: "outer", label: "resolve the permission profile", src: "linux_run_main.rs:135-266", note: "Builds the bubblewrap options from the profile: filesystem entries, network mode, whether to inherit the PID namespace.", fs: false, caps: false, seccomp: false },
  { stage: "outer", label: "prepare the proxy bridge (host side)", src: "linux_run_main.rs:268", note: "Only for a managed proxy: the host listens on a Unix socket that the inner stage will bridge to.", fs: false, caps: false, seccomp: false },
  { stage: "outer", label: "build the argv and exec bubblewrap", src: "linux_run_main.rs:308-315", note: "The inner command is this same binary with --apply-seccomp-then-exec. If a fresh procfs cannot be mounted, run_bwrap_with_proc_fallback retries without it.", fs: false, caps: false, seccomp: false },
  { stage: "inner", label: "verify fd-backed mounts", src: "linux_run_main.rs:168; fd_mount.rs", note: "Descriptors used for bind-data mounts must authenticate before any sandboxed code runs.", fs: true, caps: false, seccomp: false },
  { stage: "inner", label: "capget: no capability may remain", src: "linux_run_main.rs:178-194", note: "If any effective or permitted capability is left, the helper panics: “Linux sandbox retained effective or permitted capabilities”.", fs: true, caps: true, seccomp: false },
  { stage: "inner", label: "activate proxy routes in the namespace", src: "linux_run_main.rs:200; proxy_routing.rs:131", note: "Brings up loopback, binds a local port and rewrites 16 proxy environment variables to point at it.", fs: true, caps: true, seccomp: false },
  { stage: "inner", label: "no_new_privs + seccomp", src: "seccomp.rs:72-76, 284-295; linux_run_main.rs:205", note: "no_new_privs is set only when needed, because many bubblewrap deployments rely on setuid. Then the filter goes in, in process, after the filesystem view exists.", fs: true, caps: true, seccomp: true },
  { stage: "inner", label: "fork, exec the command, forward signals", src: "linux_run_main.rs:43, 216", note: "The child execs the command; the parent forwards SIGHUP, SIGINT, SIGQUIT and SIGTERM and reaps. No path falls back to legacy Landlock.", fs: true, caps: true, seccomp: true },
]

export function HelperTimeline() {
  const [i, setI] = useState(4)
  const s = STEPS[i]
  return (
    <Panel title="Two stages: build the box, then lock it from inside" sub="the Linux helper re-executes itself; click a step">
      <ol className="flex flex-col gap-1.5 md:flex-row md:gap-1">
        {STEPS.map((x, k) => (
          <li key={x.label} className="md:flex-1">
            <button type="button" onClick={() => setI(k)} className={cn("h-full w-full rounded-md border px-2 py-2 text-left text-[11.5px] leading-snug", x.stage === "outer" ? "border-sky-500/40 bg-sky-500/10" : "border-emerald-500/40 bg-emerald-500/10", i === k && "ring-2 ring-amber-500")}>
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{x.stage === "outer" ? "host side" : "inside bubblewrap"}</div>
              {x.label}
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[12px]">
        {([["filesystem view built", s.fs], ["capabilities verified empty", s.caps], ["seccomp filter installed", s.seccomp]] as const).map(([l, on]) => (
          <div key={l} className={cn("rounded-md border px-2 py-1.5", on ? "border-emerald-500/50 bg-emerald-500/15" : "border-border text-muted-foreground")}>{on ? "yes" : "not yet"}<div className="text-[10.5px] text-muted-foreground">{l}</div></div>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-[13px]">
        <div className="mb-1 flex flex-wrap items-center gap-2"><span className="font-medium">{s.label}</span> <Ev kind="READ" /> <Src>{s.src}</Src></div>
        <p className="text-muted-foreground">{s.note}</p>
      </div>
    </Panel>
  )
}
