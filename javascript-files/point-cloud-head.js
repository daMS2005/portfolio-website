// A floating robot head rendered entirely as a 3D point cloud.
// Same helmet ellipsoid + LED eye grid as the mesh robots, but as particles.
// Returns { group } — rotate the group to make it look around.
export function buildPointCloudHead(THREE) {
  const hs = { x: 0.21, y: 0.27, z: 0.23 }; // ellipsoid radii (y up, +z = face)
  const pts = [];
  const cols = [];
  const c = new THREE.Color();

  // helmet shell: uniform points on a sphere, scaled to the ellipsoid
  for (let i = 0; i < 7000; i++) {
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const x = s * Math.cos(th);
    const y = u;
    const z = s * Math.sin(th);
    pts.push(x * hs.x, y * hs.y, z * hs.z);
    // brighter toward the face, cool blue-white
    const front = Math.max(0, z);
    c.setHSL(0.58 + Math.random() * 0.05, 0.55, 0.28 + front * 0.22 + Math.random() * 0.15);
    cols.push(c.r, c.g, c.b);
  }

  // ear pods hinted as denser side rings
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 350; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = 0.06 + Math.random() * 0.05;
      pts.push(sx * (hs.x + 0.012 + Math.random() * 0.01),
               Math.cos(a) * rr, Math.sin(a) * rr * 0.9);
      c.setHSL(0.60, 0.4, 0.25 + Math.random() * 0.15);
      cols.push(c.r, c.g, c.b);
    }
  }

  // LED eye grid: dense bright clusters, additive blending makes them glow
  for (const xc of [-0.072, 0.072]) {
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 3; row++) {
        const dx = xc + (col - 2) * 0.017;
        const dy = 0.015 + (row - 1) * 0.017;
        const inside = 1 - (dx / hs.x) ** 2 - (dy / hs.y) ** 2;
        const dz = hs.z * Math.sqrt(Math.max(0, inside)) + 0.008;
        for (let k = 0; k < 16; k++) {
          pts.push(dx + (Math.random() - 0.5) * 0.008,
                   dy + (Math.random() - 0.5) * 0.008,
                   dz + (Math.random() - 0.5) * 0.004);
          cols.push(1, 1, 1);
        }
      }
    }
  }

  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 32;
  const ctx = sprite.getContext('2d');
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cols), 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.0065,
    map: new THREE.CanvasTexture(sprite),
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  }));

  const group = new THREE.Group();
  group.add(points);
  return { group };
}
