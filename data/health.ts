import { z } from "zod"

// Biomarker dashboard data — Zod-validated and parsed inline so a malformed
// edit throws at import time (the loud-failure safety net, same pattern as
// lib/content/schema.ts). The /update-health skill rewrites this file from
// real lab panels ingested by the health-ingestor agent.
//
// PLACEHOLDER DATA — every value below is invented for layout demo purposes.
// Replace via the /update-health skill with Satyajit's actual lab panels.

export const healthCategory = z.enum([
  "cardiovascular",
  "metabolic",
  "liver_kidney",
  "hormonal",
  "nutritional",
  "blood_panel",
  "vitals",
])
export type HealthCategory = z.infer<typeof healthCategory>

const optimalRange = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .refine((r) => r.min !== undefined || r.max !== undefined, {
    message: "optimalRange needs at least a min or a max",
  })

export const biomarker = z.object({
  // Stable identifier (slug-ish, unique). Drives React keys + treemap ids.
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.number(),
  unit: z.string(),
  category: healthCategory,
  // Relative treemap area weight (clinical/attention salience). Default 1.
  weight: z.number().positive().optional(),
  optimalRange: optimalRange.optional(),
  note: z.string().optional(),
})
export type Biomarker = z.infer<typeof biomarker>

export const stackItem = z.object({
  type: z.enum(["device", "supplement"]),
  name: z.string().min(1),
  url: z.string().url().optional(),
})
export type StackItem = z.infer<typeof stackItem>

export const healthData = z.object({
  panelDate: z.iso.date(),
  stack: z.array(stackItem),
  biomarkers: z.array(biomarker).min(1),
})
export type HealthData = z.infer<typeof healthData>

// PLACEHOLDER values — replace via /update-health skill with real lab panels.
const raw = {
  // Date of the most recent lab panel these markers were drawn from.
  panelDate: "2026-05-15",

  // PLACEHOLDER stack — the wearables + supplements feeding this dashboard.
  // Replace with Satyajit's actual stack.
  stack: [
    { type: "device", name: "Apple Watch", url: "https://www.apple.com/watch/" },
    { type: "device", name: "Withings Body+" },
    { type: "supplement", name: "Vitamin D3" },
    { type: "supplement", name: "Omega-3" },
    { type: "supplement", name: "Creatine" },
    { type: "supplement", name: "Magnesium Glycinate" },
  ],

  // ~20 PLACEHOLDER markers across all 7 categories. Statuses are mixed so the
  // page demos optimal / borderline / low / elevated cells.
  biomarkers: [
    // — cardiovascular —
    {
      key: "ldl-c",
      label: "LDL-C",
      value: 128,
      unit: "mg/dL",
      category: "cardiovascular",
      weight: 2,
      optimalRange: { max: 100 },
      note: "Elevated — primary driver of atherosclerotic risk.",
    },
    {
      key: "hdl-c",
      label: "HDL-C",
      value: 52,
      unit: "mg/dL",
      category: "cardiovascular",
      optimalRange: { min: 40 },
    },
    {
      key: "apob",
      label: "ApoB",
      value: 105,
      unit: "mg/dL",
      category: "cardiovascular",
      weight: 1.5,
      optimalRange: { max: 90 },
      note: "Elevated — atherogenic particle count above target.",
    },
    {
      key: "triglycerides",
      label: "Triglycerides",
      value: 88,
      unit: "mg/dL",
      category: "cardiovascular",
      optimalRange: { max: 150 },
    },

    // — metabolic —
    {
      key: "hba1c",
      label: "HbA1c",
      value: 5.4,
      unit: "%",
      category: "metabolic",
      weight: 1.5,
      optimalRange: { max: 5.7 },
    },
    {
      key: "fasting-glucose",
      label: "Fasting Glucose",
      value: 96,
      unit: "mg/dL",
      category: "metabolic",
      optimalRange: { min: 70, max: 99 },
    },
    {
      key: "fasting-insulin",
      label: "Fasting Insulin",
      value: 8.1,
      unit: "µIU/mL",
      category: "metabolic",
      optimalRange: { max: 8 },
      note: "Borderline — marginally above optimal fasting insulin.",
    },

    // — liver_kidney —
    {
      key: "alt",
      label: "ALT",
      value: 22,
      unit: "U/L",
      category: "liver_kidney",
      optimalRange: { max: 40 },
    },
    {
      key: "ast",
      label: "AST",
      value: 24,
      unit: "U/L",
      category: "liver_kidney",
      optimalRange: { max: 40 },
    },
    {
      key: "creatinine",
      label: "Creatinine",
      value: 0.95,
      unit: "mg/dL",
      category: "liver_kidney",
      optimalRange: { min: 0.7, max: 1.3 },
    },
    {
      key: "egfr",
      label: "eGFR",
      value: 99,
      unit: "mL/min",
      category: "liver_kidney",
      optimalRange: { min: 90 },
    },

    // — hormonal —
    {
      key: "tsh",
      label: "TSH",
      value: 2.1,
      unit: "mIU/L",
      category: "hormonal",
      optimalRange: { min: 0.5, max: 4.0 },
    },
    {
      key: "testosterone",
      label: "Testosterone",
      value: 610,
      unit: "ng/dL",
      category: "hormonal",
      optimalRange: { min: 300, max: 1000 },
    },

    // — nutritional —
    {
      key: "vitamin-d",
      label: "Vitamin D",
      value: 24,
      unit: "ng/mL",
      category: "nutritional",
      weight: 1.5,
      optimalRange: { min: 30, max: 100 },
      note: "Low — below the optimal 25-OH vitamin D range.",
    },
    {
      key: "vitamin-b12",
      label: "Vitamin B12",
      value: 540,
      unit: "pg/mL",
      category: "nutritional",
      optimalRange: { min: 400, max: 1000 },
    },
    {
      key: "ferritin",
      label: "Ferritin",
      value: 38,
      unit: "ng/mL",
      category: "nutritional",
      optimalRange: { min: 50, max: 300 },
      note: "Low — iron stores below the optimal floor.",
    },

    // — blood_panel —
    {
      key: "hemoglobin",
      label: "Hemoglobin",
      value: 15.1,
      unit: "g/dL",
      category: "blood_panel",
      optimalRange: { min: 13.5, max: 17.5 },
    },
    {
      key: "wbc",
      label: "WBC",
      value: 6.2,
      unit: "10³/µL",
      category: "blood_panel",
      optimalRange: { min: 4, max: 11 },
    },
    {
      key: "platelets",
      label: "Platelets",
      value: 245,
      unit: "10³/µL",
      category: "blood_panel",
      optimalRange: { min: 150, max: 400 },
    },

    // — vitals —
    {
      key: "resting-hr",
      label: "Resting HR",
      value: 58,
      unit: "bpm",
      category: "vitals",
      optimalRange: { min: 40, max: 60 },
    },
    {
      key: "bp-systolic",
      label: "BP Systolic",
      value: 132,
      unit: "mmHg",
      category: "vitals",
      weight: 1.5,
      optimalRange: { max: 120 },
      note: "Elevated — systolic pressure above the optimal ceiling.",
    },
    {
      key: "vo2max",
      label: "VO₂max",
      value: 47,
      unit: "mL/kg/min",
      category: "vitals",
      optimalRange: { min: 42 },
    },
  ],
}

// Parse at module load — a bad edit throws here with a Zod error.
export const health: HealthData = healthData.parse(raw)
