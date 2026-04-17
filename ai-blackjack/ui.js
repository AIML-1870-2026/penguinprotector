'use strict';

// ── DOM References ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const el = {
  // Header
  keyIndicator:  $('key-indicator'),
  keyDot:        $('key-dot'),
  keyText:       $('key-text'),
  envFile:       $('env-file'),
  keyInput:      $('key-input'),
  keyEyeBtn:     $('key-eye-btn'),
  // Explainability + risk controls
  detailToggle:  $('detail-toggle'),
  riskToggle:    $('risk-toggle'),
  riskBadge:     $('risk-badge'),
  // Table info bar
  shoeCounter:    $('shoe-counter'),
  countDisplay:   $('count-display'),
  rcVal:          $('rc-val'),
  tcVal:          $('tc-val'),
  bustChip:       $('bust-chip'),
  bustVal:        $('bust-val'),
  shuffleNotice:  $('shuffle-notice'),
  // Action buttons
  surrenderBtn:   $('surrender-btn'),
  // Analytics extras
  statDeviations:       $('stat-deviations'),
  statDeviationOutcome: $('stat-deviation-outcome'),
  // Deck selector
  deckSelect:     $('deck-select'),
  // Deep stats
  aiDeepStats:   $('ai-deep-stats'),
  deepBustProb:  $('deep-bust-prob'),
  deepEv:        $('deep-ev'),
  deepAltTable:  $('deep-alt-table'),
  soundBtn:      $('sound-btn'),
  probBreakdown: $('prob-breakdown'),
  probRows:      $('prob-rows'),
  aboutBtn:      $('about-btn'),
  aboutModal:    $('about-modal'),
  aboutClose:    $('about-close'),
  shortcutsBtn:  $('shortcuts-btn'),
  shortcutsModal:$('shortcuts-modal'),
  shortcutsClose:$('shortcuts-close'),
  evenMoneyBar:  $('even-money-bar'),
  emYesBtn:      $('em-yes-btn'),
  emNoBtn:       $('em-no-btn'),
  deviationBar:  $('deviation-bar'),
  betAdvisor:    $('bet-advisor'),
  sidebetToggle: $('sidebet-toggle'),
  sidebetResult: $('sidebet-result'),
  historyToggle: $('history-toggle'),
  historyBody:   $('history-body'),
  historyChevron:$('history-chevron'),
  historyList:   $('history-list'),
  brokeOverlay:  $('broke-overlay'),
  brokeResetBtn: $('broke-reset-btn'),
  // Control bar
  familySelect:  $('family-select'),
  modelSelect:   $('model-select'),
  refreshModels: $('refresh-models'),
  betMinus:      $('bet-minus'),
  betPlus:       $('bet-plus'),
  betDisplay:    $('bet-display'),
  balanceVal:    $('balance-val'),
  playBtn:       $('play-btn'),
  // Game table
  dealerCards:   $('dealer-cards'),
  dealerScore:   $('dealer-score'),
  playerArea:    $('player-area'),
  statusBar:     $('status-bar'),
  insuranceBar:  $('insurance-bar'),
  insYesBtn:     $('ins-yes-btn'),
  insNoBtn:      $('ins-no-btn'),
  resultBanner:  $('result-banner'),
  // Action buttons
  hitBtn:        $('hit-btn'),
  standBtn:      $('stand-btn'),
  doubleBtn:     $('double-btn'),
  splitBtn:      $('split-btn'),
  insuranceBtn:  $('insurance-btn'),
  // AI panel
  aiActionWord:  $('ai-action-word'),
  confidenceFill:$('confidence-fill'),
  confidencePct: $('confidence-pct'),
  aiAnalysis:    $('ai-analysis'),
  aiBriefReason: $('ai-brief-reason'),
  executeBtn:    $('execute-btn'),
  // Strategy matrix
  strategyMatrix:$('strategy-matrix'),
  strategyBadge: $('strategy-badge'),
  // Analytics
  statHands:     $('stat-hands'),
  statWinrate:   $('stat-winrate'),
  statWins:      $('stat-wins'),
  statLosses:    $('stat-losses'),
  statPushes:    $('stat-pushes'),
  statAiAgree:   $('stat-ai-agree'),
  bankrollSvg:   $('bankroll-svg'),
  actionSvg:     $('action-svg'),
  wlpBar:        $('wlp-bar'),
  // Collapsible toggles
  matrixToggle:  $('matrix-toggle'),
  matrixBody:    $('matrix-body'),
  matrixChevron: $('matrix-chevron'),
  analyticsToggle: $('analytics-toggle'),
  analyticsBody:   $('analytics-body'),
  analyticsChevron:$('analytics-chevron'),
};

// ── Session Analytics State ────────────────────────────────────────────────────
const stats = {
  hands:            0,
  wins:             0,
  losses:           0,
  pushes:           0,
  blackjacks:       0,
  surrenders:       0,
  bankroll:         [STARTING_BALANCE],
  actions:          { hit:0, stand:0, double:0, split:0, insurance:0, surrender:0 },
  aiAgreements:     0,
  aiTotal:          0,
  deviations:       0,
  deviationWins:    0,
  deviationLosses:  0,
  deviationHands:   0,
  history:          [],  // last 10 hands
};

// ── Per-hand tracking vars ─────────────────────────────────────────────────────
let lastPlayerAction  = null;
let lastDeviationInfo = null;

// ── Sound System ───────────────────────────────────────────────────────────────

let _audioCtx   = null;
let soundEnabled = true;

function _ctx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

function _tone(freq, type, vol, dur, delay = 0) {
  if (!soundEnabled) return;
  try {
    const ctx  = _ctx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    const t    = ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  } catch(_) {}
}

const sfx = {
  deal:      () => { _tone(900,'sine',0.14,0.06); _tone(550,'sine',0.07,0.05,0.04); },
  chip:      () =>   _tone(1100,'sine',0.08,0.04),
  win:       () => { _tone(523,'sine',0.18,0.22); _tone(659,'sine',0.18,0.22,0.13); },
  blackjack: () => { _tone(523,'sine',0.18,0.18); _tone(659,'sine',0.18,0.18,0.10);
                     _tone(784,'sine',0.22,0.35,0.20); },
  lose:      () => { const ctx=_ctx(); const o=ctx.createOscillator(),g=ctx.createGain();
                     o.type='sawtooth'; o.frequency.setValueAtTime(260,ctx.currentTime);
                     o.frequency.exponentialRampToValueAtTime(120,ctx.currentTime+0.3);
                     g.gain.setValueAtTime(0.12,ctx.currentTime);
                     g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.3);
                     o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime+0.31); },
  surrender: () => { _tone(380,'sine',0.12,0.15); _tone(300,'sine',0.08,0.18,0.1); },
  shuffle:   () => { for(let i=0;i<4;i++) _tone(400+i*60,'sine',0.06,0.04,i*0.05); },
};

// ── Pending AI recommendation for the current hand ─────────────────────────────
// Pending AI recommendation for the current hand
let pendingRec        = null;
let aiWorking         = false;
let currentModel      = 'claude-sonnet-4-6';
let currentProvider   = 'anthropic';
let detailLevel       = 'standard';
let riskProfile       = 'balanced';
let deviatedThisHand  = false;

// Available models, keyed by provider
const MODELS = {
  anthropic: [
    { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6 (Recommended)' },
    { id: 'claude-opus-4-6',           label: 'Claude Opus 4.6' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
  openai: [
    { id: 'gpt-4o',                    label: 'GPT-4o (Recommended)' },
    { id: 'gpt-4o-mini',               label: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo',               label: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo',             label: 'GPT-3.5 Turbo' },
  ],
};

// ── Initialise ─────────────────────────────────────────────────────────────────

function init() {
  populateModels();
  buildStrategyMatrix();
  wireEvents();
  setActionButtons([]);
  updateRiskBadge();
  updateShoeDisplay();
  updateActiveBetChip();
  el.playBtn.disabled = true;
  document.body.classList.add('no-key');
  setStatus('Upload your .env file to begin');
}

function populateModels() {
  const list = MODELS[currentProvider] || MODELS.anthropic;
  el.modelSelect.innerHTML = list.map(m =>
    `<option value="${m.id}">${m.label}</option>`
  ).join('');
  currentModel = list[0].id;
}

// ── Event Wiring ───────────────────────────────────────────────────────────────

function wireEvents() {
  // Direct key paste input
  el.keyInput.addEventListener('input', () => {
    const val = el.keyInput.value.trim();
    const looksValid = (val.startsWith('sk-ant-') || val.startsWith('sk-')) && val.length > 20;
    el.keyInput.classList.toggle('valid', looksValid);
  });

  el.keyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') applyKeyInput();
  });

  el.keyInput.addEventListener('blur', () => {
    if (el.keyInput.value.trim().length > 20) applyKeyInput();
  });

  // Show/hide key toggle
  el.keyEyeBtn.addEventListener('click', () => {
    const isHidden = el.keyInput.type === 'password';
    el.keyInput.type = isHidden ? 'text' : 'password';
    el.keyEyeBtn.textContent = isHidden ? '🙈' : '👁';
  });

  // .env upload
  el.envFile.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const masked = await loadKeyFromFile(file);
      markKeyLoaded(masked);
    } catch (err) {
      setStatus('Error: ' + err.message, 'lose');
    }
    e.target.value = '';
  });

  // Sound toggle
  el.soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    el.soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
    el.soundBtn.classList.toggle('muted', !soundEnabled);
    if (soundEnabled) sfx.chip();
  });

  // Bet chip presets
  document.querySelectorAll('.bet-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = parseInt(btn.dataset.amount, 10);
      if (amount > game.balance) return;
      game.bet = Math.min(BET_MAX, Math.max(BET_MIN, amount));
      el.betDisplay.textContent = '$' + game.bet;
      el.playBtn.disabled = !canDeal();
      updateActiveBetChip();
      sfx.chip();
    });
  });

  // Deck count selector
  el.deckSelect.addEventListener('change', e => {
    setNumDecks(parseInt(e.target.value, 10));
    updateShoeDisplay();
    showShuffleNotice();
    setStatus(`Shoe reshuffled — ${e.target.value}-deck shoe in play.`);
  });

  // Detail level toggle
  el.detailToggle.addEventListener('click', e => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    detailLevel = btn.dataset.detail;
    el.detailToggle.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('pill-active'));
    btn.classList.add('pill-active');
    applyDetailLevel();
  });

  // Risk profile toggle
  el.riskToggle.addEventListener('click', e => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    riskProfile = btn.dataset.risk;
    el.riskToggle.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('pill-active'));
    btn.classList.add('pill-active');
    updateRiskBadge();
  });

  // Family (provider) selection
  el.familySelect.addEventListener('change', e => {
    currentProvider = e.target.value;
    populateModels();
    el.playBtn.disabled = !canDeal();
  });

  // Model selection
  el.modelSelect.addEventListener('change', e => {
    currentModel = e.target.value;
  });

  el.refreshModels.addEventListener('click', populateModels);

  // Bet controls
  el.betMinus.addEventListener('click', () => {
    game.bet = Math.max(BET_MIN, game.bet - BET_STEP);
    el.betDisplay.textContent = '$' + game.bet;
    el.playBtn.disabled = !canDeal();
  });
  el.betPlus.addEventListener('click', () => {
    game.bet = Math.min(BET_MAX, Math.min(game.balance, game.bet + BET_STEP));
    el.betDisplay.textContent = '$' + game.bet;
    el.playBtn.disabled = !canDeal();
  });

  // PLAY
  el.playBtn.addEventListener('click', startRound);

  // Action buttons
  el.hitBtn.addEventListener('click',       () => handleAction('hit'));
  el.standBtn.addEventListener('click',     () => handleAction('stand'));
  el.doubleBtn.addEventListener('click',    () => handleAction('double'));
  el.splitBtn.addEventListener('click',     () => handleAction('split'));
  el.insuranceBtn.addEventListener('click', () => handleAction('insurance'));
  el.surrenderBtn.addEventListener('click', () => handleAction('surrender'));

  // Insurance bar
  el.insYesBtn.addEventListener('click',    () => resolveInsuranceChoice(true));
  el.insNoBtn.addEventListener('click',     () => resolveInsuranceChoice(false));

  // Execute Recommendation
  el.executeBtn.addEventListener('click', executeRecommendation);

  // About modal
  el.aboutBtn.addEventListener('click',   () => el.aboutModal.classList.remove('hidden'));
  el.aboutClose.addEventListener('click', () => el.aboutModal.classList.add('hidden'));
  el.aboutModal.addEventListener('click', e => {
    if (e.target === el.aboutModal) el.aboutModal.classList.add('hidden');
  });

  // Keyboard shortcuts modal
  el.shortcutsBtn.addEventListener('click',   () => el.shortcutsModal.classList.remove('hidden'));
  el.shortcutsClose.addEventListener('click', () => el.shortcutsModal.classList.add('hidden'));
  el.shortcutsModal.addEventListener('click', e => {
    if (e.target === el.shortcutsModal) el.shortcutsModal.classList.add('hidden');
  });

  // Even money offer
  el.emYesBtn.addEventListener('click', () => resolveEvenMoneyChoice(true));
  el.emNoBtn.addEventListener('click',  () => resolveEvenMoneyChoice(false));

  // 21+3 side bet toggle
  el.sidebetToggle.addEventListener('click', () => {
    game.sideBetActive = !game.sideBetActive;
    el.sidebetToggle.textContent = game.sideBetActive ? 'ON' : 'OFF';
    el.sidebetToggle.classList.toggle('active', game.sideBetActive);
    el.playBtn.disabled = !canDeal();
    sfx.chip();
  });

  // Hand history collapsible
  el.historyToggle.addEventListener('click', () => {
    const open = el.historyBody.classList.toggle('open');
    el.historyChevron.classList.toggle('open', open);
  });

  // Broke overlay reset
  el.brokeResetBtn.addEventListener('click', resetSession);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyDown);

  // Collapsible sections
  el.matrixToggle.addEventListener('click', () => {
    const open = el.matrixBody.classList.toggle('open');
    el.matrixChevron.classList.toggle('open', open);
  });
  el.analyticsToggle.addEventListener('click', () => {
    const open = el.analyticsBody.classList.toggle('open');
    el.analyticsChevron.classList.toggle('open', open);
  });
}

// ── Game Flow ──────────────────────────────────────────────────────────────────

async function startRound() {
  if (!canDeal()) return;

  pendingRec       = null;
  deviatedThisHand = false;
  lastPlayerAction  = null;
  lastDeviationInfo = null;
  el.resultBanner.classList.add('hidden');
  el.deviationBar.classList.add('hidden');
  el.insuranceBar.classList.add('hidden');
  el.evenMoneyBar.classList.add('hidden');
  el.sidebetResult.classList.add('hidden');
  el.sidebetResult.className = 'info-chip sidebet-result-chip hidden';
  el.playBtn.disabled = true;
  resetAIPanel();

  startHand();          // game.js — deducts bet, deals cards

  if (game.shuffledRecently) {
    game.shuffledRecently = false;
    showShuffleNotice();
  }
  updateShoeDisplay();

  updateBalanceDisplay();
  updateActiveBetChip();
  renderTable(true);    // animate = true
  sfx.deal();
  setStatus('Dealing…');

  // Resolve 21+3 side bet immediately after deal
  const sbResult = resolveSideBet();
  if (sbResult) {
    updateBalanceDisplay();
    showSideBetResult(sbResult);
  }

  // Small pause so dealing animation plays before we continue
  await delay(600);

  // Check for player blackjack
  const playerHand   = game.playerHands[0];
  const dealerUpRank = game.dealerCards[0].rank;

  if (isBlackjack(playerHand)) {
    el.dealerScore.textContent = '';  // hide dealer score while hole card is hidden
    if (dealerUpRank === 'A') {
      // Offer even money (guaranteed 1:1) instead of insurance
      const tookEvenMoney = await showEvenMoneyOffer();
      if (tookEvenMoney) {
        const results = doEvenMoney();
        renderDealerCards();
        showResults(results);
        return;
      }
    }
    // Peek at hole card
    await revealHoleCard();
    const results = runDealer();
    renderDealerCards();
    showResults(results);
    return;
  }

  // Dealer shows Ace — offer insurance before player acts
  if (dealerUpRank === 'A') {
    await showInsuranceOffer();
    // After insurance decision, check if dealer has BJ (peek)
    if (isBlackjack(game.dealerCards)) {
      await revealHoleCard();
      const results = runDealer();
      renderDealerCards();
      showResults(results);
      return;
    }
  }

  await playerTurn();
}

// Offer insurance and wait for user's choice.
// Returns a Promise that resolves when the user clicks Yes or No.
function showInsuranceOffer() {
  return new Promise(resolve => {
    el.insuranceBar.classList.remove('hidden');
    el._insResolve = resolve;
    setStatus('Dealer shows Ace — Take insurance?', 'thinking');
    setActionButtons([]);  // disable regular actions during insurance prompt
  });
}

function resolveInsuranceChoice(takesInsurance) {
  el.insuranceBar.classList.add('hidden');
  if (takesInsurance) {
    doInsurance();
    updateBalanceDisplay();
    setStatus(`Insurance placed: $${game.insuranceBet}`);
  } else {
    setStatus('Insurance declined.');
  }
  if (el._insResolve) { el._insResolve(); el._insResolve = null; }
}

async function playerTurn() {
  const actions = getAvailableActions();
  if (actions.length === 0 || game.phase !== 'playing') {
    await dealerPhase();
    return;
  }

  setActionButtons(actions);
  updateProbBreakdown(actions);
  setStatus('AI is thinking…', 'thinking');
  aiWorking = true;
  el.executeBtn.disabled = true;
  showAIThinking();

  try {
    const gs  = buildGameState();
    const rec = await askAgent(gs, currentModel, currentProvider, detailLevel, riskProfile);
    pendingRec = rec;
    updateAIPanel(rec, gs);
    setStatus(`Your turn — AI recommends ${rec.action.toUpperCase()}`);
    el.executeBtn.disabled = false;
  } catch (err) {
    showAIError(err.message);
    setStatus('AI unavailable — play manually');
  }

  aiWorking = false;
}

async function handleAction(type) {
  if (game.phase !== 'playing') return;
  const actions = getAvailableActions();
  if (!actions.includes(type)) return;

  // Track deviation from AI recommendation (ignore insurance/surrender for deviation purposes)
  if (pendingRec && type !== pendingRec.action &&
      !['insurance', 'surrender'].includes(type) && !deviatedThisHand) {
    deviatedThisHand = true;
    stats.deviations++;
    stats.deviationHands++;
    // Store info for post-hand deviation review
    const hand = getActiveHand();
    const bsCode = basicStrategy(hand, game.dealerCards[0].rank,
      getAvailableActions().includes('double'), getAvailableActions().includes('split'));
    lastDeviationInfo = {
      played:    type,
      rec:       pendingRec.action,
      bs:        strategyLabel(bsCode),
      handDesc:  describeHand(hand, game.dealerCards[0]),
    };
  }

  // Record action for analytics
  lastPlayerAction = type;
  if (stats.actions[type] !== undefined) stats.actions[type]++;

  setActionButtons([]);
  el.executeBtn.disabled = true;

  // Surrender ends hand immediately without dealer reveal
  if (type === 'surrender') {
    const results = doSurrender();
    renderTable();
    updateBalanceDisplay();
    updateShoeDisplay();
    showResults(results);
    return;
  }

  switch (type) {
    case 'hit':       doHit();       break;
    case 'stand':     doStand();     break;
    case 'double':    doDouble();    break;
    case 'split':     doSplit();     break;
    case 'insurance':
      doInsurance();
      updateBalanceDisplay();
      break;
  }

  renderTable();
  updateBalanceDisplay();
  updateShoeDisplay();

  if (game.phase === 'dealer') {
    await dealerPhase();
  } else if (game.phase === 'playing') {
    await playerTurn();
  }
}

function executeRecommendation() {
  if (!pendingRec || game.phase !== 'playing') return;
  const action = pendingRec.action;
  const actions = getAvailableActions();
  if (!actions.includes(action)) return;

  // Brief visual pulse on the corresponding button
  const btnMap = {
    hit: el.hitBtn, stand: el.standBtn, double: el.doubleBtn,
    split: el.splitBtn, insurance: el.insuranceBtn, surrender: el.surrenderBtn,
  };
  const btn = btnMap[action];
  if (btn) {
    btn.classList.add('btn-pulsing');
    btn.addEventListener('animationend', () => btn.classList.remove('btn-pulsing'), { once: true });
  }

  setTimeout(() => handleAction(action), 350);
}

async function dealerPhase() {
  setActionButtons([]);
  setStatus('Dealer reveals hole card…');
  await revealHoleCard();
  await delay(400);

  // Draw dealer cards one by one with animation
  const beforeLen = game.dealerCards.length;
  const results   = runDealer();   // synchronous — draws all cards, resolves
  const afterLen  = game.dealerCards.length;

  // Animate each newly drawn dealer card
  for (let i = beforeLen; i < afterLen; i++) {
    renderDealerCards(i);
    sfx.deal();
    setStatus(`Dealer draws: ${game.dealerCards[i].rank}${game.dealerCards[i].suit}`);
    updateShoeDisplay();
    await delay(550);
  }

  renderDealerCards();
  showResults(results);
}

async function revealHoleCard() {
  // Flip the hole card with animation
  game.dealerCards[1].faceDown = false;
  const holeEl = el.dealerCards.children[1];
  if (holeEl) {
    holeEl.classList.remove('face-down');
    await delay(600);  // wait for CSS flip
  }
  updateDealerScore();
}

function showResults(results) {
  // Aggregate outcome for display
  const allBust  = results.every(r => r.outcome === 'bust');
  const anyBJ    = results.some(r => r.outcome === 'blackjack');
  const anyWin   = results.some(r => r.outcome === 'win' || r.outcome === 'blackjack');
  const anyLose  = results.some(r => r.outcome === 'lose' || r.outcome === 'bust');
  const anyPush  = results.some(r => r.outcome === 'push');
  const totalNet = results.reduce((s, r) => s + r.net, 0)
                 + (results.insuranceDelta || 0);

  const isSurrender  = results.length === 1 && results[0].outcome === 'surrender';
  const isEvenMoney  = results.length === 1 && results[0].outcome === 'even-money';

  let msg, cls;
  if (isEvenMoney) {
    msg = `EVEN MONEY — +$${totalNet} 🤝`;
    cls = 'result-win';
  } else if (isSurrender) {
    msg = `SURRENDER — $${Math.abs(totalNet)} lost`;
    cls = 'result-push';
  } else if (anyBJ) {
    msg = `BLACKJACK! +$${Math.abs(totalNet)} 🎰`;
    cls = 'result-blackjack';
  } else if (results.length > 1) {
    // Split results
    const parts = results.map(r => r.outcome.toUpperCase()).join(' / ');
    msg = `${parts}  Net: ${totalNet >= 0 ? '+' : ''}$${totalNet}`;
    cls = totalNet > 0 ? 'result-win' : totalNet < 0 ? 'result-lose' : 'result-push';
  } else {
    const r = results[0];
    if (r.outcome === 'win')   { msg = `YOU WIN  +$${r.net}`;  cls = 'result-win';  }
    else if (r.outcome === 'lose' || r.outcome === 'bust') {
      msg = r.outcome === 'bust' ? `BUST  -$${Math.abs(r.net)}` : `DEALER WINS  -$${Math.abs(r.net)}`;
      cls = 'result-lose';
    } else {
      msg = `PUSH — Bet returned`;
      cls = 'result-push';
    }
  }

  el.resultBanner.textContent = msg;
  el.resultBanner.className   = `result-banner ${cls}`;
  el.resultBanner.classList.remove('hidden');

  if (isSurrender)           sfx.surrender();
  else if (anyBJ)            sfx.blackjack();
  else if (isEvenMoney)      sfx.win();
  else if (anyWin)           sfx.win();
  else if (anyLose && totalNet < 0) {
    sfx.lose();
    document.body.classList.remove('lose-flash');
    void document.body.offsetWidth;
    document.body.classList.add('lose-flash');
    setTimeout(() => document.body.classList.remove('lose-flash'), 900);
  }

  updateBalanceDisplay(totalNet);
  updateActiveBetChip();
  updateAnalytics(results, totalNet);

  // Deviation review
  if (lastDeviationInfo) {
    const d = lastDeviationInfo;
    el.deviationBar.textContent =
      `⚠ You played ${d.played.toUpperCase()} on ${d.handDesc} — AI recommended ${d.rec.toUpperCase()}. Basic strategy: ${d.bs}.`;
    el.deviationBar.classList.remove('hidden');
  }

  setStatus('');
  el.playBtn.disabled = !canDeal();

  // Broke check
  if (game.balance < BET_MIN) {
    setTimeout(() => el.brokeOverlay.classList.remove('hidden'), 800);
  }
}

// ── Rendering ─────────────────────────────────────────────────────────────────

// Full table re-render. animate=true adds deal-in CSS class to new cards.
function renderTable(animate = false) {
  renderDealerCards();
  renderPlayerArea(animate);
  updateDealerScore();
  updatePlayerScores();
}

function renderDealerCards(highlightIdx = -1) {
  // Only re-render cards we haven't drawn yet, to avoid disturbing flip state
  const existing = el.dealerCards.children.length;
  for (let i = existing; i < game.dealerCards.length; i++) {
    const cardEl = makeCardEl(game.dealerCards[i], i === highlightIdx);
    el.dealerCards.appendChild(cardEl);
  }
  updateDealerScore();
}

function renderPlayerArea(animate = false) {
  el.playerArea.innerHTML = '';

  if (game.playerHands.length === 1) {
    // Single hand
    const container = document.createElement('div');
    container.className = 'area-section';

    const label  = makeLabel('You', game.playerHands[0], false);
    const row    = makeCardRow(game.playerHands[0], animate);
    const chips  = makeChipStack(game.handBets[0]);
    container.append(label, row, chips);
    el.playerArea.appendChild(container);
  } else {
    // Split hands
    const wrap = document.createElement('div');
    wrap.className = 'split-hands';

    game.playerHands.forEach((hand, i) => {
      const sec   = document.createElement('div');
      sec.className = 'hand-section' + (i === game.activeHand ? ' active-hand' : '');

      const label = makeLabel(`Hand ${i + 1}`, hand, false);
      const row   = makeCardRow(hand, animate && i >= 1);
      const chips = makeChipStack(game.handBets[i]);
      sec.append(label, row, chips);
      wrap.appendChild(sec);
    });
    el.playerArea.appendChild(wrap);
  }

  updatePlayerScores();
}

function makeLabel(title, cards, hidden) {
  const div = document.createElement('div');
  div.className = 'area-label';

  const span = document.createElement('span');
  span.textContent = title;

  const score = document.createElement('span');
  score.className = 'hand-score';
  if (!hidden && cards.length) {
    const v = handValue(cards);
    const s = isSoft(cards) ? 'Soft ' : '';
    score.textContent = s + v;
    if (v > 21) score.classList.add('bust');
    if (v === 21 && cards.length === 2) score.classList.add('bj');
  }

  div.append(span, score);
  return div;
}

function makeCardRow(cards, animate = false) {
  const row = document.createElement('div');
  row.className = 'card-row';
  cards.forEach((card, i) => {
    const w = document.createElement('div');
    w.className = 'card-wrapper';
    const c = makeCardEl(card, animate && i >= 0);
    w.appendChild(c);
    row.appendChild(w);
  });
  return row;
}

function makeCardEl(card, animate = false) {
  const div = document.createElement('div');
  const isRed = ['♥','♦'].includes(card.suit);
  div.className = 'card' + (isRed ? ' red' : '') + (card.faceDown ? ' face-down' : '');
  if (animate) div.classList.add('dealing');

  // Front face
  const front = document.createElement('div');
  front.className = 'card-front';

  const rankTL = document.createElement('span');
  rankTL.className = 'card-rank';
  rankTL.textContent = card.rank;

  const suitC = document.createElement('span');
  suitC.className = 'card-suit-center';
  suitC.textContent = card.suit;

  const rankBR = document.createElement('span');
  rankBR.className = 'card-rank bottom-right';
  rankBR.textContent = card.rank;

  front.append(rankTL, suitC, rankBR);

  // Back face
  const back = document.createElement('div');
  back.className = 'card-back';

  div.append(front, back);
  return div;
}

function makeChipStack(bet) {
  const wrap = document.createElement('div');
  wrap.className = 'chip-stack';
  wrap.style.marginTop = '10px';

  // Represent the bet as chips
  const denominations = [100, 50, 25, 10, 5];
  const colors        = ['chip-black','chip-green','chip-red','chip-blue','chip-green'];
  let remaining       = bet;

  denominations.forEach((d, i) => {
    let count = Math.floor(remaining / d);
    remaining %= d;
    while (count-- > 0) {
      const chip = document.createElement('div');
      chip.className = `chip ${colors[i]}`;
      chip.textContent = `$${d}`;
      wrap.appendChild(chip);
    }
  });

  return wrap;
}

function updateDealerScore() {
  const visible = game.dealerCards.filter(c => !c.faceDown);
  if (!visible.length) { el.dealerScore.textContent = ''; return; }
  const v  = handValue(visible);
  const s  = isSoft(visible) && visible.length === game.dealerCards.filter(c => !c.faceDown).length ? 'Soft ' : '';
  el.dealerScore.textContent = s + v;
  el.dealerScore.className = 'hand-score' + (v > 21 ? ' bust' : '');
}

function updatePlayerScores() {
  // Scores are embedded in the label inside renderPlayerArea
  // No separate update needed since we call renderPlayerArea on changes
}

function updateBalanceDisplay(delta = 0) {
  el.balanceVal.textContent = '$' + game.balance.toLocaleString();
  if (delta > 0) {
    el.balanceVal.classList.remove('balance-lose');
    void el.balanceVal.offsetWidth; // reflow to restart animation
    el.balanceVal.classList.add('balance-win');
  } else if (delta < 0) {
    el.balanceVal.classList.remove('balance-win');
    void el.balanceVal.offsetWidth;
    el.balanceVal.classList.add('balance-lose');
  }
  // Sync bet display cap
  el.betDisplay.textContent = '$' + game.bet;
}

function setStatus(msg, type = '') {
  el.statusBar.textContent  = msg;
  el.statusBar.className    = 'status-bar' + (type ? ` ${type}` : '');
}

// ── Action Button Control ─────────────────────────────────────────────────────

function setActionButtons(actions) {
  el.hitBtn.disabled       = !actions.includes('hit');
  el.standBtn.disabled     = !actions.includes('stand');
  el.doubleBtn.disabled    = !actions.includes('double');
  el.splitBtn.disabled     = !actions.includes('split');
  el.insuranceBtn.disabled = !actions.includes('insurance');
  el.surrenderBtn.disabled = !actions.includes('surrender');
  // Show bust probability when it's the player's turn
  updateBustDisplay(actions.includes('hit'));
}

// ── AI Panel ──────────────────────────────────────────────────────────────────

function resetAIPanel() {
  el.aiActionWord.textContent = '—';
  el.aiActionWord.className   = 'ai-action-word';
  el.confidenceFill.style.width = '0%';
  el.confidencePct.textContent  = '—';
  el.aiAnalysis.className       = 'ai-analysis-text';
  el.aiAnalysis.textContent     = 'Waiting for deal…';
  el.aiBriefReason.textContent  = '';
  el.executeBtn.disabled        = true;
  el.strategyBadge.className    = 'strategy-badge';
  el.strategyBadge.textContent  = '';
  el.aiDeepStats.classList.add('hidden');
  el.deepAltTable.innerHTML     = '';
  el.probRows.innerHTML = '<div class="prob-placeholder">Deal a hand to see probabilities</div>';
}

function applyDetailLevel() {
  // Show/hide full analysis and deep stats based on current detailLevel
  el.aiAnalysis.style.display    = detailLevel === 'brief'  ? 'none' : '';
  el.aiBriefReason.style.display = detailLevel === 'deep'   ? 'none' : '';
  if (detailLevel !== 'deep') el.aiDeepStats.classList.add('hidden');
}

function updateRiskBadge() {
  const labels = { conservative: 'Conservative', balanced: 'Balanced', aggressive: 'Aggressive' };
  el.riskBadge.textContent = labels[riskProfile] || riskProfile;
  el.riskBadge.className = 'risk-badge ' + (riskProfile !== 'balanced' ? riskProfile : '');
}

function updateAIPanel(rec, gs) {
  // Action word + color class
  const action = rec.action || '—';
  el.aiActionWord.textContent = action.toUpperCase();
  el.aiActionWord.className   = `ai-action-word action-${action}`;

  // Confidence meter
  const conf  = Math.max(0, Math.min(1, rec.confidence || 0));
  const level = conf >= 0.75 ? 'high' : conf >= 0.5 ? 'mid' : 'low';
  el.confidenceFill.style.width = `${Math.round(conf * 100)}%`;
  el.confidenceFill.setAttribute('data-level', level);
  el.confidencePct.textContent  = `${Math.round(conf * 100)}%`;

  // Analysis text — varies by detail level
  el.aiAnalysis.className = 'ai-analysis-text';  // clear loading state
  if (detailLevel === 'brief') {
    el.aiAnalysis.style.display    = 'none';
    el.aiBriefReason.style.display = '';
    el.aiBriefReason.textContent   = rec.brief_reason || '—';
    el.aiDeepStats.classList.add('hidden');
  } else if (detailLevel === 'deep') {
    el.aiAnalysis.style.display    = '';
    el.aiBriefReason.style.display = 'none';
    el.aiAnalysis.textContent      = rec.full_analysis || rec.brief_reason || '—';
    renderDeepStats(rec);
  } else {
    el.aiAnalysis.style.display    = '';
    el.aiBriefReason.style.display = '';
    el.aiAnalysis.textContent      = rec.full_analysis || rec.brief_reason || '—';
    el.aiBriefReason.textContent   = rec.brief_reason || '';
    el.aiDeepStats.classList.add('hidden');
  }

  // Highlight strategy matrix cell
  if (gs) {
    highlightMatrixCell(gs.playerCards, gs.dealerUpCard);

    // AI vs Basic Strategy badge
    const bsAction = rec.basic_strategy_action || basicStrategy(
      gs.playerCards, gs.dealerUpCard.rank, true, true
    );
    const bsLabel  = strategyLabel(bsAction);
    if (rec.action === rec.basic_strategy_action) {
      el.strategyBadge.className   = 'strategy-badge match';
      el.strategyBadge.textContent = `AI matches basic strategy ✓  (${bsLabel})`;
    } else {
      el.strategyBadge.className   = 'strategy-badge deviate';
      el.strategyBadge.textContent = `AI deviates from basic strategy — basic says ${bsLabel}. Reason: ${rec.brief_reason}`;
    }

    // Track AI vs basic strategy agreement
    const pureBS = basicStrategy(gs.playerCards, gs.dealerUpCard.rank,
                                 gs.availableActions.includes('double'),
                                 gs.availableActions.includes('split'));
    stats.aiTotal++;
    if (rec.action === pureBS.toLowerCase() || rec.action === { H:'hit',S:'stand',D:'double',P:'split' }[pureBS]) {
      stats.aiAgreements++;
    }
    updateAnalyticsDisplay();
  }
}

// ── Probability Breakdown ─────────────────────────────────────────────────────

const PROB_ACTION_ORDER = ['stand','hit','double','split','surrender'];

function updateProbBreakdown(availableActions) {
  if (!availableActions?.length || !game.deck.length) {
    el.probRows.innerHTML = '<div class="prob-placeholder">—</div>';
    return;
  }

  const toShow = PROB_ACTION_ORDER.filter(a => availableActions.includes(a) && a !== 'insurance');
  if (!toShow.length) { el.probRows.innerHTML = ''; return; }

  // Find best win% to highlight
  const probs = Object.fromEntries(toShow.map(a => [a, simulateActionProbs(a, 3000)]));
  const bestWin = Math.max(...Object.values(probs).map(p => p?.win ?? 0));

  el.probRows.innerHTML = toShow.map(action => {
    const p = probs[action];
    if (!p) return '';

    const isSurr    = action === 'surrender';
    const winPct    = p.win;
    const pushPct   = p.push;
    const losePct   = p.lose;
    const bustPct   = p.bust;
    const isBest    = !isSurr && winPct === bestWin && bestWin > 0;
    const totalLose = losePct + bustPct;

    const barWin  = isSurr ? 0   : winPct;
    const barPush = isSurr ? 50  : pushPct;
    const barLose = isSurr ? 50  : totalLose;

    const label = isSurr
      ? `50% returned`
      : `${winPct}%W · ${pushPct}%P · ${totalLose}%L${bustPct ? ` (${bustPct}% bust)` : ''}`;

    return `<div class="prob-row">
      <span class="prob-action">${action === 'surrender' ? 'SURR.' : action.toUpperCase()}</span>
      <div class="prob-bar-wrap">
        <div class="prob-seg prob-win"  style="width:${barWin}%"></div>
        <div class="prob-seg prob-push" style="width:${barPush}%"></div>
        <div class="prob-seg prob-lose" style="width:${barLose}%"></div>
      </div>
      <span class="prob-pct${isBest ? ' best' : ''}">${label}</span>
    </div>`;
  }).join('') + `<div class="prob-legend">
    <div class="prob-legend-item"><div class="prob-legend-dot" style="background:var(--green)"></div>Win</div>
    <div class="prob-legend-item"><div class="prob-legend-dot" style="background:var(--gold)"></div>Push</div>
    <div class="prob-legend-item"><div class="prob-legend-dot" style="background:var(--red)"></div>Lose</div>
  </div>`;
}

function renderDeepStats(rec) {
  const hasStat = rec.dealer_bust_probability != null || rec.player_ev != null;
  el.aiDeepStats.classList.toggle('hidden', !hasStat && !rec.alternatives?.length);

  if (rec.dealer_bust_probability != null) {
    const pct = Math.round(rec.dealer_bust_probability * 100);
    el.deepBustProb.textContent = pct + '%';
    el.deepBustProb.style.color = pct >= 40 ? 'var(--green)' : pct >= 25 ? 'var(--amber)' : 'var(--red)';
  } else {
    el.deepBustProb.textContent = '—';
    el.deepBustProb.style.color = '';
  }

  if (rec.player_ev != null) {
    const ev = rec.player_ev;
    el.deepEv.textContent = (ev >= 0 ? '+' : '') + ev.toFixed(2);
    el.deepEv.style.color = ev >= 0 ? 'var(--green)' : 'var(--red)';
  } else {
    el.deepEv.textContent = '—';
    el.deepEv.style.color = '';
  }

  el.deepAltTable.innerHTML = '';
  if (Array.isArray(rec.alternatives)) {
    const header = document.createElement('div');
    header.className = 'deep-stat-label';
    header.style.marginBottom = '4px';
    header.textContent = 'Alternatives';
    el.deepAltTable.appendChild(header);

    rec.alternatives.forEach(alt => {
      const row = document.createElement('div');
      row.className = 'deep-alt-row';

      const actionEl = document.createElement('span');
      actionEl.className = 'deep-alt-action';
      actionEl.textContent = alt.action || '—';

      const evEl = document.createElement('span');
      evEl.className = 'deep-alt-ev' + (alt.ev >= 0 ? ' pos' : ' neg');
      evEl.textContent = alt.ev != null ? ((alt.ev >= 0 ? '+' : '') + Number(alt.ev).toFixed(2)) : '—';

      const notesEl = document.createElement('span');
      notesEl.className = 'deep-alt-notes';
      notesEl.textContent = alt.notes || '';

      row.append(actionEl, evEl, notesEl);
      el.deepAltTable.appendChild(row);
    });
  }
}

function showAIThinking() {
  el.aiActionWord.textContent = '…';
  el.aiActionWord.className   = 'ai-action-word';
  el.aiBriefReason.textContent = '';
  el.confidenceFill.style.width = '0%';
  el.confidencePct.textContent  = '—';
  el.aiAnalysis.className = 'ai-analysis-text loading';
  el.aiAnalysis.innerHTML = `
    <div class="ai-thinking">
      Analyzing
      <span class="dot-1"></span>
      <span class="dot-2"></span>
      <span class="dot-3"></span>
    </div>`;
}

function showAIError(msg) {
  el.aiAnalysis.className = 'ai-analysis-text';
  el.aiAnalysis.innerHTML = `<span class="ai-error">AI error: ${msg}</span>`;
  el.aiActionWord.textContent = '—';
  el.aiActionWord.className   = 'ai-action-word';
}

// Build the game state object passed to agent.js
function buildGameState() {
  const hand = getActiveHand();
  const available = getAvailableActions();
  return {
    playerCards:      hand,
    playerTotal:      handValue(hand),
    isSoft:           isSoft(hand),
    dealerUpCard:     game.dealerCards[0],
    availableActions: available,
    bet:              game.handBets[game.activeHand],
    balance:          game.balance,
    isAfterSplit:     game.playerHands.length > 1,
    runningCount:     game.runningCount,
    trueCount:        parseFloat(trueCount().toFixed(1)),
  };
}

// ── Strategy Matrix (Stretch 1) ───────────────────────────────────────────────

const DEALER_COLS = ['2','3','4','5','6','7','8','9','10','A'];

// Pre-build the full basic strategy table.
function buildStrategyMatrix() {
  const table = document.createElement('table');
  table.className = 'strategy-matrix';

  // Header row
  const thead = document.createElement('thead');
  const hrow  = document.createElement('tr');
  hrow.innerHTML = '<th>Hand</th>' +
    DEALER_COLS.map(d => `<th>${d}</th>`).join('');
  thead.appendChild(hrow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  // ── Hard totals ────────────────────────────────────────────────────────────
  const hardSepRow = document.createElement('tr');
  hardSepRow.className = 'section-sep';
  hardSepRow.innerHTML = `<td colspan="${DEALER_COLS.length + 1}">Hard Totals</td>`;
  tbody.appendChild(hardSepRow);

  for (let total = 8; total <= 21; total++) {
    const tr = document.createElement('tr');
    tr.dataset.rowKey = `H${total}`;

    const labelTd = document.createElement('td');
    labelTd.className = 'row-label';
    labelTd.textContent = `Hard ${total}`;
    tr.appendChild(labelTd);

    // Synthetic hard hand: two non-ace cards summing to total
    const c1r = total >= 12 ? String(Math.min(total - 2, 10)) : '4';
    const c2r = total >= 12 ? '2' : String(total - 4);
    const synthCards = [{ rank: c1r, suit: '♠' }, { rank: c2r === '10' ? '10' : c2r, suit: '♥' }];
    // Override value by using a 3-card hard hand to avoid accidental pairs/soft
    const hardCards = makeHardCards(total);

    DEALER_COLS.forEach(d => {
      const action = basicStrategy(hardCards, d, true, false);
      const td = document.createElement('td');
      td.className = `cell-${action}`;
      td.textContent = action;
      td.dataset.col = d;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }

  // ── Soft totals ────────────────────────────────────────────────────────────
  const softSepRow = document.createElement('tr');
  softSepRow.className = 'section-sep';
  softSepRow.innerHTML = `<td colspan="${DEALER_COLS.length + 1}">Soft Totals</td>`;
  tbody.appendChild(softSepRow);

  for (let other = 2; other <= 9; other++) {
    const total = 11 + other; // Ace + other
    const tr  = document.createElement('tr');
    tr.dataset.rowKey = `S${total}`;

    const labelTd = document.createElement('td');
    labelTd.className = 'row-label';
    labelTd.textContent = `A + ${other}`;
    tr.appendChild(labelTd);

    const softCards = [{ rank: 'A', suit: '♠' }, { rank: String(other), suit: '♥' }];

    DEALER_COLS.forEach(d => {
      const action = basicStrategy(softCards, d, true, false);
      const td = document.createElement('td');
      td.className = `cell-${action}`;
      td.textContent = action;
      td.dataset.col = d;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }

  // ── Pairs ──────────────────────────────────────────────────────────────────
  const pairSepRow = document.createElement('tr');
  pairSepRow.className = 'section-sep';
  pairSepRow.innerHTML = `<td colspan="${DEALER_COLS.length + 1}">Pairs</td>`;
  tbody.appendChild(pairSepRow);

  const pairRanks = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];
  pairRanks.forEach(r => {
    const tr = document.createElement('tr');
    tr.dataset.rowKey = `P-${r}`;

    const labelTd = document.createElement('td');
    labelTd.className = 'row-label';
    labelTd.textContent = `${r} - ${r}`;
    tr.appendChild(labelTd);

    const pairCards = [{ rank: r, suit: '♠' }, { rank: r, suit: '♥' }];

    DEALER_COLS.forEach(d => {
      const action = basicStrategy(pairCards, d, true, true);
      const td = document.createElement('td');
      td.className = `cell-${action}`;
      td.textContent = action;
      td.dataset.col = d;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  el.strategyMatrix.innerHTML = '';
  el.strategyMatrix.appendChild(table);
}

// Create synthetic hard cards for a given total (avoids accidental pairs or soft hands).
function makeHardCards(total) {
  if (total >= 21) return [{ rank:'K',suit:'♠'},{rank:'K',suit:'♥'},{rank:String(total-20),suit:'♦'}];
  if (total >= 12) return [{ rank:'10',suit:'♠'},{rank:String(total-10),suit:'♥'}];
  // 8-11: use two non-ace cards
  const r1 = Math.floor(total / 2);
  const r2 = total - r1;
  return [{ rank:String(r1),suit:'♠'},{rank:String(r2),suit:'♥'}];
}

// Highlight the matrix cell corresponding to the current hand + dealer card.
function highlightMatrixCell(playerCards, dealerUpCard) {
  // Clear previous highlight
  el.strategyMatrix.querySelectorAll('.current-cell').forEach(c => c.classList.remove('current-cell'));

  const rowKey = getMatrixRowKey(playerCards);
  const colKey = getMatrixColKey(dealerUpCard.rank);

  const rowEl = el.strategyMatrix.querySelector(`tr[data-row-key="${rowKey}"]`);
  if (!rowEl) return;

  const cellEl = Array.from(rowEl.querySelectorAll('td[data-col]'))
    .find(td => td.dataset.col === colKey);
  if (cellEl) cellEl.classList.add('current-cell');
}

function getMatrixRowKey(playerCards) {
  if (playerCards.length === 2) {
    const v0 = rankValue(playerCards[0].rank);
    const v1 = rankValue(playerCards[1].rank);
    if (v0 === v1) return `P-${playerCards[0].rank}`;
  }
  if (isSoft(playerCards)) return `S${handValue(playerCards)}`;
  return `H${Math.max(8, Math.min(21, handValue(playerCards)))}`;
}

function getMatrixColKey(dealerRank) {
  return ['J','Q','K'].includes(dealerRank) ? '10' : dealerRank;
}

// ── Analytics (Stretch 2) ─────────────────────────────────────────────────────

function updateAnalytics(results, totalNet) {
  stats.hands++;
  stats.bankroll.push(game.balance);

  const isSurrender = results.length === 1 && results[0].outcome === 'surrender';
  const outcome = isSurrender                                     ? 'surrender'
                : results.some(r => r.outcome === 'blackjack')   ? 'blackjack'
                : results.some(r => r.outcome === 'win')         ? 'win'
                : results.some(r => r.outcome === 'push')        ? 'push'
                : 'lose';

  if (outcome === 'win' || outcome === 'blackjack' || outcome === 'even-money') stats.wins++;
  else if (outcome === 'push')      stats.pushes++;
  else if (outcome === 'surrender') stats.surrenders++;
  else                              stats.losses++;

  if (outcome === 'blackjack') stats.blackjacks++;

  // Deviation outcome tracking
  if (deviatedThisHand) {
    if (outcome === 'win' || outcome === 'blackjack') stats.deviationWins++;
    else if (outcome === 'lose' || outcome === 'bust') stats.deviationLosses++;
  }

  // Hand history (keep last 10)
  const primaryHand = results[0]?.hand || game.playerHands[0];
  stats.history.unshift({
    num:      stats.hands,
    cards:    primaryHand.map(c => c.rank + c.suit).join(' '),
    total:    handValue(primaryHand),
    action:   lastPlayerAction || '—',
    aiRec:    pendingRec?.action || '—',
    outcome,
    net:      totalNet,
    deviated: deviatedThisHand,
  });
  if (stats.history.length > 10) stats.history.pop();

  deviatedThisHand = false;

  updateAnalyticsDisplay();
  renderHandHistory();
}

function updateAnalyticsDisplay() {
  el.statHands.textContent  = stats.hands;
  el.statWins.textContent   = stats.wins;
  el.statLosses.textContent = stats.losses;
  el.statPushes.textContent = stats.pushes;

  const total = stats.wins + stats.losses + stats.pushes;
  if (total > 0) {
    const wr = ((stats.wins + stats.pushes * 0.5) / total * 100).toFixed(1);
    el.statWinrate.textContent = wr + '%';
  }

  if (stats.aiTotal > 0) {
    el.statAiAgree.textContent = Math.round(stats.aiAgreements / stats.aiTotal * 100) + '%';
  }

  el.statDeviations.textContent = stats.deviations;
  if (stats.deviationHands > 0) {
    const devOutcomeTotal = stats.deviationWins + stats.deviationLosses;
    if (devOutcomeTotal > 0) {
      el.statDeviationOutcome.textContent =
        Math.round(stats.deviationWins / devOutcomeTotal * 100) + '%';
    }
  }

  renderBankrollChart();
  renderActionChart();
  renderWLPBar();
}

// SVG sparkline for bankroll over time
function renderBankrollChart() {
  const svg    = el.bankrollSvg;
  const data   = stats.bankroll;
  if (data.length < 2) return;

  const W = svg.clientWidth  || 280;
  const H = svg.clientHeight || 80;
  const min = Math.min(...data) - 20;
  const max = Math.max(...data) + 20;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / (max - min)) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const lastVal = data[data.length - 1];
  const color   = lastVal >= STARTING_BALANCE ? '#22c55e' : '#ef4444';

  svg.innerHTML = `
    <polyline points="${pts}"
      fill="none" stroke="${color}" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="0" y1="${(H - ((STARTING_BALANCE - min) / (max - min)) * H).toFixed(1)}"
          x2="${W}" y2="${(H - ((STARTING_BALANCE - min) / (max - min)) * H).toFixed(1)}"
          stroke="rgba(255,255,255,0.1)" stroke-width="1" stroke-dasharray="4,4"/>
  `;
}

// SVG bar chart for action breakdown
function renderActionChart() {
  const svg = el.actionSvg;
  const acts = ['hit','stand','double','split'];
  const vals = acts.map(a => stats.actions[a]);
  const maxVal = Math.max(1, ...vals);

  const W  = svg.clientWidth  || 280;
  const H  = svg.clientHeight || 80;
  const bw = Math.floor(W / acts.length) - 8;
  const colors = { hit:'#22c55e', stand:'#ef4444', double:'#d4af37', split:'#8b5cf6' };

  svg.innerHTML = acts.map((a, i) => {
    const bh   = Math.max(2, (vals[i] / maxVal) * (H - 20));
    const x    = i * (bw + 8) + 4;
    const y    = H - bh - 16;
    return `
      <rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="3"
            fill="${colors[a]}" opacity="0.8"/>
      <text x="${x + bw/2}" y="${H - 2}" text-anchor="middle"
            fill="#94a3b8" font-size="9" font-family="Inter,sans-serif">${a}</text>
      <text x="${x + bw/2}" y="${y - 2}" text-anchor="middle"
            fill="#e2e8f0" font-size="9" font-family="JetBrains Mono,monospace">${vals[i]}</text>
    `;
  }).join('');
}

// Win/loss/push segmented bar
function renderWLPBar() {
  const total = stats.wins + stats.losses + stats.pushes;
  if (!total) return;
  const wPct = (stats.wins   / total * 100).toFixed(1);
  const lPct = (stats.losses / total * 100).toFixed(1);
  const pPct = (stats.pushes / total * 100).toFixed(1);

  const winSeg  = el.wlpBar.querySelector('.seg-win');
  const lossSeg = el.wlpBar.querySelector('.seg-loss');
  const pushSeg = el.wlpBar.querySelector('.seg-push');
  if (winSeg)  winSeg.style.width  = wPct + '%';
  if (lossSeg) lossSeg.style.width = lPct + '%';
  if (pushSeg) pushSeg.style.width = pPct + '%';
}

// ── Keyboard Shortcuts ─────────────────────────────────────────────────────────

function handleKeyDown(e) {
  // Ignore when typing in any input/select
  if (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;

  // Escape closes any open modal
  if (e.key === 'Escape') {
    el.aboutModal.classList.add('hidden');
    el.shortcutsModal.classList.add('hidden');
    return;
  }

  // ? opens shortcuts modal
  if (e.key === '?') {
    e.preventDefault();
    el.shortcutsModal.classList.remove('hidden');
    return;
  }

  // Ignore game shortcuts when any modal is open
  if (!el.aboutModal.classList.contains('hidden') ||
      !el.shortcutsModal.classList.contains('hidden')) return;

  // Space / Enter → Play if we're between hands, or Execute if it's our turn
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (game.phase !== 'playing') {
      if (!el.playBtn.disabled) startRound();
    } else {
      if (!el.executeBtn.disabled) executeRecommendation();
    }
    return;
  }

  if (game.phase !== 'playing') return;

  const keyMap = {
    'h': 'hit',   'H': 'hit',
    's': 'stand', 'S': 'stand',
    'd': 'double','D': 'double',
    'p': 'split', 'P': 'split',
    'x': 'surrender', 'X': 'surrender',
  };

  const action = keyMap[e.key];
  if (!action) return;
  e.preventDefault();

  const actions = getAvailableActions();
  if (actions.includes(action)) {
    // Brief visual flash on the button
    const btnMap = {
      hit: el.hitBtn, stand: el.standBtn, double: el.doubleBtn,
      split: el.splitBtn, surrender: el.surrenderBtn,
    };
    const btn = btnMap[action];
    if (btn && !btn.disabled) {
      btn.classList.add('btn-pulsing');
      btn.addEventListener('animationend', () => btn.classList.remove('btn-pulsing'), { once: true });
      setTimeout(() => handleAction(action), 120);
    }
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function canDeal() {
  return hasApiKey(currentProvider) && game.balance >= game.bet && game.phase !== 'playing';
}

function updateShoeDisplay() {
  const remaining = game.deck.length;
  const total     = game.shoeTotalCards;
  const pct       = Math.round((remaining / total) * 100);
  el.shoeCounter.textContent = `Shoe: ${remaining} / ${total}  (${pct}%)`;

  const rc = game.runningCount;
  const tc = trueCount().toFixed(1);
  el.rcVal.textContent = (rc > 0 ? '+' : '') + rc;
  el.tcVal.textContent = (parseFloat(tc) > 0 ? '+' : '') + tc;

  // Colour the count chip: hot (positive) = good for player, cold (negative) = bad
  el.countDisplay.classList.remove('hot', 'cold', 'warm');
  if (rc >= 3)       el.countDisplay.classList.add('hot');
  else if (rc <= -3) el.countDisplay.classList.add('cold');
  else if (rc !== 0) el.countDisplay.classList.add('warm');

  updateBetAdvisor();
}

function updateBustDisplay(showIt) {
  if (!showIt) {
    el.bustChip.classList.add('hidden');
    return;
  }
  const prob = bustProbability();
  if (prob === null) { el.bustChip.classList.add('hidden'); return; }

  el.bustChip.classList.remove('hidden');
  const pct = Math.round(prob * 100);
  el.bustVal.textContent = pct + '%';
  el.bustChip.classList.remove('danger', 'caution');
  if (pct >= 50)      el.bustChip.classList.add('danger');
  else if (pct >= 30) el.bustChip.classList.add('caution');
}

function showShuffleNotice() {
  el.shuffleNotice.classList.remove('hidden');
  sfx.shuffle();
  setTimeout(() => el.shuffleNotice.classList.add('hidden'), 4000);
}

function updateActiveBetChip() {
  document.querySelectorAll('.bet-chip').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.amount, 10) === game.bet);
    btn.disabled = parseInt(btn.dataset.amount, 10) > game.balance || game.phase === 'playing';
  });
}

function markKeyLoaded(summary) {
  el.keyDot.classList.add('loaded');
  el.keyText.textContent = `Key loaded ✓ (${summary})`;
  el.keyIndicator.classList.add('loaded');
  document.body.classList.remove('no-key');
  el.playBtn.disabled = !canDeal();
  setStatus('API key loaded. Set your bet and press PLAY.');
}

function applyKeyInput() {
  const raw = el.keyInput.value;
  if (!raw.trim()) return;
  try {
    const provider = setKeyDirectly(raw);
    const key = raw.trim().replace(/\s+/g, '');
    const masked = key.slice(0, 7) + '••••' + key.slice(-4);
    markKeyLoaded(`${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} (${masked})`);
    // Switch family select to match detected provider
    if (el.familySelect.value !== provider) {
      el.familySelect.value = provider;
      currentProvider = provider;
      populateModels();
    }
    el.keyInput.classList.add('valid');
  } catch (err) {
    setStatus('Key error: ' + err.message, 'lose');
    el.keyInput.classList.remove('valid');
  }
}

function strategyLabel(code) {
  return { H: 'Hit', S: 'Stand', D: 'Double', P: 'Split' }[code] || code;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Even Money Flow ────────────────────────────────────────────────────────────

function showEvenMoneyOffer() {
  return new Promise(resolve => {
    el.evenMoneyBar.classList.remove('hidden');
    el._emResolve = resolve;
    setStatus('You have Blackjack! Take even money (1:1 guaranteed)?', 'thinking');
    setActionButtons([]);
  });
}

function resolveEvenMoneyChoice(takes) {
  el.evenMoneyBar.classList.add('hidden');
  if (el._emResolve) { el._emResolve(takes); el._emResolve = null; }
}

// ── 21+3 Side Bet Display ─────────────────────────────────────────────────────

function showSideBetResult(result) {
  el.sidebetResult.classList.remove('hidden', 'win', 'lose');
  if (result.name) {
    el.sidebetResult.textContent = `21+3: ${result.name} +$${result.net}`;
    el.sidebetResult.classList.add('win');
  } else {
    el.sidebetResult.textContent = `21+3: No win −$10`;
    el.sidebetResult.classList.add('lose');
  }
}

// ── Bet Advisor ────────────────────────────────────────────────────────────────

function updateBetAdvisor() {
  const tc = trueCount();
  if (tc >= 2) {
    el.betAdvisor.textContent = `↑ Raise bet (TC +${tc.toFixed(1)})`;
    el.betAdvisor.className   = 'info-chip bet-advisor-chip raise';
  } else if (tc <= -2) {
    el.betAdvisor.textContent = `↓ Lower bet (TC ${tc.toFixed(1)})`;
    el.betAdvisor.className   = 'info-chip bet-advisor-chip lower';
  } else {
    el.betAdvisor.className = 'info-chip bet-advisor-chip hidden';
  }
}

// ── Hand History ──────────────────────────────────────────────────────────────

function renderHandHistory() {
  if (!stats.history.length) {
    el.historyList.innerHTML = '<div class="history-placeholder">No hands played yet.</div>';
    return;
  }
  el.historyList.innerHTML = stats.history.map(h => {
    const netCls = h.net > 0 ? 'pos' : h.net < 0 ? 'neg' : 'zero';
    const netStr = (h.net > 0 ? '+' : '') + '$' + Math.abs(h.net);
    return `<div class="history-row${h.deviated ? ' deviated' : ''}">
      <span class="hh-num">${h.num}</span>
      <span class="hh-cards" title="${h.cards}">${h.cards}</span>
      <span class="hh-total">${h.total}</span>
      <span class="hh-action">${h.action}</span>
      <span class="hh-airec">${h.aiRec}</span>
      <span class="hh-outcome ${h.outcome}">${h.outcome}</span>
      <span class="hh-net ${netCls}">${netStr}</span>
    </div>`;
  }).join('');
}

// ── Session Reset ─────────────────────────────────────────────────────────────

function resetSession() {
  game.balance = STARTING_BALANCE;
  game.bet     = 25;
  game.phase   = 'idle';
  initShoe();
  game.shuffledRecently = false;

  Object.assign(stats, {
    hands: 0, wins: 0, losses: 0, pushes: 0, blackjacks: 0, surrenders: 0,
    bankroll: [STARTING_BALANCE],
    actions: { hit:0, stand:0, double:0, split:0, insurance:0, surrender:0 },
    aiAgreements: 0, aiTotal: 0,
    deviations: 0, deviationWins: 0, deviationLosses: 0, deviationHands: 0,
    history: [],
  });

  el.brokeOverlay.classList.add('hidden');
  el.betDisplay.textContent  = '$' + game.bet;
  updateBalanceDisplay();
  updateActiveBetChip();
  updateShoeDisplay();
  updateAnalyticsDisplay();
  renderHandHistory();
  setActionButtons([]);
  resetAIPanel();
  el.resultBanner.classList.add('hidden');
  el.deviationBar.classList.add('hidden');
  setStatus('New session started. Set your bet and press PLAY.');
  el.playBtn.disabled = !canDeal();
}

// ── Hand Description Helper ───────────────────────────────────────────────────

function describeHand(cards, dealerCard) {
  const v   = handValue(cards);
  const sft = isSoft(cards) ? 'Soft ' : 'Hard ';
  const du  = dealerCard ? ` vs dealer ${dealerCard.rank}` : '';
  return `${sft}${v}${du}`;
}

// ── Boot ───────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
