import * as THREE from 'three';
import { makeTextSprite } from './world.js';

const NAME_VISIBLE_DISTANCE = 15;
const INTERACTION_DISTANCE = 4;

export class CharacterManager {
  constructor(scene) {
    this.scene = scene;
    this.characters = [];   // { data, group, nameSprite, idleOffset }
    this.playerPosition = new THREE.Vector3();
  }

  createAllCharacters(charactersData, roomMeta) {
    // Group characters by room
    const byRoom = {};
    for (const char of charactersData) {
      const roomId = char.roomId;
      if (!byRoom[roomId]) byRoom[roomId] = [];
      byRoom[roomId].push(char);
    }

    for (const [roomId, chars] of Object.entries(byRoom)) {
      const room = roomMeta[roomId];
      if (!room) continue;

      const positions = this.computePositions(chars.length, room);

      for (let i = 0; i < chars.length; i++) {
        const charData = chars[i];
        const pos = positions[i];
        this.createCharacter(charData, pos);
      }
    }
  }

  computePositions(count, room) {
    const positions = [];
    const size = room.size * 0.8; // Some padding from walls

    if (room.name === 'Lobby') {
      // Place Lenny near center
      positions.push(new THREE.Vector3(0, 0, -2));
      return positions;
    }

    // Grid layout with some randomization
    const cols = Math.ceil(Math.sqrt(count * 1.5));
    const spacing = size / (cols + 1);

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;

      // Offset from room center
      const x = (col - (cols - 1) / 2) * spacing;
      const z = (row - Math.floor(count / cols) / 2) * spacing;

      // Add small random offset for organic feel
      const jitterX = (Math.random() - 0.5) * spacing * 0.3;
      const jitterZ = (Math.random() - 0.5) * spacing * 0.3;

      positions.push(new THREE.Vector3(
        room.center.x + x + jitterX,
        0,
        room.center.z + z + jitterZ
      ));
    }

    return positions;
  }

  createCharacter(charData, position) {
    const group = new THREE.Group();
    group.position.copy(position);

    const colors = charData.colors;

    // ── Body (capsule shape: cylinder + spheres) ──────────────────────────────
    // Torso
    const torsoGeo = new THREE.CylinderGeometry(0.35, 0.3, 0.9, 8);
    const torsoMat = new THREE.MeshStandardMaterial({ color: colors.shirt });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 1.15;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const headGeo = new THREE.SphereGeometry(0.28, 12, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: colors.skin });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.85;
    head.castShadow = true;
    group.add(head);

    // Hair
    const hairGeo = new THREE.SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const hairMat = new THREE.MeshStandardMaterial({ color: colors.hair });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 1.9;
    group.add(hair);

    // Legs
    for (const side of [-0.12, 0.12]) {
      const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.7, 6);
      const legMat = new THREE.MeshStandardMaterial({ color: colors.pants });
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(side, 0.35, 0);
      leg.castShadow = true;
      group.add(leg);
    }

    // Arms
    for (const side of [-0.45, 0.45]) {
      const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6);
      const armMat = new THREE.MeshStandardMaterial({ color: colors.skin });
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.set(side, 1.0, 0);
      arm.rotation.z = side > 0 ? -0.15 : 0.15;
      group.add(arm);
    }

    // ── Accessories ───────────────────────────────────────────────────────────
    for (const acc of charData.accessories || []) {
      const accMesh = createAccessory(acc);
      if (accMesh) group.add(accMesh);
    }

    // ── Host glow (Lenny special) ─────────────────────────────────────────────
    if (charData.isHost) {
      const glowGeo = new THREE.RingGeometry(0.6, 0.8, 32);
      const glowMat = new THREE.MeshStandardMaterial({
        color: 0x4A90D9,
        emissive: 0x4A90D9,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.05;
      group.add(glow);
    }

    // ── Name sprite (hidden initially, shown on proximity) ────────────────────
    const nameSprite = makeTextSprite(charData.name, '#ffffff', 0.4);
    nameSprite.position.y = 2.4;
    nameSprite.visible = false;
    group.add(nameSprite);

    // Face a random direction
    group.rotation.y = Math.random() * Math.PI * 2;

    this.scene.add(group);

    this.characters.push({
      data: charData,
      group,
      nameSprite,
      idleOffset: Math.random() * Math.PI * 2, // For idle animation
      baseY: position.y
    });
  }

  update(playerPosition, time) {
    this.playerPosition.copy(playerPosition);

    for (const char of this.characters) {
      // Idle bobbing animation
      char.group.position.y = char.baseY + Math.sin(time * 2 + char.idleOffset) * 0.03;

      // Show/hide name based on proximity
      const dist = this.playerPosition.distanceTo(char.group.position);
      char.nameSprite.visible = dist < NAME_VISIBLE_DISTANCE;

      // Face player when close
      if (dist < INTERACTION_DISTANCE * 1.5) {
        const dx = this.playerPosition.x - char.group.position.x;
        const dz = this.playerPosition.z - char.group.position.z;
        const targetAngle = Math.atan2(dx, dz);
        // Smooth rotation
        let current = char.group.rotation.y;
        let diff = targetAngle - current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        char.group.rotation.y += diff * 0.05;
      }
    }
  }

  getNearestInteractable(playerPosition) {
    let nearest = null;
    let nearestDist = INTERACTION_DISTANCE;

    for (const char of this.characters) {
      const dist = playerPosition.distanceTo(char.group.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = char;
      }
    }

    return nearest ? nearest.data : null;
  }
}

// ── Accessory factory ─────────────────────────────────────────────────────────
function createAccessory(acc) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: acc.color,
    emissive: acc.color,
    emissiveIntensity: 0.2,
  });

  switch (acc.type) {
    case 'surfboard': {
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 1.2, 0.3),
        mat
      );
      board.position.set(-0.6, 1.0, 0);
      board.rotation.z = 0.15;
      group.add(board);
      break;
    }
    case 'book': {
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.4, 0.06),
        mat
      );
      book.position.set(0.5, 0.9, 0.1);
      group.add(book);
      break;
    }
    case 'coffee': {
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.06, 0.18, 8),
        mat
      );
      cup.position.set(0.5, 0.9, 0);
      group.add(cup);
      break;
    }
    case 'guitar': {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 6),
        mat
      );
      body.position.set(-0.55, 0.8, 0);
      body.scale.set(0.8, 1, 0.3);
      group.add(body);
      const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.7, 4),
        mat
      );
      neck.position.set(-0.55, 1.3, 0);
      group.add(neck);
      break;
    }
    case 'headphones': {
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.3, 0.03, 8, 16, Math.PI),
        mat
      );
      band.position.set(0, 2.05, 0);
      group.add(band);
      for (const side of [-0.28, 0.28]) {
        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8),
          mat
        );
        pad.position.set(side, 1.82, 0);
        pad.rotation.z = Math.PI / 2;
        group.add(pad);
      }
      break;
    }
    case 'sneakers': {
      for (const side of [-0.12, 0.12]) {
        const shoe = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.08, 0.22),
          mat
        );
        shoe.position.set(side, 0.04, 0.05);
        group.add(shoe);
      }
      break;
    }
    case 'chef-hat': {
      const hat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.25, 0.3, 8),
        mat
      );
      hat.position.set(0, 2.2, 0);
      group.add(hat);
      break;
    }
    case 'dog': {
      const dogBody = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.1, 0.2, 4, 6),
        mat
      );
      dogBody.position.set(0.7, 0.2, 0.3);
      dogBody.rotation.z = Math.PI / 2;
      group.add(dogBody);
      const dogHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 6, 4),
        mat
      );
      dogHead.position.set(0.9, 0.25, 0.3);
      group.add(dogHead);
      break;
    }
    case 'cat': {
      const catBody = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.08, 0.15, 4, 6),
        mat
      );
      catBody.position.set(0.6, 0.15, -0.3);
      catBody.rotation.z = Math.PI / 2;
      group.add(catBody);
      break;
    }
    case 'lotus': {
      // Meditation cushion
      const cushion = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.35, 0.1, 12),
        mat
      );
      cushion.position.set(0, 0.05, 0);
      group.add(cushion);
      break;
    }
    case 'backpack': {
      const pack = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.35, 0.15),
        mat
      );
      pack.position.set(0, 1.1, -0.3);
      group.add(pack);
      break;
    }
    case 'wine': {
      const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.06, 0.2, 8),
        mat
      );
      glass.position.set(0.5, 0.95, 0.1);
      group.add(glass);
      break;
    }
    case 'globe': {
      const globe = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 8),
        mat
      );
      globe.position.set(0.5, 1.0, 0);
      group.add(globe);
      break;
    }
    case 'paintbrush': {
      const brush = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4),
        mat
      );
      brush.position.set(0.55, 1.0, 0.1);
      brush.rotation.z = -0.3;
      group.add(brush);
      break;
    }
    case 'ball': {
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 8),
        mat
      );
      ball.position.set(0.65, 0.12, 0.4);
      group.add(ball);
      break;
    }
    case 'plant': {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.08, 0.15, 8),
        new THREE.MeshStandardMaterial({ color: '#8B4513' })
      );
      pot.position.set(0.6, 0.08, -0.3);
      group.add(pot);
      const leaves = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 4),
        mat
      );
      leaves.position.set(0.6, 0.25, -0.3);
      group.add(leaves);
      break;
    }
    case 'controller': {
      const ctrl = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.08, 0.12),
        mat
      );
      ctrl.position.set(0.5, 0.9, 0.1);
      group.add(ctrl);
      break;
    }
    case 'clapperboard': {
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.2, 0.03),
        mat
      );
      board.position.set(0.55, 1.0, 0.1);
      group.add(board);
      break;
    }
    case 'heart': {
      // Simple heart as a scaled sphere
      const heart = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 6),
        mat
      );
      heart.position.set(0, 2.5, 0);
      group.add(heart);
      break;
    }
    case 'bike': {
      const wheel1 = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.02, 6, 12),
        mat
      );
      wheel1.position.set(-0.65, 0.15, 0.3);
      group.add(wheel1);
      const wheel2 = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.02, 6, 12),
        mat
      );
      wheel2.position.set(-0.65, 0.15, 0.6);
      group.add(wheel2);
      break;
    }
    default:
      return null;
  }

  return group;
}
