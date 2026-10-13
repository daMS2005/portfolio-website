// Cursor-tracking 3D robot (asset built in Blender, see blender/build_robot.py).
// Usage: RobotHero.mount(document.querySelector('#robot-container'))
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const RobotHero = {
  mount(container, { modelUrl = 'assets/robot.glb' } = {}) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      35, container.clientWidth / container.clientHeight, 0.1, 50
    );

    // Two framings: full figure in the hero, head-and-shoulders bust when
    // the robot docks into the corner widget. The camera lerps between them.
    const FRAMES = {
      hero: { pos: new THREE.Vector3(0, 1.55, 2.4), look: new THREE.Vector3(0, 1.42, 0) },
      dock: { pos: new THREE.Vector3(0, 1.78, 1.05), look: new THREE.Vector3(0, 1.70, 0) },
    };
    let frame = FRAMES.hero;
    const camLook = FRAMES.hero.look.clone();
    camera.position.copy(FRAMES.hero.pos);
    camera.lookAt(camLook);

    // Studio environment so the glossy visor has something to reflect.
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    // Matte black needs strong edge light to separate from a dark page.
    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(2.5, 3.5, 2.5);
    scene.add(key);
    const rimCool = new THREE.DirectionalLight(0xaabbff, 2.6);
    rimCool.position.set(-3, 2, -2);
    scene.add(rimCool);
    const rimWarm = new THREE.DirectionalLight(0xffd9b0, 1.4);
    rimWarm.position.set(3, 1.5, -2.5);
    scene.add(rimWarm);
    scene.add(new THREE.AmbientLight(0xffffff, 0.16));

    let head = null;
    let torso = null;
    let torsoBaseY = 0;
    new GLTFLoader().load(modelUrl, (gltf) => {
      head = gltf.scene.getObjectByName('Head');
      torso = gltf.scene.getObjectByName('Torso');
      torsoBaseY = torso.position.y;
      scene.add(gltf.scene);
    });

    // Pointer state, normalized to [-1, 1] across the whole viewport so the
    // robot reacts to the cursor anywhere on the page, not just over the canvas.
    const pointer = new THREE.Vector2(0, 0);
    window.addEventListener('pointermove', (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    });

    const lookTarget = new THREE.Vector3(0, 1.55, 2);
    const desiredQuat = new THREE.Quaternion();
    const currentQuat = new THREE.Quaternion();
    const clock = new THREE.Clock();

    function trackCursor(part, target, smoothing) {
      currentQuat.copy(part.quaternion);
      part.lookAt(target);
      desiredQuat.copy(part.quaternion);
      part.quaternion.copy(currentQuat).slerp(desiredQuat, smoothing);
    }

    function animate() {
      requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Where the robot looks: a point floating in front of it, steered by
      // the cursor. Limited extents double as natural rotation limits.
      lookTarget.set(pointer.x * 1.7, 1.55 + pointer.y * 1.0, 2.0);

      if (head) trackCursor(head, lookTarget, 0.14);         // fast follow
      if (torso) {
        trackCursor(torso, lookTarget, 0.03);                // lazy follow
        // subtle idle breathing (offset from the GLB rest position)
        torso.position.y = torsoBaseY + Math.sin(t * 1.6) * 0.008;
      }

      // ease the camera toward the active framing (hero <-> dock)
      camera.position.lerp(frame.pos, 0.07);
      camLook.lerp(frame.look, 0.07);
      camera.lookAt(camLook);

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

    return {
      setMode(mode) {
        frame = FRAMES[mode] || FRAMES.hero;
      },
      resize,
    };
  },
};
