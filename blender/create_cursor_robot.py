"""Generate an original cursor-tracking robot and export it as GLB.

Run with:
  blender --background --python blender/create_cursor_robot.py
"""

from pathlib import Path

import bpy
import math


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


def material(name, base_color, metallic=0.0, roughness=0.45, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*base_color, 1.0)
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*base_color, 1.0)
    principled.inputs["Metallic"].default_value = metallic
    principled.inputs["Roughness"].default_value = roughness
    if emission:
        principled.inputs["Emission Color"].default_value = (*emission, 1.0)
        principled.inputs["Emission Strength"].default_value = emission_strength
    return mat


def parent_local(obj, parent, location):
    obj.parent = parent
    obj.location = location


def cube(name, location, scale, mat, parent=None, bevel=0.08):
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new(name="Soft edges", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 4
        modifier.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(mat)
    if parent:
        parent_local(obj, parent, location)
    else:
        obj.location = location
    return obj


def uv_sphere(name, location, scale, mat, parent=None, segments=48, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    if parent:
        parent_local(obj, parent, location)
    else:
        obj.location = location
    return obj


def cylinder(name, location, radius, depth, mat, parent=None, rotation=(0, 0, 0), vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0, 0, 0), rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new(name="Soft edges", type="BEVEL")
    bevel.width = min(radius * 0.34, 0.08)
    bevel.segments = 3
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    if parent:
        parent_local(obj, parent, location)
    else:
        obj.location = location
    return obj


def empty(name, location, parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.22
    bpy.context.collection.objects.link(obj)
    if parent:
        parent_local(obj, parent, location)
    else:
        obj.location = location
    return obj


clear_scene()

graphite = material("Graphite", (0.027, 0.034, 0.032), metallic=0.82, roughness=0.2)
gunmetal = material("Gunmetal", (0.11, 0.13, 0.125), metallic=0.9, roughness=0.27)
chrome = material("Chrome", (0.42, 0.46, 0.44), metallic=1.0, roughness=0.12)
visor = material("Visor", (0.004, 0.006, 0.006), metallic=0.72, roughness=0.08)
orange = material("Signal Orange", (0.95, 0.12, 0.025), metallic=0.25, roughness=0.25, emission=(1.0, 0.055, 0.008), emission_strength=4.8)
acid = material("Signal Acid", (0.45, 0.8, 0.045), metallic=0.05, roughness=0.3, emission=(0.48, 1.0, 0.06), emission_strength=6.0)

root = empty("RobotRoot", (0, 0, 0))
lower = empty("LowerBody", (0, 0, 0), root)
upper = empty("UpperBodyPivot", (0, 0, 1.7), root)
head = empty("HeadPivot", (0, 0, 1.15), upper)

# Lower body stays planted while the torso and head track independently.
cube("Hip", (0, 0, 1.14), (0.62, 0.34, 0.22), gunmetal, lower, bevel=0.14)
for side, x in (("L", -0.36), ("R", 0.36)):
    uv_sphere(f"HipJoint_{side}", (x, 0, 0.98), (0.22, 0.22, 0.22), chrome, lower)
    cylinder(f"Thigh_{side}", (x, 0, 0.66), 0.19, 0.55, gunmetal, lower)
    uv_sphere(f"Knee_{side}", (x, 0, 0.36), (0.205, 0.205, 0.205), chrome, lower)
    cylinder(f"Shin_{side}", (x, 0, 0.07), 0.205, 0.5, graphite, lower)

# Torso and arms live under the upper-body tracking pivot.
cube("Torso", (0, 0, 0.16), (0.79, 0.38, 0.75), graphite, upper, bevel=0.24)
cube("ChestBand", (0, -0.365, 0.41), (0.47, 0.035, 0.055), orange, upper, bevel=0.025)
cylinder("Neck", (0, 0, 0.96), 0.205, 0.34, chrome, upper)

for side, x, tilt in (("L", -1.02, -0.12), ("R", 1.02, 0.12)):
    uv_sphere(f"Shoulder_{side}", (x * 0.83, 0, 0.48), (0.275, 0.275, 0.275), chrome, upper)
    upper_arm = cylinder(f"UpperArm_{side}", (x, 0, 0.11), 0.225, 0.72, graphite, upper, rotation=(0, tilt, 0))
    upper_arm.scale.x = 0.85
    uv_sphere(f"Elbow_{side}", (x * 1.07, 0, -0.28), (0.21, 0.21, 0.21), chrome, upper)
    forearm = cylinder(f"Forearm_{side}", (x * 1.09, 0, -0.63), 0.235, 0.62, gunmetal, upper, rotation=(0, -tilt * 0.55, 0))
    forearm.scale.x = 0.84
    uv_sphere(f"Hand_{side}", (x * 1.06, -0.015, -0.99), (0.25, 0.2, 0.24), graphite, upper)

# The head pivot is centered at the neck, so pitch and yaw feel natural.
uv_sphere("HeadShell", (0, 0, 0.38), (0.52, 0.42, 0.58), graphite, head)
cube("FaceVisor", (0, -0.365, 0.37), (0.38, 0.055, 0.27), visor, head, bevel=0.16)
for side, x in (("L", -0.15), ("R", 0.15)):
    cube(f"Eye_{side}", (x, -0.425, 0.39), (0.065, 0.018, 0.026), acid, head, bevel=0.02)
cylinder("Antenna", (0, 0, 0.96), 0.025, 0.29, chrome, head)
uv_sphere("AntennaLight", (0, 0, 1.13), (0.075, 0.075, 0.075), orange, head, segments=32, rings=16)

# Add metadata that survives export and documents the intended runtime controls.
root["tracking_system"] = "pointer-normalized-yaw-pitch"
upper["tracking_role"] = "upper-body"
upper["recommended_yaw_degrees"] = 7.0
head["tracking_role"] = "head"
head["recommended_yaw_degrees"] = 18.0
head["recommended_pitch_degrees"] = 10.0

bpy.context.scene.world.color = (0.005, 0.006, 0.006)
bpy.context.scene.render.engine = "BLENDER_EEVEE"

blend_path = ASSET_DIR / "cursor-robot.blend"
glb_path = ASSET_DIR / "cursor-robot.glb"
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
bpy.ops.export_scene.gltf(
    filepath=str(glb_path),
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_extras=True,
)

print(f"Saved Blender source: {blend_path}")
print(f"Exported web model: {glb_path}")
