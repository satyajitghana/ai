"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// An isometric cutaway of the Linux sandbox, hand-authored with literal SVG
// coordinates (no runtime trig, so nothing to hydrate-mismatch). It is an
// illustration of the mechanism, not a measurement: the stack is the mount
// table bwrap builds (read-only host root, the writable project bind on top,
// the deny caps over it) and the pipe is the one hole in the network
// namespace — the proxy's Unix socket. Every label maps to a real flag in the
// argv explorer above. Hover or tap a layer for its note.

type LayerId = "host" | "project" | "deny" | "net"

const LAYERS: { id: LayerId; label: string; note: string }[] = [
  { id: "host", label: "host /  (read-only)", note: "--ro-bind / /  — the whole host tree, read-only. Reads are open by default; writes here answer EROFS." },
  { id: "project", label: "project  (writable bind)", note: "--bind $S/run/project — the one allowWrite root, re-mounted read-write on top of the read-only root." },
  { id: "deny", label: "deny caps  (×12 here)", note: "--tmpfs over a denyRead dir, and /dev/null over each mandatory-deny file (.bashrc, .git/hooks, …). The kernel's mount table is the whole policy." },
  { id: "net", label: "proxy socket  (the only way out)", note: "--unshare-net removes every interface but lo. The one hole is the host proxy's Unix socket, bind-mounted in; socat bridges localhost:3128/1080 to it." },
]

const FILL: Record<string, { top: string; side: string; stroke: string }> = {
  host: { top: "#64748b", side: "#475569", stroke: "#334155" },
  project: { top: "#22c55e", side: "#16a34a", stroke: "#15803d" },
  deny: { top: "#ef4444", side: "#dc2626", stroke: "#b91c1c" },
}

function Plate({
  id, top, left, right, active, onHover,
}: {
  id: LayerId; top: string; left: string; right: string; active: boolean; onHover: (i: LayerId | null) => void
}) {
  const f = FILL[id] ?? FILL.host
  return (
    <g
      opacity={active ? 1 : 0.92}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onHover(id)}
      style={{ cursor: "pointer" }}
    >
      <path d={left} fill={f.side} stroke={f.stroke} strokeWidth={active ? 2 : 1} />
      <path d={right} fill={f.stroke} stroke={f.stroke} strokeWidth={active ? 2 : 1} />
      <path d={top} fill={f.top} stroke={f.stroke} strokeWidth={active ? 2.5 : 1} />
    </g>
  )
}

export function SandboxCutaway() {
  const [hover, setHover] = useState<LayerId | null>(null)
  const active = hover

  return (
    <div className="my-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-2 text-sm font-medium">
        The box, exploded — an illustration of the mount table and the one network hole
      </div>
      <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
        <svg viewBox="140 120 360 300" className="w-full" role="img" aria-label="Isometric exploded view of the Linux sandbox: a read-only host root plate at the bottom, a writable project plate above it, red deny caps on top, and a pipe leaving through a single proxy socket to a proxy node outside the box.">
          {/* host */}
          <Plate id="host"
            top="M300,244 L429.9,319 L300,394 L170.1,319 Z"
            left="M170.1,319 L300,394 L300,400 L170.1,325 Z"
            right="M429.9,319 L300,394 L300,400 L429.9,325 Z"
            active={active === "host"} onHover={setHover} />
          {/* project */}
          <Plate id="project"
            top="M300,204 L403.9,264 L300,324 L196.1,264 Z"
            left="M196.1,264 L300,324 L300,330 L196.1,270 Z"
            right="M403.9,264 L300,324 L300,330 L403.9,270 Z"
            active={active === "project"} onHover={setHover} />
          {/* deny plate + cubes */}
          <Plate id="deny"
            top="M300,149 L403.9,209 L300,269 L196.1,209 Z"
            left="M196.1,209 L300,269 L300,275 L196.1,215 Z"
            right="M403.9,209 L300,269 L300,275 L403.9,215 Z"
            active={active === "deny"} onHover={setHover} />
          {([
            ["M300,152 L312.1,159 L300,166 L287.9,159 Z", "M287.9,159 L300,166 L300,178 L287.9,171 Z", "M312.1,159 L300,166 L300,178 L312.1,171 Z"],
            ["M347.6,189.5 L359.8,196.5 L347.6,203.5 L335.5,196.5 Z", "M335.5,196.5 L347.6,203.5 L347.6,215.5 L335.5,208.5 Z", "M359.8,196.5 L347.6,203.5 L347.6,215.5 L359.8,208.5 Z"],
            ["M252.4,189.5 L264.5,196.5 L252.4,203.5 L240.2,196.5 Z", "M240.2,196.5 L252.4,203.5 L252.4,215.5 L240.2,208.5 Z", "M264.5,196.5 L252.4,203.5 L252.4,215.5 L264.5,208.5 Z"],
          ] as const).map((c, i) => (
            <g key={i} opacity={active && active !== "deny" ? 0.5 : 1}>
              <path d={c[1]} fill="#b91c1c" />
              <path d={c[2]} fill="#991b1b" />
              <path d={c[0]} fill="#f87171" stroke="#7f1d1d" strokeWidth="0.75" />
            </g>
          ))}
          {/* proxy pipe: from a socket plug on the project plate out to a proxy node */}
          <g
            opacity={active && active !== "net" ? 0.5 : 1}
            onMouseEnter={() => setHover("net")}
            onMouseLeave={() => setHover(null)}
            onClick={() => setHover("net")}
            style={{ cursor: "pointer" }}
          >
            <line x1="352" y1="294" x2="450" y2="342" stroke="#0ea5e9" strokeWidth={active === "net" ? 5 : 3} strokeLinecap="round" />
            <ellipse cx="352" cy="294" rx="6" ry="3.5" fill="#0ea5e9" />
            <rect x="450" y="326" width="40" height="32" rx="3" fill="#0ea5e9" opacity="0.18" stroke="#0ea5e9" strokeWidth="1.5" />
            <text x="470" y="345" textAnchor="middle" className="fill-sky-600 dark:fill-sky-400" fontSize="9" fontWeight="600">proxy</text>
          </g>
          {/* lo-only badge */}
          <text x="300" y="138" textAnchor="middle" className="fill-muted-foreground" fontSize="9">net ns: lo only, 0 bytes</text>
        </svg>

        <div className="border-t border-border p-4 lg:border-l lg:border-t-0">
          <ul className="space-y-1.5">
            {LAYERS.map((l) => (
              <li key={l.id}>
                <button type="button"
                  onMouseEnter={() => setHover(l.id)} onMouseLeave={() => setHover(null)} onClick={() => setHover(l.id)}
                  className={cn("w-full rounded px-2 py-1 text-left text-[13px] transition-colors", active === l.id ? "bg-muted font-medium" : "hover:bg-muted/60")}>
                  <span className="inline-block h-2 w-2 rounded-sm align-middle" style={{ background: l.id === "net" ? "#0ea5e9" : FILL[l.id]?.top }} />{" "}
                  {l.label}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 min-h-[4.5rem] text-[13px] leading-relaxed text-muted-foreground">
            {active ? LAYERS.find((l) => l.id === active)?.note : "Hover a layer. The stack is a cross-section of the mount table bwrap builds; the blue pipe is the proxy socket, the one route out of the network namespace."}
          </p>
        </div>
      </div>
    </div>
  )
}
