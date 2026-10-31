import json, math, random, sys
import numpy as np
import torch
torch.set_num_threads(1)
from transformers.models.qwen3_5.modeling_qwen3_5 import torch_recurrent_gated_delta_rule as gdr

DK = 128   # key head dim = rows of the state (Qwen3.5-4B linear_key_head_dim)
SCALE = DK ** 0.5
OUT = {}

def run(q, k, v, g, beta, state=None):
    """q,k: [T,dk]; v: [T,dv]; g,beta: [T]. One head, batch 1. Returns outputs [T,dv] (descaled) and final state."""
    f = lambda x: torch.as_tensor(np.asarray(x), dtype=torch.float32)
    q, k, v, g, beta = f(q)[None, :, None], f(k)[None, :, None], f(v)[None, :, None], f(g)[None, :, None], f(beta)[None, :, None]
    o, S = gdr(q, k, v, g, beta, initial_state=state, output_final_state=True, use_qk_l2norm_in_kernel=True)
    return o[0, :, 0].numpy() * SCALE, S

KS = 1.0   # pre-norm magnitude of one-hot keys/queries (the real model carries huge magnitudes through its 'ballast')
def onehot(i, n=DK):
    e = np.zeros(n, dtype=np.float32); e[i] = KS; return e

# ---------------- E1: exact RAM with integer (byte) values --------------------------------
rng = random.Random(2077)
def e1(kind, T=20000, dv=8):
    shadow = np.zeros((DK, dv), dtype=np.float64)
    q = np.zeros((T, DK), np.float32); k = np.zeros((T, DK), np.float32); v = np.zeros((T, dv), np.float32)
    beta = np.zeros(T, np.float32); g = np.zeros(T, np.float32)
    ops = []
    for t in range(T):
        a = rng.randrange(DK)
        if rng.random() < 0.6:
            val = np.array([rng.randrange(256) for _ in range(dv)], dtype=np.float32) if kind == "bytes" else np.array([rng.gauss(0, 1) for _ in range(dv)], dtype=np.float32)
            k[t] = onehot(a); v[t] = val; beta[t] = 1.0; q[t] = onehot(a)
            shadow[a] = val; ops.append(("w", a, shadow[a].copy()))
        else:
            q[t] = onehot(a); k[t] = onehot(a); beta[t] = 0.0
            ops.append(("r", a, shadow[a].copy()))
    o, _ = run(q, k, v, g, beta)
    err = np.array([np.abs(o[t] - ops[t][2]).max() for t in range(T)])
    rint_bad = int(sum(1 for t in range(T) if np.abs(np.rint(o[t]) - ops[t][2]).max() > 0)) if kind == "bytes" else None
    return dict(kind=kind, key_scale=KS, tokens=T, writes=int(sum(1 for x in ops if x[0] == "w")), reads=int(sum(1 for x in ops if x[0] == "r")),
                max_abs_err=float(err.max()), tokens_not_bit_exact=int((err > 0).sum()), tokens_wrong_after_rounding=rint_bad,
                max_abs_val=float(max(np.abs(x[2]).max() for x in ops)))
E1 = []
for KS in (1.0, 2.0 ** 10, 2.0 ** 20):
    rng = random.Random(2077); E1.append(e1("bytes"))
rng = random.Random(2077); E1.append(e1("floats"))
OUT["E1"] = E1
KS = 2.0 ** 20
print("E1", OUT["E1"], flush=True)

# ---------------- E2: what breaks it --------------------------------------------------------
def single(addr, val, g_after, beta_w, T_idle):
    dv = 1
    T = 1 + T_idle + 1
    q = np.zeros((T, DK), np.float32); k = np.zeros((T, DK), np.float32); v = np.zeros((T, dv), np.float32)
    beta = np.zeros(T, np.float32); g = np.zeros(T, np.float32)
    k[0] = onehot(addr); v[0] = val; beta[0] = beta_w
    g[1:] = g_after            # decay applied on every later token (the write token itself is decayed 0)
    q[-1] = onehot(addr); k[-1] = onehot(addr)
    o, _ = run(q, k, v, g, beta)
    return float(o[-1, 0])
dec = []
for d in [1.0, 0.99999, 0.9999, 0.999, 0.99]:
    gg = math.log(d)
    r = single(3, 100.0, gg, 1.0, 1000)
    dec.append(dict(decay_per_token=d, idle_tokens=1000, read_back=round(r, 4), expected=round(100.0 * d ** 1001, 4)))
OUT["E2_decay"] = dec; print("E2 decay", dec, flush=True)
bl = []
for b in [1.0, 0.9, 0.5, 0.1]:
    r = single(3, 100.0, 0.0, b, 0)
    bl.append(dict(beta=b, read_back_after_one_write_of_100=round(r, 4)))
OUT["E2_beta"] = bl; print("E2 beta", bl, flush=True)
# blend: old value u, then write v with beta
def blend(u, v_, b):
    T = 3; q = np.zeros((T, DK), np.float32); k = np.zeros((T, DK), np.float32); vv = np.zeros((T, 1), np.float32)
    beta = np.array([1.0, b, 0.0], np.float32); g = np.zeros(T, np.float32)
    k[0] = onehot(5); vv[0] = u; k[1] = onehot(5); vv[1] = v_; q[2] = onehot(5); k[2] = onehot(5)
    return float(run(q, k, vv, g, beta)[0][-1, 0])
OUT["E2_blend"] = [dict(beta=b, old=40.0, new=200.0, read_back=round(blend(40.0, 200.0, b), 4), expected=40.0 + b * 160.0) for b in (1.0, 0.5)]
print("E2 blend", OUT["E2_blend"], flush=True)

# non-one-hot keys: fast-weight crosstalk
def crosstalk(n_items, dv=16, seeds=5):
    errs = []
    for s in range(seeds):
        r = np.random.default_rng(s)
        keys = r.standard_normal((n_items, DK)).astype(np.float32); keys /= np.linalg.norm(keys, axis=1, keepdims=True)
        vals = r.integers(0, 256, size=(n_items, dv)).astype(np.float32)
        T = 2 * n_items
        q = np.zeros((T, DK), np.float32); k = np.zeros((T, DK), np.float32); v = np.zeros((T, dv), np.float32)
        beta = np.zeros(T, np.float32); g = np.zeros(T, np.float32)
        k[:n_items] = keys; v[:n_items] = vals; beta[:n_items] = 1.0
        q[n_items:] = keys; k[n_items:] = keys
        o, _ = run(q, k, v, g, beta)
        rd = o[n_items:]
        errs.append(float(np.abs(rd - vals).mean() / np.abs(vals).mean()))
    return float(np.mean(errs))
ct = [dict(items=n, relative_read_error=round(crosstalk(n), 4)) for n in (16, 64, 128, 256, 512)]
OUT["E2_random_keys"] = ct; print("E2 random keys", ct, flush=True)
# orthonormal keys (one-hot) for the same counts
oh = []
for n in (16, 64, 128):
    vals = np.random.default_rng(1).integers(0, 256, size=(n, 16)).astype(np.float32)
    T = 2 * n; q = np.zeros((T, DK), np.float32); k = np.zeros((T, DK), np.float32); v = np.zeros((T, 16), np.float32)
    beta = np.zeros(T, np.float32); g = np.zeros(T, np.float32)
    for i in range(n): k[i] = onehot(i); v[i] = vals[i]; beta[i] = 1.0; q[n + i] = onehot(i); k[n + i] = onehot(i)
    o, _ = run(q, k, v, g, beta); oh.append(dict(items=n, max_abs_err=float(np.abs(o[n:] - vals).max())))
OUT["E2_onehot_keys"] = oh; print("E2 one-hot", oh, flush=True)

# ---------------- E3: sizes ------------------------------------------------------------------
lin_layers, full_layers, hv, dk, dv, kvh, hd = 24, 8, 32, 128, 128, 4, 256
state_bytes = lin_layers * hv * dk * dv * 4
kv_per_token = full_layers * 2 * kvh * hd * 2
OUT["E3"] = dict(gdn_state_bytes_fp32=state_bytes, gdn_state_MiB=state_bytes / 2**20, kv_bytes_per_token_bf16=kv_per_token,
                 crossover_tokens=state_bytes / kv_per_token, kv_GiB_at_1M_tokens=kv_per_token * 1_000_000 / 2**30)
print("E3", OUT["E3"], flush=True)

# ---------------- E4: a tiny register machine whose registers and memory live in delta-rule rows
REG0, MEM0, NROWS = 0, 8, 8 + 32          # rows 0-7 registers, 8-39 data memory
class Ram:
    def __init__(self):
        self.S = None; self.tokens = 0; self.log = []
    def _tok(self, a, val, write):
        q = onehot(a)[None]; k = onehot(a)[None]; v = np.zeros((1, 4), np.float32)
        if write: v[0] = val
        o, self.S = run(q, k, v, np.zeros(1, np.float32), np.array([1.0 if write else 0.0], np.float32), self.S)
        self.tokens += 1; return o[0]
    def write(self, a, word):
        b = [(word >> (8 * i)) & 255 for i in range(4)]
        self._tok(a, b, True); self.log.append(("W", a, word))
    def read(self, a):
        o = self._tok(a, None, False); b = np.rint(o).astype(np.int64)
        assert np.abs(o - b).max() < 0.01, "read-back not within rounding"
        w = int(sum(int(b[i]) << (8 * i) for i in range(4))); self.log.append(("R", a, w)); return w
M32 = 0xFFFFFFFF
def exec_prog(prog, maxsteps=40000):
    ram = Ram(); pc = 0; steps = 0; trace = []
    for r in range(8): ram.write(REG0 + r, 0)
    ram.tokens = 0; ram.log.clear()
    while pc < len(prog) and steps < maxsteps:
        op, a, b, c = prog[pc]; n0 = ram.tokens; pc2 = pc + 1
        if op == "addi":
            x = ram.read(b); r = (x + c) & M32; ram.write(a, r)
        elif op == "add":
            r = (ram.read(b) + ram.read(c)) & M32; ram.write(a, r)
        elif op == "sub":
            r = (ram.read(b) - ram.read(c)) & M32; ram.write(a, r)
        elif op == "bne":
            if ram.read(a) != ram.read(b): pc2 = pc + c
        elif op == "sw":
            ram.write(MEM0 + c, ram.read(a))
        elif op == "lw":
            ram.write(a, ram.read(MEM0 + c))
        steps += 1; trace.append(dict(pc=pc, op=op, args=[a, b, c], tokens=ram.tokens - n0)); pc = pc2
    regs = [ram.read(REG0 + r) for r in range(8)]
    return regs, steps, ram.tokens, trace

def pyexec(prog, maxsteps=40000):
    R = [0] * 8; mem = [0] * 32; pc = 0; steps = 0
    while pc < len(prog) and steps < maxsteps:
        op, a, b, c = prog[pc]; pc2 = pc + 1
        if op == "addi": R[a] = (R[b] + c) & M32
        elif op == "add": R[a] = (R[b] + R[c]) & M32
        elif op == "sub": R[a] = (R[b] - R[c]) & M32
        elif op == "bne":
            if R[a] != R[b]: pc2 = pc + c
        elif op == "sw": mem[c] = R[a]
        elif op == "lw": R[a] = mem[c]
        steps += 1; pc = pc2
    return R, steps

# x1 = n, x2 = i, x3 = acc  : sum 1..n
SUM = [("addi", 1, 0, 100), ("addi", 2, 0, 0), ("addi", 3, 0, 0), ("addi", 2, 2, 1), ("add", 3, 3, 2), ("bne", 2, 1, -2)]
# fibonacci: x1 = n, x2 = a, x3 = b, x4 = tmp, x5 = i
FIB = [("addi", 1, 0, 40), ("addi", 2, 0, 0), ("addi", 3, 0, 1), ("addi", 5, 0, 0),
       ("add", 4, 2, 3), ("addi", 2, 3, 0), ("addi", 3, 4, 0), ("addi", 5, 5, 1), ("bne", 5, 1, -4)]
# multiply by repeated addition: 12345 * 6789 -> x3 (wraps at 32 bits)
MUL = [("addi", 1, 0, 6789), ("addi", 2, 0, 0), ("addi", 3, 0, 0), ("addi", 4, 0, 12345),
       ("addi", 2, 2, 1), ("add", 3, 3, 4), ("bne", 2, 1, -2)]
progs = {"sum 1..100": SUM, "fibonacci(40)": FIB, "12345 x 6789 by repeated addition": MUL}
e4 = []
first_trace = None
for name, p in progs.items():
    regs, steps, toks, trace = exec_prog(p)
    R, s2 = pyexec(p)
    e4.append(dict(program=name, instructions=steps, tokens=toks, tokens_per_instruction=round(toks / steps, 3),
                   registers=regs, python_registers=R, identical=bool(regs == R and steps == s2)))
    if first_trace is None: first_trace = trace[:12]
    print("E4", e4[-1], flush=True)
OUT["E4"] = e4; OUT["E4_trace_sample"] = first_trace
json.dump(OUT, open("toy_results.json", "w"), indent=1)
print("done")
