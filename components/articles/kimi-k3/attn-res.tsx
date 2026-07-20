"use client";

import { useState } from "react";
import { Range } from "@/components/articles/ui/range"

const ACCENT = "oklch(0.58 0.15 265)";

type Mode = "uniform" | "attnres";

const L = 8;
const LAYERS: number[] = Array.from({ length: L }, (_, i) => i + 1); // 1..8

// svg geometry
const NODE_X = 150;
const NODE_W = 150;
const NODE_H = 34;
const TOP = 42;
const GAP = 56;
const RIGHT_EDGE = NODE_X + NODE_W; // 300

// top-of-rect y for layer i (bottom = layer 1, top = layer L)
function nodeTop(i: number): number {
  return TOP + (L - i) * GAP;
}
function nodeCy(i: number): number {
  return nodeTop(i) + NODE_H / 2;
}

// which earlier depths the current layer selectively retrieves from
function sources(c: number): number[] {
  const raw = [1, Math.max(1, c - 3), c - 1];
  const uniq: number[] = [];
  for (const s of raw) {
    if (s >= 1 && s < c && uniq.indexOf(s) === -1) uniq.push(s);
  }
  return uniq;
}

// curved read arrow from a source node's right edge up to the current node's right edge
function readCurve(y1: number, y2: number): string {
  const bow = RIGHT_EDGE + 84;
  return (
    "M " + RIGHT_EDGE + " " + y1 +
    " C " + bow + " " + y1 + ", " + bow + " " + y2 + ", " + RIGHT_EDGE + " " + y2
  );
}

// short uniform residual arrow between adjacent layers (lower -> upper)
function upCurve(y1: number, y2: number): string {
  const x = NODE_X + 30;
  const my = (y1 + y2) / 2;
  return "M " + x + " " + y1 + " C " + x + " " + my + ", " + x + " " + my + ", " + x + " " + y2;
}

export function AttnRes() {
  const [mode, setMode] = useState<Mode>("uniform");
  const [current, setCurrent] = useState<number>(6);

  const src = mode === "attnres" ? sources(current) : [];
  const srcSet = new Set<number>(src);

  const roleStroke = (i: number): string => {
    if (mode === "attnres" && i === current) return ACCENT;
    if (mode === "attnres" && srcSet.has(i)) return ACCENT;
    return "var(--border)";
  };
  const roleFill = (i: number): string =>
    mode === "attnres" && i === current ? "var(--muted)" : "var(--background)";

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        <span>kimi-k3 · attention residuals</span>
        <span>depth = {L} layers</span>
      </div>

      <div className="px-3 pt-3">
        <svg
          viewBox="0 0 380 540"
          className="w-full"
          role="img"
          aria-label="Vertical stack of eight transformer layers, bottom layer 1 to top layer 8. In uniform-residual mode thin arrows pass the same accumulated state from each layer to the next. In AttnRes mode a chosen current layer draws curved accent arrows that selectively retrieve from a few specific earlier depths instead of accumulating every previous state uniformly."
        >
          <defs>
            <filter id="ar-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
            <marker
              id="ar-arrow"
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
              id="ar-arrow-muted"
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

          {/* ===== uniform residual arrows (adjacent, lower -> upper) ===== */}
          {mode === "uniform" &&
            LAYERS.slice(0, L - 1).map((i) => {
              const y1 = nodeTop(i); // top edge of lower layer i
              const y2 = nodeTop(i + 1) + NODE_H; // bottom edge of upper layer i+1
              return (
                <path
                  key={"u-" + i}
                  d={upCurve(y1, y2)}
                  fill="none"
                  strokeWidth={1.5}
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.7}
                  markerEnd="url(#ar-arrow-muted)"
                />
              );
            })}

          {/* faint residual spine in AttnRes mode (context, de-emphasised) */}
          {mode === "attnres" &&
            LAYERS.slice(0, L - 1).map((i) => {
              const y1 = nodeTop(i);
              const y2 = nodeTop(i + 1) + NODE_H;
              return (
                <path
                  key={"spine-" + i}
                  d={upCurve(y1, y2)}
                  fill="none"
                  strokeWidth={1.5}
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.22}
                />
              );
            })}

          {/* ===== selective read arrows (AttnRes) ===== */}
          {mode === "attnres" &&
            src.map((s) => (
              <path
                key={"r-" + s}
                d={readCurve(nodeCy(s), nodeCy(current))}
                fill="none"
                strokeWidth={1.5}
                stroke={ACCENT}
                strokeOpacity={0.9}
                markerEnd="url(#ar-arrow)"
              />
            ))}

          {/* ===== layer nodes ===== */}
          {LAYERS.map((i) => {
            const isCurrent = mode === "attnres" && i === current;
            const isSrc = mode === "attnres" && srcSet.has(i);
            return (
              <g key={"n-" + i}>
                <rect
                  x={NODE_X}
                  y={nodeTop(i)}
                  width={NODE_W}
                  height={NODE_H}
                  rx={9}
                  fill={roleFill(i)}
                  stroke={roleStroke(i)}
                  strokeWidth={1.5}
                  strokeOpacity={isSrc && !isCurrent ? 0.65 : 1}
                  filter={isCurrent ? "url(#ar-shadow)" : "none"}
                />
                <text
                  x={NODE_X + NODE_W / 2}
                  y={nodeTop(i) + 21}
                  textAnchor="middle"
                  className={isCurrent ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
                  fontSize="11"
                >
                  layer {i}
                  {isCurrent ? " · read" : isSrc ? " · src" : ""}
                </text>
              </g>
            );
          })}

          {/* side caption for the read fan */}
          {mode === "attnres" && (
            <text
              x={RIGHT_EDGE + 40}
              y={nodeCy(current) - 66}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize="9"
            >
              selective
            </text>
          )}
          {mode === "attnres" && (
            <text
              x={RIGHT_EDGE + 40}
              y={nodeCy(current) - 54}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize="9"
            >
              retrieval
            </text>
          )}

          {/* ===== annotation ===== */}
          <text
            x="190"
            y="524"
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            fontSize="9"
          >
            {mode === "attnres"
              ? "~25% higher training efficiency at <2% extra cost"
              : "uniform residual stream · every state accumulated"}
          </text>
        </svg>
      </div>

      {/* ===== controls ===== */}
      <div className="flex flex-wrap items-center gap-3 px-4 pb-1 pt-2">
        <div className="inline-flex rounded-lg border p-0.5">
          <button
            type="button"
            onClick={() => setMode("uniform")}
            className={
              "rounded-md px-3 py-1 font-mono text-xs transition-colors " +
              (mode === "uniform"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground")
            }
            aria-pressed={mode === "uniform"}
          >
            uniform residual
          </button>
          <button
            type="button"
            onClick={() => setMode("attnres")}
            className={
              "rounded-md px-3 py-1 font-mono text-xs transition-colors " +
              (mode === "attnres"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground")
            }
            aria-pressed={mode === "attnres"}
          >
            AttnRes
          </button>
        </div>

        <label className="flex flex-1 items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">current layer</span>
          <Range
            min={2}
            max={L}
            step={1}
            value={current}
            onChange={(e) => setCurrent(Number(e.target.value))}
            disabled={mode !== "attnres"}
            className="h-1 min-w-24 flex-1 cursor-pointer appearance-none rounded-full bg-border  disabled:cursor-not-allowed disabled:opacity-40"
            style={{ color: ACCENT }}
            aria-label="current layer" accent="currentColor" />
        </label>

        <span className="font-mono text-xs text-muted-foreground">
          {mode === "attnres" ? (
            <>
              L=<span className="text-foreground">{current}</span> ← {"{"}
              {sources(current).join(",")}
              {"}"}
            </>
          ) : (
            <>
              mode=<span className="text-foreground">uniform</span>
            </>
          )}
        </span>
      </div>

      <p className="px-4 pb-4 pt-1 text-sm leading-6 text-muted-foreground">
        A plain residual stream forces every layer to add the same accumulated state from
        the layer just below it — information from far-earlier depths is smeared together.
        Attention Residuals instead let a layer <em>selectively retrieve</em> from a few
        specific earlier depths (a learned read), improving gradient flow and depth scaling.
        Switch to <span className="font-mono">AttnRes</span> and scrub the current layer to
        watch the read targets change.
      </p>
    </figure>
  );
}
