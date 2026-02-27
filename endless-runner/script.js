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
function sfxPowerUp()   { playTone(660, 0.09, 'sine', 0.13); setTimeout(() => playTone(880, 0.09, 'sine', 0.12), 65); setTimeout(() => playTone(1100, 0.14, 'sine', 0.14), 130); }
function sfxCoin()      { playTone(1040 + Math.random() * 80, 0.06, 'sine', 0.09); }

// ─── SMOOTH JAZZ ────────────────────────────────────────────────
// Chord progression: Dm7 → G7 → Cmaj7 → Am7  (ii–V–I–vi in C major)
// Each entry: walking bass notes [beat0,beat1,beat2,beat3], chord voicing notes
const JAZZ_CHORDS = [
  { bass: [73.4, 110.0, 73.4, 98.0],    notes: [146.8, 174.6, 220.0, 261.6] }, // Dm7
  { bass: [98.0, 146.8, 98.0, 130.8],   notes: [196.0, 246.9, 293.7, 349.2] }, // G7
  { bass: [130.8, 196.0, 130.8, 110.0], notes: [261.6, 329.6, 392.0, 493.9] }, // Cmaj7
  { bass: [110.0, 164.8, 110.0,  73.4], notes: [220.0, 261.6, 329.6, 392.0] }, // Am7
];
// Melody: 8 eighth-note slots per chord (2 per beat), 0 = rest
const JAZZ_MEL = [
  [293.7,     0, 349.2, 392.0, 440.0,     0, 392.0, 349.2], // over Dm7
  [392.0,     0, 440.0, 493.9, 523.3,     0, 493.9, 440.0], // over G7
  [523.3, 587.3, 659.3,     0, 587.3, 523.3, 493.9,     0], // over Cmaj7
  [440.0, 493.9, 523.3,     0, 493.9, 440.0, 392.0,     0], // over Am7
];

let jazzGain  = null;   // master gain node for all jazz output
let jazzTimer = null;   // setInterval handle
let jazzBeat  = 0;      // 0–15, one full 4-bar cycle = 16 beats
let jazzNext  = 0;      // next scheduled audioCtx time

function jazzIntensity() {
  if (!gs || gs.phase !== 'playing') return 0;
  return Math.min(1, (gs.speed - BASE_SPEED) / (BASE_SPEED * 2));
}
function jazzBpm()  { return 88 + jazzIntensity() * 28; }  // 88→116 BPM

// Play a pitched note through the jazz master bus
function jNote(freq, t, dur, vol, type = 'sine') {
  if (!audioCtx || !jazzGain || freq <= 0) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.connect(g); g.connect(jazzGain);
  o.type = type; o.frequency.value = freq;
  const att = 0.015, rel = Math.min(0.07, dur * 0.3);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + att);
  g.gain.setValueAtTime(vol, t + dur - rel);
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.start(t); o.stop(t + dur + 0.02);
}

// Synthesized kick: freq-swept sine
function jKick(t) {
  if (!audioCtx || !jazzGain) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.connect(g); g.connect(jazzGain);
  o.type = 'sine';
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(50, t + 0.1);
  g.gain.setValueAtTime(0.28, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o.start(t); o.stop(t + 0.22);
}

// Synthesized snare: triangle body + bandpass noise
function jSnare(t) {
  if (!audioCtx || !jazzGain) return;
  const o = audioCtx.createOscillator(), og = audioCtx.createGain();
  o.connect(og); og.connect(jazzGain);
  o.type = 'triangle'; o.frequency.value = 190;
  og.gain.setValueAtTime(0.1, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  o.start(t); o.stop(t + 0.11);
  const bufLen = Math.floor(audioCtx.sampleRate * 0.09);
  const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource(), bp = audioCtx.createBiquadFilter(), ng = audioCtx.createGain();
  src.buffer = buf;
  bp.type = 'bandpass'; bp.frequency.value = 2800; bp.Q.value = 0.6;
  src.connect(bp); bp.connect(ng); ng.connect(jazzGain);
  ng.gain.setValueAtTime(0.055, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  src.start(t); src.stop(t + 0.11);
}

// Synthesized hi-hat: highpass noise burst
function jHat(t, vol = 0.022) {
  if (!audioCtx || !jazzGain) return;
  const bufLen = Math.floor(audioCtx.sampleRate * 0.04);
  const buf = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource(), hp = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
  src.buffer = buf;
  hp.type = 'highpass'; hp.frequency.value = 9000;
  src.connect(hp); hp.connect(g); g.connect(jazzGain);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  src.start(t); src.stop(t + 0.06);
}

// Schedule beats up to LOOKAHEAD seconds ahead
function scheduleJazz() {
  if (!audioCtx || !jazzGain) return;
  const LOOKAHEAD = 0.14;
  const now       = audioCtx.currentTime;
  const intensity = jazzIntensity();
  const beatDur   = 60 / jazzBpm();
  const half      = beatDur / 2;

  while (jazzNext < now + LOOKAHEAD) {
    const t        = jazzNext;
    const barBeat  = jazzBeat % 4;           // 0–3 within current bar
    const chordIdx = Math.floor(jazzBeat / 4); // which of the 4 chords
    const chord    = JAZZ_CHORDS[chordIdx];

    // ── Walking bass (always present) ─────────────────────────
    jNote(chord.bass[barBeat], t, beatDur * 0.72, 0.14 + intensity * 0.07, 'triangle');

    // ── Chord stabs (kick in at intensity > 0.12) ─────────────
    if (intensity > 0.12 && (barBeat === 0 || (barBeat === 2 && intensity > 0.38))) {
      const chordVol  = 0.03 + intensity * 0.022;
      const stabDur   = beatDur * (barBeat === 0 ? 0.88 : 0.55);
      for (const freq of chord.notes) {
        jNote(freq * (1 + (Math.random() - 0.5) * 0.003), t, stabDur, chordVol, 'sine');
      }
    }

    // ── Kick drum (intensity > 0.22) ──────────────────────────
    if (intensity > 0.22) {
      if (barBeat === 0) jKick(t);
      if (barBeat === 2 && intensity > 0.55) jKick(t);
    }

    // ── Snare on beats 2 & 4 (barBeat 1 & 3, intensity > 0.3) ─
    if (intensity > 0.3 && (barBeat === 1 || barBeat === 3)) jSnare(t);

    // ── Hi-hat (intensity > 0.28); 8th-hat at high intensity ──
    if (intensity > 0.28) {
      const hatVol = 0.016 + intensity * 0.03;
      jHat(t, hatVol);
      if (intensity > 0.65) jHat(t + half, hatVol * 0.55);
    }

    // ── Melody (intensity > 0.38) ─────────────────────────────
    if (intensity > 0.38) {
      const mel    = JAZZ_MEL[chordIdx];
      const slot   = barBeat * 2;
      const melVol = 0.055 + intensity * 0.065;
      if (mel[slot] > 0) {
        const dur = intensity > 0.62 ? half * 0.82 : beatDur * 0.7;
        jNote(mel[slot], t, dur, melVol);
      }
      // 8th-note passing tone at high intensity
      if (intensity > 0.62 && mel[slot + 1] > 0) {
        jNote(mel[slot + 1], t + half, half * 0.78, melVol * 0.72);
      }
    }

    jazzBeat = (jazzBeat + 1) % 16;
    jazzNext += beatDur;
  }
}

function startJazz() {
  if (muted || !audioCtx || jazzGain) return;
  jazzGain = audioCtx.createGain();
  jazzGain.gain.setValueAtTime(0, audioCtx.currentTime);
  jazzGain.gain.linearRampToValueAtTime(0.55, audioCtx.currentTime + 0.6);
  jazzGain.connect(audioCtx.destination);
  jazzBeat = 0;
  jazzNext = audioCtx.currentTime + 0.1;
  jazzTimer = setInterval(scheduleJazz, 50);
}

function stopJazz() {
  if (jazzTimer) { clearInterval(jazzTimer); jazzTimer = null; }
  if (jazzGain && audioCtx) {
    const g = jazzGain;
    jazzGain = null;
    try {
      g.gain.setValueAtTime(g.gain.value, audioCtx.currentTime);
      g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
    } catch(e) {}
    setTimeout(() => { try { g.disconnect(); } catch(e) {} }, 620);
  }
}

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
    props:     [],
    items:     [],
    coins:     [],
    particles: [],
    popups:    [],

    // power-ups
    powerUp:    null,   // { type, t, maxT }
    scoreMulti: 1,

    // coins & combo
    totalCoins:   0,
    combo:        0,
    bestCombo:    0,
    comboDisplayT: 0,   // timer to keep badge visible after last coin
    boostTrailT:  0,    // throttle for boost trail particles

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

    // milestone tracking
    lastMilestoneD: 0,
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
// Chunks return {width, platforms[], hazards[], props[]}

// Place decorative props on a ground section, keeping clear of hazard x positions
function propsFor(sx, w, n, avoidXs = []) {
  const TYPES = ['ac', 'vent', 'tank', 'chimney', 'dish'];
  const out = []; let tries = 0;
  while (out.length < n && tries++ < n * 10) {
    const x = sx + 30 + Math.random() * (w - 60);
    if (avoidXs.some(ax => Math.abs(ax - x) < 54)) continue;
    if (out.some(p => Math.abs(p.x - x) < 54)) continue;
    out.push({ x, type: TYPES[Math.floor(Math.random() * TYPES.length)] });
  }
  return out;
}

function makeChunk(type, sx) {
  const G = GROUND_Y;
  switch (type) {
    case 'flat':
      return { width: 380, platforms: [{ x: sx, y: G, w: 380, h: 20, type: 'ground' }], hazards: [],
        props: propsFor(sx, 380, 2) };

    case 'gap':
      return { width: 480, platforms: [
        { x: sx,       y: G, w: 160, h: 20, type: 'ground' },
        { x: sx + 250, y: G, w: 230, h: 20, type: 'ground' },
      ], hazards: [],
        props: [...propsFor(sx, 150, 1), ...propsFor(sx + 250, 220, 1)] };

    case 'fans':
      return { width: 460, platforms: [{ x: sx, y: G, w: 460, h: 20, type: 'ground' }], hazards: [
        { x: sx + 70,  y: G - 32, w: 28, h: 32, type: 'fan', t: 0 },
        { x: sx + 200, y: G - 32, w: 28, h: 32, type: 'fan', t: 0.6 },
        { x: sx + 340, y: G - 32, w: 28, h: 32, type: 'fan', t: 1.2 },
      ], props: propsFor(sx, 460, 1, [sx+70, sx+200, sx+340]) };

    case 'antennas':
      return { width: 480, platforms: [{ x: sx, y: G, w: 480, h: 20, type: 'ground' }], hazards: [
        { x: sx + 60,  y: G - 55, w: 10, h: 55, type: 'antenna' },
        { x: sx + 160, y: G - 72, w: 10, h: 72, type: 'antenna' },
        { x: sx + 270, y: G - 48, w: 10, h: 48, type: 'antenna' },
        { x: sx + 390, y: G - 62, w: 10, h: 62, type: 'antenna' },
      ], props: propsFor(sx, 480, 1, [sx+60, sx+160, sx+270, sx+390]) };

    case 'staircase':
      return { width: 540, platforms: [
        { x: sx,       y: G,       w: 100, h: 20, type: 'ground' },
        { x: sx + 110, y: G - 60,  w: 90,  h: 14, type: 'platform' },
        { x: sx + 210, y: G - 120, w: 90,  h: 14, type: 'platform' },
        { x: sx + 330, y: G - 60,  w: 80,  h: 14, type: 'platform' },
        { x: sx + 430, y: G,       w: 110, h: 20, type: 'ground' },
      ], hazards: [],
        props: [...propsFor(sx, 90, 1), ...propsFor(sx + 430, 100, 1)] };

    case 'pigeons':
      return { width: 430, platforms: [{ x: sx, y: G, w: 430, h: 20, type: 'ground' }], hazards: [
        { x: sx + 90,  y: G - 100, w: 55, h: 22, type: 'pigeon', vx: -2.2, t: 0 },
        { x: sx + 260, y: G - 55,  w: 55, h: 22, type: 'pigeon', vx: -1.8, t: 1.0 },
      ], props: propsFor(sx, 430, 2, [sx+90, sx+260]) };

    case 'high_low':
      return { width: 500, platforms: [
        { x: sx,       y: G,      w: 110, h: 20, type: 'ground' },
        { x: sx + 120, y: G - 88, w: 150, h: 14, type: 'platform' },
        { x: sx + 120, y: G,      w: 150, h: 20, type: 'ground' },
        { x: sx + 390, y: G,      w: 110, h: 20, type: 'ground' },
      ], hazards: [
        { x: sx + 155, y: G - 32, w: 28, h: 32, type: 'fan', t: 0 },
      ], props: [...propsFor(sx, 100, 1), ...propsFor(sx + 390, 100, 1)] };

    case 'crumble':
      return { width: 520, platforms: [
        { x: sx,       y: G,      w: 90,  h: 20, type: 'ground' },
        { x: sx + 115, y: G - 42, w: 80,  h: 14, type: 'crumble', crumbling: false, crumbleT: 0 },
        { x: sx + 215, y: G - 42, w: 80,  h: 14, type: 'crumble', crumbling: false, crumbleT: 0 },
        { x: sx + 315, y: G - 42, w: 80,  h: 14, type: 'crumble', crumbling: false, crumbleT: 0 },
        { x: sx + 415, y: G - 42, w: 80,  h: 14, type: 'crumble', crumbling: false, crumbleT: 0 },
      ], hazards: [], props: propsFor(sx, 90, 1) };

    case 'steam':
      return { width: 460, platforms: [{ x: sx, y: G, w: 460, h: 20, type: 'ground' }], hazards: [
        { x: sx + 100, y: G - 58, w: 18, h: 58, type: 'steam', t: 0,   period: 2.2 },
        { x: sx + 280, y: G - 58, w: 18, h: 58, type: 'steam', t: 1.1, period: 2.2 },
      ], props: propsFor(sx, 460, 1, [sx+100, sx+280]) };

    case 'rooftop_gap':
      return { width: 540, platforms: [
        { x: sx,       y: G,      w: 150, h: 20, type: 'ground' },
        { x: sx + 230, y: G - 65, w: 85,  h: 14, type: 'platform' },
        { x: sx + 380, y: G,      w: 160, h: 20, type: 'ground' },
      ], hazards: [],
        props: [...propsFor(sx, 140, 1), ...propsFor(sx + 380, 150, 1)] };

    case 'combo':
      return { width: 560, platforms: [{ x: sx, y: G, w: 560, h: 20, type: 'ground' }], hazards: [
        { x: sx + 70,  y: G - 32,  w: 28, h: 32, type: 'fan',    t: 0 },
        { x: sx + 220, y: G - 100, w: 55, h: 22, type: 'pigeon', vx: -2, t: 0 },
        { x: sx + 380, y: G - 32,  w: 28, h: 32, type: 'fan',    t: 0.5 },
      ], props: propsFor(sx, 560, 1, [sx+70, sx+220, sx+380]) };

    default:
      return { width: 380, platforms: [{ x: sx, y: G, w: 380, h: 20, type: 'ground' }], hazards: [], props: [] };
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

const POWERUP_TYPES = ['shield', 'boost', 'magnet'];

function spawnChunks() {
  while (gs.nextChunkX < gs.scrollX + LW * 3) {
    const type = pickChunk(gs.difficulty, gs.lastChunkType, gs.chunkCount);
    const chunkStartX = gs.nextChunkX;
    const chunk = makeChunk(type, chunkStartX);
    gs.platforms.push(...chunk.platforms);
    gs.hazards.push(...chunk.hazards);
    gs.props.push(...chunk.props);
    gs.nextChunkX += chunk.width;
    gs.lastChunkType = type;
    gs.chunkCount++;

    // Spawn 2–4 coins per chunk after grace period
    if (gs.chunkCount > 4) {
      const count = 2 + Math.floor(Math.random() * 3);
      const startX = chunkStartX + chunk.width * 0.15 + Math.random() * chunk.width * 0.15;
      for (let c = 0; c < count; c++) {
        const cx = startX + c * 30;
        const baseY = GROUND_Y - PLAYER_H - 14;
        gs.coins.push({ x: cx, baseY, screenY: baseY, bT: Math.random() * Math.PI * 2, collected: false });
      }
    }

    // Spawn a floating power-up after the grace period (~20% chance per chunk)
    if (gs.chunkCount > 6 && Math.random() < 0.22) {
      const puType = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
      const itemX  = chunkStartX + chunk.width * 0.35 + Math.random() * chunk.width * 0.3;
      const baseY  = GROUND_Y - PLAYER_H - 12;
      gs.items.push({ x: itemX, baseY, screenY: baseY, type: puType, bT: Math.random() * Math.PI * 2, collected: false });
    }
  }
  const cutX = gs.scrollX - 300;
  gs.platforms = gs.platforms.filter(p => p.x + p.w > cutX);
  gs.hazards   = gs.hazards.filter(h => h.x + h.w + 60 > cutX);
  gs.props     = gs.props.filter(p => p.x + 60 > cutX);
  gs.items     = gs.items.filter(i => !i.collected && i.x + 20 > cutX);
  gs.coins     = gs.coins.filter(c => !c.collected && c.x + 12 > cutX);
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
  const px = p.worldX + PLAYER_W / 2, py = p.y + pH / 2;

  // Coin pickup
  for (const coin of gs.coins) {
    if (coin.collected) continue;
    if (Math.abs(px - coin.x) < 20 && Math.abs(py - coin.screenY) < 20) {
      coin.collected = true;
      gs.totalCoins++;
      gs.combo++;
      gs.comboDisplayT = 2.0;
      if (gs.combo > gs.bestCombo) gs.bestCombo = gs.combo;
      const bonus = coinBonus(gs.combo);
      gs.score += bonus;
      popup(coin.x, coin.screenY - 14, '+' + bonus, '#ffd700', 11);
      sfxCoin();
      if (gs.combo === 10) popup(coin.x, coin.screenY - 30, 'HOT STREAK!', '#ff9800', 14);
      if (gs.combo === 25) popup(coin.x, coin.screenY - 30, 'ON FIRE!', '#e74c3c', 16);
    }
  }

  // Power-up item pickup
  for (const item of gs.items) {
    if (item.collected) continue;
    if (Math.abs(px - item.x) < 28 && Math.abs(py - item.screenY) < 28) {
      item.collected = true;
      activatePowerUp(item.type, item.x, item.screenY);
    }
  }

  for (const h of gs.hazards) {
    const hL = h.x, hR = h.x + h.w, hT = h.y, hB = h.y + h.h;
    const xOvlp = pR > hL && pL < hR;
    const yOvlp = pB > hT && pT < hB;
    if (!xOvlp || !yOvlp) continue;

    const lethal = h.type === 'fan' || h.type === 'antenna' || h.type === 'pigeon' || (h.type === 'steam' && h.active);
    if (!lethal) continue;

    // Shield absorbs one hit
    if (gs.powerUp?.type === 'shield') {
      gs.powerUp = null;
      gs.combo = 0;
      p.hitFlash = 1.2; p.state = 'hit';
      shake(0.3, 4);
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 3;
        gs.particles.push({ x: px, y: py, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - 1, life: 0.55, ml: 0.55, col: '#4fc3f7', r: 3 });
      }
      return;
    }

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
  gs.combo = 0;
  shake(0.5, 7); sfxDeath();
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 5;
    gs.particles.push({ x: p.worldX + PLAYER_W/2, y: p.y + PLAYER_H/2, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - 2, life: 0.9, ml: 0.9, col: '#c0392b', r: 4 });
  }
  setTimeout(() => { saveGhost(); showGameOver(); }, 1300);
}

function shake(dur, amt) { gs.shakeTimer = dur; gs.shakeAmt = amt; }

// ─── POWER-UPS ─────────────────────────────────────────────────
const PU_COLORS = { shield: '#4fc3f7', boost: '#ffd740', magnet: '#ce93d8' };
const PU_LABELS = { shield: 'SHIELD!', boost: 'SPEED BOOST!', magnet: 'SCORE ×3!' };

function activatePowerUp(type, x, y) {
  // Cancel any existing power-up cleanly
  if (gs.powerUp) {
    if (gs.powerUp.type === 'magnet') gs.scoreMulti = 1;
    // boost speed restores via updateProgression formula naturally
  }
  const col = PU_COLORS[type];
  if (type === 'shield') {
    gs.powerUp = { type, t: 5.0, maxT: 5.0 };
  } else if (type === 'boost') {
    const natural = Math.min(BASE_SPEED * 3, BASE_SPEED + gs.runTime / 28 * 0.22);
    gs.speed  = Math.min(natural * 1.55, BASE_SPEED * 3);
    gs.powerUp = { type, t: 4.0, maxT: 4.0 };
  } else if (type === 'magnet') {
    gs.scoreMulti = 3;
    gs.powerUp = { type, t: 8.0, maxT: 8.0 };
  }
  popup(x, y - 20, PU_LABELS[type], col, 14);
  sfxPowerUp();
  shake(0.25, 3);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, sp = 2 + Math.random() * 3;
    gs.particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - 1.5, life: 0.6, ml: 0.6, col, r: 3 });
  }
}

function updateItems(dt) {
  for (const item of gs.items) {
    item.bT += dt;
    item.screenY = item.baseY + Math.sin(item.bT * 3) * 5;
  }
}

function updatePowerUp(dt) {
  if (!gs.powerUp) return;
  gs.powerUp.t -= dt;
  if (gs.powerUp.t <= 0) {
    if (gs.powerUp.type === 'magnet') gs.scoreMulti = 1;
    // boost: speed is restored by updateProgression overwriting it next frame
    gs.powerUp = null;
  }
}

function coinBonus(combo) {
  if (combo >= 25) return 500;
  if (combo >= 10) return 200;
  if (combo >= 5)  return 100;
  return 50;
}

function updateCoins(dt) {
  for (const c of gs.coins) {
    c.bT += dt;
    c.screenY = c.baseY + Math.sin(c.bT * 4) * 4;
  }
  // Decay combo display timer
  if (gs.comboDisplayT > 0) gs.comboDisplayT = Math.max(0, gs.comboDisplayT - dt);
}

function updateBoostTrail(dt) {
  if (gs.powerUp?.type !== 'boost') return;
  gs.boostTrailT += dt;
  if (gs.boostTrailT < 0.03) return;
  gs.boostTrailT = 0;
  const p = gs.p;
  for (let i = 0; i < 2; i++) {
    gs.particles.push({
      x:    p.worldX + PLAYER_W * 0.9,
      y:    p.y + PLAYER_H * 0.4 + (Math.random() - 0.5) * 10,
      vx:   -(gs.speed * 0.6 + Math.random() * 2),
      vy:   (Math.random() - 0.5) * 1.5,
      life: 0.2, ml: 0.2,
      col:  Math.random() < 0.5 ? '#ffd740' : '#ff9800',
      r:    2 + Math.random() * 1.5,
    });
  }
}

// ─── PARTICLES & POPUPS ────────────────────────────────────────
function dustAt(x, y) {
  for (let i = 0; i < 5; i++) {
    gs.particles.push({ x, y, vx: (Math.random()-0.5)*3, vy: -Math.random()*2, life: 0.3, ml: 0.3, col: '#bbb', r: 2+Math.random()*2 });
  }
}
function popup(x, y, text, col = '#f1c40f', size = 13) { gs.popups.push({ x, y, text, col, size, life: 1.1, ml: 1.1 }); }

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
  // Only advance natural speed when boost isn't active (boost holds gs.speed elevated)
  if (!gs.powerUp || gs.powerUp.type !== 'boost') {
    gs.speed = Math.min(BASE_SPEED * 3, BASE_SPEED + gs.runTime / 28 * 0.22);
  }
  gs.difficulty = Math.min(4, Math.floor(gs.runTime / 30));
  gs.score += Math.ceil((gs.speed / BASE_SPEED) * 2 * gs.scoreMulti * dt * 60);

  // ToD
  gs.todT += dt;
  if (gs.todT >= 60) { gs.todT -= 60; gs.todIdx = (gs.todIdx + 1) % TOD.length; updateTodIcon(); }

  // Milestones
  const MILESTONES = [
    { d: 100,  text: '100m!',   col: '#2ecc71', size: 15 },
    { d: 500,  text: '500m!',   col: '#3498db', size: 16 },
    { d: 1000, text: '1KM!!',   col: '#9b59b6', size: 18 },
    { d: 2500, text: '2.5KM!',  col: '#e67e22', size: 19 },
    { d: 5000, text: '5KM!!!',  col: '#e74c3c', size: 22 },
  ];
  for (const m of MILESTONES) {
    if (gs.lastMilestoneD < m.d && gs.distance >= m.d) {
      gs.lastMilestoneD = m.d;
      popup(gs.scrollX + PLAYER_SCREEN_X, GROUND_Y - 60, m.text, m.col, m.size);
    }
  }

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

// ─── ROOFTOP PROPS ─────────────────────────────────────────────
// All drawn with origin at ground surface (GROUND_Y), growing upward (−y).
// accent = zone accent color used for small themed highlights.

function drawPropAC(accent) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-15, -1, 30, 3);   // shadow
  ctx.fillStyle = '#3c3c3c'; ctx.fillRect(-14, -14, 28, 14);            // body
  ctx.fillStyle = '#505050'; ctx.fillRect(-14, -15, 28, 3);             // top plate
  ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 1;                       // grill slots
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(-11, -12 + i*3); ctx.lineTo(2, -12 + i*3); ctx.stroke();
  }
  ctx.fillStyle = '#565656'; ctx.fillRect(4, -13, 9, 11);               // fan housing
  ctx.fillStyle = '#2c2c2c'; ctx.beginPath(); ctx.arc(8.5, -7.5, 3.5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#444';    ctx.beginPath(); ctx.arc(8.5, -7.5, 1.5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = accent; ctx.globalAlpha = 0.75;                       // status LED
  ctx.beginPath(); ctx.arc(-10, -2.5, 1.5, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
}

function drawPropVent(_accent) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-5, -1, 10, 3);
  ctx.fillStyle = '#484848'; ctx.fillRect(-4, -22, 8, 22);              // pipe
  ctx.fillStyle = 'rgba(140,75,15,0.32)'; ctx.fillRect(-4, -15, 8, 7); // rust
  ctx.fillStyle = '#5e5e5e'; ctx.fillRect(-7, -25, 14, 5);              // cap
  ctx.fillStyle = '#333';    ctx.fillRect(-7, -25, 14, 2);              // cap shadow
}

function drawPropTank(_accent) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-13, -1, 26, 4);
  ctx.strokeStyle = '#585858'; ctx.lineWidth = 2; ctx.lineCap = 'round';// legs
  ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-6, -18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( 10, 0); ctx.lineTo( 6, -18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo( 6, -18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( 10, 0); ctx.lineTo(-6, -18); ctx.stroke();
  ctx.fillStyle = '#6b4e2a'; ctx.fillRect(-11, -38, 22, 20);            // tank body
  ctx.strokeStyle = '#4a3015'; ctx.lineWidth = 1;                        // stave lines
  for (let x = -8; x <= 8; x += 4) {
    ctx.beginPath(); ctx.moveTo(x, -38); ctx.lineTo(x, -18); ctx.stroke();
  }
  ctx.fillStyle = '#383838';                                             // roof
  ctx.beginPath(); ctx.moveTo(-13, -38); ctx.lineTo(0, -46); ctx.lineTo(13, -38); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4a4a4a'; ctx.fillRect(-12, -39, 24, 3);             // tank rim
}

function drawPropChimney(_accent) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-8, -1, 16, 3);
  ctx.fillStyle = '#5c2a18'; ctx.fillRect(-6, -32, 12, 32);             // brick base
  const rows = ['#6a3020', '#7a3828', '#5e2818'];
  for (let row = 0; row < 5; row++) {
    ctx.fillStyle = rows[row % rows.length];
    const bx = (row % 2) ? -6 : -2;
    for (let cx = bx; cx < 6; cx += 8) { ctx.fillRect(cx, -32 + row*6 + 1, 6, 4); }
  }
  ctx.fillStyle = '#3a1a0a'; ctx.fillRect(-8, -35, 16, 5);              // cap
  ctx.fillStyle = '#2a1008'; ctx.fillRect(-8, -35, 16, 2);              // cap edge
}

function drawPropDish(accent) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-5, -1, 10, 3);
  ctx.fillStyle = '#484848'; ctx.fillRect(-2, -28, 4, 28);              // pole
  ctx.fillStyle = '#3a3a3a'; ctx.fillRect(-5, -4, 10, 4);               // base
  ctx.fillStyle = '#585858'; ctx.fillRect(0, -19, 12, 3);               // arm
  ctx.fillStyle = '#7a7a7a';                                             // dish
  ctx.beginPath(); ctx.ellipse(12, -19, 10, 7, -0.3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ababab';
  ctx.beginPath(); ctx.ellipse(12, -19, 8, 5.5, -0.3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#484848';
  ctx.beginPath(); ctx.arc(16, -13, 2.5, 0, Math.PI*2); ctx.fill();    // LNB
  ctx.fillStyle = accent; ctx.globalAlpha = 0.65;
  ctx.beginPath(); ctx.arc(16, -13, 1, 0, Math.PI*2); ctx.fill();      // signal light
  ctx.globalAlpha = 1;
}

function drawProps() {
  const acc = ZONES[gs.zoneIdx].accent;
  for (const p of gs.props) {
    const sx = p.x - gs.scrollX;
    if (sx + 60 < 0 || sx - 60 > LW) continue;
    ctx.save();
    ctx.translate(sx, GROUND_Y);
    switch (p.type) {
      case 'ac':      drawPropAC(acc);      break;
      case 'vent':    drawPropVent(acc);    break;
      case 'tank':    drawPropTank(acc);    break;
      case 'chimney': drawPropChimney(acc); break;
      case 'dish':    drawPropDish(acc);    break;
    }
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

  // Shield aura — drawn before the rat so it appears behind
  if (gs.powerUp?.type === 'shield') {
    const pulse = 17 + Math.sin(Date.now() * 0.007) * 3;
    ctx.save();
    ctx.shadowBlur = 14; ctx.shadowColor = '#4fc3f7';
    ctx.beginPath(); ctx.arc(0, 0, pulse, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(79,195,247,0.55)'; ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

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
    ctx.fillStyle = p.col || '#f1c40f'; ctx.font = `bold ${p.size || 13}px Courier New`; ctx.textAlign = 'center';
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

function drawItems() {
  if (!gs.items.length) return;
  const icons = { shield: '🛡', boost: '⚡', magnet: '×3' };
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const item of gs.items) {
    if (item.collected) continue;
    const sx = item.x - gs.scrollX;
    if (sx < -30 || sx > LW + 30) continue;
    const sy = item.screenY;
    const col = PU_COLORS[item.type];
    // glow ring
    ctx.shadowBlur = 18; ctx.shadowColor = col;
    ctx.beginPath(); ctx.arc(sx, sy, 15, 0, Math.PI * 2);
    ctx.fillStyle = col + '44'; ctx.fill();
    // solid core
    ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(sx, sy, 11, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
    // icon
    ctx.shadowBlur = 0;
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(icons[item.type], sx, sy + 1);
  }
  ctx.restore();
}

function drawCoins() {
  if (!gs.coins.length) return;
  ctx.save();
  ctx.shadowBlur = 10; ctx.shadowColor = '#ffd700';
  for (const c of gs.coins) {
    if (c.collected) continue;
    const sx = c.x - gs.scrollX;
    if (sx < -15 || sx > LW + 15) continue;
    const sy = c.screenY;
    ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd700'; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.shadowBlur = 10;
  }
  ctx.restore();
}

function drawComboHUD() {
  if (gs.phase !== 'playing') return;
  if (gs.combo < 5 && gs.comboDisplayT <= 0) return;
  const displayCombo = gs.combo > 0 ? gs.combo : gs.bestCombo;
  if (displayCombo < 5) return;
  const col = displayCombo >= 25 ? '#e74c3c' : displayCombo >= 10 ? '#ff9800' : '#ffd740';
  ctx.save();
  ctx.shadowBlur = 10; ctx.shadowColor = col;
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = col;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('×' + displayCombo + ' COMBO', 12, LH - 22);
  ctx.restore();
}

function drawPowerUpHUD() {
  if (!gs.powerUp || gs.phase !== 'playing') return;
  const pu  = gs.powerUp;
  const col = PU_COLORS[pu.type];
  const icons = { shield: '🛡', boost: '⚡', magnet: '×3' };
  const frac = Math.max(0, pu.t / pu.maxT);
  const x = 678, y = 12;
  const barW = 68, barH = 5;
  ctx.save();
  // background pill
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - 4, y - 2, 88, 23);
  // icon
  ctx.shadowBlur = 8; ctx.shadowColor = col;
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = col;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(icons[pu.type], x, y + 7);
  // timer bar track
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#333';
  ctx.fillRect(x + 22, y + 5, barW, barH);
  // timer bar fill
  ctx.fillStyle = col;
  ctx.fillRect(x + 22, y + 5, Math.round(barW * frac), barH);
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
  drawProps();
  drawItems();
  drawCoins();
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
  drawComboHUD();
  drawPowerUpHUD();

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
    updateItems(dt);
    updatePowerUp(dt);
    updateBoostTrail(dt);
    updateCoins(dt);
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
  startJazz();
}

function showGameOver() {
  gs.phase = 'gameover';
  stopJazz();
  const s = Math.floor(gs.score);
  const isNewBest = s > 0 && s > getHS();
  saveScore(s);
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('gameover-screen').classList.remove('hidden');
  document.getElementById('death-cause').textContent = gs.deathCause || 'You fell off the roof!';
  document.getElementById('go-zone').textContent  = '📍 ' + ZONES[gs.zoneIdx].name;
  document.getElementById('go-score').textContent = s.toLocaleString();
  document.getElementById('go-highscore').textContent = getHS().toLocaleString();
  document.getElementById('go-dist').textContent  = Math.floor(gs.distance) + 'm';
  document.getElementById('go-jumps').textContent = gs.jumpCount;
  document.getElementById('go-coins').textContent = gs.totalCoins;
  document.getElementById('go-combo').textContent = gs.bestCombo >= 5 ? '×' + gs.bestCombo : '—';
  document.getElementById('gameover-screen').style.setProperty('--zone-accent', ZONES[gs.zoneIdx].accent);
  const nb = document.getElementById('go-newbest');
  if (isNewBest) nb.classList.remove('hidden'); else nb.classList.add('hidden');
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
  if (muted) stopJazz(); else if (gs.phase === 'playing') startJazz();
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
