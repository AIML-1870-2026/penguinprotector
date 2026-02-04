// Boids Rave Lab - Main Script

// ============== Vector Class ==============
class Vector {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    static random() {
        const angle = Math.random() * Math.PI * 2;
        return new Vector(Math.cos(angle), Math.sin(angle));
    }

    copy() {
        return new Vector(this.x, this.y);
    }

    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }

    mult(n) {
        this.x *= n;
        this.y *= n;
        return this;
    }

    div(n) {
        if (n !== 0) {
            this.x /= n;
            this.y /= n;
        }
        return this;
    }

    mag() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    magSq() {
        return this.x * this.x + this.y * this.y;
    }

    normalize() {
        const m = this.mag();
        if (m > 0) this.div(m);
        return this;
    }

    limit(max) {
        const mSq = this.magSq();
        if (mSq > max * max) {
            this.div(Math.sqrt(mSq)).mult(max);
        }
        return this;
    }

    setMag(n) {
        return this.normalize().mult(n);
    }

    heading() {
        return Math.atan2(this.y, this.x);
    }

    dist(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static sub(v1, v2) {
        return new Vector(v1.x - v2.x, v1.y - v2.y);
    }

    static add(v1, v2) {
        return new Vector(v1.x + v2.x, v1.y + v2.y);
    }
}

// ============== Boid Class ==============
class Boid {
    constructor(x, y) {
        this.position = new Vector(x, y);
        this.velocity = Vector.random().mult(Math.random() * 2 + 2);
        this.acceleration = new Vector(0, 0);

        // Smoothed velocity for rendering (reduces jitter)
        this.smoothedVelocity = this.velocity.copy();

        // Previous acceleration for smoothing
        this.prevAcceleration = new Vector(0, 0);

        // Bioluminescent jellyfish colors
        const colors = [
            '#00ffff', // Cyan
            '#ff00ff', // Magenta
            '#7b68ee', // Medium slate blue
            '#00fa9a', // Medium spring green
            '#ff69b4', // Hot pink
            '#87cefa', // Light sky blue
            '#da70d6', // Orchid
            '#40e0d0'  // Turquoise
        ];
        this.color = colors[Math.floor(Math.random() * colors.length)];

        // Bird-specific properties
        this.wingPhase = Math.random() * Math.PI * 2; // Wing flap animation offset
        this.size = 0.8 + Math.random() * 0.4; // Size variation
        this.isStar = Math.random() < 0.15; // 15% chance to be a star instead of bird
        this.sparkleTimer = 0;
        this.sparkleIntensity = 0;

        // Trail history
        this.trail = [];

        // Neighbor count for instrumentation
        this.neighborCount = 0;
    }

    applyForce(force) {
        this.acceleration.add(force);
    }

    // Check if another boid is within vision cone
    isInVisionCone(other, visionAngle) {
        if (visionAngle >= 360) return true;

        const toOther = Vector.sub(other.position, this.position);
        const heading = this.velocity.heading();
        const angleToOther = Math.atan2(toOther.y, toOther.x);

        let angleDiff = angleToOther - heading;
        // Normalize angle difference to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const halfVision = (visionAngle * Math.PI / 180) / 2;
        return Math.abs(angleDiff) < halfVision;
    }

    flock(boids, params) {
        const separation = new Vector();
        const alignment = new Vector();
        const cohesion = new Vector();

        let separationCount = 0;
        let alignmentCount = 0;
        let cohesionCount = 0;

        const separationRadius = params.neighborRadius * 0.5;
        const neighborRadiusSq = params.neighborRadius * params.neighborRadius;
        const separationRadiusSq = separationRadius * separationRadius;

        for (const other of boids) {
            if (other === this) continue;

            // Use squared distance for faster comparison (avoid sqrt)
            const dx = this.position.x - other.position.x;
            const dy = this.position.y - other.position.y;
            const dSq = dx * dx + dy * dy;

            // Skip if outside max radius
            if (dSq > neighborRadiusSq) continue;

            // Check if within vision cone
            if (!this.isInVisionCone(other, params.visionAngle)) continue;

            const d = Math.sqrt(dSq);

            // Separation (closer range) - use smooth falloff
            if (dSq < separationRadiusSq && d > 0) {
                const diff = new Vector(dx, dy);
                // Smooth quadratic falloff instead of harsh 1/d
                const strength = 1 - (d / separationRadius);
                diff.normalize().mult(strength * strength);
                separation.add(diff);
                separationCount++;
            }

            // Alignment and Cohesion (neighbor radius)
            if (d < params.neighborRadius) {
                // Weight by distance - closer neighbors have more influence
                const weight = 1 - (d / params.neighborRadius);
                alignment.x += other.velocity.x * weight;
                alignment.y += other.velocity.y * weight;
                cohesion.x += other.position.x * weight;
                cohesion.y += other.position.y * weight;
                alignmentCount += weight;
                cohesionCount += weight;
            }
        }

        this.neighborCount = Math.round(alignmentCount);

        // Separation - apply with soft limiting
        if (separationCount > 0) {
            separation.div(separationCount);
            if (separation.mag() > 0) {
                separation.setMag(params.maxSpeed);
                separation.sub(this.velocity);
                separation.limit(params.maxForce * 1.2); // Slightly stronger separation
                separation.mult(params.separation);
            }
        }

        // Alignment - smooth steering
        if (alignmentCount > 0) {
            alignment.div(alignmentCount);
            if (alignment.mag() > 0) {
                alignment.setMag(params.maxSpeed);
                alignment.sub(this.velocity);
                alignment.limit(params.maxForce);
                alignment.mult(params.alignment);
            }
        }

        // Cohesion - smooth steering
        if (cohesionCount > 0) {
            cohesion.div(cohesionCount);
            const desired = Vector.sub(cohesion, this.position);
            if (desired.mag() > 0) {
                desired.setMag(params.maxSpeed);
                const steer = Vector.sub(desired, this.velocity);
                steer.limit(params.maxForce);
                cohesion.x = steer.x * params.cohesion;
                cohesion.y = steer.y * params.cohesion;
            }
        }

        this.applyForce(separation);
        this.applyForce(alignment);
        this.applyForce(cohesion);
    }

    applyMouseForce(mousePos, isAttracting, isRepelling, force) {
        if (!mousePos || (!isAttracting && !isRepelling)) return;

        const d = this.position.dist(mousePos);
        const maxDist = 150;

        if (d < maxDist && d > 0) {
            let steer = Vector.sub(mousePos, this.position);
            steer.normalize();

            // Inverse distance for stronger effect when closer
            const strength = (1 - d / maxDist) * force * 0.5;
            steer.mult(strength);

            if (isRepelling) {
                steer.mult(-1.5); // Repel is stronger
            }

            this.applyForce(steer);
        }
    }

    update(params) {
        // Store trail
        if (params.trailLength > 0) {
            this.trail.push(this.position.copy());
            while (this.trail.length > params.trailLength) {
                this.trail.shift();
            }
        } else {
            this.trail = [];
        }

        // Smooth acceleration to reduce jitter (blend with previous)
        const accelSmoothing = 0.7;
        this.acceleration.x = this.acceleration.x * accelSmoothing + this.prevAcceleration.x * (1 - accelSmoothing);
        this.acceleration.y = this.acceleration.y * accelSmoothing + this.prevAcceleration.y * (1 - accelSmoothing);
        this.prevAcceleration = this.acceleration.copy();

        // Apply acceleration with damping
        this.velocity.add(this.acceleration);

        // Add slight velocity damping for smoother movement
        this.velocity.mult(0.995);

        this.velocity.limit(params.maxSpeed);
        this.position.add(this.velocity);
        this.acceleration.mult(0);

        // Smooth the velocity for rendering (interpolate towards actual velocity)
        const velocitySmoothing = 0.15;
        this.smoothedVelocity.x += (this.velocity.x - this.smoothedVelocity.x) * velocitySmoothing;
        this.smoothedVelocity.y += (this.velocity.y - this.smoothedVelocity.y) * velocitySmoothing;

        // Update wing animation
        const speed = this.velocity.mag();
        this.wingPhase += 0.15 + speed * 0.05;

        // Random sparkle effect
        this.sparkleTimer -= 1;
        if (this.sparkleTimer <= 0 && Math.random() < 0.02) {
            this.sparkleIntensity = 1;
            this.sparkleTimer = 30 + Math.random() * 60;
        }
        this.sparkleIntensity *= 0.92;
    }

    edges(width, height, bounceMode) {
        if (bounceMode) {
            // Soft edge avoidance with smooth force curve
            const margin = 50;
            const maxTurnForce = 0.8;

            // Calculate distance from each edge and apply proportional force
            if (this.position.x < margin) {
                const t = 1 - (this.position.x / margin);
                this.velocity.x += maxTurnForce * t * t; // Quadratic easing
            }
            if (this.position.x > width - margin) {
                const t = 1 - ((width - this.position.x) / margin);
                this.velocity.x -= maxTurnForce * t * t;
            }
            if (this.position.y < margin) {
                const t = 1 - (this.position.y / margin);
                this.velocity.y += maxTurnForce * t * t;
            }
            if (this.position.y > height - margin) {
                const t = 1 - ((height - this.position.y) / margin);
                this.velocity.y -= maxTurnForce * t * t;
            }
        } else {
            // Wrap mode - also wrap trail positions
            if (this.position.x > width) {
                this.position.x = 0;
                this.trail = []; // Clear trail on wrap to avoid lines across screen
            }
            if (this.position.x < 0) {
                this.position.x = width;
                this.trail = [];
            }
            if (this.position.y > height) {
                this.position.y = 0;
                this.trail = [];
            }
            if (this.position.y < 0) {
                this.position.y = height;
                this.trail = [];
            }
        }
    }

    draw(ctx, params) {
        // Draw soft glowing trail (jellyfish wake)
        if (this.trail.length > 2) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.globalAlpha = 0.15;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Use smoothed velocity for angle (reduces visual jitter)
        const angle = this.smoothedVelocity.heading();
        const speed = this.smoothedVelocity.mag();
        const baseSize = (8 + (speed / params.maxSpeed) * 4) * this.size;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(angle);

        // Skip expensive shadowBlur in performance mode (default)
        if (params.enableGlow) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.color;
        }

        this.drawJellyfish(ctx, baseSize, speed, params.maxSpeed, params);

        ctx.restore();

        // Skip sparkles for performance (only draw occasionally)
        if (params.enableGlow && this.sparkleIntensity > 0.3) {
            this.drawSparkle(ctx);
        }
    }

    drawJellyfish(ctx, size, speed, maxSpeed, params = {}) {
        // Audio reactivity
        const kick = params.audioKick || 0;
        const bass = params.audioBass || 0;
        const energy = params.audioEnergy || 0;

        // Pulsing animation - reacts to kick drum
        const basePulse = 0.85 + Math.sin(this.wingPhase) * 0.15;
        const kickPulse = 1 + kick * 0.4;  // Expand on kick

        const bellWidth = size * 0.6 * basePulse * kickPulse;  // Width (vertical when facing right)
        const bellLength = size * 0.45 * basePulse * kickPulse; // Length (horizontal depth)

        // Brightness boost on beats
        const brightness = 0.7 + energy * 0.3;

        // Draw bell/dome - proper rounded jellyfish shape
        ctx.beginPath();
        // Start at the back-top of the bell
        ctx.moveTo(-bellLength * 0.3, -bellWidth);
        // Curve to the front (right side) - top curve
        ctx.quadraticCurveTo(bellLength * 1.2, -bellWidth * 0.6, bellLength, 0);
        // Curve from front to back - bottom curve
        ctx.quadraticCurveTo(bellLength * 1.2, bellWidth * 0.6, -bellLength * 0.3, bellWidth);
        // Close the back with a slight inward curve (like real jellyfish)
        ctx.quadraticCurveTo(-bellLength * 0.1, 0, -bellLength * 0.3, -bellWidth);
        ctx.closePath();

        ctx.fillStyle = this.color;
        ctx.globalAlpha = brightness;
        ctx.fill();
        ctx.globalAlpha = 1;

        // Inner glow on bell - pulses with bass
        const glowSize = 0.4 + bass * 0.15;
        ctx.beginPath();
        ctx.ellipse(bellLength * 0.2, 0, bellLength * glowSize, bellWidth * glowSize * 0.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.25 + energy * 0.35;
        ctx.fill();
        ctx.globalAlpha = 1;

        const bellHeight = bellLength;

        // Draw tentacles (wavy lines trailing behind)
        const tentacleCount = 5;
        const tentacleLength = size * (1.5 + bass * 0.5);  // Longer on bass
        const waveAmount = 0.3 + (speed / maxSpeed) * 0.2 + energy * 0.3;  // More wave on energy

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1.5 + kick * 1.5;  // Thicker on kick
        ctx.globalAlpha = 0.6 + energy * 0.3;

        for (let t = 0; t < tentacleCount; t++) {
            const yOffset = (t - (tentacleCount - 1) / 2) * (bellWidth * 0.35);
            const phaseOffset = t * 0.8;

            ctx.beginPath();
            ctx.moveTo(-bellHeight * 0.3, yOffset);

            // Draw wavy tentacle - wave faster with energy
            for (let i = 1; i <= 8; i++) {
                const x = -bellHeight * 0.3 - (i / 8) * tentacleLength;
                const wave = Math.sin(this.wingPhase + phaseOffset + i * 0.5) * size * waveAmount;
                ctx.lineTo(x, yOffset + wave);
            }
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
    }

    drawStar(ctx, size) {
        const outerRadius = size * 0.8;
        const innerRadius = size * 0.3;
        const twinkle = 0.8 + Math.sin(this.wingPhase * 2) * 0.2;

        // Simple 4-pointed star as single path
        ctx.beginPath();
        ctx.moveTo(0, -outerRadius * twinkle);
        ctx.lineTo(innerRadius, 0);
        ctx.lineTo(0, outerRadius * twinkle);
        ctx.lineTo(-innerRadius, 0);
        ctx.closePath();

        ctx.fillStyle = this.color;
        ctx.fill();

        // Small bright core
        ctx.beginPath();
        ctx.arc(0, 0, innerRadius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
    }

    drawSparkle(ctx) {
        const sparkleSize = 12 * this.sparkleIntensity;
        ctx.save();
        ctx.translate(this.position.x, this.position.y);

        // Simple cross sparkle
        ctx.beginPath();
        ctx.moveTo(0, -sparkleSize);
        ctx.lineTo(0, sparkleSize);
        ctx.moveTo(-sparkleSize, 0);
        ctx.lineTo(sparkleSize, 0);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = this.sparkleIntensity * 0.6;
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.restore();
    }
}

// ============== Spatial Grid (Performance Optimization) ==============
class SpatialGrid {
    constructor(width, height, cellSize) {
        this.cellSize = cellSize;
        this.cols = Math.ceil(width / cellSize);
        this.rows = Math.ceil(height / cellSize);
        this.cells = new Map();
    }

    clear() {
        this.cells.clear();
    }

    getCellKey(x, y) {
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);
        return `${col},${row}`;
    }

    insert(boid) {
        const key = this.getCellKey(boid.position.x, boid.position.y);
        if (!this.cells.has(key)) {
            this.cells.set(key, []);
        }
        this.cells.get(key).push(boid);
    }

    getNeighbors(boid, radius) {
        const neighbors = [];
        const cellRadius = Math.ceil(radius / this.cellSize);
        const col = Math.floor(boid.position.x / this.cellSize);
        const row = Math.floor(boid.position.y / this.cellSize);

        for (let i = -cellRadius; i <= cellRadius; i++) {
            for (let j = -cellRadius; j <= cellRadius; j++) {
                const key = `${col + i},${row + j}`;
                const cell = this.cells.get(key);
                if (cell) {
                    neighbors.push(...cell);
                }
            }
        }

        return neighbors;
    }
}

// ============== Audio Engine (Real Music with Beat Detection) ==============
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.isPlaying = false;
        this.volume = 0.5;
        this.currentTrack = 0;

        // Audio reactivity values (0-1)
        this.kick = 0;
        this.hihat = 0;
        this.bass = 0;
        this.energy = 0;

        // Nodes
        this.audio = null;
        this.source = null;
        this.analyser = null;
        this.gainNode = null;
        this.freqData = null;

        // Beat detection
        this.lastKickValue = 0;
        this.lastBassValue = 0;
        this.kickThreshold = 0.6;
        this.bassThreshold = 0.5;

        // Royalty-free house music tracks (from Pixabay - free for any use)
        this.tracks = [
            {
                name: 'Lofi Vibes',
                url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3'
            },
            {
                name: 'Tech House Energy',
                url: 'https://cdn.pixabay.com/audio/2022/10/18/audio_ce782d5a6d.mp3'
            },
            {
                name: 'Future Bass',
                url: 'https://cdn.pixabay.com/audio/2022/08/04/audio_2dde668d05.mp3'
            },
            {
                name: 'Synthwave Pulse',
                url: 'https://cdn.pixabay.com/audio/2022/04/27/audio_67bcb98a46.mp3'
            }
        ];
    }

    async init() {
        if (this.ctx) return;

        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        // Create gain node for volume control
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = this.volume;
        this.gainNode.connect(this.ctx.destination);

        // Create analyser for frequency detection
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.8;
        this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

        // Create audio element
        this.audio = new Audio();
        this.audio.crossOrigin = 'anonymous';
        this.audio.loop = true;
        this.audio.volume = 1; // Volume controlled by gainNode

        // Connect audio element to Web Audio API
        this.source = this.ctx.createMediaElementSource(this.audio);
        this.source.connect(this.analyser);
        this.analyser.connect(this.gainNode);
    }

    setVolume(vol) {
        this.volume = vol;
        if (this.gainNode) {
            this.gainNode.gain.value = vol;
        }
    }

    setTrack(index) {
        if (index >= 0 && index < this.tracks.length) {
            this.currentTrack = index;
            if (this.isPlaying) {
                this.loadAndPlay();
            }
        }
    }

    nextTrack() {
        this.currentTrack = (this.currentTrack + 1) % this.tracks.length;
        if (this.isPlaying) {
            this.loadAndPlay();
        }
        return this.currentTrack;
    }

    loadAndPlay() {
        const track = this.tracks[this.currentTrack];
        this.audio.src = track.url;
        this.audio.play().catch(e => console.error('Playback failed:', e));
    }

    async start() {
        if (this.isPlaying) return;

        try {
            await this.init();

            // Resume audio context (required after user interaction)
            if (this.ctx.state === 'suspended') {
                await this.ctx.resume();
            }

            this.loadAndPlay();
            this.isPlaying = true;
        } catch (e) {
            console.error('Audio failed to start:', e);
            this.isPlaying = false;
        }
    }

    stop() {
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
        }
        this.isPlaying = false;
        // Reset reactivity immediately
        this.kick = 0;
        this.bass = 0;
        this.hihat = 0;
        this.energy = 0;
    }

    async toggle() {
        if (this.isPlaying) {
            this.stop();
            return false;
        } else {
            await this.start();
            return this.isPlaying;
        }
    }

    // Analyze frequency data to extract beat/bass/energy
    update() {
        if (!this.isPlaying || !this.analyser || !this.freqData) {
            // Decay when not playing
            const decay = 0.85;
            this.kick *= decay;
            this.bass *= decay;
            this.hihat *= decay;
            this.energy = 0;
            return;
        }

        try {
            // Get frequency data
            this.analyser.getByteFrequencyData(this.freqData);
        } catch (e) {
            return;
        }

        // Frequency bands (approximated for 44.1kHz sample rate, 256 FFT)
        // Each bin = ~172Hz, so:
        // Kick/Sub bass: 0-3 bins (0-516Hz)
        // Bass: 3-8 bins (516-1376Hz)
        // Mids: 8-32 bins (1376-5504Hz)
        // Highs: 32+ bins (5504Hz+)

        // Calculate sub bass (kick drum range)
        let subBass = 0;
        for (let i = 0; i < 4; i++) {
            subBass += this.freqData[i];
        }
        subBass = (subBass / 4) / 255;

        // Calculate bass
        let bass = 0;
        for (let i = 4; i < 10; i++) {
            bass += this.freqData[i];
        }
        bass = (bass / 6) / 255;

        // Calculate highs (hi-hats)
        let highs = 0;
        for (let i = 40; i < 80; i++) {
            highs += this.freqData[i];
        }
        highs = (highs / 40) / 255;

        // Calculate overall energy
        let totalEnergy = 0;
        for (let i = 0; i < this.freqData.length; i++) {
            totalEnergy += this.freqData[i];
        }
        totalEnergy = (totalEnergy / this.freqData.length) / 255;

        // Kick detection (transient detection on sub-bass)
        const kickDelta = subBass - this.lastKickValue;
        if (kickDelta > 0.15 && subBass > this.kickThreshold) {
            this.kick = Math.min(1, this.kick + 0.8);
        }
        this.lastKickValue = subBass;

        // Bass detection
        const bassDelta = bass - this.lastBassValue;
        if (bassDelta > 0.1 && bass > this.bassThreshold) {
            this.bass = Math.min(1, this.bass + 0.6);
        }
        this.lastBassValue = bass;

        // Hi-hat from highs
        this.hihat = highs * 1.5;

        // Overall energy
        this.energy = totalEnergy * 1.2;

        // Decay
        const decay = 0.88;
        this.kick *= decay;
        this.bass *= decay;
    }

    getBeatPhase() {
        return this.energy;
    }

    getTrackName() {
        return this.tracks[this.currentTrack].name;
    }
}

// ============== Main Simulation ==============
class BoidsSimulation {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');

        this.boids = [];
        this.paused = false;
        this.bounceMode = false;

        // Parameters
        this.params = {
            separation: 1.5,
            alignment: 1.0,
            cohesion: 1.0,
            neighborRadius: 50,
            maxSpeed: 4,
            maxForce: 0.2,
            boidCount: 100,
            trailLength: 10,
            visionAngle: 270,
            mouseForce: 1.0,
            enableGlow: false  // Disabled for performance
        };

        // Target params for smooth transitions
        this.targetParams = { ...this.params };
        this.transitioning = false;

        // Mouse state
        this.mousePos = null;
        this.isMouseDown = false;
        this.isRightMouseDown = false;

        // FPS tracking
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();
        this.fps = 60;

        // Spatial grid for optimization
        this.grid = null;
        this.useSpatialGrid = true;

        // Audio engine
        this.audio = new AudioEngine();

        // Initialize
        this.resize();
        this.initBoids();
        this.setupEventListeners();
        this.setupUIListeners();
        this.loadFromURL();

        // Start animation
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.grid = new SpatialGrid(this.canvas.width, this.canvas.height, 50);
        this.backgroundStars = null; // Reinitialize on next draw
    }

    initBoids() {
        this.boids = [];
        for (let i = 0; i < this.params.boidCount; i++) {
            const x = Math.random() * this.canvas.width;
            const y = Math.random() * this.canvas.height;
            this.boids.push(new Boid(x, y));
        }
    }

    adjustBoidCount(targetCount) {
        while (this.boids.length < targetCount) {
            const x = Math.random() * this.canvas.width;
            const y = Math.random() * this.canvas.height;
            this.boids.push(new Boid(x, y));
        }
        while (this.boids.length > targetCount) {
            this.boids.pop();
        }
    }

    spawnBoids(x, y, count) {
        for (let i = 0; i < count; i++) {
            const offsetX = (Math.random() - 0.5) * 50;
            const offsetY = (Math.random() - 0.5) * 50;
            this.boids.push(new Boid(x + offsetX, y + offsetY));
        }
        this.updateBoidCountSlider();
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.resize());

        // Keyboard
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePause();
            }
        });

        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.isMouseDown = true;
                if (e.shiftKey) {
                    this.spawnBoids(e.clientX, e.clientY, 10);
                }
            } else if (e.button === 2) {
                this.isRightMouseDown = true;
            }
            this.updateMouseIndicator();
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.isMouseDown = false;
            } else if (e.button === 2) {
                this.isRightMouseDown = false;
            }
            this.updateMouseIndicator();
        });

        this.canvas.addEventListener('mousemove', (e) => {
            this.mousePos = new Vector(e.clientX, e.clientY);
            this.updateMouseIndicator();
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.mousePos = null;
            this.isMouseDown = false;
            this.isRightMouseDown = false;
            this.updateMouseIndicator();
        });

        // Prevent context menu on right click
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    updateMouseIndicator() {
        const indicator = document.getElementById('mouseIndicator');

        if (this.mousePos && (this.isMouseDown || this.isRightMouseDown)) {
            indicator.classList.remove('hidden');
            indicator.style.left = this.mousePos.x + 'px';
            indicator.style.top = this.mousePos.y + 'px';

            if (this.isRightMouseDown) {
                indicator.classList.remove('attract');
                indicator.classList.add('repel');
            } else {
                indicator.classList.remove('repel');
                indicator.classList.add('attract');
            }
        } else {
            indicator.classList.add('hidden');
        }
    }

    setupUIListeners() {
        // Sliders
        const sliders = [
            { id: 'separationSlider', param: 'separation', display: 'separationValue' },
            { id: 'alignmentSlider', param: 'alignment', display: 'alignmentValue' },
            { id: 'cohesionSlider', param: 'cohesion', display: 'cohesionValue' },
            { id: 'neighborRadiusSlider', param: 'neighborRadius', display: 'neighborRadiusValue' },
            { id: 'maxSpeedSlider', param: 'maxSpeed', display: 'maxSpeedValue' },
            { id: 'maxForceSlider', param: 'maxForce', display: 'maxForceValue' },
            { id: 'trailLengthSlider', param: 'trailLength', display: 'trailLengthValue' },
            { id: 'mouseForceSlider', param: 'mouseForce', display: 'mouseForceValue' }
        ];

        sliders.forEach(({ id, param, display }) => {
            const slider = document.getElementById(id);
            const displayEl = document.getElementById(display);

            slider.addEventListener('input', () => {
                const value = parseFloat(slider.value);
                this.params[param] = value;
                this.targetParams[param] = value;
                displayEl.textContent = value.toFixed(param === 'maxForce' ? 2 : 1);
            });
        });

        // Boid count slider
        const boidCountSlider = document.getElementById('boidCountSlider');
        boidCountSlider.addEventListener('input', () => {
            const value = parseInt(boidCountSlider.value);
            this.params.boidCount = value;
            document.getElementById('boidCountValue').textContent = value;
            this.adjustBoidCount(value);
        });

        // Vision angle slider
        const visionSlider = document.getElementById('visionAngleSlider');
        visionSlider.addEventListener('input', () => {
            const value = parseInt(visionSlider.value);
            this.params.visionAngle = value;
            document.getElementById('visionAngleValue').textContent = value + '°';
        });

        // Preset buttons
        document.getElementById('presetRave').addEventListener('click', () => this.applyPreset('rave'));
        document.getElementById('presetChaos').addEventListener('click', () => this.applyPreset('chaos'));
        document.getElementById('presetBass').addEventListener('click', () => this.applyPreset('bass'));

        // Action buttons
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('boundaryBtn').addEventListener('click', () => this.toggleBoundary());

        // Music controls
        document.getElementById('musicBtn').addEventListener('click', () => this.toggleMusic());

        document.getElementById('trackSelect').addEventListener('change', (e) => {
            const index = parseInt(e.target.value);
            this.audio.setTrack(index);
        });

        document.getElementById('nextTrackBtn').addEventListener('click', () => {
            const newIndex = this.audio.nextTrack();
            document.getElementById('trackSelect').value = newIndex;
        });

        document.getElementById('volumeSlider').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.audio.setVolume(value);
            document.getElementById('volumeValue').textContent = Math.round(value * 100) + '%';
        });
    }

    updateBoidCountSlider() {
        const slider = document.getElementById('boidCountSlider');
        const display = document.getElementById('boidCountValue');
        slider.value = this.boids.length;
        display.textContent = this.boids.length;
        this.params.boidCount = this.boids.length;
    }

    applyPreset(preset) {
        const presets = {
            rave: {
                separation: 1.0,
                alignment: 2.5,
                cohesion: 1.5,
                neighborRadius: 60,
                maxSpeed: 4
            },
            chaos: {
                separation: 0.3,
                alignment: 0.2,
                cohesion: 0.5,
                neighborRadius: 30,
                maxSpeed: 6
            },
            bass: {
                separation: 2.0,
                alignment: 1.0,
                cohesion: 3.5,
                neighborRadius: 80,
                maxSpeed: 3
            }
        };

        const config = presets[preset];
        if (!config) return;

        // Set target params for smooth transition
        Object.assign(this.targetParams, config);
        this.transitioning = true;

        // Update active button state
        document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('preset' + preset.charAt(0).toUpperCase() + preset.slice(1)).classList.add('active');

        // Visual feedback - brief flash
        this.flashScreen();
    }

    flashScreen() {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 0, 255, 0.3);
            pointer-events: none;
            z-index: 200;
            animation: flash 0.3s ease-out forwards;
        `;
        document.body.appendChild(overlay);

        setTimeout(() => overlay.remove(), 300);
    }

    togglePause() {
        this.paused = !this.paused;
        const overlay = document.getElementById('pauseOverlay');
        const btn = document.getElementById('pauseBtn');
        const icon = document.getElementById('pauseIcon');

        if (this.paused) {
            overlay.classList.remove('hidden');
            icon.innerHTML = '&#9658;';
            btn.innerHTML = '<span id="pauseIcon">&#9658;</span> Play';
        } else {
            overlay.classList.add('hidden');
            icon.innerHTML = '&#10074;&#10074;';
            btn.innerHTML = '<span id="pauseIcon">&#10074;&#10074;</span> Pause';
        }
    }

    reset() {
        this.initBoids();
    }

    toggleBoundary() {
        this.bounceMode = !this.bounceMode;
        const text = document.getElementById('boundaryText');
        const icon = document.getElementById('boundaryIcon');

        if (this.bounceMode) {
            text.textContent = 'Bounce';
            icon.innerHTML = '&#8596;';
        } else {
            text.textContent = 'Wrap';
            icon.innerHTML = '&#8644;';
        }
    }

    async toggleMusic() {
        const btn = document.getElementById('musicBtn');
        btn.disabled = true;

        const isPlaying = await this.audio.toggle();

        if (isPlaying) {
            btn.innerHTML = '<span id="musicIcon">&#9724;</span> Stop';
            btn.classList.add('playing');
        } else {
            btn.innerHTML = '<span id="musicIcon">&#9835;</span> Play';
            btn.classList.remove('playing');
        }

        btn.disabled = false;
    }

    updateParamsTransition() {
        if (!this.transitioning) return;

        const ease = 0.1;
        let done = true;

        const keys = ['separation', 'alignment', 'cohesion', 'neighborRadius', 'maxSpeed'];
        keys.forEach(key => {
            const diff = this.targetParams[key] - this.params[key];
            if (Math.abs(diff) > 0.01) {
                this.params[key] += diff * ease;
                done = false;
            } else {
                this.params[key] = this.targetParams[key];
            }
        });

        // Update UI
        document.getElementById('separationSlider').value = this.params.separation;
        document.getElementById('separationValue').textContent = this.params.separation.toFixed(1);
        document.getElementById('alignmentSlider').value = this.params.alignment;
        document.getElementById('alignmentValue').textContent = this.params.alignment.toFixed(1);
        document.getElementById('cohesionSlider').value = this.params.cohesion;
        document.getElementById('cohesionValue').textContent = this.params.cohesion.toFixed(1);
        document.getElementById('neighborRadiusSlider').value = this.params.neighborRadius;
        document.getElementById('neighborRadiusValue').textContent = this.params.neighborRadius.toFixed(0);
        document.getElementById('maxSpeedSlider').value = this.params.maxSpeed;
        document.getElementById('maxSpeedValue').textContent = this.params.maxSpeed.toFixed(1);

        if (done) {
            this.transitioning = false;
        }
    }

    updateStats() {
        // FPS
        this.frameCount++;
        const now = performance.now();
        if (now - this.lastFpsUpdate >= 500) {
            this.fps = Math.round(this.frameCount * 1000 / (now - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = now;

            const fpsEl = document.getElementById('fpsValue');
            fpsEl.textContent = this.fps;
            fpsEl.className = 'stat-value';
            if (this.fps >= 50) {
                fpsEl.classList.add('fps-good');
            } else if (this.fps >= 30) {
                fpsEl.classList.add('fps-warn');
            } else {
                fpsEl.classList.add('fps-bad');
            }
        }

        // Boid count
        document.getElementById('boidCount').textContent = this.boids.length;

        // Average speed
        let totalSpeed = 0;
        let totalNeighbors = 0;
        for (const boid of this.boids) {
            totalSpeed += boid.velocity.mag();
            totalNeighbors += boid.neighborCount;
        }
        const avgSpeed = this.boids.length > 0 ? totalSpeed / this.boids.length : 0;
        const avgNeighbors = this.boids.length > 0 ? totalNeighbors / this.boids.length : 0;

        document.getElementById('avgSpeed').textContent = avgSpeed.toFixed(1);
        document.getElementById('avgNeighbors').textContent = avgNeighbors.toFixed(1);
    }

    loadFromURL() {
        const urlParams = new URLSearchParams(window.location.search);

        const paramMap = {
            sep: 'separation',
            align: 'alignment',
            coh: 'cohesion',
            radius: 'neighborRadius',
            speed: 'maxSpeed',
            force: 'maxForce',
            count: 'boidCount',
            trail: 'trailLength',
            vision: 'visionAngle'
        };

        for (const [urlKey, paramKey] of Object.entries(paramMap)) {
            if (urlParams.has(urlKey)) {
                const value = parseFloat(urlParams.get(urlKey));
                if (!isNaN(value)) {
                    this.params[paramKey] = value;
                    this.targetParams[paramKey] = value;
                }
            }
        }

        // Update UI to reflect loaded params
        this.updateUIFromParams();
        this.adjustBoidCount(this.params.boidCount);
    }

    updateUIFromParams() {
        document.getElementById('separationSlider').value = this.params.separation;
        document.getElementById('separationValue').textContent = this.params.separation.toFixed(1);
        document.getElementById('alignmentSlider').value = this.params.alignment;
        document.getElementById('alignmentValue').textContent = this.params.alignment.toFixed(1);
        document.getElementById('cohesionSlider').value = this.params.cohesion;
        document.getElementById('cohesionValue').textContent = this.params.cohesion.toFixed(1);
        document.getElementById('neighborRadiusSlider').value = this.params.neighborRadius;
        document.getElementById('neighborRadiusValue').textContent = this.params.neighborRadius.toFixed(0);
        document.getElementById('maxSpeedSlider').value = this.params.maxSpeed;
        document.getElementById('maxSpeedValue').textContent = this.params.maxSpeed.toFixed(1);
        document.getElementById('maxForceSlider').value = this.params.maxForce;
        document.getElementById('maxForceValue').textContent = this.params.maxForce.toFixed(2);
        document.getElementById('boidCountSlider').value = this.params.boidCount;
        document.getElementById('boidCountValue').textContent = this.params.boidCount;
        document.getElementById('trailLengthSlider').value = this.params.trailLength;
        document.getElementById('trailLengthValue').textContent = this.params.trailLength;
        document.getElementById('visionAngleSlider').value = this.params.visionAngle;
        document.getElementById('visionAngleValue').textContent = this.params.visionAngle + '°';
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Update audio reactivity (with error protection)
        try {
            this.audio.update();
            this.params.audioKick = this.audio.kick || 0;
            this.params.audioBass = this.audio.bass || 0;
            this.params.audioEnergy = this.audio.energy || 0;
            this.params.beatPhase = this.audio.getBeatPhase() || 0;
        } catch (e) {
            this.params.audioKick = 0;
            this.params.audioBass = 0;
            this.params.audioEnergy = 0;
            this.params.beatPhase = 0;
        }

        if (!this.paused) {
            this.update();
        }

        this.draw();
        this.updateStats();
        this.updateParamsTransition();
    }

    update() {
        // Build spatial grid
        if (this.useSpatialGrid) {
            this.grid.clear();
            for (const boid of this.boids) {
                this.grid.insert(boid);
            }
        }

        // Update each boid
        for (const boid of this.boids) {
            const neighbors = this.useSpatialGrid
                ? this.grid.getNeighbors(boid, this.params.neighborRadius)
                : this.boids;

            boid.flock(neighbors, this.params);
            boid.applyMouseForce(
                this.mousePos,
                this.isMouseDown && !this.isRightMouseDown,
                this.isRightMouseDown,
                this.params.mouseForce
            );
        }

        for (const boid of this.boids) {
            boid.update(this.params);
            boid.edges(this.canvas.width, this.canvas.height, this.bounceMode);
        }
    }

    draw() {
        // Deep ocean background with motion blur effect
        this.ctx.fillStyle = 'rgba(0, 10, 30, 0.12)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw background stars (static, subtle)
        if (!this.backgroundStars) {
            this.initBackgroundStars();
        }
        this.drawBackgroundStars();

        // Draw all boids
        for (const boid of this.boids) {
            boid.draw(this.ctx, this.params);
        }
    }

    initBackgroundStars() {
        // Create offscreen canvas for static stars (major performance boost)
        this.starCanvas = document.createElement('canvas');
        this.starCanvas.width = this.canvas.width;
        this.starCanvas.height = this.canvas.height;
        const starCtx = this.starCanvas.getContext('2d');

        const starCount = Math.floor((this.canvas.width * this.canvas.height) / 20000);
        starCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';

        for (let i = 0; i < starCount; i++) {
            const x = Math.random() * this.canvas.width;
            const y = Math.random() * this.canvas.height;
            const size = Math.random() * 1.5 + 0.5;
            starCtx.beginPath();
            starCtx.arc(x, y, size, 0, Math.PI * 2);
            starCtx.fill();
        }

        this.backgroundStars = true;  // Flag that stars are ready
    }

    drawBackgroundStars() {
        // Simply blit the pre-rendered star canvas
        this.ctx.globalAlpha = 0.5;
        this.ctx.drawImage(this.starCanvas, 0, 0);
        this.ctx.globalAlpha = 1;
    }
}

// Panel toggle function
function togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    panel.classList.toggle('collapsed');
}

// Add flash animation style
const style = document.createElement('style');
style.textContent = `
    @keyframes flash {
        0% { opacity: 1; }
        100% { opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize simulation when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new BoidsSimulation();
});
