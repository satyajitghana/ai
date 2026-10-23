"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Two sites that put NFS Most Wanted (2005) in a browser in the same fortnight
// of October 2026, compared layer by layer from public material only, on
// 23 Oct 2026. nfsmwonline.com is read from outside its log-in wall;
// web.nfsmwo.com publishes its launch config, build manifest and file listings
// to any visitor. Every cell carries its own label; `why` says where it came
// from.

type Label = "measured" | "reported" | "reasoned"
type Side = { text: string; label: Label }

type Layer = {
  id: string
  name: string
  online: Side
  mwo: Side
  why: string
}

const LAYERS: Layer[] = [
  {
    id: "runs",
    name: "What runs",
    online: { text: "unknown; changelog reads like editable code", label: "reasoned" },
    mwo: { text: "the shipped speed.exe, under Wine", label: "measured" },
    why: "web.nfsmwo.com's launch config passes D:\\speed.exe as the program and sets WINESYSTEMROOT and WINEDLLOVERRIDES; mw_web.js imports Wine's __wine_unix_call tables; the wine listing names 48 DLLs from Wine's i386-windows folder, its 32-bit x86 builds. NFSMW Online's engine is behind its login, and its notes keep restoring 'like the original game' behaviour, which running the binary would not need.",
  },
  {
    id: "gpu",
    name: "Graphics API",
    online: { text: "WebGPU, Chrome and Edge", label: "measured" },
    mwo: { text: "WebGL 2; Chrome, Edge, Firefox, Safari", label: "measured" },
    why: "The NFSMW Online log-in page refuses to go on without navigator.gpu. mw_web.js creates a webgl2 context through Emscripten's GL layer and has no WebGPU calls; its FAQ lists Firefox and Safari, on phones as well.",
  },
  {
    id: "code",
    name: "Engine code",
    online: { text: "not visible", label: "measured" },
    mwo: { text: "95,956,980-byte wasm, shipped encrypted", label: "measured" },
    why: "The build manifest names mw_web.wasm at 95,956,980 bytes, split into 23 parts (10,617,881 bytes on the wire) under a partCipher of pms-part-1, plus 3,028 pre-built code shards. Part one has no wasm header. I did not decrypt anything.",
  },
  {
    id: "files",
    name: "Game files",
    online: { text: "an R2 bucket, behind the login", label: "measured" },
    mwo: { text: "1,783 files, 4,476,030,245 bytes, listed publicly", label: "measured" },
    why: "NFSMW Online's file host answers with a Cloudflare R2 404 for unknown paths; I did not guess names. web.nfsmwo.com fetches a listing of the game folder that names every file, its size and a content-addressed URL on pmscdn.playnfs.com.",
  },
  {
    id: "account",
    name: "Account to play",
    online: { text: "yes, for everything", label: "measured" },
    mwo: { text: "only for online play", label: "reported" },
    why: "nfsmwonline.com redirects the root to /login. web.nfsmwo.com's FAQ says 'Single player needs no account', and its start page shows Single Player beside Sign in to MWO. I did not press either.",
  },
  {
    id: "host",
    name: "Hosting",
    online: { text: "nginx on IONOS, files on R2", label: "measured" },
    mwo: { text: "Cloudflare, game on pmscdn.playnfs.com", label: "measured" },
    why: "From response headers, DNS and RDAP. playnfs.com was registered on 10 October 2026 and redirects to web.nfsmwo.com; both domains use the same pair of Cloudflare name servers.",
  },
  {
    id: "age",
    name: "Age",
    online: { text: "about 16 days", label: "reasoned" },
    mwo: { text: "mod since 2017; browser build since mid-October", label: "reasoned" },
    why: "NFSMW Online: first certificate, Discord and logo all on 7 October 2026. MWO: footer '2017-∞', Discord created September 2020, nfsmwo.com registered December 2024; its browser CDN domain registered 10 October 2026 and certified 14 October.",
  },
  {
    id: "link",
    name: "Shared code or people",
    online: { text: "none found", label: "measured" },
    mwo: { text: "none found", label: "measured" },
    why: "Neither site names the other in anything I fetched, and their stacks differ at every layer above. Absence of a link in public files is weak evidence; it does not rule out a relationship.",
  },
]

const TONE: Record<Label, string> = {
  measured: "text-[oklch(0.62_0.13_150)]",
  reported: "text-[oklch(0.65_0.13_250)]",
  reasoned: "text-[oklch(0.66_0.14_60)]",
}

function Cell({ side }: { side: Side }) {
  return (
    <span className="leading-snug">
      {side.text}{" "}
      <span className={cn("font-mono text-[10px] uppercase tracking-wide", TONE[side.label])}>{side.label}</span>
    </span>
  )
}

export function TwoRevivals() {
  const [sel, setSel] = useState<string>("runs")
  const layer = LAYERS.find((l) => l.id === sel) ?? LAYERS[0]

  return (
    <figure className="@container my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>two browser revivals · public material, 23 Oct 2026</span>
        <span className="hidden @min-[560px]:inline">pick a layer for the evidence</span>
      </div>

      <div className="overflow-x-auto px-2 pt-3">
        <table className="w-full min-w-[520px] border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th className="w-[22%] text-left font-mono font-normal text-muted-foreground">layer</th>
              <th className="text-left text-sm font-semibold">nfsmwonline.com</th>
              <th className="text-left text-sm font-semibold">web.nfsmwo.com</th>
            </tr>
          </thead>
          <tbody>
            {LAYERS.map((l) => (
              <tr
                key={l.id}
                onClick={() => setSel(l.id)}
                className={cn("cursor-pointer align-top", sel === l.id && "bg-muted")}
              >
                <td className="rounded-l-md px-1.5 py-1">
                  <button type="button" onClick={() => setSel(l.id)} className="cursor-pointer text-left font-medium">
                    {l.name}
                  </button>
                </td>
                <td className="px-1.5 py-1">
                  <Cell side={l.online} />
                </td>
                <td className="rounded-r-md px-1.5 py-1">
                  <Cell side={l.mwo} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <figcaption className="border-t px-4 py-3 text-sm leading-relaxed" aria-live="polite">
        <div className="font-mono text-xs text-muted-foreground">{layer.name}</div>
        <p className="mt-1">{layer.why}</p>
      </figcaption>
    </figure>
  )
}
