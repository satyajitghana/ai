// The browser half of <LiveMath />: everything that calls pmndrs/math 0.1.0
// (the npm package `math`, pinned) and everything that draws. Nothing here runs
// during SSR. The component creates an engine from an effect, after hydration,
// so no number the library computes can reach server markup.
//
// Imports are from the subpath entrypoints, never the root: `math` re-exports
// every module as a namespace, and a bundler that cannot split a namespace
// keeps all of it (the article measures this).

import { fabrik2 } from "math/ik"
import { fbm, simplex2d } from "math/noise"

type V2 = [number, number]

export type Readouts = {
  status: HTMLElement
  solveNow: HTMLElement
  solveMean: HTMLElement
  solveLeft: HTMLElement
  build: HTMLElement
  terrainNow: HTMLElement
  terrainCalls: HTMLElement
  arm: HTMLElement
  map: HTMLElement
}

export type Engine = {
  setTerrain(seed: number, octaves: number): void
  setChain(limits: boolean): void
  setReduced(reduced: boolean): void
  destroy(): void
}

// World: the arm panel and the map share one x axis, 0..8 units wide, 4:3.
const WX = 8
const WY = 6
const FREQ = 0.32
const ROW = 3 // the map row the arm panel slices through
const PROFILE = 161 // points along the slice
const GW = 128 // map grid
const GH = 96
const BONES = 6
const BONE = 0.8
const BASE: V2 = [4, 4.85]
const LIMIT = 0.7 // radians either side of the previous bone, when limits are on
const ACCENT = "oklch(0.62 0.16 45)"
const IDLE_MS = 4000 // auto-sweep resumes this long after the last interaction

const fmtUs = (ms: number) => (ms <= 0 ? "below timer resolution" : ms < 1 ? `${(ms * 1000).toFixed(0)} µs` : `${ms.toFixed(2)} ms`)
const grouped = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")

// height ramp for the map, low to high
const STOPS: [number, number, number, number][] = [
  [-1, 34, 72, 96],
  [-0.15, 64, 118, 112],
  [0.2, 128, 150, 96],
  [0.55, 186, 162, 118],
  [1, 242, 236, 224],
]
function ramp(h: number, out: number[]): void {
  let i = 0
  while (i < STOPS.length - 2 && h > STOPS[i + 1][0]) i++
  const a = STOPS[i]
  const b = STOPS[i + 1]
  const t = Math.min(1, Math.max(0, (h - a[0]) / (b[0] - a[0])))
  out[0] = a[1] + (b[1] - a[1]) * t
  out[1] = a[2] + (b[2] - a[2]) * t
  out[2] = a[3] + (b[3] - a[3]) * t
}

export function createEngine(root: HTMLElement, armCanvas: HTMLCanvasElement, mapCanvas: HTMLCanvasElement, r: Readouts): Engine {
  const armCtx = armCanvas.getContext("2d")
  const mapCtx = mapCanvas.getContext("2d")
  const offscreen = document.createElement("canvas")
  offscreen.width = GW
  offscreen.height = GH
  const offCtx = offscreen.getContext("2d")
  const image = offCtx ? offCtx.createImageData(GW, GH) : null

  // terrain state, rebuilt by setTerrain
  let gen = simplex2d.create(1)
  let octaves = 5
  let sx = 0
  let sy = 0
  // one sampler for every fbm call: it reads the point from sx, sy instead of
  // closing over it, so a rebuild allocates one closure, not one per sample
  const octave = (f: number) => simplex2d.sample(gen, sx * f * FREQ, sy * f * FREQ)
  const heights = new Float64Array(GW * GH)
  const profile = new Float64Array(PROFILE)
  const rgb = [0, 0, 0]

  const height = (x: number, y: number) => {
    sx = x
    sy = y
    return fbm(octave, octaves, 2, 0.5)
  }
  const ground = (x: number) => 1.5 + 1.2 * height(x, ROW)

  // arm state, rebuilt by setChain
  let chain = fabrik2.createChain2()
  const target: V2 = [5.6, 0]
  let lift = 0
  let lastInteract = -Infinity
  let pointerDown = false
  let reduced = true
  let visible = false
  let raf = 0
  let t0 = 0
  let frame = 0
  const times = new Float64Array(120)
  let timesN = 0

  let fg = "#111"
  let muted = "#888"
  let border = "#ccc"
  let bg = "#fff"
  const readColors = () => {
    const cs = getComputedStyle(root)
    fg = cs.getPropertyValue("--foreground").trim() || fg
    muted = cs.getPropertyValue("--muted-foreground").trim() || muted
    border = cs.getPropertyValue("--border").trim() || border
    bg = cs.getPropertyValue("--background").trim() || bg
  }

  const sizeCanvas = (c: HTMLCanvasElement) => {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = Math.max(1, Math.round(c.clientWidth * dpr))
    const h = Math.max(1, Math.round((c.clientWidth * dpr * 3) / 4))
    if (c.width !== w || c.height !== h) {
      c.width = w
      c.height = h
    }
  }

  function drawMap() {
    if (!mapCtx || !offCtx) return
    const w = mapCanvas.width
    const h = mapCanvas.height
    mapCtx.imageSmoothingEnabled = true
    mapCtx.drawImage(offscreen, 0, 0, w, h)
    // the slice the arm panel shows
    const yRow = (ROW / WY) * h
    mapCtx.setLineDash([6, 5])
    mapCtx.strokeStyle = "rgba(255,255,255,0.9)"
    mapCtx.lineWidth = Math.max(1, w / 320)
    mapCtx.beginPath()
    mapCtx.moveTo(0, yRow)
    mapCtx.lineTo(w, yRow)
    mapCtx.stroke()
    mapCtx.setLineDash([])
    // where the hand is, projected onto the slice
    const hx = (target[0] / WX) * w
    mapCtx.fillStyle = ACCENT
    mapCtx.strokeStyle = "rgba(255,255,255,0.95)"
    mapCtx.beginPath()
    mapCtx.arc(hx, yRow, Math.max(4, w / 70), 0, Math.PI * 2)
    mapCtx.fill()
    mapCtx.stroke()
  }

  function drawArm() {
    if (!armCtx) return
    const w = armCanvas.width
    const h = armCanvas.height
    const s = w / WX
    const X = (x: number) => x * s
    const Y = (y: number) => h - y * s
    armCtx.clearRect(0, 0, w, h)

    // ground: the same noise, sampled along the map's marked row
    armCtx.beginPath()
    armCtx.moveTo(0, h)
    for (let i = 0; i < PROFILE; i++) armCtx.lineTo(X((i / (PROFILE - 1)) * WX), Y(profile[i]))
    armCtx.lineTo(w, h)
    armCtx.closePath()
    armCtx.globalAlpha = 0.14
    armCtx.fillStyle = fg
    armCtx.fill()
    armCtx.globalAlpha = 0.7
    armCtx.strokeStyle = fg
    armCtx.lineWidth = Math.max(1, w / 360)
    armCtx.beginPath()
    for (let i = 0; i < PROFILE; i++) {
      const px = X((i / (PROFILE - 1)) * WX)
      const py = Y(profile[i])
      if (i === 0) armCtx.moveTo(px, py)
      else armCtx.lineTo(px, py)
    }
    armCtx.stroke()
    armCtx.globalAlpha = 1

    // reach
    armCtx.setLineDash([5, 5])
    armCtx.strokeStyle = border
    armCtx.lineWidth = Math.max(1, w / 480)
    armCtx.beginPath()
    armCtx.arc(X(BASE[0]), Y(BASE[1]), chain.length * s, 0, Math.PI * 2)
    armCtx.stroke()
    armCtx.setLineDash([])

    // the chain, straight from the library's own bone records
    const bones = chain.bones
    armCtx.strokeStyle = ACCENT
    armCtx.lineCap = "round"
    armCtx.lineJoin = "round"
    armCtx.lineWidth = Math.max(4, w / 60)
    armCtx.beginPath()
    for (let i = 0; i < bones.length; i++) {
      const b = bones[i]
      if (i === 0) armCtx.moveTo(X(b.start[0]), Y(b.start[1]))
      armCtx.lineTo(X(b.end[0]), Y(b.end[1]))
    }
    armCtx.stroke()
    const jr = Math.max(3, w / 110)
    for (let i = 0; i < bones.length; i++) {
      const e = bones[i].end
      armCtx.beginPath()
      armCtx.arc(X(e[0]), Y(e[1]), jr, 0, Math.PI * 2)
      armCtx.fillStyle = bg
      armCtx.fill()
      armCtx.strokeStyle = fg
      armCtx.lineWidth = Math.max(1, w / 400)
      armCtx.stroke()
    }
    armCtx.fillStyle = fg
    armCtx.fillRect(X(BASE[0]) - jr * 1.6, Y(BASE[1]) - jr * 1.6, jr * 3.2, jr * 3.2)

    // target
    const tx = X(target[0])
    const ty = Y(target[1])
    const tr = Math.max(8, w / 40)
    armCtx.strokeStyle = ACCENT
    armCtx.lineWidth = Math.max(1.5, w / 320)
    armCtx.beginPath()
    armCtx.arc(tx, ty, tr * 0.6, 0, Math.PI * 2)
    armCtx.moveTo(tx - tr, ty)
    armCtx.lineTo(tx + tr, ty)
    armCtx.moveTo(tx, ty - tr)
    armCtx.lineTo(tx, ty + tr)
    armCtx.stroke()

    armCtx.fillStyle = muted
    armCtx.font = `${Math.round(Math.max(11, w / 44))}px ui-monospace, monospace`
    armCtx.fillText("slice of the map, row y = 3", 8, h - 8)
  }

  // one frame of work: place the target, solve, draw, report
  function step(now: number, auto: boolean) {
    if (auto) {
      const t = (now - t0) / 1000
      target[0] = 4 + 3.3 * Math.sin(t * 0.45)
      lift = 0.25 + 0.25 * Math.sin(t * 1.3)
    }
    target[0] = Math.min(WX - 0.05, Math.max(0.05, target[0]))
    target[1] = ground(target[0]) + Math.max(0, lift)

    const a = performance.now()
    const left = fabrik2.solve(chain, target)
    const ms = performance.now() - a

    times[timesN % times.length] = ms
    timesN++
    drawArm()
    drawMap()

    // text a few times a second, so it can be read
    if (frame++ % 8 === 0 || reduced) {
      const n = Math.min(timesN, times.length)
      let sum = 0
      for (let i = 0; i < n; i++) sum += times[i]
      r.solveNow.textContent = fmtUs(ms)
      r.solveMean.textContent = `${fmtUs(sum / n)} over ${n} frame${n === 1 ? "" : "s"}`
      r.solveLeft.textContent = Number.isFinite(left) ? left.toFixed(4) : "no bones"
    }
  }

  const tick = (now: number) => {
    raf = 0
    if (!visible || reduced) return
    step(now, now - lastInteract > IDLE_MS)
    raf = requestAnimationFrame(tick)
  }
  const updateStatus = () => {
    r.status.textContent = reduced
      ? "reduced motion: the arm moves only when you move the target"
      : visible
        ? "running: fabrik2.solve once per animation frame"
        : "paused while off screen"
  }
  const start = () => {
    updateStatus()
    if (!raf && visible && !reduced) raf = requestAnimationFrame(tick)
  }
  const stop = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    updateStatus()
  }
  const redraw = () => step(performance.now(), false)

  // input: pointer follows on hover and drag, keys move the target
  const fromPointer = (ev: PointerEvent) => {
    const rect = armCanvas.getBoundingClientRect()
    const x = ((ev.clientX - rect.left) / rect.width) * WX
    const y = WY - ((ev.clientY - rect.top) / rect.width) * WX
    target[0] = x
    lift = y - ground(Math.min(WX - 0.05, Math.max(0.05, x)))
    lastInteract = performance.now()
    if (reduced) redraw()
  }
  const onDown = (ev: PointerEvent) => {
    pointerDown = true
    armCanvas.setPointerCapture(ev.pointerId)
    fromPointer(ev)
  }
  const onMove = (ev: PointerEvent) => {
    if (pointerDown || ev.pointerType === "mouse") fromPointer(ev)
  }
  const onUp = () => {
    pointerDown = false
  }
  const onKey = (ev: KeyboardEvent) => {
    const d = ev.shiftKey ? 0.5 : 0.1
    if (ev.key === "ArrowLeft") target[0] -= d
    else if (ev.key === "ArrowRight") target[0] += d
    else if (ev.key === "ArrowUp") lift += d
    else if (ev.key === "ArrowDown") lift = Math.max(0, lift - d)
    else return
    ev.preventDefault()
    lastInteract = performance.now()
    redraw()
  }
  armCanvas.addEventListener("pointerdown", onDown)
  armCanvas.addEventListener("pointermove", onMove)
  armCanvas.addEventListener("pointerup", onUp)
  armCanvas.addEventListener("pointercancel", onUp)
  armCanvas.addEventListener("keydown", onKey)

  const resize = new ResizeObserver(() => {
    sizeCanvas(armCanvas)
    sizeCanvas(mapCanvas)
    redraw()
  })
  resize.observe(armCanvas)
  resize.observe(mapCanvas)

  const seen = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting)
    if (visible) start()
    else stop()
  })
  seen.observe(root)

  // theme switches change the CSS variables the arm is drawn with
  const theme = new MutationObserver(() => {
    readColors()
    redraw()
  })
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] })

  readColors()
  sizeCanvas(armCanvas)
  sizeCanvas(mapCanvas)
  t0 = performance.now()

  return {
    setTerrain(seed: number, oct: number) {
      const a = performance.now()
      gen = simplex2d.create(seed)
      octaves = oct
      for (let j = 0; j < GH; j++) {
        const y = ((j + 0.5) / GH) * WY
        for (let i = 0; i < GW; i++) heights[j * GW + i] = height(((i + 0.5) / GW) * WX, y)
      }
      for (let i = 0; i < PROFILE; i++) profile[i] = ground((i / (PROFILE - 1)) * WX)
      const ms = performance.now() - a

      // shade the map: central-difference normals, as the article derives them
      if (image) {
        const d = image.data
        const dx = WX / GW
        const amp = 1.2 // the same vertical scale the slice uses
        for (let j = 0; j < GH; j++) {
          for (let i = 0; i < GW; i++) {
            const k = j * GW + i
            const hL = heights[j * GW + Math.max(i - 1, 0)] * amp
            const hR = heights[j * GW + Math.min(i + 1, GW - 1)] * amp
            const hD = heights[Math.max(j - 1, 0) * GW + i] * amp
            const hU = heights[Math.min(j + 1, GH - 1) * GW + i] * amp
            const nx = hL - hR
            const ny = 2 * dx
            const nz = hD - hU
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
            // light from the upper left
            const lit = Math.max(0, (-0.55 * nx + 0.7 * ny - 0.45 * nz) / len)
            const shade = 0.45 + 0.75 * lit
            ramp(heights[k], rgb)
            d[k * 4] = Math.min(255, rgb[0] * shade)
            d[k * 4 + 1] = Math.min(255, rgb[1] * shade)
            d[k * 4 + 2] = Math.min(255, rgb[2] * shade)
            d[k * 4 + 3] = 255
          }
        }
        offCtx?.putImageData(image, 0, 0)
      }

      const samples = (GW * GH + PROFILE) * oct
      r.terrainNow.textContent = fmtUs(ms)
      r.terrainCalls.textContent = `${grouped(GW * GH + PROFILE)} fbm calls, ${grouped(samples)} simplex2d.sample calls`
      r.map.textContent = `Heightfield from simplex2d, seed ${seed}, ${oct} octave${oct === 1 ? "" : "s"}, shaded by its own central-difference normals; the dashed row is the slice on the left.`
      redraw()
    },
    setChain(limits: boolean) {
      const c = fabrik2.createChain2()
      fabrik2.addBone(c, BASE, [BASE[0], BASE[1] - BONE])
      // a hair off straight: a dead-straight chain is FABRIK's worst start
      const len = Math.sqrt(0.06 * 0.06 + 1)
      const dir: V2 = [0.06 / len, -1 / len]
      for (let i = 1; i < BONES; i++) {
        fabrik2.addConsecutiveBone(c, dir, BONE, limits ? fabrik2.setLocalJoint(fabrik2.createJoint2(), LIMIT, LIMIT) : undefined)
      }
      chain = c
      r.build.textContent = limits
        ? "fabrik2.createChain2, addBone, addConsecutiveBone × 5, setLocalJoint × 5 (±40°)"
        : "fabrik2.createChain2, addBone, addConsecutiveBone × 5 (free joints)"
      r.arm.textContent = `A ${BONES}-bone chain solved by fabrik2.solve, reaching for a target that sits on the terrain slice${limits ? ", each joint held within 40 degrees of the bone before it" : ""}.`
      redraw()
    },
    setReduced(value: boolean) {
      reduced = value
      if (reduced) {
        stop()
        redraw()
      } else {
        start()
      }
    },
    destroy() {
      stop()
      resize.disconnect()
      seen.disconnect()
      theme.disconnect()
      armCanvas.removeEventListener("pointerdown", onDown)
      armCanvas.removeEventListener("pointermove", onMove)
      armCanvas.removeEventListener("pointerup", onUp)
      armCanvas.removeEventListener("pointercancel", onUp)
      armCanvas.removeEventListener("keydown", onKey)
    },
  }
}
