import numpy as np
def hat(w):
    return np.array([[0, -w[2], w[1]], [w[2], 0, -w[0]], [-w[1], w[0], 0]])
def so3_exp(w):
    th = np.linalg.norm(w)
    if th < 1e-12: return np.eye(3) + hat(w)
    k = hat(w / th)
    return np.eye(3) + np.sin(th) * k + (1 - np.cos(th)) * k @ k
def so3_log(R):
    c = np.clip((np.trace(R) - 1) / 2, -1, 1); th = np.arccos(c)
    v = np.array([R[2, 1] - R[1, 2], R[0, 2] - R[2, 0], R[1, 0] - R[0, 1]])
    if th < 1e-7: return v / 2
    return th / (2 * np.sin(th)) * v
def angle(R):
    return float(np.arccos(np.clip((np.trace(R) - 1) / 2, -1, 1)))
def _V(w):
    th = np.linalg.norm(w); K = hat(w)
    if th < 1e-8: return np.eye(3) + K / 2
    return np.eye(3) + (1 - np.cos(th)) / th**2 * K + (th - np.sin(th)) / th**3 * K @ K
def se3_exp(x):  # x = [tau(3), w(3)] like pypose se3
    T = np.eye(4); T[:3, :3] = so3_exp(x[3:]); T[:3, 3] = _V(x[3:]) @ x[:3]; return T
def se3_log(T):
    w = so3_log(T[:3, :3]); return np.concatenate([np.linalg.solve(_V(w), T[:3, 3]), w])
def inv(T):
    o = np.eye(4); o[:3, :3] = T[:3, :3].T; o[:3, 3] = -T[:3, :3].T @ T[:3, 3]; return o
def umeyama(P, G):
    mp, mg = P.mean(0), G.mean(0); X, Y = P - mp, G - mg
    U, S, Vt = np.linalg.svd(Y.T @ X / len(P)); Sg = np.eye(3)
    if np.linalg.det(U) * np.linalg.det(Vt) < 0: Sg[2, 2] = -1
    R = U @ Sg @ Vt; s = np.trace(np.diag(S) @ Sg) / (X ** 2).sum(1).mean()
    return s * (R @ X.T).T + mg
def ate(P, G):
    return float(np.sqrt(((umeyama(P, G) - G) ** 2).sum(1).mean()))
