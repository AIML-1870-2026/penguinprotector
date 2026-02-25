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
  return { H:'Hit', S:'Stand', D:'Double Down', P:'Split' }[action] || '';
}

// ─── STATE ──────────────────────────────────────────────────
let state = {
  phase: 'betting',       // betting | playing | dealerTurn | roundComplete
  balance: STARTING_BALANCE,
  bet: 0,
  deck: [],
  dealerCards: [],
  playerHands: [[]],      // array of hands (for split)
  activeHand: 0,          // which hand is being played
  insuranceBet: 0,
  result: null,
  muted: false,
  showHints: false,
  showCount: false,
  hiLoCount: 0,
  stats: {
    wins: 0, losses: 0, pushes: 0,
    biggestWin: 0,
    streak: 0,
    streakDir: null,       // 'win' | 'lose'
    history: []
  }
};

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

// ─── DOM REFS ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const elems = {
  dealerCards:    $('dealer-cards'),
  dealerValue:    $('dealer-value'),
  playerCards:    $('player-cards'),
  playerCardsB:   $('player-cards-b'),
  playerValue:    $('player-value'),
  playerValueB:   $('player-value-b'),
  handBSection:   $('hand-b-section'),
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
  hintToggle:     $('hint-toggle'),
  countToggle:    $('count-toggle'),
  settingsBtn:    $('settings-btn'),
  settingsPanel:  $('settings-panel'),
  closeSettingsBtn: $('close-settings-btn'),
  themeChips:     document.querySelectorAll('.theme-chip'),
  themeBtn:       $('theme-btn'),
};

// ─── RENDER ───────────────────────────────────────────────────
function renderCard(card) {
  const wrap = document.createElement('div');
  wrap.className = 'card-wrap';
  if (!card.hidden) wrap.classList.add('flipped');

  const inner = document.createElement('div');
  inner.className = 'card-inner';

  // Back
  const back = document.createElement('div');
  back.className = 'card-back';

  // Face
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

function flipCard(container, index) {
  const wraps = container.querySelectorAll('.card-wrap');
  if (wraps[index]) {
    wraps[index].classList.add('flipped');
    sfxFlip();
  }
}

function updateDisplays() {
  // Balance
  elems.balanceDisplay.textContent = fmt(state.balance);
  // Bet
  const betStr = fmt(state.bet);
  elems.betDisplay.textContent = betStr;
  elems.betBig.textContent = betStr;
  // Dealer value (hide hidden card value)
  const visibleDealer = state.dealerCards.filter(c => !c.hidden);
  elems.dealerValue.textContent = visibleDealer.length ? handValue(visibleDealer) : '';
  // Player hand A
  elems.playerValue.textContent = state.playerHands[0].length ? handValue(state.playerHands[0]) : '0';
  // Player hand B
  if (state.playerHands[1]) {
    elems.playerValueB.textContent = handValue(state.playerHands[1]);
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
    elems.hintBoxA.classList.add('hidden');
    elems.hintBoxB.classList.add('hidden');
    return;
  }
  const du = state.dealerCards.find(c => !c.hidden);
  if (!du) return;

  [0, 1].forEach(i => {
    const hand = state.playerHands[i];
    const box = i === 0 ? elems.hintBoxA : elems.hintBoxB;
    if (!hand || hand.length === 0) { box.classList.add('hidden'); return; }
    const canDouble = hand.length === 2 && state.bet * 2 <= state.balance;
    const canSplit = hand.length === 2 &&
      rankValue(hand[0].rank) === rankValue(hand[1].rank) &&
      state.bet * 2 <= state.balance && !state.playerHands[1];
    const action = basicStrategy(hand, du.rank, canDouble, canSplit);
    box.textContent = `Hint: ${strategyLabel(action)}`;
    box.classList.remove('hidden');
  });
}

function updateStatsPanel() {
  const { wins, losses, pushes, biggestWin, streak, streakDir, history } = state.stats;
  const total = wins + losses + pushes;
  elems.statWinrate.textContent = total ? `${Math.round(wins/total*100)}%` : '—';
  elems.statBigwin.textContent = fmt(biggestWin);
  const sign = streakDir === 'win' ? '+' : streakDir === 'lose' ? '-' : '';
  elems.statStreak.textContent = streak ? `${sign}${streak}` : '0';

  elems.historyList.innerHTML = '';
  [...history].reverse().slice(0, 10).forEach(r => {
    const div = document.createElement('div');
    div.className = `history-item ${r.outcome}`;
    div.textContent = `${r.outcome.toUpperCase()}  ${r.bet >= 0 ? '+' : ''}${fmt(r.net)}`;
    elems.historyList.appendChild(div);
  });
}

function fmt(n) { return '$' + n.toLocaleString(); }

// ─── BUTTON STATES ─────────────────────────────────────────────
function setPhaseButtons(phase) {
  const isBetting = phase === 'betting';
  const isPlaying = phase === 'playing';
  const isDone    = phase === 'roundComplete';

  // Bet chips & adj (available during betting and after a round ends)
  elems.chips.forEach(c => c.disabled = !(isBetting || isDone));
  elems.betMinus.disabled = !(isBetting || isDone);
  elems.betPlus.disabled  = !(isBetting || isDone);

  // Action row
  elems.dealBtn.disabled     = !(isBetting && state.bet > 0) && !isDone;
  elems.clearBetBtn.disabled = !(isBetting || isDone);
  elems.hitBtn.disabled      = !isPlaying;
  elems.standBtn.disabled    = !isPlaying;

  // Deal button label
  elems.dealBtn.textContent = isDone ? 'Deal Again (D)' : 'Deal (D)';

  if (isDone) {
    elems.dealBtn.disabled = false;
    elems.clearBetBtn.disabled = false;
  }

  updateDoubleAndSplit();
}

function updateDoubleAndSplit() {
  const isPlaying = state.phase === 'playing';
  const hand = state.playerHands[state.activeHand];
  const isFirstTwo = hand && hand.length === 2;

  elems.doubleBtn.disabled = !(isPlaying && isFirstTwo && state.bet * 2 <= state.balance);
  elems.splitBtn.disabled  = !(isPlaying && isFirstTwo &&
    hand && rankValue(hand[0].rank) === rankValue(hand[1].rank) &&
    state.bet * 2 <= state.balance &&
    !state.playerHands[1]
  );
}

// ─── GAME FLOW ─────────────────────────────────────────────────
function startRound() {
  if (state.bet === 0) return;

  // Reset for new round
  state.deck = shuffle(buildDeck());
  state.dealerCards = [];
  state.playerHands = [[]];
  state.activeHand = 0;
  state.insuranceBet = 0;
  state.result = null;
  state.hiLoCount = 0;

  // Hide elements
  elems.resultBanner.classList.add('hidden');
  elems.handBSection.classList.add('hidden');
  elems.insuranceBar.classList.add('hidden');

  // Deal: player, dealer, player, dealer(hidden)
  state.playerHands[0].push(dealCard());
  state.dealerCards.push(dealCard());
  state.playerHands[0].push(dealCard());
  state.dealerCards.push(dealCard(true)); // face-down

  state.phase = 'playing';
  setPhaseButtons('playing');
  renderAll();
  sfxDeal();

  // Check for player blackjack immediately
  if (isBlackjack(state.playerHands[0])) {
    // Check dealer for blackjack too after revealing
    revealAndResolve();
    return;
  }

  // Insurance offer if dealer shows Ace
  const dealerUp = state.dealerCards[0];
  if (dealerUp.rank === 'A') {
    elems.insuranceBar.classList.remove('hidden');
  }

  elems.roundStatus.textContent = 'Hit, Stand, Double, or Split?';
  updateDisplays();
}

function renderAll() {
  renderHand(elems.dealerCards, state.dealerCards);
  renderHand(elems.playerCards, state.playerHands[0]);
  if (state.playerHands[1]) {
    renderHand(elems.playerCardsB, state.playerHands[1]);
  }
  updateDisplays();
}

// ─── PLAYER ACTIONS ────────────────────────────────────────────
function hit() {
  if (state.phase !== 'playing') return;
  const hand = state.playerHands[state.activeHand];
  hand.push(dealCard());
  renderAll();
  sfxDeal();

  if (isBust(hand)) {
    if (state.activeHand === 0 && state.playerHands[1]) {
      // Move to second hand
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
  if (state.activeHand === 0 && state.playerHands[1]) {
    nextHand();
  } else {
    endPlayerTurn();
  }
}

function doubleDown() {
  if (state.phase !== 'playing') return;
  const hand = state.playerHands[state.activeHand];
  if (hand.length !== 2 || state.bet * 2 > state.balance) return;
  state.balance -= state.bet;
  state.bet *= 2;
  updateDisplays();
  hand.push(dealCard());
  renderAll();
  sfxChip();
  sfxDeal();
  endPlayerTurn();
}

function split() {
  if (state.phase !== 'playing') return;
  const hand = state.playerHands[0];
  if (hand.length !== 2 || rankValue(hand[0].rank) !== rankValue(hand[1].rank)) return;
  if (state.bet * 2 > state.balance) return;

  state.balance -= state.bet;
  const cardB = hand.splice(1, 1)[0];
  state.playerHands[1] = [cardB];
  sfxChip();

  // Deal one card to each hand
  state.playerHands[0].push(dealCard());
  // Aces get only one card each
  if (hand[0].rank === 'A') {
    state.playerHands[1].push(dealCard());
  }

  elems.handBSection.classList.remove('hidden');
  renderHand(elems.playerCards, state.playerHands[0]);
  renderHand(elems.playerCardsB, state.playerHands[1]);
  sfxDeal();

  // If aces, auto-stand both
  if (hand[0].rank === 'A') {
    endPlayerTurn();
    return;
  }

  state.activeHand = 0;
  updateDisplays();
  updateDoubleAndSplit();
}

function nextHand() {
  state.activeHand = 1;
  if (!state.playerHands[1] || state.playerHands[1].length === 0) {
    endPlayerTurn();
    return;
  }
  // Deal a card to second hand if it only has one (split scenario)
  if (state.playerHands[1].length === 1) {
    state.playerHands[1].push(dealCard());
    renderHand(elems.playerCardsB, state.playerHands[1]);
    sfxDeal();
  }
  updateDisplays();
  updateDoubleAndSplit();
  elems.roundStatus.textContent = 'Playing Hand B';
}

function endPlayerTurn() {
  state.phase = 'dealerTurn';
  setPhaseButtons('dealerTurn');
  elems.insuranceBar.classList.add('hidden');
  runDealerTurn();
}

// ─── DEALER TURN ───────────────────────────────────────────────
function revealAndResolve() {
  // Reveal hidden card
  state.dealerCards[1].hidden = false;
  state.hiLoCount += HI_LO[state.dealerCards[1].rank] ?? 0;
  renderHand(elems.dealerCards, state.dealerCards);
  setTimeout(() => flipCard(elems.dealerCards, 1), 50);
  sfxFlip();
  resolveRound();
}

function runDealerTurn() {
  elems.roundStatus.textContent = "Dealer's turn…";

  // Reveal hidden card
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
    // Flip newest card
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

  const dealerBJ = isBlackjack(state.dealerCards);
  const dealerBust = isBust(state.dealerCards);
  const dv = handValue(state.dealerCards);

  // Resolve insurance first
  let insuranceResult = 0;
  if (state.insuranceBet > 0) {
    if (dealerBJ) {
      insuranceResult = state.insuranceBet * 2; // 2:1 payout + return
      state.balance += insuranceResult;
    }
    // else insurance is lost (already deducted)
  }

  // Resolve each hand
  const results = [];
  state.playerHands.forEach((hand, i) => {
    if (hand.length === 0) return;
    const pv = handValue(hand);
    const playerBJ = isBlackjack(hand) && i === 0 && !state.playerHands[1]; // BJ only on non-split first hand
    const playerBust = isBust(hand);

    let outcome, net;

    if (playerBust) {
      outcome = 'lose'; net = -state.bet;
    } else if (dealerBJ && playerBJ) {
      outcome = 'push'; net = 0;
    } else if (dealerBJ) {
      outcome = 'lose'; net = -state.bet;
    } else if (playerBJ) {
      const bjWin = Math.floor(state.bet * 1.5);
      outcome = 'blackjack'; net = bjWin;
      state.balance += state.bet + bjWin;
    } else if (dealerBust) {
      outcome = 'win'; net = state.bet;
      state.balance += state.bet * 2;
    } else if (pv > dv) {
      outcome = 'win'; net = state.bet;
      state.balance += state.bet * 2;
    } else if (pv === dv) {
      outcome = 'push'; net = 0;
      state.balance += state.bet;
    } else {
      outcome = 'lose'; net = -state.bet;
    }

    results.push({ outcome, net });
  });

  // Show result banner (use first hand outcome or summarize)
  const primary = results[0];
  showResult(primary.outcome, results);

  // Stats
  recordStats(results);

  // Dealer value update
  elems.dealerValue.textContent = handValue(state.dealerCards);
  updateDisplays();

  // Check zero balance
  if (state.balance <= 0) {
    setTimeout(() => {
      if (confirm('You\'re out of money! Reset to $1,000?')) {
        state.balance = STARTING_BALANCE;
        updateDisplays();
      }
    }, 800);
  }
}

function showResult(outcome, results) {
  const banner = elems.resultBanner;
  banner.className = 'result-banner';

  let label = '';
  if (results.length > 1) {
    // Split — show each outcome
    label = results.map((r, i) => `Hand ${i+1}: ${r.outcome.toUpperCase()}`).join('  |  ');
    banner.classList.add(results[0].outcome);
  } else {
    switch(outcome) {
      case 'blackjack': label = 'Blackjack! 🃏'; banner.classList.add('bj'); sfxBJ(); break;
      case 'win':       label = 'You Win!';      banner.classList.add('win'); sfxWin(); break;
      case 'lose':      label = 'Dealer Wins';   banner.classList.add('lose'); sfxLose(); break;
      case 'push':      label = 'Push — Tie';    banner.classList.add('push'); sfxPush(); break;
    }
  }

  banner.textContent = label;
  banner.classList.remove('hidden');
  elems.roundStatus.textContent = 'Place your bet to play again';

  // Animate balance
  const netTotal = results.reduce((s, r) => s + r.net, 0);
  const balEl = elems.balanceDisplay;
  balEl.classList.remove('balance-up', 'balance-down');
  void balEl.offsetWidth; // reflow
  if (netTotal > 0) balEl.classList.add('balance-up');
  else if (netTotal < 0) balEl.classList.add('balance-down');
}

function recordStats(results) {
  const primary = results[0];
  const net = results.reduce((s, r) => s + r.net, 0);

  if (primary.outcome === 'win' || primary.outcome === 'blackjack') {
    state.stats.wins++;
    if (net > state.stats.biggestWin) state.stats.biggestWin = net;
    if (state.stats.streakDir === 'win') state.stats.streak++;
    else { state.stats.streak = 1; state.stats.streakDir = 'win'; }
  } else if (primary.outcome === 'lose') {
    state.stats.losses++;
    if (state.stats.streakDir === 'lose') state.stats.streak++;
    else { state.stats.streak = 1; state.stats.streakDir = 'lose'; }
  } else {
    state.stats.pushes++;
    state.stats.streak = 0; state.stats.streakDir = null;
  }

  state.stats.history.push({
    outcome: primary.outcome === 'blackjack' ? 'win' : primary.outcome,
    bet: state.bet,
    net
  });
  if (state.stats.history.length > 20) state.stats.history.shift();
}

// ─── BETTING ───────────────────────────────────────────────────
function addBet(amount) {
  if (state.phase !== 'betting' && state.phase !== 'roundComplete') return;
  const max = state.balance;
  state.bet = Math.min(state.bet + amount, max);
  sfxChip();
  updateDisplays();
  elems.dealBtn.disabled = state.bet === 0;
}

function clearBet() {
  state.bet = 0;
  if (state.phase === 'roundComplete') {
    state.phase = 'betting';
    elems.resultBanner.classList.add('hidden');
    setPhaseButtons('betting');
  }
  updateDisplays();
  elems.dealBtn.disabled = true;
}

// ─── INSURANCE ─────────────────────────────────────────────────
function takeInsurance() {
  const maxIns = Math.floor(state.bet / 2);
  if (maxIns > state.balance) return;
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
  // Keep bet from previous round (capped at balance)
  state.bet = Math.min(state.bet, state.balance);
  if (state.bet === 0) {
    elems.roundStatus.textContent = 'Place your bet to begin';
    state.phase = 'betting';
    setPhaseButtons('betting');
    elems.resultBanner.classList.add('hidden');
    return;
  }
  // Deduct bet for new round
  state.balance -= state.bet;
  startRound();
}

// ─── THEME ────────────────────────────────────────────────────
const THEMES = ['theme-classic', 'theme-dark', 'theme-retro'];
let themeIdx = 0;

function applyTheme(theme) {
  document.body.classList.remove(...THEMES);
  document.body.classList.add(theme);
  elems.themeChips.forEach(c => c.classList.toggle('active', c.dataset.theme === theme));
  themeIdx = THEMES.indexOf(theme);
}

// ─── KEYBOARD SHORTCUTS ──────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const key = e.key.toUpperCase();
  switch(key) {
    case 'H': if (!elems.hitBtn.disabled)    hit();       break;
    case 'S': if (!elems.standBtn.disabled)  stand();     break;
    case 'D':
      if (!elems.dealBtn.disabled) {
        if (state.phase === 'roundComplete') dealAgain();
        else if (state.phase === 'betting' && state.bet > 0) {
          state.balance -= state.bet;
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
}

// ─── EVENT LISTENERS ─────────────────────────────────────────
elems.dealBtn.addEventListener('click', () => {
  if (state.phase === 'roundComplete') {
    dealAgain();
  } else if (state.phase === 'betting' && state.bet > 0) {
    state.balance -= state.bet;
    startRound();
  }
});

elems.clearBetBtn.addEventListener('click', clearBet);
elems.hitBtn.addEventListener('click', hit);
elems.standBtn.addEventListener('click', stand);
elems.doubleBtn.addEventListener('click', doubleDown);
elems.splitBtn.addEventListener('click', split);
elems.betMinus.addEventListener('click', () => { state.bet = Math.max(0, state.bet - BET_STEP); sfxChip(); updateDisplays(); elems.dealBtn.disabled = state.bet === 0; });
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

// ─── INIT ────────────────────────────────────────────────────
function init() {
  state.phase = 'betting';
  setPhaseButtons('betting');
  updateDisplays();
  elems.roundStatus.textContent = 'Place your bet to begin';
}

init();
