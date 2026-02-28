import * as THREE from 'three';

const MOVE_SPEED = 10;
const ROTATE_SPEED = 2.5;
const CAMERA_HEIGHT = 8;
const CAMERA_DISTANCE = 12;
const CAMERA_LOOK_AHEAD = 4;

export class Player {
  constructor(scene, camera, shirtColor) {
    this.scene = scene;
    this.camera = camera;
    this.group = new THREE.Group();
    this.velocity = new THREE.Vector3();
    this.rotation = 0; // Y-axis rotation
    this.keys = {};
    this.dialogueOpen = false;

    // Build player mesh
    this.buildModel(shirtColor);

    // Position in lobby center
    this.group.position.set(0, 0, 5);
    this.scene.add(this.group);

    // Input handlers
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
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

    this.group.position.add(moveDir);
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
    const behind = new THREE.Vector3(
      -Math.sin(this.rotation) * CAMERA_DISTANCE,
      CAMERA_HEIGHT,
      -Math.cos(this.rotation) * CAMERA_DISTANCE
    );

    const targetCamPos = this.group.position.clone().add(behind);

    // Smooth camera follow
    this.camera.position.lerp(targetCamPos, 0.08);

    // Look at player + slightly ahead
    const lookAt = this.group.position.clone().add(
      new THREE.Vector3(
        Math.sin(this.rotation) * CAMERA_LOOK_AHEAD,
        1.5,
        Math.cos(this.rotation) * CAMERA_LOOK_AHEAD
      )
    );
    this.camera.lookAt(lookAt);
  }

  get position() {
    return this.group.position;
  }
}
