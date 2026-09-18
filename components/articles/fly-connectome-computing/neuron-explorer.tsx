"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { LightningIcon, MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react/dist/ssr"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { buildAdjacency, stepActivity, totalActivity, type ActivityAdjacency } from "./activity"
import {
  loadBackbone,
  loadSomaData,
  loadTypeConnectivity,
  loadTypesTable,
  normalizeTypeQuery,
  REGION_COLORS,
  REGION_LABELS,
  type EdgeSet,
  type SomaData,
  type TypesTable,
} from "./data"
import { lookAt, multiply, orbitEye, perspective, NeuronGLRenderer } from "./gl-renderer"

// A real-data explorer over the FlyEM MaleCNS v1.0 connectome: every recovered
// soma (141,781 of them) as one WebGL2 point cloud, a thresholded "backbone"
// of its strongest wiring, and precomputed connections + counts for a curated
// set of named cell types the article discusses by name. See
// public/articles/fly-connectome-computing/data/manifest.json for exact
// counts, thresholds, and the CC BY 4.0 citation. No runtime calls leave the
// browser -- everything drawn here is the static data committed alongside
// this component.
//
// "use client", but the *first* paint -- server-rendered, and what a reader
// gets with JS off, in print, or as an agent -- is the committed poster PNG
// plus this same descriptive/legend text. The canvas only takes over once
// mounted, WebGL2 is confirmed, and the data has actually loaded.

const NOTABLE_TYPES = ["hDeltaH", "hDeltaA", "hDeltaI", "hDeltaG", "DNa01", "DNa02", "MDN", "DNp09", "LC16"]

const HIGHLIGHT_COLOR: [number, number, number] = [0.25, 1.0, 0.66]
const HIGHLIGHT_EDGE_COLOR: [number, number, number] = [0.88, 1.0, 0.95]
const BACKBONE_COLOR: [number, number, number] = [0.55, 0.62, 0.72]
const REGION_COLOR_LIST: [number, number, number][] = [REGION_COLORS[0], REGION_COLORS[1], REGION_COLORS[2], REGION_COLORS[3]]

const MIN_DIST = 1.15
const MAX_DIST = 6.5

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US")
}

// Two tiny useSyncExternalStore-backed hooks, in place of the usual
// "useState(false) + useEffect(() => setX(true))" hydration-gate idiom. That
// idiom calls setState synchronously inside an effect body purely to mirror
// an external fact (are we hydrated? does the OS want less motion?) into
// React state, which both trips this repo's react-hooks/set-state-in-effect
// lint and is exactly the case useSyncExternalStore exists for: the server
// snapshot (false) is what SSR renders, and React itself reconciles the
// switch to the live client snapshot right after hydration -- no extra
// render-triggering effect, and no hydration-mismatch risk either.
const noopSubscribe = () => () => {}
function useHasMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
}

function subscribeReducedMotion(onChange: () => void) {
  if (typeof window === "undefined" || !("matchMedia" in window)) return () => {}
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}
function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || !("matchMedia" in window)) return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}
function getReducedMotionServerSnapshot(): boolean {
  return false
}
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, getReducedMotionServerSnapshot)
}

export interface NeuronExplorerProps {
  className?: string
  /** Preselect a cell type on mount, e.g. "DNp09" -- normalizes the same way search does. */
  initialType?: string
  /** Override the static/no-JS caption under the poster. */
  caption?: string
}

type LoadStatus = "loading" | "ready" | "error"

// The synchronous part -- resolvable purely from data already in memory --
// computed with useMemo (render-time, not an effect) so it never needs a
// setState round-trip at all. `edgeCount` is genuinely async (a fetch), so
// that alone lives in state, set only from inside the fetch's own callback.
interface Selection {
  canonicalName: string
  region: string
  count: number
  pre: number
  post: number
  indices: Uint32Array
}

export function NeuronExplorer({ className, initialType, caption }: NeuronExplorerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const mounted = useHasMounted()
  const reducedMotion = usePrefersReducedMotion()
  const [status, setStatus] = useState<LoadStatus>("loading")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [glOk, setGlOk] = useState<boolean | null>(null)

  const somaRef = useRef<SomaData | null>(null)
  const typesRef = useRef<TypesTable | null>(null)
  const backboneRef = useRef<EdgeSet | null>(null)
  const adjRef = useRef<ActivityAdjacency | null>(null)
  const activityRef = useRef<Float32Array | null>(null)
  const scratchRef = useRef<Float32Array | null>(null)
  const rendererRef = useRef<NeuronGLRenderer | null>(null)

  const camRef = useRef({ yaw: 0.6, pitch: 0.18, distance: 2.7 })
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null)
  const autoRotateRef = useRef(true)
  const simulatingRef = useRef(false)
  const simStepsRef = useRef(0)
  const simStartRef = useRef(0)
  const simLastStepRef = useRef(0)
  const simTokenRef = useRef(0)

  const [query, setQuery] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedType, setSelectedType] = useState<string | null>(initialType ?? null)
  // set only inside loadTypeConnectivity's own .then() -- see the effect below
  const [edgeInfo, setEdgeInfo] = useState<{ name: string; edgeCount: number | null } | null>(null)
  const [showBackbone, setShowBackbone] = useState(true)
  const [simulating, setSimulating] = useState(false)
  const [zoom, setZoom] = useState(2.7) // mirrors camRef.current.distance, for the slider (touch has no wheel/pinch here)
  // Mirror the refs the render path needs to read: a value read *during*
  // render must come from state, not a ref (react-hooks/refs) -- effects and
  // event handlers still use the refs directly, which is fine outside render.
  const [typesState, setTypesState] = useState<TypesTable | null>(null)
  const [somaState, setSomaState] = useState<SomaData | null>(null)

  // no setState here -- just keeps the imperative render-loop flag in sync
  useEffect(() => {
    autoRotateRef.current = !reducedMotion
  }, [reducedMotion])

  // load the static data set
  useEffect(() => {
    if (!mounted) return
    let cancelled = false
    ;(async () => {
      try {
        const [soma, types, backbone] = await Promise.all([loadSomaData(), loadTypesTable(), loadBackbone()])
        if (cancelled) return
        somaRef.current = soma
        typesRef.current = types
        backboneRef.current = backbone
        adjRef.current = buildAdjacency(soma.count, backbone)
        activityRef.current = new Float32Array(soma.count)
        scratchRef.current = new Float32Array(soma.count)
        setTypesState(types)
        setSomaState(soma)
        setStatus("ready")
      } catch (e) {
        if (!cancelled) {
          setErrorMsg(e instanceof Error ? e.message : String(e))
          setStatus("error")
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mounted])

  // init WebGL2 + render loop once data is ready
  useEffect(() => {
    if (status !== "ready") return
    const canvas = canvasRef.current
    const soma = somaRef.current
    const backbone = backboneRef.current
    if (!canvas || !soma || !backbone) return

    let gl: WebGL2RenderingContext | null = null
    try {
      gl = canvas.getContext("webgl2", { antialias: true, alpha: true, powerPreference: "high-performance" })
    } catch {
      gl = null
    }
    if (!gl) {
      setGlOk(false)
      return
    }
    setGlOk(true)

    const renderer = new NeuronGLRenderer(gl)
    rendererRef.current = renderer
    renderer.setSomas(soma.positions, soma.region)
    renderer.setBackboneEdges(soma.positions, backbone.src, backbone.dst, backbone.weight)

    // Wall-clock-paced, not frame-count-paced: a step happens every
    // PHYSICS_INTERVAL_MS of real time, with a small catch-up allowance if a
    // callback is late (backgrounded tab, or -- as measured in this sandbox's
    // software-rendered headless Chromium, see the component's report -- a
    // device landing well under 60fps). Tying "stimulate" to a raw frame
    // counter would make the same pulse take 160 frames regardless of
    // whether that's 2.7s at 60fps or several minutes at ~1fps.
    const PHYSICS_INTERVAL_MS = 40
    const MAX_STEPS = 160
    const MAX_WALL_MS = 6000

    let raf = 0
    const tick = (now: number) => {
      const el = wrapRef.current
      if (el) {
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        const w = Math.max(1, Math.round(el.clientWidth * dpr))
        const h = Math.max(1, Math.round(el.clientHeight * dpr))
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w
          canvas.height = h
        }
      }

      if (autoRotateRef.current && !dragRef.current) camRef.current.yaw += 0.0016

      if (simulatingRef.current && activityRef.current && scratchRef.current && adjRef.current) {
        const elapsedWall = now - simStartRef.current
        const dueSteps = Math.min(8, Math.floor((now - simLastStepRef.current) / PHYSICS_INTERVAL_MS))
        for (let s = 0; s < dueSteps && simulatingRef.current; s++) {
          stepActivity(activityRef.current, scratchRef.current, adjRef.current)
          simLastStepRef.current += PHYSICS_INTERVAL_MS
          simStepsRef.current++
          const tot = totalActivity(activityRef.current)
          if (tot < 0.05 || simStepsRef.current > MAX_STEPS || elapsedWall > MAX_WALL_MS) {
            simulatingRef.current = false
          }
        }
        if (dueSteps > 0) renderer.setActivity(activityRef.current)
        if (!simulatingRef.current) {
          renderer.clearActivity()
          setSimulating(false)
        }
      }

      const aspect = canvas.width / canvas.height || 1
      const { yaw, pitch, distance } = camRef.current
      const eye = orbitEye(yaw, pitch, distance)
      const view = lookAt(eye, [0, 0.05, 0], [0, 1, 0])
      const proj = perspective((45 * Math.PI) / 180, aspect, 0.05, 20)
      const viewProj = multiply(proj, view)

      renderer.render({
        width: canvas.width,
        height: canvas.height,
        viewProj,
        colorMode: simulatingRef.current ? 2 : selectedType ? 1 : 0,
        regionColors: REGION_COLOR_LIST,
        pointSize: canvas.width > 900 ? 5.5 : 4.5,
        highlightColor: HIGHLIGHT_COLOR,
        showBackbone,
        backboneColor: BACKBONE_COLOR,
        backboneAlpha: 0.16,
        highlightEdgeColor: HIGHLIGHT_EDGE_COLOR,
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      renderer.dispose()
      rendererRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedType/showBackbone are read live via refs+closures each frame, not dep-driven re-inits
  }, [status])

  // Pure, synchronous: everything a selected type's readout needs except the
  // edge count is already sitting in somaState/typesState, so it's a
  // useMemo, not state-set-from-an-effect. Resolved through the same
  // normalization the search box uses, so an `initialType` prop (or any
  // other caller-supplied spelling/casing) works exactly like a chip click.
  const selection = useMemo<Selection | null>(() => {
    if (!selectedType || !somaState || !typesState) return null
    const idx = typesState.byNormalized.get(normalizeTypeQuery(selectedType))
    if (idx === undefined) return null
    const idxList: number[] = []
    let pre = 0
    let post = 0
    for (let i = 0; i < somaState.count; i++) {
      if (somaState.typeIndex[i] === idx) {
        idxList.push(i)
        pre += somaState.pre[i]
        post += somaState.post[i]
      }
    }
    return {
      canonicalName: typesState.names[idx],
      region: REGION_LABELS[typesState.region[idx]] ?? "other",
      count: idxList.length,
      pre,
      post,
      indices: new Uint32Array(idxList),
    }
  }, [selectedType, somaState, typesState])

  // The imperative half: push the highlight to the GPU, and fetch this
  // type's precomputed connections (genuinely async -- the one place
  // setState-from-a-callback is exactly the sanctioned pattern, since it's
  // reacting to an external fetch resolving, not synchronously mirroring
  // something already known at the top of the effect body).
  useEffect(() => {
    const soma = somaRef.current
    const renderer = rendererRef.current
    simulatingRef.current = false
    activityRef.current?.fill(0)
    renderer?.clearActivity()

    if (!selection || !soma) {
      renderer?.setHighlight(null)
      renderer?.clearHighlightEdges()
      return
    }

    renderer?.setHighlight(selection.indices)
    renderer?.clearHighlightEdges()

    let cancelled = false
    loadTypeConnectivity(selection.canonicalName).then((conn) => {
      if (cancelled) return
      const r = rendererRef.current
      if (conn && r) {
        r.setHighlightEdges(soma.positions, conn.edges.src, conn.edges.dst, conn.edges.weight)
        setEdgeInfo({ name: selection.canonicalName, edgeCount: conn.edges.count })
      } else {
        r?.clearHighlightEdges()
        setEdgeInfo({ name: selection.canonicalName, edgeCount: null })
      }
    })
    return () => {
      cancelled = true
    }
  }, [selection])

  const suggestions = useMemo(() => {
    if (!typesState || query.trim().length === 0) return []
    const key = normalizeTypeQuery(query)
    if (!key) return []
    const out: { name: string; count: number }[] = []
    for (let i = 1; i < typesState.names.length; i++) {
      if (typesState.normalizedNames[i].includes(key)) out.push({ name: typesState.names[i], count: typesState.counts[i] })
    }
    out.sort((a, b) => b.count - a.count)
    return out.slice(0, 8)
  }, [query, typesState])

  const selectType = useCallback((name: string) => {
    setSelectedType(name)
    setQuery("")
    setShowSuggestions(false)
    simulatingRef.current = false
    simTokenRef.current++ // invalidate any in-flight stimulate() safety-net timeout
    setSimulating(false)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedType(null)
    simulatingRef.current = false
    simTokenRef.current++
    setSimulating(false)
  }, [])

  const onPointerDown = useCallback((ev: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { x: ev.clientX, y: ev.clientY, yaw: camRef.current.yaw, pitch: camRef.current.pitch }
    autoRotateRef.current = false
    ev.currentTarget.setPointerCapture(ev.pointerId)
  }, [])
  const onPointerMove = useCallback((ev: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current
    if (!d) return
    camRef.current.yaw = d.yaw + (ev.clientX - d.x) * 0.006
    const nextPitch = d.pitch + (ev.clientY - d.y) * 0.006
    camRef.current.pitch = Math.min(1.35, Math.max(-1.35, nextPitch))
  }, [])
  const onPointerUp = useCallback(() => {
    dragRef.current = null
  }, [])
  const onWheel = useCallback((ev: React.WheelEvent<HTMLCanvasElement>) => {
    ev.preventDefault()
    const d = Math.min(MAX_DIST, Math.max(MIN_DIST, camRef.current.distance * (1 + ev.deltaY * 0.0012)))
    camRef.current.distance = d
    setZoom(d)
  }, [])

  const stimulate = useCallback(() => {
    const activity = activityRef.current
    if (!activity || !selection) return
    activity.fill(0)
    for (const i of selection.indices) activity[i] = 1
    simStepsRef.current = 0
    simStartRef.current = performance.now()
    simLastStepRef.current = performance.now()
    simulatingRef.current = true
    setSimulating(true)

    // Belt-and-suspenders: the render loop already stops the pulse on its own
    // (decay below threshold, step cap, or its own wall-clock cap -- see the
    // render effect), all paced by real elapsed time rather than frame count.
    // But requestAnimationFrame can legitimately stop firing altogether (a
    // backgrounded tab, or a GPU-less/software-rendered environment) and
    // that loop-driven stop would then never run. This timeout is independent
    // of rAF, so the UI can never read "spreading..." forever.
    const token = ++simTokenRef.current
    window.setTimeout(() => {
      if (simTokenRef.current !== token) return
      if (simulatingRef.current) {
        simulatingRef.current = false
        rendererRef.current?.clearActivity()
        setSimulating(false)
      }
    }, 7000)
  }, [selection])

  const edgeInfoMatches = selection != null && edgeInfo != null && edgeInfo.name === selection.canonicalName
  const edgesLoading = selection != null && !edgeInfoMatches
  const edgeCount = edgeInfoMatches ? (edgeInfo?.edgeCount ?? null) : null

  const poster = "/articles/fly-connectome-computing/poster.png"
  const staticCaption =
    caption ??
    "All 141,781 recovered somas of the male Drosophila central nervous system (FlyEM MaleCNS v1.0), coloured by region: central brain (orange), the two optic lobes (blue), and the ventral nerve cord (pink); neurons that bridge regions -- ascending/descending and visual-projection cells -- sit in a fourth grey \"other\" bucket rather than being forced into either side. The brain sits at top with its two bilateral optic lobes; the neck connective narrows below it into the thoracic and abdominal ganglia of the cord. Data: Janelia FlyEM Male CNS connectome v1.0, in collaboration with the Cambridge Drosophila Connectomics Group / MRC LMB and Google Connectomics, served via neuPrint. Licensed CC BY 4.0."

  return (
    <figure className={cn("my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">MaleCNS v1.0 -- 141,781 somas -- drag to orbit</span>
        <span className="font-mono text-[10px] text-muted-foreground">CC BY 4.0 -- Janelia FlyEM / neuPrint</span>
      </div>

      <div className="p-3 sm:p-4">
        <div
          ref={wrapRef}
          className="relative mx-auto aspect-[3/4] w-full max-w-[520px] overflow-hidden rounded-lg"
          style={{ background: "rgb(10,12,16)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static SSR/no-JS fallback + loading poster, not a Next/Image candidate (local asset, fixed size class handles layout) */}
          <img
            src={poster}
            alt="Static point-cloud render of the male fly CNS connectome: all recovered somas, coloured by brain region."
            className={cn("absolute inset-0 h-full w-full object-contain transition-opacity duration-300", mounted && status === "ready" && glOk ? "opacity-0" : "opacity-100")}
          />
          {mounted ? (
            <canvas
              ref={canvasRef}
              role="img"
              aria-label="Interactive 3D point cloud of the male fly central nervous system, orbitable, with somas coloured by region and a selected cell type highlighted on request."
              className={cn(
                "absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing",
                status === "ready" && glOk ? "opacity-100" : "opacity-0",
              )}
              style={{ transition: "opacity 300ms" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={onWheel}
            />
          ) : null}

          {mounted && status === "loading" ? (
            <div className="absolute inset-x-0 bottom-2 text-center font-mono text-[10px] text-white/70">loading soma positions…</div>
          ) : null}
          {mounted && status === "error" ? (
            <div className="absolute inset-x-2 bottom-2 rounded bg-black/60 p-2 text-center font-mono text-[10px] text-white/80">
              couldn&rsquo;t load the live view ({errorMsg}) -- showing the static render above.
            </div>
          ) : null}
          {mounted && status === "ready" && glOk === false ? (
            <div className="absolute inset-x-2 bottom-2 rounded bg-black/60 p-2 text-center font-mono text-[10px] text-white/80">
              this browser doesn&rsquo;t support WebGL2 -- showing the static render above.
            </div>
          ) : null}
        </div>

        {/* legend -- always in the DOM, describes the static image too */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] text-muted-foreground">
          {(["central brain", "optic lobe", "ventral nerve cord", "other / connecting"] as const).map((label, i) => (
            <span key={label} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: `rgb(${REGION_COLOR_LIST[i].map((c) => Math.round(c * 255)).join(",")})` }}
              />
              {label}
            </span>
          ))}
          <label className="ml-auto flex items-center gap-1.5">
            <input type="checkbox" checked={showBackbone} onChange={(e) => setShowBackbone(e.target.checked)} className="accent-foreground" />
            backbone edges (top ~1%, 231,761)
          </label>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-10 shrink-0 font-mono text-[10px] text-muted-foreground">zoom</span>
          <Range
            min={MIN_DIST}
            max={MAX_DIST}
            step={0.01}
            value={zoom}
            onChange={(e) => {
              const d = Number(e.target.value)
              camRef.current.distance = d
              setZoom(d)
            }}
            className="flex-1 cursor-pointer"
            aria-label="zoom (also: scroll/wheel on the canvas)"
          />
        </div>

        {/* search + notable-type chips */}
        <div className="relative mt-4">
          <div className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
            <MagnifyingGlassIcon size={13} className="shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions[0]) selectType(suggestions[0].name)
                if (e.key === "Escape") setShowSuggestions(false)
              }}
              placeholder="search any of 11,384 cell types (e.g. hDeltaH, DNp09, LC16)…"
              className="w-full min-w-0 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground/70"
              aria-label="search cell types"
            />
            {selectedType ? (
              <button
                type="button"
                onClick={clearSelection}
                className="shrink-0 cursor-pointer rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="clear selection"
              >
                <XIcon size={13} />
              </button>
            ) : null}
          </div>
          {showSuggestions && suggestions.length > 0 ? (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
              {suggestions.map((s) => (
                <li key={s.name}>
                  <button
                    type="button"
                    onClick={() => selectType(s.name)}
                    className="flex w-full cursor-pointer items-center justify-between px-2.5 py-1.5 text-left font-mono text-xs hover:bg-muted"
                  >
                    <span>{s.name}</span>
                    <span className="text-muted-foreground">{fmtInt(s.count)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {NOTABLE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => selectType(t)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                selectedType === t ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* readout */}
        {selection ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <Stat label="cell type" value={selection.canonicalName} />
              <Stat label="neurons" value={fmtInt(selection.count)} />
              <Stat label="output sites (pre)" value={fmtInt(selection.pre)} />
              <Stat label="input sites (post)" value={fmtInt(selection.post)} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
              <span>
                region: {selection.region}
                {edgesLoading
                  ? " · loading connections…"
                  : edgeCount != null
                    ? ` · ${fmtInt(edgeCount)} real synaptic edges drawn (highlight, this type's own wiring)`
                    : " · detailed connection lines aren't precomputed for this type -- showing highlight + counts only"}
              </span>
              <button
                type="button"
                disabled={simulating || edgesLoading}
                onClick={stimulate}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  simulating ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground disabled:opacity-50",
                )}
              >
                <LightningIcon size={11} />
                {simulating ? "spreading…" : "stimulate"}
              </button>
            </div>
            <p className="mt-1 font-mono text-[9px] text-muted-foreground/80">
              &ldquo;stimulate&rdquo; is an illustrative pulse over the thresholded backbone only (~1% of the real 25.6M-edge connectome) -- it
              shows reach through the shipped subgraph, not a biophysical simulation of the whole circuit.
            </p>
          </>
        ) : null}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">{staticCaption}</p>

        {reducedMotion ? (
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">reduced motion is on -- auto-orbit is off; drag still works.</p>
        ) : null}
      </div>
    </figure>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background px-2.5 py-1.5">
      <div className="font-mono text-[9px] text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-xs font-medium text-foreground">{value}</div>
    </div>
  )
}
