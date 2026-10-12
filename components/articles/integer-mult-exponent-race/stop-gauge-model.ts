// The truth behind the stop gauge (Anatomy workflow step 2, "Truth first").
//
// Since the three-shear cover of 9 October, the final assembly is fed one
// network saving: the smaller of the bit network's and the complex network's.
// Only the weaker network counts, so the figure is a carriage pushed against
// two stops, one per network, and it stops at whichever is nearer. The outer
// assembly then turns that saving s into kappa a hair below it:
//   #144's assembly (9 October):  kappa ~ a/(1+2a)
//   the 11 October assembly:      kappa ~ s/(1+s)
//
// Every value below is in the article's prose, as an exact fraction or a
// decimal (sections "The margin that binds", "Which side binds, and which
// margin", "The wall changes sides", "What E8 is in this race", "#467, and the
// claims it leaves out", "`main` moved once"). `kappa` is the claimed value,
// not recomputed; stop-gauge-model.test asserts the formula reproduces it.

import { mlog10 } from "@/lib/dmath"

export type Side = "bit" | "complex"
export type Assembly = "a/(1+2a)" | "s/(1+s)"

export interface Milestone {
  id: string
  // Button text and the readout's lead.
  name: string
  when: string
  // Network savings. `approx` marks a side the article only gives roughly.
  bit: number
  complex: number
  approx?: Side
  kappa: number
  assembly: Assembly
  // `main` at that moment.
  main: number
  // One sentence for the legend; numbers in it are the article's.
  note: string
}

export const MILESTONES: Milestone[] = [
  {
    id: "144",
    name: "#144 cover",
    when: "05:06 UTC, 9 Oct",
    bit: 4613422943 / 1e13,
    complex: 4856569 / 1e10,
    kappa: 4609169 / 1e10,
    assembly: "a/(1+2a)",
    main: 4609169 / 1e10,
    note: "icekylinx's three-shear cover, merged into main. The bit network is the weaker one, so its stop holds the carriage.",
  },
  {
    id: "r10",
    name: "Jain round 10",
    when: "09:50 UTC, 9 Oct",
    bit: 6.3239e-4,
    complex: 61609676 / 1e11,
    kappa: 6153378 / 1e10,
    assembly: "a/(1+2a)",
    main: 4609169 / 1e10,
    note: "Birth reuse lifts the complex side less than the bit side, so the complex stop is now the wall.",
  },
  {
    id: "r11",
    name: "Jain round 11",
    when: "13:07 UTC, 9 Oct",
    bit: 133893704947 / 2e14,
    complex: 67147467 / 1e11,
    kappa: 6685733 / 1e10,
    assembly: "a/(1+2a)",
    main: 6.61886e-4,
    note: "Recycled registers push the complex side just past the bit side, and the wall goes back to the bit stop.",
  },
  {
    id: "346",
    name: "#346 Design T",
    when: "23:45 UTC, 10 Oct",
    bit: 8.01726e-4,
    complex: 7.93e-4,
    approx: "complex",
    kappa: 396290046684973 / 5e17,
    assembly: "s/(1+s)",
    main: 90446448750933 / 1.25e17,
    note: "Design T on the p = 10 bit word jumps the bit side, and the complex supplier, at about 7.93×10⁻⁴, becomes the wall.",
  },
  {
    id: "352",
    name: "#352 E8 complex",
    when: "01:03 UTC, 11 Oct",
    bit: 8.01726e-4,
    complex: 876248285600677 / 1e18,
    kappa: 801083628465007 / 1e18,
    assembly: "s/(1+s)",
    main: 90446448750933 / 1.25e17,
    note: "Sussman's 120-label E8 unit replaces only the complex supplier. It lands 9.3% past the bit stop, which binds again.",
  },
  {
    id: "370",
    name: "#370 E8 bit",
    when: "05:05 UTC, 11 Oct",
    bit: 9.0407e-4,
    complex: 8762479 / 1e10,
    kappa: 8.75481e-4,
    assembly: "s/(1+s)",
    main: 90446448750933 / 1.25e17,
    note: "The first bit word built on E8 roots moves the bit stop past the complex one, and the wall changes sides once more.",
  },
  {
    id: "467",
    name: "#467",
    when: "17:17 UTC, 11 Oct",
    bit: 645473756513106438971 / 5e23,
    complex: 1297203880559577927527 / 1e24,
    kappa: 51571324647751 / 4e16,
    assembly: "s/(1+s)",
    main: 90446448750933 / 1.25e17,
    note: "Rohan's #467, past one in a thousand. The two stops sit almost level and the bit side binds; main is where the pin is.",
  },
]

export const REST_INDEX = MILESTONES.length - 1

export const bindingOf = (m: Pick<Milestone, "bit" | "complex">): Side => (m.bit <= m.complex ? "bit" : "complex")
export const savingOf = (m: Pick<Milestone, "bit" | "complex">) => Math.min(m.bit, m.complex)

// The assembly as a function of the binding saving. It ignores the eta and
// beta slivers and the 1e-10 grid, which move kappa in its sixth digit.
export const kappaOf = (s: number, assembly: Assembly) => (assembly === "a/(1+2a)" ? s / (1 + 2 * s) : s / (1 + s))

// The scale: units of 1e-4 along the rails. 10^-3 is a major line on it.
export const SCALE = { from: 4, to: 13.5, thousandth: 10 }
export const per1e4 = (value: number) => value * 1e4

// x = 1.2893e-3 as "1.289283×10⁻³", in the article's own digits.
const SUP: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" }
export function sci(value: number, digits: number) {
  const exponent = Math.floor(mlog10(value))
  const mantissa = value / 10 ** exponent
  const sup = String(exponent)
    .split("")
    .map((ch) => SUP[ch] ?? ch)
    .join("")
  return `${mantissa.toFixed(digits)}×10${sup}`
}

// How many digits each value is shown with: the precision the article prints.
export const SHOWN = {
  kappa: { "144": 6, r10: 4, r11: 4, "346": 5, "352": 4, "370": 5, "467": 6 } as Record<string, number>,
  bit: { "144": 4, r10: 4, r11: 4, "346": 5, "352": 5, "370": 4, "467": 4 } as Record<string, number>,
  complex: { "144": 6, r10: 4, r11: 4, "346": 2, "352": 4, "370": 4, "467": 3 } as Record<string, number>,
  main: { "144": 6, r10: 6, r11: 5, "346": 5, "352": 5, "370": 5, "467": 5 } as Record<string, number>,
}

export const kappaText = (m: Milestone) => sci(m.kappa, SHOWN.kappa[m.id] ?? 4)
export const sideText = (m: Milestone, side: Side) => `${m.approx === side ? "about " : ""}${sci(m[side], SHOWN[side][m.id] ?? 4)}`
export const mainText = (m: Milestone) => sci(m.main, SHOWN.main[m.id] ?? 5)
