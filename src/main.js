import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { createScreenFbo } from "./screenFbo.js";
import { createStage } from "./stage.js";
import { loadGarageProps } from "./garageProps.js";
import { createFoxController } from "./foxController.js";

RectAreaLightUniformsLib.init();

const canvas = document.querySelector("#webgl");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const SCREEN_RESOLUTION = 512;
const SCREEN_SEGMENTS = 300;
const SCREEN_SIZE = 5.2;
const SCREEN_POS = new THREE.Vector3(0, 3.2, -1.6);
const BG = 0x060a12;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setClearColor(BG, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.FogExp2(BG, 0.014);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
camera.position.set(0, 4, 12);

const root = new THREE.Group();
scene.add(root);

scene.add(new THREE.AmbientLight(0x8aa4c4, 0.42));

const fill = new THREE.DirectionalLight(0x9ec0e8, 0.55);
fill.position.set(-7, 8, 5);
scene.add(fill);

const key = new THREE.DirectionalLight(0xd8e6ff, 0.4);
key.position.set(5, 10, 6);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.bias = -0.0002;
scene.add(key);

const floodL = new THREE.PointLight(0xb8d0f0, 4.5, 28, 2);
floodL.position.set(-6, 8.5, 4);
root.add(floodL);
const floodR = new THREE.PointLight(0xb8d0f0, 4.5, 28, 2);
floodR.position.set(6, 8.5, 4);
root.add(floodR);
const floodC = new THREE.PointLight(0xc8daf0, 3.2, 24, 2);
floodC.position.set(0, 9, 2);
root.add(floodC);

const wallMat = new THREE.MeshStandardMaterial({
  color: 0x2a3548,
  roughness: 0.82,
  metalness: 0.12,
  emissive: 0x101820,
  emissiveIntensity: 0.35,
});
const accentMat = new THREE.MeshStandardMaterial({
  color: 0x3a4a62,
  roughness: 0.65,
  metalness: 0.22,
  emissive: 0x121c28,
  emissiveIntensity: 0.28,
});
const metalMat = new THREE.MeshStandardMaterial({
  color: 0x6a7a90,
  roughness: 0.4,
  metalness: 0.65,
  emissive: 0x1a2430,
  emissiveIntensity: 0.2,
});

const stage = createStage({
  screenPos: SCREEN_POS,
  screenSize: SCREEN_SIZE,
  wallMat,
  accentMat,
  metalMat,
});
root.add(stage.group);

loadGarageProps(root);

const fox = createFoxController(root, camera, {
  start: new THREE.Vector3(0, 0, 7.5),
  bounds: { minX: -5.2, maxX: 5.2, minZ: 1.5, maxZ: 11 },
});

const area = new THREE.RectAreaLight(0xd8e8ff, 16, SCREEN_SIZE, SCREEN_SIZE);
area.position.copy(SCREEN_POS);
area.lookAt(SCREEN_POS.x, SCREEN_POS.y, 6);
root.add(area);

const screenGlow = new THREE.PointLight(0xc8dcff, 5.5, 32, 2);
screenGlow.position.set(SCREEN_POS.x, SCREEN_POS.y, SCREEN_POS.z + 0.5);
root.add(screenGlow);

const SCREEN_PALETTES = [
  {
    id: "ice",
    label: "冰白",
    colorA: "#c7dbff",
    colorB: "#f2f7ff",
    colorC: "#b3d0ff",
    tint: "#ebf2ff",
    light: 0xd8e8ff,
  },
  {
    id: "amber",
    label: "琥珀",
    colorA: "#ffb56a",
    colorB: "#ffe2b0",
    colorC: "#ff9a4a",
    tint: "#ffd9a8",
    light: 0xffc078,
  },
  {
    id: "mint",
    label: "薄荷绿",
    colorA: "#7dffc8",
    colorB: "#d8fff0",
    colorC: "#4ef0b0",
    tint: "#c8ffe8",
    light: 0x8ef0c8,
  },
  {
    id: "violet",
    label: "紫罗兰",
    colorA: "#b48cff",
    colorB: "#e8d8ff",
    colorC: "#9160ff",
    tint: "#dcc8ff",
    light: 0xb898ff,
  },
  {
    id: "rose",
    label: "玫红",
    colorA: "#ff7aa8",
    colorB: "#ffd0e0",
    colorC: "#ff5a8c",
    tint: "#ffc0d4",
    light: 0xff8eb0,
  },
  {
    id: "ember",
    label: "赤焰",
    colorA: "#ff6a4a",
    colorB: "#ffc4a0",
    colorC: "#ff4020",
    tint: "#ffb090",
    light: 0xff7a58,
  },
];

const screenFbo = createScreenFbo(renderer, SCREEN_RESOLUTION);

function applyScreenPalette(palette) {
  screenFbo.setPalette(palette);
  area.color.set(palette.light);
  screenGlow.color.set(palette.light);
}

const DEFAULT_PALETTE =
  SCREEN_PALETTES.find((p) => p.id === "violet") || SCREEN_PALETTES[0];
applyScreenPalette(DEFAULT_PALETTE);

const paletteRoot = document.querySelector("[data-screen-palettes]");
if (paletteRoot) {
  for (const palette of SCREEN_PALETTES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "palette-swatch";
    btn.dataset.id = palette.id;
    btn.title = palette.label;
    btn.setAttribute("aria-label", `屏幕颜色：${palette.label}`);
    btn.style.setProperty("--swatch", palette.colorB);
    btn.style.setProperty("--swatch-edge", palette.colorA);
    if (palette.id === DEFAULT_PALETTE.id) btn.classList.add("is-active");
    btn.addEventListener("click", () => {
      applyScreenPalette(palette);
      paletteRoot
        .querySelectorAll(".palette-swatch")
        .forEach((el) => el.classList.toggle("is-active", el === btn));
    });
    paletteRoot.appendChild(btn);
  }
}
const screenUniforms = {
  u_screenTexture: { value: screenFbo.texture },
  u_screenTextureSize: {
    value: new THREE.Vector2(SCREEN_RESOLUTION, SCREEN_RESOLUTION),
  },
};

const pointer01 = new THREE.Vector2(0.5, 0.5);

const backPlate = new THREE.Mesh(
  new THREE.PlaneGeometry(SCREEN_SIZE + 0.7, SCREEN_SIZE + 0.7),
  new THREE.MeshBasicMaterial({ color: 0x05080e }),
);
backPlate.position.set(SCREEN_POS.x, SCREEN_POS.y, SCREEN_POS.z - 0.32);
root.add(backPlate);

const underlay = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.ShaderMaterial({
    uniforms: screenUniforms,
    toneMapped: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D u_screenTexture;
      varying vec2 vUv;
      void main() {
        gl_FragColor = vec4(texture2D(u_screenTexture, vUv).rgb, 1.0);
      }
    `,
  }),
);
underlay.scale.set(SCREEN_SIZE, SCREEN_SIZE, 1);
underlay.position.set(SCREEN_POS.x, SCREEN_POS.y, SCREEN_POS.z - 0.05);
root.add(underlay);

const screenMat = new THREE.ShaderMaterial({
  uniforms: screenUniforms,
  toneMapped: false,
  vertexShader: /* glsl */ `
    uniform sampler2D u_screenTexture;
    uniform vec2 u_screenTextureSize;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec2 texel = 1.0 / u_screenTextureSize;
      vec2 uvC = clamp(uv, texel, vec2(1.0) - texel);
      float h = texture2D(u_screenTexture, uvC).a;
      float isEdge = step(0.997, max(max(uv.x, uv.y), max(1.0 - uv.x, 1.0 - uv.y)));
      vec3 pos = vec3(position.xy, h * 1.8);
      pos.z *= (1.0 - isEdge);
      pos.z -= 0.4;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D u_screenTexture;
    varying vec2 vUv;
    void main() {
      gl_FragColor = vec4(texture2D(u_screenTexture, vUv).rgb, 1.0);
    }
  `,
});

const screen = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1, SCREEN_SEGMENTS, SCREEN_SEGMENTS),
  screenMat,
);
screen.scale.set(SCREEN_SIZE, SCREEN_SIZE, 1);
screen.position.copy(SCREEN_POS);
root.add(screen);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.7, 0.72);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  composer.setPixelRatio(dpr);
  composer.setSize(width, height);
  bloom.setSize(width, height);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);
window.addEventListener(
  "pointermove",
  (event) => {
    const x = "touches" in event ? event.touches[0].clientX : event.clientX;
    const y = "touches" in event ? event.touches[0].clientY : event.clientY;
    pointer01.set(x / window.innerWidth, 1 - y / window.innerHeight);
  },
  { passive: true },
);
resize();

const clock = new THREE.Clock();
const camPos = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

function sampleIntroCamera(t, outPos, outLook) {
  const a = t * Math.PI * 2;
  outPos.set(
    -2.0 + Math.sin(a) * 2.4,
    3.0 + Math.sin(a * 1.2) * 0.25,
    14.8 + Math.cos(a) * 1.5,
  );
  outLook.set(0.15 + Math.sin(a) * 0.2, 2.7, SCREEN_POS.z + 1.8);
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  screenFbo.update(reduceMotion ? 0 : elapsed, pointer01);
  screenFbo.render();
  const controlling = fox.update(dt);

  area.intensity = 14 + Math.sin(elapsed * 0.35) * 1.5;
  screenGlow.intensity = 5.0 + Math.sin(elapsed * 0.35) * 0.4;
  floodL.intensity = 4.2 + Math.sin(elapsed * 0.2) * 0.3;
  floodR.intensity = 4.2 + Math.cos(elapsed * 0.2) * 0.3;

  // Intro orbit until first WASD unlocks fox control
  if (!controlling) {
    const t = reduceMotion ? 0.05 : elapsed * 0.008;
    sampleIntroCamera(t, camPos, lookTarget);
    camPos.x += (pointer01.x - 0.5) * 1.1;
    camPos.y += (pointer01.y - 0.5) * 0.4;
    camera.position.lerp(camPos, reduceMotion ? 1 : 0.05);
    camera.lookAt(lookTarget);
  }

  composer.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
