import * as THREE from "three";

/**
 * Warehouse bay: tighter side walls + back wall with screen bay.
 */
export function createStage({ screenPos, screenSize, wallMat, accentMat, metalMat }) {
  const group = new THREE.Group();
  const cx = screenPos.x;
  const cy = screenPos.y;
  const backZ = screenPos.z - 0.7;
  // Narrower bay — less empty wall beside the screen
  const hallW = 13.2;
  const hallD = 16;
  const hallH = 10;
  const hole = screenSize * 0.52;

  // Back wall
  const back = new THREE.Mesh(new THREE.BoxGeometry(hallW, hallH, 0.45), wallMat);
  back.position.set(cx, hallH * 0.45, backZ);
  back.receiveShadow = true;
  back.castShadow = true;
  group.add(back);

  // Horizontal warehouse cladding on back (skip screen hole + pegboard zones)
  for (let row = 0; row < 16; row++) {
    const y = 0.4 + row * 0.55;
    if (Math.abs(y - cy) < hole + 0.35) continue;
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(hallW - 0.6, 0.22, 0.18),
      row % 3 === 0 ? accentMat : wallMat,
    );
    plank.position.set(cx, y, backZ + 0.28);
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
  }

  // Side walls (full depth)
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.35, hallH, hallD), wallMat);
    wall.position.set(cx + side * (hallW * 0.5 - 0.15), hallH * 0.45, backZ + hallD * 0.45);
    wall.receiveShadow = true;
    wall.castShadow = true;
    group.add(wall);

    for (let i = 0; i < 12; i++) {
      const z = backZ + 1.0 + i * 1.15;
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, hallH - 0.8, 0.26),
        i % 2 === 0 ? accentMat : wallMat,
      );
      rib.position.set(cx + side * (hallW * 0.5 - 0.05), hallH * 0.45, z);
      rib.castShadow = true;
      rib.receiveShadow = true;
      group.add(rib);
    }

    const windows = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 1.4, hallD * 0.65),
      new THREE.MeshStandardMaterial({
        color: 0x6a8aaa,
        roughness: 0.35,
        metalness: 0.2,
        emissive: 0x243848,
        emissiveIntensity: 0.45,
      }),
    );
    windows.position.set(cx + side * (hallW * 0.5 - 0.1), 6.6, backZ + hallD * 0.45);
    group.add(windows);
  }

  // Screen bezel
  const frameT = 0.2;
  const outer = screenSize + 0.7;
  const frameParts = [
    [outer, frameT, 0, hole + frameT * 0.55],
    [outer, frameT, 0, -(hole + frameT * 0.55)],
    [frameT, outer, hole + frameT * 0.55, 0],
    [frameT, outer, -(hole + frameT * 0.55), 0],
  ];
  for (const [w, h, ox, oy] of frameParts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.35), metalMat || accentMat);
    m.position.set(cx + ox, cy + oy, screenPos.z - 0.25);
    m.castShadow = true;
    group.add(m);
  }

  // Ceiling beams
  for (let i = 0; i < 5; i++) {
    const z = backZ + 1.8 + i * 2.4;
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(hallW - 0.8, 0.32, 0.4),
      metalMat || accentMat,
    );
    beam.position.set(cx, hallH - 0.85, z);
    beam.castShadow = true;
    group.add(beam);
  }

  // Concrete floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(hallW + 2, hallD + 4),
    new THREE.MeshStandardMaterial({
      color: 0x121820,
      roughness: 0.88,
      metalness: 0.06,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, backZ + hallD * 0.4);
  floor.receiveShadow = true;
  group.add(floor);

  // Painted aisle strip
  const aisle = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, hallD * 0.7),
    new THREE.MeshStandardMaterial({
      color: 0x2a3548,
      roughness: 0.7,
      metalness: 0.05,
    }),
  );
  aisle.rotation.x = -Math.PI / 2;
  aisle.position.set(cx, 0.015, backZ + hallD * 0.4);
  aisle.receiveShadow = true;
  group.add(aisle);

  return { group, hallW, hallD, hallH, backZ };
}
