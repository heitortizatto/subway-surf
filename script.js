const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreDisplay = document.getElementById('scoreDisplay');
const coinsDisplay = document.getElementById('coinsDisplay');
const powerupsBar = document.getElementById('powerups-bar');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreEl = document.getElementById('finalScore');
const finalCoinsEl = document.getElementById('finalCoins');
const highScoreDisplay = document.getElementById('highScoreDisplay');
const newRecordBadge = document.getElementById('newRecordBadge');

// Sistema de Áudio Sintetizado (Web Audio API)
const AudioSys = {
  ctx: null,
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },
  playTone(freq, type, duration, vol = 0.12, slideTo = null) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
    }
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },
  coin() {
    this.playTone(987.77, 'sine', 0.11, 0.1, 1318.5);
  },
  jump() {
    this.playTone(230, 'triangle', 0.22, 0.14, 540);
  },
  slide() {
    this.playTone(300, 'sawtooth', 0.16, 0.08, 110);
  },
  lane() {
    this.playTone(340, 'sine', 0.07, 0.08, 440);
  },
  powerup() {
    this.playTone(440, 'sine', 0.35, 0.15, 880);
  },
  crash() {
    this.playTone(140, 'sawtooth', 0.45, 0.22, 40);
  }
};

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
let highScore = parseInt(localStorage.getItem('metroRushHighScore') || '0', 10);
let speed = 18;
let distanceTraveled = 0;
let lastTime = 0;
let shakeTimer = 0;

// Perspectiva 3D e Câmera
const HORIZON_RATIO = 0.25;
const CAMERA_BASE_HEIGHT = 2.55;
const FOV = 300;
const LANE_WIDTH = 2.25;
const SPAWN_Z = 98;
const PLAYER_Z = 6.2;

let cameraX = 0;
let cameraY = CAMERA_BASE_HEIGHT;

const player = {
  lane: 0,
  visualX: 0,
  lean: 0,
  y: 0,
  vy: 0,
  groundY: 0,
  isJumping: false,
  isSliding: false,
  slideTimer: 0,
  magnetTimer: 0,
  sneakersTimer: 0,
  runCycle: 0,
  squash: 1,
  trail: []
};

let obstacles = [];
let collectibles = [];
let particles = [];
let floatingTexts = [];
let spawnCooldown = 0;

function resetGame() {
  score = 0;
  coins = 0;
  speed = 18;
  distanceTraveled = 0;
  shakeTimer = 0;
  cameraX = 0;
  cameraY = CAMERA_BASE_HEIGHT;

  player.lane = 0;
  player.visualX = 0;
  player.lean = 0;
  player.y = 0;
  player.vy = 0;
  player.groundY = 0;
  player.isJumping = false;
  player.isSliding = false;
  player.slideTimer = 0;
  player.magnetTimer = 0;
  player.sneakersTimer = 0;
  player.squash = 1;
  player.trail = [];

  obstacles = [];
  collectibles = [];
  particles = [];
  floatingTexts = [];
  spawnCooldown = 0;

  for (let z = 34; z <= 96; z += 24) {
    spawnWave(z);
  }

  updateHUD();
}

function startGame() {
  AudioSys.init();
  resetGame();
  gameState = 'PLAYING';
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function endGame() {
  AudioSys.crash();
  shakeTimer = 0.35;
  gameState = 'GAMEOVER';

  const finalPts = Math.floor(score);
  if (finalPts > highScore) {
    highScore = finalPts;
    localStorage.setItem('metroRushHighScore', highScore);
    newRecordBadge.textContent = '🏆 NOVO RECORDE!';
  } else {
    newRecordBadge.textContent = '';
  }

  finalScoreEl.textContent = finalPts;
  highScoreDisplay.textContent = highScore;
  finalCoinsEl.textContent = coins;
  gameOverScreen.classList.remove('hidden');
}

function moveLeft() {
  if (gameState !== 'PLAYING') return;
  if (player.lane > -1) {
    player.lane--;
    player.lean = -0.35;
    AudioSys.lane();
  }
}

function moveRight() {
  if (gameState !== 'PLAYING') return;
  if (player.lane < 1) {
    player.lane++;
    player.lean = 0.35;
    AudioSys.lane();
  }
}

function jump() {
  if (gameState !== 'PLAYING') return;
  if (!player.isJumping) {
    const jumpPower = player.sneakersTimer > 0 ? 15.8 : 12.2;
    player.vy = jumpPower;
    player.isJumping = true;
    player.isSliding = false;
    player.slideTimer = 0;
    player.squash = 1.25;
    AudioSys.jump();
    spawnDust(player.visualX * LANE_WIDTH, player.y, '#38bdf8', 10);
  }
}

function slide() {
  if (gameState !== 'PLAYING') return;
  if (player.isJumping) {
    player.vy = -25;
  }
  player.isSliding = true;
  player.slideTimer = 0.62;
  player.squash = 0.65;
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
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (Math.max(absX, absY) < 22) return;

  if (absX > absY) {
    if (dx > 0) moveRight();
    else moveLeft();
  } else {
    if (dy < 0) jump();
    else slide();
  }
}, { passive: true });

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

const TRAIN_THEMES = [
  { main: '#ef4444', stripe: '#fef08a', roof: '#f8fafc' }, // Vermelho clássico
  { main: '#2563eb', stripe: '#38bdf8', roof: '#e2e8f0' }, // Azul expresso
  { main: '#059669', stripe: '#a7f3d0', roof: '#f1f5f9' }, // Verde metrô
  { main: '#7c3aed', stripe: '#f472b6', roof: '#f8fafc' }  // Roxo neon
];

function spawnWave(zPos) {
  const lanes = [-1, 0, 1];
  lanes.sort(() => Math.random() - 0.5);
  const pattern = Math.random();

  if (pattern < 0.36) {
    const trainLane = lanes[0];
    const rampLane = lanes[1];
    const freeLane = lanes[2];
    const theme = TRAIN_THEMES[Math.floor(Math.random() * TRAIN_THEMES.length)];

    obstacles.push({
      type: 'train',
      lane: trainLane,
      z: zPos,
      length: 14,
      height: 2.3,
      theme
    });

    obstacles.push({
      type: 'ramp_train',
      lane: rampLane,
      z: zPos,
      length: 15.5,
      height: 2.3,
      theme: { main: '#d97706', stripe: '#fde047', roof: '#fbbf24' }
    });

    for (let i = 0; i < 5; i++) {
      collectibles.push({
        type: 'coin',
        lane: rampLane,
        z: zPos + 4.5 + i * 2.1,
        y: 2.75
      });
    }

    spawnCoinLine(freeLane, zPos, 4, 0.65);
  } else if (pattern < 0.7) {
    obstacles.push({
      type: 'low_barrier',
      lane: lanes[0],
      z: zPos,
      length: 0.7,
      height: 0.95
    });

    obstacles.push({
      type: 'high_barrier',
      lane: lanes[1],
      z: zPos,
      length: 0.7,
      height: 2.45,
      clearance: 1.2
    });

    spawnCoinLine(lanes[2], zPos, 5, 0.65);
  } else {
    const t1 = TRAIN_THEMES[Math.floor(Math.random() * TRAIN_THEMES.length)];
    const t2 = TRAIN_THEMES[(TRAIN_THEMES.indexOf(t1) + 1) % TRAIN_THEMES.length];

    obstacles.push({
      type: 'train',
      lane: lanes[0],
      z: zPos,
      length: 13.5,
      height: 2.3,
      theme: t1
    });

    obstacles.push({
      type: 'train',
      lane: lanes[1],
      z: zPos + 2.5,
      length: 13.5,
      height: 2.3,
      theme: t2
    });

    obstacles.push({
      type: 'low_barrier',
      lane: lanes[2],
      z: zPos + 2,
      length: 0.7,
      height: 0.95
    });

    for (let i = -2; i <= 2; i++) {
      collectibles.push({
        type: 'coin',
        lane: lanes[2],
        z: zPos + 2 + i * 1.6,
        y: 1.85 - Math.abs(i) * 0.32
      });
    }
  }

  if (Math.random() < 0.22) {
    const puLane = lanes[Math.floor(Math.random() * 3)];
    const puType = Math.random() < 0.5 ? 'magnet' : 'sneakers';
    collectibles.push({
      type: puType,
      lane: puLane,
      z: zPos + 9,
      y: 0.85
    });
  }
}

function spawnCoinLine(lane, startZ, count, y) {
  for (let i = 0; i < count; i++) {
    collectibles.push({
      type: 'coin',
      lane,
      z: startZ + i * 2.3,
      y
    });
  }
}

function spawnDust(x, y, color, amount) {
  for (let i = 0; i < amount; i++) {
    particles.push({
      x,
      y,
      z: PLAYER_Z,
      vx: (Math.random() - 0.5) * 4.5,
      vy: Math.random() * 4.2 + 1,
      life: 0.42 + Math.random() * 0.2,
      color
    });
  }
}

function addFloatingText(text, x, y, color) {
  floatingTexts.push({
    text,
    x,
    y,
    z: PLAYER_Z,
    vy: 2.2,
    life: 0.75,
    color
  });
}

// Projeção 3D -> 2D com movimento suave de câmera
function project(x, y, z) {
  const safeZ = Math.max(0.5, z);
  const scale = FOV / safeZ;
  const horizonY = canvas.height * HORIZON_RATIO;
  const screenX = canvas.width / 2 + (x - cameraX) * scale;
  const screenY = horizonY + (cameraY - y) * scale;
  return { x: screenX, y: screenY, scale };
}

function update(dt) {
  speed = Math.min(36, speed + dt * 0.3);
  const dz = speed * dt;
  distanceTraveled += dz;
  score += dz * 1.5;

  if (shakeTimer > 0) shakeTimer -= dt;

  // Movimento lateral e inclinação suave
  const prevX = player.visualX;
  player.visualX += (player.lane - player.visualX) * Math.min(1, dt * 16);
  player.lean = (player.visualX - prevX) * 2.4;
  player.squash += (1 - player.squash) * Math.min(1, dt * 12);
  player.runCycle += dt * (speed * 0.68);

  // Câmera acompanha suavemente o jogador
  cameraX += (player.visualX * LANE_WIDTH * 0.36 - cameraX) * Math.min(1, dt * 8);
  cameraY += ((CAMERA_BASE_HEIGHT + player.y * 0.35) - cameraY) * Math.min(1, dt * 7);

  // Rastro sob os pés
  player.trail.push({
    x: player.visualX * LANE_WIDTH,
    y: player.y + 0.06,
    alpha: 0.55
  });
  if (player.trail.length > 9) player.trail.shift();
  for (const t of player.trail) t.alpha *= 0.86;

  if (player.slideTimer > 0) {
    player.slideTimer -= dt;
    if (player.slideTimer <= 0) player.isSliding = false;
  }
  if (player.magnetTimer > 0) player.magnetTimer -= dt;
  if (player.sneakersTimer > 0) player.sneakersTimer -= dt;

  // Altura do chão (suporte para correr no teto de trens e rampas)
  let currentFloor = 0;
  for (const obs of obstacles) {
    if (obs.type === 'train' || obs.type === 'ramp_train') {
      const inSameLane = Math.abs(obs.lane - player.visualX) < 0.46;
      if (inSameLane) {
        const frontZ = obs.z;
        const backZ = obs.z + obs.length;
        if (PLAYER_Z >= frontZ - 0.15 && PLAYER_Z <= backZ + 0.15) {
          if (obs.type === 'ramp_train' && PLAYER_Z <= frontZ + 5.0) {
            const rampProgress = Math.max(0, Math.min(1, (PLAYER_Z - frontZ) / 5.0));
            currentFloor = Math.max(currentFloor, rampProgress * obs.height);
          } else if (player.y >= obs.height - 0.35) {
            currentFloor = Math.max(currentFloor, obs.height);
          }
        }
      }
    }
  }
  player.groundY = currentFloor;

  // Gravidade e Pulo
  if (player.y > player.groundY || player.vy > 0) {
    player.y += player.vy * dt;
    player.vy -= 33 * dt;
    if (player.y <= player.groundY) {
      if (player.isJumping) player.squash = 0.78;
      player.y = player.groundY;
      player.vy = 0;
      player.isJumping = false;
    }
  } else {
    player.y = player.groundY;
    player.isJumping = false;
  }

  // Atualização de Obstáculos e Hitbox precisa (sem colisões fantasmas)
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.z -= dz;

    const inSameLane = Math.abs(obs.lane - player.visualX) < 0.42;
    const frontZ = obs.z;
    const backZ = obs.z + obs.length;
    const hitZ = frontZ <= PLAYER_Z + 0.12 && backZ >= PLAYER_Z + 0.15;

    if (inSameLane && hitZ) {
      if (obs.type === 'low_barrier') {
        if (player.y < obs.height - 0.18) {
          endGame();
          return;
        }
      } else if (obs.type === 'high_barrier') {
        const playerTop = player.y + (player.isSliding ? 0.72 : 1.65);
        if (!player.isSliding && player.y < obs.clearance - 0.1 && playerTop > obs.clearance + 0.1) {
          endGame();
          return;
        }
      } else if (obs.type === 'train') {
        if (player.y < obs.height - 0.28) {
          endGame();
          return;
        }
      } else if (obs.type === 'ramp_train') {
        if (PLAYER_Z > frontZ + 5.0 && player.y < obs.height - 0.28) {
          endGame();
          return;
        }
      }
    }

    if (obs.z + obs.length < 0.5) {
      obstacles.splice(i, 1);
    }
  }

  // Moedas e Power-ups
  for (let i = collectibles.length - 1; i >= 0; i--) {
    const item = collectibles[i];
    item.z -= dz;

    if (item.type === 'coin' && player.magnetTimer > 0 && item.z < 28 && item.z > 2) {
      item.lane += (player.visualX - item.lane) * Math.min(1, dt * 11);
      item.y += (player.y + 0.8 - item.y) * Math.min(1, dt * 11);
      item.z += (PLAYER_Z - item.z) * Math.min(1, dt * 7);
    }

    const distLane = Math.abs(item.lane - player.visualX);
    const distZ = Math.abs(item.z - PLAYER_Z);
    const distY = Math.abs(item.y - (player.y + 0.75));

    if (distLane < 0.55 && distZ < 1.25 && distY < 1.3) {
      const wx = item.lane * LANE_WIDTH;
      if (item.type === 'coin') {
        coins++;
        score += 25;
        AudioSys.coin();
        spawnDust(wx, item.y, '#facc15', 5);
        addFloatingText('+25', wx, item.y + 0.6, '#fde047');
      } else if (item.type === 'magnet') {
        player.magnetTimer = 10;
        AudioSys.powerup();
        spawnDust(wx, item.y, '#ef4444', 12);
        addFloatingText('ÍMÃ!', wx, item.y + 0.8, '#fca5a5');
      } else if (item.type === 'sneakers') {
        player.sneakersTimer = 10;
        AudioSys.powerup();
        spawnDust(wx, item.y, '#22c55e', 12);
        addFloatingText('SUPER PULO!', wx, item.y + 0.8, '#86efac');
      }
      collectibles.splice(i, 1);
      continue;
    }

    if (item.z < 0.5) {
      collectibles.splice(i, 1);
    }
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
    p.vy -= 12 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.y += ft.vy * dt;
    ft.life -= dt;
    if (ft.life <= 0) floatingTexts.splice(i, 1);
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
    const mag = shakeTimer * 22;
    ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
  }

  const w = canvas.width;
  const h = canvas.height;
  const horizonY = h * HORIZON_RATIO;

  // Céu vibrante estilo fim de tarde / pôr do sol
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, '#0c4a6e');
  skyGrad.addColorStop(0.5, '#0284c7');
  skyGrad.addColorStop(1, '#fb923c');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, horizonY);

  // Sol estilizado no horizonte
  const sunX = w * 0.5 - cameraX * 8;
  const sunGrad = ctx.createRadialGradient(sunX, horizonY * 0.78, 8, sunX, horizonY * 0.78, 75);
  sunGrad.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
  sunGrad.addColorStop(0.5, 'rgba(251, 146, 60, 0.45)');
  sunGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(sunX, horizonY * 0.78, 75, 0, Math.PI * 2);
  ctx.fill();

  drawCitySkyline(w, horizonY);

  // Chão dos trilhos
  const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
  groundGrad.addColorStop(0, '#334155');
  groundGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  drawSideWalls();
  drawTracks();

  // Rastro do jogador
  for (const t of player.trail) {
    const proj = project(t.x, t.y, PLAYER_Z);
    ctx.fillStyle = player.sneakersTimer > 0
      ? `rgba(34, 197, 94, ${t.alpha * 0.5})`
      : `rgba(56, 189, 248, ${t.alpha * 0.45})`;
    ctx.beginPath();
    ctx.ellipse(proj.x, proj.y, 0.34 * proj.scale, 0.12 * proj.scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ordenação de profundidade corrigida (sem atravessar objetos!)
  const renderList = [];
  obstacles.forEach((o) => {
    const isPlayerOnTop =
      (o.type === 'train' || o.type === 'ramp_train') &&
      Math.abs(o.lane - player.visualX) < 0.55 &&
      player.y >= o.height - 0.35 &&
      PLAYER_Z >= o.z - 0.3 &&
      PLAYER_Z <= o.z + o.length + 0.3;

    // Se o jogador está em cima do trem, o trem desenha antes (z maior que PLAYER_Z).
    // Caso contrário, usa a frente do obstáculo (o.z) para que vagões ao lado cubram corretamente.
    const sortZ = isPlayerOnTop ? PLAYER_Z + 0.5 : Math.max(1.2, o.z);
    renderList.push({ kind: 'obs', z: sortZ, data: o });
  });

  collectibles.forEach((c) => renderList.push({ kind: 'item', z: c.z, data: c }));
  renderList.push({ kind: 'player', z: PLAYER_Z });

  renderList.sort((a, b) => b.z - a.z);

  for (const entry of renderList) {
    if (entry.kind === 'obs') drawObstacle(entry.data);
    else if (entry.kind === 'item') drawCollectible(entry.data);
    else if (entry.kind === 'player') drawPlayer();
  }

  // Partículas
  for (const p of particles) {
    const proj = project(p.x, p.y, p.z);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, Math.max(2, 0.14 * proj.scale), 0, Math.PI * 2);
    ctx.fill();
  }

  // Textos flutuantes (+25, ÍMÃ!, etc.)
  for (const ft of floatingTexts) {
    const proj = project(ft.x, ft.y, ft.z);
    ctx.save();
    ctx.globalAlpha = Math.min(1, ft.life * 1.5);
    ctx.font = `900 ${Math.max(14, Math.floor(0.45 * proj.scale))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(ft.text, proj.x + 2, proj.y + 2);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, proj.x, proj.y);
    ctx.restore();
  }

  ctx.restore();
}

function drawCitySkyline(w, horizonY) {
  const parallax = cameraX * 14;
  const buildings = [
    { x: -0.05, w: 0.14, h: 64, win: '#fef08a' },
    { x: 0.10, w: 0.12, h: 92, win: '#38bdf8' },
    { x: 0.24, w: 0.15, h: 52, win: '#f472b6' },
    { x: 0.56, w: 0.14, h: 86, win: '#fef08a' },
    { x: 0.72, w: 0.13, h: 58, win: '#38bdf8' },
    { x: 0.87, w: 0.16, h: 76, win: '#f472b6' }
  ];

  for (const b of buildings) {
    const bx = w * b.x - parallax;
    const bw = w * b.w;
    const by = horizonY - b.h;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(bx, by, bw, b.h);

    ctx.fillStyle = b.win;
    for (let wy = by + 9; wy < horizonY - 8; wy += 13) {
      for (let wx = bx + 6; wx < bx + bw - 8; wx += 11) {
        if (Math.sin(wx * 0.3 + wy * 0.7) > 0.15) {
          ctx.fillRect(wx, wy, 4, 5);
        }
      }
    }
  }
}

// Muros laterais com postes passando rápido para dar sensação de velocidade
function drawSideWalls() {
  const wallX = 1.68 * LANE_WIDTH;
  const wallH = 1.45;

  for (const side of [-1, 1]) {
    const x = side * wallX;
    const nearB = project(x, 0, 1.5);
    const nearT = project(x, wallH, 1.5);
    const farB = project(x, 0, SPAWN_Z);
    const farT = project(x, wallH, SPAWN_Z);

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(nearB.x, nearB.y);
    ctx.lineTo(nearT.x, nearT.y);
    ctx.lineTo(farT.x, farT.y);
    ctx.lineTo(farB.x, farB.y);
    ctx.closePath();
    ctx.fill();

    // Faixa superior luminosa no muro
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(nearT.x, nearT.y);
    ctx.lineTo(farT.x, farT.y);
    ctx.stroke();

    // Pilares ao longo do muro
    const pillarSpacing = 9;
    const offset = distanceTraveled % pillarSpacing;
    ctx.fillStyle = '#475569';
    for (let z = 3; z < SPAWN_Z; z += pillarSpacing) {
      const curZ = z - offset;
      if (curZ < 1.6) continue;
      const pB = project(x, 0, curZ);
      const pT = project(x, wallH + 0.15, curZ);
      const pw = Math.max(2, 0.16 * pB.scale);
      ctx.fillRect(pB.x - pw / 2, pT.y, pw, pB.y - pT.y);
    }
  }
}

function drawTracks() {
  const lanes = [-1, 0, 1];
  const sleeperSpacing = 3.2;
  const offset = distanceTraveled % sleeperSpacing;

  // Dormentes de madeira
  ctx.fillStyle = '#475569';
  for (let z = 2; z < SPAWN_Z; z += sleeperSpacing) {
    const curZ = z - offset;
    if (curZ < 1) continue;
    const left = project(-1.55 * LANE_WIDTH, 0, curZ);
    const right = project(1.55 * LANE_WIDTH, 0, curZ);
    const thickness = Math.max(1.5, 0.22 * left.scale);
    ctx.fillRect(left.x, left.y, right.x - left.x, thickness);
  }

  // Trilhos de aço brilhantes
  for (const lane of lanes) {
    const cx = lane * LANE_WIDTH;
    for (const railOffset of [-0.55, 0.55]) {
      const near = project(cx + railOffset, 0, 1.5);
      const far = project(cx + railOffset, 0, SPAWN_Z);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(1.5, 0.08 * near.scale);
      ctx.beginPath();
      ctx.moveTo(near.x, near.y);
      ctx.lineTo(far.x, far.y);
      ctx.stroke();
    }
  }
}

function drawObstacle(obs) {
  const cx = obs.lane * LANE_WIDTH;
  const halfW = 0.85;
  const zFront = Math.max(1.2, obs.z);
  const zBack = Math.max(1.3, obs.z + obs.length);
  if (zBack <= 1.3) return;

  if (obs.type === 'train' || obs.type === 'ramp_train') {
    const h = obs.height;
    const frontH = obs.type === 'ramp_train' ? 0.12 : h;
    const theme = obs.theme;

    const fBL = project(cx - halfW, 0, zFront);
    const fBR = project(cx + halfW, 0, zFront);
    const fTL = project(cx - halfW, frontH, zFront);
    const fTR = project(cx + halfW, frontH, zFront);

    const bBL = project(cx - halfW, 0, zBack);
    const bBR = project(cx + halfW, 0, zBack);
    const bTL = project(cx - halfW, h, zBack);
    const bTR = project(cx + halfW, h, zBack);

    // 1. Parede lateral visível (evita sensação de objeto oco/atravessável!)
    if (cx > cameraX) {
      // Trem à direita da câmera -> desenha parede esquerda
      ctx.fillStyle = shadeColor(theme.main, -28);
      ctx.beginPath();
      ctx.moveTo(fBL.x, fBL.y);
      ctx.lineTo(fTL.x, fTL.y);
      ctx.lineTo(bTL.x, bTL.y);
      ctx.lineTo(bBL.x, bBL.y);
      ctx.closePath();
      ctx.fill();

      // Janelas laterais do vagão
      drawTrainSideWindows(cx - halfW, zFront, zBack, h, obs.type === 'ramp_train');
    } else if (cx < cameraX) {
      // Trem à esquerda da câmera -> desenha parede direita
      ctx.fillStyle = shadeColor(theme.main, -28);
      ctx.beginPath();
      ctx.moveTo(fBR.x, fBR.y);
      ctx.lineTo(fTR.x, fTR.y);
      ctx.lineTo(bTR.x, bTR.y);
      ctx.lineTo(bBR.x, bBR.y);
      ctx.closePath();
      ctx.fill();

      drawTrainSideWindows(cx + halfW, zFront, zBack, h, obs.type === 'ramp_train');
    }

    // 2. Teto ou Rampa
    ctx.fillStyle = theme.roof;
    ctx.beginPath();
    ctx.moveTo(fTL.x, fTL.y);
    ctx.lineTo(fTR.x, fTR.y);
    ctx.lineTo(bTR.x, bTR.y);
    ctx.lineTo(bTL.x, bTL.y);
    ctx.closePath();
    ctx.fill();

    if (obs.type === 'ramp_train') {
      // Setas amarelas na rampa
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 3. Frente do trem
    if (obs.type === 'train') {
      ctx.fillStyle = theme.main;
      ctx.beginPath();
      ctx.moveTo(fBL.x, fBL.y);
      ctx.lineTo(fBR.x, fBR.y);
      ctx.lineTo(fTR.x, fTR.y);
      ctx.lineTo(fTL.x, fTL.y);
      ctx.closePath();
      ctx.fill();

      // Faixa colorida frontal
      const sTL = project(cx - halfW, h * 0.46, zFront);
      const sTR = project(cx + halfW, h * 0.46, zFront);
      const sBL = project(cx - halfW, h * 0.34, zFront);
      const sBR = project(cx + halfW, h * 0.34, zFront);
      ctx.fillStyle = theme.stripe;
      ctx.beginPath();
      ctx.moveTo(sTL.x, sTL.y);
      ctx.lineTo(sTR.x, sTR.y);
      ctx.lineTo(sBR.x, sBR.y);
      ctx.lineTo(sBL.x, sBL.y);
      ctx.closePath();
      ctx.fill();

      // Para-brisa
      const wTL = project(cx - halfW * 0.74, h * 0.86, zFront);
      const wTR = project(cx + halfW * 0.74, h * 0.86, zFront);
      const wBL = project(cx - halfW * 0.74, h * 0.54, zFront);
      const wBR = project(cx + halfW * 0.74, h * 0.54, zFront);
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(wTL.x, wTL.y);
      ctx.lineTo(wTR.x, wTR.y);
      ctx.lineTo(wBR.x, wBR.y);
      ctx.lineTo(wBL.x, wBL.y);
      ctx.closePath();
      ctx.fill();

      // Faróis brilhantes
      const l1 = project(cx - halfW * 0.56, h * 0.22, zFront);
      const l2 = project(cx + halfW * 0.56, h * 0.22, zFront);
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

    const barH = (bl.y - tl.y) * 0.48;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(tl.x, tl.y, tr.x - tl.x, barH);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(tl.x + (tr.x - tl.x) * 0.22, tl.y, (tr.x - tl.x) * 0.2, barH);
    ctx.fillRect(tl.x + (tr.x - tl.x) * 0.58, tl.y, (tr.x - tl.x) * 0.2, barH);
  } else if (obs.type === 'high_barrier') {
    const bl = project(cx - halfW, 0, zFront);
    const br = project(cx + halfW, 0, zFront);
    const clL = project(cx - halfW, obs.clearance, zFront);
    const tl = project(cx - halfW, obs.height, zFront);
    const tr = project(cx + halfW, obs.height, zFront);

    const postW = Math.max(3, 0.13 * bl.scale);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(bl.x, tl.y, postW, bl.y - tl.y);
    ctx.fillRect(br.x - postW, tr.y, postW, br.y - tr.y);

    ctx.fillStyle = '#f97316';
    ctx.fillRect(tl.x, tl.y, tr.x - tl.x, clL.y - tl.y);
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.strokeRect(tl.x, tl.y, tr.x - tl.x, clL.y - tl.y);
  }
}

function drawTrainSideWindows(sideX, zFront, zBack, h, isRamp) {
  const startZ = isRamp ? zFront + 5.2 : zFront + 1.4;
  ctx.fillStyle = '#0f172a';
  for (let wz = startZ; wz < zBack - 1.6; wz += 3.0) {
    const p1 = project(sideX, h * 0.82, wz);
    const p2 = project(sideX, h * 0.82, wz + 1.7);
    const p3 = project(sideX, h * 0.52, wz + 1.7);
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
    // Rotação 3D simulada da moeda
    const spin = Math.max(0.28, Math.abs(Math.cos(now * 0.005 + item.z * 0.4)));
    ctx.save();
    ctx.translate(proj.x, proj.y);
    ctx.scale(spin, 1);

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = Math.max(1.5, radius * 0.18);
    ctx.stroke();

    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.arc(-radius * 0.22, -radius * 0.22, radius * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (item.type === 'magnet') {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, radius * 1.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fecaca';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = `bold ${Math.max(10, Math.floor(radius * 1.3))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧲', proj.x, proj.y);
  } else if (item.type === 'sneakers') {
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, radius * 1.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#bbf7d0';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = `bold ${Math.max(10, Math.floor(radius * 1.3))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👟', proj.x, proj.y);
  }
}

function drawPlayer() {
  const px = player.visualX * LANE_WIDTH;
  const shadowProj = project(px, player.groundY + 0.02, PLAYER_Z);
  const bodyProj = project(px, player.y, PLAYER_Z);
  const scale = bodyProj.scale;

  // Sombra no chão ou no teto do trem
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(shadowProj.x, shadowProj.y, 0.46 * shadowProj.scale, 0.16 * shadowProj.scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(bodyProj.x, bodyProj.y);
  ctx.rotate(player.lean);

  const heightFactor = (player.isSliding ? 0.5 : 1.0) * player.squash;
  const widthFactor = 2 - player.squash;
  const bodyW = 0.66 * scale * widthFactor;
  const bodyH = 1.18 * scale * heightFactor;
  const swing = player.isJumping ? 0.12 * scale : Math.sin(player.runCycle) * 0.18 * scale;

  // Braços balançando
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.roundRect(-bodyW * 0.66, -bodyH * 0.92 - swing * 0.7, bodyW * 0.22, bodyH * 0.48, 6);
  ctx.roundRect(bodyW * 0.44, -bodyH * 0.92 + swing * 0.7, bodyW * 0.22, bodyH * 0.48, 6);
  ctx.fill();

  // Pernas e tênis
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(-bodyW * 0.4, -bodyH * 0.38 + swing, bodyW * 0.32, bodyH * 0.36);
  ctx.fillRect(bodyW * 0.08, -bodyH * 0.38 - swing, bodyW * 0.32, bodyH * 0.36);

  // Solado/Tênis estiloso
  ctx.fillStyle = player.sneakersTimer > 0 ? '#22c55e' : '#f8fafc';
  ctx.fillRect(-bodyW * 0.42, -bodyH * 0.08 + swing, bodyW * 0.36, bodyH * 0.1);
  ctx.fillRect(bodyW * 0.06, -bodyH * 0.08 - swing, bodyW * 0.36, bodyH * 0.1);

  // Jaqueta
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.roundRect(-bodyW / 2, -bodyH, bodyW, bodyH * 0.68, 9);
  ctx.fill();

  // Mochila
  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.roundRect(-bodyW * 0.34, -bodyH * 0.92, bodyW * 0.68, bodyH * 0.48, 6);
  ctx.fill();

  // Cabeça
  const headR = 0.28 * scale;
  const headY = -bodyH - headR * 0.75;
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  // Boné vermelho virado para trás
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(0, headY - headR * 0.15, headR * 1.06, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-headR * 0.4, headY - headR * 0.25, headR * 1.35, headR * 0.22);

  ctx.restore();
}

function gameLoop(timestamp) {
  if (gameState !== 'PLAYING') return;
  const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
  lastTime = timestamp;

  update(dt);
  draw();

  if (gameState === 'PLAYING') {
    requestAnimationFrame(gameLoop);
  }
}

resizeCanvas();
draw();
