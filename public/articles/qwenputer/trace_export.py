import json, numpy as np, torch
torch.set_num_threads(1)
from transformers.models.qwen3_5.modeling_qwen3_5 import torch_recurrent_gated_delta_rule as gdr
DK=128; SCALE=DK**0.5; KS=2.0**20
def onehot(i):
    e=np.zeros(DK,np.float32); e[i]=KS; return e
S=None
def tok(a,val,write):
    global S
    f=lambda x: torch.as_tensor(np.asarray(x),dtype=torch.float32)
    v=np.zeros((1,4),np.float32)
    if write: v[0]=val
    o,S=gdr(f(onehot(a)[None])[None,:,None],f(onehot(a)[None])[None,:,None],f(v)[None,:,None],f(np.zeros(1))[None,:,None],f(np.array([1.0 if write else 0.0]))[None,:,None],initial_state=S,output_final_state=True,use_qk_l2norm_in_kernel=True)
    return o[0,0,0].numpy()*SCALE
def W(a,w): tok(a,[(w>>(8*i))&255 for i in range(4)],True)
def R(a):
    b=np.rint(tok(a,None,False)).astype(np.int64); return int(sum(int(b[i])<<(8*i) for i in range(4)))
M=0xFFFFFFFF
prog=[("addi",1,0,100),("addi",2,0,0),("addi",3,0,0),("addi",2,2,1),("add",3,3,2),("bne",2,1,-2)]
asm={"addi":lambda a,b,c:f"addi x{a}, x{b}, {c}","add":lambda a,b,c:f"add  x{a}, x{b}, x{c}","bne":lambda a,b,c:f"bne  x{a}, x{b}, {c:+d}"}
for r in range(8): W(r,0)
pc=0; out=[]
while pc<len(prog) and len(out)<30:
    op,a,b,c=prog[pc]; ops=[]; pc2=pc+1
    if op=="addi": x=R(b); ops.append(["R",b,x]); r=(x+c)&M; W(a,r); ops.append(["W",a,r])
    elif op=="add": x=R(b); y=R(c); ops+=[["R",b,x],["R",c,y]]; r=(x+y)&M; W(a,r); ops.append(["W",a,r])
    elif op=="bne":
        x=R(a); y=R(b); ops+=[["R",a,x],["R",b,y]]
        if x!=y: pc2=pc+c
    regs=[R(i) for i in range(8)]   # inspection reads (not counted in the program's tokens)
    out.append(dict(pc=pc,asm=asm[op](a,b,c),ops=ops,regs=regs,next=pc2)); pc=pc2
json.dump(out,open('trace.json','w'),indent=1); print(len(out)); print(out[0]); print(out[5]); print(out[-1])
