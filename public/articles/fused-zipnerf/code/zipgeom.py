"""numpy port of the repo's multisample geometry (featurize_common.cuh: setup_interval, multisample, level_weighting). Our re-implementation, not the repo's code."""
import numpy as np
SQRT7=np.sqrt(7.0); PATTERN=np.array([0,2,4,3,5,1],dtype=np.float64)
def approx_erf(x): return np.sign(x)*np.sqrt(-np.expm1(-(4.0/np.pi)*x*x))
def ray_warp_consts(p=-1.5,premult=2.0):
    g=lambda t: np.sign(t*premult)*(abs(p-1)/p)*((np.abs(t*premult)/abs(p-1)+1.0)**p-1.0)
    return g
def inv_warp(y,p=-1.5,premult=2.0):
    # inverse of the power-ladder curve for y>=0
    x=abs(p-1)*((y*p/abs(p-1)+1.0)**(1.0/p)-1.0); return x/premult
def intervals(n_intervals,near=0.0,far=1e6,p=-1.5,premult=2.0):
    g=ray_warp_consts(p,premult); y0=float(g(near)); y1=float(g(far)); y1=min(y1,(p-1)/p*(1-1e-7))
    s=np.linspace(0,1,n_intervals+1); y=y0+s*(y1-y0); t=inv_warp(y,p,premult); t[0]=near; return t
def setup(origins,dirs,radii,tdist,rng,random_pattern=True):
    """origins,dirs: (R,3); radii (R,); tdist (R,K+1). returns dict of per-interval arrays (R,K,...)"""
    R,K1=tdist.shape; K=K1-1
    d=dirs; c1=np.cross(d,np.array([0,0,1.0])); bad=(np.abs(c1)<1.1920929e-07).all(-1)
    if bad.any(): c1[bad]=np.cross(d[bad],np.array([1.0,1,1]))
    a1=c1/np.linalg.norm(c1,axis=-1,keepdims=True); c2=np.cross(d,c1); a2=c2/np.linalg.norm(c2,axis=-1,keepdims=True)
    t0=tdist[:,:-1]; t1=tdist[:,1:]; s=0.5*(t0+t1); h=0.5*(t1-t0)
    den=h*h+3*s*s; ratio=np.where(np.abs(den)<1.17549435e-38,0.0,h/den); base=t1*t1+2*s*s; q=h*h-s*s; root=np.sqrt(np.maximum(q*q+4*s**4,0))
    if random_pattern:
        flip=rng.random((R,K))<0.5; rot=2*np.pi*rng.random((R,K))
    else:
        flip=(np.arange(K)%2==1)[None,:].repeat(R,0); rot=np.where(flip,np.pi/6,0.0)
    return dict(o=origins,d=d,r=radii,a1=a1,a2=a2,t0=t0,ratio=ratio,base=base,root=root,flip=flip,rot=rot)
def multisample(S):
    """returns x (R,K,6,3) in [0,1]^3 and scale (R,K,6) in grid-box units"""
    R,K=S['t0'].shape; xs=np.empty((R,K,6,3)); sc=np.empty((R,K,6))
    for j in range(6):
        idx=np.where(S['flip'],5-j,j); theta=(np.pi/3)*PATTERN[idx]+S['rot']
        cz=S['t0']+S['ratio']*(S['base']+(3/SQRT7)*(j*0.4-1)*S['root'])
        pm=np.sqrt(0.5)*S['r'][:,None]*cz
        p=S['o'][:,None,:]+(pm*np.cos(theta))[...,None]*S['a1'][:,None,:]+(pm*np.sin(theta))[...,None]*S['a2'][:,None,:]+cz[...,None]*S['d'][:,None,:]
        n2=np.maximum((p*p).sum(-1),1.0); n=np.sqrt(n2)
        iso=np.exp((2/3)*np.log(2*n-1)-np.log(n2)); con=(2*n-1)/n2
        xs[:,:,j,:]=(1/4.0)*(con[...,None]*p)+0.5; sc[:,:,j]=0.5*pm*iso*(1/4.0)
    return xs,sc
def level_weight(scale,size): return approx_erf(1.0/(np.sqrt(8.0)*scale*size))
