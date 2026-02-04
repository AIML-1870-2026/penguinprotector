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

        // Assign random neon color
        const colors = ['#00ffff', '#ff00ff', '#00ff00', '#9d00ff', '#ff0066', '#ffff00'];
        this.color = colors[Math.floor(Math.random() * colors.length)];

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

        for (const other of boids) {
            if (other === this) continue;

            const d = this.position.dist(other.position);

            // Check if within vision cone
            if (!this.isInVisionCone(other, params.visionAngle)) continue;

            // Separation (closer range)
            if (d < separationRadius && d > 0) {
                const diff = Vector.sub(this.position, other.position);
                diff.normalize().div(d); // Weight by distance
                separation.add(diff);
                separationCount++;
            }

            // Alignment and Cohesion (neighbor radius)
            if (d < params.neighborRadius) {
                alignment.add(other.velocity);
                cohesion.add(other.position);
                alignmentCount++;
                cohesionCount++;
            }
        }

        this.neighborCount = alignmentCount;

        // Separation
        if (separationCount > 0) {
            separation.div(separationCount);
            separation.setMag(params.maxSpeed);
            separation.sub(this.velocity);
            separation.limit(params.maxForce);
            separation.mult(params.separation);
        }

        // Alignment
        if (alignmentCount > 0) {
            alignment.div(alignmentCount);
            alignment.setMag(params.maxSpeed);
            alignment.sub(this.velocity);
            alignment.limit(params.maxForce);
            alignment.mult(params.alignment);
        }

        // Cohesion
        if (cohesionCount > 0) {
            cohesion.div(cohesionCount);
            const desired = Vector.sub(cohesion, this.position);
            desired.setMag(params.maxSpeed);
            const steer = Vector.sub(desired, this.velocity);
            steer.limit(params.maxForce);
            cohesion.x = steer.x * params.cohesion;
            cohesion.y = steer.y * params.cohesion;
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

        this.velocity.add(this.acceleration);
        this.velocity.limit(params.maxSpeed);
        this.position.add(this.velocity);
        this.acceleration.mult(0);
    }

    edges(width, height, bounceMode) {
        if (bounceMode) {
            const margin = 20;
            const turnForce = 0.5;

            if (this.position.x < margin) {
                this.velocity.x += turnForce;
            }
            if (this.position.x > width - margin) {
                this.velocity.x -= turnForce;
            }
            if (this.position.y < margin) {
                this.velocity.y += turnForce;
            }
            if (this.position.y > height - margin) {
                this.velocity.y -= turnForce;
            }
        } else {
            // Wrap mode
            if (this.position.x > width) this.position.x = 0;
            if (this.position.x < 0) this.position.x = width;
            if (this.position.y > height) this.position.y = 0;
            if (this.position.y < 0) this.position.y = height;
        }
    }

    draw(ctx, params) {
        // Draw trail
        if (this.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);

            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }

            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.3;
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Draw boid as triangle
        const angle = this.velocity.heading();
        const speed = this.velocity.mag();
        const size = 8 + (speed / params.maxSpeed) * 4; // Size varies with speed

        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(angle);

        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;

        // Draw triangle
        ctx.beginPath();
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.6, size * 0.5);
        ctx.lineTo(-size * 0.6, -size * 0.5);
        ctx.closePath();

        ctx.fillStyle = this.color;
        ctx.fill();

        // Inner glow
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(size * 0.6, 0);
        ctx.lineTo(-size * 0.3, size * 0.3);
        ctx.lineTo(-size * 0.3, -size * 0.3);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.5;
        ctx.fill();
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
            trailLength: 20,
            visionAngle: 270,
            mouseForce: 1.0
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
        // Clear with slight transparency for motion blur effect
        this.ctx.fillStyle = 'rgba(10, 0, 20, 0.15)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw all boids
        for (const boid of this.boids) {
            boid.draw(this.ctx, this.params);
        }
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
