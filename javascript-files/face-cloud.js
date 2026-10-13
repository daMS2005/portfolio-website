// Floating point-cloud face scanned from photos (see scan/).
// Loads a PLY (positions + vertex colors) and renders it as soft particles.
// Returns a promise of { group } — rotate the group to look around.
import * as THREE from 'three';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

export async function buildFaceCloud(url, { size = 0.0075, brightness = 1.3, additive = false } = {}) {
  const geo = await new PLYLoader().loadAsync(url);
  geo.computeBoundingBox();

  // Plain depth-tested points: soft alpha sprites without depth writes let
  // bright skin points bleed over the dark features (brows, lips) that carry
  // likeness; an opaque z-buffered splat keeps them crisp, like a raster.
  const mat = new THREE.PointsMaterial({
    size,
    vertexColors: true,
    sizeAttenuation: true,
  });
  if (additive) {
    // emissive hologram look: overlapping points sum into glow
    mat.blending = THREE.AdditiveBlending;
    mat.transparent = true;
    mat.depthWrite = false;
  }
  // exposure trim; material.color multiplies vertex colors
  mat.color.setScalar(brightness);
  const points = new THREE.Points(geo, mat);

  const group = new THREE.Group();
  group.add(points);
  return { group };
}
