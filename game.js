const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const W = canvas.width;
const H = canvas.height;

// --- Input ---
const keys = {};
const mouse = { x: W / 2, y: H / 2, down: false };

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyR' && gameOver) restart();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouse.x = (e.clientX - rect.left) * scaleX;
  mouse.y = (e.clientY - rect.top) * scaleY;
});
canvas.addEventListener('mousedown', () => { mouse.down = true; });
canvas.addEventListener('mouseup', () => { mouse.down = false; });

// --- Game state ---
let player, bullets, enemies, particles;
let score, wave, enemiesToSpawn, spawnTimer, waveBreak;
let gameOver, lastTime, shootCooldown;

const PLAYER_SPEED = 220;
const PLAYER_RADIUS = 14;
const PLAYER_MAX_HP = 100;
const BULLET_SPEED = 480;
const BULLET_RADIUS = 4;
const FIRE_RATE = 0.12;
const ENEMY_BASE_SPEED = 70;
const ENEMY_RADIUS = 12;
const ENEMY_DAMAGE = 10;
const ENEMY_CONTACT_COOLDOWN = 0.5;
const SPAWN_INTERVAL = 0.6;

function createPlayer() {
  return {
    x: W / 2,
    y: H / 2,
    hp: PLAYER_MAX_HP,
    angle: 0,
    contactCooldown: 0,
  };
}

function init() {
  player = createPlayer();
  bullets = [];
  enemies = [];
  particles = [];
  score = 0;
  wave = 1;
  enemiesToSpawn = waveEnemyCount(wave);
  spawnTimer = 0;
  waveBreak = 0;
  gameOver = false;
  shootCooldown = 0;
  lastTime = performance.now();
  updateHud();
}

function restart() {
  init();
}

function waveEnemyCount(w) {
  return 5 + w * 3;
}

function enemySpeedForWave(w) {
  return ENEMY_BASE_SPEED + w * 8;
}

// --- Spawning ---
function spawnEnemy() {
  const margin = 40;
  const side = Math.floor(Math.random() * 4);
  let x, y;
  switch (side) {
    case 0: x = Math.random() * W; y = -margin; break;
    case 1: x = W + margin; y = Math.random() * H; break;
    case 2: x = Math.random() * W; y = H + margin; break;
    default: x = -margin; y = Math.random() * H;
  }
  enemies.push({
    x, y,
    hp: 1 + Math.floor(wave / 3),
    speed: enemySpeedForWave(wave),
    radius: ENEMY_RADIUS,
    contactCooldown: 0,
  });
}

function startNextWave() {
  wave++;
  enemiesToSpawn = waveEnemyCount(wave);
  waveBreak = 2;
  updateHud();
}

// --- Update ---
function update(dt) {
  if (gameOver) return;

  if (waveBreak > 0) {
    waveBreak -= dt;
    updateParticles(dt);
    return;
  }

  // Player movement
  let dx = 0, dy = 0;
  if (keys['KeyW'] || keys['ArrowUp']) dy -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) dy += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) dx -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) dx += 1;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    player.x += (dx / len) * PLAYER_SPEED * dt;
    player.y += (dy / len) * PLAYER_SPEED * dt;
  }
  player.x = Math.max(PLAYER_RADIUS, Math.min(W - PLAYER_RADIUS, player.x));
  player.y = Math.max(PLAYER_RADIUS, Math.min(H - PLAYER_RADIUS, player.y));

  player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);

  // Shooting
  shootCooldown -= dt;
  if (mouse.down && shootCooldown <= 0) {
    shootCooldown = FIRE_RATE;
    const cos = Math.cos(player.angle);
    const sin = Math.sin(player.angle);
    bullets.push({
      x: player.x + cos * (PLAYER_RADIUS + 6),
      y: player.y + sin * (PLAYER_RADIUS + 6),
      vx: cos * BULLET_SPEED,
      vy: sin * BULLET_SPEED,
      radius: BULLET_RADIUS,
    });
  }

  if (player.contactCooldown > 0) player.contactCooldown -= dt;

  // Bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
      bullets.splice(i, 1);
      continue;
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (circleOverlap(b, e)) {
        e.hp--;
        spawnParticles(e.x, e.y, '#f85149', 6);
        bullets.splice(i, 1);
        if (e.hp <= 0) {
          score += 10 * wave;
          enemies.splice(j, 1);
          spawnParticles(e.x, e.y, '#ffa657', 10);
        }
        break;
      }
    }
  }

  // Enemy spawn
  if (enemiesToSpawn > 0) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnEnemy();
      enemiesToSpawn--;
      spawnTimer = SPAWN_INTERVAL;
    }
  } else if (enemies.length === 0) {
    startNextWave();
  }

  // Enemies chase player
  for (const e of enemies) {
    const angle = Math.atan2(player.y - e.y, player.x - e.x);
    e.x += Math.cos(angle) * e.speed * dt;
    e.y += Math.sin(angle) * e.speed * dt;

    if (e.contactCooldown > 0) e.contactCooldown -= dt;

    if (circleOverlap(player, e) && player.contactCooldown <= 0 && e.contactCooldown <= 0) {
      player.hp -= ENEMY_DAMAGE;
      player.contactCooldown = ENEMY_CONTACT_COOLDOWN;
      e.contactCooldown = ENEMY_CONTACT_COOLDOWN;
      spawnParticles(player.x, player.y, '#ff7b72', 8);
      updateHud();
      if (player.hp <= 0) {
        player.hp = 0;
        gameOver = true;
      }
    }
  }

  updateParticles(dt);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function circleOverlap(a, b) {
  const r = (a.radius || 0) + (b.radius || 0);
  return Math.hypot(a.x - b.x, a.y - b.y) < r;
}

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 120;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.3 + Math.random() * 0.3,
      color,
      radius: 2 + Math.random() * 2,
    });
  }
}

// --- Draw ---
function draw() {
  ctx.fillStyle = '#161b22';
  ctx.fillRect(0, 0, W, H);

  drawGrid();

  for (const p of particles) {
    ctx.globalAlpha = p.life / 0.5;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const b of bullets) {
    ctx.fillStyle = '#79c0ff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const e of enemies) {
    ctx.fillStyle = '#f85149';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff7b72';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (!gameOver) drawPlayer();

  if (waveBreak > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#d29922';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Wave ${wave}`, W / 2, H / 2);
  }

  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e6edf3';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', W / 2, H / 2 - 20);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillStyle = '#8b949e';
    ctx.fillText(`Score: ${score} · Wave: ${wave}`, W / 2, H / 2 + 20);
    ctx.fillText('Press R to restart', W / 2, H / 2 + 55);
  }
}

function drawGrid() {
  ctx.strokeStyle = '#21262d';
  ctx.lineWidth = 1;
  const step = 40;
  for (let x = 0; x <= W; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

function drawPlayer() {
  const { x, y, angle, hp } = player;
  const hpRatio = hp / PLAYER_MAX_HP;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.fillStyle = '#3fb950';
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#58a6ff';
  ctx.fillRect(PLAYER_RADIUS - 2, -4, 18, 8);

  ctx.restore();

  const barW = 36;
  const barH = 5;
  ctx.fillStyle = '#30363d';
  ctx.fillRect(x - barW / 2, y - PLAYER_RADIUS - 14, barW, barH);
  ctx.fillStyle = hpRatio > 0.3 ? '#3fb950' : '#f85149';
  ctx.fillRect(x - barW / 2, y - PLAYER_RADIUS - 14, barW * hpRatio, barH);
}

function updateHud() {
  document.getElementById('health').textContent = `HP: ${Math.max(0, Math.ceil(player.hp))}`;
  document.getElementById('score').textContent = `Score: ${score}`;
  document.getElementById('wave').textContent = `Wave: ${wave}`;
}

// --- Loop ---
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

init();
requestAnimationFrame(loop);
