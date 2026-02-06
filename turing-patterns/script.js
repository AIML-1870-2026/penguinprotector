// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    width: 256,
    height: 256,
    stepsPerFrame: 8
};

// Presets
const PRESETS = [
    { name: 'Mitosis', f: 0.0367, k: 0.0649 },
    { name: 'Coral', f: 0.0545, k: 0.062 },
    { name: 'Spots', f: 0.014, k: 0.054 },
    { name: 'Stripes', f: 0.022, k: 0.051 },
    { name: 'Waves', f: 0.014, k: 0.045 },
    { name: 'Worms', f: 0.078, k: 0.061 },
    { name: 'Fingerprint', f: 0.055, k: 0.062 },
    { name: 'Spirals', f: 0.018, k: 0.051 },
    { name: 'Maze', f: 0.029, k: 0.057 },
    { name: 'Bubbles', f: 0.098, k: 0.057 }
];

// Color schemes
const COLOR_SCHEMES = {
    grayscale: [[0,0,0], [255,255,255]],
    plasma: [[13,8,135], [126,3,168], [204,71,120], [248,149,64], [240,249,33]],
    ocean: [[0,51,102], [0,102,153], [0,204,204], [255,255,255]],
    fire: [[0,0,0], [128,0,0], [255,0,0], [255,102,0], [255,255,0], [255,255,255]],
    rainbow: [[255,0,0], [255,127,0], [255,255,0], [0,255,0], [0,0,255], [75,0,130], [148,0,211]],
    neon: [[0,0,0], [255,0,255], [0,255,255], [255,255,255]]
};

// ============================================
// STATE
// ============================================
let state = {
    playing: false,
    mode: '2d',
    colorScheme: 'grayscale',
    invert: false,
    seedType: 'center',
    params: {
        f: 0.055,
        k: 0.062,
        Du: 0.16,
        Dv: 0.08
    },
    iterations: 0,
    heightScale: 2.0,
    // Brush settings
    brush: {
        enabled: true,
        type: 'v',        // 'v', 'u', 'both', 'eraser'
        size: 15,
        intensity: 0.8
    }
};

// WebGL
let gl, canvas2d, canvas3d;
let simulationProgram, renderProgram;
let textures = [];
let framebuffers = [];
let currentTexture = 0;
let quadBuffer;

// Three.js
let scene, camera, renderer, mesh, geometry;

// FPS
let frameCount = 0;
let lastFpsUpdate = 0;

// Drawing
let isDrawing = false;
let brushCursor = null;

// ============================================
// INITIALIZATION
// ============================================
function init() {
    canvas2d = document.getElementById('canvas2d');
    canvas3d = document.getElementById('canvas3d');

    canvas2d.width = CONFIG.width;
    canvas2d.height = CONFIG.height;

    initWebGL();
    initPresets();
    init3D();
    initBrushCursor();
    initEventListeners();

    reset();
    requestAnimationFrame(animate);
}

function initBrushCursor() {
    // Create brush cursor element
    brushCursor = document.createElement('div');
    brushCursor.className = 'brush-cursor';
    document.querySelector('.canvas-container').appendChild(brushCursor);
    updateBrushCursor();
}

function initWebGL() {
    gl = canvas2d.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) {
        alert('WebGL not supported');
        return;
    }

    // Enable float textures
    const ext = gl.getExtension('OES_texture_float');
    if (!ext) {
        alert('Float textures not supported');
        return;
    }

    // Simulation shader
    const simVert = `
        attribute vec2 position;
        varying vec2 uv;
        void main() {
            uv = position * 0.5 + 0.5;
            gl_Position = vec4(position, 0.0, 1.0);
        }
    `;

    const simFrag = `
        precision highp float;
        uniform sampler2D uTexture;
        uniform vec2 uResolution;
        uniform float uFeed;
        uniform float uKill;
        uniform float uDu;
        uniform float uDv;
        uniform float uDt;
        varying vec2 uv;

        void main() {
            vec2 texel = 1.0 / uResolution;

            vec4 center = texture2D(uTexture, uv);
            float u = center.r;
            float v = center.g;

            // Laplacian with weighted kernel
            float laplacianU = 0.0;
            float laplacianV = 0.0;

            // Center weight: -1
            laplacianU -= u;
            laplacianV -= v;

            // Adjacent cells (weight: 0.2 each)
            vec4 n = texture2D(uTexture, uv + vec2(0.0, texel.y));
            vec4 s = texture2D(uTexture, uv + vec2(0.0, -texel.y));
            vec4 e = texture2D(uTexture, uv + vec2(texel.x, 0.0));
            vec4 w = texture2D(uTexture, uv + vec2(-texel.x, 0.0));

            laplacianU += 0.2 * (n.r + s.r + e.r + w.r);
            laplacianV += 0.2 * (n.g + s.g + e.g + w.g);

            // Diagonal cells (weight: 0.05 each)
            vec4 ne = texture2D(uTexture, uv + vec2(texel.x, texel.y));
            vec4 nw = texture2D(uTexture, uv + vec2(-texel.x, texel.y));
            vec4 se = texture2D(uTexture, uv + vec2(texel.x, -texel.y));
            vec4 sw = texture2D(uTexture, uv + vec2(-texel.x, -texel.y));

            laplacianU += 0.05 * (ne.r + nw.r + se.r + sw.r);
            laplacianV += 0.05 * (ne.g + nw.g + se.g + sw.g);

            // Gray-Scott equations
            float uvv = u * v * v;
            float du = uDu * laplacianU - uvv + uFeed * (1.0 - u);
            float dv = uDv * laplacianV + uvv - (uFeed + uKill) * v;

            float newU = u + du * uDt;
            float newV = v + dv * uDt;

            gl_FragColor = vec4(clamp(newU, 0.0, 1.0), clamp(newV, 0.0, 1.0), 0.0, 1.0);
        }
    `;

    // Render shader
    const renderVert = simVert;

    const renderFrag = `
        precision highp float;
        uniform sampler2D uTexture;
        uniform vec3 uColors[7];
        uniform float uColorCount;
        uniform float uInvert;
        varying vec2 uv;

        vec3 getColor(float t) {
            if (uInvert > 0.5) t = 1.0 - t;
            t = clamp(t, 0.0, 1.0);

            float segments = uColorCount - 1.0;
            float idx = t * segments;
            float i = floor(idx);
            float frac = idx - i;

            if (i >= uColorCount - 1.0) {
                i = uColorCount - 2.0;
                frac = 1.0;
            }

            // Manual color interpolation since GLSL ES doesn't support dynamic indexing well
            vec3 c1, c2;
            if (i < 0.5) { c1 = uColors[0]; c2 = uColors[1]; }
            else if (i < 1.5) { c1 = uColors[1]; c2 = uColors[2]; }
            else if (i < 2.5) { c1 = uColors[2]; c2 = uColors[3]; }
            else if (i < 3.5) { c1 = uColors[3]; c2 = uColors[4]; }
            else if (i < 4.5) { c1 = uColors[4]; c2 = uColors[5]; }
            else { c1 = uColors[5]; c2 = uColors[6]; }

            return mix(c1, c2, frac);
        }

        void main() {
            vec4 data = texture2D(uTexture, uv);
            float v = data.g;
            vec3 color = getColor(v);
            gl_FragColor = vec4(color, 1.0);
        }
    `;

    simulationProgram = createProgram(simVert, simFrag);
    renderProgram = createProgram(renderVert, renderFrag);

    // Create quad
    quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);

    // Create textures and framebuffers
    for (let i = 0; i < 2; i++) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CONFIG.width, CONFIG.height, 0, gl.RGBA, gl.FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        textures.push(texture);

        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        framebuffers.push(fb);
    }
}

function createProgram(vertSrc, fragSrc) {
    const vert = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vert, vertSrc);
    gl.compileShader(vert);
    if (!gl.getShaderParameter(vert, gl.COMPILE_STATUS)) {
        console.error('Vertex shader error:', gl.getShaderInfoLog(vert));
    }

    const frag = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(frag, fragSrc);
    gl.compileShader(frag);
    if (!gl.getShaderParameter(frag, gl.COMPILE_STATUS)) {
        console.error('Fragment shader error:', gl.getShaderInfoLog(frag));
    }

    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
    }

    return program;
}

function init3D() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0f1a);

    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 2, 3);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true });
    renderer.setSize(512, 512);

    // Create plane geometry
    geometry = new THREE.PlaneGeometry(2, 2, CONFIG.width - 1, CONFIG.height - 1);
    geometry.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
        color: 0xe94560,
        flatShading: false,
        side: THREE.DoubleSide,
        vertexColors: true
    });

    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 2, 1);
    scene.add(directionalLight);

    // Mouse controls for 3D
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let rotation = { x: 0.5, y: 0 };
    let zoom = 3;

    canvas3d.addEventListener('mousedown', (e) => {
        isDragging = true;
        prevMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => isDragging = false);

    canvas3d.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - prevMouse.x;
        const dy = e.clientY - prevMouse.y;
        rotation.y += dx * 0.01;
        rotation.x += dy * 0.01;
        rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, rotation.x));
        prevMouse = { x: e.clientX, y: e.clientY };
        updateCamera();
    });

    canvas3d.addEventListener('wheel', (e) => {
        e.preventDefault();
        zoom += e.deltaY * 0.002;
        zoom = Math.max(1.5, Math.min(8, zoom));
        updateCamera();
    });

    function updateCamera() {
        camera.position.x = Math.sin(rotation.y) * Math.cos(rotation.x) * zoom;
        camera.position.y = Math.sin(rotation.x) * zoom;
        camera.position.z = Math.cos(rotation.y) * Math.cos(rotation.x) * zoom;
        camera.lookAt(0, 0, 0);
    }
}

function initPresets() {
    const grid = document.getElementById('presetGrid');
    PRESETS.forEach((preset, i) => {
        const btn = document.createElement('button');
        btn.className = 'preset-btn';
        btn.textContent = preset.name;
        btn.onclick = () => loadPreset(i);
        grid.appendChild(btn);
    });
}

function initEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;

        switch(e.key.toLowerCase()) {
            case ' ':
                e.preventDefault();
                togglePlay();
                break;
            case 'r':
                reset();
                break;
            case 's':
                randomize();
                break;
            case 'b':
                state.brush.enabled = !state.brush.enabled;
                document.getElementById('brushEnabledCheck').checked = state.brush.enabled;
                updateCanvasCursor();
                updateBrushCursor();
                break;
            case '[':
                adjustBrushSize(-5);
                break;
            case ']':
                adjustBrushSize(5);
                break;
            default:
                const num = parseInt(e.key);
                if (num >= 1 && num <= 9) {
                    loadPreset(num - 1);
                }
        }
    });

    // Drawing on canvas
    canvas2d.addEventListener('mousedown', startDrawing);
    canvas2d.addEventListener('mousemove', handleCanvasMove);
    canvas2d.addEventListener('mouseup', stopDrawing);
    canvas2d.addEventListener('mouseleave', handleCanvasLeave);

    // Update canvas class for cursor
    updateCanvasCursor();
}

// ============================================
// SIMULATION
// ============================================
function reset() {
    state.iterations = 0;
    initializeGrid();
}

function initializeGrid() {
    const data = new Float32Array(CONFIG.width * CONFIG.height * 4);

    // Initialize with U=1, V=0 everywhere
    for (let i = 0; i < CONFIG.width * CONFIG.height; i++) {
        data[i * 4] = 1.0;     // U
        data[i * 4 + 1] = 0.0; // V
        data[i * 4 + 2] = 0.0;
        data[i * 4 + 3] = 1.0;
    }

    // Add seed pattern
    switch (state.seedType) {
        case 'center':
            addCircle(data, CONFIG.width/2, CONFIG.height/2, 20);
            break;
        case 'multiple':
            for (let i = 0; i < 10; i++) {
                const x = Math.random() * CONFIG.width;
                const y = Math.random() * CONFIG.height;
                const r = 5 + Math.random() * 15;
                addCircle(data, x, y, r);
            }
            break;
        case 'grid':
            const spacing = 40;
            for (let x = spacing; x < CONFIG.width; x += spacing) {
                for (let y = spacing; y < CONFIG.height; y += spacing) {
                    addCircle(data, x, y, 8);
                }
            }
            break;
        case 'noise':
            for (let i = 0; i < CONFIG.width * CONFIG.height; i++) {
                if (Math.random() < 0.1) {
                    data[i * 4 + 1] = Math.random();
                }
            }
            break;
    }

    // Upload to texture
    gl.bindTexture(gl.TEXTURE_2D, textures[0]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CONFIG.width, CONFIG.height, 0, gl.RGBA, gl.FLOAT, data);
    gl.bindTexture(gl.TEXTURE_2D, textures[1]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CONFIG.width, CONFIG.height, 0, gl.RGBA, gl.FLOAT, data);
    currentTexture = 0;
}

function addCircle(data, cx, cy, radius) {
    for (let y = 0; y < CONFIG.height; y++) {
        for (let x = 0; x < CONFIG.width; x++) {
            const dx = x - cx;
            const dy = y - cy;
            if (dx * dx + dy * dy < radius * radius) {
                const idx = (y * CONFIG.width + x) * 4;
                data[idx] = 0.5;     // Lower U
                data[idx + 1] = 0.25; // Add V
            }
        }
    }
}

function simulationStep() {
    gl.useProgram(simulationProgram);

    // Set uniforms
    gl.uniform2f(gl.getUniformLocation(simulationProgram, 'uResolution'), CONFIG.width, CONFIG.height);
    gl.uniform1f(gl.getUniformLocation(simulationProgram, 'uFeed'), state.params.f);
    gl.uniform1f(gl.getUniformLocation(simulationProgram, 'uKill'), state.params.k);
    gl.uniform1f(gl.getUniformLocation(simulationProgram, 'uDu'), state.params.Du);
    gl.uniform1f(gl.getUniformLocation(simulationProgram, 'uDv'), state.params.Dv);
    gl.uniform1f(gl.getUniformLocation(simulationProgram, 'uDt'), 1.0);

    // Bind source texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[currentTexture]);
    gl.uniform1i(gl.getUniformLocation(simulationProgram, 'uTexture'), 0);

    // Render to target framebuffer
    const targetTexture = 1 - currentTexture;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[targetTexture]);
    gl.viewport(0, 0, CONFIG.width, CONFIG.height);

    // Draw quad
    const posLoc = gl.getAttribLocation(simulationProgram, 'position');
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    currentTexture = targetTexture;
    state.iterations++;
}

function render() {
    gl.useProgram(renderProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas2d.width, canvas2d.height);

    // Set color scheme
    const colors = COLOR_SCHEMES[state.colorScheme];
    const colorArray = [];
    for (let i = 0; i < 7; i++) {
        if (i < colors.length) {
            colorArray.push(colors[i][0]/255, colors[i][1]/255, colors[i][2]/255);
        } else {
            colorArray.push(1, 1, 1);
        }
    }
    gl.uniform3fv(gl.getUniformLocation(renderProgram, 'uColors'), colorArray);
    gl.uniform1f(gl.getUniformLocation(renderProgram, 'uColorCount'), colors.length);
    gl.uniform1f(gl.getUniformLocation(renderProgram, 'uInvert'), state.invert ? 1.0 : 0.0);

    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[currentTexture]);
    gl.uniform1i(gl.getUniformLocation(renderProgram, 'uTexture'), 0);

    // Draw
    const posLoc = gl.getAttribLocation(renderProgram, 'position');
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function render3D() {
    // Read data from texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[currentTexture]);
    const pixels = new Float32Array(CONFIG.width * CONFIG.height * 4);
    gl.readPixels(0, 0, CONFIG.width, CONFIG.height, gl.RGBA, gl.FLOAT, pixels);

    // Update geometry
    const positions = geometry.attributes.position.array;
    const colors = [];
    const colorPalette = COLOR_SCHEMES[state.colorScheme];

    for (let i = 0; i < CONFIG.width * CONFIG.height; i++) {
        const v = pixels[i * 4 + 1];
        positions[i * 3 + 1] = v * state.heightScale;

        // Calculate color
        let t = state.invert ? 1 - v : v;
        t = Math.max(0, Math.min(1, t));
        const colorIdx = t * (colorPalette.length - 1);
        const ci = Math.floor(colorIdx);
        const cf = colorIdx - ci;
        const c1 = colorPalette[Math.min(ci, colorPalette.length - 1)];
        const c2 = colorPalette[Math.min(ci + 1, colorPalette.length - 1)];

        colors.push(
            (c1[0] + (c2[0] - c1[0]) * cf) / 255,
            (c1[1] + (c2[1] - c1[1]) * cf) / 255,
            (c1[2] + (c2[2] - c1[2]) * cf) / 255
        );
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();

    renderer.render(scene, camera);
}

// ============================================
// ANIMATION LOOP
// ============================================
function animate(time) {
    requestAnimationFrame(animate);

    if (state.playing) {
        const steps = parseInt(document.getElementById('speedSlider').value);
        for (let i = 0; i < steps; i++) {
            simulationStep();
        }
    }

    if (state.mode === '2d') {
        render();
    } else {
        render3D();
    }

    // FPS counter
    frameCount++;
    if (time - lastFpsUpdate > 1000) {
        document.getElementById('fpsCounter').textContent = `FPS: ${frameCount}`;
        frameCount = 0;
        lastFpsUpdate = time;
    }

    document.getElementById('iterCounter').textContent = `Iterations: ${state.iterations}`;
}

// ============================================
// UI HANDLERS
// ============================================
function toggleSection(header) {
    header.parentElement.classList.toggle('collapsed');
}

function togglePlay() {
    state.playing = !state.playing;
    document.getElementById('playPauseBtn').textContent = state.playing ? 'Pause' : 'Play';
}

function randomize() {
    state.seedType = 'multiple';
    document.getElementById('seedSelect').value = 'multiple';
    reset();
}

function updateSpeed() {
    const val = document.getElementById('speedSlider').value;
    document.getElementById('speedValue').textContent = val;
}

function updateParams() {
    state.params.f = document.getElementById('feedSlider').value / 1000;
    state.params.k = document.getElementById('killSlider').value / 1000;
    state.params.Du = document.getElementById('duSlider').value / 100;
    state.params.Dv = document.getElementById('dvSlider').value / 100;

    document.getElementById('feedValue').textContent = state.params.f.toFixed(3);
    document.getElementById('killValue').textContent = state.params.k.toFixed(3);
    document.getElementById('duValue').textContent = state.params.Du.toFixed(2);
    document.getElementById('dvValue').textContent = state.params.Dv.toFixed(2);
}

function loadPreset(index) {
    if (index >= PRESETS.length) return;

    const preset = PRESETS[index];
    state.params.f = preset.f;
    state.params.k = preset.k;

    // Update sliders
    document.getElementById('feedSlider').value = preset.f * 1000;
    document.getElementById('killSlider').value = preset.k * 1000;
    document.getElementById('feedValue').textContent = preset.f.toFixed(3);
    document.getElementById('killValue').textContent = preset.k.toFixed(3);

    // Update active preset button
    document.querySelectorAll('.preset-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });

    reset();
}

function setColorScheme(scheme, btn) {
    state.colorScheme = scheme;
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

function updateVisualization() {
    state.invert = document.getElementById('invertCheck').checked;
}

function setMode(mode) {
    state.mode = mode;
    document.getElementById('btn2d').classList.toggle('active', mode === '2d');
    document.getElementById('btn3d').classList.toggle('active', mode === '3d');
    document.getElementById('canvas2d').style.display = mode === '2d' ? 'block' : 'none';
    document.getElementById('canvas3d').style.display = mode === '3d' ? 'block' : 'none';
    document.getElementById('heightControls').style.display = mode === '3d' ? 'block' : 'none';
}

function update3DHeight() {
    state.heightScale = document.getElementById('heightSlider').value / 10;
    document.getElementById('heightValue').textContent = state.heightScale.toFixed(1);
}

function updateSeedType() {
    state.seedType = document.getElementById('seedSelect').value;
}

// ============================================
// BRUSH TOOLS
// ============================================
function setBrushType(type, btn) {
    state.brush.type = type;
    document.querySelectorAll('.brush-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateBrushCursor();
    updateCanvasCursor();
}

function updateBrushSize() {
    const val = parseInt(document.getElementById('brushSizeSlider').value);
    state.brush.size = val;
    document.getElementById('brushSizeValue').textContent = val;
    updateBrushCursor();
}

function updateBrushIntensity() {
    const val = parseInt(document.getElementById('brushIntensitySlider').value);
    state.brush.intensity = val / 100;
    document.getElementById('brushIntensityValue').textContent = val + '%';
}

function toggleBrushEnabled() {
    state.brush.enabled = document.getElementById('brushEnabledCheck').checked;
    updateCanvasCursor();
    updateBrushCursor();
}

function adjustBrushSize(delta) {
    const slider = document.getElementById('brushSizeSlider');
    const newVal = Math.max(2, Math.min(50, state.brush.size + delta));
    slider.value = newVal;
    state.brush.size = newVal;
    document.getElementById('brushSizeValue').textContent = newVal;
    updateBrushCursor();
}

function updateCanvasCursor() {
    canvas2d.classList.remove('brush-enabled', 'brush-v', 'brush-u', 'brush-both', 'brush-eraser');
    if (state.brush.enabled && state.mode === '2d') {
        canvas2d.classList.add('brush-enabled', 'brush-' + state.brush.type);
    }
}

function updateBrushCursor() {
    if (!brushCursor) return;

    // Calculate display size based on canvas scaling
    const rect = canvas2d.getBoundingClientRect();
    const scale = rect.width / CONFIG.width;
    const displaySize = state.brush.size * scale * 2;

    brushCursor.style.width = displaySize + 'px';
    brushCursor.style.height = displaySize + 'px';

    // Update type class
    brushCursor.className = 'brush-cursor type-' + state.brush.type;
    if (state.brush.enabled && state.mode === '2d') {
        brushCursor.classList.add('active');
    }
}

function handleCanvasMove(e) {
    // Update brush cursor position
    if (brushCursor && state.brush.enabled && state.mode === '2d') {
        const rect = canvas2d.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
            brushCursor.style.left = (e.clientX - rect.left + canvas2d.offsetLeft) + 'px';
            brushCursor.style.top = (e.clientY - rect.top + canvas2d.offsetTop) + 'px';
            brushCursor.classList.add('active');
        } else {
            brushCursor.classList.remove('active');
        }
    }

    // Draw if mouse is down
    if (isDrawing) {
        draw(e);
    }
}

function handleCanvasLeave() {
    stopDrawing();
    if (brushCursor) {
        brushCursor.classList.remove('active');
    }
}

function startDrawing(e) {
    if (!state.brush.enabled || state.mode !== '2d') return;
    isDrawing = true;
    draw(e);
}

function draw(e) {
    if (!isDrawing || !state.brush.enabled || state.mode !== '2d') return;

    const rect = canvas2d.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CONFIG.width;
    const y = (1 - (e.clientY - rect.top) / rect.height) * CONFIG.height;

    // Read current texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[currentTexture]);
    const pixels = new Float32Array(CONFIG.width * CONFIG.height * 4);
    gl.readPixels(0, 0, CONFIG.width, CONFIG.height, gl.RGBA, gl.FLOAT, pixels);

    // Apply brush based on type
    applyBrush(pixels, x, y, state.brush.size, state.brush.type, state.brush.intensity);

    // Upload modified data to both textures for immediate effect
    gl.bindTexture(gl.TEXTURE_2D, textures[currentTexture]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CONFIG.width, CONFIG.height, 0, gl.RGBA, gl.FLOAT, pixels);
}

function applyBrush(data, cx, cy, radius, type, intensity) {
    const radiusSq = radius * radius;

    for (let py = 0; py < CONFIG.height; py++) {
        for (let px = 0; px < CONFIG.width; px++) {
            const dx = px - cx;
            const dy = py - cy;
            const distSq = dx * dx + dy * dy;

            if (distSq < radiusSq) {
                const idx = (py * CONFIG.width + px) * 4;

                // Smooth falloff from center
                const falloff = 1 - Math.sqrt(distSq) / radius;
                const strength = falloff * intensity;

                switch (type) {
                    case 'v':
                        // Add chemical V (reduces U, increases V)
                        data[idx] = Math.max(0, data[idx] - strength * 0.5);
                        data[idx + 1] = Math.min(1, data[idx + 1] + strength * 0.25);
                        break;
                    case 'u':
                        // Add chemical U (increases U, reduces V)
                        data[idx] = Math.min(1, data[idx] + strength * 0.5);
                        data[idx + 1] = Math.max(0, data[idx + 1] - strength * 0.25);
                        break;
                    case 'both':
                        // Add both chemicals (creates reaction zone)
                        data[idx] = 0.5 + (data[idx] - 0.5) * (1 - strength);
                        data[idx + 1] = Math.min(1, data[idx + 1] + strength * 0.3);
                        break;
                    case 'eraser':
                        // Reset to initial state (U=1, V=0)
                        data[idx] = data[idx] + (1 - data[idx]) * strength;
                        data[idx + 1] = data[idx + 1] * (1 - strength);
                        break;
                }
            }
        }
    }
}

function stopDrawing() {
    isDrawing = false;
}

// Export
function exportImage() {
    const multiplier = parseInt(document.getElementById('exportRes').value);
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = CONFIG.width * multiplier;
    exportCanvas.height = CONFIG.height * multiplier;
    const ctx = exportCanvas.getContext('2d');

    if (state.mode === '2d') {
        ctx.drawImage(canvas2d, 0, 0, exportCanvas.width, exportCanvas.height);
    } else {
        ctx.drawImage(canvas3d, 0, 0, exportCanvas.width, exportCanvas.height);
    }

    const link = document.createElement('a');
    link.download = `turing-pattern-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
