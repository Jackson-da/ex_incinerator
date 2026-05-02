import { posterCanvas, fireCanvas, ctxPoster, ctxFire, flameHint, flameBtn, flameBtnWrap } from './dom.js';
import { getBlockSize, MAX_PARTICLES, BURN_DURATION, REVEAL_DURATION } from './config.js';
import { fbm } from './utils.js';
import { crimeLabelCenter, sourceCanvas } from './poster.js';

// ──── 粒子系统 ────
export const particlePool = [];
let aliveCount = 0;

// ──── 预渲染发光纹理（替代 shadowBlur）────
let glowTextures = null;
function createGlowTex(inner, outer) {
  const s = 48, h = 24;
  const c = new OffscreenCanvas(s, s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0, inner); g.addColorStop(0.15, inner);
  g.addColorStop(0.6, outer); g.addColorStop(1, 'transparent');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  return c;
}
function ensureGlowTextures() {
  if (glowTextures) return;
  glowTextures = {
    fire: createGlowTex('rgba(255,180,40,1)', 'rgba(220,60,10,0.25)'),
    ash: createGlowTex('rgba(200,190,180,0.7)', 'rgba(140,130,120,0.1)'),
    converge: createGlowTex('rgba(255,235,200,1)', 'rgba(255,180,120,0.25)'),
  };
}

export function createParticle(x, y, type = 'fire') {
  let p = particlePool.find(p => !p.alive);
  if (!p) { p = {}; particlePool.push(p); }
  p.alive = true; p.x = x; p.y = y; p.type = type; p.convergeTime = 0;
  if (type === 'fire') {
    p.vx = (Math.random() - 0.5) * 40; p.vy = -80 - Math.random() * 140;
    p.life = 0.3 + Math.random() * 0.9; p.maxLife = p.life; p.size = 2 + Math.random() * 5;
  } else if (type === 'ash') {
    p.vx = (Math.random() - 0.5) * 20; p.vy = -15 - Math.random() * 35;
    p.life = 1.5 + Math.random() * 2.5; p.maxLife = p.life; p.size = 1.5 + Math.random() * 3;
  } else if (type === 'converge') {
    p.vx = (Math.random() - 0.5) * 10; p.vy = -20 - Math.random() * 30;
    p.life = 2 + Math.random() * 2; p.maxLife = p.life; p.size = 2 + Math.random() * 4;
  }
  aliveCount++;
  return p;
}

export function updateParticles(dt) {
  aliveCount = 0;
  for (const p of particlePool) {
    if (!p.alive) continue;
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.type === 'fire') p.vx += (Math.random() - 0.5) * 60 * dt;
    if (p.type === 'converge') {
      p.convergeTime += dt;
      const targetX = crimeLabelCenter.x, targetY = crimeLabelCenter.y - 60;
      const t = Math.min(p.convergeTime / 1.5, 1);
      p.x += (targetX - p.x) * 2 * dt;
      p.y += (targetY - p.y) * 2 * dt;
      p.size = p.size * (1 - t * 0.3);
    }
    if (p.life <= 0) p.alive = false;
    else aliveCount++;
  }
}

export function hasActiveParticles() { return aliveCount > 0; }

export function renderParticles() {
  ensureGlowTextures();
  const cw = fireCanvas.width, ch = fireCanvas.height;
  ctxFire.clearRect(0, 0, cw, ch);
  ctxFire.globalCompositeOperation = 'lighter';
  for (const p of particlePool) {
    if (!p.alive) continue;
    const ratio = p.life / p.maxLife;
    const s = p.size * ratio * 2;
    let tex;
    if (p.type === 'fire') {
      tex = glowTextures.fire;
    } else if (p.type === 'converge') {
      tex = glowTextures.converge;
    } else {
      tex = glowTextures.ash;
    }
    ctxFire.globalAlpha = p.type === 'ash' ? ratio * 0.7 : ratio;
    ctxFire.drawImage(tex, p.x - s, p.y - s, s * 2, s * 2);
  }
  ctxFire.globalAlpha = 1;
  ctxFire.globalCompositeOperation = 'source-over';
}

// ──── 燃烧 ────
export let burnProgress = 0, isBurning = false, burnStartTime = 0;
export let maxBurnRadius = 0, burnedCount = 0, frameCount = 0;
export let convergePoint = null;
export let postBurnStartTime = 0;
let burnedGrid = null, burnMask = null, burnMaskCtx = null;
let burnCols = 0, burnRows = 0;

export function resetBurnState() {
  burnProgress = 0; isBurning = false; burnStartTime = 0;
  maxBurnRadius = 0; burnMask = null; burnMaskCtx = null;
  burnedGrid = null; burnedCount = 0; frameCount = 0;
  convergePoint = null; postBurnStartTime = 0;
  burnCols = 0; burnRows = 0;
}

export function beginBurn() {
  isBurning = true;
  burnStartTime = performance.now();
  initBurn();
}

export function initBurn() {
  const w = posterCanvas.width, h = posterCanvas.height;
  maxBurnRadius = Math.sqrt(w * w + h * h) * 0.65;
  const bs = getBlockSize();
  burnCols = Math.ceil(w / bs); burnRows = Math.ceil(h / bs);
  burnedGrid = new Uint8Array(burnCols * burnRows);
  burnedCount = 0; frameCount = 0;
  burnMask = new OffscreenCanvas(w, h);
  burnMaskCtx = burnMask.getContext('2d');
  convergePoint = { x: crimeLabelCenter.x, y: crimeLabelCenter.y - 30 };
}

export function updateBurn(_dt) {
  frameCount++;
  const elapsed = performance.now() - burnStartTime;
  burnProgress = Math.min(elapsed / BURN_DURATION, 1.0);
  const w = posterCanvas.width, h = posterCanvas.height;
  const burnCX = crimeLabelCenter.x, burnCY = crimeLabelCenter.y;
  const baseRadius = burnProgress * maxBurnRadius;
  const noiseScale = burnProgress > 0.05 ? 30 : 5;
  const cols = burnCols, rows = burnRows;
  const bs = getBlockSize();
  const freq = 0.015, timeOff = burnProgress * 2;

  const newlyBurned = [];
  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      const idx = by * cols + bx;
      if (burnedGrid[idx]) continue;
      const bpx = bx * bs + bs / 2, bpy = by * bs + bs / 2;
      const dist = Math.sqrt((bpx - burnCX) ** 2 + (bpy - burnCY) ** 2);
      const noise = fbm(bpx * freq, bpy * freq + timeOff, 2) * noiseScale;
      if (dist < baseRadius + noise + ((Math.random() - 0.5) * 8)) {
        burnedGrid[idx] = 1;
        newlyBurned.push(bx, by);
      }
    }
  }
  burnedCount += newlyBurned.length >> 1;

  // 增量绘制新燃烧块到 mask
  for (let i = 0; i < newlyBurned.length; i += 2) {
    burnMaskCtx.fillStyle = '#0a0a0a';
    burnMaskCtx.fillRect(newlyBurned[i] * bs, newlyBurned[i + 1] * bs, bs, bs);
  }

  // 合成：源图 + mask + 边缘光
  ctxPoster.clearRect(0, 0, w, h);
  ctxPoster.drawImage(sourceCanvas, 0, 0);
  ctxPoster.drawImage(burnMask, 0, 0);

  if (burnProgress < 0.95) {
    const edgeGlow = ctxPoster.createRadialGradient(burnCX, burnCY, baseRadius * 0.85, burnCX, burnCY, baseRadius + 15);
    edgeGlow.addColorStop(0, 'rgba(0,0,0,0)'); edgeGlow.addColorStop(0.5, 'rgba(180,40,10,0.25)'); edgeGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctxPoster.fillStyle = edgeGlow; ctxPoster.fillRect(0, 0, w, h);
  }

  if (burnProgress < 0.9) {
    const n = Math.floor((1 - burnProgress) * 35) + 6;
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2, r = baseRadius + (Math.random() - 0.5) * 20;
      const px = burnCX + Math.cos(angle) * r, py = burnCY + Math.sin(angle) * r;
      if (px > 0 && px < w && py > 0 && py < h) createParticle(px, py, 'fire');
    }
  }
  if (burnProgress > 0.7) {
    const n = Math.floor((burnProgress - 0.7) * 45) + 2;
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2, r = baseRadius * (0.8 + Math.random() * 0.4);
      const px = burnCX + Math.cos(angle) * r, py = burnCY + Math.sin(angle) * r;
      if (px > 0 && px < w && py > 0 && py < h) createParticle(px, py, 'ash');
    }
  }
}

export function finishBurning() {
  isBurning = false;
  postBurnStartTime = performance.now();
  const burnCX = crimeLabelCenter.x, burnCY = crimeLabelCenter.y;
  for (const p of particlePool) {
    if (p.alive && p.type === 'fire') {
      p.type = 'ash'; p.vx = (Math.random() - 0.5) * 25; p.vy = -20 - Math.random() * 50;
      p.life = 1.2 + Math.random() * 2.5; p.maxLife = p.life; p.size = 2 + Math.random() * 4;
    }
  }
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * maxBurnRadius * 0.8;
    createParticle(burnCX + Math.cos(angle) * r, burnCY + Math.sin(angle) * r, 'ash');
  }
  flameBtnWrap.style.opacity = '0';
  flameBtnWrap.style.transition = 'opacity 0.8s';
}

// ──── 渐显动画 ────
export let isRevealing = false;
export let revealStartTime = 0;
let coveredGrid = null, revealMask = null, revealMaskCtx = null;
let revealCols = 0, revealRows = 0;

export function resetRevealState() {
  isRevealing = false; revealStartTime = 0;
  coveredGrid = null; revealMask = null; revealMaskCtx = null;
  revealCols = 0; revealRows = 0;
}

export function forceCompleteReveal(canvas, srcCanvas) {
  isRevealing = false;
  coveredGrid = null; revealMask = null; revealMaskCtx = null;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (srcCanvas) ctx.drawImage(srcCanvas, 0, 0);
}

export function startReveal() {
  const w = posterCanvas.width, h = posterCanvas.height;
  const bs = getBlockSize();
  revealCols = Math.ceil(w / bs); revealRows = Math.ceil(h / bs);
  coveredGrid = new Uint8Array(revealCols * revealRows);
  coveredGrid.fill(1);
  revealMask = new OffscreenCanvas(w, h);
  revealMaskCtx = revealMask.getContext('2d');
  revealMaskCtx.fillStyle = '#0a0a0a';
  revealMaskCtx.fillRect(0, 0, w, h);
  isRevealing = true;
  revealStartTime = performance.now();
}

export function updateReveal() {
  const elapsed = performance.now() - revealStartTime;
  const progress = Math.min(elapsed / REVEAL_DURATION, 1);
  const w = posterCanvas.width, h = posterCanvas.height;
  const cx = w / 2, cy = h / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  const revealRadius = maxDist * (1 - progress);
  const noiseScale = progress > 0.05 ? 28 : 6;
  const cols = revealCols, rows = revealRows;
  const bs = getBlockSize();
  const freq = 0.0175, timeOff = progress * 2;

  const newlyRevealed = [];
  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      const idx = by * cols + bx;
      if (!coveredGrid[idx]) continue;
      const bpx = bx * bs + bs / 2, bpy = by * bs + bs / 2;
      const dist = Math.sqrt((bpx - cx) ** 2 + (bpy - cy) ** 2);
      const noise = fbm(bpx * freq, bpy * freq + timeOff, 2) * noiseScale;
      if (dist > revealRadius - noise) {
        coveredGrid[idx] = 0;
        newlyRevealed.push(bx, by);
      }
    }
  }

  for (let i = 0; i < newlyRevealed.length; i += 2) {
    revealMaskCtx.clearRect(newlyRevealed[i] * bs, newlyRevealed[i + 1] * bs, bs, bs);
  }

  ctxPoster.clearRect(0, 0, w, h);
  ctxPoster.drawImage(sourceCanvas, 0, 0);
  ctxPoster.drawImage(revealMask, 0, 0);

  if (progress >= 1) {
    isRevealing = false;
    coveredGrid = null; revealMask = null; revealMaskCtx = null;
    ctxPoster.clearRect(0, 0, w, h);
    ctxPoster.drawImage(sourceCanvas, 0, 0);
    return true;
  }
  return false;
}

// ──── 焚烧后暗化 ────
export function renderPostBurnFrame(timestamp) {
  if (postBurnStartTime <= 0) return;
  const elapsed = (timestamp - postBurnStartTime) / 1000;
  const darkness = Math.min(elapsed / 2.5, 1);
  const w = posterCanvas.width, h = posterCanvas.height;
  ctxPoster.fillStyle = `rgba(10,10,10,${darkness * 0.85})`;
  ctxPoster.fillRect(0, 0, w, h);
  if (darkness < 0.7) {
    const burnCX = crimeLabelCenter.x, burnCY = crimeLabelCenter.y;
    const emberGlow = ctxPoster.createRadialGradient(burnCX, burnCY, 0, burnCX, burnCY, maxBurnRadius * (1 - darkness));
    emberGlow.addColorStop(0, `rgba(180,60,15,${0.3 * (1 - darkness)})`);
    emberGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctxPoster.fillStyle = emberGlow;
    ctxPoster.fillRect(0, 0, w, h);
  }
}
