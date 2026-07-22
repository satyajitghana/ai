"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// How Antares actually works: not retrieval, not a rules engine — a terminal
// agent. Given only a CWE description and a repo mounted read-only, it issues
// shell commands (grep/find/cat), reads the output, reasons, backtracks when a
// lead is cold, and submits a ranked list of files — all inside a hard budget
// of 15 terminal calls. Scrub the trace of a CWE-78 (OS command injection) hunt.

const ACCENT = "oklch(0.62 0.13 195)"
const VULN = "oklch(0.63 0.19 25)"

type Step = {
  think: string
  cmd?: string
  out?: string
  note?: "cold" | "hot"
  submit?: string[]
}

const STEPS: Step[] = [
  {
    think: "CWE-78 is OS command injection. Start broad: find places that shell out with a variable.",
    cmd: 'grep -rn "os.system\\|subprocess\\|popen" src/',
    out: "src/cli.py:42:  os.system(f\"ping -c1 {host}\")\nsrc/net/probe.py:88:  subprocess.run(cmd, shell=True)\nsrc/util/safe.py:12:  subprocess.run(shlex.quote(a))",
  },
  {
    think: "src/cli.py builds a command with an f-string — classic sink. Read it.",
    cmd: "cat src/cli.py",
    out: "host = request.args.get('host')\n...\nos.system(f\"ping -c1 {host}\")",
    note: "hot",
  },
  {
    think: "`host` comes straight from a request arg into os.system — unsanitized. Confirm there's no guard upstream.",
    cmd: 'grep -n "host" src/cli.py',
    out: "17: host = request.args.get('host')\n42: os.system(f\"ping -c1 {host}\")",
    note: "hot",
  },
  {
    think: "safe.py used shlex.quote — probably fine. Check it so I don't over-report.",
    cmd: "cat src/util/safe.py",
    out: "subprocess.run([\"ping\", shlex.quote(a)])  # arg-list, quoted",
    note: "cold",
  },
  {
    think: "probe.py uses shell=True but on a fixed constant, not user input. Not the target. I'm confident.",
    submit: ["src/cli.py"],
  },
]

export function SearchTrace() {
  const [step, setStep] = useState(STEPS.length - 1)
  const shown = STEPS.slice(0, step + 1)
  const calls = shown.filter((s) => s.cmd).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>antares · terminal agent loop</span>
        <span className="tabular-nums">
          terminal calls <span style={{ color: calls > 15 ? VULN : ACCENT }}>{calls}</span>/15
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-2 rounded-lg border bg-background p-3 font-mono text-[11px] leading-relaxed">
          <div className="text-muted-foreground">
            <span style={{ color: VULN }}>CWE-78</span> — Improper Neutralization of Special Elements used in an OS Command
          </div>
          {shown.map((s, i) => (
            <div key={i} className={i === step ? "" : "opacity-60"}>
              <div className="flex gap-1.5 text-muted-foreground">
                <span style={{ color: ACCENT }}>&lt;think&gt;</span>
                <span className="text-foreground/80">{s.think}</span>
              </div>
              {s.cmd ? (
                <div className="mt-0.5">
                  <span style={{ color: ACCENT }}>$ </span>
                  <span className="text-foreground">{s.cmd}</span>
                  {s.out ? (
                    <pre
                      className="mt-0.5 overflow-x-auto whitespace-pre rounded border-l-2 pl-2 text-[10px] text-muted-foreground"
                      style={{ borderColor: s.note === "hot" ? VULN : s.note === "cold" ? "var(--border)" : ACCENT }}
                    >
                      {s.out}
                    </pre>
                  ) : null}
                </div>
              ) : null}
              {s.submit ? (
                <div className="mt-1 rounded-md border px-2 py-1.5" style={{ borderColor: VULN }}>
                  <span className="text-muted-foreground">submit_vulnerable_files → </span>
                  {s.submit.map((f) => (
                    <span key={f} className="font-semibold" style={{ color: VULN }}>{f}</span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>step through the trace</span>
            <span className="tabular-nums text-foreground">{step + 1}/{STEPS.length}</span>
          </div>
          <Range
            min={0}
            max={STEPS.length - 1}
            step={1}
            value={step}
            onChange={(e) => setStep(+e.target.value)}
            className="w-full"
            aria-label="trace step"
            accent={ACCENT}
          />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Note the fourth step: it checks a second candidate, sees <code className="font-mono text-xs">shlex.quote</code>,
          and <span style={{ color: ACCENT }}>rules it out</span> instead of over-reporting. That
          &ldquo;search, read, revise, backtrack&rdquo; behavior is the whole trick — and it&rsquo;s
          learned, not a property of scale.
        </p>
      </div>
    </figure>
  )
}
