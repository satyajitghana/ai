import json, os, sys, time
sys.path.insert(0, '.')
from primitives import fit, PARAMS, IMAGES
OUT = 'grid.jsonl'
done = set()
for l in open(OUT):
    r = json.loads(l)
    lin = r['kind'].endswith('_lin')
    if lin and r.get('ver', 1) != 2: continue          # version-1 linear rows used a weak parameterisation: ignore
    done.add((r['image'], r['kind'], r['N'], r['seed'], r['steps']))
STEPS, SIZE = 200, 48
for seed in (0, 1, 2):
    for image in ("poster", "shaded", "texture"):
        for N in (8, 16, 32, 64):
            for kind in ("g_lin", "h_lin", "g_const", "h_const"):
                if (image, kind, N, seed, STEPS) in done: continue
                img = IMAGES[image](SIZE)
                t = time.time(); p, _ = fit(kind, img, N, seed, STEPS)
                open(OUT, 'a').write(json.dumps(dict(image=image, kind=kind, N=N, seed=seed, steps=STEPS, size=SIZE, s0=0.5, ver=2, psnr=round(float(p), 3), params=PARAMS[kind] * N, sec=round(time.time() - t, 1))) + '\n')
print('GRID2-DONE')
