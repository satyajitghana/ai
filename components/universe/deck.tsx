"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"

import { cn } from "@/lib/utils"

import { attempt, reasonOf, StepError, within } from "./engine/boot"
import type { Deck, DeckEvent } from "./engine/core"
import type { Synth } from "./engine/synth"
import { FONTS, loadFonts } from "./fonts"
import { BEAT_COUNT, SCENES, sceneSources } from "./script"

// The React side of the /universe deck: one canvas, the keys, and the panels (speaker notes,
// sources, help). The engine and three.js are imported on mount, so the page's own JavaScript
// stays small, and each scene is a further chunk that loads when the talk gets near it.
//
//  → ↓ space PageDown Enter   next beat          ← ↑ PageUp Backspace   back
//  A auto-play   N notes   S sources   M sound   F full screen   ? help   Home / End
//
// The URL hash names the beat (#forge-2). The deck draws with WebGPU where the browser has an
// adapter and with WebGL 2 otherwise; `?gl` in the URL forces the WebGL 2 backend. With neither,
// the deck says so and points at the text version the page renders under it.
//
// Opening is a chain, and the bar counts it: graphics card, then the engine chunk and the fonts
// together, then the renderer (its `init()` resolved, so the adapter and device exist), then the
// scene chunk, its pipelines, each beat drawn once, the first frame. The bar's value is stages
// finished over stages there are, and its label is the stage in flight. No stage waits without a
// limit (engine/boot.ts): each has a time limit and one more try, and one that still fails is
// named on the bar ("failed: renderer (WebGPU), no answer after 8 s") beside a button that
// starts over. Three stages have a way round instead: no adapter in time means WebGL 2, fonts
// that are late mean the deck opens with fallback faces and re-lays its type when they land, and
// a compile that does not answer means scenes compile on their first render.
//
// Before any of that the bar reads "0%, waiting for the page script": that is the server's
// markup, and nothing in this component runs until React hydrates it. Hydration can fail to
// come. A script chunk of the page can fail to load. And under `next dev` hydration waits for
// the page's React debug data, which the dev server sends once, over the HMR websocket, to the
// first socket that names this document: if that socket drops while the page loads (a restart,
// a busy server), the client reconnects, nobody resends, and the page waits for good. So an
// inline script (WATCHDOG) watches from the server's HTML, on what the page can see: which of
// its script tags have answered, whether any failed, and whether React has arrived. While
// scripts are still coming (a first compile can take a while) it only counts them on the bar;
// it never reloads then. Once they are all in and React still has not started, it reloads the
// page once (remembered in sessionStorage, so it cannot loop), and after that it says what is
// wrong and offers a Reload button.
//
// A boot belongs to one mount. It starts a tick after the effect, so the mount React throws away
// in dev (StrictMode: mount, unmount, mount) never starts one; a boot cancelled later (a hot
// reload, a retry) stops at its next step and frees what arrives late. Nothing is shared between
// boots except the module cache, so a cancelled one cannot strand the next. Every Deck gets a
// canvas of its own, because a canvas keeps the first kind of context it was given. With
// prefers-reduced-motion each beat is shown settled, the hand-offs are cuts, and nothing plays by
// itself.

type Pos = { scene: number; beat: number }
type Panel = "notes" | "sources" | "help" | null

type Progress = { done: number; total: number; label: string; scope: "open" | "next" }

/** Stages before the engine's own: graphics card, engine chunk, fonts, renderer. */
const PRE = 4
// Time limits. The chunk limits are sized for a dev server compiling on first request on a busy machine.
const ADAPTER_MS = 4_000
const ENGINE_MS = 25_000
const FONT_MS = 3_000
const RENDERER_MS = 10_000 // above the engine's own limit on `renderer.init()`

// How long the watchdog gives React once every script of the page has answered (counted only while
// the main thread is idle, so a slow machine that is busy hydrating is not cut short), and how long
// it lets scripts stay pending before it offers a manual reload (it never reloads those itself).
const WATCH_START_MS = 5000
const WATCH_FAILED_MS = 1000
const WATCH_SLOW_MS = 30000

/**
 * Runs from the server's HTML, before and without React (see the note at the top). ES5 on
 * purpose: it is shipped as text, not compiled. It reads only what the page can observe: its own
 * `<script src>` tags against Resource Timing (an entry exists once a request has answered or
 * failed), `error` events from them, `document.readyState`, and the marker the component sets
 * when it mounts (`data-universe-boot`).
 */
const WATCHDOG = `(function () {
  var me = document.currentScript, root = me && me.parentElement;
  if (!root) return;
  var KEY = "universe-reloaded", DEV = ${process.env.NODE_ENV !== "production"};
  var began = Date.now(), last = began, quiet = 0, fetched = 0, shown = "", failed = {}, stopped = false;
  function find(a) { return root.querySelector("[" + a + "]"); }
  function say(t) { var e = find("data-universe-label"); if (e && t !== shown) { e.textContent = t; shown = t; } }
  function offer() {
    var box = find("data-universe-watch");
    if (!box || box.firstChild) return;
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = "Reload";
    b.className = "pointer-events-auto rounded border border-white/30 px-3 py-1 text-sm text-neutral-200 hover:bg-white/15";
    b.onclick = function () { location.reload(); };
    box.appendChild(b);
  }
  function file(u) { return u.split("?")[0].split("/").pop(); }
  function recently() { try { return Date.now() - (Number(sessionStorage.getItem(KEY)) || 0) < 60000; } catch (e) { return true; } }
  addEventListener("error", function (e) { var t = e.target; if (t && t.tagName === "SCRIPT" && t.src) failed[t.src] = 1; }, true);
  function tick() {
    if (stopped) return;
    if (root.getAttribute("data-universe-boot")) { var box = find("data-universe-watch"); if (box) box.textContent = ""; return; }
    var all = [], pending = [], bad = [], list = document.scripts, i, u, e;
    // the page's own scripts; a nomodule one is never fetched by a browser that can run this page
    for (i = 0; i < list.length; i++) { u = list[i].src; if (u && !list[i].noModule && u.indexOf(location.origin + "/_next/") === 0) all.push(u); }
    for (i = 0; i < all.length; i++) {
      u = all[i];
      e = performance.getEntriesByName(u)[0];
      // an entry with an error status, or with no status and no body, is a request that failed
      if (failed[u] || (e && (e.responseStatus >= 400 || (!e.responseStatus && !e.decodedBodySize && !e.transferSize)))) bad.push(u);
      else if (!e && document.readyState !== "complete") pending.push(u);
    }
    // Time counts toward the limit only while the page is idle. A tick that arrives late means the
    // main thread is busy, most likely with React starting; a new request means the page is still
    // being fed (under next dev, a hot update while somebody saves files).
    var now = Date.now(), gap = now - last, n = performance.getEntriesByType("resource").length;
    last = now;
    if (n !== fetched) { fetched = n; quiet = 0; gap = 1e9; }
    var secs = Math.round((now - began) / 1000);
    if (pending.length || document.readyState === "loading") {
      quiet = 0;
      say("loading the page script, " + (all.length - pending.length) + " of " + all.length + (secs >= 4 && pending.length ? " (" + secs + " s, waiting for " + file(pending[0]) + ")" : ""));
      if (now - began > ${WATCH_SLOW_MS}) offer();
    } else {
      if (gap < 400) quiet += gap;
      var why = bad.length ? "a page script failed to load (" + file(bad[0]) + ")" : "the page script loaded but React did not start" + (DEV ? " (dev server: possibly the debug channel for this page was lost)" : "");
      if (quiet < (bad.length ? ${WATCH_FAILED_MS} : ${WATCH_START_MS})) say(bad.length ? why : "page script loaded (" + all.length + " of " + all.length + "), starting");
      else if (!recently()) {
        try { sessionStorage.setItem(KEY, String(Date.now())); } catch (e) {}
        say(why + ", reloading once");
        console.info("[universe] " + why + "; reloading once");
        stopped = true;
        location.reload();
        return;
      } else { say("failed: page script, " + why + ", and a reload did not help"); offer(); }
    }
    setTimeout(tick, 250);
  }
  tick();
})()`

const noop = () => () => {}

const FLAT: Pos[] = SCENES.flatMap((s, scene) => s.beats.map((_, beat) => ({ scene, beat })))

function parseHash(h: string): Pos | null {
  const m = /^#([a-z]+)(?:-(\d+))?$/.exec(h)
  if (!m) return null
  const scene = SCENES.findIndex((s) => s.id === m[1])
  if (scene < 0) return null
  return { scene, beat: Math.min(SCENES[scene].beats.length - 1, Math.max(0, (m[2] ? Number(m[2]) : 1) - 1)) }
}

type Harness = {
  ready: boolean
  scenes: string[]
  /** The font families the type layer draws with (tools that render the old engine beside this one need them). */
  fonts: Record<string, string>
  seek(scene: number | string, beat?: number, t?: number): Promise<unknown>
  seekTransition(to: number | string, p: number): Promise<unknown>
  resume(): void
  /** Load, compile and draw every scene once; returns per-scene milliseconds. For measuring. */
  warmAll(): Promise<unknown>
  setAuto(on: boolean): void
  next(): void
  prev(): void
  info(): unknown
  labels(): unknown
  sound(on: boolean): void
  play(name: string): void
  /** The synth itself (`info()`, `play(name, opts)`, `bed`) and an offline render of it, for measuring. */
  synth: Synth
  renderSound(spec: Parameters<typeof Synth.render>[0]): Promise<AudioBuffer>
}

export function UniverseDeck({ mode }: { mode: "page" | "embed" }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const deckRef = useRef<Deck | null>(null)
  const [pos, setPos] = useState<Pos>({ scene: 0, beat: 0 })
  const [loading, setLoading] = useState(true)
  const [auto, setAuto] = useState(false)
  const [sound, setSound] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)
  const [unsupported, setUnsupported] = useState(false)
  const [progress, setProgress] = useState<Progress>({ done: 0, total: PRE + SCENES[0].beats.length + 3, label: "waiting for the page script", scope: "open" })
  const [slow, setSlow] = useState(false)
  /** Opening failed: "failed: <step>, <reason>". The bar shows it with a way to start over. */
  const [failure, setFailure] = useState<string | null>(null)
  /** Something failed after the deck opened (a next scene's chunk); the deck is still running. */
  const [notice, setNotice] = useState<string | null>(null)
  /** Bumped by "try again": the effect below runs once more, from a clean slate. */
  const [run, setRun] = useState(0)
  // true only in the server's HTML and the hydration pass over it, where an inline script runs
  const fromServer = useSyncExternalStore(noop, () => false, () => true)

  useEffect(() => {
    const host = hostRef.current
    const stage = stageRef.current
    if (!host || !stage) return
    // React is here: the watchdog stands down, and whatever it put on screen goes
    stage.dataset.universeBoot = "hydrated"
    stage.querySelector("[data-universe-watch]")?.replaceChildren()
    let dead = false
    let deck: Deck | null = null
    let slowTimer = 0
    let noticeTimer = 0
    const alive = () => !dead
    // a fresh canvas for every Deck (and every try at one), removed with it
    const fresh = () => {
      const canvas = document.createElement("canvas")
      canvas.className = "block aspect-video h-full max-h-full w-full select-none"
      host.replaceChildren(canvas)
      return canvas
    }
    const show = (p: Progress) => {
      if (dead) return
      setProgress(p)
      // a stage that has not finished after a few seconds is pointed out on screen
      setSlow(false)
      window.clearTimeout(slowTimer)
      if (p.done < p.total) slowTimer = window.setTimeout(() => !dead && setSlow(true), 4000)
    }
    const settle = () => {
      window.clearTimeout(slowTimer)
      setSlow(false)
    }
    // Attached before the Deck exists: it is handed to the constructor, so no event can precede it.
    const onEvent = (e: DeckEvent) => {
      if (dead) return
      if (e.type === "pos") {
        setPos({ scene: e.scene, beat: e.beat })
        if (mode === "page") {
          const hash = `#${SCENES[e.scene].id}-${e.beat + 1}`
          if (window.location.hash !== hash) window.history.replaceState(null, "", window.location.pathname + window.location.search + hash)
        }
      } else if (e.type === "status") {
        setLoading(e.loading)
        if (e.loading) setNotice(null)
        else settle()
      } else if (e.type === "progress") {
        // the engine counts its own stages; while opening they come after the four counted here
        const lead = e.scope === "open" ? PRE : 0
        show({ done: lead + e.done, total: lead + e.total, label: e.label, scope: e.scope })
      } else if (e.type === "error") {
        settle()
        setNotice(`failed: ${e.step}, ${e.reason}`)
        window.clearTimeout(noticeTimer)
        noticeTimer = window.setTimeout(() => !dead && setNotice(null), 12000)
      } else if (e.type === "auto") setAuto(e.on)
      else if (e.type === "sound") setSound(e.on)
    }
    const broke = (e: unknown) => {
      const step = e instanceof StepError ? e.step : "deck"
      // a real failure: both tries at a stage, or something nobody expected
      console.error(`[universe] failed: ${step}, ${reasonOf(e)}`, e)
      deck?.dispose()
      deck = null
      deckRef.current = null
      if (dead) return
      settle()
      host.replaceChildren()
      setLoading(false)
      setFailure(`failed: ${step}, ${reasonOf(e)}`)
    }
    const boot = async () => {
      const query = new URLSearchParams(window.location.search)
      const at = (mode === "page" && parseHash(window.location.hash)) || { scene: 0, beat: 0 }
      const total = PRE + SCENES[at.scene].beats.length + 3
      let done = 0
      const say = (label: string) => show({ done, total, label, scope: "open" })
      // a clean slate, whatever the mount before this one left on screen
      setFailure(null)
      setNotice(null)
      setUnsupported(false)
      setLoading(true)
      say("checking the graphics card")

      // 1. Which API. A browser can expose navigator.gpu and have no adapter, or never answer.
      // `?gl` (the harness uses it too) forces three's WebGL 2 backend.
      const forceWebGL = query.has("gl")
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
      let adapter: unknown = null
      if (!forceWebGL && gpu) {
        adapter = await attempt("graphics card", () => gpu.requestAdapter(), { ms: ADAPTER_MS, alive }).catch((e) => {
          console.info(`[universe] no WebGPU adapter (${reasonOf(e)}); using WebGL 2`)
          return null
        })
      }
      if (dead) return
      if (!adapter) {
        const probe = document.createElement("canvas").getContext("webgl2")
        const webgl2 = !!probe
        probe?.getExtension("WEBGL_lose_context")?.loseContext()
        if (!webgl2) {
          settle()
          setUnsupported(true)
          setLoading(false)
          return
        }
      }
      done++
      const api = adapter ? "WebGPU" : "WebGL 2"

      // 2 and 3. The engine chunk and the fonts, together. The fonts never hold the deck: after
      // FONT_MS it opens with fallback faces and lays its type out again when they land.
      let engineIn = false
      let fontsIn = false
      let fontsLate = false
      const waiting = () => say(engineIn && fontsIn ? `starting the renderer (${api})` : engineIn ? "waiting for the fonts" : `${api} found, loading the engine`)
      waiting()
      const fonts = loadFonts().catch(() => {})
      const fontsStep = within(fonts, FONT_MS)
        .catch(() => {
          fontsLate = true
          console.info(`[universe] the fonts were not ready after ${FONT_MS / 1000} s; opening with fallback faces`)
        })
        .then(() => {
          fontsIn = true
          done++
          if (!engineIn) waiting()
        })
      const engineStep = attempt("engine chunk", () => import("./engine/core"), { ms: ENGINE_MS, alive }).then((m) => {
        engineIn = true
        done++
        if (!fontsIn) waiting()
        return m
      })
      const [{ Deck }] = await Promise.all([engineStep, fontsStep])
      if (dead) return
      waiting()

      // 4. The renderer. `Deck.create` resolves only after `renderer.init()` has: nothing is
      // compiled or drawn before the adapter and device exist. Each try gets a new canvas.
      const opts = { fonts: FONTS, reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches, profile: query.has("prof"), onEvent }
      const renderer = (webgl: boolean) =>
        attempt(`renderer (${webgl ? "WebGL 2" : "WebGPU"})`, () => Deck.create({ ...opts, canvas: fresh(), forceWebGL: webgl }), { ms: RENDERER_MS, alive, late: (d) => d.dispose() })
      try {
        deck = await renderer(!adapter)
      } catch (e) {
        // WebGPU promised an adapter and then would not start: WebGL 2 instead
        if (dead || !adapter) throw e
        console.warn(`[universe] WebGPU would not start (${reasonOf(e)}); trying WebGL 2`)
        say("WebGPU would not start, starting the renderer (WebGL 2)")
        deck = await renderer(true)
      }
      if (dead) {
        deck.dispose()
        deck = null
        return
      }
      deckRef.current = deck
      done++
      const d = deck
      if (fontsLate) void fonts.then(() => !dead && d.refont())

      // 5 to 8. Scene chunk, pipelines, each beat, first frame: the engine counts those (onEvent).
      await d.start(at.scene, at.beat)
      if (dead || mode !== "page") return
      const harness: Harness = {
        ready: true,
        scenes: SCENES.map((s) => s.id),
        fonts: FONTS,
        seek: (s, b, t) => d.seek(s, b, t),
        seekTransition: (to, p) => d.seekTransition(to, p),
        resume: () => d.resume(),
        warmAll: () => d.warmAll(),
        setAuto: (on) => d.setAuto(on),
        next: () => d.next(),
        prev: () => d.prev(),
        info: () => d.info(),
        labels: () => d.labels(),
        sound: (on) => d.setSound(on),
        play: (name) => d.synth.play(name as Parameters<typeof d.synth.play>[0]),
        synth: d.synth,
        renderSound: (spec) => (d.synth.constructor as typeof Synth).render(spec),
      }
      ;(window as unknown as { __deck?: Harness }).__deck = harness
    }
    // A tick later, not now: the mount StrictMode throws away is gone by then and starts nothing.
    const bootTimer = window.setTimeout(() => void boot().catch(broke), 0)
    const onHash = () => {
      const p = parseHash(window.location.hash)
      const d = deckRef.current
      if (p && d && (p.scene !== d.scene || p.beat !== d.beat)) void d.jump(p.scene, p.beat)
    }
    if (mode === "page") window.addEventListener("hashchange", onHash)
    return () => {
      dead = true
      window.clearTimeout(bootTimer)
      window.clearTimeout(slowTimer)
      window.clearTimeout(noticeTimer)
      window.removeEventListener("hashchange", onHash)
      deck?.dispose()
      deck = null
      host.replaceChildren()
      deckRef.current = null
      if (mode === "page") delete (window as unknown as { __deck?: Harness }).__deck
    }
  }, [mode, run])

  const toggleFull = useCallback(() => {
    const el = stageRef.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen?.()
  }, [])

  const onKey = useCallback(
    (e: KeyboardEvent | React.KeyboardEvent) => {
      const d = deckRef.current
      if (!d || e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      const k = e.key
      // a stored "sound on" starts here, on the first key that is not the sound key itself
      if (k !== "m" && k !== "M") d.gesture()
      let used = true
      if (k === "ArrowRight" || k === "ArrowDown" || k === " " || k === "PageDown" || k === "Enter") d.next()
      else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || k === "Backspace") d.prev()
      else if (k === "Home") void d.jump(0, 0)
      else if (k === "End") void d.jump(SCENES.length - 1, 0)
      else if (k === "a" || k === "A") d.setAuto(!d.auto)
      else if (k === "m" || k === "M") d.toggleSound()
      else if (k === "f" || k === "F") toggleFull()
      else if (k === "n" || k === "N") setPanel((p) => (p === "notes" ? null : "notes"))
      else if (k === "s" || k === "S") setPanel((p) => (p === "sources" ? null : "sources"))
      else if (k === "?" || k === "h" || k === "H") setPanel((p) => (p === "help" ? null : "help"))
      else if (k === "Escape") setPanel(null)
      else used = false
      if (used) e.preventDefault()
    },
    [toggleFull],
  )

  useEffect(() => {
    if (mode !== "page") return
    const h = (e: KeyboardEvent) => onKey(e)
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [mode, onKey])

  const touch = useRef<number | null>(null)
  const scene = SCENES[pos.scene]
  const beat = scene.beats[pos.beat]
  const flatIndex = FLAT.findIndex((p) => p.scene === pos.scene && p.beat === pos.beat)
  const nextPos = FLAT[flatIndex + 1]
  const nextNote = nextPos ? SCENES[nextPos.scene].beats[nextPos.beat].note : null

  const value = progress.total ? Math.min(1, progress.done / progress.total) : 0
  const pct = Math.round(value * 100)

  const btn = "rounded px-2 py-1 font-mono text-[11px] uppercase tracking-widest text-white/70 hover:bg-white/15 hover:text-white focus-visible:bg-white/15 focus-visible:outline-none"

  return (
    <section
      aria-label="A history of everything: an interactive talk"
      className={cn("grid w-full place-items-center bg-black", mode === "page" ? "min-h-[calc(100svh-3.5rem)]" : "overflow-hidden rounded-lg")}
    >
      <div
        ref={stageRef}
        tabIndex={mode === "embed" ? 0 : -1}
        onKeyDown={mode === "embed" ? onKey : undefined}
        onPointerDownCapture={() => deckRef.current?.gesture()}
        onPointerUpCapture={() => deckRef.current?.gesture()}
        className={cn(
          "group/deck relative grid aspect-video w-full place-items-center overflow-hidden bg-black outline-none [&:fullscreen]:aspect-auto [&:fullscreen]:h-screen [&:fullscreen]:max-w-none",
          mode === "page" && "max-w-[calc((100svh-3.5rem)*16/9)]",
        )}
      >
        <div
          ref={hostRef}
          className="grid aspect-video max-h-full w-full max-w-[calc(100vh*16/9)] cursor-pointer place-items-center"
          onClick={() => {
            if (panel) setPanel(null)
            else deckRef.current?.next()
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            deckRef.current?.prev()
          }}
          onTouchStart={(e) => {
            touch.current = e.touches[0]?.clientX ?? null
          }}
          onTouchEnd={(e) => {
            const x0 = touch.current
            const x1 = e.changedTouches[0]?.clientX
            touch.current = null
            if (x0 === null || x1 === undefined || Math.abs(x1 - x0) < 40) return
            e.preventDefault()
            if (x1 < x0) deckRef.current?.next()
            else deckRef.current?.prev()
          }}
        />

        {unsupported && (
          <div className="absolute inset-0 grid place-content-center gap-3 bg-neutral-950 p-8 text-center text-neutral-200">
            <p className="text-lg font-medium">This talk is drawn with WebGPU or WebGL 2, and this browser offers neither.</p>
            <p className="text-sm text-neutral-400">
              The whole talk is also written out as text:{" "}
              <a className="underline" href="#text-version">
                read the text version
              </a>
              .
            </p>
          </div>
        )}

        {/* the watchdog's own corner: React leaves its contents alone (see WATCHDOG) */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[5%] z-30 grid place-items-center" data-universe-watch suppressHydrationWarning dangerouslySetInnerHTML={{ __html: "" }} />
        {fromServer && <script dangerouslySetInnerHTML={{ __html: WATCHDOG }} />}

        {failure && !unsupported && (
          <div className="absolute inset-x-0 bottom-[12%] z-30 grid place-items-center gap-3 px-6 text-center" role="alert" data-universe-progress="failed">
            <span className="flex w-56 items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.25em] text-white/70">
              <span>Stopped</span>
              <span className="tabular-nums">{pct}%</span>
            </span>
            <span className="h-px w-56 bg-white/15">
              <span className="block h-px origin-left bg-red-300" style={{ transform: `scaleX(${value})` }} />
            </span>
            <span className="max-w-xl font-mono text-[11px] tracking-wide text-red-200">{failure}</span>
            <span className="flex items-center gap-4 text-sm text-neutral-300">
              <button type="button" className="rounded border border-white/30 px-3 py-1 hover:bg-white/15 focus-visible:bg-white/15 focus-visible:outline-none" onClick={() => setRun((n) => n + 1)}>
                Try again
              </button>
              <a className="underline" href="#text-version">
                read the text version
              </a>
            </span>
          </div>
        )}

        {loading && !unsupported && !failure && progress.scope === "open" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[12%] grid place-items-center gap-2" role="status" aria-live="polite" data-universe-progress="open">
            <span className="flex w-56 items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.25em] text-white/70">
              <span>Opening</span>
              <span className="tabular-nums">{pct}%</span>
            </span>
            <span className="h-px w-56 bg-white/15" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <span className="block h-px origin-left bg-white transition-transform duration-200 ease-out" style={{ transform: `scaleX(${value})` }} />
            </span>
            {/* the watchdog writes here when React never arrives, so React does not hold it to the server's text */}
            <span className={cn("font-mono text-[10px] uppercase tracking-[0.2em]", slow ? "text-amber-200/90" : "text-white/40")} data-universe-label suppressHydrationWarning>
              {slow ? `still waiting: ${progress.label}` : progress.label}
            </span>
          </div>
        )}

        {loading && !unsupported && !failure && progress.scope === "next" && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 grid -translate-x-1/2 place-items-center gap-1" role="status" aria-live="polite" data-universe-progress="next">
            <span className="h-px w-32 bg-white/15" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <span className="block h-px origin-left bg-white/90 transition-transform duration-200 ease-out" style={{ transform: `scaleX(${value})` }} />
            </span>
            <span className={cn("font-mono text-[9px] uppercase tracking-[0.2em]", slow ? "text-amber-200/90" : "text-white/50")}>
              {slow ? `still waiting: ${progress.label}` : progress.label} · {pct}%
            </span>
          </div>
        )}

        {notice && !failure && !unsupported && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 z-30 max-w-[90%] -translate-x-1/2 rounded bg-black/70 px-3 py-1 text-center font-mono text-[10px] tracking-wide text-red-200" role="alert" data-universe-progress="notice">
            {notice}
          </p>
        )}

        {!unsupported && (
          <div className={cn("absolute inset-x-0 top-0 z-40 flex items-center gap-1 bg-gradient-to-b from-black/60 to-transparent px-3 pb-6 pt-2 transition-opacity duration-300 focus-within:opacity-100 group-hover/deck:opacity-100", panel ? "opacity-100" : "opacity-0")}>
            <button type="button" className={btn} onClick={() => deckRef.current?.prev()} aria-label="Previous beat">
              ←
            </button>
            <button type="button" className={btn} onClick={() => deckRef.current?.next()} aria-label="Next beat">
              →
            </button>
            <span className="px-2 font-mono text-[11px] tabular-nums tracking-widest text-white/50">
              {flatIndex + 1} / {BEAT_COUNT}
            </span>
            <span className="flex-1" />
            <button type="button" className={cn(btn, auto && "bg-white/20 text-white")} aria-pressed={auto} onClick={() => deckRef.current?.setAuto(!deckRef.current.auto)}>
              A · auto
            </button>
            <button type="button" className={cn(btn, panel === "notes" && "bg-white/20 text-white")} aria-pressed={panel === "notes"} onClick={() => setPanel(panel === "notes" ? null : "notes")}>
              N · notes
            </button>
            <button type="button" className={cn(btn, panel === "sources" && "bg-white/20 text-white")} aria-pressed={panel === "sources"} onClick={() => setPanel(panel === "sources" ? null : "sources")}>
              S · sources
            </button>
            <button type="button" className={cn(btn, sound && "bg-white/20 text-white")} aria-pressed={sound} onClick={() => deckRef.current?.toggleSound()}>
              M · sound
            </button>
            <button type="button" className={btn} onClick={toggleFull}>
              F · full
            </button>
            <button type="button" className={cn(btn, panel === "help" && "bg-white/20 text-white")} aria-pressed={panel === "help"} onClick={() => setPanel(panel === "help" ? null : "help")}>
              ?
            </button>
          </div>
        )}

        {panel === "notes" && (
          <aside className="absolute inset-x-0 bottom-0 z-10 max-h-[46%] overflow-auto bg-black/80 px-[5%] py-4 text-neutral-100 backdrop-blur-sm" aria-live="polite">
            <button type="button" aria-label="Close notes" onClick={() => setPanel(null)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-xl leading-none text-white/70 hover:bg-white/15 hover:text-white focus-visible:bg-white/15 focus-visible:outline-none">
              ×
            </button>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/50">
              Speaker notes · {scene.title} · beat {pos.beat + 1} of {scene.beats.length}
            </p>
            <p className="mt-2 max-w-4xl text-[clamp(14px,1.5vw,22px)] leading-snug">{beat.note}</p>
            {nextNote && <p className="mt-2 max-w-4xl text-[clamp(11px,1vw,14px)] leading-snug text-white/45">Next: {nextNote}</p>}
          </aside>
        )}

        {panel === "sources" && (
          <aside className="absolute bottom-0 right-0 top-10 z-30 w-[min(100%,30rem)] overflow-auto bg-black/85 p-5 pt-10 text-neutral-100 backdrop-blur-sm">
            <button type="button" aria-label="Close sources" onClick={() => setPanel(null)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-xl leading-none text-white/70 hover:bg-white/15 hover:text-white focus-visible:bg-white/15 focus-visible:outline-none">
              ×
            </button>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/50">Sources · {scene.title}</p>
            {beat.ill && <p className="mt-2 text-xs text-amber-200/90">This picture is an illustration: a staged drawing of the idea, not a measurement or a photograph.</p>}
            <p className="mt-3 text-sm leading-snug text-white/80">{beat.sub ?? beat.head}</p>
            <ul className="mt-3 space-y-2 text-sm leading-snug">
              {sceneSources(scene).map((s) => (
                <li key={s.url}>
                  <a className="underline decoration-white/30 underline-offset-2 hover:decoration-white" href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                </li>
              ))}
              {sceneSources(scene).length === 0 && <li className="text-white/60">Nothing on this slide is a measurement.</li>}
            </ul>
            <p className="mt-4 text-xs text-white/50">
              Every scene&rsquo;s sources are listed in the <a className="underline" href="#text-version">text version</a>.
            </p>
          </aside>
        )}

        {panel === "help" && (
          <aside className="absolute inset-0 z-30 grid place-content-center bg-black/85 p-6 text-neutral-100 backdrop-blur-sm" onClick={() => setPanel(null)}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 font-mono text-xs sm:text-sm">
              {[
                ["→ ↓ space, or a click", "next beat"],
                ["← ↑ backspace, or a right-click", "back"],
                ["A", "play by itself"],
                ["N", "speaker notes"],
                ["S", "sources for this scene"],
                ["M", "sound on or off"],
                ["F", "full screen"],
                ["Home / End", "first and last scene"],
              ].map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-white/60">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </aside>
        )}
      </div>
    </section>
  )
}
