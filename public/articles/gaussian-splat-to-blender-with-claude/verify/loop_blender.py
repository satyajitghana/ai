"""The article's render-compare-refine toy (loop.py, copied as loop_numpy.py) with every silhouette
rendered by real Blender 5.0.1 (Cycles, CPU, 1 sample, emission, 40x40). Same targets, same RNG streams,
same search; only silhouette() is swapped. Usage: python -I loop_blender.py <variant 0-5> [seeds]"""
import sys, os, json, time
here = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, here)
import numpy as np, loop_numpy as L, bpyrender as B
i = int(sys.argv[1]); nseeds = int(sys.argv[2]) if len(sys.argv) > 2 else 10
mode, ncam = L.VARIANTS[i]
cams = L.cameras(ncam)
sc, cobjs, boxes = B.setup(cams)
state = {"renders": 0, "mismatch": 0, "px": 0, "check": True}
def sil_blender(params, cam):
    k = [c[0].tobytes() for c in cams].index(cam[0].tobytes())
    B.place(boxes, params)
    m = B.render(sc, cobjs[k]); state["renders"] += 1
    if state["check"] and state["renders"] % 25 == 0:      # spot-check against the numpy slab test
        r = L_sil(params, cam); state["mismatch"] += int((m != r).sum()); state["px"] += m.size
    return m
L_sil = L.silhouette
L.silhouette = sil_blender
rows = []; t0 = time.time()
for sd in range(nseeds):
    rng = np.random.default_rng(1000 + sd)
    target = L.make_target(rng)
    tg = [sil_blender(target, c) for c in cams]
    x0 = L.init(rng, target, mode)
    x, s, ev, trace = L.search(np.random.default_rng(2000 + sd), x0, cams, tg)
    rows.append(dict(seed=sd, evals=ev, final_sil_iou=round(s, 4),
                     iou3d=round(L.iou3d(x, target, np.random.default_rng(3000 + sd)), 4),
                     iou3d_start=round(L.iou3d(x0, target, np.random.default_rng(3000 + sd)), 4)))
    print(mode, ncam, sd, rows[-1], round(time.time() - t0), "s", flush=True)
reached = [r["evals"] for r in rows if r["evals"] is not None]
cell = dict(init=mode, cameras=ncam, seeds=nseeds, reached=len(reached),
            evals_median=float(np.median(reached)) if reached else None, evals_all=[r["evals"] for r in rows],
            sil_iou_median=float(np.median([r["final_sil_iou"] for r in rows])),
            iou3d_median=float(np.median([r["iou3d"] for r in rows])),
            iou3d_start_median=float(np.median([r["iou3d_start"] for r in rows])),
            blender_renders=state["renders"], seconds=round(time.time() - t0),
            pixel_mismatch_vs_numpy=[state["mismatch"], state["px"]])
json.dump(cell, open(os.path.join(here, "loop_blender_%d.json" % i), "w"), indent=1)
