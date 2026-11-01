"""Effective rank (Roy & Vetterli 2007) of the logit map W_gamma = lm_head.weight * norm.weight for the authors'
released 167M NTP / hard-MTP / Soft-MTP checkpoints. Only the lm_head and norm tensors are fetched (HTTP Range)."""
import json, struct, urllib.request, torch, math, sys
torch.set_num_threads(2)
def get(url, a, b):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'Range': f'bytes={a}-{b}'}), timeout=300).read()
res = {}
for m in ['ntp', 'hard-mtp', 'soft-mtp']:
    u = f'https://huggingface.co/JaydenTeoh/{m}-167m-model/resolve/main/model.safetensors'
    n = struct.unpack('<Q', get(u, 0, 7))[0]
    h = json.loads(get(u, 8, 8 + n - 1)); h.pop('__metadata__', None); base = 8 + n
    def tensor(name):
        i = h[name]; a, b = i['data_offsets']
        assert i['dtype'] == 'F32'
        return torch.frombuffer(bytearray(get(u, base + a, base + b - 1)), dtype=torch.float32).reshape(i['shape'])
    W = tensor('lm_head.weight'); g = tensor('norm.weight')
    Wg = W * g[None, :]
    s = torch.linalg.svdvals(Wg.double())
    p = s / s.sum()
    er = float(torch.exp(-(p * torch.log(p.clamp_min(1e-30))).sum()))
    res[m] = {"effective_rank": er, "shape": list(Wg.shape), "sv_top": [float(x) for x in s[:8]], "sv_sum": float(s.sum()),
              "sv_quantiles_norm": [float(s[int(q * (len(s) - 1))] / s[0]) for q in (0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0)],
              "n_tensors": len(h), "n_params": sum(math.prod(v['shape']) for v in h.values()),
              "head_has_norms": [k for k in h if 'norm' in k and 'trunk' not in k][:6]}
    print(m, res[m]['effective_rank'], flush=True)
json.dump(res, open('eff_rank_167m.json', 'w'), indent=1)
