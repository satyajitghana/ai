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
//
// Later on 23 Oct, with one account made for the purpose, the same page was
// loaded logged in (the third scope below). Those rows are the requests the
// game page made, bytes on the wire, with the game-data transfer I stopped at
// its headers marked as aborted; each box below the wall then says what the
// logged-in load showed about it.

type Seen = {
  path: string
  kind: "redirect" | "html" | "image"
  status: number
  bytes: number
  ms: number
  detail: string
}

type Label = "measured" | "reported" | "reasoned"

type Unseen = {
  name: string
  probe: string
  label: Label
  detail: string
  inside: { probe: string; label: Label; detail: string }
}

type Inside = {
  path: string
  kind: "html" | "script" | "wasm" | "text" | "data"
  status: number
  wire: number
  decoded?: number
  aborted?: boolean
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
    inside: {
      probe: "pkg/nfs_bg.wasm: Rust, wasm-bindgen, wgpu 0.19.4",
      label: "measured",
      detail:
        "13,687,532 bytes of wasm32 with one memory, not shared, and 10,413 functions whose Rust names are kept: 2,718 of them in the game's own crate, nfs, with modules such as police, mwai, career and traffic. No x86 address and nothing of speed.exe: a new engine, not a recompilation.",
    },
  },
  {
    name: "renderer",
    probe: "inline script: if (!navigator.gpu) …",
    label: "measured",
    detail:
      "The log-in page refuses a browser with no WebGPU: 'This browser has no WebGPU - open the game in Chrome or Edge.' The notes add that a browser with an older graphics mode is offered that instead, which I could not see.",
    inside: {
      probe: "wgpu on WebGPU; fallback: WebGPU compatibility mode",
      label: "measured",
      detail:
        "The engine draws through wgpu, which in a browser is WebGPU, with hand-written WGSL shaders: 34 fragment and 23 vertex entry points. The 'older graphics mode' is WebGPU's compatibility feature level, offered as ?NFS_COMPAT=1. It is not WebGL 2, as I guessed from outside.",
    },
  },
  {
    name: "game files",
    probe: "files.nfsmwonline.com: Cloudflare, R2 bucket 404 page",
    label: "measured",
    detail:
      "The 'fast download network' of the 22 Oct notes is a Cloudflare R2 bucket on a subdomain. A guessed path returns R2's own 'Object not found' page. I did not guess further: the files in it are the game's.",
    inside: {
      probe: "files.nfsmwonline.com/m/<hash>/out/\u2026",
      label: "measured",
      detail:
        "4,008 files, 5,237,314,648 bytes, each on R2 under its content hash, immutable for a year and scrambled (X-NFS-Mix: 1). Big files come in 32 MiB ranges. out/ and lite/ hold the team's own formats converted from the game; game/ holds EA's audio as shipped and the movies as MP4. No speed.exe.",
    },
  },
  {
    name: "file cache",
    probe: "notes, 21 Oct: 'a game file cut short in the browser's cache'",
    label: "reported",
    detail:
      "The client keeps game files between visits (lite mode downloads 'almost nothing the next time'). Whether that is the Cache API, IndexedDB or the Origin Private File System I could not see.",
    inside: {
      probe: "caches.open('nfs-files')",
      label: "measured",
      detail:
        "The Cache API, in a store named nfs-files, with navigator.storage.persist() asked for once the game has started. No Origin Private File System, no IndexedDB, no service worker.",
    },
  },
  {
    name: "careers and saves",
    probe: "login page: 'Each account has its own career and saves'",
    label: "reported",
    detail:
      "Saves live with the account, on the server. An anti-cheat flagged players who skipped the prologue, which means the server checks career progress, not just stores it.",
    inside: {
      probe: "vfs: GET with Range, PUT, POST, DELETE",
      label: "reasoned",
      detail:
        "The engine's file layer writes as well as reads: options, challenges and the career save go back to the server as files, kept per account. I did not play, so I saw no save being written.",
    },
  },
  {
    name: "online sessions",
    probe: "/ws, /api: 401",
    label: "reasoned",
    detail:
      "Free Roam, races with host hand-over, Head to Head duels, chat, voice (there is a Mute Player) and horns other players hear. The transport (WebSocket, WebRTC, WebTransport) is behind the wall.",
    inside: {
      probe: "wss://<host>/coop; no WebRTC import",
      label: "measured",
      detail:
        "One WebSocket path, /coop, for co-op, races and duels, with text messages such as 'join id=' and 'hpsetup serial='. Voice is 16 kHz PCM handed to the game, and with no WebRTC in the glue it has the socket to travel on (reasoned). My page never opened the socket: it never got past loading.",
    },
  },
]

const ALL_NOTES = { count: 23, bytes: 3358664 }

const fmt = (n: number) => n.toLocaleString("en-US")
const kb = (n: number) => (n === 0 ? "0 B" : `${(n / 1000).toFixed(1)} kB`)

const KIND_COLOR: Record<Seen["kind"] | Inside["kind"], string> = {
  redirect: "oklch(0.62 0.02 260)",
  html: "oklch(0.64 0.15 300)",
  image: "oklch(0.70 0.14 65)",
  script: "oklch(0.66 0.13 200)",
  wasm: "oklch(0.62 0.16 25)",
  text: "oklch(0.68 0.12 150)",
  data: "oklch(0.62 0.02 260)",
}

// The logged-in load, 23 Oct 2026, headless Chromium at 1280x800: the requests
// the game page made before its first game file, then the first game-file
// range, which I failed at its response headers. `wire` is bytes on the wire,
// `decoded` the size after gzip where the two differ.
const INSIDE: Inside[] = [
  {
    path: "/",
    kind: "html",
    status: 200,
    wire: 123409,
    detail:
      "After sign-up the root is the game page: 1,970 lines, most of them script that wraps WebGPU, sound, touch and crash reports around the game. It sends no Cross-Origin-Opener-Policy or Embedder-Policy header, so the page is not cross-origin isolated and has no SharedArrayBuffer.",
  },
  {
    path: "/pkg/nfs.js",
    kind: "script",
    status: 200,
    wire: 15514,
    decoded: 101311,
    detail:
      "The wasm-bindgen glue for a Rust crate: the path and file name wasm-pack writes. It hands the module 430 imports, among them WebGPU, Web Audio, a WebSocket constructor, fetch, the Cache API and gamepads. No WebRTC, no WebTransport, no WebGL.",
  },
  {
    path: "/role",
    kind: "text",
    status: 200,
    wire: 6,
    detail: "The account's role: 'player'. The engine also knows NFS_ADMIN and NFS_STAFF.",
  },
  {
    path: "/manifest?cdn=1",
    kind: "text",
    status: 200,
    wire: 256325,
    detail:
      "Every file the game can ask for: 4,008 of them, 5,237,314,648 bytes, each with its size, a timestamp and a 16-hex content hash. Its first line names the file host: #cdn https://files.nfsmwonline.com. Served no-store, only to a logged-in page.",
  },
  {
    path: "/pkg/nfs_bg.wasm",
    kind: "wasm",
    status: 200,
    wire: 4584640,
    decoded: 13687532,
    detail:
      "The engine: 13,687,532 bytes of wasm32 with its Rust function names kept, built by rustc 1.98.1 with wasm-bindgen 0.2.129. From my sandbox it took about five minutes to arrive from the origin.",
  },
  {
    path: "/preload.txt",
    kind: "text",
    status: 200,
    wire: 42409,
    detail: "What the full game loads before its first frame, the 'Loading Rockport' bar: 1,381 files, 1,154,679,097 bytes.",
  },
  {
    path: "files.nfsmwonline.com/m/8bf46937…/out/rockport.ngw",
    kind: "data",
    status: 206,
    wire: 33554432,
    aborted: true,
    detail:
      "The first 32 MiB range of the world, a 469,995,116-byte file in the team's own NGW format. I failed it at its headers: Cloudflare, cache-status DYNAMIC, immutable for a year, Access-Control-Allow-Origin *, X-NFS-Mix: 1. The loader then retried it through the CDN and through the origin's 302 to the same URL, so I stopped the run.",
  },
]

const INSIDE_SIDE =
  "+ /players (498 to 502 online), /whoami, /discord and a /ping every minute; 41 MB of small sounds and sky files from the CDN in the first 60 s, which I let through into a throwaway browser profile"

type Scope = "first" | "all" | "inside"

export function LoginWall() {
  const [sel, setSel] = useState<string>("/login")
  const [scope, setScope] = useState<Scope>("first")
  const all = scope === "all"
  const inside = scope === "inside"
  const firstBytes = FIRST.reduce((s, r) => s + r.bytes, 0)
  const insideBytes = INSIDE.filter((r) => !r.aborted).reduce((s, r) => s + r.wire, 0)
  const total = inside ? insideBytes : all ? firstBytes - 117349 - 119887 + ALL_NOTES.bytes : firstBytes
  const reqs = inside ? INSIDE.length - 1 : all ? FIRST.length - 2 + ALL_NOTES.count : FIRST.length
  const insideMax = Math.max(...INSIDE.filter((r) => !r.aborted).map((r) => r.wire))

  const pick = (k: Scope) => {
    setScope(k)
    if (k === "inside" && !INSIDE.some((r) => r.path === sel) && !UNSEEN.some((u) => u.name === sel)) setSel("/pkg/nfs_bg.wasm")
    if (k !== "inside" && INSIDE.some((r) => r.path === sel)) setSel("/login")
  }

  const seen = inside ? undefined : FIRST.find((r) => r.path === sel)
  const inRow = inside ? INSIDE.find((r) => r.path === sel) : undefined
  const unseen = UNSEEN.find((u) => u.name === sel)
  const box = unseen ? (inside ? unseen.inside : unseen) : undefined

  return (
    <figure className="@container my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>nfsmwonline.com, {inside ? "logged in" : "logged out"} · Chromium · 23 Oct 2026</span>
        <span>
          {reqs} requests · {fmt(total)} bytes{inside ? " before the first game file" : ""}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pt-3" role="group" aria-label="Scope">
        {(
          [
            { k: "first", t: "first view" },
            { k: "all", t: "every update post opened" },
            { k: "inside", t: "logged in" },
          ] as { k: Scope; t: string }[]
        ).map((o) => (
          <button
            key={o.k}
            type="button"
            aria-pressed={scope === o.k}
            onClick={() => pick(o.k)}
            className={cn(
              "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
              scope === o.k ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.t}
          </button>
        ))}
      </div>

      {!inside && (
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
                      style={{ width: `${Math.max(1, (r.bytes / 214240) * 100).toFixed(1)}%`, background: KIND_COLOR[r.kind] }}
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
      )}

      {inside && (
        <ul className="space-y-1 px-4 pt-3" aria-label="Requests the logged-in game page makes">
          {INSIDE.map((r) => (
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
                    className={cn("block h-full rounded-sm", r.aborted && "opacity-30")}
                    style={{
                      width: `${r.aborted ? 100 : Math.max(1, (r.wire / insideMax) * 100).toFixed(1)}%`,
                      background: KIND_COLOR[r.kind],
                    }}
                  />
                </span>
                <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {r.aborted ? `aborted · ${kb(r.wire)} asked` : kb(r.wire)}
                  {r.decoded ? ` (${kb(r.decoded)})` : ""}
                </span>
              </button>
            </li>
          ))}
          <li className="rounded-md px-2 py-1.5 font-mono text-xs text-muted-foreground">{INSIDE_SIDE}</li>
        </ul>
      )}

      <div className="mx-4 mt-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 border-t border-dashed border-foreground/40" />
        {inside ? "login wall · what the logged-in page showed" : "login wall · nothing below was served"}
        <span className="h-px flex-1 border-t border-dashed border-foreground/40" />
      </div>

      <ul className="grid gap-1.5 px-4 pt-3 pb-3 @min-[560px]:grid-cols-2" aria-label="Parts of the game behind the login">
        {UNSEEN.map((u) => {
          const v = inside ? u.inside : u
          return (
            <li key={u.name}>
              <button
                type="button"
                onClick={() => setSel(u.name)}
                aria-pressed={sel === u.name}
                className={cn(
                  "w-full cursor-pointer rounded-md border px-2.5 py-1.5 text-left transition-colors",
                  inside ? "border-solid" : "border-dashed",
                  sel === u.name ? "border-foreground bg-muted" : "hover:bg-muted/50",
                )}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{u.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {inside ? `now seen · ${v.label}` : v.label}
                  </span>
                </span>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground" title={v.probe}>
                  {v.probe}
                </span>
              </button>
            </li>
          )
        })}
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
        {inRow && (
          <>
            <div className="font-mono text-xs text-muted-foreground">
              {inRow.status} · {inRow.kind} · {fmt(inRow.wire)} bytes {inRow.aborted ? "asked for, failed at its headers" : "on the wire"}
              {inRow.decoded ? ` · ${fmt(inRow.decoded)} decoded` : ""}
            </div>
            <p className="mt-1">{inRow.detail}</p>
          </>
        )}
        {box && (
          <>
            <div className="font-mono text-xs text-muted-foreground">
              {inside ? "now seen · " : ""}
              {box.label} · {box.probe}
            </div>
            <p className="mt-1">{box.detail}</p>
          </>
        )}
      </figcaption>
    </figure>
  )
}
