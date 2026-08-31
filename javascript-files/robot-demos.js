import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const damp = (current, target, speed, delta) =>
  THREE.MathUtils.lerp(current, target, 1 - Math.exp(-speed * delta));

const settings = {
  range: 18,
  damping: 10,
  paused: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
};

const pointerStates = new Map();

function createPointerState(stage) {
  const state = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    active: false,
  };

  const updateTarget = (clientX, clientY) => {
    if (settings.paused) return;
    const bounds = stage.getBoundingClientRect();
    state.targetX = clamp(((clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1);
    state.targetY = clamp(((clientY - bounds.top) / bounds.height) * 2 - 1, -1, 1);
    state.active = true;
    stage.classList.add("is-tracking");
    stage.style.setProperty("--pointer-x", `${((state.targetX + 1) / 2) * 100}%`);
    stage.style.setProperty("--pointer-y", `${((state.targetY + 1) / 2) * 100}%`);
  };

  stage.addEventListener("pointermove", (event) => updateTarget(event.clientX, event.clientY));
  stage.addEventListener("pointerdown", (event) => {
    stage.setPointerCapture?.(event.pointerId);
    updateTarget(event.clientX, event.clientY);
  });
  stage.addEventListener("pointerleave", () => resetPointerState(stage));
  stage.addEventListener("keydown", (event) => {
    const keyboardStep = 0.18;
    if (event.key === "ArrowLeft") state.targetX = clamp(state.targetX - keyboardStep, -1, 1);
    else if (event.key === "ArrowRight") state.targetX = clamp(state.targetX + keyboardStep, -1, 1);
    else if (event.key === "ArrowUp") state.targetY = clamp(state.targetY - keyboardStep, -1, 1);
    else if (event.key === "ArrowDown") state.targetY = clamp(state.targetY + keyboardStep, -1, 1);
    else return;
    event.preventDefault();
    state.active = true;
    stage.classList.add("is-tracking");
    stage.style.setProperty("--pointer-x", `${((state.targetX + 1) / 2) * 100}%`);
    stage.style.setProperty("--pointer-y", `${((state.targetY + 1) / 2) * 100}%`);
  });

  pointerStates.set(stage, state);
  return state;
}

function resetPointerState(stage) {
  const state = pointerStates.get(stage);
  if (!state) return;
  state.targetX = 0;
  state.targetY = 0;
  state.active = false;
  stage.classList.remove("is-tracking");
  stage.style.setProperty("--pointer-x", "50%");
  stage.style.setProperty("--pointer-y", "50%");
}

const domStage = document.querySelector("#domStage");
const threeStage = document.querySelector("#threeStage");
const pointStage = document.querySelector("#pointStage");
const domState = createPointerState(domStage);
const threeState = createPointerState(threeStage);
const pointState = createPointerState(pointStage);

let lastDomFrame = performance.now();

function animateDomRobot(now) {
  const delta = Math.min((now - lastDomFrame) / 1000, 0.05);
  lastDomFrame = now;
  const speed = settings.paused ? 18 : settings.damping;
  const targetX = settings.paused ? 0 : domState.targetX;
  const targetY = settings.paused ? 0 : domState.targetY;

  domState.x = damp(domState.x, targetX, speed, delta);
  domState.y = damp(domState.y, targetY, speed, delta);

  domStage.style.setProperty("--head-yaw", `${domState.x * settings.range}deg`);
  domStage.style.setProperty("--head-pitch", `${-domState.y * settings.range * 0.62}deg`);
  domStage.style.setProperty("--torso-yaw", `${domState.x * settings.range * 0.38}deg`);
  domStage.style.setProperty("--torso-pitch", `${-domState.y * settings.range * 0.2}deg`);
  domStage.style.setProperty("--eye-x", `${domState.x * 3}px`);
  domStage.style.setProperty("--eye-y", `${domState.y * 2}px`);
  requestAnimationFrame(animateDomRobot);
}

requestAnimationFrame(animateDomRobot);

const canvas = document.querySelector("#robotCanvas");
const loaderElement = document.querySelector("#modelLoader");
const errorElement = document.querySelector("#modelError");
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0b0b, 0.075);

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
camera.position.set(0, 2.3, 8.4);
camera.lookAt(0, 1.85, 0);

const hemiLight = new THREE.HemisphereLight(0xdde7ff, 0x090a0a, 1.1);
scene.add(hemiLight);

const keyLight = new THREE.SpotLight(0xffffff, 75, 20, Math.PI / 5, 0.5, 1.2);
keyLight.position.set(-3.8, 6.2, 5.5);
keyLight.target.position.set(0, 1.7, 0);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.bias = -0.0006;
scene.add(keyLight, keyLight.target);

const fillLight = new THREE.PointLight(0xbfd4ff, 12, 18, 1.35);
fillLight.position.set(2.7, 4.3, 4.2);
scene.add(fillLight);

const rimLight = new THREE.SpotLight(0xff6b2c, 120, 18, Math.PI / 4, 0.58, 1.4);
rimLight.position.set(4.5, 3.6, -3.2);
rimLight.target.position.set(0, 1.5, 0);
scene.add(rimLight, rimLight.target);

const acidLight = new THREE.PointLight(0xd8ff55, 6, 5, 2);
acidLight.position.set(-1.5, 2.8, 2.8);
scene.add(acidLight);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(3.2, 96),
  new THREE.MeshStandardMaterial({ color: 0x0a0b0b, roughness: 0.72, metalness: 0.2 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.03;
floor.receiveShadow = true;
scene.add(floor);

const ring = new THREE.Mesh(
  new THREE.RingGeometry(2.15, 2.18, 96),
  new THREE.MeshBasicMaterial({ color: 0xff6b2c, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.002;
scene.add(ring);

let robotRoot = null;
let upperBodyPivot = null;
let headPivot = null;
let modelReady = false;
let lastThreeFrame = performance.now();
const initialUpperRotation = new THREE.Euler();
const initialHeadRotation = new THREE.Euler();

function loadRobot() {
  modelReady = false;
  loaderElement.hidden = false;
  errorElement.hidden = true;

  if (robotRoot) {
    scene.remove(robotRoot);
    robotRoot = null;
  }

  const loader = new GLTFLoader();
  const modelUrl = new URL("../robot-assets/cursor-robot.glb", import.meta.url);
  loader.load(
    modelUrl.href,
    (gltf) => {
      robotRoot = gltf.scene;
      robotRoot.position.set(0, 0, 0);
      robotRoot.scale.setScalar(0.96);
      scene.add(robotRoot);

      upperBodyPivot = robotRoot.getObjectByName("UpperBodyPivot");
      headPivot = robotRoot.getObjectByName("HeadPivot");
      if (!upperBodyPivot || !headPivot) {
        throw new Error("The GLB is missing its tracking pivots.");
      }

      initialUpperRotation.copy(upperBodyPivot.rotation);
      initialHeadRotation.copy(headPivot.rotation);
      robotRoot.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
      });

      modelReady = true;
      loaderElement.hidden = true;
    },
    undefined,
    (error) => {
      console.error("Unable to load Blender robot", error);
      loaderElement.hidden = true;
      errorElement.hidden = false;
    },
  );
}

loadRobot();

document.querySelector("[data-retry]")?.addEventListener("click", loadRobot);

function resizeRenderer() {
  const { width, height } = threeStage.getBoundingClientRect();
  const safeWidth = Math.max(1, Math.floor(width));
  const safeHeight = Math.max(1, Math.floor(height));
  const dpr = Math.min(window.devicePixelRatio, 2);
  const targetWidth = Math.floor(safeWidth * dpr);
  const targetHeight = Math.floor(safeHeight * dpr);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    renderer.setPixelRatio(dpr);
    renderer.setSize(safeWidth, safeHeight, false);
    camera.aspect = safeWidth / safeHeight;
    camera.updateProjectionMatrix();
  }
}

const resizeObserver = new ResizeObserver(resizeRenderer);
resizeObserver.observe(threeStage);
resizeRenderer();

function animateThreeRobot(now) {
  const delta = Math.min((now - lastThreeFrame) / 1000, 0.05);
  lastThreeFrame = now;
  resizeRenderer();

  if (modelReady) {
    const radians = THREE.MathUtils.degToRad(settings.range);
    const targetX = settings.paused ? 0 : threeState.targetX;
    const targetY = settings.paused ? 0 : threeState.targetY;
    const speed = settings.paused ? 18 : settings.damping;

    upperBodyPivot.rotation.y = damp(
      upperBodyPivot.rotation.y,
      initialUpperRotation.y + targetX * radians * 0.34,
      speed * 0.7,
      delta,
    );
    upperBodyPivot.rotation.x = damp(
      upperBodyPivot.rotation.x,
      initialUpperRotation.x - targetY * radians * 0.14,
      speed * 0.7,
      delta,
    );
    headPivot.rotation.y = damp(
      headPivot.rotation.y,
      initialHeadRotation.y + targetX * radians,
      speed,
      delta,
    );
    headPivot.rotation.x = damp(
      headPivot.rotation.x,
      initialHeadRotation.x - targetY * radians * 0.58,
      speed,
      delta,
    );

    robotRoot.position.y = settings.paused ? 0 : Math.sin(now * 0.0015) * 0.012;
  }

  ring.material.opacity = settings.paused ? 0.2 : 0.2 + Math.sin(now * 0.002) * 0.05;
  renderer.render(scene, camera);
  requestAnimationFrame(animateThreeRobot);
}

requestAnimationFrame(animateThreeRobot);

const pointCanvas = document.querySelector("#pointCloudCanvas");
const pointRenderer = new THREE.WebGLRenderer({
  canvas: pointCanvas,
  alpha: true,
  antialias: false,
  powerPreference: "high-performance",
});
pointRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
pointRenderer.outputColorSpace = THREE.SRGBColorSpace;

const pointScene = new THREE.Scene();
pointScene.fog = new THREE.FogExp2(0x080a09, 0.095);

const pointCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
pointCamera.position.set(0, 0.05, 5.35);
pointCamera.lookAt(0, -0.12, 0);

const pointHeadGroup = new THREE.Group();
pointHeadGroup.position.y = 0.18;
pointScene.add(pointHeadGroup);

let randomSeed = 91733;
const seededRandom = () => {
  randomSeed = (randomSeed * 16807) % 2147483647;
  return (randomSeed - 1) / 2147483646;
};

function gaussian(value, center, width) {
  const normalized = (value - center) / width;
  return Math.exp(-(normalized * normalized));
}

function createPointHeadGeometry() {
  const skullCount = 11000;
  const earCount = 1000;
  const neckCount = 2000;
  const total = skullCount + earCount + neckCount;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const phases = new Float32Array(total);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  const writePoint = (index, x, y, z, region = "face") => {
    const positionOffset = index * 3;
    positions[positionOffset] = x;
    positions[positionOffset + 1] = y;
    positions[positionOffset + 2] = z;

    const silhouette = clamp(Math.abs(x) / 0.9, 0, 1);
    const front = clamp((z + 0.75) / 1.55, 0, 1);
    const eyeBand = gaussian(Math.abs(x), 0.285, 0.105) * gaussian(y, 0.23, 0.105) * front;
    const mouthBand = gaussian(x, 0, 0.3) * gaussian(y, -0.45, 0.055) * front;
    const accentMix = clamp(eyeBand * 1.4 + mouthBand * 0.5 + silhouette * 0.18, 0, 1);
    const orangeMix = clamp((x + 0.9) / 1.8, 0, 1) * (region === "neck" ? 0.28 : 0.14);

    colors[positionOffset] = 0.48 + front * 0.26 + orangeMix * 0.42;
    colors[positionOffset + 1] = 0.64 + front * 0.23 + accentMix * 0.3 - orangeMix * 0.4;
    colors[positionOffset + 2] = 0.5 + front * 0.25 - accentMix * 0.3 - orangeMix * 0.35;
    sizes[index] = 0.72 + seededRandom() * 1.12 + eyeBand * 1.25;
    phases[index] = seededRandom() * Math.PI * 2;
  };

  for (let index = 0; index < skullCount; index += 1) {
    const normalizedY = 1 - (2 * (index + 0.5)) / skullCount;
    const radius = Math.sqrt(Math.max(0, 1 - normalizedY * normalizedY));
    const angle = goldenAngle * index;
    let x = Math.cos(angle) * radius * 0.84;
    let y = normalizedY * 1.16;
    let z = Math.sin(angle) * radius * 0.76;

    const lowerFace = clamp((-y - 0.08) / 1.05, 0, 1);
    x *= 1 - lowerFace * 0.32;
    y -= Math.pow(lowerFace, 2) * 0.1;

    const front = clamp((z + 0.04) / 0.8, 0, 1);
    const nose = gaussian(x, 0, 0.12) * gaussian(y, 0.03, 0.32) * front;
    const eyeSockets = gaussian(Math.abs(x), 0.285, 0.12) * gaussian(y, 0.23, 0.13) * front;
    const cheekbones = gaussian(Math.abs(x), 0.43, 0.2) * gaussian(y, -0.02, 0.24) * front;
    const philtrum = gaussian(x, 0, 0.09) * gaussian(y, -0.31, 0.12) * front;
    const mouth = gaussian(x, 0, 0.34) * gaussian(y, -0.46, 0.045) * front;
    const chin = gaussian(x, 0, 0.25) * gaussian(y, -0.78, 0.22) * front;
    z += nose * 0.34 - eyeSockets * 0.12 + cheekbones * 0.075 - philtrum * 0.035 - mouth * 0.045 + chin * 0.055;

    const surfaceNoise = (seededRandom() - 0.5) * 0.012;
    writePoint(index, x + surfaceNoise, y + surfaceNoise * 0.5, z + surfaceNoise, "face");
  }

  for (let index = 0; index < earCount; index += 1) {
    const localIndex = index + skullCount;
    const side = index % 2 === 0 ? -1 : 1;
    const angle = seededRandom() * Math.PI * 2;
    const ring = 0.64 + seededRandom() * 0.36;
    const x = side * (0.82 + Math.cos(angle) * 0.085 * ring);
    const y = 0.02 + Math.sin(angle) * 0.35 * ring;
    const z = 0.015 + Math.cos(angle) * 0.14 * ring;
    writePoint(localIndex, x, y, z, "ear");
  }

  for (let index = 0; index < neckCount; index += 1) {
    const localIndex = index + skullCount + earCount;
    const t = index / neckCount;
    const angle = goldenAngle * index;
    const y = -1.14 - t * 0.78;
    const radius = 0.36 + t * 0.09 + Math.sin(t * Math.PI) * 0.06;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * 0.83 - 0.06;
    writePoint(localIndex, x, y, z, "neck");
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

const pointHeadMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    uTime: { value: 0 },
  },
  vertexShader: `
    attribute float aSize;
    attribute float aPhase;
    uniform float uPixelRatio;
    uniform float uTime;
    varying vec3 vColor;
    varying float vPulse;

    void main() {
      vColor = color;
      vPulse = 0.84 + sin(uTime * 1.6 + aPhase) * 0.16;
      vec4 modelPosition = modelMatrix * vec4(position, 1.0);
      vec4 viewPosition = viewMatrix * modelPosition;
      gl_Position = projectionMatrix * viewPosition;
      gl_PointSize = aSize * uPixelRatio * (10.0 / max(1.0, -viewPosition.z));
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    varying float vPulse;

    void main() {
      float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
      float dot = 1.0 - smoothstep(0.16, 0.5, distanceToCenter);
      float glow = 1.0 - smoothstep(0.0, 0.5, distanceToCenter);
      float alpha = (dot * 0.78 + glow * 0.22) * vPulse;
      if (alpha < 0.03) discard;
      gl_FragColor = vec4(vColor * (1.15 + glow * 0.45), alpha);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexColors: true,
});

const pointHead = new THREE.Points(createPointHeadGeometry(), pointHeadMaterial);
pointHead.rotation.y = -0.08;
pointHeadGroup.add(pointHead);

const haloMaterial = new THREE.LineBasicMaterial({ color: 0xd8ff55, transparent: true, opacity: 0.13 });
for (const [radiusX, radiusY, rotationX, rotationY] of [
  [1.42, 1.7, 0.12, 0.18],
  [1.58, 1.46, Math.PI / 2.15, -0.25],
]) {
  const curve = new THREE.EllipseCurve(0, 0, radiusX, radiusY, 0, Math.PI * 2, false, 0);
  const points = curve.getPoints(128).map(({ x, y }) => new THREE.Vector3(x, y - 0.16, 0));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const halo = new THREE.LineLoop(geometry, haloMaterial.clone());
  halo.rotation.x = rotationX;
  halo.rotation.y = rotationY;
  pointHeadGroup.add(halo);
}

function resizePointRenderer() {
  const { width, height } = pointStage.getBoundingClientRect();
  const safeWidth = Math.max(1, Math.floor(width));
  const safeHeight = Math.max(1, Math.floor(height));
  const dpr = Math.min(window.devicePixelRatio, 2);
  const targetWidth = Math.floor(safeWidth * dpr);
  const targetHeight = Math.floor(safeHeight * dpr);

  if (pointCanvas.width !== targetWidth || pointCanvas.height !== targetHeight) {
    pointRenderer.setPixelRatio(dpr);
    pointRenderer.setSize(safeWidth, safeHeight, false);
    pointCamera.aspect = safeWidth / safeHeight;
    pointCamera.updateProjectionMatrix();
    pointHeadMaterial.uniforms.uPixelRatio.value = dpr;
  }
}

const pointResizeObserver = new ResizeObserver(resizePointRenderer);
pointResizeObserver.observe(pointStage);
resizePointRenderer();

let lastPointFrame = performance.now();

function animatePointHead(now) {
  const delta = Math.min((now - lastPointFrame) / 1000, 0.05);
  lastPointFrame = now;
  resizePointRenderer();

  const radians = THREE.MathUtils.degToRad(settings.range);
  const targetX = settings.paused ? 0 : pointState.targetX;
  const targetY = settings.paused ? 0 : pointState.targetY;
  const speed = settings.paused ? 18 : settings.damping * 0.82;

  pointHeadGroup.rotation.y = damp(pointHeadGroup.rotation.y, targetX * radians * 1.14, speed, delta);
  pointHeadGroup.rotation.x = damp(pointHeadGroup.rotation.x, -targetY * radians * 0.7, speed, delta);
  pointHeadGroup.rotation.z = settings.paused ? 0 : Math.sin(now * 0.00055) * 0.018;
  pointHeadGroup.position.y = settings.paused ? 0.18 : 0.18 + Math.sin(now * 0.0011) * 0.075;
  pointCamera.position.x = damp(pointCamera.position.x, targetX * 0.16, speed * 0.6, delta);
  pointCamera.position.y = damp(pointCamera.position.y, 0.05 - targetY * 0.08, speed * 0.6, delta);
  pointCamera.lookAt(0, -0.12, 0);
  pointHeadMaterial.uniforms.uTime.value = settings.paused ? 0 : now * 0.001;
  pointHeadGroup.children.slice(1).forEach((halo, index) => {
    halo.rotation.z += settings.paused ? 0 : delta * (index === 0 ? 0.055 : -0.04);
  });

  pointRenderer.render(pointScene, pointCamera);
  requestAnimationFrame(animatePointHead);
}

requestAnimationFrame(animatePointHead);

document.querySelectorAll("[data-reset]").forEach((button) => {
  button.addEventListener("click", () => {
    const stage = button.dataset.reset === "dom" ? domStage : button.dataset.reset === "three" ? threeStage : pointStage;
    resetPointerState(stage);
  });
});

const rangeControl = document.querySelector("#rangeControl");
const dampingControl = document.querySelector("#dampingControl");
const rangeOutput = document.querySelector("#rangeOutput");
const dampingOutput = document.querySelector("#dampingOutput");

rangeControl.addEventListener("input", () => {
  settings.range = Number(rangeControl.value);
  rangeOutput.value = `${settings.range}°`;
});

dampingControl.addEventListener("input", () => {
  settings.damping = Number(dampingControl.value);
  dampingOutput.value = (settings.damping / 100).toFixed(2);
});

const motionToggle = document.querySelector("#motionToggle");
const motionToggleLabel = motionToggle.querySelector(".motion-toggle__label");

function syncMotionToggle() {
  motionToggle.setAttribute("aria-pressed", String(settings.paused));
  motionToggleLabel.textContent = settings.paused ? "Resume motion" : "Pause motion";
  if (settings.paused) {
    resetPointerState(domStage);
    resetPointerState(threeStage);
    resetPointerState(pointStage);
  }
}

motionToggle.addEventListener("click", () => {
  settings.paused = !settings.paused;
  syncMotionToggle();
});

syncMotionToggle();
