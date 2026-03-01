import * as THREE from 'three';
import { makeTextSprite } from './world.js';

const NAME_VISIBLE_DISTANCE = 12;
const INTERACTION_DISTANCE = 4;
const MAX_SPAWNED = 12;

// Behavior constants
const NPC_WALK_SPEED = 1.5;
const WANDER_RADIUS = 5;       // How far from spawn they'll roam
const IDLE_MIN = 2;             // Min seconds standing still
const IDLE_MAX = 6;
const WALK_DURATION_MIN = 1.5;
const WALK_DURATION_MAX = 4;
const CONVERSE_DURATION_MIN = 3;
const CONVERSE_DURATION_MAX = 8;
const CONVERSE_DISTANCE = 3;    // How close NPCs get to chat

export class CharacterManager {
  constructor(scene, spawnPoints) {
    this.scene = scene;
    this.characters = []; // { data, group, nameSprite, idleOffset, baseY, spawnPointIdx }
    this.spawnPoints = spawnPoints.map(p => p.clone());
    this.usedSpawnPoints = new Set();
    this.photoMap = {};
    this.photoCache = {};
    this.animations = []; // { charId, type:'spawn'|'despawn', progress, group, onComplete }
    this.playerPosition = new THREE.Vector3();
    this.lenny = null; // Reference to Lenny's character entry
  }

  setPhotoMap(map) {
    this.photoMap = map || {};
  }

  // ── Spawn Lenny at the podcast desk ────────────────────────────────────────
  spawnLenny(position, data) {
    const char = this.createCharacter(data, position);
    this.lenny = char;
    // No spawn point used for Lenny — he's at the desk
    return char;
  }

  // ── Spawn guests recommended by Lenny ──────────────────────────────────────
  spawnGuests(charDataArray) {
    const spawned = [];
    for (const charData of charDataArray) {
      // Skip if already spawned
      if (this.characters.find(c => c.data.id === charData.id)) continue;

      // Despawn oldest non-Lenny if at capacity
      const nonLennyCount = this.characters.filter(c => !c.data.isHost).length;
      if (nonLennyCount >= MAX_SPAWNED) {
        const oldest = this.characters.find(c => !c.data.isHost);
        if (oldest) this.despawnCharacter(oldest.data.id);
      }

      // Pick an available spawn point
      const spawnIdx = this.getAvailableSpawnPoint();
      if (spawnIdx === -1) continue; // No spawn points left

      const position = this.spawnPoints[spawnIdx];
      const char = this.createCharacter(charData, position);
      char.spawnPointIdx = spawnIdx;
      this.usedSpawnPoints.add(spawnIdx);

      // Start spawn animation (scale from 0 to 1)
      char.group.scale.set(0.01, 0.01, 0.01);
      this.animations.push({
        charId: charData.id,
        type: 'spawn',
        progress: 0,
        group: char.group,
      });

      spawned.push(char);
    }
    return spawned;
  }

  // ── Despawn a character with animation ─────────────────────────────────────
  despawnCharacter(charId) {
    const idx = this.characters.findIndex(c => c.data.id === charId);
    if (idx === -1) return;
    const char = this.characters[idx];

    this.animations.push({
      charId,
      type: 'despawn',
      progress: 0,
      group: char.group,
      onComplete: () => {
        // Remove from scene and dispose
        this.scene.remove(char.group);
        char.group.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
          }
        });
        // Free spawn point
        if (char.spawnPointIdx !== undefined) {
          this.usedSpawnPoints.delete(char.spawnPointIdx);
        }
        // Remove from array
        const i = this.characters.findIndex(c => c.data.id === charId);
        if (i !== -1) this.characters.splice(i, 1);
      }
    });
  }

  getAvailableSpawnPoint() {
    for (let i = 0; i < this.spawnPoints.length; i++) {
      if (!this.usedSpawnPoints.has(i)) return i;
    }
    return -1;
  }

  // ── Create a character mesh ────────────────────────────────────────────────
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

    // Legs + shoes (store refs for walk animation)
    const legs = {};
    const sw = 0.13 + (h % 3) * 0.02;
    for (const side of [-sw, sw]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.4, 4, 8), new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 }));
      leg.position.set(side, 0.38, 0); leg.castShadow = true; group.add(leg);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.2), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }));
      shoe.position.set(side, 0.06, 0.04); group.add(shoe);
      if (side < 0) legs.left = leg; else legs.right = leg;
    }

    // Arms (store refs for walk animation)
    const arms = {};
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.35, 4, 6), new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 }));
      arm.position.set(side * 0.4, 1.05, 0);
      arm.rotation.z = side * (-0.1 - (h % 5) * 0.03);
      group.add(arm);
      if (side < 0) arms.left = arm; else arms.right = arm;
      arm.userData.restZ = arm.rotation.z;
    }

    // Accessories
    for (const acc of charData.accessories || []) {
      const accMesh = createAccessory(acc);
      if (accMesh) group.add(accMesh);
    }

    // Host glow for Lenny
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

    // Name sprite
    const nameSprite = makeTextSprite(charData.name, '#ffffff', 0.35);
    nameSprite.position.y = 2.7; nameSprite.visible = false; group.add(nameSprite);

    // Title sprite
    if (charData.title) {
      const titleSprite = makeTextSprite(charData.title, '#aaaacc', 0.2);
      titleSprite.position.y = 2.4; titleSprite.visible = false; group.add(titleSprite);
      charData._titleSprite = titleSprite;
    }

    // Photo portrait billboard
    const photoUrl = this.photoMap[charData.id];
    let billboard = null;
    if (photoUrl) {
      billboard = this.createPhotoBillboard(charData.id, photoUrl);
      if (billboard) {
        billboard.position.y = 3.2;
        group.add(billboard);
      }
    }

    // Face toward lounge center
    const toCenter = Math.atan2(-position.x, -position.z);
    group.rotation.y = toCenter + (Math.random() - 0.5) * 0.5;

    this.scene.add(group);
    const charEntry = {
      data: charData, group, nameSprite, billboard, legs, arms,
      idleOffset: Math.random() * Math.PI * 2,
      baseY: position.y,
      spawnPos: position.clone(),
      // Behavior state
      state: charData.isHost ? 'idle' : 'idle', // 'idle' | 'walking' | 'conversing' | 'talking_to_player'
      stateTimer: Math.random() * IDLE_MAX,       // Countdown until next state change
      walkTarget: null,                            // Where we're walking to
      conversePartner: null,                       // Who we're chatting with
    };
    this.characters.push(charEntry);
    return charEntry;
  }

  // ── Photo billboard ────────────────────────────────────────────────────────
  createPhotoBillboard(id, url) {
    if (this.photoCache[id]) return this.photoCache[id].clone();

    const group = new THREE.Group();

    // Colored ring border
    const ringGeo = new THREE.RingGeometry(0.48, 0.55, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x4A90D9, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    group.add(ring);

    // Photo circle
    const loader = new THREE.TextureLoader();
    loader.load(url, (texture) => {
      const circleGeo = new THREE.CircleGeometry(0.47, 32);
      const circleMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
      const circle = new THREE.Mesh(circleGeo, circleMat);
      circle.position.z = 0.01;
      group.add(circle);
    }, undefined, () => {
      // Photo load failed — just keep the ring as decoration, name label is still visible
    });

    group.userData.isBillboard = true;
    this.photoCache[id] = group;
    return group;
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    return Math.abs(hash);
  }

  // ── Player interaction ──────────────────────────────────────────────────
  setTalkingToPlayer(charId) {
    const char = this.characters.find(c => c.data.id === charId);
    if (char) {
      char.state = 'talking_to_player';
      char.walkTarget = null;
      // Release any converse partner
      if (char.conversePartner) {
        const partner = this.characters.find(c => c.data.id === char.conversePartner);
        if (partner && partner.state === 'conversing') {
          partner.state = 'idle';
          partner.stateTimer = randRange(IDLE_MIN, IDLE_MAX);
          partner.conversePartner = null;
        }
        char.conversePartner = null;
      }
    }
  }

  releaseTalkingToPlayer(charId) {
    const char = this.characters.find(c => c.data.id === charId);
    if (char && char.state === 'talking_to_player') {
      char.state = 'idle';
      char.stateTimer = randRange(IDLE_MIN, IDLE_MAX);
    }
  }

  // ── Update loop ────────────────────────────────────────────────────────────
  update(playerPosition, time, camera, delta) {
    this.playerPosition.copy(playerPosition);
    const dt = delta || (1 / 60);

    for (const char of this.characters) {
      // Idle bob (subtle)
      const isMoving = char.state === 'walking';
      if (!isMoving) {
        char.group.position.y = char.baseY + Math.sin(time * 1.5 + char.idleOffset) * 0.02;
      }

      // Visibility
      const dist = this.playerPosition.distanceTo(char.group.position);
      char.nameSprite.visible = dist < NAME_VISIBLE_DISTANCE;
      if (char.data._titleSprite) char.data._titleSprite.visible = dist < NAME_VISIBLE_DISTANCE * 0.6;

      // Billboard faces camera
      if (char.billboard && camera) {
        char.billboard.lookAt(camera.position);
      }

      // Skip behavior for Lenny (he stays at the desk)
      if (char.data.isHost) {
        // Lenny still faces player when close
        if (dist < INTERACTION_DISTANCE * 1.5) {
          this.smoothFaceTarget(char, this.playerPosition);
        }
        continue;
      }

      // ── State machine ──────────────────────────────────────────────
      switch (char.state) {
        case 'talking_to_player':
          // Face the player, stand still, reset limbs
          this.smoothFaceTarget(char, this.playerPosition);
          this.resetLimbs(char);
          break;

        case 'idle':
          this.resetLimbs(char);
          // Face player if very close
          if (dist < INTERACTION_DISTANCE * 1.5) {
            this.smoothFaceTarget(char, this.playerPosition);
          }
          char.stateTimer -= dt;
          if (char.stateTimer <= 0) {
            this.pickNextBehavior(char);
          }
          break;

        case 'walking':
          if (char.walkTarget) {
            // Move toward target
            const dx = char.walkTarget.x - char.group.position.x;
            const dz = char.walkTarget.z - char.group.position.z;
            const distToTarget = Math.sqrt(dx * dx + dz * dz);

            if (distToTarget < 0.3) {
              // Arrived
              char.state = 'idle';
              char.stateTimer = randRange(IDLE_MIN, IDLE_MAX);
              char.walkTarget = null;
              this.resetLimbs(char);
            } else {
              // Walk
              const targetAngle = Math.atan2(dx, dz);
              this.smoothFaceAngle(char, targetAngle);
              const speed = NPC_WALK_SPEED * dt;
              char.group.position.x += (dx / distToTarget) * speed;
              char.group.position.z += (dz / distToTarget) * speed;
              // Walk animation
              this.animateWalk(char, time);
            }
          }
          char.stateTimer -= dt;
          if (char.stateTimer <= 0) {
            // Timed out walking — stop
            char.state = 'idle';
            char.stateTimer = randRange(IDLE_MIN, IDLE_MAX);
            char.walkTarget = null;
            this.resetLimbs(char);
          }
          break;

        case 'conversing':
          this.resetLimbs(char);
          // Face the partner
          const partner = this.characters.find(c => c.data.id === char.conversePartner);
          if (partner) {
            this.smoothFaceTarget(char, partner.group.position);
          }
          char.stateTimer -= dt;
          if (char.stateTimer <= 0) {
            char.state = 'idle';
            char.stateTimer = randRange(IDLE_MIN, IDLE_MAX);
            // Also release partner
            if (partner && partner.state === 'conversing' && partner.conversePartner === char.data.id) {
              partner.state = 'idle';
              partner.stateTimer = randRange(IDLE_MIN, IDLE_MAX);
              partner.conversePartner = null;
            }
            char.conversePartner = null;
          }
          break;
      }
    }

    // Process spawn/despawn animations
    this.processAnimations(time);
  }

  // ── Behavior selection ─────────────────────────────────────────────────────
  pickNextBehavior(char) {
    const roll = Math.random();

    // 40% chance: walk to a random nearby point
    if (roll < 0.4) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * WANDER_RADIUS;
      const target = new THREE.Vector3(
        char.spawnPos.x + Math.cos(angle) * dist,
        char.baseY,
        char.spawnPos.z + Math.sin(angle) * dist
      );
      // Clamp to lounge bounds (keep 2 units from walls)
      target.x = Math.max(-18, Math.min(18, target.x));
      target.z = Math.max(-13, Math.min(13, target.z));
      char.walkTarget = target;
      char.state = 'walking';
      char.stateTimer = randRange(WALK_DURATION_MIN, WALK_DURATION_MAX);
      return;
    }

    // 30% chance: try to converse with a nearby NPC
    if (roll < 0.7) {
      const nearby = this.characters.filter(c =>
        c !== char &&
        !c.data.isHost &&
        c.state === 'idle' &&
        c.group.position.distanceTo(char.group.position) < CONVERSE_DISTANCE * 2
      );
      if (nearby.length > 0) {
        const partner = nearby[Math.floor(Math.random() * nearby.length)];
        const duration = randRange(CONVERSE_DURATION_MIN, CONVERSE_DURATION_MAX);
        char.state = 'conversing';
        char.stateTimer = duration;
        char.conversePartner = partner.data.id;
        partner.state = 'conversing';
        partner.stateTimer = duration;
        partner.conversePartner = char.data.id;
        return;
      }
    }

    // Otherwise: just idle again
    char.state = 'idle';
    char.stateTimer = randRange(IDLE_MIN, IDLE_MAX);
  }

  // ── Animation helpers ──────────────────────────────────────────────────────
  animateWalk(char, time) {
    const cycle = Math.sin(time * 8 + char.idleOffset) * 0.3;
    if (char.legs.left) char.legs.left.rotation.x = cycle;
    if (char.legs.right) char.legs.right.rotation.x = -cycle;
    if (char.arms.left) char.arms.left.rotation.x = -cycle * 0.5;
    if (char.arms.right) char.arms.right.rotation.x = cycle * 0.5;
    // Subtle bounce
    char.group.position.y = char.baseY + Math.abs(Math.sin(time * 8 + char.idleOffset)) * 0.03;
  }

  resetLimbs(char) {
    if (char.legs.left) char.legs.left.rotation.x = 0;
    if (char.legs.right) char.legs.right.rotation.x = 0;
    if (char.arms.left) char.arms.left.rotation.x = 0;
    if (char.arms.right) char.arms.right.rotation.x = 0;
  }

  smoothFaceTarget(char, targetPos) {
    const dx = targetPos.x - char.group.position.x;
    const dz = targetPos.z - char.group.position.z;
    const targetAngle = Math.atan2(dx, dz);
    this.smoothFaceAngle(char, targetAngle);
  }

  smoothFaceAngle(char, targetAngle) {
    let diff = targetAngle - char.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    char.group.rotation.y += diff * 0.08;
  }

  processAnimations() {
    const dt = 1 / 60; // Approximate frame time
    const toRemove = [];

    for (let i = 0; i < this.animations.length; i++) {
      const anim = this.animations[i];

      if (anim.type === 'spawn') {
        anim.progress += dt / 0.5; // 0.5s duration
        if (anim.progress >= 1) {
          anim.group.scale.set(1, 1, 1);
          toRemove.push(i);
        } else {
          const t = easeOutBack(anim.progress);
          anim.group.scale.set(t, t, t);
        }
      } else if (anim.type === 'despawn') {
        anim.progress += dt / 0.3; // 0.3s duration
        if (anim.progress >= 1) {
          anim.group.scale.set(0, 0, 0);
          if (anim.onComplete) anim.onComplete();
          toRemove.push(i);
        } else {
          const t = 1 - anim.progress;
          anim.group.scale.set(t, t, t);
        }
      }
    }

    // Remove completed animations (reverse order to preserve indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.animations.splice(toRemove[i], 1);
    }
  }

  // ── Get nearest interactable character ─────────────────────────────────────
  getNearestInteractable(playerPosition) {
    let nearest = null;
    let nearestDist = INTERACTION_DISTANCE;
    for (const char of this.characters) {
      const dist = playerPosition.distanceTo(char.group.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = char.data;
      }
    }
    return nearest;
  }

  // ── Get positions for minimap ──────────────────────────────────────────────
  getGuestPositions() {
    return this.characters.map(c => ({
      x: c.group.position.x,
      z: c.group.position.z,
      isHost: !!c.data.isHost
    }));
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────
function randRange(min, max) {
  return min + Math.random() * (max - min);
}

// ── Easing functions ──────────────────────────────────────────────────────────
function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ── Accessory creation ────────────────────────────────────────────────────────
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
