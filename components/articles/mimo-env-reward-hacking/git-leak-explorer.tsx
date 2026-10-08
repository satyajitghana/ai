"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// A toy repository packaged into a task image. Pick which sanitisation steps
// the image builder ran, then run the probes an agent actually used (Vals AI's
// MiMo trajectories; SWE-bench issue #465). The rules are git's own:
//
//   - `git log --all` walks every ref: local branches, remote-tracking refs, tags.
//   - `git reflog` reads .git/logs/, which survives deleting the ref it logged
//     only if the reflog is not expired; an unexpired reflog also keeps the
//     objects it names alive through gc.
//   - `git fsck --unreachable --no-reflogs` lists objects no ref reaches.
//   - gc --prune=now (with gc.pruneExpire=now) deletes them; until then they sit in
//     .git/objects and any zlib + pack-index reader can print them, git or not.
//   - The setup check in mimoagent's opensource_code.py is
//     `git rev-list --all --not <base>`: it sees refs, never loose objects.
//   - mtimes: applying and reverting the reference patch while validating the
//     image leaves those files newer than the rest of the checkout.
//
// The commits, hashes and file names are invented. Nothing here runs git.

type Step = "branches" | "remote" | "tags" | "reflog" | "prune" | "mtimes"
type Probe = "logall" | "reflog" | "fsck" | "pack" | "mtime"
type State = Record<Step, boolean> & { guard: boolean; probe: Probe }

const STEPS: { k: Step; label: string; cmd: string }[] = [
  { k: "branches", label: "delete local branches", cmd: "git update-ref -d refs/heads/*" },
  { k: "remote", label: "remove the remote", cmd: "git remote remove origin" },
  { k: "tags", label: "delete tags newer than base", cmd: "git tag -d v2.1" },
  { k: "reflog", label: "expire the reflog", cmd: "git reflog expire --expire=now --all" },
  { k: "prune", label: "prune unreachable objects", cmd: "git -c gc.pruneExpire=now gc --prune=now" },
  { k: "mtimes", label: "reset file mtimes after validating", cmd: "touch -d @<base time> every file" },
]

const PRESETS: { label: string; note: string; s: Record<Step, boolean> }[] = [
  {
    label: "checkout only",
    note: "A full clone with HEAD moved back. The Terminal-Bench sglang task Vals describes was built this way.",
    s: { branches: false, remote: false, tags: false, reflog: false, prune: false, mtimes: false },
  },
  {
    label: "refs deleted, never pruned",
    note: "The pattern Vals reports in 1,795 of 2,698 MiMo code images: the later branches are gone, the objects are not. In all 40 images I opened, a reflog also survived. The setup check passes.",
    s: { branches: true, remote: true, tags: true, reflog: false, prune: false, mtimes: false },
  },
  {
    label: "SWE-bench after #471",
    note: "git_clone_timesafe: reset to base, remove origin, delete newer tags, expire the reflog, gc --prune=now. SWE-bench never applies a gold patch inside the image, so there is no mtime trail. Every probe comes back empty.",
    s: { branches: true, remote: true, tags: true, reflog: true, prune: true, mtimes: true },
  },
]

const PROBES: { k: Probe; label: string; cmd: string; git: boolean }[] = [
  { k: "logall", label: "git log --all", cmd: "git log --all --oneline | head", git: true },
  { k: "reflog", label: "git reflog", cmd: "git reflog show --all", git: true },
  { k: "fsck", label: "git fsck", cmd: "git fsck --unreachable --no-reflogs", git: true },
  { k: "pack", label: "own pack parser", cmd: "python3 read_objects.py .git/objects", git: false },
  { k: "mtime", label: "find -newermt", cmd: 'find . -newermt "$(stat -c %y setup.py)" -type f', git: false },
]

const BASE = "a3f9c21"
const FIX = "4e8d0b7"
const LATER = "9f12c6e"
const FIX_MSG = "Fix quoted newline in CSV reader (#412)"

function derive(s: State) {
  const refsReach = !s.branches || !s.remote || !s.tags
  const reflogKeeps = !s.reflog
  const objects = refsReach || reflogKeeps || !s.prune
  const setupPasses = !refsReach
  const reveals: Record<Probe, boolean> = {
    logall: !s.guard && refsReach,
    reflog: !s.guard && reflogKeeps,
    fsck: !s.guard && objects && !refsReach,
    pack: objects,
    mtime: !s.mtimes,
  }
  return { refsReach, reflogKeeps, objects, setupPasses, reveals }
}

function output(s: State, d: ReturnType<typeof derive>): string[] {
  const p = PROBES.find((x) => x.k === s.probe)!
  if (p.git && s.guard) {
    return ["[anti-hack guard] command matched a blocked pattern; returning a dummy observation", "(no output)"]
  }
  switch (s.probe) {
    case "logall": {
      const head = [`${BASE} (HEAD) Add CSV dialect sniffing`, "5b9d114 Bump version to 2.0", "1c0e7a2 Initial reader"]
      if (!d.refsReach) return head
      const deco = [!s.branches ? "main" : "", !s.remote ? "origin/main" : "", !s.tags ? "tag: v2.1" : ""].filter(Boolean).join(", ")
      return [`${LATER} (${deco}) Release 2.1`, `${FIX} ${FIX_MSG}`, ...head]
    }
    case "reflog":
      if (!d.reflogKeeps) return ["(empty: every reflog expired)"]
      return [
        `${BASE} HEAD@{0}: checkout: moving from main to ${BASE}`,
        `${LATER} refs/heads/main@{0}: clone: from https://github.com/toy/csvlib`,
        `# git show ${LATER}~1  ->  ${FIX_MSG}`,
      ]
    case "fsck":
      if (d.refsReach) return ["(nothing unreachable: the later commits are still on a ref, so git log --all already shows them)"]
      if (!d.objects) return ["(no unreachable objects)"]
      return [`unreachable commit ${LATER}…`, `unreachable commit ${FIX}…`, `unreachable tree 7d02e1a…`, `unreachable blob c81f5e0…  # src/reader.py, fixed`]
    case "pack":
      if (!d.objects) return [`commit ${BASE}  Add CSV dialect sniffing`, "commit 5b9d114  Bump version to 2.0", "commit 1c0e7a2  Initial reader", "(no commit newer than HEAD in any pack or loose object)"]
      return [
        `commit ${LATER}  parent ${FIX}  Release 2.1`,
        `commit ${FIX}  parent ${BASE}  ${FIX_MSG}`,
        `commit ${BASE}  Add CSV dialect sniffing`,
        "…",
      ]
    case "mtime":
      if (s.mtimes) return ["(no file is newer than the rest of the checkout)"]
      return ["./src/reader.py", "./tests/test_reader.py", "# exactly the files the reference patch touches"]
  }
}

const pill = (on: boolean) =>
  cn(
    "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
    on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
  )

const LEAK = "oklch(0.58 0.17 25)"
const SAFE = "oklch(0.6 0.12 160)"

export function GitLeakExplorer() {
  const [s, setS] = useState<State>({ ...PRESETS[1].s, guard: false, probe: "fsck" })
  const d = derive(s)
  const preset = PRESETS.findIndex((p) => (Object.keys(p.s) as Step[]).every((k) => p.s[k] === s[k]))
  const lines = output(s, d)
  const leaking = (Object.values(d.reveals) as boolean[]).filter(Boolean).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-foreground">Package a repo, then go looking for the fix</span>
        <span className="font-mono text-[10px] text-muted-foreground">toy repository · git&rsquo;s rules · nothing runs</span>
      </div>

      <div className="border-b px-4 py-3">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">the repository the builder cloned</div>
        <svg viewBox="0 0 640 96" className="w-full" role="img" aria-label="Five commits in a row: two older commits, the task base marked HEAD, the fix commit, and a later release commit carrying the main branch, origin/main and tag v2.1.">
          <line x1="40" y1="48" x2="600" y2="48" className="stroke-muted-foreground/40" strokeWidth="2" />
          {[
            { x: 40, id: "1c0e7a2", sub: "older" },
            { x: 160, id: "5b9d114", sub: "older" },
            { x: 300, id: BASE, sub: "task base" },
            { x: 440, id: FIX, sub: "the fix" },
            { x: 580, id: LATER, sub: "release" },
          ].map((c, i) => {
            const future = i >= 3
            const gone = future && !d.objects
            const unreachable = future && d.objects && !d.refsReach
            return (
              <g key={c.id} opacity={gone ? 0.18 : 1}>
                <circle
                  cx={c.x}
                  cy={48}
                  r={i === 3 ? 11 : 8}
                  fill={future ? (gone ? "transparent" : LEAK) : "currentColor"}
                  stroke={future ? LEAK : "currentColor"}
                  strokeWidth="2"
                  strokeDasharray={unreachable ? "3 3" : undefined}
                  fillOpacity={unreachable ? 0.35 : 1}
                />
                <text x={c.x} y={22} textAnchor="middle" className="fill-foreground font-mono" fontSize="11">
                  {c.id}
                </text>
                <text x={c.x} y={78} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize="10">
                  {c.sub}
                </text>
              </g>
            )
          })}
          <text x={300} y={93} textAnchor="middle" className="fill-foreground font-mono" fontSize="10">
            HEAD
          </text>
          {d.refsReach ? (
            <text x={580} y={93} textAnchor="middle" fontSize="10" className="font-mono" fill={LEAK}>
              {[!s.branches ? "main" : "", !s.remote ? "origin/main" : "", !s.tags ? "v2.1" : ""].filter(Boolean).join(" · ")}
            </text>
          ) : null}
        </svg>
        <p className="my-0 mt-1 text-xs text-muted-foreground">
          {!d.objects
            ? "The later commits are gone from the object store. Only HEAD's ancestry is left."
            : d.refsReach
              ? "A ref still points past HEAD, so the fix is ordinary history."
              : "No ref points past HEAD (dashed), but the commits are still in .git/objects."}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b px-4 py-3">
        <span className="mr-1 self-center font-mono text-[10px] uppercase tracking-wide text-muted-foreground">preset</span>
        {PRESETS.map((p, i) => (
          <button key={p.label} type="button" aria-pressed={preset === i} className={pill(preset === i)} onClick={() => setS((q) => ({ ...q, ...p.s }))}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid gap-px border-b bg-border sm:grid-cols-[1fr_1fr]">
        <div className="bg-background px-4 py-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">image build ran</div>
          <div className="space-y-1.5">
            {STEPS.map((st) => (
              <label key={st.k} className="flex items-start gap-2 text-xs">
                <input type="checkbox" className="mt-0.5" checked={s[st.k]} onChange={(e) => setS((q) => ({ ...q, [st.k]: e.target.checked }))} />
                <span>
                  {st.label}
                  <span className="block font-mono text-[10px] text-muted-foreground">{st.cmd}</span>
                </span>
              </label>
            ))}
            <label className="flex items-start gap-2 border-t pt-2 text-xs">
              <input type="checkbox" className="mt-0.5" checked={s.guard} onChange={(e) => setS((q) => ({ ...q, guard: e.target.checked }))} />
              <span>
                rollout runs mimoagent&rsquo;s anti-hack guard
                <span className="block font-mono text-[10px] text-muted-foreground">regex filter on git reflog, log --all, fsck, cat-file…</span>
              </span>
            </label>
          </div>
          {preset >= 0 ? <p className="my-0 mt-3 text-[11px] leading-relaxed text-muted-foreground">{PRESETS[preset].note}</p> : null}
        </div>

        <div className="bg-background px-4 py-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">the agent tries</div>
          <div className="space-y-1">
            {PROBES.map((p) => {
              const hit = d.reveals[p.k]
              return (
                <button
                  key={p.k}
                  type="button"
                  aria-pressed={s.probe === p.k}
                  onClick={() => setS((q) => ({ ...q, probe: p.k }))}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left font-mono text-[11px] transition-colors",
                    s.probe === p.k ? "border-foreground/30 bg-muted/50" : "border-border hover:bg-muted/30",
                  )}
                >
                  <span>{p.label}</span>
                  <span className="text-[10px]" style={{ color: hit ? LEAK : SAFE }}>
                    {hit ? (p.k === "mtime" ? "finds the files" : "finds the fix") : "nothing"}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-3 rounded-md border px-2.5 py-2 font-mono text-[10px]">
            <span className="text-muted-foreground">setup check </span>
            <span>git rev-list --all --not {BASE}</span>
            <span className="ml-1" style={{ color: d.setupPasses ? SAFE : LEAK }}>
              {d.setupPasses ? "→ passes" : "→ refuses the image"}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <pre className="my-0 overflow-x-auto rounded-md bg-muted/40 px-3 py-2 font-mono text-[11px] leading-relaxed">
          <span className="text-muted-foreground">$ {PROBES.find((p) => p.k === s.probe)!.cmd}</span>
          {"\n"}
          {lines.join("\n")}
        </pre>
        <p className="my-0 mt-2 text-xs text-muted-foreground">
          {leaking === 0
            ? "Nothing in the image points at the fix. That is what a sanitised task looks like, and it takes all six steps."
            : d.setupPasses && d.objects && !s.prune
              ? `The harness's history check passes, and ${leaking} of 5 probes still reach the answer. The check reads refs; the leak is in the object store.`
              : `${leaking} of 5 probes reach the answer.`}
        </p>
      </div>
    </figure>
  )
}
