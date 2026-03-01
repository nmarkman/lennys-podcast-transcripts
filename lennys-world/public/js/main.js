import * as THREE from 'three';
import { buildWorld } from './world.js';
import { CharacterManager } from './characters.js';
import { Player } from './player.js';
import { DialogueSystem } from './dialogue.js';
import { Minimap } from './minimap.js';

// ── State ─────────────────────────────────────────────────────────────────────
let renderer, scene, camera, clock;
let player, characterManager, dialogue, minimap;
let worldData;
let gameStarted = false;
let spawnedGuestIds = new Set();

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

  ctx.fillStyle = selectedShirtColor;
  ctx.beginPath();
  ctx.roundRect(cx - 18, cy - 5, 36, 40, 5);
  ctx.fill();

  ctx.fillStyle = '#FDDBB4';
  ctx.beginPath();
  ctx.arc(cx, cy - 18, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2C1810';
  ctx.beginPath();
  ctx.arc(cx, cy - 22, 17, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2a2a4a';
  ctx.fillRect(cx - 12, cy + 35, 10, 20);
  ctx.fillRect(cx + 2, cy + 35, 10, 20);

  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(cx - 6, cy - 18, 2, 0, Math.PI * 2);
  ctx.arc(cx + 6, cy - 18, 2, 0, Math.PI * 2);
  ctx.fill();

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

playerNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startBtn.click();
});

// ── Loading ───────────────────────────────────────────────────────────────────
function setLoadingProgress(pct, status) {
  document.getElementById('loading-fill').style.width = `${pct}%`;
  document.getElementById('loading-status').textContent = status;
}

async function initGame(playerName, shirtColor) {
  setLoadingProgress(10, 'Setting up studio...');

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

  setLoadingProgress(30, 'Building podcast lounge...');

  // Build lounge world (no character data needed)
  worldData = buildWorld(scene);

  setLoadingProgress(50, 'Loading photo data...');

  // Fetch photo map (lightweight, optional)
  let photoMap = {};
  try {
    const photoRes = await fetch('/data/photo-map.json');
    if (photoRes.ok) photoMap = await photoRes.json();
  } catch {
    // Photo map is optional
  }

  setLoadingProgress(60, 'Fetching host data...');

  // Fetch Lenny's character data
  let lennyData;
  try {
    const lennyRes = await fetch('/api/characters/lenny');
    lennyData = await lennyRes.json();
  } catch (err) {
    setLoadingProgress(0, `Error loading Lenny: ${err.message}`);
    return;
  }

  setLoadingProgress(75, 'Preparing the studio...');

  // Create character manager with spawn points
  characterManager = new CharacterManager(scene, worldData.SPAWN_POINTS);
  characterManager.setPhotoMap(photoMap);

  // Spawn only Lenny at podcast desk
  characterManager.spawnLenny(worldData.lennyPosition, lennyData);

  setLoadingProgress(85, 'Setting up player...');

  // Create player at lounge entrance
  player = new Player(scene, camera, shirtColor, worldData.wallBoxes);
  // Override default position to lounge entrance
  player.group.position.set(0, 0, 12);

  // Dialogue system
  dialogue = new DialogueSystem();
  dialogue.photoMap = photoMap;
  dialogue.onOpen = () => {
    player.dialogueOpen = true;
    if (dialogue.currentGuest) {
      characterManager.setTalkingToPlayer(dialogue.currentGuest.id);
    }
  };
  dialogue.onClose = () => {
    if (dialogue.currentGuest) {
      characterManager.releaseTalkingToPlayer(dialogue.currentGuest.id);
    }
    player.dialogueOpen = false;
  };

  // Wire recommendation → spawn pipeline
  dialogue.onGuestsRecommended = async (recommendations) => {
    const ids = recommendations.map(r => r.id);
    try {
      const res = await fetch('/api/characters/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (res.ok) {
        const chars = await res.json();
        characterManager.spawnGuests(chars);
        // Track spawned IDs so Lenny doesn't re-recommend
        for (const id of ids) spawnedGuestIds.add(id);
        dialogue.spawnedGuestIds = [...spawnedGuestIds];
        // Update guest counter
        updateGuestCounter();
      }
    } catch (err) {
      console.error('Failed to load recommended guests:', err);
    }
  };

  // Minimap
  minimap = new Minimap(worldData.LOUNGE_WIDTH, worldData.LOUNGE_DEPTH);

  setLoadingProgress(95, 'Almost ready...');

  // Interact key handler
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
  updateGuestCounter();

  setLoadingProgress(100, 'Welcome!');

  // Hide loading, show game
  setTimeout(() => {
    loadingScreen.style.display = 'none';
    gameUI.style.display = 'block';
    gameStarted = true;
    animate();
  }, 500);
}

function updateGuestCounter() {
  const count = characterManager ? characterManager.characters.filter(c => !c.data.isHost).length : 0;
  document.getElementById('guest-counter').textContent =
    count === 0 ? 'Talk to Lenny to meet guests' : `${count} guest${count !== 1 ? 's' : ''} in the lounge`;
}

// ── Game Loop ─────────────────────────────────────────────────────────────────
function animate() {
  if (!gameStarted) return;
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  // Update player
  player.update(delta, time);

  // Update characters (proximity checks, idle animation, billboard facing)
  characterManager.update(player.position, time, camera, delta);

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
  minimap.setGuestPositions(characterManager.getGuestPositions());
  minimap.update(player.position);

  // Render
  renderer.render(scene, camera);
}
