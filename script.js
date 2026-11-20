const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Elementos do DOM
const hud = document.getElementById('hud');
const scoreDisplay = document.getElementById('scoreDisplay');
const coinsDisplay = document.getElementById('coinsDisplay');
const powerupsBar = document.getElementById('powerups-bar');

const startScreen = document.getElementById('startScreen');
const startHighScoreEl = document.getElementById('startHighScore');
const startLastScoreEl = document.getElementById('startLastScore');
const startTotalCoinsEl = document.getElementById('startTotalCoins');
const showcaseNameEl = document.getElementById('showcaseName');
const showcaseDescEl = document.getElementById('showcaseDesc');
const showcaseActionBtn = document.getElementById('showcaseActionBtn');

const shopScreen = document.getElementById('shopScreen');
const shopCoinsDisplay = document.getElementById('shopCoinsDisplay');
const charactersGrid = document.getElementById('charactersGrid');

const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreEl = document.getElementById('finalScore');
const finalCoinsEl = document.getElementById('finalCoins');
const highScoreDisplay = document.getElementById('highScoreDisplay');
const gameOverTotalCoinsEl = document.getElementById('gameOverTotalCoins');
const newRecordBadge = document.getElementById('newRecordBadge');

// Personagens disponíveis na Loja
const CHARACTERS = [
  {
    id: 'leo',
    name: 'Leo',
    desc: 'Corredor clássico dos trilhos',
    price: 0,
    icon: '🧢',
    jacket: '#38bdf8',
    arms: '#0284c7',
    pants: '#1e293b',
    shoes: '#f8fafc',
    backpack: '#f43f5e',
    backpackAccent: '#fecdd3',
    skin: '#fde68a',
    headwear: 'cap',
    headColor: '#ef4444',
    trailRgb: '56, 189, 248'
  },
  {
    id: 'nina',
    name: 'Nina Skater',
    desc: 'Estilo urbano e fones neon',
    price: 150,
    icon: '🎧',
    jacket: '#a855f7',
    arms: '#7e22ce',
    pants: '#18181b',
    shoes: '#f472b6',
    backpack: '#facc15',
    backpackAccent: '#fef08a',
    skin: '#fed7aa',
    headwear: 'headphones',
    headColor: '#ec4899',
    trailRgb: '192, 132, 252'
  },
  {
    id: 'cyber',
    name: 'Cyber-X',
    desc: 'Armadura robótica e visor LED',
    price: 350,
    icon: '🤖',
    jacket: '#0f172a',
    arms: '#334155',
    pants: '#020617',
    shoes: '#22d3ee',
    backpack: '#64748b',
    backpackAccent: '#22d3ee',
    skin: '#cbd5e1',
    headwear: 'visor',
    headColor: '#22d3ee',
    trailRgb: '34, 211, 238'
  },
  {
    id: 'ninja',
    name: 'Blaze Ninja',
    desc: 'Furtivo com katana nas costas',
    price: 600,
    icon: '🥷',
    jacket: '#18181b',
    arms: '#27272a',
    pants: '#09090b',
    shoes: '#ef4444',
    backpack: '#dc2626',
    backpackAccent: '#fca5a5',
    skin: '#fde68a',
    headwear: 'ninja',
    headColor: '#ef4444',
    trailRgb: '249, 115, 22'
  },
  {
    id: 'king',
    name: 'King Gold',
    desc: 'Traje real dourado com coroa',
    price: 1000,
    icon: '👑',
    jacket: '#eab308',
    arms: '#ca8a04',
    pants: '#3b0764',
    shoes: '#fef08a',
    backpack: '#7e22ce',
    backpackAccent: '#facc15',
    skin: '#fde68a',
    headwear: 'crown',
    headColor: '#fef08a',
    trailRgb: '250, 204, 21'
  }
];

// Progresso salvo no navegador (localStorage)
let highScore = parseInt(localStorage.getItem('metroRushHighScore') || '0', 10);
let lastScore = parseInt(localStorage.getItem('metroRushLastScore') || '0', 10);
let totalCoins = parseInt(localStorage.getItem('metroRushTotalCoins') || '0', 10);
let unlockedChars = ['leo'];
try {
  const saved = JSON.parse(localStorage.getItem('metroRushUnlockedChars'));
  if (Array.isArray(saved) && saved.length > 0) unlockedChars = saved;
} catch (e) {
  unlockedChars = ['leo'];
}
let selectedCharId = localStorage.getItem('metroRushSelectedChar') || 'leo';
if (!unlockedChars.includes(selectedCharId)) selectedCharId = 'leo';

let showcaseIndex = CHARACTERS.findIndex((c) => c.id === selectedCharId);
if (showcaseIndex < 0) showcaseIndex = 0;

function getActiveCharacter() {
  if (gameState === 'START') return CHARACTERS[showcaseIndex];
  return CHARACTERS.find((c) => c.id === selectedCharId) || CHARACTERS[0];
}

function saveProgress() {
  localStorage.setItem('metroRushHighScore', highScore);
  localStorage.setItem('metroRushLastScore', lastScore);
  localStorage.setItem('metroRushTotalCoins', totalCoins);
  localStorage.setItem('metroRushUnlockedChars', JSON.stringify(unlockedChars));
  localStorage.setItem('metroRushSelectedChar', selectedCharId);
}

// Áudio sintetizado
const AudioSys = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  playTone(freq, type, duration, vol = 0.12, slideTo = null) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },
  coin() { this.playTone(987.77, 'sine', 0.12, 0.11, 1318.5); },
  jump() { this.playTone(230, 'triangle', 0.22, 0.15, 540); },
  slide() { this.playTone(300, 'sawtooth', 0.18, 0.08, 110); },
  lane() { this.playTone(340, 'sine', 0.08, 0.08, 440); },
  bump() { this.playTone(170, 'triangle', 0.16, 0.16, 95); },
  powerup() { this.playTone(440, 'sine', 0.35, 0.15, 880); },
  buy() {
    this.playTone(523.25, 'sine', 0.14, 0.15, 783.99);
    setTimeout(() => this.playTone(1046.5, 'sine', 0.25, 0.15), 110);
  },
  error() { this.playTone(150, 'sawtooth', 0.18, 0.12, 110); },
  crash() { this.playTone(140, 'sawtooth', 0.45, 0.22, 40); }
};

function drawRoundRect(x, y, w, h, r) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function resizeCanvas() {
  const container = document.getElementById('game-container');
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Estado do Jogo
let gameState = 'START';
let score = 0;
let coins = 0;
let speed = 18.5;
let distanceTraveled = 0;
let lastTime = 0;
let shakeTimer = 0;

// Configuração da Câmera Dinâmica e Perspectiva 3D
const HORIZON_RATIO = 0.27;
const BASE_CAMERA_HEIGHT = 2.55;
const FOV = 300;
const LANE_WIDTH = 2.25;
const SPAWN_Z = 98;
const PLAYER_Z = 6.2;

const camera = {
  x: 0,
  y: BASE_CAMERA_HEIGHT
};

const player = {
  lane: 0,
  prevLane: 0,
  visualX: 0,
  tilt: 0,
  y: 0,
  vy: 0,
  groundY: 0,
  isJumping: false,
  isSliding: false,
  slideTimer: 0,
  magnetTimer: 0,
  sneakersTimer: 0,
  runCycle: 0,
  trail: []
};

let obstacles = [];
let collectibles = [];
let particles = [];
let spawnCooldown = 0;

// Atualiza a Tela Inicial e Vitrine
function updateStartUI() {
  startHighScoreEl.textContent = highScore;
  startLastScoreEl.textContent = lastScore;
  startTotalCoinsEl.textContent = totalCoins;

  const char = CHARACTERS[showcaseIndex];
  const isUnlocked = unlockedChars.includes(char.id);
  const isSelected = selectedCharId === char.id;

  showcaseNameEl.textContent = `${char.icon} ${char.name}`;
  showcaseDescEl.textContent = char.desc;

  showcaseActionBtn.className = 'showcase-action ';
  if (isSelected) {
    showcaseActionBtn.className += 'btn-equipped';
    showcaseActionBtn.textContent = 'Equipado ✓';
  } else if (isUnlocked) {
    showcaseActionBtn.className += 'btn-equip';
    showcaseActionBtn.textContent = 'Equipar';
  } else {
    showcaseActionBtn.className += totalCoins >= char.price ? 'btn-buy' : 'btn-buy too-expensive';
    showcaseActionBtn.textContent = `🪙 Comprar (${char.price})`;
  }
}

document.getElementById('prevCharBtn').addEventListener('click', () => {
  AudioSys.init();
  AudioSys.lane();
  showcaseIndex = (showcaseIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
  updateStartUI();
});

document.getElementById('nextCharBtn').addEventListener('click', () => {
  AudioSys.init();
  AudioSys.lane();
  showcaseIndex = (showcaseIndex + 1) % CHARACTERS.length;
  updateStartUI();
});

showcaseActionBtn.addEventListener('click', () => {
  AudioSys.init();
  const char = CHARACTERS[showcaseIndex];
  const isUnlocked = unlockedChars.includes(char.id);

  if (selectedCharId === char.id) return;

  if (isUnlocked) {
    selectedCharId = char.id;
    saveProgress();
    AudioSys.lane();
    updateStartUI();
  } else if (totalCoins >= char.price) {
    totalCoins -= char.price;
    unlockedChars.push(char.id);
    selectedCharId = char.id;
    saveProgress();
    AudioSys.buy();
    updateStartUI();
  } else {
    AudioSys.error();
    const box = document.querySelector('.char-showcase');
    box.classList.remove('shake-error');
    void box.offsetWidth;
    box.classList.add('shake-error');
  }
});

// Loja Completa
function openShop() {
  AudioSys.init();
  AudioSys.lane();
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  shopScreen.classList.remove('hidden');
  renderShop();
}

function closeShop() {
  AudioSys.lane();
  shopScreen.classList.add('hidden');
  showcaseIndex = Math.max(0, CHARACTERS.findIndex((c) => c.id === selectedCharId));
  startScreen.classList.remove('hidden');
  updateStartUI();
}

function renderShop() {
  shopCoinsDisplay.textContent = `🪙 ${totalCoins}`;
  charactersGrid.innerHTML = '';

  CHARACTERS.forEach((char, idx) => {
    const isUnlocked = unlockedChars.includes(char.id);
    const isSelected = selectedCharId === char.id;

    const card = document.createElement('div');
    card.className = `char-card ${isSelected ? 'selected' : ''}`;

    let btnClass = 'char-action-btn ';
    let btnText = '';
    if (isSelected) {
      btnClass += 'btn-equipped';
      btnText = 'Equipado ✓';
    } else if (isUnlocked) {
      btnClass += 'btn-equip';
      btnText = 'Equipar';
    } else {
      btnClass += totalCoins >= char.price ? 'btn-buy' : 'btn-buy too-expensive';
      btnText = `🪙 ${char.price}`;
    }

    card.innerHTML = `
      <div class="char-info">
        <div class="char-avatar" style="background: linear-gradient(135deg, ${char.jacket}, ${char.backpack});">
          ${char.icon}
        </div>
        <div>
          <div class="char-name">${char.name}</div>
          <div class="char-desc">${char.desc}</div>
        </div>
      </div>
      <button class="${btnClass}">${btnText}</button>
    `;

    card.querySelector('button').addEventListener('click', () => {
      AudioSys.init();
      if (isSelected) return;
      if (isUnlocked) {
        selectedCharId = char.id;
        showcaseIndex = idx;
        saveProgress();
        AudioSys.lane();
        renderShop();
      } else if (totalCoins >= char.price) {
        totalCoins -= char.price;
        unlockedChars.push(char.id);
        selectedCharId = char.id;
        showcaseIndex = idx;
        saveProgress();
        AudioSys.buy();
        renderShop();
      } else {
        AudioSys.error();
        card.classList.remove('shake-error');
        void card.offsetWidth;
        card.classList.add('shake-error');
      }
    });

    charactersGrid.appendChild(card);
  });
}

function resetGame() {
  score = 0;
  coins = 0;
  speed = 18.5;
  distanceTraveled = 0;
  shakeTimer = 0;

  camera.x = 0;
  camera.y = BASE_CAMERA_HEIGHT;

  player.lane = 0;
  player.prevLane = 0;
  player.visualX = 0;
  player.tilt = 0;
  player.y = 0;
  player.vy = 0;
  player.groundY = 0;
  player.isJumping = false;
  player.isSliding = false;
  player.slideTimer = 0;
  player.magnetTimer = 0;
  player.sneakersTimer = 0;
  player.trail = [];

  obstacles = [];
  collectibles = [];
  particles = [];
  spawnCooldown = 0;

  for (let z = 34; z <= 94; z += 24) {
    spawnWave(z);
  }
  updateHUD();
}

function startGame() {
  AudioSys.init();
  resetGame();
  gameState = 'PLAYING';
  startScreen.classList.add('hidden');
  shopScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function endGame() {
  if (gameState !== 'PLAYING') return;
  AudioSys.crash();
  shakeTimer = 0.38;
  gameState = 'GAMEOVER';

  hud.classList.add('hidden');
  powerupsBar.innerHTML = '';

  const finalPts = Math.floor(score);
  lastScore = finalPts;
  if (finalPts > highScore) {
    highScore = finalPts;
    newRecordBadge.textContent = '🏆 NOVO RECORDE!';
  } else {
    newRecordBadge.textContent = '';
  }

  totalCoins += coins;
  saveProgress();

  finalScoreEl.textContent = finalPts;
  highScoreDisplay.textContent = highScore;
  finalCoinsEl.textContent = `+${coins}`;
  gameOverTotalCoinsEl.textContent = totalCoins;
  gameOverScreen.classList.remove('hidden');
}

function backToMainMenu() {
  AudioSys.lane();
  resetGame();
  obstacles = [];
  collectibles = [];
  gameState = 'START';
  gameOverScreen.classList.add('hidden');
  shopScreen.classList.add('hidden');
  hud.classList.add('hidden');
  startScreen.classList.remove('hidden');
  showcaseIndex = Math.max(0, CHARACTERS.findIndex((c) => c.id === selectedCharId));
  updateStartUI();
}

// Controles
function moveLeft() {
  if (gameState !== 'PLAYING') return;
  if (player.lane > -1) {
    player.prevLane = player.lane;
    player.lane--;
    AudioSys.lane();
  }
}

function moveRight() {
  if (gameState !== 'PLAYING') return;
  if (player.lane < 1) {
    player.prevLane = player.lane;
    player.lane++;
    AudioSys.lane();
  }
}

function jump() {
  if (gameState !== 'PLAYING') return;
  if (!player.isJumping) {
    player.vy = player.sneakersTimer > 0 ? 15.8 : 12.2;
    player.isJumping = true;
    player.isSliding = false;
    AudioSys.jump();
    spawnDust(player.visualX * LANE_WIDTH, player.y, '#38bdf8', 10);
  }
}

function slide() {
  if (gameState !== 'PLAYING') return;
  if (player.isJumping) player.vy = -25;
  player.isSliding = true;
  player.slideTimer = 0.65;
  AudioSys.slide();
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveLeft();
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveRight();
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') jump();
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') slide();
});

let touchStartX = 0;
let touchStartY = 0;
canvas.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
  if (!e.changedTouches.length) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) moveRight();
    else moveLeft();
  } else {
    if (dy < 0) jump();
    else slide();
  }
}, { passive: true });

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('openShopBtn').addEventListener('click', openShop);
document.getElementById('gameOverShopBtn').addEventListener('click', openShop);
document.getElementById('closeShopBtn').addEventListener('click', closeShop);
document.getElementById('backToMenuBtn').addEventListener('click', backToMainMenu);

function spawnWave(zPos) {
  const lanes = [-1, 0, 1].sort(() => Math.random() - 0.5);
  const pattern = Math.random();

  if (pattern < 0.36) {
    obstacles.push({
      type: 'train',
      lane: lanes[0],
      z: zPos,
      length: 14,
      height: 2.3,
      color: '#f43f5e',
      stripe: '#fda4af'
    });
    obstacles.push({
      type: 'ramp_train',
      lane: lanes[1],
      z: zPos,
      length: 15,
      height: 2.3,
      color: '#f59e0b'
    });
    for (let i = 0; i < 5; i++) {
      collectibles.push({ type: 'coin', lane: lanes[1], z: zPos + 3.5 + i * 2.1, y: 2.75 });
    }
    spawnCoinLine(lanes[2], zPos, 4, 0.65);
  } else if (pattern < 0.72) {
    obstacles.push({ type: 'low_barrier', lane: lanes[0], z: zPos, length: 0.7, height: 0.95 });
    obstacles.push({ type: 'high_barrier', lane: lanes[1], z: zPos, length: 0.7, height: 2.35, clearance: 1.15 });
    spawnCoinLine(lanes[2], zPos, 5, 0.65);
  } else {
    obstacles.push({
      type: 'train',
      lane: lanes[0],
      z: zPos,
      length: 13,
      height: 2.3,
      color: '#3b82f6',
      stripe: '#93c5fd'
    });
    obstacles.push({
      type: 'train',
      lane: lanes[1],
      z: zPos + 3.5,
      length: 13,
      height: 2.3,
      color: '#10b981',
      stripe: '#6ee7b7'
    });
    obstacles.push({ type: 'low_barrier', lane: lanes[2], z: zPos + 2, length: 0.7, height: 0.95 });
    for (let i = -2; i <= 2; i++) {
      collectibles.push({ type: 'coin', lane: lanes[2], z: zPos + 2 + i * 1.6, y: 1.85 - Math.abs(i) * 0.35 });
    }
  }

  if (Math.random() < 0.24) {
    const puLane = lanes[Math.floor(Math.random() * 3)];
    collectibles.push({
      type: Math.random() < 0.5 ? 'magnet' : 'sneakers',
      lane: puLane,
      z: zPos + 9.5,
      y: 0.85
    });
  }
}

function spawnCoinLine(lane, startZ, count, y) {
  for (let i = 0; i < count; i++) {
    collectibles.push({ type: 'coin', lane, z: startZ + i * 2.3, y });
  }
}

function spawnDust(x, y, color, amount) {
  for (let i = 0; i < amount; i++) {
    particles.push({
      x,
      y,
      z: PLAYER_Z,
      vx: (Math.random() - 0.5) * 4.5,
      vy: Math.random() * 4.5 + 1,
      life: 0.42 + Math.random() * 0.2,
      color
    });
  }
}

function project(x, y, z) {
  const safeZ = Math.max(0.5, z);
  const scale = FOV / safeZ;
  const horizonY = canvas.height * HORIZON_RATIO;
  return {
    x: canvas.width / 2 + (x - camera.x) * scale,
    y: horizonY + (camera.y - y) * scale,
    scale
  };
}

function update(dt) {
  speed = Math.min(36, speed + dt * 0.32);
  const dz = speed * dt;
  distanceTraveled += dz;
  score += dz * 1.5;

  if (shakeTimer > 0) shakeTimer -= dt;

  const laneDiff = player.lane - player.visualX;
  player.visualX += laneDiff * Math.min(1, dt * 18);
  player.tilt += (laneDiff * 0.35 - player.tilt) * Math.min(1, dt * 15);
  player.runCycle += dt * (speed * 0.72);

  player.trail.push({ x: player.visualX * LANE_WIDTH, y: player.y + 0.08, alpha: 0.5 });
  if (player.trail.length > 9) player.trail.shift();
  for (const t of player.trail) t.alpha *= 0.86;

  if (player.slideTimer > 0) {
    player.slideTimer -= dt;
    if (player.slideTimer <= 0) player.isSliding = false;
  }
  if (player.magnetTimer > 0) player.magnetTimer -= dt;
  if (player.sneakersTimer > 0) player.sneakersTimer -= dt;

  let currentFloor = 0;
  for (const obs of obstacles) {
    if ((obs.type === 'train' || obs.type === 'ramp_train') && Math.abs(obs.lane - player.visualX) < 0.58) {
      if (PLAYER_Z >= obs.z - 0.4 && PLAYER_Z <= obs.z + obs.length + 0.4) {
        if (obs.type === 'ramp_train' && PLAYER_Z < obs.z + 4.8) {
          const prog = Math.max(0, Math.min(1, (PLAYER_Z - obs.z) / 4.8));
          currentFloor = Math.max(currentFloor, prog * obs.height);
        } else if (player.y >= obs.height - 0.4) {
          currentFloor = Math.max(currentFloor, obs.height);
        }
      }
    }
  }
  player.groundY = currentFloor;

  if (player.y > player.groundY || player.vy > 0) {
    player.y += player.vy * dt;
    player.vy -= 33 * dt;
    if (player.y <= player.groundY) {
      player.y = player.groundY;
      player.vy = 0;
      player.isJumping = false;
    }
  } else {
    player.y = player.groundY;
    player.isJumping = false;
  }

  // Câmera acompanha suavemente o personagem ao subir nos metrôs e pular
  const airHeight = Math.max(0, player.y - player.groundY);
  const targetCamY = BASE_CAMERA_HEIGHT + player.groundY * 0.92 + airHeight * 0.45;
  const targetCamX = player.visualX * LANE_WIDTH * 0.35;
  camera.y += (targetCamY - camera.y) * Math.min(1, dt * 8.5);
  camera.x += (targetCamX - camera.x) * Math.min(1, dt * 10);

  const playerTop = player.y + (player.isSliding ? 0.72 : 1.65);

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.z -= dz;
    const laneDist = Math.abs(obs.lane - player.visualX);

    if (obs.type === 'train' || obs.type === 'ramp_train') {
      const hitZ = obs.z <= PLAYER_Z + 0.35 && obs.z + obs.length >= PLAYER_Z - 0.35;
      if (hitZ && laneDist < 0.56) {
        const onRamp = obs.type === 'ramp_train' && PLAYER_Z <= obs.z + 5.0;
        const onTop = player.y >= obs.height - 0.35;
        if (!onRamp && !onTop) {
          if (obs.z < PLAYER_Z - 0.25 && player.lane !== player.prevLane) {
            player.lane = player.prevLane;
            shakeTimer = 0.16;
            AudioSys.bump();
            spawnDust(player.visualX * LANE_WIDTH, player.y + 0.8, '#facc15', 8);
          } else {
            endGame();
            return;
          }
        }
      }
    } else if (obs.type === 'low_barrier') {
      const hitZ = obs.z <= PLAYER_Z + 0.3 && obs.z + obs.length >= PLAYER_Z - 0.3;
      if (hitZ && laneDist < 0.5 && player.y < obs.height - 0.12) {
        endGame();
        return;
      }
    } else if (obs.type === 'high_barrier') {
      const hitZ = obs.z <= PLAYER_Z + 0.3 && obs.z + obs.length >= PLAYER_Z - 0.3;
      if (hitZ && laneDist < 0.5 && player.y < obs.height && playerTop > obs.clearance) {
        endGame();
        return;
      }
    }

    if (obs.z + obs.length < 0.5) obstacles.splice(i, 1);
  }

  for (let i = collectibles.length - 1; i >= 0; i--) {
    const item = collectibles[i];
    item.z -= dz;

    if (item.type === 'coin' && player.magnetTimer > 0 && item.z < 28 && item.z > 2) {
      item.lane += (player.visualX - item.lane) * Math.min(1, dt * 11);
      item.y += (player.y + 0.85 - item.y) * Math.min(1, dt * 11);
      item.z += (PLAYER_Z - item.z) * Math.min(1, dt * 7);
    }

    if (
      Math.abs(item.lane - player.visualX) < 0.55 &&
      Math.abs(item.z - PLAYER_Z) < 1.25 &&
      Math.abs(item.y - (player.y + 0.75)) < 1.25
    ) {
      if (item.type === 'coin') {
        coins++;
        score += 25;
        AudioSys.coin();
        spawnDust(item.lane * LANE_WIDTH, item.y, '#facc15', 6);
      } else if (item.type === 'magnet') {
        player.magnetTimer = 10;
        AudioSys.powerup();
        spawnDust(item.lane * LANE_WIDTH, item.y, '#ef4444', 12);
      } else if (item.type === 'sneakers') {
        player.sneakersTimer = 10;
        AudioSys.powerup();
        spawnDust(item.lane * LANE_WIDTH, item.y, '#22c55e', 12);
      }
      collectibles.splice(i, 1);
      continue;
    }

    if (item.z < 0.5) collectibles.splice(i, 1);
  }

  spawnCooldown -= dz;
  if (spawnCooldown <= 0) {
    spawnWave(SPAWN_Z);
    spawnCooldown = 24 + Math.random() * 5;
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy -= 13 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  updateHUD();
}

function updateHUD() {
  scoreDisplay.textContent = Math.floor(score);
  coinsDisplay.textContent = coins;
  let pillsHTML = '';
  if (player.magnetTimer > 0) {
    pillsHTML += `<div class="powerup-pill" style="border-color:#ef4444;color:#fca5a5;">🧲 Ímã: ${player.magnetTimer.toFixed(1)}s</div>`;
  }
  if (player.sneakersTimer > 0) {
    pillsHTML += `<div class="powerup-pill" style="border-color:#22c55e;color:#86efac;">👟 Super Pulo: ${player.sneakersTimer.toFixed(1)}s</div>`;
  }
  powerupsBar.innerHTML = pillsHTML;
}

function draw() {
  ctx.save();
  if (shakeTimer > 0) {
    const mag = shakeTimer * 20;
    ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
  }

  const w = canvas.width;
  const h = canvas.height;
  const horizonY = h * HORIZON_RATIO;

  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, '#0284c7');
  skyGrad.addColorStop(0.6, '#38bdf8');
  skyGrad.addColorStop(1, '#bae6fd');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, horizonY);

  ctx.fillStyle = 'rgba(254, 249, 195, 0.72)';
  ctx.beginPath();
  ctx.arc(w * 0.76 - camera.x * 4, horizonY * 0.45, 34, 0, Math.PI * 2);
  ctx.fill();

  drawCitySkyline(w, horizonY);

  const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
  groundGrad.addColorStop(0, '#475569');
  groundGrad.addColorStop(0.3, '#334155');
  groundGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  drawSideWallsAndPoles();
  drawTracks();

  const char = getActiveCharacter();
  for (const t of player.trail) {
    const proj = project(t.x, t.y, PLAYER_Z);
    ctx.fillStyle = player.sneakersTimer > 0
      ? `rgba(34, 197, 94, ${t.alpha * 0.5})`
      : `rgba(${char.trailRgb}, ${t.alpha * 0.5})`;
    ctx.beginPath();
    ctx.ellipse(proj.x, proj.y, 0.34 * proj.scale, 0.11 * proj.scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const renderList = [];
  obstacles.forEach((o) => {
    const onTrain =
      (o.type === 'train' || o.type === 'ramp_train') &&
      Math.abs(o.lane - player.visualX) < 0.6 &&
      player.y >= o.height - 0.5 &&
      PLAYER_Z >= o.z - 0.5 &&
      PLAYER_Z <= o.z + o.length + 0.5;
    const onRamp =
      o.type === 'ramp_train' &&
      Math.abs(o.lane - player.visualX) < 0.6 &&
      PLAYER_Z >= o.z - 0.5 &&
      PLAYER_Z <= o.z + 5.2;

    renderList.push({ kind: 'obs', z: onTrain || onRamp ? PLAYER_Z + 0.5 : o.z, data: o });
  });
  collectibles.forEach((c) => renderList.push({ kind: 'item', z: c.z, data: c }));
  renderList.push({ kind: 'player', z: PLAYER_Z });
  renderList.sort((a, b) => b.z - a.z);

  for (const entry of renderList) {
    if (entry.kind === 'obs') drawObstacle(entry.data);
    else if (entry.kind === 'item') drawCollectible(entry.data);
    else if (entry.kind === 'player') drawPlayer(char);
  }

  for (const p of particles) {
    const proj = project(p.x, p.y, p.z);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, Math.max(2, 0.15 * proj.scale), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawCitySkyline(w, horizonY) {
  const parallax = -camera.x * 10;
  const buildings = [
    { x: -0.10, w: 0.13, h: 58, color: '#0369a1' },
    { x: 0.02, w: 0.13, h: 64, color: '#0369a1' },
    { x: 0.14, w: 0.11, h: 90, color: '#0284c7' },
    { x: 0.25, w: 0.14, h: 52, color: '#0369a1' },
    { x: 0.58, w: 0.13, h: 84, color: '#0284c7' },
    { x: 0.71, w: 0.12, h: 56, color: '#0369a1' },
    { x: 0.83, w: 0.15, h: 74, color: '#0284c7' },
    { x: 0.97, w: 0.14, h: 60, color: '#0369a1' }
  ];
  for (const b of buildings) {
    const bx = w * b.x + parallax;
    const bw = w * b.w;
    const by = horizonY - b.h;
    ctx.fillStyle = b.color;
    ctx.fillRect(bx, by, bw, b.h);
    ctx.fillStyle = 'rgba(224, 242, 254, 0.45)';
    for (let wy = by + 8; wy < horizonY - 8; wy += 12) {
      for (let wx = bx + 6; wx < bx + bw - 8; wx += 10) {
        if (Math.sin(wx * wy) > 0.1) ctx.fillRect(wx, wy, 4, 5);
      }
    }
  }
}

function drawSideWallsAndPoles() {
  for (const side of [-1, 1]) {
    const xWall = side * 1.65 * LANE_WIDTH;
    const nearB = project(xWall, 0, 1.5);
    const farB = project(xWall, 0, SPAWN_Z);
    const nearT = project(xWall, 1.1, 1.5);
    const farT = project(xWall, 1.1, SPAWN_Z);
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(nearB.x, nearB.y);
    ctx.lineTo(farB.x, farB.y);
    ctx.lineTo(farT.x, farT.y);
    ctx.lineTo(nearT.x, nearT.y);
    ctx.closePath();
    ctx.fill();
  }

  const poleSpacing = 16;
  const offset = distanceTraveled % poleSpacing;
  for (let z = 4; z < SPAWN_Z; z += poleSpacing) {
    const curZ = z - offset;
    if (curZ < 1.5) continue;
    for (const side of [-1, 1]) {
      const xPole = side * 1.72 * LANE_WIDTH;
      const base = project(xPole, 0, curZ);
      const top = project(xPole, 4.2, curZ);
      const pw = Math.max(2, 0.14 * base.scale);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(base.x - pw / 2, top.y, pw, base.y - top.y);
    }
  }
}

function drawTracks() {
  const lanes = [-1, 0, 1];
  const sleeperSpacing = 3.2;
  const offset = distanceTraveled % sleeperSpacing;

  ctx.fillStyle = '#5c4033';
  for (let z = 2; z < SPAWN_Z; z += sleeperSpacing) {
    const curZ = z - offset;
    if (curZ < 1.2) continue;
    for (const lane of lanes) {
      const cx = lane * LANE_WIDTH;
      const left = project(cx - 0.78, 0, curZ);
      const right = project(cx + 0.78, 0, curZ);
      ctx.fillRect(left.x, left.y, right.x - left.x, Math.max(1.5, 0.22 * left.scale));
    }
  }

  for (const lane of lanes) {
    const cx = lane * LANE_WIDTH;
    for (const railOffset of [-0.52, 0.52]) {
      const near = project(cx + railOffset, 0.03, 1.5);
      const far = project(cx + railOffset, 0.03, SPAWN_Z);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = Math.max(1.5, 0.09 * near.scale);
      ctx.beginPath();
      ctx.moveTo(near.x, near.y);
      ctx.lineTo(far.x, far.y);
      ctx.stroke();
    }
  }
}

function drawObstacle(obs) {
  const cx = obs.lane * LANE_WIDTH;
  const halfW = 0.84;
  const zFront = Math.max(1.2, obs.z);
  const zBack = Math.max(1.3, obs.z + obs.length);
  if (zBack <= 1.3) return;

  if (obs.type === 'train' || obs.type === 'ramp_train') {
    const h = obs.height;
    const frontH = obs.type === 'ramp_train' ? 0.12 : h;
    const fBL = project(cx - halfW, 0, zFront);
    const fBR = project(cx + halfW, 0, zFront);
    const fTL = project(cx - halfW, frontH, zFront);
    const fTR = project(cx + halfW, frontH, zFront);
    const bBL = project(cx - halfW, 0, zBack);
    const bBR = project(cx + halfW, 0, zBack);
    const bTL = project(cx - halfW, h, zBack);
    const bTR = project(cx + halfW, h, zBack);

    if (obs.lane < 0) {
      ctx.fillStyle = shadeColor(obs.color, -25);
      ctx.beginPath();
      ctx.moveTo(fBR.x, fBR.y);
      ctx.lineTo(bBR.x, bBR.y);
      ctx.lineTo(bTR.x, bTR.y);
      ctx.lineTo(fTR.x, fTR.y);
      ctx.closePath();
      ctx.fill();
      drawTrainSideWindows(cx + halfW, zFront, zBack, h);
    } else if (obs.lane > 0) {
      ctx.fillStyle = shadeColor(obs.color, -25);
      ctx.beginPath();
      ctx.moveTo(fBL.x, fBL.y);
      ctx.lineTo(bBL.x, bBL.y);
      ctx.lineTo(bTL.x, bTL.y);
      ctx.lineTo(fTL.x, fTL.y);
      ctx.closePath();
      ctx.fill();
      drawTrainSideWindows(cx - halfW, zFront, zBack, h);
    }

    ctx.fillStyle = obs.type === 'ramp_train' ? '#fbbf24' : '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(fTL.x, fTL.y);
    ctx.lineTo(fTR.x, fTR.y);
    ctx.lineTo(bTR.x, bTR.y);
    ctx.lineTo(bTL.x, bTL.y);
    ctx.closePath();
    ctx.fill();

    if (obs.type === 'ramp_train') {
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    if (obs.type === 'train' && obs.z >= 1.2) {
      ctx.fillStyle = obs.color;
      ctx.beginPath();
      ctx.moveTo(fBL.x, fBL.y);
      ctx.lineTo(fBR.x, fBR.y);
      ctx.lineTo(fTR.x, fTR.y);
      ctx.lineTo(fTL.x, fTL.y);
      ctx.closePath();
      ctx.fill();

      const wTL = project(cx - halfW * 0.74, h * 0.86, zFront);
      const wTR = project(cx + halfW * 0.74, h * 0.86, zFront);
      const wBL = project(cx - halfW * 0.74, h * 0.52, zFront);
      const wBR = project(cx + halfW * 0.74, h * 0.52, zFront);
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(wTL.x, wTL.y);
      ctx.lineTo(wTR.x, wTR.y);
      ctx.lineTo(wBR.x, wBR.y);
      ctx.lineTo(wBL.x, wBL.y);
      ctx.closePath();
      ctx.fill();

      const l1 = project(cx - halfW * 0.55, h * 0.2, zFront);
      const l2 = project(cx + halfW * 0.55, h * 0.2, zFront);
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(l1.x, l1.y, Math.max(2.5, 0.16 * l1.scale), 0, Math.PI * 2);
      ctx.arc(l2.x, l2.y, Math.max(2.5, 0.16 * l2.scale), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (obs.type === 'low_barrier') {
    const bl = project(cx - halfW, 0, zFront);
    const br = project(cx + halfW, 0, zFront);
    const tl = project(cx - halfW, obs.height, zFront);
    const tr = project(cx + halfW, obs.height, zFront);
    const postW = Math.max(3, 0.12 * bl.scale);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(bl.x, tl.y, postW, bl.y - tl.y);
    ctx.fillRect(br.x - postW, tr.y, postW, br.y - tr.y);

    const barH = (bl.y - tl.y) * 0.52;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(tl.x, tl.y, tr.x - tl.x, barH);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(tl.x + (tr.x - tl.x) * 0.22, tl.y, (tr.x - tl.x) * 0.56, barH);
  } else if (obs.type === 'high_barrier') {
    const bl = project(cx - halfW, 0, zFront);
    const br = project(cx + halfW, 0, zFront);
    const clL = project(cx - halfW, obs.clearance, zFront);
    const tl = project(cx - halfW, obs.height, zFront);
    const tr = project(cx + halfW, obs.height, zFront);
    const postW = Math.max(3, 0.12 * bl.scale);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(bl.x, tl.y, postW, bl.y - tl.y);
    ctx.fillRect(br.x - postW, tr.y, postW, br.y - tr.y);

    const panelH = clL.y - tl.y;
    ctx.fillStyle = '#f97316';
    ctx.fillRect(tl.x, tl.y, tr.x - tl.x, panelH);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(tl.x, tl.y, tr.x - tl.x, panelH);

    const midX = (tl.x + tr.x) / 2;
    const midY = tl.y + panelH * 0.55;
    const arrowSize = Math.min(panelH * 0.32, (tr.x - tl.x) * 0.16);
    ctx.beginPath();
    ctx.moveTo(midX - arrowSize, midY - arrowSize * 0.5);
    ctx.lineTo(midX, midY + arrowSize * 0.5);
    ctx.lineTo(midX + arrowSize, midY - arrowSize * 0.5);
    ctx.stroke();
  }
}

function drawTrainSideWindows(sideX, zFront, zBack, h) {
  ctx.fillStyle = '#bae6fd';
  for (let wz = zFront + 1.5; wz < zBack - 1.5; wz += 3.2) {
    const p1 = project(sideX, h * 0.78, wz);
    const p2 = project(sideX, h * 0.78, wz + 1.8);
    const p3 = project(sideX, h * 0.52, wz + 1.8);
    const p4 = project(sideX, h * 0.52, wz);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();
  }
}

function shadeColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

function drawCollectible(item) {
  if (item.z < 1.2) return;
  const now = performance.now();
  const bob = Math.sin(now * 0.006 + item.z) * 0.12;
  const proj = project(item.lane * LANE_WIDTH, item.y + bob, item.z);
  const radius = Math.max(4, 0.35 * proj.scale);

  if (item.type === 'coin') {
    const spin = Math.max(0.28, Math.abs(Math.cos(now * 0.005 + item.z * 0.4)));
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.ellipse(proj.x, proj.y, radius * spin, radius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = Math.max(1.5, radius * 0.18);
    ctx.stroke();
  } else {
    ctx.fillStyle = item.type === 'magnet' ? '#ef4444' : '#22c55e';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, radius * 1.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `bold ${Math.max(10, Math.floor(radius * 1.3))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.type === 'magnet' ? '🧲' : '👟', proj.x, proj.y);
  }
}

function drawPlayer(char) {
  const px = player.visualX * LANE_WIDTH;
  const idleBounce = gameState === 'START' ? Math.abs(Math.sin(performance.now() * 0.004)) * 0.08 : 0;
  const shadowProj = project(px, player.groundY + 0.02, PLAYER_Z);
  const bodyProj = project(px, player.y + idleBounce, PLAYER_Z);
  const scale = bodyProj.scale;

  const heightAboveGround = Math.max(0, player.y + idleBounce - player.groundY);
  const shadowScale = Math.max(0.45, 1 - heightAboveGround * 0.18);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.beginPath();
  ctx.ellipse(shadowProj.x, shadowProj.y, 0.46 * shadowProj.scale * shadowScale, 0.17 * shadowProj.scale * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(bodyProj.x, bodyProj.y);
  ctx.rotate(player.tilt);

  const heightFactor = player.isSliding ? 0.48 : 1.0;
  const bodyW = 0.64 * scale;
  const bodyH = 1.16 * scale * heightFactor;
  const swing = gameState === 'START' || player.isJumping ? 0 : Math.sin(player.runCycle) * 0.17 * scale;

  // Braços
  ctx.fillStyle = char.arms;
  drawRoundRect(-bodyW * 0.68, -bodyH * 0.92 - swing * 0.6, bodyW * 0.22, bodyH * 0.52, 6);
  ctx.fill();
  drawRoundRect(bodyW * 0.46, -bodyH * 0.92 + swing * 0.6, bodyW * 0.22, bodyH * 0.52, 6);
  ctx.fill();

  // Pernas
  ctx.fillStyle = char.pants;
  drawRoundRect(-bodyW * 0.4, -bodyH * 0.4 + swing, bodyW * 0.32, bodyH * 0.34, 5);
  ctx.fill();
  drawRoundRect(bodyW * 0.08, -bodyH * 0.4 - swing, bodyW * 0.32, bodyH * 0.34, 5);
  ctx.fill();

  // Tênis
  ctx.fillStyle = player.sneakersTimer > 0 ? '#22c55e' : char.shoes;
  drawRoundRect(-bodyW * 0.43, -bodyH * 0.12 + swing, bodyW * 0.38, bodyH * 0.14, 4);
  ctx.fill();
  drawRoundRect(bodyW * 0.05, -bodyH * 0.12 - swing, bodyW * 0.38, bodyH * 0.14, 4);
  ctx.fill();

  // Jaqueta
  ctx.fillStyle = char.jacket;
  drawRoundRect(-bodyW / 2, -bodyH, bodyW, bodyH * 0.68, 9);
  ctx.fill();

  // Katana se for Ninja
  if (char.id === 'ninja') {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = Math.max(3, 0.06 * scale);
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.35, -bodyH * 0.35);
    ctx.lineTo(bodyW * 0.48, -bodyH * 1.18);
    ctx.stroke();
  }

  // Mochila
  ctx.fillStyle = char.backpack;
  drawRoundRect(-bodyW * 0.34, -bodyH * 0.92, bodyW * 0.68, bodyH * 0.46, 7);
  ctx.fill();
  ctx.fillStyle = char.backpackAccent;
  ctx.fillRect(-bodyW * 0.22, -bodyH * 0.72, bodyW * 0.44, Math.max(2, 0.04 * scale));

  // Cabeça
  const headR = 0.28 * scale;
  const headY = -bodyH - headR * 0.72;
  ctx.fillStyle = char.skin;
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  // Acessórios da cabeça por personagem
  if (char.headwear === 'cap') {
    ctx.fillStyle = char.headColor;
    ctx.beginPath();
    ctx.arc(0, headY - headR * 0.12, headR * 1.06, Math.PI, 0);
    ctx.fill();
    drawRoundRect(-headR * 0.55, headY - headR * 0.22, headR * 1.1, headR * 0.24, 4);
    ctx.fill();
  } else if (char.headwear === 'headphones') {
    ctx.strokeStyle = char.headColor;
    ctx.lineWidth = Math.max(3, 0.07 * scale);
    ctx.beginPath();
    ctx.arc(0, headY, headR * 1.05, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = char.headColor;
    ctx.fillRect(-headR * 1.2, headY - headR * 0.3, headR * 0.35, headR * 0.6);
    ctx.fillRect(headR * 0.85, headY - headR * 0.3, headR * 0.35, headR * 0.6);
  } else if (char.headwear === 'visor') {
    ctx.fillStyle = char.headColor;
    drawRoundRect(-headR * 0.9, headY - headR * 0.25, headR * 1.8, headR * 0.42, 4);
    ctx.fill();
  } else if (char.headwear === 'ninja') {
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.arc(0, headY, headR * 1.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = char.headColor;
    ctx.fillRect(-headR * 1.02, headY - headR * 0.35, headR * 2.04, headR * 0.28);
  } else if (char.headwear === 'crown') {
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(-headR * 0.8, headY - headR * 0.8);
    ctx.lineTo(-headR * 0.8, headY - headR * 1.45);
    ctx.lineTo(-headR * 0.3, headY - headR * 1.05);
    ctx.lineTo(0, headY - headR * 1.55);
    ctx.lineTo(headR * 0.3, headY - headR * 1.05);
    ctx.lineTo(headR * 0.8, headY - headR * 1.45);
    ctx.lineTo(headR * 0.8, headY - headR * 0.8);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function gameLoop(timestamp) {
  if (gameState === 'PLAYING') {
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;
    update(dt);
    draw();
  } else if (gameState === 'START') {
    draw();
  }
  requestAnimationFrame(gameLoop);
}

updateStartUI();
lastTime = performance.now();
requestAnimationFrame(gameLoop);
