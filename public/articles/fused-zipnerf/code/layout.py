"""Layout, parameter and per-iteration counts of fused-zipnerf, computed from the repo's own config (zipnerf_garden.yaml + Model.py)."""
import json, math
N_SAMPLES=[64,64,32]; LEVELS=[6,8,10]; FEATS=[1,1,4]; LOG2=21; BASE=16; SCALE=2.0
MLP_D=64; BOTTLE=256; VIEW=256; DEG=4
BATCH=65536; ITERS=25000
out={"grids":[]}
for g,(nl,nf) in enumerate(zip(LEVELS,FEATS)):
    sizes=[round(BASE*SCALE**l) for l in range(nl)]
    entries=[min(s**3,2**LOG2) for s in sizes]
    hashed=[s**3>e for s,e in zip(sizes,entries)]
    params=sum(entries)*nf
    out["grids"].append(dict(grid=g,levels=nl,features=nf,sizes=sizes,entries=entries,hashed=hashed,table_params=params,table_MB_fp32=params*4/1e6,
        out_features=nl*(nf+1)))
# proposal MLPs
for g in (0,1):
    nout=out["grids"][g]["out_features"]
    p=MLP_D*nout+MLP_D+MLP_D+1
    out["grids"][g]["mlp_params"]=p; out["grids"][g]["mlp_shape"]=f"{nout}->{MLP_D}(relu)->1"
# nerf mlp (nerf_mlp_parameters)
nf=out["grids"][2]["out_features"]; r8=lambda v:(v+7)//8*8
dirw=(3+6*DEG+1+7)//8*8; ndir=3+6*DEG
nview_in=BOTTLE+dirw
shapes={"density_0.w":(MLP_D,r8(nf)),"density_0.b":(MLP_D,),"density_1.w":(1,MLP_D),"density_1.b":(1,),
 "bottleneck.w":(BOTTLE,MLP_D),"bottleneck.b":(BOTTLE,),"view_0.w":(VIEW,nview_in),"view_0.b":(VIEW,),
 "view_1.w":(VIEW,VIEW),"view_1.b":(VIEW,),"view_2.w":(VIEW,VIEW),"view_2.b":(VIEW,),"rgb.w":(3,VIEW+nview_in),"rgb.b":(3,)}
out["nerf_mlp"]={"shapes":{k:list(v) for k,v in shapes.items()},"params":sum(math.prod(v) for v in shapes.values()),"direction_block_width":dirw,"n_direction_features":ndir,"n_features_padded":r8(nf)}
out["per_iteration"]={"rays":BATCH,"samples_per_level":[BATCH*s for s in N_SAMPLES],"samples_total":BATCH*sum(N_SAMPLES),
  "multisample_points_total":BATCH*sum(N_SAMPLES)*6,"iterations":ITERS,"samples_total_run":BATCH*sum(N_SAMPLES)*ITERS}
tp=sum(g["table_params"] for g in out["grids"]); mp=sum(g.get("mlp_params",0) for g in out["grids"])+out["nerf_mlp"]["params"]
out["totals"]={"grid_params":tp,"grid_MB_fp32":tp*4/1e6,"mlp_params":mp,"params_total":tp+mp}
# bytes of feature buffers kept for backward (training), per iteration, as the Renderer allocates them
b=0
feat=[]
for g in (0,1):
    n=BATCH*N_SAMPLES[g]*out["grids"][g]["out_features"]*4; feat.append(("proposal%d features fp32"%g,n)); b+=n
n=BATCH*N_SAMPLES[2]*out["nerf_mlp"]["n_features_padded"]*2; feat.append(("nerf features fp16 (padded to %d)"%r8(nf),n)); b+=n
n=BATCH*N_SAMPLES[2]*(MLP_D+dirw)*2; feat.append(("nerf inputs fp16 (%d cols)"%(MLP_D+dirw),n)); b+=n
out["stored_feature_buffers"]=dict(items=[(k,v) for k,v in feat],total_bytes=b)
json.dump(out,open("layout.json","w"),indent=1)
for g in out["grids"]: print("grid",g["grid"],"levels",g["levels"],"F",g["features"],"sizes",g["sizes"],"entries",g["entries"],"hashed",g["hashed"],"params %.1fM"%(g["table_params"]/1e6),"out",g["out_features"])
print("nerf mlp params",out["nerf_mlp"]["params"],"dirw",dirw,"nfeat padded",r8(nf))
print(out["per_iteration"]); print(out["totals"]); print([(k,round(v/1e6,1)) for k,v in feat],"total MB",round(b/1e6,1))
