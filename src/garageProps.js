import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Fit so the longest axis equals `longest` (safe for thin tools). */
function fitLongest(root, longest) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  root.scale.multiplyScalar(longest / Math.max(size.x, size.y, size.z, 1e-3));
  root.updateMatrixWorld(true);
}

/** Floor props: target height, clamp footprint. */
function fitFloor(root, { height, maxXZ = Infinity }) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  let s = height / Math.max(size.y, 1e-3);
  const xz = Math.max(size.x, size.z) * s;
  if (xz > maxXZ) s *= maxXZ / xz;
  const longest = Math.max(size.x, size.y, size.z) * s;
  const cap = Math.max(height * 1.4, maxXZ === Infinity ? height * 1.4 : maxXZ * 1.6);
  if (longest > cap) s *= cap / longest;
  root.scale.multiplyScalar(s);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
}

function placeOnFloor(root, x, z, rotY = 0) {
  root.position.x = x;
  root.position.z = z;
  root.rotation.y = rotY;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  root.position.y -= box.min.y;
}

function enableShadows(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

/** Brighten dark GLB materials so tools read against the pegboard. */
function liftMaterials(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m?.color) continue;
      m.color.offsetHSL(0, 0.05, 0.22);
      if ("metalness" in m) m.metalness = Math.min(0.85, (m.metalness ?? 0.3) + 0.15);
      if ("roughness" in m) m.roughness = Math.max(0.25, (m.roughness ?? 0.6) - 0.1);
      if ("emissive" in m) {
        m.emissive = m.emissive || new THREE.Color(0x000000);
        m.emissive.setRGB(0.08, 0.09, 0.1);
        m.emissiveIntensity = 0.35;
      }
    }
  });
}

/**
 * Pegboard panels flanking the screen — light board + hole grid + frame.
 */
function addPegboards(group) {
  const boardMat = new THREE.MeshStandardMaterial({
    color: 0xc4b49a,
    roughness: 0.78,
    metalness: 0.08,
    emissive: 0x3a3428,
    emissiveIntensity: 0.22,
  });
  const holeMat = new THREE.MeshStandardMaterial({
    color: 0x2a241c,
    roughness: 0.9,
    metalness: 0.05,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x6a7488,
    roughness: 0.45,
    metalness: 0.55,
    emissive: 0x1a2030,
    emissiveIntensity: 0.2,
  });
  const railMat = new THREE.MeshStandardMaterial({
    color: 0x8a94a8,
    roughness: 0.4,
    metalness: 0.6,
  });

  const boardW = 2.35;
  const boardH = 2.55;
  const boardZ = -1.88;
  const boardY = 2.35;

  for (const side of [-1, 1]) {
    const cx = side * 4.55;
    const panel = new THREE.Group();
    panel.position.set(cx, boardY, boardZ);

    const board = new THREE.Mesh(new THREE.BoxGeometry(boardW, boardH, 0.08), boardMat);
    board.castShadow = true;
    board.receiveShadow = true;
    panel.add(board);

    // Peg holes
    const holeGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.04, 8);
    holeGeo.rotateX(Math.PI * 0.5);
    const cols = 7;
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hx = (c - (cols - 1) * 0.5) * 0.28;
        const hy = (r - (rows - 1) * 0.5) * 0.28;
        const hole = new THREE.Mesh(holeGeo, holeMat);
        hole.position.set(hx, hy, 0.05);
        panel.add(hole);
      }
    }

    // Metal frame
    const t = 0.06;
    const parts = [
      [boardW + t * 2, t, 0, boardH * 0.5 + t * 0.5],
      [boardW + t * 2, t, 0, -(boardH * 0.5 + t * 0.5)],
      [t, boardH + t * 2, boardW * 0.5 + t * 0.5, 0],
      [t, boardH + t * 2, -(boardW * 0.5 + t * 0.5), 0],
    ];
    for (const [w, h, ox, oy] of parts) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), frameMat);
      f.position.set(ox, oy, 0.02);
      panel.add(f);
    }

    // Bottom tool rail
    const rail = new THREE.Mesh(new THREE.BoxGeometry(boardW * 0.92, 0.05, 0.1), railMat);
    rail.position.set(0, -boardH * 0.42, 0.1);
    panel.add(rail);

    // Soft fill so board + tools stay readable
    const lamp = new THREE.PointLight(0xffe8c8, 1.6, 5.5, 2);
    lamp.position.set(0, 0.2, 0.9);
    panel.add(lamp);

    group.add(panel);
  }
}

/**
 * Garage dressing: pegboards + benches flanking the screen + wall tools.
 */
export function loadGarageProps(parent) {
  const loader = new GLTFLoader();
  const group = new THREE.Group();
  parent.add(group);

  addPegboards(group);

  // Tools sit just in front of pegboards (centers ±4.55)
  const jobs = [
    {
      url: "/models/table_small.glb",
      height: 0.78,
      maxXZ: 1.1,
      floor: [-3.35, 0.45],
      rotY: 0.06,
    },
    {
      url: "/models/table_small.glb",
      height: 0.78,
      maxXZ: 1.1,
      floor: [3.35, 0.5],
      rotY: -0.08,
    },
    {
      url: "/models/bucket.glb",
      height: 0.36,
      maxXZ: 0.4,
      floor: [-3.0, 1.15],
      rotY: 0.35,
    },
    {
      url: "/models/broom.glb",
      height: 1.05,
      maxXZ: 0.28,
      floor: [3.85, 0.95],
      rotY: 0.1,
    },
    // Left pegboard tools
    {
      url: "/models/spanner.glb",
      longest: 0.42,
      wall: [-4.2, 2.55, -1.78],
      rot: [Math.PI * 0.5, 0, -0.25],
    },
    {
      url: "/models/pliers.glb",
      longest: 0.34,
      wall: [-4.75, 1.85, -1.78],
      rot: [Math.PI * 0.5, 0, 0.45],
    },
    {
      url: "/models/hacksaw.glb",
      longest: 0.48,
      wall: [-5.15, 3.0, -1.78],
      rot: [Math.PI * 0.5, 0, 0.08],
    },
    {
      url: "/models/hammer.glb",
      longest: 0.4,
      wall: [-3.95, 3.15, -1.78],
      rot: [Math.PI * 0.5, 0, -0.12],
    },
    {
      url: "/models/screwdriver.glb",
      longest: 0.36,
      wall: [-5.25, 2.2, -1.78],
      rot: [Math.PI * 0.5, 0, 0.18],
    },
    // Right pegboard tools
    {
      url: "/models/clamp.glb",
      longest: 0.4,
      wall: [4.15, 2.45, -1.78],
      rot: [Math.PI * 0.5, 0, 0.22],
    },
    {
      url: "/models/screwdriver.glb",
      longest: 0.36,
      wall: [4.7, 1.9, -1.78],
      rot: [Math.PI * 0.5, 0, -0.35],
    },
    {
      url: "/models/spanner.glb",
      longest: 0.4,
      wall: [5.05, 2.85, -1.78],
      rot: [Math.PI * 0.5, 0, 0.55],
    },
    {
      url: "/models/hacksaw.glb",
      longest: 0.46,
      wall: [3.95, 1.7, -1.78],
      rot: [Math.PI * 0.5, 0, 0.15],
    },
    // Bench-top tools
    {
      url: "/models/pliers.glb",
      longest: 0.16,
      wall: [-3.25, 0.82, 0.3],
      rot: [0, 0.55, 1.15],
    },
    {
      url: "/models/screwdriver.glb",
      longest: 0.18,
      wall: [-3.5, 0.82, 0.55],
      rot: [0, -0.3, 1.35],
    },
  ];

  for (const job of jobs) {
    loader.load(
      job.url,
      (gltf) => {
        const model = gltf.scene;
        enableShadows(model);
        if (job.longest != null) {
          fitLongest(model, job.longest);
          liftMaterials(model);
        } else {
          fitFloor(model, { height: job.height, maxXZ: job.maxXZ ?? Infinity });
        }
        if (job.floor) {
          placeOnFloor(model, job.floor[0], job.floor[1], job.rotY || 0);
        } else if (job.wall) {
          model.position.set(job.wall[0], job.wall[1], job.wall[2]);
          if (job.rot) model.rotation.set(job.rot[0], job.rot[1], job.rot[2]);
        }
        group.add(model);
      },
      undefined,
      (err) => console.warn("garage prop failed", job.url, err),
    );
  }

  return group;
}
