"use client";

import { useState } from "react";

const ACCENT = "oklch(0.58 0.15 265)";

type Stage = "attention" | "attn-res" | "moe";

const STAGES: { id: Stage; label: string }[] = [
  { id: "attention", label: "attention" },
  { id: "attn-res", label: "attn-res" },
  { id: "moe", label: "moe" },
];

const ANNOTATIONS: Record<Stage, string> = {
  attention: "KDA: gated delta-rule linear attention · 1M context",
  "attn-res": "AttnRes: selective cross-depth retrieval · ~25% train eff.",
  moe: "Stable LatentMoE · quantile balancing · 16 / 896 active",
};

// vertical S-curve between two points
function sCurve(x1: number, y1: number, x2: number, y2: number): string {
  const my = (y1 + y2) / 2;
  return "M " + x1 + " " + y1 + " C " + x1 + " " + my + ", " + x2 + " " + my + ", " + x2 + " " + y2;
}

// horizontal-ish curve (for side arrows reaching back)
function hCurve(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  return "M " + x1 + " " + y1 + " C " + mx + " " + y1 + ", " + mx + " " + y2 + ", " + x2 + " " + y2;
}

// expert grid geometry
const GRID_X = 130;
const GRID_Y = 110;
const COLS = 18;
const ROWS = 4;
const COL_STEP = 210 / (COLS - 1);
const ROW_STEP = 19;

function expertPos(i: number): { x: number; y: number } {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return { x: GRID_X + col * COL_STEP, y: GRID_Y + row * ROW_STEP };
}

const ACTIVE_EXPERTS = new Set<number>([
  3, 7, 11, 15, 20, 25, 29, 33, 38, 42, 47, 51, 55, 60, 64, 69,
]);
const FAN_TO = [7, 20, 33, 47, 64];
const EXPERT_TOTAL = ROWS * COLS;

export function K3Architecture() {
  const [stage, setStage] = useState<Stage>("attention");

  const emph = (s: Stage): { opacity: number; stroke: string; filter: string } => ({
    opacity: stage === s ? 1 : 0.4,
    stroke: stage === s ? ACCENT : "var(--border)",
    filter: stage === s ? "url(#k3shadow)" : "none",
  });

  const att = emph("attention");
  const res = emph("attn-res");
  const moe = emph("moe");

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        <span>kimi-k3 · transformer block</span>
        <span>2.8T-A50B · 1M ctx</span>
      </div>

      <div className="px-3 pt-3">
        <svg
          viewBox="0 0 380 540"
          className="w-full"
          role="img"
          aria-label="Master architecture diagram of one Kimi K3 transformer block: a token hidden state flows up through the Gated MLA plus Kimi Delta Attention sublayer, Attention Residuals that retrieve from earlier depths, and the Stable LatentMoE router lighting 16 of 896 experts."
        >
          <defs>
            <filter id="k3shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
            <marker
              id="k3arrow"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 1 1 L 8 5 L 1 9" fill="none" stroke={ACCENT} strokeWidth="1.5" />
            </marker>
            <marker
              id="k3arrowmuted"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path
                d="M 1 1 L 8 5 L 1 9"
                fill="none"
                stroke="var(--muted-foreground)"
                strokeWidth="1.5"
              />
            </marker>
          </defs>

          {/* ===== main vertical connectors ===== */}
          <path
            d={sCurve(235, 475, 235, 457)}
            fill="none"
            strokeWidth={1.5}
            stroke="var(--muted-foreground)"
            markerEnd="url(#k3arrowmuted)"
          />
          <path
            d={sCurve(235, 345, 235, 307)}
            fill="none"
            strokeWidth={1.5}
            stroke="var(--muted-foreground)"
            markerEnd="url(#k3arrowmuted)"
          />
          <path
            d={sCurve(235, 273, 235, 230)}
            fill="none"
            strokeWidth={1.5}
            stroke="var(--muted-foreground)"
            markerEnd="url(#k3arrowmuted)"
          />
          <path
            d={sCurve(235, 78, 235, 62)}
            fill="none"
            strokeWidth={1.5}
            stroke="var(--muted-foreground)"
            markerEnd="url(#k3arrowmuted)"
          />

          {/* ===== output pill ===== */}
          <rect x="155" y="30" width="160" height="30" rx="10" fill="var(--muted)" stroke="var(--border)" strokeWidth={1.5} />
          <text x="235" y="49" textAnchor="middle" className="fill-foreground font-mono" fontSize="10">
            hidden state out
          </text>

          {/* ===== MoE sublayer ===== */}
          <g opacity={moe.opacity}>
            <rect
              x="118"
              y="78"
              width="234"
              height="152"
              rx="12"
              fill="var(--background)"
              stroke={moe.stroke}
              strokeWidth={1.5}
              filter={moe.filter}
            />
            <text x="235" y="96" textAnchor="middle" className="fill-foreground font-mono" fontSize="11">
              Stable LatentMoE
            </text>

            {/* expert field */}
            {Array.from({ length: EXPERT_TOTAL }, (_, i) => {
              const p = expertPos(i);
              const on = ACTIVE_EXPERTS.has(i);
              return (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={on ? 3 : 2.4}
                  fill={on ? ACCENT : "var(--muted-foreground)"}
                  fillOpacity={on ? 1 : 0.3}
                />
              );
            })}

            <text x="235" y="192" textAnchor="middle" className="fill-muted-foreground font-mono" fontSize="9">
              16 / 896 active (1.8%)
            </text>

            {/* router */}
            <rect x="177" y="200" width="116" height="24" rx="8" fill="var(--muted)" stroke={moe.stroke} strokeWidth={1.5} />
            <text x="235" y="216" textAnchor="middle" className="fill-foreground font-mono" fontSize="10">
              router
            </text>

            {/* token fan to lit experts */}
            {FAN_TO.map((i) => {
              const p = expertPos(i);
              return (
                <path
                  key={"fan-" + i}
                  d={sCurve(235, 200, p.x, p.y + 4)}
                  fill="none"
                  strokeWidth={1.5}
                  stroke={ACCENT}
                  strokeOpacity={stage === "moe" ? 0.8 : 0.45}
                />
              );
            })}
          </g>

          {/* ===== Attention Residuals ===== */}
          <g opacity={res.opacity}>
            {/* earlier-depth nodes on the side */}
            {[
              { y: 300, label: "L−1" },
              { y: 352, label: "L−2" },
              { y: 404, label: "L−3" },
            ].map((n) => (
              <g key={n.label}>
                <rect x="16" y={n.y - 11} width="54" height="22" rx="6" fill="var(--muted)" stroke="var(--border)" strokeWidth={1.5} />
                <text x="43" y={n.y + 4} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize="9">
                  {n.label}
                </text>
                <path
                  d={hCurve(70, n.y, 159, 290)}
                  fill="none"
                  strokeWidth={1.5}
                  stroke={stage === "attn-res" ? ACCENT : "var(--muted-foreground)"}
                  strokeOpacity={stage === "attn-res" ? 0.85 : 0.4}
                  markerEnd={stage === "attn-res" ? "url(#k3arrow)" : "url(#k3arrowmuted)"}
                />
              </g>
            ))}

            <rect
              x="157"
              y="275"
              width="156"
              height="30"
              rx="10"
              fill="var(--background)"
              stroke={res.stroke}
              strokeWidth={1.5}
              filter={res.filter}
            />
            <text x="235" y="294" textAnchor="middle" className="fill-foreground font-mono" fontSize="10">
              Attention Residuals
            </text>
          </g>

          {/* ===== Attention sublayer ===== */}
          <g opacity={att.opacity}>
            <rect
              x="118"
              y="345"
              width="234"
              height="112"
              rx="12"
              fill="var(--background)"
              stroke={att.stroke}
              strokeWidth={1.5}
              filter={att.filter}
            />
            <text x="235" y="365" textAnchor="middle" className="fill-foreground font-mono" fontSize="11">
              attention sublayer
            </text>

            <rect x="132" y="378" width="96" height="38" rx="8" fill="var(--muted)" stroke={att.stroke} strokeWidth={1.5} />
            <text x="180" y="401" textAnchor="middle" className="fill-foreground font-mono" fontSize="10">
              Gated MLA
            </text>

            <rect x="242" y="378" width="96" height="38" rx="8" fill="var(--muted)" stroke={att.stroke} strokeWidth={1.5} fillOpacity={0.6} />
            <text x="290" y="401" textAnchor="middle" className="fill-foreground font-mono" fontSize="10">
              KDA
            </text>

            <text x="235" y="440" textAnchor="middle" className="fill-muted-foreground font-mono" fontSize="9">
              gated delta-rule · linear attn · const state
            </text>
          </g>

          {/* ===== input pill ===== */}
          <rect x="150" y="475" width="170" height="30" rx="10" fill="var(--muted)" stroke="var(--border)" strokeWidth={1.5} />
          <text x="235" y="494" textAnchor="middle" className="fill-foreground font-mono" fontSize="10">
            token hidden state in
          </text>

          {/* active-stage annotation */}
          <text x="190" y="528" textAnchor="middle" className="fill-muted-foreground font-mono" fontSize="8">
            {ANNOTATIONS[stage]}
          </text>
        </svg>
      </div>

      {/* ===== controls ===== */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-1 pt-2">
        <div className="inline-flex rounded-lg border p-0.5">
          {STAGES.map((s) => {
            const active = stage === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStage(s.id)}
                className={
                  "rounded-md px-3 py-1 font-mono text-xs transition-colors " +
                  (active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground")
                }
                aria-pressed={active}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          stage=<span className="text-foreground">{stage}</span>
        </span>
      </div>

      <p className="px-4 pb-4 pt-1 text-sm leading-6 text-muted-foreground">
        One K3 block, bottom-to-top. The hidden state enters the attention sublayer
        (Gated MLA + KDA linear attention), Attention Residuals selectively pull from
        earlier depths, then Stable LatentMoE routes the token to just 16 of 896 experts
        (1.8%) before the block outputs. Scrub the stages to isolate each mechanism.
      </p>
    </figure>
  );
}
