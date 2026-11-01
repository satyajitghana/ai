"""Numeric check of Proposition G.3 (paper Appendix G.2): among affine images of a regular m-gon (unit
circumradius) contained in a disk of radius 1, the largest has area m*sin(2*pi/m)/2.
We sample random affine maps B (random singular values + rotations), compute the smallest enclosing disk of the
image's vertices (brute force over pairs/triples), scale the image so that disk has radius 1, and record the area."""
import itertools, json, math, numpy as np
rng = np.random.default_rng(0)

def min_enclosing_radius(P):
    best = None
    pts = [tuple(p) for p in P]
    cands = []
    for a, b in itertools.combinations(range(len(P)), 2):
        c = (P[a] + P[b]) / 2; r = np.linalg.norm(P[a] - P[b]) / 2; cands.append((c, r))
    for a, b, d in itertools.combinations(range(len(P)), 3):
        A = np.array([P[b] - P[a], P[d] - P[a]]) * 2
        rhs = np.array([P[b] @ P[b] - P[a] @ P[a], P[d] @ P[d] - P[a] @ P[a]])
        if abs(np.linalg.det(A)) < 1e-12: continue
        c = np.linalg.solve(A, rhs); r = np.linalg.norm(c - P[a]); cands.append((c, r))
    for c, r in sorted(cands, key=lambda t: t[1]):
        if np.all(np.linalg.norm(P - c, axis=1) <= r + 1e-9): return r
    return None

def poly_area(P):
    x, y = P[:, 0], P[:, 1]
    return 0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))

res = {}
for m in (3, 4, 6):
    ang = 2 * math.pi * np.arange(m) / m
    V = np.stack([np.cos(ang), np.sin(ang)], 1)
    closed = m * math.sin(2 * math.pi / m) / 2
    best = 0.0; viol = 0; N = 6000
    for _ in range(N):
        s1 = math.exp(rng.uniform(-1.2, 1.2)); s2 = 1.0 if rng.random() < 0.0 else math.exp(rng.uniform(-1.2, 1.2))
        a, b = rng.uniform(0, 2 * math.pi, 2)
        Ra = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]]); Rb = np.array([[math.cos(b), -math.sin(b)], [math.sin(b), math.cos(b)]])
        B = Ra @ np.diag([s1, s2]) @ Rb
        P = V @ B.T
        r = min_enclosing_radius(P)
        area = poly_area(P) / (r * r)          # area when scaled so the enclosing disk has radius 1
        best = max(best, area)
        if area > closed + 1e-9: viol += 1
    res[m] = dict(closed_form=closed, best_sampled=best, violations=viol, samples=N)
    print(m, f"closed {closed:.4f}  best sampled {best:.4f}  violations {viol}/{N}")
print("hexagon/square", res[6]['closed_form'] / res[4]['closed_form'], "3*sqrt(3)/4 =", 3 * math.sqrt(3) / 4)
print("hexagon/triangle", res[6]['closed_form'] / res[3]['closed_form'])
print("hexagon / disk area", res[6]['closed_form'] / math.pi)
json.dump(res, open('prop_g3.json', 'w'), indent=1)
