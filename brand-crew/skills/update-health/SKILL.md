---
name: update-health
description: Update the biomarker dashboard on ai.thesatyajit.com from a lab panel. Use when Satyajit shares blood-work / lab results (PDF, photo, or text) to ingest. Rewrites the biomarker entries in data/health.ts (Zod-validated inline), then runs pnpm validate.
---

# update-health — biomarker dashboard

Edit `data/health.ts`. The data is Zod-validated **inline** at module load (`healthData.parse(raw)`), so a bad edit throws at import — `pnpm validate` catches it.

## Each biomarker entry
```ts
{
  key: "ldl",                 // kebab-case unique id
  label: "LDL Cholesterol",
  value: 98,                  // number
  unit: "mg/dL",
  category: "cardiovascular", // one of: cardiovascular | metabolic | liver_kidney |
                              //         hormonal | nutritional | blood_panel | vitals
  optimalRange: { min: 0, max: 100 },  // at least one of min/max required
  // weight: 1.5,             // optional emphasis
  // note: "…",               // optional, e.g. flag an out-of-range value
}
```

## Steps
1. Read `data/health.ts` to see the existing entries and the `HealthCategory` enum.
2. Map each lab value → an entry: correct `category`, `unit`, and `optimalRange` (min and/or max). Add a `note` when a value sits outside its optimal range. Remove the PLACEHOLDER warning comment once real data is in.
3. Sanity-check statuses (don't mislabel an out-of-range value as optimal).
4. Run `pnpm validate` and report; fix Zod/type errors until green. Ship via PR. Never store the source PDF.
