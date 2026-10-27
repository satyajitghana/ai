"""Toy snapshot store for the LayerFS article. A toy: it models the idea (content-defined chunks, content-addressed
directory objects, one commit per snapshot) and nothing else. zlib level 6 stands in for zstd, SHA-256 for BLAKE3.

usage: python3 -I toy_store.py N REPO GEAR_RS
  N        number of commits to sample evenly from REPO's history (the article used 157)
  REPO     a git repository; files under public/ are skipped
  GEAR_RS  core/crates/layerfs-content/src/file/cdc/gear.rs from the LayerFS checkout (the GEAR table is read from it)
writes snaps.json and result.json in the current directory.
"""
import json, re, zlib, hashlib, subprocess, struct, io, tarfile, lzma, sys, time
N=int(sys.argv[1]); R=sys.argv[2]; SRC=sys.argv[3]
revs=subprocess.check_output(["git","-C",R,"rev-list","--reverse","HEAD"],text=True).split()
step=(len(revs)-1)/(N-1)
sel=[revs[round(i*step)] for i in range(N)]
snaps=[]
for c in sel:
    out=subprocess.check_output(["git","-C",R,"ls-tree","-r","-l","-z",c],text=False).split(b"\0")
    files=[]
    for l in out:
        if not l: continue
        meta,path=l.split(b"\t",1)
        mode,typ,sha,size=meta.split()
        path=path.decode("utf8","replace")
        if typ!=b"blob" or path.startswith("public/"): continue
        if mode==b"160000": continue
        files.append((path,mode.decode(),sha.decode(),int(size)))
    snaps.append({"commit":c,"files":files})
json.dump(snaps,open("snaps.json","w"))
sizes={}
for s in snaps:
    for p,m,sha,sz in s["files"]: sizes[sha]=sz
print("snapshots",len(snaps),"files/snap",[len(s['files']) for s in snaps][::8])
print("logical",sum(sz for s in snaps for _,_,_,sz in s['files']))
print("unique blobs",len(sizes),"bytes",sum(sizes.values()))
print("unique >8KiB",sum(1 for v in sizes.values() if v>8192),sum(v for v in sizes.values() if v>8192))

txt=open(SRC).read()
GEAR=[int(x,16) for x in re.findall(r"0x[0-9a-f]{16}",txt.split("pub const GEAR")[1])]
assert len(GEAR)==256
M64=(1<<64)-1
MIN,TGT,MAX=8192,16384,32768
SS,SL,HS,HL=0x0000_d903_0353_7000,0x0000_d901_0353_0000,0x0001_b206_06a6_e000,0x0001_b202_06a6_0000
# note: shifted masks apply to the first byte of a pair; plain masks to the second
SMALL,LARGE,SSMALL,SLARGE=SS,SL,HS,HL
def cdc(b):
    n=len(b); out=[]; s=0
    while s<n:
        if n-s<=MIN: out.append((s,n)); break
        pos=MIN; h=0; cut=None
        while True:
            a=s+pos
            if pos>=MAX: cut=a; break
            if a+1>=n: cut=n; break   # fewer than 2 bytes left: tail joins chunk
            sm=pos<TGT
            h=((h<<2)+(GEAR[b[a]]<<1))&M64
            if h&(SSMALL if sm else SLARGE)==0: cut=a; break
            h=(h+GEAR[b[a+1]])&M64
            if h&(SMALL if sm else LARGE)==0: cut=a+1; break
            pos+=2
        if cut==s: cut=s+1  # cannot happen (pos>=MIN)
        out.append((s,cut)); s=cut
    return out
snaps=json.load(open("snaps.json"))
need=sorted({sha for s in snaps for _,_,sha,_ in s["files"]})
print("fetching",len(need),"blobs",flush=True)
p=subprocess.Popen(["git","-C",R,"cat-file","--batch"],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
blobs={}
def rd():
    h=p.stdout.readline().split(); sz=int(h[2]); d=p.stdout.read(sz); p.stdout.read(1); return d
import threading
def feed():
    for s in need: p.stdin.write((s+"\n").encode())
    p.stdin.close()
threading.Thread(target=feed,daemon=True).start()
for s in need: blobs[s]=rd()
print("fetched",sum(map(len,blobs.values())),flush=True)
Z=lambda d: len(zlib.compress(d,6))
t=time.time()
blob_z={s:Z(d) for s,d in blobs.items()}
print("zlib blobs",time.time()-t,flush=True)
# chunk
t=time.time()
chunks={}      # chunk id -> (len, zlen)
blob_chunks={} # sha -> [chunk ids]
for s,d in blobs.items():
    ids=[]
    for a,b in cdc(d) if len(d)>MIN else [(0,len(d))]:
        c=d[a:b]; cid=hashlib.sha256(c).digest()
        if cid not in chunks: chunks[cid]=(len(c),min(len(c),Z(c)))
        ids.append(cid)
    blob_chunks[s]=ids
print("cdc",time.time()-t,"chunks",len(chunks),flush=True)
# directory objects (content addressed), toy tree
def build(files):
    root={}
    for path,mode,sha,sz in files:
        parts=path.split("/"); d=root
        for x in parts[:-1]: d=d.setdefault(x,{})
        d[parts[-1]]=(mode,sha,sz)
    return root
dirobjs={}  # id -> zlen,rawlen
paged={}

def put(store,raw):
    did=hashlib.sha256(raw).digest()
    if did not in store: store[did]=(len(raw),len(zlib.compress(raw,6)))
    return did
def enc(node):
    ents=[]; keys=[]
    for name in sorted(node):
        v=node[name]
        nb=name.encode()
        if isinstance(v,dict):
            did=enc(v)
            ents.append(struct.pack("<BH",1,len(nb))+nb+did); keys.append(name)
        else:
            mode,sha,sz=v
            ids=b"".join(blob_chunks[sha])
            ents.append(struct.pack("<BH",0,len(nb))+nb+struct.pack("<HQ",int(mode,8)&0xffff,sz)+ids); keys.append(name)
    raw=b"".join(ents); did=hashlib.sha256(raw).digest()
    if did not in dirobjs: dirobjs[did]=(len(raw),len(zlib.compress(raw,6)))
    # paged variant: content-defined page boundaries (about 64 entries), root lists page ids
    pages=[]; cur=[]
    for e,k in zip(ents,keys):
        cur.append(e)
        if hashlib.sha256(k.encode()).digest()[0]%64==0: pages.append(cur); cur=[]
    if cur: pages.append(cur)
    if len(pages)==1: pid=put(paged,b"".join(pages[0]))
    else: pid=put(paged,b"".join(put(paged,b"".join(pg)) for pg in pages))
    node_paged_ids.append(pid)
    return did
node_paged_ids=[]
rows=[]
seen_blob=set(); seen_chunk=set(); seen_dir=set()
cum=dict(plain=0,plain4k=0,hard=0,hard4k=0,perfile_z=0,wholecas_z=0,chunk_raw=0,chunk_z=0,dir_z=0,dir_raw=0,pg_z=0)
r4=lambda x:(x+4095)//4096*4096
seen_blobz=set()
for i,s in enumerate(snaps):
    for path,mode,sha,sz in s["files"]:
        cum["plain"]+=sz; cum["plain4k"]+=r4(sz)
        cum["perfile_z"]+=blob_z[sha]
        if sha not in seen_blob:
            seen_blob.add(sha); cum["hard"]+=sz; cum["hard4k"]+=r4(sz); cum["wholecas_z"]+=blob_z[sha]+36
            for cid in blob_chunks[sha]:
                if cid not in seen_chunk:
                    seen_chunk.add(cid); l,z=chunks[cid]; cum["chunk_raw"]+=l; cum["chunk_z"]+=z+36
    before=set(dirobjs); bp=set(paged)
    enc(build(s["files"]))  # fills dirobjs
    new=set(dirobjs)-before
    for d in set(paged)-bp: cum["pg_z"]+=paged[d][1]+36
    for d in new: cum["dir_raw"]+=dirobjs[d][0]; cum["dir_z"]+=dirobjs[d][1]+36
    rows.append(dict(k=i+1,**cum,toy=cum["chunk_z"]+cum["dir_z"]+100*(i+1),toy_paged=cum["chunk_z"]+cum["pg_z"]+100*(i+1),commit=s["commit"]))
    if i%20==0: print(i,rows[-1],flush=True)
# validate: one real tar.gz
s=snaps[-1]; buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode="w:gz",compresslevel=6) as tf:
    for path,mode,sha,sz in s["files"]:
        ti=tarfile.TarInfo(path); ti.size=sz; ti.mode=int(mode,8)&0o777
        tf.addfile(ti,io.BytesIO(blobs[sha]))
real_tgz=len(buf.getvalue())
sumz=sum(blob_z[sha] for _,_,sha,_ in s["files"])
# archive of unique blobs (hardlink-style) xz
b2=io.BytesIO()
with tarfile.open(fileobj=b2,mode="w") as tf:
    for sha in sorted(seen_blob):
        ti=tarfile.TarInfo(sha); ti.size=len(blobs[sha]); tf.addfile(ti,io.BytesIO(blobs[sha]))
raw=b2.getvalue()
uniq_gz=len(zlib.compress(raw,6)); uniq_xz=len(lzma.compress(raw,preset=6))
res=dict(rows=rows,last_snapshot_tgz=real_tgz,last_snapshot_sum_zlib=sumz,last_snapshot_logical=sum(x[3] for x in s["files"]),
 uniq_tar_gz=uniq_gz,uniq_tar_xz=uniq_xz,uniq_tar_raw=len(raw),n_chunks=len(chunks),n_blobs=len(seen_blob),
 n_dirobjs=len(dirobjs),n_files_total=sum(len(s["files"]) for s in snaps))
json.dump(res,open("result.json","w"))
print({k:v for k,v in res.items() if k!="rows"}); print(rows[-1])
