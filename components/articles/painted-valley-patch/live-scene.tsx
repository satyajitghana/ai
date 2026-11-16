"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { mediaUrl } from "@/lib/media"

// A live copy of someone else's scene, behind a click. Until the button is
// pressed this is a poster and nothing else: no iframe, no script from the
// scene, no GPU work. The click mounts a sandboxed iframe (scripts and pointer
// lock only: no same-origin, no popups, no forms), so the scene cannot read
// this page, its storage or its cookies. WebGPU is checked first, because a
// browser without it would only show the scene's own error box.

type Props = {
  /** Same-origin path to the scene's HTML, served from public/ (not media). */
  src: string
  /** Poster image path under public/ (media, so it goes through mediaUrl). */
  poster: string
  title: string
  /** Where the scene comes from, shown under the frame. */
  source: string
  sourceHref: string
  licence: string
}

export function LiveScene({ src, poster, title, source, sourceHref, licence }: Props) {
  const [state, setState] = useState<"poster" | "live" | "nogpu">("poster")
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)

  const start = useCallback(() => {
    const hasGpu = typeof navigator !== "undefined" && "gpu" in navigator
    setState(hasGpu ? "live" : "nogpu")
  }, [])

  useEffect(() => {
    if (state === "live") frame.current?.focus()
  }, [state])

  const fullscreen = useCallback(() => {
    const el = box.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen?.().then(() => frame.current?.focus()).catch(() => {})
  }, [])

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>{title}</span>
        <span className="text-muted-foreground/50">live, WebGPU</span>
      </div>
      <div className="p-3 sm:p-4">
        <div ref={box} className="relative aspect-video w-full overflow-hidden rounded-md border bg-black">
          {state === "live" ? (
            <>
              <iframe
                ref={frame}
                src={src}
                title={title}
                sandbox="allow-scripts allow-pointer-lock"
                className="absolute inset-0 h-full w-full border-0"
              />
              <button
                type="button"
                onClick={fullscreen}
                aria-label="Full screen"
                title="Full screen"
                className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-md bg-black/55 text-white backdrop-blur hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
                </svg>
              </button>
            </>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl(poster)}
                alt={`A still of ${title}: a stone whale tail standing among tall kelp, a school of small fish and a manta ray in blue-green water, coral in the foreground.`}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 grid place-items-center bg-black/25">
                {state === "poster" ? (
                  <button
                    type="button"
                    onClick={start}
                    className="rounded-full bg-white/90 px-5 py-2.5 text-sm font-semibold text-black shadow-lg hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Swim in it
                  </button>
                ) : (
                  <p className="mx-4 max-w-md rounded-md bg-black/75 px-4 py-3 text-center text-sm text-white">
                    This browser has no WebGPU, which the scene needs. It runs in desktop Chrome or Edge; the clips above show it moving.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Nothing loads until you press the button; then the page fetches one 99,514-byte HTML file and builds the
          world on your GPU, which takes a few seconds. Press <b>Dive in</b>, then click the scene to steer with the
          mouse. <b>W A S D</b> swim, <b>E</b> and <b>Q</b> go up and down, <b>Shift</b> is faster, <b>1</b> to{" "}
          <b>6</b> jump between viewpoints, <b>H</b> shows the frame rate, <b>M</b> mutes. Sound starts when you dive
          in. <b>Esc</b> gives the mouse back. The menu&apos;s own links do nothing in this frame; the source is{" "}
          <a href={sourceHref} className="underline underline-offset-2">
            {source}
          </a>
          , {licence}.
        </p>
      </div>
    </figure>
  )
}
