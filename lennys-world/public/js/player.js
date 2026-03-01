import * as THREE from 'three';

const MOVE_SPEED = 10;
const ROTATE_SPEED = 2.5;

// Zoom levels: [distance, height, lookAhead]
// From first-person all the way out to far third-person
const ZOOM_MIN = 0;    // First person
const ZOOM_MAX = 14;   // Far third person
const ZOOM_STEP = 1.5;
const ZOOM_LERP = 0.1; // Smooth interpolation speed

export class Player {
  constructor(scene, camera, shirtColor, wallBoxes = []) {
    this.scene = scene;
    this.camera = camera;
    this.group = new THREE.Group();
    this.velocity = new THREE.Vector3();
    this.rotation = 0; // Y-axis rotation
    this.keys = {};
    this.dialogueOpen = false;
    this.wallBoxes = wallBoxes;
    this.playerRadius = 0.5;

    // Zoom state
    this.zoomTarget = 12;  // Start at default third-person distance
    this.zoomCurrent = 12;

    // Build player mesh
    this.buildModel(shirtColor);

    // Position in lobby center
    this.group.position.set(0, 0, 5);
    this.scene.add(this.group);

    // Input handlers
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('wheel', this.onWheel, { passive: false });
  }

  buildModel(shirtColor) {
    // Same body structure as NPCs but slightly different proportions
    const torsoGeo = new THREE.CylinderGeometry(0.35, 0.3, 0.9, 8);
    const torsoMat = new THREE.MeshStandardMaterial({ color: shirtColor });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 1.15;
    torso.castShadow = true;
    this.group.add(torso);

    const headGeo = new THREE.SphereGeometry(0.28, 12, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: '#FDDBB4' });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.85;
    head.castShadow = true;
    this.group.add(head);

    const hairGeo = new THREE.SphereGeometry(0.3, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const hairMat = new THREE.MeshStandardMaterial({ color: '#2C1810' });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 1.9;
    this.group.add(hair);

    for (const side of [-0.12, 0.12]) {
      const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.7, 6);
      const legMat = new THREE.MeshStandardMaterial({ color: '#2a2a4a' });
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(side, 0.35, 0);
      leg.castShadow = true;
      this.group.add(leg);
      // Store for walk animation
      if (side < 0) this.leftLeg = leg;
      else this.rightLeg = leg;
    }

    for (const side of [-0.45, 0.45]) {
      const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6);
      const armMat = new THREE.MeshStandardMaterial({ color: '#FDDBB4' });
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.set(side, 1.0, 0);
      arm.rotation.z = side > 0 ? -0.15 : 0.15;
      this.group.add(arm);
      if (side < 0) this.leftArm = arm;
      else this.rightArm = arm;
    }

    // Player indicator (small floating arrow above head)
    const arrowGeo = new THREE.ConeGeometry(0.15, 0.3, 4);
    const arrowMat = new THREE.MeshStandardMaterial({
      color: shirtColor,
      emissive: shirtColor,
      emissiveIntensity: 0.5,
    });
    this.arrow = new THREE.Mesh(arrowGeo, arrowMat);
    this.arrow.position.y = 2.5;
    this.arrow.rotation.x = Math.PI; // Point downward
    this.group.add(this.arrow);
  }

  onKeyDown(e) {
    this.keys[e.key] = true;
    // Prevent arrow keys from scrolling
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }
  }

  onKeyUp(e) {
    this.keys[e.key] = false;
  }

  onWheel(e) {
    if (this.dialogueOpen) return;
    e.preventDefault();
    const direction = e.deltaY > 0 ? 1 : -1;
    this.zoomTarget = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.zoomTarget + direction * ZOOM_STEP));
  }

  update(delta, time) {
    if (this.dialogueOpen) return;

    const moveDir = new THREE.Vector3();
    let isMoving = false;

    // Rotation
    if (this.keys['ArrowLeft'] || this.keys['a']) {
      this.rotation += ROTATE_SPEED * delta;
    }
    if (this.keys['ArrowRight'] || this.keys['d']) {
      this.rotation -= ROTATE_SPEED * delta;
    }

    // Forward/backward
    if (this.keys['ArrowUp'] || this.keys['w']) {
      moveDir.x += Math.sin(this.rotation);
      moveDir.z += Math.cos(this.rotation);
      isMoving = true;
    }
    if (this.keys['ArrowDown'] || this.keys['s']) {
      moveDir.x -= Math.sin(this.rotation);
      moveDir.z -= Math.cos(this.rotation);
      isMoving = true;
    }

    if (moveDir.length() > 0) {
      moveDir.normalize().multiplyScalar(MOVE_SPEED * delta);
    }

    // Collision detection — try X and Z independently for wall sliding
    const newPos = this.group.position.clone().add(moveDir);
    const r = this.playerRadius;

    // Test X movement
    const testX = this.group.position.clone();
    testX.x = newPos.x;
    const boxX = new THREE.Box3(
      new THREE.Vector3(testX.x - r, 0, testX.z - r),
      new THREE.Vector3(testX.x + r, 3, testX.z + r)
    );
    let blockedX = false;
    for (const wall of this.wallBoxes) {
      if (boxX.intersectsBox(wall)) { blockedX = true; break; }
    }

    // Test Z movement
    const testZ = this.group.position.clone();
    testZ.z = newPos.z;
    const boxZ = new THREE.Box3(
      new THREE.Vector3(testZ.x - r, 0, testZ.z - r),
      new THREE.Vector3(testZ.x + r, 3, testZ.z + r)
    );
    let blockedZ = false;
    for (const wall of this.wallBoxes) {
      if (boxZ.intersectsBox(wall)) { blockedZ = true; break; }
    }

    if (!blockedX) this.group.position.x = newPos.x;
    if (!blockedZ) this.group.position.z = newPos.z;
    this.group.rotation.y = this.rotation;

    // Walk animation
    if (isMoving) {
      const walkCycle = Math.sin(time * 8) * 0.3;
      if (this.leftLeg) this.leftLeg.rotation.x = walkCycle;
      if (this.rightLeg) this.rightLeg.rotation.x = -walkCycle;
      if (this.leftArm) this.leftArm.rotation.x = -walkCycle * 0.5;
      if (this.rightArm) this.rightArm.rotation.x = walkCycle * 0.5;
    } else {
      // Reset to idle
      if (this.leftLeg) this.leftLeg.rotation.x = 0;
      if (this.rightLeg) this.rightLeg.rotation.x = 0;
      if (this.leftArm) this.leftArm.rotation.x = 0;
      if (this.rightArm) this.rightArm.rotation.x = 0;
    }

    // Floating arrow animation
    this.arrow.position.y = 2.5 + Math.sin(time * 3) * 0.1;

    // Update camera - third person behind player
    this.updateCamera();
  }

  updateCamera() {
    // Smoothly interpolate zoom
    this.zoomCurrent += (this.zoomTarget - this.zoomCurrent) * ZOOM_LERP;

    const dist = this.zoomCurrent;
    const t = dist / ZOOM_MAX; // 0 = first person, 1 = max zoom out

    // Interpolate camera parameters based on zoom
    const camHeight = 1.8 + t * 6.2;        // 1.8 (eye level) → 8.0
    const camDistance = dist;                 // 0 → ZOOM_MAX
    const lookAhead = t * 4;                 // 0 → 4

    const behind = new THREE.Vector3(
      -Math.sin(this.rotation) * camDistance,
      camHeight,
      -Math.cos(this.rotation) * camDistance
    );

    const targetCamPos = this.group.position.clone().add(behind);
    this.camera.position.lerp(targetCamPos, 0.08);

    // Look target: at first person, look far ahead; at third person, look at player
    const lookAtY = 1.8 - t * 0.3; // Eye-level in first person, slightly lower in third
    const lookAt = this.group.position.clone().add(
      new THREE.Vector3(
        Math.sin(this.rotation) * (lookAhead + (1 - t) * 8),
        lookAtY,
        Math.cos(this.rotation) * (lookAhead + (1 - t) * 8)
      )
    );
    this.camera.lookAt(lookAt);

    // Hide player model when in first person (distance < 2)
    this.group.visible = dist > 2;
  }

  get position() {
    return this.group.position;
  }
}
