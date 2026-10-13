#!/usr/bin/env python3
"""Build a sleek holographic head as a colored point cloud — v3.

Pure Python. A few large, heavily-overlapping ellipsoids blend into one
smooth stylized bust (no anatomical lumps); identity-free by design.
Features are pure light: soft glowing eyes, a spectral gradient sweeping
bottom->top (magenta -> violet -> cyan), scanlines, and fresnel rim glow.
Colors carry baked shading; pair with additive blending in the renderer.

Output: three.js orientation (y up, face +Z), height 0.54, binary PLY.
Run:  python3 blender/build_generic_head.py assets/head-cloud.ply 140000
"""
import colorsys
import math
import random
import struct
import sys

# (name, center, semi-axes) — y up, +z face. Large overlaps = smooth blend.
COMPONENTS = [
    ("cranium", (0, 0.050, -0.004), (0.082, 0.098, 0.090)),
    ("face", (0, -0.018, 0.006), (0.075, 0.100, 0.080)),
    ("chin", (0, -0.092, 0.020), (0.034, 0.036, 0.032)),
    ("nose", (0, -0.030, 0.072), (0.012, 0.026, 0.016)),
    ("neck", (0, -0.168, -0.016), (0.033, 0.070, 0.034)),
]
SHRINK = 0.985


def qval(p, i, shrink=SHRINK):
    _, c, a = COMPONENTS[i]
    return (((p[0] - c[0]) / (a[0] * shrink)) ** 2
            + ((p[1] - c[1]) / (a[1] * shrink)) ** 2
            + ((p[2] - c[2]) / (a[2] * shrink)) ** 2)


def keep_point(p, src):
    return all(qval(p, i) >= 1 for i in range(len(COMPONENTS)) if i != src)


def normal_at(p, i):
    _, c, a = COMPONENTS[i]
    n = ((p[0] - c[0]) / a[0] ** 2, (p[1] - c[1]) / a[1] ** 2,
         (p[2] - c[2]) / a[2] ** 2)
    ln = math.sqrt(sum(x * x for x in n)) or 1.0
    return (n[0] / ln, n[1] / ln, n[2] / ln)


def _norm(v):
    l = math.sqrt(sum(x * x for x in v))
    return (v[0] / l, v[1] / l, v[2] / l)


KEY = _norm((0.45, 0.55, 0.70))
FILL = _norm((-0.60, 0.10, 0.50))


def approx_area(a):
    p = 1.6075
    ap, bp, cp = a[0] ** p, a[1] ** p, a[2] ** p
    return 4 * math.pi * ((ap * bp + ap * cp + bp * cp) / 3) ** (1 / p)


def sample_surface(rng, c, a):
    while True:
        u = rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1)
        n = math.sqrt(sum(x * x for x in u))
        d = (u[0] / n, u[1] / n, u[2] / n)
        p = (c[0] + d[0] * a[0], c[1] + d[1] * a[1], c[2] + d[2] * a[2])
        g = math.sqrt((d[0] * a[1] * a[2]) ** 2 + (d[1] * a[0] * a[2]) ** 2
                      + (d[2] * a[0] * a[1]) ** 2)
        if rng.random() < g / (max(a) * max(a)):
            return p


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "head-cloud.ply"
    n_target = int(sys.argv[2]) if len(sys.argv) > 2 else 140000
    rng = random.Random(11)

    areas = [approx_area(comp[2]) for comp in COMPONENTS]
    total = sum(areas)

    records = []
    while len(records) < n_target:
        t = rng.random() * total
        acc = 0.0
        for i, ar in enumerate(areas):
            acc += ar
            if t <= acc:
                break
        _, c, a = COMPONENTS[i]
        p = sample_surface(rng, c, a)
        if not keep_point(p, i):
            continue
        records.append((p, normal_at(p, i)))

    pts = [r[0] for r in records]
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    cz = sum(p[2] for p in pts) / len(pts)
    ymin = min(p[1] for p in pts)
    ymax = max(p[1] for p in pts)
    s = 0.54 / (ymax - ymin)

    def lum_at(p, n):
        d = lambda L: max(0.0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2])
        li = 0.22 + 0.55 * d(KEY) + 0.25 * d(FILL)
        fresnel = (1.0 - max(0.0, n[2])) ** 2
        ynorm = (p[1] - ymin) / (ymax - ymin)
        lum = li * 0.62 + 0.50 * fresnel
        if (ynorm * 46.0) % 1.0 < 0.16:                     # scanlines
            lum *= 0.55
        # glowing eyes: two soft almonds of pure light on the face
        for sx in (-1, 1):
            d2 = ((p[0] - sx * 0.033) / 0.017) ** 2 + ((p[1] - 0.012) / 0.009) ** 2
            if p[2] > 0.045 and d2 < 4.0:
                lum += 0.85 * math.exp(-d2 * 1.4)
        lum += rng.gauss(0, 0.015)                          # subtle shimmer
        return min(0.97, max(0.05, lum))

    with open(out, "wb") as f:
        f.write((
            "ply\nformat binary_little_endian 1.0\n"
            f"element vertex {len(records)}\n"
            "property float x\nproperty float y\nproperty float z\n"
            "property uchar red\nproperty uchar green\nproperty uchar blue\n"
            "end_header\n").encode("ascii"))
        pack = struct.Struct("<fffBBB").pack
        for p, n in records:
            ynorm = (p[1] - ymin) / (ymax - ymin)
            hue = 0.88 - 0.40 * ynorm                       # magenta -> cyan
            r_, g_, b_ = colorsys.hls_to_rgb(hue, lum_at(p, n), 0.85)
            f.write(pack((p[0] - cx) * s, (p[1] - cy) * s, (p[2] - cz) * s,
                         int(r_ * 255), int(g_ * 255), int(b_ * 255)))
    print(f"wrote {out} ({len(records)} points)")


if __name__ == "__main__":
    main()
