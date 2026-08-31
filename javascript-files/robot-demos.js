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
const domState = createPointerState(domStage);
const threeState = createPointerState(threeStage);

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
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0b0b, 0.075);

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
camera.position.set(0, 2.3, 8.4);
camera.lookAt(0, 1.85, 0);

const hemiLight = new THREE.HemisphereLight(0xdde7ff, 0x090a0a, 1.7);
scene.add(hemiLight);

const keyLight = new THREE.SpotLight(0xffffff, 75, 20, Math.PI / 5, 0.5, 1.2);
keyLight.position.set(-3.8, 6.2, 5.5);
keyLight.target.position.set(0, 1.7, 0);
scene.add(keyLight, keyLight.target);

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
      robotRoot.scale.setScalar(1.08);
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
        object.castShadow = false;
        object.receiveShadow = false;
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

document.querySelectorAll("[data-reset]").forEach((button) => {
  button.addEventListener("click", () => {
    const stage = button.dataset.reset === "dom" ? domStage : threeStage;
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
  }
}

motionToggle.addEventListener("click", () => {
  settings.paused = !settings.paused;
  syncMotionToggle();
});

syncMotionToggle();
