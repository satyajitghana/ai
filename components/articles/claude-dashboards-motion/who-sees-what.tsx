"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What a shared Dashboard or Motion artifact shows to each kind of viewer, read off
// the help centre's "Share artifacts", "What are artifacts" and the artifacts admin
// guide (all as published on 8 Oct 2026). The one inference, stated on the page:
// a dashboard's warehouse or CRM link counts as a "connected app", because the
// Dashboards guide sends you to "connecting your apps to Claude" to set it up.
// A Motion animation is assumed to use no connector once it is built; nothing
// documents one.

type Kind = "dashboard" | "motion"
type Viewer = "owner" | "orgWith" | "orgWithout" | "invitee" | "link"
type Out = { tone: "ok" | "partial" | "no"; text: string; src: string }

const VIEWERS: { id: Viewer; label: string }[] = [
  { id: "owner", label: "You, who made it" },
  { id: "orgWith", label: "Colleague with warehouse access" },
  { id: "orgWithout", label: "Colleague without it" },
  { id: "invitee", label: "Someone outside, invited by email" },
  { id: "link", label: "Anyone with the link" },
]

const TABLE: Record<Kind, Record<Viewer, Out>> = {
  dashboard: {
    owner: {
      tone: "ok",
      text: "Sees the charts, each with its SQL and the time its data was last refreshed. The queries run on your own connection.",
      src: "Get started with Claude Dashboards",
    },
    orgWith: {
      tone: "ok",
      text: "Sees the same charts, but the queries run on their connection, not yours. If their warehouse role sees different rows, the numbers can differ from what you saw.",
      src: "Share artifacts: \"Viewers use their own access\"",
    },
    orgWithout: {
      tone: "partial",
      text: "Opens the dashboard, but any part fed by a source they cannot reach \"shows an error instead of your data\".",
      src: "Share artifacts",
    },
    invitee: {
      tone: "partial",
      text: "Can open it if the owner allows outside invitations, but \"parts of the artifact that use Claude or your connectors don't work for them\". For a dashboard that is the charts.",
      src: "Share artifacts: invitees",
    },
    link: {
      tone: "no",
      text: "Not offered. \"Artifacts that connect to your apps or use Claude can't use 'Anyone with the link.'\" The announcement's line about sharing dashboards by link runs into this.",
      src: "Share artifacts; admin guide",
    },
  },
  motion: {
    owner: {
      tone: "ok",
      text: "Plays it, edits it in the editor or by asking Claude, exports MP4.",
      src: "Get started with Claude Motion",
    },
    orgWith: {
      tone: "ok",
      text: "Plays it once shared. With Commenter access they can comment and download the files the artifact offers; with Can edit, change it.",
      src: "Share artifacts: access levels",
    },
    orgWithout: {
      tone: "ok",
      text: "Same as any colleague. A finished animation holds its numbers as code and needs no warehouse to play.",
      src: "Help centre; my reading",
    },
    invitee: {
      tone: "partial",
      text: "Can view, and comment with Commenter access, but cannot mention people or ask Claude in a comment. Needs a Claude account.",
      src: "Share artifacts: invitees",
    },
    link: {
      tone: "partial",
      text: "Only if an owner has turned on External sharing, or allowed this one artifact. Viewers still need to be signed in to Claude.",
      src: "Admin guide; Share artifacts",
    },
  },
}

const TONE = {
  ok: "border-emerald-500/40 bg-emerald-500/5",
  partial: "border-amber-500/40 bg-amber-500/5",
  no: "border-rose-500/40 bg-rose-500/5",
}
const TONE_WORD = { ok: "works", partial: "partly", no: "blocked" }

export function WhoSeesWhat() {
  const [kind, setKind] = useState<Kind>("dashboard")
  const [viewer, setViewer] = useState<Viewer>("orgWith")
  const out = TABLE[kind][viewer]

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
      active
        ? "border-foreground/30 bg-muted/50 text-foreground"
        : "border-border text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Who sees what when you share</span>
        <span className="font-mono text-[10px] text-muted-foreground">Team or Enterprise plan, from the help centre</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(["dashboard", "motion"] as Kind[]).map((k) => (
            <button key={k} type="button" className={chip(kind === k)} aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k === "dashboard" ? "a dashboard on Snowflake" : "a Motion animation"}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-1.5 sm:grid-cols-5">
          {VIEWERS.map((v) => {
            const t = TABLE[kind][v.id].tone
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setViewer(v.id)}
                aria-pressed={viewer === v.id}
                className={cn(
                  "cursor-pointer rounded-lg border px-2 py-2 text-left text-xs leading-snug transition-colors",
                  TONE[t],
                  viewer === v.id ? "ring-2 ring-foreground/30" : "opacity-80 hover:opacity-100",
                )}
              >
                <span className="block">{v.label}</span>
                <span className="mt-1 block font-mono text-[10px] text-muted-foreground">{TONE_WORD[t]}</span>
              </button>
            )
          })}
        </div>

        <div className={cn("mt-3 rounded-lg border px-3 py-2.5 text-sm", TONE[out.tone])}>
          <p>{out.text}</p>
          <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">source: {out.src}</p>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Everyone needs a Claude account to open a shared artifact. Treating the warehouse link as a
        &quot;connected app&quot; is my reading: the Dashboards guide sets it up through the connectors page.
      </figcaption>
    </figure>
  )
}
