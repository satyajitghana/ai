"""Fisheye projection toys for the GOFish article. numpy only, float64.

Everything here is our own re-implementation of rules described in the GOFish paper
(arXiv 2610.37818) and read in the repository's 3DGUT-derived sources
(gutProjector.cuh, view_observation_filter.py). It does not run GOFish.
"""
import json
import numpy as np

# unscented transform exactly as configs/render/3dgut.yaml: alpha=1, beta=2, kappa=0, D=3
UT_ALPHA, UT_BETA, UT_KAPPA, D = 1.0, 2.0, 0.0, 3
UT_LAMBDA = UT_ALPHA ** 2 * (D + UT_KAPPA) - D                 # 0
W_SIGMA = 1.0 / (2.0 * (D + UT_LAMBDA))                         # 1/6
W_CENTER_MEAN = UT_LAMBDA / (D + UT_LAMBDA)                     # 0
W_CENTER_COV = UT_LAMBDA / (D + UT_LAMBDA) + (1 - UT_ALPHA ** 2 + UT_BETA)   # 2
COV_DILATION = 0.3          # px^2, Params::CovarianceDilation
EXTENT_FACTOR = 3.33        # gutProjector.cuh
ALPHA_MIN = 1.0 / 255.0
TILE = 16

# Real calibration of FIORD Hall_In camera 1 (cameras.json in AllenTu/GOFish-scenes, OPENCV_FISHEYE at 3264 px),
# scaled by 1/4 because GOFish trains at images_4 (816 x 816).
FX, FY, CX, CY = 995.3539548285538 / 4, 998.8412296530948 / 4, 1612.0 / 4, 1617.0 / 4
K = np.array([0.037912020477107684, -0.023545169998035916, 0.0028405144828644122, -0.00045670077724780116])
WIDTH = 816
THETA_MAX = np.deg2rad(100.0)        # the lens rim: 1632 px at full resolution is 99.96 degrees on this calibration


def q_poly(t):
    return 1 + K[0] * t ** 2 + K[1] * t ** 4 + K[2] * t ** 6 + K[3] * t ** 8


def rho(t):
    return t * q_poly(t)


def drho(t):
    return 1 + 3 * K[0] * t ** 2 + 5 * K[1] * t ** 4 + 7 * K[2] * t ** 6 + 9 * K[3] * t ** 8


def project(X):
    """OpenCV fisheye (Kannala-Brandt): rho(theta) = theta (1 + k1 theta^2 + ... + k4 theta^8). X [...,3] -> pixels [...,2]."""
    X = np.asarray(X, float)
    rr = np.hypot(X[..., 0], X[..., 1])
    theta = np.arctan2(rr, X[..., 2])
    ratio = np.where(rr > 1e-12, theta / np.maximum(rr, 1e-300), 1.0 / np.maximum(X[..., 2], 1e-300))
    s = q_poly(theta) * ratio
    return np.stack([FX * X[..., 0] * s + CX, FY * X[..., 1] * s + CY], axis=-1)


def unproject(P):
    """Pixels [...,2] -> unit ray directions [...,3]: Newton on rho(theta) = theta_d from theta = theta_d."""
    P = np.asarray(P, float)
    xn, yn = (P[..., 0] - CX) / FX, (P[..., 1] - CY) / FY
    td = np.hypot(xn, yn)
    th = td.copy()
    for _ in range(12):
        th = th - (rho(th) - td) / drho(th)
    s = np.where(td > 1e-12, np.sin(th) / np.maximum(td, 1e-300), 1.0)
    return np.stack([xn * s, yn * s, np.cos(th)], axis=-1)


def jacobian(X):
    """2x3 Jacobian of the projection at X by central differences."""
    X = np.asarray(X, float)
    h = 1e-6 * np.linalg.norm(X)
    J = np.zeros((2, 3))
    for k in range(3):
        e = np.zeros(3); e[k] = h
        J[:, k] = (project(X + e) - project(X - e)) / (2 * h)
    return J


def random_gaussian(rng, theta, rel_size, dist=1.0):
    """A Gaussian at ray angle theta, mean distance dist, largest sigma = rel_size * dist."""
    phi = rng.uniform(0, 2 * np.pi)
    mu = dist * np.array([np.sin(theta) * np.cos(phi), np.sin(theta) * np.sin(phi), np.cos(theta)])
    Q, _ = np.linalg.qr(rng.normal(size=(3, 3)))
    if np.linalg.det(Q) < 0:
        Q[:, 0] *= -1
    scales = rel_size * dist * np.array([1.0, rng.uniform(0.25, 1.0), rng.uniform(0.25, 1.0)])
    return mu, Q @ np.diag(scales ** 2) @ Q.T


def mc_cov(rng, mu, S, n=40000):
    X = rng.multivariate_normal(mu, S, size=n)
    P = project(X)
    return P.mean(0), np.cov(P.T)


def first_order_cov(mu, S):
    J = jacobian(mu)
    return project(mu), J @ S @ J.T


def ut_cov(mu, S):
    """3DGUT's projected mean/covariance from 2D+1 sigma points (weights as in gutProjector.cuh; sigma points = mean +- sqrt(3) * columns of B = R diag(scale))."""
    w, Q = np.linalg.eigh(S)
    B = Q * np.sqrt(np.maximum(w, 0.0))          # S = B B^T with B = R diag(scale), the factor 3DGUT stores
    delta = np.sqrt(UT_ALPHA ** 2 * (D + UT_KAPPA))   # sqrt(3) for alpha = 1, kappa = 0
    pts = [mu] + [mu + delta * B[:, k] for k in range(D)] + [mu - delta * B[:, k] for k in range(D)]
    P = project(np.array(pts))
    m = W_CENTER_MEAN * P[0] + W_SIGMA * P[1:].sum(0)
    d0 = (P[0] - m)[:, None]
    C = W_CENTER_COV * d0 @ d0.T
    for p in P[1:]:
        d = (p - m)[:, None]
        C += W_SIGMA * d @ d.T
    return m, C


def ut_rect(mu, S, opacity=0.9):
    """The tile-selection rectangle 3DGUT builds: UT covariance + 0.3 px^2 dilation, extent factor 3.33 capped by opacity."""
    m, C = ut_cov(mu, S)
    Cd = C + COV_DILATION * np.eye(2)
    det = np.linalg.det(Cd)
    factor = min(EXTENT_FACTOR, np.sqrt(2 * np.log(opacity / ALPHA_MIN)))
    mid = 0.5 * (Cd[0, 0] + Cd[1, 1])
    lam = mid + np.sqrt(max(0.01, mid * mid - det))
    radius = factor * np.sqrt(lam)
    ext = np.minimum(factor * np.sqrt(np.diag(Cd)), radius)
    return m, ext


def pixel_grid():
    """Pixel centres of the 816 x 816 image and the mask of pixels whose ray is within the 100-degree lens rim."""
    u, v = np.meshgrid(np.arange(WIDTH) + 0.5, np.arange(WIDTH) + 0.5)
    P = np.stack([u, v], -1).reshape(-1, 2)
    xn, yn = (P[:, 0] - CX) / FX, (P[:, 1] - CY) / FY
    valid = np.hypot(xn, yn) <= rho(THETA_MAX)
    return P, valid, WIDTH


def ray_support_delta2(mu, S, dirs):
    """Squared minimal Mahalanobis distance of the ray t*d, t>=0, from the Gaussian (camera at the origin)."""
    Si = np.linalg.inv(S)
    a = mu @ Si @ mu
    Sd = dirs @ Si
    b = Sd @ mu
    c = np.einsum('ij,ij->i', Sd, dirs)
    return np.where(b > 0, a - b * b / c, a)


def rel_fro(A, B):
    return np.linalg.norm(A - B) / np.linalg.norm(B)


def footprint_cov(J, gamma=0.3):
    Jp = np.linalg.pinv(J)
    return gamma * Jp @ Jp.T


def mass_factor(S, J, gamma=0.3):
    P = J @ S @ J.T
    return np.sqrt(np.linalg.det(P) / np.linalg.det(P + gamma * np.eye(2)))


def dump(path, obj):
    with open(path, 'w') as fh:
        json.dump(obj, fh, indent=1)
