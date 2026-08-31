"""Build an original articulated android and export it for the web.

The model deliberately keeps ``UpperBodyPivot`` and ``HeadPivot`` as named
transform nodes so Three.js can drive cursor-following motion without a full
skeletal animation system.

Run with:
  blender --background --python blender/create_cursor_robot.py
"""

from pathlib import Path
import math

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "robot-assets"
ASSET_DIR.mkdir(parents=True, exist_ok=True)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def material(
    name,
    base_color,
    *,
    metallic=0.0,
    roughness=0.45,
    emission=None,
    emission_strength=0.0,
    coat=0.0,
):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*base_color, 1.0)
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*base_color, 1.0)
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    if "Coat Weight" in principled.inputs:
        principled.inputs["Coat Weight"].default_value = coat
    if "Coat Roughness" in principled.inputs:
        principled.inputs["Coat Roughness"].default_value = max(0.02, roughness * 0.5)
    if emission:
        principled.inputs["Emission Color"].default_value = (*emission, 1.0)
        principled.inputs["Emission Strength"].default_value = emission_strength
    return mat


def parent_local(obj, parent, location):
    obj.parent = parent
    obj.location = location


def finish_mesh(obj, mat, parent, location, *, smooth=False):
    obj.data.materials.append(mat)
    if smooth:
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    if parent:
        parent_local(obj, parent, location)
    else:
        obj.location = location
    return obj


def cube(name, location, scale, mat, parent=None, *, bevel=0.08, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0), rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new(name="Precision bevel", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 4
        modifier.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return finish_mesh(obj, mat, parent, location)


def uv_sphere(name, location, scale, mat, parent=None, *, segments=48, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_mesh(obj, mat, parent, location, smooth=True)


def cylinder(
    name,
    location,
    radius,
    depth,
    mat,
    parent=None,
    *,
    rotation=(0, 0, 0),
    scale=(1, 1, 1),
    vertices=48,
    bevel=0.055,
):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=(0, 0, 0),
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new(name="Machined bevel", type="BEVEL")
        modifier.width = min(bevel, radius * 0.38)
        modifier.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return finish_mesh(obj, mat, parent, location, smooth=True)


def torus(name, location, major_radius, minor_radius, mat, parent=None, *, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=48,
        minor_segments=12,
        location=(0, 0, 0),
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    return finish_mesh(obj, mat, parent, location, smooth=True)


def cable(name, start, end, radius, mat, parent=None, *, sag=0.0):
    curve_data = bpy.data.curves.new(name=f"{name}Curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 8
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 3
    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(2)
    midpoint = (Vector(start) + Vector(end)) * 0.5 + Vector((0, sag, 0))
    for point, coordinate in zip(spline.bezier_points, (Vector(start), midpoint, Vector(end))):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    curve_data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def empty(name, location, parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.18
    bpy.context.collection.objects.link(obj)
    if parent:
        parent_local(obj, parent, location)
    else:
        obj.location = location
    return obj


clear_scene()

shell = material("Ceramic Graphite", (0.022, 0.028, 0.027), metallic=0.72, roughness=0.18, coat=0.68)
shell_secondary = material("Satin Graphite", (0.072, 0.082, 0.078), metallic=0.78, roughness=0.3, coat=0.3)
titanium = material("Brushed Titanium", (0.39, 0.43, 0.415), metallic=1.0, roughness=0.2)
inner_mech = material("Inner Mechanism", (0.028, 0.032, 0.031), metallic=0.86, roughness=0.4)
rubber = material("Joint Rubber", (0.012, 0.016, 0.015), metallic=0.05, roughness=0.72)
visor = material("Smoked Visor", (0.003, 0.006, 0.006), metallic=0.8, roughness=0.06, coat=1.0)
orange = material(
    "Signal Orange", (0.95, 0.115, 0.018), metallic=0.15, roughness=0.22,
    emission=(1.0, 0.04, 0.005), emission_strength=5.4,
)
acid = material(
    "Optic Acid", (0.42, 0.82, 0.028), metallic=0.0, roughness=0.24,
    emission=(0.48, 1.0, 0.035), emission_strength=7.0,
)

root = empty("RobotRoot", (0, 0, 0))
lower = empty("LowerBody", (0, 0, 0), root)
upper = empty("UpperBodyPivot", (0, 0, 1.76), root)
head = empty("HeadPivot", (0, 0, 1.38), upper)

# Pelvis and legs: human proportions, planted feet, and exposed joint stacks.
cube("PelvisCore", (0, 0, 1.61), (0.58, 0.31, 0.24), inner_mech, lower, bevel=0.13)
cube("PelvisShell", (0, -0.22, 1.65), (0.68, 0.13, 0.2), shell, lower, bevel=0.13)
cube("PelvisAccent", (0, -0.355, 1.67), (0.21, 0.018, 0.028), orange, lower, bevel=0.012)

for side, x in (("L", -0.4), ("R", 0.4)):
    uv_sphere(f"HipBall_{side}", (x, 0, 1.47), (0.24, 0.23, 0.24), titanium, lower)
    torus(f"HipSeal_{side}", (x, 0, 1.47), 0.19, 0.04, rubber, lower)
    cylinder(f"ThighFrame_{side}", (x, 0.02, 1.14), 0.205, 0.62, inner_mech, lower, scale=(0.82, 0.94, 1))
    cube(f"ThighShell_{side}", (x, -0.13, 1.14), (0.24, 0.15, 0.28), shell_secondary, lower, bevel=0.12)
    cube(f"ThighInset_{side}", (x, -0.285, 1.14), (0.08, 0.018, 0.14), shell, lower, bevel=0.025)
    uv_sphere(f"KneeCore_{side}", (x, 0, 0.78), (0.22, 0.2, 0.21), titanium, lower)
    cylinder(f"KneeRing_{side}", (x, 0, 0.78), 0.19, 0.13, rubber, lower, rotation=(math.pi / 2, 0, 0), bevel=0.025)
    cylinder(f"ShinFrame_{side}", (x, 0.04, 0.46), 0.17, 0.55, inner_mech, lower, scale=(0.82, 0.88, 1))
    cube(f"ShinArmor_{side}", (x, -0.14, 0.46), (0.22, 0.15, 0.27), shell, lower, bevel=0.105)
    cube(f"ShinLight_{side}", (x, -0.295, 0.48), (0.055, 0.018, 0.12), acid, lower, bevel=0.018)
    cylinder(f"Ankle_{side}", (x, 0.01, 0.17), 0.145, 0.17, titanium, lower)
    cube(f"Foot_{side}", (x, -0.13, 0.035), (0.27, 0.47, 0.135), shell_secondary, lower, bevel=0.11)
    cube(f"ToeCap_{side}", (x, -0.51, 0.03), (0.255, 0.17, 0.105), shell, lower, bevel=0.09)
    cable(f"LegCable_{side}", (x + 0.14, 0.15, 1.38), (x + 0.12, 0.12, 0.86), 0.027, rubber, lower, sag=0.07)

# Torso: visible spine and abdomen under overlapping rib and chest plates.
cylinder("Spine", (0, 0.13, 0.26), 0.12, 0.82, titanium, upper)
for z in (0.02, 0.18, 0.34, 0.5):
    torus(f"SpineSeal_{z:.2f}", (0, 0.13, z), 0.14, 0.028, rubber, upper)
cube("AbdomenCore", (0, 0, 0.23), (0.5, 0.27, 0.34), inner_mech, upper, bevel=0.17)
cube("AbdomenShell", (0, -0.22, 0.26), (0.46, 0.115, 0.3), shell_secondary, upper, bevel=0.15)
cube("RibCore", (0, 0, 0.73), (0.74, 0.32, 0.48), inner_mech, upper, bevel=0.2)
cube("BackShell", (0, 0.25, 0.72), (0.67, 0.1, 0.44), shell_secondary, upper, bevel=0.12)

for side, x, rotation_z in (("L", -0.355, -0.055), ("R", 0.355, 0.055)):
    cube(
        f"ChestPlate_{side}", (x, -0.315, 0.82), (0.335, 0.12, 0.36), shell,
        upper, bevel=0.14, rotation=(0, 0, rotation_z),
    )
    cube(f"ChestVent_{side}", (x, -0.445, 0.72), (0.19, 0.018, 0.045), rubber, upper, bevel=0.018)
    cube(f"Clavicle_{side}", (x, -0.34, 1.08), (0.31, 0.08, 0.07), titanium, upper, bevel=0.045)

cube("Sternum", (0, -0.43, 0.83), (0.085, 0.035, 0.34), titanium, upper, bevel=0.035)
cube("ChestSignal", (0, -0.47, 0.92), (0.032, 0.018, 0.1), orange, upper, bevel=0.012)
torus("WaistSeal", (0, 0, -0.08), 0.39, 0.065, rubber, upper)

cylinder("NeckCore", (0, 0, 1.18), 0.18, 0.34, inner_mech, upper)
for z in (1.08, 1.18, 1.29):
    torus(f"NeckRing_{z:.2f}", (0, 0, z), 0.19, 0.038, titanium if z == 1.18 else rubber, upper)

# Arms: layered deltoids, mechanical frames, sealed joints, palms, and fingers.
for side, x, direction in (("L", -1.04, -1), ("R", 1.04, 1)):
    shoulder_x = direction * 0.89
    uv_sphere(f"ShoulderCore_{side}", (shoulder_x, 0, 0.87), (0.28, 0.27, 0.28), titanium, upper)
    uv_sphere(f"DeltoidShell_{side}", (x, -0.035, 0.83), (0.32, 0.29, 0.38), shell, upper)
    torus(f"ShoulderSeal_{side}", (shoulder_x, 0, 0.87), 0.225, 0.045, rubber, upper, rotation=(0, math.pi / 2, 0))
    cylinder(
        f"UpperArmFrame_{side}", (x, 0.02, 0.43), 0.18, 0.66, inner_mech,
        upper, rotation=(0, direction * 0.055, 0), scale=(0.82, 0.88, 1),
    )
    cube(f"BicepShell_{side}", (x - direction * 0.015, -0.14, 0.45), (0.21, 0.13, 0.27), shell_secondary, upper, bevel=0.1)
    uv_sphere(f"ElbowCore_{side}", (x + direction * 0.035, 0, 0.08), (0.205, 0.19, 0.205), titanium, upper)
    cylinder(
        f"ElbowSeal_{side}", (x + direction * 0.035, 0, 0.08), 0.18, 0.12, rubber,
        upper, rotation=(math.pi / 2, 0, 0), bevel=0.022,
    )
    cylinder(
        f"ForearmFrame_{side}", (x + direction * 0.035, 0.02, -0.27), 0.175, 0.59,
        inner_mech, upper, rotation=(0, -direction * 0.035, 0), scale=(0.82, 0.9, 1),
    )
    cube(f"ForearmShell_{side}", (x + direction * 0.05, -0.145, -0.26), (0.22, 0.14, 0.26), shell, upper, bevel=0.105)
    cube(f"ForearmLight_{side}", (x + direction * 0.05, -0.29, -0.24), (0.045, 0.014, 0.1), orange, upper, bevel=0.012)
    cylinder(f"Wrist_{side}", (x + direction * 0.06, 0, -0.59), 0.13, 0.15, titanium, upper)
    palm_x = x + direction * 0.06
    cube(f"Palm_{side}", (palm_x, -0.015, -0.78), (0.19, 0.13, 0.23), shell_secondary, upper, bevel=0.09)

    for finger_index, finger_offset in enumerate((-0.12, -0.04, 0.04, 0.12)):
        finger_x = palm_x + finger_offset
        cylinder(
            f"Finger_{side}_{finger_index}", (finger_x, -0.03, -1.035), 0.032,
            0.31 - abs(finger_offset) * 0.25, titanium, upper,
            scale=(0.85, 0.72, 1), vertices=24, bevel=0.018,
        )
    cylinder(
        f"Thumb_{side}", (palm_x + direction * 0.2, -0.035, -0.86), 0.045, 0.24,
        titanium, upper, rotation=(0, direction * 0.72, 0), vertices=24, bevel=0.02,
    )
    cable(
        f"ArmCable_{side}", (shoulder_x, 0.18, 0.75),
        (x + direction * 0.035, 0.16, 0.12), 0.026, rubber, upper, sag=0.09,
    )

# Head: separate cranial shell, jaw, visor, optics, ear modules, and seams.
uv_sphere("CranialShell", (0, 0.02, 0.43), (0.48, 0.405, 0.6), shell, head)
cube("FaceVisor", (0, -0.37, 0.39), (0.37, 0.065, 0.29), visor, head, bevel=0.15)
cube("ForeheadPlate", (0, -0.34, 0.69), (0.31, 0.07, 0.13), shell_secondary, head, bevel=0.085)
cube("JawCore", (0, -0.18, 0.05), (0.29, 0.22, 0.19), inner_mech, head, bevel=0.1)
cube("JawPlate", (0, -0.34, 0.09), (0.27, 0.08, 0.16), shell_secondary, head, bevel=0.085)
cube("MouthVent", (0, -0.43, 0.08), (0.14, 0.014, 0.027), rubber, head, bevel=0.012)

for side, x in (("L", -0.16), ("R", 0.16)):
    cube(f"EyeRail_{side}", (x, -0.443, 0.4), (0.085, 0.014, 0.022), acid, head, bevel=0.015)

for side, x in (("L", -0.49), ("R", 0.49)):
    cylinder(f"EarModule_{side}", (x, 0.0, 0.43), 0.13, 0.1, titanium, head, rotation=(0, math.pi / 2, 0), bevel=0.025)
    cylinder(
        f"EarInset_{side}", (x + (0.055 if side == "R" else -0.055), 0.0, 0.43),
        0.075, 0.018, orange, head, rotation=(0, math.pi / 2, 0), bevel=0.01,
    )

torus("CranialSeam", (0, 0.02, 0.43), 0.475, 0.016, titanium, head, rotation=(math.pi / 2, 0, 0))
cube("BrowSignal", (0, -0.435, 0.63), (0.04, 0.012, 0.035), orange, head, bevel=0.01)

root["tracking_system"] = "pointer-normalized-yaw-pitch"
root["design"] = "DM realistic articulated android v2"
upper["tracking_role"] = "upper-body"
upper["recommended_yaw_degrees"] = 7.0
head["tracking_role"] = "head"
head["recommended_yaw_degrees"] = 18.0
head["recommended_pitch_degrees"] = 10.0

bpy.context.scene.world.color = (0.004, 0.005, 0.005)
bpy.context.scene.render.engine = "BLENDER_EEVEE"

blend_path = ASSET_DIR / "cursor-robot.blend"
glb_path = ASSET_DIR / "cursor-robot.glb"
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
bpy.ops.export_scene.gltf(
    filepath=str(glb_path), export_format="GLB", export_yup=True,
    export_apply=True, export_extras=True,
)

print(f"Saved Blender source: {blend_path}")
print(f"Exported web model: {glb_path}")
