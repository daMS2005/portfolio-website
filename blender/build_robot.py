"""Procedurally build a stylized humanoid robot and export it as robot.glb.

Run headless:
    blender --background --python blender/build_robot.py -- --out assets/robot.glb

The exported hierarchy uses stable object names the web runtime rotates at
runtime (cursor tracking):

    RobotRoot
      Torso            <- slow, partial cursor follow (pivot at waist)
        Chest / ChestPlate / CoreGlow / Collar / Spine segments
        Neck
          Head         <- fast cursor follow (pivot at neck base)
            EyeDot_*   <- emissive LED dot-matrix eyes
            EarPod / HelmetSeam
        Shoulder.L/R -> UpperArm -> Elbow -> Forearm -> Hand
      Hips -> legs
"""

import bpy
import math
import sys


# ---------------------------------------------------------------- helpers

def parse_out_path() -> str:
    argv = sys.argv
    if "--" in argv:
        tail = argv[argv.index("--") + 1:]
        if "--out" in tail:
            return tail[tail.index("--out") + 1]
    return "robot.glb"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def set_input(node, names, value):
    """Set the first matching socket; Principled socket names vary by version."""
    for name in names:
        sock = node.inputs.get(name)
        if sock is not None:
            sock.default_value = value
            return


def make_material(name, color, roughness, metallic, coat=0.0, emission=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    set_input(bsdf, ["Base Color"], (*color, 1.0))
    set_input(bsdf, ["Roughness"], roughness)
    set_input(bsdf, ["Metallic"], metallic)
    if coat:
        set_input(bsdf, ["Coat Weight", "Clearcoat"], coat)
        set_input(bsdf, ["Coat Roughness", "Clearcoat Roughness"], 0.08)
    if emission:
        set_input(bsdf, ["Emission Color", "Emission"], (*emission[0], 1.0))
        set_input(bsdf, ["Emission Strength"], emission[1])
    return mat


def set_origin(obj, pivot):
    """Move an object's origin to a world-space pivot without moving geometry."""
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.scene.cursor.location = pivot
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")


def parent_keep_transform(child, parent):
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()


def smooth(obj):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.shade_smooth()


def sphere(name, location, scale, mat, segments=32):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=segments // 2, radius=1.0, location=location
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    smooth(obj)
    return obj


def rounded_box(name, location, scale, mat, bevel=0.05, taper_bottom=1.0):
    """A beveled box; taper_bottom < 1 narrows the lower half (armor plates)."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    if taper_bottom != 1.0:
        for v in obj.data.vertices:
            if v.co.z < 0:
                v.co.x *= taper_bottom
                v.co.y *= taper_bottom
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = bevel
    mod.segments = 6
    obj.data.materials.append(mat)
    smooth(obj)
    return obj


def cylinder(name, location, radius, depth, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=36, radius=radius, depth=depth, location=location, rotation=rotation
    )
    obj = bpy.context.active_object
    obj.name = name
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = radius * 0.25
    mod.segments = 4
    obj.data.materials.append(mat)
    smooth(obj)
    return obj


def tapered_limb(name, location, r_top, r_bottom, depth, mat):
    """A subtly tapered vertical limb segment reads far more mechanical
    than a blob-sphere."""
    bpy.ops.mesh.primitive_cone_add(
        vertices=36, radius1=r_bottom, radius2=r_top, depth=depth, location=location
    )
    obj = bpy.context.active_object
    obj.name = name
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = min(r_top, r_bottom) * 0.35
    mod.segments = 5
    obj.data.materials.append(mat)
    smooth(obj)
    return obj


def ring(name, location, major, minor, mat, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, location=location,
        major_segments=40, minor_segments=10,
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    smooth(obj)
    return obj


def empty(name, location):
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=location)
    obj = bpy.context.active_object
    obj.name = name
    return obj


# ---------------------------------------------------------------- build

def build():
    clear_scene()

    matte_black = make_material("MatteBlack", (0.010, 0.010, 0.011), 0.52, 0.12)
    satin_panel = make_material("SatinPanel", (0.014, 0.014, 0.016), 0.30, 0.35)
    joint_dark = make_material("JointDark", (0.008, 0.008, 0.009), 0.28, 0.70)
    gloss_visor = make_material("GlossVisor", (0.004, 0.004, 0.005), 0.06, 0.30, coat=1.0)
    visor_led = make_material("VisorLED", (0.0, 0.0, 0.0), 0.3, 0.0,
                              emission=((0.80, 0.92, 1.0), 4.0))

    root = empty("RobotRoot", (0, 0, 0))

    # -- torso ------------------------------------------------------
    torso = empty("Torso", (0, 0, 1.02))
    parent_keep_transform(torso, root)

    # sculpted chest: broad shoulders tapering hard to the waist
    chest = rounded_box("Chest", (0, 0, 1.33), (0.44, 0.26, 0.36), matte_black,
                        bevel=0.09, taper_bottom=0.60)
    set_origin(chest, (0, 0, 1.02))
    parent_keep_transform(chest, torso)

    # pectoral plates, slightly proud of the chest
    for side, sx in (("L", -1), ("R", 1)):
        pec = rounded_box(f"Pec.{side}", (sx * 0.105, -0.115, 1.38),
                          (0.185, 0.075, 0.185), satin_panel, bevel=0.045,
                          taper_bottom=0.80)
        parent_keep_transform(pec, torso)

    back = rounded_box("BackPlate", (0, 0.10, 1.35), (0.30, 0.10, 0.28),
                       satin_panel, bevel=0.05)
    parent_keep_transform(back, torso)

    collar = rounded_box("Collar", (0, 0, 1.525), (0.24, 0.17, 0.09), joint_dark, bevel=0.035)
    parent_keep_transform(collar, torso)

    waist = cylinder("WaistCore", (0, 0, 1.05), 0.095, 0.16, joint_dark)
    parent_keep_transform(waist, torso)

    abdomen = rounded_box("Abdomen", (0, -0.01, 1.13), (0.22, 0.17, 0.13),
                          satin_panel, bevel=0.04, taper_bottom=0.85)
    parent_keep_transform(abdomen, torso)

    # -- neck + head ------------------------------------------------
    neck_base = (0, 0, 1.56)
    neck = cylinder("Neck", (0, 0, 1.60), 0.058, 0.09, joint_dark)
    set_origin(neck, neck_base)
    parent_keep_transform(neck, torso)

    # smooth faceless visor head, helmet + chin silhouette
    head_pivot = (0, 0, 1.63)
    head = sphere("Head", (0, -0.005, 1.79), (0.125, 0.150, 0.180), gloss_visor, segments=48)
    set_origin(head, head_pivot)
    parent_keep_transform(head, neck)

    chin = sphere("Chin", (0, -0.055, 1.705), (0.095, 0.105, 0.095), gloss_visor)
    parent_keep_transform(chin, head)

    # slim LED visor strip instead of cartoon eyes
    visor = rounded_box("VisorStrip", (0, -0.152, 1.815), (0.115, 0.022, 0.020),
                        visor_led, bevel=0.008)
    parent_keep_transform(visor, head)

    for side, sx in (("L", -1), ("R", 1)):
        pod = cylinder(f"EarPod.{side}", (sx * 0.125, -0.005, 1.80), 0.038, 0.02,
                       joint_dark, rotation=(0, math.pi / 2, 0))
        parent_keep_transform(pod, head)

    # -- shoulders + arms ------------------------------------------
    for side, sx in (("L", -1), ("R", 1)):
        shoulder_pos = (sx * 0.295, 0, 1.435)
        cap = sphere(f"Shoulder.{side}", shoulder_pos, (0.105, 0.105, 0.105), matte_black)
        parent_keep_transform(cap, torso)

        pad = rounded_box(f"ShoulderPad.{side}", (sx * 0.315, 0, 1.50),
                          (0.13, 0.15, 0.07), satin_panel, bevel=0.03)
        parent_keep_transform(pad, torso)

        upper = tapered_limb(f"UpperArm.{side}", (sx * 0.335, 0, 1.25),
                             0.060, 0.050, 0.30, matte_black)
        set_origin(upper, shoulder_pos)
        parent_keep_transform(upper, cap)

        # horizontal cylinder actuator at the elbow
        elbow_pos = (sx * 0.335, 0, 1.065)
        elbow = cylinder(f"Elbow.{side}", elbow_pos, 0.052, 0.125, joint_dark,
                         rotation=(0, math.pi / 2, 0))
        parent_keep_transform(elbow, upper)

        forearm = rounded_box(f"Forearm.{side}", (sx * 0.335, 0, 0.90),
                              (0.085, 0.10, 0.235), satin_panel, bevel=0.032,
                              taper_bottom=0.72)
        set_origin(forearm, elbow_pos)
        parent_keep_transform(forearm, elbow)

        wrist = cylinder(f"Wrist.{side}", (sx * 0.335, 0, 0.765), 0.038, 0.045, joint_dark)
        parent_keep_transform(wrist, forearm)

        hand = rounded_box(f"Hand.{side}", (sx * 0.335, -0.005, 0.665),
                           (0.075, 0.055, 0.135), gloss_visor, bevel=0.022)
        set_origin(hand, (sx * 0.335, 0, 0.73))
        parent_keep_transform(hand, forearm)

        thumb = rounded_box(f"Thumb.{side}", (sx * (0.335 - 0.048), -0.02, 0.695),
                            (0.028, 0.03, 0.06), gloss_visor, bevel=0.012)
        parent_keep_transform(thumb, forearm)

    # -- pelvis + legs ---------------------------------------------
    pelvis = rounded_box("Pelvis", (0, 0, 0.90), (0.30, 0.21, 0.16), joint_dark,
                         bevel=0.05, taper_bottom=0.82)
    parent_keep_transform(pelvis, root)

    for side, sx in (("L", -1), ("R", 1)):
        hip = sphere(f"Hip.{side}", (sx * 0.155, 0, 0.80), (0.085, 0.085, 0.085), joint_dark)
        parent_keep_transform(hip, pelvis)

        thigh = rounded_box(f"Thigh.{side}", (sx * 0.16, 0, 0.60),
                            (0.145, 0.165, 0.34), matte_black, bevel=0.05,
                            taper_bottom=0.78)
        parent_keep_transform(thigh, pelvis)

        knee = cylinder(f"Knee.{side}", (sx * 0.16, 0, 0.40), 0.055, 0.12, joint_dark,
                        rotation=(0, math.pi / 2, 0))
        parent_keep_transform(knee, pelvis)

        calf = tapered_limb(f"Calf.{side}", (sx * 0.16, 0.01, 0.23), 0.062, 0.048,
                            0.30, matte_black)
        parent_keep_transform(calf, pelvis)

        guard = rounded_box(f"ShinGuard.{side}", (sx * 0.16, -0.062, 0.245),
                            (0.085, 0.035, 0.24), satin_panel, bevel=0.025,
                            taper_bottom=0.85)
        parent_keep_transform(guard, pelvis)

        foot = rounded_box(f"Foot.{side}", (sx * 0.16, -0.035, 0.05),
                           (0.105, 0.21, 0.075), joint_dark, bevel=0.03)
        parent_keep_transform(foot, pelvis)

    return root


def export(path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_apply=True,
        use_selection=True,
    )


if __name__ == "__main__":
    out = parse_out_path()
    build()
    export(out)
    print(f"Exported robot to {out}")
