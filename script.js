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

// Sistema de Áudio Sintetizado (Web Audio API - sem arquivos externos)
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
    this.playTone(987.77, 'sine', 0.12, 0.11, 1318.5);
  },
  jump() {
    this.playTone(220, 'triangle', 0.22, 0.15, 520);
  },
  slide() {
    this.playTone(300, 'sawtooth', 0.18, 0.08, 110);
  },
  lane() {
    this.playTone(320, 'sine', 0.08, 0.08, 420);
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

// Perspectiva 3D
const HORIZON_RATIO = 0.26;
const CAMERA_HEIGHT = 2.4;
const FOV = 290;
const LANE_WIDTH = 2.2;
const SPAWN_Z = 95;
const PLAYER_Z = 6;

const player = {
  lane: 0,
  visualX: 0,
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

function resetGame() {
  score = 0;
  coins = 0;
  speed = 18;
  distanceTraveled = 0;
  shakeTimer = 0;

  player.lane = 0;
  player.visualX = 0;
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

  for (let z = 32; z <= 92; z += 22) {
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
    AudioSys.lane();
  }
}

function moveRight() {
  if (gameState !== 'PLAYING') return;
  if (player.lane < 1) {
    player.lane++;
    AudioSys.lane();
  }
}

function jump() {
  if (gameState !== 'PLAYING') return;
  if (!player.isJumping) {
    const jumpPower = player.sneakersTimer > 0 ? 15.5 : 11.8;
    player.vy = jumpPower;
    player.isJumping = true;
    player.isSliding = false;
    AudioSys.jump();
    spawnDust(player.visualX * LANE_WIDTH, player.y, '#38bdf8', 10);
  }
}

function slide() {
  if (gameState !== 'PLAYING') return;
  if (player.isJumping) {
    player.vy = -24;
  }
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
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (Math.max(absX, absY) < 24) return;

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

function spawnWave(zPos) {
  const lanes = [-1, 0, 1];
  lanes.sort(() => Math.random() - 0.5);
  const pattern = Math.random();

  if (pattern < 0.35) {
    const trainLane = lanes[0];
    const rampLane = lanes[1];
    const freeLane = lanes[2];

    obstacles.push({
      type: 'train',
      lane: trainLane,
      z: zPos,
      length: 14,
      height: 2.3,
      color: ['#f43f5e', '#3b82f6', '#10b981'][Math.floor(Math.random() * 3)]
    });

    obstacles.push({
      type: 'ramp_train',
      lane: rampLane,
      z: zPos,
      length: 15,
      height: 2.3,
      color: '#f59e0b'
    });

    for (let i = 0; i < 5; i++) {
      collectibles.push({
        type: 'coin',
        lane: rampLane,
        z: zPos + 3 + i * 2.2,
        y: 2.7
      });
    }

    spawnCoinLine(freeLane, zPos, 4, 0.6);
  } else if (pattern < 0.7) {
    obstacles.push({
      type: 'low_barrier',
      lane: lanes[0],
      z: zPos,
      length: 1.2,
      height: 0.95
    });

    obstacles.push({
      type: 'high_barrier',
      lane: lanes[1],
      z: zPos,
      length: 1.2,
      height: 2.4,
      clearance: 1.15
    });

    spawnCoinLine(lanes[2], zPos, 5, 0.6);
  } else {
    obstacles.push({
      type: 'train',
      lane: lanes[0],
      z: zPos,
      length: 13,
      height: 2.3,
      color: '#8b5cf6'
    });

    obstacles.push({
      type: 'train',
      lane: lanes[1],
      z: zPos + 3,
      length: 13,
      height: 2.3,
      color: '#ec4899'
    });

    obstacles.push({
      type: 'low_barrier',
      lane: lanes[2],
      z: zPos + 2,
      length: 1.2,
      height: 0.95
    });

    for (let i = -2; i <= 2; i++) {
      collectibles.push({
        type: 'coin',
        lane: lanes[2],
        z: zPos + 2 + i * 1.6,
        y: 1.8 - Math.abs(i) * 0.35
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
      y: 0.8
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
      vy: Math.random() * 4.5 + 1,
      vz: (Math.random() - 0.5) * 2,
      life: 0.45 + Math.random() * 0.2,
      color
    });
  }
}

function project(x, y, z) {
  const safeZ = Math.max(0.5, z);
  const scale = FOV / safeZ;
  const horizonY = canvas.height * HORIZON_RATIO;
  const screenX = canvas.width / 2 + x * scale;
  const screenY = horizonY + (CAMERA_HEIGHT - y) * scale;
  return { x: screenX, y: screenY, scale };
}

function update(dt) {
  speed = Math.min(36, speed + dt * 0.32);
  const dz = speed * dt;
  distanceTraveled += dz;
  score += dz * 1.5;

  if (shakeTimer > 0) shakeTimer -= dt;

  player.visualX += (player.lane - player.visualX) * Math.min(1, dt * 16);
  player.runCycle += dt * (speed * 0.65);

  // Rastro de energia sob os pés/tênis
  player.trail.push({
    x: player.visualX * LANE_WIDTH,
    y: player.y + 0.1,
    alpha: 0.55
  });
  if (player.trail.length > 10) player.trail.shift();
  for (const t of player.trail) {
    t.alpha *= 0.88;
  }

  if (player.slideTimer > 0) {
    player.slideTimer -= dt;
    if (player.slideTimer <= 0) player.isSliding = false;
  }
  if (player.magnetTimer > 0) player.magnetTimer -= dt;
  if (player.sneakersTimer > 0) player.sneakersTimer -= dt;

  let currentFloor = 0;
  for (const obs of obstacles) {
    if ((obs.type === 'train' || obs.type === 'ramp_train') && obs.lane === player.lane) {
      const frontZ = obs.z;
      const backZ = obs.z + obs.length;
      if (PLAYER_Z >= frontZ - 0.5 && PLAYER_Z <= backZ + 0.5) {
        if (obs.type === 'ramp_train' && PLAYER_Z < frontZ + 4.5) {
          const rampProgress = Math.max(0, Math.min(1, (PLAYER_Z - frontZ) / 4.5));
          currentFloor = Math.max(currentFloor, rampProgress * obs.height);
        } else if (player.y >= obs.height - 0.45) {
          currentFloor = Math.max(currentFloor, obs.height);
        }
      }
    }
  }
  player.groundY = currentFloor;

  if (player.y > player.groundY || player.vy > 0) {
    player.y += player.vy * dt;
    player.vy -= 32 * dt;
    if (player.y <= player.groundY) {
      player.y = player.groundY;
      player.vy = 0;
      player.isJumping = false;
    }
  } else {
    player.y = player.groundY;
    player.isJumping = false;
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    obs.z -= dz;

    if (obs.lane === player.lane) {
      const hitZ = obs.z <= PLAYER_Z + 0.6 && obs.z + obs.length >= PLAYER_Z - 0.4;
      if (hitZ) {
        if (obs.type === 'low_barrier') {
          if (player.y < obs.height - 0.15) {
            endGame();
            return;
          }
        } else if (obs.type === 'high_barrier') {
          const playerHeight = player.isSliding ? 0.75 : 1.75;
          if (!player.isSliding && player.y < obs.clearance && player.y + playerHeight > obs.clearance) {
            endGame();
            return;
          }
        } else if (obs.type === 'train') {
          if (player.y < obs.height - 0.35) {
            endGame();
            return;
          }
        } else if (obs.type === 'ramp_train') {
          if (PLAYER_Z > obs.z + 4.5 && player.y < obs.height - 0.35) {
            endGame();
            return;
          }
        }
      }
    }

    if (obs.z + obs.length < 0.5) {
      obstacles.splice(i, 1);
    }
  }

  for (let i = collectibles.length - 1; i >= 0; i--) {
    const item = collectibles[i];
    item.z -= dz;

    if (item.type === 'coin' && player.magnetTimer > 0 && item.z < 28 && item.z > 2) {
      item.lane += (player.visualX - item.lane) * Math.min(1, dt * 10);
      item.y += (player.y + 0.8 - item.y) * Math.min(1, dt * 10);
      item.z += (PLAYER_Z - item.z) * Math.min(1, dt * 6);
    }

    const distLane = Math.abs(item.lane - player.visualX);
    const distZ = Math.abs(item.z - PLAYER_Z);
    const distY = Math.abs(item.y - (player.y + 0.7));

    if (distLane < 0.55 && distZ < 1.3 && distY < 1.3) {
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

    if (item.z < 0.5) {
      collectibles.splice(i, 1);
    }
  }

  spawnCooldown -= dz;
  if (spawnCooldown <= 0) {
    spawnWave(SPAWN_Z);
    spawnCooldown = 23 + Math.random() * 5;
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy -= 12 * dt;
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
    const mag = shakeTimer * 22;
    ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
  }

  const w = canvas.width;
  const h = canvas.height;
  const horizonY = h * HORIZON_RATIO;

  // Céu vibrante ao entardecer
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0, '#0f172a');
  skyGrad.addColorStop(0.55, '#4f46e5');
  skyGrad.addColorStop(1, '#f472b6');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, horizonY);

  drawCitySkyline(w, horizonY);

  // Chão dos trilhos
  const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
  groundGrad.addColorStop(0, '#1e293b');
  groundGrad.addColorStop(1, '#0b1120');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, horizonY, w, h - horizonY);

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

  const renderList = [];
  obstacles.forEach((o) => renderList.push({ kind: 'obs', z: o.z + o.length / 2, data: o }));
  collectibles.forEach((c) => renderList.push({ kind: 'item', z: c.z, data: c }));
  renderList.push({ kind: 'player', z: PLAYER_Z });

  renderList.sort((a, b) => b.z - a.z);

  for (const entry of renderList) {
    if (entry.kind === 'obs') drawObstacle(entry.data);
    else if (entry.kind === 'item') drawCollectible(entry.data);
    else if (entry.kind === 'player') drawPlayer();
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
  const buildings = [
    { x: 0.03, w: 0.12, h: 62, win: '#38bdf8' },
    { x: 0.16, w: 0.11, h: 88, win: '#f472b6' },
    { x: 0.28, w: 0.14, h: 48, win: '#facc15' },
    { x: 0.56, w: 0.13, h: 82, win: '#38bdf8' },
    { x: 0.70, w: 0.12, h: 54, win: '#c084fc' },
    { x: 0.83, w: 0.14, h: 72, win: '#f472b6' }
  ];

  for (const b of buildings) {
    const bx = w * b.x;
    const bw = w * b.w;
    const by = horizonY - b.h;
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(bx, by, bw, b.h);

    // Janelinhas iluminadas
    ctx.fillStyle = b.win;
    for (let wy = by + 8; wy < horizonY - 8; wy += 12) {
      for (let wx = bx + 6; wx < bx + bw - 8; wx += 10) {
        if (Math.sin(wx * wy) > 0.1) {
          ctx.fillRect(wx, wy, 4, 5);
        }
      }
    }
  }
}

function drawTracks() {
  const lanes = [-1, 0, 1];
  const sleeperSpacing = 3.5;
  const offset = distanceTraveled % sleeperSpacing;

  ctx.fillStyle = '#334155';
  for (let z = 2; z < SPAWN_Z; z += sleeperSpacing) {
    const curZ = z - offset;
    if (curZ < 1) continue;
    const left = project(-1.55 * LANE_WIDTH, 0, curZ);
    const right = project(1.55 * LANE_WIDTH, 0, curZ);
    const thickness = Math.max(1, 0.22 * left.scale);
    ctx.fillRect(left.x, left.y, right.x - left.x, thickness);
  }

  for (const lane of lanes) {
    const cx = lane * LANE_WIDTH;
    for (const railOffset of [-0.55, 0.55]) {
      const near = project(cx + railOffset, 0, 1.5);
      const far = project(cx + railOffset, 0, SPAWN_Z);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(1.5, 0.085 * near.scale);
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
    const fBL = project(cx - halfW, 0, zFront);
    const fBR = project(cx + halfW, 0, zFront);
    const fTL = project(cx - halfW, obs.type === 'ramp_train' ? 0.15 : h, zFront);
    const fTR = project(cx + halfW, obs.type === 'ramp_train' ? 0.15 : h, zFront);

    const bTL = project(cx - halfW, h, zBack);
    const bTR = project(cx + halfW, h, zBack);

    ctx.fillStyle = obs.type === 'ramp_train' ? '#fbbf24' : '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(fTL.x, fTL.y);
    ctx.lineTo(fTR.x, fTR.y);
    ctx.lineTo(bTR.x, bTR.y);
    ctx.lineTo(bTL.x, bTL.y);
    ctx.closePath();
    ctx.fill();

    if (obs.type === 'ramp_train') {
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    if (obs.type === 'train') {
      ctx.fillStyle = obs.color;
      ctx.beginPath();
      ctx.moveTo(fBL.x, fBL.y);
      ctx.lineTo(fBR.x, fBR.y);
      ctx.lineTo(fTR.x, fTR.y);
      ctx.lineTo(fTL.x, fTL.y);
      ctx.closePath();
      ctx.fill();

      const wTL = project(cx - halfW * 0.72, h * 0.85, zFront);
      const wTR = project(cx + halfW * 0.72, h * 0.85, zFront);
      const wBL = project(cx - halfW * 0.72, h * 0.52, zFront);
      const wBR = project(cx + halfW * 0.72, h * 0.52, zFront);
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.moveTo(wTL.x, wTL.y);
      ctx.lineTo(wTR.x, wTR.y);
      ctx.lineTo(wBR.x, wBR.y);
      ctx.lineTo(wBL.x, wBL.y);
      ctx.closePath();
      ctx.fill();

      const l1 = project(cx - halfW * 0.55, h * 0.25, zFront);
      const l2 = project(cx + halfW * 0.55, h * 0.25, zFront);
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

    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(bl.x, tl.y, Math.max(3, 0.12 * bl.scale), bl.y - tl.y);
    ctx.fillRect(br.x - Math.max(3, 0.12 * br.scale), tr.y, Math.max(3, 0.12 * br.scale), br.y - tr.y);

    const barH = (bl.y - tl.y) * 0.45;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(tl.x, tl.y, tr.x - tl.x, barH);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(tl.x + (tr.x - tl.x) * 0.25, tl.y, (tr.x - tl.x) * 0.5, barH);
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

    ctx.fillStyle = '#f97316';
    ctx.fillRect(tl.x, tl.y, tr.x - tl.x, clL.y - tl.y);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(tl.x, tl.y, tr.x - tl.x, clL.y - tl.y);
  }
}

function drawCollectible(item) {
  if (item.z < 1.2) return;
  const bob = Math.sin(performance.now() * 0.006 + item.z) * 0.12;
  const proj = project(item.lane * LANE_WIDTH, item.y + bob, item.z);
  const radius = Math.max(4, 0.34 * proj.scale);

  if (item.type === 'coin') {
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = Math.max(1.5, radius * 0.2);
    ctx.stroke();

    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.arc(proj.x - radius * 0.25, proj.y - radius * 0.25, radius * 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.type === 'magnet') {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, radius * 1.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(10, Math.floor(radius * 1.3))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧲', proj.x, proj.y);
  } else if (item.type === 'sneakers') {
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, radius * 1.25, 0, Math.PI * 2);
    ctx.fill();
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

  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(shadowProj.x, shadowProj.y, 0.48 * shadowProj.scale, 0.18 * shadowProj.scale, 0, 0, Math.PI * 2);
  ctx.fill();

  const heightFactor = player.isSliding ? 0.5 : 1.0;
  const bodyW = 0.65 * scale;
  const bodyH = 1.15 * scale * heightFactor;
  const swing = player.isJumping ? 0 : Math.sin(player.runCycle) * 0.16 * scale;

  ctx.fillStyle = player.sneakersTimer > 0 ? '#22c55e' : '#1e293b';
  ctx.fillRect(bodyProj.x - bodyW * 0.42, bodyProj.y - bodyH * 0.38 + swing, bodyW * 0.34, bodyH * 0.38);
  ctx.fillRect(bodyProj.x + bodyW * 0.08, bodyProj.y - bodyH * 0.38 - swing, bodyW * 0.34, bodyH * 0.38);

  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.roundRect(bodyProj.x - bodyW / 2, bodyProj.y - bodyH, bodyW, bodyH * 0.68, 8);
  ctx.fill();

  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.roundRect(bodyProj.x - bodyW * 0.35, bodyProj.y - bodyH * 0.92, bodyW * 0.7, bodyH * 0.48, 6);
  ctx.fill();

  const headR = 0.28 * scale;
  const headY = bodyProj.y - bodyH - headR * 0.75;
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(bodyProj.x, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(bodyProj.x, headY - headR * 0.15, headR * 1.05, Math.PI, 0);
  ctx.fill();
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
