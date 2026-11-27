// The Stone Age people and the brand, shared by spark (scene 12) and hands (13) so both scenes show
// the same people, without one scene's chunk importing the other's. Types only from the toolkit.
import type * as HU from "./creature/human"

/** One person: body type, skin and hide, seed, scale and tint. */
export type SparkPerson = { name: string; body: "adultA" | "adultB" | "child"; look: HU.SkinOpts; seed: number; scale: number; tint: [number, number, number] }
export const SPARK_PEOPLE: SparkPerson[] = [
  { name: "knapper", body: "adultA", look: { skin: 0x5f4a3e, hair: 0x140e0a, garment: "wrap", hide: 0x4b3423, dust: 0.85, armHair: 0.6 }, seed: 0.31, scale: 0.97, tint: [1, 0.97, 0.95] },
  { name: "woman", body: "adultB", look: { skin: 0x56423a, hair: 0x0f0a08, garment: "wrap2", hide: 0x4a3524, dust: 0.7, armHair: 0.3 }, seed: 0.57, scale: 1.0, tint: [1, 0.98, 0.97] },
  { name: "child", body: "child", look: { skin: 0x634b3e, hair: 0x120c09, garment: "wrap", hide: 0x47322a, dust: 0.9, armHair: 0.2 }, seed: 0.83, scale: 1.0, tint: [1, 0.99, 0.98] },
]

/**
 * The brand torch.ts lifts out of the hearth (scene units, 10 cm): the stick that lies out of the
 * fire toward the lens, `from` its cold end to `to` its burning end; `stick` is its instance index.
 */
export const SPARK_BRAND = { hearth: [2.4, 0, -6.6] as const, from: [1.25, 0.1, -3.85] as const, to: [2.52, 0.42, -6.5] as const, stick: 16, unit: 0.1 }
