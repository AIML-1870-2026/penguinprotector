/* ============================================================
   Blackjack Quest — script.js
   State machine: betting → playing → dealerTurn → roundComplete
   ============================================================ */

'use strict';

// ─── CONSTANTS ──────────────────────────────────────────────
const STARTING_BALANCE = 1000;
const BET_STEP = 5;
const DEALER_DELAY = 700; // ms between dealer cards

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED_SUITS = new Set(['♥','♦']);

// Hi-Lo count values
const HI_LO = { '2':1,'3':1,'4':1,'5':1,'6':1,'7':0,'8':0,'9':0,'10':0,'J':0,'Q':0,'K':0,'A':-1 };

// Hand index helpers (supports up to 3 hands for multi-hand + split)
const HAND_CARD_IDS    = ['player-cards', 'player-cards-b', 'player-cards-c'];
const HAND_VALUE_IDS   = ['player-value',  'player-value-b',  'player-value-c'];
const HAND_HINT_IDS    = ['hint-box-a',    'hint-box-b',      'hint-box-c'];
const HAND_SECTION_IDS = ['hand-a-section','hand-b-section',  'hand-c-section'];
const HAND_LABELS      = ['Hand A', 'Hand B', 'Hand C'];

// ─── ACHIEVEMENTS ────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id: 'first_win',      icon: '🩸', title: 'First Blood',      desc: 'Win your first hand' },
  { id: 'blackjack',      icon: '🃏', title: 'Natural',          desc: 'Get a Blackjack' },
  { id: 'win_streak_5',   icon: '🔥', title: 'On a Roll',        desc: 'Win 5 hands in a row' },
  { id: 'win_streak_10',  icon: '💥', title: 'Hot Streak',       desc: 'Win 10 hands in a row' },
  { id: 'slots_777',      icon: '7️⃣', title: 'Jackpot!',         desc: 'Hit 7-7-7 on the bonus slots' },
  { id: 'hands_10',       icon: '🎯', title: 'Regular',          desc: 'Play 10 hands' },
  { id: 'hands_50',       icon: '🏅', title: 'Veteran',          desc: 'Play 50 hands' },
  { id: 'hands_100',      icon: '🏆', title: 'Centurion',        desc: 'Play 100 hands' },
  { id: 'big_win',        icon: '💰', title: 'High Roller',      desc: 'Win $200 or more in one hand' },
  { id: 'surrender_used', icon: '🏳️', title: 'Tactical Retreat', desc: 'Use Surrender for the first time' },
  { id: 'strategy_10',    icon: '📚', title: 'By the Book',      desc: 'Follow basic strategy for 10 hands in a row' },
  { id: 'comeback',       icon: '🦅', title: 'Comeback Kid',     desc: 'Win a hand when balance was under $200' },
];

let unlockedAchievements = new Set(
  JSON.parse(localStorage.getItem('bjq_achievements') || '[]')
);

// Basic strategy (simplified): [playerTotal][dealerUpcard] → action
// Returns 'H'=hit, 'S'=stand, 'D'=double, 'P'=split
function basicStrategy(playerCards, dealerUpRank, canDouble, canSplit) {
  const total = handValue(playerCards);
  const soft = isSoft(playerCards);
  const du = rankValue(dealerUpRank);

  if (canSplit && playerCards.length === 2 && rankValue(playerCards[0].rank) === rankValue(playerCards[1].rank)) {
    const r = playerCards[0].rank;
    if (r === 'A' || r === '8') return 'P';
    if ((r === '9') && ![7,10,11].includes(du)) return 'P';
    if (r === '7' && du <= 7) return 'P';
    if (r === '6' && du <= 6) return 'P';
    if (r === '4' && (du === 5 || du === 6)) return 'P';
    if ((r === '2' || r === '3') && du <= 7) return 'P';
  }

  if (soft) {
    const other = playerCards.find(c => c.rank !== 'A');
    const otherVal = other ? rankValue(other.rank) : 0;
    if (total === 20) return 'S';
    if (total === 19) return du === 6 && canDouble ? 'D' : 'S';
    if (total === 18) {
      if ([2,3,4,5,6].includes(du) && canDouble) return 'D';
      if ([7,8].includes(du)) return 'S';
      return 'H';
    }
    if (total === 17) return ([3,4,5,6].includes(du) && canDouble) ? 'D' : 'H';
    if (total >= 15) return ([4,5,6].includes(du) && canDouble) ? 'D' : 'H';
    return 'H';
  }

  if (total >= 17) return 'S';
  if (total >= 13 && du <= 6) return 'S';
  if (total === 12 && [4,5,6].includes(du)) return 'S';
  if (total === 11) return canDouble ? 'D' : 'H';
  if (total === 10 && du <= 9) return canDouble ? 'D' : 'H';
  if (total === 9 && [3,4,5,6].includes(du)) return canDouble ? 'D' : 'H';
  return 'H';
}

function strategyLabel(action) {
  return { H:'Hit', S:'Stand', D:'Double Down', P:'Split', U:'Surrender' }[action] || '';
}

// ─── ACHIEVEMENT FUNCTIONS ────────────────────────────────────
function unlockAchievement(id) {
  if (unlockedAchievements.has(id)) return;
  unlockedAchievements.add(id);
  localStorage.setItem('bjq_achievements', JSON.stringify([...unlockedAchievements]));
  const ach = ACHIEVEMENTS.find(a => a.id === id);
  if (ach) showAchievementToast(ach);
}

function showAchievementToast(ach) {
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML =
    `<div class="toast-icon">${ach.icon}</div>` +
    `<div class="toast-body"><div class="toast-label">Achievement Unlocked</div>` +
    `<strong>${ach.title}</strong><span>${ach.desc}</span></div>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 450);
  }, 3500);
}

function checkAchievements(ctx = {}) {
  const { wins, streak, streakDir } = state.stats;
  if (wins >= 1)  unlockAchievement('first_win');
  if (ctx.blackjack) unlockAchievement('blackjack');
  if (streakDir === 'win' && streak >= 5)  unlockAchievement('win_streak_5');
  if (streakDir === 'win' && streak >= 10) unlockAchievement('win_streak_10');
  if (ctx.slots777) unlockAchievement('slots_777');
  if (state.handsPlayed >= 10)  unlockAchievement('hands_10');
  if (state.handsPlayed >= 50)  unlockAchievement('hands_50');
  if (state.handsPlayed >= 100) unlockAchievement('hands_100');
  if (ctx.bigWin >= 200) unlockAchievement('big_win');
  if (ctx.surrender) unlockAchievement('surrender_used');
  if (state.strategyTracker.perfectHandStreak >= 10) unlockAchievement('strategy_10');
  if (ctx.comebackWin) unlockAchievement('comeback');
}

function renderAchievementsPanel() {
  const grid = $('achievements-grid');
  grid.innerHTML = '';
  const unlocked = ACHIEVEMENTS.filter(a => unlockedAchievements.has(a.id)).length;
  $('achievements-subtitle').textContent = `${unlocked} / ${ACHIEVEMENTS.length} unlocked`;
  ACHIEVEMENTS.forEach(ach => {
    const isUnlocked = unlockedAchievements.has(ach.id);
    const el = document.createElement('div');
    el.className = `achievement-badge ${isUnlocked ? 'unlocked' : 'locked'}`;
    el.innerHTML =
      `<div class="badge-icon">${isUnlocked ? ach.icon : '🔒'}</div>` +
      `<div class="badge-title">${ach.title}</div>` +
      `<div class="badge-desc">${isUnlocked ? ach.desc : '???'}</div>`;
    grid.appendChild(el);
  });
}

// ─── STATE ──────────────────────────────────────────────────
let state = {
  phase: 'betting',       // betting | playing | dealerTurn | roundComplete
  balance: STARTING_BALANCE,
  bet: 0,
  deck: [],
  dealerCards: [],
  playerHands: [[]],      // array of hands (multi-hand + split)
  activeHand: 0,          // which hand is being played
  numHands: 1,            // 1, 2, or 3 — multi-hand mode
  handBets: [],           // per-hand bet amounts (tracks doubles independently)
  insuranceBet: 0,
  result: null,
  muted: false,
  showHints: false,
  showCount: false,
  hiLoCount: 0,
  handsPlayed: 0,
  wasLowBalance: false,   // balance was < $200 before this round
  dailyMode: false,
  practiceMode: false,
  strategyTracker: {
    decisions: 0,
    correct: 0,
    currentHandDecisions: [],  // booleans: was each decision correct?
    perfectHandStreak: 0,       // consecutive hands where all decisions were correct
  },
  stats: {
    wins: 0, losses: 0, pushes: 0,
    biggestWin: 0,
    streak: 0,
    streakDir: null,       // 'win' | 'lose'
    history: []
  }
};

// ─── SEEDED PRNG (Daily Challenge) ───────────────────────────
function mulberry32(seed) {
  let s = seed;
  return function() {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function getDailyDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getDailySeed(dateStr) {
  return dateStr.split('').reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0);
}

function getDailyRecord() {
  return JSON.parse(localStorage.getItem(`bjq_daily_${getDailyDateStr()}`) || '{"bestBalance":0,"handsPlayed":0}');
}

function saveDailyRecord() {
  const rec = getDailyRecord();
  localStorage.setItem(`bjq_daily_${getDailyDateStr()}`, JSON.stringify({
    bestBalance: Math.max(rec.bestBalance, state.balance),
    handsPlayed: state.handsPlayed,
  }));
  saveLeaderboard();
}

let dailyRng = null;

function shuffleSeeded(deck, rng) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function startDailyChallenge() {
  const dateStr = getDailyDateStr();
  dailyRng = mulberry32(getDailySeed(dateStr));
  state.dailyMode = true;
  state.numHands = 1; // daily challenge always starts as single hand
  // Full reset for the challenge
  state.balance = STARTING_BALANCE;
  state.bet = 0;
  state.phase = 'betting';
  state.handsPlayed = 0;
  state.strategyTracker = { decisions: 0, correct: 0, currentHandDecisions: [], perfectHandStreak: 0 };
  state.stats = { wins: 0, losses: 0, pushes: 0, biggestWin: 0, streak: 0, streakDir: null, history: [] };
  $('daily-overlay').classList.add('hidden');
  $('daily-badge').classList.remove('hidden');
  elems.resultBanner.classList.add('hidden');
  resetHandSections();
  syncHandCountUI();
  setPhaseButtons('betting');
  updateDisplays();
  elems.roundStatus.textContent = '📅 Daily Challenge — place your bet!';
}

function showDailyDialog() {
  const dateStr = getDailyDateStr();
  const rec = getDailyRecord();
  $('daily-date-label').textContent = `Today: ${dateStr}`;
  const box = $('daily-record-box');
  if (rec.bestBalance > 0) {
    const net = rec.bestBalance - STARTING_BALANCE;
    const cls = net >= 0 ? 'profit' : 'loss';
    const sign = net >= 0 ? '+' : '';
    box.innerHTML =
      `Personal best: <strong>${fmt(rec.bestBalance)}</strong><br>` +
      `Net: <span class="${cls}">${sign}${fmt(net)}</span> &nbsp;·&nbsp; Hands: <strong>${rec.handsPlayed}</strong>`;
  } else {
    box.innerHTML = '<span style="color:var(--text-dim)">No record yet — be the first to set one!</span>';
  }
  $('daily-overlay').classList.remove('hidden');
}

// ─── DECK ────────────────────────────────────────────────────
function buildDeck() {
  const deck = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ suit, rank });
  return deck;
}

function shuffle(deck) {
  // Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function dealCard(hidden = false) {
  const card = state.deck.pop();
  card.hidden = hidden;
  // Update Hi-Lo count (only for visible cards)
  if (!hidden) state.hiLoCount += HI_LO[card.rank] ?? 0;
  return card;
}

// ─── HAND VALUE ──────────────────────────────────────────────
function rankValue(rank) {
  if (rank === 'A') return 11;
  if (['J','Q','K'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c.hidden) continue;
    const v = rankValue(c.rank);
    total += v;
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isSoft(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    if (c.hidden) continue;
    total += rankValue(c.rank);
    if (c.rank === 'A') aces++;
  }
  return aces > 0 && total <= 21 && (total - 10) <= 21 && total > 21 - 10 + 1;
}

function isBlackjack(cards) {
  return cards.length === 2 &&
    handValue(cards) === 21;
}

function isBust(cards) {
  return handValue(cards) > 21;
}

// ─── SOUND (Web Audio API) ────────────────────────────────────
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

function playTone(freq, duration, type = 'sine', gain = 0.15) {
  if (state.muted) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode); gainNode.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    gainNode.gain.setValueAtTime(gain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
}

function sfxDeal()  { playTone(800, 0.08, 'triangle', 0.12); }
function sfxChip()  { playTone(1200, 0.06, 'square', 0.06); }
function sfxFlip()  { playTone(600, 0.12, 'sine', 0.1); }
function sfxWin()   {
  [600, 750, 900].forEach((f, i) => setTimeout(() => playTone(f, 0.18, 'sine', 0.2), i * 100));
}
function sfxLose()  { playTone(250, 0.4, 'sawtooth', 0.15); }
function sfxPush()  { playTone(500, 0.2, 'triangle', 0.1); }
function sfxBJ()    {
  [500,700,900,1100].forEach((f,i) => setTimeout(() => playTone(f, 0.25, 'sine', 0.2), i * 80));
}
// Slot machine SFX
function sfxSlotTick()    { playTone(650 + Math.random() * 350, 0.025, 'square', 0.025); }
function sfxReelStop()    {
  playTone(240, 0.1,  'sine', 0.22);
  setTimeout(() => playTone(170, 0.08, 'sine', 0.12), 38);
}
function sfxSlotWin()     { [600,750,900,1050].forEach((f,i) => setTimeout(() => playTone(f, 0.14, 'sine', 0.16), i*75)); }
function sfxSlotBigWin()  { [500,650,800,950,1150].forEach((f,i) => setTimeout(() => playTone(f, 0.18, 'sine', 0.18), i*70)); }
function sfxSlotJackpot() {
  [300,400,500,650,800,1000,1200,1500].forEach((f,i) => setTimeout(() => playTone(f, 0.22, 'sine', 0.2), i*70));
  setTimeout(() => [700,900,1100,1300].forEach((f,i) => setTimeout(() => playTone(f, 0.15, 'triangle', 0.15), i*60)), 620);
}
function sfxSlotNoWin()   { [420,320,240].forEach((f,i) => setTimeout(() => playTone(f, 0.14, 'sawtooth', 0.08), i*120)); }

// ─── JAZZ MUSIC ───────────────────────────────────────────────
let jazzPlaying = false;
let jazzTimers  = [];

function jazzClearTimers() { jazzTimers.forEach(clearTimeout); jazzTimers = []; }

function jazzStop() { jazzPlaying = false; jazzClearTimers(); }

function jazzNote(freq, delayMs, dur, gain = 0.07, type = 'triangle') {
  const t = setTimeout(() => {
    if (!jazzPlaying || state.muted) return;
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = type; osc.frequency.value = freq;
      const now = ctx.currentTime;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gain, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.start(now); osc.stop(now + dur + 0.05);
    } catch(e) {}
  }, delayMs);
  jazzTimers.push(t);
}

// Swinging I–V jazz loop in C major @ 168 BPM
const J_Q   = Math.round(60000 / 168);
const J_BAR = J_Q * 4;
const J_E1  = Math.round(J_Q * 0.67);
const J_POS = [0, J_E1, J_Q, J_Q+J_E1, J_Q*2, J_Q*2+J_E1, J_Q*3, J_Q*3+J_E1];

function jazzScheduleBar() {
  if (!jazzPlaying) return;
  const P = J_POS;

  // ── Cmaj7 (beats 1–2) ──────────────────────────────────
  jazzNote(130.81, P[0], 0.34, 0.13);
  jazzNote(164.81, P[1], 0.24, 0.10);
  jazzNote(196.00, P[2], 0.30, 0.11);
  jazzNote(220.00, P[3], 0.22, 0.09);
  [261.63, 329.63, 392.00, 493.88].forEach(f => jazzNote(f, P[2], 0.16, 0.026));
  jazzNote(523.25, P[0], 0.28, 0.08, 'sine');
  jazzNote(659.25, P[1], 0.22, 0.07, 'sine');
  jazzNote(783.99, P[2], 0.28, 0.07, 'sine');
  jazzNote(880.00, P[3], 0.22, 0.06, 'sine');

  // ── G7 (beats 3–4) ─────────────────────────────────────
  jazzNote(98.00,  P[4], 0.34, 0.13);
  jazzNote(123.47, P[5], 0.24, 0.10);
  jazzNote(146.83, P[6], 0.30, 0.11);
  jazzNote(174.61, P[7], 0.22, 0.09);
  [196.00, 246.94, 293.66, 349.23].forEach(f => jazzNote(f, P[6], 0.16, 0.026));
  jazzNote(880.00, P[4], 0.24, 0.07, 'sine');
  jazzNote(783.99, P[5], 0.22, 0.06, 'sine');
  jazzNote(659.25, P[6], 0.28, 0.07, 'sine');
  jazzNote(523.25, P[7], 0.32, 0.08, 'sine');

  const t = setTimeout(jazzScheduleBar, J_BAR);
  jazzTimers.push(t);
}

function jazzStart() {
  if (jazzPlaying || state.muted) return;
  jazzPlaying = true;
  jazzScheduleBar();
}

// ─── DOM REFS ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const elems = {
  dealerCards:    $('dealer-cards'),
  dealerValue:    $('dealer-value'),
  playerCards:    $('player-cards'),
  playerCardsB:   $('player-cards-b'),
  playerCardsC:   $('player-cards-c'),
  playerValue:    $('player-value'),
  playerValueB:   $('player-value-b'),
  playerValueC:   $('player-value-c'),
  handBSection:   $('hand-b-section'),
  handCSection:   $('hand-c-section'),
  balanceDisplay: $('balance-display'),
  betDisplay:     $('bet-display'),
  betBig:         $('bet-big'),
  roundStatus:    $('round-status'),
  resultBanner:   $('result-banner'),
  dealBtn:        $('deal-btn'),
  clearBetBtn:    $('clear-bet-btn'),
  hitBtn:         $('hit-btn'),
  standBtn:       $('stand-btn'),
  doubleBtn:      $('double-btn'),
  splitBtn:       $('split-btn'),
  betMinus:       $('bet-minus'),
  betPlus:        $('bet-plus'),
  chips:          document.querySelectorAll('.chip'),
  muteBtn:        $('mute-btn'),
  statsPanel:     $('stats-panel'),
  statsToggleBtn: $('stats-toggle-btn'),
  statWinrate:    $('stat-winrate'),
  statBigwin:     $('stat-bigwin'),
  statStreak:     $('stat-streak'),
  historyList:    $('history-list'),
  countBar:       $('count-bar'),
  countValue:     $('count-value'),
  insuranceBar:   $('insurance-bar'),
  insuranceYes:   $('insurance-yes-btn'),
  insuranceNo:    $('insurance-no-btn'),
  hintBoxA:       $('hint-box-a'),
  hintBoxB:       $('hint-box-b'),
  hintBoxC:       $('hint-box-c'),
  hintToggle:     $('hint-toggle'),
  countToggle:    $('count-toggle'),
  settingsBtn:    $('settings-btn'),
  settingsPanel:  $('settings-panel'),
  closeSettingsBtn: $('close-settings-btn'),
  themeChips:     document.querySelectorAll('.theme-chip'),
  themeBtn:       $('theme-btn'),
  playAgainCta:   $('play-again-cta'),
  surrenderBtn:        $('surrender-btn'),
  achievementsBtn:     $('achievements-btn'),
  achievementsOverlay: $('achievements-overlay'),
  closeAchievementsBtn: $('close-achievements-btn'),
  dailyBtn:        $('daily-btn'),
  dailyOverlay:    $('daily-overlay'),
  dailyStartBtn:   $('daily-start-btn'),
  dailyCloseBtn:   $('daily-close-btn'),
  dailyBadge:      $('daily-badge'),
  statStrategy:    $('stat-strategy'),
  handCountBtns:   document.querySelectorAll('.hand-count-btn'),
  leaderboardBtn:  $('leaderboard-btn'),
};

// ─── CHIP RAIN ────────────────────────────────────────────────
const CHIP_RAIN_STYLES = [
  { bg: '#b8240a', border: '#e74c3c', color: '#fff',     label: '$5'  },
  { bg: '#1a6b3c', border: '#2ecc71', color: '#fff',     label: '$25' },
  { bg: '#1a2f6b', border: '#3498db', color: '#fff',     label: '$10' },
  { bg: '#1a1f3a', border: '#d4af37', color: '#d4af37',  label: '♠'  },
  { bg: '#7b3a0a', border: '#e67e22', color: '#fff',     label: '$50' },
  { bg: '#2c1060', border: '#9b59b6', color: '#fff',     label: '$'   },
];

function launchChipRain() {
  const container = document.createElement('div');
  container.className = 'chip-rain-container';
  document.body.appendChild(container);

  const count = 32;
  for (let i = 0; i < count; i++) {
    const chip = document.createElement('div');
    chip.className = 'chip-falling';
    const s = CHIP_RAIN_STYLES[Math.floor(Math.random() * CHIP_RAIN_STYLES.length)];
    const size = 32 + Math.random() * 22;
    const left = Math.random() * 96;
    const dur  = 1.6 + Math.random() * 1.8;
    const delay = Math.random() * 0.9;
    chip.style.cssText = [
      `left:${left}%`,
      `width:${size}px`,
      `height:${size}px`,
      `background:${s.bg}`,
      `border-color:${s.border}`,
      `color:${s.color}`,
      `font-size:${Math.round(size * 0.28)}px`,
      `animation-duration:${dur}s`,
      `animation-delay:${delay}s`,
    ].join(';');
    chip.textContent = s.label;
    container.appendChild(chip);
  }

  setTimeout(() => container.remove(), 4500);
}

// ─── SLOT MACHINE ─────────────────────────────────────────────
const SLOT_SYMS    = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'];

const SLOT_PAYOUTS = {
  '🍒': { two: 0,   three: 2    },
  '🍋': { two: 0,   three: 3    },
  '🔔': { two: 1,   three: 5    },
  '⭐': { two: 2,   three: 8    },
  '💎': { two: 4,   three: 15   },
  '7️⃣': { two: 6,   three: 25   },
};

function slotWinProb(bet) {
  if (bet <= 10)  return 0.72;
  if (bet <= 25)  return 0.60;
  if (bet <= 50)  return 0.46;
  if (bet <= 100) return 0.34;
  return 0.22;
}

function slotOddsLabel(bet) {
  if (bet <= 10)  return '72%';
  if (bet <= 25)  return '60%';
  if (bet <= 50)  return '46%';
  if (bet <= 100) return '34%';
  return '22%';
}

function slotPick(weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SLOT_SYMS.length; i++) {
    r -= weights[i];
    if (r <= 0) return SLOT_SYMS[i];
  }
  return SLOT_SYMS[0];
}

function determineSlotResults(bet) {
  const isWin = Math.random() < slotWinProb(bet);

  if (isWin) {
    const isTriple = Math.random() < 0.42;
    const winW = [6, 5, 3, 1.5, 0.4, 0.2];
    const sym = slotPick(winW);

    if (isTriple) return [sym, sym, sym];

    const others = SLOT_SYMS.filter(s => s !== sym);
    const odd = others[Math.floor(Math.random() * others.length)];
    const pos = Math.floor(Math.random() * 3);
    if (pos === 0) return [odd, sym, sym];
    if (pos === 1) return [sym, odd, sym];
    return [sym, sym, odd];
  } else {
    const shuffled = [...SLOT_SYMS].sort(() => Math.random() - 0.5);
    return [shuffled[0], shuffled[1], shuffled[2]];
  }
}

const TICK_CLASSES = ['tick-fast', 'tick-medium', 'tick-slow', 'tick-final'];

function setReelSymbol(symEl, sym, cls) {
  TICK_CLASSES.forEach(c => symEl.classList.remove(c));
  symEl.textContent = sym;
  void symEl.offsetWidth;
  symEl.classList.add(cls);
}

function animateReel(symEl, finalSym, duration, onDone) {
  const start = Date.now();
  symEl.parentElement.classList.add('reel-spinning');
  let fastCount = 0;

  function tick() {
    const remaining = duration - (Date.now() - start);

    if (remaining <= 0) {
      setReelSymbol(symEl, finalSym, 'tick-final');
      symEl.parentElement.classList.remove('reel-spinning');
      sfxReelStop();
      setTimeout(() => { if (onDone) onDone(); }, 430);
      return;
    }

    let delay, cls;
    if (remaining > 800) {
      cls = 'tick-fast'; delay = 50;
      fastCount++;
      if (fastCount % 3 === 0) sfxSlotTick();
    } else if (remaining > 350) {
      cls = 'tick-medium'; delay = 120;
      sfxSlotTick();
    } else {
      cls = 'tick-slow'; delay = 230;
      sfxSlotTick();
    }

    setReelSymbol(symEl, SLOT_SYMS[Math.floor(Math.random() * SLOT_SYMS.length)], cls);
    setTimeout(tick, delay);
  }
  tick();
}

function showSlotMachine() {
  const overlay    = $('slot-overlay');
  const subtitle   = $('slot-subtitle');
  const resultMsg  = $('slot-result-msg');
  const collectBtn = $('slot-collect-btn');
  const preSpin    = $('slot-pre-spin');
  const spinBtn    = $('slot-spin-btn');
  const skipBtn    = $('slot-skip-btn');
  const wagerInfo  = $('slot-wager-info');
  const reelEls    = [$('reel-0'), $('reel-1'), $('reel-2')];

  const sideBet    = Math.max(5, Math.round(state.bet * 0.25));
  const maxPayout  = sideBet * 25;
  const oddsLabel  = slotOddsLabel(state.bet);
  const isHighRoller = state.bet > 50;

  subtitle.textContent    = 'You won! Try your luck on the bonus slots?';
  resultMsg.className     = 'slot-result-msg hidden';
  resultMsg.textContent   = '';
  collectBtn.classList.add('hidden');
  preSpin.classList.remove('hidden');
  reelEls.forEach(el => {
    el.textContent = '🎰';
    el.classList.remove(...TICK_CLASSES);
    el.parentElement.classList.remove('reel-spinning', 'reel-matched', 'reel-matched-jackpot');
  });

  wagerInfo.innerHTML =
    `Wager <strong>${fmt(sideBet)}</strong> → win up to <strong>${fmt(maxPayout)}</strong><br>` +
    `Win odds: <strong>${oddsLabel}</strong>` +
    (isHighRoller ? `<br><span class="odds-warning">⚠ High bet — tough odds on slots!</span>` : '');

  overlay.classList.remove('hidden');

  spinBtn.onclick = () => {
    if (state.balance < sideBet) { overlay.classList.add('hidden'); return; }
    state.balance -= sideBet;
    updateDisplays();

    preSpin.classList.add('hidden');
    subtitle.textContent = 'Spinning…';

    const results = determineSlotResults(state.bet);

    animateReel(reelEls[0], results[0], 1800, () => {
      animateReel(reelEls[1], results[1], 1100, () => {
        animateReel(reelEls[2], results[2], 700, () => {
          resolveSlot(results, reelEls, subtitle, resultMsg, collectBtn, sideBet);
        });
      });
    });
  };

  skipBtn.onclick = () => { overlay.classList.add('hidden'); jazzStop(); };
}

function resolveSlot(results, reelEls, subtitle, resultMsg, collectBtn, sideBet) {
  const [a, b, c] = results;
  let payout = 0, msgClass = 'no-win', msgText = '';

  if (a === b && b === c) {
    payout = sideBet * SLOT_PAYOUTS[a].three;
    const isJackpot = a === '7️⃣' || a === '💎';
    const matchClass = isJackpot ? 'reel-matched-jackpot' : 'reel-matched';
    reelEls.forEach(el => el.parentElement.classList.add(matchClass));
    if (a === '7️⃣')      { msgClass = 'jackpot'; msgText = `💥 JACKPOT! 7️⃣7️⃣7️⃣ — +${fmt(payout)}!`; sfxSlotJackpot(); checkAchievements({ slots777: true }); }
    else if (a === '💎') { msgClass = 'jackpot'; msgText = `💎 TRIPLE DIAMONDS — +${fmt(payout)}!`; sfxSlotJackpot(); }
    else                  { msgClass = 'big-win'; msgText = `${a}${b}${c} — Triple! +${fmt(payout)}!`; sfxSlotBigWin(); }
    if (payout > 0) launchChipRain();
  } else if (a === b || b === c || a === c) {
    const paired = a === b ? a : b === c ? b : a;
    payout = sideBet * SLOT_PAYOUTS[paired].two;
    const matchIdxs = a === b ? [0,1] : b === c ? [1,2] : [0,2];
    matchIdxs.forEach(i => reelEls[i].parentElement.classList.add('reel-matched'));
    if (payout > 0) { msgClass = 'small-win'; msgText = `Pair of ${paired}! +${fmt(payout)}!`; sfxSlotWin(); }
    else            { msgText = 'So close — no bonus this time.'; sfxSlotNoWin(); }
  } else {
    msgText = `No match — lost ${fmt(sideBet)}.`;
    sfxSlotNoWin();
  }

  payout = Math.round(payout);
  state.balance += payout;
  updateDisplays();

  subtitle.textContent    = payout > 0 ? `+${fmt(payout)} added to your balance!` : `Lost ${fmt(sideBet)} on the slots.`;
  resultMsg.className     = `slot-result-msg ${msgClass}`;
  resultMsg.textContent   = msgText;
  resultMsg.classList.remove('hidden');
  collectBtn.textContent  = payout > 0 ? `Collect ${fmt(payout)}!` : 'Continue';
  collectBtn.classList.remove('hidden');
  collectBtn.onclick      = () => { $('slot-overlay').classList.add('hidden'); jazzStop(); };
}

// ─── RENDER ───────────────────────────────────────────────────
function renderCard(card) {
  const wrap = document.createElement('div');
  wrap.className = 'card-wrap';
  if (!card.hidden) wrap.classList.add('flipped');

  const inner = document.createElement('div');
  inner.className = 'card-inner';

  const back = document.createElement('div');
  back.className = 'card-back';

  const colorClass = RED_SUITS.has(card.suit) ? 'red' : 'black';
  const face = document.createElement('div');
  face.className = `card-face ${colorClass}`;

  const topCorner = document.createElement('div');
  topCorner.className = 'card-corner top';
  topCorner.innerHTML = `<span class="card-rank">${card.rank}</span><span class="card-suit-sm">${card.suit}</span>`;

  const center = document.createElement('span');
  center.className = 'card-suit-center';
  center.textContent = card.suit;

  const botCorner = document.createElement('div');
  botCorner.className = 'card-corner bottom';
  botCorner.innerHTML = `<span class="card-rank">${card.rank}</span><span class="card-suit-sm">${card.suit}</span>`;

  face.appendChild(topCorner);
  face.appendChild(center);
  face.appendChild(botCorner);

  inner.appendChild(back);
  inner.appendChild(face);
  wrap.appendChild(inner);
  return wrap;
}

function renderHand(container, cards) {
  container.innerHTML = '';
  cards.forEach(c => container.appendChild(renderCard(c)));
}

function renderHandByIndex(i) {
  const el = $(HAND_CARD_IDS[i]);
  if (el && state.playerHands[i]) renderHand(el, state.playerHands[i]);
}

function flipCard(container, index) {
  const wraps = container.querySelectorAll('.card-wrap');
  if (wraps[index]) {
    wraps[index].classList.add('flipped');
    sfxFlip();
  }
}

// Highlight the currently active hand with a glow
function highlightActiveHand() {
  HAND_SECTION_IDS.forEach((id, i) => {
    const el = $(id);
    if (el) el.classList.toggle('hand-active', state.phase === 'playing' && i === state.activeHand);
  });
}

// Show/hide extra hand sections based on how many are in play
function resetHandSections() {
  $('hand-b-section').classList.add('hidden');
  $('hand-c-section').classList.add('hidden');
}

function updateDisplays() {
  // Balance
  elems.balanceDisplay.textContent = fmt(state.balance);
  // Bet — show multiplier when multi-hand
  const betStr = fmt(state.bet);
  elems.betDisplay.textContent = state.numHands > 1 ? `${state.numHands}×${betStr}` : betStr;
  elems.betBig.textContent = betStr;
  // Dealer value (hide hidden card value)
  const visibleDealer = state.dealerCards.filter(c => !c.hidden);
  elems.dealerValue.textContent = visibleDealer.length ? handValue(visibleDealer) : '';
  // All player hand values
  for (let i = 0; i < 3; i++) {
    const valEl = $(HAND_VALUE_IDS[i]);
    if (!valEl) continue;
    if (state.playerHands[i] && state.playerHands[i].length > 0) {
      valEl.textContent = handValue(state.playerHands[i]);
    } else {
      valEl.textContent = i === 0 ? '0' : '';
    }
  }
  // Count
  elems.countValue.textContent = state.hiLoCount;
  // Hints
  updateHints();
  // Stats
  updateStatsPanel();
}

function updateHints() {
  if (!state.showHints || state.phase !== 'playing') {
    HAND_HINT_IDS.forEach(id => { const el = $(id); if (el) el.classList.add('hidden'); });
    return;
  }
  const du = state.dealerCards.find(c => !c.hidden);
  if (!du) return;

  // Show hint only for the currently active hand
  HAND_HINT_IDS.forEach((id, i) => {
    const box = $(id);
    if (!box) return;
    const hand = state.playerHands[i];
    if (!hand || hand.length === 0 || i !== state.activeHand) {
      box.classList.add('hidden');
      return;
    }
    const curBet   = state.handBets[i] !== undefined ? state.handBets[i] : state.bet;
    const canDouble  = hand.length === 2 && curBet <= state.balance;
    const canSplit   = hand.length === 2 &&
      rankValue(hand[0].rank) === rankValue(hand[1].rank) &&
      curBet <= state.balance &&
      !state.playerHands[1] &&
      state.numHands === 1;
    const action = basicStrategy(hand, du.rank, canDouble, canSplit);
    box.textContent = `Hint: ${strategyLabel(action)}`;
    box.classList.remove('hidden');
  });
}

function renderAll() {
  renderHand(elems.dealerCards, state.dealerCards);
  for (let i = 0; i < state.playerHands.length; i++) {
    renderHandByIndex(i);
  }
  highlightActiveHand();
  updateDisplays();
}

// ─── STRATEGY TRACKING ───────────────────────────────────────
function shouldSurrender(playerCards, dealerUpRank) {
  if (playerCards.length !== 2) return false;
  if (isSoft(playerCards)) return false;
  const total = handValue(playerCards);
  const du = rankValue(dealerUpRank);
  if (total === 16 && [9, 10, 11].includes(du)) return true;
  if (total === 15 && du === 10) return true;
  return false;
}

function getCorrectAction() {
  if (state.phase !== 'playing') return null;
  const hand = state.playerHands[state.activeHand];
  const du = state.dealerCards.find(c => !c.hidden);
  if (!hand || hand.length === 0 || !du) return null;

  const curBet      = state.handBets[state.activeHand] !== undefined ? state.handBets[state.activeHand] : state.bet;
  const canDouble   = hand.length === 2 && curBet <= state.balance;
  const canSplit    = hand.length === 2 &&
    rankValue(hand[0].rank) === rankValue(hand[1].rank) &&
    curBet <= state.balance && !state.playerHands[1] &&
    state.numHands === 1;
  const canSurrender = hand.length === 2 && !state.playerHands[1] && state.numHands === 1;

  if (canSplit) {
    const splitAction = basicStrategy(hand, du.rank, canDouble, true);
    if (splitAction === 'P') return 'P';
  }
  if (canSurrender && shouldSurrender(hand, du.rank)) return 'U';
  return basicStrategy(hand, du.rank, canDouble, false);
}

function logStrategyDecision(playerAction) {
  const correct = getCorrectAction();
  if (correct === null) return;
  const isCorrect = correct === playerAction;
  state.strategyTracker.decisions++;
  if (isCorrect) state.strategyTracker.correct++;
  state.strategyTracker.currentHandDecisions.push(isCorrect);
}

function recordStrategyHand() {
  const decisions = state.strategyTracker.currentHandDecisions;
  if (decisions.length > 0) {
    if (decisions.every(d => d)) state.strategyTracker.perfectHandStreak++;
    else state.strategyTracker.perfectHandStreak = 0;
  }
  state.strategyTracker.currentHandDecisions = [];
}

function updateStatsPanel() {
  const { wins, losses, pushes, biggestWin, streak, streakDir, history } = state.stats;
  const total = wins + losses + pushes;
  elems.statWinrate.textContent = total ? `${Math.round(wins/total*100)}%` : '—';
  elems.statBigwin.textContent = fmt(biggestWin);
  const sign = streakDir === 'win' ? '+' : streakDir === 'lose' ? '-' : '';
  elems.statStreak.textContent = streak ? `${sign}${streak}` : '0';

  const { decisions, correct } = state.strategyTracker;
  elems.statStrategy.textContent = decisions > 0
    ? `${Math.round(correct / decisions * 100)}% (${correct}/${decisions})`
    : '—';

  elems.historyList.innerHTML = '';
  [...history].reverse().slice(0, 10).forEach(r => {
    const div = document.createElement('div');
    div.className = `history-item ${r.outcome}`;
    div.textContent = `${r.outcome.toUpperCase()}  ${r.net >= 0 ? '+' : ''}${fmt(r.net)}`;
    elems.historyList.appendChild(div);
  });
}

function fmt(n) { return '$' + n.toLocaleString(); }

// ─── BUTTON STATES ─────────────────────────────────────────────
function setPhaseButtons(phase) {
  const isBetting = phase === 'betting';
  const isPlaying = phase === 'playing';
  const isDone    = phase === 'roundComplete';

  elems.chips.forEach(c => c.disabled = !(isBetting || isDone));
  elems.betMinus.disabled = !(isBetting || isDone);
  elems.betPlus.disabled  = !(isBetting || isDone);

  // Hand count selector — only available when not mid-round
  elems.handCountBtns.forEach(b => b.disabled = !(isBetting || isDone));

  elems.dealBtn.disabled     = !(isBetting && state.bet > 0) && !isDone;
  elems.clearBetBtn.disabled = !(isBetting || isDone);
  elems.hitBtn.disabled      = !isPlaying;
  elems.standBtn.disabled    = !isPlaying;

  elems.dealBtn.textContent = isDone ? 'Deal Again (D)' : 'Deal (D)';

  if (isDone) {
    elems.dealBtn.disabled = false;
    elems.clearBetBtn.disabled = false;
    elems.dealBtn.classList.add('deal-pulse');
    elems.playAgainCta.classList.remove('hidden');
  } else {
    elems.dealBtn.classList.remove('deal-pulse');
    elems.playAgainCta.classList.add('hidden');
  }

  updateDoubleAndSplit();
}

function updateDoubleAndSplit() {
  const isPlaying = state.phase === 'playing';
  const hand = state.playerHands[state.activeHand];
  const isFirstTwo = hand && hand.length === 2;
  const curBet = state.handBets[state.activeHand] !== undefined
    ? state.handBets[state.activeHand]
    : state.bet;

  elems.doubleBtn.disabled = !(isPlaying && isFirstTwo && curBet <= state.balance);

  // Split only in single-hand mode (not multi-hand — too complex with 3 spots)
  elems.splitBtn.disabled = !(
    isPlaying &&
    state.numHands === 1 &&
    isFirstTwo &&
    hand && rankValue(hand[0].rank) === rankValue(hand[1].rank) &&
    curBet <= state.balance &&
    !state.playerHands[1]
  );

  // Surrender only in single-hand mode on original 2-card deal
  elems.surrenderBtn.disabled = !(isPlaying && isFirstTwo && state.numHands === 1 && !state.playerHands[1]);
}

// ─── GAME FLOW ─────────────────────────────────────────────────
function startRound() {
  if (state.bet === 0) return;
  jazzStop();

  // Track low balance before this round
  state.wasLowBalance = (state.balance + state.bet * state.numHands) < 200;

  // Reset for new round
  state.deck = (state.dailyMode && dailyRng) ? shuffleSeeded(buildDeck(), dailyRng) : shuffle(buildDeck());
  state.dealerCards = [];
  state.playerHands = Array.from({ length: state.numHands }, () => []);
  state.handBets    = Array(state.numHands).fill(state.bet);
  state.activeHand  = 0;
  state.insuranceBet = 0;
  state.result = null;
  state.hiLoCount = 0;
  state.strategyTracker.currentHandDecisions = [];

  // Hide UI elements
  elems.resultBanner.classList.add('hidden');
  elems.insuranceBar.classList.add('hidden');
  resetHandSections();
  HAND_HINT_IDS.forEach(id => { const el = $(id); if (el) el.classList.add('hidden'); });

  // Round-robin deal: player hands first, then dealer, repeat
  for (let i = 0; i < state.numHands; i++) state.playerHands[i].push(dealCard());
  state.dealerCards.push(dealCard());
  for (let i = 0; i < state.numHands; i++) state.playerHands[i].push(dealCard());
  state.dealerCards.push(dealCard(true)); // face-down

  state.phase = 'playing';
  setPhaseButtons('playing');

  // Show extra hand sections for multi-hand
  if (state.numHands >= 2) $('hand-b-section').classList.remove('hidden');
  if (state.numHands >= 3) $('hand-c-section').classList.remove('hidden');

  renderAll();
  sfxDeal();

  // Auto-resolve blackjack only in single-hand mode
  if (state.numHands === 1 && isBlackjack(state.playerHands[0])) {
    revealAndResolve();
    return;
  }

  // Insurance offer — only single-hand
  const dealerUp = state.dealerCards[0];
  if (state.numHands === 1 && dealerUp.rank === 'A' && state.balance > 0) {
    elems.insuranceBar.classList.remove('hidden');
  }

  elems.roundStatus.textContent = state.numHands > 1
    ? `Playing ${HAND_LABELS[0]}`
    : 'Hit, Stand, Double, or Split?';
  updateDisplays();
}

function renderAll() {
  renderHand(elems.dealerCards, state.dealerCards);
  for (let i = 0; i < state.playerHands.length; i++) renderHandByIndex(i);
  highlightActiveHand();
  updateDisplays();
}

// ─── PLAYER ACTIONS ────────────────────────────────────────────
function hit() {
  if (state.phase !== 'playing') return;
  if (tutorialState.active && tutorialState.waitingFor === 'play') tutorialState.waitingFor = 'result';
  logStrategyDecision('H');
  const hand = state.playerHands[state.activeHand];
  hand.push(dealCard());
  renderAll();
  sfxDeal();

  if (isBust(hand)) {
    if (state.activeHand + 1 < state.playerHands.length) {
      nextHand();
    } else {
      endPlayerTurn();
    }
  } else {
    updateDoubleAndSplit();
    elems.doubleBtn.disabled = true; // can only double on first two cards
    elems.splitBtn.disabled  = true;
  }
}

function stand() {
  if (state.phase !== 'playing') return;
  if (tutorialState.active && tutorialState.waitingFor === 'play') tutorialState.waitingFor = 'result';
  logStrategyDecision('S');
  if (state.activeHand + 1 < state.playerHands.length) {
    nextHand();
  } else {
    endPlayerTurn();
  }
}

function doubleDown() {
  if (state.phase !== 'playing') return;
  if (tutorialState.active && tutorialState.waitingFor === 'play') tutorialState.waitingFor = 'result';
  const hand = state.playerHands[state.activeHand];
  if (hand.length !== 2) return;
  const curBet = state.handBets[state.activeHand] !== undefined
    ? state.handBets[state.activeHand]
    : state.bet;
  if (curBet > state.balance) return;
  logStrategyDecision('D');
  state.balance -= curBet;
  state.handBets[state.activeHand] = curBet * 2;
  updateDisplays();
  hand.push(dealCard());
  renderAll();
  sfxChip();
  sfxDeal();
  // After doubling, advance to next hand or end turn
  if (state.activeHand + 1 < state.playerHands.length) {
    nextHand();
  } else {
    endPlayerTurn();
  }
}

function split() {
  if (state.phase !== 'playing') return;
  if (state.numHands !== 1) return; // split only in single-hand mode
  const hand = state.playerHands[0];
  if (hand.length !== 2 || rankValue(hand[0].rank) !== rankValue(hand[1].rank)) return;
  const curBet = state.handBets[0] !== undefined ? state.handBets[0] : state.bet;
  if (curBet > state.balance) return;
  logStrategyDecision('P');
  state.balance -= curBet;
  const cardB = hand.splice(1, 1)[0];
  state.playerHands[1] = [cardB];
  state.handBets[1] = curBet; // hand B starts with same bet as hand A
  sfxChip();

  // Deal one card to hand A
  state.playerHands[0].push(dealCard());
  // Aces only get one card each
  if (hand[0].rank === 'A') {
    state.playerHands[1].push(dealCard());
  }

  $('hand-b-section').classList.remove('hidden');
  renderHand(elems.playerCards, state.playerHands[0]);
  renderHand(elems.playerCardsB, state.playerHands[1]);
  sfxDeal();

  // If aces, auto-stand both
  if (hand[0].rank === 'A') {
    endPlayerTurn();
    return;
  }

  state.activeHand = 0;
  highlightActiveHand();
  updateDisplays();
  updateDoubleAndSplit();
}

function surrender() {
  if (state.phase !== 'playing') return;
  const hand = state.playerHands[state.activeHand];
  if (hand.length !== 2 || state.playerHands[1] || state.numHands !== 1) return;

  logStrategyDecision('U');

  const returned = Math.floor(state.bet / 2);
  state.balance += returned;
  state.phase = 'roundComplete';
  state.handsPlayed++;

  recordStrategyHand();

  state.stats.losses++;
  if (state.stats.streakDir === 'lose') state.stats.streak++;
  else { state.stats.streak = 1; state.stats.streakDir = 'lose'; }
  state.stats.history.push({ outcome: 'surrender', bet: state.bet, net: -returned });
  if (state.stats.history.length > 20) state.stats.history.shift();

  setPhaseButtons('roundComplete');
  elems.insuranceBar.classList.add('hidden');
  highlightActiveHand(); // clears active highlight

  const banner = elems.resultBanner;
  banner.className = 'result-banner push';
  banner.textContent = `Surrender — ${fmt(returned)} returned`;
  banner.classList.remove('hidden');
  elems.roundStatus.textContent = 'Place your bet to play again';

  const balEl = elems.balanceDisplay;
  balEl.classList.remove('balance-up', 'balance-down');
  void balEl.offsetWidth;
  balEl.classList.add('balance-down');

  sfxLose();
  checkAchievements({ surrender: true });
  if (state.dailyMode) saveDailyRecord();
  updateDisplays();

  if (state.balance <= 0) {
    if (state.practiceMode) {
      setTimeout(refillPracticeBalance, 900);
    } else {
      setTimeout(() => $('broke-overlay').classList.remove('hidden'), 900);
    }
  }
}

function nextHand() {
  const next = state.activeHand + 1;
  if (next >= state.playerHands.length) {
    endPlayerTurn();
    return;
  }
  state.activeHand = next;
  const hand = state.playerHands[state.activeHand];
  if (!hand || hand.length === 0) {
    endPlayerTurn();
    return;
  }
  // Deal a second card if this hand only has one (split scenario)
  if (hand.length === 1) {
    if (!state.handBets[state.activeHand]) state.handBets[state.activeHand] = state.bet;
    hand.push(dealCard());
    renderHandByIndex(state.activeHand);
    sfxDeal();
  }
  highlightActiveHand();
  updateDisplays();
  updateDoubleAndSplit();
  elems.roundStatus.textContent = `Playing ${HAND_LABELS[state.activeHand] || `Hand ${state.activeHand + 1}`}`;
}

function endPlayerTurn() {
  state.phase = 'dealerTurn';
  setPhaseButtons('dealerTurn');
  elems.insuranceBar.classList.add('hidden');
  highlightActiveHand(); // clears active highlight
  runDealerTurn();
}

// ─── DEALER TURN ───────────────────────────────────────────────
function revealAndResolve() {
  state.dealerCards[1].hidden = false;
  state.hiLoCount += HI_LO[state.dealerCards[1].rank] ?? 0;
  renderHand(elems.dealerCards, state.dealerCards);
  setTimeout(() => flipCard(elems.dealerCards, 1), 50);
  sfxFlip();
  resolveRound();
}

function runDealerTurn() {
  elems.roundStatus.textContent = "Dealer's turn…";

  state.dealerCards[1].hidden = false;
  state.hiLoCount += HI_LO[state.dealerCards[1].rank] ?? 0;
  renderHand(elems.dealerCards, state.dealerCards);
  setTimeout(() => flipCard(elems.dealerCards, 1), 50);
  sfxFlip();

  setTimeout(dealerDraw, DEALER_DELAY);
}

function dealerDraw() {
  const dv = handValue(state.dealerCards);
  if (dv < 17) {
    state.dealerCards.push(dealCard());
    renderHand(elems.dealerCards, state.dealerCards);
    setTimeout(() => flipCard(elems.dealerCards, state.dealerCards.length - 1), 50);
    sfxDeal();
    setTimeout(dealerDraw, DEALER_DELAY);
  } else {
    resolveRound();
  }
}

// ─── RESOLVE ───────────────────────────────────────────────────
function resolveRound() {
  state.phase = 'roundComplete';
  setPhaseButtons('roundComplete');

  const dealerBJ   = isBlackjack(state.dealerCards);
  const dealerBust = isBust(state.dealerCards);
  const dv         = handValue(state.dealerCards);

  // Resolve insurance first
  if (state.insuranceBet > 0) {
    if (dealerBJ) {
      state.balance += state.insuranceBet * 2; // 2:1 payout + return of bet
    }
  }

  // Resolve each hand using its own bet amount
  const results = [];
  state.playerHands.forEach((hand, i) => {
    if (hand.length === 0) return;
    const handBet  = state.handBets[i] !== undefined ? state.handBets[i] : state.bet;
    const pv       = handValue(hand);
    // BJ only counts on single un-split hand
    const playerBJ   = isBlackjack(hand) && i === 0 && !state.playerHands[1] && state.numHands === 1;
    const playerBust = isBust(hand);

    let outcome, net;

    if (playerBust) {
      outcome = 'lose'; net = -handBet;
    } else if (dealerBJ && playerBJ) {
      outcome = 'push'; net = 0;
    } else if (dealerBJ) {
      outcome = 'lose'; net = -handBet;
    } else if (playerBJ) {
      const bjWin = Math.floor(handBet * 1.5);
      outcome = 'blackjack'; net = bjWin;
      state.balance += handBet + bjWin;
    } else if (dealerBust) {
      outcome = 'win'; net = handBet;
      state.balance += handBet * 2;
    } else if (pv > dv) {
      outcome = 'win'; net = handBet;
      state.balance += handBet * 2;
    } else if (pv === dv) {
      outcome = 'push'; net = 0;
      state.balance += handBet;
    } else {
      outcome = 'lose'; net = -handBet;
    }

    results.push({ outcome, net });
  });

  showResult(results[0].outcome, results);
  recordStats(results);

  elems.dealerValue.textContent = handValue(state.dealerCards);
  updateDisplays();

  if (state.balance <= 0) {
    if (state.practiceMode) {
      setTimeout(refillPracticeBalance, 900);
    } else {
      setTimeout(() => $('broke-overlay').classList.remove('hidden'), 900);
    }
  }
}

function showResult(outcome, results) {
  const banner = elems.resultBanner;
  banner.className = 'result-banner';

  const netTotal = results.reduce((s, r) => s + r.net, 0);
  let label = '';

  if (results.length > 1) {
    // Multi-hand or split — label each hand
    label = results.map((r, i) =>
      `${HAND_LABELS[i] || `Hand ${i+1}`}: ${r.outcome.toUpperCase()}`
    ).join('  |  ');
    banner.classList.add(netTotal > 0 ? 'win' : netTotal < 0 ? 'lose' : 'push');
    // Sound + effects for multi-hand based on net
    if (netTotal > 0) { sfxWin(); launchChipRain(); jazzStart(); if (!state.practiceMode) setTimeout(showSlotMachine, 900); }
    else if (netTotal < 0) sfxLose();
    else sfxPush();
  } else {
    switch(outcome) {
      case 'blackjack': label = 'Blackjack! 🃏'; banner.classList.add('bj'); sfxBJ(); launchChipRain(); jazzStart(); if (!state.practiceMode) setTimeout(showSlotMachine, 900); break;
      case 'win':       label = 'You Win!';      banner.classList.add('win'); sfxWin(); launchChipRain(); jazzStart(); if (!state.practiceMode) setTimeout(showSlotMachine, 900); break;
      case 'lose':      label = 'Dealer Wins';   banner.classList.add('lose'); sfxLose(); break;
      case 'push':      label = 'Push — Tie';    banner.classList.add('push'); sfxPush(); break;
    }
  }

  banner.textContent = label;
  banner.classList.remove('hidden');
  elems.roundStatus.textContent = 'Place your bet to play again';

  // Animate balance
  const balEl = elems.balanceDisplay;
  balEl.classList.remove('balance-up', 'balance-down');
  void balEl.offsetWidth;
  if (netTotal > 0) balEl.classList.add('balance-up');
  else if (netTotal < 0) balEl.classList.add('balance-down');

  // Tutorial: advance to result step after outcome shown
  if (tutorialState.active && tutorialState.waitingFor === 'result') {
    tutorialState.waitingFor = null;
    setTimeout(advanceTutorial, 700);
  }
}

function recordStats(results) {
  const net = results.reduce((s, r) => s + r.net, 0);

  state.handsPlayed++;
  recordStrategyHand();

  // Determine overall outcome by net
  const hasBJ  = results[0].outcome === 'blackjack';
  let primaryOutcome;
  if (net > 0)      primaryOutcome = hasBJ ? 'blackjack' : 'win';
  else if (net < 0) primaryOutcome = 'lose';
  else              primaryOutcome = 'push';

  const isWin = primaryOutcome === 'win' || primaryOutcome === 'blackjack';

  if (isWin) {
    state.stats.wins++;
    if (net > state.stats.biggestWin) state.stats.biggestWin = net;
    if (state.stats.streakDir === 'win') state.stats.streak++;
    else { state.stats.streak = 1; state.stats.streakDir = 'win'; }
  } else if (primaryOutcome === 'lose') {
    state.stats.losses++;
    if (state.stats.streakDir === 'lose') state.stats.streak++;
    else { state.stats.streak = 1; state.stats.streakDir = 'lose'; }
  } else {
    state.stats.pushes++;
    state.stats.streak = 0; state.stats.streakDir = null;
  }

  state.stats.history.push({
    outcome: primaryOutcome === 'blackjack' ? 'win' : primaryOutcome,
    bet: state.bet,
    net
  });
  if (state.stats.history.length > 20) state.stats.history.shift();

  checkAchievements({
    blackjack:   hasBJ,
    bigWin:      isWin ? net : 0,
    comebackWin: isWin && state.wasLowBalance,
  });

  if (state.dailyMode) saveDailyRecord();
}

// ─── BETTING ───────────────────────────────────────────────────
function addBet(amount) {
  if (state.phase !== 'betting' && state.phase !== 'roundComplete') return;
  // Cap per-hand bet so total doesn't exceed balance
  const maxPerHand = state.numHands > 1 ? Math.floor(state.balance / state.numHands) : state.balance;
  state.bet = Math.min(state.bet + amount, maxPerHand);
  sfxChip();
  updateDisplays();
  elems.dealBtn.disabled = state.bet === 0;
  // Tutorial hook — advance when first bet is placed
  if (tutorialState.active && tutorialState.waitingFor === 'bet' && state.bet > 0) {
    tutorialState.waitingFor = null;
    setTimeout(advanceTutorial, 400);
  }
}

function clearBet() {
  state.bet = 0;
  if (state.phase === 'roundComplete') {
    state.phase = 'betting';
    elems.resultBanner.classList.add('hidden');
    resetHandSections();
    setPhaseButtons('betting');
  }
  updateDisplays();
  elems.dealBtn.disabled = true;
}

// ─── INSURANCE ─────────────────────────────────────────────────
function takeInsurance() {
  const maxIns = Math.min(Math.floor(state.bet / 2), state.balance);
  if (maxIns <= 0) return;
  state.insuranceBet = maxIns;
  state.balance -= maxIns;
  elems.insuranceBar.classList.add('hidden');
  sfxChip();
  updateDisplays();
}

function declineInsurance() {
  elems.insuranceBar.classList.add('hidden');
}

// ─── DEAL AGAIN ────────────────────────────────────────────────
function dealAgain() {
  if (state.phase !== 'roundComplete') return;
  // Cap bet at what can be afforded for all hands
  const maxPerHand = state.numHands > 1 ? Math.floor(state.balance / state.numHands) : state.balance;
  state.bet = Math.min(state.bet, maxPerHand);
  if (state.bet === 0) {
    elems.roundStatus.textContent = 'Place your bet to begin';
    state.phase = 'betting';
    resetHandSections();
    setPhaseButtons('betting');
    elems.resultBanner.classList.add('hidden');
    return;
  }
  state.balance -= state.bet * state.numHands;
  startRound();
}

// ─── THEME ────────────────────────────────────────────────────
const THEMES = ['theme-classic', 'theme-dark', 'theme-retro', 'theme-neon', 'theme-sunset', 'theme-ice', 'theme-royal'];
let themeIdx = 0;

function applyTheme(theme) {
  document.body.classList.remove(...THEMES);
  document.body.classList.add(theme);
  elems.themeChips.forEach(c => c.classList.toggle('active', c.dataset.theme === theme));
  themeIdx = THEMES.indexOf(theme);
}

// ─── LEADERBOARD ─────────────────────────────────────────────
function getLeaderboard() {
  return JSON.parse(localStorage.getItem('bjq_leaderboard') || '[]');
}

function saveLeaderboard() {
  if (!state.dailyMode) return;
  const lb = getLeaderboard();
  const dateStr = getDailyDateStr();
  const entry = {
    balance: state.balance,
    net: state.balance - STARTING_BALANCE,
    handsPlayed: state.handsPlayed,
    date: dateStr,
  };
  // Update existing entry for today if it's an improvement
  const todayIdx = lb.findIndex(e => e.date === dateStr);
  if (todayIdx >= 0) {
    if (entry.balance > lb[todayIdx].balance) lb[todayIdx] = entry;
  } else {
    lb.push(entry);
  }
  // Sort by balance descending, keep top 10
  lb.sort((a, b) => b.balance - a.balance);
  lb.splice(10);
  localStorage.setItem('bjq_leaderboard', JSON.stringify(lb));
}

function renderLeaderboard() {
  const lb = getLeaderboard();
  const content = $('lb-content');
  const today = getDailyDateStr();
  if (!lb.length) {
    content.innerHTML = '<p class="lb-empty">No entries yet — complete a Daily Challenge to appear here!</p>';
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  const rows = lb.slice(0, 10).map((e, i) => {
    const netSign = e.net >= 0 ? '+' : '';
    const netCls  = e.net >= 0 ? 'profit' : 'loss';
    const todayCls = e.date === today ? ' lb-today' : '';
    return `<tr class="lb-row${todayCls}">
      <td>${medals[i] || `#${i+1}`}</td>
      <td>${fmt(e.balance)}</td>
      <td class="${netCls}">${netSign}${fmt(e.net)}</td>
      <td>${e.handsPlayed}</td>
      <td>${e.date}</td>
    </tr>`;
  }).join('');
  content.innerHTML = `
    <table class="lb-table">
      <thead>
        <tr>
          <th>Rank</th><th>Balance</th><th>Net</th><th>Hands</th><th>Date</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function showLeaderboard() {
  renderLeaderboard();
  $('leaderboard-overlay').classList.remove('hidden');
}

// ─── SYNC HAND COUNT UI ───────────────────────────────────────
function syncHandCountUI() {
  elems.handCountBtns.forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.n, 10) === state.numHands)
  );
}

// ─── KEYBOARD SHORTCUTS ──────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const key = e.key.toUpperCase();

  // Drill mode intercepts keys while open
  if (!$('drill-overlay').classList.contains('hidden')) {
    if (!drillState.answered) {
      if (key === 'H') { gradeDrillAnswer('H'); return; }
      if (key === 'S') { gradeDrillAnswer('S'); return; }
      if (key === 'D') { gradeDrillAnswer('D'); return; }
      if (key === 'P' && !$('drill-split-btn').disabled) { gradeDrillAnswer('P'); return; }
    } else if (key === 'ENTER' || key === 'N') {
      newDrillHand(); return;
    }
    return;
  }

  switch(key) {
    case 'H': if (!elems.hitBtn.disabled)        hit();       break;
    case 'S': if (!elems.standBtn.disabled)      stand();     break;
    case 'U': if (!elems.surrenderBtn.disabled)  surrender(); break;
    case 'D':
      if (!elems.dealBtn.disabled) {
        if (state.phase === 'roundComplete') dealAgain();
        else if (state.phase === 'betting' && state.bet > 0) {
          state.balance -= state.bet * state.numHands;
          startRound();
        }
      } else if (!elems.doubleBtn.disabled) doubleDown();
      break;
    case 'B': addBet(BET_STEP); break;
    case 'M': toggleMute(); break;
  }
});

function toggleMute() {
  state.muted = !state.muted;
  elems.muteBtn.textContent = state.muted ? '🔇' : '🔊';
  if (state.muted) jazzStop();
}

// ─── EVENT LISTENERS ─────────────────────────────────────────
elems.dealBtn.addEventListener('click', () => {
  if (state.phase === 'roundComplete') {
    dealAgain();
  } else if (state.phase === 'betting' && state.bet > 0) {
    state.balance -= state.bet * state.numHands;
    startRound();
    // Tutorial hook — advance after cards are dealt
    if (tutorialState.active && tutorialState.waitingFor === 'deal') {
      tutorialState.waitingFor = null;
      setTimeout(advanceTutorial, 900);
    }
  }
});

elems.clearBetBtn.addEventListener('click', clearBet);
elems.hitBtn.addEventListener('click', hit);
elems.standBtn.addEventListener('click', stand);
elems.doubleBtn.addEventListener('click', doubleDown);
elems.splitBtn.addEventListener('click', split);
elems.surrenderBtn.addEventListener('click', surrender);
elems.betMinus.addEventListener('click', () => {
  state.bet = Math.max(0, state.bet - BET_STEP);
  sfxChip();
  updateDisplays();
  elems.dealBtn.disabled = state.bet === 0;
});
elems.betPlus.addEventListener('click', () => addBet(BET_STEP));
elems.muteBtn.addEventListener('click', toggleMute);
elems.insuranceYes.addEventListener('click', takeInsurance);
elems.insuranceNo.addEventListener('click', declineInsurance);

elems.chips.forEach(chip => {
  chip.addEventListener('click', () => addBet(parseInt(chip.dataset.amount, 10)));
});

elems.statsToggleBtn.addEventListener('click', () => {
  elems.statsPanel.classList.toggle('hidden');
});

elems.settingsBtn.addEventListener('click', () => {
  elems.settingsPanel.classList.remove('hidden');
});
elems.closeSettingsBtn.addEventListener('click', () => {
  elems.settingsPanel.classList.add('hidden');
});
elems.settingsPanel.addEventListener('click', e => {
  if (e.target === elems.settingsPanel) elems.settingsPanel.classList.add('hidden');
});

elems.hintToggle.addEventListener('change', () => {
  state.showHints = elems.hintToggle.checked;
  updateHints();
});
elems.countToggle.addEventListener('change', () => {
  state.showCount = elems.countToggle.checked;
  elems.countBar.classList.toggle('hidden', !state.showCount);
});

elems.themeChips.forEach(chip => {
  chip.addEventListener('click', () => applyTheme(chip.dataset.theme));
});
elems.themeBtn.addEventListener('click', () => {
  themeIdx = (themeIdx + 1) % THEMES.length;
  applyTheme(THEMES[themeIdx]);
});

// Achievements
elems.achievementsBtn.addEventListener('click', () => {
  renderAchievementsPanel();
  elems.achievementsOverlay.classList.remove('hidden');
});
elems.closeAchievementsBtn.addEventListener('click', () => {
  elems.achievementsOverlay.classList.add('hidden');
});
elems.achievementsOverlay.addEventListener('click', e => {
  if (e.target === elems.achievementsOverlay) elems.achievementsOverlay.classList.add('hidden');
});

// Daily Challenge
elems.dailyBtn.addEventListener('click', showDailyDialog);
elems.dailyStartBtn.addEventListener('click', startDailyChallenge);
elems.dailyCloseBtn.addEventListener('click', () => elems.dailyOverlay.classList.add('hidden'));
elems.dailyOverlay.addEventListener('click', e => {
  if (e.target === elems.dailyOverlay) elems.dailyOverlay.classList.add('hidden');
});

// Hand count selector
elems.handCountBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (state.phase !== 'betting' && state.phase !== 'roundComplete') return;
    state.numHands = parseInt(btn.dataset.n, 10);
    syncHandCountUI();
    // Re-cap bet if it now exceeds per-hand limit
    const maxPerHand = Math.floor(state.balance / state.numHands);
    if (state.bet > maxPerHand) {
      state.bet = maxPerHand;
    }
    sfxChip();
    updateDisplays();
  });
});

// Leaderboard
elems.leaderboardBtn.addEventListener('click', showLeaderboard);
$('close-leaderboard-btn').addEventListener('click', () => $('leaderboard-overlay').classList.add('hidden'));
$('leaderboard-overlay').addEventListener('click', e => {
  if (e.target === $('leaderboard-overlay')) $('leaderboard-overlay').classList.add('hidden');
});

// ─── BROKE RESET ─────────────────────────────────────────────
$('broke-reset-btn').addEventListener('click', () => {
  $('broke-overlay').classList.add('hidden');
  state.balance = STARTING_BALANCE;
  state.bet = 0;
  state.numHands = 1;
  state.phase = 'betting';
  state.dailyMode = false;
  dailyRng = null;
  elems.dailyBadge.classList.add('hidden');
  elems.resultBanner.classList.add('hidden');
  resetHandSections();
  syncHandCountUI();
  setPhaseButtons('betting');
  updateDisplays();
  elems.roundStatus.textContent = 'Place your bet to begin';
});

// ─── TUTORIAL ──────────────────────────────────────────────────
const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Blackjack Quest!',
    text: "Let's learn how to play blackjack — the classic casino card game where you try to beat the dealer without going over 21!",
    target: null, waitFor: null,
  },
  {
    id: 'card-values',
    title: 'Card Values',
    text: 'Number cards = face value. Jack, Queen, King = 10. Ace = 1 or 11 — whichever helps your hand more!',
    target: null, waitFor: null,
  },
  {
    id: 'place-bet',
    title: 'Place a Bet',
    text: 'Choose how much to wager. Click a chip like $10, or use the + button to add chips. You need a bet before you can deal.',
    target: 'betting-controls', waitFor: 'bet',
    prompt: 'Click a chip to place your first bet!',
  },
  {
    id: 'deal',
    title: 'Deal Your Cards',
    text: "Great! Now click Deal to start the round — you'll receive two cards, and so will the dealer.",
    target: 'deal-btn', waitFor: 'deal',
    prompt: 'Click the Deal button!',
  },
  {
    id: 'your-hand',
    title: 'Your Hand',
    text: "These are your cards! Add up their values. Goal: get closer to 21 than the dealer without going over (that's a bust).",
    target: 'hand-a-section', waitFor: null,
  },
  {
    id: 'dealer-hand',
    title: "The Dealer's Hand",
    text: "The dealer has one card face-up and one hidden. You play your hand first — the dealer reveals after you're done.",
    target: 'dealer-area', waitFor: null,
  },
  {
    id: 'choices',
    title: 'Your Choices',
    text: 'Hit = get another card. Stand = keep your hand. Double = double bet, one more card. Surrender = fold for half your bet back.',
    target: 'action-controls', waitFor: null,
  },
  {
    id: 'make-move',
    title: 'Make Your Move!',
    text: "Now it's your turn. Hit if you want more cards, Stand if you're happy. Don't go over 21!",
    target: 'action-controls', waitFor: 'play',
    prompt: 'Hit or Stand now!',
  },
  {
    id: 'result',
    title: 'See the Result',
    text: "The dealer reveals their hole card and draws until reaching 17+. Closest to 21 without busting wins! Blackjack (Ace + 10-value) pays 1.5×.",
    target: 'result-banner', waitFor: null,
  },
  {
    id: 'done',
    title: "You're Ready!",
    text: 'Those are the basics! Check Settings (⚙) for strategy hints and card counting. Use the Stats panel to track your progress. Good luck!',
    target: null, waitFor: null,
  },
];

let tutorialState = { active: false, stepIndex: 0, waitingFor: null };

function startTutorial() {
  $('welcome-overlay').classList.add('hidden');
  // Reset game to a clean betting state
  jazzStop();
  state.balance = STARTING_BALANCE;
  state.bet = 0;
  state.phase = 'betting';
  state.numHands = 1;
  state.dailyMode = false;
  state.practiceMode = false;
  dailyRng = null;
  state.handBets = [];
  state.playerHands = [[]];
  state.dealerCards = [];
  state.hiLoCount = 0;
  elems.resultBanner.classList.add('hidden');
  elems.insuranceBar.classList.add('hidden');
  $('daily-badge').classList.add('hidden');
  $('practice-badge').classList.add('hidden');
  resetHandSections();
  syncHandCountUI();
  setPhaseButtons('betting');
  updateDisplays();

  tutorialState.active = true;
  tutorialState.stepIndex = 0;
  tutorialState.waitingFor = null;
  $('tutorial-overlay').classList.remove('hidden');
  showTutorialStep(0);
}

function showTutorialStep(index) {
  if (index >= TUTORIAL_STEPS.length) { endTutorial(); return; }
  const step = TUTORIAL_STEPS[index];
  tutorialState.stepIndex = index;
  tutorialState.waitingFor = step.waitFor || null;

  const total = TUTORIAL_STEPS.length;
  $('tutorial-step-label').textContent = `Step ${index + 1} of ${total}`;
  $('tutorial-title').textContent = step.title;
  $('tutorial-text').textContent = step.text;
  $('tutorial-progress-fill').style.width = Math.round((index / (total - 1)) * 100) + '%';

  const promptEl = $('tutorial-prompt');
  if (step.prompt) {
    promptEl.textContent = '👉 ' + step.prompt;
    promptEl.classList.remove('hidden');
  } else {
    promptEl.classList.add('hidden');
  }

  const nextBtn = $('tutorial-next-btn');
  if (step.waitFor) {
    nextBtn.classList.add('hidden');
  } else {
    nextBtn.classList.remove('hidden');
    nextBtn.textContent = index === total - 1 ? 'Start Playing! 🃏' : 'Next →';
  }

  setTutorialHighlight(step.target);
}

function advanceTutorial() {
  setTutorialHighlight(null);
  showTutorialStep(tutorialState.stepIndex + 1);
}

function setTutorialHighlight(targetId) {
  document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
  if (targetId) {
    const el = $(targetId);
    if (el) el.classList.add('tutorial-highlight');
  }
}

function endTutorial() {
  tutorialState.active = false;
  tutorialState.waitingFor = null;
  setTutorialHighlight(null);
  $('tutorial-overlay').classList.add('hidden');
  localStorage.setItem('bjq_visited', '1');
  elems.roundStatus.textContent = 'Place your bet to begin';
}

// ─── WELCOME / FIRST VISIT ─────────────────────────────────────
function checkFirstVisit() {
  if (!localStorage.getItem('bjq_visited')) {
    setTimeout(() => $('welcome-overlay').classList.remove('hidden'), 200);
  }
}

// ─── PRACTICE MODE ─────────────────────────────────────────────
function refillPracticeBalance() {
  state.balance = STARTING_BALANCE;
  state.bet = Math.min(state.bet, STARTING_BALANCE);
  updateDisplays();
  elems.roundStatus.textContent = '💡 Practice: balance refilled to $1,000';
}

function togglePracticeMode(on) {
  state.practiceMode = on;
  $('practice-badge').classList.toggle('hidden', !on);
  if (on) {
    // Exit daily mode if active
    state.dailyMode = false;
    dailyRng = null;
    $('daily-badge').classList.add('hidden');
    state.balance = STARTING_BALANCE;
    state.bet = 0;
    state.phase = 'betting';
    resetHandSections();
    syncHandCountUI();
    setPhaseButtons('betting');
    updateDisplays();
    elems.roundStatus.textContent = '💡 Practice Mode — unlimited balance!';
  } else {
    elems.roundStatus.textContent = 'Place your bet to begin';
  }
}

// ─── TUTORIAL / WELCOME EVENT LISTENERS ───────────────────────
$('welcome-tutorial-btn').addEventListener('click', startTutorial);
$('welcome-skip-btn').addEventListener('click', () => {
  $('welcome-overlay').classList.add('hidden');
  localStorage.setItem('bjq_visited', '1');
});
$('welcome-overlay').addEventListener('click', e => {
  if (e.target === $('welcome-overlay')) {
    $('welcome-overlay').classList.add('hidden');
    localStorage.setItem('bjq_visited', '1');
  }
});

$('tutorial-next-btn').addEventListener('click', () => {
  if (tutorialState.stepIndex === TUTORIAL_STEPS.length - 1) {
    endTutorial();
  } else {
    advanceTutorial();
  }
});
$('tutorial-skip-btn').addEventListener('click', endTutorial);

$('help-btn').addEventListener('click', startTutorial);

// Practice mode toggle
$('practice-toggle').addEventListener('change', e => {
  togglePracticeMode(e.target.checked);
});

// ─── STRATEGY DRILL ───────────────────────────────────────────
let drillState = {
  correct: 0,
  total: 0,
  streak: 0,
  playerCards: [],
  dealerCard: null,
  answered: false,
  correctAction: null,
};

function generateDrillScenario() {
  const allRanks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const dealerRanks = ['2','3','4','5','6','7','8','9','10','A'];
  const handType = Math.random();
  let card1, card2;

  if (handType < 0.25) {
    // Pair (25%) — tests split decisions
    const rank = allRanks[Math.floor(Math.random() * allRanks.length)];
    card1 = { rank, suit: '♠' };
    card2 = { rank, suit: '♥' };
  } else if (handType < 0.45) {
    // Soft hand (20%) — tests soft strategy
    const others = ['2','3','4','5','6','7','8','9','10'];
    const otherRank = others[Math.floor(Math.random() * others.length)];
    card1 = { rank: 'A', suit: '♠' };
    card2 = { rank: otherRank, suit: '♥' };
  } else {
    // Random (55%) — general strategy
    card1 = { rank: allRanks[Math.floor(Math.random() * allRanks.length)], suit: SUITS[Math.floor(Math.random() * 4)] };
    card2 = { rank: allRanks[Math.floor(Math.random() * allRanks.length)], suit: SUITS[Math.floor(Math.random() * 4)] };
  }

  const dealerRank = dealerRanks[Math.floor(Math.random() * dealerRanks.length)];
  return {
    playerCards: [card1, card2],
    dealerCard: { rank: dealerRank, suit: SUITS[Math.floor(Math.random() * 4)] },
  };
}

function getDrillExplanation(correctAction, playerCards, dealerCard) {
  const total = handValue(playerCards);
  const soft = isSoft(playerCards);
  const du = rankValue(dealerCard.rank);
  const r = playerCards[0].rank;

  if (correctAction === 'P') {
    if (r === 'A') return 'Always split Aces — each Ace can start fresh toward 21.';
    if (r === '8') return 'Always split 8s — hard 16 is the worst hand; two 8s give you clean starts.';
    if (r === '9') return `Split 9s vs dealer ${dealerCard.rank} — two 9-hands beat this upcard.`;
    if (r === '7') return `Split 7s vs dealer ${dealerCard.rank} — favorable matchup here.`;
    if (r === '6') return 'Split 6s vs a weak dealer — push them into the bust zone.';
    if (r === '4') return 'Split 4s only vs dealer 5 or 6 — the two weakest dealer cards.';
    if (r === '2' || r === '3') return `Split ${r}s vs dealer ${dealerCard.rank} — turn a weak hand into two decent ones.`;
    return 'Splitting this pair has higher expected value here.';
  }

  if (correctAction === 'D') {
    if (total === 11) return 'Double on 11 — the strongest doubling hand. One card away from 21.';
    if (total === 10) return `Double on 10 vs dealer ${dealerCard.rank} — high chance of landing a 20.`;
    if (total === 9) return 'Double on 9 vs a weak dealer (3–6) — they\'re likely to bust.';
    if (soft && total === 18) return `Soft 18 vs dealer ${dealerCard.rank} — double to maximize the opportunity.`;
    if (soft && total === 17) return 'Soft 17 vs a weak dealer — the Ace protects you from busting.';
    if (soft) return `Soft ${total} is a great doubling hand — the Ace means you can\'t bust.`;
    return 'This is a prime doubling situation — press your advantage!';
  }

  if (correctAction === 'S') {
    if (total === 21) return 'Perfect hand! Always stand on 21.';
    if (total >= 17) return `Hard ${total} — always stand on 17 or more. The bust risk outweighs any gain.`;
    if (du <= 6 && total >= 13) return `Stand on ${total} vs dealer ${dealerCard.rank} — dealer is in the bust zone (2–6). Let them bust.`;
    if (du <= 6 && total === 12) return `Stand on 12 vs dealer ${dealerCard.rank} — they risk busting; don\'t risk it yourself.`;
    if (soft && total >= 19) return `Soft ${total} is a strong hand — no need to risk another card.`;
    return 'Stand and let the dealer take the risk.';
  }

  // Hit
  if (total <= 8) return `${total} is very low — always hit. No card can bust you from here.`;
  if (soft) return `Soft ${total} — you can\'t bust on one hit (the Ace absorbs it). Take the free card.`;
  if (du >= 7 && total <= 16) return `Dealer shows a strong ${dealerCard.rank} — you need to improve. Hit to compete.`;
  if (total === 12) return `12 vs dealer ${dealerCard.rank} — dealer is strong enough here that you must hit.`;
  return `Hit to improve a weak ${total} against the dealer\'s ${dealerCard.rank}.`;
}

function newDrillHand() {
  const scenario = generateDrillScenario();
  drillState.playerCards = scenario.playerCards;
  drillState.dealerCard = scenario.dealerCard;
  drillState.answered = false;

  const isPair = scenario.playerCards[0].rank === scenario.playerCards[1].rank;
  drillState.correctAction = basicStrategy(scenario.playerCards, scenario.dealerCard.rank, true, isPair);

  // Render cards
  const dealerEl = $('drill-dealer-card');
  const playerEl = $('drill-player-cards');
  dealerEl.innerHTML = '';
  playerEl.innerHTML = '';
  dealerEl.appendChild(renderCard(scenario.dealerCard));
  scenario.playerCards.forEach(c => playerEl.appendChild(renderCard(c)));

  $('drill-hand-value').textContent = handValue(scenario.playerCards);

  // Split only when cards are a true pair
  const splitBtn = $('drill-split-btn');
  splitBtn.disabled = !isPair;
  splitBtn.style.opacity = isPair ? '1' : '0.35';

  // Reset button states
  ['drill-hit-btn', 'drill-stand-btn', 'drill-double-btn', 'drill-split-btn'].forEach(id => {
    const el = $(id);
    el.classList.remove('drill-correct', 'drill-wrong', 'drill-highlight');
    if (id !== 'drill-split-btn') el.disabled = false;
  });

  $('drill-feedback').classList.add('hidden');
  $('drill-choices').classList.remove('hidden');
  $('drill-next-btn').classList.add('hidden');
}

function gradeDrillAnswer(action) {
  if (drillState.answered) return;
  drillState.answered = true;
  drillState.total++;

  const isCorrect = action === drillState.correctAction;
  if (isCorrect) {
    drillState.correct++;
    drillState.streak++;
    playTone(660, 0.1, 'sine', 0.1);
    setTimeout(() => playTone(880, 0.15, 'sine', 0.1), 80);
  } else {
    drillState.streak = 0;
    playTone(260, 0.3, 'sawtooth', 0.08);
  }

  // Highlight buttons
  const btnMap = { H: 'drill-hit-btn', S: 'drill-stand-btn', D: 'drill-double-btn', P: 'drill-split-btn' };
  $(btnMap[action]).classList.add(isCorrect ? 'drill-correct' : 'drill-wrong');
  if (!isCorrect) $(btnMap[drillState.correctAction]).classList.add('drill-highlight');

  // Disable all choices
  ['drill-hit-btn', 'drill-stand-btn', 'drill-double-btn', 'drill-split-btn'].forEach(id => $(id).disabled = true);

  const actionLabels = { H: 'Hit', S: 'Stand', D: 'Double', P: 'Split' };
  const verdict = $('drill-verdict');
  verdict.className = 'drill-verdict ' + (isCorrect ? 'correct' : 'wrong');
  verdict.textContent = isCorrect
    ? `✓ Correct! ${actionLabels[action]}`
    : `✗ Incorrect — correct play: ${actionLabels[drillState.correctAction]}`;

  $('drill-explanation').textContent = getDrillExplanation(
    drillState.correctAction, drillState.playerCards, drillState.dealerCard
  );

  $('drill-feedback').classList.remove('hidden');
  $('drill-next-btn').classList.remove('hidden');
  updateDrillScore();
}

function updateDrillScore() {
  const { correct, total, streak } = drillState;
  const pct = total > 0 ? Math.round(correct / total * 100) : 0;
  $('drill-score').textContent = total > 0 ? `${correct}/${total} (${pct}%)` : '—';
  const streakEl = $('drill-streak-display');
  if (streak >= 3) {
    streakEl.textContent = `🔥 ${streak}`;
    streakEl.classList.remove('hidden');
  } else {
    streakEl.textContent = '';
    streakEl.classList.add('hidden');
  }
}

function openDrill() {
  drillState.correct = 0;
  drillState.total = 0;
  drillState.streak = 0;
  drillState.answered = false;
  $('drill-score').textContent = '—';
  $('drill-streak-display').classList.add('hidden');
  $('drill-overlay').classList.remove('hidden');
  newDrillHand();
}

// Strategy Drill event listeners
$('drill-btn').addEventListener('click', openDrill);
$('drill-close-btn').addEventListener('click', () => $('drill-overlay').classList.add('hidden'));
$('drill-overlay').addEventListener('click', e => {
  if (e.target === $('drill-overlay')) $('drill-overlay').classList.add('hidden');
});
$('drill-hit-btn').addEventListener('click', () => gradeDrillAnswer('H'));
$('drill-stand-btn').addEventListener('click', () => gradeDrillAnswer('S'));
$('drill-double-btn').addEventListener('click', () => gradeDrillAnswer('D'));
$('drill-split-btn').addEventListener('click', () => gradeDrillAnswer('P'));
$('drill-next-btn').addEventListener('click', newDrillHand);

// ─── INIT ────────────────────────────────────────────────────
function init() {
  state.phase = 'betting';
  syncHandCountUI();
  setPhaseButtons('betting');
  updateDisplays();
  elems.roundStatus.textContent = 'Place your bet to begin';
  checkFirstVisit();
}

init();
