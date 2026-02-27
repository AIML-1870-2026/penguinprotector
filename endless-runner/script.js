'use strict';

/* ============================================================
   Rat Race — script.js
   All world coords are absolute. Player screen x = 150 (fixed).
   Render with: worldX - gs.scrollX → screen x
   ============================================================ */

// ─── CANVAS ────────────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');
const LW = 800, LH = 400;   // logical dimensions
const GROUND_Y = 320;        // y of the rooftop surface
let   scale = 1;

function resizeCanvas() {
  const ratio = LW / LH;
  const ww = window.innerWidth, wh = window.innerHeight;
  if (ww / wh > ratio) { canvas.height = wh; canvas.width  = Math.round(wh * ratio); }
  else                  { canvas.width  = ww; canvas.height = Math.round(ww / ratio); }
  scale = canvas.width / LW;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ─── CONSTANTS ─────────────────────────────────────────────────
const BASE_SPEED    = 4;
const PLAYER_SCREEN_X = 150;
const PLAYER_W = 24, PLAYER_H = 28;
const SLIDE_H  = 14;
const JUMP_VY       = -14.5;
const DBL_JUMP_VY   = -12;
const GRAV_UP       = 0.55;
const GRAV_DOWN     = 0.9;
const COYOTE_MS     = 80;
const JUMP_BUF_MS   = 110;

// ─── ZONES ─────────────────────────────────────────────────────
const ZONES = [
  { name: 'Downtown',      c1: '#12080a', c2: '#3b1a08', accent: '#c97a3a', floor: '#2a1208' },
  { name: 'Industrial',    c1: '#0a0a0a', c2: '#252525', accent: '#8a8a8a', floor: '#1a1a1a' },
  { name: 'Neon District', c1: '#080012', c2: '#16002e', accent: '#e91e8c', floor: '#1a0030' },
  { name: 'Skyline',       c1: '#03101e', c2: '#133050', accent: '#4dd0e1', floor: '#0c2040' },
];

// ─── TIME OF DAY ────────────────────────────────────────────────
const TOD = [
  { name: 'Sunset',   icon: '🌅', sky0: '#ff6b35', sky1: '#ff9a3c', stars: 0 },
  { name: 'Dusk',     icon: '🌆', sky0: '#3d1540', sky1: '#c0502a', stars: 0.4 },
  { name: 'Night',    icon: '🌃', sky0: '#02041a', sky1: '#0a0a28', stars: 1.0 },
  { name: 'Pre-Dawn', icon: '🌄', sky0: '#10103a', sky1: '#281860', stars: 0.6 },
  { name: 'Sunrise',  icon: '🌇', sky0: '#ff9a3c', sky1: '#ffcd70', stars: 0 },
  { name: 'Day',      icon: '☀️', sky0: '#1a6fa8', sky1: '#45c0f0', stars: 0 },
];

// ─── AUDIO ─────────────────────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let   audioCtx = null;
let   muted    = localStorage.getItem('rr_muted') === 'true';

function ensureAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function playTone(freq, dur, type = 'sine', vol = 0.13) {
  if (muted || !audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.connect(g); g.connect(audioCtx.destination);
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.start(); o.stop(audioCtx.currentTime + dur);
}
function sfxJump()      { playTone(370, 0.1, 'sine', 0.11); setTimeout(() => playTone(500, 0.08, 'sine', 0.08), 55); }
function sfxDblJump()   { playTone(580, 0.1, 'sine', 0.12); setTimeout(() => playTone(780, 0.09, 'sine', 0.09), 40); }
function sfxLand()      { playTone(110, 0.07, 'triangle', 0.14); }
function sfxDeath()     { playTone(180, 0.3, 'sawtooth', 0.14); setTimeout(() => playTone(130, 0.4, 'sawtooth', 0.1), 160); }
function sfxPickup()    { playTone(880, 0.07, 'sine', 0.11); setTimeout(() => playTone(1100, 0.07, 'sine', 0.09), 60); }

let ambOsc = null, ambGain = null;
function startAmbient() {
  if (muted || !audioCtx || ambOsc) return;
  ambGain = audioCtx.createGain(); ambGain.gain.value = 0.03; ambGain.connect(audioCtx.destination);
  ambOsc  = audioCtx.createOscillator(); ambOsc.type = 'sine'; ambOsc.frequency.value = 55;
  ambOsc.connect(ambGain); ambOsc.start();
}
function stopAmbient()  { if (ambOsc) { try { ambOsc.stop(); } catch(e) {} ambOsc = null; } }

// ─── INPUT ─────────────────────────────────────────────────────
const keys = {};
let jumpPressedAt = 0;

window.addEventListener('keydown', e => {
  if (keys[e.code]) return;
  keys[e.code] = true;
  if (['Space','ArrowUp','KeyW'].includes(e.code)) {
    e.preventDefault();
    ensureAudio();
    jumpPressedAt = Date.now();
    if (gs.phase === 'playing') handleJumpInput();
    else if (gs.phase === 'start') startGame();
  }
  if (['ArrowDown','KeyS'].includes(e.code)) {
    if (gs.phase === 'playing') gs.p.wantSlide = true;
  }
});
window.addEventListener('keyup', e => {
  keys[e.code] = false;
  if (['Space','ArrowUp','KeyW'].includes(e.code))   { if (gs.phase === 'playing') gs.p.holdJump = false; }
  if (['ArrowDown','KeyS'].includes(e.code))         { if (gs.phase === 'playing') gs.p.wantSlide = false; }
});

// Touch
let touchY0 = 0;
canvas.addEventListener('touchstart', e => {
  ensureAudio(); e.preventDefault();
  touchY0 = e.touches[0].clientY;
  jumpPressedAt = Date.now();
  if (gs.phase === 'playing') handleJumpInput();
  if (gs.phase === 'start')   startGame();
}, { passive: false });
canvas.addEventListener('touchend', e => {
  e.preventDefault();
  if (gs.phase === 'playing') gs.p.holdJump = false;
  gs.p.wantSlide = false;
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (gs.phase === 'playing') gs.p.wantSlide = (e.touches[0].clientY - touchY0) > 28;
}, { passive: false });

// ─── STATE ─────────────────────────────────────────────────────
let gs = {};

function makePlayer() {
  return {
    worldX:   PLAYER_SCREEN_X,   // world x (updated each frame = scrollX + PLAYER_SCREEN_X)
    y:        GROUND_Y - PLAYER_H,
    vy:       0,
    grounded: true,
    sliding:  false,
    wantSlide: false,
    holdJump: false,
    coyote:   0,
    jumpBuf:  0,
    jumps:    0,     // 0 = available, 1 = used 1st, 2 = both used
    frame:    0,
    fTimer:   0,
    state:    'run', // run|jump|fall|slide|land|dead
    hitFlash: 0,
    sqY:      1,
    sqX:      1,
    landTimer: 0,
  };
}

function resetGS() {
  gs = {
    phase:     'start',
    score:     0,
    distance:  0,
    runTime:   0,
    speed:     BASE_SPEED,
    scrollX:   0,
    zoneIdx:   0,
    todIdx:    0,
    todT:      0,

    p:         makePlayer(),
    platforms: [],
    hazards:   [],
    particles: [],
    popups:    [],

    nextChunkX:   LW + 60,
    lastChunkType: '',
    chunkCount:  0,
    difficulty:  0,
    deathCause:  '',
    jumpCount:   0,

    // ghost
    frames:      [],      // recording this run
    ghostPB:     [],      // previous best
    ghostIdx:    0,
    ghostX:      0, ghostY: 0,

    // parallax (world offset, increases with scrollX)
    pxFar:  0, pxMid: 0, pxNear: 0,

    // pre-generated building data
    farBldgs:  genBuildings(60, 0.9),
    midBldgs:  genBuildings(40, 0.65),
    nearBldgs: genBuildings(25, 0.55),
    stars:     genStars(70),

    // screen shake
    shakeX: 0, shakeY: 0, shakeTimer: 0, shakeAmt: 0,

    // menu preview animation
    menuFrame: 0, menuFrameT: 0,
  };
}

// ─── BUILDING / STAR GENERATION ────────────────────────────────
function genBuildings(count, heightFrac) {
  const b = []; let x = 0;
  for (let i = 0; i < count; i++) {
    const w = 45 + Math.random() * 110;
    const h = 40 + Math.random() * (LH * heightFrac);
    b.push({
      x, w, h,
      y: GROUND_Y + 20 - h,
      litW: Math.floor(w / 18) || 1,
      litH: Math.floor(h / 20) || 1,
      lit:  Array.from({ length: 120 }, () => Math.random() > 0.45),
    });
    x += w + 4 + Math.random() * 25;
  }
  return b;
}

function genStars(n) {
  return Array.from({ length: n }, () => ({
    x: Math.random() * LW,
    y: Math.random() * (GROUND_Y * 0.75),
    r: 0.6 + Math.random() * 1.4,
    t: Math.random() * Math.PI * 2,
  }));
}

// ─── CHUNK SYSTEM ──────────────────────────────────────────────
// Chunks return {width, platforms[], hazards[]}
function makeChunk(type, sx) {
  const G = GROUND_Y;
  switch (type) {
    case 'flat':
      return { width: 380, platforms: [{ x: sx, y: G, w: 380, h: 20, type: 'ground' }], hazards: [] };

    case 'gap':
      return { width: 480, platforms: [
        { x: sx,       y: G, w: 160, h: 20, type: 'ground' },
        { x: sx + 250, y: G, w: 230, h: 20, type: 'ground' },
      ], hazards: [] };

    case 'fans':
      return { width: 460, platforms: [{ x: sx, y: G, w: 460, h: 20, type: 'ground' }], hazards: [
        { x: sx + 70,  y: G - 32, w: 28, h: 32, type: 'fan', t: 0 },
        { x: sx + 200, y: G - 32, w: 28, h: 32, type: 'fan', t: 0.6 },
        { x: sx + 340, y: G - 32, w: 28, h: 32, type: 'fan', t: 1.2 },
      ] };

    case 'antennas':
      return { width: 480, platforms: [{ x: sx, y: G, w: 480, h: 20, type: 'ground' }], hazards: [
        { x: sx + 60,  y: G - 55, w: 10, h: 55, type: 'antenna' },
        { x: sx + 160, y: G - 72, w: 10, h: 72, type: 'antenna' },
        { x: sx + 270, y: G - 48, w: 10, h: 48, type: 'antenna' },
        { x: sx + 390, y: G - 62, w: 10, h: 62, type: 'antenna' },
      ] };

    case 'staircase':
      return { width: 540, platforms: [
        { x: sx,       y: G,       w: 100, h: 20, type: 'ground' },
        { x: sx + 110, y: G - 60,  w: 90,  h: 14, type: 'platform' },
        { x: sx + 210, y: G - 120, w: 90,  h: 14, type: 'platform' },
        { x: sx + 330, y: G - 60,  w: 80,  h: 14, type: 'platform' },
        { x: sx + 430, y: G,       w: 110, h: 20, type: 'ground' },
      ], hazards: [] };

    case 'pigeons':
      return { width: 430, platforms: [{ x: sx, y: G, w: 430, h: 20, type: 'ground' }], hazards: [
        { x: sx + 90,  y: G - 100, w: 55, h: 22, type: 'pigeon', vx: -2.2, t: 0 },
        { x: sx + 260, y: G - 55,  w: 55, h: 22, type: 'pigeon', vx: -1.8, t: 1.0 },
      ] };

    case 'high_low':
      return { width: 500, platforms: [
        { x: sx,       y: G,      w: 110, h: 20, type: 'ground' },
        { x: sx + 120, y: G - 88, w: 150, h: 14, type: 'platform' },
        { x: sx + 120, y: G,      w: 150, h: 20, type: 'ground' },
        { x: sx + 390, y: G,      w: 110, h: 20, type: 'ground' },
      ], hazards: [
        { x: sx + 155, y: G - 32, w: 28, h: 32, type: 'fan', t: 0 },
      ] };

    case 'crumble':
      return { width: 520, platforms: [
        { x: sx,       y: G,      w: 90,  h: 20, type: 'ground' },
        { x: sx + 115, y: G - 42, w: 80,  h: 14, type: 'crumble', crumbling: false, crumbleT: 0 },
        { x: sx + 215, y: G - 42, w: 80,  h: 14, type: 'crumble', crumbling: false, crumbleT: 0 },
        { x: sx + 315, y: G - 42, w: 80,  h: 14, type: 'crumble', crumbling: false, crumbleT: 0 },
        { x: sx + 415, y: G - 42, w: 80,  h: 14, type: 'crumble', crumbling: false, crumbleT: 0 },
      ], hazards: [] };

    case 'steam':
      return { width: 460, platforms: [{ x: sx, y: G, w: 460, h: 20, type: 'ground' }], hazards: [
        { x: sx + 100, y: G - 58, w: 18, h: 58, type: 'steam', t: 0,   period: 2.2 },
        { x: sx + 280, y: G - 58, w: 18, h: 58, type: 'steam', t: 1.1, period: 2.2 },
      ] };

    case 'rooftop_gap':
      return { width: 540, platforms: [
        { x: sx,       y: G,      w: 150, h: 20, type: 'ground' },
        { x: sx + 230, y: G - 65, w: 85,  h: 14, type: 'platform' },
        { x: sx + 380, y: G,      w: 160, h: 20, type: 'ground' },
      ], hazards: [] };

    case 'combo':
      return { width: 560, platforms: [{ x: sx, y: G, w: 560, h: 20, type: 'ground' }], hazards: [
        { x: sx + 70,  y: G - 32,  w: 28, h: 32, type: 'fan',    t: 0 },
        { x: sx + 220, y: G - 100, w: 55, h: 22, type: 'pigeon', vx: -2, t: 0 },
        { x: sx + 380, y: G - 32,  w: 28, h: 32, type: 'fan',    t: 0.5 },
      ] };

    default:
      return { width: 380, platforms: [{ x: sx, y: G, w: 380, h: 20, type: 'ground' }], hazards: [] };
  }
}

const CHUNK_DEFS = [
  { type: 'flat',       min: 0, w: 7 },   // heavy weight keeps early runs open
  { type: 'pigeons',    min: 0, w: 2 },   // low-flying birds only; slideable
  { type: 'fans',       min: 1, w: 3 },   // moved: requires jump, unlocks at 30s
  { type: 'antennas',   min: 1, w: 3 },   // moved: requires jump, unlocks at 30s
  { type: 'gap',        min: 1, w: 3 },
  { type: 'staircase',  min: 1, w: 2 },
  { type: 'high_low',   min: 2, w: 2 },
  { type: 'rooftop_gap',min: 2, w: 2 },
  { type: 'steam',      min: 1, w: 2 },
  { type: 'crumble',    min: 2, w: 1 },
  { type: 'combo',      min: 3, w: 1 },
];

// Chunks that force the player into the air (jumping required to clear ground hazards or gaps)
const AIRBORNE_CHUNKS = new Set(['fans', 'antennas', 'combo', 'gap', 'staircase', 'high_low', 'rooftop_gap', 'crumble']);

function pickChunk(diff, lastType, chunkCount) {
  // Grace period: guarantee flat ground for the first 4 chunks
  if (chunkCount < 4) return 'flat';
  let pool = CHUNK_DEFS.filter(c => c.min <= diff);
  // Never spawn 'pigeons' directly after a jump-forcing chunk — the low pigeon
  // sits at G-55 and collides with any airborne player, making it undodgeable.
  if (AIRBORNE_CHUNKS.has(lastType)) {
    pool = pool.filter(c => c.type !== 'pigeons');
  }
  const total = pool.reduce((s, c) => s + c.w, 0);
  let r = Math.random() * total;
  for (const c of pool) { r -= c.w; if (r <= 0) return c.type; }
  return 'flat';
}

function spawnChunks() {
  while (gs.nextChunkX < gs.scrollX + LW * 3) {
    const type = pickChunk(gs.difficulty, gs.lastChunkType, gs.chunkCount);
    const chunk = makeChunk(type, gs.nextChunkX);
    gs.platforms.push(...chunk.platforms);
    gs.hazards.push(...chunk.hazards);
    gs.nextChunkX += chunk.width;
    gs.lastChunkType = type;
    gs.chunkCount++;
  }
  const cutX = gs.scrollX - 300;
  gs.platforms = gs.platforms.filter(p => p.x + p.w > cutX);
  gs.hazards   = gs.hazards.filter(h => h.x + h.w + 60 > cutX);
}

// ─── JUMP ──────────────────────────────────────────────────────
function handleJumpInput() {
  const p = gs.p;
  p.holdJump = true;
  if (p.grounded || p.coyote > 0) { doJump(); }
  else if (p.jumps < 2)           { doDblJump(); }
  else                            { p.jumpBuf = JUMP_BUF_MS; }
}
function doJump() {
  const p = gs.p; p.vy = JUMP_VY; p.grounded = false;
  p.coyote = 0; p.jumps = 1; p.state = 'jump';
  p.sqY = 1.35; p.sqX = 0.72;
  gs.jumpCount++; sfxJump();
  dustAt(p.worldX + PLAYER_W / 2, p.y + PLAYER_H);
}
function doDblJump() {
  const p = gs.p; p.vy = DBL_JUMP_VY; p.jumps = 2; p.state = 'jump';
  p.sqY = 1.2; gs.jumpCount++; sfxDblJump();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    gs.particles.push({ x: p.worldX + PLAYER_W/2, y: p.y + PLAYER_H/2, vx: Math.cos(a)*2.5, vy: Math.sin(a)*2.5-1, life: 0.4, ml: 0.4, col: '#f39c12', r: 3 });
  }
}

// ─── PLAYER UPDATE ─────────────────────────────────────────────
function updatePlayer(dt) {
  const p = gs.p;
  if (p.state === 'dead') { p.vy += GRAV_DOWN * dt * 60; p.y += p.vy * dt * 60; return; }

  p.worldX = gs.scrollX + PLAYER_SCREEN_X;

  // Sliding
  p.sliding = p.wantSlide && p.grounded;

  // Coyote timer
  if (!p.grounded) p.coyote = Math.max(0, p.coyote - dt * 1000);

  // Jump buffer
  if (p.jumpBuf > 0) {
    p.jumpBuf -= dt * 1000;
    if (p.grounded && p.jumpBuf > 0) { p.jumpBuf = 0; doJump(); }
  }

  // Gravity: variable height
  const grav = (!p.holdJump && p.vy < 0) ? GRAV_DOWN * 1.6 : (p.vy < 0 ? GRAV_UP : GRAV_DOWN);
  p.vy += grav * dt * 60;
  p.y  += p.vy * dt * 60;

  // Squash/stretch decay
  p.sqY += (1 - p.sqY) * 0.2;
  p.sqX += (1 - p.sqX) * 0.2;

  // Platform collisions
  const wasGrounded = p.grounded;
  p.grounded = false;
  const pH    = p.sliding ? SLIDE_H : PLAYER_H;
  const pBot  = p.y + pH;
  const pL    = p.worldX + 4, pR = p.worldX + PLAYER_W - 4;

  for (const pl of gs.platforms) {
    if (pl.type === 'crumble' && pl.crumbling && pl.crumbleT <= 0) continue;
    const top = pl.y;
    const inX = pR > pl.x + 4 && pL < pl.x + pl.w - 4;
    if (inX && p.vy >= 0 && pBot >= top && pBot - p.vy * dt * 60 <= top + 10) {
      p.y = top - pH; p.vy = 0; p.grounded = true; p.jumps = 0; p.coyote = COYOTE_MS;
      if (!wasGrounded) {
        p.state = 'land'; p.sqY = 1.45; p.sqX = 0.7; p.landTimer = 0.12;
        sfxLand(); dustAt(p.worldX + PLAYER_W/2, p.y + pH);
        if (pl.type === 'crumble' && !pl.crumbling) { pl.crumbling = true; pl.crumbleT = 0.48; }
      }
    }
  }

  // Fall below = death
  if (p.y > LH + 80) { killPlayer('Fell off the roof!'); return; }

  // Land timer
  if (p.landTimer > 0) { p.landTimer -= dt; if (p.landTimer <= 0 && p.state === 'land') p.state = 'run'; }

  // Anim state
  if (p.state !== 'land' && p.state !== 'dead' && p.state !== 'hit') {
    if (p.sliding)              p.state = 'slide';
    else if (!p.grounded && p.vy < 0) p.state = 'jump';
    else if (!p.grounded && p.vy > 0) p.state = 'fall';
    else                              p.state = 'run';
  }

  // Hit flash decay
  if (p.hitFlash > 0) { p.hitFlash -= dt; if (p.hitFlash <= 0 && p.state === 'hit') p.state = 'run'; }

  // Frame animation (run cycle)
  p.fTimer += dt;
  if (p.fTimer > 0.11) { p.fTimer = 0; p.frame = (p.frame + 1) % 4; }
}

function updateCrumble(dt) {
  for (const pl of gs.platforms) {
    if (pl.type === 'crumble' && pl.crumbling) pl.crumbleT -= dt;
  }
  gs.platforms = gs.platforms.filter(pl => !(pl.type === 'crumble' && pl.crumbling && pl.crumbleT <= 0));
}

// ─── HAZARDS ───────────────────────────────────────────────────
function updateHazards(dt) {
  for (const h of gs.hazards) {
    h.t += dt;
    if (h.type === 'pigeon') h.x += (h.vx || -2) * (gs.speed / BASE_SPEED) * dt * 60;
  }
}

function checkCollisions() {
  const p = gs.p;
  if (p.state === 'dead' || p.hitFlash > 0) return;
  const pH = p.sliding ? SLIDE_H : PLAYER_H;
  const pL = p.worldX + 5, pR = p.worldX + PLAYER_W - 5;
  const pT = p.y + 5,      pB = p.y + pH - 5;

  for (const h of gs.hazards) {
    const hL = h.x, hR = h.x + h.w, hT = h.y, hB = h.y + h.h;
    const xOvlp = pR > hL && pL < hR;
    const yOvlp = pB > hT && pT < hB;
    if (!xOvlp || !yOvlp) continue;

    if (h.type === 'fan')     killPlayer('Sliced by a ventilation fan!');
    if (h.type === 'antenna') killPlayer('Impaled on an antenna!');
    if (h.type === 'pigeon')  killPlayer('Smacked by a pigeon flock!');
    if (h.type === 'steam' && h.active) killPlayer('Scalded by a steam pipe!');
  }
}

function killPlayer(cause) {
  const p = gs.p;
  p.state = 'dead'; p.vy = -10;
  gs.deathCause = cause;
  shake(0.5, 7); sfxDeath();
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 5;
    gs.particles.push({ x: p.worldX + PLAYER_W/2, y: p.y + PLAYER_H/2, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - 2, life: 0.9, ml: 0.9, col: '#c0392b', r: 4 });
  }
  setTimeout(() => { saveGhost(); showGameOver(); }, 1300);
}

function shake(dur, amt) { gs.shakeTimer = dur; gs.shakeAmt = amt; }

// ─── PARTICLES & POPUPS ────────────────────────────────────────
function dustAt(x, y) {
  for (let i = 0; i < 5; i++) {
    gs.particles.push({ x, y, vx: (Math.random()-0.5)*3, vy: -Math.random()*2, life: 0.3, ml: 0.3, col: '#bbb', r: 2+Math.random()*2 });
  }
}
function popup(x, y, text) { gs.popups.push({ x, y, text, life: 1.1, ml: 1.1 }); }

function updateParticles(dt) {
  for (const p of gs.particles) { p.x += p.vx*dt*60; p.y += p.vy*dt*60; p.vy += 0.12*dt*60; p.life -= dt; }
  gs.particles = gs.particles.filter(p => p.life > 0);
  for (const p of gs.popups) { p.y -= 28*dt; p.life -= dt; }
  gs.popups = gs.popups.filter(p => p.life > 0);
}

// ─── PARALLAX ──────────────────────────────────────────────────
function updateParallax(dt) {
  gs.pxFar  += gs.speed * 0.18 * dt * 60;
  gs.pxMid  += gs.speed * 0.45 * dt * 60;
  gs.pxNear += gs.speed * 0.78 * dt * 60;
}

// ─── PROGRESSION ───────────────────────────────────────────────
function updateProgression(dt) {
  gs.runTime += dt;
  gs.distance += gs.speed * dt * 60 / 10;
  gs.speed = Math.min(BASE_SPEED * 3, BASE_SPEED + gs.runTime / 28 * 0.22);
  gs.difficulty = Math.min(4, Math.floor(gs.runTime / 30));
  gs.score += Math.ceil((gs.speed / BASE_SPEED) * 2 * dt * 60);

  // ToD
  gs.todT += dt;
  if (gs.todT >= 60) { gs.todT -= 60; gs.todIdx = (gs.todIdx + 1) % TOD.length; updateTodIcon(); }

  // Zone
  const z = Math.floor(gs.distance / 900) % ZONES.length;
  if (z !== gs.zoneIdx) { gs.zoneIdx = z; flashZoneName(ZONES[z].name); }

  // Shake decay
  if (gs.shakeTimer > 0) {
    gs.shakeTimer -= dt;
    const a = gs.shakeAmt * (gs.shakeTimer / 0.5);
    gs.shakeX = (Math.random()-0.5)*a; gs.shakeY = (Math.random()-0.5)*a;
  } else { gs.shakeX = gs.shakeY = 0; }

  document.getElementById('score-display').textContent = Math.floor(gs.score).toLocaleString();
}

function updateTodIcon() { document.getElementById('tod-icon').textContent = TOD[gs.todIdx].icon; }
function flashZoneName(name) {
  const el = document.getElementById('zone-name');
  el.textContent = '▶ ' + name; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

// ─── GHOST ─────────────────────────────────────────────────────
function recordGhostFrame() {
  if (gs.frames.length < 7200) gs.frames.push({ x: gs.p.worldX, y: gs.p.y, s: gs.p.state });
}
function saveGhost() {
  const prev = parseInt(localStorage.getItem('rr_ghost_score') || '0', 10);
  if (gs.score > prev) {
    localStorage.setItem('rr_ghost_score', Math.floor(gs.score));
    localStorage.setItem('rr_ghost', JSON.stringify(gs.frames));
    document.getElementById('ghost-note').classList.remove('hidden');
  } else {
    document.getElementById('ghost-note').classList.add('hidden');
  }
}
function loadGhost() {
  const raw = localStorage.getItem('rr_ghost');
  gs.ghostPB  = raw ? JSON.parse(raw) : [];
  gs.ghostIdx = 0; gs.ghostX = 0; gs.ghostY = 0;
}
function updateGhost() {
  if (!gs.ghostPB.length) return;
  if (gs.ghostIdx < gs.ghostPB.length) {
    const f = gs.ghostPB[gs.ghostIdx++];
    gs.ghostX = f.x; gs.ghostY = f.y;
  }
}

// ─── SCORES ────────────────────────────────────────────────────
function getHS() { return parseInt(localStorage.getItem('rr_highscore') || '0', 10); }
function saveScore(s) {
  if (s > getHS()) localStorage.setItem('rr_highscore', s);
  const lb = JSON.parse(localStorage.getItem('rr_leaderboard') || '[]');
  lb.push({ score: s, date: new Date().toLocaleDateString() });
  lb.sort((a, b) => b.score - a.score); lb.splice(5);
  localStorage.setItem('rr_leaderboard', JSON.stringify(lb));
}
function getLB() { return JSON.parse(localStorage.getItem('rr_leaderboard') || '[]'); }

// ─── COLOUR HELPERS ────────────────────────────────────────────
function hexToRgb(h) {
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
}
function lerpCol(a, b, t) {
  const [ar,ag,ab] = hexToRgb(a), [br,bg,bb] = hexToRgb(b);
  return `rgb(${Math.round(ar+(br-ar)*t)},${Math.round(ag+(bg-ag)*t)},${Math.round(ab+(bb-ab)*t)})`;
}

// ─── RENDER ────────────────────────────────────────────────────
function drawSky() {
  const ph = TOD[gs.todIdx], nx = TOD[(gs.todIdx+1) % TOD.length];
  const t  = gs.todT / 60;
  const g  = ctx.createLinearGradient(0, 0, 0, GROUND_Y + 20);
  g.addColorStop(0, lerpCol(ph.sky0, nx.sky0, t));
  g.addColorStop(1, lerpCol(ph.sky1, nx.sky1, t));
  ctx.fillStyle = g; ctx.fillRect(0, 0, LW, LH);
}

function drawStars() {
  const ph = TOD[gs.todIdx], nx = TOD[(gs.todIdx+1) % TOD.length];
  const alpha = ph.stars + (nx.stars - ph.stars) * (gs.todT / 60);
  if (alpha <= 0.02) return;
  ctx.save();
  for (const s of gs.stars) {
    const tw = 0.7 + 0.3 * Math.sin(s.t + Date.now() * 0.0018);
    ctx.globalAlpha = alpha * tw;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawBuildings(bldgs, offset, alpha) {
  const zone = ZONES[gs.zoneIdx];
  const isNight = ['Night','Dusk','Pre-Dawn'].includes(TOD[gs.todIdx].name);
  const totalW = bldgs[bldgs.length-1].x + bldgs[bldgs.length-1].w + 100;
  const scrollOff = offset % totalW;
  ctx.save(); ctx.globalAlpha = alpha;
  for (let pass = -1; pass <= 1; pass++) {
    const dx = pass * totalW - scrollOff;
    for (const b of bldgs) {
      const bx = b.x + dx;
      if (bx + b.w < -10 || bx > LW + 10) continue;
      ctx.fillStyle = zone.c1; ctx.fillRect(bx, b.y, b.w, b.h);
      // windows
      const cg = 10, rg = 12;
      for (let r = 0; r < b.litH; r++) {
        for (let c = 0; c < b.litW; c++) {
          const wx = bx + 4 + c * cg, wy = b.y + 6 + r * rg;
          const lit = b.lit[(r * b.litW + c) % b.lit.length];
          ctx.fillStyle = isNight && lit ? '#ffdd88' : (isNight ? '#0a0a0a' : 'rgba(180,210,240,0.12)');
          ctx.fillRect(wx, wy, 6, 7);
        }
      }
    }
  }
  ctx.restore();
}

function drawGround() {
  const zone = ZONES[gs.zoneIdx];
  ctx.fillStyle = zone.floor; ctx.fillRect(0, GROUND_Y + 20, LW, LH - GROUND_Y - 20);
  ctx.strokeStyle = zone.accent; ctx.lineWidth = 1;
  ctx.globalAlpha = 0.25;
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y + 20); ctx.lineTo(LW, GROUND_Y + 20); ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawPlatforms() {
  const zone = ZONES[gs.zoneIdx];
  for (const pl of gs.platforms) {
    const sx = pl.x - gs.scrollX;
    if (sx + pl.w < -10 || sx > LW + 10) continue;
    if (pl.type === 'ground') {
      ctx.fillStyle = zone.floor; ctx.fillRect(sx, pl.y + 20, pl.w, pl.h);
      ctx.fillStyle = zone.accent + 'aa'; ctx.fillRect(sx, pl.y, pl.w, 4);
    } else if (pl.type === 'platform') {
      ctx.fillStyle = '#5a3a18'; ctx.fillRect(sx, pl.y, pl.w, pl.h);
      ctx.fillStyle = '#8b6020'; ctx.fillRect(sx, pl.y, pl.w, 3);
    } else if (pl.type === 'crumble') {
      const prog = pl.crumbling ? 1 - Math.max(0, pl.crumbleT / 0.48) : 0;
      ctx.globalAlpha = 1 - prog * 0.75;
      ctx.fillStyle = '#6e4a14'; ctx.fillRect(sx, pl.y, pl.w, pl.h);
      ctx.fillStyle = '#9a6a20'; ctx.fillRect(sx, pl.y, pl.w, 3);
      if (pl.crumbling) {
        ctx.strokeStyle = `rgba(200,100,20,${prog})`; ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(sx + (pl.w/4)*i, pl.y); ctx.lineTo(sx + (pl.w/4)*i + 2, pl.y + pl.h);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
  }
}

function drawHazards() {
  for (const h of gs.hazards) {
    const sx = h.x - gs.scrollX;
    if (sx + h.w < -30 || sx > LW + 30) continue;
    const sy = h.y;
    if (h.type === 'fan') {
      ctx.fillStyle = '#555'; ctx.fillRect(sx + 4, sy + 22, 20, 10);
      ctx.save(); ctx.translate(sx + 14, sy + 14); ctx.rotate(h.t * 9);
      ctx.fillStyle = '#999';
      ctx.fillRect(-12, -2, 24, 5); ctx.rotate(Math.PI/2); ctx.fillRect(-12, -2, 24, 5);
      ctx.restore();
    }
    if (h.type === 'antenna') {
      ctx.strokeStyle = '#777'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx+5, sy+h.h); ctx.lineTo(sx+5, sy); ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx-7, sy+10); ctx.lineTo(sx+17, sy+10); ctx.stroke();
      const blink = 0.5 + 0.5 * Math.sin(h.t * 4);
      ctx.fillStyle = `rgba(255,40,40,${blink})`;
      ctx.beginPath(); ctx.arc(sx+5, sy+2, 3, 0, Math.PI*2); ctx.fill();
    }
    if (h.type === 'pigeon') { drawPigeon(sx + h.w/2, sy + h.h/2, h.t); }
    if (h.type === 'steam') {
      h.active = (h.t % h.period) < (h.period * 0.42);
      ctx.fillStyle = '#555'; ctx.fillRect(sx + h.w/2 - 4, sy + h.h - 10, 8, 18);
      if (h.active) {
        const grad = ctx.createLinearGradient(sx, sy, sx, sy + h.h);
        grad.addColorStop(0, 'rgba(210,220,230,0.82)'); grad.addColorStop(1, 'rgba(210,220,230,0)');
        ctx.fillStyle = grad; ctx.fillRect(sx, sy, h.w, h.h);
      }
    }
  }
}

function drawPigeon(cx, cy, t) {
  // 3-bird flock with staggered size and phase
  const flock = [
    { dx: 0,   dy: 0,  phase: 0,   sz: 1.0  },
    { dx: -22, dy: -6, phase: 1.1, sz: 0.82 },
    { dx: 19,  dy: 5,  phase: 2.0, sz: 0.87 },
  ];

  for (const b of flock) {
    const flap = Math.sin(t * 8 + b.phase); // -1..1
    const wY   = flap * 6;

    ctx.save();
    ctx.translate(cx + b.dx, cy + b.dy);
    ctx.scale(-b.sz, b.sz); // mirror so bird faces left (direction of travel)

    // Far wing (behind body)
    ctx.fillStyle = '#526878';
    ctx.beginPath();
    ctx.ellipse(-1, -wY * 0.6, 11, 3.5, 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#8ba8bc';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Near wing (in front of body)
    ctx.fillStyle = '#7898ae';
    ctx.beginPath();
    ctx.ellipse(-1, -wY, 12, 4, -0.25, 0, Math.PI * 2);
    ctx.fill();

    // Tail
    ctx.fillStyle = '#628090';
    ctx.beginPath();
    ctx.moveTo(-12, -3.5); ctx.lineTo(-22, 0); ctx.lineTo(-12, 3.5);
    ctx.closePath(); ctx.fill();

    // Head
    ctx.fillStyle = '#9abfd4';
    ctx.beginPath(); ctx.arc(13, -2.5, 5.5, 0, Math.PI * 2); ctx.fill();

    // Iridescent neck shimmer
    const shimmer = 0.3 + 0.15 * Math.sin(t * 3 + b.phase);
    ctx.fillStyle = `rgba(80, 220, 160, ${shimmer})`;
    ctx.beginPath(); ctx.ellipse(7, -1.5, 3.5, 3, 0, 0, Math.PI * 2); ctx.fill();

    // Beak — upper mandible
    ctx.fillStyle = '#354a56';
    ctx.beginPath();
    ctx.moveTo(18, -3); ctx.lineTo(23.5, -1.5); ctx.lineTo(18, -0.5);
    ctx.closePath(); ctx.fill();
    // Beak — lower mandible
    ctx.fillStyle = '#415866';
    ctx.beginPath();
    ctx.moveTo(18, -0.5); ctx.lineTo(22.5, 0.2); ctx.lineTo(18, 1);
    ctx.closePath(); ctx.fill();

    // Eye — orange iris, dark pupil, white specular
    ctx.fillStyle = '#e05010';
    ctx.beginPath(); ctx.arc(14.5, -3.5, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(14.5, -3.5, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(15.1, -4.1, 0.55, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }
}

function rRect(x, y, w, h, r) {
  ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
  ctx.arcTo(x+w, y, x+w, y+r, r); ctx.lineTo(x+w, y+h-r);
  ctx.arcTo(x+w, y+h, x+w-r, y+h, r); ctx.lineTo(x+r, y+h);
  ctx.arcTo(x, y+h, x, y+h-r, r); ctx.lineTo(x, y+r);
  ctx.arcTo(x, y, x+r, y, r);
}

function drawRat(state, frame, sliding) {
  const C_BACK  = '#6b3010';  // dark dorsal fur
  const C_BODY  = '#9a4a18';  // main fur
  const C_BELLY = '#c07030';  // underbelly
  const C_LIMB  = '#7a3810';  // legs/arms
  const C_SNOUT = '#b86828';  // snout highlight
  const C_EAR_O = '#c87030';  // outer ear
  const C_EAR_I = '#e87890';  // inner ear pink
  const C_NOSE  = '#ff7090';  // nose
  const f = frame * Math.PI / 2;  // 0, π/2, π, 3π/2

  // ── SLIDE ───────────────────────────────────────────────────────
  // When sliding: drawing center is at ground level (y=0 = GROUND_Y)
  if (sliding) {
    // Tail arcing upward behind body
    ctx.strokeStyle = C_BACK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-9, 1);
    ctx.bezierCurveTo(-16, 4, -22, 0, -26, -6);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-26, -6);
    ctx.bezierCurveTo(-28, -10, -28, -15, -26, -20);
    ctx.stroke();

    // Flat body (elongated ellipses)
    ctx.fillStyle = C_BACK;
    ctx.beginPath(); ctx.ellipse(0, 1, 13, 4.5, 0.12, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C_BODY;
    ctx.beginPath(); ctx.ellipse(1, 1.5, 12, 4, 0.12, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C_BELLY;
    ctx.beginPath(); ctx.ellipse(2, 2.5, 9, 2.5, 0.12, 0, Math.PI*2); ctx.fill();

    // Legs trailing behind
    ctx.fillStyle = C_LIMB;
    ctx.beginPath(); ctx.ellipse(-4, 5.5, 5, 2, 0.3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(2, 5.5, 5, 2, 0.3, 0, Math.PI*2); ctx.fill();

    // Head (low, streamlined)
    ctx.fillStyle = C_BACK;
    ctx.beginPath(); ctx.arc(10.5, -1, 6.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C_BODY;
    ctx.beginPath(); ctx.arc(11.5, -0.5, 6, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C_BELLY;
    ctx.beginPath(); ctx.ellipse(15, 0.5, 4.5, 3, 0, 0, Math.PI*2); ctx.fill();

    // Ear (tucked)
    ctx.fillStyle = C_EAR_O;
    ctx.beginPath(); ctx.ellipse(7.5, -7, 3, 4.5, -0.4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C_EAR_I;
    ctx.beginPath(); ctx.ellipse(7.7, -6.8, 1.7, 2.8, -0.4, 0, Math.PI*2); ctx.fill();

    // Snout
    ctx.fillStyle = C_SNOUT;
    ctx.beginPath(); ctx.ellipse(17, 0.5, 4, 2.8, -0.1, 0, Math.PI*2); ctx.fill();

    // Eye
    ctx.fillStyle = '#c03020'; ctx.beginPath(); ctx.arc(13.5, -2.5, 2,   0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#111';    ctx.beginPath(); ctx.arc(13.5, -2.5, 1.1, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(14, -3, 0.55, 0, Math.PI*2); ctx.fill();

    // Nose
    ctx.fillStyle = C_NOSE; ctx.beginPath(); ctx.arc(20.5, 0.5, 1.6, 0, Math.PI*2); ctx.fill();

    // Whiskers
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(18, -0.5); ctx.lineTo(25, -3);  ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18,  0.8); ctx.lineTo(25,  2.5); ctx.stroke();
    return;
  }

  // ── UPRIGHT STATES ──────────────────────────────────────────────
  // Drawing center is 14px above ground (y=+14 = GROUND_Y in screen space)
  const isRun  = state === 'run' || state === 'land';
  const isJump = state === 'jump';
  const isFall = state === 'fall';
  const bob    = isRun ? Math.sin(f) * 1.3 : 0;

  // ── Tail ────────────────────────────────────────────────────────
  const wagY = isRun ? Math.sin(f) * 5 : (isJump ? -10 : (isFall ? 9 : 2));
  ctx.strokeStyle = C_BACK; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-8, bob + 3);
  ctx.bezierCurveTo(-16, bob + 8, -22, bob + wagY, -26, bob + wagY - 8);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-26, bob + wagY - 8);
  ctx.bezierCurveTo(-28, bob + wagY - 12, -28, bob + wagY - 17, -26, bob + wagY - 22);
  ctx.stroke();

  // ── Back legs (drawn before body so body overlaps at hip) ───────
  if (isRun) {
    const l1 = Math.sin(f), l2 = -l1;
    // Far leg
    ctx.fillStyle = C_BACK;
    ctx.beginPath(); ctx.ellipse(-4 + l1*2.5, bob+5, 4, 2.5, l1*0.25, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = C_BACK; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-4+l1*2.5, bob+7); ctx.lineTo(-5+l1*4.5, 13-Math.abs(l1)); ctx.stroke();
    // Near leg
    ctx.fillStyle = C_LIMB;
    ctx.beginPath(); ctx.ellipse(-3 + l2*2.5, bob+5, 4, 2.5, l2*0.25, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = C_LIMB; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-3+l2*2.5, bob+7); ctx.lineTo(-2+l2*4.5, 13-Math.abs(l2)); ctx.stroke();
  } else if (isJump) {
    // Legs tucked under body
    ctx.fillStyle = C_BACK;
    ctx.beginPath(); ctx.ellipse(-6, bob+3, 4, 2.5, -0.5, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = C_BACK; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-6, bob+4.5); ctx.lineTo(-8, bob+8); ctx.stroke();
    ctx.fillStyle = C_LIMB;
    ctx.beginPath(); ctx.ellipse(-3, bob+3, 4, 2.5, -0.5, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = C_LIMB; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-3, bob+4.5); ctx.lineTo(-2, bob+8); ctx.stroke();
  } else if (isFall) {
    // Legs spread wide, bracing for landing
    ctx.fillStyle = C_BACK;
    ctx.beginPath(); ctx.ellipse(-7, bob+6, 4, 2.5, 0.55, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = C_BACK; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-7, bob+7.5); ctx.lineTo(-10, 13); ctx.stroke();
    ctx.fillStyle = C_LIMB;
    ctx.beginPath(); ctx.ellipse(-2, bob+6, 4, 2.5, 0.55, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = C_LIMB; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-2, bob+7.5); ctx.lineTo(-1, 13); ctx.stroke();
  } else {
    ctx.fillStyle = C_BACK;
    ctx.beginPath(); ctx.ellipse(-5, bob+5, 4, 2.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = C_BACK; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-5, bob+6.5); ctx.lineTo(-6, 13); ctx.stroke();
    ctx.fillStyle = C_LIMB;
    ctx.beginPath(); ctx.ellipse(-2, bob+5, 4, 2.5, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = C_LIMB; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-2, bob+6.5); ctx.lineTo(-1, 13); ctx.stroke();
  }

  // ── Body (three layers: dark back → main → belly) ───────────────
  ctx.fillStyle = C_BACK;
  ctx.beginPath(); ctx.ellipse(0, bob, 10, 7, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = C_BODY;
  ctx.beginPath(); ctx.ellipse(1, bob, 10, 6.5, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = C_BELLY;
  ctx.beginPath(); ctx.ellipse(2, bob+2, 8, 4.5, 0.2, 0, Math.PI*2); ctx.fill();

  // ── Front paws ──────────────────────────────────────────────────
  ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  if (isJump) {
    // Arms reaching forward-upward
    ctx.strokeStyle = C_LIMB;
    ctx.beginPath(); ctx.moveTo(7, bob); ctx.lineTo(11, bob-6); ctx.stroke();
    ctx.fillStyle = C_LIMB; ctx.beginPath(); ctx.arc(11.5, bob-7, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = C_BACK;
    ctx.beginPath(); ctx.moveTo(7, bob+1); ctx.lineTo(10, bob-5); ctx.stroke();
    ctx.fillStyle = C_BACK; ctx.beginPath(); ctx.arc(10.5, bob-6, 2, 0, Math.PI*2); ctx.fill();
  } else if (isFall) {
    // Arms out to sides for balance
    ctx.strokeStyle = C_LIMB;
    ctx.beginPath(); ctx.moveTo(7, bob); ctx.lineTo(12, bob+5); ctx.stroke();
    ctx.fillStyle = C_LIMB; ctx.beginPath(); ctx.arc(12.5, bob+6, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = C_BACK;
    ctx.beginPath(); ctx.moveTo(7, bob+1); ctx.lineTo(11, bob+6); ctx.stroke();
    ctx.fillStyle = C_BACK; ctx.beginPath(); ctx.arc(11.5, bob+7, 2, 0, Math.PI*2); ctx.fill();
  } else if (isRun) {
    // Front paws pump in opposite phase to back legs
    const fa = Math.sin(f);
    ctx.strokeStyle = C_BACK;
    ctx.beginPath(); ctx.moveTo(7, bob); ctx.lineTo(7 - fa*1.5, bob+6); ctx.stroke();
    ctx.strokeStyle = C_LIMB;
    ctx.beginPath(); ctx.moveTo(8, bob); ctx.lineTo(8 + fa*1.5, bob+6); ctx.stroke();
  }

  // ── Head (drawn last so it's on top of everything) ──────────────
  // Back of skull (shadow layer)
  ctx.fillStyle = C_BACK;
  ctx.beginPath(); ctx.arc(9, bob-6, 8, 0, Math.PI*2); ctx.fill();
  // Main head
  ctx.fillStyle = C_BODY;
  ctx.beginPath(); ctx.arc(10.5, bob-6, 7.5, 0, Math.PI*2); ctx.fill();
  // Cheek/face highlight
  ctx.fillStyle = C_BELLY;
  ctx.beginPath(); ctx.ellipse(14, bob-4.5, 5, 3.5, 0.15, 0, Math.PI*2); ctx.fill();

  // Ear (outer)
  ctx.fillStyle = C_EAR_O;
  ctx.beginPath(); ctx.ellipse(6.5, bob-13.5, 3.5, 5.5, -0.25, 0, Math.PI*2); ctx.fill();
  // Ear (inner pink)
  ctx.fillStyle = C_EAR_I;
  ctx.beginPath(); ctx.ellipse(6.8, bob-13.2, 2, 3.5, -0.25, 0, Math.PI*2); ctx.fill();

  // Snout
  ctx.fillStyle = C_SNOUT;
  ctx.beginPath(); ctx.ellipse(17, bob-5, 5, 3.2, -0.1, 0, Math.PI*2); ctx.fill();
  // Nose
  ctx.fillStyle = C_NOSE;
  ctx.beginPath(); ctx.arc(21.2, bob-5, 1.8, 0, Math.PI*2); ctx.fill();

  // Eye: red iris → dark pupil → white specular
  ctx.fillStyle = '#c03020';
  ctx.beginPath(); ctx.arc(13.5, bob-9, 2.3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(13.5, bob-9, 1.2, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(14.1, bob-9.6, 0.6, 0, Math.PI*2); ctx.fill();

  // Whiskers (3 per side)
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(18.5, bob-6);   ctx.lineTo(26, bob-9);   ctx.stroke();
  ctx.beginPath(); ctx.moveTo(18.5, bob-5);   ctx.lineTo(26, bob-4.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(18.5, bob-5.5); ctx.lineTo(25.5, bob-1.5); ctx.stroke();
}

function drawPlayer() {
  if (gs.phase === 'start') return;  // preview rat handles this during the menu
  const p = gs.p;
  const sx = p.worldX - gs.scrollX; // always = PLAYER_SCREEN_X
  const sy = p.y;
  if (p.state === 'dead' && sy > LH + 80) return;

  ctx.save();
  ctx.translate(sx + PLAYER_W/2, sy + PLAYER_H/2);
  ctx.scale(p.sqX, p.sqY);
  if (p.hitFlash > 0 && Math.floor(p.hitFlash * 10) % 2 === 0) {
    ctx.filter = 'brightness(8) sepia(1) saturate(5) hue-rotate(-60deg)';
  }
  drawRat(p.state, p.frame, p.sliding);
  ctx.restore();
}

function drawGhost() {
  if (!gs.ghostPB.length || gs.ghostIdx < 2) return;
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.translate(gs.ghostX - gs.scrollX + PLAYER_W/2, gs.ghostY + PLAYER_H/2);
  ctx.filter = 'hue-rotate(160deg) saturate(0.6)';
  drawRat('run', Math.floor(Date.now()/120) % 4, false);
  ctx.restore();
}

function drawParticles() {
  for (const p of gs.particles) {
    ctx.save();
    ctx.globalAlpha = p.life / p.ml;
    ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x - gs.scrollX, p.y, p.r, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
}

function drawPopups() {
  for (const p of gs.popups) {
    ctx.save(); ctx.globalAlpha = p.life / p.ml;
    ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 13px Courier New'; ctx.textAlign = 'center';
    ctx.fillText(p.text, p.x - gs.scrollX, p.y);
    ctx.restore();
  }
}

function drawSpeedLines() {
  const intensity = Math.max(0, (gs.speed / BASE_SPEED - 1.6) / 1.4);
  if (intensity < 0.02) return;
  ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${intensity * 0.1})`; ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    const x = (Math.random() * LW); const y = 20 + Math.random() * (LH - 40);
    const len = (15 + Math.random() * 35) * intensity;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len, y); ctx.stroke();
  }
  ctx.restore();
}

function drawRain() {
  if (gs.zoneIdx !== 2) return;
  const isNight = ['Night','Dusk'].includes(TOD[gs.todIdx].name);
  ctx.save();
  ctx.strokeStyle = isNight ? 'rgba(180,80,240,0.28)' : 'rgba(200,220,255,0.22)';
  ctx.lineWidth = 1;
  const t = Date.now() * 0.022;
  for (let i = 0; i < 36; i++) {
    const x = (i * 25 + t * 1.8) % LW; const y = (i * 37 + t * 5) % LH;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x-2, y+9); ctx.stroke();
  }
  ctx.restore();
}

function render() {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(gs.shakeX, gs.shakeY);

  drawSky();
  drawStars();
  drawBuildings(gs.farBldgs,  gs.pxFar,  0.38);
  drawBuildings(gs.midBldgs,  gs.pxMid,  0.68);
  drawBuildings(gs.nearBldgs, gs.pxNear, 1.0);
  drawGround();
  drawRain();
  drawPlatforms();
  drawHazards();
  drawGhost();
  drawPlayer();

  // Preview rat running behind the start-screen menu
  if (gs.phase === 'start') {
    ctx.save();
    ctx.translate(PLAYER_SCREEN_X + PLAYER_W / 2, GROUND_Y - PLAYER_H + PLAYER_H / 2);
    drawRat('run', gs.menuFrame, false);
    ctx.restore();
  }
  drawParticles();
  drawPopups();
  drawSpeedLines();

  ctx.restore();
}

// ─── GAME LOOP ─────────────────────────────────────────────────
let lastTime = 0;

function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  if (gs.phase === 'playing') {
    gs.scrollX += gs.speed * dt * 60;
    updatePlayer(dt);
    updateHazards(dt);
    updateCrumble(dt);
    checkCollisions();
    spawnChunks();
    updateParticles(dt);
    updateParallax(dt);
    updateProgression(dt);
    recordGhostFrame();
    updateGhost();
  } else if (gs.phase === 'start') {
    // Animate cityscape behind the menu
    gs.scrollX  += BASE_SPEED * 0.75 * dt * 60;
    updateParallax(dt);
    gs.todT += dt;
    if (gs.todT >= 60) { gs.todT -= 60; gs.todIdx = (gs.todIdx + 1) % TOD.length; }
    gs.menuFrameT += dt;
    if (gs.menuFrameT > 0.12) { gs.menuFrameT = 0; gs.menuFrame = (gs.menuFrame + 1) % 4; }
  }

  render();

  requestAnimationFrame(loop);
}

// ─── GAME STATE TRANSITIONS ────────────────────────────────────
function startGame() {
  ensureAudio();
  resetGS();
  gs.phase = 'playing';
  loadGhost();

  // Initial safe ground so player lands immediately
  gs.platforms.push({ x: -50, y: GROUND_Y, w: LW + 100, h: 20, type: 'ground' });
  gs.nextChunkX = LW + 80;

  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('gameover-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('score-display').textContent = '0';
  document.getElementById('hs-line').textContent = 'Best: ' + getHS().toLocaleString();
  updateTodIcon();
  startAmbient();
}

function showGameOver() {
  gs.phase = 'gameover';
  stopAmbient();
  const s = Math.floor(gs.score);
  saveScore(s);
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('gameover-screen').classList.remove('hidden');
  document.getElementById('death-cause').textContent = gs.deathCause || 'You fell off the roof!';
  document.getElementById('go-score').textContent = s.toLocaleString();
  document.getElementById('go-highscore').textContent = getHS().toLocaleString();
  document.getElementById('go-dist').textContent = Math.floor(gs.distance) + 'm';
  document.getElementById('go-jumps').textContent = gs.jumpCount;
}

function showLeaderboard() {
  const lb = getLB();
  const el = document.getElementById('leaderboard-list');
  el.innerHTML = lb.length
    ? lb.map((e, i) => `<div class="lb-row"><span class="lb-rank">#${i+1}</span><span class="lb-score">${e.score.toLocaleString()}</span><span class="lb-date">${e.date}</span></div>`).join('')
    : '<div class="lb-empty">No runs yet — play to set a record!</div>';
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('leaderboard-screen').classList.remove('hidden');
}

function toggleMute() {
  muted = !muted;
  localStorage.setItem('rr_muted', muted);
  document.getElementById('mute-btn').textContent = muted ? '🔇' : '🔊';
  if (muted) stopAmbient(); else if (gs.phase === 'playing') startAmbient();
}

// ─── EVENT LISTENERS ───────────────────────────────────────────
document.getElementById('play-btn').addEventListener('click', () => { ensureAudio(); startGame(); });
document.getElementById('leaderboard-btn').addEventListener('click', showLeaderboard);
document.getElementById('lb-close-btn').addEventListener('click', () => {
  document.getElementById('leaderboard-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
});
document.getElementById('retry-btn').addEventListener('click', startGame);
document.getElementById('menu-btn-go').addEventListener('click', () => {
  gs.phase = 'start';
  document.getElementById('gameover-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
});
document.getElementById('mute-btn').addEventListener('click', toggleMute);

canvas.addEventListener('click', () => { ensureAudio(); if (gs.phase === 'start') startGame(); });

// ─── INIT ──────────────────────────────────────────────────────
resetGS();
document.getElementById('hud').classList.add('hidden');
document.getElementById('mute-btn').textContent = muted ? '🔇' : '🔊';
if (getHS() > 0) document.getElementById('start-best').textContent = 'Best: ' + getHS().toLocaleString();

requestAnimationFrame(ts => { lastTime = ts; requestAnimationFrame(loop); });
