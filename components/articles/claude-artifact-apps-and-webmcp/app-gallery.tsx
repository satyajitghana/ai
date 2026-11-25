"use client"

import { useCallback, useEffect, useState } from "react"

import { mediaUrl } from "@/lib/media"

import { APPS, POSTS, appSrc } from "./apps"

// All 61 screenshots @nopsnek posted of Claude artifacts installed as desktop
// apps. The grid loads 480 px thumbnails lazily; the lightbox loads the
// 1200 px copy of one shot at a time.

const POST_LABEL = { p1: "apps 1-20", p2: "apps 21-40", p3: "apps 41-60", p4: "app 61" } as const

export function AppGallery() {
  const [open, setOpen] = useState<number | null>(null)

  const step = useCallback((d: number) => {
    setOpen((o) => (o == null ? o : ((o - 1 + d + APPS.length) % APPS.length) + 1))
  }, [])

  useEffect(() => {
    if (open == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null)
      else if (e.key === "ArrowRight") step(1)
      else if (e.key === "ArrowLeft") step(-1)
    }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, step])

  const app = open == null ? null : APPS[open - 1]

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3">
        <span className="font-medium">All 61 demo apps, as @nopsnek posted them</span>
        <span className="block text-muted-foreground">
          Screenshots by{" "}
          <a className="underline" href={POSTS.p1} target="_blank" rel="noreferrer">
            @nopsnek
          </a>{" "}
          on X, in four posts (
          {(Object.keys(POSTS) as (keyof typeof POSTS)[]).map((k, i) => (
            <span key={k}>
              {i > 0 ? ", " : ""}
              <a className="underline" href={POSTS[k]} target="_blank" rel="noreferrer">
                {POST_LABEL[k]}
              </a>
            </span>
          ))}
          ). The posts name no app; the captions describe what each screenshot shows. Click one to enlarge it.
        </span>
      </figcaption>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {APPS.map((a) => (
          <li key={a.n}>
            <button
              type="button"
              onClick={() => setOpen(a.n)}
              className="group block w-full overflow-hidden rounded-md border border-border bg-background text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`App ${a.n}: ${a.title}. Enlarge`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl(appSrc(a.n, "sm"))}
                alt={`App ${a.n}, ${a.title}: ${a.what}`}
                loading="lazy"
                decoding="async"
                width={480}
                height={270}
                className="aspect-video w-full object-cover object-top transition-opacity group-hover:opacity-90"
              />
              <span className="block px-2 py-1.5 leading-tight">
                <span className="font-mono text-[11px] text-muted-foreground">{a.n}</span>{" "}
                <span className="text-[12px]">{a.title}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {app && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`App ${app.n}: ${app.title}`}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-3 sm:p-6"
          onClick={() => setOpen(null)}
        >
          <div className="flex w-full max-w-6xl flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={app.n}
              src={mediaUrl(appSrc(app.n, "full"))}
              alt={`App ${app.n}, ${app.title}: ${app.what}`}
              className="max-h-[78vh] w-full rounded-md object-contain"
            />
            <div className="flex flex-wrap items-start justify-between gap-3 text-white">
              <p className="max-w-3xl text-sm leading-snug">
                <span className="font-mono text-white/70">App {app.n} of 61.</span>{" "}
                <span className="font-medium">{app.title}.</span> {app.what}{" "}
                <a className="text-white/70 underline" href={POSTS[app.post]} target="_blank" rel="noreferrer">
                  @nopsnek, {POST_LABEL[app.post]}
                </a>
              </p>
              <div className="flex gap-2 font-mono text-xs">
                <button type="button" onClick={() => step(-1)} className="rounded border border-white/40 px-3 py-1.5">
                  ← prev
                </button>
                <button type="button" onClick={() => step(1)} className="rounded border border-white/40 px-3 py-1.5">
                  next →
                </button>
                <button type="button" onClick={() => setOpen(null)} className="rounded border border-white/40 px-3 py-1.5">
                  close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </figure>
  )
}
