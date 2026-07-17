"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Intern-S2's vision-language pretraining paradigm, contrasted with the conventional
// document pipeline. A conventional stack runs a page through OCR → layout parsing →
// text tokens before the model ever sees it, and the figures, equations and spatial
// relationships are gone by the time the LLM reads it. Intern-S2 learns directly from
// the raw page: a vision encoder maps text, figures and equations into ONE shared
// representation, which feeds both a symbolic-semantics head and a visual-relations
// head — jointly, without intermediate parsing. Flip the pipeline. Illustrative.

const ACCENT = "oklch(0.62 0.14 165)"

// scene geometry (viewBox units)
const W = 740
const H = 282

function Node({
  x,
  y,
  w,
  h,
  line1,
  line2,
  accent,
  muted,
}: {
  x: number
  y: number
  w: number
  h: number
  line1: string
  line2?: string
  accent?: boolean
  muted?: boolean
}) {
  const cx = x + w / 2
  const cy = y + h / 2
  const stroke = accent ? ACCENT : "var(--border)"
  const fill = accent ? ACCENT : "var(--muted)"
  const fillOpacity = accent ? 0.14 : muted ? 0.3 : 0.5
  const textFill = accent ? ACCENT : muted ? "var(--muted-foreground)" : "var(--foreground)"
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={1.5} filter={muted ? undefined : "url(#vp-soft)"} />
      <text x={cx} y={line2 ? cy - 2 : cy + 3.5} textAnchor="middle" className="font-mono" fontSize={10.5} fontWeight={accent ? 600 : 500} fill={textFill}>{line1}</text>
      {line2 ? (
        <text x={cx} y={cy + 11} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--muted-foreground)">{line2}</text>
      ) : null}
    </g>
  )
}

// smooth horizontal S-curve between two points
const hcurve = (x1: number, y1: number, x2: number, y2: number) => {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

function Page({ dropVisual }: { dropVisual: boolean }) {
  // raw scientific page: text lines + a figure + an equation block
  const vis = dropVisual ? 0.25 : 1
  return (
    <g>
      <rect x={22} y={70} width={116} height={140} rx={8} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#vp-soft)" />
      <text x={80} y={64} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>raw page</text>
      {/* text lines */}
      {[86, 98, 110].map((ly) => (
        <rect key={ly} x={34} y={ly} width={92} height={5} rx={2} fill="var(--muted-foreground)" opacity={0.45} />
      ))}
      {/* figure block */}
      <g opacity={vis}>
        <rect x={34} y={128} width={44} height={34} rx={3} fill={ACCENT} fillOpacity={0.16} stroke={ACCENT} strokeWidth={1.2} />
        <path d="M 40 156 L 50 144 L 58 152 L 66 140 L 72 156 Z" fill={ACCENT} fillOpacity={0.5} />
      </g>
      {/* equation block */}
      <g opacity={vis}>
        <rect x={84} y={128} width={44} height={34} rx={3} fill="var(--muted)" fillOpacity={0.5} stroke="var(--border)" strokeWidth={1.2} />
        <text x={106} y={149} textAnchor="middle" className="fill-foreground font-mono" fontSize={12}>∑fₓ</text>
      </g>
      {/* remaining text lines */}
      {[174, 186, 198].map((ly) => (
        <rect key={ly} x={34} y={ly} width={92} height={5} rx={2} fill="var(--muted-foreground)" opacity={0.45} />
      ))}
      {dropVisual ? (
        <text x={80} y={149} textAnchor="middle" className="fill-destructive font-mono" fontSize={13} fontWeight={700}>✕</text>
      ) : null}
    </g>
  )
}

export function VisionPretrain() {
  const [mode, setMode] = useState<"intern" | "conventional">("intern")
  const intern = mode === "intern"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">learning from the raw page</span>
        <div className="flex gap-1">
          {[
            { v: "conventional" as const, label: "conventional pipeline" },
            { v: "intern" as const, label: "Intern-S2 direct" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setMode(o.v)}
              aria-pressed={mode === o.v}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                mode === o.v ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={mode === o.v ? { background: ACCENT } : undefined}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={
            intern
              ? "Intern-S2 maps a raw scientific page through a vision encoder into one shared representation that feeds both a symbolic-semantics head and a visual-relations head"
              : "A conventional pipeline runs the page through OCR, layout parsing and text tokens before a text LLM, discarding figures, equations and layout"
          }
        >
          <defs>
            <marker id="vp-arr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="vp-arr-m" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="vp-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          <Page dropVisual={!intern} />

          {intern ? (
            <>
              {/* connectors */}
              <path d={hcurve(138, 140, 196, 140)} fill="none" stroke={ACCENT} strokeWidth={1.5} markerEnd="url(#vp-arr)" opacity={0.85} />
              <path d={hcurve(320, 140, 356, 140)} fill="none" stroke={ACCENT} strokeWidth={1.5} markerEnd="url(#vp-arr)" opacity={0.85} />
              <path d={hcurve(512, 140, 548, 100)} fill="none" stroke={ACCENT} strokeWidth={1.5} markerEnd="url(#vp-arr)" opacity={0.85} />
              <path d={hcurve(512, 140, 548, 180)} fill="none" stroke={ACCENT} strokeWidth={1.5} markerEnd="url(#vp-arr)" opacity={0.85} />

              <text x={330} y={196} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>no intermediate parsing</text>

              <Node x={196} y={114} w={124} h={52} line1="InternViT" line2="vision encoder" />
              <Node x={356} y={114} w={156} h={52} line1="shared" line2="representation" accent />
              <Node x={548} y={78} w={156} h={44} line1="symbolic / text" line2="semantics" />
              <Node x={548} y={158} w={156} h={44} line1="visual relations" line2="layout & structure" />
            </>
          ) : (
            <>
              {/* connectors */}
              <path d={hcurve(138, 140, 158, 140)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#vp-arr-m)" opacity={0.7} />
              <path d={hcurve(268, 140, 288, 140)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#vp-arr-m)" opacity={0.7} />
              <path d={hcurve(398, 140, 418, 140)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#vp-arr-m)" opacity={0.7} />
              <path d={hcurve(528, 140, 548, 140)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#vp-arr-m)" opacity={0.7} />

              <Node x={158} y={120} w={110} h={40} line1="OCR" muted />
              <Node x={288} y={120} w={110} h={40} line1="layout parse" muted />
              <Node x={418} y={120} w={110} h={40} line1="text tokens" muted />
              <Node x={548} y={120} w={110} h={40} line1="text LLM" muted />

              <text x={80} y={228} textAnchor="middle" className="fill-destructive font-mono" fontSize={9}>figures · equations · layout</text>
              <text x={80} y={240} textAnchor="middle" className="fill-destructive font-mono" fontSize={9}>discarded before the model</text>
            </>
          )}
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {intern ? (
            <>
              Intern-S2 reads the page the way you do: text, a figure, and an equation are
              encoded together into <span style={{ color: ACCENT }}>one representation</span>,
              so the model can learn that <em>this</em> curve belongs to <em>that</em> caption and
              <em> that</em> variable. Symbolic semantics and visual relationships are modelled{" "}
              <span className="text-foreground">jointly</span>, in the same space.
            </>
          ) : (
            <>
              The conventional stack flattens a page to a string before the model sees it. OCR
              recovers the words; layout and figures and equations are{" "}
              <span className="text-foreground">dropped on the floor</span>. The text LLM never
              learns how a figure relates to the sentence that references it — because that
              relationship was thrown away in preprocessing.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
