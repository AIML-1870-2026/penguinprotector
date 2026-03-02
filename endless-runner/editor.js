'use strict';

/* ============================================================
   Rat Race — Level Editor (editor.js)
   Canvas 800×400 logical, same coordinate space as the game.
   GROUND_Y = 320 matches script.js.
   ============================================================ */

const LW = 800, LH = 400;
const GROUND_Y = 320;
const GRID_SIZE = 10;
const BOUNDARY_HIT = 8; // px tolerance for chunk-width drag handle

// ─── EDITOR STATE ───────────────────────────────────────────────
const ed = {
  canvas: null,
  ctx: null,

  // Camera
  camX: 0,

  // Tools & grid
  tool: 'select',
  gridSnap: true,

  // Chunk data
  chunkWidth: 600,
  platforms: [],
  hazards: [],

  // Selection
  selected: null,
  selectionType: null,

  // Drag state (moving selected object)
  dragging: false,
  dragOffX: 0,
  dragOffY: 0,

  // Placement state (placing new object)
  placing: false,
  placingObj: null,
  dragStartX: 0,

  // Boundary resize
  draggingBoundary: false,

  // Pan
  panning: false,
  panStartX: 0,

  // Animation clock
  t: 0,
  lastTs: 0,
};

// ─── OBJECT DEFINITIONS ─────────────────────────────────────────
const PLATFORM_TYPES   = new Set(['ground', 'platform', 'crumble', 'moving']);
const HAZARD_TYPES     = new Set(['fan', 'antenna', 'pigeon', 'steam', 'clothesline']);
const WIDTH_DRAG_TYPES = new Set(['ground', 'platform', 'crumble', 'moving', 'clothesline']);

// Default sizes match the game's hand-crafted chunks exactly
const OBJECT_DEFAULTS = {
  ground:      { w: 200, h: 20 },
  platform:    { w: 90,  h: 14 },
  crumble:     { w: 80,  h: 14 },
  moving:      { w: 110, h: 14, range: 55, freq: 0.55 },
  fan:         { w: 28,  h: 32 },
  antenna:     { w: 10,  h: 55 },
  pigeon:      { w: 55,  h: 22, vx: -2 },
  steam:       { w: 18,  h: 58, period: 2.2 },
  clothesline: { w: 200, h: 25 },
};

function isPlatformType(t) { return PLATFORM_TYPES.has(t); }

function buildObject(type, x, y) {
  const def = OBJECT_DEFAULTS[type];
  const obj = { type, x, y, w: def.w, h: def.h, t: 0 };
  if (type === 'moving')  { obj.oy = y; obj.range = def.range; obj.freq = def.freq; obj.moving = true; }
  if (type === 'crumble') { obj.crumbling = false; obj.crumbleT = 0; }
  if (type === 'steam')   { obj.period = def.period; }
  if (type === 'pigeon')  { obj.vx = def.vx; }
  return obj;
}

function commitObject(obj) {
  if (isPlatformType(obj.type)) ed.platforms.push(obj);
  else                           ed.hazards.push(obj);
  ed.selected      = obj;
  ed.selectionType = isPlatformType(obj.type) ? 'platform' : 'hazard';
}

function deleteSelected() {
  if (!ed.selected) return;
  ed.platforms = ed.platforms.filter(p => p !== ed.selected);
  ed.hazards   = ed.hazards.filter(h => h !== ed.selected);
  ed.selected  = null;
  ed.selectionType = null;
  updatePropsPanel();
}

function hitTest(wx, wy) {
  // Hazards on top
  for (let i = ed.hazards.length - 1; i >= 0; i--) {
    const h = ed.hazards[i];
    if (wx >= h.x && wx <= h.x + h.w && wy >= h.y && wy <= h.y + h.h) {
      return { obj: h, kind: 'hazard' };
    }
  }
  for (let i = ed.platforms.length - 1; i >= 0; i--) {
    const p = ed.platforms[i];
    if (wx >= p.x && wx <= p.x + p.w && wy >= p.y && wy <= p.y + p.h) {
      return { obj: p, kind: 'platform' };
    }
  }
  return null;
}

// ─── COORDINATE HELPERS ─────────────────────────────────────────
function canvasScreenPos(e) {
  const rect = ed.canvas.getBoundingClientRect();
  return {
    sx: (e.clientX - rect.left) * (LW / rect.width),
    sy: (e.clientY - rect.top)  * (LH / rect.height),
  };
}

function screenToWorld(sx, sy) {
  return { wx: sx + ed.camX, wy: sy };
}

function snap(v) {
  return ed.gridSnap ? Math.round(v / GRID_SIZE) * GRID_SIZE : v;
}

// ─── RENDER LOOP ─────────────────────────────────────────────────
function editorLoop(ts) {
  const dt = Math.min((ts - (ed.lastTs || ts)) / 1000, 0.05);
  ed.lastTs = ts;
  ed.t += dt;
  renderEditor();
  requestAnimationFrame(editorLoop);
}

function renderEditor() {
  const ctx = ed.ctx;

  // Sky background
  ctx.fillStyle = '#02041a';
  ctx.fillRect(0, 0, LW, LH);

  if (ed.gridSnap) drawGrid(ctx);
  drawGroundGuide(ctx);
  drawChunkBoundary(ctx);
  drawEditorPlatforms(ctx);
  drawEditorHazards(ctx);

  if (ed.placing && ed.placingObj) drawPlacingPreview(ctx);
  if (ed.selected) drawSelectionHandles(ctx, ed.selected);
}

function drawGrid(ctx) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 0.5;
  const offX = ed.camX % GRID_SIZE;
  for (let x = -offX; x <= LW; x += GRID_SIZE) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, LH); ctx.stroke();
  }
  for (let y = 0; y <= LH; y += GRID_SIZE) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LW, y); ctx.stroke();
  }
  ctx.restore();
}

function drawGroundGuide(ctx) {
  // Subtle floor zone
  ctx.fillStyle = 'rgba(201, 122, 58, 0.06)';
  ctx.fillRect(0, GROUND_Y, LW, LH - GROUND_Y);
  // Orange surface line
  ctx.fillStyle = 'rgba(201, 122, 58, 0.25)';
  ctx.fillRect(0, GROUND_Y, LW, 2);
  // Label
  ctx.save();
  ctx.fillStyle = 'rgba(201,122,58,0.3)';
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.fillText('GROUND Y=320', 4, GROUND_Y + 4);
  ctx.restore();
}

function drawChunkBoundary(ctx) {
  const bx = ed.chunkWidth - ed.camX;
  ctx.save();
  ctx.strokeStyle = '#ff6b35';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(bx, 0); ctx.lineTo(bx, LH); ctx.stroke();
  ctx.setLineDash([]);
  // Drag handle bar
  ctx.fillStyle = 'rgba(255,107,53,0.7)';
  ctx.fillRect(bx - 4, LH / 2 - 22, 8, 44);
  // Width label
  ctx.fillStyle = '#ff6b35';
  ctx.font = 'bold 8px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText(`W:${ed.chunkWidth}`, bx + 10, LH / 2);
  ctx.restore();
}

// ─── PLATFORM RENDERING (mirrors script.js drawPlatforms) ───────
function drawEditorPlatforms(ctx) {
  for (const pl of ed.platforms) {
    const sx = pl.x - ed.camX;
    if (sx + pl.w < -10 || sx > LW + 10) continue;

    if (pl.type === 'ground') {
      ctx.fillStyle = '#2a1208';
      ctx.fillRect(sx, pl.y + 4, pl.w, 20);
      ctx.fillStyle = '#c97a3aaa';
      ctx.fillRect(sx, pl.y, pl.w, 4);

    } else if (pl.type === 'platform') {
      ctx.fillStyle = '#5a3a18';
      ctx.fillRect(sx, pl.y, pl.w, pl.h);
      ctx.fillStyle = '#8b6020';
      ctx.fillRect(sx, pl.y, pl.w, 3);

    } else if (pl.type === 'crumble') {
      ctx.fillStyle = '#6e4a14';
      ctx.fillRect(sx, pl.y, pl.w, pl.h);
      ctx.fillStyle = '#9a6a20';
      ctx.fillRect(sx, pl.y, pl.w, 3);
      ctx.save();
      ctx.strokeStyle = 'rgba(200,100,20,0.35)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(sx + (pl.w / 4) * i, pl.y);
        ctx.lineTo(sx + (pl.w / 4) * i + 2, pl.y + pl.h);
        ctx.stroke();
      }
      ctx.restore();

    } else if (pl.type === 'moving') {
      ctx.save();
      ctx.fillStyle = '#2a3a50';
      ctx.fillRect(sx, pl.y, pl.w, pl.h);
      ctx.fillStyle = '#c97a3a';
      ctx.fillRect(sx, pl.y, pl.w, 3);
      // Chevron motion indicators
      ctx.fillStyle = '#c97a3a88';
      ctx.font = 'bold 8px monospace';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < Math.floor(pl.w / 18); i++) {
        ctx.fillText('▲', sx + 6 + i * 18, pl.y + pl.h / 2 + 2);
      }
      // Travel range indicator (dashed rect)
      const oy    = pl.oy ?? pl.y;
      const range = pl.range ?? 55;
      ctx.strokeStyle = 'rgba(201,122,58,0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(sx, oy - range, pl.w, range * 2);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
}

// ─── HAZARD RENDERING (mirrors script.js drawHazards) ───────────
function drawEditorHazards(ctx) {
  for (const h of ed.hazards) {
    const sx = h.x - ed.camX;
    if (sx + h.w < -30 || sx > LW + 30) continue;
    const sy = h.y;

    // Pulsing danger glow
    const isSteamActive = h.type === 'steam' && (ed.t % (h.period ?? 2.2)) < ((h.period ?? 2.2) * 0.42);
    const isSteamWarm   = h.type === 'steam' && !isSteamActive;
    const pulse = 0.10 + 0.08 * Math.sin(ed.t * 3.14);
    ctx.save();
    ctx.globalAlpha = isSteamWarm ? pulse * 0.6 : pulse;
    ctx.fillStyle   = isSteamWarm ? '#ff8800' : '#ff2222';
    ctx.fillRect(sx - 5, sy - 5, h.w + 10, h.h + 10);
    ctx.restore();

    if (h.type === 'fan') {
      ctx.fillStyle = '#555';
      ctx.fillRect(sx + 4, sy + 22, 20, 10);
      ctx.save();
      ctx.translate(sx + 14, sy + 14);
      ctx.rotate(ed.t * 9);
      ctx.fillStyle = '#999';
      ctx.fillRect(-12, -2, 24, 5);
      ctx.rotate(Math.PI / 2);
      ctx.fillRect(-12, -2, 24, 5);
      ctx.restore();
    }

    if (h.type === 'antenna') {
      ctx.strokeStyle = '#777';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(sx + 5, sy + h.h); ctx.lineTo(sx + 5, sy); ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx - 7, sy + 10); ctx.lineTo(sx + 17, sy + 10); ctx.stroke();
      const blink = 0.5 + 0.5 * Math.sin(ed.t * 4);
      ctx.fillStyle = `rgba(255,40,40,${blink})`;
      ctx.beginPath(); ctx.arc(sx + 5, sy + 2, 3, 0, Math.PI * 2); ctx.fill();
    }

    if (h.type === 'pigeon') {
      drawEditorPigeon(ctx, sx + h.w / 2, sy + h.h / 2, ed.t);
    }

    if (h.type === 'steam') {
      ctx.fillStyle = '#555';
      ctx.fillRect(sx + h.w / 2 - 4, sy + h.h - 10, 8, 18);
      if (isSteamActive) {
        const grad = ctx.createLinearGradient(sx, sy, sx, sy + h.h);
        grad.addColorStop(0, 'rgba(210,220,230,0.82)');
        grad.addColorStop(1, 'rgba(210,220,230,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(sx, sy, h.w, h.h);
      }
    }

    if (h.type === 'clothesline') {
      const wireY = sy;
      ctx.fillStyle = '#6b4226';
      ctx.fillRect(sx - 3, wireY, 6, GROUND_Y + 20 - wireY);
      ctx.fillRect(sx + h.w - 3, wireY, 6, GROUND_Y + 20 - wireY);
      ctx.strokeStyle = '#c0c0c0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, wireY + 2);
      ctx.quadraticCurveTo(sx + h.w / 2, wireY + 7, sx + h.w, wireY + 2);
      ctx.stroke();
      const CLOTH_COLS = ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c'];
      const count = Math.max(2, Math.floor(h.w / 65));
      for (let i = 0; i < count; i++) {
        const cx     = sx + h.w * (i + 0.5) / count;
        const clothY = wireY + 7;
        const col    = CLOTH_COLS[i % CLOTH_COLS.length];
        ctx.strokeStyle = '#bbb'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(cx - 4, clothY); ctx.lineTo(cx - 4, clothY + 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 4, clothY); ctx.lineTo(cx + 4, clothY + 4); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(cx - 10, clothY + 4); ctx.lineTo(cx - 5,  clothY + 4);
        ctx.lineTo(cx - 3,  clothY + 7); ctx.lineTo(cx + 3,  clothY + 7);
        ctx.lineTo(cx + 5,  clothY + 4); ctx.lineTo(cx + 10, clothY + 4);
        ctx.lineTo(cx + 8,  clothY + 17); ctx.lineTo(cx - 8, clothY + 17);
        ctx.closePath(); ctx.fill();
      }
    }
  }
}

// Full pigeon flock — exact copy of game's drawPigeon adapted to use ctx param
function drawEditorPigeon(ctx, cx, cy, t) {
  const flock = [
    { dx: 0,   dy: 0,  phase: 0,   sz: 1.0  },
    { dx: -22, dy: -6, phase: 1.1, sz: 0.82 },
    { dx: 19,  dy: 5,  phase: 2.0, sz: 0.87 },
  ];
  for (const b of flock) {
    const flap = Math.sin(t * 8 + b.phase);
    const wY   = flap * 6;
    ctx.save();
    ctx.translate(cx + b.dx, cy + b.dy);
    ctx.scale(-b.sz, b.sz);
    ctx.fillStyle = '#526878';
    ctx.beginPath(); ctx.ellipse(-1, -wY * 0.6, 11, 3.5, 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8ba8bc';
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7898ae';
    ctx.beginPath(); ctx.ellipse(-1, -wY, 12, 4, -0.25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#628090';
    ctx.beginPath(); ctx.moveTo(-12, -3.5); ctx.lineTo(-22, 0); ctx.lineTo(-12, 3.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9abfd4';
    ctx.beginPath(); ctx.arc(13, -2.5, 5.5, 0, Math.PI * 2); ctx.fill();
    const shimmer = 0.3 + 0.15 * Math.sin(t * 3 + b.phase);
    ctx.fillStyle = `rgba(80,220,160,${shimmer})`;
    ctx.beginPath(); ctx.ellipse(7, -1.5, 3.5, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#354a56';
    ctx.beginPath(); ctx.moveTo(18, -3); ctx.lineTo(23.5, -1.5); ctx.lineTo(18, -0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#415866';
    ctx.beginPath(); ctx.moveTo(18, -0.5); ctx.lineTo(22.5, 0.2); ctx.lineTo(18, 1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e05010';
    ctx.beginPath(); ctx.arc(14.5, -3.5, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(14.5, -3.5, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(15.1, -4.1, 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawPlacingPreview(ctx) {
  const obj = ed.placingObj;
  const sx  = obj.x - ed.camX;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(sx, obj.y, obj.w, obj.h);
  ctx.setLineDash([]);
  ctx.restore();
}

function drawSelectionHandles(ctx, obj) {
  const sx = obj.x - ed.camX;
  ctx.save();
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);
  ctx.strokeRect(sx - 3, obj.y - 3, obj.w + 6, obj.h + 6);
  ctx.setLineDash([]);
  ctx.fillStyle = '#f1c40f';
  [
    [sx - 5, obj.y - 5], [sx + obj.w - 3, obj.y - 5],
    [sx - 5, obj.y + obj.h - 3], [sx + obj.w - 3, obj.y + obj.h - 3],
  ].forEach(([hx, hy]) => ctx.fillRect(hx, hy, 8, 8));
  ctx.restore();
}

// ─── MOUSE EVENTS ────────────────────────────────────────────────
function onMouseDown(e) {
  if (e.button !== 0 && e.button !== 1) return;
  e.preventDefault();

  const { sx, sy } = canvasScreenPos(e);
  const { wx, wy } = screenToWorld(sx, sy);

  // Middle mouse = pan
  if (e.button === 1) {
    ed.panning    = true;
    ed.panStartX  = e.clientX;
    return;
  }

  // Check chunk-boundary drag handle (screen coords)
  const bx = ed.chunkWidth - ed.camX;
  if (Math.abs(sx - bx) < BOUNDARY_HIT) {
    ed.draggingBoundary = true;
    return;
  }

  if (ed.tool === 'select') {
    const hit = hitTest(wx, wy);
    if (hit) {
      ed.selected      = hit.obj;
      ed.selectionType = hit.kind;
      ed.dragging      = true;
      ed.dragOffX      = wx - hit.obj.x;
      ed.dragOffY      = wy - hit.obj.y;
    } else {
      ed.selected      = null;
      ed.selectionType = null;
    }
    updatePropsPanel();
    return;
  }

  if (ed.tool === 'delete') {
    const hit = hitTest(wx, wy);
    if (hit) {
      ed.platforms = ed.platforms.filter(p => p !== hit.obj);
      ed.hazards   = ed.hazards.filter(h => h !== hit.obj);
      if (ed.selected === hit.obj) { ed.selected = null; ed.selectionType = null; }
      updatePropsPanel();
    }
    return;
  }

  // Placement tools
  const x = Math.max(0, snap(wx));
  const y = snap(wy);
  ed.dragStartX = x;
  ed.placingObj = buildObject(ed.tool, x, y);
  ed.placing    = true;
}

function onMouseMove(e) {
  const { sx, sy } = canvasScreenPos(e);
  const { wx, wy } = screenToWorld(sx, sy);

  document.getElementById('ed-status-pos').textContent =
    `x: ${Math.round(wx)}  y: ${Math.round(wy)}`;

  if (ed.draggingBoundary) {
    ed.chunkWidth = Math.max(300, Math.min(2400, snap(Math.max(300, wx))));
    document.getElementById('inp-chunk-w').value = ed.chunkWidth;
    return;
  }

  if (ed.panning) {
    const rect = ed.canvas.getBoundingClientRect();
    const dx   = (e.clientX - ed.panStartX) * (LW / rect.width);
    ed.camX    = Math.max(0, ed.camX - dx);
    ed.panStartX = e.clientX;
    return;
  }

  if (ed.dragging && ed.selected) {
    ed.selected.x = Math.max(0, snap(wx - ed.dragOffX));
    ed.selected.y = snap(wy - ed.dragOffY);
    if (ed.selected.type === 'moving' && !ed.selected._oyManual) {
      ed.selected.oy = ed.selected.y;
    }
    updatePropsPanel();
    return;
  }

  if (ed.placing && ed.placingObj && WIDTH_DRAG_TYPES.has(ed.tool)) {
    const snappedX = snap(wx);
    ed.placingObj.w = Math.max(GRID_SIZE, snappedX - ed.dragStartX);
  }

  // Cursor feedback near boundary
  const bx = ed.chunkWidth - ed.camX;
  ed.canvas.style.cursor = Math.abs(sx - bx) < BOUNDARY_HIT ? 'ew-resize' : 'crosshair';
}

function onMouseUp(e) {
  if (ed.panning)           { ed.panning = false; return; }
  if (ed.draggingBoundary)  { ed.draggingBoundary = false; return; }
  if (e.button !== 0) return;

  if (ed.dragging) {
    ed.dragging = false;
    updateStatusObj();
    return;
  }

  if (ed.placing && ed.placingObj) {
    if (ed.placingObj.w < GRID_SIZE) ed.placingObj.w = GRID_SIZE;
    commitObject(ed.placingObj);
    ed.placing    = false;
    ed.placingObj = null;
    updatePropsPanel();
    updateStatusObj();
  }
}

function onWheel(e) {
  e.preventDefault();
  ed.camX = Math.max(0, ed.camX + e.deltaY * 0.5);
}

function onContextMenu(e) { e.preventDefault(); }

// ─── KEYBOARD ────────────────────────────────────────────────────
function onKeyDown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  switch (e.code) {
    case 'KeyV':
      setTool('select');
      break;
    case 'KeyG':
      ed.gridSnap = !ed.gridSnap;
      document.getElementById('chk-grid').checked = ed.gridSnap;
      break;
    case 'Delete':
    case 'Backspace':
      deleteSelected();
      break;
    case 'Escape':
      ed.selected      = null;
      ed.selectionType = null;
      ed.placing       = false;
      ed.placingObj    = null;
      updatePropsPanel();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      ed.camX = Math.max(0, ed.camX - 20);
      break;
    case 'ArrowRight':
      e.preventDefault();
      ed.camX += 20;
      break;
  }
}

// ─── TOOL SWITCHING ──────────────────────────────────────────────
function setTool(name) {
  ed.tool       = name;
  ed.placing    = false;
  ed.placingObj = null;
  document.querySelectorAll('.tool-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === name);
  });
  document.getElementById('ed-status-tool').textContent = 'Tool: ' + name;
}

// ─── PROPERTIES PANEL ────────────────────────────────────────────
// [key, label, min, max, step]
const PROP_FIELDS = {
  ground:      [['x','X',0,2400,10],['y','Y',0,400,10],['w','Width',10,800,10],['h','Height',4,40,2]],
  platform:    [['x','X',0,2400,10],['y','Y',0,400,10],['w','Width',10,400,10],['h','Height',4,30,2]],
  crumble:     [['x','X',0,2400,10],['y','Y',0,400,10],['w','Width',10,400,10],['h','Height',4,30,2]],
  moving:      [['x','X',0,2400,10],['y','Y',0,400,10],['w','Width',10,400,10],['h','Height',4,30,2],
                ['oy','Rest Y',0,400,10],['range','Range',10,200,5],['freq','Speed',0.1,3,0.05]],
  fan:         [['x','X',0,2400,10],['y','Y',0,400,10]],
  antenna:     [['x','X',0,2400,10],['y','Y',0,400,10],['h','Height',20,120,5]],
  pigeon:      [['x','X',0,2400,10],['y','Y',0,400,10]],
  steam:       [['x','X',0,2400,10],['y','Y',0,400,10],['h','Height',20,120,5],['period','Period (s)',0.5,5,0.1]],
  clothesline: [['x','X',0,2400,10],['y','Y',0,400,10],['w','Width',40,800,10]],
};

function updatePropsPanel() {
  const panel = document.getElementById('ed-props-content');
  if (!ed.selected) {
    panel.innerHTML = '<p id="ed-no-sel">Nothing selected.<br><br>Click an object<br>to select it.</p>';
    document.getElementById('ed-status-obj').textContent = 'No selection';
    return;
  }
  const obj    = ed.selected;
  const fields = PROP_FIELDS[obj.type] || [];
  panel.innerHTML =
    `<p class="prop-type-label">${obj.type.toUpperCase()}</p>` +
    fields.map(([key, label, min, max, step]) => {
      const val = obj[key] ?? 0;
      const disp = step < 1 ? val.toFixed(2) : Math.round(val);
      return `<label class="prop-row">
        <span>${label}</span>
        <input type="number" class="prop-input" data-key="${key}"
               value="${disp}" min="${min}" max="${max}" step="${step}">
      </label>`;
    }).join('');

  panel.querySelectorAll('.prop-input').forEach(inp => {
    inp.addEventListener('change', e => {
      const key = e.target.dataset.key;
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        ed.selected[key] = val;
        if (key === 'oy') ed.selected._oyManual = true;
        if (key === 'y' && ed.selected.type === 'moving' && !ed.selected._oyManual) {
          ed.selected.oy = val;
          updatePropsPanel(); // refresh oy field
        }
      }
    });
  });
  updateStatusObj();
}

function updateStatusObj() {
  const s = ed.selected;
  if (s) {
    document.getElementById('ed-status-obj').textContent =
      `${s.type}  x:${s.x}  y:${s.y}  w:${s.w}  h:${s.h}`;
  }
}

// ─── SERIALIZATION ───────────────────────────────────────────────
function serializeChunk() {
  return {
    version: 1,
    width: ed.chunkWidth,
    platforms: ed.platforms.map(p => {
      const out = { type: p.type, x: p.x, y: p.y, w: p.w, h: p.h };
      if (p.type === 'moving') {
        out.oy    = p.oy    ?? p.y;
        out.range = p.range ?? 55;
        out.freq  = p.freq  ?? 0.55;
      }
      return out;
    }),
    hazards: ed.hazards.map(h => {
      const out = { type: h.type, x: h.x, y: h.y, w: h.w, h: h.h };
      if (h.type === 'steam')  out.period = h.period ?? 2.2;
      if (h.type === 'pigeon') out.vx     = h.vx     ?? -2;
      return out;
    }),
  };
}

function deserializeChunk(data) {
  ed.chunkWidth = data.width ?? 600;
  document.getElementById('inp-chunk-w').value = ed.chunkWidth;
  ed.platforms = (data.platforms || []).map(p => ({
    ...p, t: 0,
    crumbling: p.type === 'crumble' ? false     : undefined,
    crumbleT:  p.type === 'crumble' ? 0         : undefined,
    moving:    p.type === 'moving'  ? true       : undefined,
  }));
  ed.hazards = (data.hazards || []).map(h => ({ ...h, t: 0 }));
  ed.selected      = null;
  ed.selectionType = null;
  ed.camX          = 0;
  updatePropsPanel();
}

// ─── NEW / SAVE / LOAD ───────────────────────────────────────────
function newChunk() {
  if ((ed.platforms.length > 0 || ed.hazards.length > 0) &&
      !confirm('Discard current chunk and start fresh?')) return;
  ed.platforms     = [{ type: 'ground', x: 0, y: GROUND_Y, w: 600, h: 20 }];
  ed.hazards       = [];
  ed.chunkWidth    = 600;
  ed.selected      = null;
  ed.selectionType = null;
  ed.camX          = 0;
  document.getElementById('inp-chunk-w').value = 600;
  updatePropsPanel();
}

function saveChunk() {
  let name = (prompt('Save chunk as:', 'my-chunk') || '').trim();
  if (!name) return;
  name = name.replace(/[^a-zA-Z0-9_\-]/g, '_');
  localStorage.setItem('rr_editor_chunk_' + name, JSON.stringify(serializeChunk()));
  populateLoadDropdown();
  alert(`Saved as "${name}"`);
}

function loadChunkNamed(name) {
  const raw = localStorage.getItem('rr_editor_chunk_' + name);
  if (!raw) return;
  try   { deserializeChunk(JSON.parse(raw)); }
  catch (e) { alert('Failed to load: ' + e.message); }
}

function deleteSavedChunk() {
  const name = document.getElementById('sel-load').value;
  if (!name) return;
  if (!confirm(`Delete saved chunk "${name}"?`)) return;
  localStorage.removeItem('rr_editor_chunk_' + name);
  populateLoadDropdown();
}

function populateLoadDropdown() {
  const sel = document.getElementById('sel-load');
  sel.innerHTML = '<option value="">Load saved…</option>';
  Object.keys(localStorage)
    .filter(k => k.startsWith('rr_editor_chunk_'))
    .sort()
    .forEach(k => {
      const name = k.replace('rr_editor_chunk_', '');
      const opt  = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
}

// ─── EXPORT / IMPORT / TEST ──────────────────────────────────────
function exportJSON() {
  const json = JSON.stringify(serializeChunk(), null, 2);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(json)
      .then(() => alert('JSON copied to clipboard!'))
      .catch(() => showModal(json, true));
  } else {
    showModal(json, true);
  }
}

function importJSON() { showModal('', false); }

function showModal(text, readOnly) {
  document.getElementById('ed-modal-title').textContent = readOnly ? 'Exported JSON (copy it)' : 'Import JSON';
  const ta    = document.getElementById('ed-import-ta');
  ta.value    = text;
  ta.readOnly = readOnly;
  document.getElementById('ed-modal-overlay').classList.remove('hidden');
  if (!readOnly) setTimeout(() => ta.focus(), 50);
}

function confirmImport() {
  const raw = document.getElementById('ed-import-ta').value.trim();
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data.platforms) || !Array.isArray(data.hazards) ||
        typeof data.width !== 'number') {
      throw new Error('Missing required fields: platforms, hazards, width');
    }
    deserializeChunk(data);
    document.getElementById('ed-modal-overlay').classList.add('hidden');
  } catch (e) { alert('Invalid JSON: ' + e.message); }
}

function testInGame() {
  const data = serializeChunk();
  if (data.platforms.length === 0 && data.hazards.length === 0) {
    if (!confirm('Chunk is empty — test anyway?')) return;
  }
  localStorage.setItem('rr_test_chunk', JSON.stringify(data));
  window.open('index.html?test=1', '_blank');
}

// ─── UI EVENT BINDING ────────────────────────────────────────────
function bindUIEvents() {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });

  document.getElementById('chk-grid').addEventListener('change', e => {
    ed.gridSnap = e.target.checked;
  });

  document.getElementById('inp-chunk-w').addEventListener('change', e => {
    const v = parseInt(e.target.value);
    ed.chunkWidth   = isNaN(v) ? 600 : Math.max(300, Math.min(2400, v));
    e.target.value  = ed.chunkWidth;
  });

  document.getElementById('btn-new').addEventListener('click', newChunk);
  document.getElementById('btn-save').addEventListener('click', saveChunk);
  document.getElementById('btn-delete-saved').addEventListener('click', deleteSavedChunk);

  document.getElementById('sel-load').addEventListener('change', e => {
    if (e.target.value) { loadChunkNamed(e.target.value); e.target.value = ''; }
  });

  document.getElementById('btn-export').addEventListener('click', exportJSON);
  document.getElementById('btn-import').addEventListener('click', importJSON);
  document.getElementById('btn-test').addEventListener('click', testInGame);

  document.getElementById('btn-import-confirm').addEventListener('click', confirmImport);
  document.getElementById('btn-import-cancel').addEventListener('click', () => {
    document.getElementById('ed-modal-overlay').classList.add('hidden');
  });
}

function bindCanvasEvents() {
  ed.canvas.addEventListener('mousedown',   onMouseDown);
  ed.canvas.addEventListener('mousemove',   onMouseMove);
  ed.canvas.addEventListener('mouseup',     onMouseUp);
  ed.canvas.addEventListener('wheel',       onWheel, { passive: false });
  ed.canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKeyDown);
  // Stop panning if mouse leaves window while held
  window.addEventListener('mouseup', () => { ed.panning = false; ed.draggingBoundary = false; });
}

// ─── CANVAS SIZING ───────────────────────────────────────────────
// The canvas is kept at 800×400 logical; CSS scales to fit container.
// We use a ResizeObserver to keep height proportional to container width.
function fitCanvas() {
  const wrap = document.getElementById('ed-canvas-wrap');
  const w    = wrap.clientWidth;
  const h    = wrap.clientHeight;
  // Compute display size maintaining 2:1 ratio
  let dw = w, dh = w / 2;
  if (dh > h) { dh = h; dw = h * 2; }
  ed.canvas.style.width  = dw + 'px';
  ed.canvas.style.height = dh + 'px';
}

// ─── INIT ────────────────────────────────────────────────────────
function init() {
  ed.canvas        = document.getElementById('ed-canvas');
  ed.ctx           = ed.canvas.getContext('2d');
  ed.canvas.width  = LW;
  ed.canvas.height = LH;

  // Fit canvas to container, update on resize
  fitCanvas();
  new ResizeObserver(fitCanvas).observe(document.getElementById('ed-canvas-wrap'));

  populateLoadDropdown();
  newChunk();
  bindUIEvents();
  bindCanvasEvents();
  requestAnimationFrame(editorLoop);
}

init();
