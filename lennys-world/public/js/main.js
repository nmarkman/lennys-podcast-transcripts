import * as THREE from 'three';
import { buildWorld, getCurrentRoom } from './world.js';
import { CharacterManager } from './characters.js';
import { Player } from './player.js';
import { DialogueSystem } from './dialogue.js';
import { Minimap } from './minimap.js';

// ── State ─────────────────────────────────────────────────────────────────────
let renderer, scene, camera, clock;
let player, characterManager, dialogue, minimap;
let worldData, characterData;
let gameStarted = false;

// ── Start Screen ──────────────────────────────────────────────────────────────
const startScreen = document.getElementById('start-screen');
const loadingScreen = document.getElementById('loading-screen');
const gameUI = document.getElementById('game-ui');
const startBtn = document.getElementById('start-btn');
const playerNameInput = document.getElementById('player-name');

let selectedShirtColor = '#4A90D9';

// Color picker
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedShirtColor = btn.dataset.color;
    drawAvatarPreview();
  });
});

// Avatar preview
function drawAvatarPreview() {
  const canvas = document.getElementById('avatar-preview-canvas');
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Body
  ctx.fillStyle = selectedShirtColor;
  ctx.beginPath();
  ctx.roundRect(cx - 18, cy - 5, 36, 40, 5);
  ctx.fill();

  // Head
  ctx.fillStyle = '#FDDBB4';
  ctx.beginPath();
  ctx.arc(cx, cy - 18, 16, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = '#2C1810';
  ctx.beginPath();
  ctx.arc(cx, cy - 22, 17, Math.PI, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.fillStyle = '#2a2a4a';
  ctx.fillRect(cx - 12, cy + 35, 10, 20);
  ctx.fillRect(cx + 2, cy + 35, 10, 20);

  // Eyes
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(cx - 6, cy - 18, 2, 0, Math.PI * 2);
  ctx.arc(cx + 6, cy - 18, 2, 0, Math.PI * 2);
  ctx.fill();

  // Smile
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy - 14, 6, 0.1, Math.PI - 0.1);
  ctx.stroke();
}

drawAvatarPreview();

// Start button
startBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim() || 'Explorer';
  startScreen.style.display = 'none';
  loadingScreen.style.display = 'flex';
  initGame(name, selectedShirtColor);
});

// Enter key on name input
playerNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startBtn.click();
});

// ── Loading ───────────────────────────────────────────────────────────────────
function setLoadingProgress(pct, status) {
  document.getElementById('loading-fill').style.width = `${pct}%`;
  document.getElementById('loading-status').textContent = status;
}

async function initGame(playerName, shirtColor) {
  setLoadingProgress(10, 'Fetching character data...');

  // Fetch character data
  try {
    const res = await fetch('/api/characters');
    characterData = await res.json();
  } catch (err) {
    setLoadingProgress(0, `Error: ${err.message}`);
    return;
  }

  setLoadingProgress(30, `Loaded ${characterData.totalCharacters} characters`);

  // Init Three.js
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
  clock = new THREE.Clock();

  setLoadingProgress(50, 'Building world...');

  // Build world
  const worldResult = buildWorld(scene, characterData.rooms);
  worldData = worldResult;

  setLoadingProgress(65, 'Placing characters...');

  // Create characters
  characterManager = new CharacterManager(scene);
  characterManager.createAllCharacters(characterData.characters, worldResult.roomMeta);

  setLoadingProgress(80, 'Setting up player...');

  // Create player
  player = new Player(scene, camera, shirtColor);

  // Dialogue system
  dialogue = new DialogueSystem();
  dialogue.onOpen = () => { player.dialogueOpen = true; };
  dialogue.onClose = () => { player.dialogueOpen = false; };

  // Minimap
  minimap = new Minimap(worldResult.roomMeta);

  setLoadingProgress(95, 'Almost ready...');

  // Listen for interact key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'e' || e.key === 'E') {
      if (dialogue.isOpen) return;
      const nearest = characterManager.getNearestInteractable(player.position);
      if (nearest) {
        dialogue.open(nearest);
      }
    }
  });

  // Window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Guest counter
  document.getElementById('guest-counter').textContent =
    `${characterData.totalCharacters} guests in the world`;

  setLoadingProgress(100, 'Welcome!');

  // Hide loading, show game
  setTimeout(() => {
    loadingScreen.style.display = 'none';
    gameUI.style.display = 'block';
    gameStarted = true;
    animate();
  }, 500);
}

// ── Game Loop ─────────────────────────────────────────────────────────────────
function animate() {
  if (!gameStarted) return;
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  // Update player
  player.update(delta, time);

  // Update characters (proximity checks, idle animation)
  characterManager.update(player.position, time);

  // Update room label
  const currentRoom = getCurrentRoom(player.position, worldData.roomMeta);
  const roomLabel = document.getElementById('room-label');
  if (currentRoom) {
    roomLabel.textContent = currentRoom.name;
    roomLabel.style.borderColor = currentRoom.color || 'rgba(255,255,255,0.1)';
  }

  // Update interact hint
  const hintEl = document.getElementById('interact-hint');
  const hintName = document.getElementById('hint-name');
  if (!dialogue.isOpen) {
    const nearest = characterManager.getNearestInteractable(player.position);
    if (nearest) {
      hintEl.style.display = 'block';
      hintName.textContent = nearest.name;
    } else {
      hintEl.style.display = 'none';
    }
  } else {
    hintEl.style.display = 'none';
  }

  // Update minimap
  minimap.update(player.position);

  // Render
  renderer.render(scene, camera);
}
