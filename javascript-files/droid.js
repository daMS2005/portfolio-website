// Droid tour guide: the Spline "Droid" (by ela, remixed) exported as GLTF,
// rendered in a small fixed corner widget with our own three.js pipeline.
// Tracks the cursor, blinks, and does a happy spin when clicked.
// Spline's GLTF export drops materials, so we reassign them by node name.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const DroidGuide = {
  mount(container, { modelUrl = 'assets/droid.glb' } = {}) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || 170, container.clientHeight || 200);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      35, (container.clientWidth || 170) / (container.clientHeight || 200), 0.1, 50
    );
    camera.position.set(0, 1.36, 2.0);
    camera.lookAt(0, 1.32, 0);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2.5, 3.5, 2.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xaabbff, 1.2);
    rim.position.set(-3, 2, -2);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    const shellMat = new THREE.MeshPhysicalMaterial({
      color: 0xf2f2f5, roughness: 0.32, metalness: 0.02,
      clearcoat: 0.6, clearcoatRoughness: 0.25,
    });
    const faceMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a0a0c, roughness: 0.15, metalness: 0.1,
      clearcoat: 1.0, clearcoatRoughness: 0.1,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6,
    });
    const MAT_BY_NAME = {
      Cube_3: faceMat,       // inset face screen
      Ellipse: eyeMat,       // eyes
      Ellipse_2: eyeMat,
    };

    let droid = null;
    let innerRoot = null;
    const eyes = [];
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(modelUrl, (gltf) => {
      const root = gltf.scene;
      root.traverse((o) => {
        if (o.isLight) o.visible = false;
        if (o.isMesh) {
          o.material = MAT_BY_NAME[o.name] || shellMat;
          if (o.name === 'Ellipse' || o.name === 'Ellipse_2') eyes.push(o);
        }
      });
      // give the droid a smile: a white arc under the eyes, sized and
      // placed from the eye geometry itself
      if (eyes.length === 2) {
        const e0 = new THREE.Vector3();
        const e1 = new THREE.Vector3();
        eyes[0].getWorldPosition(e0);
        eyes[1].getWorldPosition(e1);
        const eyeBox = new THREE.Box3().setFromObject(eyes[0]);
        const eyeD = eyeBox.getSize(new THREE.Vector3()).x;
        const eyeDist = e0.distanceTo(e1);
        const arc = Math.PI * 0.40;   // chill, not manic
        const parent = eyes[0].parent;
        // geometry lives in the parent's (scaled) local space - compensate
        const ps = new THREE.Vector3();
        parent.getWorldScale(ps);
        const k = ps.x || 1;
        const smile = new THREE.Mesh(
          new THREE.TorusGeometry((eyeDist * 0.44) / k, (eyeD * 0.115) / k, 12, 40, arc),
          eyeMat
        );
        const mid = e0.clone().add(e1).multiplyScalar(0.5);
        parent.add(smile);
        smile.position.copy(parent.worldToLocal(mid.clone()));
        smile.position.y -= (eyeDist * 0.26) / k;
        smile.position.z += 0.006 / k;
        smile.rotation.z = 1.5 * Math.PI - arc / 2; // center the arc at the bottom
      }

      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const s = 0.8 / size.y;
      root.position.sub(center).multiplyScalar(s);
      root.scale.setScalar(s);
      const holder = new THREE.Group();
      holder.add(root);
      holder.position.set(0, 1.32, 0);
      scene.add(holder);
      droid = holder;
      innerRoot = root;
      window.__droid = { scene, holder, root, THREE };
    });

    const pointer = new THREE.Vector2(0, 0);
    window.addEventListener('pointermove', (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    });

    const lookTarget = new THREE.Vector3(0, 1.32, 2);
    const desiredQuat = new THREE.Quaternion();
    const currentQuat = new THREE.Quaternion();
    const clock = new THREE.Clock();

    // blink + reaction state
    let nextBlink = 2.5;
    let reactionStart = -10;
    let reaction = 'idle';

    function animate() {
      requestAnimationFrame(animate);
      // don't burn GPU/battery re-rendering a droid nobody can see
      if (document.hidden) return;
      const t = clock.getElapsedTime();

      if (droid) {
        // the widget sits bottom-right, so bias the gaze toward the page
        lookTarget.set(pointer.x * 1.4 - 0.35, 1.35 + pointer.y * 0.9, 2.0);
        currentQuat.copy(droid.quaternion);
        droid.lookAt(lookTarget);
        desiredQuat.copy(droid.quaternion);
        droid.quaternion.copy(currentQuat).slerp(desiredQuat, 0.10);

        // Idle sway plus distinct reactions for clicks, section changes, and chat.
        let y = 1.32 + Math.sin(t * 1.3) * 0.03;
        const rt = t - reactionStart;
        if (innerRoot) {
          innerRoot.rotation.y = Math.sin(t * 0.55) * 0.055;
          innerRoot.rotation.x = 0;
          innerRoot.rotation.z = Math.sin(t * 0.8) * 0.018;

          if (reaction === 'spin' && rt >= 0 && rt <= 0.75) {
            const p = rt / 0.75;
            const ease = 1 - Math.pow(1 - p, 3);
            innerRoot.rotation.y = ease * Math.PI * 2;
            y += Math.sin(p * Math.PI) * 0.11;
          } else if (reaction === 'nod' && rt >= 0 && rt <= 0.9) {
            const p = rt / 0.9;
            innerRoot.rotation.x = Math.sin(p * Math.PI * 2) * 0.16;
          } else if (reaction === 'wave' && rt >= 0 && rt <= 1.1) {
            const p = rt / 1.1;
            innerRoot.rotation.z = Math.sin(p * Math.PI * 4) * 0.12 * (1 - p);
            innerRoot.rotation.y += 0.18;
          } else if (reaction === 'happy' && rt >= 0 && rt <= 0.9) {
            const p = rt / 0.9;
            y += Math.abs(Math.sin(p * Math.PI * 2)) * 0.085 * (1 - p * 0.35);
            innerRoot.rotation.z = Math.sin(p * Math.PI * 4) * 0.07;
          }
        }
        droid.position.y = y;

        // blink: squash the eyes every few seconds (relative to scale.x: the
        // compressed model keeps each eye's size in its node scale)
        if (t > nextBlink) {
          const phase = (t - nextBlink) / 0.16;
          if (phase >= 1) {
            eyes.forEach((e) => { e.scale.y = e.scale.x; });
            nextBlink = t + 2.4 + Math.random() * 3.2;
          } else {
            const k = 1 - Math.sin(phase * Math.PI) * 0.85;
            eyes.forEach((e) => { e.scale.y = e.scale.x * k; });
          }
        }
      }

      renderer.render(scene, camera);
    }
    animate();

    function resize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', resize);

    container.addEventListener('pointerenter', () => {
      reaction = 'wave';
      reactionStart = clock.getElapsedTime();
    });

    return {
      resize,
      spin() { reaction = 'spin'; reactionStart = clock.getElapsedTime(); },
      react(kind = 'nod') { reaction = kind; reactionStart = clock.getElapsedTime(); },
    };
  },
};
