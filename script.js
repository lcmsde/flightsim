const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');
const hudEl = document.getElementById('hud');

const state = {
  x: 0,
  y: 80,
  z: 0,
  speed: 42,
  throttle: 0.55,
  pitch: 0,
  roll: 0,
  heading: 0,
  time: 0,
};

const keys = new Set();

const rings = Array.from({ length: 24 }, (_, i) => ({
  x: Math.sin(i * 1.15) * 120,
  y: 25 + (i % 4) * 12,
  z: 240 + i * 220,
  r: 18 + (i % 3) * 4,
}));

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    reset();
  }
  keys.add(event.code);
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
});

function reset() {
  Object.assign(state, {
    x: 0,
    y: 80,
    z: 0,
    speed: 42,
    throttle: 0.55,
    pitch: 0,
    roll: 0,
    heading: 0,
    time: 0,
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function terrainHeight(x, z) {
  return 18 + Math.sin(x * 0.03) * 9 + Math.cos(z * 0.02) * 8 + Math.sin((x + z) * 0.01) * 5;
}

function projectPoint(px, py, pz) {
  const relX = px - state.x;
  const relY = py - state.y;
  const relZ = pz - state.z;

  const yaw = -state.heading;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const x1 = relX * cosY - relZ * sinY;
  const z1 = relX * sinY + relZ * cosY;

  const pitch = -state.pitch;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const y2 = relY * cosP - z1 * sinP;
  const z2 = relY * sinP + z1 * cosP;

  const roll = -state.roll;
  const cosR = Math.cos(roll);
  const sinR = Math.sin(roll);
  const x3 = x1 * cosR - y2 * sinR;
  const y3 = x1 * sinR + y2 * cosR;

  if (z2 < 2) {
    return null;
  }

  const focal = 420;
  return {
    x: canvas.width / 2 + (x3 / z2) * focal,
    y: canvas.height / 2 + (y3 / z2) * focal,
    s: focal / z2,
    z: z2,
  };
}

function update(dt) {
  state.time += dt;

  const controlRate = 1.1;
  if (keys.has('ArrowUp')) state.pitch -= controlRate * dt;
  if (keys.has('ArrowDown')) state.pitch += controlRate * dt;
  if (keys.has('ArrowLeft')) state.roll -= controlRate * dt;
  if (keys.has('ArrowRight')) state.roll += controlRate * dt;
  if (keys.has('KeyA')) state.heading -= controlRate * dt;
  if (keys.has('KeyD')) state.heading += controlRate * dt;

  if (keys.has('KeyW')) state.throttle += dt * 0.45;
  if (keys.has('KeyS')) state.throttle -= dt * 0.45;
  state.throttle = clamp(state.throttle, 0, 1);

  const targetSpeed = 18 + state.throttle * 90;
  state.speed += (targetSpeed - state.speed) * dt * 2;

  const climb = Math.sin(-state.pitch) * state.speed * 0.85;
  const gravity = 6.2;

  state.x += Math.sin(state.heading) * state.speed * dt;
  state.z += Math.cos(state.heading) * state.speed * dt;
  state.y += (climb - gravity) * dt;

  const floor = terrainHeight(state.x, state.z) + 4;
  if (state.y < floor) {
    state.y = floor;
    state.pitch *= 0.7;
    state.speed *= 0.94;
  }

  state.roll *= 0.985;
  state.pitch *= 0.988;
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#7dc5ff');
  sky.addColorStop(0.45, '#7db8ff');
  sky.addColorStop(0.46, '#7ab16e');
  sky.addColorStop(1, '#456635');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawTerrainGrid() {
  for (let zi = 0; zi < 35; zi += 1) {
    const worldZ = Math.floor(state.z / 60) * 60 + zi * 60;
    let prev = null;
    for (let xi = -10; xi <= 10; xi += 1) {
      const worldX = state.x + xi * 40;
      const worldY = terrainHeight(worldX, worldZ);
      const p = projectPoint(worldX, worldY, worldZ);
      if (p && prev) {
        ctx.strokeStyle = `rgba(30, 70, 25, ${clamp(1 - p.z / 2000, 0, 0.65)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      prev = p;
    }
  }

  for (let xi = -10; xi <= 10; xi += 1) {
    const worldX = Math.floor(state.x / 40) * 40 + xi * 40;
    let prev = null;
    for (let zi = 0; zi < 35; zi += 1) {
      const worldZ = state.z + zi * 60;
      const worldY = terrainHeight(worldX, worldZ);
      const p = projectPoint(worldX, worldY, worldZ);
      if (p && prev) {
        ctx.strokeStyle = `rgba(35, 90, 30, ${clamp(1 - p.z / 2200, 0, 0.45)})`;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      prev = p;
    }
  }
}

function drawRings() {
  rings.forEach((ring) => {
    const rp = projectPoint(ring.x, ring.y, ring.z);
    if (!rp) return;

    const pulse = 0.85 + Math.sin(state.time * 3 + ring.z * 0.02) * 0.15;
    const radius = Math.max(2, ring.r * rp.s * 1.4);

    ctx.strokeStyle = `rgba(255, 220, 70, ${clamp(1 - rp.z / 1800, 0.2, 0.95)})`;
    ctx.lineWidth = 2 + pulse;
    ctx.beginPath();
    ctx.arc(rp.x, rp.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawCrosshair() {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.2;

  ctx.beginPath();
  ctx.moveTo(cx - 16, cy);
  ctx.lineTo(cx + 16, cy);
  ctx.moveTo(cx, cy - 16);
  ctx.lineTo(cx, cy + 16);
  ctx.stroke();
}

function updateHud() {
  const headingDegrees = ((state.heading * 180) / Math.PI + 360) % 360;
  const metrics = [
    ['Throttle', `${Math.round(state.throttle * 100)}%`],
    ['Speed', `${state.speed.toFixed(1)} kt`],
    ['Altitude', `${state.y.toFixed(1)} m`],
    ['Pitch', `${((-state.pitch * 180) / Math.PI).toFixed(1)}°`],
    ['Roll', `${((state.roll * 180) / Math.PI).toFixed(1)}°`],
    ['Heading', `${headingDegrees.toFixed(0)}°`],
  ];

  hudEl.innerHTML = metrics
    .map(
      ([label, value]) =>
        `<div class="hud-item"><span class="hud-label">${label}</span><span class="hud-value">${value}</span></div>`,
    )
    .join('');
}

function draw() {
  drawBackground();
  drawTerrainGrid();
  drawRings();
  drawCrosshair();
  updateHud();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.032, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
