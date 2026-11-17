"""Seasonal, per-stage pruning shoots (vertex coloured). Used by gen_variants.build."""
import math, random
import bpy, bmesh
from mathutils import Vector, Quaternion

SHOOT_CUTS = {2: [1, 2], 3: [1, 2, 4], 4: [1, 2, 6]}
SEASONS4 = ("spring", "summer", "autumn", "winter")


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


_mat = None


def shoot_material():
    global _mat
    if _mat and _mat.name in bpy.data.materials:
        return _mat
    m = bpy.data.materials.new("shoot")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.6
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Emission Color"].default_value = (1, 1, 0.85, 1)
    b.inputs["Emission Strength"].default_value = 0.06   # soft glow; the game drives the pulse
    _mat = m
    return m


def _paint(bm, n0, fn):
    """Paint faces made of vertices created after the vertex count was n0."""
    layer = bm.loops.layers.float_color.get("Col") or bm.loops.layers.float_color.new("Col")
    bm.verts.index_update()
    for f in bm.faces:
        if min(v.index for v in f.verts) >= n0:
            for l in f.loops:
                l[layer] = (*fn(l.vert.co), 1.0)


def ellipsoid(bm, centre, axis, L, W, T, col, sub=1, jit=0.05):
    before = len(bm.verts)
    res = bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    q = Vector((1, 0, 0)).rotation_difference(axis.normalized())
    for v in res["verts"]:
        j = 1 + random.uniform(-jit, jit)
        p = Vector((v.co.x * L * j, v.co.y * W * j, v.co.z * T * j))
        v.co = q @ p + centre
    _paint(bm, before, lambda co: col)


def add_tube(bm, tube_mesh, pts, radii, col_fn, name):
    me = tube_mesh(name, pts, radii)
    before = len(bm.verts)
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    _paint(bm, before, col_fn)


def curve_point(pts, t):
    # quadratic bezier through base, mid (control), tip
    a, b, c = pts
    return a * (1 - t) ** 2 + b * 2 * (1 - t) * t + c * t * t


def build_shoot(tube_mesh, stage, season, base, mid, tip, out, k, rng_seed):
    random.seed(rng_seed)
    bm = bmesh.new()
    up = (tip - base).normalized()
    side = Vector((-out.y, out.x, 0))
    side = side.normalized() if side.length > 1e-6 else Vector((0, 1, 0))
    woody = stage >= 3 or season == "winter"
    bark, green = srgb("#6b4a2e"), srgb("#7fbf4a" if season != "summer" else "#5aa63c")

    def stem_col(co):
        t = max(0.0, min(1.0, (co.z - base.z) / max(1e-6, tip.z - base.z)))
        if season == "winter":
            return bark
        if not woody:
            return green
        f = max(0.0, min(1.0, (t - 0.1) / 0.5))
        return tuple(bark[i] * (1 - f) + green[i] * f for i in range(3))

    r0 = (0.0042 if stage == 2 else 0.0055) * k
    add_tube(bm, tube_mesh, [base, mid, tip], [r0, r0 * 0.68, r0 * 0.34], stem_col, "shootstem")

    # leaves
    n = {2: 3, 3: 4, 4: 4}[stage] + {"spring": 0, "summer": 1, "autumn": -1, "winter": -99}[season]
    size = {"spring": 1.0, "summer": 1.18, "autumn": 0.95, "winter": 0.0}[season] * (0.85 if stage == 2 else 1.0)
    autumn_cols = [srgb("#e07a2f"), srgb("#c9452a"), srgb("#e8b04a"), srgb("#d65a2a")]
    leaf_col = {"spring": srgb("#9fe060"), "summer": srgb("#4fa83a")}
    for i in range(max(0, n)):
        t = 0.42 + 0.5 * i / max(1, n - 1) if n > 1 else 0.7
        p = curve_point((base, mid, tip), t)
        s = 1 if i % 2 == 0 else -1
        droop = season == "autumn" and i == 0
        d = side * s + up * (0.15 if droop else 0.75) + (Vector((0, 0, -0.9)) if droop else Vector())
        L = (0.0125 if stage == 2 else 0.0145) * k * size * (0.85 + 0.3 * t)
        W = L * (0.62 if stage == 2 else 0.42)
        c = autumn_cols[i % 4] if season == "autumn" else leaf_col[season]
        ellipsoid(bm, p + d.normalized() * L * 0.9, d, L, W, 0.0026 * k, c)

    # tip: bud / blossom / snow
    if season == "winter":
        for t in (0.55, 0.8):
            ellipsoid(bm, curve_point((base, mid, tip), t) + side * 0.003 * k, side + up, 0.003 * k, 0.003 * k, 0.004 * k, srgb("#9a4b3a"), sub=1)
        ellipsoid(bm, tip + up * 0.002 * k, up, 0.0045 * k, 0.0045 * k, 0.006 * k, srgb("#8a4a36"), sub=1)
        ellipsoid(bm, tip + Vector((0, 0, 0.006 * k)), Vector((1, 0, 0)), 0.0085 * k, 0.0085 * k, 0.0045 * k, srgb("#f4f8ff"), sub=2)
        ellipsoid(bm, curve_point((base, mid, tip), 0.6) + Vector((0, 0, 0.004 * k)), Vector((1, 0, 0)), 0.005 * k, 0.005 * k, 0.0025 * k, srgb("#f4f8ff"), sub=1)
    elif season == "spring" and stage == 4:
        for a in range(5):
            ang = a / 5 * math.tau
            dv = side * math.cos(ang) + up.cross(side).normalized() * math.sin(ang)
            ellipsoid(bm, tip + dv * 0.006 * k + up * 0.004 * k, dv + up * 0.4, 0.0062 * k, 0.0045 * k, 0.0018 * k, srgb("#f8c4d8"))
        ellipsoid(bm, tip + up * 0.005 * k, up, 0.0028 * k, 0.0028 * k, 0.0024 * k, srgb("#ffe27a"))
    else:
        bud = {"spring": "#f7b6cf", "summer": "#b6e86a", "autumn": "#e9a24a"}[season]
        big = 1.35 if stage == 4 else 1.0
        ellipsoid(bm, tip + up * 0.004 * k, up, 0.0085 * k * big, 0.0062 * k * big, 0.0062 * k * big, srgb(bud))

    bmesh.ops.triangulate(bm, faces=bm.faces)
    return bm


def add_shoots(scene, tube_mesh, stage, pads, tp, s, seasons=SEASONS4, only=None):
    mat = shoot_material()
    made = []
    for ci in SHOOT_CUTS.get(stage, []):
        c, r = pads[ci - 1]
        crown = ci == len(pads)
        top = 0.040 * s if crown else 0.030 * s
        anchor = c + Vector((0, 0, top))
        out = Vector((c.x - tp[0].x, c.y - tp[0].y, 0))
        out = out.normalized() * (0.007 if not crown else 0.004) if out.length > 1e-6 else Vector((0.005, 0, 0))
        k = max(s, 0.75)
        base = c + Vector((0, 0, -0.002))
        mid = anchor + Vector((out.x * 0.4, out.y * 0.4, 0.0))
        tip = anchor + out * 1.8 + Vector((0, 0, 0.034 * k))
        for season in seasons:
            if only and season != only:
                continue
            bm = build_shoot(tube_mesh, stage, season, base, mid, tip, out, k, rng_seed=ci * 31 + stage)
            me = bpy.data.meshes.new(f"shoot_{ci:02d}_{season}")
            bm.to_mesh(me)
            bm.free()
            ob = bpy.data.objects.new(f"shoot_{ci:02d}_{season}", me)
            scene.collection.objects.link(ob)
            me.materials.append(mat)
            for p in me.polygons:
                p.use_smooth = False
            made.append(ob)
    return made
