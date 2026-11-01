"""E2: projected 2D covariance of a 3D Gaussian under an equidistant fisheye lens.
Monte-Carlo ground truth against (a) first-order Jacobian J S J^T and (b) 3DGUT's unscented transform."""
import numpy as np
from fisheye_toys import *

rng = np.random.default_rng(2610)
angles = [0, 20, 40, 60, 80, 90, 100]
sizes = [0.05, 0.1, 0.2]
rows = []
for th in angles:
    for rs in sizes:
        e_fo, e_ut, a_fo, a_ut = [], [], [], []
        for _ in range(40):
            mu, S = random_gaussian(rng, np.deg2rad(th), rs)
            _, Cmc = mc_cov(rng, mu, S)
            _, Cfo = first_order_cov(mu, S)
            _, Cut = ut_cov(mu, S)
            e_fo.append(rel_fro(Cfo, Cmc)); e_ut.append(rel_fro(Cut, Cmc))
            a_fo.append(np.sqrt(np.linalg.det(Cfo) / np.linalg.det(Cmc)))
            a_ut.append(np.sqrt(np.linalg.det(Cut) / np.linalg.det(Cmc)))
        q = lambda x, p: float(np.percentile(x, p))
        rows.append(dict(theta_deg=th, rel_size=rs,
                         first_order_err_median=round(q(e_fo, 50), 4), first_order_err_p90=round(q(e_fo, 90), 4),
                         ut_err_median=round(q(e_ut, 50), 4), ut_err_p90=round(q(e_ut, 90), 4),
                         first_order_area_ratio_median=round(q(a_fo, 50), 4), ut_area_ratio_median=round(q(a_ut, 50), 4)))
        print(rows[-1])
dump('results-cov.json', dict(note='40 random Gaussians per cell; error = ||C_hat - C_mc||_F / ||C_mc||_F; area ratio = sqrt(det C_hat / det C_mc)',
                              camera=dict(model="OPENCV_FISHEYE, FIORD Hall_In camera 1 at 1/4 resolution", theta_max_deg=100), rows=rows))
