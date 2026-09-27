"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react"
import {
  ClosedCaptioningIcon,
  CornersInIcon,
  CornersOutIcon,
  PauseIcon,
  PlayIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
} from "@phosphor-icons/react/dist/ssr"

import type { Film } from "@/lib/films"
import { cn } from "@/lib/utils"

// The article's explainer film, at the top of the page.
//
// Two ways to watch it, because they want opposite things:
//   ambient   muted and looping, playing only while it is on screen — the
//             painted on-screen text carries the argument without sound
//   sound on  the reader asked for the narration: restart from the top, play
//             once with captions and the full controls (seek, captions, mute,
//             speed, fullscreen), and go back to ambient at the end
// It never starts on its own for a reader who asked for reduced motion, and
// anything that moves for more than five seconds needs a way to stop it
// (WCAG 2.2.2), so there is always a pause. With no JavaScript it is a plain
// video with native controls, the poster and a captions track, and the
// transcript below carries every word the narrator says.
//
// Captions are drawn by the page from the track's active cue rather than by
// the browser, so they look the same everywhere, sit above the control bar
// instead of under it, and scale up in fullscreen.

type Mode = "ambient" | "sound"
const SPEEDS = [1, 1.25, 1.5, 2]
const IDLE_MS = 2500

const clock = (s: number) => {
  const t = Math.max(0, Math.floor(s))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`
}

type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void }

// Hydration and the reader's motion preference are outside facts, read with
// useSyncExternalStore rather than mirrored into state from an effect: the
// server snapshot (false) is what SSR renders, and React switches to the
// client's after hydration with no extra render and no mismatch.
const noop = () => () => {}
const useHydrated = () => useSyncExternalStore(noop, () => true, () => false)
const REDUCE = "(prefers-reduced-motion: reduce)"
const useReducedMotion = () =>
  useSyncExternalStore(
    (on) => {
      const mq = window.matchMedia(REDUCE)
      mq.addEventListener("change", on)
      return () => mq.removeEventListener("change", on)
    },
    () => window.matchMedia(REDUCE).matches,
    () => false
  )

// `source` names the page the film belongs to in its caption: an article's by
// default, or an architecture doc's.
export function ArticleFilm({ film, title, source = "article" }: { film: Film; title: string; source?: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const ref = useRef<HTMLVideoElement>(null)
  const held = useRef(false) // the reader paused it: don't restart on scroll
  const idleTimer = useRef<number | undefined>(undefined)
  const bar = useRef<HTMLDivElement>(null)
  const overBar = useRef(false)
  const hydrated = useHydrated()
  const still = useReducedMotion() // nothing plays on its own
  const [mode, setMode] = useState<Mode>("ambient")
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [captions, setCaptions] = useState(true)
  const [cue, setCue] = useState("")
  const [t, setT] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [full, setFull] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [active, setActive] = useState(true) // controls shown
  const [stopped, setStopped] = useState(false) // mirrors held, for rendering

  const dur = film.duration
  const sound = mode === "sound"

  // Ambient playback follows the viewport; the caption track feeds our overlay.
  useEffect(() => {
    const v = ref.current
    if (!v) return
    const track = v.textTracks[0]
    const onCue = () => {
      const c = track?.activeCues?.[0] as VTTCue | undefined
      setCue(c ? c.text : "")
    }
    if (track) {
      track.mode = "hidden"
      track.addEventListener("cuechange", onCue)
    }
    const onFs = () => setFull(document.fullscreenElement === wrap.current)
    document.addEventListener("fullscreenchange", onFs)
    let io: IntersectionObserver | undefined
    if (!window.matchMedia(REDUCE).matches) {
      io = new IntersectionObserver(
        ([e]) => {
          if (!v.muted || !v.loop) return // a narrated viewing is the reader's
          if (!e.isIntersecting) v.pause()
          else if (!held.current) v.play().catch(() => {})
        },
        { threshold: 0.5 }
      )
      io.observe(v)
    }
    return () => {
      io?.disconnect()
      track?.removeEventListener("cuechange", onCue)
      document.removeEventListener("fullscreenchange", onFs)
    }
  }, [])

  // In a narrated viewing the bar hides after a moment of stillness while the
  // film plays, and comes back on any pointer movement, key or pause. It stays
  // while the pointer rests on it or keyboard focus is in it.
  const wake = useCallback(() => {
    setActive(true)
    window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => {
      if (!overBar.current && !bar.current?.contains(document.activeElement)) setActive(false)
    }, IDLE_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(idleTimer.current), [])
  const showBar = !sound || !playing || active

  const toAmbient = () => {
    const v = ref.current
    if (!v) return
    v.muted = true
    v.loop = true
    v.playbackRate = 1
    setSpeed(1)
    setMuted(true)
    setMode("ambient")
  }

  const startSound = () => {
    const v = ref.current
    if (!v) return
    v.muted = false
    v.loop = false
    v.currentTime = 0
    v.playbackRate = speed
    setMuted(false)
    setMode("sound")
    held.current = false
    setStopped(false)
    v.play().catch(() => {})
    wake()
  }

  const togglePlay = () => {
    const v = ref.current
    if (!v) return
    if (v.paused) {
      held.current = false
      setStopped(false)
      v.play().catch(() => {})
    } else {
      held.current = true
      setStopped(true)
      v.pause()
    }
    wake()
  }

  const toggleMute = () => {
    const v = ref.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
    wake()
  }

  const cycleSpeed = () => {
    const v = ref.current
    if (!v) return
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    v.playbackRate = next
    setSpeed(next)
    wake()
  }

  const seek = (to: number) => {
    const v = ref.current
    if (!v) return
    v.currentTime = Math.min(dur, Math.max(0, to))
    setT(v.currentTime)
    wake()
  }

  const toggleFull = () => {
    const w = wrap.current
    const v = ref.current as WebkitVideo | null
    if (!w || !v) return
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else if (w.requestFullscreen) w.requestFullscreen().catch(() => {})
    else v.webkitEnterFullscreen?.() // iPhone: only the video itself goes fullscreen
    wake()
  }

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement).tagName
    const onControl = tag === "BUTTON" || tag === "INPUT"
    const k = e.key.toLowerCase()
    if ((k === " " && !onControl) || k === "k") {
      e.preventDefault()
      if (sound) togglePlay()
      else startSound()
    } else if (k === "f") {
      e.preventDefault()
      toggleFull()
    } else if (k === "m") {
      e.preventDefault()
      if (sound) toggleMute()
      else startSound()
    } else if (k === "c" && sound) {
      e.preventDefault()
      setCaptions((c) => !c)
    } else if ((k === "arrowleft" || k === "arrowright") && sound && tag !== "INPUT") {
      e.preventDefault()
      seek((ref.current?.currentTime ?? 0) + (k === "arrowleft" ? -5 : 5))
    }
  }

  const secs = Math.round(dur)
  const pct = dur ? Math.min(100, (t / dur) * 100) : 0
  const iconBtn =
    "grid size-9 shrink-0 place-items-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-white"

  return (
    <figure className="mt-8">
      <div
        ref={wrap}
        role={hydrated ? "group" : undefined}
        aria-label={hydrated ? `Film player: ${title}` : undefined}
        tabIndex={hydrated ? 0 : undefined}
        onKeyDown={hydrated ? onKey : undefined}
        onPointerMove={sound ? wake : undefined}
        onFocus={sound ? wake : undefined}
        className={cn(
          "group/film @container relative isolate overflow-hidden bg-black outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          full
            ? "flex items-center justify-center"
            : "rounded-xl border shadow-sm ring-1 ring-black/5 dark:ring-white/5",
          full && sound && playing && !active && "cursor-none"
        )}
      >
        <video
          ref={ref}
          className={cn(
            "block w-full",
            full ? "h-full object-contain" : "aspect-video",
            film.pixel && "[image-rendering:pixelated]"
          )}
          width={film.width}
          height={film.height}
          poster={film.poster}
          muted
          loop
          playsInline
          preload="none"
          controls={!hydrated}
          aria-label={`${secs}-second narrated explainer film: ${title}`}
          aria-describedby="film-transcript"
          onClick={hydrated ? () => (sound ? togglePlay() : startSound()) : undefined}
          onDoubleClick={hydrated ? toggleFull : undefined}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onWaiting={() => setWaiting(true)}
          onPlaying={() => setWaiting(false)}
          onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
          onEnded={() => {
            // a narrated viewing plays once; afterwards it goes back to ambient
            held.current = true
            setStopped(true)
            toAmbient()
          }}
        >
          <source src={film.src} type="video/mp4" />
          <track kind="captions" src={film.captions} srcLang="en" label="English" default={!hydrated} />
        </video>

        {hydrated ? (
          <>
            {/* the narration's current line, above the bar */}
            {sound && captions && cue ? (
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-x-0 flex justify-center px-3 transition-[bottom] duration-200",
                  showBar ? "bottom-[3.25rem] @md:bottom-16" : "bottom-3 @md:bottom-5",
                  full && (showBar ? "bottom-24" : "bottom-10")
                )}
              >
                <p
                  className={cn(
                    "max-w-[90%] rounded-md bg-black/75 px-2.5 py-1 text-center leading-snug text-balance text-white",
                    full ? "text-2xl" : "text-xs @md:text-sm @xl:text-base"
                  )}
                >
                  {cue}
                </p>
              </div>
            ) : null}

            {/* buffering, and the big play button when a narrated viewing is paused */}
            {sound && waiting && playing ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="size-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              </div>
            ) : null}
            {!playing && !waiting && (sound || still || stopped) ? (
              <button
                type="button"
                onClick={sound ? togglePlay : startSound}
                aria-label={sound ? "Play" : `Watch with sound, ${clock(dur)}`}
                className="absolute top-1/2 left-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white shadow-lg ring-1 ring-white/25 backdrop-blur-sm transition hover:scale-105 hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white"
              >
                <PlayIcon weight="fill" className="size-7 translate-x-0.5" />
              </button>
            ) : null}

            {sound ? (
              // the full bar
              <div
                ref={bar}
                onPointerEnter={() => (overBar.current = true)}
                onPointerLeave={() => (overBar.current = false)}
                className={cn(
                  // the gradient lets taps through to the picture; only the controls catch them
                  "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 pt-6 pb-1 transition-opacity duration-200 @md:px-3 @md:pt-10 @md:pb-2",
                  full && "px-6 pb-4",
                  showBar ? "opacity-100 [&>*]:pointer-events-auto" : "opacity-0"
                )}
              >
                <input
                  type="range"
                  min={0}
                  max={dur}
                  step={0.1}
                  value={t}
                  onChange={(e) => seek(Number(e.target.value))}
                  aria-label="Seek"
                  aria-valuetext={`${clock(t)} of ${clock(dur)}`}
                  className="film-seek"
                  style={{ "--film-fill": `${pct.toFixed(2)}%` } as CSSProperties}
                />
                <div className="mt-0.5 flex items-center gap-0.5 text-white">
                  <button type="button" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} title={playing ? "Pause (k)" : "Play (k)"} className={iconBtn}>
                    {playing ? <PauseIcon weight="fill" className="size-5" /> : <PlayIcon weight="fill" className="size-5" />}
                  </button>
                  <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} title={muted ? "Unmute (m)" : "Mute (m)"} className={iconBtn}>
                    {muted ? <SpeakerSlashIcon weight="fill" className="size-5" /> : <SpeakerHighIcon weight="fill" className="size-5" />}
                  </button>
                  <span className="ml-1.5 font-mono text-xs tabular-nums text-white/85">
                    {clock(t)} <span className="text-white/50">/ {clock(dur)}</span>
                  </span>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={cycleSpeed}
                    aria-label={`Playback speed ${speed}x`}
                    title="Playback speed"
                    className="h-9 min-w-11 rounded-full px-2 font-mono text-xs tabular-nums text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
                  >
                    {speed}×
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaptions((c) => !c)}
                    aria-pressed={captions}
                    aria-label="Captions"
                    title="Captions (c)"
                    className={cn(iconBtn, !captions && "text-white/45")}
                  >
                    <ClosedCaptioningIcon weight={captions ? "fill" : "regular"} className="size-5" />
                  </button>
                  <button type="button" onClick={toggleFull} aria-label={full ? "Exit fullscreen" : "Fullscreen"} title={full ? "Exit fullscreen (f)" : "Fullscreen (f)"} className={iconBtn}>
                    {full ? <CornersInIcon weight="bold" className="size-5" /> : <CornersOutIcon weight="bold" className="size-5" />}
                  </button>
                </div>
              </div>
            ) : (
              // ambient: an invitation to the narrated viewing, and a way to stop it
              <>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/50 to-transparent p-2.5 pt-10 @md:p-3 @md:pt-12 [&>*]:pointer-events-auto">
                  <button
                    type="button"
                    onClick={startSound}
                    className="inline-flex items-center gap-2 rounded-full bg-white/95 py-1.5 pr-3.5 pl-2.5 text-sm font-medium text-neutral-900 shadow-md transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <SpeakerHighIcon weight="fill" className="size-4" />
                    Watch with sound
                    <span className="font-mono text-xs tabular-nums text-neutral-500">{clock(dur)}</span>
                  </button>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={togglePlay}
                      aria-label={playing ? "Pause the film" : "Play the film"}
                      title={playing ? "Pause" : "Play"}
                      className={cn(iconBtn, "bg-black/35 backdrop-blur-sm")}
                    >
                      {playing ? <PauseIcon weight="fill" className="size-4" /> : <PlayIcon weight="fill" className="size-4" />}
                    </button>
                    <button type="button" onClick={toggleFull} aria-label={full ? "Exit fullscreen" : "Fullscreen"} title="Fullscreen (f)" className={cn(iconBtn, "bg-black/35 backdrop-blur-sm")}>
                      {full ? <CornersInIcon weight="bold" className="size-4" /> : <CornersOutIcon weight="bold" className="size-4" />}
                    </button>
                  </div>
                </div>
                {/* where the loop is */}
                <div aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-white/15">
                  <div className="h-full bg-white/70" style={{ width: `${pct}%` }} />
                </div>
              </>
            )}
          </>
        ) : null}
      </div>
      <figcaption className="mt-3 text-sm text-muted-foreground">
        <p>
          A {clock(dur)} narrated explainer, drawn in code. Every number and picture in it is
          this {source}&apos;s own; the sources are below.
        </p>
        <details className="group/tx mt-1.5">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-mono text-xs select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
            <span className="transition-transform group-open/tx:rotate-90">›</span> transcript
          </summary>
          <p id="film-transcript" className="mt-2 max-w-prose border-l-2 pl-3 text-sm leading-relaxed">
            {film.transcript}
          </p>
        </details>
      </figcaption>
    </figure>
  )
}
