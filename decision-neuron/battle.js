// === Neuron vs Neuron Battle ===

const BATTLE = {
  canvas: null,
  ctx: null,
  width: 500,
  height: 300,
  activePersonalities: [0, 1],

  PERSONALITIES: [
    {
      name: 'The Procrastinator',
      emoji: '😴',
      desc: 'Always finds a reason to nap',
      weights: { tiredness: 1.2, urgency: -0.3, workLength: -0.1, timeSinceSlept: 0.9, stress: 0.8 },
      bias: 0.6,
      color: '#6366f1',
    },
    {
      name: 'The Overachiever',
      emoji: '🔥',
      desc: 'Sleep is for the weak',
      weights: { tiredness: 0.2, urgency: -1.5, workLength: -0.9, timeSinceSlept: 0.3, stress: -0.4 },
      bias: -0.5,
      color: '#d97706',
    },
    {
      name: 'The Balanced One',
      emoji: '⚖️',
      desc: 'Listens to body and brain equally',
      weights: { tiredness: 0.85, urgency: -0.90, workLength: -0.40, timeSinceSlept: 0.75, stress: 0.50 },
      bias: 0.25,
      color: '#8b5cf6',
    },
    {
      name: 'The Night Owl',
      emoji: '🦉',
      desc: 'Thrives on stress and deadlines',
      weights: { tiredness: 0.1, urgency: -1.2, workLength: -0.7, timeSinceSlept: 0.15, stress: -0.6 },
      bias: -0.3,
      color: '#0ea5e9',
    },
    {
      name: 'The Self-Care Queen',
      emoji: '🧘',
      desc: 'Any sign of stress = nap time',
      weights: { tiredness: 1.0, urgency: -0.2, workLength: -0.15, timeSinceSlept: 0.7, stress: 1.3 },
      bias: 0.4,
      color: '#ec4899',
    },
    {
      name: 'The Robot',
      emoji: '🤖',
      desc: 'Pure deadline logic, no feelings',
      weights: { tiredness: 0.0, urgency: -2.0, workLength: -1.0, timeSinceSlept: 0.0, stress: 0.0 },
      bias: 0.0,
      color: '#64748b',
    },
  ],

  init() {
    this.canvas = document.getElementById('battle-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
  },

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
  },

  draw(state) {
    const ctx = this.ctx;
    const colors = getThemeColors();
    const W = this.width;
    const H = this.height;

    ctx.clearRect(0, 0, W, H);

    const p1 = this.PERSONALITIES[this.activePersonalities[0]];
    const p2 = this.PERSONALITIES[this.activePersonalities[1]];

    const r1 = forwardPass(state.inputs, p1.weights, p1.bias, 'sigmoid');
    const r2 = forwardPass(state.inputs, p2.weights, p2.bias, 'sigmoid');

    const centerX = W / 2;
    const centerY = H / 2;
    const neuronR = Math.min(60, H * 0.2);
    const spacing = Math.min(180, W * 0.3);

    // VS text
    ctx.font = `bold ${Math.min(18, W * 0.035)}px "Inter", sans-serif`;
    ctx.fillStyle = colors.textLight;
    ctx.textAlign = 'center';
    ctx.fillText('VS', centerX, centerY - neuronR - 30);

    // Draw each neuron
    this.drawBattleNeuron(ctx, centerX - spacing, centerY, neuronR, p1, r1, 'left');
    this.drawBattleNeuron(ctx, centerX + spacing, centerY, neuronR, p2, r2, 'right');

    // Tug-of-war bar at bottom
    const barY = H - 36;
    const barH = 14;
    const barW = W - 80;
    const barX = 40;

    // Bar background
    ctx.fillStyle = colors.cardBorder;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 7);
    ctx.fill();

    // Left fill (p1 nap probability)
    const p1Pct = r1.probability;
    const p2Pct = r2.probability;
    const totalNap = p1Pct + p2Pct;
    const leftRatio = totalNap > 0 ? p1Pct / (p1Pct + (1 - p2Pct) + p2Pct + (1 - p1Pct)) : 0.5;

    // Gradient from p1 color to p2 color
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, p1.color);
    grad.addColorStop(0.5, '#e2e8f0');
    grad.addColorStop(1, p2.color);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 7);
    ctx.fill();

    // Indicator dot showing who's winning
    const diff = r1.probability - r2.probability;
    const dotPos = barX + barW * 0.5 + (diff * barW * 0.4);
    ctx.fillStyle = diff > 0 ? p1.color : diff < 0 ? p2.color : colors.textLight;
    ctx.beginPath();
    ctx.arc(dotPos, barY + barH / 2, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.card;
    ctx.beginPath();
    ctx.arc(dotPos, barY + barH / 2, 5, 0, Math.PI * 2);
    ctx.fill();

    // Labels under bar
    ctx.font = `${Math.min(10, W * 0.02)}px "Fira Code", monospace`;
    ctx.fillStyle = colors.textLight;
    ctx.textAlign = 'left';
    ctx.fillText('More nap', barX, barY + barH + 14);
    ctx.textAlign = 'right';
    ctx.fillText('More nap', barX + barW, barY + barH + 14);

    // Agreement indicator
    const agree = r1.decision === r2.decision;
    ctx.font = `bold ${Math.min(12, W * 0.024)}px "Inter", sans-serif`;
    ctx.textAlign = 'center';
    if (agree) {
      ctx.fillStyle = '#22c55e';
      ctx.fillText(`Both say: ${r1.decision}!`, centerX, barY - 8);
    } else {
      ctx.fillStyle = '#ef4444';
      ctx.fillText('They disagree!', centerX, barY - 8);
    }
  },

  drawBattleNeuron(ctx, cx, cy, r, personality, result, side) {
    const colors = getThemeColors();
    const pct = Math.round(result.probability * 100);
    const isNap = result.decision === 'Nap';

    // Glow ring
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    ctx.fillStyle = personality.color + '18';
    ctx.fill();

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.strokeStyle = personality.color + '40';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Neuron circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = colors.card;
    ctx.fill();
    ctx.strokeStyle = personality.color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Percentage arc (fills based on probability)
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (2 * Math.PI * result.probability);
    ctx.beginPath();
    ctx.arc(cx, cy, r - 4, startAngle, endAngle);
    ctx.strokeStyle = personality.color + '50';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Percentage text
    ctx.font = `bold ${Math.min(24, r * 0.65)}px "Inter", sans-serif`;
    ctx.fillStyle = personality.color;
    ctx.textAlign = 'center';
    ctx.fillText(pct + '%', cx, cy + 4);

    // Decision below neuron
    ctx.font = `600 ${Math.min(14, r * 0.35)}px "Inter", sans-serif`;
    ctx.fillStyle = isNap ? '#6366f1' : '#d97706';
    ctx.fillText(isNap ? 'Nap' : 'Grind', cx, cy + r + 20);

    // Name above neuron
    ctx.font = `600 ${Math.min(13, r * 0.32)}px "Inter", sans-serif`;
    ctx.fillStyle = personality.color;
    ctx.fillText(personality.emoji + ' ' + personality.name, cx, cy - r - 22);

    // Tagline
    ctx.font = `italic ${Math.min(10, r * 0.25)}px "Inter", sans-serif`;
    ctx.fillStyle = colors.textLight;
    ctx.fillText(personality.desc, cx, cy - r - 8);
  },

  setPersonality(slot, index) {
    this.activePersonalities[slot] = index;
  },
};
