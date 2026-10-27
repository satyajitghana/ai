"""Toy On-Policy Self-Training. numpy only, CPU. Mechanism test, not a replication.

World: questions are points x in [-1,1]^2; the true answer is a 4-way class = 2*c + f,
emitted as two binary tokens (c, then f given c). "Topic" = the half-plane x1 < 0.
The model is a one-hidden-layer MLP over [x, hint onehot(5), step, prefix onehot(2)].
Hint slot 4 = no hint (student); hint k = privileged candidate answer (teacher).
"""
import sys, json
import numpy as np

H = 48
IN = 2 + 5 + 1 + 2
ALPHA = 0.8


def true_class(x):
    c = (np.sin(3 * x[:, 0]) + x[:, 1] > 0).astype(int)
    f = (x[:, 0] - 0.6 * x[:, 1] ** 2 > -0.15).astype(int)
    return 2 * c + f


def feats(x, hint, step, prefix):
    n = len(x)
    h = np.zeros((n, 5)); h[np.arange(n), hint] = 1
    p = np.zeros((n, 2))
    if step == 1:
        p[np.arange(n), prefix] = 1
    return np.concatenate([x, h, np.full((n, 1), float(step)), p], 1)


class Net:
    def __init__(s, rng):
        s.p = {"W1": rng.normal(0, 0.5, (IN, H)), "b1": np.zeros(H),
               "W2": rng.normal(0, 0.3, (H, 2)), "b2": np.zeros(2)}
        s.m = {k: np.zeros_like(v) for k, v in s.p.items()}
        s.v = {k: np.zeros_like(v) for k, v in s.p.items()}
        s.t = 0

    def copy(s):
        o = Net.__new__(Net)
        o.p = {k: v.copy() for k, v in s.p.items()}
        return o

    def fwd(s, X):
        h = np.tanh(X @ s.p["W1"] + s.p["b1"])
        return h, h @ s.p["W2"] + s.p["b2"]

    def logits(s, X):
        return s.fwd(X)[1]

    def adam(s, g, lr):
        s.t += 1
        for k in s.p:
            s.m[k] = 0.9 * s.m[k] + 0.1 * g[k]
            s.v[k] = 0.999 * s.v[k] + 0.001 * g[k] ** 2
            mh = s.m[k] / (1 - 0.9 ** s.t); vh = s.v[k] / (1 - 0.999 ** s.t)
            s.p[k] -= lr * mh / (np.sqrt(vh) + 1e-8)

    def grad(s, X, dlog):
        h, _ = s.fwd(X)
        dh = (dlog @ s.p["W2"].T) * (1 - h ** 2)
        return {"W1": X.T @ dh, "b1": dh.sum(0), "W2": h.T @ dlog, "b2": dlog.sum(0)}


def softmax(z):
    z = z - z.max(1, keepdims=True); e = np.exp(z); return e / e.sum(1, keepdims=True)


def two_step(net, x, hint, rng=None, greedy=False, force=None):
    """Roll out both tokens. Returns tokens (n,2), probs p1,p2 (n,2) at the visited prefix."""
    X0 = feats(x, hint, 0, None)
    p1 = softmax(net.logits(X0))
    if force is not None:
        t1 = force[:, 0]
    else:
        t1 = (p1.argmax(1) if greedy else (rng.random(len(x)) < p1[:, 1]).astype(int))
    X1 = feats(x, hint, 1, t1)
    p2 = softmax(net.logits(X1))
    if force is not None:
        t2 = force[:, 1]
    else:
        t2 = (p2.argmax(1) if greedy else (rng.random(len(x)) < p2[:, 1]).astype(int))
    return np.stack([t1, t2], 1), (X0, X1), (p1, p2)


def accuracy(net, x):
    t, _, _ = two_step(net, x, np.full(len(x), 4), greedy=True)
    return float(((2 * t[:, 0] + t[:, 1]) == true_class(x)).mean())


import os
N_LAB=int(os.environ.get('N_LAB','20'))

def pretrain(rng, n_lab=None, steps=700):
    n_lab = n_lab or N_LAB
    net = Net(rng)
    x = rng.uniform(-1, 1, (n_lab, 2)); y = true_class(x)
    for _ in range(steps):
        r = rng.random(n_lab)
        hint = np.where(r < 0.4, 4, np.where(r < 0.85, y, rng.integers(0, 4, n_lab)))
        c, f = y // 2, y % 2
        X0 = feats(x, hint, 0, None); X1 = feats(x, hint, 1, c)
        g = {k: 0 for k in net.p}
        for X, tgt in ((X0, c), (X1, f)):
            p = softmax(net.logits(X)); d = p.copy(); d[np.arange(n_lab), tgt] -= 1
            gg = net.grad(X, d / n_lab)
            for k in g: g[k] = g[k] + gg[k]
        net.adam(g, 5e-3)
    return net


def jsd_grad(p, q):
    """d D_alpha(p||q) / d logits, D = a KL(q||m) + (1-a) KL(p||m), m=(1-a)q + a p. q const."""
    a = ALPHA
    m = (1 - a) * q + a * p
    eps = 1e-12
    g = -a * a * q / (m + eps) + (1 - a) * (np.log((p + eps) / (m + eps)) + 1 - a * p / (m + eps))
    return p * (g - (p * g).sum(1, keepdims=True))


def jsd(p, q):
    a = ALPHA; m = (1 - a) * q + a * p; e = 1e-12
    return (a * (q * np.log((q + e) / (m + e))).sum(1) + (1 - a) * (p * np.log((p + e) / (m + e))).sum(1))


def generate(gen, rng, n, topic_lo=-1.0, topic_hi=0.0):
    x = np.stack([rng.uniform(topic_lo, topic_hi, n), rng.uniform(-1, 1, n)], 1)
    t, _, _ = two_step(gen, x, np.full(n, 4), rng=rng)  # candidate answer: own sample, T=1
    a = 2 * t[:, 0] + t[:, 1]
    return x, a


def verify(gen, x, a, rng, noise=0.05):
    ok1 = np.zeros(len(x), bool)
    t, _, _ = two_step(gen, x, np.full(len(x), 4), greedy=True)
    ok1 = (2 * t[:, 0] + t[:, 1]) == a
    xp = x + rng.normal(0, noise, x.shape)  # "paraphrase": nearby re-asking of the question
    t, _, _ = two_step(gen, xp, np.full(len(x), 4), greedy=True)
    ok2 = (2 * t[:, 0] + t[:, 1]) == a
    return ok1 & ok2


def gate(student, x, a, rng, G=8):
    agree = np.ones(len(x), bool)
    for _ in range(G):
        t, _, _ = two_step(student, x, np.full(len(x), 4), rng=rng)
        agree &= (2 * t[:, 0] + t[:, 1]) == a
    return ~agree


def run(seed, method="opst", beta=0.05, rounds=7, n_round=300, steps=20, bs=64,
        use_verify=True, use_gate=True, wrong_frac=0.0, auth_q=None, placebo=False, lr=2e-3, log=False):
    rng = np.random.default_rng(seed)
    base = pretrain(rng)
    xin = np.stack([rng.uniform(-1, 0, 4000), rng.uniform(-1, 1, 4000)], 1)
    xout = np.stack([rng.uniform(0, 1, 4000), rng.uniform(-1, 1, 4000)], 1)
    student = base.copy(); teacher = base.copy()
    for n_ in (student, teacher):
        n_.m = {k: np.zeros_like(v) for k, v in n_.p.items()}; n_.v = {k: np.zeros_like(v) for k, v in n_.p.items()}; n_.t = 0
    curve = [(0, accuracy(teacher, xin), accuracy(teacher, xout))]
    kept = []
    for r in range(1, rounds + 1):
        gen = teacher if method != "sft" else student
        x, a = generate(gen, rng, n_round)
        if auth_q is not None:  # answer-first authoring: candidate is the truth w.p. auth_q, else a random wrong class
            tc = true_class(x); bad = rng.random(n_round) >= auth_q
            a = np.where(bad, (tc + rng.integers(1, 4, n_round)) % 4, tc)
        if wrong_frac > 0:
            w = rng.random(n_round) < wrong_frac
            a = np.where(w, (a + rng.integers(1, 4, n_round)) % 4, a)
        keep = np.ones(n_round, bool)
        if use_verify: keep &= verify(gen, x, a, rng)
        if use_gate: keep &= gate(student, x, a, rng)
        kept.append(int(keep.sum()))
        x, a = x[keep], a[keep]
        if len(x) < 8:
            curve.append((r, accuracy(teacher if method != "sft" else student, xin), accuracy(teacher if method != "sft" else student, xout))); continue
        if placebo: a = a[rng.permutation(len(a))]
        for _ in range(steps):
            idx = rng.integers(0, len(x), bs); xb, ab = x[idx], a[idx]
            if method == "sft":
                tgt = np.stack([ab // 2, ab % 2], 1)
                _, (X0, X1), (p1, p2) = two_step(student, xb, np.full(bs, 4), force=tgt)
                g = {k: 0 for k in student.p}
                for X, p, tk in ((X0, p1, tgt[:, 0]), (X1, p2, tgt[:, 1])):
                    d = p.copy(); d[np.arange(bs), tk] -= 1
                    gg = student.grad(X, d / bs)
                    for k in g: g[k] = g[k] + gg[k]
                student.adam(g, lr)
            else:
                toks, (S0, S1), (sp1, sp2) = two_step(student, xb, np.full(bs, 4), rng=rng)  # on-policy rollout
                T0 = feats(xb, ab, 0, None); T1 = feats(xb, ab, 1, toks[:, 0])  # teacher scores the student's prefix
                tq1 = softmax(teacher.logits(T0)); tq2 = softmax(teacher.logits(T1))
                g = {k: 0 for k in student.p}
                for X, p, q in ((S0, sp1, tq1), (S1, sp2, tq2)):
                    gg = student.grad(X, jsd_grad(p, q) / bs)
                    for k in g: g[k] = g[k] + gg[k]
                student.adam(g, lr)
                for k in teacher.p:
                    teacher.p[k] = (1 - beta) * teacher.p[k] + beta * student.p[k]
        ev = teacher if method != "sft" else student
        curve.append((r, accuracy(ev, xin), accuracy(ev, xout)))
        if log: print(seed, curve[-1], kept[-1])
    return curve, kept


def check_grad():
    rng = np.random.default_rng(0)
    z = rng.normal(size=(3, 2)); q = softmax(rng.normal(size=(3, 2)))
    p = softmax(z); g = jsd_grad(p, q)
    num = np.zeros_like(z)
    for i in range(3):
        for j in range(2):
            zp = z.copy(); zp[i, j] += 1e-6; zm = z.copy(); zm[i, j] -= 1e-6
            num[i, j] = (jsd(softmax(zp), q)[i] - jsd(softmax(zm), q)[i]) / 2e-6
    return float(np.abs(g - num).max())


if __name__ == "__main__":
    if sys.argv[1] == "grad":
        print("max |analytic - numeric| =", check_grad())
    elif sys.argv[1] == "one":
        print(run(int(sys.argv[2]), method=sys.argv[3], log=True))
