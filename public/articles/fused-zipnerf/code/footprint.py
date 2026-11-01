"""Toy 1: single-point (Instant-NGP style) vs 6-point multisample vs Zip-NeRF-weighted lookup of an iid-noise hash-grid level,
against the Gaussian-weighted average of the same trilinear field over the interval's conical-frustum footprint (Monte Carlo).
Our re-implementation of the lookups; geometry and downweight formulas follow featurize_common.cuh."""
import numpy as np, json
from zipgeom import *
rng=np.random.default_rng(1)
T=2**21; table=rng.normal(size=T).astype(np.float64)
P1,P2=19349663,83492791
def lookup(x,N):
    p=x*N-0.5; fl=np.floor(p); fr=p-fl; c=fl.astype(np.int64); out=0.0
    for k in range(8):
        dx,dy,dz=(k>>2)&1,(k>>1)&1,k&1
        ix,iy,iz=c[...,0]+dx,c[...,1]+dy,c[...,2]+dz
        idx=((ix.astype(np.uint64))^(iy.astype(np.uint64)*np.uint64(P1))^(iz.astype(np.uint64)*np.uint64(P2)))%np.uint64(T)
        w=(fr[...,0] if dx else 1-fr[...,0])*(fr[...,1] if dy else 1-fr[...,1])*(fr[...,2] if dz else 1-fr[...,2])
        out=out+w*table[idx.astype(np.int64)]
    return out
def frustum_gaussian(t0,t1,r):
    tm=0.5*(t0+t1); td=0.5*(t1-t0); den=3*tm**2+td**2
    mu=tm+2*tm*td**2/den; vt=td**2/3-(4/15)*td**4*(12*tm**2-td**2)/den**2; vr=r**2*(tm**2/4+(5/12)*td**2-(4/15)*td**4/den)
    return mu,vt,vr
TR=300; MC=384
rows=[]
for N in (16,64,256,1024,4096):
    for sig in np.logspace(-2,1.1,10):
        # choose pixel radius so that the mean multisample footprint in cell units is ~sig
        o=rng.normal(size=(TR,3)); o*=0.3/np.maximum(np.linalg.norm(o,axis=1,keepdims=True),0.3)*rng.uniform(0.2,1,(TR,1))
        d=rng.normal(size=(TR,3)); d/=np.linalg.norm(d,axis=1,keepdims=True)
        t0=rng.uniform(0.1,0.5,TR); t1=t0+rng.uniform(0.05,0.2,TR)
        r_unit=1e-3
        tdist=np.stack([t0,t1],1)
        S=setup(o,d,np.full(TR,r_unit),tdist,rng,True); x,sc=multisample(S)   # (TR,1,6,3), (TR,1,6)
        k=sig/(sc.mean()*N); r=r_unit*k                                      # scale scales linearly with the pixel radius
        S=setup(o,d,np.full(TR,r),tdist,rng,True); x,sc=multisample(S); x=x[:,0]; sc=sc[:,0]
        sigma_cell=float(sc.mean()*N)
        # ground truth: Gaussian-weighted average of the field over the frustum footprint
        mu,vt,vr=frustum_gaussian(t0,t1,r)
        a1,a2=S['a1'],S['a2']
        z=rng.normal(size=(TR,MC,3))
        pts=o[:,None,:]+mu[:,None,None]*d[:,None,:]+(np.sqrt(vt)[:,None]*z[...,0])[...,None]*d[:,None,:]+(np.sqrt(vr)[:,None]*z[...,1])[...,None]*a1[:,None,:]+(np.sqrt(vr)[:,None]*z[...,2])[...,None]*a2[:,None,:]
        G=lookup(pts/4.0+0.5,N).mean(1)
        A=lookup((o+((t0+t1)/2)[:,None]*d)/4.0+0.5,N)                         # single sample at the interval centre
        L6=lookup(x,N)                                                        # (TR,6)
        B=L6.mean(1)
        w=level_weight(sc,N); C=(w*L6).mean(1)
        rm=lambda e: float(np.sqrt(np.mean(e**2)))
        rows.append(dict(N=N,sigma_cell=sigma_cell,rms_A=rm(A),rms_B=rm(B),rms_C=rm(C),rms_G=rm(G),err_A=rm(A-G),err_B=rm(B-G),err_C=rm(C-G),mean_w=float(w.mean())))
        print(f"N={N:5d} sigma_cell={sigma_cell:7.3f}  rms: A {rm(A):.3f} B {rm(B):.3f} C {rm(C):.3f} | truth {rm(G):.3f}  | err vs truth: A {rm(A-G):.3f} B {rm(B-G):.3f} C {rm(C-G):.3f}  mean w {w.mean():.3f}")
json.dump(rows,open("footprint.json","w"),indent=1)
