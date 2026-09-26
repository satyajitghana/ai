"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { BEATS, CHAPTERS, DUR, FPS, HOLDS, LINES, SHOTS, WORDS } from "./timeline-data"

// The CodeRabbit music video on one time axis: the eight chapters, the 85 shot
// cuts, the 32 sung lines (and the five held notes), the 239 word onsets and the
// 301 tracked beats, with a playhead that moves one frame (1/24 s) at a time.
//
// The point it makes is the repo's own: nothing in the render knows about audio.
// A frame is drawn from the song time t = frame / 24 alone, every hit is looked up
// in the measured timing tables, and the song only meets the pictures at the
// final ffmpeg mux. So "in sync" is a property of the data, and this widget is
// that data.
//
// The helpers below are ports of src/core.js and src/timeline.js in the repo:
// cutF snaps a cut to the frame that contains it, beatAt interpolates the beat
// grid, and VLEAD is the "sync law" that makes every hit fire one frame early.
// Only exp is transcendental; it goes through lib/dmath so the SSR string and the
// browser string agree.

const ACCENT = "oklch(0.60 0.15 255)"
const CHORUS = "oklch(0.68 0.16 45)"
const BRIDGE = "oklch(0.58 0.19 27)"
const MUTED = "oklch(0.62 0.02 260)"
const GOOD = "oklch(0.58 0.14 155)"

const VLEAD = 1 / FPS
const LAST = Math.round(DUR * FPS) - 1 // render.mjs --frames=0:128.64 paints frames 0..3086

const cutF = (x: number) => Math.floor(x * FPS + 1e-6) / FPS
const frameOf = (x: number) => Math.floor(x * FPS + 1e-6)

const BEAT = (BEATS[BEATS.length - 1] - BEATS[0]) / (BEATS.length - 1)
function beatAt(t: number) {
  const n = BEATS.length
  if (t <= BEATS[0]) return (t - BEATS[0]) / BEAT
  if (t >= BEATS[n - 1]) return n - 1 + (t - BEATS[n - 1]) / BEAT
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1
    if (BEATS[m] <= t) lo = m
    else hi = m
  }
  return lo + (t - BEATS[lo]) / (BEATS[hi] - BEATS[lo])
}
const frac = (x: number) => x - Math.floor(x)

function shotIndex(t: number) {
  let i = 0
  while (i + 1 < SHOTS.length && t >= cutF(SHOTS[i + 1][0]) - 1e-6) i++
  return i
}

const sectionColour = (s: string) =>
  s.startsWith("chorus") || s === "final_chorus"
    ? CHORUS
    : s === "bridge"
      ? BRIDGE
      : s === "final_tag" || s === "outro_spoken"
        ? GOOD
        : ACCENT

const JUMPS: [string, number][] = [
  ["start", 0],
  ["chorus 1 downbeat", 32.09],
  ["bridge", 87.74],
  ["sung tag", 120.0],
]

const W = 640
const H = 124
const X0 = 60
const X1 = W - 8
const ROW = { ch: 6, shot: 32, vox: 58, word: 74, beat: 86, axis: 104 }

export function SongTimeline() {
  const [f, setF] = useState(Math.round(32.09 * FPS))
  const [zoom, setZoom] = useState(false)

  const t = f / FPS
  const lo = zoom ? Math.max(0, Math.min(DUR - 8, t - 4)) : 0
  const hi = zoom ? lo + 8 : DUR
  const x = (s: number) => X0 + ((s - lo) / (hi - lo)) * (X1 - X0)
  const inView = (a: number, b: number) => b >= lo && a <= hi
  const clampX = (s: number) => x(Math.max(lo, Math.min(hi, s)))

  const ci = CHAPTERS.findIndex(([, a, b]) => t >= cutF(a) - 1e-6 && t < cutF(b) - 1e-6)
  const chapter = CHAPTERS[ci < 0 ? CHAPTERS.length - 1 : ci]
  const si = shotIndex(t)
  const [s0, sName] = SHOTS[si]
  const s1 = si + 1 < SHOTS.length ? SHOTS[si + 1][0] : DUR
  const li = LINES.findIndex(([a, b]) => t >= a && t < b)
  const hold = HOLDS.find(([, a, b]) => t >= a && t < b)

  const b = beatAt(t)
  const pulse = mexp(-frac(beatAt(t + VLEAD)) * 6)
  const nb = BEATS.findIndex((bt) => frameOf(bt) > f)
  // The beat to explain: one that sounds inside this frame, else the next one.
  const here = BEATS.findIndex((bt) => frameOf(bt) === f)
  const shown = here >= 0 ? here : nb
  const beatT = shown < 0 ? null : BEATS[shown]
  // hit(t, [x]) fires once x - VLEAD <= t, i.e. from the first frame whose start is within 1/24 s before x
  const hitFrame = beatT === null ? null : Math.ceil((beatT - VLEAD) * FPS - 1e-6)
  const leadMs = beatT === null || hitFrame === null ? 0 : Math.round((beatT - hitFrame / FPS) * 1000)

  const go = (frame: number) => setF(Math.max(0, Math.min(LAST, frame)))
  const shotStart = (i: number) => Math.round(cutF(SHOTS[i][0]) * FPS)
  const prevShot = () => go(f > shotStart(si) ? shotStart(si) : si > 0 ? shotStart(si - 1) : 0)
  const nextShot = () => go(si + 1 < SHOTS.length ? shotStart(si + 1) : LAST)
  const prevBeat = () => {
    let j = -1
    for (let k = 0; k < BEATS.length; k++) if (frameOf(BEATS[k]) < f) j = k
    go(j < 0 ? 0 : frameOf(BEATS[j]))
  }
  const nextBeatGo = () => go(nb < 0 ? LAST : frameOf(BEATS[nb]))

  const ticks: number[] = []
  const step = zoom ? 1 : 10
  for (let s = Math.ceil(lo / step) * step; s <= hi + 1e-9; s += step) ticks.push(s)

  const btn = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
      active
        ? "border-foreground/30 bg-muted/50 text-foreground"
        : "border-border text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          CodeRabbit, Pause: 128.64 s, 24 fps, one time axis
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          timing data from the repo; lyrics omitted
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={btn(!zoom)} aria-pressed={!zoom} onClick={() => setZoom(false)}>
            whole song
          </button>
          <button type="button" className={btn(zoom)} aria-pressed={zoom} onClick={() => setZoom(true)}>
            8 s around the playhead
          </button>
          <span className="mx-1 hidden w-px bg-border sm:block" />
          {JUMPS.map(([label, at]) => (
            <button key={label} type="button" className={btn(false)} onClick={() => go(frameOf(at))}>
              {label}
            </button>
          ))}
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" className="w-full min-w-[520px]">
            <title>
              {`Frame ${f} at ${t.toFixed(3)} seconds: chapter ${chapter[0]}, shot ${si + 1} of ${SHOTS.length} (${sName}), ${
                li >= 0 ? `sung line ${li + 1} of ${LINES.length}` : hold ? `held note on "${hold[0]}"` : "no sung line"
              }, beat ${b.toFixed(2)}.`}
            </title>

            {[
              ["chapters", ROW.ch],
              ["shots", ROW.shot],
              ["vocal", ROW.vox],
              ["beats", ROW.beat],
            ].map(([label, y]) => (
              <text
                key={label}
                x={X0 - 8}
                y={(y as number) + 12}
                textAnchor="end"
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.55}
                fontFamily="ui-monospace, monospace"
              >
                {label}
              </text>
            ))}

            {CHAPTERS.map(([name, a, bEnd], i) =>
              inView(a, bEnd) ? (
                <g key={name}>
                  <rect
                    x={clampX(a)}
                    y={ROW.ch}
                    width={Math.max(0, clampX(bEnd) - clampX(a) - 1)}
                    height={18}
                    rx={3}
                    fill={i === ci ? ACCENT : MUTED}
                    fillOpacity={i === ci ? 0.28 : i % 2 ? 0.14 : 0.08}
                  />
                  {clampX(bEnd) - clampX(a) > 40 ? (
                    <text
                      x={clampX(a) + 5}
                      y={ROW.ch + 12.5}
                      fontSize={9}
                      fill="currentColor"
                      fillOpacity={i === ci ? 0.9 : 0.6}
                      fontFamily="ui-monospace, monospace"
                    >
                      {name}
                    </text>
                  ) : null}
                </g>
              ) : null,
            )}

            {inView(s0, s1) ? (
              <rect
                x={clampX(s0)}
                y={ROW.shot}
                width={Math.max(1.5, clampX(s1) - clampX(s0))}
                height={18}
                fill={ACCENT}
                fillOpacity={0.22}
              />
            ) : null}
            {SHOTS.map(([s], i) =>
              s >= lo && s <= hi ? (
                <line
                  key={i}
                  x1={x(s)}
                  x2={x(s)}
                  y1={ROW.shot}
                  y2={ROW.shot + 18}
                  stroke={i === si ? ACCENT : "currentColor"}
                  strokeOpacity={i === si ? 1 : 0.45}
                  strokeWidth={i === si ? 1.6 : 0.9}
                />
              ) : null,
            )}
            {zoom && inView(s0, s1) ? (
              <text
                x={Math.min(clampX(s0) + 4, X1 - 90)}
                y={ROW.shot + 12.5}
                fontSize={9}
                fill={ACCENT}
                fontFamily="ui-monospace, monospace"
              >
                {sName}
              </text>
            ) : null}

            {LINES.map(([a, bEnd, sec], i) =>
              inView(a, bEnd) ? (
                <rect
                  key={i}
                  x={clampX(a)}
                  y={ROW.vox}
                  width={Math.max(1, clampX(bEnd) - clampX(a))}
                  height={12}
                  rx={2}
                  fill={sectionColour(sec)}
                  fillOpacity={i === li ? 0.85 : 0.4}
                />
              ) : null,
            )}
            {HOLDS.map(([name, a, bEnd]) =>
              inView(a, bEnd) ? (
                <rect
                  key={`${name}-${a}`}
                  x={clampX(a)}
                  y={ROW.vox}
                  width={Math.max(1, clampX(bEnd) - clampX(a))}
                  height={12}
                  rx={2}
                  fill="none"
                  stroke={CHORUS}
                  strokeDasharray="2 2"
                  strokeOpacity={hold && hold[1] === a ? 1 : 0.6}
                />
              ) : null,
            )}
            {zoom
              ? WORDS.map((w, i) =>
                  w >= lo && w <= hi ? (
                    <line
                      key={i}
                      x1={x(w)}
                      x2={x(w)}
                      y1={ROW.word}
                      y2={ROW.word + 6}
                      stroke="currentColor"
                      strokeOpacity={0.6}
                      strokeWidth={0.9}
                    />
                  ) : null,
                )
              : null}

            {BEATS.map((bt, i) =>
              bt >= lo && bt <= hi ? (
                <line
                  key={i}
                  x1={x(bt)}
                  x2={x(bt)}
                  y1={i % 4 === 0 ? ROW.beat : ROW.beat + 5}
                  y2={ROW.beat + 12}
                  stroke={i === nb ? GOOD : "currentColor"}
                  strokeOpacity={i === nb ? 1 : i % 4 === 0 ? 0.55 : 0.28}
                  strokeWidth={i === nb ? 1.6 : 0.8}
                />
              ) : null,
            )}

            <line x1={X0} x2={X1} y1={ROW.axis} y2={ROW.axis} stroke="currentColor" strokeOpacity={0.3} />
            {ticks.map((s) => (
              <g key={s}>
                <line x1={x(s)} x2={x(s)} y1={ROW.axis} y2={ROW.axis + 4} stroke="currentColor" strokeOpacity={0.4} />
                <text
                  x={x(s)}
                  y={ROW.axis + 14}
                  textAnchor="middle"
                  fontSize={8.5}
                  fill="currentColor"
                  fillOpacity={0.55}
                  fontFamily="ui-monospace, monospace"
                >
                  {`${s}s`}
                </text>
              </g>
            ))}

            <line x1={x(t)} x2={x(t)} y1={2} y2={ROW.axis} stroke={BRIDGE} strokeWidth={1.4} />
          </svg>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-12 shrink-0 font-mono text-[10px] text-muted-foreground">frame</span>
          <Range
            min={0}
            max={LAST}
            step={1}
            value={f}
            onChange={(e) => go(Number(e.target.value))}
            className="flex-1"
            aria-label="Playhead, one step per frame at 24 frames per second"
            accent={BRIDGE}
          />
          <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{f}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" className={btn(false)} onClick={prevShot}>
            prev cut
          </button>
          <button type="button" className={btn(false)} onClick={nextShot}>
            next cut
          </button>
          <button type="button" className={btn(false)} onClick={prevBeat}>
            prev beat
          </button>
          <button type="button" className={btn(false)} onClick={nextBeatGo}>
            next beat
          </button>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[10px] sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">song time</dt>
            <dd className="tabular-nums text-foreground">
              {t.toFixed(3)} s, frame {f}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">shot</dt>
            <dd className="tabular-nums text-foreground">
              {si + 1}/{SHOTS.length} <span style={{ color: ACCENT }}>{sName}</span>, {Math.max(0, t - s0).toFixed(2)} of{" "}
              {(s1 - s0).toFixed(2)} s
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">vocal</dt>
            <dd className="text-foreground">
              {li >= 0 ? (
                <>
                  line {li + 1}/{LINES.length}, {LINES[li][2]}
                </>
              ) : hold ? (
                <>held &ldquo;{hold[0]}&rdquo;</>
              ) : (
                "no sung line"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">beat, pulse()</dt>
            <dd className="tabular-nums text-foreground">
              {b.toFixed(2)}, {pulse.toFixed(2)}
            </dd>
          </div>
        </dl>
        {beatT !== null && hitFrame !== null ? (
          <div className="mt-2 font-mono text-[10px] text-muted-foreground">
            {here >= 0 ? "this frame holds" : "next is"} beat {shown}, sounding at {beatT.toFixed(3)} s. A hit on it is
            drawn from frame <span style={{ color: GOOD }}>{hitFrame}</span>, which starts{" "}
            <span style={{ color: GOOD }}>{leadMs} ms</span> before the sound: the picture leads by 0 to 42 ms and
            never trails.
          </div>
        ) : null}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Every row here is a table in the repository, and none of them is audio. The renderer asks for frame{" "}
          <span className="text-foreground">n</span>, computes t = n / 24 and paints whatever the shot registered for
          that time. A chorus cut is a number in a chapter file, a lyric&rsquo;s letters appear from a word onset
          measured on the separated vocal, and a flash on a beat reads the tracked beat list. The song joins only at
          the end, when ffmpeg muxes 3,087 JPEGs with the mp3. Start at the chorus 1 downbeat and step
          cut by cut: 11 of that chorus&rsquo;s 14 cuts sit within 50 ms of a tracked beat or a measured word onset.
          That is the only way a mux that knows nothing about the picture comes out in sync.
        </p>
      </div>
    </figure>
  )
}
