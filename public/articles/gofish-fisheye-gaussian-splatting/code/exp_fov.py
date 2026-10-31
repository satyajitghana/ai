"""E1: how much of the sphere and of the image a lens covers, and what a 160-degree crop discards. Pure geometry."""
import numpy as np
from fisheye_toys import dump

deg = np.deg2rad
out = {}

def sphere_fraction(half_deg):            # solid angle of a cone / 4pi
    return (1 - np.cos(deg(half_deg))) / 2

out['sphere_fraction'] = {f'{2*h:g}deg_fov': round(float(sphere_fraction(h)), 4) for h in (60, 80, 90, 100, 102.5)}

# image-disc area beyond angle t0 for a lens that maps theta_max to the image rim; radial profile r(theta)
models = {
    'equidistant (r = f*theta)': lambda t: t,
    'equisolid (r = 2f*sin(theta/2))': lambda t: np.sin(t / 2),
    'stereographic (r = 2f*tan(theta/2))': lambda t: np.tan(t / 2),
}
res = {}
for name, g in models.items():
    row = {}
    for tmax in (100.0, 102.5):
        for t0 in (80.0, 90.0):
            row[f'beyond_{t0:g}deg_of_{2*tmax:g}deg_lens'] = round(float(1 - (g(deg(t0)) / g(deg(tmax))) ** 2), 4)
    res[name] = row
out['image_area_beyond_angle'] = res

# solid angle the 160-degree crop discards from a 200-degree view
out['solid_angle_lost_by_160_crop_of_200'] = round(float((np.cos(deg(80)) - np.cos(deg(100))) / (1 - np.cos(deg(100)))), 4)

# pinhole stretch: radial scale dr/dtheta relative to the equidistant lens (f sec^2 theta / f)
out['pinhole_radial_stretch'] = {f'{t}deg': round(float(1 / np.cos(deg(t)) ** 2), 2) for t in (30, 45, 60, 75, 80, 85, 89)}

# normalised image radius r(theta)/r(theta_max=100) for the diagram
th = np.arange(0, 101, 10)
curves = {}
for name, g in models.items():
    curves[name] = [round(float(g(deg(t)) / g(deg(100))), 4) for t in th]
curves['pinhole (r = f*tan(theta)), same f as equidistant'] = [round(float(np.tan(deg(t)) / deg(100)), 4) if t < 90 else None for t in th]
out['curves'] = {'theta_deg': th.tolist(), 'normalised_radius': curves}

# depth sign: camera-space depth z = |x| cos(theta) changes sign at 90 degrees; pixels with theta > 90
for tmax in (100.0, 102.5):
    out[f'pixel_fraction_with_negative_depth_{2*tmax:g}deg_equidistant'] = round(float(1 - (90.0 / tmax) ** 2), 4)
dump('results-fov.json', out)

# the two real FIORD Hall_In calibrations in cameras.json (OPENCV_FISHEYE at 3264 px): where the polynomial is a valid lens
cams = {
    'camera 1': dict(f=(995.3539548285538 + 998.8412296530948) / 2, k=[0.037912020477107684, -0.023545169998035916, 0.0028405144828644122, -0.00045670077724780116]),
    'camera 2': dict(f=(996.7209364675064 + 993.2434938648001) / 2, k=[0.06926585896493545, -0.08409520221228549, 0.042722585150379765, -0.009421487126218186]),
}
def rho(t, k): return t * (1 + k[0] * t ** 2 + k[1] * t ** 4 + k[2] * t ** 6 + k[3] * t ** 8)
def drho(t, k): return 1 + 3 * k[0] * t ** 2 + 5 * k[1] * t ** 4 + 7 * k[2] * t ** 6 + 9 * k[3] * t ** 8
grid = np.linspace(0, np.pi, 200001)
real = {}
for name, c in cams.items():
    bad = np.where(drho(grid, c['k']) <= 0)[0]
    tmax = grid[bad[0] - 1] if len(bad) else np.pi
    r_rim = 1632.0
    mono = grid <= tmax
    t, rr = grid[mono], rho(grid[mono], c['k'])
    reach = r_rim / c['f']
    real[name] = dict(theta_monotone_limit_deg=round(float(np.degrees(tmax)), 2),
                      radius_px_at_monotone_limit=round(float(c['f'] * rho(tmax, c['k'])), 1),
                      rim_reachable=bool(reach <= rr[-1]),
                      theta_at_rim_deg=round(float(np.degrees(t[np.searchsorted(rr, reach)])), 2) if reach <= rr[-1] else None,
                      disc_area_fraction_with_unique_rays=round(float(min(1.0, (c['f'] * rho(tmax, c['k']) / r_rim) ** 2)), 4),
                      rho_over_theta={f'{a}deg': round(float(rho(np.deg2rad(a), c['k']) / np.deg2rad(a)), 4) for a in (60, 80, 90, 100)})
out['real_lenses_fiord_hall_in'] = real
dump('results-fov.json', out)
print(real)
