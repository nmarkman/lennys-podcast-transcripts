import * as THREE from 'three';

// ── Lounge dimensions ────────────────────────────────────────────────────────
const LOUNGE_WIDTH = 40;
const LOUNGE_DEPTH = 30;
const WALL_HEIGHT = 5;
const WALL_THICKNESS = 0.5;

// Lenny stands at the podcast desk near the back of the lounge
const LENNY_POSITION = new THREE.Vector3(0, 0, -10);

// Spawn points near furniture groupings where guests appear
const SPAWN_POINTS = [
  new THREE.Vector3(-8, 0, -3),
  new THREE.Vector3(-12, 0, 2),
  new THREE.Vector3(-6, 0, 5),
  new THREE.Vector3(8, 0, -3),
  new THREE.Vector3(12, 0, 2),
  new THREE.Vector3(6, 0, 5),
  new THREE.Vector3(-4, 0, 8),
  new THREE.Vector3(4, 0, 8),
  new THREE.Vector3(-10, 0, -7),
  new THREE.Vector3(10, 0, -7),
  new THREE.Vector3(0, 0, 3),
  new THREE.Vector3(-14, 0, -3),
];

export function buildWorld(scene) {
  const wallBoxes = [];

  // ── Floor ─────────────────────────────────────────────────────────────────
  // Warm wood-toned floor
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x5C3D2E,
    roughness: 0.85,
  });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(LOUNGE_WIDTH, LOUNGE_DEPTH),
    floorMat
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Carpet area rug in the center
  const rugMat = new THREE.MeshStandardMaterial({
    color: 0x8B4513,
    roughness: 0.95,
  });
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 18),
    rugMat
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.01;
  rug.receiveShadow = true;
  scene.add(rug);

  // ── Walls ─────────────────────────────────────────────────────────────────
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a5a,
    roughness: 0.6,
  });

  const walls = [
    // Back wall
    { w: LOUNGE_WIDTH, h: WALL_HEIGHT, d: WALL_THICKNESS, x: 0, y: WALL_HEIGHT / 2, z: -LOUNGE_DEPTH / 2 },
    // Front wall
    { w: LOUNGE_WIDTH, h: WALL_HEIGHT, d: WALL_THICKNESS, x: 0, y: WALL_HEIGHT / 2, z: LOUNGE_DEPTH / 2 },
    // Left wall
    { w: WALL_THICKNESS, h: WALL_HEIGHT, d: LOUNGE_DEPTH, x: -LOUNGE_WIDTH / 2, y: WALL_HEIGHT / 2, z: 0 },
    // Right wall
    { w: WALL_THICKNESS, h: WALL_HEIGHT, d: LOUNGE_DEPTH, x: LOUNGE_WIDTH / 2, y: WALL_HEIGHT / 2, z: 0 },
  ];

  for (const w of walls) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(w.w, w.h, w.d),
      wallMat
    );
    wall.position.set(w.x, w.y, w.z);
    wall.castShadow = true;
    wall.userData.isWall = true;
    scene.add(wall);
  }

  // ── Podcast stage (raised platform + desk) ────────────────────────────────
  const stageMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a4a,
    roughness: 0.5,
  });
  const stage = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.3, 6),
    stageMat
  );
  stage.position.set(0, 0.15, -11);
  stage.receiveShadow = true;
  scene.add(stage);

  // Podcast desk
  const deskMat = new THREE.MeshStandardMaterial({
    color: 0x4a3728,
    roughness: 0.4,
  });
  const deskTop = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 0.15, 1.5),
    deskMat
  );
  deskTop.position.set(0, 1.0, -11);
  deskTop.castShadow = true;
  scene.add(deskTop);

  // Desk legs
  for (const dx of [-1.5, 1.5]) {
    for (const dz of [-0.5, 0.5]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6),
        deskMat
      );
      leg.position.set(dx, 0.5, -11 + dz);
      scene.add(leg);
    }
  }

  // Backdrop accent wall behind stage
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x4A90D9,
    emissive: 0x4A90D9,
    emissiveIntensity: 0.15,
    roughness: 0.5,
  });
  const backdrop = new THREE.Mesh(
    new THREE.BoxGeometry(10, WALL_HEIGHT, 0.1),
    accentMat
  );
  backdrop.position.set(0, WALL_HEIGHT / 2, -LOUNGE_DEPTH / 2 + 0.3);
  scene.add(backdrop);

  // "Lenny's Podcast" sign above stage
  const signSprite = makeTextSprite("Lenny's Podcast", '#4A90D9', 1.0);
  signSprite.position.set(0, WALL_HEIGHT - 0.5, -LOUNGE_DEPTH / 2 + 0.8);
  scene.add(signSprite);

  // ── Couch groupings ───────────────────────────────────────────────────────
  const couchGroups = [
    { x: -10, z: 0, rotation: 0.3 },
    { x: 10, z: 0, rotation: -0.3 },
    { x: -6, z: 7, rotation: 0.8 },
    { x: 6, z: 7, rotation: -0.8 },
  ];

  const couchMat = new THREE.MeshStandardMaterial({
    color: 0x5a4a6a,
    roughness: 0.8,
  });
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x4a3728,
    roughness: 0.4,
  });

  for (const cg of couchGroups) {
    const group = new THREE.Group();
    group.position.set(cg.x, 0, cg.z);
    group.rotation.y = cg.rotation;

    // L-shaped couch (back + seat)
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.5, 1.0),
      couchMat
    );
    seat.position.set(0, 0.25, 0);
    seat.castShadow = true;
    group.add(seat);

    const back = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.6, 0.2),
      couchMat
    );
    back.position.set(0, 0.7, -0.5);
    back.castShadow = true;
    group.add(back);

    // Coffee table
    const tableTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.08, 12),
      tableMat
    );
    tableTop.position.set(0, 0.45, 1.2);
    tableTop.castShadow = true;
    group.add(tableTop);

    const tableLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.45, 6),
      tableMat
    );
    tableLeg.position.set(0, 0.22, 1.2);
    group.add(tableLeg);

    scene.add(group);
  }

  // ── Lighting ──────────────────────────────────────────────────────────────
  // Warm ambient
  const ambientLight = new THREE.AmbientLight(0xFFF0E0, 0.8);
  scene.add(ambientLight);

  // Main overhead
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(10, 20, 5);
  dirLight.castShadow = true;
  dirLight.shadow.camera.left = -25;
  dirLight.shadow.camera.right = 25;
  dirLight.shadow.camera.top = 20;
  dirLight.shadow.camera.bottom = -20;
  scene.add(dirLight);

  // Stage spotlight
  const stageLight = new THREE.SpotLight(0x4A90D9, 2.0, 20, Math.PI / 6, 0.5);
  stageLight.position.set(0, WALL_HEIGHT - 0.5, -8);
  stageLight.target.position.set(0, 0, -10);
  scene.add(stageLight);
  scene.add(stageLight.target);

  // Warm point lights at seating areas
  for (const cg of couchGroups) {
    const light = new THREE.PointLight(0xFFE4B5, 0.6, 10);
    light.position.set(cg.x, 3, cg.z);
    scene.add(light);
  }

  // Center lounge light
  const centerLight = new THREE.PointLight(0xFFE4B5, 0.5, 20);
  centerLight.position.set(0, WALL_HEIGHT - 1, 0);
  scene.add(centerLight);

  // Soft indoor fog
  scene.fog = new THREE.FogExp2(0x1a1a2e, 0.012);
  scene.background = new THREE.Color(0x1a1a2e);

  // Compute wall collision boxes
  scene.updateMatrixWorld(true);
  scene.traverse((obj) => {
    if (obj.isMesh && obj.userData.isWall) {
      const bb = new THREE.Box3().setFromObject(obj);
      wallBoxes.push(bb);
    }
  });

  return { wallBoxes, SPAWN_POINTS, lennyPosition: LENNY_POSITION, LOUNGE_WIDTH, LOUNGE_DEPTH };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function makeTextSprite(text, color, scale = 1) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const ratio = 2;
  const fontSize = 48 * ratio;
  const padding = 40 * ratio;
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  const metrics = ctx.measureText(text);
  canvas.width = metrics.width + padding * 2;
  canvas.height = fontSize + padding;

  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set((canvas.width / canvas.height) * scale * 2, scale * 2, 1);

  return sprite;
}
