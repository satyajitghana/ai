# Math-reel spec generators

**The JSON specs in `data/math-reels/` are the source of truth.** These scripts are how the first 369 specs were written (one Python script per batch of families, each spec built from the family's review and the release catalogue, then enriched with a plain-words line, a proof scene and a voice). They are kept so a batch can be regenerated after a systematic change, not as the place to edit a reel: edit the JSON, and run `node brand-crew/skills/math-reels/check.mjs` and `render.mjs plan` on it.

A generator **overwrites** its specs. On 7 Oct 2026 every script below reproduced its specs exactly (compared as JSON), so re-running one is safe until someone edits one of its specs by hand; after that, either port the edit into the script or stop regenerating that family.

## Running one

```bash
cd brand-crew/skills/math-reels/generators/gen-nt
MATH_REVIEWS=/path/to/oaimath/reviews python3 a.py          # writes data/math-reels/001-010.json
MATH_REELS_OUT=/tmp/try MATH_REVIEWS=... python3 a.py        # or somewhere else, to diff first
```

- `_paths.py` resolves every path: `REPO` (this checkout), `OUT` (`$MATH_REELS_OUT`, default `data/math-reels`), `REVIEWS` (`$MATH_REVIEWS`, default `../oaimath/reviews` beside the repo). Every script imports it, so none of them hard-codes a machine path.
- The review JSONL files (`*.jsonl`, one review per family) are **not in the repo**. The generators that quote reviews (`gen-comb`, `gen-pd`, `gen-cmg`) need `MATH_REVIEWS`; the others carry their quotes inline. `check.mjs --reviews=<dir>` verifies review quotes against the same files.
- They also read `content/articles/openai-math.mdx` and `components/articles/openai-math/catalogue-data.ts` from the repo, to check quotes as they write.
- Python 3, standard library only.

## Which script writes which specs

| Script | Specs | Notes |
|---|---|---|
| `gen-nt/a.py`, `b.py`, `c.py` | 001-010, 011-020, 021-031 | number theory; `gen-nt/common.py` builds a spec, `gen-nt/enrich.py` adds plain, proof and voice |
| `gen-nt/d.py` | 240-259 | logic and group theory, same helpers |
| `gen_ag1.py` | 032-038, 040-044, 046-051 | algebraic geometry; enriched by `enrich_ag.py` as it writes |
| `enrich_ag.py 039` | 039 | 039 has no generator: `enrich_ag.py` enriches the JSON in place (idempotent) |
| `fork52/gen.py` | 052-060, 062-069 | algebraic geometry, part two; `enrich_ag.py` |
| `gen/a1.py` ... `a5.py` | 071-074, 075-077, 078-080, 081-083, 084-086 | **hand-finished**: these write the base specs only; the committed JSON was then enriched by `enrich-ap/apply_direct.py` and its object timings and beat text tuned by hand. Do not re-run |
| `gen-cmg/a.py` ... `e.py` | 087-091, 092-094, 095-096, 097-098, 099-101 | convex and metric geometry; enriched by `enrich-ap/enrich.py` as they write |
| `gen_tcs_a.py`, `_b.py`, `_c.py` | 102-112 (not 107), 113-124 (not 123), 125-142 (not 130) | theoretical CS; `gen_tcs_common.py`, `gen_tcs_enrich.py` |
| `gen-pd/dyn.py` | 143-154 | dynamical systems; `gen-pd/common.py`, `gen-pd/enrich.py` |
| `gen-comb/b1.py` ... `b5.py` | 155-160, 161-168 (not 163, 165), 169-176, 177-184, 185-192 | combinatorics; `gen-comb/lib.py`, `gen-comb/enrich.py` |
| `gen-algebra.py` | 193-210 | algebra; `enrich_ag.py` |
| `gen-pd/prob2.py` | 211-239 | probability; supersedes `gen-pd/prob1.py` (211-225, kept for history, same output) |
| `gen_physics_specs.py` | 260-303 | mathematical physics and operator algebras |
| `gen-gt/gen_a.py`, `gen_b.py`, `gen_c.py` | 304-309, 310-317, 318-321 | topology; `gen-gt/enrich_gt.py` |
| `gen-333-347.py`, `gen-348-361.py` | 333-347, 348-361 | geometry and topology; `gen-gt/enrich_gt.py` |
| `gen-366-377.py` | 366-377 | analysis and PDE; `enrich-ap/enrich.py` |
| none | 322-332, 362-365 | **hand-written** JSON, enriched in place by `enrich-ap/apply_direct.py`, then timings tuned by hand. Do not re-run `apply_direct.py` |
| none | 107, 130, 165 | **hand-written** demo specs (the first three reels) |

Every family from 001 to 377 that has a spec is listed once (the catalogue has 372 families; 045, 061, 070, 123 and 163 are not among them).

## Other files

- `enrich-ap/rep.py`, `rep2.py` ... `rep5.py`: one-off text patches already applied to `enrich-ap/enrich.py`. History only; do not run.
- `*/chk.sh`, `*/ck.sh`, `gen-comb/fr.sh`, `gen-nt/sweep.sh`, `gen-nt/enrich-chk.sh`, `gen-nt/enrich-frames.sh`: the check-and-preview loops used while writing (`check.mjs`, `render.mjs plan`/`frame` on a batch). They take ids as arguments; the ones that default to "the whole group" read a `group-*.json` family list that is not in the repo, so pass the ids. `gen-nt/enrich-chk.sh` regenerates `gen-nt` before checking.
