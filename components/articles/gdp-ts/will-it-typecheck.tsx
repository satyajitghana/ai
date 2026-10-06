"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { OUTCOMES } from "./outcomes"

// "Will it typecheck?" for one gdp-ts call site. The reader chooses what the
// handler did before calling setPasswordProtection(project, user, password,
// { manage, plan }); the widget shows the code that choice produces and what
// the compiler said about it.
//
// No TypeScript runs in the browser. Every one of the 60 combinations was
// type-checked once with tsc 5.9.3 against gdp-ts's own src/index.ts (commit
// ebd0af9), and the verdicts and messages in ./outcomes.ts are that run's
// output, verbatim. The lint column is reasoned from the rule source
// (src/lint/plugin.ts) and the repo's lint test cases, not from a lint run.

type Role = "none" | "view" | "admin" | "forged" | "any"
type Plan = "none" | "same" | "other"
type Arg = "named" | "raw"

const ROLES: { key: Role; label: string }[] = [
  { key: "none", label: "no role check" },
  { key: "view", label: "canViewProtection" },
  { key: "admin", label: "canManageProtection" },
  { key: "forged", label: "{} as CanManageProtection" },
  { key: "any", label: "null as any" },
]

const PLANS: { key: Plan; label: string }[] = [
  { key: "none", label: "no plan check" },
  { key: "same", label: "plan of this project" },
  { key: "other", label: "plan of the other project" },
]

const ARGS: { key: Arg; label: string }[] = [
  { key: "named", label: "named project" },
  { key: "raw", label: "raw ProjectId" },
]

function codeFor(role: Role, handled: boolean, plan: Plan, arg: Arg): string[] {
  const out = ["name(viewer.id, a, b, async (user, project, other) => {"]
  if (role === "view") out.push("  const manage = await canViewProtection(user, project);")
  if (role === "admin") out.push("  const manage = await canManageProtection(user, project);")
  if (role === "forged") out.push("  const manage = {} as CanManageProtection<NameOf<typeof user>, NameOf<typeof project>>;")
  if (role === "any") out.push("  const manage = null as any;")
  if (handled && (role === "view" || role === "admin")) out.push('  if (!manage) throw new HttpError(403, "…");')
  if (plan === "same") out.push("  const plan = await planIncludesPasswordProtection(project);")
  if (plan === "other") out.push("  const plan = await planIncludesPasswordProtection(other);")
  if (handled && plan !== "none") out.push('  if (!plan) throw new HttpError(403, "…");')
  const fields = [role !== "none" ? "manage" : null, plan !== "none" ? "plan" : null].filter(Boolean).join(", ")
  out.push(
    `  await setPasswordProtection(${arg === "named" ? "project" : "a"}, user, pw, { ${fields}${fields ? " " : ""}});`
  )
  out.push("});")
  return out
}

function lintFor(role: Role): { mode: string; verdict: string }[] {
  if (role === "forged")
    return [
      {
        mode: "default preset",
        verdict:
          "gdp-ts/no-proof-assertion: Do not assert a proof or Named type (CanManageProtection). Get the proof from its trusted module in proofs/.",
      },
    ]
  if (role === "any")
    return [
      { mode: "default preset", verdict: "nothing: it only watches assertions to proof and Named types" },
      {
        mode: "strict preset",
        verdict: "gdp-ts/no-type-assertion and gdp-ts/no-any: No `any` outside proofs/ (strict mode): it satisfies any proof parameter.",
      },
    ]
  return []
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { key: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-muted-foreground mb-1.5 text-xs">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={value === o.key}
            onClick={() => onChange(o.key)}
            className={cn(
              "rounded-md border px-2 py-1 font-mono text-xs transition-colors",
              value === o.key
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:bg-muted"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function WillItTypecheck() {
  const [role, setRole] = useState<Role>("view")
  const [handled, setHandled] = useState(true)
  const [plan, setPlan] = useState<Plan>("same")
  const [arg, setArg] = useState<Arg>("named")

  const key = `${role}|${handled ? 1 : 0}|${plan}|${arg}`
  const errors = OUTCOMES[key] ?? []
  const ok = errors.length === 0
  const lint = lintFor(role)
  const code = codeFor(role, handled, plan, arg)
  const compiled = Object.values(OUTCOMES).filter((e) => e.length === 0).length
  const total = Object.keys(OUTCOMES).length

  return (
    <figure className="not-prose my-8 rounded-lg border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Segmented label="role check" options={ROLES} value={role} onChange={setRole} />
        <Segmented label="plan (entitlement) check" options={PLANS} value={plan} onChange={setPlan} />
        <Segmented label="project argument" options={ARGS} value={arg} onChange={setArg} />
        <fieldset>
          <legend className="text-muted-foreground mb-1.5 text-xs">failed checks</legend>
          <label className="flex items-center gap-2 font-mono text-xs">
            <input type="checkbox" checked={handled} onChange={(e) => setHandled(e.target.checked)} />
            if (!x) throw 403
          </label>
        </fieldset>
      </div>

      <pre className="bg-muted mt-4 overflow-x-auto rounded-md p-3 text-xs leading-relaxed">
        <code>{code.join("\n")}</code>
      </pre>

      <div
        className={cn(
          "mt-3 rounded-md border-l-4 px-3 py-2 text-sm",
          ok ? "border-emerald-600 bg-emerald-600/10" : "border-red-600 bg-red-600/10"
        )}
        aria-live="polite"
      >
        <div className="font-semibold">
          {ok ? "tsc: compiles" : `tsc: ${errors.length} error${errors.length > 1 ? "s" : ""}`}
        </div>
        {errors.map((e, i) => (
          <div key={i} className="mt-1.5 font-mono text-xs break-words">
            <span className="font-semibold">error {e[0]}:</span> {e[1]}
            {e[2] ? <div className="text-muted-foreground pl-4">{e[2]}</div> : null}
          </div>
        ))}
      </div>

      {lint.length > 0 ? (
        <div className="mt-2 rounded-md border-l-4 border-amber-500 bg-amber-500/10 px-3 py-2 text-sm">
          <div className="font-semibold">lint</div>
          {lint.map((l) => (
            <div key={l.mode} className="mt-1 font-mono text-xs break-words">
              <span className="font-semibold">{l.mode}:</span> {l.verdict}
            </div>
          ))}
        </div>
      ) : null}

      <figcaption className="text-muted-foreground mt-3 text-xs">
        Measured: every combination was type-checked with tsc 5.9.3 against gdp-ts at commit ebd0af9, and the
        messages are verbatim. {compiled} of {total} compile: the honest path and two forgeries. The lint lines are
        reasoned from the rule source, not from a lint run.
      </figcaption>
    </figure>
  )
}
