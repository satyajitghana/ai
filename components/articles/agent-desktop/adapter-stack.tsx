import { CRATES } from "./data"

// The layers of agent-desktop, with each bar's width proportional to the PRODUCTION lines of Rust in that crate at commit
// cb31212 (MEASURED by script: *_tests.rs, tests.rs, tests/ directories and test-support files are excluded). The agent's own
// loop and the operating-system APIs are drawn for orientation and carry no count. Plain arithmetic only.

const W = 624 // width the three adapters fill, in px
const GAP = 12
const ROW = 40
const ROW_GAP = 26
const LEFT = 18

const by = Object.fromEntries(CRATES.map((c) => [c.id, c])) as Record<(typeof CRATES)[number]["id"], (typeof CRATES)[number]>
const fmt = (n: number) => n.toLocaleString("en-US")

type BarProps = { x: number; y: number; w: number; hue: number; label: string; sub?: string; dashed?: boolean; outside?: boolean }

function Bar({ x, y, w, hue, label, sub, dashed, outside }: BarProps) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={ROW}
        rx={4}
        fill={`oklch(0.86 0.07 ${hue})`}
        stroke="currentColor"
        strokeOpacity={0.5}
        strokeWidth={1}
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      {outside ? (
        <>
          <text x={x} y={y - 6} fontSize={10} fontFamily="ui-monospace, monospace" fill="currentColor">
            {label}
          </text>
          {sub && (
            <text x={x} y={y + ROW + 12} fontSize={9.5} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.7}>
              {sub}
            </text>
          )}
        </>
      ) : (
        <>
          <text x={x + w / 2} y={y + 17} textAnchor="middle" fontSize={10.5} fontFamily="ui-monospace, monospace" fill="oklch(0.2 0 0)">
            {label}
          </text>
          {sub && (
            <text x={x + w / 2} y={y + 31} textAnchor="middle" fontSize={9.5} fontFamily="ui-monospace, monospace" fill="oklch(0.3 0 0)">
              {sub}
            </text>
          )}
        </>
      )}
    </g>
  )
}

export function AdapterStack() {
  const adaptersTotal = by.macos.prod + by.windows.prod + by.linux.prod
  const k = (W - 2 * GAP) / adaptersTotal // px per production line
  const wMac = by.macos.prod * k
  const wWin = by.windows.prod * k
  const wLin = by.linux.prod * k
  const xMac = LEFT
  const xWin = xMac + wMac + GAP
  const xLin = xWin + wWin + GAP
  const wCore = by.core.prod * k
  const wCli = by.cli.prod * k
  const wFfi = by.ffi.prod * k
  const xCore = LEFT + (W - wCore) / 2
  const rowY = (i: number) => 16 + i * (ROW + ROW_GAP)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the layers, bar width proportional to production Rust lines · measured by script at commit cb31212
      </div>
      <div className="px-2 py-3">
        <svg
          viewBox="0 0 660 336"
          className="mx-auto h-auto w-full max-w-[660px] text-foreground"
          role="img"
          aria-label={`Layers of agent-desktop, top to bottom. The agent's own loop, which is not in the repository. The CLI binary with ${fmt(by.cli.prod)} production lines and the C library with ${fmt(by.ffi.prod)}. The core crate with ${fmt(by.core.prod)}. Three platform adapters: macOS with ${fmt(by.macos.prod)}, Windows with ${fmt(by.windows.prod)} and Linux with ${fmt(by.linux.prod)}. The operating-system accessibility APIs underneath.`}
        >
          <Bar x={LEFT + (W - 220) / 2} y={rowY(0)} w={220} hue={320} label="your agent's loop" sub="observe, act, verify: not in the repo" dashed />
          <Bar x={xCore + wCore / 2 - 62} y={rowY(1)} w={wCli} hue={75} label="CLI" sub={`${fmt(by.cli.prod)} lines`} outside />
          <Bar x={xCore + wCore / 2 + 22} y={rowY(1)} w={wFfi} hue={75} label="C library" sub={`${fmt(by.ffi.prod)} lines`} outside />
          <Bar x={xCore} y={rowY(2)} w={wCore} hue={150} label="core" sub={`${fmt(by.core.prod)} lines`} />
          <Bar x={xMac} y={rowY(3)} w={wMac} hue={250} label="macOS adapter" sub={`${fmt(by.macos.prod)} lines`} />
          <Bar x={xWin} y={rowY(3)} w={wWin} hue={250} label="Windows adapter" sub={`${fmt(by.windows.prod)} lines`} />
          <Bar x={xLin} y={rowY(3)} w={wLin} hue={250} label="Linux adapter" sub={`${fmt(by.linux.prod)} lines`} />
          <Bar x={xMac} y={rowY(4)} w={wMac} hue={25} label="AX API" dashed />
          <Bar x={xWin} y={rowY(4)} w={wWin} hue={25} label="UI Automation" dashed />
          <Bar x={xLin} y={rowY(4)} w={wLin} hue={25} label="AT-SPI over D-Bus, X11, Wayland" dashed />
        </svg>
      </div>
      <div className="overflow-x-auto border-t px-4 py-3">
        <table className="w-full min-w-[28rem] font-mono text-[11px]">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="pb-1 pr-3 font-normal">crate</th>
              <th className="pb-1 pr-3 text-right font-normal">production lines</th>
              <th className="pb-1 pr-3 text-right font-normal">test lines</th>
              <th className="pb-1 text-right font-normal">#[test]</th>
            </tr>
          </thead>
          <tbody>
            {CRATES.map((c) => (
              <tr key={c.id}>
                <td className="pr-3">{c.label}</td>
                <td className="pr-3 text-right tabular-nums">{fmt(c.prod)}</td>
                <td className="pr-3 text-right tabular-nums">{fmt(c.test)}</td>
                <td className="text-right tabular-nums">{fmt(c.tests)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
