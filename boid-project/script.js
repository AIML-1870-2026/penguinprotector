// Jellyfish Bloom - Main Script (v2)

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

// ============== Species Color Palettes ==============
const SPECIES_PALETTES = [
    // Species 0: Cyan/Blue (Ocean)
    ['#00ffff', '#00e5ff', '#00bcd4', '#26c6da', '#4dd0e1', '#80deea'],
    // Species 1: Magenta/Pink (Nebula)
    ['#ff00ff', '#e040fb', '#ea80fc', '#ff4081', '#f50057', '#ff80ab'],
    // Species 2: Green/Lime (Forest)
    ['#00ff88', '#00e676', '#69f0ae', '#76ff03', '#b2ff59', '#ccff90'],
    // Species 3: Orange/Gold (Solar)
    ['#ffab00', '#ffc400', '#ffd740', '#ff9100', '#ff6d00', '#ffea00'],
    // Species 4: Purple/Violet (Cosmic)
    ['#7c4dff', '#651fff', '#b388ff', '#d500f9', '#aa00ff', '#e040fb']
];

// ============== Boid Class ==============
let boidIdCounter = 0;

class Boid {
    constructor(x, y, species = 0) {
        this.id = boidIdCounter++;
        this.position = new Vector(x, y);
        this.velocity = Vector.random().mult(Math.random() * 2 + 2);
        this.acceleration = new Vector(0, 0);

        // Smoothed velocity for rendering (reduces jitter)
        this.smoothedVelocity = this.velocity.copy();

        // Previous acceleration for smoothing
        this.prevAcceleration = new Vector(0, 0);

        // Species assignment
        this.species = species;

        // Color based on species palette
        const palette = SPECIES_PALETTES[species % SPECIES_PALETTES.length];
        this.color = palette[Math.floor(Math.random() * palette.length)];

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

        // Species interaction settings
        const speciesCount = params.speciesCount || 1;
        const sameSpeciesOnly = speciesCount > 1 && params.speciesInteraction === 'separate';
        const mixedFlocking = speciesCount > 1 && params.speciesInteraction === 'mixed';

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
            const sameSpecies = other.species === this.species;

            // Separation (closer range) - applies to ALL boids regardless of species
            // But stronger separation from different species when in 'separate' mode
            if (dSq < separationRadiusSq && d > 0) {
                const diff = new Vector(dx, dy);
                // Smooth quadratic falloff instead of harsh 1/d
                let strength = 1 - (d / separationRadius);

                // Stronger separation from other species
                if (!sameSpecies && sameSpeciesOnly) {
                    strength *= 1.5;
                }

                diff.normalize().mult(strength * strength);
                separation.add(diff);
                separationCount++;
            }

            // Alignment and Cohesion (neighbor radius)
            // In 'separate' mode, only flock with same species
            // In 'mixed' mode, slight preference for same species
            if (d < params.neighborRadius) {
                let speciesWeight = 1.0;

                if (sameSpeciesOnly && !sameSpecies) {
                    continue; // Skip alignment/cohesion with other species
                } else if (mixedFlocking && !sameSpecies) {
                    speciesWeight = 0.3; // Reduced influence from other species
                }

                // Weight by distance - closer neighbors have more influence
                const weight = (1 - (d / params.neighborRadius)) * speciesWeight;
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

    avoidObstacles(obstacles, obstacleRadius) {
        if (!obstacles || obstacles.length === 0) return;

        const avoidForce = new Vector();
        const lookAhead = 40; // How far ahead to look

        for (const obs of obstacles) {
            const dx = this.position.x - obs.x;
            const dy = this.position.y - obs.y;
            const d = Math.sqrt(dx * dx + dy * dy);

            const avoidRadius = obstacleRadius + lookAhead;

            if (d < avoidRadius && d > 0) {
                // Calculate avoidance force - stronger when closer
                const strength = Math.pow(1 - d / avoidRadius, 2) * 2;
                avoidForce.x += (dx / d) * strength;
                avoidForce.y += (dy / d) * strength;
            }
        }

        if (avoidForce.mag() > 0) {
            avoidForce.normalize().mult(0.8); // Strong avoidance
            this.applyForce(avoidForce);
        }
    }

    followFlowField(flowField, strength) {
        if (!flowField) return;

        const force = flowField.getForce(this.position.x, this.position.y);
        force.mult(strength);
        this.applyForce(force);
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

        // Draw vision cone if enabled
        if (params.showCones && params.visionAngle < 360) {
            this.drawVisionCone(ctx, params.neighborRadius, params.visionAngle);
        }

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

    drawVisionCone(ctx, radius, angleInDegrees) {
        const halfAngle = (angleInDegrees * Math.PI / 180) / 2;

        // Draw the cone arc
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, -halfAngle, halfAngle);
        ctx.closePath();

        // Fill with semi-transparent color
        ctx.fillStyle = 'rgba(0, 255, 255, 0.08)';
        ctx.fill();

        // Draw the edges
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
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

// ============== Perlin Noise ==============
class PerlinNoise {
    constructor() {
        this.permutation = [];
        for (let i = 0; i < 256; i++) {
            this.permutation[i] = Math.floor(Math.random() * 256);
        }
        // Duplicate for overflow
        this.p = [...this.permutation, ...this.permutation];
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(a, b, t) {
        return a + t * (b - a);
    }

    grad(hash, x, y) {
        const h = hash & 3;
        const u = h < 2 ? x : y;
        const v = h < 2 ? y : x;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);

        const u = this.fade(x);
        const v = this.fade(y);

        const A = this.p[X] + Y;
        const B = this.p[X + 1] + Y;

        return this.lerp(
            this.lerp(this.grad(this.p[A], x, y), this.grad(this.p[B], x - 1, y), u),
            this.lerp(this.grad(this.p[A + 1], x, y - 1), this.grad(this.p[B + 1], x - 1, y - 1), u),
            v
        );
    }
}

// ============== Flow Field ==============
class FlowField {
    constructor(width, height, resolution = 20) {
        this.resolution = resolution;
        this.cols = Math.ceil(width / resolution);
        this.rows = Math.ceil(height / resolution);
        this.field = [];
        this.noise = new PerlinNoise();
        this.noiseScale = 0.03;
        this.timeOffset = 0;

        this.initField();
    }

    initField() {
        this.field = [];
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const angle = this.noise.noise(x * this.noiseScale, y * this.noiseScale) * Math.PI * 4;
                this.field.push(new Vector(Math.cos(angle), Math.sin(angle)));
            }
        }
    }

    update(speed = 0.005) {
        this.timeOffset += speed;
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const angle = this.noise.noise(
                    x * this.noiseScale + this.timeOffset,
                    y * this.noiseScale + this.timeOffset
                ) * Math.PI * 4;
                const idx = y * this.cols + x;
                this.field[idx].x = Math.cos(angle);
                this.field[idx].y = Math.sin(angle);
            }
        }
    }

    resize(width, height) {
        this.cols = Math.ceil(width / this.resolution);
        this.rows = Math.ceil(height / this.resolution);
        this.initField();
    }

    getForce(x, y) {
        const col = Math.floor(x / this.resolution);
        const row = Math.floor(y / this.resolution);

        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
            return new Vector(0, 0);
        }

        const idx = row * this.cols + col;
        return this.field[idx].copy();
    }

    draw(ctx, alpha = 0.3) {
        ctx.save();
        ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
        ctx.lineWidth = 1;

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const idx = y * this.cols + x;
                const vec = this.field[idx];

                const px = x * this.resolution + this.resolution / 2;
                const py = y * this.resolution + this.resolution / 2;
                const len = this.resolution * 0.4;

                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(px + vec.x * len, py + vec.y * len);
                ctx.stroke();

                // Arrow head
                const headLen = 3;
                const angle = Math.atan2(vec.y, vec.x);
                ctx.beginPath();
                ctx.moveTo(px + vec.x * len, py + vec.y * len);
                ctx.lineTo(
                    px + vec.x * len - headLen * Math.cos(angle - Math.PI / 6),
                    py + vec.y * len - headLen * Math.sin(angle - Math.PI / 6)
                );
                ctx.moveTo(px + vec.x * len, py + vec.y * len);
                ctx.lineTo(
                    px + vec.x * len - headLen * Math.cos(angle + Math.PI / 6),
                    py + vec.y * len - headLen * Math.sin(angle + Math.PI / 6)
                );
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}

// ============== Audio Engine (Procedural House Music) ==============
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.isPlaying = false;
        this.bpm = 128;
        this.volume = 0.5;
        this.style = 0; // 0=house, 1=techno, 2=trance, 3=ambient

        // Audio reactivity values (0-1)
        this.kick = 0;
        this.hihat = 0;
        this.bass = 0;
        this.energy = 0;

        // Scheduling
        this.nextBeatTime = 0;
        this.beatCount = 0;
        this.schedulerId = null;

        // Nodes
        this.masterGain = null;
    }

    async init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.ctx.destination);
    }

    setVolume(vol) {
        this.volume = vol;
        if (this.masterGain) {
            this.masterGain.gain.value = vol;
        }
    }

    setStyle(index) {
        this.style = index;
        // Adjust BPM based on style
        const bpms = [128, 138, 140, 100];
        this.bpm = bpms[index] || 128;
    }

    playKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(40, time + 0.08);

        gain.gain.setValueAtTime(0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.25);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.25);

        // Schedule reactivity
        const delay = (time - this.ctx.currentTime) * 1000;
        setTimeout(() => { this.kick = 1; }, Math.max(0, delay));
    }

    playHihat(time, open = false) {
        const bufferSize = this.ctx.sampleRate * (open ? 0.15 : 0.05);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, open ? 2 : 4);
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 8000;

        const gain = this.ctx.createGain();
        gain.gain.value = open ? 0.15 : 0.1;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        source.start(time);

        const delay = (time - this.ctx.currentTime) * 1000;
        setTimeout(() => { this.hihat = open ? 0.6 : 0.3; }, Math.max(0, delay));
    }

    playBass(time, note, duration = 0.2) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        const freq = 55 * Math.pow(2, note / 12);
        osc.type = 'sawtooth';
        osc.frequency.value = freq;

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, time);
        filter.frequency.exponentialRampToValueAtTime(200, time + duration);
        filter.Q.value = 8;

        gain.gain.setValueAtTime(0.35, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + duration + 0.05);

        const delay = (time - this.ctx.currentTime) * 1000;
        setTimeout(() => { this.bass = 1; }, Math.max(0, delay));
    }

    playChord(time, notes, duration = 0.4) {
        notes.forEach(note => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = 'square';
            osc.frequency.value = 220 * Math.pow(2, note / 12);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1500, time);
            filter.frequency.exponentialRampToValueAtTime(400, time + duration);

            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.06, time + 0.01);
            gain.gain.linearRampToValueAtTime(0.03, time + duration * 0.7);
            gain.gain.linearRampToValueAtTime(0, time + duration);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            osc.start(time);
            osc.stop(time + duration + 0.05);
        });
    }

    scheduleBeats() {
        if (!this.isPlaying) return;

        const beatDuration = 60 / this.bpm;
        const lookAhead = 0.1;
        const scheduleAhead = 0.2;

        while (this.nextBeatTime < this.ctx.currentTime + scheduleAhead) {
            const time = this.nextBeatTime;
            const beat = this.beatCount % 16;
            const bar = Math.floor(this.beatCount / 4) % 4;

            // Four-on-the-floor kick
            this.playKick(time);

            // Hi-hats pattern varies by style
            if (this.style === 1) { // Techno - more hi-hats
                this.playHihat(time + beatDuration * 0.25);
                this.playHihat(time + beatDuration * 0.5, beat % 4 === 2);
                this.playHihat(time + beatDuration * 0.75);
            } else if (this.style === 2) { // Trance - offbeat
                this.playHihat(time + beatDuration * 0.5, true);
            } else if (this.style === 3) { // Ambient - minimal
                if (beat % 2 === 1) this.playHihat(time + beatDuration * 0.5);
            } else { // House - classic offbeat
                this.playHihat(time + beatDuration * 0.5, beat % 8 === 4);
            }

            // Bass line - different progressions per style
            const bassPatterns = [
                [0, 0, 5, 7],  // House - Am progression
                [0, 0, 0, 3],  // Techno - minimal
                [0, 3, 5, 7],  // Trance - melodic
                [0, 0, 0, 0]   // Ambient - drone
            ];
            const bassNote = bassPatterns[this.style][bar];
            if (beat % 2 === 0) {
                this.playBass(time, bassNote, this.style === 3 ? 0.5 : 0.2);
            }

            // Chords on some beats
            if (bar === 1 || bar === 3) {
                if (beat === 0) {
                    const chords = [
                        [0, 3, 7],    // Am
                        [0, 4, 7],    // A (techno)
                        [0, 3, 7, 10],// Am7 (trance)
                        [0, 7, 12]    // Power (ambient)
                    ];
                    this.playChord(time, chords[this.style], beatDuration * 2);
                }
            }

            this.nextBeatTime += beatDuration;
            this.beatCount++;
        }

        this.schedulerId = setTimeout(() => this.scheduleBeats(), lookAhead * 1000);
    }

    async start() {
        if (this.isPlaying) return;

        await this.init();
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        this.isPlaying = true;
        this.nextBeatTime = this.ctx.currentTime + 0.05;
        this.beatCount = 0;
        this.scheduleBeats();
    }

    stop() {
        this.isPlaying = false;
        if (this.schedulerId) {
            clearTimeout(this.schedulerId);
            this.schedulerId = null;
        }
        // Immediately reset reactivity
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
            return true;
        }
    }

    update() {
        // Decay reactivity values
        const decay = 0.88;
        this.kick *= decay;
        this.bass *= decay;
        this.hihat *= decay;
        this.energy = this.kick * 0.5 + this.bass * 0.3 + this.hihat * 0.2;
    }

    getBeatPhase() {
        if (!this.ctx || !this.isPlaying) return 0;
        const beatDuration = 60 / this.bpm;
        return (this.ctx.currentTime % beatDuration) / beatDuration;
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
            enableGlow: false,  // Disabled for performance
            showCones: false,   // Vision cone visualization
            // Species settings
            speciesCount: 1,
            speciesInteraction: 'separate', // 'separate', 'mixed', or 'unified'
            // Constellation mode
            constellationMode: false,
            constellationRadius: 60,
            constellationOpacity: 0.4,
            constellationSameSpecies: true  // Only connect same species
        };

        // Target params for smooth transitions
        this.targetParams = { ...this.params };
        this.transitioning = false;

        // Mouse state
        this.mousePos = null;
        this.isMouseDown = false;
        this.isRightMouseDown = false;
        this.isPainting = false;

        // Obstacles (painted by user)
        this.obstacles = [];
        this.obstacleRadius = 15;

        // FPS tracking
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();
        this.fps = 60;

        // Spatial grid for optimization
        this.grid = null;
        this.useSpatialGrid = true;
        this.neighborChecks = 0;

        // Flow field
        this.flowField = null;
        this.params.flowFieldEnabled = false;
        this.params.flowFieldStrength = 0.3;
        this.params.showFlowField = false;

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

        // Initialize or resize flow field
        if (!this.flowField) {
            this.flowField = new FlowField(this.canvas.width, this.canvas.height, 30);
        } else {
            this.flowField.resize(this.canvas.width, this.canvas.height);
        }

        this.backgroundStars = null; // Reinitialize on next draw
    }

    initBoids() {
        this.boids = [];
        for (let i = 0; i < this.params.boidCount; i++) {
            const x = Math.random() * this.canvas.width;
            const y = Math.random() * this.canvas.height;
            const species = i % this.params.speciesCount;
            this.boids.push(new Boid(x, y, species));
        }
    }

    adjustBoidCount(targetCount) {
        while (this.boids.length < targetCount) {
            const x = Math.random() * this.canvas.width;
            const y = Math.random() * this.canvas.height;
            const species = this.boids.length % this.params.speciesCount;
            this.boids.push(new Boid(x, y, species));
        }
        while (this.boids.length > targetCount) {
            this.boids.pop();
        }
    }

    reassignSpecies() {
        // Reassign species to all boids when species count changes
        for (let i = 0; i < this.boids.length; i++) {
            const newSpecies = i % this.params.speciesCount;
            if (this.boids[i].species !== newSpecies) {
                this.boids[i].species = newSpecies;
                // Update color based on new species
                const palette = SPECIES_PALETTES[newSpecies % SPECIES_PALETTES.length];
                this.boids[i].color = palette[Math.floor(Math.random() * palette.length)];
            }
        }
    }

    spawnBoids(x, y, count) {
        for (let i = 0; i < count; i++) {
            const offsetX = (Math.random() - 0.5) * 50;
            const offsetY = (Math.random() - 0.5) * 50;
            const species = Math.floor(Math.random() * this.params.speciesCount);
            this.boids.push(new Boid(x + offsetX, y + offsetY, species));
        }
        this.updateBoidCountSlider();
    }

    paintObstacle(x, y) {
        // Don't place obstacles too close together
        const minDist = this.obstacleRadius * 1.2;
        for (const obs of this.obstacles) {
            const dx = x - obs.x;
            const dy = y - obs.y;
            if (dx * dx + dy * dy < minDist * minDist) {
                return; // Too close to existing obstacle
            }
        }
        this.obstacles.push({ x, y });
        this.updateObstacleCount();
    }

    clearObstacles() {
        this.obstacles = [];
        this.updateObstacleCount();
    }

    updateObstacleCount() {
        const el = document.getElementById('obstacleCount');
        if (el) el.textContent = this.obstacles.length;
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.resize());

        // Keyboard
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePause();
            }
            if (e.code === 'KeyF') {
                e.preventDefault();
                this.toggleFullscreen();
            }
        });

        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.isMouseDown = true;
                if (e.shiftKey) {
                    this.spawnBoids(e.clientX, e.clientY, 10);
                } else if (e.ctrlKey || e.metaKey) {
                    this.isPainting = true;
                    this.paintObstacle(e.clientX, e.clientY);
                }
            } else if (e.button === 2) {
                this.isRightMouseDown = true;
            }
            this.updateMouseIndicator();
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.isMouseDown = false;
                this.isPainting = false;
            } else if (e.button === 2) {
                this.isRightMouseDown = false;
            }
            this.updateMouseIndicator();
        });

        this.canvas.addEventListener('mousemove', (e) => {
            this.mousePos = new Vector(e.clientX, e.clientY);
            if (this.isPainting && (e.ctrlKey || e.metaKey)) {
                this.paintObstacle(e.clientX, e.clientY);
            }
            this.updateMouseIndicator();
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.mousePos = null;
            this.isMouseDown = false;
            this.isRightMouseDown = false;
            this.isPainting = false;
            this.updateMouseIndicator();
        });

        // Prevent context menu on right click
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Handle fullscreen change (e.g., user presses Escape)
        document.addEventListener('fullscreenchange', () => {
            const btn = document.getElementById('fullscreenBtn');
            if (btn) {
                if (document.fullscreenElement) {
                    btn.innerHTML = '<span id="fullscreenIcon">&#x2716;</span> Exit';
                } else {
                    btn.innerHTML = '<span id="fullscreenIcon">&#x26F6;</span> Fullscreen';
                }
            }
        });
    }

    updateMouseIndicator() {
        const indicator = document.getElementById('mouseIndicator');

        if (this.mousePos && (this.isMouseDown || this.isRightMouseDown)) {
            indicator.classList.remove('hidden');
            indicator.style.left = this.mousePos.x + 'px';
            indicator.style.top = this.mousePos.y + 'px';

            indicator.classList.remove('attract', 'repel', 'paint');

            if (this.isPainting) {
                indicator.classList.add('paint');
            } else if (this.isRightMouseDown) {
                indicator.classList.add('repel');
            } else {
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
            this.updateVisionPresetButtons(value);
        });

        // Vision preset buttons
        const setVisionAngle = (angle) => {
            this.params.visionAngle = angle;
            visionSlider.value = angle;
            document.getElementById('visionAngleValue').textContent = angle + '°';
            this.updateVisionPresetButtons(angle);
        };

        const v360 = document.getElementById('vision360');
        const v180 = document.getElementById('vision180');
        const v90 = document.getElementById('vision90');
        if (v360) v360.addEventListener('click', () => setVisionAngle(360));
        if (v180) v180.addEventListener('click', () => setVisionAngle(180));
        if (v90) v90.addEventListener('click', () => setVisionAngle(90));

        // Show cones checkbox
        const showConesCheckbox = document.getElementById('showCones');
        if (showConesCheckbox) {
            showConesCheckbox.addEventListener('change', (e) => {
                this.params.showCones = e.target.checked;
            });
        }

        // Spatial grid toggle
        const spatialGridCheckbox = document.getElementById('spatialGrid');
        if (spatialGridCheckbox) {
            spatialGridCheckbox.addEventListener('change', (e) => {
                this.useSpatialGrid = e.target.checked;
            });
        }

        // Species count slider
        const speciesCountSlider = document.getElementById('speciesCountSlider');
        if (speciesCountSlider) {
            speciesCountSlider.addEventListener('input', () => {
                const value = parseInt(speciesCountSlider.value);
                this.params.speciesCount = value;
                document.getElementById('speciesCountValue').textContent = value;
                this.reassignSpecies();
                this.updateSpeciesPreview();
            });
        }

        // Species interaction mode
        const speciesInteraction = document.getElementById('speciesInteraction');
        if (speciesInteraction) {
            speciesInteraction.addEventListener('change', (e) => {
                this.params.speciesInteraction = e.target.value;
            });
        }

        // Constellation mode controls
        const constellationMode = document.getElementById('constellationMode');
        if (constellationMode) {
            constellationMode.addEventListener('change', (e) => {
                this.params.constellationMode = e.target.checked;
            });
        }

        const constellationRadius = document.getElementById('constellationRadius');
        if (constellationRadius) {
            constellationRadius.addEventListener('input', () => {
                const value = parseInt(constellationRadius.value);
                this.params.constellationRadius = value;
                document.getElementById('constellationRadiusValue').textContent = value;
            });
        }

        const constellationOpacity = document.getElementById('constellationOpacity');
        if (constellationOpacity) {
            constellationOpacity.addEventListener('input', () => {
                const value = parseFloat(constellationOpacity.value);
                this.params.constellationOpacity = value;
                document.getElementById('constellationOpacityValue').textContent = value.toFixed(1);
            });
        }

        const constellationSameSpecies = document.getElementById('constellationSameSpecies');
        if (constellationSameSpecies) {
            constellationSameSpecies.addEventListener('change', (e) => {
                this.params.constellationSameSpecies = e.target.checked;
            });
        }

        // Preset buttons
        document.getElementById('presetRave').addEventListener('click', () => this.applyPreset('rave'));
        document.getElementById('presetChaos').addEventListener('click', () => this.applyPreset('chaos'));
        document.getElementById('presetBass').addEventListener('click', () => this.applyPreset('bass'));

        // Action buttons
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('boundaryBtn').addEventListener('click', () => this.toggleBoundary());

        // Clear obstacles button
        const clearObstaclesBtn = document.getElementById('clearObstaclesBtn');
        if (clearObstaclesBtn) {
            clearObstaclesBtn.addEventListener('click', () => this.clearObstacles());
        }

        // Fullscreen button
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        }

        // Flow field controls
        const flowFieldCheckbox = document.getElementById('flowFieldEnabled');
        if (flowFieldCheckbox) {
            flowFieldCheckbox.addEventListener('change', (e) => {
                this.params.flowFieldEnabled = e.target.checked;
            });
        }

        const flowFieldStrength = document.getElementById('flowFieldStrength');
        if (flowFieldStrength) {
            flowFieldStrength.addEventListener('input', () => {
                const value = parseFloat(flowFieldStrength.value);
                this.params.flowFieldStrength = value;
                document.getElementById('flowFieldStrengthValue').textContent = value.toFixed(1);
            });
        }

        const showFlowField = document.getElementById('showFlowField');
        if (showFlowField) {
            showFlowField.addEventListener('change', (e) => {
                this.params.showFlowField = e.target.checked;
            });
        }

        // Music controls
        const musicBtn = document.getElementById('musicBtn');
        if (musicBtn) musicBtn.addEventListener('click', () => this.toggleMusic());

        const styleSelect = document.getElementById('styleSelect');
        if (styleSelect) {
            styleSelect.addEventListener('change', (e) => {
                const index = parseInt(e.target.value);
                this.audio.setStyle(index);
            });
        }

        const volumeSlider = document.getElementById('volumeSlider');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.audio.setVolume(value);
                const volumeValue = document.getElementById('volumeValue');
                if (volumeValue) volumeValue.textContent = Math.round(value * 100) + '%';
            });
        }
    }

    updateBoidCountSlider() {
        const slider = document.getElementById('boidCountSlider');
        const display = document.getElementById('boidCountValue');
        slider.value = this.boids.length;
        display.textContent = this.boids.length;
        this.params.boidCount = this.boids.length;
    }

    updateSpeciesPreview() {
        const preview = document.getElementById('speciesPreview');
        if (!preview) return;

        preview.innerHTML = '';
        for (let i = 0; i < this.params.speciesCount; i++) {
            const dot = document.createElement('span');
            dot.className = 'species-dot';
            // Use first color from each species palette
            dot.style.background = SPECIES_PALETTES[i % SPECIES_PALETTES.length][0];
            preview.appendChild(dot);
        }
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

    updateVisionPresetButtons(angle) {
        const btns = ['vision360', 'vision180', 'vision90'];
        const angles = [360, 180, 90];
        btns.forEach((id, i) => {
            const btn = document.getElementById(id);
            if (btn) {
                if (angles[i] === angle) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });
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

    toggleFullscreen() {
        const btn = document.getElementById('fullscreenBtn');

        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                if (btn) btn.innerHTML = '<span id="fullscreenIcon">&#x2716;</span> Exit';
            }).catch(err => {
                console.log('Fullscreen error:', err);
            });
        } else {
            document.exitFullscreen().then(() => {
                if (btn) btn.innerHTML = '<span id="fullscreenIcon">&#x26F6;</span> Fullscreen';
            });
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

        // Performance stats
        const n = this.boids.length;
        const theoreticalMax = n * (n - 1); // O(n²) brute force
        const algorithmEl = document.getElementById('algorithmMode');
        const checksEl = document.getElementById('neighborChecks');
        const maxEl = document.getElementById('theoreticalMax');

        if (algorithmEl) {
            algorithmEl.textContent = this.useSpatialGrid ? 'Grid O(n)' : 'Brute O(n²)';
            algorithmEl.className = 'perf-value ' + (this.useSpatialGrid ? 'optimized' : 'brute-force');
        }
        if (checksEl) {
            checksEl.textContent = this.neighborChecks.toLocaleString();
        }
        if (maxEl) {
            maxEl.textContent = theoreticalMax.toLocaleString();
        }
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

        // Reset neighbor checks counter
        this.neighborChecks = 0;

        // Update each boid
        for (const boid of this.boids) {
            const neighbors = this.useSpatialGrid
                ? this.grid.getNeighbors(boid, this.params.neighborRadius)
                : this.boids;

            // Count neighbor checks (excluding self)
            this.neighborChecks += neighbors.length - 1;

            boid.flock(neighbors, this.params);
            boid.applyMouseForce(
                this.mousePos,
                this.isMouseDown && !this.isRightMouseDown && !this.isPainting,
                this.isRightMouseDown,
                this.params.mouseForce
            );
            boid.avoidObstacles(this.obstacles, this.obstacleRadius);

            // Apply flow field force
            if (this.params.flowFieldEnabled && this.flowField) {
                boid.followFlowField(this.flowField, this.params.flowFieldStrength);
            }
        }

        // Update flow field animation
        if (this.params.flowFieldEnabled && this.flowField) {
            this.flowField.update(0.003);
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

        // Draw flow field if enabled
        if (this.params.showFlowField && this.flowField) {
            this.flowField.draw(this.ctx, 0.15);
        }

        // Draw obstacles
        this.drawObstacles();

        // Draw constellation connections (behind boids)
        this.drawConstellations();

        // Draw all boids
        for (const boid of this.boids) {
            boid.draw(this.ctx, this.params);
        }
    }

    drawObstacles() {
        if (this.obstacles.length === 0) return;

        this.ctx.save();
        for (const obs of this.obstacles) {
            // Outer glow
            const gradient = this.ctx.createRadialGradient(
                obs.x, obs.y, 0,
                obs.x, obs.y, this.obstacleRadius * 2
            );
            gradient.addColorStop(0, 'rgba(255, 0, 102, 0.6)');
            gradient.addColorStop(0.5, 'rgba(255, 0, 102, 0.2)');
            gradient.addColorStop(1, 'rgba(255, 0, 102, 0)');

            this.ctx.beginPath();
            this.ctx.arc(obs.x, obs.y, this.obstacleRadius * 2, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.fill();

            // Core
            this.ctx.beginPath();
            this.ctx.arc(obs.x, obs.y, this.obstacleRadius, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 0, 102, 0.8)';
            this.ctx.fill();

            // Inner highlight
            this.ctx.beginPath();
            this.ctx.arc(obs.x, obs.y, this.obstacleRadius * 0.4, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 150, 180, 0.6)';
            this.ctx.fill();
        }
        this.ctx.restore();
    }

    drawConstellations() {
        if (!this.params.constellationMode) return;

        const radius = this.params.constellationRadius;
        const radiusSq = radius * radius;
        const opacity = this.params.constellationOpacity;
        const sameSpeciesOnly = this.params.constellationSameSpecies;

        this.ctx.save();
        this.ctx.lineWidth = 1;
        this.ctx.lineCap = 'round';

        // Use spatial grid if available for performance
        const connections = new Set(); // Track drawn connections to avoid duplicates

        for (let i = 0; i < this.boids.length; i++) {
            const boid = this.boids[i];

            // Get potential neighbors
            const neighbors = this.useSpatialGrid
                ? this.grid.getNeighbors(boid, radius)
                : this.boids;

            for (const other of neighbors) {
                if (other === boid) continue;

                // Check species constraint
                if (sameSpeciesOnly && other.species !== boid.species) continue;

                // Calculate distance
                const dx = boid.position.x - other.position.x;
                const dy = boid.position.y - other.position.y;
                const dSq = dx * dx + dy * dy;

                if (dSq > radiusSq) continue;

                // Create unique connection ID to avoid drawing same line twice
                const id1 = boid.id;
                const id2 = other.id;
                const connId = id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;

                if (connections.has(connId)) continue;
                connections.add(connId);

                // Calculate opacity based on distance (closer = more opaque)
                const d = Math.sqrt(dSq);
                const distFactor = 1 - (d / radius);
                const lineOpacity = opacity * distFactor * distFactor;

                // Use gradient between the two boid colors
                const gradient = this.ctx.createLinearGradient(
                    boid.position.x, boid.position.y,
                    other.position.x, other.position.y
                );

                // Parse colors and apply opacity
                const color1 = this.hexToRgba(boid.color, lineOpacity);
                const color2 = this.hexToRgba(other.color, lineOpacity);

                gradient.addColorStop(0, color1);
                gradient.addColorStop(1, color2);

                this.ctx.beginPath();
                this.ctx.moveTo(boid.position.x, boid.position.y);
                this.ctx.lineTo(other.position.x, other.position.y);
                this.ctx.strokeStyle = gradient;
                this.ctx.stroke();
            }
        }

        this.ctx.restore();
    }

    hexToRgba(hex, alpha) {
        // Convert hex color to rgba
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            const r = parseInt(result[1], 16);
            const g = parseInt(result[2], 16);
            const b = parseInt(result[3], 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return `rgba(255, 255, 255, ${alpha})`;
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

// Setup collapsible group headers
function setupCollapsibleGroups() {
    const headers = document.querySelectorAll('.control-group.collapsible .group-header');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const group = header.parentElement;
            group.classList.toggle('collapsed');
        });
    });
}

// Initialize collapsible groups when DOM is ready
document.addEventListener('DOMContentLoaded', setupCollapsibleGroups);

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
