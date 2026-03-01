import * as THREE from 'three';
import { makeTextSprite } from './world.js';

const NAME_VISIBLE_DISTANCE = 12;
const INTERACTION_DISTANCE = 4;
const MAX_VISIBLE_PER_ROOM = 8;

export class CharacterManager {
  constructor(scene) {
    this.scene = scene;
    this.characters = [];
    this.allCharacters = [];
    this.roomCharData = {};
    this.kiosks = [];
    this.playerPosition = new THREE.Vector3();
  }

  createAllCharacters(charactersData, roomMeta) {
    const byRoom = {};
    for (const char of charactersData) {
      if (!byRoom[char.roomId]) byRoom[char.roomId] = [];
      byRoom[char.roomId].push(char);
    }
    this.allCharacters = charactersData;

    for (const [roomId, chars] of Object.entries(byRoom)) {
      const room = roomMeta[roomId];
      if (!room) continue;
      this.roomCharData[roomId] = chars;

      const featured = [];
      const rest = [];
      for (const c of chars) {
        if (c.isHost) featured.unshift(c);
        else if (featured.length < MAX_VISIBLE_PER_ROOM) featured.push(c);
        else rest.push(c);
      }

      const positions = this.computePositions(featured.length, room);
      for (let i = 0; i < featured.length; i++) {
        this.createCharacter(featured[i], positions[i]);
      }

      if (rest.length > 0 && room.name !== 'Lobby') {
        this.createKiosk(room, rest, featured);
      }
    }
  }

  computePositions(count, room) {
    const positions = [];
    if (room.name === 'Lobby') {
      positions.push(new THREE.Vector3(0, 0, -2));
      return positions;
    }
    const angleSpread = Math.PI * 0.8;
    const startAngle = room.angle + Math.PI - angleSpread / 2;
    const radius = Math.min(room.size * 0.3, 6);
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0.5;
      const a = startAngle + t * angleSpread;
      const r = radius * (0.5 + Math.random() * 0.5);
      positions.push(new THREE.Vector3(
        room.center.x + Math.cos(a) * r,
        0,
        room.center.z - Math.sin(a) * r
      ));
    }
    return positions;
  }

  createKiosk(room, hiddenChars, visibleChars) {
    const group = new THREE.Group();
    const entranceDir = room.angle;
    const kx = room.center.x - Math.cos(entranceDir) * (room.size * 0.35);
    const kz = room.center.z + Math.sin(entranceDir) * (room.size * 0.35);

    const baseMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(room.color).multiplyScalar(0.4),
      roughness: 0.3, metalness: 0.6,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 1.2, 8), baseMat);
    base.position.y = 0.6;
    base.castShadow = true;
    group.add(base);

    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x111122, emissive: new THREE.Color(room.color),
      emissiveIntensity: 0.3, roughness: 0.1,
    });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.05), screenMat);
    screen.position.y = 1.5;
    screen.rotation.y = -entranceDir + Math.PI / 2;
    group.add(screen);

    const ringMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(room.color), emissive: new THREE.Color(room.color),
      emissiveIntensity: 0.8, transparent: true, opacity: 0.6,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 8, 32), ringMat);
    ring.position.y = 2.2;
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    const countSprite = makeTextSprite(`+${hiddenChars.length} more guests`, room.color, 0.35);
    countSprite.position.y = 2.8;
    group.add(countSprite);

    group.position.set(kx, 0, kz);
    this.scene.add(group);

    this.kiosks.push({ group, ring, position: new THREE.Vector3(kx, 0, kz), roomId: room.name, hiddenChars, visibleChars });
  }

  createCharacter(charData, position) {
    const group = new THREE.Group();
    group.position.copy(position);
    const colors = charData.colors;
    const skinColor = colors.skin || '#FDDBB4';
    const shirtColor = colors.shirt || '#4A90D9';
    const pantsColor = colors.pants || '#2a2a4a';
    const hairColor = colors.hair || '#2C1810';
    const h = this.hashString(charData.name);

    // Torso
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 0.5, 6, 12),
      new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 })
    );
    torso.position.y = 1.2; torso.castShadow = true;
    group.add(torso);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 12),
      new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 })
    );
    head.position.y = 1.95; head.castShadow = true;
    group.add(head);

    // Eyes
    for (const side of [-0.1, 0.1]) {
      const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
      eyeW.position.set(side, 1.98, 0.27); group.add(eyeW);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      pupil.position.set(side, 1.98, 0.31); group.add(pupil);
    }

    // Smile
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 4, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    smile.position.set(0, 1.88, 0.28); smile.rotation.x = Math.PI; smile.rotation.z = Math.PI;
    group.add(smile);

    // Hair (varied)
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.8 });
    if (h % 4 === 0) {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), hairMat);
      hair.position.y = 2.02; hair.scale.set(1, 0.7, 1); group.add(hair);
    } else if (h % 4 === 1) {
      const hair = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.2, 10), hairMat);
      hair.position.y = 2.15; group.add(hair);
    } else if (h % 4 === 2) {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
      hair.position.y = 1.98; hair.rotation.z = 0.2; group.add(hair);
    } else {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.4), hairMat);
      hair.position.y = 2.0; group.add(hair);
    }

    // Legs + shoes
    const sw = 0.13 + (h % 3) * 0.02;
    for (const side of [-sw, sw]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.4, 4, 8), new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 }));
      leg.position.set(side, 0.38, 0); leg.castShadow = true; group.add(leg);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.2), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }));
      shoe.position.set(side, 0.06, 0.04); group.add(shoe);
    }

    // Arms
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.35, 4, 6), new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 }));
      arm.position.set(side * 0.4, 1.05, 0);
      arm.rotation.z = side * (-0.1 - (h % 5) * 0.03);
      group.add(arm);
    }

    // Accessories
    for (const acc of charData.accessories || []) {
      const accMesh = createAccessory(acc);
      if (accMesh) group.add(accMesh);
    }

    // Host glow
    if (charData.isHost) {
      const glow = new THREE.Mesh(
        new THREE.RingGeometry(0.8, 1.0, 32),
        new THREE.MeshStandardMaterial({ color: 0x4A90D9, emissive: 0x4A90D9, emissiveIntensity: 1.0, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
      );
      glow.rotation.x = -Math.PI / 2; glow.position.y = 0.05; group.add(glow);
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ color: 0xFFD700, emissive: 0xFFD700, emissiveIntensity: 0.6 }));
      star.position.y = 2.6; group.add(star);
    }

    // Shadow disc
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; group.add(shadow);

    // Name
    const nameSprite = makeTextSprite(charData.name, '#ffffff', 0.35);
    nameSprite.position.y = 2.7; nameSprite.visible = false; group.add(nameSprite);

    // Title
    if (charData.title) {
      const titleSprite = makeTextSprite(charData.title, '#aaaacc', 0.2);
      titleSprite.position.y = 2.4; titleSprite.visible = false; group.add(titleSprite);
      charData._titleSprite = titleSprite;
    }

    // Face toward lobby
    const toLobby = Math.atan2(-position.x, -position.z);
    group.rotation.y = toLobby + (Math.random() - 0.5) * 0.5;

    this.scene.add(group);
    this.characters.push({ data: charData, group, nameSprite, idleOffset: Math.random() * Math.PI * 2, baseY: position.y });
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    return Math.abs(hash);
  }

  update(playerPosition, time) {
    this.playerPosition.copy(playerPosition);
    for (const char of this.characters) {
      char.group.position.y = char.baseY + Math.sin(time * 1.5 + char.idleOffset) * 0.02;
      const dist = this.playerPosition.distanceTo(char.group.position);
      char.nameSprite.visible = dist < NAME_VISIBLE_DISTANCE;
      if (char.data._titleSprite) char.data._titleSprite.visible = dist < NAME_VISIBLE_DISTANCE * 0.6;
      if (dist < INTERACTION_DISTANCE * 1.5) {
        const dx = this.playerPosition.x - char.group.position.x;
        const dz = this.playerPosition.z - char.group.position.z;
        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - char.group.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        char.group.rotation.y += diff * 0.05;
      }
    }
    for (const kiosk of this.kiosks) {
      kiosk.ring.rotation.z = time * 0.5;
      kiosk.ring.position.y = 2.2 + Math.sin(time * 2) * 0.1;
    }
  }

  getNearestInteractable(playerPosition) {
    let nearest = null;
    let nearestDist = INTERACTION_DISTANCE;
    for (const char of this.characters) {
      const dist = playerPosition.distanceTo(char.group.position);
      if (dist < nearestDist) { nearestDist = dist; nearest = { type: 'character', data: char.data }; }
    }
    for (const kiosk of this.kiosks) {
      const dist = playerPosition.distanceTo(kiosk.position);
      if (dist < INTERACTION_DISTANCE + 1 && (!nearest || dist < nearestDist)) {
        nearestDist = dist; nearest = { type: 'kiosk', data: kiosk };
      }
    }
    if (!nearest) return null;
    if (nearest.type === 'character') return nearest.data;
    return { name: 'Guest Directory: ' + nearest.data.roomId, isKiosk: true, kiosk: nearest.data };
  }

  spawnFromDirectory(charData, kioskPosition) {
    const offset = new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3);
    this.createCharacter(charData, kioskPosition.clone().add(offset));
    return charData.name;
  }
}

function createAccessory(acc) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: acc.color, emissive: acc.color, emissiveIntensity: 0.3, roughness: 0.5 });
  switch (acc.type) {
    case 'surfboard': { const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.3), mat); m.position.set(-0.6, 1.0, 0); m.rotation.z = 0.15; group.add(m); break; }
    case 'book': { const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.06), mat); m.position.set(0.5, 0.9, 0.1); group.add(m); break; }
    case 'coffee': { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.18, 8), mat); m.position.set(0.5, 0.9, 0); group.add(m); break; }
    case 'guitar': { const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat); b.position.set(-0.55, 0.8, 0); b.scale.set(0.8, 1, 0.3); group.add(b); const n = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 4), mat); n.position.set(-0.55, 1.3, 0); group.add(n); break; }
    case 'headphones': { const b = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 16, Math.PI), mat); b.position.set(0, 2.05, 0); group.add(b); for (const s of [-0.28, 0.28]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8), mat); p.position.set(s, 1.82, 0); p.rotation.z = Math.PI / 2; group.add(p); } break; }
    case 'sneakers': { for (const s of [-0.12, 0.12]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.24), mat); m.position.set(s, 0.05, 0.05); group.add(m); } break; }
    case 'chef-hat': { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.3, 8), mat); m.position.set(0, 2.25, 0); group.add(m); break; }
    case 'dog': { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.2, 4, 6), mat); b.position.set(0.7, 0.2, 0.3); b.rotation.z = Math.PI / 2; group.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), mat); h.position.set(0.9, 0.25, 0.3); group.add(h); break; }
    case 'cat': { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.15, 4, 6), mat); b.position.set(0.6, 0.15, -0.3); b.rotation.z = Math.PI / 2; group.add(b); break; }
    case 'lotus': { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.1, 12), mat); m.position.set(0, 0.05, 0); group.add(m); break; }
    case 'backpack': { const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.15), mat); m.position.set(0, 1.1, -0.3); group.add(m); break; }
    case 'wine': { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.2, 8), mat); m.position.set(0.5, 0.95, 0.1); group.add(m); break; }
    case 'globe': { const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat); m.position.set(0.5, 1.0, 0); group.add(m); break; }
    case 'paintbrush': { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4), mat); m.position.set(0.55, 1.0, 0.1); m.rotation.z = -0.3; group.add(m); break; }
    case 'ball': { const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat); m.position.set(0.65, 0.12, 0.4); group.add(m); break; }
    case 'plant': { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.15, 8), new THREE.MeshStandardMaterial({ color: '#8B4513' })); p.position.set(0.6, 0.08, -0.3); group.add(p); const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), mat); l.position.set(0.6, 0.25, -0.3); group.add(l); break; }
    case 'controller': { const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.12), mat); m.position.set(0.5, 0.9, 0.1); group.add(m); break; }
    case 'clapperboard': { const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.03), mat); m.position.set(0.55, 1.0, 0.1); group.add(m); break; }
    case 'heart': { const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat); m.position.set(0, 2.5, 0); group.add(m); break; }
    case 'bike': { const w1 = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 6, 12), mat); w1.position.set(-0.65, 0.15, 0.3); group.add(w1); const w2 = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 6, 12), mat); w2.position.set(-0.65, 0.15, 0.6); group.add(w2); break; }
    default: return null;
  }
  return group;
}
