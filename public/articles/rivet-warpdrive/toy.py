"""Toy of the WarpDrive access pattern: local WAL -> batched immutable shard images on an object store.
Virtual time for latency; real files + sha256 for the recovery check. Deterministic (seeded)."""
import os, sys, json, random, hashlib, shutil, tempfile, math
import numpy as np
PAGE=4096; SHARD=64; DB_PAGES=47*256; NSH=DB_PAGES//SHARD   # 47 MiB
SHARD_B=PAGE*SHARD
rng=np.random.default_rng(7)

# ---------- latency model (ASSUMED parameters; swept below) ----------
def ln(median, p99_over_med, n):
    s=math.log(p99_over_med)/2.326
    return median*np.exp(rng.normal(0,s,n))
def get_ms(med,n,size=SHARD_B): return ln(med,4.5,n)+size/60e3   # 60 MB/s per stream => ms = bytes/60e3
def put_ms(med,n,size=SHARD_B): return ln(med,4.5,n)+size/40e3
def az_ack(n):
    r=ln(0.45,1.8,(3,n)); r.sort(axis=0); return r[1]+0.15   # majority of 3 + local fsync

# ---------- write path ----------
def workload(ncommits, rate):
    # shard choice: zipf(1.0) over shards; pages per commit 1+Poisson(2)
    w=1/np.arange(1,NSH+1); w/=w.sum(); perm=rng.permutation(NSH)
    commits=[]
    for i in range(ncommits):
        k=1+rng.poisson(2)
        sh=perm[rng.choice(NSH,size=k,p=w)]
        pg=sh*SHARD+rng.integers(0,SHARD,size=k)
        commits.append((i*1000.0/rate, sorted(set(int(p) for p in pg))))
    return commits
PUT_PRICE=0.005/1000; GET_PRICE=0.0004/1000
def write_study(put_med=40, rate=100, secs=60):
    cs=workload(rate*secs, rate); n=len(cs); out={}
    pages=[len(p) for _,p in cs]; touched=[len(set(x//SHARD for x in p)) for _,p in cs]
    def pct(a): return {"p50":float(np.percentile(a,50)),"p99":float(np.percentile(a,99))}
    # P1 one delta object per commit, ack = PUT
    lat=put_ms(put_med,n,size=PAGE*np.array(pages)+64)
    out["direct-delta"]=dict(puts=n,bytes=int(sum(PAGE*p+64 for p in pages)),ack=pct(lat))
    # P2 rewrite touched shard images per commit
    lat=put_ms(put_med,n,size=SHARD_B)+0  # parallel PUTs: ack = slowest of `touched`
    lat=np.array([put_ms(put_med,t).max() for t in touched])
    out["direct-shard"]=dict(puts=int(sum(touched)),bytes=int(sum(touched))*SHARD_B,ack=pct(lat))
    # P3 WAL majority-ack + fold every W seconds
    ack=az_ack(n)
    for W in (1,5,30,60):
        puts=0; byt=0; packed=0
        for s in range(0,secs,W):
            d=set()
            for t,p in cs:
                if s*1000<=t<(s+W)*1000: d|={x//SHARD for x in p}
            puts+=len(d); byt+=len(d)*SHARD_B; packed+=1 if d else 0
        out[f"wal+fold{W}s/per-shard"]=dict(puts=puts,bytes=byt,ack=pct(ack))
        out[f"wal+fold{W}s/packed"]=dict(puts=packed,bytes=byt,ack=pct(ack))
    for k,v in out.items():
        v["usd_per_M_commits"]=v["puts"]*PUT_PRICE*(1e6/n)
        v["puts_per_commit"]=v["puts"]/n
    return dict(commits=n,rate=rate,secs=secs,avg_pages=float(np.mean(pages)),results=out)

# ---------- cold wake: fetch whole 47 MiB ----------
def wake(med, conc, unit):  # unit: pages per GET
    nget=math.ceil(DB_PAGES/unit); size=unit*PAGE
    lat=get_ms(med,nget,size)
    # list-scheduling over `conc` workers
    free=[0.0]*conc; 
    import heapq; heapq.heapify(free)
    end=0
    for l in lat:
        t=heapq.heappop(free)+l; heapq.heappush(free,t); end=max(end,t)
    return nget,end
def wake_study(trials=200):
    res={}
    for med in (15,25,40,60):
        for conc in (1,4,16,64):
            ts=[wake(med,conc,SHARD)[1] for _ in range(trials)]
            res[f"{med}/{conc}"]=dict(gets=188,p50=float(np.percentile(ts,50)),p99=float(np.percentile(ts,99)))
    pp={}
    for unit,conc in ((1,1),(SHARD,1),(1,16)):
        ts=[wake(25,conc,unit)[1] for _ in range(20)]
        pp[f"unit{unit}/conc{conc}"]=dict(gets=math.ceil(DB_PAGES/unit),p50=float(np.percentile(ts,50)))
    return dict(grid=res,units=pp)

# ---------- real recovery check (files, sha256) ----------
class Store:
    def __init__(s,root,fold_bug=False):
        s.root=root; s.fold_bug=fold_bug
        os.makedirs(root+"/obj",exist_ok=True)
        s.walp=root+"/wal.log"; open(s.walp,"ab").close()
        s.pages={}   # in-memory current state
        s.txid=0; s.wm=0
    def commit(s,pgs,fsync_cut=None):
        s.txid+=1
        rec=json.dumps([s.txid,{str(p):d for p,d in pgs.items()}]).encode()
        line=hashlib.sha256(rec).hexdigest().encode()+b" "+rec+b"\n"
        with open(s.walp,"ab") as f: f.write(line if fsync_cut is None else line[:fsync_cut])
        if fsync_cut is None: s.pages.update(pgs)
    def fold(s,crash_mid=False):
        # write immutable shard images for dirty shards; manifest last (atomic rename)
        dirty={p//SHARD for p in s.pages if s._dirty(p)}
        base=s._load_manifest()
        newm=dict(base)
        for sh in sorted(dirty):
            img={p:s.pages[p] for p in s.pages if p//SHARD==sh}
            if s.fold_bug:   # BUG variant: image only carries pages changed since last fold, replaces old image
                img={p:d for p,d in img.items() if s._dirty(p)}
            name=f"shard-{sh}-tx{s.txid}.json"
            open(s.root+"/obj/"+name,"w").write(json.dumps(img)); newm[str(sh)]=name
            if crash_mid and len(newm)>len(base)+len(dirty)//2: return
        tmp=s.root+"/manifest.tmp"; open(tmp,"w").write(json.dumps(dict(wm=s.txid,shards=newm))); os.replace(tmp,s.root+"/manifest.json")
        s.wm=s.txid; s.folded=dict(s.pages)
    def _dirty(s,p): return getattr(s,"folded",{}).get(p)!=s.pages[p]
    def _load_manifest(s):
        try: return json.load(open(s.root+"/manifest.json"))["shards"]
        except FileNotFoundError: return {}
def recover(root):
    state={}; wm=0
    try:
        m=json.load(open(root+"/manifest.json")); wm=m["wm"]
        for sh,name in m["shards"].items():
            for p,d in json.load(open(root+"/obj/"+name)).items(): state[int(p)]=d
    except FileNotFoundError: pass
    for line in open(root+"/wal.log","rb"):
        if not line.endswith(b"\n"): break          # torn tail record
        h,rec=line[:-1].split(b" ",1)
        if hashlib.sha256(rec).hexdigest().encode()!=h: break
        tx,pgs=json.loads(rec)
        if tx>wm:
            for p,d in pgs.items(): state[int(p)]=d
    return state
def recovery_trials(n=300, fold_bug=False):
    ok=0; r=random.Random(1)
    for t in range(n):
        d=tempfile.mkdtemp(dir=os.environ["SCR"]); st=Store(d,fold_bug); acked={}
        for step in range(r.randint(5,40)):
            pgs={r.randrange(0,8*SHARD):r.randrange(10**6) for _ in range(r.randint(1,4))}
            if r.random()<0.12:
                # crash during commit: torn WAL write, never acked
                st.commit(pgs,fsync_cut=r.randint(5,60)); break
            st.commit(pgs); acked.update(pgs)
            if r.random()<0.25: st.fold(crash_mid=(r.random()<0.2))
        got=recover(d); ok+= (got==acked)
        shutil.rmtree(d)
    return ok,n
if __name__=="__main__":
    os.environ.setdefault("SCR",tempfile.gettempdir())
    out={}
    out["write"]={str(m):write_study(put_med=m) for m in (25,40,80)}
    out["wake"]=wake_study()
    out["recovery_ok"]=recovery_trials(300,False)
    out["recovery_bug"]=recovery_trials(300,True)
    json.dump(out,open(sys.argv[1],"w"),indent=1)
    w=out["write"]["40"]; print("commits",w["commits"],"avg pages",w["avg_pages"])
    for k,v in w["results"].items(): print(f"{k:28s} puts={v['puts']:6d} puts/commit={v['puts_per_commit']:.3f} MB={v['bytes']/1e6:8.1f} ack p50={v['ack']['p50']:.2f} p99={v['ack']['p99']:.2f} usd/M={v['usd_per_M_commits']:.2f}")
    print(json.dumps(out["wake"],indent=0)[:1500]); print(out["recovery_ok"],out["recovery_bug"])
