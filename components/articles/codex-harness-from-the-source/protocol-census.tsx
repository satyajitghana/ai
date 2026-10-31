"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import { PROTO_CLIENT, PROTO_CLIENT_METHODS, PROTO_NOTIF, PROTO_NOTIF_METHODS, PROTO_SERVER } from "./data"
import { Chip, Panel, Src } from "./ui"

// The wire API in four macro blocks of app-server-protocol/src/protocol/common.rs: client_request_definitions! (:502),
// server_request_definitions! (:1851), server_notification_definitions! (:2006), client_notification_definitions! (:2156).
// Counts recounted by script: 183 client requests (74 marked experimental), 11 server requests, 87 notifications, 1 client notification.
type Side = "client" | "notif"

export function ProtocolCensus() {
  const [side, setSide] = useState<Side>("client")
  const [fam, setFam] = useState("thread")
  const rows = side === "client" ? PROTO_CLIENT : PROTO_NOTIF
  const methods = useMemo(() => (side === "client" ? PROTO_CLIENT_METHODS : PROTO_NOTIF_METHODS).filter((m) => m.split("/")[0] === fam), [side, fam])
  const max = rows[0][1]
  return (
    <Panel title="The host-facing API: 183 requests, 11 questions back, 87 notifications" sub="what every front end (TUI, IDE, SDK) speaks to the app-server">
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Chip active={side === "client"} onClick={() => { setSide("client"); setFam("thread") }}>client requests (183)</Chip>
        <Chip active={side === "notif"} onClick={() => { setSide("notif"); setFam("thread") }}>server notifications (87)</Chip>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ol className="space-y-0.5">
          {rows.slice(0, 16).map(([f, n]) => (
            <li key={f}>
              <button type="button" onClick={() => setFam(f)} className={cn("flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left text-[12px] hover:bg-muted", fam === f && "bg-muted")}>
                <span className="w-32 shrink-0 font-mono">{f}</span>
                <span className="h-3 rounded-sm bg-sky-500/70" style={{ width: `${(n / max) * 100}%`, maxWidth: "60%", minWidth: 4 }} />
                <span className="tabular-nums text-muted-foreground">{n}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <div className="mb-1 text-sm font-medium"><code className="font-mono">{fam}{"/*"}</code> <span className="text-muted-foreground">({methods.length})</span></div>
          <ul className="max-h-60 space-y-0.5 overflow-y-auto font-mono text-[11.5px] text-muted-foreground">{methods.map((m) => (<li key={m}>{m}</li>))}</ul>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-border p-3">
        <div className="mb-1 text-sm font-medium">The 11 requests that run the other way</div>
        <p className="mb-2 text-xs text-muted-foreground">The harness asks the host. Approvals are an RPC like any other: whichever UI hosts the engine answers them.</p>
        <ul className="grid gap-x-4 gap-y-0.5 font-mono text-[11.5px] text-muted-foreground sm:grid-cols-2">{PROTO_SERVER.map((m) => (<li key={m}>{m}</li>))}</ul>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Of the 183 client requests, 74 are marked <code>#[experimental]</code> and clients opt in at <code>initialize</code> with <code>experimentalApi: true</code>. <Src>app-server-protocol/src/protocol/common.rs:502-2156</Src></p>
    </Panel>
  )
}
