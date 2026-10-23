"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What a logged-out visitor's browser actually fetches from nfsmwonline.com,
// recorded with headless Chromium on 23 Oct 2026 (three runs per viewport; the
// rows below are one desktop run, 1280x860, times are when each response
// finished, counted from the first request). Above the wall: every request the
// page made. Below it: the parts of the game the page never served, each with
// how I know it exists (the update notes, the page's own script, DNS) and what
// a logged-out probe of it returned.

type Seen = {
  path: string
  kind: "redirect" | "html" | "image"
  status: number
  bytes: number
  ms: number
  detail: string
}

type Unseen = {
  name: string
  probe: string
  label: "measured" | "reported" | "reasoned"
  detail: string
}

const FIRST: Seen[] = [
  {
    path: "/",
    kind: "redirect",
    status: 303,
    bytes: 0,
    ms: 131,
    detail: "The root answers 303 See Other to /login with Cache-Control: no-store. nginx 1.24.0 on Ubuntu, on an address in an IONOS range.",
  },
  {
    path: "/login",
    kind: "html",
    status: 200,
    bytes: 31228,
    ms: 262,
    detail:
      "The whole public site: a log-in form, the update notes and one inline script of 48 lines. The script switches the form between log-in and sign-up and checks navigator.gpu. Served uncompressed even when the browser asks for gzip.",
  },
  {
    path: "/nfs-update/notes/2026-10-22_2112/1.jpg",
    kind: "image",
    status: 200,
    bytes: 117349,
    ms: 381,
    detail: "The first screenshot of the newest update post, lazy-loaded because its post is open. Served by nginx straight from a static folder whose index is forbidden (403).",
  },
  {
    path: "/logo.png?v=2",
    kind: "image",
    status: 200,
    bytes: 214240,
    ms: 431,
    detail: "The largest file a logged-out visitor gets. Last-Modified 7 Oct 2026, the same day the TLS certificate and the Discord server were created.",
  },
  {
    path: "/nfs-update/notes/2026-10-22_2112/2.jpg",
    kind: "image",
    status: 200,
    bytes: 119887,
    ms: 470,
    detail: "The second screenshot of the newest post. The order of the three images changed between runs; the set did not.",
  },
]

const UNSEEN: Unseen[] = [
  {
    name: "engine code",
    probe: "/play, /game, /app, /sw.js, /manifest.json: 401 or 303 to /login",
    label: "measured",
    detail:
      "No JavaScript file, no .wasm module and no service worker is served to a logged-out visitor. Every path I tried outside /login, the icons and /nfs-update/ answers 401 with the body 'log in first', robots.txt included.",
  },
  {
    name: "renderer",
    probe: "inline script: if (!navigator.gpu) …",
    label: "measured",
    detail:
      "The log-in page refuses a browser with no WebGPU: 'This browser has no WebGPU - open the game in Chrome or Edge.' The notes add that a browser with an older graphics mode is offered that instead, which I could not see.",
  },
  {
    name: "game files",
    probe: "files.nfsmwonline.com: Cloudflare, R2 bucket 404 page",
    label: "measured",
    detail:
      "The 'fast download network' of the 22 Oct notes is a Cloudflare R2 bucket on a subdomain. A guessed path returns R2's own 'Object not found' page. I did not guess further: the files in it are the game's.",
  },
  {
    name: "file cache",
    probe: "notes, 21 Oct: 'a game file cut short in the browser's cache'",
    label: "reported",
    detail:
      "The client keeps game files between visits (lite mode downloads 'almost nothing the next time'). Whether that is the Cache API, IndexedDB or the Origin Private File System I could not see.",
  },
  {
    name: "careers and saves",
    probe: "login page: 'Each account has its own career and saves'",
    label: "reported",
    detail:
      "Saves live with the account, on the server. An anti-cheat flagged players who skipped the prologue, which means the server checks career progress, not just stores it.",
  },
  {
    name: "online sessions",
    probe: "/ws, /api: 401",
    label: "reasoned",
    detail:
      "Free Roam, races with host hand-over, Head to Head duels, chat, voice (there is a Mute Player) and horns other players hear. The transport (WebSocket, WebRTC, WebTransport) is behind the wall.",
  },
]

const ALL_NOTES = { count: 23, bytes: 3358664 }

const fmt = (n: number) => n.toLocaleString("en-US")
const kb = (n: number) => (n === 0 ? "0 B" : `${(n / 1000).toFixed(1)} kB`)

const KIND_COLOR: Record<Seen["kind"], string> = {
  redirect: "oklch(0.62 0.02 260)",
  html: "oklch(0.64 0.15 300)",
  image: "oklch(0.70 0.14 65)",
}

export function LoginWall() {
  const [sel, setSel] = useState<string>("/login")
  const [all, setAll] = useState(false)
  const max = 214240
  const firstBytes = FIRST.reduce((s, r) => s + r.bytes, 0)
  const total = all ? firstBytes - 117349 - 119887 + ALL_NOTES.bytes : firstBytes
  const reqs = all ? FIRST.length - 2 + ALL_NOTES.count : FIRST.length

  const seen = FIRST.find((r) => r.path === sel)
  const unseen = UNSEEN.find((u) => u.name === sel)

  return (
    <figure className="@container my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>nfsmwonline.com, logged out · Chromium · 23 Oct 2026</span>
        <span>
          {reqs} requests · {fmt(total)} bytes
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pt-3" role="group" aria-label="Scope">
        {[
          { k: false, t: "first view" },
          { k: true, t: "every update post opened" },
        ].map((o) => (
          <button
            key={o.t}
            type="button"
            aria-pressed={all === o.k}
            onClick={() => setAll(o.k)}
            className={cn(
              "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
              all === o.k ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.t}
          </button>
        ))}
      </div>

      <ul className="space-y-1 px-4 pt-3" aria-label="Requests a logged-out visitor makes">
        {FIRST.map((r) => {
          const collapsed = all && r.kind === "image" && r.path.startsWith("/nfs-update")
          if (collapsed) return null
          return (
            <li key={r.path}>
              <button
                type="button"
                onClick={() => setSel(r.path)}
                aria-pressed={sel === r.path}
                className={cn(
                  "grid w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-md px-2 py-1.5 text-left transition-colors @min-[560px]:grid-cols-[minmax(0,15rem)_1fr_auto]",
                  sel === r.path ? "bg-muted" : "hover:bg-muted/50",
                )}
              >
                <span className="truncate font-mono text-xs" title={r.path}>
                  <span className="text-muted-foreground">{r.status}</span> {r.path}
                </span>
                <span className="order-3 col-span-2 h-2.5 rounded-sm bg-muted @min-[560px]:order-none @min-[560px]:col-span-1">
                  <span
                    className="block h-full rounded-sm"
                    style={{ width: `${Math.max(1, (r.bytes / max) * 100).toFixed(1)}%`, background: KIND_COLOR[r.kind] }}
                  />
                </span>
                <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {kb(r.bytes)} · {r.ms} ms
                </span>
              </button>
            </li>
          )
        })}
        {all && (
          <li className="rounded-md px-2 py-1.5 font-mono text-xs text-muted-foreground">
            + {ALL_NOTES.count} update-note screenshots, 1280x720 JPEG (one is 1280x173), {fmt(ALL_NOTES.bytes)} bytes, loaded lazily as
            posts are opened and scrolled
          </li>
        )}
      </ul>

      <div className="mx-4 mt-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 border-t border-dashed border-foreground/40" />
        login wall · nothing below was served
        <span className="h-px flex-1 border-t border-dashed border-foreground/40" />
      </div>

      <ul className="grid gap-1.5 px-4 pt-3 pb-3 @min-[560px]:grid-cols-2" aria-label="Parts of the game behind the login">
        {UNSEEN.map((u) => (
          <li key={u.name}>
            <button
              type="button"
              onClick={() => setSel(u.name)}
              aria-pressed={sel === u.name}
              className={cn(
                "w-full cursor-pointer rounded-md border border-dashed px-2.5 py-1.5 text-left transition-colors",
                sel === u.name ? "border-foreground bg-muted" : "hover:bg-muted/50",
              )}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{u.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{u.label}</span>
              </span>
              <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground" title={u.probe}>
                {u.probe}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <figcaption className="border-t px-4 py-3 text-sm leading-relaxed" aria-live="polite">
        {seen && (
          <>
            <div className="font-mono text-xs text-muted-foreground">
              {seen.status} · {seen.kind} · {fmt(seen.bytes)} bytes · done at {seen.ms} ms
            </div>
            <p className="mt-1">{seen.detail}</p>
          </>
        )}
        {unseen && (
          <>
            <div className="font-mono text-xs text-muted-foreground">
              {unseen.label} · {unseen.probe}
            </div>
            <p className="mt-1">{unseen.detail}</p>
          </>
        )}
      </figcaption>
    </figure>
  )
}
