"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Four rungs, least invasive at the bottom. Each one says what it changes on
// the device, what it gains, what it can break and how it is undone. The
// content is the article's own; the widget only lets you look at one rung at
// a time against the others.

type Rung = {
  name: string
  where: string
  gains: string[]
  risks: string[]
  undo: string
  needs: string
}

const RUNGS: Rung[] = [
  {
    name: "1 · Settings",
    where: "Nothing outside the vendor's own menus",
    gains: [
      "Google TV's Apps only mode hides personalised rows",
      "Ambient mode and screensaver off, ad tracking off, ACR / viewing data off",
      "Private DNS to a blocking resolver on Android 9+",
    ],
    risks: ["Sponsored rows and teasers can stay; Assistant and search go away in Apps only mode"],
    undo: "Flip the same switches back",
    needs: "The remote",
  },
  {
    name: "2 · Launcher swap",
    where: "One new app answers the Home intent",
    gains: ["A home screen with no ad rows", "A launcher of tens to hundreds of KB, often with no network permission"],
    risks: [
      "Google TV builds put their own launcher first; the setup wizard can grab Home",
      "Remote buttons the stock launcher handled (Input, app keys) may go dead",
      "Accessibility-service redirects can be switched off by a reboot or update",
    ],
    undo: "set-home-activity back to the stock component, or uninstall the app",
    needs: "Sideloading, often adb",
  },
  {
    name: "3 · adb debloat",
    where: "Packages disabled for user 0, state kept in /data",
    gains: ["Telemetry, ACR, promo and auto-install services stop running", "RAM and CPU back on 1 to 2 GB sets"],
    risks: [
      "Disabling a core or input package can stop boot or kill HDMI",
      "Network adb left on is a shell for anyone on the Wi-Fi",
      "Some firmware re-enables packages at boot",
    ],
    undo: "pm enable, cmd package install-existing, or a factory reset",
    needs: "Developer options, network or wireless debugging",
  },
  {
    name: "4 · Root or custom ROM",
    where: "The boot chain and the system partition",
    gains: ["Anything: remove system apps, custom kernels, a different OS"],
    risks: [
      "Unlocking wipes the device; most retail TVs cannot be unlocked at all",
      "Widevine can drop from L1 to L3, which caps HD streaming",
      "OTAs stop or fail; warranty; a bad flash can brick",
      "Locked TVs are rooted only through exploits, which vendors patch with anti-rollback",
    ],
    undo: "Re-flash stock and relock, if the vendor ships images; often not at all",
    needs: "An unlockable bootloader (Shield) or an unpatched exploit",
  },
]

export function InvasivenessLadder() {
  const [sel, setSel] = useState(2)
  const r = RUNGS[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>the invasiveness ladder</span>
        <span className="text-muted-foreground/60">start at the bottom · stop where the problem stops</span>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <ol className="flex flex-col-reverse gap-1.5" aria-label="Rungs, least invasive last in reading order">
          {RUNGS.map((x, i) => (
            <li key={x.name}>
              <button
                type="button"
                onClick={() => setSel(i)}
                aria-pressed={sel === i}
                className={cn(
                  "w-full cursor-pointer rounded-md border px-3 py-2 text-left transition-colors",
                  sel === i ? "border-foreground/40 bg-muted/60" : "border-border hover:bg-muted/30",
                )}
                style={{ marginLeft: `${i * 6}%`, width: `${100 - i * 6}%` }}
              >
                <span className="block font-mono text-[12px] text-foreground">{x.name}</span>
                <span className="block text-[11px] text-muted-foreground">{x.where}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="min-w-0 space-y-3 text-[13px]">
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">gains</div>
            <ul className="ml-4 list-disc">
              {r.gains.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-mono text-[10.5px] uppercase tracking-wide" style={{ color: "oklch(0.6 0.19 25)" }}>
              can break
            </div>
            <ul className="ml-4 list-disc">
              {r.risks.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">undo</div>
              <div>{r.undo}</div>
            </div>
            <div>
              <div className="font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">needs</div>
              <div>{r.needs}</div>
            </div>
          </div>
        </div>
      </div>
    </figure>
  )
}
