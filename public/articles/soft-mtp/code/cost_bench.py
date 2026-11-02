"""Cost of the extra term at a realistic vocabulary: one MTP step's loss+backward on random hidden states.
Measures CPU time (process_time, robust to a loaded box) and peak RSS (fresh subprocess per method).
methods: ce (plain MTP), soft (plain MTP + straight-through coupling), kl (explicit KL with materialised teacher+student)."""
import sys, time, json, resource, torch
method, N, d, V, K = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
torch.set_num_threads(2); torch.manual_seed(0)
W = (torch.randn(V, d) * 0.05).requires_grad_(True)
h0 = torch.randn(N, d, requires_grad=True)
hk = [torch.randn(N - k, d, requires_grad=True) for k in range(1, K + 1)]
y = torch.randint(0, V, (N,))
base = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
def step():
    for p in [W, h0] + hk: p.grad = None
    h = h0
    terms = []
    for k in range(1, K + 1):
        n = N - k
        terms.append(torch.nn.functional.cross_entropy(hk[k - 1] @ W.T, y[k:k + n]) if method != "kl" else None)
        if method == "soft":
            h = torch.cat([h[:k], h[k:] + (hk[k - 1].detach() - hk[k - 1])], 0)
        if method == "kl":
            teacher = (h0[k:k + n].detach() @ W.T).detach()
            student = hk[k - 1] @ W.T
            terms[-1] = (torch.softmax(teacher, -1) * (torch.log_softmax(teacher, -1) - torch.log_softmax(student, -1))).sum(-1).mean()
    ntp = torch.nn.functional.cross_entropy(h @ W.T, y)
    (ntp + torch.stack(terms).mean()).backward()
step()                       # warm-up
t0 = time.process_time(); w0 = time.time()
reps = 3
for _ in range(reps): step()
cpu = (time.process_time() - t0) / reps
peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
print(json.dumps({"method": method, "N": N, "d": d, "V": V, "K": K, "cpu_s_per_step": round(cpu, 3), "peak_rss_mb": round(peak, 0)}))
