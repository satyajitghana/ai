"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"

// Superconducting transition temperature against pressure: what has been measured and
// reproduced, what one group has reported, what was retracted or refuted, and what has
// only been calculated. Two panels share the Tc axis: one atmosphere on the left (lanes
// by status), compressed samples on the right (pressure on a log axis).
//
// Sources, read 2026-10-08:
//   Elements, Nb3Sn, Nb3Ge, NbN: textbook values, as roomtsc.com/data/records.json lists them.
//   MgB2 39 K: Nagamatsu et al., Nature 410, 63 (2001).
//   La-Ba-Cu-O 35 K, Bi-2223 110 K, Tl-2223 125 K: roomtsc.com/data/record_claims.json.
//   YBa2Cu3O7 93 K: Wu et al., PRL 58, 908 (1987).
//   Hg-1223 133-135 K: Schilling et al., Nature 363, 56 (1993); 138 K with Tl: Dai et al. (1995).
//   Hg-1223 164 K at 31 GPa: Gao et al., PRB 50, 4260 (1994).
//   SmFeAsO 55 K: Ren et al., Chin. Phys. Lett. 25, 2215 (2008).
//   La3Ni2O7 near 80 K at 14 to 43.5 GPa: Sun et al., Nature 621, 493 (2023).
//   H3S 203 K at 155 GPa: Drozdov et al., Nature 525, 73 (2015).
//   LaH10 250 K at 170 GPa: Drozdov et al., Nature 569, 528 (2019).
//   CaH6 215 K at 172 GPa: Ma et al., PRL 128, 167001 (2022).
//   YH9 243 K at 201 GPa: Kong et al., Nat. Commun. 12, 5075 (2021).
//   LaSc2H24 onset 298 K at 260 GPa: Song et al., arXiv:2510.01273 (not reproduced).
//   Quenched Hg-1223 onset 151 K at 1 atm: Deng et al., PNAS 123 (2026) (one group).
//   Mg2RhH6 onsets 18 to 29 K at 30 to 74 GPa: Wu et al., JACS 148 (2026) (one group).
//   Retracted: CSH 288 K at 267 GPa (Nature 586, 373, retracted 2022); N-doped LuH 294 K at
//     1 GPa (Nature 615, 244, retracted 2023); Y superhydride 262 K at 182 GPa (PRL, retracted 2024).
//   Refuted: LK-99, Tc of 400 K or more claimed at 1 atm (arXiv:2307.12008), July 2023.
//   Calculated, 1 atm: published ranges from Table 9 of the RoomTSC paper (Draft 6); KPtH6 is
//     the Alexandria release's Allen-Dynes (119 K) and Eliashberg (155 K) values.
//   Calculated, megabar: MgH6 and YH10 at 300 GPa, Table 3 of the same paper.
//   roomtsc 0.1: its largest estimate on the unlabelled records, eta_H 4.76 eV/A^2 for cubic
//     KPtH6, times 136.5 K x sqrt(eta_H) at efficiencies 0.35 and 0.58: 104 to 173 K. An upper
//     scale at published efficiencies, not a predicted Tc.

type Status = "accepted" | "single" | "retracted" | "calc" | "model"

type Pt = {
  name: string
  tc: number
  tcHi?: number
  p: number // GPa; 0 means one atmosphere
  pHi?: number
  dx?: number // horizontal offset inside a 1 atm lane, so ranges do not overlap
  status: Status
  note: string
}

const PTS: Pt[] = [
  { name: "Hg", tc: 4.2, p: 0, status: "accepted", note: "Mercury, 1911. The first superconductor." },
  { name: "Pb", tc: 7.2, p: 0, status: "accepted", note: "Lead, 1913." },
  { name: "Nb", tc: 9.2, p: 0, status: "accepted", note: "Niobium, the highest Tc of an element at 1 atm." },
  { name: "Nb₃Sn", tc: 18, p: 0, status: "accepted", note: "1954. Still a workhorse magnet wire." },
  { name: "Nb₃Ge", tc: 22.3, p: 0, status: "accepted", note: "1973. The record until the cuprates." },
  { name: "La-Ba-Cu-O", tc: 35, p: 0, status: "accepted", note: "1986. The first cuprate." },
  { name: "MgB₂", tc: 39, p: 0, status: "accepted", note: "2001. Still the record for phonon pairing at 1 atm." },
  { name: "SmFeAsO", tc: 55, p: 0, status: "accepted", note: "2008. Iron-based, bulk record about 55 to 56 K." },
  { name: "YBa₂Cu₃O₇", tc: 93, p: 0, status: "accepted", note: "1987. First above liquid nitrogen, 77 K." },
  { name: "Bi-2223", tc: 110, p: 0, status: "accepted", note: "1988." },
  { name: "Tl-2223", tc: 125, p: 0, status: "accepted", note: "1988." },
  { name: "Hg-1223", tc: 133, tcHi: 138, p: 0, status: "accepted", note: "1993; 138 K with partial thallium, 1995. The 1 atm record." },
  { name: "Hg-1223, compressed", tc: 164, p: 31, status: "accepted", note: "1994, onset at 31 GPa." },
  { name: "La₃Ni₂O₇", tc: 80, p: 14, pHi: 43.5, status: "accepted", note: "2023, signatures near 80 K between 14 and 43.5 GPa." },
  { name: "Mg₂RhH₆", tc: 18, tcHi: 29, p: 30, pHi: 74, status: "single", note: "2026, one group, resistive onsets only; reverted to Mg₂RhH₅ on release." },
  { name: "H₃S", tc: 203, p: 155, status: "accepted", note: "2015. Predicted first, then measured." },
  { name: "CaH₆", tc: 215, p: 172, status: "accepted", note: "2022. Predicted in 2012 at 220 to 235 K." },
  { name: "YH₉", tc: 243, p: 201, status: "accepted", note: "2021. About 30 K below its prediction." },
  { name: "LaH₁₀", tc: 250, p: 170, status: "accepted", note: "2019, reproduced by a second group. The record at any pressure." },
  { name: "LaSc₂H₂₄", tc: 298, p: 260, status: "single", note: "2025 preprint, resistive onset. A second group made no superconductor in seven attempts." },
  { name: "quenched Hg-1223", tc: 151, p: 0, status: "single", note: "2026, onset after a pressure quench, kept at 1 atm. Zero resistance not reported." },
  { name: "C-S-H", tc: 288, p: 267, status: "retracted", note: "2020, retracted by Nature in 2022." },
  { name: "Y superhydride", tc: 262, p: 182, status: "retracted", note: "2021, retracted by PRL in 2024." },
  { name: "N-doped LuH", tc: 294, p: 1, status: "retracted", note: "2023, retracted by Nature in November 2023." },
  { name: "LK-99", tc: 400, p: 0, status: "retracted", note: "2023, claimed 400 K or more. A copper sulfide impurity and weak ferromagnetism explained it within four weeks." },
  { name: "Mg₂IrH₆", tc: 59, dx: -15, tcHi: 175, p: 0, status: "calc", note: "Calculated 59 to 175 K. Synthesis gave Mg₂IrH₅ instead." },
  { name: "Li₂AuH₆", tc: 88, dx: -9, tcHi: 140, p: 0, status: "calc", note: "Calculated 88 to 140 K. Hydrogen pairs into H₂ in a path-integral simulation." },
  { name: "Li₂CuH₆", tc: 80, dx: -3, tcHi: 152, p: 0, status: "calc", note: "Calculated 80 to 152 K. No synthesis or quantum-nuclei simulation found." },
  { name: "PdH₄", tc: 133, dx: 3, tcHi: 146, p: 0, status: "calc", note: "Calculated 133 to 146 K, harmonic phonons only." },
  { name: "KPtH₆", tc: 119, dx: 9, tcHi: 155, p: 0, status: "calc", note: "Alexandria release: Allen-Dynes 119 K, Eliashberg 155 K. Hull distance unknown." },
  { name: "Mg₂PtH₆", tc: 64, dx: 15, tcHi: 80, p: 0, status: "calc", note: "Calculated 64 to 80 K. Did not form; Mg₄Pt₃H₆ formed." },
  { name: "MgH₆", tc: 280, p: 300, status: "calc", note: "Calculated 280 K at 300 GPa. No synthesis reported." },
  { name: "YH₁₀", tc: 270, p: 300, status: "calc", note: "Calculated 270 K at 300 GPa. Did not form up to 410 GPa." },
  {
    name: "roomtsc 0.1 top estimate",
    tc: 104,
    tcHi: 173,
    p: 0,
    status: "model",
    note: "Cubic KPtH₆, η_H 4.76 eV/Å² from the model: 136.5 K × √η_H at efficiencies 0.35 and 0.58. An upper scale, not a predicted Tc.",
  },
]

const STATUS: Record<Status, { label: string; colour: string }> = {
  accepted: { label: "measured, reproduced", colour: "oklch(0.55 0.15 255)" },
  single: { label: "one group, not reproduced", colour: "oklch(0.68 0.15 65)" },
  retracted: { label: "retracted or refuted", colour: "oklch(0.58 0.2 25)" },
  calc: { label: "calculated only", colour: "oklch(0.6 0.03 260)" },
  model: { label: "roomtsc 0.1 upper scale", colour: "oklch(0.55 0.16 150)" },
}

const LANES: Status[] = ["accepted", "single", "retracted", "calc", "model"]

const W = 680
const H = 400
const T = 16
const B = 40
const L = 44
const SPLIT = 250 // right edge of the 1 atm panel
const GAP = 22
const R = 14
const TC_MAX = 420

const y = (tc: number) => T + (1 - tc / TC_MAX) * (H - T - B)
const lx = (s: Status) => L + 16 + (LANES.indexOf(s) * (SPLIT - L - 28)) / (LANES.length - 1)
const P_MIN = 1
const P_MAX = 400
const px = (p: number) => SPLIT + GAP + ((mlog10(p) - mlog10(P_MIN)) / (mlog10(P_MAX) - mlog10(P_MIN))) * (W - SPLIT - GAP - R)

function Mark({ pt, on, onPick }: { pt: Pt; on: boolean; onPick: () => void }) {
  const c = STATUS[pt.status].colour
  const cx = pt.p === 0 ? lx(pt.status) + (pt.dx ?? 0) : px(pt.p)
  const cy = y(pt.tc)
  const r = on ? 6 : 4.2
  const stroke = on ? "var(--foreground)" : "var(--background)"
  const sw = on ? 2 : 1
  return (
    <g style={{ cursor: "pointer" }} onClick={onPick} role="button" aria-label={pt.name}>
      {pt.tcHi !== undefined ? <line x1={cx} x2={cx} y1={y(pt.tc)} y2={y(pt.tcHi)} stroke={c} strokeWidth={on ? 4 : 3} strokeLinecap="round" opacity={0.75} /> : null}
      {pt.pHi !== undefined ? <line x1={px(pt.p)} x2={px(pt.pHi)} y1={cy} y2={cy} stroke={c} strokeWidth={on ? 4 : 3} strokeLinecap="round" opacity={0.75} /> : null}
      {pt.status === "retracted" ? (
        <g stroke={c} strokeWidth={on ? 3 : 2.2}>
          <line x1={cx - r} x2={cx + r} y1={cy - r} y2={cy + r} />
          <line x1={cx - r} x2={cx + r} y1={cy + r} y2={cy - r} />
        </g>
      ) : pt.status === "single" ? (
        <circle cx={cx} cy={cy} r={r} fill="var(--card)" stroke={c} strokeWidth={on ? 3 : 2} />
      ) : pt.status === "calc" || pt.status === "model" ? (
        <path d={`M${cx},${cy - r - 1}L${cx + r + 1},${cy}L${cx},${cy + r + 1}L${cx - r - 1},${cy}Z`} fill={c} stroke={stroke} strokeWidth={sw} />
      ) : (
        <circle cx={cx} cy={cy} r={r} fill={c} stroke={stroke} strokeWidth={sw} />
      )}
    </g>
  )
}

export function TcLandscape() {
  const [show, setShow] = useState<Record<Status, boolean>>({ accepted: true, single: true, retracted: true, calc: true, model: true })
  const [sel, setSel] = useState<Pt>(PTS[18])

  const visible = PTS.filter((p) => show[p.status])
  const tcTicks = [0, 77, 150, 200, 250, 300, 400]
  const pTicks = [1, 10, 30, 100, 300]
  const fmtP = (p: Pt) => (p.p === 0 ? "1 atm" : p.pHi ? `${p.p} to ${p.pHi} GPa` : `${p.p} GPa`)
  const fmtT = (p: Pt) => (p.tcHi !== undefined ? `${p.tc} to ${p.tcHi} K` : `${p.tc} K`)

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <figcaption className="mb-2 font-mono text-xs text-muted-foreground">
        Tc against pressure · every point sourced in the component header · click a mark
      </figcaption>
      <div className="mb-2 flex flex-wrap gap-2">
        {LANES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setShow({ ...show, [s]: !show[s] })}
            className="rounded-md border border-border px-2 py-1 font-mono text-xs"
            style={{ opacity: show[s] ? 1 : 0.45 }}
            aria-pressed={show[s]}
          >
            <span style={{ color: STATUS[s].colour }}>■</span> {STATUS[s].label}
          </button>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Transition temperature against pressure. On the left, materials at one atmosphere in lanes by status: reproduced superconductors rise from mercury at 4.2 K to the mercury cuprate at 133 to 138 K; a quenched cuprate at 151 K from one group; LK-99's refuted 400 K claim; calculated hydride candidates between 59 and 175 K; and the roomtsc model's largest estimate, an upper scale of 104 to 173 K. On the right, compressed samples on a log pressure axis: H3S at 203 K and 155 GPa, CaH6 at 215 K and 172 GPa, YH9 at 243 K and 201 GPa, LaH10 at 250 K and 170 GPa, an unreproduced 298 K onset in LaSc2H24 at 260 GPa, and three retracted claims between 262 and 294 K. The 300 K line is empty at one atmosphere."
      >
        <rect x={L} y={y(300)} width={W - L - R} height={y(273) - y(300)} fill="oklch(0.7 0.12 40 / 0.12)" />
        {tcTicks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={t === 300 ? 1.4 : 0.6} strokeDasharray={t === 77 ? "3 3" : undefined} />
            <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
              {t}
            </text>
          </g>
        ))}
        <text x={W - R - 2} y={y(300) - 4} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
          room temperature, 273 to 300 K
        </text>
        <text x={W - R - 2} y={y(77) - 4} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
          liquid nitrogen, 77 K
        </text>
        <line x1={SPLIT + GAP / 2} x2={SPLIT + GAP / 2} y1={T} y2={H - B} stroke="var(--border)" strokeWidth={1} />
        <text x={(L + SPLIT) / 2} y={H - 12} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
          one atmosphere, by status
        </text>
        {pTicks.map((p) => (
          <g key={p}>
            <line x1={px(p)} x2={px(p)} y1={H - B} y2={H - B + 4} stroke="var(--border)" />
            <text x={px(p)} y={H - B + 14} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
              {p}
            </text>
          </g>
        ))}
        <text x={(SPLIT + W) / 2} y={H - 4} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
          pressure, GPa (log)
        </text>
        <text x={8} y={T + 4} fontSize={10} className="fill-muted-foreground font-mono">
          K
        </text>
        {visible.map((p) => (
          <Mark key={p.name} pt={p} on={p === sel} onPick={() => setSel(p)} />
        ))}
      </svg>
      <div className="mt-2 rounded-md border border-border p-2 font-mono text-xs">
        <span style={{ color: STATUS[sel.status].colour }}>■</span> {sel.name} · {fmtT(sel)} · {fmtP(sel)} · {STATUS[sel.status].label}
        <div className="mt-1 text-muted-foreground">{sel.note}</div>
      </div>
    </figure>
  )
}
