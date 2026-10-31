"use client"

import { useState } from "react"

import { ACCENT, Frame, GREEN, Pill, STREAM, T, VIOLET } from "./viz"

// The two MCP servers in the post's setup, drawn from what each one's source
// says it does (READ). LichtFeld Studio: src/mcp/mcp_http_server.cpp (POST
// /mcp on 127.0.0.1:45677, Host and Origin checks, a bearer token in the config
// directory that is required only when the listener is exposed to the network)
// and scripts/lichtfeld_mcp_bridge.py (stdio to HTTP). Blender: the community
// blender-mcp add-on (addon.py: a socket listener on localhost:9876 that accepts
// JSON commands, "execute_code" among them) and the Blender Lab server, whose
// page warns it executes model-written code with no guards.

type Node = "client" | "bridge" | "lfs" | "bmcp" | "addon"

const FACTS: Record<Node, { title: string; lines: string[]; tag: string }> = {
  client: {
    title: "The model's client",
    tag: "the post: Opus 5.5 high",
    lines: [
      "Speaks MCP: initialize, tools/list, tools/call. LichtFeld Studio also answers resources/list and resources/read.",
      "Sees tool results as text, or as images when a result carries a PNG (LichtFeld returns render.capture as an MCP image block).",
      "Holds the whole conversation: every returned image stays in context unless the client trims it.",
    ],
  },
  bridge: {
    title: "stdio bridge (optional)",
    tag: "scripts/lichtfeld_mcp_bridge.py",
    lines: [
      "Clients that launch MCP servers as subprocesses speak stdio. The bridge starts LichtFeld Studio on demand (90 s default wait) and relays each message to the HTTP endpoint.",
      "Default endpoint http://127.0.0.1:45677/mcp, protocol version 2024-11-05. Its default log path sits under ~/.codex/log.",
    ],
  },
  lfs: {
    title: "LichtFeld Studio: lichtfeld-mcp",
    tag: "GPL-3.0 · POST /mcp · 127.0.0.1:45677",
    lines: [
      "Loopback only by default (expose_network = false). Every request must carry a JSON content type, a local Host, and no Origin or a local one: a web page in your browser cannot drive it.",
      "The bearer token (64 hex characters, a file in the config directory with owner-only permissions) is checked only when expose_network is on, and not for a local peer with a local Host and no Origin.",
      "130 concrete tool names in 18 groups; the ones this workflow needs are about ten (next figure).",
    ],
  },
  bmcp: {
    title: "Blender MCP server",
    tag: "community: MIT · official: Blender Lab, Blender 5.1+",
    lines: [
      "The community server translates MCP tool calls into JSON commands for an add-on inside Blender. Its README lists nine tools, among them execute_blender_code, look (viewport, camera or multi-angle views) and get_scene_info.",
      "The official Blender Lab server exists too (Blender 5.1 or newer). The post says only 'Blender MCP', so which one the author uses is not stated.",
    ],
  },
  addon: {
    title: "Blender add-on socket",
    tag: "localhost:9876 · JSON commands",
    lines: [
      "A plain TCP socket inside the Blender process. The community add-on's handler table includes get_scene_info, get_viewport_screenshot, execute_code and export_scene.",
      "execute_code is arbitrary Python in your Blender session. The community server's own safe-mode note says its AST check covers the MCP path only: the socket accepts execute_code from any local process, and it 'is not a sandbox around Blender'.",
      "The official server's page: it 'will execute LLM generated code in Blender without any guards', and recommends a virtual machine.",
    ],
  },
}

const BOXES: { id: Node; x: number; y: number; w: number; h: number; label: string; sub: string; color: string }[] = [
  { id: "client", x: 20, y: 90, w: 130, h: 70, label: "Claude", sub: "client + model", color: ACCENT },
  { id: "bridge", x: 190, y: 28, w: 128, h: 46, label: "stdio bridge", sub: "optional", color: VIOLET },
  { id: "lfs", x: 360, y: 28, w: 168, h: 70, label: "LichtFeld Studio", sub: "3DGS: renders, cameras", color: STREAM },
  { id: "bmcp", x: 190, y: 160, w: 128, h: 46, label: "Blender MCP", sub: "server", color: VIOLET },
  { id: "addon", x: 360, y: 150, w: 168, h: 70, label: "Blender", sub: "add-on · bpy", color: GREEN },
]

export function TwoServers() {
  const [sel, setSel] = useState<Node>("lfs")
  const f = FACTS[sel]
  return (
    <Frame
      label="two MCP servers, one model · READ from source"
      right={
        <div className="flex flex-wrap gap-1.5">
          {BOXES.map((b) => (
            <Pill key={b.id} active={sel === b.id} onClick={() => setSel(b.id)}>
              {b.label}
            </Pill>
          ))}
        </div>
      }
      note={
        <>
          Nothing here was run: this machine has no GPU, no Blender and no LichtFeld build. The ports, the checks and the
          warnings are quoted from the repositories and from Blender’s own page. How the author wired the two servers
          together is not published.
        </>
      }
    >
      <svg viewBox="0 0 560 240" role="img" className="h-auto w-full">
        <title>
          The model’s client on the left talks to LichtFeld Studio (through an optional stdio bridge, over HTTP on
          loopback) and to a Blender MCP server, which talks to the Blender add-on over a local socket.
        </title>
        {[
          [150, 125, 190, 51],
          [318, 51, 360, 63],
          [150, 125, 190, 183],
          [318, 183, 360, 185],
        ].map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-border" strokeWidth={1.5} />
        ))}
        <T x={338} y={46} size={8} anchor="middle" opacity={0.6}>
          HTTP
        </T>
        <T x={338} y={178} size={8} anchor="middle" opacity={0.6}>
          socket
        </T>
        {BOXES.map((b) => (
          <g key={b.id} onClick={() => setSel(b.id)} className="cursor-pointer">
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={8}
              fill={b.color}
              fillOpacity={sel === b.id ? 0.22 : 0.08}
              stroke={b.color}
              strokeWidth={sel === b.id ? 2 : 1}
            />
            <T x={b.x + b.w / 2} y={b.y + b.h / 2 - 2} size={11} anchor="middle" opacity={0.95} weight={600}>
              {b.label}
            </T>
            <T x={b.x + b.w / 2} y={b.y + b.h / 2 + 13} size={8.5} anchor="middle" opacity={0.65}>
              {b.sub}
            </T>
          </g>
        ))}
        <T x={20} y={228} size={8.5} opacity={0.55}>
          click a box
        </T>
      </svg>
      <div className="mt-3 rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">{f.title}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{f.tag}</span>
        </div>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          {f.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
    </Frame>
  )
}
