import numpy as np, json
from zipgeom import *
rng=np.random.default_rng(0)
R,K=3000,64
# synthetic cameras: positions on a sphere of radius 1.0..2.0, looking at a random point in the unit ball; pinhole 70deg fov, 1297 px wide
W=1297; focal=(W/2)/np.tan(np.radians(70)/2); radius=2.0/(focal*np.sqrt(12)); print("pixel radius",radius)
cam=rng.normal(size=(R,3)); cam/=np.linalg.norm(cam,axis=1,keepdims=True); cam*=rng.uniform(1.0,2.0,(R,1))
tgt=rng.normal(size=(R,3)); tgt/=np.linalg.norm(tgt,axis=1,keepdims=True); tgt*=rng.uniform(0,1,(R,1))**(1/3)
dirs=tgt-cam; dirs/=np.linalg.norm(dirs,axis=1,keepdims=True)
dirs=dirs+rng.normal(size=dirs.shape)*0.2; dirs/=np.linalg.norm(dirs,axis=1,keepdims=True)  # pixel offsets within a wide view
t=np.tile(intervals(K)[None,:],(R,1))
S=setup(cam,dirs,np.full(R,radius),t,rng,True); x,sc=multisample(S)
sizes=[16*2**l for l in range(10)]
res=[]
for L,size in enumerate(sizes):
    cells=np.floor(x*size-0.5).astype(np.int64)            # (R,K,6,3)
    key=(cells[...,0]*7919+cells[...,1])*104729+cells[...,2] # hashable key per cell
    srt=np.sort(key,axis=-1); uniq=1+(np.diff(srt,axis=-1)!=0).sum(-1)  # unique cells per interval
    w=level_weight(sc,size)
    res.append(dict(level=L,size=size,mean_unique_cells=float(uniq.mean()),mean_rows=float(8*uniq.mean()),frac_one_cell=float((uniq==1).mean()),
        mean_weight=float(w.mean()),frac_w_lt_1pct=float((w<0.01).mean()),frac_w_gt_99pct=float((w>0.99).mean())))
    print(f"L{L} size {size:5d}  unique cells {uniq.mean():.2f}  rows {8*uniq.mean():5.1f}/48  one-cell {100*(uniq==1).mean():5.1f}%  mean w {w.mean():.3f}  w<1% {100*(w<0.01).mean():5.1f}%")
tot=sum(r['mean_rows'] for r in res); print("rows per interval, all 10 levels:",round(tot,1),"vs naive 480")
g0=sum(r['mean_rows'] for r in res[:6]); g1=sum(r['mean_rows'] for r in res[:8]); print("grid0 (6 lv)",round(g0,1),"grid1 (8 lv)",round(g1,1))
json.dump(dict(n_rays=R,n_intervals=K,radius=radius,levels=res,rows_all10=tot,rows_g0=g0,rows_g1=g1),open("corners.json","w"),indent=1)
