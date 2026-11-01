import json,struct,requests,numpy as np,re,concurrent.futures as cf
exec(open('dist.py').read().split("KEYS=")[0])  # reuse helpers: rng,hdr,bf16,sample,locate,IDX
dc=json.load(open('files/decision_config.json')); ids=dc['token_ids']
# 1. delta alignment on the sampled tensors
KEYS=['language_model.layers.0.mlp.up_proj.weight','language_model.layers.3.self_attn.q_proj.weight','language_model.layers.31.self_attn.q_proj.weight','language_model.layers.31.mlp.down_proj.weight','language_model.layers.63.self_attn.k_proj.weight','language_model.layers.0.linear_attn.in_proj_qkv.weight','language_model.embed_tokens.weight']
out={'delta':{}}
for k in KEYS:
    q=sample('qwen',k)[0]; d=sample('d3',k)[0]; x=sample('drex',k)[0]; t=sample('d3t',k)[0]
    m=min(map(len,(q,d,x,t))); q,d,x,t=q[:m],d[:m],x[:m],t[:m]
    dd,dx,dt=d-q,x-q,t-q
    cos=lambda a,b: float(a@b/(np.linalg.norm(a)*np.linalg.norm(b)))
    row={'cos_drex_d3':round(cos(dx,dd),3),'cos_drex_d3turbo':round(cos(dx,dt),3),'cos_d3_d3turbo':round(cos(dd,dt),3),
         'changed_frac_d3':round(float((d!=q).mean()),3),'changed_frac_drex':round(float((x!=q).mean()),3)}
    out['delta'][k.split('language_model.')[-1]]=row; print(k.split('language_model.')[-1],row,flush=True)
# 2. readout vs Qwen's lm_head rows at the code token ids
def rows_lm(ids):
    url,real=locate('qwen','lm_head.weight') if False else (IDX['qwen'][0]+IDX['qwen'][1]['lm_head.weight'],'lm_head.weight')
    h,off=hdr(url); t=h['lm_head.weight']; a,b=t['data_offsets']; H=t['shape'][1]
    def one(i): return bf16(rng(url,off+a+i*H*2,off+a+(i+1)*H*2-1))
    with cf.ThreadPoolExecutor(8) as ex: return np.stack(list(ex.map(one,ids))), t['shape']
L,shape=rows_lm(ids); print('lm_head shape',shape,'rows fetched',L.shape)
def readout(repo,rev='main'):
    base=f"https://huggingface.co/{repo}/resolve/{rev}/readout.safetensors"
    h,off=hdr(base); k=list(h)[0]; t=h[k]; a,b=t['data_offsets']; raw=rng(base,off+a,off+b-1)
    arr=bf16(raw) if t['dtype']=='BF16' else np.frombuffer(raw,dtype=np.float32)
    return arr.reshape(t['shape']),t['dtype']
R={}
for n,repo in [('drex','nace-ai/drex-max-v1'),('d3','vllm-sr/d3'),('d3t','vllm-sr/d3-turbo')]:
    try: R[n]=readout(repo)
    except Exception as e: print('no readout',n,repr(e)[:80])
unit=lambda a: a/np.linalg.norm(a,axis=1,keepdims=True)
out['readout']={}
for n,(W,dt) in R.items():
    W=W.astype(np.float32); cs=(unit(W)*unit(L)).sum(1); rn=np.linalg.norm(W,axis=1)/np.linalg.norm(L,axis=1)
    out['readout'][n]={'dtype':dt,'shape':list(W.shape),'cos_to_lm_head_row_mean':round(float(cs.mean()),4),'cos_min':round(float(cs.min()),4),'cos_max':round(float(cs.max()),4),'norm_ratio_mean':round(float(rn.mean()),4),'rel_dist_mean_pct':round(float((np.linalg.norm(W-L,axis=1)/np.linalg.norm(L,axis=1)).mean()*100),3)}
    print(n,out['readout'][n],flush=True)
if 'drex' in R and 'd3' in R:
    a=R['drex'][0].astype(np.float32); b=R['d3'][0].astype(np.float32); out['readout']['drex_vs_d3_cos_mean']=round(float((unit(a)*unit(b)).sum(1).mean()),4); print('drex vs d3 readout row cos',out['readout']['drex_vs_d3_cos_mean'])
json.dump(out,open('delta_readout.json','w'),indent=1)
