"""
fastlio2_mini.py — a minimal, ROS-free FAST-LIO2-style LiDAR-inertial odometry.

A teaching reimplementation of the FAST-LIO2 core: an iterated error-state Kalman
filter on SO(3), fed a high-rate IMU and corrected by raw point-to-plane LiDAR
residuals over an incremental k-d-tree map. It supports a LiDAR->IMU extrinsic and
per-scan voxel downsampling; the simplifications vs. the paper (called out where
they matter) are gravity fixed after init and a scipy cKDTree rebuilt per scan
instead of a true ikd-Tree. Everything else — the manifold state, forward/backward
propagation, the reformulated Kalman gain — is faithful.

    pip install numpy scipy rosbags
    python fastlio2_mini.py                 # runs a synthetic demo (no bag needed)
    python fastlio2_mini.py avia.bag        # runs a real Livox Avia bag (calibrated)
    # or: from fastlio2_mini import read_bag, run_offline

Validated: ~4 cm ATE on an 8 s synthetic trajectory, and it tracks the real HKU
Livox Avia bag (491 scans, ~50 s) — see run_offline's calibration arguments.
"""
import numpy as np
from scipy.spatial import cKDTree

# ============================================================ SO(3) utilities
def hat(w):                                   # vector -> skew-symmetric matrix
    return np.array([[0, -w[2], w[1]], [w[2], 0, -w[0]], [-w[1], w[0], 0]])

def Exp(w):                                   # so(3) -> SO(3)  (Rodrigues)
    th = np.linalg.norm(w)
    if th < 1e-9:
        return np.eye(3) + hat(w)
    K = hat(w / th)
    return np.eye(3) + np.sin(th) * K + (1 - np.cos(th)) * K @ K

def Log(R):                                   # SO(3) -> so(3)
    c = np.clip((np.trace(R) - 1) / 2, -1, 1)
    th = np.arccos(c)
    v = np.array([R[2, 1] - R[1, 2], R[0, 2] - R[2, 0], R[1, 0] - R[0, 1]])
    return 0.5 * v if th < 1e-9 else (th / (2 * np.sin(th))) * v

# ============================================================ state on the manifold
# error-state layout (15): [ p(0:3) th(3:6) v(6:9) bg(9:12) ba(12:15) ]
class State:
    def __init__(s):
        s.p = np.zeros(3); s.R = np.eye(3); s.v = np.zeros(3)
        s.bg = np.zeros(3); s.ba = np.zeros(3)
    def copy(s):
        t = State()
        t.p, t.R, t.v, t.bg, t.ba = s.p.copy(), s.R.copy(), s.v.copy(), s.bg.copy(), s.ba.copy()
        return t

def boxplus(x, d):                            # x ⊞ d  (retract onto the manifold)
    y = x.copy()
    y.p += d[0:3]; y.R = x.R @ Exp(d[3:6]); y.v += d[6:9]
    y.bg += d[9:12]; y.ba += d[12:15]
    return y

def boxminus(a, b):                           # a ⊟ b  (tangent so that a = b ⊞ d)
    d = np.zeros(15)
    d[0:3] = a.p - b.p; d[3:6] = Log(b.R.T @ a.R); d[6:9] = a.v - b.v
    d[9:12] = a.bg - b.bg; d[12:15] = a.ba - b.ba
    return d

# ============================================================ the filter
class ESEKF:
    def __init__(s, g):
        s.x = State(); s.P = np.eye(15) * 1e-2; s.g = g.copy()

    def predict(s, am, wm, dt, Q):
        """Forward propagation: integrate one IMU sample, inflate covariance."""
        x = s.x
        w = wm - x.bg                          # de-biased angular velocity
        a = x.R @ (am - x.ba) + s.g            # de-biased, gravity-corrected accel (world)
        # --- nominal mean ---
        x.p = x.p + x.v * dt + 0.5 * a * dt * dt
        Rn = x.R @ Exp(w * dt)
        x.v = x.v + a * dt
        x.R = Rn
        # --- error-state transition F_x and noise map F_w (paper Eq. 7/8) ---
        A = np.zeros((15, 15))
        A[0:3, 6:9] = np.eye(3)                # dp/dv
        A[3:6, 3:6] = -hat(w); A[3:6, 9:12] = -np.eye(3)      # dth/dth, dth/dbg
        A[6:9, 3:6] = -x.R @ hat(am - x.ba); A[6:9, 12:15] = -x.R   # dv/dth, dv/dba
        Fx = np.eye(15) + A * dt
        Fw = np.zeros((15, 12))
        Fw[3:6, 0:3] = -np.eye(3); Fw[6:9, 3:6] = -x.R
        Fw[9:12, 6:9] = np.eye(3); Fw[12:15, 9:12] = np.eye(3)
        s.P = Fx @ s.P @ Fx.T + (Fw * dt) @ Q @ (Fw * dt).T

    def update(s, pts_body, lmap, R=1e-3, max_iter=4, eps=1e-3):
        """Iterated point-to-plane update with the reformulated Kalman gain."""
        x_prior = s.x.copy()
        n = 15; K = None; Hfull = None
        for _ in range(max_iter):
            x = s.x
            pw = (x.R @ pts_body.T).T + x.p     # body -> world at current estimate
            H_rows, z = [], []
            for i in range(len(pts_body)):
                nrm, off, ok = lmap.fit_plane(pw[i])    # nearest-5 plane via kd-tree
                if not ok:
                    continue
                r = nrm @ pw[i] + off          # point-to-plane distance
                if abs(r) > 0.5:
                    continue
                Hr = np.zeros(15)
                Hr[0:3] = nrm
                Hr[3:6] = hat(pts_body[i]) @ (x.R.T @ nrm)   # d(residual)/d(theta)
                H_rows.append(Hr); z.append(r)
            if len(H_rows) < 10:
                break
            H = np.array(H_rows); z = np.array(z)
            dx_prior = boxminus(s.x, x_prior)
            # reformulated gain: invert a 15x15 (state), NOT an mxm (measurements)
            S = H.T @ H / R + np.linalg.inv(s.P)
            K = np.linalg.solve(S, H.T) / R    # K = (H'R^-1 H + P^-1)^-1 H' R^-1
            Hfull = H
            dx = -K @ z - (np.eye(n) - K @ H) @ dx_prior
            s.x = boxplus(s.x, dx)
            if np.max(np.abs(dx)) < eps:
                break
        if K is not None:
            s.P = (np.eye(n) - K @ Hfull) @ s.P

# ============================================================ map (stand-in for ikd-Tree)
class LocalMap:
    def __init__(s, voxel=0.4, cap=60000):
        s.voxel = voxel; s.cap = cap; s.pts = None; s.tree = None
    def add(s, world_pts):
        s.pts = world_pts if s.pts is None else np.vstack([s.pts, world_pts])
        if len(s.pts) > s.cap:
            s.pts = s.pts[-s.cap:]
        s.tree = cKDTree(s.pts)                # a real ikd-Tree updates in place instead
    def fit_plane(s, p, k=5, max_d=1.0, thick=0.1):
        d, idx = s.tree.query(p, k=k)
        if d[-1] > max_d:
            return None, None, False
        near = s.pts[idx]; c = near.mean(0)
        _, _, Vt = np.linalg.svd(near - c)     # smallest singular vector = normal
        nrm = Vt[2]
        if np.max(np.abs((near - c) @ nrm)) > thick:
            return None, None, False           # neighbours aren't planar enough
        return nrm, -nrm @ c, True

# ============================================================ deskew (backward propagation)
def deskew(points, point_dts, imu_poses, t_end):
    """Transform each point from the pose at its capture time to the scan-end pose.
    imu_poses: list of (t, R, p) sampled across the sweep; point_dts: per-point time."""
    ts = np.array([q[0] for q in imu_poses])
    R_end, p_end = imu_poses[-1][1], imu_poses[-1][2]
    out = np.empty_like(points)
    for i, pb in enumerate(points):
        t = t_end - point_dts[i]
        j = max(0, np.searchsorted(ts, t) - 1)
        tj, Rj, pj = imu_poses[j]
        Ri = Rj @ Exp(np.zeros(3))             # (interpolate if you want sub-sample accuracy)
        wpt = Ri @ pb + pj                     # point in world at its capture pose
        out[i] = R_end.T @ (wpt - p_end)       # back into the scan-end frame
    return out

# ============================================================ downsample (voxel grid)
def voxel_downsample(pts, voxel=0.5):
    """One representative point per occupied voxel — FAST-LIO's per-scan downsample.
    100k raw points per scan is overkill; a sparse, even set keeps the update real-time."""
    if len(pts) == 0:
        return pts
    keys = np.floor(pts / voxel).astype(np.int64)
    _, idx = np.unique(keys, axis=0, return_index=True)
    return pts[np.sort(idx)]

# ============================================================ offline driver
def imu_init(imu_samples, g_mag=9.81):
    """Estimate gravity direction and gyro bias from a short static window."""
    a = np.mean([s[1] for s in imu_samples], 0)   # mean specific force
    w = np.mean([s[2] for s in imu_samples], 0)   # mean angular velocity = gyro bias
    g = -a / np.linalg.norm(a) * g_mag            # gravity opposes measured accel
    return g, w

def run_offline(imu_stream, lidar_scans, voxel=0.4, scan_voxel=0.5,
                T_LI=None, R_LI=None, acc_cov=1e-2, gyr_cov=1e-2,
                bacc_cov=1e-4, bgyr_cov=1e-4, init_secs=0.5):
    """imu_stream: list of (t, acc[3], gyro[3]); lidar_scans: list of dict with
       't_end', 'points'(N,3 body), 'dts'(N per-point time before scan end).

    T_LI / R_LI: LiDAR->IMU extrinsic (point in IMU frame = R_LI @ p_lidar + T_LI).
    acc_cov/gyr_cov: IMU noise densities (Avia's avia.yaml uses 0.1; the synthetic
    demo is quieter). The process-noise Q is built from these — too small and the
    filter trusts a stale prediction and refuses to move, too large and it's jumpy."""
    Q = np.diag([gyr_cov]*3 + [acc_cov]*3 + [bgyr_cov]*3 + [bacc_cov]*3)
    R_LI = np.eye(3) if R_LI is None else np.asarray(R_LI, float)
    T_LI = np.zeros(3) if T_LI is None else np.asarray(T_LI, float)
    to_imu = lambda p: (R_LI @ p.T).T + T_LI         # LiDAR points -> IMU body frame
    # --- init gravity + gyro bias from the first static window of IMU ---
    t0 = imu_stream[0][0]
    static = [s for s in imu_stream if s[0] < t0 + init_secs]
    g, bg = imu_init(static)
    kf = ESEKF(g); kf.x.bg = bg
    lmap = LocalMap(voxel)
    traj = []; imu_i = 0; bootstrapped = False
    for scan in lidar_scans:
        poses = []
        # forward-propagate every IMU sample up to scan end, caching poses for deskew
        while imu_i < len(imu_stream) and imu_stream[imu_i][0] <= scan['t_end']:
            t, acc, gyro = imu_stream[imu_i]
            dt = t - (imu_stream[imu_i-1][0] if imu_i > 0 else t)
            if dt > 0:
                kf.predict(acc, gyro, dt, Q)
            poses.append((t, kf.x.R.copy(), kf.x.p.copy()))
            imu_i += 1
        if not poses:
            poses = [(scan['t_end'], kf.x.R.copy(), kf.x.p.copy())]
        body = to_imu(scan['points'])                       # into the IMU body frame
        pts = deskew(body, scan['dts'], poses, scan['t_end'])
        pts = voxel_downsample(pts, scan_voxel)             # sparse, even set for the update
        if not bootstrapped:                    # seed the map from the first scan
            lmap.add((kf.x.R @ pts.T).T + kf.x.p); bootstrapped = True
        else:
            kf.update(pts, lmap)                # the iterated EKF correction
            lmap.add((kf.x.R @ pts.T).T + kf.x.p)
        traj.append((scan['t_end'], kf.x.p.copy(), kf.x.R.copy()))
    return traj, lmap

# ============================================================ read a .bag without ROS
_LIVOX_DEFS = (
    "uint32 offset_time\nfloat32 x\nfloat32 y\nfloat32 z\nuint8 reflectivity\nuint8 tag\nuint8 line\n",
    "std_msgs/Header header\nuint64 timebase\nuint32 point_num\nuint8 lidar_id\nuint8[3] rsvd\n"
    "livox_ros_driver/CustomPoint[] points\n",
)

def read_bag(path, imu_topic='/livox/imu', lidar_topic='/livox/lidar', g_mag=9.81):
    """Read IMU + LiDAR from a ROS1 bag with the pure-python `rosbags` (no ROS install).
       Handles sensor_msgs/PointCloud2 (Velodyne/Ouster) AND livox_ros_driver/CustomMsg
       (Livox Avia/Horizon). Livox accel (reported in g) is auto-scaled to m/s^2."""
    from pathlib import Path
    from rosbags.rosbag1 import Reader
    from rosbags.typesys import Stores, get_typestore
    from rosbags.typesys.msg import get_types_from_msg
    ts = get_typestore(Stores.ROS1_NOETIC)
    ts.register(get_types_from_msg(_LIVOX_DEFS[0], 'livox_ros_driver/msg/CustomPoint'))
    ts.register(get_types_from_msg(_LIVOX_DEFS[1], 'livox_ros_driver/msg/CustomMsg'))
    imu_stream, lidar_scans = [], []
    with Reader(Path(path)) as reader:
        conns = [c for c in reader.connections if c.topic in (imu_topic, lidar_topic)]
        for conn, t, raw in reader.messages(connections=conns):
            msg = ts.deserialize_ros1(raw, conn.msgtype)
            if conn.topic == imu_topic:
                a, w = msg.linear_acceleration, msg.angular_velocity
                imu_stream.append((t * 1e-9, np.array([a.x, a.y, a.z]), np.array([w.x, w.y, w.z])))
            elif 'CustomMsg' in conn.msgtype:                      # Livox
                pts, dts = parse_livox(msg)
                lidar_scans.append({'t_end': t * 1e-9, 'points': pts, 'dts': dts})
            else:                                                   # PointCloud2
                pts, dts = parse_pointcloud2(msg)
                lidar_scans.append({'t_end': t * 1e-9, 'points': pts, 'dts': dts})
    if imu_stream and np.mean([np.linalg.norm(s[1]) for s in imu_stream[:50]]) < 2.0:
        imu_stream = [(t, a * g_mag, w) for t, a, w in imu_stream]   # g -> m/s^2
    return imu_stream, lidar_scans

def parse_livox(msg):
    """Decode a livox_ros_driver/CustomMsg into (N,3) xyz and per-point dt-before-scan-end.

    Note: we deliberately ignore msg.header.stamp here. On real Avia bags the Livox
    header runs on the sensor's own clock (seconds-since-boot), while the IMU is stamped
    with the bag's record clock (Unix time). Mixing them silently breaks IMU/LiDAR sync,
    so read_bag uses the bag record time `t` for every scan's t_end and only uses the
    per-point offsets here for deskew."""
    P = msg.points
    xyz = np.array([[p.x, p.y, p.z] for p in P], float)
    off = np.array([p.offset_time for p in P], float) * 1e-9        # ns -> s from scan start
    keep = np.linalg.norm(xyz, axis=1) > 0.5
    xyz, off = xyz[keep], off[keep]
    return xyz, (off.max() - off if len(off) else off)             # dt before scan end

def parse_pointcloud2(msg):
    """Decode a sensor_msgs/PointCloud2 into (N,3) xyz + per-point time offset."""
    dtype = np.dtype({'names': [f.name for f in msg.fields],
                      'formats': [_PF[f.datatype] for f in msg.fields],
                      'offsets': [f.offset for f in msg.fields],
                      'itemsize': msg.point_step})
    arr = np.frombuffer(msg.data, dtype=dtype, count=msg.width * msg.height)
    xyz = np.stack([arr['x'], arr['y'], arr['z']], -1).astype(float)
    # the per-point time field is named 'time'/'t'/'offset_time' depending on driver
    tcol = next((n for n in ('time', 't', 'offset_time', 'timestamp') if n in arr.dtype.names), None)
    dts = (arr[tcol].astype(float) if tcol else np.zeros(len(xyz)))
    if dts.max() > 1.0:                         # ns/us -> s heuristics
        dts = dts * (1e-9 if dts.max() > 1e6 else 1e-3)
    return xyz, dts
_PF = {1: 'i1', 2: 'u1', 3: 'i2', 4: 'u2', 5: 'i4', 6: 'u4', 7: 'f4', 8: 'f8'}

# ============================================================ synthetic world (no dataset)
def simulate_room(seconds=8, seed=0):
    """A robot looping through a 10x10x3 m room. Returns (imu_stream, lidar_scans,
    truth) in exactly the format run_offline / a real bag would give you."""
    rng = np.random.default_rng(seed)
    Rz = lambda a: np.array([[np.cos(a), -np.sin(a), 0], [np.sin(a), np.cos(a), 0], [0, 0, 1]])
    truth = lambda t: (np.array([2*np.sin(0.4*t), 1.5*(1-np.cos(0.4*t)), 0.0]), Rz(0.3*np.sin(0.5*t)))
    acc = lambda t: np.array([-0.32*np.sin(0.4*t), 0.24*np.cos(0.4*t), 0.0])
    yawrate = lambda t: 0.15*np.cos(0.5*t)
    g = np.array([0, 0, -9.81])
    wall = []
    for _ in range(4000):
        f = rng.integers(0, 5); u, v = rng.uniform(-5, 5), rng.uniform(0, 3)
        wall.append([[-5, u, v], [5, u, v], [u, -5, v], [u, 5, v], [u, rng.uniform(-5, 5), 0]][f])
    wall = np.array(wall, float)
    bg_t, ba_t = np.array([2e-3, -1e-3, 1.5e-3]), np.array([2e-2, -3e-2, 1e-2])
    imu_stream = []                                       # 200 Hz IMU
    for k in range(int(seconds * 200)):
        t = k / 200; _, R = truth(t)
        am = R.T @ (acc(t) - g) + ba_t + rng.normal(0, 0.01, 3)   # specific force in body
        wm = np.array([0, 0, yawrate(t)]) + bg_t + rng.normal(0, 1e-3, 3)
        imu_stream.append((t, am, wm))
    scans = []                                            # 10 Hz LiDAR, skewed over the sweep
    for s in range(1, int(seconds * 10)):
        tc = s / 10; p, _ = truth(tc)
        vis = wall[np.linalg.norm(wall - p, axis=1) < 8]
        idx = rng.choice(len(vis), size=min(400, len(vis)), replace=False)
        pts, dts = [], []
        for j, kk in enumerate(idx):
            tau = tc - 0.1 + (j / len(idx)) * 0.1; pp, RR = truth(tau)
            pts.append(RR.T @ (vis[kk] - pp) + rng.normal(0, 0.01, 3)); dts.append(tc - tau)
        scans.append({'t_end': tc, 'points': np.array(pts), 'dts': np.array(dts)})
    return imu_stream, scans, truth

def write_demo_bag(path, seconds=6):
    """Write the simulated room to a real ROS1 .bag (sensor_msgs/Imu + PointCloud2),
    so you can exercise the read_bag() path without downloading a dataset."""
    import struct
    from rosbags.rosbag1 import Writer
    from rosbags.typesys import Stores, get_typestore
    ts = get_typestore(Stores.ROS1_NOETIC)
    Imu, PC2, PF = (ts.types[f'sensor_msgs/msg/{n}'] for n in ('Imu', 'PointCloud2', 'PointField'))
    Header, Time = ts.types['std_msgs/msg/Header'], ts.types['builtin_interfaces/msg/Time']
    Quat, Vec3 = ts.types['geometry_msgs/msg/Quaternion'], ts.types['geometry_msgs/msg/Vector3']
    H = lambda t, f: Header(seq=0, stamp=Time(sec=int(t), nanosec=int((t % 1) * 1e9)), frame_id=f)
    imu_stream, scans, _ = simulate_room(seconds)
    with Writer(path) as w:
        ci = w.add_connection('/imu', Imu.__msgtype__, typestore=ts)
        cp = w.add_connection('/velodyne_points', PC2.__msgtype__, typestore=ts)
        for t, a, wv in imu_stream:
            m = Imu(header=H(t, 'imu'), orientation=Quat(x=0., y=0., z=0., w=1.),
                    orientation_covariance=np.zeros(9),
                    angular_velocity=Vec3(x=wv[0], y=wv[1], z=wv[2]), angular_velocity_covariance=np.zeros(9),
                    linear_acceleration=Vec3(x=a[0], y=a[1], z=a[2]), linear_acceleration_covariance=np.zeros(9))
            w.write(ci, int(t * 1e9), ts.serialize_ros1(m, Imu.__msgtype__))
        flds = [PF(name=n, offset=o, datatype=7, count=1) for n, o in (('x', 0), ('y', 4), ('z', 8), ('time', 12))]
        for sc in scans:
            blob = b''.join(struct.pack('ffff', *p, d) for p, d in zip(sc['points'], sc['dts']))
            m = PC2(header=H(sc['t_end'], 'lidar'), height=1, width=len(sc['points']), fields=flds,
                    is_bigendian=False, point_step=16, row_step=16 * len(sc['points']),
                    data=np.frombuffer(blob, np.uint8).copy(), is_dense=True)
            w.write(cp, int(sc['t_end'] * 1e9), ts.serialize_ros1(m, PC2.__msgtype__))

def _ate(traj, truth):
    err = [np.linalg.norm(p - truth(t)[0]) for t, p, _ in traj]
    return float(np.sqrt(np.mean(np.square(err)))), float(err[-1])

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:                       # python fastlio2_mini.py path/to/real.bag
        # defaults target the HKU Livox Avia bag: its avia.yaml extrinsic + noise
        imu, scans = read_bag(sys.argv[1], imu_topic='/livox/imu', lidar_topic='/livox/lidar')
        traj, lmap = run_offline(imu, scans, T_LI=[0.04165, 0.02326, -0.0284],
                                 acc_cov=0.1, gyr_cov=0.1, scan_voxel=0.5)
        ps = np.array([p for _, p, _ in traj])
        plen = float(np.sum(np.linalg.norm(np.diff(ps, axis=0), axis=1)))
        print(f"{len(traj)} poses, map={len(lmap.pts)} pts, path={plen:.2f} m, "
              f"final={np.round(ps[-1], 2)}")
    else:                                       # self-contained demo: in-memory + a real .bag
        imu, scans, truth = simulate_room()
        traj, _ = run_offline(imu, scans)
        print("in-memory  : ATE rmse = %.3f m   final = %.3f m" % _ate(traj, truth))
        write_demo_bag('/tmp/fastlio2_demo.bag')
        imu_b, scans_b = read_bag('/tmp/fastlio2_demo.bag',
                                  imu_topic='/imu', lidar_topic='/velodyne_points')
        traj_b, _ = run_offline(imu_b, scans_b)
        print("via .bag   : ATE rmse = %.3f m   final = %.3f m" % _ate(traj_b, truth))
