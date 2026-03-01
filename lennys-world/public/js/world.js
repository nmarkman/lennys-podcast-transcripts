import * as THREE from 'three';

// ── Room layout constants ─────────────────────────────────────────────────────
// Lobby is a circle at origin. 7 rooms radiate outward like spokes.
const LOBBY_RADIUS = 20;
const CORRIDOR_LENGTH = 12;
const CORRIDOR_WIDTH = 6;
const WALL_HEIGHT = 5;
const WALL_THICKNESS = 0.5;

// Room sizes scale with guest count
const ROOM_BASE_SIZE = 20;
const ROOM_SCALE_FACTOR = 0.15; // extra size per guest

// Room definitions with angles (evenly spaced around the circle)
const ROOM_LAYOUT = [
  { id: 'product-lab',       angle: Math.PI / 2 },        // top (12 o'clock)
  { id: 'leadership-lounge', angle: Math.PI / 2 + Math.PI * 2 / 7 },
  { id: 'growth-floor',      angle: Math.PI / 2 + Math.PI * 4 / 7 },
  { id: 'founders-garage',   angle: Math.PI / 2 + Math.PI * 6 / 7 },
  { id: 'career-cafe',       angle: Math.PI / 2 + Math.PI * 8 / 7 },
  { id: 'ai-arena',          angle: Math.PI / 2 + Math.PI * 10 / 7 },
  { id: 'tech-campus',       angle: Math.PI / 2 + Math.PI * 12 / 7 },
];

export function buildWorld(scene, roomsData) {
  const roomMeta = {};
  const wallBoxes = []; // Collision bounding boxes

  // ── Floor material ──────────────────────────────────────────────────────────
  const lobbyFloorMat = new THREE.MeshStandardMaterial({
    color: 0x252540,
    roughness: 0.8,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a5a,
    roughness: 0.6,
  });

  // ── Lobby floor (circle) ────────────────────────────────────────────────────
  const lobbyFloor = new THREE.Mesh(
    new THREE.CircleGeometry(LOBBY_RADIUS, 64),
    lobbyFloorMat
  );
  lobbyFloor.rotation.x = -Math.PI / 2;
  lobbyFloor.receiveShadow = true;
  scene.add(lobbyFloor);

  // Lobby center marker (decorative ring)
  const ringGeo = new THREE.RingGeometry(2, 2.3, 64);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x4A90D9, emissive: 0x4A90D9, emissiveIntensity: 0.3 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);

  // Lobby walls (circle segments with gaps for corridors)
  buildLobbyWalls(scene, wallMat);

  // ── Build each room ─────────────────────────────────────────────────────────
  for (const layout of ROOM_LAYOUT) {
    const roomData = roomsData.find(r => r.id === layout.id);
    if (!roomData) continue;

    const guestCount = roomData.guestCount || 10;
    const roomSize = ROOM_BASE_SIZE + guestCount * ROOM_SCALE_FACTOR;

    // Room center position (lobby edge + corridor + half room)
    const distFromCenter = LOBBY_RADIUS + CORRIDOR_LENGTH + roomSize / 2;
    const cx = Math.cos(layout.angle) * distFromCenter;
    const cz = -Math.sin(layout.angle) * distFromCenter;

    // Build corridor
    buildCorridor(scene, layout.angle, wallMat, roomData);

    // Build room
    const roomColor = new THREE.Color(roomData.color);
    const roomFloorMat = new THREE.MeshStandardMaterial({
      color: roomColor.clone().multiplyScalar(0.25),
      roughness: 0.7,
    });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(roomSize, roomSize),
      roomFloorMat
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, cz);
    floor.receiveShadow = true;
    scene.add(floor);

    // Room walls (3 sides, open side faces corridor)
    buildRoomWalls(scene, cx, cz, roomSize, layout.angle, wallMat, roomColor);

    // Room accent light
    const pointLight = new THREE.PointLight(roomColor, 1.2, roomSize * 3);
    pointLight.position.set(cx, WALL_HEIGHT - 1, cz);
    scene.add(pointLight);

    // Room label (3D text sprite above door)
    const labelSprite = makeTextSprite(roomData.name, roomData.color, 1.2);
    const labelDist = LOBBY_RADIUS + CORRIDOR_LENGTH * 0.5;
    labelSprite.position.set(
      Math.cos(layout.angle) * labelDist,
      WALL_HEIGHT + 1,
      -Math.sin(layout.angle) * labelDist
    );
    scene.add(labelSprite);

    // Room description (smaller, below label)
    const descSprite = makeTextSprite(roomData.description, '#8888aa', 0.6);
    descSprite.position.set(
      Math.cos(layout.angle) * labelDist,
      WALL_HEIGHT + 0.2,
      -Math.sin(layout.angle) * labelDist
    );
    scene.add(descSprite);

    roomMeta[layout.id] = {
      center: new THREE.Vector3(cx, 0, cz),
      size: roomSize,
      angle: layout.angle,
      name: roomData.name,
      color: roomData.color,
      guestCount
    };
  }

  // Store lobby info
  roomMeta['lobby'] = {
    center: new THREE.Vector3(0, 0, 0),
    size: LOBBY_RADIUS * 2,
    angle: 0,
    name: 'Lobby',
    color: '#4A90D9'
  };

  // ── Lighting ────────────────────────────────────────────────────────────────
  const ambientLight = new THREE.AmbientLight(0x606080, 1.0);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(30, 50, 20);
  dirLight.castShadow = true;
  dirLight.shadow.camera.left = -80;
  dirLight.shadow.camera.right = 80;
  dirLight.shadow.camera.top = 80;
  dirLight.shadow.camera.bottom = -80;
  scene.add(dirLight);

  // Lobby center light
  const lobbyLight = new THREE.PointLight(0x4A90D9, 1.0, 60);
  lobbyLight.position.set(0, WALL_HEIGHT, 0);
  scene.add(lobbyLight);

  // Sky/fog
  scene.fog = new THREE.FogExp2(0x0a0a1a, 0.005);
  scene.background = new THREE.Color(0x0a0a1a);

  // Update wall matrices and compute bounding boxes
  scene.updateMatrixWorld(true);
  // Recompute all wall bounding boxes after matrix update
  wallBoxes.length = 0;
  scene.traverse((obj) => {
    if (obj.isMesh && obj.userData.isWall) {
      obj.geometry.computeBoundingBox();
      const bb = new THREE.Box3().setFromObject(obj);
      wallBoxes.push(bb);
    }
  });

  return { roomMeta, wallBoxes, LOBBY_RADIUS, CORRIDOR_LENGTH, WALL_HEIGHT };
}

function buildLobbyWalls(scene, wallMat) {
  // Build circular wall segments with gaps for corridors
  const segments = 128;
  const corridorGapAngle = CORRIDOR_WIDTH / LOBBY_RADIUS; // radians for corridor gap

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;

    // Check if this segment overlaps with a corridor gap
    let isGap = false;
    for (const layout of ROOM_LAYOUT) {
      const diff = Math.abs(angleDiff(angle, layout.angle));
      if (diff < corridorGapAngle) {
        isGap = true;
        break;
      }
    }
    if (isGap) continue;

    const nextAngle = ((i + 1) / segments) * Math.PI * 2;
    const x1 = Math.cos(angle) * LOBBY_RADIUS;
    const z1 = -Math.sin(angle) * LOBBY_RADIUS;
    const x2 = Math.cos(nextAngle) * LOBBY_RADIUS;
    const z2 = -Math.sin(nextAngle) * LOBBY_RADIUS;

    const wallLen = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(wallLen, WALL_HEIGHT, WALL_THICKNESS),
      wallMat
    );
    wall.position.set((x1 + x2) / 2, WALL_HEIGHT / 2, (z1 + z2) / 2);
    wall.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    wall.castShadow = true;
    wall.userData.isWall = true;
    scene.add(wall);
  }
}

function buildCorridor(scene, angle, wallMat, roomData) {
  const corridorMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(roomData.color).multiplyScalar(0.1),
    roughness: 0.8,
  });

  // Corridor floor
  const startDist = LOBBY_RADIUS;
  const endDist = LOBBY_RADIUS + CORRIDOR_LENGTH;
  const midDist = (startDist + endDist) / 2;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(CORRIDOR_LENGTH, CORRIDOR_WIDTH),
    corridorMat
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(
    Math.cos(angle) * midDist,
    0.01,
    -Math.sin(angle) * midDist
  );
  floor.rotation.z = angle;
  scene.add(floor);

  // Corridor side walls
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(CORRIDOR_LENGTH, WALL_HEIGHT, WALL_THICKNESS),
      wallMat
    );

    // Perpendicular offset for each side
    const perpX = Math.cos(angle + Math.PI / 2) * (CORRIDOR_WIDTH / 2) * side;
    const perpZ = -Math.sin(angle + Math.PI / 2) * (CORRIDOR_WIDTH / 2) * side;

    wall.position.set(
      Math.cos(angle) * midDist + perpX,
      WALL_HEIGHT / 2,
      -Math.sin(angle) * midDist + perpZ
    );
    // Wall should be parallel to the corridor direction
    wall.rotation.y = -angle + Math.PI / 2;
    wall.castShadow = true;
    wall.userData.isWall = true;
    scene.add(wall);
  }

  // Accent strip on floor (colored line leading to room)
  const stripGeo = new THREE.PlaneGeometry(CORRIDOR_LENGTH, 0.3);
  const stripMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(roomData.color),
    emissive: new THREE.Color(roomData.color),
    emissiveIntensity: 0.5,
  });
  const strip = new THREE.Mesh(stripGeo, stripMat);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(
    Math.cos(angle) * midDist,
    0.03,
    -Math.sin(angle) * midDist
  );
  strip.rotation.z = angle;
  scene.add(strip);
}

function buildRoomWalls(scene, cx, cz, size, angle, wallMat, roomColor) {
  const accentMat = new THREE.MeshStandardMaterial({
    color: roomColor,
    emissive: roomColor,
    emissiveIntensity: 0.15,
    roughness: 0.5,
  });

  // The room opens toward the lobby. We need 3 walls:
  // - back wall (opposite the opening)
  // - two side walls

  const halfSize = size / 2;

  // Direction from lobby center to room center
  const dirX = Math.cos(angle);
  const dirZ = -Math.sin(angle);

  // Perpendicular direction
  const perpX = -dirZ;
  const perpZ = dirX;

  // Back wall (perpendicular to corridor direction)
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(size, WALL_HEIGHT, WALL_THICKNESS),
    wallMat
  );
  backWall.position.set(
    cx + dirX * halfSize,
    WALL_HEIGHT / 2,
    cz + dirZ * halfSize
  );
  backWall.rotation.y = -angle + Math.PI / 2;
  backWall.castShadow = true;
  backWall.userData.isWall = true;
  scene.add(backWall);

  // Accent strip on back wall
  const backAccent = new THREE.Mesh(
    new THREE.BoxGeometry(size, 0.3, WALL_THICKNESS + 0.1),
    accentMat
  );
  backAccent.position.set(
    cx + dirX * halfSize,
    WALL_HEIGHT - 0.5,
    cz + dirZ * halfSize
  );
  backAccent.rotation.y = -angle + Math.PI / 2;
  scene.add(backAccent);

  // Side walls (parallel to corridor direction)
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(size, WALL_HEIGHT, WALL_THICKNESS),
      wallMat
    );
    wall.position.set(
      cx + perpX * halfSize * side,
      WALL_HEIGHT / 2,
      cz + perpZ * halfSize * side
    );
    wall.rotation.y = -angle;
    wall.castShadow = true;
    wall.userData.isWall = true;
    scene.add(wall);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function makeTextSprite(text, color, scale = 1) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const ratio = 2; // high-DPI
  const fontSize = 48 * ratio;
  const padding = 40 * ratio;
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  const metrics = ctx.measureText(text);
  canvas.width = metrics.width + padding * 2;
  canvas.height = fontSize + padding;

  // Must re-set font after canvas resize
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

export function getCurrentRoom(position, roomMeta) {
  // Check if in lobby
  const distFromCenter = Math.sqrt(position.x ** 2 + position.z ** 2);
  if (distFromCenter < LOBBY_RADIUS) return roomMeta['lobby'];

  // Check each room
  for (const [id, room] of Object.entries(roomMeta)) {
    if (id === 'lobby') continue;
    const dist = position.distanceTo(room.center);
    if (dist < room.size * 0.7) return room;
  }

  // In a corridor — find nearest room
  let nearest = roomMeta['lobby'];
  let nearestDist = Infinity;
  for (const [id, room] of Object.entries(roomMeta)) {
    const d = position.distanceTo(room.center);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = room;
    }
  }
  return nearest;
}
