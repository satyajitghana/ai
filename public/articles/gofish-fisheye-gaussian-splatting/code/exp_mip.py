"""E4: Calibrated Mip Filtering identities, re-implemented from the paper (Eq. 4, Propositions 2 and 3) and from the
reference formulas in view_observation_filter.py (footprint_covariance, mass_preserving_factor)."""
import numpy as np
from fisheye_toys import *

rng = np.random.default_rng(42)
GAMMA = 0.3

# (1) the footprint lifts to exactly gamma*I in the image: J Q J^T = gamma I
err = []
for _ in range(20000):
    J = rng.normal(size=(2, 3)) * rng.uniform(0.1, 50)
    Q = footprint_cov(J, GAMMA)
    err.append(np.abs(J @ Q @ J.T - GAMMA * np.eye(2)).max())
res = dict(footprint_identity_max_abs_error=float(max(err)))

# (2) Proposition 3: sqrt(det S / det C) = m * sqrt(s(S)/s(C)) <= m, equality iff the ray is an eigenvector of S
rows = []
cases = {'round (1,1,1)': (1, 1, 1), 'rod (1,.1,.1)': (1, .1, .1), 'surfel (1,1,.03)': (1, 1, .03)}
for name, sc in cases.items():
    ratios, ident = [], []
    for _ in range(3000):
        th = rng.uniform(0, np.deg2rad(95))
        mu, _S = random_gaussian(rng, th, 0.1, dist=rng.uniform(1.5, 4.0))
        d = mu / np.linalg.norm(mu)
        Q, _ = np.linalg.qr(rng.normal(size=(3, 3)))
        # world size chosen so the largest projected sigma is 0.5 to 3 px
        J = jacobian(mu)
        px = rng.uniform(0.5, 3.0)
        world = px / np.linalg.svd(J, compute_uv=False)[0]
        S = Q @ np.diag((world * np.array(sc)) ** 2) @ Q.T
        C = S + footprint_cov(J, GAMMA)
        m = mass_factor(S, J, GAMMA)
        vol = np.sqrt(np.linalg.det(S) / np.linalg.det(C))
        s = lambda M: 1.0 / (d @ np.linalg.inv(M) @ d)
        ident.append(abs(vol - m * np.sqrt(s(S) / s(C))) / vol)
        ratios.append(vol / m)
    ratios = np.array(ratios)
    rows.append(dict(shape=name, volume_ratio_over_m_median=round(float(np.median(ratios)), 4),
                     p10=round(float(np.percentile(ratios, 10)), 4), min=round(float(ratios.min()), 4),
                     max=round(float(ratios.max()), 6), identity_max_rel_error=float(max(ident))))
    print(rows[-1])
res['proposition3'] = rows

# (3) the 3D-filter radius eps = sqrt(0.2) / sigma_min(J) for a 1 m point under the lens of the other experiments
eps = {}
for th in (0, 45, 80, 100):
    J = jacobian(np.array([np.sin(np.deg2rad(th)), 0, np.cos(np.deg2rad(th))]))
    sv = np.linalg.svd(J, compute_uv=False)
    eps[f'{th}deg'] = dict(sigma_max_px_per_m=round(float(sv[0]), 2), sigma_min_px_per_m=round(float(sv[1]), 2),
                           eps_mm=round(float(np.sqrt(0.2) / sv[1] * 1000), 2))
res['filter_radius_at_1m'] = eps
dump('results-mip.json', res)
print(res['footprint_identity_max_abs_error'], eps)
