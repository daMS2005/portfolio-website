// The same robot as blender/build_robot.py, but modeled 100% in three.js
// primitives — no asset file at all. Returns { group, head, torso } with the
// same pivot conventions as the GLB (head pivot at neck top, torso at waist).
export function buildPrimitivesRobot(THREE, RoundedBoxGeometry) {
  const glossHead = new THREE.MeshPhysicalMaterial({
    color: 0x0a0a0c, roughness: 0.10, metalness: 0.40,
    clearcoat: 1.0, clearcoatRoughness: 0.08,
  });
  const bodyDark = new THREE.MeshStandardMaterial({
    color: 0x1c1c1e, roughness: 0.48, metalness: 0.20,
  });
  const jointDark = new THREE.MeshStandardMaterial({
    color: 0x151517, roughness: 0.28, metalness: 0.70,
  });
  const eyeLED = new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: 0xffffff, emissiveIntensity: 3.5,
  });

  const sphereGeo = new THREE.SphereGeometry(1, 48, 24);
  const dotGeo = new THREE.SphereGeometry(1, 8, 6);

  function ball(mat, pos, scale) {
    const m = new THREE.Mesh(sphereGeo, mat);
    m.position.set(...pos);
    m.scale.set(...scale);
    return m;
  }
  function box(mat, pos, dims, radius) {
    const m = new THREE.Mesh(new RoundedBoxGeometry(...dims, 4, radius), mat);
    m.position.set(...pos);
    return m;
  }
  function tube(mat, pos, r, h) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 48), mat);
    m.position.set(...pos);
    return m;
  }

  const group = new THREE.Group();

  // -- torso (pivot at waist, y = 1.02) --------------------------
  const torso = new THREE.Group();
  torso.position.y = 1.02;
  group.add(torso);

  torso.add(box(bodyDark, [0, 0.30, 0], [0.44, 0.38, 0.28], 0.10)); // chest
  torso.add(box(jointDark, [0, 0.02, 0], [0.28, 0.24, 0.20], 0.08)); // abdomen
  torso.add(tube(jointDark, [0, 0.565, 0], 0.085, 0.13)); // neck
  torso.add(tube(jointDark, [0, 0.525, 0], 0.105, 0.05)); // neck ring

  // -- head (pivot at neck top, y = 1.62; face looks toward +Z) --
  const head = new THREE.Group();
  head.position.y = 0.60; // 1.62 world, relative to torso
  torso.add(head);

  const hs = { x: 0.210, y: 0.270, z: 0.230 }; // ellipsoid radii
  head.add(ball(glossHead, [0, 0.24, 0], [hs.x, hs.y, hs.z]));

  // LED dot-matrix eyes on the helmet's curved front surface
  for (const xc of [-0.072, 0.072]) {
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 3; row++) {
        const dx = xc + (col - 2) * 0.017;
        const dy = 0.015 + (row - 1) * 0.017;
        const inside = 1 - (dx / hs.x) ** 2 - (dy / hs.y) ** 2;
        const dz = hs.z * Math.sqrt(Math.max(0, inside)) + 0.004;
        const dot = new THREE.Mesh(dotGeo, eyeLED);
        dot.position.set(dx, 0.24 + dy, dz);
        dot.scale.setScalar(0.0085);
        head.add(dot);
      }
    }
  }

  // -- arms (positions relative to torso pivot) ------------------
  for (const s of [-1, 1]) {
    torso.add(ball(jointDark, [s * 0.315, 0.42, 0], [0.11, 0.11, 0.11])); // shoulder
    torso.add(ball(bodyDark, [s * 0.36, 0.15, 0], [0.085, 0.20, 0.085])); // upper arm
    torso.add(ball(jointDark, [s * 0.36, -0.06, 0], [0.08, 0.08, 0.08])); // elbow
    torso.add(ball(bodyDark, [s * 0.36, -0.26, 0], [0.07, 0.17, 0.07])); // forearm
    torso.add(box(glossHead, [s * 0.36, -0.455, 0], [0.10, 0.13, 0.07], 0.03)); // hand
  }

  // -- hips + legs (parented to root, they don't sway) -----------
  group.add(box(bodyDark, [0, 0.82, 0], [0.36, 0.18, 0.24], 0.07));
  for (const s of [-1, 1]) {
    group.add(ball(bodyDark, [s * 0.17, 0.55, 0], [0.105, 0.23, 0.105]));
    group.add(ball(jointDark, [s * 0.17, 0.34, 0], [0.09, 0.09, 0.09]));
    group.add(ball(bodyDark, [s * 0.17, 0.15, 0], [0.085, 0.20, 0.085]));
  }

  return { group, head, torso };
}
