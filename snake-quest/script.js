// ==========================================
// CONSTANTS & CONFIGURATION
// ==========================================
const GRID_SIZE = 25;
const BASE_SCORE_PER_FOOD = 10;

const STAGES = [
    {
        minScore: 0,
        baseSpeed: 150,
        maxObstacles: 2,
        bpm: 118,
        primary: '#00f3ff',
        secondary: '#b300ff',
        name: 'STAGE 1',
        gridAlpha: 0.08
    },
    {
        minScore: 50,
        baseSpeed: 120,
        maxObstacles: 5,
        bpm: 125,
        primary: '#ff006e',
        secondary: '#00f5ff',
        name: 'STAGE 2',
        gridAlpha: 0.10
    },
    {
        minScore: 150,
        baseSpeed: 90,
        maxObstacles: 8,
        bpm: 130,
        primary: '#ff0080',
        secondary: '#00ff41',
        name: 'STAGE 3',
        gridAlpha: 0.12
    },
    {
        minScore: 300,
        baseSpeed: 70,
        maxObstacles: 12,
        bpm: 138,
        primary: '#ff0080',
        secondary: '#00ff41',
        name: 'STAGE 4',
        gridAlpha: 0.14
    }
];

const POWER_UP_TYPES = [
    { type: 'speed', duration: 5000, color: '#ffee00', label: 'SPEED', symbol: '\u26A1' },
    { type: 'invincible', duration: 3000, color: '#00f3ff', label: 'GHOST', symbol: '\u{1F47B}' },
    { type: 'magnet', duration: 5000, color: '#ff00ff', label: 'MAGNET', symbol: '\u{1F9F2}' },
    { type: 'multiplier', duration: 10000, color: '#00ff41', label: '2X', symbol: '\u00D7' },
    { type: 'slowmo', duration: 5000, color: '#6666ff', label: 'SLOW', symbol: '\u23F3' }
];

const ACHIEVEMENTS = [
    { id: 'first_drop', name: 'First Drop', desc: 'Reach 100 points' },
    { id: 'all_night', name: 'All Night Long', desc: 'Survive 5 minutes' },
    { id: 'bass_boost', name: 'Bass Boost', desc: 'Collect 10 power-ups in one game' },
    { id: 'rave_legend', name: 'Rave Legend', desc: 'Reach top of leaderboard' },
    { id: 'stage_diver', name: 'Stage Diver', desc: 'Reach Stage 4' },
    { id: 'marathon', name: 'Marathon Raver', desc: 'Snake length reaches 50+' },
    { id: 'perfectionist', name: 'Perfectionist', desc: 'Reach 200 points without power-ups' }
];

const DASH_COOLDOWN = 10000;
const DASH_DISTANCE = 3;
const POWER_UP_SPAWN_INTERVAL = 15000;
const LEADERBOARD_KEY = 'snakeQuestLeaderboard';
const ACHIEVEMENTS_KEY = 'snakeQuestAchievements';

// ==========================================
// GAME STATE
// ==========================================
let canvas, ctx;
let cellSize = 0;
let canvasOffset = { x: 0, y: 0 };

let state = {
    snake: [],
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    food: null,
    obstacles: [],
    powerUpOnField: null,
    activePowerUps: {},
    particles: [],
    score: 0,
    stage: 0,
    running: false,
    paused: false,
    gameOver: false,
    lastTick: 0,
    tickAccumulator: 0,
    dashReady: true,
    dashCooldownLeft: 0,
    powerUpSpawnTimer: 0,
    startTime: 0,
    powerUpsCollected: 0,
    noPowerUpsUsed: true,
    hueShift: 0
};

let leaderboard = [];
let unlockedAchievements = {};
let musicEngine = null;
let volume = 0.5;
let muted = false;

// ==========================================
// DOM ELEMENTS
// ==========================================
const $ = id => document.getElementById(id);
const els = {};

function cacheDom() {
    const ids = [
        'gameCanvas', 'hud', 'score-display', 'highscore-display', 'stage-display',
        'power-up-indicators', 'dash-fill', 'start-screen', 'start-leaderboard-list',
        'pause-menu', 'resume-btn', 'restart-btn', 'pause-leaderboard-btn',
        'volume-slider', 'mute-btn', 'game-over', 'final-score', 'final-stage',
        'final-length', 'highscore-entry', 'new-score', 'player-name', 'submit-score',
        'leaderboard-view', 'leaderboard-list', 'close-leaderboard',
        'stage-transition', 'stage-text', 'achievement-container'
    ];
    ids.forEach(id => els[id] = $(id));
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isOccupied(x, y) {
    for (const seg of state.snake) {
        if (seg.x === x && seg.y === y) return true;
    }
    if (state.food && state.food.x === x && state.food.y === y) return true;
    for (const obs of state.obstacles) {
        if (obs.x === x && obs.y === y) return true;
    }
    if (state.powerUpOnField && state.powerUpOnField.x === x && state.powerUpOnField.y === y) return true;
    return false;
}

function findEmptyCell() {
    let attempts = 0;
    while (attempts < 1000) {
        const x = randomInt(0, GRID_SIZE - 1);
        const y = randomInt(0, GRID_SIZE - 1);
        if (!isOccupied(x, y)) return { x, y };
        attempts++;
    }
    return null;
}

function getCurrentStage() {
    for (let i = STAGES.length - 1; i >= 0; i--) {
        if (state.score >= STAGES[i].minScore) return i;
    }
    return 0;
}

function getCurrentSpeed() {
    const stageData = STAGES[state.stage];
    let speed = stageData.baseSpeed;
    if (state.activePowerUps.speed) speed *= 0.6;
    if (state.activePowerUps.slowmo) speed *= 1.5;
    return speed;
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

// ==========================================
// PARTICLE SYSTEM
// ==========================================
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 6;
        this.vy = (Math.random() - 0.5) * 6;
        this.life = 1;
        this.decay = 0.01 + Math.random() * 0.025;
        this.size = 2 + Math.random() * 4;
        this.color = color;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.05;
        this.life -= this.decay;
        this.size *= 0.98;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function createParticleBurst(gridX, gridY, color, count = 20) {
    const px = gridX * cellSize + cellSize / 2;
    const py = gridY * cellSize + cellSize / 2;
    for (let i = 0; i < count; i++) {
        state.particles.push(new Particle(px, py, color));
    }
}

// ==========================================
// SNAKE LOGIC
// ==========================================
function initSnake() {
    const mid = Math.floor(GRID_SIZE / 2);
    state.snake = [
        { x: mid, y: mid },
        { x: mid - 1, y: mid },
        { x: mid - 2, y: mid }
    ];
    state.direction = { x: 1, y: 0 };
    state.nextDirection = { x: 1, y: 0 };
}

function moveSnake() {
    state.direction = { ...state.nextDirection };
    const head = state.snake[0];
    let newX = head.x + state.direction.x;
    let newY = head.y + state.direction.y;

    const isGhost = !!state.activePowerUps.invincible;

    // Wall collision
    if (newX < 0 || newX >= GRID_SIZE || newY < 0 || newY >= GRID_SIZE) {
        if (isGhost) {
            newX = (newX + GRID_SIZE) % GRID_SIZE;
            newY = (newY + GRID_SIZE) % GRID_SIZE;
        } else {
            endGame();
            return;
        }
    }

    // Obstacle collision
    if (!isGhost) {
        for (const obs of state.obstacles) {
            if (obs.x === newX && obs.y === newY) {
                endGame();
                return;
            }
        }
    }

    // Self collision
    for (let i = 0; i < state.snake.length - 1; i++) {
        if (state.snake[i].x === newX && state.snake[i].y === newY) {
            endGame();
            return;
        }
    }

    state.snake.unshift({ x: newX, y: newY });

    // Check food
    if (state.food && newX === state.food.x && newY === state.food.y) {
        eatFood();
    } else {
        state.snake.pop();
    }

    // Check power-up pickup
    if (state.powerUpOnField && newX === state.powerUpOnField.x && newY === state.powerUpOnField.y) {
        pickUpPowerUp();
    }
}

function performDash() {
    if (!state.dashReady || state.paused || !state.running) return;
    state.direction = { ...state.nextDirection };

    for (let i = 0; i < DASH_DISTANCE; i++) {
        const head = state.snake[0];
        let newX = head.x + state.direction.x;
        let newY = head.y + state.direction.y;
        newX = (newX + GRID_SIZE) % GRID_SIZE;
        newY = (newY + GRID_SIZE) % GRID_SIZE;
        state.snake.unshift({ x: newX, y: newY });

        if (state.food && newX === state.food.x && newY === state.food.y) {
            eatFood();
        }
        if (state.powerUpOnField && newX === state.powerUpOnField.x && newY === state.powerUpOnField.y) {
            pickUpPowerUp();
        }
    }

    // Dash creates trail particles
    const head = state.snake[0];
    createParticleBurst(head.x, head.y, STAGES[state.stage].primary, 10);
    playSfx('dash');

    state.dashReady = false;
    state.dashCooldownLeft = DASH_COOLDOWN;
}

// ==========================================
// FOOD LOGIC
// ==========================================
function spawnFood() {
    const pos = findEmptyCell();
    if (pos) state.food = pos;
}

function eatFood() {
    const multiplier = state.activePowerUps.multiplier ? 2 : 1;
    state.score += BASE_SCORE_PER_FOOD * multiplier;
    createParticleBurst(state.food.x, state.food.y, STAGES[state.stage].primary, 25);
    playSfx('eat');

    const newStage = getCurrentStage();
    if (newStage !== state.stage) {
        transitionStage(newStage);
    }

    spawnFood();
    updateHUD();
    checkAchievements();
}

// ==========================================
// MAGNET LOGIC
// ==========================================
function applyMagnet() {
    if (!state.activePowerUps.magnet || !state.food) return;
    const head = state.snake[0];
    const dx = head.x - state.food.x;
    const dy = head.y - state.food.y;
    let moveX = 0, moveY = 0;
    if (Math.abs(dx) > Math.abs(dy)) {
        moveX = dx > 0 ? 1 : -1;
    } else if (dy !== 0) {
        moveY = dy > 0 ? 1 : -1;
    }
    const newX = state.food.x + moveX;
    const newY = state.food.y + moveY;
    if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE) {
        let blocked = false;
        for (const obs of state.obstacles) {
            if (obs.x === newX && obs.y === newY) { blocked = true; break; }
        }
        if (!blocked) {
            state.food.x = newX;
            state.food.y = newY;
        }
    }
}

// ==========================================
// POWER-UP LOGIC
// ==========================================
function spawnPowerUp() {
    if (state.powerUpOnField) return;
    const pos = findEmptyCell();
    if (!pos) return;
    const type = POWER_UP_TYPES[randomInt(0, POWER_UP_TYPES.length - 1)];
    state.powerUpOnField = { ...pos, ...type };
}

function pickUpPowerUp() {
    const pu = state.powerUpOnField;
    state.activePowerUps[pu.type] = pu.duration;
    state.powerUpOnField = null;
    state.powerUpsCollected++;
    state.noPowerUpsUsed = false;
    createParticleBurst(pu.x, pu.y, pu.color, 15);
    playSfx('powerup');
    updatePowerUpDisplay();
    checkAchievements();
}

function updatePowerUps(dt) {
    for (const type in state.activePowerUps) {
        state.activePowerUps[type] -= dt;
        if (state.activePowerUps[type] <= 0) {
            delete state.activePowerUps[type];
        }
    }
    updatePowerUpDisplay();
}

function updatePowerUpDisplay() {
    const container = els['power-up-indicators'];
    container.innerHTML = '';
    for (const type in state.activePowerUps) {
        const info = POWER_UP_TYPES.find(p => p.type === type);
        if (!info) continue;
        const badge = document.createElement('div');
        badge.className = 'power-up-badge';
        badge.style.background = info.color;
        badge.style.color = '#000';
        badge.style.boxShadow = `0 0 8px ${info.color}`;
        const secs = Math.ceil(state.activePowerUps[type] / 1000);
        badge.textContent = `${info.label} ${secs}s`;
        container.appendChild(badge);
    }
}

// ==========================================
// OBSTACLE LOGIC
// ==========================================
function spawnObstacles() {
    const target = STAGES[state.stage].maxObstacles;
    while (state.obstacles.length < target) {
        const pos = findEmptyCell();
        if (!pos) break;
        // Don't spawn too close to snake head
        const head = state.snake[0];
        const dist = Math.abs(pos.x - head.x) + Math.abs(pos.y - head.y);
        if (dist < 4) continue;
        state.obstacles.push(pos);
    }
}

// ==========================================
// STAGE TRANSITIONS
// ==========================================
function transitionStage(newStage) {
    state.stage = newStage;
    const stageData = STAGES[newStage];

    // Show transition popup
    els['stage-text'].textContent = stageData.name;
    els['stage-text'].style.color = stageData.primary;
    els['stage-text'].style.textShadow = `0 0 20px ${stageData.primary}, 0 0 40px ${stageData.primary}`;
    els['stage-transition'].classList.remove('hidden');

    // Force animation restart
    els['stage-text'].style.animation = 'none';
    void els['stage-text'].offsetHeight;
    els['stage-text'].style.animation = 'stage-pop 1.5s ease-out forwards';

    setTimeout(() => {
        els['stage-transition'].classList.add('hidden');
    }, 1500);

    // Spawn more obstacles
    spawnObstacles();

    // Update stage display color
    els['stage-display'].textContent = stageData.name;
    els['stage-display'].style.color = stageData.primary;
    els['stage-display'].style.textShadow = `0 0 10px ${stageData.primary}, 0 0 20px ${stageData.primary}`;

    // Update music
    if (musicEngine) musicEngine.setStage(newStage);

    checkAchievements();
}

// ==========================================
// RENDERING
// ==========================================
function drawGrid(timestamp) {
    const stageData = STAGES[state.stage];
    const pulse = Math.sin(timestamp * 0.003) * 0.03;
    const alpha = stageData.gridAlpha + pulse;
    const rgb = hexToRgb(stageData.primary);

    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    ctx.lineWidth = 0.5;

    for (let i = 0; i <= GRID_SIZE; i++) {
        const pos = i * cellSize;
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, GRID_SIZE * cellSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(GRID_SIZE * cellSize, pos);
        ctx.stroke();
    }
}

function drawSnake() {
    const stageData = STAGES[state.stage];
    const isGhost = !!state.activePowerUps.invincible;
    const hasSpeedBoost = !!state.activePowerUps.speed;

    for (let i = state.snake.length - 1; i >= 0; i--) {
        const seg = state.snake[i];
        const x = seg.x * cellSize;
        const y = seg.y * cellSize;
        const t = i / state.snake.length;

        let color;
        if (state.stage === 3) {
            // Stage 4: rainbow cycling
            const hue = (state.hueShift + i * 12) % 360;
            color = `hsl(${hue}, 100%, 60%)`;
        } else {
            const rgb1 = hexToRgb(stageData.primary);
            const rgb2 = hexToRgb(stageData.secondary);
            const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * t);
            const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * t);
            const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * t);
            color = `rgb(${r}, ${g}, ${b})`;
        }

        ctx.save();
        ctx.globalAlpha = isGhost ? 0.4 + Math.sin(Date.now() * 0.01) * 0.2 : 1;

        // Glow
        ctx.shadowColor = color;
        ctx.shadowBlur = i === 0 ? 15 : 8;
        ctx.fillStyle = color;

        const padding = 1;
        const size = cellSize - padding * 2;
        const radius = i === 0 ? size * 0.35 : size * 0.25;

        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, size, size, radius);
        ctx.fill();

        // Head eyes
        if (i === 0) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#000';
            const eyeSize = cellSize * 0.12;
            const eyeOffset = cellSize * 0.22;
            let ex1, ey1, ex2, ey2;

            if (state.direction.x === 1) {
                ex1 = x + cellSize * 0.65; ey1 = y + cellSize * 0.3;
                ex2 = x + cellSize * 0.65; ey2 = y + cellSize * 0.7;
            } else if (state.direction.x === -1) {
                ex1 = x + cellSize * 0.35; ey1 = y + cellSize * 0.3;
                ex2 = x + cellSize * 0.35; ey2 = y + cellSize * 0.7;
            } else if (state.direction.y === -1) {
                ex1 = x + cellSize * 0.3; ey1 = y + cellSize * 0.35;
                ex2 = x + cellSize * 0.7; ey2 = y + cellSize * 0.35;
            } else {
                ex1 = x + cellSize * 0.3; ey1 = y + cellSize * 0.65;
                ex2 = x + cellSize * 0.7; ey2 = y + cellSize * 0.65;
            }

            ctx.beginPath();
            ctx.arc(ex1, ey1, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(ex2, ey2, eyeSize, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    // Speed boost trail
    if (hasSpeedBoost && state.snake.length > 1) {
        const tail = state.snake[state.snake.length - 1];
        createParticleBurst(tail.x, tail.y, stageData.primary, 1);
    }
}

function drawFood() {
    if (!state.food) return;
    const x = state.food.x * cellSize + cellSize / 2;
    const y = state.food.y * cellSize + cellSize / 2;
    const stageData = STAGES[state.stage];

    const pulse = 0.7 + Math.sin(Date.now() * 0.005) * 0.3;
    const radius = (cellSize / 2 - 2) * pulse;

    ctx.save();
    ctx.shadowColor = stageData.primary;
    ctx.shadowBlur = 15;
    ctx.fillStyle = stageData.primary;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner glow
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawObstacles() {
    ctx.save();
    for (const obs of state.obstacles) {
        const x = obs.x * cellSize;
        const y = obs.y * cellSize;
        ctx.fillStyle = '#ff2244';
        ctx.shadowColor = '#ff2244';
        ctx.shadowBlur = 8;
        ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);

        // X pattern
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 4);
        ctx.lineTo(x + cellSize - 4, y + cellSize - 4);
        ctx.moveTo(x + cellSize - 4, y + 4);
        ctx.lineTo(x + 4, y + cellSize - 4);
        ctx.stroke();
    }
    ctx.restore();
}

function drawPowerUp() {
    if (!state.powerUpOnField) return;
    const pu = state.powerUpOnField;
    const x = pu.x * cellSize + cellSize / 2;
    const y = pu.y * cellSize + cellSize / 2;

    const pulse = 0.8 + Math.sin(Date.now() * 0.006) * 0.2;
    const radius = (cellSize / 2 - 1) * pulse;

    ctx.save();
    ctx.shadowColor = pu.color;
    ctx.shadowBlur = 12;

    // Outer ring
    ctx.strokeStyle = pu.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner fill
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = pu.color;
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.fillStyle = pu.color;
    ctx.font = `bold ${Math.floor(cellSize * 0.4)}px Courier New`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pu.label, x, y);

    ctx.restore();
}

function drawParticles() {
    for (let i = state.particles.length - 1; i >= 0; i--) {
        state.particles[i].update();
        state.particles[i].draw(ctx);
        if (state.particles[i].life <= 0) {
            state.particles.splice(i, 1);
        }
    }
}

function render(timestamp) {
    const canvasW = GRID_SIZE * cellSize;
    const canvasH = GRID_SIZE * cellSize;

    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvasW, canvasH);

    drawGrid(timestamp);
    drawObstacles();
    drawFood();
    drawPowerUp();
    drawSnake();
    drawParticles();
}

// ==========================================
// HUD
// ==========================================
function updateHUD() {
    els['score-display'].textContent = `SCORE: ${state.score}`;
    const best = leaderboard.length > 0 ? leaderboard[0].score : 0;
    els['highscore-display'].textContent = `BEST: ${best}`;
}

function updateDashBar() {
    const pct = state.dashReady ? 100 : Math.max(0, 100 - (state.dashCooldownLeft / DASH_COOLDOWN) * 100);
    els['dash-fill'].style.width = pct + '%';
    if (state.dashReady) {
        els['dash-fill'].style.background = 'var(--primary)';
        els['dash-fill'].style.boxShadow = '0 0 6px var(--primary)';
    } else {
        els['dash-fill'].style.background = '#555';
        els['dash-fill'].style.boxShadow = 'none';
    }
}

// ==========================================
// AUDIO SYSTEM - PROCEDURAL MUSIC ENGINE
// ==========================================
class MusicEngine {
    constructor() {
        this.audioCtx = null;
        this.masterGain = null;
        this.currentStage = -1;
        this.playing = false;
        this.intervalId = null;
        this.step = 0;
        this.noiseBuffer = null;
    }

    init() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.value = volume;
        this.masterGain.connect(this.audioCtx.destination);

        // Pre-generate noise buffer for hi-hats/snares
        const bufLen = this.audioCtx.sampleRate * 0.5;
        this.noiseBuffer = this.audioCtx.createBuffer(1, bufLen, this.audioCtx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufLen; i++) {
            data[i] = Math.random() * 2 - 1;
        }
    }

    setVolume(v) {
        volume = v;
        if (this.masterGain) this.masterGain.gain.value = muted ? 0 : v;
    }

    toggleMute() {
        muted = !muted;
        if (this.masterGain) this.masterGain.gain.value = muted ? 0 : volume;
    }

    start() {
        if (!this.audioCtx) this.init();
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        this.playing = true;
        this.setStage(state.stage);
    }

    stop() {
        this.playing = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    setStage(stageIdx) {
        if (!this.playing) return;
        if (this.intervalId) clearInterval(this.intervalId);
        this.currentStage = stageIdx;
        this.step = 0;
        const bpm = STAGES[stageIdx].bpm;
        const stepTime = (60 / bpm / 4) * 1000; // 16th notes
        this.intervalId = setInterval(() => this.tick(), stepTime);
    }

    tick() {
        if (!this.playing || !this.audioCtx) return;
        const t = this.audioCtx.currentTime;
        const s = this.step % 16;
        const stage = this.currentStage;

        // Kick on beats 0, 4, 8, 12 (4 on the floor)
        if (s % 4 === 0) this.playKick(t);

        // Hi-hat patterns vary by stage
        if (stage === 0) {
            if (s % 4 === 2) this.playHiHat(t, false);
        } else if (stage === 1) {
            if (s % 2 === 0) this.playHiHat(t, false);
            if (s === 6 || s === 14) this.playHiHat(t, true);
        } else if (stage === 2) {
            this.playHiHat(t, s % 4 === 2);
        } else {
            this.playHiHat(t, s % 2 === 0);
            if (s % 2 === 1) this.playHiHat(t, false);
        }

        // Snare/clap on beats 4, 12
        if (s === 4 || s === 12) this.playSnare(t);

        // Bass line
        if (stage >= 1) {
            const bassNotes = [82.41, 73.42, 65.41, 73.42]; // E2, D2, C2, D2
            if (s % 4 === 0) {
                const noteIdx = Math.floor(this.step / 4) % bassNotes.length;
                this.playBass(t, bassNotes[noteIdx], stage);
            }
        }

        // Synth chords (stages 2+)
        if (stage >= 2 && (s === 0 || s === 8)) {
            this.playSynth(t, stage);
        }

        this.step++;
    }

    playKick(time) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(30, time + 0.12);
        gain.gain.setValueAtTime(0.7, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.25);
    }

    playHiHat(time, open) {
        const source = this.audioCtx.createBufferSource();
        source.buffer = this.noiseBuffer;
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 8000;
        const gain = this.audioCtx.createGain();
        const dur = open ? 0.15 : 0.04;
        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        source.start(time);
        source.stop(time + dur + 0.01);
    }

    playSnare(time) {
        // Noise component
        const noise = this.audioCtx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const nFilter = this.audioCtx.createBiquadFilter();
        nFilter.type = 'bandpass';
        nFilter.frequency.value = 3000;
        const nGain = this.audioCtx.createGain();
        nGain.gain.setValueAtTime(0.3, time);
        nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(this.masterGain);
        noise.start(time);
        noise.stop(time + 0.16);

        // Tone component
        const osc = this.audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, time);
        osc.frequency.exponentialRampToValueAtTime(80, time + 0.08);
        const oGain = this.audioCtx.createGain();
        oGain.gain.setValueAtTime(0.25, time);
        oGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        osc.connect(oGain);
        oGain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.1);
    }

    playBass(time, freq, stage) {
        const osc = this.audioCtx.createOscillator();
        osc.type = stage >= 3 ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(freq, time);
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200 + stage * 100, time);
        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.21);
    }

    playSynth(time, stage) {
        const chords = [
            [164.81, 196.0, 246.94],  // Em
            [146.83, 185.0, 220.0],   // D
            [130.81, 164.81, 196.0]   // C
        ];
        const chordIdx = Math.floor(this.step / 16) % chords.length;
        const chord = chords[chordIdx];

        chord.forEach(freq => {
            const osc = this.audioCtx.createOscillator();
            osc.type = stage >= 3 ? 'square' : 'sawtooth';
            osc.frequency.value = freq;
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800 + stage * 300, time);
            filter.frequency.exponentialRampToValueAtTime(300, time + 0.3);
            const gain = this.audioCtx.createGain();
            gain.gain.setValueAtTime(0.06, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            osc.start(time);
            osc.stop(time + 0.31);
        });
    }
}

// SFX
function playSfx(type) {
    if (!musicEngine || !musicEngine.audioCtx || muted) return;
    const ctx = musicEngine.audioCtx;
    const t = ctx.currentTime;

    if (type === 'eat') {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gain);
        gain.connect(musicEngine.masterGain);
        osc.start(t);
        osc.stop(t + 0.12);
    } else if (type === 'powerup') {
        [800, 1000, 1200].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.1, t + i * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.1);
            osc.connect(gain);
            gain.connect(musicEngine.masterGain);
            osc.start(t + i * 0.06);
            osc.stop(t + i * 0.06 + 0.11);
        });
    } else if (type === 'dash') {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.1);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gain);
        gain.connect(musicEngine.masterGain);
        osc.start(t);
        osc.stop(t + 0.15);
    } else if (type === 'gameover') {
        [400, 300, 200].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            osc.type = 'square';
            osc.frequency.value = freq;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.12, t + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.2);
            osc.connect(gain);
            gain.connect(musicEngine.masterGain);
            osc.start(t + i * 0.15);
            osc.stop(t + i * 0.15 + 0.21);
        });
    }
}

// ==========================================
// LEADERBOARD
// ==========================================
function loadLeaderboard() {
    try {
        const data = localStorage.getItem(LEADERBOARD_KEY);
        leaderboard = data ? JSON.parse(data) : [];
    } catch {
        leaderboard = [];
    }
}

function saveLeaderboard() {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard));
}

function isHighScore(score) {
    if (leaderboard.length < 10) return true;
    return score > leaderboard[leaderboard.length - 1].score;
}

function addScore(name, score) {
    const entry = {
        name: name.toUpperCase().substring(0, 12) || 'ANON',
        score,
        date: new Date().toLocaleDateString()
    };
    leaderboard.push(entry);
    leaderboard.sort((a, b) => b.score - a.score);
    leaderboard = leaderboard.slice(0, 10);
    saveLeaderboard();
}

function renderLeaderboard(containerId) {
    const container = els[containerId];
    if (!container) return;

    if (leaderboard.length === 0) {
        container.innerHTML = '<div class="leaderboard-empty">No scores yet</div>';
        return;
    }

    const best = leaderboard[0].score;
    let html = '<div class="leaderboard-table">';
    html += '<div class="leaderboard-row header"><span class="rank">#</span><span class="name">NAME</span><span class="score">SCORE</span><span class="date">DATE</span></div>';

    leaderboard.forEach((entry, i) => {
        const isBest = i === 0 ? ' personal-best' : '';
        html += `<div class="leaderboard-row${isBest}"><span class="rank">${i + 1}</span><span class="name">${entry.name}</span><span class="score">${entry.score}</span><span class="date">${entry.date}</span></div>`;
    });

    html += '</div>';
    container.innerHTML = html;
}

// ==========================================
// ACHIEVEMENTS
// ==========================================
function loadAchievements() {
    try {
        const data = localStorage.getItem(ACHIEVEMENTS_KEY);
        unlockedAchievements = data ? JSON.parse(data) : {};
    } catch {
        unlockedAchievements = {};
    }
}

function saveAchievements() {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(unlockedAchievements));
}

function checkAchievements() {
    const elapsed = (Date.now() - state.startTime) / 1000;

    const checks = {
        first_drop: state.score >= 100,
        all_night: elapsed >= 300,
        bass_boost: state.powerUpsCollected >= 10,
        rave_legend: leaderboard.length > 0 && state.score > leaderboard[0].score,
        stage_diver: state.stage >= 3,
        marathon: state.snake.length >= 50,
        perfectionist: state.score >= 200 && state.noPowerUpsUsed
    };

    for (const [id, condition] of Object.entries(checks)) {
        if (condition && !unlockedAchievements[id]) {
            unlockAchievement(id);
        }
    }
}

function unlockAchievement(id) {
    unlockedAchievements[id] = true;
    saveAchievements();
    const achiev = ACHIEVEMENTS.find(a => a.id === id);
    if (achiev) showAchievementNotification(achiev);
}

function showAchievementNotification(achiev) {
    const popup = document.createElement('div');
    popup.className = 'achievement-popup';
    popup.innerHTML = `<span class="achieve-icon">\u2605</span> ${achiev.name} - ${achiev.desc}`;
    els['achievement-container'].appendChild(popup);
    setTimeout(() => popup.remove(), 3500);
}

// ==========================================
// UI / MENUS
// ==========================================
function showOverlay(id) {
    hideAllOverlays();
    els[id].classList.remove('hidden');
}

function hideAllOverlays() {
    ['start-screen', 'pause-menu', 'game-over', 'highscore-entry', 'leaderboard-view'].forEach(id => {
        els[id].classList.add('hidden');
    });
}

function showStartScreen() {
    renderLeaderboard('start-leaderboard-list');
    showOverlay('start-screen');
    els['hud'].classList.add('hidden');
}

function showPauseMenu() {
    showOverlay('pause-menu');
}

function showGameOver() {
    els['final-score'].textContent = state.score;
    els['final-stage'].textContent = `Stage ${state.stage + 1}`;
    els['final-length'].textContent = `Snake Length: ${state.snake.length}`;

    if (isHighScore(state.score) && state.score > 0) {
        els['new-score'].textContent = state.score;
        showOverlay('highscore-entry');
        els['player-name'].value = '';
        els['player-name'].focus();
    } else {
        showOverlay('game-over');
    }
}

function showLeaderboardView() {
    renderLeaderboard('leaderboard-list');
    showOverlay('leaderboard-view');
}

// ==========================================
// GAME FLOW
// ==========================================
function resetGame() {
    state.snake = [];
    state.direction = { x: 1, y: 0 };
    state.nextDirection = { x: 1, y: 0 };
    state.food = null;
    state.obstacles = [];
    state.powerUpOnField = null;
    state.activePowerUps = {};
    state.particles = [];
    state.score = 0;
    state.stage = 0;
    state.running = false;
    state.paused = false;
    state.gameOver = false;
    state.lastTick = 0;
    state.tickAccumulator = 0;
    state.dashReady = true;
    state.dashCooldownLeft = 0;
    state.powerUpSpawnTimer = 0;
    state.startTime = 0;
    state.powerUpsCollected = 0;
    state.noPowerUpsUsed = true;
    state.hueShift = 0;
}

function startGame() {
    resetGame();
    initSnake();
    spawnFood();
    spawnObstacles();

    state.running = true;
    state.startTime = Date.now();

    hideAllOverlays();
    els['hud'].classList.remove('hidden');

    const stageData = STAGES[0];
    els['stage-display'].textContent = stageData.name;
    els['stage-display'].style.color = stageData.primary;
    updateHUD();
    updateDashBar();
    updatePowerUpDisplay();

    if (!musicEngine) musicEngine = new MusicEngine();
    musicEngine.start();
}

function endGame() {
    state.running = false;
    state.gameOver = true;
    playSfx('gameover');
    if (musicEngine) musicEngine.stop();
    checkAchievements();

    setTimeout(() => showGameOver(), 500);
}

function togglePause() {
    if (state.gameOver || !state.running) return;
    state.paused = !state.paused;
    if (state.paused) {
        showPauseMenu();
        if (musicEngine) musicEngine.stop();
    } else {
        hideAllOverlays();
        if (musicEngine) musicEngine.start();
    }
}

// ==========================================
// INPUT HANDLING
// ==========================================
function handleKeyDown(e) {
    const key = e.key.toLowerCase();

    // Start/restart
    if (key === ' ' || key === 'spacebar') {
        e.preventDefault();
        if (!state.running && !state.gameOver) {
            // On start screen
            startGame();
            return;
        }
        if (state.gameOver) {
            showStartScreen();
            return;
        }
        togglePause();
        return;
    }

    if (state.paused || !state.running) return;

    // Direction
    const dir = state.direction;
    if ((key === 'arrowup' || key === 'w') && dir.y !== 1) {
        state.nextDirection = { x: 0, y: -1 };
    } else if ((key === 'arrowdown' || key === 's') && dir.y !== -1) {
        state.nextDirection = { x: 0, y: 1 };
    } else if ((key === 'arrowleft' || key === 'a') && dir.x !== 1) {
        state.nextDirection = { x: -1, y: 0 };
    } else if ((key === 'arrowright' || key === 'd') && dir.x !== -1) {
        state.nextDirection = { x: 1, y: 0 };
    }

    // Dash
    if (key === 'e' || key === 'shift') {
        e.preventDefault();
        performDash();
    }
}

// ==========================================
// GAME LOOP
// ==========================================
function gameTick() {
    moveSnake();
    applyMagnet();
}

function gameLoop(timestamp) {
    if (!state.lastTick) state.lastTick = timestamp;
    const dt = timestamp - state.lastTick;
    state.lastTick = timestamp;

    if (state.running && !state.paused && !state.gameOver) {
        // Snake movement tick
        state.tickAccumulator += dt;
        const speed = getCurrentSpeed();
        while (state.tickAccumulator >= speed) {
            state.tickAccumulator -= speed;
            gameTick();
            if (state.gameOver) break;
        }

        // Dash cooldown
        if (!state.dashReady) {
            state.dashCooldownLeft -= dt;
            if (state.dashCooldownLeft <= 0) {
                state.dashReady = true;
                state.dashCooldownLeft = 0;
            }
        }
        updateDashBar();

        // Power-up timers
        updatePowerUps(dt);

        // Power-up spawning
        state.powerUpSpawnTimer += dt;
        if (state.powerUpSpawnTimer >= POWER_UP_SPAWN_INTERVAL) {
            state.powerUpSpawnTimer = 0;
            spawnPowerUp();
        }

        // Stage 4 hue cycling
        if (state.stage === 3) {
            state.hueShift = (state.hueShift + 2) % 360;
        }

        // Periodic achievement check
        checkAchievements();
    }

    render(timestamp);
    requestAnimationFrame(gameLoop);
}

// ==========================================
// CANVAS SIZING
// ==========================================
function resizeCanvas() {
    const maxW = window.innerWidth * 0.92;
    const maxH = window.innerHeight * 0.88;
    const size = Math.floor(Math.min(maxW, maxH));
    cellSize = Math.floor(size / GRID_SIZE);
    const canvasSize = cellSize * GRID_SIZE;

    canvas.width = canvasSize;
    canvas.height = canvasSize;
}

// ==========================================
// EVENT BINDING
// ==========================================
function bindEvents() {
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', resizeCanvas);

    els['resume-btn'].addEventListener('click', () => togglePause());
    els['restart-btn'].addEventListener('click', () => startGame());
    els['pause-leaderboard-btn'].addEventListener('click', () => showLeaderboardView());
    els['close-leaderboard'].addEventListener('click', () => {
        if (state.paused) showPauseMenu();
        else showStartScreen();
    });

    els['volume-slider'].addEventListener('input', e => {
        const v = parseInt(e.target.value) / 100;
        if (musicEngine) musicEngine.setVolume(v);
    });

    els['mute-btn'].addEventListener('click', () => {
        if (musicEngine) musicEngine.toggleMute();
        els['mute-btn'].textContent = muted ? 'UNMUTE' : 'MUTE';
    });

    els['submit-score'].addEventListener('click', submitHighScore);
    els['player-name'].addEventListener('keydown', e => {
        if (e.key === 'Enter') submitHighScore();
    });
}

function submitHighScore() {
    const name = els['player-name'].value.trim();
    addScore(name || 'ANON', state.score);
    checkAchievements(); // re-check rave_legend
    showLeaderboardView();
}

// ==========================================
// INITIALIZATION
// ==========================================
function init() {
    cacheDom();
    canvas = els['gameCanvas'];
    ctx = canvas.getContext('2d');

    loadLeaderboard();
    loadAchievements();
    resizeCanvas();
    bindEvents();
    showStartScreen();

    requestAnimationFrame(gameLoop);
}

window.addEventListener('load', init);
