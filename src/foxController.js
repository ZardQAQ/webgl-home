import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Controllable CC0 Fox (Khronos Sample Models).
 * Locked until the user presses W/A/S/D once; then WASD move + drag orbit.
 */
export function createFoxController(parent, camera, {
  start = new THREE.Vector3(0, 0, 7),
  bounds = { minX: -9, maxX: 9, minZ: 1.2, maxZ: 12 },
} = {}) {
  const pivot = new THREE.Group();
  pivot.position.copy(start);
  parent.add(pivot);

  const mixerHolder = { mixer: null, actions: {}, current: null };
  const keys = new Set();
  const camTarget = new THREE.Vector3();
  const look = new THREE.Vector3();

  let unlocked = false;
  let yaw = 0.35;
  let pitch = 0.28;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let ready = false;

  const orbitDistance = 7.2;
  const moveSpeed = 4.2;
  const tmp = new THREE.Vector3();
  const unlockKeys = new Set(["w", "a", "s", "d"]);

  const loader = new GLTFLoader();
  loader.load("/models/fox.glb", (gltf) => {
    const fox = gltf.scene;
    fox.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    fox.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(fox);
    const size = box.getSize(new THREE.Vector3());
    const s = 0.85 / Math.max(size.y, 1e-3);
    fox.scale.setScalar(s);
    fox.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(fox);
    fox.position.y = -box2.min.y;
    pivot.add(fox);

    if (gltf.animations?.length) {
      mixerHolder.mixer = new THREE.AnimationMixer(fox);
      for (const clip of gltf.animations) {
        const name = clip.name.toLowerCase();
        const action = mixerHolder.mixer.clipAction(clip);
        if (name.includes("walk")) mixerHolder.actions.walk = action;
        else if (name.includes("run")) mixerHolder.actions.run = action;
        else if (name.includes("survey") || name.includes("idle")) mixerHolder.actions.idle = action;
        else mixerHolder.actions[clip.name] = action;
      }
      if (!mixerHolder.actions.idle) {
        mixerHolder.actions.idle = mixerHolder.mixer.clipAction(gltf.animations[0]);
      }
      if (!mixerHolder.actions.walk) {
        mixerHolder.actions.walk =
          mixerHolder.actions.run ||
          mixerHolder.mixer.clipAction(gltf.animations[Math.min(1, gltf.animations.length - 1)]);
      }
      play("idle");
    }
    ready = true;
  });

  function play(name) {
    const next = mixerHolder.actions[name];
    if (!next || mixerHolder.current === next) return;
    if (mixerHolder.current) mixerHolder.current.fadeOut(0.2);
    next.reset().fadeIn(0.2).play();
    mixerHolder.current = next;
  }

  function onKey(e, down) {
    const k = e.key.toLowerCase();
    if (unlockKeys.has(k) && down) {
      unlocked = true;
    }
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
      e.preventDefault();
      if (!unlocked) return;
      if (down) keys.add(k);
      else keys.delete(k);
    }
  }

  window.addEventListener("keydown", (e) => onKey(e, true));
  window.addEventListener("keyup", (e) => onKey(e, false));

  window.addEventListener("pointerdown", (e) => {
    if (!unlocked) return;
    if (e.target.closest?.("a,button,input")) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener("pointerup", () => {
    dragging = false;
  });
  window.addEventListener("pointercancel", () => {
    dragging = false;
  });
  window.addEventListener(
    "pointermove",
    (e) => {
      if (!unlocked || !dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      yaw -= dx * 0.005;
      pitch += dy * 0.0035;
      pitch = Math.max(0.08, Math.min(1.15, pitch));
    },
    { passive: true },
  );

  function update(dt) {
    if (!ready) return;

    // Idle anim always; movement only after unlock
    if (!unlocked) {
      play("idle");
      if (mixerHolder.mixer) mixerHolder.mixer.update(dt);
      return false;
    }

    let forward = 0;
    let strafe = 0;
    if (keys.has("w") || keys.has("arrowup")) forward += 1;
    if (keys.has("s") || keys.has("arrowdown")) forward -= 1;
    if (keys.has("a") || keys.has("arrowleft")) strafe -= 1;
    if (keys.has("d") || keys.has("arrowright")) strafe += 1;

    const moving = forward !== 0 || strafe !== 0;
    if (moving) {
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      tmp.set(strafe * cos + forward * sin, 0, -forward * cos + strafe * sin);
      if (tmp.lengthSq() > 0) {
        tmp.normalize().multiplyScalar(moveSpeed * dt);
        pivot.position.add(tmp);
        look.copy(tmp).normalize();
        pivot.rotation.y = Math.atan2(look.x, look.z);
      }
      play("walk");
    } else {
      play("idle");
    }

    pivot.position.x = THREE.MathUtils.clamp(pivot.position.x, bounds.minX, bounds.maxX);
    pivot.position.z = THREE.MathUtils.clamp(pivot.position.z, bounds.minZ, bounds.maxZ);

    if (mixerHolder.mixer) mixerHolder.mixer.update(dt);

    const ox = Math.sin(yaw) * Math.cos(pitch) * orbitDistance;
    const oy = Math.sin(pitch) * orbitDistance + 1.1;
    const oz = Math.cos(yaw) * Math.cos(pitch) * orbitDistance;
    camTarget.set(
      pivot.position.x + ox,
      pivot.position.y + oy,
      pivot.position.z + oz,
    );
    camera.position.lerp(camTarget, 1 - Math.exp(-dt * 8));
    look.set(pivot.position.x, pivot.position.y + 0.55, pivot.position.z);
    camera.lookAt(look);
    return true;
  }

  return {
    pivot,
    update,
    get unlocked() {
      return unlocked;
    },
    get position() {
      return pivot.position;
    },
  };
}
