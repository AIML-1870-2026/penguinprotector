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
const SLIDE_JUMP_VY = -8.5;
const GRAV_UP       = 0.55;
const GRAV_DOWN     = 0.9;
const COYOTE_MS     = 80;
const JUMP_BUF_MS   = 110;

// ─── SEEDED PRNG ────────────────────────────────────────────────
function sfc32(a, b, c, d) {
  return function() {
    a |= 0; b |= 0; c |= 0; d |= 0;
    let t = (a + b | 0) + d | 0; d = d + 1 | 0;
    a = b ^ b >>> 9; b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11); c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
}
function makeDailySeed(dateStr) {
  let h = 2166136261;
  for (let i = 0; i < dateStr.length; i++) { h ^= dateStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  return sfc32(h, h ^ 0xdeadbeef, h ^ 0x12345678, h ^ 0xabcdef01);
}

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
function sfxThunder()   {
  playTone(75, 0.5, 'sawtooth', 0.14);
  setTimeout(() => playTone(50, 0.7, 'sawtooth', 0.09), 200);
  setTimeout(() => playTone(38, 0.9, 'sawtooth', 0.05), 500);
}
function sfxSlideJump() { playTone(300, 0.08, 'sine', 0.10); setTimeout(() => playTone(450, 0.07, 'sine', 0.08), 40); }
function sfxWarn()      {
  playTone(880, 0.07, 'square', 0.06);
  setTimeout(() => playTone(880, 0.07, 'square', 0.06), 180);
  setTimeout(() => playTone(1100, 0.09, 'square', 0.07), 360);
}
function sfxCatHiss() {
  playTone(90,  0.38, 'sawtooth', 0.07);
  playTone(180, 0.28, 'sawtooth', 0.04);
  setTimeout(() => playTone(1300, 0.05, 'square', 0.05), 60);
  setTimeout(() => playTone(1100, 0.07, 'square', 0.04), 180);
}
function sfxCatMeow() {
  playTone(520, 0.12, 'sine', 0.09);
  setTimeout(() => playTone(740, 0.14, 'sine', 0.10), 85);
  setTimeout(() => playTone(420, 0.20, 'sine', 0.07), 210);
}
function sfxZap() {
  playTone(1900, 0.04, 'square', 0.08);
  playTone(240,  0.18, 'sawtooth', 0.05);
  setTimeout(() => playTone(800, 0.05, 'square', 0.06), 25);
}
function sfxMilestone(tier) {
  const freqs = [880, 1047, 1319, 1568, 2093]; // A5 C6 E6 G6 C7
  const f = freqs[Math.min(tier, freqs.length - 1)];
  playTone(f,       0.12, 'sine', 0.14);
  setTimeout(() => playTone(f * 1.25, 0.10, 'sine', 0.10), 80);
  setTimeout(() => playTone(f * 1.5,  0.12, 'sine', 0.08), 160);
}

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
let dailyRNG = null;  // sfc32 generator when daily mode active, else null

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
    landTimer:   0,
    slideJumping: false,
    slideJumpT:   0,
    slideDustT:   0,   // throttle for slide dust particles
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
    lap:         0,
    isDaily:     false,
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
    shakeX: 0, shakeY: 0, shakeTimer: 0, shakeAmt: 0, shakeDur: 0,

    // polish
    speedMilestone: 0,  // last speed tier reached (for one-shot popups)
    comboPulseT:    0,  // brief pulse scale when combo increments

    // menu preview animation
    menuFrame: 0, menuFrameT: 0,

    // milestone tracking
    lastMilestoneD: 0,

    // countdown
    countdownT: 0,
    lastCountdownTick: 4,

    // helicopter
    heli:      null,
    heliTimer: 35,

    // boss encounter
    boss:      null,
    nextBossD: 2000,

    // cat pursuer
    cat:       null,   // { lag, warnedAt200, surgedThisHit }

    // achievements / meta
    achBannerText: '',
    achBannerT:    0,
    hitThisRun:    false,
    catEscapes:    0,
    ironHideUsed:  false,

    // weather
    weather: {
      type:       'clear',
      intensity:  0,
      t:          0,
      nextChange: 50,
      drops:      [],
      lightning:  0,
      fog:        0,
      nextLightning: 12,
    },
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

    case 'clothesline':
      return { width: 440, platforms: [{ x: sx, y: G, w: 440, h: 20, type: 'ground' }], hazards: [
        { x: sx + 80, y: G - 40, w: 260, h: 25, type: 'clothesline' },
      ], props: propsFor(sx, 440, 1, [sx + 80, sx + 340]) };

    case 'clothesline2':
      return { width: 540, platforms: [{ x: sx, y: G, w: 540, h: 20, type: 'ground' }], hazards: [
        { x: sx + 60,  y: G - 40, w: 160, h: 25, type: 'clothesline' },
        { x: sx + 310, y: G - 40, w: 160, h: 25, type: 'clothesline' },
      ], props: propsFor(sx, 540, 1, [sx + 60, sx + 310]) };

    case 'elevator':
      return { width: 500, platforms: [
        { x: sx,       y: G, w: 130, h: 20, type: 'ground' },
        { x: sx + 180, y: G - 100, w: 110, h: 14, type: 'moving',
          oy: G - 100, range: 55, freq: 0.55, t: 0, moving: true },
        { x: sx + 360, y: G, w: 140, h: 20, type: 'ground' },
      ], hazards: [],
        props: [...propsFor(sx, 120, 1), ...propsFor(sx + 360, 130, 1)] };

    case 'bobbing':
      return { width: 560, platforms: [
        { x: sx,       y: G, w: 100, h: 20, type: 'ground' },
        { x: sx + 140, y: G - 80,  w: 80, h: 14, type: 'moving',
          oy: G - 80,  range: 38, freq: 0.9, t: 0,        moving: true },
        { x: sx + 300, y: G - 115, w: 80, h: 14, type: 'moving',
          oy: G - 115, range: 38, freq: 0.9, t: Math.PI,  moving: true },
        { x: sx + 460, y: G, w: 100, h: 20, type: 'ground' },
      ], hazards: [],
        props: [...propsFor(sx, 90, 1), ...propsFor(sx + 460, 90, 1)] };

    case 'zappers':
      // y: G-24, h:10 → wire sits at head height; sliding players (pT=G-9) clear it
      return { width: 480, platforms: [{ x: sx, y: G, w: 480, h: 20, type: 'ground' }], hazards: [
        { x: sx + 80,  y: G - 24, w: 160, h: 10, type: 'zapper', t: 0,   period: 2.6, active: false },
        { x: sx + 300, y: G - 24, w: 160, h: 10, type: 'zapper', t: 1.3, period: 2.6, active: false },
      ], props: propsFor(sx, 480, 1, [sx + 80, sx + 300]) };

    case 'crates':
      // Stacked wooden crates at varying heights; player must jump over each
      return { width: 460, platforms: [{ x: sx, y: G, w: 460, h: 20, type: 'ground' }], hazards: [
        { x: sx + 80,  y: G - 28, w: 28, h: 28, type: 'crate' },   // single
        { x: sx + 220, y: G - 56, w: 28, h: 56, type: 'crate' },   // double stack
        { x: sx + 360, y: G - 28, w: 28, h: 28, type: 'crate' },   // single
      ], props: propsFor(sx, 460, 1, [sx + 80, sx + 220, sx + 360]) };

    case 'tripwire':
      // Ankle-height wire (y: G-14, h:14) — must jump any amount to clear
      return { width: 420, platforms: [{ x: sx, y: G, w: 420, h: 20, type: 'ground' }], hazards: [
        { x: sx + 70,  y: G - 14, w: 80, h: 14, type: 'tripwire', t: 0 },
        { x: sx + 220, y: G - 14, w: 80, h: 14, type: 'tripwire', t: 0 },
        { x: sx + 340, y: G - 14, w: 80, h: 14, type: 'tripwire', t: 0 },
      ], props: propsFor(sx, 420, 1, [sx + 70, sx + 220, sx + 340]) };

    case 'neon_sign':
      // Low-hanging neon sign (y: G-34, h:20) — standing players hit it, sliding clears
      return { width: 440, platforms: [{ x: sx, y: G, w: 440, h: 20, type: 'ground' }], hazards: [
        { x: sx + 70,  y: G - 34, w: 130, h: 20, type: 'neon_sign', col: '#ff3af8', t: 0 },
        { x: sx + 270, y: G - 34, w: 130, h: 20, type: 'neon_sign', col: '#00e5ff', t: 0 },
      ], props: propsFor(sx, 440, 1, [sx + 70, sx + 270]) };

    default:
      return { width: 380, platforms: [{ x: sx, y: G, w: 380, h: 20, type: 'ground' }], hazards: [], props: [] };
  }
}

// ─── CUSTOM CHUNK (from Level Editor) ──────────────────────────
// data: the JSON exported by editor.js  (platforms[], hazards[], width)
// sx:   world-x start position for this spawn instance
function makeChunkFromData(data, sx) {
  const platforms = (data.platforms || []).map(p => {
    const obj = { ...p, x: p.x + sx };
    if (p.type === 'crumble') { obj.crumbling = false; obj.crumbleT = 0; }
    if (p.type === 'moving')  { obj.moving = true; obj.oy = (p.oy ?? p.y); obj.t = 0; }
    return obj;
  });
  const hazards = (data.hazards || []).map(h => ({
    ...h, x: h.x + sx, t: 0,
    ...(h.type === 'pigeon' ? { vx: h.vx ?? -2 } : {}),
  }));
  return { width: data.width ?? 600, platforms, hazards, props: [] };
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
  { type: 'elevator',    min: 2, w: 2 },
  { type: 'bobbing',     min: 3, w: 1 },
  { type: 'clothesline', min: 1, w: 3 },
  { type: 'clothesline2',min: 2, w: 2 },
  { type: 'zappers',     min: 2, w: 2 },
  { type: 'crates',     min: 1, w: 3 },
  { type: 'tripwire',   min: 0, w: 2 },
  { type: 'neon_sign',  min: 2, w: 2 },
];

// Chunks that force the player into the air (jumping required to clear ground hazards or gaps)
const AIRBORNE_CHUNKS = new Set(['fans', 'antennas', 'combo', 'gap', 'staircase', 'high_low', 'rooftop_gap', 'crumble', 'crates', 'tripwire']);

function pickChunk(diff, lastType, chunkCount) {
  // Grace period: guarantee flat ground for the first 4 chunks
  if (chunkCount < 4) return 'flat';
  const rng = dailyRNG || Math.random;
  // Reduce flat weight per lap so obstacles get denser over time
  const pool = CHUNK_DEFS.filter(c => c.min <= diff)
    .map(c => c.type === 'flat' ? { ...c, w: Math.max(2, 7 - gs.lap * 2) } : c);
  // Never spawn 'pigeons' directly after a jump-forcing chunk — the low pigeon
  // sits at G-55 and collides with any airborne player, making it undodgeable.
  const runPool = AIRBORNE_CHUNKS.has(lastType) ? pool.filter(c => c.type !== 'pigeons') : pool;
  const total = runPool.reduce((s, c) => s + c.w, 0);
  let r = rng() * total;
  for (const c of runPool) { r -= c.w; if (r <= 0) return c.type; }
  return 'flat';
}

const DEATH_MSGS = {
  fan:         ['Sliced by a ventilation fan!', 'Diced by the rooftop fan!', 'The fan had other plans.', 'Should have ducked.'],
  antenna:     ['Impaled on an antenna!', 'Antenna to the face!', 'Radio silence — permanently.', 'Spiked.'],
  pigeon:      ['Smacked by a pigeon flock!', 'Absolute bird chaos!', 'Ambushed by pigeons!', 'Should have packed birdseed.', 'The birds won.'],
  steam:       ['Scalded by a steam pipe!', 'Boiled alive on a rooftop!', 'HOT HOT HOT!', 'Steam: 1, Rat: 0.'],
  clothesline: ['Clotheslined by laundry!', "Taken out by someone's pants!", 'Stopped by dry cleaning.', 'Laundry day claims another victim.'],
  zapper:      ['Zapped by the wire!', 'Electrocuted in style.', 'Short-circuited!', 'Bzzt! Game over.', 'Conducted poorly.'],
  spotlight:   ['Caught in the searchlight!', 'The feds had a bead on you.', 'Nowhere to hide from the light.', 'Lights out.'],
  boss:        ['Caught in the APB spotlight!', 'The law caught up with you.', "Can't outrun justice.", 'Busted!'],
  cat:         ['Caught by the alley cat!', 'The cat always wins.', 'Nine lives — you had one.', 'Pounced!', 'Should have gone left.'],
  fall:        ['Fell off the roof!', 'Misjudged that jump.', 'The ground said no.', 'Gravity wins again.'],
  crate:       ['Tripped over a crate!', 'The cargo wins.', "Shouldn't have skipped leg day.", 'Crate expectations unmet.'],
  tripwire:    ['Caught the tripwire!', 'Watch your step.', 'Face-first into the wire.', 'Should have hopped.'],
  neon_sign:   ['Walked into a neon sign!', 'The sign said EXIT — you exited.', 'Neon to the face.', 'Ducking is an option, y\'know.'],
};
function randMsg(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const POWERUP_TYPES = ['shield', 'boost', 'magnet', 'umbrella'];

// ─── UPGRADES ──────────────────────────────────────────────────
const UPGRADES = [
  { id: 'coyote',    name: 'Springy Legs',  desc: 'Jump timing is more forgiving (+60ms coyote)', cost: 30 },
  { id: 'magnet',    name: 'Coin Magnet',   desc: 'Collect coins from farther away',               cost: 45 },
  { id: 'luckystart',name: 'Lucky Start',   desc: 'Begin each run with a random power-up',         cost: 65 },
  { id: 'ironhide',  name: 'Iron Hide',     desc: 'Absorb the first hazard hit each run',          cost: 90 },
];

// ─── SKINS ─────────────────────────────────────────────────────
const SKINS = [
  { id:'default', name:'Street Rat',  cost:0,   body:'#9a4a18', back:'#6b3010', belly:'#c07030', limb:'#7a3810', snout:'#b86828', earO:'#c87030', earI:'#e87890', nose:'#ff7090' },
  { id:'albino',  name:'Albino',      cost:50,  body:'#f0e8e0', back:'#d8ccc0', belly:'#ffe8e0', limb:'#e0d0c0', snout:'#eed0c0', earO:'#f0c0b0', earI:'#ffb0c0', nose:'#ff8090' },
  { id:'shadow',  name:'Shadow',      cost:75,  body:'#252525', back:'#0e0e0e', belly:'#383838', limb:'#1a1a1a', snout:'#2e2e2e', earO:'#303030', earI:'#606080', nose:'#8888aa' },
  { id:'sewer',   name:'Sewer King',  cost:100, body:'#3a7a18', back:'#204a08', belly:'#7a9a18', limb:'#2a5a10', snout:'#4a8a20', earO:'#5a8a18', earI:'#a8c840', nose:'#ffdd00' },
  { id:'neon',    name:'Neon Rat',    cost:150, body:'#1a3a6a', back:'#0a1a3a', belly:'#2a4a8a', limb:'#0e2a5a', snout:'#1e4a7a', earO:'#2060a0', earI:'#e91e8c', nose:'#00ffcc' },
  { id:'ghost',    name:'Ghost',    cost:0, unlock:'no_hits',      body:'#e8e8f0', back:'#d0d0e0', belly:'#f4f4ff', limb:'#dcdce8', snout:'#e4e4f0', earO:'#dcdcf0', earI:'#c8c8f0', nose:'#b0b0d0' },
  { id:'golden',   name:'Golden',   cost:0, unlock:'speed_max',    body:'#d4a017', back:'#b8860b', belly:'#f5c842', limb:'#c8960f', snout:'#e8b820', earO:'#e0a818', earI:'#ffe066', nose:'#ff9900' },
  { id:'outlaw',   name:'Outlaw',   cost:0, unlock:'survive_boss', body:'#6b1010', back:'#3d0808', belly:'#8b2020', limb:'#520e0e', snout:'#7a1414', earO:'#7a1414', earI:'#b04040', nose:'#ff4444' },
  { id:'cheshire', name:'Cheshire', cost:0, unlock:'outrun_cat',   body:'#8b14c8', back:'#5a0e88', belly:'#c040e8', limb:'#6a1098', snout:'#a020d8', earO:'#a018d0', earI:'#e070ff', nose:'#ff00cc' },
];

// ─── HATS ───────────────────────────────────────────────────────
const HATS = [
  { id:'none',    name:'No Hat',       cost:0  },
  { id:'beanie',  name:'Beanie',       cost:30 },
  { id:'tophat',  name:'Top Hat',      cost:60 },
  { id:'hardhat', name:'Hard Hat',     cost:40 },
  { id:'crown',   name:'Crown',        cost:80 },
  { id:'cap',     name:'Baseball Cap', cost:35 },
];

// ─── ACHIEVEMENTS ───────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id:'double_jump',  name:'Double Trouble',  desc:'Perform a double jump',              icon:'↑↑' },
  { id:'combo10',      name:'Combo King',       desc:'Reach a 10× coin combo',             icon:'🪙' },
  { id:'coins50',      name:'Hoarder',          desc:'Collect 50 coins in one run',        icon:'💰' },
  { id:'zone_neon',    name:'Neon Nights',      desc:'Reach the Neon District',            icon:'🌆' },
  { id:'zone_sky',     name:'Rooftop Legend',   desc:'Reach the Skyline zone',             icon:'🏙' },
  { id:'survive_boss', name:'Outlaw',           desc:'Survive an APB boss encounter',      icon:'🚔' },
  { id:'survive120',   name:'The Long Game',    desc:'Survive for 120 seconds',            icon:'⏱' },
  { id:'speed_max',    name:'Speed Demon',      desc:'Reach top speed (3× base)',          icon:'⚡' },
  { id:'no_hits',      name:'Ghost Run',        desc:'Finish a run without getting hit',   icon:'👻' },
  { id:'outrun_cat',   name:'Nine Lives',       desc:'Escape the alley cat 3 times',      icon:'🐱' },
];

function spawnChunks() {
  while (gs.nextChunkX < gs.scrollX + LW * 3) {
    let type, chunk;
    const chunkStartX = gs.nextChunkX;
    if (window.__rr_testChunk) {
      type  = 'custom';
      chunk = makeChunkFromData(window.__rr_testChunk, chunkStartX);
    } else {
      type  = pickChunk(gs.difficulty, gs.lastChunkType, gs.chunkCount);
      chunk = makeChunk(type, chunkStartX);
    }
    gs.platforms.push(...chunk.platforms);
    gs.hazards.push(...chunk.hazards);
    gs.props.push(...chunk.props);
    gs.nextChunkX += chunk.width;
    gs.lastChunkType = type;
    gs.chunkCount++;

    // Spawn 2–4 coins per chunk after grace period (skipped in test mode)
    if (!window.__rr_testChunk && gs.chunkCount > 4) {
      const count = 2 + Math.floor(Math.random() * 3);
      const startX = chunkStartX + chunk.width * 0.15 + Math.random() * chunk.width * 0.15;
      for (let c = 0; c < count; c++) {
        const cx = startX + c * 30;
        const baseY = GROUND_Y - PLAYER_H - 14;
        gs.coins.push({ x: cx, baseY, screenY: baseY, bT: Math.random() * Math.PI * 2, collected: false });
      }
    }

    // Spawn a floating power-up after the grace period (~20% chance per chunk)
    if (!window.__rr_testChunk && gs.chunkCount > 6 && Math.random() < 0.22) {
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
  if (p.sliding)                  { doSlideJump(); }
  else if (p.grounded || p.coyote > 0) { doJump(); }
  else if (p.jumps < 2)           { doDblJump(); }
  else                            { p.jumpBuf = JUMP_BUF_MS; }
}
function doJump() {
  const wet = gs.weather && (gs.weather.type === 'heavy' || gs.weather.type === 'storm');
  const p = gs.p; p.vy = JUMP_VY * (wet ? 0.85 : 1.0); p.grounded = false;
  p.coyote = 0; p.jumps = 1; p.state = 'jump';
  p.sqY = 1.35; p.sqX = 0.72;
  gs.jumpCount++; sfxJump();
  dustAt(p.worldX + PLAYER_W / 2, p.y + PLAYER_H);
}
function doDblJump() {
  const p = gs.p; p.vy = DBL_JUMP_VY; p.jumps = 2; p.state = 'jump';
  p.sqY = 1.2; gs.jumpCount++; sfxDblJump();
  unlockAchievement('double_jump');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    gs.particles.push({ x: p.worldX + PLAYER_W/2, y: p.y + PLAYER_H/2, vx: Math.cos(a)*2.5, vy: Math.sin(a)*2.5-1, life: 0.4, ml: 0.4, col: '#f39c12', r: 3 });
  }
}
function doSlideJump() {
  const p = gs.p;
  p.vy = SLIDE_JUMP_VY; p.grounded = false; p.coyote = 0; p.jumps = 1;
  p.state = 'jump'; p.slideJumping = true; p.slideJumpT = 0.5;
  p.sqY = 1.1; p.sqX = 0.85;
  gs.jumpCount++; sfxSlideJump();
  dustAt(p.worldX + PLAYER_W / 2, p.y + PLAYER_H);
}

// ─── PLAYER UPDATE ─────────────────────────────────────────────
function updatePlayer(dt) {
  const p = gs.p;
  if (p.state === 'dead') { p.vy += GRAV_DOWN * dt * 60; p.y += p.vy * dt * 60; return; }

  p.worldX = gs.scrollX + PLAYER_SCREEN_X;

  // Slide-jump timer
  if (p.slideJumping) {
    p.slideJumpT -= dt;
    if (p.slideJumpT <= 0 || p.grounded) p.slideJumping = false;
  }

  // Sliding (also true while slide-jumping to keep hitbox low)
  p.sliding = (p.wantSlide && p.grounded) || p.slideJumping;

  // Slide dust trail
  if (p.sliding && p.grounded) {
    p.slideDustT -= dt;
    if (p.slideDustT <= 0) {
      p.slideDustT = 0.07;
      for (let i = 0; i < 3; i++) {
        gs.particles.push({
          x: p.worldX + Math.random() * PLAYER_W,
          y: p.y + SLIDE_H + Math.random() * 3,
          vx: -(0.6 + Math.random() * 1.8),
          vy: -(Math.random() * 1.0),
          life: 0.22, ml: 0.22,
          col: Math.random() < 0.5 ? '#b09878' : '#907860',
          r: 1.5 + Math.random() * 1.5,
        });
      }
    }
  } else {
    p.slideDustT = 0;
  }

  // Coyote timer
  if (!p.grounded) p.coyote = Math.max(0, p.coyote - dt * 1000);

  // Jump buffer
  if (p.jumpBuf > 0) {
    p.jumpBuf -= dt * 1000;
    if (p.grounded && p.jumpBuf > 0) { p.jumpBuf = 0; doJump(); }
  }

  // Gravity: variable height; umbrella slows descent
  let grav = (!p.holdJump && p.vy < 0) ? GRAV_DOWN * 1.6 : (p.vy < 0 ? GRAV_UP : GRAV_DOWN);
  if (gs.powerUp?.type === 'umbrella' && p.vy > 0) {
    grav = GRAV_DOWN * 0.15;
    if (p.vy > 2.4) p.vy = 2.4;
  }
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
      p.y = top - pH; p.vy = 0; p.grounded = true; p.jumps = 0; p.coyote = COYOTE_MS + (hasUpgrade('coyote') ? 60 : 0);
      if (!wasGrounded) {
        p.state = 'land'; p.sqY = 1.45; p.sqX = 0.7; p.landTimer = 0.12;
        sfxLand(); dustAt(p.worldX + PLAYER_W/2, p.y + pH);
        if (pl.type === 'crumble' && !pl.crumbling) { pl.crumbling = true; pl.crumbleT = 0.48; }
      }
    }
  }

  // Fall below = death
  if (p.y > LH + 80) { killPlayer(randMsg(DEATH_MSGS.fall)); return; }

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

function updateMovingPlatforms(dt) {
  for (const pl of gs.platforms) {
    if (!pl.moving) continue;
    pl.t += dt;
    pl.y = pl.oy + Math.sin(pl.t * pl.freq) * pl.range;
  }
}

// ─── HAZARDS ───────────────────────────────────────────────────
function updateHazards(dt) {
  for (const h of gs.hazards) {
    h.t += dt;
    if (h.type === 'pigeon') h.x += (h.vx || -2) * (gs.speed / BASE_SPEED) * dt * 60;
    if (h.type === 'zapper') {
      const nowActive = (h.t % h.period) < (h.period * 0.5);
      if (nowActive && !h.active) sfxZap();
      h.active = nowActive;
    }
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
  const coinR = hasUpgrade('magnet') ? 34 : 20;
  for (const coin of gs.coins) {
    if (coin.collected) continue;
    if (Math.abs(px - coin.x) < coinR && Math.abs(py - coin.screenY) < coinR) {
      coin.collected = true;
      gs.totalCoins++;
      gs.combo++;
      gs.comboDisplayT = 2.0;
      gs.comboPulseT   = 0.18;
      if (gs.combo > gs.bestCombo) gs.bestCombo = gs.combo;
      const bonus = coinBonus(gs.combo);
      gs.score += bonus;
      popup(coin.x, coin.screenY - 14, '+' + bonus, '#ffd700', 11);
      sfxCoin();
      if (gs.combo === 10) { popup(coin.x, coin.screenY - 30, 'HOT STREAK!', '#ff9800', 14); unlockAchievement('combo10'); }
      if (gs.combo === 25) popup(coin.x, coin.screenY - 30, 'ON FIRE!', '#e74c3c', 16);
      if (gs.totalCoins >= 50) unlockAchievement('coins50');
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

    const lethal = h.type === 'fan' || h.type === 'antenna' || h.type === 'pigeon' || (h.type === 'steam' && h.active) || h.type === 'clothesline' || (h.type === 'zapper' && h.active) || h.type === 'crate' || h.type === 'tripwire' || h.type === 'neon_sign';
    if (!lethal) continue;

    // Shield absorbs one hit (power-up OR Iron Hide upgrade first hit)
    const hasShield = gs.powerUp?.type === 'shield';
    const ironHideActive = hasUpgrade('ironhide') && !gs.ironHideUsed;
    if (hasShield || ironHideActive) {
      if (hasShield) gs.powerUp = null;
      if (ironHideActive) { gs.ironHideUsed = true; }
      gs.combo = 0;
      gs.hitThisRun = true;
      p.hitFlash = 1.2; p.state = 'hit';
      shake(0.3, 4);
      const col = hasShield ? '#4fc3f7' : '#ff9800';
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 3;
        gs.particles.push({ x: px, y: py, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - 1, life: 0.55, ml: 0.55, col, r: 3 });
      }
      if (ironHideActive && !hasShield) popup(px, py - 20, 'IRON HIDE!', '#ff9800', 13);
      if (gs.cat) gs.cat.lag -= 60;  // cat surges on hit
      return;
    }

    if (h.type === 'fan')        killPlayer(randMsg(DEATH_MSGS.fan));
    if (h.type === 'antenna')    killPlayer(randMsg(DEATH_MSGS.antenna));
    if (h.type === 'pigeon')     killPlayer(randMsg(DEATH_MSGS.pigeon));
    if (h.type === 'steam' && h.active) killPlayer(randMsg(DEATH_MSGS.steam));
    if (h.type === 'clothesline') killPlayer(randMsg(DEATH_MSGS.clothesline));
    if (h.type === 'zapper' && h.active) killPlayer(randMsg(DEATH_MSGS.zapper));
    if (h.type === 'crate')      killPlayer(randMsg(DEATH_MSGS.crate));
    if (h.type === 'tripwire')   killPlayer(randMsg(DEATH_MSGS.tripwire));
    if (h.type === 'neon_sign')  killPlayer(randMsg(DEATH_MSGS.neon_sign));
  }
}

function playerUnderCover() {
  const p = gs.p;
  return gs.platforms.some(pl =>
    pl.y < p.y &&
    pl.x < p.worldX + PLAYER_W - 2 &&
    pl.x + pl.w > p.worldX + 2
  );
}

// ─── HELICOPTER ────────────────────────────────────────────────
function updateHeli(dt) {
  if (!gs.heli) {
    if (gs.difficulty < 2) return;
    gs.heliTimer -= dt;
    if (gs.heliTimer > 0) return;
    gs.heliTimer = 30 + Math.random() * 20;
    gs.heli = { x: LW + 80, vx: -115, y: 48 + Math.random() * 20 };
    popup(gs.scrollX + PLAYER_SCREEN_X, 70, '🚁 SEARCHLIGHT!', '#ff4444', 14);
    sfxWarn();
    return;
  }

  gs.heli.x += gs.heli.vx * dt;

  // Beam hit check — only when heli is on screen
  if (gs.heli.x > -30 && gs.heli.x < LW + 30) {
    const inBeam = Math.abs(PLAYER_SCREEN_X - gs.heli.x) < 55;
    if (inBeam && !playerUnderCover() && gs.p.state !== 'dead') {
      if (gs.powerUp?.type === 'shield') {
        gs.powerUp = null; gs.combo = 0;
        gs.hitThisRun = true;
        gs.p.hitFlash = 1.2; gs.p.state = 'hit';
        shake(0.25, 3);
        if (gs.cat) gs.cat.lag -= 60;
      } else {
        killPlayer(randMsg(DEATH_MSGS.spotlight));
      }
    }
  }

  if (gs.heli.x < -200) gs.heli = null;
}

function drawHeli() {
  if (!gs.heli) return;
  const sx = gs.heli.x, hy = gs.heli.y;

  // Spotlight cone (trapezoid gradient)
  const grad = ctx.createLinearGradient(sx, hy + 10, sx, GROUND_Y + 20);
  grad.addColorStop(0, 'rgba(255,255,210,0.34)');
  grad.addColorStop(1, 'rgba(255,255,180,0)');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(sx - 5,  hy + 10);
  ctx.lineTo(sx + 5,  hy + 10);
  ctx.lineTo(sx + 55, GROUND_Y + 20);
  ctx.lineTo(sx - 55, GROUND_Y + 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Helicopter body
  ctx.save();
  ctx.translate(sx, hy);

  // Fuselage
  ctx.fillStyle = '#2e2e2e';
  ctx.beginPath(); ctx.ellipse(0, 0, 22, 9, 0, 0, Math.PI * 2); ctx.fill();

  // Cockpit window
  ctx.fillStyle = '#3a7090';
  ctx.beginPath(); ctx.ellipse(-8, -2, 9, 6, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(140,210,255,0.3)';
  ctx.beginPath(); ctx.ellipse(-9, -3, 6, 4, -0.2, 0, Math.PI * 2); ctx.fill();

  // Rotor
  ctx.save();
  ctx.rotate(Date.now() * 0.018);
  ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.stroke();
  ctx.rotate(Math.PI / 2);
  ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.stroke();
  ctx.restore();

  // Tail boom + fin
  ctx.fillStyle = '#222';
  ctx.fillRect(18, -3, 20, 3);
  ctx.fillRect(36, -8, 3, 8);

  // Tail rotor
  ctx.save();
  ctx.translate(38, -4);
  ctx.rotate(Date.now() * 0.025);
  ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
  ctx.rotate(Math.PI / 2);
  ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
  ctx.restore();

  // Searchlight lamp
  ctx.shadowBlur = 12; ctx.shadowColor = '#ffff88';
  ctx.fillStyle = '#ffff88';
  ctx.beginPath(); ctx.arc(2, 9, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}

// ─── BOSS ENCOUNTER ────────────────────────────────────────────
function startBoss() {
  gs.heli      = null;
  gs.heliTimer = 999;
  gs.boss = {
    phase:      'approach',
    t:          0,
    x:          LW + 100,
    y:          52,
    vx:         -260,
    beamT:      0,
    survivedT:  0,
    surviveDur: 12,
  };
  shake(0.5, 7);
  sfxWarn();
  setTimeout(sfxWarn, 220);
  popup(gs.scrollX + PLAYER_SCREEN_X, 55, '🚨 APB ISSUED!', '#ff3333', 17);
}

function updateBoss(dt) {
  const boss = gs.boss;
  const p    = gs.p;

  if (boss.phase === 'approach') {
    boss.x += boss.vx * dt;
    if (boss.x <= 85) {
      boss.x    = 85;
      boss.phase = 'pursue';
      boss.t     = 0;
      sfxWarn();
      popup(gs.scrollX + PLAYER_SCREEN_X, 70, '⚠ JUMP TO DODGE!', '#ffcc00', 13);
    }
    return;
  }

  if (boss.phase === 'retreat') {
    boss.x -= 300 * dt;
    if (boss.x < -220) {
      gs.boss      = null;
      gs.heliTimer = 25;
    }
    return;
  }

  // ── pursue ──────────────────────────────────────────────────
  boss.beamT     += dt;
  boss.survivedT += dt;
  boss.y          = 52 + Math.sin(boss.beamT * 1.1) * 3;

  const b1      = PLAYER_SCREEN_X + Math.sin(boss.beamT * 1.5) * 140;
  const b2      = PLAYER_SCREEN_X + Math.sin(boss.beamT * 2.2 + 2.0) * 140;
  const useTwo  = boss.survivedT > 6;

  // Beam only hits near-ground player — jumping clears it
  if (p.state !== 'dead' && p.state !== 'hit' && !playerUnderCover() && p.y > GROUND_Y - 50) {
    const inB1 = Math.abs(PLAYER_SCREEN_X - b1) < 28;
    const inB2 = useTwo && Math.abs(PLAYER_SCREEN_X - b2) < 28;
    if (inB1 || inB2) {
      if (gs.powerUp?.type === 'shield') {
        gs.powerUp = null; gs.combo = 0;
        gs.p.hitFlash = 1.2; gs.p.state = 'hit';
        shake(0.25, 3);
      } else {
        killPlayer(randMsg(DEATH_MSGS.boss));
      }
    }
  }

  if (boss.survivedT >= boss.surviveDur) {
    gs.score     += 750;
    gs.nextBossD  = gs.distance + 2500 + Math.random() * 1000;
    popup(gs.scrollX + PLAYER_SCREEN_X, 50, '🚔 OUTRAN THE FEDS!  +750', '#ff9800', 17);
    shake(0.3, 4);
    boss.phase = 'retreat';
    unlockAchievement('survive_boss');
  }
}

function drawBoss() {
  if (!gs.boss) return;
  const boss = gs.boss;
  const bx = boss.x, by = boss.y;

  // ── Sweeping beam cones ──────────────────────────────────────
  if (boss.phase === 'pursue') {
    const b1     = PLAYER_SCREEN_X + Math.sin(boss.beamT * 1.5) * 140;
    const b2     = PLAYER_SCREEN_X + Math.sin(boss.beamT * 2.2 + 2.0) * 140;
    const useTwo = boss.survivedT > 6;

    const drawBeam = (groundX) => {
      const grad = ctx.createLinearGradient(bx, by + 14, groundX, GROUND_Y + 20);
      grad.addColorStop(0, 'rgba(255,60,60,0.42)');
      grad.addColorStop(1, 'rgba(255,60,60,0)');
      ctx.save();
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(bx - 5,       by + 14);
      ctx.lineTo(bx + 5,       by + 14);
      ctx.lineTo(groundX + 42, GROUND_Y + 20);
      ctx.lineTo(groundX - 42, GROUND_Y + 20);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    drawBeam(b1);
    if (useTwo) drawBeam(b2);
  }

  // ── Boss helicopter body (larger, red-tinted) ────────────────
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(1.35, 1.35);

  // Fuselage
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.ellipse(0, 0, 22, 9, 0, 0, Math.PI * 2); ctx.fill();

  // Red warning stripe
  ctx.fillStyle = '#bb2020';
  ctx.fillRect(-14, -2, 28, 3);

  // Cockpit (dark, menacing)
  ctx.fillStyle = '#182030';
  ctx.beginPath(); ctx.ellipse(-8, -2, 9, 6, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,50,50,0.18)';
  ctx.beginPath(); ctx.ellipse(-9, -3, 6, 4, -0.2, 0, Math.PI * 2); ctx.fill();

  // Main rotor (red)
  ctx.save();
  ctx.rotate(Date.now() * 0.025);
  ctx.strokeStyle = '#cc3333'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.stroke();
  ctx.rotate(Math.PI / 2);
  ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.stroke();
  ctx.restore();

  // Tail boom + fin
  ctx.fillStyle = '#111';
  ctx.fillRect(18, -3, 20, 3);
  ctx.fillRect(36, -8, 3, 8);

  // Tail rotor
  ctx.save();
  ctx.translate(38, -4);
  ctx.rotate(Date.now() * 0.038);
  ctx.strokeStyle = '#aa2222'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
  ctx.rotate(Math.PI / 2);
  ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
  ctx.restore();

  // Red searchlight lamp
  const blink = 0.7 + 0.3 * Math.sin(Date.now() * 0.014);
  ctx.shadowBlur = 14; ctx.shadowColor = `rgba(255,40,40,${blink})`;
  ctx.fillStyle = `rgba(255,70,70,${blink})`;
  ctx.beginPath(); ctx.arc(2, 10, 4, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // Blinking warning lights
  const warn = 0.5 + 0.5 * Math.sin(Date.now() * 0.009);
  ctx.fillStyle = `rgba(255,30,30,${warn})`;
  ctx.beginPath(); ctx.arc(-18, 1, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(14, 1, 2.5, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function drawBossHUD() {
  if (!gs.boss || gs.boss.phase !== 'pursue') return;
  const boss = gs.boss;
  const barW = 160, barH = 12;
  const bx   = LW / 2 - barW / 2;
  const by   = 8;
  const fill = Math.min(1, boss.survivedT / boss.surviveDur);
  const remaining = Math.max(0, boss.surviveDur - boss.survivedT).toFixed(1);

  // Pulsing red vignette on screen edges
  const pulse = 0.05 + 0.04 * Math.sin(performance.now() / 200);
  ctx.save();
  ctx.globalAlpha = pulse;
  const vig = ctx.createRadialGradient(LW / 2, LH / 2, LH * 0.25, LW / 2, LH / 2, LH * 0.85);
  vig.addColorStop(0, 'rgba(255,0,0,0)');
  vig.addColorStop(1, 'rgba(255,0,0,1)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, LW, LH);
  ctx.restore();

  // Background bar
  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = '#1a0000';
  ctx.fillRect(bx - 10, by - 4, barW + 20, barH + 22);
  ctx.globalAlpha = 1;

  // Label
  const labelPulse = 0.75 + 0.25 * Math.sin(performance.now() / 250);
  ctx.fillStyle = `rgba(255,50,50,${labelPulse})`;
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('⚠ APB MODE', LW / 2, by + 8);

  // Progress bar track
  ctx.fillStyle = '#330000';
  ctx.fillRect(bx, by + 12, barW, barH);

  // Progress bar fill (red → orange)
  const barGrad = ctx.createLinearGradient(bx, 0, bx + barW, 0);
  barGrad.addColorStop(0, '#ff2222');
  barGrad.addColorStop(1, '#ff8800');
  ctx.fillStyle = barGrad;
  ctx.fillRect(bx, by + 12, barW * fill, barH);

  // Timer text
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px monospace';
  ctx.fillText('SURVIVE: ' + remaining + 's', LW / 2, by + 21);

  ctx.restore();
}

function spawnConfetti() {
  const CONF_COLS = ['#e74c3c','#f39c12','#2ecc71','#3498db','#9b59b6','#1abc9c','#e67e22','#f1c40f'];
  const cx = PLAYER_SCREEN_X + PLAYER_W / 2;
  const cy = gs.p.y + PLAYER_H / 2;
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 3 + Math.random() * 7;
    gs.particles.push({
      x: cx + gs.scrollX, y: cy,
      vx: Math.cos(a) * sp - gs.speed,
      vy: Math.sin(a) * sp - 4 - Math.random() * 3,
      life: 1.2 + Math.random() * 0.6, ml: 1.8,
      col: CONF_COLS[Math.floor(Math.random() * CONF_COLS.length)],
      r: 3 + Math.random() * 3
    });
  }
}

function killPlayer(cause) {
  const p = gs.p;
  const isNewBest = Math.floor(gs.score) > getHS();
  p.state = 'dead'; p.vy = -10;
  gs.deathCause = cause;
  gs.combo = 0;
  shake(0.5, 7); sfxDeath();
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 5;
    gs.particles.push({ x: p.worldX + PLAYER_W/2, y: p.y + PLAYER_H/2, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp - 2, life: 0.9, ml: 0.9, col: '#c0392b', r: 4 });
  }
  if (isNewBest) spawnConfetti();
  setTimeout(() => { saveGhost(); showGameOver(); }, 1300);
}

function shake(dur, amt) { gs.shakeTimer = dur; gs.shakeAmt = amt; gs.shakeDur = dur; }

// ─── POWER-UPS ─────────────────────────────────────────────────
const PU_COLORS = { shield: '#4fc3f7', boost: '#ffd740', magnet: '#ce93d8', umbrella: '#81d4fa' };
const PU_LABELS = { shield: 'SHIELD!', boost: 'SPEED BOOST!', magnet: 'SCORE ×3!', umbrella: 'FLOAT!' };

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
  } else if (type === 'umbrella') {
    gs.powerUp = { type, t: 6.0, maxT: 6.0 };
  }
  popup(x, y - 20, PU_LABELS[type], col, 14);
  sfxPowerUp();
  shake(0.25, 3);
  if (gs.cat) gs.cat.lag = Math.min(gs.cat.lag + 35, 500); // power-up gives breathing room
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
  for (let i = 0; i < 9; i++) {
    const angle = Math.PI + (Math.random() - 0.5) * 1.6; // upward fan spread
    const speed = 1.2 + Math.random() * 2.8;
    gs.particles.push({
      x: x + (Math.random() - 0.5) * 18, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.32, ml: 0.32,
      col: Math.random() < 0.5 ? '#c0a070' : '#a08858',
      r: 2 + Math.random() * 3,
    });
  }
}
function spawnTrail() {
  const p = gs.p;
  const sk = SKINS.find(s => s.id === getActiveSkin()) || SKINS[0];
  const rx = p.worldX - 10, ry = p.y + (p.sliding ? 8 : PLAYER_H * 0.65);
  for (let i = 0; i < 2; i++) {
    gs.particles.push({
      x: rx + (Math.random() - 0.5) * 4,
      y: ry + (Math.random() - 0.5) * 3,
      vx: -0.8 - Math.random() * 0.8,
      vy: -0.3 + Math.random() * 0.6,
      life: 0.28, ml: 0.28,
      col: sk.body,
      r: 1.5 + Math.random() * 1.5,
    });
  }
}
function popup(x, y, text, col = '#f1c40f', size = 13) { gs.popups.push({ x, y, text, col, size, life: 1.1, ml: 1.1 }); }

function updateParticles(dt) {
  for (const p of gs.particles) { p.x += p.vx*dt*60; p.y += p.vy*dt*60; p.vy += 0.12*dt*60; p.life -= dt; }
  gs.particles = gs.particles.filter(p => p.life > 0);
  for (const p of gs.popups) { p.y -= 28*dt; p.life -= dt; }
  gs.popups = gs.popups.filter(p => p.life > 0);
  if (gs.comboPulseT > 0) gs.comboPulseT = Math.max(0, gs.comboPulseT - dt);
  if (gs.achBannerT  > 0) gs.achBannerT  = Math.max(0, gs.achBannerT  - dt);
}

// ─── PARALLAX ──────────────────────────────────────────────────
function updateParallax(dt) {
  gs.pxFar  += gs.speed * 0.18 * dt * 60;
  gs.pxMid  += gs.speed * 0.45 * dt * 60;
  gs.pxNear += gs.speed * 0.78 * dt * 60;
}

// ─── WEATHER ───────────────────────────────────────────────────
const WEATHER_DROP_COLS = [
  'rgba(180,210,255,0.26)',  // Downtown
  'rgba(155,165,185,0.22)',  // Industrial
  'rgba(200,80,255,0.28)',   // Neon District
  'rgba(140,190,255,0.20)',  // Skyline
];
const WEATHER_TARGETS = { clear: 0, light: 55, heavy: 120, storm: 180 };
const WEATHER_FOG     = { clear: 0, light: 0,  heavy: 0.055, storm: 0.13 };

function updateWeather(dt) {
  const w = gs.weather;
  w.t += dt;

  // Phase transition
  const prevType = w.type;
  if (w.t >= w.nextChange) {
    w.t = 0;
    w.nextChange = 30 + Math.random() * 30;
    const rt = gs.runTime;
    const r  = Math.random();
    if      (rt < 60)  w.type = 'clear';
    else if (rt < 120) w.type = r < 0.40 ? 'light' : 'clear';
    else if (rt < 180) w.type = r < 0.30 ? 'heavy' : r < 0.70 ? 'light' : 'clear';
    else               w.type = r < 0.20 ? 'storm' : r < 0.55 ? 'heavy' : r < 0.90 ? 'light' : 'clear';
    if (w.type !== 'storm') w.nextLightning = 999;
    if (w.type === 'storm' && prevType !== 'storm') {
      popup(gs.scrollX + LW / 2, GROUND_Y - 100, '\u26C8 STORM INCOMING!', '#aaccff', 16);
    }
    const WEATHER_ICONS = { clear: '', light: '\uD83C\uDF27', heavy: '\uD83C\uDF27', storm: '\u26C8' };
    const wEl = document.getElementById('weather-icon');
    if (wEl) wEl.textContent = WEATHER_ICONS[w.type] || '';
  }

  // Fog lerp
  const fogTarget = WEATHER_FOG[w.type];
  w.fog += (fogTarget - w.fog) * Math.min(1, dt * 0.5);

  // Lightning (storm only)
  if (w.type === 'storm') {
    w.nextLightning -= dt;
    if (w.nextLightning <= 0) {
      w.lightning = 0.22;
      shake(0.35, 6);
      w.nextLightning = 8 + Math.random() * 10;
      setTimeout(sfxThunder, 400 + Math.random() * 600);
    }
  }
  w.lightning = Math.max(0, w.lightning - dt * 3.5);

  // Drop pool: add / trim to target count
  const target = WEATHER_TARGETS[w.type];
  while (w.drops.length < target) {
    w.drops.push({
      x:     Math.random() * LW,
      y:     Math.random() * GROUND_Y,
      len:   7 + Math.random() * 9,
      speed: 180 + Math.random() * 140,
    });
  }
  if (w.drops.length > target) w.drops.length = target;

  // Move drops
  const wind = gs.speed / BASE_SPEED * 0.18;
  for (const d of w.drops) {
    d.y += d.speed * dt;
    d.x -= d.speed * wind * dt;
    if (d.y > GROUND_Y || d.x < -20) {
      // Splash particle on ground hit
      if (d.y > GROUND_Y && Math.random() < 0.25) {
        gs.particles.push({
          x: gs.scrollX + d.x, y: GROUND_Y,
          vx: (Math.random() - 0.5) * 2.5,
          vy: -Math.random() * 1.8,
          life: 0.22, ml: 0.22,
          col: WEATHER_DROP_COLS[gs.zoneIdx].replace(/[\d.]+\)$/, '0.5)'),
          r: 1.2,
        });
      }
      d.x = Math.random() * LW;
      d.y = -10;
    }
  }
}

// ─── PROGRESSION ───────────────────────────────────────────────
function updateProgression(dt) {
  gs.runTime += dt;
  gs.distance += gs.speed * dt * 60 / 10;
  // Lap detection — fires once per 3600m cycle
  const newLap = Math.floor(gs.distance / 3600);
  if (newLap > gs.lap) {
    gs.lap = newLap;
    popup(gs.scrollX + LW / 2, GROUND_Y - 130, 'LAP ' + gs.lap + ' \u2014 ESCALATING!', '#e74c3c', 20);
    shake(0.6, 8); sfxThunder();
  }
  // Only advance natural speed when boost isn't active (boost holds gs.speed elevated)
  if (!gs.powerUp || gs.powerUp.type !== 'boost') {
    const speedCap  = BASE_SPEED * (3 + gs.lap * 0.5);  // 12 → 14 → 16 → ...
    const speedRamp = 0.02 + gs.lap * 0.01;
    gs.speed = Math.min(speedCap, BASE_SPEED + gs.runTime * speedRamp);
  }
  // Speed milestone popups — fire once per tier (~every 100s of survival)
  const speedTier = Math.floor((gs.speed - BASE_SPEED) / (BASE_SPEED * 0.5));
  if (speedTier > gs.speedMilestone && gs.runTime > 15) {
    gs.speedMilestone = speedTier;
    const msgs = ['PICKING UP SPEED', 'MOVING FAST', 'BLAZING', 'WARP SPEED', 'MACH RAT', 'BEYOND PHYSICS'];
    const cols = ['#3498db', '#e67e22', '#e74c3c', '#9b59b6', '#e91e8c', '#00ffcc'];
    const idx  = Math.min(speedTier - 1, msgs.length - 1);
    popup(gs.scrollX + LW / 2, GROUND_Y - 110, msgs[idx] + '!', cols[idx], 16);
    shake(0.12, 3);
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
      sfxMilestone(MILESTONES.indexOf(m));
    }
  }

  // Zone
  const z = Math.floor(gs.distance / 900) % ZONES.length;
  if (z !== gs.zoneIdx) {
    gs.zoneIdx = z;
    const lapSuffix = gs.lap >= 1 ? ' \xD7' + (gs.lap + 1) : '';
    flashZoneName(ZONES[z].name + lapSuffix);
    if (z === 2) unlockAchievement('zone_neon');
    if (z === 3) unlockAchievement('zone_sky');
  }

  // Boss encounter
  if (!gs.boss && gs.difficulty >= 2 && gs.distance >= gs.nextBossD) {
    startBoss();
  }

  // Achievement checks (time/speed)
  checkAchievements();

  // Shake decay
  if (gs.shakeTimer > 0) {
    gs.shakeTimer -= dt;
    const a = gs.shakeAmt * (gs.shakeTimer / (gs.shakeDur || 0.5));
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

// ─── BANK / UPGRADES / SKINS / ACHIEVEMENTS ─────────────────────
function getBank()            { return parseInt(localStorage.getItem('rr_bank') || '0', 10); }
function addToBank(n)         { localStorage.setItem('rr_bank', getBank() + n); }
function spendFromBank(n)     { localStorage.setItem('rr_bank', Math.max(0, getBank() - n)); }

function getUpgradesOwned()   { return JSON.parse(localStorage.getItem('rr_upgrades') || '[]'); }
function hasUpgrade(id)       { return getUpgradesOwned().includes(id); }
function buyUpgradeLS(id)     { const u = getUpgradesOwned(); if (!u.includes(id)) { u.push(id); localStorage.setItem('rr_upgrades', JSON.stringify(u)); } }

function getOwnedSkins()      { return JSON.parse(localStorage.getItem('rr_skins') || '["default"]'); }
function ownSkin(id)          { const s = getOwnedSkins(); if (!s.includes(id)) { s.push(id); localStorage.setItem('rr_skins', JSON.stringify(s)); } }
function getActiveSkin()      { return localStorage.getItem('rr_active_skin') || 'default'; }
function setActiveSkin(id)    { localStorage.setItem('rr_active_skin', id); }
function getOwnedHats()       { return JSON.parse(localStorage.getItem('rr_hats') || '["none"]'); }
function ownHat(id)           { const h = getOwnedHats(); if (!h.includes(id)) { h.push(id); localStorage.setItem('rr_hats', JSON.stringify(h)); } }
function getActiveHat()       { return localStorage.getItem('rr_active_hat') || 'none'; }
function setActiveHat(id)     { localStorage.setItem('rr_active_hat', id); }
function buyHat(id)           { const h = HATS.find(x=>x.id===id); if (!h||getOwnedHats().includes(id)||getBank()<h.cost) return; spendFromBank(h.cost); ownHat(id); renderShop(); }
function selectHat(id)        { setActiveHat(id); renderShop(); }

function getAchievements()    { return JSON.parse(localStorage.getItem('rr_achievements') || '[]'); }
function hasAchievement(id)   { return getAchievements().includes(id); }
function unlockAchievement(id) {
  if (hasAchievement(id) || !gs) return;
  const list = getAchievements(); list.push(id); localStorage.setItem('rr_achievements', JSON.stringify(list));
  const def = ACHIEVEMENTS.find(a => a.id === id);
  if (def) showAchievementBanner(def.name);
  const skin = SKINS.find(s => s.unlock === id);
  if (skin && !getOwnedSkins().includes(skin.id)) {
    ownSkin(skin.id);
    setTimeout(() => { if (gs) { gs.achBannerText = 'SKIN UNLOCKED: ' + skin.name.toUpperCase(); gs.achBannerT = 3.2; } }, 3400);
  }
}
function showAchievementBanner(name) {
  if (!gs) return;
  gs.achBannerText = name;
  gs.achBannerT    = 3.2;
}

function checkAchievements() {
  if (!gs || gs.phase !== 'playing') return;
  if (gs.runTime >= 120)        unlockAchievement('survive120');
  const speedMax = BASE_SPEED * 3;
  if (gs.speed >= speedMax - 0.05) unlockAchievement('speed_max');
}

// ─── DAILY CHALLENGE HELPERS ────────────────────────────────────
function getDailyDateKey() { return new Date().toLocaleDateString('en-CA'); } // YYYY-MM-DD stable
function hasPlayedToday()  { return localStorage.getItem('rr_daily_date') === getDailyDateKey(); }
function getDailyScore()   { return parseInt(localStorage.getItem('rr_daily_score') || '0', 10); }
function saveDailyResult(s) {
  localStorage.setItem('rr_daily_date', getDailyDateKey());
  if (s > getDailyScore()) localStorage.setItem('rr_daily_score', s);
}

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
    } else if (pl.type === 'moving') {
      const pulse = 8 + 4 * Math.sin(Date.now() * 0.004);
      ctx.save();
      ctx.shadowBlur = pulse; ctx.shadowColor = zone.accent;
      ctx.fillStyle = '#2a3a50'; ctx.fillRect(sx, pl.y, pl.w, pl.h);
      ctx.fillStyle = zone.accent; ctx.fillRect(sx, pl.y, pl.w, 3);
      ctx.shadowBlur = 0;
      // chevron motion indicators
      ctx.fillStyle = zone.accent + '88';
      ctx.font = 'bold 8px monospace';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < Math.floor(pl.w / 18); i++) {
        ctx.fillText('▲', sx + 6 + i * 18, pl.y + pl.h / 2 + 2);
      }
      ctx.restore();
    }
  }
}

function drawHazards() {
  for (const h of gs.hazards) {
    const sx = h.x - gs.scrollX;
    if (sx + h.w < -30 || sx > LW + 30) continue;
    const sy = h.y;

    // Pulsing danger glow — radial gradient centered on hazard
    {
      const isSteamActive = h.type === 'steam' && (h.t % h.period) < (h.period * 0.42);
      const isSteamWarm   = h.type === 'steam' && !isSteamActive;
      const isZapActive   = h.type === 'zapper' && h.active;
      const isZapInactive = h.type === 'zapper' && !h.active;
      if (!isZapInactive) {
        // Pick color (full rgb strings for gradient transparency)
        const [gr, gg, gb] = isSteamWarm ? [255,136,0] : isZapActive ? [0,229,255] : [255,34,34];
        const pulse = 0.18 + 0.10 * Math.sin(performance.now() / 320);
        const alpha = isSteamWarm ? pulse * 0.55 : isZapActive ? pulse * 1.1 : pulse;
        const cx = sx + h.w / 2;
        const cy = sy + h.h / 2;
        // Radius proportional to geometric mean of dims, capped so wide hazards stay tidy
        const r = Math.min(Math.sqrt(h.w * h.h), 68) * 0.95 + 18;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0,   `rgba(${gr},${gg},${gb},${alpha.toFixed(3)})`);
        grad.addColorStop(0.5, `rgba(${gr},${gg},${gb},${(alpha * 0.45).toFixed(3)})`);
        grad.addColorStop(1,   `rgba(${gr},${gg},${gb},0)`);
        ctx.save();
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

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
    if (h.type === 'crate') {
      const crateH = 28;
      const numCrates = Math.round(h.h / crateH);
      for (let i = 0; i < numCrates; i++) {
        const cy = sy + h.h - crateH * (i + 1);
        ctx.fillStyle = '#8b5e3c'; ctx.fillRect(sx, cy, h.w, crateH);
        ctx.fillStyle = '#a87040'; ctx.fillRect(sx, cy, h.w, 4);
        ctx.fillStyle = '#6b4220'; ctx.fillRect(sx, cy + crateH / 2 - 1, h.w, 2);
        ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx + 2, cy + 3);    ctx.lineTo(sx + h.w - 2, cy + crateH - 3);
        ctx.moveTo(sx + h.w - 2, cy + 3); ctx.lineTo(sx + 2, cy + crateH - 3);
        ctx.stroke();
        ctx.strokeStyle = '#3e2008'; ctx.lineWidth = 1.2;
        ctx.strokeRect(sx, cy, h.w, crateH);
      }
    }
    if (h.type === 'tripwire') {
      const wireY = sy + h.h / 2;
      ctx.fillStyle = '#5a5a5a';
      ctx.fillRect(sx - 2, sy - 2, 4, h.h + 6);
      ctx.fillRect(sx + h.w - 2, sy - 2, 4, h.h + 6);
      ctx.fillStyle = '#888';
      ctx.beginPath(); ctx.arc(sx, sy - 2, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + h.w, sy - 2, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#bbb'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(sx, wireY); ctx.lineTo(sx + h.w, wireY); ctx.stroke();
      const blink = 0.5 + 0.5 * Math.sin(h.t * 5.5);
      ctx.fillStyle = `rgba(255,50,50,${blink.toFixed(2)})`;
      ctx.beginPath(); ctx.arc(sx, sy - 2, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + h.w, sy - 2, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    if (h.type === 'neon_sign') {
      const col = h.col || '#ff3af8';
      const flicker = 0.8 + 0.2 * Math.sin(h.t * 8.1 + 0.6);
      ctx.strokeStyle = '#666'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx + 18, sy); ctx.lineTo(sx + 18, sy - 22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + h.w - 18, sy); ctx.lineTo(sx + h.w - 18, sy - 22); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.fillRect(sx, sy, h.w, h.h);
      ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1; ctx.strokeRect(sx, sy, h.w, h.h);
      ctx.save();
      ctx.shadowBlur = 14; ctx.shadowColor = col;
      ctx.fillStyle = col;
      ctx.globalAlpha = flicker;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const SIGN_WORDS = ['EXIT', 'OPEN', 'DELI', 'ROOF'];
      ctx.fillText(SIGN_WORDS[Math.floor(Math.abs(h.x) / 130) % SIGN_WORDS.length], sx + h.w / 2, sy + h.h / 2 + 1);
      ctx.restore();
    }
    if (h.type === 'zapper') {
      const wireY = sy + h.h / 2;
      const poleTop = GROUND_Y - 55;
      // Poles (decorative, from ground to above wire)
      ctx.fillStyle = '#5a5a5a';
      ctx.fillRect(sx - 3, poleTop, 6, GROUND_Y + 20 - poleTop);
      ctx.fillRect(sx + h.w - 3, poleTop, 6, GROUND_Y + 20 - poleTop);
      // Insulators at wire height
      ctx.fillStyle = '#888';
      ctx.beginPath(); ctx.arc(sx, wireY, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + h.w, wireY, 4, 0, Math.PI * 2); ctx.fill();
      if (h.active) {
        // Jagged electric arc
        const segs = 9;
        ctx.save();
        ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2;
        ctx.shadowBlur = 16; ctx.shadowColor = '#00e5ff';
        ctx.beginPath(); ctx.moveTo(sx, wireY);
        for (let i = 1; i < segs; i++) ctx.lineTo(sx + (h.w / segs) * i, wireY + (Math.random() - 0.5) * 14);
        ctx.lineTo(sx + h.w, wireY); ctx.stroke();
        // Bright core arc
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.8; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(sx, wireY);
        for (let i = 1; i < segs; i++) ctx.lineTo(sx + (h.w / segs) * i, wireY + (Math.random() - 0.5) * 8);
        ctx.lineTo(sx + h.w, wireY); ctx.stroke();
        ctx.restore();
      } else {
        // Inactive — dim wire
        ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(sx, wireY); ctx.lineTo(sx + h.w, wireY); ctx.stroke();
      }
    }
    if (h.type === 'clothesline') {
      const wireY = sy;
      // Wooden poles
      ctx.fillStyle = '#6b4226';
      ctx.fillRect(sx - 3, wireY, 6, GROUND_Y + 20 - wireY);
      ctx.fillRect(sx + h.w - 3, wireY, 6, GROUND_Y + 20 - wireY);
      // Wire with subtle sag
      ctx.strokeStyle = '#c0c0c0'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, wireY + 2);
      ctx.quadraticCurveTo(sx + h.w / 2, wireY + 7, sx + h.w, wireY + 2);
      ctx.stroke();
      // Hanging laundry
      const CLOTH_COLS = ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c'];
      const count = Math.max(2, Math.floor(h.w / 65));
      for (let i = 0; i < count; i++) {
        const cx = sx + h.w * (i + 0.5) / count;
        const clothY = wireY + 7;
        const col = CLOTH_COLS[i % CLOTH_COLS.length];
        // Hanger strings
        ctx.strokeStyle = '#bbb'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(cx - 4, clothY); ctx.lineTo(cx - 4, clothY + 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 4, clothY); ctx.lineTo(cx + 4, clothY + 4); ctx.stroke();
        // Shirt body
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(cx - 10, clothY + 4);
        ctx.lineTo(cx - 5,  clothY + 4);
        ctx.lineTo(cx - 3,  clothY + 7);
        ctx.lineTo(cx + 3,  clothY + 7);
        ctx.lineTo(cx + 5,  clothY + 4);
        ctx.lineTo(cx + 10, clothY + 4);
        ctx.lineTo(cx + 8,  clothY + 17);
        ctx.lineTo(cx - 8,  clothY + 17);
        ctx.closePath(); ctx.fill();
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

function drawHat(hatId, bob, sliding) {
  if (!hatId || hatId === 'none') return;
  const hx = sliding ? 11 : 10.5;
  const hy = sliding ? -7  : bob - 17;
  ctx.save();
  if (hatId === 'beanie') {
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.arc(hx, hy + 4, 7, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#922b21'; ctx.fillRect(hx - 7, hy + 3, 14, 3);
    ctx.fillStyle = '#f0f0f0'; ctx.beginPath(); ctx.arc(hx + 4, hy - 1, 2, 0, Math.PI*2); ctx.fill();
  } else if (hatId === 'tophat') {
    ctx.fillStyle = '#111';
    ctx.fillRect(hx - 4, hy - 8, 9, 10);
    ctx.fillRect(hx - 7, hy + 1, 15, 2.5);
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(hx - 4, hy + 0.5, 9, 1.5);
  } else if (hatId === 'hardhat') {
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(hx, hy + 2, 8, Math.PI, 0); ctx.fill();
    ctx.fillRect(hx - 9, hy + 1.5, 18, 2.5);
    ctx.fillStyle = '#f39c12'; ctx.fillRect(hx - 3, hy - 4, 6, 2);
  } else if (hatId === 'crown') {
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.moveTo(hx-6,hy+2); ctx.lineTo(hx-6,hy-6); ctx.lineTo(hx-2,hy-2);
    ctx.lineTo(hx,  hy-8); ctx.lineTo(hx+2,hy-2); ctx.lineTo(hx+6,hy-6);
    ctx.lineTo(hx+6,hy+2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(hx, hy-5, 1.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#3498db';
    ctx.beginPath(); ctx.arc(hx-4,hy-1,1.2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx+4,hy-1,1.2,0,Math.PI*2); ctx.fill();
  } else if (hatId === 'cap') {
    ctx.fillStyle = '#2980b9';
    ctx.beginPath(); ctx.arc(hx-1, hy+3, 7, Math.PI, 0); ctx.fill();
    ctx.fillRect(hx-7, hy+2, 13, 2.5);
    ctx.fillStyle = '#1a5276';
    ctx.beginPath(); ctx.moveTo(hx+5,hy+2); ctx.lineTo(hx+12,hy+4); ctx.lineTo(hx+5,hy+4.5); ctx.fill();
  }
  ctx.restore();
}

function drawRat(state, frame, sliding) {
  const _sk    = SKINS.find(s => s.id === getActiveSkin()) || SKINS[0];
  const C_BACK  = _sk.back;
  const C_BODY  = _sk.body;
  const C_BELLY = _sk.belly;
  const C_LIMB  = _sk.limb;
  const C_SNOUT = _sk.snout;
  const C_EAR_O = _sk.earO;
  const C_EAR_I = _sk.earI;
  const C_NOSE  = _sk.nose;
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
    drawHat(getActiveHat(), 0, true);
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
  drawHat(getActiveHat(), bob, false);
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

// ─── CAT PURSUER ────────────────────────────────────────────────
function updateCat(dt) {
  if (gs.phase !== 'playing') return;
  const p = gs.p;

  if (!gs.cat) {
    const catSpawnD  = Math.max(50,  400 - gs.lap * 150);
    const catInitLag = Math.max(150, 500 - gs.lap * 100);
    if (gs.distance >= catSpawnD && gs.difficulty >= 1) {
      gs.cat = { lag: catInitLag, warnedAt200: false, surgedThisHit: false };
      popup(gs.scrollX + PLAYER_SCREEN_X, GROUND_Y - 80, '🐱 A CAT IS ON YOUR TAIL!', '#ff8888', 14);
      sfxCatHiss();
    }
    return;
  }

  const cat = gs.cat;

  // During boss: cat holds back
  if (gs.boss) {
    cat.lag = Math.min(cat.lag + dt * 15, 500);
    return;
  }

  // Naturally gain on player (~10px/s)
  cat.lag -= dt * 10;

  // Surge on hit (detect rising edge of hitFlash)
  if (p.hitFlash > 0.8 && !cat.surgedThisHit) {
    cat.surgedThisHit = true;
    cat.lag -= 60;
    sfxCatMeow();
  }
  if (p.hitFlash <= 0) cat.surgedThisHit = false;

  // Warn popup
  if (cat.lag < 200 && !cat.warnedAt200) {
    cat.warnedAt200 = true;
    popup(gs.scrollX + PLAYER_SCREEN_X, GROUND_Y - 60, '⚠ CAT CLOSING IN!', '#ff4444', 13);
    sfxWarn();
  }
  // Reset warn so it fires again if cat backs off then returns
  if (cat.lag > 260) cat.warnedAt200 = false;

  // Cat catches player
  if (cat.lag <= 0 && p.state !== 'dead') {
    killPlayer(randMsg(DEATH_MSGS.cat));
  }
}

function drawCat() {
  if (!gs.cat) return;
  const lag = gs.cat.lag;
  const sx  = PLAYER_SCREEN_X - lag;
  if (sx < -90 || sx > LW + 20) return;

  const t    = Date.now() * 0.008;
  const bob  = Math.sin(t * 2) * 1.4;
  const legs = Math.sin(t * 2);

  ctx.save();
  ctx.globalAlpha = Math.min(0.9, Math.max(0, 1 - lag / 260));
  ctx.translate(sx, GROUND_Y);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(0, 2, 14, 3.5, 0, 0, Math.PI*2); ctx.fill();

  // Tail (curling up behind body)
  ctx.strokeStyle = '#151515'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-8, -8 + bob);
  ctx.bezierCurveTo(-20, -4 + bob, -28, -18 + bob, -22, -30 + bob);
  ctx.stroke();

  // Back legs
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.ellipse(-12 - legs*3, -3 + bob, 3, 8, -0.2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-6  + legs*3, -3 + bob, 3, 8,  0.2, 0, Math.PI*2); ctx.fill();

  // Body
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.ellipse(-2, -10 + bob, 13, 8, 0.12, 0, Math.PI*2); ctx.fill();

  // Front legs
  ctx.beginPath(); ctx.ellipse(-3 + legs*3, -2 + bob, 3, 8,  0.2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 3 - legs*3, -2 + bob, 3, 8, -0.2, 0, Math.PI*2); ctx.fill();

  // Head
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(10, -17 + bob, 8, 0, Math.PI*2); ctx.fill();

  // Ears (sharp triangles)
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.moveTo(5, -23 + bob); ctx.lineTo(7, -32 + bob); ctx.lineTo(12, -23 + bob); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(13, -23 + bob); ctx.lineTo(16, -32 + bob); ctx.lineTo(21, -23 + bob); ctx.closePath(); ctx.fill();
  // Inner ear
  ctx.fillStyle = '#553a3a';
  ctx.beginPath(); ctx.moveTo(7, -23 + bob); ctx.lineTo(8.5, -28 + bob); ctx.lineTo(11, -23 + bob); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(14, -23 + bob); ctx.lineTo(16, -28 + bob); ctx.lineTo(19, -23 + bob); ctx.closePath(); ctx.fill();

  // Eyes (glowing yellow)
  ctx.shadowBlur = 6; ctx.shadowColor = '#ffcc00';
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath(); ctx.ellipse(7,  -18 + bob, 2.5, 2, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(13, -18 + bob, 2.5, 2, 0, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;
  // Pupils (slit)
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.ellipse(7.5,  -18 + bob, 0.7, 1.8, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(13.5, -18 + bob, 0.7, 1.8, 0, 0, Math.PI*2); ctx.fill();

  // Muzzle
  ctx.fillStyle = '#2c2c2c';
  ctx.beginPath(); ctx.ellipse(18, -14 + bob, 4, 3, 0, 0, Math.PI*2); ctx.fill();
  // Nose
  ctx.fillStyle = '#cc4488';
  ctx.beginPath(); ctx.arc(21.5, -13 + bob, 1.4, 0, Math.PI*2); ctx.fill();
  // Whiskers
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(19, -14 + bob); ctx.lineTo(28, -16 + bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(19, -13 + bob); ctx.lineTo(28, -11 + bob); ctx.stroke();

  ctx.restore();
}

function drawAchievementBanner() {
  if (!gs || gs.achBannerT <= 0) return;
  const alpha = Math.min(1, gs.achBannerT > 0.5 ? 1 : gs.achBannerT * 2);
  const cx = LW / 2;
  const cy = LH - 52;
  ctx.save();
  ctx.globalAlpha = alpha;
  // Pill background
  ctx.fillStyle = 'rgba(20,16,8,0.88)';
  const tw = 220, th = 26;
  ctx.beginPath();
  ctx.roundRect(cx - tw/2, cy - th/2, tw, th, 6);
  ctx.fill();
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Text
  ctx.shadowBlur = 8; ctx.shadowColor = '#f1c40f';
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★ ACHIEVEMENT: ' + gs.achBannerText.toUpperCase(), cx, cy);
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

function drawWeather() {
  const w = gs.weather;
  if (!w.drops.length) return;
  const wind = gs.speed / BASE_SPEED * 0.18;
  const col  = WEATHER_DROP_COLS[gs.zoneIdx];
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  for (const d of w.drops) {
    const dx = -d.len * wind, dy = d.len;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x + dx, d.y + dy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCountdown() {
  if (gs.phase !== 'countdown') return;
  const t = gs.countdownT;
  const tick = Math.ceil(t);
  // frac goes 1→0 within each second (1 = just ticked, 0 = about to tick again)
  const frac = t > 0 ? (t - Math.floor(t)) : (t + 0.45) / 0.45;
  const pop = 1 + Math.max(0, 1 - frac) * 0.45;

  let label, col;
  if (t <= 0)         { label = 'GO!'; col = '#3498db'; }
  else if (tick >= 3) { label = '3'; col = '#e74c3c'; }
  else if (tick >= 2) { label = '2'; col = '#f39c12'; }
  else                { label = '1'; col = '#2ecc71'; }

  const cx = LW / 2, cy = LH / 2 - 30;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pop, pop);

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.font = `bold 88px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 3, 3);

  // Main text
  ctx.fillStyle = col;
  ctx.fillText(label, 0, 0);

  // Dim background pill
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#000';
  const tw = ctx.measureText(label).width;
  ctx.beginPath();
  ctx.roundRect(-tw / 2 - 18, -52, tw + 36, 100, 16);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawWeatherOverlay() {
  const w = gs.weather;
  if (w.fog > 0.002) {
    ctx.fillStyle = `rgba(10,10,20,${w.fog.toFixed(3)})`;
    ctx.fillRect(0, 0, LW, LH);
  }
  if (w.lightning > 0.005) {
    ctx.fillStyle = `rgba(230,240,255,${(w.lightning * 0.55).toFixed(3)})`;
    ctx.fillRect(0, 0, LW, LH);
  }
}

function drawItems() {
  if (!gs.items.length) return;
  const icons = { shield: '🛡', boost: '⚡', magnet: '×3', umbrella: '☂' };
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
  if (gs.combo < 2 && gs.comboDisplayT <= 0) return;
  const displayCombo = gs.combo > 0 ? gs.combo : gs.bestCombo;
  if (displayCombo < 2) return;
  const pulse    = gs.comboPulseT / 0.18;          // 0→1 on fresh pickup
  const baseSize = 13 + Math.min(displayCombo, 30) * 0.18;
  const size     = Math.round(baseSize + pulse * 5);
  const glow     = 8 + pulse * 14;
  const col      = displayCombo >= 25 ? '#e74c3c' : displayCombo >= 10 ? '#ff9800' : '#ffd740';
  ctx.save();
  ctx.shadowBlur  = glow;
  ctx.shadowColor = col;
  ctx.font        = `bold ${size}px monospace`;
  ctx.fillStyle   = col;
  ctx.textAlign   = 'left';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = gs.comboDisplayT > 0 ? 1 : Math.max(0.4, gs.combo > 0 ? 1 : 0);
  ctx.fillText('×' + displayCombo + ' COMBO', 12, LH - 22);
  ctx.restore();
}

function drawPowerUpHUD() {
  if (!gs.powerUp || gs.phase !== 'playing') return;
  const pu  = gs.powerUp;
  const col = PU_COLORS[pu.type];
  const icons = { shield: '🛡', boost: '⚡', magnet: '×3', umbrella: '☂' };
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
  drawWeather();
  drawProps();
  drawItems();
  drawCoins();
  drawPlatforms();
  drawHazards();
  drawHeli();
  if (gs.boss) { drawBoss(); drawBossHUD(); }
  drawGhost();
  drawCat();
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
  drawAchievementBanner();
  drawCountdown();
  drawWeatherOverlay();

  ctx.restore();
}

// ─── GAME LOOP ─────────────────────────────────────────────────
let lastTime = 0;

function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  if (gs.phase === 'playing') {
    gs.scrollX += gs.speed * dt * 60;
    updateMovingPlatforms(dt);
    updatePlayer(dt);
    spawnTrail();
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
    updateWeather(dt);
    updateHeli(dt);
    if (gs.boss) updateBoss(dt);
    updateCat(dt);
  } else if (gs.phase === 'countdown') {
    gs.scrollX += gs.speed * dt * 60;
    updateMovingPlatforms(dt);
    updatePlayer(dt);
    spawnChunks();
    updateParticles(dt);
    updateParallax(dt);
    updateWeather(dt);
    gs.countdownT -= dt;
    const tick = Math.ceil(gs.countdownT);
    if (tick < gs.lastCountdownTick && tick >= 1) {
      gs.lastCountdownTick = tick;
      playTone(tick === 1 ? 660 : 440, 0.18, 'sine', 0.12);
    }
    if (gs.countdownT <= 0 && gs.lastCountdownTick > 0) {
      gs.lastCountdownTick = 0;
      playTone(880, 0.22, 'sine', 0.14);
      setTimeout(() => playTone(1100, 0.18, 'sine', 0.12), 80);
    }
    if (gs.countdownT <= -0.45) {
      gs.phase = 'playing';
    }
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
  gs.phase = 'countdown';
  gs.countdownT = 3.0;
  gs.lastCountdownTick = 4;
  loadGhost();

  // Initial safe ground so player lands immediately
  gs.platforms.push({ x: -50, y: GROUND_Y, w: LW + 100, h: 20, type: 'ground' });
  gs.nextChunkX = LW + 50;

  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('gameover-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('daily-hud-badge').classList.add('hidden');
  document.getElementById('score-display').textContent = '0';
  document.getElementById('hs-line').textContent = 'Best: ' + getHS().toLocaleString();
  updateTodIcon();
  startJazz();

  // Upgrade: Lucky Start — grant a random power-up at run start
  if (hasUpgrade('luckystart')) {
    const t = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    activatePowerUp(t, PLAYER_SCREEN_X, GROUND_Y - 40);
  }
}

function showGameOver() {
  gs.phase = 'gameover';
  stopJazz();
  const s = Math.floor(gs.score);
  const isNewBest = s > 0 && s > getHS();
  saveScore(s);

  // Bank coins and check no_hits achievement
  addToBank(gs.totalCoins);
  if (!gs.hitThisRun && gs.distance > 50) unlockAchievement('no_hits');

  document.getElementById('hud').classList.add('hidden');
  document.getElementById('gameover-screen').classList.remove('hidden');
  document.getElementById('death-cause').textContent = gs.deathCause || 'You fell off the roof!';
  document.getElementById('go-zone').textContent  = '📍 ' + ZONES[gs.zoneIdx].name;
  document.getElementById('go-score').textContent = s.toLocaleString();
  document.getElementById('go-highscore').textContent = getHS().toLocaleString();
  document.getElementById('go-dist').textContent  = Math.floor(gs.distance) + 'm';
  document.getElementById('go-jumps').textContent = gs.jumpCount;
  document.getElementById('go-coins').textContent = gs.totalCoins;
  document.getElementById('go-banked').textContent = '+' + gs.totalCoins + ' 🪙  (total: ' + getBank().toLocaleString() + ')';
  document.getElementById('go-combo').textContent = gs.bestCombo >= 5 ? '×' + gs.bestCombo : '—';
  document.getElementById('gameover-screen').style.setProperty('--zone-accent', ZONES[gs.zoneIdx].accent);
  const nb = document.getElementById('go-newbest');
  if (isNewBest) nb.classList.remove('hidden'); else nb.classList.add('hidden');
  if (gs.isDaily) {
    saveDailyResult(s);
    dailyRNG = null;
    document.getElementById('retry-btn').classList.add('hidden');
    document.getElementById('daily-go-msg').textContent =
      '\uD83D\uDCC5 Daily Score: ' + s.toLocaleString() + ' \u2014 Come back tomorrow!';
    document.getElementById('daily-go-msg').classList.remove('hidden');
  } else {
    document.getElementById('retry-btn').classList.remove('hidden');
    document.getElementById('daily-go-msg').classList.add('hidden');
  }
}

function generateRunCard() {
  const c = document.createElement('canvas');
  c.width = 600; c.height = 300;
  const cx = c.getContext('2d');
  const zone = ZONES[gs.zoneIdx];
  const [ar,ag,ab] = hexToRgb(zone.accent);

  // Background gradient
  const bg = cx.createLinearGradient(0, 0, 0, 300);
  bg.addColorStop(0, zone.c1); bg.addColorStop(1, zone.c2);
  cx.fillStyle = bg; cx.fillRect(0, 0, 600, 300);
  cx.strokeStyle = zone.accent; cx.lineWidth = 3;
  cx.strokeRect(6, 6, 588, 288);

  // Title + zone
  cx.fillStyle = '#ffffff'; cx.font = 'bold 13px Courier New'; cx.textAlign = 'left';
  cx.fillText('RAT RACE', 24, 36);
  cx.fillStyle = zone.accent; cx.font = '11px Courier New';
  cx.fillText(zone.name.toUpperCase(), 24, 52);

  // Score
  cx.fillStyle = '#ffffff'; cx.font = 'bold 58px Courier New'; cx.textAlign = 'center';
  cx.fillText(Math.floor(gs.score).toLocaleString(), 300, 130);
  cx.fillStyle = `rgba(${ar},${ag},${ab},0.7)`; cx.font = '11px Courier New';
  cx.fillText('SCORE', 300, 148);

  // Stats row
  const stats = [
    ['DIST',  Math.floor(gs.distance) + 'm'],
    ['JUMPS', gs.jumpCount],
    ['COINS', gs.totalCoins],
    ['COMBO', gs.bestCombo >= 5 ? '\xD7' + gs.bestCombo : '\u2014'],
  ];
  stats.forEach(([label, val], i) => {
    const x = 110 + i * 130;
    cx.fillStyle = '#ffffff'; cx.font = 'bold 18px Courier New'; cx.textAlign = 'center';
    cx.fillText(val, x, 200);
    cx.fillStyle = `rgba(${ar},${ag},${ab},0.8)`; cx.font = '10px Courier New';
    cx.fillText(label, x, 216);
  });

  // Skin dot + name
  const sk = SKINS.find(s => s.id === getActiveSkin()) || SKINS[0];
  cx.fillStyle = sk.body; cx.beginPath(); cx.arc(300, 252, 11, 0, Math.PI*2); cx.fill();
  cx.fillStyle = sk.belly; cx.beginPath(); cx.ellipse(302, 255, 7, 5, 0.2, 0, Math.PI*2); cx.fill();
  const hatName = getActiveHat() !== 'none' ? ' + ' + (HATS.find(h=>h.id===getActiveHat())?.name||'') : '';
  cx.fillStyle = '#ccc'; cx.font = '10px Courier New'; cx.textAlign = 'center';
  cx.fillText(sk.name + hatName, 300, 278);

  // URL watermark
  cx.fillStyle = `rgba(${ar},${ag},${ab},0.4)`; cx.font = '9px Courier New'; cx.textAlign = 'right';
  cx.fillText('aiml-1870-2026.github.io/penguinprotector/endless-runner/', 582, 292);

  return c.toDataURL('image/png');
}
function shareRunCard() {
  const url = generateRunCard();
  const a = document.createElement('a');
  a.download = 'rat-race-' + getDailyDateKey() + '.png';
  a.href = url; a.click();
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

function startDailyGame() {
  if (hasPlayedToday()) return;
  dailyRNG = makeDailySeed(getDailyDateKey());
  startGame();
  gs.isDaily = true;
  document.getElementById('daily-hud-badge').classList.remove('hidden');
}

function refreshDailyBtn() {
  const btn = document.getElementById('daily-btn');
  if (hasPlayedToday()) {
    btn.textContent = '\u2713 Played \u2014 ' + getDailyScore().toLocaleString();
    btn.disabled = true;
  } else {
    btn.textContent = '\uD83D\uDCC5 Daily Challenge';
    btn.disabled = false;
  }
}

// ─── EVENT LISTENERS ───────────────────────────────────────────
document.getElementById('play-btn').addEventListener('click', () => { ensureAudio(); startGame(); });
document.getElementById('daily-btn').addEventListener('click', () => { ensureAudio(); startDailyGame(); });
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
document.getElementById('editor-btn').addEventListener('click', () => { window.location.href = 'editor.html'; });

canvas.addEventListener('click', () => { ensureAudio(); if (gs.phase === 'start') startGame(); });

// ─── SHOP ───────────────────────────────────────────────────────
function openShop() {
  renderShop();
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('shop-screen').classList.remove('hidden');
}
function closeShop() {
  document.getElementById('shop-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
}

function renderShop() {
  const bank    = getBank();
  const owned   = getUpgradesOwned();
  const skins   = getOwnedSkins();
  const active  = getActiveSkin();
  document.getElementById('shop-bank-display').textContent = bank.toLocaleString();

  // Upgrades panel
  document.getElementById('shop-upgrades-panel').innerHTML = UPGRADES.map(u => {
    const isOwned = owned.includes(u.id);
    const canBuy  = !isOwned && bank >= u.cost;
    const cardCls = isOwned ? 'shop-card owned' : (canBuy ? 'shop-card affordable' : 'shop-card');
    const btnHtml = isOwned
      ? `<button class="card-btn owned-btn" disabled>✓ Owned</button>`
      : `<button class="card-btn" ${canBuy ? '' : 'disabled'} onclick="buyUpgrade('${u.id}')">Buy ${u.cost}🪙</button>`;
    return `<div class="${cardCls}">
      <div class="card-name">${u.name}</div>
      <div class="card-desc">${u.desc}</div>
      <div class="card-cost">${isOwned ? '' : u.cost + ' 🪙'}</div>
      ${btnHtml}
    </div>`;
  }).join('');

  // Skins panel — show a colour swatch using skin's body colour
  document.getElementById('shop-skins-panel').innerHTML = SKINS.map(s => {
    const isOwned  = skins.includes(s.id);
    const isActive = s.id === active;
    const canBuy   = !isOwned && bank >= s.cost;
    const cardCls  = isOwned ? 'shop-card owned' : (canBuy ? 'shop-card affordable' : 'shop-card');
    let btnHtml, costHtml;
    if (!isOwned && s.unlock) {
      const achName = ACHIEVEMENTS.find(a => a.id === s.unlock)?.name || s.unlock;
      btnHtml  = `<button class="card-btn locked-btn" disabled>🔒 ${achName}</button>`;
      costHtml = `<div class="card-cost"><span class="free">Achievement</span></div>`;
    } else if (!isOwned) {
      btnHtml  = `<button class="card-btn" ${canBuy ? '' : 'disabled'} onclick="buySkin('${s.id}')">Buy ${s.cost}🪙</button>`;
      costHtml = `<div class="card-cost">${s.cost === 0 ? '<span class="free">Free</span>' : s.cost + ' 🪙'}</div>`;
    } else if (isActive) {
      btnHtml  = `<button class="card-btn select-btn active-skin" disabled>✓ Active</button>`;
      costHtml = `<div class="card-cost"></div>`;
    } else {
      btnHtml  = `<button class="card-btn select-btn" onclick="selectSkin('${s.id}')">Equip</button>`;
      costHtml = `<div class="card-cost"></div>`;
    }
    return `<div class="${cardCls}">
      <canvas class="skin-preview" id="skin-prev-${s.id}" width="28" height="28"></canvas>
      <div class="card-name">${s.name}</div>
      ${costHtml}
      ${btnHtml}
    </div>`;
  }).join('');

  // Draw skin previews on mini canvases
  SKINS.forEach(s => {
    const c = document.getElementById('skin-prev-' + s.id);
    if (!c) return;
    const cx = c.getContext('2d');
    cx.fillStyle = s.body;
    cx.beginPath(); cx.arc(14, 14, 11, 0, Math.PI*2); cx.fill();
    cx.fillStyle = s.belly;
    cx.beginPath(); cx.ellipse(15, 16, 7, 6, 0.2, 0, Math.PI*2); cx.fill();
    cx.fillStyle = s.earO;
    cx.beginPath(); cx.ellipse(8, 5, 3, 5, -0.3, 0, Math.PI*2); cx.fill();
    cx.fillStyle = s.nose;
    cx.beginPath(); cx.arc(23, 15, 2, 0, Math.PI*2); cx.fill();
  });

  // Hats panel
  const ownedHats = getOwnedHats();
  const activeHat = getActiveHat();
  document.getElementById('shop-hats-panel').innerHTML = HATS.map(h => {
    const isOwned  = ownedHats.includes(h.id);
    const isActive = h.id === activeHat;
    const canBuy   = !isOwned && bank >= h.cost && h.cost > 0;
    const cardCls  = isOwned ? 'shop-card owned' : (canBuy ? 'shop-card affordable' : 'shop-card');
    let btnHtml;
    if (h.id === 'none') {
      btnHtml = isActive
        ? `<button class="card-btn select-btn active-skin" disabled>✓ Active</button>`
        : `<button class="card-btn select-btn" onclick="selectHat('none')">Equip</button>`;
    } else if (!isOwned) {
      btnHtml = `<button class="card-btn" ${canBuy ? '' : 'disabled'} onclick="buyHat('${h.id}')">Buy ${h.cost}\uD83E\uDE99</button>`;
    } else if (isActive) {
      btnHtml = `<button class="card-btn select-btn active-skin" disabled>✓ Active</button>`;
    } else {
      btnHtml = `<button class="card-btn select-btn" onclick="selectHat('${h.id}')">Equip</button>`;
    }
    return `<div class="${cardCls}">
      <div class="card-name">${h.name}</div>
      <div class="card-cost">${h.cost === 0 ? '<span class="free">Free</span>' : (isOwned ? '' : h.cost + ' \uD83E\uDE99')}</div>
      ${btnHtml}
    </div>`;
  }).join('');
}

function buyUpgrade(id) {
  const u = UPGRADES.find(x => x.id === id);
  if (!u || hasUpgrade(id) || getBank() < u.cost) return;
  spendFromBank(u.cost);
  buyUpgradeLS(id);
  renderShop();
}
function buySkin(id) {
  const s = SKINS.find(x => x.id === id);
  if (!s || getOwnedSkins().includes(id) || getBank() < s.cost) return;
  spendFromBank(s.cost);
  ownSkin(id);
  setActiveSkin(id);
  renderShop();
}
function selectSkin(id) {
  setActiveSkin(id);
  renderShop();
}

// Tab switching
function shopTab(activeId) {
  document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.shop-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById(activeId).classList.add('active');
  const panelMap = { 'tab-upgrades': 'shop-upgrades-panel', 'tab-skins': 'shop-skins-panel', 'tab-hats': 'shop-hats-panel' };
  document.getElementById(panelMap[activeId]).classList.remove('hidden');
}
document.getElementById('tab-upgrades').addEventListener('click', () => shopTab('tab-upgrades'));
document.getElementById('tab-skins').addEventListener('click',    () => shopTab('tab-skins'));
document.getElementById('tab-hats').addEventListener('click',     () => shopTab('tab-hats'));

document.getElementById('shop-btn').addEventListener('click', openShop);
document.getElementById('shop-close-btn').addEventListener('click', closeShop);

// ─── ACHIEVEMENTS SCREEN ────────────────────────────────────────
function openAchievements() {
  const unlocked = getAchievements();
  document.getElementById('ach-grid').innerHTML = ACHIEVEMENTS.map(a => {
    const done = unlocked.includes(a.id);
    return `<div class="ach-card ${done ? 'unlocked' : 'locked'}">
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-name">${done ? a.name : '???'}</div>
      <div class="ach-desc">${done ? a.desc : 'Keep playing to unlock'}</div>
    </div>`;
  }).join('');
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('achievements-screen').classList.remove('hidden');
}
document.getElementById('achievements-btn').addEventListener('click', openAchievements);
document.getElementById('ach-close-btn').addEventListener('click', () => {
  document.getElementById('achievements-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
});

// ─── TEST MODE (from Level Editor) ─────────────────────────────
(function checkTestMode() {
  if (new URLSearchParams(location.search).get('test') !== '1') return;
  const raw = localStorage.getItem('rr_test_chunk');
  if (!raw) return;
  try {
    window.__rr_testChunk = JSON.parse(raw);
    const banner = document.createElement('div');
    banner.textContent = '✏ TEST MODE — Custom Chunk';
    banner.style.cssText =
      'position:fixed;top:8px;left:50%;transform:translateX(-50%);' +
      'background:rgba(255,107,53,0.85);color:#fff;font:bold 12px monospace;' +
      'padding:4px 14px;border-radius:4px;z-index:100;pointer-events:none;letter-spacing:0.08em;';
    document.body.appendChild(banner);
  } catch (e) {
    console.warn('Level Editor: invalid rr_test_chunk JSON', e);
  }
})();

// ─── INIT ──────────────────────────────────────────────────────
resetGS();
document.getElementById('hud').classList.add('hidden');
document.getElementById('mute-btn').textContent = muted ? '🔇' : '🔊';
if (getHS() > 0) document.getElementById('start-best').textContent = 'Best: ' + getHS().toLocaleString() + '  ·  🪙 ' + getBank().toLocaleString();
refreshDailyBtn();

requestAnimationFrame(ts => { lastTime = ts; requestAnimationFrame(loop); });
