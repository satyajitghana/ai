"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// The Cua Spaces stack as the code draws it (trycua/cua @ cdda707):
//   your agent or app -> cua SDK (embedded in-process, or the `cua daemon`) with the
//   ~/.cua/spaces.json registry -> one of three paths -> cua-spacesd on port 3211 in
//   each computer -> cua-driver linked in-process -> the OS's input and accessibility
//   APIs. Agent runs are detached spacesd processes inside the Space, driving a
//   harness over the Agent Client Protocol.
// The three paths and what the relay can read come from docs/.../relay-security.mdx.
// Integer SVG coordinates only; no Math.* that could differ between server and client.

type PathId = "direct" | "relay" | "mesh"

const PATHS: { id: PathId; label: string; idForm: string; wire: string; relay: string }[] = [
  {
    id: "direct",
    label: "Direct",
    idForm: "direct:<host:port>",
    wire: "gRPC over HTTP/2 to :3211, bearer token. Same LAN or Tailscale. This is the path I ran.",
    relay: "No relay in the path. Nothing to read, nothing to seal.",
  },
  {
    id: "relay",
    label: "Relay (HTTPS)",
    idForm: "relay:<machine-id>",
    wire: "The computer holds one outbound WSS to relay.cua.ai (yamux inside), so it needs no open port. Clients call https://<relay>/m/<machine>/.",
    relay: "TLS ends at the relay. It can read shell output, files, the desktop stream and keystrokes in flight. It strips your token and forwards a signed assertion.",
  },
  {
    id: "mesh",
    label: "Relay (mesh)",
    idForm: "relay:<machine-id>",
    wire: "Default when both ends support it: a WireGuard mesh (boringtun) inside Cua. Direct UDP when the ends can see each other, else through the relay.",
    relay: "The relay coordinates the mesh but holds no session key. It forwards ciphertext only. The browser viewer still uses the HTTPS path.",
  },
]

type NodeId = "agent" | "sdk" | "path" | "spacesd" | "driver" | "os" | "runs"

const INFO: Record<NodeId, { title: string; body: string }> = {
  agent: {
    title: "Your agent or app",
    body: "Claude Code, Codex or a script. It reaches Spaces through the cua MCP server (86 tools in the 0.7.0 contract) or through an SDK in Python, TypeScript, Swift or Rust. All of them are UniFFI bindings over one Rust crate, cua-sdk.",
  },
  sdk: {
    title: "cua SDK and the registry",
    body: "Runs embedded in your process or behind the cua daemon on a Unix socket. Every Space you add lands in ~/.cua/spaces.json; its token goes to a separate spaces-credentials.json, mode 0600.",
  },
  path: {
    title: "The path",
    body: "A Space id says how it is reached: local:<name>, direct:<host:port> or relay:<machine-id>. The calls on top are the same either way.",
  },
  spacesd: {
    title: "cua-spacesd, port 3211",
    body: "One Rust binary inside the guest. 13 gRPC services and 88 RPCs (cua.env.v1), gRPC-Web on the same port, /mcp for the driver tools, /files, /media for H.264 and Opus. Without a token it binds loopback only. It keeps a hash-chained access log.",
  },
  driver: {
    title: "cua-driver, in-process",
    body: "spacesd never injects input itself. It links cua-driver, whose 63 tools (click, type_text, get_window_state, list_windows, ...) are what /mcp and DriverService.CallTool expose.",
  },
  os: {
    title: "The guest OS",
    body: "Linux X11 through XTest and AT-SPI, macOS through Accessibility and ScreenCaptureKit, Windows through UI Automation. What works depends on the guest: on my bare Xvfb, accessibility needed a D-Bus session bus and foreground input needed a window manager.",
  },
  runs: {
    title: "Agent runs",
    body: "agent_start installs a pinned, checksummed harness, then runs it as a detached spacesd process over the Agent Client Protocol with permissions auto-approved. State lives in ~/.cua/agents/<run>/ in the guest, so a run outlives the client.",
  },
}

const SPACE_IDS = ["direct:10.0.0.5:3211", "local:dev", "relay:mac-mini", "relay:aws-1"]

export function SpaceMap() {
  const [path, setPath] = useState<PathId>("direct")
  const [sel, setSel] = useState<NodeId>("spacesd")
  const [n, setN] = useState(1)
  const p = PATHS.find((x) => x.id === path) ?? PATHS[0]

  const box = (id: NodeId, x: number, y: number, w: number, h: number, label: string, sub: string) => (
    <g
      key={id}
      role="button"
      tabIndex={0}
      aria-pressed={sel === id}
      onClick={() => setSel(id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          setSel(id)
        }
      }}
      className="cursor-pointer outline-none"
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        className={cn(
          "stroke-[1.5]",
          sel === id ? "fill-sky-500/15 stroke-sky-600 dark:stroke-sky-400" : "fill-muted/40 stroke-border",
        )}
      />
      <text x={x + 12} y={y + 22} className="fill-foreground font-mono" style={{ fontSize: 13, fontWeight: 600 }}>
        {label}
      </text>
      <text x={x + 12} y={y + 40} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
        {sub}
      </text>
    </g>
  )

  // computers fan out vertically on the right
  const stackTop = 40
  const cardH = 300
  const offs = [0, 8, 16, 24]

  const pathStroke =
    path === "relay"
      ? "stroke-amber-600 dark:stroke-amber-400"
      : path === "mesh"
        ? "stroke-emerald-600 dark:stroke-emerald-400"
        : "stroke-sky-600 dark:stroke-sky-400"

  return (
    <figure className="my-8 rounded-md border">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-xs">
        <span className="font-mono text-muted-foreground">path</span>
        {PATHS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setPath(x.id)}
            aria-pressed={path === x.id}
            className={cn(
              "rounded border px-2 py-1 font-mono",
              path === x.id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {x.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 font-mono text-muted-foreground">
          computers {n}
          <Range min={1} max={4} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-24" aria-label="Number of computers" />
        </label>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 1000 420"
          className="w-full min-w-[680px]"
          role="img"
          aria-label="Your agent calls the cua SDK, which reaches cua-spacesd on port 3211 in each computer, directly, through the relay, or through the encrypted mesh. Inside each computer spacesd hosts the gRPC services, links cua-driver, and runs agent harnesses as detached processes."
        >
          <text x={20} y={26} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
            YOUR MACHINE
          </text>
          {box("agent", 20, 50, 250, 56, "your agent / app", "Claude Code, Codex, a script")}
          {box("sdk", 20, 170, 250, 56, "cua SDK / cua daemon", "~/.cua/spaces.json")}
          <line x1={145} y1={106} x2={145} y2={170} className="stroke-foreground/60" strokeWidth={1.5} markerEnd="url(#sm-arrow)" />
          <text x={152} y={142} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
            MCP or SDK call
          </text>

          {box("path", 300, 170, 200, 56, p.label.toLowerCase(), p.idForm)}
          <line x1={270} y1={198} x2={300} y2={198} className={pathStroke} strokeWidth={2} />

          {[...Array(n)].map((_, i) => {
            const k = n - 1 - i
            const dx = offs[k]
            const dy = offs[k]
            const front = k === 0
            const y0 = stackTop + dy
            return (
              <g key={k} opacity={front ? 1 : 0.55}>
                <rect x={560 + dx} y={y0} width={390} height={cardH} rx={10} className="fill-background stroke-border" strokeWidth={1.5} />
                <text x={576 + dx} y={y0 + 22} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
                  {`SPACE ${SPACE_IDS[k]}`}
                </text>
              </g>
            )
          })}
          <line
            x1={500}
            y1={198}
            x2={575}
            y2={198}
            className={pathStroke}
            strokeWidth={2}
            strokeDasharray={path === "mesh" ? "6 4" : undefined}
            markerEnd="url(#sm-arrow)"
          />
          {path !== "direct" ? (
            <text x={505} y={188} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
              {path === "relay" ? "plaintext at relay" : "ciphertext"}
            </text>
          ) : null}

          {box("spacesd", 575, 76, 360, 70, "cua-spacesd :3211", "13 services · 88 RPCs · /mcp /files /media")}
          {box("runs", 575, 170, 165, 56, "agent runs", "ACP, detached")}
          {box("driver", 760, 170, 175, 56, "cua-driver", "63 tools, in-process")}
          {box("os", 575, 256, 360, 56, "guest OS", "X11 + AT-SPI · AX · UIA")}
          <line x1={690} y1={146} x2={690} y2={170} className="stroke-foreground/60" strokeWidth={1.5} markerEnd="url(#sm-arrow)" />
          <line x1={850} y1={146} x2={850} y2={170} className="stroke-foreground/60" strokeWidth={1.5} markerEnd="url(#sm-arrow)" />
          <line x1={850} y1={226} x2={850} y2={256} className="stroke-foreground/60" strokeWidth={1.5} markerEnd="url(#sm-arrow)" />
          <line x1={740} y1={198} x2={760} y2={198} className="stroke-foreground/40" strokeWidth={1.5} strokeDasharray="3 3" />

          {n > 1 ? (
            <text x={20} y={300} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
              {`fan-out: ${n} computers, ${n} independent connections`}
            </text>
          ) : null}
          <text x={20} y={318} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
            click a box for what it does
          </text>

          <defs>
            <marker id="sm-arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-foreground/70" />
            </marker>
          </defs>
        </svg>
      </div>
      <div className="grid gap-3 border-t px-3 py-3 text-sm sm:grid-cols-2">
        <div>
          <div className="font-mono text-xs text-muted-foreground">{INFO[sel].title}</div>
          <p className="mt-1">{INFO[sel].body}</p>
        </div>
        <div>
          <div className="font-mono text-xs text-muted-foreground">{p.label}: {p.idForm}</div>
          <p className="mt-1">{p.wire}</p>
          <p className="mt-1 text-muted-foreground">{p.relay}</p>
        </div>
      </div>
    </figure>
  )
}
